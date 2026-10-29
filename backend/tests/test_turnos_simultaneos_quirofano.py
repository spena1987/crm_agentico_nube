import pytest
from unittest.mock import MagicMock, patch
from app.db import verificar_solapamiento_turno_quirofano

def test_sala_quirofano_estéril_rechaza_solapamiento():
    """En salas estériles (permite_simultaneos=False), 2 turnos simultáneos se rechazan."""
    mock_supabase = MagicMock()
    
    # Mock quirofano config: permite_simultaneos=False
    mock_q_conf = MagicMock()
    mock_q_conf.data = [{
        "id": "q1",
        "nombre": "Quirófano 1 - Principal",
        "permite_simultaneos": False,
        "capacidad_simultanea": 1
    }]
    
    # Mock turnos existentes en la sala (ya hay 1 turno de 08:00 a 08:30)
    mock_turnos_res = MagicMock()
    mock_turnos_res.data = [{
        "id": "t1",
        "hora_inicio": "08:00",
        "duracion_minutos": 30,
        "estado": "programado",
        "quirofano_id": "q1",
        "pacientes": {"nombre": "Juan Pérez"}
    }]
    
    def table_mock(tbl):
        mock_t = MagicMock()
        if tbl == "quirofanos":
            mock_t.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_q_conf
        elif tbl == "turnos_quirofano":
            mock_t.select.return_value.eq.return_value.eq.return_value.neq.return_value.execute.return_value = mock_turnos_res
        return mock_t

    mock_supabase.table.side_effect = table_mock

    with patch("app.db.supabase", mock_supabase):
        conflicto = verificar_solapamiento_turno_quirofano(
            quirofano_id="q1",
            fecha_cirugia="2026-10-30",
            hora_inicio="08:15",
            duracion_minutos=20
        )
        assert conflicto is not None
        assert conflicto["tipo"] == "sala"
        assert "Juan Pérez" in conflicto["paciente"]

def test_sala_inyecciones_permite_turnos_simultaneos_hasta_capacidad():
    """En salas de inyecciones (permite_simultaneos=True, capacidad=3), se admiten hasta 3 turnos."""
    mock_supabase = MagicMock()
    
    # Mock quirofano config: permite_simultaneos=True, capacidad=3
    mock_q_conf = MagicMock()
    mock_q_conf.data = [{
        "id": "q_inj",
        "nombre": "Inyecciones Intravitreas",
        "permite_simultaneos": True,
        "capacidad_simultanea": 3
    }]
    
    # Caso A: Solo 1 turno existente a las 08:00
    mock_turnos_1 = MagicMock()
    mock_turnos_1.data = [{
        "id": "t1",
        "hora_inicio": "08:00",
        "duracion_minutos": 15,
        "estado": "programado",
        "quirofano_id": "q_inj",
        "pacientes": {"nombre": "Mirtha Pizzi"}
    }]

    def table_mock_a(tbl):
        mock_t = MagicMock()
        if tbl == "quirofanos":
            mock_t.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_q_conf
        elif tbl == "turnos_quirofano":
            mock_t.select.return_value.eq.return_value.eq.return_value.neq.return_value.execute.return_value = mock_turnos_1
        return mock_t

    mock_supabase.table.side_effect = table_mock_a

    with patch("app.db.supabase", mock_supabase):
        conflicto_2do_pac = verificar_solapamiento_turno_quirofano(
            quirofano_id="q_inj",
            fecha_cirugia="2026-10-30",
            hora_inicio="08:00",
            duracion_minutos=15
        )
        # Debe permitir el 2° turno sin conflicto
        assert conflicto_2do_pac is None

    # Caso B: Ya hay 3 turnos a las 08:00 (capacidad llena)
    mock_turnos_3 = MagicMock()
    mock_turnos_3.data = [
        {"id": "t1", "hora_inicio": "08:00", "duracion_minutos": 15, "estado": "programado", "quirofano_id": "q_inj", "pacientes": {"nombre": "Mirtha Pizzi"}},
        {"id": "t2", "hora_inicio": "08:00", "duracion_minutos": 15, "estado": "programado", "quirofano_id": "q_inj", "pacientes": {"nombre": "Carlos Gómez"}},
        {"id": "t3", "hora_inicio": "08:00", "duracion_minutos": 15, "estado": "programado", "quirofano_id": "q_inj", "pacientes": {"nombre": "Ana Silva"}}
    ]

    def table_mock_b(tbl):
        mock_t = MagicMock()
        if tbl == "quirofanos":
            mock_t.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_q_conf
        elif tbl == "turnos_quirofano":
            mock_t.select.return_value.eq.return_value.eq.return_value.neq.return_value.execute.return_value = mock_turnos_3
        return mock_t

    mock_supabase.table.side_effect = table_mock_b

    with patch("app.db.supabase", mock_supabase):
        conflicto_4to_pac = verificar_solapamiento_turno_quirofano(
            quirofano_id="q_inj",
            fecha_cirugia="2026-10-30",
            hora_inicio="08:00",
            duracion_minutos=15
        )
        # El 4to debe ser rechazado por cupo lleno
        assert conflicto_4to_pac is not None
        assert conflicto_4to_pac["tipo"] == "sala_cupo_lleno"
        assert conflicto_4to_pac["capacidad"] == 3
        assert conflicto_4to_pac["ocupados"] == 3
