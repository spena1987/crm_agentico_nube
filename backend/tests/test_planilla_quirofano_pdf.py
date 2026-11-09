import pytest
from app.services.pdf_service import (
    calcular_hora_citacion_sugerida,
    inferir_secuencia_ojo,
    generar_pdf_planilla_quirofano_diaria,
)

def test_calcular_hora_citacion_sugerida():
    # 09:00 - 50 min -> 08:10
    assert calcular_hora_citacion_sugerida("09:00", 50) == "08:10"
    # 08:30 - 50 min -> 07:40
    assert calcular_hora_citacion_sugerida("08:30", 50) == "07:40"
    # 00:20 - 50 min -> 23:30 (medianoche rollover)
    assert calcular_hora_citacion_sugerida("00:20", 50) == "23:30"
    # ISO string o formato con 'hs'
    assert calcular_hora_citacion_sugerida("09:00 hs", 50) == "08:10"
    # Fallback con vacío
    assert calcular_hora_citacion_sugerida(None) == "--:--"
    assert calcular_hora_citacion_sugerida("") == "--:--"


def test_inferir_secuencia_ojo():
    # 1. Override manual
    t_manual_1 = {"secuencia_ojo": "1"}
    assert inferir_secuencia_ojo(t_manual_1) == "1"

    t_manual_2 = {"secuencia_ojo": "2"}
    assert inferir_secuencia_ojo(t_manual_2) == "2"

    t_manual_u = {"secuencia_ojo": "U"}
    assert inferir_secuencia_ojo(t_manual_u) == "U"

    # 2. Sin historial y sin bilateral -> 'U'
    t_solo = {"id": "t1", "fecha_cirugia": "2026-11-10", "hora_inicio": "08:00"}
    assert inferir_secuencia_ojo(t_solo) == "U"

    # 3. Bilateral con historial ordenado en fechas distintas
    t_ojo1 = {"id": "t1", "fecha_cirugia": "2026-11-10", "hora_inicio": "08:00", "ojo": "OD"}
    t_ojo2 = {"id": "t2", "fecha_cirugia": "2026-11-17", "hora_inicio": "09:00", "ojo": "OI"}
    historial = [t_ojo2, t_ojo1]  # desordenado a propósito

    assert inferir_secuencia_ojo(t_ojo1, historial) == "1"
    assert inferir_secuencia_ojo(t_ojo2, historial) == "2"

    # 4. Bilateral el mismo día en turnos consecutivos
    t_mismo_dia_1 = {"id": "t3", "fecha_cirugia": "2026-11-10", "hora_inicio": "08:00"}
    t_mismo_dia_2 = {"id": "t4", "fecha_cirugia": "2026-11-10", "hora_inicio": "08:45"}
    hist_mismo_dia = [t_mismo_dia_1, t_mismo_dia_2]

    assert inferir_secuencia_ojo(t_mismo_dia_1, hist_mismo_dia) == "1"
    assert inferir_secuencia_ojo(t_mismo_dia_2, hist_mismo_dia) == "2"


def test_generar_pdf_planilla_quirofano_diaria():
    turnos_mock = [
        {
            "id": "t100",
            "fecha_cirugia": "2026-11-10",
            "hora_inicio": "08:00",
            "hora_citacion_paciente": "07:10",
            "secuencia_ojo": "1",
            "ojo": "OD",
            "paciente_nombre": "CAN, NANCY",
            "paciente_dni": "16122301",
            "pacientes": {"historia_clinica": "48291", "nombre": "CAN, NANCY", "dni": "16122301"},
            "lleva_lente": True,
            "lente_tipo": "SN60WF",
            "lente_dioptria": "+21.0",
            "es_torico": True,
            "lente_torico_valor": "3",
            "lente_torico_eje": 88,
            "lente_incision_grados": 180,
            "lio_calculado": False,  # Marcado como pendiente
            "cirujano_nombre": "Dr. Gras Hernán",
            "medico_derivador_nombre": "Dra. Lemos",
            "anestesiologo_nombre": "Dr. Rossi",
            "obra_social": "OSDE",
            "observaciones_quirofano": "NO DILATAR OJO CONTRALATERAL"
        },
        {
            "id": "t101",
            "fecha_cirugia": "2026-11-10",
            "hora_inicio": "08:40",
            "hora_citacion_paciente": None,  # Debe calcular 50 min antes -> 07:50
            "secuencia_ojo": "U",
            "ojo": "OI",
            "paciente_nombre": "PEREZ, JUAN",
            "paciente_dni": "20123456",
            "pacientes": {"historia_clinica": "12984", "nombre": "PEREZ, JUAN", "dni": "20123456"},
            "lleva_lente": False,
            "cirujano_nombre": "Dr. Gras Hernán",
            "medico_derivador_nombre": "Dr. Gras Hernán",
            "tipo_anestesia": "Tópica",
            "obra_social": "PAMI",
        }
    ]

    pdf_bytes, sha = generar_pdf_planilla_quirofano_diaria(
        turnos=turnos_mock,
        fecha_str="10-11-2026",
        sala_filtro="Quirófano 1",
        tipo_filtro="Todos"
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")
    assert isinstance(sha, str)
    assert len(sha) == 64
