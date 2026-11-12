-- Migración: Soporte de modo_atencion y función RPC de autocierre por inactividad de 24h
ALTER TABLE public.optica_conversaciones ADD COLUMN IF NOT EXISTS modo_atencion VARCHAR(50) DEFAULT 'autonomo';

CREATE OR REPLACE FUNCTION public.cerrar_conversaciones_inactivas_24h_optica()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH to_close AS (
        SELECT id, COALESCE(modo_atencion, CASE WHEN bot_paused THEN 'humano' ELSE 'autonomo' END) as modo
        FROM public.optica_conversaciones
        WHERE estado IN ('activa', 'abierta')
          AND archivada = FALSE
          AND (
              (ventana_24h_expira_at IS NOT NULL AND ventana_24h_expira_at < NOW())
              OR (ultimo_mensaje_at IS NOT NULL AND ultimo_mensaje_at < NOW() - INTERVAL '24 hours')
              OR (ultimo_mensaje_at IS NULL AND created_at < NOW() - INTERVAL '24 hours')
          )
    ),
    updated AS (
        UPDATE public.optica_conversaciones c
        SET estado = 'cerrada',
            modo_atencion_previo = COALESCE(c.modo_atencion_previo, to_close.modo),
            cerrado_at = NOW(),
            cerrado_motivo = 'inactividad_24h',
            updated_at = NOW()
        FROM to_close
        WHERE c.id = to_close.id
        RETURNING c.id
    )
    SELECT count(*) INTO v_count FROM updated;
    RETURN v_count;
END;
$$;
