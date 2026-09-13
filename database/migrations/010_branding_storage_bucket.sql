-- ====================================================================
-- Migración 010: Bucket Público de Supabase Storage para Branding & Logos
-- Permite alojar el logo institucional para PDFs, Portal y CRM UI
-- ====================================================================

-- 1. Crear el bucket 'branding' como público si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'branding', 
    'branding', 
    true, 
    5242880, -- 5 MB límite
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

-- 2. Políticas de Seguridad RLS para storage.objects en el bucket 'branding'
DROP POLICY IF EXISTS "Branding bucket public read access" ON storage.objects;
CREATE POLICY "Branding bucket public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Branding bucket upload access" ON storage.objects;
CREATE POLICY "Branding bucket upload access"
ON storage.objects FOR INSERT
TO public, anon, authenticated, service_role
WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS "Branding bucket update access" ON storage.objects;
CREATE POLICY "Branding bucket update access"
ON storage.objects FOR UPDATE
TO public, anon, authenticated, service_role
USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Branding bucket delete access" ON storage.objects;
CREATE POLICY "Branding bucket delete access"
ON storage.objects FOR DELETE
TO public, anon, authenticated, service_role
USING (bucket_id = 'branding');
