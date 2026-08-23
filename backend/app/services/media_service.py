import os
import uuid
import time
import mimetypes
import logging
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Directorio raíz para archivos multimedia
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_MEDIA_DIR = os.path.join(BASE_DIR, "static", "media")

# Subcarpetas organizadas
IMAGES_DIR = os.path.join(STATIC_MEDIA_DIR, "images")
AUDIO_DIR = os.path.join(STATIC_MEDIA_DIR, "audio")
DOCS_DIR = os.path.join(STATIC_MEDIA_DIR, "documents")
STICKERS_DIR = os.path.join(STATIC_MEDIA_DIR, "stickers")
VIDEOS_DIR = os.path.join(STATIC_MEDIA_DIR, "videos")

# Asegurar existencia de directorios
for folder in [STATIC_MEDIA_DIR, IMAGES_DIR, AUDIO_DIR, DOCS_DIR, STICKERS_DIR, VIDEOS_DIR]:
    os.makedirs(folder, exist_ok=True)

# Mapeo de extensiones por tipo MIME
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/ogg": ".ogg",
    "audio/ogg; codecs=opus": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/amr": ".amr",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "video/mp4": ".mp4",
}

class MediaService:
    """
    Servicio para el almacenamiento seguro, clasificación y despacho de 
    archivos multimedia recibidos y enviados por WhatsApp.
    """

    @staticmethod
    def get_extension_from_mime(mime_type: str, fallback_filename: Optional[str] = None) -> str:
        if fallback_filename and "." in fallback_filename:
            return os.path.splitext(fallback_filename)[1].lower()
        
        cleaned_mime = mime_type.split(";")[0].strip().lower() if mime_type else ""
        if cleaned_mime in MIME_TO_EXT:
            return MIME_TO_EXT[cleaned_mime]
        
        guessed = mimetypes.guess_extension(cleaned_mime)
        return guessed if guessed else ".bin"

    @staticmethod
    def save_media_bytes(
        data: bytes, 
        subfolder: str, 
        mime_type: str = "application/octet-stream", 
        original_filename: Optional[str] = None,
        prefix: str = "wa"
    ) -> Dict[str, Any]:
        """
        Guarda un buffer de bytes en el disco y genera metadatos completos y URLs de acceso.
        """
        if not data:
            raise ValueError("No se proporcionaron bytes para guardar.")

        target_dir = os.path.join(STATIC_MEDIA_DIR, subfolder)
        os.makedirs(target_dir, exist_ok=True)

        ext = MediaService.get_extension_from_mime(mime_type, original_filename)
        unique_name = f"{prefix}_{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
        filepath = os.path.join(target_dir, unique_name)

        with open(filepath, "wb") as f:
            f.write(data)

        file_size = len(data)
        relative_url = f"/static/media/{subfolder}/{unique_name}"
        
        # URL completa para el frontend
        public_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
        base_api_url = os.getenv("API_BASE_URL") or os.getenv("PUBLIC_URL")
        if not base_api_url and public_domain:
            base_api_url = f"https://{public_domain}"
        if not base_api_url:
            base_api_url = "https://crmagenticonube-production.up.railway.app"
        
        full_url = f"{base_api_url}{relative_url}"

        logger.info(f"Archivo multimedia guardado: {filepath} ({file_size} bytes, tipo={mime_type})")

        return {
            "file_path": filepath,
            "file_name": original_filename or unique_name,
            "unique_name": unique_name,
            "relative_url": relative_url,
            "media_url": full_url,
            "file_size_bytes": file_size,
            "mime_type": mime_type,
            "subfolder": subfolder
        }

    @staticmethod
    def save_base64_media(
        base64_str: str,
        subfolder: str,
        mime_type: str = "application/octet-stream",
        original_filename: Optional[str] = None,
        prefix: str = "wa"
    ) -> Dict[str, Any]:
        """
        Decodifica un string base64 o Data URI y lo persiste en el disco.
        """
        import base64
        if not base64_str:
            raise ValueError("Base64 string vacío.")
        
        raw_b64 = base64_str
        if "base64," in raw_b64:
            header, raw_b64 = raw_b64.split("base64,", 1)
            if not mime_type or mime_type == "application/octet-stream":
                if "data:" in header and ";" in header:
                    mime_type = header.split("data:")[1].split(";")[0]

        data = base64.b64decode(raw_b64)
        saved = MediaService.save_media_bytes(
            data=data,
            subfolder=subfolder,
            mime_type=mime_type,
            original_filename=original_filename,
            prefix=prefix
        )
        saved["data_uri"] = f"data:{mime_type};base64,{raw_b64}"
        return saved

    @staticmethod
    def extract_and_download_media(client, message_protobuf, conversacion_id: str = "") -> Optional[Dict[str, Any]]:
        """
        Inspecciona un mensaje de WhatsApp (Protobuf), descarga su contenido binario 
        y devuelve un diccionario estructurado con metadatos y URL pública.
        """
        if not message_protobuf:
            return None

        # 1. Imagen (imageMessage)
        if message_protobuf.imageMessage and message_protobuf.imageMessage.url:
            msg = message_protobuf.imageMessage
            mime = msg.mimetype or "image/jpeg"
            caption = msg.caption or ""
            try:
                data = client.download_any(message_protobuf)
                if data:
                    saved = MediaService.save_media_bytes(
                        data=data,
                        subfolder="images",
                        mime_type=mime,
                        original_filename="imagen.jpg",
                        prefix=f"img_{conversacion_id[:6]}"
                    )
                    saved["tipo"] = "imagen"
                    saved["caption"] = caption
                    return saved
            except Exception as e:
                logger.error(f"Error al descargar imageMessage: {e}")
                return {"tipo": "imagen", "error": str(e), "caption": caption}

        # 2. Audio o Nota de Voz (audioMessage)
        if message_protobuf.audioMessage and message_protobuf.audioMessage.url:
            msg = message_protobuf.audioMessage
            mime = msg.mimetype or "audio/ogg; codecs=opus"
            is_ptt = getattr(msg, "PTT", False) or getattr(msg, "ptt", False) or True
            duration = getattr(msg, "seconds", 0)
            try:
                data = client.download_any(message_protobuf)
                if data:
                    saved = MediaService.save_media_bytes(
                        data=data,
                        subfolder="audio",
                        mime_type=mime,
                        original_filename="audio.ogg" if is_ptt else "audio.mp3",
                        prefix=f"aud_{conversacion_id[:6]}"
                    )
                    saved["tipo"] = "audio"
                    saved["is_voice_note"] = bool(is_ptt)
                    saved["duration_seconds"] = duration
                    return saved
            except Exception as e:
                logger.error(f"Error al descargar audioMessage: {e}")
                return {"tipo": "audio", "error": str(e), "duration_seconds": duration}

        # 3. Documento / PDF / Estudios (documentMessage o documentWithCaptionMessage)
        doc_msg = None
        if message_protobuf.documentMessage and message_protobuf.documentMessage.url:
            doc_msg = message_protobuf.documentMessage
        elif message_protobuf.documentWithCaptionMessage and message_protobuf.documentWithCaptionMessage.message.documentMessage:
            doc_msg = message_protobuf.documentWithCaptionMessage.message.documentMessage

        if doc_msg:
            mime = doc_msg.mimetype or "application/pdf"
            filename = doc_msg.fileName or doc_msg.title or "documento.pdf"
            caption = doc_msg.caption or ""
            try:
                data = client.download_any(message_protobuf)
                if data:
                    saved = MediaService.save_media_bytes(
                        data=data,
                        subfolder="documents",
                        mime_type=mime,
                        original_filename=filename,
                        prefix=f"doc_{conversacion_id[:6]}"
                    )
                    saved["tipo"] = "documento"
                    saved["caption"] = caption
                    saved["file_name"] = filename
                    return saved
            except Exception as e:
                logger.error(f"Error al descargar documentMessage: {e}")
                return {"tipo": "documento", "error": str(e), "file_name": filename, "caption": caption}

        # 4. Sticker (stickerMessage)
        if message_protobuf.stickerMessage and message_protobuf.stickerMessage.url:
            msg = message_protobuf.stickerMessage
            mime = msg.mimetype or "image/webp"
            try:
                data = client.download_any(message_protobuf)
                if data:
                    saved = MediaService.save_media_bytes(
                        data=data,
                        subfolder="stickers",
                        mime_type=mime,
                        original_filename="sticker.webp",
                        prefix=f"stk_{conversacion_id[:6]}"
                    )
                    saved["tipo"] = "sticker"
                    return saved
            except Exception as e:
                logger.error(f"Error al descargar stickerMessage: {e}")
                return {"tipo": "sticker", "error": str(e)}

        # 5. Video (videoMessage)
        if message_protobuf.videoMessage and message_protobuf.videoMessage.url:
            msg = message_protobuf.videoMessage
            mime = msg.mimetype or "video/mp4"
            caption = msg.caption or ""
            try:
                data = client.download_any(message_protobuf)
                if data:
                    saved = MediaService.save_media_bytes(
                        data=data,
                        subfolder="videos",
                        mime_type=mime,
                        original_filename="video.mp4",
                        prefix=f"vid_{conversacion_id[:6]}"
                    )
                    saved["tipo"] = "video"
                    saved["caption"] = caption
                    return saved
            except Exception as e:
                logger.error(f"Error al descargar videoMessage: {e}")
                return {"tipo": "video", "error": str(e), "caption": caption}

        return None

media_service = MediaService()
