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

def bind_tools_to_context(
    raw_tools_map: Dict[str, Any], 
    enabled_names: List[str], 
    paciente_id: Optional[str] = None, 
    conversacion_id: Optional[str] = None,
    tracker: Optional[List[str]] = None
) -> List[Any]:
    """
    Crea closures tipadas que pre-vinculan paciente_id y conversacion_id
    para que Automatic Function Calling (AFC) de Gemini ejecute las herramientas
    de forma nativa y sin errores de firmas de pensamiento ni parámetros ausentes.
    Registra en tracker cualquier herramienta invocada por AFC en tiempo real.
    """
    bound_tools = []

    def record_call(fn_name: str):
        if tracker is not None and fn_name not in tracker:
            tracker.append(fn_name)

    for name in enabled_names:
        if name not in raw_tools_map:
            continue
        base_func = raw_tools_map[name]
        
        if name == "vincular_paciente_geclisa":
            def vincular_paciente_geclisa(dni: str) -> dict:
                """
                Consulta la API de Geclisa utilizando el DNI del paciente para verificar si ya posee
                ficha médica registrada en la clínica, y en caso afirmativo, vincula e importa sus datos
                directamente a la conversación del CRM. Si no existe, registra el DNI como nuevo paciente.
                
                Args:
                    dni: El número de DNI / Documento del paciente (solo dígitos).
                """
                record_call("vincular_paciente_geclisa")
                return base_func(dni=dni, conversacion_id=conversacion_id, paciente_id=paciente_id)
            vincular_paciente_geclisa.__doc__ = base_func.__doc__
            bound_tools.append(vincular_paciente_geclisa)
            
        elif name == "crear_borrador_presupuesto":
            def crear_borrador_presupuesto(items_presupuesto: List[dict], observaciones: Optional[str] = None) -> dict:
                """
                Crea un borrador de presupuesto para el paciente con las prácticas y cantidades solicitadas.
                """
                record_call("crear_borrador_presupuesto")
                return base_func(items_presupuesto=items_presupuesto, paciente_id=paciente_id, observaciones=observaciones)
            crear_borrador_presupuesto.__doc__ = base_func.__doc__
            bound_tools.append(crear_borrador_presupuesto)
            
        elif name == "aprobar_presupuesto":
            def aprobar_presupuesto(presupuesto_id: Optional[str] = None, notas: Optional[str] = None) -> dict:
                """
                Aprueba y confirma formalmente un presupuesto emitido al paciente cuando manifiesta su conformidad.
                """
                record_call("aprobar_presupuesto")
                return base_func(presupuesto_id=presupuesto_id, paciente_id=paciente_id, notas=notas)
            aprobar_presupuesto.__doc__ = base_func.__doc__
            bound_tools.append(aprobar_presupuesto)
            
        elif name == "consultar_presupuestos_paciente":
            def consultar_presupuestos_paciente() -> dict:
                """
                Consulta los presupuestos médicos emitidos al paciente en el sistema.
                """
                record_call("consultar_presupuestos_paciente")
                return base_func(paciente_id=paciente_id)
            consultar_presupuestos_paciente.__doc__ = base_func.__doc__
            bound_tools.append(consultar_presupuestos_paciente)
            
        elif name == "escalar_a_operador_humano":
            def escalar_a_operador_humano(motivo: str) -> dict:
                """
                Deriva la conversación a un operador humano de secretaría o equipo médico.
                """
                record_call("escalar_a_operador_humano")
                return base_func(conversacion_id=conversacion_id, motivo=motivo)
            escalar_a_operador_humano.__doc__ = base_func.__doc__
            bound_tools.append(escalar_a_operador_humano)

        elif name == "finalizar_y_cerrar_consulta":
            def finalizar_y_cerrar_consulta(motivo: str) -> dict:
                """
                Finaliza y archiva la conversación cuando el paciente cumplió su objetivo o se despide.
                """
                record_call("finalizar_y_cerrar_consulta")
                return base_func(conversacion_id=conversacion_id, motivo=motivo)
            finalizar_y_cerrar_consulta.__doc__ = base_func.__doc__
            bound_tools.append(finalizar_y_cerrar_consulta)
            
        else:
            def make_generic_wrapper(fn_name: str, fn_callable: Any):
                def generic_tool_wrapper(*args, **kwargs):
                    record_call(fn_name)
                    return fn_callable(*args, **kwargs)
                generic_tool_wrapper.__doc__ = fn_callable.__doc__
                generic_tool_wrapper.__name__ = getattr(fn_callable, "__name__", fn_name)
                return generic_tool_wrapper
            bound_tools.append(make_generic_wrapper(name, base_func))
            
    return bound_tools

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

    t_start = time.time()
    try:
        # 1. Recuperar contexto integral del paciente
        paciente_info = None
        if paciente_id:
            try:
                paciente_info = get_paciente_contexto_360(paciente_id)
            except Exception as pe:
                logger.warning(f"No se pudo cargar ficha del paciente {paciente_id}: {pe}")
        
        # 2. Seleccionar agente óptimo (Router Dinámico de Roles)
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
        
        habilitadas = active_agent.get("herramientas_habilitadas") or []
        if isinstance(habilitadas, str):
            try:
                habilitadas = json.loads(habilitadas)
            except Exception:
                habilitadas = list(AVAILABLE_TOOLS_MAP.keys())
                
        funciones_ejecutadas: List[str] = []
        bound_tools = bind_tools_to_context(
            raw_tools_map=AVAILABLE_TOOLS_MAP,
            enabled_names=habilitadas,
            paciente_id=paciente_id,
            conversacion_id=conversacion_id,
            tracker=funciones_ejecutadas
        )

        logger.info(f"Procesando mensaje con Agente: '{active_agent.get('nombre')}' ({agent_code}) | Temp: {agent_temp} | Tools: {len(bound_tools)}")

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
        
        # Agregar el nuevo mensaje del usuario solo si no fue ya el último mensaje del historial
        ultimo_texto_historial = (historial_data[-1].get("contenido") or "").strip() if historial_data else ""
        if final_texto and final_texto.strip() and ultimo_texto_historial != final_texto.strip():
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

        # 5. Configurar generación con Directivas Dinámicas y Tools vinculadas
        afc_config = types.AutomaticFunctionCallingConfig(maximum_remote_calls=3) if bound_tools else None
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=bound_tools if bound_tools else None,
            temperature=agent_temp,
            automatic_function_calling=afc_config
        )

        # 6. Ejecutar consulta inicial (con fallback multicapa resiliente)
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
        except Exception as api_err:
            logger.warning(f"Error en inferencia primaria ({api_err}). Ejecutando fallback con modelo alternativo...")
            try:
                # Reintento 1: Sin historial previo con tools vinculadas
                fallback_config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=bound_tools if bound_tools else None,
                    temperature=agent_temp,
                    automatic_function_calling=afc_config
                )
                contents_single = [
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=final_texto or "Hola")]
                    )
                ]
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents_single,
                    config=fallback_config
                )
            except Exception as fb_err:
                logger.error(f"Falla también en fallback secundario ({fb_err}). Intentando con modelo alternativo...")
                try:
                    alt_model = "gemini-3.7-flash" if model_name != "gemini-3.7-flash" else "gemini-3.5-flash"
                    fallback_config2 = types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=agent_temp
                    )
                    response = client.models.generate_content(
                        model=alt_model,
                        contents=final_texto or "Hola",
                        config=fallback_config2
                    )
                except Exception as final_err:
                    logger.critical(f"Falla crítica en todos los modelos de Gemini: {final_err}")
                    raise final_err

        # 7. Consolidar herramientas ejecutadas durante Automatic Function Calling (AFC)
        if hasattr(response, "automatic_function_calling_history") and response.automatic_function_calling_history:
            for item in response.automatic_function_calling_history:
                for part in getattr(item, "parts", []):
                    fn_call = getattr(part, "function_call", None)
                    if fn_call and getattr(fn_call, "name", None):
                        if fn_call.name not in funciones_ejecutadas:
                            funciones_ejecutadas.append(fn_call.name)

        # 8. Loop de Function Calling de Respaldo (por si AFC no resolvió en 1 solo paso)
        intentos = 0
        max_intentos = 3
        
        while response.function_calls and intentos < max_intentos:
            intentos += 1
            tool_responses = []
            
            for call in response.function_calls:
                func_name = call.name
                func_args = call.args or {}
                
                # Si es una función crítica que ya se ejecutó en este turno, no duplicar ejecución
                if func_name in funciones_ejecutadas and func_name in ["escalar_a_operador_humano", "finalizar_y_cerrar_consulta"]:
                    logger.info(f"[{agent_code}] Omitiendo re-ejecución en loop manual de {func_name} ya ejecutada.")
                    resultado = {"success": True, "mensaje": f"{func_name} ya fue procesada previamente."}
                else:
                    if func_name not in funciones_ejecutadas:
                        funciones_ejecutadas.append(func_name)
                    logger.info(f"[{agent_code}] Fallback manual solicita función: {func_name} con args: {func_args}")
                    
                    if func_name in AVAILABLE_TOOLS_MAP:
                        try:
                            if func_name in ["crear_borrador_presupuesto", "aprobar_presupuesto", "consultar_presupuestos_paciente", "vincular_paciente_geclisa"] and paciente_id:
                                func_args["paciente_id"] = paciente_id
                            if func_name in ["escalar_a_operador_humano", "finalizar_y_cerrar_consulta", "vincular_paciente_geclisa"] and conversacion_id:
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
            
            try:
                contents.append(response.candidates[0].content)
                contents.append(types.Content(role="tool", parts=tool_responses))
                
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config
                )
            except Exception as fc_err:
                logger.warning(f"Falla en respuesta de function calling manual ({fc_err}). Retornando confirmación.")
                break

        # 9. Obtener la respuesta final normalizada para WhatsApp
        raw_text = response.text or ""
        respuesta_final = formatear_texto_whatsapp(raw_text)
        
        # Intercepción humanizada ante escalado médico / derivación humana
        if "escalar_a_operador_humano" in funciones_ejecutadas:
            if not respuesta_final or "procesado tu consulta de manera interna" in respuesta_final.lower():
                respuesta_final = "Entendido. He derivado tu consulta de manera prioritaria a nuestro equipo de atención humana. Un asesor de la clínica se comunicará contigo por este medio a la brevedad."
            elif not any(k in respuesta_final.lower() for k in ["deriv", "asesor", "humano", "operador", "equipo", "secretar"]):
                respuesta_final = f"{respuesta_final}\n\nHe derivado tu consulta a nuestro equipo de atención humana para que un asesor te asista a la brevedad."
        elif not respuesta_final:
            respuesta_final = "He recibido tu consulta. ¿En qué puedo orientarte hoy?"

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

