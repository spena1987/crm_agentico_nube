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
