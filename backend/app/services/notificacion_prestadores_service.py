import logging
import re
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional, Tuple

from app.db import (
    supabase,
    obtener_prestador_por_cirujano,
    get_configuracion_notificaciones_prestadores,
    registrar_log_notificacion_prestador,
    verificar_envio_previo_prestador
)
from app.services.pdf_service import generar_pdf_agenda_prestadores
from app.services.whatsapp_cloud.client import WhatsAppCloudClient

logger = logging.getLogger(__name__)

TZ_BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")

DIAS_SEMANA_ES = {
    0: "Lunes",
    1: "Martes",
    2: "Miércoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sábado",
    6: "Domingo"
}

MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

def formatear_fecha_espanol(fecha: date) -> str:
    """Retorna fecha legible: 'Lunes 10 de Noviembre de 2026'"""
    dia_nom = DIAS_SEMANA_ES.get(fecha.weekday(), "")
    mes_nom = MESES_ES.get(fecha.month, "")
    return f"{dia_nom} {fecha.day} de {mes_nom} de {fecha.year}"

def es_telefono_valido(tel: Optional[str]) -> bool:
    """Verifica si un string contiene al menos 8 dígitos telefónicos."""
    if not tel:
        return False
    digits = re.sub(r'\D', '', str(tel))
    return len(digits) >= 8

def normalizar_telefono_whatsapp(tel: str) -> str:
    """
    Formatea el teléfono para WhatsApp Cloud API.
    Asegura formato internacional con código de país 549 para Argentina.
    """
    digits = re.sub(r'\D', '', str(tel))
    if not digits:
        return ""
    if digits.startswith("0"):
        digits = digits[1:]
    # Remover prefijo celular local '15' tras código de área si estuviera presente
    if len(digits) == 12 and digits[2:4] == "15":
        digits = digits[:2] + digits[4:]
    elif len(digits) == 12 and digits[3:5] == "15":
        digits = digits[:3] + digits[5:]
    elif len(digits) == 12 and digits.startswith("15"):
        digits = digits[2:]

    # Si ya tiene prefijo 549
    if digits.startswith("549"):
        return digits
    # Si tiene 54 sin 9
    if digits.startswith("54"):
        return f"549{digits[2:]}"
    # Si es número argentino de 10 dígitos (ej: 2235123456 o 1151234567)
    if len(digits) == 10:
        return f"549{digits}"
    return digits

def calcular_fecha_objetivo_habiles(
    fecha_base: Optional[date] = None,
    dias_habiles: int = 2,
    incluir_sabados: bool = False
) -> date:
    """
    Calcula la fecha objetivo de cirugías considerando días hábiles quirúrgicos.
    Reglas clínicas de Centrovisión:
    - Viernes a las 19:00 hs: proyecta las cirugías del próximo Lunes (o Sábado si incluir_sabados=True).
    - Jueves a las 19:00 hs: con 2 días hábiles proyecta el Lunes subsiguiente.
    - Lunes, Martes, Miércoles: proyecta T + dias_habiles.
    - Sábado/Domingo: proyecta Lunes o Martes según disponibilidad.
    """
    if fecha_base is None:
        fecha_base = datetime.now(TZ_BUENOS_AIRES).date()

    actual = fecha_base
    dias_sumados = 0
    dias_laborables = [0, 1, 2, 3, 4] # Lunes a Viernes
    if incluir_sabados:
        dias_laborables.append(5)

    # Caso especial de fin de semana para el corte del Viernes:
    if actual.weekday() == 4 and not incluir_sabados:
        # El viernes proyecta directamente el lunes (próximo día hábil de quirófano)
        return actual + timedelta(days=3)

    while dias_sumados < dias_habiles:
        actual += timedelta(days=1)
        if actual.weekday() in dias_laborables:
            dias_sumados += 1

    return actual


