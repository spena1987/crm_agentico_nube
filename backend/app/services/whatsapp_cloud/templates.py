"""
Módulo de Gestión de Plantillas para Meta WhatsApp Cloud API (Graph API v21+).
Permite crear, validar, listar, sincronizar y eliminar plantillas de mensajes,
con soporte para variables clínicas posicionales ({{1}}, {{2}}...) y datos de ejemplo requeridos por Meta.
"""

import os
import re
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, HTTPException, status, Query, Body
from pydantic import BaseModel, Field

from app.db import supabase
from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials

logger = logging.getLogger("whatsapp_templates")

templates_router = APIRouter(prefix="/templates", tags=["WhatsApp Templates"])


# ---------------------------------------------------------------------
# Schemas de Validación Pydantic
# ---------------------------------------------------------------------

class TemplateButton(BaseModel):
    type: str = Field(default="QUICK_REPLY", description="QUICK_REPLY, URL, PHONE_NUMBER")
    text: str = Field(..., max_length=25, description="Texto del botón")
    url: Optional[str] = None
    phone_number: Optional[str] = None
    example: Optional[List[str]] = None


class TemplateCreateRequest(BaseModel):
    name: str = Field(..., description="Nombre técnico único (minúsculas, números y guiones bajos)")
    category: str = Field(default="UTILITY", description="UTILITY, MARKETING, AUTHENTICATION")
    language: str = Field(default="es_AR", description="Código de idioma BCP 47 (ej: es_AR, es, en_US)")
    header_type: str = Field(default="NONE", description="NONE, TEXT, IMAGE, DOCUMENT, VIDEO")
    header_content: Optional[str] = Field(default=None, description="Texto de cabecera si header_type es TEXT")
    body_text: str = Field(..., max_length=1024, description="Texto del cuerpo con variables {{1}}, {{2}}, etc.")
    footer_text: Optional[str] = Field(default=None, max_length=60, description="Pie de página opcional")
    buttons: Optional[List[TemplateButton]] = Field(default=None, description="Botones de respuesta rápida o acción")
    variable_mappings: Optional[Dict[str, str]] = Field(
        default=None, 
        description="Mapeo de variables clínicas, ej: {'1': 'paciente_nombre', '2': 'turno_fecha'}"
    )
    sample_values: Optional[List[str]] = Field(
        default=None,
        description="Valores reales de ejemplo requeridos por Meta para aprobar la plantilla (uno por cada variable)"
    )


class RenderPreviewRequest(BaseModel):
    body_text: str
    variable_mappings: Optional[Dict[str, str]] = None
    custom_values: Optional[Dict[str, str]] = None
    header_content: Optional[str] = None
    footer_text: Optional[str] = None


class TemplateGovernanceUpdate(BaseModel):
    activo: Optional[bool] = None
    visible_en_chat: Optional[bool] = None
    grupo_crm: Optional[str] = Field(None, max_length=60)
    titulo_amigable: Optional[str] = Field(None, max_length=120)
    descripcion: Optional[str] = None
    orden: Optional[int] = None


# ---------------------------------------------------------------------
# Helpers de Credenciales WABA y Meta Graph API
# ---------------------------------------------------------------------

def get_waba_credentials() -> tuple[Optional[str], Optional[str]]:
    """
    Obtiene el WABA ID (WhatsApp Business Account ID) y el System User Access Token.
    Prioriza Supabase (whatsapp_accounts) y luego variables de entorno.
    """
    waba_id = None
    token = None
    try:
        acc_res = supabase.table("whatsapp_accounts").select("waba_id, system_user_token_encrypted").eq("is_active", True).limit(1).execute()
        if acc_res.data and len(acc_res.data) > 0:
            waba_id = acc_res.data[0].get("waba_id")
            token = acc_res.data[0].get("system_user_token_encrypted")
    except Exception as e:
        logger.debug(f"[Templates] Error consultando whatsapp_accounts: {e}")

    if not waba_id:
        waba_id = os.getenv("META_WA_WABA_ID")
    if not token:
        token = os.getenv("META_WA_ACCESS_TOKEN")

    return waba_id, token


def clean_template_name(raw_name: str) -> str:
    """Normaliza un nombre para cumplir con el formato técnico de Meta: minúsculas y guiones bajos."""
    clean = raw_name.lower().strip()
    clean = re.sub(r"[^a-z0-9_]+", "_", clean)
    clean = re.sub(r"_+", "_", clean).strip("_")
    return clean


def clean_header_text(raw_header: Optional[str]) -> Optional[str]:
    """
    Sanitiza el encabezado para cumplir estrictamente con las reglas de Meta Graph API:
    - No permite emojis, asteriscos, saltos de línea ni caracteres de formato markdown.
    - Longitud máxima de 60 caracteres.
    """
    if not raw_header:
        return None
    # 1. Reemplazar saltos de línea por espacios
    clean = re.sub(r"[\r\n]+", " ", str(raw_header))
    # 2. Eliminar emojis y caracteres de formato (conservar letras, números, espacios y puntuación estándar)
    clean = re.sub(r"[^\w\s\.,;:!?\(\)\/\-\–—]", "", clean)
    # 3. Normalizar espacios repetidos y limitar a 60 caracteres
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:60] if clean else None


