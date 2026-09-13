-- ====================================================================
-- MIGRACIÓN 008: OPTIMIZACIÓN DE POLÍTICAS RLS (INITPLAN Y RENDIMIENTO)
-- ====================================================================
-- Resuelve la advertencia auth_rls_initplan de Supabase Linter (0003_auth_rls_initplan)
-- envolviendo llamadas auth.role() en subconsultas escalares (SELECT auth.role())
-- para que PostgreSQL las evalúe una sola vez (InitPlan) en lugar de fila por fila.
-- Además, consolida políticas duplicadas (0006_multiple_permissive_policies).

-- 1. Pacientes
DROP POLICY IF EXISTS "Acceso total para personal autenticado" ON public.pacientes;
CREATE POLICY "Acceso total para personal autenticado" ON public.pacientes
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 2. Conversaciones
DROP POLICY IF EXISTS "Acceso total para personal autenticado" ON public.conversaciones;
CREATE POLICY "Acceso total para personal autenticado" ON public.conversaciones
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 3. Mensajes
DROP POLICY IF EXISTS "Acceso total para personal autenticado" ON public.mensajes;
CREATE POLICY "Acceso total para personal autenticado" ON public.mensajes
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 4. Servicios y Precios
DROP POLICY IF EXISTS "Acceso total para personal autenticado" ON public.servicios_precios;
CREATE POLICY "Acceso total para personal autenticado" ON public.servicios_precios
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- Asignar política pública exclusivamente al rol anon para evitar políticas permisivas duplicadas en authenticated
ALTER POLICY "Bot/Public Lectura de Servicios" ON public.servicios_precios TO anon;

-- 5. Presupuestos
DROP POLICY IF EXISTS "Acceso total para personal autenticado" ON public.presupuestos;
CREATE POLICY "Acceso total para personal autenticado" ON public.presupuestos
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 6. Items de Presupuesto
DROP POLICY IF EXISTS "Acceso total para personal autenticado" ON public.items_presupuesto;
CREATE POLICY "Acceso total para personal autenticado" ON public.items_presupuesto
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 7. Módulos
DROP POLICY IF EXISTS "Lectura de modulos para usuarios autenticados" ON public.modulos;
CREATE POLICY "Lectura de modulos para usuarios autenticados" ON public.modulos
    FOR SELECT 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated');

-- 8. Roles (Consolidar políticas redundantes ALL + SELECT)
DROP POLICY IF EXISTS "Lectura de roles para usuarios autenticados" ON public.roles;
DROP POLICY IF EXISTS "Admin gestion total roles" ON public.roles;
DROP POLICY IF EXISTS "Acceso total roles para autenticados" ON public.roles;
CREATE POLICY "Acceso total roles para autenticados" ON public.roles
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 9. Rol Permisos (Consolidar políticas redundantes ALL + SELECT)
DROP POLICY IF EXISTS "Lectura de permisos para usuarios autenticados" ON public.rol_permisos;
DROP POLICY IF EXISTS "Admin gestion total permisos" ON public.rol_permisos;
DROP POLICY IF EXISTS "Acceso total permisos para autenticados" ON public.rol_permisos;
CREATE POLICY "Acceso total permisos para autenticados" ON public.rol_permisos
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 10. Usuarios Perfil (Consolidar políticas redundantes ALL + SELECT)
DROP POLICY IF EXISTS "Lectura de perfiles para usuarios autenticados" ON public.usuarios_perfil;
DROP POLICY IF EXISTS "Admin gestion total perfiles" ON public.usuarios_perfil;
DROP POLICY IF EXISTS "Acceso total perfiles para autenticados" ON public.usuarios_perfil;
CREATE POLICY "Acceso total perfiles para autenticados" ON public.usuarios_perfil
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 11. Configuración de Seguridad (Consolidar políticas redundantes ALL + SELECT)
DROP POLICY IF EXISTS "Lectura de configuracion_seguridad para usuarios autenticados" ON public.configuracion_seguridad;
DROP POLICY IF EXISTS "Admin gestion total configuracion_seguridad" ON public.configuracion_seguridad;
DROP POLICY IF EXISTS "Acceso total configuracion_seguridad para autenticados" ON public.configuracion_seguridad;
CREATE POLICY "Acceso total configuracion_seguridad para autenticados" ON public.configuracion_seguridad
    FOR ALL 
    TO authenticated
    USING ((SELECT auth.role()) = 'authenticated') 
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- 12. System Logs (Inserción optimizada con InitPlan)
DROP POLICY IF EXISTS "Insercion de logs para usuarios autenticados" ON public.system_logs;
CREATE POLICY "Insercion de logs para usuarios autenticados" ON public.system_logs
    FOR INSERT 
    TO authenticated, service_role
    WITH CHECK (((SELECT auth.role()) = 'authenticated') OR ((SELECT auth.role()) = 'service_role'));
