import os
import uuid
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Directorio local para guardar los archivos PDF generados
PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
os.makedirs(PDF_DIR, exist_ok=True)

def generar_pdf_presupuesto(presupuesto: dict, paciente: dict, items: list) -> str:
    """
    Genera un presupuesto en formato PDF estético utilizando ReportLab.
    Retorna el nombre del archivo PDF generado.
    """
    pdf_filename = f"presupuesto_{presupuesto['id']}.pdf"
    pdf_path = os.path.join(PDF_DIR, pdf_filename)
    
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
    
    # Estilos personalizados
    style_titulo = ParagraphStyle(
        name='TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0F172A'), # Slate 900
        spaceAfter=15
    )
    
    style_subtitulo = ParagraphStyle(
        name='SubtitleStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=colors.HexColor('#2563EB') # Blue 600
    )
    
    style_texto = ParagraphStyle(
        name='TextStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569') # Slate 600
    )
    
    style_encabezado_tabla = ParagraphStyle(
        name='TableHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.white
    )
    
    # Cabecera de la Clínica (Sección Superior)
    clinica_info = [
        [
            Paragraph("<b>CLÍNICA MÉDICA NUBE</b><br/>Atención Médica Digital", style_subtitulo),
            Paragraph("<b>PRESUPUESTO MÉDICO</b><br/>No. Doc: " + str(presupuesto['id'])[:8].upper(), style_subtitulo)
        ]
    ]
    t_header = Table(clinica_info, colWidths=[270, 270])
    t_header.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 10))
    
    # Línea divisoria
    d_line = Table([[""]], colWidths=[540])
    d_line.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 1.5, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(d_line)
    story.append(Spacer(1, 15))
    
    # Información del Paciente y Emisión
    info_paciente = [
        [
            Paragraph("<b>PACIENTE:</b>", style_texto),
            Paragraph("<b>DETALLE DE EMISIÓN:</b>", style_texto)
        ],
        [
            Paragraph(f"Nombre: {paciente['nombre']}<br/>Teléfono: {paciente['telefono']}<br/>Email: {paciente.get('email') or 'N/A'}", style_texto),
            Paragraph(f"Fecha: {presupuesto['created_at'][:10]}<br/>Estado: {presupuesto['estado'].upper()}<br/>Moneda: USD", style_texto)
        ]
    ]
    t_paciente = Table(info_paciente, colWidths=[270, 270])
    t_paciente.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_paciente)
    story.append(Spacer(1, 20))
    
    # Tabla de Prestaciones / Items
    table_data = [[
        Paragraph("<b>Código</b>", style_encabezado_tabla),
        Paragraph("<b>Prestación / Servicio</b>", style_encabezado_tabla),
        Paragraph("<b>Precio Unit.</b>", style_encabezado_tabla),
        Paragraph("<b>Cant.</b>", style_encabezado_tabla),
        Paragraph("<b>Subtotal</b>", style_encabezado_tabla)
    ]]
    
    for item in items:
        # Resolver nombre de prestación
        nombre = item.get("nombre_prestacion") or "Servicio Médico"
        codigo = item.get("codigo") or "SRV"
        precio = f"${item['precio_unitario']:.2f}"
        cant = str(item['cantidad'])
        sub = f"${item['subtotal']:.2f}"
        
        table_data.append([
            Paragraph(codigo, style_texto),
            Paragraph(nombre, style_texto),
            Paragraph(precio, style_texto),
            Paragraph(cant, style_texto),
            Paragraph(sub, style_texto)
        ])
        
    # Fila de Total
    table_data.append([
        "", "", "", 
        Paragraph("<b>TOTAL:</b>", style_texto), 
        Paragraph(f"<b>${presupuesto['total']:.2f}</b>", style_texto)
    ])
    
    # Estilo de la Tabla
    t_items = Table(table_data, colWidths=[80, 240, 80, 50, 90])
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2563EB')), # Header azul
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor('#F8FAFC')]), # Filas cebra
        ('GRID', (0,0), (-1,-2), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEABOVE', (3,-1), (4,-1), 1, colors.HexColor('#0F172A')), # Línea sobre el total
    ]))
    
    story.append(t_items)
    story.append(Spacer(1, 30))
    
    # Términos y Condiciones
    condiciones = (
        "<b>Términos y Condiciones:</b><br/>"
        "1. Este presupuesto tiene una validez de 30 días corridos a partir de la fecha de emisión.<br/>"
        "2. Los precios están expresados en dólares estadounidenses (USD).<br/>"
        "3. La confirmación de turnos quirúrgicos y estudios de alta complejidad queda supeditada a disponibilidad agenda y aprobación del pago por la obra social o prepaga si correspondiese."
    )
    story.append(Paragraph(condiciones, style_texto))
    
    # Generar el PDF
    doc.build(story)
    
    return pdf_filename
