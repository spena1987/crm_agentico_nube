import os
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager

from fastapi.responses import Response, StreamingResponse
import io
import csv
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.db import (
    supabase, 
    actualizar_bot_disabled,
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
    bulk_import_practicas_aranceles
)
from app.agent import procesar_mensaje_agente
from app.services.phone_normalizer import normalize_phone_number
from app.whatsapp import (
    iniciar_daemon_whatsapp, 
    whatsapp_manager
)
from app.services.pdf_service import PDF_DIR
from app.services.media_service import media_service, STATIC_MEDIA_DIR
from app.services.tools import crear_borrador_presupuesto
from app.services.config_service import load_settings, save_settings
from app.services.geclisa_client import GeclisaClient

geclisa_client = GeclisaClient()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

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

class TestMessageRequest(BaseModel):
    telefono: str
    mensaje: Optional[str] = "¡Hola desde MedCRM! Prueba de vinculación exitosa. 🩺"

# Ciclo de vida de la aplicación FastAPI
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicación CRM Médico + WhatsApp Baileys Gateway...")
    iniciar_daemon_whatsapp()
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

# Servir archivos estáticos (PDFs de presupuestos)
app.mount("/static", StaticFiles(directory=PDF_DIR), name="static")

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

class PairCodeRequest(BaseModel):
    telefono: str

@app.post("/api/whatsapp/pair-code")
def request_pair_code(req: PairCodeRequest):
    """
    Genera un código de 8 caracteres (XXXX-XXXX) para vincular ingresando el número de teléfono.
    """
    logger.info(f"Petición de código de vinculación para teléfono: {req.telefono}")
    result = whatsapp_manager.solicitar_codigo_vinculacion(req.telefono)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

class IncomingWebhookMessage(BaseModel):
    message_id: Optional[str] = None
    from_me: bool = False
    phone: str
    jid: Optional[str] = None
    name: Optional[str] = "Paciente"
    text: str = ""
    message_type: str = "text"
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

        # 3. Guardar mensaje entrante del paciente
        guardar_mensaje(
            conversacion_id=conversacion_id,
            emisor="paciente",
            contenido=texto or f"[{payload.message_type.upper()}]",
            metadata_json={"whatsapp_message_id": payload.message_id, "whatsapp_lid": payload.phone if is_lid_number(payload.phone) else None}
        )

        # 4. Procesar agente IA si el bot no está desactivado para esta conversación
        bot_disabled = conversacion.get("bot_disabled", False) if isinstance(conversacion, dict) else False
        if not bot_disabled and texto:
            try:
                respuesta_agente = procesar_mensaje_agente(conversacion_id=conversacion_id, mensaje_texto_o_paciente_id=texto)
                if respuesta_agente:
                    whatsapp_manager.enviar_mensaje(clean_phone, respuesta_agente, conversacion_id=conversacion_id)
            except Exception as agent_err:
                logger.error(f"Error procesando respuesta de agente IA: {agent_err}")

        return {"status": "processed", "conversacion_id": conversacion_id, "telefono": clean_phone}
    except Exception as e:
        logger.error(f"Error procesando mensaje entrante Baileys: {e}", exc_info=True)
        return {"status": "error", "detail": str(e)}

@app.get("/api/conversaciones")
def get_conversaciones_api():
    """
    Retorna la lista de todas las conversaciones activas con sus pacientes asociados.
    """
    return obtener_conversaciones()

@app.get("/api/conversaciones/{conversacion_id}/mensajes")
def get_mensajes_conversacion_api(conversacion_id: str):
    """
    Retorna todo el historial de mensajes de una conversación específica.
    """
    return obtener_mensajes_conversacion(conversacion_id)

@app.post("/api/whatsapp/send-message")
def send_message_api(payload: SendMessageRequest):
    """
    Envía un mensaje de texto directamente al WhatsApp real del paciente y lo guarda en la BD.
    """
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

    logger.info(f"Enviando mensaje saliente a {telefono_final} (conversacion_id: {payload.conversacion_id})")
    result = whatsapp_manager.enviar_mensaje(
        telefono_o_jid=telefono_final,
        texto=payload.mensaje,
        conversacion_id=payload.conversacion_id
    )
    if "error" in result and not result.get("guardado_db"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result

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
    logger.info(f"API: Enviando archivo {file.filename} a {telefono}")
    try:
        content = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        original_name = file.filename or "archivo"
        
        subfolder = "images" if "image" in mime_type else "documents"
        saved = media_service.save_media_bytes(
            data=content,
            subfolder=subfolder,
            mime_type=mime_type,
            original_filename=original_name,
            prefix="crm_out"
        )
        
        # Enviar vía WhatsApp
        result = whatsapp_manager.enviar_documento(
            telefono_o_jid=telefono,
            filepath=saved["file_path"],
            filename=original_name,
            caption=caption or "",
            conversacion_id=conversacion_id
        )
        
        return {
            "success": True,
            "media": saved,
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


