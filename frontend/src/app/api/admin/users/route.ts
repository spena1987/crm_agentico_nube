import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyServerAdmin } from '@/lib/serverAuth'

// GET: Listar todos los usuarios y perfiles
export async function GET(request: Request) {
  try {
    const auth = await verifyServerAdmin(request)
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const { data: profiles, error } = await supabaseAdmin
      .from('usuarios_perfil')
      .select(`
        id,
        email,
        nombre_completo,
        rol_id,
        activo,
        avatar_url,
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
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error al listar perfiles:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: profiles || [] })
  } catch (err: any) {
    console.error('Error inesperado en GET /api/admin/users:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// POST: Crear usuario en Supabase Auth y en usuarios_perfil
export async function POST(request: Request) {
  try {
    const auth = await verifyServerAdmin(request)
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const body = await request.json()
    const { 
      email, 
      password, 
      nombre_completo, 
      rol_id, 
      activo = true,
      geclisa_pre_id = null,
      geclisa_matricula = null,
      geclisa_prestador_nombre = null
    } = body

    if (!email || !password || !nombre_completo) {
      return NextResponse.json(
        { error: 'Email, contraseña y nombre completo son obligatorios.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      )
    }

    // 1. Crear usuario en Supabase Auth mediante admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Auto-confirmado para acceso inmediato
      user_metadata: {
        full_name: nombre_completo.trim(),
      },
    })

    if (authError) {
      console.error('Error al crear usuario en Supabase Auth:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Insertar perfil en la tabla usuarios_perfil
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('usuarios_perfil')
      .upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        nombre_completo: nombre_completo.trim(),
        rol_id: rol_id || null,
        activo,
        geclisa_pre_id: geclisa_pre_id ? parseInt(String(geclisa_pre_id)) : null,
        geclisa_matricula: geclisa_matricula ? String(geclisa_matricula).trim() : null,
        geclisa_prestador_nombre: geclisa_prestador_nombre ? String(geclisa_prestador_nombre).trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
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
      console.error('Error al crear registro en usuarios_perfil:', profileError)
      // Revertir usuario de auth si falló el perfil
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ user: profileData }, { status: 201 })
  } catch (err: any) {
    console.error('Error inesperado en POST /api/admin/users:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
