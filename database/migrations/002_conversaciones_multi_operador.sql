-- ====================================================================
-- MIGRATION: 002_conversaciones_multi_operador.sql
-- Soporte para Asignación Multi-Operador, Ciclo de Vida y Triaging
-- CRM Médico y WhatsApp Cloud API
-- ====================================================================

-- 1. Agregar columnas a la tabla conversaciones
ALTER TABLE public.conversaciones 
ADD COLUMN IF NOT EXISTS asignado_a_usuario_id UUID REFERENCES public.usuarios_perfil(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS estado_gestion VARCHAR(32) DEFAULT 'SIN_ASIGNAR' CHECK (estado_gestion IN ('SIN_ASIGNAR', 'EN_GESTION', 'RESUELTO'));

-- 2. Índices para acelerar búsquedas y filtros por operador y estado
CREATE INDEX IF NOT EXISTS idx_conversaciones_asignado ON public.conversaciones(asignado_a_usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_estado_gestion ON public.conversaciones(estado_gestion);

-- 3. Asegurar índice en usuarios_perfil para joins rápidos
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_activo ON public.usuarios_perfil(activo);

-- 4. Actualizar estados preexistentes: si archivada = true -> RESUELTO; si bot_disabled = false -> SIN_ASIGNAR
UPDATE public.conversaciones
SET estado_gestion = 'RESUELTO'
WHERE archivada = TRUE AND estado_gestion = 'SIN_ASIGNAR';

UPDATE public.conversaciones
SET estado_gestion = 'EN_GESTION'
WHERE bot_disabled = TRUE AND archivada = FALSE AND asignado_a_usuario_id IS NOT NULL;

COMMENT ON COLUMN public.conversaciones.asignado_a_usuario_id IS 'ID del usuario del CRM (usuarios_perfil) que tiene asignada la conversación.';
COMMENT ON COLUMN public.conversaciones.estado_gestion IS 'Ciclo de vida de atención: SIN_ASIGNAR (en espera), EN_GESTION (atendiendo operador), RESUELTO (finalizado).';
