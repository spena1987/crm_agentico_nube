-- ====================================================================
-- MIGRACIÓN 019: ASIGNACIÓN MODULAR 1 A N DE INDICACIONES POR PRÁCTICA
-- Tabla relacional puente nomenclador_practicas_indicaciones
-- ====================================================================

create table if not exists public.nomenclador_practicas_indicaciones (
    id uuid primary key default gen_random_uuid(),
    practica_id uuid not null references public.nomenclador_practicas(id) on delete cascade,
    plantilla_indicacion_id uuid not null references public.plantillas_indicaciones_crm(id) on delete cascade,
    orden integer default 1 not null,
    es_obligatoria boolean default true not null,
    activo boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_npi_practica on public.nomenclador_practicas_indicaciones(practica_id);
create index if not exists idx_npi_plantilla on public.nomenclador_practicas_indicaciones(plantilla_indicacion_id);

alter table public.nomenclador_practicas_indicaciones enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies 
        where tablename = 'nomenclador_practicas_indicaciones' 
        and policyname = 'Permitir todo a usuarios autenticados en nomenclador_practicas_indicaciones'
    ) then
        create policy "Permitir todo a usuarios autenticados en nomenclador_practicas_indicaciones"
        on public.nomenclador_practicas_indicaciones for all using (true) with check (true);
    end if;
end $$;

-- Migrar prácticas que ya tenían una sola plantilla vinculada a la nueva tabla puente
insert into public.nomenclador_practicas_indicaciones (practica_id, plantilla_indicacion_id, orden, es_obligatoria, activo)
select id, plantilla_indicacion_id, 1, true, true
from public.nomenclador_practicas
where plantilla_indicacion_id is not null
  and not exists (
      select 1 from public.nomenclador_practicas_indicaciones npi 
      where npi.practica_id = public.nomenclador_practicas.id 
        and npi.plantilla_indicacion_id = public.nomenclador_practicas.plantilla_indicacion_id
  );
