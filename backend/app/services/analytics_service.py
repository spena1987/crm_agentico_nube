"""
Servicio Integral de Business Intelligence y Analytics Gerencial para Centrovisión CRM Médico.
Calcula métricas agregadas en memoria con caché temporal para optimizar la performance en producción.
"""

import logging
from datetime import datetime, timedelta, timezone, date
from typing import Dict, Any, List, Optional
from collections import defaultdict

from app.db import supabase

logger = logging.getLogger(__name__)

# Cache simple en memoria con TTL de 60 segundos
_CACHE_STORE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 45


def _get_from_cache(key: str) -> Optional[Any]:
    if key in _CACHE_STORE:
        entry = _CACHE_STORE[key]
        if (datetime.now().timestamp() - entry["ts"]) < CACHE_TTL_SECONDS:
            return entry["data"]
        else:
            del _CACHE_STORE[key]
    return None


def _set_in_cache(key: str, data: Any) -> None:
    _CACHE_STORE[key] = {
        "ts": datetime.now().timestamp(),
        "data": data
    }


def _calcular_rango_fechas(dias: int = 30, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None):
    """
    Determina las marcas de tiempo ISO de inicio y fin para consultas analíticas.
    """
    ahora = datetime.now(timezone.utc)
    if fecha_inicio and fecha_fin:
        try:
            dt_inicio = datetime.fromisoformat(fecha_inicio.replace('Z', '+00:00'))
            if dt_inicio.tzinfo is None:
                dt_inicio = dt_inicio.replace(tzinfo=timezone.utc)
            
            dt_fin = datetime.fromisoformat(fecha_fin.replace('Z', '+00:00'))
            if dt_fin.tzinfo is None:
                dt_fin = dt_fin.replace(tzinfo=timezone.utc)
            # Extender dt_fin al final del día si sólo viene fecha YYYY-MM-DD
            if len(fecha_fin) <= 10:
                dt_fin = dt_fin.replace(hour=23, minute=59, second=59)
            return dt_inicio, dt_fin
        except Exception as e:
            logger.warning(f"Error parseando fechas personalizadas ({fecha_inicio}, {fecha_fin}): {e}. Usando default.")
    
    dt_inicio = ahora - timedelta(days=dias)
    dt_fin = ahora
    return dt_inicio, dt_fin


