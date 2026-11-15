from unittest.mock import MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.db as db_mod
import app.main as main_mod


def _make_supabase_chain(data_by_range=None, default_data=None):
    """Crea un stub encadenable de Supabase/PostgREST para pruebas unitarias."""
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.update.return_value = chain
    chain.insert.return_value = chain

    if data_by_range is not None:
        def _range(start, end):
            sub = MagicMock()
            sub.execute.return_value = MagicMock(data=data_by_range.get((start, end), []))
            return sub
        chain.range.side_effect = _range
    else:
        chain.range.return_value = chain
        chain.execute.return_value = MagicMock(data=default_data if default_data is not None else [])
    return chain


def test_get_prestadores_filtra_roles_y_activos():
    mock_sb = MagicMock()
    chain = _make_supabase_chain(default_data=[{"id": "1", "nombre_apellido": "GRAS, HERNAN", "rol": "Cirujano", "activo": True}])
    mock_sb.table.return_value = chain

    with patch.object(db_mod, "supabase", mock_sb):
        res = db_mod.get_prestadores(solo_activos=True, roles=["Cirujano", "Otro"])

    assert len(res) == 1
    chain.in_.assert_called_once_with("rol", ["Cirujano", "Otro"])
    chain.eq.assert_called_once_with("activo", True)
    chain.order.assert_called_once_with("nombre_apellido")


def test_actualizar_prestador_parcial_preserva_campos():
    mock_sb = MagicMock()
    chain = _make_supabase_chain(default_data=[{"id": "p1", "activo": False, "rol": "Cirujano", "matricula": "1234"}])
    mock_sb.table.return_value = chain

    with patch.object(db_mod, "supabase", mock_sb):
        act = main_mod.actualizar_prestador_endpoint(
            "p1",
            {"activo": False},
            current_user={"email": "admin@clinica.com"},
        )

    assert act["success"] is True
    assert act["prestador"]["activo"] is False
    update_arg = chain.update.call_args[0][0]
    assert update_arg["activo"] is False
    assert "rol" not in update_arg
    assert "matricula" not in update_arg


def test_sincronizar_geclisa_no_reactiva_ni_sobrescribe_rol():
    crm_existentes = [
        {
            "id": "p-off",
            "nombre_apellido": "DUPLICADO, MEDICO",
            "geclisa_pre_id": 999,
            "matricula": "111",
            "rol": "Otro",
            "activo": False,
        }
    ]
    geclisa_externos = [
        {"pre_id": 999, "nombre": "DUPLICADO, MEDICO", "matricula": "111", "especialidad": "OFTALMOLOGIA"},
        {"pre_id": 2500, "nombre": "NUEVO, DOCTOR", "matricula": "5555", "especialidad": "OFTALMOLOGIA"},
        {"pre_id": 2501, "nombre": "A RECEPCION - PEDIDOS", "matricula": "0", "especialidad": "ADMIN"},
        {"pre_id": 2502, "nombre": "GOMEZ, ANEST", "matricula": "777", "especialidad": "ANESTESIOLOGIA"},
    ]

    mock_geclisa = MagicMock()
    mock_geclisa.buscar_prestadores.return_value = geclisa_externos

    with patch("app.services.geclisa_client.geclisa_client", mock_geclisa), \
         patch.object(db_mod, "get_prestadores", return_value=crm_existentes), \
         patch.object(db_mod, "actualizar_prestador") as mock_upd, \
         patch.object(db_mod, "crear_prestador") as mock_create:
        res = main_mod.sincronizar_prestadores_geclisa_endpoint()

    assert res["success"] is True
    assert res["creados"] == 3
    assert res["actualizados"] == 0
    mock_upd.assert_not_called()

    creados = [call.args[0] for call in mock_create.call_args_list]
    por_id = {c["geclisa_pre_id"]: c for c in creados}
    assert por_id[2500]["rol"] == "Cirujano"
    assert por_id[2500]["activo"] is True
    assert por_id[2501]["activo"] is False  # ruido administrativo
    assert por_id[2502]["rol"] == "Anestesista"
    assert por_id[2502]["activo"] is True


