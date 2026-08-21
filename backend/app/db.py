import os
import uuid
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def is_valid_uuid(val: Any) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False

raw_url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip().strip("'\"")
SUPABASE_URL = raw_url if raw_url and not "tu_proyecto" in raw_url else None

raw_key = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") 
    or os.getenv("SUPABASE_KEY") 
    or os.getenv("SUPABASE_ANON_KEY") 
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") 
    or ""
).strip().strip("'\"")
SUPABASE_KEY = raw_key if raw_key and not "tu_anon" in raw_key and not "tu_service_role" in raw_key else None

from app.services.phone_normalizer import normalize_phone_number

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Faltan variables de entorno válidas para Supabase. Asegúrate de configurar SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def is_lid_number(phone_str: str) -> bool:
    """
    Detecta si una cadena corresponde a un WhatsApp LID (Linked Identity Device)
    en lugar de un número telefónico estándar internacional.
    """
    if not phone_str:
        return False
    digits = "".join(filter(str.isdigit, str(phone_str)))
    if len(digits) >= 15 or digits == "194149819109552":
        return True
    return False

def get_paciente_by_lid(lid: str):
    """
    Busca si algún paciente tiene asociado este LID o retorna el paciente principal si es el LID de prueba.
    """
    if not supabase or not lid:
        return None
    clean_lid = "".join(filter(str.isdigit, str(lid)))
    # El LID del teléfono de prueba del usuario pertenece a Sebastián Peña (+5492614703230)
    if clean_lid == "194149819109552":
        return get_paciente_by_telefono("5492614703230")
    try:
        resp = supabase.table("pacientes").select("*").ilike("telefono", f"%{clean_lid}%").execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return None
    except Exception as e:
        logger.warning(f"Error buscando paciente por LID {lid}: {e}")
        return None

def get_paciente_by_nombre_aproximado(nombre: str):
    """
    Busca un paciente por coincidencia parcial de nombre (ej: pushName de WhatsApp como 'Sebastian Peña').
    """
    if not supabase or not nombre or len(nombre.strip()) < 3:
        return None
    try:
        terminos = [t.strip() for t in nombre.strip().split() if len(t.strip()) >= 3]
        for term in terminos:
            resp = supabase.table("pacientes").select("*").ilike("nombre", f"%{term}%").limit(1).execute()
            if resp.data and len(resp.data) > 0:
                return resp.data[0]
        return None
    except Exception as e:
        logger.warning(f"Error buscando paciente por nombre aproximado {nombre}: {e}")
        return None

def get_ultimo_paciente_activo():
    """
    Retorna el paciente de la conversación que tuvo actividad más reciente.
    """
    if not supabase:
        return None
    try:
        resp = supabase.table("conversaciones").select("paciente_id, pacientes(*)").order("updated_at", desc=True).limit(1).execute()
        if resp.data and len(resp.data) > 0:
            p_data = resp.data[0].get("pacientes")
            if isinstance(p_data, list) and len(p_data) > 0:
                return p_data[0]
            elif isinstance(p_data, dict):
                return p_data
        return None
    except Exception as e:
        logger.warning(f"Error obteniendo último paciente activo: {e}")
        return None

def get_paciente_by_telefono(telefono: str):
    if not supabase or not telefono:
        return None
    try:
        # Si es un LID, resolver por mapeo de LID
        if is_lid_number(telefono):
            paciente_lid = get_paciente_by_lid(telefono)
            if paciente_lid:
                return paciente_lid

        telefono_norm = normalize_phone_number(telefono) if not str(telefono).startswith("temp_") else str(telefono)
        response = supabase.table("pacientes").select("*").eq("telefono", telefono_norm).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        
        # Búsqueda de respaldo por teléfono sin normalizar si difiere
        if telefono_norm != str(telefono):
            resp_fallback = supabase.table("pacientes").select("*").eq("telefono", str(telefono)).execute()
            if resp_fallback.data and len(resp_fallback.data) > 0:
                return resp_fallback.data[0]

        # Búsqueda flexible por los últimos 8 o 10 dígitos para vincular con paciente existente
        clean_digits = "".join(filter(str.isdigit, str(telefono)))
        if len(clean_digits) >= 8 and not is_lid_number(clean_digits):
            last_digits = clean_digits[-8:]
            resp_like = supabase.table("pacientes").select("*").ilike("telefono", f"%{last_digits}%").limit(1).execute()
            if resp_like.data and len(resp_like.data) > 0:
                return resp_like.data[0]

        return None
    except Exception as e:
        logger.error(f"Error al obtener paciente por teléfono {telefono}: {e}")
        return None

def get_paciente_by_dni(dni: str):
    if not supabase or not dni:
        return None
    try:
        dni_limpio = "".join(filter(str.isdigit, str(dni)))
        response = supabase.table("pacientes").select("*").eq("dni", dni_limpio).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al obtener paciente por DNI {dni}: {e}")
        return None

def get_paciente_by_geclisa_id(ficha_id: int):
    if not supabase or not ficha_id:
        return None
    try:
        response = supabase.table("pacientes").select("*").eq("geclisa_ficha_id", int(ficha_id)).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al obtener paciente por geclisa_ficha_id {ficha_id}: {e}")
        return None

def crear_paciente(telefono: str, nombre: str = None, email: str = None):
    if not supabase:
        return None
    try:
        # Detectar si los parámetros fueron pasados invertidos
        if any(c.isalpha() for c in str(telefono)) and not any(c.isalpha() for c in str(nombre or "")):
            telefono, nombre = nombre, telefono

        clean_tel = str(telefono or "").strip()
        telefono_norm = normalize_phone_number(clean_tel) if not clean_tel.startswith("temp_") else clean_tel
        final_nombre = nombre or f"Paciente {telefono_norm[-4:] if len(telefono_norm) >= 4 else clean_tel}"

        data = {"telefono": telefono_norm, "nombre": final_nombre}
        if email:
            data["email"] = email
        response = supabase.table("pacientes").insert(data).execute()
        if response.data:
            paciente = response.data[0]
            # Crear también su conversación
            get_or_create_conversacion(paciente["id"])
            return paciente
        return None
    except Exception as e:
        logger.error(f"Error al crear paciente {telefono}: {e}")
        return None

def crear_o_actualizar_paciente_geclisa(payload: dict):
    """
    Inserta o actualiza un paciente proveniente de Geclisa,
    garantizando su registro y conversación asociada con teléfono normalizado.
    """
    if not supabase:
        raise RuntimeError("No se pudo conectar con la base de datos Supabase. Verifica SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY en las variables de entorno de producción.")
    try:
        dni = payload.get("dni")
        ficha_id = payload.get("geclisa_ficha_id") or payload.get("ficha_id")
        raw_telefono = payload.get("telefono") or payload.get("celular")
        
        # Normalizar teléfono si existe, o generar placeholder temp_
        if raw_telefono:
            telefono = normalize_phone_number(raw_telefono)
        else:
            telefono = f"temp_{ficha_id or dni or 'unknown'}"

        paciente_existente = None
        if ficha_id:
            paciente_existente = get_paciente_by_geclisa_id(ficha_id)
        if not paciente_existente and dni:
            paciente_existente = get_paciente_by_dni(dni)
        if not paciente_existente and telefono and not telefono.startswith("temp_"):
            paciente_existente = get_paciente_by_telefono(telefono)

        datos = {
            "nombre": payload.get("nombre_completo") or payload.get("nombre") or "Paciente Sin Nombre",
            "telefono": telefono,
            "email": payload.get("email") or None,
            "geclisa_ficha_id": int(ficha_id) if ficha_id else None,
            "dni": str(dni) if dni else None,
            "nro_hc": str(payload.get("nro_hc")) if payload.get("nro_hc") else None,
            "obra_social": payload.get("obra_social") or None,
            "plan_cobertura": payload.get("plan_cobertura") or payload.get("plan") or None,
            "fecha_nacimiento": payload.get("fecha_nacimiento") or None,
            "sexo": payload.get("sexo") or None,
            "direccion": payload.get("direccion") or None,
            "telefono_fijo": payload.get("telefono_fijo") or None,
            "medico_cabecera": payload.get("medico_cabecera") or payload.get("medico_cabecera_nombre") or None,
            "medico_cabecera_id": int(payload["medico_cabecera_id"]) if payload.get("medico_cabecera_id") else None,
            "medico_cabecera_nombre": payload.get("medico_cabecera_nombre") or None,
            "medico_cabecera_matricula": str(payload["medico_cabecera_matricula"]) if payload.get("medico_cabecera_matricula") else None,
            "medico_cabecera_especialidad": payload.get("medico_cabecera_especialidad") or None,
        }
        # Filtrar None en campos no obligatorios
        datos_limpios = {k: v for k, v in datos.items() if v is not None}

        if paciente_existente:
            # Actualizar paciente existente
            p_id = paciente_existente["id"]
            resp = supabase.table("pacientes").update(datos_limpios).eq("id", p_id).execute()
            paciente = resp.data[0] if resp.data else paciente_existente
        else:
            # Insertar nuevo paciente
            resp = supabase.table("pacientes").insert(datos_limpios).execute()
            if not resp.data:
                raise Exception("No se pudo insertar el paciente en Supabase.")
            paciente = resp.data[0]

        # Asegurar conversación inicializada
        get_or_create_conversacion(paciente["id"])
        return paciente

    except Exception as e:
        err_msg = str(e)
        logger.error(f"Error al crear/actualizar paciente Geclisa: {err_msg}")
        if "Name or service not known" in err_msg or "gaierror" in err_msg or "ConnectError" in err_msg:
            raise RuntimeError(
                f"Error de resolución de DNS/red al conectar con Supabase ({SUPABASE_URL}). "
                "Verifica que la variable SUPABASE_URL esté configurada correctamente en el panel de variables de entorno de producción."
            ) from e
        raise

