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
async def list_templates(category: Optional[str] = None, status_filter: Optional[str] = None):
    """
    Obtiene el listado de plantillas registradas en la base de datos de MedCRM.
    """
    try:
        query = supabase.table("whatsapp_templates").select("*").order("created_at", desc=True)
        if category:
            query = query.eq("category", category.upper())
        if status_filter:
            query = query.eq("status", status_filter.upper())
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

        try:
            exist_check = supabase.table("whatsapp_templates").select("id, variable_mappings").eq("name", tpl_name).execute()
            if exist_check.data and len(exist_check.data) > 0:
                supabase.table("whatsapp_templates").update(tpl_record).eq("name", tpl_name).execute()
            else:
                tpl_record["created_at"] = datetime.now(timezone.utc).isoformat()
                tpl_record["variable_mappings"] = {}
                supabase.table("whatsapp_templates").insert(tpl_record).execute()
            synced_count += 1
        except Exception as up_err:
            logger.warning(f"[Templates Sync] Error guardando {tpl_name}: {up_err}")

    return {
        "status": "success",
        "synced_count": synced_count,
        "message": f"Se sincronizaron {synced_count} plantillas correctamente desde Meta."
    }


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
