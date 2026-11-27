-- Migración: Vinculación clínica manual Geclisa por conversación, trazabilidad de etapas,
-- autocierre diferenciado (24h vs 30d por abandono) + backfill único, y RPCs de bandeja/búsqueda sin truncamiento.

-- 1. Nuevas columnas de override clínico y trazabilidad de etapas en optica_conversaciones
ALTER TABLE public.optica_conversaciones
  ADD COLUMN IF NOT EXISTS paciente_vinculado_ficha_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS paciente_vinculado_nombre TEXT,
  ADD COLUMN IF NOT EXISTS paciente_vinculado_dni VARCHAR(32),
  ADD COLUMN IF NOT EXISTS paciente_vinculado_obra_social TEXT,
  ADD COLUMN IF NOT EXISTS vinculacion_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vinculado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vinculado_por TEXT,
  ADD COLUMN IF NOT EXISTS etapa_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS clasificacion_origen VARCHAR(32) DEFAULT 'inicial';

-- 2. Índices compuestos para acelerar bandeja, ordenamiento y conteo por etapa
CREATE INDEX IF NOT EXISTS idx_optica_conv_bandeja_etapa
  ON public.optica_conversaciones (archivada, estado, etapa_comercial, ultimo_mensaje_at DESC);

CREATE INDEX IF NOT EXISTS idx_optica_conv_bandeja
  ON public.optica_conversaciones (archivada, estado, ultimo_mensaje_at DESC);

-- 3. Saneamiento único de estados, etapas legacy, nombres genéricos y fecha de etapa histórica
UPDATE public.optica_conversaciones
SET estado = 'activa'
WHERE estado = 'abierta';

UPDATE public.optica_conversaciones
SET etapa_comercial = 'SIN_INTERES'
WHERE etapa_comercial = 'DESCARTADO';

UPDATE public.optica_conversaciones
SET etapa_comercial = 'NUEVA_CONSULTA'
WHERE etapa_comercial IS NULL;

UPDATE public.optica_conversaciones c
SET nombre_contacto = oc.nombre
FROM public.optica_contactos oc
WHERE c.contacto_id = oc.id
  AND (c.nombre_contacto IS NULL OR c.nombre_contacto LIKE 'Contacto %')
  AND oc.nombre IS NOT NULL
  AND oc.nombre NOT LIKE 'Contacto %';

UPDATE public.optica_conversaciones
SET etapa_updated_at = COALESCE(ultimo_mensaje_at, created_at, NOW())
WHERE etapa_updated_at IS NULL
   OR etapa_updated_at = updated_at;

-- 4. Backfill único etiquetado: reabrir etapas comerciales en gestión cerradas prematuramente por 24h (< 30 días)
UPDATE public.optica_conversaciones
SET estado = 'activa',
    cerrado_at = NULL,
    cerrado_motivo = NULL,
    metadata_json = COALESCE(metadata_json, '{}'::jsonb) || '{"reabierta_backfill_20261127": true}'::jsonb,
    updated_at = NOW()
WHERE estado = 'cerrada'
  AND archivada = FALSE
  AND cerrado_motivo = 'inactividad_24h'
  AND etapa_comercial IN ('CONSULTA_ARMAZON', 'PRESUPUESTO_AEREOS', 'LENTES_CONTACTO', 'EN_LABORATORIO', 'LISTO_PARA_RETIRAR')
  AND COALESCE(ultimo_mensaje_at, created_at) >= NOW() - INTERVAL '30 days';

