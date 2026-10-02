import os
import pytest
import jwt
from fastapi.testclient import TestClient

# Configurar variables para pruebas
os.environ["SUPABASE_JWT_SECRET"] = "super-secret-jwt-key-for-test-2026-audit"

from app.main import app

client = TestClient(app)

def get_auth_headers():
    payload = {
        "sub": "test-user-uuid-123",
        "email": "doctor@test.com",
        "role": "authenticated",
        "aud": "authenticated",
        "exp": 9999999999
    }
    token = jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}

def test_iniciar_conversacion_rapida_telefono_requerido():
    """Valida que la modalidad telefono_directo exija número de teléfono."""
    response = client.post(
        "/api/conversaciones/iniciar-rapido",
        json={"modalidad": "telefono_directo"},
        headers=get_auth_headers()
    )
    assert response.status_code == 400
    assert "teléfono" in response.json().get("detail", "").lower()

def test_iniciar_conversacion_rapida_dni_requerido():
    """Valida que la modalidad geclisa_dni exija DNI."""
    response = client.post(
        "/api/conversaciones/iniciar-rapido",
        json={"modalidad": "geclisa_dni"},
        headers=get_auth_headers()
    )
    assert response.status_code == 400
    assert "dni" in response.json().get("detail", "").lower()

def test_iniciar_conversacion_rapida_modalidad_desconocida():
    """Valida que modalidades inválidas sean rechazadas con 400."""
    response = client.post(
        "/api/conversaciones/iniciar-rapido",
        json={"modalidad": "otra_cosa"},
        headers=get_auth_headers()
    )
    assert response.status_code == 400
    assert "desconocida" in response.json().get("detail", "").lower()

def test_iniciar_conversacion_rapida_paciente_id_requerido():
    """Valida que la modalidad paciente_id exija paciente_id."""
    response = client.post(
        "/api/conversaciones/iniciar-rapido",
        json={"modalidad": "paciente_id"},
        headers=get_auth_headers()
    )
    assert response.status_code == 400
    assert "paciente" in response.json().get("detail", "").lower()

def test_es_conversacion_activa_logica():
    """Valida la regla de negocio que excluye conversaciones fantasma sin interacción."""
    from app.db import es_conversacion_activa

    # 1. Conversación vacía generada automáticamente (fantasma) -> False
    fantasma = {
        "id": "conv-1",
        "ultimo_mensaje": None,
        "unread_count": 0,
        "metadata_json": {}
    }
    assert es_conversacion_activa(fantasma) is False

    # 2. Conversación con último mensaje en blanco -> False
    fantasma_vacio = {
        "id": "conv-2",
        "ultimo_mensaje": "   ",
        "unread_count": 0,
        "metadata_json": None
    }
    assert es_conversacion_activa(fantasma_vacio) is False

    # 3. Conversación con mensaje real recibido o enviado -> True
    activa_mensaje = {
        "id": "conv-3",
        "ultimo_mensaje": "Hola doctor, quería consultar un turno",
        "unread_count": 0,
        "metadata_json": {}
    }
    assert es_conversacion_activa(activa_mensaje) is True

    # 4. Conversación iniciada manualmente por operador (clic en botón WhatsApp) -> True
    activa_operador = {
        "id": "conv-4",
        "ultimo_mensaje": None,
        "unread_count": 0,
        "metadata_json": {"iniciada_manualmente": True}
    }
    assert es_conversacion_activa(activa_operador) is True

    # 5. Conversación con mensajes no leídos entrantes -> True
    activa_no_leidos = {
        "id": "conv-5",
        "ultimo_mensaje": None,
        "unread_count": 2,
        "metadata_json": {}
    }
    assert es_conversacion_activa(activa_no_leidos) is True

