"""
Servicio Especializado de Detección, Escalamiento y Contención de Urgencias Postquirúrgicas.
Protocolo de Seguridad Clínica Oftalmológica para Centrovisión Oftalmología Integral.

Funcionalidades:
1. Detección de las 5 Banderas Rojas Oftalmológicas (Dolor severo, pérdida visual, endoftalmitis, fotopsias/telón, trauma).
2. Resolución determinística del cirujano tratante (cruce asesorias_quirurgicas / turnos_quirofano con usuarios_perfil).
3. Notificación urgente multicanal vía WhatsApp (con deep link /chat?conv={id}) y jerarquía de contingencia a Guardia Central.
4. Auto-derivación inmediata en el CRM con silenciamiento del bot (bot_disabled = True) y trazabilidad inalterable.
5. Mensaje empático de contención al paciente con dirección física de guardia y teléfono de emergencias 24h.
"""

import os
import re
import secrets
import hashlib
import logging
from datetime import datetime, date, timezone, timedelta
from typing import Dict, Any, Optional, Tuple, List

from app.db import supabase
from app.services.config_service import load_settings
from app.services.whatsapp_cloud.client import (
    WhatsAppCloudClient, 
    get_whatsapp_cloud_credentials,
    ConversationWindowClosedError,
    MetaAPIError
)

logger = logging.getLogger("urgencias_service")

# =========================================================================
# 1. BANDERAS ROJAS Y DETECCIÓN CLÍNICA OFTALMOLÓGICA
# =========================================================================

# Palabras clave y patrones de alta severidad oftalmológica
PATRONES_ALARMA_OFTALMOLOGICA = [
    # 1. Dolor agudo / severo
    r"\b(dolor\s+(muy\s+)?(fuerte|intenso|insoportable|agudo|terrible|punzante))\b",
    r"\b(me\s+duele\s+muchisimo|no\s+aguanto\s+el\s+dolor|dolor\s+en\s+el\s+ojo\s+operado)\b",
    # 2. Pérdida o caída brusca de agudeza visual
    r"\b(no\s+veo\s+nada|perdi\s+la\s+vision|veo\s+todo\s+(negro|oscuro|borroso)|baja\s+visual\s+brusca)\b",
    r"\b(deje\s+de\s+ver|se\s+me\s+apago\s+la\s+vision|ceguera|niebla\s+total)\b",
    # 3. Infección / Endoftalmitis / Secreción
    r"\b(secrecion\s+(amarilla|verde|purulenta)|pus\s+en\s+el\s+ojo|ojo\s+hinchado\s+y\s+rojo)\b",
    r"\b(infeccion|endoftalmitis|parpado\s+completamente\s+cerrado)\b",
    # 4. Desprendimiento de Retina / Fotopsias
    r"\b(destellos(\s+de\s+luz)?|flashes|lluvia\s+de\s+manchas|telon\s+negro|cortina\s+negra)\b",
    r"\b(mancha\s+fija\s+que\s+crece|sombra\s+en\s+el\s+ojo)\b",
    # 5. Traumatismo o complicación física
    r"\b(me\s+golpee\s+el\s+ojo(\s+operado)?|me\s+toque\s+sin\s+querer|se\s+me\s+movio\s+el\s+lente)\b",
    r"\b(salio\s+liquido|derrame\s+con\s+dolor|luxacion|trauma\s+ocular)\b"
]

def contiene_signo_de_alarma(texto: str) -> Tuple[bool, Optional[str]]:
    """
    Evalúa si un texto libre de un paciente contiene signos de alarma oftalmológica inmediata.
    Retorna (es_urgencia, motivo_detectado).
    """
    if not texto:
        return False, None
    texto_norm = texto.lower()
    for patron in PATRONES_ALARMA_OFTALMOLOGICA:
        match = re.search(patron, texto_norm, re.IGNORECASE)
        if match:
            return True, match.group(0)
    return False, None


# =========================================================================
# 2. RESOLUCIÓN DETERMINÍSTICA DEL CIRUJANO TRATANTE
# =========================================================================

