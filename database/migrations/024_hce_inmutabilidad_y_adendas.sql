-- ====================================================================
-- MIGRACIÓN 024: INMUTABILIDAD LEGAL, ADENDAS Y AUDITORÍA HCE (Leyes 26.529, 25.326, 27.553)
-- ====================================================================

-- 0. Asegurar columna nro_afiliado en public.pacientes
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nro_afiliado VARCHAR(100);

-- 1. Ampliar public.consultas_oftalmo con metadatos de firma e inmutabilidad legal
ALTER TABLE public.consultas_oftalmo
    ADD COLUMN IF NOT EXISTS estado_legal VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    ADD COLUMN IF NOT EXISTS profesional_user_id UUID REFERENCES public.usuarios_perfil(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS profesional_matricula VARCHAR(50),
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS signature_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS geclisa_sync_status VARCHAR(20) DEFAULT 'PENDING';

-- Asegurar CHECK constraint para estado_legal si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_consultas_oftalmo_estado_legal'
    ) THEN
        ALTER TABLE public.consultas_oftalmo
            ADD CONSTRAINT chk_consultas_oftalmo_estado_legal 
            CHECK (estado_legal IN ('DRAFT', 'SIGNED', 'AMENDED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_consultas_oftalmo_estado_legal ON public.consultas_oftalmo(estado_legal);
CREATE INDEX IF NOT EXISTS idx_consultas_oftalmo_profesional ON public.consultas_oftalmo(profesional_user_id);

-- 2. Tabla de Adendas / Enmiendas foliadas (Ley 26.529 Art. 15 - Salvado de Errores)
CREATE TABLE IF NOT EXISTS public.consultas_oftalmo_enmiendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL REFERENCES public.consultas_oftalmo(id) ON DELETE RESTRICT,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    profesional_user_id UUID REFERENCES public.usuarios_perfil(id) ON DELETE SET NULL,
    profesional_nombre VARCHAR(150) NOT NULL,
    profesional_matricula VARCHAR(50),
    motivo_enmienda TEXT NOT NULL,
    texto_adenda TEXT NOT NULL,
    signature_sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consultas_enmiendas_consulta ON public.consultas_oftalmo_enmiendas(consulta_id);
CREATE INDEX IF NOT EXISTS idx_consultas_enmiendas_paciente ON public.consultas_oftalmo_enmiendas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_consultas_enmiendas_created_at ON public.consultas_oftalmo_enmiendas(created_at DESC);

-- 3. Tabla inmutable de logs de auditoría HCE (Ley 25.326 - Habeas Data / Trazabilidad)
CREATE TABLE IF NOT EXISTS public.hce_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad VARCHAR(50) NOT NULL, -- 'CONSULTA', 'HISTORIA', 'RECETA', 'ESTUDIO', 'ENMIENDA'
    entidad_id UUID,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios_perfil(id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(150),
    accion VARCHAR(30) NOT NULL, -- 'READ', 'CREATE_DRAFT', 'UPDATE_DRAFT', 'SIGN', 'AMEND', 'DELETE_DRAFT', 'PRINT', 'SHARE_WA'
    ip_address VARCHAR(45),
    user_agent TEXT,
    detalles JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hce_audit_paciente ON public.hce_audit_logs(paciente_id);
CREATE INDEX IF NOT EXISTS idx_hce_audit_entidad ON public.hce_audit_logs(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_hce_audit_usuario ON public.hce_audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_hce_audit_created ON public.hce_audit_logs(created_at DESC);

-- 4. Trigger de Protección e Inmutabilidad en PostgreSQL
CREATE OR REPLACE FUNCTION public.fn_consultas_oftalmo_inmutabilidad()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Si la consulta ya está firmada o enmendada
    IF OLD.estado_legal IN ('SIGNED', 'AMENDED') THEN
        -- Bloqueo absoluto de DELETE físico (Ley 26.529 Art. 15)
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Operación denegada: No es legalmente admisible eliminar una consulta médica firmada o cerrada (Ley 26.529). Debe registrar una adenda o enmienda foliada.';
        END IF;

        -- En UPDATE, únicamente permitir actualización de sincronización externa o pase a AMENDED
        IF TG_OP = 'UPDATE' THEN
            -- Si se intentan cambiar datos clínicos
            IF OLD.fecha IS DISTINCT FROM NEW.fecha OR
               OLD.tipo IS DISTINCT FROM NEW.tipo OR
               OLD.motivo_consulta IS DISTINCT FROM NEW.motivo_consulta OR
               OLD.derivado_por IS DISTINCT FROM NEW.derivado_por OR
               OLD.ocupacion IS DISTINCT FROM NEW.ocupacion OR
               OLD.observaciones_consulta IS DISTINCT FROM NEW.observaciones_consulta OR
               OLD.agudeza_visual IS DISTINCT FROM NEW.agudeza_visual OR
               OLD.refraccion IS DISTINCT FROM NEW.refraccion OR
               OLD.lentes_anteriores IS DISTINCT FROM NEW.lentes_anteriores OR
               OLD.estabilidad_refractiva IS DISTINCT FROM NEW.estabilidad_refractiva OR
               OLD.arm_cicloplejia IS DISTINCT FROM NEW.arm_cicloplejia OR
               OLD.queratometria IS DISTINCT FROM NEW.queratometria OR
               OLD.presion_intraocular IS DISTINCT FROM NEW.presion_intraocular OR
               OLD.lentes_contacto IS DISTINCT FROM NEW.lentes_contacto OR
               OLD.examen_sensoriomotor IS DISTINCT FROM NEW.examen_sensoriomotor OR
               OLD.superficie_ocular IS DISTINCT FROM NEW.superficie_ocular OR
               OLD.biomicroscopia IS DISTINCT FROM NEW.biomicroscopia OR
               OLD.fondo_ojo IS DISTINCT FROM NEW.fondo_ojo OR
               OLD.conducta IS DISTINCT FROM NEW.conducta OR
               OLD.datos_postop IS DISTINCT FROM NEW.datos_postop OR
               OLD.indicaciones_texto IS DISTINCT FROM NEW.indicaciones_texto OR
               OLD.proximo_control IS DISTINCT FROM NEW.proximo_control OR
               OLD.profesional_user_id IS DISTINCT FROM NEW.profesional_user_id OR
               OLD.signed_at IS DISTINCT FROM NEW.signed_at OR
               OLD.signature_sha256 IS DISTINCT FROM NEW.signature_sha256 THEN
                RAISE EXCEPTION 'Operación denegada: La consulta médica se encuentra firmada y bloqueada. Los datos clínicos son inmutables (Ley 26.529). Confeccione una adenda.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultas_oftalmo_inmutabilidad ON public.consultas_oftalmo;
CREATE TRIGGER trg_consultas_oftalmo_inmutabilidad
    BEFORE UPDATE OR DELETE ON public.consultas_oftalmo
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_consultas_oftalmo_inmutabilidad();

-- 5. Habilitar RLS
ALTER TABLE public.consultas_oftalmo_enmiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hce_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura enmiendas para usuarios autenticados" ON public.consultas_oftalmo_enmiendas;
CREATE POLICY "Permitir lectura enmiendas para usuarios autenticados"
    ON public.consultas_oftalmo_enmiendas FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir insertar enmiendas para usuarios autenticados" ON public.consultas_oftalmo_enmiendas;
CREATE POLICY "Permitir insertar enmiendas para usuarios autenticados"
    ON public.consultas_oftalmo_enmiendas FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura audit logs para usuarios autenticados" ON public.hce_audit_logs;
CREATE POLICY "Permitir lectura audit logs para usuarios autenticados"
    ON public.hce_audit_logs FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Permitir insertar audit logs para usuarios autenticados" ON public.hce_audit_logs;
CREATE POLICY "Permitir insertar audit logs para usuarios autenticados"
    ON public.hce_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);
