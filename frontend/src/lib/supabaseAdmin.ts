import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase con Service Role Key exclusivo para el backend/servidor de Next.js
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.'
  )
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
