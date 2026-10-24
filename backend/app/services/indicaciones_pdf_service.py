import os
import re
import uuid
import io
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, Image as RLImage, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.services.config_service import load_settings, obtener_o_cachear_logo_local

logger = logging.getLogger("indicaciones_pdf_service")

# Directorio de almacenamiento para PDFs estáticos generados
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
os.makedirs(STATIC_DIR, exist_ok=True)


def parse_color_hex(hex_str: str, default: str = "#1E3A8A") -> colors.HexColor:
    try:
        if hex_str and hex_str.startswith("#") and len(hex_str) in [4, 7]:
            return colors.HexColor(hex_str)
        return colors.HexColor(default)
    except Exception:
        return colors.HexColor(default)


def render_texto_variables(texto: str, variables: Dict[str, Any]) -> str:
    """
    Reemplaza variables dinámicas en el texto como {{paciente}}, {{ojo}}, {{cirujano}}, etc.
    """
    if not texto:
        return ""
    resultado = texto
    for key, val in variables.items():
        pattern = re.compile(r"\{\{\s*" + re.escape(key) + r"\s*\}\}", re.IGNORECASE)
        resultado = pattern.sub(str(val or ""), resultado)
    return resultado


def generar_pdf_indicacion_medica(
    datos_emision: Dict[str, Any],
    config_diseno: Optional[Dict[str, Any]] = None,
    guardar_en_disco: bool = True
) -> Dict[str, Any]:
    """
    Genera el PDF oficial de Indicaciones Médicas Quirúrgicas con estética médica premium.
    Retorna un diccionario con {'pdf_bytes': bytes, 'file_path': str, 'filename': str, 'url': str}.
    """
    cfg = config_diseno or {}
    color_primario_hex = cfg.get("color_primario", "#1E3A8A")
    color_secundario_hex = cfg.get("color_secundario", "#2563EB")
    
    c_primario = parse_color_hex(color_primario_hex, "#1E3A8A")
    c_secundario = parse_color_hex(color_secundario_hex, "#2563EB")
    c_fondo_card = colors.HexColor("#F8FAFC")
    c_borde_card = colors.HexColor("#E2E8F0")
    c_alerta_fondo = colors.HexColor("#FEF2F2")
    c_alerta_borde = colors.HexColor("#FCA5A5")
    c_alerta_texto = colors.HexColor("#991B1B")

    mostrar_logo = cfg.get("mostrar_logo", True)
    mostrar_firma = cfg.get("mostrar_firma", True)
    mostrar_qr = cfg.get("mostrar_qr", True)

    raw_texto = datos_emision.get("cuerpo_indicaciones") or datos_emision.get("texto_indicaciones") or ""
    raw_lower = str(raw_texto).lower()
    es_orden_detectada = (
        "solicito:" in raw_lower
        or "solicito " in raw_lower
        or "orden medica" in raw_lower
        or "orden médica" in raw_lower
        or "pedido de estudio" in raw_lower
    )
    titulo_doc = cfg.get("titulo_documento") or ("ORDEN MÉDICA DE PROCEDIMIENTO" if es_orden_detectada else "INDICACIONES MÉDICAS QUIRÚRGICAS")
    pie_pagina_custom = cfg.get("pie_pagina") or "Documento médico oficial emitido electrónicamente por Centro Visión."

    # Datos clínicos de la emisión
    emision_id = str(datos_emision.get("id") or uuid.uuid4())
    paciente_nombre = datos_emision.get("paciente_nombre") or "Paciente"
    paciente_dni = datos_emision.get("paciente_dni") or "-"
    paciente_os = datos_emision.get("paciente_obra_social") or "-"
    practica_nombre = datos_emision.get("practica_nombre") or "Procedimiento Quirúrgico Oftalmológico"
    ojo_intervenido = datos_emision.get("ojo") or "OD"
    ojo_label = "Ojo Derecho (OD)" if ojo_intervenido == "OD" else "Ojo Izquierdo (OI)" if ojo_intervenido == "OI" else "Ambos Ojos (AO)" if ojo_intervenido == "AO" else ojo_intervenido
    
    medico_nombre = datos_emision.get("medico_nombre") or "Médico Cirujano"
    medico_matricula = datos_emision.get("medico_matricula") or ""
    fecha_emision = datos_emision.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    hora_emision = datos_emision.get("hora") or datetime.now().strftime("%H:%M")
    geclisa_im_id = datos_emision.get("geclisa_im_id")

    texto_cuerpo = datos_emision.get("cuerpo_indicaciones") or datos_emision.get("texto_indicaciones") or ""
    medicamentos = datos_emision.get("medicamentos") or []
    cuidados_generales = datos_emision.get("cuidados_generales") or ""
    pautas_alarma = datos_emision.get("pautas_alarma") or ""

    # Reemplazo de variables dinámicas en el texto libre
    vars_dict = {
        "paciente": paciente_nombre,
        "paciente_nombre": paciente_nombre,
        "dni": paciente_dni,
        "ojo": ojo_label,
        "ojo_operado": ojo_label,
        "practica": practica_nombre,
        "cirujano": medico_nombre,
        "medico": medico_nombre,
        "matricula": medico_matricula,
        "fecha": fecha_emision,
        "hora": hora_emision,
        "obra_social": paciente_os
    }
    texto_cuerpo = render_texto_variables(texto_cuerpo, vars_dict)
    cuidados_generales = render_texto_variables(cuidados_generales, vars_dict)
    pautas_alarma = render_texto_variables(pautas_alarma, vars_dict)

    # Configurar buffer y documento ReportLab
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=32,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=c_primario,
        alignment=0, # Left
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748B")
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=c_primario,
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B")
    )

    body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B")
    )

    alerta_style = ParagraphStyle(
        'AlertaText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_alerta_texto
    )

    story = []

    # 1. ENCABEZADO INSTITUCIONAL CON LOGO
    logo_path = obtener_o_cachear_logo_local() if mostrar_logo else None
    col_widths = [140, 400]
    
    header_right = [
        Paragraph(titulo_doc, title_style),
        Paragraph(f"<b>CENTRO VISIÓN</b> • Especialidades Oftalmológicas y Cirugía de Alta Complejidad", subtitle_style),
        Paragraph(f"Fecha de emisión: {fecha_emision} • Hora: {hora_emision} hs" + (f" • Ref Geclisa: #{geclisa_im_id}" if geclisa_im_id else ""), subtitle_style)
    ]

    header_left = []
    if logo_path and os.path.exists(logo_path):
        try:
            img = RLImage(logo_path, width=120, height=42)
            header_left.append(img)
        except Exception:
            header_left.append(Paragraph("<b>CENTRO VISIÓN</b>", title_style))
    else:
        header_left.append(Paragraph("<b>CENTRO VISIÓN</b>", title_style))

    header_table = Table([[header_left, header_right]], colWidths=col_widths)
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_primario, spaceBefore=4, spaceAfter=8))

    # 1.1 INSIGNIA DESTACADA DEL OJO A INTERVENIR (OPCIÓN B)
    ojo_upper = (ojo_intervenido or "OD").upper().strip()
    if "OD" in ojo_upper or "DERECHO" in ojo_upper:
        ojo_title = "OJO DERECHO (Tu ojo del lado DERECHO)"
        c_ojo_bg = colors.HexColor("#EFF6FF")
        c_ojo_border = colors.HexColor("#2563EB")
        c_ojo_text = colors.HexColor("#1E40AF")
    elif "OI" in ojo_upper or "IZQUIERDO" in ojo_upper:
        ojo_title = "OJO IZQUIERDO (Tu ojo del lado IZQUIERDO)"
        c_ojo_bg = colors.HexColor("#FAF5FF")
        c_ojo_border = colors.HexColor("#7C3AED")
        c_ojo_text = colors.HexColor("#5B21B6")
    else:
        ojo_title = f"{ojo_label} (Tratamiento en Ambos Ojos)"
        c_ojo_bg = colors.HexColor("#F0FDF4")
        c_ojo_border = colors.HexColor("#059669")
        c_ojo_text = colors.HexColor("#065F46")

    ojo_banner_style = ParagraphStyle(
        'OjoBanner',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=c_ojo_text,
        alignment=1
    )
    ojo_table = Table([[Paragraph(f"👁️ <b>PROCEDIMIENTO EN: {ojo_title}</b> 👁️", ojo_banner_style)]], colWidths=[540])
    ojo_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_ojo_bg),
        ('BOX', (0,0), (-1,-1), 1.5, c_ojo_border),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(ojo_table)
    story.append(Spacer(1, 6))

    # 2. TARJETA RESUMEN DEL PACIENTE Y PROCEDIMIENTO
    card_data = [
        [
            Paragraph("<b>Paciente:</b>", body_style),
            Paragraph(paciente_nombre, body_bold),
            Paragraph("<b>DNI:</b>", body_style),
            Paragraph(paciente_dni, body_style),
        ],
        [
            Paragraph("<b>Cobertura:</b>", body_style),
            Paragraph(paciente_os, body_style),
            Paragraph("<b>Ojo a Operar:</b>", body_style),
            Paragraph(f"<b>{ojo_label}</b>", body_bold),
        ],
        [
            Paragraph("<b>Práctica:</b>", body_style),
            Paragraph(practica_nombre, body_style),
            Paragraph("<b>Cirujano:</b>", body_style),
            Paragraph(f"<b>{medico_nombre}</b>" + (f" (MP: {medico_matricula})" if medico_matricula else ""), body_style),
        ]
    ]
    card_table = Table(card_data, colWidths=[65, 230, 85, 160])
    card_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_fondo_card),
        ('BOX', (0,0), (-1,-1), 1, c_borde_card),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_borde_card),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(card_table)
    story.append(Spacer(1, 10))

    # 3. TEXTO DESCRIPTIVO DE LA INDICACIÓN / PROTOCOLO
    if texto_cuerpo.strip():
        story.append(Paragraph("1. PROTOCOLO DE TRATAMIENTO & INDICACIONES", section_heading))
        for parrafo in texto_cuerpo.split('\n'):
            p_limpio = parrafo.strip()
            if p_limpio:
                story.append(Paragraph(p_limpio, body_style))
                story.append(Spacer(1, 2))
        story.append(Spacer(1, 6))

    # 4. TABLA ESTRUCTURADA DE MEDICAMENTOS Y GOTAS (SI EXISTEN)
    if isinstance(medicamentos, list) and len(medicamentos) > 0:
        story.append(Paragraph("2. ESQUEMA DE MEDICACIÓN Y COLIRIOS OFTALMOLÓGICOS", section_heading))
        
        headers_med = [
            Paragraph("<b>Medicamento / Principio Activo</b>", ParagraphStyle('HM1', parent=body_bold, textColor=colors.white)),
            Paragraph("<b>Dosis</b>", ParagraphStyle('HM2', parent=body_bold, textColor=colors.white)),
            Paragraph("<b>Frecuencia / Horario</b>", ParagraphStyle('HM3', parent=body_bold, textColor=colors.white)),
            Paragraph("<b>Duración</b>", ParagraphStyle('HM4', parent=body_bold, textColor=colors.white)),
            Paragraph("<b>Instrucciones Clave</b>", ParagraphStyle('HM5', parent=body_bold, textColor=colors.white)),
        ]
        tabla_med_data = [headers_med]
        for m in medicamentos:
            droga = m.get("droga") or m.get("medicamento") or m.get("nombre") or "-"
            dosis = m.get("dosis") or "1 gota"
            frec = m.get("frecuencia") or m.get("horario") or "-"
            duracion = m.get("duracion") or "7 días"
            instrucciones = m.get("instrucciones") or m.get("notas") or "Instilar en fondo de saco"
            tabla_med_data.append([
                Paragraph(f"<b>{droga}</b>", body_style),
                Paragraph(dosis, body_style),
                Paragraph(f"<b>{frec}</b>", body_style),
                Paragraph(duracion, body_style),
                Paragraph(instrucciones, body_style)
            ])

        tabla_med = Table(tabla_med_data, colWidths=[140, 60, 105, 75, 160])
        tabla_med.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), c_primario),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, c_borde_card),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F1F5F9")]),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(tabla_med)
        story.append(Spacer(1, 6))

        # REGLA DE ORO DE 10 MINUTOS & GUÍA HORARIA (OPCIÓN A)
        golden_rule_style = ParagraphStyle(
            'GoldenRule',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#92400E")
        )
        golden_content = [
            Paragraph("<b>⏳ REGLA DE ORO ENTRE GOTAS DISTINTAS:</b>", ParagraphStyle('GRBold', parent=golden_rule_style, fontName='Helvetica-Bold')),
            Paragraph(
                "Si le coincide colocarse 2 colirios al mismo horario, aplique el primero, <b>espere 10 minutos completos</b> "
                "con el ojo cerrado suavemente para que la gota se absorba, y luego instile el segundo colirio. <i>Nunca los aplique juntos.</i>",
                golden_rule_style
            ),
            Spacer(1, 3),
            Paragraph(
                "<b>⏰ Guía de horarios recomendados (respetando descanso nocturno):</b><br/>"
                "• <b>Cada 4 horas:</b> 08:00 hs &nbsp;•&nbsp; 12:00 hs &nbsp;•&nbsp; 16:00 hs &nbsp;•&nbsp; 20:00 hs<br/>"
                "• <b>Cada 6 horas:</b> 08:00 hs &nbsp;•&nbsp; 14:00 hs &nbsp;•&nbsp; 20:00 hs<br/>"
                "• <b>Cada 8 horas:</b> 08:00 hs &nbsp;•&nbsp; 16:00 hs &nbsp;•&nbsp; 24:00 hs<br/>"
                "• <b>Cada 12 horas:</b> 08:00 hs &nbsp;•&nbsp; 20:00 hs",
                golden_rule_style
            )
        ]
        golden_table = Table([[golden_content]], colWidths=[540])
        golden_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFBEB")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#F59E0B")),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(golden_table)
        story.append(Spacer(1, 10))

    # 5. CUIDADOS GENERALES Y REPOSO
    if cuidados_generales.strip():
        story.append(Paragraph("3. CUIDADOS POSTOPERATORIOS & REPOSO", section_heading))
        for linea in cuidados_generales.split('\n'):
            linea_limpia = linea.strip()
            if linea_limpia:
                story.append(Paragraph(f"• {linea_limpia.lstrip('•-* ')}", body_style))
                story.append(Spacer(1, 2))
        story.append(Spacer(1, 8))

    # 6. RECUADRO DE PAUTAS DE ALARMA (URGENCIAS)
    if pautas_alarma.strip():
        story.append(Paragraph("4. PAUTAS DE ALARMA & CUÁNDO CONSULTAR DE URGENCIA", section_heading))
        alerta_content = [
            Paragraph("<b>¡ATENCIÓN! SIGNOS DE ALERTA MÉDICA:</b>", ParagraphStyle('ABold', parent=alerta_style, fontName='Helvetica-Bold')),
            Paragraph(pautas_alarma, alerta_style),
            Paragraph("<b>Guardia Oftalmológica Centro Visión:</b> Tel / Urgencias disponible las 24 horas.", alerta_style)
        ]
        alerta_table = Table([[alerta_content]], colWidths=[540])
        alerta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), c_alerta_fondo),
            ('BOX', (0,0), (-1,-1), 1, c_alerta_borde),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(alerta_table)
        story.append(Spacer(1, 12))

    # 7. PIE DE PÁGINA: FIRMA Y SELLO PROFESIONAL + QR
    pie_elements = []
    
    # Bloque de validación / QR (simulado con texto o QR si reportlab-qrcode disponible)
    info_legal = [
        Paragraph(pie_pagina_custom, subtitle_style),
        Paragraph(f"ID Emisión: {emision_id[:8]} • Emitido en Geclisa ID: {geclisa_im_id or 'Pendiente'} • Validado clínicamente", subtitle_style)
    ]

    # Bloque de firma
    firma_content = []
    if mostrar_firma:
        firma_content = [
            HRFlowable(width="80%", thickness=1, color=colors.HexColor("#94A3B8"), spaceBefore=10, spaceAfter=2),
            Paragraph(f"<b>{medico_nombre}</b>", ParagraphStyle('FirmaMed', parent=subtitle_style, alignment=1)),
            Paragraph(f"Especialista en Oftalmología • MP {medico_matricula or '-'}", ParagraphStyle('FirmaMP', parent=subtitle_style, alignment=1))
        ]

    pie_table = Table([[info_legal, firma_content]], colWidths=[360, 180])
    pie_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(KeepTogether([pie_table]))

    # Compilar PDF
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    # Guardar en static para acceso público / WhatsApp
    filename = f"indicacion_{emision_id}.pdf"
    filepath = os.path.join(STATIC_DIR, filename)
    url_publica = f"/static/{filename}"

    if guardar_en_disco:
        try:
            with open(filepath, "wb") as f:
                f.write(pdf_bytes)
            logger.info(f"PDF de indicación guardado en disco: {filepath}")
        except Exception as e:
            logger.error(f"Error guardando PDF en disco: {e}")

    return {
        "pdf_bytes": pdf_bytes,
        "file_path": filepath,
        "filename": filename,
        "url": url_publica,
        "emision_id": emision_id
    }
