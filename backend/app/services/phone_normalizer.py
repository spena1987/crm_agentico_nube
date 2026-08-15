import re
import logging
from typing import Optional

try:
    from neonize.utils.jid import build_jid
    from neonize.proto.Neonize_pb2 import JID
    NEONIZE_AVAILABLE = True
except ImportError:
    NEONIZE_AVAILABLE = False
    JID = None

logger = logging.getLogger(__name__)

def clean_phone_digits(raw_phone: str) -> str:
    """
    Elimina cualquier caracter que no sea dígito numérico,
    descartando espacios, guiones, paréntesis, puntos, signos +, etc.
    """
    if not raw_phone:
        return ""
    
    raw_str = str(raw_phone).strip()
    
    # Si viene con formato JID (ej: 54911...@s.whatsapp.net), tomamos solo la parte antes del @
    if "@" in raw_str:
        raw_str = raw_str.split("@")[0]
        
    # Eliminar todos los caracteres no numéricos
    digits_only = re.sub(r"\D", "", raw_str)
    return digits_only

def normalize_phone_number(raw_phone: str, default_area_code: str = "11") -> str:
    """
    Normaliza un número de teléfono para su uso estándar en WhatsApp y CRM.
    
    Reglas para Argentina:
    - WhatsApp requiere: 549 + Código de Área (sin 0) + Número Local (sin 15).
    - Longitud total estándar: 13 dígitos (549 + 10 dígitos).
    
    Ejemplos de transformación:
    - '+54 9 11 1234-5678' -> '5491112345678'
    - '011 15-1234-5678'   -> '5491112345678'
    - '11 1234 5678'       -> '5491112345678'
    - '54 11 1234 5678'    -> '5491112345678'
    - '0351 15 444-5555'   -> '5493514445555'
    - '0223 15-555-1234'   -> '5492235551234'
    - '1234-5678' (8 dig)  -> '5491112345678' (asume default_area_code 11)
    
    Para números internacionales explícitos (ej: +1, +34, +56, +598):
    - Se preserva el código de país sin inyectar 549.
    """
    if not raw_phone:
        return ""

    raw_str = str(raw_phone).strip()
    has_explicit_plus = raw_str.startswith("+")
    digits = clean_phone_digits(raw_str)

    if not digits:
        return ""

    # 1. Si es un número internacional explícito que NO comienza con 54 (Argentina)
    # Por ejemplo: +1 (USA/Canadá), +34 (España), +56 (Chile), +598 (Uruguay), +55 (Brasil), etc.
    if has_explicit_plus and not digits.startswith("54"):
        return digits

    # Si no tenía '+' pero empieza con prefijos de países vecinos conocidos (y longitud coherente)
    if not digits.startswith("54") and not digits.startswith("0"):
        if (digits.startswith("56") and len(digits) == 11) or \
           (digits.startswith("598") and len(digits) == 11) or \
           (digits.startswith("55") and len(digits) in (12, 13)) or \
           (digits.startswith("34") and len(digits) == 11) or \
           (digits.startswith("1") and len(digits) == 11):
            return digits

    # 2. PROCESAMIENTO DE ARGENTINA
    
    # Caso 2.1: Comienza con 549
    if digits.startswith("549"):
        resto = digits[3:]
        if resto.startswith("0"):
            resto = resto[1:]
        resto = _remover_15_argentina(resto)
        if len(resto) == 8:
            resto = f"{default_area_code}{resto}"
        return f"549{resto}"

    # Caso 2.2: Comienza con 54 (pero sin el 9 de móvil)
    if digits.startswith("54"):
        resto = digits[2:]
        if resto.startswith("0"):
            resto = resto[1:]
        resto = _remover_15_argentina(resto)
        if len(resto) == 8:
            resto = f"{default_area_code}{resto}"
        return f"549{resto}"

    # Caso 2.3: Comienza con 0 interurbano (ej: 011..., 0351..., 0223...)
    if digits.startswith("0"):
        resto = digits[1:]
        resto = _remover_15_argentina(resto)
        if len(resto) == 8:
            resto = f"{default_area_code}{resto}"
        return f"549{resto}"

    # Caso 2.4: Si empieza con 15 directo (ej: 1544445555 -> 8 dígitos locales)
    if digits.startswith("15") and len(digits) == 10:
        local_part = digits[2:]
        return f"549{default_area_code}{local_part}"

    # Caso 2.5: Comienza directamente con código de área (ej: 11..., 351..., 341..., 223...)
    if len(digits) == 10:
        resto = _remover_15_argentina(digits)
        if len(resto) == 8:
            resto = f"{default_area_code}{resto}"
        return f"549{resto}"

    # Si tiene entre 11 y 12 dígitos y contiene un 15 (ej: 111544445555)
    if len(digits) in (11, 12):
        resto = _remover_15_argentina(digits)
        if len(resto) == 8:
            resto = f"{default_area_code}{resto}"
        return f"549{resto}"

    # Caso 2.6: Número local de 8 dígitos (ej: 4444-5555)
    if len(digits) == 8:
        return f"549{default_area_code}{digits}"

    # Si no encaja en patrones específicos pero son dígitos válidos, aseguramos el prefijo 549
    if not digits.startswith("549"):
        return f"549{digits}"

    return digits