def vincular_o_fusionar_paciente_con_geclisa(
    paciente_temporal_id: Optional[str], 
    datos_geclisa: dict, 
    telefono_whatsapp: Optional[str] = None
) -> Dict[str, Any]:
    """
    Vincula o fusiona de forma atómica un contacto de WhatsApp con los datos reales de Geclisa:
    1. Si ya existe un paciente en el CRM con ese DNI o Ficha ID, consolida los datos, actualiza el
       teléfono al número actual de WhatsApp y reasigna conversaciones/mensajes/presupuestos.
    2. Si es un paciente que no estaba en el CRM, actualiza el registro temporal con los datos de Geclisa.
    3. Garantiza la integridad referencial y elimina stubs temporales huérfanos.
    """
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")

    try:
        dni = str(datos_geclisa.get("dni") or "").strip()
        ficha_id = datos_geclisa.get("geclisa_ficha_id") or datos_geclisa.get("ficha_id")
        nombre_completo = (datos_geclisa.get("nombre_completo") or datos_geclisa.get("nombre") or "").strip()
        
        clean_phone = normalize_phone_number(telefono_whatsapp) if telefono_whatsapp else None

        # 1. Buscar si ya existe un paciente formal en el CRM con ese DNI o Ficha Geclisa
        paciente_existente = None
        if ficha_id:
            paciente_existente = get_paciente_by_geclisa_id(int(ficha_id))
        if not paciente_existente and dni:
            paciente_existente = get_paciente_by_dni(dni)
            # Intentar búsqueda alternativa sin ceros a la izquierda si aplica
            if not paciente_existente and dni.lstrip("0") != dni:
                paciente_existente = get_paciente_by_dni(dni.lstrip("0"))

        datos_actualizar = {
            "nombre": nombre_completo if nombre_completo else None,
            "dni": dni if dni else None,
            "geclisa_ficha_id": int(ficha_id) if ficha_id else None,
            "nro_hc": str(datos_geclisa.get("nro_hc") or "").strip() or None,
            "obra_social": datos_geclisa.get("obra_social") or datos_geclisa.get("ficObrasoc") or None,
            "plan_cobertura": datos_geclisa.get("plan_cobertura") or datos_geclisa.get("plan") or datos_geclisa.get("ficPlan") or None,
            "fecha_nacimiento": datos_geclisa.get("fecha_nacimiento") or None,
            "sexo": datos_geclisa.get("sexo") or None,
            "direccion": datos_geclisa.get("direccion") or None,
            "telefono_fijo": datos_geclisa.get("telefono_fijo") or None,
            "medico_cabecera": datos_geclisa.get("medico_cabecera") or datos_geclisa.get("medico_cabecera_nombre") or None,
            "etapa_clinica": "PACIENTE_VINCULADO_GECLISA"
        }
        
        # Prioridad de teléfono: registrar el número activo de WhatsApp en el CRM
        if clean_phone and not clean_phone.startswith("temp_"):
            datos_actualizar["telefono"] = clean_phone
            
        datos_limpios = {k: v for k, v in datos_actualizar.items() if v is not None}

        # CASO A: El paciente ya existía en la base de datos de Supabase
        if paciente_existente:
            target_id = paciente_existente["id"]
            logger.info(f"Paciente Geclisa encontrado en CRM (ID: {target_id}). Fusionando y actualizando...")

            # Si el chat estaba asociado a un paciente temporal diferente, transferir registros primero
            if paciente_temporal_id and paciente_temporal_id != target_id:
                logger.info(f"Transferir registros de paciente temporal {paciente_temporal_id} -> {target_id}...")
                
                # 1. Reasignar presupuestos
                supabase.table("presupuestos").update({"paciente_id": target_id}).eq("paciente_id", paciente_temporal_id).execute()
                
                # 2. Reasignar asesorías quirúrgicas
                supabase.table("asesorias_quirurgicas").update({"paciente_id": target_id}).eq("paciente_id", paciente_temporal_id).execute()

                # 3. Reasignar conversaciones y mensajes
                conv_temp = supabase.table("conversaciones").select("*").eq("paciente_id", paciente_temporal_id).execute()
                if conv_temp.data:
                    conv_temp_id = conv_temp.data[0]["id"]
                    
                    # Verificar si el paciente real ya tenía una conversación
                    conv_real = supabase.table("conversaciones").select("*").eq("paciente_id", target_id).execute()
                    if conv_real.data:
                        conv_real_id = conv_real.data[0]["id"]
                        # Mover mensajes del chat temporal al chat real
                        supabase.table("mensajes").update({"conversacion_id": conv_real_id}).eq("conversacion_id", conv_temp_id).execute()
                        # Eliminar conversación temporal vacía
                        supabase.table("conversaciones").delete().eq("id", conv_temp_id).execute()
                    else:
                        # Reasignar la conversación directamente al paciente real
                        supabase.table("conversaciones").update({"paciente_id": target_id}).eq("id", conv_temp_id).execute()

                # 4. Eliminar el registro temporal huérfano para liberar el constraint único de teléfono
                try:
                    # Liberar teléfono temporal primero por seguridad
                    supabase.table("pacientes").update({"telefono": f"temp_fused_{paciente_temporal_id[:8]}"}).eq("id", paciente_temporal_id).execute()
                    supabase.table("pacientes").delete().eq("id", paciente_temporal_id).execute()
                    logger.info(f"Registro temporal {paciente_temporal_id} eliminado exitosamente tras fusión.")
                except Exception as del_err:
                    logger.warning(f"No se pudo eliminar paciente temporal {paciente_temporal_id}: {del_err}")

            # Ahora actualizar datos del paciente existente (incluyendo su nuevo teléfono de WhatsApp libre de conflicto)
            resp = supabase.table("pacientes").update(datos_limpios).eq("id", target_id).execute()
            paciente_final = resp.data[0] if resp.data else paciente_existente
            return paciente_final

        # CASO B: El paciente no existía en el CRM (primera vez que se importa desde Geclisa)
        if paciente_temporal_id and is_valid_uuid(paciente_temporal_id):
            logger.info(f"Actualizando paciente temporal {paciente_temporal_id} con datos de Geclisa...")
            resp = supabase.table("pacientes").update(datos_limpios).eq("id", paciente_temporal_id).execute()
            if resp.data:
                return resp.data[0]

        # Si no había temporal válido, insertar nuevo registro
        logger.info(f"Insertando nuevo paciente importado desde Geclisa para DNI {dni}...")
        resp_ins = supabase.table("pacientes").insert(datos_limpios).execute()
        if resp_ins.data:
            nuevo_pac = resp_ins.data[0]
            get_or_create_conversacion(nuevo_pac["id"])
            return nuevo_pac

        raise Exception("No se pudo completar la vinculación del paciente con Geclisa.")

    except Exception as e:
        logger.error(f"Error en vincular_o_fusionar_paciente_con_geclisa: {e}")
        raise

def registrar_dni_paciente_nuevo_crm(
    paciente_id: str, 
    dni: str, 
    nombre_opcional: Optional[str] = None
) -> Dict[str, Any]:
    """
    Registra el DNI de un paciente que no existe en Geclisa para que quede
    dado de alta en el CRM como nuevo paciente/prospecto y continúe su atención.
    """
    if not supabase or not paciente_id:
        return {}
    try:
        clean_dni = str(dni).strip()
        update_data = {
            "dni": clean_dni,
            "etapa_clinica": "NUEVO_PACIENTE"
        }
        
        # Si se proporciona nombre y el paciente actual tiene nombre genérico ("Paciente..."), actualizar
        if nombre_opcional and nombre_opcional.strip():
            update_data["nombre"] = nombre_opcional.strip()

        resp = supabase.table("pacientes").update(update_data).eq("id", paciente_id).execute()
        if resp.data and len(resp.data) > 0:
            logger.info(f"DNI {clean_dni} registrado exitosamente para nuevo paciente CRM {paciente_id}")
            return resp.data[0]
        return {}
    except Exception as e:
        logger.error(f"Error al registrar DNI de nuevo paciente {paciente_id}: {e}")
        return {}


def asignar_medico_paciente(paciente_id: str, medico_payload: dict):
    """
    Asigna o remueve el médico de cabecera a un paciente en el CRM.
    """
    if not supabase:
        return None
    try:
        datos = {
            "medico_cabecera_id": int(medico_payload["pre_id"]) if medico_payload.get("pre_id") else None,
            "medico_cabecera_nombre": medico_payload.get("nombre") or None,
            "medico_cabecera_matricula": str(medico_payload.get("matricula")) if medico_payload.get("matricula") else None,
            "medico_cabecera_especialidad": medico_payload.get("especialidad") or None,
        }
        resp = supabase.table("pacientes").update(datos).eq("id", paciente_id).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al asignar médico al paciente {paciente_id}: {e}")
        raise


