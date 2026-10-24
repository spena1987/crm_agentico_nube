import os
import re
import uuid
import io
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, Image as RLImage, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.services.config_service import load_settings, obtener_o_cachear_logo_local

logger = logging.getLogger("indicaciones_pdf_service")

# Directorio de almacenamiento para PDFs estáticos generados
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
os.makedirs(STATIC_DIR, exist_ok=True)


def parse_color_hex(hex_str: str, default: str = "#0369A1") -> colors.HexColor:
    try:
        if hex_str and hex_str.startswith("#") and len(hex_str) in [4, 7]:
            return colors.HexColor(hex_str)
        return colors.HexColor(default)
    except Exception:
        return colors.HexColor(default)


def formatear_dni(dni_raw: Any) -> str:
    """
    Formatea el DNI limpiando ceros residuales a la izquierda o separando por miles.
    Ej: '033516799' -> '33.516.799'
    """
    if not dni_raw:
        return "-"
    dni_str = str(dni_raw).strip()
    if not dni_str or dni_str == "-":
        return "-"
    if "." in dni_str:
        return dni_str
    if dni_str.isdigit():
        dni_num = int(dni_str)
        if dni_num > 1000000:
            return f"{dni_num:,}".replace(",", ".")
        return str(dni_num)
    return dni_str


