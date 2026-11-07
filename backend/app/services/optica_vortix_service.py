"""
Servicio Integral para el Módulo Independiente Óptica Vortix (Línea 3 de WhatsApp Cloud API).
Garantiza aislamiento 100% respecto del CRM Quirúrgico (Línea 1) y de Estudios Oftalmológicos (Línea 2).
Incluye:
  - Normalizador telefónico regional Mendoza (prefijo 261, quita 0 y 15, descarta fijos puros).
  - Clasificador clínico-óptico con lista negra quirúrgica estricta (excluye LIO, faco, LCT).
  - Motor 1: Sincronización de turnos próximos en Geclisa con enriquecimiento de ficha y voucher #VORTIX-XXXX.
  - Motor 2: Detección diaria de recetas e indicaciones de lentes aéreos y de contacto en Geclisa / HCE.
  - Motor 3: Cola anti-bloqueo con horario comercial Mendoza, jitter y Circuit Breaker por calidad de línea.
  - Smart Flows Interactivos: Zero-Wait Welcome, Doble Paso de Placa HD, Opt-Out automático y Fuera de Horario.
  - IA Óptica con Google Gemini: OCR de foto de receta (OD/OI/ADD/DNP) y Copiloto Comercial para ópticos.
"""

import os
import re
import io
import json
import time
import random
import hashlib
import asyncio
import logging
import base64
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple

import httpx
from app.db import supabase
from app.services.geclisa_client import GeclisaClient
from app.services.logger_service import log_event
from app.services.whatsapp_cloud.client import (
    WhatsAppCloudClient,
    MetaAPIError,
    get_whatsapp_waba_id,
    get_whatsapp_cloud_credentials,
    get_whatsapp_estudios_credentials,
    get_whatsapp_optica_config,
    get_whatsapp_optica_credentials,
    invalidate_whatsapp_credentials_cache
)

logger = logging.getLogger("optica_vortix_service")
geclisa_client = GeclisaClient()

MENDOZA_TZ = timezone(timedelta(hours=-3))

# Caché en memoria para fichas de Geclisa (evita llamadas repetidas en barridos de agenda)
_FICHA_GECLISA_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
FICHA_CACHE_TTL_SECONDS = 1800.0  # 30 minutos

# Caché en memoria para media_id de placas subidas a Meta por URL
_PLACA_MEDIA_ID_CACHE: Dict[str, Tuple[float, str]] = {}
PLACA_MEDIA_CACHE_TTL_SECONDS = 20 * 24 * 3600.0  # 20 días (Meta conserva media_id por 30 días)

# Cooldown en memoria para auto-respuesta fuera de horario (evita bucles)
_AFTER_HOURS_REPLY_CACHE: Dict[str, float] = {}


def get_mendoza_now() -> datetime:
    """Retorna la fecha y hora actual en la zona horaria de Mendoza (UTC-3)."""
    return datetime.now(MENDOZA_TZ)


# ============================================================================
# 1. CONFIGURACIÓN DEL MÓDULO ÓPTICA VORTIX
# ============================================================================

DEFAULT_OPTICA_CONFIG: Dict[str, Any] = {
    "optica_phone_number_id": os.getenv("META_WA_PHONE_NUMBER_ID_OPTICA") or "",
    "optica_display_phone": os.getenv("META_WA_DISPLAY_PHONE_OPTICA") or "",
    "optica_verified_name": "Óptica Vortix",
    "optica_waba_id": os.getenv("META_WA_WABA_ID") or "3731563350343089",
    "area_code_default": "261",

    # Automatismo 1: Voucher por Turno Próximo en Geclisa
    "auto_turnos_proximos_enabled": False,
    "dias_anticipacion_turno": 1,
    "hora_disparo_turnos": "10:00",
    "porcentaje_descuento_turno": "20% OFF",
    "template_turno_descuento": "vortix_beneficio_turno_v1",
    "estrategia_envio_turno": "template_directo",  # "template_directo" | "doble_paso_ventana"
    "placa_turno_url": "",
    "excluir_servicios_keywords": [
        "CIRUGIA", "QUIROFANO", "ANESTESIA", "ASESORAMIENTO QUIRURGICO",
        "POSOPERATORIO", "POSTOPERATORIO"
    ],
    # Clasificación oficial Geclisa para Campañas y Automatismos
    "sedes_habilitadas_campana": [
        "Mitre 540 - Ciudad de Mendoza",
        "Mitre 538 3er Piso Dpto 4 - Ciudad de Mendoza"
    ],
    "servicios_habilitados_campana": [
        "CONSULTAS",
        "ASESORAMIENTO"
    ],

    # Automatismo 2: Seguimiento de Recetas / Indicaciones de Lentes del Día
    "auto_recetas_lentes_enabled": False,
    "modo_disparo_recetas": "semi_automatico",  # "semi_automatico" | "automatico"
    "delay_minutos_post_consulta": 45,
    "template_lentes_aereos": "vortix_receta_lentes_aereos_v1",
    "template_lentes_contacto": "vortix_receta_lentes_contacto_v1",
    "template_lentes_listos": "vortix_lentes_listos_retiro_v1",
    "placa_aereos_url": "",
    "placa_contacto_url": "",

    # Motor Anti-Bloqueo (Throttling & Horario Comercial Mendoza)
    "intervalo_min_seg": 15,
    "intervalo_max_seg": 35,
    "lote_size": 30,
    "pausa_lote_min": 5,
    "hora_inicio_envios": "09:00",
    "hora_fin_envios": "20:00",
    "max_envios_diarios": 200,
    "cooldown_dias_mismo_contacto": 14,
    "telefonos_whitelist_prueba": ["5492614703230", "2614703230"],

    # Respuestas Interactivas y Fuera de Horario
    "auto_reply_fuera_horario": True,
    "mensaje_fuera_horario": (
        "👓 *Óptica Vortix*\n\n"
        "¡Hola! Gracias por escribirnos. Nuestro horario de atención es de Lunes a Viernes de 09:00 a 20:00 hs "
        "y Sábados de 09:00 a 13:00 hs.\n\n"
        "📸 Si tenés la *foto de tu receta médica*, podés enviarla ahora mismo por acá y a primera hora "
        "nuestro equipo de ópticos te preparará las opciones y presupuestos con tu descuento."
    ),
    "mensaje_bienvenida_cupon": (
        "🎉 *¡Beneficio Exclusivo Activado en Óptica Vortix!*\n\n"
        "Hola *{nombre}*, por tu atención oftalmológica tenés un *{descuento}* en cristales, antirreflex, "
        "filtro azul y armazones seleccionados.\n\n"
        "🎟️ *Tu código de cupón:* `{cupon}`\n\n"
        "¿Cómo te gustaría continuar? Elegí una opción abajo o envianos una foto de tu receta 👇"
    ),
    "promos_armazones_texto": (
        "🕶️ *Promociones Vigentes en Óptica Vortix*\n\n"
        "• *20% OFF* en armazones recetados y cristales con tratamiento Antirreflex / Blue Cut (Filtro Azul).\n"
        "• *3 y 6 cuotas sin interés* con tarjetas bancarias seleccionadas.\n"
        "• *Descuento adicional* presentando tu cupón digital de paciente.\n\n"
        "📸 *Tip:* Envianos una foto de tu receta o contanos qué estilo de armazón buscás para enviarte modelos y valores."
    ),
    "placas_galeria": []
}


