import os
import sys
from unittest.mock import patch
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.main as main_mod


def test_emitir_presupuesto_rechaza_draft_id():
    payload = {
        "paciente_id": "11111111-1111-1111-1111-111111111111",
        "asesoria_id": "draft-1794754409067-u07ea",
        "items": [{"nombre": "FACO", "cantidad": 1, "precio_unitario": 1000}],
    }
    with pytest.raises(HTTPException) as exc:
        main_mod.emitir_presupuesto_rapido(payload)
    assert exc.value.status_code == 400
    assert "UUID" in exc.value.detail


def test_emitir_presupuesto_acepta_uuid_valido():
    payload = {
        "paciente_id": "11111111-1111-1111-1111-111111111111",
        "asesoria_id": "22222222-2222-2222-2222-222222222222",
        "items": [{"nombre": "FACO", "cantidad": 1, "precio_unitario": 1000}],
    }
    with patch.object(main_mod, "crear_presupuesto_rapido", return_value={"id": "p-1"}) as mock_crear:
        res = main_mod.emitir_presupuesto_rapido(payload)
    assert res["success"] is True
    mock_crear.assert_called_once_with(payload)
