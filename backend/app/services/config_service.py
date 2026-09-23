import os
import json
import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

CONFIG_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "app_settings.json")

DEFAULT_SETTINGS: Dict[str, Any] = {
    "bot": {
        "enabled": True,
        "model_name": "gemini-3.6-flash",
        "typing_delay_seconds": 3,
        "human_escalation_keywords": [
            "humano", "operador", "persona", "asesor", "asesora", "asesora quirurgica",
            "secretaria", "urgencia", "emergencia", "reclamo", "hablar con alguien", 
            "doctor directo", "atencion personalizada"
        ],
        "system_instructions_override": "",
        "handover": {
            "auto_escalamiento_activo": True,
            "max_reintentos_incomprension": 2,
            "mensaje_reintento": "Disculpá, no logré comprender bien tu consulta. ¿Podrías indicarme si necesitás agendar un turno, solicitar un presupuesto o hablar con una asesora quirúrgica?",
            "mensaje_derivacion": "Entendido. He derivado tu consulta de manera prioritaria a nuestro equipo de atención humana. Un asesor continuará contigo a la brevedad. ¡Muchas gracias por tu paciencia!",
            "mensaje_post_dni": "¡Hola *{nombre}*! Hemos localizado tu ficha en el sistema (Cobertura: *{cobertura}*).\n\n¿Deseas consultar sobre tu presupuesto, coordinar un turno o hablar con una asesora quirúrgica?",
            "palabras_clave_escape": [
                "humano", "operador", "persona", "asesor", "asesora", 
                "asesora quirurgica", "secretaria", "doctor directo", 
                "hablar con alguien", "urgencia", "reclamo"
            ],
            "auto_reactivacion_inactividad": True,
            "tiempo_inactividad_horas": 24
        }
    },
    "clinica": {
        "nombre": "Centro Médico Nube",
        "direccion": "Av. Corrientes 1234, CABA, Argentina",
        "telefono_guardia": "+54 9 11 5555-0199",
        "email_contacto": "contacto@centromediconube.com",
        "horarios_atencion": "Lunes a Viernes de 08:00 a 20:00 hs. Sábados de 09:00 a 13:00 hs.",
        "mensaje_bienvenida": "¡Hola! Gracias por comunicarte con Centro Médico Nube. ¿En qué podemos ayudarte hoy?",
        "logo_url": ""
    },
    "plantilla_presupuesto": {
        "titulo_documento": "PRESUPUESTO MÉDICO",
        "nombre_institucion": "CLÍNICA MÉDICA NUBE",
        "subtitulo_institucion": "Atención Médica Digital & Especialidades",
        "direccion": "Av. Corrientes 1234, CABA, Argentina",
        "telefono": "+54 9 11 5555-0199",
        "email": "contacto@centromediconube.com",
        "sitio_web": "www.centromediconube.com",
        "color_primario": "#1E3A8A",
        "color_secundario": "#2563EB",
        "validez_dias": 30,
        "terminos_condiciones": [
            "Este presupuesto tiene una validez de 30 días corridos a partir de la fecha de emisión.",
            "Los precios cotizados respetan la moneda especificada (Pesos ARS o Dólares USD).",
            "La confirmación de turnos quirúrgicos, prácticas y estudios de alta complejidad queda supeditada a disponibilidad de agenda y confirmación de pago.",
            "Formas de pago habilitadas: Transferencia bancaria, Tarjetas de crédito/débito y Efectivo en administración."
        ],
        "pie_pagina": "Documento emitido electrónicamente por el sistema CRM Médico Nube.",
        "mostrar_firma": True,
        "texto_firma": "Firma y Sello Profesional / Autorización Médica",
        "logo_url": "",
        "mostrar_logo": True
    }
}

# In-memory cache
_cached_settings: Optional[Dict[str, Any]] = None
_cache_timestamp: float = 0.0
CACHE_TTL_SECONDS: float = 30.0


