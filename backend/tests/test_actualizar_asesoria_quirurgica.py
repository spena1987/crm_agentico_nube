import pytest
from unittest.mock import MagicMock, patch
from app.db import actualizar_asesoria_quirurgica

def test_actualizar_asesoria_quirurgica_persiste_todos_los_campos():
    """
    Verifica que actualizar_asesoria_quirurgica NO descarte practica_nombre,
    medico_cirujano_nombre, estado, ojo, fechas ni campos clínicos al actualizar en Supabase.
    """
    asesoria_id = "qx-26-0163-test"
    payload = {
        "practica_codigo": "34031",
        "practica_nombre": "Facoemulsificación con Implante de LIO",
        "medico_cirujano_id": 12,
        "medico_cirujano_nombre": "Dr. Juan Pérez",
        "medico_cirujano_matricula": "MN 12345",
        "medico_derivador_id": 5,
        "medico_derivador_nombre": "Dra. Ana López",
        "cobertura_obra_social": "OSDE 310",
        "estado": "en_analisis",
        "ojo": "OD",
        "situacion_paciente": "Paciente considerando fecha para noviembre",
        "fecha_probable_cirugia": "2026-11-15",
        "fecha_definitiva_cirugia": "",  # Vacío intencional para verificar sanitización a None
        "checklist_prequirurgico": {"_codigo_caso": "QX-26-0163", "estudios_completos": True},
        "monto_extra": 185000.5,
        "moneda_extra": "ars",
        "modalidad_bilateral": "escalonada"
    }

    with patch("app.db.supabase") as mock_sb:
        mock_table_asesorias = MagicMock()
        mock_update = MagicMock()
        mock_eq = MagicMock()
        
        # Simular retorno del UPDATE
        fila_actualizada = {
            "id": asesoria_id,
            "paciente_id": "pac-123",
            **payload,
            "fecha_definitiva_cirugia": None,
            "moneda_extra": "ARS",
            "updated_at": "2026-10-13T12:00:00Z"
        }
        mock_eq.execute.return_value = MagicMock(data=[fila_actualizada])
        mock_update.eq.return_value = mock_eq
        mock_table_asesorias.update.return_value = mock_update

        # Simular query de recarga full con select
        mock_select = MagicMock()
        mock_select_eq = MagicMock()
        mock_select_limit = MagicMock()
        mock_select_limit.execute.return_value = MagicMock(data=[{
            **fila_actualizada,
            "turnos_quirofano": []
        }])
        mock_select_eq.limit.return_value = mock_select_limit
        mock_select.eq.return_value = mock_select_eq
        mock_table_asesorias.select.return_value = mock_select

        # Mock para turnos_quirofano y configuracion_automatismos
        mock_table_turnos = MagicMock()
        mock_table_turnos.update.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(data=[])
        mock_table_turnos.select.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(data=[])

        def table_side_effect(tabla):
            if tabla == "asesorias_quirurgicas":
                return mock_table_asesorias
            elif tabla == "turnos_quirofano":
                return mock_table_turnos
            return MagicMock()

        mock_sb.table.side_effect = table_side_effect

        with patch("app.db.sincronizar_presupuesto_desde_caso_quirurgico"):
            with patch("app.db.get_configuracion_automatismos", return_value={"recontacto_humano_en_analisis_activo": False}):
                resultado = actualizar_asesoria_quirurgica(asesoria_id, payload)

        # 1. Comprobar que mock_table_asesorias.update fue llamado
        assert mock_table_asesorias.update.called
        datos_guardados = mock_table_asesorias.update.call_args[0][0]

        # 2. Verificar que los campos críticos están en los datos del UPDATE
        assert datos_guardados["practica_nombre"] == "Facoemulsificación con Implante de LIO"
        assert datos_guardados["practica_codigo"] == "34031"
        assert datos_guardados["medico_cirujano_nombre"] == "Dr. Juan Pérez"
        assert datos_guardados["medico_cirujano_id"] == 12
        assert datos_guardados["medico_derivador_nombre"] == "Dra. Ana López"
        assert datos_guardados["cobertura_obra_social"] == "OSDE 310"
        assert datos_guardados["estado"] == "en_analisis"
        assert datos_guardados["ojo"] == "OD"
        assert datos_guardados["situacion_paciente"] == "Paciente considerando fecha para noviembre"
        assert datos_guardados["fecha_probable_cirugia"] == "2026-11-15"
        assert datos_guardados["fecha_definitiva_cirugia"] is None  # Sanitizado desde ""
        assert datos_guardados["monto_extra"] == 185000.5
        assert datos_guardados["moneda_extra"] == "ARS"
        assert datos_guardados["modalidad_bilateral"] == "escalonada"
        assert isinstance(datos_guardados["checklist_prequirurgico"], dict)
        assert datos_guardados["updated_at"] == "now()"

        # 3. Comprobar resultado retornado
        assert resultado["practica_nombre"] == "Facoemulsificación con Implante de LIO"
        assert resultado["turnos_activos"] == []

def test_actualizar_asesoria_rechaza_practica_vacia_o_placeholder():
    """
    Verifica que no se permita persistir casos quirúrgicos sin práctica válida o con placeholders temporales.
    """
    with patch("app.db.supabase"):
        for placeholder in ["", "   ", "Nueva Cirugía / Procedimiento", "Práctica Quirúrgica a Determinar", "Cirugía / Procedimiento sin determinar"]:
            with pytest.raises(ValueError, match="La práctica quirúrgica es obligatoria"):
                actualizar_asesoria_quirurgica("qx-test", {"practica_nombre": placeholder})

def test_actualizar_asesoria_rechaza_medicos_vacios_o_placeholders():
    """
    Verifica que no se permita persistir casos quirúrgicos sin Médico Derivador ni Médico Cirujano válidos.
    """
    with patch("app.db.supabase"):
        for placeholder in ["", "   ", "Sin asignar", "a designar", "derivador sin asignar"]:
            with pytest.raises(ValueError, match="El Médico Derivador es obligatorio"):
                actualizar_asesoria_quirurgica("qx-test", {"medico_derivador_nombre": placeholder})

        for placeholder in ["", "   ", "Sin asignar", "Cirujano sin asignar", "a designar"]:
            with pytest.raises(ValueError, match="El Médico Cirujano \\(Qx\\) es obligatorio"):
                actualizar_asesoria_quirurgica("qx-test", {"medico_cirujano_nombre": placeholder})
