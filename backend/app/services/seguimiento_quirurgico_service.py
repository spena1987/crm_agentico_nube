"""
Servicio de Seguimiento Automatizado a Casos Quirúrgicos y Análisis de Causas
Implementa las cadencias de recontacto asistido, detección de desestimiento/snooze,
registro en expediente quirúrgico y agregación de Pareto de objeciones.
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import Dict, Any, List, Optional
import os
import requests

from app.db import supabase, crear_evolucion_asesoria
from app.whatsapp import whatsapp_manager
from app.services.whatsapp_cloud.client import get_whatsapp_cloud_credentials
from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164

logger = logging.getLogger("seguimiento_quirurgico")

# Plantillas oficiales aprobadas en Meta para la cadencia de seguimiento
PLANTILLAS_SEGUIMIENTO = {
    "cadencia_a_t1": "seguimiento_asesoramiento_t1",  # D+3
    "cadencia_a_t2": "seguimiento_asesoramiento_t2",  # D+8
    "cadencia_a_t3": "seguimiento_asesoramiento_t3",  # D+18
    "cadencia_b_t1": "seguimiento_analisis_t1",        # D+2
    "cadencia_b_t2": "seguimiento_analisis_t2",        # D+6
    "cadencia_b_t3": "seguimiento_analisis_t3",        # D+13 (aviso 48h antes de vencer arancel)
    "cadencia_b_t4": "seguimiento_analisis_t4",        # D+25 (cierre suave / break-up)
}

# Configuración de días de cadencia según estado
CADENCIAS_CONFIG = {
    "en_asesoramiento": [
        {"toque": 1, "dias": 3, "plantilla": "seguimiento_asesoramiento_t1", "tipo": "asesoramiento"},
        {"toque": 2, "dias": 8, "plantilla": "seguimiento_asesoramiento_t2", "tipo": "asesoramiento"},
        {"toque": 3, "dias": 18, "plantilla": "seguimiento_asesoramiento_t3", "tipo": "asesoramiento"}
    ],
    "en_analisis": [
        {"toque": 1, "dias": 2, "plantilla": "seguimiento_analisis_t1", "tipo": "analisis"},
        {"toque": 2, "dias": 6, "plantilla": "seguimiento_analisis_t2", "tipo": "analisis"},
        {"toque": 3, "dias": 13, "plantilla": "seguimiento_analisis_t3", "tipo": "analisis"},
        {"toque": 4, "dias": 25, "plantilla": "seguimiento_analisis_t4", "tipo": "analisis"}
    ]
}


def evaluar_y_ejecutar_seguimiento_automatizado() -> Dict[str, Any]:
    """
    Cron / Tarea periódica que escanea todas las asesorías en 'en_asesoramiento' y 'en_analisis'.
    Si cumplen el tiempo de inactividad, no están en snooze y tienen seguimiento activo,
    dispara el siguiente toque por WhatsApp.
    """
    sb = supabase
    if not sb:
        return {"error": "Base de datos no conectada", "procesados": 0}

    # 0. Pre-flight: Verificar Switch Maestro Global en Ajustes
    try:
        from app.db import get_configuracion_quirurgica
        conf_q = get_configuracion_quirurgica()
        if conf_q.get("seguimiento_automatizado_activo", True) is False:
            logger.info("⏸️ [Seguimiento Auto] Automatismo global desactivado en Ajustes. Escaneo abortado.")
            return {
                "status": "pausado_globalmente",
                "procesados": 0,
                "mensaje": "El automatismo de seguimiento está desactivado globalmente en Ajustes."
            }
    except Exception as e_conf:
        logger.warning(f"Error consultando switch maestro de seguimiento: {e_conf}")

    ahora = datetime.now(timezone.utc)
    hoy_fecha_str = ahora.strftime("%Y-%m-%d")
    resultados = {
        "evaluados": 0,
        "enviados": 0,
        "reactivados_snooze": 0,
        "ignorados_snooze": 0,
        "desactivados": 0,
        "detalles": []
    }

    try:
        # 1. Obtener casos quirúrgicos potencialmente elegibles
        # Filtramos por estado y seguimiento_auto_activo = true
        resp = sb.table("asesorias_quirurgicas")\
            .select("*, pacientes(*)")\
            .in_("estado", ["en_asesoramiento", "en_analisis"])\
            .execute()

        casos = resp.data or []
        resultados["evaluados"] = len(casos)

        for caso in casos:
            caso_id = caso.get("id")
            estado = caso.get("estado")
            seguimiento_activo = caso.get("seguimiento_auto_activo", True)
            etapa_actual = caso.get("seguimiento_etapa") or 0
            ultimo_toque_str = caso.get("seguimiento_ultimo_toque_at")
            snooze_hasta = caso.get("snooze_hasta")
            paciente = caso.get("pacientes") or {}
            telefono = paciente.get("telefono")
            nombre_paciente = paciente.get("nombre") or "Estimado/a"

            if not seguimiento_activo:
                continue

            # Verificar Snooze (Pausa programada)
            if snooze_hasta:
                if snooze_hasta > hoy_fecha_str:
                    # Sigue dormido
                    resultados["ignorados_snooze"] += 1
                    continue
                else:
                    # Despertó de snooze hoy o antes
                    sb.table("asesorias_quirurgicas").update({
                        "snooze_hasta": None,
                        "seguimiento_estado_actual": "reactivado"
                    }).eq("id", caso_id).execute()
                    resultados["reactivados_snooze"] += 1
                    # Se reanuda la cadencia

            cadencia = CADENCIAS_CONFIG.get(estado, [])
            siguiente_toque_num = etapa_actual + 1

            # Si ya se completaron los toques de esta cadencia
            if siguiente_toque_num > len(cadencia):
                continue

            regla_toque = cadencia[siguiente_toque_num - 1]
            dias_requeridos = regla_toque["dias"]
            plantilla_nombre = regla_toque["plantilla"]

            # Calcular fecha de referencia para los días transcurridos
            # Si hubo último toque, medimos desde ahí; si no, desde updated_at o created_at
            fecha_ref_str = ultimo_toque_str or caso.get("updated_at") or caso.get("created_at")
            if not fecha_ref_str:
                continue

            try:
                # Truncar o parsear ISO timezone
                fecha_ref = datetime.fromisoformat(fecha_ref_str.replace("Z", "+00:00"))
            except Exception:
                fecha_ref = ahora

            dias_transcurridos = (ahora - fecha_ref).total_seconds() / 86400.0

            if dias_transcurridos >= dias_requeridos:
                # Cumple condición para disparar el toque
                if not telefono:
                    logger.warning(f"Caso {caso_id} no tiene teléfono válido para seguimiento")
                    continue

                # Preparar parámetros dinámicos según plantilla
                procedimiento = caso.get("procedimiento") or caso.get("practica_nombre") or "su procedimiento"
                
                # Obtener presupuesto si está en análisis
                if estado == "en_analisis":
                    resp_presu = sb.table("presupuestos")\
                        .select("*")\
                        .eq("asesoria_id", caso_id)\
                        .order("created_at", desc=True)\
                        .limit(1)\
                        .execute()
                    if resp_presu.data:
                        presu = resp_presu.data[0]
                        # Podríamos agregar detalles del presupuesto si la plantilla lo usa

                exito_envio = enviar_toque_seguimiento_whatsapp(
                    telefono=telefono,
                    nombre_paciente=nombre_paciente,
                    plantilla_nombre=plantilla_nombre,
                    procedimiento=procedimiento,
                    toque_num=siguiente_toque_num,
                    caso_id=caso_id
                )

                if exito_envio:
                    # Actualizar estado de seguimiento en asesorias_quirurgicas
                    sb.table("asesorias_quirurgicas").update({
                        "seguimiento_etapa": siguiente_toque_num,
                        "seguimiento_ultimo_toque_at": ahora.isoformat(),
                        "seguimiento_estado_actual": "en_curso"
                    }).eq("id", caso_id).execute()

                    # Registrar hito en la bitácora oficial de evoluciones del expediente quirúrgico
                    nota_log = (
                        f"🤖 [Seguimiento Auto] Enviado Toque #{siguiente_toque_num} ({plantilla_nombre}) "
                        f"tras {int(dias_transcurridos)} días de inactividad."
                    )
                    try:
                        crear_evolucion_asesoria(caso_id, nota_log, autor="Bot Seguimiento")
                    except Exception as ev_err:
                        logger.warning(f"No se pudo registrar evolución para caso {caso_id}: {ev_err}")

                    resultados["enviados"] += 1
                    resultados["detalles"].append({
                        "caso_id": caso_id,
                        "paciente": nombre_paciente,
                        "toque": siguiente_toque_num,
                        "plantilla": plantilla_nombre,
                        "estado": "enviado"
                    })

        return resultados

    except Exception as e:
        logger.error(f"Error evaluando seguimiento automatizado: {e}", exc_info=True)
        return {"error": str(e), "evaluados": resultados["evaluados"]}


def _enviar_plantilla_meta_sync(
    telefono: str,
    template_name: str,
    parametros_body: List[Dict[str, Any]],
    language_code: str = "es_AR"
) -> Dict[str, Any]:
    creds = get_whatsapp_cloud_credentials()
    if isinstance(creds, (tuple, list)):
        phone_number_id = creds[0] if len(creds) > 0 else None
        access_token = creds[1] if len(creds) > 1 else None
    elif isinstance(creds, dict):
        phone_number_id = creds.get("phone_number_id")
        access_token = creds.get("access_token")
    else:
        phone_number_id, access_token = None, None

    if not phone_number_id or not access_token:
        return {"error": "Sin credenciales de WhatsApp Cloud configuradas"}

    to_norm = normalize_to_meta_e164(telefono)
    if not to_norm:
        return {"error": f"Teléfono inválido: {telefono}"}

    url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_norm,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": [
                {
                    "type": "body",
                    "parameters": parametros_body
                }
            ]
        }
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=15)
    data = resp.json() if resp.content else {}
    if resp.status_code not in (200, 201) or "error" in data:
        return {"error": data.get("error", f"HTTP {resp.status_code}")}
    return data


def enviar_toque_seguimiento_whatsapp(
    telefono: str,
    nombre_paciente: str,
    plantilla_nombre: str,
    procedimiento: str,
    toque_num: int,
    caso_id: str
) -> bool:
    """
    Envía una plantilla de seguimiento oficial de WhatsApp Cloud API.
    Si la plantilla específica falla (por no aprobación en Meta), recurre a un mensaje estructurado
    o fallback a plantilla genérica de contacto.
    """
    try:
        primer_nombre = nombre_paciente.split()[0] if nombre_paciente else "Estimado/a"
        # Formatear parámetros del body según la plantilla
        # Todas las plantillas de seguimiento toman {{1}}: nombre_paciente, {{2}}: procedimiento
        parametros_body = [
            {"type": "text", "text": primer_nombre},
            {"type": "text", "text": procedimiento[:40]}
        ]

        logger.info(f"Enviando toque #{toque_num} al paciente {nombre_paciente} ({telefono}) con plantilla {plantilla_nombre}")

        # Intentar envío con plantilla oficial
        res = _enviar_plantilla_meta_sync(
            telefono=telefono,
            template_name=plantilla_nombre,
            parametros_body=parametros_body,
            language_code="es_AR"
        )

        if res and not res.get("error"):
            return True

        # Si hubo error (ej. plantilla no aprobada aún en Meta), intentar con template genérico de apertura
        logger.warning(f"Fallo envío de plantilla {plantilla_nombre}: {res}. Intentando fallback.")
        
        res_fallback = _enviar_plantilla_meta_sync(
            telefono=telefono,
            template_name="apertura_conversacion",
            parametros_body=[
                {"type": "text", "text": primer_nombre},
                {"type": "text", "text": f"su consulta sobre {procedimiento[:30]}"}
            ],
            language_code="es_AR"
        )
        if res_fallback and not res_fallback.get("error"):
            return True

        # Último fallback si la ventana de 24hs estuviera abierta
        msg_texto = (
            f"Hola {primer_nombre}, nos comunicamos del área de Asesoría Quirúrgica de Clínica de la Visión "
            f"para saber si pudiste evaluar la información sobre {procedimiento} o si tenés alguna duda en la que podamos ayudarte."
        )
        res_txt = whatsapp_manager.enviar_mensaje(telefono, msg_texto)
        return bool(res_txt and res_txt.get("status") in ("sent", "queued", "simulated", "ok") and not res_txt.get("error"))

    except Exception as e:
        logger.error(f"Excepción enviando toque de seguimiento a {telefono}: {e}")
        return False


def procesar_respuesta_interactiva_seguimiento(
    payload_boton: str,
    telefono: str,
    texto_usuario: Optional[str] = None
) -> Dict[str, Any]:
    """
    Procesa un clic en botón interactivo de WhatsApp o respuesta del paciente.
    Payloads soportados:
    - CASO_CONFIRMAR_{caso_id}
    - CASO_SNOOZE_{caso_id}_{dias}  (ej: CASO_SNOOZE_uuid_30)
    - CASO_DESISTIR_{caso_id}_{causa} (ej: CASO_DESISTIR_uuid_economico)
    - CASO_OBJECION_{caso_id}_{tipo}
    """
    sb = supabase
    if not sb:
        return {"error": "Sin base de datos"}

    ahora = datetime.now(timezone.utc)
    partes = payload_boton.split("_")
    accion = partes[1] if len(partes) > 1 else ""

    logger.info(f"Procesando acción interactiva de seguimiento: {payload_boton} para tel {telefono}")

    if accion == "CONFIRMAR":
        caso_id = partes[2] if len(partes) > 2 else None
        if not caso_id:
            return {"error": "ID de caso no especificado"}

        # 1. Pasar caso a confirmado
        sb.table("asesorias_quirurgicas").update({
            "estado": "confirmado",
            "seguimiento_auto_activo": False,
            "seguimiento_estado_actual": "convertido",
            "canal_resolucion": "whatsapp_bot"
        }).eq("id", caso_id).execute()

        # 2. Si tiene presupuesto en_analisis o emitido, pasarlo a aprobado
        sb.table("presupuestos").update({
            "estado": "aprobado",
            "canal_resolucion": "whatsapp_bot"
        }).eq("asesoria_id", caso_id).in_("estado", ["en_analisis", "emitido"]).execute()

        # Enviar confirmación cordial
        msg = "¡Excelente noticia! 🎉 Hemos registrado tu confirmación. Tu asesora quirúrgica te contactará a la brevedad para coordinar la fecha quirúrgica y los estudios prequirúrgicos."
        whatsapp_manager.enviar_mensaje(telefono, msg)
        return {"status": "success", "accion": "confirmado", "caso_id": caso_id}

    elif accion == "SNOOZE":
        caso_id = partes[2] if len(partes) > 2 else None
        dias = int(partes[3]) if len(partes) > 3 and partes[3].isdigit() else 30

        if not caso_id:
            return {"error": "ID de caso no especificado"}

        fecha_reactivacion = (ahora + timedelta(days=dias)).strftime("%Y-%m-%d")

        sb.table("asesorias_quirurgicas").update({
            "snooze_hasta": fecha_reactivacion,
            "seguimiento_estado_actual": "snooze",
            "motivo_demora": f"Pospuesto {dias} días a pedido del paciente"
        }).eq("id", caso_id).execute()

        msg = f"Entendido perfectamente. Hemos pausado los recordatorios y nos volveremos a contactar en {dias} días para retomar cuando te quede más cómodo. ¡Que tengas un excelente día!"
        whatsapp_manager.enviar_mensaje(telefono, msg)
        return {"status": "success", "accion": "snooze", "snooze_hasta": fecha_reactivacion}

    elif accion == "DESISTIR":
        caso_id = partes[2] if len(partes) > 2 else None
        causa = partes[3] if len(partes) > 3 else "otros"

        if not caso_id:
            return {"error": "ID de caso no especificado"}

        # Cerrar caso quirúrgico como cancelado/desistido
        sb.table("asesorias_quirurgicas").update({
            "estado": "cancelado",
            "seguimiento_auto_activo": False,
            "seguimiento_estado_actual": "desistido",
            "categoria_causa": causa,
            "motivo_demora": texto_usuario or f"Desistimiento informado por el paciente ({causa})",
            "canal_resolucion": "whatsapp_bot"
        }).eq("id", caso_id).execute()

        # Si hay presupuestos activos, marcarlos como rechazados
        sb.table("presupuestos").update({
            "estado": "rechazado",
            "categoria_objecion": causa,
            "canal_resolucion": "whatsapp_bot"
        }).eq("asesoria_id", caso_id).in_("estado", ["en_analisis", "emitido"]).execute()

        msg = "Muchas gracias por informarnos. Dejamos el caso cerrado en nuestro sistema. Quedamos a tu entera disposición ante cualquier consulta futura."
        whatsapp_manager.enviar_mensaje(telefono, msg)
        return {"status": "success", "accion": "desistido", "causa": causa}

    return {"status": "ignorado", "motivo": "Payload no reconocido"}


def actualizar_control_seguimiento(
    caso_id: str,
    activo: bool,
    snooze_dias: Optional[int] = None,
    snooze_hasta: Optional[str] = None,
    categoria_causa: Optional[str] = None,
    motivo_demora: Optional[str] = None
) -> Dict[str, Any]:
    """
    Endpoint backend para que la asesora quirúrgica pause, reanude, posponga (snooze)
    o tipifique la causa del caso quirúrgico desde el expediente en la UI.
    """
    sb = supabase
    if not sb:
        return {"error": "Sin base de datos"}

    update_payload: Dict[str, Any] = {
        "seguimiento_auto_activo": activo
    }

    if snooze_hasta:
        update_payload["snooze_hasta"] = snooze_hasta
        update_payload["seguimiento_estado_actual"] = "snooze"
    elif snooze_dias:
        nueva_fecha = (datetime.now(timezone.utc) + timedelta(days=snooze_dias)).strftime("%Y-%m-%d")
        update_payload["snooze_hasta"] = nueva_fecha
        update_payload["seguimiento_estado_actual"] = "snooze"
    elif activo and snooze_hasta is None and snooze_dias is None:
        # Si se reactiva limpiando snooze
        update_payload["snooze_hasta"] = None
        update_payload["seguimiento_estado_actual"] = "en_curso"

    if categoria_causa:
        update_payload["categoria_causa"] = categoria_causa
    if motivo_demora:
        update_payload["motivo_demora"] = motivo_demora

    resp = sb.table("asesorias_quirurgicas").update(update_payload).eq("id", caso_id).execute()
    return {"status": "success", "data": resp.data}


def obtener_analitica_causas_pareto() -> Dict[str, Any]:
    """
    Calcula la distribución de causas de demora/desistimiento para el Diagrama de Pareto,
    tanto a nivel de Asesorías Quirúrgicas como de Presupuestos Rechazados.
    """
    sb = supabase
    if not sb:
        return {"error": "Sin base de datos"}

    try:
        # 1. Asesorías cerradas o con causas registradas
        resp_casos = sb.table("asesorias_quirurgicas")\
            .select("id, estado, categoria_causa, motivo_demora, seguimiento_etapa, canal_resolucion")\
            .execute()
        casos = resp_casos.data or []

        # 2. Presupuestos rechazados o con objeción
        resp_presu = sb.table("presupuestos")\
            .select("id, estado, categoria_objecion, toque_resolucion, total, total_ars, total_usd, canal_resolucion")\
            .execute()
        presupuestos = resp_presu.data or []

        conteo_causas_casos: Dict[str, int] = {}
        for c in casos:
            causa = c.get("categoria_causa")
            if causa:
                conteo_causas_casos[causa] = conteo_causas_casos.get(causa, 0) + 1

        conteo_objeciones_presu: Dict[str, int] = {}
        monto_perdido_por_causa_ars: Dict[str, float] = {}
        monto_perdido_por_causa_usd: Dict[str, float] = {}

        for p in presupuestos:
            objecion = p.get("categoria_objecion")
            if objecion:
                conteo_objeciones_presu[objecion] = conteo_objeciones_presu.get(objecion, 0) + 1
                total_ars = float(p.get("total_ars") or p.get("total") or 0)
                total_usd = float(p.get("total_usd") or 0)
                monto_perdido_por_causa_ars[objecion] = monto_perdido_por_causa_ars.get(objecion, 0.0) + total_ars
                monto_perdido_por_causa_usd[objecion] = monto_perdido_por_causa_usd.get(objecion, 0.0) + total_usd

        # Armar lista ordenada para Pareto
        pareto_casos = sorted(
            [{"categoria": k, "cantidad": v} for k, v in conteo_causas_casos.items()],
            key=lambda x: x["cantidad"],
            reverse=True
        )
        total_casos_categorizados = sum(x["cantidad"] for x in pareto_casos) or 1
        acum = 0
        for item in pareto_casos:
            acum += item["cantidad"]
            item["porcentaje"] = round((item["cantidad"] / total_casos_categorizados) * 100, 1)
            item["porcentaje_acumulado"] = round((acum / total_casos_categorizados) * 100, 1)

        pareto_presupuestos = sorted(
            [
                {
                    "categoria": k,
                    "cantidad": v,
                    "monto_ars": monto_perdido_por_causa_ars.get(k, 0.0),
                    "monto_usd": monto_perdido_por_causa_usd.get(k, 0.0)
                }
                for k, v in conteo_objeciones_presu.items()
            ],
            key=lambda x: x["cantidad"],
            reverse=True
        )
        total_presu_categorizados = sum(x["cantidad"] for x in pareto_presupuestos) or 1
        acum_p = 0
        for item in pareto_presupuestos:
            acum_p += item["cantidad"]
            item["porcentaje"] = round((item["cantidad"] / total_presu_categorizados) * 100, 1)
            item["porcentaje_acumulado"] = round((acum_p / total_presu_categorizados) * 100, 1)

        return {
            "pareto_casos": pareto_casos,
            "total_casos_categorizados": total_casos_categorizados if total_casos_categorizados > 1 or conteo_causas_casos else 0,
            "pareto_presupuestos": pareto_presupuestos,
            "total_presupuestos_categorizados": total_presu_categorizados if total_presu_categorizados > 1 or conteo_objeciones_presu else 0
        }

    except Exception as e:
        logger.error(f"Error generando analítica de Pareto: {e}", exc_info=True)
        return {"error": str(e)}


async def despachar_consentimiento_informado_inteligente(
    turno_id: Optional[str] = None,
    asesoria_id: Optional[str] = None,
    operador_nombre: Optional[str] = None,
    forzar_plantilla: bool = False,
    ojo_objetivo: Optional[str] = None
) -> Dict[str, Any]:
    """
    Enrutador Inteligente (Smart Template Router) para Consentimientos Informados de WhatsApp.
    1. Si es bilateral escalonada y se pasa 'ambos', despacha ambos actos quirúrgicos secuencialmente.
    2. Si se especifica ojo_objetivo ('primer_ojo', 'segundo_ojo', 'OD', 'OI'), despacha el turno correspondiente a ese acto.
    3. Si la ventana de 24h de Meta está abierta, intenta texto libre con enlace directo.
       Si Meta rechaza por ventana cerrada (error 131047 / 131026), conmuta automáticamente a la plantilla oficial.
    4. Si la ventana de 24h está cerrada, despacha directamente 'consentimiento_informado_quirurgico_v1'.
    """
    import re
    import secrets
    from datetime import datetime, timezone, timedelta
    from app.db import (
        asegurar_turno_para_consentimiento_asesoria,
        asegurar_turnos_para_consentimiento_asesoria,
        get_turno_quirofano_by_id,
        actualizar_turno_quirofano,
        check_patient_24h_window,
        registrar_envio_consentimiento_quirurgico
    )
    from app.services.whatsapp_cloud.client import (
        WhatsAppCloudClient,
        get_whatsapp_cloud_credentials,
        ConversationWindowClosedError
    )
    from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164

    # Manejo de despacho para ambos ojos si se solicita 'ambos'
    if asesoria_id and not turno_id and (ojo_objetivo or "").lower() in ["ambos", "ambos_ojos", "ao"]:
        info_dual = asegurar_turnos_para_consentimiento_asesoria(asesoria_id)
        if info_dual.get("es_bilateral_escalonada"):
            tid1 = (info_dual.get("primer_ojo") or {}).get("turno_id")
            tid2 = (info_dual.get("segundo_ojo") or {}).get("turno_id")
            res1 = await despachar_consentimiento_informado_inteligente(turno_id=tid1, operador_nombre=operador_nombre, forzar_plantilla=forzar_plantilla) if tid1 else None
            res2 = await despachar_consentimiento_informado_inteligente(turno_id=tid2, operador_nombre=operador_nombre, forzar_plantilla=forzar_plantilla) if tid2 else None
            return {
                "success": bool(res1 and res1.get("success")),
                "ok": True,
                "mensaje": "Consentimientos informados de ambos ojos despachados por WhatsApp.",
                "despacho_primer_ojo": res1,
                "despacho_segundo_ojo": res2
            }

    # 1. Resolver Turno y Asesoría
    turno = None
    t_id = turno_id
    as_id = asesoria_id

    if as_id and not t_id:
        info_dual = asegurar_turnos_para_consentimiento_asesoria(as_id)
        if info_dual.get("es_bilateral_escalonada"):
            obj_l = (ojo_objetivo or "primer_ojo").lower()
            p2 = info_dual.get("segundo_ojo") or {}
            p2_ojo = (p2.get("ojo") or "OI").lower()
            if obj_l in ["segundo_ojo", "2do_ojo", p2_ojo] and p2.get("turno_id"):
                t_id = p2["turno_id"]
                turno = get_turno_quirofano_by_id(t_id)
            else:
                p1 = info_dual.get("primer_ojo") or {}
                t_id = p1.get("turno_id")
                if t_id:
                    turno = get_turno_quirofano_by_id(t_id)
        else:
            turno = asegurar_turno_para_consentimiento_asesoria(as_id)
            if turno:
                t_id = turno.get("id")
    elif t_id:
        turno = get_turno_quirofano_by_id(t_id)
        if turno and turno.get("asesoria_id") and not as_id:
            as_id = turno["asesoria_id"]

    if not turno or not t_id:
        raise ValueError("No se pudo identificar un turno quirúrgico válido para despachar el consentimiento.")

    # 2. Resolver Paciente y Teléfono
    paciente = turno.get("pacientes") or {}
    paciente_id = paciente.get("id") or turno.get("paciente_id")
    telefono = paciente.get("telefono")

    if not telefono and paciente_id and supabase:
        try:
            p_res = supabase.table("pacientes").select("id, nombre, telefono").eq("id", paciente_id).limit(1).execute()
            if p_res.data and len(p_res.data) > 0:
                paciente = p_res.data[0]
                telefono = paciente.get("telefono")
        except Exception as e_pac:
            logger.warning(f"Error consultando datos de paciente {paciente_id}: {e_pac}")

    if not telefono or len(str(telefono).strip()) < 8:
        raise ValueError(f"El paciente {paciente.get('nombre') or ''} no tiene un teléfono válido registrado para WhatsApp.")

    # 3. Token y enlace de firma seguro
    token = turno.get("consentimiento_token")
    if not token:
        token = secrets.token_urlsafe(24)
        actualizar_turno_quirofano(t_id, {"consentimiento_token": token})
        turno["consentimiento_token"] = token

    try:
        from app.services.urgencias_service import obtener_base_crm_url
        base_app_url = obtener_base_crm_url()
    except Exception:
        base_app_url = os.getenv("NEXT_PUBLIC_APP_URL") or os.getenv("APP_URL") or "https://crm-agentico-nube.vercel.app"
    enlace_firma = f"{base_app_url.rstrip('/')}/consentimiento/{token}"

    # 4. Formateo y sanitización estricta para Meta (Error #132018)
    def _sanitize(val: Any, fallback: str = "", max_len: int = 120) -> str:
        s = str(val or fallback).strip()
        s = re.sub(r"[\r\n\t]+", " ", s)
        s = re.sub(r"\s{2,}", " ", s).strip()
        return s[:max_len].strip()

    p_nombre = _sanitize(paciente.get("nombre"), "Estimado/a", 60)

    ojo = turno.get("ojo") or "OD"
    ojo_desc = "Ojo Derecho" if ojo == "OD" else "Ojo Izquierdo" if ojo == "OI" else "Ambos Ojos"
    practica_base = turno.get("practica_nombre") or "Cirugía Oftalmológica"
    if "ojo" not in practica_base.lower() and "od" not in practica_base.lower() and "oi" not in practica_base.lower():
        p_cirugia = _sanitize(f"{practica_base} ({ojo_desc})", "Cirugía Oftalmológica", 80)
    else:
        p_cirugia = _sanitize(practica_base, "Cirugía Oftalmológica", 80)

    # Formateo amigable de fecha y hora
    fecha_raw = str(turno.get("fecha_cirugia") or "").strip()
    fecha_bonita = fecha_raw
    if "-" in fecha_raw and len(fecha_raw) == 10:
        partes = fecha_raw.split("-")
        if len(partes) == 3:
            fecha_bonita = f"{partes[2]}/{partes[1]}/{partes[0]}"

    hora_raw = str(turno.get("hora_inicio") or "").strip()[:5]
    if hora_raw:
        fecha_str = f"{fecha_bonita} a las {hora_raw} hs"
    else:
        fecha_str = fecha_bonita or "a coordinar"
    p_fecha = _sanitize(fecha_str, "a coordinar", 50)

    p_cirujano = _sanitize(turno.get("cirujano_nombre"), "Médico Cirujano", 60)
    p_enlace = str(enlace_firma).strip()

    # 5. Evaluar Ventana de 24 horas
    win_info = check_patient_24h_window(paciente_id, telefono)
    is_window_open = bool(win_info.get("is_open", False))

    cuerpo_texto_libre = (
        f"Hola {p_nombre}! 🩺 Te escribimos de Clínica Médica Nube respecto a tu cirugía de {p_cirugia} "
        f"programada para el {p_fecha} con el Dr/a. {p_cirujano}. "
        f"Para que puedas leerlo con tranquilidad en familia y firmarlo digitalmente desde tu celular, "
        f"te compartimos tu Consentimiento Informado oficial:\n{p_enlace}\n\n"
        f"Si prefieres firmarlo en papel el día de tu ingreso en la clínica, no hay ningún problema. ¡Quedamos a tu entera disposición!"
    )

    modo_utilizado = "template"
    template_name = "consentimiento_informado_quirurgico_v1"
    wamid = None
    texto_para_historial = cuerpo_texto_libre

    phone_id, token_waba = get_whatsapp_cloud_credentials()
    norm_to = normalize_to_meta_e164(telefono) or telefono

    # Si la ventana está abierta y no se fuerza plantilla, intentar texto libre
    if is_window_open and not forzar_plantilla:
        logger.info(f"Ventana 24h abierta para {p_nombre} ({telefono}). Intentando envío de texto libre...")
        try:
            if phone_id and token_waba:
                client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token_waba)
                try:
                    res_ft = await client.send_free_text(norm_to, cuerpo_texto_libre)
                    wamid = res_ft.get("wamid")
                    modo_utilizado = "free_text"
                    template_name = None
                finally:
                    await client.close()
            else:
                # Simulación o WhatsApp Web manager fallback
                res_mgr = whatsapp_manager.enviar_mensaje(telefono, cuerpo_texto_libre)
                if res_mgr and res_mgr.get("status") in ("sent", "queued", "simulated", "ok"):
                    modo_utilizado = "free_text"
                    template_name = None
                    wamid = res_mgr.get("id") or f"wa_{secrets.token_hex(8)}"
                else:
                    raise ConversationWindowClosedError(131047, None, "Ventana cerrada o rechazo", None)
        except (ConversationWindowClosedError, Exception) as e_ft:
            logger.warning(f"Envío de texto libre no exitoso ({e_ft}). Activando Smart Template Router a 'consentimiento_informado_quirurgico_v1'...")
            modo_utilizado = "template"
            template_name = "consentimiento_informado_quirurgico_v1"

    # Si corresponde enviar plantilla oficial de Meta
    if modo_utilizado == "template":
        logger.info(f"Enrutando a plantilla oficial Meta '{template_name}' para {p_nombre} ({telefono}).")
        body_params = [
            {"type": "text", "text": p_nombre},
            {"type": "text", "text": p_cirugia},
            {"type": "text", "text": p_fecha},
            {"type": "text", "text": p_cirujano},
            {"type": "text", "text": p_enlace}
        ]

        if phone_id and token_waba:
            client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token_waba)
            try:
                res_tpl = await client.send_template(
                    to_phone=norm_to,
                    template_name=template_name,
                    language_code="es_AR",
                    components=[{"type": "body", "parameters": body_params}]
                )
                wamid = res_tpl.get("wamid")
            except Exception as e_tpl:
                logger.error(f"Error al enviar plantilla oficial Meta {template_name}: {e_tpl}")
                # Fallback síncrono si el cliente HTTP falló
                res_sync = _enviar_plantilla_meta_sync(
                    telefono=telefono,
                    template_name=template_name,
                    parametros_body=body_params,
                    language_code="es_AR"
                )
                if res_sync and not res_sync.get("error"):
                    wamid = (res_sync.get("messages") or [{}])[0].get("id")
                else:
                    raise RuntimeError(f"Fallo al despachar plantilla oficial de Meta: {res_sync.get('error') or e_tpl}")
            finally:
                await client.close()
        else:
            # Entorno sin credenciales Meta (dev / test) -> simulación exitosa
            logger.info(f"Simulando despacho de plantilla oficial Meta '{template_name}' en entorno sin credenciales.")
            wamid = f"sim_wamid_{secrets.token_hex(10)}"

        texto_para_historial = (
            f"📄 [PLANTILLA OFICIAL META: Consentimiento Informado Quirúrgico]\n"
            f"Hola {p_nombre}, confirmamos tu turno de cirugía de {p_cirugia} para el día {p_fecha} con el Dr/a. {p_cirujano}.\n"
            f"Por favor, revisá y firmá tu Consentimiento Informado en tu celular desde el siguiente enlace seguro:\n{p_enlace}"
        )

    # 6. Registrar en Base de Datos, bitácora y mensajes
    registrar_envio_consentimiento_quirurgico(
        turno_id=t_id,
        asesoria_id=as_id,
        paciente_id=paciente_id or "",
        telefono=telefono,
        modo_envio=modo_utilizado,
        enlace_firma=p_enlace,
        token=token,
        template_name=template_name,
        wamid=wamid,
        usuario_nombre=operador_nombre or "Automatismo CRM",
        texto_renderizado=texto_para_historial
    )

    return {
        "success": True,
        "ok": True,
        "modo_utilizado": modo_utilizado,
        "template_name": template_name,
        "wamid": wamid,
        "enlace_firma": p_enlace,
        "telefono": telefono,
        "mensaje": f"Consentimiento Informado enviado por WhatsApp exitosamente ({'Plantilla Oficial Meta' if modo_utilizado == 'template' else 'Texto Libre'}).",
        "estado": "enviado_whatsapp"
    }
