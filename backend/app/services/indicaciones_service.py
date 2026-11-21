import os
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import unicodedata
import re

from app.db import (
    supabase,
    is_valid_uuid,
    get_or_create_conversacion,
    guardar_mensaje,
    check_patient_24h_window
)
from app.services.geclisa_client import geclisa_client
from app.services.indicaciones_pdf_service import generar_pdf_indicacion_medica
from app.services.markdown_utils import build_indicaciones_vars_dict, markdown_to_plain_text
from app.whatsapp import whatsapp_manager
from app.services.phone_normalizer import normalize_phone_number

logger = logging.getLogger("indicaciones_service")

_PLANTILLAS_GECLISA_CACHE: Dict[str, Any] = {"data": None, "expires_at": 0.0}


def _get_plantillas_geclisa_cached(ttl_seconds: int = 900) -> List[Dict[str, Any]]:
    """Obtiene el catálogo de plantillas de Geclisa con caché en memoria (TTL 15 min) para evitar bloqueos de red."""
    now = time.monotonic()
    if _PLANTILLAS_GECLISA_CACHE["data"] is not None and now < _PLANTILLAS_GECLISA_CACHE["expires_at"]:
        return _PLANTILLAS_GECLISA_CACHE["data"]
    try:
        data = geclisa_client.listar_plantillas_indicaciones_geclisa() or []
        _PLANTILLAS_GECLISA_CACHE["data"] = data
        _PLANTILLAS_GECLISA_CACHE["expires_at"] = now + ttl_seconds
        return data
    except Exception as e:
        logger.warning(f"No se pudo consultar catálogo de plantillas Geclisa: {e}")
        return _PLANTILLAS_GECLISA_CACHE["data"] or []


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
    practica_id: Optional[str] = None,
    prestador_id: Optional[Any] = None,
    tipo_fase: Optional[str] = None
) -> Dict[str, Any]:
    """
    Algoritmo determinístico y jerárquico de resolución de plantilla de indicaciones
    basado en la matriz clínica de 3 niveles:
    1. Regla Específica por Cirujano + Fase (Práctica + Prestador + Fase).
    2. Regla Específica por Cirujano (Práctica + Prestador).
    3. Protocolo Institucional Base por Fase (Práctica + Fase, sin prestador).
    4. Protocolos Institucionales Generales (1 a N modulares).
    5. Fallback histórico (Geclisa / Reglas JSONB heredadas).
    """
    med_norm = normalizar_texto(medico_nombre or "")
    cirujano_tokens = [tok for tok in med_norm.split() if len(tok) >= 4 and tok not in ["doctor", "dra.", "dr.", "medico"]]
    prac_norm = normalizar_texto(practica_nombre or "")

    # Normalizar tipo_fase si fue provisto
    fase_norm = None
    if tipo_fase:
        tf = str(tipo_fase).strip().lower()
        if any(k in tf for k in ["preop", "prequirurg", "ayuno", "prep"]):
            fase_norm = "prequirurgico"
        elif any(k in tf for k in ["postop", "postquirurg", "gota"]):
            fase_norm = "postquirurgico"
        elif any(k in tf for k in ["certif"]):
            fase_norm = "certificado"
        elif any(k in tf for k in ["orden", "pedido", "solicitud"]):
            fase_norm = "orden_medica"
        else:
            fase_norm = tf

    plantilla_seleccionada = None
    origen = "sin_coincidencia"
    p_db = None
    cirujano_obj = None
    resolved_prestador_id = None

    # Intentar resolver objeto prestador si viene prestador_id o medico_nombre
    if supabase:
        try:
            if prestador_id:
                p_str = str(prestador_id).strip()
                if is_valid_uuid(p_str):
                    q_p = supabase.table("prestadores").select("id, nombre_apellido, rol, geclisa_pre_id, firma_url").eq("id", p_str).limit(1).execute()
                    if q_p.data:
                        cirujano_obj = q_p.data[0]
                        resolved_prestador_id = cirujano_obj.get("id")
                elif p_str.isdigit():
                    q_p = supabase.table("prestadores").select("id, nombre_apellido, rol, geclisa_pre_id, firma_url").eq("geclisa_pre_id", int(p_str)).limit(1).execute()
                    if q_p.data:
                        cirujano_obj = q_p.data[0]
                        resolved_prestador_id = cirujano_obj.get("id")
            
            if not cirujano_obj and cirujano_tokens:
                # Buscar en prestadores por token de apellido
                for tok in cirujano_tokens:
                    q_p = supabase.table("prestadores").select("id, nombre_apellido, rol, geclisa_pre_id, firma_url").ilike("nombre_apellido", f"%{tok}%").limit(1).execute()
                    if q_p.data:
                        cirujano_obj = q_p.data[0]
                        resolved_prestador_id = cirujano_obj.get("id")
                        break
        except Exception as e_prest:
            logger.warning(f"Error resolviendo prestador para indicaciones: {e_prest}")

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

    # Carga perezosa (lazy) del catálogo de Geclisa: solo se consulta si Supabase no resuelve la plantilla
    plantillas_geclisa: Optional[List[Dict[str, Any]]] = None

    def _get_geclisa_plantillas() -> List[Dict[str, Any]]:
        nonlocal plantillas_geclisa
        if plantillas_geclisa is None:
            plantillas_geclisa = _get_plantillas_geclisa_cached()
        return plantillas_geclisa

    # Si la práctica tiene indicaciones HABILITADAS en el Nomenclador:
    if p_db is not None and bool(p_db.get("habilitar_indicaciones", False)):
        from app.db import get_indicaciones_de_practica
        indicaciones_rel = get_indicaciones_de_practica(p_db.get("id"))
        activas_rel = [r for r in indicaciones_rel if r.get("activo") and r.get("plantillas_indicaciones_crm")]

        # =========================================================================
        # NIVEL 1: Reglas Específicas por Cirujano + Fase (1 a N Modular - Máxima Prioridad)
        # =========================================================================
        if resolved_prestador_id and fase_norm:
            cirujano_fase_rel = [
                r for r in activas_rel
                if str(r.get("prestador_id") or "") == str(resolved_prestador_id)
                and str(r.get("tipo_fase") or "").strip().lower() == fase_norm
            ]
            if cirujano_fase_rel:
                plantillas_crm_lista = [r["plantillas_indicaciones_crm"] for r in cirujano_fase_rel if r["plantillas_indicaciones_crm"].get("activo")]
                if plantillas_crm_lista:
                    todos_meds = []
                    for p in plantillas_crm_lista:
                        for m in (p.get("medicamentos") or []):
                            if not any(x.get("droga") == m.get("droga") for x in todos_meds):
                                todos_meds.append(m)

                    titulos = [p.get("titulo", "") for p in plantillas_crm_lista]
                    textos = [p.get("cuerpo_indicaciones", "") for p in plantillas_crm_lista if p.get("cuerpo_indicaciones")]
                    cuidados = [p.get("cuidados_generales", "") for p in plantillas_crm_lista if p.get("cuidados_generales")]
                    alarmas = [p.get("pautas_alarma", "") for p in plantillas_crm_lista if p.get("pautas_alarma")]

                    med_nombre_display = (
                        cirujano_fase_rel[0].get("prestadores", {}).get("nombre_apellido")
                        if cirujano_fase_rel[0].get("prestadores")
                        else (cirujano_obj.get("nombre_apellido") if cirujano_obj else "Cirujano")
                    )

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
                        "origen": "regla_cirujano_fase",
                        "cirujano_nombre": med_nombre_display,
                        "tipo_fase": fase_norm
                    }
                    origen = "regla_cirujano_fase"

        # =========================================================================
        # NIVEL 2: Reglas Específicas por Cirujano (sin restricción de fase)
        # =========================================================================
        if not plantilla_seleccionada and resolved_prestador_id:
            cirujano_all_rel = [
                r for r in activas_rel
                if str(r.get("prestador_id") or "") == str(resolved_prestador_id)
            ]
            if cirujano_all_rel:
                plantillas_crm_lista = [r["plantillas_indicaciones_crm"] for r in cirujano_all_rel if r["plantillas_indicaciones_crm"].get("activo")]
                if plantillas_crm_lista:
                    todos_meds = []
                    for p in plantillas_crm_lista:
                        for m in (p.get("medicamentos") or []):
                            if not any(x.get("droga") == m.get("droga") for x in todos_meds):
                                todos_meds.append(m)

                    titulos = [p.get("titulo", "") for p in plantillas_crm_lista]
                    textos = [p.get("cuerpo_indicaciones", "") for p in plantillas_crm_lista if p.get("cuerpo_indicaciones")]
                    cuidados = [p.get("cuidados_generales", "") for p in plantillas_crm_lista if p.get("cuidados_generales")]
                    alarmas = [p.get("pautas_alarma", "") for p in plantillas_crm_lista if p.get("pautas_alarma")]

                    med_nombre_display = (
                        cirujano_all_rel[0].get("prestadores", {}).get("nombre_apellido")
                        if cirujano_all_rel[0].get("prestadores")
                        else (cirujano_obj.get("nombre_apellido") if cirujano_obj else "Cirujano")
                    )

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
                        "origen": "regla_cirujano",
                        "cirujano_nombre": med_nombre_display,
                        "tipo_fase": cirujano_all_rel[0].get("tipo_fase")
                    }
                    origen = "regla_cirujano"

        # =========================================================================
        # NIVEL 3: Protocolos Institucionales Base para la Fase solicitada (1 a N Modular)
        # =========================================================================
        if not plantilla_seleccionada and fase_norm:
            inst_fase_rel = [
                r for r in activas_rel
                if not r.get("prestador_id")
                and str(r.get("tipo_fase") or "").strip().lower() == fase_norm
            ]
            if inst_fase_rel:
                plantillas_crm_lista = [r["plantillas_indicaciones_crm"] for r in inst_fase_rel if r["plantillas_indicaciones_crm"].get("activo")]
                if plantillas_crm_lista:
                    todos_meds = []
                    for p in plantillas_crm_lista:
                        for m in (p.get("medicamentos") or []):
                            if not any(x.get("droga") == m.get("droga") for x in todos_meds):
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
                        "origen": "institucional_practica_fase",
                        "tipo_fase": fase_norm
                    }
                    origen = "institucional_practica_fase"

        # =========================================================================
        # NIVEL 4: Protocolos Institucionales Generales (1 a N modulares)
        # =========================================================================
        if not plantilla_seleccionada:
            institucionales_rel = [r for r in activas_rel if not r.get("prestador_id")]
            if institucionales_rel:
                plantillas_crm_lista = [r["plantillas_indicaciones_crm"] for r in institucionales_rel if r["plantillas_indicaciones_crm"].get("activo")]
                if plantillas_crm_lista:
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

        # a) Verificar reglas específicas por cirujano en JSONB (compatibilidad legacy)
        if not plantilla_seleccionada:
            reglas_cirujano = p_db.get("indicaciones_reglas_cirujano") or {}
            if isinstance(reglas_cirujano, dict) and cirujano_tokens:
                for tok in cirujano_tokens:
                    if tok in reglas_cirujano:
                        target = reglas_cirujano[tok]
                        if isinstance(target, int):
                            for p in _get_geclisa_plantillas():
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
            for p in _get_geclisa_plantillas():
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
        for p in _get_geclisa_plantillas():
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
            "prestador_resuelto": cirujano_obj,
            "fase_solicitada": fase_norm,
            "mensaje": "Esta práctica no cuenta con un protocolo de indicaciones médicas preconfigurado para esta fase/cirujano. Seleccione una plantilla del catálogo si el cirujano lo solicita.",
            "total_plantillas_geclisa": len(plantillas_geclisa) if plantillas_geclisa is not None else 0
        }

    return {
        "success": True,
        "sugerencia": plantilla_seleccionada,
        "habilitada": True,
        "requiere_seleccion_manual": False,
        "origen_resolucion": origen,
        "prestador_resuelto": cirujano_obj,
        "fase_solicitada": fase_norm,
        "total_plantillas_geclisa": len(plantillas_geclisa) if plantillas_geclisa is not None else 0
    }


