-- =========================================================================
-- MIGRACIÓN 013: Tabla de Tokens de Acceso Rápido Seguro para Urgencias
-- Permite auto-autenticación de un solo uso (Single-Use Magic Link)
-- para cirujanos desde alertas de WhatsApp sin exponer credenciales.
-- =========================================================================

CREATE TABLE IF NOT EXISTS urgencias_tokens_acceso (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash varchar(64) NOT NULL UNIQUE,
    usuario_id uuid NOT NULL REFERENCES usuarios_perfil(id) ON DELETE CASCADE,
    conversacion_id uuid NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
    paciente_id uuid REFERENCES pacientes(id) ON DELETE SET NULL,
    usado boolean NOT NULL DEFAULT false,
    usado_at timestamptz,
    usado_ip varchar(64),
    usado_user_agent text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_urgencias_tokens_hash ON urgencias_tokens_acceso(token_hash);
CREATE INDEX IF NOT EXISTS idx_urgencias_tokens_usuario ON urgencias_tokens_acceso(usuario_id);
CREATE INDEX IF NOT EXISTS idx_urgencias_tokens_conversacion ON urgencias_tokens_acceso(conversacion_id);

ALTER TABLE urgencias_tokens_acceso ENABLE ROW LEVEL SECURITY;
