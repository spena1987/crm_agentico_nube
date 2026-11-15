import pytest
from unittest.mock import patch

from app.db import (
    _normalizar_condicion_toricidad,
    _extraer_vinculo_lio_practica,
    _nombre_canonico_familia_lio,
    _extraer_codigo_canonico_lio,
    _buscar_familia_existente_por_nombre_o_codigo,
    _validar_lio_definido_para_confirmacion,
    _evaluar_discrepancia_comercial_clinica,
    _proteger_y_reevaluar_checklist_lio,
    _procesar_lio_desde_quirofano,
    _hidratar_lio_metadata_turno,
)


def test_g1_normalizar_condicion_toricidad():
    assert _normalizar_condicion_toricidad("esferico") == "esferico"
    assert _normalizar_condicion_toricidad("TORICO") == "torico"
    assert _normalizar_condicion_toricidad("ambos") == "ambos"
    # Heurísticas cuando el campo explícito está vacío
    assert _normalizar_condicion_toricidad(None, codigo="CLAREONT", nombre="Lente Clareon Toric") == "torico"
    assert _normalizar_condicion_toricidad(None, codigo="TRIFOCALT", nombre="Lente Trifocal Tórico") == "torico"
    assert _normalizar_condicion_toricidad(None, codigo="MULTIFOCAL", nombre="Lente Multifocal") == "ambos"
    assert _normalizar_condicion_toricidad(None, codigo="EXPAND", nombre="Lente Expand") == "ambos"
    assert _normalizar_condicion_toricidad(None, codigo="TRIFOCAL", nombre="Lente Trifocal") == "esferico"


def test_g1_extraer_vinculo_y_nombre_canonico():
    # Lectura directa desde columnas SQL
    fams, cond = _extraer_vinculo_lio_practica({
        "codigo": "TRIFOCAL",
        "nombre": "Lente Trifocal",
        "familias_lio_ids": ["uuid-panoptix", "uuid-panoptix"],
        "condicion_toricidad": "esferico",
    })
    assert fams == ["uuid-panoptix"]
    assert cond == "esferico"

    # Fallback desde JSONB indicaciones_reglas_cirujano._lio_vinculo si DDL aún no está aplicado
    fams_fb, cond_fb = _extraer_vinculo_lio_practica({
        "codigo": "TRIFOCALT",
        "nombre": "Lente Trifocal Tórico",
        "familias_lio_ids": [],
        "indicaciones_reglas_cirujano": {
            "_lio_vinculo": {
                "familias_lio_ids": ["uuid-panoptix", "uuid-panoptix-toric"],
                "condicion_toricidad": "torico",
            }
        },
    })
    assert fams_fb == ["uuid-panoptix", "uuid-panoptix-toric"]
    assert cond_fb == "torico"

    assert _nombre_canonico_familia_lio({"modelo": "Clareon PanOptix Común", "marca": "Alcon"}) == "Clareon PanOptix Común (Alcon)"
    assert _nombre_canonico_familia_lio({"modelo": "Clareon Vivity"}) == "Clareon Vivity"
    assert _nombre_canonico_familia_lio(None) is None


def test_g2_codigo_canonico_y_deduplicacion():
    assert _extraer_codigo_canonico_lio("Alcon SA60AT") == "SA60AT"
    assert _extraer_codigo_canonico_lio("IOL SA60AT 21.0") == "SA60AT"
    assert _extraer_codigo_canonico_lio("Clareon CNA0T0 Monofocal") == "CNA0T0"
    assert _extraer_codigo_canonico_lio("PanOptix TFNT00") == "TFNT"
    assert _extraer_codigo_canonico_lio("AcrySof IQ SN60WF") == "SN60WF"

    familias = [
        {"id": "fam-natural", "marca": "Alcon", "modelo": "Natural SA60AT", "activo": True, "items_count": 3},
        {"id": "fam-dup", "marca": "Alcon", "modelo": "Alcon SA60AT", "activo": True, "items_count": 56},
    ]
    # Para SA60AT el preferido canónico debe ser Natural SA60AT incluso frente a Alcon SA60AT con más ítems
    elegida = _buscar_familia_existente_por_nombre_o_codigo(
        familias,
        marca="Alcon",
        familia_nombre="Alcon SA60AT 11.5",
        texto_referencia="IOL SA60AT 11.5",
    )
    assert elegida is not None
    assert elegida["id"] == "fam-natural"


