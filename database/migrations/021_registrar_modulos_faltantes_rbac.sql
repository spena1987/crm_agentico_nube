-- ====================================================================
-- MIGRACIÓN 021: REGISTRAR MÓDULOS FALTANTES EN RBAC (ESTUDIOS TÉCNICOS Y AYUDA)
-- ====================================================================

-- 1. Actualizar orden de módulos existentes si es necesario y registrar los nuevos
INSERT INTO public.modulos (codigo, nombre, descripcion, icono, orden, activo)
VALUES 
    ('estudios-tecnicos', 'Envío de Estudios (Técnicos)', 'Consola para técnicos oftalmólogos: archivo automático en Geclisa y envío digital por WhatsApp (2da línea exclusiva).', 'Eye', 11, true),
    ('logs', 'Logs & Auditoría', 'Monitor de eventos del sistema, llamadas a APIs externas e incidencias de IA.', 'ScrollText', 12, true),
    ('ajustes', 'Ajustes & Administración', 'Gestión de usuarios del staff, perfiles de roles, permisos y configuraciones.', 'Settings', 13, true),
    ('ayuda', 'Centro de Ayuda & Base de Conocimientos', 'Manual interactivo de usuario, guías operativas, diccionario de campos y resolución de incidencias.', 'HelpCircle', 14, true)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    icono = EXCLUDED.icono,
    orden = EXCLUDED.orden,
    activo = EXCLUDED.activo;

-- 2. Asegurar permisos totales para el rol Administrador en los nuevos módulos
DO $$
DECLARE
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
    IF EXISTS (SELECT 1 FROM public.roles WHERE id = v_admin_id) THEN
        INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
            (v_admin_id, 'estudios-tecnicos', 'ver', true),
            (v_admin_id, 'estudios-tecnicos', 'enviar', true),
            (v_admin_id, 'estudios-tecnicos', 'reenviar', true),
            (v_admin_id, 'ayuda', 'ver', true)
        ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;
    END IF;
END $$;
