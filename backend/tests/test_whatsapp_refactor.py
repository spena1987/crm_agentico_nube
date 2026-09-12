import os
import jwt
import pytest
import time
from unittest.mock import MagicMock, patch
from app.whatsapp import WhatsAppManager
from fastapi.testclient import TestClient
from app.main import app

def get_auth_headers():
    secret = os.environ.get('SUPABASE_JWT_SECRET', 'super-secret-jwt-key-for-test-2026-audit')
    token = jwt.encode(
        {'sub': 'test-operator', 'email': 'operador@test.com', 'role': 'authenticated', 'aud': 'authenticated', 'exp': 9999999999},
        secret,
        algorithm='HS256'
    )
    return {'Authorization': f'Bearer {token}'}

def test_meta_cloud_status_and_qr_not_required():
    manager = WhatsAppManager()
    status = manager.get_status()
    assert status["requires_qr"] is False
    assert "Meta WhatsApp Cloud API" in status["engine"]

    qr_data = manager.get_qr_data()
    assert qr_data["requires_qr"] is False
    assert qr_data["qr_data_uri"] is None

def test_enviar_presencia_meta_cloud():
    manager = WhatsAppManager()
    ok = manager.enviar_presencia('5492614703230@s.whatsapp.net', 'composing')
    assert ok is True

def test_presencia_endpoint():
    client = TestClient(app)
    with patch('app.main.get_active_jid_for_paciente_o_conversacion', return_value='5492614703230'), \
         patch('app.whatsapp.whatsapp_manager.enviar_presencia', return_value=True) as mock_presence:
        resp = client.post(
            '/api/conversaciones/conv_test_123/presencia',
            headers=get_auth_headers(),
            json={'presence': 'composing'}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get('success') is True
        assert mock_presence.call_count == 1
