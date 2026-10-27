-- ====================================================================
-- MIGRACIÓN 022: LOGIN POR USERNAME, CAMPO USERNAME Y ENDURECIMIENTO RLS
-- ====================================================================

-- 1. Añadir columna username a public.usuarios_perfil
ALTER TABLE public.usuarios_perfil
    ADD COLUMN IF NOT EXISTS username VARCHAR(64);

-- 2. Poblar usernames iniciales para los usuarios existentes de la clínica
UPDATE public.usuarios_perfil SET username = 'spena' WHERE id = 'db2aa2ad-633b-4fb2-aa81-8c6bf1f81aac' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'ladaro' WHERE id = 'd5384821-604e-4476-8f6a-fbd1c06b0152' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'cmartin' WHERE id = '3d5ef3bd-013f-4aad-a1e4-450afa66c7c2' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'moriolani' WHERE id = 'c1bd85d3-5e8f-461f-acdc-feadd687c0ba' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'hgras' WHERE id = 'f9c3bfc4-1bbf-4240-97ef-93b2c108d9b1' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'gconcina' WHERE id = 'f844c3ce-1b48-4f3f-b310-8547f1e884cb' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'rperez' WHERE id = '2b0dd818-47ef-4c88-a9fc-3f214d311529' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'amanita' WHERE id = '397609ce-0d1d-45a4-9e63-0c0c95fa2528' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'asesoramiento' WHERE id = 'dad585fd-3e38-4521-9c1d-1efc4bbb6b07' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'csibeca' WHERE id = '0bdb6460-4337-4a99-9f30-5f951391320a' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'quirofano' WHERE id = 'c0e6e247-444f-422e-9943-0d8dc16e4f17' AND username IS NULL;
UPDATE public.usuarios_perfil SET username = 'tecnicos' WHERE id = 'e5eed86a-be2e-4d9d-aea5-5f807bbf938a' AND username IS NULL;

-- Fallback para cualquier otro usuario que pudiera existir sin username
UPDATE public.usuarios_perfil
SET username = LOWER(REGEXP_REPLACE(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) || '_' || SUBSTRING(id::text, 1, 4)
WHERE username IS NULL;

-- 3. Crear índice único insensible a mayúsculas/minúsculas para username
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_perfil_username_lower 
    ON public.usuarios_perfil (LOWER(username));

-- 4. Actualizar función trigger handle_new_user para incluir username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_base_username VARCHAR;
    v_final_username VARCHAR;
BEGIN
    v_base_username := LOWER(COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
        REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')
    ));

    IF EXISTS (SELECT 1 FROM public.usuarios_perfil WHERE LOWER(username) = v_base_username) THEN
        v_final_username := v_base_username || '_' || SUBSTRING(NEW.id::text, 1, 4);
    ELSE
        v_final_username := v_base_username;
    END IF;

    INSERT INTO public.usuarios_perfil (id, email, username, nombre_completo, rol_id, activo, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        v_final_username,
        COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((SELECT id FROM public.roles WHERE codigo = 'recepcion' LIMIT 1), 'a0000000-0000-0000-0000-000000000003'::uuid),
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$function$;

-- 5. Endurecimiento de políticas RLS en tablas críticas de seguridad y RBAC
-- 5.1 Roles
ALTER POLICY "Acceso total roles para autenticados" ON public.roles
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK (public.usuario_tiene_permiso('ajustes', 'ver_roles'));

CREATE POLICY "Restriccion escritura roles" ON public.roles
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (public.usuario_tiene_permiso('ajustes', 'ver_roles'));

-- 5.2 Rol Permisos
ALTER POLICY "Acceso total permisos para autenticados" ON public.rol_permisos
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK (public.usuario_tiene_permiso('ajustes', 'ver_roles'));

CREATE POLICY "Restriccion eliminacion permisos" ON public.rol_permisos
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (public.usuario_tiene_permiso('ajustes', 'ver_roles'));

-- 5.3 Usuarios Perfil
ALTER POLICY "Acceso total perfiles para autenticados" ON public.usuarios_perfil
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK (public.usuario_tiene_permiso('ajustes', 'ver_usuarios'));

CREATE POLICY "Restriccion eliminacion perfiles" ON public.usuarios_perfil
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (public.usuario_tiene_permiso('ajustes', 'ver_usuarios'));

-- 5.4 Configuración de Seguridad
ALTER POLICY "Acceso total configuracion_seguridad para autenticados" ON public.configuracion_seguridad
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK (public.usuario_tiene_permiso('ajustes', 'ver_seguridad'));

CREATE POLICY "Restriccion eliminacion configuracion_seguridad" ON public.configuracion_seguridad
    AS RESTRICTIVE FOR DELETE TO authenticated
    USING (public.usuario_tiene_permiso('ajustes', 'ver_seguridad'));
