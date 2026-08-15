from __future__ import annotations
import os
import time
import logging
import threading
import datetime
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

NEONIZE_IMPORT_ERROR: Optional[str] = None
try:
    from neonize.client import NewClient
    from neonize.events import (
        MessageEv, QREv, ConnectedEv, DisconnectedEv, 
        LoggedOutEv, PairStatusEv, ConnectFailureEv,
        ReceiptEv, CallOfferEv, CallTerminateEv, ChatPresenceEv
    )
    from neonize.utils.jid import build_jid, Jid2String
    import segno
    NEONIZE_AVAILABLE = True
except Exception as e:
    NEONIZE_AVAILABLE = False
    NEONIZE_IMPORT_ERROR = f"{type(e).__name__}: {str(e)}"
    segno = None
    NewClient = Any
    MessageEv = Any
    QREv = Any
    ConnectedEv = Any
    DisconnectedEv = Any
    LoggedOutEv = Any
    PairStatusEv = Any
    ConnectFailureEv = Any
    ReceiptEv = Any
    CallOfferEv = Any
    CallTerminateEv = Any
    ChatPresenceEv = Any
    build_jid = lambda *args, **kwargs: ""
    Jid2String = lambda *args, **kwargs: ""

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

class WhatsAppManager:
    """
    Gestor centralizado del ciclo de vida, eventos de conexión QR, 
    mensajería bidireccional y pipeline multimedia con Neonize.
    """
    def __init__(self):
        self.client: Optional[Any] = None
        self.thread: Optional[threading.Thread] = None
        self.status: str = "DISCONNECTED"
        self.qr_code_raw: Optional[str] = None
        self.qr_code_data_uri: Optional[str] = None
        self.qr_timestamp: float = 0
        self.qr_ttl_seconds: int = 30
        self.device_info: Dict[str, Any] = {
            "phone": None,
            "push_name": None,
            "business_name": None,
            "platform": None,
            "jid": None,
            "connected_at": None
        }
        self.logs_buffer: List[Dict[str, Any]] = []
        self.max_logs: int = 100
        self.db_path = os.getenv("NEONIZE_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "neonize.db"))
        self._lock = threading.Lock()
        self.add_log("INFO", "WhatsAppManager inicializado con soporte multimedia y filtrado de eventos.")

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

    def get_status(self) -> Dict[str, Any]:
        qr_expires_in = 30
        if self.qr_timestamp > 0:
            elapsed = time.time() - self.qr_timestamp
            qr_expires_in = max(5, int(self.qr_ttl_seconds - elapsed))

        is_client_connected = False
        if self.client and NEONIZE_AVAILABLE:
            try:
                is_client_connected = bool(self.client.is_connected() and self.client.is_logged_in())
            except Exception:
                pass

        effective_status = "CONNECTED" if is_client_connected else self.status
        if not is_client_connected and self.qr_code_data_uri:
            effective_status = "PAIRING_QR_READY"

        return {
            "available": NEONIZE_AVAILABLE,
            "import_error": NEONIZE_IMPORT_ERROR,
            "status": effective_status,
            "is_logged_in": is_client_connected or (self.status == "CONNECTED"),
            "qr_ready": bool(self.qr_code_data_uri and not is_client_connected),
            "qr_expires_in": qr_expires_in,
            "device_info": self.device_info,
            "db_path": self.db_path
        }

    def get_qr_data(self) -> Dict[str, Any]:
        status_info = self.get_status()
        return {
            "qr_data_uri": self.qr_code_data_uri if not status_info["is_logged_in"] else None,
            "expires_in": status_info["qr_expires_in"],
            "status": status_info["status"]
        }

    def get_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            return list(reversed(self.logs_buffer[-limit:]))

    def _extract_device_info(self):
        if not self.client or not NEONIZE_AVAILABLE:
            return
        try:
            me = self.client.get_me()
            if me:
                phone_num = me.JID.User if hasattr(me.JID, "User") else ""
                normalized_phone = normalize_phone_number(phone_num) if phone_num else ""
                self.device_info = {
                    "phone": normalized_phone or phone_num,
                    "push_name": getattr(me, "PushName", None) or getattr(me, "BussinessName", None) or "Dispositivo WhatsApp",
                    "business_name": getattr(me, "BussinessName", None),
                    "platform": getattr(me, "Platform", "WhatsApp Multi-Device"),
                    "jid": f"{normalized_phone or phone_num}@s.whatsapp.net",
                    "connected_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                self.add_log("INFO", f"Dispositivo sincronizado: {self.device_info['push_name']} ({format_phone_display(self.device_info['phone'])})")
        except Exception as e:
            self.add_log("WARNING", f"No se pudo extraer información completa de dispositivo: {e}")

    def iniciar_daemon(self, force_restart: bool = False):
        """
        Arranca o reconecta el cliente Neonize en segundo plano.
        """
        if not NEONIZE_AVAILABLE:
            self.status = "SIMULATED"
            self.add_log("WARNING", "Neonize no está disponible. Modo SIMULACIÓN activo.")
            return

        if self.client and not force_restart:
            try:
                if self.client.is_logged_in() and self.client.is_connected():
                    self.status = "CONNECTED"
                    self.add_log("INFO", "Cliente de WhatsApp ya conectado y autenticado.")
                    return
            except Exception:
                pass

        if force_restart:
            self.add_log("INFO", "Reiniciando conexión con WhatsApp y limpiando estado previo...")
            self.desconectar_y_logout()

        self.status = "INITIALIZING"
        self.add_log("INFO", f"Inicializando cliente de WhatsApp en {self.db_path}...")

        try:
            self.client = NewClient(self.db_path)

            # 1. Callback de Código QR Nativo de Neonize (Whatsmeow)
            def on_qr_callback(c, data_qr: bytes):
                try:
                    self.qr_timestamp = time.time()
                    self.status = "PAIRING_QR_READY"
                    self.qr_code_raw = data_qr.decode("utf-8", errors="ignore") if isinstance(data_qr, bytes) else str(data_qr)
                    qr = segno.make(data_qr)
                    self.qr_code_data_uri = qr.png_data_uri(scale=7)
                    self.add_log("INFO", f"¡Código QR generado con éxito! ({len(self.qr_code_data_uri)} bytes Data-URI)")
                except Exception as e:
                    self.add_log("ERROR", f"Error procesando QR callback: {e}")

            # Vincular a todos los puntos de escucha de Neonize para garantizar captura
            if hasattr(self.client, "event") and hasattr(self.client.event, "qr"):
                self.client.event.qr(on_qr_callback)
            if hasattr(self.client, "event"):
                self.client.event._qr = on_qr_callback
            if hasattr(self.client, "qr"):
                self.client.qr(on_qr_callback)

            # Fallback secundario de QREv
            @self.client.event(QREv)
            def on_qr_event(c, event: QREv):
                try:
                    if event.Codes and len(event.Codes) > 0:
                        raw_code = event.Codes[0]
                        self.qr_code_raw = raw_code
                        self.qr_timestamp = time.time()
                        self.status = "PAIRING_QR_READY"
                        qr = segno.make(raw_code)
                        self.qr_code_data_uri = qr.png_data_uri(scale=7)
                        self.add_log("INFO", f"¡Código QR recibido vía QREv! ({len(self.qr_code_data_uri)} bytes)")
                except Exception as e:
                    self.add_log("ERROR", f"Error procesando evento QREv: {e}")

            # 2. Evento de Conexión exitosa
            @self.client.event(ConnectedEv)
            def on_connected_event(c, event: ConnectedEv):
                self.status = "CONNECTED"
                self.qr_code_data_uri = None
                self.qr_code_raw = None
                self.add_log("INFO", "¡Conexión establecida exitosamente con los servidores de WhatsApp!")
                self._extract_device_info()

            # 3. Evento de Estado de Emparejamiento
            @self.client.event(PairStatusEv)
            def on_pair_status_event(c, event: PairStatusEv):
                self.add_log("INFO", f"PairStatus: ID={event.ID}, Negocio={event.BusinessName}, Plataforma={event.Platform}, Status={event.Status}")
                if event.ID:
                    self.status = "CONNECTED"
                    self._extract_device_info()

            # 4. Evento de Cierre de Sesión
            @self.client.event(LoggedOutEv)
            def on_logged_out_event(c, event: LoggedOutEv):
                self.status = "LOGGED_OUT"
                self.qr_code_data_uri = None
                self.qr_code_raw = None
                self.device_info = {k: None for k in self.device_info}
                self.add_log("WARNING", f"Sesión de WhatsApp cerrada: {event.Reason}")

            # 5. Evento de Desconexión de Red
            @self.client.event(DisconnectedEv)
            def on_disconnected_event(c, event: DisconnectedEv):
                if self.status != "PAIRING_QR_READY":
                    self.status = "DISCONNECTED"
                self.add_log("WARNING", "Cliente de WhatsApp desconectado temporalmente de la red.")

            # 6. Evento de Mensaje Entrante (Texto, Fotos, Audios, Documentos, etc.)
            @self.client.event(MessageEv)
            def on_message_event(c, event: MessageEv):
                self._handle_incoming_message(c, event)

            # 7. Evento de Confirmaciones de Entrega y Lectura (Tildes)
            @self.client.event(ReceiptEv)
            def on_receipt_event(c, event: ReceiptEv):
                self._handle_receipt_event(c, event)

            # 8. Evento de Llamadas Entrantes (Llamada perdida)
            @self.client.event(CallOfferEv)
            def on_call_offer_event(c, event: CallOfferEv):
                self._handle_call_event(c, event)

            # Iniciar hilo de conexión
            def run_client():
                try:
                    self.client.connect()
                except Exception as e:
                    self.status = "ERROR"
                    self.add_log("ERROR", f"Error en el socket de WhatsApp: {e}")

            self.thread = threading.Thread(target=run_client, daemon=True)
            self.thread.start()

        except Exception as e:
            self.status = "ERROR"
            self.add_log("ERROR", f"Fallo al inicializar Neonize: {e}")

    def desconectar_y_logout(self) -> bool:
        """
        Cierra sesión formalmente, desvincula el dispositivo y reinicia estado.
        """
        self.add_log("INFO", "Solicitando cierre de sesión y desvinculación de WhatsApp...")
        try:
            if self.client and NEONIZE_AVAILABLE:
                try:
                    self.client.logout()
                except Exception as e:
                    self.add_log("WARNING", f"Error al ejecutar logout(): {e}")
                try:
                    self.client.disconnect()
                except Exception:
                    pass
            
            self.status = "DISCONNECTED"
            self.qr_code_data_uri = None
            self.qr_code_raw = None
            self.device_info = {k: None for k in self.device_info}
            self.client = None
            
            if os.path.exists(self.db_path):
                try:
                    time.sleep(0.5)
                    os.remove(self.db_path)
                    self.add_log("INFO", "Base de datos de sesión eliminada para nueva vinculación limpia.")
                except Exception as e:
                    self.add_log("WARNING", f"No se pudo eliminar db temporal: {e}")

            self.add_log("INFO", "Sesión cerrada correctamente. Listo para nueva vinculación QR.")
            return True
        except Exception as e:
            self.add_log("ERROR", f"Error cerrando sesión: {e}")
            return False

    def enviar_mensaje(self, telefono_o_jid: str, texto: str, conversacion_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Envía un mensaje de texto saliente por WhatsApp real o simulador.
        Aplica normalización automática (549... para Argentina).
        """
        if not texto or not texto.strip():
            return {"error": "El mensaje no puede estar vacío"}

        telefono = normalize_phone_number(telefono_o_jid)
        self.add_log("INFO", f"Enviando mensaje a {format_phone_display(telefono)}: {texto[:60]}...")

        # Generar ID de mensaje único para seguimiento de entrega
        wa_msg_id = f"crm_{int(time.time()*1000)}"

        msg_metadata = {
            "tipo": "texto",
            "whatsapp_message_id": wa_msg_id,
            "delivery_status": "enviado"
        }

        # 1. Si existe conversacion_id, guardar en Supabase como emisor='operador'
        msg_guardado = None
        if conversacion_id:
            msg_guardado = guardar_mensaje(conversacion_id, "operador", texto, msg_metadata)
        else:
            paciente = get_paciente_by_telefono(telefono)
            if paciente:
                conv = get_or_create_conversacion(paciente["id"])
                if conv:
                    msg_guardado = guardar_mensaje(conv["id"], "operador", texto, msg_metadata)

        # 2. Despachar por Neonize al WhatsApp real
        enviado_real = False
        if self.client and NEONIZE_AVAILABLE:
            try:
                dest_jid = phone_to_whatsapp_jid(telefono)
                resp = self.client.send_message(dest_jid, texto)
                enviado_real = True
                self.add_log("INFO", f"Mensaje entregado a WhatsApp Gateway para {format_phone_display(telefono)}")
            except Exception as e:
                self.add_log("ERROR", f"Fallo al enviar mensaje por WhatsApp a {telefono}: {e}")
                return {"error": f"Error al enviar mensaje por WhatsApp: {str(e)}", "guardado_db": bool(msg_guardado)}

        return {
            "success": True,
            "telefono": telefono,
            "telefono_formateado": format_phone_display(telefono),
            "enviado_real": enviado_real,
            "guardado_db": bool(msg_guardado),
            "mensaje": texto
        }

    def enviar_documento(self, telefono_o_jid: str, filepath: str, filename: str, caption: str = "", conversacion_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Envía un archivo PDF / documento al paciente vía WhatsApp con teléfono normalizado.
        """
        if not os.path.exists(filepath):
            return {"error": f"El archivo {filepath} no existe."}

        telefono = normalize_phone_number(telefono_o_jid)
        self.add_log("INFO", f"Enviando documento '{filename}' a {format_phone_display(telefono)}...")

        # Guardar en base de datos si aplica
        base_api_url = os.getenv("API_BASE_URL", "http://localhost:8000")
        rel_path = filepath.replace(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "").replace("\\", "/")
        full_media_url = f"{base_api_url}{rel_path}"

        msg_metadata = {
            "tipo": "documento",
            "media_url": full_media_url,
            "file_name": filename,
            "caption": caption,
            "delivery_status": "enviado"
        }

        if conversacion_id:
            guardar_mensaje(conversacion_id, "operador", caption or f"📄 {filename}", msg_metadata)

        enviado_real = False
        if self.client and NEONIZE_AVAILABLE:
            try:
                dest_jid = phone_to_whatsapp_jid(telefono)
                self.client.send_document(
                    to=dest_jid,
                    file=filepath,
                    filename=filename,
                    caption=caption
                )
                enviado_real = True
                self.add_log("INFO", f"Documento '{filename}' enviado con éxito a {format_phone_display(telefono)}")
            except Exception as e:
                self.add_log("ERROR", f"Error enviando documento a {telefono}: {e}")
                return {"error": str(e)}

        return {"success": True, "enviado_real": enviado_real, "archivo": filename, "telefono": telefono}

    def _handle_incoming_message(self, c, event: MessageEv):
        """
        Procesador central de mensajes entrantes.
        Filtra estados/broadcasts, descarga archivos multimedia y procesa con Gemini.
        """
        try:
            sender_jid = event.Info.Sender
            sender_str = str(sender_jid)
            chat_str = str(getattr(event.Info, "Chat", ""))

            # ====================================================================
            # 1. FILTRADO ESTRICTO: Descartar Estados / Broadcasts y Newsletters
            # ====================================================================
            if "status@broadcast" in sender_str or "broadcast" in sender_str or \
               "newsletter" in sender_str or "status@broadcast" in chat_str or \
               "lid" in sender_str and not hasattr(sender_jid, "User"):
                logger.debug(f"Descartando evento no relevante de WhatsApp: {sender_str}")
                return

            raw_user = sender_jid.User if hasattr(sender_jid, "User") else sender_str.split("@")[0]
            telefono = normalize_phone_number(raw_user)
            if not telefono:
                return

            # ====================================================================
            # 2. Extracción y Clasificación del Contenido del Mensaje
            # ====================================================================
            mensaje_texto = ""
            media_metadata: Dict[str, Any] = {}

            if not event.Message:
                return

            # A. Reacción a un mensaje previo (reactionMessage)
            if event.Message.reactionMessage:
                emoji = event.Message.reactionMessage.text
                target_msg_id = event.Message.reactionMessage.key.ID if event.Message.reactionMessage.key else None
                self.add_log("INFO", f"Reacción '{emoji}' recibida de {format_phone_display(telefono)} al mensaje {target_msg_id}")
                
                # Actualizar reacción en Supabase si el mensaje existe
                if target_msg_id and supabase:
                    try:
                        # Buscar mensaje previo y actualizar reacciones
                        resp = supabase.table("mensajes").select("id, metadata_json").eq("metadata_json->>whatsapp_message_id", target_msg_id).execute()
                        if resp.data and len(resp.data) > 0:
                            msg_id = resp.data[0]["id"]
                            current_meta = resp.data[0].get("metadata_json") or {}
                            reactions = current_meta.get("reactions") or []
                            if emoji:
                                reactions.append({"emisor": "paciente", "emoji": emoji, "timestamp": datetime.datetime.now().isoformat()})
                            current_meta["reactions"] = reactions
                            supabase.table("mensajes").update({"metadata_json": current_meta}).eq("id", msg_id).execute()
                    except Exception as e:
                        logger.error(f"Error actualizando reacción en Supabase: {e}")
                return

            # B. Mensaje de Texto Simple o Extendido
            if event.Message.conversation:
                mensaje_texto = event.Message.conversation
                media_metadata["tipo"] = "texto"
            elif event.Message.extendedTextMessage and event.Message.extendedTextMessage.text:
                mensaje_texto = event.Message.extendedTextMessage.text
                media_metadata["tipo"] = "texto"

            # C. Mensaje con Ubicación Geográfica
            elif event.Message.locationMessage:
                loc = event.Message.locationMessage
                lat = loc.degreesLatitude
                lng = loc.degreesLongitude
                loc_name = loc.name or "Ubicación compartida por el paciente"
                maps_url = f"https://maps.google.com/?q={lat},{lng}"
                mensaje_texto = f"📍 {loc_name}: {maps_url}"
                media_metadata = {
                    "tipo": "ubicacion",
                    "latitud": lat,
                    "longitud": lng,
                    "nombre": loc_name,
                    "maps_url": maps_url
                }

            # D. Mensaje con Contacto (vCard)
            elif event.Message.contactMessage:
                ct = event.Message.contactMessage
                display_name = ct.displayName or "Contacto"
                mensaje_texto = f"👤 Contacto compartido: {display_name}"
                media_metadata = {
                    "tipo": "contacto",
                    "nombre": display_name,
                    "vcard": ct.vcard or ""
                }

            # E. Archivos Multimedia (Imágenes, Audios/Notas de voz, Documentos/PDFs, Stickers, Videos)
            else:
                downloaded = media_service.extract_and_download_media(c, event.Message, conversacion_id=telefono)
                if downloaded:
                    media_metadata = downloaded
                    tipo = downloaded.get("tipo", "archivo")
                    if tipo == "imagen":
                        caption = downloaded.get("caption")
                        mensaje_texto = f"📷 [Foto recibida]{': ' + caption if caption else ''}"
                    elif tipo == "audio":
                        mensaje_texto = "🎤 [Nota de voz de WhatsApp]"
                    elif tipo == "documento":
                        fname = downloaded.get("file_name", "estudio.pdf")
                        mensaje_texto = f"📄 [Documento adjunto: {fname}]"
                    elif tipo == "sticker":
                        mensaje_texto = "✨ [Sticker]"
                    elif tipo == "video":
                        mensaje_texto = "🎥 [Video recibido]"
                else:
                    mensaje_texto = "[Mensaje multimedia no soportado]"

            if not mensaje_texto and not media_metadata:
                return

            # Agregar ID de WhatsApp para seguimiento de tildes
            msg_id_wa = getattr(event.Info, "ID", None) or f"in_{int(time.time()*1000)}"
            media_metadata["whatsapp_message_id"] = msg_id_wa
            media_metadata["delivery_status"] = "recibido"

            self.add_log("INFO", f"Mensaje ({media_metadata.get('tipo', 'texto')}) de {format_phone_display(telefono)}: '{mensaje_texto[:60]}'")

            # ====================================================================
            # 3. Paciente y Conversación en Supabase
            # ====================================================================
            paciente = get_paciente_by_telefono(telefono)
            if not paciente:
                push_name = getattr(event.Info, "PushName", None) or f"Paciente {telefono[-4:]}"
                paciente = crear_paciente(telefono=telefono, nombre=push_name)
                if not paciente:
                    self.add_log("ERROR", f"No se pudo crear paciente para {telefono}")
                    return

            paciente_id = paciente["id"]
            conversacion = get_or_create_conversacion(paciente_id)
            if not conversacion:
                self.add_log("ERROR", f"No se pudo obtener conversación para paciente {paciente_id}")
                return

            conversacion_id = conversacion["id"]
            bot_disabled = conversacion.get("bot_disabled", False)

            # ====================================================================
            # 4. Detección de Palabras Clave de Escalamiento a Operador Humano
            # ====================================================================
            settings = load_settings()
            bot_cfg = settings.get("bot", {})
            bot_global_enabled = bot_cfg.get("enabled", True)
            escalation_keywords = bot_cfg.get("human_escalation_keywords", [])

            msg_lower = mensaje_texto.lower()
            trigger_escalation = any(k.lower() in msg_lower for k in escalation_keywords if k)

            if trigger_escalation and not bot_disabled:
                self.add_log("WARNING", f"Urgencia/Operador detectado en mensaje de {format_phone_display(telefono)}. Traspasando a humano.")
                actualizar_bot_disabled(conversacion_id, True)
                bot_disabled = True
                
                guardar_mensaje(conversacion_id, "paciente", mensaje_texto, {**media_metadata, "escalation_triggered": True})
                
                aviso_humano = "He transferido tu consulta a nuestro equipo médico humano. En breve un asesor te responderá directamente. 🩺"
                guardar_mensaje(conversacion_id, "bot", aviso_humano, {"tipo": "texto"})
                
                dest_jid = phone_to_whatsapp_jid(telefono)
                c.send_message(dest_jid, aviso_humano)
                return

            # ====================================================================
            # 5. Guardar Mensaje del Paciente en Supabase
            # ====================================================================
            guardar_mensaje(conversacion_id, "paciente", mensaje_texto, media_metadata)

            # 6. Si el bot está deshabilitado, pausar respuesta automática
            if bot_disabled or not bot_global_enabled:
                self.add_log("INFO", f"Bot pausado para conversación {conversacion_id}. Operador humano a cargo.")
                return

            # ====================================================================
            # 7. Procesar con Gemini Agent (Soporte Multimodal / Presupuestador)
            # ====================================================================
            # Si el paciente envió un audio o documento, informamos al agente en el contexto
            prompt_agente = mensaje_texto
            if media_metadata.get("tipo") == "imagen" and media_metadata.get("caption"):
                prompt_agente = f"[El paciente envió una imagen con el texto]: {media_metadata.get('caption')}"
            elif media_metadata.get("tipo") == "audio":
                prompt_agente = "Hola, te envié un audio solicitando consulta médica o presupuesto."

            self.add_log("INFO", f"Generando respuesta inteligente de Gemini para {format_phone_display(telefono)}...")
            respuesta_agente = procesar_mensaje_agente(
                conversacion_id=conversacion_id,
                paciente_id=paciente_id,
                mensaje_texto=prompt_agente
            )

            # 8. Enviar respuesta automática generada
            if respuesta_agente:
                self.add_log("INFO", f"Enviando respuesta del agente a {format_phone_display(telefono)}: '{respuesta_agente[:60]}...'")
                dest_jid = phone_to_whatsapp_jid(telefono)
                c.send_message(dest_jid, respuesta_agente)

        except Exception as e:
            self.add_log("ERROR", f"Error procesando evento MessageEv de WhatsApp: {e}")

    def _handle_receipt_event(self, c, event: ReceiptEv):
        """
        Maneja tildes de confirmación de entrega y lectura de mensajes enviados.
        """
        try:
            receipt_type = getattr(event, "Type", None)
            msg_ids = getattr(event, "MessageIDs", []) or []
            
            status_str = "entregado"
            # ReceiptType.READ = 3 o string "Read"
            if str(receipt_type).lower() in ("read", "3", "played"):
                status_str = "leido"
            
            if msg_ids and supabase:
                for wid in msg_ids:
                    try:
                        resp = supabase.table("mensajes").select("id, metadata_json").eq("metadata_json->>whatsapp_message_id", wid).execute()
                        if resp.data and len(resp.data) > 0:
                            m_id = resp.data[0]["id"]
                            meta = resp.data[0].get("metadata_json") or {}
                            meta["delivery_status"] = status_str
                            supabase.table("mensajes").update({"metadata_json": meta}).eq("id", m_id).execute()
                    except Exception:
                        pass
        except Exception as e:
            logger.debug(f"Error procesando ReceiptEv: {e}")

    def _handle_call_event(self, c, event: CallOfferEv):
        """
        Registra un mensaje informativo de llamada perdida en el CRM.
        """
        try:
            caller_jid = getattr(event, "CallCreator", None) or getattr(event, "Sender", None)
            if not caller_jid:
                return
            raw_user = caller_jid.User if hasattr(caller_jid, "User") else str(caller_jid).split("@")[0]
            telefono = normalize_phone_number(raw_user)
            if not telefono:
                return

            self.add_log("WARNING", f"Llamada de WhatsApp entrante detectada de {format_phone_display(telefono)}")
            
            paciente = get_paciente_by_telefono(telefono)
            if paciente:
                conv = get_or_create_conversacion(paciente["id"])
                if conv:
                    now_time = datetime.datetime.now().strftime("%H:%M")
                    guardar_mensaje(
                        conv["id"], 
                        "bot", 
                        f"📞 Llamada de voz de WhatsApp no atendida a las {now_time} hs.", 
                        {"tipo": "sistema", "evento": "llamada_perdida"}
                    )
        except Exception as e:
            logger.debug(f"Error procesando llamada entrante: {e}")

# Instancia Singleton Global
whatsapp_manager = WhatsAppManager()

def iniciar_daemon_whatsapp(force_restart: bool = False):
    whatsapp_manager.iniciar_daemon(force_restart=force_restart)