# ---------------------------------------------------------------------
# Endpoints de Plantillas
# ---------------------------------------------------------------------

@templates_router.get("", status_code=status.HTTP_200_OK)
async def list_templates(
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    solo_activos: Optional[bool] = False,
    solo_chat: Optional[bool] = False,
    grupo: Optional[str] = None
):
    """
    Obtiene el listado de plantillas registradas en la base de datos de MedCRM con soporte de filtrado operacional.
    """
    try:
        query = supabase.table("whatsapp_templates").select("*")
        
        if solo_chat:
            query = query.eq("status", "APPROVED").eq("activo", True).eq("visible_en_chat", True)
        else:
            if solo_activos:
                query = query.eq("activo", True)
            if status_filter:
                query = query.eq("status", status_filter.upper())

        if category:
            query = query.eq("category", category.upper())
        if grupo and grupo != "todas" and grupo != "ALL":
            query = query.eq("grupo_crm", grupo)

        query = query.order("orden", desc=False).order("created_at", desc=True)
        res = query.execute()
        return {"status": "success", "data": res.data or []}
    except Exception as e:
        logger.error(f"[Templates] Error al listar plantillas: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@templates_router.post("/sync", status_code=status.HTTP_200_OK)
async def sync_templates_from_meta():
    """
    Sincroniza todas las plantillas existentes en la cuenta de Meta WhatsApp Business (WABA)
    directamente a la base de datos de Supabase.
    """
    waba_id, token = get_waba_credentials()
    if not waba_id or not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WABA ID o Access Token de Meta no configurados."
        )

    url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates?limit=100"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, headers={"Authorization": f"Bearer {token}"})

    if res.status_code != 200:
        logger.error(f"[Templates Sync] Error de Meta API: {res.status_code} - {res.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Meta Graph API error ({res.status_code}): {res.text}"
        )

    meta_templates = res.json().get("data", [])
    synced_count = 0

    for item in meta_templates:
        tpl_name = item.get("name")
        tpl_id = item.get("id")
        tpl_status = item.get("status", "APPROVED")
        tpl_category = item.get("category", "UTILITY")
        tpl_language = item.get("language", "es_AR")
        components = item.get("components", [])

        header_type = "NONE"
        header_content = None
        body_text = ""
        footer_text = None
        buttons = []

        for comp in components:
            c_type = comp.get("type")
            if c_type == "HEADER":
                header_type = comp.get("format", "TEXT")
                header_content = comp.get("text")
            elif c_type == "BODY":
                body_text = comp.get("text", "")
            elif c_type == "FOOTER":
                footer_text = comp.get("text")
            elif c_type == "BUTTONS":
                buttons = comp.get("buttons", [])

        # Upsert en Supabase
        tpl_record = {
            "waba_id": waba_id,
            "meta_template_id": tpl_id,
            "name": tpl_name,
            "category": tpl_category,
            "language": tpl_language,
            "status": tpl_status,
            "header_type": header_type,
            "header_content": header_content,
            "body_text": body_text,
            "footer_text": footer_text,
            "buttons": buttons,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # Mapeos predeterminados para plantillas homologadas del CRM
        DEFAULT_MAPPINGS = {
            "consentimiento_informado_quirurgico_v1": {
                "1": "paciente_nombre",
                "2": "practica_nombre",
                "3": "turno_fecha",
                "4": "medico_nombre",
                "5": "enlace_consentimiento"
            },
            "recordatorio_cirugia_preparacion_v1": {
                "1": "paciente_nombre",
                "2": "practica_nombre",
                "3": "turno_fecha",
                "4": "turno_hora",
                "5": "preparacion_texto"
            },
            "apertura_conversacion": {
                "1": "paciente_nombre"
            },
            "presupuesto_entrega_pdf": {
                "1": "paciente_nombre",
                "2": "practica_nombre",
                "3": "presupuesto_monto"
            },
            "seguimiento_asesoramiento_t1": {"1": "paciente_nombre", "2": "practica_nombre"},
            "seguimiento_asesoramiento_t2": {"1": "paciente_nombre", "2": "practica_nombre"},
            "seguimiento_asesoramiento_t3": {"1": "paciente_nombre", "2": "practica_nombre"},
            "seguimiento_analisis_t1": {"1": "paciente_nombre", "2": "practica_nombre"},
            "seguimiento_analisis_t2": {"1": "paciente_nombre", "2": "practica_nombre"},
            "seguimiento_analisis_t3": {"1": "paciente_nombre", "2": "practica_nombre"},
            "seguimiento_analisis_t4": {"1": "paciente_nombre", "2": "practica_nombre"},
            "entrega_estudio_oftalmologico_pdf": {"1": "paciente_nombre", "2": "practica_nombre"},
            "entrega_estudio_oftalmologico_img": {"1": "paciente_nombre", "2": "practica_nombre"},
            "entrega_estudio_oftalmologico_v1": {"1": "paciente_nombre", "2": "practica_nombre"}
        }

        try:
            exist_check = supabase.table("whatsapp_templates").select("id, variable_mappings, activo, visible_en_chat, grupo_crm").eq("name", tpl_name).execute()
            if exist_check.data and len(exist_check.data) > 0:
                cur_maps = exist_check.data[0].get("variable_mappings")
                if not cur_maps and tpl_name in DEFAULT_MAPPINGS:
                    tpl_record["variable_mappings"] = DEFAULT_MAPPINGS[tpl_name]
                # Se actualizan únicamente datos técnicos de Meta, preservando la gobernanza local intacta
                supabase.table("whatsapp_templates").update(tpl_record).eq("name", tpl_name).execute()
            else:
                grupo_inicial = "Atención General"
                lower_name = tpl_name.lower()
                if "seguimiento" in lower_name or "cirugia" in lower_name or "analisis" in lower_name:
                    grupo_inicial = "Seguimiento Quirúrgico"
                elif "estudio" in lower_name:
                    grupo_inicial = "Entrega de Estudios"
                elif "turno" in lower_name or "recordatorio" in lower_name:
                    grupo_inicial = "Recordatorios de Turnos"
                elif "presupuesto" in lower_name:
                    grupo_inicial = "Presupuestos"

                tpl_record["created_at"] = datetime.now(timezone.utc).isoformat()
                tpl_record["variable_mappings"] = DEFAULT_MAPPINGS.get(tpl_name, {})
                tpl_record["activo"] = True
                tpl_record["visible_en_chat"] = True
                tpl_record["grupo_crm"] = grupo_inicial
                tpl_record["titulo_amigable"] = tpl_name.replace("_", " ").title()
                tpl_record["orden"] = 0
                supabase.table("whatsapp_templates").insert(tpl_record).execute()
            synced_count += 1
        except Exception as up_err:
            logger.warning(f"[Templates Sync] Error guardando {tpl_name}: {up_err}")

    return {
        "status": "success",
        "synced_count": synced_count,
        "message": f"Se sincronizaron {synced_count} plantillas correctamente desde Meta."
    }


async def _upload_sample_media_for_template_header(token: str, header_type: str) -> Optional[str]:
    """
    Obtiene un `header_handle` ('4::...') oficial mediante la Resumable Upload API de Meta Graph API v21.0,
    exigido por Meta para crear plantillas con HEADER de tipo DOCUMENT o IMAGE.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # 1. Descubrir App ID asociado al System User Access Token
            app_id = os.getenv("META_WA_APP_ID")
            if not app_id:
                app_res = await client.get(
                    "https://graph.facebook.com/v21.0/app",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if app_res.status_code == 200:
                    app_id = app_res.json().get("id")
            if not app_id:
                logger.warning("[Templates] No se pudo obtener app_id para Resumable Upload API.")
                return None

            # 2. Generar binario mínimo válido (PDF o PNG 1x1) para la muestra de revisión de Meta
            if header_type.upper() == "DOCUMENT":
                mime_type = "application/pdf"
                file_bytes = (
                    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj "
                    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
                    b"3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\n"
                    b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
                    b"0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n165\n%%EOF"
                )
                file_name = "estudio_oftalmologico_ejemplo.pdf"
            else:
                mime_type = "image/png"
                import base64
                file_bytes = base64.b64decode(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                )
                file_name = "estudio_oftalmologico_ejemplo.png"

            # 3. Iniciar sesión de subida en Resumable Upload API
            session_res = await client.post(
                f"https://graph.facebook.com/v21.0/{app_id}/uploads",
                params={
                    "file_name": file_name,
                    "file_length": len(file_bytes),
                    "file_type": mime_type
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            if session_res.status_code not in (200, 201):
                logger.warning(f"[Templates] Falló inicio de sesión Resumable Upload: {session_res.text}")
                return None

            upload_session_id = session_res.json().get("id")
            if not upload_session_id:
                return None

            # 4. Subir bytes y obtener el handle 'h'
            upload_res = await client.post(
                f"https://graph.facebook.com/v21.0/{upload_session_id}",
                headers={
                    "Authorization": f"OAuth {token}",
                    "file_offset": "0",
                    "Content-Type": mime_type
                },
                content=file_bytes
            )
            if upload_res.status_code in (200, 201):
                handle = upload_res.json().get("h")
                return handle
            logger.warning(f"[Templates] Falló carga de bytes en Resumable Upload: {upload_res.text}")
    except Exception as e:
        logger.warning(f"[Templates] Excepción en _upload_sample_media_for_template_header: {e}")
    return None


@templates_router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(req: TemplateCreateRequest):
    """
    Crea una nueva plantilla en Meta WhatsApp Cloud API y la registra en la base de datos de MedCRM.
    Genera automáticamente la estructura de componentes y ejemplos exigidos por Meta.
    """
    waba_id, token = get_waba_credentials()
    if not waba_id or not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WABA ID o Access Token no configurados."
        )

    safe_name = clean_template_name(req.name)
    if not safe_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre de la plantilla no es válido.")

    # 1. Detectar variables posicionales en el cuerpo ({{1}}, {{2}}, etc.)
    var_matches = re.findall(r"\{\{(\d+)\}\}", req.body_text)
    num_vars = len(set(var_matches))

    components: List[Dict[str, Any]] = []

    # Cabecera (Sanitizada estrictamente según las políticas de Meta: sin emojis, saltos ni asteriscos)
    clean_header = clean_header_text(req.header_content) if req.header_type == "TEXT" else None
    if req.header_type == "TEXT" and clean_header:
        components.append({
            "type": "HEADER",
            "format": "TEXT",
            "text": clean_header
        })
    elif req.header_type in ("DOCUMENT", "IMAGE"):
        header_handle = await _upload_sample_media_for_template_header(token, req.header_type)
        header_comp: Dict[str, Any] = {
            "type": "HEADER",
            "format": req.header_type
        }
        if header_handle:
            header_comp["example"] = {"header_handle": [header_handle]}
        components.append(header_comp)

    # Cuerpo
    body_comp: Dict[str, Any] = {
        "type": "BODY",
        "text": req.body_text
    }

    # Meta requiere OBLIGATORIAMENTE el bloque "example" con valores de muestra si hay variables
    if num_vars > 0:
        samples = req.sample_values or []
        default_samples = [
            "Juan Pérez", "15 de Octubre de 2026", "10:30 hs", "Dr. Gómez", "Clínica Médica", "Consultorio 3"
        ]
        while len(samples) < num_vars:
            idx = len(samples)
            fallback_val = default_samples[idx] if idx < len(default_samples) else f"Valor {idx+1}"
            samples.append(fallback_val)

        body_comp["example"] = {
            "body_text": [samples[:num_vars]]
        }

    components.append(body_comp)

    # Pie de página
    if req.footer_text:
        components.append({
            "type": "FOOTER",
            "text": req.footer_text
        })

    # Botones
    if req.buttons and len(req.buttons) > 0:
        buttons_payload = []
        for b in req.buttons[:3]: # Meta permite hasta 3 botones
            if b.type == "QUICK_REPLY":
                buttons_payload.append({
                    "type": "QUICK_REPLY",
                    "text": b.text
                })
            elif b.type == "URL" and b.url:
                clean_url = b.url.strip()
                # Meta exige estrictamente que {{1}} esté al final de la ruta (sin sufijos como .pdf)
                if "/presupuesto_{{1}}.pdf" in clean_url:
                    clean_url = clean_url.replace("/presupuesto_{{1}}.pdf", "/api/presupuestos/pdf/{{1}}")
                elif "/static/presupuesto_{{1}}.pdf" in clean_url:
                    clean_url = clean_url.replace("/static/presupuesto_{{1}}.pdf", "/api/presupuestos/pdf/{{1}}")

                url_btn: Dict[str, Any] = {
                    "type": "URL",
                    "text": b.text.strip(),
                    "url": clean_url
                }
                # Meta exige obligatoriamente que el campo 'example' sea un array con una URL completa válida
                if "{{" in clean_url:
                    if b.example and len(b.example) > 0 and str(b.example[0]).startswith("http"):
                        url_btn["example"] = b.example
                    else:
                        sample_url = clean_url.replace("{{1}}", "demo_presupuesto_123")
                        sample_url = re.sub(r"\{\{\d+\}\}", "demo123", sample_url)
                        url_btn["example"] = [sample_url]
                buttons_payload.append(url_btn)
            elif b.type == "PHONE_NUMBER" and b.phone_number:
                buttons_payload.append({
                    "type": "PHONE_NUMBER",
                    "text": b.text,
                    "phone_number": b.phone_number
                })
        if buttons_payload:
            components.append({
                "type": "BUTTONS",
                "buttons": buttons_payload
            })

    # 2. Despachar a Meta Graph API
    meta_payload = {
        "name": safe_name,
        "category": req.category.upper(),
        "language": req.language,
        "components": components
    }

    url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, json=meta_payload, headers={"Authorization": f"Bearer {token}"})

    if res.status_code not in (200, 201):
        err_body = res.text
        logger.error(f"[Template Creation Failed] Status={res.status_code}, Body={err_body}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error devuelto por Meta al registrar plantilla: {err_body}"
        )

    meta_res = res.json()
    meta_id = meta_res.get("id")
    meta_status = meta_res.get("status", "PENDING")

    # 3. Guardar en Base de Datos de MedCRM
    db_record = {
        "waba_id": waba_id,
        "meta_template_id": meta_id,
        "name": safe_name,
        "category": req.category.upper(),
        "language": req.language,
        "status": meta_status,
        "header_type": req.header_type,
        "header_content": clean_header,
        "body_text": req.body_text,
        "footer_text": req.footer_text,
        "buttons": [b.model_dump() for b in req.buttons] if req.buttons else [],
        "variable_mappings": req.variable_mappings or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        insert_res = supabase.table("whatsapp_templates").insert(db_record).execute()
        saved_tpl = insert_res.data[0] if insert_res.data else db_record
        return {"status": "success", "template": saved_tpl}
    except Exception as db_err:
        logger.error(f"[Template DB Save Error] {db_err}")
        return {"status": "warning", "message": f"Creada en Meta (ID {meta_id}) pero falló guardado local: {db_err}", "meta": meta_res}


@templates_router.delete("/{name}", status_code=status.HTTP_200_OK)
async def delete_template(name: str):
    """
    Elimina una plantilla en Meta WhatsApp Cloud API y en la base de datos de MedCRM.
    """
    waba_id, token = get_waba_credentials()
    if not waba_id or not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credenciales WABA no configuradas.")

    url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates?name={name}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.delete(url, headers={"Authorization": f"Bearer {token}"})

    if res.status_code != 200:
        logger.warning(f"[Template Delete Warning] Meta API respondió {res.status_code}: {res.text}")

    try:
        supabase.table("whatsapp_templates").delete().eq("name", name).execute()
    except Exception as db_err:
        logger.error(f"[Template Delete DB Error] {db_err}")

    return {"status": "success", "deleted": name}


@templates_router.patch("/{name}/config", status_code=status.HTTP_200_OK)
async def update_template_governance(name: str, payload: TemplateGovernanceUpdate):
    """
    Actualiza la configuración operativa de una plantilla en el CRM (activación, visibilidad en chat, grupo clínico y título).
    No altera el contenido técnico homologado en Meta.
    """
    try:
        update_data = {}
        if payload.activo is not None:
            update_data["activo"] = payload.activo
        if payload.visible_en_chat is not None:
            update_data["visible_en_chat"] = payload.visible_en_chat
        if payload.grupo_crm is not None:
            update_data["grupo_crm"] = payload.grupo_crm.strip()
        if payload.titulo_amigable is not None:
            update_data["titulo_amigable"] = payload.titulo_amigable.strip()
        if payload.descripcion is not None:
            update_data["descripcion"] = payload.descripcion.strip()
        if payload.orden is not None:
            update_data["orden"] = payload.orden

        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron campos para actualizar.")

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = supabase.table("whatsapp_templates").update(update_data).eq("name", name).execute()
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plantilla '{name}' no encontrada en la base de datos.")

        return {
            "status": "success",
            "message": f"Configuración de plantilla '{name}' actualizada correctamente.",
            "data": res.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Templates] Error al actualizar configuración de plantilla '{name}': {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@templates_router.post("/render-preview", status_code=status.HTTP_200_OK)
async def render_template_preview(req: RenderPreviewRequest):
    """
    Renderiza el texto de una plantilla reemplazando las variables posicionales {{1}}, {{2}}
    con datos clínicos de ejemplo o personalizados para la previsualización del teléfono en vivo.
    """
    sample_catalog = {
        "paciente_nombre": "Carlos Menéndez",
        "turno_fecha": "Jueves 15 de Octubre",
        "turno_hora": "11:30 hs",
        "medico_nombre": "Dra. Sofía Martínez",
        "practica_nombre": "Consulta Oftalmológica General",
        "quirofano_nombre": "Sede Central - Consultorio 4",
        "presupuesto_monto": "$ 45.000"
    }

    rendered_body = req.body_text
    mappings = req.variable_mappings or {}
    custom = req.custom_values or {}

    for var_idx in range(1, 10):
        key = str(var_idx)
        tag = f"{{{{{key}}}}}"
        if tag in rendered_body:
            mapped_field = mappings.get(key)
            replacement = custom.get(key) or sample_catalog.get(mapped_field, f"[Ejemplo {key}]")
            rendered_body = rendered_body.replace(tag, replacement)

    return {
        "rendered_body": rendered_body,
        "header_content": req.header_content,
        "footer_text": req.footer_text
    }


# ---------------------------------------------------------------------
# Catálogo y Registro Masivo de Plantillas de Seguimiento Quirúrgico
# ---------------------------------------------------------------------

SEGUIMIENTO_TEMPLATES_CATALOG = [
    {
        "name": "seguimiento_asesoramiento_t1",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Seguimiento Asistencial",
        "body_text": "Hola {{1}}, le escribimos desde el equipo quirurgico de Centrovision. Queríamos consultarle si le quedo alguna duda sobre la indicacion medica para {{2}} o si desea coordinar una fecha tentativa.",
        "footer_text": "Centrovision Oftalmologia",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Carlos", "Cirugia de Cataratas"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Quiero operarme"},
            {"type": "QUICK_REPLY", "text": "Tengo dudas"}
        ]
    },
    {
        "name": "seguimiento_asesoramiento_t2",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Estudios Prequirurgicos y Cobertura",
        "body_text": "Estimado/a {{1}}, esperamos que se encuentre muy bien. Respecto a su procedimiento de {{2}}, le recordamos que nuestro equipo puede asesorarlo con la gestion de estudios prequirurgicos y autorizaciones con su obra social. ¿Desea que lo asistamos?",
        "footer_text": "Centrovision Quirofano",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Carlos", "Cirugia de Cataratas"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Si, por favor"},
            {"type": "QUICK_REPLY", "text": "Lo veo mas adelante"}
        ]
    },
    {
        "name": "seguimiento_asesoramiento_t3",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Consulta de Estado Quirurgico",
        "body_text": "Hola {{1}}, desde Centrovision queremos saber como se encuentra respecto a su cirugia de {{2}}. Si aun esta evaluando los tiempos o prefiere que retomemos el contacto el proximo mes, haganoslo saber para acompanarlo cuando mejor le convenga.",
        "footer_text": "Centrovision Oftalmologia",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Carlos", "Cirugia de Cataratas"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Retomar ahora"},
            {"type": "QUICK_REPLY", "text": "Posponer 30 dias"}
        ]
    },
    {
        "name": "seguimiento_analisis_t1",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Presupuesto Quirurgico Formal",
        "body_text": "Hola {{1}}, nos comunicamos para confirmar si pudo abrir y revisar el presupuesto medico formal que le enviamos para {{2}}. Si tiene alguna consulta sobre los aranceles, insumos o formas de pago, estamos a su total disposicion.",
        "footer_text": "Centrovision Area Quirurgica",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Carlos", "Cirugia de Cataratas"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Pude revisarlo"},
            {"type": "QUICK_REPLY", "text": "Tengo dudas de pago"}
        ]
    },
    {
        "name": "seguimiento_analisis_t2",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Opciones de Financiacion y Cobertura",
        "body_text": "Estimado/a {{1}}, respecto a su cotizacion para {{2}}, le recordamos que disponemos de facilidades de pago en cuotas y orientacion personalizada para reintegros con su cobertura medica. ¿Desea que le acerquemos mas informacion?",
        "footer_text": "Centrovision Administracion",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Carlos", "Cirugia de Cataratas"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Consultar cuotas"},
            {"type": "QUICK_REPLY", "text": "Sigo analizando"}
        ]
    },
    {
        "name": "seguimiento_analisis_t3",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Aviso de Vigencia Arancelaria",
        "body_text": "Estimado/a {{1}}, le informamos que el presupuesto emitido para {{2}} se encuentra a 48 horas de cumplir su plazo de validez arancelaria de 15 dias. Si desea congelar el valor cotizado y reservar su fecha en quirofano antes del reajuste, avisenos con un clic.",
        "footer_text": "Centrovision Area Quirurgica",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Carlos", "Cirugia de Cataratas"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Congelar arancel"},
            {"type": "QUICK_REPLY", "text": "Pausar seguimiento"}
        ]
    },
    {
        "name": "seguimiento_analisis_t4",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Actualizacion de su Expediente",
        "body_text": "Hola {{1}}, nos comunicamos para consultarle si desea que mantengamos activa su propuesta para {{2}} o si prefiere posponerla para mas adelante. De no confirmar, dejaremos el caso en pausa para no importunarlo, quedando a su entera disposicion.",
        "footer_text": "Centrovision Oftalmologia",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Carlos", "Cirugia de Cataratas"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Mantener activa"},
            {"type": "QUICK_REPLY", "text": "Posponer por ahora"}
        ]
    }
]


@templates_router.post("/registrar-seguimiento", status_code=status.HTTP_200_OK)
async def registrar_plantillas_seguimiento_en_meta():
    """
    Registra el pack oficial de las 7 plantillas de seguimiento quirúrgico en Meta WhatsApp Cloud API
    y las sincroniza en la base de datos de Supabase.
    """
    waba_id, token = get_waba_credentials()
    if not waba_id or not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credenciales WABA (WABA ID o Access Token) no configuradas en el sistema."
        )

    resultados: List[Dict[str, Any]] = []

    for tpl_spec in SEGUIMIENTO_TEMPLATES_CATALOG:
        tpl_name = tpl_spec["name"]
        try:
            # 1. Comprobar si ya existe en Supabase
            exist_res = supabase.table("whatsapp_templates").select("id, status, meta_template_id").eq("name", tpl_name).execute()
            if exist_res.data and len(exist_res.data) > 0 and exist_res.data[0].get("meta_template_id"):
                resultados.append({
                    "name": tpl_name,
                    "status": exist_res.data[0].get("status", "EXISTS"),
                    "action": "ya_registrada",
                    "meta_id": exist_res.data[0].get("meta_template_id")
                })
                continue

            # 2. Construir componentes para Meta Graph API
            components: List[Dict[str, Any]] = [
                {
                    "type": "HEADER",
                    "format": "TEXT",
                    "text": clean_header_text(tpl_spec["header_content"])
                },
                {
                    "type": "BODY",
                    "text": tpl_spec["body_text"],
                    "example": {
                        "body_text": [tpl_spec["sample_values"]]
                    }
                },
                {
                    "type": "FOOTER",
                    "text": tpl_spec["footer_text"]
                },
                {
                    "type": "BUTTONS",
                    "buttons": [
                        {"type": b["type"], "text": b["text"]}
                        for b in tpl_spec["buttons"]
                    ]
                }
            ]

            meta_payload = {
                "name": tpl_name,
                "category": tpl_spec["category"],
                "language": "es_AR",
                "components": components
            }

            url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates"
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=meta_payload, headers={"Authorization": f"Bearer {token}"})

            meta_data = res.json() if res.content else {}
            
            if res.status_code in (200, 201):
                meta_id = meta_data.get("id")
                meta_status = meta_data.get("status", "PENDING")
                
                # Guardar en Supabase
                db_record = {
                    "waba_id": waba_id,
                    "meta_template_id": meta_id,
                    "name": tpl_name,
                    "category": tpl_spec["category"],
                    "language": "es_AR",
                    "status": meta_status,
                    "header_type": "TEXT",
                    "header_content": tpl_spec["header_content"],
                    "body_text": tpl_spec["body_text"],
                    "footer_text": tpl_spec["footer_text"],
                    "buttons": tpl_spec["buttons"],
                    "variable_mappings": tpl_spec["variable_mappings"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                supabase.table("whatsapp_templates").upsert(db_record, on_conflict="name").execute()

                resultados.append({
                    "name": tpl_name,
                    "status": meta_status,
                    "action": "creada_en_meta",
                    "meta_id": meta_id
                })
            else:
                error_msg = meta_data.get("error", {}).get("message", res.text)
                # Si ya existía en Meta pero no en DB local, intentar registrarla localmente
                if "already exists" in error_msg.lower():
                    db_record = {
                        "waba_id": waba_id,
                        "name": tpl_name,
                        "category": tpl_spec["category"],
                        "language": "es_AR",
                        "status": "APPROVED",
                        "header_type": "TEXT",
                        "header_content": tpl_spec["header_content"],
                        "body_text": tpl_spec["body_text"],
                        "footer_text": tpl_spec["footer_text"],
                        "buttons": tpl_spec["buttons"],
                        "variable_mappings": tpl_spec["variable_mappings"],
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    supabase.table("whatsapp_templates").upsert(db_record, on_conflict="name").execute()
                    resultados.append({
                        "name": tpl_name,
                        "status": "APPROVED",
                        "action": "ya_existia_en_meta_sincronizada_local",
                        "detail": "Ya existía en Meta. Se vinculó localmente."
                    })
                else:
                    resultados.append({
                        "name": tpl_name,
                        "status": "ERROR",
                        "action": "fallo_meta",
                        "detail": error_msg
                    })

        except Exception as e:
            logger.error(f"Error procesando plantilla {tpl_name}: {e}")
            resultados.append({
                "name": tpl_name,
                "status": "EXCEPTION",
                "action": "error_interno",
                "detail": str(e)
            })

    return {
        "status": "success",
        "total": len(SEGUIMIENTO_TEMPLATES_CATALOG),
        "resultados": resultados
    }


ESTUDIOS_TEMPLATES_CATALOG = [
    {
        "name": "entrega_estudio_oftalmologico_pdf",
        "category": "UTILITY",
        "header_type": "DOCUMENT",
        "header_content": None,
        "body_text": "Hola {{1}}, le adjuntamos en formato digital su estudio oftalmologico ({{2}}) realizado en Centrovision. Queda a su disposicion para descargar y presentar a su profesional medico.",
        "footer_text": "Centrovision Estudios Oftalmologicos",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Maria Lopez", "OCT Macular y Papilar"],
        "buttons": []
    },
    {
        "name": "entrega_estudio_oftalmologico_img",
        "category": "UTILITY",
        "header_type": "IMAGE",
        "header_content": None,
        "body_text": "Hola {{1}}, le compartimos en formato digital la imagen de su estudio oftalmologico ({{2}}) realizado en Centrovision.",
        "footer_text": "Centrovision Estudios Oftalmologicos",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Maria Lopez", "Retinografia Color"],
        "buttons": []
    },
    {
        "name": "entrega_estudio_oftalmologico_v1",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Entrega de Estudio Oftalmologico",
        "body_text": "Hola {{1}}, le informamos desde Centrovision que su estudio oftalmologico ({{2}}) ya se encuentra digitalizado y listo. Presione el boton a continuacion para recibir el archivo inmediatamente en este chat.",
        "footer_text": "Centrovision Estudios Oftalmologicos",
        "variable_mappings": {"1": "paciente_nombre", "2": "practica_nombre"},
        "sample_values": ["Maria Lopez", "Campo Visual Computarizado"],
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Recibir estudio"}
        ]
    }
]


@templates_router.post("/registrar-estudios", status_code=status.HTTP_200_OK)
async def registrar_plantillas_estudios_en_meta():
    """
    Registra las plantillas oficiales del módulo de Estudios Oftalmológicos (DOCUMENT, IMAGE y fallback interactivo)
    en Meta WhatsApp Cloud API y las sincroniza en la base de datos de Supabase.
    """
    waba_id, token = get_waba_credentials()
    if not waba_id or not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credenciales WABA (WABA ID o Access Token) no configuradas en el sistema."
        )

    resultados: List[Dict[str, Any]] = []

    for tpl_spec in ESTUDIOS_TEMPLATES_CATALOG:
        tpl_name = tpl_spec["name"]
        try:
            exist_res = supabase.table("whatsapp_templates").select("id, status, meta_template_id").eq("name", tpl_name).execute()
            if exist_res.data and len(exist_res.data) > 0 and exist_res.data[0].get("meta_template_id"):
                resultados.append({
                    "name": tpl_name,
                    "status": exist_res.data[0].get("status", "EXISTS"),
                    "action": "ya_registrada",
                    "meta_id": exist_res.data[0].get("meta_template_id")
                })
                continue

            components: List[Dict[str, Any]] = []
            h_type = tpl_spec["header_type"]
            if h_type == "TEXT" and tpl_spec.get("header_content"):
                components.append({
                    "type": "HEADER",
                    "format": "TEXT",
                    "text": clean_header_text(tpl_spec["header_content"])
                })
            elif h_type in ("DOCUMENT", "IMAGE"):
                handle = await _upload_sample_media_for_template_header(token, h_type)
                h_comp: Dict[str, Any] = {"type": "HEADER", "format": h_type}
                if handle:
                    h_comp["example"] = {"header_handle": [handle]}
                components.append(h_comp)

            components.append({
                "type": "BODY",
                "text": tpl_spec["body_text"],
                "example": {
                    "body_text": [tpl_spec["sample_values"]]
                }
            })

            if tpl_spec.get("footer_text"):
                components.append({
                    "type": "FOOTER",
                    "text": tpl_spec["footer_text"]
                })

            if tpl_spec.get("buttons"):
                components.append({
                    "type": "BUTTONS",
                    "buttons": [
                        {"type": b["type"], "text": b["text"]}
                        for b in tpl_spec["buttons"]
                    ]
                })

            meta_payload = {
                "name": tpl_name,
                "category": tpl_spec["category"],
                "language": "es_AR",
                "components": components
            }

            url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates"
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, json=meta_payload, headers={"Authorization": f"Bearer {token}"})

            meta_data = res.json() if res.content else {}

            if res.status_code in (200, 201):
                meta_id = meta_data.get("id")
                meta_status = meta_data.get("status", "PENDING")
                db_record = {
                    "waba_id": waba_id,
                    "meta_template_id": meta_id,
                    "name": tpl_name,
                    "category": tpl_spec["category"],
                    "language": "es_AR",
                    "status": meta_status,
                    "header_type": h_type,
                    "header_content": tpl_spec.get("header_content"),
                    "body_text": tpl_spec["body_text"],
                    "footer_text": tpl_spec["footer_text"],
                    "buttons": tpl_spec["buttons"],
                    "variable_mappings": tpl_spec["variable_mappings"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                supabase.table("whatsapp_templates").upsert(db_record, on_conflict="name").execute()
                resultados.append({
                    "name": tpl_name,
                    "status": meta_status,
                    "action": "creada_en_meta",
                    "meta_id": meta_id
                })
            else:
                error_msg = meta_data.get("error", {}).get("message", res.text)
                if "already exists" in error_msg.lower():
                    db_record = {
                        "waba_id": waba_id,
                        "name": tpl_name,
                        "category": tpl_spec["category"],
                        "language": "es_AR",
                        "status": "APPROVED",
                        "header_type": h_type,
                        "header_content": tpl_spec.get("header_content"),
                        "body_text": tpl_spec["body_text"],
                        "footer_text": tpl_spec["footer_text"],
                        "buttons": tpl_spec["buttons"],
                        "variable_mappings": tpl_spec["variable_mappings"],
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    supabase.table("whatsapp_templates").upsert(db_record, on_conflict="name").execute()
                    resultados.append({
                        "name": tpl_name,
                        "status": "APPROVED",
                        "action": "ya_existia_en_meta_sincronizada_local",
                        "detail": "Ya existía en Meta. Se vinculó localmente."
                    })
                else:
                    resultados.append({
                        "name": tpl_name,
                        "status": "ERROR",
                        "action": "fallo_meta",
                        "detail": error_msg
                    })
        except Exception as e:
            logger.error(f"Error procesando plantilla de estudio {tpl_name}: {e}")
            resultados.append({
                "name": tpl_name,
                "status": "EXCEPTION",
                "action": "error_interno",
                "detail": str(e)
            })

    return {
        "status": "success",
        "total": len(ESTUDIOS_TEMPLATES_CATALOG),
        "resultados": resultados
    }

