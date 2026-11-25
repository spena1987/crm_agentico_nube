import os
import time
import jwt
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_JWT_SECRET", "super-secret-jwt-key-for-test-2026-audit")

from app import auth, db, main
from app.services.geclisa_client import GeclisaClient, es_ficha_geclisa_valida


def _auth_header():
    token = jwt.encode(
        {
            "sub": "test-user-estabilidad",
            "email": "test@centrovision.com",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        },
        os.environ["SUPABASE_JWT_SECRET"],
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_draft_id_evoluciones_no_toca_bd_y_retorna_400_en_post():
    draft_id = "draft-1795627040658-lk1kt"
    assert db.es_borrador_o_nulo(draft_id) is True

    mock_sb = MagicMock()
    with patch.object(db, "supabase", mock_sb):
        evs = db.get_evoluciones_by_asesoria(draft_id)
        assert evs == []
        mock_sb.table.assert_not_called()

        with pytest.raises(ValueError):
            db.crear_evolucion_asesoria(
                {
                    "asesoria_id": draft_id,
                    "paciente_id": "11111111-1111-1111-1111-111111111111",
                    "contenido": "Intento de evolución sobre borrador",
                }
            )
        mock_sb.table.assert_not_called()

    client = TestClient(main.app)
    headers = _auth_header()

    r_get = client.get(f"/api/asesorias-quirurgicas/{draft_id}/evoluciones", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()["evoluciones"] == []

    r_post = client.post(
        f"/api/asesorias-quirurgicas/{draft_id}/evoluciones",
        json={
            "paciente_id": "11111111-1111-1111-1111-111111111111",
            "contenido": "Nota sobre borrador",
        },
        headers=headers,
    )
    assert r_post.status_code == 400


def test_cambiar_estado_presupuesto_no_sobrescribe_checklist_si_falla_lectura():
    mock_sb = MagicMock()
    captured_updates = []

    presupuesto_row = {
        "id": "22222222-2222-2222-2222-222222222222",
        "asesoria_id": "33333333-3333-3333-3333-333333333333",
        "paciente_id": "44444444-4444-4444-4444-444444444444",
        "total": 150000.0,
        "estado": "aprobado",
    }

    p_tbl = MagicMock()
    p_tbl.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[presupuesto_row])

    as_tbl = MagicMock()
    # Tanto el SELECT de columnas específicas como el fallback SELECT * fallan
    as_tbl.select.return_value.eq.return_value.execute.side_effect = RuntimeError("column error")
    as_tbl.select.return_value.eq.return_value.limit.return_value.execute.side_effect = RuntimeError("fallback error")

    def _capture_update(payload):
        captured_updates.append(payload)
        upd_m = MagicMock()
        upd_m.eq.return_value.execute.return_value = MagicMock(data=[{"id": presupuesto_row["asesoria_id"], **payload}])
        return upd_m

    as_tbl.update.side_effect = _capture_update

    ev_tbl = MagicMock()
    ev_tbl.select.return_value.eq.return_value.ilike.return_value.gte.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    ev_tbl.insert.return_value.execute.return_value = MagicMock(data=[{"id": "ev-1"}])

    def _table_side_effect(name):
        if name == "presupuestos":
            return p_tbl
        if name == "asesorias_quirurgicas":
            return as_tbl
        if name == "asesoria_evoluciones":
            return ev_tbl
        return MagicMock()

    mock_sb.table.side_effect = _table_side_effect

    with patch.object(db, "supabase", mock_sb):
        db.cambiar_estado_presupuesto(
            presupuesto_id=presupuesto_row["id"],
            nuevo_estado="aprobado",
            asesoria_id=presupuesto_row["asesoria_id"],
            origen="TEST_UNITARIO",
        )

    assert len(captured_updates) >= 1
    assert all("checklist_prequirurgico" not in upd for upd in captured_updates)


def test_validacion_ficha_geclisa_int32_rechaza_telefonos():
    assert es_ficha_geclisa_valida(123456) is True
    assert es_ficha_geclisa_valida("987654") is True
    assert es_ficha_geclisa_valida(5492612477169) is False
    assert es_ficha_geclisa_valida("5492612477169") is False
    assert es_ficha_geclisa_valida(2147483648) is False
    assert es_ficha_geclisa_valida(0) is False
    assert es_ficha_geclisa_valida(-5) is False
    assert es_ficha_geclisa_valida(None) is False
    assert es_ficha_geclisa_valida("abc") is False

    client = GeclisaClient()
    with patch.object(client, "_do_request") as mock_req:
        res = client.obtener_turnos_pendientes_ficha(5492612477169)
        assert res["success"] is True
        assert res["turnos"] == []
        mock_req.assert_not_called()


def test_prune_auth_caches_evicts_expired_entries():
    old_valid = dict(auth._AUTH_TOKEN_CACHE)
    old_invalid = dict(auth._AUTH_INVALID_TOKEN_CACHE)
    try:
        auth._AUTH_TOKEN_CACHE.clear()
        auth._AUTH_INVALID_TOKEN_CACHE.clear()
        now = time.time()
        for i in range(auth._AUTH_CACHE_MAX_ENTRIES + 50):
            auth._AUTH_TOKEN_CACHE[f"exp-{i}"] = ({"sub": str(i)}, now - 10)
            auth._AUTH_INVALID_TOKEN_CACHE[f"inv-{i}"] = now - 10
        auth._AUTH_TOKEN_CACHE["fresh-token"] = ({"sub": "active"}, now + 300)

        auth._prune_auth_caches(now)
        assert "fresh-token" in auth._AUTH_TOKEN_CACHE
        assert len(auth._AUTH_TOKEN_CACHE) == 1
        assert len(auth._AUTH_INVALID_TOKEN_CACHE) == 0
    finally:
        auth._AUTH_TOKEN_CACHE.clear()
        auth._AUTH_TOKEN_CACHE.update(old_valid)
        auth._AUTH_INVALID_TOKEN_CACHE.clear()
        auth._AUTH_INVALID_TOKEN_CACHE.update(old_invalid)
