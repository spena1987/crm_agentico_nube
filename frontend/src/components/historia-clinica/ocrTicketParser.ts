export interface ParsedEyeRef {
  esf?: string
  cil?: string
  eje?: string
  se?: string
}

export interface ParsedEyeKrt {
  r1?: { d: number; a: string }
  r2?: { d: number; a: string }
  cil?: string
  eje?: string
}

export interface ParsedTicketData {
  ref: {
    R?: ParsedEyeRef
    L?: ParsedEyeRef
  }
  krt: {
    R?: ParsedEyeKrt
    L?: ParsedEyeKrt
  }
  tono: {
    R?: number
    L?: number
  }
  pach: {
    R?: number
    L?: number
  }
  meta: {
    fecha?: string
    cylNeg?: boolean
  }
  found: string[]
}

export interface TicketRow {
  key: string
  label: string
  field: string
  value: string | number
  current: string | number
  target: 'arm' | 'k' | 'pio' | 'paq'
  selected: boolean
}

export function fixDigits(line: string): string {
  return line.split(/(\s+)/).map(tok => {
    if (!/\d/.test(tok)) return tok
    if (!/^[0-9OolI|SsBZz.,+\-]+$/.test(tok)) return tok
    return tok.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/[Ss]/g, '5')
              .replace(/B/g, '8').replace(/[Zz]/g, '2').replace(/,/g, '.')
  }).join('')
}

export function tkClean(raw: string): string[] {
  return raw.replace(/\r/g, '').replace(/[«〈]/g, '<').replace(/[»〉]/g, '>').replace(/[–—]/g, '-')
    .split('\n').map(l => fixDigits(l.trim())).map(l => l.replace(/([+-])\s+(?=[\d.])/g, '$1')).filter(l => l.length)
}

export function tkMarker(line: string): 'R' | 'L' | null {
  if (/\d\.\d/.test(line)) return null
  const m = line.match(/^[^A-Za-z0-9]*([RLrl])[^A-Za-z0-9]*(\s|$)/)
  return m ? (m[1].toUpperCase() as 'R' | 'L') : null
}

export const tkInts = (s: string): number[] => (s.match(/\d+/g) || []).map(Number)

export function parseTicket(raw: string): ParsedTicketData {
  const L = tkClean(raw)
  const find = (re: RegExp) => L.findIndex(l => re.test(l))
  const iRef = find(/REF\.?\s*DATA/i)
  const iKrt = find(/K(RT|ER)\.?\s*DATA/i)
  const iTono = find(/TONO\.?\s*DATA/i)
  const iPach = find(/PACH\.?\s*DATA/i)
  const iEnd = find(/IOP\s*ADJ|FORMULA/i)

  const rawMarks: [number, string][] = [
    [iRef, 'ref'], [iKrt, 'krt'], [iTono, 'tono'], [iPach, 'pach'], [iEnd, 'end']
  ]
  const marks = rawMarks.filter(m => m[0] >= 0).sort((a, b) => a[0] - b[0])

  const sec: Record<string, string[]> = {}
  marks.forEach((m, i) => {
    sec[m[1]] = L.slice(m[0] + 1, marks[i + 1] ? marks[i + 1][0] : L.length)
  })

  const out: ParsedTicketData = {
    ref: {},
    krt: {},
    tono: {},
    pach: {},
    meta: {},
    found: marks.map(m => m[1])
  }

  const head = L.slice(0, iRef >= 0 ? iRef + 3 : 6).join(' ')
  const fe = L.join(' ').match(/(\d{1,2})[_\-\/\s]([A-Z]{3})[_\-\/\s](\d{4})/i)
  if (fe) out.meta.fecha = fe[0].replace(/_/g, ' ')
  out.meta.cylNeg = !/CYL\s*:?\s*\(\s*\+\s*\)/i.test(head)

  if (sec.ref) {
    let eye: 'R' | 'L' | null = null
    for (const line of sec.ref) {
      if (/^P\.?D/i.test(line)) continue
      if (/S\.?\s*E\.?/i.test(line)) {
        const s = line.match(/([+-]?\d+\.\d{2})/)
        if (s && eye) {
          out.ref[eye] = out.ref[eye] || {}
          out.ref[eye]!.se = s[1]
        }
        continue
      }
      const mk = tkMarker(line)
      if (mk) { eye = mk; continue }
      const d = line.match(/([+-]?\d{1,2}\.\d{2})\s+([+-]?\d{1,2}\.\d{2})\s+(\d{1,3})\b/)
      if (d && eye) {
        out.ref[eye] = out.ref[eye] || {}
        out.ref[eye]!.esf = d[1]
        out.ref[eye]!.cil = d[2]
        out.ref[eye]!.eje = d[3]
      }
    }
  }

  if (sec.krt) {
    let eye: 'R' | 'L' | null = null
    for (const line of sec.krt) {
      const rn = line.match(/^R\s*([12])\b(.*)$/i)
      if (rn && eye) {
        const n = rn[2].match(/(\d{2}\.\d{2})\s+(\d\.\d{2})\s+(\d{1,3})/)
        if (n) {
          out.krt[eye] = out.krt[eye] || {}
          out.krt[eye]![('r' + rn[1]) as 'r1' | 'r2'] = { d: +n[1], a: n[3] }
        }
        continue
      }
      if (/CYL/i.test(line) && eye) {
        const n = line.match(/([+-]?\d{1,2}\.\d{2})\s+(\d{1,3})/)
        if (n) {
          out.krt[eye] = out.krt[eye] || {}
          out.krt[eye]!.cil = n[1]
          out.krt[eye]!.eje = n[2]
        }
        continue
      }
      if (/^AVG/i.test(line)) continue
      const mk = tkMarker(line)
      if (mk) eye = mk
    }
  }

  if (sec.tono) {
    for (const line of sec.tono) {
      if (/ADJ/i.test(line) && !/^[RL]\b/i.test(line)) continue
      const m = line.match(/^([RL])\b(?!\d)(.*)$/i)
      if (!m) continue
      const n = tkInts(m[2]).filter(x => x > 2 && x < 80)
      if (!n.length) continue
      const val = n.length > 2 ? n[n.length - 1] : Math.round(n.reduce((a, b) => a + b, 0) / n.length)
      out.tono[m[1].toUpperCase() as 'R' | 'L'] = val
    }
  }

  if (sec.pach) {
    for (const line of sec.pach) {
      const m = line.match(/^([RL])\b(?!\d)(.*)$/i)
      if (!m) continue
      const n = tkInts(m[2]).filter(x => x > 250 && x < 900)
      if (!n.length) continue
      out.pach[m[1].toUpperCase() as 'R' | 'L'] = n[n.length - 1]
    }
  }

  return out
}

