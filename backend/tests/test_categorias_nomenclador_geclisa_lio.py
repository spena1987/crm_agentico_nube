import os
import copy
import pytest
import jwt
from fastapi.testclient import TestClient

os.environ["SUPABASE_JWT_SECRET"] = os.environ.get("SUPABASE_JWT_SECRET") or "super-secret-jwt-key-for-test-2026-audit"

from app.main import app, requiere_calculo_lio
import app.db as db_mod
import app.main as main_mod
from app.services.gs1_lio_validator import validar_lente_blister_contra_turno

client = TestClient(app)


def _auth_headers(email: str = "admin@test.com"):
    token = jwt.encode(
        {
            "sub": "user-uuid-admin",
            "email": email,
            "role": "authenticated",
            "aud": "authenticated",
            "exp": 9999999999,
        },
        os.environ["SUPABASE_JWT_SECRET"],
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


class _FakeResp:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, store, table_name):
        self.store = store
        self.table_name = table_name
        self._op = "select"
        self._payload = None
        self._filters = []
        self._or_expr = None
        self._order = []
        self._limit = None
        self._on_conflict = None

    def select(self, *_args, **_kwargs):
        self._op = "select"
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, on_conflict=None):
        self._op = "upsert"
        self._payload = payload
        self._on_conflict = on_conflict
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters.append(("eq", col, val))
        return self

    def neq(self, col, val):
        self._filters.append(("neq", col, val))
        return self

    def ilike(self, col, pattern):
        self._filters.append(("ilike", col, pattern))
        return self

    def in_(self, col, vals):
        self._filters.append(("in", col, list(vals)))
        return self

    def contains(self, col, vals):
        self._filters.append(("contains", col, list(vals)))
        return self

    def or_(self, expr):
        self._or_expr = expr
        return self

    def order(self, col, desc=False):
        self._order.append((col, desc))
        return self

    def limit(self, n):
        self._limit = n
        return self

    def _matches(self, row):
        for kind, col, val in self._filters:
            rv = row.get(col)
            if kind == "eq" and rv != val:
                return False
            if kind == "neq" and rv == val:
                return False
            if kind == "in" and rv not in val:
                return False
            if kind == "contains":
                if not isinstance(rv, list) or not all(v in rv for v in val):
                    return False
            if kind == "ilike":
                pat = str(val).replace("%", "").lower()
                if pat not in str(rv or "").lower():
                    return False
        if self._or_expr:
            parts = [p.strip() for p in self._or_expr.split(",")]
            ok = False
            for p in parts:
                if ".is.null" in p:
                    c = p.split(".is.null")[0]
                    if row.get(c) is None:
                        ok = True
                elif ".eq." in p:
                    c, v = p.split(".eq.", 1)
                    if str(row.get(c)).lower() == v.lower():
                        ok = True
                elif ".ilike." in p:
                    c, v = p.split(".ilike.", 1)
                    pat = v.replace("%", "").lower()
                    if pat in str(row.get(c) or "").lower():
                        ok = True
            if not ok:
                return False
        return True

    def execute(self):
        rows = self.store.setdefault(self.table_name, [])
        if self._op == "select":
            matched = [copy.deepcopy(r) for r in rows if self._matches(r)]
            for col, desc in reversed(self._order):
                matched.sort(key=lambda r: (r.get(col) is None, r.get(col) or ""), reverse=bool(desc))
            if self._limit is not None:
                matched = matched[: self._limit]
            if self.table_name == "modelos_lio":
                items = self.store.get("modelos_lio_items", [])
                for m in matched:
                    cnt = sum(1 for it in items if it.get("modelo_lio_id") == m.get("id"))
                    m["modelos_lio_items"] = [{"count": cnt}]
            return _FakeResp(matched)

        if self._op == "insert":
            items = self._payload if isinstance(self._payload, list) else [self._payload]
            inserted = []
            for item in items:
                row = copy.deepcopy(item)
                row.setdefault("id", f"{self.table_name}-{len(rows) + 1}")
                rows.append(row)
                inserted.append(copy.deepcopy(row))
            return _FakeResp(inserted)

        if self._op == "upsert":
            items = self._payload if isinstance(self._payload, list) else [self._payload]
            conflict_cols = [c.strip() for c in (self._on_conflict or "").split(",") if c.strip()]
            out = []
            for item in items:
                existing = None
                if conflict_cols:
                    for r in rows:
                        if all(r.get(c) == item.get(c) for c in conflict_cols):
                            existing = r
                            break
                if existing is not None:
                    existing.update(copy.deepcopy(item))
                    out.append(copy.deepcopy(existing))
                else:
                    row = copy.deepcopy(item)
                    row.setdefault("id", f"{self.table_name}-{len(rows) + 1}")
                    rows.append(row)
                    out.append(copy.deepcopy(row))
            return _FakeResp(out)

        if self._op == "update":
            updated = []
            for r in rows:
                if self._matches(r):
                    r.update(copy.deepcopy(self._payload))
                    updated.append(copy.deepcopy(r))
            return _FakeResp(updated)

        if self._op == "delete":
            kept = []
            deleted = []
            for r in rows:
                if self._matches(r):
                    deleted.append(copy.deepcopy(r))
                else:
                    kept.append(r)
            self.store[self.table_name] = kept
            return _FakeResp(deleted)

        return _FakeResp([])


