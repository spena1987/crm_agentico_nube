import pytest
from app.main import unwrap_whatsapp_message

def test_unwrap_plain_conversation():
    payload = {"conversation": "Hola doctor"}
    unwrapped = unwrap_whatsapp_message(payload)
    assert unwrapped.get("conversation") == "Hola doctor"

def test_unwrap_iphone_ephemeral_conversation():
    payload = {
        "ephemeralMessage": {
            "message": {
                "conversation": "Hola desde mi iPhone con mensajes temporales",
                "messageContextInfo": {
                    "deviceListMetadata": {"senderKeyHash": "123"}
                }
            }
        }
    }
    unwrapped = unwrap_whatsapp_message(payload)
    assert unwrapped.get("conversation") == "Hola desde mi iPhone con mensajes temporales"

def test_unwrap_iphone_ephemeral_extended_text():
    payload = {
        "ephemeralMessage": {
            "message": {
                "extendedTextMessage": {
                    "text": "Consulta sobre presupuesto quirúrgico"
                }
            }
        }
    }
    unwrapped = unwrap_whatsapp_message(payload)
    assert unwrapped.get("extendedTextMessage", {}).get("text") == "Consulta sobre presupuesto quirúrgico"

def test_unwrap_iphone_view_once():
    payload = {
        "viewOnceMessage": {
            "message": {
                "imageMessage": {
                    "caption": "Estudio adjunto",
                    "mimetype": "image/jpeg"
                }
            }
        }
    }
    unwrapped = unwrap_whatsapp_message(payload)
    assert unwrapped.get("imageMessage", {}).get("caption") == "Estudio adjunto"

def test_unwrap_iphone_view_once_v2():
    payload = {
        "viewOnceMessageV2": {
            "message": {
                "imageMessage": {
                    "caption": "Foto de análisis",
                    "mimetype": "image/jpeg"
                }
            }
        }
    }
    unwrapped = unwrap_whatsapp_message(payload)
    assert unwrapped.get("imageMessage", {}).get("caption") == "Foto de análisis"

def test_unwrap_document_with_caption():
    payload = {
        "documentWithCaptionMessage": {
            "message": {
                "documentMessage": {
                    "fileName": "orden_medica.pdf",
                    "caption": "Orden del médico"
                }
            }
        }
    }
    unwrapped = unwrap_whatsapp_message(payload)
    assert unwrapped.get("documentMessage", {}).get("fileName") == "orden_medica.pdf"

def test_unwrap_nested_ephemeral_view_once():
    payload = {
        "ephemeralMessage": {
            "message": {
                "viewOnceMessage": {
                    "message": {
                        "conversation": "Doble encapsulamiento"
                    }
                }
            }
        }
    }
    unwrapped = unwrap_whatsapp_message(payload)
    assert unwrapped.get("conversation") == "Doble encapsulamiento"
