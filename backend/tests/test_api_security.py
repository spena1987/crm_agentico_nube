import os
import pytest
import jwt
from fastapi.testclient import TestClient

# Configurar variables para pruebas
os.environ["SUPABASE_JWT_SECRET"] = "super-secret-jwt-key-for-test-2026-audit"
os.environ["EVOLUTION_API_KEY"] = "test_evolution_token_123"

# Recargar auth con las nuevas variables
from app.auth import decode_supabase_jwt, SUPABASE_JWT_SECRET
from app.main import app

client = TestClient(app)

def generate_test_jwt(user_id: str = "test-user-uuid-123", email: str = "doctor@test.com", role: str = "authenticated"):
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "aud": "authenticated",
        "exp": 9999999999
    }
    return jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")

def test_unauthenticated_request_is_blocked_with_401():
    """Verifica que cualquier llamada a /api/* sin token Bearer sea rechazada con 401."""
    response = client.get("/api/quirofanos")
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data
    assert "no autorizado" in data["detail"].lower()

def test_invalid_token_is_rejected_with_401():
    """Verifica que un token malformado o firmado con clave incorrecta devuelva 401."""
    response = client.get(
        "/api/turnos-quirofano",
        headers={"Authorization": "Bearer token.completamente.invalido"}
    )
    assert response.status_code == 401
    assert "inválido" in response.json().get("detail", "").lower() or "token" in response.json().get("detail", "").lower()

def test_public_consent_endpoint_is_accessible_without_auth():
    """Verifica que las rutas de consentimiento público para pacientes no exijan token Bearer."""
    response = client.get("/api/consentimiento-publico/test-token-inexistente")
    # No debe retornar 401; retornará 404 (token no encontrado) o 200, demostrando que la ruta es pública
    assert response.status_code != 401

def test_webhook_unauthorized_without_secret():
    """Verifica que el webhook entrante de WhatsApp rechace peticiones sin la clave secreta con 403."""
    response = client.post(
        "/api/whatsapp/webhook/incoming",
        json={"event": "TEST"}
    )
    assert response.status_code == 403
    assert "inválida" in response.json().get("detail", "").lower() or "ausente" in response.json().get("detail", "").lower()

def test_webhook_authorized_with_secret():
    """Verifica que el webhook entrante permita el paso cuando se envía la clave autorizada en headers."""
    response = client.post(
        "/api/whatsapp/webhook/incoming",
        json={"event": "TEST"},
        headers={"apikey": "test_evolution_token_123"}
    )
    # No debe ser 403
    assert response.status_code != 403

def test_authenticated_request_with_valid_jwt_passes():
    """Verifica que una petición con token Bearer válido atraviese el middleware de seguridad."""
    valid_token = generate_test_jwt()
    response = client.get(
        "/api/quirofanos",
        headers={"Authorization": f"Bearer {valid_token}"}
    )
    # Debe ser 200 OK
    assert response.status_code == 200