def despachar_indicacion_por_whatsapp(
    paciente_id: Optional[str],
    paciente_telefono: str,
    paciente_nombre: str,
    practica_nombre: str,
    mensaje_wa: str,
    pdf_url: str,
    emision_uuid: str,
    operador_id: Optional[str] = None,
    operador_nombre: Optional[str] = None,
    pdf_path: Optional[str] = None,
    tipo_documento: str = "postquirurgico"
) -> Tuple[str, Dict[str, Any]]:
    """
    Despacha la indicacion medica u orden medica al WhatsApp del paciente:
    1. Si la ventana de 24 horas esta abierta, envia el archivo PDF nativo adjunto con su caption explicativo.
    2. Si la ventana esta cerrada, envia la plantilla oficial con encabezado DOCUMENT (o fallback asistencial homologado).
    """
    tel_norm = normalize_phone_number(paciente_telefono)
    if not tel_norm:
        return "fallido", {"error": "Número telefónico no válido"}

    conv_id = None
    if paciente_id:
        try:
            conv = get_or_create_conversacion(paciente_id)
            if conv:
                conv_id = conv.get("id")
        except Exception as e_c:
            logger.warning(f"Error resolviendo conversación para paciente {paciente_id}: {e_c}")

    # Fallback: Resolver conversación por teléfono si no se obtuvo por paciente_id
    if not conv_id and tel_norm:
        try:
            from app.db import get_paciente_by_telefono
            pac_tel = get_paciente_by_telefono(tel_norm)
            if pac_tel and pac_tel.get("id"):
                conv = get_or_create_conversacion(pac_tel["id"])
                if conv:
                    conv_id = conv.get("id")
        except Exception as e_pt:
            logger.warning(f"Error resolviendo conversación por teléfono {tel_norm}: {e_pt}")

    backend_base = (
        os.getenv("BACKEND_PUBLIC_URL")
        or os.getenv("BACKEND_URL")
        or "https://crmagenticonube-production.up.railway.app"
    ).rstrip("/")
    full_pdf_link = f"{backend_base}{pdf_url}"

    clean_pac_name = re.sub(r'[^a-zA-Z0-9]', '_', normalizar_texto(paciente_nombre or 'Paciente'))[:20]
    pdf_filename = f"Indicaciones_{clean_pac_name}.pdf"

    win_info = check_patient_24h_window(paciente_id, tel_norm)
    is_window_open = bool(win_info.get("is_open", False))

    wa_send = None
    if is_window_open:
        # Enviar directamente el documento PDF nativo adjunto con su caption explicativo
        wa_send = whatsapp_manager.enviar_multimedia(
            telefono=tel_norm,
            media_url=full_pdf_link,
            media_type="document",
            caption=mensaje_wa,
            filename=pdf_filename,
            conversacion_id=conv_id
        )
        if wa_send and (wa_send.get("code") == "WINDOW_CLOSED" or not wa_send.get("enviado_real")):
            is_window_open = False
        elif wa_send and (wa_send.get("success") or wa_send.get("enviado_real")) and conv_id:
            wamid = wa_send.get("wamid") or wa_send.get("message_id")
            meta_doc: Dict[str, Any] = {
                "tipo": "documento",
                "delivery_status": "enviado",
                "provider": "meta_cloud_api",
                "wamid": wamid,
                "emision_indicacion_id": emision_uuid,
                "media_url": full_pdf_link,
                "filename": pdf_filename,
                "caption": mensaje_wa,
                "mime_type": "application/pdf"
            }
            if operador_id:
                meta_doc["operador_id"] = operador_id
            if operador_nombre:
                meta_doc["operador_nombre"] = operador_nombre

            guardar_mensaje(
                conversacion_id=conv_id,
                emisor="operador",
                contenido=f"📄 [PEDIDO / INDICACIÓN MÉDICA]\n\n{mensaje_wa}\n\n📎 Archivo adjunto: {pdf_filename}",
                whatsapp_message_id=wamid,
                metadata_json=meta_doc
            )
            try:
                if supabase:
                    supabase.table("conversaciones").update({
                        "ultimo_mensaje": f"📄 {pdf_filename}",
                        "ultimo_mensaje_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", conv_id).execute()
            except Exception as upd_e:
                logger.warning(f"Error actualizando conversacion tras pedido medico: {upd_e}")

    if not is_window_open:
        from app.services.whatsapp_cloud.client import (
            WhatsAppCloudClient,
            get_whatsapp_cloud_credentials
        )
        from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164

        phone_id, token = get_whatsapp_cloud_credentials()
        if phone_id and token:
            norm_meta_phone = normalize_to_meta_e164(tel_norm)
            wa_client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)

            nombre_param = re.sub(r"[\r\n\t]+", " ", (paciente_nombre or "Estimado/a").strip().title())[:60]
            practica_param = re.sub(r"[\r\n\t]+", " ", (practica_nombre or "Cirugía Oftalmológica").strip())[:60]

            components_doc = [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "document",
                            "document": {
                                "link": full_pdf_link,
                                "filename": pdf_filename
                            }
                        }
                    ]
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nombre_param},
                        {"type": "text", "text": practica_param}
                    ]
                }
            ]

            tpl_res = None
            template_usada = "entrega_indicaciones_postquirurgicas_pdf"
            try:
                async def _run_doc_template():
                    try:
                        return await wa_client.send_template(
                            to_phone=norm_meta_phone,
                            template_name="entrega_indicaciones_postquirurgicas_pdf",
                            language_code="es_AR",
                            components=components_doc
                        )
                    finally:
                        await wa_client.close()

                tpl_res = whatsapp_manager._safe_run_async(_run_doc_template())
            except Exception as e_doc_tpl:
                logger.warning(f"Plantilla con documento no disponible aún en Meta ({e_doc_tpl}). Activando fallback asistencial...")
                template_usada = "comunicacion_asistencial_paciente_v1"
                aviso_fallback = re.sub(
                    r"[\r\n\t]+",
                    " ",
                    f"Tiene disponibles sus indicaciones y orden oficial de {practica_nombre}. Puede descargarlas en: {full_pdf_link}"
                )[:400]
                components_fb = [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": nombre_param},
                            {"type": "text", "text": aviso_fallback}
                        ]
                    }
                ]
                async def _run_fallback():
                    c_fb = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)
                    try:
                        return await c_fb.send_template(
                            to_phone=norm_meta_phone,
                            template_name="comunicacion_asistencial_paciente_v1",
                            language_code="es_AR",
                            components=components_fb
                        )
                    finally:
                        await c_fb.close()
                tpl_res = whatsapp_manager._safe_run_async(_run_fallback())

            if tpl_res and tpl_res.get("wamid"):
                wamid = tpl_res.get("wamid")
                wa_send = {
                    "success": True,
                    "enviado_real": True,
                    "message_id": wamid,
                    "wamid": wamid,
                    "template": template_usada
                }
                if conv_id:
                    meta_tpl: Dict[str, Any] = {
                        "tipo": "template",
                        "template_name": template_usada,
                        "delivery_status": "enviado",
                        "provider": "meta_cloud_api",
                        "wamid": wamid,
                        "emision_indicacion_id": emision_uuid,
                        "media_url": full_pdf_link,
                        "filename": pdf_filename
                    }
                    if operador_id:
                        meta_tpl["operador_id"] = operador_id
                    if operador_nombre:
                        meta_tpl["operador_nombre"] = operador_nombre

                    guardar_mensaje(
                        conversacion_id=conv_id,
                        emisor="operador",
                        contenido=f"📋 [Plantilla Oficial Meta: {template_usada}]\nIndicaciones Médicas Oficiales: {practica_nombre}",
                        whatsapp_message_id=wamid,
                        metadata_json=meta_tpl
                    )
            elif not wa_send:
                wa_send = {"success": False, "error": "No se pudo despachar la plantilla Meta"}

    if wa_send and (wa_send.get("success") or wa_send.get("status") in ["queued", "sent", "success"] or wa_send.get("enviado_real")):
        status = "enviado"
    else:
        status = "fallido"

    return status, (wa_send or {})


