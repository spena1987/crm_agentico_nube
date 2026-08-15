import pytest
from unittest.mock import MagicMock, patch
from app.whatsapp import WhatsAppManager

def test_solicitar_codigo_vinculacion_mock():
    manager = WhatsAppManager()
    manager.client = MagicMock()
    manager.client.is_connected = True
    manager.client.PairPhone.return_value = "ABCD1234"
    
    with patch("app.whatsapp.NEONIZE_AVAILABLE", True):
        res = manager.solicitar_codigo_vinculacion("011 15 1234-5678")
        assert res["success"] is True
        assert res["code"] == "ABCD-1234"
        assert res["raw_code"] == "ABCD1234"
        assert res["phone"].startswith("54911")
        assert "instructions" in res
        assert len(res["instructions"]) >= 4

def test_solicitar_codigo_vinculacion_invalido():
    manager = WhatsAppManager()
    res = manager.solicitar_codigo_vinculacion("123")
    assert "error" in res
