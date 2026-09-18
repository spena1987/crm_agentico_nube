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

  let raw = rawInput.trim()
  // Limpiar prefijo de simbología AIM (ej: ]d2 para GS1 DataMatrix, ]Q3 para GS1 QR, ]C1 para GS1-128)
  if (raw.startsWith(']d2') || raw.startsWith(']Q3') || raw.startsWith(']C1') || raw.startsWith(']E0') || raw.startsWith(']e0')) {
    raw = raw.substring(3)
  }

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

// ====================================================================
// PROCESAMIENTO UNIVERSAL DE ENTRADAS DE ESCÁNER (1D COMÚN Y 2D GS1)
// ====================================================================

export type TipoCodigoDetectado =
  | 'gs1_datamatrix'
  | 'gs1_stream'
  | 'upc_a'
  | 'ean_13'
  | 'ean_8'
  | 'gtin_14'
  | 'texto_alfanumerico'

export interface ResultadoLecturaCodigo {
  gtin14: string | null         // GTIN normalizado a 14 dígitos (ej: "00380658437817")
  gtinOriginal: string | null   // GTIN original antes de padding con ceros (12 o 13 dígitos)
  tipoCodigo: TipoCodigoDetectado
  descripcionTipo: string       // Mensaje descriptivo para badges de interfaz
  lote: string | null           // Si vino de GS1
  vencimiento: string | null    // YYYY-MM-DD si vino de GS1
  serie: string | null          // Si vino de GS1
  esGs1: boolean                // true si es formato GS1 compuesto
  esCodigoBarras1D: boolean     // true si es UPC-A, EAN-13, EAN-8 o GTIN-14 común
  esValidoParaGtin: boolean     // true si se resolvió un GTIN-14 válido
  rawOriginal: string
}

/**
 * Procesa cualquier entrada proveniente de un lector de código de barras (1D o 2D) o teclado,
 * identificando el estándar (GS1 DataMatrix, UPC-A, EAN-13, ITF-14 o texto libre) y
 * normalizando inmediatamente el GTIN de 14 dígitos.
 */
