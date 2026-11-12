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

/**
 * Formatea la hora mostrando fecha (DD/MM) si el timestamp no pertenece a la fecha de referencia
 */
export const formatearHoraConFechaSiDifiere = (
  isoStr?: string | null,
  fechaReferencia?: string | null,
  fallback: string = '--:--'
): string => {
  if (!isoStr) return fallback
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return String(isoStr).slice(11, 16) || fallback
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')

    if (fechaReferencia && fechaReferencia.length >= 10) {
      const pYear = parseInt(fechaReferencia.slice(0, 4), 10)
      const pMonth = parseInt(fechaReferencia.slice(5, 7), 10) - 1
      const pDay = parseInt(fechaReferencia.slice(8, 10), 10)
      if (d.getFullYear() !== pYear || d.getMonth() !== pMonth || d.getDate() !== pDay) {
        const dia = String(d.getDate()).padStart(2, '0')
        const mes = String(d.getMonth() + 1).padStart(2, '0')
        return `${dia}/${mes} ${hours}:${minutes} hs`
      }
    }
    return `${hours}:${minutes} hs`
  } catch (e) {
    return fallback
  }
}

/**
 * Formatea el tiempo de espera quirúrgico evitando desbordes interdiarios absurdos.
 */
export const formatearTiempoEsperaSeguro = (
  llegadaIso?: string | null,
  fechaPizarra?: string | null
): { minutos: number; texto: string; esFechaAnterior: boolean } => {
  if (!llegadaIso) return { minutos: 0, texto: '', esFechaAnterior: false }
  try {
    const llegada = new Date(llegadaIso)
    if (isNaN(llegada.getTime())) return { minutos: 0, texto: '', esFechaAnterior: false }

    let esFechaAnterior = false
    if (fechaPizarra && fechaPizarra.length >= 10) {
      const pYear = parseInt(fechaPizarra.slice(0, 4), 10)
      const pMonth = parseInt(fechaPizarra.slice(5, 7), 10) - 1
      const pDay = parseInt(fechaPizarra.slice(8, 10), 10)
      if (
        llegada.getFullYear() !== pYear ||
        llegada.getMonth() !== pMonth ||
        llegada.getDate() !== pDay
      ) {
        esFechaAnterior = true
      }
    }

    const now = new Date()
    const diffMs = Math.max(0, now.getTime() - llegada.getTime())
    const diffMin = Math.floor(diffMs / 60000)

    if (esFechaAnterior || diffMin > 720) {
      const dia = String(llegada.getDate()).padStart(2, '0')
      const mes = String(llegada.getMonth() + 1).padStart(2, '0')
      return {
        minutos: diffMin,
        texto: `Ingreso ant. (${dia}/${mes})`,
        esFechaAnterior: true
      }
    }

    return {
      minutos: diffMin,
      texto: `Esperando hace ${diffMin} min`,
      esFechaAnterior: false
    }
  } catch {
    return { minutos: 0, texto: '', esFechaAnterior: false }
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

/**
 * Convierte cualquier fecha (YYYY-MM-DD, ISO string, Date o timestamp)
 * al formato estándar argentino: DD/MM/YYYY.
 * Evita desfasaje por zona horaria UTC-3 analizando directamente los componentes año/mes/día.
 */
export const formatDateArg = (fechaInput?: string | Date | null, fallback: string = '-'): string => {
  if (!fechaInput) return fallback
  try {
    if (typeof fechaInput === 'string') {
      const limpia = fechaInput.trim()
      if (!limpia) return fallback
      // Si ya viene en formato DD/MM/YYYY o DD-MM-YYYY
      if (/^\d{2}[\/-]\d{2}[\/-]\d{4}/.test(limpia)) {
        return limpia.slice(0, 10).replace(/-/g, '/')
      }
      // Formato YYYY-MM-DD o YYYY/MM/DD (con o sin parte de tiempo)
      if (/^\d{4}[\/-]\d{2}[\/-]\d{2}/.test(limpia)) {
        const parteFecha = limpia.split('T')[0].split(' ')[0]
        const [y, m, d] = parteFecha.split(/[\/-]/)
        if (y && m && d) return `${d}/${m}/${y}`
      }
      // Si ya es un texto redactado con palabras en español (ej: "Martes 1 de Diciembre (01/12/2026)")
      // o contiene nombres de meses / días, no mutilar el string con slice(0, 10)
      if (/[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}/.test(limpia)) {
        return limpia
      }
    }
    const d = typeof fechaInput === 'string' ? new Date(fechaInput) : fechaInput
    if (isNaN(d.getTime())) {
      // Si no es fecha válida, jamás cortar texto arbitrario a 10 letras
      if (typeof fechaInput === 'string') {
        const str = fechaInput.trim()
        if (/^\d{4}/.test(str)) return str.slice(0, 10)
        return str || fallback
      }
      return fallback
    }
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const anio = d.getFullYear()
    return `${dia}/${mes}/${anio}`
  } catch {
    return fallback
  }
}

/**
 * Convierte a formato DD/MM/YYYY HH:mm hs (estándar argentino)
 */
export const formatDateTimeArg = (fechaInput?: string | Date | null, fallback: string = '-'): string => {
  if (!fechaInput) return fallback
  const dmy = formatDateArg(fechaInput, '')
  if (!dmy) return fallback
  const isoStr = typeof fechaInput === 'string' ? fechaInput : (fechaInput instanceof Date ? fechaInput.toISOString() : '')
  const hora = formatearHoraDesdeIso(isoStr, '')
  return hora && hora !== '--:--' ? `${dmy} ${hora}` : dmy
}

/**
 * Convierte a formato compacto DD/MM (para badges, timeline y cabeceras de columnas)
 */
export const formatShortDateArg = (fechaInput?: string | Date | null, fallback: string = '-'): string => {
  const dmy = formatDateArg(fechaInput, '')
  if (!dmy || dmy.length < 5) return fallback
  return dmy.slice(0, 5) // DD/MM
}

/**
 * Convierte a formato verbal extendido argentino (ej: "Viernes 20 de Noviembre de 2026")
 */
export const formatDateVerboseArg = (fechaInput?: string | Date | null, fallback: string = '-'): string => {
  if (!fechaInput) return fallback
  try {
    let d: Date
    if (typeof fechaInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput.trim())) {
      const [y, m, day] = fechaInput.trim().split('-').map(Number)
      d = new Date(y, m - 1, day, 12, 0, 0)
    } else {
      d = typeof fechaInput === 'string' ? new Date(fechaInput) : fechaInput
    }
    if (isNaN(d.getTime())) return formatDateArg(fechaInput, fallback)
    const texto = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return texto.charAt(0).toUpperCase() + texto.slice(1)
  } catch {
    return formatDateArg(fechaInput, fallback)
  }
}
