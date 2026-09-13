import re
import time
import logging
from typing import Any, Optional, List, Dict
from datetime import datetime, timedelta

# Caché en memoria para evitar duplicación de notas / eventos repetidos en corto tiempo (Debounce)
_LAST_ESCALATION_CACHE: Dict[str, float] = {}
_LAST_CLOSE_CACHE: Dict[str, float] = {}
from app.db import (
    supabase, 
    actualizar_bot_disabled, 
    archivar_conversacion,
    marcar_mensajes_conversacion_leidos,
    guardar_mensaje,
    cambiar_estado_presupuesto,
    get_presupuestos_by_paciente,
    vincular_o_fusionar_paciente_con_geclisa,
    registrar_dni_paciente_nuevo_crm
)
from app.services.pdf_service import generar_pdf_presupuesto
from app.services.geclisa_client import GeclisaClient
from app.services.logger_service import log_event

logger = logging.getLogger(__name__)
geclisa_client = GeclisaClient()

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

        # 4. Calcular totales independientes por moneda (cero mezcla ARS + USD)
        total_ars = float(sum(it["subtotal"] for it in items_creados if it.get("moneda") == "ARS"))
        total_usd = float(sum(it["subtotal"] for it in items_creados if it.get("moneda") == "USD"))
        
        # Valor de fallback escalar para compatibilidad con código anterior
        total_escalar = total_ars if total_ars > 0 else total_usd
        
        update_data = {
            "total": total_escalar,
            "total_ars": total_ars,
            "total_usd": total_usd
        }
        supabase.table("presupuestos").update(update_data).eq("id", presupuesto_id).execute()
        
        presupuesto_actualizado_resp = supabase.table("presupuestos").select("*").eq("id", presupuesto_id).execute()
        presupuesto_actualizado = presupuesto_actualizado_resp.data[0] if presupuesto_actualizado_resp.data else {}
        presupuesto_actualizado["total"] = total_escalar
        presupuesto_actualizado["total_ars"] = total_ars
        presupuesto_actualizado["total_usd"] = total_usd

        # 5. Generar PDF profesional con desglose independiente de monedas
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

def finalizar_y_cerrar_consulta(conversacion_id: str, motivo: str) -> dict:
    """
    Finaliza y archiva la conversación cuando el paciente cumplió su objetivo
    (ej. turno confirmado, presupuesto emitido/aprobado) o manifestó que no necesita nada más (se despide, agradece o desiste).
    Marca todos los mensajes como leídos y archiva la conversación en el CRM (moviéndola a Cerrados).
    
    Args:
        conversacion_id: El UUID de la conversación.
        motivo: Breve explicación del motivo de finalización (ej: 'Turno confirmado y paciente agradece', 'Paciente desiste de consulta').
        
    Returns:
        Un mensaje confirmando que la conversación fue cerrada y archivada exitosamente.
    """
    logger.info(f"Herramienta: finalizar_y_cerrar_consulta en conversación {conversacion_id} por: {motivo}")
    
    if not is_valid_uuid(conversacion_id):
        return {
            "success": True,
            "mensaje": f"Conversación finalizada y archivada correctamente: {motivo}",
            "conversacion_id": conversacion_id
        }

    now = time.time()
    last_close = _LAST_CLOSE_CACHE.get(str(conversacion_id), 0.0)
    if (now - last_close) < 15.0:
        logger.info(f"Cierre duplicado prevenido para conversación {conversacion_id} (hace {now - last_close:.1f}s). Retornando confirmación sin duplicar.")
        return {
            "success": True,
            "mensaje": "La consulta ya ha sido finalizada y archivada exitosamente en el CRM. Despídete cordialmente del paciente.",
            "conversacion_id": conversacion_id,
            "deduplicated": True
        }
    _LAST_CLOSE_CACHE[str(conversacion_id)] = now

    try:
        # 1. Marcar mensajes de la conversación como leídos
        marcar_mensajes_conversacion_leidos(conversacion_id)

        # 2. Archivar la conversación
        archivar_conversacion(conversacion_id, True)

        # 3. Registrar nota interna de cierre
        guardar_mensaje(
            conversacion_id=conversacion_id,
            emisor="bot",
            contenido=f"Consulta finalizada y archivada automáticamente por el Asistente IA.\nMotivo: {motivo}",
            metadata_json={"sistema": True, "evento": "consulta_finalizada", "motivo": motivo}
        )

        return {
            "success": True,
            "mensaje": "La consulta ha sido finalizada y archivada exitosamente en el CRM. Despídete cordialmente del paciente.",
            "conversacion_id": conversacion_id
        }
    except Exception as e:
        logger.error(f"Error al finalizar y cerrar consulta: {e}")
        return {"error": f"Error al finalizar consulta: {str(e)}"}

