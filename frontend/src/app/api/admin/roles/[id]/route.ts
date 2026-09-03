import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyServerAdmin } from '@/lib/serverAuth'

// PATCH: Actualizar rol y su matriz de permisos
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyServerAdmin(request)
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const roleId = params.id
    const body = await request.json()
    const { nombre, descripcion, permisos } = body

    // 1. Actualizar datos básicos del rol
    const updateData: any = { updated_at: new Date().toISOString() }
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null

    const { data: updatedRole, error: roleError } = await supabaseAdmin
      .from('roles')
      .update(updateData)
      .eq('id', roleId)
      .select()
      .single()

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }

    // 2. Si se enviaron permisos, sincronizarlos
    if (permisos && Array.isArray(permisos)) {
      // Eliminar permisos previos
      await supabaseAdmin.from('rol_permisos').delete().eq('rol_id', roleId)

      // Insertar nuevos permisos
      if (permisos.length > 0) {
        const permsToInsert = permisos.map((p: any) => ({
          rol_id: roleId,
          modulo_codigo: p.modulo_codigo,
          accion: p.accion,
          permitido: p.permitido ?? true,
        }))

        const { error: insertError } = await supabaseAdmin
          .from('rol_permisos')
          .insert(permsToInsert)

        if (insertError) {
          console.error('Error actualizando permisos:', insertError)
        }
      }
    }

    return NextResponse.json({ role: updatedRole })
  } catch (err: any) {
    console.error('Error en PATCH /api/admin/roles/[id]:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE: Eliminar rol (solo si no es de sistema y no tiene usuarios asignados)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyServerAdmin(request)
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const roleId = params.id

    // 1. Verificar si es un rol de sistema protegido
    const { data: role, error: checkError } = await supabaseAdmin
      .from('roles')
      .select('id, nombre, es_sistema')
      .eq('id', roleId)
      .single()

    if (checkError || !role) {
      return NextResponse.json({ error: 'Rol no encontrado.' }, { status: 404 })
    }

    if (role.es_sistema) {
      return NextResponse.json(
        { error: 'Los roles predeterminados del sistema no pueden ser eliminados.' },
        { status: 400 }
      )
    }

    // 2. Verificar si hay usuarios asociados a este rol
    const { count, error: countError } = await supabaseAdmin
      .from('usuarios_perfil')
      .select('*', { count: 'exact', head: true })
      .eq('rol_id', roleId)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar este rol porque tiene ${count} usuario(s) asignado(s). Reasígnalos primero.` },
        { status: 400 }
      )
    }

    // 3. Eliminar rol (los permisos se eliminan en cascada)
    const { error: deleteError } = await supabaseAdmin
      .from('roles')
      .delete()
      .eq('id', roleId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Rol eliminado con éxito.' })
  } catch (err: any) {
    console.error('Error en DELETE /api/admin/roles/[id]:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