export function procesarLecturaCodigo(rawInput: string): ResultadoLecturaCodigo {
  const rawOriginal = rawInput || ''
  // Limpiar saltos de línea (\r, \n) típicos del sufijo Enter del escáner y espacios
  let clean = rawOriginal.replace(/[\r\n\t]/g, '').trim()

  const fallbackResult: ResultadoLecturaCodigo = {
    gtin14: null,
    gtinOriginal: null,
    tipoCodigo: 'texto_alfanumerico',
    descripcionTipo: 'Texto / Búsqueda libre',
    lote: null,
    vencimiento: null,
    serie: null,
    esGs1: false,
    esCodigoBarras1D: false,
    esValidoParaGtin: false,
    rawOriginal
  }

  if (!clean) return fallbackResult

  // 1. Limpieza de prefijos de simbología AIM emitidos por escáneres 2D/1D
  // ]d2 = GS1 DataMatrix, ]Q3 = GS1 QR, ]C1 = GS1-128, ]E0 = EAN-13, ]A0 = Code 39
  let sinPrefijoAim = clean
  if (clean.startsWith(']d2') || clean.startsWith(']Q3') || clean.startsWith(']C1')) {
    sinPrefijoAim = clean.substring(3)
  } else if (clean.startsWith(']E0') || clean.startsWith(']e0')) {
    sinPrefijoAim = clean.substring(3)
  }

  // 2. Detección de GS1 con identificadores entre paréntesis: (01)0038065...
  if (sinPrefijoAim.includes('(01)')) {
    const parsed = parseGs1Code(sinPrefijoAim)
    if (parsed.gtin14 && parsed.gtin14.length === 14) {
      return {
        gtin14: parsed.gtin14,
        gtinOriginal: parsed.gtin,
        tipoCodigo: 'gs1_datamatrix',
        descripcionTipo: 'GS1 DataMatrix / GS1-128',
        lote: parsed.lote,
        vencimiento: parsed.vencimiento,
        serie: parsed.serie,
        esGs1: true,
        esCodigoBarras1D: false,
        esValidoParaGtin: true,
        rawOriginal
      }
    }
  }

  // 3. Detección de GS1 stream continuo FNC1 (ej: 010038065843781717281130...)
  if (/^01\d{14}/.test(sinPrefijoAim) && sinPrefijoAim.length > 16) {
    const parsed = parseGs1Code(sinPrefijoAim)
    if (parsed.gtin14 && parsed.gtin14.length === 14) {
      return {
        gtin14: parsed.gtin14,
        gtinOriginal: parsed.gtin,
        tipoCodigo: 'gs1_stream',
        descripcionTipo: 'GS1 DataMatrix (Stream FNC1)',
        lote: parsed.lote,
        vencimiento: parsed.vencimiento,
        serie: parsed.serie,
        esGs1: true,
        esCodigoBarras1D: false,
        esValidoParaGtin: true,
        rawOriginal
      }
    }
  }

  // 4. Detección de Códigos de Barra Comunes 1D (Numéricos Puros)
  const soloDigitos = sinPrefijoAim.replace(/\D/g, '')

  if (soloDigitos === sinPrefijoAim) {
    // UPC-A (12 dígitos numéricos — Estándar Alcon USA)
    if (sinPrefijoAim.length === 12) {
      const gtin14 = '00' + sinPrefijoAim
      return {
        gtin14,
        gtinOriginal: sinPrefijoAim,
        tipoCodigo: 'upc_a',
        descripcionTipo: 'Código de Barra 1D (UPC-A → GTIN-14)',
        lote: null,
        vencimiento: null,
        serie: null,
        esGs1: false,
        esCodigoBarras1D: true,
        esValidoParaGtin: true,
        rawOriginal
      }
    }

    // EAN-13 (13 dígitos numéricos — Estándar Internacional / Nacional)
    if (sinPrefijoAim.length === 13) {
      const gtin14 = '0' + sinPrefijoAim
      return {
        gtin14,
        gtinOriginal: sinPrefijoAim,
        tipoCodigo: 'ean_13',
        descripcionTipo: 'Código de Barra 1D (EAN-13 → GTIN-14)',
        lote: null,
        vencimiento: null,
        serie: null,
        esGs1: false,
        esCodigoBarras1D: true,
        esValidoParaGtin: true,
        rawOriginal
      }
    }

    // GTIN-14 / ITF-14 (14 dígitos numéricos directos)
    if (sinPrefijoAim.length === 14) {
      return {
        gtin14: sinPrefijoAim,
        gtinOriginal: sinPrefijoAim,
        tipoCodigo: 'gtin_14',
        descripcionTipo: 'Código de Barra GTIN-14',
        lote: null,
        vencimiento: null,
        serie: null,
        esGs1: false,
        esCodigoBarras1D: true,
        esValidoParaGtin: true,
        rawOriginal
      }
    }

    // EAN-8 (8 dígitos numéricos)
    if (sinPrefijoAim.length === 8) {
      const gtin14 = '000000' + sinPrefijoAim
      return {
        gtin14,
        gtinOriginal: sinPrefijoAim,
        tipoCodigo: 'ean_8',
        descripcionTipo: 'Código de Barra 1D (EAN-8 → GTIN-14)',
        lote: null,
        vencimiento: null,
        serie: null,
        esGs1: false,
        esCodigoBarras1D: true,
        esValidoParaGtin: true,
        rawOriginal
      }
    }
  }

  // 5. Fallback a texto normal (nombre de modelo, dioptría, referencia o código interno alfanumérico)
  return fallbackResult
}

/**
 * Extrae directamente el GTIN-14 normalizado si la entrada corresponde a un código
 * de escáner (GS1 o 1D común); de lo contrario retorna la cadena original limpia.
 */
export function extraerGtinDeEntrada(rawInput: string): string {
  const res = procesarLecturaCodigo(rawInput)
  return res.gtin14 || (rawInput || '').replace(/[\r\n\t]/g, '').trim()
}

/**
 * Identifica si una cadena escaneada corresponde a una Pulsera Quirúrgica de Paciente
 * (formatos: MEDCRM:QX:<uuid>, QX-<uuid>, URL con ?t=<uuid>, o UUID v4 directo).
 */