def _normalizar_medicamento(med: Dict[str, Any]) -> Dict[str, str]:
    """Normaliza claves legacy de medicamento a la estructura canonica."""
    if not isinstance(med, dict):
        return {"droga": "", "dosis": "", "frecuencia": "", "duracion": "", "instrucciones": ""}
    return {
        "droga": str(med.get("droga") or med.get("medicamento") or med.get("nombre") or "").strip(),
        "dosis": str(med.get("dosis") or "").strip(),
        "frecuencia": str(med.get("frecuencia") or med.get("horario") or "").strip(),
        "duracion": str(med.get("duracion") or "").strip(),
        "instrucciones": str(med.get("instrucciones") or med.get("notas") or "").strip(),
    }


def _normalizar_modulo_clinico(m: Dict[str, Any]) -> Dict[str, Any]:
    """Normaliza un modulo clinico para comparacion, PDF y persistencia."""
    cuerpo = str(m.get("cuerpo_indicaciones") or m.get("texto_indicaciones") or m.get("texto") or "").strip()
    meds_raw = m.get("medicamentos") or []
    meds = [_normalizar_medicamento(x) for x in meds_raw if isinstance(x, dict)]
    return {
        "id": str(m.get("id") or ""),
        "titulo": str(m.get("titulo") or "INDICACIÓN MÉDICA").strip(),
        "activo": bool(m.get("activo", True)),
        "cuerpo_indicaciones": cuerpo,
        "medicamentos": meds,
        "cuidados_generales": str(m.get("cuidados_generales") or "").strip(),
        "pautas_alarma": str(m.get("pautas_alarma") or "").strip(),
        "origen": str(m.get("origen") or ""),
    }


def _normalizar_lista_modulos(modulos_raw: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if not isinstance(modulos_raw, list):
        return []
    return [_normalizar_modulo_clinico(m) for m in modulos_raw if isinstance(m, dict) and m.get("activo", True) is not False]


def _normalizar_texto_cmp(txt: Optional[str]) -> str:
    return re.sub(r"\s+", " ", str(txt or "").replace("\r\n", "\n")).strip()


def _calcular_diff_indicaciones(
    original_modulos: Optional[List[Dict[str, Any]]],
    final_modulos: List[Dict[str, Any]]
) -> Tuple[bool, List[str]]:
    """
    Compara modulos resueltos originalmente en servidor vs modulos finales emitidos.
    Ignora claves de UI (id, titulo, origen, activo) y normaliza espacios y None/[].
    """
    orig_list = _normalizar_lista_modulos(original_modulos)
    fin_list = _normalizar_lista_modulos(final_modulos)
    if not orig_list:
        return False, []

    campos: List[str] = []
    if len(orig_list) != len(fin_list):
        campos.append("modulos")

    max_len = max(len(orig_list), len(fin_list))
    for i in range(max_len):
        o = orig_list[i] if i < len(orig_list) else {}
        f = fin_list[i] if i < len(fin_list) else {}
        if _normalizar_texto_cmp(o.get("cuerpo_indicaciones")) != _normalizar_texto_cmp(f.get("cuerpo_indicaciones")):
            if "cuerpo_indicaciones" not in campos:
                campos.append("cuerpo_indicaciones")
        if (o.get("medicamentos") or []) != (f.get("medicamentos") or []):
            if "medicamentos" not in campos:
                campos.append("medicamentos")
        if _normalizar_texto_cmp(o.get("cuidados_generales")) != _normalizar_texto_cmp(f.get("cuidados_generales")):
            if "cuidados_generales" not in campos:
                campos.append("cuidados_generales")
        if _normalizar_texto_cmp(o.get("pautas_alarma")) != _normalizar_texto_cmp(f.get("pautas_alarma")):
            if "pautas_alarma" not in campos:
                campos.append("pautas_alarma")

    return len(campos) > 0, campos


def _agregar_resumen_modulos(modulos: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]], str, str]:
    """Agrega campos planos de resumen desde modulos activos para cabecera y compatibilidad."""
    activos = _normalizar_lista_modulos(modulos)
    textos = [m["cuerpo_indicaciones"] for m in activos if m.get("cuerpo_indicaciones")]
    meds: List[Dict[str, Any]] = []
    for m in activos:
        for med in m.get("medicamentos") or []:
            if med.get("droga") or med.get("frecuencia"):
                meds.append(med)
    cuidados = [m["cuidados_generales"] for m in activos if m.get("cuidados_generales")]
    alarmas = [m["pautas_alarma"] for m in activos if m.get("pautas_alarma")]
    return (
        "\n\n---\n\n".join(textos),
        meds,
        "\n\n".join(cuidados),
        "\n\n".join(alarmas),
    )


def _resolver_baseline_servidor(
    practica_nombre: str,
    practica_codigo: Optional[str],
    medico_nombre: Optional[str],
    prestador_id: Optional[Any] = None,
    tipo_fase: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], Optional[str], Optional[str]]:
    """Resuelve en servidor la plantilla base original para calculo de auditoria."""
    try:
        sug = resolver_plantilla_sugerida(
            practica_nombre=practica_nombre,
            practica_codigo=practica_codigo,
            medico_nombre=medico_nombre,
            prestador_id=prestador_id,
            tipo_fase=tipo_fase
        )
        sug_data = sug.get("sugerencia") or {}
        origen = sug.get("origen_resolucion")
        plantilla_id = str(sug_data.get("plantilla_id") or sug_data.get("id") or "") or None
        mods = _normalizar_lista_modulos(sug_data.get("modulos_asignados"))
        if not mods and (sug_data.get("texto_indicaciones") or sug_data.get("cuerpo_indicaciones") or sug_data.get("medicamentos")):
            mods = [_normalizar_modulo_clinico(sug_data)]
        return mods, plantilla_id, origen
    except Exception as e_b:
        logger.warning(f"No se pudo resolver baseline en servidor: {e_b}")
        return [], None, None


def _registrar_version_inicial(
    emision_id: str,
    modulos_emitidos: List[Dict[str, Any]],
    texto_indicaciones: str,
    medicamentos: List[Dict[str, Any]],
    cuidados_generales: str,
    pautas_alarma: str,
    fue_modificada: bool,
    campos_modificados: List[str],
    pdf_url: Optional[str],
    geclisa_im_id: Optional[int],
    geclisa_im_ids: List[int],
    operador_id: Optional[str],
    operador_nombre: Optional[str]
) -> None:
    """Inserta version_numero = 1 en emisiones_indicaciones_versiones."""
    if not supabase or not emision_id:
        return
    try:
        supabase.table("emisiones_indicaciones_versiones").insert({
            "emision_id": emision_id,
            "version_numero": 1,
            "modulos_emitidos_json": modulos_emitidos,
            "texto_indicaciones": texto_indicaciones,
            "medicamentos": medicamentos,
            "cuidados_generales": cuidados_generales,
            "pautas_alarma": pautas_alarma,
            "fue_modificada": fue_modificada,
            "campos_modificados": campos_modificados,
            "pdf_url": pdf_url,
            "geclisa_im_id": geclisa_im_id,
            "geclisa_im_ids": geclisa_im_ids or [],
            "operador_id": operador_id,
            "operador_nombre": operador_nombre,
        }).execute()
    except Exception as e_ver:
        logger.error(f"Error registrando version inicial para emision {emision_id}: {e_ver}")


