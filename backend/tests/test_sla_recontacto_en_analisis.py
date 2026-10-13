import os
import jwt
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.db import (
    get_configuracion_automatismos,
    actualizar_configuracion_automatismos,
    registrar_quick_recontacto_asesoria
)
from app.main import app

client = TestClient(app)

@pytest.fixture
def auth_headers():
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "super-secret-jwt-key-for-test-2026-audit")
    payload = {
        "sub": "test-user-123",
        "email": "operador@test.com",
        "role": "authenticated",
        "aud": "authenticated",
        "exp": 9999999999
    }
    auth_token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    return {"Authorization": f"Bearer {auth_token}"}

def test_configuracion_sla_recontacto():
    """Verifica que las opciones del SLA de casos en análisis estén presentes y se puedan actualizar."""
    cfg = get_configuracion_automatismos()
    assert "recontacto_humano_en_analisis_activo" in cfg
    assert "plazo_recontacto_analisis_dias" in cfg
    assert "notificar_recontactos_en_crm" in cfg

    actualizado = actualizar_configuracion_automatismos({
        "recontacto_humano_en_analisis_activo": True,
        "plazo_recontacto_analisis_dias": 3,
        "notificar_recontactos_en_crm": True
    })

    assert actualizado["plazo_recontacto_analisis_dias"] == 3
    assert actualizado["recontacto_humano_en_analisis_activo"] is True


def test_quick_recontacto_reprogramar():
    """Verifica que registrar_quick_recontacto_asesoria con 'reprogramar' asigne fecha y snooze_hasta."""
    fake_caso = {
        "id": "ase-123",
        "paciente_id": "pac-456",
        "codigo_caso": "QX-26-0001",
        "estado": "en_analisis",
        "pacientes": {"nombre": "Juan Pérez", "telefono": "+549110000"}
    }

    mock_sb = MagicMock()
    mock_sb.table().select().eq().limit().execute.return_value = MagicMock(data=[fake_caso])
    mock_sb.table().update().eq().execute.return_value = MagicMock(data=[{**fake_caso, "proxima_accion_fecha": "2026-10-15"}])

    with patch("app.db.supabase", mock_sb), \
         patch("app.db.crear_evolucion_asesoria") as mock_evo:

        payload = {
            "accion": "reprogramar",
            "nueva_fecha": "2026-10-15",
            "nota": "Paciente pidió que lo llamen el jueves",
            "autor": "Paula"
        }

        res = registrar_quick_recontacto_asesoria("ase-123", payload)

        assert res["success"] is True
        mock_sb.table().update.assert_called()
        upd_call_arg = mock_sb.table().update.call_args[0][0]
        assert upd_call_arg["proxima_accion_fecha"] == "2026-10-15"
        assert upd_call_arg["snooze_hasta"] == "2026-10-15"
        mock_evo.assert_called_once()


def test_quick_recontacto_confirmado():
    """Verifica que registrar_quick_recontacto_asesoria con 'confirmado' transicione a confirmado."""
    fake_caso = {
        "id": "ase-123",
        "paciente_id": "pac-456",
        "codigo_caso": "QX-26-0001",
        "estado": "en_analisis",
        "pacientes": {"nombre": "Juan Pérez"}
    }

    mock_sb = MagicMock()
    mock_sb.table().select().eq().limit().execute.return_value = MagicMock(data=[fake_caso])
    mock_sb.table().update().eq().execute.return_value = MagicMock(data=[{**fake_caso, "estado": "confirmado"}])

    with patch("app.db.supabase", mock_sb), \
         patch("app.db.crear_evolucion_asesoria") as mock_evo:

        payload = {
            "accion": "confirmado",
            "nota": "Aceptó presupuesto, solicita fecha de cirugía",
            "autor": "Carolina"
        }

        res = registrar_quick_recontacto_asesoria("ase-123", payload)

        assert res["success"] is True
        upd_call_arg = mock_sb.table().update.call_args[0][0]
        assert upd_call_arg["estado"] == "confirmado"
        assert upd_call_arg["proxima_accion_fecha"] is None
        mock_evo.assert_called_once()


def test_quick_recontacto_desiste():
    """Verifica que registrar_quick_recontacto_asesoria con 'desiste' cancele el caso con categoría de causa."""
    fake_caso = {
        "id": "ase-123",
        "paciente_id": "pac-456",
        "codigo_caso": "QX-26-0001",
        "estado": "en_analisis",
        "pacientes": {"nombre": "Juan Pérez"}
    }

    mock_sb = MagicMock()
    mock_sb.table().select().eq().limit().execute.return_value = MagicMock(data=[fake_caso])
    mock_sb.table().update().eq().execute.return_value = MagicMock(data=[{**fake_caso, "estado": "cancelado"}])

    with patch("app.db.supabase", mock_sb), \
         patch("app.db.crear_evolucion_asesoria") as mock_evo:

        payload = {
            "accion": "desiste",
            "categoria_causa": "Económica / Presupuesto",
            "motivo_demora": "Falta de cobertura de prepaga",
            "nota": "Decidió no operarse por costos",
            "autor": "Carolina"
        }

        res = registrar_quick_recontacto_asesoria("ase-123", payload)

        assert res["success"] is True
        upd_call_arg = mock_sb.table().update.call_args[0][0]
        assert upd_call_arg["estado"] == "cancelado"
        assert upd_call_arg["categoria_causa"] == "Económica / Presupuesto"
        assert upd_call_arg["motivo_cancelacion"] == "Falta de cobertura de prepaga"
        mock_evo.assert_called_once()


def test_api_metricas_recontactos(auth_headers):
    """Verifica que el endpoint GET /api/pipeline-quirurgico/metricas-recontactos retorne métricas."""
    with patch("app.db.obtener_metricas_recontactos_asesoria", return_value={
        "hoy": 2,
        "vencidos": 1,
        "total": 3,
        "urgentes_ids": ["ase-1", "ase-2"]
    }):
        response = client.get("/api/pipeline-quirurgico/metricas-recontactos", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total"] == 3
        assert data["hoy"] == 2
        assert data["vencidos"] == 1


def test_api_quick_recontacto_endpoint(auth_headers):
    """Verifica el endpoint POST /api/asesorias-quirurgicas/{id}/quick-recontacto."""
    with patch("app.db.registrar_quick_recontacto_asesoria", return_value={
        "success": True,
        "caso": {"id": "ase-999", "estado": "en_analisis"}
    }):
        response = client.post(
            "/api/asesorias-quirurgicas/ase-999/quick-recontacto",
            json={"accion": "reprogramar", "nueva_fecha": "2026-10-18", "nota": "Seguimiento"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
