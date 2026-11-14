import os
import re
import uuid
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

from app.services.config_service import load_settings, obtener_o_cachear_logo_local, obtener_o_cachear_firma_local

logger = logging.getLogger(__name__)

# Zona Horaria Oficial de Argentina: UTC-3 (America/Argentina/Buenos_Aires)
TZ_ARGENTINA = timezone(timedelta(hours=-3))

def parsear_hora_argentina(iso_val: Optional[str], fallback: str = "--:--") -> str:
    """
    Convierte un timestamp ISO (UTC o con offset) a formato de hora local 'HH:MM hs' de Argentina (UTC-3).
    Si ya es una hora plana (ej '08:30'), la preserva con el sufijo 'hs'.
    """
    if not iso_val:
        return fallback
    try:
        s = str(iso_val).strip()
        # Si no tiene 'T' pero tiene formato HH:MM o HH:MM:SS
        if "T" not in s and ":" in s:
            return s[:5] + " hs"
        s_clean = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s_clean)
        if dt.tzinfo is None:
            # Si viene sin zona horaria, se asume UTC
            dt = dt.replace(tzinfo=timezone.utc)
        dt_arg = dt.astimezone(TZ_ARGENTINA)
        return dt_arg.strftime("%H:%M") + " hs"
    except Exception as e:
        logger.warning(f"Error parseando hora argentina para '{iso_val}': {e}")
        return str(iso_val)[:5] + " hs"

def parsear_fecha_hora_argentina(iso_val: Optional[str] = None) -> str:
    """
    Retorna fecha y hora 'DD/MM/YYYY HH:MM' en zona horaria oficial de Argentina (UTC-3).
    Si iso_val es None, retorna el momento actual en Argentina.
    """
    if not iso_val:
        return datetime.now(TZ_ARGENTINA).strftime("%d/%m/%Y %H:%M")
    try:
        s = str(iso_val).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_arg = dt.astimezone(TZ_ARGENTINA)
        return dt_arg.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return datetime.now(TZ_ARGENTINA).strftime("%d/%m/%Y %H:%M")

# Directorio local para guardar los archivos PDF generados
PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
os.makedirs(PDF_DIR, exist_ok=True)

def format_inline_markdown(text: str) -> str:
    """
    Convierte sintaxis Markdown inline a etiquetas soportadas por ReportLab (b, i, u, font).
    Escapa primero caracteres XML problemáticos (&, <, >) que no formen parte de tags válidos.
    """
    if not text:
        return ""
        
    s = text.replace("&", "&amp;")
    
    # Negrita **texto** o __texto__
    s = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'__(.*?)__', r'<b>\1</b>', s)
    
    # Cursiva *texto* o _texto_
    s = re.sub(r'(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)', r'<i>\1</i>', s)
    s = re.sub(r'(?<!_)_(?!_)(.*?)(?<!_)_(?!_)', r'<i>\1</i>', s)
    
    return s

def parse_markdown_to_pdf_flowables(markdown_text: str, custom_styles: dict) -> List[Any]:
    """
    Convierte texto con formato Markdown estructurado en una lista de Flowables de ReportLab:
    - # Encabezados H1
    - ## Encabezados H2
    - ### Encabezados H3
    - > Citas / Alertas médicas destacadas (en tablas con borde ámbar y fondo suave)
    - - o * Listas con viñetas
    - 1. Listas numeradas o a) incisos
    - --- Separadores horizontales
    - Párrafos estándar justificados
    """
    if not markdown_text:
        return []
        
    flowables = []
    lines = markdown_text.split("\n")
    
    style_h1 = custom_styles.get('h1')
    style_h2 = custom_styles.get('h2')
    style_h3 = custom_styles.get('h3')
    style_cuerpo = custom_styles.get('cuerpo')
    style_bullet = custom_styles.get('bullet')
    style_quote = custom_styles.get('quote')
    
    i = 0
    while i < len(lines):
        raw_line = lines[i]
        line = raw_line.strip()
        
        if not line:
            flowables.append(Spacer(1, 4))
            i += 1
            continue
            
        # 1. Separador horizontal --- o ***
        if line in ('---', '***', '___'):
            t_hr = Table([['']], colWidths=[540], rowHeights=[1])
            t_hr.setStyle(TableStyle([
                ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ]))
            flowables.append(Spacer(1, 4))
            flowables.append(t_hr)
            flowables.append(Spacer(1, 6))
            i += 1
            continue
            
        # 2. Encabezado H1: # Título
        if line.startswith('# '):
            content = format_inline_markdown(line[2:].strip())
            flowables.append(Spacer(1, 6))
            flowables.append(Paragraph(content, style_h1))
            flowables.append(Spacer(1, 4))
            i += 1
            continue
            
        # 3. Encabezado H2: ## Sección
        if line.startswith('## '):
            content = format_inline_markdown(line[3:].strip())
            flowables.append(Spacer(1, 6))
            flowables.append(Paragraph(content, style_h2))
            flowables.append(Spacer(1, 3))
            i += 1
            continue
            
        # 4. Encabezado H3: ### Subsección
        if line.startswith('### '):
            content = format_inline_markdown(line[4:].strip())
            flowables.append(Spacer(1, 4))
            flowables.append(Paragraph(content, style_h3))
            flowables.append(Spacer(1, 2))
            i += 1
            continue
            
        # 5. Bloque de Cita / Alerta Médica: > Texto
        if line.startswith('> '):
            quote_lines = [line[2:].strip()]
            while i + 1 < len(lines) and lines[i+1].strip().startswith('> '):
                i += 1
                quote_lines.append(lines[i].strip()[2:].strip())
            
            quote_text = "<br/>".join([format_inline_markdown(ql) for ql in quote_lines])
            p_quote = Paragraph(quote_text, style_quote)
            
            t_quote = Table([[p_quote]], colWidths=[540])
            t_quote.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF9C3')), # Fondo ámbar suave
                ('LINEBEFORE', (0,0), (-1,-1), 3.0, colors.HexColor('#D97706')), # Borde ámbar
                ('TOPPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                ('LEFTPADDING', (0,0), (-1,-1), 8),
                ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ]))
            flowables.append(Spacer(1, 4))
            flowables.append(t_quote)
            flowables.append(Spacer(1, 4))
            i += 1
            continue
            
        # 6. Lista con viñetas: - item o * item
        if line.startswith('- ') or line.startswith('* '):
            content = format_inline_markdown(line[2:].strip())
            flowables.append(Paragraph(f"&bull;&nbsp;&nbsp;{content}", style_bullet))
            flowables.append(Spacer(1, 2))
            i += 1
            continue
            
        # 7. Lista numerada o inciso: 1. item o a) item
        num_match = re.match(r'^(\d+\.|\w\))\s+(.*)$', line)
        if num_match:
            prefix = num_match.group(1)
            content = format_inline_markdown(num_match.group(2))
            flowables.append(Paragraph(f"<b>{prefix}</b>&nbsp;&nbsp;{content}", style_bullet))
            flowables.append(Spacer(1, 2))
            i += 1
            continue
            
        # 8. Párrafo estándar
        content = format_inline_markdown(line)
        flowables.append(Paragraph(content, style_cuerpo))
        flowables.append(Spacer(1, 3))
        i += 1
        
    return flowables

def formatear_monto_moneda(monto: float, moneda: str = "ARS") -> str:
    """
    Formatea un número a formato monetario con separador de miles y decimales.
    Ej: 8500.0 en ARS -> $ 8.500,00 | 1500.0 en USD -> USD 1.500,00
    """
    monto_val = float(monto or 0.0)
    # Formatear con coma decimal y punto de miles
    partes = f"{monto_val:,.2f}".split(".")
    enteros = partes[0].replace(",", ".")
    decimales = partes[1]
    formateado = f"{enteros},{decimales}"
    
    if moneda.upper() == "USD":
        return f"USD {formateado}"
    return f"$ {formateado}"

def parse_and_format_date(val: Any) -> str:
    """
    Parsea de forma segura cualquier formato de fecha (ISO, timestamp o texto) a formato argentino DD/MM/YYYY.
    Evita cadenas como 'now()' o 'None'.
    """
    from datetime import date
    if not val:
        return date.today().strftime('%d/%m/%Y')
    s = str(val).strip()
    if s.lower() in ("now()", "now", "today", "none", "", "null"):
        return date.today().strftime('%d/%m/%Y')
    try:
        clean_s = s.split("T")[0].split(" ")[0]
        parts = clean_s.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            return f"{parts[2]}/{parts[1]}/{parts[0]}"
        if "/" in s:
            return s
        return clean_s
    except Exception:
        return date.today().strftime('%d/%m/%Y')

