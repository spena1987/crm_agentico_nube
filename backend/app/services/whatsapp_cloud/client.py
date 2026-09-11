"""
Cliente asíncrono de alto rendimiento para Meta WhatsApp Cloud API (Graph API v21+).
Incluye Exponential Backoff con Jitter, Circuit Breaker y manejo granular de errores de Meta.
"""

import httpx
import asyncio
import random
import logging
from typing import Optional, Dict, Any, List, Union, Tuple
from datetime import datetime, timezone

logger = logging.getLogger("whatsapp_cloud_client")


class MetaAPIError(Exception):
    """Error genérico devuelto por Meta Graph API."""
    def __init__(self, code: int, subcode: Optional[int], message: str, fbtrace_id: Optional[str]):
        self.code = code
        self.subcode = subcode
        self.message = message
        self.fbtrace_id = fbtrace_id
        super().__init__(f"Meta API Error [{code}/{subcode}]: {message} (fbtrace_id: {fbtrace_id})")


class ConversationWindowClosedError(MetaAPIError):
    """Código 131026: Ventana de 24 horas expirada. Solo se permiten plantillas (templates)."""
    pass


class RateLimitExceededError(MetaAPIError):
    """Código 130429 o 131042: Throughput o límite de velocidad superado."""
    pass


class InvalidParameterError(MetaAPIError):
    """Código 100: Parámetro o formato de payload inválido."""
    pass


class AuthenticationError(MetaAPIError):
    """Código 190: Token de acceso caducado o inválido."""
    pass


class CircuitBreakerOpenException(Exception):
    """Lanzada cuando el Circuit Breaker está abierto para evitar saturar el servicio."""
    pass


class SimpleCircuitBreaker:
    """
    Circuit breaker simple en memoria para prevenir cascading failures ante caídas de Meta.
    """
    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state: str = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        import time
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.error(f"[CircuitBreaker] Estado cambiado a OPEN tras {self.failure_count} fallos consecutivos.")

    def can_execute(self) -> bool:
        import time
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if self.last_failure_time and (time.time() - self.last_failure_time > self.recovery_timeout):
                self.state = "HALF_OPEN"
                logger.info("[CircuitBreaker] Estado cambiado a HALF_OPEN, probando solicitud...")
                return True
            return False
        if self.state == "HALF_OPEN":
            return True
        return True


def get_whatsapp_cloud_credentials() -> tuple[Optional[str], Optional[str]]:
    """
    Obtiene las credenciales activas de Meta WhatsApp Cloud API.
    Prioriza la base de datos Supabase (tabla whatsapp_accounts) para permitir rotación
    de tokens sin reiniciar contenedores ni depender de redeploys de Railway.
    Si no están en la BD, recurre a las variables de entorno.
    """
    import os
    try:
        from app.db import supabase
        acc_res = supabase.table("whatsapp_accounts").select("phone_number_id, system_user_token_encrypted").eq("is_active", True).limit(1).execute()
        if acc_res.data and len(acc_res.data) > 0:
            db_phone = acc_res.data[0].get("phone_number_id")
            db_token = acc_res.data[0].get("system_user_token_encrypted")
            if db_phone and db_token:
                return db_phone, db_token
    except Exception as e:
        logger.debug(f"[Credentials] Error leyendo whatsapp_accounts de Supabase: {e}")

    phone_id = os.getenv("META_WA_PHONE_NUMBER_ID")
    token = os.getenv("META_WA_ACCESS_TOKEN")
    return phone_id, token


