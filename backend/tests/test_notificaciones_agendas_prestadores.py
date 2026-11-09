"""
Pruebas Unitarias para el Módulo de Notificaciones Automatizadas de Agendas Quirúrgicas a Prestadores.
Cubre:
1. Lógica de proyección de días hábiles quirúrgicos (Centrovisión).
2. Normalización y validación de números telefónicos de WhatsApp.
3. Formateo en español de fechas y nombres.
4. Agrupación y deduplicación de prestadores con roles múltiples (Cirujano + Derivador).
5. Exclusión de personal auxiliar (anestesistas / instrumentadores).
6. Generación de PDF formal con ReportLab, enmascaramiento de DNI (Ley 25.326) y hash SHA-256.
7. Diagnóstico pre-vuelo de destinatarios para alerta visual.
8. Endpoints de API FastAPI del router dedicado.
"""

import pytest
import hashlib
from datetime import date, datetime
from unittest.mock import patch, MagicMock

from app.services.notificacion_prestadores_service import (
    calcular_fecha_objetivo_habiles,
    normalizar_telefono_whatsapp,
    es_telefono_valido,
    formatear_fecha_espanol,
    NotificacionPrestadoresService
)
from app.services.pdf_service import generar_pdf_agenda_prestadores, enmascarar_dni, formatear_dni


# ==============================================================================
# 1. PRUEBAS DE CÁLCULO DE DÍAS HÁBILES QUIRÚRGICOS
# ==============================================================================

def test_calculo_dias_habiles_lunes_a_miercoles():
    # Lunes 2026-11-09 -> Miércoles 2026-11-11 (+2 días hábiles)
    lunes = date(2026, 11, 9)
    objetivo = calcular_fecha_objetivo_habiles(fecha_base=lunes, dias_habiles=2, incluir_sabados=False)
    assert objetivo == date(2026, 11, 11)


def test_calculo_dias_habiles_miercoles_a_viernes():
    # Miércoles 2026-11-11 -> Viernes 2026-11-13 (+2 días hábiles)
    miercoles = date(2026, 11, 11)
    objetivo = calcular_fecha_objetivo_habiles(fecha_base=miercoles, dias_habiles=2, incluir_sabados=False)
    assert objetivo == date(2026, 11, 13)


def test_calculo_dias_habiles_jueves_proyecta_lunes():
    # Jueves 2026-11-12 -> 2 días hábiles = Viernes (1) + Lunes (2) -> Lunes 2026-11-16
    jueves = date(2026, 11, 12)
    objetivo = calcular_fecha_objetivo_habiles(fecha_base=jueves, dias_habiles=2, incluir_sabados=False)
    assert objetivo == date(2026, 11, 16)


def test_calculo_dias_habiles_viernes_proyecta_lunes_subsiguiente():
    # Viernes 2026-11-13 a las 19 hs: corte proyecta Lunes 2026-11-16 (próxima jornada hábil)
    viernes = date(2026, 11, 13)
    objetivo = calcular_fecha_objetivo_habiles(fecha_base=viernes, dias_habiles=2, incluir_sabados=False)
    assert objetivo == date(2026, 11, 16)


def test_calculo_dias_habiles_con_sabado_quirurgico():
    # Viernes con incluir_sabados=True proyecta Sábado
    viernes = date(2026, 11, 13)
    objetivo = calcular_fecha_objetivo_habiles(fecha_base=viernes, dias_habiles=1, incluir_sabados=True)
    assert objetivo == date(2026, 11, 14)


# ==============================================================================
# 2. PRUEBAS DE NORMALIZACIÓN Y VALIDACIÓN TELEFÓNICA
# ==============================================================================

def test_es_telefono_valido():
    assert es_telefono_valido("2235123456") is True
    assert es_telefono_valido("+54 9 11 5123-4567") is True
    assert es_telefono_valido("123") is False
    assert es_telefono_valido(None) is False
    assert es_telefono_valido("") is False


