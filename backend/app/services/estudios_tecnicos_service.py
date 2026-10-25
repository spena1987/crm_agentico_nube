"""
Servicio y Router para el Módulo de Estudios Oftalmológicos (Técnicos) y Gestión Multi-Línea de WhatsApp Cloud API.
Garantiza:
  1. Separación física de canales: Opera exclusivamente sobre la Línea 2 (Estudios Oftalmológicos) dentro de la misma WABA.
  2. Cero almacenamiento en Supabase Storage (0 bytes): El archivo viaja en memoria RAM hacia Geclisa On-Premise
     (/api/Archivo/adjuntar-archivo-historia-clinica) y hacia el repositorio efímero de Meta Graph API (/{phone_id}/media).
  3. Cero creación de pacientes fantasma ni conversaciones en la bandeja de asesores quirúrgicos.
"""

import io
import os
import re
import asyncio
import logging
from datetime import datetime, date, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Body, Request
from pydantic import BaseModel

from app.db import supabase, get_paciente_by_dni, get_paciente_by_geclisa_id
from app.services.geclisa_client import GeclisaClient
from app.services.caratula_estudios_service import get_argentina_now, ARGENTINA_TZ
from app.services.phone_normalizer import normalize_phone_number, format_phone_display
from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164
from app.services.whatsapp_cloud.client import (
    WhatsAppCloudClient,
    get_whatsapp_waba_id,
    get_whatsapp_cloud_credentials,
    get_whatsapp_estudios_credentials,
    get_whatsapp_estudios_config,
    invalidate_whatsapp_credentials_cache,
    MetaAPIError
)
from app.services.logger_service import log_event

logger = logging.getLogger("estudios_tecnicos_service")

estudios_router = APIRouter(tags=["Estudios Oftalmológicos & Multi-Línea WhatsApp"])
geclisa_client = GeclisaClient()


# =========================================================================
# SCHEMAS PYDANTIC PARA CONFIGURACIÓN MULTI-LÍNEA
# =========================================================================

class UpdateWhatsAppLinesPayload(BaseModel):
    estudios_phone_number_id: Optional[str] = ""
    estudios_display_phone: Optional[str] = ""
    estudios_verified_name: Optional[str] = "Centrovisión Estudios"
    estudios_template_pdf: Optional[str] = "entrega_estudio_oftalmologico_pdf"
    estudios_template_img: Optional[str] = "entrega_estudio_oftalmologico_img"
    estudios_auto_reply_enabled: Optional[bool] = True
    estudios_derivacion_telefono: Optional[str] = ""
    estudios_auto_reply_text: Optional[str] = None


class LinkPhoneNumberPayload(BaseModel):
    telefono: Optional[str] = None
    phone_number: Optional[str] = None
    verified_name: Optional[str] = "Centrovisión - Estudios Oftalmológicos"
    derivacion_telefono: Optional[str] = None


class RequestVerificationCodePayload(BaseModel):
    phone_number_id: Optional[str] = None
    code_method: str = "SMS"  # "SMS" | "VOICE"
    language: str = "es_AR"


class VerifyCodePayload(BaseModel):
    phone_number_id: Optional[str] = None
    code: str
    pin: Optional[str] = None


class RegisterLinePinPayload(BaseModel):
    line: str = "estudios"  # "estudios" | "quirurgico"
    phone_number_id: Optional[str] = None
    pin: str


class SendTestLinePayload(BaseModel):
    line: str = "estudios"  # "estudios" | "quirurgico"
    telefono: str
    mensaje: Optional[str] = "¡Hola! Mensaje de prueba desde la línea de Estudios Oftalmológicos de Centrovisión. 👁️"


class EnviarExistenteGeclisaPayload(BaseModel):
    geclisa_as_id: int
    geclisa_ficha_id: int
    geclisa_pac_id: Optional[int] = None
    dni_paciente: str
    nombre_paciente: str
    telefono: str
    tipo_estudio: str
    ojo: str = "AO"
    nombre_archivo: Optional[str] = None
    observaciones: Optional[str] = ""
    usuario_id: Optional[str] = None
    usuario_nombre: Optional[str] = None
    tecnico_pre_id: Optional[int] = None
    plantilla_whatsapp: Optional[str] = None


class ReintentarWhatsAppEstudioPayload(BaseModel):
    telefono: Optional[str] = None
    plantilla_whatsapp: Optional[str] = None


# =========================================================================
# HELPERS DE PROCESAMIENTO EN MEMORIA RAM (OPTIMIZACIÓN / PDF UNIFICADO)
# =========================================================================

def _consolidate_or_optimize_files_in_ram(
    files_data: List[Tuple[str, bytes, str]],
    unificar_en_pdf: bool,
    base_filename: str
) -> Tuple[bytes, str, str]:
    """
    Procesa en memoria RAM el/los archivos subidos por el técnico:
      - Si se subieron múltiples imágenes (ej. OD + OI) o `unificar_en_pdf=True` con imágenes,
        las convierte y unifica en un único archivo PDF multipágina de alta nitidez.
      - Si es una sola imagen JPG/PNG > 4.8 MB (límite de Meta = 5 MB), la optimiza automáticamente
        en RAM con Pillow para evitar rechazos de Meta Graph API (Error 131052).
      - Retorna (final_bytes, final_filename, final_mime_type).
    """
    if not files_data:
        raise ValueError("No se recibieron archivos para procesar.")

    # Caso 1: Un único archivo PDF
    if len(files_data) == 1 and files_data[0][2] == "application/pdf":
        fname, fbytes, fmime = files_data[0]
        safe_fname = base_filename if base_filename else fname
        if not safe_fname.lower().endswith(".pdf"):
            safe_fname = f"{safe_fname}.pdf"
        return fbytes, safe_fname, "application/pdf"

    # Caso 2: Múltiples imágenes o solicitud expresa de unificar imágenes en un único PDF
    all_images = all(m.startswith("image/") for _, _, m in files_data)
    if all_images and (len(files_data) > 1 or unificar_en_pdf):
        from PIL import Image, ImageOps
        pil_pages: List[Image.Image] = []
        for _, raw_bytes, _ in files_data:
            img = Image.open(io.BytesIO(raw_bytes))
            img = ImageOps.exif_transpose(img) or img
            if img.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                bg.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
            # Limitar dimensión máxima a 2400px para mantener el PDF liviano y nítido
            max_dim = 2400
            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            pil_pages.append(img)

        out_pdf = io.BytesIO()
        first_page = pil_pages[0]
        rest_pages = pil_pages[1:]
        first_page.save(
            out_pdf,
            format="PDF",
            resolution=150.0,
            save_all=True,
            append_images=rest_pages
        )
        safe_pdf_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base_filename)
        if not safe_pdf_name.lower().endswith(".pdf"):
            safe_pdf_name = f"{safe_pdf_name}.pdf"
        return out_pdf.getvalue(), safe_pdf_name, "application/pdf"

    # Caso 3: Una sola imagen (JPG/PNG)
    fname, fbytes, fmime = files_data[0]
    if fmime.startswith("image/"):
        # Meta exige < 5 MB para imágenes y no admite ciertos canales alfa corruptos
        max_meta_img_bytes = int(4.7 * 1024 * 1024)
        if len(fbytes) > max_meta_img_bytes:
            from PIL import Image, ImageOps
            img = Image.open(io.BytesIO(fbytes))
            img = ImageOps.exif_transpose(img) or img
            if img.mode != "RGB":
                img = img.convert("RGB")
            max_dim = 2200
            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            out_jpg = io.BytesIO()
            img.save(out_jpg, format="JPEG", quality=85, optimize=True)
            fbytes = out_jpg.getvalue()
            fmime = "image/jpeg"

        ext = ".jpg" if fmime == "image/jpeg" or fname.lower().endswith((".jpg", ".jpeg")) else ".png"
        safe_img_name = base_filename if base_filename else os.path.splitext(fname)[0]
        if not safe_img_name.lower().endswith(ext):
            safe_img_name = f"{safe_img_name}{ext}"
        return fbytes, safe_img_name, fmime

    return fbytes, fname, fmime


def _resolve_tecnico_credentials(
    usuario_id: Optional[str],
    tecnico_pre_id: Optional[int],
    usuario_nombre: Optional[str]
) -> Tuple[Optional[int], str]:
    """
    Obtiene el `geclisa_pre_id` y el nombre del técnico desde `public.usuarios_perfil`
    si no vinieron explícitamente en el request.
    """
    resolved_pre_id = tecnico_pre_id
    resolved_name = (usuario_nombre or "").strip()

    if usuario_id and supabase and (not resolved_pre_id or not resolved_name):
        try:
            u_res = (
                supabase.table("usuarios_perfil")
                .select("nombre_completo, geclisa_pre_id, geclisa_prestador_nombre")
                .eq("id", usuario_id)
                .limit(1)
                .execute()
            )
            if u_res.data and len(u_res.data) > 0:
                row = u_res.data[0]
                if not resolved_pre_id and row.get("geclisa_pre_id"):
                    resolved_pre_id = int(row["geclisa_pre_id"])
                if not resolved_name:
                    resolved_name = row.get("nombre_completo") or row.get("geclisa_prestador_nombre") or "Técnico Oftalmólogo"
        except Exception as e:
            logger.warning(f"[Estudios] No se pudo consultar usuarios_perfil para {usuario_id}: {e}")

    return resolved_pre_id, (resolved_name or "Técnico Oftalmólogo")