class _FakeSupabase:
    def __init__(self, initial_store):
        self.store = initial_store

    def table(self, name):
        return _FakeQuery(self.store, name)


@pytest.fixture
def fake_db(monkeypatch):
    store = {
        "nomencladores": [
            {"id": "nom-ars", "codigo": "NOM_ARS", "nombre": "ARS", "moneda": "ARS", "activo": True},
            {"id": "nom-usd", "codigo": "NOM_USD", "nombre": "USD", "moneda": "USD", "activo": True},
        ],
        "nomenclador_categorias": [
            {
                "id": "cat-cirugia",
                "slug": "cirugia",
                "nombre": "Cirugía",
                "es_lio_comercial": False,
                "permite_requiere_lente": True,
                "es_insumo": False,
                "orden": 10,
                "activo": True,
                "created_at": "2026-01-01T00:00:00Z",
            },
            {
                "id": "cat-lio",
                "slug": "lentes-intraoculares",
                "nombre": "Lentes Intraoculares",
                "es_lio_comercial": True,
                "permite_requiere_lente": False,
                "es_insumo": False,
                "orden": 20,
                "activo": True,
                "created_at": "2026-01-01T00:00:00Z",
            },
            {
                "id": "cat-estudios",
                "slug": "estudios",
                "nombre": "Estudios",
                "es_lio_comercial": False,
                "permite_requiere_lente": False,
                "es_insumo": False,
                "orden": 30,
                "activo": True,
                "created_at": "2026-01-01T00:00:00Z",
            },
            {
                "id": "cat-insumos",
                "slug": "insumos",
                "nombre": "Insumos",
                "es_lio_comercial": False,
                "permite_requiere_lente": False,
                "es_insumo": True,
                "orden": 40,
                "activo": True,
                "created_at": "2026-01-01T00:00:00Z",
            },
        ],
        "modelos_lio": [
            {
                "id": "fam-clareon",
                "marca": "Alcon",
                "modelo": "Clareon Monofocal",
                "tipo_optica": "Monofocal",
                "constante_a": 119.1,
                "admite_toricos": True,
                "naturaleza_clinica": "pseudofaquico",
                "requiere_biometria": True,
                "activo": True,
            },
            {
                "id": "fam-icl",
                "marca": "STAAR",
                "modelo": "EVO Visian ICL",
                "tipo_optica": "Fáquico",
                "constante_a": 0.0,
                "admite_toricos": True,
                "naturaleza_clinica": "faquico_icl",
                "requiere_biometria": False,
                "activo": True,
            },
        ],
        "modelos_lio_items": [
            {
                "id": "sku-clareon-21",
                "modelo_lio_id": "fam-clareon",
                "geclisa_ele_id": 5001,
                "geclisa_ele_cod": "GTIN-CLAREON-21",
                "geclisa_nombre": "Clareon +21.00D",
                "dioptria": 21.0,
                "es_torico": False,
                "torico_valor": None,
            }
        ],
        "modelos_lio_elementos_geclisa": [
            {
                "id": "elem-icl-esf",
                "modelo_lio_id": "fam-icl",
                "ambito": "esferico",
                "geclisa_ele_id": 9101,
                "geclisa_ele_cod": "ICL_ESF_GEN",
                "geclisa_nombre": "LENTE ICL ESFERICO",
                "es_generico": True,
                "activo": True,
            }
        ],
        "catalogo_maestro_gtin": [],
        "nomenclador_practicas": [
            {
                "id": "prac-34031",
                "nomenclador_id": "nom-ars",
                "codigo": "34031",
                "nombre": "Facoemulsificación con implante de LIO",
                "categoria": "Cirugía",
                "categoria_id": "cat-cirugia",
                "requiere_lente": True,
                "lios_habilitados": ["CLAREON"],
                "familias_lio_ids": [],
                "activo": True,
            },
            {
                "id": "prac-lente-contacto",
                "nomenclador_id": "nom-ars",
                "codigo": "99001",
                "nombre": "Lente de contacto terapéutico",
                "categoria": "Insumos",
                "categoria_id": "cat-insumos",
                "requiere_lente": False,
                "lios_habilitados": [],
                "familias_lio_ids": [],
                "activo": True,
            },
            {
                "id": "prac-clareon",
                "nomenclador_id": "nom-usd",
                "codigo": "CLAREON",
                "nombre": "LIO Clareon Monofocal",
                "categoria": "Lentes Intraoculares",
                "categoria_id": "cat-lio",
                "requiere_lente": False,
                "lios_habilitados": [],
                "familias_lio_ids": ["fam-clareon"],
                "condicion_toricidad": "esferico",
                "activo": True,
            },
            {
                "id": "prac-icl",
                "nomenclador_id": "nom-usd",
                "codigo": "ICL",
                "nombre": "Lente Fáquico ICL",
                "categoria": "Lentes Intraoculares",
                "categoria_id": "cat-lio",
                "requiere_lente": False,
                "lios_habilitados": [],
                "familias_lio_ids": ["fam-icl"],
                "condicion_toricidad": "esferico",
                "activo": True,
            },
        ],
        "nomenclador_aranceles": [
            {"id": "ar-1", "practica_id": "prac-clareon", "precio": 520.0, "moneda": "USD", "vigencia_desde": "2026-01-01", "activo": True},
            {"id": "ar-2", "practica_id": "prac-icl", "precio": 1800.0, "moneda": "USD", "vigencia_desde": "2026-01-01", "activo": True},
            {"id": "ar-3", "practica_id": "prac-lente-contacto", "precio": 50.0, "moneda": "USD", "vigencia_desde": "2026-01-01", "activo": True},
        ],
        "asesorias_quirurgicas": [],
        "turnos_quirofano": [],
    }
    fake = _FakeSupabase(store)
    monkeypatch.setattr(db_mod, "supabase", fake)
    monkeypatch.setattr(main_mod, "supabase", fake)
    return store


