import pytest
from unittest.mock import MagicMock, patch
from app.db import asegurar_turnos_para_consentimiento_asesoria

def test_caso_unilateral_retorna_un_solo_consentimiento():
    """
    Verifica que un caso unilateral (OD) retorne es_bilateral_escalonada=False
    y un solo consentimiento.
    """
    with patch("app.db.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_table.select.return_value = mock_select
        
        # Simular lectura de asesoría unilateral OD
        mock_eq = MagicMock()
        mock_select.eq.return_value = mock_eq
        mock_limit = MagicMock()
        mock_eq.limit.return_value = mock_limit
        mock_limit.execute.return_value = MagicMock(data=[{
            "id": "as-uni-od",
            "paciente_id": "pac-1",
            "ojo": "OD",
            "fecha_probable_cirugia": "2026-10-25",
            "checklist_prequirurgico": {},
            "pacientes": {"id": "pac-1", "nombre": "Gómez, Carlos"}
        }])

        # Simular lectura de turnos_quirofano (vacio)
        mock_neq = MagicMock()
        mock_eq.neq.return_value = mock_neq
        mock_order = MagicMock()
        mock_neq.order.return_value = mock_order
        mock_order.limit.return_value.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = mock_table

        res = asegurar_turnos_para_consentimiento_asesoria("as-uni-od", crear_si_no_existe=False)
        assert res["ok"] is True
        assert res["es_bilateral_escalonada"] is False
        assert res["primer_ojo"] is None
        assert res["segundo_ojo"] is None
        assert res["consentimiento"]["ojo"] == "OD"
        assert res["consentimiento"]["fecha"] == "2026-10-25"


def test_caso_bilateral_simultaneo_retorna_un_solo_consentimiento_ao():
    """
    Verifica que un caso AO con modalidad 'simultanea' (mismo acto) retorne
    es_bilateral_escalonada=False y un único consentimiento para ambos ojos.
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
            "id": "as-ao-simultaneo",
            "paciente_id": "pac-2",
            "ojo": "AO",
            "modalidad_bilateral": "simultanea",
            "fecha_definitiva_cirugia": "2026-10-28",
            "checklist_prequirurgico": {
                "_meta_bilateral": {
                    "modalidad": "simultanea"
                }
            },
            "pacientes": {"id": "pac-2", "nombre": "López, María"}
        }])

        mock_neq = MagicMock()
        mock_eq.neq.return_value = mock_neq
        mock_order = MagicMock()
        mock_neq.order.return_value = mock_order
        mock_order.limit.return_value.execute.return_value = MagicMock(data=[])

        mock_sb.table.return_value = mock_table

        res = asegurar_turnos_para_consentimiento_asesoria("as-ao-simultaneo", crear_si_no_existe=False)
        assert res["ok"] is True
        assert res["es_bilateral_escalonada"] is False
        assert res["primer_ojo"] is None
        assert res["segundo_ojo"] is None
        assert res["consentimiento"]["ojo"] == "AO"
        assert "Mismo Acto" in res["consentimiento"]["ojo_desc"]
        assert res["consentimiento"]["fecha"] == "2026-10-28"


def test_caso_bilateral_escalonado_detecta_orden_od_primero():
    """
    Verifica que un caso AO escalonado con orden 'OD_primero' identifique:
    - 1° Ojo = OD con su fecha correspondiente
    - 2° Ojo = OI con su fecha correspondiente
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
            "id": "as-ao-escalonado",
            "paciente_id": "pac-3",
            "ojo": "AO",
            "fecha_definitiva_cirugia": "2026-10-14",
            "checklist_prequirurgico": {
                "_meta_bilateral": {
                    "modalidad": "escalonada",
                    "orden": "OD_primero",
                    "fecha_definitiva_2do_ojo": "2026-10-15"
                }
            },
            "pacientes": {"id": "pac-3", "nombre": "Peña, Juan Sebastián"}
        }])

        # Simular lectura de turnos_quirofano
        mock_neq = MagicMock()
        mock_eq.neq.return_value = mock_neq
        mock_neq.execute.return_value = MagicMock(data=[
            {
                "id": "turno-od",
                "asesoria_id": "as-ao-escalonado",
                "ojo": "OD",
                "fecha_cirugia": "2026-10-14",
                "hora_inicio": "09:40:00",
                "consentimiento_token": "tok-od",
                "consentimiento_estado": "pendiente"
            },
            {
                "id": "turno-oi",
                "asesoria_id": "as-ao-escalonado",
                "ojo": "OI",
                "fecha_cirugia": "2026-10-15",
                "hora_inicio": "08:40:00",
                "consentimiento_token": "tok-oi",
                "consentimiento_estado": "pendiente"
            }
        ])

        mock_sb.table.return_value = mock_table

        res = asegurar_turnos_para_consentimiento_asesoria("as-ao-escalonado", crear_si_no_existe=False)
        assert res["ok"] is True
        assert res["es_bilateral_escalonada"] is True
        assert res["primer_ojo"]["ojo"] == "OD"
        assert res["primer_ojo"]["fecha"] == "2026-10-14"
        assert res["segundo_ojo"]["ojo"] == "OI"
        assert res["segundo_ojo"]["fecha"] == "2026-10-15"


def test_caso_bilateral_escalonado_detecta_orden_oi_primero():
    """
    Verifica que al invertir el orden a 'OI_primero':
    - 1° Ojo = OI
    - 2° Ojo = OD
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
            "id": "as-ao-oi-primero",
            "paciente_id": "pac-4",
            "ojo": "AO",
            "fecha_definitiva_cirugia": "2026-11-01",
            "checklist_prequirurgico": {
                "_meta_bilateral": {
                    "modalidad": "escalonada",
                    "orden": "OI_primero",
                    "fecha_definitiva_2do_ojo": "2026-11-08"
                }
            },
            "pacientes": {"id": "pac-4", "nombre": "Martínez, Lucía"}
        }])

        mock_neq = MagicMock()
        mock_eq.neq.return_value = mock_neq
        mock_neq.execute.return_value = MagicMock(data=[
            {
                "id": "turno-oi",
                "asesoria_id": "as-ao-oi-primero",
                "ojo": "OI",
                "fecha_cirugia": "2026-11-01",
                "hora_inicio": "10:00:00",
                "consentimiento_token": "tok-oi"
            },
            {
                "id": "turno-od",
                "asesoria_id": "as-ao-oi-primero",
                "ojo": "OD",
                "fecha_cirugia": "2026-11-08",
                "hora_inicio": "10:00:00",
                "consentimiento_token": "tok-od"
            }
        ])

        mock_sb.table.return_value = mock_table

        res = asegurar_turnos_para_consentimiento_asesoria("as-ao-oi-primero", crear_si_no_existe=False)
        assert res["ok"] is True
        assert res["es_bilateral_escalonada"] is True
        assert res["primer_ojo"]["ojo"] == "OI"
        assert res["primer_ojo"]["fecha"] == "2026-11-01"
        assert res["segundo_ojo"]["ojo"] == "OD"
        assert res["segundo_ojo"]["fecha"] == "2026-11-08"
