import os
import re
import uuid
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.services.config_service import load_settings

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

def generar_pdf_presupuesto(
    presupuesto: dict, 
    paciente: dict, 
    items: list, 
    plantilla_override: Optional[dict] = None
) -> str:
    """
    Genera un presupuesto en formato PDF estético y profesional utilizando ReportLab.
    Aplica la configuración personalizada de la plantilla institucional y soporte multi-moneda.
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
        "La confirmación de turnos y prácticas queda supeditada a disponibilidad de agenda y confirmación de pago."
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
    
    style_subinstitucion = ParagraphStyle(
        name='SubInstStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B')
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
    
    style_num_doc = ParagraphStyle(
        name='DocNumStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=2, # Derecha
        textColor=colors.HexColor('#64748B')
    )
    
    style_seccion_header = ParagraphStyle(
        name='SecHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=color_primario
    )
    
    style_texto = ParagraphStyle(
        name='TextStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    
    style_texto_bold = ParagraphStyle(
        name='TextBoldStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#0F172A')
    )
    
    style_encabezado_tabla = ParagraphStyle(
        name='TableHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
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
    story.append(Spacer(1, 10))
    
    # 2. Resumen de Monedas en los Items
    monedas_usadas = set(it.get("moneda", "ARS").upper() for it in items)
    if "USD" in monedas_usadas and "ARS" in monedas_usadas:
        moneda_resumen = "Multi-moneda (ARS / USD)"
    elif "USD" in monedas_usadas:
        moneda_resumen = "Dólares Estadounidenses (USD)"
    else:
        moneda_resumen = "Pesos Argentinos (ARS)"
        
    fecha_emision = str(presupuesto.get('created_at', ''))[:10] or "2026-08-15"
    
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
                f"<b>Fecha de Emisión:</b> {fecha_emision}<br/>"
                f"<b>Validez:</b> {plantilla.get('validez_dias', 30)} días corridos<br/>"
                f"<b>Estado:</b> <font color='#16A34A'><b>{presupuesto.get('estado', 'BORRADOR').upper()}</b></font><br/>"
                f"<b>Moneda Principal:</b> {moneda_resumen}", 
                style_texto
            )
        ]
    ]
    
    t_info = Table(info_box, colWidths=[270, 270])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 14))
    
    # 3. Tabla de Prestaciones / Items Presupuestados
    table_data = [[
        Paragraph("<b>Código</b>", style_encabezado_tabla),
        Paragraph("<b>Prestación / Descripción Médica</b>", style_encabezado_tabla),
        Paragraph("<b>Moneda</b>", style_encabezado_tabla),
        Paragraph("<b>P. Unitario</b>", style_encabezado_tabla),
        Paragraph("<b>Cant.</b>", style_encabezado_tabla),
        Paragraph("<b>Subtotal</b>", style_encabezado_tabla)
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
            Paragraph(p_unit_str, style_texto),
            Paragraph(str(cantidad), style_texto),
            Paragraph(f"<b>{subtotal_str}</b>", style_texto_bold)
        ])
        
    # Totales
    if total_ars > 0 and total_usd > 0:
        table_data.append([
            "", "", "", "",
            Paragraph("<b>TOTAL ARS:</b>", style_texto_bold),
            Paragraph(f"<b>{formatear_monto_moneda(total_ars, 'ARS')}</b>", style_institucion)
        ])
        table_data.append([
            "", "", "", "",
            Paragraph("<b>TOTAL USD:</b>", style_texto_bold),
            Paragraph(f"<b>{formatear_monto_moneda(total_usd, 'USD')}</b>", style_institucion)
        ])
    elif total_usd > 0:
        table_data.append([
            "", "", "", "",
            Paragraph("<b>TOTAL:</b>", style_texto_bold),
            Paragraph(f"<b>{formatear_monto_moneda(total_usd, 'USD')}</b>", style_institucion)
        ])
    else:
        table_data.append([
            "", "", "", "",
            Paragraph("<b>TOTAL:</b>", style_texto_bold),
            Paragraph(f"<b>{formatear_monto_moneda(total_ars, 'ARS')}</b>", style_institucion)
        ])
        
    t_items = Table(table_data, colWidths=[65, 215, 55, 75, 40, 90])
    
    table_styles = [
        ('BACKGROUND', (0,0), (-1,0), color_primario),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (2,0), (2,-1), 'CENTER'),
        ('ALIGN', (4,0), (4,-1), 'CENTER'),
        ('ALIGN', (3,0), (3,-1), 'RIGHT'),
        ('ALIGN', (5,0), (5,-1), 'RIGHT'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1 if (total_ars == 0 or total_usd == 0) else -2), [colors.white, colors.HexColor('#F8FAFC')]),
        ('GRID', (0,0), (-1,-2 if (total_ars > 0 and total_usd > 0) else -2), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]
    
    # Línea divisoria sobre la fila de total
    table_styles.append(('LINEABOVE', (4,-2 if (total_ars > 0 and total_usd > 0) else -1), (5,-1), 1.5, color_primario))
    
    t_items.setStyle(TableStyle(table_styles))
    story.append(t_items)
    story.append(Spacer(1, 16))
    
    # 4. Términos y Condiciones
    condiciones_html = "<b>TÉRMINOS Y CONDICIONES DEL PRESUPUESTO:</b><br/>"
    for i, cond in enumerate(terminos, 1):
        condiciones_html += f"<b>{i}.</b> {cond}<br/>"
        
    t_cond = Table([[Paragraph(condiciones_html, style_texto)]], colWidths=[540])
    t_cond.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_cond)
    story.append(Spacer(1, 16))
    
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
            ('TOPPADDING', (0,0), (-1,-1), 15),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        footer_elements.append(t_firma)
        footer_elements.append(Spacer(1, 10))
        
    if pie_pagina:
        footer_elements.append(
            Paragraph(f"<font size=7 color='#94A3B8'>{pie_pagina}</font>", ParagraphStyle('FootStyle', parent=styles['Normal'], alignment=1))
        )
        
    story.append(KeepTogether(footer_elements))
    
    # Generar el PDF
    doc.build(story)
    
    return pdf_filename


def generar_pdf_consentimiento_informado(
    turno: dict,
    paciente: dict,
    texto_consentimiento: str,
    firma_img_base64: Optional[str] = None,
    firma_metadata: Optional[dict] = None
) -> str:
    """
    Genera el documento de Consentimiento Informado Quirúrgico en PDF.
    Si se provee firma en base64, la estampa al pie con el sello digital de trazabilidad.
    """
    import base64
    from reportlab.platypus import Image as RLImage
    from reportlab.lib.units import inch

    turno_id = turno.get("id") or str(uuid.uuid4())
    pdf_filename = f"consentimiento_{turno_id}.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)

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
            clean_b64 = firma_img_base64
            if "," in clean_b64:
                clean_b64 = clean_b64.split(",")[1]
            img_data = base64.b64decode(clean_b64)
            temp_sig_path = os.path.join(PDF_DIR, f"temp_sig_{turno_id}.png")
            with open(temp_sig_path, "wb") as f_sig:
                f_sig.write(img_data)
            
            sig_img = RLImage(temp_sig_path, width=2.0*inch, height=0.8*inch)
            
            ts = (firma_metadata or {}).get("timestamp") or "N/A"
            ip = (firma_metadata or {}).get("ip") or "N/A"
            hash_doc = (firma_metadata or {}).get("hash") or "SHA256-VERIFIED"

            meta_text = f"<font size=7 color='#64748B'><b>FIRMA DIGITAL REGISTRADA VÍA WHATSAPP / WEB</b><br/>Fecha/Hora: {ts} UTC<br/>IP de Origen: {ip}<br/>Trazabilidad: {hash_doc[:24]}...</font>"
            
            t_firma = Table([
                [
                    Paragraph(meta_text, style_valor),
                    sig_img
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
            logger.error(f"Error insertando imagen de firma: {e}")
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