def _sincronizar_aliases_config_optica(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sincroniza bidireccionalmente las claves internas del backend y los alias
    de `OpticaConfig` esperados por el Frontend (`frontend/src/types/optica.ts`).
    """
    res = dict(cfg)

    # Identidad de Línea 3
    waba = str(res.get("waba_id") or res.get("optica_waba_id") or "3731563350343089").strip()
    phone_id = str(res.get("phone_number_id") or res.get("optica_phone_number_id") or "").strip()
    disp_phone = str(res.get("display_phone_number") or res.get("optica_display_phone") or "").strip()
    ver_name = str(res.get("verified_name") or res.get("optica_verified_name") or "Óptica Vortix").strip()
    res["optica_waba_id"] = waba
    res["waba_id"] = waba
    res["optica_phone_number_id"] = phone_id
    res["phone_number_id"] = phone_id
    res["optica_display_phone"] = disp_phone
    res["display_phone_number"] = disp_phone
    res["optica_verified_name"] = ver_name
    res["verified_name"] = ver_name

    # Motor 1: Turnos Próximos
    auto_turnos = bool(res.get("auto_turnos_activo") if "auto_turnos_activo" in res else res.get("auto_turnos_proximos_enabled", False))
    res["auto_turnos_proximos_enabled"] = auto_turnos
    res["auto_turnos_activo"] = auto_turnos

    dias_ant = int(res.get("auto_turnos_dias_anticipacion") if "auto_turnos_dias_anticipacion" in res else res.get("dias_anticipacion_turno", 1))
    res["dias_anticipacion_turno"] = dias_ant
    res["auto_turnos_dias_anticipacion"] = dias_ant

    hora_env = str(res.get("auto_turnos_hora_envio") or res.get("hora_disparo_turnos") or "10:00").strip()
    res["hora_disparo_turnos"] = hora_env
    res["auto_turnos_hora_envio"] = hora_env

    res["auto_turnos_excluir_quirurgicos"] = bool(res.get("auto_turnos_excluir_quirurgicos", True))

    # Descuento: mantener número en auto_turnos_descuento_pct y string formateado en porcentaje_descuento_turno
    raw_pct = res.get("auto_turnos_descuento_pct")
    if raw_pct is not None and str(raw_pct).strip() != "":
        try:
            pct_num = int(re.sub(r"[^\d]", "", str(raw_pct)) or "20")
        except Exception:
            pct_num = 20
        res["auto_turnos_descuento_pct"] = pct_num
        if "porcentaje_descuento_turno" not in res or not str(res.get("porcentaje_descuento_turno")).strip():
            res["porcentaje_descuento_turno"] = f"{pct_num}% OFF"
    else:
        pct_str = str(res.get("porcentaje_descuento_turno") or "20% OFF")
        m_num = re.search(r"(\d+)", pct_str)
        pct_num = int(m_num.group(1)) if m_num else 20
        res["auto_turnos_descuento_pct"] = pct_num
        res["porcentaje_descuento_turno"] = pct_str

    placa_t = str(res.get("auto_turnos_placa_url") if "auto_turnos_placa_url" in res else (res.get("placa_turno_url") or "")).strip()
    res["placa_turno_url"] = placa_t
    res["auto_turnos_placa_url"] = placa_t

    tpl_t = str(res.get("auto_turnos_template_name") or res.get("template_turno_descuento") or "vortix_beneficio_turno_v1").strip()
    res["template_turno_descuento"] = tpl_t
    res["auto_turnos_template_name"] = tpl_t

    # Motor 2: Detección de Recetas Hoy
    auto_rec = bool(res.get("auto_recetas_activo") if "auto_recetas_activo" in res else res.get("auto_recetas_lentes_enabled", False))
    res["auto_recetas_lentes_enabled"] = auto_rec
    res["auto_recetas_activo"] = auto_rec

    raw_modo = str(res.get("auto_recetas_modo") or res.get("modo_disparo_recetas") or "SEMI_AUTOMATICO").strip()
    if raw_modo.upper() in ("AUTOMATICO", "AUTOMÁTICO"):
        res["modo_disparo_recetas"] = "automatico"
        res["auto_recetas_modo"] = "AUTOMATICO"
    else:
        res["modo_disparo_recetas"] = "semi_automatico"
        res["auto_recetas_modo"] = "SEMI_AUTOMATICO"

    delay_min = int(res.get("auto_recetas_delay_minutos") if "auto_recetas_delay_minutos" in res else res.get("delay_minutos_post_consulta", 45))
    res["delay_minutos_post_consulta"] = delay_min
    res["auto_recetas_delay_minutos"] = delay_min

    tpl_aer = str(res.get("auto_recetas_template_aereos") or res.get("template_lentes_aereos") or "vortix_receta_lentes_aereos_v1").strip()
    res["template_lentes_aereos"] = tpl_aer
    res["auto_recetas_template_aereos"] = tpl_aer

    tpl_lc = str(res.get("auto_recetas_template_contacto") or res.get("template_lentes_contacto") or "vortix_receta_lentes_contacto_v1").strip()
    res["template_lentes_contacto"] = tpl_lc
    res["auto_recetas_template_contacto"] = tpl_lc

    if "auto_recetas_keywords_aereos" not in res or not isinstance(res.get("auto_recetas_keywords_aereos"), list):
        res["auto_recetas_keywords_aereos"] = list(KEYWORDS_LENTES_AEREOS[:14])
    if "auto_recetas_keywords_contacto" not in res or not isinstance(res.get("auto_recetas_keywords_contacto"), list):
        res["auto_recetas_keywords_contacto"] = list(KEYWORDS_LENTES_CONTACTO[:10])
    if "auto_recetas_exclusiones_quirurgicas" not in res or not isinstance(res.get("auto_recetas_exclusiones_quirurgicas"), list):
        res["auto_recetas_exclusiones_quirurgicas"] = list(BLACKLIST_QUIRURGICA_OPTICA[:14])

    # Motor 3: Anti-Bloqueo
    cd_dias = int(res.get("antibloqueo_cooldown_dias") if "antibloqueo_cooldown_dias" in res else res.get("cooldown_dias_mismo_contacto", 14))
    res["cooldown_dias_mismo_contacto"] = cd_dias
    res["antibloqueo_cooldown_dias"] = cd_dias

    jit_min = int(res.get("antibloqueo_jitter_min_seg") if "antibloqueo_jitter_min_seg" in res else res.get("intervalo_min_seg", 15))
    res["intervalo_min_seg"] = jit_min
    res["antibloqueo_jitter_min_seg"] = jit_min

    jit_max = int(res.get("antibloqueo_jitter_max_seg") if "antibloqueo_jitter_max_seg" in res else res.get("intervalo_max_seg", 35))
    res["intervalo_max_seg"] = jit_max
    res["antibloqueo_jitter_max_seg"] = jit_max

    h_ini = str(res.get("antibloqueo_hora_inicio") or res.get("hora_inicio_envios") or "09:00").strip()
    res["hora_inicio_envios"] = h_ini
    res["antibloqueo_hora_inicio"] = h_ini

    h_fin = str(res.get("antibloqueo_hora_fin") or res.get("hora_fin_envios") or "20:00").strip()
    res["hora_fin_envios"] = h_fin
    res["antibloqueo_hora_fin"] = h_fin

    # Whitelist de Teléfonos de Prueba / Desarrollador (Exentos de Cooldown)
    raw_wl = res.get("telefonos_whitelist_prueba") or ["5492614703230", "2614703230"]
    if isinstance(raw_wl, str):
        wl_list = [x.strip() for x in raw_wl.replace(";", ",").split(",") if x.strip()]
    elif isinstance(raw_wl, list):
        wl_list = [str(x).strip() for x in raw_wl if str(x).strip()]
    else:
        wl_list = ["5492614703230", "2614703230"]
    if "5492614703230" not in wl_list and "2614703230" not in wl_list:
        wl_list.append("5492614703230")
    res["telefonos_whitelist_prueba"] = wl_list
    res["antibloqueo_whitelist_telefonos"] = wl_list

    msg_fh = str(res.get("auto_respuesta_fuera_horario") or res.get("mensaje_fuera_horario") or DEFAULT_OPTICA_CONFIG["mensaje_fuera_horario"]).strip()
    res["mensaje_fuera_horario"] = msg_fh
    res["auto_respuesta_fuera_horario"] = msg_fh

    # Clasificación oficial Geclisa (Sedes y Servicios para Campañas)
    if "sedes_habilitadas_campana" not in res or not isinstance(res.get("sedes_habilitadas_campana"), list):
        res["sedes_habilitadas_campana"] = list(DEFAULT_OPTICA_CONFIG["sedes_habilitadas_campana"])
    if "servicios_habilitados_campana" not in res or not isinstance(res.get("servicios_habilitados_campana"), list):
        res["servicios_habilitados_campana"] = list(DEFAULT_OPTICA_CONFIG["servicios_habilitados_campana"])

    return res




def es_telefono_whitelist_prueba(telefono: str, cfg: Optional[Dict[str, Any]] = None) -> bool:
    """
    Determina si un número telefónico pertenece a la lista blanca de pruebas / desarrollador.
    Los teléfonos en la lista blanca quedan 100% exentos de la regla de Cooldown para permitir
    pruebas continuas de campañas y automatismos.
    """
    if not telefono:
        return False
    digits_tel = "".join(filter(str.isdigit, str(telefono)))
    if not digits_tel:
        return False
    if not cfg:
        cfg = get_optica_vortix_full_config()
    wl = cfg.get("telefonos_whitelist_prueba") or ["5492614703230", "2614703230"]
    if isinstance(wl, str):
        wl = [x.strip() for x in wl.replace(";", ",").split(",") if x.strip()]
    for w in wl:
        w_digits = "".join(filter(str.isdigit, str(w)))
        if not w_digits:
            continue
        if digits_tel == w_digits or (len(w_digits) >= 8 and digits_tel.endswith(w_digits[-8:])):
            return True
    return False

def get_optica_vortix_full_config() -> Dict[str, Any]:
    """
    Obtiene la configuración integral de Óptica Vortix desde `configuracion_sistema`
    (`clave = 'optica_vortix_config'`) combinada con los valores por defecto.
    """
    cfg = dict(DEFAULT_OPTICA_CONFIG)
    raw_line_cfg = get_whatsapp_optica_config()
    for k, v in raw_line_cfg.items():
        if v is not None and str(v).strip() != "":
            cfg[k] = v
        elif isinstance(v, (bool, int, float, list, dict)):
            cfg[k] = v

    if supabase:
        try:
            res = supabase.table("configuracion_sistema").select("valor").eq("clave", "optica_vortix_config").limit(1).execute()
            if res.data and len(res.data) > 0:
                val = res.data[0].get("valor")
                if isinstance(val, dict):
                    for k, v in val.items():
                        if v is not None and (not isinstance(v, str) or v.strip() != "" or k in ("placa_turno_url", "placa_aereos_url", "placa_contacto_url", "auto_turnos_placa_url")):
                            cfg[k] = v
        except Exception as e:
            logger.debug(f"[OpticaConfig] Error leyendo optica_vortix_config: {e}")

    return _sincronizar_aliases_config_optica(cfg)


def save_optica_vortix_full_config(updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guarda y persiste la configuración de Óptica Vortix en `configuracion_sistema`
    (`clave = 'optica_vortix_config'`) e invalida la caché de credenciales WABA.
    Valida que el `optica_phone_number_id` no colisione con la Línea 1 ni Línea 2.
    """
    current = get_optica_vortix_full_config()
    upd = dict(updates or {})
    # Propagar claves entrantes del frontend a sus contrapartes internas antes de fusionar
    if "phone_number_id" in upd and "optica_phone_number_id" not in upd:
        upd["optica_phone_number_id"] = upd["phone_number_id"]
    if "optica_phone_number_id" in upd and "phone_number_id" not in upd:
        upd["phone_number_id"] = upd["optica_phone_number_id"]
    if "display_phone_number" in upd and "optica_display_phone" not in upd:
        upd["optica_display_phone"] = upd["display_phone_number"]
    if "verified_name" in upd and "optica_verified_name" not in upd:
        upd["optica_verified_name"] = upd["verified_name"]
    if "waba_id" in upd and "optica_waba_id" not in upd:
        upd["optica_waba_id"] = upd["waba_id"]
    if "auto_turnos_activo" in upd:
        upd["auto_turnos_proximos_enabled"] = bool(upd["auto_turnos_activo"])
    if "auto_turnos_dias_anticipacion" in upd:
        upd["dias_anticipacion_turno"] = int(upd["auto_turnos_dias_anticipacion"])
    if "auto_turnos_hora_envio" in upd:
        upd["hora_disparo_turnos"] = str(upd["auto_turnos_hora_envio"])
    if "auto_turnos_descuento_pct" in upd:
        upd["porcentaje_descuento_turno"] = f"{upd['auto_turnos_descuento_pct']}% OFF"
    if "auto_turnos_placa_url" in upd:
        upd["placa_turno_url"] = str(upd["auto_turnos_placa_url"] or "")
    if "auto_turnos_template_name" in upd:
        upd["template_turno_descuento"] = str(upd["auto_turnos_template_name"])
    if "auto_recetas_activo" in upd:
        upd["auto_recetas_lentes_enabled"] = bool(upd["auto_recetas_activo"])
    if "auto_recetas_modo" in upd:
        upd["modo_disparo_recetas"] = "automatico" if str(upd["auto_recetas_modo"]).upper() == "AUTOMATICO" else "semi_automatico"
    if "auto_recetas_delay_minutos" in upd:
        upd["delay_minutos_post_consulta"] = int(upd["auto_recetas_delay_minutos"])
    if "auto_recetas_template_aereos" in upd:
        upd["template_lentes_aereos"] = str(upd["auto_recetas_template_aereos"])
    if "auto_recetas_template_contacto" in upd:
        upd["template_lentes_contacto"] = str(upd["auto_recetas_template_contacto"])
    if "antibloqueo_cooldown_dias" in upd:
        upd["cooldown_dias_mismo_contacto"] = int(upd["antibloqueo_cooldown_dias"])
    if "antibloqueo_jitter_min_seg" in upd:
        upd["intervalo_min_seg"] = int(upd["antibloqueo_jitter_min_seg"])
    if "antibloqueo_jitter_max_seg" in upd:
        upd["intervalo_max_seg"] = int(upd["antibloqueo_jitter_max_seg"])
    if "antibloqueo_hora_inicio" in upd:
        upd["hora_inicio_envios"] = str(upd["antibloqueo_hora_inicio"])
    if "antibloqueo_hora_fin" in upd:
        upd["hora_fin_envios"] = str(upd["antibloqueo_hora_fin"])
    if "auto_respuesta_fuera_horario" in upd:
        upd["mensaje_fuera_horario"] = str(upd["auto_respuesta_fuera_horario"])

    merged = _sincronizar_aliases_config_optica({**current, **upd})

    cand_phone_id = str(merged.get("optica_phone_number_id") or "").strip()
    if cand_phone_id:
        q_phone_id, _ = get_whatsapp_cloud_credentials()
        est_phone_id, _ = get_whatsapp_estudios_credentials()
        if (q_phone_id and cand_phone_id == str(q_phone_id).strip()) or (
            est_phone_id and cand_phone_id == str(est_phone_id).strip()
        ):
            raise ValueError(
                "El Phone Number ID de Óptica Vortix (Línea 3) no puede coincidir con el de la Línea 1 (Quirúrgica) "
                "ni con el de la Línea 2 (Estudios Oftalmológicos)."
            )

    if supabase:
        now_iso = datetime.now(timezone.utc).isoformat()
        exist = supabase.table("configuracion_sistema").select("clave").eq("clave", "optica_vortix_config").execute()
        if exist.data and len(exist.data) > 0:
            supabase.table("configuracion_sistema").update({
                "valor": merged,
                "updated_at": now_iso
            }).eq("clave", "optica_vortix_config").execute()
        else:
            supabase.table("configuracion_sistema").insert({
                "clave": "optica_vortix_config",
                "valor": merged,
                "descripcion": "Configuración integral del módulo independiente Óptica Vortix (Línea 3 WhatsApp)"
            }).execute()

    invalidate_whatsapp_credentials_cache()
    return merged


# ============================================================================
# 2. NORMALIZADOR TELEFÓNICO REGIONAL MENDOZA (E.164 META 549261XXXXXXX)
# ============================================================================

def normalizar_telefono_optica_mza(
    raw_phone: Optional[str],
    celular_preferido: Optional[str] = None,
    default_area_code: str = "261"
) -> Tuple[Optional[str], Optional[str]]:
    """
    Normaliza números telefónicos provenientes de Geclisa (Mendoza y Cuyo) al estándar E.164 de Meta
    para móviles argentinos (`549` + 10 dígitos, ej: `5492615123456`).

    Reglas:
      1. Separa múltiples teléfonos concatenados por `/`, `;`, `,`, `|`, ` - `, ` o `, ` y `.
      2. Prioriza `celular_preferido` sobre `raw_phone`.
      3. Si tiene 9 dígitos y comienza con `15` (`15XXXXXXX`), antepone `549` + `default_area_code` (`261`).
      4. Si tiene 7 dígitos locales (`5XXXXXX`, `6XXXXXX`, `3XXXXXX`, `2XXXXXX`, `7XXXXXX`), antepone `549261`.
      5. Si tiene 7 dígitos y comienza con `4` (`4XXXXXX`) o 10 dígitos y comienza con `2614` (`2614XXXXXX`),
         lo clasifica como teléfono fijo puro; sigue buscando otro candidato móvil y si no hay, devuelve
         `(None, "TELEFONO_FIJO_O_INVALIDO")`.
      6. Valida que el resultado final cumpla `^549\\d{10}$`.
    """
    raw_sources: List[str] = []
    if celular_preferido and str(celular_preferido).strip():
        raw_sources.append(str(celular_preferido).strip())
    if raw_phone and str(raw_phone).strip() and str(raw_phone).strip() != str(celular_preferido or "").strip():
        raw_sources.append(str(raw_phone).strip())

    if not raw_sources:
        return None, "SIN_TELEFONO"

    candidates: List[str] = []
    for src in raw_sources:
        parts = re.split(r"[/;,|]|\s+-\s+|\s+o\s+|\s+y\s+", src, flags=re.IGNORECASE)
        for p in parts:
            clean_p = p.strip()
            if clean_p:
                candidates.append(clean_p)

    if not candidates:
        return None, "SIN_TELEFONO"

    area = "".join(filter(str.isdigit, str(default_area_code or "261"))) or "261"
    saw_landline = False

    for cand in candidates:
        digits = "".join(filter(str.isdigit, cand))
        if not digits or len(digits) < 7:
            continue

        # Quitar prefijo internacional 00
        if digits.startswith("00"):
            digits = digits[2:]

        # Caso A: Ya empieza con 549 + 10 dígitos (13 dígitos)
        if digits.startswith("549") and len(digits) == 13:
            local10 = digits[3:]
            # Si en realidad metieron un 15 adentro (ej. 54926115...)
            if local10.startswith(f"{area}15") and len(local10) > 10:
                pass
            elif local10.startswith("2614"):
                saw_landline = True
                continue
            else:
                return digits, None

        # Caso B: Empieza con 549 pero tiene '15' incrustado (ej: 549 261 15 XXXXXXX -> 15 dígitos)
        if digits.startswith("549") and len(digits) == 15:
            for ac_len in (3, 4, 2):
                if digits[3 + ac_len:3 + ac_len + 2] == "15":
                    fixed = "549" + digits[3:3 + ac_len] + digits[3 + ac_len + 2:]
                    if re.match(r"^549\d{10}$", fixed):
                        return fixed, None

        # Caso C: Empieza con 54 (sin 9) y 10 dígitos nacionales (12 dígitos)
        if digits.startswith("54") and not digits.startswith("549") and len(digits) == 12:
            nat10 = digits[2:]
            if nat10.startswith("2614"):
                saw_landline = True
                continue
            return f"549{nat10}", None

        # Quitar 0 inicial de larga distancia nacional (ej. 0261...)
        if digits.startswith("0"):
            digits = digits.lstrip("0")

        # Caso D: 9 dígitos empezando con 15 (ej: 155123456 -> celular local de Mendoza)
        if len(digits) == 9 and digits.startswith("15"):
            sub7 = digits[2:]
            if sub7.startswith("4"):
                saw_landline = True
                continue
            norm = f"549{area}{sub7}"
            if re.match(r"^549\d{10}$", norm):
                return norm, None

        # Caso E: 12 dígitos con código de área + 15 + 7 dígitos (ej: 261 15 5123456)
        if len(digits) == 12:
            for ac_len in (3, 4, 2):
                if digits[ac_len:ac_len + 2] == "15":
                    nat10 = digits[:ac_len] + digits[ac_len + 2:]
                    if len(nat10) == 10:
                        return f"549{nat10}", None

        # Caso F: 11 dígitos empezando con 9 + 10 dígitos (ej: 92615123456)
        if len(digits) == 11 and digits.startswith("9"):
            nat10 = digits[1:]
            if nat10.startswith("2614"):
                saw_landline = True
                continue
            return f"54{digits}", None

        # Caso G: 10 dígitos nacionales (ej: 2615123456, 2604512345, 1151234567)
        if len(digits) == 10:
            if digits.startswith("2614"):
                saw_landline = True
                continue
            return f"549{digits}", None

        # Caso H: 7 dígitos locales de Gran Mendoza (ej: 5123456, 6123456, 4234567)
        if len(digits) == 7:
            if digits.startswith("4"):
                saw_landline = True
                continue
            if digits[0] in ("2", "3", "5", "6", "7"):
                norm = f"549{area}{digits}"
                if re.match(r"^549\d{10}$", norm):
                    return norm, None

    if saw_landline:
        return None, "TELEFONO_FIJO_O_INVALIDO"
    return None, "FORMATO_TELEFONO_INVALIDO"


def generar_codigo_beneficio_vortix(ficha_id: str, fecha_ref: str = "") -> str:
    """
    Genera un código de cupón corto, único y determinístico por paciente/turno: `#VORTIX-XXXX`.
    """
    seed = f"{ficha_id}:{fecha_ref or date.today().isoformat()}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest().upper()
    code_chars = ""
    for ch in digest:
        if ch in "23456789ABCDEFGHJKLMNPQRSTUVWXYZ":
            code_chars += ch
        if len(code_chars) == 4:
            break
    if len(code_chars) < 4:
        code_chars = (digest[:4]).upper()
    return f"#VORTIX-{code_chars}"


# ============================================================================
# 3. CLASIFICADOR CLÍNICO DE INDICACIONES DE LENTES (CON LISTA NEGRA QUIRÚRGICA)
# ============================================================================

BLACKLIST_QUIRURGICA_OPTICA = [
    "lente intraocular",
    "lentes intraoculares",
    "lio ",
    " lio",
    "lio.",
    "lio,",
    "plegable",
    "cámara posterior",
    "camara posterior",
    "cámara anterior",
    "camara anterior",
    "pseudofaquia",
    "pseudofáquico",
    "facoemulsificación",
    "facoemulsificacion",
    "capsulotomía",
    "capsulotomia",
    "vitrectomía",
    "vitrectomia",
    "iridotomía",
    "iridotomia",
    "trabeculectomía",
    "lente de contacto terapéutico",
    "lente de contacto terapeutico",
    "lc terapéutico",
    "lc terapeutico",
    "lct",
    "suspender lc",
    "suspender lentes de contacto",
    "no usar lentes de contacto",
    "no requiere cambio de lentes",
    "continúa con sus lentes",
    "continua con sus lentes",
    "mantener sus lentes actuales"
]

KEYWORDS_LENTES_CONTACTO = [
    "lentes de contacto",
    "lente de contacto",
    "lc blandos",
    "lc blandas",
    "lc tóricos",
    "lc toricos",
    "lc multifocal",
    "lc esféricos",
    "lc esfericos",
    "lc rígidos",
    "lc gas permeable",
    "adaptación de lc",
    "adaptacion de lc",
    "prueba de lc",
    "receta de lc",
    "se indica lc",
    "indicación de lc",
    "indicacion de lc"
]

KEYWORDS_LENTES_AEREOS = [
    "receta de lentes",
    "receta de anteojos",
    "se indican lentes",
    "se indica lentes",
    "se indican anteojos",
    "se receta anteojos",
    "se recetan anteojos",
    "se recetan lentes",
    "lentes aéreos",
    "lentes aereos",
    "anteojos para lejos",
    "anteojos para cerca",
    "lentes para lejos",
    "lentes para cerca",
    "multifocal",
    "multifocales",
    "progresivo",
    "progresivos",
    "bifocal",
    "bifocales",
    "monofocal",
    "monofocales",
    "antirreflex",
    "antireflex",
    "antirreflejo",
    "filtro azul",
    "blue cut",
    "blue block",
    "fotocromático",
    "fotocromatico",
    "transitions",
    "armazón",
    "armazon",
    "cristales",
    " corrección óptica",
    "correccion optica",
    "prescripción óptica",
    "prescripcion optica"
]


def normalizar_estructura_graduacion(grad: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Asegura que el objeto de graduación contenga simultáneamente:
      - Estructura backend: `od: {esfera, cilindro, eje}`, `oi: {esfera, cilindro, eje}`, `adicion`, `dnp`
      - Estructura Frontend (`GraduacionOptica` en `frontend/src/types/optica.ts`):
        `od_lejos: {esfera, cilindro, eje, dnp}`, `oi_lejos: {esfera, cilindro, eje, dnp}`, `add`, `observaciones`
    """
    raw = grad if isinstance(grad, dict) else {}
    od_in = raw.get("od_lejos") if isinstance(raw.get("od_lejos"), dict) else (raw.get("od") if isinstance(raw.get("od"), dict) else {})
    oi_in = raw.get("oi_lejos") if isinstance(raw.get("oi_lejos"), dict) else (raw.get("oi") if isinstance(raw.get("oi"), dict) else {})

    dnp_global = str(raw.get("dnp") or od_in.get("dnp") or oi_in.get("dnp") or "").strip()
    dnp_parts = [p.strip() for p in dnp_global.split("/")] if "/" in dnp_global else [dnp_global, dnp_global]
    dnp_od = str(od_in.get("dnp") or (dnp_parts[0] if dnp_parts else "") or "").strip()
    dnp_oi = str(oi_in.get("dnp") or (dnp_parts[1] if len(dnp_parts) > 1 else dnp_od) or "").strip()

    od_esf = str(od_in.get("esfera") or "").strip()
    od_cil = str(od_in.get("cilindro") or "").strip()
    od_eje = str(od_in.get("eje") or "").strip()

    oi_esf = str(oi_in.get("esfera") or "").strip()
    oi_cil = str(oi_in.get("cilindro") or "").strip()
    oi_eje = str(oi_in.get("eje") or "").strip()

    add_val = str(raw.get("add") if raw.get("add") is not None else (raw.get("adicion") or "")).strip()
    obs_val = str(raw.get("observaciones") or "").strip()
    tipo_sug = str(raw.get("tipo_lente_sugerido") or "").strip()
    med_presc = str(raw.get("medico_prescriptor") or "").strip()
    fecha_rec = str(raw.get("fecha_receta") or "").strip()

    return {
        "od": {"esfera": od_esf, "cilindro": od_cil, "eje": od_eje, "dnp": dnp_od},
        "oi": {"esfera": oi_esf, "cilindro": oi_cil, "eje": oi_eje, "dnp": dnp_oi},
        "od_lejos": {"esfera": od_esf, "cilindro": od_cil, "eje": od_eje, "dnp": dnp_od},
        "oi_lejos": {"esfera": oi_esf, "cilindro": oi_cil, "eje": oi_eje, "dnp": dnp_oi},
        "adicion": add_val,
        "add": add_val,
        "dnp": dnp_global or (f"{dnp_od}/{dnp_oi}".strip("/") if (dnp_od or dnp_oi) else ""),
        "tipo_lente_sugerido": tipo_sug,
        "medico_prescriptor": med_presc,
        "fecha_receta": fecha_rec,
        "observaciones": obs_val
    }


def extraer_graduacion_regex(texto: str, datos_estructurados: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Extrae valores refractivos (OD, OI, Esfera, Cilindro, Eje, Adición, DNP) tanto desde
    diccionarios estructurados como desde texto libre de evoluciones/recetas oftalmológicas.
    """
    grad: Dict[str, Any] = {
        "od": {"esfera": "", "cilindro": "", "eje": ""},
        "oi": {"esfera": "", "cilindro": "", "eje": ""},
        "adicion": "",
        "dnp": "",
        "tipo_lente_sugerido": "",
        "observaciones": ""
    }

    if isinstance(datos_estructurados, dict) and datos_estructurados:
        od_src = datos_estructurados.get("od") if isinstance(datos_estructurados.get("od"), dict) else {}
        oi_src = datos_estructurados.get("oi") if isinstance(datos_estructurados.get("oi"), dict) else {}
        grad["od"]["esfera"] = str(od_src.get("esfera") or datos_estructurados.get("esf_od") or datos_estructurados.get("od_esf") or "").strip()
        grad["od"]["cilindro"] = str(od_src.get("cilindro") or datos_estructurados.get("cil_od") or datos_estructurados.get("od_cil") or "").strip()
        grad["od"]["eje"] = str(od_src.get("eje") or datos_estructurados.get("eje_od") or datos_estructurados.get("od_eje") or "").strip()

        grad["oi"]["esfera"] = str(oi_src.get("esfera") or datos_estructurados.get("esf_oi") or datos_estructurados.get("oi_esf") or "").strip()
        grad["oi"]["cilindro"] = str(oi_src.get("cilindro") or datos_estructurados.get("cil_oi") or datos_estructurados.get("oi_cil") or "").strip()
        grad["oi"]["eje"] = str(oi_src.get("eje") or datos_estructurados.get("eje_oi") or datos_estructurados.get("oi_eje") or "").strip()

        grad["adicion"] = str(datos_estructurados.get("adicion") or datos_estructurados.get("add") or "").strip()
        grad["dnp"] = str(datos_estructurados.get("dnp") or datos_estructurados.get("dip") or "").strip()
        grad["tipo_lente_sugerido"] = str(datos_estructurados.get("tipo_lente") or datos_estructurados.get("tipo_lente_sugerido") or "").strip()

    if not texto:
        return normalizar_estructura_graduacion(grad)

    clean_t = texto.replace("\r", "\n")

    # Buscar patrón OD: +1.50 -0.75 x 90°
    od_match = re.search(
        r"\b(?:OD|O\.D\.|Ojo\s*Derecho)\s*[:=\-]?\s*(?:esf\.?\s*)?([+-]?\s*\d+(?:[.,]\d{1,2})?|neutro|plano)?(?:\s*(?:cil\.?|=|/|\s)\s*([+-]?\s*\d+(?:[.,]\d{1,2})?))?(?:\s*(?:x|eje|en|a)\s*(\d{1,3})\s*°?)?",
        clean_t,
        flags=re.IGNORECASE
    )
    if od_match:
        if not grad["od"]["esfera"] and od_match.group(1):
            grad["od"]["esfera"] = od_match.group(1).replace(" ", "")
        if not grad["od"]["cilindro"] and od_match.group(2):
            grad["od"]["cilindro"] = od_match.group(2).replace(" ", "")
        if not grad["od"]["eje"] and od_match.group(3):
            grad["od"]["eje"] = f"{od_match.group(3)}°"

    oi_match = re.search(
        r"\b(?:OI|O\.I\.|OS|Ojo\s*Izquierdo)\s*[:=\-]?\s*(?:esf\.?\s*)?([+-]?\s*\d+(?:[.,]\d{1,2})?|neutro|plano)?(?:\s*(?:cil\.?|=|/|\s)\s*([+-]?\s*\d+(?:[.,]\d{1,2})?))?(?:\s*(?:x|eje|en|a)\s*(\d{1,3})\s*°?)?",
        clean_t,
        flags=re.IGNORECASE
    )
    if oi_match:
        if not grad["oi"]["esfera"] and oi_match.group(1):
            grad["oi"]["esfera"] = oi_match.group(1).replace(" ", "")
        if not grad["oi"]["cilindro"] and oi_match.group(2):
            grad["oi"]["cilindro"] = oi_match.group(2).replace(" ", "")
        if not grad["oi"]["eje"] and oi_match.group(3):
            grad["oi"]["eje"] = f"{oi_match.group(3)}°"

    add_match = re.search(
        r"\b(?:ADD|Adici[oó]n|Cerca)\s*[:=\-]?\s*([+]?\s*\d+(?:[.,]\d{1,2})?)",
        clean_t,
        flags=re.IGNORECASE
    )
    if add_match and not grad["adicion"]:
        grad["adicion"] = add_match.group(1).replace(" ", "")

    dnp_match = re.search(
        r"\b(?:DNP|DIP|Dist\.?\s*Interpupilar)\s*[:=\-]?\s*(\d{2}(?:[.,]\d)?(?:\s*/\s*\d{2}(?:[.,]\d)?)?)\s*(?:mm)?",
        clean_t,
        flags=re.IGNORECASE
    )
    if dnp_match and not grad["dnp"]:
        grad["dnp"] = dnp_match.group(1).strip()

    # Detectar tratamientos / tipo de lente sugerido en el texto
    tratamientos = []
    t_low = clean_t.lower()
    if "multifocal" in t_low or "progresivo" in t_low:
        tratamientos.append("Multifocal")
    elif "bifocal" in t_low:
        tratamientos.append("Bifocal")
    elif "ocupacional" in t_low or "degresivo" in t_low:
        tratamientos.append("Ocupacional")
    elif "monofocal" in t_low:
        tratamientos.append("Monofocal")

    if "antirreflex" in t_low or "antireflex" in t_low or "antirreflejo" in t_low:
        tratamientos.append("Antirreflex")
    if "filtro azul" in t_low or "blue" in t_low:
        tratamientos.append("Filtro Azul (Blue Cut)")
    if "fotocrom" in t_low or "transitions" in t_low:
        tratamientos.append("Fotocromático")

    if tratamientos and not grad["tipo_lente_sugerido"]:
        grad["tipo_lente_sugerido"] = " + ".join(tratamientos)

    return normalizar_estructura_graduacion(grad)


def clasificar_indicacion_optica(
    texto: Optional[str],
    datos_estructurados: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evalúa determinísticamente si un texto médico o registro estructurado contiene una
    prescripción de lentes aéreos, lentes de contacto o ambos, aplicando una lista negra
    quirúrgica estricta para no confundir LIO (lente intraocular) ni LCT (terapéutico).
    """
    raw_text = (texto or "").strip()
    t_low = f" {raw_text.lower()} "

    grad = extraer_graduacion_regex(raw_text, datos_estructurados)
    tiene_grad_estructurada = bool(
        grad["od"]["esfera"] or grad["od"]["cilindro"] or grad["oi"]["esfera"] or grad["oi"]["cilindro"] or grad["adicion"]
    )

    # 1. Evaluar coincidencias explícitas de anteojos aéreos y lentes de contacto
    match_contacto = any(kw in t_low for kw in KEYWORDS_LENTES_CONTACTO)
    match_aereos = any(kw in t_low for kw in KEYWORDS_LENTES_AEREOS)

    # Patrón explícito de fórmula refractiva óptica en el texto (ej. OD -1.25 = -0.50 x 180)
    tiene_formula_refractiva = bool(
        re.search(
            r"\b(?:OD|OI|O\.D\.|O\.I\.)\s*[:=\-]?\s*(?:esf\.?\s*)?[+-]\s*\d+[.,]\d{2}",
            raw_text,
            flags=re.IGNORECASE
        )
    )
    if tiene_formula_refractiva and ("receta" in t_low or "lente" in t_low or "anteojo" in t_low or "esf" in t_low or "add" in t_low):
        match_aereos = True

    # Palabras clave de prescripción refractiva activa
    tiene_prescripcion_activa = (
        match_aereos
        or tiene_formula_refractiva
        or tiene_grad_estructurada
        or any(w in t_low for w in (
            "cerca", "lejos", "multifocal", "progresivo", "bifocal", "adicion", "adición",
            "antirreflex", "antirreflejo", "blue cut", "filtro azul", "fotocromatico", "fotocromático",
            "armazón", "armazon", "cristales", "prescripción", "prescripcion", "lectura"
        ))
    )

    # 2. Evaluar Lista Negra Quirúrgica Estricta con diferenciación anatómica
    blacklist_hits = [bw.strip() for bw in BLACKLIST_QUIRURGICA_OPTICA if bw in t_low]
    if blacklist_hits:
        # Si menciona LCT / suspender LC, anular match_contacto
        if any(x in t_low for x in ("terapéutico", "terapeutico", "lct", "suspender lc", "no usar lentes de contacto")):
            match_contacto = False
        # Si menciona no requiere cambio de lentes, anular ambos
        if any(x in t_low for x in ("no requiere cambio de lentes", "continúa con sus lentes", "continua con sus lentes", "mantener sus lentes actuales")):
            return {
                "es_oportunidad": False,
                "tipo_oportunidad": None,
                "graduacion_json": grad,
                "motivo_exclusion": f"EXCLUIDO_SIN_CAMBIO ({blacklist_hits[0]})",
                "extracto_relevante": raw_text[:240]
            }

        # CLI-01: Diferenciar antecedente anatómico (pseudofaquia previa, LIO implantado en cirugía anterior)
        # de una cirugía activa inminente (facoemulsificación programada, vitrectomía, capsulotomía).
        es_termino_antecedente = all(
            hit in ("pseudofaquia", "pseudofáquico", "cámara posterior", "camara posterior", "cámara anterior", "camara anterior", "lente intraocular")
            for hit in blacklist_hits
        )

        if es_termino_antecedente and tiene_prescripcion_activa:
            # NO excluir: El paciente es pseudofáquico pero el médico prescribió anteojos activos
            logger.info(f"[Clasificador Óptica] Paciente pseudofáquico con prescripción activa detectado: {blacklist_hits}. Admitiendo oportunidad.")
            match_aereos = True
        else:
            # Exclusión quirúrgica legítima (cirugía activa o sin indicación refractiva)
            if not datos_estructurados and not ("receta de anteojos" in t_low or "receta de lentes aéreos" in t_low or "receta de lentes aereos" in t_low):
                return {
                    "es_oportunidad": False,
                    "tipo_oportunidad": None,
                    "graduacion_json": grad,
                    "motivo_exclusion": f"EXCLUIDO_QUIRURGICO ({blacklist_hits[0]})",
                    "extracto_relevante": raw_text[:240]
                }

    if datos_estructurados and tiene_grad_estructurada and not match_contacto:
        match_aereos = True

    if match_aereos and match_contacto:
        tipo = "indicacion_ambos"
    elif match_contacto:
        tipo = "indicacion_lentes_contacto"
    elif match_aereos:
        tipo = "indicacion_lentes_aereos"
    else:
        return {
            "es_oportunidad": False,
            "tipo_oportunidad": None,
            "graduacion_json": grad,
            "motivo_exclusion": "SIN_INDICACION_OPTICA",
            "extracto_relevante": raw_text[:240]
        }

    return {
        "es_oportunidad": True,
        "tipo_oportunidad": tipo,
        "graduacion_json": grad,
        "motivo_exclusion": None,
        "extracto_relevante": raw_text[:300]
    }


# ============================================================================
# 4. HELPERS DE ENRIQUECIMIENTO DE FICHA GECLISA Y CONTACTOS DE ÓPTICA
# ============================================================================

def obtener_ficha_geclisa_con_cache(ficha_id: Any) -> Dict[str, Any]:
    """
    Obtiene los datos completos de la ficha del paciente en Geclisa (`obtener_ficha_completa`)
    utilizando una caché en memoria de 30 minutos para acelerar los barridos de agenda.
    """
    if not ficha_id:
        return {}
    key = str(ficha_id).strip()
    now = time.time()
    if key in _FICHA_GECLISA_CACHE:
        ts, data = _FICHA_GECLISA_CACHE[key]
        if now - ts < FICHA_CACHE_TTL_SECONDS:
            return data

    try:
        res = geclisa_client.obtener_ficha_completa(int(key))
        if isinstance(res, dict) and res.get("encontrado"):
            _FICHA_GECLISA_CACHE[key] = (now, res)
            return res
    except Exception as e:
        logger.debug(f"[OpticaFichaCache] Error consultando ficha {key} en Geclisa: {e}")

    return {}


def upsert_optica_contacto(
    telefono: str,
    nombre: str,
    ficha_geclisa_id: Optional[str] = None,
    dni: Optional[str] = None,
    email: Optional[str] = None,
    obra_social: Optional[str] = None,
    codigo_cupon: Optional[str] = None,
    graduacion_json: Optional[Dict[str, Any]] = None,
    ultimo_turno_id: Optional[str] = None,
    ultimo_turno_fecha: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Crea o actualiza un contacto en `public.optica_contactos` de forma segura sin tocar `public.pacientes`.
    """
    if not supabase or not telefono:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    existing = None

    try:
        res_tel = supabase.table("optica_contactos").select("*").eq("telefono", telefono).limit(1).execute()
        if res_tel.data and len(res_tel.data) > 0:
            existing = res_tel.data[0]
        elif ficha_geclisa_id:
            res_f = supabase.table("optica_contactos").select("*").eq("ficha_geclisa_id", str(ficha_geclisa_id)).limit(1).execute()
            if res_f.data and len(res_f.data) > 0:
                existing = res_f.data[0]
    except Exception as e:
        logger.debug(f"[OpticaContacto] Error buscando contacto existente: {e}")

    payload: Dict[str, Any] = {
        "telefono": telefono,
        "updated_at": now_iso
    }
    if nombre and (not existing or not existing.get("nombre") or existing.get("nombre", "").startswith("Contacto ")):
        payload["nombre"] = nombre.strip()
    elif not existing:
        payload["nombre"] = (nombre or f"Contacto {telefono[-4:]}").strip()

    if ficha_geclisa_id:
        payload["ficha_geclisa_id"] = str(ficha_geclisa_id).strip()
    if dni:
        payload["dni"] = str(dni).strip()
    if email:
        payload["email"] = str(email).strip()
    if obra_social:
        payload["obra_social"] = str(obra_social).strip()
    if codigo_cupon:
        payload["codigo_cupon_activo"] = str(codigo_cupon).strip()
    if graduacion_json and any(graduacion_json.values()):
        payload["graduacion_actual_json"] = normalizar_estructura_graduacion(graduacion_json)
    if ultimo_turno_id:
        payload["ultimo_turno_geclisa_id"] = str(ultimo_turno_id)
    if ultimo_turno_fecha:
        payload["ultimo_turno_fecha"] = ultimo_turno_fecha

    try:
        if existing:
            upd = supabase.table("optica_contactos").update(payload).eq("id", existing["id"]).execute()
            return upd.data[0] if upd.data else {**existing, **payload}
        else:
            payload["created_at"] = now_iso
            ins = supabase.table("optica_contactos").insert(payload).execute()
            return ins.data[0] if ins.data else None
    except Exception as e:
        logger.warning(f"[OpticaContacto] Error haciendo upsert para {telefono}: {e}")
        return existing


# ============================================================================
# 5. MOTOR 1: SINCRONIZACIÓN DE TURNOS PRÓXIMOS EN GECLISA (VOUCHER DESCUENTO)
# ============================================================================

def sincronizar_turnos_proximos_optica(
    dias_anticipacion: Optional[int] = None,
    dry_run: bool = False,
    encolar_envios: Optional[bool] = None,
    fecha_objetivo_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Motor 1: Consulta los turnos próximos en Geclisa (`obtener_agenda_global(fecha_objetivo)`),
    filtra cancelados y prácticas quirúrgicas, enriquece teléfonos vacíos desde la ficha de Geclisa,
    normaliza los celulares de Mendoza (`549261...`), deduplica por teléfono/ficha y genera el
    cupón `#VORTIX-XXXX`.

    Si `dry_run=True`, devuelve la vista previa completa de pacientes elegibles y excluidos sin escribir en BD.
    Si `dry_run=False`, guarda en `optica_contactos` y `optica_oportunidades_geclisa`, y si corresponde
    encola los envíos en `optica_envios_programados`.
    """
    cfg = get_optica_vortix_full_config()
    try:
        dias = int(dias_anticipacion) if dias_anticipacion is not None and not hasattr(dias_anticipacion, "default") else int(cfg.get("dias_anticipacion_turno", 1))
    except Exception:
        dias = 1
    now_mza = get_mendoza_now()

    if fecha_objetivo_override and re.match(r"^\d{4}-\d{2}-\d{2}$", str(fecha_objetivo_override).strip()):
        fecha_obj = str(fecha_objetivo_override).strip()
    else:
        fecha_obj = (now_mza.date() + timedelta(days=dias)).isoformat()

    excluir_kw = [str(k).upper().strip() for k in (cfg.get("excluir_servicios_keywords") or []) if str(k).strip()]
    cooldown_dias = int(cfg.get("cooldown_dias_mismo_contacto", 14))
    debe_encolar = bool(encolar_envios if encolar_envios is not None else cfg.get("auto_turnos_proximos_enabled", False))

    raw_turnos = geclisa_client.obtener_agenda_global(fecha_obj) or []

    elegibles: List[Dict[str, Any]] = []
    excluidos: List[Dict[str, Any]] = []
    seen_phones: set = set()
    seen_fichas: set = set()

    # Cargar contactos con opt_out o contactados recientemente para validación rápida
    opt_out_phones: set = set()
    recent_promo_phones: set = set()
    if supabase:
        try:
            oo_res = supabase.table("optica_contactos").select("telefono").eq("opt_out", True).execute()
            for r in (oo_res.data or []):
                if r.get("telefono"):
                    opt_out_phones.add(str(r["telefono"]))

            cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=cooldown_dias)).isoformat()
            rec_res = (
                supabase.table("optica_envios_programados")
                .select("telefono")
                .eq("origen", "auto_turno_descuento")
                .gte("created_at", cutoff_iso)
                .in_("estado", ["pendiente", "enviando", "enviado"])
                .execute()
            )
            for r in (rec_res.data or []):
                if r.get("telefono"):
                    recent_promo_phones.add(str(r["telefono"]))
        except Exception as e:
            logger.debug(f"[Motor1] Aviso consultando opt_out/cooldown: {e}")

    # OPTIMIZACION DE RENDIMIENTO: Pre-enriquecimiento de fichas en bloque y paralelo
    fichas_necesitadas = list({
        str(t.get("ficha_id")).strip() for t in raw_turnos 
        if t.get("ficha_id") and len("".join(filter(str.isdigit, str(t.get("telefono") or "")))) < 7
    })

    contactos_cache_local = {}
    if supabase and fichas_necesitadas:
        try:
            c_res = (
                supabase.table("optica_contactos")
                .select("ficha_geclisa_id, dni, telefono, nombre, obra_social")
                .in_("ficha_geclisa_id", fichas_necesitadas[:200])
                .execute()
            )
            for c in (c_res.data or []):
                fid_c = str(c.get("ficha_geclisa_id") or "").strip()
                if fid_c and c.get("telefono"):
                    contactos_cache_local[fid_c] = c
        except Exception as e_c:
            logger.debug(f"[Motor1 Pre-Cache Contactos] {e_c}")

    fichas_a_buscar = [
        fid for fid in fichas_necesitadas 
        if fid not in contactos_cache_local and fid not in _FICHA_GECLISA_CACHE
    ]
    if fichas_a_buscar:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        with ThreadPoolExecutor(max_workers=min(8, len(fichas_a_buscar))) as ex:
            future_to_fid = {ex.submit(obtener_ficha_geclisa_con_cache, fid): fid for fid in fichas_a_buscar[:35]}
            try:
                for fut in as_completed(future_to_fid, timeout=2.5):
                    pass
            except Exception:
                pass

    for t in raw_turnos:
        turno_id = str(t.get("turno_id") or t.get("id") or "").strip()
        ficha_id = str(t.get("ficha_id") or "").strip()
        paciente_nombre = str(t.get("paciente") or "").strip()
        hora_turno = str(t.get("hora") or "00:00").strip()
        servicio = str(t.get("servicio_nombre") or t.get("servicio") or "CONSULTAS").strip().upper()
        servicio_id = str(t.get("servicio_id") or "")
        practica = str(t.get("practica") or "").strip()
        ubicacion = str(t.get("ubicacion_nombre") or t.get("ubicacion") or "Mitre 540 - Ciudad de Mendoza").strip()
        ubicacion_id = str(t.get("ubicacion_id") or "")
        consultorio = str(t.get("consultorio_nombre") or t.get("consultorio") or "").strip()
        consultorio_id = str(t.get("consultorio_id") or "")
        prestador_id = str(t.get("prestador_id") or "").strip()
        prestador_nombre = str(t.get("prestador_nombre") or "").strip()
        dni = str(t.get("dni") or "").strip()
        obra_social = str(t.get("obra_social") or "Particular").strip()
        raw_tel = str(t.get("telefono") or "").strip()

        # 1. Excluir turnos cancelados
        if t.get("cancelado") or str(t.get("estado_key") or "").lower() == "cancelado":
            excluidos.append({
                "turno_id": turno_id,
                "ficha_id": ficha_id,
                "paciente_nombre": paciente_nombre,
                "hora_turno": hora_turno,
                "servicio": servicio,
                "servicio_id": servicio_id,
                "practica": practica,
                "ubicacion": ubicacion,
                "ubicacion_id": ubicacion_id,
                "consultorio": consultorio,
                "consultorio_id": consultorio_id,
                "prestador_id": prestador_id,
                "prestador_nombre": prestador_nombre,
                "servicio_practica": f"{servicio} - {practica}".strip(" -"),
                "motivo_exclusion": "TURNO_CANCELADO"
            })
            continue

        # 2. Excluir servicios/prácticas quirúrgicas o anestésicas
        combined_srv = f"{servicio} {practica} {prestador_nombre}".upper()
        hit_kw = next((kw for kw in excluir_kw if kw in combined_srv), None)
        if hit_kw:
            excluidos.append({
                "turno_id": turno_id,
                "ficha_id": ficha_id,
                "paciente_nombre": paciente_nombre,
                "hora_turno": hora_turno,
                "servicio": servicio,
                "servicio_id": servicio_id,
                "practica": practica,
                "ubicacion": ubicacion,
                "ubicacion_id": ubicacion_id,
                "consultorio": consultorio,
                "consultorio_id": consultorio_id,
                "prestador_id": prestador_id,
                "prestador_nombre": prestador_nombre,
                "servicio_practica": f"{servicio} - {practica}".strip(" -"),
                "motivo_exclusion": f"SERVICIO_EXCLUIDO ({hit_kw})"
            })
            continue

        # 3. Enriquecer desde ficha completa de Geclisa si falta telefono movil
        celular_ficha = None
        digits_tel = "".join(filter(str.isdigit, raw_tel))
        if ficha_id and len(digits_tel) < 7:
            # Primero intentar desde cache local de optica_contactos
            c_loc = contactos_cache_local.get(ficha_id)
            if c_loc and c_loc.get("telefono"):
                raw_tel = str(c_loc.get("telefono") or "")
                dni = dni or str(c_loc.get("dni") or "")
                if not obra_social or obra_social.upper() == "PARTICULAR":
                    obra_social = str(c_loc.get("obra_social") or obra_social or "Particular")
                if not paciente_nombre or paciente_nombre.startswith("Paciente #"):
                    paciente_nombre = str(c_loc.get("nombre") or paciente_nombre)
            
            # Si todavia falta telefono, consultar ficha en Geclisa
            digits_check = "".join(filter(str.isdigit, raw_tel))
            if len(digits_check) < 7:
                ficha_data = obtener_ficha_geclisa_con_cache(ficha_id)
                if ficha_data:
                    celular_ficha = ficha_data.get("celular")
                    raw_tel = raw_tel or ficha_data.get("telefono") or ""
                    dni = dni or str(ficha_data.get("dni") or "")
                    if not obra_social or obra_social.upper() == "PARTICULAR":
                        obra_social = str(ficha_data.get("obra_social") or obra_social or "Particular")
                    if not paciente_nombre or paciente_nombre.startswith("Paciente #"):
                        paciente_nombre = str(ficha_data.get("nombre_completo") or paciente_nombre)
        # 4. Normalizar teléfono regional Mendoza
        tel_norm, err_tel = normalizar_telefono_optica_mza(
            raw_phone=raw_tel,
            celular_preferido=celular_ficha,
            default_area_code=str(cfg.get("area_code_default") or "261")
        )
        if not tel_norm:
            excluidos.append({
                "turno_id": turno_id,
                "ficha_id": ficha_id,
                "paciente_nombre": paciente_nombre,
                "telefono_raw": raw_tel,
                "hora_turno": hora_turno,
                "servicio": servicio,
                "servicio_id": servicio_id,
                "practica": practica,
                "ubicacion": ubicacion,
                "ubicacion_id": ubicacion_id,
                "consultorio": consultorio,
                "consultorio_id": consultorio_id,
                "prestador_id": prestador_id,
                "prestador_nombre": prestador_nombre,
                "servicio_practica": f"{servicio} - {practica}".strip(" -"),
                "motivo_exclusion": err_tel or "SIN_TELEFONO_MOVIL"
            })
            continue

        # 5. Deduplicación diaria por ficha y por teléfono (un paciente con 2 turnos el mismo día recibe 1 solo mensaje)
        if (ficha_id and ficha_id in seen_fichas) or (tel_norm in seen_phones):
            excluidos.append({
                "turno_id": turno_id,
                "ficha_id": ficha_id,
                "paciente_nombre": paciente_nombre,
                "telefono": tel_norm,
                "hora_turno": hora_turno,
                "servicio": servicio,
                "servicio_id": servicio_id,
                "practica": practica,
                "ubicacion": ubicacion,
                "ubicacion_id": ubicacion_id,
                "consultorio": consultorio,
                "consultorio_id": consultorio_id,
                "prestador_id": prestador_id,
                "prestador_nombre": prestador_nombre,
                "servicio_practica": f"{servicio} - {practica}".strip(" -"),
                "motivo_exclusion": "DUPLICADO_MISMO_DIA"
            })
            continue

        # 6. Verificar Opt-Out y Cooldown
        if tel_norm in opt_out_phones:
            excluidos.append({
                "turno_id": turno_id,
                "ficha_id": ficha_id,
                "paciente_nombre": paciente_nombre,
                "telefono": tel_norm,
                "hora_turno": hora_turno,
                "servicio": servicio,
                "servicio_id": servicio_id,
                "practica": practica,
                "ubicacion": ubicacion,
                "ubicacion_id": ubicacion_id,
                "consultorio": consultorio,
                "consultorio_id": consultorio_id,
                "prestador_id": prestador_id,
                "prestador_nombre": prestador_nombre,
                "servicio_practica": f"{servicio} - {practica}".strip(" -"),
                "motivo_exclusion": "OPT_OUT_BAJA"
            })
            continue

        is_test_wl = es_telefono_whitelist_prueba(tel_norm, cfg)
        if not is_test_wl and tel_norm in recent_promo_phones:
            excluidos.append({
                "turno_id": turno_id,
                "ficha_id": ficha_id,
                "paciente_nombre": paciente_nombre,
                "telefono": tel_norm,
                "hora_turno": hora_turno,
                "servicio": servicio,
                "servicio_id": servicio_id,
                "practica": practica,
                "ubicacion": ubicacion,
                "ubicacion_id": ubicacion_id,
                "consultorio": consultorio,
                "consultorio_id": consultorio_id,
                "prestador_id": prestador_id,
                "prestador_nombre": prestador_nombre,
                "servicio_practica": f"{servicio} - {practica}".strip(" -"),
                "motivo_exclusion": f"COOLDOWN_{cooldown_dias}_DIAS"
            })
            continue

        if ficha_id:
            seen_fichas.add(ficha_id)
        seen_phones.add(tel_norm)

        cupon = generar_codigo_beneficio_vortix(ficha_id or tel_norm, fecha_obj)
        dedup_key = f"turno_descuento:{ficha_id or tel_norm}:{fecha_obj}"

        item_elegible = {
            "dedup_key": dedup_key,
            "tipo_oportunidad": "turno_proximo_descuento",
            "turno_geclisa_id": turno_id,
            "ficha_geclisa_id": ficha_id or tel_norm,
            "paciente_nombre": paciente_nombre or f"Paciente {tel_norm[-4:]}",
            "dni": dni,
            "telefono": tel_norm,
            "obra_social": obra_social,
            "fecha_turno": f"{fecha_obj}T{hora_turno if len(hora_turno) == 5 else '09:00'}:00-03:00",
            "hora_turno": hora_turno,
            "prestador_id": prestador_id,
            "prestador_nombre": prestador_nombre,
            "servicio": servicio,
            "servicio_id": servicio_id,
            "practica": practica,
            "ubicacion": ubicacion,
            "ubicacion_id": ubicacion_id,
            "consultorio": consultorio,
            "consultorio_id": consultorio_id,
            "servicio_practica": f"{servicio} - {practica}".strip(" -"),
            "fuente_deteccion": "agenda_geclisa",
            "codigo_beneficio": cupon
        }
        elegibles.append(item_elegible)

    guardados = 0
    encolados = 0

    if not dry_run and supabase and elegibles:
        tpl_name = str(cfg.get("template_turno_descuento") or "vortix_beneficio_turno_v1")
        descuento_txt = str(cfg.get("porcentaje_descuento_turno") or "20% OFF")
        placa_url = str(cfg.get("placa_turno_url") or "").strip() or None

        for idx, item in enumerate(elegibles):
            try:
                contacto = upsert_optica_contacto(
                    telefono=item["telefono"],
                    nombre=item["paciente_nombre"],
                    ficha_geclisa_id=item["ficha_geclisa_id"],
                    dni=item["dni"],
                    obra_social=item["obra_social"],
                    codigo_cupon=item["codigo_beneficio"],
                    ultimo_turno_id=item["turno_geclisa_id"],
                    ultimo_turno_fecha=item["fecha_turno"]
                )
                contacto_id = contacto.get("id") if contacto else None

                # Verificar si ya existe la oportunidad por dedup_key
                ex_op = (
                    supabase.table("optica_oportunidades_geclisa")
                    .select("id, estado_comercial, envio_programado_id")
                    .eq("dedup_key", item["dedup_key"])
                    .limit(1)
                    .execute()
                )
                now_iso = datetime.now(timezone.utc).isoformat()
                op_id = None
                already_sent = False

                if ex_op.data and len(ex_op.data) > 0:
                    op_id = ex_op.data[0]["id"]
                    cur_st = ex_op.data[0].get("estado_comercial") or "detectada"
                    already_sent = cur_st in ("mensaje_encolado", "mensaje_enviado", "respondio", "presupuestado", "vendido")
                    supabase.table("optica_oportunidades_geclisa").update({
                        "contacto_id": contacto_id,
                        "telefono": item["telefono"],
                        "obra_social": item["obra_social"],
                        "updated_at": now_iso
                    }).eq("id", op_id).execute()
                else:
                    op_payload = {
                        **item,
                        "contacto_id": contacto_id,
                        "estado_comercial": "mensaje_encolado" if debe_encolar else "detectada",
                        "created_at": now_iso,
                        "updated_at": now_iso
                    }
                    ins_op = supabase.table("optica_oportunidades_geclisa").insert(op_payload).execute()
                    if ins_op.data:
                        op_id = ins_op.data[0]["id"]
                guardados += 1

                if debe_encolar and op_id and not already_sent:
                    # Escalonar envíos con jitter (20 segundos promedio por contacto)
                    prog_time = datetime.now(timezone.utc) + timedelta(seconds=idx * 22 + random.randint(2, 12))
                    fecha_legible = datetime.strptime(fecha_obj, "%Y-%m-%d").strftime("%d/%m/%Y")
                    params_tpl = [
                        {"type": "text", "text": item["paciente_nombre"].split(",")[0].title()},
                        {"type": "text", "text": f"{fecha_legible} a las {item['hora_turno']} hs"},
                        {"type": "text", "text": descuento_txt},
                        {"type": "text", "text": item["codigo_beneficio"]}
                    ]
                    env_dedup = f"envio_turno:{item['ficha_geclisa_id']}:{fecha_obj}"
                    env_payload = {
                        "oportunidad_id": op_id,
                        "contacto_id": contacto_id,
                        "telefono": item["telefono"],
                        "dedup_key": env_dedup,
                        "origen": "auto_turno_descuento",
                        "template_name": tpl_name,
                        "template_language": "es_AR",
                        "parameters": params_tpl,
                        "header_media_url": placa_url,
                        "prioridad": 3,
                        "programado_para": prog_time.isoformat(),
                        "estado": "pendiente",
                        "created_at": now_iso,
                        "updated_at": now_iso
                    }
                    ins_env = supabase.table("optica_envios_programados").upsert(env_payload, on_conflict="dedup_key").execute()
                    env_id = ins_env.data[0]["id"] if ins_env.data else None
                    supabase.table("optica_oportunidades_geclisa").update({
                        "estado_comercial": "mensaje_encolado",
                        "envio_programado_id": env_id,
                        "updated_at": now_iso
                    }).eq("id", op_id).execute()
                    encolados += 1
            except Exception as item_err:
                logger.warning(f"[Motor1] Error guardando turno elegible {item.get('dedup_key')}: {item_err}")

    # Construir lista combinada 'turnos' / 'items' compatible con OpticaPreviewTurno del Frontend
    turnos_combinados: List[Dict[str, Any]] = []
    for idx_e, el in enumerate(elegibles):
        turnos_combinados.append({
            **el,
            "id": str(el.get("turno_geclisa_id") or el.get("ficha_geclisa_id") or f"el-{idx_e}"),
            "nombre_paciente": el.get("paciente_nombre"),
            "telefono_raw": el.get("telefono"),
            "telefono_normalizado": el.get("telefono"),
            "medico_nombre": el.get("prestador_nombre") or "Oftalmólogo",
            "servicio": el.get("servicio_practica") or "Consulta Oftalmológica",
            "cupon_codigo": el.get("codigo_beneficio"),
            "excluido": False,
            "motivo_exclusion": None
        })
    for idx_x, ex in enumerate(excluidos):
        f_id_ex = str(ex.get("ficha_id") or ex.get("ficha_geclisa_id") or "")
        turnos_combinados.append({
            **ex,
            "id": str(ex.get("turno_id") or f_id_ex or f"ex-{idx_x}"),
            "ficha_geclisa_id": f_id_ex,
            "nombre_paciente": ex.get("paciente_nombre"),
            "telefono_raw": ex.get("telefono_raw") or ex.get("telefono") or "",
            "telefono_normalizado": ex.get("telefono") or "",
            "fecha_turno": fecha_obj,
            "medico_nombre": ex.get("prestador_nombre") or "Clínica",
            "servicio": ex.get("servicio_practica") or "Consulta",
            "cupon_codigo": generar_codigo_beneficio_vortix(f_id_ex or str(idx_x), fecha_obj),
            "excluido": True
        })

    return {
        "success": True,
        "dry_run": dry_run,
        "fecha_objetivo": fecha_obj,
        "dias_anticipacion": dias,
        "total_turnos_geclisa": len(raw_turnos),
        "total_elegibles": len(elegibles),
        "total_excluidos": len(excluidos),
        "guardados": guardados,
        "encolados": encolados,
        "elegibles": elegibles,
        "excluidos": excluidos,
        "turnos": turnos_combinados,
        "items": turnos_combinados
    }


# ============================================================================
# 6. MOTOR 2: DETECCIÓN DIARIA DE INDICACIONES DE LENTES AÉREOS Y DE CONTACTO
# ============================================================================

def detectar_indicaciones_lentes_del_dia(
    fecha_iso: Optional[str] = None,
    auto_encolar: Optional[bool] = None
) -> Dict[str, Any]:
    """
    Motor 2: Escanea las atenciones médicas del día buscando prescripciones o indicaciones de
      - Lentes Aéreos / Anteojos (`indicacion_lentes_aereos`)
      - Lentes de Contacto (`indicacion_lentes_contacto`)
      - Ambos (`indicacion_ambos`)

    Fuentes inspeccionadas (100% lectura en Geclisa):
      1. Tablas locales si existen registros del día (`recetas_anteojos_oftalmo`, `consultas_oftalmo`).
      2. Agenda del día en Geclisa (`geclisa_client.obtener_agenda_global(fecha_obj)`):
         Para cada ficha atendida/ingresada (o todas las activas del día), consulta
         `obtener_indicaciones_medicas(ficha_id)` y `obtener_historia_clinica_resumen(ficha_id)`
         filtrando registros cuya fecha coincida con `fecha_obj`.
    """
    cfg = get_optica_vortix_full_config()
    now_mza = get_mendoza_now()
    fecha_obj = (fecha_iso or now_mza.strftime("%Y-%m-%d")).split("T")[0].strip()

    # Formatos alternativos de fecha que Geclisa puede devolver (ej. DD/MM/YYYY)
    try:
        dt_obj = datetime.strptime(fecha_obj, "%Y-%m-%d")
        fecha_dmy = dt_obj.strftime("%d/%m/%Y")
        fecha_dm_short = dt_obj.strftime("%d-%m-%Y")
    except Exception:
        fecha_dmy = fecha_obj
        fecha_dm_short = fecha_obj

    debe_encolar = bool(
        auto_encolar
        if auto_encolar is not None
        else (cfg.get("auto_recetas_lentes_enabled", False) and cfg.get("modo_disparo_recetas") == "automatico")
    )
    delay_min = int(cfg.get("delay_minutos_post_consulta", 45))

    detectadas: List[Dict[str, Any]] = []
    excluidas_quirurgicas: List[Dict[str, Any]] = []
    seen_dedup: set = set()

    # A. Revisar Agenda del día en Geclisa + Historia Clínica / Indicaciones / Recetas
    turnos_hoy = geclisa_client.obtener_agenda_global(fecha_obj) or []
    fichas_a_revisar: Dict[str, Dict[str, Any]] = {}
    for t in turnos_hoy:
        if t.get("cancelado") or str(t.get("estado_key") or "").lower() == "cancelado":
            continue
        fid = str(t.get("ficha_id") or "").strip()
        if not fid:
            continue
        # Priorizar turnos atendidos o ingresados, o conservar todos los del día
        if fid not in fichas_a_revisar or t.get("asistio") or t.get("en_espera"):
            fichas_a_revisar[fid] = t

    for fid, t_info in fichas_a_revisar.items():
        textos_del_dia: List[Tuple[str, str, str, str]] = []  # (fuente, reg_id, prestador, texto)

        # 1. Consultar Indicaciones Médicas y Recetas en Geclisa
        try:
            ind_res = geclisa_client.obtener_indicaciones_medicas(int(fid))
            for ind in (ind_res.get("indicaciones") or []):
                f_str = str(ind.get("fecha") or "")
                if fecha_obj in f_str or fecha_dmy in f_str or fecha_dm_short in f_str:
                    txt_comb = f"{ind.get('titulo') or ''}: {ind.get('texto') or ''}".strip(" :")
                    if txt_comb:
                        textos_del_dia.append((
                            f"geclisa_{str(ind.get('tipo') or 'indicacion').lower()}",
                            str(ind.get("id") or ""),
                            str(ind.get("prestador") or t_info.get("prestador_nombre") or ""),
                            txt_comb
                        ))
        except Exception as e_ind:
            logger.debug(f"[Motor2] Aviso consultando indicaciones para ficha {fid}: {e_ind}")

        # 2. Consultar Evoluciones de Historia Clínica Resumen del día en Geclisa
        try:
            hc_res = geclisa_client.obtener_historia_clinica_resumen(int(fid))
            for ev in (hc_res.get("evoluciones_recientes") or []):
                f_ev = f"{ev.get('fecha') or ''} {ev.get('fecha_hora') or ''}"
                if fecha_obj in f_ev or fecha_dmy in f_ev or fecha_dm_short in f_ev:
                    txt_ev = str(ev.get("texto") or "").strip()
                    if txt_ev:
                        textos_del_dia.append((
                            "evolucion_hc_geclisa",
                            str(ev.get("hc_id") or ""),
                            str(ev.get("prestador") or t_info.get("prestador_nombre") or ""),
                            txt_ev
                        ))
        except Exception as e_hc:
            logger.debug(f"[Motor2] Aviso consultando HC resumen para ficha {fid}: {e_hc}")

        if not textos_del_dia:
            continue

        # Evaluar clasificador sobre los textos encontrados del día para esta ficha
        full_text_ficha = "\n".join(x[3] for x in textos_del_dia)
        clasif = clasificar_indicacion_optica(full_text_ficha)

        if not clasif.get("es_oportunidad"):
            if clasif.get("motivo_exclusion") and "QUIRURGICO" in str(clasif.get("motivo_exclusion")):
                excluidas_quirurgicas.append({
                    "ficha_geclisa_id": fid,
                    "paciente_nombre": t_info.get("paciente"),
                    "motivo": clasif.get("motivo_exclusion"),
                    "extracto": clasif.get("extracto_relevante")
                })
            continue

        # Enriquecer teléfono desde ficha completa si es necesario
        raw_tel = str(t_info.get("telefono") or "").strip()
        ficha_completa = obtener_ficha_geclisa_con_cache(fid)
        celular_ficha = ficha_completa.get("celular") if ficha_completa else None
        raw_tel = raw_tel or (ficha_completa.get("telefono") if ficha_completa else "") or ""
        dni = str(t_info.get("dni") or (ficha_completa.get("dni") if ficha_completa else "") or "").strip()
        obra_social = str(t_info.get("obra_social") or (ficha_completa.get("obra_social") if ficha_completa else "") or "Particular").strip()
        pac_nombre = str(t_info.get("paciente") or (ficha_completa.get("nombre_completo") if ficha_completa else "") or f"Paciente #{fid}").strip()

        tel_norm, _ = normalizar_telefono_optica_mza(
            raw_phone=raw_tel,
            celular_preferido=celular_ficha,
            default_area_code=str(cfg.get("area_code_default") or "261")
        )

        fuente_primaria, hc_reg_id, prest_nom, _ = textos_del_dia[0]
        # Caso Borde 1: Dedup key granular por médico/consulta para no descartar prescripciones vespertinas
        medico_key = str(t_info.get("prestador_id") or hc_reg_id or t_info.get("turno_id") or "gral")
        dedup_key = f"indicacion_hc:{fid}:{fecha_obj}:{medico_key}"
        if dedup_key in seen_dedup:
            continue
        seen_dedup.add(dedup_key)

        cupon = generar_codigo_beneficio_vortix(fid, fecha_obj)
        detectadas.append({
            "dedup_key": dedup_key,
            "tipo_oportunidad": clasif["tipo_oportunidad"],
            "turno_geclisa_id": str(t_info.get("turno_id") or ""),
            "ficha_geclisa_id": fid,
            "paciente_nombre": pac_nombre,
            "dni": dni,
            "telefono": tel_norm,
            "obra_social": obra_social,
            "fecha_turno": f"{fecha_obj}T{t_info.get('hora') or '10:00'}:00-03:00",
            "hora_turno": str(t_info.get("hora") or ""),
            "prestador_id": str(t_info.get("prestador_id") or ""),
            "prestador_nombre": prest_nom or str(t_info.get("prestador_nombre") or ""),
            "servicio_practica": str(t_info.get("practica") or t_info.get("servicio") or "Consulta Oftalmológica"),
            "fuente_deteccion": fuente_primaria,
            "hc_registro_id": hc_reg_id,
            "texto_indicacion_detectada": clasif.get("extracto_relevante") or full_text_ficha[:300],
            "graduacion_json": clasif.get("graduacion_json") or {},
            "codigo_beneficio": cupon
        })

    # B. Revisar tabla local recetas_anteojos_oftalmo si existe en Supabase
    if supabase:
        try:
            rec_loc = (
                supabase.table("recetas_anteojos_oftalmo")
                .select("*")
                .gte("created_at", f"{fecha_obj}T00:00:00")
                .lte("created_at", f"{fecha_obj}T23:59:59")
                .execute()
            )
            for r in (rec_loc.data or []):
                fid = str(r.get("ficha_geclisa_id") or r.get("paciente_id") or r.get("id") or "")
                dedup_key = f"indicacion_hc:{fid}:{fecha_obj}"
                if not fid or dedup_key in seen_dedup:
                    continue
                clasif = clasificar_indicacion_optica(
                    texto=str(r.get("observaciones") or "Receta de lentes aéreos"),
                    datos_estructurados=r
                )
                if not clasif.get("es_oportunidad"):
                    continue
                seen_dedup.add(dedup_key)
                tel_norm, _ = normalizar_telefono_optica_mza(r.get("telefono"))
                detectadas.append({
                    "dedup_key": dedup_key,
                    "tipo_oportunidad": clasif["tipo_oportunidad"],
                    "turno_geclisa_id": "",
                    "ficha_geclisa_id": fid,
                    "paciente_nombre": str(r.get("paciente_nombre") or "Paciente"),
                    "dni": str(r.get("dni") or ""),
                    "telefono": tel_norm,
                    "obra_social": str(r.get("obra_social") or "Particular"),
                    "fecha_turno": f"{fecha_obj}T10:00:00-03:00",
                    "hora_turno": "10:00",
                    "prestador_id": "",
                    "prestador_nombre": str(r.get("medico_nombre") or "Oftalmólogo"),
                    "servicio_practica": "Receta de Anteojos",
                    "fuente_deteccion": "receta_oftalmo_local",
                    "hc_registro_id": str(r.get("id") or ""),
                    "texto_indicacion_detectada": clasif.get("extracto_relevante") or "Receta estructurada de anteojos",
                    "graduacion_json": clasif.get("graduacion_json") or {},
                    "codigo_beneficio": generar_codigo_beneficio_vortix(fid, fecha_obj)
                })
        except Exception:
            pass

    guardadas = 0
    encoladas = 0

    if supabase and detectadas:
        now_iso = datetime.now(timezone.utc).isoformat()
        for idx, item in enumerate(detectadas):
            try:
                contacto_id = None
                if item.get("telefono"):
                    contacto = upsert_optica_contacto(
                        telefono=item["telefono"],
                        nombre=item["paciente_nombre"],
                        ficha_geclisa_id=item["ficha_geclisa_id"],
                        dni=item["dni"],
                        obra_social=item["obra_social"],
                        codigo_cupon=item["codigo_beneficio"],
                        graduacion_json=item.get("graduacion_json")
                    )
                    contacto_id = contacto.get("id") if contacto else None

                ex_op = (
                    supabase.table("optica_oportunidades_geclisa")
                    .select("id, estado_comercial")
                    .eq("dedup_key", item["dedup_key"])
                    .limit(1)
                    .execute()
                )

                initial_state = "sin_telefono" if not item.get("telefono") else ("mensaje_encolado" if debe_encolar else "detectada")
                op_id = None
                already_processed = False

                if ex_op.data and len(ex_op.data) > 0:
                    op_id = ex_op.data[0]["id"]
                    cur_st = ex_op.data[0].get("estado_comercial") or "detectada"
                    already_processed = cur_st in ("mensaje_encolado", "mensaje_enviado", "respondio", "presupuestado", "vendido")
                    upd_fields: Dict[str, Any] = {
                        "contacto_id": contacto_id,
                        "telefono": item.get("telefono"),
                        "texto_indicacion_detectada": item.get("texto_indicacion_detectada"),
                        "graduacion_json": item.get("graduacion_json") or {},
                        "updated_at": now_iso
                    }
                    if cur_st == "sin_telefono" and item.get("telefono"):
                        upd_fields["estado_comercial"] = "detectada"
                    supabase.table("optica_oportunidades_geclisa").update(upd_fields).eq("id", op_id).execute()
                else:
                    ins_op = supabase.table("optica_oportunidades_geclisa").insert({
                        **item,
                        "contacto_id": contacto_id,
                        "estado_comercial": initial_state,
                        "created_at": now_iso,
                        "updated_at": now_iso
                    }).execute()
                    if ins_op.data:
                        op_id = ins_op.data[0]["id"]
                guardadas += 1

                if debe_encolar and op_id and item.get("telefono") and not already_processed:
                    res_enc = encolar_envio_oportunidad_optica(
                        oportunidad_id=op_id,
                        delay_seconds=delay_min * 60 + idx * 25
                    )
                    if res_enc.get("success"):
                        encoladas += 1
            except Exception as err_d:
                logger.warning(f"[Motor2] Error guardando oportunidad {item.get('dedup_key')}: {err_d}")

    return {
        "success": True,
        "fecha": fecha_obj,
        "fichas_escaneadas": len(fichas_a_revisar),
        "total_detectadas": len(detectadas),
        "detectados": len(detectadas),
        "excluidas_quirurgicas": len(excluidas_quirurgicas),
        "guardadas": guardadas,
        "nuevos": guardadas,
        "encoladas": encoladas,
        "oportunidades": detectadas,
        "detalle_excluidas_quirurgicas": excluidas_quirurgicas
    }


def encolar_envio_oportunidad_optica(
    oportunidad_id: str,
    delay_seconds: int = 5,
    template_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Encola en `public.optica_envios_programados` el mensaje de WhatsApp correspondiente a una
    oportunidad detectada en Geclisa (turno próximo o indicación de lentes aéreos/contacto).
    """
    if not supabase:
        return {"success": False, "error": "Supabase no disponible"}

    op_res = supabase.table("optica_oportunidades_geclisa").select("*").eq("id", oportunidad_id).limit(1).execute()
    if not op_res.data:
        return {"success": False, "error": "Oportunidad no encontrada"}

    op = op_res.data[0]
    tel = str(op.get("telefono") or "").strip()
    if not tel:
        return {"success": False, "error": "La oportunidad no tiene un teléfono móvil válido"}

    cfg = get_optica_vortix_full_config()
    tipo = str(op.get("tipo_oportunidad") or "indicacion_lentes_aereos")
    nombre_corto = str(op.get("paciente_nombre") or "Paciente").split(",")[0].title().strip()
    prestador = str(op.get("prestador_nombre") or "su oftalmólogo").title().strip()
    cupon = str(op.get("codigo_beneficio") or generar_codigo_beneficio_vortix(str(op.get("ficha_geclisa_id") or tel)))
    descuento = str(cfg.get("porcentaje_descuento_turno") or "20% OFF")

    if tipo == "turno_proximo_descuento":
        tpl_name = template_override or str(cfg.get("template_turno_descuento") or "vortix_beneficio_turno_v1")
        placa_url = str(cfg.get("placa_turno_url") or "").strip() or None
        origen = "auto_turno_descuento"
        f_turno = str(op.get("fecha_turno") or "")[:10]
        h_turno = str(op.get("hora_turno") or "09:00")
        params = [
            {"type": "text", "text": nombre_corto},
            {"type": "text", "text": f"{f_turno} {h_turno} hs".strip()},
            {"type": "text", "text": descuento},
            {"type": "text", "text": cupon}
        ]
    elif tipo == "indicacion_lentes_contacto":
        tpl_name = template_override or str(cfg.get("template_lentes_contacto") or "vortix_receta_lentes_contacto_v1")
        placa_url = str(cfg.get("placa_contacto_url") or "").strip() or None
        origen = "auto_receta_contacto"
        params = [
            {"type": "text", "text": nombre_corto},
            {"type": "text", "text": prestador},
            {"type": "text", "text": cupon}
        ]
    else:
        tpl_name = template_override or str(cfg.get("template_lentes_aereos") or "vortix_receta_lentes_aereos_v1")
        placa_url = str(cfg.get("placa_aereos_url") or "").strip() or None
        origen = "auto_receta_aereos"
        params = [
            {"type": "text", "text": nombre_corto},
            {"type": "text", "text": prestador},
            {"type": "text", "text": descuento},
            {"type": "text", "text": cupon}
        ]

    now_utc = datetime.now(timezone.utc)
    prog_para = (now_utc + timedelta(seconds=max(0, delay_seconds))).isoformat()
    dedup_key = f"envio_op:{oportunidad_id}"

    env_payload = {
        "oportunidad_id": oportunidad_id,
        "contacto_id": op.get("contacto_id"),
        "telefono": tel,
        "dedup_key": dedup_key,
        "origen": origen,
        "template_name": tpl_name,
        "template_language": "es_AR",
        "parameters": params,
        "header_media_url": placa_url,
        "prioridad": 2,
        "programado_para": prog_para,
        "estado": "pendiente",
        "updated_at": now_utc.isoformat()
    }

    ins = supabase.table("optica_envios_programados").upsert(env_payload, on_conflict="dedup_key").execute()
    env_id = ins.data[0]["id"] if ins.data else None

    supabase.table("optica_oportunidades_geclisa").update({
        "estado_comercial": "mensaje_encolado",
        "envio_programado_id": env_id,
        "updated_at": now_utc.isoformat()
    }).eq("id", oportunidad_id).execute()

    return {"success": True, "envio_id": env_id, "template_name": tpl_name, "programado_para": prog_para}


# ============================================================================
# 7. WEBHOOK INBOUND & STATUS UPDATES DE LA LÍNEA 3 (ÓPTICA VORTIX)
# ============================================================================

async def handle_optica_line_status_update(
    status_dict: Dict[str, Any],
    phone_number_id: Optional[str] = None,
    only_if_exists: bool = False
) -> bool:
    """
    Actualiza el estado de entrega/lectura (`sent`, `delivered`, `read`, `failed`)
    exclusivamente en `public.optica_mensajes`, `public.optica_envios_programados`
    y contadores de `public.optica_campanas`.
    Retorna True si el wamid pertenecía a Óptica Vortix.
    """
    if not supabase:
        return False

    wamid = status_dict.get("id")
    status_name = str(status_dict.get("status") or "sent").lower()
    if not wamid:
        return False

    try:
        m_res = supabase.table("optica_mensajes").select("id, estado, metadata").eq("wamid", wamid).limit(1).execute()
        has_msg = bool(m_res.data and len(m_res.data) > 0)

        e_res = supabase.table("optica_envios_programados").select("id, campana_id, estado").eq("wamid", wamid).limit(1).execute()
        has_env = bool(e_res.data and len(e_res.data) > 0)

        if only_if_exists and not has_msg and not has_env:
            return False

        now_iso = datetime.now(timezone.utc).isoformat()
        err_code = None
        err_detail = None
        if status_name == "failed":
            errors = status_dict.get("errors", [{}])
            first_err = errors[0] if errors else {}
            err_code = str(first_err.get("code") or "")
            err_detail = str(first_err.get("message") or first_err.get("title") or "Error en entrega de Meta")

        if has_msg:
            msg_row = m_res.data[0]
            upd_msg: Dict[str, Any] = {
                "estado": status_name,
                "updated_at": now_iso
            }
            if err_code:
                upd_msg["error_code"] = err_code
            if err_detail:
                upd_msg["error_detail"] = err_detail
            supabase.table("optica_mensajes").update(upd_msg).eq("id", msg_row["id"]).execute()

        if has_env:
            env_row = e_res.data[0]
            camp_id = env_row.get("campana_id")
            if status_name == "failed":
                supabase.table("optica_envios_programados").update({
                    "estado": "fallido",
                    "error_detalle": f"[{err_code}] {err_detail}" if err_code else err_detail,
                    "updated_at": now_iso
                }).eq("id", env_row["id"]).execute()

            if camp_id:
                c_res = supabase.table("optica_campanas").select("*").eq("id", camp_id).limit(1).execute()
                if c_res.data:
                    c_row = c_res.data[0]
                    c_upd: Dict[str, Any] = {"updated_at": now_iso}
                    if status_name == "delivered":
                        c_upd["entregados_count"] = int(c_row.get("entregados_count") or 0) + 1
                    elif status_name == "read":
                        c_upd["leidos_count"] = int(c_row.get("leidos_count") or 0) + 1
                    elif status_name == "failed":
                        c_upd["fallidos_count"] = int(c_row.get("fallidos_count") or 0) + 1
                    if len(c_upd) > 1:
                        supabase.table("optica_campanas").update(c_upd).eq("id", camp_id).execute()

        return True
    except Exception as e:
        logger.warning(f"[OpticaStatus] Error actualizando status para wamid={wamid}: {e}")
        return False


async def handle_optica_line_inbound_message(
    msg_dict: Dict[str, Any],
    phone_number_id: str,
    contact_name: Optional[str] = None,
    optica_cfg: Optional[Dict[str, Any]] = None
):
    """
    Procesa de forma 100% aislada todos los mensajes entrantes en la Línea 3 (Óptica Vortix):
      - NUNCA escribe en `public.pacientes`, `public.conversaciones` ni `public.mensajes`.
      - Registra el contacto en `public.optica_contactos`.
      - Abre/renueva la ventana gratuita de 24h en `public.optica_conversaciones`.
      - Descarga multimedia (fotos de recetas, audios, PDFs) y guarda el mensaje en `public.optica_mensajes`.
      - Ejecuta los Smart Flows de Óptica Vortix:
          1. Baja / Opt-out instantáneo (`BAJA`, `STOP`, `Dejar de recibir promos`).
          2. Zero-Wait Welcome & Entrega de Placa HD en Doble Paso (`Quiero mi descuento`, `Cotizar mi receta`, etc.).
          3. Respuesta a botones interactivos (`📸 Enviar mi receta`, `🕶️ Promos Armazones`, `💬 Hablar con óptico`).
          4. Auto-respuesta inteligente fuera de horario comercial.
    """
    if not supabase:
        return

    cfg = get_optica_vortix_full_config()
    wamid = msg_dict.get("id")
    raw_sender = str(msg_dict.get("from") or "").strip()
    tel_norm, _ = normalizar_telefono_optica_mza(raw_sender)
    if not tel_norm:
        from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164
        tel_norm = normalize_to_meta_e164(raw_sender)

    msg_type = str(msg_dict.get("type") or "text").lower()
    opt_phone_id, opt_token = get_whatsapp_optica_credentials()
    wa_client = None
    if opt_phone_id and opt_token:
        try:
            wa_client = WhatsAppCloudClient(phone_number_id=opt_phone_id, access_token=opt_token, line="optica")
            if wamid:
                await wa_client.mark_as_read(wamid)
        except Exception:
            pass

    try:
        # 1. Extraer texto, botones interactivos y multimedia
        text_content = ""
        button_id = ""
        media_url = None
        media_id = None
        mime_type = None
        msg_meta: Dict[str, Any] = {"raw_type": msg_type, "wamid": wamid}

        if msg_type == "text":
            text_content = str(msg_dict.get("text", {}).get("body") or "").strip()
        elif msg_type == "button":
            btn = msg_dict.get("button", {})
            button_id = str(btn.get("payload") or btn.get("text") or "").strip()
            text_content = str(btn.get("text") or btn.get("payload") or "Botón presionado").strip()
            msg_meta["button_payload"] = button_id
        elif msg_type == "interactive":
            inter = msg_dict.get("interactive", {})
            reply = inter.get("button_reply") or inter.get("list_reply") or {}
            button_id = str(reply.get("id") or "").strip()
            text_content = str(reply.get("title") or button_id or "Opción seleccionada").strip()
            msg_meta["interactive_id"] = button_id
        elif msg_type in ("image", "document", "audio", "video", "sticker"):
            m_obj = msg_dict.get(msg_type, {})
            media_id = m_obj.get("id")
            mime_type = m_obj.get("mime_type")
            caption = str(m_obj.get("caption") or "").strip()
            filename = str(m_obj.get("filename") or f"optica_{msg_type}_{media_id}").strip()
            text_content = caption or (
                "📷 [Foto de Receta / Imagen]" if msg_type == "image"
                else "🎤 [Nota de voz]" if msg_type == "audio"
                else f"📄 [{filename}]"
            )
            if media_id and wa_client:
                try:
                    from app.services.media_service import MediaService
                    m_bytes, dl_mime = await wa_client.download_media_bytes(media_id)
                    mime_type = dl_mime or mime_type
                    subf = "images" if msg_type == "image" else ("audio" if msg_type == "audio" else "documents")
                    saved = MediaService.save_media_bytes(
                        data=m_bytes,
                        subfolder=subf,
                        mime_type=mime_type or "application/octet-stream",
                        original_filename=filename,
                        prefix=f"optica_{msg_type}"
                    )
                    media_url = (saved.get("media_url") or "").rstrip("?")
                    msg_meta["file_name"] = saved.get("file_name") or filename
                    msg_meta["file_size_bytes"] = len(m_bytes)

                    if msg_type == "audio":
                        try:
                            from app.agent import transcribir_audio_con_gemini
                            trans = transcribir_audio_con_gemini(audio_bytes=m_bytes, mime_type=mime_type)
                            if trans:
                                text_content = f"🎤 {trans}"
                                msg_meta["transcripcion"] = trans
                        except Exception:
                            pass
                except Exception as dl_err:
                    logger.warning(f"[OpticaInbound] Error descargando media {media_id}: {dl_err}")
        else:
            text_content = f"[{msg_type.upper()}] Mensaje recibido"

        # 2. Obtener o crear Contacto en optica_contactos
        contacto = upsert_optica_contacto(
            telefono=tel_norm,
            nombre=contact_name or f"Contacto {tel_norm[-4:]}"
        )
        contacto_id = contacto.get("id") if contacto else None
        nombre_paciente = (contacto.get("nombre") if contacto else None) or contact_name or "Paciente"
        cupon_activo = (contacto.get("codigo_cupon_activo") if contacto else None) or generar_codigo_beneficio_vortix(tel_norm)

        # 3. Obtener o crear Conversación en optica_conversaciones (Ventana 24h abierta)
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()
        window_exp = (now_utc + timedelta(hours=24)).isoformat()

        conv_res = supabase.table("optica_conversaciones").select("*").eq("telefono", tel_norm).limit(1).execute()
        conv_row = conv_res.data[0] if (conv_res.data and len(conv_res.data) > 0) else None

        if conv_row:
            conv_id = conv_row["id"]
            unread = int(conv_row.get("mensajes_no_leidos") or 0) + 1
            conv_meta = conv_row.get("metadata_json") or {}
            supabase.table("optica_conversaciones").update({
                "contacto_id": contacto_id or conv_row.get("contacto_id"),
                "nombre_contacto": nombre_paciente,
                "estado": "abierta",
                "archivada": False,
                "ventana_24h_expira_at": window_exp,
                "ultimo_mensaje_texto": text_content[:300],
                "ultimo_mensaje_at": now_iso,
                "ultimo_mensaje_direccion": "inbound",
                "mensajes_no_leidos": unread,
                "updated_at": now_iso
            }).eq("id", conv_id).execute()
        else:
            conv_meta = {}
            ins_conv = supabase.table("optica_conversaciones").insert({
                "contacto_id": contacto_id,
                "telefono": tel_norm,
                "nombre_contacto": nombre_paciente,
                "estado": "abierta",
                "etapa_comercial": "NUEVA_CONSULTA",
                "ventana_24h_expira_at": window_exp,
                "ultimo_mensaje_texto": text_content[:300],
                "ultimo_mensaje_at": now_iso,
                "ultimo_mensaje_direccion": "inbound",
                "mensajes_no_leidos": 1,
                "origen_oportunidad": "inbound_directo",
                "metadata_json": conv_meta,
                "created_at": now_iso,
                "updated_at": now_iso
            }).execute()
            conv_row = ins_conv.data[0] if ins_conv.data else {}
            conv_id = conv_row.get("id")

        if not conv_id:
            return

        # 4. Guardar mensaje entrante en optica_mensajes
        supabase.table("optica_mensajes").insert({
            "conversacion_id": conv_id,
            "contacto_id": contacto_id,
            "wamid": wamid,
            "direccion": "inbound",
            "tipo": msg_type if msg_type in ("text", "image", "document", "audio", "interactive", "button") else "text",
            "contenido": text_content,
            "media_url": media_url,
            "media_id": media_id,
            "mime_type": mime_type,
            "estado": "delivered",
            "enviado_por": "paciente",
            "metadata": msg_meta,
            "created_at": now_iso,
            "updated_at": now_iso
        }).execute()

        # 5. Si el paciente tenía oportunidades en estado mensaje_enviado/detectada, pasarlas a 'respondio'
        try:
            op_upd = (
                supabase.table("optica_oportunidades_geclisa")
                .select("id, estado_comercial")
                .eq("telefono", tel_norm)
                .in_("estado_comercial", ["detectada", "mensaje_encolado", "mensaje_enviado"])
                .execute()
            )
            for o_item in (op_upd.data or []):
                supabase.table("optica_oportunidades_geclisa").update({
                    "estado_comercial": "respondio",
                    "updated_at": now_iso
                }).eq("id", o_item["id"]).execute()
        except Exception:
            pass

        if not wa_client:
            return

        # ====================================================================
        # SMART FLOW 1: OPT-OUT / BAJA INSTANTÁNEA (PROTECCIÓN DE CALIDAD META)
        # ====================================================================
        clean_low = text_content.lower().strip()
        btn_low = button_id.lower().strip()
        is_opt_out = (
            clean_low in ("baja", "stop", "cancelar suscripcion", "no quiero recibir promos", "dejar de recibir promos")
            or "dejar de recibir" in clean_low
            or btn_low in ("optica_optout", "baja", "dejar de recibir promos")
        )
        if is_opt_out:
            if contacto_id:
                supabase.table("optica_contactos").update({
                    "opt_out": True,
                    "opt_out_fecha": now_iso,
                    "opt_out_motivo": f"Solicitud por WhatsApp: {text_content[:80]}",
                    "updated_at": now_iso
                }).eq("id", contacto_id).execute()
            supabase.table("optica_envios_programados").update({
                "estado": "cancelado",
                "error_detalle": "Cancelado por Opt-Out del contacto",
                "updated_at": now_iso
            }).eq("telefono", tel_norm).eq("estado", "pendiente").execute()
            supabase.table("optica_conversaciones").update({
                "etapa_comercial": "SIN_INTERES",
                "updated_at": now_iso
            }).eq("id", conv_id).execute()

            bye_text = (
                "✅ Hemos registrado tu solicitud en *Óptica Vortix*. "
                "Ya no recibirás notificaciones promocionales por este medio. "
                "Si en algún momento necesitás consultar por tus lentes o recetas, podés escribirnos cuando quieras. ¡Saludos!"
            )
            send_r = await wa_client.send_free_text(to_phone=tel_norm, text=bye_text)
            _record_optica_outbound_msg(conv_id, contacto_id, send_r.get("wamid"), "text", bye_text, "bot_optica")
            return

        # Si el bot está pausado manualmente por el óptico en esta conversación, no disparar respuestas automáticas
        if conv_row.get("bot_paused"):
            return

        # ====================================================================
        # SMART FLOW 2: ZERO-WAIT WELCOME & ENTREGA DE PLACA HD EN DOBLE PASO
        # ====================================================================
        pending_placa = conv_meta.get("pending_placa_delivery")
        is_promo_trigger = any(
            kw in clean_low or kw in btn_low
            for kw in (
                "quiero mi descuento", "ver mi cupón", "ver mi cupon", "activar descuento",
                "cotizar mi receta", "ver promoción", "ver promocion", "consultar lentes de contacto"
            )
        )

        if pending_placa or is_promo_trigger:
            placa_url_to_send = (
                (pending_placa.get("placa_url") if isinstance(pending_placa, dict) else None)
                or cfg.get("placa_turno_url")
                or cfg.get("placa_aereos_url")
            )
            if placa_url_to_send:
                try:
                    caption_placa = f"🎟️ Cupón exclusivo activado: *{cupon_activo}* — Óptica Vortix"
                    img_res = await wa_client.send_image(to_phone=tel_norm, image_url=placa_url_to_send, caption=caption_placa)
                    _record_optica_outbound_msg(
                        conv_id, contacto_id, img_res.get("wamid"), "image", caption_placa, "bot_optica", media_url=placa_url_to_send
                    )
                except Exception as img_e:
                    logger.warning(f"[OpticaSmartFlow] No se pudo enviar placa URL {placa_url_to_send}: {img_e}")

            welcome_tpl = str(cfg.get("mensaje_bienvenida_cupon") or DEFAULT_OPTICA_CONFIG["mensaje_bienvenida_cupon"])
            welcome_body = (
                welcome_tpl
                .replace("{nombre}", nombre_paciente.split(",")[0].title())
                .replace("{descuento}", str(cfg.get("porcentaje_descuento_turno") or "20% OFF"))
                .replace("{cupon}", cupon_activo)
            )
            buttons = [
                {"id": "OPTICA_ENVIAR_RECETA", "title": "📸 Enviar mi receta"},
                {"id": "OPTICA_PROMOS_ARMAZONES", "title": "🕶️ Promos Armazones"},
                {"id": "OPTICA_HABLAR_OPTICO", "title": "💬 Hablar con óptico"}
            ]
            btn_res = await wa_client.send_interactive_buttons(
                to_phone=tel_norm,
                body_text=welcome_body,
                buttons=buttons,
                header_text="Óptica Vortix • Beneficio Activo",
                footer_text="Presentá o cotizá hoy desde tu celular"
            )
            _record_optica_outbound_msg(conv_id, contacto_id, btn_res.get("wamid"), "interactive", welcome_body, "bot_optica")

            if pending_placa:
                conv_meta.pop("pending_placa_delivery", None)
                supabase.table("optica_conversaciones").update({"metadata_json": conv_meta}).eq("id", conv_id).execute()
            return

        # ====================================================================
        # SMART FLOW 3: RESPUESTA A BOTONES INTERACTIVOS DEL MENÚ DE ÓPTICA
        # ====================================================================
        if btn_low == "optica_enviar_receta" or "enviar mi receta" in clean_low or "enviar foto de mi receta" in clean_low:
            reply_receta = (
                "📸 *¡Perfecto!* Sacale una foto clara a tu receta oftalmológica y enviala en este chat.\n\n"
                "También contanos si buscás:\n"
                "1️⃣ Lentes para *lejos o cerca* (Monofocales)\n"
                "2️⃣ Lentes *Multifocales / Progresivos*\n"
                "3️⃣ *Lentes de Contacto*\n\n"
                "Un especialista de *Óptica Vortix* te preparará el presupuesto con tu descuento aplicado."
            )
            supabase.table("optica_conversaciones").update({
                "etapa_comercial": "PRESUPUESTO_AEREOS",
                "updated_at": now_iso
            }).eq("id", conv_id).execute()
            r_send = await wa_client.send_free_text(to_phone=tel_norm, text=reply_receta)
            _record_optica_outbound_msg(conv_id, contacto_id, r_send.get("wamid"), "text", reply_receta, "bot_optica")
            return

        if btn_low == "optica_promos_armazones" or "promos armazones" in clean_low or "promos en armazones" in clean_low:
            promos_txt = str(cfg.get("promos_armazones_texto") or DEFAULT_OPTICA_CONFIG["promos_armazones_texto"])
            supabase.table("optica_conversaciones").update({
                "etapa_comercial": "CONSULTA_ARMAZON",
                "updated_at": now_iso
            }).eq("id", conv_id).execute()
            r_send = await wa_client.send_free_text(to_phone=tel_norm, text=promos_txt)
            _record_optica_outbound_msg(conv_id, contacto_id, r_send.get("wamid"), "text", promos_txt, "bot_optica")
            return

        if btn_low == "optica_hablar_optico" or "hablar con optico" in clean_low or "hablar con óptico" in clean_low:
            human_txt = (
                "👩‍⚕️👓 ¡Excelente! Ya derivamos tu conversación a un *óptico especialista de Óptica Vortix*. "
                "En breve te responderá por acá. Si tenés tu receta a mano, podés ir enviando una foto."
            )
            supabase.table("optica_conversaciones").update({
                "bot_paused": True,
                "updated_at": now_iso
            }).eq("id", conv_id).execute()
            r_send = await wa_client.send_free_text(to_phone=tel_norm, text=human_txt)
            _record_optica_outbound_msg(conv_id, contacto_id, r_send.get("wamid"), "text", human_txt, "bot_optica")
            return

        # ====================================================================
        # SMART FLOW 4: RESPUESTA INTELIGENTE FUERA DE HORARIO COMERCIAL
        # ====================================================================
        if cfg.get("auto_reply_fuera_horario", True) and not _esta_en_horario_comercial_optica(cfg):
            now_ts = time.time()
            last_ah = _AFTER_HOURS_REPLY_CACHE.get(tel_norm, 0.0)
            if now_ts - last_ah > 8 * 3600:
                _AFTER_HOURS_REPLY_CACHE[tel_norm] = now_ts
                ah_txt = str(cfg.get("mensaje_fuera_horario") or DEFAULT_OPTICA_CONFIG["mensaje_fuera_horario"])
                r_send = await wa_client.send_free_text(to_phone=tel_norm, text=ah_txt)
                _record_optica_outbound_msg(conv_id, contacto_id, r_send.get("wamid"), "text", ah_txt, "bot_optica")

    except Exception as e:
        logger.error(f"[OpticaInbound] Error procesando mensaje entrante de {tel_norm}: {e}", exc_info=True)
    finally:
        if wa_client:
            await wa_client.close()


def _record_optica_outbound_msg(
    conversacion_id: str,
    contacto_id: Optional[str],
    wamid: Optional[str],
    tipo: str,
    contenido: str,
    enviado_por: str = "sistema",
    template_name: Optional[str] = None,
    media_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Registra un mensaje saliente en `public.optica_mensajes` y actualiza `public.optica_conversaciones`."""
    if not supabase or not conversacion_id:
        return None
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        ins = supabase.table("optica_mensajes").insert({
            "conversacion_id": conversacion_id,
            "contacto_id": contacto_id,
            "wamid": wamid,
            "direccion": "outbound",
            "tipo": tipo,
            "contenido": contenido,
            "template_name": template_name,
            "media_url": media_url,
            "estado": "sent",
            "enviado_por": enviado_por,
            "metadata": metadata or {},
            "created_at": now_iso,
            "updated_at": now_iso
        }).execute()
        if tipo != "nota_interna":
            supabase.table("optica_conversaciones").update({
                "ultimo_mensaje_texto": contenido[:300],
                "ultimo_mensaje_at": now_iso,
                "ultimo_mensaje_direccion": "outbound",
                "updated_at": now_iso
            }).eq("id", conversacion_id).execute()
        return ins.data[0] if ins.data else None
    except Exception as e:
        logger.warning(f"[OpticaOutboundMsg] Error guardando mensaje saliente: {e}")
        return None


def _esta_en_horario_comercial_optica(cfg: Dict[str, Any]) -> bool:
    """Verifica si la hora actual en Mendoza está dentro de la ventana horaria permitida."""
    now_mza = get_mendoza_now()
    # Domingo cerrado por defecto para envíos masivos automáticos
    if now_mza.weekday() == 6:
        return False
    h_ini = str(cfg.get("hora_inicio_envios") or "09:00").strip()
    h_fin = str(cfg.get("hora_fin_envios") or "20:00").strip()
    cur_hm = now_mza.strftime("%H:%M")
    return h_ini <= cur_hm <= h_fin


# ============================================================================
# 8. INTELIGENCIA ARTIFICIAL PARA EL ÓPTICO (OCR DE RECETA + COPILOTO GEMINI)
# ============================================================================

async def extraer_graduacion_desde_imagen_receta(
    media_url_or_base64: str,
    conversacion_id: Optional[str] = None,
    contacto_id: Optional[str] = None,
    rotacion_grados: int = 0
) -> Dict[str, Any]:
    """
    Utiliza Google Gemini Vision (`google.genai`) para analizar la foto de una receta médica oftalmológica
    enviada por el paciente y extraer automáticamente en JSON estructurado:
      - OD (Esfera, Cilindro, Eje)
      - OI (Esfera, Cilindro, Eje)
      - Adición (Cerca)
      - DNP (Distancia Nasopupilar / Interpupilar)
      - Tipo de lente sugerido y observaciones.
    Soporta preprocesamiento de rotación con PIL.Image (`rotacion_grados in (90, 180, 270)`).
    Además actualiza `graduacion_actual_json` en `public.optica_contactos` si se provee `conversacion_id` o `contacto_id`.
    """
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY no está configurada en el servidor.")

    img_bytes: Optional[bytes] = None
    mime_type = "image/jpeg"

    raw_src = (media_url_or_base64 or "").strip()
    if raw_src.startswith("data:"):
        header, b64_data = raw_src.split(",", 1)
        if "image/png" in header:
            mime_type = "image/png"
        elif "image/webp" in header:
            mime_type = "image/webp"
        img_bytes = base64.b64decode(b64_data)
    elif raw_src.startswith("http://") or raw_src.startswith("https://"):
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            res = await client.get(raw_src)
            res.raise_for_status()
            img_bytes = res.content
            ct = res.headers.get("Content-Type", "")
            if ct.startswith("image/"):
                mime_type = ct.split(";")[0].strip()
    elif raw_src.startswith("/static/"):
        # Resolver archivo local o desde Supabase Storage
        from app.services.media_service import STATIC_MEDIA_DIR
        rel = raw_src.replace("/static/media/", "").lstrip("/")
        local_path = os.path.join(STATIC_MEDIA_DIR, *rel.split("/"))
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                img_bytes = f.read()
        else:
            pub_url = f"https://ppbgmkxxpeuiutvuynaw.supabase.co/storage/v1/object/public/whatsapp-media/{rel}"
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                res = await client.get(pub_url)
                res.raise_for_status()
                img_bytes = res.content
    else:
        img_bytes = base64.b64decode(raw_src)

    if not img_bytes:
        raise ValueError("No se pudieron obtener los bytes de la imagen de la receta.")

    # Preprocesamiento de rotación con PIL.Image si rotacion_grados != 0
    if rotacion_grados in (90, 180, 270):
        try:
            from PIL import Image, ImageOps
            with Image.open(io.BytesIO(img_bytes)) as pil_img:
                pil_img = ImageOps.exif_transpose(pil_img) or pil_img
                # Rotación en sentido horario: rotar (360 - rotacion_grados) en PIL
                rotated = pil_img.rotate(360 - rotacion_grados, expand=True)

                buf = io.BytesIO()
                fmt = "PNG" if mime_type == "image/png" else "JPEG"
                if fmt == "JPEG" and rotated.mode in ("RGBA", "P"):
                    rotated = rotated.convert("RGB")
                rotated.save(buf, format=fmt, quality=92)
                img_bytes = buf.getvalue()
                logger.info(f"[OpticaOCR] Imagen rotada exitosamente {rotacion_grados}° antes de enviar a Gemini Vision.")
        except Exception as rot_err:
            logger.warning(f"[OpticaOCR] No se pudo rotar la imagen ({rot_err}), continuando con la imagen original.")

    g_client = genai.Client(api_key=api_key)
    prompt = (
        "Eres un óptico contactólogo experto leyendo una receta médica oftalmológica argentina. "
        "Analiza cuidadosamente la imagen y extrae la graduación refractiva para Ojo Derecho (OD) y Ojo Izquierdo (OI), "
        "tanto de lejos como la adición (ADD / cerca), distancia interpupilar (DNP / DIP) y tratamientos indicados "
        "(Antirreflex, Filtro Azul / Blue Cut, Multifocal, Bifocal, Lentes de Contacto, etc.).\n"
        "Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:\n"
        "{\n"
        '  "od": {"esfera": "+0.00", "cilindro": "-0.00", "eje": "0°"},\n'
        '  "oi": {"esfera": "+0.00", "cilindro": "-0.00", "eje": "0°"},\n'
        '  "adicion": "+0.00",\n'
        '  "dnp": "62/60 mm",\n'
        '  "tipo_lente_sugerido": "Monofocal / Multifocal / Antirreflex / Filtro Azul",\n'
        '  "medico_prescriptor": "Nombre del médico si es legible",\n'
        '  "fecha_receta": "Fecha si es legible",\n'
        '  "observaciones": "Resumen breve de lo escrito en la receta"\n'
        "}"
    )

    candidate_models = [
        os.getenv("GEMINI_COPILOT_MODEL", "gemini-flash-latest"),
        "gemini-2.5-flash",
        "gemini-2.0-flash"
    ]
    parsed_grad: Dict[str, Any] = {}
    last_err = None

    for m_name in candidate_models:
        try:
            res = g_client.models.generate_content(
                model=m_name,
                contents=[
                    types.Part.from_bytes(data=img_bytes, mime_type=mime_type),
                    prompt
                ],
                config=types.GenerateContentConfig(temperature=0.1)
            )
            raw_txt = (res.text or "").strip()
            clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_txt, flags=re.IGNORECASE).strip()
            parsed_grad = json.loads(clean_json)
            break
        except Exception as err:
            last_err = err
            logger.warning(f"[OpticaOCR] Intento con modelo {m_name} falló: {err}")

    if not parsed_grad:
        raise RuntimeError(f"No se pudo interpretar la receta con Gemini Vision: {last_err}")

    parsed_grad = normalizar_estructura_graduacion(parsed_grad)

    # Persistir graduación en optica_contactos si se indicó conversacion_id o contacto_id
    if supabase:
        target_cid = contacto_id
        if not target_cid and conversacion_id:
            c_res = supabase.table("optica_conversaciones").select("contacto_id").eq("id", conversacion_id).limit(1).execute()
            if c_res.data:
                target_cid = c_res.data[0].get("contacto_id")
        if target_cid:
            supabase.table("optica_contactos").update({
                "graduacion_actual_json": parsed_grad,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", target_cid).execute()

    return {
        "success": True,
        "graduacion": parsed_grad
    }


def generar_sugerencia_copiloto_optica(
    conversacion_id: Optional[str] = None,
    accion: str = "sugerir",
    texto_actual: str = ""
) -> Dict[str, Any]:
    """
    Copiloto IA comercial especializado en Óptica Vortix:
      - `accion == 'sugerir'`: redacta una respuesta comercial empática, clara y vendedora según el historial y la receta del paciente.
      - `accion == 'mejorar'`: pule y da formato WhatsApp al borrador escrito por el óptico.
      - `accion == 'resumir'`: resume el caso óptico (graduación, interés en armazón/cristales/LC, presupuesto y estado).
    """
    from app.services.copilot_service import _generar_con_gemini

    if accion == "mejorar" and texto_actual.strip():
        sys_inst = (
            "Eres el Copiloto Comercial de Óptica Vortix (Mendoza). "
            "Reescribe el borrador del asesor óptico para que suene cálido, profesional, claro y persuasivo por WhatsApp. "
            "Destaca con *negritas* los tratamientos ópticos (Antirreflex, Filtro Azul Blue Cut, Multifocales, Lentes de Contacto) "
            "y beneficios o precios sin inventar datos que no estén en el borrador. Devuelve SOLO el mensaje mejorado."
        )
        mejorado = _generar_con_gemini(f"Borrador del óptico:\n{texto_actual}", sys_inst)
        return {"success": True, "accion": "mejorar", "texto": mejorado}

    historial_str = ""
    contexto_str = ""
    if supabase and conversacion_id:
        try:
            conv_r = supabase.table("optica_conversaciones").select("*, optica_contactos(*)").eq("id", conversacion_id).limit(1).execute()
            if conv_r.data:
                c_row = conv_r.data[0]
                contacto = c_row.get("optica_contactos") or {}
                grad = contacto.get("graduacion_actual_json") or {}
                contexto_str = (
                    f"Paciente: {contacto.get('nombre') or c_row.get('nombre_contacto')}\n"
                    f"Obra Social: {contacto.get('obra_social') or 'Particular'}\n"
                    f"Etapa Comercial: {c_row.get('etapa_comercial')}\n"
                    f"Cupón Activo: {contacto.get('codigo_cupon_activo') or 'Sin cupón'}\n"
                    f"Graduación Registrada: {json.dumps(grad, ensure_ascii=False)}\n"
                )
            msgs_r = (
                supabase.table("optica_mensajes")
                .select("direccion, tipo, contenido, enviado_por, created_at")
                .eq("conversacion_id", conversacion_id)
                .order("created_at", desc=True)
                .limit(15)
                .execute()
            )
            lines = []
            for m in reversed(msgs_r.data or []):
                who = "Paciente" if m.get("direccion") == "inbound" else f"Óptica ({m.get('enviado_por')})"
                lines.append(f"{who}: {m.get('contenido') or ''}")
            historial_str = "\n".join(lines)
        except Exception as e:
            logger.debug(f"[CopilotoOptica] Error cargando contexto: {e}")

    if accion == "resumir":
        sys_inst = (
            "Eres un especialista en gestión de Óptica Vortix. Resume esta conversación en 3 puntos breves con viñetas:\n"
            "1. *Necesidad Óptica / Receta*: (Qué lentes busca y graduación si figura)\n"
            "2. *Cotización / Tratamientos Ofrecidos*: (Antirreflex, Filtro Azul, Multifocal, Lentes de Contacto, Armazón)\n"
            "3. *Próximo Paso Comercial*: (Qué falta para cerrar la venta o entregar)"
        )
        resumen = _generar_con_gemini(f"{contexto_str}\n\nHISTORIAL:\n{historial_str}", sys_inst)
        return {"success": True, "accion": "resumir", "texto": resumen}

    sys_inst = (
        "Eres el Copiloto Comercial estrella de *Óptica Vortix* (Mendoza). "
        "Redacta una respuesta sugerida lista para enviar por WhatsApp al paciente. "
        "Sé cálido, asesorá con criterio óptico (mencionando beneficios de Antirreflex, Filtro Azul Blue Cut, "
        "cristales orgánicos livianos o adaptación de lentes de contacto según corresponda), recordale su beneficio/cupón "
        "si aplica e invitalo a avanzar con la cotización o visita. Devuelve ÚNICAMENTE el texto del mensaje."
    )
    sugerencia = _generar_con_gemini(f"{contexto_str}\n\nHISTORIAL RECIENTE:\n{historial_str}", sys_inst)
    return {"success": True, "accion": "sugerir", "texto": sugerencia}


# ============================================================================
# 9. MOTOR 3: COLA DE GOTEO ANTI-BLOQUEO Y SALUD DE LA LÍNEA 3
# ============================================================================

async def obtener_o_subir_placa_media_id(wa_client: WhatsAppCloudClient, media_url: str) -> Optional[str]:
    """
    Descarga una placa promocional desde su URL pública y la sube una sola vez al endpoint `/media`
    de la Línea 3 de Óptica Vortix, cacheando el `media_id` resultante por 20 días.
    """
    if not media_url:
        return None
    now = time.time()
    cache_key = f"{wa_client.phone_number_id}:{media_url}"
    if cache_key in _PLACA_MEDIA_ID_CACHE:
        ts, cached_id = _PLACA_MEDIA_ID_CACHE[cache_key]
        if now - ts < PLACA_MEDIA_CACHE_TTL_SECONDS:
            return cached_id

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            res = await client.get(media_url)
            res.raise_for_status()
            f_bytes = res.content
            ct = res.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
            if not ct.startswith("image/"):
                ct = "image/jpeg"
        fname = os.path.basename(media_url.split("?")[0]) or "placa_vortix.jpg"
        media_id = await wa_client.upload_media_bytes(file_bytes=f_bytes, filename=fname, mime_type=ct)
        if media_id:
            _PLACA_MEDIA_ID_CACHE[cache_key] = (now, media_id)
            return media_id
    except Exception as e:
        logger.warning(f"[OpticaMediaCache] Error subiendo placa {media_url} a Meta: {e}")
    return None


async def procesar_cola_envios_optica(max_batch: int = 10, force_outside_hours: bool = False) -> Dict[str, Any]:
    """
    Motor 3: Procesa los envíos pendientes en `public.optica_envios_programados` respetando:
      1. Horario comercial en Mendoza (`09:00` a `20:00`, Lunes a Sábado).
      2. Límite diario (`max_envios_diarios`).
      3. Circuit Breaker de Calidad de Meta: si `quality_rating == 'RED'`, pausa automáticamente campañas.
      4. Aislamiento Fail-Closed de la Línea 3.
    """
    if not supabase:
        return {"success": False, "reason": "supabase_unavailable"}

    cfg = get_optica_vortix_full_config()
    if not force_outside_hours and not _esta_en_horario_comercial_optica(cfg):
        return {"success": True, "processed": 0, "reason": "fuera_de_horario_comercial"}

    opt_phone_id, opt_token = get_whatsapp_optica_credentials()
    if not opt_phone_id or not opt_token:
        return {"success": False, "processed": 0, "reason": "linea_3_optica_no_configurada"}

    # Verificar tope diario de envíos
    hoy_mza = get_mendoza_now().strftime("%Y-%m-%d")
    max_diarios = int(cfg.get("max_envios_diarios", 200))
    enviados_hoy_res = (
        supabase.table("optica_envios_programados")
        .select("id", count="exact")
        .eq("estado", "enviado")
        .gte("enviado_at", f"{hoy_mza}T00:00:00")
        .execute()
    )
    enviados_hoy = enviados_hoy_res.count or 0
    if enviados_hoy >= max_diarios:
        return {"success": True, "processed": 0, "reason": f"tope_diario_alcanzado ({enviados_hoy}/{max_diarios})"}

    wa_client = WhatsAppCloudClient(phone_number_id=opt_phone_id, access_token=opt_token, line="optica")
    try:
        # Verificar salud de la Línea 3 en Meta (Circuit Breaker por calidad RED)
        health = await wa_client.get_phone_number_details()
        quality = str(health.get("quality_rating") or "GREEN").upper()
        if quality == "RED":
            logger.error("[OpticaCircuitBreaker] Calidad de Línea 3 en RED. Pausando campañas activas.")
            supabase.table("optica_campanas").update({
                "estado": "pausada",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("estado", "en_curso").execute()
            return {"success": False, "processed": 0, "reason": "circuit_breaker_quality_red"}

        now_iso = datetime.now(timezone.utc).isoformat()
        pend_res = (
            supabase.table("optica_envios_programados")
            .select("*")
            .eq("estado", "pendiente")
            .lte("programado_para", now_iso)
            .order("prioridad", desc=False)
            .order("programado_para", desc=False)
            .limit(min(max_batch, max_diarios - enviados_hoy))
            .execute()
        )
        items = pend_res.data or []
        if not items:
            return {"success": True, "processed": 0, "reason": "cola_vacia"}

        enviados_ok = 0
        fallidos = 0

        for idx, item in enumerate(items):
            env_id = item["id"]
            to_phone = str(item.get("telefono") or "").strip()
            tpl_name = str(item.get("template_name") or "").strip()
            tpl_lang = str(item.get("template_language") or "es_AR").strip()
            params = item.get("parameters") or []
            header_url = item.get("header_media_url")
            header_media_id = item.get("header_media_id")
            intentos = int(item.get("intentos") or 0) + 1

            # Verificar que el contacto no haya hecho opt-out antes de despachar
            if item.get("contacto_id"):
                c_chk = supabase.table("optica_contactos").select("opt_out, nombre").eq("id", item["contacto_id"]).limit(1).execute()
                if c_chk.data and c_chk.data[0].get("opt_out"):
                    supabase.table("optica_envios_programados").update({
                        "estado": "cancelado",
                        "error_detalle": "Contacto con Opt-Out activo",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", env_id).execute()
                    continue

            try:
                now_claiming = datetime.now(timezone.utc).isoformat()
                claim_res = (
                    supabase.table("optica_envios_programados")
                    .update({
                        "estado": "enviando",
                        "intentos": intentos,
                        "updated_at": now_claiming
                    })
                    .eq("id", env_id)
                    .eq("estado", "pendiente")
                    .execute()
                )

                if not claim_res.data or len(claim_res.data) == 0:
                    logger.info(f"[Motor3 Concurrencia] Envío id={env_id} ya fue reclamado por otro worker concurrente. Omitiendo duplicado.")
                    continue

                # Comprobar si la plantilla en BD tiene HEADER de tipo IMAGE
                tpl_header_type = "NONE"
                tpl_body_text = f"[Plantilla Óptica: {tpl_name}]"
                try:
                    t_db = supabase.table("whatsapp_templates").select("header_type, body_text, language").eq("name", tpl_name).limit(1).execute()
                    if t_db.data:
                        tpl_header_type = str(t_db.data[0].get("header_type") or "NONE").upper()
                        tpl_body_text = str(t_db.data[0].get("body_text") or tpl_body_text)
                        tpl_lang = str(t_db.data[0].get("language") or tpl_lang)
                except Exception:
                    pass

                components: List[Dict[str, Any]] = []
                if tpl_header_type == "IMAGE" and (header_media_id or header_url):
                    eff_media_id = header_media_id or await obtener_o_subir_placa_media_id(wa_client, header_url)
                    if eff_media_id:
                        components.append({
                            "type": "header",
                            "parameters": [{"type": "image", "image": {"id": eff_media_id}}]
                        })
                    elif header_url:
                        components.append({
                            "type": "header",
                            "parameters": [{"type": "image", "image": {"link": header_url}}]
                        })

                if params:
                    components.append({
                        "type": "body",
                        "parameters": params
                    })

                send_res = await wa_client.send_template(
                    to_phone=to_phone,
                    template_name=tpl_name,
                    language_code=tpl_lang,
                    components=components
                )
                wamid = send_res.get("wamid")
                sent_iso = datetime.now(timezone.utc).isoformat()

                supabase.table("optica_envios_programados").update({
                    "estado": "enviado",
                    "wamid": wamid,
                    "enviado_at": sent_iso,
                    "updated_at": sent_iso
                }).eq("id", env_id).execute()

                # Si pertenecía a una oportunidad de Geclisa, actualizar su estado a 'mensaje_enviado'
                if item.get("oportunidad_id"):
                    supabase.table("optica_oportunidades_geclisa").update({
                        "estado_comercial": "mensaje_enviado",
                        "updated_at": sent_iso
                    }).eq("id", item["oportunidad_id"]).execute()

                # Si pertenecía a una campaña, incrementar enviados_count
                if item.get("campana_id"):
                    c_r = supabase.table("optica_campanas").select("enviados_count, total_destinatarios").eq("id", item["campana_id"]).limit(1).execute()
                    if c_r.data:
                        new_env = int(c_r.data[0].get("enviados_count") or 0) + 1
                        tot_d = int(c_r.data[0].get("total_destinatarios") or 0)
                        c_upd: Dict[str, Any] = {"enviados_count": new_env, "updated_at": sent_iso}
                        if tot_d > 0 and new_env >= tot_d:
                            c_upd["estado"] = "completada"
                        supabase.table("optica_campanas").update(c_upd).eq("id", item["campana_id"]).execute()

                # Renderizar texto de plantilla con sus parámetros para mostrarlo en la conversación de Óptica
                rendered_text = tpl_body_text
                for p_idx, p_obj in enumerate(params, start=1):
                    rendered_text = rendered_text.replace(f"{{{{{p_idx}}}}}", str(p_obj.get("text") or ""))

                # Asegurar conversación en optica_conversaciones y guardar mensaje saliente
                conv_q = supabase.table("optica_conversaciones").select("id, metadata_json").eq("telefono", to_phone).limit(1).execute()
                if conv_q.data:
                    conv_id = conv_q.data[0]["id"]
                    c_meta = conv_q.data[0].get("metadata_json") or {}
                else:
                    ins_c = supabase.table("optica_conversaciones").insert({
                        "contacto_id": item.get("contacto_id"),
                        "telefono": to_phone,
                        "nombre_contacto": params[0].get("text") if params else f"Contacto {to_phone[-4:]}",
                        "estado": "abierta",
                        "etapa_comercial": "NUEVA_CONSULTA",
                        "origen_oportunidad": item.get("origen"),
                        "ultimo_mensaje_texto": rendered_text[:300],
                        "ultimo_mensaje_at": sent_iso,
                        "ultimo_mensaje_direccion": "outbound",
                        "created_at": sent_iso,
                        "updated_at": sent_iso
                    }).execute()
                    conv_id = ins_c.data[0]["id"] if ins_c.data else None
                    c_meta = {}

                if conv_id:
                    # Si hay placa URL y la plantilla no tenía header IMAGE (estrategia doble paso), dejar pendiente la entrega de placa
                    if header_url and tpl_header_type != "IMAGE":
                        c_meta["pending_placa_delivery"] = {"placa_url": header_url, "queued_at": sent_iso}
                        supabase.table("optica_conversaciones").update({"metadata_json": c_meta}).eq("id", conv_id).execute()

                    _record_optica_outbound_msg(
                        conversacion_id=conv_id,
                        contacto_id=item.get("contacto_id"),
                        wamid=wamid,
                        tipo="template",
                        contenido=rendered_text,
                        enviado_por=item.get("origen") or "automatismo_optica",
                        template_name=tpl_name,
                        media_url=header_url
                    )

                enviados_ok += 1

                # Jitter corto entre mensajes si hay más en el lote actual
                if idx < len(items) - 1:
                    await asyncio.sleep(random.uniform(1.5, 3.5))

            except Exception as send_err:
                fallidos += 1
                max_int = int(item.get("max_intentos") or 3)
                nuevo_estado = "fallido" if intentos >= max_int else "pendiente"
                next_try = (datetime.now(timezone.utc) + timedelta(minutes=10 * intentos)).isoformat()
                supabase.table("optica_envios_programados").update({
                    "estado": nuevo_estado,
                    "programado_para": next_try,
                    "error_detalle": str(send_err)[:400],
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", env_id).execute()
                logger.warning(f"[Motor3] Fallo enviando cola id={env_id} a {to_phone}: {send_err}")

        return {
            "success": True,
            "processed": len(items),
            "enviados_ok": enviados_ok,
            "fallidos": fallidos
        }
    finally:
        await wa_client.close()


# ============================================================================
# 10. CATÁLOGO Y APROVISIONAMIENTO DE PLANTILLAS BASE DE ÓPTICA VORTIX
# ============================================================================

OPTICA_VORTIX_TEMPLATES_CATALOG: List[Dict[str, Any]] = [
    {
        "name": "vortix_beneficio_turno_v1",
        "titulo_amigable": "Óptica Vortix • Voucher Descuento por Turno",
        "category": "MARKETING",
        "header_type": "TEXT",
        "header_content": "Beneficio Exclusivo en Optica Vortix",
        "body_text": (
            "Hola {{1}}, vimos que tenes un turno programado en la clinica para el {{2}}. "
            "Por ser paciente, tenes activado un beneficio exclusivo de {{3}} en *Optica Vortix* "
            "(cristales, antirreflex, filtro azul y armazones seleccionados) presentando tu codigo {{4}} luego de tu consulta."
        ),
        "footer_text": "Optica Vortix • Responde BAJA para no recibir promos",
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Quiero mi descuento"},
            {"type": "QUICK_REPLY", "text": "Dejar de recibir promos"}
        ],
        "variable_mappings": {
            "1": "paciente_nombre",
            "2": "turno_fecha_hora",
            "3": "porcentaje_descuento",
            "4": "codigo_beneficio"
        },
        "sample_values": ["Mariana", "15/11/2026 a las 10:30 hs", "20% OFF", "#VORTIX-8A4F"]
    },
    {
        "name": "vortix_receta_lentes_aereos_v1",
        "titulo_amigable": "Óptica Vortix • Cotización Receta Lentes Aéreos",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Tu Receta de Lentes en Optica Vortix",
        "body_text": (
            "Hola {{1}}, esperamos que haya salido muy bien tu consulta de hoy con {{2}}. "
            "En *Optica Vortix* ya podemos cotizar tu nueva receta de anteojos por WhatsApp con tu descuento de paciente ({{3}} - Codigo {{4}}) "
            "en cristales Monofocales, Multifocales, Antirreflex y Filtro Azul."
        ),
        "footer_text": "Optica Vortix • Especialistas en Salud Visual",
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Cotizar mi receta"},
            {"type": "QUICK_REPLY", "text": "Ver promos armazones"}
        ],
        "variable_mappings": {
            "1": "paciente_nombre",
            "2": "prestador_nombre",
            "3": "porcentaje_descuento",
            "4": "codigo_beneficio"
        },
        "sample_values": ["Carlos", "Dr. Bonanno", "20% OFF", "#VORTIX-9B2C"]
    },
    {
        "name": "vortix_receta_lentes_contacto_v1",
        "titulo_amigable": "Óptica Vortix • Lentes de Contacto y Adaptación",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Contactologia en Optica Vortix",
        "body_text": (
            "Hola {{1}}, vimos que en tu consulta con {{2}} se evaluaron Lentes de Contacto. "
            "En *Optica Vortix* contamos con stock de lentes blandos esfericos, toricos y multifocales con beneficio exclusivo (Codigo {{3}}). "
            "¿Queres que te informemos disponibilidad y valores para tu graduacion?"
        ),
        "footer_text": "Optica Vortix • Contactologia Especializada",
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Consultar lentes contacto"},
            {"type": "QUICK_REPLY", "text": "Hablar con optico"}
        ],
        "variable_mappings": {
            "1": "paciente_nombre",
            "2": "prestador_nombre",
            "3": "codigo_beneficio"
        },
        "sample_values": ["Lucía", "Dra. Abraham", "#VORTIX-3D7E"]
    },
    {
        "name": "vortix_lentes_listos_retiro_v1",
        "titulo_amigable": "Óptica Vortix • Aviso de Lentes Listos para Retirar",
        "category": "UTILITY",
        "header_type": "TEXT",
        "header_content": "Tus Lentes estan Listos en Optica Vortix",
        "body_text": (
            "¡Hola {{1}}! Te escribimos desde *Optica Vortix* para avisarte que tu pedido ({{2}}) "
            "ya salio del laboratorio, paso el control de calidad optico y esta *listo para retirar* en el horario de {{3}}. "
            "¡Te esperamos en nuestro local para coordinar la entrega!"
        ),
        "footer_text": "Optica Vortix • Te esperamos",
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Paso hoy a retirar"},
            {"type": "QUICK_REPLY", "text": "Consultar horario"}
        ],
        "variable_mappings": {
            "1": "paciente_nombre",
            "2": "detalle_trabajo",
            "3": "horario_atencion"
        },
        "sample_values": ["Martín", "Anteojos Multifocales con Antirreflex", "Lunes a Viernes de 9 a 20 hs"]
    }
]


async def aprovisionar_plantillas_base_optica() -> Dict[str, Any]:
    """
    Registra las 4 plantillas base de Óptica Vortix en la WABA de Meta (`3731563350343089`)
    y las guarda en `public.whatsapp_templates` con `grupo_crm = 'Óptica Vortix'`,
    `visible_en_chat = False` y `visible_en_hce = False` para mantener limpias la HCE y el chat quirúrgico.
    """
    waba_id = get_whatsapp_waba_id() or os.getenv("META_WA_WABA_ID") or "3731563350343089"
    _, token = get_whatsapp_cloud_credentials()

    resultados: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for spec in OPTICA_VORTIX_TEMPLATES_CATALOG:
        tpl_name = spec["name"]
        meta_id = None
        meta_status = "PENDING"
        action = "registrada_local"

        if waba_id and token:
            try:
                components: List[Dict[str, Any]] = []
                if spec.get("header_type") == "TEXT" and spec.get("header_content"):
                    components.append({
                        "type": "HEADER",
                        "format": "TEXT",
                        "text": spec["header_content"][:60]
                    })
                components.append({
                    "type": "BODY",
                    "text": spec["body_text"],
                    "example": {"body_text": [spec["sample_values"]]}
                })
                if spec.get("footer_text"):
                    components.append({"type": "FOOTER", "text": spec["footer_text"][:60]})
                if spec.get("buttons"):
                    components.append({
                        "type": "BUTTONS",
                        "buttons": [{"type": b["type"], "text": b["text"][:25]} for b in spec["buttons"]]
                    })

                url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates"
                async with httpx.AsyncClient(timeout=20.0) as client:
                    res = await client.post(
                        url,
                        json={
                            "name": tpl_name,
                            "category": spec["category"],
                            "language": "es_AR",
                            "components": components
                        },
                        headers={"Authorization": f"Bearer {token}"}
                    )
                if res.status_code in (200, 201):
                    body = res.json()
                    meta_id = body.get("id")
                    meta_status = body.get("status", "PENDING")
                    action = "creada_en_meta"
                else:
                    err_txt = res.text.lower()
                    if "already exists" in err_txt:
                        meta_status = "APPROVED"
                        action = "ya_existia_en_meta"
                    else:
                        action = f"aviso_meta ({res.status_code})"
            except Exception as e:
                logger.warning(f"[OpticaTemplates] Aviso creando {tpl_name} en Meta: {e}")

        if supabase:
            try:
                db_rec = {
                    "waba_id": waba_id,
                    "meta_template_id": meta_id,
                    "name": tpl_name,
                    "category": spec["category"],
                    "language": "es_AR",
                    "status": meta_status,
                    "header_type": spec["header_type"],
                    "header_content": spec.get("header_content"),
                    "body_text": spec["body_text"],
                    "footer_text": spec.get("footer_text"),
                    "buttons": spec.get("buttons") or [],
                    "variable_mappings": spec.get("variable_mappings") or {},
                    "activo": True,
                    "visible_en_chat": False,
                    "visible_en_hce": False,
                    "grupo_crm": "Óptica Vortix",
                    "titulo_amigable": spec.get("titulo_amigable") or tpl_name,
                    "updated_at": now_iso
                }
                supabase.table("whatsapp_templates").upsert(db_rec, on_conflict="name").execute()
            except Exception as db_e:
                logger.warning(f"[OpticaTemplates] Error guardando {tpl_name} en Supabase: {db_e}")

        resultados.append({
            "name": tpl_name,
            "titulo_amigable": spec.get("titulo_amigable"),
            "status": meta_status,
            "meta_id": meta_id,
            "action": action
        })

    return {
        "success": True,
        "waba_id": waba_id,
        "total": len(resultados),
        "plantillas": resultados
    }


# ============================================================================
# 11. CRON BACKGROUND PERIÓDICO DE ÓPTICA VORTIX
# ============================================================================

_LAST_DAILY_TURNOS_RUN_DATE: Optional[str] = None
_LAST_HOURLY_RECETAS_RUN_TS: float = 0.0


async def cron_automatismos_optica_vortix():
    """
    Tarea asíncrona de fondo que ejecuta:
      1. Cada 45 segundos: `procesar_cola_envios_optica()` (despacho con goteo anti-bloqueo).
      2. Una vez al día en `hora_disparo_turnos` (si `auto_turnos_proximos_enabled=True`):
         `sincronizar_turnos_proximos_optica(dry_run=False)`.
      3. Cada 30 minutos en horario comercial (si `auto_recetas_lentes_enabled=True`):
         `detectar_indicaciones_lentes_del_dia()`.
    """
    global _LAST_DAILY_TURNOS_RUN_DATE, _LAST_HOURLY_RECETAS_RUN_TS
    await asyncio.sleep(25)
    logger.info("👓 [Óptica Vortix Cron] Motor de cola anti-bloqueo y detección Geclisa iniciado.")

    while True:
        try:
            cfg = get_optica_vortix_full_config()
            now_mza = get_mendoza_now()
            hoy_str = now_mza.strftime("%Y-%m-%d")
            cur_hm = now_mza.strftime("%H:%M")

            # 1. Procesar cola de envíos programados
            await procesar_cola_envios_optica(max_batch=5)

            # 2. Barrido diario de turnos próximos (si está activo)
            if cfg.get("auto_turnos_proximos_enabled", False):
                hora_disp = str(cfg.get("hora_disparo_turnos") or "10:00").strip()
                if _LAST_DAILY_TURNOS_RUN_DATE != hoy_str and cur_hm >= hora_disp and cur_hm <= "19:30":
                    _LAST_DAILY_TURNOS_RUN_DATE = hoy_str
                    logger.info("[Óptica Vortix Cron] Ejecutando barrido diario de turnos próximos en Geclisa...")
                    await asyncio.to_thread(sincronizar_turnos_proximos_optica, None, False, True)

            # 3. Detección periódica de indicaciones de lentes del día (si está activo)
            if cfg.get("auto_recetas_lentes_enabled", False) and _esta_en_horario_comercial_optica(cfg):
                if time.time() - _LAST_HOURLY_RECETAS_RUN_TS >= 1800:
                    _LAST_HOURLY_RECETAS_RUN_TS = time.time()
                    logger.info("[Óptica Vortix Cron] Escaneando indicaciones de lentes del día en Geclisa...")
                    await asyncio.to_thread(detectar_indicaciones_lentes_del_dia, hoy_str, None)

        except Exception as e:
            logger.error(f"[Óptica Vortix Cron] Error en ciclo periódico: {e}")

        await asyncio.sleep(45)
