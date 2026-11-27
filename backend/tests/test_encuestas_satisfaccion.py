import asyncio
import os
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_JWT_SECRET", "super-secret-jwt-key-for-test-2026-audit")
os.environ.setdefault("WEBHOOK_SECRET", "test_webhook_token_123")

from app.main import app
from app.services import encuestas_satisfaccion_service as enc_svc
from app.services.geclisa_client import GeclisaClient
from app.services.whatsapp_cloud.normalizer import normalizar_telefono_argentina_movil
from app.services.whatsapp_cloud.templates import create_template, sync_templates_from_meta
from app.services.whatsapp_cloud.worker import (
    handle_estudios_line_inbound_message,
    handle_status_update,
)
from app.services.whatsapp_cloud.client import InvalidParameterError, RateLimitExceededError

client = TestClient(app)


def _make_jwt(sub: str = "user-uuid-1", role: str = "authenticated") -> str:
    payload = {
        "sub": sub,
        "email": "admin@clinica.test",
        "role": role,
        "aud": "authenticated",
        "exp": 9999999999,
    }
    return jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")


class _FakeQuery:
    def __init__(self, db, table_name: str):
        self.db = db
        self.table_name = table_name
        self._op = "select"
        self._filters = []
        self._payload = None
        self._limit = None
        self._range = None
        self._on_conflict = None
        self._ignore_dup = False
        self._order_col = None
        self._order_desc = False
        self._count_mode = None

    def select(self, *_args, **kwargs):
        self._op = "select"
        self._count_mode = kwargs.get("count")
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(self, payload, on_conflict=None, ignore_duplicates=False):
        self._op = "upsert"
        self._payload = payload
        self._on_conflict = on_conflict
        self._ignore_dup = ignore_duplicates
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters.append(("eq", col, val))
        return self

    def gte(self, col, val):
        self._filters.append(("gte", col, val))
        return self

    def in_(self, col, vals):
        self._filters.append(("in", col, list(vals)))
        return self

    def order(self, col, desc=False):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def _matches(self, row: dict) -> bool:
        for op, col, val in self._filters:
            rv = row.get(col)
            if op == "eq" and str(rv) != str(val):
                return False
            if op == "gte" and (rv is None or str(rv) < str(val)):
                return False
            if op == "in" and rv not in val:
                return False
        return True

    def execute(self):
        rows = self.db.tables.setdefault(self.table_name, [])
        if self._op == "select":
            matched = [dict(r) for r in rows if self._matches(r)]
            if self.table_name == "encuestas_envios":
                turnos = self.db.tables.get("encuestas_envios_turnos", [])
                for m in matched:
                    m["encuestas_envios_turnos"] = [t for t in turnos if t.get("envio_id") == m.get("id")]
            if self._order_col:
                matched.sort(key=lambda r: str(r.get(self._order_col) or ""), reverse=self._order_desc)
            total_count = len(matched)
            if self._range is not None:
                s, e = self._range
                matched = matched[s : e + 1]
            elif self._limit is not None:
                matched = matched[: self._limit]
            return SimpleNamespace(data=matched, count=total_count if self._count_mode else None)

        if self._op == "insert":
            items = self._payload if isinstance(self._payload, list) else [self._payload]
            inserted = []
            for item in items:
                rec = dict(item)
                if "id" not in rec:
                    rec["id"] = self.db.next_id()
                rows.append(rec)
                inserted.append(dict(rec))
            return SimpleNamespace(data=inserted)

        if self._op == "upsert":
            items = self._payload if isinstance(self._payload, list) else [self._payload]
            conflict_cols = [c.strip() for c in (self._on_conflict or "").split(",") if c.strip()]
            out = []
            for item in items:
                rec = dict(item)
                existing = None
                if conflict_cols:
                    for r in rows:
                        if all(str(r.get(c)) == str(rec.get(c)) for c in conflict_cols):
                            existing = r
                            break
                if existing is not None:
                    if not self._ignore_dup:
                        existing.update(rec)
                    out.append(dict(existing))
                else:
                    if "id" not in rec:
                        rec["id"] = self.db.next_id()
                    rows.append(rec)
                    out.append(dict(rec))
            return SimpleNamespace(data=out)

        if self._op == "update":
            updated = []
            for r in rows:
                if self._matches(r):
                    r.update(self._payload)
                    updated.append(dict(r))
            return SimpleNamespace(data=updated)

        if self._op == "delete":
            deleted = [r for r in rows if self._matches(r)]
            self.db.tables[self.table_name] = [r for r in rows if not self._matches(r)]
            return SimpleNamespace(data=deleted)

        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self):
        self._seq = 100
        self.tables = {
            "configuracion_sistema": [
                {
                    "clave": "encuestas_config",
                    "valor": dict(enc_svc.DEFAULT_ENCUESTAS_CONFIG),
                    "descripcion": "test",
                }
            ],
            "encuestas_lotes_diarios": [],
            "encuestas_mapeo_geclisa": [],
            "encuestas_envios": [],
            "encuestas_envios_turnos": [],
            "encuestas_opt_out": [],
            "estudios_oftalmo": [],
            "usuarios_perfil": [],
            "rol_permisos": [],
            "whatsapp_templates": [],
            "logs_sistema": [],
        }
        self.rpc_calls = []

    def next_id(self) -> int:
        self._seq += 1
        return self._seq

    def table(self, name: str):
        return _FakeQuery(self, name)

    def rpc(self, fn_name: str, params: dict):
        return SimpleNamespace(execute=lambda: self._exec_rpc(fn_name, params))

    def _exec_rpc(self, fn_name: str, params: dict):
        self.rpc_calls.append((fn_name, params))
        if fn_name == "adquirir_lote_encuestas_diario":
            fecha = params["p_fecha"]
            forzar = params.get("p_forzar", False)
            lotes = self.tables["encuestas_lotes_diarios"]
            for row in lotes:
                if row["fecha_atencion"] == fecha:
                    if forzar or row["estado"] == "fallido":
                        row["estado"] = "procesando"
                        return SimpleNamespace(data=True)
                    return SimpleNamespace(data=False)
            lotes.append({"fecha_atencion": fecha, "estado": "procesando", "claimed_at": datetime.now(timezone.utc).isoformat()})
            return SimpleNamespace(data=True)

        if fn_name == "crear_envio_encuesta_con_turnos":
            fecha = params["p_fecha_atencion"]
            tel = params["p_telefono_e164"]
            envios = self.tables["encuestas_envios"]
            existing = next((e for e in envios if e["fecha_atencion"] == fecha and e["telefono_e164"] == tel), None)
            if existing is None:
                eid = f"uuid-{self.next_id()}"
                existing = {
                    "id": eid,
                    "token": params["p_token"],
                    "fecha_atencion": fecha,
                    "telefono_e164": tel,
                    "estado_cola": "pendiente",
                    "intentos": 0,
                    "claimed_at": None,
                    "wamid": None,
                    "wa_status": None,
                    "wa_error_code": None,
                    "wa_error_message": None,
                    "expires_at": params["p_expires_at"],
                    "sent_at": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                envios.append(existing)
            else:
                eid = existing["id"]

            turnos_tbl = self.tables["encuestas_envios_turnos"]
            for t in params["p_turnos"]:
                if not any(x["turno_id"] == t["turno_id"] for x in turnos_tbl):
                    row_t = dict(t)
                    row_t["id"] = self.next_id()
                    row_t["envio_id"] = eid
                    row_t["click_count"] = 0
                    row_t["clicked_at"] = None
                    turnos_tbl.append(row_t)
            return SimpleNamespace(data=eid)

        if fn_name == "claim_encuestas_envios_pendientes":
            limit = int(params.get("p_limit") or 25)
            claimed = []
            for e in self.tables["encuestas_envios"]:
                if e["estado_cola"] == "pendiente" and len(claimed) < limit:
                    e["estado_cola"] = "enviando"
                    e["claimed_at"] = datetime.now(timezone.utc).isoformat()
                    claimed.append(dict(e))
            return SimpleNamespace(data=claimed)

        if fn_name == "registrar_clic_encuesta_turno":
            token = params["p_token"]
            turno_id = params["p_turno_id"]
            env = next((e for e in self.tables["encuestas_envios"] if e["token"] == token), None)
            if env is None:
                return SimpleNamespace(data=[{"ok": False, "estado": "no_encontrado", "click_count": 0}])
            exp_dt = datetime.fromisoformat(str(env["expires_at"]).replace("Z", "+00:00"))
            if exp_dt <= datetime.now(timezone.utc):
                return SimpleNamespace(data=[{"ok": False, "estado": "expirado", "click_count": 0}])
            tr = next((t for t in self.tables["encuestas_envios_turnos"] if t["envio_id"] == env["id"] and t["turno_id"] == turno_id), None)
            if tr is None:
                return SimpleNamespace(data=[{"ok": False, "estado": "turno_invalido", "click_count": 0}])
            tr["click_count"] = int(tr.get("click_count") or 0) + 1
            if not tr.get("clicked_at"):
                tr["clicked_at"] = datetime.now(timezone.utc).isoformat()
            return SimpleNamespace(data=[{"ok": True, "estado": "ok", "click_count": tr["click_count"]}])

        return SimpleNamespace(data=None)


# 1. Cálculo D+1 (lunes -> sábado, domingo -> None, feriados sin exclusión)
def test_calcular_fecha_objetivo_d_mas_1():
    # Lunes 2026-11-30 -> Sábado 2026-11-28
    lunes = datetime(2026, 11, 30, 10, 30, tzinfo=enc_svc.ART_TZ)
    assert enc_svc.calcular_fecha_objetivo_encuestas(lunes) == date(2026, 11, 28)
    # Martes -> Lunes
    martes = datetime(2026, 12, 1, 10, 30, tzinfo=enc_svc.ART_TZ)
    assert enc_svc.calcular_fecha_objetivo_encuestas(martes) == date(2026, 11, 30)
    # Domingo -> None
    domingo = datetime(2026, 11, 29, 10, 30, tzinfo=enc_svc.ART_TZ)
    assert enc_svc.calcular_fecha_objetivo_encuestas(domingo) is None


# 2. GeclisaClient expone ubicacion_id_raw y celular_raw sin fallback a Mitre 540 y propaga raise_on_error
def test_geclisa_client_campos_crudos_y_raise_on_error():
    g = GeclisaClient()
    g._obtener_token = MagicMock(return_value="jwt-test")
    agenda_resp = MagicMock()
    agenda_resp.status_code = 200
    agenda_resp.raise_for_status = MagicMock()
    agenda_resp.json.return_value = [
        {
            "turnoId": 5001,
            "fecha": "2026-11-26T09:00:00",
            "asistio": True,
            "fichaId": 888,
            "preId": 945,
            "nombrePrestador": "GRAS, HERNAN",
        }
    ]
    det_resp = MagicMock()
    det_resp.status_code = 200
    det_resp.json.return_value = {
        "servId": 10,
        "servNombre": "CONSULTAS",
        "consId": 99,
        "consNombre": "Consultorio Nuevo",
        "ubicId": None,
        "ubicNombre": None,
        "pacTelefono": "4212345",
        "pacCelular": "2615551234",
        "turFechaAtendido": "2026-11-26T09:20:00",
    }

    def fake_request(method, url, **kwargs):
        if "/api/Turnos/prestador/" in url:
            return agenda_resp
        return det_resp

    g._do_request = MagicMock(side_effect=fake_request)
    items = g.obtener_agenda_prestador(945, "2026-11-26", raise_on_error=True)
    assert len(items) == 1
    assert items[0]["ubicacion_id"] == 3  # legado intacto
    assert items[0]["ubicacion_id_raw"] is None
    assert items[0]["ubicacion_raw"] is None
    assert items[0]["consultorio_raw"] == "Consultorio Nuevo"
    assert items[0]["servicio_raw"] == "CONSULTAS"
    assert items[0]["celular_raw"] == "2615551234"
    assert items[0]["fecha_atendido"] == "2026-11-26T09:20:00"

    g._do_request = MagicMock(side_effect=TimeoutError("Geclisa timeout"))
    with pytest.raises(TimeoutError):
        g.obtener_agenda_prestador(945, "2026-11-26", raise_on_error=True)


# 3 & 4 & 5. Normalización regional argentina + Fase 1 dry_run solo lectura + ficha fallback + agrupación multi-turno
def test_normalizador_argentina_movil():
    assert normalizar_telefono_argentina_movil("261 15 4123456") == ("5492614123456", None)
    assert normalizar_telefono_argentina_movil("4212345", celular_preferido="0260 154445566") == ("5492604445566", None)
    assert normalizar_telefono_argentina_movil("4212345 / 263 15 4998877") == ("5492634998877", None)
    tel_fijo, motivo = normalizar_telefono_argentina_movil("4212345")
    assert tel_fijo is None and motivo is not None


def test_fase1_dry_run_y_agrupacion_con_ficha_cache():
    fake_db = FakeSupabase()
    fake_db.tables["encuestas_mapeo_geclisa"] = [
        {"id": 1, "tipo_entidad": "servicio", "geclisa_id": "10", "geclisa_nombre_raw": "CONSULTAS", "unidad_negocio": "consultas", "nombre_canonico": "Consultas", "incluir_en_envio": True},
        {"id": 2, "tipo_entidad": "sede", "geclisa_id": "3", "geclisa_nombre_raw": "Mitre 540", "unidad_negocio": "consultas", "nombre_canonico": "Mitre 540", "incluir_en_envio": True},
        {"id": 3, "tipo_entidad": "prestador", "geclisa_id": "945", "geclisa_nombre_raw": "GRAS, HERNAN", "unidad_negocio": "consultas", "nombre_canonico": "Dr. Hernán Gras", "incluir_en_envio": True},
        {"id": 4, "tipo_entidad": "prestador", "geclisa_id": "1025", "geclisa_nombre_raw": "GRAS, HERNAN (Cirugía)", "unidad_negocio": "consultas", "nombre_canonico": "Dr. Hernán Gras", "incluir_en_envio": True},
        {"id": 5, "tipo_entidad": "prestador", "geclisa_id": "969", "geclisa_nombre_raw": "ASESORAMIENTO", "unidad_negocio": "excluido", "nombre_canonico": "ASESORAMIENTO", "incluir_en_envio": False},
    ]

    agenda_mock = [
        # Mismo teléfono (en ficha porque agenda trae fijo) con dos turnos válidos -> 1 envío agrupado
        {"turno_id": 101, "ficha_id": 50, "asistio": True, "cancelado": False, "servicio_id": 10, "servicio_raw": "CONSULTAS", "ubicacion_id_raw": 3, "ubicacion_raw": "Mitre 540", "consultorio_raw": "Mitre 540", "prestador_id": 945, "prestador_nombre": "GRAS, HERNAN", "telefono": "4212345", "celular_raw": None, "hora": "09:00"},
        {"turno_id": 102, "ficha_id": 51, "asistio": True, "cancelado": False, "servicio_id": 10, "servicio_raw": "CONSULTAS", "ubicacion_id_raw": 3, "ubicacion_raw": "Mitre 540", "consultorio_raw": "Mitre 540", "prestador_id": 1025, "prestador_nombre": "GRAS, HERNAN (Cirugía)", "telefono": "2615550000", "celular_raw": "2615550000", "hora": "10:30"},
        # Prestador excluido
        {"turno_id": 103, "ficha_id": 52, "asistio": True, "cancelado": False, "servicio_id": 10, "servicio_raw": "CONSULTAS", "ubicacion_id_raw": 3, "ubicacion_raw": "Mitre 540", "consultorio_raw": "Mitre 540", "prestador_id": 969, "prestador_nombre": "ASESORAMIENTO", "telefono": "2615551111", "celular_raw": "2615551111", "hora": "11:00"},
        # Sin servId -> descartado antes de agrupar
        {"turno_id": 104, "ficha_id": 50, "asistio": True, "cancelado": False, "servicio_id": None, "servicio_raw": None, "ubicacion_id_raw": 3, "ubicacion_raw": "Mitre 540", "consultorio_raw": "Mitre 540", "prestador_id": 945, "prestador_nombre": "GRAS, HERNAN", "telefono": "2615550000", "celular_raw": "2615550000", "hora": "11:30"},
        # Nueva sede desconocida (ubicacion_id_raw=None, consultorio_raw="Sede Nueva")
        {"turno_id": 105, "ficha_id": 53, "asistio": True, "cancelado": False, "servicio_id": 10, "servicio_raw": "CONSULTAS", "ubicacion_id_raw": None, "ubicacion_raw": None, "consultorio_raw": "Sede Nueva", "prestador_id": 945, "prestador_nombre": "GRAS, HERNAN", "telefono": "2615559999", "celular_raw": "2615559999", "hora": "12:00"},
    ]

    with patch.object(enc_svc, "supabase", fake_db), \
         patch("app.db.supabase", fake_db), \
         patch.object(GeclisaClient, "obtener_agenda_global", return_value=agenda_mock), \
         patch.object(GeclisaClient, "obtener_ficha_completa", return_value={"celular": "2615550000", "telefono_fijo": "4212345"}) as mock_ficha:
        res_dry = asyncio.run(enc_svc.generar_lote_encuestas_para_fecha(date(2026, 11, 26), dry_run=True))
        assert res_dry["validos"] == 2
        assert res_dry["envios_agrupados"] == 1
        assert res_dry["omitidos_sin_servicio"] == 1
        assert len(res_dry["entidades_nuevas_detectadas"]) == 1
        assert res_dry["entidades_nuevas_detectadas"][0]["geclisa_id"] == "SEDE NUEVA"
        # dry_run no escribe en tablas
        assert len(fake_db.tables["encuestas_envios"]) == 0
        assert len(fake_db.tables["encuestas_lotes_diarios"]) == 0
        assert len(fake_db.tables["encuestas_mapeo_geclisa"]) == 5

        res_real = asyncio.run(enc_svc.generar_lote_encuestas_para_fecha(date(2026, 11, 26), dry_run=False))
        assert res_real["envios_creados"] == 1
        assert len(fake_db.tables["encuestas_envios"]) == 1
        assert len(fake_db.tables["encuestas_envios_turnos"]) == 2
        assert fake_db.tables["encuestas_envios_turnos"][0]["ficha_id"] == 50
        assert fake_db.tables["encuestas_envios_turnos"][1]["ficha_id"] == 51
        assert mock_ficha.call_count >= 1


# 6 & 7. Fase 2: reserva dinámica estudios, pausa fail-closed tras 3 fallos, 131049 y components send_template
def test_fase2_fail_closed_y_componentes_y_cuota():
    fake_db = FakeSupabase()
    fake_db.tables["configuracion_sistema"][0]["valor"]["activo"] = True
    fake_db.tables["configuracion_sistema"][0]["valor"]["jitter_min_seg"] = 0.0
    fake_db.tables["configuracion_sistema"][0]["valor"]["jitter_max_seg"] = 0.0
    fake_db.tables["encuestas_envios"] = [
        {"id": "e1", "token": "tok1", "fecha_atencion": "2026-11-26", "telefono_e164": "5492615550001", "estado_cola": "pendiente", "intentos": 0, "expires_at": "2026-12-10T00:00:00+00:00"},
    ]

    mock_client = MagicMock()
    mock_client.get_phone_number_details = AsyncMock(return_value={"quality_rating": "GREEN", "messaging_limit_tier": "TIER_1K"})
    mock_client.send_template = AsyncMock(return_value={"wamid": "wamid.ok.1"})
    mock_client.close = AsyncMock()

    with patch.object(enc_svc, "supabase", fake_db), \
         patch("app.db.supabase", fake_db), \
         patch.object(enc_svc, "get_whatsapp_estudios_credentials", return_value=("est_id", "tok")), \
         patch.object(enc_svc, "WhatsAppCloudClient", return_value=mock_client):
        res = asyncio.run(enc_svc.despachar_cola_encuestas())
        assert res["despachados"] == 1
        call_kwargs = mock_client.send_template.call_args.kwargs
        assert call_kwargs["components"] == [
            {"type": "button", "sub_type": "url", "index": "0", "parameters": [{"type": "text", "text": "tok1"}]},
            {"type": "button", "sub_type": "quick_reply", "index": "1", "parameters": [{"type": "payload", "payload": "encuesta_opt_out"}]},
        ]
        assert fake_db.tables["encuestas_envios"][0]["wa_status"] == "sent"

    # Prueba fail-closed tras 3 fallos de get_phone_number_details()
    fake_db.tables["configuracion_sistema"][0]["valor"]["pausado_por_calidad"] = False
    fake_db.tables["encuestas_envios"].extend([
        {"id": "e2", "token": "tok2", "fecha_atencion": "2026-11-26", "telefono_e164": "5492615550002", "estado_cola": "pendiente", "intentos": 0, "expires_at": "2026-12-10T00:00:00+00:00"},
        {"id": "e3", "token": "tok3", "fecha_atencion": "2026-11-26", "telefono_e164": "5492615550003", "estado_cola": "pendiente", "intentos": 0, "expires_at": "2026-12-10T00:00:00+00:00"},
        {"id": "e4", "token": "tok4", "fecha_atencion": "2026-11-26", "telefono_e164": "5492615550004", "estado_cola": "pendiente", "intentos": 0, "expires_at": "2026-12-10T00:00:00+00:00"},
    ])
    fake_db.tables["configuracion_sistema"][0]["valor"]["batch_size"] = 1
    mock_fail_client = MagicMock()
    mock_fail_client.get_phone_number_details = AsyncMock(return_value={})
    mock_fail_client.send_template = AsyncMock(return_value={"wamid": "wamid.ok.x"})
    mock_fail_client.close = AsyncMock()

    with patch.object(enc_svc, "supabase", fake_db), \
         patch("app.db.supabase", fake_db), \
         patch.object(enc_svc, "get_whatsapp_estudios_credentials", return_value=("est_id", "tok")), \
         patch.object(enc_svc, "WhatsAppCloudClient", return_value=mock_fail_client):
        asyncio.run(enc_svc.despachar_cola_encuestas())
        assert fake_db.tables["configuracion_sistema"][0]["valor"]["pausado_por_calidad"] is True


# 8. Worker Línea 2: botón sin límite de 14 días, texto libre dentro de ventana, monotonicidad wa_status y templates.py
def test_worker_opt_out_y_monotonicidad_y_templates():
    fake_db = FakeSupabase()
    # Envío antiguo (> 14 días) -> botón debe funcionar igual
    fake_db.tables["encuestas_envios"] = [
        {"id": "e10", "token": "t10", "fecha_atencion": "2026-10-01", "telefono_e164": "5492615558888", "estado_cola": "enviado", "wamid": "wamid.10", "wa_status": "read", "created_at": "2026-10-01T10:00:00+00:00", "expires_at": "2026-10-15T00:00:00+00:00"},
    ]

    wa_mock = MagicMock()
    wa_mock.mark_as_read = AsyncMock()
    wa_mock.send_free_text = AsyncMock()
    wa_mock.close = AsyncMock()

    with patch.object(enc_svc, "supabase", fake_db), \
         patch("app.services.whatsapp_cloud.worker.supabase", fake_db), \
         patch("app.services.whatsapp_cloud.client.get_whatsapp_estudios_credentials", return_value=("est_id", "tok")), \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient", return_value=wa_mock):
        msg_btn = {"id": "wamid.in.1", "from": "5492615558888", "type": "button", "button": {"text": "No recibir encuestas", "payload": "encuesta_opt_out"}}
        asyncio.run(handle_estudios_line_inbound_message(msg_btn, "est_id"))
        assert len(fake_db.tables["encuestas_opt_out"]) == 1
        assert fake_db.tables["encuestas_opt_out"][0]["origen"] == "boton_whatsapp"
        # No envió wa.me/ de estudios sino confirmación de baja
        sent_text = wa_mock.send_free_text.call_args.kwargs["text"]
        assert "wa.me/" not in sent_text

        # Status fuera de orden ('delivered' después de 'read') no debe degradar
        asyncio.run(handle_status_update({"id": "wamid.10", "status": "delivered"}, phone_number_id="est_id"))
        assert fake_db.tables["encuestas_envios"][0]["wa_status"] == "read"

        # Status 'failed' con 131049 sí actualiza estado terminal
        asyncio.run(handle_status_update({"id": "wamid.10", "status": "failed", "errors": [{"code": 131049, "message": "Frequency cap"}]}, phone_number_id="est_id"))
        assert fake_db.tables["encuestas_envios"][0]["wa_status"] == "failed"
        assert fake_db.tables["encuestas_envios"][0]["wa_error_code"] == 131049

    # Exclusión encuesta_ en templates.py (sync y create)
    fake_http = MagicMock()
    fake_http.__aenter__ = AsyncMock(return_value=fake_http)
    fake_http.__aexit__ = AsyncMock(return_value=False)
    fake_http.get = AsyncMock(return_value=SimpleNamespace(
        status_code=200,
        text="{}",
        json=lambda: {"data": [{"id": "m1", "name": "encuesta_post_consulta_v1", "status": "APPROVED", "category": "UTILITY", "language": "es_AR", "components": []}]},
    ))
    fake_http.post = AsyncMock(return_value=SimpleNamespace(
        status_code=200,
        text="{}",
        json=lambda: {"id": "m2", "status": "PENDING"},
    ))

    with patch("app.services.whatsapp_cloud.templates.supabase", fake_db), \
         patch("app.services.whatsapp_cloud.templates.get_waba_credentials", return_value=("waba1", "tok1")), \
         patch("app.services.whatsapp_cloud.templates.httpx.AsyncClient", return_value=fake_http):
        asyncio.run(sync_templates_from_meta())
        from app.services.whatsapp_cloud.templates import TemplateCreateRequest
        req = TemplateCreateRequest(name="encuesta_nueva_v2", category="UTILITY", language="es_AR", body_text="Hola")
        asyncio.run(create_template(req))
        assert len(fake_db.tables["whatsapp_templates"]) == 2
        assert all(t["visible_en_chat"] is False and t["visible_en_hce"] is False for t in fake_db.tables["whatsapp_templates"])


# 9. Endpoints públicos (headers, 404/410/503, cero PII) y RBAC require_module_permission (403 anon / sin permiso)
def test_endpoints_publicos_y_rbac():
    fake_db = FakeSupabase()
    fake_db.tables["configuracion_sistema"][0]["valor"]["surveymonkey_url"] = "https://es.surveymonkey.com/r/CLINICA?source=wa"
    fake_db.tables["encuestas_envios"] = [
        {"id": "e1", "token": "tok-valido", "fecha_atencion": "2026-11-26", "telefono_e164": "5492615550000", "estado_cola": "enviado", "expires_at": "2099-01-01T00:00:00+00:00"},
        {"id": "e2", "token": "tok-exp", "fecha_atencion": "2026-11-01", "telefono_e164": "5492615550001", "estado_cola": "enviado", "expires_at": "2020-01-01T00:00:00+00:00"},
    ]
    fake_db.tables["encuestas_envios_turnos"] = [
        {"id": 1, "envio_id": "e1", "turno_id": 777, "ficha_id": 999, "unidad_negocio": "consultas", "servicio_id": 10, "servicio_nombre": "Consultas", "sede_canonica": "Mitre 540", "profesional_canonico": "Dr. Bonanno", "fecha_turno": "2026-11-26", "horario_turno": "09:30", "click_count": 0},
    ]
    fake_db.tables["usuarios_perfil"] = [
        {"id": "user-sin-permiso", "nombre_completo": "Recep", "email": "r@test.com", "activo": True, "rol_id": "rol-recep", "roles": {"codigo": "recepcion", "nombre": "Recepción"}},
        {"id": "user-admin", "nombre_completo": "Admin", "email": "a@test.com", "activo": True, "rol_id": "rol-admin", "roles": {"codigo": "admin", "nombre": "Admin"}},
    ]

    with patch.object(enc_svc, "supabase", fake_db), \
         patch("app.db.supabase", fake_db):
        r_pub = client.get("/api/encuestas-publico/tok-valido")
        assert r_pub.status_code == 200
        assert r_pub.headers["x-robots-tag"] == "noindex, nofollow"
        assert r_pub.headers["referrer-policy"] == "no-referrer"
        assert "no-store" in r_pub.headers["cache-control"]
        body = r_pub.json()
        assert body["estado"] == "valido"
        t_out = body["turnos"][0]
        assert "ficha_id" not in t_out and "nombre" not in t_out and "dni" not in t_out
        assert "turno_id=777" in t_out["surveymonkey_url"]
        assert "source=wa" in t_out["surveymonkey_url"]

        r_click = client.post("/api/encuestas-publico/tok-valido/click", json={"turno_id": 777})
        assert r_click.status_code == 200 and r_click.json()["click_count"] == 1

        r_bad_turno = client.post("/api/encuestas-publico/tok-valido/click", json={"turno_id": 99999})
        assert r_bad_turno.status_code == 404

        r_exp = client.post("/api/encuestas-publico/tok-exp/click", json={"turno_id": 777})
        assert r_exp.status_code == 410

        # Token anon -> 403
        tok_anon = _make_jwt(sub="anon-sub", role="anon")
        r_anon = client.get("/api/encuestas/envios", headers={"Authorization": f"Bearer {tok_anon}"})
        assert r_anon.status_code == 403

        # Usuario sin permiso -> 403
        tok_recep = _make_jwt(sub="user-sin-permiso", role="authenticated")
        r_recep = client.get("/api/encuestas/envios", headers={"Authorization": f"Bearer {tok_recep}"})
        assert r_recep.status_code == 403

        # Admin -> 200
        tok_admin = _make_jwt(sub="user-admin", role="authenticated")
        r_admin = client.get("/api/encuestas/envios", headers={"Authorization": f"Bearer {tok_admin}"})
        assert r_admin.status_code == 200
