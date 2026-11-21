import os
import sys
import uuid
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services import indicaciones_service as svc


def test_calcular_diff_ignora_ui_y_espacios():
    orig = [
        {
            "id": "mod-1",
            "titulo": "Protocolo Cataratas",
            "activo": True,
            "origen": "institucional",
            "cuerpo_indicaciones": "Aplicar gotas.\nControl en 24hs.",
            "medicamentos": [{"droga": "Gatimicin D", "dosis": "1 gota", "frecuencia": "Cada 4 hs"}],
            "cuidados_generales": "No frotar el ojo.",
            "pautas_alarma": "Dolor intenso.",
        }
    ]
    igual = [
        {
            "id": "otro-id",
            "titulo": "Otro Titulo",
            "activo": True,
            "origen": "editado",
            "cuerpo_indicaciones": "Aplicar gotas.   Control en 24hs.",
            "medicamentos": [{"medicamento": "Gatimicin D", "dosis": "1 gota", "horario": "Cada 4 hs"}],
            "cuidados_generales": "No frotar el ojo.",
            "pautas_alarma": "Dolor intenso.",
        }
    ]
    modificada, campos = svc._calcular_diff_indicaciones(orig, igual)
    assert modificada is False
    assert campos == []

    # Caso sin baseline
    assert svc._calcular_diff_indicaciones(None, igual) == (False, [])

    # Caso con cambios en cuerpo y medicamentos
    editado = [
        {
            **igual[0],
            "cuerpo_indicaciones": "Aplicar gotas. Control mañana 10:00 hs.",
            "medicamentos": [{"droga": "Gatimicin D", "dosis": "1 gota", "frecuencia": "Cada 6 hs"}],
        }
    ]
    mod2, campos2 = svc._calcular_diff_indicaciones(orig, editado)
    assert mod2 is True
    assert "cuerpo_indicaciones" in campos2
    assert "medicamentos" in campos2
    assert "cuidados_generales" not in campos2


def test_emitir_expediente_prioriza_modulos_editados_y_aisla_geclisa():
    asesoria_id = str(uuid.uuid4())
    paciente_id = str(uuid.uuid4())
    emision_id = str(uuid.uuid4())

    mock_sb = MagicMock()
    # asesoria query
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {
            "id": asesoria_id,
            "paciente_id": paciente_id,
            "medico_cirujano_id": 10,
            "medico_cirujano_nombre": "Dr. Test",
            "practica_nombre": "Facoemulsificación",
            "practica_codigo": "34001",
            "ojo": "OD",
            "pacientes": {
                "id": paciente_id,
                "nombre": "Juan Perez",
                "dni": "12345678",
                "telefono": "",
                "geclisa_ficha_id": 999,
            },
        }
    ]

    modulos_editados = [
        {
            "id": "m1",
            "titulo": "Esquema Colirios",
            "activo": True,
            "cuerpo_indicaciones": "Control mañana 09:30 hs en consultorio.",
            "medicamentos": [{"droga": "Moxifloxacina", "dosis": "1 gota", "frecuencia": "Cada 4 hs"}],
            "cuidados_generales": "Usar protector ocular.",
            "pautas_alarma": "Consultar ante baja visual.",
        },
        {
            "id": "m2",
            "titulo": "Certificado Reposo",
            "activo": True,
            "cuerpo_indicaciones": "Guardar reposo laboral por 48 hs.",
            "medicamentos": [],
            "cuidados_generales": "",
            "pautas_alarma": "",
        },
    ]

    geclisa_mock = MagicMock()
    geclisa_mock.emitir_indicacion_medica_geclisa.return_value = {"success": True, "im_id": 5001}

    pdf_mock = MagicMock(return_value={"url": f"/static/indicacion_{emision_id}.pdf", "file_path": "/tmp/a.pdf", "emision_id": emision_id})

    with patch.object(svc, "supabase", mock_sb), \
         patch.object(svc, "geclisa_client", geclisa_mock), \
         patch.object(svc, "generar_pdf_indicacion_medica", pdf_mock), \
         patch.object(svc, "_resolver_baseline_servidor", return_value=(
             [{"cuerpo_indicaciones": "Texto original maestro", "medicamentos": [], "cuidados_generales": "", "pautas_alarma": ""}],
             "tpl-1",
             "institucional"
         )), \
         patch.object(svc, "resolver_plantilla_sugerida") as mock_resolver:

        res = svc.emitir_indicaciones_expediente(
            asesoria_id=asesoria_id,
            enviar_whatsapp=False,
            modulos=modulos_editados,
            operador_id="user-sub-1",
            operador_nombre="Ana Asesora",
        )

    assert res["success"] is True
    assert res["version_numero"] == 1
    assert res["fue_modificada"] is True
    # No debe re-consultar resolver_plantilla_sugerida porque llegaron modulos
    mock_resolver.assert_not_called()

    # Geclisa recibe SOLO cuerpo_indicaciones de cada modulo (sin medicamentos ni cuidados)
    assert geclisa_mock.emitir_indicacion_medica_geclisa.call_count == 2
    llamadas_geclisa = [c.kwargs["texto_indicacion"] for c in geclisa_mock.emitir_indicacion_medica_geclisa.call_args_list]
    assert llamadas_geclisa == [
        "Control mañana 09:30 hs en consultorio.",
        "Guardar reposo laboral por 48 hs.",
    ]
    assert "Moxifloxacina" not in llamadas_geclisa[0]

    # PDF recibe ambos modulos editados
    datos_pdf_enviados = pdf_mock.call_args.args[0]
    assert len(datos_pdf_enviados["modulos"]) == 2
    assert datos_pdf_enviados["modulos"][0]["medicamentos"][0]["droga"] == "Moxifloxacina"


