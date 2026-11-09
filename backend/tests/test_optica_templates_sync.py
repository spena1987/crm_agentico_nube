import pytest
from app.routers.optica_vortix_router import _extraer_componentes_plantilla_meta


def test_extraer_componentes_plantilla_meta_completa():
    raw_components = [
        {
            "type": "HEADER",
            "format": "IMAGE",
            "example": {"header_handle": ["https://scontent.whatsapp.net/sample.png"]}
        },
        {
            "type": "BODY",
            "text": "Hola, {{1}}. Te contactamos de Óptica Vortix.",
            "example": {"body_text": [["Mariana"]]}
        },
        {
            "type": "FOOTER",
            "text": "Óptica Vortix • Responde BAJA para no recibir promos"
        },
        {
            "type": "BUTTONS",
            "buttons": [
                {"type": "QUICK_REPLY", "text": "Quiero más informacion"},
                {"type": "QUICK_REPLY", "text": "Contactar un asesor"}
            ]
        }
    ]

    res = _extraer_componentes_plantilla_meta(raw_components)

    assert res["header_type"] == "IMAGE"
    assert res["header_content"] is None
    assert "Hola, {{1}}" in res["body_text"]
    assert res["footer_text"] == "Óptica Vortix • Responde BAJA para no recibir promos"
    assert len(res["buttons"]) == 2
    assert res["buttons"][0]["text"] == "Quiero más informacion"
    assert res["buttons"][1]["text"] == "Contactar un asesor"


def test_extraer_componentes_plantilla_meta_vacia():
    res = _extraer_componentes_plantilla_meta([])
    assert res["header_type"] == "NONE"
    assert res["body_text"] == ""
    assert res["footer_text"] is None
    assert res["buttons"] == []
