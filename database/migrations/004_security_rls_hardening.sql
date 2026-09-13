-- ====================================================================
-- MIGRACIÓN 004: ENDURECIMIENTO DE RLS, AUDITORÍA Y FUNCIONES DE PERMISOS
-- ====================================================================

-- 1. Función de verificación de permisos en PostgreSQL (Security Definer)
CREATE OR REPLACE FUNCTION public.usuario_tiene_permiso(p_modulo varchar, p_accion varchar)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_rol_id UUID;
    v_rol_codigo VARCHAR;
    v_activo BOOLEAN;
    v_permitido BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Consultar rol y estado activo del usuario
    SELECT u.rol_id, r.codigo, u.activo
    INTO v_rol_id, v_rol_codigo, v_activo
    FROM public.usuarios_perfil u
    LEFT JOIN public.roles r ON r.id = u.rol_id
    WHERE u.id = v_user_id;

    -- Si la cuenta no existe o está inactiva, denegar acceso
    IF v_activo IS NOT TRUE THEN
        RETURN false;
    END IF;

    -- Los administradores generales tienen acceso total irrestricto
    IF v_rol_codigo = 'admin' OR v_rol_codigo = 'superadmin' THEN
        RETURN true;
    END IF;

    -- Si no tiene rol asignado, denegar
    IF v_rol_id IS NULL THEN
        RETURN false;
    END IF;

    -- Verificar en la matriz de rol_permisos
    SELECT rp.permitido INTO v_permitido
    FROM public.rol_permisos rp
    WHERE rp.rol_id = v_rol_id
      AND rp.modulo_codigo = p_modulo
      AND rp.accion = p_accion;

    RETURN COALESCE(v_permitido, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Asegurar que las políticas RLS de system_logs respeten los permisos
DROP POLICY IF EXISTS "Lectura de logs para personal autenticado" ON public.system_logs;
DROP POLICY IF EXISTS "Solo administradores y auditores leen logs" ON public.system_logs;

CREATE POLICY "Lectura de logs protegida por RBAC" ON public.system_logs
    FOR SELECT USING (
        public.usuario_tiene_permiso('logs', 'ver')
    );

-- Permitir inserción en system_logs a usuarios autenticados y service_role
DROP POLICY IF EXISTS "Insercion de logs para usuarios autenticados" ON public.system_logs;
CREATE POLICY "Insercion de logs para usuarios autenticados" ON public.system_logs
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' OR auth.role() = 'service_role'
    );

-- 3. Trigger para auditar modificaciones de roles y permisos en system_logs
CREATE OR REPLACE FUNCTION public.log_cambio_permisos()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.system_logs (
        nivel,
        modulo,
        accion,
        mensaje,
        detalles
    ) VALUES (
        'WARNING',
        'SISTEMA',
        'ACTUALIZACION_PERMISOS_RBAC',
        'Se actualizaron permisos de acceso de un rol del sistema.',
        jsonb_build_object(
            'rol_id', COALESCE(NEW.rol_id, OLD.rol_id),
            'modulo_codigo', COALESCE(NEW.modulo_codigo, OLD.modulo_codigo),
            'accion', COALESCE(NEW.accion, OLD.accion),
            'permitido', NEW.permitido,
            'modificado_por', auth.uid()
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_rol_permisos ON public.rol_permisos;
CREATE TRIGGER trg_audit_rol_permisos
    AFTER INSERT OR UPDATE OR DELETE ON public.rol_permisos
    FOR EACH ROW EXECUTE FUNCTION public.log_cambio_permisos();
