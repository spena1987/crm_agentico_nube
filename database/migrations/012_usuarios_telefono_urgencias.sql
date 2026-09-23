-- ====================================================================
-- MIGRACIÓN 012: Teléfono móvil de guardia y alertas en usuarios_perfil
-- Permite recibir alertas postquirúrgicas y avisos críticos por WhatsApp
-- ====================================================================

ALTER TABLE public.usuarios_perfil 
ADD COLUMN IF NOT EXISTS telefono character varying(50);

COMMENT ON COLUMN public.usuarios_perfil.telefono IS 'Teléfono móvil en formato internacional para recibir alertas urgentes de pacientes por WhatsApp.';
