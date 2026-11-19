import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import db  # noqa: E402
from app import main  # noqa: E402


class _FakeQuery:
    def __init__(self, table_name, storage):
        self.table_name = table_name
        self.storage = storage
        self.filters = []
        self.neq_filters = []
        self._limit = None
        self._update_payload = None
        self._insert_payload = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def neq(self, col, val):
        self.neq_filters.append((col, val))
        return self

    def limit(self, n):
        self._limit = n
        return self

    def update(self, payload):
        self._update_payload = payload
        return self

    def insert(self, payload):
        self._insert_payload = payload
        return self

    def delete(self):
        return self

    def execute(self):
        rows = list(self.storage.get(self.table_name, []))
        matched = [
            r for r in rows
            if all(r.get(c) == v for c, v in self.filters)
            and all(r.get(c) != v for c, v in self.neq_filters)
        ]
        if self._update_payload is not None:
            updated = []
            for r in matched:
                r.update(self._update_payload)
                updated.append(dict(r))
            return SimpleNamespace(data=updated)
        if self._insert_payload is not None:
            self.storage.setdefault(self.table_name, []).append(dict(self._insert_payload))
            return SimpleNamespace(data=[dict(self._insert_payload)])
        if self._limit is not None:
            matched = matched[: self._limit]
        return SimpleNamespace(data=[dict(r) for r in matched])


class _FakeSupabase:
    def __init__(self, storage):
        self.storage = storage

    def table(self, name):
        return _FakeQuery(name, self.storage)


def test_actualizar_turno_operado_bloquea_cambios_de_agenda(monkeypatch):
    storage = {
        "turnos_quirofano": [
            {
                "id": "t-1",
                "estado": "operado",
                "fecha_cirugia": "2026-11-10",
                "hora_inicio": "10:00:00",
                "quirofano_id": "q-1",
                "duracion_minutos": 20,
                "asesoria_id": "a-1",
            }
        ]
    }
    monkeypatch.setattr(db, "supabase", _FakeSupabase(storage))

    with pytest.raises(db.CrmConflictError):
        db.actualizar_turno_quirofano("t-1", {"fecha_cirugia": "2026-11-25"})

    with pytest.raises(db.CrmConflictError):
        db.actualizar_turno_quirofano("t-1", {"hora_inicio": "11:00"})

    with pytest.raises(db.CrmConflictError):
        db.actualizar_turno_quirofano("t-1", {"quirofano_id": "q-2"})

    with pytest.raises(db.CrmConflictError):
        db.actualizar_turno_quirofano("t-1", {"duracion_minutos": 30})


def test_actualizar_turno_operado_permite_edicion_clinica_parcial(monkeypatch):
    storage = {
        "turnos_quirofano": [
            {
                "id": "t-1",
                "estado": "operado",
                "fecha_cirugia": "2026-11-10",
                "hora_inicio": "10:00:00",
                "quirofano_id": "q-1",
                "duracion_minutos": 20,
                "asesoria_id": None,
                "lente_lote": None,
            }
        ]
    }
    monkeypatch.setattr(db, "supabase", _FakeSupabase(storage))
    monkeypatch.setattr(db, "_hidratar_lio_metadata_turno", lambda x: x)

    res = db.actualizar_turno_quirofano(
        "t-1",
        {
            "fecha_cirugia": "2026-11-10",
            "hora_inicio": "10:00",
            "quirofano_id": "q-1",
            "duracion_minutos": 20,
            "lente_lote": "LOT-99",
        },
    )
    assert res["lente_lote"] == "LOT-99"

    res_partial = db.actualizar_turno_quirofano("t-1", {"checks_adicionales": {"ok": True}})
    assert res_partial["checks_adicionales"] == {"ok": True}


def test_eliminar_y_cambiar_estado_bloquean_operado(monkeypatch):
    storage = {
        "turnos_quirofano": [
            {"id": "t-op", "estado": "operado", "asesoria_id": "a-1", "ojo": "OD"}
        ]
    }
    monkeypatch.setattr(db, "supabase", _FakeSupabase(storage))

    with pytest.raises(db.CrmConflictError):
        db.eliminar_turno_quirofano("t-op")

    res = db.cambiar_estado_turno_quirofano("t-op", "programado")
    assert res["success"] is False
    assert res["status_code"] == 409


def test_revertir_operado_endpoint_rbac_y_limpieza(monkeypatch):
    storage = {
        "turnos_quirofano": [
            {
                "id": "t-op",
                "estado": "operado",
                "asesoria_id": "a-1",
                "paciente_id": "p-1",
                "llegada_at": "2026-11-19T12:00:00Z",
                "ingreso_pre_quirofano_at": "2026-11-19T12:15:00Z",
                "inicio_cirugia_at": "2026-11-19T12:30:00Z",
                "fin_cirugia_at": "2026-11-19T12:50:00Z",
                "parte_quirurgico_pdf_url": "/static/parte_t_op.pdf",
                "parte_quirurgico_geclisa_archivo_id": None,
            }
        ],
        "asesorias_quirurgicas": [{"id": "a-1", "estado": "operado", "parte_quirurgico_pdf_url": "/static/parte_t_op.pdf"}],
        "system_logs": [],
        "asesoria_evoluciones": [],
    }
    monkeypatch.setattr(db, "supabase", _FakeSupabase(storage))
    sync_mock = MagicMock(return_value={})
    monkeypatch.setattr(db, "evaluar_y_sincronizar_estado_caso_quirurgico", sync_mock)
    monkeypatch.setattr("app.auth.decode_supabase_jwt", lambda _t: {"sub": "u-1", "email": "user@clinica.com"})

    client = TestClient(main.app)
    headers = {"Authorization": "Bearer fake-token"}

    # Sin permiso -> 403
    monkeypatch.setattr(main, "verificar_permiso_usuario", lambda *_a, **_kw: False)
    r403 = client.post(
        "/api/turnos-quirofano/t-op/revertir-operado",
        json={"estado_destino": "programado", "motivo": "Error de carga"},
        headers=headers,
    )
    assert r403.status_code == 403

    # Con permiso -> 200 y limpieza completa
    monkeypatch.setattr(main, "verificar_permiso_usuario", lambda *_a, **_kw: True)
    r200 = client.post(
        "/api/turnos-quirofano/t-op/revertir-operado",
        json={"estado_destino": "programado", "motivo": "Marcado por error"},
        headers=headers,
    )
    assert r200.status_code == 200
    body = r200.json()
    assert body["success"] is True
    assert body["nuevo_estado"] == "programado"
    t_row = storage["turnos_quirofano"][0]
    assert t_row["estado"] == "programado"
    assert t_row["fin_cirugia_at"] is None
    assert t_row["llegada_at"] is None
    assert t_row["parte_quirurgico_pdf_url"] is None
    assert storage["asesorias_quirurgicas"][0]["parte_quirurgico_pdf_url"] is None
    assert len(storage["system_logs"]) == 1
    assert len(storage["asesoria_evoluciones"]) == 1
    sync_mock.assert_called_once()
