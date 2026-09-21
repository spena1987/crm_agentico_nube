import pytest
from app.db import (
    normalizar_distorsion_teclado_escaner,
    es_uuid_valido,
    extraer_turno_id_de_qr
)

def test_normalizar_distorsion_teclado_escaner():
    # Caso real reportado por el usuario:
    # ProSoft S224 en modo US sobre Windows en Español
    raw_distorsionado = "MEDCRMÑQXÑa0f831d4'9e29'4fcf'ad15'1ab72b9d3cd9"
    esperado = "MEDCRM:QX:a0f831d4-9e29-4fcf-ad15-1ab72b9d3cd9"
    
    assert normalizar_distorsion_teclado_escaner(raw_distorsionado) == esperado

def test_extraer_turno_id_de_qr():
    # 1. Distorsión con Ñ y comillas
    raw = "MEDCRMÑQXÑa0f831d4'9e29'4fcf'ad15'1ab72b9d3cd9"
    assert extraer_turno_id_de_qr(raw) == "a0f831d4-9e29-4fcf-ad15-1ab72b9d3cd9"

    # 2. Formato estándar MEDCRM:QX:
    estandar = "MEDCRM:QX:a0f831d4-9e29-4fcf-ad15-1ab72b9d3cd9"
    assert extraer_turno_id_de_qr(estandar) == "a0f831d4-9e29-4fcf-ad15-1ab72b9d3cd9"

    # 3. UUID directo sin prefijo
    uuid_puro = "a0f831d4-9e29-4fcf-ad15-1ab72b9d3cd9"
    assert extraer_turno_id_de_qr(uuid_puro) == "a0f831d4-9e29-4fcf-ad15-1ab72b9d3cd9"

    # 4. Código legible humano
    codigo_humano = "QX-26-0012-OD"
    assert extraer_turno_id_de_qr(codigo_humano) == "QX-26-0012-OD"

def test_es_uuid_valido():
    assert es_uuid_valido("a0f831d4-9e29-4fcf-ad15-1ab72b9d3cd9") is True
    assert es_uuid_valido("QX-26-0012-OD") is False
    assert es_uuid_valido("MEDCRMÑQXÑa0f831d4'9e29'4fcf'ad15'1ab72b9d3cd9") is False
    assert es_uuid_valido("") is False
    assert es_uuid_valido(None) is False
