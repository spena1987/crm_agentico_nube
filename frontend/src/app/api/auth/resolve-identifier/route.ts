import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * POST /api/auth/resolve-identifier
 * Resuelve un identificador de inicio de sesión (username o correo electrónico)
 * al email real registrado en Supabase Auth, verificando además si la cuenta está activa.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : ''

    if (!rawIdentifier) {
      return NextResponse.json(
        { error: 'Debes ingresar tu nombre de usuario o correo electrónico.' },
        { status: 400 }
      )
    }

    const clean = rawIdentifier.toLowerCase()
    const isEmailFormat = clean.includes('@')

    let profile: { id: string; email: string; username: string | null; activo: boolean } | null = null

    if (isEmailFormat) {
      const { data } = await supabaseAdmin
        .from('usuarios_perfil')
        .select('id, email, username, activo')
        .ilike('email', clean)
        .maybeSingle()
      profile = data
    } else {
      // 1. Buscar coincidencia exacta por username (case-insensitive)
      const { data: byUsername } = await supabaseAdmin
        .from('usuarios_perfil')
        .select('id, email, username, activo')
        .ilike('username', clean)
        .maybeSingle()

      if (byUsername) {
        profile = byUsername
      } else {
        // 2. Fallback: si escribió el prefijo del correo y es único en la clínica
        const { data: byEmailPrefix } = await supabaseAdmin
          .from('usuarios_perfil')
          .select('id, email, username, activo')
          .ilike('email', `${clean}@%`)
          .limit(2)

        if (byEmailPrefix && byEmailPrefix.length === 1) {
          profile = byEmailPrefix[0]
        }
      }
    }

    // Si encontramos el perfil y está explícitamente desactivado, bloquear antes de autenticar
    if (profile && profile.activo === false) {
      return NextResponse.json(
        {
          active: false,
          error: 'Tu cuenta ha sido desactivada por un administrador. Comunícate con la dirección de la clínica.',
        },
        { status: 403 }
      )
    }

    if (profile && profile.email) {
      return NextResponse.json({
        active: true,
        email: profile.email.toLowerCase(),
      })
    }

    // Si no se encontró en usuarios_perfil:
    // Si tenía '@', devolvemos el mismo correo para que Supabase Auth valide;
    // si era un username inexistente, devolvemos un correo sintético inválido para que falle uniformemente.
    return NextResponse.json({
      active: true,
      email: isEmailFormat ? clean : `${clean}@no-registrado.centrovision.local`,
    })
  } catch (err: any) {
    console.error('[ResolveIdentifierAPI] Error:', err)
    return NextResponse.json(
      { error: 'Error al verificar el identificador de usuario.' },
      { status: 500 }
    )
  }
}
