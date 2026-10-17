"""
Test automatizado para el Enrutador Inteligente (Smart Template Router) de Consentimientos Informados en WhatsApp.
Verifica:
1. Despacho automático de plantilla oficial Meta 'consentimiento_informado_quirurgico_v1' cuando la ventana de 24h está cerrada.
2. Sanitización estricta de los 5 parámetros obligatorios de Meta.
3. Fallback transparente de texto libre a plantilla oficial ante rechazo 131047 / 131026.
4. Correcto registro en turnos_quirofano, bitácora de evolución y mensajes.
5. Funcionamiento de los endpoints FastAPI correspondientes.
"""

import os
import pytest
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.seguimiento_quirurgico_service import despachar_consentimiento_informado_inteligente
from app.services.whatsapp_cloud.client import ConversationWindowClosedError

client = TestClient(app)


class TestSmartTemplateConsentimiento(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.mock_turno = {
            "id": "turno_qx_test_001",
            "asesoria_id": "as_test_001",
            "paciente_id": "pac_test_001",
            "fecha_cirugia": "2026-10-25",
            "hora_inicio": "09:30:00",
            "practica_nombre": "Facoemulsificación con LIO Premium",
            "ojo": "OD",
            "cirujano_nombre": "Dr. Fernando Brizuela",
            "consentimiento_token": "token_seguro_test_abc123",
            "consentimiento_estado": "pendiente_envio",
            "pacientes": {
                "id": "pac_test_001",
                "nombre": "Selva Mouradian",
                "telefono": "+5493804123456"
            }
        }

    @patch("app.services.seguimiento_quirurgico_service.supabase")
    @patch("app.db.get_turno_quirofano_by_id")
    @patch("app.db.check_patient_24h_window")
    @patch("app.db.registrar_envio_consentimiento_quirurgico")
    @patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials")
    @patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_template")
    async def test_despacho_plantilla_cuando_ventana_cerrada(
        self,
        mock_send_template,
        mock_get_creds,
        mock_registrar,
        mock_check_win,
        mock_get_turno,
        mock_supabase
    ):
        """Si la ventana de 24h está cerrada, debe despachar la plantilla oficial aprobada."""
        mock_get_turno.return_value = self.mock_turno
        mock_check_win.return_value = {"is_open": False, "status": "EXPIRED"}
        mock_get_creds.return_value = ("1000999888", "EAAG_token_test_123")
        mock_send_template.return_value = {"wamid": "wamid.HBgLMjYwMTAw", "raw_response": {}}
        mock_registrar.return_value = True

        res = await despachar_consentimiento_informado_inteligente(turno_id="turno_qx_test_001")

        self.assertTrue(res["success"])
        self.assertEqual(res["modo_utilizado"], "template")
        self.assertEqual(res["template_name"], "consentimiento_informado_quirurgico_v1")
        self.assertEqual(res["wamid"], "wamid.HBgLMjYwMTAw")

        # Verificar parámetros de la plantilla
        mock_send_template.assert_called_once()
        kwargs = mock_send_template.call_args.kwargs
        self.assertEqual(kwargs["template_name"], "consentimiento_informado_quirurgico_v1")
        self.assertEqual(kwargs["language_code"], "es_AR")

        components = kwargs["components"]
        body_params = components[0]["parameters"]
        self.assertEqual(len(body_params), 5)
        self.assertEqual(body_params[0]["text"], "Selva Mouradian")
        self.assertIn("Facoemulsificación con LIO Premium", body_params[1]["text"])
        self.assertIn("25/10/2026", body_params[2]["text"])
        self.assertEqual(body_params[3]["text"], "Dr. Fernando Brizuela")
        self.assertIn("token_seguro_test_abc123", body_params[4]["text"])

        # Verificar que se registró el envío con modo template
        mock_registrar.assert_called_once()
        reg_args = mock_registrar.call_args.kwargs
        self.assertEqual(reg_args["modo_envio"], "template")
        self.assertEqual(reg_args["template_name"], "consentimiento_informado_quirurgico_v1")

    @patch("app.services.seguimiento_quirurgico_service.supabase")
    @patch("app.db.get_turno_quirofano_by_id")
    @patch("app.db.check_patient_24h_window")
    @patch("app.db.registrar_envio_consentimiento_quirurgico")
    @patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials")
    @patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_free_text")
    async def test_despacho_texto_libre_cuando_ventana_abierta(
        self,
        mock_send_free_text,
        mock_get_creds,
        mock_registrar,
        mock_check_win,
        mock_get_turno,
        mock_supabase
    ):
        """Si la ventana de 24h está abierta, intenta texto libre con enlace directo."""
        mock_get_turno.return_value = self.mock_turno
        mock_check_win.return_value = {"is_open": True, "status": "OPEN"}
        mock_get_creds.return_value = ("1000999888", "EAAG_token_test_123")
        mock_send_free_text.return_value = {"wamid": "wamid.HBgLTEXTFREE", "raw_response": {}}
        mock_registrar.return_value = True

        res = await despachar_consentimiento_informado_inteligente(turno_id="turno_qx_test_001")

        self.assertTrue(res["success"])
        self.assertEqual(res["modo_utilizado"], "free_text")
        self.assertIsNone(res["template_name"])
        mock_send_free_text.assert_called_once()

    @patch("app.services.seguimiento_quirurgico_service.supabase")
    @patch("app.db.get_turno_quirofano_by_id")
    @patch("app.db.check_patient_24h_window")
    @patch("app.db.registrar_envio_consentimiento_quirurgico")
    @patch("app.services.whatsapp_cloud.client.get_whatsapp_cloud_credentials")
    @patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_free_text")
    @patch("app.services.whatsapp_cloud.client.WhatsAppCloudClient.send_template")
    async def test_fallback_automatico_ante_error_reengagement(
        self,
        mock_send_template,
        mock_send_free_text,
        mock_get_creds,
        mock_registrar,
        mock_check_win,
        mock_get_turno,
        mock_supabase
    ):
        """Si la ventana parecía abierta pero Meta rechaza con error 131047/131026, conmuta automáticamente a plantilla."""
        mock_get_turno.return_value = self.mock_turno
        mock_check_win.return_value = {"is_open": True, "status": "OPEN"}
        mock_get_creds.return_value = ("1000999888", "EAAG_token_test_123")
        # Simular rechazo de Meta en texto libre
        mock_send_free_text.side_effect = ConversationWindowClosedError(131047, None, "Re-engagement message", None)
        mock_send_template.return_value = {"wamid": "wamid.HBgLFALLBACK", "raw_response": {}}
        mock_registrar.return_value = True

        res = await despachar_consentimiento_informado_inteligente(turno_id="turno_qx_test_001")

        self.assertTrue(res["success"])
        self.assertEqual(res["modo_utilizado"], "template")
        self.assertEqual(res["template_name"], "consentimiento_informado_quirurgico_v1")
        mock_send_template.assert_called_once()


class TestEndpointsConsentimiento(unittest.TestCase):

    def setUp(self):
        import jwt
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "super-secret-jwt-key-for-test-2026-audit")
        payload = {
            "sub": "test-user-123",
            "email": "operador@test.com",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": 9999999999
        }
        self.auth_token = jwt.encode(payload, jwt_secret, algorithm="HS256")
        self.auth_headers = {"Authorization": f"Bearer {self.auth_token}"}

    @patch("app.services.seguimiento_quirurgico_service.despachar_consentimiento_informado_inteligente")
    def test_endpoint_turno_enviar_consentimiento(self, mock_despachar):
        """El endpoint POST /api/turnos-quirofano/{turno_id}/enviar-consentimiento-wa debe delegar en el enrutador inteligente."""
        mock_despachar.return_value = {
            "success": True,
            "modo_utilizado": "template",
            "template_name": "consentimiento_informado_quirurgico_v1",
            "wamid": "wamid.HBgLENDPT",
            "enlace_firma": "https://crm-agentico-nube.vercel.app/consentimiento/abc",
            "estado": "enviado_whatsapp"
        }

        resp = client.post("/api/turnos-quirofano/turno_qx_123/enviar-consentimiento-wa", headers=self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["template_name"], "consentimiento_informado_quirurgico_v1")

    @patch("app.db.supabase")
    @patch("app.services.seguimiento_quirurgico_service.despachar_consentimiento_informado_inteligente")
    def test_endpoint_asesoria_enviar_consentimiento(self, mock_despachar, mock_sb):
        """El endpoint POST /api/asesorias-quirurgicas/{asesoria_id}/enviar-consentimiento-wa debe delegar en el enrutador inteligente."""
        mock_sb.table().select().eq().limit().execute.return_value = MagicMock(data=[{"id": "asesoria_123", "estado": "programado", "codigo_caso": "QX-26-001"}])
        mock_despachar.return_value = {
            "success": True,
            "modo_utilizado": "template",
            "template_name": "consentimiento_informado_quirurgico_v1",
            "wamid": "wamid.HBgLASESORIA",
            "enlace_firma": "https://crm-agentico-nube.vercel.app/consentimiento/xyz",
            "estado": "enviado_whatsapp"
        }

        resp = client.post("/api/asesorias-quirurgicas/asesoria_123/enviar-consentimiento-wa", headers=self.auth_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["template_name"], "consentimiento_informado_quirurgico_v1")
