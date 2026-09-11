"""
FastAPI Router para Meta WhatsApp Cloud API (Graph API v21+).
Contempla Handshake de verificación (GET), recepción con validación HMAC-SHA256 (POST)
y endpoints de despacho de mensajes con plantillas o botones interactivos.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from fastapi import APIRouter, Request, Response, HTTPException, status, Query, Header, BackgroundTasks, Depends
from pydantic import BaseModel, Field

load_dotenv()

from app.services.whatsapp_cloud.security import verify_meta_signature
from app.services.whatsapp_cloud.client import (
    WhatsAppCloudClient,
    ConversationWindowClosedError,
    RateLimitExceededError,
    get_whatsapp_app_secret
)
from app.services.whatsapp_cloud.worker import process_meta_webhook_payload, record_outbound_audit_message
from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164

from app.services.whatsapp_cloud.templates import templates_router

logger = logging.getLogger("whatsapp_cloud_router")

router = APIRouter(prefix="/api/whatsapp/cloud", tags=["WhatsApp Cloud API"])
router.include_router(templates_router)

# Configuraciones desde variables de entorno
META_APP_SECRET = os.getenv("META_WA_APP_SECRET", "")
META_VERIFY_TOKEN = os.getenv("META_WA_VERIFY_TOKEN", "medcrm_meta_verify_token_2026")
DEFAULT_PHONE_NUMBER_ID = os.getenv("META_WA_PHONE_NUMBER_ID", "")
DEFAULT_ACCESS_TOKEN = os.getenv("META_WA_ACCESS_TOKEN", "")


# ---------------------------------------------------------------------
# Schemas para solicitudes directas desde el CRM
# ---------------------------------------------------------------------

class TemplateSendRequest(BaseModel):
    to_phone: str = Field(..., description="Número de teléfono en formato local o internacional")
    template_name: str = Field(..., description="Nombre de la plantilla en Meta Business Manager")
    language_code: str = Field(default="es_AR")
    components: Optional[List[Dict[str, Any]]] = Field(default=None)


class TextSendRequest(BaseModel):
    to_phone: str
    text: str
    preview_url: bool = False


class InteractiveButtonRequest(BaseModel):
    to_phone: str
    body_text: str
    buttons: List[Dict[str, str]]
    header_text: Optional[str] = None
    footer_text: Optional[str] = "Clínica Médica"


class DocumentSendRequest(BaseModel):
    to_phone: str
    document_url: str
    filename: Optional[str] = None
    caption: Optional[str] = None


# ---------------------------------------------------------------------
# 1. Webhook Handshake & Ingestion
# ---------------------------------------------------------------------

@router.get("/webhook", status_code=status.HTTP_200_OK)
@router.get("/webhooks/whatsapp", status_code=status.HTTP_200_OK)
async def verify_webhook_handshake(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    """
    Handshake de verificación requerido por Meta al configurar el Webhook en App Dashboard.
    """
    expected_token = os.getenv("META_WA_VERIFY_TOKEN", META_VERIFY_TOKEN)
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("[Meta Handshake] Webhook de Meta verificado exitosamente.")
        return Response(content=hub_challenge or "", media_type="text/plain")

    logger.warning(f"[Meta Handshake] Intento de verificación no autorizado. Mode={hub_mode}")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")


@router.post("/webhook", status_code=status.HTTP_200_OK)
@router.post("/webhooks/whatsapp", status_code=status.HTTP_200_OK)
async def receive_webhook_event(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """
    Recepción asíncrona de eventos de Meta (mensajes entrantes, status updates).
    Valida firma HMAC-SHA256, encola para procesamiento asíncrono y responde 200 OK en < 100ms.
    """
    raw_body = await request.body()
    app_secret = get_whatsapp_app_secret()

    # Validar firma sólo si app_secret está configurado en el entorno o BD
    if app_secret:
        if not verify_meta_signature(app_secret, raw_body, x_hub_signature_256):
            logger.warning("[Meta Security] Payload rechazado: firma HMAC-SHA256 inválida.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid HMAC signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        logger.error("[Meta Webhook] Error decodificando payload JSON.")
        return Response(content="INVALID_JSON", status_code=status.HTTP_400_BAD_REQUEST)

    # Despachar al worker en segundo plano (asíncrono desacoplado)
    background_tasks.add_task(process_meta_webhook_payload, payload)

    # Retorno inmediato a Meta
    return Response(content="EVENT_RECEIVED", status_code=status.HTTP_200_OK)


# ---------------------------------------------------------------------
# 2. Outbound Message Dispatch Endpoints
# ---------------------------------------------------------------------

def get_client() -> WhatsAppCloudClient:
    from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials
    phone_id, token = get_whatsapp_cloud_credentials()
    if not phone_id or not token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Credenciales de Meta WhatsApp Cloud API no configuradas en el servidor ni en base de datos"
        )
    return WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)


@router.post("/send-template")
async def send_template_message(req: TemplateSendRequest, background_tasks: BackgroundTasks):
    """
    Despacha un mensaje de plantilla pre-aprobada (ideal para recordatorios de turnos).
    """
    client = get_client()
    normalized_to = normalize_to_meta_e164(req.to_phone)
    try:
        result = await client.send_template(
            to_phone=normalized_to,
            template_name=req.template_name,
            language_code=req.language_code,
            components=req.components
        )
        wamid = result.get("wamid")
        if wamid:
            background_tasks.add_task(
                record_outbound_audit_message,
                to_phone=normalized_to,
                wamid=wamid,
                message_type="template",
                content_text=f"[TEMPLATE: {req.template_name}]",
                payload=req.model_dump(),
                billing_category="utility"
            )
        return {"status": "success", "wamid": wamid, "to": normalized_to}
    except Exception as e:
        logger.error(f"[Outbound Template Error] {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/send-text")
async def send_free_text_message(req: TextSendRequest, background_tasks: BackgroundTasks):
    """
    Envía texto libre si la conversación está dentro de la ventana de 24 horas.
    """
    client = get_client()
    normalized_to = normalize_to_meta_e164(req.to_phone)
    try:
        result = await client.send_free_text(
            to_phone=normalized_to,
            text=req.text,
            preview_url=req.preview_url
        )
        wamid = result.get("wamid")
        if wamid:
            background_tasks.add_task(
                record_outbound_audit_message,
                to_phone=normalized_to,
                wamid=wamid,
                message_type="text",
                content_text=req.text,
                payload=req.model_dump(),
                billing_category="service"
            )
        return {"status": "success", "wamid": wamid, "to": normalized_to}
    except ConversationWindowClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ventana de 24 horas cerrada para este paciente. Requiere envío de plantilla homologada."
        )
    except Exception as e:
        logger.error(f"[Outbound Text Error] {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/send-interactive")
async def send_interactive_buttons_message(req: InteractiveButtonRequest, background_tasks: BackgroundTasks):
    """
    Envía botones interactivos (Confirmar / Cancelar turno).
    """
    client = get_client()
    normalized_to = normalize_to_meta_e164(req.to_phone)
    try:
        result = await client.send_interactive_buttons(
            to_phone=normalized_to,
            body_text=req.body_text,
            buttons=req.buttons,
            header_text=req.header_text,
            footer_text=req.footer_text
        )
        wamid = result.get("wamid")
        if wamid:
            background_tasks.add_task(
                record_outbound_audit_message,
                to_phone=normalized_to,
                wamid=wamid,
                message_type="interactive",
                content_text=req.body_text,
                payload=req.model_dump(),
                billing_category="service"
            )
        return {"status": "success", "wamid": wamid, "to": normalized_to}
    except Exception as e:
        logger.error(f"[Outbound Interactive Error] {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/send-document")
async def send_document_message(req: DocumentSendRequest, background_tasks: BackgroundTasks):
    """
    Envía un archivo PDF / Documento clínico directamente al paciente por WhatsApp.
    """
    client = get_client()
    normalized_to = normalize_to_meta_e164(req.to_phone)
    try:
        result = await client.send_document(
            to_phone=normalized_to,
            document_url=req.document_url,
            filename=req.filename,
            caption=req.caption
        )
        wamid = result.get("wamid")
        if wamid:
            background_tasks.add_task(
                record_outbound_audit_message,
                to_phone=normalized_to,
                wamid=wamid,
                message_type="document",
                content_text=f"[DOCUMENTO: {req.filename or 'archivo.pdf'}] {req.caption or ''}".strip(),
                payload=req.model_dump(),
                billing_category="service"
            )
        return {"status": "success", "wamid": wamid, "to": normalized_to}
    except Exception as e:
        logger.error(f"[Outbound Document Error] {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

