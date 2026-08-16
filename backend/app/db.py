import os
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    whatsapp_message_id: Optional[str] = None
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
    Retorna la lista de todas las conversaciones con los datos de sus pacientes asociados.
    """
    if not supabase:
        return []
    try:
        query = supabase.table("conversaciones").select(
            "id, paciente_id, bot_disabled, archivada, ultimo_mensaje, updated_at, pacientes(id, telefono, nombre, email)"
        )
        if not incluir_archivadas:
            query = query.eq("archivada", False)
        response = query.order("updated_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error al obtener conversaciones: {e}")
        return []

def obtener_metricas_conversaciones():
    """
    Calcula en tiempo real los contadores para las pestañas de la bandeja de entrada:
    - total_activas
    - derivados_humano (bot_disabled == true and not archivada)
    - bot_activos (bot_disabled == false and not archivada)
    - archivados (archivada == true)
    """
    if not supabase:
        return {"total_activas": 0, "derivados_humano": 0, "bot_activos": 0, "archivados": 0}
    try:
        res = supabase.table("conversaciones").select("id, bot_disabled, archivada").execute()
        convs = res.data or []
        derivados = sum(1 for c in convs if c.get("bot_disabled") and not c.get("archivada"))
        bot_activos = sum(1 for c in convs if not c.get("bot_disabled") and not c.get("archivada"))
        archivados = sum(1 for c in convs if c.get("archivada"))
        total_activas = len(convs) - archivados
        return {
            "total_activas": total_activas,
            "derivados_humano": derivados,
            "bot_activos": bot_activos,
            "archivados": archivados
        }
    except Exception as e:
        logger.error(f"Error al calcular métricas de conversaciones: {e}")
        return {"total_activas": 0, "derivados_humano": 0, "bot_activos": 0, "archivados": 0}

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
            "fecha_definitiva_cirugia", "estado", "situacion_paciente", "motivo_cancelacion"
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


