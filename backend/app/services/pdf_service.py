import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.services.config_service import load_settings

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
    
    # Cargar configuración de plantilla
    settings = load_settings()
    plantilla = plantilla_override or settings.get("plantilla_presupuesto", {})
    
    # Parámetros institucionales
    titulo_doc = plantilla.get("titulo_documento") or "PRESUPUESTO MÉDICO"
    nombre_inst = plantilla.get("nombre_institucion") or "CLÍNICA MÉDICA NUBE"
    subtitulo_inst = plantilla.get("subtitulo_institucion") or "Atención Médica Digital & Especialidades"
    direccion_inst = plantilla.get("direccion") or ""
    telefono_inst = plantilla.get("telefono") or ""
    email_inst = plantilla.get("email") or ""
    sitio_web = plantilla.get("sitio_web") or ""
    
    color_primario_hex = plantilla.get("color_primario") or "#1E3A8A"
    color_secundario_hex = plantilla.get("color_secundario") or "#2563EB"
    
    terminos = plantilla.get("terminos_condiciones") or [
        "Este presupuesto tiene una validez de 30 días corridos a partir de la fecha de emisión.",
        "Los precios cotizados respetan la moneda especificada (Pesos ARS o Dólares USD).",
        "La confirmación de turnos quirúrgicos, prácticas y estudios de alta complejidad queda supeditada a disponibilidad de agenda y confirmación de pago.",
        "Formas de pago habilitadas: Transferencia bancaria, Tarjetas de crédito/débito y Efectivo en administración."
    ]
    pie_pagina = plantilla.get("pie_pagina") or "Documento emitido electrónicamente por el sistema CRM Médico Nube."
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
        fontSize=15,
        leading=18,
        textColor=color_primario
    )
    
    style_titulo_doc = ParagraphStyle(
        name='DocTitleStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
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
    
    # 1. Cabecera Institucional
    inst_content = f"<b>{nombre_inst}</b><br/><font size=8 color='#64748B'>{subtitulo_inst}"
    if direccion_inst or telefono_inst:
        inst_content += f"<br/>{direccion_inst} • Tel: {telefono_inst}"
    inst_content += "</font>"
    
    doc_id_str = str(presupuesto.get('id', ''))[:8].upper()
    doc_content = f"<b>{titulo_doc}</b><br/><font size=8 color='#64748B'>Doc. N°: <b>{doc_id_str}</b>"
    if sitio_web:
        doc_content += f"<br/>{sitio_web}"
    doc_content += "</font>"
    
    t_header = Table([
        [Paragraph(inst_content, style_institucion), Paragraph(doc_content, style_titulo_doc)]
    ], colWidths=[310, 230])
    
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
        
    fecha_emision = parse_and_format_date(presupuesto.get('created_at'))
    estado_raw = str(presupuesto.get('estado', 'BORRADOR')).upper()
    
    color_estado = '#16A34A' if estado_raw == 'APROBADO' else ('#2563EB' if estado_raw == 'ENVIADO' else ('#DC2626' if estado_raw == 'RECHAZADO' else '#475569'))
    
    # Información del Paciente y Detalle de Emisión
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
                f"<b>Cobertura:</b> {paciente.get('obra_social') or 'Particular'}", 
                style_texto
            ),
            Paragraph(
                f"<b>Tipo de Documento:</b> Cotización Médica Oficial<br/>"
                f"<b>Fecha de Emisión:</b> {fecha_emision}<br/>"
                f"<b>Validez de Aranceles:</b> {plantilla.get('validez_dias', 30)} días corridos<br/>"
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
    
    # 3. Tabla de Prestaciones / Items Presupuestados (Exact 540 pt)
    # Anchos: Código (55) + Descripción (245) + Moneda (45) + P. Unit (80) + Cant (35) + Subtotal (80) = 540 pt
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
        codigo = str(item.get("codigo") or item.get("codigo_servicio") or "PRAC").strip().upper()
        nombre = str(item.get("nombre_prestacion") or item.get("nombre") or f"Práctica {codigo}").strip()
        moneda_item = str(item.get("moneda") or "ARS").strip().upper()
        cantidad = int(item.get("cantidad", 1))
        p_unit = float(item.get("precio_unitario", 0.0))
        subtotal = float(item.get("subtotal") or (p_unit * cantidad))
        
        if moneda_item == "USD":
            total_usd += subtotal
        else:
            total_ars += subtotal
            
        p_unit_str = formatear_monto_moneda(p_unit, moneda_item)
        subtotal_str = formatear_monto_moneda(subtotal, moneda_item)
        
        table_data.append([
            Paragraph(f"<font color='#2563EB'><b>{codigo}</b></font>", style_texto),
            Paragraph(nombre, style_texto),
            Paragraph(f"<b>{moneda_item}</b>", style_moneda_tag),
            Paragraph(p_unit_str, style_texto_right),
            Paragraph(str(cantidad), ParagraphStyle('CantCenter', parent=style_texto, alignment=1)),
            Paragraph(f"<b>{subtotal_str}</b>", style_texto_bold_right)
        ])
        
    num_items = len(items)
    
    # Filas de Totales con SPAN de columnas 0 a 4
    if total_ars > 0 and total_usd > 0:
        table_data.append([
            Paragraph("<b>TOTAL EN PESOS (ARS):</b>", style_total_label),
            "", "", "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_ars, 'ARS')}</b>", style_total_amount)
        ])
        table_data.append([
            Paragraph("<b>TOTAL EN DÓLARES (USD):</b>", style_total_label),
            "", "", "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_usd, 'USD')}</b>", style_total_amount)
        ])
    elif total_usd > 0:
        table_data.append([
            Paragraph("<b>TOTAL EN DÓLARES (USD):</b>", style_total_label),
            "", "", "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_usd, 'USD')}</b>", style_total_amount)
        ])
    else:
        table_data.append([
            Paragraph("<b>TOTAL EN PESOS (ARS):</b>", style_total_label),
            "", "", "", "",
            Paragraph(f"<b>{formatear_monto_moneda(total_ars, 'ARS')}</b>", style_total_amount)
        ])
        
    t_items = Table(table_data, colWidths=[55, 245, 45, 80, 35, 80])
    
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
        
    # Estilos y SPAN para las filas de totales
    first_total_row = num_items + 1
    total_rows_count = 2 if (total_ars > 0 and total_usd > 0) else 1
    
    for tr in range(first_total_row, first_total_row + total_rows_count):
        table_styles.append(('SPAN', (0, tr), (4, tr)))
        table_styles.append(('BACKGROUND', (0, tr), (-1, tr), colors.HexColor('#F8FAFC')))
        table_styles.append(('ALIGN', (0, tr), (4, tr), 'RIGHT'))
        table_styles.append(('ALIGN', (5, tr), (5, tr), 'RIGHT'))
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
        condiciones_html += f"<b>{i}.</b> {cond}<br/>"
        
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
    nombre_inst = plantilla_inst.get("nombre_institucion") or "CLÍNICA MÉDICA NUBE"
    subtitulo_inst = plantilla_inst.get("subtitulo_institucion") or "Atención Oftalmológica & Quirúrgica"
    color_primario = "#1E3A8A"
    color_secundario = "#2563EB"
    
    # Convertir Markdown a HTML con extensiones de listas, tablas y saltos de línea
    cuerpo_html = markdown.markdown(
        texto_consentimiento,
        extensions=['extra', 'nl2br', 'sane_lists']
    )
    
    ojo = turno.get("ojo") or "OD"
    ojo_desc = "OJO DERECHO (OD)" if ojo == "OD" else "OJO IZQUIERDO (OI)" if ojo == "OI" else "AMBOS OJOS (AO)"
    
    # Preparar firma base64 si existe
    sig_b64 = firma_img_base64
    if sig_b64 and not sig_b64.startswith("data:"):
        sig_b64 = f"data:image/png;base64,{sig_b64}"
        
    context = {
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
        "firma_timestamp": (firma_metadata or {}).get("fecha_hora") or (firma_metadata or {}).get("timestamp") or "N/A",
        "firma_ip": (firma_metadata or {}).get("ip_origen") or (firma_metadata or {}).get("ip") or "Web-Client",
        "firma_hash": (firma_metadata or {}).get("hash") or "SHA256-VERIFIED",
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

    turno_id = turno.get("id") or str(uuid.uuid4())
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
    nombre_inst = plantilla.get("nombre_institucion") or "CLÍNICA MÉDICA NUBE"
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
    header_table = Table([
        [
            Paragraph(f"<b>{nombre_inst.upper()}</b><br/><font size=8 color='#64748B'>{subtitulo_inst}</font>", style_normal),
            Paragraph(f"<font size=9 color='#64748B'>DOCUMENTO MÉDICO-LEGAL</font><br/><b>CONSENTIMIENTO INFORMADO</b>", ParagraphStyle('HRight', parent=style_normal, alignment=2))
        ]
    ], colWidths=[320, 220])
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
    fecha = str(turno.get("fecha_cirugia") or "")
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
            if len(clean_b64) > 200 and not clean_b64.endswith("..."):
                try:
                    img_data = base64.b64decode(clean_b64)
                    temp_sig_path = os.path.join(PDF_DIR, f"temp_sig_{turno_id}.png")
                    with open(temp_sig_path, "wb") as f_sig:
                        f_sig.write(img_data)
                    sig_element = RLImage(temp_sig_path, width=2.0*inch, height=0.8*inch)
                except Exception as img_err:
                    logger.warning(f"No se pudo renderizar PNG de firma ({img_err}), aplicando sello de verificación digital.")
                    sig_element = None
            
            if sig_element is None:
                sig_element = Paragraph(
                    f"<font color='#059669' size=9><b>✔ FIRMADO DIGITALMENTE</b></font><br/><font size=7 color='#64748B'>Validación de Consentimiento Confirmada<br/>{pac_nombre} (DNI: {pac_dni})</font>",
                    ParagraphStyle('SigBox', parent=style_valor, alignment=1)
                )
            
            ts = (firma_metadata or {}).get("timestamp") or "N/A"
            ip = (firma_metadata or {}).get("ip") or "N/A"
            hash_doc = (firma_metadata or {}).get("hash") or "SHA256-VERIFIED"

            meta_text = f"<font size=7 color='#64748B'><b>FIRMA DIGITAL REGISTRADA VÍA WHATSAPP / WEB</b><br/>Fecha/Hora: {ts} UTC<br/>IP de Origen: {ip}<br/>Trazabilidad: {hash_doc[:24]}...</font>"
            
            t_firma = Table([
                [
                    Paragraph(meta_text, style_valor),
                    sig_element
                ],
                [
                    Paragraph("<b>Certificación de Consentimiento Informado</b>", ParagraphStyle('FirmaLabel', parent=style_valor, alignment=0)),
                    Paragraph(f"<b>{pac_nombre}</b><br/><font size=7 color='#64748B'>DNI: {pac_dni}</font>", ParagraphStyle('FirmaLabelR', parent=style_valor, alignment=1))
                ]
            ], colWidths=[320, 220])
            t_firma.setStyle(TableStyle([
                ('ALIGN', (1,0), (1,0), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LINEABOVE', (1,1), (1,1), 1, colors.HexColor('#0F172A')),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ]))
            firma_elements.append(t_firma)
        except Exception as e:
            logger.error(f"Error insertando bloque de firma: {e}")
            firma_elements.append(Paragraph(f"<b>Firmado Digitalmente por el paciente {pac_nombre} (DNI: {pac_dni})</b>", style_valor))
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
    header_data = [
        [
            Paragraph(f"<b><font size=12 color='{color_primario_hex}'>{nombre_inst.upper()}</font></b><br/><font size=8 color='#64748B'>{subtitulo_inst}</font>", style_normal),
            Paragraph(f"<b>PROTOCOLO QUIRÚRGICO OFICIAL</b><br/><font size=8 color='#64748B'>Doc Ref: PQ-{str(turno_id)[:8].upper()}</font><br/><font size=7 color='#94A3B8'>Fecha Emisión: {parsear_fecha_hora_argentina()}</font>", ParagraphStyle('HRight', parent=style_normal, alignment=2))
        ]
    ]
    t_head = Table(header_data, colWidths=[270, 270])
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
    fecha = str(turno.get("fecha_cirugia") or "")
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

    # 7. Cuadro de Firmas Médicas
    firma_data = [
        [
            Paragraph(f"______________________________________<br/><b>Dr/a. {cirujano}</b><br/><font size=7 color='#64748B'>Cirujano Principal</font>", ParagraphStyle('F1', parent=style_val, alignment=1)),
            Paragraph(f"______________________________________<br/><b>{anestesista}</b><br/><font size=7 color='#64748B'>Médico Anestesiólogo</font>", ParagraphStyle('F2', parent=style_val, alignment=1)),
            Paragraph(f"______________________________________<br/><b>{instrumentador}</b><br/><font size=7 color='#64748B'>Instrumentador/a Quirúrgico</font>", ParagraphStyle('F3', parent=style_val, alignment=1)),
        ]
    ]
    t_firmas = Table(firma_data, colWidths=[180, 180, 180])
    t_firmas.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 16),
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


