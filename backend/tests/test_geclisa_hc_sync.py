import pytest
from unittest.mock import MagicMock, patch
from app.services.historia_oftalmo_service import (
    formatear_evolucion_texto_geclisa,
    HistoriaOftalmoService
)
from app.services.geclisa_client import GeclisaClient

def test_formatear_evolucion_texto_geclisa():
    consulta = {
        "tipo": "consulta",
        "fecha": "2026-09-04",
        "profesional_nombre": "Dr. Alejandro Ramos",
        "motivo_consulta": "Disminución visual OI",
        "agudeza_visual": {
            "od": {"sc": "20/25", "cc": "20/20", "est": "20/20"},
            "oi": {"sc": "20/60", "cc": "20/30", "est": "20/25"}
        },
        "refraccion": {
            "od": {"esf": "+1.00", "cil": "-0.50", "eje": "90", "ee": "+0.75", "add": "+2.50"},
            "oi": {"esf": "+1.50", "cil": "-1.00", "eje": "100", "ee": "+1.00", "add": "+2.50"}
        },
        "queratometria": {
            "od": {"k1": "43.50", "k2": "44.00", "eje": "90", "cil": -0.50},
            "oi": {"k1": "43.75", "k2": "44.50", "eje": "100", "cil": -0.75}
        },
        "presion_intraocular": {
            "od": {"apl": "14", "aire": "15"},
            "oi": {"apl": "15", "aire": "16"}
        },
        "biomicroscopia": {
            "od": "Córnea transparente, CA profunda",
            "oi": "Esclerosis nuclear grado II",
            "dilata": "Tropicamida"
        },
        "conducta": {
            "dx_presuntivo": "Catarata senil OI",
            "plan_cx": "Facoemulsificación con LIO Monofocal",
            "plan_ojo": "OI"
        },
        "indicaciones_texto": "Uso de colirio lubricante c/8h",
        "proximo_control": "1 mes con estudios"
    }

    paciente = {
        "nombre": "PEREZ, JUAN CARLOS",
        "dni": "28123456",
        "geclisa_ficha_id": 88421
    }

    texto = formatear_evolucion_texto_geclisa(consulta, paciente)

    assert "=== CONSULTA OFTALMOLÓGICA ===" in texto
    assert "Dr. Alejandro Ramos" in texto
    assert "PEREZ, JUAN CARLOS" in texto
    assert "Ficha: 88421" in texto
    assert "[AGUDEZA VISUAL]" in texto
    assert "OD: SC 20/25 | CC 20/20 | Est 20/20" in texto
    assert "[REFRACCIÓN SUBJETIVA]" in texto
    assert "OD: +1.00 -0.50 x 90° (EE: +0.75) | Add: +2.50" in texto
    assert "[QUERATOMETRÍA]" in texto
    assert "[PRESIÓN INTRAOCULAR]" in texto
    assert "[BIOMICROSCOPÍA]" in texto
    assert "[DIAGNÓSTICO Y CONDUCTA]" in texto
    assert "Catarata senil OI" in texto
    assert "[INDICACIONES]" in texto
    assert "Uso de colirio lubricante c/8h" in texto

def test_grabar_texto_libre_hc_unit():
    client = GeclisaClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"hcId": 50123}

    with patch.object(client, "_obtener_token", return_value="fake_token"), \
         patch.object(client, "_do_request", return_value=mock_resp) as mock_req:

        res = client.grabar_texto_libre_hc(
            ficha_id=12345,
            evolucion="Evolución de prueba",
            hc_id=0,
            me_id=10,
            pre_id=10
        )

        assert res["success"] is True
        assert res["hc_id"] == 50123
        assert mock_req.called
        args, kwargs = mock_req.call_args
        assert kwargs["json"]["fichaId"] == 12345
        assert kwargs["json"]["hcId"] is None
        assert kwargs["json"]["evolucion"] == "Evolución de prueba"

def test_validar_editar_eliminar_hc_unit():
    client = GeclisaClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"puedeEditar": True, "puedeEliminar": True}

    with patch.object(client, "_obtener_token", return_value="fake_token"), \
         patch.object(client, "_do_request", return_value=mock_resp):

        res = client.validar_editar_eliminar_hc(50123)
        assert res["permitido"] is True
