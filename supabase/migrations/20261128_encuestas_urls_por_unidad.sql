-- ============================================================================
-- Ampliación: URLs de SurveyMonkey por unidad de negocio (consultas, estudios, cirugias)
-- Fecha: 2026-11-28
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.encuestas_mapeo_geclisa'::regclass
          AND conname = 'encuestas_mapeo_geclisa_unidad_negocio_check'
    ) THEN
        ALTER TABLE public.encuestas_mapeo_geclisa
            DROP CONSTRAINT encuestas_mapeo_geclisa_unidad_negocio_check;
    END IF;

    ALTER TABLE public.encuestas_mapeo_geclisa
        ADD CONSTRAINT encuestas_mapeo_geclisa_unidad_negocio_check
        CHECK (unidad_negocio IN ('consultas', 'estudios', 'cirugias', 'excluido'));
END
$$;

UPDATE public.configuracion_sistema
SET valor = jsonb_set(
    jsonb_set(
        valor,
        '{surveymonkey_url_estudios}',
        COALESCE(valor->'surveymonkey_url_estudios', '""'::jsonb),
        true
    ),
    '{surveymonkey_url_cirugias}',
    COALESCE(valor->'surveymonkey_url_cirugias', '""'::jsonb),
    true
)
WHERE clave = 'encuestas_config';
