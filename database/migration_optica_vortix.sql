-- ============================================================================
-- MIGRACIÓN: MÓDULO INDEPENDIENTE ÓPTICA VORTIX (LÍNEA 3 DE WHATSAPP)
-- Aislamiento 100% de Contactos, Conversaciones, Mensajes, Oportunidades Geclisa
-- y Motor de Campañas / Cola Anti-Bloqueo.
-- ============================================================================

-- 1. CONTACTOS Y PACIENTES DE ÓPTICA VORTIX
CREATE TABLE IF NOT EXISTS public.optica_contactos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ficha_geclisa_id TEXT UNIQUE,
    dni TEXT,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL UNIQUE,
    email TEXT,
    obra_social TEXT,
    etiquetas JSONB DEFAULT '[]'::jsonb,
    graduacion_actual_json JSONB DEFAULT '{}'::jsonb,
    codigo_cupon_activo TEXT,
    opt_out BOOLEAN DEFAULT FALSE,
    opt_out_fecha TIMESTAMPTZ,
    opt_out_motivo TEXT,
    notas TEXT,
    ultimo_turno_geclisa_id TEXT,
    ultimo_turno_fecha TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optica_contactos_telefono ON public.optica_contactos(telefono);
CREATE INDEX IF NOT EXISTS idx_optica_contactos_dni ON public.optica_contactos(dni);
CREATE INDEX IF NOT EXISTS idx_optica_contactos_ficha ON public.optica_contactos(ficha_geclisa_id);

-- 2. CONVERSACIONES DE WHATSAPP (BANDEJA EXCLUSIVA ÓPTICA VORTIX)
CREATE TABLE IF NOT EXISTS public.optica_conversaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contacto_id UUID REFERENCES public.optica_contactos(id) ON DELETE CASCADE,
    telefono TEXT NOT NULL UNIQUE,
    nombre_contacto TEXT,
    estado TEXT DEFAULT 'abierta',
    etapa_comercial TEXT DEFAULT 'NUEVA_CONSULTA',
    ventana_24h_expira_at TIMESTAMPTZ,
    ultimo_mensaje_texto TEXT,
    ultimo_mensaje_at TIMESTAMPTZ DEFAULT NOW(),
    ultimo_mensaje_direccion TEXT,
    mensajes_no_leidos INT DEFAULT 0,
    asignado_a TEXT,
    origen_oportunidad TEXT,
    archivada BOOLEAN DEFAULT FALSE,
    bot_paused BOOLEAN DEFAULT FALSE,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optica_conv_ultimo_msg ON public.optica_conversaciones(ultimo_mensaje_at DESC);
CREATE INDEX IF NOT EXISTS idx_optica_conv_etapa ON public.optica_conversaciones(etapa_comercial);
CREATE INDEX IF NOT EXISTS idx_optica_conv_contacto ON public.optica_conversaciones(contacto_id);

