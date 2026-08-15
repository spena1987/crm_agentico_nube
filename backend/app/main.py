import os
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager

from app.db import (
    supabase, 
    actualizar_bot_disabled, 
    get_paciente_by_dni, 
    get_paciente_by_geclisa_id, 
    crear_o_actualizar_paciente_geclisa,
    asignar_medico_paciente,
    get_configuracion_nomenclador,
    save_configuracion_nomenclador,
    list_practicas_crm,
    create_practica_crm,
    update_practica_crm,
    delete_practica_crm,
    list_precios_override,
    upsert_precio_override,
    delete_precio_override,
    get_precio_override_by_codigo
)
from app.whatsapp import (
    iniciar_daemon_whatsapp, 
    whatsapp_manager,
    NEONIZE_AVAILABLE
)
from app.services.pdf_service import PDF_DIR
from app.services.media_service import media_service, STATIC_MEDIA_DIR
from app.services.tools import crear_borrador_presupuesto
from app.services.config_service import load_settings, save_settings
from app.services.geclisa_client import GeclisaClient

geclisa_client = GeclisaClient()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Modelos de validación Pydantic
class SimuladorMensaje(BaseModel):
    telefono: str
    mensaje: str

class ToggleBotRequest(BaseModel):
    bot_disabled: bool

class ItemPresupuestoInput(BaseModel):
    codigo_servicio: str
    cantidad: int

class PresupuestoInput(BaseModel):
    paciente_id: str
    items: List[ItemPresupuestoInput]

class SendMessageRequest(BaseModel):
    telefono: str
    mensaje: str
    conversacion_id: Optional[str] = None

class TestMessageRequest(BaseModel):
    telefono: str
    mensaje: Optional[str] = "¡Hola desde MedCRM! Prueba de vinculación exitosa. 🩺"

# Ciclo de vida de la aplicación FastAPI
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicación CRM Médico + WhatsApp Gateway...")
    iniciar_daemon_whatsapp()
    yield
    logger.info("Deteniendo aplicación CRM Médico...")

