import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token } = body

    if (!token || typeof token !== 'string' || !token.trim()) {
      return NextResponse.json(
        { success: false, error: 'Token de acceso no proporcionado', code: 'MISSING_TOKEN' },
        { status: 400 }
      )
    }

    // 1. Calcular hash SHA-256 del token recibido
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex')

    // 2. Buscar el token en la base de datos con los datos del médico
    const { data: record, error: dbError } = await supabaseAdmin
      .from('urgencias_tokens_acceso')
      .select(`
        id,
        token_hash,
        usuario_id,
        conversacion_id,
        paciente_id,
        usado,
        expires_at,
        usuarios_perfil (
          id,
          email,
          nombre_completo,
          activo
        )
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (dbError || !record) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'El enlace de acceso es inválido o no existe en el sistema', 
          code: 'INVALID_TOKEN' 
        },
        { status: 404 }
      )
    }

    // 3. Validar estado de uso
    if (record.usado) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Este enlace de acceso rápido de urgencia ya fue utilizado previamente', 
          code: 'ALREADY_USED',
          conversacionId: record.conversacion_id
        },
        { status: 400 }
      )
    }

    // 4. Validar expiración (TTL de 30 minutos)
    const expTime = new Date(record.expires_at).getTime()
    if (expTime < Date.now()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'El enlace de acceso de urgencia ha caducado por motivos de seguridad médica (validez de 30 min)', 
          code: 'EXPIRED',
          conversacionId: record.conversacion_id
        },
        { status: 400 }
      )
    }

    // 5. Validar que la cuenta médica esté activa
    const medico = record.usuarios_perfil as any
    if (!medico || medico.activo === false || !medico.email) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'La cuenta del profesional médico se encuentra inactiva o no posee correo válido', 
          code: 'USER_INACTIVE' 
        },
        { status: 403 }
      )
    }

    // 6. Registrar consumo del token (Single-Use Audit Trail)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    await supabaseAdmin
      .from('urgencias_tokens_acceso')
      .update({
        usado: true,
        usado_at: new Date().toISOString(),
        usado_ip: String(clientIp).slice(0, 64),
        usado_user_agent: String(userAgent).slice(0, 500)
      })
      .eq('id', record.id)

    // 7. Generar sesión oficial en Supabase Auth mediante Magic Link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-agentico-nube.vercel.app'
    const redirectUrl = `/chat?conv=${record.conversacion_id}`
    const fullRedirectUrl = `${baseUrl.replace(/\/+$/, '')}${redirectUrl}`

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: medico.email,
      options: {
        redirectTo: fullRedirectUrl
      }
    })

    if (linkError || !linkData) {
      console.error('[AccesoUrgenciaAPI] Error generando sesión en Supabase:', linkError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error interno generando la sesión médica del profesional', 
          code: 'AUTH_GENERATION_FAILED',
          conversacionId: record.conversacion_id
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      redirectUrl,
      conversacionId: record.conversacion_id,
      medico: {
        id: medico.id,
        nombre: medico.nombre_completo,
        email: medico.email
      },
      actionLink: linkData.properties?.action_link,
      hashedToken: linkData.properties?.hashed_token,
      emailOtp: linkData.properties?.email_otp
    })
  } catch (err: any) {
    console.error('[AccesoUrgenciaAPI] Error inesperado:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Error interno del servidor', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
