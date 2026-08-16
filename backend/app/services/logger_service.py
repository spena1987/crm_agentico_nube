import os
import sys
import time
import logging
import traceback
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.db import supabase

logger = logging.getLogger("system_logger")

# Lista de módulos válidos
MODULOS_VALIDOS = {
    "IA_GEMINI",
    "GECLISA",
    "WHATSAPP",
    "PRESUPUESTOS",
    "PACIENTES",
    "SISTEMA",
    "FRONTEND",
    "DATABASE"
}

# Lista de niveles válidos
NIVELES_VALIDOS = {"INFO", "WARNING", "ERROR", "CRITICAL"}

def _write_to_supabase_async(log_data: dict):
    """
    Inserta el log en la tabla system_logs de Supabase en un hilo secundario
    para garantizar latencia cero en las operaciones principales.
    """
    if not supabase:
        return

    try:
        supabase.table("system_logs").insert(log_data).execute()
    except Exception as e:
        logger.error(f"[LOG_FALLBACK] Error al persistir log en Supabase: {e}")

def log_event(
    nivel: str,
    modulo: str,
    accion: str,
    mensaje: str,
    detalles: Optional[Dict[str, Any]] = None,
    duracion_ms: Optional[int] = None,
    http_status: Optional[int] = None,
    paciente_id: Optional[str] = None,
    trace: Optional[str] = None,
    sync: bool = False
) -> Dict[str, Any]:
    """
    Registra un evento estructurado en la base de datos de Supabase y en los logs locales.
    
    :param nivel: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
    :param modulo: 'IA_GEMINI' | 'GECLISA' | 'WHATSAPP' | 'PRESUPUESTOS' | 'PACIENTES' | 'SISTEMA' | 'FRONTEND' | 'DATABASE'
    :param accion: Nombre corto identificador (ej: 'BUSCAR_PACIENTE_DNI', 'GENERAR_PRESUPUESTO_PDF')
    :param mensaje: Explicación legible del suceso o del error
    :param detalles: Diccionario con parámetros, payloads sanitizados o metadatos técnicos
    :param duracion_ms: Tiempo de respuesta en milisegundos
    :param http_status: Código HTTP (ej: 200, 404, 500)
    :param paciente_id: UUID del paciente asociado (si aplica)
    :param trace: Stack trace de la excepción (si aplica)
    :param sync: Si True, ejecuta de forma síncrona; si False, en segundo plano
    """
    nivel_norm = nivel.upper() if nivel else "INFO"
    if nivel_norm not in NIVELES_VALIDOS:
        nivel_norm = "INFO"

    modulo_norm = modulo.upper() if modulo else "SISTEMA"
    if modulo_norm not in MODULOS_VALIDOS:
        modulo_norm = "SISTEMA"

    # Si hubo error y no se pasó trace pero estamos en un bloque except, capturarlo
    if nivel_norm in ("ERROR", "CRITICAL") and not trace:
        exc_type, exc_val, exc_tb = sys.exc_info()
        if exc_type:
            trace = "".join(traceback.format_exception(exc_type, exc_val, exc_tb))

    log_entry = {
        "nivel": nivel_norm,
        "modulo": modulo_norm,
        "accion": accion.strip(),
        "mensaje": mensaje.strip(),
        "detalles": detalles or {},
        "duracion_ms": int(duracion_ms) if duracion_ms is not None else None,
        "http_status": int(http_status) if http_status is not None else None,
        "paciente_id": paciente_id,
        "trace": trace
    }

    # 1. Output en consola local / Docker logs con formato uniforme
    log_line = f"[{modulo_norm}][{accion}] {mensaje}"
    if duracion_ms:
        log_line += f" ({duracion_ms}ms)"
    if http_status:
        log_line += f" [HTTP {http_status}]"

    if nivel_norm == "CRITICAL":
        logger.critical(log_line)
    elif nivel_norm == "ERROR":
        logger.error(log_line)
    elif nivel_norm == "WARNING":
        logger.warning(log_line)
    else:
        logger.info(log_line)

    # 2. Persistencia en Supabase
    if sync:
        _write_to_supabase_async(log_entry)
    else:
        thread = threading.Thread(target=_write_to_supabase_async, args=(log_entry,), daemon=True)
        thread.start()

    return log_entry


