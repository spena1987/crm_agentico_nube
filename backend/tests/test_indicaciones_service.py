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


def test_emitir_indicacion_con_texto_override_sin_error_sug_data(monkeypatch):
    """
    Verifica que al emitir una indicación con texto personalizado (texto_override)
    NO ocurra UnboundLocalError por 'sug_data'.
    """
    from unittest.mock import MagicMock
    from app.services.indicaciones_service import emitir_indicaciones_expediente
    import uuid

    fake_id = str(uuid.uuid4())
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()
    mock_limit = MagicMock()

    mock_asesoria = {
        "id": fake_id,
        "paciente_id": "pac-123",
        "practica_nombre": "REFRACTIVA LASER BILATERAL",
        "practica_codigo": "34031",
        "medico_cirujano_id": 10,
        "medico_cirujano_nombre": "BONANNO, PABLO ANTONIO",
        "medico_cirujano_matricula": "12345",
        "pacientes": {
            "id": "pac-123",
            "nombre": "ARRIETA DAVILA, KAREN YEMINA",
            "dni": "35123456",
            "telefono": "",
            "geclisa_ficha_id": 9999
        }
    }

    mock_limit.execute.return_value = MagicMock(data=[mock_asesoria])
    mock_eq.limit.return_value = mock_limit
    mock_select.eq.return_value = mock_eq
    mock_table.select.return_value = mock_select
    mock_table.insert.return_value.execute.return_value = MagicMock(data=[{"id": "emi-1"}])
    mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": fake_id}])
    mock_sb.table.return_value = mock_table

    monkeypatch.setattr("app.services.indicaciones_service.supabase", mock_sb)
    monkeypatch.setattr(
        "app.services.indicaciones_service.generar_pdf_indicacion_medica",
        lambda *args, **kwargs: {"url": "/api/pdf/1", "file_path": "/tmp/1.pdf", "emision_id": "emi-1"}
    )
    monkeypatch.setattr(
        "app.services.indicaciones_service.geclisa_client.emitir_indicacion_medica_geclisa",
        lambda *args, **kwargs: {"success": True, "im_id": 777}
    )

    resultado = emitir_indicaciones_expediente(
        asesoria_id=fake_id,
        enviar_whatsapp=False,
        texto_override="Orden médica para refractiva láser bilateral.",
        tipo_documento="orden_medica"
    )

    assert resultado["success"] is True
    assert resultado["emision_id"] == "emi-1"
    assert resultado["geclisa_im_id"] == 777
