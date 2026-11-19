import unittest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.services.estudios_tecnicos_service import (
    obtener_config_estudios_oftalmologicos,
    actualizar_config_estudios_oftalmologicos,
    UpdateEstudiosConfigPayload,
    EstudioPresetItemPayload,
    EstudiosOperacionPayload,
)


def _make_request(user_id=None):
    req = MagicMock()
    req.state.user = {"sub": user_id} if user_id else {}
    return req


class TestEstudiosConfig(unittest.TestCase):

    @patch("app.services.config_service.load_settings")
    def test_get_config_retorna_presets_ordenados_y_operacion(self, mock_load):
        mock_load.return_value = {
            "estudios_oftalmo": {
                "presets": [
                    {"id": "b", "nombre": "Campo Visual", "activo": True, "orden": 2},
                    {"id": "a", "nombre": "OCT Macular", "activo": True, "orden": 1},
                ],
                "operacion": {
                    "ojo_default": "OD",
                    "unificar_en_pdf_default": False,
                    "aplicar_caratula_default": True,
                },
            },
            "caratula_estudios": {"activo": True},
        }

        res = obtener_config_estudios_oftalmologicos()
        self.assertTrue(res["success"])
        self.assertEqual([p["id"] for p in res["presets"]], ["a", "b"])
        self.assertEqual(res["operacion"]["ojo_default"], "OD")
        self.assertFalse(res["operacion"]["unificar_en_pdf_default"])
        self.assertTrue(res["caratula_activa"])

    def test_put_config_rechaza_sin_sesion_con_403(self):
        req = _make_request(user_id=None)
        payload = UpdateEstudiosConfigPayload(
            operacion=EstudiosOperacionPayload(ojo_default="OI")
        )
        with self.assertRaises(HTTPException) as ctx:
            actualizar_config_estudios_oftalmologicos(req, payload)
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.services.estudios_tecnicos_service.supabase")
    def test_put_config_rechaza_rol_sin_permiso_con_403(self, mock_sb):
        mock_sb.table().select().eq().limit().execute.return_value.data = [
            {
                "id": "usr-tec",
                "nombre_completo": "Técnico Prueba",
                "rol_id": "rol-tec",
                "roles": {"codigo": "tecnico", "nombre": "Técnico"},
            }
        ]
        mock_sb.table().select().eq().eq().in_().eq().execute.return_value.data = []

        req = _make_request(user_id="usr-tec")
        payload = UpdateEstudiosConfigPayload(
            operacion=EstudiosOperacionPayload(ojo_default="OI")
        )
        with self.assertRaises(HTTPException) as ctx:
            actualizar_config_estudios_oftalmologicos(req, payload)
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.services.estudios_tecnicos_service.supabase")
    def test_put_config_rechaza_etiquetas_duplicadas_con_400(self, mock_sb):
        mock_sb.table().select().eq().limit().execute.return_value.data = [
            {
                "id": "usr-admin",
                "nombre_completo": "Admin Test",
                "rol_id": "rol-admin",
                "roles": {"codigo": "admin", "nombre": "Administrador"},
            }
        ]
        req = _make_request(user_id="usr-admin")
        payload = UpdateEstudiosConfigPayload(
            presets=[
                EstudioPresetItemPayload(id="1", nombre="OCT Macular", activo=True, orden=1),
                EstudioPresetItemPayload(id="2", nombre="  oct   macular ", activo=True, orden=2),
            ]
        )
        with self.assertRaises(HTTPException) as ctx:
            actualizar_config_estudios_oftalmologicos(req, payload)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("duplicada", ctx.exception.detail.lower())

    @patch("app.services.estudios_tecnicos_service.log_event")
    @patch("app.services.config_service.save_settings")
    @patch("app.services.config_service.load_settings")
    @patch("app.services.estudios_tecnicos_service.supabase")
    def test_put_config_guarda_y_audita_para_admin(self, mock_sb, mock_load, mock_save, mock_log):
        mock_sb.table().select().eq().limit().execute.return_value.data = [
            {
                "id": "usr-admin",
                "nombre_completo": "Dr. Peña",
                "rol_id": "rol-admin",
                "roles": {"codigo": "admin", "nombre": "Administrador"},
            }
        ]
        updated_state = {
            "estudios_oftalmo": {
                "presets": [
                    {"id": "1", "nombre": "Angio-OCT", "activo": True, "orden": 1}
                ],
                "operacion": {
                    "ojo_default": "OD",
                    "unificar_en_pdf_default": True,
                    "aplicar_caratula_default": False,
                },
            },
            "caratula_estudios": {"activo": True},
        }
        mock_load.return_value = updated_state
        mock_save.return_value = updated_state

        req = _make_request(user_id="usr-admin")
        payload = UpdateEstudiosConfigPayload(
            presets=[EstudioPresetItemPayload(id="1", nombre="Angio-OCT", activo=True, orden=1)],
            operacion=EstudiosOperacionPayload(ojo_default="OD", unificar_en_pdf_default=True, aplicar_caratula_default=False),
        )

        res = actualizar_config_estudios_oftalmologicos(req, payload)
        self.assertTrue(res["success"])
        mock_save.assert_called_once()
        self.assertEqual(mock_save.call_args.kwargs.get("actualizado_por"), "Dr. Peña")
        mock_log.assert_called_once()
        self.assertEqual(mock_log.call_args.kwargs.get("accion"), "ACTUALIZAR_CONFIG_ESTUDIOS")


if __name__ == "__main__":
    unittest.main()
