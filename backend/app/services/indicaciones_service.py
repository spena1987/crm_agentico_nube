import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import unicodedata

from app.db import supabase, is_valid_uuid
from app.services.geclisa_client import geclisa_client
from app.services.indicaciones_pdf_service import generar_pdf_indicacion_medica
from app.whatsapp import whatsapp_manager
from app.services.phone_normalizer import normalize_phone_number

logger = logging.getLogger("indicaciones_service")


def normalizar_texto(texto: str) -> str:
    """Normaliza texto eliminando acentos y convirtiendo a minúsculas para matching flexible."""
    if not texto:
        return ""
    nfkd = unicodedata.normalize('NFKD', texto)
    return ''.join([c for c in nfkd if not unicodedata.combining(c)]).lower().strip()


def importar_plantilla_geclisa_a_crm(pim_id: int) -> Dict[str, Any]:
    """
    Importa una plantilla de Geclisa al catálogo institucional del CRM (plantillas_indicaciones_crm).
    Permite su posterior edición de texto, fármacos y activación/desactivación.
    """
    if not supabase:
        return {"success": False, "error": "Base de datos no disponible"}
    
    plantillas_geclisa = geclisa_client.listar_plantillas_indicaciones_geclisa()
    match = next((p for p in plantillas_geclisa if p.get("pimId") == pim_id), None)
    if not match:
        return {"success": False, "error": f"Plantilla Geclisa #{pim_id} no encontrada"}
    
    titulo = match.get("pimNombre") or f"Plantilla Geclisa #{pim_id}"
    cuerpo = match.get("pimTexto") or ""
    
    cat = "Oftalmología"
    norm = normalizar_texto(titulo)
    if "catar" in norm or "faco" in norm:
        cat = "Cataratas"
    elif "retin" in norm or "avastin" in norm or "eylea" in norm or "inyecc" in norm:
        cat = "Retina"
    elif "lasik" in norm or "prk" in norm or "refractiv" in norm:
        cat = "Refractiva"
    elif "glaucom" in norm:
        cat = "Glaucoma"
    
    tipo_fase = "prequirurgico" if "pre" in norm else "postquirurgico"

    nueva_plantilla = {
        "titulo": titulo,
        "categoria": cat,
        "geclisa_pim_id": pim_id,
        "tipo_fase": tipo_fase,
        "cuerpo_indicaciones": cuerpo,
        "medicamentos": [],
        "cuidados_generales": "- Uso de protector ocular transparente para dormir.\n- No refregar el ojo ni hacer esfuerzos físicos.",
        "pautas_alarma": "Ante dolor agudo o disminución abrupta de la visión, acudir a la guardia 24 hs.",
        "activo": True
    }
    
    res = supabase.table("plantillas_indicaciones_crm").insert(nueva_plantilla).execute()
    item = res.data[0] if res.data else nueva_plantilla
    return {"success": True, "plantilla": item}





