-- ============================================================================
-- Migración: Unificación del Flujo Comercial, Biométrico y Quirúrgico de LIO
-- Fecha: 2026-11-15
-- Ref: docs/designs/unificacion_flujo_lio_nomenclador_quirofano.md
-- ============================================================================

-- 1. Vínculo explícito Nomenclador Comercial <-> Familias Clínicas (modelos_lio)
ALTER TABLE public.nomenclador_practicas
    ADD COLUMN IF NOT EXISTS familias_lio_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS condicion_toricidad TEXT DEFAULT 'esferico';

UPDATE public.nomenclador_practicas
SET familias_lio_ids = '[]'::jsonb
WHERE familias_lio_ids IS NULL;

UPDATE public.nomenclador_practicas
SET condicion_toricidad = 'esferico'
WHERE condicion_toricidad IS NULL OR condicion_toricidad NOT IN ('esferico', 'torico', 'ambos');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'nomenclador_practicas_condicion_toricidad_chk'
          AND conrelid = 'public.nomenclador_practicas'::regclass
    ) THEN
        ALTER TABLE public.nomenclador_practicas
            ADD CONSTRAINT nomenclador_practicas_condicion_toricidad_chk
            CHECK (condicion_toricidad IN ('esferico', 'torico', 'ambos'));
    END IF;
END $$;

-- 2. Consolidación idempotente de familias duplicadas en modelos_lio + catalogo_maestro_gtin
DO $$
DECLARE
    v_canon_sa60at UUID;
    v_dup_rec RECORD;
    v_canon_rec RECORD;
    v_canon_code TEXT;
    v_clareon_mono UUID;
    v_panoptix_comun UUID;
    v_panoptix_pro UUID;
    v_vivity UUID;
    v_sa60at UUID;
