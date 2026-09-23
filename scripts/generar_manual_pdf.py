"""
Script para compilar y generar el documento PDF formal del Manual de Procedimientos Administrativos
bajo normas ISO 9001:2015 para el CRM Médico Inteligente.
"""

import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Image as RLImage, HRFlowable
)
from reportlab.pdfgen import canvas

# Paleta Institucional Calidad ISO
C_PRIMARY = colors.HexColor("#0F2942")     # Azul Marino Profundo Corporativo
C_SECONDARY = colors.HexColor("#1D4ED8")   # Azul Real
C_ACCENT = colors.HexColor("#0D9488")      # Verde Azulado / Calidad
C_DARK = colors.HexColor("#1E293B")        # Gris Oscuro Texto
C_MUTED = colors.HexColor("#64748B")       # Gris Secundario
C_BG_LIGHT = colors.HexColor("#F8FAFC")    # Fondo suave para tablas y cajas
C_BORDER = colors.HexColor("#CBD5E1")      # Bordes suaves
C_ALERT_BG = colors.HexColor("#FEF3C7")    # Fondo Alerta / Advertencia
C_ALERT_BORDER = colors.HexColor("#F59E0B")# Borde Alerta

class NumberedCanvas(canvas.Canvas):
    """
    Canvas de doble pasada para calcular el número total de páginas ('Página X de Y')
    y colocar encabezado y pie de página institucional ISO 9001 en todas las hojas.
    """
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        page_w, page_h = letter

        # Portada sin encabezado superior repetitivo
        if self._pageNumber > 1:
            # ENCABEZADO SUPERIOR
            self.setStrokeColor(C_BORDER)
            self.setLineWidth(0.75)
            self.line(40, page_h - 45, page_w - 40, page_h - 45)

            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(C_PRIMARY)
            self.drawString(40, page_h - 38, "CENTRO MÉDICO NUBE | SISTEMA DE GESTIÓN DE LA CALIDAD (ISO 9001:2015)")
            
            self.setFont("Helvetica", 7.5)
            self.setFillColor(C_MUTED)
            self.drawRightString(page_w - 40, page_h - 38, "SGC-POE-ADM-001 | REV. 2.0 | SEP 2026")

        # PIE DE PÁGINA (Todas las páginas)
        self.setStrokeColor(C_BORDER)
        self.setLineWidth(0.75)
        self.line(40, 45, page_w - 40, 45)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(C_MUTED)
        self.drawString(40, 32, "Documento Confidencial - Prohibida su reproducción sin autorización de Dirección Médica")

        page_str = f"Página {self._pageNumber} de {page_count}"
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(C_PRIMARY)
        self.drawRightString(page_w - 40, 32, page_str)

        self.restoreState()


