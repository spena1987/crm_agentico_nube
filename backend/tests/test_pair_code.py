import pytest
from unittest.mock import MagicMock, patch
from app.whatsapp import WhatsAppManager

def test_solicitar_codigo_vinculacion_mock():
    manager = WhatsAppManager()
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "success": True,
        "phone": "5491112345678",
        "code": "WA5T-7P62",
        "raw_code": "WA5T7P62",
        "expires_in": 120,
        "instructions": ["Abre WhatsApp", "Vincular"]
    }
    
    with patch("httpx.post", return_value=mock_resp), \
         patch.object(manager, "ensure_service_running", return_value=True):
        res = manager.solicitar_codigo_vinculacion("011 15 1234-5678")
        assert res["success"] is True
        assert res["code"] == "WA5T-7P62"
        assert res["phone"].startswith("54911")
        assert "instructions" in res

def test_solicitar_codigo_vinculacion_invalido():
    manager = WhatsAppManager()
    res = manager.solicitar_codigo_vinculacion("123")
    assert "error" in res
