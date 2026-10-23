import pytest
from unittest.mock import MagicMock, patch
from app.services.whatsapp_cloud.templates import update_template_governance, TemplateGovernanceUpdate, list_templates, update_template, TemplateUpdateRequest

@pytest.mark.asyncio
async def test_update_template_official_meta():
    with patch("app.services.whatsapp_cloud.templates.supabase") as mock_sb, \
         patch("app.services.whatsapp_cloud.templates.get_waba_credentials", return_value=("mock_waba_123", "mock_token_abc")), \
         patch("httpx.AsyncClient.post") as mock_post:

        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.limit.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[{
            "name": "apertura_conversacion",
            "meta_template_id": "meta_12345",
            "category": "UTILITY"
        }])

        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"id": "meta_12345", "status": "PENDING"},
            content=b'{"id": "meta_12345", "status": "PENDING"}'
        )

        req = TemplateUpdateRequest(
            body_text="Hola {{1}}, le escribimos para informarle de su turno.",
            category="UTILITY"
        )
        res = await update_template("apertura_conversacion", req)
        assert res["status"] == "success"
        assert res["meta_template_id"] == "meta_12345"
        assert res["template_status"] == "PENDING"

@pytest.mark.asyncio
async def test_template_governance_patch():
    with patch("app.services.whatsapp_cloud.templates.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[{
            "name": "apertura_conversacion",
            "activo": True,
            "visible_en_chat": True,
            "grupo_crm": "Atención General",
            "titulo_amigable": "Apertura de Conversación Oficial"
        }])

        update_data = TemplateGovernanceUpdate(
            activo=True,
            visible_en_chat=True,
            grupo_crm="Atención General",
            titulo_amigable="Apertura de Conversación Oficial"
        )
        res = await update_template_governance("apertura_conversacion", update_data)
        assert res["status"] == "success"
        assert res["data"]["name"] == "apertura_conversacion"
        assert res["data"]["visible_en_chat"] is True

@pytest.mark.asyncio
async def test_list_templates_filters():
    with patch("app.services.whatsapp_cloud.templates.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_query = MagicMock()
        mock_table.select.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[
            {"name": "apertura_conversacion", "status": "APPROVED", "activo": True, "visible_en_chat": True, "grupo_crm": "Atención General"}
        ])

        # Test con solo_chat=True
        res = await list_templates(solo_chat=True)
        assert res["status"] == "success"
        assert len(res["data"]) == 1
        assert res["data"][0]["name"] == "apertura_conversacion"
