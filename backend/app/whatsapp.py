import logging
import os
import threading
from dotenv import load_dotenv

# Dependencias del Daemon de WhatsApp
try:
    from neonize.client import NewClient
    from neonize.events import MessageEv
    NEONIZE_AVAILABLE = True
except ImportError:
    NEONIZE_AVAILABLE = False

from app.db import get_paciente_by_telefono, crear_paciente, get_or_create_conversacion, guardar_mensaje
from app.agent import procesar_mensaje_agente

load_dotenv()
logger = logging.getLogger(__name__)

# Instancia global del cliente de WhatsApp
whatsapp_client = None

def get_texto_mensaje(event) -> str:
    """
    Extrae el contenido de texto de un evento MessageEv de neonize.
    """
    if not event.Message:
        return ""
    
    # Mensaje de conversación simple
    if event.Message.conversation:
        return event.Message.conversation
        
    # Mensaje de texto extendido (ej: links, respuestas)
    if event.Message.extendedTextMessage and event.Message.extendedTextMessage.text:
        return event.Message.extendedTextMessage.text
        
    return ""

def handle_incoming_whatsapp_message(c, event):
    """
    Manejador principal de mensajes de WhatsApp.
    """
    try:
        sender_jid = event.Info.Sender
        # Extraer el teléfono del JID (ej: 5491123456789@s.whatsapp.net -> 5491123456789)
        telefono = sender_jid.split("@")[0]
        
        mensaje_texto = get_texto_mensaje(event)
        if not mensaje_texto:
            return
            
        logger.info(f"Mensaje de WhatsApp recibido de {telefono}: {mensaje_texto}")
        
        # 1. Obtener o crear paciente
        paciente = get_paciente_by_telefono(telefono)
        if not paciente:
            nombre_defecto = f"Paciente {telefono[-4:]}"
            logger.info(f"Paciente no encontrado en BD. Creando paciente: {nombre_defecto}")
            paciente = crear_paciente(telefono=telefono, nombre=nombre_defecto)
            if not paciente:
                logger.error("No se pudo crear el paciente en base de datos.")
                return

        paciente_id = paciente["id"]
        
        # 2. Obtener o crear conversación
        conversacion = get_or_create_conversacion(paciente_id)
        if not conversacion:
            logger.error(f"No se pudo crear o recuperar la conversación del paciente {paciente_id}")
            return
            
        conversacion_id = conversacion["id"]
        bot_disabled = conversacion.get("bot_disabled", False)

        # 3. Si el bot está desactivado (atención humana), ignoramos el procesamiento automático
        if bot_disabled:
            logger.info(f"Conversación {conversacion_id} tiene bot_disabled=True. Guardando mensaje e ignorando respuesta automática.")
            # Guardamos el mensaje enviado por el paciente para que el operador lo lea en tiempo real en el CRM
            guardar_mensaje(conversacion_id, "paciente", mensaje_texto)
            return

        # 4. Guardar el mensaje del paciente en la base de datos
        guardar_mensaje(conversacion_id, "paciente", mensaje_texto)

        # 5. Procesar con el agente agéntico de Gemini
        respuesta_agente = procesar_mensaje_agente(
            conversacion_id=conversacion_id,
            paciente_id=paciente_id,
            mensaje_texto=mensaje_texto
        )

        # 6. Enviar la respuesta de vuelta al paciente vía WhatsApp
        logger.info(f"Enviando respuesta automática a {telefono}: {respuesta_agente}")
        c.send_message(sender_jid, respuesta_agente)

    except Exception as e:
        logger.error(f"Error procesando evento MessageEv de WhatsApp: {e}", exc_info=True)

def iniciar_daemon_whatsapp():
    """
    Inicializa y conecta el daemon de WhatsApp en un hilo secundario para no bloquear FastAPI.
    """
    global whatsapp_client
    
    if not NEONIZE_AVAILABLE:
        logger.warning("Neonize no está instalado en el sistema. Ejecutando en modo SIMULADO.")
        return
        
    try:
        db_path = os.getenv("NEONIZE_DB_PATH", "./neonize.db")
        logger.info(f"Inicializando cliente de WhatsApp (Neonize) en {db_path}...")
        
        # Crear cliente Neonize
        whatsapp_client = NewClient(db_path)
        
        # Registrar eventos
        @whatsapp_client.event(MessageEv)
        def on_message(c, event):
            handle_incoming_whatsapp_message(c, event)
            
        # Iniciar conexión en segundo plano
        def run_client():
            try:
                whatsapp_client.connect()
            except Exception as e:
                logger.error(f"Error en la conexión del daemon de WhatsApp: {e}")
                
        thread = threading.Thread(target=run_client, daemon=True)
        thread.start()
        logger.info("Daemon de WhatsApp iniciado en segundo plano.")
        
    except Exception as e:
        logger.error(f"Error al iniciar el daemon de WhatsApp: {e}")
