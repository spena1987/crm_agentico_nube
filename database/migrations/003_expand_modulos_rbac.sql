-- ====================================================================
-- MIGRACIÓN 003: EXPANSIÓN DEL CATÁLOGO DE MÓDULOS RBAC Y ROL MONITOR QUIRÓFANO
-- ====================================================================

-- 1. Insertar o actualizar los 12 módulos del CRM
INSERT INTO public.modulos (codigo, nombre, descripcion, icono, orden, activo)
VALUES 
    ('dashboard', 'Dashboard General', 'Acceso a métricas globales, actividad del bot y estadísticas generales.', 'LayoutDashboard', 1, true),
    ('agenda-geclisa', 'Agenda Geclisa', 'Turnos, citas sincronizadas con Geclisa y estado de recepción de pacientes.', 'Calendar', 2, true),
    ('chat', 'Chats / WhatsApp', 'Bandeja de entrada multicanal, mensajería en vivo con pacientes y control de IA.', 'MessageSquare', 3, true),
    ('pipeline-quirurgico', 'Asesoramiento / Pipeline', 'Embudo comercial y quirúrgico de pacientes (Kanban lead-to-surgery).', 'TrendingUp', 4, true),
    ('asesoramiento-recepcion', 'Recepción del Día (Asesoría)', 'Control diario de pacientes citados para asesoramiento quirúrgico en sala de espera.', 'UserCheck', 5, true),
    ('programacion-quirurgica', 'Quirófano / Programación', 'Agenda quirúrgica, reserva de quirófanos, asignación de slots y equipos médicos.', 'Building2', 6, true),
    ('quirofano-en-vivo', 'Pizarra en Vivo (Quirófano)', 'Tablero en tiempo real para quirófano, salas de recuperación y monitor TV.', 'Activity', 7, true),
    ('calculo-lio', 'Cálculo de LIO', 'Herramienta biométrica y fórmulas de cálculo de lentes intraoculares para cataratas.', 'Eye', 8, true),
    ('presupuestos', 'Presupuestos Médicos', 'Cotización de tratamientos, aranceles, servicios y generación de PDFs.', 'FileText', 9, true),
    ('pacientes', 'Expedientes de Pacientes', 'Fichas clínicas, antecedentes oftalmológicos, recetas y órdenes de estudios.', 'Users', 10, true),
    ('logs', 'Logs & Auditoría', 'Monitor de eventos del sistema, llamadas a APIs externas e incidencias de IA.', 'ScrollText', 11, true),
    ('ajustes', 'Ajustes & Administración', 'Gestión de usuarios del staff, perfiles de roles, permisos y configuraciones.', 'Settings', 12, true)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    icono = EXCLUDED.icono,
    orden = EXCLUDED.orden,
    activo = EXCLUDED.activo;

-- 2. Insertar nuevo rol de sistema: Monitor de Quirófano
INSERT INTO public.roles (id, codigo, nombre, descripcion, es_sistema)
VALUES (
    'a0000000-0000-0000-0000-000000000005',
    'monitor_quirofano',
    'Monitor de Quirófano (Pizarra)',
    'Perfil dedicado exclusivamente a la pantalla/TV en vivo de quirófano y recuperación, sin acceso al resto del CRM.',
    true
)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    es_sistema = EXCLUDED.es_sistema;

-- 3. Inserción de permisos por defecto para los roles del sistema
-- Función auxiliar para insertar permisos evitando duplicados
DO $$
DECLARE
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_medico_id UUID := 'a0000000-0000-0000-0000-000000000002';
    v_recepcion_id UUID := 'a0000000-0000-0000-0000-000000000003';
    v_auditor_id UUID := 'a0000000-0000-0000-0000-000000000004';
    v_monitor_id UUID := 'a0000000-0000-0000-0000-000000000005';