def _get_supabase_client():
    try:
        from app.db import supabase
        return supabase
    except Exception as e:
        logger.debug(f"No se pudo obtener cliente Supabase en config_service: {e}")
        return None


def apply_inheritance(settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Garantiza consistencia entre Perfil de la Clínica y Diseñador de Presupuestos.
    Si la plantilla tiene valores por defecto o vacíos pero el perfil institucional
    de la clínica fue personalizado, hereda los valores automáticamente.
    """
    clinica = settings.get("clinica") or {}
    plantilla = settings.get("plantilla_presupuesto") or {}

    nombre_c = (clinica.get("nombre") or "").strip()
    nombre_p = (plantilla.get("nombre_institucion") or "").strip()
    if nombre_c and (not nombre_p or nombre_p == "CLÍNICA MÉDICA NUBE"):
        plantilla["nombre_institucion"] = nombre_c

    dir_c = (clinica.get("direccion") or "").strip()
    dir_p = (plantilla.get("direccion") or "").strip()
    if dir_c and (not dir_p or dir_p == "Av. Corrientes 1234, CABA, Argentina"):
        plantilla["direccion"] = dir_c

    tel_c = (clinica.get("telefono_guardia") or "").strip()
    tel_p = (plantilla.get("telefono") or "").strip()
    if tel_c and (not tel_p or tel_p == "+54 9 11 5555-0199"):
        plantilla["telefono"] = tel_c

    email_c = (clinica.get("email_contacto") or "").strip()
    email_p = (plantilla.get("email") or "").strip()
    if email_c and (not email_p or email_p == "contacto@centromediconube.com"):
        plantilla["email"] = email_c

    # Herencia bidireccional de Logo Institucional
    logo_c = (clinica.get("logo_url") or "").strip()
    logo_p = (plantilla.get("logo_url") or "").strip()
    if logo_c and not logo_p:
        plantilla["logo_url"] = logo_c
    elif logo_p and not logo_c:
        clinica["logo_url"] = logo_p

    settings["clinica"] = clinica
    settings["plantilla_presupuesto"] = plantilla
    return settings


def obtener_o_cachear_logo_local(logo_url: Optional[str] = None) -> Optional[str]:
    """
    Descarga o valida la existencia de la imagen de logo en caché local
    para inserción inmediata en ReportLab sin peticiones de red repetitivas.
    """
    try:
        from app.services.pdf_service import PDF_DIR
    except Exception:
        PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

    branding_dir = os.path.join(PDF_DIR, "branding")
    os.makedirs(branding_dir, exist_ok=True)
    local_cache_path = os.path.join(branding_dir, "logo_institucional.png")

    target_url = logo_url
    if not target_url:
        s = load_settings()
        target_url = s.get("plantilla_presupuesto", {}).get("logo_url") or s.get("clinica", {}).get("logo_url")

    if not target_url:
        if os.path.exists(local_cache_path) and os.path.getsize(local_cache_path) > 100:
            return local_cache_path
        return None

    # Si es URL remota (http/https de Supabase Storage o CDN)
    if target_url.startswith("http://") or target_url.startswith("https://"):
        try:
            import httpx
            with httpx.Client(timeout=8.0, follow_redirects=True) as client:
                resp = client.get(target_url)
                if resp.status_code == 200 and len(resp.content) > 100:
                    with open(local_cache_path, "wb") as f:
                        f.write(resp.content)
                    return local_cache_path
        except Exception as e:
            logger.warning(f"No se pudo descargar logo desde {target_url}: {e}")

    # Si es ruta estática local relativa (ej: /static/branding/...)
    if target_url.startswith("/static/"):
        static_rel = target_url.replace("/static/", "")
        candidate_path = os.path.join(PDF_DIR, static_rel)
        if os.path.exists(candidate_path) and os.path.getsize(candidate_path) > 100:
            return candidate_path

    if os.path.exists(target_url) and os.path.getsize(target_url) > 100:
        return target_url

    if os.path.exists(local_cache_path) and os.path.getsize(local_cache_path) > 100:
        return local_cache_path

    return None


def _deep_merge(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    for k, v in update.items():
        if isinstance(v, dict) and k in base and isinstance(base[k], dict):
            base[k] = _deep_merge(base[k], v)
        else:
            base[k] = v
    return base


def load_settings(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Carga las configuraciones del sistema con persistencia prioritaria en Supabase
    y fallback transparente a archivo local y defaults.
    """
    global _cached_settings, _cache_timestamp

    now = time.time()
    if not force_refresh and _cached_settings is not None and (now - _cache_timestamp) < CACHE_TTL_SECONDS:
        return apply_inheritance(json.loads(json.dumps(_cached_settings)))

    saved_data: Optional[Dict[str, Any]] = None

    # 1. Intentar cargar desde Supabase (PostgreSQL - Máxima Prioridad)
    supabase = _get_supabase_client()
    if supabase:
        try:
            resp = supabase.table("configuracion_sistema").select("valor").eq("clave", "ajustes_crm").limit(1).execute()
            if resp.data and len(resp.data) > 0 and resp.data[0].get("valor"):
                saved_data = resp.data[0]["valor"]
                logger.debug("Configuraciones del CRM cargadas exitosamente desde Supabase.")
        except Exception as e:
            logger.warning(f"No se pudo consultar configuracion_sistema en Supabase (usando fallback): {e}")

    # 2. Fallback a archivo local si Supabase no tiene el registro o no respondió
    if not saved_data and os.path.exists(CONFIG_FILE_PATH):
        try:
            with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                saved_data = json.load(f)
                logger.debug(f"Configuraciones cargadas desde archivo local {CONFIG_FILE_PATH}")
        except Exception as e:
            logger.error(f"Error al leer archivo local {CONFIG_FILE_PATH}: {e}")

    # 3. Fusionar recursivamente con DEFAULT_SETTINGS para campos faltantes
    merged = json.loads(json.dumps(DEFAULT_SETTINGS))
    if saved_data and isinstance(saved_data, dict):
        merged = _deep_merge(merged, saved_data)

    # 4. Aplicar herencia inteligente de datos
    merged = apply_inheritance(merged)

    # 5. Guardar en memoria caché
    _cached_settings = json.loads(json.dumps(merged))
    _cache_timestamp = now

    return merged


def save_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guarda las configuraciones atómicamente en Supabase (PostgreSQL) y
    respalda en archivo JSON local, actualizando la memoria caché.
    """
    global _cached_settings, _cache_timestamp

    try:
        # Cargar configuración actual sin caché
        current = load_settings(force_refresh=True)

        current = _deep_merge(current, new_settings)

        current = apply_inheritance(current)

        # 1. Persistir en Supabase (PostgreSQL)
        supabase = _get_supabase_client()
        if supabase:
            try:
                payload_db = {
                    "clave": "ajustes_crm",
                    "valor": current,
                    "updated_at": "now()",
                    "actualizado_por": "sistema_crm"
                }
                supabase.table("configuracion_sistema").upsert(payload_db).execute()
                logger.info("Configuraciones del CRM guardadas exitosamente en Supabase (configuracion_sistema).")
            except Exception as e_db:
                logger.error(f"Error guardando configuracion_sistema en Supabase: {e_db}")

        # 2. Respaldo en archivo local
        try:
            with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(current, f, indent=2, ensure_ascii=False)
            logger.info(f"Configuraciones respaldadas en archivo local {CONFIG_FILE_PATH}")
        except Exception as e_file:
            logger.warning(f"No se pudo escribir archivo local {CONFIG_FILE_PATH}: {e_file}")

        # 3. Actualizar caché
        _cached_settings = json.loads(json.dumps(current))
        _cache_timestamp = time.time()

        return current
    except Exception as e:
        logger.error(f"Error general al guardar configuraciones: {e}")
        raise e
