import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import db, main  # noqa: E402


def test_caso_requiere_lente_con_cache_sin_queries_bd(monkeypatch):
    """Con nomenclador_cache provisto, _caso_requiere_lente no debe consultar Supabase."""
    mock_sb = MagicMock()
    monkeypatch.setattr(db, "supabase", mock_sb)

    cache = {
        "by_codigo": {"FACO": True, "LASIK": False},
        "by_nombre": {"cirugia de catarata": True, "laser excimer": False},
    }

    assert db._caso_requiere_lente({"practica_codigo": "faco"}, nomenclador_cache=cache) is True
    assert db._caso_requiere_lente({"practica_codigo": "LASIK"}, nomenclador_cache=cache) is False
    assert db._caso_requiere_lente({"practica_nombre": "Cirugia de Catarata"}, nomenclador_cache=cache) is True
    assert db._caso_requiere_lente({"practica_nombre": "Laser Excimer"}, nomenclador_cache=cache) is False
    mock_sb.table.assert_not_called()


def test_listar_pacientes_calculo_lio_sin_n_plus_1_nomenclador(monkeypatch):
    """
    Verifica que listar_pacientes_calculo_lio consulte nomenclador_practicas una sola vez
    para el índice requiere_lente aunque procese múltiples turnos y asesorías.
    """
    nomenclador_calls = {"count": 0}

    class _FakeResp:
        def __init__(self, data):
            self.data = data

    class _FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name

        def select(self, *args, **kwargs):
            return self

        def eq(self, *args, **kwargs):
            return self

        def neq(self, *args, **kwargs):
            return self

        def or_(self, *args, **kwargs):
            return self

        def in_(self, *args, **kwargs):
            return self

        def order(self, *args, **kwargs):
            return self

        def limit(self, *args, **kwargs):
            return self

        def execute(self):
            if self.table_name == "nomenclador_practicas":
                nomenclador_calls["count"] += 1
                return _FakeResp([
                    {"codigo": "FACO", "nombre": "Facoemulsificacion", "requiere_lente": True, "activo": True},
                ])
            if self.table_name == "turnos_quirofano":
                return _FakeResp([
                    {
                        "id": f"t-{i}",
                        "asesoria_id": f"as-{i}",
                        "ojo": "OD",
                        "practica_codigo": "FACO",
                        "practica_nombre": "Facoemulsificacion",
                        "lleva_lente": True,
                        "lio_calculado": False,
                        "estado": "programado",
                        "pacientes": {"id": f"p-{i}", "nombre": f"Paciente {i}", "dni": "123"},
                        "quirofanos": {"nombre": "Q1"},
                        "asesorias_quirurgicas": {
                            "id": f"as-{i}",
                            "codigo_caso": f"QX-26-{i:04d}",
                            "estado": "confirmado",
                            "practica_codigo": "FACO",
                            "practica_nombre": "Facoemulsificacion",
                            "checklist_prequirurgico": {
                                "_lio_seleccion": {"estado": "confirmado", "lente_nombre": "PanOptix"}
                            },
                        },
                    }
                    for i in range(10)
                ])
            if self.table_name == "asesorias_quirurgicas":
                return _FakeResp([
                    {
                        "id": f"as-extra-{i}",
                        "codigo_caso": f"QX-26-9{i:03d}",
                        "estado": "confirmado",
                        "ojo": "OD",
                        "practica_codigo": "FACO",
                        "practica_nombre": "Facoemulsificacion",
                        "pacientes": {"id": f"pe-{i}", "nombre": f"Extra {i}", "dni": "456"},
                        "checklist_prequirurgico": {
                            "_lio_seleccion": {"estado": "confirmado", "lente_nombre": "Vivity"}
                        },
                    }
                    for i in range(5)
                ])
            return _FakeResp([])

    class _FakeSupabase:
        def table(self, name):
            return _FakeQuery(name)

    fake_sb = _FakeSupabase()
    monkeypatch.setattr(main, "supabase", fake_sb)
    monkeypatch.setattr(db, "supabase", fake_sb)
    monkeypatch.setattr(main, "obtener_lios_comerciales", lambda: [])

    res = main.listar_pacientes_calculo_lio(estado_calculo="todos")
    assert res["success"] is True
    assert res["total"] == 15
    assert nomenclador_calls["count"] == 1