-- 3. MENSAJES DE WHATSAPP (HISTORIAL EXCLUSIVO ÓPTICA VORTIX)
CREATE TABLE IF NOT EXISTS public.optica_mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID NOT NULL REFERENCES public.optica_conversaciones(id) ON DELETE CASCADE,
    contacto_id UUID REFERENCES public.optica_contactos(id) ON DELETE SET NULL,
    wamid TEXT UNIQUE,
    direccion TEXT NOT NULL,
    tipo TEXT DEFAULT 'text',
    contenido TEXT,
    template_name TEXT,
    media_url TEXT,
    media_id TEXT,
    mime_type TEXT,
    estado TEXT DEFAULT 'sent',
    error_code TEXT,
    error_detail TEXT,
    enviado_por TEXT DEFAULT 'sistema',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optica_mensajes_conv ON public.optica_mensajes(conversacion_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_optica_mensajes_wamid ON public.optica_mensajes(wamid);

-- 4. OPORTUNIDADES COMERCIALES DETECTADAS DESDE GECLISA (TURNOS + INDICACIONES DE LENTES)
CREATE TABLE IF NOT EXISTS public.optica_oportunidades_geclisa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contacto_id UUID REFERENCES public.optica_contactos(id) ON DELETE SET NULL,
    dedup_key TEXT NOT NULL UNIQUE,
    tipo_oportunidad TEXT NOT NULL,
    turno_geclisa_id TEXT,
    ficha_geclisa_id TEXT NOT NULL,
    paciente_nombre TEXT NOT NULL,
    dni TEXT,
    telefono TEXT,
    obra_social TEXT,
    fecha_turno TIMESTAMPTZ,
    hora_turno TEXT,
    prestador_id TEXT,
    prestador_nombre TEXT,
    servicio_practica TEXT,
    fuente_deteccion TEXT,
    hc_registro_id TEXT,
    texto_indicacion_detectada TEXT,
    graduacion_json JSONB DEFAULT '{}'::jsonb,
    codigo_beneficio TEXT,
    estado_comercial TEXT DEFAULT 'detectada',
    envio_programado_id UUID,
    notas_optica TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optica_oportunidades_tipo_estado ON public.optica_oportunidades_geclisa(tipo_oportunidad, estado_comercial);
CREATE INDEX IF NOT EXISTS idx_optica_oportunidades_fecha ON public.optica_oportunidades_geclisa(fecha_turno DESC);
CREATE INDEX IF NOT EXISTS idx_optica_oportunidades_ficha ON public.optica_oportunidades_geclisa(ficha_geclisa_id);

-- 5. CAMPAÑAS PROMOCIONALES Y REGLAS DE AUTOMATIZACIÓN
CREATE TABLE IF NOT EXISTS public.optica_campanas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'masiva_segmentada',
    estrategia_envio TEXT DEFAULT 'template_directo',
    template_name TEXT NOT NULL,
    template_language TEXT DEFAULT 'es_AR',
    placa_imagen_url TEXT,
    placa_meta_media_id TEXT,
    variables_mapeo JSONB DEFAULT '[]'::jsonb,
    filtro_audiencia JSONB DEFAULT '{}'::jsonb,
    config_goteo_json JSONB DEFAULT '{"intervalo_min_seg": 15, "intervalo_max_seg": 35, "lote_size": 30, "pausa_lote_min": 5, "hora_inicio": "09:00", "hora_fin": "20:00"}'::jsonb,
    estado TEXT DEFAULT 'borrador',
    programada_para TIMESTAMPTZ,
    total_destinatarios INT DEFAULT 0,
    enviados_count INT DEFAULT 0,
    entregados_count INT DEFAULT 0,
    leidos_count INT DEFAULT 0,
    respondidos_count INT DEFAULT 0,
    vendidos_count INT DEFAULT 0,
    fallidos_count INT DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. COLA DE ENVÍO PROGRAMADO Y GOTEO ANTI-BLOQUEO (THROTTLING QUEUE)
CREATE TABLE IF NOT EXISTS public.optica_envios_programados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campana_id UUID REFERENCES public.optica_campanas(id) ON DELETE CASCADE,
    oportunidad_id UUID REFERENCES public.optica_oportunidades_geclisa(id) ON DELETE SET NULL,
    contacto_id UUID REFERENCES public.optica_contactos(id) ON DELETE CASCADE,
    telefono TEXT NOT NULL,
    dedup_key TEXT UNIQUE,
    origen TEXT NOT NULL,
    template_name TEXT NOT NULL,
    template_language TEXT DEFAULT 'es_AR',
    parameters JSONB DEFAULT '[]'::jsonb,
    header_media_url TEXT,
    header_media_id TEXT,
    prioridad INT DEFAULT 5,
    programado_para TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado TEXT DEFAULT 'pendiente',
    intentos INT DEFAULT 0,
    max_intentos INT DEFAULT 3,
    wamid TEXT,
    error_detalle TEXT,
    enviado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optica_envios_cola ON public.optica_envios_programados(estado, prioridad ASC, programado_para ASC);

-- 7. HABILITAR SUPABASE REALTIME DE FORMA IDEMPOTENTE
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.optica_conversaciones;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.optica_mensajes;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.optica_oportunidades_geclisa;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.optica_campanas;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