def resolver_cirujano_del_paciente(paciente_id: str) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Localiza la cirugía o asesoría quirúrgica más reciente del paciente y busca el usuario
    médico cirujano en usuarios_perfil (vía geclisa_pre_id, geclisa_matricula o nombre).
    
    Retorna (cirujano_user_profile, surgical_context).
    """
    contexto_qx: Dict[str, Any] = {
        "paciente_id": paciente_id,
        "ojo": None,
        "practica_nombre": None,
        "fecha_cirugia": None,
        "dias_postop": None,
        "lio_detalle": None,
        "cirujano_nombre_caso": None,
        "cirujano_id_caso": None,
        "origen_datos": None
    }

    cirujano_profile = None

    try:
        # 1. Buscar en asesorias_quirurgicas (fuente principal y enriquecida)
        as_res = supabase.table("asesorias_quirurgicas")\
            .select("*")\
            .eq("paciente_id", paciente_id)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()

        if as_res.data and len(as_res.data) > 0:
            as_row = as_res.data[0]
            contexto_qx["origen_datos"] = "asesorias_quirurgicas"
            contexto_qx["ojo"] = as_row.get("ojo") or "OD"
            contexto_qx["practica_nombre"] = as_row.get("practica_nombre") or "Cirugía Oftalmológica"
            
            fecha_str = as_row.get("fecha_definitiva_cirugia") or as_row.get("fecha_probable_cirugia")
            if fecha_str:
                contexto_qx["fecha_cirugia"] = str(fecha_str)
                try:
                    fecha_obj = datetime.strptime(str(fecha_str)[:10], "%Y-%m-%d").date()
                    dias = (date.today() - fecha_obj).days
                    contexto_qx["dias_postop"] = dias
                except Exception:
                    pass

            # LIO
            lio_ops = as_row.get("lio_calculo_opciones")
            lente_lote = as_row.get("lente_lote")
            if lio_ops and isinstance(lio_ops, dict):
                contexto_qx["lio_detalle"] = lio_ops.get("modelo") or lio_ops.get("nombre") or str(lio_ops)
            elif lente_lote:
                contexto_qx["lio_detalle"] = f"Lote: {lente_lote}"

            med_id = as_row.get("medico_cirujano_id")
            med_mat = as_row.get("medico_cirujano_matricula")
            med_nom = as_row.get("medico_cirujano_nombre")

            contexto_qx["cirujano_id_caso"] = med_id
            contexto_qx["cirujano_nombre_caso"] = med_nom

            # Cruzar con usuarios_perfil
            cirujano_profile = _buscar_usuario_medico(med_id, med_mat, med_nom)

        # 2. Si no se halló cirujano en asesorías, buscar en turnos_quirofano
        if not cirujano_profile:
            tq_res = supabase.table("turnos_quirofano")\
                .select("*")\
                .eq("paciente_id", paciente_id)\
                .order("fecha_cirugia", desc=True)\
                .limit(1)\
                .execute()

            if tq_res.data and len(tq_res.data) > 0:
                tq_row = tq_res.data[0]
                if not contexto_qx["practica_nombre"]:
                    contexto_qx["origen_datos"] = "turnos_quirofano"
                    contexto_qx["ojo"] = tq_row.get("ojo") or contexto_qx["ojo"] or "OD"
                    contexto_qx["practica_nombre"] = tq_row.get("practica_nombre") or "Cirugía de Quirófano"
                    fecha_tq = tq_row.get("fecha_cirugia")
                    if fecha_tq:
                        contexto_qx["fecha_cirugia"] = str(fecha_tq)
                        try:
                            f_obj = datetime.strptime(str(fecha_tq)[:10], "%Y-%m-%d").date()
                            contexto_qx["dias_postop"] = (date.today() - f_obj).days
                        except Exception:
                            pass

                cir_id = tq_row.get("cirujano_id")
                cir_nom = tq_row.get("cirujano_nombre")
                cirujano_profile = _buscar_usuario_medico(cir_id, None, cir_nom)
                if not contexto_qx["cirujano_nombre_caso"]:
                    contexto_qx["cirujano_nombre_caso"] = cir_nom

    except Exception as e:
        logger.error(f"[UrgenciasService] Error resolviendo cirujano para paciente {paciente_id}: {e}")

    return cirujano_profile, contexto_qx


def _buscar_usuario_medico(geclisa_pre_id: Optional[int], matricula: Optional[str], nombre: Optional[str]) -> Optional[Dict[str, Any]]:
    """Busca en usuarios_perfil por geclisa_pre_id, geclisa_matricula o coincidencia de nombre."""
    try:
        # Match 1: ID de prestador Geclisa
        if geclisa_pre_id:
            res = supabase.table("usuarios_perfil").select("id, email, nombre_completo, telefono, geclisa_pre_id, geclisa_matricula, activo").eq("geclisa_pre_id", geclisa_pre_id).eq("activo", True).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]

        # Match 2: Matrícula
        if matricula and str(matricula).strip():
            res = supabase.table("usuarios_perfil").select("id, email, nombre_completo, telefono, geclisa_pre_id, geclisa_matricula, activo").eq("geclisa_matricula", str(matricula).strip()).eq("activo", True).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]

        # Match 3: Búsqueda flexible por nombre
        if nombre and len(nombre.strip()) > 3:
            clean_name = nombre.replace("Dr.", "").replace("Dra.", "").replace("Dr", "").replace("Dra", "").strip()
            res = supabase.table("usuarios_perfil").select("id, email, nombre_completo, telefono, geclisa_pre_id, geclisa_matricula, activo").ilike("nombre_completo", f"%{clean_name}%").eq("activo", True).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]

    except Exception as err:
        logger.debug(f"[UrgenciasService] Error buscando usuario médico en usuarios_perfil: {err}")

    return None


def obtener_base_crm_url() -> str:
    """
    Obtiene la URL base del CRM para deep links a chats y urgencias.
    Prioridad:
    1. Base de datos: ajustes_crm -> clinica -> url_crm (o ajustes_crm -> url_crm)
    2. Variables de entorno: NEXT_PUBLIC_APP_URL, APP_URL, FRONTEND_URL
    3. Dominio de producción oficial en Vercel: https://crm-agentico-nube.vercel.app
    """
    try:
        from app.services.config_service import obtener_ajustes_crm
        ajustes = obtener_ajustes_crm()
        clinica = ajustes.get("clinica", {}) if isinstance(ajustes, dict) else {}
        url_cfg = clinica.get("url_crm") or ajustes.get("url_crm")
        if url_cfg and isinstance(url_cfg, str) and url_cfg.strip():
            return url_cfg.strip().rstrip("/")
    except Exception as e:
        logger.warning(f"[UrgenciasService] No se pudo leer url_crm de configuracion_sistema: {e}")

    env_url = (
        os.getenv("NEXT_PUBLIC_APP_URL") 
        or os.getenv("APP_URL") 
        or os.getenv("FRONTEND_URL")
    )
    if env_url and env_url.strip():
        return env_url.strip().rstrip("/")

    return "https://crm-agentico-nube.vercel.app"


def generar_token_acceso_urgencia(
    usuario_id: str,
    conversacion_id: str,
    paciente_id: Optional[str] = None,
    ttl_minutos: int = 30
) -> Optional[str]:
    """
    Genera un token criptoseguro de un solo uso (One-Time Emergency Access Token - OTET)
    para acceso directo del médico desde WhatsApp al chat del paciente.
    Almacena el hash SHA-256 en la base de datos con expiración acotada (30 min).
    Retorna el raw_token para ser incluido en la URL enviada por WhatsApp.
    """
    try:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        ahora = datetime.now(timezone.utc)
        expires_at = (ahora + timedelta(minutes=ttl_minutos)).isoformat()

        supabase.table("urgencias_tokens_acceso").insert({
            "token_hash": token_hash,
            "usuario_id": usuario_id,
            "conversacion_id": conversacion_id,
            "paciente_id": paciente_id,
            "usado": False,
            "expires_at": expires_at,
            "created_at": ahora.isoformat()
        }).execute()

        logger.info(f"[UrgenciasService] Token de acceso rápido generado para usuario {usuario_id} (conv {conversacion_id}, expira {expires_at})")
        return raw_token
    except Exception as e:
        logger.error(f"[UrgenciasService] Error generando token de acceso rápido: {e}", exc_info=True)
        return None


# =========================================================================
# 3. NOTIFICACIÓN DE ALERTA POR WHATSAPP AL CIRUJANO (O GUARDIA CENTRAL)
# =========================================================================

async def despachar_alerta_whatsapp_cirujano(
    telefono_destino: str,
    es_guardia_central: bool,
    datos_alerta: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Envía el mensaje de alerta quirúrgica inmediata a WhatsApp.
    Utiliza texto libre enriquecido o plantilla según el estado de la ventana.
    """
    phone_id, token = get_whatsapp_cloud_credentials()
    if not phone_id or not token:
        logger.warning("[UrgenciasService] Credenciales WABA no configuradas; no se pudo enviar WhatsApp.")
        return {"success": False, "error": "Credenciales WABA no configuradas"}

    client = WhatsAppCloudClient(phone_number_id=phone_id, access_token=token)

    destinatario_titulo = "EQUIPO DE GUARDIA MÉDICA" if es_guardia_central else f"Dr./Dra. {datos_alerta.get('cirujano_nombre', 'Cirujano/a')}"
    paciente_nombre = datos_alerta.get("paciente_nombre", "Paciente")
    dni = datos_alerta.get("dni", "S/D")
    practica = datos_alerta.get("practica_nombre", "Cirugía Oftalmológica")
    ojo = datos_alerta.get("ojo", "OD")
    fecha_qx = datos_alerta.get("fecha_cirugia", "Reciente")
    dias_postop = datos_alerta.get("dias_postop", "pocos")
    sintoma = datos_alerta.get("sintoma_reportado", "Molestias severas")
    enlace_chat = datos_alerta.get("enlace_chat") or f"{obtener_base_crm_url()}/chat"

    cuerpo_alerta = (
        f"🚨 *ALERTA MÉDICA POSTQUIRÚRGICA - CENTROVISIÓN*\n\n"
        f"Estimado/a *{destinatario_titulo}*:\n"
        f"El paciente *{paciente_nombre}* (DNI: *{dni}*), intervenido de *{practica}* en ojo *{ojo}* "
        f"el día *{fecha_qx}* (hace *{dias_postop}* días), ha reportado síntomas de alarma por WhatsApp:\n\n"
        f"⚠️ *Signo de Alarma:* \"{sintoma}\"\n\n"
        f"El bot de IA fue *silenciado de inmediato* y la conversación fue asignada en el CRM.\n"
        f"👉 *Acceder directamente al chat del paciente:*\n{enlace_chat}\n\n"
        f"ℹ️ _Si no puede atenderlo inmediatamente, la guardia médica central ({datos_alerta.get('telefono_guardia', '')}) está en preaviso._"
    )

    try:
        # Intentar envío directo de texto libre
        res = await client.send_free_text(to_phone=telefono_destino, text=cuerpo_alerta, preview_url=True)
        await client.close()
        logger.info(f"[UrgenciasService] Alerta enviada a WhatsApp ({telefono_destino}): wamid={res.get('wamid')}")
        return {"success": True, "wamid": res.get("wamid"), "modo": "free_text"}

    except ConversationWindowClosedError:
        # Si la ventana de 24h está cerrada, intentar fallback con plantilla homologada
        logger.warning(f"[UrgenciasService] Ventana 24h cerrada para {telefono_destino}. Intentando plantilla...")
        try:
            # Plantilla estandarizada de notificación utilitaria
            components = [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": destinatario_titulo},
                        {"type": "text", "text": paciente_nombre},
                        {"type": "text", "text": str(dni)},
                        {"type": "text", "text": practica},
                        {"type": "text", "text": ojo},
                        {"type": "text", "text": str(fecha_qx)},
                        {"type": "text", "text": str(dias_postop)},
                        {"type": "text", "text": sintoma[:100]},
                        {"type": "text", "text": enlace_chat}
                    ]
                }
            ]
            res_tpl = await client.send_template(
                to_phone=telefono_destino,
                template_name="alerta_urgencia_postquirurgica",
                language_code="es_AR",
                components=components
            )
            await client.close()
            return {"success": True, "wamid": res_tpl.get("wamid"), "modo": "template"}
        except Exception as e_tpl:
            logger.error(f"[UrgenciasService] Falló envío de plantilla al cirujano: {e_tpl}")
            await client.close()
            return {"success": False, "error": str(e_tpl)}

    except Exception as e:
        logger.error(f"[UrgenciasService] Error despachando WhatsApp a {telefono_destino}: {e}")
        await client.close()
        return {"success": False, "error": str(e)}


