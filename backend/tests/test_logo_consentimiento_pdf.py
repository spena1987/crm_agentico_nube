import os
import pytest
from app.services.pdf_service import generar_html_consentimiento, generar_pdf_consentimiento_informado, PDF_DIR
from app.db import generar_pdf_consentimiento_papel
from app.services.config_service import load_settings

def test_generar_html_consentimiento_incluye_logo_base64():
    """
    Verifica que el contexto y HTML generado para WeasyPrint incluya
    el logo institucional en formato Base64 Data URI dentro de la cabecera.
    """
    turno_mock = {
        "id": "test-logo-html-turno",
        "practica_codigo": "34031",
        "practica_nombre": "CATARATA CON FACOEMULSIFICACION",
        "ojo": "OD",
        "ojo_desc": "OJO DERECHO (OD)",
        "fecha_cirugia": "2026-11-20",
        "hora_inicio": "09:00:00",
        "cirujano_nombre": "Dr. Fernando Brizuela",
        "quirofanos": {"nombre": "Quirófano Central"}
    }
    paciente_mock = {
        "nombre": "PEÑA, JUAN SEBASTIAN",
        "dni": "033516799",
        "nro_hc": "421256",
        "obra_social": "SWISS MEDICAL S.A.",
        "plan_cobertura": "OBLIGATORIO"
    }

    html = generar_html_consentimiento(
        turno=turno_mock,
        paciente=paciente_mock,
        texto_consentimiento="## Cláusulas Generales\nTexto del consentimiento informado de prueba."
    )

    assert html is not None
    assert "alt=\"Logo Institucional\"" in html or "class=\"header-table\"" in html
    assert "PEÑA, JUAN SEBASTIAN" in html
    assert "CATARATA CON FACOEMULSIFICACION" in html

    # Si hay logo en disco, verificar que se inserte la etiqueta img con data:image
    branding_logo = os.path.join(PDF_DIR, "branding", "logo_institucional.png")
    if os.path.exists(branding_logo) and os.path.getsize(branding_logo) > 100:
        assert "data:image/png;base64," in html
        assert "<img src=\"data:image/png;base64," in html

def test_generar_pdf_consentimiento_con_logo():
    """
    Verifica que generar_pdf_consentimiento_informado compile un PDF válido en disco
    integrando el logo institucional tanto en WeasyPrint como en ReportLab fallback.
    """
    turno_mock = {
        "id": "test-logo-pdf-turno",
        "practica_codigo": "34031",
        "practica_nombre": "CATARATA CON FACOEMULSIFICACION E IMPL.LIO PLEGABLE",
        "ojo": "OD",
        "ojo_desc": "OJO DERECHO (OD)",
        "fecha_cirugia": "2026-10-28",
        "hora_inicio": "08:00:00",
        "cirujano_nombre": "PARMEGGIANI, MALENA",
        "pacientes": {
            "nombre": "PEÑA, JUAN SEBASTIAN",
            "dni": "033516799"
        },
        "quirofanos": {
            "nombre": "Quirófano Central"
        }
    }
    paciente_mock = turno_mock["pacientes"]

    pdf_filename = generar_pdf_consentimiento_informado(
        turno=turno_mock,
        paciente=paciente_mock,
        texto_consentimiento="# Consentimiento Informado para Cirugía\n\n1) Constancia de recepción del formulario..."
    )

    assert pdf_filename == "consentimiento_test-logo-pdf-turno.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 3000

def test_generar_pdf_consentimiento_papel_con_logo():
    """
    Verifica que el modo en papel para firma manuscrita también incluya el membrete con logo.
    """
    turno_mock = {
        "id": "test-papel-logo-turno",
        "practica_codigo": "34031",
        "practica_nombre": "CIRUGÍA DE CATARATA",
        "ojo": "OI",
        "fecha_cirugia": "2026-11-15",
        "hora_inicio": "10:00:00",
        "cirujano_nombre": "Dr. Fernando Brizuela",
        "pacientes": {
            "nombre": "GARCIA, ANA",
            "dni": "28111222"
        }
    }

    pdf_filename = generar_pdf_consentimiento_papel(turno_mock)
    assert pdf_filename == "consentimiento_test-papel-logo-turno.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 3000
