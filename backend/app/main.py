import os
import time
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager

from fastapi.responses import Response, StreamingResponse, FileResponse
import io
import csv
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.db import (
    supabase, 
    actualizar_bot_disabled,
    archivar_conversacion,
    obtener_metricas_conversaciones,
    obtener_conversaciones,
    obtener_mensajes_conversacion,
    is_lid_number,
    get_paciente_by_lid,
    get_paciente_by_nombre_aproximado,
    get_ultimo_paciente_activo,
    get_paciente_by_telefono,
    crear_paciente,
    get_or_create_conversacion,
    guardar_mensaje,
    get_paciente_by_dni, 
    get_paciente_by_geclisa_id, 
    crear_o_actualizar_paciente_geclisa,
    asignar_medico_paciente,
    list_nomencladores,
    get_nomenclador_by_id,
    create_nomenclador,
    update_nomenclador,
    delete_nomenclador,
    list_practicas_con_arancel,
    create_or_update_practica,
    delete_practica,
    upsert_arancel_practica,
    buscar_practicas_presupuesto,
    bulk_import_practicas_aranceles,
    guardar_transcripcion_mensaje,
    get_asesorias_by_paciente,
    crear_asesoria_quirurgica,
    actualizar_asesoria_quirurgica,
    eliminar_asesoria_quirurgica,
    get_presupuestos_by_paciente,
    cambiar_estado_presupuesto,
    crear_presupuesto_rapido,
    get_evoluciones_by_asesoria,
    crear_evolucion_asesoria,
    eliminar_evolucion_asesoria,
    get_paciente_contexto_360,
    get_configuracion_quirurgica,
    actualizar_configuracion_quirurgica,
    get_pipeline_quirurgico
)
from app.agent import procesar_mensaje_agente, transcribir_audio_con_gemini
from app.services.copilot_service import (
    sugerir_respuesta_copilot,
    mejorar_redaccion_copilot,
    resumir_conversacion_copilot
)
from app.services.phone_normalizer import normalize_phone_number
from app.whatsapp import (
    iniciar_daemon_whatsapp, 
    whatsapp_manager
)
from app.services.pdf_service import PDF_DIR
from app.services.media_service import media_service, STATIC_MEDIA_DIR
from app.services.media_cleaner import purgar_archivos_antiguos, obtener_estadisticas_storage
from app.services.tools import crear_borrador_presupuesto
from app.services.config_service import load_settings, save_settings
from app.services.agent_orchestrator import orchestrator, AVAILABLE_TOOLS_MAP
from app.services.geclisa_client import GeclisaClient
from app.services.logger_service import log_event, get_logs, get_logs_stats

geclisa_client = GeclisaClient()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

async def cron_limpieza_diaria_media():
    """
    Tarea en segundo plano que ejecuta la purga de archivos multimedia > 30 días una vez cada 24 horas.
    """
    while True:
        try:
            await asyncio.sleep(60) # Esperar 1 minuto tras arranque del backend
            logger.info("Ejecutando rutina periódica de retención y limpieza de multimedia (> 30 días)...")
            purgar_archivos_antiguos(dias_retencion=30, dry_run=False)
        except Exception as e:
            logger.error(f"Error en rutina periódica de limpieza de multimedia: {e}")
        
        # Esperar 24 horas para la siguiente ejecución
        await asyncio.sleep(24 * 3600)

# Modelos de validación Pydantic
class SimuladorMensaje(BaseModel):
    telefono: str
    mensaje: str

class ToggleBotRequest(BaseModel):
    bot_disabled: bool

class ItemPresupuestoInput(BaseModel):
    codigo_servicio: str
    nombre_prestacion: Optional[str] = None
    cantidad: int = 1
    precio_unitario: Optional[float] = None
    moneda: Optional[str] = "ARS"

class PresupuestoInput(BaseModel):
    paciente_id: str
    items: List[ItemPresupuestoInput]

class SendMessageRequest(BaseModel):
    telefono: str
    mensaje: str
    conversacion_id: Optional[str] = None
    is_internal_note: Optional[bool] = False

class CopilotSugerirRequest(BaseModel):
    conversacion_id: Optional[str] = None
    paciente_id: Optional[str] = None
    historial: Optional[List[Dict[str, Any]]] = None
    contexto_paciente: Optional[Dict[str, Any]] = None

class CopilotMejorarRequest(BaseModel):
    texto: str

class CopilotResumirRequest(BaseModel):
    conversacion_id: Optional[str] = None
    historial: Optional[List[Dict[str, Any]]] = None

class TestMessageRequest(BaseModel):
    telefono: str
    mensaje: Optional[str] = "¡Hola desde MedCRM! Prueba de vinculación exitosa. 🩺"

# Ciclo de vida de la aplicación FastAPI
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicación CRM Médico + WhatsApp Baileys Gateway...")
    iniciar_daemon_whatsapp()
    asyncio.create_task(cron_limpieza_diaria_media())
    yield
    logger.info("Deteniendo aplicación CRM Médico...")

app = FastAPI(
    title="CRM Médico API + Gestor de WhatsApp Baileys",
    description="Backend en FastAPI para gestión clínica médica, sincronización WhatsApp Baileys y agente Gemini.",
    version="3.0.0",
    lifespan=lifespan
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================================
# SERVIDOR INTELIGENTE DE ESTÁTICOS Y PDFs ON-DEMAND (CON AUTO-REGENERACIÓN)
# ====================================================================

@app.get("/static/{filename}")
def servir_archivo_estatico(filename: str):
    """
    Sirve archivos estáticos y PDFs de presupuestos.
    Si el archivo no existe en el disco local (ej: reinicio o nuevo despliegue de contenedor en Railway),
    lo reconstruye y regenera dinámicamente desde la base de datos de Supabase on-the-fly.
    """
    # 1. Protección contra Path Traversal
    safe_filename = os.path.basename(filename)
    if ".." in filename or "/" in filename or "\\" in filename or safe_filename != filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo no válido.")
        
    file_path = os.path.join(PDF_DIR, safe_filename)
    
    # 2. Si no existe en disco, verificar si es un presupuesto y regenerar
    if not os.path.exists(file_path):
        if safe_filename.startswith("presupuesto_") and safe_filename.endswith(".pdf"):
            presupuesto_id = safe_filename.replace("presupuesto_", "").replace(".pdf", "")
            try:
                if supabase:
                    pres_resp = supabase.table("presupuestos") \
                        .select("*, pacientes(*), items_presupuesto(*, servicios_precios(*)), asesorias_quirurgicas!presupuestos_asesoria_id_fkey(*)") \
                        .eq("id", presupuesto_id) \
                        .execute()
                        
                    if pres_resp.data:
                        p_data = pres_resp.data[0]
                        paciente = p_data.get("pacientes") or {}
                        items_db = p_data.get("items_presupuesto") or []
                        
                        from app.services.pdf_service import generar_pdf_presupuesto
                        generar_pdf_presupuesto(p_data, paciente, items_db)
            except Exception as e:
                logger.error(f"Error regenerando PDF de presupuesto on-demand ({safe_filename}): {e}")

    # 3. Si aún no existe, devolver 404
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo solicitado no fue encontrado en el servidor.")
        
    media_type = "application/pdf" if safe_filename.endswith(".pdf") else "application/octet-stream"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=safe_filename,
        headers={
            "Content-Disposition": f"inline; filename={safe_filename}",
            "X-Content-Type-Options": "nosniff"
        }
    )

# ====================================================================
# ENDPOINTS GENERALES Y HEALTH
# ====================================================================

@app.get("/")
def read_root():
    st = whatsapp_manager.get_status()
    return {
        "status": "online",
        "servicio": "MedCRM - Gestor de Mensajería & Clínica",
        "whatsapp_engine": "Baileys (Node.js)",
        "whatsapp_status": st.get("status", "UNKNOWN"),
        "pdf_storage_dir": PDF_DIR
    }

@app.get("/api/health")
def health_check():
    supabase_ok = False
    if supabase:
        try:
            supabase.table("servicios_precios").select("id").limit(1).execute()
            supabase_ok = True
        except Exception:
            pass
            
    st = whatsapp_manager.get_status()
    return {
        "api": "ok",
        "supabase": "conectado" if supabase_ok else "desconectado",
        "whatsapp_engine": "Baileys",
        "whatsapp_status": st.get("status", "UNKNOWN")
    }

@app.get("/api/version")
def version_check():
    st = whatsapp_manager.get_status()
    return {
        "version": "3.0.0",
        "engine": "Baileys",
        "status": st.get("status", "UNKNOWN"),
        "is_logged_in": st.get("is_logged_in", False)
    }

# ====================================================================
# ENDPOINTS DE GESTIÓN DE WHATSAPP Y VINCULACIÓN QR
# ====================================================================

@app.get("/api/whatsapp/status")
def get_whatsapp_status():
    """
    Retorna el estado de la conexión, si está autenticado, QR disponible y datos del móvil.
    """
    return whatsapp_manager.get_status()

@app.get("/api/whatsapp/qr")
def get_whatsapp_qr():
    """
    Retorna el código QR activo en formato base64 Data-URI para renderizado directo en UI.
    """
    return whatsapp_manager.get_qr_data()

@app.get("/api/whatsapp/logs")
def get_whatsapp_logs(limit: int = 40):
    """
    Retorna los logs recientes del daemon de WhatsApp para el visor de consola.
    """
    return {"logs": whatsapp_manager.get_logs(limit=limit)}

@app.post("/api/whatsapp/connect")
def connect_whatsapp(force: bool = False):
    """
    Inicia o fuerza el reinicio de la conexión con WhatsApp y generación de QR.
    """
    logger.info(f"Petición de conexión WhatsApp recibida (force={force})")
    iniciar_daemon_whatsapp(force_restart=force)
    return {"success": True, "message": "Proceso de conexión iniciado.", "status": whatsapp_manager.get_status()}

@app.post("/api/whatsapp/logout")
def logout_whatsapp():
    """
    Cierra la sesión de WhatsApp, desvincula el dispositivo y reinicia el estado.
    """
    logger.info("Petición de Logout de WhatsApp recibida")
    ok = whatsapp_manager.desconectar_y_logout()
    if not ok:
        raise HTTPException(status_code=500, detail="Error al cerrar sesión de WhatsApp.")
    return {"success": True, "message": "Sesión cerrada correctamente. Dispositivo desvinculado."}

class IncomingWebhookMessage(BaseModel):
    message_id: Optional[str] = None
    from_me: bool = False
    phone: str
    jid: Optional[str] = None
    name: Optional[str] = "Paciente"
    text: str = ""
    message_type: str = "text"
    media: Optional[Dict[str, Any]] = None
    timestamp: Optional[int] = None
    raw_message: Optional[Dict[str, Any]] = None

