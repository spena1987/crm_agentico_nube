-- ====================================================================
-- SCHEMA.SQL: Base de Datos para CRM Médico + Bot Agéntico de WhatsApp
-- ====================================================================

-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- Limpieza preventiva
drop table if exists public.items_presupuesto cascade;
drop table if exists public.presupuestos cascade;
drop table if exists public.servicios_precios cascade;
drop table if exists public.mensajes cascade;
drop table if exists public.conversaciones cascade;
drop table if exists public.pacientes cascade;

-- 1. Tabla de Pacientes
create table public.pacientes (
    id uuid default gen_random_uuid() primary key,
    telefono varchar not null unique, -- JID de WhatsApp (ej: 5491123456789@s.whatsapp.net)
    nombre varchar not null,
    email varchar,
    geclisa_ficha_id integer,
    dni varchar,
    nro_hc varchar,
    obra_social varchar,
    plan_cobertura varchar,
    fecha_nacimiento date,
    sexo varchar,
    direccion text,
    telefono_fijo varchar,
    medico_cabecera varchar,
    historial_notas text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_pacientes_dni on public.pacientes(dni);
create index if not exists idx_pacientes_geclisa_ficha_id on public.pacientes(geclisa_ficha_id);

comment on table public.pacientes is 'Registro de pacientes de la clínica médica.';

-- 2. Tabla de Conversaciones
create table public.conversaciones (
    id uuid default gen_random_uuid() primary key,
    paciente_id uuid references public.pacientes(id) on delete cascade not null unique,
    bot_disabled boolean default false not null, -- True si un operador humano intervino
    ultimo_mensaje text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.conversaciones is 'Estado general de las conversaciones con cada paciente.';

-- 3. Tabla de Mensajes
create table public.mensajes (
    id uuid default gen_random_uuid() primary key,
    conversacion_id uuid references public.conversaciones(id) on delete cascade not null,
    emisor varchar not null check (emisor in ('paciente', 'bot', 'operador')),
    contenido text not null,
    metadata_json jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.mensajes is 'Historial de mensajes de chat enviados y recibidos.';

-- 4. Tabla de Servicios y Precios (Catálogo)
create table public.servicios_precios (
    id uuid default gen_random_uuid() primary key,
    nombre_prestacion varchar not null,
    codigo varchar not null unique, -- Ej: CON-001, RX-002, CIR-003
    precio numeric(10, 2) not null check (precio >= 0),
    activo boolean default true not null
);

comment on table public.servicios_precios is 'Catálogo de servicios, tratamientos y consultas médicas de la clínica.';

-- 5. Tabla de Presupuestos
create table public.presupuestos (
    id uuid default gen_random_uuid() primary key,
    paciente_id uuid references public.pacientes(id) on delete cascade not null,
    estado varchar default 'borrador' not null check (estado in ('borrador', 'enviado', 'aprobado', 'rechazado')),
    total numeric(10, 2) default 0.00 not null check (total >= 0),
    pdf_url varchar,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.presupuestos is 'Cabecera de presupuestos emitidos a pacientes.';

-- 6. Tabla de Detalles del Presupuesto (Items)
create table public.items_presupuesto (
    id uuid default gen_random_uuid() primary key,
    presupuesto_id uuid references public.presupuestos(id) on delete cascade not null,
    servicio_id uuid references public.servicios_precios(id) on delete restrict not null,
    cantidad integer default 1 not null check (cantidad > 0),
    precio_unitario numeric(10, 2) not null check (precio_unitario >= 0),
    subtotal numeric(10, 2) not null check (subtotal >= 0)
);

comment on table public.items_presupuesto is 'Items individuales que componen un presupuesto.';

-- ====================================================================
-- ÍNDICES Y OPTIMIZACIONES
-- ====================================================================
create index idx_pacientes_telefono on public.pacientes(telefono);
create index idx_conversaciones_paciente on public.conversaciones(paciente_id);
create index idx_mensajes_conversacion on public.mensajes(conversacion_id);
create index idx_mensajes_created_at on public.mensajes(created_at desc);
create index idx_presupuestos_paciente on public.presupuestos(paciente_id);
create index idx_items_presupuesto_cabecera on public.items_presupuesto(presupuesto_id);

-- ====================================================================
-- TRIGGERS Y FUNCIONES AUTOMÁTICAS
-- ====================================================================

-- Función para actualizar updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Trigger para conversaciones
create trigger trigger_update_conversaciones_timestamp
    before update on public.conversaciones
    for each row execute function public.handle_updated_at();

-- Función para actualizar el total del presupuesto automáticamente
create or replace function public.recalcular_total_presupuesto()
returns trigger as $$
declare
    v_presupuesto_id uuid;
    v_total numeric(10, 2);
begin
    if (TG_OP = 'DELETE') then
        v_presupuesto_id := old.presupuesto_id;
    else
        v_presupuesto_id := new.presupuesto_id;
    end if;

    select coalesce(sum(subtotal), 0.00)
    into v_total
    from public.items_presupuesto
    where presupuesto_id = v_presupuesto_id;

    update public.presupuestos
    set total = v_total
    where id = v_presupuesto_id;

    return null;
end;
$$ language plpgsql;

-- Triggers para mantener actualizado el total del presupuesto
create trigger trigger_recalcular_total_ins_upd
    after insert or update on public.items_presupuesto
    for each row execute function public.recalcular_total_presupuesto();

create trigger trigger_recalcular_total_del
    after delete on public.items_presupuesto
    for each row execute function public.recalcular_total_presupuesto();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Habilitar RLS en todas las tablas
alter table public.pacientes enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.servicios_precios enable row level security;
alter table public.presupuestos enable row level security;
alter table public.items_presupuesto enable row level security;

-- Políticas para personal autenticado de la clínica (permiso completo)
create policy "Acceso total para personal autenticado" on public.pacientes
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Acceso total para personal autenticado" on public.conversaciones
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Acceso total para personal autenticado" on public.mensajes
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Acceso total para personal autenticado" on public.servicios_precios
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Acceso total para personal autenticado" on public.presupuestos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Acceso total para personal autenticado" on public.items_presupuesto
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Políticas para permitir operaciones anónimas/service_role del Bot (ej: lectura de catálogo)
create policy "Bot/Public Lectura de Servicios" on public.servicios_precios
    for select using (true);

-- ====================================================================
-- DATOS SEMILLA (SERVICIOS)
-- ====================================================================
insert into public.servicios_precios (nombre_prestacion, codigo, precio, activo) values
('Consulta General de Medicina', 'CON-001', 50.00, true),
('Consulta de Especialista (Cardiología)', 'CON-CAR-002', 80.00, true),
('Consulta de Especialista (Pediatría)', 'CON-PED-003', 75.00, true),
('Radiografía de Tórax', 'RX-T-101', 40.00, true),
('Hemograma Completo (Laboratorio)', 'LAB-HEM-201', 25.00, true),
('Ecografía Abdominal', 'ECO-ABD-301', 65.00, true),
('Electrocardiograma (ECG)', 'ECG-401', 30.00, true)
on conflict (codigo) do update set
    nombre_prestacion = excluded.nombre_prestacion,
    precio = excluded.precio;

-- ====================================================================
-- 7. Catálogo de Nomencladores Nativos del CRM (Multi-Moneda: ARS / USD)
-- ====================================================================
create table if not exists public.nomencladores (
    id uuid primary key default gen_random_uuid(),
    codigo varchar(50) unique not null,
    nombre varchar(150) not null,
    moneda_default varchar(10) default 'ARS' not null check (moneda_default in ('ARS', 'USD')),
    descripcion text,
    activo boolean default true not null,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- 8. Prácticas y Prestaciones del Catálogo CRM
-- ====================================================================
create table if not exists public.nomenclador_practicas (
    id uuid primary key default gen_random_uuid(),
    nomenclador_id uuid references public.nomencladores(id) on delete cascade not null,
    codigo varchar(50) not null,
    nombre varchar(255) not null,
    categoria varchar(100) default 'General',
    descripcion text,
    activo boolean default true not null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    constraint uq_nomenclador_practica_cod unique (nomenclador_id, codigo)
);

-- ====================================================================
-- 9. Aranceles con Vigencia Temporal y Multi-Moneda (ARS / USD)
-- ====================================================================
create table if not exists public.nomenclador_aranceles (
    id uuid primary key default gen_random_uuid(),
    practica_id uuid references public.nomenclador_practicas(id) on delete cascade not null,
    precio numeric(12, 2) not null check (precio >= 0),
    moneda varchar(10) default 'ARS' not null check (moneda in ('ARS', 'USD')),
    vigencia_desde date default current_date not null,
    vigencia_hasta date,
    observaciones text,
    activo boolean default true not null,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_nomenclador_practicas_busqueda on public.nomenclador_practicas(codigo, nombre, categoria);
create index if not exists idx_aranceles_practica_vigencia_moneda on public.nomenclador_aranceles(practica_id, vigencia_desde, vigencia_hasta, moneda);

-- Inserción de Nomencladores Base por Moneda (ARS / USD)
insert into public.nomencladores (codigo, nombre, moneda_default, descripcion)
values 
    ('NOM_ARS', 'Nomenclador en Pesos (ARS)', 'ARS', 'Catálogo de prestaciones y prácticas en Pesos Argentinos ($)'),
    ('NOM_USD', 'Nomenclador en Dólares (USD)', 'USD', 'Catálogo de prestaciones y prácticas en Dólares Estadounidenses (USD)')
on conflict (codigo) do update set
    nombre = excluded.nombre,
    moneda_default = excluded.moneda_default;

-- ====================================================================
-- 10. Sistema de Roles, Permisos Granulares y Perfiles RBAC
-- ====================================================================
create table if not exists public.modulos (
    codigo varchar primary key,
    nombre varchar not null,
    descripcion text,
    icono varchar default 'Layout',
    orden integer default 0,
    activo boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.roles (
    id uuid default gen_random_uuid() primary key,
    codigo varchar not null unique,
    nombre varchar not null,
    descripcion text,
    es_sistema boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.rol_permisos (
    id uuid default gen_random_uuid() primary key,
    rol_id uuid references public.roles(id) on delete cascade not null,
    modulo_codigo varchar references public.modulos(codigo) on delete cascade not null,
    accion varchar not null,
    permitido boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint uq_rol_modulo_accion unique (rol_id, modulo_codigo, accion)
);

create table if not exists public.usuarios_perfil (
    id uuid primary key references auth.users(id) on delete cascade,
    email varchar not null,
    nombre_completo varchar not null,
    rol_id uuid references public.roles(id) on delete set null,
    activo boolean default true not null,
    avatar_url varchar,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.modulos enable row level security;
alter table public.roles enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.usuarios_perfil enable row level security;

-- ====================================================================
-- 7. Tabla de Logs de Auditoría y Eventos del Sistema (system_logs)
-- ====================================================================
create table if not exists public.system_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    nivel varchar(20) not null check (nivel in ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    modulo varchar(50) not null check (modulo in ('IA_GEMINI', 'GECLISA', 'WHATSAPP', 'PRESUPUESTOS', 'PACIENTES', 'SISTEMA', 'FRONTEND', 'DATABASE')),
    accion varchar(100) not null,
    mensaje text not null,
    detalles jsonb default '{}'::jsonb not null,
    duracion_ms integer,
    http_status integer,
    paciente_id uuid references public.pacientes(id) on delete set null,
    trace text
);

create index if not exists idx_system_logs_created_at on public.system_logs(created_at desc);
create index if not exists idx_system_logs_nivel on public.system_logs(nivel);
create index if not exists idx_system_logs_modulo on public.system_logs(modulo);
create index if not exists idx_system_logs_paciente_id on public.system_logs(paciente_id);

comment on table public.system_logs is 'Auditoría y registro estructurado de eventos del sistema, llamadas a APIs externas e incidencias.';

-- ====================================================================
-- SUPABASE REALTIME CONFIGURATION
-- ====================================================================
-- Habilitar replicación en tiempo real para mensajería y logs en el CRM
begin;
  alter publication supabase_realtime add table public.conversaciones;
  alter publication supabase_realtime add table public.mensajes;
  alter publication supabase_realtime add table public.system_logs;
exception when others then
  -- Ignorar errores si la publicación o la relación ya existe
end;
