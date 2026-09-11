"""
Worker asíncrono para ingesta, deduplicación y ruteo de eventos de WhatsApp Cloud API.
Garantiza deduplicación distribuida por wamid, actualización de la ventana de 24 hs
y despacho reactivo al Agente Clínico o CRM.
"""

import os
import re
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

from app.db import supabase
from app.services.whatsapp_cloud.models import (
    MetaWebhookPayload, MetaInboundMessage, MetaMessageStatus
)
from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164

logger = logging.getLogger("whatsapp_cloud_worker")

# Intentar inicializar cliente de Redis si está disponible en variables de entorno
_redis = None
try:
    import redis.asyncio as aioredis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    _redis = None


class EventDeduplicator:
    """
    Control de idempotencia y deduplicación por wamid.
    Utiliza Redis SETNX con TTL de 72 horas (259200 segundos).
    Si Redis no está disponible, utiliza memoria local LRU como fallback.
    """
    _memory_cache: Dict[str, float] = {}
    TTL_SECONDS = 259200

    @classmethod
    async def is_duplicate(cls, wamid: str) -> bool:
        if not wamid:
            return False

        if _redis is not None:
            try:
                # SETNX con caducidad
                is_new = await _redis.set(f"dedup:wamid:{wamid}", "1", nx=True, ex=cls.TTL_SECONDS)
                return not is_new
            except Exception as e:
                logger.warning(f"[Deduplicator] Redis no disponible ({e}), usando fallback en memoria.")

        # Fallback en memoria
        import time
        now = time.time()
        # Limpieza simple si supera 10.000 entradas
        if len(cls._memory_cache) > 10000:
            cls._memory_cache = {k: v for k, v in cls._memory_cache.items() if now - v < cls.TTL_SECONDS}

        if wamid in cls._memory_cache and (now - cls._memory_cache[wamid] < cls.TTL_SECONDS):
            return True
        cls._memory_cache[wamid] = now
        return False


async def process_meta_webhook_payload(payload_dict: Dict[str, Any]):
    """
    Procesa un payload validado recibido de Meta Graph API.
    """
    entries = payload_dict.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            field = change.get("field")
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")

            # A. Actualización de estado de Plantilla (APPROVED, REJECTED, etc.)
            if field == "message_template_status_update":
                tpl_id = value.get("message_template_id")
                tpl_name = value.get("message_template_name")
                event = value.get("event", "APPROVED")
                reason = value.get("reason")
                try:
                    upd = {"status": event, "updated_at": datetime.now(timezone.utc).isoformat()}
                    if reason and reason != "NONE":
                        upd["rejection_reason"] = reason
                    if tpl_id:
                        supabase.table("whatsapp_templates").update(upd).eq("meta_template_id", str(tpl_id)).execute()
                    elif tpl_name:
                        supabase.table("whatsapp_templates").update(upd).eq("name", str(tpl_name)).execute()
                    logger.info(f"[Worker Template Status] Plantilla {tpl_name or tpl_id} actualizada a {event}")
                except Exception as tpl_err:
                    logger.warning(f"[Worker Template Status] Error actualizando estado de plantilla: {tpl_err}")
                continue

            # 1. Procesar Actualizaciones de Estado (sent, delivered, read, failed)
            statuses = value.get("statuses", [])
            for st in statuses:
                await handle_status_update(st, phone_number_id)

            # 2. Procesar Mensajes Entrantes
            messages = value.get("messages", [])
            contacts = value.get("contacts", [])
            contact_name = contacts[0].get("profile", {}).get("name") if contacts else None

            for msg in messages:
                wamid = msg.get("id")
                if await EventDeduplicator.is_duplicate(wamid):
                    logger.info(f"[Worker] Mensaje wamid={wamid} duplicado. Omitiendo procesamiento.")
                    continue
                await handle_inbound_message(msg, phone_number_id, contact_name)


