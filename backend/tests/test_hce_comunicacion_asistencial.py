import pytest
import asyncio
import uuid
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.historia_oftalmo_service import HistoriaOftalmoService
from app.services.whatsapp_cloud.client import ConversationWindowClosedError

@pytest.mark.asyncio
async def test_despachar_comunicacion_prequirurgica_fallback():
    """
    Verifica que al cerrarse la ventana de 24h, un mensaje prequirúrgico
    invoque la plantilla oficial homologada 'prequirurgico_video_indicaciones_v1'
    con sus 4 componentes sanitizados (paciente_nombre, cirujano_nombre, video_url, observaciones).
    """
    mock_pac = [{"id": "p-123", "nombre": "Juan Pérez", "telefono": "+5491144445555", "dni": "30111222"}]
    mock_u_perfil = [{"nombre_completo": "Dr. Martínez"}]
    test_wamid = f"wamid.preq.{uuid.uuid4().hex[:8]}"

    with patch("app.services.historia_oftalmo_service.supabase") as mock_supa, \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient") as mock_client_cls, \
         patch("app.db.get_or_create_conversacion") as mock_conv, \
         patch("app.db.guardar_mensaje") as mock_guardar, \
         patch.object(HistoriaOftalmoService, "registrar_audit_log") as mock_audit:

        # Config mock Supabase
        mock_supa.table().select().eq().limit().execute.side_effect = [
            MagicMock(data=mock_pac),
            MagicMock(data=mock_u_perfil)
        ]
        mock_conv.return_value = {"id": "conv-999"}
        mock_guardar.return_value = {"id": "msg-001"}

        mock_client = MagicMock()
        mock_client.phone_number_id = "phone-123"
        mock_client.send_free_text = AsyncMock(side_effect=ConversationWindowClosedError(131026, 0, "Message undeliverable outside 24h window", "trace123"))
        mock_client.send_template = AsyncMock(return_value={"wamid": test_wamid})
        mock_client.close = AsyncMock()
        mock_client_cls.return_value = mock_client

        res = await HistoriaOftalmoService.despachar_comunicacion_hce(
            paciente_id="p-123",
            tipo_comunicacion="prequirurgico",
            texto="Pautas preoperatorias generales",
            video_url="https://centrovision.com.ar/video-catarata.mp4",
            cirujano_nombre="Dr. González",
            fecha_cirugia="25/11/2026",
            user_payload={"id": "usr-1", "nombre": "Dr. Martínez"}
        )

        assert res["success"] is True
        assert res["wamid"] == test_wamid
        assert res["modo_envio"] == "fallback_plantilla_prequirurgica_24h"
        assert res["template_usada"] == "prequirurgico_video_indicaciones_v1"

        # Verificar parámetros de plantilla
        mock_client.send_template.assert_called_once()
        call_kwargs = mock_client.send_template.call_args[1]
        assert call_kwargs["template_name"] == "prequirurgico_video_indicaciones_v1"
        components = call_kwargs["components"]
        assert len(components) == 1
        params = components[0]["parameters"]
        assert len(params) == 4
        assert params[0]["text"] == "Juan Pérez"
        assert params[1]["text"] == "Dr. González"
        assert params[2]["text"] == "https://centrovision.com.ar/video-catarata.mp4"
        assert params[3]["text"] == "Pautas preoperatorias generales"

