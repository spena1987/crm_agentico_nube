/**
 * Utilidad de normalización y formateo de números de teléfono para Argentina y WhatsApp.
 */

export function cleanPhoneDigits(raw: string): string {
  if (!raw) return ''
  const str = String(raw).split('@')[0]
  return str.replace(/\D/g, '')
}

export function normalizePhoneNumber(raw: string, defaultAreaCode: string = '11'): string {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = cleanPhoneDigits(trimmed)
  if (!digits) return ''

  // 1. Números internacionales explícitos que no son de Argentina
  if (hasPlus && !digits.startsWith('54')) {
    return digits
  }

  // Prefijos extranjeros conocidos
  if (!digits.startsWith('54') && !digits.startsWith('0')) {
    if (
      (digits.startsWith('56') && digits.length === 11) || // Chile
      (digits.startsWith('598') && digits.length === 11) || // Uruguay
      (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) || // Brasil
      (digits.startsWith('34') && digits.length === 11) || // España
      (digits.startsWith('1') && digits.length === 11) // USA
    ) {
      return digits
    }
  }

  // 2. Argentina
  if (digits.startsWith('549')) {
    let resto = digits.slice(3)
    if (resto.startsWith('0')) resto = resto.slice(1)
    resto = remove15Argentina(resto)
    if (resto.length === 8) resto = defaultAreaCode + resto
    return `549${resto}`
  }

  if (digits.startsWith('54')) {
    let resto = digits.slice(2)
    if (resto.startsWith('0')) resto = resto.slice(1)
    resto = remove15Argentina(resto)
    if (resto.length === 8) resto = defaultAreaCode + resto
    return `549${resto}`
  }

  if (digits.startsWith('0')) {
    let resto = digits.slice(1)
    resto = remove15Argentina(resto)
    if (resto.length === 8) resto = defaultAreaCode + resto
    return `549${resto}`
  }

  if (digits.startsWith('15') && digits.length === 10) {
    const local = digits.slice(2)
    return `549${defaultAreaCode}${local}`
  }

  if (digits.length === 10) {
    let resto = remove15Argentina(digits)
    if (resto.length === 8) resto = defaultAreaCode + resto
    return `549${resto}`
  }

  if (digits.length === 11 || digits.length === 12) {
    let resto = remove15Argentina(digits)
    if (resto.length === 8) resto = defaultAreaCode + resto
    return `549${resto}`
  }

  if (digits.length === 8) {
    return `549${defaultAreaCode}${digits}`
  }

  if (!digits.startsWith('549')) {
    return `549${digits}`
  }

  return digits
}

function remove15Argentina(numSinPais: string): string {
  if (numSinPais.startsWith('1115') && numSinPais.length >= 11) {
    return '11' + numSinPais.slice(4)
  }

  const area3 = ['351', '341', '221', '223', '261', '381', '387', '299', '342', '379', '388']
  for (const pref of area3) {
    if (numSinPais.startsWith(pref + '15') && numSinPais.length >= 11) {
      return pref + numSinPais.slice(5)
    }
  }

  if (numSinPais.startsWith('15') && numSinPais.length === 10) {
    return numSinPais.slice(2)
  }

  return numSinPais
}

export function formatPhoneDisplay(raw: string): string {
  if (!raw) return ''
  const normalized = normalizePhoneNumber(raw)

  if (normalized.startsWith('549')) {
    const resto = normalized.slice(3)
    // AMBA 11
    if (resto.startsWith('11') && resto.length === 10) {
      const area = resto.slice(0, 2)
      const p1 = resto.slice(2, 6)
      const p2 = resto.slice(6)
      return `+54 9 ${area} ${p1}-${p2}`
    }
    // 3 dígitos de área
    if (resto.length === 10) {
      const area = resto.slice(0, 3)
      const p1 = resto.slice(3, 6)
      const p2 = resto.slice(6)
      return `+54 9 ${area} ${p1}-${p2}`
    }
    return `+54 9 ${resto}`
  }

  return `+${normalized}`
}

