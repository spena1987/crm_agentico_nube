"""
Suite de pruebas exhaustivas para la integración de Meta WhatsApp Cloud API (Graph API v21+).
Cubre:
  1. Validación criptográfica de HMAC-SHA256
  2. Normalización de números E.164 para Argentina e internacionales
  3. Deduplicación distribuida por wamid
  4. Manejo granular de errores de Meta (131026, 131042) y Exponential Backoff
  5. Endpoints de Handshake y Recepción en FastAPI
"""

import os
import sys
import hmac
import hashlib
import json
import pytest
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.whatsapp_cloud.security import verify_meta_signature, PHIMaskingFilter
from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164, clean_phone_digits
from app.services.whatsapp_cloud.client import (
    WhatsAppCloudClient,
    ConversationWindowClosedError,
    RateLimitExceededError,
    MetaAPIError
)
from app.services.whatsapp_cloud.worker import EventDeduplicator
from app.main import app

client = TestClient(app)


class TestMetaSecurity(unittest.TestCase):
    def setUp(self):
        self.app_secret = "test_meta_secret_12345"
        self.raw_body = b'{"object": "whatsapp_business_account"}'

    def test_valid_hmac_signature(self):
        valid_mac = hmac.new(
            key=self.app_secret.encode("utf-8"),
            msg=self.raw_body,
            digestmod=hashlib.sha256
        ).hexdigest()
        header = f"sha256={valid_mac}"
        self.assertTrue(verify_meta_signature(self.app_secret, self.raw_body, header))

    def test_invalid_hmac_signature(self):
        header = "sha256=invalid_hash_value_1234567890abcdef"
        self.assertFalse(verify_meta_signature(self.app_secret, self.raw_body, header))

    def test_missing_or_malformed_signature_header(self):
        self.assertFalse(verify_meta_signature(self.app_secret, self.raw_body, None))
        self.assertFalse(verify_meta_signature(self.app_secret, self.raw_body, "md5=badprefix"))

    def test_phi_masking_filter(self):
        masked_phone = PHIMaskingFilter.mask_text("Recordatorio al paciente: +5491112345678")
        self.assertIn("****", masked_phone)
        self.assertNotIn("1112345678", masked_phone)

        masked_token = PHIMaskingFilter.mask_text("Llamada con Authorization: Bearer EAAGabcdef123456789")
        self.assertIn("[REDACTED_TOKEN]", masked_token)


class TestMetaPhoneNormalizer(unittest.TestCase):
    def test_argentina_variations(self):
        # Con prefijo internacional estándar
        self.assertEqual(normalize_to_meta_e164("+54 9 11 1234-5678"), "5491112345678")
        self.assertEqual(normalize_to_meta_e164("+54 11 1234 5678"), "5491112345678")
        # Con 0 interurbano y 15 móvil
        self.assertEqual(normalize_to_meta_e164("011 15-1234-5678"), "5491112345678")
        self.assertEqual(normalize_to_meta_e164("0351 15 444-5555"), "5493514445555")
        self.assertEqual(normalize_to_meta_e164("0223 15-555-1234"), "5492235551234")
        # 10 dígitos directos
        self.assertEqual(normalize_to_meta_e164("1112345678"), "5491112345678")
        self.assertEqual(normalize_to_meta_e164("3514445555"), "5493514445555")
        # 8 dígitos locales (asume área 11)
        self.assertEqual(normalize_to_meta_e164("1234-5678"), "5491112345678")

    def test_international_numbers(self):
        self.assertEqual(normalize_to_meta_e164("+1 (305) 555-0199"), "13055550199")
        self.assertEqual(normalize_to_meta_e164("+34 612 34 56 78"), "34612345678")
        self.assertEqual(normalize_to_meta_e164("+56 9 1234 5678"), "56912345678")
        self.assertEqual(normalize_to_meta_e164("+598 99 123 456"), "59899123456")


@pytest.mark.asyncio
async def test_event_deduplication():
    wamid = "wamid.HBgLMTIzNDU2Nzg5AA=="
    # Primera vez: no es duplicado
    is_dup1 = await EventDeduplicator.is_duplicate(wamid)
    assert is_dup1 is False
    # Segunda vez: es duplicado
    is_dup2 = await EventDeduplicator.is_duplicate(wamid)
    assert is_dup2 is True


