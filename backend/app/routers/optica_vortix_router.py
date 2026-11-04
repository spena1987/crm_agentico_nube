"""
Router FastAPI para el Módulo Independiente Óptica Vortix (`/api/optica-vortix`).
Expone los endpoints de Bandeja de Chat, Oportunidades de Geclisa (Recetas del Día y Turnos Próximos),
Motor de Campañas y Placas Promocionales, Copiloto IA / OCR de Recetas con Gemini Vision
y Configuración / Vinculación de la Línea 3 de WhatsApp Cloud API.
"""

import os
import re
import uuid
import random
import asyncio
import logging
import httpx
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Body, Request
from pydantic import BaseModel

from app.db import supabase
from app.services.geclisa_client import GeclisaClient
from app.services.media_service import MediaService
from app.services.whatsapp_cloud.client import (
    WhatsAppCloudClient,
    MetaAPIError,
    ConversationWindowClosedError,
    get_whatsapp_waba_id,
    get_whatsapp_cloud_credentials,
    get_whatsapp_estudios_credentials,
    get_whatsapp_optica_credentials,
    invalidate_whatsapp_credentials_cache
)
from app.services.optica_vortix_service import (
    get_mendoza_now,
    get_optica_vortix_full_config,
    save_optica_vortix_full_config,
    normalizar_telefono_optica_mza,
    normalizar_estructura_graduacion,
    generar_codigo_beneficio_vortix,
    upsert_optica_contacto,
    sincronizar_turnos_proximos_optica,
    detectar_indicaciones_lentes_del_dia,
    encolar_envio_oportunidad_optica,
    procesar_cola_envios_optica,
    obtener_o_subir_placa_media_id,
    aprovisionar_plantillas_base_optica,
    extraer_graduacion_desde_imagen_receta,
    generar_sugerencia_copiloto_optica,
    _record_optica_outbound_msg,
    OPTICA_VORTIX_TEMPLATES_CATALOG
)

logger = logging.getLogger("optica_vortix_router")
geclisa_client = GeclisaClient()

optica_vortix_router = APIRouter(prefix="/api/optica-vortix", tags=["Óptica Vortix (Línea 3)"])

ETAPAS_COMERCIALES_OPTICA = [
    "NUEVA_CONSULTA",
    "CONSULTA_ARMAZON",
    "PRESUPUESTO_AEREOS",
    "LENTES_CONTACTO",
    "EN_LABORATORIO",
    "LISTO_PARA_RETIRAR",
    "VENDIDO",
    "SIN_INTERES"
]


# ============================================================================
# SCHEMAS PYDANTIC
# ============================================================================

class VincularLineaOpticaPayload(BaseModel):
    telefono: Optional[str] = None
    display_phone_number: Optional[str] = None
    phone_number_id: Optional[str] = None
    verified_name: Optional[str] = "Óptica Vortix"


class SolicitarCodigoOpticaPayload(BaseModel):
    phone_number_id: Optional[str] = None
    code_method: str = "SMS"
    language: str = "es_AR"


class ActivarPinOpticaPayload(BaseModel):
    phone_number_id: Optional[str] = None
    code: Optional[str] = None
    pin: str


class IniciarConversacionOpticaPayload(BaseModel):
    telefono: str
    nombre: Optional[str] = None
    nombre_paciente: Optional[str] = None
    ficha_geclisa_id: Optional[str] = None
    dni: Optional[str] = None
    obra_social: Optional[str] = None
    origen_oportunidad: Optional[str] = "manual_optica"
    oportunidad_id: Optional[str] = None
    template_name: Optional[str] = None
    parameters: Optional[List[str]] = None
    mensaje_inicial: Optional[str] = None


class EnviarMensajeOpticaPayload(BaseModel):
    tipo: Optional[str] = "text"
    contenido: Optional[str] = None
    mensaje: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_internal_note: bool = False
    template_name: Optional[str] = None
    template_language: str = "es_AR"
    parameters: Optional[List[str]] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = "image"
    cotizacion: Optional[Dict[str, Any]] = None
    aviso_lentes_listos: bool = False
    detalle_pedido: Optional[str] = None
    usuario_nombre: Optional[str] = "Óptica Vortix"


class PatchConversacionOpticaPayload(BaseModel):
    etapa_comercial: Optional[str] = None
    asignado_a: Optional[str] = None
    archivada: Optional[bool] = None
    bot_paused: Optional[bool] = None
    graduacion_actual_json: Optional[Dict[str, Any]] = None
    notas: Optional[str] = None
    codigo_cupon_activo: Optional[str] = None
    notificar_lentes_listos: bool = False
    detalle_pedido: Optional[str] = None


class OcrRecetaPayload(BaseModel):
    media_url: str
    conversacion_id: Optional[str] = None
    contacto_id: Optional[str] = None
    rotacion_grados: Optional[int] = 0


class CopilotoOpticaPayload(BaseModel):
    conversacion_id: Optional[str] = None
    accion: str = "sugerir"  # "sugerir" | "mejorar" | "resumir"
    texto_actual: Optional[str] = ""


class SincronizarTurnosPayload(BaseModel):
    dias_anticipacion: Optional[int] = 1
    fecha_objetivo: Optional[str] = None
    encolar_envios: bool = True


class SincronizarHoyPayload(BaseModel):
    fecha: Optional[str] = None
    auto_encolar: Optional[bool] = None


class ContactarOportunidadPayload(BaseModel):
    template_name: Optional[str] = None
    inmediato: bool = True
    abrir_chat: bool = True


class ContactarLotePayload(BaseModel):
    oportunidad_ids: List[str]
    template_name: Optional[str] = None


class CrearCampanaOpticaPayload(BaseModel):
    nombre: str
    tipo: str = "masiva_segmentada"
    segmento: Optional[str] = None
    estrategia_envio: str = "template_directo"
    estrategia: Optional[str] = None
    template_name: Optional[str] = None
    template_language: str = "es_AR"
    placa_imagen_url: Optional[str] = None
    placa_url: Optional[str] = None
    descuento_texto: Optional[str] = None
    jitter_min_seg: Optional[int] = None
    jitter_max_seg: Optional[int] = None
    lote_max_hora: Optional[int] = None
    variables_mapeo: Optional[List[str]] = None
    filtro_audiencia: Optional[Dict[str, Any]] = None
    config_goteo_json: Optional[Dict[str, Any]] = None
    programada_para: Optional[str] = None
    lanzar_ahora: bool = False
    created_by: Optional[str] = "Óptica Vortix"


class CrearPlantillaOpticaPayload(BaseModel):
    name: str
    category: str = "MARKETING"  # MARKETING o UTILITY
    language: str = "es_AR"
    header_type: str = "NONE"   # NONE, TEXT, IMAGE, DOCUMENT
    header_content: Optional[str] = None
    body_text: str
    footer_text: Optional[str] = None
    buttons: Optional[List[Dict[str, Any]]] = None
    titulo_amigable: Optional[str] = None
    variable_mappings: Optional[Dict[str, str]] = None
    sample_values: Optional[List[str]] = None


class EditarPlantillaOpticaPayload(BaseModel):
    category: Optional[str] = None
    language: str = "es_AR"
    header_type: str = "NONE"
    header_content: Optional[str] = None
    body_text: str
    footer_text: Optional[str] = None
    buttons: Optional[List[Dict[str, Any]]] = None
    titulo_amigable: Optional[str] = None
    variable_mappings: Optional[Dict[str, str]] = None
    sample_values: Optional[List[str]] = None


# ============================================================================
# 1. CONFIGURACIÓN Y SALUD DE LA LÍNEA 3 DE WHATSAPP (ÓPTICA VORTIX)
# ============================================================================

@optica_vortix_router.get("/config")
async def get_config_endpoint():
    """Retorna la configuración actual de Óptica Vortix (al nivel raíz y dentro de `config`)."""
    cfg = get_optica_vortix_full_config()
    return {
        **cfg,
        "success": True,
        "config": cfg
    }


