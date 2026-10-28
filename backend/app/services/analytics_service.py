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

# Cache simple en memoria con TTL de 45 segundos
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


def _fetch_paginated(table_name: str, select_cols: str, iso_inicio: str, iso_fin: str, date_col: str = "created_at", extra_eq: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Recupera todos los registros en el rango de fechas superando el límite de 1.000 filas por página de PostgREST.
    """
    all_rows: List[Dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        q = supabase.table(table_name).select(select_cols).gte(date_col, iso_inicio).lte(date_col, iso_fin)
        if extra_eq:
            for k, v in extra_eq.items():
                q = q.eq(k, v)
        res = q.range(offset, offset + page_size - 1).execute()
        batch = res.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
        if offset >= 15000:
            break
    return all_rows


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
        aprobados = [p for p in presupuestos if p.get("estado") in ("aprobado", "operado")]
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
                if p.get("estado") in ("aprobado", "operado"):
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


# Nombres de cuentas de sistema / automatismos o etiquetas genéricas sin operador individual
NOMBRES_AUTOMATISMOS_Y_GENERICOS = {
    "sistema crm (pipeline qx)",
    "sistema crm (pipeline qx / quirófano)",
    "sistema crm (pipeline qx / quirofano)",
    "sistema crm",
    "asistente whatsapp (meta)",
    "asistente ia whatsapp",
    "asesoramiento quirúrgico (sistema)",
    "asesoramiento quirurgico (sistema)",
    "asesora quirúrgica",
    "asesora quirurgica",
    "asesoría quirúrgica",
    "asesoria quirurgica",
    "automatismo crm (d-2 a d-3)",
    "operador sin identificar (histórico)",
    "personal no identificado"
}


def obtener_productividad_usuarios(dias: int = 30, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None) -> Dict[str, Any]:
    """
    Consolida de forma integral todas las acciones operativas y asistenciales de cada usuario/a del staff:
    1. Bandeja de Entrada WhatsApp (`public.mensajes` emisor='operador'):
       - Mensajes de chat directo respondidos
       - Plantillas Meta enviadas (Presupuestos PDF, Recordatorios Qx, Consentimientos, Aperturas, Comunicación)
       - Conversaciones tomadas (`ASIGNACION_TOMADA`)
       - Casos de chat resueltos / finalizados (`CASO_FINALIZADO`)
       - Derivaciones internas (`DERIVACION_INTERNA`)
    2. Bitácora de Asesoramiento Quirúrgico (`public.asesoria_evoluciones`):
       - Llamadas telefónicas y tareas de seguimiento cumplidas
       - Atención presencial real (excluyendo sincronizaciones automáticas de presupuestos)
       - Notas internas y cambios de etapa en el Pipeline Quirúrgico
       - Contactos manuales por WhatsApp registrados en bitácora
    3. Consola de Estudios Técnicos (`public.estudios_oftalmo`):
       - Estudios subidos a Geclisa y despachados por WhatsApp Línea 2 + confirmación de lectura
    4. Quirófano, Cálculo de LIO y Reserva de Stock (`public.turnos_quirofano`, `public.asesorias_quirurgicas`, `public.system_logs`):
       - Turnos quirúrgicos programados (`usuario_alta`), cálculos de LIO confirmados (`lio_calculado_por`) y reservas de stock LIO.
    """
    cache_key = f"productividad_usuarios_v2_{dias}_{fecha_inicio}_{fecha_fin}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    if not supabase:
        return {"error": "Base de datos no conectada"}

    try:
        dt_inicio, dt_fin = _calcular_rango_fechas(dias, fecha_inicio, fecha_fin)
        iso_inicio = dt_inicio.isoformat()
        iso_fin = dt_fin.isoformat()

        # 1. Obtener lista de usuarios oficiales de `usuarios_perfil` y construir mapa de resolución de alias
        usuarios_res = supabase.table("usuarios_perfil")\
            .select("id, nombre_completo, email, activo, roles(nombre)")\
            .execute()
        usuarios_db = usuarios_res.data or []

        colaboradores: Dict[str, Dict[str, Any]] = {}
        alias_map: Dict[str, str] = {}  # lower_alias -> canonical_key

        def _crear_estructura_colaborador(
            key: str,
            u_id: Optional[str],
            nombre: str,
            email: str,
            rol: str,
            es_oficial: bool,
            es_humano: bool
        ) -> Dict[str, Any]:
            return {
                "id": u_id,
                "nombre": nombre,
                "email": email,
                "rol": rol,
                "es_oficial": es_oficial,
                "es_humano": es_humano,
                "contactos_totales": 0,
                "acciones_totales": 0,
                "canales": {
                    "whatsapp": 0,
                    "llamada": 0,
                    "presencial": 0,
                    "interno": 0
                },
                "desglose": {
                    "mensajes_chat": 0,
                    "plantillas_wa": 0,
                    "presupuestos_wa": 0,
                    "chats_tomados": 0,
                    "casos_finalizados": 0,
                    "derivaciones_chat": 0,
                    "llamadas": 0,
                    "presencial": 0,
                    "bitacora_interno": 0,
                    "estudios_procesados": 0,
                    "estudios_leidos": 0,
                    "quirofano_lio": 0
                },
                "estudios_procesados": 0,
                "estudios_leidos": 0,
                "presupuestos_relacionados": 0,
                "ultima_actividad": None
            }

        for u in usuarios_db:
            u_id = u.get("id")
            nombre = (u.get("nombre_completo") or u.get("email") or "Usuario").strip()
            if nombre.lower() == "lorean adaro":
                nombre = "Lorena Adaro"
            email = (u.get("email") or "").strip()
            rol_obj = u.get("roles") or {}
            rol_nombre = rol_obj.get("nombre") if isinstance(rol_obj, dict) else "Personal"

            # Cuentas genéricas de rol ("Asesoramiento", "Administracion", "Quirofano") siguen siendo cuentas de perfil
            colaboradores[nombre] = _crear_estructura_colaborador(
                key=nombre,
                u_id=u_id,
                nombre=nombre,
                email=email,
                rol=rol_nombre,
                es_oficial=True,
                es_humano=True
            )

            # Registrar alias por ID, nombre, email y prefijo de email
            if u_id:
                alias_map[str(u_id).lower()] = nombre
            alias_map[nombre.lower()] = nombre
            if email:
                alias_map[email.lower()] = nombre
                prefix = email.split("@")[0].lower()
                alias_map[prefix] = nombre

        # Alias conocidos específicos de producción (ej. errores de tipeo históricos o formatos apellido, nombre)
        for k_alias, target_sub in [
            ("lorena adaro", "adaro"),
            ("lorean adaro", "adaro"),
            ("ladaro", "adaro"),
            ("sebastian.pena", "peña"),
            ("sebastian pena", "peña"),
            ("sebastián peña", "peña"),
            ("romina perez", "romina"),
            ("romina pérez", "romina"),
            ("griselda concina", "griselda"),
            ("ana manita", "ana manita"),
            ("claudia sibecas", "sibecas"),
        ]:
            # Buscar cuál es la clave canónica en colaboradores
            for c_key in list(colaboradores.keys()):
                if target_sub in c_key.lower():
                    alias_map[k_alias] = c_key
                    break

        def _resolver_colaborador(raw_name: Optional[str], raw_id: Optional[str] = None, rol_default: str = "Asesoramiento / Operativo") -> str:
            if raw_id and str(raw_id).lower() in alias_map:
                return alias_map[str(raw_id).lower()]
            
            clean = (raw_name or "").strip()
            if not clean:
                clean = "Operador Sin Identificar (Histórico)"
            
            low = clean.lower()
            if low in alias_map:
                return alias_map[low]

            # Caso especial: Técnicos de Geclisa como "TARIFEÑO, CAMILA"
            if "tarife" in low and "camila" in low:
                canon = "Camila Tarifeño"
                alias_map[low] = canon
                if canon not in colaboradores:
                    colaboradores[canon] = _crear_estructura_colaborador(
                        key=canon,
                        u_id=raw_id,
                        nombre=canon,
                        email="",
                        rol="Técnica Oftalmóloga",
                        es_oficial=True,
                        es_humano=True
                    )
                return canon

            es_auto = low in NOMBRES_AUTOMATISMOS_Y_GENERICOS or "sistema" in low or "asistente" in low or "automatismo" in low
            rol_calc = "Automatismo / Genérico" if es_auto else rol_default

            if clean not in colaboradores:
                colaboradores[clean] = _crear_estructura_colaborador(
                    key=clean,
                    u_id=raw_id,
                    nombre=clean,
                    email="",
                    rol=rol_calc,
                    es_oficial=not es_auto,
                    es_humano=not es_auto
                )
            alias_map[low] = clean
            return clean

        def _actualizar_ultima_actividad(c_key: str, ts: Optional[str]):
            if not ts:
                return
            curr = colaboradores[c_key]["ultima_actividad"]
            if not curr or ts > curr:
                colaboradores[c_key]["ultima_actividad"] = ts

        # =========================================================================
        # FUENTE 1: Tabla `mensajes` (emisor = 'operador') - Gestión en WhatsApp / Chat
        # =========================================================================
        op_msgs = _fetch_paginated(
            table_name="mensajes",
            select_cols="id, conversacion_id, emisor, contenido, metadata_json, created_at",
            iso_inicio=iso_inicio,
            iso_fin=iso_fin,
            date_col="created_at",
            extra_eq={"emisor": "operador"}
        )

        for m in op_msgs:
            meta = m.get("metadata_json") or {}
            if not isinstance(meta, dict):
                meta = {}
            raw_op_name = meta.get("operador_nombre") or meta.get("usuario_nombre") or meta.get("resuelta_por")
            raw_op_id = meta.get("operador_id") or meta.get("usuario_id")
            
            # Si es un mensaje automático de recordatorio o sin operador_nombre
            if not raw_op_name and not raw_op_id:
                raw_op_name = "Operador Sin Identificar (Histórico)"

            c_key = _resolver_colaborador(raw_op_name, raw_op_id)
            col = colaboradores[c_key]
            _actualizar_ultima_actividad(c_key, m.get("created_at"))

            tipo_ev = (meta.get("tipo_evento") or "").upper()
            tipo_msg = (meta.get("tipo") or "").lower()
            tpl_name = (meta.get("template_name") or "").lower()

            if tipo_ev == "ASIGNACION_TOMADA":
                col["desglose"]["chats_tomados"] += 1
                col["canales"]["interno"] += 1
            elif tipo_ev == "CASO_FINALIZADO":
                col["desglose"]["casos_finalizados"] += 1
                col["canales"]["interno"] += 1
            elif tipo_ev == "DERIVACION_INTERNA":
                col["desglose"]["derivaciones_chat"] += 1
                col["canales"]["interno"] += 1
            elif tipo_msg == "template" or tpl_name:
                col["desglose"]["plantillas_wa"] += 1
                col["canales"]["whatsapp"] += 1
                if "presupuesto" in tpl_name:
                    col["desglose"]["presupuestos_wa"] += 1
                    col["presupuestos_relacionados"] += 1
            elif meta.get("es_nota_interna"):
                col["desglose"]["bitacora_interno"] += 1
                col["canales"]["interno"] += 1
            else:
                # Mensaje directo de chat (texto, documento PDF, audio, imagen) enviado por el operador
                col["desglose"]["mensajes_chat"] += 1
                col["canales"]["whatsapp"] += 1

        # =========================================================================
        # FUENTE 2: Tabla `asesoria_evoluciones` - Bitácora del Pipeline Quirúrgico
        # =========================================================================
        evoluciones = _fetch_paginated(
            table_name="asesoria_evoluciones",
            select_cols="id, usuario_id, usuario_nombre, tipo_contacto, contenido, created_at",
            iso_inicio=iso_inicio,
            iso_fin=iso_fin,
            date_col="created_at"
        )

        for ev in evoluciones:
            u_nom = ev.get("usuario_nombre")
            u_id = ev.get("usuario_id")
            contenido = (ev.get("contenido") or "").strip()
            canal = (ev.get("tipo_contacto") or "interno").lower()

            # Detectar si es una nota espejo automática de envío de plantilla WhatsApp que ya se cuenta en `mensajes`
            es_espejo_wa = (
                contenido.startswith("Presupuesto médico oficial #")
                or contenido.startswith("Recordatorio prequirúrgico enviado por WhatsApp")
                or contenido.startswith("📲 Consentimiento Informado")
                or contenido.startswith("⏳ Plantilla de Apertura de WhatsApp")
            )
            if es_espejo_wa and (not u_nom or u_nom.lower() in NOMBRES_AUTOMATISMOS_Y_GENERICOS):
                # Se registra en su cuenta de sistema para auditoría, pero no como llamada ni presencial
                c_key = _resolver_colaborador(u_nom or "Asesoramiento Quirúrgico (Sistema)", u_id)
                colaboradores[c_key]["desglose"]["plantillas_wa"] += 1
                colaboradores[c_key]["canales"]["whatsapp"] += 1
                _actualizar_ultima_actividad(c_key, ev.get("created_at"))
                continue

            # Detectar sincronización automática de presupuestos que antes se guardaba como 'presencial'
            es_auto_sync_presupuesto = (
                "marcado como APROBADO automáticamente" in contenido
                or "marcado como OPERADO automáticamente" in contenido
            )
            if es_auto_sync_presupuesto:
                canal = "interno"

            c_key = _resolver_colaborador(u_nom, u_id)
            col = colaboradores[c_key]
            _actualizar_ultima_actividad(c_key, ev.get("created_at"))

            if canal == "llamada":
                col["desglose"]["llamadas"] += 1
                col["canales"]["llamada"] += 1
            elif canal == "presencial":
                col["desglose"]["presencial"] += 1
                col["canales"]["presencial"] += 1
            elif canal == "whatsapp":
                # Si es una nota manual de WhatsApp en la bitácora (no un espejo ya contado en mensajes)
                if not es_espejo_wa:
                    col["desglose"]["mensajes_chat"] += 1
                    col["canales"]["whatsapp"] += 1
            else:
                col["desglose"]["bitacora_interno"] += 1
                col["canales"]["interno"] += 1

        # =========================================================================
        # FUENTE 3: Tabla `estudios_oftalmo` - Técnicos Oftalmólogos
        # =========================================================================
        estudios = _fetch_paginated(
            table_name="estudios_oftalmo",
            select_cols="id, tecnico_nombre, tecnico_usuario_id, whatsapp_status, created_at",
            iso_inicio=iso_inicio,
            iso_fin=iso_fin,
            date_col="created_at"
        )

        for st in estudios:
            tec_nom = (st.get("tecnico_nombre") or "").strip()
            tec_id = st.get("tecnico_usuario_id") if not tec_nom else None
            c_key = _resolver_colaborador(tec_nom or "Técnico No Identificado", tec_id, rol_default="Técnica Oftalmóloga")
            col = colaboradores[c_key]
            
            col["estudios_procesados"] += 1
            col["desglose"]["estudios_procesados"] += 1
            if st.get("whatsapp_status") == "read":
                col["estudios_leidos"] += 1
                col["desglose"]["estudios_leidos"] += 1
            _actualizar_ultima_actividad(c_key, st.get("created_at"))

        # =========================================================================
        # FUENTE 4: Turnos de Quirófano (`usuario_alta`, `lio_calculado_por`) y Logs de Reserva LIO
        # =========================================================================
        turnos_qx = _fetch_paginated(
            table_name="turnos_quirofano",
            select_cols="id, usuario_alta, lio_calculado, lio_calculado_por, lio_calculado_at, created_at",
            iso_inicio=iso_inicio,
            iso_fin=iso_fin,
            date_col="created_at"
        )
        for t in turnos_qx:
            u_alta = t.get("usuario_alta")
            if u_alta:
                c_key = _resolver_colaborador(u_alta, None, rol_default="Programación Quirúrgica")
                colaboradores[c_key]["desglose"]["quirofano_lio"] += 1
                colaboradores[c_key]["canales"]["interno"] += 1
                _actualizar_ultima_actividad(c_key, t.get("created_at"))
            
            lio_por = t.get("lio_calculado_por")
            if t.get("lio_calculado") and lio_por:
                c_key = _resolver_colaborador(lio_por, None, rol_default="Cálculo Biométrico LIO")
                colaboradores[c_key]["desglose"]["quirofano_lio"] += 1
                colaboradores[c_key]["canales"]["interno"] += 1
                _actualizar_ultima_actividad(c_key, t.get("lio_calculado_at") or t.get("created_at"))

        # Consultar reservas de stock LIO en system_logs
        try:
            logs_lio = supabase.table("system_logs")\
                .select("accion, detalles, created_at")\
                .eq("accion", "RESERVA_STOCK_LIO")\
                .gte("created_at", iso_inicio)\
                .lte("created_at", iso_fin)\
                .execute()
            for lg in (logs_lio.data or []):
                det = lg.get("detalles") or {}
                usr_lio = det.get("usuario") if isinstance(det, dict) else None
                if usr_lio:
                    c_key = _resolver_colaborador(usr_lio, None, rol_default="Farmacéutica / Gestión de LIOs")
                    colaboradores[c_key]["desglose"]["quirofano_lio"] += 1
                    colaboradores[c_key]["canales"]["interno"] += 1
                    _actualizar_ultima_actividad(c_key, lg.get("created_at"))
        except Exception:
            pass

        # =========================================================================
        # CONSOLIDACIÓN FINAL DE TOTALES POR USUARIO
        # =========================================================================
        for col in colaboradores.values():
            d = col["desglose"]
            total_u = (
                d["mensajes_chat"]
                + d["plantillas_wa"]
                + d["chats_tomados"]
                + d["casos_finalizados"]
                + d["derivaciones_chat"]
                + d["llamadas"]
                + d["presencial"]
                + d["bitacora_interno"]
                + d["estudios_procesados"]
                + d["quirofano_lio"]
            )
            col["acciones_totales"] = total_u
            col["contactos_totales"] = total_u

        # Ordenar de mayor a menor actividad
        ranking_usuarios = sorted(
            colaboradores.values(),
            key=lambda x: (1 if x["es_humano"] else 0, x["acciones_totales"]),
            reverse=True
        )

        # Calcular totales separando Personal Clínico Humano vs Global (con Automatismos)
        usuarios_humanos = [u for u in ranking_usuarios if u["es_humano"]]

        def _sumar_metricas_grupo(lista: List[Dict[str, Any]]) -> Dict[str, Any]:
            return {
                "acciones_totales": sum(u["acciones_totales"] for u in lista),
                "whatsapp_total": sum(u["canales"]["whatsapp"] for u in lista),
                "mensajes_chat": sum(u["desglose"]["mensajes_chat"] for u in lista),
                "plantillas_wa": sum(u["desglose"]["plantillas_wa"] for u in lista),
                "presupuestos_wa": sum(u["desglose"]["presupuestos_wa"] for u in lista),
                "llamadas": sum(u["desglose"]["llamadas"] for u in lista),
                "presencial": sum(u["desglose"]["presencial"] for u in lista),
                "casos_finalizados": sum(u["desglose"]["casos_finalizados"] for u in lista),
                "chats_tomados": sum(u["desglose"]["chats_tomados"] for u in lista),
                "bitacora_interno": sum(u["desglose"]["bitacora_interno"] for u in lista),
                "estudios_procesados": sum(u["desglose"]["estudios_procesados"] for u in lista),
                "quirofano_lio": sum(u["desglose"]["quirofano_lio"] for u in lista)
            }

        metricas_humanos = _sumar_metricas_grupo(usuarios_humanos)
        metricas_todos = _sumar_metricas_grupo(ranking_usuarios)

        # Mantener `canales_totales` y `total_acciones` apuntando al Personal Clínico por defecto
        canales_totales = {
            "whatsapp": metricas_humanos["whatsapp_total"],
            "llamada": metricas_humanos["llamadas"],
            "presencial": metricas_humanos["presencial"],
            "interno": metricas_humanos["bitacora_interno"] + metricas_humanos["chats_tomados"] + metricas_humanos["casos_finalizados"]
        }

        res = {
            "periodo": {
                "dias": dias,
                "inicio": iso_inicio,
                "fin": iso_fin
            },
            "total_acciones": metricas_humanos["acciones_totales"],
            "canales_totales": canales_totales,
            "resumen_humanos": metricas_humanos,
            "resumen_incluyendo_sistema": metricas_todos,
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