def test_normalizar_telefono_whatsapp():
    # Número local de Mar del Plata sin prefijo internacional
    assert normalizar_telefono_whatsapp("2235123456") == "5492235123456"
    # Número con 0 inicial y 15 celular
    assert normalizar_telefono_whatsapp("0223155123456") == "5492235123456"
    # Número que ya tiene 549
    assert normalizar_telefono_whatsapp("+54 9 223 512-3456") == "5492235123456"
    # Número con 54 pero sin 9
    assert normalizar_telefono_whatsapp("542235123456") == "5492235123456"


# ==============================================================================
# 3. FORMATEO DE FECHAS EN ESPAÑOL
# ==============================================================================

def test_formatear_fecha_espanol():
    f = date(2026, 11, 10)
    assert formatear_fecha_espanol(f) == "Martes 10 de Noviembre de 2026"


# ==============================================================================
# 4. ENMASCARAMIENTO PHI (LEY 25.326) Y GENERACIÓN DE PDF
# ==============================================================================

def test_enmascarar_dni():
    assert enmascarar_dni("34567890") == "XX.XXX.890"
    assert enmascarar_dni("4567890") == "XX.XXX.890"
    assert enmascarar_dni(None) == "S/D"
    assert enmascarar_dni("") == "S/D"


def test_formatear_dni():
    assert formatear_dni("018081249") == "18.081.249"
    assert formatear_dni("34567890") == "34.567.890"
    assert formatear_dni("4567890") == "4.567.890"
    assert formatear_dni(None) == "S/D"
    assert formatear_dni("") == "S/D"
    assert formatear_dni("-") == "S/D"


def test_generar_pdf_agenda_prestadores_valido():
    prestador_info = {
        "nombre": "Pablo Bonanno",
        "roles": ["Cirujano Principal", "Médico Derivador"],
        "telefono": "5492235123456"
    }
    cirugias = [
        {
            "id": "turno-1",
            "hora_inicio": "2026-11-10T08:00:00-03:00",
            "quirofano": "Quirófano 1",
            "paciente_nombre": "Gómez Carlos",
            "paciente_dni": "32111222",
            "ojo": "OD",
            "practica_nombre": "Facoemulsificación",
            "rol_en_turno": "Cirujano Principal",
            "lente_intraocular": True,
            "lente_modelo": "Alcon SN60WF",
            "lente_dioptria": "21.5",
            "observaciones_medicas": "Pupila pequeña, usar dilatador"
        },
        {
            "id": "turno-2",
            "hora_inicio": "2026-11-10T09:30:00-03:00",
            "quirofano": "Quirófano 2",
            "paciente_nombre": "Fernández María",
            "paciente_dni": "28333444",
            "ojo": "OI",
            "practica_nombre": "Vitrectomía Posterior",
            "rol_en_turno": "Médico Derivador",
            "observaciones_medicas": "Desprendimiento traccional"
        }
    ]

    pdf_bytes, sha256_hash = generar_pdf_agenda_prestadores(
        prestador_info=prestador_info,
        cirugias_list=cirugias,
        fecha_cirugia_str="Martes 10 de Noviembre de 2026"
    )

    # Validar cabecera PDF
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 2000
    # Validar hash SHA-256
    assert sha256_hash == hashlib.sha256(pdf_bytes).hexdigest()
    assert len(sha256_hash) == 64


