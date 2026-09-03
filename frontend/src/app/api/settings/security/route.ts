import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyServerAdmin } from '@/lib/serverAuth'

// GET: Obtener la configuración actual de seguridad y tiempos de sesión
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracion_seguridad')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error al obtener configuracion_seguridad:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Si no existe fila, devolver valores por defecto
    const config = data || {
      inactividad_minutos: 20,
      aviso_segundos: 60,
      inactividad_habilitada: true,
    }

    return NextResponse.json({ config })
  } catch (err: any) {
    console.error('Error inesperado en GET /api/settings/security:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// PATCH: Guardar nueva configuración de seguridad (solo administradores)
export async function PATCH(request: Request) {
  try {
    const auth = await verifyServerAdmin(request)
    if (!auth.isAdmin) {
      return auth.errorResponse!
    }

    const body = await request.json()
    const { inactividad_minutos, aviso_segundos, inactividad_habilitada } = body

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    }

    if (inactividad_minutos !== undefined) updatePayload.inactividad_minutos = Number(inactividad_minutos)
    if (aviso_segundos !== undefined) updatePayload.aviso_segundos = Number(aviso_segundos)
    if (inactividad_habilitada !== undefined) updatePayload.inactividad_habilitada = Boolean(inactividad_habilitada)

    // Actualizar fila existente o insertar si no hay
    const { data: existing } = await supabaseAdmin
      .from('configuracion_seguridad')
      .select('id')
      .limit(1)
      .maybeSingle()

    let resultData
    let resultError

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from('configuracion_seguridad')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single()
      resultData = data
      resultError = error
    } else {
      const { data, error } = await supabaseAdmin
        .from('configuracion_seguridad')
        .insert({
          id: '00000000-0000-0000-0000-000000000001',
          ...updatePayload,
        })
        .select()
        .single()
      resultData = data
      resultError = error
    }

    if (resultError) {
      return NextResponse.json({ error: resultError.message }, { status: 500 })
    }

    return NextResponse.json({ config: resultData, message: 'Configuración de seguridad guardada con éxito.' })
  } catch (err: any) {
    console.error('Error en PATCH /api/settings/security:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
