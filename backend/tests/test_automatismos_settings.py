import pytest
from app.db import (
    get_configuracion_automatismos,
    actualizar_configuracion_automatismos,
    get_configuracion_quirurgica
)
from app.main import ejecutar_envio_automatico_consentimientos_anticipados

def test_configuracion_automatismos_get_y_update(monkeypatch):
    """
    Verifica que la configuración de automatismos recupere valores por defecto y
    se actualice correctamente, sincronizando seguimiento con el módulo quirúrgico.
    """
    cfg = get_configuracion_automatismos()
    assert isinstance(cfg, dict)
    assert "seguimiento_quirurgico_activo" in cfg
    assert "consentimiento_anticipado_activo" in cfg
    assert "bot_gemini_activo" in cfg
    assert "purga_multimedia_activa" in cfg

    # Simular actualización
    actualizado = actualizar_configuracion_automatismos({
        "consentimiento_anticipado_activo": False,
        "seguimiento_quirurgico_activo": False,
        "consentimiento_respetar_ventana_meta": True
    })

    assert actualizado["consentimiento_anticipado_activo"] is False
    assert actualizado["seguimiento_quirurgico_activo"] is False
    assert actualizado["consentimiento_respetar_ventana_meta"] is True

    # Verificar sincronización con quirúrgico
    cq = get_configuracion_quirurgica()
    assert cq.get("seguimiento_automatizado_activo") is False

@pytest.mark.asyncio
async def test_cron_consentimientos_pausado_cuando_inactivo(monkeypatch):
    """
    Verifica que ejecutar_envio_automatico_consentimientos_anticipados aborte y retorne 0
    si consentimiento_anticipado_activo está en False.
    """
    # Forzar que esté desactivado
    actualizar_configuracion_automatismos({
        "consentimiento_anticipado_activo": False
    })

    enviados = await ejecutar_envio_automatico_consentimientos_anticipados()
    assert enviados == 0, "No debe enviar consentimientos si el automatismo está pausado en el Centro de Automatismos."
