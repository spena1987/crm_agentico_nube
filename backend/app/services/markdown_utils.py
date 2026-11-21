import re
from typing import Any, Dict, List, Optional
from reportlab.lib import colors
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle


def _escape_xml(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_indicaciones_vars_dict(datos: Dict[str, Any]) -> Dict[str, str]:
    """Construye el diccionario canonico de variables clinicas para PDF, Geclisa y vistas previas."""
    pac_nom = str(datos.get("paciente_nombre") or datos.get("paciente") or "Paciente").strip()
    pac_dni = str(datos.get("paciente_dni") or datos.get("dni") or "-").strip()
    pac_os = str(datos.get("paciente_obra_social") or datos.get("obra_social") or "-").strip()
    pac_plan = str(datos.get("paciente_plan") or datos.get("plan") or "").strip()
    pac_afi = str(datos.get("paciente_afiliado") or datos.get("afiliado") or "-").strip()
    pac_dom = str(datos.get("paciente_domicilio") or datos.get("domicilio") or "-").strip()
    med_nom = str(datos.get("medico_nombre") or datos.get("cirujano") or "Médico Cirujano").strip()
    med_mat = str(datos.get("medico_matricula") or datos.get("matricula") or "-").strip()
    med_esp = str(datos.get("medico_especialidad") or datos.get("especialidad") or "Especialista en Oftalmología").strip()
    practica = str(datos.get("practica_nombre") or datos.get("practica") or "Cirugía Oftalmológica").strip()
    ojo = str(datos.get("ojo_intervenido") or datos.get("ojo") or "").strip()
    fecha = str(datos.get("fecha") or "").strip()
    hora = str(datos.get("hora") or "").strip()
    cobertura = f"{pac_os} ({pac_plan})" if pac_plan and pac_plan != "-" else pac_os

    return {
        "paciente": pac_nom,
        "dni": pac_dni,
        "obra_social": pac_os,
        "cobertura": cobertura,
        "plan": pac_plan,
        "afiliado": pac_afi,
        "domicilio": pac_dom,
        "cirujano": med_nom,
        "medico": med_nom,
        "matricula": med_mat,
        "especialidad": med_esp,
        "practica": practica,
        "ojo_intervenido": ojo,
        "ojo": ojo,
        "fecha": fecha,
        "hora": hora,
    }


def render_texto_variables(texto: str, variables: Dict[str, Any]) -> str:
    """Reemplaza variables con llave simple {key} o doble {{key}} (insensible a mayusculas y espacios)."""
    if not texto or not variables:
        return texto or ""
    resultado = str(texto)
    for key, val in variables.items():
        pattern = re.compile(r"\{\{?\s*" + re.escape(str(key)) + r"\s*\}?\}", re.IGNORECASE)
        resultado = pattern.sub(lambda _m, v=str(val or ""): v, resultado)
    return resultado


def format_inline_markdown(text: str, vars_dict: Optional[Dict[str, Any]] = None) -> str:
    """
    Convierte sintaxis Markdown inline (**negrita**, *cursiva*) a etiquetas XML de ReportLab (<b>, <i>).
    Protege los valores interpolados de vars_dict frente al parser Markdown y escapa &, <, > para XML seguro.
    """
    if not text:
        return ""

    s = str(text)
    tokens: Dict[str, str] = {}

    if vars_dict:
        for idx, (key, val) in enumerate(vars_dict.items()):
            pattern = re.compile(r"\{\{?\s*" + re.escape(str(key)) + r"\s*\}?\}", re.IGNORECASE)
            if pattern.search(s):
                token = f"@@VARTOKEN{idx}@@"
                tokens[token] = _escape_xml(str(val or ""))
                s = pattern.sub(token, s)

    s = _escape_xml(s)

    # Negrita **texto** o __texto__
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\w)__(.+?)__(?!\w)", r"<b>\1</b>", s)

    # Cursiva *texto* o _texto_ (con limite de palabra en _ para no romper identificadores como ojo_derecho)
    s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", s)
    s = re.sub(r"(?<!\w)_(?!_)(.+?)(?<!_)_(?!\w)", r"<i>\1</i>", s)

    for token, escaped_val in tokens.items():
        s = s.replace(token, escaped_val)

    return s


