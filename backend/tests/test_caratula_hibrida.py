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

    def test_componer_estudio_hibrido_caso_imagen(self):
        img = Image.new("RGB", (640, 480), (10, 50, 90))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")

        files_data = [("oct_scan.jpg", buf.getvalue(), "image/jpeg")]
        final_bytes, fname, mime = componer_estudio_hibrido(
            files_data=files_data,
            paciente_info=self.paciente,
            estudio_info=self.estudio,
            base_filename="Estudio_OCT_AO"
        )
        self.assertEqual(mime, "application/pdf")
        self.assertTrue(fname.endswith(".pdf"))
        reader = pypdf.PdfReader(io.BytesIO(final_bytes))
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


if __name__ == "__main__":
    unittest.main()

