import os
import pytest
import jwt
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

os.environ["SUPABASE_JWT_SECRET"] = "super-secret-jwt-key-for-test-2026-audit"
os.environ["EVOLUTION_API_KEY"] = "test_evolution_token_123"

from app.auth import decode_supabase_jwt
from app.main import (
    app,
    normalizar_torico_valor,
    normalizar_torico_eje,
    validar_y_normalizar_dioptria
)

client = TestClient(app)

def generate_test_jwt(email: str = "cirujano@test.com", role: str = "authenticated"):
    payload = {
        "sub": "user-uuid-12345",
        "email": email,
        "role": role,
        "aud": "authenticated",
        "exp": 9999999999
    }
    return jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")

def test_normalizar_torico_valor():
    assert normalizar_torico_valor(3) == 3
    assert normalizar_torico_valor("3") == 3
    assert normalizar_torico_valor("T3") == 3
    assert normalizar_torico_valor("t4") == 4
    assert normalizar_torico_valor("T9") == 9
    assert normalizar_torico_valor(0) is None
    assert normalizar_torico_valor("0") is None
    assert normalizar_torico_valor(None) is None
    assert normalizar_torico_valor("") is None
    assert normalizar_torico_valor("null") is None

def test_normalizar_torico_eje():
    assert normalizar_torico_eje(90) == 90
    assert normalizar_torico_eje("85") == 85
    assert normalizar_torico_eje(0) == 0
    assert normalizar_torico_eje(180) == 180
    assert normalizar_torico_eje(250) == 90
    assert normalizar_torico_eje(-10) == 90
    assert normalizar_torico_eje(None) is None

def test_validar_y_normalizar_dioptria():
    assert validar_y_normalizar_dioptria(20.5) == "+20.50"
    assert validar_y_normalizar_dioptria("+21.00") == "+21.00"
    assert validar_y_normalizar_dioptria("-2.5") == "-2.50"
    assert validar_y_normalizar_dioptria(0) == "0.00"
    with pytest.raises(Exception):
        validar_y_normalizar_dioptria(55.0)
    with pytest.raises(Exception):
        validar_y_normalizar_dioptria(-25.0)
    with pytest.raises(Exception):
        validar_y_normalizar_dioptria("invalido")

def test_guardar_calculo_lio_requiere_token():
    res = client.post("/api/calculo-lio/guardar", json={
        "opciones": [{
            "modelo": "Clareon CNA0T0",
            "dioptria": "21.00"
        }]
    })
    assert res.status_code == 401

def test_guardar_calculo_lio_valida_dioptria_invalida():
    token = generate_test_jwt(email="doctor@oftalmo.com")
    res = client.post(
        "/api/calculo-lio/guardar",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "opciones": [{
                "modelo": "Clareon CNA0T0",
                "dioptria": "99.00"
            }]
        }
    )
    assert res.status_code == 422

def test_guardar_calculo_lio_normaliza_torico_t3():
    token = generate_test_jwt(email="dr.rodriguez@clinica.com")
    with patch("app.main.supabase") as mock_supa:
        mock_table = MagicMock()
        mock_supa.table.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[{"id": "turno-123"}])

        res = client.post(
            "/api/calculo-lio/guardar",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "turno_id": "turno-123",
                "confirmar": True,
                "opciones": [{
                    "modelo": "Clareon Toric CNW0T3",
                    "dioptria": "21.50",
                    "es_torico": True,
                    "torico_valor": "T3",
                    "torico_eje": "85"
                }]
            }
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["lio_calculado"] is True
        assert data["lio_calculado_por"] == "dr.rodriguez@clinica.com"
        assert len(data["opciones"]) == 1
        assert data["opciones"][0]["torico_valor"] == 3
        assert data["opciones"][0]["torico_eje"] == 85

def test_reabrir_calculo_lio_permite_cualquier_usuario_autenticado():
    token = generate_test_jwt(email="enfermera.qui@clinica.com")
    with patch("app.main.supabase") as mock_supa:
        mock_table = MagicMock()
        mock_supa.table.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[{"id": "turno-123"}])

        res = client.post(
            "/api/calculo-lio/reabrir",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "turno_id": "turno-123",
                "ojo": "OD"
            }
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["lio_calculado"] is False