def parse_markdown_to_pdf_flowables(
    markdown_text: str,
    custom_styles: Dict[str, Any],
    content_width: float = 527.0,
    vars_dict: Optional[Dict[str, Any]] = None
) -> List[Any]:
    """
    Convierte texto Markdown a Flowables de ReportLab respetando content_width dinamico:
    - # H1, ## H2, ### H3
    - > Citas / Alertas destacadas
    - - o * Listas con vinetas
    - 1. Listas numeradas
    - --- / *** / ___ Separadores horizontales
    - Parrafos estandar con negrita/cursiva inline
    """
    if not markdown_text:
        return []

    flowables: List[Any] = []
    lines = str(markdown_text).replace("\r\n", "\n").split("\n")

    style_cuerpo = custom_styles.get("cuerpo")
    style_h1 = custom_styles.get("h1") or style_cuerpo
    style_h2 = custom_styles.get("h2") or style_cuerpo
    style_h3 = custom_styles.get("h3") or style_cuerpo
    style_bullet = custom_styles.get("bullet") or style_cuerpo
    style_quote = custom_styles.get("quote") or style_cuerpo

    safe_width = max(120.0, float(content_width))

    i = 0
    while i < len(lines):
        raw_line = lines[i]
        line = raw_line.strip()

        if not line:
            flowables.append(Spacer(1, 3))
            i += 1
            continue

        # 1. Separador horizontal ---, *** o ___
        if line in ("---", "***", "___"):
            t_hr = Table([[""]], colWidths=[safe_width], rowHeights=[1])
            t_hr.setStyle(TableStyle([
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            flowables.append(Spacer(1, 3))
            flowables.append(t_hr)
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        # 2. Encabezados H1, H2, H3
        if line.startswith("# "):
            content = format_inline_markdown(line[2:].strip(), vars_dict=vars_dict)
            flowables.append(Spacer(1, 4))
            flowables.append(Paragraph(content, style_h1))
            flowables.append(Spacer(1, 2))
            i += 1
            continue

        if line.startswith("## "):
            content = format_inline_markdown(line[3:].strip(), vars_dict=vars_dict)
            flowables.append(Spacer(1, 4))
            flowables.append(Paragraph(content, style_h2))
            flowables.append(Spacer(1, 2))
            i += 1
            continue

        if line.startswith("### "):
            content = format_inline_markdown(line[4:].strip(), vars_dict=vars_dict)
            flowables.append(Spacer(1, 3))
            flowables.append(Paragraph(content, style_h3))
            flowables.append(Spacer(1, 1))
            i += 1
            continue

        # 3. Citas / Alertas (> texto)
        if line.startswith(">"):
            quote_lines: List[str] = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                q_txt = lines[i].strip()[1:].strip()
                if q_txt:
                    quote_lines.append(format_inline_markdown(q_txt, vars_dict=vars_dict))
                i += 1
            if quote_lines:
                quote_html = "<br/>".join(quote_lines)
                t_quote = Table([[Paragraph(quote_html, style_quote)]], colWidths=[safe_width])
                t_quote.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF9C3")),
                    ("LINEBEFORE", (0, 0), (0, -1), 3.0, colors.HexColor("#D97706")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                flowables.append(Spacer(1, 3))
                flowables.append(t_quote)
                flowables.append(Spacer(1, 4))
            continue

        # 4. Listas con vinetas (- item o * item)
        if re.match(r"^[-*•]\s+", line):
            item_txt = re.sub(r"^[-*•]\s+", "", line)
            content = format_inline_markdown(item_txt, vars_dict=vars_dict)
            flowables.append(Paragraph(f"&bull;&nbsp;&nbsp;{content}", style_bullet))
            i += 1
            continue

        # 5. Listas numeradas o incisos (1. item o a) item)
        num_match = re.match(r"^(\d+\.|\w\))\s+(.*)$", line)
        if num_match:
            num_prefix, item_txt = num_match.group(1), num_match.group(2)
            content = format_inline_markdown(item_txt, vars_dict=vars_dict)
            flowables.append(Paragraph(f"<b>{num_prefix}</b> {content}", style_bullet))
            i += 1
            continue

        # 6. Parrafo estandar
        content = format_inline_markdown(line, vars_dict=vars_dict)
        flowables.append(Paragraph(content, style_cuerpo))
        i += 1

    return flowables


def markdown_to_plain_text(markdown_text: str, vars_dict: Optional[Dict[str, Any]] = None) -> str:
    """
    Convierte Markdown (y resuelve variables opcionalmente) a texto plano limpio para sistemas
    externos como Geclisa (sin simbolos #, **, *, >).
    """
    if not markdown_text:
        return ""

    text = str(markdown_text).replace("\r\n", "\n")
    if vars_dict:
        text = render_texto_variables(text, vars_dict)

    out_lines: List[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            out_lines.append("")
            continue
        if line in ("---", "***", "___"):
            out_lines.append("----------------")
            continue

        # Quitar encabezados (#, ##, ###) y citas (> )
        line = re.sub(r"^#{1,6}\s+", "", line)
        line = re.sub(r"^>\s*", "", line)

        # Normalizar vinetas (- o *) a •
        if re.match(r"^[-*]\s+", line):
            line = "• " + re.sub(r"^[-*]\s+", "", line)

        # Quitar negrita y cursiva inline conservando el texto
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        line = re.sub(r"(?<!\w)__(.+?)__(?!\w)", r"\1", line)
        line = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", line)
        line = re.sub(r"(?<!\w)_(?!_)(.+?)(?<!_)_(?!\w)", r"\1", line)

        out_lines.append(line)

    # Colapsar mas de 2 saltos consecutivos
    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(out_lines)).strip()
    return cleaned