def test_g3_gate_confirmacion_lio_no_definido():
    base_catarata = {
        "estado": "confirmado",
        "practica_codigo": "34031",
        "practica_nombre": "Catarata con Facoemulsificación e Implante de LIO",
        "ojo": "OD",
    }

    # Sin _lio_seleccion -> bloqueado
    with pytest.raises(ValueError):
        _validar_lio_definido_para_confirmacion({**base_catarata, "checklist_prequirurgico": {}})

    # Con estado 'a_definir' -> bloqueado tanto en confirmado como en programado
    for est in ("confirmado", "programado"):
        with pytest.raises(ValueError):
            _validar_lio_definido_para_confirmacion({
                **base_catarata,
                "estado": est,
                "checklist_prequirurgico": {
                    "_lio_seleccion": {"estado": "a_definir", "lente_nombre": None}
                },
            })

    # Bilateral diferenciado faltando OI -> bloqueado
    with pytest.raises(ValueError):
        _validar_lio_definido_para_confirmacion({
            **base_catarata,
            "ojo": "AO",
            "checklist_prequirurgico": {
                "_lio_seleccion": {
                    "estado": "confirmado",
                    "modalidad_bilateral": "diferenciado",
                    "lente_od": "LENTE TRIFOCAL",
                    "lente_oi": "",
                }
            },
        })

    # Con LIO tentativo/confirmado y lente completo -> permitido
    _validar_lio_definido_para_confirmacion({
        **base_catarata,
        "estado": "confirmado",
        "checklist_prequirurgico": {
            "_lio_seleccion": {"estado": "tentativo", "lente_nombre": "LENTE TRIFOCAL"}
        },
    })

    # Caso en_analisis con a_definir -> permitido guardar borrador
    _validar_lio_definido_para_confirmacion({
        **base_catarata,
        "estado": "en_analisis",
        "checklist_prequirurgico": {
            "_lio_seleccion": {"estado": "a_definir"}
        },
    })


