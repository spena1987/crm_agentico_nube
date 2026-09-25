-- ====================================================================
-- MIGRATION: 014_conversaciones_ultimo_mensaje_at.sql
-- Campo explícito para timestamp de última interacción/mensaje en conversaciones,
-- desacoplado del updated_at genérico de fila (evita saltos al hacer clic o marcar leído).
-- ====================================================================

-- 1. Agregar columna ultimo_mensaje_at
ALTER TABLE public.conversaciones
ADD COLUMN IF NOT EXISTS ultimo_mensaje_at TIMESTAMPTZ;

-- 2. Poblar con la fecha del último mensaje o fecha de creación del paciente
UPDATE public.conversaciones c
SET ultimo_mensaje_at = (SELECT MAX(created_at) FROM public.mensajes m WHERE m.conversacion_id = c.id);

UPDATE public.conversaciones c
SET ultimo_mensaje_at = p.created_at
FROM public.pacientes p
WHERE p.id = c.paciente_id AND c.ultimo_mensaje_at IS NULL;

UPDATE public.conversaciones c
SET ultimo_mensaje_at = c.created_at
WHERE c.ultimo_mensaje_at IS NULL;

-- 3. Índice para ordenamiento ultra rápido
CREATE INDEX IF NOT EXISTS idx_conversaciones_ultimo_mensaje_at
ON public.conversaciones (ultimo_mensaje_at DESC NULLS LAST);

COMMENT ON COLUMN public.conversaciones.ultimo_mensaje_at IS 'Timestamp de la última interacción real (mensaje entrante o saliente). Usado para orden cronológico tipo WhatsApp sin alterarse al leer o seleccionar.';
