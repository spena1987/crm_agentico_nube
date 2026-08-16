import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

from app.db import supabase
from app.agent import transcribir_audio_con_gemini

logger = logging.getLogger(__name__)

def extract_storage_path(media_url: str) -> Optional[str]:
    """
    Extrae la ruta interna dentro del bucket 'whatsapp-media' a partir de una URL de Supabase Storage.
    Ejemplo:
      https://xxx.supabase.co/storage/v1/object/public/whatsapp-media/media/audio_123.ogg -> 'media/audio_123.ogg'
    """
    if not media_url:
        return None
    try:
        marker = "/whatsapp-media/"
        if marker in media_url:
            path = media_url.split(marker, 1)[1]
            return path.split("?")[0]
        parsed = urlparse(media_url)
        if "/object/public/whatsapp-media/" in parsed.path:
            return parsed.path.split("/object/public/whatsapp-media/")[1]
    except Exception as e:
        logger.warning(f"No se pudo extraer path de Storage para URL {media_url}: {e}")
    return None

def purgar_archivos_antiguos(dias_retencion: int = 30, dry_run: bool = False) -> Dict[str, Any]:
    """
    Identifica mensajes con archivos multimedia creados hace más de `dias_retencion` días:
    1. Si es un audio y NO está transcripto, Gemini lo transcribe automáticamente para preservar el texto.
    2. Elimina el archivo binario pesado de Supabase Storage.
    3. Marca el metadata_json con `media_purged=True` y la fecha de purga.
    """
    if not supabase:
        logger.warning("Supabase no configurado para ejecutar purga de archivos.")
        return {"error": "Supabase no configurado"}

    ahora = datetime.now(timezone.utc)
    fecha_limite = ahora - timedelta(days=dias_retencion)
    fecha_limite_iso = fecha_limite.isoformat()

    logger.info(f"Iniciando purga de archivos multimedia con antigüedad > {dias_retencion} días (anteriores a {fecha_limite_iso}). DryRun={dry_run}")

    stats = {
        "dias_retencion": dias_retencion,
        "fecha_limite": fecha_limite_iso,
        "mensajes_evaluados": 0,
        "archivos_purgados": 0,
        "audios_autotranscritos": 0,
        "errores": 0,
        "dry_run": dry_run
    }

    try:
        # Consultar mensajes creados antes de la fecha límite
        res = supabase.table("mensajes").select("*").lt("created_at", fecha_limite_iso).order("created_at", desc=False).execute()
        mensajes_candidatos = res.data or []

        for msg in mensajes_candidatos:
            msg_id = msg["id"]
            meta = msg.get("metadata_json") or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}

            # Verificar si tiene archivo multimedia y aún no fue purgado
            media_url = meta.get("media_url") or meta.get("relative_url")
            is_purged = meta.get("media_purged", False)

            if not media_url or is_purged:
                continue

            stats["mensajes_evaluados"] += 1
            tipo = meta.get("tipo", "archivo")

            # 1. AUTO-TRANSCRIPCIÓN DE AUDIOS ANTES DE BORRAR EL ARCHIVO
            if tipo == "audio" and not meta.get("transcripcion"):
                try:
                    logger.info(f"Auto-transcribiendo audio antiguo antes de purgar (Mensaje {msg_id})...")
                    audio_target_url = media_url
                    if not audio_target_url.startswith("http"):
                        base_api = os.getenv("API_BASE_URL", "http://localhost:8000")
                        audio_target_url = f"{base_api.rstrip('/')}/{audio_target_url.lstrip('/')}"

                    transcript = transcribir_audio_con_gemini(audio_target_url)
                    if transcript:
                        meta["transcripcion"] = transcript
                        stats["audios_autotranscritos"] += 1
                        logger.info(f"Audio mensaje {msg_id} transcripto con éxito: {transcript[:50]}...")
                except Exception as trans_err:
                    logger.warning(f"No se pudo auto-transcribir audio mensaje {msg_id}: {trans_err}")

            # 2. ELIMINAR ARCHIVO DEL STORAGE DE SUPABASE
            storage_path = extract_storage_path(media_url)
            if storage_path and not dry_run:
                try:
                    logger.info(f"Eliminando archivo de Supabase Storage: {storage_path}")
                    remove_res = supabase.storage.from_("whatsapp-media").remove([storage_path])
                    logger.info(f"Respuesta de eliminación de Storage: {remove_res}")
                except Exception as del_err:
                    logger.error(f"Error al eliminar de Storage {storage_path}: {del_err}")
                    stats["errores"] += 1

            # 3. ACTUALIZAR METADATA EN LA BASE DE DATOS
            if not dry_run:
                meta["media_purged"] = True
                meta["purged_at"] = ahora.isoformat()
                meta["original_media_url"] = media_url

                try:
                    supabase.table("mensajes").update({"metadata_json": meta}).eq("id", msg_id).execute()
                    stats["archivos_purgados"] += 1
                except Exception as update_err:
                    logger.error(f"Error actualizando mensaje {msg_id} tras purga: {update_err}")
                    stats["errores"] += 1
            else:
                stats["archivos_purgados"] += 1

        logger.info(f"Purga de multimedia finalizada: {stats}")
        return stats

    except Exception as e:
        logger.error(f"Error durante el proceso de purga de multimedia: {e}", exc_info=True)
        stats["error"] = str(e)
        return stats

def obtener_estadisticas_storage() -> Dict[str, Any]:
    """
    Retorna métricas del bucket 'whatsapp-media' de Supabase Storage y mensajes con archivos.
    """
    if not supabase:
        return {"error": "Supabase no configurado"}

    try:
        # Listar carpetas en el bucket
        files_media = supabase.storage.from_("whatsapp-media").list("media") or []
        files_audios = supabase.storage.from_("whatsapp-media").list("audios") or []
        files_images = supabase.storage.from_("whatsapp-media").list("images") or []
        files_documents = supabase.storage.from_("whatsapp-media").list("documents") or []

        all_files = files_media + files_audios + files_images + files_documents
        total_bytes = 0
        for f in all_files:
            meta = f.get("metadata") or {}
            size = meta.get("size", 0)
            if isinstance(size, (int, float)):
                total_bytes += size

        # Conteo de mensajes con media
        res_msgs = supabase.table("mensajes").select("id, metadata_json").not_.is_("metadata_json", "null").execute()
        msgs = res_msgs.data or []
        
        media_count = 0
        purged_count = 0
        transcribed_audios = 0

        for m in msgs:
            meta = m.get("metadata_json") or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            if meta.get("media_url") or meta.get("tipo") in ["audio", "imagen", "documento"]:
                media_count += 1
                if meta.get("media_purged"):
                    purged_count += 1
                if meta.get("transcripcion"):
                    transcribed_audios += 1

        return {
            "total_archivos_storage": len(all_files),
            "espacio_total_bytes": total_bytes,
            "espacio_total_mb": round(total_bytes / (1024 * 1024), 2),
            "total_mensajes_con_media": media_count,
            "mensajes_purgados": purged_count,
            "audios_transcriptos": transcribed_audios
        }
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas de storage: {e}")
        return {"error": str(e)}