def test_g4_discrepancia_y_proteccion_checklist():
    catalogo = [
        {
            "id": "com-trif-esf",
            "codigo": "TRIFOCAL",
            "nombre": "LENTE TRIFOCAL",
            "precio": 3000.0,
            "moneda": "USD",
            "condicion_toricidad": "esferico",
            "familias_lio_ids": ["fam-panoptix"],
            "familias_lio_nombres": ["Clareon PanOptix Común"],
            "familias_clinicas": [{"id": "fam-panoptix", "modelo": "Clareon PanOptix Común", "marca": "Alcon"}],
        },
        {
            "id": "com-trif-tor",
            "codigo": "TRIFOCALT",
            "nombre": "LENTE TRIFOCAL TORICO",
            "precio": 3400.0,
            "moneda": "USD",
            "condicion_toricidad": "torico",
            "familias_lio_ids": ["fam-panoptix"],
            "familias_lio_nombres": ["Clareon PanOptix Común"],
            "familias_clinicas": [{"id": "fam-panoptix", "modelo": "Clareon PanOptix Común", "marca": "Alcon"}],
        },
        {
            "id": "com-vivity-esf",
            "codigo": "VIVITY",
            "nombre": "LENTE VIVITY ESFERICO",
            "precio": 2900.0,
            "moneda": "USD",
            "condicion_toricidad": "esferico",
            "familias_lio_ids": ["fam-vivity"],
            "familias_lio_nombres": ["Clareon Vivity"],
            "familias_clinicas": [{"id": "fam-vivity", "modelo": "Clareon Vivity", "marca": "Alcon"}],
        },
    ]

    lio_propuesto = {
        "lente_id": "com-trif-esf",
        "lente_codigo": "TRIFOCAL",
        "lente_nombre": "LENTE TRIFOCAL",
        "condicion_toricidad": "esferico",
        "familias_lio_ids": ["fam-panoptix"],
        "familias_lio_nombres": ["Clareon PanOptix Común"],
        "familias_clinicas": [{"id": "fam-panoptix", "modelo": "Clareon PanOptix Común", "marca": "Alcon"}],
    }

    # Sin discrepancia: misma familia y esférico
    disc_ok = _evaluar_discrepancia_comercial_clinica(
        lio_propuesto,
        {"modelo": "Clareon PanOptix Común (Alcon)", "modelo_lio_id": "fam-panoptix", "es_torico": False},
        lios_comerciales_cache=catalogo,
    )
    assert disc_ok["hay_discrepancia"] is False
    assert disc_ok["tipo"] is None

    # Discrepancia de toricidad: eligió Tórico cuando comercial es Esférico -> sugiere TRIFOCALT
    disc_tor = _evaluar_discrepancia_comercial_clinica(
        lio_propuesto,
        {"modelo": "Clareon PanOptix Común (Alcon)", "modelo_lio_id": "fam-panoptix", "es_torico": True},
        lios_comerciales_cache=catalogo,
    )
    assert disc_tor["hay_discrepancia"] is True
    assert disc_tor["tipo"] == "toricidad"
    assert disc_tor["comercial_sugerido"]["lente_codigo"] == "TRIFOCALT"

    # Discrepancia combinada familia + toricidad
    disc_ambos = _evaluar_discrepancia_comercial_clinica(
        lio_propuesto,
        {"modelo": "Clareon Vivity (Alcon)", "modelo_lio_id": "fam-vivity", "es_torico": True},
        lios_comerciales_cache=catalogo,
    )
    assert disc_ambos["hay_discrepancia"] is True
    assert disc_ambos["tipo"] == "ambos"

    # Protección de concurrencia en checklist y re-evaluación automática al cambiar _lio_seleccion
    prev_chk = {
        "_lio_seleccion": {"estado": "confirmado", "lente_id": "com-trif-esf", "lente_codigo": "TRIFOCAL", "lente_nombre": "LENTE TRIFOCAL"},
        "_lio_calculo_OD": {
            "lio_calculado": True,
            "origen_calculo": "medico",
            "opciones": [{"modelo": "Clareon Vivity (Alcon)", "modelo_lio_id": "fam-vivity", "dioptria": "+21.00", "es_torico": False, "tipo_opcion": "principal"}],
        },
    }
    incoming_stale = {
        "_lio_seleccion": {"estado": "confirmado", "lente_id": "com-vivity-esf", "lente_codigo": "VIVITY", "lente_nombre": "LENTE VIVITY ESFERICO"},
        "_lio_calculo_OD": {"lio_calculado": False},  # payload viejo que NO debe pisar el cálculo real
    }
    with patch("app.db.obtener_lios_comerciales", return_value=catalogo):
        res_chk = _proteger_y_reevaluar_checklist_lio(
            prev_chk,
            incoming_stale,
            {"id": "case-1", "ojo": "OD"},
            permitir_sobrescribir=False,
        )
    # Preserva cálculo real del médico y limpia discrepancia porque el asesor actualizó a VIVITY
    assert res_chk["_lio_calculo_OD"]["lio_calculado"] is True
    assert res_chk["_lio_calculo_OD"]["opciones"][0]["dioptria"] == "+21.00"
    assert res_chk["_lio_calculo_OD"]["discrepancia_comercial_clinica"]["hay_discrepancia"] is False


