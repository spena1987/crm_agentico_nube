/**
 * Utilidades de fecha y hora local para evitar desfases UTC / Local
 * Zona horaria de referencia: America/Argentina/Buenos_Aires (UTC-3)
 */

export const getFechaHoyLocal = (): string => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatearHoraLocal = (d: Date = new Date()): string => {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export const formatearHoraDesdeIso = (isoStr?: string | null, fallback: string = '--:--'): string => {
  if (!isoStr) return fallback
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return String(isoStr).slice(11, 16) || fallback
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes} hs`
  } catch (e) {
    return fallback
  }
}

export const calcularMinutosTranscurridos = (inicioIso?: string | null, finIso?: string | null): number => {
  if (!inicioIso) return 0
  try {
    const ini = new Date(inicioIso).getTime()
    const fin = finIso ? new Date(finIso).getTime() : new Date().getTime()
    const diffMs = Math.max(0, fin - ini)
    return Math.floor(diffMs / 60000)
  } catch (e) {
    return 0
  }
}

/**
 * Compara si dos fechas corresponden al mismo día del calendario local
 */
export const isSameCalendarDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

/**
 * Retorna una clave única de día calendario (YYYY-MM-DD) para agrupar mensajes en secciones delimitadas
 */
export const getCalendarDayKey = (isoStr?: string | null): string => {
  if (!isoStr) return 'sin-fecha'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return 'sin-fecha'
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return 'sin-fecha'
  }
}

/**
 * Formatea la píldora/separador de fecha en el timeline de mensajes (Estilo WhatsApp Web)
 * - Hoy -> "HOY"
 * - Ayer -> "AYER"
 * - Últimos 7 días -> Nombre del día (ej: "LUNES", "MIÉRCOLES")
 * - Mismo año -> "24 DE SEPTIEMBRE"
 * - Distinto año -> "24 DE SEPTIEMBRE DE 2025"
 */
export const formatDateBadge = (isoStr?: string | null): string => {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ''

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'HOY'
    if (diffDays === 1) return 'AYER'
    if (diffDays > 1 && diffDays < 7) {
      const weekday = d.toLocaleDateString('es-AR', { weekday: 'long' })
      return weekday.toUpperCase()
    }

    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }).toUpperCase()
    }

    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
  } catch (e) {
    return ''
  }
}

/**
 * Formatea el timestamp para la tarjeta de conversación en la lista lateral (Estilo WhatsApp Web)
 * - Hoy -> "15:45"
 * - Ayer -> "Ayer"
 * - Últimos 7 días -> "Miércoles"
 * - Anterior -> "24/09/2026"
 */
export const formatWhatsAppListDate = (isoStr?: string | null): string => {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ''

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (diffDays === 1) {
      return 'Ayer'
    }
    if (diffDays > 1 && diffDays < 7) {
      const weekday = d.toLocaleDateString('es-AR', { weekday: 'long' })
      return weekday.charAt(0).toUpperCase() + weekday.slice(1)
    }

    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch (e) {
    return ''
  }
}

/**
 * Tooltip accesible para ver fecha y hora completa en cualquier mensaje
 * Ej: "Jueves, 24 de septiembre de 2026, 18:33 hs"
 */
export const formatFullDateTimeTooltip = (isoStr?: string | null): string => {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ''
    const fecha = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const capFecha = fecha.charAt(0).toUpperCase() + fecha.slice(1)
    return `${capFecha}, ${hora} hs`
  } catch (e) {
    return ''
  }
}