/**
 * Extrae únicamente la porción nacional/local de un número argentino (ej: 2614703230 o 1145678901).
 * Si el número viene como 5492614703230, +54 9 261 470-3230, o 0261 15 4703230,
 * remueve los prefijos internacionales (54, 549), el 0 inicial y el 15.
 */
export function extractLocalArgentineNumber(raw: string): string {
  if (!raw) return ''
  const digits = cleanPhoneDigits(raw)
  if (!digits) return ''

  // Si empieza con 549, quitar 549
  if (digits.startsWith('549')) {
    let local = digits.slice(3)
    if (local.startsWith('0')) local = local.slice(1)
    return remove15Argentina(local)
  }

  // Si empieza con 54 (pero no 549)
  if (digits.startsWith('54')) {
    let local = digits.slice(2)
    if (local.startsWith('0')) local = local.slice(1)
    return remove15Argentina(local)
  }

  // Si empieza con 0 (ej: 0261...)
  if (digits.startsWith('0')) {
    let local = digits.slice(1)
    return remove15Argentina(local)
  }

  // Si tiene 15 al inicio o intercalado
  return remove15Argentina(digits)
}

/**
 * Limpia los caracteres mientras el usuario tipea en el campo local.
 * Descarta letras, símbolos, y si el usuario ingresó por costumbre un 0 o un 15,
 * los elimina para mantener el formato argentino estándar de 10 dígitos (área + abonado).
 */
export function cleanLocalInputDigits(input: string, countryPrefix: string = '549'): string {
  if (!input) return ''
  // Si no es Argentina (+54 9), solo limpiamos caracteres no numéricos
  if (countryPrefix !== '549') {
    return cleanPhoneDigits(input)
  }

  let clean = cleanPhoneDigits(input)

  // Si el usuario pegó el número completo con 549...
  if (clean.startsWith('549') && clean.length > 5) {
    clean = clean.slice(3)
  } else if (clean.startsWith('54') && clean.length > 4) {
    clean = clean.slice(2)
  }

  // Si comienza con 0 (ej: 0261...), eliminar el 0 inicial
  if (clean.startsWith('0') && clean.length > 1) {
    clean = clean.slice(1)
  }

  // Si tiene 15 intercalado (ej: 261 15 4703230)
  clean = remove15Argentina(clean)

  // Máximo 10 dígitos en Argentina (ej: 261 470 3230)
  return clean.slice(0, 10)
}

/**
 * Ensambla el número internacional E.164 final para WhatsApp y la base de datos.
 */
export function assembleInternationalPhone(localDigits: string, countryPrefix: string = '549'): string {
  const clean = cleanPhoneDigits(localDigits)
  if (!clean) return ''

  if (countryPrefix === '549') {
    if (clean.startsWith('549')) return clean
    const local = extractLocalArgentineNumber(clean)
    return `549${local}`
  }

  // Otros países (ej: 569, 598, etc.)
  if (clean.startsWith(countryPrefix)) return clean
  return `${countryPrefix}${clean}`
}

/**
 * Formatea dígitos locales para mostrar con espacios legibles (ej: 261 470-3230 o 11 4123-4567).
 */
export function formatLocalDisplay(localDigits: string): string {
  const clean = cleanPhoneDigits(localDigits)
  if (!clean) return ''

  // AMBA (11)
  if (clean.startsWith('11') && clean.length >= 6) {
    const area = clean.slice(0, 2)
    const p1 = clean.slice(2, 6)
    const p2 = clean.slice(6)
    return p2 ? `${area} ${p1}-${p2}` : `${area} ${p1}`
  }

  // 3 dígitos de área (ej: 261, 351, 341)
  if (clean.length >= 7) {
    const area = clean.slice(0, 3)
    const p1 = clean.slice(3, 6)
    const p2 = clean.slice(6)
    return p2 ? `${area} ${p1}-${p2}` : `${area} ${p1}`
  }

  return clean
}

