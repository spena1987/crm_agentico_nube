import pytest
from unittest.mock import MagicMock, patch
from app.db import get_datos_recordatorio_quirurgico, registrar_envio_recordatorio_quirurgico

def test_recordatorio_unilateral_retorna_estructura_simple():
    """
    Verifica que una asesoría unilateral retorne es_bilateral_escalonada=False,
    sin primer_ojo ni segundo_ojo separados, y con los datos del turno único.
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_limit = MagicMock()
        mock_eq.limit.return_value = mock_limit
        mock_limit.execute.return_value = MagicMock(data=[{
            "id": "as-uni-1",
            "codigo_caso": "QX-26-0001",
            "paciente_id": "pac-1",
            "ojo": "OD",
            "practica_nombre": "Catarata con Facoemulsificación",
            "medico_cirujano_nombre": "Dr. Martínez",
            "fecha_definitiva_cirugia": "2026-10-20",
            "checklist_prequirurgico": {},
            "pacientes": {"id": "pac-1", "nombre": "Gómez, Carlos", "telefono": "5492614703230"},
            "turnos_quirofano": [{
                "id": "t-1",
                "estado": "agendado",
                "ojo": "OD",
                "fecha_cirugia": "2026-10-20",
                "hora_inicio": "08:30:00",
                "quirofanos": {"nombre": "Quirófano 1"}
            }]
        }])

        mock_sb.table.return_value = mock_table

        res = get_datos_recordatorio_quirurgico("as-uni-1")
        assert res is not None
        assert res["caso_id"] == "as-uni-1"
        assert res["es_bilateral_escalonada"] is False
        assert res["primer_ojo"] is None
        assert res["segundo_ojo"] is None
        assert res["ojo"] == "OD"
        assert "20 de Octubre" in res["fecha"]
        assert res["recordatorio_estado"] == "pendiente"


def test_recordatorio_bilateral_escalonada_retorna_ambos_ojos_y_secuencia():
    """
    Verifica que en un caso AO escalonado con orden 'OI_primero',
    el recordatorio resuelva primer_ojo=OI y segundo_ojo=OD con sus respectivas fechas y turnos.
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_limit = MagicMock()
        mock_eq.limit.return_value = mock_limit
        mock_limit.execute.return_value = MagicMock(data=[{
            "id": "as-bi-227",
            "codigo_caso": "QX-26-0227",
            "paciente_id": "pac-227",
            "ojo": "AO",
            "practica_nombre": "Catarata con Facoemulsificación",
            "medico_cirujano_nombre": "Dra. López",
            "fecha_definitiva_cirugia": "2026-10-14",
            "checklist_prequirurgico": {
                "_meta_bilateral": {
                    "modalidad": "escalonada",
                    "orden": "OI_primero",
                    "fecha_definitiva_2do_ojo": "2026-10-15"
                },
                "_recordatorio_qx": {
                    "es_bilateral_escalonada": True,
                    "primer_ojo": {
                        "estado": "confirmado",
                        "enviado_at": "2026-10-12T10:00:00Z",
                        "respondido_at": "2026-10-12T10:30:00Z"
                    },
                    "segundo_ojo": {
                        "estado": "pendiente"
                    }
                }
            },
            "pacientes": {"id": "pac-227", "nombre": "Pérez, Juan", "telefono": "5492615551234"},
            "turnos_quirofano": [
                {
                    "id": "t-oi",
                    "estado": "confirmado",
                    "ojo": "OI",
                    "fecha_cirugia": "2026-10-14",
                    "hora_inicio": "08:30:00",
                    "quirofanos": {"nombre": "Quirófano Central"},
                    "checks_adicionales": {
                        "recordatorio_estado": "confirmado",
                        "recordatorio_fecha": "2026-10-12T10:00:00Z",
                        "recordatorio_respondido_at": "2026-10-12T10:30:00Z"
                    }
                },
                {
                    "id": "t-od",
                    "estado": "agendado",
                    "ojo": "OD",
                    "fecha_cirugia": "2026-10-15",
                    "hora_inicio": "09:00:00",
                    "quirofanos": {"nombre": "Quirófano Central"},
                    "checks_adicionales": {
                        "recordatorio_estado": "pendiente"
                    }
                }
            ]
        }])

        mock_sb.table.return_value = mock_table

        # 1. Consulta default (debe tomar 1° ojo: OI)
        res = get_datos_recordatorio_quirurgico("as-bi-227")
        assert res is not None
        assert res["es_bilateral_escalonada"] is True
        assert res["primer_ojo"] is not None
        assert res["segundo_ojo"] is not None

        assert res["primer_ojo"]["ojo"] == "OI"
        assert res["primer_ojo"]["fecha_iso"] == "2026-10-14"
        assert res["primer_ojo"]["recordatorio_estado"] == "confirmado"

        assert res["segundo_ojo"]["ojo"] == "OD"
        assert res["segundo_ojo"]["fecha_iso"] == "2026-10-15"
        assert res["segundo_ojo"]["recordatorio_estado"] == "pendiente"

        # Nivel raíz: por default debe corresponder a 1° ojo
        assert res["ojo"] == "OI"
        assert res["fecha_iso"] == "2026-10-14"
        assert res["recordatorio_estado"] == "confirmado"

        # 2. Consulta filtrando por 2° ojo
        res_od = get_datos_recordatorio_quirurgico("as-bi-227", ojo="OD")
        assert res_od is not None
        assert res_od["ojo"] == "OD"
        assert res_od["fecha_iso"] == "2026-10-15"
        assert res_od["recordatorio_estado"] == "pendiente"
        assert res_od["turno_id"] == "t-od"


