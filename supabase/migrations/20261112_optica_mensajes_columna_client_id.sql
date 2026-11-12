-- Migración: Agregar columna client_id a optica_mensajes para persistencia e idempotencia
-- Fecha: 2026-11-12

ALTER TABLE public.optica_mensajes 
  ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE INDEX IF NOT EXISTS idx_optica_mensajes_client_id_col 
  ON public.optica_mensajes(client_id);