async def handle_status_update(status_dict: Dict[str, Any], phone_number_id: Optional[str]):
    """
    Actualiza el estado de entrega o lectura de un mensaje outbound en:
      1. whatsapp_messages (auditoría oficial de Meta)
      2. public.mensajes (chat interactivo del CRM para mostrar tildes ✓, ✓✓ gris, ✓✓ azul o alerta de fallo)
    """
    wamid = status_dict.get("id")
    status_name = status_dict.get("status")  # sent, delivered, read, failed
    timestamp_epoch = status_dict.get("timestamp")

    dt_event = None
    if timestamp_epoch:
        try:
            dt_event = datetime.fromtimestamp(int(timestamp_epoch), tz=timezone.utc).isoformat()
        except Exception:
            dt_event = datetime.now(timezone.utc).isoformat()

    update_fields: Dict[str, Any] = {"status": status_name}

    if status_name == "sent":
        update_fields["sent_at"] = dt_event
    elif status_name == "delivered":
        update_fields["delivered_at"] = dt_event
    elif status_name == "read":
        update_fields["read_at"] = dt_event
    elif status_name == "failed":
        errors = status_dict.get("errors", [{}])
        first_err = errors[0] if errors else {}
        update_fields["error_code"] = first_err.get("code")
        update_fields["error_message"] = first_err.get("message")

    # 1. Actualizar whatsapp_messages
    try:
        supabase.table("whatsapp_messages").update(update_fields).eq("wamid", wamid).execute()
        logger.info(f"[Worker Status] whatsapp_messages wamid={wamid} actualizado a status='{status_name}'")
    except Exception as e:
        logger.error(f"[Worker Status] Error actualizando whatsapp_messages para wamid={wamid}: {e}")

    # 2. Sincronizar en public.mensajes del CRM para actualización en tiempo real de tildes
    status_crm_map = {
        "sent": "enviado",
        "delivered": "entregado",
        "read": "leido",
        "failed": "fallido"
    }
    crm_delivery_status = status_crm_map.get(status_name, status_name)

    try:
        # Buscar el mensaje en public.mensajes por whatsapp_message_id indexado
        m_res = supabase.table("mensajes").select("id, metadata_json").eq("whatsapp_message_id", wamid).execute()
        msg_id = None
        current_meta = {}
        if m_res.data and len(m_res.data) > 0:
            msg_id = m_res.data[0]["id"]
            current_meta = m_res.data[0].get("metadata_json") or {}
        else:
            # Fallback por filtro metadata_json wamid
            m_res2 = supabase.table("mensajes").select("id, metadata_json").filter("metadata_json->>wamid", "eq", wamid).execute()
            if m_res2.data and len(m_res2.data) > 0:
                msg_id = m_res2.data[0]["id"]
                current_meta = m_res2.data[0].get("metadata_json") or {}
            else:
                m_res3 = supabase.table("mensajes").select("id, metadata_json").filter("metadata_json->>whatsapp_message_id", "eq", wamid).execute()
                if m_res3.data and len(m_res3.data) > 0:
                    msg_id = m_res3.data[0]["id"]
                    current_meta = m_res3.data[0].get("metadata_json") or {}

        if msg_id:
            current_meta["delivery_status"] = crm_delivery_status
            if status_name == "delivered":
                current_meta["delivered_at"] = dt_event
            elif status_name == "read":
                current_meta["read_at"] = dt_event
            elif status_name == "failed":
                errors = status_dict.get("errors", [{}])
                first_err = errors[0] if errors else {}
                current_meta["error_code"] = first_err.get("code")
                current_meta["error_message"] = first_err.get("message")

            supabase.table("mensajes").update({
                "metadata_json": current_meta,
                "whatsapp_message_id": wamid
            }).eq("id", msg_id).execute()
            logger.info(f"[Worker Status] public.mensajes id={msg_id} actualizado a delivery_status='{crm_delivery_status}'")
    except Exception as sync_err:
        logger.warning(f"[Worker Status] Error sincronizando tilde en public.mensajes: {sync_err}")


