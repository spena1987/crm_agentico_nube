/**
 * Pure clinical formatting and IOL evaluation helpers for A4 surgical chest stickers.
 */

export interface TurnoCartelLioInput {
  practica_nombre?: string | null
  lleva_lente?: boolean | null
  lente_tipo?: string | null
  lente_dioptria?: string | number | null
  lente_incision_grados?: string | number | null
  lente_torico_valor?: string | number | null
  lente_torico_eje?: string | number | null
  lente_lote?: string | null
}

export type EstadoBloqueLio = 'CARGADO' | 'NO_CALCULADA' | 'OCULTO'

export interface ResultadoBloqueLio {
  tieneLioCargado: boolean
  exigeLioClinico: boolean
  estado: EstadoBloqueLio
  mostrarBloque: boolean
  incisionTexto: string | null
  dioptriaTexto: string
  toricoValorTexto: string | null
  toricoEjeTexto: string | null
  tipoTexto: string | null
}

/**
 * Checks whether a value is clinically present, preserving numeric 0 (e.g. 0 D or 0°).
 */
export function esValorPresente(val: unknown): boolean {
  return val !== null && val !== undefined && String(val).trim() !== ''
}

/**
 * Formats an Argentine clinical DNI by stripping leading zeros and adding thousand dots.
 */
export function formatearDniClinico(dni?: string | number | null): string {
  if (dni === null || dni === undefined || dni === '') return 'S/D'
  const limpio = String(dni).replace(/\D/g, '').replace(/^0+/, '')
  if (!limpio) return 'S/D'
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Formats a surgical date string (YYYY-MM-DD or ISO) to DD/MM/YYYY.
 */
export function formatearFechaCirugia(f?: string | null): string {
  if (!f) return ''
  try {
    const parte = f.split('T')[0]
    const [y, m, d] = parte.split('-')
    if (y && m && d) return `${d}/${m}/${y}`
    return f
  } catch {
    return f
  }
}

const PALABRAS_NEGACION_LIO = [
  'SIN LIO',
  'SIN LENTE',
  'EXPLANTE',
  'RETIRO',
  'EXTRACCION DE LIO',
  'EXTRACCIÓN DE LIO',
]

const PALABRAS_EXIGENCIA_LIO = ['CATARATA', 'FACO', 'LIO', 'LENTE', 'ICL', 'IMPL']

/**
 * Determines whether a surgical procedure clinically requires an IOL.
 * Explicit `llevaLente === false` or negation keywords override positive procedure matches.
 */
export function requiereLenteSemantico(
  practicaNombre?: string | null,
  llevaLente?: boolean | null
): boolean {
  if (llevaLente === true) return true
  if (llevaLente === false) return false
  if (!practicaNombre) return false

  const p = practicaNombre.toUpperCase()
  if (PALABRAS_NEGACION_LIO.some((neg) => p.includes(neg))) {
    return false
  }
  return PALABRAS_EXIGENCIA_LIO.some((pos) => p.includes(pos))
}

/**
 * Evaluates IOL display state and formatted clinical fields for a surgical sticker.
 */
export function evaluarBloqueLio(turno: TurnoCartelLioInput): ResultadoBloqueLio {
  const tieneLioCargado = Boolean(
    turno.lleva_lente &&
      (esValorPresente(turno.lente_tipo) || esValorPresente(turno.lente_dioptria))
  )
  const exigeLioClinico = requiereLenteSemantico(turno.practica_nombre, turno.lleva_lente)

  const estado: EstadoBloqueLio = tieneLioCargado
    ? 'CARGADO'
    : exigeLioClinico
      ? 'NO_CALCULADA'
      : 'OCULTO'

  const incisionTexto = esValorPresente(turno.lente_incision_grados)
    ? `${String(turno.lente_incision_grados).trim()}°`
    : null

  const dioptriaTexto = esValorPresente(turno.lente_dioptria)
    ? `${String(turno.lente_dioptria).trim()} D`
    : 'S/D'

  const tieneTorico = esValorPresente(turno.lente_torico_valor)
  const toricoValorTexto = tieneTorico ? `T${String(turno.lente_torico_valor).trim()}` : null
  const toricoEjeTexto =
    tieneTorico && esValorPresente(turno.lente_torico_eje)
      ? `${String(turno.lente_torico_eje).trim()}°`
      : null

  const tipoTexto = esValorPresente(turno.lente_tipo) ? String(turno.lente_tipo).trim() : null

  return {
    tieneLioCargado,
    exigeLioClinico,
    estado,
    mostrarBloque: estado !== 'OCULTO',
    incisionTexto,
    dioptriaTexto,
    toricoValorTexto,
    toricoEjeTexto,
    tipoTexto,
  }
}

/**
 * Returns the CSS typography tier class for a surgical procedure name so it fits cleanly within 2 lines.
 */
export function obtenerClasePractica(
  practicaNombre?: string | null,
  formato: '3x2' | '4x2' = '3x2'
): string {
  const limpio = (practicaNombre || 'Cirugía Oftalmológica').trim().replace(/\s+/g, ' ')
  const texto = limpio || 'Cirugía Oftalmológica'
  const len = texto.length
  const tier = len <= 26 ? 'lg' : len <= 45 ? 'md' : 'sm'
  return `sticker-proc-${formato}-${tier}`
}
