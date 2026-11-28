-- ============================================================================
-- Ampliación: 4ta unidad de negocio 'asesoramiento' + URL SurveyMonkey
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
        CHECK (unidad_negocio IN ('consultas', 'estudios', 'cirugias', 'asesoramiento', 'excluido'));
END
$$;

UPDATE public.configuracion_sistema
SET valor = jsonb_set(
    valor,
    '{surveymonkey_url_asesoramiento}',
    '"https://es.surveymonkey.com/r/25Y722Y"'::jsonb,
    true
)
WHERE clave = 'encuestas_config';

UPDATE public.encuestas_mapeo_geclisa
SET unidad_negocio = 'asesoramiento',
    incluir_en_envio = true,
    updated_at = now()
WHERE (tipo_entidad = 'servicio' AND geclisa_id = '130')
   OR (tipo_entidad = 'prestador' AND geclisa_id IN ('969', '2084'));
