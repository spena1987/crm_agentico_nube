import os
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager

from fastapi.responses import Response, StreamingResponse
import io
import csv
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.db import (
    supabase, 
    actualizar_bot_disabled, 
    get_paciente_by_dni, 
    get_paciente_by_geclisa_id, 
    crear_o_actualizar_paciente_geclisa,
    asignar_medico_paciente,
    list_nomencladores,
    get_nomenclador_by_id,
    create_nomenclador,
    update_nomenclador,
    delete_nomenclador,
    list_practicas_con_arancel,
    create_or_update_practica,
    delete_practica,
    upsert_arancel_practica,
    buscar_practicas_presupuesto,
    bulk_import_practicas_aranceles
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
    nombre_prestacion: Optional[str] = None
    cantidad: int = 1
    precio_unitario: Optional[float] = None
    moneda: Optional[str] = "ARS"

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

@app.get("/api/version")
def version_check():
    return {
        "version": "2.1.0",
        "db_path": whatsapp_manager.db_path,
        "neonize_available": NEONIZE_AVAILABLE,
        "status": whatsapp_manager.status,
        "qr_ready": bool(whatsapp_manager.qr_code_data_uri)
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

class PairCodeRequest(BaseModel):
    telefono: str

@app.post("/api/whatsapp/pair-code")
def request_pair_code(req: PairCodeRequest):
    """
    Genera un código de 8 caracteres (XXXX-XXXX) para vincular ingresando el número de teléfono.
    """
    logger.info(f"Petición de código de vinculación para teléfono: {req.telefono}")
    result = whatsapp_manager.solicitar_codigo_vinculacion(req.telefono)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

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
    Crea un presupuesto para un paciente y genera el PDF correspondiente con valores y soporte multi-moneda.
    """
    logger.info(f"API: Crear presupuesto para paciente {payload.paciente_id}")
    items_parsed = [
        {
            "codigo_servicio": it.codigo_servicio,
            "nombre_prestacion": it.nombre_prestacion,
            "cantidad": it.cantidad,
            "precio_unitario": it.precio_unitario,
            "moneda": it.moneda or "ARS"
        }
        for it in payload.items
    ]
    res = crear_borrador_presupuesto(payload.paciente_id, items_parsed)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.get("/api/presupuestos/plantilla-preview")
def preview_plantilla_presupuesto():
    """
    Genera un PDF de muestra al vuelo para previsualizar el diseño de la plantilla institucional.
    """
    try:
        from app.services.pdf_service import generar_pdf_presupuesto
        from datetime import date
        
        sample_presupuesto = {
            "id": "A1B2C3D4",
            "created_at": date.today().isoformat(),
            "estado": "borrador",
            "total": 30500.00
        }
        sample_paciente = {
            "nombre": "GARCÍA, MARÍA JOSÉ",
            "telefono": "+54 9 11 4444-5555",
            "email": "maria.garcia@ejemplo.com",
            "dni": "35.890.123",
            "obra_social": "OSDE 310"
        }
        sample_items = [
            {
                "codigo": "420101",
                "nombre_prestacion": "Consulta Médica Especializada en Fertilidad",
                "cantidad": 1,
                "precio_unitario": 8500.00,
                "moneda": "ARS",
                "subtotal": 8500.00
            },
            {
                "codigo": "180104",
                "nombre_prestacion": "Ecografía Ginecológica Transvaginal de Alta Resolución",
                "cantidad": 1,
                "precio_unitario": 22000.00,
                "moneda": "ARS",
                "subtotal": 22000.00
            },
            {
                "codigo": "FIV-ICSI-01",
                "nombre_prestacion": "Tratamiento FIV + ICSI Completo con Criopreservación",
                "cantidad": 1,
                "precio_unitario": 1500.00,
                "moneda": "USD",
                "subtotal": 1500.00
            }
        ]
        
        filename = generar_pdf_presupuesto(sample_presupuesto, sample_paciente, sample_items)
        return {
            "success": True,
            "pdf_url": f"/static/{filename}"
        }
    except Exception as e:
        logger.error(f"Error al generar preview de plantilla: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
# ENDPOINTS REST: NOMENCLADORES PROPIOS DEL CRM (MULTI-MONEDA: ARS / USD)
# ====================================================================

@app.get("/api/nomencladores")
def get_all_nomencladores():
    """
    Lista todos los nomencladores configurados en el CRM.
    """
    try:
        data = list_nomencladores()
        return {"success": True, "nomencladores": data}
    except Exception as e:
        logger.error(f"Error al obtener nomencladores: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomencladores")
def crear_nuevo_nomenclador(payload: Dict[str, Any] = Body(...)):
    """
    Crea un nuevo nomenclador en el CRM (con moneda ARS o USD).
    """
    try:
        if not payload.get("nombre"):
            raise HTTPException(status_code=400, detail="El nombre del nomenclador es obligatorio.")
        creado = create_nomenclador(payload)
        return {"success": True, "mensaje": "Nomenclador creado exitosamente.", "nomenclador": creado}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al crear nomenclador: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/nomencladores/{nomenclador_id}")
def editar_nomenclador(nomenclador_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Actualiza datos de un nomenclador.
    """
    try:
        act = update_nomenclador(nomenclador_id, payload)
        return {"success": True, "mensaje": "Nomenclador actualizado.", "nomenclador": act}
    except Exception as e:
        logger.error(f"Error al actualizar nomenclador {nomenclador_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/nomencladores/{nomenclador_id}")
def borrar_nomenclador(nomenclador_id: str):
    """
    Elimina un nomenclador y todas sus prácticas asociadas.
    """
    try:
        ok = delete_nomenclador(nomenclador_id)
        return {"success": ok, "mensaje": "Nomenclador eliminado exitosamente."}
    except Exception as e:
        logger.error(f"Error al eliminar nomenclador {nomenclador_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nomenclador/practicas")
def get_practicas_nomenclador(
    nomenclador_id: Optional[str] = None,
    fecha: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Lista las prácticas resolviendo el arancel y moneda vigentes para la fecha.
    """
    try:
        res = list_practicas_con_arancel(
            nomenclador_id=nomenclador_id,
            fecha_consulta=fecha,
            q=q,
            limit=limit,
            offset=offset
        )
        return {"success": True, "total": res["total"], "practicas": res["practicas"]}
    except Exception as e:
        logger.error(f"Error al listar prácticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomenclador/practicas")
def guardar_practica(payload: Dict[str, Any] = Body(...)):
    """
    Crea o actualiza una práctica individual del catálogo.
    """
    try:
        if not payload.get("nomenclador_id") or not payload.get("codigo") or not payload.get("nombre"):
            raise HTTPException(status_code=400, detail="Nomenclador, código y nombre son obligatorios.")
        guardada = create_or_update_practica(payload)
        return {"success": True, "mensaje": "Práctica guardada correctamente.", "practica": guardada}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al guardar práctica: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/nomenclador/practicas/{practica_id}")
def borrar_practica(practica_id: str):
    """
    Elimina una práctica del catálogo.
    """
    try:
        ok = delete_practica(practica_id)
        return {"success": ok, "mensaje": "Práctica eliminada."}
    except Exception as e:
        logger.error(f"Error al eliminar práctica {practica_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nomenclador/practicas/{practica_id}/arancel")
def agregar_arancel_vigencia(practica_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Registra un nuevo arancel con fecha de vigencia para una práctica.
    """
    try:
        if "precio" not in payload:
            raise HTTPException(status_code=400, detail="El precio es obligatorio.")
        nuevo_arancel = upsert_arancel_practica(practica_id, payload)
        return {"success": True, "mensaje": "Arancel con vigencia guardado.", "arancel": nuevo_arancel}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al registrar arancel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# BÚSQUEDA RÁPIDA MULTI-MONEDA PARA PRESUPUESTOS (NATIVO CRM)
# ====================================================================

@app.get("/api/nomenclador/buscar-presupuesto")
def buscar_para_presupuesto(q: Optional[str] = "", fecha: Optional[str] = None):
    """
    Búsqueda optimizada por texto para el modal de presupuestos con arancel vigente.
    """
    try:
        resultados = buscar_practicas_presupuesto(q=q or "", fecha_consulta=fecha)
        return {
            "success": True,
            "query": q,
            "total": len(resultados),
            "resultados": resultados
        }
    except Exception as e:
        logger.error(f"Error al buscar prácticas para presupuesto: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================================
# IMPORTADOR Y EXPORTADOR MASIVO EXCEL (.XLSX / .CSV)
# ====================================================================

@app.post("/api/nomenclador/importar-excel")
async def importar_practicas_excel(
    file: UploadFile = File(...),
    nomenclador_id: str = Form(...),
    modo: str = Form("upsert"),
    default_vigencia_desde: Optional[str] = Form(None),
    default_vigencia_hasta: Optional[str] = Form(None),
    default_moneda: str = Form("ARS")
):
    """
    Procesa la importación masiva de prácticas y aranceles desde un archivo Excel o CSV.
    """
    try:
        nom = get_nomenclador_by_id(nomenclador_id)
        if not nom:
            raise HTTPException(status_code=404, detail="El Nomenclador de destino no existe.")
            
        moneda_nom = default_moneda or nom.get("moneda_default", "ARS")
        contents = await file.read()
        filename = (file.filename or "").lower()
        
        parsed_rows = []
        
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            
            headers = []
            for cell in sheet[1]:
                val = str(cell.value or "").strip().lower()
                headers.append(val)
                
            def get_col_idx(names):
                for name in names:
                    for i, h in enumerate(headers):
                        if name in h:
                            return i
                return -1
                
            col_cod = get_col_idx(["cod", "codigo", "código", "id"])
            col_nom = get_col_idx(["nom", "nombre", "practica", "práctica", "descripcion", "descripción"])
            col_cat = get_col_idx(["cat", "categoria", "categoría", "tipo", "rubro"])
            col_pre = get_col_idx(["pre", "precio", "arancel", "valor", "importe", "monto"])
            col_mon = get_col_idx(["mon", "moneda", "currency"])
            col_vdes = get_col_idx(["desde", "vigencia_desde", "inicio"])
            col_vhas = get_col_idx(["hasta", "vigencia_hasta", "fin"])
            
            if col_cod == -1 or col_nom == -1:
                raise HTTPException(status_code=400, detail="El archivo Excel debe contener al menos las columnas 'Código' y 'Nombre/Práctica'.")
                
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not row or not any(row):
                    continue
                codigo = str(row[col_cod] or "").strip()
                nombre = str(row[col_nom] or "").strip()
                if not codigo or not nombre:
                    continue
                    
                categoria = str(row[col_cat] or "General").strip() if col_cat != -1 and row[col_cat] else "General"
                precio = row[col_pre] if col_pre != -1 and row[col_pre] is not None else 0.0
                moneda = str(row[col_mon] or moneda_nom).strip().upper() if col_mon != -1 and row[col_mon] else moneda_nom
                
                v_desde = None
                if col_vdes != -1 and row[col_vdes]:
                    v_raw = row[col_vdes]
                    v_desde = v_raw.strftime("%Y-%m-%d") if hasattr(v_raw, "strftime") else str(v_raw).strip()
                    
                v_hasta = None
                if col_vhas != -1 and row[col_vhas]:
                    v_raw = row[col_vhas]
                    v_hasta = v_raw.strftime("%Y-%m-%d") if hasattr(v_raw, "strftime") else str(v_raw).strip()
                    
                parsed_rows.append({
                    "codigo": codigo,
                    "nombre": nombre,
                    "categoria": categoria,
                    "precio": precio,
                    "moneda": moneda,
                    "vigencia_desde": v_desde,
                    "vigencia_hasta": v_hasta
                })
        elif filename.endswith(".csv"):
            text_content = contents.decode("utf-8-sig", errors="ignore")
            delimiter = ";" if ";" in text_content[:200] else ","
            reader = csv.DictReader(text_content.splitlines(), delimiter=delimiter)
            
            for row in reader:
                norm_row = {k.strip().lower(): v for k, v in row.items() if k}
                codigo = norm_row.get("codigo") or norm_row.get("código") or norm_row.get("cod") or ""
                nombre = norm_row.get("nombre") or norm_row.get("practica") or norm_row.get("práctica") or norm_row.get("descripcion") or ""
                if not codigo or not nombre:
                    continue
                categoria = norm_row.get("categoria") or norm_row.get("categoría") or "General"
                precio = norm_row.get("precio") or norm_row.get("arancel") or norm_row.get("valor") or 0.0
                moneda = norm_row.get("moneda") or moneda_nom
                v_desde = norm_row.get("vigencia_desde") or norm_row.get("desde")
                v_hasta = norm_row.get("vigencia_hasta") or norm_row.get("hasta")
                
                parsed_rows.append({
                    "codigo": str(codigo).strip(),
                    "nombre": str(nombre).strip(),
                    "categoria": str(categoria).strip(),
                    "precio": precio,
                    "moneda": str(moneda).strip().upper(),
                    "vigencia_desde": v_desde,
                    "vigencia_hasta": v_hasta
                })
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado. Por favor sube un archivo .xlsx o .csv")
            
        if not parsed_rows:
            raise HTTPException(status_code=400, detail="No se encontraron filas con datos válidos en el archivo.")
            
        res_import = bulk_import_practicas_aranceles(
            nomenclador_id=nomenclador_id,
            rows=parsed_rows,
            modo=modo,
            default_vigencia_desde=default_vigencia_desde,
            default_vigencia_hasta=default_vigencia_hasta,
            default_moneda=moneda_nom
        )
        
        return {
            "success": True,
            "mensaje": f"Se procesaron {res_import['total_procesadas']} filas exitosamente ({res_import['insertadas']} aranceles actualizados).",
            "detalle": res_import
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al importar Excel: {e}")
        raise HTTPException(status_code=500, detail=f"Error durante la importación: {str(e)}")

@app.get("/api/nomenclador/descargar-plantilla")
def descargar_plantilla_excel():
    """
    Genera y descarga un archivo Excel .xlsx oficial con encabezados, instrucciones y filas de muestra en ARS y USD.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Nomenclador_Plantilla"
    
    headers = ["Codigo", "Nombre", "Categoria", "Precio", "Moneda", "Vigencia_Desde", "Vigencia_Hasta", "Descripcion"]
    ws.append(headers)
    
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        
    ejemplos = [
        ["420101", "Consulta Médica en Consultorio", "Consultas", 8500.00, "ARS", "2026-09-01", "2026-12-31", "Consulta ambulatoria general"],
        ["180104", "Ecografía Ginecológica / Tocoginecológica", "Diagnóstico", 22000.00, "ARS", "2026-09-01", "", "Ecografía pelviana transvaginal"],
        ["FIV-ICSI-01", "Tratamiento FIV + ICSI Alta Complejidad", "Fertilidad", 1500.00, "USD", "2026-09-01", "", "Incluye estimulación y laboratorio"],
        ["KIT-MED-02", "Kit de Medicación y Criopreservación", "Laboratorio", 450.00, "USD", "2026-09-01", "2027-03-01", "Mantenimiento anual"]
    ]
    
    for row in ejemplos:
        ws.append(row)
        
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
        
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    headers_resp = {
        "Content-Disposition": "attachment; filename=plantilla_nomenclador_crm.xlsx"
    }
    return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers_resp)

@app.get("/api/nomenclador/exportar-excel")
def exportar_nomenclador_excel(nomenclador_id: Optional[str] = None):
    """
    Exporta el catálogo completo o de un nomenclador específico a un archivo Excel .xlsx descargable.
    """
    try:
        res = list_practicas_con_arancel(nomenclador_id=nomenclador_id, limit=5000)
        practicas = res.get("practicas", [])
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Catalogo_Practicas"
        
        headers = ["Nomenclador", "Codigo", "Nombre", "Categoria", "Precio", "Moneda", "Vigencia_Desde", "Vigencia_Hasta", "Estado"]
        ws.append(headers)
        
        header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            
        for p in practicas:
            estado = "Activa" if p.get("activo") else "Inactiva"
            ws.append([
                p.get("nomenclador_nombre", ""),
                p.get("codigo", ""),
                p.get("nombre", ""),
                p.get("categoria", "General"),
                p.get("precio", 0.0),
                p.get("moneda", "ARS"),
                p.get("vigencia_desde", "") or "",
                p.get("vigencia_hasta", "") or "",
                estado
            ])
            
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        headers_resp = {
            "Content-Disposition": "attachment; filename=catalogo_nomencladores_crm.xlsx"
        }
        return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers_resp)
    except Exception as e:
        logger.error(f"Error al exportar Excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


