import os
import pytest
import jwt
from fastapi.testclient import TestClient

os.environ["SUPABASE_JWT_SECRET"] = os.environ.get("SUPABASE_JWT_SECRET") or "super-secret-jwt-key-for-test-2026-audit"

from app.main import app
from app.db import (
    obtener_lios_comerciales,
    get_practica_resumen_operativo,
    guardar_practica_crm_integral
)

client = TestClient(app)

def generate_test_jwt(email: str = "asesora@test.com", role: str = "authenticated"):
    payload = {
        "sub": "user-uuid-12345",
        "email": email,
        "role": role,
        "aud": "authenticated",
        "exp": 9999999999
    }
    return jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")

@pytest.fixture(autouse=True)
def mock_lios_si_offline(monkeypatch):
    """Provee datos de prueba para LIOs comerciales para pruebas unitarias herméticas sin dependencia de base de datos."""
    import app.db as db_mod
    import app.main as main_mod

    sample_lios = [
        {
            "id": "lio-clareon",
            "codigo": "CLAREON",
            "nombre": "Lente Intraocular Clareon Monofocal",
            "categoria": "Lentes Intraoculares",
            "precio": 520.0,
            "moneda": "USD",
            "es_torico": False,
            "tipo_vision": "Monofocal",
            "habilitado_en_practica": True
        },
        {
            "id": "lio-clareont",
            "codigo": "CLAREONT",
            "nombre": "Lente Intraocular Clareon Toric",
            "categoria": "Lentes Intraoculares",
            "precio": 750.0,
            "moneda": "USD",
            "es_torico": True,
            "tipo_vision": "Tórico",
            "habilitado_en_practica": True
        },
        {
            "id": "lio-trifocal",
            "codigo": "TRIFOCAL",
            "nombre": "Lente PanOptix Trifocal",
            "categoria": "Lentes Intraoculares",
            "precio": 1200.0,
            "moneda": "USD",
            "es_torico": False,
            "tipo_vision": "Trifocal",
            "habilitado_en_practica": True
        }
    ]

    sample_practica = {
        "id": "practica-34031-uuid",
        "codigo": "34031",
        "nombre": "Cirugía de Catarata con Facoemulsificación",
        "categoria": "Cirugía",
        "requiere_lente": True,
        "lios_habilitados": ["CLAREON", "CLAREONT", "TRIFOCAL"]
    }

    def fake_obtener_lios(fecha_consulta=None, practica_id=None, solo_habilitados=False):
        if solo_habilitados and practica_id:
            return [l for l in sample_lios if l["codigo"] in ("CLAREON", "CLAREONT", "TRIFOCAL")]
        return sample_lios

    def fake_get_resumen(codigo_o_id):
        if str(codigo_o_id).strip() in ("34031", "practica-34031-uuid"):
            return sample_practica
        return None

    def fake_guardar_integral(payload):
        return {"success": True, "practica": payload}

    def fake_actualizar_arancel(codigo, precio, moneda="USD", usuario_id=None):
        return {"success": True, "codigo": codigo, "precio": precio, "moneda": moneda}

    def fake_guardar_lios(practica_id, lios_habilitados, usuario_id=None):
        return {"success": True, "lios_habilitados": lios_habilitados}

    monkeypatch.setattr(db_mod, "obtener_lios_comerciales", fake_obtener_lios)
    monkeypatch.setattr(db_mod, "get_practica_resumen_operativo", fake_get_resumen)
    monkeypatch.setattr(db_mod, "guardar_practica_crm_integral", fake_guardar_integral)
    monkeypatch.setattr(db_mod, "actualizar_arancel_lio_rapido", fake_actualizar_arancel)
    monkeypatch.setattr(db_mod, "guardar_lios_habilitados_practica", fake_guardar_lios)

    if hasattr(main_mod, "obtener_lios_comerciales"):
        monkeypatch.setattr(main_mod, "obtener_lios_comerciales", fake_obtener_lios)
    if hasattr(main_mod, "actualizar_arancel_lio_rapido"):
        monkeypatch.setattr(main_mod, "actualizar_arancel_lio_rapido", fake_actualizar_arancel)
    if hasattr(main_mod, "guardar_lios_habilitados_practica"):
        monkeypatch.setattr(main_mod, "guardar_lios_habilitados_practica", fake_guardar_lios)

    yield


def test_obtener_lios_comerciales_direct():
    lios = obtener_lios_comerciales()
    assert isinstance(lios, list)
    assert len(lios) > 0
    primer_lio = lios[0]
    assert "codigo" in primer_lio
    assert "nombre" in primer_lio
    assert "precio" in primer_lio
    assert "moneda" in primer_lio
    assert primer_lio["moneda"] in ("ARS", "USD")

def test_get_lios_comerciales_endpoint():
    token = generate_test_jwt()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/nomenclador/lios-comerciales", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
    assert "lios" in data
    assert len(data["lios"]) > 0

def test_practica_catarata_requiere_lente():
    resumen = get_practica_resumen_operativo("34031")
    assert resumen is not None
    assert resumen.get("requiere_lente") is True

def test_guardar_practica_integral_requiere_lente():
    payload = {
        "codigo": "TEST_LIO_QX",
        "nombre": "Cirugía Test Requiere LIO",
        "categoria": "General",
        "requiere_lente": True,
        "habilitar_arancel": True,
        "precio": 500.0,
        "moneda": "USD"
    }
    res = guardar_practica_crm_integral(payload)
    assert res is not None
    assert res.get("success") is True
    practica = res.get("practica") or {}
    assert practica.get("requiere_lente") is True

def test_actualizar_arancel_lio_endpoint():
    token = generate_test_jwt()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post("/api/nomenclador/actualizar-arancel-lio", json={
        "codigo": "CLAREON",
        "precio": 520.0,
        "moneda": "USD"
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
    assert data.get("precio") == 520.0
    assert data.get("moneda") == "USD"

def test_guardar_lios_habilitados_endpoint():
    token = generate_test_jwt()
    headers = {"Authorization": f"Bearer {token}"}
    # Obtener id de práctica 34031
    resumen = get_practica_resumen_operativo("34031")
    assert resumen is not None
    pid = resumen["id"]
    res = client.post(f"/api/nomenclador/practicas/{pid}/lios-habilitados", json={
        "lios_habilitados": ["CLAREON", "CLAREONT", "TRIFOCAL"]
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
    assert data.get("lios_habilitados") == ["CLAREON", "CLAREONT", "TRIFOCAL"]

def test_obtener_lios_comerciales_filtrados_por_practica():
    token = generate_test_jwt()
    headers = {"Authorization": f"Bearer {token}"}
    # Por código de práctica
    res = client.get("/api/nomenclador/lios-comerciales?practica_id=34031&solo_habilitados=true", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
    lios = data.get("lios", [])
    assert len(lios) == 3
    codigos = [l["codigo"] for l in lios]
    assert "CLAREON" in codigos
    assert "CLAREONT" in codigos
    assert "TRIFOCAL" in codigos
    assert "TRIFOCALT" not in codigos

