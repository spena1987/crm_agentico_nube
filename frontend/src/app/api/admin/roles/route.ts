import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyServerAdmin } from '@/lib/serverAuth'

// GET: Listar todos los roles con sus permisos asociados
export async function GET(request: Request) {
  try {
    const auth = await verifyServerAdmin(request)
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select(`
        id,
        codigo,
        nombre,
        descripcion,
        es_sistema,
        created_at,
        rol_permisos (
          id,
          modulo_codigo,
          accion,
          permitido
        )
      `)
      .order('created_at', { ascending: true })

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 500 })
    }

    return NextResponse.json({ roles: roles || [] })
  } catch (err: any) {
    console.error('Error en GET /api/admin/roles:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// POST: Crear un nuevo rol y sus permisos
export async function POST(request: Request) {
  try {
    const auth = await verifyServerAdmin(request)
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const body = await request.json()
    const { nombre, descripcion, permisos = [] } = body

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre del rol es obligatorio.' }, { status: 400 })
    }

    // Generar código slug amigable
    const codigo = nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')

    // 1. Insertar nuevo rol
    const { data: newRole, error: roleError } = await supabaseAdmin
      .from('roles')
      .insert({
        codigo,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        es_sistema: false,
      })
      .select()
      .single()

    if (roleError) {
      if (roleError.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un rol con un nombre similar.' }, { status: 400 })
      }
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }

    // 2. Insertar permisos asignados
    if (permisos.length > 0) {
      const permsToInsert = permisos.map((p: any) => ({
        rol_id: newRole.id,
        modulo_codigo: p.modulo_codigo,
        accion: p.accion,
        permitido: p.permitido ?? true,
      }))

      const { error: permError } = await supabaseAdmin
        .from('rol_permisos')
        .insert(permsToInsert)

      if (permError) {
        console.error('Error insertando permisos del rol:', permError)
      }
    }

    return NextResponse.json({ role: newRole }, { status: 201 })
  } catch (err: any) {
    console.error('Error en POST /api/admin/roles:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
