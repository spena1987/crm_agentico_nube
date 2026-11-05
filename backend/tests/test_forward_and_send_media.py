import os
import jwt
import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_auth_headers():
    secret = os.environ.get('SUPABASE_JWT_SECRET', 'super-secret-jwt-key-for-test-2026-audit')
    token = jwt.encode(
        {'sub': 'user-operator-123', 'email': 'griselda@clinica.com', 'role': 'authenticated', 'aud': 'authenticated', 'exp': 9999999999},
        secret,
        algorithm='HS256'
    )
    return {'Authorization': f'Bearer {token}'}

def test_forward_message_with_media_saves_in_mensajes():
    mock_orig_msg = {
        "id": "msg-orig-123",
        "contenido": "📷 [Foto]",
        "metadata_json": {
            "tipo": "imagen",
            "media_url": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/wa_123.jpg",
            "file_name": "foto_estudio.jpg",
            "caption": "Estudio retinografía"
        }
    }

    mock_conv = {
        "id": "conv-dest-456",
        "paciente_id": "pac-789",
        "pacientes": {
            "id": "pac-789",
            "nombre": "MATEO NAHITAN OLMOS",
            "telefono": "5492615021243"
        }
    }

    with patch("app.main.supabase") as mock_supabase, \
         patch("app.main.check_patient_24h_window") as mock_win, \
         patch("app.main.whatsapp_manager.enviar_multimedia") as mock_send_media, \
         patch("app.main.guardar_mensaje") as mock_guardar:

        mock_win.return_value = {"is_open": True}
        mock_send_media.return_value = {
            "success": True,
            "enviado_real": True,
            "wamid": "wamid.123456789",
            "provider": "meta_cloud_api"
        }
        mock_guardar.return_value = {
            "id": "msg-new-999",
            "conversacion_id": "conv-dest-456",
            "emisor": "operador",
            "contenido": "Estudio retinografía"
        }

        # Simular respuestas de Supabase
        def mock_table(table_name):
            builder = MagicMock()
            if table_name == "mensajes":
                select_mock = MagicMock()
                select_mock.eq.return_value.execute.return_value = MagicMock(data=[mock_orig_msg])
                builder.select.return_value = select_mock
            elif table_name == "conversaciones":
                select_mock = MagicMock()
                select_mock.eq.return_value.execute.return_value = MagicMock(data=[mock_conv])
                builder.select.return_value = select_mock
                builder.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif table_name == "patient_conversations":
                select_mock = MagicMock()
                select_mock.eq.return_value.execute.return_value = MagicMock(data=[])
                builder.select.return_value = select_mock
            return builder

        mock_supabase.table.side_effect = mock_table

        payload = {
            "mensaje_id": "msg-orig-123",
            "conversaciones_destino_ids": ["conv-dest-456"],
            "como_nota_interna_si_cerrada": False,
            "usuario_id": "user-001",
            "usuario_nombre": "Griselda Concina"
        }

        response = client.post("/api/whatsapp/forward-message", json=payload, headers=get_auth_headers())
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["enviados"] == 1

        # Verificar que enviar_multimedia fue invocado
        mock_send_media.assert_called_once()

        # Verificar que guardar_mensaje FUE INVOCADO con los metadatos multimedia
        mock_guardar.assert_called_once()
        k_call = mock_guardar.call_args[1]
        assert k_call["conversacion_id"] == "conv-dest-456"
        assert k_call["emisor"] == "operador"
        assert k_call["whatsapp_message_id"] == "wamid.123456789"
        assert k_call["metadata_json"]["tipo"] == "imagen"
        assert k_call["metadata_json"]["media_url"] == "https://supabase.co/storage/v1/object/public/whatsapp-media/images/wa_123.jpg"
        assert k_call["metadata_json"]["es_reenviado"] is True
        assert k_call["metadata_json"]["operador_nombre"] == "Griselda Concina"


def test_send_media_sanitizes_filename_and_strips_trailing_question_mark():
    with patch("app.main.media_service.save_media_bytes") as mock_save, \
         patch("app.main.whatsapp_manager.enviar_multimedia_async") as mock_send_async, \
         patch("app.main.guardar_mensaje") as mock_guardar, \
         patch("app.main.supabase") as mock_supabase:

        mock_save.return_value = {
            "file_path": "/tmp/test.pdf",
            "file_name": "consentim_botox.pdf",
            "relative_url": "/static/media/documents/crm_out_123.pdf",
            "storage_url": "https://ppbgmkxxpeuiutvuynaw.supabase.co/storage/v1/object/public/whatsapp-media/documents/crm_out_123.pdf?",
            "media_url": "https://ppbgmkxxpeuiutvuynaw.supabase.co/storage/v1/object/public/whatsapp-media/documents/crm_out_123.pdf?"
        }

        mock_send_async.return_value = {
            "success": True,
            "enviado_real": True,
            "wamid": "wamid.send.999",
            "provider": "meta_cloud_api"
        }
        mock_guardar.return_value = {"id": "msg-sent-1"}

        # Simular conversacion check
        builder = MagicMock()
        builder.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"asignado_a_usuario_id": "user-001", "estado_gestion": "EN_GESTION"}])
        mock_supabase.table.return_value = builder

        file_content = b"%PDF-1.4 test document"
        files = {
            "file": ("consentim. botox con espacios.pdf", io.BytesIO(file_content), "application/pdf")
        }
        data = {
            "telefono": "5492615021243",
            "conversacion_id": "conv-789",
            "caption": "Adjunto consentimiento médico",
            "usuario_id": "user-001",
            "usuario_nombre": "Romina Perez"
        }

        response = client.post("/api/whatsapp/send-media", data=data, files=files, headers=get_auth_headers())
        assert response.status_code == 200
        res_json = response.json()
        assert res_json["success"] is True

        # Verificar que la URL no tiene '?' residual al final
        mock_send_async.assert_called_once()
        call_kw = mock_send_async.call_args[1]
        assert not call_kw["media_url"].endswith("?")
        assert "consentim_botox_con_espacios.pdf" in call_kw["filename"]

        # Verificar guardar_mensaje
        mock_guardar.assert_called_once()
        g_call = mock_guardar.call_args[1]
        assert not g_call["metadata_json"]["media_url"].endswith("?")
        assert g_call["metadata_json"]["file_name"] == "consentim. botox con espacios.pdf"
        assert g_call["metadata_json"]["safe_file_name"] == "consentim_botox_con_espacios.pdf"
