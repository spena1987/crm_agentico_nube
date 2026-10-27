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

// GET: Listar todos los usuarios, perfiles y su último acceso
export async function GET(request: Request) {
  try {
    const auth = await verifyServerAdmin(request, 'ver_usuarios')
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const [profilesResult, authUsersResult] = await Promise.all([
      supabaseAdmin
        .from('usuarios_perfil')
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
        .order('created_at', { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ perPage: 500 }),
    ])

    if (profilesResult.error) {
      console.error('Error al listar perfiles:', profilesResult.error)
      return NextResponse.json({ error: profilesResult.error.message }, { status: 500 })
    }

    const lastSignInMap = new Map<string, string | null>()
    if (authUsersResult.data?.users) {
      for (const au of authUsersResult.data.users) {
        lastSignInMap.set(au.id, au.last_sign_in_at || null)
      }
    }

    const enrichedUsers = (profilesResult.data || []).map((p: any) => ({
      ...p,
      last_sign_in_at: lastSignInMap.get(p.id) || null,
    }))

    return NextResponse.json({ users: enrichedUsers })
  } catch (err: any) {
    console.error('Error inesperado en GET /api/admin/users:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// POST: Crear usuario en Supabase Auth y en usuarios_perfil
export async function POST(request: Request) {
  try {
    const auth = await verifyServerAdmin(request, 'ver_usuarios')
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const body = await request.json()
    const {
      username,
      email,
      password,
      nombre_completo,
      rol_id,
      activo = true,
      telefono = null,
      geclisa_pre_id = null,
      geclisa_matricula = null,
      geclisa_prestador_nombre = null,
    } = body

    if (!password || !nombre_completo) {
      return NextResponse.json(
        { error: 'Nombre completo y contraseña son obligatorios.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      )
    }

    // Determinar y normalizar username
    const rawUsername = username?.trim()
      ? username
      : email?.trim()
      ? email.split('@')[0]
      : nombre_completo

    const cleanUsername = sanitizeUsername(rawUsername)
    if (!cleanUsername || cleanUsername.length < 2) {
      return NextResponse.json(
        { error: 'El nombre de usuario debe contener al menos 2 caracteres alfanuméricos válidos.' },
        { status: 400 }
      )
    }

    // Verificar que el username sea único
    const { data: existingUsername } = await supabaseAdmin
      .from('usuarios_perfil')
      .select('id, nombre_completo')
      .ilike('username', cleanUsername)
      .maybeSingle()

    if (existingUsername) {
      return NextResponse.json(
        { error: `El nombre de usuario "${cleanUsername}" ya está asignado a ${existingUsername.nombre_completo}.` },
        { status: 400 }
      )
    }

    // Si no se especificó correo electrónico, generar uno interno para cuentas operativas/puestos
    const finalEmail = email?.trim()
      ? email.trim().toLowerCase()
      : `${cleanUsername}@interno.centrovision.local`

    // Verificar si el email ya existe en usuarios_perfil
    const { data: existingEmail } = await supabaseAdmin
      .from('usuarios_perfil')
      .select('id, nombre_completo')
      .ilike('email', finalEmail)
      .maybeSingle()

    if (existingEmail) {
      return NextResponse.json(
        { error: `El correo "${finalEmail}" ya está registrado por ${existingEmail.nombre_completo}.` },
        { status: 400 }
      )
    }

    // 1. Crear usuario en Supabase Auth mediante admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true, // Auto-confirmado para acceso inmediato
      user_metadata: {
        full_name: nombre_completo.trim(),
        username: cleanUsername,
      },
    })

    if (authError) {
      console.error('Error al crear usuario en Supabase Auth:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Insertar/Actualizar perfil en la tabla usuarios_perfil
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('usuarios_perfil')
      .upsert({
        id: userId,
        email: finalEmail,
        username: cleanUsername,
        nombre_completo: nombre_completo.trim(),
        rol_id: rol_id || null,
        activo,
        telefono: telefono ? String(telefono).trim() : null,
        geclisa_pre_id: geclisa_pre_id ? parseInt(String(geclisa_pre_id)) : null,
        geclisa_matricula: geclisa_matricula ? String(geclisa_matricula).trim() : null,
        geclisa_prestador_nombre: geclisa_prestador_nombre ? String(geclisa_prestador_nombre).trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
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
