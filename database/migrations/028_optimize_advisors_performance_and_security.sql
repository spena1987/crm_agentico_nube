-- ============================================================================
-- Migración: 028_optimize_advisors_performance_and_security.sql
-- Descripción: Corrección de hallazgos del Supabase Advisor (Performance y Security)
--
-- FASE 1: Corrección de políticas RLS permisivas múltiples en public.configuracion_sistema
-- FASE 2: Creación de índices B-tree de cobertura para 19 Foreign Keys sin indexar
-- FASE 3: Hardening de funciones con search_path mutable y restricción de llamadas RPC públicas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FASE 1: Separar permisos en configuracion_sistema (elimina duplicación de evaluación en SELECT)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir modificacion a autenticados" ON public.configuracion_sistema;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'configuracion_sistema' AND policyname = 'Permitir insercion a autenticados'
    ) THEN
        CREATE POLICY "Permitir insercion a autenticados"
          ON public.configuracion_sistema
          FOR INSERT
          TO authenticated
          WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'configuracion_sistema' AND policyname = 'Permitir actualizacion a autenticados'
    ) THEN
        CREATE POLICY "Permitir actualizacion a autenticados"
          ON public.configuracion_sistema
          FOR UPDATE
          TO authenticated
          USING (true)
          WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'configuracion_sistema' AND policyname = 'Permitir eliminacion a autenticados'
    ) THEN
        CREATE POLICY "Permitir eliminacion a autenticados"
          ON public.configuracion_sistema
          FOR DELETE
          TO authenticated
          USING (true);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- FASE 2: Índices de cobertura para Foreign Keys (19 índices B-tree)
-- ----------------------------------------------------------------------------

-- Módulo Oftalmología / Consultas / Recetas
CREATE INDEX IF NOT EXISTS idx_estudios_oftalmo_consulta_id 
  ON public.estudios_oftalmo (consulta_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_estudios_oftalmo_consulta_id 
  ON public.pedidos_estudios_oftalmo (consulta_id);

CREATE INDEX IF NOT EXISTS idx_recetas_anteojos_oftalmo_consulta_id 
  ON public.recetas_anteojos_oftalmo (consulta_id);

CREATE INDEX IF NOT EXISTS idx_recetas_farmacos_oftalmo_consulta_id 
  ON public.recetas_farmacos_oftalmo (consulta_id);

-- Módulo Quirófano / Turnos
CREATE INDEX IF NOT EXISTS idx_turnos_quirofano_asesoria_id 
  ON public.turnos_quirofano (asesoria_id);

CREATE INDEX IF NOT EXISTS idx_turnos_quirofano_quirofano_id 
  ON public.turnos_quirofano (quirofano_id);

CREATE INDEX IF NOT EXISTS idx_turnos_quirofano_turno_par_id 
  ON public.turnos_quirofano (turno_par_id);

CREATE INDEX IF NOT EXISTS idx_quirofano_bloqueos_quirofano_id 
  ON public.quirofano_bloqueos (quirofano_id);

CREATE INDEX IF NOT EXISTS idx_quirofano_bloques_medicos_quirofano_id 
  ON public.quirofano_bloques_medicos (quirofano_id);

-- Módulo Nomenclador, Presupuestos y Catálogo
CREATE INDEX IF NOT EXISTS idx_nomenclador_practicas_consentimiento_plantilla_id 
  ON public.nomenclador_practicas (consentimiento_plantilla_id);

CREATE INDEX IF NOT EXISTS idx_nomenclador_practicas_plantilla_indicacion_id 
  ON public.nomenclador_practicas (plantilla_indicacion_id);

CREATE INDEX IF NOT EXISTS idx_nomenclador_practicas_preparacion_plantilla_id 
  ON public.nomenclador_practicas (preparacion_plantilla_id);

CREATE INDEX IF NOT EXISTS idx_catalogo_maestro_gtin_modelo_lio_id 
  ON public.catalogo_maestro_gtin (modelo_lio_id);

CREATE INDEX IF NOT EXISTS idx_items_presupuesto_servicio_id 
  ON public.items_presupuesto (servicio_id);

-- Módulo Chat / Pacientes / Roles y Auth
CREATE INDEX IF NOT EXISTS idx_patient_conversations_account_id 
  ON public.patient_conversations (account_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_account_id 
  ON public.whatsapp_messages (account_id);

CREATE INDEX IF NOT EXISTS idx_rol_permisos_modulo_codigo 
  ON public.rol_permisos (modulo_codigo);

CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_rol_id 
  ON public.usuarios_perfil (rol_id);

CREATE INDEX IF NOT EXISTS idx_urgencias_tokens_acceso_paciente_id 
  ON public.urgencias_tokens_acceso (paciente_id);

-- ----------------------------------------------------------------------------
-- FASE 3: Hardening de Funciones (search_path mutable & permisos de ejecución)
-- ----------------------------------------------------------------------------

-- 1. handle_new_user (Trigger de auth.users, revocar exposición RPC pública)
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

-- 2. log_cambio_permisos (Trigger de auditoría RBAC, revocar exposición RPC pública)
ALTER FUNCTION public.log_cambio_permisos() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.log_cambio_permisos() FROM public, anon, authenticated;

-- 3. fn_sync_asesoria_a_turnos_qx (Trigger de sincronización)
ALTER FUNCTION public.fn_sync_asesoria_a_turnos_qx() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.fn_sync_asesoria_a_turnos_qx() FROM public, anon, authenticated;

-- 4. usuario_tiene_permiso (Verificación de RBAC: fijar search_path y restringir acceso a usuarios autenticados)
ALTER FUNCTION public.usuario_tiene_permiso(character varying, character varying) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.usuario_tiene_permiso(character varying, character varying) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_permiso(character varying, character varying) TO authenticated;
