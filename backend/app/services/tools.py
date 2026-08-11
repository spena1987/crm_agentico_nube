import logging
from datetime import datetime, timedelta
from app.db import supabase, actualizar_bot_disabled, guardar_mensaje
from app.services.pdf_service import generar_pdf_presupuesto

logger = logging.getLogger(__name__)

def buscar_disponibilidad_turnos(fecha_iso: str) -> dict:
    """
    Busca los turnos disponibles en la clínica para una fecha determinada.
    
    Args:
        fecha_iso: La fecha en formato ISO (YYYY-MM-DD), ej: '2026-08-15'.
        
    Returns:
        Un diccionario con la fecha y una lista de horarios de turnos disponibles.
    """
    logger.info(f"Herramienta: buscar_disponibilidad_turnos para la fecha {fecha_iso}")
    try:
        # Validar el formato de la fecha
        fecha = datetime.strptime(fecha_iso, "%Y-%m-%d")
    except ValueError:
        return {"error": "Formato de fecha inválido. Utilice el formato YYYY-MM-DD."}

    # No se agendan turnos los domingos (día 6)
    if fecha.weekday() == 6:
        return {"fecha": fecha_iso, "disponible": False, "mensaje": "La clínica permanece cerrada los domingos.", "turnos": []}

    # Generamos algunos turnos de ejemplo de manera dinámica para que la experiencia sea fluida e interactiva.
    # En producción esto consultaría una tabla de turnos libres.
    turnos_disponibles = ["09:00", "10:30", "11:00", "14:30", "16:00", "17:30"]
    
    return {
        "fecha": fecha_iso,
        "disponible": True,
        "turnos": turnos_disponibles,
        "mensaje": f"Hay {len(turnos_disponibles)} turnos disponibles para el {fecha_iso}."
    }

def crear_borrador_presupuesto(paciente_id: str, items: list) -> dict:
    """
    Crea un borrador de presupuesto para un paciente en Supabase con los ítems especificados 
    y genera el correspondiente PDF estético del presupuesto.
    
    Args:
        paciente_id: El UUID del paciente.
        items: Lista de diccionarios, donde cada ítem tiene 'codigo_servicio' (ej: 'CON-001') y 'cantidad' (ej: 1).
        
    Returns:
        Un diccionario con la información del presupuesto creado y la URL de su PDF.
    """
    logger.info(f"Herramienta: crear_borrador_presupuesto para paciente {paciente_id}")
    if not supabase:
        return {"error": "Base de datos no configurada."}
        
    try:
        # 1. Verificar si el paciente existe
        paciente_resp = supabase.table("pacientes").select("*").eq("id", paciente_id).execute()
        if not paciente_resp.data:
            return {"error": f"Paciente con ID {paciente_id} no encontrado."}
        paciente = paciente_resp.data[0]

        # 2. Insertar cabecera del presupuesto
        presupuesto_data = {
            "paciente_id": paciente_id,
            "estado": "borrador",
            "total": 0.00
        }
        presupuesto_resp = supabase.table("presupuestos").insert(presupuesto_data).execute()
        if not presupuesto_resp.data:
            return {"error": "No se pudo crear la cabecera del presupuesto."}
        presupuesto = presupuesto_resp.data[0]
        presupuesto_id = presupuesto["id"]

        # 3. Consultar servicios e insertar ítems
        items_creados = []
        for item in items:
            codigo = item.get("codigo_servicio")
            cantidad = item.get("cantidad", 1)
            
            # Buscar el servicio en el catálogo
            servicio_resp = supabase.table("servicios_precios").select("*").eq("codigo", codigo.upper()).execute()
            if not servicio_resp.data:
                return {"error": f"Servicio con código {codigo} no existe en el catálogo."}
            
            servicio = servicio_resp.data[0]
            precio_unitario = float(servicio["precio"])
            subtotal = precio_unitario * cantidad
            
            item_data = {
                "presupuesto_id": presupuesto_id,
                "servicio_id": servicio["id"],
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "subtotal": subtotal
            }
            item_resp = supabase.table("items_presupuesto").insert(item_data).execute()
            if item_resp.data:
                # Adjuntamos el nombre y código para generar el PDF
                item_info = item_resp.data[0]
                item_info["nombre_prestacion"] = servicio["nombre_prestacion"]
                item_info["codigo"] = servicio["codigo"]
                items_creados.append(item_info)

        # 4. Obtener el presupuesto actualizado (con el total recalculado por el trigger)
        presupuesto_actualizado_resp = supabase.table("presupuestos").select("*").eq("id", presupuesto_id).execute()
        presupuesto_actualizado = presupuesto_actualizado_resp.data[0]

        # 5. Generar PDF estético
        pdf_filename = generar_pdf_presupuesto(presupuesto_actualizado, paciente, items_creados)
        pdf_url = f"/static/{pdf_filename}"

        # 6. Actualizar url del PDF en base de datos
        supabase.table("presupuestos").update({"pdf_url": pdf_url}).eq("id", presupuesto_id).execute()
        
        presupuesto_actualizado["pdf_url"] = pdf_url
        presupuesto_actualizado["items"] = items_creados
        
        return {
            "success": True,
            "mensaje": "Presupuesto y PDF generados correctamente.",
            "presupuesto": presupuesto_actualizado
        }
        
    except Exception as e:
        logger.error(f"Error al crear borrador de presupuesto: {e}")
        return {"error": f"Error interno del servidor: {str(e)}"}

def escalar_a_operador_humano(conversacion_id: str, motivo: str) -> dict:
    """
    Desactiva el bot automático para esta conversación para permitir que un operador
    humano de la clínica tome el control y responda las dudas.
    
    Args:
        conversacion_id: El UUID de la conversación.
        motivo: Breve explicación de por qué se requiere intervención humana.
        
    Returns:
        Un mensaje de confirmación del escalado.
    """
    logger.info(f"Herramienta: escalar_a_operador_humano en conversación {conversacion_id} por: {motivo}")
    try:
        res = actualizar_bot_disabled(conversacion_id, True)
        if res:
            # Registrar un mensaje interno notificando el escalado
            guardar_mensaje(
                conversacion_id=conversacion_id,
                emisor="bot",
                contenido=f"[Sistema] Conversación transferida a operador humano. Motivo: {motivo}",
                metadata_json={"sistema": True, "evento": "escalado", "motivo": motivo}
            )
            return {
                "success": True,
                "mensaje": "La conversación ha sido transferida al equipo humano con éxito.",
                "conversacion_id": conversacion_id
            }
        return {"error": "Conversación no encontrada o no se pudo actualizar."}
    except Exception as e:
        logger.error(f"Error al escalar a humano: {e}")
        return {"error": f"Error al procesar escalado: {str(e)}"}