async def _dispatch_study_via_meta_line2(
    to_phone: str,
    nombre_paciente: str,
    titulo_estudio: str,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    template_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sube el binario desde RAM al endpoint `/media` del `phone_number_id` de Estudios Oftalmológicos (Línea 2)
    y envía el estudio al paciente por WhatsApp:
      1. Intenta enviar la plantilla elegida por el técnico o la predeterminada (`entrega_estudio_oftalmologico_pdf` / `img`).
      2. Si la plantilla con Header Multimedia aún está en estado `PENDING` en Meta o no existe,
         intenta usar la plantilla interactiva `entrega_estudio_oftalmologico_v1` (con botón `[Recibir estudio]`)
         o envío directo si la ventana de 24h con la Línea 2 ya está abierta.
    """
    est_phone_id, est_token = get_whatsapp_estudios_credentials()
    cfg = get_whatsapp_estudios_config()

    if not est_phone_id:
        raise ValueError(
            "La Línea 2 de WhatsApp (Estudios Oftalmológicos) aún no tiene configurado su Phone Number ID. "
            "Ingréselo en Ajustes > WhatsApp Cloud API > Línea 2: Estudios Oftalmológicos."
        )
    if not est_token:
        raise ValueError("No se encontró el System User Access Token de Meta WhatsApp Cloud API.")

    normalized_to = normalize_to_meta_e164(normalize_phone_number(to_phone))
    wa_client = WhatsAppCloudClient(phone_number_id=est_phone_id, access_token=est_token, line="estudios")

    try:
        # 1. Subir binario a Meta Graph API asociado al phone_number_id de Estudios (0 bytes en Supabase Storage)
        media_id = await wa_client.upload_media_bytes(
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type
        )

        is_image = mime_type.startswith("image/")
        default_tpl = (
            cfg.get("estudios_template_img") or "entrega_estudio_oftalmologico_img"
            if is_image
            else cfg.get("estudios_template_pdf") or "entrega_estudio_oftalmologico_pdf"
        )

        is_override = bool(
            template_override
            and str(template_override).strip()
            and str(template_override).strip().lower() != "auto"
        )
        primary_tpl = str(template_override).strip() if is_override else default_tpl

        tpl_lang = "es_AR"
        header_type = "IMAGE" if is_image else "DOCUMENT"
        try:
            if supabase:
                t_res = (
                    supabase.table("whatsapp_templates")
                    .select("language, status, header_type")
                    .eq("name", primary_tpl)
                    .limit(1)
                    .execute()
                )
                if t_res.data and len(t_res.data) > 0:
                    tpl_lang = t_res.data[0].get("language") or "es_AR"
                    h_val = str(t_res.data[0].get("header_type") or "").upper()
                    if h_val:
                        header_type = h_val
        except Exception:
            pass

        # PREVENCIÓN ESTRICTA DE ERROR 131053 (Media upload error / type mismatch):
        # Si el archivo es PDF pero la plantilla seleccionada exige IMAGE (o viceversa),
        # corregir automáticamente a la plantilla oficial correspondiente para evitar el rechazo de Meta.
        if is_image and header_type == "DOCUMENT":
            logger.info(f"[Estudios WA] Archivo es imagen ({mime_type}) pero plantilla '{primary_tpl}' pide DOCUMENT. Ajustando a plantilla de imagen.")
            primary_tpl = cfg.get("estudios_template_img") or "entrega_estudio_oftalmologico_img"
            header_type = "IMAGE"
        elif not is_image and header_type == "IMAGE":
            logger.info(f"[Estudios WA] Archivo es PDF ({mime_type}) pero plantilla '{primary_tpl}' pide IMAGE. Ajustando a plantilla de documento PDF.")
            primary_tpl = cfg.get("estudios_template_pdf") or "entrega_estudio_oftalmologico_pdf"
            header_type = "DOCUMENT"

        components: List[Dict[str, Any]] = []
        if header_type in ("DOCUMENT", "IMAGE"):
            if header_type == "IMAGE":
                h_param: Dict[str, Any] = {"type": "image", "image": {"id": media_id}}
            else:
                h_param = {"type": "document", "document": {"id": media_id, "filename": filename}}
            components.append({"type": "header", "parameters": [h_param]})

        components.append({
            "type": "body",
            "parameters": [
                {"type": "text", "text": nombre_paciente or "Paciente"},
                {"type": "text", "text": titulo_estudio or "Estudio Oftalmológico"}
            ]
        })

        try:
            send_res = await wa_client.send_template(
                to_phone=normalized_to,
                template_name=primary_tpl,
                language_code=tpl_lang,
                components=components
            )
            return {
                "success": True,
                "wamid": send_res.get("wamid"),
                "media_id": media_id,
                "template_used": primary_tpl,
                "delivery_mode": "template_direct_media" if header_type in ("DOCUMENT", "IMAGE") else "template_text",
                "to_phone": normalized_to
            }
        except Exception as tpl_err:
            logger.warning(f"[Estudios WhatsApp] Plantilla {primary_tpl} rechazó el envío ({tpl_err}). Probando fallback...")

            if is_override and primary_tpl != default_tpl:
                try:
                    def_header = {"type": "image", "image": {"id": media_id}} if is_image else {"type": "document", "document": {"id": media_id, "filename": filename}}
                    def_res = await wa_client.send_template(
                        to_phone=normalized_to,
                        template_name=default_tpl,
                        language_code="es_AR",
                        components=[
                            {"type": "header", "parameters": [def_header]},
                            {"type": "body", "parameters": [{"type": "text", "text": nombre_paciente or "Paciente"}, {"type": "text", "text": titulo_estudio or "Estudio Oftalmológico"}]}
                        ]
                    )
                    return {
                        "success": True,
                        "wamid": def_res.get("wamid"),
                        "media_id": media_id,
                        "template_used": default_tpl,
                        "delivery_mode": "template_direct_media",
                        "to_phone": normalized_to
                    }
                except Exception:
                    pass

            try:
                fb_res = await wa_client.send_template(
                    to_phone=normalized_to,
                    template_name="entrega_estudio_oftalmologico_v1",
                    language_code="es_AR",
                    components=[
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": nombre_paciente or "Paciente"},
                                {"type": "text", "text": titulo_estudio or "Estudio Oftalmológico"}
                            ]
                        }
                    ]
                )
                return {
                    "success": True,
                    "wamid": fb_res.get("wamid"),
                    "media_id": media_id,
                    "template_used": "entrega_estudio_oftalmologico_v1",
                    "delivery_mode": "template_quick_reply_2step",
                    "to_phone": normalized_to
                }
            except Exception:
                pass

            caption = (
                f"🏥 *Centrovisión - Estudios Oftalmológicos*\n\n"
                f"Hola *{nombre_paciente}*, le adjuntamos su estudio digital: *{titulo_estudio}*."
            )
            if is_image:
                direct_res = await wa_client.send_image_by_id(
                    to_phone=normalized_to,
                    media_id=media_id,
                    caption=caption
                )
            else:
                direct_res = await wa_client.send_document_by_id(
                    to_phone=normalized_to,
                    media_id=media_id,
                    filename=filename,
                    caption=caption
                )
            return {
                "success": True,
                "wamid": direct_res.get("wamid"),
                "media_id": media_id,
                "template_used": "direct_24h_window",
                "delivery_mode": "direct_media",
                "to_phone": normalized_to
            }
    finally:
        await wa_client.close()


# =========================================================================
# ENDPOINTS DE CONFIGURACIÓN MULTI-LÍNEA (LÍNEA 1 QUIRÚRGICA + LÍNEA 2 ESTUDIOS)
# =========================================================================

def _persist_whatsapp_lineas_config(new_cfg: Dict[str, Any]) -> None:
    """Guarda el diccionario `whatsapp_lineas` en `public.configuracion_sistema` e invalida la caché."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos Supabase no disponible.")
    exist = supabase.table("configuracion_sistema").select("clave").eq("clave", "whatsapp_lineas").execute()
    if exist.data and len(exist.data) > 0:
        supabase.table("configuracion_sistema").update({
            "valor": new_cfg,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("clave", "whatsapp_lineas").execute()
    else:
        supabase.table("configuracion_sistema").insert({
            "clave": "whatsapp_lineas",
            "valor": new_cfg,
            "descripcion": "Configuración multi-línea de WhatsApp Cloud API (Línea 2: Estudios Oftalmológicos)"
        }).execute()
    invalidate_whatsapp_credentials_cache()


@estudios_router.get("/api/whatsapp/estudios-templates")
async def get_estudios_whatsapp_templates():
    """
    Lista las plantillas disponibles para entrega de estudios oftalmológicos,
    incluyendo las configuradas actualmente como predeterminadas (PDF e Imagen).
    """
    cfg = get_whatsapp_estudios_config()
    default_pdf = cfg.get("estudios_template_pdf") or "entrega_estudio_oftalmologico_pdf"
    default_img = cfg.get("estudios_template_img") or "entrega_estudio_oftalmologico_img"

    templates = []
    if supabase:
        try:
            res = (
                supabase.table("whatsapp_templates")
                .select("id, name, header_type, body_text, status, category, buttons, header_content, grupo_crm, titulo_amigable")
                .order("name")
                .execute()
            )
            raw = res.data or []
            for t in raw:
                if str(t.get("status") or "").upper() != "APPROVED":
                    continue
                n = str(t.get("name") or "").lower()
                cat = str(t.get("category") or "").lower()
                grupo = str(t.get("grupo_crm") or "").lower()
                if "estudio" in n or "estudio" in grupo or cat == "entrega_estudios":
                    templates.append(t)
        except Exception as e:
            logger.warning(f"Error consultando whatsapp_templates: {e}")

    if not templates:
        from app.services.whatsapp_cloud.templates import ESTUDIOS_TEMPLATES_CATALOG
        templates = [
            {
                "name": item["name"],
                "header_type": item["header_type"],
                "body_text": item["body_text"],
                "status": "APPROVED",
                "category": "UTILITY",
                "buttons": item.get("buttons", []),
                "header_content": item.get("header_content")
            }
            for item in ESTUDIOS_TEMPLATES_CATALOG
        ]

    return {
        "success": True,
        "default_pdf": default_pdf,
        "default_img": default_img,
        "templates": templates
    }


@estudios_router.get("/api/whatsapp/lines")
async def get_whatsapp_lines_status():
    """
    Consulta en vivo el estado y la salud en Meta Graph API de las 2 líneas de WhatsApp:
      - Línea 1: Asesoramiento Quirúrgico & Turnos (Principal)
      - Línea 2: Unidad de Estudios Oftalmológicos (Exclusiva Técnicos)
    Además devuelve los números registrados actualmente en el portafolio WABA.
    """
    q_phone_id, token = get_whatsapp_cloud_credentials()
    waba_id = get_whatsapp_waba_id()
    est_cfg = get_whatsapp_estudios_config()
    est_phone_id = str(est_cfg.get("estudios_phone_number_id") or "").strip() or None

    async def _fetch_line_health(pid: Optional[str], line_key: str) -> Dict[str, Any]:
        if not pid or not token:
            return {
                "configured": False,
                "connected": False,
                "phone_number_id": pid,
                "status": "NOT_CONFIGURED"
            }
        client = WhatsAppCloudClient(phone_number_id=pid, access_token=token, line=line_key)
        try:
            det = await client.get_phone_number_details()
            if det and (det.get("display_phone_number") or det.get("verified_name")):
                acc_status = (det.get("status") or "CONNECTED").upper()
                verif_status = (det.get("code_verification_status") or "").upper()
                is_connected = acc_status == "CONNECTED" and verif_status != "NOT_VERIFIED"
                return {
                    "configured": True,
                    "connected": is_connected,
                    "requires_otp": verif_status == "NOT_VERIFIED",
                    "requires_pin_register": verif_status in ("VERIFIED", "EXPIRED") and acc_status != "CONNECTED",
                    "phone_number_id": pid,
                    "display_phone_number": det.get("display_phone_number"),
                    "verified_name": det.get("verified_name"),
                    "quality_rating": det.get("quality_rating") or "GREEN",
                    "messaging_limit_tier": det.get("messaging_limit_tier") or "TIER_250",
                    "code_verification_status": verif_status or "VERIFIED",
                    "account_status": acc_status
                }
            return {
                "configured": True,
                "connected": False,
                "phone_number_id": pid,
                "status": "PENDING_REGISTRATION_OR_INVALID_ID"
            }
        except Exception as e:
            return {
                "configured": True,
                "connected": False,
                "phone_number_id": pid,
                "error": str(e)
            }
        finally:
            await client.close()

    async def _fetch_waba_numbers() -> List[Dict[str, Any]]:
        if not waba_id or not token:
            return []
        try:
            return await WhatsAppCloudClient.list_waba_phone_numbers(waba_id, token)
        except Exception:
            return []

    linea_quirurgica, linea_estudios, waba_numbers = await asyncio.gather(
        _fetch_line_health(q_phone_id, "quirurgico"),
        _fetch_line_health(est_phone_id, "estudios"),
        _fetch_waba_numbers()
    )

    q_display_norm = normalize_phone_number(linea_quirurgica.get("display_phone_number") or "")

    # Auto-corrección UX: Si el usuario colocó por error el teléfono de la Línea 2 en 'estudios_derivacion_telefono'
    # y dejó 'estudios_display_phone' vacío, migrarlo automáticamente al campo correcto.
    deriv_actual = normalize_phone_number(est_cfg.get("estudios_derivacion_telefono") or "")
    disp_actual = normalize_phone_number(est_cfg.get("estudios_display_phone") or "")
    if not disp_actual and deriv_actual and q_display_norm and deriv_actual[-10:] != q_display_norm[-10:]:
        est_cfg["estudios_display_phone"] = deriv_actual
        est_cfg["estudios_derivacion_telefono"] = q_display_norm
        disp_actual = deriv_actual

    # Si no teníamos teléfono de derivación configurado en Línea 2, usar el de la Línea 1 (Quirúrgica/Recepción)
    if not est_cfg.get("estudios_derivacion_telefono") and q_display_norm:
        est_cfg["estudios_derivacion_telefono"] = q_display_norm

    # Si el Phone ID guardado ya no existe en la WABA (ej. fue eliminado en Meta) y aún no está conectado, limpiar el ID obsoleto
    waba_ids = {str(n.get("id")) for n in (waba_numbers or []) if n.get("id")}
    if est_phone_id and waba_ids and est_phone_id not in waba_ids and not linea_estudios.get("connected"):
        # Buscar si el teléfono de estudios ya figura en la WABA bajo un nuevo Phone ID
        matched_id = None
        if disp_actual and len(disp_actual) >= 8:
            last10 = disp_actual[-10:]
            for n in waba_numbers:
                n_digits = "".join(filter(str.isdigit, str(n.get("display_phone_number") or "")))
                if n_digits.endswith(last10) and str(n.get("id")) != str(q_phone_id):
                    matched_id = str(n.get("id"))
                    break
        est_cfg["estudios_phone_number_id"] = matched_id or ""
        linea_estudios["phone_number_id"] = matched_id
        linea_estudios["configured"] = bool(matched_id)
        linea_estudios["status"] = "NOT_CONFIGURED" if not matched_id else linea_estudios.get("status")

    return {
        "success": True,
        "waba_id": waba_id,
        "waba_numbers": waba_numbers,
        "linea_quirurgica": linea_quirurgica,
        "linea_estudios": {
            **linea_estudios,
            "config": est_cfg
        }
    }


@estudios_router.post("/api/whatsapp/link-phone-number")
async def link_estudios_phone_number_in_waba(payload: LinkPhoneNumberPayload):
    """
    Vincula un número de teléfono (ej: `5492615739990`) a la Línea 2 (Estudios Oftalmológicos) sin
    requerir que el usuario conozca el `Phone Number ID`:
      1. Consulta el portafolio de la WABA (`GET /v21.0/{waba_id}/phone_numbers`). Si el número ya existe,
         toma su `Phone Number ID` automáticamente.
      2. Si el número no existe aún en la WABA, lo da de alta vía `POST /v21.0/{waba_id}/phone_numbers`
         con `cc='54'`, obtiene el nuevo `Phone Number ID` asignado por Meta y lo guarda en `configuracion_sistema`.
    """
    q_phone_id, token = get_whatsapp_cloud_credentials()
    waba_id = get_whatsapp_waba_id()
    if not token or not waba_id:
        raise HTTPException(
            status_code=400,
            detail="No se encontraron credenciales activas de WABA o Access Token en el servidor."
        )

    raw_input_phone = payload.telefono or payload.phone_number or ""
    raw_digits = "".join(filter(str.isdigit, str(raw_input_phone)))
    if len(raw_digits) < 10:
        raise HTTPException(
            status_code=400,
            detail="Ingresa un número de teléfono válido con código de área (ej: 2615739990 o 5492615739990)."
        )

    norm_tel = normalize_phone_number(raw_digits)
    last_10 = raw_digits[-10:]
    verified_name = (payload.verified_name or "Centrovisión - Estudios Oftalmológicos").strip()

    # Verificar que no sea el mismo número de la Línea 1 Quirúrgica
    waba_numbers = await WhatsAppCloudClient.list_waba_phone_numbers(waba_id, token)
    for item in waba_numbers:
        item_digits = "".join(filter(str.isdigit, str(item.get("display_phone_number") or "")))
        if item_digits.endswith(last_10) and str(item.get("id")) == str(q_phone_id):
            raise HTTPException(
                status_code=400,
                detail="Ese número de teléfono corresponde a la Línea 1 (Asesoramiento Quirúrgico). Ingresa el número exclusivo de Estudios Oftalmológicos."
            )

    # 1. Buscar si ya está dado de alta en la WABA
    resolved_phone_id = None
    action_taken = "found_in_waba"
    for item in waba_numbers:
        item_digits = "".join(filter(str.isdigit, str(item.get("display_phone_number") or "")))
        if item_digits.endswith(last_10):
            resolved_phone_id = str(item.get("id"))
            if item.get("verified_name"):
                verified_name = item["verified_name"]
            break

    # 2. Si no existe en la WABA, darlo de alta programáticamente en Meta Graph API
    if not resolved_phone_id:
        action_taken = "created_in_waba"
        try:
            # En Argentina Meta utiliza cc="54" y phone_number="9" + 10 dígitos (ej: 92615739990)
            add_res = await WhatsAppCloudClient.add_phone_number_to_waba(
                waba_id=waba_id,
                access_token=token,
                cc="54",
                phone_number=f"9{last_10}",
                verified_name=verified_name
            )
            resolved_phone_id = str(add_res.get("id") or "").strip()
        except MetaAPIError as me_err:
            # Fallback sin el prefijo 9 por si Meta requiere 10 dígitos nacionales directos
            try:
                add_res = await WhatsAppCloudClient.add_phone_number_to_waba(
                    waba_id=waba_id,
                    access_token=token,
                    cc="54",
                    phone_number=last_10,
                    verified_name=verified_name
                )
                resolved_phone_id = str(add_res.get("id") or "").strip()
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail=f"Meta rechazó el alta del número {format_phone_display(norm_tel)} en la WABA: {me_err.message}"
                )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo agregar el número a la WABA en Meta: {str(e)}"
            )

    if not resolved_phone_id:
        raise HTTPException(
            status_code=400,
            detail="Meta no devolvió un Phone Number ID para el número ingresado."
        )

    # 3. Guardar automáticamente en configuracion_sistema
    current_cfg = get_whatsapp_estudios_config()
    deriv_tel = (payload.derivacion_telefono or current_cfg.get("estudios_derivacion_telefono") or "").strip()
    deriv_digits = "".join(filter(str.isdigit, deriv_tel))
    if not deriv_digits or deriv_digits.endswith(last_10):
        # Usar por defecto el teléfono de la Línea 1 para derivación de consultas
        for item in waba_numbers:
            if str(item.get("id")) == str(q_phone_id) and item.get("display_phone_number"):
                deriv_tel = normalize_phone_number(item["display_phone_number"])
                break

    new_cfg = {
        **current_cfg,
        "estudios_phone_number_id": resolved_phone_id,
        "estudios_display_phone": norm_tel,
        "estudios_verified_name": verified_name,
        "estudios_derivacion_telefono": deriv_tel or "5492616859303"
    }
    _persist_whatsapp_lineas_config(new_cfg)

    log_event(
        nivel="INFO",
        modulo="WHATSAPP",
        accion="VINCULAR_NUMERO_LINEA_ESTUDIOS",
        mensaje=f"Número {norm_tel} vinculado a Línea 2 (Estudios) con Phone ID {resolved_phone_id} ({action_taken}).",
        detalles={"phone_number_id": resolved_phone_id, "telefono": norm_tel, "action": action_taken}
    )

    status_payload = await get_whatsapp_lines_status()
    return {
        **status_payload,
        "action": action_taken,
        "phone_number_id": resolved_phone_id,
        "linked_phone_number_id": resolved_phone_id,
        "linked_display_phone": norm_tel,
        "mensaje": (
            f"¡Número {format_phone_display(norm_tel)} encontrado en tu WABA y vinculado con ID {resolved_phone_id}! Haz clic en 'Enviar Código por SMS' para verificarlo."
            if action_taken == "found_in_waba"
            else f"¡Número {format_phone_display(norm_tel)} dado de alta en Meta WABA con ID {resolved_phone_id}! Ahora solicita el código SMS/llamada para verificarlo."
        )
    }