def test_generar_pdf_agenda_prestadores_lio_pendiente_y_calculado():
    """
    Verifica que se procesen correctamente los campos reales de LIO de turnos_quirofano
    (lleva_lente, lente_tipo, lente_dioptria, es_torico, lente_torico_valor, lio_calculado).
    """
    prestador_info = {
        "nombre": "Carlos Andrés Labat",
        "roles": ["Cirujano Principal"],
        "telefono": "5492614703230"
    }
    cirugias = [
        # Caso 1: LIO cargado pero PENDIENTE de cálculo formal
        {
            "id": "t-cano",
            "hora_inicio": "2026-11-10T08:00:00-03:00",
            "paciente_nombre": "Cano Nancy",
            "paciente_dni": "016122301",
            "cirujano_nombre": "LABAT, CARLOS ANDRES",
            "medico_derivador_nombre": "LABAT, CARLOS ANDRES",
            "ojo": "OD",
            "practica_nombre": "CATARATA CON FACOEMULSIFICACION",
            "lleva_lente": True,
            "lente_tipo": "Clareon Vivity (Alcon)",
            "lente_dioptria": "19.5",
            "es_torico": True,
            "lente_torico_valor": 2,
            "lente_torico_eje": 88,
            "lio_calculado": False,
            "observaciones_quirofano": None
        },
        # Caso 2: LIO cargado y formalmente CALCULADO
        {
            "id": "t-calculado",
            "hora_inicio": "2026-11-10T09:00:00-03:00",
            "paciente_nombre": "Pérez Juan",
            "paciente_dni": "20111222",
            "cirujano_nombre": "LABAT, CARLOS ANDRES",
            "medico_derivador_nombre": "LABAT, CARLOS ANDRES",
            "ojo": "OI",
            "practica_nombre": "CATARATA CON FACOEMULSIFICACION",
            "lleva_lente": True,
            "lente_tipo": "Clareon Monofocal (Alcon)",
            "lente_dioptria": "21.0",
            "es_torico": False,
            "lio_calculado": True,
            "observaciones_quirofano": "Ojo único"
        },
        # Caso 3: Procedimiento sin LIO (Inyección)
        {
            "id": "t-inyeccion",
            "hora_inicio": "2026-11-10T10:00:00-03:00",
            "paciente_nombre": "Correa María Cristina",
            "paciente_dni": "4654553",
            "cirujano_nombre": "LABAT, CARLOS ANDRES",
            "medico_derivador_nombre": "LABAT, CARLOS ANDRES",
            "ojo": "AO",
            "practica_nombre": "COLOCACION INYECCION INTRAVITREA",
            "lleva_lente": False,
            "lio_calculado": False
        }
    ]

    pdf_bytes, sha256_hash = generar_pdf_agenda_prestadores(
        prestador_info=prestador_info,
        cirugias_list=cirugias,
        fecha_cirugia_str="Martes 10 de Noviembre de 2026"
    )

    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 2500
    assert len(sha256_hash) == 64


# ==============================================================================
# 5. DEDUPLICACIÓN DE ROLES Y EXCLUSIÓN DE ANESTESISTAS / INSTRUMENTADORES
# ==============================================================================