def obtener_resumen_gerencial(dias: int = 30, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None) -> Dict[str, Any]:
    """
    Retorna los KPIs macro de dirección, tendencia de facturación, estado del pipeline y ratios clave.
    """
    cache_key = f"resumen_gerencial_{dias}_{fecha_inicio}_{fecha_fin}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    if not supabase:
        return {"error": "Base de datos no conectada"}

    try:
        dt_inicio, dt_fin = _calcular_rango_fechas(dias, fecha_inicio, fecha_fin)
        iso_inicio = dt_inicio.isoformat()
        iso_fin = dt_fin.isoformat()

        # 1. Presupuestos y Facturación
        pres_res = supabase.table("presupuestos")\
            .select("id, estado, total, total_ars, total_usd, created_at")\
            .gte("created_at", iso_inicio)\
            .lte("created_at", iso_fin)\
            .execute()
        presupuestos = pres_res.data or []

        total_emitidos = len(presupuestos)
        aprobados = [p for p in presupuestos if p.get("estado") == "aprobado"]
        rechazados = [p for p in presupuestos if p.get("estado") == "rechazado"]
        pendientes = [p for p in presupuestos if p.get("estado") in ("borrador", "enviado")]

        total_facturado_ars = sum(float(p.get("total_ars") or p.get("total") or 0) for p in aprobados)
        total_facturado_usd = sum(float(p.get("total_usd") or 0) for p in aprobados)

        tasa_conversion_presupuestos = round((len(aprobados) / total_emitidos * 100), 1) if total_emitidos > 0 else 0

        # Tendencia semanal/diaria de presupuestos
        tendencia_map = defaultdict(lambda: {"fecha": "", "emitidos": 0, "aprobados": 0, "monto_ars": 0.0})
        for p in presupuestos:
            c_date = (p.get("created_at") or "")[:10]
            if c_date:
                tendencia_map[c_date]["fecha"] = c_date
                tendencia_map[c_date]["emitidos"] += 1
                if p.get("estado") == "aprobado":
                    tendencia_map[c_date]["aprobados"] += 1
                    tendencia_map[c_date]["monto_ars"] += float(p.get("total_ars") or p.get("total") or 0)

        tendencia_list = sorted(tendencia_map.values(), key=lambda x: x["fecha"])

        # 2. Asesorías Quirúrgicas y Pipeline
        casos_res = supabase.table("asesorias_quirurgicas")\
            .select("id, estado, monto_extra, moneda_extra, practica_nombre, medico_cirujano_nombre, created_at, ultimo_contacto_at, proxima_accion_fecha")\
            .gte("created_at", iso_inicio)\
            .lte("created_at", iso_fin)\
            .execute()
        casos = casos_res.data or []

        etapas_conteo = defaultdict(int)
        etapas_monto_ars = defaultdict(float)
        etapas_monto_usd = defaultdict(float)
        casos_riesgo_count = 0
        capital_riesgo_ars = 0.0
        capital_riesgo_usd = 0.0

        for c in casos:
            est = c.get("estado") or "derivado"
            monto = float(c.get("monto_extra") or 0)
            moneda = (c.get("moneda_extra") or "ARS").upper()
            
            etapas_conteo[est] += 1
            if moneda == "USD":
                etapas_monto_usd[est] += monto
            else:
                etapas_monto_ars[est] += monto

            # Control SLA (>3 días sin contacto en etapas activas)
            if est in ("derivado", "en_asesoramiento", "en_analisis", "confirmado", "programado"):
                ref_fecha = c.get("ultimo_contacto_at") or c.get("created_at")
                if ref_fecha:
                    try:
                        f_dt = datetime.fromisoformat(ref_fecha.replace('Z', '+00:00'))
                        dias_sin_contacto = (datetime.now(timezone.utc) - f_dt).days
                        if dias_sin_contacto >= 3:
                            casos_riesgo_count += 1
                            if moneda == "USD":
                                capital_riesgo_usd += monto
                            else:
                                capital_riesgo_ars += monto
                    except Exception:
                        pass

        # 3. Turnos de Quirófano en el periodo
        fecha_inicio_str = iso_inicio[:10]
        fecha_fin_str = iso_fin[:10]
        qx_res = supabase.table("turnos_quirofano")\
            .select("id, estado, fecha_cirugia, cirujano_nombre, practica_nombre, lio_calculado, lio_stock_reservado, consentimiento_estado")\
            .gte("fecha_cirugia", fecha_inicio_str)\
            .lte("fecha_cirugia", fecha_fin_str)\
            .execute()
        turnos_qx = qx_res.data or []

        total_cirugias = len(turnos_qx)
        cirugias_operadas = sum(1 for t in turnos_qx if t.get("estado") == "operado")
        cirugias_programadas = sum(1 for t in turnos_qx if t.get("estado") in ("programado", "en_espera"))
        cirugias_canceladas = sum(1 for t in turnos_qx if t.get("estado") == "cancelado")
        tasa_efectividad_qx = round((cirugias_operadas / (cirugias_operadas + cirugias_canceladas) * 100), 1) if (cirugias_operadas + cirugias_canceladas) > 0 else 100.0

        # 4. Estudios Oftalmológicos
        est_res = supabase.table("estudios_oftalmo")\
            .select("id, whatsapp_status, created_at, geclisa_as_id")\
            .gte("created_at", iso_inicio)\
            .lte("created_at", iso_fin)\
            .execute()
        estudios = est_res.data or []
        total_estudios = len(estudios)
        estudios_leidos_wa = sum(1 for e in estudios if e.get("whatsapp_status") == "read")
        tasa_lectura_estudios = round((estudios_leidos_wa / total_estudios * 100), 1) if total_estudios > 0 else 0

        resultado = {
            "periodo": {
                "dias": dias,
                "inicio": iso_inicio,
                "fin": iso_fin
            },
            "kpis": {
                "facturacion_aprobada_ars": total_facturado_ars,
                "facturacion_aprobada_usd": total_facturado_usd,
                "presupuestos_emitidos": total_emitidos,
                "presupuestos_aprobados": len(aprobados),
                "tasa_conversion_presupuestos": tasa_conversion_presupuestos,
                "casos_totales_pipeline": len(casos),
                "casos_en_riesgo_sla": casos_riesgo_count,
                "capital_riesgo_ars": capital_riesgo_ars,
                "capital_riesgo_usd": capital_riesgo_usd,
                "total_cirugias": total_cirugias,
                "cirugias_operadas": cirugias_operadas,
                "cirugias_programadas": cirugias_programadas,
                "cirugias_canceladas": cirugias_canceladas,
                "tasa_efectividad_qx": tasa_efectividad_qx,
                "total_estudios": total_estudios,
                "tasa_lectura_estudios": tasa_lectura_estudios
            },
            "tendencia_facturacion": tendencia_list,
            "distribucion_pipeline": {
                "conteo": dict(etapas_conteo),
                "monto_ars": dict(etapas_monto_ars),
                "monto_usd": dict(etapas_monto_usd)
            }
        }

        _set_in_cache(cache_key, resultado)
        return resultado

    except Exception as e:
        logger.error(f"Error generando resumen gerencial: {e}", exc_info=True)
        return {"error": str(e)}


