-- ====================================================================
-- MIGRACIÓN 026: VISIBILIDAD DE PLANTILLAS WHATSAPP EN HCE
-- ====================================================================

ALTER TABLE public.whatsapp_templates 
    ADD COLUMN IF NOT EXISTS visible_en_hce BOOLEAN DEFAULT true;

-- Asegurar valor por defecto para registros existentes nulos
UPDATE public.whatsapp_templates 
SET visible_en_hce = true 
WHERE visible_en_hce IS NULL;

-- Inicializar explícitamente en true para las plantillas asistenciales aprobadas
UPDATE public.whatsapp_templates
SET visible_en_hce = true
WHERE name IN (
    'recordatorio_cirugia_preparacion_v1',
    'comunicacion_asistencial_paciente_v1',
    'confirmacion_consentimiento_quirurgico_v1',
    'consentimiento_informado_quirurgico_v1',
    'apertura_conversacion',
    'entrega_estudio_oftalmologico_v1',
    'entrega_estudio_oftalmologico_pdf',
    'entrega_estudio_oftalmologico_img',
    'indicaciones_prequirurgicas_video_v1'
);

COMMENT ON COLUMN public.whatsapp_templates.visible_en_hce IS 'Define si la plantilla homologada de Meta se encuentra disponible para despacho desde la Historia Clínica Electrónica (HCE).';
