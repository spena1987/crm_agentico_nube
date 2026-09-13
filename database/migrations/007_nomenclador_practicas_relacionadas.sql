-- Migracin 007: Tabla de Prcticas Vinculadas y Dependencias Clnicas
CREATE TABLE IF NOT EXISTS public.nomenclador_practicas_relacionadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practica_origen_id UUID NOT NULL REFERENCES public.nomenclador_practicas(id) ON DELETE CASCADE,
    practica_relacionada_id UUID NOT NULL REFERENCES public.nomenclador_practicas(id) ON DELETE RESTRICT,
    tipo_relacion VARCHAR(50) NOT NULL DEFAULT 'anestesia', 
    es_obligatoria BOOLEAN NOT NULL DEFAULT true,
    cantidad_default INTEGER NOT NULL DEFAULT 1,
    orden INTEGER DEFAULT 0,
    notas VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_practica_relacion UNIQUE (practica_origen_id, practica_relacionada_id)
);

CREATE INDEX IF NOT EXISTS idx_npr_origen ON public.nomenclador_practicas_relacionadas(practica_origen_id);
CREATE INDEX IF NOT EXISTS idx_npr_relacionada ON public.nomenclador_practicas_relacionadas(practica_relacionada_id);
