-- Índice para acelerar consultas por rango de fechas en bloqueos de quirófano
CREATE INDEX IF NOT EXISTS idx_quirofano_bloqueos_fecha
    ON public.quirofano_bloqueos (fecha, quirofano_id);
