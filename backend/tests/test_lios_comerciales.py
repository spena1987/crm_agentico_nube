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
