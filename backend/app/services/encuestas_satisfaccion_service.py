"""
Servicio de dominio, cron programado, handlers de webhook y router FastAPI
para el módulo de Encuestas de Satisfacción Automatizadas (WhatsApp Línea 2 + SurveyMonkey).
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import secrets
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from app.auth import require_module_permission
from app.db import supabase
from app.services.geclisa_client import GeclisaClient
from app.services.logger_service import log_event
from app.services.whatsapp_cloud.client import (
    CircuitBreakerOpenException,
    InvalidParameterError,
    MetaAPIError,
    RateLimitExceededError,
    TemplateHydratedTextTooLongError,
    WhatsAppCloudClient,
    get_whatsapp_estudios_credentials,
)
from app.services.whatsapp_cloud.normalizer import normalizar_telefono_argentina_movil

logger = logging.getLogger("encuestas_satisfaccion")

ART_TZ = ZoneInfo("America/Argentina/Buenos_Aires")
CONFIG_KEY = "encuestas_config"

DEFAULT_ENCUESTAS_CONFIG: Dict[str, Any] = {
    "activo": False,
    "pausado_por_calidad": False,
    "motivo_pausa": None,
    "template_name": "encuesta_satisfaccion_consulta_v1",
    "template_language": "es_AR",
    "hora_envio_art": "10:30",
    "hora_fin_envio_art": "20:00",
    "ttl_dias_enlace": 14,
    "surveymonkey_url": "",
    "jitter_min_seg": 1.5,
    "jitter_max_seg": 4.0,
    "batch_size": 25,
    "max_envios_dia": 400,
    "reserva_diaria_estudios": 100,
}

TIER_DAILY_LIMITS: Dict[str, int] = {
    "TIER_250": 250,
    "TIER_1K": 1000,
    "TIER_10K": 10000,
    "TIER_100K": 100000,
    "TIER_UNLIMITED": 1000000,
}

PERMANENT_META_ERROR_CODES = {131049, 131026, 131030, 100, 132005}
RATE_ANOMALY_ERROR_CODES = {131049, 131048}
WA_STATUS_ORDER = {"sent": 1, "delivered": 2, "read": 3}
OPT_OUT_TEXT_COMMANDS = {"stop", "baja", "no encuestas", "no recibir encuestas"}

PUBLIC_SECURITY_HEADERS = {
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store, private",
}

encuestas_satisfaccion_router = APIRouter(tags=["Encuestas de Satisfacción"])


# ============================================================================
# Modelos Pydantic
# ============================================================================

class EncuestasConfigPayload(BaseModel):
    activo: bool = False
    pausado_por_calidad: bool = False
    motivo_pausa: Optional[str] = None
    template_name: str = Field(min_length=1, max_length=128)
    template_language: str = Field(min_length=2, max_length=20)
    hora_envio_art: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    hora_fin_envio_art: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    ttl_dias_enlace: int = Field(ge=1, le=90)
    surveymonkey_url: str = ""
    jitter_min_seg: float = Field(ge=0.0, le=30.0)
    jitter_max_seg: float = Field(ge=0.0, le=60.0)
    batch_size: int = Field(ge=1, le=200)
    max_envios_dia: int = Field(ge=1, le=50000)
    reserva_diaria_estudios: int = Field(ge=0, le=10000)

    @model_validator(mode="after")
    def validate_ranges(self) -> "EncuestasConfigPayload":
        if self.jitter_min_seg > self.jitter_max_seg:
            raise ValueError("jitter_min_seg debe ser menor o igual a jitter_max_seg.")
        if self.hora_envio_art >= self.hora_fin_envio_art:
            raise ValueError("hora_envio_art debe ser menor que hora_fin_envio_art.")
        url_clean = (self.surveymonkey_url or "").strip()
        if url_clean and not url_clean.startswith(("http://", "https://")):
            raise ValueError("surveymonkey_url debe comenzar con http:// o https://.")
        self.surveymonkey_url = url_clean
        return self


class MapeoGeclisaCreatePayload(BaseModel):
    tipo_entidad: str = Field(pattern=r"^(servicio|prestador|sede)$")
    geclisa_id: str = Field(min_length=1, max_length=120)
    geclisa_nombre_raw: str = Field(min_length=1, max_length=255)
    unidad_negocio: str = Field(default="excluido", pattern=r"^(consultas|estudios|excluido)$")
    nombre_canonico: str = Field(min_length=1, max_length=255)
    incluir_en_envio: bool = False


class MapeoGeclisaUpdatePayload(BaseModel):
    unidad_negocio: Optional[str] = Field(default=None, pattern=r"^(consultas|estudios|excluido)$")
    nombre_canonico: Optional[str] = Field(default=None, min_length=1, max_length=255)
    incluir_en_envio: Optional[bool] = None


class OptOutCreatePayload(BaseModel):
    telefono: str = Field(min_length=6, max_length=40)


class EjecutarLotePayload(BaseModel):
    fecha: Optional[date] = None
    dry_run: bool = True
    despachar_ahora: bool = False


class ClickTurnoPayload(BaseModel):
    turno_id: int


# ============================================================================
# Utilidades de configuración, fechas y URLs
# ============================================================================

def _require_db():
    if not supabase:
        raise HTTPException(status_code=503, detail="Base de datos Supabase no disponible.")
    return supabase


def _normalizar_texto_libre(texto: str) -> str:
    """Normaliza texto a minúsculas sin tildes ni signos de puntuación para matching de opt-out."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", texto or "")
        if unicodedata.category(c) != "Mn"
    )
    limpio = re.sub(r"[^a-z0-9\s]", " ", sin_tildes.lower())
    return re.sub(r"\s+", " ", limpio).strip()


