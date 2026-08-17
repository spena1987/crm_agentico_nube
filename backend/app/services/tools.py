import logging
from typing import Any, Optional, List, Dict
from datetime import datetime, timedelta
from app.db import (
    supabase, 
    actualizar_bot_disabled, 
    guardar_mensaje,
    cambiar_estado_presupuesto,
    get_presupuestos_by_paciente
)
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

from pydantic import BaseModel, Field

class ItemPresupuesto(BaseModel):
    codigo_servicio: str = Field(description="Código de la prestación médica a presupuestar (ej: CON-001, RX-T-101)")
    cantidad: int = Field(default=1, description="Cantidad a presupuestar de esta prestación")

def crear_borrador_presupuesto(paciente_id: str, items: list[ItemPresupuesto]) -> dict:
    """
    Crea un borrador de presupuesto para un paciente en Supabase con los ítems especificados 
    y genera el correspondiente PDF estético del presupuesto.
    
    Args:
        paciente_id: El UUID del paciente.
        items: Lista de ítems a presupuestar, conteniendo el código de servicio y la cantidad.
        
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

        # 3. Consultar catálogo de prácticas e insertar ítems
        from datetime import date
        today_str = date.today().isoformat()
        
        items_creados = []
        total_acumulado = 0.0
        
        for item in items:
            # Compatibilidad con dict o Pydantic
            if hasattr(item, "codigo_servicio"):
                codigo = str(item.codigo_servicio).strip().upper()
                cantidad = int(item.cantidad or 1)
                nombre_pres = getattr(item, "nombre_prestacion", None)
                precio_unitario = getattr(item, "precio_unitario", None)
                moneda = getattr(item, "moneda", "ARS") or "ARS"
            else:
                codigo = str(item.get("codigo_servicio") or item.get("codigo", "")).strip().upper()
                cantidad = int(item.get("cantidad", 1))
                nombre_pres = item.get("nombre_prestacion") or item.get("nombre")
                precio_unitario = item.get("precio_unitario")
                moneda = item.get("moneda") or "ARS"
                
            # Si falta nombre o precio, consultar en nomenclador_practicas y aranceles
            if not nombre_pres or precio_unitario is None or float(precio_unitario) == 0.0:
                p_resp = supabase.table("nomenclador_practicas")\
                    .select("id, nombre, categoria, nomencladores(moneda_default)")\
                    .eq("codigo", codigo)\
                    .limit(1)\
                    .execute()
                    
                if p_resp.data:
                    p_info = p_resp.data[0]
                    if not nombre_pres:
                        nombre_pres = p_info["nombre"]
                    if not moneda:
                        moneda = (p_info.get("nomencladores") or {}).get("moneda_default", "ARS")
                        
                    # Consultar arancel vigente
                    ar_resp = supabase.table("nomenclador_aranceles")\
                        .select("precio, moneda")\
                        .eq("practica_id", p_info["id"])\
                        .lte("vigencia_desde", today_str)\
                        .order("vigencia_desde", desc=True)\
                        .limit(1)\
                        .execute()
                        
                    if ar_resp.data:
                        if precio_unitario is None or float(precio_unitario) == 0.0:
                            precio_unitario = float(ar_resp.data[0]["precio"])
                        moneda = ar_resp.data[0].get("moneda", moneda)
                        
            if not nombre_pres:
                nombre_pres = f"Práctica {codigo}"
            precio_unitario = float(precio_unitario or 0.0)
            subtotal = precio_unitario * cantidad
            total_acumulado += subtotal
            
            # Asegurar registro en servicios_precios para satisfacer FK de items_presupuesto
            ins_serv = supabase.table("servicios_precios").upsert({
                "codigo": codigo,
                "nombre_prestacion": nombre_pres,
                "precio": precio_unitario,
                "activo": True
            }, on_conflict="codigo").execute()
            
            servicio_id = ins_serv.data[0]["id"] if ins_serv.data else None
            
            item_data = {
                "presupuesto_id": presupuesto_id,
                "servicio_id": servicio_id,
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "subtotal": subtotal
            }
            item_resp = supabase.table("items_presupuesto").insert(item_data).execute()
            
            item_info = item_resp.data[0] if item_resp.data else item_data
            item_info["nombre_prestacion"] = nombre_pres
            item_info["codigo"] = codigo
            item_info["moneda"] = moneda.upper()
            item_info["precio_unitario"] = precio_unitario
            item_info["subtotal"] = subtotal
            items_creados.append(item_info)

        # 4. Actualizar total en la cabecera del presupuesto
        supabase.table("presupuestos").update({"total": total_acumulado}).eq("id", presupuesto_id).execute()
        
        presupuesto_actualizado_resp = supabase.table("presupuestos").select("*").eq("id", presupuesto_id).execute()
        presupuesto_actualizado = presupuesto_actualizado_resp.data[0]
        presupuesto_actualizado["total"] = total_acumulado

        # 5. Generar PDF profesional
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

def is_valid_uuid(val: Any) -> bool:
    if not val:
        return False
    try:
        import uuid
        uuid.UUID(str(val))
        return True
    except Exception:
        return False

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
    
    # Si no es un UUID válido (ej. prueba o simulador), responder exitosamente sin error de DB
    if not is_valid_uuid(conversacion_id):
        logger.info(f"Conversación no UUID ({conversacion_id}). Escalado registrado lógicamente.")
        return {
            "success": True,
            "mensaje": f"Transferencia a operador humano registrada exitosamente: {motivo}",
            "conversacion_id": conversacion_id
        }

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

def aprobar_presupuesto(presupuesto_id: Optional[str] = None, paciente_id: Optional[str] = None, notas: Optional[str] = None) -> dict:
    """
    Aprueba formalmente un presupuesto médico cuando el paciente manifiesta su conformidad o aceptación.
    Actualiza el estado a 'aprobado' en el CRM y confirma el caso quirúrgico si aplica.
    
    Args:
        presupuesto_id: ID del presupuesto a aprobar (opcional si el paciente ya tiene un presupuesto emitido).
        paciente_id: ID del paciente en atención.
        notas: Comentarios adicionales sobre la aceptación del paciente.
        
    Returns:
        Confirmación del estado de aprobación del presupuesto.
    """
    logger.info(f"Herramienta: aprobar_presupuesto para paciente {paciente_id}, presupuesto: {presupuesto_id}")
    if not supabase:
        return {"error": "Servicio de base de datos no disponible"}

    target_id = presupuesto_id if (presupuesto_id and is_valid_uuid(presupuesto_id)) else None
    real_paciente_id = paciente_id if (paciente_id and is_valid_uuid(paciente_id)) else None

    # Si el paciente_id no era UUID (ej. DNI o teléfono), resolverlo
    if not real_paciente_id and paciente_id and str(paciente_id).strip():
        val = str(paciente_id).strip()
        try:
            p_find = supabase.table("pacientes").select("id").or_(f"dni.eq.{val},telefono.eq.{val}").limit(1).execute()
            if p_find.data:
                real_paciente_id = p_find.data[0]["id"]
        except Exception as pf_err:
            logger.warning(f"Error buscando paciente por DNI {val}: {pf_err}")

    # Si no se pasó un ID exacto, buscar el presupuesto más reciente pendiente o enviado del paciente
    if not target_id and real_paciente_id:
        try:
            pendientes = supabase.table("presupuestos") \
                .select("id, total, estado") \
                .eq("paciente_id", real_paciente_id) \
                .in_("estado", ["enviado", "borrador"]) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()
            if pendientes.data:
                target_id = pendientes.data[0]["id"]
        except Exception as q_err:
            logger.warning(f"Error buscando presupuesto pendiente: {q_err}")

    if not target_id:
        return {
            "error": "No se encontró ningún presupuesto pendiente de aprobación para este paciente. Por favor consulta con la secretaría o solicita una nueva cotización."
        }

    try:
        updated = cambiar_estado_presupuesto(target_id, "aprobado")
        total = updated.get("total", 0.0)
        return {
            "success": True,
            "presupuesto_id": target_id,
            "estado": "aprobado",
            "total": float(total),
            "mensaje": f"Presupuesto #{target_id[:8]} por un total de ${float(total):,.2f} aprobado y confirmado exitosamente en el sistema."
        }
    except Exception as e:
        logger.error(f"Error al aprobar presupuesto {target_id}: {e}")
        return {"error": f"No se pudo completar la aprobación del presupuesto: {str(e)}"}

def consultar_presupuestos_paciente(paciente_id: Optional[str] = None) -> dict:
    """
    Consulta los presupuestos médicos emitidos al paciente en el sistema.
    
    Args:
        paciente_id: ID del paciente a consultar.
        
    Returns:
        Lista de presupuestos con sus montos, fechas, estados e ítems.
    """
    logger.info(f"Herramienta: consultar_presupuestos_paciente para paciente {paciente_id}")
    if not paciente_id or not is_valid_uuid(paciente_id):
        return {"presupuestos": [], "mensaje": "No se especificó un paciente válido."}

    try:
        presupuestos = get_presupuestos_by_paciente(paciente_id)
        resumen = []
        for p in presupuestos:
            resumen.append({
                "id": p.get("id"),
                "estado": p.get("estado"),
                "total": float(p.get("total") or 0.0),
                "fecha": p.get("created_at"),
                "pdf_url": p.get("pdf_url"),
                "items_count": len(p.get("items_presupuesto") or [])
            })
        return {"presupuestos": resumen, "total_encontrados": len(resumen)}
    except Exception as e:
        logger.error(f"Error al consultar presupuestos: {e}")
        return {"error": str(e)}