def generar_pdf(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=55,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()

    # Definición de Estilos Tipográficos Jerárquicos
    title_cover_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=C_PRIMARY,
        alignment=1 # Centrado
    )

    subtitle_cover_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=C_SECONDARY,
        alignment=1
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=C_PRIMARY,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=C_SECONDARY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=C_DARK,
        alignment=4 # Justificado
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=C_DARK,
        leftIndent=14
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#78350F")
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=C_DARK
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=C_PRIMARY
    )

    story = []

    # =========================================================================
    # CARÁTULA FORMAL ISO 9001
    # =========================================================================
    logo_path = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "static", "branding", "logo_institucional.png")
    logo_path = os.path.abspath(logo_path)

    # Encabezado institucional superior con recuadro
    header_table_data = [
        [
            RLImage(logo_path, width=2.0*inch, height=0.6*inch) if os.path.exists(logo_path) else Paragraph("<b>CENTRO MÉDICO NUBE</b>", h1_style),
            Paragraph("<b>SISTEMA DE GESTIÓN DE LA CALIDAD (SGC)</b><br/><font size=7 color='#64748B'>NORMA IRAM - ISO 9001:2015</font>", ParagraphStyle('HCenter', fontName='Helvetica-Bold', fontSize=10, leading=13, alignment=1, textColor=C_PRIMARY)),
            Paragraph("<b>CÓDIGO:</b> SGC-POE-ADM-001<br/><b>VERSIÓN:</b> 2.0<br/><b>VIGENCIA:</b> 24 Meses", table_cell_bold)
        ]
    ]
    t_hdr = Table(header_table_data, colWidths=[2.2*inch, 3.2*inch, 2.0*inch])
    t_hdr.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, C_PRIMARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('BACKGROUND', (0,0), (-1,-1), colors.white)
    ]))
    story.append(t_hdr)
    story.append(Spacer(1, 25))

    story.append(Paragraph("MANUAL DE PROCEDIMIENTOS OPERATIVOS ESTANDARIZADOS", title_cover_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph("OPERACIÓN Y GESTIÓN ADMINISTRATIVA DEL CRM CLOUD & WHATSAPP INTELIGENTE", subtitle_cover_style))
    story.append(Spacer(1, 15))

    # Resumen formal de carátula
    meta_box_data = [
        [Paragraph("<b>PROCESO ASOCIADO:</b>", table_cell_bold), Paragraph("Admisión, Gestión de Citas, Atención Multicanal y Asesoría Quirúrgica", table_cell_style)],
        [Paragraph("<b>DIRIGIDO A:</b>", table_cell_bold), Paragraph("Secretaría Médica, Recepcionistas, Operadores de WhatsApp, Asesores Quirúrgicos y Facturación", table_cell_style)],
        [Paragraph("<b>ALCANCE DEL SISTEMA:</b>", table_cell_bold), Paragraph("Plataforma Web Cloud CRM, Agente IA Gemini, Integración Geclisa y Gateway WhatsApp", table_cell_style)],
        [Paragraph("<b>ESTADO DOCUMENTAL:</b>", table_cell_bold), Paragraph("<font color='#0D9488'><b>OFICIAL Y VIGENTE (HOMOLOGADO)</b></font>", table_cell_style)],
        [Paragraph("<b>FECHA DE ENTRADA EN VIGOR:</b>", table_cell_bold), Paragraph("23 de Septiembre de 2026", table_cell_style)],
    ]
    t_meta = Table(meta_box_data, colWidths=[2.2*inch, 5.2*inch])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, C_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 20))

    # Bloque de Firmas y Validación ISO 9001 (Cláusula 7.5)
    story.append(Paragraph("<b>CONTROL DE EMISIÓN, REVISIÓN Y APROBACIÓN (ISO 9001:2015)</b>", h2_style))
    story.append(Spacer(1, 4))
    firmas_data = [
        [
            Paragraph("<b>ELABORADO POR:</b>", table_header_style),
            Paragraph("<b>REVISADO POR:</b>", table_header_style),
            Paragraph("<b>APROBADO POR:</b>", table_header_style)
        ],
        [
            Paragraph("<b>Coordinación Administrativa</b><br/>Lic. Gestión Operativa<br/><br/><i>Firma Electrónica Válida</i>", table_cell_style),
            Paragraph("<b>Responsable de Calidad (SGC)</b><br/>Auditor Líder ISO 9001<br/><br/><i>Firma Electrónica Válida</i>", table_cell_style),
            Paragraph("<b>Dirección Médica y Gerencia</b><br/>Comité Ejecutivo Institucional<br/><br/><i>Firma Electrónica Válida</i>", table_cell_style)
        ],
        [
            Paragraph("Fecha: 23/09/2026", table_cell_bold),
            Paragraph("Fecha: 23/09/2026", table_cell_bold),
            Paragraph("Fecha: 23/09/2026", table_cell_bold)
        ]
    ]
    t_firmas = Table(firmas_data, colWidths=[2.46*inch, 2.46*inch, 2.46*inch])
    t_firmas.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('BOX', (0,0), (-1,-1), 1, C_PRIMARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_firmas)
    story.append(Spacer(1, 15))

    # Control de Cambios
    story.append(Paragraph("<b>HISTORIAL DE VERSIONES Y CONTROL DE CAMBIOS</b>", h2_style))
    cambios_data = [
        [Paragraph("<b>Rev.</b>", table_header_style), Paragraph("<b>Fecha</b>", table_header_style), Paragraph("<b>Descripción del Cambio / Modificación</b>", table_header_style), Paragraph("<b>Autor</b>", table_header_style)],
        [Paragraph("1.0", table_cell_bold), Paragraph("10/01/2026", table_cell_style), Paragraph("Emisión inicial para soporte de turnos en sistema legado.", table_cell_style), Paragraph("Coord. Adm.", table_cell_style)],
        [Paragraph("2.0", table_cell_bold), Paragraph("23/09/2026", table_cell_style), Paragraph("Rediseño integral para CRM en la Nube, Agente IA Gemini, Integración Geclisa, Pipeline Quirúrgico y Presupuestos Digitales.", table_cell_style), Paragraph("SGC / TI", table_cell_style)]
    ]
    t_cambios = Table(cambios_data, colWidths=[0.6*inch, 1.0*inch, 4.6*inch, 1.2*inch])
    t_cambios.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, C_SECONDARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_cambios)

    # Fin de Portada
    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 1: OBJETO Y ALCANCE
    # =========================================================================
    story.append(Paragraph("1. OBJETO Y CAMPO DE APLICACIÓN", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))
    story.append(Paragraph(
        "<b>1.1. Objeto:</b> Establecer y formalizar los lineamientos y procedimientos operativos estándar "
        "para el personal administrativo que opera la plataforma tecnológica <b>CRM Cloud Oftalmológico</b>, "
        "garantizando la uniformidad, trazabilidad, confidencialidad médica y excelencia en la experiencia del paciente, "
        "en estricta conformidad con los requisitos del Sistema de Gestión de la Calidad (ISO 9001:2015).", body_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>1.2. Alcance:</b> Este manual aplica a todo el personal de Secretaría Médica, Recepción Presencial, "
        "Operadores de WhatsApp/Canales Digitales, Asesores de Cirugía y Facturación/Presupuestos. "
        "Comprende el ciclo completo: desde la recepción de la primera consulta digital o presencial, "
        "la sincronización de agendas con Geclisa, la atención de chats asistida por Inteligencia Artificial, "
        "el seguimiento en el embudo comercial quirúrgico, hasta la emisión del presupuesto y control preoperatorio.", body_style))
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 2: REFERENCIAS NORMATIVAS Y POLÍTICAS DE SEGURIDAD
    # =========================================================================
    story.append(Paragraph("2. REFERENCIAS NORMATIVAS Y MARCO LEGAL", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))
    story.append(Paragraph("• <b>Norma Internacional ISO 9001:2015:</b> Cláusulas 4.4 (SGC y procesos), 5.3 (Roles y responsabilidades), 7.1.3 (Infraestructura), 7.5 (Información documentada), 8.2 (Requisitos del servicio), 8.5 (Provisión del servicio y trazabilidad), 8.7 (Salidas no conformes) y 9.1 (Seguimiento y medición).", bullet_style))
    story.append(Paragraph("• <b>Ley 25.326 de Protección de Datos Personales:</b> Deber de confidencialidad y secreto profesional sobre registros clínicos y de filiación de los pacientes.", bullet_style))
    story.append(Paragraph("• <b>Ley 26.529 de Derechos del Paciente en su Relación con los Profesionales e Instituciones de la Salud:</b> Custodia de la historia clínica y validez del consentimiento informado.", bullet_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("3. POLÍTICAS INSTITUCIONALES Y SEGURIDAD DE LA INFORMACIÓN", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))
    
    # Recuadro de Alerta de Calidad
    alerta_data = [[
        Paragraph("<b>POLÍTICAS DE SEGURIDAD Y CUMPLIMIENTO OBLIGATORIO:</b><br/>"
                  "1. <b>Credenciales Intransferibles:</b> Prohibido compartir usuarios y contraseñas. Cada acción queda grabada con fecha, hora y usuario en los registros de auditoría.<br/>"
                  "2. <b>Canal Oficial Exclusivo:</b> Toda interacción por WhatsApp debe realizarse a través de la consola del CRM. Prohibido usar celulares particulares.<br/>"
                  "3. <b>Bloqueo de Puesto:</b> Al ausentarse de la recepción o escritorio, debe bloquearse la pantalla para evitar accesos indebidos a datos de salud.<br/>"
                  "4. <b>Doble Verificación:</b> Verificar siempre Nombre, DNI, Cobertura Médica y Ojo a operar (OD/OI/AO) antes de emitir presupuestos o confirmar cirugías.", callout_style)
    ]]
    t_alert = Table(alerta_data, colWidths=[7.4*inch])
    t_alert.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_ALERT_BG),
        ('BOX', (0,0), (-1,-1), 1, C_ALERT_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_alert)
    story.append(Spacer(1, 12))

    # =========================================================================
    # SECCIÓN 4: MATRIZ DE RESPONSABILIDADES (RACI)
    # =========================================================================
    story.append(Paragraph("4. ROLES Y MATRIZ DE RESPONSABILIDADES (RACI)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))
    
    raci_data = [
        [Paragraph("<b>Actividad Operativa</b>", table_header_style), Paragraph("<b>Recepción</b>", table_header_style), Paragraph("<b>Op. WhatsApp</b>", table_header_style), Paragraph("<b>Asesor Qx</b>", table_header_style), Paragraph("<b>Facturación</b>", table_header_style), Paragraph("<b>Sup. / TI</b>", table_header_style)],
        [Paragraph("Inicio seguro y cierre de sesión", table_cell_bold), Paragraph("R / A", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("I", table_cell_style)],
        [Paragraph("Verificación de Agenda y Check-in (Dar Presente)", table_cell_bold), Paragraph("R / A", table_cell_style), Paragraph("C", table_cell_style), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style)],
        [Paragraph("Triage WhatsApp y Pausa de IA (Toggle Human)", table_cell_bold), Paragraph("I", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("C", table_cell_style), Paragraph("I", table_cell_style), Paragraph("C", table_cell_style)],
        [Paragraph("Gestión de Casos en Pipeline Quirúrgico", table_cell_bold), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style)],
        [Paragraph("Confección y Emisión de Presupuestos PDF", table_cell_bold), Paragraph("C", table_cell_style), Paragraph("C", table_cell_style), Paragraph("R", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("I", table_cell_style)],
        [Paragraph("Envío de Presupuesto por WhatsApp", table_cell_bold), Paragraph("I", table_cell_style), Paragraph("C", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("C", table_cell_style), Paragraph("I", table_cell_style)],
        [Paragraph("Control de Consentimientos Informados", table_cell_bold), Paragraph("R", table_cell_style), Paragraph("I", table_cell_style), Paragraph("R / A", table_cell_style), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style)],
        [Paragraph("Mantenimiento y Soporte de Gateway/Geclisa", table_cell_bold), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style), Paragraph("I", table_cell_style), Paragraph("R / A", table_cell_style)]
    ]
    t_raci = Table(raci_data, colWidths=[2.6*inch, 0.95*inch, 0.95*inch, 0.95*inch, 0.95*inch, 1.0*inch])
    t_raci.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('BOX', (0,0), (-1,-1), 1, C_PRIMARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ALIGN', (1,1), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_raci)
    story.append(Spacer(1, 4))
    story.append(Paragraph("<font size=7 color='#64748B'><i>Referencias: <b>R</b> = Responsable ejecutor | <b>A</b> = Aprobador final | <b>C</b> = Consultado | <b>I</b> = Informado</i></font>", body_style))

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 5: PROCEDIMIENTOS OPERATIVOS ESTANDARIZADOS (POE-01 A POE-07)
    # =========================================================================
    story.append(Paragraph("5. PROCEDIMIENTOS OPERATIVOS ESTANDARIZADOS (PASO A PASO)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))

    # --- POE 01 ---
    story.append(Paragraph("POE-01: AUTENTICACIÓN, ACCESO Y NAVEGACIÓN EN EL CRM", h2_style))
    story.append(Paragraph("<b>Objetivo:</b> Garantizar el acceso seguro y autorizado al entorno de gestión.", body_style))
    story.append(Paragraph("<b>1. Acceso:</b> Abrir Google Chrome o Edge y navegar a la URL institucional del CRM.", bullet_style))
    story.append(Paragraph("<b>2. Identificación:</b> Ingresar el correo corporativo y contraseña personal provista.", bullet_style))
    story.append(Paragraph("<b>3. Validación de Perfil:</b> Al cargar el sistema, verificar en la barra lateral el rol visible (Recepción, Asesoría, Admin). Los módulos habilitados responderán a dicho perfil.", bullet_style))
    story.append(Paragraph("<b>4. Cierre Seguro:</b> Al finalizar la jornada, presionar 'Cerrar Sesión' (ícono de puerta en la barra lateral). Nunca dejar la sesión abierta en terminales compartidas.", bullet_style))
    story.append(Spacer(1, 10))

    # --- POE 02 ---
    story.append(Paragraph("POE-02: GESTIÓN DE AGENDA GECLISA Y RECEPCIÓN DE PACIENTES (CHECK-IN)", h2_style))
    story.append(Paragraph("<b>Objetivo:</b> Registrar la llegada de los pacientes y notificar al consultorio médico en tiempo real.", body_style))
    story.append(Paragraph("<b>1. Apertura de Agenda:</b> En el menú lateral, seleccionar 'Agenda Geclisa' (ícono calendario).", bullet_style))
    story.append(Paragraph("<b>2. Filtros de Prestador:</b> Seleccionar la fecha del día y el profesional asignado en el desplegable.", bullet_style))
    story.append(Paragraph("<b>3. Búsqueda y Sincronización:</b> Si un turno recién otorgado en Geclisa de escritorio no aparece, presionar el botón <b>'Sincronizar Geclisa'</b> (flechas circulares). El sistema forzará la actualización vía API.", bullet_style))
    story.append(Paragraph("<b>4. Check-in (Dar Presente):</b> Al presentarse el paciente en mostrador con DNI y credencial, hacer clic en el botón verde <b>'Dar Presente'</b>. El estado cambiará a 'Presente' y el médico lo verá en su pantalla.", bullet_style))
    story.append(Paragraph("<b>5. Sala de Espera:</b> Indicar amablemente al paciente tomar asiento en la sala correspondiente.", bullet_style))
    story.append(Spacer(1, 10))

    # --- POE 03 ---
    story.append(Paragraph("POE-03: BANDEJA DE WHATSAPP Y GESTIÓN DEL ASISTENTE DE IA (GEMINI)", h2_style))
    story.append(Paragraph("<b>Objetivo:</b> Atender consultas digitales, supervisar la IA y gestionar derivaciones humanas.", body_style))
    story.append(Paragraph("<b>1. Bandeja de Entrada:</b> Ingresar a 'Chats / WhatsApp'. En el panel izquierdo se listan los mensajes.", bullet_style))
    story.append(Paragraph("<b>2. Triage e Íconos:</b> Robot verde = IA atendiendo. Silueta azul / Alerta naranja = Paciente requiere operador humano.", bullet_style))
    story.append(Paragraph("<b>3. Pausar el Bot (Toggle Human):</b> Para intervenir de forma manual, hacer clic en el interruptor superior <b>'Bot IA / Humano'</b> para ponerlo en 'Modo Humano'. Esto suspende las respuestas automáticas de Gemini en ese chat.", bullet_style))
    story.append(Paragraph("<b>4. Respuestas Rápidas y Plantillas Meta:</b> Utilizar el ícono de rayo para mensajes frecuentes prearmados. Si la conversación tiene más de 24 horas sin respuesta del paciente, presionar <b>'Plantillas Meta'</b> para usar una plantilla oficial homologada.", bullet_style))
    story.append(Paragraph("<b>5. Reactivación:</b> Una vez resuelta la consulta específica, si corresponde, volver a alternar a 'Bot IA Activo'.", bullet_style))
    story.append(Spacer(1, 10))

    # --- POE 04 ---
    story.append(Paragraph("POE-04: GESTIÓN DEL EMBUDO COMERCIAL QUIRÚRGICO (PIPELINE)", h2_style))
    story.append(Paragraph("<b>Objetivo:</b> Gestionar integralmente el ciclo del paciente quirúrgico (Lead-to-Surgery).", body_style))
    story.append(Paragraph("<b>1. Acceso al Pipeline:</b> Seleccionar 'Asesoramiento > Pipeline' para ver el tablero Kanban.", bullet_style))
    story.append(Paragraph("<b>2. Las 5 Columnas Activas:</b>", bullet_style))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;• <b>1. Derivados:</b> Pacientes recién indicados para cirugía desde el consultorio médico.<br/>"
                           "&nbsp;&nbsp;&nbsp;&nbsp;• <b>2. En Asesoramiento:</b> En contacto inicial, asesoría explicativa y dudas resueltas.<br/>"
                           "&nbsp;&nbsp;&nbsp;&nbsp;• <b>3. En Análisis:</b> Paciente con presupuesto entregado, evaluando financiamiento o cobertura.<br/>"
                           "&nbsp;&nbsp;&nbsp;&nbsp;• <b>4. Confirmados:</b> Paciente que aceptó la cirugía (pendiente de reserva de quirófano/seña).<br/>"
                           "&nbsp;&nbsp;&nbsp;&nbsp;• <b>5. Programados Qx:</b> Cirugía con fecha, sala y equipo médico asignado.", body_style))
    story.append(Paragraph("<b>3. Mover Etapas:</b> Arrastrar la tarjeta del paciente a la columna subsiguiente según avance su gestión.", bullet_style))
    story.append(Paragraph("<b>4. Semáforo de SLA (Días sin Contacto):</b> Tarjetas en ámbar o rojo indican casos demorados que exigen llamado de contacto prioritario.", bullet_style))
    story.append(Paragraph("<b>5. Cierre de Casos:</b> Si el paciente desiste, usar el botón de cerrar caso registrando obligatoriamente el motivo formal (Económico, Falta de Cobertura, Prefiere esperar) para estadísticas de calidad.", bullet_style))
    story.append(Spacer(1, 10))

    story.append(PageBreak())

    # --- POE 05 ---
    story.append(Paragraph("POE-05: EMISIÓN, CONTROL Y ENVÍO DE PRESUPUESTOS MÉDICOS", h2_style))
    story.append(Paragraph("<b>Objetivo:</b> Cotizar prácticas médicas y emitir propuestas comerciales en PDF formal.", body_style))
    story.append(Paragraph("<b>1. Acceso al Cotizador:</b> Menú 'Presupuestos' > Pestaña 'Crear Presupuesto'.", bullet_style))
    story.append(Paragraph("<b>2. Paciente:</b> Buscar al paciente en la base de datos o crearlo completando nombre, teléfono y obra social.", bullet_style))
    story.append(Paragraph("<b>3. Configuración Médica:</b> Seleccionar lateralidad (OD, OI o Ambos Ojos), práctica prescripta y modelo de LIO Alcon si es catarata.", bullet_style))
    story.append(Paragraph("<b>4. Generación de PDF:</b> Verificar valores en ARS/USD y hacer clic en <b>'Generar Presupuesto Formal'</b>. El sistema genera el PDF numerado con membrete y código de barras/QR institucional.", bullet_style))
    story.append(Paragraph("<b>5. Envío por WhatsApp:</b> Presionar 'Enviar por WhatsApp' para remitir el enlace oficial de descarga del PDF directamente al número celular del paciente.", bullet_style))
    story.append(Spacer(1, 10))

    # --- POE 06 ---
    story.append(Paragraph("POE-06: EXPEDIENTES DE PACIENTES Y CONSENTIMIENTO INFORMADO DIGITAL", h2_style))
    story.append(Paragraph("<b>Objetivo:</b> Respaldar la documentación legal y validar consentimientos prequirúrgicos.", body_style))
    story.append(Paragraph("<b>1. Módulo Pacientes:</b> Buscar al paciente por DNI o Apellido para abrir su legajo.", bullet_style))
    story.append(Paragraph("<b>2. Consentimiento Digital:</b> En el legajo quirúrgico, hacer clic en <b>'Generar Consentimiento'</b> y despachar el enlace seguro por WhatsApp.", bullet_style))
    story.append(Paragraph("<b>3. Firma en el Celular:</b> El paciente lee el documento en su teléfono y firma en pantalla.", bullet_style))
    story.append(Paragraph("<b>4. Validación Obligatoria:</b> El CRM actualiza el estado a 'Firmado y Verificado' con fecha, hora, hash de seguridad e IP. Ningún paciente ingresa a quirófano sin consentimiento verificado.", bullet_style))
    story.append(Spacer(1, 10))

    # --- POE 07 ---
    story.append(Paragraph("POE-07: SEGUIMIENTO DE QUIRÓFANO Y PARTE A FAMILIARES", h2_style))
    story.append(Paragraph("<b>Objetivo:</b> Monitorear el progreso quirúrgico y brindar información precisa en sala de espera.", body_style))
    story.append(Paragraph("<b>1. Pizarra en Vivo:</b> Acceder a 'Quirófano > Pizarra en Vivo' (/quirofano-en-vivo).", bullet_style))
    story.append(Paragraph("<b>2. Estados Operativos:</b> Verificar la tarjeta del paciente: <i>En Espera / Dilatación ➔ En Quirófano ➔ En Recuperación ➔ Alta Otorgada</i>.", bullet_style))
    story.append(Paragraph("<b>3. Comunicación al Acompañante:</b> Brindar información cálida y oportuna basada exclusivamente en el estado exhibido en la pizarra. Dejar las precisiones técnicas médicas al cirujano.", bullet_style))
    story.append(Spacer(1, 12))

    # =========================================================================
    # SECCIÓN 6: MATRIZ DE RIESGOS Y SALIDAS NO CONFORMES
    # =========================================================================
    story.append(Paragraph("6. GESTIÓN DE RIESGOS Y SALIDAS NO CONFORMES (ISO 9001 - Cláusula 6.1 y 8.7)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))

    riesgos_data = [
        [Paragraph("<b>Riesgo / Desvío Operativo</b>", table_header_style), Paragraph("<b>Severidad</b>", table_header_style), Paragraph("<b>Protocolo de Contingencia Operativa</b>", table_header_style), Paragraph("<b>Responsable</b>", table_header_style)],
        [
            Paragraph("<b>Desvinculación WhatsApp</b><br/>Sesión QR cerrada en el servidor.", table_cell_bold),
            Paragraph("<font color='red'><b>Alta</b></font>", table_cell_style),
            Paragraph("Avisar de inmediato a Soporte TI. El personal continuará la atención de turnos y agendas normalmente por Geclisa mientras se re-escanea el QR.", table_cell_style),
            Paragraph("Op. WhatsApp / TI", table_cell_style)
        ],
        [
            Paragraph("<b>Falla Sincronización Geclisa</b><br/>Microcorte de red en servidor local.", table_cell_bold),
            Paragraph("<font color='orange'><b>Media</b></font>", table_cell_style),
            Paragraph("Utilizar Geclisa de escritorio como respaldo inmediato para recepcionar. Al restablecerse la red, presionar 'Sincronizar Geclisa' en el CRM.", table_cell_style),
            Paragraph("Recepción / TI", table_cell_style)
        ],
        [
            Paragraph("<b>Respuesta Ambigua de la IA</b><br/>El bot responde algo impreciso.", table_cell_bold),
            Paragraph("<font color='orange'><b>Media</b></font>", table_cell_style),
            Paragraph("Pausar el bot de inmediato con el interruptor 'Modo Humano'. Enviar mensaje aclaratorio y asentar desvío para ajuste del prompt de IA.", table_cell_style),
            Paragraph("Op. WhatsApp", table_cell_style)
        ],
        [
            Paragraph("<b>Error en Presupuesto Emitido</b><br/>Monto o lente LIO mal cotizado.", table_cell_bold),
            Paragraph("<font color='red'><b>Alta</b></font>", table_cell_style),
            Paragraph("Si no fue enviado, generar uno nuevo. Si ya se envió, llamar al paciente explicando la rectificación formal y anular el presupuesto previo en CRM.", table_cell_style),
            Paragraph("Asesor Qx / Fact.", table_cell_style)
        ]
    ]
    t_riesgos = Table(riesgos_data, colWidths=[1.8*inch, 0.9*inch, 3.6*inch, 1.1*inch])
    t_riesgos.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('BOX', (0,0), (-1,-1), 1, C_PRIMARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_riesgos)

    story.append(PageBreak())

    # =========================================================================
    # SECCIÓN 7: INDICADORES (KPI) Y REGISTROS DE CALIDAD
    # =========================================================================
    story.append(Paragraph("7. INDICADORES DE CALIDAD (KPI) Y REGISTROS ASOCIADOS (ISO 9001)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))

    kpi_data = [
        [Paragraph("<b>Indicador de Desempeño (KPI)</b>", table_header_style), Paragraph("<b>Meta Calidad</b>", table_header_style), Paragraph("<b>Fórmula de Medición</b>", table_header_style), Paragraph("<b>Frecuencia</b>", table_header_style)],
        [Paragraph("<b>Tiempo Medio de Respuesta (TMR)</b>", table_cell_bold), Paragraph("≤ 15 minutos", table_cell_style), Paragraph("Minutos transcurridos desde derivación a respuesta humana", table_cell_style), Paragraph("Semanal", table_cell_style)],
        [Paragraph("<b>Tasa de Asistencia a Turnos (No-Show)</b>", table_cell_bold), Paragraph("≥ 85 %", table_cell_style), Paragraph("(Turnos con Check-in / Total Turnos Agendados) x 100", table_cell_style), Paragraph("Mensual", table_cell_style)],
        [Paragraph("<b>Conversión Presupuestos Quirúrgicos</b>", table_cell_bold), Paragraph("≥ 60 %", table_cell_style), Paragraph("(Casos en Etapa Confirmada o Programada / Total Casos) x 100", table_cell_style), Paragraph("Mensual", table_cell_style)],
        [Paragraph("<b>Consentimientos Digitales Verificados</b>", table_cell_bold), Paragraph("100 % (Mandatorio)", table_cell_style), Paragraph("(Cirugías con Consentimiento Firmado / Cirugías Hechas) x 100", table_cell_style), Paragraph("Continuo", table_cell_style)]
    ]
    t_kpi = Table(kpi_data, colWidths=[2.2*inch, 1.3*inch, 2.7*inch, 1.2*inch])
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, C_SECONDARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 14))

    story.append(Paragraph("8. REGISTROS DE LA CALIDAD ASOCIADOS (ISO 9001 - Cláusula 7.5.3)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceBefore=2, spaceAfter=8))

    reg_data = [
        [Paragraph("<b>Código Registro</b>", table_header_style), Paragraph("<b>Nombre del Registro</b>", table_header_style), Paragraph("<b>Medio de Archivo</b>", table_header_style), Paragraph("<b>Tiempo Retención</b>", table_header_style)],
        [Paragraph("REG-ADM-01", table_cell_bold), Paragraph("Historial de Chats y Mensajería WhatsApp", table_cell_style), Paragraph("Base de Datos Cloud (Supabase)", table_cell_style), Paragraph("24 Meses", table_cell_style)],
        [Paragraph("REG-ADM-02", table_cell_bold), Paragraph("Registro de Turnos y Presentismo (Check-in)", table_cell_style), Paragraph("Base de Datos Geclisa y CRM", table_cell_style), Paragraph("Conforme ley HC", table_cell_style)],
        [Paragraph("REG-ADM-03", table_cell_bold), Paragraph("Presupuestos Médicos Formales Emitidos", table_cell_style), Paragraph("PDF Digital en Servidor Seguro", table_cell_style), Paragraph("5 Años", table_cell_style)],
        [Paragraph("REG-ADM-04", table_cell_bold), Paragraph("Consentimientos Informados Digitales Firmados", table_cell_style), Paragraph("Tabla Criptográfica con Token e IP", table_cell_style), Paragraph("10 Años (Ley HC)", table_cell_style)],
        [Paragraph("REG-ADM-05", table_cell_bold), Paragraph("Pistas de Auditoría y Logs de Acceso", table_cell_style), Paragraph("Módulo Logs & Auditoría del CRM", table_cell_style), Paragraph("12 Meses", table_cell_style)]
    ]
    t_reg = Table(reg_data, colWidths=[1.3*inch, 2.5*inch, 2.3*inch, 1.3*inch])
    t_reg.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('BOX', (0,0), (-1,-1), 1, C_PRIMARY),
        ('INNERGRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_reg)
    story.append(Spacer(1, 25))

    # Cierre de Declaración de Calidad
    cierre_box = [[
        Paragraph("<b>COMPROMISO DE CALIDAD Y DECLARACIÓN DEL PERSONAL:</b><br/>"
                  "El presente manual constituye un documento oficial controlado. Todo colaborador del área administrativa "
                  "debe desempeñar sus labores aplicando estrictamente las instrucciones de trabajo aquí contenidas. "
                  "Cualquier oportunidad de mejora, desvío o propuesta de optimización debe ser canalizada al Responsable de Calidad "
                  "para su tratamiento formal en el Comité de Gestión de Calidad.", callout_style)
    ]]
    t_cierre = Table(cierre_box, colWidths=[7.4*inch])
    t_cierre.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, C_PRIMARY),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_cierre)

    # Construir documento PDF con NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generado con éxito en: {output_path}")

if __name__ == "__main__":
    out_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "MANUAL_PROCEDIMIENTOS_ADMINISTRATIVO_ISO9001.pdf"))
    generar_pdf(out_file)
