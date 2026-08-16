from __future__ import annotations
import os
import time
import logging
import threading
import datetime
import subprocess
import httpx
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from app.db import (
    get_paciente_by_telefono, crear_paciente, 
    get_or_create_conversacion, guardar_mensaje,
    actualizar_bot_disabled, supabase
)
from app.agent import procesar_mensaje_agente
from app.services.config_service import load_settings
from app.services.phone_normalizer import (
    normalize_phone_number,
    phone_to_whatsapp_jid,
    format_phone_display,
    clean_phone_digits
)
from app.services.media_service import media_service

load_dotenv()
logger = logging.getLogger("whatsapp_daemon")

BAILEYS_PORT = int(os.getenv("WHATSAPP_SERVICE_PORT", "3001"))
BAILEYS_URL = os.getenv("WHATSAPP_SERVICE_URL", f"http://127.0.0.1:{BAILEYS_PORT}")

class WhatsAppManager:
    """
    Gestor de la pasarela de WhatsApp conectada al microservicio Baileys (Node.js/TypeScript).
    Proporciona vinculación instantánea por QR o Código numérico de 8 dígitos,
    gestión de estado multidispositivo, y despacho de mensajes y presupuestos PDF.
    """
    def __init__(self):
        self.service_url = BAILEYS_URL
        self.node_process: Optional[subprocess.Popen] = None
        self.status: str = "DISCONNECTED"
        self.logs_buffer: List[Dict[str, Any]] = []
        self.max_logs: int = 100
        self._lock = threading.Lock()
        
        self.add_log("INFO", f"WhatsAppManager inicializado con pasarela Baileys ({self.service_url}).")
        # Asegurar arranque del microservicio en segundo plano si corre en local o contenedor
        self.ensure_service_running()

    def add_log(self, level: str, message: str):
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = {
            "id": f"{time.time()}_{len(self.logs_buffer)}",
            "timestamp": now_str,
            "level": level,
            "message": message
        }
        with self._lock:
            self.logs_buffer.append(entry)
            if len(self.logs_buffer) > self.max_logs:
                self.logs_buffer.pop(0)
        
        if level == "ERROR":
            logger.error(message)
        elif level == "WARNING":
            logger.warning(message)
        else:
            logger.info(message)

    def ensure_service_running(self):
        """
        Verifica si el microservicio Baileys responde; si no, lo inicia en un subproceso background único.
        """
        try:
            r = httpx.get(f"{self.service_url}/status", timeout=1.5)
            if r.status_code == 200:
                return True
        except Exception:
            pass

        # Si ya hay un subproceso vivo, esperar a que termine de levantar el puerto
        if self.node_process and self.node_process.poll() is None:
            for _ in range(5):
                time.sleep(0.5)
                try:
                    r = httpx.get(f"{self.service_url}/status", timeout=1.0)
                    if r.status_code == 200:
                        return True
                except Exception:
                    pass
            return True

        # Si no responde y no hay proceso vivo, buscar server.js e iniciarlo
        service_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "whatsapp_service")
        server_js = os.path.join(service_dir, "server.js")
        
        if os.path.exists(server_js):
            try:
                self.add_log("INFO", f"Iniciando proceso único de Baileys desde {server_js}...")
                self.node_process = subprocess.Popen(
                    ["node", "server.js"],
                    cwd=service_dir,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    env=dict(os.environ, WHATSAPP_SERVICE_PORT=str(BAILEYS_PORT))
                )
                time.sleep(1.2)
                return True
            except Exception as e:
                self.add_log("WARNING", f"No se pudo iniciar subproceso Node.js: {e}")
        return False

    def get_status(self) -> Dict[str, Any]:
        """
        Consulta el estado vivo de la pasarela Baileys.
        """
        try:
            r = httpx.get(f"{self.service_url}/status", timeout=3.0)
            if r.status_code == 200:
                data = r.json()
                self.status = data.get("status", "DISCONNECTED")
                return data
        except Exception as e:
            self.add_log("WARNING", f"Microservicio Baileys no disponible: {e}")

        return {
            "available": True,
            "engine": "Baileys",
            "status": "INITIALIZING",
            "is_logged_in": False,
            "qr_ready": False,
            "qr_expires_in": 30,
            "pairing_code": None,
            "pairing_phone": None,
            "device_info": {"phone": None, "push_name": None, "business_name": None, "platform": "Baileys", "jid": None, "connected_at": None},
            "session_dir": "sessions"
        }

    def get_qr_data(self) -> Dict[str, Any]:
        """
        Retorna el código QR activo en base64 Data-URI.
        """
        try:
            r = httpx.get(f"{self.service_url}/qr", timeout=3.0)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        return {"qr_data_uri": None, "expires_in": 30, "status": "DISCONNECTED"}

    def solicitar_codigo_vinculacion(self, telefono: str) -> Dict[str, Any]:
        """
        Solicita un código de vinculación numérico de 8 caracteres (XXXX-XXXX)
        para autorizar directamente ingresando el número en WhatsApp Móvil.
        """
        clean_phone = normalize_phone_number(telefono)
        clean_digits = clean_phone_digits(clean_phone)

        if not clean_digits or len(clean_digits) < 8:
            return {"error": f"Número de teléfono inválido: {telefono}. Debe incluir código de país (ej: 5491112345678)"}

        self.add_log("INFO", f"Solicitando código de vinculación Baileys para +{clean_digits}...")
        self.ensure_service_running()

        try:
            r = httpx.post(f"{self.service_url}/pair-code", json={"phone": clean_digits}, timeout=15.0)
            if r.status_code == 200:
                res = r.json()
                self.add_log("INFO", f"¡Código generado exitosamente!: {res.get('code')}")
                return res
            else:
                err = r.json().get("error", "Error generando código")
                self.add_log("ERROR", f"Error de Baileys al generar código: {err}")
                return {"error": err}
        except Exception as e:
            self.add_log("ERROR", f"Error conectando con microservicio Baileys: {e}")
            return {"error": f"Error de conexión con la pasarela: {str(e)}"}

    def enviar_mensaje(self, telefono_o_jid: str, texto: str, conversacion_id: Optional[str] = None, emisor: str = "operador") -> Dict[str, Any]:
        """
        Envía un mensaje de texto saliente por WhatsApp.
        """
        if not texto or not texto.strip():
            return {"error": "El mensaje no puede estar vacío"}

        telefono = normalize_phone_number(telefono_o_jid)
        self.add_log("INFO", f"Enviando mensaje a {format_phone_display(telefono)} [{emisor}]: {texto[:60]}...")

        try:
            r = httpx.post(f"{self.service_url}/send-message", json={"phone": telefono, "text": texto}, timeout=10.0)
            if r.status_code == 200:
                res = r.json()
                msg_id = res.get("message_id")
                # Guardar mensaje saliente en Supabase con el rol de emisor correspondiente (operador o bot)
                if conversacion_id:
                    try:
                        guardar_mensaje(
                            conversacion_id=conversacion_id,
                            emisor=emisor,
                            contenido=texto,
                            whatsapp_message_id=msg_id
                        )
                    except Exception as db_err:
                        self.add_log("WARNING", f"Error guardando mensaje en Supabase: {db_err}")
                return {"success": True, "enviado_real": True, "message_id": msg_id, "telefono": telefono}
            else:
                err = r.json().get("error", "Error al enviar mensaje")
                self.add_log("WARNING", f"Fallo al enviar mensaje: {err}")
                return {"error": err, "enviado_real": False}
        except Exception as e:
            self.add_log("ERROR", f"Error de conexión al enviar mensaje: {e}")
            return {"error": str(e), "enviado_real": False}

    def enviar_multimedia(self, telefono: str, media_url: str, media_type: str = "document", caption: str = "", filename: str = "") -> Dict[str, Any]:
        """
        Envía archivos multimedia (PDFs de presupuestos, imágenes, audios) a través de Baileys.
        """
        clean_phone = normalize_phone_number(telefono)
        try:
            r = httpx.post(f"{self.service_url}/send-media", json={
                "phone": clean_phone,
                "media_url": media_url,
                "media_type": media_type,
                "caption": caption,
                "filename": filename
            }, timeout=20.0)
            if r.status_code == 200:
                return r.json()
            return {"error": r.json().get("error", "Error enviando multimedia")}
        except Exception as e:
            return {"error": str(e)}

    def desconectar_y_logout(self) -> bool:
        """
        Cierra sesión formal en WhatsApp y limpia los tokens locales.
        """
        try:
            r = httpx.post(f"{self.service_url}/logout", timeout=8.0)
            self.status = "DISCONNECTED"
            self.add_log("INFO", "Sesión de WhatsApp cerrada exitosamente.")
            return r.status_code == 200
        except Exception as e:
            self.add_log("ERROR", f"Error en logout: {e}")
            return False

    def iniciar_daemon(self, force_restart: bool = False):
        """
        Reinicia la conexión del microservicio Baileys.
        """
        try:
            self.ensure_service_running()
            httpx.post(f"{self.service_url}/connect?force={str(force_restart).lower()}", timeout=5.0)
        except Exception as e:
            self.add_log("WARNING", f"Error reconectando: {e}")

    def get_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        # Intentar obtener logs consolidados del microservicio Baileys
        try:
            r = httpx.get(f"{self.service_url}/logs", timeout=2.0)
            if r.status_code == 200:
                service_logs = r.json().get("logs", [])
                combined = self.logs_buffer + service_logs
                combined.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
                return combined[:limit]
        except Exception:
            pass
        with self._lock:
            return list(reversed(self.logs_buffer[-limit:]))

# Instancia global única
whatsapp_manager = WhatsAppManager()

def iniciar_daemon_whatsapp(force_restart: bool = False):
    whatsapp_manager.iniciar_daemon(force_restart=force_restart)