@estudios_router.post("/api/whatsapp/request-verification-code")
async def request_meta_otp_verification_code(payload: RequestVerificationCodePayload):
    """
    Solicita a Meta el envío del código de 6 dígitos por SMS o llamada de voz (`VOICE`)
    al número físico de la Línea 2 (`POST /v21.0/{phone_number_id}/request_code`).
    """
    _, token = get_whatsapp_cloud_credentials()
    if not token:
        raise HTTPException(status_code=400, detail="Access Token de Meta no configurado.")

    target_phone_id = (payload.phone_number_id or "").strip()
    if not target_phone_id:
        target_phone_id, _ = get_whatsapp_estudios_credentials()
    if not target_phone_id:
        raise HTTPException(
            status_code=400,
            detail="Primero vincula el número de teléfono para obtener su Phone Number ID."
        )

    client = WhatsAppCloudClient(phone_number_id=target_phone_id, access_token=token, line="estudios")
    try:
        res = await client.request_verification_code(
            code_method=payload.code_method,
            language=payload.language or "es_AR"
        )
        log_event(
            nivel="INFO",
            modulo="WHATSAPP",
            accion="SOLICITAR_CODIGO_OTP_META",
            mensaje=f"Código de verificación ({payload.code_method}) solicitado a Meta para Phone ID {target_phone_id}.",
            detalles={"phone_number_id": target_phone_id, "method": payload.code_method, "response": res}
        )
        return {
            "success": True,
            "mensaje": f"Meta envió el código de 6 dígitos por {payload.code_method} al teléfono de Estudios. Ingrésalo en el Paso 2.",
            "meta_response": res
        }
    except MetaAPIError as me:
        raise HTTPException(status_code=400, detail=f"Meta rechazó el envío del código: {me.message}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


@estudios_router.post("/api/whatsapp/verify-code")
async def verify_meta_otp_code(payload: VerifyCodePayload):
    """
    Verifica el código OTP de 6 dígitos recibido por SMS o llamada (`POST /v21.0/{phone_number_id}/verify_code`).
    Si además se envía el `pin` de 6 dígitos, registra y activa inmediatamente el número en Cloud API (`/register`).
    """
    _, token = get_whatsapp_cloud_credentials()
    waba_id = get_whatsapp_waba_id()
    if not token:
        raise HTTPException(status_code=400, detail="Access Token de Meta no configurado.")

    target_phone_id = (payload.phone_number_id or "").strip()
    if not target_phone_id:
        target_phone_id, _ = get_whatsapp_estudios_credentials()
    if not target_phone_id:
        raise HTTPException(status_code=400, detail="Falta el Phone Number ID del número a verificar.")

    client = WhatsAppCloudClient(phone_number_id=target_phone_id, access_token=token, line="estudios")
    try:
        verify_res = await client.verify_code(payload.code)
        registered = False
        reg_res = None

        if payload.pin and len("".join(filter(str.isdigit, payload.pin))) == 6:
            reg_res = await client.register_phone_number(payload.pin)
            registered = True
            if waba_id:
                await WhatsAppCloudClient.subscribe_waba_to_webhook(waba_id, token)

        invalidate_whatsapp_credentials_cache()
        log_event(
            nivel="INFO",
            modulo="WHATSAPP",
            accion="VERIFICAR_CODIGO_OTP_META",
            mensaje=f"Código OTP verificado con éxito para Phone ID {target_phone_id} (registrado={registered}).",
            detalles={"phone_number_id": target_phone_id, "registered": registered}
        )
        status_payload = await get_whatsapp_lines_status()
        return {
            **status_payload,
            "success": True,
            "registered": registered,
            "verify_response": verify_res,
            "register_response": reg_res,
            "mensaje": (
                "¡Código verificado y número activado exitosamente en Meta WhatsApp Cloud API!"
                if registered
                else "¡Código SMS/Voz verificado con éxito! Ahora ingresa tu PIN de 6 dígitos para finalizar la activación."
            )
        }
    except MetaAPIError as me:
        raise HTTPException(status_code=400, detail=f"Error de Meta al verificar código: {me.message}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


@estudios_router.put("/api/whatsapp/lines")
async def update_whatsapp_lines_config(payload: UpdateWhatsAppLinesPayload):
    """
    Guarda en `public.configuracion_sistema` (`clave = 'whatsapp_lineas'`) los parámetros
    de la Línea 2 (Estudios Oftalmológicos), invalida la caché de credenciales en memoria
    y devuelve el estado actualizado en tiempo real desde Meta Graph API.
    Si el usuario ingresó `estudios_display_phone` pero no tiene `estudios_phone_number_id`,
    intenta vincularlo o resolverlo automáticamente en la WABA.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos Supabase no disponible.")

    current_cfg = get_whatsapp_estudios_config()
    input_phone_id = (payload.estudios_phone_number_id or "").strip()
    input_display_phone = normalize_phone_number(payload.estudios_display_phone or "") if payload.estudios_display_phone else ""
    input_verified_name = (payload.estudios_verified_name or "Centrovisión - Estudios Oftalmológicos").strip()

    # Si no hay Phone ID pero sí ingresó el número de teléfono de la Línea 2, resolverlo/crearlo en WABA
    if not input_phone_id and input_display_phone and len(input_display_phone) >= 10:
        q_phone_id, token = get_whatsapp_cloud_credentials()
        waba_id = get_whatsapp_waba_id()
        last_10 = input_display_phone[-10:]
        if waba_id and token:
            waba_numbers = await WhatsAppCloudClient.list_waba_phone_numbers(waba_id, token)
            for item in waba_numbers:
                item_digits = "".join(filter(str.isdigit, str(item.get("display_phone_number") or "")))
                if item_digits.endswith(last_10) and str(item.get("id")) != str(q_phone_id):
                    input_phone_id = str(item.get("id"))
                    break
            if not input_phone_id:
                try:
                    add_res = await WhatsAppCloudClient.add_phone_number_to_waba(
                        waba_id=waba_id,
                        access_token=token,
                        cc="54",
                        phone_number=f"9{last_10}",
                        verified_name=input_verified_name
                    )
                    input_phone_id = str(add_res.get("id") or "").strip()
                except Exception:
                    try:
                        add_res = await WhatsAppCloudClient.add_phone_number_to_waba(
                            waba_id=waba_id,
                            access_token=token,
                            cc="54",
                            phone_number=last_10,
                            verified_name=input_verified_name
                        )
                        input_phone_id = str(add_res.get("id") or "").strip()
                    except Exception as add_err:
                        logger.warning(f"[WABA] No se pudo auto-crear número {input_display_phone} en WABA: {add_err}")

    new_cfg = {
        **current_cfg,
        "estudios_phone_number_id": input_phone_id,
        "estudios_display_phone": input_display_phone,
        "estudios_verified_name": input_verified_name,
        "estudios_template_pdf": (payload.estudios_template_pdf or "entrega_estudio_oftalmologico_pdf").strip(),
        "estudios_template_img": (payload.estudios_template_img or "entrega_estudio_oftalmologico_img").strip(),
        "estudios_auto_reply_enabled": bool(payload.estudios_auto_reply_enabled),
        "estudios_derivacion_telefono": (payload.estudios_derivacion_telefono or "").strip(),
    }
    if payload.estudios_auto_reply_text is not None:
        new_cfg["estudios_auto_reply_text"] = payload.estudios_auto_reply_text.strip()

    try:
        _persist_whatsapp_lineas_config(new_cfg)
        log_event(
            nivel="INFO",
            modulo="WHATSAPP",
            accion="CONFIGURAR_LINEA_ESTUDIOS",
            mensaje=f"Configuración de Línea 2 (Estudios) actualizada. Phone ID: {new_cfg.get('estudios_phone_number_id')}",
            detalles=new_cfg
        )
        return await get_whatsapp_lines_status()
    except Exception as e:
        logger.error(f"Error guardando configuración de líneas de WhatsApp: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@estudios_router.post("/api/whatsapp/register-line")
async def register_whatsapp_line_in_cloud_api(payload: RegisterLinePinPayload):
    """
    Ejecuta `POST /v21.0/{phone_number_id}/register` con el PIN de 6 dígitos (2FA)
    para activar un número recién verificado en Meta WhatsApp Cloud API.
    """
    _, token = get_whatsapp_cloud_credentials()
    waba_id = get_whatsapp_waba_id()
    if not token:
        raise HTTPException(status_code=400, detail="Access Token de Meta no configurado.")

    target_phone_id = (payload.phone_number_id or "").strip()
    if not target_phone_id:
        if payload.line == "estudios":
            target_phone_id, _ = get_whatsapp_estudios_credentials()
        else:
            target_phone_id, _ = get_whatsapp_cloud_credentials()

    if not target_phone_id:
        raise HTTPException(status_code=400, detail="Debe especificar el Phone Number ID del número a registrar.")

    client = WhatsAppCloudClient(phone_number_id=target_phone_id, access_token=token, line=payload.line)
    try:
        res = await client.register_phone_number(payload.pin)
        if waba_id:
            await WhatsAppCloudClient.subscribe_waba_to_webhook(waba_id, token)
        invalidate_whatsapp_credentials_cache()
        log_event(
            nivel="INFO",
            modulo="WHATSAPP",
            accion="REGISTRAR_NUMERO_CLOUD_API",
            mensaje=f"Número {target_phone_id} ({payload.line}) registrado en Meta Cloud API exitosamente.",
            detalles={"phone_number_id": target_phone_id, "line": payload.line, "response": res}
        )
        return {
            "success": True,
            "mensaje": "¡Número registrado y activado exitosamente en Meta WhatsApp Cloud API!",
            "meta_response": res
        }
    except Exception as e:
        logger.error(f"Error registrando número {target_phone_id} en Cloud API: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


@estudios_router.post("/api/whatsapp/send-test-line")
async def send_test_message_from_line(payload: SendTestLinePayload):
    """
    Envía un mensaje de prueba desde la línea seleccionada ('quirurgico' o 'estudios')
    para comprobar su conectividad real con Meta Graph API.
    """
    if payload.line == "estudios":
        phone_id, token = get_whatsapp_estudios_credentials()
        if not phone_id:
            raise HTTPException(
                status_code=400,
                detail="La Línea 2 (Estudios Oftalmológicos) aún no tiene un Phone Number ID configurado."
            )
    else:
        phone_id, token = get_whatsapp_cloud_credentials()

    if not phone_id or not token:
        raise HTTPException(status_code=400, detail="Credenciales de Meta WhatsApp Cloud API incompletas.")

    norm_tel = normalize_to_meta_e164(normalize_phone_number(payload.telefono))
    client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token, line=payload.line)
    try:
        res = await client.send_free_text(
            to_phone=norm_tel,
            text=payload.mensaje or "Mensaje de prueba desde Centrovisión (Meta Cloud API)."
        )
        return {
            "success": True,
            "enviado_real": True,
            "line": payload.line,
            "phone_number_id": phone_id,
            "to": norm_tel,
            "wamid": res.get("wamid")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


# =========================================================================
# ENDPOINTS OPERATIVOS DEL MÓDULO DE ESTUDIOS OFTALMOLÓGICOS (/estudios-tecnicos)
# =========================================================================

@estudios_router.get("/api/estudios-tecnicos/buscar-paciente")
def buscar_paciente_geclisa_para_estudio(dni: str = Query(..., description="DNI del paciente a buscar en Geclisa")):
    """
    Busca al paciente por DNI en tiempo real contra la base de datos de Geclisa,
    recupera su FichaId, celular, cobertura médica, archivos ya existentes en Geclisa
    y el historial de estudios enviados por WhatsApp, SIN crear registros en `public.pacientes`.
    """
    dni_limpio = "".join(filter(str.isdigit, str(dni or "")))
    if not dni_limpio or len(dni_limpio) < 6:
        raise HTTPException(status_code=400, detail="Ingrese un número de DNI válido (mínimo 6 dígitos).")

    res_geclisa = geclisa_client.buscar_paciente_por_dni(dni_limpio)
    if not res_geclisa.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=res_geclisa.get("mensaje") or f"No se encontró ningún paciente con DNI {dni_limpio} en Geclisa."
        )

    raw_data = res_geclisa.get("raw") or {}
    ficha_id = res_geclisa.get("ficha_id") or res_geclisa.get("geclisa_ficha_id") or res_geclisa.get("FichaId") or raw_data.get("fichaId")
    if ficha_id is not None:
        try:
            ficha_id = int(ficha_id)
        except (ValueError, TypeError):
            pass

    pac_id = res_geclisa.get("pac_id") or res_geclisa.get("geclisa_pac_id") or res_geclisa.get("PacId") or raw_data.get("pacId") or ficha_id
    if pac_id is not None:
        try:
            pac_id = int(pac_id)
        except (ValueError, TypeError):
            pass

    nombre = res_geclisa.get("nombre_completo") or res_geclisa.get("nombre") or "Paciente"
    raw_tel = res_geclisa.get("telefono") or res_geclisa.get("celular") or ""
    tel_norm = normalize_phone_number(raw_tel) if raw_tel else ""

    obra_social = res_geclisa.get("obra_social") or raw_data.get("osNombre") or ""
    plan_cobertura = res_geclisa.get("plan_cobertura") or res_geclisa.get("plan") or res_geclisa.get("plan_os") or ""
    nro_afiliado = res_geclisa.get("nro_afiliado") or raw_data.get("nroAfiliado") or ""

    # Verificar (SOLO LECTURA) si el paciente ya existe en public.pacientes del CRM
    paciente_crm = None
    try:
        paciente_crm = get_paciente_by_dni(dni_limpio)
        if not paciente_crm and pac_id:
            paciente_crm = get_paciente_by_geclisa_id(int(pac_id))
        if paciente_crm and not tel_norm and paciente_crm.get("telefono"):
            tel_norm = normalize_phone_number(paciente_crm["telefono"])
    except Exception as e:
        logger.debug(f"[Estudios] Error consultando paciente existente en CRM: {e}")

    # Listar archivos ya guardados en la Historia Clínica de Geclisa
    archivos_geclisa = []
    if ficha_id:
        try:
            archivos_raw = geclisa_client.listar_archivos_historia_clinica(int(ficha_id))
            for a in (archivos_raw or []):
                archivos_geclisa.append({
                    "as_id": a.get("asId") or a.get("id"),
                    "ficha_id": int(ficha_id),
                    "fecha": a.get("fecha") or "",
                    "hora": a.get("hora") or "",
                    "titulo": a.get("titulo") or "Estudio / Documento",
                    "extension": a.get("extension") or "pdf",
                    "observaciones": a.get("observaciones") or "",
                    "prestador": a.get("preNombre") or ""
                })
        except Exception as e:
            logger.warning(f"[Estudios] No se pudieron listar archivos de Geclisa para FichaId={ficha_id}: {e}")

    # Listar historial de envíos previos en public.estudios_oftalmo
    historial_envios = []
    if supabase:
        try:
            q = (
                supabase.table("estudios_oftalmo")
                .select("*")
                .or_(f"dni_paciente.eq.{dni_limpio},geclisa_ficha_id.eq.{ficha_id or 0}")
                .order("created_at", desc=True)
                .limit(25)
                .execute()
            )
            historial_envios = q.data or []
        except Exception as e:
            logger.debug(f"[Estudios] Error consultando historial de estudios_oftalmo: {e}")

    return {
        "success": True,
        "paciente": {
            "dni": dni_limpio,
            "nombre_completo": nombre,
            "geclisa_pac_id": pac_id,
            "geclisa_ficha_id": ficha_id,
            "telefono_geclisa": raw_tel,
            "telefono_normalizado": tel_norm,
            "telefono_display": format_phone_display(tel_norm) if tel_norm else "",
            "obra_social": obra_social,
            "plan": plan_cobertura,
            "nro_afiliado": nro_afiliado,
            "email": res_geclisa.get("email") or "",
            "existe_en_crm_quirurgico": bool(paciente_crm),
            "paciente_crm_id": paciente_crm.get("id") if paciente_crm else None
        },
        "archivos_geclisa": archivos_geclisa,
        "historial_envios": historial_envios
    }


@estudios_router.post("/api/estudios-tecnicos/enviar")
async def enviar_y_archivar_estudio_oftalmologico(
    request: Request,
    files: List[UploadFile] = File(..., description="Uno o más archivos de estudios (PDF, JPG, PNG)"),
    dni: str = Form(...),
    nombre_paciente: str = Form(...),
    telefono: str = Form(...),
    geclisa_ficha_id: int = Form(...),
    geclisa_pac_id: Optional[int] = Form(None),
    tipo_estudio: str = Form(...),
    ojo: str = Form("AO"),
    observaciones: Optional[str] = Form(""),
    unificar_en_pdf: bool = Form(False),
    guardar_en_geclisa: bool = Form(True),
    enviar_whatsapp: bool = Form(True),
    usuario_id: Optional[str] = Form(None),
    usuario_nombre: Optional[str] = Form(None),
    tecnico_pre_id: Optional[int] = Form(None),
    plantilla_whatsapp: Optional[str] = Form(None),
    aplicar_caratula: bool = Form(True)
):
    """
    Flujo Maestro de Estudios Oftalmológicos:
      1. Valida el archivo (o unifica múltiples imágenes OD+OI en un único PDF en RAM).
      2. Verifica las credenciales del técnico (`geclisa_pre_id`).
      3. Ejecuta EN PARALELO (`asyncio.gather`):
         - Subida a Geclisa On-Premise (`/api/Archivo/adjuntar-archivo-historia-clinica`).
         - Subida y envío por WhatsApp Cloud API desde la Línea 2 (Estudios Oftalmológicos).
      4. Registra la auditoría en `public.estudios_oftalmo` con 0 bytes en Supabase Storage
         y 0 pacientes/conversaciones creadas en la bandeja quirúrgica.
    """
    dni_limpio = "".join(filter(str.isdigit, str(dni or "")))
    tel_norm = normalize_phone_number(telefono) if telefono else ""

    if enviar_whatsapp and (not tel_norm or len(tel_norm) < 10):
        raise HTTPException(
            status_code=400,
            detail="El número de celular del paciente no es válido para enviar por WhatsApp. Verifíquelo e intente nuevamente."
        )

    # Resolver técnico autenticado y su geclisa_pre_id
    user_state = getattr(request.state, "user", None) or {}
    eff_user_id = usuario_id or user_state.get("sub") or user_state.get("id")
    resolved_pre_id, resolved_tecnico_nombre = _resolve_tecnico_credentials(
        usuario_id=eff_user_id,
        tecnico_pre_id=tecnico_pre_id,
        usuario_nombre=usuario_nombre
    )

    if guardar_en_geclisa and not resolved_pre_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Tu usuario no tiene vinculado un Prestador de Geclisa (PreId). "
                "Solicitá a un Administrador que asigne tu Prestador Geclisa en Ajustes > Usuarios."
            )
        )

    # Leer y validar archivos en memoria RAM
    ALLOWED_MIMES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
    raw_files: List[Tuple[str, bytes, str]] = []
    for up in files:
        fname = up.filename or "estudio.pdf"
        ext = os.path.splitext(fname)[1].lower()
        ctype = (up.content_type or "").lower()
        if ext == ".pdf" or ctype == "application/pdf":
            mime = "application/pdf"
        elif ext in (".jpg", ".jpeg") or ctype in ("image/jpeg", "image/jpg"):
            mime = "image/jpeg"
        elif ext == ".png" or ctype == "image/png":
            mime = "image/png"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Formato no admitido ({fname}). Solo se permiten archivos PDF, JPG o PNG."
            )
        f_bytes = await up.read()
        if not f_bytes:
            raise HTTPException(status_code=400, detail=f"El archivo {fname} está vacío.")
        if len(f_bytes) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"El archivo {fname} supera el límite máximo de 20 MB.")
        raw_files.append((fname, f_bytes, mime))

    # Construir nombre estandarizado profesional para Geclisa y WhatsApp:
    # Formato: Estudio_{Tipo}_{Ojo}_{PrimerApellido}_{DNI}.{ext}
    import unicodedata
    def _slug(s: str) -> str:
        if not s:
            return ""
        nfkd = unicodedata.normalize('NFKD', str(s))
        ascii_txt = "".join([c for c in nfkd if not unicodedata.combining(c)])
        clean = re.sub(r'[^a-zA-Z0-9]', '_', ascii_txt)
        return re.sub(r'_+', '_', clean).strip('_')

    tipo_slug = _slug(tipo_estudio)[:20] or "Estudio"
    ojo_slug = _slug(ojo)[:4] if ojo and ojo != "N/A" else "AO"
    primer_ape = (nombre_paciente.split(',')[0] if ',' in nombre_paciente else nombre_paciente.split()[0]) if nombre_paciente else "PACIENTE"
    ape_slug = _slug(primer_ape)[:15] or "PACIENTE"

    base_fname = f"Estudio_{tipo_slug}_{ojo_slug}_{ape_slug}_{dni_limpio}"

    titulo_estudio_limpio = f"{tipo_estudio.strip()} ({ojo.strip()})" if ojo and ojo != "N/A" else tipo_estudio.strip()
    titulo_geclisa = f"Estudio - {titulo_estudio_limpio}"[:45]
    titulo_completo = titulo_geclisa

    if aplicar_caratula:
        try:
            from app.services.caratula_estudios_service import componer_estudio_hibrido
            paciente_meta = {
                "nombre": nombre_paciente,
                "dni": dni_limpio,
                "ficha_id": geclisa_ficha_id,
                "geclisa_ficha_id": geclisa_ficha_id
            }
            now_mza = get_argentina_now()
            estudio_meta = {
                "tipo_estudio": tipo_estudio,
                "ojo": ojo,
                "tecnico_nombre": resolved_tecnico_nombre,
                "observaciones": observaciones,
                "fecha_str": now_mza.strftime("%d/%m/%Y"),
                "hora_str": now_mza.strftime("%H:%M hs")
            }
            final_bytes, final_filename, final_mime = componer_estudio_hibrido(
                files_data=raw_files,
                paciente_info=paciente_meta,
                estudio_info=estudio_meta,
                base_filename=base_fname,
                unificar_en_pdf=unificar_en_pdf
            )
        except Exception as e:
            logger.error(f"Aviso componiendo caratula hibrida de estudio: {e}. Aplicando consolidacion plana de respaldo.")
            final_bytes, final_filename, final_mime = _consolidate_or_optimize_files_in_ram(
                files_data=raw_files,
                unificar_en_pdf=unificar_en_pdf,
                base_filename=base_fname
            )
    else:
        final_bytes, final_filename, final_mime = _consolidate_or_optimize_files_in_ram(
            files_data=raw_files,
            unificar_en_pdf=unificar_en_pdf,
            base_filename=base_fname
        )

    obs_geclisa = (observaciones or "").strip()
    if obs_geclisa:
        obs_geclisa = f"{obs_geclisa} | Cargado vía CRM por {resolved_tecnico_nombre}"
    else:
        obs_geclisa = f"Estudio digital cargado vía CRM por {resolved_tecnico_nombre}"

    # Tareas asíncronas en paralelo (Geclisa + Meta Cloud API Línea 2)
    async def _task_geclisa() -> Dict[str, Any]:
        if not guardar_en_geclisa:
            return {"skipped": True}
        return await asyncio.to_thread(
            geclisa_client.adjuntar_archivo_historia_clinica,
            ficha_id=int(geclisa_ficha_id),
            file_bytes=final_bytes,
            filename=final_filename,
            titulo=titulo_geclisa,
            observaciones=obs_geclisa[:100],
            pre_id=int(resolved_pre_id),
            clase_id=1,
            content_type=final_mime
        )

    async def _task_whatsapp() -> Dict[str, Any]:
        if not enviar_whatsapp:
            return {"skipped": True}
        return await _dispatch_study_via_meta_line2(
            to_phone=tel_norm,
            nombre_paciente=nombre_paciente,
            titulo_estudio=titulo_estudio_limpio,
            file_bytes=final_bytes,
            filename=final_filename,
            mime_type=final_mime,
            template_override=plantilla_whatsapp
        )

    geclisa_res, wa_res = await asyncio.gather(
        _task_geclisa(),
        _task_whatsapp(),
        return_exceptions=True
    )

    # Analizar resultado de Geclisa
    geclisa_ok = False
    geclisa_as_id = None
    geclisa_err = None
    if isinstance(geclisa_res, Exception):
        geclisa_err = str(geclisa_res)
    elif isinstance(geclisa_res, dict):
        if geclisa_res.get("skipped"):
            geclisa_ok = True
        elif geclisa_res.get("exito") or geclisa_res.get("success"):
            geclisa_ok = True
            geclisa_as_id = (
                geclisa_res.get("as_id")
                or geclisa_res.get("archivo_id")
                or geclisa_res.get("geclisa_as_id")
                or geclisa_res.get("hca_id")
            )
            # Si Geclisa no devolvió el AS_ID en el body del POST, intentar resolver el último archivo de la ficha
            if not geclisa_as_id:
                try:
                    archivos = await asyncio.to_thread(
                        geclisa_client.listar_archivos_historia_clinica,
                        int(geclisa_ficha_id)
                    )
                    if archivos and len(archivos) > 0:
                        geclisa_as_id = archivos[0].get("asId") or archivos[0].get("as_id") or archivos[0].get("id")
                except Exception:
                    pass
        else:
            geclisa_err = geclisa_res.get("error") or "Error al guardar el archivo en Geclisa."

    # Analizar resultado de WhatsApp Línea 2
    wa_ok = False
    wamid = None
    media_id = None
    wa_status = "pending"
    wa_err = None
    delivery_mode = None
    if isinstance(wa_res, Exception):
        wa_err = str(wa_res)
        wa_status = "failed"
    elif isinstance(wa_res, dict):
        if wa_res.get("skipped"):
            wa_status = "skipped"
            wa_ok = True
        elif wa_res.get("success"):
            wa_ok = True
            wamid = wa_res.get("wamid")
            media_id = wa_res.get("media_id")
            wa_status = "sent"
            delivery_mode = wa_res.get("delivery_mode")
        else:
            wa_err = wa_res.get("error") or "Error al enviar por WhatsApp."
            wa_status = "failed"

    # Sincronización y persistencia de auditoría (FAIL-SAFE)
    # Una vez que Geclisa y/o WhatsApp procesaron el estudio, cualquier error en la persistencia
    # local o resolución de IDs secundarios NUNCA debe abortar la respuesta ni propagar HTTP 500.
    saved_record = None
    try:
        existing_paciente_id = None
        try:
            p_crm = get_paciente_by_dni(dni_limpio)
            if not p_crm and geclisa_pac_id:
                p_crm = get_paciente_by_geclisa_id(int(geclisa_pac_id))
            if p_crm:
                existing_paciente_id = p_crm.get("id")
        except Exception as p_e:
            logger.warning(f"[Estudios] Error buscando paciente existente: {p_e}")

        # Persistir registro en public.estudios_oftalmo (0 bytes en Supabase Storage)
        ahora_iso = datetime.now(timezone.utc).isoformat()
        now_mza_save = get_argentina_now()
        db_row: Dict[str, Any] = {
            "paciente_id": existing_paciente_id,
            "tipo": tipo_estudio.strip(),
            "ojo": ojo.strip() or "AO",
            "fecha": now_mza_save.date().isoformat(),
            "notas": observaciones or "",
            "observaciones": observaciones or "",
            "archivo_url": f"/api/geclisa/archivos/{geclisa_as_id}/ver" if geclisa_as_id else None,
            "archivo_nombre": final_filename,
            "nombre_archivo": final_filename,
            "mime_type": final_mime,
            "tamano_bytes": len(final_bytes),
            "geclisa_archivo_id": int(geclisa_as_id) if geclisa_as_id else None,
            "geclisa_as_id": int(geclisa_as_id) if geclisa_as_id else None,
            "geclisa_pac_id": int(geclisa_pac_id) if geclisa_pac_id else None,
            "geclisa_ficha_id": int(geclisa_ficha_id),
            "dni_paciente": dni_limpio,
            "nombre_paciente": nombre_paciente.strip(),
            "telefono_destino": tel_norm,
            "wamid": wamid,
            "whatsapp_media_id": media_id,
            "whatsapp_status": wa_status,
            "whatsapp_error": wa_err,
            "whatsapp_sent_at": ahora_iso if wa_ok and wamid else None,
            "tecnico_usuario_id": eff_user_id if eff_user_id else None,
            "tecnico_nombre": resolved_tecnico_nombre,
            "tecnico_pre_id": int(resolved_pre_id) if resolved_pre_id else None
        }

        saved_record = db_row
        if supabase:
            try:
                ins = supabase.table("estudios_oftalmo").insert(db_row).execute()
                if ins.data and len(ins.data) > 0:
                    saved_record = ins.data[0]
            except Exception as db_e:
                logger.error(f"[Estudios] Error insertando en estudios_oftalmo: {db_e}")

        log_event(
            nivel="INFO" if (geclisa_ok and wa_ok) else "WARNING",
            modulo="ESTUDIOS_TECNICOS",
            accion="ENVIO_ESTUDIO_OFTALMOLOGICO",
            mensaje=f"Estudio '{titulo_completo}' para {nombre_paciente} (DNI {dni_limpio}): Geclisa={'OK' if geclisa_ok else 'ERROR'}, WhatsApp={'OK' if wa_ok else 'ERROR'}",
            detalles={
                "estudio_id": saved_record.get("id") if isinstance(saved_record, dict) else None,
                "dni": dni_limpio,
                "ficha_id": geclisa_ficha_id,
                "geclisa_as_id": geclisa_as_id,
                "wamid": wamid,
                "tecnico": resolved_tecnico_nombre,
                "geclisa_error": geclisa_err,
                "whatsapp_error": wa_err
            }
        )
    except Exception as post_e:
        logger.error(f"[Estudios] Error no crítico post-envío: {post_e}", exc_info=True)
        if saved_record is None:
            saved_record = {
                "dni_paciente": dni_limpio,
                "nombre_paciente": nombre_paciente,
                "geclisa_as_id": geclisa_as_id,
                "wamid": wamid
            }

    if guardar_en_geclisa and not geclisa_ok and enviar_whatsapp and not wa_ok:
        raise HTTPException(
            status_code=500,
            detail=f"Falló tanto el guardado en Geclisa ({geclisa_err}) como el envío por WhatsApp ({wa_err})."
        )
    if guardar_en_geclisa and not geclisa_ok and not enviar_whatsapp:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo guardar el archivo en la Historia Clínica de Geclisa: {geclisa_err}"
        )
    if not guardar_en_geclisa and enviar_whatsapp and not wa_ok:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo enviar el archivo por WhatsApp: {wa_err}"
        )

    return {
        "success": True,
        "geclisa_ok": geclisa_ok,
        "geclisa_as_id": geclisa_as_id,
        "geclisa_error": geclisa_err,
        "whatsapp_ok": wa_ok,
        "wamid": wamid,
        "whatsapp_status": wa_status,
        "whatsapp_error": wa_err,
        "delivery_mode": delivery_mode,
        "estudio": saved_record
    }


@estudios_router.post("/api/estudios-tecnicos/enviar-existente-geclisa")
async def enviar_archivo_existente_geclisa_por_whatsapp(
    payload: EnviarExistenteGeclisaPayload,
    request: Request
):
    """
    Descarga en memoria RAM un archivo que YA está almacenado en la Historia Clínica de Geclisa (`geclisa_as_id`)
    y lo envía por WhatsApp desde la Línea 2 sin volver a subirlo ni duplicarlo en Geclisa.
    """
    tel_norm = normalize_phone_number(payload.telefono)
    if not tel_norm or len(tel_norm) < 10:
        raise HTTPException(status_code=400, detail="Número de teléfono inválido.")

    dl_res = await asyncio.to_thread(
        geclisa_client.descargar_archivo_historia_clinica,
        int(payload.geclisa_as_id)
    )
    if isinstance(dl_res, (list, tuple)):
        file_bytes = dl_res[0] if len(dl_res) > 0 else None
        mime_type = (dl_res[1] if len(dl_res) > 1 else None) or "application/pdf"
        dl_fname = dl_res[2] if len(dl_res) > 2 else f"Estudio_{payload.geclisa_as_id}.pdf"
        dl_ok = bool(file_bytes)
        dl_err = None if dl_ok else f"No se pudo recuperar el archivo #{payload.geclisa_as_id} desde Geclisa."
    elif isinstance(dl_res, dict):
        file_bytes = dl_res.get("content")
        mime_type = dl_res.get("content_type") or "application/pdf"
        dl_fname = dl_res.get("filename") or f"Estudio_{payload.geclisa_as_id}.pdf"
        dl_ok = bool(dl_res.get("exito") or dl_res.get("success") or file_bytes)
        dl_err = dl_res.get("error") or f"No se pudo recuperar el archivo #{payload.geclisa_as_id} desde Geclisa."
    else:
        file_bytes = None
        mime_type = "application/pdf"
        dl_fname = f"Estudio_{payload.geclisa_as_id}.pdf"
        dl_ok = False
        dl_err = "Respuesta inesperada al descargar archivo desde Geclisa."

    if not dl_ok or not file_bytes:
        raise HTTPException(
            status_code=404,
            detail=dl_err
        )

    filename: str = payload.nombre_archivo or dl_fname or f"Estudio_{payload.geclisa_as_id}.pdf"
    titulo_completo = f"{payload.tipo_estudio.strip()} ({payload.ojo.strip()})" if payload.ojo else payload.tipo_estudio.strip()

    user_state = getattr(request.state, "user", None) or {}
    eff_user_id = payload.usuario_id or user_state.get("sub") or user_state.get("id")
    resolved_pre_id, resolved_tecnico_nombre = _resolve_tecnico_credentials(
        usuario_id=eff_user_id,
        tecnico_pre_id=payload.tecnico_pre_id,
        usuario_nombre=payload.usuario_nombre
    )

    try:
        wa_res = await _dispatch_study_via_meta_line2(
            to_phone=tel_norm,
            nombre_paciente=payload.nombre_paciente,
            titulo_estudio=titulo_completo,
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type,
            template_override=payload.plantilla_whatsapp
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    dni_limpio = "".join(filter(str.isdigit, str(payload.dni_paciente or "")))
    existing_paciente_id = None
    try:
        p_crm = get_paciente_by_dni(dni_limpio)
        if p_crm:
            existing_paciente_id = p_crm.get("id")
    except Exception:
        pass

    ahora_iso = datetime.now(timezone.utc).isoformat()
    db_row = {
        "paciente_id": existing_paciente_id,
        "tipo": payload.tipo_estudio.strip(),
        "ojo": payload.ojo.strip() or "AO",
        "fecha": get_argentina_now().date().isoformat(),
        "notas": payload.observaciones or "Reenvío de estudio existente en Geclisa",
        "observaciones": payload.observaciones or "Reenvío de estudio existente en Geclisa",
        "archivo_url": f"/api/geclisa/archivos/{payload.geclisa_as_id}/ver",
        "archivo_nombre": filename,
        "nombre_archivo": filename,
        "mime_type": mime_type,
        "tamano_bytes": len(file_bytes),
        "geclisa_archivo_id": int(payload.geclisa_as_id),
        "geclisa_as_id": int(payload.geclisa_as_id),
        "geclisa_pac_id": int(payload.geclisa_pac_id) if payload.geclisa_pac_id else None,
        "geclisa_ficha_id": int(payload.geclisa_ficha_id),
        "dni_paciente": dni_limpio,
        "nombre_paciente": payload.nombre_paciente.strip(),
        "telefono_destino": tel_norm,
        "wamid": wa_res.get("wamid"),
        "whatsapp_media_id": wa_res.get("media_id"),
        "whatsapp_status": "sent",
        "whatsapp_sent_at": ahora_iso,
        "tecnico_usuario_id": eff_user_id if eff_user_id else None,
        "tecnico_nombre": resolved_tecnico_nombre,
        "tecnico_pre_id": int(resolved_pre_id) if resolved_pre_id else None
    }

    saved = db_row
    if supabase:
        try:
            ins = supabase.table("estudios_oftalmo").insert(db_row).execute()
            if ins.data:
                saved = ins.data[0]
        except Exception as db_e:
            logger.error(f"[Estudios] Error insertando estudio existente en estudios_oftalmo: {db_e}")

    return {
        "success": True,
        "wamid": wa_res.get("wamid"),
        "estudio": saved
    }


@estudios_router.post("/api/estudios-tecnicos/{estudio_id}/reintentar-whatsapp")
async def reintentar_envio_whatsapp_estudio(
    estudio_id: str,
    payload: ReintentarWhatsAppEstudioPayload = Body(default=ReintentarWhatsAppEstudioPayload())
):
    """
    Reintenta el envío por WhatsApp de un estudio ya registrado en `public.estudios_oftalmo`
    recuperando los bytes directamente desde Geclisa (`geclisa_as_id`), sin duplicar el archivo en Geclisa.
    Permite actualizar el teléfono de destino si estaba mal cargado.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos no disponible.")

    est_q = supabase.table("estudios_oftalmo").select("*").eq("id", estudio_id).limit(1).execute()
    if not est_q.data or len(est_q.data) == 0:
        raise HTTPException(status_code=404, detail="Registro de estudio no encontrado.")

    row = est_q.data[0]
    as_id = row.get("geclisa_as_id") or row.get("geclisa_archivo_id")
    if not as_id:
        raise HTTPException(
            status_code=400,
            detail="Este registro no posee un ID de archivo en Geclisa (geclisa_as_id) para recuperar el documento."
        )

    raw_tel = (payload.telefono or row.get("telefono_destino") or "").strip()
    tel_norm = normalize_phone_number(raw_tel)
    if not tel_norm or len(tel_norm) < 10:
        raise HTTPException(status_code=400, detail="El número de teléfono indicado no es válido.")

    dl_res = await asyncio.to_thread(
        geclisa_client.descargar_archivo_historia_clinica,
        int(as_id)
    )
    if isinstance(dl_res, (list, tuple)):
        file_content = dl_res[0] if len(dl_res) > 0 else None
        dl_mime = (dl_res[1] if len(dl_res) > 1 else None) or "application/pdf"
        dl_fname = dl_res[2] if len(dl_res) > 2 else f"Estudio_{as_id}.pdf"
        dl_ok = bool(file_content)
        dl_err = None if dl_ok else f"No se pudo descargar el archivo #{as_id} desde Geclisa."
    elif isinstance(dl_res, dict):
        file_content = dl_res.get("content")
        dl_mime = dl_res.get("content_type") or "application/pdf"
        dl_fname = dl_res.get("filename") or f"Estudio_{as_id}.pdf"
        dl_ok = bool(dl_res.get("exito") or dl_res.get("success") or file_content)
        dl_err = dl_res.get("error") or f"No se pudo descargar el archivo #{as_id} desde Geclisa."
    else:
        file_content = None
        dl_mime = "application/pdf"
        dl_fname = f"Estudio_{as_id}.pdf"
        dl_ok = False
        dl_err = "Respuesta inesperada al descargar archivo desde Geclisa."

    if not dl_ok or not file_content:
        raise HTTPException(
            status_code=404,
            detail=dl_err
        )

    titulo_completo = f"{row.get('tipo') or 'Estudio'} ({row.get('ojo') or 'AO'})"
    fname = row.get("nombre_archivo") or row.get("archivo_nombre") or dl_fname or f"Estudio_{as_id}.pdf"
    mime = row.get("mime_type") or dl_mime or "application/pdf"

    try:
        wa_res = await _dispatch_study_via_meta_line2(
            to_phone=tel_norm,
            nombre_paciente=row.get("nombre_paciente") or "Paciente",
            titulo_estudio=titulo_completo,
            file_bytes=file_content,
            filename=fname,
            mime_type=mime,
            template_override=payload.plantilla_whatsapp
        )
    except Exception as e:
        supabase.table("estudios_oftalmo").update({
            "telefono_destino": tel_norm,
            "whatsapp_status": "failed",
            "whatsapp_error": str(e)
        }).eq("id", estudio_id).execute()
        raise HTTPException(status_code=400, detail=str(e))

    ahora_iso = datetime.now(timezone.utc).isoformat()
    upd = {
        "telefono_destino": tel_norm,
        "wamid": wa_res.get("wamid"),
        "whatsapp_media_id": wa_res.get("media_id"),
        "whatsapp_status": "sent",
        "whatsapp_error": None,
        "whatsapp_sent_at": ahora_iso
    }
    up_res = supabase.table("estudios_oftalmo").update(upd).eq("id", estudio_id).execute()
    return {
        "success": True,
        "wamid": wa_res.get("wamid"),
        "estudio": up_res.data[0] if up_res.data else {**row, **upd}
    }


@estudios_router.get("/api/estudios-tecnicos/historial")
def listar_historial_estudios_enviados(
    dni: Optional[str] = Query(None),
    fecha: Optional[str] = Query(None),
    status_wa: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Lista el historial de estudios oftalmológicos procesados por el equipo técnico,
    junto con métricas operativas del día (total enviados, entregados/leídos, guardados en Geclisa, fallidos).
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos no disponible.")

    try:
        query = supabase.table("estudios_oftalmo").select("*").not_.is_("geclisa_ficha_id", "null").order("created_at", desc=True)
        if dni and dni.strip():
            dni_clean = "".join(filter(str.isdigit, dni))
            if dni_clean:
                query = query.ilike("dni_paciente", f"%{dni_clean}%")
        if fecha and fecha.strip():
            query = query.eq("fecha", fecha.strip())
        if status_wa and status_wa.strip() and status_wa != "ALL":
            query = query.eq("whatsapp_status", status_wa.strip())

        res = query.limit(limit).execute()
        items = res.data or []

        hoy_str = date.today().isoformat()
        hoy_q = supabase.table("estudios_oftalmo").select("id, geclisa_as_id, whatsapp_status").eq("fecha", hoy_str).not_.is_("geclisa_ficha_id", "null").execute()
        hoy_items = hoy_q.data or []

        metricas = {
            "total_hoy": len(hoy_items),
            "guardados_geclisa_hoy": sum(1 for x in hoy_items if x.get("geclisa_as_id")),
            "entregados_o_leidos_hoy": sum(1 for x in hoy_items if x.get("whatsapp_status") in ("sent", "delivered", "read")),
            "leidos_azul_hoy": sum(1 for x in hoy_items if x.get("whatsapp_status") == "read"),
            "fallidos_hoy": sum(1 for x in hoy_items if x.get("whatsapp_status") == "failed")
        }

        return {
            "success": True,
            "items": items,
            "metricas": metricas
        }
    except Exception as e:
        logger.error(f"[Estudios] Error listando historial de estudios: {e}")
        raise HTTPException(status_code=500, detail=str(e))



class UpdateBusinessProfilePayload(BaseModel):
    phone_number_id: Optional[str] = None
    about: Optional[str] = "Centrovisión - Envío de Estudios Oftalmológicos"
    address: Optional[str] = "Avenida Mitre 540 - Ciudad - Mendoza - Argentina"
    description: Optional[str] = (
        "Canal oficial exclusivo para el envío digital de estudios e informes oftalmológicos "
        "de Centrovisión Clínica Oftalmológica. Para turnos o consultas comunicate al +54 9 261 553-0888."
    )
    email: Optional[str] = None
    website: Optional[str] = "https://centrovision.com.ar/"
    vertical: Optional[str] = "HEALTH"
    copy_logo_from_line1: Optional[bool] = True


@estudios_router.get("/api/whatsapp/line-profile")
async def get_whatsapp_line_business_profile(phone_number_id: Optional[str] = Query(None)):
    """
    Obtiene desde Meta Graph API el perfil público comercial (`whatsapp_business_profile`)
    del número de Estudios Oftalmológicos (Foto, Estado/About, Dirección, Descripción, Web, Categoría).
    """
    import httpx
    _, token = get_whatsapp_cloud_credentials()
    target_phone_id = (phone_number_id or "").strip()
    if not target_phone_id:
        target_phone_id, _ = get_whatsapp_estudios_credentials()
    if not target_phone_id or not token:
        raise HTTPException(status_code=400, detail="Phone Number ID o Access Token no configurados.")

    url = (
        f"https://graph.facebook.com/v21.0/{target_phone_id}/whatsapp_business_profile"
        f"?fields=about,address,description,email,profile_picture_url,websites,vertical"
    )
    async with httpx.AsyncClient(timeout=15.0) as hc:
        res = await hc.get(url, headers={"Authorization": f"Bearer {token}"})
        data = res.json() if res.content else {}
        if res.status_code >= 400:
            raise HTTPException(status_code=400, detail=data.get("error", {}).get("message", res.text))
        items = data.get("data") or []
        profile = items[0] if items else {}
        return {
            "success": True,
            "phone_number_id": target_phone_id,
            "waba_id": get_whatsapp_waba_id(),
            "profile": profile
        }


@estudios_router.put("/api/whatsapp/line-profile")
async def update_whatsapp_line_business_profile(payload: UpdateBusinessProfilePayload):
    """
    Actualiza directamente en Meta Graph API el perfil público de WhatsApp Business
    (`POST /v21.0/{phone_number_id}/whatsapp_business_profile`) de la Línea 2 (Estudios),
    y opcionalmente sincroniza el logo institucional desde la Línea 1.
    """
    import httpx
    q_phone_id, token = get_whatsapp_cloud_credentials()
    target_phone_id = (payload.phone_number_id or "").strip()
    if not target_phone_id:
        target_phone_id, _ = get_whatsapp_estudios_credentials()
    if not target_phone_id or not token:
        raise HTTPException(status_code=400, detail="Phone Number ID o Access Token no configurados.")

    meta_body: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "vertical": (payload.vertical or "HEALTH").strip()
    }
    if payload.about is not None:
        meta_body["about"] = payload.about.strip()[:139]
    if payload.address is not None:
        meta_body["address"] = payload.address.strip()[:256]
    if payload.description is not None:
        meta_body["description"] = payload.description.strip()[:512]
    if payload.email:
        meta_body["email"] = payload.email.strip()[:128]
    if payload.website:
        meta_body["websites"] = [payload.website.strip()]

    async with httpx.AsyncClient(timeout=25.0) as hc:
        if payload.copy_logo_from_line1 and q_phone_id:
            try:
                p1_res = await hc.get(
                    f"https://graph.facebook.com/v21.0/{q_phone_id}/whatsapp_business_profile?fields=profile_picture_url",
                    headers={"Authorization": f"Bearer {token}"}
                )
                p1_data = (p1_res.json().get("data") or [{}])[0]
                pic_url = p1_data.get("profile_picture_url")
                if pic_url:
                    img_resp = await hc.get(pic_url)
                    if img_resp.status_code == 200 and img_resp.content:
                        img_bytes = img_resp.content
                        app_res = await hc.get(
                            "https://graph.facebook.com/v21.0/app",
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        app_id = app_res.json().get("id") or "1611907453862739"
                        up_sess = await hc.post(
                            f"https://graph.facebook.com/v21.0/{app_id}/uploads",
                            params={"file_length": len(img_bytes), "file_type": "image/jpeg"},
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        upload_id = up_sess.json().get("id")
                        if upload_id:
                            up_bin = await hc.post(
                                f"https://graph.facebook.com/v21.0/{upload_id}",
                                headers={"Authorization": f"OAuth {token}", "file_offset": "0"},
                                content=img_bytes
                            )
                            handle = up_bin.json().get("h")
                            if handle:
                                meta_body["profile_picture_handle"] = handle
            except Exception as logo_err:
                logger.warning(f"[WhatsApp Profile] No se pudo clonar el logo desde Línea 1: {logo_err}")

        res = await hc.post(
            f"https://graph.facebook.com/v21.0/{target_phone_id}/whatsapp_business_profile",
            headers={"Authorization": f"Bearer {token}"},
            json=meta_body
        )
        data = res.json() if res.content else {}
        if res.status_code >= 400:
            raise HTTPException(status_code=400, detail=data.get("error", {}).get("message", res.text))

    return await get_whatsapp_line_business_profile(target_phone_id)


@estudios_router.get("/api/estudios-tecnicos/preview-caratula")
async def preview_caratula_estudio(
    modo: str = "a4",
    tipo_estudio: str = "OCT Macular y Papilar",
    ojo: str = "AO"
):
    """
    Genera un PDF de previsualización en vivo de la carátula de estudios
    para el Diseñador en Ajustes.
    modo: 'a4' (Carátula de informe completa) o 'mobile' (Lámina mobile-first con imagen de muestra)
    """
    from fastapi.responses import Response
    from app.services.caratula_estudios_service import (
        generar_portada_pdf_a4,
        componer_lamina_digital_imagen,
        _get_caratula_config,
        get_argentina_now
    )
    paciente_demo = {
        "nombre": "PEÑA, JUAN SEBASTIAN",
        "dni": "33516799",
        "geclisa_ficha_id": 242646,
        "obra_social": "OSDE",
        "plan": "210"
    }
    now_arg = get_argentina_now()
    estudio_demo = {
        "tipo_estudio": tipo_estudio,
        "ojo": ojo,
        "tecnico_nombre": "TARIFEÑO, CAMILA",
        "observaciones": "Control oftalmológico preventivo",
        "fecha_str": now_arg.strftime("%d/%m/%Y"),
        "hora_str": now_arg.strftime("%H:%M hs")
    }
    cfg = _get_caratula_config()

    if modo == "mobile":
        from PIL import Image, ImageDraw
        dummy_img = Image.new("RGB", (900, 600), (15, 23, 42))
        d = ImageDraw.Draw(dummy_img)
        d.rectangle([30, 30, 870, 570], outline=(0, 122, 135), width=3)
        d.text((150, 280), f"SCANNER {tipo_estudio.upper()} ({ojo})", fill=(255, 255, 255))
        buf = io.BytesIO()
        dummy_img.save(buf, format="JPEG")
        pdf_bytes = componer_lamina_digital_imagen(buf.getvalue(), paciente_demo, estudio_demo, config=cfg)
    else:
        pdf_bytes = generar_portada_pdf_a4(paciente_demo, estudio_demo, config=cfg)

    return Response(content=pdf_bytes, media_type="application/pdf")
