-- ====================================================================
-- Migración 009: Tabla de Configuración Institucional del Sistema (CRM)
-- Garantiza la persistencia definitiva de Ajustes, Perfil y Plantillas
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.configuracion_sistema (
    clave VARCHAR(100) PRIMARY KEY,
    valor JSONB NOT NULL DEFAULT '{}'::jsonb,
    descripcion TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_por TEXT
);

-- Habilitar RLS
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad RLS
DROP POLICY IF EXISTS "Service role tiene acceso completo a configuracion_sistema" ON public.configuracion_sistema;
CREATE POLICY "Service role tiene acceso completo a configuracion_sistema"
ON public.configuracion_sistema
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura a autenticados y anon" ON public.configuracion_sistema;
CREATE POLICY "Permitir lectura a autenticados y anon"
ON public.configuracion_sistema
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir modificacion a autenticados" ON public.configuracion_sistema;
CREATE POLICY "Permitir modificacion a autenticados"
ON public.configuracion_sistema
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