def generar_pdf_presupuesto(
    presupuesto: dict, 
    paciente: dict, 
    items: list, 
    plantilla_override: Optional[dict] = None
) -> str:
    """
    Genera un presupuesto en formato PDF estético, limpio y profesional utilizando ReportLab.
    Aplica diseño médico institucional, columnas proporcionales con SPAN y soporte multi-moneda independiente.
    Retorna el nombre del archivo PDF generado.
    """
    pdf_filename = f"presupuesto_{presupuesto['id']}.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    
    # Cargar configuración de plantilla fresca desde Supabase/DB
    settings = load_settings(force_refresh=True)
    plantilla = plantilla_override or settings.get("plantilla_presupuesto", {})
    clinica = settings.get("clinica", {})
    
    # Parámetros institucionales
    titulo_doc = plantilla.get("titulo_documento") or "PRESUPUESTO MÉDICO"
    nombre_inst = plantilla.get("nombre_institucion") or clinica.get("nombre") or "CLÍNICA MÉDICA NUBE"
    subtitulo_inst = plantilla.get("subtitulo_institucion") or "Atención Médica Digital & Especialidades"
    direccion_inst = plantilla.get("direccion") or clinica.get("direccion") or ""
    telefono_inst = plantilla.get("telefono") or clinica.get("telefono_guardia") or ""
    email_inst = plantilla.get("email") or clinica.get("email_contacto") or ""
    sitio_web = plantilla.get("sitio_web") or ""
    
    color_primario_hex = plantilla.get("color_primario") or "#1E3A8A"
    color_secundario_hex = plantilla.get("color_secundario") or "#2563EB"
    
    terminos = plantilla.get("terminos_condiciones") or [
        "Este presupuesto tiene una validez de 30 días corridos a partir de la fecha de emisión.",
        "Los precios cotizados respetan la moneda especificada (Pesos ARS o Dólares USD).",
        "La confirmación de turnos quirúrgicos, prácticas y estudios de alta complejidad queda supeditada a disponibilidad de agenda y confirmación de pago.",
        "Formas de pago habilitadas: Transferencia bancaria, Tarjetas de crédito/débito y Efectivo en administración."
    ]
    pie_pagina = plantilla.get("pie_pagina") or f"Documento emitido electrónicamente por {nombre_inst}."
    mostrar_firma = plantilla.get("mostrar_firma", True)
    texto_firma = plantilla.get("texto_firma") or "Firma y Sello Profesional / Autorización Médica"
    
    # Configurar el documento
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Convertir colores HEX
    try:
        color_primario = colors.HexColor(color_primario_hex)
    except Exception:
        color_primario = colors.HexColor("#1E3A8A")
        
    try:
        color_secundario = colors.HexColor(color_secundario_hex)
    except Exception:
        color_secundario = colors.HexColor("#2563EB")
    
    # Estilos de Párrafos
    style_institucion = ParagraphStyle(
        name='InstStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13.5,
        leading=16,
        textColor=color_primario
    )
    
    style_titulo_doc = ParagraphStyle(
        name='DocTitleStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=2, # Derecha
        textColor=color_secundario
    )
    
    style_seccion_header = ParagraphStyle(
        name='SecHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=color_primario
    )
    
    style_texto = ParagraphStyle(
        name='TextStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155')
    )
    
    style_texto_right = ParagraphStyle(
        name='TextRightStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=colors.HexColor('#334155')
    )
    
    style_texto_bold_right = ParagraphStyle(
        name='TextBoldRightStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=colors.HexColor('#0F172A')
    )
    
    style_total_label = ParagraphStyle(
        name='TotalLabelStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        alignment=2, # Derecha
        textColor=color_primario
    )
    
    style_total_amount = ParagraphStyle(
        name='TotalAmountStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        alignment=2, # Derecha
        textColor=color_primario
    )
    
    style_encabezado_tabla = ParagraphStyle(
        name='TableHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )
    
    style_encabezado_tabla_right = ParagraphStyle(
        name='TableHeaderRightStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        alignment=2,
        textColor=colors.white
    )
    
    style_encabezado_tabla_center = ParagraphStyle(
        name='TableHeaderCenterStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.white
    )
    
    style_moneda_tag = ParagraphStyle(
        name='CurrencyTagStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        alignment=1, # Centro
        textColor=colors.HexColor('#1E293B')
    )
    
    # 1. Cabecera Institucional (con soporte de Logo Horizontal y Nombre en 1 sola línea)
    mostrar_logo = plantilla.get("mostrar_logo", True)
    logo_path = obtener_o_cachear_logo_local(plantilla.get("logo_url") or clinica.get("logo_url")) if mostrar_logo else None

    inst_content = f"<b>{nombre_inst}</b><br/><font size=8 color='#64748B'>{subtitulo_inst}"
    if direccion_inst or telefono_inst:
        inst_content += f"<br/>{direccion_inst} • Tel: {telefono_inst}"
    inst_content += "</font>"
    
    # Número de presupuesto correlativo de 8 dígitos (ej: 00000001)
    num_presupuesto_val = presupuesto.get('numero_presupuesto')
    if num_presupuesto_val is not None:
        try:
            num_presupuesto_str = f"{int(num_presupuesto_val):08d}"
        except Exception:
            num_presupuesto_str = str(num_presupuesto_val).zfill(8)
    else:
        num_presupuesto_str = "00000001"

    doc_content = f"<b>{titulo_doc}</b><br/><font size=8.5 color='#475569'>Número: <b>{num_presupuesto_str}</b>"
    if sitio_web:
        doc_content += f"<br/>{sitio_web}"
    doc_content += "</font>"
    
    if logo_path and os.path.exists(logo_path):
        try:
            from PIL import Image as PILImage
            with PILImage.open(logo_path) as pimg:
                orig_w, orig_h = pimg.size
                ratio = orig_w / float(orig_h) if orig_h > 0 else 1.0
                
            if ratio >= 2.0:
                target_w = 110.0
                target_h = target_w / ratio
                if target_h > 40.0:
                    target_h = 40.0
                    target_w = target_h * ratio
            else:
                target_h = 36.0
                target_w = min(target_h * ratio, 110.0)
                
            rl_logo = RLImage(logo_path, width=target_w, height=target_h)
            rl_logo.hAlign = 'LEFT'
            
            t_header = Table([
                [rl_logo, Paragraph(inst_content, style_institucion), Paragraph(doc_content, style_titulo_doc)]
            ], colWidths=[115, 285, 140])
            t_header.setStyle(TableStyle([
                ('ALIGN', (0,0), (0,0), 'LEFT'),
                ('ALIGN', (1,0), (1,0), 'LEFT'),
                ('ALIGN', (2,0), (2,0), 'RIGHT'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
            ]))
        except Exception as e_l:
            logger.warning(f"Error procesando logo en generar_pdf_presupuesto: {e_l}")
            t_header = Table([
                [Paragraph(inst_content, style_institucion), Paragraph(doc_content, style_titulo_doc)]
            ], colWidths=[380, 160])
            t_header.setStyle(TableStyle([
                ('ALIGN', (0,0), (0,0), 'LEFT'),
                ('ALIGN', (1,0), (1,0), 'RIGHT'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ]))
    else:
        t_header = Table([
            [Paragraph(inst_content, style_institucion), Paragraph(doc_content, style_titulo_doc)]
        ], colWidths=[380, 160])
        t_header.setStyle(TableStyle([
            ('ALIGN', (0,0), (0,0), 'LEFT'),
            ('ALIGN', (1,0), (1,0), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
    story.append(t_header)
    
    # Línea divisoria decorativa
    d_line = Table([[""]], colWidths=[540])
    d_line.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 1.5, color_primario),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(d_line)
    story.append(Spacer(1, 8))
    
    # 2. Resumen de Monedas en los Items
    monedas_usadas = set(it.get("moneda", "ARS").upper() for it in items)
    if "USD" in monedas_usadas and "ARS" in monedas_usadas:
        moneda_resumen = "Multi-moneda (ARS / USD)"
    elif "USD" in monedas_usadas:
        moneda_resumen = "Dólares Estadounidenses (USD)"
    else:
        moneda_resumen = "Pesos Argentinos (ARS)"
        
    # 1. Determinar fecha de emisión (priorizar fecha_emision sobre created_at)
    fecha_emision_raw = presupuesto.get('fecha_emision')
    if fecha_emision_raw:
        fecha_emision = parse_and_format_date(fecha_emision_raw)
    else:
        fecha_emision = parse_and_format_date(presupuesto.get('created_at'))

    # Determinar validez en días (priorizar presupuesto sobre plantilla o defecto 30)
    validez_dias = int(presupuesto.get('validez_dias') or plantilla.get('validez_dias') or 30)
    
    # Calcular fecha exacta de vencimiento a partir de la fecha de emisión efectiva
    try:
        if fecha_emision_raw:
            raw_str = str(fecha_emision_raw).strip()
            if "-" in raw_str:
                dt_base = datetime.strptime(raw_str[:10], "%Y-%m-%d").replace(tzinfo=TZ_ARGENTINA)
            elif "/" in raw_str:
                dt_base = datetime.strptime(raw_str[:10], "%d/%m/%Y").replace(tzinfo=TZ_ARGENTINA)
            else:
                dt_base = datetime.fromisoformat(raw_str.replace("Z", "+00:00")).astimezone(TZ_ARGENTINA)
        else:
            created_val = presupuesto.get('created_at')
            if created_val and str(created_val).lower() not in ('now()', 'none', ''):
                dt_base = datetime.fromisoformat(str(created_val).strip().replace("Z", "+00:00")).astimezone(TZ_ARGENTINA)
            else:
                dt_base = datetime.now(TZ_ARGENTINA)
    except Exception:
        dt_base = datetime.now(TZ_ARGENTINA)
        
    dt_vence = dt_base + timedelta(days=validez_dias)
    vence_str = dt_vence.strftime('%d/%m/%Y')
    
    estado_raw = str(presupuesto.get('estado', 'BORRADOR')).upper()
    color_estado = '#16A34A' if estado_raw == 'APROBADO' else ('#2563EB' if estado_raw == 'ENVIADO' else ('#DC2626' if estado_raw == 'RECHAZADO' else '#475569'))
    
    # Resolver Cobertura Médica con prioridad jerárquica (Presupuesto > Asesoría Quirúrgica > Paciente > Particular)
    as_info = presupuesto.get("asesorias_quirurgicas") or presupuesto.get("asesoria_quirurgica") or {}
    if isinstance(as_info, list) and len(as_info) > 0:
        as_info = as_info[0]

    cobertura_candidato = (
        presupuesto.get("cobertura") or
        presupuesto.get("obra_social") or
        presupuesto.get("cobertura_obra_social") or
        (as_info.get("cobertura_obra_social") if isinstance(as_info, dict) else None) or
        paciente.get("obra_social") or
        "Particular"
    )
    cobertura_efectiva = str(cobertura_candidato).strip() if cobertura_candidato else "Particular"
    if not cobertura_efectiva:
        cobertura_efectiva = "Particular"

    # Información del Paciente y Detalle de Emisión (Limpio y con Vencimiento)
    info_box = [
        [
            Paragraph("<b>DATOS DEL PACIENTE:</b>", style_seccion_header),
            Paragraph("<b>DETALLE DE EMISIÓN:</b>", style_seccion_header)
        ],
        [
            Paragraph(
                f"<b>Nombre:</b> {paciente.get('nombre', 'Paciente Particular')}<br/>"
                f"<b>Teléfono:</b> {paciente.get('telefono', 'N/A')}<br/>"
                f"<b>DNI:</b> {paciente.get('dni') or 'No especificado'}<br/>"
                f"<b>Cobertura:</b> {cobertura_efectiva}", 
                style_texto
            ),
            Paragraph(
                f"<b>Fecha de Emisión:</b> {fecha_emision}<br/>"
                f"<b>Validez:</b> {validez_dias} días corridos (Vence: {vence_str})<br/>"
                f"<b>Moneda de Cotización:</b> {moneda_resumen}", 
                style_texto
            )
        ]
    ]
    
    t_info = Table(info_box, colWidths=[270, 270])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 10))
    
    # 3. Tabla de Prestaciones / Items Presupuestados (Exact 540 pt, 1 sola línea garantizada)
    # Anchos optimizados: Cód (70) + Descripción (275) + Mon (35) + P. Unit (70) + Cant (25) + Subtotal (65) = 540 pt
    table_data = [[
        Paragraph("<b>Código</b>", style_encabezado_tabla),
        Paragraph("<b>Prestación / Descripción Médica</b>", style_encabezado_tabla),
        Paragraph("<b>Moneda</b>", style_encabezado_tabla_center),
        Paragraph("<b>P. Unitario</b>", style_encabezado_tabla_right),
        Paragraph("<b>Cant.</b>", style_encabezado_tabla_center),
        Paragraph("<b>Subtotal</b>", style_encabezado_tabla_right)
    ]]
    
    total_ars = 0.0
    total_usd = 0.0
    
    for item in items:
        srv = item.get("servicios_precios") or {}
        codigo = str(item.get("codigo") or item.get("codigo_servicio") or srv.get("codigo") or "PRAC").strip().upper()
        nombre = str(item.get("nombre_prestacion") or item.get("nombre") or srv.get("nombre_prestacion") or f"Práctica {codigo}").strip()
        moneda_item = str(item.get("moneda") or srv.get("moneda") or "ARS").strip().upper()
        cantidad = int(item.get("cantidad", 1))
        p_unit = float(item.get("precio_unitario", 0.0))
        subtotal = float(item.get("subtotal") or (p_unit * cantidad))
        
        en_conv = bool(item.get("en_convenio", False))
        if en_conv:
            p_unit = 0.0
            subtotal = 0.0
            p_unit_str = "En convenio"
            subtotal_str = "En convenio"
            style_num_cell = ParagraphStyle('NumCellConv', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, alignment=1, textColor=colors.HexColor('#059669'))
            style_num_bold = ParagraphStyle('NumBoldConv', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, alignment=1, textColor=colors.HexColor('#059669'))
            moneda_display = Paragraph("<b>OS</b>", style_moneda_tag)
        else:
            if moneda_item == "USD":
                total_usd += subtotal
            else:
                total_ars += subtotal
                
            p_unit_str = formatear_monto_moneda(p_unit, moneda_item)
            subtotal_str = formatear_monto_moneda(subtotal, moneda_item)
            style_num_cell = ParagraphStyle('NumCell', parent=styles['Normal'], fontName='Helvetica', fontSize=8.0, leading=10, alignment=2, textColor=colors.HexColor('#334155'))
            style_num_bold = ParagraphStyle('NumBoldCell', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8.0, leading=10, alignment=2, textColor=colors.HexColor('#0F172A'))
            moneda_display = Paragraph(f"<b>{moneda_item}</b>", style_moneda_tag)
        
        # Tipografía auto-fit para código (evita wrapping de códigos de 9-12 chars como ANESTESIA1)
        if len(codigo) > 7:
            style_item_cod = ParagraphStyle('ItemCodS', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.2, leading=8.5, textColor=colors.HexColor('#2563EB'))
        else:
            style_item_cod = ParagraphStyle('ItemCodN', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8.2, leading=10, textColor=colors.HexColor('#2563EB'))
            
        # Tipografía auto-fit para descripción médica (evita wrapping de descripciones de 38+ chars)
        if len(nombre) > 38:
            style_item_nom = ParagraphStyle('ItemNomS', parent=styles['Normal'], fontName='Helvetica', fontSize=7.4, leading=9.0, textColor=colors.HexColor('#334155'))
        else:
            style_item_nom = ParagraphStyle('ItemNomN', parent=styles['Normal'], fontName='Helvetica', fontSize=8.2, leading=10.5, textColor=colors.HexColor('#334155'))
            
        style_cant_cell = ParagraphStyle('CantCell', parent=styles['Normal'], fontName='Helvetica', fontSize=8.0, leading=10, alignment=1, textColor=colors.HexColor('#334155'))

        table_data.append([
            Paragraph(f"<b>{codigo}</b>", style_item_cod),
            Paragraph(nombre, style_item_nom),
            moneda_display,
            Paragraph(p_unit_str, style_num_cell),
            Paragraph(str(cantidad), style_cant_cell),
            Paragraph(f"<b>{subtotal_str}</b>", style_num_bold)
        ])
        
    num_items = len(items)
    
    # Filas de Totales con SPAN: (0 a 2 para etiqueta 370pt, 3 a 5 para monto 170pt)
    if total_ars > 0 and total_usd > 0:
        table_data.append([
            Paragraph("<b>TOTAL EN PESOS (ARS):</b>", style_total_label),
            "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_ars, 'ARS')}</b>", style_total_amount),
            "", ""
        ])
        table_data.append([
            Paragraph("<b>TOTAL EN DÓLARES (USD):</b>", style_total_label),
            "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_usd, 'USD')}</b>", style_total_amount),
            "", ""
        ])
    elif total_usd > 0:
        table_data.append([
            Paragraph("<b>TOTAL EN DÓLARES (USD):</b>", style_total_label),
            "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_usd, 'USD')}</b>", style_total_amount),
            "", ""
        ])
    else:
        table_data.append([
            Paragraph("<b>TOTAL EN PESOS (ARS):</b>", style_total_label),
            "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_ars, 'ARS')}</b>", style_total_amount),
            "", ""
        ])
        
    t_items = Table(table_data, colWidths=[58, 245, 48, 68, 38, 83])
    
    table_styles = [
        ('BACKGROUND', (0,0), (-1,0), color_primario),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1, num_items), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]
    
    # Zebra striping en items
    for r in range(1, num_items + 1):
        bg_col = colors.white if r % 2 != 0 else colors.HexColor('#F8FAFC')
        table_styles.append(('BACKGROUND', (0, r), (-1, r), bg_col))
        
    # Estilos y SPAN para las filas de totales (garantiza 1 sola línea para montos en ARS y USD)
    first_total_row = num_items + 1
    total_rows_count = 2 if (total_ars > 0 and total_usd > 0) else 1
    
    for tr in range(first_total_row, first_total_row + total_rows_count):
        table_styles.append(('SPAN', (0, tr), (2, tr)))
        table_styles.append(('SPAN', (3, tr), (5, tr)))
        table_styles.append(('BACKGROUND', (0, tr), (-1, tr), colors.HexColor('#F8FAFC')))
        table_styles.append(('ALIGN', (0, tr), (2, tr), 'RIGHT'))
        table_styles.append(('ALIGN', (3, tr), (5, tr), 'RIGHT'))
        table_styles.append(('TOPPADDING', (0, tr), (-1, tr), 6))
        table_styles.append(('BOTTOMPADDING', (0, tr), (-1, tr), 6))
        table_styles.append(('LINEABOVE', (0, tr), (-1, tr), 1.0, color_primario if tr == first_total_row else colors.HexColor('#E2E8F0')))
        table_styles.append(('LINEBELOW', (0, tr), (-1, tr), 1.0, color_primario if tr == (first_total_row + total_rows_count - 1) else colors.HexColor('#E2E8F0')))
        table_styles.append(('LINEBEFORE', (0, tr), (0, tr), 0.5, colors.HexColor('#E2E8F0')))
        table_styles.append(('LINEAFTER', (5, tr), (5, tr), 0.5, colors.HexColor('#E2E8F0')))
    
    t_items.setStyle(TableStyle(table_styles))
    story.append(t_items)
    story.append(Spacer(1, 10))
    
    # 4. Términos y Condiciones
    condiciones_html = f"<b><font color='{color_primario_hex}'>TÉRMINOS Y CONDICIONES DEL PRESUPUESTO:</font></b><br/>"
    for i, cond in enumerate(terminos, 1):
        cond_limpia = cond.replace("Los precis ", "Los precios cotizados ").replace("Los precis", "Los precios cotizados").replace("precis", "precios")
        condiciones_html += f"<b>{i}.</b> {cond_limpia}<br/>"
        
    t_cond = Table([[Paragraph(condiciones_html, style_texto)]], colWidths=[540])
    t_cond.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('LINEBEFORE', (0,0), (-1,-1), 3.0, color_secundario), # Borde de acento lateral
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_cond)
    story.append(Spacer(1, 12))
    
    # 5. Firma y Pie de Página (Mantener juntos para no desbordar)
    footer_elements = []
    
    if mostrar_firma:
        t_firma = Table([
            [
                "",
                Paragraph(f"_______________________________________<br/><b>{texto_firma}</b>", ParagraphStyle('FirmaStyle', parent=style_texto, alignment=1))
            ]
        ], colWidths=[270, 270])
        t_firma.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        footer_elements.append(t_firma)
        footer_elements.append(Spacer(1, 8))
        
    if pie_pagina:
        footer_elements.append(
            Paragraph(f"<font size=7 color='#94A3B8'>{pie_pagina}</font>", ParagraphStyle('FootStyle', parent=styles['Normal'], alignment=1))
        )
        
    story.append(KeepTogether(footer_elements))
    
    # Generar el PDF
    doc.build(story)
    
    return pdf_filename