def get_logs(
    limit: int = 50,
    offset: int = 0,
    nivel: Optional[str] = None,
    modulo: Optional[str] = None,
    search: Optional[str] = None,
    paciente_id: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None
) -> Dict[str, Any]:
    """
    Obtiene lista paginada y filtrada de logs desde Supabase.
    """
    if not supabase:
        return {"logs": [], "total": 0}

    try:
        query = supabase.table("system_logs").select("*", count="exact")

        if nivel and nivel.upper() != "ALL":
            query = query.eq("nivel", nivel.upper())

        if modulo and modulo.upper() != "ALL":
            query = query.eq("modulo", modulo.upper())

        if paciente_id:
            query = query.eq("paciente_id", paciente_id)

        if desde:
            query = query.gte("created_at", desde)

        if hasta:
            query = query.lte("created_at", hasta)

        if search:
            # Búsqueda por texto en mensaje o acción
            s = f"%{search.strip()}%"
            query = query.or_(f"mensaje.ilike.{s},accion.ilike.{s}")

        # Ordenar por fecha descendente y paginar
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        response = query.execute()

        return {
            "logs": response.data or [],
            "total": response.count if response.count is not None else len(response.data or [])
        }

    except Exception as e:
        logger.error(f"Error al consultar logs: {e}")
        return {"logs": [], "total": 0, "error": str(e)}


def get_logs_stats() -> Dict[str, Any]:
    """
    Calcula estadísticas de salud y métricas de eventos de las últimas 24 horas.
    """
    if not supabase:
        return {
            "total_24h": 0,
            "errores_24h": 0,
            "warnings_24h": 0,
            "por_modulo": {},
            "ultimos_errores": []
        }

    try:
        from datetime import timedelta
        hace_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        # 1. Total eventos 24h
        res_total = supabase.table("system_logs").select("id", count="exact").gte("created_at", hace_24h).execute()
        total_24h = res_total.count or 0

        # 2. Total errores 24h
        res_err = supabase.table("system_logs").select("id", count="exact").gte("created_at", hace_24h).in_("nivel", ["ERROR", "CRITICAL"]).execute()
        errores_24h = res_err.count or 0

        # 3. Total advertencias 24h
        res_warn = supabase.table("system_logs").select("id", count="exact").gte("created_at", hace_24h).eq("nivel", "WARNING").execute()
        warnings_24h = res_warn.count or 0

        # 4. Distribución por módulo en 24h
        res_modulos = supabase.table("system_logs").select("modulo, nivel").gte("created_at", hace_24h).execute()
        por_modulo: Dict[str, int] = {}
        for row in (res_modulos.data or []):
            m = row.get("modulo", "SISTEMA")
            por_modulo[m] = por_modulo.get(m, 0) + 1

        # 5. Últimos 5 errores críticos
        res_recent_err = supabase.table("system_logs").select("*").in_("nivel", ["ERROR", "CRITICAL"]).order("created_at", desc=True).limit(5).execute()

        return {
            "total_24h": total_24h,
            "errores_24h": errores_24h,
            "warnings_24h": warnings_24h,
            "por_modulo": por_modulo,
            "ultimos_errores": res_recent_err.data or []
        }

    except Exception as e:
        logger.error(f"Error al calcular estadísticas de logs: {e}")
        return {
            "total_24h": 0,
            "errores_24h": 0,
            "warnings_24h": 0,
            "por_modulo": {},
            "ultimos_errores": [],
            "error": str(e)
        }
