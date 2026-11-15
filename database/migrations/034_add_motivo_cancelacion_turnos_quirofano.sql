-- Migration: 034_add_motivo_cancelacion_turnos_quirofano.sql
-- Description: Agrega motivo_cancelacion a turnos_quirofano para evitar fallo 42703 en get_asesorias_confirmadas_pendientes y soportar trazabilidad de reprogramaciones desde Asesoramiento.

ALTER TABLE public.turnos_quirofano
ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT DEFAULT NULL;

COMMENT ON COLUMN public.turnos_quirofano.motivo_cancelacion IS 'Motivo de cancelación o liberación del turno (ej. reprogramado_asesoramiento)';
