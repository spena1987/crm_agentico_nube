import io
import os
import glob
import unittest
import pypdf
from PIL import Image

from app.services.caratula_estudios_service import (
    build_compact_pdf_from_images,
    optimize_single_image_for_whatsapp,
    componer_estudio_hibrido,
    componer_lamina_digital_imagen,
)


def _make_jpeg_bytes(width: int = 800, height: int = 600, color=(20, 60, 120)) -> bytes:
    buf = io.BytesIO()
    im = Image.new("RGB", (width, height), color)
    im.save(buf, format="JPEG", quality=85)
    im.close()
    return buf.getvalue()


def _make_png_rgba_bytes(width: int = 600, height: int = 400) -> bytes:
    buf = io.BytesIO()
    im = Image.new("RGBA", (width, height), (10, 80, 160, 180))
    im.save(buf, format="PNG")
    im.close()
    return buf.getvalue()


class TestEstudiosOptimizacionPdf(unittest.TestCase):

    def test_build_compact_pdf_handles_jpeg_and_png_rgba(self):
        jpg_bytes = _make_jpeg_bytes(1200, 900)
        png_rgba_bytes = _make_png_rgba_bytes(800, 600)

        pdf_bytes = build_compact_pdf_from_images([jpg_bytes, png_rgba_bytes])
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        self.assertEqual(len(reader.pages), 2)

    def test_build_compact_pdf_handles_exif_orientation(self):
        buf = io.BytesIO()
        im = Image.new("RGB", (600, 400), (40, 120, 80))
        exif = im.getexif()
        exif[274] = 6  # Rotate 90 CW
        im.save(buf, format="JPEG", exif=exif.tobytes())
        im.close()

        pdf_bytes = build_compact_pdf_from_images([buf.getvalue()])
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        self.assertEqual(len(reader.pages), 1)

    def test_componer_estudio_hibrido_activo_false_no_agrega_caratula(self):
        img1 = ("img1.jpg", _make_jpeg_bytes(800, 600), "image/jpeg")
        img2 = ("img2.jpg", _make_jpeg_bytes(800, 600), "image/jpeg")

        pdf_bytes, fname, mime = componer_estudio_hibrido(
            files_data=[img1, img2],
            paciente_info={"nombre": "PACIENTE TEST", "dni": "12345678"},
            estudio_info={"tipo_estudio": "RFG", "ojo": "AO"},
            config={"activo": False},
            base_filename="Test_Sin_Caratula",
            unificar_en_pdf=True,
        )
        self.assertEqual(mime, "application/pdf")
        self.assertTrue(fname.endswith(".pdf"))
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        # Sin carátula: exactamente 2 páginas (no 3)
        self.assertEqual(len(reader.pages), 2)

    def test_lamina_digital_respeta_tope_meta_jpeg_y_pdf(self):
        img_bytes = _make_jpeg_bytes(1600, 1200)
        pac = {"nombre": "PACIENTE TEST", "dni": "33516799", "geclisa_ficha_id": 242646}
        est = {"tipo_estudio": "OCT", "ojo": "AO", "fecha_str": "18/11/2026", "hora_str": "10:00 hs"}

        jpg_out = componer_lamina_digital_imagen(img_bytes, pac, est, export_format="JPEG")
        self.assertLessEqual(len(jpg_out), int(4.7 * 1024 * 1024))

        pdf_out = componer_lamina_digital_imagen(img_bytes, pac, est, export_format="PDF")
        self.assertTrue(pdf_out.startswith(b"%PDF-"))
        reader = pypdf.PdfReader(io.BytesIO(pdf_out))
        self.assertEqual(len(reader.pages), 1)

    def test_optimize_single_image_for_whatsapp_cap(self):
        raw = _make_jpeg_bytes(2500, 2500)
        out = optimize_single_image_for_whatsapp(raw, max_bytes=int(4.7 * 1024 * 1024))
        self.assertLessEqual(len(out), int(4.7 * 1024 * 1024))

    def test_benchmark_real_rfg_43_imagenes(self):
        rfg_dir = r"C:\Users\Malko\Downloads\ROSALES MARIA JIMENA RFG"
        if not os.path.isdir(rfg_dir):
            self.skipTest("Carpeta de prueba RFG no disponible en este entorno.")

        files = sorted(glob.glob(os.path.join(rfg_dir, "*.jpg")))
        self.assertEqual(len(files), 43)

        raw_total = sum(os.path.getsize(f) for f in files)
        # Simular pre-optimización del navegador (1600px, q=80) y ensamblado con img2pdf + carátula A4
        optimized_items = []
        for idx, path in enumerate(files):
            with Image.open(path) as im:
                im = im.convert("RGB")
                im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=80, optimize=True)
                optimized_items.append((f"img_{idx}.jpg", buf.getvalue(), "image/jpeg"))

        pdf_bytes, _, _ = componer_estudio_hibrido(
            files_data=optimized_items,
            paciente_info={"nombre": "PACIENTE RFG", "dni": "00000000", "geclisa_ficha_id": 1},
            estudio_info={"tipo_estudio": "Retinofluoresceinografía", "ojo": "AO", "fecha_str": "18/11/2026", "hora_str": "05:30 hs"},
            config={"activo": True, "modo_hibrido": True},
            base_filename="RFG_Benchmark",
            unificar_en_pdf=True,
        )
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        self.assertEqual(len(reader.pages), 44)  # 1 portada + 43 tomas
        self.assertLess(len(pdf_bytes), 19 * 1024 * 1024)
        print(
            f"\n[BENCHMARK RFG] Original: {raw_total / (1024*1024):.2f} MB -> "
            f"PDF final (44 págs c/ carátula): {len(pdf_bytes) / (1024*1024):.2f} MB "
            f"(reducción {100 * (1 - len(pdf_bytes)/raw_total):.1f}%)"
        )


if __name__ == "__main__":
    unittest.main()
