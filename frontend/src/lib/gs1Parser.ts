/**
 * Parser de códigos GS1 DataMatrix y GS1 QR para Lentes Intraoculares (LIO) y Dispositivos Médicos (UDI).
 *
 * Soporta:
 * 1. Formato con identificadores entre paréntesis: (01)00380658428867(17)281130(10)LOT123(21)SN456
 * 2. Formato raw stream con separador de grupo ASCII 29 (\x1d o <GS>): 01003806584288671728113010LOT123\x1d21SN456
 * 3. Formato raw continuo estándar donde campos fijos preceden a campos variables
 * 4. GS1 Digital Link (URLs con identificadores de aplicación o query params)
 */

export interface Gs1ParsedData {
  gtin: string | null
  gtin14: string | null
  lote: string | null
  vencimiento: string | null // Formato ISO YYYY-MM-DD
  vencimientoRaw: string | null // Formato YYMMDD
  serie: string | null
  estaVencido: boolean
  diasParaVencer: number | null
  raw: string
  esValido: boolean
  formatoDetectado: 'parentesis' | 'stream_fnc1' | 'digital_link' | 'gtin_puro' | 'desconocido'
}

/**
 * Convierte fecha de caducidad GS1 (YYMMDD) a formato ISO (YYYY-MM-DD).
 * Si el día es '00', se asume el último día del mes correspondiente.
 */
