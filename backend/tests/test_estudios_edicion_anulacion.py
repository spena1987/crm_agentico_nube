import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

from app.services.estudios_tecnicos_service import (
    editar_estudio_oftalmologico,
    anular_estudio_oftalmologico,
    reintentar_envio_whatsapp_estudio,
    EditarEstudioPayload,
    AnularEstudioPayload,
    ReintentarWhatsAppEstudioPayload
)

class TestEstudiosEdicionAnulacion(unittest.IsolatedAsyncioTestCase):

    @patch("app.services.estudios_tecnicos_service.supabase")
    async def test_editar_estudio_exito(self, mock_sb):
        # Simular estudio existente creado hace 1 hora por usuario 'usr-1'
        now_utc = datetime.now(timezone.utc)
        created_at_iso = (now_utc - timedelta(hours=1)).isoformat()
        
        mock_row = {
            "id": "est-123",
            "tipo": "Campo Visual Computarizado",
            "ojo": "OD",
            "observaciones": "Nota inicial",
            "usuario_id": "usr-1",
            "created_at": created_at_iso,
            "estado": "activo",
            "historial_cambios": []
        }
        
        mock_sb.table().select().eq().limit().execute.return_value.data = [mock_row]
        mock_sb.table().update().eq().execute.return_value.data = [{
            **mock_row,
            "tipo": "OCT Macular y Papilar",
            "ojo": "AO",
            "observaciones": "Nota corregida",
            "estado": "editado"
        }]

        payload = EditarEstudioPayload(
            tipo_estudio="OCT Macular y Papilar",
            ojo="AO",
            observaciones="Nota corregida",
            usuario_id="usr-1",
            usuario_nombre="Técnico Juan",
            is_admin=False
        )

        res = await editar_estudio_oftalmologico("est-123", payload)
        self.assertTrue(res["success"])
        self.assertEqual(len(res["cambios_aplicados"]), 3)
        self.assertEqual(res["estudio"]["estado"], "editado")

    @patch("app.services.estudios_tecnicos_service.supabase")
    async def test_editar_estudio_bloqueado_si_anulado(self, mock_sb):
        mock_row = {
            "id": "est-123",
            "estado": "anulado",
            "usuario_id": "usr-1"
        }
        mock_sb.table().select().eq().limit().execute.return_value.data = [mock_row]

        payload = EditarEstudioPayload(tipo_estudio="Nuevo Tipo", usuario_id="usr-1")
        with self.assertRaises(HTTPException) as ctx:
            await editar_estudio_oftalmologico("est-123", payload)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("anulado", ctx.exception.detail.lower())

    @patch("app.services.estudios_tecnicos_service.supabase")
    async def test_editar_estudio_expirado_24hs_no_admin(self, mock_sb):
        now_utc = datetime.now(timezone.utc)
        created_at_iso = (now_utc - timedelta(hours=25)).isoformat()
        mock_row = {
            "id": "est-123",
            "created_at": created_at_iso,
            "usuario_id": "usr-1",
            "estado": "activo"
        }
        mock_sb.table().select().eq().limit().execute.return_value.data = [mock_row]

        payload = EditarEstudioPayload(tipo_estudio="Nuevo Tipo", usuario_id="usr-1", is_admin=False)
        with self.assertRaises(HTTPException) as ctx:
            await editar_estudio_oftalmologico("est-123", payload)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("24 hs", ctx.exception.detail)

    @patch("app.services.estudios_tecnicos_service.supabase")
    async def test_editar_estudio_expirado_24hs_permitido_para_admin(self, mock_sb):
        now_utc = datetime.now(timezone.utc)
        created_at_iso = (now_utc - timedelta(hours=48)).isoformat()
        mock_row = {
            "id": "est-123",
            "tipo": "Campo Visual",
            "created_at": created_at_iso,
            "usuario_id": "usr-1",
            "estado": "activo",
            "historial_cambios": []
        }
        mock_sb.table().select().eq().limit().execute.return_value.data = [mock_row]
        mock_sb.table().update().eq().execute.return_value.data = [{**mock_row, "tipo": "OCT", "estado": "editado"}]

        payload = EditarEstudioPayload(tipo_estudio="OCT", usuario_id="usr-admin", is_admin=True)
        res = await editar_estudio_oftalmologico("est-123", payload)
        self.assertTrue(res["success"])
        self.assertEqual(res["estudio"]["estado"], "editado")

    @patch("app.services.estudios_tecnicos_service.geclisa_client")
    @patch("app.services.estudios_tecnicos_service.supabase")
    async def test_anular_estudio_con_purga_geclisa(self, mock_sb, mock_geclisa):
        mock_row = {
            "id": "est-999",
            "estado": "activo",
            "geclisa_as_id": 195844,
            "usuario_id": "usr-tec",
            "telefono_destino": "+5492615551234",
            "tipo": "Topografía Corneal",
            "ojo": "OD"
        }
        mock_sb.table().select().eq().limit().execute.return_value.data = [mock_row]
        mock_geclisa.eliminar_archivo_historia_clinica.return_value = {"success": True, "mensaje": "Eliminado"}
        mock_sb.table().update().eq().execute.return_value.data = [{
            **mock_row,
            "estado": "anulado",
            "motivo_anulacion": "Paciente equivocado",
            "eliminado_geclisa": True
        }]

        payload = AnularEstudioPayload(
            motivo="Paciente equivocado al adjuntar imagen",
            eliminar_de_geclisa=True,
            notificar_whatsapp=False,
            usuario_id="usr-tec",
            usuario_nombre="Técnico",
            is_admin=False
        )

        res = await anular_estudio_oftalmologico("est-999", payload)
        self.assertTrue(res["success"])
        self.assertTrue(res["geclisa_purgado"])
        self.assertEqual(res["estudio"]["estado"], "anulado")
        mock_geclisa.eliminar_archivo_historia_clinica.assert_called_once_with(archivo_id=195844, as_id=195844)

    @patch("app.services.estudios_tecnicos_service.supabase")
    async def test_anular_estudio_valida_motivo_minimo(self, mock_sb):
        payload = AnularEstudioPayload(motivo="x")
        with self.assertRaises(HTTPException) as ctx:
            await anular_estudio_oftalmologico("est-999", payload)
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("app.services.estudios_tecnicos_service.supabase")
    async def test_reintentar_whatsapp_bloqueado_si_anulado(self, mock_sb):
        mock_row = {
            "id": "est-999",
            "estado": "anulado",
            "geclisa_as_id": 195844,
            "telefono_destino": "+5492615551234"
        }
        mock_sb.table().select().eq().limit().execute.return_value.data = [mock_row]

        with self.assertRaises(HTTPException) as ctx:
            await reintentar_envio_whatsapp_estudio("est-999", ReintentarWhatsAppEstudioPayload())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("anulado", ctx.exception.detail.lower())


if __name__ == "__main__":
    unittest.main()
