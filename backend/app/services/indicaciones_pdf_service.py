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
    KeepTogether, Image as RLImage, HRFlowable, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.services.config_service import load_settings, obtener_o_cachear_logo_local

logger = logging.getLogger("indicaciones_pdf_service")

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
    Genera el PDF oficial de Indicaciones Médicas Quirúrgicas u Órdenes Médicas.
    Si la práctica médica tiene más de una indicación asociada (1 a N), cada indicación
    se imprime en una hoja independiente con sus datos de paciente completos y firma.
    """
    # 1. Configuración del Lienzo Maestro
    cfg = dict(config_diseno or {})
    if not cfg:
        try:
            cfg = load_settings().get("lienzo_indicaciones") or {}
        except Exception as e:
            logger.warning(f"No se pudo cargar lienzo_indicaciones: {e}")
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

    nombre_institucion = cfg.get("nombre_institucion") or "CENTRO VISIÓN"
    subtitulo_institucion = cfg.get("subtitulo_institucion") or "Especialidades Oftalmológicas y Cirugía de Alta Complejidad"
    pie_pagina_custom = cfg.get("pie_pagina") or f"Documento médico oficial emitido electrónicamente por {nombre_institucion}."

    # Datos clínicos y demográficos del paciente
    emision_id = str(datos_emision.get("id") or uuid.uuid4())
    paciente_nombre = str(datos_emision.get("paciente_nombre") or "Paciente").strip()
    paciente_dni = formatear_dni(datos_emision.get("paciente_dni"))
    paciente_os = str(datos_emision.get("paciente_obra_social") or datos_emision.get("paciente_cobertura") or "-").strip()
    paciente_afiliado = str(datos_emision.get("paciente_afiliado") or datos_emision.get("paciente_nro_afiliado") or "-").strip()
    paciente_domicilio = str(datos_emision.get("paciente_domicilio") or datos_emision.get("paciente_direccion") or "-").strip()

    medico_nombre = datos_emision.get("medico_nombre") or "Médico Cirujano"
    medico_matricula = datos_emision.get("medico_matricula") or ""
    fecha_emision = datos_emision.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    hora_emision = datos_emision.get("hora") or datetime.now().strftime("%H:%M")
    geclisa_im_id = datos_emision.get("geclisa_im_id")

    # Tamaño de página y dimensiones según el lienzo
    tamano_hoja = str(cfg.get("tamano_hoja", "media_a4_horizontal")).lower()
    if "media" in tamano_hoja or "a5" in tamano_hoja or "horizontal" in tamano_hoja:
        # Media hoja A4 Horizontal: 21.0 cm x 14.85 cm
        page_size = (595.2756, 420.9449)
        margin_left = 26
        margin_right = 26
        margin_top = 18
        margin_bottom = 16
        is_compact = True
    elif "a4" in tamano_hoja:
        page_size = A4
        margin_left = 34
        margin_right = 34
        margin_top = 30
        margin_bottom = 28
        is_compact = False
    else:  # letter
        page_size = letter
        margin_left = 34
        margin_right = 34
        margin_top = 30
        margin_bottom = 28
        is_compact = False

    content_width = page_size[0] - (margin_left + margin_right)

    # Estilos tipográficos
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=12 if is_compact else 14,
        leading=15 if is_compact else 17,
        textColor=c_primario,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5 if is_compact else 8.5,
        leading=10 if is_compact else 11,
        textColor=colors.HexColor("#64748B")
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=9 if is_compact else 10,
        leading=12 if is_compact else 13,
        textColor=c_primario,
        spaceBefore=6 if is_compact else 10,
        spaceAfter=3 if is_compact else 4
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5 if is_compact else 9,
        leading=11.5 if is_compact else 13,
        textColor=colors.HexColor("#1E293B")
    )

    body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5 if is_compact else 9,
        leading=11.5 if is_compact else 13,
        textColor=colors.HexColor("#1E293B")
    )

    alerta_style = ParagraphStyle(
        'AlertaText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8 if is_compact else 8.5,
        leading=10.5 if is_compact else 12,
        textColor=c_alerta_texto
    )

    # Resolver lista de páginas / indicaciones (Multi-página para 1 a N)
    modulos_raw = datos_emision.get("modulos")
    lista_indicaciones = []

    if isinstance(modulos_raw, list) and len(modulos_raw) > 0:
        for m in modulos_raw:
            txt = m.get("cuerpo_indicaciones") or m.get("texto_indicaciones") or ""
            meds = m.get("medicamentos") or []
            cuid = m.get("cuidados_generales") or ""
            alar = m.get("pautas_alarma") or ""
            if txt.strip() or meds or cuid.strip() or alar.strip():
                lista_indicaciones.append({
                    "titulo": m.get("titulo") or "INDICACIÓN MÉDICA",
                    "cuerpo": txt,
                    "medicamentos": meds,
                    "cuidados": cuid,
                    "alarmas": alar
                })
    
    # Si no se pasó lista de módulos estructurados, armar con datos_emision
    if not lista_indicaciones:
        raw_cuerpo = datos_emision.get("cuerpo_indicaciones") or datos_emision.get("texto_indicaciones") or ""
        # Si contiene separadores "---", dividir en hojas separadas automáticamente
        partes_texto = [p.strip() for p in raw_cuerpo.split("---") if p.strip()]
        if len(partes_texto) > 1:
            for idx, p_txt in enumerate(partes_texto):
                lista_indicaciones.append({
                    "titulo": f"INDICACIÓN #{idx + 1}",
                    "cuerpo": p_txt,
                    # Solo la primera lleva medicamentos/cuidados si estaban globales
                    "medicamentos": datos_emision.get("medicamentos") if idx == 0 else [],
                    "cuidados": datos_emision.get("cuidados_generales") if idx == 0 else "",
                    "alarmas": datos_emision.get("pautas_alarma") if idx == 0 else ""
                })
        else:
            lista_indicaciones.append({
                "titulo": "INDICACIÓN MÉDICA",
                "cuerpo": raw_cuerpo,
                "medicamentos": datos_emision.get("medicamentos") or [],
                "cuidados": datos_emision.get("cuidados_generales") or "",
                "alarmas": datos_emision.get("pautas_alarma") or ""
            })

    # Diccionario de reemplazo de variables
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

    # Iniciar construcción del documento ReportLab
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=margin_left,
        rightMargin=margin_right,
        topMargin=margin_top,
        bottomMargin=margin_bottom
    )

    story = []
    logo_path = obtener_o_cachear_logo_local(cfg.get("logo_url")) if mostrar_logo else None

    # Función auxiliar para renderizar una página completa de indicación médica
    def render_pagina_indicacion(item_ind: Dict[str, Any], es_ultima: bool):
        cuerpo_txt = render_texto_variables(item_ind["cuerpo"], vars_dict)
        cuid_txt = render_texto_variables(item_ind["cuidados"], vars_dict)
        alar_txt = render_texto_variables(item_ind["alarmas"], vars_dict)
        meds_list = item_ind["medicamentos"]

        raw_lower = cuerpo_txt.lower()
        es_orden = "solicito:" in raw_lower or "solicito " in raw_lower or "pedido" in raw_lower
        titulo_doc = cfg.get("titulo_documento") or ("ORDEN MÉDICA DE PROCEDIMIENTO" if es_orden else "INDICACIONES MÉDICAS")

        # 1. ENCABEZADO INSTITUCIONAL
        col_w_header = [115 if is_compact else 130, content_width - (115 if is_compact else 130)]
        header_right = [
            Paragraph(titulo_doc, title_style),
            Paragraph(f"<b>{nombre_institucion}</b> • {subtitulo_institucion}", subtitle_style),
            Paragraph(f"Fecha: {fecha_emision} • Hora: {hora_emision} hs" + (f" • Ref Geclisa: #{geclisa_im_id}" if geclisa_im_id else ""), subtitle_style)
        ]

        header_left = []
        if logo_path and os.path.exists(logo_path):
            try:
                img_w = 100 if is_compact else 115
                img_h = 32 if is_compact else 40
                header_left.append(RLImage(logo_path, width=img_w, height=img_h))
            except Exception:
                header_left.append(Paragraph(f"<b>{nombre_institucion}</b>", title_style))
        else:
            header_left.append(Paragraph(f"<b>{nombre_institucion}</b>", title_style))

        header_table = Table([[header_left, header_right]], colWidths=col_w_header)
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2 if is_compact else 4),
        ]))
        story.append(header_table)
        story.append(HRFlowable(width="100%", thickness=1.2, color=c_primario, spaceBefore=2 if is_compact else 4, spaceAfter=5 if is_compact else 8))

        # 2. TARJETA OFICIAL DEL PACIENTE (Ficha demográfica completa)
        col_w_card = [65, (content_width - 140) / 2, 75, (content_width - 140) / 2]
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
            ('BOX', (0,0), (-1,-1), 0.75, c_borde_card),
            ('INNERGRID', (0,0), (-1,-1), 0.5, c_borde_card),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 2.5 if is_compact else 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.5 if is_compact else 4),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(card_table)
        story.append(Spacer(1, 6 if is_compact else 10))

        # 3. TEXTO DEL CUERPO DE LA INDICACIÓN / SOLICITUD
        if cuerpo_txt.strip():
            for parrafo in cuerpo_txt.split('\n'):
                p_limpio = parrafo.strip()
                if p_limpio:
                    p_lower = p_limpio.lower()
                    if p_lower.startswith("solicito:") or p_lower.startswith("diagnóstico:") or p_lower.startswith("diagnostico:"):
                        story.append(Paragraph(f"<b>{p_limpio}</b>", body_bold))
                    else:
                        story.append(Paragraph(p_limpio, body_style))
                    story.append(Spacer(1, 1.5 if is_compact else 2))
            story.append(Spacer(1, 4 if is_compact else 6))

        # 4. ESQUEMA DE MEDICACIÓN Y COLIRIOS (SOLO SI TIENE FÁRMACOS)
        if isinstance(meds_list, list) and len(meds_list) > 0:
            story.append(Paragraph("ESQUEMA DE MEDICACIÓN Y COLIRIOS OFTALMOLÓGICOS", section_heading))
            headers_med = [
                Paragraph("<b>Medicamento / Principio Activo</b>", ParagraphStyle('HM1', parent=body_bold, textColor=colors.white)),
                Paragraph("<b>Dosis</b>", ParagraphStyle('HM2', parent=body_bold, textColor=colors.white)),
                Paragraph("<b>Frecuencia</b>", ParagraphStyle('HM3', parent=body_bold, textColor=colors.white)),
                Paragraph("<b>Duración</b>", ParagraphStyle('HM4', parent=body_bold, textColor=colors.white)),
                Paragraph("<b>Instrucciones Clave</b>", ParagraphStyle('HM5', parent=body_bold, textColor=colors.white)),
            ]
            tabla_med_data = [headers_med]
            for m in meds_list:
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

            col_w_med = [135, 50, 95, 65, content_width - 345]
            tabla_med = Table(tabla_med_data, colWidths=col_w_med)
            tabla_med.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), c_primario),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.5, c_borde_card),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F1F5F9")]),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('TOPPADDING', (0,0), (-1,-1), 2.5 if is_compact else 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2.5 if is_compact else 4),
                ('LEFTPADDING', (0,0), (-1,-1), 4),
                ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(tabla_med)
            story.append(Spacer(1, 4 if is_compact else 6))

            golden_rule_style = ParagraphStyle(
                'GoldenRule',
                parent=styles['Normal'],
                fontName='Helvetica',
                fontSize=7.5 if is_compact else 8,
                leading=9.5 if is_compact else 11,
                textColor=colors.HexColor("#92400E")
            )
            golden_content = [
                Paragraph("<b>⏳ REGLA DE ORO ENTRE GOTAS:</b> Si le coincide colocarse 2 colirios al mismo horario, aplique el primero, <b>espere 10 minutos completos</b> con el ojo cerrado para que se absorba, y luego instile el segundo.", golden_rule_style)
            ]
            golden_table = Table([[golden_content]], colWidths=[content_width])
            golden_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFBEB")),
                ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor("#F59E0B")),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(golden_table)
            story.append(Spacer(1, 5 if is_compact else 8))

        # 5. PAUTAS DE REPOSO Y CUIDADOS (SOLO SI TIENE CONTENIDO)
        if cuid_txt.strip():
            story.append(Paragraph("PAUTAS DE REPOSO Y CUIDADOS", section_heading))
            for linea in cuid_txt.split('\n'):
                linea_limpia = linea.strip()
                if linea_limpia:
                    story.append(Paragraph(f"• {linea_limpia.lstrip('•-* ')}", body_style))
                    story.append(Spacer(1, 1.5))
            story.append(Spacer(1, 4 if is_compact else 6))

        # 6. PAUTAS DE ALARMA (GUARDIA 24 HS) (SOLO SI TIENE CONTENIDO)
        if alar_txt.strip():
            story.append(Paragraph("PAUTAS DE ALARMA (GUARDIA 24 HS)", section_heading))
            alerta_content = [
                Paragraph("<b>¡ATENCIÓN! SIGNOS DE ALERTA MÉDICA:</b>", ParagraphStyle('ABold', parent=alerta_style, fontName='Helvetica-Bold')),
                Paragraph(alar_txt, alerta_style),
                Paragraph(f"<b>Guardia Oftalmológica {nombre_institucion}:</b> Urgencias disponible las 24 horas.", alerta_style)
            ]
            alerta_table = Table([[alerta_content]], colWidths=[content_width])
            alerta_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), c_alerta_fondo),
                ('BOX', (0,0), (-1,-1), 0.75, c_alerta_borde),
                ('TOPPADDING', (0,0), (-1,-1), 3.5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(alerta_table)
            story.append(Spacer(1, 6 if is_compact else 10))

        # 7. PIE DE PÁGINA: FIRMA Y SELLO + VALIDACIÓN LEGAL
        info_legal = [
            Paragraph(pie_pagina_custom, subtitle_style),
            Paragraph(f"ID Emisión: {emision_id[:8]} • Emitido en Geclisa ID: {geclisa_im_id or 'Pendiente'} • Validado clínicamente", subtitle_style)
        ]

        firma_content = []
        if mostrar_firma:
            firma_content = [
                HRFlowable(width="80%", thickness=0.8, color=colors.HexColor("#94A3B8"), spaceBefore=4, spaceAfter=2),
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

        if not es_ultima:
            story.append(PageBreak())

    # Generar cada indicación en su respectiva hoja
    total_ind = len(lista_indicaciones)
    for i, item_ind in enumerate(lista_indicaciones):
        render_pagina_indicacion(item_ind, es_ultima=(i == total_ind - 1))

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
        "emision_id": emision_id,
        "total_paginas": total_ind
    }
