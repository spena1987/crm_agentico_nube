import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
# Preferimos usar la service_role key en el backend para evadir RLS de forma controlada y segura
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

from app.services.phone_normalizer import normalize_phone_number

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Faltan variables de entorno para Supabase. Asegúrate de configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def get_paciente_by_telefono(telefono: str):
    if not supabase or not telefono:
        return None
    try:
        telefono_norm = normalize_phone_number(telefono) if not str(telefono).startswith("temp_") else str(telefono)
        response = supabase.table("pacientes").select("*").eq("telefono", telefono_norm).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        
        # Búsqueda de respaldo por teléfono sin normalizar si difiere
        if telefono_norm != str(telefono):
            resp_fallback = supabase.table("pacientes").select("*").eq("telefono", str(telefono)).execute()
            if resp_fallback.data and len(resp_fallback.data) > 0:
                return resp_fallback.data[0]

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

def crear_paciente(telefono: str, nombre: str, email: str = None):
    if not supabase:
        return None
    try:
        telefono_norm = normalize_phone_number(telefono) if not str(telefono).startswith("temp_") else str(telefono)
        data = {"telefono": telefono_norm, "nombre": nombre}
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
        return None
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
        logger.error(f"Error al crear/actualizar paciente Geclisa: {e}")
        raise

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

def guardar_mensaje(conversacion_id: str, emisor: str, contenido: str, metadata_json: dict = None):
    if not supabase:
        return None
    try:
        data = {
            "conversacion_id": conversacion_id,
            "emisor": emisor,
            "contenido": contenido,
            "metadata_json": metadata_json or {}
        }
        # Insertar mensaje
        response = supabase.table("mensajes").insert(data).execute()
        
        # Actualizar el último mensaje en la conversación
        supabase.table("conversaciones").update({"ultimo_mensaje": contenido}).eq("id", conversacion_id).execute()
        
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

# ====================================================================
# GESTIÓN DE CONFIGURACIÓN DE NOMENCLADOR Y ARANCELES
# ====================================================================

def get_configuracion_nomenclador():
    """
    Obtiene la configuración global de nomencladores activos y financiador particular.
    """
    if not supabase:
        return {
            "nomencladores_activos": [1, 6],
            "geclisa_particular_os_id": 8118,
            "geclisa_particular_plan_id": 215,
            "geclisa_area_default": "A"
        }
    try:
        resp = supabase.table("configuracion_nomenclador").select("*").limit(1).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        
        # Si no existe, creamos la configuración por defecto
        default_cfg = {
            "nomencladores_activos": [1, 6],
            "geclisa_particular_os_id": 8118,
            "geclisa_particular_plan_id": 215,
            "geclisa_area_default": "A"
        }
        create_resp = supabase.table("configuracion_nomenclador").insert(default_cfg).execute()
        return create_resp.data[0] if create_resp.data else default_cfg
    except Exception as e:
        logger.error(f"Error al obtener configuracion_nomenclador: {e}")
        return {
            "nomencladores_activos": [1, 6],
            "geclisa_particular_os_id": 8118,
            "geclisa_particular_plan_id": 215,
            "geclisa_area_default": "A"
        }

def save_configuracion_nomenclador(payload: dict):
    """
    Guarda o actualiza la configuración global de nomenclador.
    """
    if not supabase:
        return None
    try:
        cfg = get_configuracion_nomenclador()
        cfg_id = cfg.get("id")
        
        data_to_update = {
            "nomencladores_activos": payload.get("nomencladores_activos", [1, 6]),
            "geclisa_particular_os_id": int(payload.get("geclisa_particular_os_id", 8118)),
            "geclisa_particular_plan_id": int(payload.get("geclisa_particular_plan_id", 215)),
            "geclisa_area_default": payload.get("geclisa_area_default", "A"),
            "updated_at": "now()"
        }
        
        if cfg_id:
            resp = supabase.table("configuracion_nomenclador").update(data_to_update).eq("id", cfg_id).execute()
        else:
            resp = supabase.table("configuracion_nomenclador").insert(data_to_update).execute()
            
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al guardar configuracion_nomenclador: {e}")
        raise

# ====================================================================
# CRUD PRÁCTICAS PROPIAS DEL CRM (FUERA DE NOMENCLADOR)
# ====================================================================

