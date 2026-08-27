import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_listar_prestadores_geclisa_endpoint():
    with patch("app.services.geclisa_client.geclisa_client.buscar_prestadores") as mock_buscar:
        mock_buscar.return_value = [
            {"pre_id": 969, "nombre": "ASESORAMIENTO", "matricula": "99991", "especialidad": "MEDICO"}
        ]
        res = client.get("/api/geclisa/prestadores?query=asesor")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["prestadores"]) == 1
        assert data["prestadores"][0]["pre_id"] == 969

def test_obtener_agenda_geclisa_endpoint_individual():
    with patch("app.services.geclisa_client.geclisa_client.obtener_agenda_prestador") as mock_agenda, \
         patch("app.services.geclisa_client.geclisa_client.obtener_prestador_por_id") as mock_prestador:
        
        mock_agenda.return_value = [
            {
                "turno_id": 1386147,
                "fecha_hora": "2026-08-27T09:00:00",
                "hora": "09:00",
                "paciente": "OROZCO JORGE DIEGO",
                "ficha_id": 389148,
                "dni": None,
                "telefono": None,
                "obra_social": "PARTICULAR",
                "servicio": "CIRUGIA",
                "practica": "Consulta Quirúrgica",
                "consultorio": "Consultorio Mendoza",
                "ubicacion": "Sede Central (Mitre 540)",
                "prestador_id": 969,
                "prestador_nombre": "ASESORAMIENTO",
                "observaciones": "",
                "es_sobreturno": False,
                "estado_key": "reservado",
                "estado_label": "Reservado",
                "confirmado": False,
                "en_espera": False,
                "asistio": False,
                "cancelado": False,
            }
        ]
        mock_prestador.return_value = {
            "encontrado": True,
            "nombre": "ASESORAMIENTO",
            "matricula": "99991"
        }
        
        res = client.get("/api/geclisa/agenda?pre_id=969&fecha=2026-08-27")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["pre_id"] == 969
        assert len(data["turnos"]) == 1
        assert data["turnos"][0]["practica"] == "Consulta Quirúrgica"
        assert data["metricas"]["total"] == 1
        assert data["metricas"]["reservado"] == 1
        assert "CIRUGIA" in data["catalogos"]["servicios"]
        assert "Sede Central (Mitre 540)" in data["catalogos"]["ubicaciones"]

def test_obtener_agenda_geclisa_endpoint_global():
    with patch("app.services.geclisa_client.geclisa_client.obtener_agenda_global") as mock_global:
        mock_global.return_value = [
            {
                "turno_id": 1386147,
                "fecha_hora": "2026-08-27T09:00:00",
                "hora": "09:00",
                "paciente": "OROZCO JORGE DIEGO",
                "ficha_id": 389148,
                "dni": None,
                "telefono": None,
                "obra_social": "PARTICULAR",
                "servicio": "CIRUGIA",
                "practica": "OCT MACULAR",
                "consultorio": "Consultorio Mendoza",
                "ubicacion": "Sede Central (Mitre 540)",
                "prestador_id": 969,
                "prestador_nombre": "ASESORAMIENTO",
                "observaciones": "",
                "es_sobreturno": False,
                "estado_key": "confirmado",
                "estado_label": "Confirmado",
                "confirmado": True,
                "en_espera": False,
                "asistio": False,
                "cancelado": False,
            },
            {
                "turno_id": 1386148,
                "fecha_hora": "2026-08-27T09:15:00",
                "hora": "09:15",
                "paciente": "PEREZ JUAN",
                "ficha_id": 389149,
                "dni": None,
                "telefono": None,
                "obra_social": "OSDE",
                "servicio": "ESTUDIOS",
                "practica": "CAMPIMETRIA",
                "consultorio": "Consultorio Luján",
                "ubicacion": "Sede Luján de Cuyo",
                "prestador_id": 961,
                "prestador_nombre": "BONANNO, PABLO",
                "observaciones": "",
                "es_sobreturno": False,
                "estado_key": "ingresado",
                "estado_label": "Ingresado",
                "confirmado": True,
                "en_espera": True,
                "asistio": False,
                "cancelado": False,
            }
        ]
        
        # Petición sin pre_id => modo global clínica completa
        res = client.get("/api/geclisa/agenda?fecha=2026-08-27")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["pre_id"] == 0
        assert len(data["turnos"]) == 2
        assert data["metricas"]["total"] == 2
        assert data["metricas"]["confirmado"] == 1
        assert data["metricas"]["ingresado"] == 1
        assert len(data["catalogos"]["servicios"]) == 2
        assert len(data["catalogos"]["ubicaciones"]) == 2
        assert len(data["catalogos"]["prestadores"]) == 2

def test_cambiar_estado_turno_geclisa_endpoint():
    with patch("app.services.geclisa_client.geclisa_client.cambiar_estado_turno") as mock_cambio, \
         patch("app.main.log_event") as mock_log:
        
        mock_cambio.return_value = {
            "success": True,
            "estado": "confirmado",
            "mensaje": "Turno confirmado en Geclisa."
        }
        
        payload = {
            "nuevo_estado": "confirmado",
            "canal": 7,
            "motivo_id": 1,
            "usuario_crm": "test@centrovision.com"
        }
        res = client.put("/api/geclisa/agenda/turnos/1386147/estado", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["estado"] == "confirmado"