def _remover_15_argentina(numero_sin_pais: str) -> str:
    """
    Remueve el prefijo móvil local '15' de números argentinos.
    """
    # Si empieza con 11 y luego tiene 15 (ej: 111544445555 -> 1144445555)
    if numero_sin_pais.startswith("1115") and len(numero_sin_pais) >= 11:
        return "11" + numero_sin_pais[4:]

    # Si tiene código de área de 3 dígitos seguido de 15 (ej: 351154445555 -> 3514445555)
    area_3_prefixes = ("351", "341", "221", "223", "261", "381", "387", "299", "342", "379", "388")
    for pref in area_3_prefixes:
        if numero_sin_pais.startswith(pref + "15") and len(numero_sin_pais) >= 11:
            return pref + numero_sin_pais[5:]

    # Si empieza con 15 directo (ej: 1544445555 -> 44445555)
    if numero_sin_pais.startswith("15") and len(numero_sin_pais) == 10:
        return numero_sin_pais[2:]

    return numero_sin_pais

def phone_to_whatsapp_jid(raw_phone: str):
    """
    Normaliza el teléfono y construye el objeto JID de Neonize (o string).
    """
    normalized = normalize_phone_number(raw_phone)
    if NEONIZE_AVAILABLE and build_jid:
        return build_jid(normalized, "s.whatsapp.net")
    return f"{normalized}@s.whatsapp.net"

def format_phone_display(raw_phone: str) -> str:
    """
    Devuelve un formato visual prolijo y legible para la interfaz de usuario.
    Ej: '5491112345678' -> '+54 9 11 1234-5678'
    """
    if not raw_phone:
        return ""
    
    normalized = normalize_phone_number(raw_phone)
    
    # Formato Argentina estándar (+54 9 XX XXXX-XXXX o +54 9 XXX XXX-XXXX)
    if normalized.startswith("549"):
        pais = "+54 9"
        resto = normalized[3:]
        
        # AMBA (11)
        if resto.startswith("11") and len(resto) == 10:
            area = resto[:2]
            p1 = resto[2:6]
            p2 = resto[6:]
            return f"{pais} {area} {p1}-{p2}"
        
        # Áreas de 3 dígitos (ej: 351, 341, 223)
        if len(resto) == 10:
            area = resto[:3]
            p1 = resto[3:6]
            p2 = resto[6:]
            return f"{pais} {area} {p1}-{p2}"
        
        return f"{pais} {resto}"

    # Internacional general
    return f"+{normalized}"
