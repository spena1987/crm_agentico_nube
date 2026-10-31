import logging
import os
import math
import uuid
import time
import hashlib
import json
import secrets
from datetime import datetime, date, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
from app.db import supabase
from app.services.logger_service import log_event
from app.services.geclisa_client import GeclisaClient

logger = logging.getLogger(__name__)

def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip().replace(",", ".")
    try:
        f = float(s)
        return f if not math.isnan(f) else None
    except ValueError:
        return None

def calc_equivalente_esferico(esf: Any, cil: Any) -> Optional[float]:
    f_esf = _safe_float(esf)
    f_cil = _safe_float(cil)
    if f_esf is None and f_cil is None:
        return None
    esf_val = f_esf or 0.0
    cil_val = f_cil or 0.0
    return round(esf_val + (cil_val / 2.0), 2)

def calc_cilindro_corneal(k1: Any, k2: Any) -> Optional[float]:
    f_k1 = _safe_float(k1)
    f_k2 = _safe_float(k2)
    if f_k1 is None or f_k2 is None:
        return None
    return round(-abs(f_k1 - f_k2), 2)

def calc_dias_postop(fecha_cx_str: Optional[str], fecha_visita_str: Optional[str]) -> str:
    if not fecha_cx_str or not fecha_visita_str:
        return ""
    try:
        f_cx = datetime.strptime(fecha_cx_str[:10], "%Y-%m-%d").date()
        f_v = datetime.strptime(fecha_visita_str[:10], "%Y-%m-%d").date()
        diff = (f_v - f_cx).days
        if diff == 0:
            return "el mismo día"
        elif diff == 1:
            return "1 día"
        elif diff < 0:
            return "cirugía posterior (revisar)"
        elif diff < 30:
            return f"{diff} días"
        elif diff < 365:
            meses = round(diff / 30.44, 1)
            return f"{diff} días ({meses} meses)"
        else:
            anios = round(diff / 365.25, 1)
            return f"{diff} días ({anios} años)"
    except Exception:
        return ""

def formatear_evolucion_texto_geclisa(consulta: Dict[str, Any], paciente: Dict[str, Any]) -> str:
    """
    Compila el estado clínico de la consulta en un texto estructurado, limpio y profesional
    apto para la Historia Clínica nativa de Geclisa (POST /api/Pantallas/texto-libre/HC).
    Omite automáticamente secciones y campos sin datos.
    """
    tipo = consulta.get("tipo", "consulta")
    tipo_label = "CONTROL POSTOPERATORIO" if tipo == "postop" else "CONSULTA OFTALMOLÓGICA"
    fecha = consulta.get("fecha") or str(date.today())
    prof = consulta.get("profesional_nombre") or "Oftalmología CREO"
    p_nombre = paciente.get("nombre", "")
    p_dni = paciente.get("dni", "")
    p_ficha = paciente.get("geclisa_ficha_id", "")

    lineas = [
        f"=== {tipo_label} ===",
        f"Fecha: {fecha} | Profesional: {prof}",
        f"Paciente: {p_nombre} | DNI: {p_dni} | Ficha: {p_ficha}",
    ]

    motivo = (consulta.get("motivo_consulta") or "").strip()
    if motivo:
        lineas.append(f"Motivo de consulta: {motivo}")
    derivado = (consulta.get("derivado_por") or "").strip()
    if derivado:
        lineas.append(f"Derivado por: {derivado}")
    ocupacion = (consulta.get("ocupacion") or "").strip()
    if ocupacion:
        lineas.append(f"Ocupación: {ocupacion}")

    # 1. Agudeza Visual
    av = consulta.get("agudeza_visual") or {}
    av_od = av.get("od") or {}
    av_oi = av.get("oi") or {}
    av_ao = av.get("ao") or {}
    av_items = []
    if any(av_od.values()):
        av_items.append(f"OD: SC {av_od.get('sc','-')} | CC {av_od.get('cc','-')} | Est {av_od.get('est','-')}")
    if any(av_oi.values()):
        av_items.append(f"OI: SC {av_oi.get('sc','-')} | CC {av_oi.get('cc','-')} | Est {av_oi.get('est','-')}")
    if any(av_ao.values()):
        av_items.append(f"AO: SC {av_ao.get('sc','-')} | CC {av_ao.get('cc','-')}")
    cerca_od = av.get("cerca_od") or {}
    cerca_oi = av.get("cerca_oi") or {}
    if any(cerca_od.values()) or any(cerca_oi.values()):
        av_items.append(f"Cerca: OD {cerca_od.get('cc','-')} | OI {cerca_oi.get('cc','-')}")

    if av_items:
        lineas.append("\n[AGUDEZA VISUAL]")
        lineas.extend([f"  • {item}" for item in av_items])

    # 2. Refracción Subjetiva
    rx = consulta.get("refraccion") or {}
    rx_od = rx.get("od") or {}
    rx_oi = rx.get("oi") or {}
    rx_items = []
    if any(rx_od.values()):
        ee_str = f" (EE: {rx_od.get('ee')})" if rx_od.get('ee') is not None else ""
        add_str = f" | Add: {rx_od.get('add')}" if rx_od.get('add') else ""
        rx_items.append(f"OD: {rx_od.get('esf','')} {rx_od.get('cil','')} x {rx_od.get('eje','')}°{ee_str}{add_str}".strip())
    if any(rx_oi.values()):
        ee_str = f" (EE: {rx_oi.get('ee')})" if rx_oi.get('ee') is not None else ""
        add_str = f" | Add: {rx_oi.get('add')}" if rx_oi.get('add') else ""
        rx_items.append(f"OI: {rx_oi.get('esf','')} {rx_oi.get('cil','')} x {rx_oi.get('eje','')}°{ee_str}{add_str}".strip())
    if rx_items:
        lineas.append("\n[REFRACCIÓN SUBJETIVA]")
        lineas.extend([f"  • {item}" for item in rx_items])

    # 3. Queratometría
    k = consulta.get("queratometria") or {}
    k_od = k.get("od") or {}
    k_oi = k.get("oi") or {}
    k_items = []
    if any(k_od.values()):
        cil_c = f" | Cil corneal: {k_od.get('cil')}" if k_od.get('cil') else ""
        k_items.append(f"OD: K1 {k_od.get('k1','-')} / K2 {k_od.get('k2','-')} x {k_od.get('eje','-')}°{cil_c}")
    if any(k_oi.values()):
        cil_c = f" | Cil corneal: {k_oi.get('cil')}" if k_oi.get('cil') else ""
        k_items.append(f"OI: K1 {k_oi.get('k1','-')} / K2 {k_oi.get('k2','-')} x {k_oi.get('eje','-')}°{cil_c}")
    if k_items:
        lineas.append("\n[QUERATOMETRÍA]")
        lineas.extend([f"  • {item}" for item in k_items])

    # 4. Presión Intraocular (PIO)
    pio = consulta.get("presion_intraocular") or {}
    pio_od = pio.get("od") or {}
    pio_oi = pio.get("oi") or {}
    pio_items = []
    if any(pio_od.values()) or any(pio_oi.values()):
        tto = f" (Tto: {pio.get('tto')})" if pio.get("tto") else ""
        pio_items.append(f"OD: Aplanación {pio_od.get('apl','-')} mmHg / Aire {pio_od.get('aire','-')} mmHg")
        pio_items.append(f"OI: Aplanación {pio_oi.get('apl','-')} mmHg / Aire {pio_oi.get('aire','-')} mmHg{tto}")
    if pio_items:
        lineas.append("\n[PRESIÓN INTRAOCULAR]")
        lineas.extend([f"  • {item}" for item in pio_items])

    # 5. Biomicroscopía
    bio = consulta.get("biomicroscopia") or {}
    bio_items = []
    if bio.get("modo") == "ao" and bio.get("od"):
        bio_items.append(f"AO: {bio.get('od')}")
    else:
        if bio.get("od"):
            cat = f" (Catarata: {bio.get('cat_od')})" if bio.get('cat_od') else ""
            bio_items.append(f"OD: {bio.get('od')}{cat}")
        if bio.get("oi"):
            cat = f" (Catarata: {bio.get('cat_oi')})" if bio.get('cat_oi') else ""
            bio_items.append(f"OI: {bio.get('oi')}{cat}")
    if bio.get("dilata"):
        bio_items.append(f"Dilatación: {bio.get('dilata')}")
    if bio_items:
        lineas.append("\n[BIOMICROSCOPÍA]")
        lineas.extend([f"  • {item}" for item in bio_items])

    # 6. Fondo de Ojo
    fo = consulta.get("fondo_ojo") or {}
    fo_items = []
    if fo.get("modo") == "ao" and fo.get("od"):
        fo_items.append(f"AO: {fo.get('od')}")
    else:
        if fo.get("od"):
            fo_items.append(f"OD: {fo.get('od')}")
        if fo.get("oi"):
            fo_items.append(f"OI: {fo.get('oi')}")
    if fo_items:
        lineas.append("\n[FONDO DE OJO]")
        lineas.extend([f"  • {item}" for item in fo_items])

    # 7. Datos Postoperatorios (si aplica)
    if tipo == "postop":
        pop = consulta.get("datos_postop") or {}
        pop_items = []
        if pop.get("cx_realizada"):
            pop_items.append(f"Cirugía: {pop.get('cx_realizada')} ({pop.get('ojo','AO')})")
        if pop.get("fecha_cx"):
            dias = pop.get("dias_postop") or calc_dias_postop(pop.get("fecha_cx"), fecha)
            pop_items.append(f"Fecha Cx: {pop.get('fecha_cx')} (Tiempo posquirúrgico: {dias})")
        if pop.get("cirujano"):
            pop_items.append(f"Cirujano: {pop.get('cirujano')}")
        if pop.get("evolucion"):
            pop_items.append(f"Evolución: {pop.get('evolucion')}")
        if pop.get("satisfaccion"):
            pop_items.append(f"Satisfacción: {pop.get('satisfaccion')}")
        compl = pop.get("complicaciones") or []
        if compl:
            det = f" - {pop.get('complic_detalle')}" if pop.get("complic_detalle") else ""
            pop_items.append(f"Complicaciones: {', '.join(compl)}{det}")
        if pop_items:
            lineas.append("\n[CONTROL POSQUIRÚRGICO]")
            lineas.extend([f"  • {item}" for item in pop_items])

    # 8. Conducta y Diagnóstico
    conducta = consulta.get("conducta") or {}
    c_items = []
    if conducta.get("dx_presuntivo"):
        c_items.append(f"Diagnóstico: {conducta.get('dx_presuntivo')}")
    if conducta.get("plan_cx"):
        ojo_txt = f" ({conducta.get('plan_ojo')})" if conducta.get('plan_ojo') else ""
        c_items.append(f"Plan quirúrgico: {conducta.get('plan_cx')}{ojo_txt}")
    if conducta.get("plan_cx2"):
        c_items.append(f"Segundo procedimiento: {conducta.get('plan_cx2')}")
    if conducta.get("explico"):
        c_items.append(f"Explicado al paciente: {', '.join(conducta.get('explico'))}")
    if c_items:
        lineas.append("\n[DIAGNÓSTICO Y CONDUCTA]")
        lineas.extend([f"  • {item}" for item in c_items])

    # 9. Indicaciones y Próximo Control
    indicaciones = (consulta.get("indicaciones_texto") or "").strip()
    if indicaciones:
        lineas.append(f"\n[INDICACIONES]\n{indicaciones}")
    prox = (consulta.get("proximo_control") or "").strip()
    if prox:
        lineas.append(f"Próximo control: {prox}")

    # 10. Adendas / Enmiendas Foliadas (Ley 26.529 Art. 15)
    enmiendas = consulta.get("enmiendas") or []
    if enmiendas and isinstance(enmiendas, list):
        lineas.append("\n--- ADENDAS / ENMIENDAS FOLIADAS (Ley 26.529 Art. 15) ---")
        for idx, enm in enumerate(enmiendas, start=1):
            enm_fecha = str(enm.get("created_at") or "")[:19].replace("T", " ")
            enm_prof = enm.get("profesional_nombre") or "Profesional Médico"
            enm_mat = f" (Mat. {enm.get('profesional_matricula')})" if enm.get("profesional_matricula") else ""
            enm_motivo = (enm.get("motivo_enmienda") or "").strip()
            enm_texto = (enm.get("texto_adenda") or "").strip()
            lineas.append(f"  [{idx}] Fecha: {enm_fecha} | Profesional: {enm_prof}{enm_mat}")
            if enm_motivo:
                lineas.append(f"      Motivo: {enm_motivo}")
            if enm_texto:
                lineas.append(f"      Adenda: {enm_texto}")

    lineas.append("\n------------------------------------------------------------")
    lineas.append("[Registrado digitalmente vía CRM Oftalmológico]")
    return "\n".join(lineas)