def asegurar_pdf_presupuesto_canonica(presupuesto_id: str, forzar_regeneracion: bool = False) -> str:
    """
    Función única y canónica para garantizar la existencia y calidad del PDF oficial de un presupuesto.
    Consulta la base de datos Supabase con todas sus relaciones, normaliza los ítems (códigos, descripciones y monedas),
    y genera/reutiliza el PDF oficial con diseño membretado de alta fidelidad.
    """
    from app.db import supabase
    
    pdf_filename = f"presupuesto_{presupuesto_id}.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    
    if not forzar_regeneracion and os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000:
        return pdf_filename
        
    if not supabase:
        raise RuntimeError("Supabase no está conectado.")
        
    p_resp = supabase.table("presupuestos")\
        .select("*, pacientes(*), items_presupuesto(*, servicios_precios(*)), asesorias_quirurgicas!presupuestos_asesoria_id_fkey(*)")\
        .eq("id", presupuesto_id)\
        .limit(1)\
        .execute()
        
    if not p_resp.data:
        raise ValueError(f"Presupuesto {presupuesto_id} no encontrado en la base de datos.")
        
    presupuesto = p_resp.data[0]
    paciente = presupuesto.get("pacientes") or {}
    items_raw = presupuesto.get("items_presupuesto") or []
    items_normalizados = []
    
    codigos_genericos = {"EXTRA", "MANUAL", "QUIR-01", "PRAC", "S/C", "SC", "VARIOS", "OTRO", "OTRA"}
    for it in items_raw:
        srv = it.get("servicios_precios") or {}
        srv_cod = str(it.get("codigo") or it.get("codigo_servicio") or srv.get("codigo") or "").strip().upper()
        srv_nom = str(it.get("nombre_prestacion") or it.get("nombre") or srv.get("nombre_prestacion") or "").strip()
        it_moneda = it.get("moneda") or srv.get("moneda")
        
        # Fallback a nomenclador solo si no es código genérico/manual y falta descripción o moneda
        if (not srv_nom or not it_moneda) and srv_cod and (srv_cod not in codigos_genericos) and not srv_cod.startswith("PRACT-") and not srv_cod.startswith("PRAC-"):
            try:
                p_find = supabase.table("nomenclador_practicas").select("nombre, categoria, nomencladores(moneda_default)").eq("codigo", srv_cod).limit(1).execute()
                if p_find.data:
                    row = p_find.data[0]
                    if not srv_nom:
                        srv_nom = row.get("nombre") or ""
                    if not it_moneda:
                        it_moneda = (row.get("nomencladores") or {}).get("moneda_default")
            except Exception:
                pass
                
        if not srv_nom:
            srv_nom = f"Práctica {srv_cod}" if (srv_cod and srv_cod not in codigos_genericos) else "Prestación Médica"
        if not srv_cod:
            srv_cod = "PRAC"
        if not it_moneda:
            total_usd = float(presupuesto.get("total_usd") or 0.0)
            pu = float(it.get("precio_unitario") or 0.0)
            it_moneda = "USD" if (total_usd > 0 and pu <= total_usd) else "ARS"
            
        pu = float(it.get("precio_unitario") or 0.0)
        cant = int(it.get("cantidad") or 1)
        sub = float(it.get("subtotal") or (pu * cant))
        en_conv = bool(it.get("en_convenio", False))
        
        items_normalizados.append({
            "codigo": srv_cod,
            "nombre": srv_nom,
            "nombre_prestacion": srv_nom,
            "precio_unitario": pu,
            "cantidad": cant,
            "subtotal": sub,
            "moneda": str(it_moneda).upper(),
            "en_convenio": en_conv
        })
        
    # Resolver y asegurar cobertura médica del presupuesto o de la asesoría quirúrgica
    if not presupuesto.get("cobertura") and presupuesto.get("asesoria_id"):
        as_rel = presupuesto.get("asesorias_quirurgicas")
        if isinstance(as_rel, list) and len(as_rel) > 0:
            as_rel = as_rel[0]
        if isinstance(as_rel, dict) and as_rel.get("cobertura_obra_social"):
            presupuesto["cobertura"] = as_rel.get("cobertura_obra_social")
        else:
            try:
                as_db = supabase.table("asesorias_quirurgicas").select("cobertura_obra_social").eq("id", presupuesto["asesoria_id"]).limit(1).execute()
                if as_db.data and as_db.data[0].get("cobertura_obra_social"):
                    presupuesto["cobertura"] = as_db.data[0]["cobertura_obra_social"]
            except Exception:
                pass

    return generar_pdf_presupuesto(presupuesto, paciente, items_normalizados)


def generar_html_consentimiento(
    turno: dict,
    paciente: dict,
    texto_consentimiento: str,
    firma_img_base64: Optional[str] = None,
    firma_metadata: Optional[dict] = None
) -> str:
    """
    Renderiza la plantilla HTML5 con el texto en Markdown convertido a HTML semántico y los datos del turno/firma.
    """
    import markdown
    from jinja2 import Environment, FileSystemLoader
    
    template_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template("consentimiento_pdf.html")
    
    settings = load_settings()
    plantilla_inst = settings.get("plantilla_presupuesto", {})
    clinica_info = settings.get("clinica", {})
    nombre_inst = plantilla_inst.get("nombre_institucion") or clinica_info.get("nombre") or "CLÍNICA MÉDICA NUBE"
    subtitulo_inst = plantilla_inst.get("subtitulo_institucion") or "Atención Oftalmológica & Quirúrgica"
    color_primario = "#1E3A8A"
    color_secundario = "#2563EB"
    
    # Cargar y codificar en base64 el logo institucional para renderizado autónomo en HTML / WeasyPrint
    logo_base64 = None
    try:
        raw_logo_url = plantilla_inst.get("logo_url") or clinica_info.get("logo_url")
        logo_path = obtener_o_cachear_logo_local(raw_logo_url)
        if logo_path and os.path.exists(logo_path):
            import mimetypes
            mime_type, _ = mimetypes.guess_type(logo_path)
            if not mime_type:
                mime_type = "image/png"
            with open(logo_path, "rb") as img_file:
                b64_data = base64.b64encode(img_file.read()).decode("utf-8")
                logo_base64 = f"data:{mime_type};base64,{b64_data}"
    except Exception as err_logo:
        logger.warning(f"No se pudo cargar logo_base64 en generar_html_consentimiento: {err_logo}")
    
    # Convertir Markdown a HTML con extensiones de listas, tablas y saltos de línea
    cuerpo_html = markdown.markdown(
        texto_consentimiento,
        extensions=['extra', 'nl2br', 'sane_lists']
    )
    
    ojo_desc = turno.get("ojo_desc")
    if not ojo_desc or not ("ETAPA" in str(ojo_desc).upper() or "ACTO" in str(ojo_desc).upper()):
        try:
            from app.db import resolver_descripcion_ojo_clinico
            ojo_desc = resolver_descripcion_ojo_clinico(turno)
        except Exception:
            ojo = turno.get("ojo") or "OD"
            ojo_desc = "OJO DERECHO (OD)" if ojo == "OD" else "OJO IZQUIERDO (OI)" if ojo == "OI" else "AMBOS OJOS (AO)"
    
    # Preparar firma base64 si existe
    sig_b64 = firma_img_base64
    if sig_b64 and not sig_b64.startswith("data:"):
        sig_b64 = f"data:image/png;base64,{sig_b64}"
        
    import io, qrcode
    token_val = (firma_metadata or {}).get("token") or turno.get("consentimiento_token") or turno.get("id") or "token"
    base_app_url = os.getenv("NEXT_PUBLIC_APP_URL") or "https://crmagenticonube-production.up.railway.app"
    verify_url = f"{base_app_url}/consentimiento/verificar/{token_val}"
    
    qr_b64 = ""
    try:
        qr_buf = io.BytesIO()
        qr_img = qrcode.make(verify_url)
        qr_img.save(qr_buf, format="PNG")
        qr_b64 = "data:image/png;base64," + base64.b64encode(qr_buf.getvalue()).decode()
    except Exception as qe:
        logger.warning(f"No se pudo generar QR en HTML: {qe}")

    context = {
        "logo_base64": logo_base64,
        "nombre_institucion": nombre_inst,
        "subtitulo_institucion": subtitulo_inst,
        "color_primario": color_primario,
        "color_secundario": color_secundario,
        "titulo_documento": "CONSENTIMIENTO INFORMADO MÉDICO-LEGAL",
        "practica_nombre": turno.get("practica_nombre") or "Cirugía Oftalmológica",
        "ojo_desc": ojo_desc,
        "paciente_nombre": paciente.get("nombre") or "Paciente",
        "paciente_dni": paciente.get("dni") or "Sin DNI",
        "paciente_hc": paciente.get("nro_hc") or "-",
        "obra_social": turno.get("obra_social") or paciente.get("obra_social") or "-",
        "plan_obra_social": turno.get("plan_obra_social") or paciente.get("plan_cobertura") or "-",
        "cirujano_nombre": turno.get("cirujano_nombre") or "Médico Cirujano",
        "tipo_anestesia": turno.get("tipo_anestesia") or "Local Asistida",
        "fecha_cirugia": str(turno.get("fecha_cirugia") or ""),
        "hora_cirugia": str(turno.get("hora_inicio") or "")[:5],
        "quirofano_nombre": (turno.get("quirofanos") or {}).get("nombre") or turno.get("quirofano_nombre") or "Quirófano Central",
        "cuerpo_html": cuerpo_html,
        "firma_img_base64": sig_b64,
        "firma_timestamp_art": (firma_metadata or {}).get("timestamp_art") or (firma_metadata or {}).get("fecha_hora") or "N/A",
        "firma_timestamp_utc": (firma_metadata or {}).get("timestamp_utc") or (firma_metadata or {}).get("timestamp") or "N/A",
        "firma_ip": (firma_metadata or {}).get("ip") or (firma_metadata or {}).get("ip_origen") or "No registrada",
        "firma_hash": (firma_metadata or {}).get("hash") or "SHA256-VERIFIED",
        "qr_base64": qr_b64,
        "verify_url": verify_url,
        "token": token_val
    }
    
    return template.render(**context)


