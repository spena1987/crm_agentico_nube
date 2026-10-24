-- ====================================================================
-- MIGRACIÓN 017: SISTEMA INTEGRAL DE INDICACIONES MÉDICAS GECLISA + CRM
-- Vinculación Nomenclador -> Indicación Médica -> Emisión Geclisa -> PDF & WhatsApp
-- ====================================================================

-- 1. Tabla de Plantillas de Indicaciones Médicas (Diseñador & Nomenclador)
create table if not exists public.plantillas_indicaciones_crm (
    id uuid primary key default gen_random_uuid(),
    titulo varchar not null,
    categoria varchar default 'Oftalmología',
    geclisa_pim_id integer, -- ID de referencia en Geclisa si proviene o sincroniza con una plantilla Geclisa
    tipo_fase varchar default 'postquirurgico' check (tipo_fase in ('prequirurgico', 'postquirurgico', 'ambos')),
    cuerpo_indicaciones text not null,
    medicamentos jsonb default '[]'::jsonb, -- Array de fármacos: [{"droga": "Gatimicin D", "frecuencia": "c/ 4 horas", "duracion": "7 días", "instrucciones": "Agitar bien"}]
    cuidados_generales text,
    pautas_alarma text,
    activo boolean default true not null,
    config_diseno jsonb default '{
        "color_primario": "#1E3A8A",
        "color_secundario": "#2563EB",
        "mostrar_logo": true,
        "mostrar_qr": true,
        "mostrar_firma": true,
        "titulo_documento": "INDICACIONES MÉDICAS QUIRÚRGICAS",
        "pie_pagina": "Centro Visión - Documento oficial de indicaciones médicas postoperatorias"
    }'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_plantillas_ind_geclisa_pim on public.plantillas_indicaciones_crm(geclisa_pim_id);
create index if not exists idx_plantillas_ind_activo on public.plantillas_indicaciones_crm(activo);

-- 2. Vincular plantilla a las prácticas del Nomenclador
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'nomenclador_practicas' and column_name = 'plantilla_indicacion_id'
    ) then
        alter table public.nomenclador_practicas 
        add column plantilla_indicacion_id uuid references public.plantillas_indicaciones_crm(id) on delete set null;
    end if;

    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'nomenclador_practicas' and column_name = 'geclisa_pim_id_default'
    ) then
        alter table public.nomenclador_practicas 
        add column geclisa_pim_id_default integer;
    end if;
end $$;

-- 3. Tabla de Auditoría y Trazabilidad de Emisiones en Geclisa
create table if not exists public.emisiones_indicaciones_geclisa (
    id uuid primary key default gen_random_uuid(),
    asesoria_id uuid references public.asesorias_quirurgicas(id) on delete cascade not null,
    paciente_id uuid references public.pacientes(id) on delete cascade not null,
    geclisa_im_id integer, -- ID generado en la tabla IndicacionesMedicas de Geclisa
    geclisa_pre_id integer, -- ID del médico cirujano en Geclisa
    medico_nombre varchar,
    medico_matricula varchar,
    practica_codigo varchar,
    practica_nombre varchar,
    texto_indicaciones text,
    pdf_path varchar,
    pdf_url varchar,
    whatsapp_status varchar default 'pendiente' check (whatsapp_status in ('pendiente', 'enviado', 'fallido', 'no_requerido')),
    whatsapp_mensaje_id varchar,
    whatsapp_error text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_emisiones_ind_asesoria on public.emisiones_indicaciones_geclisa(asesoria_id);
create index if not exists idx_emisiones_ind_paciente on public.emisiones_indicaciones_geclisa(paciente_id);
create index if not exists idx_emisiones_ind_geclisa_im on public.emisiones_indicaciones_geclisa(geclisa_im_id);

-- 4. Ampliar asesorias_quirurgicas para trazabilidad directa en expediente
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'asesorias_quirurgicas' and column_name = 'indicacion_geclisa_im_id'
    ) then
        alter table public.asesorias_quirurgicas 
        add column indicacion_geclisa_im_id integer;
    end if;

    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'asesorias_quirurgicas' and column_name = 'indicaciones_texto'
    ) then
        alter table public.asesorias_quirurgicas 
        add column indicaciones_texto text;
    end if;

    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'asesorias_quirurgicas' and column_name = 'indicaciones_emitidas_at'
    ) then
        alter table public.asesorias_quirurgicas 
        add column indicaciones_emitidas_at timestamp with time zone;
    end if;

    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'asesorias_quirurgicas' and column_name = 'indicaciones_pdf_url'
    ) then
        alter table public.asesorias_quirurgicas 
        add column indicaciones_pdf_url varchar;
    end if;
end $$;