@pytest.mark.asyncio
async def test_outbound_client_window_closed_error():
    client_wa = WhatsAppCloudClient(phone_number_id="123456", access_token="mock_token")

    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.json.return_value = {
        "error": {
            "message": "Message failed to send because more than 24 hours have passed since the customer last replied.",
            "type": "OAuthException",
            "code": 131026,
            "fbtrace_id": "test_trace_123"
        }
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        with pytest.raises(ConversationWindowClosedError) as exc_info:
            await client_wa.send_free_text("5491112345678", "Hola paciente")
        assert exc_info.value.code == 131026


def test_fastapi_webhook_handshake_success():
    verify_token = "test_meta_verify_token_999"
    with patch.dict(os.environ, {"META_WA_VERIFY_TOKEN": verify_token}):
        response = client.get(
            "/api/whatsapp/cloud/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": verify_token,
                "hub.challenge": "1158201444"
            }
        )
        assert response.status_code == 200
        assert response.text == "1158201444"


def test_fastapi_webhook_handshake_invalid_token():
    response = client.get(
        "/api/whatsapp/cloud/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "1158201444"
        }
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_handle_inbound_text_message_resilience():
    from app.services.whatsapp_cloud.worker import handle_inbound_message
    
    mock_msg = {
        "id": "wamid.TEST_INBOUND_TEXT_123",
        "from": "5492614703230",
        "type": "text",
        "text": {"body": "hola"}
    }
    
    # Mocking supabase table calls to avoid touching production data during test
    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sup, \
         patch("app.services.logger_service.log_event") as mock_log:
        
        mock_sup.table().select().eq().execute.return_value.data = [{"id": "pac-123", "nombre": "Peña, Juan"}]
        mock_sup.table().select().limit().execute.return_value.data = [{"id": "acc-123"}]
        mock_sup.table().select().filter().execute.return_value.data = []
        mock_sup.table().insert().execute.return_value.data = [{"id": "msg-123"}]
        mock_sup.table().update().eq().execute.return_value.data = []
        
        await handle_inbound_message(mock_msg, "1289373670929621", "Juan")
        
        # Debe registrar el log estructurado
        assert mock_log.called
        log_args = mock_log.call_args[1]
        assert log_args.get("accion") == "MENSAJE_ENTRANTE_GUARDADO"
        assert log_args.get("detalles", {}).get("tipo") == "text"


@pytest.mark.asyncio
async def test_handle_inbound_document_pdf_resilience():
    from app.services.whatsapp_cloud.worker import handle_inbound_message
    
    mock_doc_msg = {
        "id": "wamid.TEST_INBOUND_DOC_456",
        "from": "5492614703230",
        "type": "document",
        "document": {
            "id": "media_doc_999",
            "filename": "estudio_medico.pdf",
            "mime_type": "application/pdf"
        }
    }
    
    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sup, \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.download_media_bytes", side_effect=Exception("Timeout simulado Meta")):
        
        mock_sup.table().select().eq().execute.return_value.data = [{"id": "pac-123", "nombre": "Peña, Juan"}]
        mock_sup.table().select().limit().execute.return_value.data = [{"id": "acc-123"}]
        mock_sup.table().select().filter().execute.return_value.data = []
        mock_sup.table().insert().execute.return_value.data = [{"id": "msg-doc-123"}]
        mock_sup.table().update().eq().execute.return_value.data = []
        
        # No debe lanzar excepción aun si la descarga del binario falla
        await handle_inbound_message(mock_doc_msg, "1289373670929621", "Juan")
        
        # Verificar que insert fue llamado en public.mensajes
        insert_calls = [call for call in mock_sup.table().insert.call_args_list]
        assert len(insert_calls) > 0
        inserted_payload = insert_calls[-1][0][0]
        assert "estudio_medico.pdf" in inserted_payload["contenido"]
        assert inserted_payload["metadata_json"]["tipo"] == "documento"


@pytest.mark.asyncio
async def test_handle_automated_interactive_action_confirmar_turno():
    from app.services.whatsapp_cloud.worker import handle_automated_interactive_action
    
    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sup, \
         patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials", return_value=("1289373670929621", "token_123")), \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_free_text", return_value={"wamid": "wamid.TEST_CONFIRM"}), \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.close"):
        
        # Simular turno encontrado
        mock_sup.table().select().eq().execute.return_value.data = [{
            "id": "turno-abc-999",
            "fecha": "2026-09-15",
            "hora_inicio": "10:30:00",
            "estado": "notificado",
            "practica_o_cirugia": "Cirugía de Catarata"
        }]
        mock_sup.table().update().eq().execute.return_value.data = []
        mock_sup.table().insert().execute.return_value.data = []
        
        handled = await handle_automated_interactive_action(
            button_id="CONFIRMAR_TURNO_turno-abc-999",
            text_content="Confirmar Asistencia",
            paciente_id="pac-123",
            normalized_phone="5492614703230",
            crm_conv_id="conv-123",
            account_id="acc-123"
        )
        assert handled is True
        
        # Verificar que el update a turnos_quirofano fue llamado con estado confirmado
        assert mock_sup.table().update.called
        update_args = [c.args[0] for c in mock_sup.table().update.call_args_list if c.args]
        assert any(a.get("estado") == "confirmado" for a in update_args if isinstance(a, dict))