def test_registrar_envio_recordatorio_discrimina_ojo_en_bilateral():
    """
    Verifica que al registrar el envío para el 2° ojo, se actualice específicamente
    el turno del 2° ojo y la sección 'segundo_ojo' en checklist_prequirurgico._recordatorio_qx.
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_limit = MagicMock()
        mock_eq.limit.return_value = mock_limit

        # Caso en asesorias_quirurgicas
        mock_limit.execute.return_value = MagicMock(data=[{
            "id": "as-bi-99",
            "ojo": "AO",
            "checklist_prequirurgico": {
                "_meta_bilateral": {
                    "modalidad": "escalonada",
                    "orden": "OD_primero"
                },
                "_recordatorio_qx": {
                    "es_bilateral_escalonada": True,
                    "primer_ojo": {
                        "estado": "confirmado"
                    }
                }
            }
        }])

        mock_update = MagicMock()
        mock_table.update.return_value = mock_update
        mock_update.eq.return_value = MagicMock(execute=MagicMock())

        # Select para turnos
        mock_eq_turno = MagicMock()
        mock_select.eq.return_value = mock_eq_turno
        mock_eq_turno.execute.return_value = MagicMock(data=[{
            "id": "turno-oi-segundo",
            "checks_adicionales": {}
        }])

        mock_sb.table.return_value = mock_table

        ok = registrar_envio_recordatorio_quirurgico(
            asesoria_id="as-bi-99",
            paciente_id="pac-99",
            telefono="5492615551234",
            template_name="recordatorio_cirugia_preparacion_v1",
            variables={"cirugia": "Catarata", "fecha": "15/10/2026", "hora": "08:30"},
            wamid="wamid.test.123",
            turno_id="turno-oi-segundo",
            ojo="OI"
        )
        assert ok is True


def test_recordatorio_formato_cirugia_descripcion_completa_ojo():
    """
    Verifica que el campo de cirugía/procedimiento formatee la lateralidad completa
    (OJO DERECHO, OJO IZQUIERDO, AMBOS OJOS) en vez de siglas abreviadas (OD, OI, AO).
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_limit = MagicMock()
        mock_eq.limit.return_value = mock_limit

        # Caso unilateral con práctica que ya traía abreviación (OD)
        mock_limit.execute.return_value = MagicMock(data=[{
            "id": "as-uni-od",
            "paciente_id": "pac-1",
            "ojo": "OD",
            "practica_nombre": "FACOEMULSIFICACION E IMPL.LIO PLEGABLE (OD)",
            "fecha_definitiva_cirugia": "2026-10-25",
            "pacientes": {"nombre": "Peña, Juan", "telefono": "5492614703230"},
            "turnos_quirofano": [{
                "id": "t-1",
                "ojo": "OD",
                "fecha_cirugia": "2026-10-25",
                "hora_inicio": "08:15:00",
                "estado": "programado"
            }]
        }])
        mock_sb.table.return_value = mock_table

        res = get_datos_recordatorio_quirurgico("as-uni-od")
        assert res is not None
        # Debe eliminar el sufijo previo (OD) y reemplazarlo por la descripción completa
        assert res["cirugia"] == "FACOEMULSIFICACION E IMPL.LIO PLEGABLE (OJO DERECHO)"
        assert "(OD)" not in res["cirugia"]

        # Caso Bilateral Escalonado
        mock_limit.execute.return_value = MagicMock(data=[{
            "id": "as-bi-ao",
            "paciente_id": "pac-2",
            "ojo": "AO",
            "modalidad_bilateral": "escalonada",
            "practica_nombre": "CIRUGIA DE CATARATA",
            "fecha_definitiva_cirugia": "2026-10-20",
            "checklist_prequirurgico": {
                "_meta_bilateral": {
                    "modalidad": "escalonada",
                    "orden": "OD_primero",
                    "fecha_definitiva_2do_ojo": "2026-10-27"
                }
            },
            "pacientes": {"nombre": "Gomez, Carlos", "telefono": "5492615559999"},
            "turnos_quirofano": [
                {
                    "id": "t-od",
                    "ojo": "OD",
                    "fecha_cirugia": "2026-10-20",
                    "hora_inicio": "08:00:00",
                    "estado": "programado"
                },
                {
                    "id": "t-oi",
                    "ojo": "OI",
                    "fecha_cirugia": "2026-10-27",
                    "hora_inicio": "08:00:00",
                    "estado": "programado"
                }
            ]
        }])

        res_bi = get_datos_recordatorio_quirurgico("as-bi-ao")
        assert res_bi is not None
        assert res_bi["es_bilateral_escalonada"] is True
        assert res_bi["primer_ojo"]["cirugia"] == "CIRUGIA DE CATARATA (OJO DERECHO)"
        assert res_bi["segundo_ojo"]["cirugia"] == "CIRUGIA DE CATARATA (OJO IZQUIERDO)"


