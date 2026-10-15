import pytest
from app import db
from app.main import ejecutar_envio_automatico_consentimientos_anticipados

def test_configuracion_automatismos_get_y_update(monkeypatch):
    """
    Verifica que la configuración de automatismos recupere valores por defecto y
    se actualice correctamente, sincronizando seguimiento con el módulo quirúrgico.
    """
    # Simular estado quirúrgico en memoria para pruebas unitarias herméticas (sin depender de Supabase real)
    estado_quirurgico = {"id": "default", "seguimiento_automatizado_activo": True}
    monkeypatch.setattr("app.db.actualizar_configuracion_quirurgica", lambda payload: estado_quirurgico.update(payload) or estado_quirurgico)
    monkeypatch.setattr("app.db.get_configuracion_quirurgica", lambda: estado_quirurgico)

    cfg = db.get_configuracion_automatismos()
    assert isinstance(cfg, dict)
    assert "seguimiento_quirurgico_activo" in cfg
    assert "consentimiento_anticipado_activo" in cfg
    assert "bot_gemini_activo" in cfg
    assert "purga_multimedia_activa" in cfg

    # Simular actualización
    actualizado = db.actualizar_configuracion_automatismos({
        "consentimiento_anticipado_activo": False,
        "seguimiento_quirurgico_activo": False,
        "consentimiento_respetar_ventana_meta": True
    })

    assert actualizado["consentimiento_anticipado_activo"] is False
    assert actualizado["seguimiento_quirurgico_activo"] is False
    assert actualizado["consentimiento_respetar_ventana_meta"] is True

    # Verificar sincronización con quirúrgico
    cq = db.get_configuracion_quirurgica()
    assert cq.get("seguimiento_automatizado_activo") is False

@pytest.mark.asyncio
async def test_cron_consentimientos_pausado_cuando_inactivo(monkeypatch):
    """
    Verifica que ejecutar_envio_automatico_consentimientos_anticipados aborte y retorne 0
    si consentimiento_anticipado_activo está en False.
    """
    monkeypatch.setattr("app.db.get_configuracion_automatismos", lambda: {"consentimiento_anticipado_activo": False})

    enviados = await ejecutar_envio_automatico_consentimientos_anticipados()
    assert enviados == 0, "No debe enviar consentimientos si el automatismo está pausado en el Centro de Automatismos."
