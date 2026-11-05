-- Migración 031: Agregar columna updated_at a la tabla presupuestos y asegurar trigger defensivo
-- Resuelve el error 42703 que impedía cerrar casos quirúrgicos con presupuestos asociados en el Pipeline

-- 1. Agregar updated_at a public.presupuestos si no existe
ALTER TABLE public.presupuestos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Actualizar función trigger fn_sync_asesoria_a_turnos_qx
CREATE OR REPLACE FUNCTION public.fn_sync_asesoria_a_turnos_qx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_ahora timestamptz := now();
BEGIN
    IF NEW.estado = 'operado' AND (OLD.estado IS DISTINCT FROM 'operado') THEN
        UPDATE turnos_quirofano
        SET 
            estado = 'operado',
            fin_cirugia_at = COALESCE(fin_cirugia_at, v_ahora),
            updated_at = v_ahora
        WHERE asesoria_id = NEW.id 
          AND estado NOT IN ('operado', 'cancelado');

        IF NEW.presupuesto_id IS NOT NULL THEN
            UPDATE presupuestos
            SET estado = 'operado', updated_at = v_ahora
            WHERE id = NEW.presupuesto_id AND estado != 'operado';
        END IF;

    ELSIF NEW.estado = 'cancelado' AND (OLD.estado IS DISTINCT FROM 'cancelado') THEN
        UPDATE turnos_quirofano
        SET 
            estado = 'cancelado',
            updated_at = v_ahora
        WHERE asesoria_id = NEW.id 
          AND estado != 'cancelado';
    END IF;

    RETURN NEW;
END;
$$;
