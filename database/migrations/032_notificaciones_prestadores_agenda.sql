-- Migración 032: Tabla de Auditoría y Trazabilidad de Agendas a Prestadores
CREATE TABLE IF NOT EXISTS public.notificaciones_prestadores_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_cirugia DATE NOT NULL,
    fecha_corte DATE NOT NULL,
    prestador_id TEXT NULL,
    prestador_nombre TEXT NOT NULL,
    telefono_destino TEXT NULL,
    cantidad_cirugias INTEGER NOT NULL DEFAULT 0,
    roles_incluidos TEXT[] NOT NULL DEFAULT '{}',
    estado TEXT NOT NULL CHECK (estado IN ('ENVIADO', 'FALLIDO_SIN_TELEFONO', 'ERROR_META', 'PLANTILLA_NO_APROBADA', 'DERIVADOR_NO_RESOLUBLE')),
    meta_media_id TEXT NULL,
    meta_wamid TEXT NULL,
    pdf_sha256 TEXT NULL,
    turnos_snapshot JSONB NULL,
    error_detalle TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de consulta rápida y auditoría
CREATE INDEX IF NOT EXISTS idx_notif_prest_fecha_cirugia ON public.notificaciones_prestadores_logs (fecha_cirugia);
CREATE INDEX IF NOT EXISTS idx_notif_prest_fecha_corte ON public.notificaciones_prestadores_logs (fecha_corte);
CREATE INDEX IF NOT EXISTS idx_notif_prest_prestador_id ON public.notificaciones_prestadores_logs (prestador_id);

-- Restricción de unicidad para garantizar idempotencia operativa
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_prest_unicidad_envio 
ON public.notificaciones_prestadores_logs (fecha_cirugia, fecha_corte, prestador_id)
WHERE estado = 'ENVIADO';

-- Inserción de configuración por defecto si no existe
INSERT INTO public.configuracion_sistema (clave, valor)
VALUES (
    'notificaciones_cirugias_prestadores',
    '{
        "enabled": true,
        "anticipacion_dias_habiles": 2,
        "hora_corte": "19:00",
        "timezone": "America/Argentina/Buenos_Aires",
        "linea_waba": "estudios",
        "plantilla_nombre": "agenda_quirurgica_prestador",
        "idioma_plantilla": "es_AR",
        "incluir_sabados": false
    }'::jsonb
)
ON CONFLICT (clave) DO NOTHING;
