import pytest
from unittest.mock import MagicMock, patch
from app.db import (
    asegurar_turno_para_consentimiento_asesoria,
    asegurar_turnos_para_consentimiento_asesoria,
    sincronizar_turno_quirofano_desde_asesoria
)

def test_asegurar_turno_para_consentimiento_sin_crear_si_no_existe():
    """
    Verifica que asegurar_turno_para_consentimiento_asesoria no inserte turnos
    fantasmas en la BD cuando crear_si_no_existe=False.
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        
        # Simular lectura de asesoría
        mock_eq_as = MagicMock()
        mock_select.eq.return_value = mock_eq_as
        mock_limit_as = MagicMock()
        mock_eq_as.limit.return_value = mock_limit_as
        mock_limit_as.execute.return_value = MagicMock(data=[{
            "id": "asesoria-prueba-sin-turno",
            "paciente_id": "pac-456",
            "practica_nombre": "Cirugía de Catarata",
            "ojo": "OD",
            "fecha_definitiva_cirugia": None,
            "pacientes": {"id": "pac-456", "nombre": "Peña, Sebastián"}
        }])
        
        # Simular consulta de turnos_quirofano (vacio)
        mock_neq = MagicMock()
        mock_eq_as.neq.return_value = mock_neq
        mock_order = MagicMock()
        mock_neq.order.return_value = mock_order
        mock_limit_t = MagicMock()
        mock_order.limit.return_value = mock_limit_t
        mock_limit_t.execute.return_value = MagicMock(data=[])
        
        mock_sb.table.return_value = mock_table

        # Invocación por defecto (crear_si_no_existe=False)
        resultado = asegurar_turno_para_consentimiento_asesoria("asesoria-prueba-sin-turno", crear_si_no_existe=False)

        # Debe retornar None y NUNCA llamar a insert en turnos_quirofano
        assert resultado is None
        mock_table.insert.assert_not_called()


def test_obtener_consentimiento_caso_nuevo_es_solo_lectura():
    """
    Verifica que la consulta consolidada de consentimiento (usada por el endpoint GET)
    devuelva tiene_turno=False y estado pendiente sin tocar la tabla turnos_quirofano.
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select

        # Mock de asesorías quirúrgicas
        mock_eq_as = MagicMock()
        mock_select.eq.return_value = mock_eq_as
        mock_limit_as = MagicMock()
        mock_eq_as.limit.return_value = mock_limit_as
        mock_limit_as.execute.return_value = MagicMock(data=[{
            "id": "asesoria-sebastian-pena",
            "paciente_id": "pac-789",
            "codigo_caso": "QX-26-0157",
            "practica_nombre": "Facoemulsificación",
            "ojo": "OD",
            "fecha_definitiva_cirugia": None,
            "pacientes": {"id": "pac-789", "nombre": "Peña, Sebastián"}
        }])

        # Mock de turnos_quirofano vacíos
        mock_neq = MagicMock()
        mock_eq_as.neq.return_value = mock_neq
        mock_order = MagicMock()
        mock_neq.order.return_value = mock_order
        mock_limit_t = MagicMock()
        mock_order.limit.return_value = mock_limit_t
        mock_limit_t.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = mock_table

        res = asegurar_turnos_para_consentimiento_asesoria("asesoria-sebastian-pena", crear_si_no_existe=False)

        assert res["ok"] is True
        assert res["tiene_turno"] is False
        assert res["turno_principal"] is None
        assert res["consentimiento"]["estado"] == "pendiente"
        assert res["consentimiento"]["firmado"] is False
        assert res["consentimiento"]["token"] is None
        mock_table.insert.assert_not_called()


def test_sincronizar_turno_quirofano_no_crea_sin_quirofano_ni_hora():
    """
    Verifica que sincronizar_turno_quirofano_desde_asesoria NO inserte turnos
    si falta el quirofano_id o la hora_inicio o la fecha definitiva.
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_neq = MagicMock()
        mock_eq.neq.return_value = mock_neq
        mock_neq.execute.return_value = MagicMock(data=[])
        mock_sb.table.return_value = mock_table

        asesoria_db = {
            "id": "as-sin-quirofano",
            "paciente_id": "pac-1",
            "ojo": "OD",
            "fecha_definitiva_cirugia": None
        }

        # Payload donde el usuario no seleccionó quirófano ni hora
        payload_agenda = {
            "quirofano_id": None,
            "hora_inicio": None,
            "fecha_definitiva_cirugia": None
        }

        turnos = sincronizar_turno_quirofano_desde_asesoria("as-sin-quirofano", payload_agenda, asesoria_db)
        assert turnos == []
        mock_table.insert.assert_not_called()
