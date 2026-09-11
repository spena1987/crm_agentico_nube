-- ====================================================================
-- MIGRATION: 001_meta_whatsapp_cloud_api.sql
-- Integración Nativa Meta WhatsApp Cloud API (Graph API v21+)
-- CRM Médico y Mensajería Omnicanal
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. WHATSAPP_ACCOUNTS: Cuentas y Credenciales de WABA / Phone Number ID
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waba_id VARCHAR(64) NOT NULL,
    phone_number_id VARCHAR(64) NOT NULL UNIQUE,
    display_phone_number VARCHAR(32) NOT NULL,
    verified_name VARCHAR(255) NOT NULL,
    quality_rating VARCHAR(32) DEFAULT 'UNKNOWN' CHECK (quality_rating IN ('GREEN', 'YELLOW', 'RED', 'UNKNOWN')),
    messaging_limit_tier VARCHAR(32) DEFAULT 'TIER_250' CHECK (messaging_limit_tier IN ('TIER_250', 'TIER_1K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED')),
    system_user_token_encrypted TEXT NOT NULL,
    app_secret_encrypted TEXT,
    webhook_verify_token_hash VARCHAR(128) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_wa_accounts_phone_id ON public.whatsapp_accounts(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wa_accounts_waba_id ON public.whatsapp_accounts(waba_id);

COMMENT ON TABLE public.whatsapp_accounts IS 'Cuentas de WhatsApp Business API de Meta conectadas al CRM.';

-- ---------------------------------------------------------------------
-- 2. PATIENT_CONVERSATIONS: Sesiones y Ventana de Servicio de 24 Horas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE RESTRICT,
    wa_chat_id VARCHAR(32) NOT NULL, -- E.164 phone string (ej: 5491123456789)
    window_expires_at TIMESTAMPTZ, -- UTC timestamp límite de la ventana de 24 horas de Meta
    session_status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (session_status IN ('OPEN', 'EXPIRED', 'PENDING_TEMPLATE')),
    bot_mode VARCHAR(32) NOT NULL DEFAULT 'AI_AGENT' CHECK (bot_mode IN ('AI_AGENT', 'HUMAN_OPERATOR', 'MUTED')),
    assigned_agent_id UUID,
    last_inbound_at TIMESTAMPTZ,
    last_outbound_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_patient_account UNIQUE (paciente_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_paciente ON public.patient_conversations(paciente_id);
CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON public.patient_conversations(wa_chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_window ON public.patient_conversations(window_expires_at);

COMMENT ON TABLE public.patient_conversations IS 'Sesiones de conversación con pacientes bajo la ventana de 24 hs de Meta.';

-- ---------------------------------------------------------------------
-- 3. MESSAGE_TEMPLATES: Plantillas Homologadas de Meta
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    meta_template_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('UTILITY', 'AUTHENTICATION', 'MARKETING')),
    language VARCHAR(16) NOT NULL DEFAULT 'es_AR',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('APPROVED', 'REJECTED', 'PENDING', 'PAUSED', 'DISABLED')),
    components JSONB NOT NULL,
    variable_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_account_template_name_lang UNIQUE (account_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_templates_lookup ON public.message_templates(account_id, name, language, status);

COMMENT ON TABLE public.message_templates IS 'Plantillas pre-aprobadas de Meta para turnos y notificaciones clínicas.';

-- ---------------------------------------------------------------------
-- 4. WHATSAPP_MESSAGES: Mensajes Bidireccionales, WAMID y Auditoría
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.patient_conversations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE RESTRICT,
    wamid VARCHAR(128) UNIQUE, -- WhatsApp Message ID emitido por Meta (wamid.HBgL...)
    direction VARCHAR(16) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(32) NOT NULL CHECK (message_type IN ('text', 'template', 'interactive', 'image', 'document', 'audio', 'location', 'system')),
    content_text TEXT,
    payload_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'enqueued' CHECK (status IN ('enqueued', 'sent', 'delivered', 'read', 'failed')),
    error_code INTEGER,
    error_message TEXT,
    billing_category VARCHAR(32) CHECK (billing_category IN ('utility', 'authentication', 'marketing', 'service', 'free_tier')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_wamid ON public.whatsapp_messages(wamid);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conv_created ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status ON public.whatsapp_messages(status);

COMMENT ON TABLE public.whatsapp_messages IS 'Registro inmutable de auditoría para mensajería clínica en WhatsApp Cloud API.';