def test_limpiar_no_usados_paginacion_duplicados_y_guardas():
    prestadores_activos = [
        {"id": "c1", "nombre_apellido": "GRAS, HERNAN", "rol": "Cirujano", "geclisa_pre_id": 10, "matricula": "100", "especialidad": "Oft", "firma_url": None, "activo": True},
        {"id": "c1-dup", "nombre_apellido": "Dr. Hernán Gras", "rol": "Cirujano", "geclisa_pre_id": 99, "matricula": "100", "especialidad": "Oft", "firma_url": None, "activo": True},
        {"id": "c2-unused", "nombre_apellido": "SIN USO, MEDICO", "rol": "Otro", "geclisa_pre_id": 20, "matricula": "200", "especialidad": "Oft", "firma_url": None, "activo": True},
        {"id": "a1-used", "nombre_apellido": "LOPEZ, ANESTESISTA", "rol": "Anestesista", "geclisa_pre_id": 30, "matricula": "300", "especialidad": "Anest", "firma_url": None, "activo": True},
        {"id": "i1-manual", "nombre_apellido": "AMBROSIO, VERONICA", "rol": "Instrumentador", "geclisa_pre_id": None, "matricula": None, "especialidad": "Instr", "firma_url": None, "activo": True},
    ]

    # Simular > 1000 filas en asesorias_quirurgicas (pagina 1 de 1000 + pagina 2 con el medico usado)
    pagina_1 = [{"medico_derivador_id": None, "medico_cirujano_id": None, "medico_derivador_nombre": "", "medico_cirujano_nombre": ""} for _ in range(1000)]
    pagina_2 = [{"medico_derivador_id": None, "medico_cirujano_id": 10, "medico_derivador_nombre": "", "medico_cirujano_nombre": "GRAS, HERNAN"}]
    turnos_rows = [{"cirujano_id": None, "cirujano_nombre": "", "medico_derivador_nombre": "", "anestesiologo_nombre": "Dra. López Anestesista"}]

    asesorias_chain = _make_supabase_chain(data_by_range={(0, 999): pagina_1, (1000, 1999): pagina_2})
    turnos_chain = _make_supabase_chain(data_by_range={(0, 999): turnos_rows})
    upd_chain = _make_supabase_chain(default_data=[])

    mock_sb = MagicMock()
    def _table(name):
        if name == "asesorias_quirurgicas":
            return asesorias_chain
        if name == "turnos_quirofano":
            return turnos_chain
        return upd_chain
    mock_sb.table.side_effect = _table

    with patch.object(db_mod, "supabase", mock_sb), \
         patch.object(db_mod, "get_prestadores", return_value=prestadores_activos):
        dry = db_mod.limpiar_prestadores_no_usados(dry_run=True)

        assert dry["excluidos_instrumentador_count"] == 1
        assert dry["usados_count"] == 2  # c1 y a1-used
        cand_ids = {c["id"]: c for c in dry["candidatos_deshabilitar"]}
        assert "i1-manual" not in cand_ids
        assert "c2-unused" in cand_ids
        assert "c1-dup" in cand_ids
        assert cand_ids["c1-dup"]["posible_duplicado"] is True
        upd_chain.update.assert_not_called()

        # Lista vacia [] explicita NO debe deshabilitar todos
        res_empty = db_mod.limpiar_prestadores_no_usados(dry_run=False, ids_a_deshabilitar=[])
        assert res_empty["actualizados"] == 0
        upd_chain.update.assert_not_called()

        # Confirmacion explicita + guarda de rol en backend (ignora i1-manual si viniera inyectado)
        res_apply = db_mod.limpiar_prestadores_no_usados(
            dry_run=False,
            ids_a_deshabilitar=["c2-unused", "i1-manual"],
        )
        assert res_apply["actualizados"] == 1
        assert res_apply["ids_deshabilitados"] == ["c2-unused"]
        upd_chain.update.assert_called_once()
        upd_chain.in_.assert_any_call("id", ["c2-unused"])
        upd_chain.in_.assert_any_call("rol", ["Cirujano", "Otro", "Anestesista"])
