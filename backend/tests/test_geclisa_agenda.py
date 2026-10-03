import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from conftest import make_test_token

client = TestClient(app, headers={"Authorization": f"Bearer {make_test_token()}"})

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

def test_obtener_agenda_geclisa_endpoint_default_fallback():
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
            }
        ]
        mock_prestador.return_value = {
            "encontrado": True,
            "nombre": "ASESORAMIENTO",
            "matricula": "99991"
        }
        
        # Petición sin pre_id => resuelve 969 por defecto
        res = client.get("/api/geclisa/agenda?fecha=2026-08-27")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["pre_id"] == 969
        assert len(data["turnos"]) == 1
        assert data["metricas"]["total"] == 1
        assert data["metricas"]["confirmado"] == 1

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

def test_catalogo_servicios_incluye_asesoramiento_y_cirugia():
    with patch("app.services.geclisa_client.geclisa_client.obtener_agenda_prestador") as mock_agenda, \
         patch("app.services.geclisa_client.geclisa_client.obtener_prestador_por_id") as mock_prestador, \
         patch("app.services.geclisa_client.geclisa_client.obtener_servicios") as mock_servicios:
        
        mock_agenda.return_value = []
        mock_prestador.return_value = {"encontrado": True, "nombre": "ASESORAMIENTO", "matricula": "99991"}
        mock_servicios.return_value = ["ASESORAMIENTO", "CIRUGIA", "CONSULTAS"]

        res = client.get("/api/geclisa/agenda?pre_id=969&fecha=2026-10-05")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        servicios = data["catalogos"]["servicios"]
        assert "ASESORAMIENTO" in servicios
        assert "CIRUGIA" in servicios

def test_enriquecimiento_estados_y_practica():
    from app.services.geclisa_client import geclisa_client
    
    mock_items = [
        {
            "turnoId": 1403512,
            "fecha": "2026-10-05T09:00:00",
            "confirmado": False,
            "asistio": False,
            "enEspera": False,
            "cancelado": False,
            "servicioNombre": "CIRUGIA",
            "fichaId": 214261,
            "paciente": "CORRALES AZCUETA FRANCISCO"
        },
        {
            "turnoId": 1403513,
            "fecha": "2026-10-05T09:30:00",
            "confirmado": False,
            "asistio": False,
            "enEspera": False,
            "cancelado": False,
            "servicioNombre": "CIRUGIA",
            "fichaId": 390104,
            "paciente": "DIAZ DELFIN JOSE"
        }
    ]

    mock_detalles = {
        1403512: {
            "turFechaAtendido": "2026-10-05T09:25:00",
            "turHoraAtendido": "09:25",
            "turFechaEspera": "2026-10-05T09:02:00",
            "nomNombre": "COLOCACION LENTE FAQUICA UNILATERAL (ICL)"
        },
        1403513: {
            "turFechaAtendido": None,
            "turHoraAtendido": "",
            "turFechaEspera": "2026-10-05T09:15:00",
            "turHoraEspera": "09:15",
            "nomNombre": "CATARATA CON FACOEMULSIFICACION"
        }
    }

    with patch.object(geclisa_client, "_obtener_token", return_value="fake_token"), \
         patch.object(geclisa_client, "_do_request") as mock_req, \
         patch.object(geclisa_client, "obtener_turno_por_id", side_effect=lambda tid: mock_detalles.get(tid, {})):
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_items
        mock_req.return_value = mock_resp

        turnos = geclisa_client.obtener_agenda_prestador(969, "2026-10-05")
        assert len(turnos) == 2
        
        # Turno 1 atendido
        assert turnos[0]["estado_key"] == "atendido"
        assert turnos[0]["asistio"] is True
        assert turnos[0]["practica"] == "COLOCACION LENTE FAQUICA UNILATERAL (ICL)"

        # Turno 2 ingresado (en espera)
        assert turnos[1]["estado_key"] == "ingresado"
        assert turnos[1]["en_espera"] is True
        assert turnos[1]["practica"] == "CATARATA CON FACOEMULSIFICACION"