@pytest.mark.asyncio
async def test_despachar_comunicacion_asistencial_no_trunca_400():
    """
    Verifica que el fallback asistencial permita hasta 950 caracteres
    y conserve saltos de línea ordenados en vez de aplastarlos todos a una línea.
    """
    mock_pac = [{"id": "p-123", "nombre": "Ana Gómez", "telefono": "+5491122223333"}]
    texto_largo = "Línea 1: Primer párrafo con indicación.\n\nLínea 2: Segundo párrafo con detalle.\n" + ("x" * 600)

    with patch("app.services.historia_oftalmo_service.supabase") as mock_supa, \
         patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient") as mock_client_cls, \
         patch("app.db.get_or_create_conversacion") as mock_conv, \
         patch("app.db.guardar_mensaje") as mock_guardar, \
         patch.object(HistoriaOftalmoService, "registrar_audit_log"):

        mock_supa.table().select().eq().limit().execute.return_value = MagicMock(data=mock_pac)
        mock_conv.return_value = {"id": "conv-999"}
        mock_guardar.return_value = {"id": "msg-002"}

        mock_client = MagicMock()
        mock_client.phone_number_id = "phone-123"
        mock_client.send_free_text = AsyncMock(side_effect=ConversationWindowClosedError(131026, 0, "Message undeliverable outside 24h window", "trace123"))
        mock_client.send_template = AsyncMock(return_value={"wamid": "wamid.asist.456"})
        mock_client.close = AsyncMock()
        mock_client_cls.return_value = mock_client

        res = await HistoriaOftalmoService.despachar_comunicacion_hce(
            paciente_id="p-123",
            tipo_comunicacion="aviso_asistencial",
            texto=texto_largo,
            medico_nombre="Dra. Fernández"
        )

        assert res["success"] is True
        assert res["modo_envio"] == "fallback_plantilla_24h"
        assert res["template_usada"] == "comunicacion_asistencial_paciente_v1"
        assert res["cirujano_nombre"] == "Dra. Fernández"
        assert res["medico_nombre"] == "Dra. Fernández"

        call_kwargs = mock_client.send_template.call_args[1]
        params = call_kwargs["components"][0]["parameters"]
        texto_enviado = params[1]["text"]
        # Debe contener más de 400 caracteres y conservar saltos de línea \n
        assert len(texto_enviado) > 600
        assert "\n\n" in texto_enviado

def test_get_mensajes_hce_filtro_estricto_y_metadata():
    """
    Verifica que get_mensajes_hce:
    1. Filtre mensajes con emisor 'medico' si no tienen origen HCE ni campos clínicos.
    2. Incluya tipo_comunicacion dentro de metadata_json.
    3. Homologue cirujano_nombre y medico_nombre.
    """
    mock_msgs = [
        # Mensaje comercial ordinario con emisor 'medico' pero sin nada de HCE
        {
            "id": "1",
            "emisor": "medico",
            "contenido": "Hola, ¿cómo estás?",
            "created_at": "2026-11-01T10:00:00Z",
            "metadata_json": {
                "origen": "chat_crm",
                "modulo": "ventas"
            }
        },
        # Mensaje asistencial clínico HCE legítimo
        {
            "id": "2",
            "emisor": "medico",
            "contenido": "Indicaciones postquirúrgicas",
            "created_at": "2026-11-01T10:05:00Z",
            "metadata_json": {
                "origen": "hce",
                "tipo_comunicacion": "prequirurgico",
                "cirujano_nombre": "Dr. Rossi",
                "linea_emision": "estudios_informativa"
            }
        }
    ]

    with patch("app.services.historia_oftalmo_service.supabase") as mock_supa:
        # Mock get conversacion
        mock_supa.table().select().eq().execute.return_value = MagicMock(data=[{"id": "conv-1"}])
        # Mock get mensajes
        mock_supa.table().select().in_().order().limit().execute.return_value = MagicMock(data=mock_msgs)

        res = HistoriaOftalmoService.get_mensajes_hce("paciente-abc")

        # Solo debe haber 1 mensaje HCE (el id 2), el id 1 fue descartado
        assert len(res) == 1
        msg_hce = res[0]
        assert msg_hce["id"] == "2"
        assert msg_hce["tipo_comunicacion"] == "prequirurgico"
        assert msg_hce["metadata_json"]["tipo_comunicacion"] == "prequirurgico"
        assert msg_hce["medico_nombre"] == "Dr. Rossi"
        assert msg_hce["cirujano_nombre"] == "Dr. Rossi"
        assert msg_hce["metadata_json"]["medico_nombre"] == "Dr. Rossi"
        assert msg_hce["metadata_json"]["cirujano_nombre"] == "Dr. Rossi"