-- 5. RPC único de autocierre diferenciado:
--    - 30 días de abandono para etapas en gestión comercial ('abandono_30d')
--    - 24 horas para el resto ('inactividad_24h')
CREATE OR REPLACE FUNCTION public.cerrar_conversaciones_inactivas_24h_optica()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH to_close AS (
        SELECT
            id,
            COALESCE(modo_atencion, CASE WHEN bot_paused THEN 'humano' ELSE 'autonomo' END) AS modo,
            CASE
                WHEN etapa_comercial IN ('CONSULTA_ARMAZON', 'PRESUPUESTO_AEREOS', 'LENTES_CONTACTO', 'EN_LABORATORIO', 'LISTO_PARA_RETIRAR')
                    THEN 'abandono_30d'
                ELSE 'inactividad_24h'
            END AS motivo_cierre
        FROM public.optica_conversaciones
        WHERE estado IN ('activa', 'abierta')
          AND archivada = FALSE
          AND (
              (
                  etapa_comercial IN ('CONSULTA_ARMAZON', 'PRESUPUESTO_AEREOS', 'LENTES_CONTACTO', 'EN_LABORATORIO', 'LISTO_PARA_RETIRAR')
                  AND GREATEST(COALESCE(ultimo_mensaje_at, created_at), COALESCE(etapa_updated_at, created_at)) < NOW() - INTERVAL '30 days'
              )
              OR (
                  (etapa_comercial IS NULL OR etapa_comercial NOT IN ('CONSULTA_ARMAZON', 'PRESUPUESTO_AEREOS', 'LENTES_CONTACTO', 'EN_LABORATORIO', 'LISTO_PARA_RETIRAR'))
                  AND (
                      (ventana_24h_expira_at IS NOT NULL AND ventana_24h_expira_at < NOW())
                      OR (COALESCE(ultimo_mensaje_at, created_at) < NOW() - INTERVAL '24 hours')
                  )
              )
          )
    ),
    updated AS (
        UPDATE public.optica_conversaciones c
        SET estado = 'cerrada',
            modo_atencion_previo = COALESCE(c.modo_atencion_previo, to_close.modo),
            cerrado_at = NOW(),
            cerrado_motivo = to_close.motivo_cierre,
            updated_at = NOW()
        FROM to_close
        WHERE c.id = to_close.id
        RETURNING c.id
    )
    SELECT count(*) INTO v_count FROM updated;
    RETURN COALESCE(v_count, 0);
END;
$$;

