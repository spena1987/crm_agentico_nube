import pytest
from unittest.mock import MagicMock, patch
from app.whatsapp import WhatsAppManager

def test_solicitar_codigo_vinculacion_mock():
    manager = WhatsAppManager()
    res = manager.solicitar_codigo_vinculacion("011 15 1234-5678")
    assert "error" in res
    assert "Meta Cloud API" in res["error"]

def test_solicitar_codigo_vinculacion_invalido():
    manager = WhatsAppManager()
    res = manager.solicitar_codigo_vinculacion("123")
    assert "error" in res

