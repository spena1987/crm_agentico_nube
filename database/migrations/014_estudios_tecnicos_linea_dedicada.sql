-- =========================================================================
-- MIGRACIÓN 014: Módulo de Estudios Oftalmológicos (Técnicos) y 2da Línea WhatsApp
-- =========================================================================
-- 1. Permitir registrar envíos de estudios de pacientes que solo existen en Geclisa
--    sin obligar a crear un registro en public.pacientes ("Cero Pacientes Fantasma").
ALTER TABLE public.estudios_oftalmo
    ALTER COLUMN paciente_id DROP NOT NULL;

-- 2. Añadir columnas de trazabilidad de Geclisa, Técnico Oftalmólogo y WhatsApp Cloud API (Línea 2)
ALTER TABLE public.estudios_oftalmo
    ADD COLUMN IF NOT EXISTS geclisa_pac_id INTEGER,
    ADD COLUMN IF NOT EXISTS geclisa_ficha_id INTEGER,
    ADD COLUMN IF NOT EXISTS geclisa_as_id INTEGER,
    ADD COLUMN IF NOT EXISTS dni_paciente TEXT,
    ADD COLUMN IF NOT EXISTS nombre_paciente TEXT,
    ADD COLUMN IF NOT EXISTS telefono_destino TEXT,
    ADD COLUMN IF NOT EXISTS nombre_archivo TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS tamano_bytes INTEGER,
    ADD COLUMN IF NOT EXISTS wamid TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_media_id TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS whatsapp_error TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS whatsapp_delivered_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS whatsapp_read_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS tecnico_usuario_id UUID,
    ADD COLUMN IF NOT EXISTS tecnico_nombre TEXT,
    ADD COLUMN IF NOT EXISTS tecnico_pre_id INTEGER,
    ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- 3. Índices de alto rendimiento para actualización de estados por Webhook (wamid) y búsquedas por DNI
CREATE INDEX IF NOT EXISTS idx_estudios_oftalmo_wamid ON public.estudios_oftalmo(wamid);
CREATE INDEX IF NOT EXISTS idx_estudios_oftalmo_dni ON public.estudios_oftalmo(dni_paciente);
CREATE INDEX IF NOT EXISTS idx_estudios_oftalmo_created_at ON public.estudios_oftalmo(created_at DESC);
