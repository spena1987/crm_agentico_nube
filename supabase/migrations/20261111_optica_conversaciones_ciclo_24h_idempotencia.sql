-- Migración: Soporte de Ciclo de Vida 24h, Preservación de Modo de Atención e Idempotencia Client_ID
-- Fecha: 2026-11-11

-- 1. Unificación de estados históricos existentes
UPDATE public.optica_conversaciones 
SET estado = 'activa' 
WHERE estado = 'abierta' OR estado IS NULL;

-- 2. Soporte de ciclo de vida 24h y preservación de modo de atención
ALTER TABLE public.optica_conversaciones 
  ADD COLUMN IF NOT EXISTS modo_atencion_previo VARCHAR(30) DEFAULT 'autonomo',
  ADD COLUMN IF NOT EXISTS cerrado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cerrado_motivo VARCHAR(50);

-- 3. Índices de rendimiento para el cron de auto-cierre y búsqueda por client_id
CREATE INDEX IF NOT EXISTS idx_optica_conv_autocierre 
  ON public.optica_conversaciones (estado, ventana_24h_expira_at) 
  WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_optica_mensajes_client_id 
  ON public.optica_mensajes (((metadata->>'client_id')));