-- 6. RPC de contadores por etapa y pestaña sin límite de 1.000 filas de PostgREST
CREATE OR REPLACE FUNCTION public.obtener_contadores_bandeja_optica(
    p_estado TEXT DEFAULT NULL,
    p_archivada BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_etapas JSONB;
    v_total_no_leidos INTEGER;
    v_activas INTEGER;
    v_cerradas INTEGER;
    v_archivadas INTEGER;
BEGIN
    SELECT
        COALESCE(jsonb_object_agg(etapa_key, cnt), '{}'::jsonb),
        COALESCE(SUM(no_leidos_sum), 0)::INTEGER
    INTO v_etapas, v_total_no_leidos
    FROM (
        SELECT
            COALESCE(NULLIF(TRIM(etapa_comercial), ''), 'NUEVA_CONSULTA') AS etapa_key,
            COUNT(*)::INTEGER AS cnt,
            SUM(COALESCE(mensajes_no_leidos, 0))::INTEGER AS no_leidos_sum
        FROM public.optica_conversaciones
        WHERE archivada = p_archivada
          AND (
              p_archivada = TRUE
              OR p_estado IS NULL
              OR TRIM(p_estado) = ''
              OR UPPER(TRIM(p_estado)) IN ('TODAS', 'TODOS', 'ALL')
              OR (LOWER(TRIM(p_estado)) IN ('activa', 'activas', 'abierta') AND estado IN ('activa', 'abierta'))
              OR estado = LOWER(TRIM(p_estado))
          )
        GROUP BY COALESCE(NULLIF(TRIM(etapa_comercial), ''), 'NUEVA_CONSULTA')
    ) sub;

    SELECT
        COUNT(*) FILTER (WHERE archivada = FALSE AND estado IN ('activa', 'abierta'))::INTEGER,
        COUNT(*) FILTER (WHERE archivada = FALSE AND estado = 'cerrada')::INTEGER,
        COUNT(*) FILTER (WHERE archivada = TRUE)::INTEGER
    INTO v_activas, v_cerradas, v_archivadas
    FROM public.optica_conversaciones;

    RETURN jsonb_build_object(
        'etapas_counts', COALESCE(v_etapas, '{}'::jsonb),
        'total_no_leidos', COALESCE(v_total_no_leidos, 0),
        'tab_counts', jsonb_build_object(
            'activas', COALESCE(v_activas, 0),
            'cerradas', COALESCE(v_cerradas, 0),
            'archivadas', COALESCE(v_archivadas, 0)
        )
    );
END;
$$;

-- 7. RPC de búsqueda/listado y paginación en SQL sobre toda la base
CREATE OR REPLACE FUNCTION public.buscar_conversaciones_optica(
    p_estado TEXT DEFAULT 'activa',
    p_archivada BOOLEAN DEFAULT FALSE,
    p_etapa TEXT DEFAULT 'TODAS',
    p_origen TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    conv_row JSONB,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_search TEXT := NULLIF(TRIM(COALESCE(p_search, '')), '');
    v_etapa TEXT := NULLIF(TRIM(COALESCE(p_etapa, '')), '');
    v_origen TEXT := NULLIF(TRIM(COALESCE(p_origen, '')), '');
BEGIN
    RETURN QUERY
    WITH filtradas AS (
        SELECT
            c.*,
            to_jsonb(oc.*) AS oc_json,
            CASE
                WHEN LOWER(COALESCE(c.origen_oportunidad, '')) LIKE '%receta%'
                  OR LOWER(COALESCE(c.origen_oportunidad, '')) IN ('auto_receta_aereos', 'auto_receta_contacto', 'indicacion_lentes_aereos', 'indicacion_lentes_contacto', 'indicacion_ambos')
                    THEN 'DETECCION_RECETA_HOY'
                WHEN LOWER(COALESCE(c.origen_oportunidad, '')) LIKE '%turno%'
                  OR LOWER(COALESCE(c.origen_oportunidad, '')) IN ('auto_turno_descuento', 'turno_proximo_descuento')
                    THEN 'PLACA_TURNO'
                WHEN LOWER(COALESCE(c.origen_oportunidad, '')) LIKE '%campana%'
                  OR LOWER(COALESCE(c.origen_oportunidad, '')) = 'campana_masiva'
                    THEN 'CAMPANA_MARKETING'
                WHEN UPPER(COALESCE(c.origen_oportunidad, '')) IN ('DETECCION_RECETA_HOY', 'PLACA_TURNO', 'CAMPANA_MARKETING', 'ENTRANTE_DIRECTO')
                    THEN UPPER(c.origen_oportunidad)
                ELSE 'ENTRANTE_DIRECTO'
            END AS origen_fe
        FROM public.optica_conversaciones c
        LEFT JOIN public.optica_contactos oc ON oc.id = c.contacto_id
        WHERE c.archivada = p_archivada
          AND (
              p_archivada = TRUE
              OR p_estado IS NULL
              OR TRIM(p_estado) = ''
              OR UPPER(TRIM(p_estado)) IN ('TODAS', 'TODOS', 'ALL')
              OR (LOWER(TRIM(p_estado)) IN ('activa', 'activas', 'abierta') AND c.estado IN ('activa', 'abierta'))
              OR c.estado = LOWER(TRIM(p_estado))
          )
          AND (
              v_etapa IS NULL
              OR UPPER(v_etapa) IN ('TODAS', 'TODOS', 'ALL')
              OR c.etapa_comercial = v_etapa
          )
          AND (
              v_search IS NULL
              OR oc.nombre ILIKE '%' || v_search || '%'
              OR c.telefono ILIKE '%' || v_search || '%'
              OR COALESCE(oc.dni, '') ILIKE '%' || v_search || '%'
              OR COALESCE(oc.obra_social, '') ILIKE '%' || v_search || '%'
              OR COALESCE(oc.codigo_cupon_activo, '') ILIKE '%' || v_search || '%'
              OR COALESCE(c.nombre_contacto, '') ILIKE '%' || v_search || '%'
              OR COALESCE(c.paciente_vinculado_nombre, '') ILIKE '%' || v_search || '%'
              OR COALESCE(c.paciente_vinculado_dni, '') ILIKE '%' || v_search || '%'
          )
    ),
    filtradas_origen AS (
        SELECT *
        FROM filtradas f
        WHERE v_origen IS NULL
           OR UPPER(v_origen) IN ('TODAS', 'TODOS', 'ALL')
           OR f.origen_fe = v_origen
           OR f.origen_oportunidad = v_origen
    ),
    contadas AS (
        SELECT
            fo.*,
            COUNT(*) OVER() AS total_cnt
        FROM filtradas_origen fo
    )
    SELECT
        (
            to_jsonb(cnt.*) - 'oc_json' - 'origen_fe' - 'total_cnt'
            || jsonb_build_object('optica_contactos', COALESCE(cnt.oc_json, '{}'::jsonb))
        ) AS conv_row,
        cnt.total_cnt AS total_count
    FROM contadas cnt
    ORDER BY
        (
            COALESCE((cnt.metadata_json->>'fijado')::BOOLEAN, FALSE)
            OR COALESCE((cnt.metadata_json->>'fijada')::BOOLEAN, FALSE)
            OR COALESCE((cnt.metadata_json->>'is_pinned')::BOOLEAN, FALSE)
        ) DESC,
        cnt.ultimo_mensaje_at DESC NULLS LAST
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;