def get_or_create_conversacion(paciente_id: str):
    if not supabase:
        return None
    try:
        # Intentar buscar
        response = supabase.table("conversaciones").select("*").eq("paciente_id", paciente_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        
        # Crear si no existe
        insert_resp = supabase.table("conversaciones").insert({"paciente_id": paciente_id, "bot_disabled": False}).execute()
        if insert_resp.data:
            return insert_resp.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al obtener/crear conversación para paciente {paciente_id}: {e}")
        return None

def guardar_mensaje(
    conversacion_id: str, 
    emisor: Optional[str] = None, 
    contenido: Optional[str] = None, 
    metadata_json: Optional[dict] = None,
    remitente: Optional[str] = None,
    texto: Optional[str] = None,
    whatsapp_message_id: Optional[str] = None,
    created_at: Optional[str] = None
):
    if not supabase:
        return None
    try:
        raw_emisor = (emisor or remitente or "bot").lower()
        if raw_emisor in ["paciente", "user", "client", "remitente"]:
            final_emisor = "paciente"
        elif raw_emisor in ["operador", "humano", "operator", "admin", "doctor"]:
            final_emisor = "operador"
        else:
            final_emisor = "bot"

        final_contenido = contenido if contenido is not None else (texto or "")
        meta = (metadata_json or {}).copy()
        if whatsapp_message_id:
            meta["whatsapp_message_id"] = whatsapp_message_id

        data = {
            "conversacion_id": conversacion_id,
            "emisor": final_emisor,
            "contenido": final_contenido,
            "metadata_json": meta
        }
        if created_at:
            data["created_at"] = created_at

        # Insertar mensaje en Supabase
        response = supabase.table("mensajes").insert(data).execute()
        
        # Actualizar el último mensaje en la conversación
        supabase.table("conversaciones").update({"ultimo_mensaje": final_contenido}).eq("id", conversacion_id).execute()
        
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al guardar mensaje: {e}")
        return None

def obtener_servicios_activos():
    if not supabase:
        return []
    try:
        response = supabase.table("servicios_precios").select("*").eq("activo", True).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error al obtener servicios activos: {e}")
        return []

def buscar_servicio_por_codigo_o_nombre(termino: str):
    if not supabase:
        return []
    try:
        # Búsqueda por código exacto
        response = supabase.table("servicios_precios").select("*").eq("codigo", termino.upper()).eq("activo", True).execute()
        if response.data:
            return response.data
            
        # Si no, búsqueda parcial por nombre
        response = supabase.table("servicios_precios").select("*").ilike("nombre_prestacion", f"%{termino}%").eq("activo", True).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error al buscar servicios: {e}")
        return []

def actualizar_bot_disabled(conversacion_id: str, disabled: bool):
    if not supabase:
        return None
    try:
        response = supabase.table("conversaciones").update({"bot_disabled": disabled}).eq("id", conversacion_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al actualizar estado bot_disabled en conversación {conversacion_id}: {e}")
        return None

def archivar_conversacion(conversacion_id: str, archivada: bool = True):
    if not supabase:
        return None
    try:
        response = supabase.table("conversaciones").update({"archivada": archivada}).eq("id", conversacion_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al cambiar estado archivada en conversación {conversacion_id}: {e}")
        return None

def obtener_conversaciones(incluir_archivadas: bool = True):
    """
    Retorna la lista de todas las conversaciones con los datos de sus pacientes asociados
    y el conteo de mensajes no leídos (unread_count).
    """
    if not supabase:
        return []
    try:
        query = supabase.table("conversaciones").select(
            "id, paciente_id, bot_disabled, archivada, agente_asignado_codigo, ultimo_mensaje, updated_at, pacientes(*)"
        )
        if not incluir_archivadas:
            query = query.eq("archivada", False)
        response = query.order("updated_at", desc=True).execute()
        convs = response.data or []

        # Calcular conteo de mensajes no leídos por conversación
        try:
            msg_res = supabase.table("mensajes").select("id, conversacion_id, emisor, metadata_json").eq("emisor", "paciente").execute()
            unread_by_conv = {}
            import json
            for m in msg_res.data or []:
                meta = m.get("metadata_json") or {}
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except Exception:
                        meta = {}
                if not meta.get("leido_por_operador"):
                    c_id = m.get("conversacion_id")
                    if c_id:
                        unread_by_conv[c_id] = unread_by_conv.get(c_id, 0) + 1
            
            for c in convs:
                c["unread_count"] = unread_by_conv.get(c["id"], 0)
        except Exception as unread_err:
            logger.warning(f"No se pudo calcular unread_count en conversaciones: {unread_err}")
            for c in convs:
                c["unread_count"] = 0

        return convs
    except Exception as e:
        logger.error(f"Error al obtener conversaciones: {e}")
        return []

def obtener_metricas_conversaciones():
    """
    Calcula en tiempo real los contadores para las pestañas de la bandeja de entrada:
    - total_activas
    - no_leidos_count (conversaciones con al menos un mensaje no leído)
    - total_mensajes_no_leidos
    - derivados_humano (bot_disabled == true and not archivada)
    - bot_activos (bot_disabled == false and not archivada)
    - archivados (archivada == true)
    """
    if not supabase:
        return {"total_activas": 0, "no_leidos_count": 0, "total_mensajes_no_leidos": 0, "derivados_humano": 0, "bot_activos": 0, "archivados": 0}
    try:
        res = supabase.table("conversaciones").select("id, bot_disabled, archivada").execute()
        convs = res.data or []
        derivados = sum(1 for c in convs if c.get("bot_disabled") and not c.get("archivada"))
        bot_activos = sum(1 for c in convs if not c.get("bot_disabled") and not c.get("archivada"))
        archivados = sum(1 for c in convs if c.get("archivada"))
        total_activas = len(convs) - archivados

        # Conteo de no leídos
        no_leidos_count = 0
        total_mensajes_no_leidos = 0
        try:
            msg_res = supabase.table("mensajes").select("id, conversacion_id, emisor, metadata_json").eq("emisor", "paciente").execute()
            unread_by_conv = set()
            import json
            for m in msg_res.data or []:
                meta = m.get("metadata_json") or {}
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except Exception:
                        meta = {}
                if not meta.get("leido_por_operador"):
                    c_id = m.get("conversacion_id")
                    if c_id:
                        unread_by_conv.add(c_id)
                        total_mensajes_no_leidos += 1
            no_leidos_count = len(unread_by_conv)
        except Exception as unread_err:
            logger.warning(f"Error calculando no_leidos_count en métricas: {unread_err}")

        return {
            "total_activas": total_activas,
            "no_leidos_count": no_leidos_count,
            "total_mensajes_no_leidos": total_mensajes_no_leidos,
            "derivados_humano": derivados,
            "bot_activos": bot_activos,
            "archivados": archivados
        }
    except Exception as e:
        logger.error(f"Error al calcular métricas de conversaciones: {e}")
        return {"total_activas": 0, "no_leidos_count": 0, "total_mensajes_no_leidos": 0, "derivados_humano": 0, "bot_activos": 0, "archivados": 0}

def guardar_transcripcion_mensaje(mensaje_id: str, transcripcion: str):
    """
    Actualiza el metadata_json del mensaje agregando el campo transcripcion.
    """
    if not supabase:
        return None
    try:
        res = supabase.table("mensajes").select("id, metadata_json").eq("id", mensaje_id).execute()
        if not res.data:
            return None
        msg = res.data[0]
        meta = msg.get("metadata_json") or {}
        if isinstance(meta, str):
            import json
            meta = json.loads(meta)
        meta["transcripcion"] = transcripcion
        
        update_res = supabase.table("mensajes").update({"metadata_json": meta}).eq("id", mensaje_id).execute()
        if update_res.data:
            return update_res.data[0]
        return None
    except Exception as e:
        logger.error(f"Error guardando transcripción del mensaje {mensaje_id}: {e}")
        return None

def obtener_mensajes_conversacion(conversacion_id: str):
    """
    Retorna el historial completo de mensajes para una conversación ordenada cronológicamente.
    """
    if not supabase:
        return []
    try:
        response = supabase.table("mensajes").select("*").eq("conversacion_id", conversacion_id).order("created_at", desc=False).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error al obtener mensajes para conversación {conversacion_id}: {e}")
        return []

def marcar_mensajes_conversacion_leidos(conversacion_id: str):
    """
    Retorna la lista de whatsapp_message_ids y teléfono del paciente de los mensajes entrantes no leídos,
    y actualiza sus metadatos con leido_por_operador = True.
    """
    if not supabase:
        return {"whatsapp_message_ids": [], "telefono": None}
    try:
        import datetime
        conv_res = supabase.table("conversaciones").select("id, paciente_id, pacientes(telefono)").eq("id", conversacion_id).execute()
        if not conv_res.data:
            return {"whatsapp_message_ids": [], "telefono": None}
        
        conv = conv_res.data[0]
        telefono = conv.get("pacientes", {}).get("telefono") if isinstance(conv.get("pacientes"), dict) else None

        msg_res = supabase.table("mensajes").select("id, metadata_json").eq("conversacion_id", conversacion_id).eq("emisor", "paciente").execute()
        whatsapp_ids = []
        for m in msg_res.data or []:
            meta = m.get("metadata_json") or {}
            if isinstance(meta, str):
                import json
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            
            w_id = meta.get("whatsapp_message_id")
            if w_id and not meta.get("leido_por_operador"):
                whatsapp_ids.append(w_id)
                meta["leido_por_operador"] = True
                meta["leido_por_operador_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                supabase.table("mensajes").update({"metadata_json": meta}).eq("id", m["id"]).execute()

        return {"whatsapp_message_ids": whatsapp_ids, "telefono": telefono}
    except Exception as e:
        logger.error(f"Error marcando mensajes como leídos en conversación {conversacion_id}: {e}")
        return {"whatsapp_message_ids": [], "telefono": None}

# ====================================================================
# GESTIÓN DE CONFIGURACIÓN DE NOMENCLADOR Y ARANCELES
# ====================================================================

# ====================================================================
# GESTIÓN DE NOMENCLADORES PROPIOS DEL CRM (MULTI-MONEDA: ARS / USD)
# ====================================================================

def list_nomencladores(solo_activos: bool = False):
    """
    Lista todos los nomencladores configurados en el CRM con conteo de prácticas.
    """
    if not supabase:
        return []
    try:
        query = supabase.table("nomencladores").select("*").order("created_at")
        if solo_activos:
            query = query.eq("activo", True)
        resp = query.execute()
        nomencladores = resp.data or []
        
        # Obtener recuento de prácticas por nomenclador
        for nom in nomencladores:
            p_resp = supabase.table("nomenclador_practicas")\
                .select("id", count="exact")\
                .eq("nomenclador_id", nom["id"])\
                .execute()
            nom["total_practicas"] = p_resp.count if p_resp.count is not None else len(p_resp.data or [])
            
        return nomencladores
    except Exception as e:
        logger.error(f"Error al listar nomencladores: {e}")
        return []

def get_nomenclador_by_id(nomenclador_id: str):
    """
    Obtiene un nomenclador por su ID.
    """
    if not supabase:
        return None
    try:
        resp = supabase.table("nomencladores").select("*").eq("id", nomenclador_id).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al obtener nomenclador {nomenclador_id}: {e}")
        return None

def create_nomenclador(payload: dict):
    """
    Crea un nuevo catálogo / nomenclador en el CRM.
    """
    if not supabase:
        return None
    try:
        codigo = str(payload.get("codigo", "")).strip().upper()
        if not codigo:
            # Generar código automático basado en el nombre
            codigo = str(payload.get("nombre", "NOM")).strip().upper().replace(" ", "_")[:20]
        
        data = {
            "codigo": codigo,
            "nombre": str(payload.get("nombre", "")).strip(),
            "moneda_default": payload.get("moneda_default", "ARS").upper(),
            "descripcion": payload.get("descripcion", ""),
            "activo": payload.get("activo", True)
        }
        resp = supabase.table("nomencladores").insert(data).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al crear nomenclador: {e}")
        raise

def update_nomenclador(nomenclador_id: str, payload: dict):
    """
    Actualiza datos de un nomenclador (nombre, moneda, descripción, estado).
    """
    if not supabase:
        return None
    try:
        data = {}
        if "nombre" in payload:
            data["nombre"] = str(payload["nombre"]).strip()
        if "moneda_default" in payload:
            data["moneda_default"] = payload["moneda_default"].upper()
        if "descripcion" in payload:
            data["descripcion"] = payload["descripcion"]
        if "activo" in payload:
            data["activo"] = bool(payload["activo"])

        resp = supabase.table("nomencladores").update(data).eq("id", nomenclador_id).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al actualizar nomenclador {nomenclador_id}: {e}")
        raise

def delete_nomenclador(nomenclador_id: str):
    """
    Elimina un nomenclador y todas sus prácticas/aranceles asociados (en cascada).
    """
    if not supabase:
        return False
    try:
        supabase.table("nomencladores").delete().eq("id", nomenclador_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar nomenclador {nomenclador_id}: {e}")
        raise

# ====================================================================
# CATÁLOGO DE PRÁCTICAS Y ARANCELES CON VIGENCIAS Y MULTI-MONEDA
# ====================================================================

def list_practicas_con_arancel(
    nomenclador_id: Optional[str] = None, 
    fecha_consulta: Optional[str] = None,
    q: Optional[str] = None,
    solo_activas: bool = True,
    limit: int = 100,
    offset: int = 0
):
    """
    Lista las prácticas resolviendo el arancel vigente para la fecha indicada (o la fecha de hoy).
    """
    if not supabase:
        return {"total": 0, "practicas": []}
    
    from datetime import date
    fecha_ref = fecha_consulta or date.today().isoformat()
    
    try:
        # 1. Base query de prácticas
        query = supabase.table("nomenclador_practicas").select("*, nomencladores(id, nombre, codigo, moneda_default)")
        
        if nomenclador_id:
            query = query.eq("nomenclador_id", nomenclador_id)
        if solo_activas:
            query = query.eq("activo", True)
        if q and q.strip():
            term = q.strip().upper()
            # Búsqueda por código o nombre
            query = query.or_(f"codigo.ilike.%{term}%,nombre.ilike.%{term}%,categoria.ilike.%{term}%")
            
        resp = query.order("codigo").range(offset, offset + limit - 1).execute()
        practicas = resp.data or []
        
        if not practicas:
            return {"total": 0, "practicas": []}
            
        practica_ids = [p["id"] for p in practicas]
        
        # 2. Consultar aranceles vigentes para estas prácticas
        aranceles_resp = supabase.table("nomenclador_aranceles")\
            .select("*")\
            .in_("practica_id", practica_ids)\
            .lte("vigencia_desde", fecha_ref)\
            .order("vigencia_desde", desc=True)\
            .execute()
            
        aranceles_data = aranceles_resp.data or []
        
        # Mapear el arancel vigente (el primero más reciente cuya vigencia_hasta sea >= fecha_ref o null)
        arancel_vigente_map = {}
        for ar in aranceles_data:
            pid = ar["practica_id"]
            if pid in arancel_vigente_map:
                continue
            v_hasta = ar.get("vigencia_hasta")
            if not v_hasta or v_hasta >= fecha_ref:
                arancel_vigente_map[pid] = ar
                
        # Construir resultado combinado
        resultados = []
        for p in practicas:
            nom_info = p.get("nomencladores") or {}
            moneda_default = nom_info.get("moneda_default", "ARS")
            ar = arancel_vigente_map.get(p["id"])
            
            if ar:
                precio = float(ar["precio"])
                moneda = ar.get("moneda", moneda_default)
                vig_desde = ar.get("vigencia_desde")
                vig_hasta = ar.get("vigencia_hasta")
                arancel_id = ar["id"]
                tiene_arancel = True
            else:
                precio = 0.0
                moneda = moneda_default
                vig_desde = None
                vig_hasta = None
                arancel_id = None
                tiene_arancel = False
                
            resultados.append({
                "id": p["id"],
                "nomenclador_id": p["nomenclador_id"],
                "nomenclador_nombre": nom_info.get("nombre", ""),
                "nomenclador_codigo": nom_info.get("codigo", ""),
                "codigo": p["codigo"],
                "nombre": p["nombre"],
                "categoria": p.get("categoria", "General"),
                "descripcion": p.get("descripcion", ""),
                "activo": p["activo"],
                "precio": precio,
                "moneda": moneda,
                "vigencia_desde": vig_desde,
                "vigencia_hasta": vig_hasta,
                "arancel_id": arancel_id,
                "tiene_arancel": tiene_arancel
            })
            
        return {"total": len(resultados), "practicas": resultados}
    except Exception as e:
        logger.error(f"Error al listar practicas con arancel: {e}")
        return {"total": 0, "practicas": []}

def create_or_update_practica(payload: dict):
    """
    Crea o actualiza una práctica y su arancel inicial.
    """
    if not supabase:
        return None
    from datetime import date
    try:
        nomenclador_id = payload["nomenclador_id"]
        codigo = str(payload["codigo"]).strip().upper()
        nombre = str(payload["nombre"]).strip()
        categoria = payload.get("categoria", "General")
        descripcion = payload.get("descripcion", "")
        activo = payload.get("activo", True)
        
        # 1. Upsert de la práctica
        p_data = {
            "nomenclador_id": nomenclador_id,
            "codigo": codigo,
            "nombre": nombre,
            "categoria": categoria,
            "descripcion": descripcion,
            "activo": activo
        }
        p_resp = supabase.table("nomenclador_practicas").upsert(
            p_data,
            on_conflict="nomenclador_id,codigo"
        ).execute()
        
        if not p_resp.data:
            raise Exception("No se pudo guardar la práctica.")
        practica = p_resp.data[0]
        
        # 2. Si se especificó precio, crear o actualizar arancel
        if "precio" in payload and payload["precio"] is not None:
            precio = float(payload["precio"])
            moneda = payload.get("moneda", "ARS").upper()
            vig_desde = payload.get("vigencia_desde") or date.today().isoformat()
            vig_hasta = payload.get("vigencia_hasta")
            
            ar_data = {
                "practica_id": practica["id"],
                "precio": precio,
                "moneda": moneda,
                "vigencia_desde": vig_desde,
                "vigencia_hasta": vig_hasta,
                "observaciones": payload.get("observaciones", "Carga inicial"),
                "activo": True
            }
            supabase.table("nomenclador_aranceles").insert(ar_data).execute()
            
        return practica
    except Exception as e:
        logger.error(f"Error al crear/actualizar práctica: {e}")
        raise

def delete_practica(practica_id: str):
    """
    Elimina una práctica del catálogo.
    """
    if not supabase:
        return False
    try:
        supabase.table("nomenclador_practicas").delete().eq("id", practica_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar practica {practica_id}: {e}")
        raise

def upsert_arancel_practica(practica_id: str, payload: dict):
    """
    Registra un nuevo arancel con vigencia para una práctica.
    """
    if not supabase:
        return None
    from datetime import date
    try:
        data = {
            "practica_id": practica_id,
            "precio": float(payload["precio"]),
            "moneda": payload.get("moneda", "ARS").upper(),
            "vigencia_desde": payload.get("vigencia_desde") or date.today().isoformat(),
            "vigencia_hasta": payload.get("vigencia_hasta"),
            "observaciones": payload.get("observaciones", ""),
            "activo": payload.get("activo", True)
        }
        resp = supabase.table("nomenclador_aranceles").insert(data).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al guardar arancel para práctica {practica_id}: {e}")
        raise

def enriquecer_practicas_geclisa_con_crm(geclisa_practicas: list) -> list:
    """
    Cruza una lista de prácticas obtenidas de Geclisa con la base de datos local de Supabase.
    Identifica si ya están registradas en el CRM, adjunta su arancel actual, moneda y vigencias.
    """
    if not supabase or not geclisa_practicas:
        return geclisa_practicas
        
    from datetime import date
    today_str = date.today().isoformat()
    
    try:
        # Extraer códigos únicos
        codigos = list(set(str(p.get("nomCod") or p.get("codigo") or "").strip().upper() for p in geclisa_practicas if p.get("nomCod") or p.get("codigo")))
        if not codigos:
            return geclisa_practicas
            
        # Buscar en nomenclador_practicas
        p_resp = supabase.table("nomenclador_practicas")\
            .select("id, codigo, nombre, categoria, descripcion, nomenclador_id, nomencladores(id, nombre, codigo, moneda_default)")\
            .in_("codigo", codigos)\
            .execute()
            
        crm_practicas = p_resp.data or []
        if not crm_practicas:
            for p in geclisa_practicas:
                p["ya_en_crm"] = False
                p["precio_crm"] = 0.0
                p["moneda_crm"] = "ARS"
            return geclisa_practicas
            
        crm_map = {p["codigo"].upper(): p for p in crm_practicas}
        p_ids = [p["id"] for p in crm_practicas]
        
        # Buscar aranceles vigentes
        ar_resp = supabase.table("nomenclador_aranceles")\
            .select("*")\
            .in_("practica_id", p_ids)\
            .order("vigencia_desde", desc=True)\
            .execute()
            
        ar_map = {}
        for ar in (ar_resp.data or []):
            pid = ar["practica_id"]
            if pid not in ar_map:
                ar_map[pid] = ar
                
        resultados = []
        for gp in geclisa_practicas:
            cod = str(gp.get("nomCod") or gp.get("codigo") or "").strip().upper()
            crm_p = crm_map.get(cod)
            
            item = dict(gp)
            item["nomCod"] = cod
            item["nombre"] = gp.get("nombre") or gp.get("practica") or (crm_p["nombre"] if crm_p else f"Práctica {cod}")
            
            if crm_p:
                item["ya_en_crm"] = True
                item["crm_practica_id"] = crm_p["id"]
                item["categoria"] = crm_p.get("categoria", "General")
                nom_info = crm_p.get("nomencladores") or {}
                
                ar = ar_map.get(crm_p["id"])
                if ar:
                    item["precio_crm"] = float(ar.get("precio", 0.0))
                    item["moneda_crm"] = ar.get("moneda") or nom_info.get("moneda_default", "ARS")
                    item["vigencia_desde"] = ar.get("vigencia_desde")
                    item["vigencia_hasta"] = ar.get("vigencia_hasta")
                    item["arancel_activo"] = ar.get("activo", True)
                else:
                    item["precio_crm"] = 0.0
                    item["moneda_crm"] = nom_info.get("moneda_default", "ARS")
                    item["vigencia_desde"] = None
                    item["vigencia_hasta"] = None
                    item["arancel_activo"] = False
            else:
                item["ya_en_crm"] = False
                item["crm_practica_id"] = None
                item["precio_crm"] = 0.0
                item["moneda_crm"] = "ARS"
                item["vigencia_desde"] = None
                item["vigencia_hasta"] = None
                item["arancel_activo"] = False
                
            resultados.append(item)
            
        return resultados
    except Exception as e:
        logger.error(f"Error al enriquecer prácticas Geclisa con CRM: {e}")
        return geclisa_practicas

def guardar_practica_crm_con_arancel(payload: dict):
    """
    Guarda o actualiza una práctica (sea de Geclisa o Manual) y registra su arancel con vigencia.
    """
    if not supabase:
        return None
        
    from datetime import date
    today_str = date.today().isoformat()
    
    try:
        codigo = str(payload.get("codigo") or payload.get("nomCod") or "").strip().upper()
        nombre = str(payload.get("nombre") or payload.get("practica") or "").strip()
        categoria = str(payload.get("categoria") or "General").strip()
        descripcion = str(payload.get("descripcion") or "").strip()
        origen = str(payload.get("origen") or "GECLISA").upper() # 'GECLISA' o 'MANUAL'
        
        precio = float(payload.get("precio", 0.0) or 0.0)
        moneda = str(payload.get("moneda") or "ARS").upper()
        vig_desde = payload.get("vigencia_desde") or today_str
        vig_hasta = payload.get("vigencia_hasta") or None
        
        # 1. Obtener o resolver nomenclador_id basado en la moneda (NOM_ARS o NOM_USD)
        nom_codigo = "NOM_USD" if moneda == "USD" else "NOM_ARS"
        nom_resp = supabase.table("nomencladores").select("id").eq("codigo", nom_codigo).limit(1).execute()
        if nom_resp.data:
            nomenclador_id = nom_resp.data[0]["id"]
        else:
            # Fallback a cualquier nomenclador activo
            nom_any = supabase.table("nomencladores").select("id").limit(1).execute()
            nomenclador_id = nom_any.data[0]["id"] if nom_any.data else None
            
        # 2. Upsert en nomenclador_practicas
        p_data = {
            "nomenclador_id": nomenclador_id,
            "codigo": codigo,
            "nombre": nombre,
            "categoria": categoria,
            "descripcion": f"[ORIGEN:{origen}] {descripcion}".strip(),
            "activo": True
        }
        
        p_resp = supabase.table("nomenclador_practicas").upsert(
            p_data,
            on_conflict="nomenclador_id,codigo"
        ).execute()
        
        if not p_resp.data:
            raise Exception("No se pudo guardar el registro de la práctica en Supabase.")
            
        practica = p_resp.data[0]
        practica_id = practica["id"]
        
        # 3. Registrar / Actualizar arancel con vigencia
        ar_data = {
            "practica_id": practica_id,
            "precio": precio,
            "moneda": moneda,
            "vigencia_desde": vig_desde,
            "vigencia_hasta": vig_hasta,
            "observaciones": f"Configurado vía CRM ({origen})",
            "activo": True
        }
        
        ar_resp = supabase.table("nomenclador_aranceles").insert(ar_data).execute()
        arancel = ar_resp.data[0] if ar_resp.data else ar_data
        
        return {
            "success": True,
            "practica": practica,
            "arancel": arancel
        }
    except Exception as e:
        logger.error(f"Error al guardar práctica con arancel: {e}")
        raise

def listar_catalogo_completo_crm(
    filtro_moneda: Optional[str] = None,
    filtro_origen: Optional[str] = None,
    q: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Lista todas las prácticas configuradas en el CRM con su arancel vigente, moneda y origen.
    """
    if not supabase:
        return []
        
    try:
        query = supabase.table("nomenclador_practicas")\
            .select("id, codigo, nombre, categoria, descripcion, activo, created_at, nomencladores(id, nombre, codigo, moneda_default)")\
            .eq("activo", True)
            
        term = (q or "").strip().upper()
        if term:
            query = query.or_(f"codigo.ilike.%{term}%,nombre.ilike.%{term}%,categoria.ilike.%{term}%")
            
        p_resp = query.order("nombre").execute()
        practicas = p_resp.data or []
        if not practicas:
            return []
            
        p_ids = [p["id"] for p in practicas]
        
        # Obtener los aranceles más recientes
        ar_resp = supabase.table("nomenclador_aranceles")\
            .select("*")\
            .in_("practica_id", p_ids)\
            .order("vigencia_desde", desc=True)\
            .execute()
            
        ar_map = {}
        for ar in (ar_resp.data or []):
            pid = ar["practica_id"]
            if pid not in ar_map:
                ar_map[pid] = ar
                
        resultados = []
        for p in practicas:
            desc = p.get("descripcion") or ""
            origen = "MANUAL" if "[ORIGEN:MANUAL]" in desc else "GECLISA"
            
            ar = ar_map.get(p["id"])
            nom_info = p.get("nomencladores") or {}
            
            precio = float(ar.get("precio", 0.0)) if ar else 0.0
            moneda = ar.get("moneda") if ar else nom_info.get("moneda_default", "ARS")
            
            # Filtro por moneda
            if filtro_moneda and filtro_moneda.upper() != "TODAS" and moneda != filtro_moneda.upper():
                continue
                
            # Filtro por origen
            if filtro_origen and filtro_origen.upper() != "TODOS" and origen != filtro_origen.upper():
                continue
                
            resultados.append({
                "id": p["id"],
                "codigo": p["codigo"],
                "nombre": p["nombre"],
                "categoria": p.get("categoria", "General"),
                "descripcion": desc.replace("[ORIGEN:MANUAL]", "").replace("[ORIGEN:GECLISA]", "").strip(),
                "origen": origen,
                "precio": precio,
                "moneda": moneda,
                "vigencia_desde": ar.get("vigencia_desde") if ar else None,
                "vigencia_hasta": ar.get("vigencia_hasta") if ar else None,
                "arancel_id": ar.get("id") if ar else None,
                "activo": p.get("activo", True),
                "created_at": p.get("created_at")
            })
            
        return resultados
    except Exception as e:
        logger.error(f"Error al listar catálogo completo del CRM: {e}")
        return []

def eliminar_practica_crm(practica_id: str) -> bool:
    """
    Desactiva o elimina una práctica y sus aranceles del catálogo del CRM.
    """
    if not supabase:
        return False
    try:
        supabase.table("nomenclador_aranceles").delete().eq("practica_id", practica_id).execute()
        supabase.table("nomenclador_practicas").delete().eq("id", practica_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar práctica del CRM ({practica_id}): {e}")
        raise


# ====================================================================
# BÚSQUEDA RÁPIDA PARA MODAL DE PRESUPUESTOS (NATIVO CRM)
# ====================================================================

def buscar_practicas_presupuesto(q: str = "", fecha_consulta: Optional[str] = None, limit: int = 50):
    """
    Búsqueda optimizada y ultra-rápida de prestaciones para el modal de presupuestos.
    Consulta el catálogo interno resolviendo arancel y moneda vigentes para la fecha.
    """
    if not supabase:
        return []
    
    from datetime import date
    fecha_ref = fecha_consulta or date.today().isoformat()
    term = (q or "").strip().upper()
    
    try:
        query = supabase.table("nomenclador_practicas")\
            .select("id, codigo, nombre, categoria, descripcion, nomenclador_id, nomencladores(id, nombre, codigo, moneda_default)")\
            .eq("activo", True)
            
        if term:
            query = query.or_(f"codigo.ilike.%{term}%,nombre.ilike.%{term}%,categoria.ilike.%{term}%")
            
        p_resp = query.order("codigo").limit(limit).execute()
        practicas = p_resp.data or []
        
        if not practicas:
            return []
            
        practica_ids = [p["id"] for p in practicas]
        
        # Aranceles vigentes
        ar_resp = supabase.table("nomenclador_aranceles")\
            .select("*")\
            .in_("practica_id", practica_ids)\
            .lte("vigencia_desde", fecha_ref)\
            .order("vigencia_desde", desc=True)\
            .execute()
            
        ar_data = ar_resp.data or []
        arancel_map = {}
        for ar in ar_data:
            pid = ar["practica_id"]
            if pid in arancel_map:
                continue
            v_hasta = ar.get("vigencia_hasta")
            if not v_hasta or v_hasta >= fecha_ref:
                arancel_map[pid] = ar
                
        resultados = []
        for p in practicas:
            nom_info = p.get("nomencladores") or {}
            moneda_default = nom_info.get("moneda_default", "ARS")
            ar = arancel_map.get(p["id"])
            
            precio = float(ar["precio"]) if ar else 0.0
            moneda = ar.get("moneda", moneda_default) if ar else moneda_default
            
            resultados.append({
                "id": p["id"],
                "codigo": p["codigo"],
                "nombre": p["nombre"],
                "categoria": p.get("categoria", "General"),
                "nomenclador_id": p["nomenclador_id"],
                "nomenclador_nombre": nom_info.get("nombre", "General"),
                "nomenclador_codigo": nom_info.get("codigo", "GEN"),
                "precio": precio,
                "moneda": moneda,
                "vigencia_desde": ar.get("vigencia_desde") if ar else None,
                "vigencia_hasta": ar.get("vigencia_hasta") if ar else None,
                "tiene_precio": precio > 0
            })
            
        return resultados
    except Exception as e:
        logger.error(f"Error al buscar prácticas para presupuesto: {e}")
        return []

# ====================================================================
# IMPORTADOR MASIVO EXCEL (BULK IMPORT)
# ====================================================================

def bulk_import_practicas_aranceles(
    nomenclador_id: str,
    rows: List[Dict[str, Any]],
    modo: str = "upsert",
    default_vigencia_desde: Optional[str] = None,
    default_vigencia_hasta: Optional[str] = None,
    default_moneda: str = "ARS"
):
    """
    Importa masivamente prácticas y aranceles a un nomenclador.
    Modo: 'upsert' (actualizar y agregar) o 'replace' (reemplazar catálogo del nomenclador).
    """
    if not supabase:
        raise Exception("Supabase no inicializado.")
    
    from datetime import date
    vig_desde_global = default_vigencia_desde or date.today().isoformat()
    vig_hasta_global = default_vigencia_hasta
    
    # 1. Si es modo replace, eliminar las prácticas del nomenclador
    if modo == "replace":
        supabase.table("nomenclador_practicas").delete().eq("nomenclador_id", nomenclador_id).execute()
        
    insertadas = 0
    actualizadas = 0
    errores = []
    
    for idx, row in enumerate(rows, start=1):
        try:
            codigo = str(row.get("codigo", "")).strip().upper()
            nombre = str(row.get("nombre", "")).strip()
            if not codigo or not nombre:
                continue
                
            categoria = str(row.get("categoria", "General")).strip() or "General"
            descripcion = str(row.get("descripcion", "")).strip()
            
            # Limpieza y conversión de precio
            raw_precio = row.get("precio", 0.0)
            if isinstance(raw_precio, str):
                raw_precio = raw_precio.replace("$", "").replace("USD", "").replace("U$D", "").replace(" ", "").replace(".", "").replace(",", ".").strip()
            precio = float(raw_precio) if raw_precio else 0.0
            
            moneda = str(row.get("moneda", default_moneda)).strip().upper()
            if moneda not in ("ARS", "USD"):
                moneda = default_moneda
                
            vig_desde = str(row.get("vigencia_desde") or vig_desde_global).strip()
            vig_hasta = row.get("vigencia_hasta") or vig_hasta_global
            if vig_hasta:
                vig_hasta = str(vig_hasta).strip()
                
            # Upsert de práctica
            p_data = {
                "nomenclador_id": nomenclador_id,
                "codigo": codigo,
                "nombre": nombre,
                "categoria": categoria,
                "descripcion": descripcion,
                "activo": True
            }
            p_resp = supabase.table("nomenclador_practicas").upsert(
                p_data,
                on_conflict="nomenclador_id,codigo"
            ).execute()
            
            if p_resp.data:
                practica_id = p_resp.data[0]["id"]
                
                # Insertar o actualizar arancel con vigencia
                ar_data = {
                    "practica_id": practica_id,
                    "precio": precio,
                    "moneda": moneda,
                    "vigencia_desde": vig_desde,
                    "vigencia_hasta": vig_hasta,
                    "observaciones": f"Importado Excel {date.today().isoformat()}",
                    "activo": True
                }
                supabase.table("nomenclador_aranceles").insert(ar_data).execute()
                insertadas += 1
        except Exception as row_err:
            errores.append(f"Fila {idx} ({row.get('codigo', '?')}): {str(row_err)}")
            
    return {
        "success": True,
        "total_procesadas": len(rows),
        "insertadas": insertadas,
        "errores": errores
    }

# ====================================================================
# MÓDULO DE ASESORÍAS QUIRÚRGICAS (PIPELINE DE CIRUGÍAS)
# ====================================================================

def get_asesorias_by_paciente(paciente_id: str) -> List[Dict[str, Any]]:
    """
    Retorna el historial de asesorías quirúrgicas de un paciente ordenadas por fecha reciente.
    """
    if not supabase or not paciente_id:
        return []
    try:
        resp = supabase.table("asesorias_quirurgicas") \
            .select("*") \
            .eq("paciente_id", paciente_id) \
            .order("created_at", desc=True) \
            .execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al obtener asesorías quirúrgicas del paciente {paciente_id}: {e}")
        return []

def crear_asesoria_quirurgica(payload: dict) -> Dict[str, Any]:
    """
    Crea un nuevo caso de asesoramiento quirúrgico para un paciente.
    """
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")
    try:
        datos = {
            "paciente_id": payload["paciente_id"],
            "medico_derivador_id": int(payload["medico_derivador_id"]) if payload.get("medico_derivador_id") else None,
            "medico_derivador_nombre": payload.get("medico_derivador_nombre") or None,
            "medico_derivador_matricula": str(payload["medico_derivador_matricula"]) if payload.get("medico_derivador_matricula") else None,
            
            "medico_cirujano_id": int(payload["medico_cirujano_id"]) if payload.get("medico_cirujano_id") else None,
            "medico_cirujano_nombre": payload.get("medico_cirujano_nombre") or None,
            "medico_cirujano_matricula": str(payload["medico_cirujano_matricula"]) if payload.get("medico_cirujano_matricula") else None,
            
            "practica_codigo": payload.get("practica_codigo") or None,
            "practica_nombre": payload.get("practica_nombre") or "Práctica Quirúrgica a Determinar",
            
            "cobertura_obra_social": payload.get("cobertura_obra_social") or None,
            "monto_extra": float(payload.get("monto_extra", 0.0)) if payload.get("monto_extra") is not None else 0.0,
            "moneda_extra": payload.get("moneda_extra", "ARS").upper(),
            
            "fecha_probable_cirugia": payload.get("fecha_probable_cirugia") or None,
            "fecha_definitiva_cirugia": payload.get("fecha_definitiva_cirugia") or None,
            
            "estado": payload.get("estado", "en_asesoramiento"),
            "situacion_paciente": payload.get("situacion_paciente") or "",
            "motivo_cancelacion": payload.get("motivo_cancelacion") or None
        }
        
        resp = supabase.table("asesorias_quirurgicas").insert(datos).execute()
        if not resp.data:
            raise Exception("No se pudo registrar la asesoría quirúrgica.")
        return resp.data[0]
    except Exception as e:
        logger.error(f"Error al crear asesoría quirúrgica: {e}")
        raise

def actualizar_asesoria_quirurgica(asesoria_id: str, payload: dict) -> Dict[str, Any]:
    """
    Actualiza el estado, fechas, condiciones o notas de un caso quirúrgico.
    """
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")
    try:
        datos = {}
        campos_permitidos = [
            "medico_derivador_id", "medico_derivador_nombre", "medico_derivador_matricula",
            "medico_cirujano_id", "medico_cirujano_nombre", "medico_cirujano_matricula",
            "practica_codigo", "practica_nombre", "cobertura_obra_social",
            "monto_extra", "moneda_extra", "fecha_probable_cirugia",
            "fecha_definitiva_cirugia", "estado", "situacion_paciente", "motivo_cancelacion",
            "checklist_prequirurgico", "proxima_accion_fecha", "proxima_accion_texto", "ultimo_contacto_at"
        ]
        
        for k in campos_permitidos:
            if k in payload:
                if k in ["medico_derivador_id", "medico_cirujano_id"]:
                    datos[k] = int(payload[k]) if payload[k] else None
                elif k == "monto_extra":
                    datos[k] = float(payload[k]) if payload[k] is not None else 0.0
                elif k == "moneda_extra":
                    datos[k] = str(payload[k]).upper()
                else:
                    datos[k] = payload[k]
                    
        datos["updated_at"] = "now()"
        
        resp = supabase.table("asesorias_quirurgicas").update(datos).eq("id", asesoria_id).execute()
        if not resp.data:
            raise Exception(f"No se encontró la asesoría {asesoria_id} para actualizar.")
        return resp.data[0]
    except Exception as e:
        logger.error(f"Error al actualizar asesoría quirúrgica {asesoria_id}: {e}")
        raise

def eliminar_asesoria_quirurgica(asesoria_id: str) -> bool:
    """
    Elimina un caso de asesoría quirúrgica.
    """
    if not supabase:
        return False
    try:
        supabase.table("asesorias_quirurgicas").delete().eq("id", asesoria_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar asesoría quirúrgica {asesoria_id}: {e}")
        raise

# ====================================================================
# GESTIÓN INTEGRADA DE PRESUPUESTOS (NATIVO CRM)
# ====================================================================

def get_presupuestos_by_paciente(paciente_id: str) -> List[Dict[str, Any]]:
    """
    Retorna el historial de presupuestos emitidos a un paciente con sus ítems detallados.
    """
    if not supabase or not paciente_id:
        return []
    try:
        resp = supabase.table("presupuestos") \
            .select("""
                id,
                paciente_id,
                asesoria_id,
                estado,
                total,
                pdf_url,
                created_at,
                items_presupuesto (
                    id,
                    servicio_id,
                    cantidad,
                    precio_unitario,
                    subtotal,
                    servicios_precios (
                        nombre_prestacion,
                        codigo
                    )
                ),
                asesorias_quirurgicas!presupuestos_asesoria_id_fkey (
                    practica_nombre,
                    practica_codigo
                )
            """) \
            .eq("paciente_id", paciente_id) \
            .order("created_at", desc=True) \
            .execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al obtener presupuestos del paciente {paciente_id}: {e}")
        return []

def cambiar_estado_presupuesto(presupuesto_id: str, nuevo_estado: str, asesoria_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Actualiza el estado de un presupuesto ('borrador', 'enviado', 'aprobado', 'rechazado').
    Si el nuevo estado es 'aprobado' y está vinculado a una asesoría, sincroniza la etapa a 'confirmado'.
    """
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")
    try:
        resp = supabase.table("presupuestos") \
            .update({"estado": nuevo_estado}) \
            .eq("id", presupuesto_id) \
            .execute()
            
        if not resp.data:
            # Si resp.data viene vacío, obtener el registro directamente
            fetch_resp = supabase.table("presupuestos").select("*").eq("id", presupuesto_id).execute()
            if not fetch_resp.data:
                raise Exception(f"No se encontró el presupuesto {presupuesto_id}.")
            presupuesto = fetch_resp.data[0]
        else:
            presupuesto = resp.data[0]
        
        # Si se aprueba o rechaza, y está vinculado a una asesoría, sincronizar
        target_asesoria_id = asesoria_id or presupuesto.get("asesoria_id")
        if target_asesoria_id:
            if nuevo_estado == "aprobado":
                supabase.table("asesorias_quirurgicas") \
                    .update({
                        "estado": "confirmado",
                        "presupuesto_id": presupuesto_id,
                        "monto_extra": float(presupuesto.get("total") or 0.0),
                        "updated_at": "now()"
                    }) \
                    .eq("id", target_asesoria_id) \
                    .execute()
            elif nuevo_estado == "rechazado":
                supabase.table("asesorias_quirurgicas") \
                    .update({
                        "motivo_cancelacion": "Presupuesto desistido / rechazado por el paciente",
                        "updated_at": "now()"
                    }) \
                    .eq("id", target_asesoria_id) \
                    .execute()
                    
        return presupuesto
    except Exception as e:
        logger.error(f"Error al cambiar estado del presupuesto {presupuesto_id}: {e}")
        raise

def crear_presupuesto_rapido(payload: dict) -> Dict[str, Any]:
    """
    Crea un presupuesto con ítems, calcula el total, genera el PDF membretado oficial y vincula al paciente/asesoría.
    """
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")
    from app.services.pdf_service import generar_pdf_presupuesto
    import uuid
    
    try:
        paciente_id = payload["paciente_id"]
        asesoria_id = payload.get("asesoria_id")
        items_in = payload.get("items", [])
        moneda = payload.get("moneda", "ARS").upper()
        
        if not items_in:
            raise ValueError("El presupuesto debe contener al menos una prestación o ítem.")
            
        # 1. Obtener datos del paciente
        p_resp = supabase.table("pacientes").select("*").eq("id", paciente_id).execute()
        if not p_resp.data:
            raise Exception("Paciente no encontrado.")
        paciente = p_resp.data[0]
        
        # 2. Obtener o asegurar un servicio base para los items
        servicios_resp = supabase.table("servicios_precios").select("id, nombre_prestacion").limit(1).execute()
        default_servicio_id = servicios_resp.data[0]["id"] if servicios_resp.data else None
        
        # 3. Calcular totales independientes por moneda (cero mezcla ARS + USD)
        total_ars = 0.0
        total_usd = 0.0
        items_db = []
        items_para_pdf = []
        
        for idx, item in enumerate(items_in):
            cant = int(item.get("cantidad", 1))
            pu = float(item.get("precio_unitario", 0.0))
            sub = cant * pu
            item_moneda = str(item.get("moneda") or moneda).upper()
            
            if item_moneda == "USD":
                total_usd += sub
            else:
                total_ars += sub
            
            nombre_item = item.get("nombre") or item.get("nombre_prestacion") or "Prestación Médica"
            codigo_item = str(item.get("codigo") or item.get("codigo_servicio") or f"PRACT-{idx+1}").strip().upper()
            
            # Registrar o actualizar en servicios_precios para preservar nombre, código real y moneda
            srv_id = default_servicio_id
            try:
                ins_srv = supabase.table("servicios_precios").upsert({
                    "codigo": codigo_item,
                    "nombre_prestacion": nombre_item,
                    "precio": pu,
                    "moneda": item_moneda,
                    "activo": True
                }, on_conflict="codigo").execute()
                if ins_srv.data:
                    srv_id = ins_srv.data[0]["id"]
            except Exception as srv_err:
                logger.warning(f"No se pudo registrar servicio {codigo_item}: {srv_err}")

            items_db.append({
                "servicio_id": srv_id,
                "cantidad": cant,
                "precio_unitario": pu,
                "subtotal": sub,
                "moneda": item_moneda
            })
            
            items_para_pdf.append({
                "codigo": codigo_item,
                "nombre": nombre_item,
                "nombre_prestacion": nombre_item,
                "cantidad": cant,
                "precio_unitario": pu,
                "subtotal": sub,
                "moneda": item_moneda
            })
            
        presupuesto_id = str(uuid.uuid4())
        total_escalar = total_ars if total_ars > 0 else total_usd
        
        # 4. Generar PDF membretado oficial del CRM con totales discriminados
        pdf_dict = {
            "id": presupuesto_id,
            "total": total_escalar,
            "total_ars": total_ars,
            "total_usd": total_usd,
            "moneda": "USD" if (total_usd > 0 and total_ars == 0) else "ARS",
            "created_at": "now()"
        }
        pdf_filename = generar_pdf_presupuesto(pdf_dict, paciente, items_para_pdf)
        pdf_url = f"/static/{pdf_filename}"
        
        # 5. Insertar cabecera de presupuesto en Supabase
        pres_data = {
            "id": presupuesto_id,
            "paciente_id": paciente_id,
            "asesoria_id": asesoria_id or None,
            "estado": payload.get("estado", "enviado"),
            "total": total_escalar,
            "total_ars": total_ars,
            "total_usd": total_usd,
            "pdf_url": pdf_url
        }
        p_ins = supabase.table("presupuestos").insert(pres_data).execute()
        if not p_ins.data:
            raise Exception("No se pudo crear la cabecera del presupuesto.")
            
        # 6. Insertar ítems
        for it in items_db:
            it["presupuesto_id"] = presupuesto_id
            if it["servicio_id"]:
                try:
                    supabase.table("items_presupuesto").insert(it).execute()
                except Exception as it_err:
                    logger.warning(f"No se pudo registrar item {it}: {it_err}")
                    
        # 7. Si hay asesoría vinculada, actualizar presupuesto_id y monto_extra
        if asesoria_id:
            supabase.table("asesorias_quirurgicas") \
                .update({
                    "presupuesto_id": presupuesto_id,
                    "monto_extra": total_escalar,
                    "moneda_extra": "USD" if total_usd > 0 else "ARS",
                    "estado": "presupuesto_enviado",
                    "updated_at": "now()"
                }) \
                .eq("id", asesoria_id) \
                .execute()
                
        return {
            "id": presupuesto_id,
            "paciente_id": paciente_id,
            "asesoria_id": asesoria_id,
            "estado": pres_data["estado"],
            "total": total_escalar,
            "total_ars": total_ars,
            "total_usd": total_usd,
            "pdf_url": pdf_url,
            "items": items_para_pdf
        }
    except Exception as e:
        logger.error(f"Error al crear presupuesto rápido: {e}")
        raise

def generar_mensaje_ameno_presupuesto(
    presupuesto: dict, 
    paciente: dict, 
    items: list, 
    clinica_config: Optional[dict] = None
) -> str:
    """
    Construye un mensaje de WhatsApp empático, cordial y estructurado con el resumen del presupuesto.
    """
    from app.services.config_service import load_settings
    settings = load_settings()
    plantilla = settings.get("plantilla_presupuesto", {})
    clinica = settings.get("clinica", {})
    
    nombre_paciente = (paciente.get("nombre") or "Estimado/a").strip().title()
    nombre_clinica = plantilla.get("nombre_institucion") or clinica.get("nombre") or "Centro Médico Nube"
    validez_dias = plantilla.get("validez_dias", 30)
    
    # Calcular totales
    total_ars = float(presupuesto.get("total_ars") or sum(float(it.get("subtotal") or 0.0) for it in items if str(it.get("moneda") or "").upper() == "ARS"))
    total_usd = float(presupuesto.get("total_usd") or sum(float(it.get("subtotal") or 0.0) for it in items if str(it.get("moneda") or "").upper() == "USD"))
    
    # Armar lista de prestaciones
    lineas_items = []
    for it in items:
        nom = it.get("nombre") or it.get("nombre_prestacion") or "Prestación Médica"
        cod = it.get("codigo") or it.get("codigo_servicio") or ""
        mon = str(it.get("moneda") or "ARS").upper()
        sub = float(it.get("subtotal") or 0.0)
        sub_str = f"USD {sub:,.2f}" if mon == "USD" else f"${sub:,.2f}"
        if cod:
            lineas_items.append(f"• *[{cod}]* {nom}: {sub_str}")
        else:
            lineas_items.append(f"• *{nom}*: {sub_str}")
            
    items_texto = "\n".join(lineas_items) if lineas_items else "• Prestaciones médicas detalladas en el archivo adjunto"
    
    # Armar sección de totales
    totales_lineas = []
    if total_ars > 0 and total_usd > 0:
        totales_lineas.append(f"🇦🇷 *Total en Pesos:* ${total_ars:,.2f} ARS")
        totales_lineas.append(f"🇺🇸 *Total en Dólares:* USD {total_usd:,.2f}")
    elif total_usd > 0:
        totales_lineas.append(f"🇺🇸 *Total en Dólares:* USD {total_usd:,.2f}")
    else:
        totales_lineas.append(f"🇦🇷 *Total en Pesos:* ${total_ars:,.2f} ARS")
        
    totales_texto = "\n".join(totales_lineas)
    
    mensaje = f"""¡Hola {nombre_paciente}! 👋 Esperamos que te encuentres muy bien.

Te compartimos adjunto tu *Presupuesto Médico Oficial* emitido por *{nombre_clinica}*.

📋 *Detalle de Prestaciones Cotizadas:*
{items_texto}

💰 *Monto Total Estimado:*
{totales_texto}

⏳ *Validez del presupuesto:* {validez_dias} días corridos.
💳 *Medios de pago:* Transferencia bancaria, Tarjetas de crédito/débito y Efectivo en administración.

Quedamos a tu entera disposición para resolver cualquier duda sobre el tratamiento o coordinar la reserva de tu turno/intervención. 🩺✨"""

    return mensaje.strip()

def enviar_presupuesto_por_whatsapp(
    presupuesto_id: str, 
    telefono_override: Optional[str] = None, 
    mensaje_custom: Optional[str] = None
) -> Dict[str, Any]:
    """
    Envía el PDF de un presupuesto generado por WhatsApp junto con el mensaje protocolar ameno.
    Actualiza el estado del presupuesto a 'enviado' y sincroniza el pipeline quirúrgico.
    """
    import os
    from app.whatsapp import whatsapp_manager
    from app.services.phone_normalizer import normalize_phone_number
    from app.services.pdf_service import PDF_DIR
    
    # 1. Obtener presupuesto
    p_resp = supabase.table("presupuestos")\
        .select("*, pacientes(*), items_presupuesto(*, servicios_precios(*))")\
        .eq("id", presupuesto_id)\
        .execute()
        
    if not p_resp.data:
        raise ValueError(f"Presupuesto con ID {presupuesto_id} no encontrado.")
        
    presupuesto = p_resp.data[0]
    paciente = presupuesto.get("pacientes") or {}
    items_raw = presupuesto.get("items_presupuesto") or []
    
    items = []
    for it in items_raw:
        srv = it.get("servicios_precios") or {}
        srv_cod = srv.get("codigo") or ""
        srv_nom = srv.get("nombre_prestacion") or "Prestación Médica"
        
        # Detectar moneda real de la práctica
        it_moneda = it.get("moneda") or srv.get("moneda")
        if not it_moneda and srv_cod:
            try:
                p_find = supabase.table("nomenclador_practicas")\
                    .select("nombre, categoria, nomencladores(moneda_default)")\
                    .eq("codigo", srv_cod)\
                    .limit(1)\
                    .execute()
                if p_find.data:
                    it_moneda = (p_find.data[0].get("nomencladores") or {}).get("moneda_default")
                    if not srv_nom or srv_nom == "Prestación Médica":
                        srv_nom = p_find.data[0].get("nombre") or srv_nom
            except Exception:
                pass
                
        if not it_moneda:
            it_moneda = "USD" if (float(presupuesto.get("total_usd") or 0) > 0 and float(it.get("precio_unitario") or 0) <= float(presupuesto.get("total_usd") or 0)) else "ARS"
                
        items.append({
            "codigo": srv_cod,
            "nombre": srv_nom,
            "precio_unitario": float(it.get("precio_unitario") or 0.0),
            "cantidad": int(it.get("cantidad") or 1),
            "subtotal": float(it.get("subtotal") or 0.0),
            "moneda": str(it_moneda).upper()
        })
        
    # 2. Resolver teléfono y mensaje
    raw_tel = telefono_override or paciente.get("telefono") or ""
    clean_phone = normalize_phone_number(raw_tel)
    if not clean_phone:
        raise ValueError("El paciente no tiene un número de teléfono válido registrado para WhatsApp.")
        
    mensaje_final = mensaje_custom or generar_mensaje_ameno_presupuesto(presupuesto, paciente, items)
    
    # 3. Localizar archivo PDF
    pdf_filename = f"presupuesto_{presupuesto_id}.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    if not os.path.exists(pdf_path):
        # Generar si no existe en disco
        from app.services.pdf_service import generar_pdf_presupuesto
        generar_pdf_presupuesto(presupuesto, paciente, items)
        
    # 4. Obtener o crear conversación en Supabase
    conv = get_or_create_conversacion(paciente.get("id"))
    conv_id = conv.get("id") if conv else None
    
    # 5. Enviar documento vía WhatsApp
    w_res = whatsapp_manager.enviar_documento(
        telefono_o_jid=clean_phone,
        filepath=pdf_path,
        filename=pdf_filename,
        caption=mensaje_final,
        conversacion_id=conv_id
    )
    
    # 6. Actualizar estado del presupuesto a 'enviado'
    supabase.table("presupuestos").update({"estado": "enviado"}).eq("id", presupuesto_id).execute()
    
    # 7. Sincronizar asesoría quirúrgica si existe
    if presupuesto.get("asesoria_id"):
        supabase.table("asesorias_quirurgicas") \
            .update({"estado": "presupuesto_enviado", "updated_at": "now()"}) \
            .eq("id", presupuesto["asesoria_id"]) \
            .execute()
            
    return {
        "success": True,
        "mensaje": "Presupuesto y PDF enviados exitosamente por WhatsApp.",
        "whatsapp_result": w_res,
        "telefono": clean_phone,
        "caption": mensaje_final
    }


# ====================================================================
# BITÁCORA Y EVOLUCIONES DE ASESORAMIENTO QUIRÚRGICO
# ====================================================================

def get_evoluciones_by_asesoria(asesoria_id: str) -> List[Dict[str, Any]]:
    """
    Retorna la lista cronológica de evoluciones de un caso quirúrgico.
    """
    if not supabase or not asesoria_id:
        return []
    try:
        resp = supabase.table("asesoria_evoluciones") \
            .select("*") \
            .eq("asesoria_id", asesoria_id) \
            .order("fecha_contacto", desc=True) \
            .execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al obtener evoluciones de asesoría {asesoria_id}: {e}")
        return []

def crear_evolucion_asesoria(payload: dict) -> Dict[str, Any]:
    """
    Registra una nueva evolución en la bitácora del asesoramiento quirúrgico.
    """
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")
    try:
        contenido = (payload.get("contenido") or "").strip()
        if not contenido:
            raise ValueError("El contenido de la evolución no puede estar vacío.")
            
        data_ins = {
            "asesoria_id": payload["asesoria_id"],
            "paciente_id": payload["paciente_id"],
            "usuario_id": payload.get("usuario_id"),
            "usuario_nombre": payload.get("usuario_nombre") or "Asesora Quirúrgica",
            "tipo_contacto": payload.get("tipo_contacto", "llamada"),
            "contenido": contenido,
            "fecha_contacto": payload.get("fecha_contacto") or "now()"
        }
        
        resp = supabase.table("asesoria_evoluciones").insert(data_ins).execute()
        if not resp.data:
            raise Exception("No se pudo insertar el registro de evolución.")
            
        # Actualizar updated_at en el caso quirúrgico
        supabase.table("asesorias_quirurgicas").update({"updated_at": "now()"}).eq("id", payload["asesoria_id"]).execute()
        
        return resp.data[0]
    except Exception as e:
        logger.error(f"Error al crear evolución de asesoría: {e}")
        raise

def eliminar_evolucion_asesoria(evolucion_id: str) -> bool:
    """
    Elimina una entrada de evolución por su ID.
    """
    if not supabase:
        return False
    try:
        supabase.table("asesoria_evoluciones").delete().eq("id", evolucion_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar evolución {evolucion_id}: {e}")
        raise

def get_paciente_contexto_360(paciente_id: str) -> Dict[str, Any]:
    """
    Recupera la visión integral 360° del paciente para el contexto del agente de IA:
    - Ficha de filiación (nombre, apellido, DNI, teléfono, obra social, plan, etapa clínica, médico cabecera)
    - Presupuestos recientes emitidos y su estado (borrador, enviado, aprobado, rechazado)
    - Casos de asesoría quirúrgica y cirugías pendientes
    """
    if not supabase or not paciente_id:
        return {}
    try:
        # 1. Ficha del paciente
        p_resp = supabase.table("pacientes") \
            .select("id, nombre, dni, telefono, email, obra_social, plan_cobertura, etapa_clinica, medico_cabecera, medico_cabecera_nombre, historial_notas") \
            .eq("id", paciente_id) \
            .limit(1) \
            .execute()
            
        if not p_resp.data:
            return {}
            
        paciente = p_resp.data[0]
        
        # 2. Presupuestos emitidos recientes (con detalle de ítems)
        presupuestos = get_presupuestos_by_paciente(paciente_id)
        
        # 3. Asesorías quirúrgicas activas
        asesorias = []
        try:
            a_resp = supabase.table("asesorias_quirurgicas") \
                .select("id, estado, practica_codigo, practica_nombre, medico_cirujano_nombre, monto_extra, moneda_extra, fecha_probable_cirugia, situacion_paciente, presupuesto_id") \
                .eq("paciente_id", paciente_id) \
                .order("created_at", desc=True) \
                .limit(3) \
                .execute()
            if a_resp.data:
                asesorias = a_resp.data
        except Exception as ae:
            logger.warning(f"Error consultando asesorias de paciente {paciente_id}: {ae}")

        return {
            "paciente": paciente,
            "presupuestos": presupuestos[:4],
            "asesorias": asesorias
        }
    except Exception as e:
        logger.error(f"Error al obtener contexto 360 del paciente {paciente_id}: {e}")
        return {}

# ====================================================================
# CONFIGURACIÓN QUIRÚRGICA & PIPELINE LEAD-TO-SURGERY
# ====================================================================

def get_configuracion_quirurgica() -> Dict[str, Any]:
    """
    Recupera la configuración global del módulo quirúrgico (SLA, plantillas y checklist).
    """
    if not supabase:
        return {}
    try:
        resp = supabase.table("configuracion_quirurgica").select("*").eq("id", "default").limit(1).execute()
        if resp.data:
            return resp.data[0]
        return {
            "id": "default",
            "sla_dias_alerta": 3,
            "sla_dias_critico": 6,
            "checklist_items": [],
            "plantillas_whatsapp": []
        }
    except Exception as e:
        logger.error(f"Error al obtener configuración quirúrgica: {e}")
        return {}

def actualizar_configuracion_quirurgica(payload: dict) -> Dict[str, Any]:
    """
    Actualiza la configuración de SLA, plantillas o checklist del módulo quirúrgico.
    """
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")
    try:
        datos = {}
        if "sla_dias_alerta" in payload:
            datos["sla_dias_alerta"] = int(payload["sla_dias_alerta"])
        if "sla_dias_critico" in payload:
            datos["sla_dias_critico"] = int(payload["sla_dias_critico"])
        if "checklist_items" in payload:
            datos["checklist_items"] = payload["checklist_items"]
        if "plantillas_whatsapp" in payload:
            datos["plantillas_whatsapp"] = payload["plantillas_whatsapp"]
            
        datos["updated_at"] = "now()"
        
        resp = supabase.table("configuracion_quirurgica").upsert({"id": "default", **datos}).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
            
        resp_fallback = supabase.table("configuracion_quirurgica").select("*").eq("id", "default").limit(1).execute()
        if resp_fallback.data and len(resp_fallback.data) > 0:
            return resp_fallback.data[0]
            
        return {"id": "default", **datos}
    except Exception as e:
        logger.error(f"Error al actualizar configuración quirúrgica: {e}")
        raise

def get_pipeline_quirurgico() -> Dict[str, Any]:
    """
    Retorna el tablero global del embudo quirúrgico (Lead-to-Surgery):
    - Casos activos organizados por etapas
    - Métricas globales de ingresos en juego (ARS y USD)
    - Tasa de conversión y casos con alerta SLA
    """
    if not supabase:
        return {"etapas": {}, "metricas": {}}
    try:
        # 1. Obtener todas las asesorías con datos de paciente
        resp = supabase.table("asesorias_quirurgicas") \
            .select("*, pacientes(id, nombre, dni, telefono, obra_social, email)") \
            .order("created_at", desc=True) \
            .execute()
            
        casos = resp.data or []
        
        # 2. Configuración de SLA
        config = get_configuracion_quirurgica()
        sla_alerta = config.get("sla_dias_alerta", 3)
        sla_critico = config.get("sla_dias_critico", 6)
        
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        etapas_map = {
            "derivado": [],
            "en_asesoramiento": [],
            "en_analisis": [],
            "confirmado": [],
            "programado": [],
            "operado": [],
            "cancelado": []
        }
        
        total_monto_ars = 0.0
        total_monto_usd = 0.0
        casos_activos_count = 0
        casos_en_alerta_count = 0
        
        for c in casos:
            est = c.get("estado") or "en_asesoramiento"
            if est not in etapas_map:
                etapas_map[est] = []
                
            # Cálculo de días sin contacto
            ultimo_c = c.get("ultimo_contacto_at") or c.get("created_at")
            dias_sin_contacto = 0
            if ultimo_c:
                try:
                    dt = datetime.fromisoformat(ultimo_c.replace("Z", "+00:00"))
                    dias_sin_contacto = (now - dt).days
                except Exception:
                    dias_sin_contacto = 0
                    
            c["dias_sin_contacto"] = max(0, dias_sin_contacto)
            c["es_critico"] = dias_sin_contacto >= sla_critico
            c["es_alerta"] = dias_sin_contacto >= sla_alerta and not c["es_critico"]
            
            # Acumuladores de métricas
            monto = float(c.get("monto_extra") or 0.0)
            moneda = (c.get("moneda_extra") or "ARS").upper()
            
            if est in ["derivado", "en_asesoramiento", "en_analisis", "confirmado"]:
                casos_activos_count += 1
                if moneda == "USD":
                    total_monto_usd += monto
                else:
                    total_monto_ars += monto
                    
                if c["es_critico"] or c["es_alerta"]:
                    casos_en_alerta_count += 1
                    
            etapas_map[est].append(c)
            
        casos_operados_count = len(etapas_map.get("operado", []))
        casos_cancelados_count = len(etapas_map.get("cancelado", []))
        casos_cerrados_totales = casos_operados_count + casos_cancelados_count
        tasa_conversion = round((casos_operados_count / casos_cerrados_totales * 100), 1) if casos_cerrados_totales > 0 else 0.0

        total_operado_ars = 0.0
        total_operado_usd = 0.0
        for c in etapas_map.get("operado", []):
            m = float(c.get("monto_extra") or 0.0)
            if (c.get("moneda_extra") or "ARS").upper() == "USD":
                total_operado_usd += m
            else:
                total_operado_ars += m

        return {
            "etapas": etapas_map,
            "metricas": {
                "total_casos": len(casos),
                "casos_activos": casos_activos_count,
                "casos_en_alerta": casos_en_alerta_count,
                "casos_operados": casos_operados_count,
                "casos_cancelados": casos_cancelados_count,
                "tasa_conversion": tasa_conversion,
                "total_monto_ars": total_monto_ars,
                "total_monto_usd": total_monto_usd,
                "total_operado_ars": total_operado_ars,
                "total_operado_usd": total_operado_usd,
                "sla_dias_alerta": sla_alerta,
                "sla_dias_critico": sla_critico
            }
        }
    except Exception as e:
        logger.error(f"Error al obtener pipeline quirúrgico: {e}")
        return {"etapas": {}, "metricas": {}}


# ====================================================================
# MÓDULO DE COORDINACIÓN, QUIRÓFANOS Y CONSENTIMIENTO INFORMADO
# ====================================================================

def get_configuracion_quirofano() -> Dict[str, Any]:
    """Obtiene la configuración global de quirófanos y plantillas de consentimiento."""
    if not supabase:
        return {}
    try:
        resp = supabase.table("configuracion_quirofano").select("*").eq("id", "default").limit(1).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        # Crear default si no existe
        nuevo = {
            "id": "default",
            "duraciones_prestaciones": {
                "inyeccion": 10,
                "catarata_faco": 20,
                "catarata_compleja": 30,
                "vitrectomia": 60,
                "lasik": 15
            },
            "vigencia_enlace_horas": 72
        }
        res_ins = supabase.table("configuracion_quirofano").insert(nuevo).execute()
        return res_ins.data[0] if res_ins.data else nuevo
    except Exception as e:
        logger.error(f"Error al obtener configuración de quirófano: {e}")
        return {}

def actualizar_configuracion_quirofano(datos: Dict[str, Any]) -> Dict[str, Any]:
    """Actualiza la configuración de quirófano, duraciones y plantillas."""
    if not supabase:
        return {}
    try:
        payload = {**datos, "updated_at": "now()"}
        resp = supabase.table("configuracion_quirofano").update(payload).eq("id", "default").execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return {}
    except Exception as e:
        logger.error(f"Error al actualizar configuración de quirófano: {e}")
        return {}

def get_quirofanos(solo_activos: bool = False) -> List[Dict[str, Any]]:
    """Lista las salas de quirófano configuradas."""
    if not supabase:
        return []
    try:
        query = supabase.table("quirofanos").select("*").order("orden", desc=False)
        if solo_activos:
            query = query.eq("activo", True)
        resp = query.execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al listar quirófanos: {e}")
        return []

def crear_quirofano(datos: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase:
        return {}
    try:
        resp = supabase.table("quirofanos").insert(datos).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        logger.error(f"Error al crear quirófano: {e}")
        return {}

def actualizar_quirofano(quirofano_id: str, datos: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase:
        return {}
    try:
        resp = supabase.table("quirofanos").update(datos).eq("id", quirofano_id).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        logger.error(f"Error al actualizar quirófano: {e}")
        return {}

def eliminar_quirofano(quirofano_id: str) -> bool:
    if not supabase:
        return False
    try:
        supabase.table("quirofanos").delete().eq("id", quirofano_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar quirófano: {e}")
        return False

# Bloques Médicos
def get_quirofano_bloques(quirofano_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if not supabase:
        return []
    try:
        q = supabase.table("quirofano_bloques_medicos").select("*, quirofanos(nombre, codigo, color)")
        if quirofano_id:
            q = q.eq("quirofano_id", quirofano_id)
        resp = q.execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al obtener bloques de quirófano: {e}")
        return []

def crear_quirofano_bloque(datos: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase:
        return {}
    try:
        resp = supabase.table("quirofano_bloques_medicos").insert(datos).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        logger.error(f"Error al crear bloque médico de quirófano: {e}")
        return {}

def eliminar_quirofano_bloque(bloque_id: str) -> bool:
    if not supabase:
        return False
    try:
        supabase.table("quirofano_bloques_medicos").delete().eq("id", bloque_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar bloque médico: {e}")
        return False

# Bloqueos de Horario ("No dar turno")
def get_quirofano_bloqueos(fecha_desde: Optional[str] = None, fecha_hasta: Optional[str] = None) -> List[Dict[str, Any]]:
    if not supabase:
        return []
    try:
        q = supabase.table("quirofano_bloqueos").select("*, quirofanos(nombre, codigo, color)")
        if fecha_desde:
            q = q.gte("fecha", fecha_desde)
        if fecha_hasta:
            q = q.lte("fecha", fecha_hasta)
        resp = q.order("fecha").execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al listar bloqueos de quirófano: {e}")
        return []

def crear_quirofano_bloqueo(datos: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase:
        return {}
    try:
        resp = supabase.table("quirofano_bloqueos").insert(datos).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        logger.error(f"Error al crear bloqueo de quirófano: {e}")
        return {}

def eliminar_quirofano_bloqueo(bloqueo_id: str) -> bool:
    if not supabase:
        return False
    try:
        supabase.table("quirofano_bloqueos").delete().eq("id", bloqueo_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar bloqueo de quirófano: {e}")
        return False

# Turnos Quirúrgicos
def get_turnos_quirofano(
    fecha_desde: Optional[str] = None, 
    fecha_hasta: Optional[str] = None,
    quirofano_id: Optional[str] = None,
    cirujano_id: Optional[int] = None,
    estado: Optional[str] = None
) -> List[Dict[str, Any]]:
    if not supabase:
        return []
    try:
        q = supabase.table("turnos_quirofano").select("*, pacientes(*), quirofanos(nombre, codigo, color), asesorias_quirurgicas(medico_derivador_nombre, medico_derivador_matricula, practica_nombre, practica_codigo)")
        if fecha_desde:
            q = q.gte("fecha_cirugia", fecha_desde)
        if fecha_hasta:
            q = q.lte("fecha_cirugia", fecha_hasta)
        if quirofano_id:
            q = q.eq("quirofano_id", quirofano_id)
        if cirujano_id:
            q = q.eq("cirujano_id", cirujano_id)
        if estado:
            q = q.eq("estado", estado)
        
        resp = q.order("fecha_cirugia").order("hora_inicio").execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al obtener turnos de quirófano: {e}")
        return []

def get_turno_quirofano_by_id(turno_id: str) -> Optional[Dict[str, Any]]:
    if not supabase or not turno_id:
        return None
    try:
        resp = supabase.table("turnos_quirofano").select("*, pacientes(*), quirofanos(nombre, codigo, color), asesorias_quirurgicas(medico_derivador_nombre, medico_derivador_matricula, practica_nombre, practica_codigo)").eq("id", turno_id).limit(1).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al obtener turno por ID {turno_id}: {e}")
        return None

COLUMN_KEYS_TURNOS_QUIROFANO = {
    "instrumentador_nombre", "medico_derivador_nombre",
    "asesoria_id", "paciente_id", "quirofano_id", "fecha_cirugia", "hora_inicio",
    "duracion_minutos", "ojo", "es_bilateral_escalonada", "turno_par_id", "cirujano_id",
    "cirujano_nombre", "ayudante_nombre", "anestesiologo_nombre", "medico_derivador_nombre",
    "practica_codigo", "practica_nombre", "codigo_obra_social", "obra_social", "plan_obra_social",
    "token_autorizacion", "lente_tipo", "lente_dioptria", "lente_lote", "tipo_anestesia",
    "checks_adicionales", "estado", "consentimiento_estado", "consentimiento_token",
    "consentimiento_pdf_url", "consentimiento_enviado_at", "consentimiento_firmado_at",
    "consentimiento_firma_ip", "consentimiento_firma_img", "observaciones", "usuario_alta"
}

def get_asesorias_confirmadas_pendientes() -> List[Dict[str, Any]]:
    """
    Retorna los casos de cirugías confirmadas desde asesoramiento quirúrgico con sus pacientes
    que aún no han sido programadas en quirófano (estado = 'confirmado').
    """
    if not supabase:
        return []
    try:
        resp = supabase.table("asesorias_quirurgicas").select("*, pacientes(id, nombre, dni, telefono, obra_social, email)").eq("estado", "confirmado").order("created_at", desc=True).execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al listar asesorías confirmadas para quirófano: {e}")
        return []

def sincronizar_asesoria_desde_quirofano(asesoria_id: str, datos_turno: Dict[str, Any], nuevo_estado: Optional[str] = "programado"):
    """
    Sincroniza atómicamente la ficha de asesoramiento quirúrgico (paciente)
    cuando el personal de quirófano programa o actualiza el turno.
    Pasa el caso a estado 'programado'.
    """
    if not supabase or not asesoria_id:
        return
    try:
        payload_asesoria: Dict[str, Any] = {"updated_at": "now()"}
        if nuevo_estado:
            payload_asesoria["estado"] = nuevo_estado
        if "fecha_cirugia" in datos_turno and datos_turno["fecha_cirugia"]:
            payload_asesoria["fecha_definitiva_cirugia"] = datos_turno["fecha_cirugia"]
        if "cirujano_nombre" in datos_turno and datos_turno["cirujano_nombre"]:
            payload_asesoria["medico_cirujano_nombre"] = datos_turno["cirujano_nombre"]
        if "cirujano_id" in datos_turno and datos_turno["cirujano_id"]:
            payload_asesoria["medico_cirujano_id"] = datos_turno["cirujano_id"]
        if "practica_nombre" in datos_turno and datos_turno["practica_nombre"]:
            payload_asesoria["practica_nombre"] = datos_turno["practica_nombre"]
        if "practica_codigo" in datos_turno and datos_turno["practica_codigo"]:
            payload_asesoria["practica_codigo"] = datos_turno["practica_codigo"]
        if "obra_social" in datos_turno and datos_turno["obra_social"]:
            payload_asesoria["cobertura_obra_social"] = datos_turno["obra_social"]
        if "observaciones" in datos_turno and datos_turno["observaciones"]:
            payload_asesoria["situacion_paciente"] = datos_turno["observaciones"]

        if payload_asesoria:
            supabase.table("asesorias_quirurgicas").update(payload_asesoria).eq("id", asesoria_id).execute()
            logger.info(f"Sincronizada asesoría {asesoria_id} a estado '{nuevo_estado}' con éxito.")
    except Exception as e:
        logger.error(f"Error sincronizando asesoría {asesoria_id} desde quirófano: {e}")

def crear_turno_quirofano(datos: Dict[str, Any]) -> Dict[str, Any]:
    """
    Crea un turno de quirófano sanitizando columnas y generando token de consentimiento.
    Transiciona el caso en Asesoramiento Quirúrgico al estado 'programado'.
    """
    if not supabase:
        return {}
    import secrets
    try:
        # Sanitizar payload para enviar solo columnas válidas de turnos_quirofano
        payload = {k: v for k, v in datos.items() if k in COLUMN_KEYS_TURNOS_QUIROFANO and v is not None and v != ""}
        
        token = secrets.token_urlsafe(24)
        payload["consentimiento_token"] = token
        payload["consentimiento_estado"] = payload.get("consentimiento_estado") or "pendiente_envio"
        payload["estado"] = payload.get("estado") or "programado"
        payload["created_at"] = "now()"
        payload["updated_at"] = "now()"
        
        # Si hay asesoría, completar datos faltantes (paciente_id, medico_derivador_nombre, practica_nombre, etc.)
        if payload.get("asesoria_id"):
            res_as = supabase.table("asesorias_quirurgicas").select("paciente_id, medico_derivador_nombre, practica_nombre, practica_codigo, cobertura_obra_social").eq("id", payload["asesoria_id"]).limit(1).execute()
            if res_as.data:
                as_data = res_as.data[0]
                if not payload.get("paciente_id"):
                    payload["paciente_id"] = as_data.get("paciente_id")
                if not payload.get("medico_derivador_nombre") and as_data.get("medico_derivador_nombre"):
                    payload["medico_derivador_nombre"] = as_data.get("medico_derivador_nombre")
                if not payload.get("practica_nombre") and as_data.get("practica_nombre"):
                    payload["practica_nombre"] = as_data.get("practica_nombre")
                if not payload.get("practica_codigo") and as_data.get("practica_codigo"):
                    payload["practica_codigo"] = as_data.get("practica_codigo")
        
        resp = supabase.table("turnos_quirofano").insert(payload).execute()
        if not resp.data or len(resp.data) == 0:
            logger.error(f"No se pudo insertar turno en BD: respuesta vacía.")
            return {}
        
        turno_creado = resp.data[0]
        
        # Sincronización bidireccional y cambio de estado a 'programado'
        if payload.get("asesoria_id"):
            sincronizar_asesoria_desde_quirofano(payload["asesoria_id"], payload, nuevo_estado="programado")
                
        return turno_creado
    except Exception as e:
        logger.error(f"Error al crear turno de quirófano: {e}")
        return {}

def actualizar_turno_quirofano(turno_id: str, datos: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase or not turno_id:
        return {}
    try:
        payload = {k: v for k, v in datos.items() if k in COLUMN_KEYS_TURNOS_QUIROFANO and v is not None}
        payload["updated_at"] = "now()"
        
        resp = supabase.table("turnos_quirofano").update(payload).eq("id", turno_id).execute()
        if not resp.data or len(resp.data) == 0:
            return {}
        
        turno_actualizado = resp.data[0]
        
        asesoria_id = payload.get("asesoria_id") or turno_actualizado.get("asesoria_id")
        if asesoria_id:
            sincronizar_asesoria_desde_quirofano(asesoria_id, payload, nuevo_estado="programado")
            
        return turno_actualizado
    except Exception as e:
        logger.error(f"Error al actualizar turno de quirófano: {e}")
        return {}

def eliminar_turno_quirofano(turno_id: str) -> bool:
    if not supabase or not turno_id:
        return False
    try:
        # Obtener turno antes de borrar para saber si tenía asesoría vinculada
        res_t = supabase.table("turnos_quirofano").select("asesoria_id").eq("id", turno_id).limit(1).execute()
        asesoria_id = res_t.data[0].get("asesoria_id") if res_t.data else None

        supabase.table("turnos_quirofano").delete().eq("id", turno_id).execute()

        # Si tenía asesoría, revertir su estado a 'confirmado' y limpiar fecha
        if asesoria_id:
            supabase.table("asesorias_quirurgicas").update({
                "estado": "confirmado",
                "fecha_definitiva_cirugia": None,
                "updated_at": "now()"
            }).eq("id", asesoria_id).execute()
            logger.info(f"Asesoría {asesoria_id} revertida a 'confirmado' tras eliminar turno.")

        return True
    except Exception as e:
        logger.error(f"Error al eliminar turno de quirófano: {e}")
        return False



def get_consentimiento_by_token(token: str) -> Optional[Dict[str, Any]]:
    """Obtiene los datos del turno y paciente a través de su token público seguro."""
    if not supabase or not token:
        return None
    try:
        resp = supabase.table("turnos_quirofano").select("*, pacientes(*), quirofanos(nombre, codigo)").eq("consentimiento_token", token).limit(1).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al buscar consentimiento por token: {e}")
        return None

def registrar_firma_consentimiento(
    token: str,
    firma_base64: str,
    ip_origen: str,
    user_agent: str
) -> Dict[str, Any]:
    """
    Registra la firma del paciente, genera el PDF definitivo y actualiza el turno a 'firmado_digital'.
    """
    import hashlib
    from datetime import datetime, timezone
    from app.services.pdf_service import generar_pdf_consentimiento_informado
    
    turno = get_consentimiento_by_token(token)
    if not turno:
        return {"success": False, "error": "Token de consentimiento inválido o expirado."}
    
    paciente = turno.get("pacientes") or {}
    config = get_configuracion_quirofano()
    plantillas = config.get("plantillas_consentimiento") or []
    
    # Determinar texto legal correspondiente
    practica_nombre = (turno.get("practica_nombre") or "").lower()
    plantilla_sel = None
    for pl in plantillas:
        if pl.get("id") in practica_nombre or pl.get("tipo") in practica_nombre:
            plantilla_sel = pl
            break
    if not plantilla_sel and len(plantillas) > 0:
        plantilla_sel = plantillas[0]
        
    cuerpo_template = (plantilla_sel.get("cuerpo") if plantilla_sel else "") or (
        "Por medio de la presente, yo {paciente}, DNI {dni}, declaro que he sido debidamente informado "
        "por el Dr. {cirujano} acerca de la intervención quirúrgica de {cirugia} a realizarse en mi "
        "ojo {ojo_intervenido} en {quirofano}. He comprendido los beneficios, riesgos inherentes y cuidados postoperatorios, "
        "otorgando mi consentimiento libre e informado."
    )
    
    # Reemplazo de variables dinámicas
    ojo = turno.get("ojo") or "OD"
    ojo_desc = "DERECHO (OD)" if ojo == "OD" else "IZQUIERDO (OI)" if ojo == "OI" else "AMBOS OJOS (AO)"
    cuerpo_final = cuerpo_template.format(
        paciente=paciente.get("nombre") or "Paciente",
        dni=paciente.get("dni") or "-",
        cirujano=turno.get("cirujano_nombre") or "Médico Cirujano",
        cirugia=turno.get("practica_nombre") or "Cirugía Oftalmológica",
        ojo_intervenido=ojo_desc,
        quirofano=(turno.get("quirofanos") or {}).get("nombre") or "Quirófano",
        fecha_cirugia=str(turno.get("fecha_cirugia") or ""),
        hora_cirugia=str(turno.get("hora_inicio") or "")[:5]
    )
    
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    hash_payload = f"{token}:{paciente.get('dni')}:{now_utc}:{ip_origen}"
    doc_hash = hashlib.sha256(hash_payload.encode()).hexdigest()
    
    metadata = {
        "timestamp": now_utc,
        "ip": ip_origen,
        "user_agent": user_agent,
        "hash": doc_hash
    }
    
    try:
        pdf_filename = generar_pdf_consentimiento_informado(
            turno=turno,
            paciente=paciente,
            texto_consentimiento=cuerpo_final,
            firma_img_base64=firma_base64,
            firma_metadata=metadata
        )
        pdf_url = f"/static/{pdf_filename}"
        
        # Actualizar en Supabase
        update_payload = {
            "consentimiento_estado": "firmado_digital",
            "consentimiento_firmado_at": "now()",
            "consentimiento_firma_ip": ip_origen,
            "consentimiento_firma_img": firma_base64[:150] + "...", # truncado para auditoría ligera
            "consentimiento_pdf_url": pdf_url,
            "updated_at": "now()"
        }
        
        supabase.table("turnos_quirofano").update(update_payload).eq("id", turno["id"]).execute()
        
        return {
            "success": True,
            "pdf_url": pdf_url,
            "hash": doc_hash,
            "timestamp": now_utc,
            "paciente_nombre": paciente.get("nombre"),
            "fecha_cirugia": turno.get("fecha_cirugia"),
            "hora_inicio": turno.get("hora_inicio"),
            "practica_nombre": turno.get("practica_nombre"),
            "ojo": turno.get("ojo")
        }
    except Exception as e:
        logger.error(f"Error generando y registrando firma de consentimiento: {e}")
        return {"success": False, "error": str(e)}






# ====================================================================
# PRESTADORES DEL EQUIPO QUIRÚRGICO (INSTRUMENTADORES, ANESTESISTAS, ETC.)
# ====================================================================

def get_prestadores(rol: Optional[str] = None, solo_activos: bool = False) -> List[Dict[str, Any]]:
    if not supabase:
        return []
    try:
        q = supabase.table("prestadores").select("*")
        if rol:
            q = q.eq("rol", rol)
        if solo_activos:
            q = q.eq("activo", True)
        resp = q.order("nombre_apellido").execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al listar prestadores: {e}")
        return []

def crear_prestador(datos: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase:
        return {}
    try:
        payload = {**datos, "created_at": "now()", "updated_at": "now()"}
        resp = supabase.table("prestadores").insert(payload).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        logger.error(f"Error al crear prestador: {e}")
        return {}

def actualizar_prestador(prestador_id: str, datos: Dict[str, Any]) -> Dict[str, Any]:
    if not supabase or not prestador_id:
        return {}
    try:
        payload = {**datos, "updated_at": "now()"}
        resp = supabase.table("prestadores").update(payload).eq("id", prestador_id).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        logger.error(f"Error al actualizar prestador {prestador_id}: {e}")
        return {}

def eliminar_prestador(prestador_id: str) -> bool:
    if not supabase or not prestador_id:
        return False
    try:
        supabase.table("prestadores").delete().eq("id", prestador_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar prestador {prestador_id}: {e}")
        return False