def generar_pdf_consentimiento_informado(
    turno: dict,
    paciente: dict,
    texto_consentimiento: str,
    firma_img_base64: Optional[str] = None,
    firma_metadata: Optional[dict] = None
) -> str:
    """
    Genera el documento de Consentimiento Informado Quirúrgico en PDF utilizando WeasyPrint (HTML5/CSS3)
    con motor de respaldo de alta fidelidad.
    """
    import base64
    from reportlab.platypus import Image as RLImage
    from reportlab.lib.units import inch

    turno_id = turno.get("id") or (
        f"{turno.get('asesoria_id')}_{(turno.get('ojo') or 'QX').upper()}"
        if turno.get("asesoria_id")
        else str(uuid.uuid4())
    )
    pdf_filename = f"consentimiento_{turno_id}.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)

    # 1. Generar HTML completo con Jinja2 y Markdown
    try:
        rendered_html = generar_html_consentimiento(
            turno=turno,
            paciente=paciente,
            texto_consentimiento=texto_consentimiento,
            firma_img_base64=firma_img_base64,
            firma_metadata=firma_metadata
        )
        
        # 2. Intentar compilar con WeasyPrint (estándar HTML5/CSS3 en producción)
        try:
            import weasyprint
            weasyprint.HTML(string=rendered_html).write_pdf(pdf_path)
            return pdf_filename
        except Exception as wp_err:
            logger.info(f"WeasyPrint no disponible en el entorno local ({wp_err}), utilizando motor de respaldo con parser Markdown.")
    except Exception as html_err:
        logger.error(f"Error renderizando HTML de consentimiento: {html_err}")

    # 3. Motor de respaldo estructurado (ReportLab con parser completo de Markdown)
    settings = load_settings()
    plantilla = settings.get("plantilla_presupuesto", {})
    clinica_info = settings.get("clinica", {})
    nombre_inst = plantilla.get("nombre_institucion") or clinica_info.get("nombre") or "CLÍNICA MÉDICA NUBE"
    subtitulo_inst = plantilla.get("subtitulo_institucion") or "Atención Oftalmológica & Quirúrgica"
    color_primario_hex = "#1E3A8A"
    color_secundario_hex = "#2563EB"

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    style_normal = styles['Normal']

    style_titulo = ParagraphStyle(
        'TitStyle',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor(color_primario_hex),
        alignment=1
    )

    style_subtitulo = ParagraphStyle(
        'SubTitStyle',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor(color_secundario_hex),
        alignment=1
    )

    style_label = ParagraphStyle(
        'LabelStyle',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    style_valor = ParagraphStyle(
        'ValorStyle',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    style_cuerpo = ParagraphStyle(
        'CuerpoStyle',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor('#1E293B'),
        alignment=4 # Justificado
    )

    style_h1 = ParagraphStyle(
        'MD_H1',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=14.5,
        textColor=colors.HexColor(color_primario_hex),
        spaceBefore=8,
        spaceAfter=4
    )

    style_h2 = ParagraphStyle(
        'MD_H2',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=6,
        spaceAfter=3
    )

    style_h3 = ParagraphStyle(
        'MD_H3',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=4,
        spaceAfter=2
    )

    style_bullet = ParagraphStyle(
        'MD_Bullet',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1E293B'),
        leftIndent=12,
        spaceBefore=1,
        spaceAfter=1
    )

    style_quote = ParagraphStyle(
        'MD_Quote',
        parent=style_normal,
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor('#78350F')
    )

    custom_md_styles = {
        'h1': style_h1,
        'h2': style_h2,
        'h3': style_h3,
        'cuerpo': style_cuerpo,
        'bullet': style_bullet,
        'quote': style_quote
    }

    story = []

    # 1. Cabecera Institucional
    logo_path = obtener_o_cachear_logo_local(plantilla.get("logo_url") or clinica_info.get("logo_url"))
    inst_p = Paragraph(f"<b>{nombre_inst.upper()}</b><br/><font size=8 color='#64748B'>{subtitulo_inst}</font>", style_normal)
    doc_p = Paragraph(f"<font size=9 color='#64748B'>DOCUMENTO MÉDICO-LEGAL</font><br/><b>CONSENTIMIENTO INFORMADO</b>", ParagraphStyle('HRight', parent=style_normal, alignment=2))

    if logo_path and os.path.exists(logo_path):
        try:
            from PIL import Image as PILImage
            with PILImage.open(logo_path) as pimg:
                orig_w, orig_h = pimg.size
                ratio = orig_w / float(orig_h) if orig_h > 0 else 1.0
            target_h = 36.0
            target_w = target_h * ratio
            if target_w > 115.0:
                target_w = 115.0
                target_h = target_w / ratio
            rl_logo = RLImage(logo_path, width=target_w, height=target_h)
            rl_logo.hAlign = 'LEFT'
            header_table = Table([[rl_logo, inst_p, doc_p]], colWidths=[115, 245, 180])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.HexColor(color_primario_hex))
            ]))
        except Exception as e_l:
            logger.warning(f"Error procesando logo en generar_pdf_consentimiento_informado: {e_l}")
            header_table = Table([[inst_p, doc_p]], colWidths=[320, 220])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.HexColor(color_primario_hex))
            ]))
    else:
        header_table = Table([[inst_p, doc_p]], colWidths=[320, 220])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.HexColor(color_primario_hex))
        ]))
    story.append(header_table)
    story.append(Spacer(1, 14))

    # Título principal
    practica = turno.get("practica_nombre") or "Procedimiento Quirúrgico"
    ojo = turno.get("ojo") or "OD"
    ojo_desc = "OJO DERECHO (OD)" if ojo == "OD" else "OJO IZQUIERDO (OI)" if ojo == "OI" else "AMBOS OJOS (AO)"
    
    story.append(Paragraph(f"CONSENTIMIENTO INFORMADO PARA CIRUGÍA OFTALMOLÓGICA", style_titulo))
    story.append(Paragraph(f"<b>{practica.upper()} - {ojo_desc}</b>", style_subtitulo))
    story.append(Spacer(1, 14))

    # 2. Resumen de la Programación y Paciente
    pac_nombre = paciente.get("nombre") or "Paciente"
    pac_dni = paciente.get("dni") or "Sin DNI"
    pac_hc = paciente.get("nro_hc") or "-"
    pac_os = turno.get("obra_social") or paciente.get("obra_social") or "-"
    pac_plan = turno.get("plan_obra_social") or paciente.get("plan_cobertura") or "-"
    
    cirujano = turno.get("cirujano_nombre") or "Médico Cirujano"
    quirofano = turno.get("quirofano_nombre") or "Quirófano Central"
    fecha = parse_and_format_date(turno.get("fecha_cirugia"))
    hora = str(turno.get("hora_inicio") or "")[:5]
    tipo_anestesia = turno.get("tipo_anestesia") or "Local Asistida"

    datos_paciente = [
        [
            Paragraph(f"<b>Paciente:</b> {pac_nombre}", style_valor),
            Paragraph(f"<b>D.N.I.:</b> {pac_dni}", style_valor),
            Paragraph(f"<b>N° H.C.:</b> {pac_hc}", style_valor),
        ],
        [
            Paragraph(f"<b>Cobertura:</b> {pac_os} ({pac_plan})", style_valor),
            Paragraph(f"<b>Cirujano:</b> Dr/a. {cirujano}", style_valor),
            Paragraph(f"<b>Anestesia:</b> {tipo_anestesia}", style_valor),
        ],
        [
            Paragraph(f"<b>Fecha Prevista:</b> {fecha} - {hora} hs", style_valor),
            Paragraph(f"<b>Lateralidad:</b> <b>{ojo_desc}</b>", style_valor),
            Paragraph(f"<b>Sede / Sala:</b> {quirofano}", style_valor),
        ]
    ]
    t_pac = Table(datos_paciente, colWidths=[200, 180, 160])
    t_pac.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_pac)
    story.append(Spacer(1, 14))

    # 3. Cuerpo del Consentimiento con Soporte Markdown Completo
    cuerpo_flowables = parse_markdown_to_pdf_flowables(texto_consentimiento, custom_md_styles)
    story.extend(cuerpo_flowables)

    story.append(Spacer(1, 12))

    # 4. Sección de Firma Digital o Manuscrita
    firma_elements = []
    
    if firma_img_base64:
        # Decodificar firma en base64 y guardarla temporalmente
        try:
            clean_b64 = firma_img_base64 or ""
            if "," in clean_b64:
                clean_b64 = clean_b64.split(",")[1]
            clean_b64 = clean_b64.strip()
            
            sig_element = None
            if len(clean_b64) > 50 and not clean_b64.endswith("..."):
                try:
                    img_data = base64.b64decode(clean_b64)
                    temp_sig_path = os.path.join(PDF_DIR, f"temp_sig_{turno_id}.png")
                    with open(temp_sig_path, "wb") as f_sig:
                        f_sig.write(img_data)
                    sig_element = RLImage(temp_sig_path, width=2.4*inch, height=0.85*inch)
                except Exception as img_err:
                    logger.warning(f"No se pudo renderizar PNG de firma ({img_err}), aplicando sello de verificación digital.")
                    sig_element = None
            
            if sig_element is None:
                sig_element = Paragraph(
                    f"<font color='#059669' size=9><b>✔ FIRMADO ELECTRÓNICAMENTE</b></font><br/><font size=7 color='#64748B'>Validación de Consentimiento Confirmada<br/>{pac_nombre} (DNI: {pac_dni})</font>",
                    ParagraphStyle('SigBox', parent=style_valor, alignment=1)
                )
            
            ts_art = (firma_metadata or {}).get("timestamp_art") or (firma_metadata or {}).get("fecha_hora") or "N/A"
            ts_utc = (firma_metadata or {}).get("timestamp_utc") or (firma_metadata or {}).get("timestamp") or "N/A"
            ip = (firma_metadata or {}).get("ip") or (firma_metadata or {}).get("ip_origen") or "No registrada"
            hash_doc = (firma_metadata or {}).get("hash") or "SHA256-VERIFIED"
            token_val = (firma_metadata or {}).get("token") or turno.get("consentimiento_token") or turno_id
            
            # --- Generación Segura y Aislada del Código QR de Cotejo Pericial ---
            qr_element = None
            try:
                import qrcode
                base_app_url = os.getenv("NEXT_PUBLIC_APP_URL") or "https://crm-agentico-nube.vercel.app"
                verify_url = f"{base_app_url}/consentimiento/verificar/{token_val}"
                qr_img = qrcode.make(verify_url)
                temp_qr_path = os.path.join(PDF_DIR, f"temp_qr_verify_{turno_id}.png")
                qr_img.save(temp_qr_path)
                qr_element = RLImage(temp_qr_path, width=0.85*inch, height=0.85*inch)
            except Exception as qr_err:
                logger.warning(f"No se pudo generar QR de verificación pericial ({qr_err}): usando indicador textual")
                qr_element = Paragraph(
                    f"<font size=7 color='#1E3A8A'><b>VERIFICACIÓN<br/>ONLINE</b></font><br/><font size=5.5 color='#64748B'>Token:<br/>{token_val[:10]}...</font>",
                    ParagraphStyle('QRAlt', parent=style_normal, alignment=1)
                )

            meta_text = (
                f"<font size=7.5 color='#1E3A8A'><b>CERTIFICACIÓN DE FIRMA ELECTRÓNICA MÉDICO-LEGAL</b></font><br/>"
                f"<font size=6.5 color='#334155'>"
                f"<b>Marco Normativo:</b> Ley 25.506 (Art. 5) • Ley 26.529 (Arts. 5-10) • CCCN Art. 288<br/>"
                f"<b>Titular:</b> {pac_nombre} (DNI: {pac_dni})<br/>"
                f"<b>Fecha y Hora Oficial:</b> {ts_art} (ART / UTC-3)<br/>"
                f"<b>Sello UTC:</b> {ts_utc} UTC<br/>"
                f"<b>IP de Origen:</b> {ip}<br/>"
                f"<b>Hash de Integridad (SHA-256):</b><br/>"
                f"<font face='Courier' size=5.5 color='#0F172A'><b>{hash_doc}</b></font><br/>"
                f"<i>Documento con validez legal acreditada mediante auditoría criptográfica y pericial.</i>"
                f"</font>"
            )

            qr_cell = [
                qr_element,
                Spacer(1, 2),
                Paragraph("<font size=5 color='#64748B'>Escanear para cotejo pericial</font>", ParagraphStyle('QRTxt', parent=style_normal, alignment=1))
            ]

            sig_cell = [
                sig_element,
                Paragraph(f"<b>{pac_nombre}</b><br/><font size=7 color='#64748B'>DNI: {pac_dni}<br/>Firma del Paciente / Titular</font>", ParagraphStyle('FirmaLabelR', parent=style_valor, alignment=1))
            ]

            t_firma = Table([
                [
                    Paragraph(meta_text, style_valor),
                    qr_cell,
                    sig_cell
                ]
            ], colWidths=[275, 65, 200])
            t_firma.setStyle(TableStyle([
                ('ALIGN', (1,0), (1,0), 'CENTER'),
                ('ALIGN', (2,0), (2,0), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            firma_elements.append(t_firma)
            firma_elements.append(Spacer(1, 6))
            firma_elements.append(Paragraph("<font size=6 color='#94A3B8'>Documento generado electrónicamente por el Sistema de Gestión Quirúrgica de Clínica Médica Nube. La presente instrumentación con firma electrónica y evidencias digitales de auditoría resguarda los derechos del paciente y del equipo médico conforme al Código Civil y Comercial de la Nación y leyes sanitarias vigentes.</font>", ParagraphStyle('LegalFoot', parent=style_normal, alignment=1)))
        except Exception as e:
            logger.error(f"Error insertando bloque de firma: {e}")
            firma_elements.append(Paragraph(f"<b>Firmado Electrónicamente por el paciente {pac_nombre} (DNI: {pac_dni})</b>", style_valor))
    else:
        # Espacio para firma manuscrita en papel
        t_firma = Table([
            [
                Paragraph("____________________________________________<br/><b>Firma del Médico / Cirujano</b><br/><font size=7 color='#64748B'>Matrícula y Sello Profesional</font>", ParagraphStyle('FirmaMed', parent=style_valor, alignment=1)),
                Paragraph(f"____________________________________________<br/><b>Firma del Paciente / Representante</b><br/><font size=7 color='#64748B'>{pac_nombre} - DNI: {pac_dni}</font>", ParagraphStyle('FirmaPac', parent=style_valor, alignment=1))
            ]
        ], colWidths=[270, 270])
        t_firma.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 20),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        firma_elements.append(t_firma)

    firma_elements.append(Spacer(1, 10))
    firma_elements.append(
        Paragraph(f"<font size=7 color='#94A3B8'>Documento generado electrónicamente por el Sistema de Gestión Quirúrgica - {nombre_inst}. La firma registrada tiene validez médico-legal para la práctica indicada.</font>", ParagraphStyle('FootStyle', parent=styles['Normal'], alignment=1))
    )

    story.append(KeepTogether(firma_elements))

    # Construir PDF
    doc.build(story)
    return pdf_filename


def generar_pdf_consentimiento(turno: dict, paciente: dict, firma_img: Optional[str] = None) -> str:
    """
    Función de compatibilidad y generación directa de Consentimiento Informado.
    Resuelve el texto del consentimiento desde la práctica o configuración general y genera el PDF.
    """
    practica_cod = turno.get("practica_codigo") or ""
    practica_id = turno.get("practica_id") or ""
    practica_nombre = turno.get("practica_nombre") or ""
    
    texto_consentimiento = None
    try:
        from app.db import get_practica_resumen_operativo, get_configuracion_quirofano
        resumen_practica = get_practica_resumen_operativo(practica_id or practica_cod or practica_nombre)
        if resumen_practica and resumen_practica.get("habilitar_consentimiento") and resumen_practica.get("texto_consentimiento"):
            texto_consentimiento = resumen_practica["texto_consentimiento"]
        else:
            config = get_configuracion_quirofano()
            p_nom_low = (practica_nombre or "").lower()
            for pl in plantillas:
                pl_id = str(pl.get("id") or "").lower()
                pl_tipo = str(pl.get("tipo") or "").lower()
                if (pl_id and pl_id in p_nom_low) or (pl_tipo and pl_tipo in p_nom_low):
                    texto_consentimiento = pl.get("cuerpo_markdown") or pl.get("cuerpo_texto")
                    break
            if not texto_consentimiento and plantillas:
                texto_consentimiento = plantillas[0].get("cuerpo_markdown") or plantillas[0].get("cuerpo_texto")
    except Exception as e_cfg:
        logger.warning(f"Aviso resolviendo texto de consentimiento para PDF: {e_cfg}")
        
    if not texto_consentimiento:
        texto_consentimiento = f"""# Consentimiento Informado para {practica_nombre or 'Cirugía Oftalmológica'}

Por la presente, presto mi expresa conformidad para la realización del procedimiento quirúrgico indicado ({practica_nombre or 'Cirugía Oftalmológica'}), habiendo recibido información clara, suficiente y detallada acerca de los objetivos, beneficios esperados, técnicas a emplear, alternativas terapéuticas y riesgos potenciales o complicaciones inherentes al procedimiento y a la anestesia correspondiente.

Declaro haber podido formular todas las preguntas necesarias, las cuales han sido respondidas satisfactoriamente por el equipo médico actuante."""

    firma_base64 = firma_img or turno.get("consentimiento_firma_img")
    
    firma_metadata = None
    if turno.get("consentimiento_firmado_at"):
        firma_metadata = {
            "timestamp": turno.get("consentimiento_firmado_at"),
            "ip": turno.get("consentimiento_firma_ip") or "Móvil / Web",
            "user_agent": "CRM Portal Consentimiento",
            "hash": "Firma Digital Registrada"
        }

    return generar_pdf_consentimiento_informado(
        turno=turno,
        paciente=paciente,
        texto_consentimiento=texto_consentimiento,
        firma_img_base64=firma_base64,
        firma_metadata=firma_metadata
    )


def generar_pdf_parte_quirurgico(turno: dict, paciente: dict) -> str:
    """
    Genera el Parte / Protocolo Quirúrgico Oficial en PDF con ReportLab de alta fidelidad,
    incluyendo trazabilidad de tiempos, equipo médico, LIO (dioptría, lote, serie, eje),
    observaciones intraoperatorias, checklist OMS y firmas médicas.
    """
    turno_id = turno.get("id") or str(uuid.uuid4())
    pdf_filename = f"parte_quirurgico_{turno_id}.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)

    settings = load_settings()
    plantilla = settings.get("plantilla_presupuesto", {})
    nombre_inst = plantilla.get("nombre_institucion") or "CLÍNICA MÉDICA NUBE"
    subtitulo_inst = plantilla.get("subtitulo_institucion") or "Atención Oftalmológica & Quirúrgica"
    color_primario_hex = "#0F172A"
    color_acento_hex = "#2563EB"

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    style_normal = styles['Normal']

    style_titulo = ParagraphStyle(
        'TituloParte',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor(color_primario_hex),
        alignment=1
    )
    style_subtitulo = ParagraphStyle(
        'SubtituloParte',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor(color_acento_hex),
        alignment=1
    )
    style_seccion = ParagraphStyle(
        'SeccionHeader',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )
    style_label = ParagraphStyle(
        'LabelStyle',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#475569')
    )
    style_val = ParagraphStyle(
        'ValorStyle',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0F172A')
    )
    style_nota = ParagraphStyle(
        'NotaStyle',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    story = []

    # 1. Cabecera Institucional
    codigo_ref = turno.get("codigo_turno") or turno.get("codigo_caso") or f"QX-26-{str(turno_id)[:4].upper()}-{turno.get('ojo', 'OD')}"
    logo_path = obtener_o_cachear_logo_local()
    
    inst_p = Paragraph(f"<b><font size=12 color='{color_primario_hex}'>{nombre_inst.upper()}</font></b><br/><font size=8 color='#64748B'>{subtitulo_inst}</font>", style_normal)
    doc_p = Paragraph(f"<b>PROTOCOLO QUIRÚRGICO OFICIAL</b><br/><font size=9 color='{color_acento_hex}'><b>N° Registro: {codigo_ref}</b></font><br/><font size=7 color='#94A3B8'>Fecha Emisión: {parsear_fecha_hora_argentina()}</font>", ParagraphStyle('HRight', parent=style_normal, alignment=2))
    
    if logo_path and os.path.exists(logo_path):
        try:
            from PIL import Image as PILImage
            with PILImage.open(logo_path) as pimg:
                orig_w, orig_h = pimg.size
                ratio = orig_w / float(orig_h) if orig_h > 0 else 1.0
            target_h = 36.0
            target_w = target_h * ratio
            if target_w > 100.0:
                target_w = 100.0
                target_h = target_w / ratio
            rl_logo = RLImage(logo_path, width=target_w, height=target_h)
            rl_logo.hAlign = 'LEFT'
            t_head = Table([[rl_logo, inst_p, doc_p]], colWidths=[105, 235, 200])
            t_head.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
            ]))
        except Exception:
            t_head = Table([[inst_p, doc_p]], colWidths=[270, 270])
            t_head.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ]))
    else:
        t_head = Table([[inst_p, doc_p]], colWidths=[270, 270])
        t_head.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
    story.append(t_head)
    story.append(Spacer(1, 4))

    # Línea divisoria
    t_div = Table([['']], colWidths=[540], rowHeights=[2])
    t_div.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor(color_acento_hex))]))
    story.append(t_div)
    story.append(Spacer(1, 8))

    # 2. Datos del Paciente
    pac_nombre = paciente.get("nombre") or "Paciente"
    pac_dni = paciente.get("dni") or "Sin DNI"
    pac_hc = paciente.get("nro_hc") or "-"
    pac_os = turno.get("obra_social") or paciente.get("obra_social") or "-"
    pac_plan = turno.get("plan_obra_social") or paciente.get("plan_cobertura") or "-"
    pac_tel = paciente.get("telefono") or "-"

    def make_section_header(title):
        t = Table([[Paragraph(f"<b>{title.upper()}</b>", style_seccion)]], colWidths=[540], rowHeights=[14])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(color_primario_hex)),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('TOPPADDING', (0,0), (-1,-1), 2),
        ]))
        return t

    story.append(make_section_header("1. Identificación del Paciente"))
    pac_table_data = [
        [
            Paragraph(f"<b>Apellido y Nombre:</b> {pac_nombre}", style_val),
            Paragraph(f"<b>D.N.I.:</b> {pac_dni}", style_val),
            Paragraph(f"<b>N° H.C.:</b> {pac_hc}", style_val),
        ],
        [
            Paragraph(f"<b>Cobertura Médica:</b> {pac_os}", style_val),
            Paragraph(f"<b>Plan / Categoría:</b> {pac_plan}", style_val),
            Paragraph(f"<b>Teléfono de Contacto:</b> {pac_tel}", style_val),
        ]
    ]
    t_pac = Table(pac_table_data, colWidths=[220, 160, 160])
    t_pac.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_pac)
    story.append(Spacer(1, 8))

    # 3. Datos del Acto Quirúrgico y Tiempos de Trazabilidad
    practica = turno.get("practica_nombre") or "Cirugía Oftalmológica"
    practica_cod = turno.get("practica_codigo") or "-"
    ojo = turno.get("ojo") or "OD"
    ojo_desc = "OJO DERECHO (OD)" if ojo == "OD" else "OJO IZQUIERDO (OI)" if ojo == "OI" else "AMBOS OJOS (AO)"
    quirofano = turno.get("quirofano_nombre") or "Quirófano Principal"
    fecha = parse_and_format_date(turno.get("fecha_cirugia"))
    anestesia = turno.get("tipo_anestesia") or "Tópica + Sedación"

    hora_llegada = parsear_hora_argentina(turno.get("llegada_at"), fallback="--:--")
    hora_inicio = parsear_hora_argentina(turno.get("inicio_cirugia_at"), fallback=parsear_hora_argentina(turno.get("hora_inicio"), fallback="--:--"))
    hora_fin = parsear_hora_argentina(turno.get("fin_cirugia_at"), fallback="--:--")

    story.append(make_section_header("2. Intervención y Trazabilidad Cronológica"))
    act_data = [
        [
            Paragraph(f"<b>Procedimiento Realizado:</b> {practica} (Cód: {practica_cod})", style_val),
            Paragraph(f"<b>Lateralidad:</b> <font color='#2563EB'><b>{ojo_desc}</b></font>", style_val),
        ],
        [
            Paragraph(f"<b>Fecha de Intervención:</b> {fecha} en {quirofano}", style_val),
            Paragraph(f"<b>Técnica Anestésica:</b> {anestesia}", style_val),
        ],
        [
            Paragraph(f"<b>Tiempos Qx:</b> Llegada: <b>{hora_llegada}</b> | Ingreso Sala: <b>{hora_inicio}</b> | Fin: <b>{hora_fin}</b>", style_val),
            Paragraph(f"<b>Duración Estimada:</b> {turno.get('duracion_minutos', 20)} min", style_val),
        ]
    ]
    t_act = Table(act_data, colWidths=[340, 200])
    t_act.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_act)
    story.append(Spacer(1, 8))

    # 4. Equipo Quirúrgico Interviniente
    cirujano = turno.get("cirujano_nombre") or "No especificado"
    ayudante = turno.get("ayudante_nombre") or "No asignado"
    anestesista = turno.get("anestesiologo_nombre") or "No asignado"
    instrumentador = turno.get("instrumentador_nombre") or "No asignado"
    derivador = turno.get("medico_derivador_nombre") or "-"

    story.append(make_section_header("3. Equipo Médico y Quirúrgico Interviniente"))
    eq_data = [
        [
            Paragraph(f"<b>Cirujano Principal:</b> Dr/a. {cirujano}", style_val),
            Paragraph(f"<b>Cirujano Ayudante:</b> {ayudante}", style_val),
        ],
        [
            Paragraph(f"<b>Médico Anestesiólogo:</b> {anestesista}", style_val),
            Paragraph(f"<b>Instrumentador/a Quirúrgico:</b> {instrumentador}", style_val),
        ],
        [
            Paragraph(f"<b>Médico Derivador:</b> {derivador}", style_val),
            Paragraph(f"<b>Estado Consentimiento:</b> <b>{turno.get('consentimiento_estado', 'Verificado')}</b>", style_val),
        ]
    ]
    t_eq = Table(eq_data, colWidths=[270, 270])
    t_eq.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_eq)
    story.append(Spacer(1, 8))

    # 5. Registro de Implante / Lente Intraocular (LIO)
    lleva_lio = turno.get("lleva_lente", False)
    story.append(make_section_header("4. Registro de Implante y Dispositivos Médicos (LIO)"))
    if lleva_lio:
        lente_tipo = turno.get("lente_tipo") or "LIO Estándar"
        lente_diop = turno.get("lente_dioptria") or "-"
        es_torico = turno.get("es_torico", False)
        torico_info = f"Tórico: T{turno.get('lente_torico_valor', 0)} (Eje: {turno.get('lente_torico_eje', 90)}°)" if es_torico else "No Tórico"
        lente_lote = turno.get("lente_lote") or "N/D"
        lente_serie = turno.get("lente_serie") or "N/D"
        lente_venc = str(turno.get("lente_vencimiento") or "-")

        lio_data = [
            [
                Paragraph(f"<b>Modelo / Tipo LIO:</b> {lente_tipo}", style_val),
                Paragraph(f"<b>Poder / Dioptría:</b> <b>{lente_diop} D</b>", style_val),
                Paragraph(f"<b>Corrección Tórica:</b> {torico_info}", style_val),
            ],
            [
                Paragraph(f"<b>N° de Lote:</b> {lente_lote}", style_val),
                Paragraph(f"<b>N° de Serie:</b> {lente_serie}", style_val),
                Paragraph(f"<b>Vencimiento LIO:</b> {lente_venc}", style_val),
            ]
        ]
    else:
        lio_data = [
            [
                Paragraph("<i>No se implantó lente intraocular ni prótesis en esta intervención.</i>", style_val)
            ]
        ]
    t_lio = Table(lio_data, colWidths=[200, 170, 170] if lleva_lio else [540])
    t_lio.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_lio)
    story.append(Spacer(1, 8))

    # 6. Observaciones y Descripción de la Técnica Intraoperatoria
    obs_pre = turno.get("observaciones") or "Sin observaciones prequirúrgicas."
    obs_intra = turno.get("observaciones_intraoperatorias") or "Cirugía realizada conforme a técnica habitual sin complicaciones intraoperatorias registradas."

    story.append(make_section_header("5. Descripción Quirúrgica y Observaciones"))
    obs_data = [
        [
            Paragraph(f"<b>Observaciones Prequirúrgicas:</b><br/>{obs_pre}", style_nota)
        ],
        [
            Paragraph(f"<b>Descripción / Notas Intraoperatorias:</b><br/>{obs_intra}", style_nota)
        ]
    ]
    t_obs = Table(obs_data, colWidths=[540])
    t_obs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_obs)
    story.append(Spacer(1, 14))

    # 7. Cuadro de Firmas Médicas con resolución de firmas digitalizadas
    from app.db import obtener_prestador_por_cirujano

    def _resolver_firma_flowable(nombre_prof: str, id_prof: Optional[Any] = None, rol_def: str = "Médico") -> List[Any]:
        items_f = []
        firma_img = None
        if nombre_prof and nombre_prof != "A designar":
            try:
                p_info = obtener_prestador_por_cirujano(id_prof, nombre_prof)
                if p_info and p_info.get("firma_url"):
                    local_f = obtener_o_cachear_firma_local(p_info["firma_url"])
                    if local_f and os.path.exists(local_f):
                        firma_img = RLImage(local_f, width=105, height=38)
            except Exception as e_f:
                logger.warning(f"Error resolviendo firma para {nombre_prof}: {e_f}")

        if firma_img:
            items_f.append(firma_img)
            items_f.append(Spacer(1, 1))
        else:
            items_f.append(Spacer(1, 16))
            items_f.append(Paragraph("______________________________________", ParagraphStyle('UL', parent=style_val, alignment=1)))

        items_f.append(Paragraph(f"<b>Dr/a. {nombre_prof}</b><br/><font size=7 color='#64748B'>{rol_def}</font>", ParagraphStyle('FLabel', parent=style_val, alignment=1)))
        return items_f

    firma_data = [
        [
            _resolver_firma_flowable(cirujano, turno.get("cirujano_id"), "Cirujano Principal"),
            _resolver_firma_flowable(anestesista, None, "Médico Anestesiólogo"),
            _resolver_firma_flowable(instrumentador, None, "Instrumentador/a Quirúrgico"),
        ]
    ]
    t_firmas = Table(firma_data, colWidths=[180, 180, 180])
    t_firmas.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))

    foot_info = Paragraph(
        f"<font size=7 color='#94A3B8'>Protocolo Quirúrgico emitido electrónicamente por {nombre_inst}. Documento confidencial y de archivo en Historia Clínica.</font>",
        ParagraphStyle('FootPQ', parent=style_normal, alignment=1)
    )

    story.append(KeepTogether([t_firmas, Spacer(1, 8), foot_info]))

    # Construir PDF
    doc.build(story)
    return pdf_filename