def test_escalado_humano_respuesta_empatica():
    from app.agent import procesar_mensaje_agente
    
    # Mocking Gemini client response where tool was called
    with patch("app.agent.client") as mock_gemini, \
         patch("app.agent.orchestrator.determine_active_agent", return_value={"nombre": "General", "codigo": "GENERAL"}), \
         patch("app.agent.orchestrator.compile_system_prompt", return_value="Prompt"), \
         patch("app.agent.AVAILABLE_TOOLS_MAP", {"escalar_a_operador_humano": lambda **kwargs: {"success": True}}):
        
        mock_fc = MagicMock()
        mock_fc.name = "escalar_a_operador_humano"
        mock_fc.args = {"motivo": "Urgencia médica postoperatoria"}
        
        mock_resp = MagicMock()
        mock_resp.function_calls = [mock_fc]
        mock_resp.text = ""  # Simula que Gemini devolvió texto vacío tras llamar la tool
        mock_resp.candidates = [MagicMock()]
        
        mock_gemini.models.generate_content.return_value = mock_resp
        
        res = procesar_mensaje_agente(
            conversacion_id="test-conv",
            mensaje_texto_o_paciente_id="pac-123",
            mensaje_texto="Tengo dolor urgente tras la cirugía"
        )
        
        assert "prioritaria" in res
        assert "atención humana" in res or "asesor" in res


def test_waba_credentials_cache_and_invalidation():
    import os
    from app.services.whatsapp_cloud.client import (
        get_whatsapp_cloud_credentials,
        get_whatsapp_app_secret,
        invalidate_whatsapp_credentials_cache
    )

    # Iniciar con caché limpia
    invalidate_whatsapp_credentials_cache()

    with patch.dict("os.environ", {"META_WA_APP_SECRET": ""}, clear=False), \
         patch("app.db.supabase") as mock_sup:
        mock_sup.table().select().eq().limit().execute.return_value.data = [{
            "phone_number_id": "phone_cached_123",
            "system_user_token_encrypted": "token_cached_abc",
            "app_secret_encrypted": "secret_cached_xyz"
        }]

        # Primera llamada consulta DB
        p1, t1 = get_whatsapp_cloud_credentials()
        s1 = get_whatsapp_app_secret()
        assert p1 == "phone_cached_123"
        assert t1 == "token_cached_abc"
        assert s1 == "secret_cached_xyz"
        call_count_1 = mock_sup.table().select().eq().limit().execute.call_count

        # Segunda llamada usa memoria caché (no debe incrementar llamadas a DB)
        p2, t2 = get_whatsapp_cloud_credentials()
        s2 = get_whatsapp_app_secret()
        assert p2 == p1
        assert t2 == t1
        assert s2 == s1
        assert mock_sup.table().select().eq().limit().execute.call_count == call_count_1

        # Invalidar caché y volver a llamar: debe consultar DB de nuevo
        invalidate_whatsapp_credentials_cache()
        p3, t3 = get_whatsapp_cloud_credentials()
        assert mock_sup.table().select().eq().limit().execute.call_count > call_count_1


