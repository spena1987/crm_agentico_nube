-- ====================================================================
-- MIGRACIÓN 006: PERMISOS GRANULARES DE AJUSTES Y ROL FARMACIA / LIOS
-- ====================================================================

-- 1. Insertar rol del sistema para Farmacia / Insumos
INSERT INTO public.roles (id, codigo, nombre, descripcion, es_sistema, landing_page)
VALUES (
    'a0000000-0000-0000-0000-000000000006',
    'farmacia',
    'Farmacéutica / Gestión de LIOs',
    'Acceso especializado al catálogo de lentes intraoculares, fórmulas y parámetros de LIO en Ajustes.',
    true,
    '/ajustes?tab=lios'
)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    es_sistema = EXCLUDED.es_sistema,
    landing_page = EXCLUDED.landing_page;

-- 2. Asignación de permisos por defecto para Farmacia y Admin
DO $$
DECLARE
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_farmacia_id UUID := 'a0000000-0000-0000-0000-000000000006';
BEGIN
    -- Rol Farmacia: Ajustes LIOs y Cálculo LIO
    INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
        (v_farmacia_id, 'ajustes', 'ver', true),
        (v_farmacia_id, 'ajustes', 'ver_lios', true),
        (v_farmacia_id, 'ajustes', 'editar_lios', true),
        (v_farmacia_id, 'calculo-lio', 'ver', true)
    ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;

    -- Rol Admin: todas las sub-acciones de ajustes
    INSERT INTO public.rol_permisos (rol_id, modulo_codigo, accion, permitido) VALUES
        (v_admin_id, 'ajustes', 'ver', true),
        (v_admin_id, 'ajustes', 'ver_lios', true),
        (v_admin_id, 'ajustes', 'editar_lios', true),
        (v_admin_id, 'ajustes', 'ver_nomencladores', true),
        (v_admin_id, 'ajustes', 'editar_nomencladores', true),
        (v_admin_id, 'ajustes', 'ver_quirofano', true),
        (v_admin_id, 'ajustes', 'ver_prestadores', true),
        (v_admin_id, 'ajustes', 'ver_quirurgico', true),
        (v_admin_id, 'ajustes', 'ver_clinica', true),
        (v_admin_id, 'ajustes', 'ver_plantilla_presupuesto', true),
        (v_admin_id, 'ajustes', 'ver_whatsapp', true),
        (v_admin_id, 'ajustes', 'ver_plantillas_whatsapp', true),
        (v_admin_id, 'ajustes', 'ver_bot', true),
        (v_admin_id, 'ajustes', 'ver_seguridad', true),
        (v_admin_id, 'ajustes', 'ver_logs', true),
        (v_admin_id, 'ajustes', 'ver_usuarios', true),
        (v_admin_id, 'ajustes', 'ver_roles', true)
    ON CONFLICT (rol_id, modulo_codigo, accion) DO UPDATE SET permitido = true;
END $$;
