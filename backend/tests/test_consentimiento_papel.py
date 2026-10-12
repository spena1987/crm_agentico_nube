import os
import pytest
from app.db import generar_pdf_consentimiento_papel

def test_generar_pdf_consentimiento_papel_exitoso():
    """
    Verifica que generar_pdf_consentimiento_papel resuelva la plantilla del consentimiento
    y cree el archivo PDF en disco sin lanzar ModuleNotFoundError ni errores de imports.
    """
    turno_mock = {
        "id": "test-turno-papel-uuid",
        "practica_codigo": "34031",
        "practica_nombre": "CATARATA CON FACOEMULSIFICACION E IMPL.LIO PLEGABLE",
        "ojo": "OD",
        "fecha_cirugia": "2026-11-24",
        "hora_inicio": "08:30:00",
        "cirujano_nombre": "PARMEGGIANI, MALENA",
        "pacientes": {
            "nombre": "LOOS, MARIO",
            "dni": "814149371",
            "telefono": "5492614545314"
        },
        "quirofanos": {
            "nombre": "Quirófano Central"
        }
    }

    pdf_filename = generar_pdf_consentimiento_papel(turno_mock)
    assert pdf_filename is not None
    assert pdf_filename.startswith("consentimiento_")
    assert pdf_filename.endswith(".pdf")

    pdf_path = os.path.join("app", "static", "pdf", pdf_filename)
    if not os.path.exists(pdf_path):
        # En entornos de testing puede guardarse relativo a PDF_DIR
        from app.services.pdf_service import PDF_DIR
        pdf_path = os.path.join(PDF_DIR, pdf_filename)

    assert os.path.exists(pdf_path), f"El archivo {pdf_path} debe existir en disco."
    assert os.path.getsize(pdf_path) > 1000, "El PDF generado debe tener contenido válido (>1KB)."
