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
