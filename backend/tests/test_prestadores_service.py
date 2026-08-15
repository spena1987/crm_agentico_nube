import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.geclisa_client import GeclisaClient

@pytest.fixture
def client():
    return TestClient(app)

def test_buscar_prestadores_mock():
    mock_client = GeclisaClient()
    # Mockear peticion http
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "preId": 32,
            "preNom": "GARCIA",
            "preMatp": "12355",
            "profesion": "ANESTESIA"
        }
    ]

    with patch("requests.get", return_value=mock_response), \
         patch.object(mock_client, "_get_headers", return_value={"Authorization": "Bearer test"}):
        resultado = mock_client.buscar_prestadores("garcia")
        assert len(resultado) == 1
        assert resultado[0]["pre_id"] == 32
        assert resultado[0]["nombre"] == "GARCIA"
        assert resultado[0]["matricula"] == "12355"
        assert resultado[0]["especialidad"] == "ANESTESIA"

def test_obtener_prestador_por_id_mock():
    mock_client = GeclisaClient()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "preId": 10,
            "preNom": "SABATINI LUCIANO",
            "preMatp": "8643",
            "profesion": "FERTILIDAD/GINECOLOGIA"
        }
    ]

    with patch("requests.get", return_value=mock_response), \
         patch.object(mock_client, "_get_headers", return_value={"Authorization": "Bearer test"}):
        resultado = mock_client.obtener_prestador_por_id(10)
        assert resultado["encontrado"] is True
        assert resultado["pre_id"] == 10
        assert resultado["nombre"] == "SABATINI LUCIANO"
        assert resultado["matricula"] == "8643"

def test_api_endpoint_buscar_prestadores(client):
    with patch("app.main.geclisa_client.buscar_prestadores") as mock_buscar:
        mock_buscar.return_value = [
            {"pre_id": 10, "nombre": "SABATINI LUCIANO", "matricula": "8643", "especialidad": "FERTILIDAD"}
        ]
        response = client.get("/api/geclisa/prestadores/buscar?query=sabatini")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total"] == 1
        assert data["prestadores"][0]["nombre"] == "SABATINI LUCIANO"