def test_reemision_quirofano_anexa_version_y_detecta_conflicto():
    turno_id = str(uuid.uuid4())
    emision_id = str(uuid.uuid4())
    paciente_id = str(uuid.uuid4())

    mock_sb = MagicMock()
    # Primera consulta: turnos_quirofano con indicaciones_postqx_emision_id ya existente
    # Segunda consulta (dentro de _append_version_emision): emisiones_indicaciones_geclisa
    q_turnos = MagicMock()
    q_turnos.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {
            "id": turno_id,
            "paciente_id": paciente_id,
            "indicaciones_postqx_emision_id": emision_id,
            "pacientes": {"id": paciente_id, "nombre": "Paciente Test", "telefono": ""},
        }
    ]
    q_emision = MagicMock()
    q_emision.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {
            "id": emision_id,
            "paciente_id": paciente_id,
            "version_actual": 1,
            "medico_nombre": "Dr. Gras",
            "practica_nombre": "Avastin",
            "contenido_original_json": [{"cuerpo_indicaciones": "Base", "medicamentos": [], "cuidados_generales": "", "pautas_alarma": ""}],
            "pacientes": {"id": paciente_id, "nombre": "Paciente Test", "telefono": ""},
            "asesorias_quirurgicas": {},
        }
    ]

    def table_router(name):
        if name == "turnos_quirofano":
            return q_turnos
        if name == "emisiones_indicaciones_geclisa":
            return q_emision
        return MagicMock()

    mock_sb.table.side_effect = table_router
    mock_sb.rpc.return_value.execute.return_value.data = {"success": True, "conflict": False, "version_numero": 2}

    pdf_mock = MagicMock(return_value={"url": f"/static/indicacion_{emision_id}_v2.pdf", "file_path": "/tmp/v2.pdf", "emision_id": emision_id})
    geclisa_mock = MagicMock()

    with patch.object(svc, "supabase", mock_sb), \
         patch.object(svc, "generar_pdf_indicacion_medica", pdf_mock), \
         patch.object(svc, "geclisa_client", geclisa_mock):

        # Caso conflicto optimista (expected_version != version_actual)
        res_conflict = svc.emitir_indicaciones_turno_quirofano(
            turno_id=turno_id,
            modulos=[{"cuerpo_indicaciones": "Cambio", "medicamentos": []}],
            expected_version=99,
            operador_id="u1",
            operador_nombre="Op 1",
        )
        assert res_conflict["success"] is False
        assert res_conflict["conflict"] is True
        assert res_conflict["status_code"] == 409

        # Caso exitoso v2
        res_ok = svc.emitir_indicaciones_turno_quirofano(
            turno_id=turno_id,
            modulos=[{"cuerpo_indicaciones": "Cambio v2", "medicamentos": []}],
            expected_version=1,
            operador_id="u1",
            operador_nombre="Op 1",
        )
        assert res_ok["success"] is True
        assert res_ok["version_numero"] == 2
        assert res_ok["pdf_url"] == f"/static/indicacion_{emision_id}_v2.pdf"
        # En v2+ NO debe volver a llamar a Geclisa
        geclisa_mock.emitir_indicacion_medica_geclisa.assert_not_called()
        assert pdf_mock.call_args.kwargs["filename_override"] == f"indicacion_{emision_id}_v2.pdf"