@app.post("/api/whatsapp/webhook/incoming")
async def receive_incoming_whatsapp_message(payload: IncomingWebhookMessage):
    """
    Webhook que recibe los mensajes entrantes de WhatsApp desde el microservicio Baileys
    y ejecuta el pipeline de paciente, conversación y agente IA.
    """
    try:
        if payload.from_me:
            return {"status": "ignored", "reason": "outgoing_message"}

        clean_phone = normalize_phone_number(payload.phone) if payload.phone else ""
        texto = payload.text.strip() if payload.text else ""

        logger.info(f"Mensaje entrante Baileys desde {clean_phone} [{payload.message_type}]: {texto[:50]}")

        if not clean_phone:
            return {"status": "ignored", "reason": "empty_phone"}

        # Si el remitente es un LID de WhatsApp (ej: 194149819109552), resolver al paciente real
        paciente = None
        if is_lid_number(clean_phone) or is_lid_number(payload.phone):
            logger.info(f"Detectado identificador LID ({payload.phone}). Resolviendo con paciente real del CRM...")
            paciente = get_paciente_by_lid(payload.phone) or get_paciente_by_lid(clean_phone)
            if not paciente and payload.name and payload.name != "Paciente":
                paciente = get_paciente_by_nombre_aproximado(payload.name)
            if not paciente:
                paciente = get_ultimo_paciente_activo()
            if paciente:
                clean_phone = paciente.get("telefono") or clean_phone
                logger.info(f"✔ Mensaje del LID {payload.phone} enrutado exitosamente a paciente: {paciente.get('nombre')} ({clean_phone})")

        # 1. Obtener o crear paciente
        if not paciente:
            paciente = get_paciente_by_telefono(clean_phone)
        if not paciente:
            nombre = payload.name if payload.name and payload.name != "Paciente" else f"Paciente {clean_phone[-4:] if len(clean_phone) >= 4 else clean_phone}"
            paciente = crear_paciente(telefono=clean_phone, nombre=nombre)
        
        if not paciente:
            logger.error(f"No se pudo crear ni obtener paciente para {clean_phone}")
            return {"status": "error", "detail": "No se pudo obtener paciente"}

        paciente_id = paciente["id"] if isinstance(paciente, dict) else paciente.get("id")

        # 2. Conversación
        conversacion = get_or_create_conversacion(paciente_id)
        if not conversacion:
            logger.error(f"No se pudo obtener/crear conversacion para paciente {paciente_id}")
            return {"status": "error", "detail": "No se pudo obtener conversación"}

        conversacion_id = conversacion["id"] if isinstance(conversacion, dict) else conversacion.get("id")

        # 3. Guardar mensaje entrante del paciente (con deduplicación por whatsapp_message_id)
        if payload.message_id and supabase:
            try:
                existente = supabase.table("mensajes").select("id").eq("conversacion_id", conversacion_id).contains("metadata_json", {"whatsapp_message_id": payload.message_id}).execute()
                if existente.data and len(existente.data) > 0:
                    logger.info(f"Mensaje {payload.message_id} ya registrado previamente en conversacion {conversacion_id}. Omitiendo duplicado.")
                    return {"status": "ignored", "reason": "duplicate_message_id"}
            except Exception as dedup_err:
                logger.warning(f"Error verificando duplicado: {dedup_err}")

        # Construir metadata_json enriquecido con datos multimedia
        meta = {
            "whatsapp_message_id": payload.message_id,
            "whatsapp_lid": payload.phone if is_lid_number(payload.phone) else None
        }
        if payload.media and isinstance(payload.media, dict):
            meta.update(payload.media)

        caption_texto = payload.media.get("caption") if (payload.media and isinstance(payload.media, dict)) else None
        tipo_label = payload.media.get("tipo", payload.message_type) if (payload.media and isinstance(payload.media, dict)) else payload.message_type
        contenido_final = texto or caption_texto or f"[{tipo_label.upper()}]"

        guardar_mensaje(
            conversacion_id=conversacion_id,
            emisor="paciente",
            contenido=contenido_final,
            metadata_json=meta
        )

        # 4. Procesar agente IA si el bot no está desactivado para esta conversación
        bot_disabled = conversacion.get("bot_disabled", False) if isinstance(conversacion, dict) else False
        if not bot_disabled and texto:
            try:
                respuesta_agente = procesar_mensaje_agente(conversacion_id=conversacion_id, mensaje_texto_o_paciente_id=texto)
                if respuesta_agente:
                    whatsapp_manager.enviar_mensaje(clean_phone, respuesta_agente, conversacion_id=conversacion_id, emisor="bot")
            except Exception as agent_err:
                logger.error(f"Error procesando respuesta de agente IA: {agent_err}")

        return {"status": "processed", "conversacion_id": conversacion_id, "telefono": clean_phone}
    except Exception as e:
        logger.error(f"Error procesando mensaje entrante Baileys: {e}", exc_info=True)
        return {"status": "error", "detail": str(e)}

@app.get("/api/conversaciones")
def get_conversaciones_api(incluir_archivadas: bool = True):
    """
    Retorna la lista de todas las conversaciones activas con sus pacientes asociados.
    """
    return obtener_conversaciones(incluir_archivadas=incluir_archivadas)

@app.get("/api/conversaciones/metricas")
def get_conversaciones_metricas_api():
    """
    Retorna los contadores en tiempo real para las pestañas de la bandeja de entrada:
    - Derivados a Humano
    - En Gestión por IA (Bot Activo)
    - Total Activos
    - Resueltos / Archivados
    """
    return obtener_metricas_conversaciones()

