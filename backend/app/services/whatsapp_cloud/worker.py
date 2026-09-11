"""
Worker asíncrono para ingesta, deduplicación y ruteo de eventos de WhatsApp Cloud API.
Garantiza deduplicación distribuida por wamid, actualización de la ventana de 24 hs
y despacho reactivo al Agente Clínico o CRM.
"""

import os
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
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")

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
    Actualiza el estado de entrega o lectura de un mensaje outbound en la base de datos.
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

    try:
        res = supabase.table("whatsapp_messages").update(update_fields).eq("wamid", wamid).execute()
        logger.info(f"[Worker Status] Mensaje wamid={wamid} actualizado a status='{status_name}'")
    except Exception as e:
        logger.error(f"[Worker Status] Error actualizando status para wamid={wamid}: {e}")


async def handle_inbound_message(msg_dict: Dict[str, Any], phone_number_id: Optional[str], contact_name: Optional[str]):
    """
    Maneja un mensaje de paciente entrante:
      - Normaliza el teléfono E.164
      - Renueva la ventana de 24 horas
      - Persiste el mensaje y rutea respuestas interactivas de turnos
    """
    wamid = msg_dict.get("id")
    raw_sender = msg_dict.get("from")
    normalized_phone = normalize_to_meta_e164(raw_sender)
    msg_type = msg_dict.get("type", "text")

    # Extraer contenido de texto según el tipo
    text_content = ""
    interactive_id = None
    if msg_type == "text":
        text_content = msg_dict.get("text", {}).get("body", "")
    elif msg_type == "interactive":
        interactive = msg_dict.get("interactive", {})
        btn_reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
        interactive_id = btn_reply.get("id")
        text_content = btn_reply.get("title", "")
    elif msg_type in ("image", "document", "audio"):
        media = msg_dict.get(msg_type, {})
        text_content = f"[{msg_type.upper()}] {media.get('caption') or media.get('filename') or media.get('id')}"

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

            # 4. Registrar en whatsapp_messages (auditoría oficial de Meta)
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

            # 4.1 Sincronizar en el Chat del CRM (public.conversaciones y public.mensajes)
            try:
                conv_crm_res = supabase.table("conversaciones").select("id, bot_disabled").eq("paciente_id", paciente_id).execute()
                crm_conv_id = None
                bot_disabled = False

                if conv_crm_res.data and len(conv_crm_res.data) > 0:
                    crm_conv_id = conv_crm_res.data[0]["id"]
                    bot_disabled = conv_crm_res.data[0].get("bot_disabled", False)
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": text_content,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", crm_conv_id).execute()
                else:
                    new_crm_conv = supabase.table("conversaciones").insert({
                        "paciente_id": paciente_id,
                        "bot_disabled": False,
                        "ultimo_mensaje": text_content
                    }).execute()
                    if new_crm_conv.data:
                        crm_conv_id = new_crm_conv.data[0]["id"]

                # Guardar mensaje del paciente en la tabla que lee el CRM
                if crm_conv_id:
                    supabase.table("mensajes").insert({
                        "conversacion_id": crm_conv_id,
                        "emisor": "paciente",
                        "contenido": text_content,
                        "metadata_json": {
                            "wamid": wamid,
                            "tipo": msg_type,
                            "provider": "meta_cloud_api"
                        }
                    }).execute()
                    logger.info(f"[Worker Inbound] Mensaje sincronizado en public.mensajes para chat del CRM.")

                # 4.2 Despachar el Agente IA (Gemini) si el bot no está deshabilitado
                if not bot_disabled and text_content and msg_type in ("text", "interactive"):
                    import asyncio
                    from app.services.whatsapp_cloud.client import WhatsAppCloudClient

                    async def responder_con_agente():
                        try:
                            from app.agent import ejecutar_agente_para_paciente
                            logger.info(f"[Agente IA] Ejecutando Gemini para paciente {paciente_id}...")
                            respuesta_bot = await ejecutar_agente_para_paciente(paciente_id, text_content)
                            if respuesta_bot:
                                phone_id = os.getenv("META_WA_PHONE_NUMBER_ID")
                                token = os.getenv("META_WA_ACCESS_TOKEN")
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

        # 5. Manejar botones interactivos de turnos clínicos si corresponde
        if interactive_id:
            await handle_turnos_interactive_reply(interactive_id, paciente_id, normalized_phone)

        logger.info(f"[Worker Inbound] Mensaje de {normalized_phone} procesado exitosamente.")

    except Exception as e:
        logger.error(f"[Worker Inbound] Error procesando mensaje de {normalized_phone}: {e}", exc_info=True)


async def handle_turnos_interactive_reply(button_id: str, paciente_id: Optional[str], phone: str):
    """
    Ruteo de respuestas a botones de turnos clínicos:
    Ejemplo IDs:
      - CONFIRMAR_TURNO_{turno_id}
      - CANCELAR_TURNO_{turno_id}
    """
    logger.info(f"[Turnos Interactive] Botón pulsado: button_id='{button_id}' por {phone}")
    if button_id.startswith("CONFIRMAR_TURNO_"):
        turno_id = button_id.replace("CONFIRMAR_TURNO_", "")
        logger.info(f"[Turnos] Paciente {phone} confirmó turno id={turno_id}")
        # Aquí se invoca actualización en CRM/Geclisa
    elif button_id.startswith("CANCELAR_TURNO_"):
        turno_id = button_id.replace("CANCELAR_TURNO_", "")
        logger.info(f"[Turnos] Paciente {phone} canceló turno id={turno_id}")
        # Aquí se invoca cancelación y liberación de agenda


async def record_outbound_audit_message(
    to_phone: str,
    wamid: str,
    message_type: str,
    content_text: str,
    payload: Dict[str, Any],
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
                    "payload_raw": payload,
                    "status": "sent",
                    "sent_at": now_iso,
                    "billing_category": billing_category
                }).execute()
                logger.info(f"[Outbound Audit] Mensaje {wamid} registrado en whatsapp_messages.")

    except Exception as e:
        logger.error(f"[Outbound Audit Error] Error guardando auditoría de mensaje saliente: {e}", exc_info=True)

