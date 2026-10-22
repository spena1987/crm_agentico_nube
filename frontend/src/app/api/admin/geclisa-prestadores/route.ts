import { NextResponse } from 'next/server'
import { BACKEND_URL } from '@/lib/api'

// Fallback con prestadores clave conocidos de CentroVisión (incluyendo técnicos de estudios)
const FALLBACK_PRESTADORES = [
  { pre_id: 1071, nombre: 'TARIFEÑO, CAMILA', matricula: '35', especialidad: 'TECNICO' },
  { pre_id: 969, nombre: 'ASESORAMIENTO', matricula: '99991', especialidad: 'Asesoría Quirúrgica' },
  { pre_id: 2084, nombre: 'ASESORAMIENTO LUJAN', matricula: '99994', especialidad: 'Asesoría Quirúrgica' },
  { pre_id: 961, nombre: 'BONANNO, PABLO ANTONIO', matricula: '6162', especialidad: 'Oftalmología General' },
  { pre_id: 945, nombre: 'GRAS, HERNAN', matricula: '7307', especialidad: 'Cirugía Oftalmológica' },
  { pre_id: 1025, nombre: 'GRAS, HERNAN (Cirugía)', matricula: '7307', especialidad: 'Quirófano' },
  { pre_id: 1067, nombre: 'ABRAHAM, GABRIELA', matricula: '8452', especialidad: 'Oftalmología' },
  { pre_id: 2090, nombre: 'TECNICO OFTALMOLOGO', matricula: '99999', especialidad: 'Estudios' },
]

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('query') || '').trim()

    // Resolver URL base segura para ejecución SSR / Route Handler
    const baseUrl = 
      (BACKEND_URL && BACKEND_URL.trim()) || 
      process.env.BACKEND_URL || 
      process.env.NEXT_PUBLIC_BACKEND_URL || 
      'https://crmagenticonube-production.up.railway.app'

    const backendEndpoint = `${baseUrl.replace(/\/+$/, '')}/api/geclisa/prestadores/buscar${query ? `?query=${encodeURIComponent(query)}` : ''}`

    // Extraer token de autorización enviado por el cliente o recurrir a credenciales de servidor
    const clientAuth = request.headers.get('authorization')
    const serverToken = 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    if (clientAuth) {
      headers['Authorization'] = clientAuth
    } else if (serverToken) {
      headers['Authorization'] = serverToken.startsWith('Bearer ') ? serverToken : `Bearer ${serverToken}`
    }

    try {
      const res = await fetch(backendEndpoint, {
        headers,
        cache: 'no-store'
      })

      if (res.ok) {
        const data = await res.json()
        if (data.prestadores && Array.isArray(data.prestadores) && data.prestadores.length > 0) {
          return NextResponse.json({
            success: true,
            prestadores: data.prestadores,
            total: data.prestadores.length,
            fallback: false
          })
        }
      } else {
        console.warn(`Respuesta HTTP ${res.status} desde backend (${backendEndpoint}) al consultar prestadores.`)
      }
    } catch (fetchErr) {
      console.warn('Advertencia: Backend FastAPI no disponible para prestadores, usando catálogo de respaldo:', fetchErr)
    }

    // Si falla o no devuelve datos, filtrar sobre el catálogo de fallback
    const filtrados = query
      ? FALLBACK_PRESTADORES.filter(p => 
          p.nombre.toLowerCase().includes(query.toLowerCase()) || 
          p.matricula.includes(query) ||
          p.especialidad.toLowerCase().includes(query.toLowerCase())
        )
      : FALLBACK_PRESTADORES

    return NextResponse.json({
      success: true,
      prestadores: filtrados,
      total: filtrados.length,
      fallback: true
    })
  } catch (err: any) {
    console.error('Error en GET /api/admin/geclisa-prestadores:', err)
    return NextResponse.json({
      success: true,
      prestadores: FALLBACK_PRESTADORES,
      total: FALLBACK_PRESTADORES.length,
      fallback: true
    })
  }
}
