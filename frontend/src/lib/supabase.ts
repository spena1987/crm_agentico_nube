import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Requerimos que estén en NEXT_PUBLIC para poder ser consumidas por el cliente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan configurar las variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. El CRM no se podrá conectar a la base de datos.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
