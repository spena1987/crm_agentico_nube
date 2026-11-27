import base64
import json
import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.optica_vortix_router import _enriquecer_conversacion_optica_frontend
from app.services.optica_vortix_service import (
    _reparar_mojibake_utf8,
    extraer_graduacion_desde_imagen_receta,
    preparar_reset_vinculacion_manual,
)

client = TestClient(app)


def get_auth_headers():
    secret = os.environ.get("SUPABASE_JWT_SECRET", "super-secret-jwt-key-for-test-2026-audit")
    token = jwt.encode(
        {
            "sub": "user-optica-123",
            "email": "optica@vortix.com",
            "user_metadata": {"full_name": "Ana Óptica"},
            "role": "authenticated",
            "aud": "authenticated",
            "exp": 9999999999,
        },
        secret,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


class _TableMock:
    """Mock encadenable para simular consultas de supabase-py por tabla."""

    def __init__(self, rows=None, on_update=None, on_select=None):
        self.rows = list(rows or [])
        self.on_update = on_update
        self.on_select = on_select
        self.update_calls = []
        self.select_cols = []
        self._op = "select"
        self._payload = None

    def select(self, cols="*"):
        self._op = "select"
        self.select_cols.append(cols)
        if self.on_select:
            self.on_select(cols)
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        self.update_calls.append(payload)
        if self.on_update:
            self.on_update(payload)
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def in_(self, *args, **kwargs):
        return self

    def not_(self, *args, **kwargs):
        return self

    @property
    def not_prop(self):
        return self

    def is_(self, *args, **kwargs):
        return self

    def or_(self, *args, **kwargs):
        return self

    def ilike(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=list(self.rows))


class _NotProxy:
    def __init__(self, parent):
        self.parent = parent

    def is_(self, *args, **kwargs):
        return self.parent


class _TableMockWithNot(_TableMock):
    @property
    def not_(self):
        return _NotProxy(self)


def _make_supabase_mock(tables_map):
    sb = MagicMock()
    sb.table.side_effect = lambda name: tables_map[name]
    return sb


# ============================================================================
# 1. Enriquecimiento de identidad clínica (titular vs vinculación manual)
# ============================================================================


def test_enriquecer_conversacion_titular_vs_vinculacion_manual():
    base_row = {
        "id": "conv-1",
        "telefono": "5492612477169",
        "nombre_contacto": "Diaz Bruno",
        "etapa_comercial": "PRESUPUESTO_AEREOS",
        "metadata_json": {
            "graduacion_vinculada_json": {
                "od": {"esfera": "-2.50", "cilindro": "-0.50", "eje": "90°"},
                "oi": {"esfera": "-2.25", "cilindro": "0.00", "eje": "0°"},
            }
        },
        "optica_contactos": {
            "id": "cont-1",
            "nombre": "Diaz Bruno",
            "dni": "70895167",
            "ficha_geclisa_id": "101",
            "obra_social": "PREVENCION SALUD",
            "graduacion_actual_json": {
                "od": {"esfera": "+1.00", "cilindro": "0.00", "eje": "0°"},
                "oi": {"esfera": "+1.00", "cilindro": "0.00", "eje": "0°"},
            },
        },
        "vinculacion_manual": False,
    }

    titular = _enriquecer_conversacion_optica_frontend(base_row)
    assert titular["nombre_paciente"] == "Diaz Bruno"
    assert titular["ficha_geclisa_id"] == "101"
    assert titular["dni"] == "70895167"
    assert titular["titular_telefono_nombre"] == "Diaz Bruno"
    assert titular["titular_telefono_dni"] == "70895167"
    assert titular["graduacion_actual_json"]["od"]["esfera"] == "+1.00"
    assert titular["vinculacion_manual"] is False

    vinculado_row = {
        **base_row,
        "vinculacion_manual": True,
        "paciente_vinculado_ficha_id": "202",
        "paciente_vinculado_nombre": "Candela Yarzabal",
        "paciente_vinculado_dni": "39111222",
        "paciente_vinculado_obra_social": "PREVENCION A2",
        "vinculado_por": "Ana Óptica",
    }
    vinculado = _enriquecer_conversacion_optica_frontend(vinculado_row)
    assert vinculado["nombre_paciente"] == "Candela Yarzabal"
    assert vinculado["ficha_geclisa_id"] == "202"
    assert vinculado["dni"] == "39111222"
    assert vinculado["obra_social"] == "PREVENCION A2"
    assert vinculado["titular_telefono_nombre"] == "Diaz Bruno"
    assert vinculado["titular_telefono_dni"] == "70895167"
    assert vinculado["graduacion_actual_json"]["od"]["esfera"] == "-2.50"
    assert vinculado["vinculacion_manual"] is True

    # Si está vinculado manualmente y todavía no tiene graduación propia, NO debe filtrar la del titular
    sin_grad_propia = {**vinculado_row, "metadata_json": {}}
    vinculado_vacio = _enriquecer_conversacion_optica_frontend(sin_grad_propia)
    assert vinculado_vacio["graduacion_actual_json"]["od"]["esfera"] in (None, "")


# ============================================================================
# 2. Vincular / desvincular paciente Geclisa + reset al reabrir
# ============================================================================


def test_vincular_paciente_validaciones_y_cambios():
    conv_row = {
        "id": "conv-abc",
        "contacto_id": "cont-1",
        "telefono": "5492612477169",
        "vinculacion_manual": True,
        "paciente_vinculado_ficha_id": "999",
        "paciente_vinculado_nombre": "Otro Paciente",
        "metadata_json": {"graduacion_vinculada_json": {"od": {"esfera": "-1.00"}}, "otro_dato": "ok"},
        "optica_contactos": {"id": "cont-1", "nombre": "Diaz Bruno", "dni": "70895167", "ficha_geclisa_id": "101"},
    }
    conv_table = _TableMock(rows=[conv_row])
    contact_table = _TableMock(rows=[conv_row["optica_contactos"]])
    sb = _make_supabase_mock({"optica_conversaciones": conv_table, "optica_contactos": contact_table})

    with patch("app.routers.optica_vortix_router.supabase", sb), \
         patch("app.routers.optica_vortix_router._record_optica_outbound_msg") as mock_nota:
        # Ficha inválida -> 400
        resp_bad = client.post(
            "/api/optica-vortix/conversaciones/conv-abc/vincular-paciente",
            json={"ficha_geclisa_id": "0", "nombre": "Candela Yarzabal"},
            headers=get_auth_headers(),
        )
        assert resp_bad.status_code == 400

        # Conversación válida -> actualiza solo optica_conversaciones y limpia graduacion_vinculada_json previa
        resp_ok = client.post(
            "/api/optica-vortix/conversaciones/conv-abc/vincular-paciente",
            json={
                "ficha_geclisa_id": "202",
                "nombre": "Candela Yarzabal",
                "dni": "39111222",
                "obra_social": "PREVENCION",
            },
            headers=get_auth_headers(),
        )
        assert resp_ok.status_code == 200
        assert len(conv_table.update_calls) == 1
        upd = conv_table.update_calls[0]
        assert upd["vinculacion_manual"] is True
        assert upd["paciente_vinculado_ficha_id"] == "202"
        assert upd["paciente_vinculado_nombre"] == "Candela Yarzabal"
        assert "graduacion_vinculada_json" not in upd["metadata_json"]
        assert upd["metadata_json"]["otro_dato"] == "ok"
        assert len(contact_table.update_calls) == 0
        mock_nota.assert_called_once()
        assert mock_nota.call_args.kwargs["tipo"] == "nota_interna"


def test_vincular_paciente_404_y_delete_desvincular():
    empty_conv = _TableMock(rows=[])
    sb_empty = _make_supabase_mock({"optica_conversaciones": empty_conv})
    with patch("app.routers.optica_vortix_router.supabase", sb_empty):
        resp_404 = client.post(
            "/api/optica-vortix/conversaciones/no-existe/vincular-paciente",
            json={"ficha_geclisa_id": "202", "nombre": "Candela Yarzabal"},
            headers=get_auth_headers(),
        )
        assert resp_404.status_code == 404

    conv_vinculada = {
        "id": "conv-abc",
        "contacto_id": "cont-1",
        "vinculacion_manual": True,
        "paciente_vinculado_nombre": "Candela Yarzabal",
        "paciente_vinculado_ficha_id": "202",
        "metadata_json": {"graduacion_vinculada_json": {"od": {"esfera": "-1.00"}}},
        "optica_contactos": {"id": "cont-1", "nombre": "Diaz Bruno"},
    }
    conv_table = _TableMock(rows=[conv_vinculada])
    sb_del = _make_supabase_mock({"optica_conversaciones": conv_table})
    with patch("app.routers.optica_vortix_router.supabase", sb_del), \
         patch("app.routers.optica_vortix_router._record_optica_outbound_msg") as mock_nota:
        resp_del = client.delete(
            "/api/optica-vortix/conversaciones/conv-abc/vincular-paciente",
            headers=get_auth_headers(),
        )
        assert resp_del.status_code == 200
        upd = conv_table.update_calls[0]
        assert upd["vinculacion_manual"] is False
        assert upd["paciente_vinculado_ficha_id"] is None
        assert upd["paciente_vinculado_nombre"] is None
        assert "graduacion_vinculada_json" not in upd["metadata_json"]
        mock_nota.assert_called_once()
        assert mock_nota.call_args.kwargs["tipo"] == "nota_interna"


def test_preparar_reset_vinculacion_manual():
    upd_none, nota_none = preparar_reset_vinculacion_manual({"id": "c1", "vinculacion_manual": False})
    assert upd_none == {}
    assert nota_none is None

    upd, nota = preparar_reset_vinculacion_manual(
        {
            "id": "c2",
            "vinculacion_manual": True,
            "paciente_vinculado_nombre": "Candela Yarzabal",
            "paciente_vinculado_ficha_id": "202",
            "metadata_json": {"graduacion_vinculada_json": {"od": {"esfera": "-2.00"}}, "keep": 1},
        },
        motivo_auditoria="Reapertura manual",
    )
    assert upd["vinculacion_manual"] is False
    assert upd["paciente_vinculado_ficha_id"] is None
    assert "graduacion_vinculada_json" not in upd["metadata_json"]
    assert upd["metadata_json"]["keep"] == 1
    assert "Candela Yarzabal" in nota
    assert "Ficha 202" in nota


# ============================================================================
# 3. OCR de receta aislado cuando no debe persistir en optica_contactos
# ============================================================================


@pytest.mark.asyncio
async def test_ocr_receta_no_persiste_en_contacto_si_vinculado():
    fake_grad = {
        "od": {"esfera": "-1.75", "cilindro": "-0.50", "eje": "85°"},
        "oi": {"esfera": "-1.50", "cilindro": "-0.25", "eje": "90°"},
        "adicion": "",
        "dnp": "62 mm",
        "tipo_lente_sugerido": "Monofocal Antirreflex",
        "medico_prescriptor": "Dra. Pérez",
        "fecha_receta": "2026-11-20",
        "observaciones": "Uso permanente",
    }
    fake_genai_client = MagicMock()
    fake_genai_client.models.generate_content.return_value = SimpleNamespace(text=json.dumps(fake_grad))

    conv_table = _TableMock(rows=[{"contacto_id": "cont-1", "vinculacion_manual": True}])
    contact_table = _TableMock(rows=[])
    sb = _make_supabase_mock({"optica_conversaciones": conv_table, "optica_contactos": contact_table})

    b64_img = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0test").decode("ascii")
    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake-key"}), \
         patch("google.genai.Client", return_value=fake_genai_client), \
         patch("app.services.optica_vortix_service.supabase", sb):
        res1 = await extraer_graduacion_desde_imagen_receta(
            b64_img,
            conversacion_id="conv-1",
            contacto_id="cont-1",
            persistir_en_contacto=False,
        )
        assert res1["success"] is True
        assert res1["graduacion"]["od"]["esfera"] == "-1.75"
        assert len(contact_table.update_calls) == 0

        # Incluso si persistir_en_contacto=True, la guardia interna de vinculacion_manual=True lo bloquea
        res2 = await extraer_graduacion_desde_imagen_receta(
            b64_img,
            conversacion_id="conv-1",
            contacto_id="cont-1",
            persistir_en_contacto=True,
        )
        assert res2["success"] is True
        assert len(contact_table.update_calls) == 0


# ============================================================================
# 4. Búsqueda de pacientes Geclisa + columna real geclisa_ficha_id y deduplicación
# ============================================================================


def test_buscar_paciente_geclisa_consulta_geclisa_ficha_id_y_deduplica():
    oc_table = _TableMockWithNot(
        rows=[
            {"ficha_geclisa_id": "202", "nombre": "Candela Yarzabal", "dni": "39111222", "obra_social": "PREVENCION", "telefono": "5492612477169"}
        ]
    )
    pac_table = _TableMockWithNot(
        rows=[
            # Ficha 202 duplicada -> debe descartarse por deduplicación; 303 única -> debe incluirse
            {"geclisa_ficha_id": 202, "nombre": "Candela Yarzabal Local", "dni": "39111222", "obra_social": "OSDE", "telefono": "2612477169"},
            {"geclisa_ficha_id": 303, "nombre": "Candela Gomez", "dni": "40111222", "obra_social": "OSEP", "telefono": "2615550000"},
        ]
    )
    sb = _make_supabase_mock({"optica_contactos": oc_table, "pacientes": pac_table})

    with patch("app.routers.optica_vortix_router.supabase", sb):
        resp_txt = client.get("/api/optica-vortix/geclisa/buscar-paciente?q=Candela", headers=get_auth_headers())
        assert resp_txt.status_code == 200
        data_txt = resp_txt.json()
        assert any("geclisa_ficha_id" in cols for cols in pac_table.select_cols)
        fichas = [c["ficha_geclisa_id"] for c in data_txt["candidatos"]]
        assert fichas == ["202", "303"]
        assert data_txt["candidatos"][0]["fuente"] == "optica_contactos"
        assert data_txt["candidatos"][1]["fuente"] == "pacientes"

    # Búsqueda numérica: Geclisa tiene prioridad y deduplica respecto a locales
    with patch("app.routers.optica_vortix_router.supabase", sb), \
         patch(
             "app.routers.optica_vortix_router.geclisa_client.buscar_candidatos_por_dni",
             return_value={"candidatos": [{"ficha_id": 202, "nombre_completo": "Candela Yarzabal Geclisa", "dni": "39111222"}]},
         ), \
         patch(
             "app.routers.optica_vortix_router.geclisa_client.obtener_cobertura_paciente",
             return_value={"obra_social": "PREVENCION SALUD"},
         ), \
         patch(
             "app.routers.optica_vortix_router.geclisa_client.buscar_paciente_por_ficha",
             return_value={"encontrado": False},
         ):
        resp_num = client.get("/api/optica-vortix/geclisa/buscar-paciente?q=39111222", headers=get_auth_headers())
        assert resp_num.status_code == 200
        cands = resp_num.json()["candidatos"]
        ficha_202 = [c for c in cands if c["ficha_geclisa_id"] == "202"]
        assert len(ficha_202) == 1
        assert ficha_202[0]["fuente"] == "geclisa"
        assert ficha_202[0]["obra_social"] == "PREVENCION SALUD"


# ============================================================================
# 5. PATCH conversación: validación de etapas (SIN_INTERES vs inválida) y graduación
# ============================================================================


def test_patch_conversacion_valida_etapa_sin_interes_y_rechaza_invalida():
    conv_row = {
        "id": "conv-patch-1",
        "contacto_id": "cont-1",
        "telefono": "5492612477169",
        "vinculacion_manual": True,
        "etapa_comercial": "NUEVA_CONSULTA",
        "metadata_json": {},
        "optica_contactos": {"id": "cont-1", "nombre": "Diaz Bruno"},
    }
    conv_table = _TableMock(rows=[conv_row])
    contact_table = _TableMock(rows=[])
    sb = _make_supabase_mock({"optica_conversaciones": conv_table, "optica_contactos": contact_table})

    with patch("app.routers.optica_vortix_router.supabase", sb):
        # Etapa inválida (antiguo DESCARTADO o texto arbitrario) -> 400
        resp_inv = client.patch(
            "/api/optica-vortix/conversaciones/conv-patch-1",
            json={"etapa_comercial": "DESCARTADO"},
            headers=get_auth_headers(),
        )
        assert resp_inv.status_code == 400

        # Etapa SIN_INTERES válida + graduación en chat vinculado -> actualiza solo conversación
        resp_ok = client.patch(
            "/api/optica-vortix/conversaciones/conv-patch-1",
            json={
                "etapa_comercial": "SIN_INTERES",
                "graduacion_actual_json": {"od": {"esfera": "-3.00", "cilindro": "0.00", "eje": "0°"}},
            },
            headers=get_auth_headers(),
        )
        assert resp_ok.status_code == 200
        upd = conv_table.update_calls[0]
        assert upd["etapa_comercial"] == "SIN_INTERES"
        assert upd["clasificacion_origen"] == "manual"
        assert upd["etapa_updated_at"]
        assert upd["metadata_json"]["graduacion_vinculada_json"]["od"]["esfera"] == "-3.00"
        assert len(contact_table.update_calls) == 0


# ============================================================================
# 6. Reparación de mojibake UTF-8 en nombres de archivos entrantes
# ============================================================================


def test_reparar_mojibake_utf8():
    assert _reparar_mojibake_utf8("Indicaciones MÃ©dicas 608994.pdf") == "Indicaciones Médicas 608994.pdf"
    # Idempotente para UTF-8 limpio y valores vacíos
    assert _reparar_mojibake_utf8("Indicaciones Médicas 608994.pdf") == "Indicaciones Médicas 608994.pdf"
    assert _reparar_mojibake_utf8("Óptica Peña.pdf") == "Óptica Peña.pdf"
    assert _reparar_mojibake_utf8(None) == ""