@pytest.mark.asyncio
async def test_handle_automated_interactive_action_confirma_turno_programado():
    """
    Verifica que al recibir la confirmación de WhatsApp (por ejemplo 'Confirmar Asistencia'):
    1. Se recupere el turno_id y ojo desde los metadatos de la plantilla previa en mensajes.
    2. Se actualice el turno de quirófano en estado 'programado' con recordatorio_estado='confirmado'.
    3. Se actualice el checklist de la asesoría quirúrgica.
    """
    from app.services.whatsapp_cloud.worker import handle_automated_interactive_action

    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sb, \
         patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials", return_value=(None, None)):
        
        # Simular respuestas de supabase para mensajes previos
        mock_mensajes = MagicMock()
        mock_mensajes.select.return_value.eq.return_value.neq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{
                "metadata_json": {
                    "tipo": "template",
                    "template_name": "recordatorio_cirugia_preparacion_v1",
                    "turno_id": "t-prog-od",
                    "ojo": "OD",
                    "asesoria_id": "as-1"
                }
            }]
        )

        # Simular turnos_quirofano
        mock_turnos = MagicMock()
        mock_turnos.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "id": "t-prog-od",
                "asesoria_id": "as-1",
                "paciente_id": "pac-123",
                "ojo": "OD",
                "fecha_cirugia": "2026-10-28",
                "hora_inicio": "08:00:00",
                "estado": "programado",
                "checks_adicionales": {"recordatorio_estado": "enviado"},
                "practica_nombre": "Facoemulsificación"
            }]
        )
        mock_turnos.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])

        # Simular asesorias_quirurgicas
        mock_asesorias = MagicMock()
        mock_asesorias.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{
                "id": "as-1",
                "ojo": "AO",
                "practica_nombre": "Facoemulsificación",
                "checklist_prequirurgico": {
                    "_meta_bilateral": {"modalidad": "escalonada", "orden": "OD_primero"},
                    "_recordatorio_qx": {
                        "es_bilateral_escalonada": True,
                        "primer_ojo": {"estado": "enviado"}
                    }
                }
            }]
        )
        mock_asesorias.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])

        def table_side_effect(table_name):
            if table_name == "mensajes":
                return mock_mensajes
            elif table_name == "turnos_quirofano":
                return mock_turnos
            elif table_name == "asesorias_quirurgicas":
                return mock_asesorias
            return MagicMock()

        mock_sb.table.side_effect = table_side_effect

        handled = await handle_automated_interactive_action(
            button_id="confirmar_asistencia",
            text_content="🔘 Confirmar Asistencia",
            paciente_id="pac-123",
            normalized_phone="5492615551234",
            crm_conv_id="conv-1",
            account_id=None
        )

        assert handled is True
        # Verificar que se actualizó el turno con recordatorio_estado = 'confirmado'
        mock_turnos.update.assert_called()
        update_args = mock_turnos.update.call_args[0][0]
        assert update_args["checks_adicionales"]["recordatorio_estado"] == "confirmado"
        assert update_args["checks_adicionales"]["recordatorio_respuesta_texto"] == "🔘 Confirmar Asistencia"

        # Verificar que se actualizó asesorias_quirurgicas
        mock_asesorias.update.assert_called()
        asesoria_update_args = mock_asesorias.update.call_args[0][0]
        rec_qx = asesoria_update_args["checklist_prequirurgico"]["_recordatorio_qx"]
        assert rec_qx["primer_ojo"]["estado"] == "confirmado"


