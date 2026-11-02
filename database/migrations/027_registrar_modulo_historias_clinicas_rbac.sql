-- ====================================================================
-- MIGRACIÓN 027: REGISTRAR MÓDULO HISTORIAS CLÍNICAS (HCE) EN RBAC
-- ====================================================================

-- 1. Registrar 'historias-clinicas' y sincronizar orden de los 15 módulos del CRM
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
    ('historias-clinicas', 'Historias Clínicas', 'Búsqueda por DNI/Geclisa, expedientes oftalmológicos, evoluciones, recetas y diagnósticos.', 'ClipboardPlus', 10, true),
    ('pacientes', 'Expedientes de Pacientes', 'Fichas clínicas, antecedentes oftalmológicos, recetas y órdenes de estudios.', 'Users', 11, true),
    ('estudios-tecnicos', 'Envío de Estudios (Técnicos)', 'Consola para técnicos oftalmólogos: archivo automático en Geclisa y envío digital por WhatsApp (2da línea exclusiva).', 'Eye', 12, true),
    ('logs', 'Logs & Auditoría', 'Monitor de eventos del sistema, llamadas a APIs externas e incidencias de IA.', 'ScrollText', 13, true),
    ('ajustes', 'Ajustes & Administración', 'Gestión de usuarios del staff, perfiles de roles, permisos y configuraciones.', 'Settings', 14, true),
    ('ayuda', 'Centro de Ayuda & Base de Conocimientos', 'Manual interactivo de usuario, guías operativas, diccionario de campos y resolución de incidencias.', 'HelpCircle', 15, true)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    icono = EXCLUDED.icono,
    orden = EXCLUDED.orden,
    activo = EXCLUDED.activo;

-- 2. Asignar permisos por defecto en 'historias-clinicas' a Administrador y Médico Especialista
DO $$
DECLARE
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_medico_id UUID := 'a0000000-0000-0000-0000-000000000002';
BEGIN
    IF EXISTS (SELECT 1 FROM public.roles WHERE id = v_admin_id) THEN
        INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
            (v_admin_id, 'historias-clinicas', 'ver', true),
            (v_admin_id, 'historias-clinicas', 'buscar', true)
        ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;
    END IF;

    IF EXISTS (SELECT 1 FROM public.roles WHERE id = v_medico_id) THEN
        INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
            (v_medico_id, 'agenda-geclisa', 'ver', true),
            (v_medico_id, 'agenda-geclisa', 'sincronizar', true),
            (v_medico_id, 'agenda-geclisa', 'dar_presente', true),
            (v_medico_id, 'chat', 'ver', true),
            (v_medico_id, 'chat', 'crear', true),
            (v_medico_id, 'chat', 'editar', true),
            (v_medico_id, 'chat', 'intervenir_bot', true),
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
            (v_medico_id, 'presupuestos', 'ver', true),
            (v_medico_id, 'presupuestos', 'crear', true),
            (v_medico_id, 'presupuestos', 'editar', true),
            (v_medico_id, 'presupuestos', 'exportar', true),
            (v_medico_id, 'historias-clinicas', 'ver', true),
            (v_medico_id, 'historias-clinicas', 'buscar', true),
            (v_medico_id, 'pacientes', 'ver', true),
            (v_medico_id, 'pacientes', 'crear', true),
            (v_medico_id, 'pacientes', 'editar', true),
            (v_medico_id, 'pacientes', 'recetar_farmacos', true),
            (v_medico_id, 'pacientes', 'recetar_lentes', true),
            (v_medico_id, 'pacientes', 'ordenar_estudios', true),
            (v_medico_id, 'ayuda', 'ver', true)
        ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;
    END IF;
END $$;
