-- ============================================================================
-- Migración: Categorías Configurables del Nomenclador, Correlación Dual en
--            Geclisa (modelos_lio_elementos_geclisa) y Saneamiento LIO
-- Fecha: 2026-11-16
-- Ref: docs/designs/categorias_nomenclador_correlacion_geclisa_filtrado_lio.md
-- ============================================================================

-- 1. Catálogo configurable de categorías del nomenclador
CREATE TABLE IF NOT EXISTS public.nomenclador_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL UNIQUE,
    es_lio_comercial BOOLEAN NOT NULL DEFAULT FALSE,
    permite_requiere_lente BOOLEAN NOT NULL DEFAULT FALSE,
    es_insumo BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER NOT NULL DEFAULT 100,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nomenclador_categorias_rol_exclusivo_chk
        CHECK ((es_lio_comercial::int + permite_requiere_lente::int + es_insumo::int) <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nomenclador_categorias_nombre_norm
    ON public.nomenclador_categorias (lower(btrim(nombre)));

ALTER TABLE public.nomenclador_categorias ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'nomenclador_categorias'
          AND policyname = 'nomenclador_categorias_authenticated_select'
    ) THEN
        CREATE POLICY nomenclador_categorias_authenticated_select
            ON public.nomenclador_categorias
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'nomenclador_categorias'
          AND policyname = 'nomenclador_categorias_service_role_all'
    ) THEN
        CREATE POLICY nomenclador_categorias_service_role_all
            ON public.nomenclador_categorias
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Sembrado determinista de las 9 categorías canónicas
INSERT INTO public.nomenclador_categorias (slug, nombre, es_lio_comercial, permite_requiere_lente, es_insumo, orden, activo)
VALUES
    ('prestaciones_oftalmologicas', 'Prestaciones Oftalmológicas', FALSE, TRUE,  FALSE, 10, TRUE),
    ('cirugias',                   'Cirugías',                    FALSE, TRUE,  FALSE, 20, TRUE),
    ('lasik',                      'Lasik',                       FALSE, TRUE,  FALSE, 30, TRUE),
    ('lentes_intraoculares',       'Lentes Intraoculares',        TRUE,  FALSE, FALSE, 40, TRUE),
    ('antiangiogenicos',           'Antiangiogénicos',            FALSE, FALSE, TRUE,  50, TRUE),
    ('anestesia',                  'Anestesia',                   FALSE, FALSE, TRUE,  60, TRUE),
    ('materiales_y_elementos',     'Materiales y Elementos',      FALSE, FALSE, TRUE,  70, TRUE),
    ('anillos_intracorneales',     'Anillos Intracorneales',      FALSE, FALSE, TRUE,  80, TRUE),
    ('general',                    'General',                     FALSE, FALSE, FALSE, 90, TRUE)
ON CONFLICT (slug) DO UPDATE
SET nombre = EXCLUDED.nombre,
    es_lio_comercial = EXCLUDED.es_lio_comercial,
    permite_requiere_lente = EXCLUDED.permite_requiere_lente,
    es_insumo = EXCLUDED.es_insumo,
    orden = EXCLUDED.orden,
    activo = TRUE,
    updated_at = now();