BEGIN
    -- 2.a Unificación específica Natural SA60AT <- Alcon SA60AT
    SELECT id INTO v_canon_sa60at
    FROM public.modelos_lio
    WHERE UPPER(modelo) LIKE '%NATURAL%' AND UPPER(modelo) LIKE '%SA60AT%'
    ORDER BY activo DESC, created_at ASC
    LIMIT 1;

    IF v_canon_sa60at IS NULL THEN
        SELECT id INTO v_canon_sa60at
        FROM public.modelos_lio
        WHERE UPPER(modelo) LIKE '%SA60AT%'
        ORDER BY activo DESC, created_at ASC
        LIMIT 1;
    END IF;

    IF v_canon_sa60at IS NOT NULL THEN
        -- Consolidar posibles registros duplicados SA60AT en modelos_lio
        FOR v_dup_rec IN
            SELECT id, admite_toricos
            FROM public.modelos_lio
            WHERE UPPER(modelo) LIKE '%SA60AT%'
              AND id <> v_canon_sa60at
        LOOP
            IF COALESCE(v_dup_rec.admite_toricos, FALSE) THEN
                UPDATE public.modelos_lio
                SET admite_toricos = TRUE, updated_at = now()
                WHERE id = v_canon_sa60at;
            END IF;

            -- Reasignar modelos_lio_items evitando colisiones (modelo_lio_id, dioptria, torico_valor)
            UPDATE public.modelos_lio_items dup_it
            SET modelo_lio_id = v_canon_sa60at, updated_at = now()
            WHERE dup_it.modelo_lio_id = v_dup_rec.id
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.modelos_lio_items canon_it
                  WHERE canon_it.modelo_lio_id = v_canon_sa60at
                    AND canon_it.dioptria = dup_it.dioptria
                    AND COALESCE(canon_it.torico_valor, '') = COALESCE(dup_it.torico_valor, '')
              );

            UPDATE public.catalogo_maestro_gtin
            SET modelo_lio_id = v_canon_sa60at,
                familia_nombre = 'Natural SA60AT',
                updated_at = now()
            WHERE modelo_lio_id = v_dup_rec.id;

            UPDATE public.modelos_lio
            SET activo = FALSE, updated_at = now()
            WHERE id = v_dup_rec.id;
        END LOOP;

        -- Unificar Alcon SA60AT huérfano en catalogo_maestro_gtin hacia Natural SA60AT
        UPDATE public.catalogo_maestro_gtin
        SET modelo_lio_id = v_canon_sa60at,
            familia_nombre = 'Natural SA60AT',
            updated_at = now()
        WHERE (
            UPPER(COALESCE(familia_nombre, '')) LIKE '%SA60AT%'
            OR UPPER(COALESCE(nombre_producto, '')) LIKE '%SA60AT%'
            OR UPPER(COALESCE(internacional, '')) LIKE '%SA60AT%'
        )
        AND (modelo_lio_id IS DISTINCT FROM v_canon_sa60at OR familia_nombre IS DISTINCT FROM 'Natural SA60AT');
    END IF;

    -- 2.b Consolidar cualquier otra familia duplicada en modelos_lio por código canónico
    FOR v_canon_code IN
        SELECT unnest(ARRAY['SA60AT', 'SN60WF', 'CNA0T0', 'CNW0T', 'TFNT00', 'TFNT', 'DFT015', 'DFT', 'MA60AC', 'MA60MA'])
    LOOP
        SELECT id INTO v_canon_rec
        FROM public.modelos_lio
        WHERE UPPER(modelo) ~ ('(^|[^A-Z0-9])' || v_canon_code || '([^A-Z0-9]|$)')
        ORDER BY activo DESC, (CASE WHEN UPPER(modelo) LIKE '%NATURAL%' OR UPPER(modelo) LIKE '%CLAREON%' THEN 0 ELSE 1 END), created_at ASC
        LIMIT 1;

        IF v_canon_rec.id IS NOT NULL THEN
            FOR v_dup_rec IN
                SELECT id, admite_toricos
                FROM public.modelos_lio
                WHERE UPPER(modelo) ~ ('(^|[^A-Z0-9])' || v_canon_code || '([^A-Z0-9]|$)')
                  AND id <> v_canon_rec.id
            LOOP
                IF COALESCE(v_dup_rec.admite_toricos, FALSE) THEN
                    UPDATE public.modelos_lio
                    SET admite_toricos = TRUE, updated_at = now()
                    WHERE id = v_canon_rec.id;
                END IF;

                -- Reasignar modelos_lio_items evitando colisiones (modelo_lio_id, dioptria, torico_valor)
                UPDATE public.modelos_lio_items dup_it
                SET modelo_lio_id = v_canon_rec.id, updated_at = now()
                WHERE dup_it.modelo_lio_id = v_dup_rec.id
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.modelos_lio_items canon_it
                      WHERE canon_it.modelo_lio_id = v_canon_rec.id
                        AND canon_it.dioptria = dup_it.dioptria
                        AND COALESCE(canon_it.torico_valor, '') = COALESCE(dup_it.torico_valor, '')
                  );

                UPDATE public.catalogo_maestro_gtin
                SET modelo_lio_id = v_canon_rec.id, updated_at = now()
                WHERE modelo_lio_id = v_dup_rec.id;

                UPDATE public.modelos_lio
                SET activo = FALSE, updated_at = now()
                WHERE id = v_dup_rec.id;
            END LOOP;
        END IF;
    END LOOP;

    -- Asegurar que familias con ítems tóricos tengan admite_toricos = TRUE
    UPDATE public.modelos_lio m
    SET admite_toricos = TRUE, updated_at = now()
    WHERE COALESCE(m.admite_toricos, FALSE) = FALSE
      AND EXISTS (
          SELECT 1
          FROM public.modelos_lio_items i
          WHERE i.modelo_lio_id = m.id
            AND i.es_torico = TRUE
      );

    -- 3. Hidratación inicial de condicion_toricidad y familias_lio_ids en nomenclador_practicas
    UPDATE public.nomenclador_practicas
    SET condicion_toricidad = CASE
        WHEN UPPER(codigo) IN ('MULTIFOCAL', 'EXPAND') THEN 'ambos'
        WHEN UPPER(nombre) LIKE '%TORIC%'
          OR UPPER(nombre) LIKE '%TÓRIC%'
          OR UPPER(codigo) LIKE '%TORIC%'
          OR UPPER(codigo) IN ('CLAREONT', 'TRIFOCALT', 'VIVTYT', 'ICLHT', 'ICLT')
          OR (
              (UPPER(categoria) LIKE '%LENTE%' OR UPPER(categoria) LIKE '%LIO%')
              AND UPPER(codigo) ~ 'T$'
          )
        THEN 'torico'
        ELSE 'esferico'
    END
    WHERE UPPER(COALESCE(categoria, '')) LIKE '%LENTE%'
       OR UPPER(COALESCE(categoria, '')) LIKE '%LIO%'
       OR UPPER(codigo) IN ('CLAREON', 'CLAREONT', 'TRIFOCAL', 'TRIFOCALT', 'VIVTY', 'VIVTYT', 'MULTIFOCAL', 'EXPAND', 'MONOFOCAL');

    SELECT id INTO v_clareon_mono FROM public.modelos_lio WHERE UPPER(modelo) LIKE '%CLAREON MONOFOCAL%' AND activo = TRUE LIMIT 1;
    SELECT id INTO v_panoptix_comun FROM public.modelos_lio WHERE UPPER(modelo) LIKE '%PANOPTIX%' AND UPPER(modelo) NOT LIKE '%PRO%' AND activo = TRUE LIMIT 1;
    SELECT id INTO v_panoptix_pro FROM public.modelos_lio WHERE UPPER(modelo) LIKE '%PANOPTIX PRO%' AND activo = TRUE LIMIT 1;
    SELECT id INTO v_vivity FROM public.modelos_lio WHERE UPPER(modelo) LIKE '%CLAREON VIVITY%' AND activo = TRUE LIMIT 1;
    SELECT id INTO v_sa60at FROM public.modelos_lio WHERE UPPER(modelo) LIKE '%SA60AT%' AND activo = TRUE LIMIT 1;

    IF v_clareon_mono IS NOT NULL THEN
        UPDATE public.nomenclador_practicas
        SET familias_lio_ids = jsonb_build_array(v_clareon_mono::text)
        WHERE UPPER(codigo) IN ('CLAREON', 'CLAREONT')
          AND (familias_lio_ids IS NULL OR jsonb_array_length(familias_lio_ids) = 0);
    END IF;

    IF v_panoptix_comun IS NOT NULL THEN
        UPDATE public.nomenclador_practicas
        SET familias_lio_ids = jsonb_build_array(v_panoptix_comun::text)
        WHERE UPPER(codigo) IN ('TRIFOCAL', 'TRIFOCALT')
          AND (familias_lio_ids IS NULL OR jsonb_array_length(familias_lio_ids) = 0);
    END IF;

    IF v_vivity IS NOT NULL THEN
        UPDATE public.nomenclador_practicas
        SET familias_lio_ids = jsonb_build_array(v_vivity::text)
        WHERE UPPER(codigo) IN ('VIVTY', 'VIVTYT')
          AND (familias_lio_ids IS NULL OR jsonb_array_length(familias_lio_ids) = 0);
    END IF;

    IF v_panoptix_comun IS NOT NULL OR v_panoptix_pro IS NOT NULL OR v_vivity IS NOT NULL THEN
        UPDATE public.nomenclador_practicas
        SET familias_lio_ids = COALESCE((
            SELECT jsonb_agg(x::text)
            FROM unnest(ARRAY[v_panoptix_comun, v_panoptix_pro, v_vivity]) AS x
            WHERE x IS NOT NULL
        ), '[]'::jsonb),
            condicion_toricidad = 'ambos'
        WHERE UPPER(codigo) = 'MULTIFOCAL'
          AND (familias_lio_ids IS NULL OR jsonb_array_length(familias_lio_ids) = 0);
    END IF;

    IF v_sa60at IS NOT NULL THEN
        UPDATE public.nomenclador_practicas
        SET familias_lio_ids = jsonb_build_array(v_sa60at::text)
        WHERE UPPER(codigo) IN ('MONOFOCAL')
          AND (familias_lio_ids IS NULL OR jsonb_array_length(familias_lio_ids) = 0);
    END IF;
END $$;
