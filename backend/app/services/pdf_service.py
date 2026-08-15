import os
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