async def handle_inbound_message(msg_dict: Dict[str, Any], phone_number_id: Optional[str], contact_name: Optional[str]):
    """
    Maneja un mensaje de paciente entrante:
      - Normaliza el teléfono E.164
      - Renueva la ventana de 24 horas
      - Descarga y transcribe notas de voz o imágenes
      - Persiste el mensaje y rutea al agente IA o respuestas interactivas de turnos
    """
    wamid = msg_dict.get("id")
    raw_sender = msg_dict.get("from")
    normalized_phone = normalize_to_meta_e164(raw_sender)
    msg_type = msg_dict.get("type", "text")

    # Extraer contenido de texto según el tipo
    text_content = ""
    interactive_id = None
    media_url = None
    transcripcion_audio = None
    media_meta: Dict[str, Any] = {
        "wamid": wamid,
        "whatsapp_message_id": wamid,
        "tipo": msg_type,
        "provider": "meta_cloud_api",
        "leido_por_operador": False
    }

    if msg_type == "text":
        text_content = msg_dict.get("text", {}).get("body", "")
    elif msg_type == "interactive":
        interactive = msg_dict.get("interactive", {})
        btn_reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
        interactive_id = btn_reply.get("id")
        text_content = btn_reply.get("title", "")
    elif msg_type == "audio":
        audio_info = msg_dict.get("audio", {})
        media_id = audio_info.get("id")
        text_content = "🎤 Nota de voz"
        if media_id:
            try:
                from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials, WhatsAppCloudClient
                from app.agent import transcribir_audio_con_gemini
                p_id, tkn = get_whatsapp_cloud_credentials()
                if p_id and tkn:
                    wa_client = WhatsAppCloudClient(phone_number_id=p_id, access_token=tkn)
                    audio_bytes, mime_type = await wa_client.download_media_bytes(media_id)
                    await wa_client.close()

                    # Subir audio a Supabase Storage
                    storage_path = f"audios/{int(datetime.now().timestamp())}_{media_id}.ogg"
                    try:
                        supabase.storage.from_("whatsapp-media").upload(
                            file=audio_bytes,
                            path=storage_path,
                            file_options={"content-type": mime_type, "upsert": "true"}
                        )
                        pub = supabase.storage.from_("whatsapp-media").get_public_url(storage_path)
                        if pub:
                            media_url = pub
                    except Exception as st_err:
                        logger.warning(f"[Worker Audio] Supabase storage upload warning: {st_err}")

                    # Transcribir audio automáticamente con Google Gemini
                    try:
                        transcripcion_audio = transcribir_audio_con_gemini(audio_bytes=audio_bytes, mime_type=mime_type)
                        if transcripcion_audio:
                            text_content = f"🎤 {transcripcion_audio}"
                            logger.info(f"[Worker Audio] Nota de voz transcripta con éxito: {transcripcion_audio[:60]}...")
                    except Exception as tr_err:
                        logger.warning(f"[Worker Audio] Error en transcripción Gemini: {tr_err}")

                media_meta["media_url"] = media_url
                if transcripcion_audio:
                    media_meta["transcripcion"] = transcripcion_audio
            except Exception as dwn_err:
                logger.error(f"[Worker Audio] Error descargando audio de Meta: {dwn_err}")

    elif msg_type in ("image", "document", "sticker", "video"):
        media = msg_dict.get(msg_type, {})
        media_id = media.get("id")
        caption = media.get("caption") or media.get("filename") or ""

        # Mapeo de etiqueta de texto y tipo normalizado para la interfaz del CRM
        if msg_type == "image":
            tipo_normalizado = "imagen"
            text_content = caption or "📷 [Foto]"
        elif msg_type == "sticker":
            tipo_normalizado = "sticker"
            text_content = "✨ [Sticker]"
        elif msg_type == "video":
            tipo_normalizado = "video"
            text_content = caption or "🎥 [Video]"
        elif msg_type == "document":
            tipo_normalizado = "documento"
            doc_name = media.get("filename") or "Documento"
            text_content = caption or f"📄 [{doc_name}]"
        else:
            tipo_normalizado = msg_type
            text_content = caption or f"[{msg_type.upper()}]"

        media_meta["tipo"] = tipo_normalizado
        if media.get("filename"):
            media_meta["file_name"] = media.get("filename")

        if media_id:
            try:
                from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials, WhatsAppCloudClient
                p_id, tkn = get_whatsapp_cloud_credentials()
                if p_id and tkn:
                    wa_client = WhatsAppCloudClient(phone_number_id=p_id, access_token=tkn)
                    media_bytes, mime_type = await wa_client.download_media_bytes(media_id)
                    await wa_client.close()

                    # Determinar extensión adecuada según MIME y tipo
                    if "webp" in mime_type or msg_type == "sticker":
                        ext = "webp"
                    elif "video" in mime_type or msg_type == "video":
                        ext = "mp4"
                    elif "image" in mime_type or msg_type == "image":
                        ext = "jpg" if "jpeg" in mime_type or "jpg" in mime_type else "png"
                    elif "pdf" in mime_type:
                        ext = "pdf"
                    else:
                        ext = "bin"

                    storage_path = f"{msg_type}s/{int(datetime.now().timestamp())}_{media_id}.{ext}"
                    try:
                        supabase.storage.from_("whatsapp-media").upload(
                            file=media_bytes,
                            path=storage_path,
                            file_options={"content-type": mime_type, "upsert": "true"}
                        )
                        pub = supabase.storage.from_("whatsapp-media").get_public_url(storage_path)
                        if pub:
                            media_url = pub
                    except Exception as st_err:
                        logger.warning(f"[Worker Media] Supabase storage upload warning: {st_err}")

                media_meta["media_url"] = media_url
                media_meta["caption"] = caption
                if msg_type == "video" and ("gif" in str(media.get("mime_type", "")).lower() or "gif" in str(media.get("caption", "")).lower()):
                    media_meta["is_gif"] = True
            except Exception as dwn_err:
                logger.error(f"[Worker Media] Error descargando {msg_type} de Meta: {dwn_err}")
    else:
        text_content = f"[{msg_type.upper()}] Mensaje recibido"

    # 1. Obtener o crear paciente
    try:
        paciente_res = supabase.table("pacientes").select("id, nombre").eq("telefono", normalized_phone).execute()
        paciente_id = None
        if paciente_res.data and len(paciente_res.data) > 0:
            paciente_id = paciente_res.data[0]["id"]
        else:
            # Crear paciente inicial
            new_pac = supabase.table("pacientes").insert({
                "telefono": normalized_phone,
                "nombre": contact_name or f"Paciente {normalized_phone[-4:]}"
            }).execute()
            if new_pac.data:
                paciente_id = new_pac.data[0]["id"]

        # 2. Obtener cuenta de WhatsApp (o cuenta default activa)
        acc_res = supabase.table("whatsapp_accounts").select("id").eq("is_active", True).limit(1).execute()
        account_id = acc_res.data[0]["id"] if (acc_res.data and len(acc_res.data) > 0) else None

        # 3. Renovar o abrir sesión en patient_conversations (Ventana 24h)
        window_limit = datetime.now(timezone.utc) + timedelta(hours=24)
        if paciente_id and account_id:
            conv_res = supabase.table("patient_conversations").select("id, bot_mode").eq("paciente_id", paciente_id).eq("account_id", account_id).execute()
            conversation_id = None
            bot_mode = "AI_AGENT"

            if conv_res.data and len(conv_res.data) > 0:
                conversation_id = conv_res.data[0]["id"]
                bot_mode = conv_res.data[0].get("bot_mode", "AI_AGENT")
                supabase.table("patient_conversations").update({
                    "window_expires_at": window_limit.isoformat(),
                    "session_status": "OPEN",
                    "last_inbound_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", conversation_id).execute()
            else:
                new_conv = supabase.table("patient_conversations").insert({
                    "paciente_id": paciente_id,
                    "account_id": account_id,
                    "wa_chat_id": normalized_phone,
                    "window_expires_at": window_limit.isoformat(),
                    "session_status": "OPEN",
                    "bot_mode": "AI_AGENT",
                    "last_inbound_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                if new_conv.data:
                    conversation_id = new_conv.data[0]["id"]

            # 4. Registrar en whatsapp_messages (auditoría oficial de Meta de forma protegida)
            try:
                if conversation_id:
                    supabase.table("whatsapp_messages").insert({
                        "conversation_id": conversation_id,
                        "account_id": account_id,
                        "wamid": wamid,
                        "direction": "inbound",
                        "message_type": msg_type,
                        "content_text": text_content,
                        "payload_raw": msg_dict,
                        "status": "delivered"
                    }).execute()
            except Exception as wm_err:
                logger.warning(f"[Worker Audit] Advertencia guardando auditoría en whatsapp_messages: {wm_err}")

            # 4.1 Sincronizar en el Chat del CRM (public.conversaciones y public.mensajes)
            try:
                conv_crm_res = supabase.table("conversaciones").select("id, bot_disabled, metadata_json, unread_count").eq("paciente_id", paciente_id).execute()
                crm_conv_id = None
                bot_disabled = False

                if conv_crm_res.data and len(conv_crm_res.data) > 0:
                    crm_conv_id = conv_crm_res.data[0]["id"]
                    bot_disabled = conv_crm_res.data[0].get("bot_disabled", False)
                    c_meta = conv_crm_res.data[0].get("metadata_json") or {}
                    current_unread = int(conv_crm_res.data[0].get("unread_count") or 0)
                    ultimo_humano = c_meta.get("ultimo_mensaje_humano_at", 0)
                    # Período de gracia de 15 minutos (900s) si el operador humano estuvo respondiendo
                    import time
                    if time.time() - float(ultimo_humano or 0) < 900:
                        bot_disabled = True
                        logger.info(f"[Bot Handoff] Operador intervino recientemente. Bot pausado para conv {crm_conv_id}.")

                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": text_content,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "unread_count": current_unread + 1
                    }).eq("id", crm_conv_id).execute()
                else:
                    new_crm_conv = supabase.table("conversaciones").insert({
                        "paciente_id": paciente_id,
                        "bot_disabled": False,
                        "ultimo_mensaje": text_content,
                        "unread_count": 1
                    }).execute()
                    if new_crm_conv.data:
                        crm_conv_id = new_crm_conv.data[0]["id"]

                # Guardar mensaje del paciente en public.mensajes (con whatsapp_message_id poblado)
                if crm_conv_id:
                    supabase.table("mensajes").insert({
                        "conversacion_id": crm_conv_id,
                        "emisor": "paciente",
                        "contenido": text_content,
                        "metadata_json": media_meta,
                        "whatsapp_message_id": wamid
                    }).execute()
                    logger.info(f"[Worker Inbound] Mensaje {wamid} ({msg_type}) sincronizado en public.mensajes para chat del CRM.")

                # 4.2 Intercepción de Botones Interactivos Automatizados (Presupuesto PDF y Confirmación de Turnos)
                interactive_handled = False
                if msg_type == "interactive" or interactive_id:
                    interactive_handled = await handle_automated_interactive_action(
                        button_id=interactive_id,
                        text_content=text_content,
                        paciente_id=paciente_id,
                        normalized_phone=normalized_phone,
                        crm_conv_id=crm_conv_id,
                        account_id=account_id
                    )

                # 4.3 Despachar el Agente IA (Gemini) si no fue una acción interactiva determinística y el bot no está deshabilitado
                if not interactive_handled and not bot_disabled and text_content and msg_type in ("text", "interactive", "audio"):
                    import asyncio
                    from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials, WhatsAppCloudClient

                    async def responder_con_agente():
                        try:
                            from app.agent import procesar_mensaje_agente
                            logger.info(f"[Agente IA] Ejecutando Gemini para paciente {paciente_id}...")
                            respuesta_bot = procesar_mensaje_agente(
                                conversacion_id=crm_conv_id,
                                mensaje_texto_o_paciente_id=paciente_id,
                                mensaje_texto=text_content,
                                guardar_en_db=False
                            )
                            if respuesta_bot:
                                phone_id, token = get_whatsapp_cloud_credentials()
                                if phone_id and token:
                                    wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
                                    send_res = await wa_client.send_free_text(normalized_phone, respuesta_bot)
                                    bot_wamid = send_res.get("wamid")
                                    await wa_client.close()

                                    # Guardar respuesta del bot en public.mensajes del CRM
                                    if crm_conv_id:
                                        supabase.table("mensajes").insert({
                                            "conversacion_id": crm_conv_id,
                                            "emisor": "bot",
                                            "contenido": respuesta_bot,
                                            "metadata_json": {
                                                "wamid": bot_wamid,
                                                "tipo": "text",
                                                "delivery_status": "enviado",
                                                "provider": "meta_cloud_api"
                                            }
                                        }).execute()

                                        supabase.table("conversaciones").update({
                                            "ultimo_mensaje": respuesta_bot,
                                            "updated_at": datetime.now(timezone.utc).isoformat()
                                        }).eq("id", crm_conv_id).execute()

                                    logger.info(f"[Agente IA] Respuesta enviada por Meta Cloud API y registrada en CRM.")
                        except Exception as err_bot:
                            logger.error(f"[Agente IA Error] Error respondiendo con bot: {err_bot}", exc_info=True)

                    asyncio.create_task(responder_con_agente())

            except Exception as err_sync:
                logger.error(f"[Worker Sync Error] Error sincronizando con chat del CRM: {err_sync}", exc_info=True)

        logger.info(f"[Worker Inbound] Mensaje de {normalized_phone} procesado exitosamente.")

    except Exception as e:
        logger.error(f"[Worker Inbound] Error procesando mensaje de {normalized_phone}: {e}", exc_info=True)


async def handle_automated_interactive_action(
    button_id: Optional[str],
    text_content: str,
    paciente_id: Optional[str],
    normalized_phone: str,
    crm_conv_id: Optional[str],
    account_id: Optional[str]
) -> bool:
    """
    Ruteo determinístico para clics en botones interactivos de plantillas y mensajes:
      - Opción 2: Presupuesto en PDF directo en el chat de WhatsApp.
      - Confirmación / Reprogramación de turnos quirúrgicos.
    Retorna True si la acción fue resuelta determinísticamente, False para delegar al agente IA.
    """
    btn_id = (button_id or "").lower().strip()
    title_str = (text_content or "").lower().strip()
    logger.info(f"[Interactive Auto] Evaluando botón: id='{btn_id}', texto='{title_str}' para paciente={paciente_id}")

    from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials, WhatsAppCloudClient

    # =========================================================================
    # CASO 1: SOLICITUD / RECEPCIÓN DE PRESUPUESTO EN PDF DIRECTO EN WHATSAPP
    # =========================================================================
    is_presupuesto = any(k in title_str or k in btn_id for k in [
        "presupuesto", "pdf", "cotizacion", "cotización", "recibir presupuesto", 
        "ver presupuesto", "descargar presupuesto"
    ]) or btn_id.startswith("presupuesto_")

    if is_presupuesto:
        logger.info(f"[Interactive Auto] Intención de Presupuesto PDF para {normalized_phone}")
        paciente_nombre = "Paciente"
        if paciente_id:
            try:
                p_resp = supabase.table("pacientes").select("nombre").eq("id", paciente_id).execute()
                if p_resp.data and p_resp.data[0].get("nombre"):
                    paciente_nombre = p_resp.data[0]["nombre"]
            except Exception as pe:
                logger.warning(f"[Interactive Presupuesto] Error leyendo paciente: {pe}")

        presupuesto = None
        if paciente_id:
            try:
                pres_resp = supabase.table("presupuestos") \
                    .select("id, total, total_ars, total_usd, pdf_url, created_at") \
                    .eq("paciente_id", paciente_id) \
                    .order("created_at", desc=True) \
                    .limit(1) \
                    .execute()
                if pres_resp.data and len(pres_resp.data) > 0:
                    presupuesto = pres_resp.data[0]
            except Exception as pre:
                logger.error(f"[Interactive Presupuesto] Error consultando presupuestos: {pre}")

        phone_id, token = get_whatsapp_cloud_credentials()
        if not phone_id or not token:
            logger.error("[Interactive Presupuesto] Credenciales Meta WABA no configuradas.")
            return True

        wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
        try:
            if presupuesto:
                pres_id = presupuesto["id"]
                base_backend_url = os.getenv("BACKEND_PUBLIC_URL", "https://crmagenticonube-production.up.railway.app").rstrip("/")
                pdf_full_url = f"{base_backend_url}/static/presupuesto_{pres_id}.pdf"
                safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', paciente_nombre).strip('_')
                filename = f"Presupuesto_{safe_name}.pdf"
                caption = f"📄 Estimado/a {paciente_nombre}, le adjuntamos su presupuesto oficial en formato PDF. Si desea coordinar la fecha de cirugía o financiarlo, puede respondernos por este medio."

                doc_res = await wa_client.send_document(
                    to_phone=normalized_phone,
                    document_url=pdf_full_url,
                    filename=filename,
                    caption=caption
                )
                doc_wamid = doc_res.get("wamid")

                # Auditoría en whatsapp_messages
                await record_outbound_audit_message(
                    to_phone=normalized_phone,
                    wamid=doc_wamid,
                    message_type="document",
                    content_text=f"[DOCUMENTO PDF: {filename}]",
                    payload={"document_url": pdf_full_url, "presupuesto_id": pres_id},
                    billing_category="service"
                )

                # Reflejar en la conversación activa de MedCRM
                if crm_conv_id:
                    supabase.table("mensajes").insert({
                        "conversacion_id": crm_conv_id,
                        "emisor": "bot",
                        "contenido": f"📄 Presupuesto PDF enviado: {filename}",
                        "metadata_json": {
                            "wamid": doc_wamid,
                            "tipo": "documento",
                            "media_url": pdf_full_url,
                            "file_name": filename,
                            "caption": caption,
                            "delivery_status": "enviado",
                            "provider": "meta_cloud_api"
                        }
                    }).execute()
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": f"📄 [Documento PDF] {filename}",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", crm_conv_id).execute()

                logger.info(f"[Interactive Presupuesto] Documento {filename} entregado exitosamente a {normalized_phone}")
            else:
                sin_pres_txt = f"Estimado/a {paciente_nombre}, aún no figura un presupuesto emitido en su ficha médica. Un asesor quirúrgico se comunicará para brindarle la cotización correspondiente."
                txt_res = await wa_client.send_free_text(normalized_phone, sin_pres_txt)
                txt_wamid = txt_res.get("wamid")

                if crm_conv_id:
                    supabase.table("mensajes").insert({
                        "conversacion_id": crm_conv_id,
                        "emisor": "bot",
                        "contenido": sin_pres_txt,
                        "metadata_json": {
                            "wamid": txt_wamid,
                            "tipo": "text",
                            "delivery_status": "enviado",
                            "provider": "meta_cloud_api"
                        }
                    }).execute()
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": sin_pres_txt,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", crm_conv_id).execute()
        finally:
            await wa_client.close()

        return True

    # =========================================================================
    # CASO 2: CONFIRMACIÓN DE TURNO QUIRÚRGICO / CONSULTA
    # =========================================================================
    is_confirm = any(k in title_str or k in btn_id for k in [
        "confirmar", "confirmar turno", "confirmar asistencia", "si, confirmo", "asistiré", "asistire"
    ]) or btn_id.startswith("confirmar_turno")

    if is_confirm:
        logger.info(f"[Interactive Auto] Confirmación de turno para paciente {paciente_id} ({normalized_phone})")
        turno_id = None
        if btn_id.startswith("confirmar_turno_"):
            turno_id = button_id.replace("CONFIRMAR_TURNO_", "").replace("confirmar_turno_", "")

        turno_data = None
        if paciente_id:
            try:
                today_str = datetime.now(timezone.utc).date().isoformat()
                t_query = supabase.table("turnos_quirofano").select("id, fecha, hora_inicio, estado, quirofanos(nombre)")
                if turno_id:
                    t_query = t_query.eq("id", turno_id)
                else:
                    t_query = t_query.eq("paciente_id", paciente_id).gte("fecha", today_str).order("fecha", desc=False).limit(1)
                t_res = t_query.execute()
                if t_res.data and len(t_res.data) > 0:
                    turno_data = t_res.data[0]
                    target_tid = turno_data["id"]
                    supabase.table("turnos_quirofano").update({
                        "estado": "confirmado",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", target_tid).execute()
                    logger.info(f"[Turnos] Turno quirúrgico {target_tid} confirmado en Supabase.")
            except Exception as te:
                logger.error(f"[Interactive Turnos] Error confirmando turno: {te}")

        if turno_data:
            f_val = turno_data.get("fecha") or ""
            h_val = str(turno_data.get("hora_inicio") or "")[:5]
            hora_str = f" a las {h_val} hs" if h_val else ""
            reply_text = f"✅ ¡Excelente! Su turno programado para el día {f_val}{hora_str} ha sido confirmado con éxito. Lo esperamos puntualmente en el centro médico."
        else:
            reply_text = "✅ ¡Muchas gracias! Su asistencia ha sido confirmada correctamente en nuestro sistema. ¡Lo esperamos!"

        phone_id, token = get_whatsapp_cloud_credentials()
        if phone_id and token:
            wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
            try:
                txt_res = await wa_client.send_free_text(normalized_phone, reply_text)
                txt_wamid = txt_res.get("wamid")

                await record_outbound_audit_message(
                    to_phone=normalized_phone,
                    wamid=txt_wamid,
                    message_type="text",
                    content_text=reply_text,
                    payload={"intent": "confirmar_turno", "turno_id": turno_data.get("id") if turno_data else None},
                    billing_category="service"
                )

                if crm_conv_id:
                    supabase.table("mensajes").insert({
                        "conversacion_id": crm_conv_id,
                        "emisor": "bot",
                        "contenido": reply_text,
                        "metadata_json": {
                            "wamid": txt_wamid,
                            "tipo": "text",
                            "delivery_status": "enviado",
                            "provider": "meta_cloud_api"
                        }
                    }).execute()
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": reply_text,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", crm_conv_id).execute()
            finally:
                await wa_client.close()

        return True

    # =========================================================================
    # CASO 3: REPROGRAMACIÓN O CANCELACIÓN DE TURNO
    # =========================================================================
    is_reschedule = any(k in title_str or k in btn_id for k in [
        "reprogramar", "cancelar", "cambiar fecha", "no puedo"
    ]) or btn_id.startswith("cancelar_turno")

    if is_reschedule:
        logger.info(f"[Interactive Auto] Reprogramación de turno para paciente {paciente_id} ({normalized_phone})")
        if paciente_id:
            try:
                today_str = datetime.now(timezone.utc).date().isoformat()
                supabase.table("turnos_quirofano").update({
                    "estado": "reprogramar",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("paciente_id", paciente_id).gte("fecha", today_str).execute()
            except Exception as re_err:
                logger.warning(f"[Interactive Turnos] Advertencia actualizando a reprogramar: {re_err}")

        reply_text = "📅 Hemos registrado su solicitud para reprogramar su turno. Nuestro equipo de coordinación se comunicará a la brevedad para ofrecerle alternativas de agenda."

        phone_id, token = get_whatsapp_cloud_credentials()
        if phone_id and token:
            wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
            try:
                txt_res = await wa_client.send_free_text(normalized_phone, reply_text)
                txt_wamid = txt_res.get("wamid")

                await record_outbound_audit_message(
                    to_phone=normalized_phone,
                    wamid=txt_wamid,
                    message_type="text",
                    content_text=reply_text,
                    payload={"intent": "reprogramar_turno"},
                    billing_category="service"
                )

                if crm_conv_id:
                    supabase.table("mensajes").insert({
                        "conversacion_id": crm_conv_id,
                        "emisor": "bot",
                        "contenido": reply_text,
                        "metadata_json": {
                            "wamid": txt_wamid,
                            "tipo": "text",
                            "delivery_status": "enviado",
                            "provider": "meta_cloud_api"
                        }
                    }).execute()
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": reply_text,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", crm_conv_id).execute()
            finally:
                await wa_client.close()

        return True

    return False


async def handle_turnos_interactive_reply(button_id: str, paciente_id: Optional[str], phone: str):
    """Alias de compatibilidad previa."""
    return await handle_automated_interactive_action(
        button_id=button_id,
        text_content="",
        paciente_id=paciente_id,
        normalized_phone=phone,
        crm_conv_id=None,
        account_id=None
    )


async def record_outbound_audit_message(
    to_phone: str,
    wamid: str,
    message_type: str,
    content_text: str,
    payload: Optional[Dict[str, Any]] = None,
    billing_category: Optional[str] = "utility"
):
    """
    Registra en la base de datos de Supabase un mensaje saliente para auditoría clínica.
    Actualiza la sesión en patient_conversations y crea el registro en whatsapp_messages.
    """
    try:
        normalized_phone = normalize_to_meta_e164(to_phone)
        
        # 1. Obtener o crear paciente
        paciente_res = supabase.table("pacientes").select("id").eq("telefono", normalized_phone).execute()
        paciente_id = None
        if paciente_res.data and len(paciente_res.data) > 0:
            paciente_id = paciente_res.data[0]["id"]
        else:
            new_pac = supabase.table("pacientes").insert({
                "telefono": normalized_phone,
                "nombre": f"Paciente {normalized_phone[-4:]}"
            }).execute()
            if new_pac.data:
                paciente_id = new_pac.data[0]["id"]

        # 2. Obtener cuenta de WhatsApp activa
        acc_res = supabase.table("whatsapp_accounts").select("id").eq("is_active", True).limit(1).execute()
        account_id = acc_res.data[0]["id"] if (acc_res.data and len(acc_res.data) > 0) else None

        if paciente_id and account_id:
            # 3. Conversación
            conv_res = supabase.table("patient_conversations").select("id").eq("paciente_id", paciente_id).eq("account_id", account_id).execute()
            conversation_id = None
            now_iso = datetime.now(timezone.utc).isoformat()

            if conv_res.data and len(conv_res.data) > 0:
                conversation_id = conv_res.data[0]["id"]
                supabase.table("patient_conversations").update({
                    "last_outbound_at": now_iso
                }).eq("id", conversation_id).execute()
            else:
                new_conv = supabase.table("patient_conversations").insert({
                    "paciente_id": paciente_id,
                    "account_id": account_id,
                    "wa_chat_id": normalized_phone,
                    "session_status": "OPEN",
                    "bot_mode": "AI_AGENT",
                    "last_outbound_at": now_iso
                }).execute()
                if new_conv.data:
                    conversation_id = new_conv.data[0]["id"]

            # 4. Registrar mensaje saliente
            if conversation_id:
                supabase.table("whatsapp_messages").insert({
                    "conversation_id": conversation_id,
                    "account_id": account_id,
                    "wamid": wamid,
                    "direction": "outbound",
                    "message_type": message_type,
                    "content_text": content_text,
                    "payload_raw": payload or {},
                    "status": "sent",
                    "sent_at": now_iso,
                    "billing_category": billing_category
                }).execute()
                logger.info(f"[Outbound Audit] Mensaje {wamid} registrado en whatsapp_messages.")

    except Exception as e:
        logger.error(f"[Outbound Audit Error] Error guardando auditoría de mensaje saliente: {e}", exc_info=True)

