import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, Table

from app.services.indicaciones_pdf_service import generar_pdf_indicacion_medica
from app.services.markdown_utils import (
    build_indicaciones_vars_dict,
    format_inline_markdown,
    markdown_to_plain_text,
    parse_markdown_to_pdf_flowables,
    render_texto_variables,
)


def _sample_vars():
    return build_indicaciones_vars_dict(
        {
            "paciente_nombre": "Ana & Juan <Test>",
            "paciente_dni": "30123456",
            "medico_nombre": "Dr. Martín Gómez",
            "practica_nombre": "Facoemulsificación + LIO",
            "ojo_intervenido": "Ojo Derecho (OD)",
            "fecha": "21/11/2026",
        }
    )


def test_render_texto_variables_soporta_llave_simple_y_doble():
    vars_dict = _sample_vars()
    texto = (
        "Paciente: {paciente} (DNI {{dni}}) - "
        "Práctica: {practica} en {{ojo_intervenido}} con {cirujano} el {fecha}."
    )
    res = render_texto_variables(texto, vars_dict)
    assert "Ana & Juan <Test>" in res
    assert "30123456" in res
    assert "Facoemulsificación + LIO" in res
    assert "Ojo Derecho (OD)" in res
    assert "Dr. Martín Gómez" in res
    assert "21/11/2026" in res


def test_format_inline_markdown_escapa_xml_y_respeta_snake_case():
    vars_dict = _sample_vars()
    texto = "**{paciente}** usar < 2 gotas & revisar ojo_derecho en *reposo*."
    res = format_inline_markdown(texto, vars_dict=vars_dict)
    assert "<b>Ana &amp; Juan &lt;Test&gt;</b>" in res
    assert "&lt; 2 gotas &amp; revisar" in res
    assert "ojo_derecho" in res
    assert "<i>ojo_derecho</i>" not in res
    assert "<i>reposo</i>" in res


def test_parse_markdown_to_pdf_flowables_con_ancho_parametrizado():
    vars_dict = _sample_vars()
    base_styles = getSampleStyleSheet()
    styles = {
        "h1": base_styles["Heading1"],
        "h2": base_styles["Heading2"],
        "h3": base_styles["Heading3"],
        "body": base_styles["Normal"],
        "bullet": base_styles["Normal"],
        "quote": base_styles["Normal"],
    }
    md = (
        "# Indicaciones {practica}\n"
        "## Primeras 24 hs\n"
        "- Aplicar **1 gota** cada 3 hs\n"
        "1. Esperar 10 minutos entre colirios\n"
        "> No frotar {ojo_intervenido} & evitar agua < 48hs\n"
        "---\n"
        "Control con {cirujano}"
    )
    flowables = parse_markdown_to_pdf_flowables(
        md,
        styles,
        vars_dict=vars_dict,
        content_width=400.0,
    )
    assert len(flowables) >= 6
    tables = [f for f in flowables if isinstance(f, Table)]
    assert len(tables) >= 2  # quote box + hr divider
    assert all(t._colWidths == [400.0] for t in tables)
    assert any(isinstance(f, Paragraph) for f in flowables)


def test_markdown_to_plain_text_limpia_formato_para_geclisa():
    vars_dict = _sample_vars()
    md = (
        "# Protocolo {practica}\n"
        "## Cuidados para {paciente}\n"
        "- **Gatimicin D**: *1 gota* cada 3 horas\n"
        "> Alerta: Dolor intenso\n"
        "---\n"
        "1. Asistir al control el {fecha}"
    )
    plain = markdown_to_plain_text(md, vars_dict=vars_dict)
    assert "#" not in plain
    assert "**" not in plain
    assert "----------------" in plain
    assert "> " not in plain
    assert "Protocolo Facoemulsificación + LIO" in plain
    assert "Ana & Juan <Test>" in plain
    assert "• Gatimicin D: 1 gota cada 3 horas" in plain
    assert "1. Asistir al control el 21/11/2026" in plain


def test_generar_pdf_indicacion_medica_con_markdown_y_hr_interno_una_pagina():
    res = generar_pdf_indicacion_medica(
        datos_emision={
            "paciente_nombre": "Juan <Pérez> & Hijos",
            "paciente_dni": "28456789",
            "paciente_obra_social": "OSDE",
            "medico_nombre": "Dra. Sofía Ruiz",
            "medico_matricula": "MN 12345",
            "practica_nombre": "Cirugía de Cataratas",
            "ojo": "Ojo Izquierdo (OI)",
            "fecha": "21/11/2026",
            "indicaciones": [
                {
                    "titulo": "Postoperatorio Cataratas",
                    "cuerpo": (
                        "## Esquema Inicial\n"
                        "Paciente **{paciente}** en **{ojo_intervenido}**.\n"
                        "---\n"
                        "1. Aplicar gotas cada 4 hs\n"
                        "> No frotar el ojo"
                    ),
                    "cuidados": "- Usar **gafas oscuras**\n- Dormir con protector",
                    "alarmas": "**Dolor intenso** o pérdida brusca de visión (< 24hs)",
                    "medicamentos": [
                        {"droga": "Gatimicin D", "dosis": "1 gota", "frecuencia": "Cada 4 hs", "duracion": "7 días"}
                    ],
                }
            ],
        },
        guardar_en_disco=False,
    )
    pdf_bytes = res["pdf_bytes"]
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 1500
    assert res["total_paginas"] == 1
    # Verifica que un --- interno no haya partido la indicación en 2 páginas
    page_matches = re.findall(rb"/Type\s*/Page\b", pdf_bytes)
    assert len(page_matches) == 1
