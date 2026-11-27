"""
Normalizador de números telefónicos al estándar E.164 de Meta WhatsApp Cloud API.
Especializado en la numeración de Argentina (+54 9, supresión de 0 y 15) y soporte global.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger("phone_normalizer")


def clean_phone_digits(raw_phone: str) -> str:
    """
    Elimina cualquier caracter que no sea dígito numérico,
    descartando espacios, guiones, paréntesis, puntos, signos +, sufijos @s.whatsapp.net, etc.
    """
    if not raw_phone:
        return ""
    raw_str = str(raw_phone).strip()
    if "@" in raw_str:
        raw_str = raw_str.split("@")[0]
    return re.sub(r"\D", "", raw_str)


def normalize_to_meta_e164(raw_phone: str, default_area_code: str = "11") -> str:
    """
    Normaliza cualquier número telefónico al formato E.164 estricto exigido por Meta Cloud API.
    Para Argentina (+54):
      - Inyecta el prefijo de país 54.
      - Asegura el dígito móvil '9'.
      - Elimina el '0' de acceso interurbano.
      - Elimina el prefijo '15' de telefonía móvil.
      - Garantiza longitud estándar de 13 dígitos: 549 + área (2 a 4 dig) + abonado (6 a 8 dig).
    
    Ejemplos de Argentina:
      '+54 9 11 1234-5678' -> '5491112345678'
      '011 15-1234-5678'   -> '5491112345678'
      '11 1234 5678'       -> '5491112345678'
      '54 11 1234 5678'    -> '5491112345678'
      '0351 15 444-5555'   -> '5493514445555'
      '0223 15-555-1234'   -> '5492235551234'
      '1234-5678'          -> '5491112345678' (usa default_area_code 11)

    Internacionales:
      '+1 (305) 555-0199'  -> '13055550199'
      '+34 612 34 56 78'   -> '34612345678'
      '+56 9 1234 5678'    -> '56912345678'
      '+598 99 123 456'    -> '59899123456'
    """
    if not raw_phone:
        return ""

    raw_str = str(raw_phone).strip()
    has_explicit_plus = raw_str.startswith("+")
    digits = clean_phone_digits(raw_str)

    if not digits:
        return ""

    # 1. Internacionales explícitos con '+' que NO son Argentina (54)
    if has_explicit_plus and not digits.startswith("54"):
        return digits

    # 2. Sin '+' pero con prefijos internacionales conocidos
    if not digits.startswith("54") and not digits.startswith("0"):
        # Chile (56, 11 dig), Uruguay (598, 11 dig), Brasil (55, 12-13 dig), España (34, 11 dig), USA/Canadá (1, 11 dig)
        if (digits.startswith("56") and len(digits) == 11) or \
           (digits.startswith("598") and len(digits) == 11) or \
           (digits.startswith("55") and len(digits) in (12, 13)) or \
           (digits.startswith("34") and len(digits) == 11) or \
           (digits.startswith("1") and len(digits) == 11):
            return digits

    # 3. PROCESAMIENTO DE ARGENTINA

    # Caso 3.1: Comienza con 549
    if digits.startswith("549"):
        resto = digits[3:]
        if resto.startswith("0"):
            resto = resto[1:]
        resto = _remover_15_argentina(resto)
        if len(resto) == 8:
            resto = f"{default_area_code}{resto}"
        return f"549{resto}"

    # Caso 3.2: Comienza con 54 (pero sin el 9 de telefonía móvil)
    if digits.startswith("54"):
        resto = digits[2:]
        if resto.startswith("0"):
            resto = resto[1:]
        resto = _remover_15_argentina(resto)
        if len(resto) == 8:
            resto = f"{default_area_code}{resto}"
        return f"549{resto}"

    # Caso 3.3: Comienza con 0 interurbano (ej: 011..., 0351..., 0223...)
    if digits.startswith("0"):
        sin_cero = digits[1:]
        sin_15 = _remover_15_argentina(sin_cero)
        return f"549{sin_15}"

    # Caso 3.4: Comienza con 15 directo (ej: 1512345678 -> 1112345678)
    if digits.startswith("15") and len(digits) == 10:
        sin_15 = digits[2:]
        return f"549{default_area_code}{sin_15}"

    # Caso 3.5: Número de 10 dígitos (ej: 1112345678, 3514445555)
    if len(digits) == 10:
        sin_15 = _remover_15_argentina(digits)
        return f"549{sin_15}"

    # Caso 3.6: Número local de 8 dígitos (ej: 12345678)
    if len(digits) == 8:
        return f"549{default_area_code}{digits}"

    # Fallback si no encaja: si empieza con 54 asegurar 549, si no devolver los dígitos
    if digits.startswith("54") and not digits.startswith("549"):
        return f"549{digits[2:]}"

    return digits


def _remover_15_argentina(numero: str) -> str:
    """
    Remueve el prefijo móvil '15' si aparece inmediatamente después de los códigos de área argentinos.
    """
    codigos_area_comunes = (
        "11",   # AMBA
        "351",  # Córdoba
        "341",  # Rosario
        "221",  # La Plata
        "223",  # Mar del Plata
        "261",  # Mendoza
        "260",  # San Rafael (Mendoza)
        "263",  # Zona Este (Mendoza)
        "2622", # Valle de Uco (Mendoza)
        "2625", # General Alvear (Mendoza)
        "381",  # Tucumán
        "299",  # Neuquén
        "387",  # Salta
        "342",  # Santa Fe
        "379",  # Corrientes
        "264",  # San Juan
        "266",  # San Luis
        "376",  # Posadas
        "343",  # Paraná
        "291",  # Bahía Blanca
        "388",  # Jujuy
        "383",  # Catamarca
        "380",  # La Rioja
        "370",  # Formosa
        "362",  # Resistencia
        "280",  # Trelew
        "297",  # Comodoro Rivadavia
        "2966", # Río Gallegos
        "2901", # Ushuaia
        "2954", # Santa Rosa
        "236",  # Junín
        "249",  # Tandil
    )

    for area in codigos_area_comunes:
        if numero.startswith(area):
            resto = numero[len(area):]
            if resto.startswith("15"):
                return f"{area}{resto[2:]}"
            return numero

    # Si empieza con 15 al inicio de un bloque no identificado
    if numero.startswith("15") and len(numero) > 8:
        return numero[2:]

    return numero


def normalizar_telefono_argentina_movil(
    raw_phone: Optional[str],
    celular_preferido: Optional[str] = None,
    default_area_code: str = "261",
) -> tuple[Optional[str], Optional[str]]:
    """
    Normaliza números telefónicos argentinos al formato móvil Meta E.164 sin '+' (549<area><num>).
    Prioriza `celular_preferido`, divide cadenas con múltiples teléfonos, elimina '0' y '15'
    y descarta líneas fijas (por ejemplo, 7 dígitos locales que inician con 42/43).
    Retorna (telefono_sin_mas, motivo_error).
    """
    candidatos_raw: list[str] = []
    for fuente in (celular_preferido, raw_phone):
        if not fuente:
            continue
        texto = str(fuente).strip()
        if not texto:
            continue
        partes = re.split(r"[/;,|]|\s+-\s+|\s+o\s+|\s+y\s+", texto, flags=re.IGNORECASE)
        for p in partes:
            p_clean = p.strip()
            if p_clean:
                candidatos_raw.append(p_clean)

    if not candidatos_raw:
        return None, "Sin teléfono cargado"

    ultimo_motivo = "Número inválido o fijo"
    for cand in candidatos_raw:
        digits = clean_phone_digits(cand)
        if not digits:
            continue

        # Descartar línea fija local de 7 dígitos (ej. 4212345 / 4312345) o 10 dígitos sin móvil (26142xxxxx / 26143xxxxx)
        if len(digits) == 7 and digits.startswith(("42", "43")):
            ultimo_motivo = "Teléfono fijo local"
            continue
        if len(digits) == 10 and digits.startswith(("26142", "26143", "26044", "26344")):
            ultimo_motivo = "Teléfono fijo regional"
            continue

        # Caso 7 dígitos locales móviles (sin área ni 15): inyectar área por defecto
        if len(digits) == 7:
            return f"549{default_area_code}{digits}", None

        # Caso 9 dígitos con 15 local (ej. 154123456 -> 5492614123456)
        if len(digits) == 9 and digits.startswith("15"):
            return f"549{default_area_code}{digits[2:]}", None

        # Caso <area>15<numero> sin 0 inicial (ej. "261 15 4123456" -> 12 dígitos)
        digits_cand = clean_phone_digits(cand)
        if not digits_cand.startswith(("54", "0")) and len(digits_cand) in (11, 12):
            sin_15 = _remover_15_argentina(digits_cand)
            if sin_15 != digits_cand and len(sin_15) == 10:
                cand = sin_15

        # Caso 10 dígitos con 0 + 15 local? Ej 0261154123456 es 13 dígitos -> pasa por normalize_to_meta_e164
        normalizado = normalize_to_meta_e164(cand, default_area_code=default_area_code)
        if not normalizado:
            continue

        # Verificar fijo camuflado tras normalización (ej. 54926142xxxxx)
        if len(normalizado) == 13 and normalizado.startswith("549261") and normalizado[6:8] in ("42", "43"):
            ultimo_motivo = "Teléfono fijo (26142/26143)"
            continue

        if len(normalizado) >= 12 and len(normalizado) <= 15:
            return normalizado, None

        ultimo_motivo = "Longitud telefónica inválida"

    return None, ultimo_motivo
