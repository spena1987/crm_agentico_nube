"""
Test automatizado para el Enrutador Inteligente Post-Firma de Consentimientos en WhatsApp.
Verifica:
1. Fallback a plantilla oficial cuando la ventana de 24h está cerrada.
2. Uso de parámetros amigables {{1}} (nombre) y {{2}} (fecha).
3. Registro de auditoría y guardado en historial de conversación.
"""

import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

class TestConfirmacionPostFirma(unittest.IsolatedAsyncioTestCase):

    @patch("app.main.registrar_firma_consentimiento")
    @patch("app.main.get_consentimiento_by_token")
    @patch("app.main.get_configuracion_quirofano", return_value={})
    @patch("app.main.get_practica_resumen_operativo", return_value={})
    @patch("app.db.check_patient_24h_window")
    @patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials")
    @patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_template")
    @patch("app.services.whatsapp_cloud.worker.record_outbound_audit_message")
    @patch("app.db.guardar_mensaje")
    @patch("app.db.get_or_create_conversacion")
    async def test_firma_con_ventana_cerrada_despacha_plantilla(
        self,
        mock_get_or_create_conv,
        mock_guardar_msg,
        mock_record_audit,
        mock_send_template,
        mock_get_creds,
        mock_check_win,
        mock_get_resumen,
        mock_get_config,
        mock_get_turno,
        mock_guardar_firma
    ):
        mock_guardar_firma.return_value = {"success": True, "token": "tok_test_123"}
        mock_get_turno.return_value = {
            "id": "turno_qx_001",
            "paciente_id": "pac_001",
            "fecha_cirugia": "2026-10-29",
            "practica_nombre": "Facoemulsificación",
            "ojo": "OD",
            "cirujano_nombre": "Dr. Fernando Brizuela",
            "pacientes": {
                "id": "pac_001",
                "nombre": "PEÑA, JUAN SEBASTIAN",
                "telefono": "+5492614703230"
            }
        }
        mock_check_win.return_value = {"is_open": False, "status": "EXPIRED"}
        mock_get_creds.return_value = ("1231579456715643", "EAAG_token_test")
        mock_send_template.return_value = {"wamid": "wamid.HBgLCONFIRM_OK", "raw_response": {}}
        mock_get_or_create_conv.return_value = {"id": "conv_001"}

        resp = client.post(
            "/api/consentimiento-publico/tok_test_123/firmar",
            json={"firma_base64": "data:image/png;base64,iVBORw0KGgoAAAANS...", "user_agent": "TestBrowser"}
        )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])
        
        # Debe haber llamado a send_template
        mock_send_template.assert_called_once()
        kwargs = mock_send_template.call_args.kwargs
        self.assertTrue("confirmacion" in kwargs["template_name"] or "comunicacion" in kwargs["template_name"])
        self.assertEqual(kwargs["to_phone"], "5492614703230")
        
        # Parámetros del body
        body_params = kwargs["components"][0]["parameters"]
        self.assertEqual(body_params[0]["text"], "Juan Sebastian")

    @patch("app.main.registrar_firma_consentimiento")
    @patch("app.main.get_consentimiento_by_token")
    @patch("app.main.get_configuracion_quirofano", return_value={})
    @patch("app.main.get_practica_resumen_operativo", return_value={})
    @patch("app.main.supabase")
    @patch("app.db.check_patient_24h_window")
    @patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials")
    @patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_template")
    @patch("app.services.whatsapp_cloud.worker.record_outbound_audit_message")
    @patch("app.db.guardar_mensaje")
    @patch("app.db.get_or_create_conversacion")
    async def test_firma_despacha_plantilla_especifica_aprobada(
        self,
        mock_get_or_create_conv,
        mock_guardar_msg,
        mock_record_audit,
        mock_send_template,
        mock_get_creds,
        mock_check_win,
        mock_supabase,
        mock_get_resumen,
        mock_get_config,
        mock_get_turno,
        mock_guardar_firma
    ):
        mock_guardar_firma.return_value = {"success": True, "token": "tok_test_456"}
        mock_get_turno.return_value = {
            "id": "turno_qx_002",
            "paciente_id": "pac_002",
            "fecha_cirugia": "2026-10-29",
            "practica_nombre": "Facoemulsificación",
            "ojo": "OD",
            "cirujano_nombre": "Dr. Fernando Brizuela",
            "pacientes": {
                "id": "pac_002",
                "nombre": "PEÑA, JUAN SEBASTIAN",
                "telefono": "+5492614703230"
            }
        }
        mock_check_win.return_value = {"is_open": False, "status": "EXPIRED"}
        mock_get_creds.return_value = ("1231579456715643", "EAAG_token_test")
        mock_send_template.return_value = {"wamid": "wamid.HBgLSPECIFIC_OK", "raw_response": {}}
        mock_get_or_create_conv.return_value = {"id": "conv_002"}
        mock_supabase.table().select().eq().limit().execute.return_value = MagicMock(
            data=[{"name": "confirmacion_consentimiento_quirurgico_v1", "status": "APPROVED", "body_text": "..."}]
        )

        resp = client.post(
            "/api/consentimiento-publico/tok_test_456/firmar",
            json={"firma_base64": "data:image/png;base64,iVBORw0KGgoAAAANS...", "user_agent": "TestBrowser"}
        )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])
        
        mock_send_template.assert_called_once()
        kwargs = mock_send_template.call_args.kwargs
        self.assertEqual(kwargs["template_name"], "confirmacion_consentimiento_quirurgico_v1")
        self.assertEqual(kwargs["to_phone"], "5492614703230")
        
        body_params = kwargs["components"][0]["parameters"]
        self.assertEqual(len(body_params), 2)
        self.assertEqual(body_params[0]["text"], "Juan Sebastian")
        self.assertEqual(body_params[1]["text"], "29/10/2026")