-- 5. Habilitar RLS y políticas
alter table public.plantillas_indicaciones_crm enable row level security;
alter table public.emisiones_indicaciones_geclisa enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies 
        where tablename = 'plantillas_indicaciones_crm' and policyname = 'Permitir todo a usuarios autenticados en plantillas_indicaciones_crm'
    ) then
        create policy "Permitir todo a usuarios autenticados en plantillas_indicaciones_crm"
        on public.plantillas_indicaciones_crm for all using (true) with check (true);
    end if;

    if not exists (
        select 1 from pg_policies 
        where tablename = 'emisiones_indicaciones_geclisa' and policyname = 'Permitir todo a usuarios autenticados en emisiones_indicaciones_geclisa'
    ) then
        create policy "Permitir todo a usuarios autenticados en emisiones_indicaciones_geclisa"
        on public.emisiones_indicaciones_geclisa for all using (true) with check (true);
    end if;
end $$;

-- 6. Insertar plantillas predeterminadas de alta calidad clínica oftalmológica
insert into public.plantillas_indicaciones_crm (
    titulo, categoria, geclisa_pim_id, tipo_fase, cuerpo_indicaciones, cuidados_generales, pautas_alarma, medicamentos
) values 
(
    'Facoemulsificación Cataratas - Protocolo General',
    'Cataratas',
    43,
    'postquirurgico',
    'Indicaciones médicas postoperatorias de Cirugía de Catarata (Facoemulsificación con Implante de LIO). Aplicar las gotas oftálmicas según el esquema indicado a partir de la fecha de cirugía.',
    '- No frotar ni refregar el ojo operado bajo ninguna circunstancia.\n- Utilizar el protector ocular transparente o anteojos oscuros para dormir durante la primera semana.\n- Evitar esfuerzos físicos intensos, levantar pesos superiores a 5 kg y agacharse con la cabeza hacia abajo por 10 días.\n- No sumergirse en piscinas, mar o saunas por 30 días.\n- Higiene facial con toalla limpia y sin que ingrese agua directa al ojo.',
    'Consulte de forma INMEDIATA a la guardia ante: dolor ocular intenso que no cede con analgésicos comunes, disminución súbita de la agudeza visual, enrojecimiento ocular marcado o secreción purulenta.',
    '[
        {"droga": "Gatimicin D (Gatifloxacina + Dexametasona)", "dosis": "1 gota", "frecuencia": "Cada 4 horas", "duracion": "7 días", "instrucciones": "Agitar enérgicamente antes de colocar"},
        {"droga": "Berlofen (Ketorolac trometamina)", "dosis": "1 gota", "frecuencia": "Cada 4 horas", "duracion": "7 días", "instrucciones": "Dejar un espacio de 10 minutos respecto a la gota anterior"},
        {"droga": "Berlofen (Segunda semana)", "dosis": "1 gota", "frecuencia": "3 veces al día", "duracion": "7 días adicionales", "instrucciones": "Mantenimiento antiinflamatorio"}
    ]'::jsonb
),
(
    'Cirugía Refractiva (LASIK / PRK) - Protocolo Postoperatorio',
    'Refractiva',
    42,
    'postquirurgico',
    'Indicaciones médicas postoperatorias de Cirugía Refractiva Láser. Cumplir estrictamente con la lubricación e instilación de colirios antibióticos y antiinflamatorios.',
    '- NO frotar los ojos. Parpadear con suavidad.\n- Mantener lágrimas artificiales sin conservantes según necesidad para alivio de la sequedad.\n- Usar anteojos con filtro UV al salir a la intemperie.\n- Evitar el uso de pantallas prolongadas en las primeras 48 horas.',
    'Contactar urgentemente ante desplazamiento del colgajo (flap), dolor pulsátil severo o halos densos con pérdida de nitidez.',
    '[
        {"droga": "Gatifloxacina 0.5% + Dexametasona", "dosis": "1 gota", "frecuencia": "Cada 3 horas", "duracion": "5 días", "instrucciones": "Suspender según indicación médica en control"},
        {"droga": "Lágrimas Artificiales de Hialuronato de Sodio", "dosis": "1 o 2 gotas", "frecuencia": "Cada 2 horas", "duracion": "1 mes", "instrucciones": "Alivia sensación de arenilla y lubrica el epitelio"}
    ]'::jsonb
),
(
    'Ayuno y Preparación Prequirúrgica',
    'Preparación',
    66,
    'prequirurgico',
    'Instrucciones de preparación para ingreso a quirófano y sedación anestésica.',
    '- Ayuno estricto de 8 horas para alimentos sólidos y lácteos.\n- Se permite ingesta de líquidos claros (agua, té con azúcar) hasta 2 horas antes de la citación.\n- Concurrir con camisa o blusa abierta al frente con botones.\n- No colocarse maquillaje, cremas, perfume ni esmalte de uñas.\n- Retirar prótesis dentales removibles, aros, collares y reloj antes de ingresar.\n- Traer estudios prequirúrgicos completos y carnet de cobertura médica.',
    'Si presenta fiebre, resfriado agudo o tos el día previo, notifique de inmediato a la clínica.',
    '[]'::jsonb
)
on conflict do nothing;
