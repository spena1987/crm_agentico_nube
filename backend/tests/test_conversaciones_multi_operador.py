import os
import jwt
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app

def get_auth_headers():
    secret = os.environ.get('SUPABASE_JWT_SECRET', 'super-secret-jwt-key-for-test-2026-audit')
    token = jwt.encode(
        {'sub': 'user-operator-123', 'email': 'lucia@clinica.com', 'role': 'authenticated', 'aud': 'authenticated', 'exp': 9999999999},
        secret,
        algorithm='HS256'
    )
    return {'Authorization': f'Bearer {token}'}

def test_tomar_conversacion_endpoint():
    client = TestClient(app)
    mock_conv = {
        "id": "conv-100",
        "asignado_a_usuario_id": "user-operator-123",
        "estado_gestion": "EN_GESTION",
        "bot_disabled": True,
        "archivada": False
    }
    with patch("app.main.tomar_conversacion", return_value=mock_conv) as mock_tomar:
        resp = client.post(
            "/api/conversaciones/conv-100/tomar",
            headers=get_auth_headers(),
            json={"usuario_id": "user-operator-123", "nombre_operador": "Lucía Ramos"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["conversacion"]["asignado_a_usuario_id"] == "user-operator-123"
        assert data["conversacion"]["estado_gestion"] == "EN_GESTION"
        mock_tomar.assert_called_once_with("conv-100", "user-operator-123", "Lucía Ramos")

def test_derivar_conversacion_endpoint():
    client = TestClient(app)
    mock_conv = {
        "id": "conv-100",
        "asignado_a_usuario_id": "user-colleague-456",
        "estado_gestion": "EN_GESTION",
        "bot_disabled": True
    }
    with patch("app.main.derivar_conversacion", return_value=mock_conv) as mock_derivar:
        resp = client.post(
            "/api/conversaciones/conv-100/derivar",
            headers=get_auth_headers(),
            json={
                "nuevo_usuario_id": "user-colleague-456",
                "nota_traspaso": "Paciente consulta por presupuesto de catarata.",
                "origen_nombre": "Lucía Ramos",
                "destino_nombre": "Dr. Martínez"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["conversacion"]["asignado_a_usuario_id"] == "user-colleague-456"
        mock_derivar.assert_called_once_with(
            conversacion_id="conv-100",
            nuevo_usuario_id="user-colleague-456",
            nota_traspaso="Paciente consulta por presupuesto de catarata.",
            origen_nombre="Lucía Ramos",
            destino_nombre="Dr. Martínez"
        )

def test_finalizar_conversacion_endpoint():
    client = TestClient(app)
    mock_conv = {
        "id": "conv-100",
        "estado_gestion": "RESUELTO",
        "archivada": True,
        "asignado_a_usuario_id": None,
        "bot_disabled": False
    }
    with patch("app.main.finalizar_conversacion", return_value=mock_conv) as mock_fin:
        resp = client.post(
            "/api/conversaciones/conv-100/finalizar",
            headers=get_auth_headers(),
            json={"usuario_nombre": "Lucía Ramos"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["conversacion"]["estado_gestion"] == "RESUELTO"
        assert data["conversacion"]["bot_disabled"] is False
        mock_fin.assert_called_once_with("conv-100", "Lucía Ramos")

def test_metricas_conversaciones_contextuales():
    client = TestClient(app)
    mock_metrics = {
        "mis_chats": 3,
        "mis_no_leidos": 1,
        "sin_asignar": 5,
        "total_activas": 12,
        "no_leidos_count": 4,
        "total_mensajes_no_leidos": 7,
        "derivados_humano": 8,
        "bot_activos": 4,
        "archivados": 20
    }
    with patch("app.main.obtener_metricas_conversaciones", return_value=mock_metrics) as mock_m:
        resp = client.get(
            "/api/conversaciones/metricas?usuario_id=user-operator-123",
            headers=get_auth_headers()
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mis_chats"] == 3
        assert data["mis_no_leidos"] == 1
        assert data["sin_asignar"] == 5
        mock_m.assert_called_once_with(usuario_id="user-operator-123")

def test_operadores_activos_endpoint():
    client = TestClient(app)
    mock_ops = [
        {"id": "u1", "nombre_completo": "Ana Recepción", "email": "ana@clinica.com", "roles": {"nombre": "Recepción"}},
        {"id": "u2", "nombre_completo": "Dr. Martínez", "email": "martinez@clinica.com", "roles": {"nombre": "Médico"}}
    ]
    with patch("app.main.obtener_operadores_activos", return_value=mock_ops) as mock_get_ops:
        resp = client.get("/api/conversaciones/operadores-activos", headers=get_auth_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["nombre_completo"] == "Ana Recepción"
        mock_get_ops.assert_called_once()
