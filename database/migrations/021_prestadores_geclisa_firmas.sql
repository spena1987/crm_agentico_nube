-- ====================================================================
-- MIGRACIÓN 021: EXTENSIÓN DE PRESTADORES PARA INTEGRACIÓN GECLISA Y FIRMAS
-- Agrega columnas geclisa_pre_id, firma_url y especialidad a la tabla prestadores.
-- ====================================================================

ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS geclisa_pre_id integer;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS firma_url text;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS especialidad text DEFAULT 'Médico Oftalmólogo';

CREATE INDEX IF NOT EXISTS idx_prestadores_geclisa_pre_id ON public.prestadores(geclisa_pre_id);
CREATE INDEX IF NOT EXISTS idx_prestadores_rol ON public.prestadores(rol);
