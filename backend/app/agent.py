import os
import json
import time
import logging
from typing import Optional, List, Dict, Any
from google import genai
from google.genai import types
from dotenv import load_dotenv

from app.db import supabase, guardar_mensaje, get_paciente_contexto_360
from app.services.agent_orchestrator import orchestrator, AVAILABLE_TOOLS_MAP, formatear_texto_whatsapp
from app.services.logger_service import log_event

load_dotenv()
logger = logging.getLogger(__name__)

# Inicializar cliente oficial google-genai
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.warning("Falta GEMINI_API_KEY. El motor del agente de Gemini no podrá procesar consultas.")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

def procesar_mensaje_agente(
    conversacion_id: str, 
    mensaje_texto_o_paciente_id: str, 
    mensaje_texto: Optional[str] = None, 
    guardar_en_db: bool = False,
    agente_override_codigo: Optional[str] = None
) -> str:
    """
    Orquesta el flujo de interacción del paciente con el Agente Multi-Perfil de Gemini,
    incluyendo la recuperación de historial, selección dinámica de agente (Prompt Layering),
    llamada a herramientas (Function Calling) y persistencia de las respuestas.
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

    t_start = time.time()
    try:
        # 1. Recuperar contexto del paciente si está disponible
        paciente_info = None
        if paciente_id:
            try:
                paciente_info = get_paciente_contexto_360(paciente_id)
            except Exception as pe:
                logger.warning(f"No se pudo cargar ficha del paciente {paciente_id}: {pe}")

        # 2. Determinar el Agente Situacional activo (o usar override)
        if agente_override_codigo:
            active_agent = orchestrator.get_agent_by_code(agente_override_codigo)
        else:
            active_agent = orchestrator.determine_active_agent(
                conversacion_id=conversacion_id, 
                paciente_id=paciente_id, 
                mensaje_texto=final_texto
            )

        agent_code = active_agent.get("codigo", "GENERAL")
        agent_temp = float(active_agent.get("temperatura") or 0.2)
        system_instruction = orchestrator.compile_system_prompt(active_agent, paciente_info=paciente_info)
        agent_tools = orchestrator.get_agent_tools(active_agent)

        logger.info(f"Procesando mensaje con Agente: '{active_agent.get('nombre')}' ({agent_code}) | Temp: {agent_temp}")

        # 3. Recuperar historial de mensajes recientes (últimos 10 mensajes)
        historial_data = []
        if supabase and conversacion_id:
            try:
                resp = supabase.table("mensajes").select("*").eq("conversacion_id", conversacion_id).order("created_at", desc=True).limit(10).execute()
                if resp.data:
                    historial_data = list(reversed(resp.data))
            except Exception as he:
                logger.warning(f"Error recuperando historial para {conversacion_id}: {he}")

        # 4. Formatear y consolidar historial para Gemini (evitar roles duplicados consecutivos)
        raw_turns = []
        for h in historial_data:
            if h.get("metadata_json", {}).get("sistema"):
                continue
            contenido = (h.get("contenido") or "").strip()
            if not contenido:
                continue
            role = "user" if h.get("emisor") == "paciente" else "model"
            raw_turns.append({"role": role, "text": contenido})
        
        # Agregar el nuevo mensaje del usuario
        if final_texto and final_texto.strip():
            raw_turns.append({"role": "user", "text": final_texto.strip()})

        # Consolidar turnos consecutivos con el mismo rol (Gemini exige alternancia user/model)
        consolidated_turns = []
        for turn in raw_turns:
            if consolidated_turns and consolidated_turns[-1]["role"] == turn["role"]:
                consolidated_turns[-1]["text"] += f"\n{turn['text']}"
            else:
                consolidated_turns.append({"role": turn["role"], "text": turn["text"]})

        # Asegurar que el primer turno sea 'user' si hay historial
        while consolidated_turns and consolidated_turns[0]["role"] != "user":
            consolidated_turns.pop(0)

        contents = []
        for turn in consolidated_turns:
            contents.append(
                types.Content(
                    role=turn["role"],
                    parts=[types.Part.from_text(text=turn["text"])]
                )
            )

        if not contents:
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=final_texto or "Hola")]
                )
            ]

        # 5. Configurar generación con Directivas Dinámicas, Tools y thinking_budget=0
        thinking_conf = types.ThinkingConfig(thinking_budget=0) if hasattr(types, "ThinkingConfig") else None
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=agent_tools,
            temperature=agent_temp,
            thinking_config=thinking_conf
        )

        # 6. Ejecutar consulta inicial (con fallback ante fallas de historial o thought signature)
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
        except Exception as api_err:
            if "thought signature" in str(api_err).lower() or "invalid_argument" in str(api_err).lower():
                logger.warning(f"Reintentando consulta sin historial previo debido a thought signature error: {api_err}")
                contents_single = [
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=final_texto or "Hola")]
                    )
                ]
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents_single,
                    config=config
                )
            else:
                raise api_err

        # 8. Loop de Function Calling
        intentos = 0
        max_intentos = 5
        funciones_ejecutadas = []
        
        while response.function_calls and intentos < max_intentos:
            intentos += 1
            tool_responses = []
            
            for call in response.function_calls:
                func_name = call.name
                func_args = call.args
                call_id = call.id
                funciones_ejecutadas.append(func_name)
                
                logger.info(f"[{agent_code}] Gemini solicita función: {func_name} con args: {func_args}")
                
                if func_name in AVAILABLE_TOOLS_MAP:
                    try:
                        if func_name in ["crear_borrador_presupuesto", "aprobar_presupuesto", "consultar_presupuestos_paciente"] and paciente_id:
                            func_args["paciente_id"] = paciente_id
                        if func_name == "escalar_a_operador_humano" and conversacion_id:
                            func_args["conversacion_id"] = conversacion_id
                        
                        resultado = AVAILABLE_TOOLS_MAP[func_name](**func_args)
                    except Exception as err:
                        logger.error(f"Error ejecutando función {func_name}: {err}")
                        resultado = {"error": f"Falla de ejecución: {str(err)}"}
                else:
                    resultado = {"error": f"Función '{func_name}' no autorizada para el perfil {agent_code}."}

                logger.info(f"Resultado de función {func_name}: {resultado}")
                
                tool_responses.append(
                    types.Part.from_function_response(
                        name=func_name,
                        response={"result": resultado}
                    )
                )
            
            contents.append(response.candidates[0].content)
            contents.append(types.Content(role="tool", parts=tool_responses))
            
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )

        # 9. Obtener la respuesta final normalizada para WhatsApp
        raw_text = response.text or ""
        respuesta_final = formatear_texto_whatsapp(raw_text)
        if not respuesta_final:
            respuesta_final = "He procesado tu consulta de manera interna, ¿en qué más puedo ayudarte?"

        if guardar_en_db and conversacion_id:
            guardar_mensaje(conversacion_id=conversacion_id, emisor="bot", contenido=respuesta_final)
        duracion = int((time.time() - t_start) * 1000)
        log_event(
            nivel="INFO",
            modulo="IA_GEMINI",
            accion="GENERAR_RESPUESTA",
            mensaje=f"Respuesta generada por Gemini ({model_name} / {agent_code}) en {duracion}ms",
            detalles={
                "model": model_name,
                "mensaje_usuario": final_texto[:150] if final_texto else "",
                "respuesta_bot": respuesta_final[:200] if respuesta_final else "",
                "funciones_llamadas": funciones_ejecutadas,
                "conversacion_id": conversacion_id
            },
            duracion_ms=duracion,
            paciente_id=paciente_id
        )
        return respuesta_final

    except Exception as e:
        duracion = int((time.time() - t_start) * 1000)
        log_event(
            nivel="ERROR",
            modulo="IA_GEMINI",
            accion="ERROR_INFERENCIA_IA",
            mensaje=f"Error en inferencia de Gemini: {str(e)}",
            detalles={"conversacion_id": conversacion_id, "error": str(e), "mensaje_usuario": final_texto[:150] if final_texto else ""},
            duracion_ms=duracion,
            paciente_id=paciente_id
        )
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

