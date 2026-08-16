import os
import json
import logging
from typing import Optional, List, Dict, Any
from google import genai
from google.genai import types
from dotenv import load_dotenv

from app.db import supabase, guardar_mensaje
from app.services.tools import buscar_disponibilidad_turnos, crear_borrador_presupuesto, escalar_a_operador_humano

load_dotenv()
logger = logging.getLogger(__name__)

# Inicializar cliente oficial google-genai
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.warning("Falta GEMINI_API_KEY. El motor del agente de Gemini no podrá procesar consultas.")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Prompt de Sistema para el rol administrativo
SYSTEM_PROMPT = """
Eres el Asistente Virtual Inteligente de la 'Clínica Médica Nube'.
Tu rol es puramente administrativo y de soporte al paciente:
1. Gestión y coordinación de turnos médicos (puedes buscar disponibilidad usando tus herramientas).
2. Cotización y creación de presupuestos médicos para prestaciones o consultas.
3. Ayuda general con horarios de atención, dirección y especialidades de la clínica.

NORMAS CRÍTICAS DE COMPORTAMIENTO:
- NO des bajo ninguna circunstancia diagnósticos médicos, interpretaciones de síntomas o prescripciones farmacológicas. Si el paciente realiza consultas clínicas o de salud, dile amablemente que no estás capacitado y que lo transferirás con un profesional de la salud. A continuación, utiliza la herramienta `escalar_a_operador_humano` indicando el motivo.
- Si el paciente requiere hablar con un ser humano o expresa frustración o enojo, invoca de inmediato `escalar_a_operador_humano` con el motivo respectivo.
- Para crear un presupuesto, necesitas obligatoriamente el código del servicio o prestación (ej. 'CON-001'). Pide esta información o consúltala.
- Sé cordial, profesional y conciso en tus respuestas.
"""

# Mapeo de herramientas ejecutables
TOOLS_MAP = {
    "buscar_disponibilidad_turnos": buscar_disponibilidad_turnos,
    "crear_borrador_presupuesto": crear_borrador_presupuesto,
    "escalar_a_operador_humano": escalar_a_operador_humano
}

def procesar_mensaje_agente(conversacion_id: str, mensaje_texto_o_paciente_id: str, mensaje_texto: Optional[str] = None, guardar_en_db: bool = False) -> str:
    """
    Orquesta el flujo de interacción del paciente con el Agente de Gemini,
    incluyendo la recuperación de historial, llamada a herramientas (Function Calling)
    y persistencia de las respuestas del modelo.
    Soporta:
      - procesar_mensaje_agente(conversacion_id, texto)
      - procesar_mensaje_agente(conversacion_id, paciente_id, texto)
    """
    if not client:
        return "El servicio del agente inteligente no está disponible en este momento."

    if mensaje_texto is not None:
        paciente_id = mensaje_texto_o_paciente_id
        final_texto = mensaje_texto
    else:
        final_texto = mensaje_texto_o_paciente_id
        paciente_id = None
        if supabase and conversacion_id:
            try:
                conv = supabase.table("conversaciones").select("paciente_id").eq("id", conversacion_id).execute()
                if conv.data and len(conv.data) > 0:
                    paciente_id = conv.data[0].get("paciente_id")
            except Exception:
                pass

    try:
        # 1. Recuperar historial de mensajes recientes (últimos 10 mensajes)
        historial_data = []
        if supabase:
            resp = supabase.table("mensajes").select("*").eq("conversacion_id", conversacion_id).order("created_at", desc=True).limit(10).execute()
            if resp.data:
                # Reversar para orden cronológico
                historial_data = list(reversed(resp.data))

        # 2. Formatear historial para Gemini (SDK google-genai espera una lista de types.Content)
        contents = []
        for h in historial_data:
            role = "user" if h["emisor"] == "paciente" else "model"
            # Ignorar mensajes internos de sistema
            if h.get("metadata_json", {}).get("sistema"):
                continue
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=h["contenido"])]
                )
            )

        # 3. Adjuntar el nuevo mensaje del usuario
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=final_texto)]
            )
        )

        # 4. Configurar herramientas y prompt de sistema
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=[buscar_disponibilidad_turnos, crear_borrador_presupuesto, escalar_a_operador_humano],
            temperature=0.2, # Baja temperatura para mayor precisión y consistencia en el rol
        )

        # 5. Ejecutar consulta inicial
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config
        )

        # 6. Loop de Function Calling (Soporta múltiples ejecuciones secuenciales en caso de que Gemini lo pida)
        intentos = 0
        max_intentos = 5
        
        while response.function_calls and intentos < max_intentos:
            intentos += 1
            tool_responses = []
            
            # Procesar cada llamada pedida por Gemini
            for call in response.function_calls:
                func_name = call.name
                func_args = call.args
                call_id = call.id
                
                logger.info(f"Gemini solicita ejecutar la función: {func_name} con argumentos: {func_args}")
                
                # Ejecutar la función localmente
                if func_name in TOOLS_MAP:
                    try:
                        # Si es presupuesto, inyectamos el paciente_id directamente por seguridad
                        if func_name == "crear_borrador_presupuesto" and paciente_id:
                            func_args["paciente_id"] = paciente_id
                        
                        resultado = TOOLS_MAP[func_name](**func_args)
                    except Exception as err:
                        logger.error(f"Error ejecutando la función {func_name}: {err}")
                        resultado = {"error": f"Falla de ejecución: {str(err)}"}
                else:
                    resultado = {"error": f"Función '{func_name}' no soportada."}

                logger.info(f"Resultado de la función {func_name}: {resultado}")
                
                # Formatear la respuesta de la función para el SDK
                tool_responses.append(
                    types.Part.from_function_response(
                        name=func_name,
                        response={"result": resultado}
                    )
                )
            
            # Enviar el resultado de las herramientas de vuelta a Gemini para continuar el razonamiento
            contents.append(response.candidates[0].content)
            contents.append(types.Content(role="tool", parts=tool_responses))
            
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )

        # 7. Obtener la respuesta final
        respuesta_final = response.text
        if not respuesta_final:
            respuesta_final = "He procesado tu solicitud de manera interna, ¿en qué más puedo ayudarte?"

        # El guardado en base de datos lo realiza whatsapp_manager.enviar_mensaje(...)
        # con su respectivo whatsapp_message_id y emisor="bot" para evitar duplicaciones.
        if guardar_en_db:
            guardar_mensaje(conversacion_id=conversacion_id, emisor="bot", contenido=respuesta_final)
        
        return respuesta_final

    except Exception as e:
        logger.error(f"Error procesando mensaje en agente: {e}", exc_info=True)
        return "Disculpas, he tenido un inconveniente procesando tu mensaje. Por favor intenta de nuevo."