def transcribir_audio_con_gemini(audio_url: Optional[str] = None, audio_bytes: Optional[bytes] = None, mime_type: str = "audio/ogg") -> str:
    """
    Descarga o recibe los bytes de audio y los transcribe usando Gemini Flash (gemini-3.5-flash).
    """
    if not client:
        raise ValueError("Cliente Gemini no configurado. Verifique GEMINI_API_KEY.")
    
    import httpx
    try:
        if not audio_bytes and audio_url:
            logger.info(f"Descargando audio para transcripción desde: {audio_url}")
            res = httpx.get(audio_url, timeout=35.0, follow_redirects=True)
            res.raise_for_status()
            audio_bytes = res.content
            mime_type = res.headers.get("content-type", mime_type)

        if not audio_bytes:
            raise ValueError("No se proporcionaron bytes ni URL válida para transcribir.")
        
        # Determinar MIME type
        if "ogg" in str(mime_type).lower() or "opus" in str(mime_type).lower():
            clean_mime = "audio/ogg"
        elif "mp3" in str(mime_type).lower():
            clean_mime = "audio/mp3"
        elif "wav" in str(mime_type).lower():
            clean_mime = "audio/wav"
        elif "m4a" in str(mime_type).lower() or "aac" in str(mime_type).lower():
            clean_mime = "audio/mp4"
        else:
            clean_mime = "audio/ogg"

        prompt = (
            "Transcribe este mensaje de voz de un paciente exactamente palabra por palabra en español. "
            "No agregues comentarios, no inventes palabras, no interpretes síntomas, "
            "únicamente devuelve el texto exacto que dijo la persona."
        )

        candidate_models = [
            "gemini-3.5-flash",
            "gemini-flash-latest",
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
                            mime_type=clean_mime
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

