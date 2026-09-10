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

def test_qr_cache_and_reactive_update():
    manager = WhatsAppManager()
    test_qr_b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    manager.set_cached_qr(b64=test_qr_b64, pairing_code='1234-5678')
    assert manager._cached_qr_uri == test_qr_b64
    assert manager._cached_pairing_code == '1234-5678'
    assert manager.status == 'PAIRING_QR_READY'
    with patch('httpx.get') as mock_get:
        qr_data = manager.get_qr_data(force_refresh=False)
        assert mock_get.call_count == 0
        assert qr_data['qr_data_uri'] == test_qr_b64
        assert qr_data['pairing_code'] == '1234-5678'
        assert qr_data['status'] == 'PAIRING_QR_READY'

def test_handle_connection_update():
    manager = WhatsAppManager()
    manager.handle_connection_update('open')
    assert manager.status == 'CONNECTED'
    assert manager._cached_qr_uri is None
    manager.handle_connection_update('connecting')
    assert manager.status == 'PAIRING_QR_READY'
    with patch.object(manager, 'purgar_y_recrear_instancia'):
        manager.handle_connection_update('close', {'statusCode': 401})
        assert manager.status == 'DISCONNECTED'

def test_enviar_presencia():
    manager = WhatsAppManager()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    with patch('httpx.post', return_value=mock_resp) as mock_post:
        ok = manager.enviar_presencia('5492614703230@s.whatsapp.net', 'composing')
        assert ok is True
        assert mock_post.call_count == 1
        call_args = mock_post.call_args
        assert call_args[1]['json']['presence'] == 'composing'
        assert '5492614703230@s.whatsapp.net' in call_args[1]['json']['number']

def test_presencia_endpoint():
    client = TestClient(app)
    with patch('app.whatsapp.whatsapp_manager.enviar_presencia', return_value=True) as mock_presence,          patch('app.main.get_active_jid_for_paciente_o_conversacion', return_value='5492614703230@s.whatsapp.net'):
        resp = client.post(
            '/api/conversaciones/conv_test_123/presencia',
            json={'presence': 'composing'},
            headers=get_auth_headers()
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['success'] is True
        assert mock_presence.call_count == 1