class WhatsAppCloudClient:
    """
    Cliente Enterprise para Meta WhatsApp Cloud API (Graph API v21+).
    """
    DEFAULT_GRAPH_VERSION = "v21.0"
    BASE_URL = "https://graph.facebook.com"

    def __init__(
        self,
        phone_number_id: str,
        access_token: str,
        graph_version: str = DEFAULT_GRAPH_VERSION,
        max_retries: int = 3,
        timeout_seconds: float = 12.0
    ):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.graph_version = graph_version
        self.max_retries = max_retries
        self.timeout = httpx.Timeout(timeout_seconds, connect=5.0)
        self._circuit_breaker = SimpleCircuitBreaker()
        self._client: Optional[httpx.AsyncClient] = None

    async def get_http_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                }
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _request_with_retry(self, method: str, endpoint: str, json_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Ejecuta solicitudes HTTP contra Graph API con Exponential Backoff, Jitter y Circuit Breaker.
        """
        if not self._circuit_breaker.can_execute():
            raise CircuitBreakerOpenException("Circuit Breaker está OPEN. Meta Graph API temporalmente no disponible.")

        client = await self.get_http_client()
        url = f"{self.BASE_URL}/{self.graph_version}/{self.phone_number_id}/{endpoint.lstrip('/')}"

        for attempt in range(1, self.max_retries + 1):
            try:
                if method.upper() == "POST":
                    response = await client.post(url, json=json_payload)
                elif method.upper() == "GET":
                    response = await client.get(url)
                else:
                    response = await client.request(method, url, json=json_payload)

                # Intentar parsear respuesta JSON
                try:
                    data = response.json()
                except Exception:
                    data = {"status_code": response.status_code, "text": response.text}

                # 200 OK
                if response.status_code == 200:
                    self._circuit_breaker.record_success()
                    return data

                # Clasificación de errores de Meta
                error_obj = data.get("error", {}) if isinstance(data, dict) else {}
                code = error_obj.get("code", response.status_code)
                subcode = error_obj.get("error_subcode")
                msg = error_obj.get("message", response.text)
                fbtrace = error_obj.get("fbtrace_id")

                # Error 131026: Ventana de 24 horas cerrada
                if code == 131026:
                    raise ConversationWindowClosedError(code, subcode, msg, fbtrace)

                # Error 131030: En Sandbox, Meta a veces registra los números de prueba argentinos como 54 (sin 9)
                if code == 131030 and json_payload and str(json_payload.get("to", "")).startswith("549"):
                    alt_to = "54" + str(json_payload["to"])[3:]
                    logger.info(f"[Meta Sandbox Fallback] Error 131030 con 549. Reintentando con formato alternativo de prueba {alt_to}...")
                    json_payload["to"] = alt_to
                    continue

                # Error 190: Token inválido / expirado
                if code == 190:
                    raise AuthenticationError(code, subcode, msg, fbtrace)

                # Error 100: Parámetros inválidos
                if code == 100:
                    raise InvalidParameterError(code, subcode, msg, fbtrace)

                # 429 Rate Limit o 5xx Server Error -> Reintentar con Backoff + Jitter
                if code in (130429, 131042) or response.status_code in (429, 500, 502, 503, 504):
                    self._circuit_breaker.record_failure()
                    if attempt == self.max_retries:
                        raise RateLimitExceededError(code, subcode, msg, fbtrace)
                    
                    delay = (2 ** attempt) + random.uniform(0.1, 0.6)
                    logger.warning(f"[WhatsAppAPI] Reintento {attempt}/{self.max_retries} tras error {code} en {delay:.2f}s...")
                    await asyncio.sleep(delay)
                    continue

                # Cualquier otro error 4xx no reintentable
                raise MetaAPIError(code, subcode, msg, fbtrace)

            except (httpx.RequestError, httpx.TimeoutException) as exc:
                self._circuit_breaker.record_failure()
                if attempt == self.max_retries:
                    logger.error(f"[WhatsAppAPI] Fallo definitivo de red: {exc}")
                    raise
                delay = (2 ** attempt) + random.uniform(0.1, 0.6)
                logger.warning(f"[WhatsAppAPI] Fallo de conexión ({exc}). Reintento {attempt}/{self.max_retries} en {delay:.2f}s...")
                await asyncio.sleep(delay)

        raise RuntimeError("Agotados los reintentos sin respuesta exitosa.")

    async def send_template(
        self,
        to_phone: str,
        template_name: str,
        language_code: str = "es_AR",
        components: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Envía un mensaje de plantilla pre-aprobada (UTILITY, MARKETING, AUTHENTICATION).
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or []
            }
        }
        res = await self._request_with_retry("POST", "messages", payload)
        return {
            "wamid": res.get("messages", [{}])[0].get("id"),
            "raw_response": res
        }

    async def send_free_text(self, to_phone: str, text: str, preview_url: bool = False) -> Dict[str, Any]:
        """
        Envía un mensaje de texto libre (válido únicamente dentro de la ventana de servicio de 24 horas).
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": text
            }
        }
        res = await self._request_with_retry("POST", "messages", payload)
        return {
            "wamid": res.get("messages", [{}])[0].get("id"),
            "raw_response": res
        }

    async def send_interactive_buttons(
        self,
        to_phone: str,
        body_text: str,
        buttons: List[Dict[str, str]],  # [{"id": "CONFIRM_TURNO_123", "title": "Confirmar"}]
        header_text: Optional[str] = None,
        footer_text: Optional[str] = "Clínica Médica"
    ) -> Dict[str, Any]:
        """
        Envía hasta 3 botones de respuesta rápida interactivos (ideal para confirmar o cancelar turnos).
        """
        formatted_buttons = []
        for btn in buttons[:3]:
            formatted_buttons.append({
                "type": "reply",
                "reply": {
                    "id": btn["id"],
                    "title": btn["title"][:20]  # Límite estricto de Meta: 20 caracteres
                }
            })

        interactive_dict: Dict[str, Any] = {
            "type": "button",
            "body": {"text": body_text},
            "action": {"buttons": formatted_buttons}
        }
        if header_text:
            interactive_dict["header"] = {"type": "text", "text": header_text}
        if footer_text:
            interactive_dict["footer"] = {"text": footer_text}

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "interactive",
            "interactive": interactive_dict
        }
        res = await self._request_with_retry("POST", "messages", payload)
        return {
            "wamid": res.get("messages", [{}])[0].get("id"),
            "raw_response": res
        }

    async def mark_as_read(self, message_id: str) -> Dict[str, Any]:
        """
        Emite el recibo de lectura (doble tilde azul) hacia WhatsApp.
        """
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }
        res = await self._request_with_retry("POST", "messages", payload)
        return res

    async def send_image(
        self,
        to_phone: str,
        image_url: str,
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Envía una imagen (JPG/PNG) a través de URL pública o prefirmada.
        """
        img_data: Dict[str, Any] = {"link": image_url}
        if caption:
            img_data["caption"] = caption

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "image",
            "image": img_data
        }
        res = await self._request_with_retry("POST", "messages", payload)
        return {
            "wamid": res.get("messages", [{}])[0].get("id"),
            "raw_response": res
        }

    async def send_audio(
        self,
        to_phone: str,
        audio_url: str
    ) -> Dict[str, Any]:
        """
        Envía un archivo de audio (MP3/OGG) a través de URL pública.
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_phone,
            "type": "audio",
            "audio": {"link": audio_url}
        }
        res = await self._request_with_retry("POST", "messages", payload)
        return {
            "wamid": res.get("messages", [{}])[0].get("id"),
            "raw_response": res
        }

    async def send_media(
        self,
        to_phone: str,
        media_type: str,
        media_url: str,
        caption: Optional[str] = None,
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Envía cualquier archivo multimedia (image, document, audio, video).
        """
        norm_type = media_type.lower()
        if norm_type in ("image", "imagen", "foto"):
            return await self.send_image(to_phone, media_url, caption)
        elif norm_type in ("audio", "voice", "nota_voz"):
            return await self.send_audio(to_phone, audio_url=media_url)
        else:
            return await self.send_document(to_phone, document_url=media_url, caption=caption, filename=filename)

    async def download_media_bytes(self, media_id: str) -> Tuple[bytes, str]:
        """
        Descarga el binario multimedia desde Meta Graph API usando el media_id.
        Paso 1: Obtener la URL temporal de descarga desde Graph API.
        Paso 2: Descargar los bytes binarios con el Bearer token.
        Retorna (bytes_data, mime_type).
        """
        client = await self.get_http_client()
        url = f"{self.BASE_URL}/{self.graph_version}/{media_id}"
        meta_res = await client.get(url, headers={"Authorization": f"Bearer {self.access_token}"})
        if meta_res.status_code != 200:
            raise RuntimeError(f"Error consultando media {media_id} en Meta: {meta_res.status_code} {meta_res.text}")

        meta_info = meta_res.json()
        download_url = meta_info.get("url")
        mime_type = meta_info.get("mime_type", "application/octet-stream")

        if not download_url:
            raise ValueError(f"Meta no retornó URL de descarga para media {media_id}: {meta_info}")

        # Descarga del binario
        binary_res = await client.get(
            download_url,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "User-Agent": "Mozilla/5.0 (CRM-WhatsApp-Client)"
            },
            follow_redirects=True
        )
        if binary_res.status_code != 200:
            raise RuntimeError(f"Error descargando binario de media {media_id}: {binary_res.status_code}")

        return binary_res.content, mime_type

