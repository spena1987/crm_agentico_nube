import pytest
from app.services.indicaciones_service import resolver_plantilla_sugerida
from app.services.indicaciones_pdf_service import generar_pdf_indicacion_medica, render_texto_variables


def test_resolver_sugerencia_bonanno_cataratas(monkeypatch):
    """
    Verifica que la Opción C resuelva prioritariamente la plantilla del cirujano
    cuando coincide el apellido con una técnica quirúrgica.
    """
    mock_plantillas = [
        {
            "pimId": 105,
            "pimNombre": "Indicaciones Dr. Bonanno - Cirugía de Cataratas",
            "pimTexto": "Instilar gotas cada 4 horas..."
        }
    ]
    monkeypatch.setattr(
        "app.services.indicaciones_service.geclisa_client.listar_plantillas_indicaciones_geclisa",
        lambda: mock_plantillas
    )
    res = resolver_plantilla_sugerida(
        practica_nombre="Facoemulsificación de Cataratas con LIO",
        medico_nombre="Dr. Leonardo Bonanno"
    )
    assert res["success"] is True
    sug = res["sugerencia"]
    assert sug is not None
    assert "BONANNO" in sug["titulo"].upper() or "CATARATA" in sug["titulo"].upper()


def test_render_variables_dinamicas():
    """Verifica el reemplazo correcto de variables {{paciente}}, {{ojo}}, etc."""
    template = "Paciente: {{paciente}}, Ojo intervenido: {{ojo}}, Cirujano: {{cirujano}}."
    vars_dict = {
        "paciente": "Carlos Tévez",
        "ojo": "Ojo Derecho (OD)",
        "cirujano": "Dr. Parmeggiani"
    }
    resultado = render_texto_variables(template, vars_dict)
    assert "Carlos Tévez" in resultado
    assert "Ojo Derecho (OD)" in resultado
    assert "Dr. Parmeggiani" in resultado


def test_generar_pdf_indicacion_medica_buffer():
    """Verifica que el generador ReportLab produzca un PDF válido no vacío."""
    datos = {
        "paciente_nombre": "Ana Frank",
        "paciente_dni": "12345678",
        "practica_nombre": "Cirugía Refractiva LASIK",
        "ojo": "OI",
        "medico_nombre": "Dra. Gabriela Pagano",
        "medico_matricula": "9988",
        "cuerpo_indicaciones": "Instilar gotas antibióticas según protocolo.",
        "medicamentos": [
            {"droga": "Gatifloxacina", "dosis": "1 gota", "frecuencia": "c/ 3 hs", "duracion": "5 días", "instrucciones": "Agitar"}
        ],
        "cuidados_generales": "Uso de gafas de sol.",
        "pautas_alarma": "Dolor severo."
    }
    pdf_res = generar_pdf_indicacion_medica(datos, guardar_en_disco=False)
    assert pdf_res["pdf_bytes"] is not None
    assert len(pdf_res["pdf_bytes"]) > 1000
    assert pdf_res["pdf_bytes"].startswith(b"%PDF")


def test_resolver_sugerencia_sin_fallback_arbitrario(monkeypatch):
    """
    Verifica que una práctica sin coincidencia ni protocolo
    NO asigne un fallback arbitrario de cataratas, sino que devuelva sugerencia=None y requiere_seleccion_manual=True.
    """
    mock_plantillas = [
        {
            "pimId": 105,
            "pimNombre": "Indicaciones Dr. Bonanno - Cirugía de Cataratas",
            "pimTexto": "Instilar gotas cada 4 horas..."
        }
    ]
    monkeypatch.setattr(
        "app.services.indicaciones_service.geclisa_client.listar_plantillas_indicaciones_geclisa",
        lambda: mock_plantillas
    )
    res = resolver_plantilla_sugerida(
        practica_nombre="Inyeccion Intravitrea Desconocida Procedimiento Raro 999",
        medico_nombre="Dr. Medico Inventado 999"
    )
    assert res["success"] is True
    assert res["sugerencia"] is None
    assert res["requiere_seleccion_manual"] is True