app = FastAPI(
    title="CRM Médico API + Gestor de WhatsApp Neonize",
    description="Backend completo en FastAPI para la gestión de clínica médica, sincronización QR WhatsApp y agente Gemini.",
    version="2.0.0",
    lifespan=lifespan
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos (PDFs de presupuestos)
app.mount("/static", StaticFiles(directory=PDF_DIR), name="static")

# ====================================================================
# ENDPOINTS GENERALES Y HEALTH
# ====================================================================

@app.get("/")
def read_root():
    return {
        "status": "online",
        "servicio": "MedCRM - Gestor de Mensajería & Clínica",
        "whatsapp_daemon": "disponible" if NEONIZE_AVAILABLE else "no_instalado (modo simulado)",
        "pdf_storage_dir": PDF_DIR
    }

@app.get("/api/health")
def health_check():
    supabase_ok = False
    if supabase:
        try:
            supabase.table("servicios_precios").select("id").limit(1).execute()
            supabase_ok = True
        except Exception:
            pass
            
    return {
        "api": "ok",
        "supabase": "conectado" if supabase_ok else "desconectado",
        "whatsapp_daemon": "conectado" if NEONIZE_AVAILABLE else "simulado"
    }

# ====================================================================
# ENDPOINTS DE GESTIÓN DE WHATSAPP Y VINCULACIÓN QR
# ====================================================================

@app.get("/api/whatsapp/status")
def get_whatsapp_status():
    """
    Retorna el estado de la conexión, si está autenticado, QR disponible y datos del móvil.
    """
    return whatsapp_manager.get_status()

@app.get("/api/whatsapp/qr")
def get_whatsapp_qr():
    """
    Retorna el código QR activo en formato base64 Data-URI para renderizado directo en UI.
    """
    return whatsapp_manager.get_qr_data()

@app.get("/api/whatsapp/logs")
def get_whatsapp_logs(limit: int = 40):
    """
    Retorna los logs recientes del daemon de WhatsApp para el visor de consola.
    """
    return {"logs": whatsapp_manager.get_logs(limit=limit)}

@app.post("/api/whatsapp/connect")
def connect_whatsapp(force: bool = False):
    """
    Inicia o fuerza el reinicio de la conexión con WhatsApp y generación de QR.
    """
    logger.info(f"Petición de conexión WhatsApp recibida (force={force})")
    iniciar_daemon_whatsapp(force_restart=force)
    return {"success": True, "message": "Proceso de conexión iniciado.", "status": whatsapp_manager.get_status()}

@app.post("/api/whatsapp/logout")
def logout_whatsapp():
    """
    Cierra la sesión de WhatsApp, desvincula el dispositivo y reinicia el estado.
    """
    logger.info("Petición de Logout de WhatsApp recibida")
    ok = whatsapp_manager.desconectar_y_logout()
    if not ok:
        raise HTTPException(status_code=500, detail="Error al cerrar sesión de WhatsApp.")
    return {"success": True, "message": "Sesión cerrada correctamente. Dispositivo desvinculado."}

@app.post("/api/whatsapp/send-message")
def send_message_api(payload: SendMessageRequest):
    """
    Envía un mensaje de texto directamente al WhatsApp real del paciente y lo guarda en la BD.
    """
    logger.info(f"Enviando mensaje saliente a {payload.telefono}")
    result = whatsapp_manager.enviar_mensaje(
        telefono_o_jid=payload.telefono,
        texto=payload.mensaje,
        conversacion_id=payload.conversacion_id
    )
    if "error" in result and not result.get("guardado_db"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/whatsapp/send-test")
def send_test_message(payload: TestMessageRequest):
    """
    Envía un mensaje de prueba al teléfono indicado para verificar la conexión activa.
    """
    logger.info(f"Enviando mensaje de prueba a {payload.telefono}")
    result = whatsapp_manager.enviar_mensaje(
        telefono_o_jid=payload.telefono,
        texto=payload.mensaje or "Mensaje de prueba desde MedCRM"
    )
    if "error" in result and not result.get("guardado_db"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/whatsapp/send-media")
async def send_media_api(
    file: UploadFile = File(...),
    telefono: str = Form(...),
    conversacion_id: Optional[str] = Form(None),
    caption: Optional[str] = Form("")
):
    """
    Envía un archivo multimedia (imagen, PDF, estudio médico) al WhatsApp del paciente
    y lo almacena con metadatos estructurados en Supabase.
    """
    logger.info(f"API: Enviando archivo {file.filename} a {telefono}")
    try:
        content = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        original_name = file.filename or "archivo"
        
        subfolder = "images" if "image" in mime_type else "documents"
        saved = media_service.save_media_bytes(
            data=content,
            subfolder=subfolder,
            mime_type=mime_type,
            original_filename=original_name,
            prefix="crm_out"
        )
        
        # Enviar vía WhatsApp
        result = whatsapp_manager.enviar_documento(
            telefono_o_jid=telefono,
            filepath=saved["file_path"],
            filename=original_name,
            caption=caption or "",
            conversacion_id=conversacion_id
        )
        
        return {
            "success": True,
            "media": saved,
            "whatsapp_result": result
        }
    except Exception as e:
        logger.error(f"Error enviando archivo multimedia: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar archivo: {str(e)}")

# ====================================================================
# ENDPOINTS DE CONFIGURACIÓN DEL SISTEMA Y BOT
# ====================================================================

@app.get("/api/settings")
def get_system_settings():
    """
    Obtiene la configuración actual del consultorio, bot de IA y reglas de escalamiento.
    """
    return load_settings()

@app.post("/api/settings")
def update_system_settings(payload: Dict[str, Any] = Body(...)):
    """
    Actualiza y persiste la configuración del consultorio y bot de IA.
    """
    try:
        updated = save_settings(payload)
        return {"success": True, "settings": updated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error actualizando configuraciones: {str(e)}")

# ====================================================================
# ENDPOINTS DE CONVERSACIONES, PRESUPUESTOS Y SIMULADOR
# ====================================================================

@app.post("/api/conversaciones/{conversacion_id}/toggle-bot")
def toggle_bot(conversacion_id: str, payload: ToggleBotRequest):
    """
    Habilita o deshabilita la atención del bot automático en una conversación específica.
    """
    logger.info(f"Alternar bot en conversación {conversacion_id} a {payload.bot_disabled}")
    res = actualizar_bot_disabled(conversacion_id, payload.bot_disabled)
    if not res:
        raise HTTPException(status_code=404, detail="Conversación no encontrada.")
    return {"success": True, "conversacion": res}

@app.post("/api/simulate-message")
def simulate_message(payload: SimuladorMensaje):
    """
    Simula un mensaje de WhatsApp entrante para desarrollo/pruebas.
    """
    logger.info(f"Simulando mensaje de {payload.telefono}: {payload.mensaje}")
    
    class MockSender:
        def __init__(self, sender):
            self.User = sender
            self.Sender = sender

    class MockInfo:
        def __init__(self, sender):
            self.Sender = sender
            self.PushName = f"Paciente Test ({sender[-4:]})"

    class MockConversationMessage:
        def __init__(self, text):
            self.conversation = text
            self.extendedTextMessage = None

    class MockEvent:
        def __init__(self, sender, text):
            self.Info = MockInfo(sender)
            self.Message = MockConversationMessage(text)

    class MockClient:
        def send_message(self, jid, text):
            logger.info(f"[WHATSAPP SIMULADO] ENVIANDO A {jid}: {text}")
            return {"status": "sent", "to": str(jid), "content": text}

    mock_client = MockClient()
    mock_event = MockEvent(payload.telefono, payload.mensaje)
    
    # Delegar al procesador de mensajes
    whatsapp_manager._handle_incoming_message(mock_client, mock_event)
    
    return {
        "success": True,
        "mensaje": f"Mensaje procesado en simulación para {payload.telefono}."
    }

@app.post("/api/presupuestos")
def create_presupuesto_api(payload: PresupuestoInput):
    """
    Crea un presupuesto para un paciente y genera el PDF correspondiente.
    """
    logger.info(f"API: Crear presupuesto para paciente {payload.paciente_id}")
    items_parsed = [{"codigo_servicio": it.codigo_servicio, "cantidad": it.cantidad} for it in payload.items]
    res = crear_borrador_presupuesto(payload.paciente_id, items_parsed)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

# ====================================================================
# ENDPOINTS DE INTEGRACIÓN CON GECLISA (HOSPITALARIO)
# ====================================================================

@app.get("/api/geclisa/pacientes/buscar-por-dni")
def buscar_geclisa_dni(dni: str):
    """
    Busca al paciente en Geclisa por número de DNI y verifica si ya está registrado en el CRM.
    """
    if not dni:
        raise HTTPException(status_code=400, detail="Debe ingresar un número de DNI.")
        
    resultado = geclisa_client.buscar_paciente_por_dni(dni)
    if not resultado.get("encontrado"):
        return resultado

    # Verificar si ya existe en Supabase
    ficha_id = resultado.get("ficha_id")
    dni_resultado = resultado.get("dni") or dni
    
    paciente_crm = None
    if ficha_id:
        paciente_crm = get_paciente_by_geclisa_id(ficha_id)
    if not paciente_crm and dni_resultado:
        paciente_crm = get_paciente_by_dni(dni_resultado)

    resultado["ya_en_crm"] = bool(paciente_crm)
    resultado["crm_paciente_id"] = paciente_crm.get("id") if paciente_crm else None
    return resultado

@app.get("/api/geclisa/pacientes/buscar-por-ficha")
def buscar_geclisa_ficha(ficha_id: int):
    """
    Busca la ficha en Geclisa directamente por fichaId y verifica si ya está registrada en el CRM.
    """
    if not ficha_id:
        raise HTTPException(status_code=400, detail="Debe ingresar un ID de ficha válido.")
        
    resultado = geclisa_client.buscar_paciente_por_ficha(ficha_id)
    if not resultado.get("encontrado"):
        return resultado

    # Verificar si ya existe en Supabase
    paciente_crm = get_paciente_by_geclisa_id(ficha_id)
    if not paciente_crm and resultado.get("dni"):
        paciente_crm = get_paciente_by_dni(resultado.get("dni"))

    resultado["ya_en_crm"] = bool(paciente_crm)
    resultado["crm_paciente_id"] = paciente_crm.get("id") if paciente_crm else None
    return resultado

@app.post("/api/geclisa/pacientes/importar")
def importar_paciente_geclisa(payload: Dict[str, Any] = Body(...)):
    """
    Importa o actualiza un paciente desde Geclisa hacia la base de datos del CRM (Supabase).
    """
    try:
        paciente = crear_o_actualizar_paciente_geclisa(payload)
        return {
            "success": True,
            "mensaje": f"Paciente {paciente.get('nombre')} importado correctamente.",
            "paciente": paciente
        }
    except Exception as e:
        logger.error(f"Error al importar paciente desde Geclisa: {e}")
        raise HTTPException(status_code=500, detail=f"Error al importar paciente: {str(e)}")

@app.get("/api/geclisa/prestadores/buscar")
def buscar_geclisa_prestadores(query: Optional[str] = ""):
    """
    Busca prestadores médicos en Geclisa por nombre, apellido o número de matrícula.
    Operación a demanda activada exclusivamente por la búsqueda del usuario.
    """
    try:
        prestadores = geclisa_client.buscar_prestadores(query or "")
        return {
            "success": True,
            "query": query,
            "total": len(prestadores),
            "prestadores": prestadores
        }
    except Exception as e:
        logger.error(f"Error al consultar prestadores en Geclisa: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar prestadores: {str(e)}")

@app.get("/api/geclisa/prestadores/{pre_id}")
def detalle_geclisa_prestador(pre_id: int):
    """
    Obtiene los datos detallados de un prestador específico por su preId de Geclisa.
    """
    try:
        prestador = geclisa_client.obtener_prestador_por_id(pre_id)
        return prestador
    except Exception as e:
        logger.error(f"Error al obtener detalle de prestador {pre_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar prestador: {str(e)}")

@app.patch("/api/pacientes/{paciente_id}/medico")
def asignar_medico_a_paciente(paciente_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Asigna o actualiza el médico de cabecera en la ficha del paciente en el CRM (Supabase).
    Payload esperado: { "pre_id": int | null, "nombre": str | null, "matricula": str | null, "especialidad": str | null }
    """
    try:
        paciente_actualizado = asignar_medico_paciente(paciente_id, payload)
        if not paciente_actualizado:
            raise HTTPException(status_code=404, detail="Paciente no encontrado o no se pudo actualizar.")
        return {
            "success": True,
            "mensaje": "Médico de cabecera asignado correctamente.",
            "paciente": paciente_actualizado
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al asignar médico a paciente {paciente_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al asignar médico: {str(e)}")


# ====================================================================
# ENDPOINTS DE NOMENCLADOR, ARANCELES Y PRÁCTICAS PROPIAS (CRM)
# ====================================================================

@app.get("/api/nomenclador/config")
def obtener_nomenclador_config():
    """
    Obtiene la configuración actual del Nomenclador (nomencladores activos y financiador particular).
    """
    try:
        cfg = get_configuracion_nomenclador()
        return {"success": True, "config": cfg}
    except Exception as e:
        logger.error(f"Error al obtener configuración de nomenclador: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomenclador/config")
def guardar_nomenclador_config(payload: Dict[str, Any] = Body(...)):
    """
    Guarda o actualiza la configuración global del Nomenclador.
    """
    try:
        updated = save_configuracion_nomenclador(payload)
        return {"success": True, "mensaje": "Configuración guardada correctamente.", "config": updated}
    except Exception as e:
        logger.error(f"Error al guardar configuración de nomenclador: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nomenclador/tipos")
def listar_tipos_nomenclador():
    """
    Consulta los tipos de nomencladores disponibles en Geclisa.
    """
    try:
        tipos = geclisa_client.obtener_tipos_nomenclador()
        return {"success": True, "tipos": tipos}
    except Exception as e:
        logger.error(f"Error al listar tipos de nomenclador: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nomenclador/practicas-crm")
def listar_practicas_propias():
    """
    Lista las prácticas personalizadas creadas en el CRM (fuera del nomenclador de Geclisa).
    """
    try:
        practicas = list_practicas_crm()
        return {"success": True, "practicas": practicas}
    except Exception as e:
        logger.error(f"Error al listar prácticas CRM: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomenclador/practicas-crm")
def crear_practica_propia(payload: Dict[str, Any] = Body(...)):
    """
    Crea una nueva práctica personalizada en el CRM.
    """
    try:
        if not payload.get("codigo") or not payload.get("nombre"):
            raise HTTPException(status_code=400, detail="Código y nombre son obligatorios.")
        nueva = create_practica_crm(payload)
        return {"success": True, "mensaje": "Práctica creada exitosamente.", "practica": nueva}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al crear práctica CRM: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/nomenclador/practicas-crm/{practica_id}")
def modificar_practica_propia(practica_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Modifica una práctica personalizada del CRM.
    """
    try:
        actualizada = update_practica_crm(practica_id, payload)
        return {"success": True, "mensaje": "Práctica actualizada exitosamente.", "practica": actualizada}
    except Exception as e:
        logger.error(f"Error al actualizar práctica CRM {practica_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/nomenclador/practicas-crm/{practica_id}")
def borrar_practica_propia(practica_id: str):
    """
    Elimina una práctica personalizada del CRM.
    """
    try:
        ok = delete_practica_crm(practica_id)
        return {"success": ok, "mensaje": "Práctica eliminada."}
    except Exception as e:
        logger.error(f"Error al eliminar práctica CRM {practica_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nomenclador/precios-override")
def listar_precios_override_crm():
    """
    Lista las excepciones / precios personalizados asignados a prácticas de Geclisa.
    """
    try:
        overrides = list_precios_override()
        return {"success": True, "overrides": overrides}
    except Exception as e:
        logger.error(f"Error al listar precios override: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomenclador/precios-override")
def guardar_precio_override_crm(payload: Dict[str, Any] = Body(...)):
    """
    Crea o actualiza un precio personalizado en CRM para una práctica de Geclisa.
    """
    try:
        if not payload.get("nom_id") or not payload.get("nom_cod") or "precio_override" not in payload:
            raise HTTPException(status_code=400, detail="nom_id, nom_cod y precio_override son obligatorios.")
        guardado = upsert_precio_override(payload)
        return {"success": True, "mensaje": "Precio personalizado guardado.", "override": guardado}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al guardar precio override: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/nomenclador/precios-override/{override_id}")
def borrar_precio_override_crm(override_id: str):
    """
    Elimina un precio personalizado, volviendo a usar el valor que retorne Geclisa.
    """
    try:
        ok = delete_precio_override(override_id)
        return {"success": ok, "mensaje": "Precio personalizado eliminado."}
    except Exception as e:
        logger.error(f"Error al eliminar precio override {override_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nomenclador/buscar-unificado")
def buscar_practicas_unificado(q: Optional[str] = ""):
    """
    Búsqueda unificada inteligente para presupuestar:
    1. Busca prácticas propias del CRM.
    2. Busca prácticas en el Nomenclador de Geclisa filtrando por los tipos configurados.
    3. Resuelve para cada una si tiene precio propio de CRM, override de precio en CRM, o valor de Geclisa.
    """
    query = (q or "").strip().upper()
    cfg = get_configuracion_nomenclador()
    nomencladores_activos = cfg.get("nomencladores_activos", [1, 6])
    os_id_particular = cfg.get("geclisa_particular_os_id", 8118)
    plan_id_particular = cfg.get("geclisa_particular_plan_id", 215)
    
    resultados = []
    
    # 1. Prácticas Propias del CRM
    try:
        practicas_crm = list_practicas_crm(solo_activas=True)
        for p in practicas_crm:
            if not query or query in p["codigo"].upper() or query in p["nombre"].upper() or query in (p.get("categoria") or "").upper():
                resultados.append({
                    "id": f"crm_{p['id']}",
                    "origen": "crm_propio",
                    "origen_label": "CRM Propio",
                    "codigo": p["codigo"],
                    "nombre": p["nombre"],
                    "categoria": p.get("categoria", "General"),
                    "descripcion": p.get("descripcion", ""),
                    "nom_id": None,
                    "nom_cod": p["codigo"],
                    "tipo_nomenclador": "Práctica Interna CRM",
                    "precio_sugerido": float(p["precio"]),
                    "origen_precio": "crm_propio",
                    "override_activo": False
                })
    except Exception as e:
        logger.warning(f"Error al buscar prácticas propias CRM: {e}")

    # 2. Prácticas de Geclisa (solo si hay query de búsqueda)
    if query:
        try:
            # Traer lista de overrides existentes para hacer match rápido
            overrides = {f"{ov['nom_id']}_{str(ov['nom_cod']).strip()}": ov for ov in list_precios_override(solo_activas=True)}
            
            # Consultar Geclisa
            geclisa_items = geclisa_client.buscar_practicas_geclisa(search_string=query)
            
            # Filtrar por nomencladores activos
            items_filtrados = [
                it for it in geclisa_items 
                if not nomencladores_activos or it.get("nomId") in nomencladores_activos
            ]

            # Función para valorizar un ítem si no tiene override
            def procesar_item_geclisa(item):
                n_id = item.get("nomId")
                n_cod = str(item.get("nomCod", "")).strip()
                n_nom = item.get("nombre") or item.get("practica") or ""
                n_tipo = item.get("tipo") or "Geclisa"
                
                override_key = f"{n_id}_{n_cod}"
                if override_key in overrides:
                    ov = overrides[override_key]
                    precio = float(ov["precio_override"])
                    origen_precio = "crm_override"
                    override_activo = True
                else:
                    # Consultar valorización oficial en Geclisa para Obra Social Particular
                    val_res = geclisa_client.valorizar_practica_particular(
                        nom_id=n_id,
                        nom_cod=n_cod,
                        os_id=os_id_particular,
                        plan_id=plan_id_particular,
                        cantidad=1
                    )
                    if val_res.get("exito") and val_res.get("total", 0) > 0:
                        precio = float(val_res["total"])
                        origen_precio = "geclisa_particular"
                    else:
                        precio = 0.0
                        origen_precio = "geclisa_particular"
                    override_activo = False

                return {
                    "id": f"geclisa_{n_id}_{n_cod}",
                    "origen": "geclisa",
                    "origen_label": n_tipo,
                    "codigo": n_cod,
                    "nombre": n_nom,
                    "categoria": n_tipo,
                    "descripcion": item.get("codyPractica", ""),
                    "nom_id": n_id,
                    "nom_cod": n_cod,
                    "tipo_nomenclador": n_tipo,
                    "precio_sugerido": precio,
                    "origen_precio": origen_precio,
                    "override_activo": override_activo
                }

            # Ejecución en paralelo con ThreadPoolExecutor
            if items_filtrados:
                with ThreadPoolExecutor(max_workers=min(12, len(items_filtrados))) as executor:
                    geclisa_procesados = list(executor.map(procesar_item_geclisa, items_filtrados))
                resultados.extend(geclisa_procesados)
        except Exception as e:
            logger.error(f"Error al consultar y valorizar prácticas Geclisa en búsqueda unificada: {e}")

    return {
        "success": True,
        "query": query,
        "total": len(resultados),
        "resultados": resultados
    }

@app.post("/api/nomenclador/valorizar")
def valorizar_practica_especifica(payload: Dict[str, Any] = Body(...)):
    """
    Resuelve y calcula el valor vigente de una práctica para cotización:
    - Si es CRM Propia: Devuelve el precio cargado en CRM.
    - Si tiene Override en CRM: Devuelve el precio override fijado en CRM.
    - Si proviene de Geclisa: Consulta en vivo a Geclisa con el financiador Particular (osId: 8118 / planId: 215).
    """
    try:
        origen = payload.get("origen", "geclisa")
        codigo = str(payload.get("codigo", "")).strip()
        nom_id = payload.get("nom_id")
        nom_cod = str(payload.get("nom_cod") or codigo).strip()
        cantidad = int(payload.get("cantidad", 1))
        
        cfg = get_configuracion_nomenclador()
        os_id = int(cfg.get("geclisa_particular_os_id", 8118))
        plan_id = int(cfg.get("geclisa_particular_plan_id", 215))
        area = cfg.get("geclisa_area_default", "A")

        # 1. Verificar si es práctica propia del CRM
        if origen == "crm_propio" or not nom_id:
            # Buscar en CRM
            resp = supabase.table("practicas_crm").select("*").eq("codigo", codigo.upper()).execute()
            if resp.data and len(resp.data) > 0:
                p = resp.data[0]
                unitario = float(p["precio"])
                return {
                    "success": True,
                    "origen_precio": "crm_propio",
                    "origen_label": "Práctica Propia CRM",
                    "precio_unitario": unitario,
                    "total": unitario * cantidad,
                    "coseguro_neto": unitario * cantidad,
                    "honorarios": 0.0,
                    "gastos": unitario * cantidad,
                    "iva": 0.0
                }

        # 2. Verificar si tiene Override en CRM
        if nom_id and nom_cod:
            override = get_precio_override_by_codigo(nom_id, nom_cod)
            if override:
                unitario = float(override["precio_override"])
                return {
                    "success": True,
                    "origen_precio": "crm_override",
                    "origen_label": "Precio Personalizado CRM",
                    "precio_unitario": unitario,
                    "total": unitario * cantidad,
                    "coseguro_neto": unitario * cantidad,
                    "honorarios": 0.0,
                    "gastos": unitario * cantidad,
                    "iva": 0.0,
                    "observacion": override.get("observacion")
                }

        # 3. Consultar Geclisa Particular
        if nom_id and nom_cod:
            geclisa_val = geclisa_client.valorizar_practica_particular(
                nom_id=int(nom_id),
                nom_cod=nom_cod,
                os_id=os_id,
                plan_id=plan_id,
                cantidad=cantidad,
                area=area
            )
            if geclisa_val.get("exito") and geclisa_val.get("total", 0) > 0:
                unitario = geclisa_val["total"] / max(cantidad, 1)
                return {
                    "success": True,
                    "origen_precio": "geclisa_particular",
                    "origen_label": "Arancel Particular Geclisa",
                    "precio_unitario": unitario,
                    "total": geclisa_val["total"],
                    "coseguro_neto": geclisa_val.get("coseguro_neto", 0.0),
                    "honorarios": geclisa_val.get("honorarios", 0.0),
                    "gastos": geclisa_val.get("gastos", 0.0),
                    "iva": geclisa_val.get("coseguro_iva", 0.0),
                    "iva_porc": geclisa_val.get("iva_porc", 0.0)
                }
            else:
                return {
                    "success": False,
                    "origen_precio": "sin_precio",
                    "origen_label": "Sin valorizar en Geclisa",
                    "precio_unitario": 0.0,
                    "total": 0.0,
                    "mensaje": geclisa_val.get("mensaje", "La práctica no tiene precio cargado para Particular.")
                }

        raise HTTPException(status_code=400, detail="Parámetros insuficientes para valorizar práctica.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en endpoint valorizar práctica: {e}")
        raise HTTPException(status_code=500, detail=str(e))