def _append_version_emision(
    emision_id: str,
    modulos: Optional[List[Dict[str, Any]]] = None,
    texto_indicaciones: Optional[str] = None,
    medicamentos: Optional[List[Dict[str, Any]]] = None,
    cuidados_generales: Optional[str] = None,
    pautas_alarma: Optional[str] = None,
    expected_version: Optional[int] = None,
    reenviar_whatsapp: bool = True,
    telefono_override: Optional[str] = None,
    fecha_emision: Optional[str] = None,
    operador_id: Optional[str] = None,
    operador_nombre: Optional[str] = None
) -> Dict[str, Any]:
    """
    Flujo unificado para v2+ (tanto reedicion en Asesoramiento como reenvio en Quirofano en Vivo):
    - NO reenvia a Geclisa (evita duplicar registros hospitalarios).
    - Calcula diff contra contenido_original_json almacenado en servidor.
    - Genera PDF versionado indicacion_{emision_id}_v{n}.pdf.
    - Ejecuta RPC transaccional registrar_version_indicacion con bloqueo optimista expected_version.
    - Despacha por WhatsApp si corresponde.
    """
    if not supabase or not is_valid_uuid(emision_id):
        return {"success": False, "error": "ID de emisión inválido."}

    res_em = (
        supabase.table("emisiones_indicaciones_geclisa")
        .select("*, asesorias_quirurgicas(*), pacientes(*)")
        .eq("id", emision_id)
        .limit(1)
        .execute()
    )
    if not res_em.data:
        return {"success": False, "error": "Emisión no encontrada en el sistema."}

    emision = res_em.data[0]
    asesoria = emision.get("asesorias_quirurgicas") or {}
    paciente = emision.get("pacientes") or {}

    version_actual = int(emision.get("version_actual") or 1)
    ver_esperada = int(expected_version) if expected_version is not None else version_actual
    if ver_esperada != version_actual:
        return {
            "success": False,
            "conflict": True,
            "status_code": 409,
            "error": "La indicación fue modificada por otro usuario. Recarga antes de guardar."
        }

    nueva_version = version_actual + 1

    # Normalizar modulos recibidos o adaptar desde payload plano
    modulos_norm = _normalizar_lista_modulos(modulos)
    if not modulos_norm:
        txt_base = str(texto_indicaciones or "").strip()
        if not txt_base and not medicamentos and not cuidados_generales and not pautas_alarma:
            return {"success": False, "error": "Debe incluir al menos un módulo o texto de indicaciones."}
        modulos_norm = [_normalizar_modulo_clinico({
            "titulo": emision.get("practica_nombre") or "INDICACIÓN MÉDICA",
            "cuerpo_indicaciones": txt_base,
            "medicamentos": medicamentos or [],
            "cuidados_generales": cuidados_generales or "",
            "pautas_alarma": pautas_alarma or "",
        })]

    txt_resumen, meds_resumen, cuid_resumen, alar_resumen = _agregar_resumen_modulos(modulos_norm)

    # Diff contra el baseline inmutable en servidor
    baseline_orig = emision.get("contenido_original_json")
    if isinstance(baseline_orig, list) and len(baseline_orig) > 0:
        fue_modificada, campos_modificados = _calcular_diff_indicaciones(baseline_orig, modulos_norm)
    else:
        # Emision legacy sin contenido_original_json: comparar contra su estado previo en cabecera
        prev_mod = _normalizar_lista_modulos(emision.get("modulos_emitidos_json"))
        if not prev_mod:
            prev_mod = [_normalizar_modulo_clinico({
                "cuerpo_indicaciones": emision.get("texto_indicaciones") or "",
                "medicamentos": emision.get("medicamentos") or [],
                "cuidados_generales": emision.get("cuidados_generales") or "",
                "pautas_alarma": emision.get("pautas_alarma") or "",
            })]
        fue_modificada, campos_modificados = _calcular_diff_indicaciones(prev_mod, modulos_norm)
        fue_modificada = fue_modificada or bool(emision.get("fue_modificada"))

    paciente_nombre = paciente.get("nombre") or "Paciente"
    paciente_dni = paciente.get("dni") or "-"
    paciente_os = asesoria.get("cobertura_obra_social") or paciente.get("obra_social") or "-"
    paciente_plan = paciente.get("plan_cobertura") or asesoria.get("plan_cobertura") or ""
    paciente_afiliado = paciente.get("nro_afiliado") or paciente.get("numero_afiliado") or "-"
    paciente_domicilio = paciente.get("direccion") or paciente.get("domicilio") or "-"
    paciente_telefono = telefono_override or paciente.get("telefono")

    medico_nombre = emision.get("medico_nombre") or "Médico Cirujano"
    medico_matricula = emision.get("medico_matricula") or ""
    practica_nombre = emision.get("practica_nombre") or "Procedimiento Quirúrgico"
    ojo_intervenido = asesoria.get("ojo") or "OD"
    medico_firma_url = None
    medico_especialidad = "Especialista en Oftalmología"

    try:
        from app.db import obtener_prestador_por_cirujano
        prest_info = obtener_prestador_por_cirujano(
            emision.get("geclisa_pre_id") or asesoria.get("medico_cirujano_id"),
            medico_nombre
        )
        if prest_info:
            if not medico_matricula or str(medico_matricula).strip() in ("", "-", "None"):
                medico_matricula = prest_info.get("matricula") or ""
            medico_firma_url = prest_info.get("firma_url")
            medico_especialidad = prest_info.get("especialidad") or "Especialista en Oftalmología"
    except Exception as e_pr:
        logger.warning(f"Aviso resolviendo prestador en nueva version: {e_pr}")

    fecha_pdf = None
    fecha_db = None
    if fecha_emision:
        try:
            s_f = str(fecha_emision).strip()
            if "-" in s_f:
                p = s_f.split("T")[0].split("-")
                if len(p) == 3:
                    fecha_db = f"{p[0]}-{p[1]}-{p[2]}"
                    fecha_pdf = f"{p[2]}/{p[1]}/{p[0]}"
            elif "/" in s_f:
                p = s_f.split("/")
                if len(p) == 3:
                    fecha_pdf = f"{p[0]}/{p[1]}/{p[2]}"
                    fecha_db = f"{p[2]}-{p[1]}-{p[0]}"
        except Exception:
            pass

    if not fecha_pdf and emision.get("fecha_emision"):
        raw_em = str(emision.get("fecha_emision")).strip()
        if "-" in raw_em:
            p = raw_em.split("T")[0].split("-")
            if len(p) == 3:
                fecha_pdf = f"{p[2]}/{p[1]}/{p[0]}"
        else:
            fecha_pdf = raw_em

    filename_v = f"indicacion_{emision_id}_v{nueva_version}.pdf"
    datos_pdf = {
        "id": emision_id,
        "paciente_nombre": paciente_nombre,
        "paciente_dni": paciente_dni,
        "paciente_obra_social": paciente_os,
        "paciente_plan": paciente_plan,
        "paciente_afiliado": paciente_afiliado,
        "paciente_domicilio": paciente_domicilio,
        "practica_nombre": practica_nombre,
        "ojo": ojo_intervenido,
        "medico_nombre": medico_nombre,
        "medico_matricula": medico_matricula,
        "medico_especialidad": medico_especialidad,
        "firma_url": medico_firma_url,
        "cuerpo_indicaciones": txt_resumen,
        "medicamentos": meds_resumen,
        "cuidados_generales": cuid_resumen,
        "pautas_alarma": alar_resumen,
        "modulos": modulos_norm,
        "tipo_documento": emision.get("tipo_documento") or "postquirurgico",
        "titulo_documento": emision.get("titulo_documento") or "INDICACIONES MÉDICAS QUIRÚRGICAS (ACTUALIZADAS)",
        "geclisa_im_id": emision.get("geclisa_im_id"),
        "fecha": fecha_pdf
    }
    config_diseno = {
        "titulo_documento": f"{emision.get('titulo_documento') or 'INDICACIONES MÉDICAS QUIRÚRGICAS'} (v{nueva_version})",
        "pie_pagina": "Documento corregido y reemitido electrónicamente por Centro Visión."
    }
    pdf_res = generar_pdf_indicacion_medica(
        datos_pdf,
        config_diseno=config_diseno,
        guardar_en_disco=True,
        filename_override=filename_v
    )
    pdf_url = pdf_res.get("url")
    pdf_path = pdf_res.get("file_path")

    # Persistir atomicamente via RPC con bloqueo optimista
    rpc_res = supabase.rpc("registrar_version_indicacion", {
        "p_emision_id": emision_id,
        "p_expected_version": ver_esperada,
        "p_modulos_emitidos_json": modulos_norm,
        "p_texto_indicaciones": txt_resumen,
        "p_medicamentos": meds_resumen,
        "p_cuidados_generales": cuid_resumen,
        "p_pautas_alarma": alar_resumen,
        "p_fue_modificada": fue_modificada,
        "p_campos_modificados": campos_modificados,
        "p_pdf_path": pdf_path,
        "p_pdf_url": pdf_url,
        "p_operador_id": operador_id,
        "p_operador_nombre": operador_nombre,
        "p_fecha_emision": fecha_db,
        "p_whatsapp_status": "pendiente" if (reenviar_whatsapp and paciente_telefono) else emision.get("whatsapp_status")
    }).execute()

    rpc_data = rpc_res.data if isinstance(rpc_res.data, dict) else (rpc_res.data[0] if isinstance(rpc_res.data, list) and rpc_res.data else {})
    if not rpc_data.get("success"):
        return {
            "success": False,
            "conflict": bool(rpc_data.get("conflict")),
            "status_code": 409 if rpc_data.get("conflict") else 400,
            "error": rpc_data.get("error") or "No se pudo registrar la nueva versión."
        }

    # Despacho por WhatsApp (si falla WhatsApp, la version ya quedo persistida en Supabase)
    whatsapp_status = emision.get("whatsapp_status")
    whatsapp_res = None
    if reenviar_whatsapp and paciente_telefono:
        try:
            ojo_str = "👁️ *OJO DERECHO*" if "OD" in str(ojo_intervenido).upper() else "👁️ *OJO IZQUIERDO*" if "OI" in str(ojo_intervenido).upper() else f"👁️ *{ojo_intervenido}*"
            mensaje_wa = (
                f"📋 *INDICACIONES MÉDICAS ACTUALIZADAS (v{nueva_version}) - CENTRO VISIÓN*\n\n"
                f"Estimado/a *{paciente_nombre}*,\n"
                f"Le enviamos la versión *actualizada* de sus indicaciones médicas para su intervención de *{practica_nombre}*, "
                f"indicadas por el *{medico_nombre}*.\n\n"
                f"• *Procedimiento en:* {ojo_str}\n\n"
                f"⏳ *Recordatorio clave:* Si debe colocarse dos gotas diferentes en el mismo horario, recuerde esperar *10 minutos* entre gota y gota.\n\n"
                f"_Centro Visión - Cuidamos su salud visual_"
            )
            whatsapp_status, wa_send = despachar_indicacion_por_whatsapp(
                paciente_id=emision.get("paciente_id"),
                paciente_telefono=paciente_telefono,
                paciente_nombre=paciente_nombre,
                practica_nombre=practica_nombre,
                mensaje_wa=mensaje_wa,
                pdf_url=pdf_url,
                emision_uuid=emision_id,
                operador_id=operador_id,
                operador_nombre=operador_nombre or "Operador",
                pdf_path=pdf_path,
                tipo_documento=emision.get("tipo_documento") or "postquirurgico"
            )
            whatsapp_res = wa_send
            upd_wa = {
                "whatsapp_status": whatsapp_status,
                "whatsapp_mensaje_id": wa_send.get("message_id") or wa_send.get("wamid") if isinstance(wa_send, dict) else None,
                "whatsapp_error": str(wa_send.get("error")) if isinstance(wa_send, dict) and wa_send.get("error") else None
            }
            supabase.table("emisiones_indicaciones_geclisa").update(upd_wa).eq("id", emision_id).execute()
        except Exception as e_wa:
            logger.error(f"Error reenviando WhatsApp en version {nueva_version} de {emision_id}: {e_wa}")
            whatsapp_status = "fallido"
            supabase.table("emisiones_indicaciones_geclisa").update({
                "whatsapp_status": "fallido",
                "whatsapp_error": str(e_wa)
            }).eq("id", emision_id).execute()

    asesoria_id = emision.get("asesoria_id")
    if asesoria_id:
        try:
            supabase.table("asesorias_quirurgicas").update({
                "indicaciones_texto": txt_resumen,
                "indicaciones_pdf_url": pdf_url,
                "indicaciones_emitidas_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", asesoria_id).execute()
        except Exception as e_as:
            logger.warning(f"Aviso actualizando asesoria en v{nueva_version}: {e_as}")

    return {
        "success": True,
        "emision_id": emision_id,
        "version_numero": nueva_version,
        "pdf_url": pdf_url,
        "fue_modificada": fue_modificada,
        "campos_modificados": campos_modificados,
        "whatsapp_status": whatsapp_status,
        "whatsapp_resultado": whatsapp_res,
        "mensaje": f"Indicación médica actualizada (v{nueva_version})."
    }


def emitir_indicaciones_expediente(
    asesoria_id: str,
    enviar_whatsapp: bool = True,
    texto_override: Optional[str] = None,
    medicamentos_override: Optional[List[Dict[str, Any]]] = None,
    cuidados_override: Optional[str] = None,
    pautas_alarma_override: Optional[str] = None,
    usu_alta: str = "asesora_crm",
    modulos: Optional[List[Dict[str, Any]]] = None,
    tipo_documento: Optional[str] = None,
    titulo_documento: Optional[str] = None,
    fecha_emision: Optional[str] = None,
    medico_id_override: Optional[Any] = None,
    medico_nombre_override: Optional[str] = None,
    practica_nombre_override: Optional[str] = None,
    practica_codigo_override: Optional[str] = None,
    operador_id: Optional[str] = None,
    operador_nombre: Optional[str] = None
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
    paciente_plan = paciente.get("plan_cobertura") or asesoria.get("plan_cobertura") or ""
    paciente_afiliado = paciente.get("nro_afiliado") or paciente.get("numero_afiliado") or "-"
    paciente_domicilio = paciente.get("direccion") or paciente.get("domicilio") or "-"
    
    medico_id = medico_id_override or asesoria.get("medico_cirujano_id")
    medico_nombre = medico_nombre_override or asesoria.get("medico_cirujano_nombre") or "Médico Cirujano"
    medico_matricula = asesoria.get("medico_cirujano_matricula") or ""
    medico_firma_url = None
    medico_especialidad = "Especialista en Oftalmología"

    # Auto-resolución de prestador (matrícula, especialidad y firma digital)
    try:
        from app.db import obtener_prestador_por_cirujano
        prest_info = obtener_prestador_por_cirujano(medico_id, medico_nombre)
        if prest_info:
            if not medico_id and prest_info.get("geclisa_pre_id"):
                medico_id = prest_info.get("geclisa_pre_id")
            if not medico_nombre or medico_nombre in ("Médico Cirujano", "A designar"):
                medico_nombre = prest_info.get("nombre_apellido") or medico_nombre
            if not medico_matricula or str(medico_matricula).strip() in ("", "-", "None"):
                medico_matricula = prest_info.get("matricula") or ""
            medico_firma_url = prest_info.get("firma_url")
            medico_especialidad = prest_info.get("especialidad") or "Especialista en Oftalmología"
    except Exception as e_pr:
        logger.warning(f"Aviso resolviendo prestador en emitir_indicaciones: {e_pr}")

    practica_nombre = practica_nombre_override or asesoria.get("practica_nombre") or "Cirugía Oftalmológica"
    practica_codigo = practica_codigo_override or asesoria.get("practica_codigo") or ""

    # Sincronizar automáticamente en asesorias_quirurgicas si el caso no tenía médico o práctica guardados
    try:
        upd_as = {}
        if medico_id and not asesoria.get("medico_cirujano_id"):
            upd_as["medico_cirujano_id"] = int(medico_id)
        if medico_nombre and medico_nombre != "Médico Cirujano" and not asesoria.get("medico_cirujano_nombre"):
            upd_as["medico_cirujano_nombre"] = medico_nombre
        if medico_matricula and not asesoria.get("medico_cirujano_matricula"):
            upd_as["medico_cirujano_matricula"] = medico_matricula
        if practica_nombre and practica_nombre != "Nueva Cirugía / Procedimiento" and asesoria.get("practica_nombre") in (None, "Nueva Cirugía / Procedimiento"):
            upd_as["practica_nombre"] = practica_nombre
        if practica_codigo and not asesoria.get("practica_codigo"):
            upd_as["practica_codigo"] = practica_codigo
        if upd_as:
            supabase.table("asesorias_quirurgicas").update(upd_as).eq("id", asesoria_id).execute()
    except Exception as e_sync_as:
        logger.warning(f"Aviso actualizando datos de cirujano en asesoría: {e_sync_as}")
    
    # 2. Resolver textos e instrucciones y baseline en servidor
    texto_final = texto_override
    meds_final = medicamentos_override
    cuidados_final = cuidados_override
    alarmas_final = pautas_alarma_override

    sug_data: Dict[str, Any] = {}
    baseline_modulos, plantilla_origen_id, origen_resolucion = _resolver_baseline_servidor(
        practica_nombre=practica_nombre,
        practica_codigo=practica_codigo,
        medico_nombre=medico_nombre,
        prestador_id=medico_id,
        tipo_fase=tipo_documento
    )

    if not texto_final and not modulos:
        sug = resolver_plantilla_sugerida(
            practica_nombre=practica_nombre,
            practica_codigo=practica_codigo,
            medico_nombre=medico_nombre,
            prestador_id=medico_id,
            tipo_fase=tipo_documento
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
    # Si la práctica tiene múltiples indicaciones configuradas (1 a N), se emite cada una por separado
    geclisa_im_id = None
    geclisa_im_ids: List[int] = []
    ficha_id_geclisa = (
        paciente.get("geclisa_ficha_id")
        or paciente.get("geclisa_paciente_id")
        or paciente.get("ficha_id")
    )

    # Si no tiene fichaId registrada en paciente, intentar buscarla por DNI en Geclisa
    if not ficha_id_geclisa and paciente_dni:
        try:
            dni_limpio = str(paciente_dni).strip()
            pac_geclisa = geclisa_client.buscar_paciente_por_dni(dni_limpio)
            if not pac_geclisa.get("encontrado") and dni_limpio.startswith("0"):
                pac_geclisa = geclisa_client.buscar_paciente_por_dni(dni_limpio.lstrip("0"))
            if pac_geclisa.get("encontrado"):
                ficha_id_geclisa = pac_geclisa.get("ficha_id") or pac_geclisa.get("id")
        except Exception as e_dni:
            logger.warning(f"No se pudo consultar ficha por DNI en Geclisa: {e_dni}")

    items_a_emitir = _normalizar_lista_modulos(modulos) if modulos else _normalizar_lista_modulos(sug_data.get("modulos_asignados"))
    if not items_a_emitir and (texto_final or meds_final or cuidados_final or alarmas_final):
        items_a_emitir = [
            _normalizar_modulo_clinico({
                "cuerpo_indicaciones": texto_final or "",
                "titulo": practica_nombre,
                "medicamentos": meds_final or [],
                "cuidados_generales": cuidados_final or "",
                "pautas_alarma": alarmas_final or ""
            })
        ]

    if items_a_emitir:
        texto_final, meds_final, cuidados_final, alarmas_final = _agregar_resumen_modulos(items_a_emitir)

    fue_modificada, campos_modificados = _calcular_diff_indicaciones(baseline_modulos, items_a_emitir)

    # Resolver fecha de emisión documental antes de construir variables de Geclisa y PDF
    fecha_pdf = None
    fecha_db = None
    if fecha_emision:
        try:
            s_f = str(fecha_emision).strip()
            if "-" in s_f:
                p = s_f.split("T")[0].split("-")
                if len(p) == 3:
                    fecha_db = f"{p[0]}-{p[1]}-{p[2]}"
                    fecha_pdf = f"{p[2]}/{p[1]}/{p[0]}"
            elif "/" in s_f:
                p = s_f.split("/")
                if len(p) == 3:
                    fecha_pdf = f"{p[0]}/{p[1]}/{p[2]}"
                    fecha_db = f"{p[2]}-{p[1]}-{p[0]}"
        except Exception as e_f:
            logger.warning(f"Error interpretando fecha_emision {fecha_emision}: {e_f}")

    if not fecha_db:
        fecha_db = datetime.now().strftime("%Y-%m-%d")
    if not fecha_pdf:
        fecha_pdf = datetime.now().strftime("%d/%m/%Y")

    vars_dict_geclisa = build_indicaciones_vars_dict({
        "paciente_nombre": paciente_nombre,
        "paciente_dni": paciente_dni,
        "paciente_obra_social": paciente_os,
        "paciente_plan": paciente_plan,
        "paciente_afiliado": paciente_afiliado,
        "paciente_domicilio": paciente_domicilio,
        "medico_nombre": medico_nombre,
        "medico_matricula": medico_matricula,
        "medico_especialidad": medico_especialidad,
        "practica_nombre": practica_nombre,
        "ojo_intervenido": asesoria.get("ojo") or "OD",
        "fecha": fecha_pdf,
    })

    # Si tenemos ficha y médico cirujano preId, asentamos en Geclisa cada indicación por separado (texto plano limpio)
    if ficha_id_geclisa and medico_id and items_a_emitir:
        for item in items_a_emitir:
            mod_texto = item.get("cuerpo_indicaciones") or item.get("texto_indicaciones") or item.get("texto") or texto_final or ""
            texto_plano_geclisa = markdown_to_plain_text(mod_texto, vars_dict=vars_dict_geclisa)
            if not texto_plano_geclisa:
                continue
            try:
                g_res = geclisa_client.emitir_indicacion_medica_geclisa(
                    ficha_id=int(ficha_id_geclisa),
                    pre_id=int(medico_id),
                    texto_indicacion=texto_plano_geclisa,
                    es_internado=False,
                    usu_alta=usu_alta,
                    os_plan=paciente_os,
                    nro_afiliado=paciente_afiliado,
                    esp_id=37 # Oftalmología en Geclisa
                )
                if g_res.get("success"):
                    single_id = g_res.get("im_id")
                    item["geclisa_im_id"] = single_id
                    geclisa_im_ids.append(single_id)
            except Exception as e_geclisa:
                logger.error(f"Error al emitir indicación individual en Geclisa para expediente {asesoria_id}: {e_geclisa}")

        if geclisa_im_ids:
            geclisa_im_id = geclisa_im_ids[0]
    else:
        logger.info(f"Emisión local en CRM (ficha Geclisa: {ficha_id_geclisa}, preId: {medico_id})")

    # Resolver tipo_documento y titulo_documento
    txt_low = str(texto_final or "").lower()
    if not tipo_documento:
        if "certifico" in txt_low or "certificado" in txt_low:
            tipo_documento = "certificado"
            titulo_documento = titulo_documento or "CERTIFICADO MÉDICO"
        elif "solicito:" in txt_low or "solicito " in txt_low or "orden medica" in txt_low or "orden médica" in txt_low or "pedido" in txt_low:
            tipo_documento = "orden_medica"
            titulo_documento = titulo_documento or "ORDEN MÉDICA DE PROCEDIMIENTO"
        elif "ayuno" in txt_low or "preoperatori" in txt_low or "prequirurgic" in txt_low:
            tipo_documento = "prequirurgico"
            titulo_documento = titulo_documento or "INDICACIONES PREQUIRÚRGICAS"
        else:
            tipo_documento = "postquirurgico"
            titulo_documento = titulo_documento or "INDICACIONES POSTQUIRÚRGICAS"
    else:
        if not titulo_documento:
            if tipo_documento == "certificado":
                titulo_documento = "CERTIFICADO MÉDICO"
            elif tipo_documento == "orden_medica":
                titulo_documento = "ORDEN MÉDICA DE PROCEDIMIENTO"
            elif tipo_documento == "prequirurgico":
                titulo_documento = "INDICACIONES PREQUIRÚRGICAS"
            else:
                titulo_documento = "INDICACIONES POSTQUIRÚRGICAS"

    # 4. Generar el PDF Institucional con ReportLab
    datos_emision_pdf = {
        "paciente_nombre": paciente_nombre,
        "paciente_dni": paciente_dni,
        "paciente_obra_social": paciente_os,
        "paciente_plan": paciente_plan,
        "paciente_afiliado": paciente_afiliado,
        "paciente_domicilio": paciente_domicilio,
        "practica_nombre": practica_nombre,
        "ojo": asesoria.get("ojo") or "OD",
        "medico_nombre": medico_nombre,
        "medico_matricula": medico_matricula,
        "medico_especialidad": medico_especialidad,
        "firma_url": medico_firma_url,
        "cuerpo_indicaciones": texto_final,
        "medicamentos": meds_final or [],
        "cuidados_generales": cuidados_final or "",
        "pautas_alarma": alarmas_final or "",
        "geclisa_im_id": geclisa_im_id,
        "geclisa_im_ids": geclisa_im_ids,
        "modulos": items_a_emitir,
        "items": items_a_emitir,
        "titulo_documento": titulo_documento,
        "tipo_documento": tipo_documento,
        "fecha": fecha_pdf
    }
    
    pdf_resultado = generar_pdf_indicacion_medica(datos_emision_pdf, guardar_en_disco=True)
    pdf_url = pdf_resultado.get("url")
    pdf_path = pdf_resultado.get("file_path")
    emision_uuid = pdf_resultado.get("emision_id")

    # 5. Registrar en auditoría 'emisiones_indicaciones_geclisa', historial de versiones y actualizar 'asesorias_quirurgicas'
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
            "tipo_documento": tipo_documento,
            "titulo_documento": titulo_documento,
            "texto_indicaciones": texto_final,
            "medicamentos": meds_final or [],
            "cuidados_generales": cuidados_final or "",
            "pautas_alarma": alarmas_final or "",
            "modulos_emitidos_json": items_a_emitir,
            "plantilla_origen_id": plantilla_origen_id,
            "origen_resolucion": origen_resolucion,
            "contenido_original_json": baseline_modulos,
            "version_actual": 1,
            "fue_modificada": fue_modificada,
            "campos_modificados": campos_modificados,
            "operador_id": operador_id,
            "operador_nombre": operador_nombre or usu_alta,
            "editado_at": datetime.now(timezone.utc).isoformat() if fue_modificada else None,
            "fecha_emision": fecha_db,
            "pdf_path": pdf_path,
            "pdf_url": pdf_url,
            "whatsapp_status": whatsapp_status
        }).execute()

        _registrar_version_inicial(
            emision_id=emision_uuid,
            modulos_emitidos=items_a_emitir,
            texto_indicaciones=texto_final,
            medicamentos=meds_final or [],
            cuidados_generales=cuidados_final or "",
            pautas_alarma=alarmas_final or "",
            fue_modificada=fue_modificada,
            campos_modificados=campos_modificados,
            pdf_url=pdf_url,
            geclisa_im_id=geclisa_im_id,
            geclisa_im_ids=geclisa_im_ids,
            operador_id=operador_id,
            operador_nombre=operador_nombre or usu_alta
        )

        # Actualizar expediente quirúrgico
        supabase.table("asesorias_quirurgicas").update({
            "indicacion_geclisa_im_id": geclisa_im_id,
            "indicaciones_texto": texto_final,
            "indicaciones_emitidas_at": datetime.now(timezone.utc).isoformat(),
            "indicaciones_pdf_url": pdf_url
        }).eq("id", asesoria_id).execute()
    except Exception as e_db:
        logger.error(f"Error registrando emisión en base de datos: {e_db}")

    # 6. Despacho automatizado por WhatsApp
    whatsapp_res = None
    if enviar_whatsapp and paciente_telefono:
        try:
            # Obtener URL base pública configurada en el CRM
            backend_base = (
                os.getenv("BACKEND_PUBLIC_URL")
                or os.getenv("BACKEND_URL")
                or "https://crmagenticonube-production.up.railway.app"
            ).rstrip("/")
            full_pdf_link = f"{backend_base}{pdf_url}"
            
            ojo_actual = asesoria.get("ojo") or "OD"
            ojo_str = "👁️ *OJO DERECHO*" if "OD" in str(ojo_actual).upper() else "👁️ *OJO IZQUIERDO*" if "OI" in str(ojo_actual).upper() else f"👁️ *{ojo_actual}*"

            if tipo_documento == "certificado":
                mensaje_wa = (
                    f"📄 *CERTIFICADO MÉDICO OFICIAL - CENTRO VISIÓN*\n\n"
                    f"Estimado/a *{paciente_nombre}*,\n"
                    f"Le acercamos su certificado médico oficial emitido por el *{medico_nombre}*.\n\n"
                    f"• *Procedimiento:* {practica_nombre}\n\n"
                    f"📥 *Descargue su certificado oficial aquí:*\n{full_pdf_link}\n\n"
                    f"_Centro Visión - Cuidamos su salud visual_"
                )
            elif tipo_documento == "prequirurgico":
                mensaje_wa = (
                    f"📋 *INDICACIONES PREQUIRÚRGICAS - CENTRO VISIÓN*\n\n"
                    f"Estimado/a *{paciente_nombre}*,\n"
                    f"Le acercamos las pautas e indicaciones prequirúrgicas correspondientes a *{practica_nombre}*, "
                    f"indicadas por el *{medico_nombre}*.\n\n"
                    f"• *Procedimiento:* {practica_nombre}\n"
                    f"• *Intervención:* {ojo_str}\n\n"
                    f"📥 *Descargue sus indicaciones prequirúrgicas aquí:*\n{full_pdf_link}\n\n"
                    f"📌 *Recuerde:* Concurrir en ayunas y con acompañante mayor de edad.\n\n"
                    f"_Centro Visión - Cuidamos su salud visual_"
                )
            elif tipo_documento == "orden_medica":
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
            
            # Despachar mensaje vía WhatsApp (o plantilla homologada si ventana de 24h está cerrada)
            whatsapp_status, wa_send = despachar_indicacion_por_whatsapp(
                paciente_id=paciente_id,
                paciente_telefono=paciente_telefono,
                paciente_nombre=paciente_nombre,
                practica_nombre=practica_nombre,
                mensaje_wa=mensaje_wa,
                pdf_url=pdf_url,
                emision_uuid=emision_uuid,
                operador_id=operador_id,
                operador_nombre=operador_nombre or usu_alta,
                pdf_path=pdf_path,
                tipo_documento=tipo_documento
            )
            whatsapp_res = wa_send

            # Actualizar estado de WhatsApp en la tabla de emisiones
            upd_wa = {
                "whatsapp_status": whatsapp_status,
                "whatsapp_mensaje_id": wa_send.get("message_id") or wa_send.get("wamid") if isinstance(wa_send, dict) else None,
                "whatsapp_error": str(wa_send.get("error") or "") if isinstance(wa_send, dict) and wa_send.get("error") else None
            }
            supabase.table("emisiones_indicaciones_geclisa").update(upd_wa).eq("id", emision_uuid).execute()

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
        "version_numero": 1,
        "fue_modificada": fue_modificada,
        "campos_modificados": campos_modificados,
        "geclisa_im_id": geclisa_im_id,
        "geclisa_im_ids": geclisa_im_ids,
        "geclisa_registrado": bool(geclisa_im_id),
        "pdf_url": pdf_url,
        "whatsapp_status": whatsapp_status,
        "whatsapp_resultado": whatsapp_res,
        "medico_emisor": medico_nombre,
        "paciente": paciente_nombre
    }