def obtener_productividad_usuarios(dias: int = 30, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None) -> Dict[str, Any]:
    """
    Consolida las acciones de cada usuario/a del staff médico y administrativo:
    - Asesoras: Contactos en bitácora por canal (Llamada, WhatsApp, Presencial, Interno)
    - Técnicos: Estudios procesados, guardados y confirmados
    - Operadores: Conversaciones y mensajes gestionados
    """
    cache_key = f"productividad_usuarios_{dias}_{fecha_inicio}_{fecha_fin}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    if not supabase:
        return {"error": "Base de datos no conectada"}

    try:
        dt_inicio, dt_fin = _calcular_rango_fechas(dias, fecha_inicio, fecha_fin)
        iso_inicio = dt_inicio.isoformat()
        iso_fin = dt_fin.isoformat()

        # 1. Obtener lista de usuarios oficiales
        usuarios_res = supabase.table("usuarios_perfil")\
            .select("id, nombre_completo, email, activo, roles(nombre)")\
            .execute()
        usuarios_db = usuarios_res.data or []

        # Estructura base de colaboradores
        colaboradores = {}
        for u in usuarios_db:
            u_id = u.get("id")
            nombre = u.get("nombre_completo") or u.get("email")
            rol_obj = u.get("roles") or {}
            rol_nombre = rol_obj.get("nombre") if isinstance(rol_obj, dict) else "Personal"
            
            colaboradores[nombre] = {
                "id": u_id,
                "nombre": nombre,
                "email": u.get("email"),
                "rol": rol_nombre,
                "es_oficial": True,
                "contactos_totales": 0,
                "canales": {
                    "whatsapp": 0,
                    "llamada": 0,
                    "presencial": 0,
                    "interno": 0
                },
                "estudios_procesados": 0,
                "estudios_leidos": 0,
                "presupuestos_relacionados": 0,
                "ultima_actividad": None
            }

        # 2. Consultar Evoluciones / Bitácoras de Asesoramiento
        ev_res = supabase.table("asesoria_evoluciones")\
            .select("id, usuario_id, usuario_nombre, tipo_contacto, created_at")\
            .gte("created_at", iso_inicio)\
            .lte("created_at", iso_fin)\
            .execute()
        evoluciones = ev_res.data or []

        for ev in evoluciones:
            u_nom = ev.get("usuario_nombre") or "Personal No Identificado"
            # Si el usuario no estaba en la tabla de perfiles (ej. alias o bot)
            if u_nom not in colaboradores:
                colaboradores[u_nom] = {
                    "id": ev.get("usuario_id"),
                    "nombre": u_nom,
                    "email": "",
                    "rol": "Asesoramiento / Operativo",
                    "es_oficial": False,
                    "contactos_totales": 0,
                    "canales": {"whatsapp": 0, "llamada": 0, "presencial": 0, "interno": 0},
                    "estudios_procesados": 0,
                    "estudios_leidos": 0,
                    "presupuestos_relacionados": 0,
                    "ultima_actividad": None
                }

            canal = (ev.get("tipo_contacto") or "interno").lower()
            if canal not in colaboradores[u_nom]["canales"]:
                colaboradores[u_nom]["canales"][canal] = 0
            
            colaboradores[u_nom]["canales"][canal] += 1
            colaboradores[u_nom]["contactos_totales"] += 1
            
            act_date = ev.get("created_at")
            if act_date:
                curr_last = colaboradores[u_nom]["ultima_actividad"]
                if not curr_last or act_date > curr_last:
                    colaboradores[u_nom]["ultima_actividad"] = act_date

        # 3. Consultar Estudios procesados por Técnicos
        est_res = supabase.table("estudios_oftalmo")\
            .select("id, tecnico_nombre, tecnico_usuario_id, whatsapp_status, created_at")\
            .gte("created_at", iso_inicio)\
            .lte("created_at", iso_fin)\
            .execute()
        estudios = est_res.data or []

        for st in estudios:
            tec_nom = st.get("tecnico_nombre") or "Técnico No Identificado"
            if tec_nom not in colaboradores:
                colaboradores[tec_nom] = {
                    "id": st.get("tecnico_usuario_id"),
                    "nombre": tec_nom,
                    "email": "",
                    "rol": "Técnico Oftalmólogo",
                    "es_oficial": False,
                    "contactos_totales": 0,
                    "canales": {"whatsapp": 0, "llamada": 0, "presencial": 0, "interno": 0},
                    "estudios_procesados": 0,
                    "estudios_leidos": 0,
                    "presupuestos_relacionados": 0,
                    "ultima_actividad": None
                }

            colaboradores[tec_nom]["estudios_procesados"] += 1
            if st.get("whatsapp_status") == "read":
                colaboradores[tec_nom]["estudios_leidos"] += 1
            
            st_date = st.get("created_at")
            if st_date:
                curr_last = colaboradores[tec_nom]["ultima_actividad"]
                if not curr_last or st_date > curr_last:
                    colaboradores[tec_nom]["ultima_actividad"] = st_date

        # Lista ordenada de mayor a menor actividad global
        ranking_usuarios = sorted(
            colaboradores.values(),
            key=lambda x: (x["contactos_totales"] + x["estudios_procesados"]),
            reverse=True
        )

        # Totales por Canal Global
        canales_totales = {
            "whatsapp": sum(u["canales"]["whatsapp"] for u in ranking_usuarios),
            "llamada": sum(u["canales"]["llamada"] for u in ranking_usuarios),
            "presencial": sum(u["canales"]["presencial"] for u in ranking_usuarios),
            "interno": sum(u["canales"]["interno"] for u in ranking_usuarios)
        }

        res = {
            "periodo": {
                "dias": dias,
                "inicio": iso_inicio,
                "fin": iso_fin
            },
            "total_acciones": sum(u["contactos_totales"] + u["estudios_procesados"] for u in ranking_usuarios),
            "canales_totales": canales_totales,
            "usuarios": ranking_usuarios
        }

        _set_in_cache(cache_key, res)
        return res

    except Exception as e:
        logger.error(f"Error generando productividad de usuarios: {e}", exc_info=True)
        return {"error": str(e)}