-- 2. FK categoria_id en nomenclador_practicas + índices + triggers de sincronización
ALTER TABLE public.nomenclador_practicas
    ADD COLUMN IF NOT EXISTS categoria_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'nomenclador_practicas_categoria_id_fkey'
          AND conrelid = 'public.nomenclador_practicas'::regclass
    ) THEN
        ALTER TABLE public.nomenclador_practicas
            ADD CONSTRAINT nomenclador_practicas_categoria_id_fkey
            FOREIGN KEY (categoria_id)
            REFERENCES public.nomenclador_categorias(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nomenclador_practicas_categoria_activo
    ON public.nomenclador_practicas (categoria_id, activo);

CREATE INDEX IF NOT EXISTS idx_nomenclador_practicas_familias_lio_gin
    ON public.nomenclador_practicas USING GIN (familias_lio_ids);

-- Función auxiliar para resolver nombre/alias de categoría a slug canónico
CREATE OR REPLACE FUNCTION public._resolver_categoria_id_nomenclador(p_categoria TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_norm TEXT := lower(btrim(COALESCE(p_categoria, '')));
    v_slug TEXT;
    v_id   UUID;
BEGIN
    v_slug := CASE v_norm
        WHEN 'prestaciones oftalmológicas' THEN 'prestaciones_oftalmologicas'
        WHEN 'prestaciones oftalmologicas' THEN 'prestaciones_oftalmologicas'
        WHEN 'cirugia'                     THEN 'cirugias'
        WHEN 'cirugía'                     THEN 'cirugias'
        WHEN 'cirugias'                    THEN 'cirugias'
        WHEN 'cirugías'                    THEN 'cirugias'
        WHEN 'lasik'                       THEN 'lasik'
        WHEN 'lentes intraoculares'        THEN 'lentes_intraoculares'
        WHEN 'lente'                       THEN 'lentes_intraoculares'
        WHEN 'lentes'                      THEN 'lentes_intraoculares'
        WHEN 'antigeogenico'               THEN 'antiangiogenicos'
        WHEN 'antiangiogenico'             THEN 'antiangiogenicos'
        WHEN 'antiangiogénico'             THEN 'antiangiogenicos'
        WHEN 'antiangiogenicos'            THEN 'antiangiogenicos'
        WHEN 'antiangiogénicos'            THEN 'antiangiogenicos'
        WHEN 'anestesia'                   THEN 'anestesia'
        WHEN 'material'                    THEN 'materiales_y_elementos'
        WHEN 'elemento'                    THEN 'materiales_y_elementos'
        WHEN 'elementos'                   THEN 'materiales_y_elementos'
        WHEN 'materiales y elementos'      THEN 'materiales_y_elementos'
        WHEN 'anillos'                     THEN 'anillos_intracorneales'
        WHEN 'anillos intracorneales'      THEN 'anillos_intracorneales'
        WHEN 'general'                     THEN 'general'
        ELSE NULL
    END;

    IF v_slug IS NOT NULL THEN
        SELECT id INTO v_id
        FROM public.nomenclador_categorias
        WHERE slug = v_slug
        LIMIT 1;
    END IF;

    IF v_id IS NULL AND v_norm <> '' THEN
        SELECT id INTO v_id
        FROM public.nomenclador_categorias
        WHERE lower(btrim(nombre)) = v_norm
        LIMIT 1;
    END IF;

    IF v_id IS NULL THEN
        SELECT id INTO v_id
        FROM public.nomenclador_categorias
        WHERE slug = 'general'
        LIMIT 1;
    END IF;

    RETURN v_id;
END;
$$;

-- Trigger 1: BEFORE INSERT OR UPDATE en nomenclador_practicas (soporta rollback sin 23502)
CREATE OR REPLACE FUNCTION public.trg_fn_sync_nomenclador_practica_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cat_nombre TEXT;
BEGIN
    IF NEW.categoria_id IS NULL OR (
        TG_OP = 'UPDATE'
        AND pg_trigger_depth() = 1
        AND NEW.categoria IS DISTINCT FROM OLD.categoria
        AND NEW.categoria_id IS NOT DISTINCT FROM OLD.categoria_id
    ) THEN
        NEW.categoria_id := public._resolver_categoria_id_nomenclador(NEW.categoria);
    END IF;

    IF NEW.categoria_id IS NOT NULL THEN
        SELECT nombre INTO v_cat_nombre
        FROM public.nomenclador_categorias
        WHERE id = NEW.categoria_id;

        IF v_cat_nombre IS NOT NULL THEN
            NEW.categoria := v_cat_nombre;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nomenclador_practica_categoria ON public.nomenclador_practicas;
CREATE TRIGGER trg_sync_nomenclador_practica_categoria
    BEFORE INSERT OR UPDATE ON public.nomenclador_practicas
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_sync_nomenclador_practica_categoria();

-- Trigger 2: AFTER UPDATE OF nombre en nomenclador_categorias (propaga renombre)
CREATE OR REPLACE FUNCTION public.trg_fn_propagar_nombre_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
        UPDATE public.nomenclador_practicas
        SET categoria = NEW.nombre,
            updated_at = now()
        WHERE categoria_id = NEW.id
          AND categoria IS DISTINCT FROM NEW.nombre;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_nombre_categoria ON public.nomenclador_categorias;
CREATE TRIGGER trg_propagar_nombre_categoria
    AFTER UPDATE OF nombre ON public.nomenclador_categorias
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_propagar_nombre_categoria();

-- Backfill completo de TODAS las filas (activas e inactivas) en nomenclador_practicas
UPDATE public.nomenclador_practicas p
SET categoria_id = public._resolver_categoria_id_nomenclador(p.categoria),
    updated_at = now()
WHERE p.categoria_id IS NULL
   OR p.categoria IS DISTINCT FROM (
       SELECT c.nombre FROM public.nomenclador_categorias c WHERE c.id = p.categoria_id
   );

ALTER TABLE public.nomenclador_practicas
    ALTER COLUMN categoria_id SET NOT NULL;

-- 3. Saneamiento global de lios_habilitados: remover códigos cuya categoría no es es_lio_comercial (incluye "34091" en FACOREF)
UPDATE public.nomenclador_practicas p
SET lios_habilitados = COALESCE(
        (
            SELECT ARRAY(
                SELECT elem
                FROM unnest(p.lios_habilitados) WITH ORDINALITY AS t(elem, ord)
                JOIN public.nomenclador_practicas lio ON lio.codigo = t.elem
                JOIN public.nomenclador_categorias cat ON cat.id = lio.categoria_id
                WHERE cat.es_lio_comercial = TRUE
                ORDER BY t.ord
            )
        ),
        ARRAY[]::TEXT[]
    ),
    updated_at = now()
WHERE p.lios_habilitados IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM unnest(p.lios_habilitados) AS t(elem)
      LEFT JOIN public.nomenclador_practicas lio ON lio.codigo = t.elem
      LEFT JOIN public.nomenclador_categorias cat ON cat.id = lio.categoria_id
      WHERE lio.id IS NULL OR COALESCE(cat.es_lio_comercial, FALSE) = FALSE
  );

-- Garantizar lios_habilitados = '{}' y requiere_lente = FALSE en prácticas LIO comerciales
UPDATE public.nomenclador_practicas p
SET requiere_lente = FALSE,
    lios_habilitados = ARRAY[]::TEXT[],
    updated_at = now()
FROM public.nomenclador_categorias c
WHERE p.categoria_id = c.id
  AND c.es_lio_comercial = TRUE
  AND (p.requiere_lente IS DISTINCT FROM FALSE OR p.lios_habilitados IS NULL OR cardinality(p.lios_habilitados) > 0);

-- 4. Extensión de modelos_lio + creación de modelos_lio_elementos_geclisa (1:1 por modelo_lio_id, ambito)
ALTER TABLE public.modelos_lio
    ADD COLUMN IF NOT EXISTS naturaleza_clinica TEXT NOT NULL DEFAULT 'pseudofaquico_biometrico',
    ADD COLUMN IF NOT EXISTS requiere_biometria BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'modelos_lio_naturaleza_clinica_chk'
          AND conrelid = 'public.modelos_lio'::regclass
    ) THEN
        ALTER TABLE public.modelos_lio
            ADD CONSTRAINT modelos_lio_naturaleza_clinica_chk
            CHECK (naturaleza_clinica IN ('pseudofaquico_biometrico', 'faquico_icl', 'no_biometrico'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.modelos_lio_elementos_geclisa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modelo_lio_id UUID NOT NULL REFERENCES public.modelos_lio(id) ON DELETE CASCADE,
    geclisa_ele_id INTEGER NOT NULL,
    geclisa_ele_cod TEXT NOT NULL,
    geclisa_nombre TEXT,
    ambito TEXT NOT NULL DEFAULT 'general'
        CHECK (ambito IN ('esferico', 'torico', 'general')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT modelos_lio_elementos_geclisa_modelo_ambito_uniq UNIQUE (modelo_lio_id, ambito)
);

ALTER TABLE public.modelos_lio_elementos_geclisa ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'modelos_lio_elementos_geclisa'
          AND policyname = 'modelos_lio_elementos_geclisa_authenticated_select'
    ) THEN
        CREATE POLICY modelos_lio_elementos_geclisa_authenticated_select
            ON public.modelos_lio_elementos_geclisa
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'modelos_lio_elementos_geclisa'
          AND policyname = 'modelos_lio_elementos_geclisa_service_role_all'
    ) THEN
        CREATE POLICY modelos_lio_elementos_geclisa_service_role_all
            ON public.modelos_lio_elementos_geclisa
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 5. Sembrado determinista en modelos_lio, modelos_lio_elementos_geclisa, merge familias_lio_ids y limpieza 40082
DO $$
DECLARE
    v_icl_miopico_id UUID;
    v_icl_hiper_id   UUID;
    v_expand_id      UUID;
    v_ma60ac_id      UUID;
    v_panoptix_pro   UUID;
    v_panoptix_com   UUID;
    v_vivity         UUID;
    v_sn60wf         UUID;
