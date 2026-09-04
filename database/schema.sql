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
    moneda varchar(10) default 'ARS' not null check (moneda in ('ARS', 'USD')),
    activo boolean default true not null
);

comment on table public.servicios_precios is 'Catálogo de servicios, tratamientos y consultas médicas de la clínica.';

-- 5. Tabla de Presupuestos
create table public.presupuestos (
    id uuid default gen_random_uuid() primary key,
    paciente_id uuid references public.pacientes(id) on delete cascade not null,
    asesoria_id uuid references public.asesorias_quirurgicas(id) on delete set null,
    estado varchar default 'borrador' not null check (estado in ('borrador', 'enviado', 'aprobado', 'rechazado')),
    total numeric(12, 2) default 0.00 not null check (total >= 0),
    total_ars numeric(12, 2) default 0.00 not null check (total_ars >= 0),
    total_usd numeric(12, 2) default 0.00 not null check (total_usd >= 0),
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
    subtotal numeric(10, 2) not null check (subtotal >= 0),
    moneda varchar(10) default 'ARS' not null check (moneda in ('ARS', 'USD'))
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
-- 6. Configuración de Seguridad y Caducidad de Sesión por Inactividad
-- ====================================================================
create table if not exists public.configuracion_seguridad (
    id uuid primary key default gen_random_uuid(),
    inactividad_minutos integer default 20 not null check (inactividad_minutos >= 0),
    aviso_segundos integer default 60 not null check (aviso_segundos >= 10),
    inactividad_habilitada boolean default true not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.configuracion_seguridad enable row level security;

create policy "Lectura de configuracion_seguridad para usuarios autenticados" on public.configuracion_seguridad
    for select using (auth.role() = 'authenticated');

create policy "Admin gestion total configuracion_seguridad" on public.configuracion_seguridad
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

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
-- 8. Tablas del Sistema Multi-Agente con Directivas Globales y Situacionales
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.agentes_directivas_globales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_clinica TEXT NOT NULL DEFAULT 'Clínica Médica Nube',
    tono_general TEXT NOT NULL DEFAULT 'Profesional, empático, claro y resolutivo en todo momento.',
    guardrails_medicos TEXT NOT NULL DEFAULT 'PROHIBICIÓN ESTRICTA: No des diagnósticos médicos, interpretaciones de síntomas ni prescripciones farmacológicas. Si el paciente consulta sobre síntomas o requiere atención médica urgente, explícale que lo derivarás con un profesional de la salud y utiliza la herramienta de escalamiento.',
    politica_escalamiento TEXT NOT NULL DEFAULT 'Si el paciente solicita hablar con un humano, presenta dudas clínicas complejas o expresa enojo/frustración, invoca de inmediato la herramienta escalar_a_operador_humano indicando el motivo.',
    politica_turnos TEXT DEFAULT 'Para turnos, ofrece un máximo de 2 opciones claras de fecha/horario y confirma nombre y DNI del paciente.',
    politica_presupuestos TEXT DEFAULT 'Para cotizaciones, informa los valores con claridad, formas de pago disponibles y aclara la vigencia del presupuesto.',
    agente_defecto_codigo TEXT NOT NULL DEFAULT 'GENERAL',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agentes_situacionales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    temperatura NUMERIC DEFAULT 0.2,
    directiva_particular TEXT NOT NULL,
    herramientas_habilitadas JSONB DEFAULT '["buscar_disponibilidad_turnos", "crear_borrador_presupuesto", "escalar_a_operador_humano"]'::jsonb,
    criterios_activacion JSONB DEFAULT '[]'::jsonb,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversaciones ADD COLUMN IF NOT EXISTS agente_asignado_codigo TEXT DEFAULT 'AUTO';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS etapa_clinica TEXT DEFAULT 'CONSULTA_GENERAL';

-- ====================================================================
-- 11. Módulo de Asesorías Quirúrgicas y Pipeline de Seguimiento
-- ====================================================================
create table if not exists public.asesorias_quirurgicas (
    id uuid default gen_random_uuid() primary key,
    paciente_id uuid references public.pacientes(id) on delete cascade not null,
    
    -- Profesionales (Geclisa)
    medico_derivador_id integer,
    medico_derivador_nombre varchar,
    medico_derivador_matricula varchar,
    
    medico_cirujano_id integer,
    medico_cirujano_nombre varchar,
    medico_cirujano_matricula varchar,
    
    -- Práctica Médica (Nomenclador)
    practica_codigo varchar,
    practica_nombre varchar not null,
    
    -- Aspectos Económicos
    cobertura_obra_social varchar,
    monto_extra numeric(10, 2) default 0.00,
    moneda_extra varchar default 'ARS' check (moneda_extra in ('ARS', 'USD')),
    presupuesto_id uuid references public.presupuestos(id) on delete set null,
    
    -- Planificación Temporal
    fecha_probable_cirugia date,
    fecha_definitiva_cirugia date,
    
    -- Estado del Pipeline
    estado varchar default 'en_asesoramiento' not null check (
        estado in ('derivado', 'en_asesoramiento', 'en_analisis', 'presupuesto_enviado', 'confirmado', 'operado', 'cancelado')
    ),
    
    -- Propuesta y Situación
    situacion_paciente text,
    motivo_cancelacion text,
    
    -- Lead-to-Surgery & Conversión
    checklist_prequirurgico jsonb default '{
        "presupuesto_aceptado": false,
        "autorizacion_obra_social": false,
        "estudios_laboratorio": false,
        "ecg_riesgo_quirurgico": false,
        "consentimiento_firmado": false,
        "reserva_quirofano": false
    }'::jsonb,
    proxima_accion_fecha date,
    proxima_accion_texto text,
    ultimo_contacto_at timestamp with time zone default timezone('utc'::text, now()),
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_asesorias_paciente on public.asesorias_quirurgicas(paciente_id);
create index if not exists idx_asesorias_estado on public.asesorias_quirurgicas(estado);
create index if not exists idx_asesorias_presupuesto on public.asesorias_quirurgicas(presupuesto_id);
create index if not exists idx_asesorias_proxima_accion on public.asesorias_quirurgicas(proxima_accion_fecha);
create index if not exists idx_asesorias_ultimo_contacto on public.asesorias_quirurgicas(ultimo_contacto_at desc);

-- ====================================================================
-- 12. TABLA DE EVOLUCIONES & BITÁCORA DE ASESORAMIENTO QUIRÚRGICO
-- ====================================================================
create table public.asesoria_evoluciones (
    id uuid default gen_random_uuid() primary key,
    asesoria_id uuid references public.asesorias_quirurgicas(id) on delete cascade not null,
    paciente_id uuid references public.pacientes(id) on delete cascade not null,
    
    -- Autoría y Canal de Contacto
    usuario_id uuid,
    usuario_nombre varchar not null default 'Asesora Quirúrgica',
    tipo_contacto varchar not null default 'llamada' check (
        tipo_contacto in ('llamada', 'whatsapp', 'presencial', 'email', 'interno')
    ),
    
    -- Contenido y Timestamp
    contenido text not null check (length(trim(contenido)) > 0),
    fecha_contacto timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_evoluciones_asesoria on public.asesoria_evoluciones(asesoria_id);
create index if not exists idx_evoluciones_paciente on public.asesoria_evoluciones(paciente_id);
create index if not exists idx_evoluciones_fecha on public.asesoria_evoluciones(fecha_contacto desc);

comment on table public.asesoria_evoluciones is 'Registro cronológico e inmutable de cada contacto y asesoramiento quirúrgico.';

-- ====================================================================
-- 13. CONFIGURACIÓN DEL MÓDULO QUIRÚRGICO & CONVERSIÓN
-- ====================================================================
create table public.configuracion_quirurgica (
    id varchar primary key default 'default',
    sla_dias_alerta integer not null default 3,
    sla_dias_critico integer not null default 6,
    checklist_items jsonb not null default '[
      {"id": "presupuesto_aceptado", "label": "Presupuesto Aceptado / Cotización Aprobada"},
      {"id": "autorizacion_obra_social", "label": "Autorización / Bono de Obra Social Aprobado"},
      {"id": "estudios_laboratorio", "label": "Laboratorio Completo & Coagulograma"},
      {"id": "ecg_riesgo_quirurgico", "label": "ECG & Evaluación Cardiológica (Riesgo Quirúrgico)"},
      {"id": "consentimiento_firmado", "label": "Consentimiento Informado Quirúrgico Firmado"},
      {"id": "reserva_quirofano", "label": "Reserva y Asignación de Quirófano"}
    ]'::jsonb,
    plantillas_whatsapp jsonb not null default '[
      {
        "id": "seguimiento_cotizacion",
        "titulo": "Seguimiento de Cotización / Presupuesto",
        "mensaje": "Hola {paciente}, te contacto del equipo de Asesoramiento Quirúrgico de la clínica. Te escribo para consultar si pudiste revisar la propuesta para tu procedimiento de {cirugia}. Quedo a tu disposición por cualquier duda con las condiciones económicas o coberturas."
      },
      {
        "id": "requisitos_prequirurgicos",
        "titulo": "Guía de Requisitos Prequirúrgicos",
        "mensaje": "Estimado/a {paciente}, para avanzar con la programación de tu cirugía ({cirugia}), te recordamos los estudios requeridos: 1) Análisis de sangre y coagulograma, 2) Electrocardiograma con evaluación de riesgo quirúrgico. Cuando los tengas listos, podés enviárnoslos por este medio."
      },
      {
        "id": "guia_autorizacion",
        "titulo": "Instrucciones de Autorización de Obra Social",
        "mensaje": "Hola {paciente}, para gestionar la cobertura de tu procedimiento ({cirugia}), debes presentar la orden médica en tu obra social/prepaga. Si te solicitan presupuesto membretado o código de nomenclador, avísanos y te lo adjuntamos de inmediato."
      },
      {
        "id": "recordatorio_quirofano",
        "titulo": "Confirmación e Instrucciones de Quirófano",
        "mensaje": "Hola {paciente}, te confirmamos la fecha definitiva de tu cirugía para el día {fecha_definitiva}. Recordá concurrir con 8 horas de ayuno total (líquidos y sólidos), DNI y los estudios prequirúrgicos originales en mano."
      }
    ]'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- 14. CONFIGURACIÓN DEL NOMENCLADOR & PRÁCTICAS CRM
-- ====================================================================
create table if not exists public.configuracion_nomenclador (
    id uuid primary key default gen_random_uuid(),
    nomencladores_activos integer[] default '{1,6}'::integer[] not null,
    geclisa_particular_os_id integer default 8118 not null,
    geclisa_particular_plan_id integer default 215 not null,
    geclisa_area_default varchar default 'A' not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.practicas_crm (
    id uuid primary key default gen_random_uuid(),
    codigo varchar not null,
    nombre varchar not null,
    categoria varchar default 'General',
    precio numeric not null,
    descripcion text,
    requiere_lente boolean default false,
    activo boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.practicas_precios_override (
    id uuid primary key default gen_random_uuid(),
    nom_id integer not null,
    nom_cod varchar not null,
    nombre_referencia varchar not null,
    precio_override numeric not null,
    observacion text,
    activo boolean default true not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- 15. SESIONES DE WHATSAPP (PERSISTENCIA POSTGRES)
-- ====================================================================
create table if not exists public.whatsapp_sessions (
    key varchar primary key,
    value jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- 16. MÓDULO DE QUIRÓFANOS & PROGRAMACIÓN QUIRÚRGICA
-- ====================================================================
create table if not exists public.configuracion_quirofano (
    id varchar primary key default 'default',
    hora_apertura_general varchar default '08:00',
    hora_cierre_general varchar default '15:00',
    slot_intervalo_general integer default 10,
    vigencia_enlace_horas integer default 72,
    duraciones_prestaciones jsonb default '{"lasik": 15, "inyeccion": 10, "vitrectomia": 60, "catarata_faco": 20, "catarata_compleja": 30}'::jsonb,
    plantillas_consentimiento jsonb default '[]'::jsonb,
    whatsapp_mensaje_envio text default 'Hola {paciente}, confirmamos tu turno de cirugía de {cirugia} ({ojo_intervenido}) para el día {fecha_cirugia} a las {hora_cirugia} hs con el Dr. {cirujano}. Por favor, revisá y firmá tu Consentimiento Informado en tu celular desde el siguiente enlace seguro: {enlace_firma}',
    whatsapp_mensaje_confirmacion text default '¡Muchas gracias {paciente}! Hemos registrado tu consentimiento firmado digitalmente para tu cirugía del {fecha_cirugia}. Recordá concurrir con 8 horas de ayuno total (líquidos y sólidos).',
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.quirofanos (
    id uuid primary key default gen_random_uuid(),
    nombre varchar not null,
    codigo varchar not null unique,
    color varchar default '#3B82F6',
    orden integer default 0,
    duracion_slot_minutos integer default 15,
    hora_inicio varchar default '08:00',
    hora_fin varchar default '14:00',
    dias_operativos jsonb default '[1, 2, 3, 4, 5]'::jsonb,
    activo boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.quirofano_bloques_medicos (
    id uuid primary key default gen_random_uuid(),
    quirofano_id uuid references public.quirofanos(id) on delete cascade not null,
    medico_id integer not null,
    medico_nombre varchar not null,
    dia_semana integer not null check (dia_semana between 1 and 7),
    hora_desde time not null,
    hora_hasta time not null,
    activo boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.quirofano_bloqueos (
    id uuid primary key default gen_random_uuid(),
    quirofano_id uuid references public.quirofanos(id) on delete cascade not null,
    fecha date not null,
    hora_desde time not null,
    hora_hasta time not null,
    motivo varchar not null,
    descripcion text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- 17. PRESTADORES MÉDICOS & PROFESIONALES
-- ====================================================================
create table if not exists public.prestadores (
    id uuid primary key default gen_random_uuid(),
    matricula varchar,
    nombre_apellido varchar not null,
    rol varchar not null,
    telefono varchar,
    email varchar,
    activo boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- ====================================================================
-- 18. PLANTILLAS DE PREPARACIONES Y CONSENTIMIENTOS
-- ====================================================================
create table if not exists public.plantillas_preparaciones (
    id uuid primary key default gen_random_uuid(),
    titulo varchar not null,
    categoria varchar default 'Oftalmología',
    texto_indicaciones text not null,
    ayuno_horas integer default 8,
    dias_previos_aviso integer default 2,
    observaciones text,
    activo boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.plantillas_consentimientos (
    id uuid primary key default gen_random_uuid(),
    titulo varchar not null,
    especialidad varchar default 'Oftalmología',
    cuerpo_legal text not null,
    version varchar default '1.0' not null,
    activo boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- 19. TURNOS DE QUIRÓFANO & TRAZABILIDAD INTRAOPERATORIA
-- ====================================================================
create table if not exists public.turnos_quirofano (
    id uuid primary key default gen_random_uuid(),
    asesoria_id uuid references public.asesorias_quirurgicas(id) on delete set null,
    paciente_id uuid references public.pacientes(id) on delete cascade not null,
    quirofano_id uuid references public.quirofanos(id) on delete restrict not null,
    fecha_cirugia date not null,
    hora_inicio time not null,
    duracion_minutos integer default 20 not null,
    ojo varchar not null,
    es_bilateral_escalonada boolean default false,
    turno_par_id uuid,
    cirujano_id integer,
    cirujano_nombre varchar not null,
    ayudante_nombre varchar,
    anestesiologo_nombre varchar,
    instrumentador_nombre varchar,
    medico_derivador_nombre varchar,
    practica_codigo varchar,
    practica_nombre varchar not null,
    codigo_obra_social varchar,
    obra_social varchar default 'Particular',
    plan_obra_social varchar,
    token_autorizacion varchar,
    tipo_anestesia varchar default 'Local Asistida',
    checks_adicionales jsonb default '{"uti": false, "biopsia": false, "arco_en_c": false, "monitoreo": true, "tratamiento_dolor": false, "ficha_prequirurgica": false}'::jsonb,
    estado varchar default 'programado',
    codigo_turno varchar,
    
    -- Lente Intraocular (LIO)
    lleva_lente boolean default false,
    es_torico boolean default false,
    lente_tipo varchar,
    lente_dioptria varchar,
    lente_lote varchar,
    lente_serie varchar,
    lente_torico_valor integer,
    lente_torico_eje integer,
    lente_vencimiento date,
    lente_foto_url text,
    lio_calculado boolean default false,
    lio_calculado_at timestamp with time zone,
    lio_calculado_por text,
    lio_calculo_opciones jsonb default '[]'::jsonb,
    lio_stock_reservado boolean default false,
    lio_stock_reservado_at timestamp with time zone,
    lio_stock_observaciones text,
    lio_opcion_implantada_id text,
    
    -- Trazabilidad y Quirófano en Vivo
    llegada_at timestamp with time zone,
    ingreso_pre_quirofano_at timestamp with time zone,
    inicio_cirugia_at timestamp with time zone,
    fin_cirugia_at timestamp with time zone,
    observaciones text,
    observaciones_intraoperatorias text,
    checklist_seguridad_quirurgica jsonb default '{}'::jsonb,
    parte_quirurgico_pdf_url text,
    parte_quirurgico_geclisa_archivo_id integer,
    parte_quirurgico_geclisa_sincronizado_at timestamp with time zone,
    
    -- Consentimiento Informado Digital
    consentimiento_estado varchar default 'pendiente_envio',
    consentimiento_token varchar,
    consentimiento_pdf_url text,
    consentimiento_enviado_at timestamp with time zone,
    consentimiento_firmado_at timestamp with time zone,
    consentimiento_firma_ip varchar,
    consentimiento_firma_img text,
    consentimiento_geclisa_archivo_id integer,
    consentimiento_geclisa_sincronizado_at timestamp with time zone,
    
    usuario_alta varchar,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_turnos_quirofano_fecha on public.turnos_quirofano(fecha_cirugia);
create index if not exists idx_turnos_quirofano_paciente on public.turnos_quirofano(paciente_id);
create index if not exists idx_turnos_quirofano_quirofano on public.turnos_quirofano(quirofano_id);
create index if not exists idx_turnos_quirofano_token on public.turnos_quirofano(consentimiento_token);

-- ====================================================================
-- 20. CATÁLOGO MAESTRO LIO & GTIN ALCON
-- ====================================================================
create table if not exists public.modelos_lio (
    id uuid primary key default gen_random_uuid(),
    marca varchar not null,
    modelo varchar not null,
    tipo_optica varchar default 'Monofocal',
    descripcion text,
    constante_a numeric default 118.9,
    acd_estimado numeric default 5.0,
    rango_dioptrias_min numeric default 10.0,
    rango_dioptrias_max numeric default 30.0,
    paso_dioptrias numeric default 0.5,
    admite_toricos boolean default false,
    apto_sulcus boolean default false,
    deposito_defecto_id integer default 1,
    activo boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists public.modelos_lio_items (
    id uuid primary key default gen_random_uuid(),
    modelo_lio_id uuid references public.modelos_lio(id) on delete cascade not null,
    geclisa_ele_id integer not null,
    geclisa_ele_cod text not null,
    geclisa_nombre text,
    dioptria numeric not null,
    es_torico boolean default false,
    torico_valor text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists public.catalogo_maestro_gtin (
    id uuid primary key default gen_random_uuid(),
    gtin_14 varchar not null,
    gtin_12 varchar,
    marca varchar default 'Alcon' not null,
    nombre_producto text not null,
    internacional varchar,
    categoria varchar default 'LIO' not null,
    familia_nombre varchar,
    modelo_lio_id uuid references public.modelos_lio(id) on delete set null,
    tipo_optica varchar,
    dioptria numeric,
    es_torico boolean default false not null,
    torico_valor varchar,
    constante_a numeric default 118.9,
    acd_estimado numeric default 5.0,
    geclisa_ele_id integer,
    geclisa_ele_cod varchar,
    origen varchar default 'MANUAL' not null,
    observaciones text,
    activo boolean default true not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create index if not exists idx_catalogo_gtin_14 on public.catalogo_maestro_gtin(gtin_14);
create index if not exists idx_catalogo_gtin_dioptria on public.catalogo_maestro_gtin(dioptria);

-- ====================================================================
-- RLS POLICIES PARA LAS NUEVAS TABLAS
-- ====================================================================
alter table public.configuracion_nomenclador enable row level security;
alter table public.practicas_crm enable row level security;
alter table public.practicas_precios_override enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.configuracion_quirofano enable row level security;
alter table public.quirofanos enable row level security;
alter table public.quirofano_bloques_medicos enable row level security;
alter table public.quirofano_bloqueos enable row level security;
alter table public.prestadores enable row level security;
alter table public.plantillas_preparaciones enable row level security;
alter table public.plantillas_consentimientos enable row level security;
alter table public.turnos_quirofano enable row level security;
alter table public.modelos_lio enable row level security;
alter table public.modelos_lio_items enable row level security;
alter table public.catalogo_maestro_gtin enable row level security;

create policy "Acceso total personal autenticado en quirofanos" on public.quirofanos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Acceso total personal autenticado en turnos_quirofano" on public.turnos_quirofano for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Acceso total personal autenticado en prestadores" on public.prestadores for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Acceso total personal autenticado en modelos_lio" on public.modelos_lio for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Lectura publica catalogo GTIN" on public.catalogo_maestro_gtin for select using (true);
create policy "Lectura publica plantillas consentimiento" on public.plantillas_consentimientos for select using (true);

-- ====================================================================
-- SUPABASE REALTIME CONFIGURATION (COMPLETA)
-- ====================================================================
begin;
  alter publication supabase_realtime add table public.conversaciones;
  alter publication supabase_realtime add table public.mensajes;
  alter publication supabase_realtime add table public.presupuestos;
  alter publication supabase_realtime add table public.system_logs;
  alter publication supabase_realtime add table public.agentes_directivas_globales;
  alter publication supabase_realtime add table public.agentes_situacionales;
  alter publication supabase_realtime add table public.asesorias_quirurgicas;
  alter publication supabase_realtime add table public.asesoria_evoluciones;
  alter publication supabase_realtime add table public.configuracion_quirurgica;
  alter publication supabase_realtime add table public.turnos_quirofano;
  alter publication supabase_realtime add table public.quirofanos;
exception when others then
  -- Ignorar advertencias si ya están añadidas
end;

-- ====================================================================
-- HISTORIA CLÍNICA OFTALMOLÓGICA (ESTRUCTURA CLÍNICA INTEGRAL)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.historias_clinicas_oftalmo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL UNIQUE,
    antecedentes_oculares JSONB DEFAULT '[]'::jsonb NOT NULL,
    antecedentes_generales JSONB DEFAULT '[]'::jsonb NOT NULL,
    medicacion_habitual JSONB DEFAULT '[]'::jsonb NOT NULL,
    medicacion_otra TEXT,
    alergias TEXT,
    observaciones_permanentes TEXT,
    extra_catalogos JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_oftalmo_paciente ON public.historias_clinicas_oftalmo(paciente_id);

CREATE TABLE IF NOT EXISTS public.consultas_oftalmo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    historia_id UUID REFERENCES public.historias_clinicas_oftalmo(id) ON DELETE CASCADE NOT NULL,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
    tipo VARCHAR(20) DEFAULT 'consulta' NOT NULL CHECK (tipo IN ('consulta', 'postop')),
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    profesional_nombre VARCHAR(150),
    motivo_consulta TEXT,
    derivado_por VARCHAR(150),
    ocupacion VARCHAR(200),
    observaciones_consulta TEXT,
    agudeza_visual JSONB DEFAULT '{}'::jsonb NOT NULL,
    refraccion JSONB DEFAULT '{}'::jsonb NOT NULL,
    lentes_anteriores JSONB DEFAULT '{}'::jsonb NOT NULL,
    estabilidad_refractiva VARCHAR(100),
    arm_cicloplejia JSONB DEFAULT '{}'::jsonb NOT NULL,
    queratometria JSONB DEFAULT '{}'::jsonb NOT NULL,
    presion_intraocular JSONB DEFAULT '{}'::jsonb NOT NULL,
    lentes_contacto JSONB DEFAULT '{}'::jsonb NOT NULL,
    examen_sensoriomotor JSONB DEFAULT '{}'::jsonb NOT NULL,
    superficie_ocular JSONB DEFAULT '{}'::jsonb NOT NULL,
    biomicroscopia JSONB DEFAULT '{}'::jsonb NOT NULL,
    fondo_ojo JSONB DEFAULT '{}'::jsonb NOT NULL,
    conducta JSONB DEFAULT '{}'::jsonb NOT NULL,
    datos_postop JSONB DEFAULT '{}'::jsonb NOT NULL,
    indicaciones_texto TEXT,
    proximo_control VARCHAR(150),
    notas_internas TEXT,
    resumen_enviado_at TIMESTAMP WITH TIME ZONE,
    videos_enviados JSONB DEFAULT '[]'::jsonb NOT NULL,
    sincronizado_geclisa_at TIMESTAMP WITH TIME ZONE,
    geclisa_archivo_id INTEGER,
    geclisa_as_id INTEGER,
    geclisa_hc_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consultas_oftalmo_historia ON public.consultas_oftalmo(historia_id);
CREATE INDEX IF NOT EXISTS idx_consultas_oftalmo_paciente ON public.consultas_oftalmo(paciente_id);
CREATE INDEX IF NOT EXISTS idx_consultas_oftalmo_fecha ON public.consultas_oftalmo(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_consultas_oftalmo_geclisa_hc_id ON public.consultas_oftalmo(geclisa_hc_id);

CREATE TABLE IF NOT EXISTS public.estudios_oftalmo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
    consulta_id UUID REFERENCES public.consultas_oftalmo(id) ON DELETE SET NULL,
    tipo VARCHAR(100) NOT NULL,
    ojo VARCHAR(5) DEFAULT 'AO' NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    notas TEXT,
    archivo_url TEXT,
    archivo_nombre VARCHAR(255),
    geclisa_archivo_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_estudios_oftalmo_paciente ON public.estudios_oftalmo(paciente_id);

CREATE TABLE IF NOT EXISTS public.recetas_anteojos_oftalmo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
    consulta_id UUID REFERENCES public.consultas_oftalmo(id) ON DELETE SET NULL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    tipo_lente VARCHAR(100),
    tipo_cristal TEXT,
    od_esfera VARCHAR(20),
    od_cilindro VARCHAR(20),
    od_eje VARCHAR(20),
    od_adicion VARCHAR(20),
    oi_esfera VARCHAR(20),
    oi_cilindro VARCHAR(20),
    oi_eje VARCHAR(20),
    oi_adicion VARCHAR(20),
    dnp VARCHAR(50),
    tratamiento VARCHAR(200),
    indicaciones_optico TEXT,
    observaciones TEXT,
    lejos JSONB,
    cerca JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recetas_anteojos_paciente ON public.recetas_anteojos_oftalmo(paciente_id);

CREATE TABLE IF NOT EXISTS public.recetas_farmacos_oftalmo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
    consulta_id UUID REFERENCES public.consultas_oftalmo(id) ON DELETE SET NULL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    diagnostico TEXT,
    items JSONB DEFAULT '[]'::jsonb NOT NULL,
    indicaciones_generales TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recetas_farmacos_paciente ON public.recetas_farmacos_oftalmo(paciente_id);

CREATE TABLE IF NOT EXISTS public.pedidos_estudios_oftalmo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
    consulta_id UUID REFERENCES public.consultas_oftalmo(id) ON DELETE SET NULL,
    lote_id UUID DEFAULT gen_random_uuid() NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    grupo_preset VARCHAR(100),
    titulo VARCHAR(255) NOT NULL,
    items JSONB DEFAULT '[]'::jsonb NOT NULL,
    estudios JSONB,
    ojo VARCHAR(10) DEFAULT 'AO',
    diagnostico TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_estudios_paciente ON public.pedidos_estudios_oftalmo(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estudios_lote ON public.pedidos_estudios_oftalmo(lote_id);