export function parseGs1Date(yymmdd: string): { iso: string; estaVencido: boolean; dias: number } | null {
  if (!yymmdd || yymmdd.length !== 6 || !/^\d{6}$/.test(yymmdd)) {
    return null
  }

  const yy = parseInt(yymmdd.substring(0, 2), 10)
  const mm = parseInt(yymmdd.substring(2, 4), 10)
  let dd = parseInt(yymmdd.substring(4, 6), 10)

  // En GS1, años 51-99 son 1951-1999; años 00-50 son 2000-2050
  const year = yy >= 51 ? 1900 + yy : 2000 + yy

  if (mm < 1 || mm > 12) return null

  // Si dd es 00, se toma el último día del mes
  if (dd === 0) {
    const ultimoDia = new Date(year, mm, 0).getDate()
    dd = ultimoDia
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${year}-${pad(mm)}-${pad(dd)}`

  const fechaVto = new Date(year, mm - 1, dd, 23, 59, 59)
  const hoy = new Date()

  const diffMs = fechaVto.getTime() - hoy.getTime()
  const dias = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const estaVencido = diffMs < 0

  return { iso, estaVencido, dias }
}

/**
 * Normaliza un código GTIN a 14 dígitos con ceros a la izquierda.
 */
export function normalizarGtin14(gtin: string | null | undefined): string | null {
  if (!gtin) return null
  const limpio = gtin.replace(/\D/g, '')
  if (limpio.length === 0) return null
  return limpio.padStart(14, '0')
}

/**
 * Parsea una cadena de escáner GS1 DataMatrix / QR
 */
export function parseGs1Code(rawInput: string): Gs1ParsedData {
  const result: Gs1ParsedData = {
    gtin: null,
    gtin14: null,
    lote: null,
    vencimiento: null,
    vencimientoRaw: null,
    serie: null,
    estaVencido: false,
    diasParaVencer: null,
    raw: rawInput || '',
    esValido: false,
    formatoDetectado: 'desconocido'
  }

  if (!rawInput || typeof rawInput !== 'string') {
    return result
  }

  const raw = rawInput.trim()

  // 1. GS1 Digital Link (ej. https://id.gs1.org/01/00380658428867/21/SN123?17=281130&10=LOT456)
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      result.formatoDetectado = 'digital_link'
      const url = new URL(raw)
      const pathParts = url.pathname.split('/').filter(Boolean)

      // Analizar partes del pathname por pares (/01/gtin/21/serie)
      for (let i = 0; i < pathParts.length - 1; i += 2) {
        const ai = pathParts[i]
        const val = pathParts[i + 1]
        if (ai === '01') result.gtin = val
        else if (ai === '10') result.lote = val
        else if (ai === '17') result.vencimientoRaw = val
        else if (ai === '21') result.serie = val
      }

      // Analizar search params (?17=281130&10=LOT456)
      url.searchParams.forEach((val, key) => {
        if (key === '01' || key === 'gtin') result.gtin = val
        else if (key === '10' || key === 'lot') result.lote = val
        else if (key === '17' || key === 'exp') result.vencimientoRaw = val
        else if (key === '21' || key === 'ser') result.serie = val
      })
    } catch {
      // Si falla como URL, continuar con parsers de texto
    }
  }

  // 2. Formato con identificadores entre paréntesis: (01)00380658428867(17)281130(10)LOT123(21)SN456
  if (!result.gtin && raw.includes('(01)')) {
    result.formatoDetectado = 'parentesis'
    const gtinMatch = raw.match(/\(01\)(\d{8,14})/)
    if (gtinMatch) result.gtin = gtinMatch[1]

    const vtoMatch = raw.match(/\(17\)(\d{6})/)
    if (vtoMatch) result.vencimientoRaw = vtoMatch[1]

    const loteMatch = raw.match(/\(10\)([^()]+)/)
    if (loteMatch) result.lote = loteMatch[1].trim()

    const serieMatch = raw.match(/\(21\)([^()]+)/)
    if (serieMatch) result.serie = serieMatch[1].trim()
  }

  // 3. Formato stream GS1 continuo (con separador ASCII 29 \x1d o sin delimitadores para campos fijos)
  if (!result.gtin) {
    // Reemplazar separadores comunes: ASCII 29 (\x1d), <GS>, ^]
    const GS = '\x1d'
    const cleanRaw = raw.replace(/<GS>/gi, GS).replace(/\^\]/g, GS)

    // Si comienza con 01 seguido de 14 dígitos
    if (/^01\d{14}/.test(cleanRaw)) {
      result.formatoDetectado = 'stream_fnc1'
      result.gtin = cleanRaw.substring(2, 16)
      let rem = cleanRaw.substring(16)

      // Procesar identificadores subsiguientes
      while (rem.length > 0) {
        if (rem.startsWith(GS)) {
          rem = rem.substring(1)
          continue
        }

        // AI 17: Expiración (6 dígitos fijos)
        if (rem.startsWith('17') && rem.length >= 8 && /^\d{6}/.test(rem.substring(2, 8))) {
          result.vencimientoRaw = rem.substring(2, 8)
          rem = rem.substring(8)
          continue
        }

        // AI 10: Lote (longitud variable, hasta 20 chars o hasta GS)
        if (rem.startsWith('10')) {
          rem = rem.substring(2)
          const nextGs = rem.indexOf(GS)
          if (nextGs !== -1) {
            result.lote = rem.substring(0, nextGs)
            rem = rem.substring(nextGs + 1)
          } else {
            // Si no hay GS pero después viene un AI conocido como 21 o 17
            const matchNextAi = rem.match(/(17\d{6}|21[a-zA-Z0-9]+)$/)
            if (matchNextAi && matchNextAi.index && matchNextAi.index > 0) {
              result.lote = rem.substring(0, matchNextAi.index)
              rem = rem.substring(matchNextAi.index)
            } else {
              result.lote = rem
              rem = ''
            }
          }
          continue
        }

        // AI 21: Serie (longitud variable, hasta 20 chars o hasta GS)
        if (rem.startsWith('21')) {
          rem = rem.substring(2)
          const nextGs = rem.indexOf(GS)
          if (nextGs !== -1) {
            result.serie = rem.substring(0, nextGs)
            rem = rem.substring(nextGs + 1)
          } else {
            result.serie = rem
            rem = ''
          }
          continue
        }

        // Si no coincide con ninguno, avanzar 1 carácter para evitar bucle infinito
        rem = rem.substring(1)
      }
    }
  }

  // 4. Fallback: Código numérico puro de 12 a 14 dígitos (código de barras GTIN directo / EAN-13)
  if (!result.gtin && /^\d{12,14}$/.test(raw)) {
    result.formatoDetectado = 'gtin_puro'
    result.gtin = raw
  }

  // Normalizar GTIN a 14 dígitos
  if (result.gtin) {
    result.gtin14 = normalizarGtin14(result.gtin)
  }

  // Procesar fecha de vencimiento si se encontró
  if (result.vencimientoRaw) {
    const fechaParsed = parseGs1Date(result.vencimientoRaw)
    if (fechaParsed) {
      result.vencimiento = fechaParsed.iso
      result.estaVencido = fechaParsed.estaVencido
      result.diasParaVencer = fechaParsed.dias
    }
  }

  // Determinar si es válido (mínimo debe tener GTIN o [Lote y Vencimiento])
  result.esValido = Boolean(result.gtin || (result.lote && result.vencimiento))

  return result
}