class HistoriaOftalmoService:
    @staticmethod
    def get_or_create_historia(paciente_id: str) -> Dict[str, Any]:
        try:
            p_res = supabase.table("pacientes").select("*").eq("id", paciente_id).limit(1).execute()
            if not p_res.data or len(p_res.data) == 0:
                raise ValueError(f"Paciente con ID {paciente_id} no encontrado.")
            paciente = p_res.data[0]

            hc_res = supabase.table("historias_clinicas_oftalmo").select("*").eq("paciente_id", paciente_id).limit(1).execute()
            if not hc_res.data or len(hc_res.data) == 0:
                initial_hc = {
                    "paciente_id": paciente_id,
                    "antecedentes_oculares": [],
                    "antecedentes_generales": [],
                    "medicacion_habitual": [],
                    "medicacion_otra": "",
                    "alergias": "",
                    "observaciones_permanentes": "",
                    "extra_catalogos": {}
                }
                ficha_id = paciente.get("geclisa_ficha_id")
                if ficha_id:
                    try:
                        geclisa = GeclisaClient()
                        resumen_gec = geclisa.obtener_historia_clinica_resumen(ficha_id)
                        if resumen_gec and resumen_gec.get("encontrado"):
                            evoluciones = resumen_gec.get("evoluciones_recientes") or []
                            if evoluciones:
                                sep = "\n---\n"
                                ultimas_txt = sep.join([f"{e.get('fecha','')}: {e.get('texto','')}" for e in evoluciones[:3]])
                                initial_hc["observaciones_permanentes"] = f"[Historial previo Geclisa]\n{ultimas_txt}"
                    except Exception as gec_err:
                        logger.warning(f"No se pudo precargar historial de Geclisa para ficha {ficha_id}: {gec_err}")

                created_res = supabase.table("historias_clinicas_oftalmo").insert(initial_hc).execute()
                historia = created_res.data[0]
            else:
                historia = hc_res.data[0]

            consultas_res = supabase.table("consultas_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).order("created_at", desc=True).execute()
            consultas = consultas_res.data or []

            # Obtener enmiendas / adendas foliadas asociadas (Ley 26.529 Art. 15)
            try:
                enm_res = supabase.table("consultas_oftalmo_enmiendas").select("*").eq("paciente_id", paciente_id).order("created_at", desc=False).execute()
                enm_map = {}
                for e in (enm_res.data or []):
                    enm_map.setdefault(e.get("consulta_id"), []).append(e)
                for c in consultas:
                    c["enmiendas"] = enm_map.get(c.get("id"), [])
                    if c["enmiendas"] and c.get("estado_legal") != "AMENDED":
                        c["estado_legal"] = "AMENDED"
                    elif c.get("geclisa_hc_id") and c.get("estado_legal") in (None, "", "DRAFT"):
                        c["estado_legal"] = "SIGNED"
                    elif not c.get("estado_legal"):
                        c["estado_legal"] = "DRAFT"
            except Exception as enm_err:
                logger.debug(f"Aviso al cargar enmiendas para paciente {paciente_id}: {enm_err}")
                for c in consultas:
                    c["enmiendas"] = []
                    if c.get("geclisa_hc_id") and c.get("estado_legal") in (None, "", "DRAFT"):
                        c["estado_legal"] = "SIGNED"
                    elif not c.get("estado_legal"):
                        c["estado_legal"] = "DRAFT"

            # Auto-vincular estudios oftalmológicos enviados por técnicos cuando el paciente aún no existía en public.pacientes
            try:
                p_dni_clean = "".join(filter(str.isdigit, str(paciente.get("dni") or "")))
                p_ficha_id = paciente.get("geclisa_ficha_id")
                if p_ficha_id:
                    supabase.table("estudios_oftalmo").update({"paciente_id": paciente_id}).is_("paciente_id", "null").eq("geclisa_ficha_id", int(p_ficha_id)).execute()
                if p_dni_clean and len(p_dni_clean) >= 6:
                    supabase.table("estudios_oftalmo").update({"paciente_id": paciente_id}).is_("paciente_id", "null").eq("dni_paciente", p_dni_clean).execute()
            except Exception as link_est_err:
                logger.debug(f"No se pudieron auto-vincular estudios previos para paciente {paciente_id}: {link_est_err}")

            estudios_res = supabase.table("estudios_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            estudios = estudios_res.data or []

            recetas_ant_res = supabase.table("recetas_anteojos_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            recetas_anteojos = recetas_ant_res.data or []

            recetas_farm_res = supabase.table("recetas_farmacos_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            recetas_farmacos = recetas_farm_res.data or []

            pedidos_res = supabase.table("pedidos_estudios_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            pedidos_estudios = pedidos_res.data or []

            # Coexistencia: Obtener evoluciones vivas de Geclisa para el Timeline Híbrido
            evoluciones_geclisa = []
            ficha_id = paciente.get("geclisa_ficha_id")
            if ficha_id:
                try:
                    geclisa = GeclisaClient()
                    resumen_gec = geclisa.obtener_historia_clinica_resumen(int(ficha_id))
                    if resumen_gec and resumen_gec.get("encontrado"):
                        raw_evs = resumen_gec.get("evoluciones_recientes") or []
                        crm_hc_ids = {c.get("geclisa_hc_id") for c in consultas if c.get("geclisa_hc_id")}
                        for ev in raw_evs:
                            h_id = ev.get("hc_id")
                            ev["es_crm"] = h_id in crm_hc_ids
                            ev["origen"] = "crm" if h_id in crm_hc_ids else "geclisa_escritorio"
                            evoluciones_geclisa.append(ev)
                except Exception as ex_gec:
                    logger.warning(f"No se pudieron consultar evoluciones de Geclisa para ficha {ficha_id}: {ex_gec}")

            return {
                "success": True,
                "paciente": paciente,
                "historia": historia,
                "consultas": consultas,
                "evoluciones_geclisa": evoluciones_geclisa,
                "estudios": estudios,
                "recetas_anteojos": recetas_anteojos,
                "recetas_farmacos": recetas_farmacos,
                "pedidos_estudios": pedidos_estudios
            }
        except Exception as e:
            logger.error(f"Error en get_or_create_historia para paciente {paciente_id}: {e}")
            raise

    @staticmethod
    def save_antecedentes(paciente_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            historia_src = data.get("historia") if isinstance(data.get("historia"), dict) else data
            paciente_src = data.get("paciente") if isinstance(data.get("paciente"), dict) else data

            hc_keys = [
                "antecedentes_oculares",
                "antecedentes_generales",
                "medicacion_habitual",
                "medicacion_otra",
                "alergias",
                "observaciones_permanentes",
                "extra_catalogos"
            ]
            hc_update: Dict[str, Any] = {"updated_at": "now()"}
            for hk in hc_keys:
                if hk in historia_src and historia_src[hk] is not None:
                    hc_update[hk] = historia_src[hk]

            res = supabase.table("historias_clinicas_oftalmo").update(hc_update).eq("paciente_id", paciente_id).execute()

            paciente_fields: Dict[str, Any] = {}
            for k in ["nombre", "dni", "nro_hc", "fecha_nacimiento", "sexo", "telefono", "email", "obra_social", "plan_cobertura", "nro_afiliado", "direccion"]:
                if k in paciente_src and paciente_src[k] is not None:
                    paciente_fields[k] = paciente_src[k]
            if "nombre_completo" in paciente_src and paciente_src["nombre_completo"] and "nombre" not in paciente_fields:
                paciente_fields["nombre"] = paciente_src["nombre_completo"]

            if paciente_fields:
                try:
                    supabase.table("pacientes").update(paciente_fields).eq("id", paciente_id).execute()
                except Exception as pac_err:
                    logger.warning(f"Aviso actualizando paciente {paciente_id} (reintentando sin nro_afiliado): {pac_err}")
                    fallback_fields = {k: v for k, v in paciente_fields.items() if k != "nro_afiliado"}
                    if fallback_fields:
                        try:
                            supabase.table("pacientes").update(fallback_fields).eq("id", paciente_id).execute()
                        except Exception as pac_err2:
                            logger.warning(f"No se pudo actualizar paciente {paciente_id}: {pac_err2}")

            log_event(
                nivel="INFO",
                modulo="HISTORIA_CLINICA",
                accion="ACTUALIZAR_ANTECEDENTES",
                mensaje=f"Antecedentes actualizados para paciente {paciente_id}",
                detalles={"paciente_id": paciente_id}
            )
            return {"success": True, "historia": res.data[0] if res.data else hc_update}
        except Exception as e:
            logger.error(f"Error en save_antecedentes para paciente {paciente_id}: {e}")
            raise

    @staticmethod
    def save_consulta(paciente_id: str, consulta_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            historia_id = consulta_data.get("historia_id")
            if not historia_id:
                h_res = supabase.table("historias_clinicas_oftalmo").select("id").eq("paciente_id", paciente_id).limit(1).execute()
                if h_res.data:
                    historia_id = h_res.data[0]["id"]
                else:
                    h_created = HistoriaOftalmoService.get_or_create_historia(paciente_id)
                    historia_id = h_created["historia"]["id"]

            refraccion = dict(consulta_data.get("refraccion") or {})
            rx_od = dict(refraccion.get("od") or {})
            rx_oi = dict(refraccion.get("oi") or {})
            rx_od["ee"] = calc_equivalente_esferico(rx_od.get("esf"), rx_od.get("cil"))
            rx_oi["ee"] = calc_equivalente_esferico(rx_oi.get("esf"), rx_oi.get("cil"))
            refraccion["od"] = rx_od
            refraccion["oi"] = rx_oi

            querato = dict(consulta_data.get("queratometria") or {})
            k_od = dict(querato.get("od") or {})
            k_oi = dict(querato.get("oi") or {})
            cil_od = calc_cilindro_corneal(k_od.get("k1"), k_od.get("k2"))
            if cil_od is not None:
                k_od["cil"] = cil_od
            cil_oi = calc_cilindro_corneal(k_oi.get("k1"), k_oi.get("k2"))
            if cil_oi is not None:
                k_oi["cil"] = cil_oi
            querato["od"] = k_od
            querato["oi"] = k_oi

            datos_postop = dict(consulta_data.get("datos_postop") or {})
            fecha_visita = consulta_data.get("fecha") or str(date.today())
            if datos_postop.get("fecha_cx"):
                datos_postop["dias_postop"] = calc_dias_postop(datos_postop.get("fecha_cx"), fecha_visita)

            registro = {
                "historia_id": historia_id,
                "paciente_id": paciente_id,
                "tipo": consulta_data.get("tipo", "consulta"),
                "fecha": fecha_visita,
                "profesional_nombre": consulta_data.get("profesional_nombre", ""),
                "motivo_consulta": consulta_data.get("motivo_consulta", ""),
                "derivado_por": consulta_data.get("derivado_por", ""),
                "ocupacion": consulta_data.get("ocupacion", ""),
                "observaciones_consulta": consulta_data.get("observaciones_consulta", ""),
                "agudeza_visual": consulta_data.get("agudeza_visual") or {},
                "refraccion": refraccion,
                "lentes_anteriores": consulta_data.get("lentes_anteriores") or {},
                "estabilidad_refractiva": consulta_data.get("estabilidad_refractiva", ""),
                "arm_cicloplejia": consulta_data.get("arm_cicloplejia") or {},
                "queratometria": querato,
                "presion_intraocular": consulta_data.get("presion_intraocular") or {},
                "lentes_contacto": consulta_data.get("lentes_contacto") or {},
                "examen_sensoriomotor": consulta_data.get("examen_sensoriomotor") or {},
                "superficie_ocular": consulta_data.get("superficie_ocular") or {},
                "biomicroscopia": consulta_data.get("biomicroscopia") or {},
                "fondo_ojo": consulta_data.get("fondo_ojo") or {},
                "conducta": consulta_data.get("conducta") or {},
                "datos_postop": datos_postop,
                "indicaciones_texto": consulta_data.get("indicaciones_texto", ""),
                "proximo_control": consulta_data.get("proximo_control", ""),
                "notas_internas": consulta_data.get("notas_internas", ""),
                "videos_enviados": consulta_data.get("videos_enviados") or [],
                "updated_at": "now()"
            }

            consulta_id = consulta_data.get("id")
            is_valid_uuid = False
            if consulta_id:
                try:
                    uuid.UUID(str(consulta_id))
                    is_valid_uuid = True
                except (ValueError, TypeError, AttributeError):
                    is_valid_uuid = False

            if consulta_id and is_valid_uuid:
                exists_res = supabase.table("consultas_oftalmo").select("id, estado_legal, geclisa_hc_id").eq("id", consulta_id).limit(1).execute()
                if exists_res.data:
                    curr_estado = exists_res.data[0].get("estado_legal")
                    if curr_estado in ["SIGNED", "AMENDED"]:
                        raise ValueError("Operación denegada: La consulta médica se encuentra firmada e inmutable (Ley 26.529). Confeccione una adenda.")
                    res = supabase.table("consultas_oftalmo").update(registro).eq("id", consulta_id).execute()
                else:
                    registro["id"] = consulta_id
                    registro["estado_legal"] = "DRAFT"
                    registro["created_at"] = "now()"
                    res = supabase.table("consultas_oftalmo").insert(registro).execute()
                saved_consulta = res.data[0] if res.data else {**registro, "id": consulta_id}
            else:
                registro["estado_legal"] = "DRAFT"
                registro["created_at"] = "now()"
                res = supabase.table("consultas_oftalmo").insert(registro).execute()
                saved_consulta = res.data[0] if res.data else registro
                consulta_id = saved_consulta.get("id")

            conducta = consulta_data.get("conducta") or {}
            valores_pasar = conducta.get("valores_pasar") or []
            plan_cx = conducta.get("plan_cx") or ""
            if valores_pasar or (plan_cx and plan_cx not in ["Observación / control", "Todavía no operar", "No candidato"]):
                try:
                    HistoriaOftalmoService.conectar_asesoria_quirurgica(
                        paciente_id=paciente_id,
                        consulta_id=consulta_id,
                        plan_cx=plan_cx,
                        valores_pasar=valores_pasar
                    )
                except Exception as ases_err:
                    logger.warning(f"No se pudo vincular asesoría quirúrgica: {ases_err}")

            HistoriaOftalmoService.registrar_audit_log(
                paciente_id=paciente_id,
                entidad="CONSULTA",
                entidad_id=consulta_id,
                accion="UPDATE_DRAFT" if (exists_res.data if consulta_id and is_valid_uuid else False) else "CREATE_DRAFT",
                detalles={"tipo": registro.get("tipo"), "fecha": registro.get("fecha")}
            )

            return {"success": True, "consulta": saved_consulta}
        except Exception as e:
            logger.error(f"Error en save_consulta: {e}")
            raise

    @staticmethod
    def delete_consulta(
        consulta_id: str,
        user_payload: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            # 1. Verificar inmutabilidad legal (Ley 26.529 Art. 15)
            c_res = supabase.table("consultas_oftalmo").select("id, paciente_id, estado_legal, geclisa_hc_id").eq("id", consulta_id).limit(1).execute()
            if not c_res.data:
                return {"success": True, "deleted_id": consulta_id}

            c_row = c_res.data[0]
            if c_row.get("estado_legal") in ["SIGNED", "AMENDED"]:
                raise ValueError("Operación denegada: No es legalmente admisible eliminar una consulta médica firmada o cerrada (Ley 26.529). Debe registrar una adenda o enmienda foliada.")

            # Coexistencia: Verificar si tiene un hcId en Geclisa para darlo de baja si está permitido
            ghc_id = c_row.get("geclisa_hc_id")
            if ghc_id and int(ghc_id) > 0:
                try:
                    geclisa = GeclisaClient()
                    val = geclisa.validar_editar_eliminar_hc(int(ghc_id))
                    if val.get("permitido", True):
                        geclisa.eliminar_hc(int(ghc_id))
                        logger.info(f"Evolución hcId {ghc_id} eliminada en Geclisa correctamente.")
                    else:
                        logger.warning(f"Geclisa no permitió eliminar hcId {ghc_id}: {val.get('motivo')}")
                except Exception as ex_del_gec:
                    logger.warning(f"Error intentando dar de baja en Geclisa hcId {ghc_id}: {ex_del_gec}")

            supabase.table("consultas_oftalmo").delete().eq("id", consulta_id).execute()

            paciente_id = c_row.get("paciente_id")
            if paciente_id:
                HistoriaOftalmoService.registrar_audit_log(
                    paciente_id=paciente_id,
                    entidad="CONSULTA",
                    entidad_id=consulta_id,
                    accion="DELETE_DRAFT",
                    usuario_id=user_payload.get("sub") or user_payload.get("id") if user_payload else None,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    detalles={"geclisa_hc_id": ghc_id}
                )

            return {"success": True, "deleted_id": consulta_id}
        except Exception as e:
            logger.error(f"Error eliminando consulta {consulta_id}: {e}")
            raise

    @staticmethod
    def sincronizar_con_geclisa(consulta_id: str, usuario_actual: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Sincroniza la consulta oftalmológica inyectándola como evolución clínica de texto libre
        directamente en la Historia Clínica nativa de Geclisa (POST /api/Pantallas/texto-libre/HC).
        - Si no tiene geclisa_hc_id: Inserta nuevo registro y almacena el hcId retornado por Geclisa.
        - Si ya tiene geclisa_hc_id: Valida con Geclisa y actualiza la evolución existente sin duplicar.
        """
        try:
            try:
                uuid.UUID(str(consulta_id))
            except (ValueError, TypeError, AttributeError):
                return {
                    "success": False,
                    "sincronizado": False,
                    "error": f"ID de consulta inválido ('{consulta_id}'). Asegúrese de guardar la consulta antes de sincronizar."
                }

            c_res = supabase.table("consultas_oftalmo").select("*, pacientes(*)").eq("id", consulta_id).limit(1).execute()
            if not c_res.data:
                raise ValueError("Consulta no encontrada")
            c = c_res.data[0]
            paciente = c.get("pacientes") or {}
            ficha_id = paciente.get("geclisa_ficha_id")
            if not ficha_id:
                return {
                    "success": False,
                    "sincronizado": False,
                    "motivo": "El paciente no tiene un número de Ficha asignado en Geclisa."
                }

            geclisa = GeclisaClient()
            existing_hc_id = c.get("geclisa_hc_id")

            # Coexistencia y validación previa si es una edición
            if existing_hc_id and int(existing_hc_id) > 0:
                val = geclisa.validar_editar_eliminar_hc(int(existing_hc_id))
                if not val.get("permitido", True):
                    return {
                        "success": False,
                        "sincronizado": False,
                        "motivo": val.get("motivo") or "Geclisa no permite modificar esta evolución clínica según sus reglas de negocio."
                    }

            # Cargar adendas / enmiendas foliadas para incluirlas en la evolución de Geclisa (Ley 26.529 Art. 15)
            try:
                enm_res = supabase.table("consultas_oftalmo_enmiendas").select("*").eq("consulta_id", consulta_id).order("created_at", desc=False).execute()
                c["enmiendas"] = enm_res.data or []
            except Exception as enm_err:
                logger.debug(f"No se pudieron cargar enmiendas al sincronizar consulta {consulta_id} con Geclisa: {enm_err}")
                c["enmiendas"] = []

            # Compilar evolución en texto clínico estructurado y legible
            texto_evolucion = formatear_evolucion_texto_geclisa(consulta=c, paciente=paciente)

            # Extraer fecha y hora
            fecha_str = c.get("fecha") or str(date.today())
            hora_str = None
            if c.get("created_at"):
                try:
                    hora_str = c["created_at"][11:16]
                except Exception:
                    hora_str = None

            # Prestador médico si está disponible en la sesión
            pre_id = None
            me_id = None
            if usuario_actual:
                pre_id = usuario_actual.get("geclisa_pre_id") or usuario_actual.get("pre_id")
                me_id = usuario_actual.get("geclisa_me_id") or usuario_actual.get("me_id")

            # Inyectar evolución nativa de texto libre en Geclisa
            res_geclisa = geclisa.grabar_texto_libre_hc(
                ficha_id=int(ficha_id),
                evolucion=texto_evolucion,
                fecha_evolucion=fecha_str,
                hora_evolucion=hora_str,
                hc_id=existing_hc_id,
                pre_id=pre_id,
                me_id=me_id,
                tev_cod="HC"
            )

            if not res_geclisa.get("success"):
                return {
                    "success": False,
                    "sincronizado": False,
                    "error": res_geclisa.get("error", "Error desconocido de Geclisa al grabar evolución.")
                }

            assigned_hc_id = res_geclisa.get("hc_id") or existing_hc_id
            now_iso = datetime.now(timezone.utc).isoformat()

            update_data = {
                "sincronizado_geclisa_at": now_iso
            }
            if assigned_hc_id:
                update_data["geclisa_hc_id"] = int(assigned_hc_id)

            try:
                supabase.table("consultas_oftalmo").update(update_data).eq("id", consulta_id).execute()
            except Exception as up_err:
                logger.warning(f"Reintentando actualización de consulta {consulta_id} en Supabase tras error: {up_err}")
                try:
                    time.sleep(0.5)
                    supabase.table("consultas_oftalmo").update(update_data).eq("id", consulta_id).execute()
                except Exception as up_err2:
                    logger.error(f"No se pudo actualizar consulta {consulta_id} en Supabase: {up_err2}")

            return {
                "success": True,
                "sincronizado": True,
                "geclisa_hc_id": assigned_hc_id,
                "es_actualizacion": bool(existing_hc_id),
                "mensaje": f"Evolución {'actualizada' if existing_hc_id else 'creada'} e inyectada en la Historia Clínica nativa de Geclisa con éxito (hcId: {assigned_hc_id})."
            }
        except Exception as e:
            logger.error(f"Error sincronizando consulta {consulta_id} con Geclisa: {e}")
            return {"success": False, "sincronizado": False, "error": str(e)}

    @staticmethod
    def conectar_asesoria_quirurgica(paciente_id: str, consulta_id: str, plan_cx: str, valores_pasar: List[str]):
        try:
            ases_res = supabase.table("asesorias_quirurgicas").select("id, estado").eq("paciente_id", paciente_id).in_("estado", ["asesoria_pendiente", "presupuesto_presentado", "esperando_decision"]).limit(1).execute()
            valores_txt = ", ".join(valores_pasar) if valores_pasar else "Estándar"
            notas_asesoria = f"Indicación médica: {plan_cx}. Valores requeridos: {valores_txt}."
            if ases_res.data:
                ases_id = ases_res.data[0]["id"]
                supabase.table("asesorias_quirurgicas").update({
                    "tipo_procedimiento": plan_cx or "Cirugía Oftalmológica",
                    "notas": notas_asesoria,
                    "updated_at": "now()"
                }).eq("id", ases_id).execute()
            else:
                supabase.table("asesorias_quirurgicas").insert({
                    "paciente_id": paciente_id,
                    "estado": "asesoria_pendiente",
                    "tipo_procedimiento": plan_cx or "Cirugía Oftalmológica",
                    "notas": notas_asesoria,
                    "created_at": "now()",
                    "updated_at": "now()"
                }).execute()
        except Exception as e:
            logger.warning(f"Error conectando con asesoría quirúrgica: {e}")

    @staticmethod
    def add_estudio(paciente_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        item = {
            "paciente_id": paciente_id,
            "consulta_id": data.get("consulta_id"),
            "tipo": data.get("tipo"),
            "ojo": data.get("ojo", "AO"),
            "fecha": data.get("fecha") or str(date.today()),
            "notas": data.get("notas", ""),
            "archivo_url": data.get("archivo_url", ""),
            "archivo_nombre": data.get("archivo_nombre", ""),
            "created_at": "now()"
        }
        res = supabase.table("estudios_oftalmo").insert(item).execute()
        return {"success": True, "estudio": res.data[0] if res.data else item}

    @staticmethod
    def delete_estudio(estudio_id: str) -> Dict[str, Any]:
        supabase.table("estudios_oftalmo").delete().eq("id", estudio_id).execute()
        return {"success": True, "deleted_id": estudio_id}

    @staticmethod
    def save_receta_anteojos(paciente_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        receta_id = data.get("id")
        lejos = data.get("lejos") or {}
        cerca = data.get("cerca") or {}
        od = data.get("od") or lejos.get("od") or {}
        oi = data.get("oi") or lejos.get("oi") or {}
        item = {
            "paciente_id": paciente_id,
            "consulta_id": data.get("consulta_id"),
            "fecha": data.get("fecha") or str(date.today()),
            "tipo_lente": data.get("tipo_lente") or data.get("tipo_cristal") or data.get("tipo", ""),
            "tipo_cristal": data.get("tipo_cristal") or data.get("tipo_lente", ""),
            "od_esfera": od.get("esf", ""),
            "od_cilindro": od.get("cil", ""),
            "od_eje": od.get("eje", ""),
            "od_adicion": od.get("add") or cerca.get("od", {}).get("esf", ""),
            "oi_esfera": oi.get("esf", ""),
            "oi_cilindro": oi.get("cil", ""),
            "oi_eje": oi.get("eje", ""),
            "oi_adicion": oi.get("add") or cerca.get("oi", {}).get("esf", ""),
            "dnp": data.get("dnp") or od.get("dnp", ""),
            "tratamiento": data.get("tratamiento", ""),
            "indicaciones_optico": data.get("indicaciones_optico") or data.get("observaciones") or data.get("notas", ""),
            "observaciones": data.get("observaciones") or data.get("indicaciones_optico", ""),
            "lejos": lejos,
            "cerca": cerca
        }
        if receta_id:
            res = supabase.table("recetas_anteojos_oftalmo").update(item).eq("id", receta_id).execute()
        else:
            item["created_at"] = "now()"
            res = supabase.table("recetas_anteojos_oftalmo").insert(item).execute()
        return {"success": True, "receta": res.data[0] if res.data else item}

    @staticmethod
    def delete_receta_anteojos(receta_id: str) -> Dict[str, Any]:
        supabase.table("recetas_anteojos_oftalmo").delete().eq("id", receta_id).execute()
        return {"success": True, "deleted_id": receta_id}

    @staticmethod
    def save_receta_farmacos(paciente_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        receta_id = data.get("id")
        item = {
            "paciente_id": paciente_id,
            "consulta_id": data.get("consulta_id"),
            "fecha": data.get("fecha") or str(date.today()),
            "diagnostico": data.get("diagnostico") or "",
            "items": data.get("items") or [],
            "indicaciones_generales": data.get("indicaciones_generales") or data.get("nota", "")
        }
        if receta_id:
            res = supabase.table("recetas_farmacos_oftalmo").update(item).eq("id", receta_id).execute()
        else:
            item["created_at"] = "now()"
            res = supabase.table("recetas_farmacos_oftalmo").insert(item).execute()
        return {"success": True, "receta": res.data[0] if res.data else item}

    @staticmethod
    def delete_receta_farmacos(receta_id: str) -> Dict[str, Any]:
        supabase.table("recetas_farmacos_oftalmo").delete().eq("id", receta_id).execute()
        return {"success": True, "deleted_id": receta_id}

    @staticmethod
    def save_pedidos_estudios(paciente_id: str, pedidos: Union[List[Dict[str, Any]], Dict[str, Any]]) -> Dict[str, Any]:
        lista = pedidos if isinstance(pedidos, list) else [pedidos]
        saved = []
        lote_id = str(uuid.uuid4())
        for p in lista:
            estudios_list = p.get("estudios") or p.get("items") or []
            item = {
                "paciente_id": paciente_id,
                "consulta_id": p.get("consulta_id"),
                "lote_id": p.get("lote_id") or lote_id,
                "fecha": p.get("fecha") or str(date.today()),
                "grupo_preset": p.get("grupo_preset") or p.get("grupo", ""),
                "titulo": p.get("titulo", "Pedido de estudios"),
                "items": estudios_list if estudios_list else [p.get("titulo", "Pedido de estudios")],
                "estudios": estudios_list,
                "ojo": p.get("ojo") or "AO",
                "diagnostico": p.get("diagnostico") or p.get("dx", ""),
                "observaciones": p.get("observaciones") or p.get("nota", ""),
                "created_at": "now()"
            }
            res = supabase.table("pedidos_estudios_oftalmo").insert(item).execute()
            if res.data:
                saved.append(res.data[0])
            else:
                saved.append(item)
        return {"success": True, "pedidos": saved, "pedido": saved[0] if saved else None}


    @staticmethod
    def delete_pedidos_estudios(lote_o_id: str) -> Dict[str, Any]:
        supabase.table("pedidos_estudios_oftalmo").delete().or_(f"id.eq.{lote_o_id},lote_id.eq.{lote_o_id}").execute()
        return {"success": True, "deleted": lote_o_id}

    # ====================================================================
    # MÉTODOS DE TRAZABILIDAD LEGAL, FIRMA ELECTRÓNICA Y ENMIENDAS (Leyes 26.529, 25.326, 27.553)
    # ====================================================================

    @staticmethod
    def registrar_audit_log(
        paciente_id: str,
        entidad: str,
        entidad_id: Optional[str],
        accion: str,
        usuario_id: Optional[str] = None,
        usuario_nombre: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        detalles: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Registra un evento inmutable de auditoría para trazabilidad de HCE según Ley 25.326 (Habeas Data).
        """
        try:
            log_item = {
                "paciente_id": paciente_id,
                "entidad": entidad,
                "entidad_id": entidad_id,
                "accion": accion,
                "usuario_id": usuario_id,
                "usuario_nombre": usuario_nombre,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "detalles": detalles or {},
                "created_at": "now()"
            }
            supabase.table("hce_audit_logs").insert(log_item).execute()
        except Exception as audit_err:
            logger.warning(f"No se pudo registrar HCE audit log: {audit_err}")

    @staticmethod
    def sign_consulta(
        consulta_id: str,
        user_payload: Optional[Dict[str, Any]] = None,
        profesional_override: Optional[Dict[str, str]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Firma electrónicamente una consulta médica cerrándola de forma inmutable.
        Genera un hash SHA-256 canónico de los datos clínicos e inyecta la evolución en Geclisa (1-clic).
        Cumple con Ley 26.529 (Inmutabilidad), Ley 25.326 (Habeas Data) y Ley 27.553 (Firma/Identificación).
        """
        try:
            c_res = supabase.table("consultas_oftalmo").select("*").eq("id", consulta_id).limit(1).execute()
            if not c_res.data:
                raise ValueError(f"Consulta {consulta_id} no encontrada.")

            c_data = c_res.data[0]
            if c_data.get("estado_legal") in ["SIGNED", "AMENDED"]:
                return {"success": True, "already_signed": True, "consulta": c_data}

            paciente_id = c_data.get("paciente_id")

            # 1. Determinar datos del profesional actuante
            user_id = user_payload.get("sub") or user_payload.get("id") if user_payload else None
            profesional_nombre = c_data.get("profesional_nombre") or ""
            profesional_matricula = c_data.get("profesional_matricula") or ""

            if user_id:
                try:
                    u_res = supabase.table("usuarios_perfil").select("id, nombre_completo, geclisa_matricula").eq("id", user_id).limit(1).execute()
                    if u_res.data:
                        u = u_res.data[0]
                        profesional_nombre = u.get("nombre_completo") or profesional_nombre
                        profesional_matricula = u.get("geclisa_matricula") or profesional_matricula
                except Exception as u_err:
                    logger.debug(f"No se pudo resolver usuario_perfil para {user_id}: {u_err}")

            if profesional_override:
                if profesional_override.get("nombre"):
                    profesional_nombre = profesional_override["nombre"]
                if profesional_override.get("matricula"):
                    profesional_matricula = profesional_override["matricula"]

            if not profesional_nombre:
                profesional_nombre = "Médico Oftalmólogo Responsable"

            # 2. Generar Hash Criptográfico SHA-256 canónico (Inviolabilidad Ley 26.529 Art. 15)
            now_iso = datetime.now(timezone.utc).isoformat()
            canonical_record = {
                "consulta_id": str(consulta_id),
                "paciente_id": str(paciente_id),
                "fecha": str(c_data.get("fecha")),
                "profesional_nombre": profesional_nombre,
                "profesional_matricula": profesional_matricula,
                "motivo_consulta": c_data.get("motivo_consulta") or "",
                "agudeza_visual": c_data.get("agudeza_visual") or {},
                "refraccion": c_data.get("refraccion") or {},
                "biomicroscopia": c_data.get("biomicroscopia") or {},
                "fondo_ojo": c_data.get("fondo_ojo") or {},
                "presion_intraocular": c_data.get("presion_intraocular") or {},
                "conducta": c_data.get("conducta") or {},
                "signed_at": now_iso
            }
            canonical_json = json.dumps(canonical_record, sort_keys=True, default=str)
            signature_sha256 = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

            # 3. Guardar estado legal firmado
            update_fields = {
                "estado_legal": "SIGNED",
                "signed_at": now_iso,
                "profesional_user_id": user_id,
                "profesional_nombre": profesional_nombre,
                "profesional_matricula": profesional_matricula,
                "signature_sha256": signature_sha256,
                "geclisa_sync_status": "SYNCING",
                "updated_at": "now()"
            }
            res_upd = supabase.table("consultas_oftalmo").update(update_fields).eq("id", consulta_id).execute()
            signed_consulta = res_upd.data[0] if res_upd.data else {**c_data, **update_fields}

            # 4. Sincronización automática unificada con Geclisa (1-Clic)
            sync_result = {}
            try:
                sync_result = HistoriaOftalmoService.sincronizar_con_geclisa(consulta_id)
                status_sync = "SYNCED" if sync_result.get("success") else "ERROR"
                supabase.table("consultas_oftalmo").update({"geclisa_sync_status": status_sync}).eq("id", consulta_id).execute()
                signed_consulta["geclisa_sync_status"] = status_sync
                if sync_result.get("hc_id"):
                    signed_consulta["geclisa_hc_id"] = sync_result["hc_id"]
            except Exception as sync_ex:
                logger.warning(f"Aviso: Falló sincronización con Geclisa al firmar consulta {consulta_id}: {sync_ex}")
                supabase.table("consultas_oftalmo").update({"geclisa_sync_status": "ERROR"}).eq("id", consulta_id).execute()
                signed_consulta["geclisa_sync_status"] = "ERROR"

            # 5. Registro inmutable en HCE Audit Log (Ley 25.326)
            HistoriaOftalmoService.registrar_audit_log(
                paciente_id=paciente_id,
                entidad="CONSULTA",
                entidad_id=consulta_id,
                accion="SIGN",
                usuario_id=user_id,
                usuario_nombre=profesional_nombre,
                ip_address=ip_address,
                user_agent=user_agent,
                detalles={
                    "signature_sha256": signature_sha256,
                    "signed_at": now_iso,
                    "profesional_matricula": profesional_matricula,
                    "geclisa_sync": sync_result.get("success", False)
                }
            )

            return {
                "success": True,
                "consulta": signed_consulta,
                "signature_sha256": signature_sha256,
                "geclisa_result": sync_result
            }
        except Exception as e:
            logger.error(f"Error firmando consulta {consulta_id}: {e}")
            raise

    @staticmethod
    def add_enmienda(
        consulta_id: str,
        motivo_enmienda: str,
        texto_adenda: str,
        user_payload: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Registra una adenda/enmienda formal foliada a una consulta médica firmada (Ley 26.529 Art. 15).
        No altera los datos clínicos originales del asiento médico.
        """
        try:
            c_res = supabase.table("consultas_oftalmo").select("id, paciente_id, estado_legal, profesional_nombre, profesional_matricula, geclisa_hc_id, geclisa_sync_status").eq("id", consulta_id).limit(1).execute()
            if not c_res.data:
                raise ValueError(f"Consulta {consulta_id} no encontrada.")

            c_data = c_res.data[0]
            paciente_id = c_data.get("paciente_id")

            user_id = user_payload.get("sub") or user_payload.get("id") if user_payload else None
            prof_nombre = c_data.get("profesional_nombre") or "Profesional Médico"
            prof_mat = c_data.get("profesional_matricula") or ""

            if user_id:
                try:
                    u_res = supabase.table("usuarios_perfil").select("id, nombre_completo, geclisa_matricula").eq("id", user_id).limit(1).execute()
                    if u_res.data:
                        u = u_res.data[0]
                        prof_nombre = u.get("nombre_completo") or prof_nombre
                        prof_mat = u.get("geclisa_matricula") or prof_mat
                except Exception:
                    pass

            now_iso = datetime.now(timezone.utc).isoformat()
            hash_raw = f"{consulta_id}:{paciente_id}:{motivo_enmienda}:{texto_adenda}:{now_iso}"
            enm_sha256 = hashlib.sha256(hash_raw.encode("utf-8")).hexdigest()

            enmienda_record = {
                "consulta_id": consulta_id,
                "paciente_id": paciente_id,
                "profesional_user_id": user_id,
                "profesional_nombre": prof_nombre,
                "profesional_matricula": prof_mat,
                "motivo_enmienda": motivo_enmienda,
                "texto_adenda": texto_adenda,
                "signature_sha256": enm_sha256,
                "created_at": now_iso
            }

            res = supabase.table("consultas_oftalmo_enmiendas").insert(enmienda_record).execute()
            saved_enmienda = res.data[0] if res.data else enmienda_record

            # Actualizar estado de la consulta a AMENDED
            supabase.table("consultas_oftalmo").update({"estado_legal": "AMENDED"}).eq("id", consulta_id).execute()

            # Re-sincronizar con Geclisa si la consulta ya estaba sincronizada para reflejar la adenda foliada
            geclisa_sync_res = None
            if c_data.get("geclisa_hc_id") or c_data.get("geclisa_sync_status") == "SYNCED":
                try:
                    geclisa_sync_res = HistoriaOftalmoService.sincronizar_con_geclisa(consulta_id, usuario_actual=user_payload)
                except Exception as gec_sync_err:
                    logger.warning(f"Aviso al re-sincronizar adenda con Geclisa para consulta {consulta_id}: {gec_sync_err}")

            # Registrar audit log
            HistoriaOftalmoService.registrar_audit_log(
                paciente_id=paciente_id,
                entidad="ENMIENDA",
                entidad_id=saved_enmienda.get("id"),
                accion="AMEND",
                usuario_id=user_id,
                usuario_nombre=prof_nombre,
                ip_address=ip_address,
                user_agent=user_agent,
                detalles={
                    "consulta_id": consulta_id,
                    "motivo_enmienda": motivo_enmienda,
                    "signature_sha256": enm_sha256,
                    "geclisa_resync": bool(geclisa_sync_res and geclisa_sync_res.get("success"))
                }
            )

            return {"success": True, "enmienda": saved_enmienda, "geclisa_sync": geclisa_sync_res}
        except Exception as e:
            logger.error(f"Error agregando enmienda a consulta {consulta_id}: {e}")
            raise

    @staticmethod
    def get_enmiendas(consulta_id: str) -> Dict[str, Any]:
        """Obtiene las adendas/enmiendas foliadas cronológicas de una consulta."""
        try:
            res = supabase.table("consultas_oftalmo_enmiendas").select("*").eq("consulta_id", consulta_id).order("created_at", desc=False).execute()
            return {"success": True, "enmiendas": res.data or []}
        except Exception as e:
            logger.error(f"Error obteniendo enmiendas para consulta {consulta_id}: {e}")
            raise

    @staticmethod
    def get_audit_logs(paciente_id: str, limit: int = 50) -> Dict[str, Any]:
        """Obtiene el historial de auditoría de HCE para un paciente (Ley 25.326)."""
        try:
            res = supabase.table("hce_audit_logs").select("*").eq("paciente_id", paciente_id).order("created_at", desc=True).limit(limit).execute()
            return {"success": True, "logs": res.data or []}
        except Exception as e:
            logger.error(f"Error obteniendo audit logs para paciente {paciente_id}: {e}")
            raise

    # ====================================================================
    # FASE 3: CONECTORES TRANSACCIONALES WHATSAPP, WORKLIST Y LINKS EFÍMEROS
    # ====================================================================

    @staticmethod
    def despachar_resumen_whatsapp(
        paciente_id: str,
        consulta_id: str,
        texto_mensaje: str,
        user_payload: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Despacha directamente el resumen/epicrisis de la consulta médica al WhatsApp del paciente
        utilizando Meta WhatsApp Cloud API e inyectándolo en el hilo conversacional del CRM.
        """
        try:
            # 1. Obtener datos del paciente
            p_res = supabase.table("pacientes").select("id, nombre, telefono, dni").eq("id", paciente_id).limit(1).execute()
            if not p_res.data:
                raise ValueError(f"Paciente {paciente_id} no encontrado.")
            pac = p_res.data[0]
            telefono = pac.get("telefono")
            if not telefono:
                raise ValueError("El paciente no tiene un número de celular configurado.")

            user_id = user_payload.get("sub") or user_payload.get("id") if user_payload else None
            user_name = "Médico Oftalmólogo"
            if user_id:
                try:
                    u_res = supabase.table("usuarios_perfil").select("nombre_completo").eq("id", user_id).limit(1).execute()
                    if u_res.data and u_res.data[0].get("nombre_completo"):
                        user_name = u_res.data[0]["nombre_completo"]
                except Exception:
                    pass

            # 2. Despachar mensaje vía Meta WhatsApp Cloud API
            from app.whatsapp import whatsapp_manager
            res_wa = whatsapp_manager.enviar_mensaje(
                telefono_o_jid=telefono,
                texto=texto_mensaje,
                emisor="medico",
                usuario_id=user_id,
                usuario_nombre=user_name
            )

            wamid = res_wa.get("wamid") or res_wa.get("id") or ""
            error_wa = res_wa.get("error")

            # 3. Registrar timestamp en la consulta
            now_iso = datetime.now(timezone.utc).isoformat()
            supabase.table("consultas_oftalmo").update({
                "resumen_enviado_at": now_iso
            }).eq("id", consulta_id).execute()

            # 4. Programar Triggers de Seguimiento Clínico si aplica
            try:
                c_res = supabase.table("consultas_oftalmo").select("tipo, datos_postop, conducta").eq("id", consulta_id).limit(1).execute()
                if c_res.data:
                    c_data = c_res.data[0]
                    tipo = c_data.get("tipo")
                    datos_postop = c_data.get("datos_postop") or {}
                    conducta = c_data.get("conducta") or {}
                    
                    # Si es postop o tiene cirugía programada, programar seguimiento a las 24 hs
                    if tipo == "postop" or datos_postop.get("fecha_cx") or conducta.get("plan_cx"):
                        fecha_24h = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
                        supabase.table("hce_scheduled_triggers").insert({
                            "paciente_id": paciente_id,
                            "consulta_id": consulta_id,
                            "tipo_trigger": "CONTROL_POSTOP_24H",
                            "fecha_programada": fecha_24h,
                            "estado": "PENDING",
                            "payload_mensaje": {
                                "tipo": "postop_24h",
                                "paciente_nombre": pac.get("nombre"),
                                "telefono": telefono
                            }
                        }).execute()
            except Exception as trig_err:
                logger.warning(f"Aviso programando triggers automáticos: {trig_err}")

            # 5. Registrar en audit log
            HistoriaOftalmoService.registrar_audit_log(
                paciente_id=paciente_id,
                entidad="CONSULTA",
                entidad_id=consulta_id,
                accion="SHARE_WA",
                usuario_id=user_id,
                usuario_nombre=user_name,
                ip_address=ip_address,
                user_agent=user_agent,
                detalles={
                    "telefono": telefono,
                    "wamid": wamid,
                    "error": error_wa,
                    "enviado_real": res_wa.get("enviado_real", True)
                }
            )

            if error_wa and not res_wa.get("enviado_real", False):
                return {
                    "success": False,
                    "error": error_wa,
                    "telefono": telefono,
                    "requiere_wa_me": "window" in str(error_wa).lower() or "template" in str(error_wa).lower()
                }

            return {
                "success": True,
                "wamid": wamid,
                "telefono": telefono,
                "resumen_enviado_at": now_iso
            }
        except Exception as e:
            logger.error(f"Error despachando resumen WhatsApp para paciente {paciente_id}: {e}")
            raise

    @staticmethod
    def crear_token_descarga_estudio(
        estudio_id: str,
        ttl_horas: int = 72,
        user_payload: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Genera un token efímero seguro (con TTL) para descarga de estudios médicos según Ley 25.326.
        Requiere validación de factor DNI para acceso del paciente sin login.
        """
        try:
            est_res = supabase.table("estudios_oftalmo").select("*").eq("id", estudio_id).limit(1).execute()
            if not est_res.data:
                raise ValueError(f"Estudio {estudio_id} no encontrado.")
            est = est_res.data[0]
            paciente_id = est.get("paciente_id")
            if not paciente_id:
                raise ValueError("El estudio no tiene un paciente asociado.")

            # Obtener últimos 4 dígitos de DNI del paciente (o últimos 4 dígitos del teléfono si carece de DNI)
            p_res = supabase.table("pacientes").select("id, dni, nombre, telefono").eq("id", paciente_id).limit(1).execute()
            p_row = p_res.data[0] if p_res.data else {}
            dni_raw = str(p_row.get("dni") or est.get("dni_paciente") or "")
            dni_digits = "".join(filter(str.isdigit, dni_raw))
            tel_raw = str(p_row.get("telefono") or est.get("telefono_destino") or "")
            tel_digits = "".join(filter(str.isdigit, tel_raw))

            if len(dni_digits) >= 4:
                dni_last4 = dni_digits[-4:]
                dni_last4_hint = " últimos 4 dígitos de su DNI"
            elif len(tel_digits) >= 4:
                dni_last4 = tel_digits[-4:]
                dni_last4_hint = " últimos 4 dígitos de su teléfono celular (sin DNI registrado)"
            else:
                dni_last4 = "1234"
                dni_last4_hint = " código temporal 1234 (sin DNI ni teléfono registrado)"

            token_hash = secrets.token_urlsafe(32)
            now = datetime.now(timezone.utc)
            expires_at = (now + timedelta(hours=ttl_horas)).isoformat()

            share_item = {
                "token_hash": token_hash,
                "paciente_id": paciente_id,
                "estudio_id": estudio_id,
                "consulta_id": est.get("consulta_id"),
                "archivo_url": est.get("archivo_url") or "",
                "archivo_nombre": est.get("archivo_nombre") or est.get("nombre_archivo") or "informe_estudio.pdf",
                "mime_type": est.get("mime_type") or "application/pdf",
                "dni_last4": dni_last4,
                "expires_at": expires_at,
                "accesos_count": 0,
                "max_accesos": 10,
                "created_at": "now()"
            }
            ins_res = supabase.table("hce_document_share_tokens").insert(share_item).execute()

            return {
                "success": True,
                "token": token_hash,
                "expires_at": expires_at,
                "dni_last4": dni_last4,
                "dni_last4_hint": dni_last4_hint.strip(),
                "archivo_nombre": share_item["archivo_nombre"],
                "paciente_nombre": p_row.get("nombre") or "",
                "telefono": p_row.get("telefono") or ""
            }
        except Exception as e:
            logger.error(f"Error creando token de descarga de estudio {estudio_id}: {e}")
            raise

    @staticmethod
    def validar_y_obtener_estudio_token(token_hash: str, dni_last4_input: Optional[str] = None) -> Dict[str, Any]:
        """
        Valida el token efímero y el 2do factor (últimos 4 dígitos del DNI).
        """
        try:
            tok_res = supabase.table("hce_document_share_tokens").select("*").eq("token_hash", token_hash).limit(1).execute()
            if not tok_res.data:
                raise ValueError("El enlace de descarga es inválido o ha sido revocado.")

            token_data = tok_res.data[0]
            expires_at_str = token_data.get("expires_at")
            if expires_at_str:
                exp_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > exp_dt:
                    raise ValueError("El enlace seguro ha expirado por motivos de privacidad (Ley 25.326). Solicite uno nuevo a la clínica.")

            if token_data.get("accesos_count", 0) >= token_data.get("max_accesos", 10):
                raise ValueError("Se ha alcanzado el límite máximo de descargas para este enlace.")

            # Validación de DNI de 4 dígitos
            if dni_last4_input:
                clean_in = "".join(filter(str.isdigit, str(dni_last4_input)))[-4:]
                if clean_in != token_data.get("dni_last4"):
                    raise ValueError("Los últimos 4 dígitos del DNI ingresados no son correctos.")

            # Registrar acceso
            supabase.table("hce_document_share_tokens").update({
                "accesos_count": token_data.get("accesos_count", 0) + 1,
                "ultimo_acceso_at": "now()"
            }).eq("id", token_data["id"]).execute()

            return {
                "success": True,
                "archivo_url": token_data["archivo_url"],
                "archivo_nombre": token_data["archivo_nombre"],
                "mime_type": token_data["mime_type"],
                "paciente_id": token_data["paciente_id"]
            }
        except Exception as e:
            logger.error(f"Error validando token de descarga {token_hash}: {e}")
            raise

    @staticmethod
    def get_worklist_estudios(estado: str = "PENDIENTE", limit: int = 50) -> Dict[str, Any]:
        """
        Obtiene la lista de trabajo (Worklist) de estudios complementarios solicitados en consultorio
        para los técnicos de diagnóstico.
        """
        try:
            q = supabase.table("pedidos_estudios_oftalmo").select("*, pacientes(id, nombre, dni, telefono, obra_social, plan_cobertura)")
            if estado and estado != "TODOS":
                q = q.eq("estado", estado)
            res = q.order("fecha", desc=True).order("created_at", desc=True).limit(limit).execute()
            return {"success": True, "pedidos": res.data or []}
        except Exception as e:
            logger.error(f"Error obteniendo worklist de estudios: {e}")
            raise

    @staticmethod
    def completar_pedido_worklist(
        pedido_id: str,
        estudio_id: str,
        user_payload: Optional[Dict[str, Any]] = None,
        notificar_whatsapp: bool = True
    ) -> Dict[str, Any]:
        """
        Marca un pedido de estudio como COMPLETADO en la Worklist del técnico,
        lo vincula al estudio digitalizado y opcionalmente notifica al paciente con link efímero.
        """
        try:
            user_id = user_payload.get("sub") or user_payload.get("id") if user_payload else None
            user_name = "Técnico de Estudios"
            if user_id:
                try:
                    u_res = supabase.table("usuarios_perfil").select("nombre_completo").eq("id", user_id).limit(1).execute()
                    if u_res.data and u_res.data[0].get("nombre_completo"):
                        user_name = u_res.data[0]["nombre_completo"]
                except Exception:
                    pass

            now_iso = datetime.now(timezone.utc).isoformat()
            upd = {
                "estado": "COMPLETADO",
                "estudio_oftalmo_id": estudio_id,
                "completado_at": now_iso,
                "tecnico_usuario_id": user_id,
                "tecnico_nombre": user_name
            }
            res = supabase.table("pedidos_estudios_oftalmo").update(upd).eq("id", pedido_id).execute()
            pedido = res.data[0] if res.data else upd

            # Si se solicita notificación por WhatsApp
            notif_res = {}
            if notificar_whatsapp and pedido.get("paciente_id"):
                try:
                    tok_data = HistoriaOftalmoService.crear_token_descarga_estudio(estudio_id=estudio_id, ttl_horas=72)
                    tel = tok_data.get("telefono")
                    if tel:
                        p_nom = tok_data.get("paciente_nombre") or "Paciente"
                        doc_nom = tok_data.get("archivo_nombre") or "informe de estudio"
                        token = tok_data.get("token")
                        base_url = (
                            os.getenv("FRONTEND_URL")
                            or os.getenv("NEXT_PUBLIC_API_URL")
                            or "https://crm-agentico-nube.vercel.app"
                        ).rstrip("/")
                        msg = (
                            f"Hola *{p_nom}*, tu estudio oftalmológico (*{doc_nom}*) ya se encuentra disponible.\n\n"
                            f"Puedes acceder al informe seguro en el siguiente enlace:\n"
                            f"{base_url}/api/oftalmo/estudios/descargar/{token}\n\n"
                            f"*(Por tu seguridad, el sistema te solicitará los últimos 4 dígitos de tu DNI para validar tu identidad - Enlace válido por 72 hs).*"
                        )
                        from app.whatsapp import whatsapp_manager
                        notif_res = whatsapp_manager.enviar_mensaje(telefono_o_jid=tel, texto=msg, emisor="tecnico")
                except Exception as ex_notif:
                    logger.warning(f"Aviso notificando al paciente sobre estudio completado: {ex_notif}")

            return {"success": True, "pedido": pedido, "notificacion": notif_res}
        except Exception as e:
            logger.error(f"Error completando pedido worklist {pedido_id}: {e}")
            raise