def test_clasificar_y_agrupar_destinatarios_deduplicacion_y_exclusion():
    mock_turnos = [
        # Turno 1: Dr. Bonanno como cirujano
        {
            "id": "t1",
            "cirujano_id": "p-bonanno",
            "cirujano_nombre": "Bonanno Pablo",
            "medico_derivador_nombre": "Pérez Juan",
            "anestesista_id": "anest-99",
            "instrumentador_id": "inst-88",
            "quirofano": "Q1",
            "paciente_nombre": "Paciente A"
        },
        # Turno 2: Dr. Bonanno como cirujano de nuevo
        {
            "id": "t2",
            "cirujano_id": "p-bonanno",
            "cirujano_nombre": "Bonanno Pablo",
            "medico_derivador_nombre": "",
            "quirofano": "Q1",
            "paciente_nombre": "Paciente B"
        },
        # Turno 3: Dr. Bonanno como derivador de un paciente operado por otro cirujano
        {
            "id": "t3",
            "cirujano_id": "p-otro",
            "cirujano_nombre": "López Andrea",
            "medico_derivador_nombre": "Bonanno Pablo",
            "quirofano": "Q2",
            "paciente_nombre": "Paciente C"
        }
    ]

    def mock_obtener_prestador(cir_id, cir_nom):
        if cir_id == "p-bonanno" or "Bonanno" in (cir_nom or ""):
            return {
                "id": "p-bonanno",
                "geclisa_pre_id": 101,
                "nombre_apellido": "Pablo Bonanno",
                "telefono": "2235123456",
                "activo": True
            }
        if cir_id == "p-otro" or "López" in (cir_nom or ""):
            return {
                "id": "p-otro",
                "geclisa_pre_id": 102,
                "nombre_apellido": "Andrea López",
                "telefono": None, # Sin teléfono para probar alerta
                "activo": True
            }
        # Pérez Juan: derivador no resoluble
        return None

    with patch("app.services.notificacion_prestadores_service.obtener_prestador_por_cirujano", side_effect=mock_obtener_prestador):
        agrupados = NotificacionPrestadoresService.clasificar_y_agrupar_destinatarios(mock_turnos)

        # 1. El Dr. Bonanno debe existir en una sola clave consolidada
        assert "p-bonanno" in agrupados
        bonanno_data = agrupados["p-bonanno"]
        assert bonanno_data["nombre"] == "Pablo Bonanno"
        assert bonanno_data["estado"] == "LISTO_PARA_ENVIO"
        # Debe contener ambos roles ordenados
        assert bonanno_data["roles"] == ["Cirujano Principal", "Médico Derivador"]
        # Debe contener 3 cirugías en total (2 como cirujano + 1 como derivador)
        assert len(bonanno_data["cirugias"]) == 3

        # 2. Dra. López debe figurar en SIN_TELEFONO
        assert "p-otro" in agrupados
        assert agrupados["p-otro"]["estado"] == "SIN_TELEFONO"

        # 3. Pérez Juan debe figurar en DERIVADOR_NO_RESOLUBLE
        unresolved_keys = [k for k in agrupados if "unresolved" in k]
        assert len(unresolved_keys) == 1
        assert agrupados[unresolved_keys[0]]["estado"] == "DERIVADOR_NO_RESOLUBLE"

        # 4. Anestesista e Instrumentador NO deben aparecer como destinatarios
        assert "anest-99" not in agrupados
        assert "inst-88" not in agrupados


def test_deduplicacion_mismo_medico_cirujano_y_derivador():
    """
    Verifica que si un médico es cirujano y derivador en la misma cirugía,
    se le asigne una ÚNICA fila en su lista de cirugías (no se duplique).
    """
    mock_turnos = [
        {
            "id": "turno-doble-rol",
            "cirujano_id": "p-gras",
            "cirujano_nombre": "GRAS, HERNAN",
            "medico_derivador_nombre": "GRAS, HERNAN",
            "quirofano": "Q1",
            "paciente_nombre": "RODRIGUEZ, MARCELA",
            "paciente_dni": "018081249"
        }
    ]

    mock_prestador = {
        "id": "p-gras",
        "geclisa_pre_id": 55,
        "nombre_apellido": "Hernán Gras",
        "telefono": "2614703230",
        "activo": True
    }

    with patch("app.services.notificacion_prestadores_service.obtener_prestador_por_cirujano", return_value=mock_prestador):
        agrupados = NotificacionPrestadoresService.clasificar_y_agrupar_destinatarios(mock_turnos)

        assert "p-gras" in agrupados
        gras = agrupados["p-gras"]
        # Debe tener ambos roles en la cabecera
        assert "Cirujano Principal" in gras["roles"]
        assert "Médico Derivador" in gras["roles"]
        # Debe tener EXACTAMENTE 1 sola cirugía en la lista (no 2 filas duplicadas)
        assert len(gras["cirugias"]) == 1
        assert gras["cirugias"][0]["id"] == "turno-doble-rol"


# ==============================================================================
# 6. DIAGNÓSTICO PRE-VUELO PARA ALERTA VISUAL
# ==============================================================================

