-- ====================================================================
-- MIGRACIÓN 020: CLASIFICACIÓN DE EMISIONES DE INDICACIONES MÉDICAS
-- Permite categorizar documentos (prequirúrgico, orden médica, postquirúrgico, certificado)
-- ====================================================================

ALTER TABLE public.emisiones_indicaciones_geclisa 
ADD COLUMN IF NOT EXISTS tipo_documento varchar DEFAULT 'general',
ADD COLUMN IF NOT EXISTS titulo_documento varchar DEFAULT 'INDICACIÓN MÉDICA';

CREATE INDEX IF NOT EXISTS idx_emisiones_ind_tipo ON public.emisiones_indicaciones_geclisa(tipo_documento);
