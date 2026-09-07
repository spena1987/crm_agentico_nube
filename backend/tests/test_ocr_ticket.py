import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.ocr_ticket_service import OcrTicketService

client = TestClient(app)

SAMPLE_PARSED_DATA = {
    "equipo": "TOPCON",
    "fecha": "07_SEP_2026 14:31",
    "ref": {
        "od": {"esf": "+0.25", "cil": "-0.50", "eje": "139", "se": "0.00"},
        "oi": {"esf": "-0.00", "cil": "-0.25", "eje": "41", "se": "-0.25"}
    },
    "krt": {
        "od": {"k1_d": 40.50, "k1_mm": 8.32, "k1_eje": 11, "k2_d": 41.50, "k2_mm": 8.14, "k2_eje": 101, "avg_d": 41.00, "cil": "-1.00", "eje": "11"},
        "oi": {"k1_d": 41.25, "k1_mm": 8.19, "k1_eje": 178, "k2_d": 41.75, "k2_mm": 8.08, "k2_eje": 88, "avg_d": 41.50, "cil": "-0.50", "eje": "178"}
    },
    "tono": {
        "od": 17,
        "oi": 19
    },
    "pach": {
        "od": None,
        "oi": None
    },
    "pd": 63
}

def test_generar_campos_consulta_mapeo_completo():
    fields = OcrTicketService._generar_campos_consulta(SAMPLE_PARSED_DATA)
    assert fields["arm_od_esf"] == "+0.25"
    assert fields["arm_od_cil"] == "-0.50"
    assert fields["arm_od_eje"] == "139"
    assert fields["arm_oi_esf"] == "-0.00"
    assert fields["arm_oi_cil"] == "-0.25"
    assert fields["arm_oi_eje"] == "41"
    assert fields["k_od_k1"] == "40.5"
    assert fields["k_od_k2"] == "41.5"
    assert fields["k_od_ejec"] == "11"
    assert fields["k_od_cil"] == "-1.00"
    assert fields["k_oi_k1"] == "41.25"
    assert fields["k_oi_k2"] == "41.75"
    assert fields["k_oi_ejec"] == "178"
    assert fields["k_oi_cil"] == "-0.50"
    assert fields["pio_od_aire"] == "17"
    assert fields["pio_oi_aire"] == "19"
    assert "paq_od_aire" not in fields

def test_generar_transcripcion_formato():
    txt = OcrTicketService._generar_transcripcion(SAMPLE_PARSED_DATA)
    assert "TOPCON" in txt
    assert "REF. DATA" in txt
    assert "KRT. DATA" in txt
    assert "TONO. DATA" in txt
    assert "17 mmHg" in txt

@patch("app.auth.decode_supabase_jwt")
@patch("app.services.ocr_ticket_service.OcrTicketService.procesar_ticket_imagen")
def test_endpoint_ocr_ticket_base64(mock_proc, mock_jwt):
    mock_jwt.return_value = {"sub": "test-user", "role": "authenticated"}
    mock_proc.return_value = {
        "success": True,
        "equipo": "TOPCON",
        "extracted_fields": {"arm_od_esf": "+0.25"}
    }
    
    headers = {"Authorization": "Bearer fake_token"}
    payload = {
        "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        "mime_type": "image/jpeg"
    }
    
    resp = client.post("/api/oftalmo/ocr-ticket", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["equipo"] == "TOPCON"
    assert data["extracted_fields"]["arm_od_esf"] == "+0.25"