BEGIN
    -- 5.1 Staar Surgical — ICL Miópico (EVO)
    SELECT id INTO v_icl_miopico_id
    FROM public.modelos_lio
    WHERE lower(btrim(marca)) = 'staar surgical' AND lower(btrim(modelo)) = 'icl miópico (evo)'
    LIMIT 1;

    IF v_icl_miopico_id IS NULL THEN
        INSERT INTO public.modelos_lio (marca, modelo, tipo_optica, constante_a, admite_toricos, apto_sulcus, activo, naturaleza_clinica, requiere_biometria)
        VALUES ('Staar Surgical', 'ICL Miópico (EVO)', 'Fáquico (ICL)', NULL, TRUE, FALSE, TRUE, 'faquico_icl', FALSE)
        RETURNING id INTO v_icl_miopico_id;
    ELSE
        UPDATE public.modelos_lio
        SET admite_toricos = TRUE, apto_sulcus = FALSE, activo = TRUE,
            naturaleza_clinica = 'faquico_icl', requiere_biometria = FALSE, updated_at = now()
        WHERE id = v_icl_miopico_id;
    END IF;

    -- 5.2 Staar Surgical — ICL Hipermetrópico (EVO)
    SELECT id INTO v_icl_hiper_id
    FROM public.modelos_lio
    WHERE lower(btrim(marca)) = 'staar surgical' AND lower(btrim(modelo)) = 'icl hipermetrópico (evo)'
    LIMIT 1;

    IF v_icl_hiper_id IS NULL THEN
        INSERT INTO public.modelos_lio (marca, modelo, tipo_optica, constante_a, admite_toricos, apto_sulcus, activo, naturaleza_clinica, requiere_biometria)
        VALUES ('Staar Surgical', 'ICL Hipermetrópico (EVO)', 'Fáquico (ICL)', NULL, TRUE, FALSE, TRUE, 'faquico_icl', FALSE)
        RETURNING id INTO v_icl_hiper_id;
    ELSE
        UPDATE public.modelos_lio
        SET admite_toricos = TRUE, apto_sulcus = FALSE, activo = TRUE,
            naturaleza_clinica = 'faquico_icl', requiere_biometria = FALSE, updated_at = now()
        WHERE id = v_icl_hiper_id;
    END IF;

    -- 5.3 Genérico / Sulcus — Expand
    SELECT id INTO v_expand_id
    FROM public.modelos_lio
    WHERE lower(btrim(marca)) = 'genérico / sulcus' AND lower(btrim(modelo)) = 'expand'
    LIMIT 1;

    IF v_expand_id IS NULL THEN
        INSERT INTO public.modelos_lio (marca, modelo, tipo_optica, constante_a, admite_toricos, apto_sulcus, activo, naturaleza_clinica, requiere_biometria)
        VALUES ('Genérico / Sulcus', 'Expand', 'Estándar', NULL, FALSE, TRUE, TRUE, 'no_biometrico', FALSE)
        RETURNING id INTO v_expand_id;
    ELSE
        UPDATE public.modelos_lio
        SET admite_toricos = FALSE, apto_sulcus = TRUE, activo = TRUE,
            naturaleza_clinica = 'no_biometrico', requiere_biometria = FALSE, updated_at = now()
        WHERE id = v_expand_id;
    END IF;

    -- 5.4 Alcon — AcrySof IQ 3 Piezas (MA60AC)
    SELECT id INTO v_ma60ac_id
    FROM public.modelos_lio
    WHERE lower(btrim(marca)) = 'alcon' AND lower(btrim(modelo)) = 'acrysof iq 3 piezas (ma60ac)'
    LIMIT 1;

    IF v_ma60ac_id IS NULL THEN
        INSERT INTO public.modelos_lio (marca, modelo, tipo_optica, constante_a, admite_toricos, apto_sulcus, activo, naturaleza_clinica, requiere_biometria)
        VALUES ('Alcon', 'AcrySof IQ 3 Piezas (MA60AC)', 'Monofocal 3 Piezas', 118.4, FALSE, TRUE, TRUE, 'no_biometrico', FALSE)
        RETURNING id INTO v_ma60ac_id;
    ELSE
        UPDATE public.modelos_lio
        SET admite_toricos = FALSE, apto_sulcus = TRUE, activo = TRUE,
            naturaleza_clinica = 'no_biometrico', requiere_biometria = FALSE, updated_at = now()
        WHERE id = v_ma60ac_id;
    END IF;

    -- Elementos Genéricos Geclisa para ICL Miópico, ICL Hipermetrópico y MA60AC (5 tuplas)
    INSERT INTO public.modelos_lio_elementos_geclisa (modelo_lio_id, geclisa_ele_id, geclisa_ele_cod, geclisa_nombre, ambito)
    VALUES
        (v_icl_miopico_id, 39437, 'ICL',       'LENTE FAQUICA ICL',            'esferico'),
        (v_icl_miopico_id, 39438, 'ICLT',      'LENTE FAQUICA ICL TORICO',     'torico'),
        (v_icl_hiper_id,   39437, 'ICL',       'LENTE FAQUICA ICL',            'esferico'),
        (v_icl_hiper_id,   39438, 'ICLT',      'LENTE FAQUICA ICL TORICO',     'torico'),
        (v_ma60ac_id,      39463, 'IQ3 PIEZAS','LENTE ALCON IQ 3 PIEZAS',      'esferico')
    ON CONFLICT (modelo_lio_id, ambito) DO UPDATE
    SET geclisa_ele_id = EXCLUDED.geclisa_ele_id,
        geclisa_ele_cod = EXCLUDED.geclisa_ele_cod,
        geclisa_nombre = EXCLUDED.geclisa_nombre,
        updated_at = now();

    -- 5.5 Elementos genéricos de respaldo en familias biométricas Alcon existentes (7 tuplas)
    SELECT id INTO v_panoptix_pro FROM public.modelos_lio WHERE lower(btrim(modelo)) = 'clareon panoptix pro' LIMIT 1;
    SELECT id INTO v_panoptix_com FROM public.modelos_lio WHERE lower(btrim(modelo)) = 'clareon panoptix común' LIMIT 1;
    SELECT id INTO v_vivity       FROM public.modelos_lio WHERE lower(btrim(modelo)) = 'clareon vivity' LIMIT 1;
    SELECT id INTO v_sn60wf       FROM public.modelos_lio WHERE lower(btrim(modelo)) = 'acrysof iq sn60wf' LIMIT 1;

    IF v_panoptix_pro IS NOT NULL THEN
        INSERT INTO public.modelos_lio_elementos_geclisa (modelo_lio_id, geclisa_ele_id, geclisa_ele_cod, geclisa_nombre, ambito)
        VALUES
            (v_panoptix_pro, 40068, 'GEN-CLAREON P PRO',       'GEN-CLAREON P PRO',       'esferico'),
            (v_panoptix_pro, 40071, 'GEN-CLAREON P PRO TORIC', 'GEN-CLAREON P PRO TORIC', 'torico')
        ON CONFLICT (modelo_lio_id, ambito) DO UPDATE
        SET geclisa_ele_id = EXCLUDED.geclisa_ele_id, geclisa_ele_cod = EXCLUDED.geclisa_ele_cod,
            geclisa_nombre = EXCLUDED.geclisa_nombre, updated_at = now();
    END IF;

    IF v_panoptix_com IS NOT NULL THEN
        INSERT INTO public.modelos_lio_elementos_geclisa (modelo_lio_id, geclisa_ele_id, geclisa_ele_cod, geclisa_nombre, ambito)
        VALUES
            (v_panoptix_com, 39328, 'GEN-PXYWT0', 'GEN-PXYWT0', 'esferico'),
            (v_panoptix_com, 39434, 'PANOPTIXT',  'PANOPTIXT',  'torico')
        ON CONFLICT (modelo_lio_id, ambito) DO UPDATE
        SET geclisa_ele_id = EXCLUDED.geclisa_ele_id, geclisa_ele_cod = EXCLUDED.geclisa_ele_cod,
            geclisa_nombre = EXCLUDED.geclisa_nombre, updated_at = now();
    END IF;

    IF v_vivity IS NOT NULL THEN
        INSERT INTO public.modelos_lio_elementos_geclisa (modelo_lio_id, geclisa_ele_id, geclisa_ele_cod, geclisa_nombre, ambito)
        VALUES
            (v_vivity, 39435, 'VIVITY',       'VIVITY',       'esferico'),
            (v_vivity, 39436, 'GEN-VVIITY T', 'GEN-VVIITY T', 'torico')
        ON CONFLICT (modelo_lio_id, ambito) DO UPDATE
        SET geclisa_ele_id = EXCLUDED.geclisa_ele_id, geclisa_ele_cod = EXCLUDED.geclisa_ele_cod,
            geclisa_nombre = EXCLUDED.geclisa_nombre, updated_at = now();
    END IF;

    IF v_sn60wf IS NOT NULL THEN
        INSERT INTO public.modelos_lio_elementos_geclisa (modelo_lio_id, geclisa_ele_id, geclisa_ele_cod, geclisa_nombre, ambito)
        VALUES
            (v_sn60wf, 39439, 'SY60WF', 'SY60WF', 'esferico')
        ON CONFLICT (modelo_lio_id, ambito) DO UPDATE
        SET geclisa_ele_id = EXCLUDED.geclisa_ele_id, geclisa_ele_cod = EXCLUDED.geclisa_ele_cod,
            geclisa_nombre = EXCLUDED.geclisa_nombre, updated_at = now();
    END IF;

    -- 5.6 Merge idempotente de familias_lio_ids en ICL, ICLT, ICLHE, ICLHT y EXPAND
    UPDATE public.nomenclador_practicas
    SET familias_lio_ids = COALESCE(familias_lio_ids, '[]'::jsonb) || to_jsonb(v_icl_miopico_id::text),
        updated_at = now()
    WHERE codigo IN ('ICL', 'ICLT')
      AND NOT COALESCE(familias_lio_ids, '[]'::jsonb) @> to_jsonb(ARRAY[v_icl_miopico_id::text]);

    UPDATE public.nomenclador_practicas
    SET familias_lio_ids = COALESCE(familias_lio_ids, '[]'::jsonb) || to_jsonb(v_icl_hiper_id::text),
        updated_at = now()
    WHERE codigo IN ('ICLHE', 'ICLHT')
      AND NOT COALESCE(familias_lio_ids, '[]'::jsonb) @> to_jsonb(ARRAY[v_icl_hiper_id::text]);

    UPDATE public.nomenclador_practicas
    SET familias_lio_ids = CASE
            WHEN NOT COALESCE(familias_lio_ids, '[]'::jsonb) @> to_jsonb(ARRAY[v_expand_id::text])
                THEN COALESCE(familias_lio_ids, '[]'::jsonb) || to_jsonb(v_expand_id::text)
            ELSE familias_lio_ids
        END,
        condicion_toricidad = 'esferico',
        updated_at = now()
    WHERE codigo = 'EXPAND';
END $$;

-- 6. Eliminación exacta de la fila desalineada 40082 en modelos_lio_items (preservando 4a071f4e-d7e1-4fc1-ae4f-1b163500aff4)
DELETE FROM public.modelos_lio_items
WHERE id = '1e1d7176-e755-412e-a8ff-cdb68176e5ae'
  AND geclisa_ele_id = 40082;