class NotificacionPrestadoresService:
    """
    Servicio central de agregación, deduplicación, generación de PDF y despacho
    de agendas quirúrgicas a médicos cirujanos y derivadores por WhatsApp Cloud API.
    """

    @classmethod
    def obtener_cirugias_por_fecha(cls, fecha_cirugia: str) -> List[Dict[str, Any]]:
        """Consulta turnos activos para una fecha determinada en turnos_quirofano con enriquecimiento de pacientes."""
        if not supabase:
            return []
        try:
            resp = supabase.table("turnos_quirofano")\
                .select("*, pacientes(id, nombre, dni, obra_social), quirofanos(nombre, codigo)")\
                .eq("fecha_cirugia", fecha_cirugia)\
                .neq("estado", "cancelado")\
                .order("hora_inicio", desc=False)\
                .execute()
            data = resp.data or []
            for t in data:
                pac = t.get("pacientes") or {}
                if pac:
                    t["paciente_nombre"] = pac.get("nombre") or t.get("paciente_nombre") or "Sin Nombre"
                    t["paciente_dni"] = pac.get("dni") or t.get("paciente_dni") or ""
                q = t.get("quirofanos") or {}
                if q:
                    t["quirofano_nombre"] = q.get("nombre") or t.get("quirofano") or "Q1"
            return data
        except Exception as e:
            logger.error(f"[NotificacionPrestadores] Error consultando turnos para {fecha_cirugia}: {e}")
            return []

    @classmethod
    def clasificar_y_agrupar_destinatarios(cls, turnos: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Agrupa los turnos por prestador resolviendo identidades.
        Si un prestador actúa como cirujano y derivador en el mismo día, se consolida
        en una sola entrada con exactamente 1 fila por cirugía asignada (sin duplicaciones).
        Excluye expresamente turnos asignados a anestesistas o instrumentadores.
        """
        prestadores_map: Dict[str, Dict[str, Any]] = {}

        for t in turnos:
            cirujano_id = t.get("cirujano_id")
            cirujano_nom = t.get("cirujano_nombre")
            derivador_nom = (t.get("medico_derivador_nombre") or "").strip()

            # 1. Procesar rol de Cirujano Principal
            if cirujano_id or cirujano_nom:
                p_cir = obtener_prestador_por_cirujano(cirujano_id, cirujano_nom)
                p_key = str(p_cir.get("id") or p_cir.get("geclisa_pre_id") or cirujano_id or cirujano_nom) if p_cir else (str(cirujano_id) if cirujano_id else cirujano_nom)
                p_nombre = p_cir.get("nombre_apellido") if p_cir else (cirujano_nom or "Médico Cirujano")
                p_tel = p_cir.get("telefono") if p_cir else None

                if p_key not in prestadores_map:
                    prestadores_map[p_key] = {
                        "prestador_id": p_cir.get("id") if p_cir else None,
                        "geclisa_pre_id": p_cir.get("geclisa_pre_id") if p_cir else None,
                        "nombre": p_nombre,
                        "telefono": p_tel,
                        "activo": p_cir.get("activo", True) if p_cir else True,
                        "roles": set(),
                        "cirugias": [],
                        "estado": "LISTO_PARA_ENVIO" if es_telefono_valido(p_tel) else "SIN_TELEFONO"
                    }

                prestadores_map[p_key]["roles"].add("Cirujano Principal")
                turno_cir = dict(t)
                turno_cir["rol_en_turno"] = "Cirujano Principal"
                # Garantizar que una cirugía solo aparezca 1 vez por prestador
                if not any(c.get("id") == t.get("id") for c in prestadores_map[p_key]["cirugias"]):
                    prestadores_map[p_key]["cirugias"].append(turno_cir)

            # 2. Procesar rol de Médico Derivador
            if derivador_nom:
                p_der = obtener_prestador_por_cirujano(None, derivador_nom)
                if p_der:
                    d_key = str(p_der.get("id") or p_der.get("geclisa_pre_id") or derivador_nom)
                    d_nombre = p_der.get("nombre_apellido", derivador_nom)
                    d_tel = p_der.get("telefono")

                    if d_key not in prestadores_map:
                        prestadores_map[d_key] = {
                            "prestador_id": p_der.get("id"),
                            "geclisa_pre_id": p_der.get("geclisa_pre_id"),
                            "nombre": d_nombre,
                            "telefono": d_tel,
                            "activo": p_der.get("activo", True),
                            "roles": set(),
                            "cirugias": [],
                            "estado": "LISTO_PARA_ENVIO" if es_telefono_valido(d_tel) else "SIN_TELEFONO"
                        }

                    prestadores_map[d_key]["roles"].add("Médico Derivador")
                    turno_der = dict(t)
                    turno_der["rol_en_turno"] = "Médico Derivador"
                    # Garantizar que una cirugía solo aparezca 1 vez por prestador
                    if not any(c.get("id") == t.get("id") for c in prestadores_map[d_key]["cirugias"]):
                        prestadores_map[d_key]["cirugias"].append(turno_der)
                else:
                    # Derivador no resoluble en catálogo
                    d_key = f"unresolved_{derivador_nom}"
                    if d_key not in prestadores_map:
                        prestadores_map[d_key] = {
                            "prestador_id": None,
                            "geclisa_pre_id": None,
                            "nombre": derivador_nom,
                            "telefono": None,
                            "activo": False,
                            "roles": {"Médico Derivador"},
                            "cirugias": [],
                            "estado": "DERIVADOR_NO_RESOLUBLE"
                        }
                    turno_der = dict(t)
                    turno_der["rol_en_turno"] = "Médico Derivador (No resuelto)"
                    if not any(c.get("id") == t.get("id") for c in prestadores_map[d_key]["cirugias"]):
                        prestadores_map[d_key]["cirugias"].append(turno_der)

        # Convertir sets de roles a listas ordenadas
        for p in prestadores_map.values():
            p["roles"] = sorted(list(p["roles"]))

        return prestadores_map

    @classmethod
    def obtener_destinatarios_status(cls, fecha_cirugia: str) -> Dict[str, Any]:
        """
        Retorna el diagnóstico pre-vuelo para la alerta visual de la grilla y el modal.
        """
        turnos = cls.obtener_cirugias_por_fecha(fecha_cirugia)
        agrupados = cls.clasificar_y_agrupar_destinatarios(turnos)

        destinatarios_list = []
        listos = 0
        sin_tel = 0
        no_resolubles = 0

        for key, info in agrupados.items():
            st = info["estado"]
            if st == "LISTO_PARA_ENVIO":
                listos += 1
            elif st == "SIN_TELEFONO":
                sin_tel += 1
            elif st == "DERIVADOR_NO_RESOLUBLE":
                no_resolubles += 1

            destinatarios_list.append({
                "key": key,
                "prestador_id": info["prestador_id"],
                "geclisa_pre_id": info.get("geclisa_pre_id"),
                "nombre": info["nombre"],
                "telefono": info["telefono"],
                "roles": info["roles"],
                "estado": st,
                "cantidad_cirugias": len(info["cirugias"])
            })

        # Ordenar: primero los que tienen alertas (sin teléfono o no resolubles), luego listos
        destinatarios_list.sort(key=lambda x: (0 if x["estado"] != "LISTO_PARA_ENVIO" else 1, x["nombre"]))

        return {
            "fecha_cirugia": fecha_cirugia,
            "total_prestadores": len(destinatarios_list),
            "listos_para_envio": listos,
            "sin_telefono": sin_tel,
            "derivadores_no_resolubles": no_resolubles,
            "destinatarios": destinatarios_list
        }

    @classmethod
    async def despachar_agendas_fecha(
        cls,
        fecha_cirugia: str,
        forzar_reenvio: bool = False
    ) -> Dict[str, Any]:
        """
        Compila y despacha las agendas en PDF vía WhatsApp Cloud API para la fecha especificada.
        Aplica control de idempotencia y registra auditoría completa.
        """
        config = get_configuracion_notificaciones_prestadores()
        fecha_corte_str = datetime.now(TZ_BUENOS_AIRES).strftime("%Y-%m-%d")

        try:
            dt_cir = datetime.strptime(fecha_cirugia, "%Y-%m-%d").date()
            fecha_legible = formatear_fecha_espanol(dt_cir)
        except Exception:
            fecha_legible = fecha_cirugia

        turnos = cls.obtener_cirugias_por_fecha(fecha_cirugia)
        if not turnos:
            return {
                "success": True,
                "fecha_cirugia": fecha_cirugia,
                "mensaje": f"No se encontraron cirugías programadas activas para el {fecha_cirugia}.",
                "total": 0,
                "enviados": 0,
                "omitidos": 0,
                "fallidos": 0
            }

        agrupados = cls.clasificar_y_agrupar_destinatarios(turnos)
        wa_client = WhatsAppCloudClient(line=config.get("linea_waba", "estudios"))

        enviados = 0
        omitidos_por_previo = 0
        fallidos = 0
        detalles_envio = []

        for key, p_data in agrupados.items():
            p_id = p_data.get("prestador_id")
            p_nom = p_data.get("nombre")
            p_tel = p_data.get("telefono")
            roles = p_data.get("roles", [])
            cirugias = p_data.get("cirugias", [])
            estado_diag = p_data.get("estado")

            # 1. Caso sin teléfono
            if estado_diag == "SIN_TELEFONO":
                registrar_log_notificacion_prestador({
                    "fecha_cirugia": fecha_cirugia,
                    "fecha_corte": fecha_corte_str,
                    "prestador_id": p_id,
                    "prestador_nombre": p_nom,
                    "telefono_destino": None,
                    "cantidad_cirugias": len(cirugias),
                    "roles_incluidos": roles,
                    "estado": "FALLIDO_SIN_TELEFONO",
                    "error_detalle": "El prestador no posee número de teléfono celular en su ficha.",
                    "turnos_snapshot": cirugias
                })
                fallidos += 1
                detalles_envio.append({"prestador": p_nom, "estado": "FALLIDO_SIN_TELEFONO"})
                continue

            # 2. Caso derivador no resoluble
            if estado_diag == "DERIVADOR_NO_RESOLUBLE":
                registrar_log_notificacion_prestador({
                    "fecha_cirugia": fecha_cirugia,
                    "fecha_corte": fecha_corte_str,
                    "prestador_id": None,
                    "prestador_nombre": p_nom,
                    "telefono_destino": None,
                    "cantidad_cirugias": len(cirugias),
                    "roles_incluidos": roles,
                    "estado": "DERIVADOR_NO_RESOLUBLE",
                    "error_detalle": "El nombre del derivador no pudo ser asociado a ningún prestador activo.",
                    "turnos_snapshot": cirugias
                })
                fallidos += 1
                detalles_envio.append({"prestador": p_nom, "estado": "DERIVADOR_NO_RESOLUBLE"})
                continue

            # 3. Control de Idempotencia: Verificar si ya se envió hoy
            if p_id and not forzar_reenvio and verificar_envio_previo_prestador(fecha_cirugia, fecha_corte_str, p_id):
                omitidos_por_previo += 1
                detalles_envio.append({"prestador": p_nom, "estado": "OMITIDO_YA_ENVIADO"})
                continue

            # 4. Generación y Despacho
            try:
                # Renderizar PDF en memoria con ReportLab
                pdf_bytes, pdf_sha = generar_pdf_agenda_prestadores(
                    prestador_info={"nombre": p_nom, "roles": roles, "telefono": p_tel},
                    cirugias_list=cirugias,
                    fecha_cirugia_str=fecha_legible
                )

                # Subida de archivo efímero a Meta Graph API
                filename_pdf = f"Cronograma_Quirurgico_{fecha_cirugia}.pdf"
                media_id = await wa_client.upload_media_bytes(
                    file_bytes=pdf_bytes,
                    filename=filename_pdf,
                    mime_type="application/pdf"
                )

                # Enviar plantilla WABA
                tel_norm = normalizar_telefono_whatsapp(p_tel)
                template_name = config.get("plantilla_nombre", "agenda_quirurgica_prestador")
                lang_code = config.get("idioma_plantilla", "es_AR")

                components = [
                    {
                        "type": "header",
                        "parameters": [
                            {
                                "type": "document",
                                "document": {
                                    "id": media_id,
                                    "filename": filename_pdf
                                }
                            }
                        ]
                    },
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": p_nom},
                            {"type": "text", "text": fecha_legible}
                        ]
                    }
                ]

                try:
                    res_wa = await wa_client.send_template(
                        to_phone=tel_norm,
                        template_name=template_name,
                        language_code=lang_code,
                        components=components
                    )
                except Exception as e_tpl:
                    err_str = str(e_tpl)
                    if "132001" in err_str and template_name != "entrega_estudio_oftalmologico_pdf":
                        logger.warning(
                            f"[NotificacionPrestadores] Plantilla '{template_name}' no aprobada aún en Meta (132001). "
                            f"Aplicando fallback transitorio a 'entrega_estudio_oftalmologico_pdf' para garantizar entrega."
                        )
                        res_wa = await wa_client.send_template(
                            to_phone=tel_norm,
                            template_name="entrega_estudio_oftalmologico_pdf",
                            language_code="es_AR",
                            components=components
                        )
                    else:
                        raise e_tpl

                wamid = res_wa.get("wamid")

                # Registrar auditoría exitosa
                registrar_log_notificacion_prestador({
                    "fecha_cirugia": fecha_cirugia,
                    "fecha_corte": fecha_corte_str,
                    "prestador_id": p_id,
                    "prestador_nombre": p_nom,
                    "telefono_destino": tel_norm,
                    "cantidad_cirugias": len(cirugias),
                    "roles_incluidos": roles,
                    "estado": "ENVIADO",
                    "meta_media_id": media_id,
                    "meta_wamid": wamid,
                    "pdf_sha256": pdf_sha,
                    "turnos_snapshot": cirugias
                })

                enviados += 1
                detalles_envio.append({"prestador": p_nom, "estado": "ENVIADO", "wamid": wamid})

            except Exception as e_send:
                err_msg = str(e_send)
                logger.error(f"[NotificacionPrestadores] Error al enviar agenda a {p_nom} ({p_tel}): {err_msg}")
                registrar_log_notificacion_prestador({
                    "fecha_cirugia": fecha_cirugia,
                    "fecha_corte": fecha_corte_str,
                    "prestador_id": p_id,
                    "prestador_nombre": p_nom,
                    "telefono_destino": p_tel,
                    "cantidad_cirugias": len(cirugias),
                    "roles_incluidos": roles,
                    "estado": "ERROR_META",
                    "error_detalle": err_msg[:500],
                    "turnos_snapshot": cirugias
                })
                fallidos += 1
                detalles_envio.append({"prestador": p_nom, "estado": "ERROR_META", "error": err_msg})

        return {
            "success": True,
            "fecha_cirugia": fecha_cirugia,
            "fecha_corte": fecha_corte_str,
            "total": len(agrupados),
            "enviados": enviados,
            "omitidos_por_previo": omitidos_por_previo,
            "fallidos": fallidos,
            "detalles": detalles_envio
        }

    @classmethod
    async def ejecutar_corte_automatico(cls) -> Dict[str, Any]:
        """
        Ejecuta el corte diario programado (a las 19:00 hs) calculando la fecha objetivo en días hábiles.
        """
        config = get_configuracion_notificaciones_prestadores()
        if not config.get("enabled", True):
            logger.info("[NotificacionPrestadores] Automatismo desactivado en configuración.")
            return {"status": "disabled", "mensaje": "Automatismo deshabilitado."}

        dias_habiles = int(config.get("anticipacion_dias_habiles", 2))
        incluir_sabados = bool(config.get("incluir_sabados", False))

        hoy = datetime.now(TZ_BUENOS_AIRES).date()
        fecha_objetivo = calcular_fecha_objetivo_habiles(
            fecha_base=hoy,
            dias_habiles=dias_habiles,
            incluir_sabados=incluir_sabados
        )
        fecha_obj_str = fecha_objetivo.strftime("%Y-%m-%d")

        logger.info(f"[NotificacionPrestadores] Iniciando corte automático diario. Fecha objetivo: {fecha_obj_str} (proyectado desde {hoy}).")
        res = await cls.despachar_agendas_fecha(fecha_obj_str, forzar_reenvio=False)
        return res
