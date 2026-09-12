import pytest
import uuid
from unittest.mock import patch, MagicMock
from app.services.tools import (
    escalar_a_operador_humano,
    finalizar_y_cerrar_consulta,
    _LAST_ESCALATION_CACHE,
    _LAST_CLOSE_CACHE
)
from app.agent import bind_tools_to_context, AVAILABLE_TOOLS_MAP

def test_escalar_a_operador_humano_idempotencia():
    conv_id = str(uuid.uuid4())
    _LAST_ESCALATION_CACHE.pop(conv_id, None)

    with patch("app.services.tools.supabase") as mock_supabase, \
         patch("app.services.tools.guardar_mensaje") as mock_guardar:
        
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": conv_id}])

        # Primera llamada: debe procesarse normalmente
        res1 = escalar_a_operador_humano(conversacion_id=conv_id, motivo="Paciente solicita asesor")
        assert res1["success"] is True
        assert res1.get("deduplicated") is not True
        assert mock_guardar.call_count == 1

        # Segunda llamada inmediata (dentro de la ventana de 25s): debe ser deduplicada
        res2 = escalar_a_operador_humano(conversacion_id=conv_id, motivo="Paciente solicita asesor (reintento)")
        assert res2["success"] is True
        assert res2.get("deduplicated") is True
        # No se debio haber llamado a guardar_mensaje una segunda vez
        assert mock_guardar.call_count == 1

def test_finalizar_y_cerrar_consulta_idempotencia():
    conv_id = str(uuid.uuid4())
    _LAST_CLOSE_CACHE.pop(conv_id, None)

    with patch("app.services.tools.marcar_mensajes_conversacion_leidos"), \
         patch("app.services.tools.archivar_conversacion"), \
         patch("app.services.tools.guardar_mensaje") as mock_guardar:

        # Primera llamada
        res1 = finalizar_y_cerrar_consulta(conversacion_id=conv_id, motivo="Trámite resuelto")
        assert res1["success"] is True
        assert res1.get("deduplicated") is not True
        assert mock_guardar.call_count == 1

        # Segunda llamada inmediata
        res2 = finalizar_y_cerrar_consulta(conversacion_id=conv_id, motivo="Trámite resuelto de nuevo")
        assert res2["success"] is True
        assert res2.get("deduplicated") is True
        assert mock_guardar.call_count == 1

def test_bind_tools_to_context_tracker():
    tracker = []
    conv_id = str(uuid.uuid4())
    
    tools = bind_tools_to_context(
        raw_tools_map=AVAILABLE_TOOLS_MAP,
        enabled_names=["escalar_a_operador_humano", "finalizar_y_cerrar_consulta"],
        conversacion_id=conv_id,
        tracker=tracker
    )
    
    assert len(tools) == 2
    
    # Encontrar la closure de escalar_a_operador_humano
    fn_escalar = next(t for t in tools if t.__name__ == "escalar_a_operador_humano")
    
    with patch("app.services.tools.supabase"), \
         patch("app.services.tools.guardar_mensaje"):
        fn_escalar(motivo="Prueba de tracker")
        
    assert "escalar_a_operador_humano" in tracker
