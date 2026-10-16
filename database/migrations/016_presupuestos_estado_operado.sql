-- Migración 016: Agregar estado 'operado' a la tabla presupuestos
-- Permite que los presupuestos vinculados a casos quirúrgicos se marquen como operados
-- al completarse la cirugía desde Quirófano o cerrarse desde Asesoramiento.

ALTER TABLE public.presupuestos DROP CONSTRAINT IF EXISTS presupuestos_estado_check;
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_estado_check 
  CHECK (estado IN ('borrador', 'enviado', 'aprobado', 'rechazado', 'operado'));

-- Actualizar presupuestos vinculados a casos que ya están operados
UPDATE public.presupuestos p
SET estado = 'operado'
FROM public.asesorias_quirurgicas a
WHERE (p.asesoria_id = a.id OR a.presupuesto_id = p.id)
  AND a.estado = 'operado'
  AND p.estado != 'operado';