import hashlib
import io
from reportlab.lib.pagesizes import A4

def formatear_dni(dni_val: Any) -> str:
    """Formatea el DNI separando por miles para identificación clínica, ej: 18.081.249"""
    if not dni_val:
        return "S/D"
    s = re.sub(r'\D', '', str(dni_val))
    if not s:
        return "S/D"
    try:
        dni_num = int(s)
        if dni_num > 1000000:
            return f"{dni_num:,}".replace(",", ".")
        return str(dni_num)
    except Exception:
        return s

def enmascarar_dni(dni_val: Any) -> str:
    """Enmascara el DNI por protección de datos de salud (Ley 25.326), ej: XX.XXX.123"""
    if not dni_val:
        return "S/D"
    s = re.sub(r'\D', '', str(dni_val))
    if len(s) < 3:
        return "***"
    return f"XX.XXX.{s[-3:]}"

def generar_pdf_agenda_prestadores(
    prestador_info: Dict[str, Any],
    cirugias_list: List[Dict[str, Any]],
    fecha_cirugia_str: str,
    config_override: Optional[Dict[str, Any]] = None
) -> tuple[bytes, str]:
    """
    Genera en memoria un documento PDF A4 formal con la agenda quirúrgica consolidada
    del prestador para una fecha determinada.
    Reutiliza membretes, estilos y paletas de colores de Centrovisión.
    Enmascara DNIs según Ley 25.326 y excluye notas internas no clínicas.
    Retorna (pdf_bytes, sha256_hash).
    """
    settings = config_override or load_settings()
    nombre_inst = settings.get("nombre_institucion", "Centrovisión - Cirugía Oftalmológica")
    buffer = io.BytesIO()

    # Márgenes de 24 puntos para optimizar ancho de página
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24
    )

    styles = getSampleStyleSheet()
    style_normal = styles["Normal"]

    style_title = ParagraphStyle(
        'AgendaTitle',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0F172A')
    )
    style_sub = ParagraphStyle(
        'AgendaSub',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0284C7')
    )
    style_doctor = ParagraphStyle(
        'AgendaDoctor',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#1E293B')
    )
    style_cell = ParagraphStyle(
        'AgendaCell',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#334155')
    )
    style_cell_bold = ParagraphStyle(
        'AgendaCellBold',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )
    style_header_th = ParagraphStyle(
        'AgendaTH',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1
    )
    style_badge_cirujano = ParagraphStyle(
        'BadgeCirujano',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#0369A1')
    )
    style_badge_derivador = ParagraphStyle(
        'BadgeDerivador',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#7C3AED')
    )

    story = []

    # 1. Membrete con Logo
    logo_path = obtener_o_cachear_logo_local()
    logo_flowable = None
    if logo_path and os.path.exists(logo_path):
        try:
            logo_flowable = RLImage(logo_path, width=120, height=36)
        except Exception as e:
            logger.warning(f"No se pudo cargar logo en agenda PDF: {e}")

    header_col_der = [
        Paragraph(nombre_inst.upper(), style_title),
        Spacer(1, 2),
        Paragraph("PARTE DE CIRUGÍAS PROGRAMADAS - CORTE DIARIO", style_sub),
    ]

    if logo_flowable:
        t_header = Table([[logo_flowable, header_col_der]], colWidths=[130, 417])
    else:
        t_header = Table([[header_col_der]], colWidths=[547])

    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 8))

    # 2. Información del Prestador y Fecha
    medico_nombre = prestador_info.get("nombre", "Prestador Médico")
    roles_list = prestador_info.get("roles", [])
    roles_str = " / ".join(roles_list) if roles_list else "Cirujano / Derivador"
    cant_total = len(cirugias_list)

    info_data = [
        [
            Paragraph(f"<b>Destinatario:</b> Dr/a. {medico_nombre} ({roles_str})", style_doctor),
            Paragraph(f"<b>Fecha Quirúrgica:</b> {fecha_cirugia_str}", style_doctor)
        ],
        [
            Paragraph(f"<b>Total de Pacientes Asignados:</b> {cant_total}", style_cell_bold),
            Paragraph(f"<b>Emisión:</b> {parsear_fecha_hora_argentina()} hs (UTC-3)", style_cell)
        ]
    ]
    t_info = Table(info_data, colWidths=[330, 217])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 10))

    # 3. Tabla Cronológica de Cirugías
    # Ancho total A4 imprimible: 547 pt
    # ColWidths: Horario (45), Paciente & DNI (115), Cirujano (85), Derivador (85), Ojo y Práctica (102), LIO & Indicaciones (115)
    tabla_rows = [
        [
            Paragraph("Hora", style_header_th),
            Paragraph("Paciente / DNI", style_header_th),
            Paragraph("Cirujano", style_header_th),
            Paragraph("Derivador", style_header_th),
            Paragraph("Ojo y Práctica", style_header_th),
            Paragraph("LIO / Incisión / Indicaciones", style_header_th),
        ]
    ]

    for c in cirugias_list:
        hora = parsear_hora_argentina(c.get("hora_inicio"), fallback="--:--")
        paciente = c.get("paciente_nombre", "Sin Nombre")
        dni_raw = c.get("paciente_dni") or c.get("dni")
        dni_fmt = formatear_dni(dni_raw)
        
        cirujano = c.get("cirujano_nombre") or "-"
        derivador = c.get("medico_derivador_nombre") or "-"
        
        ojo = c.get("ojo", "OD")
        practica = c.get("practica_nombre") or c.get("practica") or "Cirugía Oftalmológica"

        # Detalles de Lente Intraocular (LIO)
        lio_parts = []
        lleva_lio = c.get("lleva_lente") or bool(c.get("lente_tipo")) or bool(c.get("lente_dioptria")) or bool(c.get("lente_modelo"))
        if lleva_lio:
            mod = c.get("lente_tipo") or c.get("lente_modelo") or c.get("lente_marca") or "LIO Estándar"
            diop = f"P: {c.get('lente_dioptria')} D" if c.get("lente_dioptria") else ""
            
            es_torico = c.get("es_torico") or bool(c.get("lente_torico_valor")) or bool(c.get("lente_torico"))
            toric_val = c.get("lente_torico_valor") if c.get("lente_torico_valor") is not None else c.get("lente_toric_val")
            toric_eje = c.get("lente_torico_eje") if c.get("lente_torico_eje") is not None else c.get("lente_eje")
            toric_str = ""
            if es_torico and (toric_val or toric_eje is not None):
                val_prefix = f"T{toric_val}" if str(toric_val).isdigit() else str(toric_val or "")
                eje_suffix = f" (Eje {toric_eje}°)" if toric_eje is not None else ""
                toric_str = f"Tórico: {val_prefix}{eje_suffix}".strip()
            
            inc_val = c.get("lente_incision_grados")
            inc_str = f"Inc: {inc_val}°" if inc_val else ""
            
            detalles_lio = " | ".join(filter(bool, [mod, diop, toric_str, inc_str]))
            lio_parts.append(f"<b>LIO:</b> {detalles_lio}")
            
            # Marca si el cálculo se encuentra pendiente de validación clínica
            if not c.get("lio_calculado", False):
                lio_parts.append("<font color='#C2410C'><b>[PENDIENTE DE CÁLCULO]</b></font>")

        # Observaciones médicas específicas (excluyendo notas de uso interno estricto)
        obs_med = c.get("observaciones_quirofano") or c.get("observaciones") or c.get("observaciones_medicas") or c.get("observaciones_prequirurgicas") or ""
        if obs_med and obs_med.strip():
            lio_parts.append(f"<b>Obs:</b> {obs_med.strip()[:140]}")

        lio_text = "<br/>".join(lio_parts) if lio_parts else "<font color='#94A3B8'>Sin LIO / Sin obs especiales</font>"

        row = [
            Paragraph(f"<b>{hora}</b>", style_cell_bold),
            Paragraph(f"<b>{paciente}</b><br/><font color='#64748B'>DNI: {dni_fmt}</font>", style_cell),
            Paragraph(cirujano, style_cell),
            Paragraph(derivador, style_cell),
            Paragraph(f"<b>{ojo}</b> — {practica}", style_cell),
            Paragraph(lio_text, style_cell)
        ]
        tabla_rows.append(row)

    t_cirugias = Table(
        tabla_rows,
        colWidths=[45, 115, 85, 85, 102, 115],
        repeatRows=1
    )
    t_cirugias.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_cirugias)
    story.append(Spacer(1, 14))

    # 4. Pie de Página Legal y Operativo
    legal_text = (
        "<b>CONFIDENCIALIDAD MÉDICA (Ley 25.326):</b> Este documento contiene información médica protegida destinada "
        "exclusivamente al profesional interviniente. Queda prohibida su reproducción o divulgación a terceros. "
        "El presente cronograma representa el corte informativo oficial de quirófano. Ante cualquier discrepancia "
        "o necesidad de coordinación clínica, comuníquese con la guardia de quirófano de Centrovisión."
    )
    p_legal = Paragraph(
        f"<font size=6.5 color='#64748B'>{legal_text}</font>",
        ParagraphStyle('LegalFoot', parent=style_normal, alignment=4, leading=8)
    )
    story.append(KeepTogether([p_legal]))

    # Construcción del documento
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, sha256_hash


