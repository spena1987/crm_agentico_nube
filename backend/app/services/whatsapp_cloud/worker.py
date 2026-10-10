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
                try:
                    await handle_inbound_message(msg, phone_number_id, contact_name)
                except Exception as in_err:
                    logger.error(f"[Worker] Error procesando mensaje wamid={wamid}: {in_err}", exc_info=True)
                    try:
                        from app.services.logger_service import log_event
                        log_event(
                            nivel="ERROR",
                            modulo="WHATSAPP",
                            accion="ERROR_PROCESAR_INBOUND",
                            mensaje=f"Error al procesar mensaje entrante wamid={wamid}: {in_err}",
                            detalles={"wamid": wamid, "error": str(in_err), "msg_type": msg.get("type")}
                        )
                    except Exception:
                        pass


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
    elif msg_type == "button":
        button_info = msg_dict.get("button", {})
        interactive_id = button_info.get("payload") or button_info.get("text", "")
        btn_text = button_info.get("text") or button_info.get("payload") or "Botón presionado"
        text_content = f"🔘 {btn_text}"
        media_meta["tipo"] = "button"
        media_meta["button_text"] = btn_text
        media_meta["button_payload"] = button_info.get("payload")
    elif msg_type == "audio":
        audio_info = msg_dict.get("audio", {})
        media_id = audio_info.get("id")
        text_content = "🎤 Nota de voz"
        if media_id:
            try:
                from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials, WhatsAppCloudClient, MediaPayloadTooLargeError
                from app.services.media_service import MediaService
                from app.agent import transcribir_audio_con_gemini
                p_id, tkn = get_whatsapp_cloud_credentials()
                if p_id and tkn:
                    wa_client = WhatsAppCloudClient(phone_number_id=p_id, access_token=tkn)
                    audio_bytes, mime_type = await wa_client.download_media_bytes(media_id)
                    await wa_client.close()

                    # Persistencia dual resiliente (disco local /static/media + Supabase Storage)
                    try:
                        saved = MediaService.save_media_bytes(
                            data=audio_bytes,
                            subfolder="audio",
                            mime_type=mime_type or "audio/ogg",
                            original_filename=f"{media_id}.ogg",
                            prefix="wa_voice"
                        )
                        media_url = (saved.get("media_url") or "").rstrip("?")
                        media_meta["media_url"] = media_url
                        media_meta["relative_url"] = saved.get("relative_url")
                        media_meta["file_name"] = saved.get("file_name") or f"{media_id}.ogg"
                        media_meta["file_size_bytes"] = len(audio_bytes)
                        media_meta["mime_type"] = mime_type
                    except Exception as st_err:
                        logger.warning(f"[Worker Audio] MediaService error al guardar audio: {st_err}")

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
            except MediaPayloadTooLargeError as sz_err:
                logger.warning(f"[Worker Audio] Nota de voz {media_id} excede 20MB: {sz_err}")
                text_content = "🎤 [Nota de voz excede límite de 20MB]"
                media_meta["is_oversized"] = True
                media_meta["download_error"] = f"Audio excede límite seguro de 20MB ({sz_err.file_size} bytes)"
                try:
                    from app.services.logger_service import log_event
                    log_event(
                        nivel="WARNING",
                        modulo="WHATSAPP",
                        accion="MEDIA_EXCEDE_LIMITE_20MB",
                        mensaje=f"Audio {media_id} excede límite de 20MB",
                        detalles={"media_id": media_id, "size": sz_err.file_size, "limit": sz_err.max_size, "sender": normalized_phone}
                    )
                except Exception:
                    pass
            except Exception as dwn_err:
                logger.error(f"[Worker Audio] Error descargando audio de Meta: {dwn_err}")

    elif msg_type in ("image", "document", "sticker", "video"):
        media = msg_dict.get(msg_type, {})
        media_id = media.get("id")
        caption = media.get("caption") or ""
        doc_name = media.get("filename") or ""

        # Mapeo de etiqueta de texto y tipo normalizado para la interfaz del CRM
        if msg_type == "image":
            tipo_normalizado = "imagen"
            text_content = caption or "📷 [Foto]"
            subfolder = "images"
        elif msg_type == "sticker":
            tipo_normalizado = "sticker"
            text_content = "✨ [Sticker]"
            subfolder = "stickers"
        elif msg_type == "video":
            tipo_normalizado = "video"
            text_content = caption or "🎥 [Video]"
            subfolder = "videos"
        elif msg_type == "document":
            tipo_normalizado = "documento"
            doc_name = doc_name or "Documento"
            text_content = caption or f"📄 [{doc_name}]"
            subfolder = "documents"
        else:
            tipo_normalizado = msg_type
            text_content = caption or f"[{msg_type.upper()}]"
            subfolder = "media"

        media_meta["tipo"] = tipo_normalizado
        if doc_name:
            media_meta["file_name"] = doc_name

        if media_id:
            try:
                from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials, WhatsAppCloudClient, MediaPayloadTooLargeError
                from app.services.media_service import MediaService
                p_id, tkn = get_whatsapp_cloud_credentials()
                if p_id and tkn:
                    wa_client = WhatsAppCloudClient(phone_number_id=p_id, access_token=tkn)
                    media_bytes, mime_type = await wa_client.download_media_bytes(media_id)
                    await wa_client.close()

                    # Guardar con persistencia dual resiliente (disco local /static/media + Supabase Storage)
                    try:
                        saved = MediaService.save_media_bytes(
                            data=media_bytes,
                            subfolder=subfolder,
                            mime_type=mime_type or "application/octet-stream",
                            original_filename=doc_name or (f"{media_id}.jpg" if msg_type == "image" else None),
                            prefix=f"wa_{msg_type}"
                        )
                        media_url = (saved.get("media_url") or "").rstrip("?")
                        media_meta["media_url"] = media_url
                        media_meta["relative_url"] = saved.get("relative_url")
                        media_meta["file_name"] = saved.get("file_name") or doc_name
                        media_meta["file_size_bytes"] = len(media_bytes)
                        media_meta["mime_type"] = mime_type
                    except Exception as st_err:
                        logger.warning(f"[Worker Media] MediaService error al guardar {msg_type}: {st_err}")

                media_meta["media_url"] = media_url
                media_meta["caption"] = caption
                if msg_type == "video" and ("gif" in str(media.get("mime_type", "")).lower() or "gif" in str(caption).lower()):
                    media_meta["is_gif"] = True
            except MediaPayloadTooLargeError as sz_err:
                logger.warning(f"[Worker Media] Archivo {media_id} ({msg_type}) excede 20MB: {sz_err}")
                doc_name = media.get("filename") or ("Documento" if msg_type == "document" else msg_type.capitalize())
                text_content = f"📄 [{doc_name} - Excede límite seguro de 20MB]"
                media_meta["is_oversized"] = True
                media_meta["download_error"] = f"Archivo excede límite seguro de 20MB ({sz_err.file_size} bytes)"
                try:
                    from app.services.logger_service import log_event
                    log_event(
                        nivel="WARNING",
                        modulo="WHATSAPP",
                        accion="MEDIA_EXCEDE_LIMITE_20MB",
                        mensaje=f"Archivo {media_id} ({msg_type}) excede límite de 20MB",
                        detalles={"media_id": media_id, "tipo": msg_type, "size": sz_err.file_size, "limit": sz_err.max_size, "sender": normalized_phone}
                    )
                except Exception:
                    pass
            except Exception as dwn_err:
                logger.error(f"[Worker Media] Error descargando {msg_type} de Meta: {dwn_err}")
                media_meta["download_error"] = str(dwn_err)

    elif msg_type == "location":
        loc = msg_dict.get("location", {})
        lat = loc.get("latitude")
        lng = loc.get("longitude")
        loc_name = loc.get("name") or "Ubicación compartida"
        address = loc.get("address") or ""
        text_content = f"📍 Ubicación: {loc_name}" + (f" ({address})" if address else "")
        media_meta["tipo"] = "ubicacion"
        media_meta["latitud"] = lat
        media_meta["longitud"] = lng
        media_meta["nombre"] = loc_name
        media_meta["direccion"] = address
        media_meta["maps_url"] = f"https://www.google.com/maps?q={lat},{lng}"

    elif msg_type == "contacts":
        contacts_list = msg_dict.get("contacts", [])
        primer_contacto = contacts_list[0] if contacts_list else {}
        c_name = primer_contacto.get("name", {}).get("formatted_name") or primer_contacto.get("name", {}).get("first_name") or "Contacto"
        phones = primer_contacto.get("phones", [])
        c_phone = phones[0].get("phone") if phones else ""
        text_content = f"👤 Contacto: {c_name}" + (f" - Tel: {c_phone}" if c_phone else "")
        media_meta["tipo"] = "contacto"
        media_meta["contact_name"] = c_name
        media_meta["contact_phone"] = c_phone
        media_meta["contacts"] = contacts_list

    elif msg_type == "reaction":
        react_info = msg_dict.get("reaction", {})
        target_wamid = react_info.get("message_id")
        emoji = react_info.get("emoji")
        # Vincular reacción al mensaje padre original si existe
        if target_wamid:
            try:
                parent_msg = supabase.table("mensajes").select("id, metadata_json").eq("whatsapp_message_id", target_wamid).limit(1).execute()
                if parent_msg.data and len(parent_msg.data) > 0:
                    p_id = parent_msg.data[0]["id"]
                    p_meta = parent_msg.data[0].get("metadata_json") or {}
                    reactions = p_meta.get("reactions") or []
                    if emoji:
                        # Reemplazar reacción previa del paciente o agregar nueva
                        reactions = [r for r in reactions if r.get("emisor") != "paciente"]
                        reactions.append({
                            "emisor": "paciente",
                            "emoji": emoji,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    else:
                        reactions = [r for r in reactions if r.get("emisor") != "paciente"]
                    p_meta["reactions"] = reactions
                    supabase.table("mensajes").update({"metadata_json": p_meta}).eq("id", p_id).execute()
                    logger.info(f"[Worker Reaction] Reacción '{emoji}' vinculada al mensaje {target_wamid}")
                    # Al vincular exitosamente la reacción, finalizamos para no generar un mensaje basura nuevo en el chat
                    return {"status": "reaction_linked", "target_wamid": target_wamid}
            except Exception as r_err:
                logger.warning(f"[Worker Reaction] Error vinculando reacción: {r_err}")

        text_content = f"Reacción: {emoji}" if emoji else "Reacción removida"
        media_meta["tipo"] = "reaction"
        media_meta["emoji"] = emoji
        media_meta["target_wamid"] = target_wamid
    else:
        text_content = f"[{msg_type.upper()}] Mensaje recibido"

    # 1. Obtener o crear paciente (con búsqueda exacta y fallback por últimos 8 dígitos)
    try:
        paciente_res = supabase.table("pacientes").select("id, nombre").eq("telefono", normalized_phone).execute()
        paciente_id = None
        if paciente_res.data and len(paciente_res.data) > 0:
            paciente_id = paciente_res.data[0]["id"]
        else:
            clean_digits = "".join(filter(str.isdigit, normalized_phone))
            if len(clean_digits) >= 8:
                pac_fb = supabase.table("pacientes").select("id, nombre").ilike("telefono", f"%{clean_digits[-8:]}%").limit(1).execute()
                if pac_fb.data and len(pac_fb.data) > 0:
                    paciente_id = pac_fb.data[0]["id"]

        if not paciente_id:
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
        conversation_id = None
        if paciente_id and account_id:
            try:
                conv_res = supabase.table("patient_conversations").select("id, bot_mode").eq("paciente_id", paciente_id).eq("account_id", account_id).execute()
                if conv_res.data and len(conv_res.data) > 0:
                    conversation_id = conv_res.data[0]["id"]
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
            except Exception as pc_err:
                logger.warning(f"[Worker PatientConv] Advertencia en patient_conversations: {pc_err}")

        # 4. Registrar en whatsapp_messages (auditoría oficial de Meta de forma protegida)
        try:
            if conversation_id and account_id:
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

        # 4.1 Sincronizar en el Chat del CRM (public.conversaciones y public.mensajes) - INDEPENDIENTE DE account_id
        if paciente_id:
            try:
                conv_crm_res = supabase.table("conversaciones").select("id, bot_disabled, metadata_json, unread_count, estado_gestion, asignado_a_usuario_id, archivada").eq("paciente_id", paciente_id).execute()
                crm_conv_id = None
                bot_disabled = False

                if conv_crm_res.data and len(conv_crm_res.data) > 0:
                    crm_conv_id = conv_crm_res.data[0]["id"]
                    bot_disabled = bool(conv_crm_res.data[0].get("bot_disabled", False))
                    c_meta = conv_crm_res.data[0].get("metadata_json") or {}
                    current_unread = int(conv_crm_res.data[0].get("unread_count") or 0)
                    conv_estado = conv_crm_res.data[0].get("estado_gestion") or "SIN_ASIGNAR"
                    conv_asignado = conv_crm_res.data[0].get("asignado_a_usuario_id")
                    conv_archivada = bool(conv_crm_res.data[0].get("archivada", False))
                    ultimo_humano = c_meta.get("ultimo_mensaje_humano_at", 0)
                    
                    # Período de gracia de 15 minutos (900s) solo si el operador humano estuvo respondiendo,
                    # la conversación no ha sido resuelta y sigue asignada activamente a un operador humano.
                    import time
                    if not bot_disabled and conv_estado != "RESUELTO" and conv_asignado:
                        if time.time() - float(ultimo_humano or 0) < 900:
                            bot_disabled = True
                            logger.info(f"[Bot Handoff] Operador intervino recientemente ({time.time() - float(ultimo_humano):.0f}s atrás). Bot pausado para conv {crm_conv_id}.")

                    inbound_now = datetime.now(timezone.utc).isoformat()
                    upd_payload = {
                        "ultimo_mensaje": text_content,
                        "ultimo_mensaje_at": inbound_now,
                        "updated_at": inbound_now,
                        "unread_count": current_unread + 1
                    }

                    # Verificación de Auto-Reactivación por Inactividad Humana
                    # Si el bot estaba pausado pero ha transcurrido el tiempo límite de inactividad
                    # configurado en Ajustes (ej. 24h), reactivar el Asistente IA automáticamente.
                    try:
                        from app.services.config_service import load_settings
                        settings = load_settings()
                        handover_cfg = settings.get("bot", {}).get("handover", {})
                        auto_reactivar = handover_cfg.get("auto_reactivacion_inactividad", True)
                        horas_limite = float(handover_cfg.get("tiempo_inactividad_horas", 24))
                        segundos_limite = max(horas_limite * 3600.0, 60.0)

                        ahora = time.time()
                        tiempo_referencia = float(ultimo_humano or 0)
                        if tiempo_referencia == 0 and conv_crm_res.data[0].get("updated_at"):
                            try:
                                dt_upd = datetime.fromisoformat(str(conv_crm_res.data[0]["updated_at"]).replace("Z", "+00:00"))
                                tiempo_referencia = dt_upd.timestamp()
                            except Exception:
                                tiempo_referencia = 0

                        if bot_disabled and auto_reactivar and tiempo_referencia > 0 and (ahora - tiempo_referencia >= segundos_limite):
                            bot_disabled = False
                            c_meta["ultimo_mensaje_humano_at"] = 0
                            c_meta["fallback_strikes"] = 0
                            c_meta["auto_reactivado_at"] = datetime.now(timezone.utc).isoformat()
                            upd_payload["bot_disabled"] = False
                            upd_payload["metadata_json"] = c_meta
                            logger.info(f"[Auto-Reactivación Inactividad] Bot reactivado automáticamente para conv {crm_conv_id} tras {(ahora - tiempo_referencia)/3600:.1f}h de inactividad humana.")
                            try:
                                supabase.table("mensajes").insert({
                                    "conversacion_id": crm_conv_id,
                                    "emisor": "bot",
                                    "contenido": f"🤖 Asistente Virtual Gemini reactivado automáticamente tras superar {horas_limite:g}h sin intervención humana. Atendiendo nueva consulta.",
                                    "metadata_json": {
                                        "es_nota_interna": True,
                                        "sistema": True,
                                        "evento": "auto_reactivacion_inactividad"
                                    }
                                }).execute()
                            except Exception as n_err:
                                logger.warning(f"Error registrando nota de auto-reactivación: {n_err}")
                    except Exception as ar_err:
                        logger.warning(f"Error en chequeo de auto-reactivación por inactividad: {ar_err}")

                    # Si el bot seguía deshabilitado y entra un mensaje en caso cerrado/archivado,
                    # reabrir automáticamente hacia la pestaña 'Espera' (SIN_ASIGNAR)
                    if bot_disabled and (conv_estado == "RESUELTO" or conv_archivada):
                        upd_payload["archivada"] = False
                        upd_payload["estado_gestion"] = "SIN_ASIGNAR"
                        logger.info(f"[Inbound Reopen] Chat {crm_conv_id} reabierto a 'SIN_ASIGNAR' al recibir mensaje con bot apagado.")

                    supabase.table("conversaciones").update(upd_payload).eq("id", crm_conv_id).execute()
                else:
                    inbound_now = datetime.now(timezone.utc).isoformat()
                    new_crm_conv = supabase.table("conversaciones").insert({
                        "paciente_id": paciente_id,
                        "bot_disabled": False,
                        "ultimo_mensaje": text_content,
                        "ultimo_mensaje_at": inbound_now,
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

                    try:
                        from app.services.logger_service import log_event
                        log_event(
                            nivel="INFO",
                            modulo="WHATSAPP",
                            accion="MENSAJE_ENTRANTE_GUARDADO",
                            mensaje=f"Mensaje entrante ({msg_type}) de {normalized_phone} registrado en CRM",
                            detalles={
                                "wamid": wamid,
                                "paciente_id": paciente_id,
                                "crm_conv_id": crm_conv_id,
                                "tipo": msg_type,
                                "texto": (text_content or "")[:100]
                            },
                            paciente_id=paciente_id
                        )
                    except Exception:
                        pass

                # 4.2 Intercepción de Acciones Determinísticas (Botones Interactivos y Respuestas de Texto a Presupuestos / Turnos)
                interactive_handled = False
                if msg_type in ("interactive", "button", "text") or interactive_id:
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

                    def check_human_handover_match(text: str, keywords: list) -> Optional[str]:
                        if not text or not keywords:
                            return None
                        import unicodedata
                        def _norm(s: str) -> str:
                            s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
                            return re.sub(r'[^a-z0-9\s]', ' ', s.lower()).strip()
                        clean_text = f" {_norm(text)} "
                        for kw in keywords:
                            norm_kw = _norm(kw)
                            if not norm_kw:
                                continue
                            if f" {norm_kw} " in clean_text or clean_text.strip() == norm_kw:
                                return kw
                        return None

                    async def responder_con_agente():
                        try:
                            from app.services.config_service import load_settings
                            settings = load_settings()
                            bot_cfg = settings.get("bot", {})
                            handover_cfg = bot_cfg.get("handover", {})

                            # 0. Fast-Path Prioritario: Urgencias Postquirúrgicas y Signos de Alarma Oftalmológicos
                            from app.services.urgencias_service import contiene_signo_de_alarma, procesar_urgencia_postquirurgica
                            es_urgencia, motivo_alarma = contiene_signo_de_alarma(text_content)
                            if es_urgencia:
                                logger.warning(f"[Fast-Path Urgencia QX] Signo de alarma detectado ('{motivo_alarma}') en paciente {paciente_id}")
                                res_urg = await procesar_urgencia_postquirurgica(
                                    conversacion_id=crm_conv_id,
                                    paciente_id=paciente_id,
                                    texto_mensaje=text_content,
                                    motivo_detectado=motivo_alarma
                                )
                                msg_paciente = res_urg.get("mensaje_paciente")
                                if msg_paciente:
                                    phone_id, token = get_whatsapp_cloud_credentials()
                                    if phone_id and token:
                                        wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
                                        send_res = await wa_client.send_free_text(normalized_phone, msg_paciente)
                                        bot_wamid = send_res.get("wamid")
                                        await wa_client.close()

                                        if crm_conv_id:
                                            supabase.table("mensajes").insert({
                                                "conversacion_id": crm_conv_id,
                                                "emisor": "bot",
                                                "contenido": msg_paciente,
                                                "metadata_json": {
                                                    "wamid": bot_wamid,
                                                    "tipo": "text",
                                                    "delivery_status": "enviado",
                                                    "provider": "meta_cloud_api",
                                                    "urgencia_postquirurgica": True,
                                                    "motivo_alarma": motivo_alarma
                                                }
                                            }).execute()

                                            supabase.table("conversaciones").update({
                                                "ultimo_mensaje": msg_paciente,
                                                "updated_at": datetime.now(timezone.utc).isoformat()
                                            }).eq("id", crm_conv_id).execute()
                                return

                            # 1. Fast-Path: Detección Determinística Inmediata de Escape Humano
                            if handover_cfg.get("auto_escalamiento_activo", True):
                                kw_list = handover_cfg.get("palabras_clave_escape") or bot_cfg.get("human_escalation_keywords") or []
                                matched_kw = check_human_handover_match(text_content, kw_list)
                                if matched_kw:
                                    logger.info(f"[Fast-Path Handover] Escape directo detectado por palabra clave '{matched_kw}' para paciente {paciente_id}.")
                                    msg_derivacion = handover_cfg.get("mensaje_derivacion") or (
                                        "He transferido tu consulta con nuestro equipo de secretaría y asesoría quirúrgica. "
                                        "Un operador humano continuará contigo a la brevedad. ¡Muchas gracias por tu paciencia!"
                                    )
                                    phone_id, token = get_whatsapp_cloud_credentials()
                                    if phone_id and token:
                                        wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
                                        send_res = await wa_client.send_free_text(normalized_phone, msg_derivacion)
                                        bot_wamid = send_res.get("wamid")
                                        await wa_client.close()

                                        if crm_conv_id:
                                            supabase.table("mensajes").insert({
                                                "conversacion_id": crm_conv_id,
                                                "emisor": "bot",
                                                "contenido": msg_derivacion,
                                                "metadata_json": {
                                                    "wamid": bot_wamid,
                                                    "tipo": "text",
                                                    "delivery_status": "enviado",
                                                    "provider": "meta_cloud_api",
                                                    "fast_path_handover": True,
                                                    "keyword_matched": matched_kw
                                                }
                                            }).execute()

                                            conv_res = supabase.table("conversaciones").select("metadata_json").eq("id", crm_conv_id).limit(1).execute()
                                            curr_meta = (conv_res.data[0].get("metadata_json") or {}) if conv_res.data else {}
                                            curr_meta.update({
                                                "fallback_strikes": 0,
                                                "handover_motivo": f"Escape directo por solicitud de paciente: '{matched_kw}'",
                                                "handover_at": datetime.now(timezone.utc).isoformat()
                                            })

                                            supabase.table("conversaciones").update({
                                                "bot_disabled": True,
                                                "estado_gestion": "SIN_ASIGNAR",
                                                "ultimo_mensaje": msg_derivacion,
                                                "metadata_json": curr_meta,
                                                "updated_at": datetime.now(timezone.utc).isoformat()
                                            }).eq("id", crm_conv_id).execute()

                                    return

                            # 2. Despachar Inferencia Semántica a Gemini
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
    logger.info(f"[Interactive Auto] Evaluando acción: id='{btn_id}', texto='{title_str}' para paciente={paciente_id}")

    from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials, WhatsAppCloudClient

    # =========================================================================
    # CASO 0: ENTREGA DIFERIDA DE CONSENTIMIENTO INFORMADO (TRAS APERTURA DE VENTANA)
    # =========================================================================
    if crm_conv_id:
        try:
            last_msgs = supabase.table("mensajes")\
                .select("id, metadata_json")\
                .eq("conversacion_id", crm_conv_id)\
                .neq("emisor", "paciente")\
                .order("created_at", desc=True)\
                .limit(5)\
                .execute()
            for m_row in (last_msgs.data or []):
                m_meta = m_row.get("metadata_json") or {}
                pending_ci = m_meta.get("pending_consentimiento_delivery")
                if pending_ci and isinstance(pending_ci, dict):
                    enlace_firma = pending_ci.get("enlace_firma")
                    msg_prep = pending_ci.get("mensaje_preparado")
                    t_id = pending_ci.get("turno_id")
                    as_id = pending_ci.get("asesoria_id")

                    texto_a_enviar = msg_prep or (
                        f"Muchas gracias por comunicarse. Le compartimos el enlace oficial para leer con tranquilidad "
                        f"y firmar digitalmente su Consentimiento Informado Quirúrgico:\n{enlace_firma}\n\n"
                        f"Quedamos a su entera disposición ante cualquier duda."
                    )

                    phone_id, token_waba = get_whatsapp_cloud_credentials()
                    if phone_id and token_waba:
                        wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token_waba)
                        try:
                            res_ci = await wa_client.send_free_text(normalized_phone, texto_a_enviar)
                            ci_wamid = res_ci.get("wamid")

                            supabase.table("mensajes").insert({
                                "conversacion_id": crm_conv_id,
                                "emisor": "bot",
                                "contenido": texto_a_enviar,
                                "metadata_json": {
                                    "wamid": ci_wamid,
                                    "tipo": "text",
                                    "consentimiento_entrega_diferida": True,
                                    "enlace_firma": enlace_firma,
                                    "delivery_status": "enviado",
                                    "provider": "meta_cloud_api"
                                }
                            }).execute()

                            supabase.table("conversaciones").update({
                                "ultimo_mensaje": texto_a_enviar,
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }).eq("id", crm_conv_id).execute()

                            if t_id:
                                supabase.table("turnos_quirofano").update({
                                    "consentimiento_estado": "enviado_whatsapp",
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                }).eq("id", t_id).execute()

                            if as_id:
                                cas_res = supabase.table("asesorias_quirurgicas").select("checklist_prequirurgico").eq("id", as_id).limit(1).execute()
                                if cas_res.data:
                                    c_chk = cas_res.data[0].get("checklist_prequirurgico") or {}
                                    if not isinstance(c_chk, dict):
                                        c_chk = {}
                                    if "_consentimiento_qx" in c_chk:
                                        c_chk["_consentimiento_qx"]["estado"] = "enviado_whatsapp"
                                        c_chk["_consentimiento_qx"]["entregado_diferido_at"] = datetime.now(timezone.utc).isoformat()
                                        supabase.table("asesorias_quirurgicas").update({
                                            "checklist_prequirurgico": c_chk,
                                            "updated_at": datetime.now(timezone.utc).isoformat()
                                        }).eq("id", as_id).execute()

                            # Limpiar pending_consentimiento_delivery para no reenviar
                            m_meta.pop("pending_consentimiento_delivery", None)
                            supabase.table("mensajes").update({"metadata_json": m_meta}).eq("id", m_row["id"]).execute()

                            logger.info(f"[Interactive Consentimiento] Enlace de firma entregado con éxito a {normalized_phone} tras apertura de ventana.")
                            return True
                        finally:
                            await wa_client.close()
        except Exception as ci_err:
            logger.error(f"[Interactive Consentimiento] Error despachando consentimiento diferido: {ci_err}")

    # =========================================================================
    # CASO 1: SOLICITUD / RECEPCIÓN DE PRESUPUESTO EN PDF DIRECTO EN WHATSAPP
    # =========================================================================
    is_presupuesto = any(k in title_str or k in btn_id for k in [
        "presupuesto", "pdf", "cotizacion", "cotización", "recibir presupuesto", 
        "ver presupuesto", "descargar presupuesto"
    ]) or btn_id.startswith("presupuesto_")

    target_presupuesto_id = None

    # Si no es explícito, verificar si es respuesta afirmativa a una oferta previa de presupuesto
    if not is_presupuesto and crm_conv_id:
        import unicodedata
        clean_text = unicodedata.normalize('NFKD', title_str).encode('ASCII', 'ignore').decode('utf-8').strip()
        clean_words = re.sub(r'[^a-z0-9\s]', ' ', clean_text).split()
        
        # Evaluar patrones afirmativos: "si", "sí", "por favor", "dale", "enviámelo", "mandamelo", "ok", "bueno", "quiero", etc.
        es_afirmativo = False
        if clean_words:
            first_word = clean_words[0]
            if first_word in ("si", "sii", "siii", "dale", "bueno", "ok", "claro", "perfecto", "mandamelo", "mandamela", "mandame", "enviamelo", "enviame", "quiero"):
                es_afirmativo = True
            elif "por" in clean_words and "favor" in clean_words:
                es_afirmativo = True
            elif any(w in clean_words for w in ("mandamelo", "enviamelo", "mandamela", "enviarmelo", "recibirlo")):
                es_afirmativo = True

        if es_afirmativo:
            try:
                # Buscar mensajes salientes previos hacia el paciente que no sean notas internas
                last_msgs = supabase.table("mensajes")\
                    .select("contenido, metadata_json, created_at, emisor")\
                    .eq("conversacion_id", crm_conv_id)\
                    .neq("emisor", "paciente")\
                    .order("created_at", desc=True)\
                    .limit(5)\
                    .execute()

                for m_row in (last_msgs.data or []):
                    m_meta = m_row.get("metadata_json") or {}
                    if m_meta.get("es_nota_interna") is True:
                        continue
                    m_cont = str(m_row.get("contenido") or "").lower()
                    m_tpl = str(m_meta.get("template_name") or "").lower()
                    if m_meta.get("tipo") == "template" or "presupuesto" in m_cont or "plantilla_presupuesto" in m_tpl or "presupuesto_entrega_pdf" in m_tpl:
                        logger.info(f"[Interactive Auto] Respuesta afirmativa '{title_str}' a plantilla de presupuesto ({m_tpl or 'template'}). Despachando PDF.")
                        is_presupuesto = True
                        if m_meta.get("presupuesto_id"):
                            target_presupuesto_id = m_meta.get("presupuesto_id")
                        break
            except Exception as l_err:
                logger.debug(f"[Interactive Auto] Error verificando mensajes previos para respuesta afirmativa: {l_err}")

    if is_presupuesto:
        logger.info(f"[Interactive Auto] Intención de Presupuesto PDF para {normalized_phone} (target_id={target_presupuesto_id})")
        paciente_nombre = "Paciente"
        if paciente_id:
            try:
                p_resp = supabase.table("pacientes").select("nombre").eq("id", paciente_id).execute()
                if p_resp.data and p_resp.data[0].get("nombre"):
                    paciente_nombre = p_resp.data[0]["nombre"]
            except Exception as pe:
                logger.warning(f"[Interactive Presupuesto] Error leyendo paciente: {pe}")

        presupuesto = None
        # 1. Priorizar el presupuesto exacto referenciado en la plantilla previa
        if target_presupuesto_id:
            try:
                t_resp = supabase.table("presupuestos")\
                    .select("id, total, total_ars, total_usd, pdf_url, created_at, estado, numero_presupuesto")\
                    .eq("id", target_presupuesto_id)\
                    .limit(1)\
                    .execute()
                if t_resp.data and len(t_resp.data) > 0:
                    presupuesto = t_resp.data[0]
                    logger.info(f"[Interactive Presupuesto] Presupuesto #{presupuesto.get('numero_presupuesto')} ({target_presupuesto_id}) encontrado desde metadata de plantilla.")
            except Exception as t_err:
                logger.warning(f"[Interactive Presupuesto] Error buscando target_presupuesto_id {target_presupuesto_id}: {t_err}")

        # 2. Si no vino en metadata, buscar el último activo del paciente
        if not presupuesto and paciente_id:
            try:
                pres_resp = supabase.table("presupuestos") \
                    .select("id, total, total_ars, total_usd, pdf_url, created_at, estado, numero_presupuesto") \
                    .eq("paciente_id", paciente_id) \
                    .order("created_at", desc=True) \
                    .limit(5) \
                    .execute()
                if pres_resp.data and len(pres_resp.data) > 0:
                    activos = [p for p in pres_resp.data if str(p.get("estado", "")).lower() != "cancelado"]
                    presupuesto = activos[0] if activos else pres_resp.data[0]
            except Exception as pre:
                logger.error(f"[Interactive Presupuesto] Error consultando presupuestos: {pre}")

        if not presupuesto and normalized_phone:
            try:
                p_by_phone = supabase.table("pacientes").select("id").eq("telefono", normalized_phone).execute()
                p_ids = [p["id"] for p in (p_by_phone.data or [])]
                if p_ids:
                    pres_resp = supabase.table("presupuestos") \
                        .select("id, total, total_ars, total_usd, pdf_url, created_at, estado, numero_presupuesto") \
                        .in_("paciente_id", p_ids) \
                        .order("created_at", desc=True) \
                        .limit(5) \
                        .execute()
                    if pres_resp.data:
                        activos = [p for p in pres_resp.data if str(p.get("estado", "")).lower() != "cancelado"]
                        presupuesto = activos[0] if activos else pres_resp.data[0]
            except Exception as pe2:
                logger.warning(f"[Interactive Presupuesto] Fallback por teléfono falló: {pe2}")

        phone_id, token = get_whatsapp_cloud_credentials()
        if not phone_id or not token:
            logger.error("[Interactive Presupuesto] Credenciales Meta WABA no configuradas.")
            return True

        wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
        try:
            if presupuesto:
                pres_id = presupuesto["id"]
                # Asegurar pre-generación física del PDF oficial antes del envío
                try:
                    from app.services.pdf_service import asegurar_pdf_presupuesto_canonica
                    asegurar_pdf_presupuesto_canonica(pres_id)
                except Exception as aseg_err:
                    logger.warning(f"[Interactive Presupuesto] Advertencia asegurando PDF canónico para {pres_id}: {aseg_err}")

                base_backend_url = os.getenv("BACKEND_PUBLIC_URL", "https://crmagenticonube-production.up.railway.app").rstrip("/")
                pdf_full_url = f"{base_backend_url}/static/presupuesto_{pres_id}.pdf"
                safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', paciente_nombre).strip('_')
                filename = f"Presupuesto_{safe_name}.pdf"

                # Control de vigencia: mayor a 30 días
                created_at_str = presupuesto.get("created_at")
                es_vencido = False
                dias_antiguedad = 0
                if created_at_str:
                    try:
                        c_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                        now_dt = datetime.now(timezone.utc)
                        dias_antiguedad = (now_dt - c_dt).days
                        if dias_antiguedad > 30:
                            es_vencido = True
                    except Exception as dt_err:
                        logger.debug(f"[Interactive Presupuesto] Error calculando antigüedad: {dt_err}")

                if es_vencido:
                    caption = (
                        f"📄 Estimado/a {paciente_nombre}, le adjuntamos su presupuesto emitido ({filename}). "
                        f"⚠️ Recuerde que, al haber transcurrido {dias_antiguedad} días desde su emisión, "
                        f"los valores y aranceles quirúrgicos requieren revalidación con el equipo médico."
                    )
                else:
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
                    content_text=f"[DOCUMENTO PDF: {filename}]" + (" (Valores a revalidar: >30 días)" if es_vencido else ""),
                    payload={
                        "document_url": pdf_full_url,
                        "presupuesto_id": pres_id,
                        "es_vencido": es_vencido,
                        "dias_antiguedad": dias_antiguedad
                    },
                    billing_category="service"
                )

                # Reflejar en la conversación activa de MedCRM
                contenido_crm = f"📄 Presupuesto PDF enviado: {filename}" + (f" (Aviso: emitido hace {dias_antiguedad} días, requiere revalidación)" if es_vencido else "")
                if crm_conv_id:
                    supabase.table("mensajes").insert({
                        "conversacion_id": crm_conv_id,
                        "emisor": "bot",
                        "contenido": contenido_crm,
                        "metadata_json": {
                            "wamid": doc_wamid,
                            "tipo": "documento",
                            "media_url": pdf_full_url,
                            "file_name": filename,
                            "caption": caption,
                            "es_vencido": es_vencido,
                            "dias_antiguedad": dias_antiguedad,
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
    # CASO 2: CONFIRMACIÓN DE ASISTENCIA A CIRUGÍA / TURNO QUIRÚRGICO
    # =========================================================================
    is_confirm = any(k in title_str or k in btn_id for k in [
        "confirmar asistencia", "confirmar turno", "confirmar", "confirmo", "si, confirmo", "si confirmo", "asistiré", "asistire"
    ]) or btn_id.startswith("confirmar_turno")

    if is_confirm:
        logger.info(f"[Interactive Auto] Confirmación de turno quirúrgico para paciente {paciente_id} ({normalized_phone})")
        turno_id = None
        if "confirmar_turno" in btn_id:
            match_id = re.search(r"confirmar_turno[_\-:]([a-zA-Z0-9\-_]+)", button_id or "", re.IGNORECASE)
            if match_id:
                turno_id = match_id.group(1).strip()
            elif btn_id.startswith("confirmar_turno_"):
                turno_id = button_id.replace("CONFIRMAR_TURNO_", "").replace("confirmar_turno_", "").strip()

        turno_data = None
        ahora_iso = datetime.now(timezone.utc).isoformat()

        if paciente_id:
            try:
                today_str = datetime.now(timezone.utc).date().isoformat()
                t_query = supabase.table("turnos_quirofano").select("id, asesoria_id, fecha_cirugia, hora_inicio, estado, checks_adicionales, practica_nombre, quirofanos(nombre)")
                if turno_id:
                    t_query = t_query.eq("id", turno_id)
                else:
                    t_query = t_query.eq("paciente_id", paciente_id).in_("estado", ["pendiente", "notificado", "agendado", "confirmado"]).gte("fecha_cirugia", today_str).order("fecha_cirugia", desc=False).limit(1)
                t_res = t_query.execute()
                if t_res.data and len(t_res.data) > 0:
                    turno_data = t_res.data[0]
                    target_tid = turno_data["id"]
                    chk = turno_data.get("checks_adicionales") or {}
                    if not isinstance(chk, dict):
                        chk = {}
                    chk["recordatorio_estado"] = "confirmado"
                    chk["recordatorio_respondido_at"] = ahora_iso
                    chk["recordatorio_respuesta_texto"] = text_content

                    supabase.table("turnos_quirofano").update({
                        "estado": "confirmado",
                        "checks_adicionales": chk,
                        "updated_at": ahora_iso
                    }).eq("id", target_tid).execute()
                    logger.info(f"[Turnos] Turno quirúrgico {target_tid} confirmado en Supabase.")
            except Exception as te:
                logger.error(f"[Interactive Turnos] Error confirmando turno: {te}")

            # Sincronizar en asesorias_quirurgicas y bitácora del CRM
            try:
                as_id = turno_data.get("asesoria_id") if turno_data else None
                c_chk = {}
                if not as_id:
                    c_res = supabase.table("asesorias_quirurgicas") \
                        .select("id, checklist_prequirurgico, practica_nombre") \
                        .eq("paciente_id", paciente_id) \
                        .in_("estado", ["confirmado", "programado", "en_asesoramiento", "en_analisis"]) \
                        .order("created_at", desc=True) \
                        .limit(1) \
                        .execute()
                    if c_res.data and len(c_res.data) > 0:
                        as_id = c_res.data[0]["id"]
                        c_chk = c_res.data[0].get("checklist_prequirurgico") or {}
                else:
                    c_res = supabase.table("asesorias_quirurgicas").select("id, checklist_prequirurgico, practica_nombre").eq("id", as_id).limit(1).execute()
                    if c_res.data and len(c_res.data) > 0:
                        c_chk = c_res.data[0].get("checklist_prequirurgico") or {}

                if as_id:
                    if not isinstance(c_chk, dict):
                        c_chk = {}
                    prev_rec = c_chk.get("_recordatorio_qx") or {}
                    if not isinstance(prev_rec, dict):
                        prev_rec = {}
                    c_chk["_recordatorio_qx"] = {
                        "estado": "confirmado",
                        "enviado_at": prev_rec.get("enviado_at") or ahora_iso,
                        "respondido_at": ahora_iso,
                        "respuesta_tipo": "confirmado",
                        "respuesta_texto": text_content,
                        "template": prev_rec.get("template")
                    }
                    supabase.table("asesorias_quirurgicas").update({
                        "checklist_prequirurgico": c_chk,
                        "ultimo_contacto_at": ahora_iso
                    }).eq("id", as_id).execute()

                    # Bitácora formal de evolución
                    try:
                        from app.db import crear_evolucion_asesoria
                        crear_evolucion_asesoria({
                            "asesoria_id": as_id,
                            "paciente_id": paciente_id,
                            "usuario_nombre": "Asistente WhatsApp (Meta)",
                            "tipo_contacto": "whatsapp",
                            "contenido": f"✅ CONFIRMACIÓN QUIRÚRGICA RECIBIDA:\nEl paciente confirmó su asistencia a la cirugía vía WhatsApp tras el recordatorio oficial enviado.\n• Respuesta: {text_content}",
                            "fecha_contacto": ahora_iso
                        })
                    except Exception as e_ev:
                        logger.warning(f"Aviso registrando evolución de confirmación: {e_ev}")
            except Exception as as_err:
                logger.error(f"[Interactive Asesoria] Error sincronizando asesoría para confirmación: {as_err}")

        if turno_data:
            f_val = turno_data.get("fecha_cirugia") or ""
            h_val = str(turno_data.get("hora_inicio") or "")[:5]
            hora_str = f" a las {h_val} hs" if h_val else ""
            practica_str = f" para {turno_data.get('practica_nombre')}" if turno_data.get('practica_nombre') else ""
            reply_text = f"✅ ¡Excelente! Su asistencia a la cirugía{practica_str} para el día {f_val}{hora_str} ha sido confirmada con éxito. Lo esperamos en Centrovisión."
        else:
            reply_text = "✅ ¡Muchas gracias! Su asistencia a la cirugía ha sido confirmada correctamente en nuestro sistema. Lo esperamos en Centrovisión."

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
                    payload={"intent": "confirmar_asistencia_qx", "turno_id": turno_data.get("id") if turno_data else None},
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
                            "recordatorio_evento": "confirmado",
                            "delivery_status": "enviado",
                            "provider": "meta_cloud_api"
                        }
                    }).execute()
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": reply_text,
                        "updated_at": ahora_iso
                    }).eq("id", crm_conv_id).execute()
            finally:
                await wa_client.close()

        return True

    # =========================================================================
    # CASO 3: CONSULTA PREQUIRÚRGICA ("Tengo una consulta")
    # =========================================================================
    is_inquiry = any(k in title_str or k in btn_id for k in [
        "tengo una consulta", "tengo dudas", "tengo una duda", "consulta sobre", "hacer una consulta",
        "duda sobre la cirugia", "consulta quirurgica"
    ]) or title_str == "tengo una consulta" or btn_id.startswith("consulta_turno")

    if is_inquiry:
        logger.info(f"[Interactive Auto] Paciente {paciente_id} tiene una consulta sobre el turno quirúrgico ({normalized_phone})")
        ahora_iso = datetime.now(timezone.utc).isoformat()
        turno_data = None

        if paciente_id:
            try:
                today_str = datetime.now(timezone.utc).date().isoformat()
                t_query = supabase.table("turnos_quirofano").select("id, asesoria_id, fecha_cirugia, hora_inicio, checks_adicionales, practica_nombre").eq("paciente_id", paciente_id).gte("fecha_cirugia", today_str).order("fecha_cirugia", desc=False).limit(1)
                t_res = t_query.execute()
                if t_res.data and len(t_res.data) > 0:
                    turno_data = t_res.data[0]
                    target_tid = turno_data["id"]
                    chk = turno_data.get("checks_adicionales") or {}
                    if not isinstance(chk, dict):
                        chk = {}
                    chk["recordatorio_estado"] = "con_consulta"
                    chk["recordatorio_respondido_at"] = ahora_iso
                    chk["recordatorio_respuesta_texto"] = text_content
                    supabase.table("turnos_quirofano").update({
                        "checks_adicionales": chk,
                        "updated_at": ahora_iso
                    }).eq("id", target_tid).execute()
            except Exception as te:
                logger.error(f"[Interactive Inquiry] Error actualizando checks de turno: {te}")

            # Sincronizar en asesorias_quirurgicas y bitácora del CRM
            try:
                as_id = turno_data.get("asesoria_id") if turno_data else None
                c_chk = {}
                if not as_id:
                    c_res = supabase.table("asesorias_quirurgicas") \
                        .select("id, checklist_prequirurgico") \
                        .eq("paciente_id", paciente_id) \
                        .in_("estado", ["confirmado", "programado", "en_asesoramiento", "en_analisis"]) \
                        .order("created_at", desc=True) \
                        .limit(1) \
                        .execute()
                    if c_res.data and len(c_res.data) > 0:
                        as_id = c_res.data[0]["id"]
                        c_chk = c_res.data[0].get("checklist_prequirurgico") or {}
                else:
                    c_res = supabase.table("asesorias_quirurgicas").select("id, checklist_prequirurgico").eq("id", as_id).limit(1).execute()
                    if c_res.data and len(c_res.data) > 0:
                        c_chk = c_res.data[0].get("checklist_prequirurgico") or {}

                if as_id:
                    if not isinstance(c_chk, dict):
                        c_chk = {}
                    prev_rec = c_chk.get("_recordatorio_qx") or {}
                    if not isinstance(prev_rec, dict):
                        prev_rec = {}
                    c_chk["_recordatorio_qx"] = {
                        "estado": "con_consulta",
                        "enviado_at": prev_rec.get("enviado_at") or ahora_iso,
                        "respondido_at": ahora_iso,
                        "respuesta_tipo": "consulta",
                        "respuesta_texto": text_content,
                        "template": prev_rec.get("template")
                    }
                    supabase.table("asesorias_quirurgicas").update({
                        "checklist_prequirurgico": c_chk,
                        "ultimo_contacto_at": ahora_iso
                    }).eq("id", as_id).execute()

                    # Bitácora formal de evolución
                    try:
                        from app.db import crear_evolucion_asesoria
                        crear_evolucion_asesoria({
                            "asesoria_id": as_id,
                            "paciente_id": paciente_id,
                            "usuario_nombre": "Asistente WhatsApp (Meta)",
                            "tipo_contacto": "whatsapp",
                            "contenido": f"⚠️ CONSULTA PREQUIRÚRGICA DEL PACIENTE:\nEl paciente indicó 'Tengo una consulta' tras el recordatorio de cirugía enviado.\n• Detalle: {text_content}\n• Acción: Asignado al equipo de coordinación para seguimiento.",
                            "fecha_contacto": ahora_iso
                        })
                    except Exception as e_ev:
                        logger.warning(f"Aviso registrando evolución de consulta: {e_ev}")
            except Exception as as_err:
                logger.error(f"[Interactive Asesoria] Error sincronizando asesoría para consulta: {as_err}")

        # Reabrir conversación para que el operador la vea inmediatamente
        if crm_conv_id:
            try:
                supabase.table("conversaciones").update({
                    "archivada": False,
                    "estado_gestion": "SIN_ASIGNAR",
                    "updated_at": ahora_iso
                }).eq("id", crm_conv_id).execute()
            except Exception as c_err:
                logger.warning(f"Error reabriendo conversación para consulta: {c_err}")

        reply_text = "👨‍⚕️ Hemos registrado su consulta sobre la cirugía. Un asesor quirúrgico de Centrovisión se comunicará con usted a la brevedad por este medio para resolver todas sus dudas."

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
                    payload={"intent": "consulta_quirurgica"},
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
                            "recordatorio_evento": "con_consulta",
                            "delivery_status": "enviado",
                            "provider": "meta_cloud_api"
                        }
                    }).execute()
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": reply_text,
                        "updated_at": ahora_iso
                    }).eq("id", crm_conv_id).execute()
            finally:
                await wa_client.close()

        return True

    # =========================================================================
    # CASO 4: REPROGRAMACIÓN O CANCELACIÓN DE TURNO
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
                }).eq("paciente_id", paciente_id).gte("fecha_cirugia", today_str).execute()

                from app.services.logger_service import log_event
                log_event(
                    nivel="WARNING",
                    modulo="WHATSAPP",
                    accion="REPROGRAMACION_TURNO_SOLICITADA",
                    mensaje=f"Paciente solicitó reprogramación de turno por WhatsApp ({normalized_phone})",
                    detalles={"paciente_id": paciente_id, "telefono": normalized_phone, "texto": text_content, "boton": button_id},
                    paciente_id=paciente_id
                )
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

    # =========================================================================
    # CASO 5: SEGUIMIENTO QUIRÚRGICO AUTOMATIZADO (CONFIRMAR, SNOOZE, DESISTIR)
    # =========================================================================
    if (
        btn_id.startswith("caso_confirmar_") or 
        btn_id.startswith("caso_snooze_") or 
        btn_id.startswith("caso_desistir_") or
        btn_id.startswith("caso_objecion_")
    ):
        logger.info(f"[Interactive Seguimiento] Procesando botón quirúrgico: {btn_id} para {normalized_phone}")
        try:
            from app.services.seguimiento_quirurgico_service import procesar_respuesta_interactiva_seguimiento
            resultado = procesar_respuesta_interactiva_seguimiento(
                payload_boton=btn_id.upper(),
                telefono=normalized_phone,
                texto_usuario=text_content
            )
            return True
        except Exception as e_seg:
            logger.error(f"[Interactive Seguimiento] Error procesando acción: {e_seg}", exc_info=True)
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

