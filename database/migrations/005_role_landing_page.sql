-- ====================================================================
-- MIGRACIÓN 005: PÁGINA DE INICIO (LANDING PAGE) POR ROL CON FALLBACK
-- ====================================================================

-- 1. Agregar columna landing_page a la tabla roles si no existe
ALTER TABLE public.roles 
ADD COLUMN IF NOT EXISTS landing_page text DEFAULT '/';

-- 2. Configurar rutas de aterrizaje predeterminadas para los roles del sistema
UPDATE public.roles 
SET landing_page = '/quirofano-en-vivo' 
WHERE codigo = 'monitor_quirofano';

UPDATE public.roles 
SET landing_page = '/agenda-geclisa' 
WHERE codigo = 'medico';

UPDATE public.roles 
SET landing_page = '/asesoramiento-recepcion' 
WHERE codigo = 'recepcion';

UPDATE public.roles 
SET landing_page = '/logs' 
WHERE codigo = 'auditor';

UPDATE public.roles 
SET landing_page = '/' 
WHERE codigo = 'admin';