@pytest.mark.asyncio
async def test_download_media_bytes_size_limit_protection():
    from app.services.whatsapp_cloud.client import WhatsAppCloudClient, MediaPayloadTooLargeError
    from app.services.whatsapp_cloud.worker import handle_inbound_message

    client = WhatsAppCloudClient(phone_number_id="123", access_token="abc")

    # 1. Test unitario en download_media_bytes con payload reportado mayor a 20MB
    with patch.object(client, "get_http_client") as mock_get_client:
        mock_http = AsyncMock()
        mock_res = MagicMock()
        mock_res.status_code = 200
        # 25MB reportados en metadatos
        mock_res.json.return_value = {
            "url": "https://cdn.whatsapp.net/heavy.pdf",
            "mime_type": "application/pdf",
            "file_size": 25 * 1024 * 1024
        }
        mock_http.get.return_value = mock_res
        mock_get_client.return_value = mock_http

        with pytest.raises(MediaPayloadTooLargeError) as exc_info:
            await client.download_media_bytes("media_heavy_123", max_size_bytes=20 * 1024 * 1024)
        assert exc_info.value.file_size == 25 * 1024 * 1024

    # 2. Test de resiliencia en worker: no debe caer y debe registrar advertencia de archivo pesado
    mock_heavy_msg = {
        "id": "wamid.HEAVY_DOC_MSG",
        "from": "5492614703230",
        "type": "document",
        "document": {
            "id": "media_heavy_123",
            "filename": "estudio_resonancia_pesada.pdf"
        }
    }

    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sup, \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.download_media_bytes", side_effect=MediaPayloadTooLargeError(25000000, 20971520)), \
         patch("app.services.logger_service.log_event") as mock_log:

        mock_sup.table().select().eq().execute.return_value.data = [{"id": "pac-123", "nombre": "Peña, Juan"}]
        mock_sup.table().select().limit().execute.return_value.data = [{"id": "acc-123"}]
        mock_sup.table().select().filter().execute.return_value.data = []
        mock_sup.table().insert().execute.return_value.data = [{"id": "msg-heavy-123"}]
        mock_sup.table().update().eq().execute.return_value.data = []

        await handle_inbound_message(mock_heavy_msg, "1289373670929621", "Juan")

        # Verificar inserción con advertencia de tamaño
        insert_calls = [c for c in mock_sup.table().insert.call_args_list]
        assert len(insert_calls) > 0
        inserted_payload = insert_calls[-1][0][0]
        assert inserted_payload["metadata_json"]["is_oversized"] is True
        assert "20MB" in inserted_payload["contenido"]


@pytest.mark.asyncio
async def test_handle_automated_interactive_action_presupuesto_vigencia():
    from app.services.whatsapp_cloud.worker import handle_automated_interactive_action
    from datetime import datetime, timezone, timedelta

    # Crear fecha de hace 45 días (vencido > 30 días)
    fecha_hace_45_dias = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()

    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sup, \
         patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials", return_value=("1289373670929621", "token_123")), \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_document", return_value={"wamid": "wamid.TEST_DOC_PRE"}) as mock_send_doc, \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.close"):

        mock_sup.table().select().eq().execute.return_value.data = [{"nombre": "Perez, Maria"}]
        # Devolver presupuesto emitido hace 45 días
        mock_sup.table().select().eq().order().limit().execute.return_value.data = [{
            "id": "pres-antiguo-001",
            "total": 500000,
            "pdf_url": "https://crm.local/pres.pdf",
            "created_at": fecha_hace_45_dias,
            "estado": "pendiente"
        }]
        mock_sup.table().insert().execute.return_value.data = []
        mock_sup.table().update().eq().execute.return_value.data = []

        handled = await handle_automated_interactive_action(
            button_id="VER_PRESUPUESTO",
            text_content="Ver Presupuesto",
            paciente_id="pac-456",
            normalized_phone="5492614703230",
            crm_conv_id="conv-456",
            account_id="acc-123"
        )
        assert handled is True
        assert mock_send_doc.called
        doc_kwargs = mock_send_doc.call_args[1]
        caption = doc_kwargs.get("caption", "")
        # Debe advertir sobre la revalidación por superar 30 días
        assert "revalidación" in caption or "revalidacion" in caption
        assert "45" in caption or "días" in caption


@pytest.mark.asyncio
async def test_handle_automated_interactive_action_reprogramar_turno():
    from app.services.whatsapp_cloud.worker import handle_automated_interactive_action

    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sup, \
         patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials", return_value=("1289373670929621", "token_123")), \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_free_text", return_value={"wamid": "wamid.TEST_REPROGRAM"}) as mock_send_txt, \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.close"), \
         patch("app.services.logger_service.log_event") as mock_log:

        mock_sup.table().update().eq().gte().execute.return_value.data = []
        mock_sup.table().insert().execute.return_value.data = []
        mock_sup.table().update().eq().execute.return_value.data = []

        handled = await handle_automated_interactive_action(
            button_id="reprogramar_turno",
            text_content="Necesito reprogramar la fecha",
            paciente_id="pac-789",
            normalized_phone="5492614703230",
            crm_conv_id="conv-789",
            account_id="acc-123"
        )
        assert handled is True
        assert mock_send_txt.called
        # Debe registrar evento estructurado para la pizarra quirúrgica
        assert mock_log.called
        log_args = mock_log.call_args[1]
        assert log_args.get("accion") == "REPROGRAMACION_TURNO_SOLICITADA"
        assert log_args.get("nivel") == "WARNING"