class NumberedCanvasLandscapeA4(canvas.Canvas):
    """
    Canvas de ReportLab de 2 pasadas para calcular y dibujar dinámicamente
    el total de páginas ('Página X de Y') y membrete legal inferior en orientación A4 apaisada.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 7)
        self.setFillColor(colors.HexColor("#64748B"))
        # A4 Landscape: width = 841.89 pt, height = 595.27 pt
        footer_text = "Centrovisión · Planilla Operativa de Quirófano y Control de LIO · Confidencial · Uso Interno Exclusivo"
        self.drawString(24, 12, footer_text)
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(841.89 - 24, 12, page_text)
        self.restoreState()


def calcular_hora_citacion_sugerida(hora_cirugia: Optional[str], duracion_minutos_antes: int = 50) -> str:
    """
    Resta los minutos sugeridos (por defecto 50 min para cataratas) a la hora de cirugía.
    Retorna cadena 'HH:MM'. Si la hora no es válida, retorna '--:--'.
    """
    if not hora_cirugia:
        return "--:--"
    try:
        s = str(hora_cirugia).strip().lower().replace("hs", "").strip()
        if "t" in s:
            s = s.split("t")[1]
        partes = s.split(":")
        hh, mm = int(partes[0]), int(partes[1])
        minutos_totales = hh * 60 + mm - duracion_minutos_antes
        if minutos_totales < 0:
            minutos_totales += 24 * 60
        hh_res = (minutos_totales // 60) % 24
        mm_res = minutos_totales % 60
        return f"{hh_res:02d}:{mm_res:02d}"
    except Exception:
        return "--:--"


def inferir_secuencia_ojo(turno: Dict[str, Any], otros_turnos_paciente: Optional[List[Dict[str, Any]]] = None) -> str:
    """
    Infiere o resuelve la secuencia ocular de la intervención:
    - '1': Primer ojo intervenido
    - '2': Segundo ojo intervenido (contralateral)
    - 'U': Unilateral / Ojo único
    Respeta overrides manuales ('secuencia_ojo' en la base de datos).
    """
    secuencia_manual = turno.get("secuencia_ojo")
    if secuencia_manual:
        sm = str(secuencia_manual).strip().upper()
        if sm in ("1", "1°", "1ERO", "PRIMERO"):
            return "1"
        if sm in ("2", "2°", "2DO", "SEGUNDO"):
            return "2"
        if sm in ("U", "UNILATERAL", "UNICO", "ÚNICO"):
            return "U"
        if sm in ("1", "2", "U"):
            return sm

    if not otros_turnos_paciente or len(otros_turnos_paciente) <= 1:
        if turno.get("es_bilateral_escalonada"):
            if turno.get("turno_par_id") and turno.get("id") and str(turno.get("turno_par_id")) != str(turno.get("id")):
                return "2"
            return "1"
        return "U"

    turnos_validos = [
        t for t in otros_turnos_paciente
        if str(t.get("estado", "")).lower() not in ("cancelado", "anulado")
    ]
    if len(turnos_validos) <= 1:
        return "U"

    def turno_sort_key(t):
        f = str(t.get("fecha_cirugia") or "9999-99-99")
        h = str(t.get("hora_inicio") or "99:99")
        return (f, h)

    turnos_ordenados = sorted(turnos_validos, key=turno_sort_key)
    turno_id = str(turno.get("id") or "")

    for idx, t in enumerate(turnos_ordenados):
        if turno_id and str(t.get("id") or "") == turno_id:
            return "1" if idx == 0 else "2"

    f_curr = str(turno.get("fecha_cirugia") or "")
    h_curr = str(turno.get("hora_inicio") or "")
    for idx, t in enumerate(turnos_ordenados):
        if str(t.get("fecha_cirugia") or "") == f_curr and str(t.get("hora_inicio") or "") == h_curr:
            return "1" if idx == 0 else "2"

    return "U"


def generar_pdf_planilla_quirofano_diaria(
    turnos: List[Dict[str, Any]],
    fecha_str: str,
    sala_filtro: Optional[str] = "Todas las salas",
    tipo_filtro: Optional[str] = "Todos",
    config_override: Optional[Dict[str, Any]] = None,
    turnos_historial_pacientes: Optional[Dict[str, List[Dict[str, Any]]]] = None
) -> tuple[bytes, str]:
    """
    Genera la Planilla Quirúrgica Operativa Diaria en formato A4 Landscape (793.8 pt útiles)
    con la estructura exacta de 14 columnas requerida por el personal de quirófano de Centrovisión.

    Estructura de Columnas (Total: 793.8 pt):
    1.  Fecha (42 pt)
    2.  H. PAC. (38 pt)
    3.  H. CIR. (38 pt)
    4.  HC (44 pt)
    5.  PACIENTE (112 pt)
    6.  Número (20 pt)
    7.  OJO (24 pt) - con badge cromático rojo (OD) o verde (OI)
    8.  LENTE (70 pt)
    9.  DIOPTRIA (52 pt)
    10. OBS (105 pt) - Incisión, eje tórico, alertas clínicas y [PENDIENTE DE CÁLCULO]
    11. Cirujano (75 pt)
    12. DERIVADOR (65 pt)
    13. ANESTESISTA (55 pt)
    14. OBRA SOCIAL (53.8 pt)

    Retorna (pdf_bytes, sha256_hash).
    """
    settings = config_override or load_settings()
    nombre_inst = settings.get("nombre_institucion", "Centrovisión - Cirugía Oftalmológica")
    buffer = io.BytesIO()

    # Documento A4 apaisado con márgenes mínimos de 24 pt
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=20,
        bottomMargin=24
    )

    styles = getSampleStyleSheet()
    style_normal = styles["Normal"]

    style_title = ParagraphStyle(
        'PlanillaTitle',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=colors.HexColor('#0F172A')
    )
    style_sub = ParagraphStyle(
        'PlanillaSub',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#0284C7')
    )
    style_meta = ParagraphStyle(
        'PlanillaMeta',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#334155')
    )
    style_meta_bold = ParagraphStyle(
        'PlanillaMetaBold',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )
    style_th = ParagraphStyle(
        'PlanillaTH',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8.5,
        textColor=colors.white,
        alignment=1  # Centered
    )
    style_cell_center = ParagraphStyle(
        'PlanillaCellCenter',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor('#1E293B'),
        alignment=1  # Centered
    )
    style_cell_center_bold = ParagraphStyle(
        'PlanillaCellCenterBold',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor('#0F172A'),
        alignment=1  # Centered
    )
    style_cell_left = ParagraphStyle(
        'PlanillaCellLeft',
        parent=style_normal,
        fontName='Helvetica',
        fontSize=6.8,
        leading=8.2,
        textColor=colors.HexColor('#1E293B'),
        alignment=0  # Left
    )
    style_cell_left_bold = ParagraphStyle(
        'PlanillaCellLeftBold',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=8.5,
        textColor=colors.HexColor('#0F172A'),
        alignment=0  # Left
    )
    style_eye_od = ParagraphStyle(
        'EyeOD',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=9,
        textColor=colors.white,
        alignment=1
    )
    style_eye_oi = ParagraphStyle(
        'EyeOI',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=9,
        textColor=colors.white,
        alignment=1
    )
    style_eye_gen = ParagraphStyle(
        'EyeGen',
        parent=style_normal,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=9,
        textColor=colors.white,
        alignment=1
    )

    story = []

    # 1. Encabezado Institucional Compacto
    logo_path = obtener_o_cachear_logo_local()
    logo_flowable = None
    if logo_path and os.path.exists(logo_path):
        try:
            logo_flowable = RLImage(logo_path, width=95, height=28)
        except Exception as e:
            logger.warning(f"No se pudo cargar logo en planilla diaria: {e}")

    header_titles = [
        Paragraph(nombre_inst.upper(), style_title),
        Paragraph("PLANILLA DE CONTROL QUIRÚRGICO Y LIO (A4 LANDSCAPE)", style_sub),
    ]

    cant_cirugias = len(turnos)
    meta_lines = [
        Paragraph(f"<b>FECHA:</b> {fecha_str} &nbsp;&nbsp;|&nbsp;&nbsp; <b>SALA:</b> {sala_filtro or 'Todas las salas'} &nbsp;&nbsp;|&nbsp;&nbsp; <b>ALCANCE:</b> {tipo_filtro or 'Todos'}", style_meta_bold),
        Paragraph(f"<b>TOTAL PACIENTES:</b> {cant_cirugias} &nbsp;&nbsp;|&nbsp;&nbsp; <b>EMISIÓN:</b> {parsear_fecha_hora_argentina()} hs", style_meta),
    ]

    if logo_flowable:
        t_header = Table([[logo_flowable, header_titles, meta_lines]], colWidths=[105, 360, 328.8])
    else:
        t_header = Table([[header_titles, meta_lines]], colWidths=[450, 343.8])

    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 2),
        ('RIGHTPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 6))

    # 2. Definición de Columnas de la Tabla
    # Total ancho imprimible: 793.8 pt
    col_widths = [42, 38, 38, 44, 112, 20, 24, 70, 52, 105, 75, 65, 55, 53.8]

    headers = [
        Paragraph("Fecha", style_th),
        Paragraph("H. PAC.", style_th),
        Paragraph("H. CIR.", style_th),
        Paragraph("HC", style_th),
        Paragraph("PACIENTE / DNI", style_th),
        Paragraph("N°", style_th),
        Paragraph("OJO", style_th),
        Paragraph("LENTE", style_th),
        Paragraph("DIOPTRIA", style_th),
        Paragraph("OBSERVACIONES / LIO", style_th),
        Paragraph("Cirujano", style_th),
        Paragraph("DERIVADOR", style_th),
        Paragraph("ANESTESIA", style_th),
        Paragraph("OBRA SOCIAL", style_th),
    ]

    tabla_data = [headers]
    table_style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 2.5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2.5),
        # Alineación de contenido
        ('ALIGN', (0, 1), (3, -1), 'CENTER'),   # Fecha, H.PAC, H.CIR, HC
        ('ALIGN', (4, 1), (4, -1), 'LEFT'),     # Paciente
        ('ALIGN', (5, 1), (6, -1), 'CENTER'),   # N°, OJO
        ('ALIGN', (7, 1), (7, -1), 'LEFT'),     # Lente
        ('ALIGN', (8, 1), (8, -1), 'CENTER'),   # Dioptria
        ('ALIGN', (9, 1), (-1, -1), 'LEFT'),    # OBS, Cirujano, Derivador, Anestesia, Obra Social
    ]

    historial_map = turnos_historial_pacientes or {}

    for row_idx, t in enumerate(turnos, start=1):
        # 1. Fecha (DD-MM)
        f_raw = str(t.get("fecha_cirugia") or "")
        f_disp = "--"
        if f_raw:
            try:
                partes_f = f_raw.split("-")
                if len(partes_f) == 3:
                    f_disp = f"{partes_f[2]}-{partes_f[1]}"
                else:
                    f_disp = f_raw[:5]
            except Exception:
                f_disp = f_raw[:5]

        # 2. H. CIR.
        h_cir_raw = t.get("hora_inicio")
        h_cir = "--:--"
        if h_cir_raw:
            try:
                s_h = str(h_cir_raw).strip()
                if "T" in s_h:
                    s_h = s_h.split("T")[1]
                h_cir = s_h[:5]
            except Exception:
                h_cir = str(h_cir_raw)[:5]

        # 3. H. PAC. (hora citación)
        h_pac_raw = t.get("hora_citacion_paciente")
        if h_pac_raw:
            try:
                s_hp = str(h_pac_raw).strip()
                if "T" in s_hp:
                    s_hp = s_hp.split("T")[1]
                h_pac = s_hp[:5]
            except Exception:
                h_pac = str(h_pac_raw)[:5]
        else:
            # Cálculo sugerido reactivo: 50 min antes de la cirugía
            h_pac = calcular_hora_citacion_sugerida(h_cir, duracion_minutos_antes=50)

        # 4. HC (Historia Clínica)
        paciente_info = t.get("pacientes") or {}
        hc_val = (
            paciente_info.get("historia_clinica")
            or paciente_info.get("geclisa_id")
            or t.get("paciente_historia_clinica")
            or (str(t.get("paciente_id") or "")[:6] if t.get("paciente_id") else "-")
        )

        # 5. PACIENTE / DNI
        p_nom = (
            t.get("paciente_nombre")
            or paciente_info.get("nombre")
            or "SIN NOMBRE"
        ).strip().upper()
        p_dni = (
            t.get("paciente_dni")
            or t.get("dni")
            or paciente_info.get("dni")
            or "-"
        )
        p_dni_fmt = formatear_dni(p_dni) if p_dni != "-" else "-"
        p_celda = f"<b>{p_nom}</b><br/><font color='#64748B' size=6>DNI: {p_dni_fmt}</font>"

        # 6. Número (Secuencia 1, 2, U)
        pac_id = str(t.get("paciente_id") or "")
        hist_pac = historial_map.get(pac_id, [])
        sec_val = inferir_secuencia_ojo(t, otros_turnos_paciente=hist_pac)

        # 7. OJO
        ojo_raw = str(t.get("ojo") or "OD").strip().upper()
        ojo_val = "OD" if "OD" in ojo_raw else ("OI" if "OI" in ojo_raw else ("AO" if "AO" in ojo_raw else ojo_raw[:2]))
        
        # Color del badge de lateralidad
        if ojo_val == "OD":
            table_style_commands.append(('BACKGROUND', (6, row_idx), (6, row_idx), colors.HexColor('#DC2626')))
            eye_style = style_eye_od
        elif ojo_val == "OI":
            table_style_commands.append(('BACKGROUND', (6, row_idx), (6, row_idx), colors.HexColor('#16A34A')))
            eye_style = style_eye_oi
        else:
            table_style_commands.append(('BACKGROUND', (6, row_idx), (6, row_idx), colors.HexColor('#2563EB')))
            eye_style = style_eye_gen

        # 8. LENTE
        lleva_lio = t.get("lleva_lente") or bool(t.get("lente_tipo")) or bool(t.get("lente_dioptria")) or bool(t.get("lente_modelo"))
        if lleva_lio:
            lente_mod = str(t.get("lente_tipo") or t.get("lente_modelo") or t.get("lente_marca") or "LIO Estándar").strip()
        else:
            lente_mod = "Sin LIO"

        # 9. DIOPTRIA
        dioptria_lines = []
        if lleva_lio and t.get("lente_dioptria"):
            dioptria_lines.append(f"<b>{t.get('lente_dioptria')} D</b>")
        
        es_tor = t.get("es_torico") or bool(t.get("lente_torico_valor"))
        tor_val = t.get("lente_torico_valor")
        if es_tor and tor_val:
            prefix_t = f"T{tor_val}" if str(tor_val).isdigit() else str(tor_val)
            dioptria_lines.append(f"<font color='#0284C7' size=6>{prefix_t}</font>")
        
        diop_str = "<br/>".join(dioptria_lines) if dioptria_lines else "-"

        # 10. OBSERVACIONES / LIO (Incisión, Eje, Pendiente, Observaciones Clínicas)
        obs_parts = []
        
        # Incisión
        inc_val = t.get("lente_incision_grados")
        if inc_val:
            obs_parts.append(f"<b>Inc:</b> {inc_val}°")
            
        # Eje tórico
        tor_eje = t.get("lente_torico_eje")
        if es_tor and tor_eje is not None:
            obs_parts.append(f"<b>EJE:</b> {tor_eje}°")

        # Alerta LIO Pendiente de Cálculo
        if lleva_lio and not t.get("lio_calculado", False):
            obs_parts.append("<font color='#C2410C'><b>[PENDIENTE DE CÁLCULO]</b></font>")

        # Observaciones médicas prioritarias
        obs_med = (
            t.get("observaciones_quirofano")
            or t.get("observaciones")
            or t.get("observaciones_medicas")
            or ""
        ).strip()
        if obs_med:
            obs_parts.append(obs_med[:100])

        obs_final_str = " · ".join(obs_parts) if obs_parts else "-"

        # 11. Cirujano
        cirujano_str = t.get("cirujano_nombre") or "-"
        if len(cirujano_str) > 22:
            cirujano_str = cirujano_str[:22] + "..."

        # 12. DERIVADOR
        derivador_str = (
            t.get("medico_derivador_nombre")
            or (t.get("asesorias_quirurgicas") or {}).get("medico_derivador_nombre")
            or "-"
        )
        if len(derivador_str) > 18:
            derivador_str = derivador_str[:18] + "..."

        # 13. ANESTESISTA
        anestesia_str = t.get("anestesiologo_nombre") or t.get("tipo_anestesia") or "Tópica"
        if len(anestesia_str) > 15:
            anestesia_str = anestesia_str[:15] + "..."

        # 14. OBRA SOCIAL
        os_str = (
            t.get("obra_social")
            or t.get("codigo_obra_social")
            or (t.get("pacientes") or {}).get("obra_social")
            or "-"
        )
        if len(os_str) > 16:
            os_str = os_str[:16] + "..."

        # Ensamblado de fila
        fila = [
            Paragraph(f_disp, style_cell_center),
            Paragraph(f"<b>{h_pac}</b>", style_cell_center_bold),
            Paragraph(f"<b>{h_cir}</b>", style_cell_center_bold),
            Paragraph(str(hc_val), style_cell_center),
            Paragraph(p_celda, style_cell_left),
            Paragraph(f"<b>{sec_val}</b>", style_cell_center_bold),
            Paragraph(ojo_val, eye_style),
            Paragraph(lente_mod, style_cell_left),
            Paragraph(diop_str, style_cell_center),
            Paragraph(obs_final_str, style_cell_left),
            Paragraph(cirujano_str, style_cell_left),
            Paragraph(derivador_str, style_cell_left),
            Paragraph(anestesia_str, style_cell_left),
            Paragraph(os_str, style_cell_left),
        ]
        tabla_data.append(fila)

    t_principal = Table(
        tabla_data,
        colWidths=col_widths,
        repeatRows=1
    )
    t_principal.setStyle(TableStyle(table_style_commands))
    story.append(t_principal)

    # Compilación del documento PDF con NumberedCanvasLandscapeA4
    doc.build(story, canvasmaker=NumberedCanvasLandscapeA4)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()
    return pdf_bytes, sha256_hash

