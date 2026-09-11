"""
Pydantic v2 schemas para Meta WhatsApp Cloud API (Graph API v21+).
Modela eventos entrantes (Webhooks), estados, mensajes interactivos y payloads de salida.
"""

from typing import List, Optional, Dict, Any, Union, Literal
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------
# Schemas para Webhook Inbound (Entrante)
# ---------------------------------------------------------------------

class MetaProfile(BaseModel):
    name: Optional[str] = None


class MetaContact(BaseModel):
    wa_id: str
    profile: Optional[MetaProfile] = None


class MetaTextMessage(BaseModel):
    body: str


class MetaMediaMessage(BaseModel):
    id: str
    mime_type: Optional[str] = None
    sha256: Optional[str] = None
    caption: Optional[str] = None
    filename: Optional[str] = None


class MetaInteractiveReply(BaseModel):
    id: str
    title: str


class MetaInteractiveButtonReply(BaseModel):
    button_reply: Optional[MetaInteractiveReply] = None
    list_reply: Optional[MetaInteractiveReply] = None


class MetaInboundMessage(BaseModel):
    id: str = Field(..., description="wamid emitido por Meta")
    from_: str = Field(..., alias="from")
    timestamp: str
    type: str  # text, interactive, image, document, audio, button
    text: Optional[MetaTextMessage] = None
    image: Optional[MetaMediaMessage] = None
    document: Optional[MetaMediaMessage] = None
    audio: Optional[MetaMediaMessage] = None
    interactive: Optional[MetaInteractiveButtonReply] = None
    context: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True)


class MetaMessageStatus(BaseModel):
    id: str = Field(..., description="wamid del mensaje al que refiere el estado")
    status: Literal["sent", "delivered", "read", "failed"]
    timestamp: str
    recipient_id: str
    conversation: Optional[Dict[str, Any]] = None
    pricing: Optional[Dict[str, Any]] = None
    errors: Optional[List[Dict[str, Any]]] = None


class MetaChangeValue(BaseModel):
    messaging_product: str = "whatsapp"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    contacts: Optional[List[MetaContact]] = None
    messages: Optional[List[MetaInboundMessage]] = None
    statuses: Optional[List[MetaMessageStatus]] = None


class MetaChange(BaseModel):
    field: str
    value: MetaChangeValue


class MetaEntry(BaseModel):
    id: str
    changes: List[MetaChange]


class MetaWebhookPayload(BaseModel):
    object: str
    entry: List[MetaEntry]


# ---------------------------------------------------------------------
# Schemas para Outbound (Salida)
# ---------------------------------------------------------------------

class TemplateParameter(BaseModel):
    type: Literal["text", "currency", "date_time", "image", "document", "video"] = "text"
    text: Optional[str] = None
    image: Optional[Dict[str, Any]] = None
    document: Optional[Dict[str, Any]] = None


class TemplateComponent(BaseModel):
    type: Literal["header", "body", "button"]
    sub_type: Optional[Literal["quick_reply", "url"]] = None
    index: Optional[int] = None
    parameters: List[TemplateParameter] = Field(default_factory=list)


class TemplateLanguage(BaseModel):
    code: str = "es_AR"


class SendTemplatePayload(BaseModel):
    messaging_product: str = "whatsapp"
    recipient_type: str = "individual"
    to: str
    type: str = "template"
    template: Dict[str, Any]


class SendTextPayload(BaseModel):
    messaging_product: str = "whatsapp"
    recipient_type: str = "individual"
    to: str
    type: str = "text"
    text: Dict[str, Any]


class QuickReplyButton(BaseModel):
    id: str
    title: str = Field(..., max_length=20, description="Meta impone límite de 20 caracteres")


class SendInteractiveButtonPayload(BaseModel):
    messaging_product: str = "whatsapp"
    recipient_type: str = "individual"
    to: str
    type: str = "interactive"
    interactive: Dict[str, Any]
