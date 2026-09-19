-- ====================================================================
-- MIGRACIÓN 011: NÚMERO CORRELATIVO SECUENCIAL PARA PRESUPUESTOS
-- Genera secuencia autoincremental iniciando en 1 (00000001) y retroactiva
-- ====================================================================

-- 1. Crear secuencia de numeración de presupuestos iniciando en 1
CREATE SEQUENCE IF NOT EXISTS public.presupuestos_numero_seq START WITH 1 INCREMENT BY 1;

-- 2. Agregar columna numero_presupuesto con default nextval de la secuencia
ALTER TABLE public.presupuestos 
ADD COLUMN IF NOT EXISTS numero_presupuesto BIGINT DEFAULT nextval('public.presupuestos_numero_seq');

-- 3. Crear índice para búsquedas rápidas por número
CREATE INDEX IF NOT EXISTS idx_presupuestos_numero ON public.presupuestos(numero_presupuesto);

-- 4. Backfill retroactivo para asignar números correlativos ordenados cronológicamente
DO $$
DECLARE
    r RECORD;
    n BIGINT := 1;
BEGIN
    FOR r IN SELECT id FROM public.presupuestos ORDER BY created_at ASC LOOP
        UPDATE public.presupuestos SET numero_presupuesto = n WHERE id = r.id;
        n := n + 1;
    END LOOP;
    -- Sincronizar el valor actual de la secuencia con el último número asignado
    PERFORM setval('public.presupuestos_numero_seq', GREATEST(n - 1, 1));
END $$;