def test_categorias_crud_y_exclusividad_mutua(fake_db):
    headers = _auth_headers()
    r_list = client.get("/api/nomenclador/categorias", headers=headers)
    assert r_list.status_code == 200
    assert len(r_list.json()["categorias"]) == 4

    # Exclusividad mutua: es_lio_comercial + permite_requiere_lente -> 400
    r_bad = client.post(
        "/api/nomenclador/categorias",
        json={"nombre": "Mixta", "es_lio_comercial": True, "permite_requiere_lente": True},
        headers=headers,
    )
    assert r_bad.status_code == 400

    # Slug duplicado -> 409
    r_dup = client.post(
        "/api/nomenclador/categorias",
        json={"nombre": "Cirugia", "permite_requiere_lente": True},
        headers=headers,
    )
    assert r_dup.status_code == 409

    # Desactivar categoría en uso -> 409
    r_in_use = client.patch(
        "/api/nomenclador/categorias/cat-cirugia/estado",
        json={"activo": False},
        headers=headers,
    )
    assert r_in_use.status_code == 409


def test_validacion_simetrica_practicas_y_lios_habilitados(fake_db):
    headers = _auth_headers()
    # Un LIO comercial no puede tener lios_habilitados -> 400
    r_bad_lio = client.post(
        "/api/nomenclador/practicas/prac-clareon/lios-habilitados",
        json={"lios_habilitados": ["ICL"]},
        headers=headers,
    )
    assert r_bad_lio.status_code == 400

    # Categoría Estudios (permite_requiere_lente=False) rechaza requiere_lente=True -> 400
    r_est = client.post(
        "/api/nomenclador/guardar-practica-integral",
        json={
            "codigo": "OCT01",
            "nombre": "OCT Macular",
            "categoria_id": "cat-estudios",
            "requiere_lente": True,
        },
        headers=headers,
    )
    assert r_est.status_code == 400

    # Eliminar LIO comercial CLAREON en uso por prac-34031 -> 409
    r_del = client.delete("/api/nomenclador/practicas-configuradas/prac-clareon", headers=headers)
    assert r_del.status_code == 409


def test_obtener_lios_comerciales_fail_closed_y_sin_heuristica(fake_db):
    # Sin practica_id ni solo_habilitados -> excluye "Lente de contacto terapéutico" (cat-insumos)
    todos = db_mod.obtener_lios_comerciales()
    cods = [x["codigo"] for x in todos]
    assert "CLAREON" in cods
    assert "ICL" in cods
    assert "99001" not in cods

    # Fail-closed: solo_habilitados=True sin practica_id o con practica inexistente -> []
    assert db_mod.obtener_lios_comerciales(solo_habilitados=True) == []
    assert db_mod.obtener_lios_comerciales(practica_id="no-existe", solo_habilitados=True) == []

    # Con practica_id=34031 (código) -> solo CLAREON
    hab = db_mod.obtener_lios_comerciales(practica_id="34031", solo_habilitados=True)
    assert [x["codigo"] for x in hab] == ["CLAREON"]