def obtener_metricas_modulo(modulo: str, dias: int = 30, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None) -> Dict[str, Any]:
    """
    Genera el análisis profundo para un módulo específico:
    - 'asesoramiento'
    - 'quirofano'
    - 'estudios'
    """
    cache_key = f"modulo_{modulo}_{dias}_{fecha_inicio}_{fecha_fin}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    if not supabase:
        return {"error": "Base de datos no conectada"}

    try:
        dt_inicio, dt_fin = _calcular_rango_fechas(dias, fecha_inicio, fecha_fin)
        iso_inicio = dt_inicio.isoformat()
        iso_fin = dt_fin.isoformat()

        if modulo == "asesoramiento":
            # Embudo Lead-to-Surgery, tiempos en etapa y ranking por cirujano
            casos_res = supabase.table("asesorias_quirurgicas")\
                .select("id, estado, monto_extra, moneda_extra, practica_nombre, medico_cirujano_nombre, created_at, ultimo_contacto_at")\
                .gte("created_at", iso_inicio)\
                .lte("created_at", iso_fin)\
                .execute()
            casos = casos_res.data or []

            etapas = ["derivado", "en_asesoramiento", "en_analisis", "confirmado", "programado", "operado", "cancelado"]
            funnel_datos = {e: {"conteo": 0, "monto_ars": 0.0, "monto_usd": 0.0} for e in etapas}
            cirujanos_volumen = defaultdict(lambda: {"casos": 0, "monto_ars": 0.0, "monto_usd": 0.0})
            practicas_demanda = defaultdict(int)

            for c in casos:
                est = c.get("estado") or "derivado"
                if est not in funnel_datos:
                    funnel_datos[est] = {"conteo": 0, "monto_ars": 0.0, "monto_usd": 0.0}
                monto = float(c.get("monto_extra") or 0)
                moneda = (c.get("moneda_extra") or "ARS").upper()

                funnel_datos[est]["conteo"] += 1
                if moneda == "USD":
                    funnel_datos[est]["monto_usd"] += monto
                else:
                    funnel_datos[est]["monto_ars"] += monto

                cir = c.get("medico_cirujano_nombre") or "Sin Asignar"
                cirujanos_volumen[cir]["casos"] += 1
                if moneda == "USD":
                    cirujanos_volumen[cir]["monto_usd"] += monto
                else:
                    cirujanos_volumen[cir]["monto_ars"] += monto

                prac = c.get("practica_nombre") or "Consulta General"
                practicas_demanda[prac] += 1

            res = {
                "modulo": "asesoramiento",
                "total_casos": len(casos),
                "funnel": [{"etapa": k, **v} for k, v in funnel_datos.items()],
                "cirujanos": sorted([{"nombre": k, **v} for k, v in cirujanos_volumen.items()], key=lambda x: x["casos"], reverse=True),
                "practicas": sorted([{"practica": k, "cantidad": v} for k, v in practicas_demanda.items()], key=lambda x: x["cantidad"], reverse=True)
            }

        elif modulo == "quirofano":
            # Tiempos de slots, cirugías por cirujano, estado biométrico LIO y consentimientos
            fecha_inicio_str = iso_inicio[:10]
            fecha_fin_str = iso_fin[:10]
            qx_res = supabase.table("turnos_quirofano")\
                .select("id, estado, fecha_cirugia, hora_inicio, cirujano_nombre, practica_nombre, quirofano_id, lio_calculado, lio_stock_reservado, consentimiento_estado, duracion_minutos")\
                .gte("fecha_cirugia", fecha_inicio_str)\
                .lte("fecha_cirugia", fecha_fin_str)\
                .execute()
            turnos = qx_res.data or []

            cirujanos_qx = defaultdict(lambda: {"programadas": 0, "operadas": 0, "canceladas": 0})
            lio_status = {"total_con_lio": 0, "calculados": 0, "stock_reservado": 0}
            consentimientos_status = defaultdict(int)

            for t in turnos:
                cir = t.get("cirujano_nombre") or "Sin Asignar"
                est = t.get("estado") or "programado"
                if est == "operado":
                    cirujanos_qx[cir]["operadas"] += 1
                elif est == "cancelado":
                    cirujanos_qx[cir]["canceladas"] += 1
                else:
                    cirujanos_qx[cir]["programadas"] += 1

                if t.get("lio_calculado") is not None:
                    lio_status["total_con_lio"] += 1
                    if t.get("lio_calculado"):
                        lio_status["calculados"] += 1
                    if t.get("lio_stock_reservado"):
                        lio_status["stock_reservado"] += 1

                cons = t.get("consentimiento_estado") or "pendiente"
                consentimientos_status[cons] += 1

            res = {
                "modulo": "quirofano",
                "total_turnos": len(turnos),
                "cirujanos": sorted([{"nombre": k, **v} for k, v in cirujanos_qx.items()], key=lambda x: (x["operadas"] + x["programadas"]), reverse=True),
                "lio_metricas": lio_status,
                "consentimientos": dict(consentimientos_status)
            }

        elif modulo == "estudios":
            # Desglose de estados de envío WhatsApp y demanda diagnóstica
            est_res = supabase.table("estudios_oftalmo")\
                .select("id, tecnico_nombre, whatsapp_status, tipo, created_at, geclisa_as_id")\
                .gte("created_at", iso_inicio)\
                .lte("created_at", iso_fin)\
                .execute()
            estudios = est_res.data or []

            estados_wa = defaultdict(int)
            tecnicos_conteo = defaultdict(lambda: {"total": 0, "leidos": 0, "guardados_geclisa": 0})
            tipos_estudios = defaultdict(int)

            for st in estudios:
                st_wa = st.get("whatsapp_status") or "pending"
                estados_wa[st_wa] += 1

                tec = st.get("tecnico_nombre") or "Sin Asignar"
                tecnicos_conteo[tec]["total"] += 1
                if st_wa == "read":
                    tecnicos_conteo[tec]["leidos"] += 1
                if st.get("geclisa_as_id"):
                    tecnicos_conteo[tec]["guardados_geclisa"] += 1

                t_est = st.get("tipo") or "Estudio Oftalmológico"
                tipos_estudios[t_est] += 1

            res = {
                "modulo": "estudios",
                "total_estudios": len(estudios),
                "estados_whatsapp": dict(estados_wa),
                "tecnicos": sorted([{"nombre": k, **v} for k, v in tecnicos_conteo.items()], key=lambda x: x["total"], reverse=True),
                "tipos_estudios": sorted([{"tipo": k, "cantidad": v} for k, v in tipos_estudios.items()], key=lambda x: x["cantidad"], reverse=True)
            }
        else:
            return {"error": f"Módulo desconocido: {modulo}"}

        _set_in_cache(cache_key, res)
        return res

    except Exception as e:
        logger.error(f"Error generando métricas de módulo {modulo}: {e}", exc_info=True)
        return {"error": str(e)}
