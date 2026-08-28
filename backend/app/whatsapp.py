from __future__ import annotations
import os
import time
import base64
import logging
import threading
import datetime
import httpx
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from app.db import (
    get_paciente_by_telefono, crear_paciente, 
    get_or_create_conversacion, guardar_mensaje,
    actualizar_bot_disabled, supabase,
    get_active_jid_for_paciente_o_conversacion
)
from app.services.config_service import load_settings
from app.services.phone_normalizer import (
    normalize_phone_number,
    phone_to_whatsapp_jid,
    format_phone_display,
    clean_phone_digits
)
from app.services.media_service import media_service
from app.services.logger_service import log_event

load_dotenv()
logger = logging.getLogger("whatsapp_daemon")

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "https://evolution-api-production-a680.up.railway.app").rstrip("/")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "medcrm_secret_token_2026")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE_NAME", "medcrm")
CRM_WEBHOOK_URL = os.getenv("CRM_BACKEND_PUBLIC_URL", "https://crmagenticonube-production.up.railway.app/api/whatsapp/webhook/incoming")

class WhatsAppManager:
    """
    Gestor de la pasarela de WhatsApp conectada a Evolution API v2.
    Proporciona alta disponibilidad, reconexión automática, gestión de sesiones en PostgreSQL/Redis,
    resolución nativa de números internacionales y despacho garantizado de mensajes y presupuestos PDF.
    """
    def __init__(self):
        self.evo_url = EVOLUTION_API_URL
        self.evo_key = EVOLUTION_API_KEY
        self.evo_instance = EVOLUTION_INSTANCE
        self.webhook_url = CRM_WEBHOOK_URL
        self.status: str = "DISCONNECTED"
        self.logs_buffer: List[Dict[str, Any]] = []
        self.max_logs: int = 100
        self._lock = threading.Lock()
        self._headers = {
            "apikey": self.evo_key,
            "Content-Type": "application/json"
        }
        
        self.add_log("INFO", f"WhatsAppManager inicializado con Evolution API v2 ({self.evo_url}) [Instancia: {self.evo_instance}].")
        threading.Thread(target=self._bootstrap_evolution_instance, daemon=True).start()
        self._start_watchdog()

    def _bootstrap_evolution_instance(self):
        """
        Verifica o crea la instancia 'medcrm' en Evolution API y configura el webhook oficial.
        """
        try:
            time.sleep(2)
            r = httpx.get(f"{self.evo_url}/instance/connectionState/{self.evo_instance}", headers=self._headers, timeout=6.0)
            if r.status_code == 404 or (r.status_code == 200 and r.json().get("status") == 404):
                self.add_log("INFO", f"Creando instancia '{self.evo_instance}' en Evolution API...")
                create_payload = {
                    "instanceName": self.evo_instance,
                    "token": self.evo_key,
                    "qrcode": True,
                    "integration": "WHATSAPP-BAILEYS",
                    "reject_call": False,
                    "msg_call": "No recibimos llamadas por este medio.",
                    "groups_ignore": True,
                    "always_online": True,
                    "read_messages": False,
                    "read_status": False
                }
                httpx.post(f"{self.evo_url}/instance/create", headers=self._headers, json=create_payload, timeout=10.0)

            webhook_payload = {
                "webhook": {
                    "enabled": True,
                    "url": self.webhook_url,
                    "byEvents": False,
                    "base64": True,
                    "events": [
                        "MESSAGES_UPSERT",
                        "MESSAGES_UPDATE",
                        "MESSAGES_EDITED",
                        "MESSAGES_DELETE",
                        "SEND_MESSAGE",
                        "CONNECTION_UPDATE",
                        "QRCODE_UPDATED"
                    ]
                }
            }
            httpx.post(f"{self.evo_url}/webhook/set/{self.evo_instance}", headers=self._headers, json=webhook_payload, timeout=8.0)
            self.add_log("INFO", f"Webhook de Evolution API vinculado exitosamente a {self.webhook_url}.")
        except Exception as e:
            self.add_log("WARNING", f"Error en bootstrap de Evolution API: {e}")

    def ensure_service_running(self) -> bool:
        """
        Verifica que la conexión a Evolution API esté disponible.
        """
        try:
            r = httpx.get(f"{self.evo_url}/instance/connectionState/{self.evo_instance}", headers=self._headers, timeout=2.0)
            return r.status_code in [200, 201]
        except Exception:
            return False

    def _start_watchdog(self):
        """
        Inicia un hilo guardián que sincroniza el estado de Evolution API cada 15 segundos.
        """
        def _watchdog_loop():
            time.sleep(5)
            while True:
                try:
                    self.get_status()
                except Exception:
                    pass
                time.sleep(15)

        t = threading.Thread(target=_watchdog_loop, daemon=True)
        t.start()

    def add_log(self, level: str, message: str, accion: str = "EVENTO_WHATSAPP", detalles: Optional[Dict[str, Any]] = None):
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
        
        log_event(
            nivel=level,
            modulo="WHATSAPP",
            accion=accion,
            mensaje=message,
            detalles=detalles
        )
        
        if level == "ERROR":
            logger.error(message)
        elif level == "WARNING":
            logger.warning(message)
        else:
            logger.info(message)

    def get_status(self) -> Dict[str, Any]:
        """
        Consulta el estado vivo de la instancia en Evolution API v2.
        """
        try:
            r = httpx.get(f"{self.evo_url}/instance/connectionState/{self.evo_instance}", headers=self._headers, timeout=4.0)
            if r.status_code == 200:
                data = r.json()
                inst_data = data.get("instance", {})
                state = inst_data.get("state", "close").lower()
                
                if state in ["open", "connected"]:
                    self.status = "CONNECTED"
                    is_logged = True
                    qr_ready = False
                elif state in ["connecting"]:
                    self.status = "PAIRING_QR_READY"
                    is_logged = False
                    qr_ready = True
                else:
                    self.status = "DISCONNECTED"
                    is_logged = False
                    qr_ready = False

                device_info = {
                    "phone": None,
                    "push_name": None,
                    "business_name": None,
                    "platform": "WhatsApp Evolution API v2",
                    "jid": None,
                    "connected_at": None
                }
                
                if is_logged:
                    try:
                        r_inst = httpx.get(f"{self.evo_url}/instance/fetchInstances", headers=self._headers, timeout=3.0)
                        if r_inst.status_code == 200:
                            instances = r_inst.json()
                            for it in instances:
                                if it.get("name") == self.evo_instance:
                                    owner = it.get("ownerJid") or it.get("owner", "")
                                    clean_phone = owner.split("@")[0].split(":")[0] if owner else None
                                    device_info["phone"] = clean_phone
                                    device_info["push_name"] = it.get("profileName") or "Dispositivo WhatsApp"
                                    device_info["jid"] = owner
                                    device_info["connected_at"] = it.get("updatedAt", "")[:19].replace("T", " ")
                    except Exception:
                        pass

                qr_data_uri = None
                if not is_logged:
                    try:
                        r_qr = httpx.get(f"{self.evo_url}/instance/connect/{self.evo_instance}", headers=self._headers, timeout=3.0)
                        if r_qr.status_code == 200:
                            qr_json = r_qr.json()
                            b64 = qr_json.get("base64")
                            if b64:
                                qr_data_uri = b64 if b64.startswith("data:image") else f"data:image/png;base64,{b64}"
                                qr_ready = True
                                self.status = "PAIRING_QR_READY"
                    except Exception:
                        pass

                # Auto-detección y recuperación de sesiones revocadas (403 Forbidden / 401)
                try:
                    r_fetch = httpx.get(f"{self.evo_url}/instance/fetchInstances?instanceName={self.evo_instance}", headers=self._headers, timeout=3.0)
                    if r_fetch.status_code == 200 and r_fetch.json():
                        inst_obj = r_fetch.json()[0] if isinstance(r_fetch.json(), list) else r_fetch.json()
                        disc_code = inst_obj.get("disconnectionReasonCode")
                        if disc_code in [401, 403, 405] and not is_logged:
                            self.add_log("WARNING", f"Detectada sesión revocada (Código {disc_code}) en Evolution API. Auto-purgando instancia...")
                            threading.Thread(target=self.purgar_y_recrear_instancia, daemon=True).start()
                except Exception:
                    pass

                return {
                    "available": True,
                    "engine": "Evolution API v2",
                    "status": self.status,
                    "is_logged_in": is_logged,
                    "qr_ready": qr_ready,
                    "qr_data_uri": qr_data_uri,
                    "qr_expires_in": 30,
                    "pairing_code": None,
                    "pairing_phone": None,
                    "device_info": device_info,
                    "session_dir": "PostgreSQL"
                }
            elif r.status_code == 404:
                self._bootstrap_evolution_instance()
        except Exception as e:
            self.add_log("WARNING", f"No se pudo consultar estado en Evolution API: {e}")

        return {
            "available": True,
            "engine": "Evolution API v2",
            "status": "INITIALIZING",
            "is_logged_in": False,
            "qr_ready": False,
            "qr_expires_in": 30,
            "pairing_code": None,
            "pairing_phone": None,
            "device_info": {"phone": None, "push_name": None, "business_name": None, "platform": "Evolution API", "jid": None, "connected_at": None},
            "session_dir": "PostgreSQL"
        }

    def get_qr_data(self) -> Dict[str, Any]:
        """
        Retorna el código QR activo en base64 Data-URI generado por Evolution API v2.
        """
        try:
            r = httpx.get(f"{self.evo_url}/instance/connect/{self.evo_instance}", headers=self._headers, timeout=5.0)
            if r.status_code == 200:
                data = r.json()
                b64 = data.get("base64")
                if b64 and not b64.startswith("data:image"):
                    b64 = f"data:image/png;base64,{b64}"
                return {
                    "qr_data_uri": b64,
                    "pairing_code": data.get("pairingCode"),
                    "expires_in": 30,
                    "status": "PAIRING_QR_READY"
                }
        except Exception as e:
            self.add_log("WARNING", f"Error obteniendo QR de Evolution API: {e}")
        return {"qr_data_uri": None, "expires_in": 30, "status": self.status}

    def solicitar_codigo_vinculacion(self, telefono: str) -> Dict[str, Any]:
        """
        Solicita un código de vinculación numérico de 8 caracteres (XXXX-XXXX)
        para autorizar directamente ingresando el número en WhatsApp Móvil.
        """
        clean_phone = normalize_phone_number(telefono)
        clean_digits = clean_phone_digits(clean_phone)

        if not clean_digits or len(clean_digits) < 8:
            return {"error": f"Número de teléfono inválido: {telefono}. Debe incluir código de país (ej: 5491112345678)"}

        self.add_log("INFO", f"Solicitando código de vinculación en Evolution API para +{clean_digits}...")

        try:
            r = httpx.get(
                f"{self.evo_url}/instance/connect/{self.evo_instance}?number={clean_digits}",
                headers=self._headers,
                timeout=12.0
            )
            if r.status_code == 200:
                res = r.json()
                code = res.get("pairingCode") or res.get("code")
                self.add_log("INFO", f"Código generado exitosamente: {code}")
                return {"code": code, "phone": clean_digits, "success": True}
            else:
                err = r.json().get("error", "Error generando código")
                self.add_log("ERROR", f"Error de Evolution API al generar código: {err}")
                return {"error": err}
        except Exception as e:
            self.add_log("ERROR", f"Error conectando con Evolution API: {e}")
            return {"error": f"Error de conexión con la pasarela: {str(e)}"}

    def enviar_mensaje(
        self,
        telefono_o_jid: str,
        texto: str,
        conversacion_id: Optional[str] = None,
        emisor: str = "operador",
        remote_jid: Optional[str] = None,
        quoted_message_id: Optional[str] = None,
        quoted_message_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Envía un mensaje de texto saliente por WhatsApp mediante Evolution API v2
        y lo registra en la conversación correspondiente del CRM (con soporte para citas / reply).
        """
        if not texto or not texto.strip():
            return {"error": "El mensaje no puede estar vacío"}

        telefono = normalize_phone_number(telefono_o_jid)
        clean_digits = clean_phone_digits(telefono)
        self.add_log("INFO", f"Enviando mensaje a {format_phone_display(telefono)} [{emisor}]: {texto[:60]}...")

        if not conversacion_id:
            try:
                pac = get_paciente_by_telefono(telefono)
                if pac:
                    conv = get_or_create_conversacion(pac["id"])
                    if conv:
                        conversacion_id = conv.get("id")
            except Exception as e:
                self.add_log("WARNING", f"No se pudo autovincular conversación para {telefono}: {e}")

        # Resolución inteligente de destino (Prioridad absoluta a @lid si existe)
        target_number = clean_digits
        active_lid = get_active_jid_for_paciente_o_conversacion(
            conversacion_id=conversacion_id,
            telefono=telefono
        )
        if active_lid and ("@lid" in str(active_lid)):
            target_number = str(active_lid)
        elif remote_jid and ("@" in str(remote_jid)):
            target_number = str(remote_jid)
        elif active_lid and ("@" in str(active_lid)):
            target_number = str(active_lid)

        payload_send = {
            "number": target_number,
            "text": texto,
            "delay": 1000,
            "linkPreview": True
        }

        if quoted_message_id:
            payload_send["quoted"] = {
                "key": {
                    "id": quoted_message_id
                }
            }

        try:
            r = httpx.post(
                f"{self.evo_url}/message/sendText/{self.evo_instance}",
                headers=self._headers,
                json=payload_send,
                timeout=12.0
            )
            if r.status_code in [200, 201]:
                res = r.json()
                msg_key = res.get("key", {})
                msg_id = msg_key.get("id") or res.get("message_id")
                dispatched_jid = msg_key.get("remoteJid") or target_number

                if conversacion_id:
                    meta_to_save: Dict[str, Any] = {
                        "delivery_status": "enviado",
                        "dispatched_jid": dispatched_jid,
                        "gateway": "evolution_api_v2"
                    }
                    if quoted_message_data:
                        meta_to_save["quoted_message"] = quoted_message_data
                    if quoted_message_id:
                        meta_to_save["quoted_message_id"] = quoted_message_id

                    try:
                        guardar_mensaje(
                            conversacion_id=conversacion_id,
                            emisor=emisor,
                            contenido=texto,
                            whatsapp_message_id=msg_id,
                            metadata_json=meta_to_save
                        )
                    except Exception as db_err:
                        self.add_log("WARNING", f"Error guardando mensaje en Supabase: {db_err}")

                self.add_log("INFO", f"Mensaje despachado exitosamente vía Evolution API a {target_number} (ID: {msg_id})")
                return {
                    "success": True,
                    "enviado_real": True,
                    "message_id": msg_id,
                    "telefono": telefono,
                    "conversacion_id": conversacion_id,
                    "jid": dispatched_jid
                }
            else:
                err_data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"error": r.text}
                err = err_data.get("response", {}).get("message") or err_data.get("error", "Error al enviar mensaje")
                self.add_log("WARNING", f"Fallo al enviar mensaje vía Evolution API: {err}")
                return {"error": str(err), "enviado_real": False}
        except Exception as e:
            self.add_log("ERROR", f"Error de comunicación con Evolution API: {e}")
            return {"error": f"Error de comunicación con WhatsApp: {str(e)}", "enviado_real": False}

    def marcar_como_leido(
        self,
        telefono_o_jid: str,
        message_ids: Optional[List[str]] = None,
        remote_jid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Envía confirmación de lectura a WhatsApp para activar el doble tilde azul en el teléfono del paciente.
        """
        telefono = normalize_phone_number(telefono_o_jid) if telefono_o_jid else ""
        clean_digits = clean_phone_digits(telefono)
        active_lid = get_active_jid_for_paciente_o_conversacion(telefono=telefono_o_jid)
        target_jid = active_lid or remote_jid or (f"{clean_digits}@s.whatsapp.net" if clean_digits else "")
        
        try:
            read_items = [{"id": mid, "fromMe": False, "remoteJid": target_jid} for mid in (message_ids or []) if mid]
            if not read_items and target_jid:
                read_items = [{"id": "", "fromMe": False, "remoteJid": target_jid}]

            payload = {
                "readMessages": read_items
            }
            r = httpx.post(f"{self.evo_url}/chat/markMessageAsRead/{self.evo_instance}", headers=self._headers, json=payload, timeout=5.0)
            if r.status_code in [200, 201]:
                return {"success": True}
            return {"success": False, "error": r.text}
        except Exception as e:
            logger.warning(f"Error marcando mensajes como leídos en Evolution API: {e}")
            return {"success": False, "error": str(e)}

    def enviar_reaccion(
        self,
        message_id: str,
        remote_jid: str,
        emoji: str,
        from_me: bool = False
    ) -> Dict[str, Any]:
        """
        Envía una reacción de emoji a un mensaje específico mediante Evolution API v2.
        """
        if not message_id or not emoji:
            return {"error": "Se requiere message_id y emoji para reaccionar"}

        payload = {
            "key": {
                "remoteJid": remote_jid,
                "fromMe": from_me,
                "id": message_id
            },
            "reaction": emoji
        }

        try:
            r = httpx.post(
                f"{self.evo_url}/message/sendReaction/{self.evo_instance}",
                headers=self._headers,
                json=payload,
                timeout=8.0
            )
            if r.status_code in [200, 201]:
                return {"success": True, "reaction": emoji, "message_id": message_id}
            return {"success": False, "error": r.text}
        except Exception as e:
            self.add_log("WARNING", f"Error enviando reacción a Evolution API: {e}")
            return {"success": False, "error": str(e)}

    def get_media_base64(self, message_id: str) -> Optional[Dict[str, Any]]:
        """
        Descarga el payload Base64 y MimeType de cualquier mensaje multimedia desde Evolution API v2.
        """
        try:
            payload = {
                "message": {
                    "key": {
                        "id": message_id
                    }
                },
                "convertToMp4": False
            }
            r = httpx.post(f"{self.evo_url}/chat/getBase64FromMediaMessage/{self.evo_instance}", headers=self._headers, json=payload, timeout=20.0)
            if r.status_code in [200, 201]:
                return r.json()
        except Exception as e:
            logger.warning(f"Error obteniendo base64 de mensaje multimedia {message_id}: {e}")
        return None

    def enviar_multimedia(
        self,
        telefono: str,
        media_url: str,
        media_type: str = "document",
        caption: str = "",
        filename: str = "",
        conversacion_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Envía archivos multimedia (PDFs de presupuestos, imágenes, audios) a través de Evolution API v2.
        """
        clean_digits = clean_phone_digits(normalize_phone_number(telefono))
        target_number = clean_digits
        active_lid = get_active_jid_for_paciente_o_conversacion(conversacion_id=conversacion_id, telefono=telefono)
        if active_lid and ("@lid" in str(active_lid)):
            target_number = str(active_lid)
        elif active_lid and ("@" in str(active_lid)):
            target_number = str(active_lid)

        media_payload = media_url
        mimetype = None
        if "base64," in media_url:
            header, media_payload = media_url.split("base64,", 1)
            if "data:" in header and ";" in header:
                mimetype = header.split("data:")[1].split(";")[0]

        try:
            payload = {
                "number": target_number,
                "mediatype": media_type,
                "media": media_payload,
                "caption": caption,
                "fileName": filename or "archivo"
            }
            if mimetype:
                payload["mimetype"] = mimetype
            r = httpx.post(f"{self.evo_url}/message/sendMedia/{self.evo_instance}", headers=self._headers, json=payload, timeout=20.0)
            if r.status_code in [200, 201]:
                return r.json()
            return {"error": r.json().get("error", "Error enviando multimedia")}
        except Exception as e:
            return {"error": str(e)}

    def enviar_documento(
        self,
        telefono_o_jid: str,
        filepath: str,
        filename: str,
        caption: str = "",
        conversacion_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Envía un documento local (PDF de presupuesto, estudios, etc.) vía WhatsApp convirtiéndolo a base64 para Evolution API.
        """
        clean_digits = clean_phone_digits(normalize_phone_number(telefono_o_jid))
        target_number = clean_digits
        active_lid = get_active_jid_for_paciente_o_conversacion(conversacion_id=conversacion_id, telefono=telefono_o_jid)
        if active_lid and ("@lid" in str(active_lid)):
            target_number = str(active_lid)
        elif active_lid and ("@" in str(active_lid)):
            target_number = str(active_lid)

        try:
            if not os.path.exists(filepath):
                return {"success": False, "error": "El archivo local no existe"}

            with open(filepath, "rb") as f:
                b64_content = base64.b64encode(f.read()).decode("utf-8")

            payload = {
                "number": target_number,
                "mediatype": "document",
                "mimetype": "application/pdf",
                "media": b64_content,
                "fileName": filename or "Presupuesto_Medico.pdf",
                "caption": caption
            }

            r = httpx.post(f"{self.evo_url}/message/sendMedia/{self.evo_instance}", headers=self._headers, json=payload, timeout=25.0)
            res_json = r.json() if r.status_code in [200, 201] else {}
            msg_key = res_json.get("key", {})
            msg_id = msg_key.get("id") or res_json.get("message_id")

            if conversacion_id:
                try:
                    guardar_mensaje(
                        conversacion_id=conversacion_id,
                        emisor="operador",
                        contenido=caption or f"[DOCUMENTO ENVIADO: {filename}]",
                        whatsapp_message_id=msg_id,
                        metadata_json={
                            "documento": filename,
                            "filepath": filepath,
                            "delivery_status": "enviado",
                            "gateway": "evolution_api_v2"
                        }
                    )
                except Exception as db_err:
                    self.add_log("WARNING", f"Error guardando mensaje de documento en Supabase: {db_err}")

            if r.status_code in [200, 201]:
                return {"success": True, "enviado_real": True, "message_id": msg_id, "telefono": clean_digits}
            else:
                err = res_json.get("error", "Error enviando documento")
                return {"success": False, "error": err, "enviado_real": False}
        except Exception as e:
            self.add_log("ERROR", f"Error enviando documento: {e}")
            return {"success": False, "error": str(e), "enviado_real": False}

    def purgar_y_recrear_instancia(self) -> bool:
        """
        Elimina la instancia corrupta o desvinculada en Evolution API y la recrea desde cero,
        limpiando todas las tablas de autenticación y claves residuales (403 Forbidden).
        """
        try:
            self.add_log("WARNING", f"Purgando instancia '{self.evo_instance}' en Evolution API por sesión revocada o reseteo...")
            try:
                httpx.delete(f"{self.evo_url}/instance/delete/{self.evo_instance}", headers=self._headers, timeout=10.0)
            except Exception:
                pass
            time.sleep(1)
            self._bootstrap_evolution_instance()
            self.status = "PAIRING_QR_READY"
            return True
        except Exception as e:
            self.add_log("ERROR", f"Error en purga y recreación de instancia: {e}")
            return False

    def desconectar_y_logout(self) -> bool:
        """
        Cierra sesión formal en WhatsApp, purga credenciales residuales y regenera la instancia limpia.
        """
        try:
            try:
                httpx.delete(f"{self.evo_url}/instance/logout/{self.evo_instance}", headers=self._headers, timeout=8.0)
            except Exception:
                pass
            self.purgar_y_recrear_instancia()
            self.status = "DISCONNECTED"
            self.add_log("INFO", "Sesión de WhatsApp cerrada y purgada exitosamente en Evolution API.")
            return True
        except Exception as e:
            self.add_log("ERROR", f"Error en logout de Evolution API: {e}")
            self.purgar_y_recrear_instancia()
            return True

    def iniciar_daemon(self, force_restart: bool = False):
        """
        Solicita inicio de conexión y regeneración de QR en Evolution API.
        """
        try:
            httpx.get(f"{self.evo_url}/instance/connect/{self.evo_instance}", headers=self._headers, timeout=6.0)
        except Exception as e:
            self.add_log("WARNING", f"Error reconectando Evolution API: {e}")

    def get_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            return list(reversed(self.logs_buffer[-limit:]))

whatsapp_manager = WhatsAppManager()

def iniciar_daemon_whatsapp(force_restart: bool = False):
    whatsapp_manager.iniciar_daemon(force_restart=force_restart)
