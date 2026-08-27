import { NextResponse } from 'next/server'
import { BACKEND_URL } from '@/lib/api'

// Fallback con prestadores clave conocidos de CentroVisión
const FALLBACK_PRESTADORES = [
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
    const query = searchParams.get('query') || ''

    const backendEndpoint = `${BACKEND_URL}/api/geclisa/prestadores${query ? `?query=${encodeURIComponent(query)}` : ''}`

    try {
      const res = await fetch(backendEndpoint, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 } // Cache por 60s
      })

      if (res.ok) {
        const data = await res.json()
        if (data.prestadores && data.prestadores.length > 0) {
          return NextResponse.json({
            success: true,
            prestadores: data.prestadores,
            total: data.prestadores.length
          })
        }
      }
    } catch (fetchErr) {
      console.warn('Advertencia: Backend FastAPI no disponible para prestadores, usando catálogo de respaldo:', fetchErr)
    }

    // Si falla o no devuelve datos, filtrar sobre el catálogo de fallback
    const filtrados = query
      ? FALLBACK_PRESTADORES.filter(p => 
          p.nombre.toLowerCase().includes(query.toLowerCase()) || 
          p.matricula.includes(query)
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
