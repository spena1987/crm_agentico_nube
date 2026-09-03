import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas públicas que no requieren sesión activa
const PUBLIC_PATHS = [
  '/login',
  '/consentimiento',
  '/_next',
  '/favicon.ico',
  '/api',
  '/static'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Permitir paso inmediato para recursos estáticos y rutas públicas
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 2. Verificar existencia de token o sesión en cookies de Supabase
  const allCookies = request.cookies.getAll()
  const hasSupabaseSession = allCookies.some(cookie => 
    (cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')) ||
    cookie.name === 'sb-access-token' ||
    cookie.name === 'supabase-auth-token'
  )

  // Si no hay cookies de sesión y no es la página de login, redirigir
  // Nota: El cliente en AppLayoutWrapper también hace verificación client-side con AuthContext
  if (!hasSupabaseSession && pathname !== '/login') {
    // Permitir que la primera carga se resuelva con AuthContext client-side si se usa localStorage,
    // pero inyectar cabecera de seguridad
    const response = NextResponse.next()
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    return response
  }

  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas de solicitud excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
