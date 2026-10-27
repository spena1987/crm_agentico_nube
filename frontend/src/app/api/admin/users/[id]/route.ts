import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyServerAdmin } from '@/lib/serverAuth'

function sanitizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
}

// PATCH: Actualizar perfil, username, email o contraseña de un usuario
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyServerAdmin(request, 'ver_usuarios')
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const userId = params.id
    const body = await request.json()
    const {
      username,
      email,
      nombre_completo,
      rol_id,
      activo,
      password,
      telefono,
      geclisa_pre_id,
      geclisa_matricula,
      geclisa_prestador_nombre,
    } = body

    // Prevención de auto-suspensión del administrador activo
    if (userId === auth.user?.id && activo === false) {
      return NextResponse.json(
        { error: 'Por motivos de seguridad, no puedes desactivar tu propia cuenta activa.' },
        { status: 400 }
      )
    }

    // 1. Obtener perfil actual para comparar cambios de email y username
    const { data: currentProfile, error: currentError } = await supabaseAdmin
      .from('usuarios_perfil')
      .select('id, email, username')
      .eq('id', userId)
      .maybeSingle()

    if (currentError || !currentProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const updateFields: any = {
      updated_at: new Date().toISOString(),
    }

    // 2. Validar y preparar nuevo username si se envió
    if (username !== undefined) {
      const cleanUsername = sanitizeUsername(String(username))
      if (!cleanUsername || cleanUsername.length < 2) {
        return NextResponse.json(
          { error: 'El nombre de usuario debe tener al menos 2 caracteres válidos (letras, números, punto o guion).' },
          { status: 400 }
        )
      }

      if (cleanUsername !== (currentProfile.username || '').toLowerCase()) {
        const { data: conflictUser } = await supabaseAdmin
          .from('usuarios_perfil')
          .select('id, nombre_completo')
          .ilike('username', cleanUsername)
          .neq('id', userId)
          .maybeSingle()

        if (conflictUser) {
          return NextResponse.json(
            { error: `El nombre de usuario "${cleanUsername}" ya está en uso por ${conflictUser.nombre_completo}.` },
            { status: 400 }
          )
        }
      }
      updateFields.username = cleanUsername
    }

    // 3. Validar y actualizar email si cambió
    const authUpdatePayload: any = {}
    if (email !== undefined) {
      const targetUsername = updateFields.username || currentProfile.username || 'usuario'
      const cleanEmail = String(email).trim()
        ? String(email).trim().toLowerCase()
        : `${targetUsername}@interno.centrovision.local`

      if (cleanEmail !== (currentProfile.email || '').toLowerCase()) {
        const { data: conflictEmail } = await supabaseAdmin
          .from('usuarios_perfil')
          .select('id, nombre_completo')
          .ilike('email', cleanEmail)
          .neq('id', userId)
          .maybeSingle()

        if (conflictEmail) {
          return NextResponse.json(
            { error: `El correo "${cleanEmail}" ya está asignado a ${conflictEmail.nombre_completo}.` },
            { status: 400 }
          )
        }

        authUpdatePayload.email = cleanEmail
        authUpdatePayload.email_confirm = true
        updateFields.email = cleanEmail
      }
    }

    // 4. Validar contraseña si se envió
    if (password !== undefined && String(password).trim().length > 0) {
      const cleanPass = String(password).trim()
      if (cleanPass.length < 6) {
        return NextResponse.json(
          { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
          { status: 400 }
        )
      }
      authUpdatePayload.password = cleanPass
    }

    // 5. Preparar metadata para Supabase Auth
    if (nombre_completo !== undefined || updateFields.username !== undefined) {
      authUpdatePayload.user_metadata = {
        ...(nombre_completo !== undefined ? { full_name: nombre_completo.trim() } : {}),
        ...(updateFields.username !== undefined ? { username: updateFields.username } : {}),
      }
    }

    // Ejecutar actualización en Supabase Auth si hay cambios de credenciales o metadata
    if (Object.keys(authUpdatePayload).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        authUpdatePayload
      )
      if (authUpdateError) {
        console.error('Error actualizando usuario en Supabase Auth:', authUpdateError)
        return NextResponse.json(
          { error: `Error al actualizar credenciales en Auth: ${authUpdateError.message}` },
          { status: 400 }
        )
      }
    }

    // 6. Actualizar campos en la tabla usuarios_perfil
    if (nombre_completo !== undefined) updateFields.nombre_completo = nombre_completo.trim()
    if (rol_id !== undefined) updateFields.rol_id = rol_id || null
    if (activo !== undefined) updateFields.activo = activo
    if (telefono !== undefined) updateFields.telefono = telefono ? String(telefono).trim() : null
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
        username,
        nombre_completo,
        rol_id,
        activo,
        avatar_url,
        telefono,
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
      console.error('Error al actualizar usuarios_perfil:', profileError)
      return NextResponse.json({ error: `Error en base de datos: ${profileError.message}` }, { status: 500 })
    }

    // 7. Si se desactiva el usuario, revocar inmediatamente sus sesiones activas en Auth
    if (activo === false) {
      try {
        await supabaseAdmin.auth.admin.signOut(userId)
      } catch (signOutErr) {
        console.warn('Advertencia forzando cierre de sesión en Supabase Auth:', signOutErr)
      }
    }

    return NextResponse.json({ success: true, user: updatedProfile })
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
    const auth = await verifyServerAdmin(request, 'ver_usuarios')
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const userId = params.id

    // Prevención de auto-eliminación del administrador activo
    if (userId === auth.user?.id) {
      return NextResponse.json(
        { error: 'Por motivos de seguridad, no puedes eliminar tu propia cuenta activa.' },
        { status: 400 }
      )
    }

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