def test_g5_quirofano_escenarios_a_b_y_hidratacion():
    lio_propuesto = {
        "lente_id": "com-trif-esf",
        "lente_codigo": "TRIFOCAL",
        "lente_nombre": "LENTE TRIFOCAL",
        "condicion_toricidad": "esferico",
        "familias_lio_ids": ["fam-panoptix"],
        "familias_lio_nombres": ["Clareon PanOptix Común"],
        "familias_clinicas": [{"id": "fam-panoptix", "modelo": "Clareon PanOptix Común", "marca": "Alcon"}],
    }

    # ESCENARIO A: caso sin calcular + Quirófano ingresa modelo y dioptría
    nodo_a = _procesar_lio_desde_quirofano(
        calc_prev=None,
        datos_turno={
            "lleva_lente": True,
            "lente_tipo": "Clareon PanOptix Común (Alcon)",
            "modelo_lio_id": "fam-panoptix",
            "lente_dioptria": "+21.50",
            "es_torico": False,
            "usuario_operador": "Enf. Gómez",
        },
        lio_propuesto=lio_propuesto,
        huella_actual={"lente_nombre": "LENTE TRIFOCAL"},
        lios_cache=[],
    )
    assert nodo_a is not None
    assert nodo_a["lio_calculado"] is True
    assert nodo_a["origen_calculo"] == "quirofano"
    assert nodo_a["lio_calculado_por"] == "Enf. Gómez (Cargado en Quirófano)"
    assert nodo_a["override_quirofano"]["activo"] is False
    assert nodo_a["opciones"][0]["dioptria"] == "+21.50"

    # ESCENARIO B: ya estaba calculado por el médico + Quirófano cambia modelo y dioptría
    calc_medico = {
        "lio_calculado": True,
        "lio_calculado_por": "Dr. Gras",
        "lio_calculado_at": "2026-11-10T10:00:00Z",
        "origen_calculo": "medico",
        "opciones": [{
            "id": "opt-med-1",
            "tipo_opcion": "principal",
            "modelo": "Clareon PanOptix Común (Alcon)",
            "modelo_lio_id": "fam-panoptix",
            "dioptria": "+22.00",
            "es_torico": False,
        }],
    }
    nodo_b = _procesar_lio_desde_quirofano(
        calc_prev=calc_medico,
        datos_turno={
            "lleva_lente": True,
            "lente_tipo": "Clareon Vivity (Alcon)",
            "modelo_lio_id": "fam-vivity",
            "lente_dioptria": "+21.50",
            "es_torico": True,
            "lente_torico_valor": 3,
            "lente_torico_eje": 90,
            "usuario_operador": "Inst. Pérez",
            "motivo_override": "Cambio telefónico por cirujano",
        },
        lio_propuesto=lio_propuesto,
        huella_actual={"lente_nombre": "LENTE TRIFOCAL"},
        lios_cache=[],
    )
    assert nodo_b is not None
    # El plan original del cirujano NO fue pisado
    assert nodo_b["opciones"] == calc_medico["opciones"]
    assert nodo_b["override_quirofano"]["activo"] is True
    assert nodo_b["override_quirofano"]["calculo_medico_original"]["modelo"] == "Clareon PanOptix Común (Alcon)"
    assert nodo_b["override_quirofano"]["calculo_medico_original"]["dioptria"] == "+22.00"
    assert nodo_b["override_quirofano"]["lente_aplicado_quirofano"]["modelo"] == "Clareon Vivity (Alcon)"
    assert nodo_b["override_quirofano"]["modificado_por"] == "Inst. Pérez"
    assert nodo_b["override_quirofano"]["motivo"] == "Cambio telefónico por cirujano"
    assert len(nodo_b["historial_overrides"]) == 1
    assert nodo_b["discrepancia_comercial_clinica"]["hay_discrepancia"] is True

    # Hidratación de turno proyecta el override activo para la Ficha sin pisar opciones del médico
    turno_mock = {
        "id": "turno-1",
        "ojo": "OD",
        "lleva_lente": True,
        "lente_tipo": "Clareon PanOptix Común (Alcon)",
        "lente_dioptria": "+22.00",
        "es_torico": False,
    }
    as_mock = {
        "ojo": "OD",
        "checklist_prequirurgico": {
            "_lio_seleccion": {"estado": "confirmado", "lente_nombre": "LENTE TRIFOCAL"},
            "_lio_calculo_OD": nodo_b,
        },
    }
    with patch("app.db._construir_lio_propuesto_desde_asesoria", return_value=(lio_propuesto, {"lente_nombre": "LENTE TRIFOCAL"})):
        hidratado = _hidratar_lio_metadata_turno(turno_mock, as_rel=as_mock, lios_cache=[])
    assert hidratado["lente_tipo"] == "Clareon Vivity (Alcon)"
    assert hidratado["lente_dioptria"] == "+21.50"
    assert hidratado["es_torico"] is True
    assert hidratado["lio_calculo_opciones"][0]["modelo"] == "Clareon PanOptix Común (Alcon)"
    assert hidratado["override_quirofano"]["activo"] is True
    assert hidratado["discrepancia_comercial_clinica"]["hay_discrepancia"] is True
