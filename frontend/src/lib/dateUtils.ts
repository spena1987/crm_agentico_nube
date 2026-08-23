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