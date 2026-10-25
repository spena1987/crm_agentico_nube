import os
import io
import re
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timezone, timedelta

from PIL import Image, ImageOps, ImageDraw, ImageFont
import pypdf
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether
)
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

BANNER_LOCAL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "static",
    "branding",
    "centrovision_banner.png"
)


ARGENTINA_TZ = timezone(timedelta(hours=-3))


def get_argentina_now() -> datetime:
    """Retorna la fecha y hora actual en el huso horario oficial de Argentina (UTC-3)."""
    return datetime.now(ARGENTINA_TZ)


def _load_pil_font(candidates: List[str], size: int) -> ImageFont.ImageFont:
    """Intenta cargar la primera fuente válida en candidates o usa el fallback vectorial con tamaño explícito."""
    for font_name in candidates:
        try:
            return ImageFont.truetype(font_name, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def _get_caratula_config() -> Dict[str, Any]:
    """Obtiene la configuración activa de carátulas desde el servicio de configuración central."""
    try:
        from app.services.config_service import load_settings
        settings = load_settings() or {}
        caratula = settings.get("caratula_estudios")
        if isinstance(caratula, dict):
            return caratula
    except Exception as e:
        logger.debug(f"Aviso leyendo configuracion de caratula_estudios: {e}")

    # Fallback predeterminado
    return {
        "activo": True,
        "modo_hibrido": True,
        "titulo_informe": "INFORME DE DIAGNÓSTICO OFTALMOLÓGICO",
        "subtitulo": "CENTROVISIÓN • OFTALMOLOGÍA INTEGRAL",
        "color_primario": "#007A87",
        "color_secundario": "#0F172A",
        "mostrar_ficha": True,
        "mostrar_tecnico": True,
        "mostrar_cobertura": True,
        "mostrar_sedes": True,
        "sedes": [
            "Mitre 540 | Ciudad de Mendoza",
            "Roca 71 | Luján de Cuyo | Mendoza",
            "Boedo 2879 | Carrodilla - Luján de Cuyo"
        ],
        "telefono_0800": "0-800-222-4040",
        "whatsapp_contacto": "261 553-0888",
        "texto_indicaciones": "Presente este informe a su médico oftalmólogo en su próxima consulta de control.",
        "pie_legal": "Documento e informe técnico generado electrónicamente por Centrovisión Oftalmología Integral."
    }


def generar_portada_pdf_a4(
    paciente: Dict[str, Any],
    estudio: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Genera una página A4 independiente (Carátula de Informe Médico Oficial)
    con diseño institucional de Centrovisión, datos del paciente y del estudio.
    """
    cfg = config or _get_caratula_config()
    color_hex = cfg.get("color_primario") or "#007A87"
    primary_color = colors.HexColor(color_hex)
    dark_color = colors.HexColor(cfg.get("color_secundario") or "#0F172A")
    muted_color = colors.HexColor("#64748B")
    border_color = colors.HexColor("#CBD5E1")
    light_bg = colors.HexColor("#F8FAFC")

    out_buf = io.BytesIO()
    doc = SimpleDocTemplate(
        out_buf,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=28,
        bottomMargin=28
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        alignment=1,
        textColor=primary_color
    )
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=muted_color
    )
    study_title_style = ParagraphStyle(
        'StudyTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=0,
        textColor=dark_color
    )
    badge_style = ParagraphStyle(
        'EyeBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=2,
        textColor=primary_color
    )
    label_style = ParagraphStyle(
        'CoverLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=muted_color
    )
    val_style = ParagraphStyle(
        'CoverVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=12,
        textColor=dark_color
    )
    val_bold_style = ParagraphStyle(
        'CoverValBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=dark_color
    )
    box_note_style = ParagraphStyle(
        'CoverNote',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        alignment=1,
        textColor=colors.HexColor("#334155")
    )
    footer_style = ParagraphStyle(
        'CoverFooter',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        alignment=1,
        textColor=muted_color
    )

    story = []

    # 1. Banner Institucional de Centrovisión
    if os.path.exists(BANNER_LOCAL_PATH):
        try:
            # Ancho disponible: 595 - 72 = 523 pt.
            banner_w = 523
            banner_h = int(banner_w * (115 / 969)) # ~62 pt
            story.append(RLImage(BANNER_LOCAL_PATH, width=banner_w, height=banner_h))
            story.append(Spacer(1, 10))
        except Exception as e:
            logger.warning(f"No se pudo cargar banner local: {e}")

    # 2. Título de Informe
    story.append(Paragraph(cfg.get("titulo_informe", "INFORME DE DIAGNÓSTICO OFTALMOLÓGICO"), title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph(cfg.get("subtitulo", "CENTROVISIÓN • OFTALMOLOGÍA INTEGRAL"), subtitle_style))
    story.append(Spacer(1, 14))

    # 3. Card Destacada: Estudio y Lateralidad
    tipo_estudio_nom = estudio.get("tipo_estudio") or "Estudio Oftalmológico"
    ojo_nom = estudio.get("ojo") or "AO"
    ojo_desc_map = {
        "AO": "Ambos Ojos (AO)",
        "OD": "Ojo Derecho (OD)",
        "OI": "Ojo Izquierdo (OI)",
        "N/A": "General"
    }
    ojo_texto = ojo_desc_map.get(ojo_nom.upper(), ojo_nom)

    study_card_data = [
        [
            Paragraph(f"<b>Estudio:</b> {tipo_estudio_nom}", study_title_style),
            Paragraph(f"<b>Lateralidad:</b> {ojo_texto}", badge_style)
        ]
    ]
    study_card_table = Table(study_card_data, colWidths=[340, 183])
    study_card_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_bg),
        ('BOX', (0, 0), (-1, -1), 1, primary_color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(study_card_table)
    story.append(Spacer(1, 14))

    # 4. Grilla de Identificación del Paciente y Datos Clínicos
    nombre_pac = paciente.get("nombre") or paciente.get("nombre_completo") or "Paciente"
    dni_pac = paciente.get("dni") or "N/A"
    ficha_id = paciente.get("ficha_id") or paciente.get("geclisa_ficha_id") or ""
    cobertura = paciente.get("obra_social") or ""
    plan = paciente.get("plan") or ""
    cob_str = f"{cobertura} ({plan})" if plan else (cobertura or "Particular / Sin especificar")

    tecnico_nom = estudio.get("tecnico_nombre") or "Técnico Oficial"
    now_arg = get_argentina_now()
    fecha_estudio = estudio.get("fecha_str") or now_arg.strftime("%d/%m/%Y")
    hora_estudio = estudio.get("hora_str") or now_arg.strftime("%H:%M hs")
    obs_pac = (estudio.get("observaciones") or "").strip()

    info_rows = [
        [
            Paragraph("PACIENTE", label_style),
            Paragraph(nombre_pac, val_bold_style),
            Paragraph("D.N.I.", label_style),
            Paragraph(dni_pac, val_bold_style)
        ]
    ]

    if cfg.get("mostrar_ficha", True) and ficha_id:
        info_rows.append([
            Paragraph("FICHA GECLISA", label_style),
            Paragraph(f"#{ficha_id}", val_style),
            Paragraph("FECHA / HORA", label_style),
            Paragraph(f"{fecha_estudio} • {hora_estudio}", val_style)
        ])
    else:
        info_rows.append([
            Paragraph("FECHA DEL ESTUDIO", label_style),
            Paragraph(fecha_estudio, val_style),
            Paragraph("HORA", label_style),
            Paragraph(hora_estudio, val_style)
        ])

    if cfg.get("mostrar_cobertura", True):
        info_rows.append([
            Paragraph("COBERTURA / PLAN", label_style),
            Paragraph(cob_str, val_style),
            Paragraph("PROFESIONAL / OPERADOR", label_style),
            Paragraph(tecnico_nom, val_style)
        ])
    else:
        info_rows.append([
            Paragraph("PROFESIONAL / OPERADOR", label_style),
            Paragraph(tecnico_nom, val_style),
            Paragraph("", label_style),
            Paragraph("", val_style)
        ])

    if obs_pac:
        info_rows.append([
            Paragraph("OBSERVACIONES", label_style),
            Paragraph(obs_pac, val_style),
            Paragraph("", label_style),
            Paragraph("", val_style)
        ])

    info_table = Table(info_rows, colWidths=[100, 160, 100, 163])
    info_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('SPAN', (1, -1), (3, -1)) if obs_pac else ('IDENTITY', (0, 0), (0, 0)),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 16))

    # 5. Cuadro Informativo / Instrucciones para el paciente
    indicaciones_texto = cfg.get(
        "texto_indicaciones",
        "Presente este informe a su médico oftalmólogo en su próxima consulta de control."
    )
    notice_data = [
        [
            Paragraph(
                f"<b>AVISO CLÍNICO IMPORTANTE:</b><br/>"
                f"Las imágenes, mapas biométricos y mediciones técnicas emitidas por el equipamiento diagnóstico oficial "
                f"de Centrovisión se encuentran adjuntas a continuación en este documento digital.<br/><br/>"
                f"<i>{indicaciones_texto}</i>",
                box_note_style
            )
        ]
    ]
    notice_table = Table(notice_data, colWidths=[523])
    notice_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#F59E0B")),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    story.append(notice_table)
    story.append(Spacer(1, 24))

    # 6. Pie de Página con Sedes y Teléfonos
    linea_0800 = cfg.get("telefono_0800", "0-800-222-4040")
    wa_contacto = cfg.get("whatsapp_contacto", "261 553-0888")
    sedes_list = cfg.get("sedes") or [
        "Mitre 540 | Ciudad de Mendoza",
        "Roca 71 | Luján de Cuyo | Mendoza",
        "Boedo 2879 | Carrodilla - Luján de Cuyo"
    ]
    sedes_str = " &nbsp;•&nbsp; ".join(sedes_list)

    if cfg.get("mostrar_sedes", True):
        footer_content = (
            f"<b>Central Telefónica:</b> {linea_0800} &nbsp;&nbsp;|&nbsp;&nbsp; <b>WhatsApp Recepción:</b> {wa_contacto}<br/>"
            f"<b>Sedes de Atención:</b> {sedes_str}<br/>"
            f"<i>{cfg.get('pie_legal', 'Documento emitido electrónicamente por Centrovisión Oftalmología Integral.')}</i>"
        )
    else:
        footer_content = (
            f"<i>{cfg.get('pie_legal', 'Documento emitido electrónicamente por Centrovisión Oftalmología Integral.')}</i>"
        )
    story.append(Paragraph(footer_content, footer_style))

    doc.build(story)
    return out_buf.getvalue()


def fusionar_portada_con_pdf(portada_bytes: bytes, estudio_pdf_bytes: bytes) -> bytes:
    """
    Combina la portada generada (Página 1) al frente del PDF original del estudio.
    """
    writer = pypdf.PdfWriter()

    portada_reader = pypdf.PdfReader(io.BytesIO(portada_bytes))
    for page in portada_reader.pages:
        writer.add_page(page)

    estudio_reader = pypdf.PdfReader(io.BytesIO(estudio_pdf_bytes))
    for page in estudio_reader.pages:
        writer.add_page(page)

    out_pdf = io.BytesIO()
    writer.write(out_pdf)
    return out_pdf.getvalue()


def componer_lamina_digital_imagen(
    image_bytes: bytes,
    paciente: Dict[str, Any],
    estudio: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
    export_format: str = "PDF"
) -> bytes:
    """
    Opción 2 (Lienzo Dinámico Mobile-First 'Zero White-Space'):
    Calcula la altura exacta de la lámina según el aspect ratio real de la imagen médica
    (panorámica, cuadrada o vertical). La imagen ocupa el ancho completo útil (1160 px)
    y el pie institucional se ubica inmediatamente debajo, eliminando todo espacio en blanco.
    export_format: 'JPEG' para envío nativo como imagen en WhatsApp (render directo en chat)
                   o 'PDF' para documento descargable o archivo Geclisa.
    """
    cfg = config or _get_caratula_config()
    PAGE_W = 1240
    max_w = PAGE_W - 80  # 1160 px (40 px de margen a cada lado)

    # 1. Cargar y preparar imagen médica diagnóstica
    study_img = Image.open(io.BytesIO(image_bytes))
    study_img = ImageOps.exif_transpose(study_img) or study_img
    if study_img.mode != "RGB":
        study_img = study_img.convert("RGB")

    # Escalar imagen médica manteniendo proporción
    scale = max_w / max(1, study_img.width)
    new_w = max_w
    new_h = int(study_img.height * scale)

    # Límite superior de seguridad para escaneos ultra-largos
    max_study_h = 2600
    if new_h > max_study_h:
        scale_limit = max_study_h / new_h
        new_h = max_study_h
        new_w = int(new_w * scale_limit)

    study_resized = study_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # 2. Medir dimensiones del Banner Oficial de Centrovisión (Diseño Slim)
    margin_top = 10
    banner_src = None
    banner_h = 48
    banner_w = 404
    banner_x = 40
    if os.path.exists(BANNER_LOCAL_PATH):
        try:
            banner_src = Image.open(BANNER_LOCAL_PATH)
            # Escala proporcional limitando la altura a 48 px para maximizar el área de estudio
            banner_h = 48
            banner_w = int(banner_h * (banner_src.width / banner_src.height))
            if banner_w > max_w:
                banner_w = max_w
                banner_h = int(banner_w * (banner_src.height / banner_src.width))
            banner_x = 40 + (max_w - banner_w) // 2
        except Exception as e:
            logger.warning(f"Aviso leyendo dimensiones del banner: {e}")
            banner_h = 48
            banner_w = 404
            banner_x = 40

    spacing = 8
    bar_h = 56
    mostrar_sedes = cfg.get("mostrar_sedes", True)
    footer_h = 42 if mostrar_sedes else 24
    margin_bottom = 10

    # 3. Calcular ALTURA TOTAL DINÁMICA de la lámina (Cero espacio muerto, máximo estudio)
    PAGE_H = margin_top + banner_h + spacing + bar_h + spacing + new_h + spacing + footer_h + margin_bottom

    # Crear lienzo elástico blanco
    canvas_img = Image.new("RGB", (PAGE_W, PAGE_H), (255, 255, 255))
    draw = ImageDraw.Draw(canvas_img)

    # 4. Estampar Banner Oficial Superior Slim
    banner_y = margin_top
    if banner_src:
        try:
            banner_resized = banner_src.resize((banner_w, banner_h), Image.Resampling.LANCZOS)
            canvas_img.paste(banner_resized, (banner_x, banner_y), banner_resized if "A" in banner_resized.mode else None)
        except Exception as e:
            logger.warning(f"No se pudo estampar banner en lámina: {e}")

    # 5. Barra de Datos Clínicos y Lateralidad (Diseño compacto continuo)
    bar_y1 = banner_y + banner_h + spacing
    bar_y2 = bar_y1 + bar_h
    draw.rectangle([40, bar_y1, PAGE_W - 40, bar_y2], fill=(248, 250, 252), outline=(0, 122, 135), width=2)

    tipo_estudio = (estudio.get("tipo_estudio") or "ESTUDIO OFTALMOLÓGICO").upper().strip()
    ojo = (estudio.get("ojo") or "AO").upper().strip()
    nombre_pac = (paciente.get("nombre") or paciente.get("nombre_completo") or "PACIENTE").upper().strip()
    dni_pac = str(paciente.get("dni") or "N/A").strip()
    now_arg = get_argentina_now()
    fecha_str = estudio.get("fecha_str") or now_arg.strftime("%d/%m/%Y")
    hora_str = estudio.get("hora_str") or now_arg.strftime("%H:%M hs")
    tecnico_str = (estudio.get("tecnico_nombre") or "").upper().strip()

    # Tipografía adaptativa para Windows y Linux (servidor Railway)
    bold_fonts = [
        "DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "arialbd.ttf",
        "LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
    ]
    reg_fonts = [
        "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "arial.ttf",
        "LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
    ]
    font_title = _load_pil_font(bold_fonts, 19)
    font_badge = _load_pil_font(bold_fonts, 18)
    font_info = _load_pil_font(reg_fonts, 13)
    font_footer = _load_pil_font(reg_fonts, 12)
    font_footer_sub = _load_pil_font(reg_fonts, 11)

    # Texto Fila 1 en barra
    draw.text((55, bar_y1 + 8), tipo_estudio[:50], fill=(15, 23, 42), font=font_title)
    draw.text((PAGE_W - 190, bar_y1 + 8), f"OJO: {ojo}", fill=(0, 122, 135), font=font_badge)

    # Texto Fila 2 en barra (separadores universales limpios con Cobertura y Plan)
    pac_parts = [f"PACIENTE: {nombre_pac[:28]}", f"DNI: {dni_pac}"]

    # Cobertura médica y plan
    cobertura = (paciente.get("obra_social") or "").strip().upper()
    plan = (paciente.get("plan") or "").strip().upper()
    if cfg.get("mostrar_cobertura", True) and (cobertura or plan):
        cob_txt = f"{cobertura} ({plan})" if (cobertura and plan) else (cobertura or plan)
        pac_parts.append(f"COBERTURA: {cob_txt[:26]}")

    ficha_id = paciente.get("ficha_id") or paciente.get("geclisa_ficha_id")
    if cfg.get("mostrar_ficha", True) and ficha_id:
        pac_parts.append(f"FICHA: #{ficha_id}")

    if cfg.get("mostrar_tecnico", True) and tecnico_str:
        pac_parts.append(f"TÉC: {tecnico_str[:18]}")

    pac_parts.append(f"FECHA: {fecha_str} {hora_str}")
    pac_line = "   |   ".join(pac_parts)
    draw.text((55, bar_y1 + 32), pac_line, fill=(71, 85, 105), font=font_info)

    # 6. Área del Estudio Diagnóstico (Ubicación continua inmediatamente después de la barra)
    study_y = bar_y2 + spacing
    pos_x = 40 + (max_w - new_w) // 2

    # Marco sutil para la imagen médica
    draw.rectangle([pos_x - 1, study_y - 1, pos_x + new_w + 1, study_y + new_h + 1], outline=(226, 232, 240), width=1)
    canvas_img.paste(study_resized, (pos_x, study_y))

    # 7. Pie Institucional Inferior Dinámico (Respeta mostrar_sedes y texto de indicaciones)
    foot_y = study_y + new_h + spacing
    draw.line([40, foot_y, PAGE_W - 40, foot_y], fill=(226, 232, 240), width=1)

    if mostrar_sedes:
        linea_0800 = cfg.get("telefono_0800", "0-800-222-4040")
        wa_num = cfg.get("whatsapp_contacto", "261 553-0888")
        sedes = cfg.get("sedes") or [
            "Mitre 540 (Ciudad)", "Roca 71 (Luján)", "Boedo 2879 (Carrodilla)"
        ]
        foot_txt1 = f"Centrovisión  |  Urgencias: {linea_0800}  |  WhatsApp: {wa_num}  |  Sedes: {'  •  '.join(sedes)}"
        foot_txt2 = cfg.get("texto_indicaciones") or "Presente este estudio a su médico oftalmólogo en su próxima consulta. Emitido digitalmente."
        draw.text((55, foot_y + 7), foot_txt1, fill=(100, 116, 139), font=font_footer)
        draw.text((55, foot_y + 23), foot_txt2, fill=(148, 163, 184), font=font_footer_sub)
    else:
        pie_txt = cfg.get("pie_legal") or "Centrovisión Oftalmología Integral  •  Documento e informe técnico digital oficial"
        draw.text((55, foot_y + 6), pie_txt, fill=(100, 116, 139), font=font_footer)

    # Exportar según el formato solicitado
    if str(export_format).upper() in ("JPEG", "JPG"):
        out_jpg = io.BytesIO()
        canvas_img.save(out_jpg, format="JPEG", quality=90, optimize=True)
        return out_jpg.getvalue()

    # Guardar en PDF de 1 página de alta definición
    out_pdf = io.BytesIO()
    canvas_img.save(out_pdf, format="PDF", resolution=150.0)
    return out_pdf.getvalue()


def componer_estudio_hibrido(
    files_data: List[Tuple[str, bytes, str]],
    paciente_info: Dict[str, Any],
    estudio_info: Dict[str, Any],
    config: Optional[Dict[str, Any]] = None,
    base_filename: str = "Estudio_Oftalmologico",
    unificar_en_pdf: bool = False
) -> Tuple[bytes, str, str]:
    """
    Función orquestadora principal para la Opción 2:
      1. Si la configuración 'activo' es False, retorna el archivo consolidado normal sin membrete.
      2. Si se recibió 1 sola imagen y 'modo_hibrido' es True:
         - Si unificar_en_pdf=False: Compone la Lámina Digital como Imagen JPEG (render directo en WhatsApp con plantilla IMG).
         - Si unificar_en_pdf=True: Compone la Lámina Digital como PDF de 1 página (plantilla PDF).
      3. Si se recibió un PDF o múltiples imágenes:
         Genera la portada A4 independiente (Pág 1) y la fusiona al frente del PDF.
    Retorna: (final_bytes, final_filename, final_mime_type)
    """
    if not files_data:
        raise ValueError("No se recibieron archivos para componer el estudio.")

    cfg = config or _get_caratula_config()
    clean_base = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base_filename).strip("_")

    safe_name = clean_base
    if not safe_name.lower().endswith(".pdf"):
        safe_name = f"{safe_name}.pdf"

    # Si la carátula está desactivada en Ajustes, usar consolidación estándar
    if not cfg.get("activo", True):
        # Fallback a PDF unificado normal
        if len(files_data) == 1 and files_data[0][2] == "application/pdf":
            return files_data[0][1], safe_name, "application/pdf"

    all_images = all(m.startswith("image/") for _, _, m in files_data)
    is_single_image = (len(files_data) == 1 and all_images)
    modo_hibrido = cfg.get("modo_hibrido", True)

    # =========================================================================
    # CASO 1: IMAGEN ÚNICA EN MODO MOBILE-FIRST (LÁMINA CLÍNICA DE 1 PÁGINA)
    # =========================================================================
    if is_single_image and modo_hibrido:
        _, raw_img_bytes, _ = files_data[0]
        if not unificar_en_pdf:
            safe_jpg_name = f"{os.path.splitext(clean_base)[0]}.jpg"
            lamina_jpg = componer_lamina_digital_imagen(
                image_bytes=raw_img_bytes,
                paciente=paciente_info,
                estudio=estudio_info,
                config=cfg,
                export_format="JPEG"
            )
            return lamina_jpg, safe_jpg_name, "image/jpeg"
        else:
            safe_pdf_name = f"{os.path.splitext(clean_base)[0]}.pdf"
            lamina_pdf = componer_lamina_digital_imagen(
                image_bytes=raw_img_bytes,
                paciente=paciente_info,
                estudio=estudio_info,
                config=cfg,
                export_format="PDF"
            )
            return lamina_pdf, safe_pdf_name, "application/pdf"
        return lamina_pdf_bytes, safe_name, "application/pdf"

    # =========================================================================
    # CASO 2: PDF O MÚLTIPLES IMÁGENES -> CARÁTULA A4 FORMAL (PÁGINA 1) + ESTUDIO
    # =========================================================================
    # 2.1 Preparar el PDF del estudio original
    if len(files_data) == 1 and files_data[0][2] == "application/pdf":
        estudio_pdf_bytes = files_data[0][1]
    else:
        # Si son múltiples imágenes, convertirlas primero a PDF multipágina
        pil_pages: List[Image.Image] = []
        for _, raw_b, _ in files_data:
            im = Image.open(io.BytesIO(raw_b))
            im = ImageOps.exif_transpose(im) or im
            if im.mode != "RGB":
                im = im.convert("RGB")
            pil_pages.append(im)

        tmp_pdf = io.BytesIO()
        pil_pages[0].save(
            tmp_pdf,
            format="PDF",
            resolution=150.0,
            save_all=True,
            append_images=pil_pages[1:]
        )
        estudio_pdf_bytes = tmp_pdf.getvalue()

    # 2.2 Generar la portada A4 independiente con ReportLab
    portada_bytes = generar_portada_pdf_a4(
        paciente=paciente_info,
        estudio=estudio_info,
        config=cfg
    )

    # 2.3 Fusionar portada como Página 1 con pypdf
    final_merged_pdf = fusionar_portada_con_pdf(portada_bytes, estudio_pdf_bytes)
    return final_merged_pdf, safe_name, "application/pdf"