# =========================================================================
# 4. ORQUESTADOR PRINCIPAL: PROCESAR URGENCIA POSTQUIRÚRGICA
# =========================================================================

async def procesar_urgencia_postquirurgica(
    conversacion_id: str,
    paciente_id: str,
    texto_mensaje: str,
    motivo_detectado: Optional[str] = None
) -> Dict[str, Any]:
    """
    Ejecuta el protocolo completo de urgencia postquirúrgica:
    1. Obtiene datos del paciente y resuelve el cirujano.
    2. Silencia al bot y auto-asigna la conversación.
    3. Notifica por WhatsApp al cirujano (o guardia central si no tiene teléfono).
    4. Registra auditoría interna en los mensajes de la conversación.
    5. Retorna el mensaje de contención médica para enviar de inmediato al paciente.
    """
    settings = load_settings()
    clinica_nombre = settings.get("clinica", {}).get("nombre", "Centrovisión Oftalmología Integral")
    direccion_guardia = settings.get("clinica", {}).get("direccion", "Mitre 540, Mendoza, Argentina")
    telefono_guardia = settings.get("clinica", {}).get("telefono_guardia", "+54 9 261 470-3230")

    # 1. Datos del paciente
    paciente_res = supabase.table("pacientes").select("*").eq("id", paciente_id).single().execute()
    paciente = paciente_res.data or {}
    paciente_nombre = paciente.get("nombre", "Paciente")
    dni = paciente.get("dni", "S/D")

    # 2. Cirujano y contexto quirúrgico
    cirujano, contexto_qx = resolver_cirujano_del_paciente(paciente_id)
    cirujano_nombre = cirujano.get("nombre_completo") if cirujano else (contexto_qx.get("cirujano_nombre_caso") or "Cirujano de Guardia")
    cirujano_id = cirujano.get("id") if cirujano else None
    cirujano_telefono = cirujano.get("telefono") if cirujano else None

    # Base URL del frontend para deep link
    base_crm_url = obtener_base_crm_url()

    # Generar Token Criptográfico de Acceso Rápido (OTET) si el cirujano está registrado
    raw_token = None
    if cirujano_id:
        raw_token = generar_token_acceso_urgencia(
            usuario_id=cirujano_id,
            conversacion_id=conversacion_id,
            paciente_id=paciente_id,
            ttl_minutos=30
        )

    if raw_token:
        enlace_chat = f"{base_crm_url}/auth/acceso-urgencia?token={raw_token}"
    else:
        enlace_chat = f"{base_crm_url}/chat?conv={conversacion_id}"

    # 3. Silenciar bot y auto-asignar conversación
    ahora_iso = datetime.now(timezone.utc).isoformat()
    meta_urgencia = {
        "urgencia_postquirurgica": True,
        "urgencia_activada_at": ahora_iso,
        "motivo_detectado": motivo_detectado or texto_mensaje[:100],
        "contexto_quirurgico": contexto_qx,
        "cirujano_notificado": cirujano_nombre,
        "cirujano_user_id": cirujano_id
    }

    try:
        update_payload: Dict[str, Any] = {
            "bot_disabled": True,
            "estado_gestion": "URGENCIA_POSTQUIRURGICA",
            "updated_at": ahora_iso,
            "metadata_json": meta_urgencia
        }
        if cirujano_id:
            update_payload["asignado_a_usuario_id"] = cirujano_id

        supabase.table("conversaciones")\
            .update(update_payload)\
            .eq("id", conversacion_id)\
            .execute()

        logger.info(f"[UrgenciasService] Conversación {conversacion_id} marcada como URGENCIA_POSTQUIRURGICA y asignada a {cirujano_id}")
    except Exception as e_up:
        logger.error(f"[UrgenciasService] Error actualizando conversación {conversacion_id}: {e_up}")

    # 4. Despacho de Alerta por WhatsApp (Jerarquía de contingencia)
    datos_alerta = {
        "cirujano_nombre": cirujano_nombre,
        "paciente_nombre": paciente_nombre,
        "dni": dni,
        "practica_nombre": contexto_qx.get("practica_nombre") or "Cirugía de ojos",
        "ojo": contexto_qx.get("ojo") or "Ojo operado",
        "fecha_cirugia": contexto_qx.get("fecha_cirugia") or "Reciente",
        "dias_postop": contexto_qx.get("dias_postop") if contexto_qx.get("dias_postop") is not None else "-",
        "sintoma_reportado": texto_mensaje,
        "enlace_chat": enlace_chat,
        "telefono_guardia": telefono_guardia
    }

    telefono_alerta = None
    es_guardia = False

    if cirujano_telefono and len(str(cirujano_telefono).strip()) >= 8:
        # Destino prioritario: Teléfono personal del cirujano
        telefono_alerta = str(cirujano_telefono).strip()
        es_guardia = False
        logger.info(f"[UrgenciasService] Despachando alerta al cirujano tratante ({cirujano_nombre}): {telefono_alerta}")
    else:
        # Fallback de contingencia: Guardia general de la clínica
        telefono_alerta = telefono_guardia
        es_guardia = True
        logger.warning(f"[UrgenciasService] Cirujano {cirujano_nombre} sin teléfono de guardia. Reenviando a Guardia Central ({telefono_guardia})")

    res_wa = await despachar_alerta_whatsapp_cirujano(
        telefono_destino=telefono_alerta,
        es_guardia_central=es_guardia,
        datos_alerta=datos_alerta
    )

    # 5. Registro en bitácora / nota interna en el chat del CRM
    nota_interna = (
        f"🚨 [ALERTA DE SEGURIDAD POSTQUIRÚRGICA ACTIVADA]\n"
        f"• Motivo reportado: \"{texto_mensaje}\"\n"
        f"• Cirugía registrada: {contexto_qx.get('practica_nombre', 'N/A')} ({contexto_qx.get('ojo', 'N/A')}) - Fecha: {contexto_qx.get('fecha_cirugia', 'N/A')}\n"
        f"• Cirujano tratante: {cirujano_nombre} ({'Asignado en CRM' if cirujano_id else 'Sin usuario CRM'})\n"
        f"• Notificación WhatsApp: Enviada a {telefono_alerta} ({'Guardia Central' if es_guardia else 'Móvil Cirujano'}) - Estado: {'OK' if res_wa.get('success') else 'FALLO: ' + str(res_wa.get('error'))}\n"
        f"• El bot de IA fue suspendido automáticamente."
    )

    try:
        supabase.table("mensajes").insert({
            "conversacion_id": conversacion_id,
            "emisor": "sistema",
            "contenido": nota_interna,
            "metadata_json": {
                "tipo": "alerta_urgencia_postquirurgica",
                "datos_alerta": datos_alerta,
                "resultado_whatsapp": res_wa
            }
        }).execute()
    except Exception as e_msg:
        logger.error(f"[UrgenciasService] Error registrando mensaje de sistema: {e_msg}")

    # 6. Mensaje empático y claro de contención para el paciente
    # Guardrail: Jamás minimizar ni aconsejar automedicación.
    mensaje_paciente = (
        f"Estimado/a *{paciente_nombre}*, comprendemos la importancia de lo que nos comentas y tu tranquilidad es nuestra prioridad.\n\n"
        f"🚨 Hemos emitido una *alerta médica urgente* directamente al *{cirujano_nombre}* y a nuestro equipo quirúrgico con el detalle de tus síntomas para que puedan revisar tu caso.\n\n"
        f"El asistente virtual ha sido silenciado para que un profesional médico continúe la atención por este medio a la brevedad.\n\n"
        f"⚠️ *ATENCIÓN INMEDIATA:*\n"
        f"Si presentas dolor muy agudo que no cede, pérdida brusca de visión o traumatismo, no esperes una respuesta por mensaje. "
        f"Comunícate de inmediato a nuestra línea de guardia médica: *{telefono_guardia}* o preséntate en nuestra sede central:\n"
        f"🏥 *{clinica_nombre}* - {direccion_guardia}."
    )

    return {
        "success": True,
        "cirujano_notificado": cirujano_nombre,
        "telefono_notificado": telefono_alerta,
        "es_guardia_central": es_guardia,
        "mensaje_paciente": mensaje_paciente,
        "contexto_quirurgico": contexto_qx
    }
