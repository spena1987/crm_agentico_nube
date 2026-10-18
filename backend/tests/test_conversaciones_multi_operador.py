import os
import jwt
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app

def get_auth_headers():
    secret = os.environ.get('SUPABASE_JWT_SECRET', 'super-secret-jwt-key-for-test-2026-audit')
    token = jwt.encode(
        {'sub': 'user-operator-123', 'email': 'lucia@clinica.com', 'role': 'authenticated', 'aud': 'authenticated', 'exp': 9999999999},
        secret,
        algorithm='HS256'
    )
    return {'Authorization': f'Bearer {token}'}

def test_tomar_conversacion_endpoint():
    client = TestClient(app)
    mock_conv = {
        "id": "conv-100",
        "asignado_a_usuario_id": "user-operator-123",
        "estado_gestion": "EN_GESTION",
        "bot_disabled": True,
        "archivada": False
    }
    with patch("app.main.tomar_conversacion", return_value=mock_conv) as mock_tomar:
        resp = client.post(
            "/api/conversaciones/conv-100/tomar",
            headers=get_auth_headers(),
            json={"usuario_id": "user-operator-123", "nombre_operador": "Lucía Ramos"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["conversacion"]["asignado_a_usuario_id"] == "user-operator-123"
        assert data["conversacion"]["estado_gestion"] == "EN_GESTION"
        mock_tomar.assert_called_once_with("conv-100", "user-operator-123", "Lucía Ramos")

def test_derivar_conversacion_endpoint():
    client = TestClient(app)
    mock_conv = {
        "id": "conv-100",
        "asignado_a_usuario_id": "user-colleague-456",
        "estado_gestion": "EN_GESTION",
        "bot_disabled": True
    }
    with patch("app.main.derivar_conversacion", return_value=mock_conv) as mock_derivar:
        resp = client.post(
            "/api/conversaciones/conv-100/derivar",
            headers=get_auth_headers(),
            json={
                "nuevo_usuario_id": "user-colleague-456",
                "nota_traspaso": "Paciente consulta por presupuesto de catarata.",
                "origen_nombre": "Lucía Ramos",
                "destino_nombre": "Dr. Martínez"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["conversacion"]["asignado_a_usuario_id"] == "user-colleague-456"
        mock_derivar.assert_called_once_with(
            conversacion_id="conv-100",
            nuevo_usuario_id="user-colleague-456",
            nota_traspaso="Paciente consulta por presupuesto de catarata.",
            origen_nombre="Lucía Ramos",
            destino_nombre="Dr. Martínez"
        )

def test_finalizar_conversacion_endpoint():
    client = TestClient(app)
    mock_conv = {
        "id": "conv-100",
        "estado_gestion": "RESUELTO",
        "archivada": True,
        "asignado_a_usuario_id": None,
        "bot_disabled": False
    }
    with patch("app.main.finalizar_conversacion", return_value=mock_conv) as mock_fin:
        resp = client.post(
            "/api/conversaciones/conv-100/finalizar",
            headers=get_auth_headers(),
            json={"usuario_nombre": "Lucía Ramos"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["conversacion"]["estado_gestion"] == "RESUELTO"
        assert data["conversacion"]["bot_disabled"] is False
        mock_fin.assert_called_once_with("conv-100", "Lucía Ramos")

def test_metricas_conversaciones_contextuales():
    client = TestClient(app)
    mock_metrics = {
        "mis_chats": 3,
        "mis_no_leidos": 1,
        "sin_asignar": 5,
        "total_activas": 12,
        "no_leidos_count": 4,
        "total_mensajes_no_leidos": 7,
        "derivados_humano": 8,
        "bot_activos": 4,
        "archivados": 20
    }
    with patch("app.main.obtener_metricas_conversaciones", return_value=mock_metrics) as mock_m:
        resp = client.get(
            "/api/conversaciones/metricas?usuario_id=user-operator-123",
            headers=get_auth_headers()
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mis_chats"] == 3
        assert data["mis_no_leidos"] == 1
        assert data["sin_asignar"] == 5
        mock_m.assert_called_once_with(usuario_id="user-operator-123")

def test_operadores_activos_endpoint():
    client = TestClient(app)
    mock_ops = [
        {"id": "u1", "nombre_completo": "Ana Recepción", "email": "ana@clinica.com", "roles": {"nombre": "Recepción"}},
        {"id": "u2", "nombre_completo": "Dr. Martínez", "email": "martinez@clinica.com", "roles": {"nombre": "Médico"}}
    ]
    with patch("app.main.obtener_operadores_activos", return_value=mock_ops) as mock_get_ops:
        resp = client.get("/api/conversaciones/operadores-activos", headers=get_auth_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["nombre_completo"] == "Ana Recepción"
        mock_get_ops.assert_called_once()

def test_send_message_autoasignar_conversacion_sin_asignar():
    client = TestClient(app)
    mock_conv = {
        "id": "conv-999",
        "asignado_a_usuario_id": None,
        "estado_gestion": "SIN_ASIGNAR",
        "metadata_json": {},
        "archivada": False
    }
    with patch("app.main.supabase") as mock_sup, \
         patch("app.main.whatsapp_manager.enviar_mensaje", return_value={"success": True, "message_id": "wamid.123"}) as mock_wa, \
         patch("app.main.tomar_conversacion") as mock_tomar:

        # Mock select de conversaciones
        mock_sup.table().select().eq().execute.return_value.data = [mock_conv]
        mock_sup.table().update().eq().execute.return_value.data = [mock_conv]

        resp = client.post(
            "/api/whatsapp/send-message",
            headers=get_auth_headers(),
            json={
                "telefono": "5492614703230",
                "mensaje": "Hola, te respondo desde secretaría.",
                "conversacion_id": "conv-999",
                "usuario_id": "user-operator-123",
                "usuario_nombre": "Lucía Ramos"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("caso_autoasignado") is True
        mock_tomar.assert_called_once_with("conv-999", "user-operator-123", "Lucía Ramos")


@pytest.mark.asyncio
async def test_inbound_reapertura_conversacion_resuelta():
    """
    Verifica que al recibir un mensaje entrante de un paciente cuya conversación
    está en 'RESUELTO' o 'archivada=True', el worker la reabra automáticamente:
    - archivada = False
    - estado_gestion = 'SIN_ASIGNAR'
    - asignado_a_usuario_id = None
    - bot_disabled = True
    """
    from app.services.whatsapp_cloud.worker import process_meta_webhook_payload

    meta_payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "5492614703230",
                        "id": "wamid.TEST_INBOUND_REOPEN",
                        "timestamp": "1729100000",
                        "type": "text",
                        "text": {"body": "Hola, tengo una nueva consulta."}
                    }],
                    "contacts": [{
                        "wa_id": "5492614703230",
                        "profile": {"name": "Juan Perez"}
                    }]
                }
            }]
        }]
    }

    with patch("app.services.whatsapp_cloud.worker.supabase") as mock_sb, \
         patch("app.db.es_bot_activo_globalmente", return_value=False):
        
        # Simular paciente
        mock_pac = MagicMock()
        mock_pac.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "pac-123", "nombre": "Juan Perez"}]
        )
        
        # Simular conversación resuelta
        mock_conv = MagicMock()
        mock_conv.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{
                "id": "conv-closed-99",
                "bot_disabled": False,
                "metadata_json": {},
                "unread_count": 0,
                "estado_gestion": "RESUELTO",
                "asignado_a_usuario_id": "user-previo",
                "archivada": True
            }]
        )
        mock_conv.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])

        mock_mensajes = MagicMock()
        mock_mensajes.insert.return_value.execute.return_value = MagicMock(data=[{}])

        def table_router(tbl):
            if tbl == "pacientes":
                return mock_pac
            elif tbl == "conversaciones":
                return mock_conv
            elif tbl == "mensajes":
                return mock_mensajes
            return MagicMock()

        mock_sb.table.side_effect = table_router

        await process_meta_webhook_payload(meta_payload)

        # Verificar que se actualizó conversaciones con archivada=False y estado_gestion='SIN_ASIGNAR'
        # Caso A: sin bloqueo manual -> bot se mantiene activo en modo autónomo
        mock_conv.update.assert_called()
        upd_call_arg = mock_conv.update.call_args[0][0]
        assert upd_call_arg["archivada"] is False
        assert upd_call_arg["estado_gestion"] == "SIN_ASIGNAR"
        assert upd_call_arg["asignado_a_usuario_id"] is None
        assert upd_call_arg["bot_disabled"] is False
        assert upd_call_arg["metadata_json"]["modo_atencion"] == "autonomo"

        # Caso B: con bloqueo manual previo -> preserva modo humano y bot_disabled=True
        meta_payload_b = {
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "5492614703230",
                            "id": "wamid.TEST_INBOUND_REOPEN_CASO_B",
                            "timestamp": "1729100010",
                            "type": "text",
                            "text": {"body": "Hola, sigo con dudas."}
                        }],
                        "contacts": [{
                            "wa_id": "5492614703230",
                            "profile": {"name": "Juan Perez"}
                        }]
                    }
                }]
            }]
        }
        mock_conv.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{
                "id": "conv-closed-100",
                "bot_disabled": True,
                "metadata_json": {"bloqueo_humano_manual": True, "modo_atencion": "humano"},
                "unread_count": 0,
                "estado_gestion": "RESUELTO",
                "asignado_a_usuario_id": "user-previo",
                "archivada": True
            }]
        )
        await process_meta_webhook_payload(meta_payload_b)
        upd_call_arg_b = mock_conv.update.call_args[0][0]
        assert upd_call_arg_b["archivada"] is False
        assert upd_call_arg_b["estado_gestion"] == "SIN_ASIGNAR"
        assert upd_call_arg_b["bot_disabled"] is True
        assert upd_call_arg_b["metadata_json"]["modo_atencion"] == "humano"