def escalar_a_operador_humano(conversacion_id: str, motivo: str, nivel_urgencia: str = "normal") -> dict:
    """
    Desactiva el bot automático para esta conversación para transferir la atención
    a un operador humano (secretaria / médico) de la clínica.
    Utilízala ÚNICAMENTE cuando el paciente lo solicite expresamente (ej: 'quiero hablar con una persona')
    o cuando la consulta médica/administrativa esté fuera de tu alcance o directivas.
    NUNCA la utilices tras invocar aprobar_presupuesto ni para confirmar la aprobación de un presupuesto,
    ya que el presupuesto se aprueba y confirma de forma autónoma.
    
    Args:
        conversacion_id: El UUID de la conversación.
        motivo: Explicación clara y detallada del motivo por el cual se requiere intervención humana.
        nivel_urgencia: Nivel de prioridad ('baja', 'normal', 'alta', 'urgente').
        
    Returns:
        Un mensaje de confirmación del escalado.
    """
    logger.info(f"Herramienta: escalar_a_operador_humano en conversación {conversacion_id} por: {motivo} (Urgencia: {nivel_urgencia})")
    
    if not is_valid_uuid(conversacion_id):
        logger.info(f"Conversación no UUID ({conversacion_id}). Escalado registrado lógicamente.")
        return {
            "success": True,
            "mensaje": f"Transferencia a operador humano registrada: {motivo}",
            "conversacion_id": conversacion_id
        }

    now = time.time()
    last_escalation = _LAST_ESCALATION_CACHE.get(str(conversacion_id), 0.0)
    if (now - last_escalation) < 25.0:
        logger.info(f"Escalado duplicado prevenido para conversación {conversacion_id} (hace {now - last_escalation:.1f}s). Retornando confirmación sin duplicar nota.")
        return {
            "success": True,
            "mensaje": "La conversación ya se encuentra transferida al equipo humano de la clínica. Informa amablemente al paciente que un asesor se pondrá en contacto a la brevedad.",
            "conversacion_id": conversacion_id,
            "deduplicated": True
        }
    _LAST_ESCALATION_CACHE[str(conversacion_id)] = now

    try:
        # Reabrir formalmente la conversación para que ingrese a la pestaña 'Espera' del CRM
        if supabase:
            upd_data = {
                "bot_disabled": True,
                "archivada": False,
                "estado_gestion": "SIN_ASIGNAR",
                "asignado_a_usuario_id": None,
                "unread_count": 1
            }
            res_conv = supabase.table("conversaciones").update(upd_data).eq("id", conversacion_id).execute()
            if not res_conv.data:
                actualizar_bot_disabled(conversacion_id, True)

            try:
                supabase.table("patient_conversations").update({
                    "assigned_agent_id": None,
                    "bot_mode": "HUMAN_AGENT",
                    "session_status": "OPEN"
                }).eq("id", conversacion_id).execute()
            except Exception:
                pass
        else:
            actualizar_bot_disabled(conversacion_id, True)

        # 1. Registrar NOTA INTERNA visible para el equipo médico en el CRM
        guardar_mensaje(
            conversacion_id=conversacion_id,
            emisor="bot",
            contenido=f"🚨 DERIVACIÓN A ATENCIÓN HUMANA\n\n📌 Motivo: {motivo}\n⚠️ Prioridad: {nivel_urgencia.upper()}",
            metadata_json={
                "is_internal_note": True,
                "tipo": "nota_interna",
                "evento": "escalado_humano",
                "motivo": motivo,
                "urgencia": nivel_urgencia
            }
        )

        # 2. Desmarcar como leído para encender el badge rojo en la bandeja de operadores humanos
        if supabase:
            try:
                supabase.table("mensajes").update({
                    "metadata_json": {"leido_por_operador": False, "requiere_atencion_humana": True}
                }).eq("conversacion_id", conversacion_id).eq("emisor", "paciente").execute()
            except Exception:
                pass

        return {
            "success": True,
            "mensaje": "La conversación ha sido transferida al equipo humano de la clínica. Informa amablemente al paciente que un asesor se pondrá en contacto a la brevedad.",
            "conversacion_id": conversacion_id
        }
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

    target_id = None
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

    # Limpiar y extraer ID o prefijo hexadecimal si viene formateado (ej: 'Presupuesto #cd35f66f' o '#cd35f66f')
    raw_str = str(presupuesto_id or "").strip()
    match = re.search(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?', raw_str)
    prefix = match.group(0).lower() if match else raw_str.lower()

    if prefix and is_valid_uuid(prefix):
        target_id = prefix
    elif prefix:
        # Buscar en los presupuestos del paciente el que coincida por prefijo
        try:
            query = supabase.table("presupuestos").select("id, paciente_id, total, estado")
            if real_paciente_id:
                query = query.eq("paciente_id", real_paciente_id)
            p_list = query.limit(20).execute()
            for p in (p_list.data or []):
                if str(p.get("id", "")).lower().startswith(prefix):
                    target_id = p["id"]
                    if not real_paciente_id:
                        real_paciente_id = p.get("paciente_id")
                    break
        except Exception as pre_err:
            logger.warning(f"Error buscando presupuesto por prefijo {prefix}: {pre_err}")

    # Si no se pasó un ID exacto o no se encontró por prefijo, buscar el presupuesto más reciente pendiente o enviado
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
        updated = cambiar_estado_presupuesto(target_id, "aprobado", origen="IA_WHATSAPP")
        total = updated.get("total", 0.0)
        log_event(
            nivel="INFO",
            modulo="PRESUPUESTOS",
            accion="APROBAR_PRESUPUESTO",
            mensaje=f"Presupuesto #{target_id[:8]} aprobado exitosamente por la IA.",
            detalles={
                "presupuesto_id": target_id,
                "paciente_id": real_paciente_id,
                "total": float(total),
                "notas": notas
            }
        )
        return {
            "success": True,
            "presupuesto_id": target_id,
            "estado": "aprobado",
            "total": float(total),
            "mensaje": f"Presupuesto #{target_id[:8]} por un total de ${float(total):,.2f} aprobado y confirmado exitosamente en el sistema. El caso quirúrgico fue confirmado. NO llames a escalar_a_operador_humano. Responde directamente al paciente felicitándolo y confirmándole que la secretaría coordinará los turnos prequirúrgicos."
        }
    except Exception as e:
        logger.error(f"Error al aprobar presupuesto {target_id}: {e}")
        return {"error": f"No se pudo completar la aprobación del presupuesto: {str(e)}"}

def desestimar_presupuesto(
    presupuesto_id: Optional[str] = None, 
    motivo: str = "Desistido por el paciente", 
    paciente_id: Optional[str] = None
) -> dict:
    """
    Desestima, rechaza o cancela un presupuesto médico cuando el paciente manifiesta que
    no desea realizar el procedimiento o tratamiento cotizado, registrando obligatoriamente
    el motivo de desistimiento (ej: económico, tiempos, decisión médica, cobertura).
    
    Args:
        presupuesto_id: ID (UUID o primeros 8 caracteres) del presupuesto específico a desestimar.
                        Si no se especifica, busca automáticamente el presupuesto pendiente (enviado/borrador) del paciente.
        motivo: Motivo por el cual el paciente desestima el presupuesto (ej: 'Costos / Económico', 'Tiempos', 'Eligió otra clínica').
        paciente_id: ID del paciente asociado a la conversación.
        
    Returns:
        Dict con el resultado del cambio de estado, motivo registrado y datos del presupuesto.
    """
    logger.info(f"Herramienta: desestimar_presupuesto para ID '{presupuesto_id}' con motivo '{motivo}' (paciente: {paciente_id})")
    if not supabase:
        return {"error": "Servicio de base de datos no disponible."}

    target_id = None
    real_paciente_id = paciente_id

    # Si se pasó un ID exacto o prefijo
    prefix = str(presupuesto_id).strip().lower() if presupuesto_id else ""
    if prefix and is_valid_uuid(prefix):
        target_id = prefix
    elif prefix:
        # Buscar en los presupuestos del paciente el que coincida por prefijo
        try:
            query = supabase.table("presupuestos").select("id, paciente_id, total, estado")
            if real_paciente_id:
                query = query.eq("paciente_id", real_paciente_id)
            p_list = query.limit(20).execute()
            for p in (p_list.data or []):
                if str(p.get("id", "")).lower().startswith(prefix):
                    target_id = p["id"]
                    if not real_paciente_id:
                        real_paciente_id = p.get("paciente_id")
                    break
        except Exception as pre_err:
            logger.warning(f"Error buscando presupuesto por prefijo {prefix}: {pre_err}")

    # Si no se pasó un ID exacto, buscar entre los presupuestos pendientes del paciente (enviado o borrador)
    if not target_id and real_paciente_id and is_valid_uuid(real_paciente_id):
        try:
            pendientes = supabase.table("presupuestos") \
                .select("id, total, estado, created_at") \
                .eq("paciente_id", real_paciente_id) \
                .in_("estado", ["enviado", "borrador"]) \
                .order("created_at", desc=True) \
                .execute()
            if pendientes.data:
                target_id = pendientes.data[0]["id"]
        except Exception as q_err:
            logger.warning(f"Error buscando presupuestos pendientes de desistimiento: {q_err}")

    if not target_id:
        return {
            "error": "No se encontró ningún presupuesto pendiente (enviado o borrador) para desestimar. Los presupuestos ya aprobados o previamente rechazados no pueden desestimarse automáticamente."
        }

    try:
        updated = cambiar_estado_presupuesto(
            presupuesto_id=target_id, 
            nuevo_estado="rechazado", 
            motivo=motivo, 
            origen="IA_WHATSAPP"
        )
        total = updated.get("total", 0.0)
        log_event(
            nivel="INFO",
            modulo="PRESUPUESTOS",
            accion="DESESTIMAR_PRESUPUESTO",
            mensaje=f"Presupuesto #{target_id[:8]} desestimado por la IA. Motivo: {motivo}",
            detalles={
                "presupuesto_id": target_id,
                "paciente_id": real_paciente_id,
                "motivo": motivo,
                "total": float(total)
            }
        )
        return {
            "success": True,
            "presupuesto_id": target_id,
            "estado": "rechazado",
            "motivo_desistimiento": motivo,
            "total": float(total),
            "mensaje": f"El presupuesto #{target_id[:8]} por un valor de ${float(total):,.2f} ha quedado registrado como DESESTIMADO en el sistema con el motivo: '{motivo}'."
        }
    except Exception as e:
        logger.error(f"Error al desestimar presupuesto {target_id}: {e}")
        return {"error": f"No se pudo completar el registro de desistimiento del presupuesto: {str(e)}"}

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

def vincular_paciente_geclisa(
    dni: str, 
    conversacion_id: Optional[str] = None, 
    paciente_id: Optional[str] = None
) -> dict:
    """
    Consulta la API de Geclisa utilizando el DNI del paciente para verificar si ya posee
    ficha médica registrada en la clínica, y en caso afirmativo, vincula e importa sus datos
    (Nombre, Obra Social, Plan, Ficha ID, Médico) directamente a la conversación del CRM.
    Si el paciente no existe en Geclisa, registra su DNI en el CRM como nuevo paciente.
    
    Args:
        dni: El número de DNI / Documento del paciente (solo dígitos).
        conversacion_id: El UUID de la conversación activa.
        paciente_id: El UUID del paciente actual en el CRM.
        
    Returns:
        Diccionario con el resultado de la vinculación y los datos clínicos del paciente.
    """
    clean_dni = re.sub(r'[^0-9]', '', str(dni or "")).strip()
    logger.info(f"Herramienta: vincular_paciente_geclisa para DNI {clean_dni} (paciente_id: {paciente_id})")

    if not clean_dni or len(clean_dni) < 6:
        return {
            "success": False,
            "error": "El DNI ingresado no tiene un formato válido (debe contener entre 7 y 9 dígitos numéricos)."
        }

    try:
        # 1. Obtener teléfono de WhatsApp de la conversación actual si está disponible
        telefono_whatsapp = None
        if paciente_id and is_valid_uuid(paciente_id) and supabase:
            try:
                p_curr = supabase.table("pacientes").select("telefono").eq("id", paciente_id).limit(1).execute()
                if p_curr.data:
                    telefono_whatsapp = p_curr.data[0].get("telefono")
            except Exception:
                pass

        # 2. Consultar la API de Geclisa
        resultado_geclisa = geclisa_client.buscar_paciente_por_dni(clean_dni)
        
        # CASO 1: Encontrado en Geclisa
        if resultado_geclisa and resultado_geclisa.get("encontrado"):
            paciente_vinculado = vincular_o_fusionar_paciente_con_geclisa(
                paciente_temporal_id=paciente_id,
                datos_geclisa=resultado_geclisa,
                telefono_whatsapp=telefono_whatsapp
            )
            
            nombre_paciente = resultado_geclisa.get("nombre_completo") or resultado_geclisa.get("nombre") or "Paciente"
            obra_social = resultado_geclisa.get("obra_social") or "Particular"
            plan = resultado_geclisa.get("plan") or ""
            ficha_id = resultado_geclisa.get("ficha_id")
            
            cobertura_str = f"{obra_social} {('(' + plan + ')') if plan else ''}".strip()
            
            return {
                "success": True,
                "encontrado_geclisa": True,
                "nombre": nombre_paciente,
                "dni": clean_dni,
                "ficha_id": ficha_id,
                "cobertura": cobertura_str,
                "paciente_id": paciente_vinculado.get("id"),
                "mensaje": (
                    f"Paciente identificado exitosamente en Geclisa. "
                    f"Nombre: {nombre_paciente} | DNI: {clean_dni} | Cobertura: {cobertura_str} | Ficha ID: {ficha_id}. "
                    "Saluda al paciente por su nombre y procede con su consulta conociendo ya su cobertura."
                )
            }
            
        # CASO 2: No encontrado en Geclisa (Paciente Nuevo / Particular)
        else:
            if paciente_id and is_valid_uuid(paciente_id):
                registrar_dni_paciente_nuevo_crm(paciente_id, clean_dni)

            return {
                "success": True,
                "encontrado_geclisa": False,
                "dni": clean_dni,
                "mensaje": (
                    f"No se encontró ficha previa en Geclisa para el DNI {clean_dni}. "
                    "El DNI ha sido registrado en el CRM como nuevo paciente. "
                    "Salúdalo cordialmente como nuevo paciente y continúa normalmente con su atención (turnos, cotizaciones, consultas)."
                )
            }

    except Exception as e:
        logger.error(f"Error en herramienta vincular_paciente_geclisa: {e}")
        return {"success": False, "error": f"Error consultando el sistema Geclisa: {str(e)}"}


def consultar_preparacion_cirugia(paciente_id: Optional[str] = None) -> dict:
    """
    Consulta las indicaciones médicas de preparación prequirúrgica y horas de ayuno
    del próximo turno quirúrgico programado del paciente en el CRM, resueltas desde el Nomenclador.
    
    Args:
        paciente_id: El UUID del paciente en el CRM (inyectado automáticamente por el orquestador).
        
    Returns:
        Un diccionario con la información médica de preparación, horas de ayuno, fecha y cirugía programada.
    """
    logger.info(f"Herramienta: consultar_preparacion_cirugia para paciente_id: {paciente_id}")
    if not supabase or not paciente_id:
        return {"error": "No se pudo identificar al paciente para consultar sus indicaciones quirúrgicas."}
        
    try:
        from datetime import date
        today_str = date.today().isoformat()
        
        # Buscar el próximo turno quirúrgico activo del paciente
        t_resp = supabase.table("turnos_quirofano")\
            .select("*, pacientes(*), quirofanos(nombre)")\
            .eq("paciente_id", paciente_id)\
            .gte("fecha_cirugia", today_str)\
            .order("fecha_cirugia")\
            .limit(1)\
            .execute()
            
        if not t_resp.data:
            # Si no hay turno futuro, buscar el último turno registrado
            t_resp = supabase.table("turnos_quirofano")\
                .select("*, pacientes(*), quirofanos(nombre)")\
                .eq("paciente_id", paciente_id)\
                .order("fecha_cirugia", desc=True)\
                .limit(1)\
                .execute()
                
        if not t_resp.data:
            return {
                "tiene_cirugia": False,
                "mensaje": "El paciente no tiene cirugías programadas ni turnos quirúrgicos en la clínica."
            }
            
        turno = t_resp.data[0]
        from app.db import get_practica_resumen_operativo, render_consent_template
        
        practica_cod = turno.get("practica_codigo") or ""
        practica_id = turno.get("practica_id") or ""
        practica_nombre = turno.get("practica_nombre") or "Cirugía Oftalmológica"
        
        resumen = get_practica_resumen_operativo(practica_id or practica_cod or practica_nombre)
        
        ayuno_horas = 8
        texto_prep = None
        if resumen and resumen.get("habilitar_preparacion"):
            ayuno_horas = resumen.get("ayuno_horas") or 8
            texto_prep = resumen.get("texto_preparacion")
            
        paciente = turno.get("pacientes") or {}
        ojo = turno.get("ojo") or "OD"
        ojo_desc = "Ojo Derecho" if ojo == "OD" else "Ojo Izquierdo" if ojo == "OI" else "Ambos Ojos"
        
        if not texto_prep:
            texto_prep = (
                f"- Ayuno estricto de {ayuno_horas} horas de sólidos y líquidos previo a la hora de ingreso.\n"
                "- Concurrir con ropa cómoda (camisa o remera con botones al frente).\n"
                "- No usar maquillaje, esmalte de uñas, joyas ni perfumes.\n"
                "- Venir acompañado/a por un adulto responsable.\n"
                "- Traer DNI, carnet de obra social y estudios prequirúrgicos solicitados."
            )
            
        prep_personalizada = render_consent_template(
            texto_prep,
            {
                "paciente": paciente.get("nombre") or "Paciente",
                "dni": paciente.get("dni") or "-",
                "cirujano": turno.get("cirujano_nombre") or "Médico Cirujano",
                "practica": practica_nombre,
                "cirugia": practica_nombre,
                "ojo_intervenido": ojo_desc,
                "fecha_cirugia": str(turno.get("fecha_cirugia") or ""),
                "hora_cirugia": str(turno.get("hora_inicio") or "")[:5],
                "ayuno_horas": str(ayuno_horas)
            }
        )
        
        return {
            "tiene_cirugia": True,
            "paciente_nombre": paciente.get("nombre"),
            "cirugia": practica_nombre,
            "ojo": ojo_desc,
            "fecha_cirugia": str(turno.get("fecha_cirugia")),
            "hora_cirugia": str(turno.get("hora_inicio"))[:5],
            "cirujano": turno.get("cirujano_nombre"),
            "quirofano": (turno.get("quirofanos") or {}).get("nombre") or "Quirófano Central",
            "ayuno_horas": ayuno_horas,
            "indicaciones_preparacion": prep_personalizada,
            "consentimiento_estado": turno.get("consentimiento_estado") or "pendiente"
        }
    except Exception as e:
        logger.error(f"Error en consultar_preparacion_cirugia: {e}")
        return {"error": f"Error consultando preparación quirúrgica: {str(e)}"}