def render_texto_variables(texto: str, variables: Dict[str, Any]) -> str:
    """
    Reemplaza variables dinámicas en el texto como {{paciente}}, {{dni}}, {{cirujano}}, etc.
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
    Genera el PDF oficial de Indicaciones Médicas Quirúrgicas u Órdenes Médicas
    incrustando el contenido sobre el Lienzo Maestro Global institucional.
    """
    # 1. Cargar configuración del Lienzo Maestro
    cfg = dict(config_diseno or {})
    if not cfg:
        try:
            cfg = load_settings().get("lienzo_indicaciones") or {}
        except Exception as e:
            logger.warning(f"No se pudo cargar lienzo_indicaciones de settings: {e}")
            cfg = {}

    color_primario_hex = cfg.get("color_primario", "#0369A1")
    color_secundario_hex = cfg.get("color_secundario", "#0284C7")
    
    c_primario = parse_color_hex(color_primario_hex, "#0369A1")
    c_secundario = parse_color_hex(color_secundario_hex, "#0284C7")
    c_fondo_card = colors.HexColor("#F8FAFC")
    c_borde_card = colors.HexColor("#E2E8F0")
    c_alerta_fondo = colors.HexColor("#FEF2F2")
    c_alerta_borde = colors.HexColor("#FCA5A5")
    c_alerta_texto = colors.HexColor("#991B1B")

    mostrar_logo = cfg.get("mostrar_logo", True)
    mostrar_firma = cfg.get("mostrar_firma", True)

    raw_texto = datos_emision.get("cuerpo_indicaciones") or datos_emision.get("texto_indicaciones") or ""
    raw_lower = str(raw_texto).lower()
    es_orden_detectada = (
        "solicito:" in raw_lower
        or "solicito " in raw_lower
        or "orden medica" in raw_lower
        or "orden médica" in raw_lower
        or "pedido de estudio" in raw_lower
    )
    titulo_doc = cfg.get("titulo_documento") or ("ORDEN MÉDICA DE PROCEDIMIENTO" if es_orden_detectada else "INDICACIONES MÉDICAS")
    nombre_institucion = cfg.get("nombre_institucion") or "CENTRO VISIÓN"
    subtitulo_institucion = cfg.get("subtitulo_institucion") or "Especialidades Oftalmológicas y Cirugía de Alta Complejidad"
    pie_pagina_custom = cfg.get("pie_pagina") or f"Documento médico oficial emitido electrónicamente por {nombre_institucion}."

    # Datos clínicos y de la ficha del paciente
    emision_id = str(datos_emision.get("id") or uuid.uuid4())
    paciente_nombre = str(datos_emision.get("paciente_nombre") or "Paciente").strip()
    paciente_dni = formatear_dni(datos_emision.get("paciente_dni"))
    paciente_os = str(datos_emision.get("paciente_obra_social") or datos_emision.get("paciente_cobertura") or "-").strip()
    paciente_afiliado = str(datos_emision.get("paciente_afiliado") or datos_emision.get("paciente_nro_afiliado") or "-").strip()
    paciente_domicilio = str(datos_emision.get("paciente_domicilio") or datos_emision.get("paciente_direccion") or "-").strip()

    medico_nombre = datos_emision.get("medico_nombre") or "Médico Especialista"
    medico_matricula = datos_emision.get("medico_matricula") or ""
    fecha_emision = datos_emision.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    hora_emision = datos_emision.get("hora") or datetime.now().strftime("%H:%M")
    geclisa_im_id = datos_emision.get("geclisa_im_id")

    texto_cuerpo = raw_texto
    medicamentos = datos_emision.get("medicamentos") or []
    cuidados_generales = datos_emision.get("cuidados_generales") or ""
    pautas_alarma = datos_emision.get("pautas_alarma") or ""

    # Reemplazo dinámico de variables
    vars_dict = {
        "paciente": paciente_nombre,
        "paciente_nombre": paciente_nombre,
        "dni": paciente_dni,
        "cobertura": paciente_os,
        "obra_social": paciente_os,
        "afiliado": paciente_afiliado,
        "domicilio": paciente_domicilio,
        "cirujano": medico_nombre,
        "medico": medico_nombre,
        "matricula": medico_matricula,
        "fecha": fecha_emision,
        "hora": hora_emision,
    }
    texto_cuerpo = render_texto_variables(texto_cuerpo, vars_dict)
    cuidados_generales = render_texto_variables(cuidados_generales, vars_dict)
    pautas_alarma = render_texto_variables(pautas_alarma, vars_dict)

    # Configuración de página y dimensiones según el lienzo
    tamano_hoja = str(cfg.get("tamano_hoja", "letter")).lower()
    page_size = A4 if "a4" in tamano_hoja else letter
    page_width = 595.27 if "a4" in tamano_hoja else 612.0
    content_width = page_width - 72.0  # Márgenes izq/der 36 pt

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
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
        fontSize=14,
        leading=17,
        textColor=c_primario,
        alignment=0,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748B")
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=c_primario,
        spaceBefore=10,
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

    # 1. ENCABEZADO INSTITUCIONAL CON LOGO Y TÍTULO
    logo_path = obtener_o_cachear_logo_local(cfg.get("logo_url")) if mostrar_logo else None
    col_widths_header = [130, content_width - 130]
    
    header_right = [
        Paragraph(titulo_doc, title_style),
        Paragraph(f"<b>{nombre_institucion}</b> • {subtitulo_institucion}", subtitle_style),
        Paragraph(f"Fecha de emisión: {fecha_emision} • Hora: {hora_emision} hs" + (f" • Ref Geclisa: #{geclisa_im_id}" if geclisa_im_id else ""), subtitle_style)
    ]

    header_left = []
    if logo_path and os.path.exists(logo_path):
        try:
            img = RLImage(logo_path, width=115, height=40)
            header_left.append(img)
        except Exception:
            header_left.append(Paragraph(f"<b>{nombre_institucion}</b>", title_style))
    else:
        header_left.append(Paragraph(f"<b>{nombre_institucion}</b>", title_style))

    header_table = Table([[header_left, header_right]], colWidths=col_widths_header)
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_primario, spaceBefore=4, spaceAfter=8))

    # 2. TARJETA OFICIAL DEL PACIENTE (Ficha clínica estricta: Nombre, DNI, Cobertura, Afiliado y Domicilio)
    # Se omiten deliberadamente Práctica, Ojo y Cirujano de esta tarjeta según requerimiento clínico.
    col_w_card = [70, (content_width - 150) / 2, 80, (content_width - 150) / 2]
    card_data = [
        [
            Paragraph("<b>Paciente:</b>", body_style),
            Paragraph(paciente_nombre, body_bold),
            Paragraph("<b>DNI:</b>", body_style),
            Paragraph(paciente_dni, body_bold),
        ],
        [
            Paragraph("<b>Cobertura:</b>", body_style),
            Paragraph(paciente_os, body_style),
            Paragraph("<b>N° Afiliado:</b>", body_style),
            Paragraph(paciente_afiliado, body_style),
        ],
        [
            Paragraph("<b>Domicilio:</b>", body_style),
            Paragraph(paciente_domicilio, body_style),
            Paragraph("", body_style),
            Paragraph("", body_style),
        ]
    ]
    card_table = Table(card_data, colWidths=col_w_card)
    card_table.setStyle(TableStyle([
        ('SPAN', (1, 2), (3, 2)),
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

    # 3. TEXTO DEL CUERPO DE LA INDICACIÓN / SOLICITUD
    if texto_cuerpo.strip():
        for parrafo in texto_cuerpo.split('\n'):
            p_limpio = parrafo.strip()
            if p_limpio:
                if p_limpio == "---":
                    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=4, spaceAfter=6))
                else:
                    p_lower = p_limpio.lower()
                    if p_lower.startswith("solicito:") or p_lower.startswith("diagnóstico:") or p_lower.startswith("diagnostico:"):
                        story.append(Paragraph(f"<b>{p_limpio}</b>", body_bold))
                    else:
                        story.append(Paragraph(p_limpio, body_style))
                story.append(Spacer(1, 2))
        story.append(Spacer(1, 6))

    # 4. ESQUEMA DE MEDICACIÓN Y COLIRIOS (SOLO SI TIENE ELEMENTOS CARGADOS)
    if isinstance(medicamentos, list) and len(medicamentos) > 0:
        story.append(Paragraph("ESQUEMA DE MEDICACIÓN Y COLIRIOS OFTALMOLÓGICOS", section_heading))
        
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

        col_w_med = [140, 55, 105, 70, content_width - 370]
        tabla_med = Table(tabla_med_data, colWidths=col_w_med)
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

        golden_rule_style = ParagraphStyle(
            'GoldenRule',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#92400E")
        )
        golden_content = [
            Paragraph("<b>⏳ REGLA DE ORO ENTRE GOTAS DISTINTAS:</b>", ParagraphStyle('GRBold', parent=golden_rule_style, fontName='Helvetica-Bold')),
            Paragraph(
                "Si le coincide colocarse 2 colirios al mismo horario, aplique el primero, <b>espere 10 minutos completos</b> "
                "con el ojo cerrado suavemente para que la gota se absorba, y luego instile el segundo colirio. <i>Nunca los aplique juntos.</i>",
                golden_rule_style
            )
        ]
        golden_table = Table([[golden_content]], colWidths=[content_width])
        golden_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFBEB")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#F59E0B")),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(golden_table)
        story.append(Spacer(1, 8))

    # 5. PAUTAS DE REPOSO Y CUIDADOS (SOLO SI TIENE TEXTO CARGADO)
    if cuidados_generales.strip():
        story.append(Paragraph("PAUTAS DE REPOSO Y CUIDADOS", section_heading))
        for linea in cuidados_generales.split('\n'):
            linea_limpia = linea.strip()
            if linea_limpia:
                story.append(Paragraph(f"• {linea_limpia.lstrip('•-* ')}", body_style))
                story.append(Spacer(1, 2))
        story.append(Spacer(1, 6))

    # 6. PAUTAS DE ALARMA (GUARDIA 24 HS) (SOLO SI TIENE TEXTO CARGADO)
    if pautas_alarma.strip():
        story.append(Paragraph("PAUTAS DE ALARMA (GUARDIA 24 HS)", section_heading))
        alerta_content = [
            Paragraph("<b>¡ATENCIÓN! SIGNOS DE ALERTA MÉDICA:</b>", ParagraphStyle('ABold', parent=alerta_style, fontName='Helvetica-Bold')),
            Paragraph(pautas_alarma, alerta_style),
            Paragraph(f"<b>Guardia Oftalmológica {nombre_institucion}:</b> Urgencias disponible las 24 horas.", alerta_style)
        ]
        alerta_table = Table([[alerta_content]], colWidths=[content_width])
        alerta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), c_alerta_fondo),
            ('BOX', (0,0), (-1,-1), 1, c_alerta_borde),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(alerta_table)
        story.append(Spacer(1, 10))

    # 7. PIE DE PÁGINA: FIRMA Y SELLO PROFESIONAL + VALIDACIÓN LEGAL
    info_legal = [
        Paragraph(pie_pagina_custom, subtitle_style),
        Paragraph(f"ID Emisión: {emision_id[:8]} • Emitido en Geclisa ID: {geclisa_im_id or 'Pendiente'} • Validado clínicamente", subtitle_style)
    ]

    firma_content = []
    if mostrar_firma:
        firma_content = [
            HRFlowable(width="80%", thickness=1, color=colors.HexColor("#94A3B8"), spaceBefore=8, spaceAfter=2),
            Paragraph(f"<b>{medico_nombre}</b>", ParagraphStyle('FirmaMed', parent=subtitle_style, alignment=1)),
            Paragraph(f"Especialista en Oftalmología • MP {medico_matricula or '-'}", ParagraphStyle('FirmaMP', parent=subtitle_style, alignment=1))
        ]

    w_legal = content_width * 0.65
    w_firma = content_width * 0.35
    pie_table = Table([[info_legal, firma_content]], colWidths=[w_legal, w_firma])
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

    # Guardar en disco para distribución pública / WhatsApp si corresponde
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