def resolver_plantilla_sugerida(
    practica_nombre: Optional[str] = None,
    practica_codigo: Optional[str] = None,
    medico_nombre: Optional[str] = None,
    practica_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Algoritmo determinístico y estricto de resolución de plantilla de indicaciones:
    1. Si la práctica está en el Nomenclador, consulta 'habilitar_indicaciones'.
       Si está desactivada (False), NO aplica fallback arbitrario y retorna requiere_seleccion_manual = True.
    2. Si está activada (True), evalúa en orden:
       a) Reglas específicas por cirujano en 'indicaciones_reglas_cirujano'
       b) Plantilla institucional vinculada en el CRM ('plantilla_indicacion_id')
       c) Plantilla predeterminada de Geclisa ('geclisa_pim_id_default')
       d) Match directo en Geclisa por apellido de cirujano + tipo de práctica
    3. Si la práctica no existe en el Nomenclador o no tiene plantilla configurada, NO inventa
       medicamentos (cero fallback ciego a cataratas), sino que solicita selección manual limpia.
    """
    med_norm = normalizar_texto(medico_nombre or "")
    cirujano_tokens = [tok for tok in med_norm.split() if len(tok) >= 4 and tok not in ["doctor", "dra.", "dr.", "medico"]]
    prac_norm = normalizar_texto(practica_nombre or "")

    plantilla_seleccionada = None
    origen = "sin_coincidencia"
    p_db = None

    # 1. Consultar Nomenclador en Supabase
    if supabase and (practica_id or practica_codigo or practica_nombre):
        try:
            q = supabase.table("nomenclador_practicas").select("*, plantillas_indicaciones_crm(*)")
            if practica_id and is_valid_uuid(practica_id):
                q = q.eq("id", practica_id)
            elif practica_codigo:
                q = q.eq("codigo", practica_codigo)
            elif practica_nombre:
                q = q.ilike("nombre", f"%{practica_nombre.strip()}%")
            
            res = q.limit(1).execute()
            if res.data and len(res.data) > 0:
                p_db = res.data[0]
        except Exception as e_nom:
            logger.warning(f"Error consultando nomenclador para indicaciones: {e_nom}")

    # Si la práctica existe en el Nomenclador y tiene las indicaciones DESHABILITADAS:
    if p_db is not None:
        habilitada = bool(p_db.get("habilitar_indicaciones", False))
        if not habilitada:
            return {
                "success": True,
                "sugerencia": None,
                "habilitada": False,
                "requiere_seleccion_manual": True,
                "origen_resolucion": "practica_deshabilitada",
                "mensaje": f"La práctica '{p_db.get('nombre')}' tiene desactivado el protocolo de indicaciones médicas en el Nomenclador."
            }

    # Obtener catálogo de Geclisa si se requiere buscar plantilla
    plantillas_geclisa = geclisa_client.listar_plantillas_indicaciones_geclisa()

    # Si la práctica tiene indicaciones HABILITADAS en el Nomenclador:
    if p_db is not None and bool(p_db.get("habilitar_indicaciones", False)):
        from app.db import get_indicaciones_de_practica
        indicaciones_rel = get_indicaciones_de_practica(p_db.get("id"))
        activas_rel = [r for r in indicaciones_rel if r.get("activo") and r.get("plantillas_indicaciones_crm")]

        if activas_rel:
            plantillas_crm_lista = [r["plantillas_indicaciones_crm"] for r in activas_rel if r["plantillas_indicaciones_crm"].get("activo")]
            if plantillas_crm_lista:
                # Si hay una o más indicaciones modulares asignadas (1 a N):
                todos_meds = []
                for p in plantillas_crm_lista:
                    for m in (p.get("medicamentos") or []):
                        if m not in todos_meds:
                            todos_meds.append(m)

                titulos = [p.get("titulo", "") for p in plantillas_crm_lista]
                textos = [p.get("cuerpo_indicaciones", "") for p in plantillas_crm_lista if p.get("cuerpo_indicaciones")]
                cuidados = [p.get("cuidados_generales", "") for p in plantillas_crm_lista if p.get("cuidados_generales")]
                alarmas = [p.get("pautas_alarma", "") for p in plantillas_crm_lista if p.get("pautas_alarma")]

                plantilla_seleccionada = {
                    "crm_plantilla_id": plantillas_crm_lista[0].get("id"),
                    "titulo": " + ".join(titulos),
                    "texto_indicaciones": "\n\n---\n\n".join(textos),
                    "medicamentos": todos_meds,
                    "cuidados_generales": "\n".join(cuidados),
                    "pautas_alarma": "\n".join(alarmas),
                    "config_diseno": plantillas_crm_lista[0].get("config_diseno") or {},
                    "modulos_asignados": plantillas_crm_lista,
                    "total_modulos": len(plantillas_crm_lista),
                    "origen": "nomenclador_modular_1_a_n"
                }
                origen = "nomenclador_modular_1_a_n"

        # a) Verificar reglas específicas por cirujano en JSONB
        reglas_cirujano = p_db.get("indicaciones_reglas_cirujano") or {}
        if isinstance(reglas_cirujano, dict) and cirujano_tokens:
            for tok in cirujano_tokens:
                if tok in reglas_cirujano:
                    target = reglas_cirujano[tok]
                    # Puede ser un pimId de Geclisa o un UUID de plantilla CRM
                    if isinstance(target, int):
                        for p in plantillas_geclisa:
                            if p.get("pimId") == target:
                                plantilla_seleccionada = {
                                    "geclisa_pim_id": p.get("pimId"),
                                    "titulo": p.get("pimNombre"),
                                    "texto_indicaciones": p.get("pimTexto"),
                                    "origen": "nomenclador_regla_cirujano"
                                }
                                origen = "nomenclador_regla_cirujano"
                                break
                    break

        # b) Plantilla CRM asociada a la práctica
        if not plantilla_seleccionada and p_db.get("plantillas_indicaciones_crm"):
            crm_p = p_db["plantillas_indicaciones_crm"]
            plantilla_seleccionada = {
                "crm_plantilla_id": crm_p.get("id"),
                "titulo": crm_p.get("titulo"),
                "texto_indicaciones": crm_p.get("cuerpo_indicaciones"),
                "medicamentos": crm_p.get("medicamentos") or [],
                "cuidados_generales": crm_p.get("cuidados_generales"),
                "pautas_alarma": crm_p.get("pautas_alarma"),
                "config_diseno": crm_p.get("config_diseno"),
                "origen": "nomenclador_crm"
            }
            origen = "nomenclador_crm"

        # c) Plantilla Geclisa por defecto asociada a la práctica
        if not plantilla_seleccionada and p_db.get("geclisa_pim_id_default"):
            pim_target = p_db.get("geclisa_pim_id_default")
            for p in plantillas_geclisa:
                if p.get("pimId") == pim_target:
                    plantilla_seleccionada = {
                        "geclisa_pim_id": p.get("pimId"),
                        "titulo": p.get("pimNombre"),
                        "texto_indicaciones": p.get("pimTexto"),
                        "origen": "nomenclador_geclisa_default"
                    }
                    origen = "nomenclador_geclisa_default"
                    break

    # Si aún no hay plantilla o la práctica no estaba en BD, verificar si Geclisa tiene una para este cirujano y técnica
    if not plantilla_seleccionada and cirujano_tokens and prac_norm:
        for p in plantillas_geclisa:
            nom_p_norm = normalizar_texto(p.get("pimNombre") or "")
            tiene_medico = any(t in nom_p_norm for t in cirujano_tokens)
            if tiene_medico:
                es_catarata = ("catar" in prac_norm or "faco" in prac_norm) and "catar" in nom_p_norm
                es_lasik = "lasik" in prac_norm and "lasik" in nom_p_norm
                es_prk = "prk" in prac_norm and "prk" in nom_p_norm
                es_cross = "cross" in prac_norm and "cross" in nom_p_norm
                es_vitrec = "vitrec" in prac_norm and "vitrec" in nom_p_norm
                
                if es_catarata or es_lasik or es_prk or es_cross or es_vitrec:
                    plantilla_seleccionada = {
                        "geclisa_pim_id": p.get("pimId"),
                        "titulo": p.get("pimNombre"),
                        "texto_indicaciones": p.get("pimTexto"),
                        "origen": "geclisa_cirujano"
                    }
                    origen = "geclisa_especifica_cirujano"
                    break

    # RETORNO DETERMINÍSTICO: Si no se configuró ni encontró plantilla adecuada,
    # NUNCA aplicar un fallback arbitrario (ej. gotas de cataratas a una inyección o pterigión).
    if not plantilla_seleccionada:
        return {
            "success": True,
            "sugerencia": None,
            "habilitada": True if p_db and p_db.get("habilitar_indicaciones") else False,
            "requiere_seleccion_manual": True,
            "origen_resolucion": "sin_plantilla_configurada",
            "mensaje": "Esta práctica no cuenta con un protocolo de indicaciones médicas preconfigurado. Seleccione una plantilla del catálogo si el cirujano lo solicita.",
            "total_plantillas_geclisa": len(plantillas_geclisa)
        }

    return {
        "success": True,
        "sugerencia": plantilla_seleccionada,
        "habilitada": True,
        "requiere_seleccion_manual": False,
        "origen_resolucion": origen,
        "total_plantillas_geclisa": len(plantillas_geclisa)
    }


def emitir_indicaciones_expediente(
    asesoria_id: str,
    enviar_whatsapp: bool = True,
    texto_override: Optional[str] = None,
    medicamentos_override: Optional[List[Dict[str, Any]]] = None,
    cuidados_override: Optional[str] = None,
    pautas_alarma_override: Optional[str] = None,
    usu_alta: str = "asesora_crm"
) -> Dict[str, Any]:
    """
    Proceso central de Emisión de Indicaciones Médicas:
    1. Obtiene el expediente quirúrgico (asesoría) y el paciente asociado.
    2. Emite la indicación médica en la base de datos de Geclisa (POST /api/IndicacionesMedicas)
       asociando el preId del médico cirujano seleccionado por la asesora.
    3. Genera el PDF con el branding de Centro Visión.
    4. Registra la auditoría en 'emisiones_indicaciones_geclisa' y actualiza el expediente.
    5. Si enviar_whatsapp es True, dispara el mensaje oficial con el enlace al PDF al paciente.
    """
    if not supabase or not is_valid_uuid(asesoria_id):
        return {"success": False, "error": "Identificador de expediente quirúrgico inválido o BD desconectada."}

    # 1. Recuperar asesoría y paciente
    try:
        res_as = supabase.table("asesorias_quirurgicas").select("*, pacientes(*)").eq("id", asesoria_id).limit(1).execute()
        if not res_as.data or len(res_as.data) == 0:
            return {"success": False, "error": f"No se encontró el expediente quirúrgico con ID {asesoria_id}."}
        
        asesoria = res_as.data[0]
        paciente = asesoria.get("pacientes") or {}
    except Exception as e:
        return {"success": False, "error": f"Error al consultar datos del expediente: {e}"}

    paciente_id = paciente.get("id")
    paciente_nombre = paciente.get("nombre") or "Paciente"
    paciente_dni = paciente.get("dni") or ""
    paciente_telefono = paciente.get("telefono") or ""
    paciente_os = asesoria.get("cobertura_obra_social") or paciente.get("obra_social") or "-"
    
    medico_id = asesoria.get("medico_cirujano_id")
    medico_nombre = asesoria.get("medico_cirujano_nombre") or "Médico Cirujano"
    medico_matricula = asesoria.get("medico_cirujano_matricula") or ""
    practica_nombre = asesoria.get("practica_nombre") or "Cirugía Oftalmológica"
    practica_codigo = asesoria.get("practica_codigo") or ""
    
    # 2. Resolver textos e instrucciones
    texto_final = texto_override
    meds_final = medicamentos_override
    cuidados_final = cuidados_override
    alarmas_final = pautas_alarma_override

    if not texto_final:
        sug = resolver_plantilla_sugerida(
            practica_nombre=practica_nombre,
            practica_codigo=practica_codigo,
            medico_nombre=medico_nombre
        )
        sug_data = sug.get("sugerencia") or {}
        texto_final = sug_data.get("texto_indicaciones") or sug_data.get("cuerpo_indicaciones") or "Indicaciones médicas postoperatorias."
        if meds_final is None:
            meds_final = sug_data.get("medicamentos") or []
        if cuidados_final is None:
            cuidados_final = sug_data.get("cuidados_generales") or ""
        if alarmas_final is None:
            alarmas_final = sug_data.get("pautas_alarma") or ""

    # 3. Emitir en la base de datos de GECLISA (POST /api/IndicacionesMedicas)
    geclisa_im_id = None
    geclisa_res = None
    ficha_id_geclisa = paciente.get("geclisa_paciente_id") or paciente.get("ficha_id")

    # Si no tiene fichaId registrada en paciente, intentar buscarla por DNI en Geclisa
    if not ficha_id_geclisa and paciente_dni:
        try:
            pac_geclisa = geclisa_client.buscar_paciente_por_dni(paciente_dni)
            if pac_geclisa.get("encontrado"):
                ficha_id_geclisa = pac_geclisa.get("ficha_id") or pac_geclisa.get("id")
        except Exception as e_dni:
            logger.warning(f"No se pudo consultar ficha por DNI en Geclisa: {e_dni}")

    # Si tenemos ficha y médico cirujano preId, asentamos en Geclisa
    if ficha_id_geclisa and medico_id:
        try:
            geclisa_res = geclisa_client.emitir_indicacion_medica_geclisa(
                ficha_id=int(ficha_id_geclisa),
                pre_id=int(medico_id),
                texto_indicacion=texto_final,
                es_internado=False,
                usu_alta=usu_alta,
                os_plan=paciente_os
            )
            if geclisa_res.get("success"):
                geclisa_im_id = geclisa_res.get("im_id")
        except Exception as e_geclisa:
            logger.error(f"Error al emitir indicación en Geclisa para expediente {asesoria_id}: {e_geclisa}")
    else:
        logger.info(f"Emisión local en CRM (ficha Geclisa: {ficha_id_geclisa}, preId: {medico_id})")

    # 4. Generar el PDF Institucional con ReportLab
    datos_emision_pdf = {
        "paciente_nombre": paciente_nombre,
        "paciente_dni": paciente_dni,
        "paciente_obra_social": paciente_os,
        "practica_nombre": practica_nombre,
        "ojo": asesoria.get("ojo") or "OD",
        "medico_nombre": medico_nombre,
        "medico_matricula": medico_matricula,
        "cuerpo_indicaciones": texto_final,
        "medicamentos": meds_final or [],
        "cuidados_generales": cuidados_final or "",
        "pautas_alarma": alarmas_final or "",
        "geclisa_im_id": geclisa_im_id
    }
    
    pdf_resultado = generar_pdf_indicacion_medica(datos_emision_pdf, guardar_en_disco=True)
    pdf_url = pdf_resultado.get("url")
    pdf_path = pdf_resultado.get("file_path")
    emision_uuid = pdf_resultado.get("emision_id")

    # 5. Registrar en auditoría 'emisiones_indicaciones_geclisa' y actualizar 'asesorias_quirurgicas'
    whatsapp_status = "pendiente" if (enviar_whatsapp and paciente_telefono) else "no_requerido"
    try:
        supabase.table("emisiones_indicaciones_geclisa").insert({
            "id": emision_uuid,
            "asesoria_id": asesoria_id,
            "paciente_id": paciente_id,
            "geclisa_im_id": geclisa_im_id,
            "geclisa_pre_id": medico_id,
            "medico_nombre": medico_nombre,
            "medico_matricula": medico_matricula,
            "practica_codigo": practica_codigo,
            "practica_nombre": practica_nombre,
            "texto_indicaciones": texto_final,
            "pdf_path": pdf_path,
            "pdf_url": pdf_url,
            "whatsapp_status": whatsapp_status
        }).execute()

        # Actualizar expediente quirúrgico
        supabase.table("asesorias_quirurgicas").update({
            "indicacion_geclisa_im_id": geclisa_im_id,
            "indicaciones_texto": texto_final,
            "indicaciones_emitidas_at": datetime.now().isoformat(),
            "indicaciones_pdf_url": pdf_url
        }).eq("id", asesoria_id).execute()
    except Exception as e_db:
        logger.error(f"Error registrando emisión en base de datos: {e_db}")

    # 6. Despacho automatizado por WhatsApp
    whatsapp_res = None
    if enviar_whatsapp and paciente_telefono:
        try:
            # Obtener URL base pública configurada en el CRM
            backend_base = os.getenv("BACKEND_URL", "https://crm.centrovision.com.ar").rstrip("/")
            full_pdf_link = f"{backend_base}{pdf_url}"
            
            ojo_actual = asesoria.get("ojo") or "OD"
            ojo_str = "👁️ *OJO DERECHO*" if "OD" in str(ojo_actual).upper() else "👁️ *OJO IZQUIERDO*" if "OI" in str(ojo_actual).upper() else f"👁️ *{ojo_actual}*"

            txt_low = str(texto_final or "").lower()
            es_orden_detectada = (
                "solicito:" in txt_low
                or "solicito " in txt_low
                or "orden medica" in txt_low
                or "orden médica" in txt_low
                or "pedido" in txt_low
            )

            if es_orden_detectada:
                mensaje_wa = (
                    f"📋 *ORDEN MÉDICA OFICIAL - CENTRO VISIÓN*\n\n"
                    f"Estimado/a *{paciente_nombre}*,\n"
                    f"Le acercamos la orden médica oficial y solicitud de práctica correspondiente a *{practica_nombre}*, "
                    f"emitida bajo indicación del *{medico_nombre}*.\n\n"
                    f"• *Procedimiento:* {practica_nombre}\n"
                    f"• *Intervención:* {ojo_str}\n\n"
                    f"📄 *Descargue su orden médica oficial aquí:*\n{full_pdf_link}\n\n"
                    f"📌 *Información Importante:* Presente esta orden oficial ante su cobertura de salud u obra social para su autorización previa.\n\n"
                    f"_Centro Visión - Cuidamos su salud visual_"
                )
            else:
                mensaje_wa = (
                    f"📋 *INDICACIONES MÉDICAS QUIRÚRGICAS - CENTRO VISIÓN*\n\n"
                    f"Estimado/a *{paciente_nombre}*,\n"
                    f"Le acercamos las indicaciones médicas y el esquema de medicación correspondiente a su procedimiento de *{practica_nombre}*, "
                    f"bajo indicación del *{medico_nombre}*.\n\n"
                    f"• *Procedimiento en:* {ojo_str}\n\n"
                    f"📄 *Descargue su receta e indicaciones oficiales aquí:*\n{full_pdf_link}\n\n"
                    f"⏳ *Regla de Oro:* Si le coincide colocar dos gotas diferentes al mismo horario, aplique la primera y espere *10 minutos* antes de la siguiente.\n\n"
                    f"⚠️ *Pautas de Cuidado:*\n"
                    f"• Aplique las gotas en los horarios indicados.\n"
                    f"• No se frote los ojos ni realice esfuerzos físicos.\n"
                    f"• Ante cualquier duda o urgencia, comuníquese de inmediato a nuestra línea de guardia.\n\n"
                    f"_Centro Visión - Cuidamos su salud visual_"
                )
            
            # Enviar mensaje vía WhatsApp Manager
            tel_norm = normalize_phone_number(paciente_telefono)
            if tel_norm:
                wa_send = whatsapp_manager.send_message(tel_norm, mensaje_wa)
                if wa_send and wa_send.get("status") in ["queued", "sent", "success"]:
                    whatsapp_status = "enviado"
                    whatsapp_res = wa_send
                else:
                    whatsapp_status = "fallido"
                    whatsapp_res = wa_send

                # Actualizar estado de WhatsApp en la tabla de emisiones
                supabase.table("emisiones_indicaciones_geclisa").update({
                    "whatsapp_status": whatsapp_status,
                    "whatsapp_mensaje_id": wa_send.get("message_id") if isinstance(wa_send, dict) else None,
                    "whatsapp_error": str(wa_send.get("error") or "") if isinstance(wa_send, dict) else None
                }).eq("id", emision_uuid).execute()

        except Exception as e_wa:
            logger.error(f"Error despachando indicación médica por WhatsApp: {e_wa}")
            whatsapp_status = "fallido"
            try:
                supabase.table("emisiones_indicaciones_geclisa").update({
                    "whatsapp_status": "fallido",
                    "whatsapp_error": str(e_wa)
                }).eq("id", emision_uuid).execute()
            except Exception:
                pass

    return {
        "success": True,
        "emision_id": emision_uuid,
        "geclisa_im_id": geclisa_im_id,
        "geclisa_registrado": bool(geclisa_im_id),
        "pdf_url": pdf_url,
        "whatsapp_status": whatsapp_status,
        "whatsapp_resultado": whatsapp_res,
        "medico_emisor": medico_nombre,
        "paciente": paciente_nombre
    }



def reeditar_emision_indicaciones(
    emision_id: str,
    texto_indicaciones: str,
    medicamentos: Optional[List[Dict[str, Any]]] = None,
    cuidados_generales: Optional[str] = None,
    pautas_alarma: Optional[str] = None,
    reenviar_whatsapp: bool = True,
    usu_modificacion: str = "asesora_crm"
) -> Dict[str, Any]:
    """
    Reedita una indicación médica ya emitida:
    1. Carga la emisión original de 'emisiones_indicaciones_geclisa'.
    2. Regenera el PDF con las modificaciones clínicas y versión actualizada.
    3. Actualiza el registro de auditoría en 'emisiones_indicaciones_geclisa' y en 'asesorias_quirurgicas'.
    4. Si se solicita reenviar por WhatsApp, despacha el PDF actualizado al paciente.
    """
    if not supabase or not is_valid_uuid(emision_id):
        return {"success": False, "error": "ID de emisión inválido."}

    res_em = supabase.table("emisiones_indicaciones_geclisa").select("*, asesorias_quirurgicas(*), pacientes(*)").eq("id", emision_id).limit(1).execute()
    if not res_em.data:
        return {"success": False, "error": "Emisión no encontrada en el sistema."}
    
    emision = res_em.data[0]
    asesoria = emision.get("asesorias_quirurgicas") or {}
    paciente = emision.get("pacientes") or {}

    paciente_nombre = paciente.get("nombre") or emision.get("medico_nombre") or "Paciente"
    paciente_dni = paciente.get("dni") or "-"
    paciente_os = paciente.get("obra_social") or "-"
    paciente_telefono = paciente.get("telefono")
    
    medico_nombre = emision.get("medico_nombre") or "Médico Cirujano"
    medico_matricula = emision.get("medico_matricula") or ""
    practica_nombre = emision.get("practica_nombre") or "Procedimiento Quirúrgico"
    ojo_intervenido = asesoria.get("ojo") or "OD"

    # Generar nuevo PDF
    datos_pdf = {
        "paciente_nombre": paciente_nombre,
        "paciente_dni": paciente_dni,
        "paciente_obra_social": paciente_os,
        "practica_nombre": practica_nombre,
        "ojo": ojo_intervenido,
        "medico_nombre": medico_nombre,
        "medico_matricula": medico_matricula,
        "cuerpo_indicaciones": texto_indicaciones,
        "medicamentos": medicamentos or [],
        "cuidados_generales": cuidados_generales or "",
        "pautas_alarma": pautas_alarma or "",
        "geclisa_im_id": emision.get("geclisa_im_id")
    }

    config_diseno = {
        "titulo_documento": "INDICACIONES MÉDICAS QUIRÚRGICAS (ACTUALIZADAS)",
        "pie_pagina": "Documento corregido y reemitido electrónicamente por Centro Visión."
    }

    pdf_res = generar_pdf_indicacion_medica(datos_pdf, config_diseno=config_diseno, guardar_en_disco=True)
    pdf_url = pdf_res.get("url")
    pdf_path = pdf_res.get("file_path")

    # Actualizar emisión en BD
    upd_em = {
        "texto_indicaciones": texto_indicaciones,
        "pdf_path": pdf_path,
        "pdf_url": pdf_url
    }
    
    # Despachar WhatsApp si corresponde
    whatsapp_status = emision.get("whatsapp_status")
    whatsapp_res = None
    if reenviar_whatsapp and paciente_telefono:
        try:
            backend_base = os.getenv("BACKEND_URL", "https://crm.centrovision.com.ar").rstrip("/")
            full_pdf_link = f"{backend_base}{pdf_url}"
            
            ojo_str = "👁️ *OJO DERECHO*" if "OD" in str(ojo_intervenido).upper() else "👁️ *OJO IZQUIERDO*" if "OI" in str(ojo_intervenido).upper() else f"👁️ *{ojo_intervenido}*"

            mensaje_wa = (
                f"📋 *INDICACIONES MÉDICAS ACTUALIZADAS - CENTRO VISIÓN*\n\n"
                f"Estimado/a *{paciente_nombre}*,\n"
                f"Le enviamos la versión *actualizada* de sus indicaciones médicas para su cirugía de *{practica_nombre}*, "
                f"según lo dispuesto por el *{medico_nombre}*.\n\n"
                f"• *Procedimiento en:* {ojo_str}\n\n"
                f"📄 *Descargue su receta y protocolo actualizado aquí:*\n{full_pdf_link}\n\n"
                f"⏳ *Recordatorio clave:* Si debe colocarse dos gotas diferentes en el mismo horario, recuerde esperar *10 minutos* entre gota y gota.\n\n"
                f"_Centro Visión - Cuidamos su salud visual_"
            )
            
            tel_norm = normalize_phone_number(paciente_telefono)
            if tel_norm:
                wa_send = whatsapp_manager.send_message(tel_norm, mensaje_wa)
                if wa_send and wa_send.get("status") in ["queued", "sent", "success"]:
                    whatsapp_status = "enviado"
                    whatsapp_res = wa_send
                else:
                    whatsapp_status = "fallido"
                    whatsapp_res = wa_send
                upd_em["whatsapp_status"] = whatsapp_status
                upd_em["whatsapp_mensaje_id"] = wa_send.get("message_id") if isinstance(wa_send, dict) else None
        except Exception as e_wa:
            logger.error(f"Error reenviando WhatsApp en reedición {emision_id}: {e_wa}")
            upd_em["whatsapp_status"] = "fallido"
            upd_em["whatsapp_error"] = str(e_wa)

    supabase.table("emisiones_indicaciones_geclisa").update(upd_em).eq("id", emision_id).execute()

    # Si hay asesoria_id, actualizar en la tabla principal
    asesoria_id = emision.get("asesoria_id")
    if asesoria_id:
        supabase.table("asesorias_quirurgicas").update({
            "indicaciones_texto": texto_indicaciones,
            "indicaciones_pdf_url": pdf_url,
            "indicaciones_emitidas_at": datetime.now().isoformat()
        }).eq("id", asesoria_id).execute()

    return {
        "success": True,
        "emision_id": emision_id,
        "pdf_url": pdf_url,
        "whatsapp_status": whatsapp_status,
        "whatsapp_resultado": whatsapp_res,
        "mensaje": "Indicación médica actualizada exitosamente."
    }