export function buildTicketRows(p: ParsedTicketData, currentData?: Record<string, any>): TicketRow[] {
  const R: TicketRow[] = []
  const cur = (k: string) => (currentData ? currentData[k] || '' : '')

  const add = (k: string, lbl: string, fld: string, val: any, tgt: 'arm' | 'k' | 'pio' | 'paq') => {
    if (val !== undefined && val !== null && String(val).trim().length > 0) {
      R.push({ key: k, label: lbl, field: fld, value: val, current: cur(fld), target: tgt, selected: true })
    }
  }

  // ARM
  if (p.ref.R) {
    add('arm_od_esf', 'ARM OD Esfera', 'arm_od_esf', p.ref.R.esf, 'arm')
    add('arm_od_cil', 'ARM OD Cilindro', 'arm_od_cil', p.ref.R.cil, 'arm')
    add('arm_od_eje', 'ARM OD Eje', 'arm_od_eje', p.ref.R.eje, 'arm')
  }
  if (p.ref.L) {
    add('arm_oi_esf', 'ARM OI Esfera', 'arm_oi_esf', p.ref.L.esf, 'arm')
    add('arm_oi_cil', 'ARM OI Cilindro', 'arm_oi_cil', p.ref.L.cil, 'arm')
    add('arm_oi_eje', 'ARM OI Eje', 'arm_oi_eje', p.ref.L.eje, 'arm')
  }

  // K
  if (p.krt.R) {
    if (p.krt.R.r1) add('k_od_k1', 'K OD K1', 'k_od_k1', p.krt.R.r1.d.toFixed(2), 'k')
    if (p.krt.R.r2) {
      add('k_od_k2', 'K OD K2', 'k_od_k2', p.krt.R.r2.d.toFixed(2), 'k')
      add('k_od_ejec', 'K OD Eje curvo', 'k_od_ejec', p.krt.R.r2.a, 'k')
    }
    if (p.krt.R.cil) add('k_od_cil', 'K OD Cil', 'k_od_cil', p.krt.R.cil, 'k')
    if (p.krt.R.eje) add('k_od_eje', 'K OD Eje', 'k_od_eje', p.krt.R.eje, 'k')
  }
  if (p.krt.L) {
    if (p.krt.L.r1) add('k_oi_k1', 'K OI K1', 'k_oi_k1', p.krt.L.r1.d.toFixed(2), 'k')
    if (p.krt.L.r2) {
      add('k_oi_k2', 'K OI K2', 'k_oi_k2', p.krt.L.r2.d.toFixed(2), 'k')
      add('k_oi_ejec', 'K OI Eje curvo', 'k_oi_ejec', p.krt.L.r2.a, 'k')
    }
    if (p.krt.L.cil) add('k_oi_cil', 'K OI Cil', 'k_oi_cil', p.krt.L.cil, 'k')
    if (p.krt.L.eje) add('k_oi_eje', 'K OI Eje', 'k_oi_eje', p.krt.L.eje, 'k')
  }

  // PIO
  if (p.tono.R !== undefined) add('pio_od_aire', 'PIO aire OD', 'pio_od_aire', p.tono.R, 'pio')
  if (p.tono.L !== undefined) add('pio_oi_aire', 'PIO aire OI', 'pio_oi_aire', p.tono.L, 'pio')

  // Paquimetria
  if (p.pach.R !== undefined) add('paq_od_aire', 'Paquimetría OD', 'paq_od_aire', p.pach.R, 'paq')
  if (p.pach.L !== undefined) add('paq_oi_aire', 'Paquimetría OI', 'paq_oi_aire', p.pach.L, 'paq')

  return R
}

export const DEMO_TICKET = `[REF DATA]
VD:12.0  CYL:(-)
<< R >>
    S        C      A
 -1.25    -0.75    175
 -1.25    -0.75    175
 -1.50    -0.50    170
* -1.25   -0.75    175
S.E. -1.62

<< L >>
    S        C      A
 -2.00    -1.00     10
 -2.00    -1.00     12
 -2.25    -0.75      8
* -2.00   -1.00     10
S.E. -2.50

[KRT DATA]
<< R >>
       mm      D     DEG
R1   7.85   43.00     85
R2   7.65   44.12    175
AVG  7.75   43.56
CYL        -1.12    175

<< L >>
       mm      D     DEG
R1   7.80   43.25     95
R2   7.58   44.50      5
AVG  7.69   43.87
CYL        -1.25      5

[TONO DATA]
<< R >>
  15  16  15  [ 15 ]
<< L >>
  16  17  16  [ 16 ]

[PACH DATA]
<< R >>  538 um
<< L >>  542 um
`