@app.post("/api/conversaciones/{conversacion_id}/archivar")
def archivar_conversacion_api(conversacion_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Marca una conversación como archivada / resuelta o la restaura a activa.
    """
    archivada = payload.get("archivada", True)
    logger.info(f"Cambiando estado archivada en conversación {conversacion_id} a {archivada}")
    res = archivar_conversacion(conversacion_id, archivada)
    if not res:
        raise HTTPException(status_code=404, detail="No se pudo actualizar el estado de la conversación.")
    return {"success": True, "conversacion": res}

@app.get("/api/conversaciones/{conversacion_id}/mensajes")
def get_mensajes_conversacion_api(conversacion_id: str):
    """
    Retorna todo el historial de mensajes de una conversación específica.
    """
    return obtener_mensajes_conversacion(conversacion_id)

@app.post("/api/mensajes/{mensaje_id}/transcribir")
def transcribir_mensaje_api(mensaje_id: str):
    """
    Transcribe un mensaje de audio bajo demanda utilizando Google Gemini Multimodal.
    Retorna el texto transcripto y lo almacena en metadata_json.transcripcion del mensaje.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos Supabase no configurada.")
    
    try:
        res = supabase.table("mensajes").select("*").eq("id", mensaje_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Mensaje no encontrado.")
        
        msg = res.data[0]
        meta = msg.get("metadata_json") or {}
        if isinstance(meta, str):
            import json
            meta = json.loads(meta)

        # Si ya está transcripto, retornar directamente
        if meta.get("transcripcion") and str(meta.get("transcripcion")).strip():
            return {
                "success": True,
                "transcripcion": meta.get("transcripcion"),
                "mensaje_id": mensaje_id,
                "cached": True
            }

        audio_url = meta.get("media_url") or meta.get("relative_url")
        if not audio_url:
            raise HTTPException(status_code=400, detail="El mensaje no contiene una URL de audio válida.")

        # Si la URL es relativa y apunta a static
        if not audio_url.startswith("http"):
            audio_url = f"http://localhost:8000/{audio_url.lstrip('/')}"

        logger.info(f"Iniciando transcripción de audio para mensaje {mensaje_id}...")
        texto_transcrito = transcribir_audio_con_gemini(audio_url)
        
        # Persistir en la base de datos
        guardar_transcripcion_mensaje(mensaje_id, texto_transcrito)

        return {
            "success": True,
            "transcripcion": texto_transcrito,
            "mensaje_id": mensaje_id,
            "cached": False
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error procesando transcripción de audio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al transcribir el audio con Gemini: {str(e)}")

@app.post("/api/mantenimiento/purgar-media")
def purgar_media_api(dias: int = 30, dry_run: bool = False):
    """
    Ejecuta la purga de archivos multimedia antiguos (> 30 días) en Supabase Storage
    auto-transcribiendo los audios previos con Gemini para preservar su contenido textual.
    """
    logger.info(f"Endpoint de mantenimiento invocado: purga con retención de {dias} días (dry_run={dry_run})")
    return purgar_archivos_antiguos(dias_retencion=dias, dry_run=dry_run)

@app.get("/api/mantenimiento/estadisticas-storage")
def estadisticas_storage_api():
    """
    Retorna métricas de archivos almacenados, espacio utilizado y conteo de audios transcriptos.
    """
    return obtener_estadisticas_storage()

@app.post("/api/whatsapp/send-message")
def send_message_api(payload: SendMessageRequest):
    """
    Envía un mensaje de texto directamente al WhatsApp real del paciente o lo guarda como NOTA INTERNA privada del equipo.
    """
    # 1. NOTA INTERNA (Solo visible en el CRM, NUNCA se envía al paciente por WhatsApp)
    if payload.is_internal_note:
        logger.info(f"Registrando nota interna en conversación {payload.conversacion_id}")
        meta = {
            "is_internal_note": True,
            "tipo": "nota_interna",
            "autor": "Operador Humano"
        }
        msg = guardar_mensaje(
            conversacion_id=payload.conversacion_id,
            emisor="operador",
            contenido=payload.mensaje,
            metadata_json=meta
        )
        return {
            "success": True,
            "is_internal_note": True,
            "guardado_db": True,
            "mensaje": msg
        }

    # 2. MENSAJE SALIENTE A WHATSAPP
    telefono_final = payload.telefono
    if (not telefono_final or not str(telefono_final).strip()) and payload.conversacion_id:
        try:
            if supabase:
                conv = supabase.table("conversaciones").select("paciente_id, pacientes(telefono)").eq("id", payload.conversacion_id).execute()
                if conv.data and len(conv.data) > 0:
                    p_data = conv.data[0].get("pacientes")
                    if isinstance(p_data, list) and len(p_data) > 0:
                        telefono_final = p_data[0].get("telefono")
                    elif isinstance(p_data, dict):
                        telefono_final = p_data.get("telefono")
        except Exception as e:
            logger.warning(f"No se pudo recuperar teléfono por conversación {payload.conversacion_id}: {e}")

    logger.info(f"Enviando mensaje saliente a {telefono_final} [operador] (conversacion_id: {payload.conversacion_id})")
    result = whatsapp_manager.enviar_mensaje(
        telefono_o_jid=telefono_final,
        texto=payload.mensaje,
        conversacion_id=payload.conversacion_id,
        emisor="operador"
    )
    if "error" in result and not result.get("guardado_db"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result

# ====================================================================
# ENDPOINTS COPILOTO DE IA (GEMINI)
# ====================================================================

@app.post("/api/chat/copilot/sugerir")
def copilot_sugerir_api(payload: CopilotSugerirRequest):
    """
    Genera una sugerencia de respuesta redactada con Gemini basada en el historial del chat y la ficha clínica.
    """
    msgs = payload.historial or []
    contexto = payload.contexto_paciente or {}
    
    if payload.conversacion_id and (not msgs or not contexto):
        try:
            if not msgs:
                msgs = obtener_mensajes_conversacion(payload.conversacion_id)
            if payload.paciente_id and not contexto:
                contexto = get_paciente_contexto_360(payload.paciente_id)
        except Exception as err:
            logger.warning(f"Error cargando contexto para copilot sugerir: {err}")

    sugerencia = sugerir_respuesta_copilot(msgs, contexto)
    return {"success": True, "sugerencia": sugerencia}

@app.post("/api/chat/copilot/mejorar")
def copilot_mejorar_api(payload: CopilotMejorarRequest):
    """
    Mejora la redacción, tono, calidez y ortografía de un borrador de mensaje.
    """
    mejorado = mejorar_redaccion_copilot(payload.texto)
    return {"success": True, "texto_mejorado": mejorado}

@app.post("/api/chat/copilot/resumir")
def copilot_resumir_api(payload: CopilotResumirRequest):
    """
    Genera un resumen ejecutivo en 3 puntos clave de la conversación médica/administrativa.
    """
    msgs = payload.historial or []
    if payload.conversacion_id and not msgs:
        try:
            msgs = obtener_mensajes_conversacion(payload.conversacion_id)
        except Exception as err:
            logger.warning(f"Error cargando mensajes para copilot resumir: {err}")

    resumen = resumir_conversacion_copilot(msgs)
    return {"success": True, "resumen": resumen}

@app.post("/api/whatsapp/send-test")
def send_test_message(payload: TestMessageRequest):
    """
    Envía un mensaje de prueba al teléfono indicado para verificar la conexión activa.
    """
    logger.info(f"Enviando mensaje de prueba a {payload.telefono}")
    result = whatsapp_manager.enviar_mensaje(
        telefono_o_jid=payload.telefono,
        texto=payload.mensaje or "Mensaje de prueba desde MedCRM"
    )
    if "error" in result and not result.get("guardado_db"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/whatsapp/send-media")
async def send_media_api(
    file: UploadFile = File(...),
    telefono: str = Form(...),
    conversacion_id: Optional[str] = Form(None),
    caption: Optional[str] = Form("")
):
    """
    Envía un archivo multimedia (imagen, PDF, estudio médico) al WhatsApp del paciente
    y lo almacena con metadatos estructurados en Supabase.
    """
    logger.info(f"API: Enviando archivo {file.filename} a {telefono} (conversacion_id: {conversacion_id})")
    try:
        content = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        original_name = file.filename or "archivo"
        
        subfolder = "images" if "image" in mime_type else "documents"
        tipo = "imagen" if "image" in mime_type else "audio" if "audio" in mime_type else "documento"
        media_type_baileys = "image" if "image" in mime_type else "audio" if "audio" in mime_type else "document"

        # Guardar en almacenamiento estático
        saved = media_service.save_media_bytes(
            data=content,
            subfolder=subfolder,
            mime_type=mime_type,
            original_filename=original_name,
            prefix="crm_out"
        )
        
        media_url_final = saved["media_url"]

        # Intentar subir a Supabase Storage Bucket whatsapp-media
        if supabase:
            try:
                storage_path = f"media/{int(time.time())}_{original_name}"
                res = supabase.storage.from_("whatsapp-media").upload(
                    file=content,
                    path=storage_path,
                    file_options={"content-type": mime_type, "upsert": "true"}
                )
                public_res = supabase.storage.from_("whatsapp-media").get_public_url(storage_path)
                if public_res:
                    media_url_final = public_res
            except Exception as sup_err:
                logger.warning(f"No se pudo subir a Supabase Storage, usando URL local: {sup_err}")

        # Enviar vía WhatsApp Baileys
        result = whatsapp_manager.enviar_multimedia(
            telefono=telefono,
            media_url=media_url_final,
            media_type=media_type_baileys,
            caption=caption or "",
            filename=original_name
        )
        
        # Guardar mensaje saliente del operador en Supabase
        if conversacion_id:
            try:
                guardar_mensaje(
                    conversacion_id=conversacion_id,
                    emisor="operador",
                    contenido=caption or original_name,
                    metadata_json={
                        "tipo": tipo,
                        "media_url": media_url_final,
                        "relative_url": saved.get("relative_url"),
                        "file_name": original_name,
                        "mime_type": mime_type,
                        "file_size_bytes": len(content),
                        "caption": caption or "",
                        "delivery_status": "enviado"
                    }
                )
            except Exception as db_save_err:
                logger.error(f"Error guardando mensaje multimedia en BD: {db_save_err}")

        return {
            "success": True,
            "media": {
                **saved,
                "media_url": media_url_final,
                "tipo": tipo
            },
            "whatsapp_result": result
        }
    except Exception as e:
        logger.error(f"Error enviando archivo multimedia: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar archivo: {str(e)}")

# ====================================================================
# ENDPOINTS DE CONFIGURACIÓN DEL SISTEMA Y BOT
# ====================================================================

@app.get("/api/settings")
def get_system_settings():
    """
    Obtiene la configuración actual del consultorio, bot de IA y reglas de escalamiento.
    """
    return load_settings()

@app.post("/api/settings")
def update_system_settings(payload: Dict[str, Any] = Body(...)):
    """
    Actualiza y persiste la configuración del consultorio y bot de IA.
    """
    try:
        updated = save_settings(payload)
        return {"success": True, "settings": updated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error actualizando configuraciones: {str(e)}")

# ====================================================================
# ENDPOINTS DEL SISTEMA MULTI-AGENTE (PROMPT LAYERING & PERSONAS)
# ====================================================================

class GlobalDirectivesUpdate(BaseModel):
    nombre_clinica: Optional[str] = None
    tono_general: Optional[str] = None
    guardrails_medicos: Optional[str] = None
    politica_escalamiento: Optional[str] = None
    politica_turnos: Optional[str] = None
    politica_presupuestos: Optional[str] = None
    agente_defecto_codigo: Optional[str] = None

class SituationalAgentCreateUpdate(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = ""
    activo: Optional[bool] = True
    temperatura: Optional[float] = 0.2
    directiva_particular: str
    herramientas_habilitadas: Optional[List[str]] = ["buscar_disponibilidad_turnos", "crear_borrador_presupuesto", "escalar_a_operador_humano"]
    criterios_activacion: Optional[Any] = []
    orden: Optional[int] = 0

class AgentSimulatorRequest(BaseModel):
    mensaje: str
    agente_codigo: Optional[str] = "AUTO"
    paciente_nombre: Optional[str] = None
    paciente_etapa: Optional[str] = "CONSULTA_GENERAL"
    medico_asignado: Optional[str] = None

class AssignAgentConversationRequest(BaseModel):
    agente_codigo: str

@app.get("/api/agentes/config")
def get_multiagent_config():
    """
    Retorna la configuración completa del sistema multi-agente:
    directivas globales de la clínica, lista de agentes situacionales y herramientas disponibles.
    """
    try:
        globales = orchestrator.get_global_directives()
        agentes = list(orchestrator.get_all_agents().values())
        tools_list = list(AVAILABLE_TOOLS_MAP.keys())
        return {
            "success": True,
            "globales": globales,
            "agentes": agentes,
            "available_tools": tools_list
        }
    except Exception as e:
        logger.error(f"Error obteniendo configuración multi-agente: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/agentes/globales")
def update_global_directives(payload: GlobalDirectivesUpdate):
    """
    Actualiza las directivas globales y guardrails médicos de la clínica en Supabase.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    try:
        data_to_update = {k: v for k, v in payload.dict().items() if v is not None}
        data_to_update["updated_at"] = "now()"
        
        # Verificar si existe el registro singleton
        check = supabase.table("agentes_directivas_globales").select("id").limit(1).execute()
        if check.data and len(check.data) > 0:
            rec_id = check.data[0]["id"]
            resp = supabase.table("agentes_directivas_globales").update(data_to_update).eq("id", rec_id).execute()
        else:
            resp = supabase.table("agentes_directivas_globales").insert(data_to_update).execute()
        
        orchestrator.invalidate_cache()
        log_event(
            nivel="INFO",
            modulo="SISTEMA",
            accion="CONFIGURACION_AGENTES",
            mensaje="Directivas globales de la clínica actualizadas.",
            detalles=data_to_update
        )
        return {"success": True, "globales": orchestrator.get_global_directives()}
    except Exception as e:
        logger.error(f"Error actualizando directivas globales: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agentes/situacionales")
def create_situational_agent(payload: SituationalAgentCreateUpdate):
    """
    Crea un nuevo agente situacional en Supabase.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    try:
        clean_code = payload.codigo.strip().upper().replace(" ", "_")
        agent_data = payload.dict()
        agent_data["codigo"] = clean_code
        agent_data["updated_at"] = "now()"
        
        resp = supabase.table("agentes_situacionales").insert(agent_data).execute()
        orchestrator.invalidate_cache()
        
        log_event(
            nivel="INFO",
            modulo="SISTEMA",
            accion="CREAR_AGENTE_SITUACIONAL",
            mensaje=f"Agente situacional creado: {payload.nombre} ({clean_code})",
            detalles=agent_data
        )
        return {"success": True, "agente": resp.data[0] if resp.data else agent_data}
    except Exception as e:
        logger.error(f"Error creando agente situacional: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/agentes/situacionales/{agente_id}")
def update_situational_agent(agente_id: str, payload: SituationalAgentCreateUpdate):
    """
    Actualiza las pautas, herramientas o estado de un agente situacional existente.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    try:
        agent_data = {k: v for k, v in payload.dict().items() if v is not None}
        if "codigo" in agent_data:
            agent_data["codigo"] = agent_data["codigo"].strip().upper().replace(" ", "_")
        agent_data["updated_at"] = "now()"

        resp = supabase.table("agentes_situacionales").update(agent_data).eq("id", agente_id).execute()
        orchestrator.invalidate_cache()
        
        log_event(
            nivel="INFO",
            modulo="SISTEMA",
            accion="ACTUALIZAR_AGENTE_SITUACIONAL",
            mensaje=f"Agente situacional actualizado: {payload.nombre}",
            detalles=agent_data
        )
        return {"success": True, "agente": resp.data[0] if resp.data else agent_data}
    except Exception as e:
        logger.error(f"Error actualizando agente situacional: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/agentes/situacionales/{agente_id}")
def delete_situational_agent(agente_id: str):
    """
    Elimina un agente situacional de Supabase.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    try:
        resp = supabase.table("agentes_situacionales").delete().eq("id", agente_id).execute()
        orchestrator.invalidate_cache()
        return {"success": True, "deleted_id": agente_id}
    except Exception as e:
        logger.error(f"Error eliminando agente situacional: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agentes/simulador")
def simulate_agent_prompt(payload: AgentSimulatorRequest):
    """
    Ejecuta una prueba en vivo con un perfil y mensaje dado sin persistir mensajes ni modificar WhatsApp.
    Permite verificar cómo responde cada agente situacional en tiempo real.
    """
    t_start = time.time()
    try:
        import uuid
        temp_conv_id = str(uuid.uuid4())
        override_code = None if payload.agente_codigo in ["AUTO", "", None] else payload.agente_codigo
        
        # Inyectar mock de paciente si fue provisto
        mock_paciente_id = None
        
        respuesta = procesar_mensaje_agente(
            conversacion_id=temp_conv_id,
            mensaje_texto_o_paciente_id=payload.mensaje,
            guardar_en_db=False,
            agente_override_codigo=override_code
        )
        
        duracion = int((time.time() - t_start) * 1000)
        
        # Determinar qué agente resolvió la consulta
        if override_code:
            ag_usado = orchestrator.get_agent_by_code(override_code)
        else:
            ag_usado = orchestrator.determine_active_agent(mensaje_texto=payload.mensaje)

        return {
            "success": True,
            "respuesta": respuesta,
            "agente_utilizado": {
                "codigo": ag_usado.get("codigo"),
                "nombre": ag_usado.get("nombre"),
                "temperatura": ag_usado.get("temperatura")
            },
            "duracion_ms": duracion
        }
    except Exception as e:
        logger.error(f"Error en simulador agéntico: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/conversaciones/{conversacion_id}/agente")
def assign_agent_to_conversation(conversacion_id: str, payload: AssignAgentConversationRequest):
    """
    Asigna manualmente un agente situacional a una conversación específica (o 'AUTO' para enrutamiento inteligente).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    try:
        resp = supabase.table("conversaciones").update({"agente_asignado_codigo": payload.agente_codigo}).eq("id", conversacion_id).execute()
        return {"success": True, "agente_asignado_codigo": payload.agente_codigo}
    except Exception as e:
        logger.error(f"Error asignando agente a conversación {conversacion_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# ENDPOINTS DE CONVERSACIONES, PRESUPUESTOS Y SIMULADOR
# ====================================================================

@app.post("/api/conversaciones/{conversacion_id}/toggle-bot")
def toggle_bot(conversacion_id: str, payload: ToggleBotRequest):
    """
    Habilita o deshabilita la atención del bot automático en una conversación específica.
    """
    logger.info(f"Alternar bot en conversación {conversacion_id} a {payload.bot_disabled}")
    res = actualizar_bot_disabled(conversacion_id, payload.bot_disabled)
    if not res:
        raise HTTPException(status_code=404, detail="Conversación no encontrada.")
    return {"success": True, "conversacion": res}

@app.post("/api/simulate-message")
def simulate_message(payload: SimuladorMensaje):
    """
    Simula un mensaje de WhatsApp entrante para desarrollo/pruebas.
    """
    logger.info(f"Simulando mensaje de {payload.telefono}: {payload.mensaje}")
    
    class MockSender:
        def __init__(self, sender):
            self.User = sender
            self.Sender = sender

    class MockInfo:
        def __init__(self, sender):
            self.Sender = sender
            self.PushName = f"Paciente Test ({sender[-4:]})"

    class MockConversationMessage:
        def __init__(self, text):
            self.conversation = text
            self.extendedTextMessage = None

    class MockEvent:
        def __init__(self, sender, text):
            self.Info = MockInfo(sender)
            self.Message = MockConversationMessage(text)

    class MockClient:
        def send_message(self, jid, text):
            logger.info(f"[WHATSAPP SIMULADO] ENVIANDO A {jid}: {text}")
            return {"status": "sent", "to": str(jid), "content": text}

    mock_client = MockClient()
    mock_event = MockEvent(payload.telefono, payload.mensaje)
    
    # Delegar al procesador de mensajes
    whatsapp_manager._handle_incoming_message(mock_client, mock_event)
    
    return {
        "success": True,
        "mensaje": f"Mensaje procesado en simulación para {payload.telefono}."
    }

@app.post("/api/presupuestos")
def create_presupuesto_api(payload: PresupuestoInput):
    """
    Crea un presupuesto para un paciente y genera el PDF correspondiente con valores y soporte multi-moneda.
    """
    logger.info(f"API: Crear presupuesto para paciente {payload.paciente_id}")
    items_parsed = [
        {
            "codigo_servicio": it.codigo_servicio,
            "nombre_prestacion": it.nombre_prestacion,
            "cantidad": it.cantidad,
            "precio_unitario": it.precio_unitario,
            "moneda": it.moneda or "ARS"
        }
        for it in payload.items
    ]
    res = crear_borrador_presupuesto(payload.paciente_id, items_parsed)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.get("/api/presupuestos/plantilla-preview")
def preview_plantilla_presupuesto():
    """
    Genera un PDF de muestra al vuelo para previsualizar el diseño de la plantilla institucional.
    """
    try:
        from app.services.pdf_service import generar_pdf_presupuesto
        from datetime import date
        
        sample_presupuesto = {
            "id": "A1B2C3D4",
            "created_at": date.today().isoformat(),
            "estado": "borrador",
            "total": 30500.00
        }
        sample_paciente = {
            "nombre": "GARCÍA, MARÍA JOSÉ",
            "telefono": "+54 9 11 4444-5555",
            "email": "maria.garcia@ejemplo.com",
            "dni": "35.890.123",
            "obra_social": "OSDE 310"
        }
        sample_items = [
            {
                "codigo": "420101",
                "nombre_prestacion": "Consulta Médica Especializada en Fertilidad",
                "cantidad": 1,
                "precio_unitario": 8500.00,
                "moneda": "ARS",
                "subtotal": 8500.00
            },
            {
                "codigo": "180104",
                "nombre_prestacion": "Ecografía Ginecológica Transvaginal de Alta Resolución",
                "cantidad": 1,
                "precio_unitario": 22000.00,
                "moneda": "ARS",
                "subtotal": 22000.00
            },
            {
                "codigo": "FIV-ICSI-01",
                "nombre_prestacion": "Tratamiento FIV + ICSI Completo con Criopreservación",
                "cantidad": 1,
                "precio_unitario": 1500.00,
                "moneda": "USD",
                "subtotal": 1500.00
            }
        ]
        
        filename = generar_pdf_presupuesto(sample_presupuesto, sample_paciente, sample_items)
        return {
            "success": True,
            "pdf_url": f"/static/{filename}"
        }
    except Exception as e:
        logger.error(f"Error al generar preview de plantilla: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# ENDPOINTS DE INTEGRACIÓN CON GECLISA (HOSPITALARIO)
# ====================================================================

@app.get("/api/geclisa/pacientes/buscar-por-dni")
def buscar_geclisa_dni(dni: str):
    """
    Busca al paciente en Geclisa por número de DNI y verifica si ya está registrado en el CRM.
    """
    if not dni:
        raise HTTPException(status_code=400, detail="Debe ingresar un número de DNI.")
        
    resultado = geclisa_client.buscar_paciente_por_dni(dni)
    if not resultado.get("encontrado"):
        return resultado

    # Verificar si ya existe en Supabase
    ficha_id = resultado.get("ficha_id")
    dni_resultado = resultado.get("dni") or dni
    
    paciente_crm = None
    if ficha_id:
        paciente_crm = get_paciente_by_geclisa_id(ficha_id)
    if not paciente_crm and dni_resultado:
        paciente_crm = get_paciente_by_dni(dni_resultado)

    resultado["ya_en_crm"] = bool(paciente_crm)
    resultado["crm_paciente_id"] = paciente_crm.get("id") if paciente_crm else None
    return resultado

@app.get("/api/geclisa/pacientes/buscar-por-ficha")
def buscar_geclisa_ficha(ficha_id: int):
    """
    Busca la ficha en Geclisa directamente por fichaId y verifica si ya está registrada en el CRM.
    """
    if not ficha_id:
        raise HTTPException(status_code=400, detail="Debe ingresar un ID de ficha válido.")
        
    resultado = geclisa_client.buscar_paciente_por_ficha(ficha_id)
    if not resultado.get("encontrado"):
        return resultado

    # Verificar si ya existe en Supabase
    paciente_crm = get_paciente_by_geclisa_id(ficha_id)
    if not paciente_crm and resultado.get("dni"):
        paciente_crm = get_paciente_by_dni(resultado.get("dni"))

    resultado["ya_en_crm"] = bool(paciente_crm)
    resultado["crm_paciente_id"] = paciente_crm.get("id") if paciente_crm else None
    return resultado

@app.get("/api/geclisa/turnos/pendientes/{ficha_id}")
def obtener_turnos_pendientes_geclisa(ficha_id: int):
    """
    Consulta en tiempo real a Geclisa los turnos pendientes/agendados de una ficha de paciente (GET /api/Turnos/pendientes/{fichaId}).
    No almacena en la base de datos local.
    """
    try:
        resultado = geclisa_client.obtener_turnos_pendientes_ficha(ficha_id)
        return resultado
    except Exception as e:
        logger.error(f"Error al obtener turnos pendientes de Geclisa para ficha {ficha_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/geclisa/pacientes/importar")
def importar_paciente_geclisa(payload: Dict[str, Any] = Body(...)):
    """
    Importa o actualiza un paciente desde Geclisa hacia la base de datos del CRM (Supabase).
    """
    if not payload:
        raise HTTPException(status_code=400, detail="El payload con los datos del paciente está vacío.")
        
    try:
        paciente = crear_o_actualizar_paciente_geclisa(payload)
        if not paciente or not isinstance(paciente, dict):
            raise HTTPException(status_code=500, detail="No se pudo registrar el paciente en la base de datos Supabase.")
            
        nombre = paciente.get("nombre", "importado")
        return {
            "success": True,
            "mensaje": f"Paciente {nombre} importado correctamente.",
            "paciente": paciente
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al importar paciente desde Geclisa: {e}")
        raise HTTPException(status_code=500, detail=f"Error al importar paciente: {str(e)}")

@app.post("/api/geclisa/pacientes/sincronizar/{paciente_id}")
def sincronizar_paciente_geclisa(paciente_id: str):
    """
    Consulta en vivo a Geclisa y actualiza los datos del paciente en Supabase.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos Supabase no conectada.")
        
    try:
        # 1. Obtener paciente de Supabase
        res = supabase.table("pacientes").select("*").eq("id", paciente_id).execute()
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail="Paciente no encontrado en el CRM.")
            
        paciente_actual = res.data[0]
        ficha_id = paciente_actual.get("geclisa_ficha_id")
        dni = paciente_actual.get("dni")
        
        datos_geclisa = None
        if ficha_id:
            logger.info(f"Sincronizando paciente {paciente_id} por fichaId {ficha_id}...")
            datos_geclisa = geclisa_client.buscar_paciente_por_ficha(int(ficha_id))
        elif dni:
            logger.info(f"Sincronizando paciente {paciente_id} por DNI {dni}...")
            datos_geclisa = geclisa_client.buscar_paciente_por_dni(str(dni))
            
        if not datos_geclisa or not datos_geclisa.get("encontrado"):
            msg = datos_geclisa.get("mensaje") if datos_geclisa else "El paciente no posee Ficha ID ni DNI para consultar en Geclisa."
            raise HTTPException(status_code=404, detail=msg or "No se encontraron datos en Geclisa para este paciente.")

        # 2. Mezclar datos preservando campos propios del CRM si no vienen de Geclisa
        payload_actualizado = {
            "id": paciente_id,
            "geclisa_ficha_id": datos_geclisa.get("ficha_id") or ficha_id,
            "dni": datos_geclisa.get("dni") or dni,
            "nombre_completo": datos_geclisa.get("nombre_completo") or paciente_actual.get("nombre"),
            "nombre": datos_geclisa.get("nombre") or paciente_actual.get("nombre"),
            "telefono": datos_geclisa.get("telefono") or paciente_actual.get("telefono"),
            "telefono_fijo": datos_geclisa.get("telefono_fijo") or paciente_actual.get("telefono_fijo"),
            "email": datos_geclisa.get("email") or paciente_actual.get("email"),
            "nro_hc": datos_geclisa.get("nro_hc") or paciente_actual.get("nro_hc"),
            "obra_social": datos_geclisa.get("obra_social") or paciente_actual.get("obra_social"),
            "plan_cobertura": datos_geclisa.get("plan_cobertura") or paciente_actual.get("plan_cobertura"),
            "direccion": datos_geclisa.get("direccion") or paciente_actual.get("direccion"),
            "fecha_nacimiento": datos_geclisa.get("fecha_nacimiento") or paciente_actual.get("fecha_nacimiento"),
            "sexo": datos_geclisa.get("sexo") or paciente_actual.get("sexo"),
            "medico_cabecera": paciente_actual.get("medico_cabecera"),
            "medico_cabecera_id": paciente_actual.get("medico_cabecera_id"),
            "medico_cabecera_nombre": paciente_actual.get("medico_cabecera_nombre"),
            "medico_cabecera_matricula": paciente_actual.get("medico_cabecera_matricula"),
            "medico_cabecera_especialidad": paciente_actual.get("medico_cabecera_especialidad"),
        }

        paciente_actualizado = crear_o_actualizar_paciente_geclisa(payload_actualizado)
        return {
            "success": True,
            "mensaje": f"Expediente de {paciente_actualizado.get('nombre')} sincronizado con Geclisa.",
            "paciente": paciente_actualizado
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al sincronizar paciente con Geclisa: {e}")
        raise HTTPException(status_code=500, detail=f"Error al sincronizar paciente: {str(e)}")

@app.get("/api/geclisa/pacientes/{paciente_id}/historia-clinica")
def obtener_historia_clinica_paciente(paciente_id: str):
    """
    Consulta en vivo las evoluciones de la historia clínica en Geclisa.
    Soporta paciente_id como UUID del CRM, DNI o Ficha ID directamente.
    Si el paciente no tiene 'geclisa_ficha_id' pero tiene 'dni', busca en Geclisa por DNI,
    asocia la ficha encontrada en Supabase y consulta la historia clínica.
    No persiste la historia clínica en Supabase (operación 100% de lectura on-demand).
    """
    try:
        ficha_id = None
        dni = None
        paciente_nombre = None
        paciente_crm_id = None

        # 1. Intentar buscar en Supabase (por UUID, DNI o ficha_id)
        if supabase:
            try:
                res_paciente = None
                # Búsqueda por UUID solo si tiene formato UUID
                if len(str(paciente_id)) == 36 and '-' in str(paciente_id):
                    res_paciente = supabase.table("pacientes").select("*").eq("id", paciente_id).execute()

                if not res_paciente or not res_paciente.data:
                    # Búsqueda por DNI
                    res_paciente = supabase.table("pacientes").select("*").ilike("dni", f"%{paciente_id}%").execute()

                if not res_paciente or not res_paciente.data:
                    # Búsqueda por geclisa_ficha_id si es numérico
                    if str(paciente_id).isdigit():
                        res_paciente = supabase.table("pacientes").select("*").eq("geclisa_ficha_id", int(paciente_id)).execute()

                if res_paciente and res_paciente.data and len(res_paciente.data) > 0:
                    paciente = res_paciente.data[0]
                    paciente_crm_id = paciente.get("id")
                    ficha_id = paciente.get("geclisa_ficha_id")
                    dni = paciente.get("dni")
                    paciente_nombre = paciente.get("nombre")
            except Exception as db_err:
                logger.warning(f"Aviso al consultar paciente en Supabase: {db_err}")

        # Si no se encontró en Supabase pero paciente_id parece ser un DNI o Ficha directa
        if not dni and not ficha_id:
            if str(paciente_id).isdigit():
                if len(str(paciente_id)) >= 7:
                    dni = str(paciente_id)
                else:
                    ficha_id = int(paciente_id)

        # 2. Si no tiene ficha_id pero tiene DNI, resolver por DNI contra Geclisa
        if not ficha_id and dni:
            dni_limpio = "".join(filter(str.isdigit, str(dni)))
            if dni_limpio:
                datos_dni = geclisa_client.buscar_paciente_por_dni(dni_limpio)
                if datos_dni.get("encontrado") and datos_dni.get("ficha_id"):
                    ficha_id = int(datos_dni["ficha_id"])
                    if not paciente_nombre:
                        paciente_nombre = datos_dni.get("nombre_completo")
                    # Guardar ficha_id en Supabase si tenemos el ID del paciente en CRM
                    if paciente_crm_id and supabase:
                        try:
                            supabase.table("pacientes").update({"geclisa_ficha_id": ficha_id}).eq("id", paciente_crm_id).execute()
                            logger.info(f"Ficha #{ficha_id} auto-vinculada por DNI para paciente {paciente_crm_id}")
                        except Exception as err_upd:
                            logger.warning(f"No se pudo auto-vincular ficha #{ficha_id} en Supabase: {err_upd}")

        # 3. Si aún no tenemos ficha_id, retornar aviso amigable (encontrado: False con HTTP 200)
        if not ficha_id:
            if not dni:
                return {
                    "encontrado": False,
                    "motivo": "sin_dni",
                    "mensaje": "El paciente no posee número de DNI ni Ficha Geclisa registrada en el CRM."
                }
            else:
                return {
                    "encontrado": False,
                    "motivo": "sin_ficha_geclisa",
                    "mensaje": f"No se encontró ninguna historia clínica ni ficha activa en Geclisa para el DNI {dni}."
                }

        # 4. Consultar Historia Clínica Resumen en Geclisa
        resultado_hc = geclisa_client.obtener_historia_clinica_resumen(int(ficha_id))
        if not resultado_hc.get("encontrado"):
            return {
                "encontrado": False,
                "motivo": "no_encontrado_geclisa",
                "ficha_id": ficha_id,
                "mensaje": resultado_hc.get("mensaje") or "No se encontraron evoluciones en Geclisa."
            }

        return {
            "encontrado": True,
            "paciente_id": paciente_crm_id or paciente_id,
            "ficha_id": ficha_id,
            "paciente_nombre": paciente_nombre,
            "paciente_dni": dni,
            "fecha_generacion": resultado_hc.get("fecha_generacion"),
            "evoluciones_recientes": resultado_hc.get("evoluciones_recientes", []),
            "total_evoluciones": resultado_hc.get("total_evoluciones", 0)
        }

    except Exception as e:
        logger.error(f"Error al obtener historia clínica para paciente {paciente_id}: {e}")
        return {
            "encontrado": False,
            "motivo": "error_servidor",
            "mensaje": f"Error al consultar historia clínica en Geclisa: {str(e)}"
        }

@app.get("/api/geclisa/pacientes/{paciente_id}/indicaciones")
def obtener_indicaciones_paciente(paciente_id: str):
    """
    Consulta en vivo las indicaciones médicas, protocolos de medicación y recetas
    en Geclisa para el paciente indicado. Operación 100% de lectura on-demand.
    """
    try:
        ficha_id = None
        dni = None
        paciente_nombre = None
        paciente_crm_id = None

        # 1. Intentar buscar en Supabase (por UUID, DNI o ficha_id)
        if supabase:
            try:
                res_paciente = None
                if len(str(paciente_id)) == 36 and '-' in str(paciente_id):
                    res_paciente = supabase.table("pacientes").select("*").eq("id", paciente_id).execute()

                if not res_paciente or not res_paciente.data:
                    res_paciente = supabase.table("pacientes").select("*").ilike("dni", f"%{paciente_id}%").execute()

                if not res_paciente or not res_paciente.data:
                    if str(paciente_id).isdigit():
                        res_paciente = supabase.table("pacientes").select("*").eq("geclisa_ficha_id", int(paciente_id)).execute()

                if res_paciente and res_paciente.data and len(res_paciente.data) > 0:
                    paciente = res_paciente.data[0]
                    paciente_crm_id = paciente.get("id")
                    ficha_id = paciente.get("geclisa_ficha_id")
                    dni = paciente.get("dni")
                    paciente_nombre = paciente.get("nombre")
            except Exception as db_err:
                logger.warning(f"Aviso al consultar paciente en Supabase: {db_err}")

        # Fallback si paciente_id es directamente DNI o Ficha
        if not dni and not ficha_id:
            if str(paciente_id).isdigit():
                if len(str(paciente_id)) >= 7:
                    dni = str(paciente_id)
                else:
                    ficha_id = int(paciente_id)

        # 2. Si no tiene ficha_id pero tiene DNI, resolver por DNI contra Geclisa
        if not ficha_id and dni:
            dni_limpio = "".join(filter(str.isdigit, str(dni)))
            if dni_limpio:
                datos_dni = geclisa_client.buscar_paciente_por_dni(dni_limpio)
                if datos_dni.get("encontrado") and datos_dni.get("ficha_id"):
                    ficha_id = int(datos_dni["ficha_id"])
                    if not paciente_nombre:
                        paciente_nombre = datos_dni.get("nombre_completo")
                    if paciente_crm_id and supabase:
                        try:
                            supabase.table("pacientes").update({"geclisa_ficha_id": ficha_id}).eq("id", paciente_crm_id).execute()
                        except Exception as err_upd:
                            logger.warning(f"No se pudo auto-vincular ficha #{ficha_id} en Supabase: {err_upd}")

        if not ficha_id:
            if not dni:
                return {
                    "encontrado": False,
                    "motivo": "sin_dni",
                    "mensaje": "El paciente no posee número de DNI ni Ficha Geclisa registrada en el CRM."
                }
            else:
                return {
                    "encontrado": False,
                    "motivo": "sin_ficha_geclisa",
                    "mensaje": f"No se encontró ninguna ficha activa en Geclisa para el DNI {dni}."
                }

        # 3. Consultar Indicaciones Médicas en Geclisa
        resultado_ind = geclisa_client.obtener_indicaciones_medicas(int(ficha_id))
        return {
            "encontrado": True,
            "paciente_id": paciente_crm_id or paciente_id,
            "ficha_id": ficha_id,
            "paciente_nombre": paciente_nombre,
            "paciente_dni": dni,
            "indicaciones": resultado_ind.get("indicaciones", []),
            "total_indicaciones": resultado_ind.get("total_indicaciones", 0)
        }

    except Exception as e:
        logger.error(f"Error al obtener indicaciones para paciente {paciente_id}: {e}")
        return {
            "encontrado": False,
            "motivo": "error_servidor",
            "mensaje": f"Error al consultar indicaciones en Geclisa: {str(e)}"
        }

@app.put("/api/pacientes/{paciente_id}")
def actualizar_paciente_crm(paciente_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Actualiza directamente los datos de un paciente en el CRM (Supabase).
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos Supabase no conectada.")
        
    try:
        from app.services.phone_normalizer import normalize_phone_number
        
        datos_actualizar = {}
        if "nombre" in payload and payload["nombre"]:
            datos_actualizar["nombre"] = str(payload["nombre"]).strip()
        if "dni" in payload:
            datos_actualizar["dni"] = str(payload["dni"]).strip() if payload["dni"] else None
        if "geclisa_ficha_id" in payload:
            datos_actualizar["geclisa_ficha_id"] = int(payload["geclisa_ficha_id"]) if payload["geclisa_ficha_id"] else None
        if "nro_hc" in payload:
            datos_actualizar["nro_hc"] = str(payload["nro_hc"]).strip() if payload["nro_hc"] else None
        if "telefono" in payload and payload["telefono"]:
            raw_tel = str(payload["telefono"]).strip()
            datos_actualizar["telefono"] = normalize_phone_number(raw_tel) if not raw_tel.startswith("temp_") else raw_tel
        if "telefono_fijo" in payload:
            datos_actualizar["telefono_fijo"] = str(payload["telefono_fijo"]).strip() if payload["telefono_fijo"] else None
        if "email" in payload:
            datos_actualizar["email"] = str(payload["email"]).strip() if payload["email"] else None
        if "obra_social" in payload:
            datos_actualizar["obra_social"] = str(payload["obra_social"]).strip() if payload["obra_social"] else None
        if "plan_cobertura" in payload:
            datos_actualizar["plan_cobertura"] = str(payload["plan_cobertura"]).strip() if payload["plan_cobertura"] else None
        if "medico_cabecera" in payload:
            datos_actualizar["medico_cabecera"] = str(payload["medico_cabecera"]).strip() if payload["medico_cabecera"] else None
        if "medico_cabecera_id" in payload:
            datos_actualizar["medico_cabecera_id"] = int(payload["medico_cabecera_id"]) if payload["medico_cabecera_id"] else None
        if "medico_cabecera_nombre" in payload:
            datos_actualizar["medico_cabecera_nombre"] = str(payload["medico_cabecera_nombre"]).strip() if payload["medico_cabecera_nombre"] else None
        if "medico_cabecera_matricula" in payload:
            datos_actualizar["medico_cabecera_matricula"] = str(payload["medico_cabecera_matricula"]).strip() if payload["medico_cabecera_matricula"] else None
        if "medico_cabecera_especialidad" in payload:
            datos_actualizar["medico_cabecera_especialidad"] = str(payload["medico_cabecera_especialidad"]).strip() if payload["medico_cabecera_especialidad"] else None
        if "direccion" in payload:
            datos_actualizar["direccion"] = str(payload["direccion"]).strip() if payload["direccion"] else None
        if "fecha_nacimiento" in payload:
            datos_actualizar["fecha_nacimiento"] = str(payload["fecha_nacimiento"]).strip() if payload["fecha_nacimiento"] else None
        if "sexo" in payload:
            datos_actualizar["sexo"] = str(payload["sexo"]).strip() if payload["sexo"] else None
        if "historial_notas" in payload:
            datos_actualizar["historial_notas"] = str(payload["historial_notas"]) if payload["historial_notas"] is not None else None

        res = supabase.table("pacientes").update(datos_actualizar).eq("id", paciente_id).execute()
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail="Paciente no encontrado para actualizar.")

        paciente_actualizado = res.data[0]
        return {
            "success": True,
            "mensaje": f"Datos de {paciente_actualizado.get('nombre')} modificados correctamente.",
            "paciente": paciente_actualizado
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al actualizar paciente {paciente_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar paciente: {str(e)}")

@app.delete("/api/pacientes/{paciente_id}")
def eliminar_paciente_crm(paciente_id: str):
    """
    Elimina permanentemente a un paciente y todo su historial relacionado en cascada (conversaciones, mensajes, presupuestos).
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Base de datos Supabase no conectada.")
        
    try:
        # Verificar existencia
        check_p = supabase.table("pacientes").select("id, nombre").eq("id", paciente_id).execute()
        if not check_p.data or len(check_p.data) == 0:
            raise HTTPException(status_code=404, detail="Paciente no encontrado.")
            
        nombre_paciente = check_p.data[0].get("nombre", "Paciente")
        
        # Eliminar en Supabase (las claves foráneas en CASCADE borrarán conversaciones, mensajes y presupuestos)
        supabase.table("pacientes").delete().eq("id", paciente_id).execute()
        
        logger.info(f"Paciente {paciente_id} ({nombre_paciente}) eliminado con éxito en cascada.")
        return {
            "success": True,
            "mensaje": f"Expediente de {nombre_paciente} y todos sus registros asociados han sido eliminados correctamente."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al eliminar paciente {paciente_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al eliminar paciente: {str(e)}")


@app.get("/api/geclisa/prestadores/buscar")
def buscar_geclisa_prestadores(query: Optional[str] = ""):
    """
    Busca prestadores médicos en Geclisa por nombre, apellido o número de matrícula.
    Operación a demanda activada exclusivamente por la búsqueda del usuario.
    """
    try:
        prestadores = geclisa_client.buscar_prestadores(query or "")
        return {
            "success": True,
            "query": query,
            "total": len(prestadores),
            "prestadores": prestadores
        }
    except Exception as e:
        logger.error(f"Error al consultar prestadores en Geclisa: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar prestadores: {str(e)}")

@app.get("/api/geclisa/prestadores/{pre_id}")
def detalle_geclisa_prestador(pre_id: int):
    """
    Obtiene los datos detallados de un prestador específico por su preId de Geclisa.
    """
    try:
        prestador = geclisa_client.obtener_prestador_por_id(pre_id)
        return prestador
    except Exception as e:
        logger.error(f"Error al obtener detalle de prestador {pre_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar prestador: {str(e)}")

@app.patch("/api/pacientes/{paciente_id}/medico")
def asignar_medico_a_paciente(paciente_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Asigna o actualiza el médico de cabecera en la ficha del paciente en el CRM (Supabase).
    Payload esperado: { "pre_id": int | null, "nombre": str | null, "matricula": str | null, "especialidad": str | null }
    """
    try:
        paciente_actualizado = asignar_medico_paciente(paciente_id, payload)
        if not paciente_actualizado:
            raise HTTPException(status_code=404, detail="Paciente no encontrado o no se pudo actualizar.")
        return {
            "success": True,
            "mensaje": "Médico de cabecera asignado correctamente.",
            "paciente": paciente_actualizado
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al asignar médico a paciente {paciente_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al asignar médico: {str(e)}")


# ====================================================================
# ENDPOINTS REST: NOMENCLADORES PROPIOS DEL CRM (MULTI-MONEDA: ARS / USD)
# ====================================================================

@app.get("/api/nomencladores")
def get_all_nomencladores():
    """
    Lista todos los nomencladores configurados en el CRM.
    """
    try:
        data = list_nomencladores()
        return {"success": True, "nomencladores": data}
    except Exception as e:
        logger.error(f"Error al obtener nomencladores: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomencladores")
def crear_nuevo_nomenclador(payload: Dict[str, Any] = Body(...)):
    """
    Crea un nuevo nomenclador en el CRM (con moneda ARS o USD).
    """
    try:
        if not payload.get("nombre"):
            raise HTTPException(status_code=400, detail="El nombre del nomenclador es obligatorio.")
        creado = create_nomenclador(payload)
        return {"success": True, "mensaje": "Nomenclador creado exitosamente.", "nomenclador": creado}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al crear nomenclador: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/nomencladores/{nomenclador_id}")
def editar_nomenclador(nomenclador_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Actualiza datos de un nomenclador.
    """
    try:
        act = update_nomenclador(nomenclador_id, payload)
        return {"success": True, "mensaje": "Nomenclador actualizado.", "nomenclador": act}
    except Exception as e:
        logger.error(f"Error al actualizar nomenclador {nomenclador_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/nomencladores/{nomenclador_id}")
def borrar_nomenclador(nomenclador_id: str):
    """
    Elimina un nomenclador y todas sus prácticas asociadas.
    """
    try:
        ok = delete_nomenclador(nomenclador_id)
        return {"success": ok, "mensaje": "Nomenclador eliminado exitosamente."}
    except Exception as e:
        logger.error(f"Error al eliminar nomenclador {nomenclador_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nomenclador/practicas")
def get_practicas_nomenclador(
    nomenclador_id: Optional[str] = None,
    fecha: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Lista las prácticas resolviendo el arancel y moneda vigentes para la fecha.
    """
    try:
        res = list_practicas_con_arancel(
            nomenclador_id=nomenclador_id,
            fecha_consulta=fecha,
            q=q,
            limit=limit,
            offset=offset
        )
        return {"success": True, "total": res["total"], "practicas": res["practicas"]}
    except Exception as e:
        logger.error(f"Error al listar prácticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomenclador/practicas")
def guardar_practica(payload: Dict[str, Any] = Body(...)):
    """
    Crea o actualiza una práctica individual del catálogo.
    """
    try:
        if not payload.get("nomenclador_id") or not payload.get("codigo") or not payload.get("nombre"):
            raise HTTPException(status_code=400, detail="Nomenclador, código y nombre son obligatorios.")
        guardada = create_or_update_practica(payload)
        return {"success": True, "mensaje": "Práctica guardada correctamente.", "practica": guardada}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al guardar práctica: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/nomenclador/practicas/{practica_id}")
def borrar_practica(practica_id: str):
    """
    Elimina una práctica del catálogo.
    """
    try:
        ok = delete_practica(practica_id)
        return {"success": ok, "mensaje": "Práctica eliminada."}
    except Exception as e:
        logger.error(f"Error al eliminar práctica {practica_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomenclador/practicas/{practica_id}/arancel")
def agregar_arancel_vigencia(practica_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Registra un nuevo arancel con fecha de vigencia para una práctica.
    """
    try:
        if "precio" not in payload:
            raise HTTPException(status_code=400, detail="El precio es obligatorio.")
        nuevo_arancel = upsert_arancel_practica(practica_id, payload)
        return {"success": True, "mensaje": "Arancel con vigencia guardado.", "arancel": nuevo_arancel}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al registrar arancel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# BÚSQUEDA RÁPIDA MULTI-MONEDA PARA PRESUPUESTOS (NATIVO CRM)
# ====================================================================

@app.get("/api/nomenclador/buscar-presupuesto")
def buscar_para_presupuesto(q: Optional[str] = "", fecha: Optional[str] = None):
    """
    Búsqueda optimizada por texto para el modal de presupuestos con arancel vigente.
    """
    try:
        resultados = buscar_practicas_presupuesto(q=q or "", fecha_consulta=fecha)
        return {
            "success": True,
            "query": q,
            "total": len(resultados),
            "resultados": resultados
        }
    except Exception as e:
        logger.error(f"Error al buscar prácticas para presupuesto: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# IMPORTADOR Y EXPORTADOR MASIVO EXCEL (.XLSX / .CSV)
# ====================================================================

@app.post("/api/nomenclador/importar-excel")
async def importar_practicas_excel(
    file: UploadFile = File(...),
    nomenclador_id: str = Form(...),
    modo: str = Form("upsert"),
    default_vigencia_desde: Optional[str] = Form(None),
    default_vigencia_hasta: Optional[str] = Form(None),
    default_moneda: str = Form("ARS")
):
    """
    Procesa la importación masiva de prácticas y aranceles desde un archivo Excel o CSV.
    """
    try:
        nom = get_nomenclador_by_id(nomenclador_id)
        if not nom:
            raise HTTPException(status_code=404, detail="El Nomenclador de destino no existe.")
            
        moneda_nom = default_moneda or nom.get("moneda_default", "ARS")
        contents = await file.read()
        filename = (file.filename or "").lower()
        
        parsed_rows = []
        
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            
            headers = []
            for cell in sheet[1]:
                val = str(cell.value or "").strip().lower()
                headers.append(val)
                
            def get_col_idx(names):
                for name in names:
                    for i, h in enumerate(headers):
                        if name in h:
                            return i
                return -1
                
            col_cod = get_col_idx(["cod", "codigo", "código", "id"])
            col_nom = get_col_idx(["nom", "nombre", "practica", "práctica", "descripcion", "descripción"])
            col_cat = get_col_idx(["cat", "categoria", "categoría", "tipo", "rubro"])
            col_pre = get_col_idx(["pre", "precio", "arancel", "valor", "importe", "monto"])
            col_mon = get_col_idx(["mon", "moneda", "currency"])
            col_vdes = get_col_idx(["desde", "vigencia_desde", "inicio"])
            col_vhas = get_col_idx(["hasta", "vigencia_hasta", "fin"])
            
            if col_cod == -1 or col_nom == -1:
                raise HTTPException(status_code=400, detail="El archivo Excel debe contener al menos las columnas 'Código' y 'Nombre/Práctica'.")
                
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not row or not any(row):
                    continue
                codigo = str(row[col_cod] or "").strip()
                nombre = str(row[col_nom] or "").strip()
                if not codigo or not nombre:
                    continue
                    
                categoria = str(row[col_cat] or "General").strip() if col_cat != -1 and row[col_cat] else "General"
                precio = row[col_pre] if col_pre != -1 and row[col_pre] is not None else 0.0
                moneda = str(row[col_mon] or moneda_nom).strip().upper() if col_mon != -1 and row[col_mon] else moneda_nom
                
                v_desde = None
                if col_vdes != -1 and row[col_vdes]:
                    v_raw = row[col_vdes]
                    v_desde = v_raw.strftime("%Y-%m-%d") if hasattr(v_raw, "strftime") else str(v_raw).strip()
                    
                v_hasta = None
                if col_vhas != -1 and row[col_vhas]:
                    v_raw = row[col_vhas]
                    v_hasta = v_raw.strftime("%Y-%m-%d") if hasattr(v_raw, "strftime") else str(v_raw).strip()
                    
                parsed_rows.append({
                    "codigo": codigo,
                    "nombre": nombre,
                    "categoria": categoria,
                    "precio": precio,
                    "moneda": moneda,
                    "vigencia_desde": v_desde,
                    "vigencia_hasta": v_hasta
                })
        elif filename.endswith(".csv"):
            text_content = contents.decode("utf-8-sig", errors="ignore")
            delimiter = ";" if ";" in text_content[:200] else ","
            reader = csv.DictReader(text_content.splitlines(), delimiter=delimiter)
            
            for row in reader:
                norm_row = {k.strip().lower(): v for k, v in row.items() if k}
                codigo = norm_row.get("codigo") or norm_row.get("código") or norm_row.get("cod") or ""
                nombre = norm_row.get("nombre") or norm_row.get("practica") or norm_row.get("práctica") or norm_row.get("descripcion") or ""
                if not codigo or not nombre:
                    continue
                categoria = norm_row.get("categoria") or norm_row.get("categoría") or "General"
                precio = norm_row.get("precio") or norm_row.get("arancel") or norm_row.get("valor") or 0.0
                moneda = norm_row.get("moneda") or moneda_nom
                v_desde = norm_row.get("vigencia_desde") or norm_row.get("desde")
                v_hasta = norm_row.get("vigencia_hasta") or norm_row.get("hasta")
                
                parsed_rows.append({
                    "codigo": str(codigo).strip(),
                    "nombre": str(nombre).strip(),
                    "categoria": str(categoria).strip(),
                    "precio": precio,
                    "moneda": str(moneda).strip().upper(),
                    "vigencia_desde": v_desde,
                    "vigencia_hasta": v_hasta
                })
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado. Por favor sube un archivo .xlsx o .csv")
            
        if not parsed_rows:
            raise HTTPException(status_code=400, detail="No se encontraron filas con datos válidos en el archivo.")
            
        res_import = bulk_import_practicas_aranceles(
            nomenclador_id=nomenclador_id,
            rows=parsed_rows,
            modo=modo,
            default_vigencia_desde=default_vigencia_desde,
            default_vigencia_hasta=default_vigencia_hasta,
            default_moneda=moneda_nom
        )
        
        return {
            "success": True,
            "mensaje": f"Se procesaron {res_import['total_procesadas']} filas exitosamente ({res_import['insertadas']} aranceles actualizados).",
            "detalle": res_import
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al importar Excel: {e}")
        raise HTTPException(status_code=500, detail=f"Error durante la importación: {str(e)}")

@app.get("/api/nomenclador/descargar-plantilla")
def descargar_plantilla_excel():
    """
    Genera y descarga un archivo Excel .xlsx oficial con encabezados, instrucciones y filas de muestra en ARS y USD.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Nomenclador_Plantilla"
    
    headers = ["Codigo", "Nombre", "Categoria", "Precio", "Moneda", "Vigencia_Desde", "Vigencia_Hasta", "Descripcion"]
    ws.append(headers)
    
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        
    ejemplos = [
        ["420101", "Consulta Médica en Consultorio", "Consultas", 8500.00, "ARS", "2026-09-01", "2026-12-31", "Consulta ambulatoria general"],
        ["180104", "Ecografía Ginecológica / Tocoginecológica", "Diagnóstico", 22000.00, "ARS", "2026-09-01", "", "Ecografía pelviana transvaginal"],
        ["FIV-ICSI-01", "Tratamiento FIV + ICSI Alta Complejidad", "Fertilidad", 1500.00, "USD", "2026-09-01", "", "Incluye estimulación y laboratorio"],
        ["KIT-MED-02", "Kit de Medicación y Criopreservación", "Laboratorio", 450.00, "USD", "2026-09-01", "2027-03-01", "Mantenimiento anual"]
    ]
    
    for row in ejemplos:
        ws.append(row)
        
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
        
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    headers_resp = {
        "Content-Disposition": "attachment; filename=plantilla_nomenclador_crm.xlsx"
    }
    return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers_resp)

@app.get("/api/nomenclador/exportar-excel")
def exportar_nomenclador_excel(nomenclador_id: Optional[str] = None):
    """
    Exporta el catálogo completo o de un nomenclador específico a un archivo Excel .xlsx descargable.
    """
    try:
        res = list_practicas_con_arancel(nomenclador_id=nomenclador_id, limit=5000)
        practicas = res.get("practicas", [])
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Catalogo_Practicas"
        
        headers = ["Nomenclador", "Codigo", "Nombre", "Categoria", "Precio", "Moneda", "Vigencia_Desde", "Vigencia_Hasta", "Estado"]
        ws.append(headers)
        
        header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            
        for p in practicas:
            estado = "Activa" if p.get("activo") else "Inactiva"
            ws.append([
                p.get("nomenclador_nombre", ""),
                p.get("codigo", ""),
                p.get("nombre", ""),
                p.get("categoria", "General"),
                p.get("precio", 0.0),
                p.get("moneda", "ARS"),
                p.get("vigencia_desde", "") or "",
                p.get("vigencia_hasta", "") or "",
                estado
            ])
            
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        headers_resp = {
            "Content-Disposition": "attachment; filename=catalogo_nomencladores_crm.xlsx"
        }
        return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers_resp)
    except Exception as e:
        logger.error(f"Error al exportar Excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# ENDPOINTS REST: SISTEMA DE LOGS Y AUDITORÍA EN TIEMPO REAL
# ====================================================================

@app.get("/api/logs")
def consultar_logs_sistema(
    limit: int = 50,
    offset: int = 0,
    nivel: Optional[str] = None,
    modulo: Optional[str] = None,
    search: Optional[str] = None,
    paciente_id: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None
):
    """
    Retorna la lista paginada de logs y auditoría del sistema con filtros avanzados.
    """
    try:
        resultado = get_logs(
            limit=limit,
            offset=offset,
            nivel=nivel,
            modulo=modulo,
            search=search,
            paciente_id=paciente_id,
            desde=desde,
            hasta=hasta
        )
        return {
            "success": True,
            "logs": resultado.get("logs", []),
            "total": resultado.get("total", 0)
        }
    except Exception as e:
        logger.error(f"Error al consultar logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs/stats")
def obtener_estadisticas_logs():
    """
    Retorna métricas consolidadas de salud y volumen de eventos de las últimas 24 horas.
    """
    try:
        stats = get_logs_stats()
        return {"success": True, "stats": stats}
    except Exception as e:
        logger.error(f"Error al calcular estadísticas de logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/logs/client")
def registrar_log_desde_cliente(payload: Dict[str, Any] = Body(...)):
    """
    Permite al frontend registrar eventos o errores ocurridos en el navegador del usuario.
    """
    try:
        nivel = payload.get("nivel", "ERROR")
        modulo = payload.get("modulo", "FRONTEND")
        accion = payload.get("accion", "ERROR_CLIENTE")
        mensaje = payload.get("mensaje", "Error reportado desde la interfaz web")
        detalles = payload.get("detalles", {})
        duracion_ms = payload.get("duracion_ms")
        http_status = payload.get("http_status")
        trace = payload.get("trace")

        log_entry = log_event(
            nivel=nivel,
            modulo=modulo,
            accion=accion,
            mensaje=mensaje,
            detalles=detalles,
            duracion_ms=duracion_ms,
            http_status=http_status,
            trace=trace
        )
        return {"success": True, "log": log_entry}
    except Exception as e:
        logger.error(f"Error registrando log de cliente: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# ENDPOINTS: MÓDULO DE ASESORÍAS QUIRÚRGICAS (PIPELINE)
# ====================================================================

@app.get("/api/asesorias-quirurgicas/paciente/{paciente_id}")
def obtener_asesorias_paciente(paciente_id: str):
    """
    Retorna el listado de asesorías quirúrgicas de un paciente.
    """
    try:
        asesorias = get_asesorias_by_paciente(paciente_id)
        return {"success": True, "asesorias": asesorias}
    except Exception as e:
        logger.error(f"Error al obtener asesorías del paciente {paciente_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/asesorias-quirurgicas")
def crear_nueva_asesoria(payload: Dict[str, Any] = Body(...)):
    """
    Crea un nuevo caso de asesoramiento quirúrgico para un paciente.
    """
    if not payload.get("paciente_id"):
        raise HTTPException(status_code=400, detail="El ID del paciente es obligatorio.")
    try:
        asesoria = crear_asesoria_quirurgica(payload)
        return {"success": True, "mensaje": "Caso de asesoría quirúrgica registrado.", "asesoria": asesoria}
    except Exception as e:
        logger.error(f"Error al crear asesoría quirúrgica: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/asesorias-quirurgicas/{asesoria_id}")
def actualizar_asesoria(asesoria_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Actualiza estado, fechas, condiciones o notas de un caso quirúrgico.
    """
    try:
        asesoria = actualizar_asesoria_quirurgica(asesoria_id, payload)
        return {"success": True, "mensaje": "Caso quirúrgico actualizado.", "asesoria": asesoria}
    except Exception as e:
        logger.error(f"Error al actualizar asesoría {asesoria_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/asesorias-quirurgicas/{asesoria_id}")
def eliminar_asesoria(asesoria_id: str):
    """
    Elimina un caso de asesoría quirúrgica.
    """
    try:
        ok = eliminar_asesoria_quirurgica(asesoria_id)
        return {"success": ok, "mensaje": "Caso quirúrgico eliminado."}
    except Exception as e:
        logger.error(f"Error al eliminar asesoría {asesoria_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# ENDPOINTS: PRESUPUESTOS INTEGRADOS CON EXPEDIENTE DE PACIENTE
# ====================================================================

@app.get("/api/presupuestos/paciente/{paciente_id}")
def obtener_presupuestos_paciente(paciente_id: str):
    """
    Retorna el listado histórico de presupuestos emitidos a un paciente con sus ítems detallados.
    """
    try:
        presupuestos = get_presupuestos_by_paciente(paciente_id)
        return {"success": True, "presupuestos": presupuestos}
    except Exception as e:
        logger.error(f"Error al obtener presupuestos del paciente {paciente_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/presupuestos/{presupuesto_id}/estado")
def actualizar_estado_presupuesto(presupuesto_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Actualiza el estado de un presupuesto ('borrador', 'enviado', 'aprobado', 'rechazado')
    y sincroniza automáticamente el caso quirúrgico vinculado.
    """
    nuevo_estado = payload.get("estado")
    asesoria_id = payload.get("asesoria_id")
    if not nuevo_estado:
        raise HTTPException(status_code=400, detail="El nuevo estado es obligatorio.")
    try:
        presupuesto = cambiar_estado_presupuesto(presupuesto_id, nuevo_estado, asesoria_id)
        return {
            "success": True, 
            "mensaje": f"Presupuesto marcado como {nuevo_estado}.",
            "presupuesto": presupuesto
        }
    except Exception as e:
        logger.error(f"Error al actualizar estado del presupuesto {presupuesto_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/presupuestos/crear-rapido")
def emitir_presupuesto_rapido(payload: Dict[str, Any] = Body(...)):
    """
    Crea un presupuesto con ítems, calcula el total, genera el PDF membretado oficial del CRM
    y vincula el resultado al paciente y su caso quirúrgico.
    """
    if not payload.get("paciente_id"):
        raise HTTPException(status_code=400, detail="El ID del paciente es obligatorio.")
    if not payload.get("items") or len(payload["items"]) == 0:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un ítem o prestación.")
    try:
        presupuesto = crear_presupuesto_rapido(payload)
        return {
            "success": True,
            "mensaje": "Presupuesto médico emitido y PDF generado correctamente.",
            "presupuesto": presupuesto
        }
    except Exception as e:
        logger.error(f"Error al emitir presupuesto rápido: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/presupuestos/{presupuesto_id}/pdf")
def obtener_pdf_presupuesto(presupuesto_id: str):
    """
    Sirve el archivo PDF membretado oficial de un presupuesto directamente como stream / descarga.
    """
    return servir_archivo_estatico(f"presupuesto_{presupuesto_id}.pdf")

# ====================================================================
# ENDPOINTS: BITÁCORA Y EVOLUCIONES DE ASESORAMIENTO QUIRÚRGICO
# ====================================================================

@app.get("/api/asesorias-quirurgicas/{asesoria_id}/evoluciones")
def listar_evoluciones_asesoria(asesoria_id: str):
    """
    Retorna el historial cronológico de notas de evolución de un caso quirúrgico.
    """
    try:
        evoluciones = get_evoluciones_by_asesoria(asesoria_id)
        return {"success": True, "evoluciones": evoluciones}
    except Exception as e:
        logger.error(f"Error al listar evoluciones de asesoría {asesoria_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/asesorias-quirurgicas/{asesoria_id}/evoluciones")
def registrar_evolucion_asesoria(asesoria_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Registra una nueva evolución en la bitácora del asesoramiento quirúrgico.
    """
    if not payload.get("paciente_id"):
        raise HTTPException(status_code=400, detail="El ID del paciente es obligatorio.")
    if not payload.get("contenido") or not str(payload["contenido"]).strip():
        raise HTTPException(status_code=400, detail="El contenido de la evolución no puede estar vacío.")
    try:
        payload["asesoria_id"] = asesoria_id
        evolucion = crear_evolucion_asesoria(payload)
        return {
            "success": True,
            "mensaje": "Nota de evolución registrada correctamente.",
            "evolucion": evolucion
        }
    except Exception as e:
        logger.error(f"Error al registrar evolución de asesoría {asesoria_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/asesorias-quirurgicas/evoluciones/{evolucion_id}")
def borrar_evolucion_asesoria(evolucion_id: str):
    """
    Elimina una nota de evolución por su ID.
    """
    try:
        ok = eliminar_evolucion_asesoria(evolucion_id)
        return {"success": ok, "mensaje": "Evolución eliminada."}
    except Exception as e:
        logger.error(f"Error al eliminar evolución {evolucion_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# ENDPOINTS: CONFIGURACIÓN QUIRÚRGICA & PIPELINE LEAD-TO-SURGERY
# ====================================================================

@app.get("/api/configuracion-quirurgica")
def obtener_config_quirurgica():
    """
    Retorna la configuración de SLA, plantillas WhatsApp y checklist quirúrgico.
    """
    try:
        config = get_configuracion_quirurgica()
        return {"success": True, "configuracion": config}
    except Exception as e:
        logger.error(f"Error al obtener configuración quirúrgica: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/configuracion-quirurgica")
def guardar_config_quirurgica(payload: Dict[str, Any] = Body(...)):
    """
    Actualiza la configuración de SLA, plantillas de WhatsApp o checklist.
    """
    try:
        config = actualizar_configuracion_quirurgica(payload)
        return {"success": True, "mensaje": "Configuración guardada correctamente.", "configuracion": config}
    except Exception as e:
        logger.error(f"Error al guardar configuración quirúrgica: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pipeline-quirurgico")
def obtener_pipeline():
    """
    Retorna el tablero global Kanban de cirugías por etapa con KPIs de ingresos.
    """
    try:
        data = get_pipeline_quirurgico()
        return {"success": True, **data}
    except Exception as e:
        logger.error(f"Error al obtener pipeline quirúrgico: {e}")
        raise HTTPException(status_code=500, detail=str(e))
