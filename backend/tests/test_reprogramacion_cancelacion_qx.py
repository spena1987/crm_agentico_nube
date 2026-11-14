import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import db


class FakeQuery:
    def __init__(self, data=None):
        self._data = data if data is not None else []
        self.filters = []
        self.updates = None
        self.inserts = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def neq(self, col, val):
        self.filters.append(("neq", col, val))
        return self

    def in_(self, col, vals):
        self.filters.append(("in_", col, vals))
        return self

    def gte(self, col, val):
        return self

    def lte(self, col, val):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def update(self, payload):
        self.updates = payload
        return self

    def insert(self, payload):
        self.inserts = payload
        return self

    def execute(self):
        res = MagicMock()
        if self.updates is not None:
            res.data = [{**(self._data[0] if self._data else {}), **self.updates}]
        elif self.inserts is not None:
            res.data = [self.inserts]
        else:
            res.data = self._data
        return res


def test_get_turnos_dia_ejecucion_excluye_cancelados_por_defecto():
    q_turnos = FakeQuery(data=[{"id": "t-1", "estado": "programado", "quirofanos": {"mostrar_en_pizarra": True}}])
    fake_sb = MagicMock()
    fake_sb.table.return_value = q_turnos

    with patch.object(db, "supabase", fake_sb):
        turnos = db.get_turnos_dia_ejecucion("2026-11-16", solo_pizarra=True)

    assert len(turnos) == 1
    assert ("neq", "estado", "cancelado") in q_turnos.filters


def test_get_turnos_dia_ejecucion_incluye_cancelados_si_se_solicita():
    q_turnos = FakeQuery(data=[])
    fake_sb = MagicMock()
    fake_sb.table.return_value = q_turnos

    with patch.object(db, "supabase", fake_sb):
        db.get_turnos_dia_ejecucion("2026-11-16", incluir_cancelados=True)

    assert ("neq", "estado", "cancelado") not in q_turnos.filters


def test_suspender_turno_operado_rechazado():
    q_turno = FakeQuery(data=[{"id": "t-op", "estado": "operado"}])
    fake_sb = MagicMock()
    fake_sb.table.return_value = q_turno

    with patch.object(db, "supabase", fake_sb):
        res = db.suspender_o_reprogramar_turno_quirofano("t-op", {"modo": "reprogramar_sin_fecha"})

    assert res["success"] is False
    assert "operado" in res["error"].lower()


def test_suspender_reprogramar_sin_fecha_unilateral_devuelve_a_en_analisis():
    turno_orig = {
        "id": "t-1",
        "asesoria_id": "as-1",
        "paciente_id": "pac-1",
        "quirofano_id": "q-1",
        "fecha_cirugia": "2026-11-16",
        "hora_inicio": "08:20:00",
        "ojo": "OD",
        "estado": "en_espera",
    }
    asesoria_orig = {
        "id": "as-1",
        "paciente_id": "pac-1",
        "estado": "programado",
        "ojo": "OD",
        "fecha_definitiva_cirugia": "2026-11-16",
        "checklist_prequirurgico": {"_agenda_qx": {"hora_inicio": "08:20"}},
    }

    calls = {"turnos_update": [], "asesorias_update": [], "evoluciones_insert": []}

    def table_router(name):
        if name == "turnos_quirofano":
            q = MagicMock()
            def select_fn(*a, **kw):
                s = FakeQuery()
                # Si es la consulta inicial por id o la de restantes por asesoria_id
                def eq_fn(col, val):
                    if col == "id":
                        s._data = [turno_orig]
                    elif col == "asesoria_id":
                        s._data = []  # ya no quedan otros turnos activos
                    return s
                s.eq = eq_fn
                return s
            def update_fn(payload):
                calls["turnos_update"].append(payload)
                u = FakeQuery(data=[turno_orig])
                u.updates = payload
                return u
            q.select = select_fn
            q.update = update_fn
            return q
        if name == "asesorias_quirurgicas":
            q = MagicMock()
            q.select.return_value = FakeQuery(data=[asesoria_orig])
            def update_fn(payload):
                calls["asesorias_update"].append(payload)
                return FakeQuery(data=[{**asesoria_orig, **payload}])
            q.update = update_fn
            return q
        if name == "asesoria_evoluciones":
            q = MagicMock()
            def insert_fn(payload):
                calls["evoluciones_insert"].append(payload)
                return FakeQuery(data=[payload])
            q.insert = insert_fn
            return q
        return FakeQuery()

    fake_sb = MagicMock()
    fake_sb.table.side_effect = table_router

    with patch.object(db, "supabase", fake_sb), patch.object(db, "sincronizar_presupuesto_desde_caso_quirurgico"):
        res = db.suspender_o_reprogramar_turno_quirofano("t-1", {
            "modo": "reprogramar_sin_fecha",
            "motivo": "Ayuno incompleto",
            "observaciones": "Tomó mate a las 07:00 hs",
            "nueva_fecha_probable": "2026-11-23",
            "usuario_nombre": "Lorena Adaro"
        })

    assert res["success"] is True
    assert res["nuevo_estado_asesoria"] == "en_analisis"
    assert calls["turnos_update"][0]["estado"] == "cancelado"
    assert calls["turnos_update"][0]["llegada_at"] is None
    assert calls["asesorias_update"][0]["estado"] == "en_analisis"
    assert calls["asesorias_update"][0]["fecha_definitiva_cirugia"] is None
    assert calls["asesorias_update"][0]["fecha_probable_cirugia"] == "2026-11-23"
    assert len(calls["evoluciones_insert"]) == 1
    assert "Ayuno incompleto" in calls["evoluciones_insert"][0]["contenido"]


