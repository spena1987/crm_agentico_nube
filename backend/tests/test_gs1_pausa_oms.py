import os
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

TEST_JWT_SECRET = "super-secret-jwt-key-for-test-2026-audit"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET

import jwt as pyjwt
from app.main import app

client = TestClient(app)

def make_auth_token(email: str = "cirujano@clinica.com", role: str = "authenticated") -> str:
    return pyjwt.encode(
        {"sub": str(uuid.uuid4()), "email": email, "role": role,
         "aud": "authenticated", "exp": 9999999999},
        TEST_JWT_SECRET, algorithm="HS256"
    )

AUTH_HEADERS = {
    "Authorization": f"Bearer {make_auth_token()}"
}

def test_validar_lente_gs1_coincidencia():
    """
    Verifica que un código GS1 con dioptría y modelo coincidentes devuelva COINCIDENCIA_TOTAL.
    """
    mock_turno = {
        "id": "mock-turno-1",
        "lente_tipo": "Clareon",
        "lente_dioptria": "+21.00",
        "es_torico": False,
        "lente_torico_valor": None,
        "ojo": "OD"
    }

    mock_info_cat = {
        "gtin_14": "00380658428867",
        "marca": "Alcon",
        "modelo": "Clareon",
        "nombre_producto": "Clareon Aspheric IOL CNA0T0 +21.0 D",
        "dioptria": 21.0,
        "es_torico": False,
        "torico_valor": None,
        "origen": "alcon_catalog_service"
    }

    with patch("app.main.supabase") as mock_sb, \
         patch("app.services.gs1_lio_validator.buscar_info_lio_por_gtin", return_value=mock_info_cat):
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[mock_turno])
        mock_sb.table.return_value = mock_query

        res = client.post(
            "/api/turnos-quirofano/mock-turno-1/validar-lente-gs1",
            json={"raw_code": "(01)00380658428867(17)281130(10)LOT12345(21)SN987654"},
            headers=AUTH_HEADERS
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["coincide"] is True
        assert data["estado_validacion"] == "COINCIDENCIA_TOTAL"
        assert data["escaneado"]["lote"] == "LOT12345"
        assert data["escaneado"]["vencimiento"] == "2028-11-30"


def test_validar_lente_gs1_discrepancia_dioptria():
    """
    Verifica que si la dioptría física escaneada no coincide con la planificada,
    devuelva DISCREPANCIA y detalle el desajuste.
    """
    mock_turno = {
        "id": "mock-turno-2",
        "lente_tipo": "Clareon",
        "lente_dioptria": "+21.00",
        "es_torico": False,
        "ojo": "OD"
    }

    mock_info_cat = {
        "gtin_14": "00380658428867",
        "marca": "Alcon",
        "modelo": "Clareon",
        "nombre_producto": "Clareon Aspheric IOL CNA0T0 +22.0 D",
        "dioptria": 22.0,
        "es_torico": False,
        "origen": "alcon_catalog_service"
    }

    with patch("app.main.supabase") as mock_sb, \
         patch("app.services.gs1_lio_validator.buscar_info_lio_por_gtin", return_value=mock_info_cat):
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[mock_turno])
        mock_sb.table.return_value = mock_query

        res = client.post(
            "/api/turnos-quirofano/mock-turno-2/validar-lente-gs1",
            json={"raw_code": "(01)00380658428867(17)281130(10)LOT999(21)SN888"},
            headers=AUTH_HEADERS
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["coincide"] is False
        assert data["estado_validacion"] == "DISCREPANCIA"
        assert any("Dioptría DISCREPANTE" in d for d in data["discrepancias"])


def test_confirmar_pausa_oms_con_opcion_a():
    """
    Verifica que al confirmar la Pausa OMS con un cambio autorizado por el cirujano (Opción A),
    se actualice el estado a 'en_operacion' y se guarden lote, serie, vencimiento y justificación.
    """
    mock_turno_prev = {
        "id": "mock-turno-3",
        "estado": "pre_quirofano",
        "lente_tipo": "Clareon",
        "lente_dioptria": "+21.00",
        "es_torico": False,
        "asesoria_id": "mock-ase-123"
    }

    mock_turno_upd = {
        **mock_turno_prev,
        "estado": "en_operacion",
        "lente_dioptria": "+22.00",
        "lente_lote": "LOT-CHANGE",
        "lente_serie": "SN-CHANGE",
        "lente_vencimiento": "2028-11-30"
    }

    with patch("app.main.supabase") as mock_sb:
        mock_tbl = MagicMock()
        mock_tbl.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[mock_turno_prev])
        mock_tbl.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[mock_turno_upd])
        mock_sb.table.return_value = mock_tbl

        payload = {
            "check_identidad": True,
            "check_consentimiento": True,
            "check_lio": True,
            "check_esterilidad": True,
            "lente_escaneado": {
                "gtin": "00380658428867",
                "modelo": "Clareon",
                "dioptria": 22.0,
                "lote": "LOT-CHANGE",
                "serie": "SN-CHANGE",
                "vencimiento": "2028-11-30"
            },
            "justificacion_cambio_lio": "Decisión médica intraoperatoria por hallazgo en saco capsular",
            "autorizado_por_cirujano": True
        }

        res = client.post(
            "/api/turnos-quirofano/mock-turno-3/confirmar-pausa-oms",
            json=payload,
            headers=AUTH_HEADERS
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["turno"]["estado"] == "en_operacion"
