import os
import logging
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager

from app.db import supabase, actualizar_bot_disabled
from app.whatsapp import iniciar_daemon_whatsapp, NEONIZE_AVAILABLE, handle_incoming_whatsapp_message
from app.services.pdf_service import PDF_DIR
from app.services.tools import crear_borrador_presupuesto
from typing import List

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
    cantidad: int

class PresupuestoInput(BaseModel):
    paciente_id: str
    items: List[ItemPresupuestoInput]

# Orquestación del ciclo de vida de la aplicación
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Código de inicialización al arrancar
    logger.info("Iniciando aplicación CRM Médico...")
    iniciar_daemon_whatsapp()
    yield
    # Código de finalización al detener
    logger.info("Deteniendo aplicación CRM Médico...")

app = FastAPI(
    title="CRM Médico API + Bot WhatsApp Gemini",
    description="Backend en FastAPI para gestionar la clínica y orquestar el agente de WhatsApp.",
    version="1.0.0",
    lifespan=lifespan
)

# Configuración de CORS para permitir peticiones desde el frontend Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción cambiar por la URL del frontend en Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos (PDFs de presupuestos) generados por el sistema
app.mount("/static", StaticFiles(directory=PDF_DIR), name="static")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "servicio": "CRM Médico API",
        "whatsapp_daemon": "disponible" if NEONIZE_AVAILABLE else "no_instalado (modo simulado activo)",
        "pdf_storage_dir": PDF_DIR
    }

@app.get("/api/health")
def health_check():
    # Verificar conexión con Supabase
    supabase_ok = False
    if supabase:
        try:
            supabase.table("servicios_precios").select("id").limit(1).execute()
            supabase_ok = True
        except Exception:
            pass
            
    return {
        "api": "ok",
        "supabase": "conectado" if supabase_ok else "desconectado",
        "whatsapp_daemon": "conectado" if NEONIZE_AVAILABLE else "simulado"
    }

@app.post("/api/conversaciones/{conversacion_id}/toggle-bot")
def toggle_bot(conversacion_id: str, payload: ToggleBotRequest):
    """
    Habilita o deshabilita la atención del bot automático en una conversación.
    """
    logger.info(f"Petición para alternar bot en conversación {conversacion_id} a {payload.bot_disabled}")
    res = actualizar_bot_disabled(conversacion_id, payload.bot_disabled)
    if not res:
        raise HTTPException(status_code=404, detail="Conversación no encontrada.")
    return {"success": True, "conversacion": res}

# Endpoint útil para probar el comportamiento de Gemini y Supabase sin depender de escanear el QR de WhatsApp
@app.post("/api/simulate-message")
def simulate_message(payload: SimuladorMensaje):
    """
    Simula la llegada de un mensaje de WhatsApp para pruebas locales sin QR.
    """
    logger.info(f"Simulando mensaje entrante de {payload.telefono}: {payload.mensaje}")
    
    # Crear un objeto que simule la estructura del evento MessageEv de Neonize
    class MockInfo:
        def __init__(self, sender):
            self.Sender = sender

    class MockConversationMessage:
        def __init__(self, text):
            self.conversation = text
            self.extendedTextMessage = None

    class MockEvent:
        def __init__(self, sender, text):
            self.Info = MockInfo(sender)
            self.Message = MockConversationMessage(text)

    # El JID de WhatsApp simula ser telefono@s.whatsapp.net
    mock_jid = f"{payload.telefono}@s.whatsapp.net"
    mock_event = MockEvent(mock_jid, payload.mensaje)

    # Creamos un cliente simulador que imprima el envío de mensajes de vuelta
    class MockClient:
        def send_message(self, jid, text):
            logger.info(f"[SIMULACIÓN WHATSAPP] ENVIANDO A {jid}: {text}")
            # Guardamos el mensaje saliente del Bot en la base de datos para simular respuesta completa
            # Buscando la conversación
            try:
                if supabase:
                    paciente = supabase.table("pacientes").select("id").eq("telefono", payload.telefono).execute()
                    if paciente.data:
                        pac_id = paciente.data[0]["id"]
                        conv = supabase.table("conversaciones").select("id").eq("paciente_id", pac_id).execute()
                        if conv.data:
                            # El agente ya guarda el mensaje, pero por si acaso confirmamos el flujo simulado
                            pass
            except Exception as e:
                logger.error(f"Error en simulación: {e}")
            return {"status": "sent", "to": jid, "content": text}

    mock_client = MockClient()
    handle_incoming_whatsapp_message(mock_client, mock_event)
    
    return {
        "success": True,
        "mensaje": f"Mensaje procesado para el teléfono {payload.telefono}."
    }

@app.post("/api/presupuestos")
def create_presupuesto_api(payload: PresupuestoInput):
    """
    Crea un presupuesto para un paciente y genera el PDF correspondiente.
    """
    logger.info(f"API: Crear presupuesto para paciente {payload.paciente_id}")
    items_parsed = [{"codigo_servicio": it.codigo_servicio, "cantidad": it.cantidad} for it in payload.items]
    res = crear_borrador_presupuesto(payload.paciente_id, items_parsed)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

