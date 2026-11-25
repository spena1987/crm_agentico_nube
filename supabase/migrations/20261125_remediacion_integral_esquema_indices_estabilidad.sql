-- Migración integral de estabilidad, sincronización de esquema y optimización de índices
-- Fecha: 2026-11-25

-- 1. Columnas faltantes en producción (SQLState 42703 / PGRST204)
ALTER TABLE public.asesorias_quirurgicas
  ADD COLUMN IF NOT EXISTS modalidad_bilateral TEXT;

UPDATE public.asesorias_quirurgicas
SET modalidad_bilateral = checklist_prequirurgico -> '_meta_bilateral' ->> 'modalidad'
WHERE modalidad_bilateral IS NULL
  AND checklist_prequirurgico ? '_meta_bilateral'
  AND NULLIF(BTRIM(checklist_prequirurgico -> '_meta_bilateral' ->> 'modalidad'), '') IS NOT NULL;

ALTER TABLE public.turnos_quirofano
  ADD COLUMN IF NOT EXISTS pulsera_impresa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pulsera_impresa_at TIMESTAMPTZ;

ALTER TABLE public.modelos_lio_elementos_geclisa
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- 2. Ampliar CHECK constraint en whatsapp_messages para soportar respuestas de botones ('button'), reacciones, etc. (SQLState 23514)
ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_message_type_check
  CHECK ((message_type)::text = ANY (ARRAY[
    'text', 'template', 'interactive', 'button', 'reaction',
    'image', 'document', 'audio', 'video', 'sticker',
    'location', 'contacts', 'order', 'system', 'unknown'
  ]::text[]));

-- 3. Saneamiento no destructivo de referencias Geclisa con teléfonos / desbordamiento Int32 (> 2147483647 o <= 0)
UPDATE public.optica_contactos
SET ficha_geclisa_id = NULL
WHERE ficha_geclisa_id IS NOT NULL
  AND (
    (BTRIM(ficha_geclisa_id::text) ~ '^[0-9]+$' AND (BTRIM(ficha_geclisa_id::text)::numeric > 2147483647 OR BTRIM(ficha_geclisa_id::text)::numeric <= 0))
    OR LENGTH(BTRIM(ficha_geclisa_id::text)) >= 10
  );

UPDATE public.optica_oportunidades_geclisa
SET ficha_geclisa_id = NULL
WHERE ficha_geclisa_id IS NOT NULL
  AND (
    (BTRIM(ficha_geclisa_id::text) ~ '^[0-9]+$' AND (BTRIM(ficha_geclisa_id::text)::numeric > 2147483647 OR BTRIM(ficha_geclisa_id::text)::numeric <= 0))
    OR LENGTH(BTRIM(ficha_geclisa_id::text)) >= 10
  );

UPDATE public.pacientes
SET geclisa_ficha_id = NULL
WHERE geclisa_ficha_id IS NOT NULL
  AND (geclisa_ficha_id > 2147483647 OR geclisa_ficha_id <= 0);

-- 4. Índices faltantes en Foreign Keys detectados por Supabase Performance Advisor
CREATE INDEX IF NOT EXISTS idx_npi_prestador_id
  ON public.nomenclador_practicas_indicaciones (prestador_id);

CREATE INDEX IF NOT EXISTS idx_optica_envios_campana_id
  ON public.optica_envios_programados (campana_id);

CREATE INDEX IF NOT EXISTS idx_optica_envios_contacto_id
  ON public.optica_envios_programados (contacto_id);

CREATE INDEX IF NOT EXISTS idx_optica_envios_oportunidad_id
  ON public.optica_envios_programados (oportunidad_id);

CREATE INDEX IF NOT EXISTS idx_optica_mensajes_contacto_id
  ON public.optica_mensajes (contacto_id);

CREATE INDEX IF NOT EXISTS idx_optica_oportunidades_contacto_id
  ON public.optica_oportunidades_geclisa (contacto_id);

CREATE INDEX IF NOT EXISTS idx_turnos_quirofano_ind_postqx_emision_id
  ON public.turnos_quirofano (indicaciones_postqx_emision_id);

-- 5. Recargar schema cache de PostgREST inmediatamente
NOTIFY pgrst, 'reload schema';