def transcribir_audio_con_gemini(audio_url: str) -> str:
    """
    Descarga el audio desde la URL de Supabase Storage y lo transcribe usando Gemini Flash.
    """
    if not client:
        raise ValueError("Cliente Gemini no configurado. Verifique GEMINI_API_KEY.")
    
    import httpx
    try:
        logger.info(f"Descargando audio para transcripción desde: {audio_url}")
        res = httpx.get(audio_url, timeout=35.0, follow_redirects=True)
        res.raise_for_status()
        audio_bytes = res.content
        
        # Determinar MIME type
        mime_type = res.headers.get("content-type", "audio/ogg")
        if "ogg" in audio_url.lower() or "opus" in str(mime_type).lower():
            mime_type = "audio/ogg"
        elif "mp3" in audio_url.lower():
            mime_type = "audio/mp3"
        elif "wav" in audio_url.lower():
            mime_type = "audio/wav"
        elif "m4a" in audio_url.lower() or "aac" in audio_url.lower():
            mime_type = "audio/mp4"

        prompt = (
            "Transcribe este mensaje de voz de un paciente exactamente palabra por palabra en español. "
            "No agregues comentarios, no inventes palabras, no interpretes síntomas, "
            "únicamente devuelve el texto exacto que dijo la persona."
        )

        candidate_models = [
            os.getenv("GEMINI_TRANSCRIPTION_MODEL", "gemini-flash-latest"),
            "gemini-3.5-flash",
            "gemini-flash-lite-latest"
        ]

        last_err = None
        for model_name in candidate_models:
            try:
                response_gemini = client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(
                            data=audio_bytes,
                            mime_type=mime_type
                        ),
                        prompt
                    ]
                )
                texto_transcrito = (response_gemini.text or "").strip()
                logger.info(f"Transcripción generada con éxito ({len(texto_transcrito)} caracteres) usando {model_name}: {texto_transcrito[:60]}...")
                return texto_transcrito
            except Exception as model_err:
                logger.warning(f"Error con modelo {model_name} al transcribir audio: {model_err}")
                last_err = model_err

        if last_err:
            raise last_err

    except Exception as e:
        logger.error(f"Error durante la transcripción de audio con Gemini: {e}", exc_info=True)
        raise e

