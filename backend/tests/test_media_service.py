import unittest
import os
import shutil
from app.services.media_service import media_service, STATIC_MEDIA_DIR

class TestMediaService(unittest.TestCase):

    def test_get_extension_from_mime(self):
        self.assertEqual(media_service.get_extension_from_mime("image/jpeg"), ".jpg")
        self.assertEqual(media_service.get_extension_from_mime("image/png"), ".png")
        self.assertEqual(media_service.get_extension_from_mime("audio/ogg; codecs=opus"), ".ogg")
        self.assertEqual(media_service.get_extension_from_mime("application/pdf"), ".pdf")
        self.assertEqual(media_service.get_extension_from_mime("", "receta_cardiologia.pdf"), ".pdf")

    def test_save_media_bytes_image(self):
        dummy_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
        result = media_service.save_media_bytes(
            data=dummy_bytes,
            subfolder="images",
            mime_type="image/jpeg",
            original_filename="foto_estudio.jpg",
            prefix="test_img"
        )
        self.assertTrue(os.path.exists(result["file_path"]))
        self.assertTrue(result["media_url"].endswith(".jpg"))
        self.assertEqual(result["file_size_bytes"], len(dummy_bytes))
        self.assertEqual(result["mime_type"], "image/jpeg")

        # Limpieza
        if os.path.exists(result["file_path"]):
            os.remove(result["file_path"])

    def test_save_media_bytes_pdf(self):
        dummy_pdf = b"%PDF-1.4 header dummy content"
        result = media_service.save_media_bytes(
            data=dummy_pdf,
            subfolder="documents",
            mime_type="application/pdf",
            original_filename="informe_laboratorio.pdf",
            prefix="test_doc"
        )
        self.assertTrue(os.path.exists(result["file_path"]))
        self.assertTrue(result["media_url"].endswith(".pdf"))
        self.assertEqual(result["file_size_bytes"], len(dummy_pdf))

        # Limpieza
        if os.path.exists(result["file_path"]):
            os.remove(result["file_path"])

if __name__ == "__main__":
    unittest.main()
