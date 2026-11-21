-- ============================================================================
-- MIGRACIÓN 035: EDICIÓN DIRECTA DE INDICACIONES MÉDICAS Y HISTORIAL VERSIONADO
-- Extiende emisiones_indicaciones_geclisa con contenido estructurado completo y
-- baseline de auditoría, crea emisiones_indicaciones_versiones y la RPC
-- transaccional registrar_version_indicacion con bloqueo optimista.
-- ============================================================================

-- 1. Extender emisiones_indicaciones_geclisa (cabecera vigente + baseline inmutable)
ALTER TABLE public.emisiones_indicaciones_geclisa
    ADD COLUMN IF NOT EXISTS medicamentos JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS cuidados_generales TEXT,
    ADD COLUMN IF NOT EXISTS pautas_alarma TEXT,
    ADD COLUMN IF NOT EXISTS modulos_emitidos_json JSONB,
    ADD COLUMN IF NOT EXISTS plantilla_origen_id TEXT,
    ADD COLUMN IF NOT EXISTS origen_resolucion TEXT,
    ADD COLUMN IF NOT EXISTS contenido_original_json JSONB,
    ADD COLUMN IF NOT EXISTS version_actual INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS fue_modificada BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS campos_modificados JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS operador_id TEXT,
    ADD COLUMN IF NOT EXISTS operador_nombre TEXT,
    ADD COLUMN IF NOT EXISTS editado_at TIMESTAMPTZ;

-- 2. Crear tabla de historial versionado e inmutable
CREATE TABLE IF NOT EXISTS public.emisiones_indicaciones_versiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emision_id UUID NOT NULL REFERENCES public.emisiones_indicaciones_geclisa(id) ON DELETE CASCADE,
    version_numero INTEGER NOT NULL,
    modulos_emitidos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    texto_indicaciones TEXT,
    medicamentos JSONB DEFAULT '[]'::jsonb,
    cuidados_generales TEXT,
    pautas_alarma TEXT,
    fue_modificada BOOLEAN NOT NULL DEFAULT false,
    campos_modificados JSONB NOT NULL DEFAULT '[]'::jsonb,
    pdf_url TEXT,
    geclisa_im_id INTEGER,
    geclisa_im_ids JSONB DEFAULT '[]'::jsonb,
    operador_id TEXT,
    operador_nombre TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_emision_version_numero UNIQUE (emision_id, version_numero)
);

CREATE INDEX IF NOT EXISTS idx_emisiones_versiones_lookup
    ON public.emisiones_indicaciones_versiones (emision_id, version_numero DESC);

-- 3. Habilitar RLS y políticas equivalentes a emisiones_indicaciones_geclisa
ALTER TABLE public.emisiones_indicaciones_versiones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'emisiones_indicaciones_versiones'
          AND policyname = 'Permitir todo a usuarios autenticados en emisiones_indicaciones_versiones'
    ) THEN
        CREATE POLICY "Permitir todo a usuarios autenticados en emisiones_indicaciones_versiones"
        ON public.emisiones_indicaciones_versiones
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

GRANT ALL ON public.emisiones_indicaciones_versiones TO authenticated, service_role, anon;

-- 4. RPC transaccional con bloqueo optimista (expected_version) para anexar v2+
CREATE OR REPLACE FUNCTION public.registrar_version_indicacion(
    p_emision_id UUID,
    p_expected_version INTEGER,
    p_modulos_emitidos_json JSONB,
    p_texto_indicaciones TEXT,
    p_medicamentos JSONB,
    p_cuidados_generales TEXT,
    p_pautas_alarma TEXT,
    p_fue_modificada BOOLEAN,
    p_campos_modificados JSONB,
    p_pdf_path TEXT,
    p_pdf_url TEXT,
    p_operador_id TEXT,
    p_operador_nombre TEXT,
    p_fecha_emision DATE DEFAULT NULL,
    p_whatsapp_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_version INTEGER;
    v_geclisa_im_id INTEGER;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    UPDATE public.emisiones_indicaciones_geclisa
    SET
        modulos_emitidos_json = p_modulos_emitidos_json,
        texto_indicaciones = p_texto_indicaciones,
        medicamentos = COALESCE(p_medicamentos, '[]'::jsonb),
        cuidados_generales = p_cuidados_generales,
        pautas_alarma = p_pautas_alarma,
        fue_modificada = p_fue_modificada,
        campos_modificados = COALESCE(p_campos_modificados, '[]'::jsonb),
        pdf_path = COALESCE(p_pdf_path, pdf_path),
        pdf_url = COALESCE(p_pdf_url, pdf_url),
        operador_id = COALESCE(p_operador_id, operador_id),
        operador_nombre = COALESCE(p_operador_nombre, operador_nombre),
        fecha_emision = COALESCE(p_fecha_emision, fecha_emision),
        whatsapp_status = COALESCE(p_whatsapp_status, whatsapp_status),
        editado_at = v_now,
        version_actual = version_actual + 1
    WHERE id = p_emision_id
      AND version_actual = p_expected_version
    RETURNING version_actual, geclisa_im_id
    INTO v_new_version, v_geclisa_im_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'error', 'La indicación fue modificada por otro usuario. Recarga antes de guardar.'
        );
    END IF;

    INSERT INTO public.emisiones_indicaciones_versiones (
        emision_id,
        version_numero,
        modulos_emitidos_json,
        texto_indicaciones,
        medicamentos,
        cuidados_generales,
        pautas_alarma,
        fue_modificada,
        campos_modificados,
        pdf_url,
        geclisa_im_id,
        operador_id,
        operador_nombre,
        created_at
    ) VALUES (
        p_emision_id,
        v_new_version,
        COALESCE(p_modulos_emitidos_json, '[]'::jsonb),
        p_texto_indicaciones,
        COALESCE(p_medicamentos, '[]'::jsonb),
        p_cuidados_generales,
        p_pautas_alarma,
        p_fue_modificada,
        COALESCE(p_campos_modificados, '[]'::jsonb),
        p_pdf_url,
        v_geclisa_im_id,
        p_operador_id,
        p_operador_nombre,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'conflict', false,
        'version_numero', v_new_version
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_version_indicacion(
    UUID, INTEGER, JSONB, TEXT, JSONB, TEXT, TEXT, BOOLEAN, JSONB, TEXT, TEXT, TEXT, TEXT, DATE, TEXT
) TO authenticated, service_role, anon;