def list_practicas_crm(solo_activas: bool = False):
    """
    Lista todas las prácticas propias creadas directamente en el CRM.
    """
    if not supabase:
        return []
    try:
        query = supabase.table("practicas_crm").select("*").order("nombre")
        if solo_activas:
            query = query.eq("activo", True)
        resp = query.execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al listar practicas_crm: {e}")
        return []

def create_practica_crm(payload: dict):
    """
    Crea una nueva práctica personalizada en el CRM.
    """
    if not supabase:
        return None
    try:
        data = {
            "codigo": str(payload.get("codigo")).strip().upper(),
            "nombre": str(payload.get("nombre")).strip(),
            "categoria": payload.get("categoria", "General"),
            "precio": float(payload.get("precio", 0.0)),
            "descripcion": payload.get("descripcion", ""),
            "activo": payload.get("activo", True)
        }
        resp = supabase.table("practicas_crm").insert(data).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al crear practica_crm: {e}")
        raise

def update_practica_crm(practica_id: str, payload: dict):
    """
    Actualiza los datos de una práctica personalizada del CRM.
    """
    if not supabase:
        return None
    try:
        data = {}
        if "codigo" in payload:
            data["codigo"] = str(payload["codigo"]).strip().upper()
        if "nombre" in payload:
            data["nombre"] = str(payload["nombre"]).strip()
        if "categoria" in payload:
            data["categoria"] = payload["categoria"]
        if "precio" in payload:
            data["precio"] = float(payload["precio"])
        if "descripcion" in payload:
            data["descripcion"] = payload["descripcion"]
        if "activo" in payload:
            data["activo"] = bool(payload["activo"])

        resp = supabase.table("practicas_crm").update(data).eq("id", practica_id).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al actualizar practica_crm {practica_id}: {e}")
        raise

def delete_practica_crm(practica_id: str):
    """
    Elimina o desactiva una práctica propia del CRM.
    """
    if not supabase:
        return False
    try:
        resp = supabase.table("practicas_crm").delete().eq("id", practica_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar practica_crm {practica_id}: {e}")
        raise

# ====================================================================
# CRUD PRECIOS OVERRIDE (SOBRESCRITURA DE PRECIOS GECLISA)
# ====================================================================

def list_precios_override(solo_activas: bool = False):
    """
    Lista todos los precios personalizados fijados en CRM para códigos de Geclisa.
    """
    if not supabase:
        return []
    try:
        query = supabase.table("practicas_precios_override").select("*").order("nombre_referencia")
        if solo_activas:
            query = query.eq("activo", True)
        resp = query.execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Error al listar practicas_precios_override: {e}")
        return []

def get_precio_override_by_codigo(nom_id: int, nom_cod: str):
    """
    Busca si existe un override de precio activo para un código y nomenclador de Geclisa.
    """
    if not supabase:
        return None
    try:
        resp = supabase.table("practicas_precios_override")\
            .select("*")\
            .eq("nom_id", int(nom_id))\
            .eq("nom_cod", str(nom_cod).strip())\
            .eq("activo", True)\
            .execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return None
    except Exception as e:
        logger.error(f"Error al buscar override para nom_id={nom_id}, nom_cod={nom_cod}: {e}")
        return None

def upsert_precio_override(payload: dict):
    """
    Crea o actualiza un override de precio para una práctica de Geclisa.
    """
    if not supabase:
        return None
    try:
        data = {
            "nom_id": int(payload["nom_id"]),
            "nom_cod": str(payload["nom_cod"]).strip(),
            "nombre_referencia": str(payload.get("nombre_referencia", "")).strip(),
            "precio_override": float(payload["precio_override"]),
            "observacion": payload.get("observacion", ""),
            "activo": payload.get("activo", True),
            "updated_at": "now()"
        }
        # Upsert por restricción única (nom_id, nom_cod)
        resp = supabase.table("practicas_precios_override").upsert(
            data,
            on_conflict="nom_id,nom_cod"
        ).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error al guardar precio override: {e}")
        raise

def delete_precio_override(override_id: str):
    """
    Elimina un override de precio de la base de datos.
    """
    if not supabase:
        return False
    try:
        resp = supabase.table("practicas_precios_override").delete().eq("id", override_id).execute()
        return True
    except Exception as e:
        logger.error(f"Error al eliminar precio override {override_id}: {e}")
        raise