def reeditar_emision_indicaciones(
    emision_id: str,
    texto_indicaciones: Optional[str] = None,
    medicamentos: Optional[List[Dict[str, Any]]] = None,
    cuidados_generales: Optional[str] = None,
    pautas_alarma: Optional[str] = None,
    reenviar_whatsapp: bool = True,
    usu_modificacion: str = "asesora_crm",
    fecha_emision: Optional[str] = None,
    operador_id: Optional[str] = None,
    operador_nombre: Optional[str] = None,
    modulos: Optional[List[Dict[str, Any]]] = None,
    expected_version: Optional[int] = None
) -> Dict[str, Any]:
    """
    Reedita una indicación médica ya emitida creando una nueva versión en el historial de auditoría.
    """
    return _append_version_emision(
        emision_id=emision_id,
        modulos=modulos,
        texto_indicaciones=texto_indicaciones,
        medicamentos=medicamentos,
        cuidados_generales=cuidados_generales,
        pautas_alarma=pautas_alarma,
        expected_version=expected_version,
        reenviar_whatsapp=reenviar_whatsapp,
        fecha_emision=fecha_emision,
        operador_id=operador_id,
        operador_nombre=operador_nombre or usu_modificacion
    )


def preparar_indicaciones_postqx_turno(turno_id: str) -> Dict[str, Any]:
    """
    Recupera el turno de quirófano con su paciente, práctica y cirujano,
    y resuelve automáticamente las indicaciones postquirúrgicas personalizadas
    (o institucionales) listas para ser enviadas por WhatsApp desde la Pizarra.
    """
    if not supabase or not turno_id:
        return {"success": False, "error": "Identificador de turno inválido"}

    try:
        res = (
            supabase.table("turnos_quirofano")
            .select("*, pacientes(*), asesorias_quirurgicas(*)")
            .eq("id", turno_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return {"success": False, "error": f"No se encontró el turno con ID {turno_id}"}
        
        t = res.data[0]
        paciente = t.get("pacientes") or {}
        asesoria = t.get("asesorias_quirurgicas") or {}

        paciente_nombre = paciente.get("nombre") or t.get("paciente_nombre") or "Paciente"
        paciente_dni = paciente.get("dni") or t.get("paciente_dni") or ""
        paciente_telefono = paciente.get("telefono") or t.get("paciente_telefono") or ""
        paciente_os = t.get("obra_social") or paciente.get("obra_social") or "-"
        paciente_plan = t.get("plan_obra_social") or paciente.get("plan_cobertura") or ""

        practica_nombre = t.get("practica_nombre") or asesoria.get("tipo_cirugia") or "Cirugía Oftalmológica"
        practica_codigo = t.get("practica_codigo") or ""
        cirujano_nombre = t.get("cirujano_nombre") or asesoria.get("medico_cirujano_nombre") or "Médico Cirujano"
        cirujano_id = t.get("cirujano_id") or asesoria.get("medico_cirujano_id")

        # Resolver plantilla sugerida postquirúrgica
        sugerencia = resolver_plantilla_sugerida(
            practica_nombre=practica_nombre,
            practica_codigo=practica_codigo,
            medico_nombre=cirujano_nombre,
            prestador_id=cirujano_id,
            tipo_fase="postquirurgico"
        )

        # Si ya existe una emision previa en el turno, recuperar la ultima version para precarga
        ultima_emision = None
        emision_prev_id = t.get("indicaciones_postqx_emision_id")
        if emision_prev_id and is_valid_uuid(emision_prev_id):
            try:
                res_ult = (
                    supabase.table("emisiones_indicaciones_geclisa")
                    .select("id, version_actual, texto_indicaciones, medicamentos, cuidados_generales, pautas_alarma, modulos_emitidos_json, fue_modificada, campos_modificados, operador_nombre, editado_at, pdf_url")
                    .eq("id", emision_prev_id)
                    .limit(1)
                    .execute()
                )
                if res_ult.data:
                    ultima_emision = res_ult.data[0]
            except Exception as e_ult:
                logger.warning(f"Aviso cargando ultima emision del turno {turno_id}: {e_ult}")

        return {
            "success": True,
            "turno_id": turno_id,
            "asesoria_id": t.get("asesoria_id"),
            "paciente": {
                "id": t.get("paciente_id") or paciente.get("id"),
                "nombre": paciente_nombre,
                "dni": paciente_dni,
                "telefono": paciente_telefono,
                "obra_social": paciente_os,
                "plan": paciente_plan
            },
            "cirugia": {
                "practica_nombre": practica_nombre,
                "practica_codigo": practica_codigo,
                "ojo": t.get("ojo") or "OI",
                "fecha_cirugia": t.get("fecha_cirugia")
            },
            "cirujano": {
                "id": cirujano_id,
                "nombre": cirujano_nombre
            },
            "sugerencia": sugerencia.get("sugerencia"),
            "origen_resolucion": sugerencia.get("origen_resolucion"),
            "requiere_seleccion_manual": sugerencia.get("requiere_seleccion_manual", False),
            "ya_enviado": bool(t.get("indicaciones_postqx_enviadas")),
            "enviado_at": t.get("indicaciones_postqx_enviadas_at"),
            "pdf_url": t.get("indicaciones_postqx_pdf_url"),
            "ultima_emision": ultima_emision
        }
    except Exception as e:
        logger.error(f"Error preparando indicaciones post-qx para turno {turno_id}: {e}")
        return {"success": False, "error": str(e)}


def emitir_indicaciones_turno_quirofano(
    turno_id: str,
    telefono_override: Optional[str] = None,
    texto_override: Optional[str] = None,
    medicamentos_override: Optional[List[Dict[str, Any]]] = None,
    cuidados_override: Optional[str] = None,
    pautas_alarma_override: Optional[str] = None,
    modulos: Optional[List[Dict[str, Any]]] = None,
    operador_id: Optional[str] = None,
    operador_nombre: Optional[str] = None,
    expected_version: Optional[int] = None
) -> Dict[str, Any]:
    """
    Emite formalmente las indicaciones médicas postquirúrgicas para un turno de quirófano concluido:
    1. Si el turno ya tiene indicaciones_postqx_emision_id, anexa v(N+1) en el historial sin duplicar Geclisa.
    2. Si es v1 con asesoria_id, ejecuta emitir_indicaciones_expediente.
    3. Si es v1 sin asesoria_id, crea una emisión directa CRM-local con branding y auditoria v1.
    4. Actualiza turnos_quirofano con los flags de envío post-qx para la Pizarra.
    """
    if not supabase or not turno_id:
        return {"success": False, "error": "Identificador de turno inválido"}

    try:
        res = (
            supabase.table("turnos_quirofano")
            .select("*, pacientes(*), asesorias_quirurgicas(*)")
            .eq("id", turno_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return {"success": False, "error": f"No se encontró el turno {turno_id}"}

        t = res.data[0]
        paciente = t.get("pacientes") or {}
        asesoria_id = t.get("asesoria_id")
        tel_dest = telefono_override or paciente.get("telefono") or t.get("paciente_telefono")
        emision_existente_id = t.get("indicaciones_postqx_emision_id")

        resultado = None
        if emision_existente_id and is_valid_uuid(emision_existente_id):
            # Reemision / v2+ desde Quirofano en Vivo sobre la misma cabecera
            resultado = _append_version_emision(
                emision_id=emision_existente_id,
                modulos=modulos,
                texto_indicaciones=texto_override,
                medicamentos=medicamentos_override,
                cuidados_generales=cuidados_override,
                pautas_alarma=pautas_alarma_override,
                expected_version=expected_version,
                reenviar_whatsapp=True,
                telefono_override=tel_dest,
                operador_id=operador_id,
                operador_nombre=operador_nombre or "Quirófano"
            )
        elif asesoria_id and is_valid_uuid(asesoria_id):
            resultado = emitir_indicaciones_expediente(
                asesoria_id=asesoria_id,
                enviar_whatsapp=True,
                texto_override=texto_override,
                medicamentos_override=medicamentos_override,
                cuidados_override=cuidados_override,
                pautas_alarma_override=pautas_alarma_override,
                usu_alta=operador_nombre or "quirofano",
                modulos=modulos,
                tipo_documento="postquirurgico",
                titulo_documento="INDICACIONES MÉDICAS POSTQUIRÚRGICAS",
                medico_id_override=t.get("cirujano_id"),
                medico_nombre_override=t.get("cirujano_nombre"),
                practica_nombre_override=t.get("practica_nombre"),
                practica_codigo_override=t.get("practica_codigo"),
                operador_id=operador_id,
                operador_nombre=operador_nombre
            )
        else:
            from app.db import obtener_prestador_por_cirujano

            cirujano_obj = obtener_prestador_por_cirujano(t.get("cirujano_id"), t.get("cirujano_nombre") or "")
            pac_nom = paciente.get("nombre") or t.get("paciente_nombre") or "Paciente"
            pac_dni = paciente.get("dni") or t.get("paciente_dni") or ""
            pac_os = t.get("obra_social") or paciente.get("obra_social") or "-"
            practica_nom = t.get("practica_nombre") or "Cirugía Oftalmológica"
            practica_cod = t.get("practica_codigo") or ""
            medico_nom = cirujano_obj.get("nombre_apellido") if cirujano_obj else (t.get("cirujano_nombre") or "Médico Cirujano")

            modulos_norm = _normalizar_lista_modulos(modulos)
            if not modulos_norm:
                modulos_norm = [_normalizar_modulo_clinico({
                    "titulo": practica_nom,
                    "cuerpo_indicaciones": texto_override or "Indicaciones postquirúrgicas oficiales.",
                    "medicamentos": medicamentos_override or [],
                    "cuidados_generales": cuidados_override or "",
                    "pautas_alarma": pautas_alarma_override or ""
                })]

            txt_cuerpo, meds, cuidados, alarmas = _agregar_resumen_modulos(modulos_norm)
            baseline_modulos, plantilla_origen_id, origen_resolucion = _resolver_baseline_servidor(
                practica_nombre=practica_nom,
                practica_codigo=practica_cod,
                medico_nombre=medico_nom,
                prestador_id=t.get("cirujano_id"),
                tipo_fase="postquirurgico"
            )
            fue_modificada, campos_modificados = _calcular_diff_indicaciones(baseline_modulos, modulos_norm)

            datos_pdf = {
                "paciente_nombre": pac_nom,
                "paciente_dni": pac_dni,
                "paciente_obra_social": pac_os,
                "practica_nombre": practica_nom,
                "ojo": t.get("ojo") or "OD",
                "medico_nombre": medico_nom,
                "medico_matricula": cirujano_obj.get("matricula") if cirujano_obj else "",
                "medico_especialidad": cirujano_obj.get("especialidad") if cirujano_obj else "Especialista en Oftalmología",
                "firma_url": cirujano_obj.get("firma_url") if cirujano_obj else None,
                "cuerpo_indicaciones": txt_cuerpo,
                "medicamentos": meds,
                "cuidados_generales": cuidados,
                "pautas_alarma": alarmas,
                "tipo_documento": "postquirurgico",
                "titulo_documento": "INDICACIONES MÉDICAS POSTQUIRÚRGICAS",
                "modulos": modulos_norm
            }
            pdf_res = generar_pdf_indicacion_medica(datos_pdf, guardar_en_disco=True)
            pdf_path = pdf_res.get("file_path")
            pdf_url = pdf_res.get("url")
            emision_uuid = pdf_res.get("emision_id") or str(uuid.uuid4())

            mensaje_wa = (
                f"Estimado/a *{pac_nom}*:\n\n"
                f"Adjuntamos las *Indicaciones Médicas Postquirúrgicas* oficiales correspondientes a su intervención de *{practica_nom}* realizada hoy en *Centro Visión*.\n\n"
                f"Ante cualquier duda o signo de alarma, estamos a su disposición."
            )
            wa_status, wa_res = despachar_indicacion_por_whatsapp(
                paciente_id=t.get("paciente_id"),
                paciente_telefono=tel_dest,
                paciente_nombre=pac_nom,
                practica_nombre=practica_nom,
                mensaje_wa=mensaje_wa,
                pdf_url=pdf_url,
                emision_uuid=emision_uuid,
                operador_id=operador_id,
                operador_nombre=operador_nombre or "Quirófano",
                pdf_path=pdf_path,
                tipo_documento="postquirurgico"
            )

            supabase.table("emisiones_indicaciones_geclisa").insert({
                "id": emision_uuid,
                "paciente_id": t.get("paciente_id"),
                "geclisa_pre_id": t.get("cirujano_id"),
                "medico_nombre": datos_pdf["medico_nombre"],
                "medico_matricula": datos_pdf["medico_matricula"],
                "practica_nombre": practica_nom,
                "practica_codigo": practica_cod,
                "texto_indicaciones": txt_cuerpo,
                "medicamentos": meds,
                "cuidados_generales": cuidados,
                "pautas_alarma": alarmas,
                "modulos_emitidos_json": modulos_norm,
                "plantilla_origen_id": plantilla_origen_id,
                "origen_resolucion": origen_resolucion,
                "contenido_original_json": baseline_modulos,
                "version_actual": 1,
                "fue_modificada": fue_modificada,
                "campos_modificados": campos_modificados,
                "operador_id": operador_id,
                "operador_nombre": operador_nombre or "Quirófano",
                "editado_at": datetime.now(timezone.utc).isoformat() if fue_modificada else None,
                "pdf_path": pdf_path,
                "pdf_url": pdf_url,
                "whatsapp_status": wa_status,
                "tipo_documento": "postquirurgico",
                "titulo_documento": "INDICACIONES MÉDICAS POSTQUIRÚRGICAS",
                "fecha_emision": datetime.now(timezone.utc).date().isoformat()
            }).execute()

            _registrar_version_inicial(
                emision_id=emision_uuid,
                modulos_emitidos=modulos_norm,
                texto_indicaciones=txt_cuerpo,
                medicamentos=meds,
                cuidados_generales=cuidados,
                pautas_alarma=alarmas,
                fue_modificada=fue_modificada,
                campos_modificados=campos_modificados,
                pdf_url=pdf_url,
                geclisa_im_id=None,
                geclisa_im_ids=[],
                operador_id=operador_id,
                operador_nombre=operador_nombre or "Quirófano"
            )

            resultado = {
                "success": True,
                "emision_id": emision_uuid,
                "version_numero": 1,
                "pdf_url": pdf_url,
                "fue_modificada": fue_modificada,
                "campos_modificados": campos_modificados,
                "whatsapp_status": wa_status,
                "whatsapp_resultado": wa_res
            }

        if resultado and resultado.get("success"):
            supabase.table("turnos_quirofano").update({
                "indicaciones_postqx_enviadas": True,
                "indicaciones_postqx_enviadas_at": datetime.now(timezone.utc).isoformat(),
                "indicaciones_postqx_pdf_url": resultado.get("pdf_url"),
                "indicaciones_postqx_emision_id": resultado.get("emision_id")
            }).eq("id", turno_id).execute()

        return resultado or {"success": False, "error": "No se pudo emitir la indicación"}
    except Exception as e:
        logger.error(f"Error emitiendo indicaciones post-qx para turno {turno_id}: {e}")
        return {"success": False, "error": str(e)}
