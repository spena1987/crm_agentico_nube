import io
import unittest
import pypdf
from PIL import Image

from app.services.caratula_estudios_service import (
    generar_portada_pdf_a4,
    componer_lamina_digital_imagen,
    fusionar_portada_con_pdf,
    componer_estudio_hibrido
)


class TestCaratulaHibrida(unittest.TestCase):
    def setUp(self):
        self.paciente = {
            "nombre": "PEÑA, JUAN SEBASTIAN",
            "dni": "33516799",
            "geclisa_ficha_id": 242646,
            "obra_social": "OSDE",
            "plan": "210"
        }
        self.estudio = {
            "tipo_estudio": "OCT Macular y Papilar",
            "ojo": "AO",
            "tecnico_nombre": "TARIFEÑO, CAMILA",
            "observaciones": "Control oftalmológico de rutina"
        }

    def test_huso_horario_argentina(self):
        from app.services.caratula_estudios_service import get_argentina_now, ARGENTINA_TZ
        now_arg = get_argentina_now()
        self.assertEqual(now_arg.tzinfo, ARGENTINA_TZ)
        hora_str = now_arg.strftime("%H:%M hs")
        self.assertTrue(hora_str.endswith(" hs"))

    def test_generar_portada_pdf_a4(self):
        pdf_bytes = generar_portada_pdf_a4(self.paciente, self.estudio)
        self.assertGreater(len(pdf_bytes), 1000)
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        self.assertEqual(len(reader.pages), 1)

    def test_componer_lamina_digital_imagen(self):
        img = Image.new("RGB", (640, 480), (10, 50, 90))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        
        lamina_bytes = componer_lamina_digital_imagen(buf.getvalue(), self.paciente, self.estudio)
        self.assertGreater(len(lamina_bytes), 1000)
        reader = pypdf.PdfReader(io.BytesIO(lamina_bytes))
        # En modo mobile-first debe ser exactamente 1 página
        self.assertEqual(len(reader.pages), 1)

    def test_componer_lamina_digital_imagen_panoramica(self):
        # Imagen horizontal 16:9 (1920x1080) típica de IOL Master o campímetro
        img = Image.new("RGB", (1920, 1080), (20, 80, 140))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")

        # Probar exportación a JPEG
        jpg_bytes = componer_lamina_digital_imagen(
            buf.getvalue(),
            self.paciente,
            self.estudio,
            export_format="JPEG"
        )
        self.assertGreater(len(jpg_bytes), 1000)
        res_img = Image.open(io.BytesIO(jpg_bytes))
        self.assertEqual(res_img.width, 1240)
        # La altura debe ser dinámica/compacta slim (~824 px) ahorrando más de 220 px respecto al diseño previo
        self.assertLess(res_img.height, 950)
        self.assertGreater(res_img.height, 750)

    def test_componer_estudio_hibrido_caso_imagen(self):
        img = Image.new("RGB", (640, 480), (10, 50, 90))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")

        files_data = [("oct_scan.jpg", buf.getvalue(), "image/jpeg")]
        # Modo por defecto para imagen única (JPEG nativo para WhatsApp)
        final_bytes, fname, mime = componer_estudio_hibrido(
            files_data=files_data,
            paciente_info=self.paciente,
            estudio_info=self.estudio,
            base_filename="Estudio_OCT_AO",
            unificar_en_pdf=False
        )
        self.assertEqual(mime, "image/jpeg")
        self.assertTrue(fname.endswith(".jpg"))
        self.assertGreater(len(final_bytes), 1000)

        # Modo forzado a PDF
        final_pdf_bytes, fname_pdf, mime_pdf = componer_estudio_hibrido(
            files_data=files_data,
            paciente_info=self.paciente,
            estudio_info=self.estudio,
            base_filename="Estudio_OCT_AO",
            unificar_en_pdf=True
        )
        self.assertEqual(mime_pdf, "application/pdf")
        self.assertTrue(fname_pdf.endswith(".pdf"))
        reader = pypdf.PdfReader(io.BytesIO(final_pdf_bytes))
        self.assertEqual(len(reader.pages), 1)

    def test_componer_estudio_hibrido_caso_pdf(self):
        portada = generar_portada_pdf_a4(self.paciente, self.estudio)

        files_data = [("estudio_original.pdf", portada, "application/pdf")]
        final_bytes, fname, mime = componer_estudio_hibrido(
            files_data=files_data,
            paciente_info=self.paciente,
            estudio_info=self.estudio,
            base_filename="Estudio_OCT_AO"
        )
        self.assertEqual(mime, "application/pdf")
        reader = pypdf.PdfReader(io.BytesIO(final_bytes))
        # Portada + estudio original = 2 páginas
        self.assertEqual(len(reader.pages), 2)


    def test_mostrar_sedes_flag_en_lamina_y_portada(self):
        # Con mostrar_sedes = False, la altura debe ser aún menor (pie ultra-slim)
        img = Image.new("RGB", (640, 480), (10, 50, 90))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")

        cfg_sin_sedes = {
            "activo": True,
            "mostrar_sedes": False,
            "mostrar_cobertura": True,
            "sedes": ["Mitre 540", "Roca 71"],
            "telefono_0800": "0800-TEST",
            "whatsapp_contacto": "261-TEST"
        }
        lamina_sin_sedes = componer_lamina_digital_imagen(
            buf.getvalue(), self.paciente, self.estudio, config=cfg_sin_sedes, export_format="JPEG"
        )
        img_sin_sedes = Image.open(io.BytesIO(lamina_sin_sedes))

        cfg_con_sedes = {
            "activo": True,
            "mostrar_sedes": True,
            "mostrar_cobertura": True,
            "sedes": ["Mitre 540", "Roca 71"],
            "telefono_0800": "0800-TEST",
            "whatsapp_contacto": "261-TEST"
        }
        lamina_con_sedes = componer_lamina_digital_imagen(
            buf.getvalue(), self.paciente, self.estudio, config=cfg_con_sedes, export_format="JPEG"
        )
        img_con_sedes = Image.open(io.BytesIO(lamina_con_sedes))

        # La versión sin sedes debe ser más compacta en altura
        self.assertLess(img_sin_sedes.height, img_con_sedes.height)

        # Portada A4 no debe fallar con mostrar_sedes = False
        portada = generar_portada_pdf_a4(self.paciente, self.estudio, config=cfg_sin_sedes)
        self.assertGreater(len(portada), 1000)


if __name__ == "__main__":
    unittest.main()