@optica_vortix_router.put("/config")
async def put_config_endpoint(payload: Dict[str, Any] = Body(...)):
    """Actualiza la configuración de Óptica Vortix en Supabase e invalida la caché de credenciales."""
    try:
        saved = save_optica_vortix_full_config(payload)
        return {
            **saved,
            "success": True,
            "config": saved,
            "message": "Configuración de Óptica Vortix guardada correctamente.",
            "mensaje": "Configuración de Óptica Vortix guardada correctamente."
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@optica_vortix_router.get("/salud-linea")
async def get_salud_linea_optica():
    """
    Consulta en tiempo real el estado y salud de la Línea 3 (Óptica Vortix) en Meta Graph API,
    lista los números registrados en la WABA, las plantillas de óptica disponibles y las métricas
    de la cola anti-bloqueo del día.
    """
    cfg = get_optica_vortix_full_config()
    waba_id = get_whatsapp_waba_id() or cfg.get("optica_waba_id") or "3731563350343089"
    q_phone_id, token = get_whatsapp_cloud_credentials()
    est_phone_id, _ = get_whatsapp_estudios_credentials()
    opt_phone_id, _ = get_whatsapp_optica_credentials()

    linea_health: Dict[str, Any] = {
        "configured": bool(opt_phone_id),
        "connected": False,
        "phone_number_id": opt_phone_id,
        "display_phone_number": cfg.get("optica_display_phone") or "",
        "verified_name": cfg.get("optica_verified_name") or "Óptica Vortix",
        "quality_rating": "UNKNOWN",
        "messaging_limit_tier": "TIER_250",
        "code_verification_status": "NOT_VERIFIED",
        "account_status": "NOT_CONFIGURED"
    }

    if opt_phone_id and token:
        client = WhatsAppCloudClient(phone_number_id=opt_phone_id, access_token=token, line="optica")
        try:
            det = await client.get_phone_number_details()
            if det and (det.get("display_phone_number") or det.get("verified_name")):
                acc_st = str(det.get("status") or "CONNECTED").upper()
                ver_st = str(det.get("code_verification_status") or "VERIFIED").upper()
                linea_health.update({
                    "connected": acc_st == "CONNECTED" and ver_st != "NOT_VERIFIED",
                    "requires_otp": ver_st == "NOT_VERIFIED",
                    "requires_pin_register": ver_st in ("VERIFIED", "EXPIRED") and acc_st != "CONNECTED",
                    "display_phone_number": det.get("display_phone_number") or linea_health["display_phone_number"],
                    "verified_name": det.get("verified_name") or linea_health["verified_name"],
                    "quality_rating": det.get("quality_rating") or "GREEN",
                    "messaging_limit_tier": det.get("messaging_limit_tier") or "TIER_250",
                    "code_verification_status": ver_st,
                    "account_status": acc_st
                })
        except Exception as e:
            linea_health["error"] = str(e)
        finally:
            await client.close()

    waba_numbers: List[Dict[str, Any]] = []
    if waba_id and token:
        try:
            raw_nums = await WhatsAppCloudClient.list_waba_phone_numbers(waba_id, token)
            for n in raw_nums:
                nid = str(n.get("id") or "")
                role = "disponible"
                if q_phone_id and nid == str(q_phone_id):
                    role = "linea_1_quirurgica"
                elif est_phone_id and nid == str(est_phone_id):
                    role = "linea_2_estudios"
                elif opt_phone_id and nid == str(opt_phone_id):
                    role = "linea_3_optica"
                waba_numbers.append({**n, "assigned_role": role})
        except Exception:
            pass

    # Plantillas de Óptica Vortix
    templates: List[Dict[str, Any]] = []
    if supabase:
        try:
            t_res = (
                supabase.table("whatsapp_templates")
                .select("id, name, language, titulo_amigable, category, status, header_type, header_content, body_text, footer_text, buttons, variable_mappings, grupo_crm")
                .order("name")
                .execute()
            )
            for t in (t_res.data or []):
                n_low = str(t.get("name") or "").lower()
                grp = str(t.get("grupo_crm") or "").lower()
                if n_low.startswith(("vortix_", "optica_")) or "vortix" in grp or "óptica" in grp or "optica" in grp:
                    templates.append({
                        **t,
                        "language": t.get("language") or "es_AR",
                        "preview_body": t.get("body_text") or ""
                    })
        except Exception:
            pass

    if not templates:
        templates = [
            {
                **spec,
                "language": "es_AR",
                "status": "NOT_PROVISIONED",
                "grupo_crm": "Óptica Vortix",
                "preview_body": spec.get("body_text") or ""
            }
            for spec in OPTICA_VORTIX_TEMPLATES_CATALOG
        ]

    # Métricas de cola hoy y opt-outs totales
    hoy_mza = get_mendoza_now().strftime("%Y-%m-%d")
    cola_stats = {"pendientes": 0, "enviados_hoy": 0, "fallidos_hoy": 0, "max_diarios": int(cfg.get("max_envios_diarios", 200))}
    opt_outs_total = 0
    if supabase:
        try:
            p_res = supabase.table("optica_envios_programados").select("id", count="exact").eq("estado", "pendiente").execute()
            s_res = supabase.table("optica_envios_programados").select("id", count="exact").eq("estado", "enviado").gte("enviado_at", f"{hoy_mza}T00:00:00").execute()
            f_res = supabase.table("optica_envios_programados").select("id", count="exact").eq("estado", "fallido").gte("updated_at", f"{hoy_mza}T00:00:00").execute()
            oo_res = supabase.table("optica_contactos").select("id", count="exact").eq("opt_out", True).execute()
            cola_stats["pendientes"] = p_res.count or 0
            cola_stats["enviados_hoy"] = s_res.count or 0
            cola_stats["fallidos_hoy"] = f_res.count or 0
            opt_outs_total = oo_res.count or 0
        except Exception:
            pass

    q_rating = str(linea_health.get("quality_rating") or "UNKNOWN").upper()
    return {
        "success": True,
        "waba_id": waba_id,
        "connected": bool(linea_health.get("connected")),
        "phone_number_id": linea_health.get("phone_number_id") or "",
        "display_phone_number": linea_health.get("display_phone_number") or "",
        "verified_name": linea_health.get("verified_name") or "Óptica Vortix",
        "quality_rating": q_rating,
        "messaging_limit_tier": linea_health.get("messaging_limit_tier") or "TIER_250",
        "enviados_ultimas_24h": cola_stats["enviados_hoy"],
        "cola_pendientes": cola_stats["pendientes"],
        "circuit_breaker_activo": q_rating == "RED",
        "opt_outs_total": opt_outs_total,
        "templates": templates,
        "plantillas_optica": templates,
        "linea_optica": linea_health,
        "waba_numbers": waba_numbers,
        "cola_stats": cola_stats,
        "config": cfg
    }


@optica_vortix_router.post("/linea/vincular")
async def vincular_linea_optica(payload: VincularLineaOpticaPayload):
    """
    Vincula el número de teléfono exclusivo de Óptica Vortix a la WABA `3731563350343089`
    (o selecciona un `phone_number_id` ya existente en la WABA), verificando con seguridad
    Fail-Closed que jamás coincida con la Línea 1 (Quirúrgica) ni con la Línea 2 (Estudios).
    """
    q_phone_id, token = get_whatsapp_cloud_credentials()
    est_phone_id, _ = get_whatsapp_estudios_credentials()
    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"

    if not token or not waba_id:
        raise HTTPException(status_code=400, detail="No se encontraron credenciales WABA / Access Token en el servidor.")

    verified_name = (payload.verified_name or "Óptica Vortix").strip()
    resolved_phone_id = (payload.phone_number_id or "").strip()
    raw_phone_input = (payload.telefono or payload.display_phone_number or "").strip()
    norm_tel = ""
    action_taken = "linked_by_id"

    waba_numbers = await WhatsAppCloudClient.list_waba_phone_numbers(waba_id, token)

    if resolved_phone_id:
        if (q_phone_id and resolved_phone_id == str(q_phone_id).strip()) or (
            est_phone_id and resolved_phone_id == str(est_phone_id).strip()
        ):
            raise HTTPException(
                status_code=400,
                detail="Ese Phone Number ID ya pertenece a la Línea 1 (Quirúrgica) o a la Línea 2 (Estudios). Seleccioná el número exclusivo de Óptica Vortix."
            )
        for item in waba_numbers:
            if str(item.get("id")) == resolved_phone_id:
                norm_tel, _ = normalizar_telefono_optica_mza(item.get("display_phone_number"))
                norm_tel = norm_tel or str(item.get("display_phone_number") or "")
                verified_name = item.get("verified_name") or verified_name
                break
        if not norm_tel and raw_phone_input:
            norm_tel, _ = normalizar_telefono_optica_mza(raw_phone_input)
            norm_tel = norm_tel or raw_phone_input
    else:
        raw_digits = "".join(filter(str.isdigit, raw_phone_input))
        if len(raw_digits) < 10:
            raise HTTPException(
                status_code=400,
                detail="Ingresá un número de teléfono válido con código de área (ej: 2615123456) o el Phone Number ID."
            )
        last_10 = raw_digits[-10:]
        norm_tel = f"549{last_10}"

        # Comprobar si ya existe en la WABA
        action_taken = "found_in_waba"
        for item in waba_numbers:
            item_digits = "".join(filter(str.isdigit, str(item.get("display_phone_number") or "")))
            if item_digits.endswith(last_10):
                cand_id = str(item.get("id"))
                if (q_phone_id and cand_id == str(q_phone_id)) or (est_phone_id and cand_id == str(est_phone_id)):
                    raise HTTPException(
                        status_code=400,
                        detail="Ese número ya está asignado a la Línea 1 (Quirúrgica) o Línea 2 (Estudios). Usá el chip exclusivo de Óptica Vortix."
                    )
                resolved_phone_id = cand_id
                verified_name = item.get("verified_name") or verified_name
                break

        if not resolved_phone_id:
            action_taken = "created_in_waba"
            try:
                add_res = await WhatsAppCloudClient.add_phone_number_to_waba(
                    waba_id=waba_id,
                    access_token=token,
                    cc="54",
                    phone_number=f"9{last_10}",
                    verified_name=verified_name
                )
                resolved_phone_id = str(add_res.get("id") or "").strip()
            except MetaAPIError as me_err:
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
                    raise HTTPException(status_code=400, detail=f"Meta rechazó el alta del número en la WABA: {me_err.message}")

    if not resolved_phone_id:
        raise HTTPException(status_code=400, detail="No se pudo obtener el Phone Number ID en Meta.")

    save_optica_vortix_full_config({
        "optica_phone_number_id": resolved_phone_id,
        "optica_display_phone": norm_tel,
        "optica_verified_name": verified_name,
        "optica_waba_id": waba_id
    })

    salud = await get_salud_linea_optica()
    msg_ok = f"Línea 3 de Óptica Vortix vinculada con éxito (Phone ID: {resolved_phone_id})."
    return {
        **salud,
        "action": action_taken,
        "phone_number_id": resolved_phone_id,
        "message": msg_ok,
        "mensaje": msg_ok
    }


@optica_vortix_router.post("/linea/solicitar-codigo")
async def solicitar_codigo_otp_optica(payload: SolicitarCodigoOpticaPayload):
    """Solicita a Meta el envío del código OTP de 6 dígitos por SMS o llamada de voz al número de Óptica Vortix."""
    _, token = get_whatsapp_cloud_credentials()
    opt_phone_id, _ = get_whatsapp_optica_credentials()
    target_id = (payload.phone_number_id or opt_phone_id or "").strip()

    if not target_id or not token:
        raise HTTPException(status_code=400, detail="Vinculá primero el número de la óptica para obtener su Phone Number ID.")

    client = WhatsAppCloudClient(phone_number_id=target_id, access_token=token, line="optica")
    try:
        res = await client.request_verification_code(code_method=payload.code_method, language=payload.language or "es_AR")
        msg_otp = f"Meta envió el código de 6 dígitos por {payload.code_method} al chip de Óptica Vortix."
        return {
            "success": True,
            "message": msg_otp,
            "mensaje": msg_otp,
            "meta_response": res
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


@optica_vortix_router.post("/linea/activar-pin")
async def activar_pin_linea_optica(payload: ActivarPinOpticaPayload):
    """
    Verifica el código OTP (si se incluye `code`) y activa el número de Óptica Vortix en Cloud API
    mediante `POST /{phone_number_id}/register` con el PIN de 6 dígitos, suscribiendo además el webhook de la WABA.
    """
    _, token = get_whatsapp_cloud_credentials()
    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
    opt_phone_id, _ = get_whatsapp_optica_credentials()
    target_id = (payload.phone_number_id or opt_phone_id or "").strip()

    if not target_id or not token:
        raise HTTPException(status_code=400, detail="Falta el Phone Number ID de la Línea 3 de Óptica Vortix.")

    client = WhatsAppCloudClient(phone_number_id=target_id, access_token=token, line="optica")
    try:
        verify_res = None
        if payload.code and len("".join(filter(str.isdigit, payload.code))) == 6:
            verify_res = await client.verify_code(payload.code)

        reg_res = await client.register_phone_number(payload.pin)
        if waba_id:
            await WhatsAppCloudClient.subscribe_waba_to_webhook(waba_id, token)

        invalidate_whatsapp_credentials_cache()
        salud = await get_salud_linea_optica()
        msg_pin = "¡Número de Óptica Vortix verificado y activado en Meta WhatsApp Cloud API!"
        return {
            **salud,
            "success": True,
            "verify_response": verify_res,
            "register_response": reg_res,
            "message": msg_pin,
            "mensaje": msg_pin
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await client.close()


# ============================================================================
# 1.1 GESTIÓN DE PLANTILLAS DE WHATSAPP (META GRAPH API) - ÓPTICA VORTIX
# ============================================================================

@optica_vortix_router.get("/plantillas")
async def listar_plantillas_optica():
    """
    Lista todas las plantillas registradas para Óptica Vortix directamente desde la base de datos Supabase.
    Si la base de datos está totalmente vacía de plantillas de óptica (primer uso), realiza el sembrado
    físico inicial en Supabase. Si una plantilla es eliminada por el usuario, permanece eliminada
    y no se vuelve a generar automáticamente en memoria.
    """
    templates_db = []
    if supabase:
        try:
            res = (
                supabase.table("whatsapp_templates")
                .select("*")
                .or_("grupo_crm.eq.Óptica Vortix,name.ilike.vortix_%,name.ilike.optica_%")
                .order("created_at")
                .execute()
            )
            templates_db = res.data or []
        except Exception as e:
            logger.warning(f"[OpticaTemplates] Error consultando whatsapp_templates: {e}")

    # Si la base de datos está 100% vacía para óptica (instalación inicial), sembrar físicamente las 4 base
    if len(templates_db) == 0 and supabase:
        waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
        for cat in OPTICA_VORTIX_TEMPLATES_CATALOG:
            try:
                row = {
                    "waba_id": waba_id,
                    "name": cat["name"],
                    "titulo_amigable": cat.get("titulo_amigable") or cat["name"],
                    "category": cat.get("category", "UTILITY"),
                    "language": "es_AR",
                    "status": "NOT_PROVISIONED",
                    "header_type": cat.get("header_type", "NONE"),
                    "header_content": cat.get("header_content"),
                    "body_text": cat.get("body_text", ""),
                    "footer_text": cat.get("footer_text"),
                    "buttons": cat.get("buttons") or [],
                    "variable_mappings": cat.get("variable_mappings") or {},
                    "grupo_crm": "Óptica Vortix",
                    "activo": False,
                    "visible_en_chat": False,
                    "visible_en_hce": False
                }
                ins = supabase.table("whatsapp_templates").insert(row).execute()
                if ins.data:
                    templates_db.append(ins.data[0])
            except Exception as seed_err:
                logger.warning(f"[OpticaTemplates] Error sembrando plantilla inicial {cat['name']}: {seed_err}")

    catalog_dict = {c["name"]: c for c in OPTICA_VORTIX_TEMPLATES_CATALOG}

    # Enriquecer plantillas con metadatos de catálogo (sample_values si no existen)
    for t in templates_db:
        c_name = t.get("name")
        t["is_catalog_base"] = c_name in catalog_dict
        if "sample_values" not in t or not t.get("sample_values"):
            if c_name in catalog_dict:
                t["sample_values"] = catalog_dict[c_name].get("sample_values") or []

    aprobadas = sum(1 for t in templates_db if str(t.get("status")).upper() == "APPROVED")
    en_revision = sum(1 for t in templates_db if str(t.get("status")).upper() == "PENDING")
    rechazadas = sum(1 for t in templates_db if str(t.get("status")).upper() == "REJECTED")
    no_aprovisionadas = sum(1 for t in templates_db if str(t.get("status")).upper() == "NOT_PROVISIONED")

    return {
        "success": True,
        "total": len(templates_db),
        "metricas": {
            "aprobadas": aprobadas,
            "en_revision": en_revision,
            "rechazadas": rechazadas,
            "no_aprovisionadas": no_aprovisionadas
        },
        "plantillas": templates_db
    }


@optica_vortix_router.post("/plantillas/sincronizar")
async def sincronizar_plantillas_meta_optica():
    """
    Sincroniza en tiempo real contra Meta Graph API (GET /{waba_id}/message_templates)
    las plantillas correspondientes a Óptica Vortix (prefijos vortix_ u optica_).
    Actualiza su estado (APPROVED, PENDING, REJECTED, motivo) en public.whatsapp_templates.
    """
    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
    _, token = get_whatsapp_cloud_credentials()
    if not waba_id or not token:
        raise HTTPException(status_code=400, detail="Credenciales WABA o Token de Meta no configurados.")

    url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates?limit=100"
    meta_templates = []
    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Meta Graph API error al consultar plantillas: {res.text}")
        meta_templates = res.json().get("data", [])

    actualizadas = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    catalog_by_name = {c["name"]: c for c in OPTICA_VORTIX_TEMPLATES_CATALOG}

    for mt in meta_templates:
        tpl_name = str(mt.get("name") or "").lower()
        if tpl_name.startswith(("vortix_", "optica_")):
            status_meta = str(mt.get("status") or "PENDING").upper()
            rejection = mt.get("rejected_reason") or mt.get("quality_score", {}).get("reasons")
            cat_info = catalog_by_name.get(tpl_name, {})

            if supabase:
                try:
                    upsert_data = {
                        "waba_id": waba_id,
                        "meta_template_id": mt.get("id"),
                        "name": tpl_name,
                        "category": mt.get("category") or cat_info.get("category") or "UTILITY",
                        "language": mt.get("language") or "es_AR",
                        "status": status_meta,
                        "rejection_reason": str(rejection) if rejection else None,
                        "grupo_crm": "Óptica Vortix",
                        "visible_en_chat": False,
                        "visible_en_hce": False,
                        "activo": status_meta == "APPROVED",
                        "updated_at": now_iso
                    }
                    if cat_info.get("titulo_amigable"):
                        upsert_data["titulo_amigable"] = cat_info["titulo_amigable"]
                    if cat_info.get("body_text"):
                        upsert_data["body_text"] = cat_info["body_text"]
                    if cat_info.get("variable_mappings"):
                        upsert_data["variable_mappings"] = cat_info["variable_mappings"]

                    supabase.table("whatsapp_templates").upsert(upsert_data, on_conflict="name").execute()
                    actualizadas += 1
                except Exception as db_e:
                    logger.warning(f"[OpticaTemplates] Error upserting {tpl_name}: {db_e}")

    return {
        "success": True,
        "mensaje": f"Sincronización completada. Se verificaron {len(meta_templates)} plantillas en Meta ({actualizadas} de Óptica Vortix reconocidas).",
        "total_meta": len(meta_templates),
        "actualizadas_optica": actualizadas
    }


@optica_vortix_router.post("/plantillas/aprovisionar-base")
async def aprovisionar_plantillas_endpoint():
    """Registra en la WABA y en Supabase las 4 plantillas base de Óptica Vortix."""
    return await aprovisionar_plantillas_base_optica()


def validar_reglas_meta_plantilla(body_text: str) -> Optional[str]:
    """
    Valida las reglas algorítmicas de Meta WhatsApp Cloud API para parámetros en plantillas:
    - No se permite que una plantilla empiece directamente con una variable {{N}} (Error 2388299).
    - No se permite que una plantilla termine con una variable {{N}} al final (Error 2388299).
    - Variables no pueden ser consecutivas sin texto intermedio.
    """
    t = (body_text or "").strip()
    if not t:
        return "El cuerpo del mensaje no puede estar vacío."
    if re.match(r'^\s*\{\{\d+\}\}', t):
        return (
            "Regla de Meta WhatsApp (Error 2388299): La plantilla no puede comenzar directamente con una variable {{N}}. "
            "Debes anteponer texto fijo al inicio (ej: 'Hola {{1}}...')."
        )
    if re.search(r'\{\{\d+\}\}[\s\.\!\?\:\;]*$', t):
        return (
            "Regla de Meta WhatsApp (Error 2388299): La plantilla no puede terminar con una variable {{N}} al final. "
            "Debes incluir texto fijo de cierre después de la última variable (ej: '...en el horario de {{3}}. ¡Te esperamos!')."
        )
    if re.search(r'\{\{\d+\}\}\s*\{\{\d+\}\}', t):
        return "Regla de Meta WhatsApp: No se permiten variables consecutivas sin texto en el medio (ej: '{{1}} {{2}}'). Debes separarlas con palabras."
    return None


SAMPLE_VALUES_BY_VAR_NAME: Dict[str, str] = {
    "paciente_nombre": "Mariana Pérez",
    "prestador_nombre": "Dr. Bonanno",
    "turno_fecha_hora": "15/11/2026 a las 10:30 hs",
    "porcentaje_descuento": "20% OFF",
    "codigo_beneficio": "#VORTIX-8A4F",
    "detalle_trabajo": "Multifocales Antirreflex",
    "horario_atencion": "Lunes a Viernes de 9 a 20 hs"
}

SAMPLE_VALUES_BY_INDEX: Dict[int, str] = {
    1: "Mariana Pérez",
    2: "Dr. Bonanno",
    3: "20% OFF",
    4: "#VORTIX-8A4F",
    5: "Multifocales Antirreflex",
    6: "Lunes a Viernes de 9 a 20 hs"
}


def generar_body_example_meta(
    body_text: str,
    custom_samples: Optional[List[str]] = None,
    variable_mappings: Optional[Dict[str, str]] = None
) -> Optional[Dict[str, Any]]:
    """
    Genera el bloque obligatorio 'example' para el componente BODY en Meta Cloud API v21+.
    Detecta todas las variables {{1}}, {{2}}, etc. y asegura que haya exactamente una
    muestra para cada variable presente. Si no hay variables, retorna None.
    """
    matches = re.findall(r'\{\{(\d+)\}\}', body_text or "")
    if not matches:
        return None

    unique_vars = sorted(list(set(int(m) for m in matches)))
    sample_list = []

    for idx, var_num in enumerate(unique_vars):
        if custom_samples and idx < len(custom_samples) and custom_samples[idx] and str(custom_samples[idx]).strip():
            sample_list.append(str(custom_samples[idx]).strip())
            continue

        var_key = None
        if variable_mappings:
            var_key = variable_mappings.get(str(var_num)) or variable_mappings.get(var_num)
        if var_key and var_key in SAMPLE_VALUES_BY_VAR_NAME:
            sample_list.append(SAMPLE_VALUES_BY_VAR_NAME[var_key])
            continue

        sample_list.append(SAMPLE_VALUES_BY_INDEX.get(var_num, f"Muestra{var_num}"))

    return {"body_text": [sample_list]}


@optica_vortix_router.post("/plantillas")
async def crear_plantilla_optica(payload: CrearPlantillaOpticaPayload):
    """
    Crea una nueva plantilla para Óptica Vortix y la envía a revisión en Meta Graph API.
    Asegura prefijo `vortix_` y aislamiento fail-closed respecto al resto del CRM.
    """
    err_meta = validar_reglas_meta_plantilla(payload.body_text)
    if err_meta:
        raise HTTPException(status_code=400, detail=err_meta)

    clean_name = re.sub(r"[^a-z0-9_]", "", payload.name.lower().strip())
    if not clean_name.startswith("vortix_"):
        clean_name = f"vortix_{clean_name}"

    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
    _, token = get_whatsapp_cloud_credentials()
    if not waba_id or not token:
        raise HTTPException(status_code=400, detail="Credenciales de WABA o Access Token no configurados.")

    components = []
    h_type = (payload.header_type or "NONE").upper()
    if h_type == "TEXT" and payload.header_content:
        components.append({"type": "HEADER", "format": "TEXT", "text": payload.header_content[:60]})
    elif h_type == "IMAGE":
        components.append({"type": "HEADER", "format": "IMAGE"})
    elif h_type == "DOCUMENT":
        components.append({"type": "HEADER", "format": "DOCUMENT"})

    body_comp: Dict[str, Any] = {"type": "BODY", "text": payload.body_text}
    example_obj = generar_body_example_meta(payload.body_text, payload.sample_values, payload.variable_mappings)
    if example_obj:
        body_comp["example"] = example_obj
    components.append(body_comp)

    if payload.footer_text:
        components.append({"type": "FOOTER", "text": payload.footer_text[:60]})

    if payload.buttons and len(payload.buttons) > 0:
        clean_btns = []
        for b in payload.buttons:
            b_type = b.get("type", "QUICK_REPLY").upper()
            btn_dict: Dict[str, Any] = {"type": b_type, "text": b.get("text", "")[:25]}
            if b_type == "URL" and b.get("url"):
                btn_dict["url"] = b["url"]
            clean_btns.append(btn_dict)
        components.append({"type": "BUTTONS", "buttons": clean_btns})

    meta_payload = {
        "name": clean_name,
        "category": (payload.category or "MARKETING").upper(),
        "language": payload.language or "es_AR",
        "components": components
    }

    url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates"
    meta_id = None
    meta_status = "PENDING"
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, json=meta_payload, headers={"Authorization": f"Bearer {token}"})
        if res.status_code in (200, 201):
            res_data = res.json()
            meta_id = res_data.get("id")
            meta_status = res_data.get("status", "PENDING")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Meta rechazó la plantilla: {res.text}"
            )

    now_iso = datetime.now(timezone.utc).isoformat()
    if supabase:
        try:
            supabase.table("whatsapp_templates").upsert({
                "waba_id": waba_id,
                "meta_template_id": meta_id,
                "name": clean_name,
                "titulo_amigable": payload.titulo_amigable or clean_name,
                "category": (payload.category or "MARKETING").upper(),
                "language": payload.language or "es_AR",
                "status": meta_status,
                "header_type": h_type,
                "header_content": payload.header_content,
                "body_text": payload.body_text,
                "footer_text": payload.footer_text,
                "buttons": payload.buttons or [],
                "variable_mappings": payload.variable_mappings or {},
                "grupo_crm": "Óptica Vortix",
                "visible_en_chat": False,
                "visible_en_hce": False,
                "activo": True,
                "created_at": now_iso,
                "updated_at": now_iso
            }, on_conflict="name").execute()
        except Exception as db_e:
            logger.warning(f"[OpticaTemplates] Error guardando plantilla en Supabase: {db_e}")

    return {
        "success": True,
        "mensaje": f"Plantilla '{clean_name}' enviada con éxito a Meta en estado '{meta_status}'.",
        "meta_id": meta_id,
        "name": clean_name,
        "status": meta_status
    }


@optica_vortix_router.put("/plantillas/{name}")
async def editar_plantilla_optica(name: str, payload: EditarPlantillaOpticaPayload):
    """
    Edita una plantilla existente de Óptica Vortix:
    - Si la plantilla ya está registrada en Meta (tiene meta_template_id o existe en WABA),
      actualiza sus componentes en Meta Graph API (POST /v21.0/{meta_template_id}).
      Esto somete los cambios a revisión en Meta manteniendo el mismo nombre técnico (Opción 1 oficial de Meta).
    - Si la plantilla aún no estaba en Meta (NOT_PROVISIONED), actualiza su contenido localmente.
    - Sincroniza los cambios en public.whatsapp_templates en Supabase.
    """
    err_meta = validar_reglas_meta_plantilla(payload.body_text)
    if err_meta:
        raise HTTPException(status_code=400, detail=err_meta)

    clean_name = name.strip().lower()
    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
    _, token = get_whatsapp_cloud_credentials()

    # 1. Buscar plantilla en la base de datos local
    local_tpl = None
    if supabase:
        try:
            res = supabase.table("whatsapp_templates").select("*").eq("name", clean_name).limit(1).execute()
            if res.data and len(res.data) > 0:
                local_tpl = res.data[0]
        except Exception as e:
            logger.warning(f"[OpticaTemplates] Error buscando {clean_name}: {e}")

    meta_template_id = local_tpl.get("meta_template_id") if local_tpl else None

    # 2. Si no tenemos meta_template_id localmente, intentar buscarla en Meta
    if not meta_template_id and waba_id and token:
        try:
            lookup_url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates?name={clean_name}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                lookup_res = await client.get(lookup_url, headers={"Authorization": f"Bearer {token}"})
                if lookup_res.status_code == 200:
                    matches = lookup_res.json().get("data", [])
                    if matches:
                        meta_template_id = matches[0].get("id")
        except Exception as e:
            logger.warning(f"[OpticaTemplates] Error buscando template en Meta: {e}")

    # 3. Construir componentes para Meta
    components = []
    h_type = (payload.header_type or "NONE").upper()
    if h_type == "TEXT" and payload.header_content:
        components.append({"type": "HEADER", "format": "TEXT", "text": payload.header_content[:60]})
    elif h_type == "IMAGE":
        components.append({"type": "HEADER", "format": "IMAGE"})
    elif h_type == "DOCUMENT":
        components.append({"type": "HEADER", "format": "DOCUMENT"})

    body_comp: Dict[str, Any] = {"type": "BODY", "text": payload.body_text}
    if payload.sample_values and len(payload.sample_values) > 0:
        body_comp["example"] = {"body_text": [payload.sample_values]}
    components.append(body_comp)

    if payload.footer_text:
        components.append({"type": "FOOTER", "text": payload.footer_text[:60]})

    if payload.buttons and len(payload.buttons) > 0:
        clean_btns = []
        for b in payload.buttons:
            b_type = b.get("type", "QUICK_REPLY").upper()
            btn_dict: Dict[str, Any] = {"type": b_type, "text": b.get("text", "")[:25]}
            if b_type == "URL" and b.get("url"):
                btn_dict["url"] = b["url"]
            clean_btns.append(btn_dict)
        components.append({"type": "BUTTONS", "buttons": clean_btns})

    meta_status = "PENDING"
    meta_edit_msg = ""
    # 4. Si la plantilla existe en Meta, despachar actualización vía POST /{meta_template_id}
    if meta_template_id and token:
        meta_payload: Dict[str, Any] = {"components": components}
        if payload.category:
            meta_payload["category"] = payload.category.upper()

        edit_url = f"https://graph.facebook.com/v21.0/{meta_template_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            edit_res = await client.post(edit_url, json=meta_payload, headers={"Authorization": f"Bearer {token}"})
            if edit_res.status_code in (200, 201):
                meta_edit_msg = "Actualizada en Meta y enviada a revisión."
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Meta rechazó la actualización de la plantilla: {edit_res.text}"
                )
    else:
        meta_status = (local_tpl.get("status") if local_tpl else "NOT_PROVISIONED") or "NOT_PROVISIONED"
        meta_edit_msg = "Guardada localmente lista para aprovisionar en Meta."

    # 5. Persistir en Supabase
    now_iso = datetime.now(timezone.utc).isoformat()
    if supabase:
        try:
            update_data = {
                "waba_id": waba_id,
                "meta_template_id": meta_template_id,
                "name": clean_name,
                "titulo_amigable": payload.titulo_amigable or (local_tpl.get("titulo_amigable") if local_tpl else clean_name),
                "category": (payload.category or (local_tpl.get("category") if local_tpl else "MARKETING")).upper(),
                "language": payload.language or "es_AR",
                "status": meta_status,
                "header_type": h_type,
                "header_content": payload.header_content,
                "body_text": payload.body_text,
                "footer_text": payload.footer_text,
                "buttons": payload.buttons or [],
                "variable_mappings": payload.variable_mappings or (local_tpl.get("variable_mappings") if local_tpl else {}),
                "grupo_crm": "Óptica Vortix",
                "visible_en_chat": False,
                "visible_en_hce": False,
                "updated_at": now_iso
            }
            supabase.table("whatsapp_templates").upsert(update_data, on_conflict="name").execute()
        except Exception as db_e:
            logger.error(f"[OpticaTemplates] Error crítico actualizando en Supabase: {db_e}")
            raise HTTPException(status_code=500, detail=f"Error al guardar la plantilla en la base de datos: {str(db_e)}")

    return {
        "success": True,
        "name": clean_name,
        "status": meta_status,
        "meta_template_id": meta_template_id,
        "mensaje": f"Plantilla '{clean_name}' editada con éxito. {meta_edit_msg}"
    }