BEGIN
    -- MONITOR DE QUIRÓFANO: Exclusivamente Pizarra en Vivo
    INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
        (v_monitor_id, 'quirofano-en-vivo', 'ver', true),
        (v_monitor_id, 'quirofano-en-vivo', 'actualizar_estado_paciente', true)
    ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;

    -- MÉDICO: Agenda personal, pipeline, cirugías, cálculo LIO, pacientes completos, presupuestos
    INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
        (v_medico_id, 'agenda-geclisa', 'ver', true),
        (v_medico_id, 'agenda-geclisa', 'sincronizar', true),
        (v_medico_id, 'agenda-geclisa', 'dar_presente', true),
        (v_medico_id, 'pipeline-quirurgico', 'ver', true),
        (v_medico_id, 'pipeline-quirurgico', 'crear', true),
        (v_medico_id, 'pipeline-quirurgico', 'editar', true),
        (v_medico_id, 'pipeline-quirurgico', 'cambiar_etapa', true),
        (v_medico_id, 'pipeline-quirurgico', 'asignar_asesor', true),
        (v_medico_id, 'programacion-quirurgica', 'ver', true),
        (v_medico_id, 'programacion-quirurgica', 'crear', true),
        (v_medico_id, 'programacion-quirurgica', 'editar', true),
        (v_medico_id, 'quirofano-en-vivo', 'ver', true),
        (v_medico_id, 'quirofano-en-vivo', 'actualizar_estado_paciente', true),
        (v_medico_id, 'calculo-lio', 'ver', true),
        (v_medico_id, 'calculo-lio', 'calcular', true),
        (v_medico_id, 'calculo-lio', 'guardar_ficha', true),
        (v_medico_id, 'pacientes', 'recetar_farmacos', true),
        (v_medico_id, 'pacientes', 'recetar_lentes', true),
        (v_medico_id, 'pacientes', 'ordenar_estudios', true)
    ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;

    -- RECEPCIÓN: Agenda general, recepción del día, pipeline de prospectos
    INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
        (v_recepcion_id, 'agenda-geclisa', 'ver', true),
        (v_recepcion_id, 'agenda-geclisa', 'sincronizar', true),
        (v_recepcion_id, 'agenda-geclisa', 'dar_presente', true),
        (v_recepcion_id, 'agenda-geclisa', 'ver_todos_los_medicos', true),
        (v_recepcion_id, 'asesoramiento-recepcion', 'ver', true),
        (v_recepcion_id, 'asesoramiento-recepcion', 'recepcionar_paciente', true),
        (v_recepcion_id, 'asesoramiento-recepcion', 'editar_estado', true),
        (v_recepcion_id, 'pipeline-quirurgico', 'ver', true),
        (v_recepcion_id, 'pipeline-quirurgico', 'crear', true),
        (v_recepcion_id, 'pipeline-quirurgico', 'editar', true)
    ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;

    -- AUDITOR: Solo lectura en todos los módulos operativos y acceso a Logs
    INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
        (v_auditor_id, 'agenda-geclisa', 'ver', true),
        (v_auditor_id, 'agenda-geclisa', 'ver_todos_los_medicos', true),
        (v_auditor_id, 'pipeline-quirurgico', 'ver', true),
        (v_auditor_id, 'asesoramiento-recepcion', 'ver', true),
        (v_auditor_id, 'programacion-quirurgica', 'ver', true),
        (v_auditor_id, 'quirofano-en-vivo', 'ver', true),
        (v_auditor_id, 'calculo-lio', 'ver', true),
        (v_auditor_id, 'logs', 'ver', true),
        (v_auditor_id, 'logs', 'exportar', true)
    ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;

    -- ADMINISTRADOR: Todas las nuevas acciones
    INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido)
    SELECT v_admin_id, m.codigo, a.accion, true
    FROM public.modulos m
    CROSS JOIN (
        VALUES 
            ('ver'), ('crear'), ('editar'), ('eliminar'),
            ('sincronizar'), ('dar_presente'), ('ver_todos_los_medicos'),
            ('cambiar_etapa'), ('asignar_asesor'),
            ('recepcionar_paciente'), ('editar_estado'),
            ('bloquear_slot'), ('actualizar_estado_paciente'),
            ('calcular'), ('guardar_ficha'),
            ('recetar_farmacos'), ('recetar_lentes'), ('ordenar_estudios'),
            ('exportar'), ('intervenir_bot'), ('aprobar_presupuesto')
    ) AS a(accion)
    ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;
END $$;
