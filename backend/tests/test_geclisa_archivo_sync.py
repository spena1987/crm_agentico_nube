import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.geclisa_client import GeclisaClient
from conftest import make_test_token

client = TestClient(app, headers={"Authorization": f"Bearer {make_test_token()}"})

def test_adjuntar_archivo_historia_clinica_payload():
    """Valida la correcta construcción del payload multipart para Geclisa."""
    g_client = GeclisaClient()
    
    with patch.object(g_client, "_obtener_token", return_value="mock-jwt-token"), \
         patch.object(g_client, "_do_request") as mock_req:
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"hcaId": 99182, "id": 99182, "asId": 99182}
        mock_response.content = b'{"hcaId": 99182, "asId": 99182}'
        mock_req.return_value = mock_response
        
        res = g_client.adjuntar_archivo_historia_clinica(
            ficha_id=141086,
            file_bytes=b"%PDF-1.4 Mock PDF",
            filename="Consentimiento_Test.pdf",
            titulo="Consentimiento Informado - Cirugia Catarata OD",
            observaciones="Firmado digitalmente",
            pre_id=10,
            clase_id=1
        )
        
        assert res["success"] is True
        assert res["archivo_id"] == 99182
        
        mock_req.assert_called_once()
        args, kwargs = mock_req.call_args
        assert args[0] == "POST"
        assert "/api/Archivo/adjuntar-archivo-historia-clinica" in args[1]
        assert kwargs["data"]["FichaId"] == "141086"
        assert kwargs["data"]["ClaseId"] == "1"
        assert kwargs["data"]["PreId"] == "10"
        assert "Archivo" in kwargs["files"]

def test_eliminar_archivo_historia_clinica():
    """Valida la llamada de eliminación en Geclisa."""
    g_client = GeclisaClient()
    
    with patch.object(g_client, "_obtener_token", return_value="mock-jwt-token"), \
         patch.object(g_client, "_do_request") as mock_req:
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_req.return_value = mock_response
        
        res = g_client.eliminar_archivo_historia_clinica(99182)
        assert res["success"] is True
        assert "eliminado" in res["mensaje"]

def test_listar_archivos_historia_clinica():
    """Valida el listado con protección de hcProbIds."""
    g_client = GeclisaClient()
    
    with patch.object(g_client, "_obtener_token", return_value="mock-jwt-token"), \
         patch.object(g_client, "_do_request") as mock_req:
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": 99182, "titulo": "Consentimiento", "fecha": "2026-08-23T10:00:00"}
        ]
        mock_req.return_value = mock_response
        
        items = g_client.listar_archivos_historia_clinica(141086)
        assert len(items) == 1
        assert items[0]["id"] == 99182
        
        _, kwargs = mock_req.call_args
        assert kwargs["json"]["hcProbIds"] == []
        assert kwargs["json"]["fichaId"] == 141086

@patch("app.main.subir_consentimiento_turno_a_geclisa")
def test_endpoint_subir_consentimiento_success(mock_subir):
    """Valida el endpoint de subida de consentimiento."""
    mock_subir.return_value = {
        "success": True,
        "archivo_id": 99182,
        "sincronizado_at": "2026-08-23T10:00:00Z"
    }
    
    response = client.post("/api/turnos-quirofano/mock-turno-123/subir-consentimiento-geclisa")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["archivo_id"] == 99182

@patch("app.main.subir_parte_quirurgico_turno_a_geclisa")
def test_endpoint_subir_parte_quirurgico_success(mock_subir):
    """Valida el endpoint de subida de protocolo quirúrgico."""
    mock_subir.return_value = {
        "success": True,
        "archivo_id": 99183,
        "sincronizado_at": "2026-08-23T10:00:00Z"
    }
    
    response = client.post("/api/turnos-quirofano/mock-turno-123/subir-parte-quirurgico-geclisa")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["archivo_id"] == 99183