@optica_vortix_router.patch("/plantillas/{name}/toggle-activo")
async def toggle_activo_plantilla_optica(name: str):
    """
    Habilita o desactiva una plantilla aprobada para uso en campañas y automatizaciones de Óptica Vortix.
    """
    clean_name = name.strip().lower()
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos no disponible.")

    res = supabase.table("whatsapp_templates").select("name, activo, status").eq("name", clean_name).limit(1).execute()
    if not res.data or len(res.data) == 0:
        raise HTTPException(status_code=404, detail=f"Plantilla '{clean_name}' no encontrada.")

    current = res.data[0]
    new_activo = not bool(current.get("activo", True))
    now_iso = datetime.now(timezone.utc).isoformat()

    supabase.table("whatsapp_templates").update({
        "activo": new_activo,
        "updated_at": now_iso
    }).eq("name", clean_name).execute()

    estado_txt = "habilitada" if new_activo else "deshabilitada"
    return {
        "success": True,
        "name": clean_name,
        "activo": new_activo,
        "mensaje": f"Plantilla '{clean_name}' {estado_txt} para su uso en Óptica Vortix."
    }


@optica_vortix_router.post("/plantillas/{name}/aprovisionar")
async def aprovisionar_plantilla_individual(name: str):
    """
    Aprovisiona en Meta Graph API y en Supabase una plantilla individual específica.
    """
    clean_name = name.strip().lower()
    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
    _, token = get_whatsapp_cloud_credentials()
    if not waba_id or not token:
        raise HTTPException(status_code=400, detail="Credenciales WABA o Token de Meta no configurados.")

    # 1. Priorizar la base de datos Supabase para usar cualquier edición personalizada del usuario
    spec = None
    if supabase:
        try:
            res = supabase.table("whatsapp_templates").select("*").eq("name", clean_name).limit(1).execute()
            if res.data and len(res.data) > 0:
                spec = res.data[0]
        except Exception as e:
            logger.warning(f"[OpticaTemplates] Error consultando spec en DB para {clean_name}: {e}")

    # 2. Fallback al catálogo si aún no estaba en BD
    if not spec:
        spec = next((c for c in OPTICA_VORTIX_TEMPLATES_CATALOG if c["name"] == clean_name), None)

    if not spec:
        raise HTTPException(status_code=404, detail=f"No se encontró la especificación de la plantilla '{clean_name}'.")

    # 3. Validación de Reglas de Meta antes de despachar a la Graph API
    err_meta = validar_reglas_meta_plantilla(spec.get("body_text", ""))
    if err_meta:
        raise HTTPException(status_code=400, detail=err_meta)

    components: List[Dict[str, Any]] = []
    if spec.get("header_type") == "TEXT" and spec.get("header_content"):
        components.append({"type": "HEADER", "format": "TEXT", "text": spec["header_content"][:60]})
    elif spec.get("header_type") == "IMAGE":
        components.append({"type": "HEADER", "format": "IMAGE"})
    elif spec.get("header_type") == "DOCUMENT":
        components.append({"type": "HEADER", "format": "DOCUMENT"})

    body_comp: Dict[str, Any] = {"type": "BODY", "text": spec["body_text"]}
    sample_vals = spec.get("sample_values") or ["Mariana", "10:30 hs", "20% OFF", "#VORTIX-8A4F"]
    body_comp["example"] = {"body_text": [sample_vals]}
    components.append(body_comp)

    if spec.get("footer_text"):
        components.append({"type": "FOOTER", "text": spec["footer_text"][:60]})

    if spec.get("buttons"):
        clean_btns = []
        for b in spec["buttons"]:
            b_type = b.get("type", "QUICK_REPLY").upper()
            btn_dict: Dict[str, Any] = {"type": b_type, "text": b.get("text", "")[:25]}
            if b_type == "URL" and b.get("url"):
                btn_dict["url"] = b["url"]
            clean_btns.append(btn_dict)
        components.append({"type": "BUTTONS", "buttons": clean_btns})

    url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates"
    meta_id = None
    meta_status = "PENDING"
    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.post(
            url,
            json={
                "name": clean_name,
                "category": spec.get("category", "UTILITY"),
                "language": spec.get("language", "es_AR"),
                "components": components
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        if res.status_code in (200, 201):
            body = res.json()
            meta_id = body.get("id")
            meta_status = body.get("status", "PENDING")
        else:
            err_txt = res.text.lower()
            if "already exists" in err_txt:
                meta_status = "APPROVED"
            else:
                raise HTTPException(status_code=400, detail=f"Meta rechazó el aprovisionamiento: {res.text}")

    now_iso = datetime.now(timezone.utc).isoformat()
    if supabase:
        try:
            supabase.table("whatsapp_templates").upsert({
                "waba_id": waba_id,
                "meta_template_id": meta_id,
                "name": clean_name,
                "titulo_amigable": spec.get("titulo_amigable") or clean_name,
                "category": spec.get("category", "UTILITY"),
                "language": spec.get("language", "es_AR"),
                "status": meta_status,
                "header_type": spec.get("header_type", "NONE"),
                "header_content": spec.get("header_content"),
                "body_text": spec["body_text"],
                "footer_text": spec.get("footer_text"),
                "buttons": spec.get("buttons") or [],
                "variable_mappings": spec.get("variable_mappings") or {},
                "grupo_crm": "Óptica Vortix",
                "visible_en_chat": False,
                "visible_en_hce": False,
                "activo": True,
                "updated_at": now_iso
            }, on_conflict="name").execute()
        except Exception as db_e:
            logger.warning(f"[OpticaTemplates] Error guardando {clean_name} en Supabase: {db_e}")

    return {
        "success": True,
        "name": clean_name,
        "status": meta_status,
        "meta_id": meta_id,
        "mensaje": f"Plantilla '{clean_name}' enviada con éxito a Meta en estado '{meta_status}'."
    }


@optica_vortix_router.delete("/plantillas/{name}")
async def eliminar_plantilla_optica(name: str):
    """
    Elimina una plantilla de Óptica Vortix siempre y cuando NO esté aprobada en Meta.
    Si está APPROVED, se bloquea la eliminación para proteger la estabilidad de campañas y automatizaciones.
    """
    clean_name = name.strip().lower()

    # Verificar estado actual
    status_actual = "NOT_PROVISIONED"
    if supabase:
        try:
            check_res = supabase.table("whatsapp_templates").select("status").eq("name", clean_name).limit(1).execute()
            if check_res.data and len(check_res.data) > 0:
                status_actual = str(check_res.data[0].get("status") or "").upper()
        except Exception as e:
            logger.warning(f"[OpticaTemplates] Error consultando status de {clean_name}: {e}")

    # REGLA ESTRICTA: No se pueden eliminar plantillas aprobadas
    if status_actual == "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"No es posible eliminar la plantilla '{clean_name}' porque está aprobada por Meta. Para suspender su uso en campañas y automatismos, desactívala usando la opción Deshabilitar."
        )

    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
    _, token = get_whatsapp_cloud_credentials()

    if waba_id and token:
        try:
            url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates?name={clean_name}"
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.delete(url, headers={"Authorization": f"Bearer {token}"})
                if res.status_code not in (200, 204, 404):
                    logger.warning(f"[OpticaTemplates] Aviso eliminando {clean_name} en Meta: {res.text}")
        except Exception as e:
            logger.warning(f"[OpticaTemplates] Error conectando con Meta para eliminar: {e}")

    if supabase:
        try:
            supabase.table("whatsapp_templates").delete().eq("name", clean_name).execute()
        except Exception as e:
            logger.error(f"[OpticaTemplates] Error eliminando en Supabase {clean_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Error al eliminar la plantilla de la base de datos: {str(e)}")

    return {"success": True, "mensaje": f"Plantilla '{clean_name}' eliminada correctamente."}


# ============================================================================
# 2. BANDEJA DE CONVERSACIONES Y MENSAJES DE ÓPTICA VORTIX
# ============================================================================

def _map_origen_to_frontend(raw_origen: Optional[str]) -> str:
    """Mapea `origen_oportunidad` de la BD a `OrigenConversacionOptica` del Frontend."""
    orig = str(raw_origen or "").lower()
    if orig in ("auto_receta_aereos", "auto_receta_contacto", "indicacion_lentes_aereos", "indicacion_lentes_contacto", "indicacion_ambos") or "receta" in orig:
        return "DETECCION_RECETA_HOY"
    if orig in ("auto_turno_descuento", "turno_proximo_descuento") or "turno" in orig:
        return "PLACA_TURNO"
    if orig in ("campana_masiva",) or "campana" in orig:
        return "CAMPANA_MARKETING"
    if str(raw_origen or "").upper() in ("DETECCION_RECETA_HOY", "PLACA_TURNO", "CAMPANA_MARKETING", "ENTRANTE_DIRECTO"):
        return str(raw_origen).upper()
    return "ENTRANTE_DIRECTO"


def _enriquecer_conversacion_optica_frontend(r: Dict[str, Any], now_utc: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Enriquece una fila de `optica_conversaciones` con todos los alias esperados por
    `OpticaConversacion` en `frontend/src/types/optica.ts`.
    """
    now_ref = now_utc or datetime.now(timezone.utc)
    contacto = r.get("optica_contactos") if isinstance(r.get("optica_contactos"), dict) else {}

    ventana_abierta = False
    exp_raw = r.get("ventana_24h_expira_at")
    if exp_raw:
        try:
            dt_exp = datetime.fromisoformat(str(exp_raw).replace("Z", "+00:00"))
            ventana_abierta = dt_exp > now_ref
        except Exception:
            pass

    nombre_pac = contacto.get("nombre") or r.get("nombre_contacto") or r.get("nombre_paciente") or f"Contacto {str(r.get('telefono') or '')[-4:]}"
    grad_norm = normalizar_estructura_graduacion(contacto.get("graduacion_actual_json") or r.get("graduacion_actual_json") or {})
    origen_fe = _map_origen_to_frontend(r.get("origen_oportunidad") or r.get("origen"))
    cupon = contacto.get("codigo_cupon_activo") or r.get("cupon_codigo") or generar_codigo_beneficio_vortix(str(contacto.get("ficha_geclisa_id") or r.get("telefono") or ""))

    return {
        **r,
        "nombre_contacto": nombre_pac,
        "nombre_paciente": nombre_pac,
        "ficha_geclisa_id": contacto.get("ficha_geclisa_id") or r.get("ficha_geclisa_id"),
        "dni": contacto.get("dni") or r.get("dni"),
        "obra_social": contacto.get("obra_social") or r.get("obra_social"),
        "cupon_codigo": cupon,
        "codigo_cupon_activo": cupon,
        "ventana_24h_abierta": ventana_abierta,
        "ventana_24h_activa": ventana_abierta,
        "no_leidos": int(r.get("mensajes_no_leidos") or 0),
        "ultimo_mensaje": r.get("ultimo_mensaje_texto") or "",
        "origen": origen_fe,
        "receta_detectada_hoy": origen_fe == "DETECCION_RECETA_HOY",
        "graduacion_actual_json": grad_norm,
        "opt_out": bool(contacto.get("opt_out", False))
    }


def _enriquecer_mensaje_optica_frontend(m: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Agrega los alias `autor_nombre` y `estado_entrega` esperados por `OpticaMensaje`."""
    if not m or not isinstance(m, dict):
        return m
    return {
        **m,
        "autor_nombre": m.get("autor_nombre") or m.get("enviado_por") or "Óptica Vortix",
        "estado_entrega": m.get("estado_entrega") or m.get("estado") or "sent"
    }


@optica_vortix_router.get("/conversaciones")
async def listar_conversaciones_optica(
    etapa_comercial: Optional[str] = Query(None),
    origen: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    archivadas: bool = Query(False),
    limit: int = Query(100, ge=1, le=300)
):
    """
    Lista las conversaciones exclusivas de Óptica Vortix ordenadas por actividad reciente,
    incluyendo los datos del contacto (`optica_contactos`), estado de la ventana de 24h y
    contadores por etapa comercial.
    """
    if not supabase:
        return {"success": True, "conversaciones": [], "items": [], "etapas_counts": {}}

    try:
        query = (
            supabase.table("optica_conversaciones")
            .select("*, optica_contactos(*)")
            .eq("archivada", archivadas)
        )
        if etapa_comercial and etapa_comercial not in ("TODAS", "TODOS", "ALL", ""):
            query = query.eq("etapa_comercial", etapa_comercial)

        res = query.order("ultimo_mensaje_at", desc=True).limit(limit).execute()
        rows = res.data or []

        now_utc = datetime.now(timezone.utc)
        conversaciones: List[Dict[str, Any]] = []

        for r in rows:
            enriched = _enriquecer_conversacion_optica_frontend(r, now_utc)
            if origen and origen not in ("TODOS", "TODAS", "ALL", ""):
                if enriched.get("origen") != origen and r.get("origen_oportunidad") != origen:
                    continue
            if search and search.strip():
                q = search.strip().lower()
                haystack = (
                    f"{enriched.get('nombre_paciente') or ''} {enriched.get('telefono') or ''} "
                    f"{enriched.get('dni') or ''} {enriched.get('obra_social') or ''} {enriched.get('cupon_codigo') or ''}"
                ).lower()
                if q not in haystack:
                    continue

            conversaciones.append(enriched)

        # Contadores por etapa comercial
        all_res = supabase.table("optica_conversaciones").select("etapa_comercial, mensajes_no_leidos").eq("archivada", False).execute()
        etapas_counts: Dict[str, int] = {et: 0 for et in ETAPAS_COMERCIALES_OPTICA}
        total_no_leidos = 0
        for item in (all_res.data or []):
            et = str(item.get("etapa_comercial") or "NUEVA_CONSULTA")
            etapas_counts[et] = etapas_counts.get(et, 0) + 1
            total_no_leidos += int(item.get("mensajes_no_leidos") or 0)

        return {
            "success": True,
            "conversaciones": conversaciones,
            "items": conversaciones,
            "etapas_counts": etapas_counts,
            "total_no_leidos": total_no_leidos
        }
    except Exception as e:
        logger.error(f"[OpticaRouter] Error listando conversaciones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@optica_vortix_router.post("/conversaciones/iniciar")
async def iniciar_conversacion_optica(payload: IniciarConversacionOpticaPayload):
    """
    Inicia o recupera una conversación en la bandeja de Óptica Vortix para un paciente/contacto,
    y opcionalmente le envía una plantilla inicial homologada o mensaje.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")

    tel_norm, err_tel = normalizar_telefono_optica_mza(payload.telefono)
    if not tel_norm:
        raise HTTPException(status_code=400, detail=f"Teléfono inválido ({err_tel}): {payload.telefono}")

    nombre_input = (payload.nombre or payload.nombre_paciente or "").strip() or f"Contacto {tel_norm[-4:]}"
    cupon = generar_codigo_beneficio_vortix(payload.ficha_geclisa_id or tel_norm)
    contacto = upsert_optica_contacto(
        telefono=tel_norm,
        nombre=nombre_input,
        ficha_geclisa_id=payload.ficha_geclisa_id,
        dni=payload.dni,
        obra_social=payload.obra_social,
        codigo_cupon=cupon
    )
    contacto_id = contacto.get("id") if contacto else None
    now_iso = datetime.now(timezone.utc).isoformat()

    ex_c = supabase.table("optica_conversaciones").select("*").eq("telefono", tel_norm).limit(1).execute()
    if ex_c.data:
        conv = ex_c.data[0]
        conv_id = conv["id"]
        supabase.table("optica_conversaciones").update({
            "archivada": False,
            "contacto_id": contacto_id or conv.get("contacto_id"),
            "updated_at": now_iso
        }).eq("id", conv_id).execute()
    else:
        ins_c = supabase.table("optica_conversaciones").insert({
            "contacto_id": contacto_id,
            "telefono": tel_norm,
            "nombre_contacto": (contacto.get("nombre") if contacto else nombre_input) or f"Contacto {tel_norm[-4:]}",
            "estado": "abierta",
            "etapa_comercial": "NUEVA_CONSULTA",
            "origen_oportunidad": payload.origen_oportunidad or "manual_optica",
            "ultimo_mensaje_texto": "Conversación iniciada en Óptica Vortix",
            "ultimo_mensaje_at": now_iso,
            "ultimo_mensaje_direccion": "outbound",
            "created_at": now_iso,
            "updated_at": now_iso
        }).execute()
        conv = ins_c.data[0] if ins_c.data else {}
        conv_id = conv.get("id")

    # Si pidió enviar plantilla o mensaje inicial inmediatamente
    envio_res = None
    if conv_id and (payload.template_name or payload.mensaje_inicial):
        send_req = EnviarMensajeOpticaPayload(
            mensaje=payload.mensaje_inicial,
            template_name=payload.template_name,
            parameters=payload.parameters
        )
        envio_res = await enviar_mensaje_conversacion_optica(conv_id, send_req)

    conv_enriched = _enriquecer_conversacion_optica_frontend({**conv, "optica_contactos": contacto})
    return {
        **conv_enriched,
        "id": conv_id,
        "success": True,
        "conversacion_id": conv_id,
        "conversacion": conv_enriched,
        "contacto": contacto,
        "envio_inicial": envio_res
    }


@optica_vortix_router.get("/conversaciones/{conv_id}/mensajes")
async def obtener_mensajes_optica(conv_id: str, limit: int = Query(150, ge=1, le=500)):
    """
    Obtiene el historial de mensajes de una conversación de Óptica Vortix y marca
    `mensajes_no_leidos = 0` en la conversación.
    """
    if not supabase:
        return {"success": True, "mensajes": [], "items": []}

    try:
        supabase.table("optica_conversaciones").update({"mensajes_no_leidos": 0}).eq("id", conv_id).execute()
        res = (
            supabase.table("optica_mensajes")
            .select("*")
            .eq("conversacion_id", conv_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        msgs = [_enriquecer_mensaje_optica_frontend(m) for m in (res.data or [])]
        return {
            "success": True,
            "conversacion_id": conv_id,
            "mensajes": msgs,
            "items": msgs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@optica_vortix_router.post("/conversaciones/{conv_id}/enviar")
async def enviar_mensaje_conversacion_optica(conv_id: str, payload: EnviarMensajeOpticaPayload):
    """
    Envía un mensaje desde la Línea 3 (Óptica Vortix) dentro de una conversación:
      - Nota interna (`is_internal_note=True` o `tipo='nota_interna'`): se guarda solo en `optica_mensajes` con `tipo='nota_interna'`.
      - Plantilla homologada (`template_name`): se despacha vía `send_template` incluso fuera de ventana 24h.
      - Aviso de Lentes Listos (`aviso_lentes_listos=True`): envía `vortix_lentes_listos_retiro_v1` o texto directo si hay ventana 24h.
      - Cotización (`tipo='cotizacion'` o `cotizacion` dict): envía el presupuesto por WhatsApp y pasa la etapa a `PRESUPUESTO_AEREOS`.
      - Imagen / Placa (`media_url`) o Texto libre (`contenido` / `mensaje`): requiere ventana de 24h abierta.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")

    c_res = supabase.table("optica_conversaciones").select("*, optica_contactos(*)").eq("id", conv_id).limit(1).execute()
    if not c_res.data:
        raise HTTPException(status_code=404, detail="Conversación de óptica no encontrada.")

    conv = c_res.data[0]
    contacto = conv.get("optica_contactos") or {}
    contacto_id = contacto.get("id") or conv.get("contacto_id")
    to_phone = str(conv.get("telefono") or "").strip()
    nombre_pac = (contacto.get("nombre") or conv.get("nombre_contacto") or "Paciente").split(",")[0].title().strip()
    texto_final = (payload.contenido or payload.mensaje or "").strip()
    tipo_req = str(payload.tipo or "text").strip().lower()

    # 1. Nota interna (no sale a WhatsApp)
    if payload.is_internal_note or tipo_req == "nota_interna":
        saved_note = _enriquecer_mensaje_optica_frontend(
            _record_optica_outbound_msg(
                conversacion_id=conv_id,
                contacto_id=contacto_id,
                wamid=None,
                tipo="nota_interna",
                contenido=texto_final,
                enviado_por=payload.usuario_nombre or "óptico",
                metadata=payload.metadata
            )
        )
        return {**(saved_note or {}), "success": True, "tipo": "nota_interna", "mensaje": saved_note}

    opt_phone_id, opt_token = get_whatsapp_optica_credentials()
    if not opt_phone_id or not opt_token:
        raise HTTPException(
            status_code=400,
            detail="La Línea 3 de Óptica Vortix aún no tiene un Phone Number ID exclusivo configurado. Vincule el número en la pestaña Configuración."
        )

    wa_client = WhatsAppCloudClient(phone_number_id=opt_phone_id, access_token=opt_token, line="optica")
    try:
        now_utc = datetime.now(timezone.utc)
        ventana_abierta = False
        if conv.get("ventana_24h_expira_at"):
            try:
                dt_exp = datetime.fromisoformat(str(conv["ventana_24h_expira_at"]).replace("Z", "+00:00"))
                ventana_abierta = dt_exp > now_utc
            except Exception:
                pass

        # 2. Aviso rápido de Lentes Listos para Retirar
        if payload.aviso_lentes_listos:
            detalle = (payload.detalle_pedido or "sus nuevos lentes recetados").strip()
            horario = "Lunes a Viernes de 09:00 a 20:00 hs y Sábados de 09:00 a 13:00 hs"
            if ventana_abierta:
                txt_listos = (
                    f"🎉👓 *¡Tus lentes ya están listos en Óptica Vortix!*\n\n"
                    f"Hola *{nombre_pac}*, te avisamos que tu pedido (*{detalle}*) ya salió del laboratorio, "
                    f"pasó el control de calidad óptico y podés pasar a retirarlo.\n\n"
                    f"🕒 *Horario:* {horario}\n"
                    f"¡Te esperamos!"
                )
                s_res = await wa_client.send_free_text(to_phone=to_phone, text=txt_listos)
                saved = _enriquecer_mensaje_optica_frontend(
                    _record_optica_outbound_msg(conv_id, contacto_id, s_res.get("wamid"), "text", txt_listos, payload.usuario_nombre or "óptico")
                )
            else:
                cfg = get_optica_vortix_full_config()
                tpl_listos = str(cfg.get("template_lentes_listos") or "vortix_lentes_listos_retiro_v1")
                params_listos = [
                    {"type": "text", "text": nombre_pac},
                    {"type": "text", "text": detalle},
                    {"type": "text", "text": horario}
                ]
                s_res = await wa_client.send_template(
                    to_phone=to_phone,
                    template_name=tpl_listos,
                    language_code="es_AR",
                    components=[{"type": "body", "parameters": params_listos}]
                )
                txt_listos = f"📦 [Aviso de Lentes Listos enviado a {nombre_pac}: {detalle}]"
                saved = _enriquecer_mensaje_optica_frontend(
                    _record_optica_outbound_msg(
                        conv_id, contacto_id, s_res.get("wamid"), "template", txt_listos, payload.usuario_nombre or "óptico", template_name=tpl_listos
                    )
                )

            supabase.table("optica_conversaciones").update({
                "etapa_comercial": "LISTO_PARA_RETIRAR",
                "updated_at": now_utc.isoformat()
            }).eq("id", conv_id).execute()
            return {**(saved or {}), "success": True, "mensaje": saved, "etapa_comercial": "LISTO_PARA_RETIRAR"}

        # 3. Envío de Plantilla Homologada
        if payload.template_name:
            tpl_name = payload.template_name.strip()
            params_list = [{"type": "text", "text": str(p)} for p in (payload.parameters or [])]
            components: List[Dict[str, Any]] = []
            if payload.media_url:
                m_id = await obtener_o_subir_placa_media_id(wa_client, payload.media_url)
                if m_id:
                    components.append({"type": "header", "parameters": [{"type": "image", "image": {"id": m_id}}]})
            if params_list:
                components.append({"type": "body", "parameters": params_list})

            s_res = await wa_client.send_template(
                to_phone=to_phone,
                template_name=tpl_name,
                language_code=payload.template_language or "es_AR",
                components=components
            )
            body_preview = texto_final or f"📋 Plantilla enviada: {tpl_name}"
            saved = _enriquecer_mensaje_optica_frontend(
                _record_optica_outbound_msg(
                    conv_id, contacto_id, s_res.get("wamid"), "template", body_preview,
                    payload.usuario_nombre or "óptico", template_name=tpl_name, media_url=payload.media_url
                )
            )
            return {**(saved or {}), "success": True, "mensaje": saved}

        # 4. Envío de Cotización Óptica (vía payload.tipo == 'cotizacion' o payload.cotizacion dict)
        if tipo_req == "cotizacion" or (payload.cotizacion and isinstance(payload.cotizacion, dict)):
            if texto_final and tipo_req == "cotizacion":
                texto_cot = texto_final
                meta_cot = payload.metadata or ({"cotizacion": payload.cotizacion} if payload.cotizacion else {})
            else:
                cot = payload.cotizacion or (payload.metadata or {})
                armazon = cot.get("armazon") or "Armazón seleccionado"
                cristal = cot.get("cristal") or cot.get("cristales") or "Cristales orgánicos con tratamiento"
                tratamientos = cot.get("tratamientos") or "Antirreflex + Filtro Azul"
                if isinstance(tratamientos, list):
                    tratamientos = ", ".join(str(x) for x in tratamientos)
                subtotal = cot.get("subtotal") or ""
                descuento = cot.get("descuento") or f"{cot.get('descuento_pct', 20)}% OFF Cupón Paciente"
                total_final = cot.get("total") or ""
                cuotas = cot.get("cuotas") or "3 y 6 cuotas sin interés"
                cupon_str = contacto.get("codigo_cupon_activo") or "#VORTIX"

                texto_cot = (
                    f"👓 *Presupuesto Personalizado • Óptica Vortix*\n"
                    f"👤 *Paciente:* {nombre_pac}\n\n"
                    f"🔹 *Armazón:* {armazon}\n"
                    f"🔹 *Cristales:* {cristal}\n"
                    f"✨ *Tratamientos:* {tratamientos}\n"
                )
                if subtotal:
                    texto_cot += f"💵 *Valor de lista:* ${subtotal}\n"
                texto_cot += (
                    f"🎟️ *Beneficio aplicado ({cupon_str}):* {descuento}\n"
                    f"✅ *TOTAL CON DESCUENTO:* *${total_final}*\n"
                    f"💳 *Financiación:* {cuotas}\n\n"
                    f"¿Querés que dejemos encargado tu pedido al laboratorio o preferís probar los armazones en la óptica?"
                )
                meta_cot = {"cotizacion": cot}

            s_res = await wa_client.send_free_text(to_phone=to_phone, text=texto_cot)
            saved = _enriquecer_mensaje_optica_frontend(
                _record_optica_outbound_msg(
                    conv_id, contacto_id, s_res.get("wamid"), "cotizacion", texto_cot,
                    payload.usuario_nombre or "óptico", metadata=meta_cot
                )
            )
            supabase.table("optica_conversaciones").update({
                "etapa_comercial": "PRESUPUESTO_AEREOS",
                "updated_at": now_utc.isoformat()
            }).eq("id", conv_id).execute()
            return {**(saved or {}), "success": True, "mensaje": saved, "etapa_comercial": "PRESUPUESTO_AEREOS"}

        # 5. Envío de Multimedia (Imagen / Placa / PDF)
        if payload.media_url:
            caption = texto_final or None
            s_res = await wa_client.send_media(
                to_phone=to_phone,
                media_type=payload.media_type or "image",
                media_url=payload.media_url,
                caption=caption
            )
            saved = _enriquecer_mensaje_optica_frontend(
                _record_optica_outbound_msg(
                    conv_id, contacto_id, s_res.get("wamid"), payload.media_type or "image",
                    caption or "📷 [Imagen / Placa Promocional]", payload.usuario_nombre or "óptico",
                    media_url=payload.media_url
                )
            )
            return {**(saved or {}), "success": True, "mensaje": saved}

        # 6. Envío de Texto Libre
        if not texto_final:
            raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío.")

        s_res = await wa_client.send_free_text(to_phone=to_phone, text=texto_final, preview_url=True)
        saved = _enriquecer_mensaje_optica_frontend(
            _record_optica_outbound_msg(
                conv_id, contacto_id, s_res.get("wamid"), "text", texto_final, payload.usuario_nombre or "óptico", metadata=payload.metadata
            )
        )
        return {**(saved or {}), "success": True, "mensaje": saved}

    except ConversationWindowClosedError:
        raise HTTPException(
            status_code=400,
            detail="La ventana gratuita de 24 horas de Meta está cerrada para este contacto. Seleccioná una Plantilla de Óptica Vortix para reabrir la conversación."
        )
    except MetaAPIError as me:
        raise HTTPException(status_code=400, detail=f"Error de Meta WhatsApp API: {me.message}")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    finally:
        await wa_client.close()


@optica_vortix_router.patch("/conversaciones/{conv_id}")
async def actualizar_conversacion_optica(conv_id: str, payload: PatchConversacionOpticaPayload):
    """
    Actualiza el estado comercial del embudo óptico (`etapa_comercial`), asignación, archivo,
    pausa del bot o graduación del paciente.
    Si `etapa_comercial == 'VENDIDO'`, marca automáticamente como `vendido` las oportunidades vinculadas.
    Si `etapa_comercial == 'LISTO_PARA_RETIRAR'` y `notificar_lentes_listos=True`, envía el aviso por WhatsApp.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")

    c_res = supabase.table("optica_conversaciones").select("*").eq("id", conv_id).limit(1).execute()
    if not c_res.data:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    conv = c_res.data[0]
    contacto_id = conv.get("contacto_id")
    tel = conv.get("telefono")
    now_iso = datetime.now(timezone.utc).isoformat()

    upd_conv: Dict[str, Any] = {"updated_at": now_iso}
    if payload.etapa_comercial is not None:
        upd_conv["etapa_comercial"] = payload.etapa_comercial
    if payload.asignado_a is not None:
        upd_conv["asignado_a"] = payload.asignado_a
    if payload.archivada is not None:
        upd_conv["archivada"] = payload.archivada
    if payload.bot_paused is not None:
        upd_conv["bot_paused"] = payload.bot_paused

    supabase.table("optica_conversaciones").update(upd_conv).eq("id", conv_id).execute()

    # Actualizar datos del contacto si vinieron en el PATCH
    if contacto_id and (payload.graduacion_actual_json is not None or payload.notas is not None or payload.codigo_cupon_activo is not None):
        upd_cont: Dict[str, Any] = {"updated_at": now_iso}
        if payload.graduacion_actual_json is not None:
            upd_cont["graduacion_actual_json"] = normalizar_estructura_graduacion(payload.graduacion_actual_json)
        if payload.notas is not None:
            upd_cont["notas"] = payload.notas
        if payload.codigo_cupon_activo is not None:
            upd_cont["codigo_cupon_activo"] = payload.codigo_cupon_activo
        supabase.table("optica_contactos").update(upd_cont).eq("id", contacto_id).execute()

    # Sincronizar oportunidades vinculadas si pasó a PRESUPUESTO_AEREOS o VENDIDO
    if payload.etapa_comercial == "VENDIDO" and tel:
        supabase.table("optica_oportunidades_geclisa").update({
            "estado_comercial": "vendido",
            "updated_at": now_iso
        }).eq("telefono", tel).neq("estado_comercial", "descartada").execute()
    elif payload.etapa_comercial in ("PRESUPUESTO_AEREOS", "LENTES_CONTACTO") and tel:
        supabase.table("optica_oportunidades_geclisa").update({
            "estado_comercial": "presupuestado",
            "updated_at": now_iso
        }).eq("telefono", tel).in_("estado_comercial", ["detectada", "mensaje_encolado", "mensaje_enviado", "respondio"]).execute()

    notificacion_res = None
    if payload.notificar_lentes_listos:
        notificacion_res = await enviar_mensaje_conversacion_optica(
            conv_id,
            EnviarMensajeOpticaPayload(
                aviso_lentes_listos=True,
                detalle_pedido=payload.detalle_pedido or "sus nuevos lentes recetados"
            )
        )

    updated = supabase.table("optica_conversaciones").select("*, optica_contactos(*)").eq("id", conv_id).limit(1).execute()
    conv_out = _enriquecer_conversacion_optica_frontend(updated.data[0]) if updated.data else upd_conv
    return {
        "success": True,
        "conversacion": conv_out,
        "notificacion_lentes_listos": notificacion_res
    }


@optica_vortix_router.get("/conversaciones/{conv_id}/ficha-optica")
async def obtener_ficha_optica_conversacion(conv_id: str):
    """
    Devuelve la Ficha Óptica 360° para el panel derecho del chat de Óptica Vortix:
      - Datos del contacto (`optica_contactos`) y graduación actual (`graduacion` / `graduacion_actual`).
      - Cupón de beneficio activo (`#VORTIX-XXXX`).
      - Oportunidades detectadas en Geclisa (`optica_oportunidades_geclisa`) y `evolucion_geclisa_hoy`.
      - Próximos turnos e indicaciones médicas en vivo desde Geclisa si el contacto tiene `ficha_geclisa_id` o `dni`.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")

    c_res = supabase.table("optica_conversaciones").select("*, optica_contactos(*)").eq("id", conv_id).limit(1).execute()
    if not c_res.data:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    conv = _enriquecer_conversacion_optica_frontend(c_res.data[0])
    contacto = conv.get("optica_contactos") or {}
    tel = conv.get("telefono")
    ficha_id = contacto.get("ficha_geclisa_id")
    dni = contacto.get("dni")

    oportunidades = []
    if tel or ficha_id:
        op_q = supabase.table("optica_oportunidades_geclisa").select("*").order("created_at", desc=True).limit(10)
        if ficha_id:
            op_q = op_q.eq("ficha_geclisa_id", str(ficha_id))
        elif tel:
            op_q = op_q.eq("telefono", str(tel))
        op_res = op_q.execute()
        oportunidades = op_res.data or []
        if not ficha_id and oportunidades:
            ficha_id = oportunidades[0].get("ficha_geclisa_id")

    turnos_pendientes = []
    indicaciones_recientes = []
    if ficha_id and str(ficha_id).isdigit():
        try:
            t_pend = await asyncio.to_thread(geclisa_client.obtener_turnos_pendientes_ficha, int(ficha_id))
            turnos_pendientes = (t_pend.get("turnos") or [])[:5]
        except Exception:
            pass
        try:
            ind_g = await asyncio.to_thread(geclisa_client.obtener_indicaciones_medicas, int(ficha_id))
            indicaciones_recientes = (ind_g.get("indicaciones") or [])[:8]
        except Exception:
            pass

    grad_norm = normalizar_estructura_graduacion(contacto.get("graduacion_actual_json") or {})

    # Construir evolucion_geclisa_hoy para el panel derecho del Frontend
    evolucion_geclisa_hoy = None
    for op in oportunidades:
        if op.get("texto_indicacion_detectada"):
            evolucion_geclisa_hoy = {
                "fecha": str(op.get("fecha_turno") or op.get("created_at") or "")[:10],
                "medico": op.get("prestador_nombre") or "Oftalmólogo",
                "texto_evolucion": op.get("texto_indicacion_detectada"),
                "tipo_indicacion": "Lentes de Contacto" if "contacto" in str(op.get("tipo_oportunidad") or "") else "Lentes Aéreos / Anteojos"
            }
            break
    if not evolucion_geclisa_hoy and indicaciones_recientes:
        ind0 = indicaciones_recientes[0]
        evolucion_geclisa_hoy = {
            "fecha": str(ind0.get("fecha") or ""),
            "medico": str(ind0.get("prestador") or "Oftalmólogo"),
            "texto_evolucion": f"{ind0.get('titulo') or ''}: {ind0.get('texto') or ''}".strip(" :"),
            "tipo_indicacion": str(ind0.get("tipo") or "Indicación Médica")
        }

    return {
        "success": True,
        "conversacion": conv,
        "contacto": contacto,
        "graduacion": grad_norm,
        "graduacion_actual": grad_norm,
        "evolucion_geclisa_hoy": evolucion_geclisa_hoy,
        "codigo_cupon_activo": contacto.get("codigo_cupon_activo") or generar_codigo_beneficio_vortix(str(ficha_id or tel)),
        "oportunidades_geclisa": oportunidades,
        "turnos_pendientes_geclisa": turnos_pendientes,
        "indicaciones_geclisa": indicaciones_recientes
    }


# ============================================================================
# 3. ENDPOINTS DE INTELIGENCIA ARTIFICIAL (OCR RECETA + COPILOTO ÓPTICO)
# ============================================================================

@optica_vortix_router.post("/ia/ocr-receta")
async def ocr_receta_endpoint(payload: OcrRecetaPayload):
    """Extrae la graduación (OD, OI, Adición, DNP) desde la foto de una receta médica usando Gemini Vision con rotación opcional."""
    try:
        res = await extraer_graduacion_desde_imagen_receta(
            media_url_or_base64=payload.media_url,
            conversacion_id=payload.conversacion_id,
            contacto_id=payload.contacto_id,
            rotacion_grados=int(payload.rotacion_grados or 0)
        )
        grad = normalizar_estructura_graduacion(res.get("graduacion"))
        return {
            **grad,
            "success": True,
            "graduacion": grad
        }
    except Exception as e:
        logger.error(f"[OpticaOCR] Error en endpoint OCR: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@optica_vortix_router.post("/ia/copiloto")
async def copiloto_optica_endpoint(payload: CopilotoOpticaPayload):
    """Genera sugerencias de respuesta comercial, mejora borradores o resume la conversación óptica."""
    try:
        res = await asyncio.to_thread(
            generar_sugerencia_copiloto_optica,
            payload.conversacion_id,
            payload.accion,
            payload.texto_actual or ""
        )
        return res
    except Exception as e:
        logger.error(f"[OpticaCopiloto] Error en copiloto: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 4. OPORTUNIDADES DETECTADAS EN GECLISA (RECETAS HOY & TURNOS PRÓXIMOS)
# ============================================================================

_MAP_TIPO_OP_FE_TO_DB = {
    "LENTES_AEREOS": "indicacion_lentes_aereos",
    "LENTES_CONTACTO": "indicacion_lentes_contacto",
    "AMBOS": "indicacion_ambos",
    "TURNO_ANTICIPADO": "turno_proximo_descuento"
}
_MAP_TIPO_OP_DB_TO_FE = {v: k for k, v in _MAP_TIPO_OP_FE_TO_DB.items()}

_MAP_ESTADO_OP_FE_TO_DB = {
    "DETECTADO": "detectada",
    "ENCOLADO": "mensaje_encolado",
    "ENVIADO": "mensaje_enviado",
    "EN_CONVERSACION": "respondio",
    "COTIZADO": "presupuestado",
    "VENDIDO": "vendido",
    "DESCARTADO": "descartada"
}
_MAP_ESTADO_OP_DB_TO_FE = {
    "detectada": "DETECTADO",
    "sin_telefono": "DETECTADO",
    "mensaje_encolado": "ENCOLADO",
    "mensaje_enviado": "ENVIADO",
    "respondio": "EN_CONVERSACION",
    "presupuestado": "COTIZADO",
    "vendido": "VENDIDO",
    "descartada": "DESCARTADO"
}


def _enriquecer_oportunidad_optica_frontend(r: Dict[str, Any]) -> Dict[str, Any]:
    """Enriquece una fila de `optica_oportunidades_geclisa` con los alias de `OpticaOportunidadGeclisa`."""
    raw_tipo = str(r.get("tipo_oportunidad") or "indicacion_lentes_aereos")
    raw_est = str(r.get("estado_comercial") or "detectada")
    tipo_fe = _MAP_TIPO_OP_DB_TO_FE.get(raw_tipo, raw_tipo.upper())
    est_fe = _MAP_ESTADO_OP_DB_TO_FE.get(raw_est, raw_est.upper())

    return {
        **r,
        "nombre_paciente": r.get("paciente_nombre") or r.get("nombre_paciente") or "Paciente",
        "telefono_normalizado": r.get("telefono") or "",
        "medico_nombre": r.get("prestador_nombre") or "Oftalmólogo",
        "servicio_turno": r.get("servicio_practica") or "Consulta Oftalmológica",
        "cupon_codigo": r.get("codigo_beneficio") or "",
        "extracto_clinico": r.get("texto_indicacion_detectada") or f"Turno programado: {r.get('servicio_practica') or 'Consulta'}",
        "graduacion_extraida": normalizar_estructura_graduacion(r.get("graduacion_json") or {}),
        "tipo_oportunidad": tipo_fe,
        "tipo_oportunidad_raw": raw_tipo,
        "estado_comercial": est_fe,
        "estado_comercial_raw": raw_est
    }


@optica_vortix_router.get("/oportunidades")
async def listar_oportunidades_optica(
    fecha: Optional[str] = Query(None),
    tipo_oportunidad: Optional[str] = Query(None),
    estado_comercial: Optional[str] = Query(None),
    limit: int = Query(150, ge=1, le=500)
):
    """
    Lista las oportunidades comerciales detectadas en Geclisa (`optica_oportunidades_geclisa`)
    junto con KPIs de conversión del día/período.
    """
    if not supabase:
        return {"success": True, "oportunidades": [], "items": [], "kpis": {}}

    try:
        query = supabase.table("optica_oportunidades_geclisa").select("*")
        if fecha and re.match(r"^\d{4}-\d{2}-\d{2}$", fecha.strip()):
            f_clean = fecha.strip()
            query = query.gte("fecha_turno", f"{f_clean}T00:00:00").lte("fecha_turno", f"{f_clean}T23:59:59")
        if tipo_oportunidad and tipo_oportunidad not in ("TODOS", "TODAS", "ALL", ""):
            db_tipo = _MAP_TIPO_OP_FE_TO_DB.get(tipo_oportunidad.strip().upper(), tipo_oportunidad.strip())
            query = query.eq("tipo_oportunidad", db_tipo)
        if estado_comercial and estado_comercial not in ("TODOS", "TODAS", "ALL", ""):
            db_est = _MAP_ESTADO_OP_FE_TO_DB.get(estado_comercial.strip().upper(), estado_comercial.strip())
            query = query.eq("estado_comercial", db_est)

        res = query.order("created_at", desc=True).limit(limit).execute()
        raw_rows = res.data or []
        enriched_rows = [_enriquecer_oportunidad_optica_frontend(r) for r in raw_rows]

        kpis = {
            "total": len(raw_rows),
            "lentes_aereos": sum(1 for r in raw_rows if r.get("tipo_oportunidad") in ("indicacion_lentes_aereos", "indicacion_ambos")),
            "lentes_contacto": sum(1 for r in raw_rows if r.get("tipo_oportunidad") in ("indicacion_lentes_contacto", "indicacion_ambos")),
            "turnos_descuento": sum(1 for r in raw_rows if r.get("tipo_oportunidad") == "turno_proximo_descuento"),
            "pendientes_contactar": sum(1 for r in raw_rows if r.get("estado_comercial") == "detectada"),
            "contactados": sum(1 for r in raw_rows if r.get("estado_comercial") in ("mensaje_encolado", "mensaje_enviado")),
            "respondieron": sum(1 for r in raw_rows if r.get("estado_comercial") in ("respondio", "presupuestado")),
            "vendidos": sum(1 for r in raw_rows if r.get("estado_comercial") == "vendido")
        }

        return {
            "success": True,
            "oportunidades": enriched_rows,
            "items": enriched_rows,
            "kpis": kpis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@optica_vortix_router.post("/oportunidades/sincronizar-hoy")
async def sincronizar_indicaciones_hoy_endpoint(payload: Optional[SincronizarHoyPayload] = Body(default=None)):
    """Dispara en vivo el Motor 2 (`detectar_indicaciones_lentes_del_dia`) contra Geclisa / HCE."""
    fecha = payload.fecha if payload else None
    auto_enc = payload.auto_encolar if payload else None
    res = await asyncio.to_thread(detectar_indicaciones_lentes_del_dia, fecha, auto_enc)
    return res


@optica_vortix_router.get("/oportunidades/preview-turnos")
async def preview_turnos_proximos_endpoint(
    dias_anticipacion: int = Query(1, ge=0, le=14),
    fecha_objetivo: Optional[str] = Query(None)
):
    """
    Ejecuta el Motor 1 en modo `dry_run=True` para previsualizar qué pacientes con turno
    en Geclisa recibirán el voucher de descuento `#VORTIX-XXXX` y cuáles fueron excluidos.
    """
    res = await asyncio.to_thread(
        sincronizar_turnos_proximos_optica,
        dias_anticipacion,
        True,
        False,
        fecha_objetivo
    )
    return res


@optica_vortix_router.post("/oportunidades/sincronizar-turnos")
async def sincronizar_turnos_proximos_endpoint(payload: SincronizarTurnosPayload):
    """
    Ejecuta el Motor 1 en modo real (`dry_run=False`), registrando las oportunidades de turnos
    próximos y encolando los vouchers de descuento en la cola anti-bloqueo.
    """
    res = await asyncio.to_thread(
        sincronizar_turnos_proximos_optica,
        payload.dias_anticipacion,
        False,
        payload.encolar_envios,
        payload.fecha_objetivo
    )
    return res


@optica_vortix_router.post("/oportunidades/{oport_id}/contactar")
async def contactar_oportunidad_individual(oport_id: str, payload: Optional[ContactarOportunidadPayload] = Body(default=None)):
    """
    Encola o envía inmediatamente el mensaje de WhatsApp para una oportunidad específica de Geclisa
    y devuelve su `conversacion_id` para abrir el chat en la bandeja de Óptica Vortix.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")

    tpl_override = payload.template_name if payload else None
    enc_res = encolar_envio_oportunidad_optica(oportunidad_id=oport_id, delay_seconds=0, template_override=tpl_override)
    if not enc_res.get("success"):
        raise HTTPException(status_code=400, detail=enc_res.get("error") or "No se pudo encolar la oportunidad.")

    # Intentar despachar inmediatamente el lote pendiente si la Línea 3 está activa
    dispatch_res = await procesar_cola_envios_optica(max_batch=2, force_outside_hours=True)

    # Asegurar que exista la conversación para que el frontend pueda abrirla con 1 clic
    op_row = supabase.table("optica_oportunidades_geclisa").select("*").eq("id", oport_id).limit(1).execute()
    conv_id = None
    if op_row.data:
        op = op_row.data[0]
        tel = op.get("telefono")
        if tel:
            c_q = supabase.table("optica_conversaciones").select("id").eq("telefono", tel).limit(1).execute()
            if c_q.data:
                conv_id = c_q.data[0]["id"]
            else:
                now_iso = datetime.now(timezone.utc).isoformat()
                ins_c = supabase.table("optica_conversaciones").insert({
                    "contacto_id": op.get("contacto_id"),
                    "telefono": tel,
                    "nombre_contacto": op.get("paciente_nombre"),
                    "estado": "abierta",
                    "etapa_comercial": "LENTES_CONTACTO" if op.get("tipo_oportunidad") == "indicacion_lentes_contacto" else "PRESUPUESTO_AEREOS",
                    "origen_oportunidad": op.get("tipo_oportunidad"),
                    "ultimo_mensaje_texto": f"Oportunidad contactada ({enc_res.get('template_name')})",
                    "ultimo_mensaje_at": now_iso,
                    "ultimo_mensaje_direccion": "outbound",
                    "created_at": now_iso,
                    "updated_at": now_iso
                }).execute()
                if ins_c.data:
                    conv_id = ins_c.data[0]["id"]

    return {
        "success": True,
        "envio": enc_res,
        "dispatch": dispatch_res,
        "conversacion_id": conv_id
    }


@optica_vortix_router.post("/oportunidades/contactar-lote")
async def contactar_lote_oportunidades(payload: ContactarLotePayload):
    """Encola con goteo escalonado un lote de oportunidades seleccionadas por el óptico."""
    encoladas = 0
    errores = []
    for idx, oid in enumerate(payload.oportunidad_ids):
        res = encolar_envio_oportunidad_optica(
            oportunidad_id=oid,
            delay_seconds=idx * 20,
            template_override=payload.template_name
        )
        if res.get("success"):
            encoladas += 1
        else:
            errores.append({"id": oid, "error": res.get("error")})

    return {
        "success": True,
        "encoladas": encoladas,
        "errores": errores
    }


# ============================================================================
# 5. CAMPAÑAS PROMOCIONALES, COLA DE GOTEO Y GALERÍA DE PLACAS GRÁFICAS
# ============================================================================

def _enriquecer_campana_optica_frontend(c: Dict[str, Any]) -> Dict[str, Any]:
    """Enriquece una fila de `optica_campanas` con los alias de `OpticaCampana` (`frontend/src/types/optica.ts`)."""
    filtro = c.get("filtro_audiencia") if isinstance(c.get("filtro_audiencia"), dict) else {}
    goteo = c.get("config_goteo_json") if isinstance(c.get("config_goteo_json"), dict) else {}
    est_raw = str(c.get("estado") or "borrador").lower()
    if est_raw in ("en_curso", "activa"):
        est_fe = "EN_CURSO"
    elif est_raw in ("pausada", "pausado"):
        est_fe = "PAUSADA"
    elif est_raw in ("completada", "finalizada"):
        est_fe = "COMPLETADA"
    else:
        est_fe = "BORRADOR"

    estr_raw = str(c.get("estrategia_envio") or "").lower()
    estr_fe = "DOBLE_PASO_VENTANA" if "doble" in estr_raw else "DIRECTA_IMAGEN"

    return {
        **c,
        "segmento": filtro.get("segmento") or c.get("tipo") or "TODOS_CLIENTES_OPTICA",
        "estrategia": estr_fe,
        "placa_url": c.get("placa_imagen_url") or "",
        "descuento_texto": filtro.get("descuento_texto") or "20% OFF",
        "estado": est_fe,
        "estado_raw": est_raw,
        "total_audiencia": int(c.get("total_destinatarios") or 0),
        "enviados": int(c.get("enviados_count") or 0),
        "entregados": int(c.get("entregados_count") or 0),
        "leidos": int(c.get("leidos_count") or 0),
        "respondidos": int(c.get("respondidos_count") or 0),
        "convertidos": int(c.get("ventas_cerradas_count") or 0),
        "jitter_min_seg": int(goteo.get("intervalo_min_seg") or 15),
        "jitter_max_seg": int(goteo.get("intervalo_max_seg") or 35),
        "lote_max_hora": int(goteo.get("lote_size") or 30)
    }


@optica_vortix_router.get("/campanas")
async def listar_campanas_optica():
    """Lista todas las campañas promocionales de Óptica Vortix y el resumen de la cola."""
    if not supabase:
        return {"success": True, "campanas": [], "items": []}
    res = supabase.table("optica_campanas").select("*").order("created_at", desc=True).limit(50).execute()
    items = [_enriquecer_campana_optica_frontend(c) for c in (res.data or [])]
    return {
        "success": True,
        "campanas": items,
        "items": items
    }


@optica_vortix_router.post("/campanas")
async def crear_campana_optica(payload: CrearCampanaOpticaPayload):
    """
    Crea una campaña segmentada en `public.optica_campanas` y, si `lanzar_ahora=True`,
    genera los ítems escalonados en `public.optica_envios_programados`.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")

    now_iso = datetime.now(timezone.utc).isoformat()
    cfg = get_optica_vortix_full_config()
    goteo_default = {
        "intervalo_min_seg": payload.jitter_min_seg or cfg.get("intervalo_min_seg", 15),
        "intervalo_max_seg": payload.jitter_max_seg or cfg.get("intervalo_max_seg", 35),
        "lote_size": payload.lote_max_hora or cfg.get("lote_size", 30),
        "pausa_lote_min": cfg.get("pausa_lote_min", 5),
        "hora_inicio": cfg.get("hora_inicio_envios", "09:00"),
        "hora_fin": cfg.get("hora_fin_envios", "20:00")
    }

    estrategia_db = payload.estrategia_envio
    if payload.estrategia:
        estrategia_db = "doble_paso_ventana" if "DOBLE" in payload.estrategia.upper() else "template_directo"

    filtro_aud = dict(payload.filtro_audiencia or {})
    if payload.segmento:
        filtro_aud["segmento"] = payload.segmento
    if payload.descuento_texto:
        filtro_aud["descuento_texto"] = payload.descuento_texto

    tpl_final = (payload.template_name or "").strip() or str(cfg.get("template_turno_descuento") or "vortix_beneficio_turno_v1")
    placa_final = payload.placa_imagen_url or payload.placa_url or None

    camp_record = {
        "nombre": payload.nombre.strip(),
        "tipo": payload.segmento or payload.tipo,
        "estrategia_envio": estrategia_db,
        "template_name": tpl_final,
        "template_language": payload.template_language or "es_AR",
        "placa_imagen_url": placa_final,
        "variables_mapeo": payload.variables_mapeo or [],
        "filtro_audiencia": filtro_aud,
        "config_goteo_json": payload.config_goteo_json or goteo_default,
        "estado": "borrador",
        "programada_para": payload.programada_para or now_iso,
        "created_by": payload.created_by or "Óptica Vortix",
        "created_at": now_iso,
        "updated_at": now_iso
    }

    ins = supabase.table("optica_campanas").insert(camp_record).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="No se pudo crear la campaña.")

    camp = _enriquecer_campana_optica_frontend(ins.data[0])
    if payload.lanzar_ahora:
        return await lanzar_campana_optica(camp["id"])

    return {**camp, "success": True, "campana": camp}


@optica_vortix_router.post("/campanas/{camp_id}/lanzar")
async def lanzar_campana_optica(camp_id: str):
    """
    Construye la audiencia elegible (excluyendo `opt_out=True`), encola los envíos con goteo
    en `public.optica_envios_programados` y pasa la campaña a estado `en_curso`.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")

    c_res = supabase.table("optica_campanas").select("*").eq("id", camp_id).limit(1).execute()
    if not c_res.data:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    camp = c_res.data[0]
    filtro = camp.get("filtro_audiencia") or {}
    goteo = camp.get("config_goteo_json") or {}
    int_min = int(goteo.get("intervalo_min_seg", 15))
    int_max = int(goteo.get("intervalo_max_seg", 35))
    lote_sz = max(1, int(goteo.get("lote_size", 30)))
    pausa_min = int(goteo.get("pausa_lote_min", 5))

    # Consultar contactos elegibles en optica_contactos (sin opt_out)
    cont_q = supabase.table("optica_contactos").select("*").eq("opt_out", False)
    if filtro.get("obra_social"):
        cont_q = cont_q.ilike("obra_social", f"%{filtro['obra_social']}%")
    cont_res = cont_q.limit(500).execute()
    contactos = cont_res.data or []

    now_utc = datetime.now(timezone.utc)
    cfg = get_optica_vortix_full_config()
    descuento = str(filtro.get("descuento_texto") or cfg.get("porcentaje_descuento_turno") or "20% OFF")
    accumulated_delay = 0
    encolados = 0

    for idx, ct in enumerate(contactos):
        tel = str(ct.get("telefono") or "").strip()
        if not tel:
            continue
        if idx > 0 and idx % lote_sz == 0:
            accumulated_delay += pausa_min * 60
        accumulated_delay += random.randint(int_min, max(int_min + 1, int_max))

        prog_at = (now_utc + timedelta(seconds=accumulated_delay)).isoformat()
        nombre_corto = str(ct.get("nombre") or "Paciente").split(",")[0].title().strip()
        cupon = str(ct.get("codigo_cupon_activo") or generar_codigo_beneficio_vortix(tel))

        tpl_name = camp.get("template_name") or "vortix_beneficio_turno_v1"
        if "contacto" in tpl_name:
            params = [
                {"type": "text", "text": nombre_corto},
                {"type": "text", "text": "nuestro equipo de oftalmólogos"},
                {"type": "text", "text": cupon}
            ]
        else:
            params = [
                {"type": "text", "text": nombre_corto},
                {"type": "text", "text": "esta semana"},
                {"type": "text", "text": descuento},
                {"type": "text", "text": cupon}
            ]

        dedup = f"camp:{camp_id}:{tel}"
        try:
            supabase.table("optica_envios_programados").upsert({
                "campana_id": camp_id,
                "contacto_id": ct.get("id"),
                "telefono": tel,
                "dedup_key": dedup,
                "origen": "campana_masiva",
                "template_name": tpl_name,
                "template_language": camp.get("template_language") or "es_AR",
                "parameters": params,
                "header_media_url": camp.get("placa_imagen_url"),
                "prioridad": 5,
                "programado_para": prog_at,
                "estado": "pendiente",
                "updated_at": now_utc.isoformat()
            }, on_conflict="dedup_key").execute()
            encolados += 1
        except Exception as e_q:
            logger.debug(f"[CampanaOptica] Error encolando {tel}: {e_q}")

    upd = supabase.table("optica_campanas").update({
        "estado": "en_curso",
        "total_destinatarios": encolados,
        "updated_at": now_utc.isoformat()
    }).eq("id", camp_id).execute()

    camp_out = _enriquecer_campana_optica_frontend(upd.data[0] if upd.data else camp)
    return {
        **camp_out,
        "success": True,
        "campana": camp_out,
        "destinatarios_encolados": encolados
    }


@optica_vortix_router.post("/campanas/{camp_id}/pausar")
async def pausar_campana_optica(camp_id: str):
    """Pausa una campaña en curso y detiene sus envíos pendientes."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase no disponible")
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase.table("optica_envios_programados").update({
        "estado": "pausado",
        "updated_at": now_iso
    }).eq("campana_id", camp_id).eq("estado", "pendiente").execute()

    upd = supabase.table("optica_campanas").update({
        "estado": "pausada",
        "updated_at": now_iso
    }).eq("id", camp_id).execute()
    camp_out = _enriquecer_campana_optica_frontend(upd.data[0]) if upd.data else {}
    return {**camp_out, "success": True, "campana": camp_out}


@optica_vortix_router.post("/cola/procesar-ahora")
async def procesar_cola_ahora_endpoint():
    """Fuerza el procesamiento inmediato de un lote de la cola de Óptica Vortix."""
    return await procesar_cola_envios_optica(max_batch=10, force_outside_hours=True)


def _normalizar_placa_item(p: Dict[str, Any]) -> Dict[str, Any]:
    """Asegura que cada placa contenga `url` y `url_imagen` para compatibilidad con `OpticaPlacaPromocional`."""
    img_url = str(p.get("url_imagen") or p.get("url") or "").strip()
    cat_raw = str(p.get("categoria") or "GENERAL").strip().upper()
    return {
        **p,
        "url": img_url,
        "url_imagen": img_url,
        "categoria": cat_raw
    }


@optica_vortix_router.get("/placas")
async def listar_placas_optica():
    """Devuelve la galería de placas promocionales configuradas en Óptica Vortix."""
    cfg = get_optica_vortix_full_config()
    raw_placas = cfg.get("placas_galeria") or []
    placas = [_normalizar_placa_item(p) for p in raw_placas if isinstance(p, dict)]
    return {
        "success": True,
        "placas": placas,
        "items": placas,
        "placa_turno_url": cfg.get("placa_turno_url") or "",
        "placa_aereos_url": cfg.get("placa_aereos_url") or "",
        "placa_contacto_url": cfg.get("placa_contacto_url") or ""
    }


@optica_vortix_router.post("/placas/upload")
async def subir_placa_promocional_optica(request: Request):
    """
    Registra o sube una placa promocional para Óptica Vortix.
    Soporta tanto `application/json` (`{ titulo, url_imagen, categoria }`) enviado por la UI
    como `multipart/form-data` con un archivo binario (`archivo`, `titulo`, `categoria`).
    """
    content_type = (request.headers.get("content-type") or "").lower()
    titulo = "Placa Promocional Óptica Vortix"
    categoria = "PROMO_ARMAZONES"
    media_url = ""
    orig_name = "placa_vortix.jpg"
    asignar_como_predeterminada = False

    if "application/json" in content_type:
        body = await request.json()
        titulo = str(body.get("titulo") or titulo).strip()
        categoria = str(body.get("categoria") or categoria).strip()
        media_url = str(body.get("url_imagen") or body.get("url") or "").strip()
        asignar_como_predeterminada = bool(body.get("asignar_como_predeterminada", False))
        if not media_url:
            raise HTTPException(status_code=400, detail="Falta `url_imagen` de la placa promocional.")
    else:
        form = await request.form()
        archivo = form.get("archivo") or form.get("file")
        titulo = str(form.get("titulo") or titulo).strip()
        categoria = str(form.get("categoria") or categoria).strip()
        asignar_como_predeterminada = str(form.get("asignar_como_predeterminada") or "false").lower() in ("true", "1", "yes")
        url_directa = str(form.get("url_imagen") or form.get("url") or "").strip()

        if archivo and hasattr(archivo, "read"):
            file_bytes = await archivo.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail="El archivo subido está vacío.")
            mime_type = getattr(archivo, "content_type", None) or "image/jpeg"
            orig_name = getattr(archivo, "filename", None) or f"placa_vortix_{int(datetime.now().timestamp())}.jpg"
            saved = MediaService.save_media_bytes(
                data=file_bytes,
                subfolder="images",
                mime_type=mime_type,
                original_filename=orig_name,
                prefix="vortix_placa"
            )
            media_url = (saved.get("media_url") or "").rstrip("?")
            orig_name = saved.get("file_name") or orig_name
        elif url_directa:
            media_url = url_directa
        else:
            raise HTTPException(status_code=400, detail="Debés enviar un archivo de imagen o `url_imagen`.")

    cfg = get_optica_vortix_full_config()
    galeria: List[Dict[str, Any]] = list(cfg.get("placas_galeria") or [])
    nueva_placa = _normalizar_placa_item({
        "id": str(uuid.uuid4()),
        "titulo": titulo,
        "categoria": categoria.upper(),
        "url": media_url,
        "url_imagen": media_url,
        "file_name": orig_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    galeria.insert(0, nueva_placa)

    updates: Dict[str, Any] = {"placas_galeria": galeria[:50]}
    cat_low = categoria.strip().lower()
    if asignar_como_predeterminada or "turno" in cat_low:
        if "turno" in cat_low:
            updates["placa_turno_url"] = media_url
            updates["auto_turnos_placa_url"] = media_url
        elif "aereo" in cat_low:
            updates["placa_aereos_url"] = media_url
        elif "contacto" in cat_low:
            updates["placa_contacto_url"] = media_url

    new_cfg = save_optica_vortix_full_config(updates)
    placas_norm = [_normalizar_placa_item(p) for p in (new_cfg.get("placas_galeria") or []) if isinstance(p, dict)]
    return {
        **nueva_placa,
        "success": True,
        "placa": nueva_placa,
        "placas": placas_norm,
        "items": placas_norm
    }
