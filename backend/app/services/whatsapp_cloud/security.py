"""
Módulo de Seguridad, Criptografía y Compliance PHI/PII para Meta WhatsApp Cloud API.
Incluye validación en tiempo constante de HMAC-SHA256 y filtro de sanitización de logs.
"""

import hmac
import hashlib
import logging
import re
from typing import Optional


def verify_meta_signature(app_secret: str, raw_body: bytes, expected_signature: Optional[str]) -> bool:
    """
    Valida la firma criptográfica HMAC-SHA256 enviada por Meta en la cabecera 'X-Hub-Signature-256'.
    Utiliza hmac.compare_digest para evitar ataques de temporización (timing attacks).
    """
    if not app_secret:
        return False
    if not expected_signature or not expected_signature.startswith("sha256="):
        return False

    signature_hash = expected_signature.split("sha256=")[1].strip()
    calculated_mac = hmac.new(
        key=app_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(calculated_mac, signature_hash)


class PHIMaskingFilter(logging.Filter):
    """
    Filtro de logging para cumplimiento de normativas de salud (HIPAA / Ley 25.326 de Protección de Datos).
    Sanitiza y enmascara:
      - Teléfonos: e.g. 5491112345678 -> 54911****5678
      - Tokens de autorización: Bearer EAAG... -> Bearer [REDACTED]
      - App Secrets y Tokens de verificación.
    """

    PHONE_REGEX = re.compile(r"(\b\+?549?\d{2,4})\d{4,6}(\d{4}\b)")
    BEARER_REGEX = re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]{10,}", re.IGNORECASE)
    TOKEN_PARAM_REGEX = re.compile(r"(token|secret|password|access_token)=([^&\s]+)", re.IGNORECASE)

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.mask_text(record.msg)
        if record.args:
            # Si hay argumentos de formateo, sanitizarlos
            sanitized_args = []
            for arg in record.args if isinstance(record.args, (list, tuple)) else [record.args]:
                if isinstance(arg, str):
                    sanitized_args.append(self.mask_text(arg))
                else:
                    sanitized_args.append(arg)
            record.args = tuple(sanitized_args) if isinstance(record.args, tuple) else sanitized_args
        return True

    @classmethod
    def mask_text(cls, text: str) -> str:
        if not text:
            return text
        # Enmascarar tokens Bearer
        text = cls.BEARER_REGEX.sub(r"\1[REDACTED_TOKEN]", text)
        # Enmascarar parámetros sensibles en query strings o payloads
        text = cls.TOKEN_PARAM_REGEX.sub(r"\1=[REDACTED]", text)
        # Enmascarar teléfonos preservando código de área y últimos 4 dígitos
        text = cls.PHONE_REGEX.sub(r"\1****\2", text)
        return text
