import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

CONFIG_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "app_settings.json")

DEFAULT_SETTINGS: Dict[str, Any] = {
    "bot": {
        "enabled": True,
        "model_name": "gemini-2.5-flash",
        "typing_delay_seconds": 3,
        "human_escalation_keywords": [
            "humano", "operador", "persona", "asesor", "urgencia", 
            "emergencia", "reclamo", "hablar con alguien", "doctor directo"
        ],
        "system_instructions_override": ""
    },
    "clinica": {
        "nombre": "Centro Médico Nube",
        "direccion": "Av. Corrientes 1234, CABA, Argentina",
        "telefono_guardia": "+54 9 11 5555-0199",
        "email_contacto": "contacto@centromediconube.com",
        "horarios_atencion": "Lunes a Viernes de 08:00 a 20:00 hs. Sábados de 09:00 a 13:00 hs.",
        "mensaje_bienvenida": "¡Hola! Gracias por comunicarte con Centro Médico Nube. ¿En qué podemos ayudarte hoy?"
    }
}

def load_settings() -> Dict[str, Any]:
    """
    Carga las configuraciones del sistema desde archivo JSON o valores por defecto.
    """
    try:
        if os.path.exists(CONFIG_FILE_PATH):
            with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
                # Fusionar con defaults en caso de campos nuevos
                merged = {**DEFAULT_SETTINGS}
                for k, v in saved.items():
                    if isinstance(v, dict) and k in merged:
                        merged[k] = {**merged[k], **v}
                    else:
                        merged[k] = v
                return merged
    except Exception as e:
        logger.error(f"Error al leer archivo de configuración {CONFIG_FILE_PATH}: {e}")
    
    return DEFAULT_SETTINGS.copy()

def save_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guarda las nuevas configuraciones en archivo JSON.
    """
    try:
        current = load_settings()
        for k, v in new_settings.items():
            if isinstance(v, dict) and k in current:
                current[k] = {**current[k], **v}
            else:
                current[k] = v
                
        with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2, ensure_ascii=False)
            
        logger.info(f"Configuraciones guardadas correctamente en {CONFIG_FILE_PATH}")
        return current
    except Exception as e:
        logger.error(f"Error al guardar configuraciones: {e}")
        raise e
