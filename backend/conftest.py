import os
import sys
import pytest
import jwt
from fastapi.testclient import TestClient

# Asegurar que el directorio backend está en sys.path
backend_dir = os.path.abspath(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configurar variables de entorno para tests
TEST_JWT_SECRET = "super-secret-jwt-key-for-test-2026-audit"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["EVOLUTION_API_KEY"] = "test_evolution_token_123"

def make_test_token(user_id: str = "test-user-uuid-123", email: str = "test@clinica.com", role: str = "authenticated"):
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "aud": "authenticated",
        "exp": 9999999999
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")

@pytest.fixture(scope="session")
def auth_headers():
    token = make_test_token()
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def client(auth_headers):
    from app.main import app
    c = TestClient(app)
    # Inyectar headers de autenticación por defecto en las peticiones del cliente de pruebas
    original_request = c.request
    def authenticated_request(method, url, **kwargs):
        headers = dict(kwargs.get("headers") or {})
        if "Authorization" not in headers and "authorization" not in headers:
            headers["Authorization"] = auth_headers["Authorization"]
        kwargs["headers"] = headers
        return original_request(method, url, **kwargs)
    c.request = authenticated_request
    return c