def test_asesoria_rechaza_lio_no_habilitado_y_exime_presupuesto(fake_db):
    headers = _auth_headers()
    payload_bad = {
        "paciente_id": "pac-1",
        "practica_codigo": "34031",
        "practica_nombre": "Facoemulsificación con implante de LIO",
        "medico_derivador_nombre": "Dr. Deriv",
        "medico_cirujano_nombre": "Dr. Qx",
        "checklist_prequirurgico": {
            "_lio_seleccion": {"lente_comercial_codigo": "ICL"}
        },
    }
    r_bad = client.post("/api/asesorias-quirurgicas", json=payload_bad, headers=headers)
    assert r_bad.status_code == 400

    # Presupuesto exento
    payload_pres = dict(payload_bad, presupuesto_id="pres-123")
    r_ok = client.post("/api/asesorias-quirurgicas", json=payload_pres, headers=headers)
    assert r_ok.status_code == 200


def test_modelos_lio_conflict_y_resolver_sku_dos_niveles(fake_db):
    headers = _auth_headers()
    # Eliminar o desactivar fam-clareon referenciada por CLAREON -> 409
    r_del = client.delete("/api/modelos-lio/fam-clareon", headers=headers)
    assert r_del.status_code == 409
    r_deact = client.put("/api/modelos-lio/fam-clareon", json={"activo": False}, headers=headers)
    assert r_deact.status_code == 409

    # Nivel 1: SKU exacto biométrico
    res_bio = db_mod.resolver_sku_lio(modelo_lio_id="fam-clareon", dioptria=21.0, es_torico=False)
    assert res_bio["resolucion_tipo"] == "sku_exacto"
    assert res_bio["geclisa_ele_id"] == 5001

    # Nivel 2A: Familia sin biometría (ICL) -> elemento_generico
    res_icl = db_mod.resolver_sku_lio(modelo_lio_id="fam-icl", es_torico=False)
    assert res_icl["resolucion_tipo"] == "elemento_generico"
    assert res_icl["geclisa_ele_id"] == 9101

    # Nivel 2B: Biométrico sin dioptría -> biometria_pendiente
    res_pend = db_mod.resolver_sku_lio(modelo_lio_id="fam-clareon", dioptria=None)
    assert res_pend["resolucion_tipo"] == "biometria_pendiente"

    # Guardar cálculo LIO sin dioptría permitido para fam-icl, rechazado para fam-clareon
    r_calc_bad = client.post(
        "/api/calculo-lio/guardar",
        json={
            "paciente_id": "pac-1",
            "opciones": [{"modelo": "Clareon Monofocal", "modelo_lio_id": "fam-clareon"}],
        },
        headers=headers,
    )
    assert r_calc_bad.status_code == 422

    r_calc_icl = client.post(
        "/api/calculo-lio/guardar",
        json={
            "paciente_id": "pac-1",
            "opciones": [{"modelo": "EVO Visian ICL", "modelo_lio_id": "fam-icl"}],
        },
        headers=headers,
    )
    assert r_calc_icl.status_code == 200


def test_gs1_conciliacion_elemento_generico_y_requiere_calculo_lio(fake_db, monkeypatch):
    monkeypatch.setattr(
        "app.services.gs1_lio_validator.buscar_info_lio_por_gtin",
        lambda _gtin: {
            "marca": "STAAR",
            "modelo": "EVO Visian ICL",
            "nombre_producto": "EVO Visian ICL -12.00D",
            "dioptria": -12.0,
            "es_torico": False,
            "torico_valor": None,
            "origen": "test",
        },
    )
    res = validar_lente_blister_contra_turno(
        {
            "lente_tipo": "EVO Visian ICL",
            "lente_dioptria": None,
            "es_torico": False,
            "requiere_biometria": False,
            "naturaleza_clinica": "faquico_icl",
        },
        {"gtin_14": "00000000000001", "esta_vencido": False},
    )
    assert res["estado_validacion"] == "CONCILIACION_ELEMENTO_GENERICO"
    assert res["requiere_confirmacion_manual"] is True
    assert res["coincide"] is False

    # requiere_calculo_lio estructurado sin heurística de palabras clave
    assert requiere_calculo_lio("Lente de contacto terapéutico", practica_codigo="99001") is False
    assert requiere_calculo_lio("Cualquier texto", practica_codigo="34031") is True