def load_encuestas_config() -> Dict[str, Any]:
    """Carga configuración de encuestas desde `public.configuracion_sistema` con defaults seguros."""
    cfg = dict(DEFAULT_ENCUESTAS_CONFIG)
    if not supabase:
        return cfg
    try:
        res = (
            supabase.table("configuracion_sistema")
            .select("valor")
            .eq("clave", CONFIG_KEY)
            .limit(1)
            .execute()
        )
        if res.data and isinstance(res.data[0].get("valor"), dict):
            for k, v in res.data[0]["valor"].items():
                if k in cfg:
                    cfg[k] = v
    except Exception as exc:
        logger.warning(f"[EncuestasConfig] Error leyendo configuracion_sistema: {exc}")
    return cfg


def save_encuestas_config(new_cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Persiste configuración en `public.configuracion_sistema` bajo clave `'encuestas_config'`."""
    db = _require_db()
    merged = dict(DEFAULT_ENCUESTAS_CONFIG)
    merged.update(new_cfg)
    db.table("configuracion_sistema").upsert(
        {
            "clave": CONFIG_KEY,
            "valor": merged,
            "descripcion": "Configuración del módulo de encuestas post-consulta",
        },
        on_conflict="clave",
    ).execute()
    return merged


def _pausar_por_calidad(motivo: str) -> None:
    cfg = load_encuestas_config()
    cfg["pausado_por_calidad"] = True
    cfg["motivo_pausa"] = motivo
    try:
        save_encuestas_config(cfg)
    except Exception as exc:
        logger.error(f"[Encuestas] Error guardando pausa por calidad: {exc}")
    log_event(
        nivel="WARNING",
        modulo="ENCUESTAS",
        accion="PAUSA_CALIDAD",
        mensaje=motivo,
    )


def calcular_fecha_objetivo_encuestas(now_art: Optional[datetime] = None) -> Optional[date]:
    """
    Calcula la fecha de turnos atendidos a procesar en D+1 (ART):
      - Lunes (weekday == 0) -> Sábado (hoy - 2 días)
      - Martes a Sábado (1..5) -> Día anterior (hoy - 1 día)
      - Domingo (6) -> None (no se envían encuestas en domingo)
    """
    ref = now_art or datetime.now(ART_TZ)
    wd = ref.weekday()
    if wd == 6:
        return None
    if wd == 0:
        return (ref - timedelta(days=2)).date()
    return (ref - timedelta(days=1)).date()


def build_surveymonkey_url(base_url: str, turno: Dict[str, Any]) -> str:
    """Construye la URL final hacia SurveyMonkey preservando query params existentes."""
    parsed = urlparse(base_url.strip())
    existing_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    existing_params.update(
        {
            "turno_id": str(turno["turno_id"]),
            "sede": str(turno["sede_canonica"]),
            "profesional": str(turno["profesional_canonico"]),
            "servicio": str(turno["servicio_nombre"]),
            "fecha": str(turno["fecha_turno"]),
            "horario": str(turno["horario_turno"]),
        }
    )
    new_query = urlencode(existing_params)
    return urlunparse(parsed._replace(query=new_query))


def _extraer_hora_turno(turno: Dict[str, Any]) -> str:
    raw_h = str(turno.get("hora") or "").strip()
    if re.match(r"^\d{2}:\d{2}$", raw_h):
        return raw_h
    fh = str(turno.get("fecha_hora") or "")
    if "T" in fh and len(fh.split("T")[1]) >= 5:
        return fh.split("T")[1][:5]
    return raw_h[:5] if len(raw_h) >= 5 else "00:00"


# ============================================================================
# Fase 1: Extracción desde Geclisa, mapeo manual y agrupación diaria
# ============================================================================

def _cargar_mapeos_geclisa() -> Dict[Tuple[str, str], Dict[str, Any]]:
    db = _require_db()
    res = db.table("encuestas_mapeo_geclisa").select("*").execute()
    mapa: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for row in res.data or []:
        mapa[(str(row["tipo_entidad"]), str(row["geclisa_id"]))] = row
    return mapa


def _cargar_opt_outs() -> set[str]:
    db = _require_db()
    res = db.table("encuestas_opt_out").select("telefono_e164").execute()
    return {str(r["telefono_e164"]).strip() for r in (res.data or []) if r.get("telefono_e164")}


def _resolver_clave_sede(turno: Dict[str, Any]) -> Tuple[Optional[str], str]:
    ubic_id_raw = turno.get("ubicacion_id_raw")
    ubic_raw = (turno.get("ubicacion_raw") or "").strip()
    cons_raw = (turno.get("consultorio_raw") or "").strip()
    if ubic_id_raw is not None and str(ubic_id_raw).strip() != "":
        return str(ubic_id_raw).strip(), ubic_raw or cons_raw or f"Sede #{ubic_id_raw}"
    if cons_raw:
        return cons_raw.upper(), ubic_raw or cons_raw
    return None, ""


async def _fetch_agenda_con_reintento(geclisa: GeclisaClient, fecha_iso: str) -> List[Dict[str, Any]]:
    last_err: Optional[Exception] = None
    for intento in range(2):
        try:
            return await asyncio.to_thread(geclisa.obtener_agenda_global, fecha_iso, True)
        except Exception as exc:
            last_err = exc
            if intento == 0:
                await asyncio.sleep(1.5)
    raise RuntimeError(f"Error consultando agenda global Geclisa ({fecha_iso}): {last_err}") from last_err


async def generar_lote_encuestas_para_fecha(
    fecha_objetivo: Optional[date] = None,
    dry_run: bool = False,
    forzar: bool = False,
) -> Dict[str, Any]:
    """
    Fase 1: Extrae turnos atendidos de Geclisa para `fecha_objetivo`, aplica mapeo manual,
    normaliza teléfonos y agrupa por (fecha_atencion, telefono_e164).
    Cuando `dry_run=True`, no escribe en ninguna tabla de Supabase.
    """
    db = _require_db()
    target_date = fecha_objetivo or calcular_fecha_objetivo_encuestas()
    if target_date is None:
        return {
            "fecha_atencion": None,
            "dry_run": dry_run,
            "omitido_domingo": True,
            "total_agenda": 0,
            "atendidos": 0,
            "validos": 0,
            "envios_creados": 0,
        }

    fecha_iso = target_date.isoformat()
    cfg = load_encuestas_config()

    if not dry_run:
        lock_res = db.rpc(
            "adquirir_lote_encuestas_diario",
            {"p_fecha": fecha_iso, "p_forzar": forzar},
        ).execute()
        if not bool(lock_res.data):
            return {
                "fecha_atencion": fecha_iso,
                "dry_run": False,
                "ya_procesado": True,
                "total_agenda": 0,
                "atendidos": 0,
                "validos": 0,
                "envios_creados": 0,
            }

    geclisa = GeclisaClient()
    try:
        turnos_agenda = await _fetch_agenda_con_reintento(geclisa, fecha_iso)
    except Exception as exc:
        err_str = str(exc)
        if not dry_run:
            db.table("encuestas_lotes_diarios").update(
                {
                    "estado": "fallido",
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "error_detalle": err_str[:500],
                }
            ).eq("fecha_atencion", fecha_iso).execute()
        log_event(nivel="ERROR", modulo="ENCUESTAS", accion="FASE1_ERROR_GECLISA", mensaje=err_str)
        raise

    mapeos = _cargar_mapeos_geclisa()
    opt_outs = _cargar_opt_outs()
    ficha_cache: Dict[int, Dict[str, Any]] = {}

    resumen: Dict[str, Any] = {
        "fecha_atencion": fecha_iso,
        "dry_run": dry_run,
        "total_agenda": len(turnos_agenda),
        "atendidos": 0,
        "omitidos_no_atendidos": 0,
        "omitidos_sin_servicio": 0,
        "omitidos_sin_sede": 0,
        "omitidos_mapeo_excluido": 0,
        "omitidos_telefono_invalido": 0,
        "omitidos_opt_out": 0,
        "validos": 0,
        "envios_agrupados": 0,
        "envios_creados": 0,
        "entidades_nuevas_detectadas": [],
    }

    nuevas_entidades: Dict[Tuple[str, str], Dict[str, Any]] = {}
    agrupados: Dict[str, List[Dict[str, Any]]] = {}

    for t in turnos_agenda:
        cancelado = bool(t.get("cancelado"))
        asistio = bool(t.get("asistio"))
        if cancelado or not asistio:
            resumen["omitidos_no_atendidos"] += 1
            continue
        resumen["atendidos"] += 1

        serv_id = t.get("servicio_id")
        serv_raw = (t.get("servicio_raw") or "").strip()
        if serv_id is None or not serv_raw:
            resumen["omitidos_sin_servicio"] += 1
            continue

        sede_key, sede_raw = _resolver_clave_sede(t)
        if not sede_key:
            resumen["omitidos_sin_sede"] += 1
            continue

        pre_id = t.get("prestador_id")
        pre_raw = (t.get("prestador_nombre") or "").strip()
        if not pre_id or not pre_raw:
            resumen["omitidos_mapeo_excluido"] += 1
            continue

        entidades_req = [
            ("servicio", str(serv_id), serv_raw),
            ("sede", sede_key, sede_raw),
            ("prestador", str(pre_id), pre_raw),
        ]

        falta_o_excluida = False
        resolved: Dict[str, Dict[str, Any]] = {}
        for tipo, gid, gnombre in entidades_req:
            row = mapeos.get((tipo, gid))
            if row is None:
                falta_o_excluida = True
                if (tipo, gid) not in nuevas_entidades:
                    nuevas_entidades[(tipo, gid)] = {
                        "tipo_entidad": tipo,
                        "geclisa_id": gid,
                        "geclisa_nombre_raw": gnombre,
                        "unidad_negocio": "excluido",
                        "nombre_canonico": gnombre,
                        "incluir_en_envio": False,
                    }
            else:
                resolved[tipo] = row
                if not row.get("incluir_en_envio"):
                    falta_o_excluida = True

        if falta_o_excluida:
            resumen["omitidos_mapeo_excluido"] += 1
            continue

        unidad = resolved["servicio"].get("unidad_negocio")
        if unidad != "consultas":
            resumen["omitidos_mapeo_excluido"] += 1
            continue

        # Normalización telefónica con fallback a obtener_ficha_completa ante falta o fijo
        tel_norm, _ = normalizar_telefono_argentina_movil(
            raw_phone=t.get("telefono"),
            celular_preferido=t.get("celular_raw"),
        )
        ficha_id = t.get("ficha_id")
        if not tel_norm and ficha_id is not None:
            try:
                fid_int = int(ficha_id)
            except (TypeError, ValueError):
                fid_int = None
            if fid_int is not None:
                if fid_int not in ficha_cache:
                    try:
                        ficha_cache[fid_int] = await asyncio.to_thread(
                            geclisa.obtener_ficha_completa, fid_int
                        )
                    except Exception:
                        ficha_cache[fid_int] = {}
                ficha_data = ficha_cache[fid_int] or {}
                tel_norm, _ = normalizar_telefono_argentina_movil(
                    raw_phone=ficha_data.get("telefono_fijo") or t.get("telefono"),
                    celular_preferido=ficha_data.get("celular") or t.get("celular_raw"),
                )

        if not tel_norm:
            resumen["omitidos_telefono_invalido"] += 1
            continue

        if tel_norm in opt_outs:
            resumen["omitidos_opt_out"] += 1
            continue

        resumen["validos"] += 1
        agrupados.setdefault(tel_norm, []).append(
            {
                "turno_id": int(t["turno_id"]),
                "ficha_id": int(ficha_id) if ficha_id is not None and str(ficha_id).isdigit() else None,
                "unidad_negocio": unidad,
                "servicio_id": int(serv_id),
                "servicio_nombre": resolved["servicio"]["nombre_canonico"],
                "sede_canonica": resolved["sede"]["nombre_canonico"],
                "profesional_canonico": resolved["prestador"]["nombre_canonico"],
                "fecha_turno": fecha_iso,
                "horario_turno": _extraer_hora_turno(t),
            }
        )

    resumen["entidades_nuevas_detectadas"] = list(nuevas_entidades.values())
    resumen["envios_agrupados"] = len(agrupados)

    if dry_run:
        return resumen

    # Registrar nuevas entidades detectadas para revisión manual en /encuestas
    if nuevas_entidades:
        db.table("encuestas_mapeo_geclisa").upsert(
            list(nuevas_entidades.values()),
            on_conflict="tipo_entidad,geclisa_id",
            ignore_duplicates=True,
        ).execute()

    ttl_dias = int(cfg.get("ttl_dias_enlace") or 14)
    expires_at_iso = (datetime.now(timezone.utc) + timedelta(days=ttl_dias)).isoformat()

    creados = 0
    for tel_e164, turnos_list in agrupados.items():
        token = secrets.token_urlsafe(18)
        rpc_res = db.rpc(
            "crear_envio_encuesta_con_turnos",
            {
                "p_token": token,
                "p_fecha_atencion": fecha_iso,
                "p_telefono_e164": tel_e164,
                "p_expires_at": expires_at_iso,
                "p_turnos": turnos_list,
            },
        ).execute()
        if rpc_res.data:
            creados += 1

    resumen["envios_creados"] = creados
    db.table("encuestas_lotes_diarios").update(
        {
            "estado": "completado",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "resumen": resumen,
            "error_detalle": None,
        }
    ).eq("fecha_atencion", fecha_iso).execute()

    log_event(
        nivel="INFO",
        modulo="ENCUESTAS",
        accion="FASE1_COMPLETADA",
        mensaje=f"Lote {fecha_iso} completado: {creados} envíos creados ({resumen['validos']} turnos válidos).",
        detalles=resumen,
    )
    return resumen


# ============================================================================
# Fase 2: Despacho gradual, reserva de cupo y control de calidad
# ============================================================================

def _contar_envios_24h(tabla: str, col_fecha: str) -> int:
    if not supabase:
        return 0
    hace_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    try:
        res = (
            supabase.table(tabla)
            .select("id", count="exact")
            .gte(col_fecha, hace_24h)
            .limit(1)
            .execute()
        )
        if getattr(res, "count", None) is not None:
            return int(res.count)
        return len(res.data or [])
    except Exception:
        return 0


def _calcular_cupo_disponible(cfg: Dict[str, Any], tier: Optional[str]) -> int:
    max_dia = int(cfg.get("max_envios_dia") or 400)
    reserva_estudios = int(cfg.get("reserva_diaria_estudios") or 100)
    tier_limit = TIER_DAILY_LIMITS.get(str(tier or "").upper(), 1000)

    estudios_24h = _contar_envios_24h("estudios_oftalmo", "whatsapp_sent_at")
    encuestas_24h = _contar_envios_24h("encuestas_envios", "sent_at")

    margen_tier = max(0, tier_limit - estudios_24h - reserva_estudios - encuestas_24h)
    margen_config = max(0, max_dia - encuestas_24h)
    return min(margen_tier, margen_config)


def _construir_componentes_plantilla(token: str) -> List[Dict[str, Any]]:
    """
    Formato Meta Graph API para plantilla `UTILITY` de encuestas:
      - 0 variables en BODY
      - Botón índice "0": URL dinámica con suffix `token`
      - Botón índice "1": QUICK_REPLY con payload `encuesta_opt_out`
    """
    return [
        {
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "text", "text": token}],
        },
        {
            "type": "button",
            "sub_type": "quick_reply",
            "index": "1",
            "parameters": [{"type": "payload", "payload": "encuesta_opt_out"}],
        },
    ]


def _es_error_permanente_meta(exc: Exception) -> Tuple[bool, Optional[int], str]:
    msg = str(exc)
    if isinstance(exc, (InvalidParameterError, TemplateHydratedTextTooLongError)):
        return True, getattr(exc, "code", None), msg
    if isinstance(exc, MetaAPIError):
        code = getattr(exc, "code", None)
        if code in PERMANENT_META_ERROR_CODES:
            return True, code, msg
        if isinstance(exc, RateLimitExceededError):
            return False, code, msg
        return False, code, msg
    if isinstance(exc, CircuitBreakerOpenException):
        return False, None, msg
    return False, None, msg


async def despachar_cola_encuestas() -> Dict[str, Any]:
    """
    Fase 2: Despacha envíos pendientes por Línea 2 verificando cupo médico,
    quality_rating (fail-closed tras 3 fallos de API) y tasa de errores 131049/131048.
    """
    db = _require_db()
    cfg = load_encuestas_config()
    if not cfg.get("activo") or cfg.get("pausado_por_calidad"):
        return {"despachados": 0, "pausado": True}

    est_phone_id, est_token = get_whatsapp_estudios_credentials()
    if not est_phone_id or not est_token:
        log_event(
            nivel="ERROR",
            modulo="ENCUESTAS",
            accion="CREDENCIALES_LINEA2_AUSENTES",
            mensaje="No hay credenciales configuradas para WhatsApp Línea 2; se aborta ciclo de encuestas.",
        )
        return {"despachados": 0, "error": "credenciales_ausentes"}

    wa_client = WhatsAppCloudClient(phone_number_id=est_phone_id, access_token=est_token, line="estudios")
    total_enviados = 0
    total_fallidos = 0
    fallos_calidad_api = 0
    tier_actual: Optional[str] = None

    try:
        while True:
            cfg = load_encuestas_config()
            if not cfg.get("activo") or cfg.get("pausado_por_calidad"):
                break

            details = await wa_client.get_phone_number_details()
            if not details:
                fallos_calidad_api += 1
                if fallos_calidad_api >= 3:
                    _pausar_por_calidad("Error sostenido consultando calidad de Línea 2")
                    break
            else:
                fallos_calidad_api = 0
                tier_actual = details.get("messaging_limit_tier") or tier_actual
                q_rating = str(details.get("quality_rating") or "").upper()
                if q_rating in ("YELLOW", "RED"):
                    _pausar_por_calidad(f"Degradación de quality_rating en Línea 2 ({q_rating})")
                    break

            cupo_disponible = _calcular_cupo_disponible(cfg, tier_actual)
            if cupo_disponible <= 0:
                logger.info("[Encuestas] Cupo diario o reserva de estudios alcanzada; se difiere el resto de la cola.")
                break

            batch_size = min(int(cfg.get("batch_size") or 25), cupo_disponible)
            claim_res = db.rpc("claim_encuestas_envios_pendientes", {"p_limit": batch_size}).execute()
            lote = claim_res.data or []
            if not lote:
                break

            template_name = str(cfg.get("template_name") or "encuesta_satisfaccion_consulta_v1")
            template_lang = str(cfg.get("template_language") or "es_AR")
            jitter_min = float(cfg.get("jitter_min_seg") or 1.5)
            jitter_max = max(jitter_min, float(cfg.get("jitter_max_seg") or 4.0))

            errores_frecuencia_bloque = 0
            for idx, item in enumerate(lote):
                envio_id = item["id"]
                tel = item["telefono_e164"]
                token = item["token"]
                intentos_prev = int(item.get("intentos") or 0)

                try:
                    res = await wa_client.send_template(
                        to_phone=tel,
                        template_name=template_name,
                        language_code=template_lang,
                        components=_construir_componentes_plantilla(token),
                    )
                    wamid = res.get("wamid")
                    db.table("encuestas_envios").update(
                        {
                            "estado_cola": "enviado",
                            "claimed_at": None,
                            "wamid": wamid,
                            "wa_status": "sent",
                            "sent_at": datetime.now(timezone.utc).isoformat(),
                        }
                    ).eq("id", envio_id).execute()
                    total_enviados += 1
                except Exception as exc:
                    es_perm, err_code, err_msg = _es_error_permanente_meta(exc)
                    if err_code in RATE_ANOMALY_ERROR_CODES:
                        errores_frecuencia_bloque += 1
                    nuevo_intento = intentos_prev + 1
                    if es_perm or nuevo_intento >= 3:
                        db.table("encuestas_envios").update(
                            {
                                "estado_cola": "fallido",
                                "claimed_at": None,
                                "intentos": nuevo_intento,
                                "wa_status": "failed",
                                "wa_error_code": err_code,
                                "wa_error_message": err_msg[:500],
                            }
                        ).eq("id", envio_id).execute()
                        total_fallidos += 1
                    else:
                        db.table("encuestas_envios").update(
                            {
                                "estado_cola": "pendiente",
                                "claimed_at": None,
                                "intentos": nuevo_intento,
                                "wa_error_code": err_code,
                                "wa_error_message": err_msg[:500],
                            }
                        ).eq("id", envio_id).execute()

                if idx < len(lote) - 1 and jitter_max > 0:
                    await asyncio.sleep(random.uniform(jitter_min, jitter_max))

            if len(lote) >= 5 and (errores_frecuencia_bloque / len(lote)) >= 0.10:
                _pausar_por_calidad(
                    f"Tasa anómala de rechazos 131049/131048 ({errores_frecuencia_bloque}/{len(lote)})"
                )
                break
    finally:
        await wa_client.close()

    return {"despachados": total_enviados, "fallidos": total_fallidos}


async def cron_encuestas_satisfaccion() -> None:
    """Loop periódico en zona ART (lunes a sábado dentro de ventana diurna configurada)."""
    logger.info("[CronEncuestas] Iniciado scheduler de encuestas de satisfacción.")
    await asyncio.sleep(15)
    while True:
        try:
            now_art = datetime.now(ART_TZ)
            if now_art.weekday() != 6:  # Lunes a Sábado
                cfg = load_encuestas_config()
                hora_actual = now_art.strftime("%H:%M")
                hora_ini = str(cfg.get("hora_envio_art") or "10:30")
                hora_fin = str(cfg.get("hora_fin_envio_art") or "20:00")
                if hora_ini <= hora_actual <= hora_fin:
                    if cfg.get("activo"):
                        try:
                            await generar_lote_encuestas_para_fecha(dry_run=False, forzar=False)
                        except Exception as f1_err:
                            logger.error(f"[CronEncuestas] Error en Fase 1: {f1_err}")
                    if cfg.get("activo") and not cfg.get("pausado_por_calidad"):
                        await despachar_cola_encuestas()
        except Exception as exc:
            logger.error(f"[CronEncuestas] Error en ciclo: {exc}")
        await asyncio.sleep(60)


# ============================================================================
# Handlers de dominio delegados desde worker.py
# ============================================================================

async def procesar_baja_encuesta_estudios_inbound(
    normalized_phone: str,
    msg_type: str,
    btn_payload: str,
    btn_text: str,
    raw_text: str,
    wamid: Optional[str],
    wa_client: WhatsAppCloudClient,
) -> bool:
    """
    Procesa bajas de encuestas en Línea 2 de forma aislada de `estudios_oftalmo`:
      - Botón `encuesta_opt_out` / `"No recibir encuestas"`: sin límite temporal.
      - Texto libre normalizado (`stop`, `baja`, `no encuestas`, `no recibir encuestas`):
        solo si existe un envío en `encuestas_envios` dentro de `ttl_dias_enlace` días.
    """
    if not supabase or not normalized_phone:
        return False

    es_boton = btn_payload.strip().lower() == "encuesta_opt_out" or btn_text.strip().lower() == "no recibir encuestas"
    origen = "boton_whatsapp" if es_boton else None

    if not es_boton and msg_type == "text":
        norm_txt = _normalizar_texto_libre(raw_text)
        if norm_txt in OPT_OUT_TEXT_COMMANDS:
            cfg = load_encuestas_config()
            ttl_dias = int(cfg.get("ttl_dias_enlace") or 14)
            desde_iso = (datetime.now(timezone.utc) - timedelta(days=ttl_dias)).isoformat()
            rec_res = (
                supabase.table("encuestas_envios")
                .select("id")
                .eq("telefono_e164", normalized_phone)
                .gte("created_at", desde_iso)
                .limit(1)
                .execute()
            )
            if rec_res.data:
                origen = "texto_whatsapp"

    if not origen:
        return False

    supabase.table("encuestas_opt_out").upsert(
        {
            "telefono_e164": normalized_phone,
            "origen": origen,
            "wamid_origen": wamid,
        },
        on_conflict="telefono_e164",
    ).execute()

    await wa_client.send_free_text(
        to_phone=normalized_phone,
        text="Listo, no volveremos a enviarte encuestas de satisfacción.",
        preview_url=False,
    )
    log_event(
        nivel="INFO",
        modulo="ENCUESTAS",
        accion="OPT_OUT_REGISTRADO",
        mensaje=f"Baja de encuestas registrada ({origen}) para {normalized_phone}.",
    )
    return True


def sincronizar_estado_envio_encuesta(
    wamid: str,
    status_name: str,
    err_code: Optional[int] = None,
    err_msg: Optional[str] = None,
) -> None:
    """Actualiza `wa_status` respetando orden monotónico (`sent < delivered < read`) o `failed` terminal."""
    if not supabase or not wamid:
        return

    res = (
        supabase.table("encuestas_envios")
        .select("id, wa_status, estado_cola")
        .eq("wamid", wamid)
        .limit(1)
        .execute()
    )
    if not res.data:
        return

    row = res.data[0]
    current_status = (row.get("wa_status") or "").lower()
    nuevo_status = (status_name or "").lower()

    upd: Dict[str, Any] = {}
    if nuevo_status == "failed":
        upd["wa_status"] = "failed"
        upd["estado_cola"] = "fallido"
        if err_code is not None:
            upd["wa_error_code"] = int(err_code)
        if err_msg:
            upd["wa_error_message"] = str(err_msg)[:500]
    elif nuevo_status in WA_STATUS_ORDER:
        if current_status == "failed":
            return
        if WA_STATUS_ORDER[nuevo_status] > WA_STATUS_ORDER.get(current_status, 0):
            upd["wa_status"] = nuevo_status
        else:
            return
    else:
        return

    if upd:
        supabase.table("encuestas_envios").update(upd).eq("id", row["id"]).execute()


# ============================================================================
# Endpoints Públicos (sin JWT)
# ============================================================================

@encuestas_satisfaccion_router.get("/api/encuestas-publico/{token}")
def obtener_encuesta_publica(token: str):
    db = _require_db()
    envio_res = (
        db.table("encuestas_envios")
        .select("id, expires_at")
        .eq("token", token)
        .limit(1)
        .execute()
    )
    if not envio_res.data:
        return JSONResponse(
            content={"estado": "no_encontrado", "turnos": []},
            headers=PUBLIC_SECURITY_HEADERS,
        )

    envio = envio_res.data[0]
    exp_raw = str(envio["expires_at"]).replace("Z", "+00:00")
    exp_dt = datetime.fromisoformat(exp_raw)
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=timezone.utc)

    if exp_dt <= datetime.now(timezone.utc):
        return JSONResponse(
            content={"estado": "expirado", "turnos": []},
            headers=PUBLIC_SECURITY_HEADERS,
        )

    cfg = load_encuestas_config()
    base_url = str(cfg.get("surveymonkey_url") or "").strip()
    if not base_url:
        raise HTTPException(
            status_code=503,
            detail="URL de SurveyMonkey no configurada.",
            headers=PUBLIC_SECURITY_HEADERS,
        )

    turnos_res = (
        db.table("encuestas_envios_turnos")
        .select("turno_id, profesional_canonico, sede_canonica, servicio_nombre, fecha_turno, horario_turno, click_count")
        .eq("envio_id", envio["id"])
        .order("horario_turno")
        .execute()
    )

    turnos_out = []
    for t in turnos_res.data or []:
        turnos_out.append(
            {
                "turno_id": t["turno_id"],
                "profesional": t["profesional_canonico"],
                "sede": t["sede_canonica"],
                "servicio": t["servicio_nombre"],
                "fecha": str(t["fecha_turno"]),
                "horario": t["horario_turno"],
                "ya_abierto": int(t.get("click_count") or 0) > 0,
                "surveymonkey_url": build_surveymonkey_url(base_url, t),
            }
        )

    return JSONResponse(
        content={"estado": "valido", "turnos": turnos_out},
        headers=PUBLIC_SECURITY_HEADERS,
    )


@encuestas_satisfaccion_router.post("/api/encuestas-publico/{token}/click")
def registrar_clic_encuesta_publica(token: str, payload: ClickTurnoPayload):
    db = _require_db()
    rpc_res = db.rpc(
        "registrar_clic_encuesta_turno",
        {"p_token": token, "p_turno_id": payload.turno_id},
    ).execute()
    rows = rpc_res.data or []
    row = rows[0] if isinstance(rows, list) and rows else (rows if isinstance(rows, dict) else {})
    estado = row.get("estado")

    if estado == "expirado":
        raise HTTPException(status_code=410, detail="El enlace de encuesta ha expirado.", headers=PUBLIC_SECURITY_HEADERS)
    if estado != "ok":
        raise HTTPException(status_code=404, detail="Enlace o turno no encontrado.", headers=PUBLIC_SECURITY_HEADERS)

    return JSONResponse(
        content={"ok": True, "click_count": int(row.get("click_count") or 1)},
        headers=PUBLIC_SECURITY_HEADERS,
    )


# ============================================================================
# Endpoints Administrativos (RBAC por acción)
# ============================================================================

@encuestas_satisfaccion_router.get("/api/encuestas/config")
async def get_encuestas_config_admin(
    _actor: str = Depends(require_module_permission("encuestas", "ver")),
):
    db = _require_db()
    cfg = load_encuestas_config()

    line_health: Dict[str, Any] = {
        "configured": False,
        "quality_rating": None,
        "messaging_limit_tier": None,
        "display_phone_number": None,
        "estudios_24h": _contar_envios_24h("estudios_oftalmo", "whatsapp_sent_at"),
        "encuestas_24h": _contar_envios_24h("encuestas_envios", "sent_at"),
    }
    est_phone_id, est_token = get_whatsapp_estudios_credentials()
    if est_phone_id and est_token:
        line_health["configured"] = True
        wa_client = WhatsAppCloudClient(phone_number_id=est_phone_id, access_token=est_token, line="estudios")
        try:
            det = await wa_client.get_phone_number_details()
            if det:
                line_health["quality_rating"] = det.get("quality_rating")
                line_health["messaging_limit_tier"] = det.get("messaging_limit_tier")
                line_health["display_phone_number"] = det.get("display_phone_number")
        finally:
            await wa_client.close()

    lote_res = (
        db.table("encuestas_lotes_diarios")
        .select("*")
        .order("fecha_atencion", desc=True)
        .limit(1)
        .execute()
    )
    ultimo_lote = lote_res.data[0] if lote_res.data else None

    template_row: Optional[Dict[str, Any]] = None
    try:
        tpl_res = (
            db.table("whatsapp_templates")
            .select("name, status, category, language, updated_at")
            .eq("name", cfg["template_name"])
            .limit(1)
            .execute()
        )
        if tpl_res.data:
            template_row = tpl_res.data[0]
    except Exception as exc:
        logger.warning(f"[EncuestasConfig] Error consultando whatsapp_templates: {exc}")

    template_status = {
        "exists": template_row is not None,
        "name": cfg["template_name"],
        "status": template_row.get("status") if template_row else None,
        "category": template_row.get("category") if template_row else None,
        "language": template_row.get("language") if template_row else cfg["template_language"],
        "updated_at": template_row.get("updated_at") if template_row else None,
    }

    return {
        "config": cfg,
        "line_health": line_health,
        "ultimo_lote": ultimo_lote,
        "template_status": template_status,
    }


@encuestas_satisfaccion_router.post("/api/encuestas/plantilla/crear")
async def crear_plantilla_encuesta_meta(
    _actor: str = Depends(require_module_permission("encuestas", "editar")),
):
    from app.services.whatsapp_cloud.templates import (
        TemplateButton,
        TemplateCreateRequest,
        create_template,
    )

    cfg = load_encuestas_config()
    frontend_base = (os.getenv("FRONTEND_URL") or "https://crm-agentico-nube.vercel.app").strip().rstrip("/")
    req = TemplateCreateRequest(
        name=cfg["template_name"],
        category="UTILITY",
        language=cfg.get("template_language") or "es_AR",
        header_type="NONE",
        body_text=(
            "Hola. Gracias por haberte atendido ayer en nuestra clínica. "
            "Te invitamos a responder una breve encuesta anónima de satisfacción sobre tu atención."
        ),
        buttons=[
            TemplateButton(
                type="URL",
                text="Responder encuesta",
                url=f"{frontend_base}/e/{{{{1}}}}",
                example=[f"{frontend_base}/e/demo_token_123"],
            ),
            TemplateButton(
                type="QUICK_REPLY",
                text="No recibir encuestas",
            ),
        ],
    )
    res = await create_template(req)
    return {"ok": True, "result": res}


@encuestas_satisfaccion_router.post("/api/encuestas/plantilla/sincronizar")
async def sincronizar_plantillas_encuesta_meta(
    _actor: str = Depends(require_module_permission("encuestas", "editar")),
):
    from app.services.whatsapp_cloud.templates import sync_templates_from_meta

    res = await sync_templates_from_meta()
    return {"ok": True, "result": res}


@encuestas_satisfaccion_router.put("/api/encuestas/config")
async def update_encuestas_config_admin(
    payload: EncuestasConfigPayload,
    _actor: str = Depends(require_module_permission("encuestas", "editar")),
):
    current = load_encuestas_config()
    new_data = payload.model_dump()

    # Si se intenta levantar pausa por calidad, verificar en Meta que ya no esté en YELLOW/RED
    if current.get("pausado_por_calidad") and not new_data.get("pausado_por_calidad"):
        est_phone_id, est_token = get_whatsapp_estudios_credentials()
        if est_phone_id and est_token:
            wa_client = WhatsAppCloudClient(phone_number_id=est_phone_id, access_token=est_token, line="estudios")
            try:
                det = await wa_client.get_phone_number_details()
                q_rating = str((det or {}).get("quality_rating") or "").upper()
                if q_rating in ("YELLOW", "RED"):
                    raise HTTPException(
                        status_code=409,
                        detail=f"La Línea 2 continúa con quality_rating={q_rating} en Meta; no es posible reanudar aún.",
                    )
            finally:
                await wa_client.close()
        new_data["motivo_pausa"] = None

    saved = save_encuestas_config(new_data)
    return {"config": saved}


@encuestas_satisfaccion_router.get("/api/encuestas/mapeos")
def list_mapeos_geclisa(
    tipo_entidad: Optional[str] = Query(default=None),
    _actor: str = Depends(require_module_permission("encuestas", "ver")),
):
    db = _require_db()
    q = db.table("encuestas_mapeo_geclisa").select("*").order("tipo_entidad").order("geclisa_nombre_raw")
    if tipo_entidad:
        q = q.eq("tipo_entidad", tipo_entidad)
    res = q.execute()
    return {"items": res.data or []}


@encuestas_satisfaccion_router.post("/api/encuestas/mapeos")
def create_mapeo_geclisa(
    payload: MapeoGeclisaCreatePayload,
    _actor: str = Depends(require_module_permission("encuestas", "editar")),
):
    db = _require_db()
    dup = (
        db.table("encuestas_mapeo_geclisa")
        .select("id")
        .eq("tipo_entidad", payload.tipo_entidad)
        .eq("geclisa_id", payload.geclisa_id)
        .limit(1)
        .execute()
    )
    if dup.data:
        raise HTTPException(status_code=409, detail="Ya existe un mapeo para ese tipo_entidad y geclisa_id.")

    res = db.table("encuestas_mapeo_geclisa").insert(payload.model_dump()).execute()
    return {"item": res.data[0] if res.data else payload.model_dump()}


@encuestas_satisfaccion_router.put("/api/encuestas/mapeos/{mapeo_id}")
def update_mapeo_geclisa(
    mapeo_id: int,
    payload: MapeoGeclisaUpdatePayload,
    _actor: str = Depends(require_module_permission("encuestas", "editar")),
):
    db = _require_db()
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = db.table("encuestas_mapeo_geclisa").update(upd).eq("id", mapeo_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Mapeo no encontrado.")
    return {"item": res.data[0]}


@encuestas_satisfaccion_router.get("/api/encuestas/envios")
def list_envios_encuestas(
    fecha: Optional[date] = Query(default=None),
    estado_cola: Optional[str] = Query(default=None),
    wa_status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _actor: str = Depends(require_module_permission("encuestas", "ver")),
):
    db = _require_db()
    q = db.table("encuestas_envios").select("*, encuestas_envios_turnos(*)", count="exact")
    if fecha:
        q = q.eq("fecha_atencion", fecha.isoformat())
    if estado_cola:
        q = q.eq("estado_cola", estado_cola)
    if wa_status:
        q = q.eq("wa_status", wa_status)

    offset = (page - 1) * page_size
    res = q.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    rows = res.data or []

    # Contadores agregados sobre el filtro activo
    q_stats = db.table("encuestas_envios").select("estado_cola, wa_status, wa_error_code, encuestas_envios_turnos(click_count)")
    if fecha:
        q_stats = q_stats.eq("fecha_atencion", fecha.isoformat())
    if estado_cola:
        q_stats = q_stats.eq("estado_cola", estado_cola)
    if wa_status:
        q_stats = q_stats.eq("wa_status", wa_status)
    stats_rows = q_stats.execute().data or []

    contadores = {
        "total": len(stats_rows),
        "pendientes": 0,
        "enviados": 0,
        "entregados": 0,
        "leidos": 0,
        "fallidos": 0,
        "rechazos_131049": 0,
        "turnos_con_clic": 0,
    }
    for sr in stats_rows:
        ec = sr.get("estado_cola")
        ws = sr.get("wa_status")
        if ec == "pendiente":
            contadores["pendientes"] += 1
        if ec == "enviado":
            contadores["enviados"] += 1
        if ec == "fallido":
            contadores["fallidos"] += 1
        if ws == "delivered":
            contadores["entregados"] += 1
        elif ws == "read":
            contadores["entregados"] += 1
            contadores["leidos"] += 1
        if sr.get("wa_error_code") == 131049:
            contadores["rechazos_131049"] += 1
        for tr in sr.get("encuestas_envios_turnos") or []:
            if int(tr.get("click_count") or 0) > 0:
                contadores["turnos_con_clic"] += 1

    return {
        "items": rows,
        "total": getattr(res, "count", None) if getattr(res, "count", None) is not None else len(rows),
        "page": page,
        "page_size": page_size,
        "contadores": contadores,
    }


@encuestas_satisfaccion_router.get("/api/encuestas/opt-outs")
def list_opt_outs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    _actor: str = Depends(require_module_permission("encuestas", "ver")),
):
    db = _require_db()
    offset = (page - 1) * page_size
    res = (
        db.table("encuestas_opt_out")
        .select("*", count="exact")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    return {
        "items": res.data or [],
        "total": getattr(res, "count", None) if getattr(res, "count", None) is not None else len(res.data or []),
        "page": page,
        "page_size": page_size,
    }


@encuestas_satisfaccion_router.post("/api/encuestas/opt-outs")
def create_opt_out_manual(
    payload: OptOutCreatePayload,
    _actor: str = Depends(require_module_permission("encuestas", "editar")),
):
    db = _require_db()
    tel_norm, err = normalizar_telefono_argentina_movil(payload.telefono)
    if not tel_norm:
        raise HTTPException(status_code=422, detail=f"Teléfono inválido: {err}")

    res = (
        db.table("encuestas_opt_out")
        .upsert(
            {"telefono_e164": tel_norm, "origen": "manual_admin"},
            on_conflict="telefono_e164",
        )
        .execute()
    )
    return {"item": res.data[0] if res.data else {"telefono_e164": tel_norm, "origen": "manual_admin"}}


@encuestas_satisfaccion_router.delete("/api/encuestas/opt-outs/{opt_out_id}")
def delete_opt_out_manual(
    opt_out_id: int,
    _actor: str = Depends(require_module_permission("encuestas", "editar")),
):
    db = _require_db()
    res = db.table("encuestas_opt_out").delete().eq("id", opt_out_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Registro de baja no encontrado.")
    return {"ok": True}


@encuestas_satisfaccion_router.post("/api/encuestas/ejecutar-lote")
async def ejecutar_lote_manual(
    payload: EjecutarLotePayload,
    _actor: str = Depends(require_module_permission("encuestas", "ejecutar")),
):
    if not payload.dry_run and payload.despachar_ahora:
        cfg = load_encuestas_config()
        if not cfg.get("activo") or cfg.get("pausado_por_calidad"):
            raise HTTPException(
                status_code=409,
                detail="No es posible despachar ahora porque el módulo está inactivo o pausado por calidad.",
            )

    resumen = await generar_lote_encuestas_para_fecha(
        fecha_objetivo=payload.fecha,
        dry_run=payload.dry_run,
        forzar=not payload.dry_run,
    )

    despacho_iniciado = False
    if not payload.dry_run and payload.despachar_ahora:
        asyncio.create_task(despachar_cola_encuestas())
        despacho_iniciado = True

    return {"resumen": resumen, "despacho_iniciado": despacho_iniciado}
