import os
import jwt
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.routers.optica_vortix_router import optica_vortix_router

client = TestClient(app)

SAMPLE_IMAGE_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb"


def get_auth_headers():
    secret = os.environ.get('SUPABASE_JWT_SECRET', 'super-secret-jwt-key-for-test-2026-audit')
    token = jwt.encode(
        {'sub': 'user-optica-123', 'email': 'optica@vortix.com', 'role': 'authenticated', 'aud': 'authenticated', 'exp': 9999999999},
        secret,
        algorithm='HS256'
    )
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def mock_optica_config():
    fake_config = {
        "optica_phone_number_id": "111222333",
        "optica_display_phone": "5492615123456",
        "placas_galeria": [
            {
                "id": "placa-existente-1",
                "titulo": "Placa Inicial",
                "categoria": "PROMO_ARMAZONES",
                "url": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/init.jpg",
                "url_imagen": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/init.jpg",
                "file_name": "init.jpg",
            }
        ],
        "placa_turno_url": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/init.jpg"
    }

    def fake_get_config():
        return dict(fake_config)

    def fake_save_config(updates):
        fake_config.update(updates)
        return dict(fake_config)

    with patch("app.routers.optica_vortix_router.get_optica_vortix_full_config", side_effect=fake_get_config), \
         patch("app.routers.optica_vortix_router.save_optica_vortix_full_config", side_effect=fake_save_config):
        yield fake_config


@patch("app.routers.optica_vortix_router.MediaService.save_media_bytes")
def test_upload_placa_multipart_archivo(mock_save_media, mock_optica_config):
    mock_save_media.return_value = {
        "media_url": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/vortix_placa_1.jpg",
        "storage_url": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/vortix_placa_1.jpg",
        "file_name": "promo_marzo.jpg"
    }

    files = {
        "archivo": ("promo_marzo.jpg", SAMPLE_IMAGE_BYTES, "image/jpeg")
    }
    data = {
        "titulo": "Promo 2x1 Armazones",
        "categoria": "PROMO_ARMAZONES"
    }

    response = client.post("/api/optica-vortix/placas/upload", headers=get_auth_headers(), files=files, data=data)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["success"] is True
    assert res_data["titulo"] == "Promo 2x1 Armazones"
    assert res_data["categoria"] == "PROMO_ARMAZONES"
    assert "https://supabase.co/storage/v1/object/public/whatsapp-media/images/vortix_placa_1.jpg" in res_data["url_imagen"]
    assert len(res_data["placas"]) >= 2
    mock_save_media.assert_called_once()
    assert mock_save_media.call_args[1]["prefix"] == "vortix_placa"
    assert mock_save_media.call_args[1]["subfolder"] == "images"


@patch("app.routers.optica_vortix_router.MediaService.save_media_bytes")
def test_upload_placa_multipart_file_default_fields(mock_save_media, mock_optica_config):
    mock_save_media.return_value = {
        "media_url": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/vortix_placa_2.jpg",
        "storage_url": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/vortix_placa_2.jpg",
        "file_name": "descuento.png"
    }

    files = {
        "file": ("descuento.png", SAMPLE_IMAGE_BYTES, "image/png")
    }

    response = client.post("/api/optica-vortix/placas/upload", headers=get_auth_headers(), files=files)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["success"] is True
    # Default values per specification
    assert res_data["titulo"] == "Placa Promocional Óptica Vortix"
    assert res_data["categoria"] == "PROMO_ARMAZONES"
    assert "vortix_placa_2.jpg" in res_data["url"]


def test_upload_placa_json(mock_optica_config):
    payload = {
        "titulo": "Placa JSON Test",
        "categoria": "PROMO_ARMAZONES",
        "url_imagen": "https://supabase.co/storage/v1/object/public/whatsapp-media/images/promo_directa.jpg"
    }
    response = client.post("/api/optica-vortix/placas/upload", headers=get_auth_headers(), json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["titulo"] == "Placa JSON Test"
    assert res_data["url_imagen"] == "https://supabase.co/storage/v1/object/public/whatsapp-media/images/promo_directa.jpg"


def test_delete_placa_promocional(mock_optica_config):
    # Ensure existing placa is present
    get_res = client.get("/api/optica-vortix/placas", headers=get_auth_headers())
    assert get_res.status_code == 200
    initial_placas = get_res.json()["placas"]
    assert any(p["id"] == "placa-existente-1" for p in initial_placas)

    # Delete it
    del_res = client.delete("/api/optica-vortix/placas/placa-existente-1", headers=get_auth_headers())
    assert del_res.status_code == 200
    del_data = del_res.json()

    assert del_data["success"] is True
    assert del_data["message"] == "Placa eliminada exitosamente"
    assert not any(p["id"] == "placa-existente-1" for p in del_data["placas"])

    # Deleting again should return 404
    del_res_404 = client.delete("/api/optica-vortix/placas/placa-existente-1", headers=get_auth_headers())
    assert del_res_404.status_code == 404

