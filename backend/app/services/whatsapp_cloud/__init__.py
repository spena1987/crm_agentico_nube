"""
Paquete de integración con Meta WhatsApp Cloud API (Graph API v21+).
"""

from app.services.whatsapp_cloud.client import (
    WhatsAppCloudClient,
    MetaAPIError,
    ConversationWindowClosedError,
    RateLimitExceededError,
    AuthenticationError,
    get_whatsapp_app_secret
)
from app.services.whatsapp_cloud.normalizer import normalize_to_meta_e164, clean_phone_digits
from app.services.whatsapp_cloud.security import verify_meta_signature, PHIMaskingFilter
from app.services.whatsapp_cloud.router import router as whatsapp_cloud_router

__all__ = [
    "WhatsAppCloudClient",
    "MetaAPIError",
    "ConversationWindowClosedError",
    "RateLimitExceededError",
    "AuthenticationError",
    "get_whatsapp_app_secret",
    "normalize_to_meta_e164",
    "clean_phone_digits",
    "verify_meta_signature",
    "PHIMaskingFilter",
    "whatsapp_cloud_router",
]
