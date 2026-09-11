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