def test_suspender_reprogramar_bilateral_preserva_otro_ojo_activo():
    turno_2do = {
        "id": "t-2",
        "asesoria_id": "as-bilat",
        "paciente_id": "pac-2",
        "quirofano_id": "q-1",
        "fecha_cirugia": "2026-11-16",
        "hora_inicio": "09:00:00",
        "ojo": "OI",
        "estado": "programado",
    }
    asesoria_bilat = {
        "id": "as-bilat",
        "paciente_id": "pac-2",
        "estado": "programado",
        "ojo": "AO",
        "modalidad_bilateral": "escalonada",
        "fecha_definitiva_cirugia": "2026-11-10",
        "checklist_prequirurgico": {
            "_meta_bilateral": {
                "modalidad": "escalonada",
                "orden": "OD_primero",
                "fecha_definitiva_2do_ojo": "2026-11-16"
            }
        },
    }
    calls = {"asesorias_update": []}

    def table_router(name):
        if name == "turnos_quirofano":
            q = MagicMock()
            def select_fn(*a, **kw):
                s = FakeQuery()
                def eq_fn(col, val):
                    if col == "id":
                        s._data = [turno_2do]
                    elif col == "asesoria_id":
                        # Queda el 1er ojo (OD) programado/activo
                        s._data = [{"id": "t-1", "estado": "programado", "ojo": "OD", "fecha_cirugia": "2026-11-10"}]
                    return s
                s.eq = eq_fn
                return s
            q.select = select_fn
            q.update.return_value = FakeQuery(data=[turno_2do])
            return q
        if name == "asesorias_quirurgicas":
            q = MagicMock()
            q.select.return_value = FakeQuery(data=[asesoria_bilat])
            def update_fn(payload):
                calls["asesorias_update"].append(payload)
                return FakeQuery(data=[{**asesoria_bilat, **payload}])
            q.update = update_fn
            return q
        if name == "asesoria_evoluciones":
            q = MagicMock()
            q.insert.return_value = FakeQuery(data=[{}])
            return q
        return FakeQuery()

    fake_sb = MagicMock()
    fake_sb.table.side_effect = table_router

    with patch.object(db, "supabase", fake_sb), patch.object(db, "sincronizar_presupuesto_desde_caso_quirurgico"):
        res = db.suspender_o_reprogramar_turno_quirofano("t-2", {
            "modo": "reprogramar_sin_fecha",
            "motivo": "Decisión del paciente en el día",
        })

    assert res["success"] is True
    # Como el 1er ojo sigue activo, el caso permanece en 'programado', pero limpia fecha_definitiva_2do_ojo
    assert res["nuevo_estado_asesoria"] == "programado"
    upd_chk = calls["asesorias_update"][0]["checklist_prequirurgico"]
    assert upd_chk["_meta_bilateral"]["fecha_definitiva_2do_ojo"] is None


def test_cambio_fecha_definitiva_en_asesoria_cancela_turno_existente_sin_reemplazarlo():
    """
    Verifica que si Asesoramiento cambia fecha_definitiva_cirugia sin enviar sala/hora,
    se cancele el turno activo previo con motivo 'reprogramado_asesoramiento'
    y no se cree un turno nuevo automáticamente.
    """
    asesoria_orig = {
        "id": "as-reprog",
        "paciente_id": "pac-1",
        "practica_nombre": "Catarata",
        "medico_derivador_nombre": "Dra. López",
        "medico_cirujano_nombre": "Dr. Pérez",
        "estado": "programado",
        "ojo": "OD",
        "fecha_definitiva_cirugia": "2026-11-16",
        "checklist_prequirurgico": {},
    }
    turno_activo = {
        "id": "t-viejo",
        "asesoria_id": "as-reprog",
        "ojo": "OD",
        "estado": "programado",
        "fecha_cirugia": "2026-11-16",
    }

    turnos_updates = []

    def table_router(name):
        if name == "asesorias_quirurgicas":
            q = MagicMock()
            q.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[asesoria_orig])
            q.update.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[{**asesoria_orig, "fecha_definitiva_cirugia": "2026-12-02"}]
            )
            return q
        if name == "turnos_quirofano":
            q = MagicMock()
            q.select.return_value = FakeQuery(data=[turno_activo])
            def update_fn(payload):
                turnos_updates.append(payload)
                return FakeQuery(data=[{**turno_activo, **payload}])
            q.update = update_fn
            return q
        return FakeQuery()

    fake_sb = MagicMock()
    fake_sb.table.side_effect = table_router

    with patch.object(db, "supabase", fake_sb), \
         patch.object(db, "sincronizar_presupuesto_desde_caso_quirurgico"), \
         patch.object(db, "get_configuracion_automatismos", return_value={"recontacto_humano_en_analisis_activo": False}):
        db.actualizar_asesoria_quirurgica("as-reprog", {
            "practica_nombre": "Catarata",
            "medico_derivador_nombre": "Dra. López",
            "medico_cirujano_nombre": "Dr. Pérez",
            "fecha_definitiva_cirugia": "2026-12-02",
        })

    cancel_updates = [u for u in turnos_updates if u.get("estado") == "cancelado"]
    assert len(cancel_updates) == 1
    assert cancel_updates[0]["motivo_cancelacion"] == "reprogramado_asesoramiento"