export function esCodigoPulseraPaciente(rawCode: string): { esPulsera: boolean; turnoId?: string } {
  if (!rawCode) return { esPulsera: false }
  const raw = rawCode.trim()

  // 1. Prefijo institucional MEDCRM:QX:<uuid>
  if (raw.toUpperCase().startsWith('MEDCRM:QX:')) {
    const partes = raw.split(':')
    if (partes.length >= 3 && partes[2].trim()) {
      return { esPulsera: true, turnoId: partes[2].trim() }
    }
  }

  // 2. Prefijo QX-<uuid> o QX:<uuid>
  if (raw.toUpperCase().startsWith('QX-') || raw.toUpperCase().startsWith('QX:')) {
    const id = raw.slice(3).trim()
    if (id) return { esPulsera: true, turnoId: id }
  }

  // 3. URL con query param ?t= o ?turno_id=
  if (raw.includes('http') && (raw.includes('?t=') || raw.includes('?turno_id='))) {
    try {
      const url = new URL(raw)
      const t = url.searchParams.get('t') || url.searchParams.get('turno_id')
      if (t) return { esPulsera: true, turnoId: t.trim() }
    } catch {
      // Ignorar fallo de parseo de URL
    }
  }

  // 4. UUID directo (36 caracteres hexadecimales con 4 guiones)
  if (raw.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return { esPulsera: true, turnoId: raw }
  }

  return { esPulsera: false }
}

/**
 * Determina si una cadena escaneada corresponde a un código de Lente Intraocular (DataMatrix GS1 / 1D).
 */
export function esCodigoLioGs1(rawCode: string): boolean {
  if (!rawCode) return false
  const raw = rawCode.trim()

  // Si contiene el AI (01) típico de DataMatrix médico
  if (raw.includes('(01)') && raw.length >= 12) return true

  // Si tiene prefijo AIM de DataMatrix GS1
  if (raw.startsWith(']d2') || raw.startsWith(']Q3') || raw.startsWith(']C1')) return true

  // Si inicia con stream numérico 01 seguido de 14 dígitos
  if (/^01\d{14}/.test(raw)) return true

  // Si es un Digital Link de GS1 con /01/
  if ((raw.startsWith('http://') || raw.startsWith('https://')) && (raw.includes('/01/') || raw.includes('gtin='))) return true

  return false
}

export type TipoClasificacionEscaneo =
  | { tipo: 'PULSERA_PACIENTE'; turnoId: string; raw: string }
  | { tipo: 'LIO_DATAMATRIX'; gs1: Gs1ParsedData; raw: string }
  | { tipo: 'CODIGO_1D_GTIN'; gtin14: string; raw: string }
  | { tipo: 'DESCONOCIDO'; raw: string }

/**
 * Clasifica inmediatamente cualquier lectura de escáner en base a su sintaxis y estructura.
 */
export function clasificarLecturaEscaneo(rawInput: string): TipoClasificacionEscaneo {
  const raw = (rawInput || '').replace(/[\r\n\t]/g, '').trim()
  if (!raw) return { tipo: 'DESCONOCIDO', raw: '' }

  // 1. Pulsera de paciente
  const checkPulsera = esCodigoPulseraPaciente(raw)
  if (checkPulsera.esPulsera && checkPulsera.turnoId) {
    return { tipo: 'PULSERA_PACIENTE', turnoId: checkPulsera.turnoId, raw }
  }

  // 2. DataMatrix GS1 de LIO
  if (esCodigoLioGs1(raw)) {
    const parsedGs1 = parseGs1Code(raw)
    return { tipo: 'LIO_DATAMATRIX', gs1: parsedGs1, raw }
  }

  // 3. Código de barra 1D estándar de producto (UPC / EAN / GTIN puro)
  if (/^\d{8,14}$/.test(raw)) {
    const res1D = procesarLecturaCodigo(raw)
    if (res1D.gtin14) {
      return { tipo: 'CODIGO_1D_GTIN', gtin14: res1D.gtin14, raw }
    }
  }

  // 4. Intentar parseo GS1 genérico por si tiene AIs combinados
  const posibleGs1 = parseGs1Code(raw)
  if (posibleGs1.esValido && posibleGs1.gtin) {
    return { tipo: 'LIO_DATAMATRIX', gs1: posibleGs1, raw }
  }

  return { tipo: 'DESCONOCIDO', raw }
}

