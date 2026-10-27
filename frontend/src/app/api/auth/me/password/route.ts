import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { extractToken } from '@/lib/serverAuth'

/**
 * POST /api/auth/me/password
 * Permite a cualquier usuario autenticado y activo cambiar su propia contraseña.
 */
export async function POST(request: Request) {
  try {
    const token = extractToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Sesión no autorizada.' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : ''

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      )
    }

    // Verificar que el perfil esté activo
    const { data: profile } = await supabaseAdmin
      .from('usuarios_perfil')
      .select('id, activo')
      .eq('id', user.id)
      .maybeSingle()

    if (profile && profile.activo === false) {
      return NextResponse.json({ error: 'Tu cuenta se encuentra desactivada.' }, { status: 403 })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json(
        { error: `No se pudo actualizar la contraseña: ${updateError.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Tu contraseña ha sido actualizada exitosamente.',
    })
  } catch (err: any) {
    console.error('[SelfPasswordChangeAPI] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Error interno al cambiar la contraseña.' },
      { status: 500 }
    )
  }
}
