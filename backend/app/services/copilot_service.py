import os
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Inicializar cliente Gemini
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None

CANDIDATE_MODELS = [
    os.getenv("GEMINI_COPILOT_MODEL", "gemini-flash-latest"),
    "gemini-3.5-flash",
    "gemini-flash-lite-latest"
]

def _generar_con_gemini(prompt: str, system_instruction: str = "") -> str:
    """
    Helper para invocar Gemini con resiliencia de modelos.
    """
    if not client:
        raise ValueError("Cliente Gemini no configurado. Verifique GEMINI_API_KEY.")

    last_error = None
    for model_name in CANDIDATE_MODELS:
        try:
            config = types.GenerateContentConfig(
                temperature=0.3,
                system_instruction=system_instruction if system_instruction else None
            )
            res = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config
            )
            return (res.text or "").strip()
        except Exception as err:
            logger.warning(f"Error generando contenido con modelo {model_name}: {err}")
            last_error = err

    if last_error:
        raise last_error
    return ""

def sugerir_respuesta_copilot(
    historial_mensajes: List[Dict[str, Any]], 
    contexto_paciente: Optional[Dict[str, Any]] = None
) -> str:
    """
    Analiza la conversación reciente y la ficha clínica para redactar una propuesta
    de respuesta profesional y personalizada que el operador humano puede enviar o editar.
    """
    paciente_info = ""
    if contexto_paciente:
        paciente_info = f"""
INFORMACIÓN DEL PACIENTE:
- Nombre: {contexto_paciente.get('nombre', 'Paciente')}
- Teléfono: {contexto_paciente.get('telefono', 'Desconocido')}
- Obra Social / Prepaga: {contexto_paciente.get('obra_social', 'Particular')}
- Alertas Médicas: {contexto_paciente.get('alertas_medicas', 'Ninguna')}
"""

    chat_formateado = []
    for m in historial_mensajes[-10:]: # Últimos 10 mensajes
        emisor = "Operador Humano" if m.get("emisor") == "operador" else ("Bot Gemini" if m.get("emisor") == "bot" else "Paciente")
        contenido = m.get("contenido", "")
        # Si es audio transcripto
        meta = m.get("metadata_json") or {}
        if meta.get("transcripcion"):
            contenido = f"[Audio transcripto]: {meta.get('transcripcion')}"
        chat_formateado.append(f"{emisor}: {contenido}")

    chat_str = "\n".join(chat_formateado)

    system_instruction = (
        "Eres un Copiloto de Inteligencia Artificial para el equipo de recepción y secretaría de MedCRM (Clínica Médica). "
        "Tu tarea es redactar una respuesta sugerida impecable, empática, clara y concisa en español (tono profesional y cálido) "
        "para que el operador humano la envíe al paciente por WhatsApp. "
        "Usa formato nativo de WhatsApp (*negrita* para datos clave como fechas, requisitos u horarios). "
        "Responde ÚNICAMENTE con el texto del mensaje sugerido, sin introducciones ni explicaciones."
    )

    prompt = f"""
{paciente_info}

HISTORIAL DE LA CONVERSACIÓN RECIENTE:
{chat_str}

Por favor, redacta la mejor respuesta para continuar la conversación y resolver la consulta o solicitud del paciente de forma resolutiva:
"""

    return _generar_con_gemini(prompt, system_instruction)

def mejorar_redaccion_copilot(texto_borrador: str) -> str:
    """
    Transforma un borrador rápido o informal escrito por el operador en un mensaje
    cálido, claro, con excelente ortografía y formato nativo de WhatsApp.
    """
    if not texto_borrador or not texto_borrador.strip():
        return ""

    system_instruction = (
        "Eres un editor y asistente de redacción para el equipo de atención al paciente de una clínica médica. "
        "Tu misión es reescribir el borrador del operador para que suene profesional, cálido, impecable y respetuoso. "
        "Corrige faltas de ortografía, tildes y signos de puntuación. "
        "Aplica formato de WhatsApp (*negrita* para fechas o datos clave) de forma sutil. "
        "Conserva el sentido y los datos exactos del mensaje original sin inventar información. "
        "Devuelve ÚNICAMENTE el texto mejorado listo para enviar."
    )

    prompt = f"Borrador a mejorar:\n\"{texto_borrador}\"\n\nTexto mejorado:"
    return _generar_con_gemini(prompt, system_instruction)

def resumir_conversacion_copilot(historial_mensajes: List[Dict[str, Any]]) -> str:
    """
    Genera un resumen ejecutivo en viñetas del motivo de consulta, estado y acuerdos pactados.
    """
    chat_formateado = []
    for m in historial_mensajes[-25:]: # Hasta 25 mensajes
        emisor = "Operador" if m.get("emisor") == "operador" else ("Bot" if m.get("emisor") == "bot" else "Paciente")
        contenido = m.get("contenido", "")
        meta = m.get("metadata_json") or {}
        if meta.get("transcripcion"):
            contenido = f"[Audio]: {meta.get('transcripcion')}"
        chat_formateado.append(f"{emisor}: {contenido}")

    chat_str = "\n".join(chat_formateado)

    system_instruction = (
        "Eres un asistente médico administrativo. Resume la conversación entre el paciente y la clínica en un formato breve y claro. "
        "Estructura la respuesta exactamente en 3 secciones cortas con viñetas: "
        "1. *Motivo de Consulta*: (1 línea) "
        "2. *Información / Estudios Requeridos*: (1-2 líneas) "
        "3. *Estado Actual y Próximos Pasos*: (1-2 líneas)"
    )

    prompt = f"HISTORIAL DEL CHAT:\n{chat_str}\n\nResumen clínico-administrativo:"
    return _generar_con_gemini(prompt, system_instruction)
