/**
 * Utilidad de Cálculo Biométrico: Fórmula Teórica SRK/T (Sanders, Retzlaff, Kraff)
 * Referencia: Sanders DR, Retzlaff JA, Kraff MC. Development of the SRK/T intraocular lens implant power calculation formula.
 * J Cataract Refract Surg. 1990;16(3):333-340.
 */

export interface ParametrosBiometriaSRKT {
  longitudAxial: number // AL en mm (ej. 23.50)
  k1: number            // Queratometría K1 en Dioptrías (ej. 43.50)
  k2: number            // Queratometría K2 en Dioptrías (ej. 44.00)
  constanteA: number    // Constante A del fabricante del LIO (ej. 118.9)
  targetRefractivo?: number // Target refractivo en Dioptrías (ej. -0.25 para miopía leve, 0 para emetropía)
}

export interface ResultadoSRKT {
  poderEmetropia: number        // Dioptría exacta para emetropía (0.00 D)
  poderObjetivo: number         // Dioptría calculada para el target elegido
  dioptriaSugerida: number      // Dioptría redondeada a pasos de 0.50 D
  refraccionEsperada: number    // Refracción residual estimada postoperatoria con dioptría sugerida
  kMedio: number                // Promedio queratométrico (K)
  acdEstimado: number           // Profundidad de cámara anterior predicha (ACD)
  tablaOpciones: Array<{
    dioptria: number
    refraccionResidual: number
  }>
}

export function calcularSRKT(params: ParametrosBiometriaSRKT): ResultadoSRKT {
  const { longitudAxial: L, k1, k2, constanteA: A, targetRefractivo: RefTarget = 0.0 } = params

  const n_cornea = 1.3375  // Índice queratométrico
  const n_acuoso = 1.336   // Índice del humor acuoso y vítreo

  // 1. Promedio queratométrico K
  const K = (k1 + k2) / 2.0
  const r = 337.5 / K // Radio de curvatura corneal en mm

  // 2. Corrección de Longitud Axial según SRK/T para ojos largos (L > 24.2 mm)
  let L_corr = L
  if (L > 24.2) {
    L_corr = -3.446 + 1.716 * L - 0.0237 * (L * L)
  }

  // 3. Altura de domo corneal (Cormeal Dome Height - C)
  const diametroCorneal = 0.7 * L_corr // Ancho de base corneal estimado (W)
  const W = Math.min(Math.max(diametroCorneal, 9.0), 14.5) // Limitar entre 9 y 14.5 mm
  
  // Altura sagital corneal (H)
  const radTerm = Math.max(0.001, (r * r) - ((W * W) / 4.0))
  const H = r - Math.sqrt(radTerm)

  // 4. ACD postoperatorio estimado (ACD_est)
  // Fórmula empírica SRK/T: ACD_const = 0.62467 * A - 68.747 - 3.336
  const ACD_const = (0.62467 * A) - 68.747 - 3.336
  const ACD_est = H + ACD_const

  // 5. Cálculo del Poder de Emetropía (P_em)
  // Ecuación de vergencia clásica para foco en retina:
  // P_em = (1000 * n_acuoso * (n_acuoso - (n_cornea * L_corr * 0.001) - 0.001 * K * (n_acuoso - n_cornea))) / ...
  const num_em = 1000.0 * n_acuoso * (n_acuoso * r - (n_cornea - 1.0) * L_corr)
  const den_em = (L_corr - ACD_est) * (n_acuoso * r - (n_cornea - 1.0) * ACD_est)
  const P_em = num_em / Math.max(0.01, den_em)

  // 6. Ajuste para Target Refractivo
  // Función para obtener poder de LIO dado un target de refracción R:
  const calcularPoderParaTarget = (R: number): number => {
    // V = distancia al vértice (12 mm estándar = 0.012 m)
    const V = 0.012
    const R_cornea = R / (1.0 - V * R) // Refracción transferida al plano corneal
    const num = 1000.0 * n_acuoso * (n_acuoso * r - (n_cornea - 1.0 + (r * R_cornea / 1000.0)) * L_corr)
    const den = (L_corr - ACD_est) * (n_acuoso * r - (n_cornea - 1.0 + (r * R_cornea / 1000.0)) * ACD_est)
    return num / Math.max(0.01, den)
  }

  // Función inversa: Dada una Dioptría de LIO comercial (IOL), ¿cuál es la refracción residual en anteojos?
  const calcularRefraccionParaIOL = (IOL: number): number => {
    // Aproximación de vergencia directa
    const deltaP = IOL - P_em
    // Factor de cambio refractivo estándar según longitud axial (~1.25 a 1.45 D de LIO por 1.0 D en anteojos)
    const ratio = 1.0 + (L_corr - 23.5) * 0.04
    const R_aprox = -deltaP / (1.35 * Math.max(0.8, ratio))
    return Math.round(R_aprox * 100) / 100
  }

  const P_target = calcularPoderParaTarget(RefTarget)
  const dioptriaSugerida = Math.round(P_target * 2) / 2 // Redondeo a 0.50 D

  // Construir tabla de 5 opciones contiguas (-1.0, -0.5, 0.0, +0.5, +1.0 D)
  const tablaOpciones = []
  for (let step = -2; step <= 2; step++) {
    const diop = dioptriaSugerida + step * 0.5
    tablaOpciones.push({
      dioptria: Math.round(diop * 100) / 100,
      refraccionResidual: calcularRefraccionParaIOL(diop)
    })
  }

  return {
    poderEmetropia: Math.round(P_em * 100) / 100,
    poderObjetivo: Math.round(P_target * 100) / 100,
    dioptriaSugerida,
    refraccionEsperada: calcularRefraccionParaIOL(dioptriaSugerida),
    kMedio: Math.round(K * 100) / 100,
    acdEstimado: Math.round(ACD_est * 100) / 100,
    tablaOpciones
  }
}
