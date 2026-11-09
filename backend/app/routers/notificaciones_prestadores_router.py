"""
Router FastAPI para Notificaciones Automatizadas de Agendas Quirúrgicas a Prestadores.
Prefijo: `/api/turnos-quirofano/notificaciones-prestadores`
"""

import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, status
from pydantic import BaseModel, Field

from app.db import (
    get_configuracion_notificaciones_prestadores,
    update_configuracion_notificaciones_prestadores,
    obtener_logs_notificaciones_prestadores
)
from app.services.notificacion_prestadores_service import (
    NotificacionPrestadoresService,
    calcular_fecha_objetivo_habiles
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/turnos-quirofano/notificaciones-prestadores",
    tags=["Notificaciones Agendas Prestadores"]
)

# ------------------------------------------------------------------------------
# Modelos Pydantic de Validación
# ------------------------------------------------------------------------------

class DespachoManualRequest(BaseModel):
    fecha_cirugia: str = Field(..., description="Fecha de cirugías a notificar en formato YYYY-MM-DD")
    forzar_reenvio: bool = Field(False, description="Reenviar aunque ya se haya enviado hoy")
    asincrono: bool = Field(True, description="Si es True, responde 202 y procesa en segundo plano")

class ConfiguracionNotificacionesPayload(BaseModel):
    enabled: Optional[bool] = None
    anticipacion_dias_habiles: Optional[int] = Field(None, ge=1, le=7)
    hora_corte: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    timezone: Optional[str] = None
    linea_waba: Optional[str] = None
    plantilla_nombre: Optional[str] = None
    idioma_plantilla: Optional[str] = None
    incluir_sabados: Optional[bool] = None


# ------------------------------------------------------------------------------
# Endpoints REST
# ------------------------------------------------------------------------------

@router.get("/destinatarios-status")
async def get_destinatarios_status(fecha: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$")):
    """
    Diagnóstico pre-vuelo: analiza los turnos de la fecha y clasifica a los prestadores
    entre listos para envío, sin teléfono registrado y derivadores no resolubles.
    Alimenta la tarjeta de alerta visual en Quirófano y el modal de envío.
    """
    try:
        resultado = NotificacionPrestadoresService.obtener_destinatarios_status(fecha)
        return resultado
    except Exception as e:
        logger.error(f"[RouterNotificaciones] Error en destinatarios-status: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo estado de destinatarios: {e}")


@router.post("/despachar", status_code=status.HTTP_202_ACCEPTED)
async def despachar_agendas(
    payload: DespachoManualRequest,
    background_tasks: BackgroundTasks
):
    """
    Disparo bajo demanda: compila y despacha las agendas por WhatsApp para una fecha.
    Por defecto opera de forma asíncrona (BackgroundTasks) para evitar bloqueos por timeout HTTP.
    """
    job_id = str(uuid.uuid4())
    logger.info(f"[RouterNotificaciones] Solicitud de despacho recibida (Job: {job_id}, Fecha: {payload.fecha_cirugia}, Asíncrono: {payload.asincrono})")

    if payload.asincrono:
        background_tasks.add_task(
            NotificacionPrestadoresService.despachar_agendas_fecha,
            fecha_cirugia=payload.fecha_cirugia,
            forzar_reenvio=payload.forzar_reenvio
        )
        return {
            "success": True,
            "job_id": job_id,
            "status": "PROCESSING",
            "mensaje": f"El despacho de agendas para el día {payload.fecha_cirugia} fue iniciado en segundo plano.",
            "fecha_cirugia": payload.fecha_cirugia
        }
    else:
        # Ejecución síncrona directa (para testing o lotes pequeños)
        try:
            res = await NotificacionPrestadoresService.despachar_agendas_fecha(
                fecha_cirugia=payload.fecha_cirugia,
                forzar_reenvio=payload.forzar_reenvio
            )
            return {
                "success": True,
                "job_id": job_id,
                "status": "COMPLETED",
                **res
            }
        except Exception as e:
            logger.error(f"[RouterNotificaciones] Error en despacho síncrono: {e}")
            raise HTTPException(status_code=500, detail=f"Error durante el despacho de agendas: {e}")


@router.post("/ejecutar-corte-diario")
async def trigger_corte_diario_manual():
    """
    Fuerza la ejecución inmediata de la lógica de corte diario automático
    (calculando la fecha objetivo según días hábiles).
    """
    try:
        res = await NotificacionPrestadoresService.ejecutar_corte_automatico()
        return {
            "success": True,
            "mensaje": "Corte automático diario ejecutado.",
            "resultado": res
        }
    except Exception as e:
        logger.error(f"[RouterNotificaciones] Error forzando corte diario: {e}")
        raise HTTPException(status_code=500, detail=f"Error ejecutando corte diario: {e}")


@router.get("/configuracion")
async def get_configuracion():
    """Consulta la configuración operativa actual del automatismo."""
    try:
        cfg = get_configuracion_notificaciones_prestadores()
        # Agregar cálculo informativo de próxima fecha proyectada
        dias_h = int(cfg.get("anticipacion_dias_habiles", 2))
        inc_sab = bool(cfg.get("incluir_sabados", False))
        proxima = calcular_fecha_objetivo_habiles(dias_habiles=dias_h, incluir_sabados=inc_sab)
        return {
            **cfg,
            "proxima_fecha_proyectada": proxima.strftime("%Y-%m-%d")
        }
    except Exception as e:
        logger.error(f"[RouterNotificaciones] Error leyendo configuración: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/configuracion")
async def update_configuracion(payload: ConfiguracionNotificacionesPayload):
    """Actualiza los parámetros operativos del corte de agendas."""
    try:
        dump_fn = getattr(payload, "model_dump", getattr(payload, "dict", None))
        datos = {k: v for k, v in dump_fn().items() if v is not None}
        actualizado = update_configuracion_notificaciones_prestadores(datos)
        return {
            "success": True,
            "mensaje": "Configuración de notificaciones actualizada exitosamente.",
            "configuracion": actualizado
        }
    except Exception as e:
        logger.error(f"[RouterNotificaciones] Error actualizando configuración: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
async def get_logs(
    fecha_cirugia: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    fecha_corte: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    limit: int = Query(50, ge=1, le=200)
):
    """Consulta el historial de auditoría de despachos de agendas."""
    try:
        logs = obtener_logs_notificaciones_prestadores(
            fecha_cirugia=fecha_cirugia,
            fecha_corte=fecha_corte,
            limit=limit
        )
        return {
            "total": len(logs),
            "logs": logs
        }
    except Exception as e:
        logger.error(f"[RouterNotificaciones] Error obteniendo logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
