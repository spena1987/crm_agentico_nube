import os
import pytest
import jwt
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
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

@pytest.fixture
def asesoria_bilateral_mock():
    return {
        "id": "mock-asesoria-bilateral-123",
        "paciente_id": "pac-123",
        "ojo": "AO",
        "checklist_prequirurgico": {
            "_meta_bilateral": {
                "modalidad": "escalonada",
                "orden": "OD_primero",
                "fecha_probable_2do_ojo": "2026-11-30",
                "fecha_definitiva_2do_ojo": "2026-11-30"
            }
        },
        "fecha_probable_cirugia": "2026-11-24",
        "fecha_definitiva_cirugia": "2026-11-24",
        "cirujano_nombre": "Dr. Arévalo",
        "practica_nombre": "Facoemulsificación con Implante de LIO",
        "pacientes": {
            "id": "pac-123",
            "nombre": "LOOS, MARIO",
            "telefono": "+5491122334455"
        }
    }

def test_asegurar_turnos_para_consentimiento_asesoria_bilateral(asesoria_bilateral_mock):
    from app.db import asegurar_turnos_para_consentimiento_asesoria

    with patch("app.db.supabase") as mock_sb:
        # Mock para responder segun tabla solicitada
        def table_side_effect(table_name):
            mock_table = MagicMock()
            mock_select = MagicMock()
            mock_table.select.return_value = mock_select
            
            if table_name == "asesorias_quirurgicas":
                mock_eq = MagicMock()
                mock_select.eq.return_value = mock_eq
                mock_limit = MagicMock()
                mock_eq.limit.return_value = mock_limit
                mock_limit.execute.return_value = MagicMock(data=[asesoria_bilateral_mock])
            elif table_name == "turnos_quirofano":
                mock_eq = MagicMock()
                mock_neq = MagicMock()
                mock_select.eq.return_value = mock_eq
                mock_eq.neq.return_value = mock_neq
                mock_neq.execute.return_value = MagicMock(data=[
                    {
                        "id": "turno-od-1",
                        "asesoria_id": "mock-asesoria-bilateral-123",
                        "ojo": "OD",
                        "fecha": "2026-11-24",
                        "consentimiento_token": "token-od-111",
                        "consentimiento_estado": "pendiente",
                        "estado": "confirmado"
                    },
                    {
                        "id": "turno-oi-2",
                        "asesoria_id": "mock-asesoria-bilateral-123",
                        "ojo": "OI",
                        "fecha": "2026-11-30",
                        "consentimiento_token": "token-oi-222",
                        "consentimiento_estado": "firmado",
                        "estado": "confirmado"
                    }
                ])
                # En caso de que se llame sin neq
                mock_eq.execute.return_value = mock_neq.execute.return_value
            return mock_table

        mock_sb.table.side_effect = table_side_effect

        res = asegurar_turnos_para_consentimiento_asesoria("mock-asesoria-bilateral-123")
        assert res is not None
        assert res.get("es_bilateral_escalonada") is True
        assert res.get("primer_ojo") is not None
        assert res.get("primer_ojo")["ojo"] == "OD"
        assert res.get("primer_ojo")["token"] == "token-od-111"
        assert res.get("segundo_ojo") is not None
        assert res.get("segundo_ojo")["ojo"] == "OI"
        assert res.get("segundo_ojo")["token"] == "token-oi-222"
        assert res.get("segundo_ojo")["firmado"] is True

def test_endpoint_datos_consentimiento_whatsapp_filtro_ojo(auth_headers):
    with patch("app.db.get_datos_consentimiento_whatsapp") as mock_fn:
        mock_fn.return_value = {
            "ok": True,
            "paciente_nombre": "LOOS, MARIO",
            "cirugia": "Facoemulsificación con Implante de LIO (Ojo Izquierdo)",
            "ojo": "OI",
            "ojo_desc": "Ojo Izquierdo",
            "fecha": "30/11/2026",
            "enlace_firma": "https://crm-agentico-nube.vercel.app/consentimiento/token-oi-222",
            "es_bilateral_escalonada": True
        }

        res = client.get(
            "/api/asesorias-quirurgicas/mock-asesoria-bilateral-123/datos-consentimiento-whatsapp?ojo=OI",
            headers=auth_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data.get("ok") is True
        assert data.get("ojo") == "OI"
        assert "Ojo Izquierdo" in data.get("cirugia")
