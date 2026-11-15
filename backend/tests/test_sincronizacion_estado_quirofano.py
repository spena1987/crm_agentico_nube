from unittest.mock import MagicMock, patch
from app.db import evaluar_y_sincronizar_estado_caso_quirurgico


def _build_mock_supabase(asesoria_row, turnos_rows):
    mock_sb = MagicMock()
    updates_captured = []

    def table_side_effect(table_name):
        t_mock = MagicMock()
        if table_name == "asesorias_quirurgicas":
            t_mock.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[asesoria_row]
            )
            def capture_update(payload):
                updates_captured.append(payload)
                upd_chain = MagicMock()
                upd_chain.eq.return_value.execute.return_value = MagicMock(data=[payload])
                return upd_chain
            t_mock.update.side_effect = capture_update
        elif table_name == "turnos_quirofano":
            t_mock.select.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(
                data=turnos_rows
            )
        return t_mock

    mock_sb.table.side_effect = table_side_effect
    return mock_sb, updates_captured


def test_unilateral_con_meta_bilateral_nulo_pasa_a_operado():
    asesoria = {
        "id": "as-1",
        "paciente_id": "pac-1",
        "ojo": "OD",
        "estado": "programado",
        "checklist_prequirurgico": {
            "_meta_bilateral": {
                "orden": None,
                "modalidad": None,
                "hora_inicio_2do_ojo": None,
                "quirofano_id_2do_ojo": None,
                "fecha_probable_2do_ojo": None,
                "duracion_minutos_2do_ojo": None,
                "fecha_definitiva_2do_ojo": None,
            }
        },
    }
    turnos = [{"id": "t-1", "ojo": "OD", "estado": "operado", "fecha_cirugia": "2026-11-10"}]
    mock_sb, updates = _build_mock_supabase(asesoria, turnos)

    with patch("app.db.supabase", mock_sb), patch("app.db.sincronizar_presupuesto_desde_caso_quirurgico"):
        evaluar_y_sincronizar_estado_caso_quirurgico("as-1", turnos[0], "operado")

    assert len(updates) == 1
    assert updates[0]["estado"] == "operado"


def test_bilateral_escalonada_con_un_solo_ojo_operado_permanece_programado():
    asesoria = {
        "id": "as-2",
        "paciente_id": "pac-2",
        "ojo": "AO",
        "estado": "programado",
        "checklist_prequirurgico": {
            "_meta_bilateral": {"orden": "OD_primero", "modalidad": "escalonada"}
        },
    }
    turnos = [
        {"id": "t-od", "ojo": "OD", "estado": "operado", "fecha_cirugia": "2026-11-10"},
        {"id": "t-oi", "ojo": "OI", "estado": "programado", "fecha_cirugia": "2026-11-20"},
    ]
    mock_sb, updates = _build_mock_supabase(asesoria, turnos)

    with patch("app.db.supabase", mock_sb), patch("app.db.sincronizar_presupuesto_desde_caso_quirurgico"):
        evaluar_y_sincronizar_estado_caso_quirurgico("as-2", turnos[0], "operado")

    assert len(updates) == 1
    assert updates[0]["estado"] == "programado"
