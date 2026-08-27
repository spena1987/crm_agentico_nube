import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// PATCH: Actualizar perfil o contraseña de un usuario
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const body = await request.json()
    const { 
      nombre_completo, 
      rol_id, 
      activo, 
      password,
      geclisa_pre_id,
      geclisa_matricula,
      geclisa_prestador_nombre
    } = body

    // 1. Si se envió una nueva contraseña, actualizar en Supabase Auth
    if (password && password.trim().length >= 6) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: password.trim() }
      )
      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 400 })
      }
    }

    // 2. Si se envió nombre_completo, actualizar metadata en Supabase Auth
    if (nombre_completo) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: nombre_completo.trim() },
      })
    }

    // 3. Actualizar campos en la tabla usuarios_perfil
    const updateFields: any = {
      updated_at: new Date().toISOString(),
    }
    if (nombre_completo !== undefined) updateFields.nombre_completo = nombre_completo.trim()
    if (rol_id !== undefined) updateFields.rol_id = rol_id || null
    if (activo !== undefined) updateFields.activo = activo
    if (geclisa_pre_id !== undefined) updateFields.geclisa_pre_id = geclisa_pre_id ? parseInt(String(geclisa_pre_id)) : null
    if (geclisa_matricula !== undefined) updateFields.geclisa_matricula = geclisa_matricula ? String(geclisa_matricula).trim() : null
    if (geclisa_prestador_nombre !== undefined) updateFields.geclisa_prestador_nombre = geclisa_prestador_nombre ? String(geclisa_prestador_nombre).trim() : null

    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('usuarios_perfil')
      .update(updateFields)
      .eq('id', userId)
      .select(`
        id,
        email,
        nombre_completo,
        rol_id,
        activo,
        geclisa_pre_id,
        geclisa_matricula,
        geclisa_prestador_nombre,
        created_at,
        updated_at,
        roles (
          id,
          codigo,
          nombre,
          descripcion,
          es_sistema
        )
      `)
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ user: updatedProfile })
  } catch (err: any) {
    console.error('Error inesperado en PATCH /api/admin/users/[id]:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE: Eliminar un usuario de Supabase Auth y de usuarios_perfil
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id

    // 1. Eliminar usuario en Supabase Auth (eliminará por CASCADE en usuarios_perfil)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      console.error('Error al eliminar usuario en Auth:', deleteAuthError)
      return NextResponse.json({ error: deleteAuthError.message }, { status: 400 })
    }

    // 2. Eliminar explícitamente de usuarios_perfil por seguridad
    await supabaseAdmin.from('usuarios_perfil').delete().eq('id', userId)

    return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente.' })
  } catch (err: any) {
    console.error('Error inesperado en DELETE /api/admin/users/[id]:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
