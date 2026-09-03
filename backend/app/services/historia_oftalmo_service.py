import logging
import math
import uuid
from datetime import datetime, date, timezone
from typing import Dict, Any, List, Optional
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

            estudios_res = supabase.table("estudios_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            estudios = estudios_res.data or []

            recetas_ant_res = supabase.table("recetas_anteojos_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            recetas_anteojos = recetas_ant_res.data or []

            recetas_farm_res = supabase.table("recetas_farmacos_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            recetas_farmacos = recetas_farm_res.data or []

            pedidos_res = supabase.table("pedidos_estudios_oftalmo").select("*").eq("paciente_id", paciente_id).order("fecha", desc=True).execute()
            pedidos_estudios = pedidos_res.data or []

            return {
                "success": True,
                "paciente": paciente,
                "historia": historia,
                "consultas": consultas,
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
            hc_update = {
                "antecedentes_oculares": data.get("antecedentes_oculares", []),
                "antecedentes_generales": data.get("antecedentes_generales", []),
                "medicacion_habitual": data.get("medicacion_habitual", []),
                "medicacion_otra": data.get("medicacion_otra", ""),
                "alergias": data.get("alergias", ""),
                "observaciones_permanentes": data.get("observaciones_permanentes", ""),
                "extra_catalogos": data.get("extra_catalogos", {}),
                "updated_at": "now()"
            }
            res = supabase.table("historias_clinicas_oftalmo").update(hc_update).eq("paciente_id", paciente_id).execute()

            paciente_fields = {}
            for k in ["nombre", "dni", "nro_hc", "fecha_nacimiento", "sexo", "telefono", "obra_social", "plan_cobertura"]:
                if k in data and data[k] is not None:
                    paciente_fields[k] = data[k]
            if paciente_fields:
                supabase.table("pacientes").update(paciente_fields).eq("id", paciente_id).execute()

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
            if consulta_id:
                res = supabase.table("consultas_oftalmo").update(registro).eq("id", consulta_id).execute()
                saved_consulta = res.data[0] if res.data else registro
            else:
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

            return {"success": True, "consulta": saved_consulta}
        except Exception as e:
            logger.error(f"Error en save_consulta: {e}")
            raise

    @staticmethod
    def delete_consulta(consulta_id: str) -> Dict[str, Any]:
        try:
            supabase.table("consultas_oftalmo").delete().eq("id", consulta_id).execute()
            return {"success": True, "deleted_id": consulta_id}
        except Exception as e:
            logger.error(f"Error eliminando consulta {consulta_id}: {e}")
            raise

    @staticmethod
    def sincronizar_con_geclisa(consulta_id: str) -> Dict[str, Any]:
        try:
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

            tipo_label = "Control Postoperatorio" if c.get("tipo") == "postop" else "Consulta Oftalmológica"
            fecha_str = c.get("fecha", "")
            prof = c.get("profesional_nombre") or "Oftalmología CREO"
            motivo = c.get("motivo_consulta") or ""
            rx = c.get("refraccion") or {}
            rx_od = rx.get("od") or {}
            rx_oi = rx.get("oi") or {}
            rx_str = f"OD: {rx_od.get('esf','')} {rx_od.get('cil','')} x {rx_od.get('eje','')} (EE {rx_od.get('ee','')}) | OI: {rx_oi.get('esf','')} {rx_oi.get('cil','')} x {rx_oi.get('eje','')} (EE {rx_oi.get('ee','')})"
            conducta = c.get("conducta") or {}
            plan = conducta.get("plan_cx") or ""
            indicaciones = c.get("indicaciones_texto") or ""

            texto_informe = (
                f"=== INFORME {tipo_label.upper()} ===\n"
                f"Fecha: {fecha_str} | Profesional: {prof}\n"
                f"Paciente: {paciente.get('nombre','')} (DNI: {paciente.get('dni','')})\n"
                f"Motivo: {motivo}\n\n"
                f"-- REFRACCIÓN Y EXAMEN --\n"
                f"{rx_str}\n\n"
                f"-- CONDUCTA Y PLAN --\n"
                f"Conducta: {plan}\n"
                f"Indicaciones: {indicaciones}\n"
                f"Próximo control: {c.get('proximo_control','')}\n"
                f"\nRegistrado vía CRM Oftalmológico Integrado."
            )

            contenido_bytes = texto_informe.encode("utf-8")
            nombre_archivo = f"HC_Oftalmo_{fecha_str}_{consulta_id[:8]}.txt"

            geclisa = GeclisaClient()
            subida = geclisa.adjuntar_archivo_historia_clinica(
                ficha_id=int(ficha_id),
                archivo_bytes=contenido_bytes,
                nombre_archivo=nombre_archivo,
                titulo=f"{tipo_label} {fecha_str}",
                observaciones=f"Registro oftalmológico {prof}",
                ac_id=1
            )
            now_iso = datetime.now(timezone.utc).isoformat()
            as_id = subida.get("as_id") or subida.get("asId")
            supabase.table("consultas_oftalmo").update({
                "sincronizado_geclisa_at": now_iso,
                "geclisa_as_id": as_id
            }).eq("id", consulta_id).execute()

            return {
                "success": True,
                "sincronizado": True,
                "geclisa_as_id": as_id,
                "mensaje": "Informe sincronizado y adjuntado a la ficha de Geclisa con éxito."
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
        od = data.get("od") or {}
        oi = data.get("oi") or {}
        item = {
            "paciente_id": paciente_id,
            "consulta_id": data.get("consulta_id"),
            "fecha": data.get("fecha") or str(date.today()),
            "tipo_lente": data.get("tipo_lente") or data.get("tipo", ""),
            "od_esfera": od.get("esf", ""),
            "od_cilindro": od.get("cil", ""),
            "od_eje": od.get("eje", ""),
            "od_adicion": od.get("add", ""),
            "oi_esfera": oi.get("esf", ""),
            "oi_cilindro": oi.get("cil", ""),
            "oi_eje": oi.get("eje", ""),
            "oi_adicion": oi.get("add", ""),
            "dnp": data.get("dnp", ""),
            "tratamiento": data.get("tratamiento", ""),
            "indicaciones_optico": data.get("indicaciones_optico") or data.get("notas", "")
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
    def save_pedidos_estudios(paciente_id: str, pedidos: List[Dict[str, Any]]) -> Dict[str, Any]:
        saved = []
        lote_id = str(uuid.uuid4())
        for p in pedidos:
            item = {
                "paciente_id": paciente_id,
                "consulta_id": p.get("consulta_id"),
                "lote_id": p.get("lote_id") or lote_id,
                "fecha": p.get("fecha") or str(date.today()),
                "grupo_preset": p.get("grupo_preset") or p.get("grupo", ""),
                "titulo": p.get("titulo", "Pedido de estudios"),
                "items": p.get("items") or [p.get("titulo", "")],
                "diagnostico": p.get("diagnostico") or p.get("dx", ""),
                "observaciones": p.get("observaciones") or p.get("nota", ""),
                "created_at": "now()"
            }
            res = supabase.table("pedidos_estudios_oftalmo").insert(item).execute()
            if res.data:
                saved.append(res.data[0])
        return {"success": True, "pedidos": saved}

    @staticmethod
    def delete_pedidos_estudios(lote_o_id: str) -> Dict[str, Any]:
        supabase.table("pedidos_estudios_oftalmo").delete().or_(f"id.eq.{lote_o_id},lote_id.eq.{lote_o_id}").execute()
        return {"success": True, "deleted": lote_o_id}
