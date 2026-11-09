-- Migration: 033_add_hora_citacion_secuencia_quirofano.sql
-- Description: Agrega hora_citacion_paciente y secuencia_ojo para la Planilla Quirúrgica Operativa Diaria

ALTER TABLE public.turnos_quirofano 
ADD COLUMN IF NOT EXISTS hora_citacion_paciente TIME;

ALTER TABLE public.turnos_quirofano 
ADD COLUMN IF NOT EXISTS secuencia_ojo VARCHAR(5) DEFAULT NULL;

COMMENT ON COLUMN public.turnos_quirofano.hora_citacion_paciente IS 'Hora sugerida o confirmada de citación del paciente a prequirófano (H. PAC)';
COMMENT ON COLUMN public.turnos_quirofano.secuencia_ojo IS 'Override manual de secuencia bilateral: 1 (Primer ojo), 2 (Segundo ojo), U (Unilateral/Ojo único) o NULL (automático)';

CREATE INDEX IF NOT EXISTS idx_turnos_quirofano_planilla_diaria 
ON public.turnos_quirofano(fecha_cirugia, hora_inicio);
