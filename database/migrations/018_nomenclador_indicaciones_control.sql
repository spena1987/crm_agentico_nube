-- ====================================================================
-- MIGRACIÓN 018: CONTROL DETERMINÍSTICO DE INDICACIONES EN NOMENCLADOR
-- Permite habilitar/deshabilitar indicaciones por práctica y asociar plantillas o reglas por cirujano
-- ====================================================================

do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'nomenclador_practicas' and column_name = 'habilitar_indicaciones'
    ) then
        alter table public.nomenclador_practicas 
        add column habilitar_indicaciones boolean default false not null;
    end if;

    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'nomenclador_practicas' and column_name = 'indicaciones_reglas_cirujano'
    ) then
        alter table public.nomenclador_practicas 
        add column indicaciones_reglas_cirujano jsonb default '{}'::jsonb;
    end if;
end $$;

-- Si alguna práctica ya tenía plantilla asociada, podemos encender habilitar_indicaciones
update public.nomenclador_practicas
set habilitar_indicaciones = true
where plantilla_indicacion_id is not null or geclisa_pim_id_default is not null;
