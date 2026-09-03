import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

export interface ServerAuthResult {
  authenticated: boolean
  isAdmin: boolean
  user: any | null
  profile: any | null
  errorResponse?: NextResponse
}

/**
 * Extrae token JWT desde los headers Authorization o cookies de Supabase.
 */
function extractToken(request: Request): string {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim()
  }

  // Si no está en el header, buscar en cookies (sb-<ref>-auth-token o sb-access-token)
  const cookieHeader = request.headers.get('cookie') || ''
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=')
        return [k, decodeURIComponent(v.join('='))]
      })
    )

    // Buscar clave de cookie auth de Supabase
    for (const [k, val] of Object.entries(cookies)) {
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed) && parsed[0]) return parsed[0]
          if (parsed && typeof parsed === 'object' && parsed.access_token) return parsed.access_token
        } catch {
          if (val && val.length > 20) return val
        }
      }
      if (k === 'sb-access-token') {
        return val
      }
    }
  }

  return ''
}

/**
 * Valida la autenticación y el rol de administrador del usuario que invoca una API Route de Next.js.
 */
export async function verifyServerAdmin(request: Request): Promise<ServerAuthResult> {
  const token = extractToken(request)

  if (!token) {
    return {
      authenticated: false,
      isAdmin: false,
      user: null,
      profile: null,
      errorResponse: NextResponse.json(
        { error: 'Acceso no autorizado: Se requiere sesión activa de administrador.' },
        { status: 401 }
      ),
    }
  }

  // 1. Validar token con Supabase Auth
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return {
      authenticated: false,
      isAdmin: false,
      user: null,
      profile: null,
      errorResponse: NextResponse.json(
        { error: 'Sesión inválida o expirada. Inicie sesión nuevamente.' },
        { status: 401 }
      ),
    }
  }

  // 2. Consultar perfil y rol del usuario
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('usuarios_perfil')
    .select('*, roles(codigo, nombre, es_sistema)')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return {
      authenticated: true,
      isAdmin: false,
      user,
      profile: null,
      errorResponse: NextResponse.json(
        { error: 'Perfil de usuario no encontrado en la base de datos.' },
        { status: 403 }
      ),
    }
  }

  // Verificar si está activo
  if (profile.activo === false) {
    return {
      authenticated: true,
      isAdmin: false,
      user,
      profile,
      errorResponse: NextResponse.json(
        { error: 'La cuenta de este usuario ha sido desactivada por un administrador.' },
        { status: 403 }
      ),
    }
  }

  const roleCode = (profile.roles?.codigo || '').toLowerCase()
  const isAdmin = roleCode === 'admin' || roleCode === 'superadmin' || profile.roles?.es_sistema === true

  if (!isAdmin) {
    return {
      authenticated: true,
      isAdmin: false,
      user,
      profile,
      errorResponse: NextResponse.json(
        { error: 'Acceso denegado: Se requieren permisos de administrador del sistema.' },
        { status: 403 }
      ),
    }
  }

  return {
    authenticated: true,
    isAdmin: true,
    user,
    profile,
  }
}
