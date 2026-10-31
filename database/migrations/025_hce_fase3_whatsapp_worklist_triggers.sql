-- ====================================================================
-- MIGRACIÓN 025: FASE 3 HCE - WHATSAPP TRANSACCIONAL, WORKLIST Y TRIGGERS
-- ====================================================================

-- 1. Ampliar pedidos_estudios_oftalmo para Worklist de Técnicos
ALTER TABLE public.pedidos_estudios_oftalmo
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'PENDIENTE' NOT NULL,
    ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) DEFAULT 'NORMAL' NOT NULL,
    ADD COLUMN IF NOT EXISTS estudio_oftalmo_id UUID REFERENCES public.estudios_oftalmo(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS completado_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS tecnico_usuario_id UUID REFERENCES public.usuarios_perfil(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tecnico_nombre VARCHAR(150);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedidos_estudios_estado') THEN
        ALTER TABLE public.pedidos_estudios_oftalmo
            ADD CONSTRAINT chk_pedidos_estudios_estado CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedidos_estudios_prioridad') THEN
        ALTER TABLE public.pedidos_estudios_oftalmo
            ADD CONSTRAINT chk_pedidos_estudios_prioridad CHECK (prioridad IN ('NORMAL', 'URGENTE', 'PREQUIRURGICO'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pedidos_estudios_estado ON public.pedidos_estudios_oftalmo(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_estudios_prioridad ON public.pedidos_estudios_oftalmo(prioridad);

-- 2. Tabla de Tokens Efímeros Cifrados para Descarga Segura de Documentos Médicos (Ley 25.326)
CREATE TABLE IF NOT EXISTS public.hce_document_share_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    estudio_id UUID REFERENCES public.estudios_oftalmo(id) ON DELETE CASCADE,
    consulta_id UUID REFERENCES public.consultas_oftalmo(id) ON DELETE SET NULL,
    archivo_url TEXT NOT NULL,
    archivo_nombre VARCHAR(255),
    mime_type VARCHAR(100),
    dni_last4 VARCHAR(4) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accesos_count INTEGER DEFAULT 0 NOT NULL,
    max_accesos INTEGER DEFAULT 10,
    ultimo_acceso_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_hash ON public.hce_document_share_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_share_tokens_paciente ON public.hce_document_share_tokens(paciente_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires ON public.hce_document_share_tokens(expires_at);

-- 3. Tabla de Triggers Clínicos Programados (Seguimiento Postop 24h / 7d y Preventivo)
CREATE TABLE IF NOT EXISTS public.hce_scheduled_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    consulta_id UUID REFERENCES public.consultas_oftalmo(id) ON DELETE CASCADE,
    tipo_trigger VARCHAR(50) NOT NULL,
    fecha_programada TIMESTAMP WITH TIME ZONE NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    payload_mensaje JSONB DEFAULT '{}'::jsonb NOT NULL,
    ejecutado_at TIMESTAMP WITH TIME ZONE,
    wamid TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_scheduled_triggers_estado') THEN
        ALTER TABLE public.hce_scheduled_triggers
            ADD CONSTRAINT chk_scheduled_triggers_estado CHECK (estado IN ('PENDING', 'SENT', 'CANCELLED', 'FAILED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_pending ON public.hce_scheduled_triggers(estado, fecha_programada);
CREATE INDEX IF NOT EXISTS idx_scheduled_triggers_paciente ON public.hce_scheduled_triggers(paciente_id);

-- 4. Habilitar RLS
ALTER TABLE public.hce_document_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hce_scheduled_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura share tokens para autenticados" ON public.hce_document_share_tokens;
CREATE POLICY "Permitir lectura share tokens para autenticados"
    ON public.hce_document_share_tokens FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir gestionar triggers para autenticados" ON public.hce_scheduled_triggers;
CREATE POLICY "Permitir gestionar triggers para autenticados"
    ON public.hce_scheduled_triggers FOR ALL
    TO authenticated
    USING (true);