def test_obtener_destinatarios_status():
    mock_turnos = [
        {
            "id": "t1",
            "cirujano_id": "p-1",
            "cirujano_nombre": "Médico Con Teléfono",
            "medico_derivador_nombre": ""
        },
        {
            "id": "t2",
            "cirujano_id": "p-2",
            "cirujano_nombre": "Médico Sin Teléfono",
            "medico_derivador_nombre": ""
        }
    ]

    def mock_obtener_prestador(cir_id, cir_nom):
        if cir_id == "p-1":
            return {"id": "p-1", "nombre_apellido": "Dr. Uno", "telefono": "2235123456", "activo": True}
        return {"id": "p-2", "nombre_apellido": "Dr. Dos", "telefono": None, "activo": True}

    with patch.object(NotificacionPrestadoresService, "obtener_cirugias_por_fecha", return_value=mock_turnos):
        with patch("app.services.notificacion_prestadores_service.obtener_prestador_por_cirujano", side_effect=mock_obtener_prestador):
            status = NotificacionPrestadoresService.obtener_destinatarios_status("2026-11-10")

            assert status["fecha_cirugia"] == "2026-11-10"
            assert status["total_prestadores"] == 2
            assert status["listos_para_envio"] == 1
            assert status["sin_telefono"] == 1
            assert status["derivadores_no_resolubles"] == 0
            # El primero en la lista debe ser el que tiene alerta (Dr. Dos sin teléfono)
            assert status["destinatarios"][0]["nombre"] == "Dr. Dos"
            assert status["destinatarios"][0]["estado"] == "SIN_TELEFONO"


# ==============================================================================
# 7. PRUEBAS DE INTEGRACIÓN DE ENDPOINTS FASTAPI (ROUTER)
# ==============================================================================

def get_auth_headers():
    import os
    import jwt
    secret = os.environ.get("SUPABASE_JWT_SECRET", "super-secret-jwt-key-for-test-2026-audit")
    payload = {
        "sub": "test-user-uuid-123",
        "email": "doctor@test.com",
        "role": "authenticated",
        "aud": "authenticated",
        "exp": 9999999999
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_router_destinatarios_status_endpoint():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    mock_status = {
        "fecha_cirugia": "2026-11-10",
        "total_prestadores": 1,
        "listos_para_envio": 1,
        "sin_telefono": 0,
        "derivadores_no_resolubles": 0,
        "destinatarios": [
            {
                "key": "p-1",
                "prestador_id": "p-1",
                "nombre": "Dr. Bonanno",
                "telefono": "5492235123456",
                "roles": ["Cirujano Principal"],
                "estado": "LISTO_PARA_ENVIO",
                "cantidad_cirugias": 1
            }
        ]
    }

    with patch.object(NotificacionPrestadoresService, "obtener_destinatarios_status", return_value=mock_status):
        response = client.get(
            "/api/turnos-quirofano/notificaciones-prestadores/destinatarios-status?fecha=2026-11-10",
            headers=get_auth_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_prestadores"] == 1
        assert data["listos_para_envio"] == 1


def test_router_despachar_asincrono_endpoint():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    with patch.object(NotificacionPrestadoresService, "despachar_agendas_fecha", return_value={}):
        response = client.post(
            "/api/turnos-quirofano/notificaciones-prestadores/despachar",
            json={"fecha_cirugia": "2026-11-10", "forzar_reenvio": False, "asincrono": True},
            headers=get_auth_headers()
        )
        assert response.status_code == 202
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "PROCESSING"
        assert "job_id" in data


def test_router_configuracion_endpoints():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    mock_cfg = {
        "enabled": True,
        "anticipacion_dias_habiles": 2,
        "hora_corte": "19:00",
        "timezone": "America/Argentina/Buenos_Aires",
        "linea_waba": "estudios",
        "plantilla_nombre": "agenda_quirurgica_prestador",
        "idioma_plantilla": "es_AR",
        "incluir_sabados": False
    }

    with patch("app.routers.notificaciones_prestadores_router.get_configuracion_notificaciones_prestadores", return_value=mock_cfg):
        response = client.get(
            "/api/turnos-quirofano/notificaciones-prestadores/configuracion",
            headers=get_auth_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data["hora_corte"] == "19:00"
        assert "proxima_fecha_proyectada" in data

    with patch("app.routers.notificaciones_prestadores_router.update_configuracion_notificaciones_prestadores", return_value=mock_cfg):
        response = client.put(
            "/api/turnos-quirofano/notificaciones-prestadores/configuracion",
            json={"anticipacion_dias_habiles": 3, "hora_corte": "18:30"},
            headers=get_auth_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

