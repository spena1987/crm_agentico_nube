export interface EstudioPresetItem {
  id: string
  nombre: string
  activo: boolean
  orden: number
}

export interface EstudiosOperacionConfig {
  ojo_default: 'AO' | 'OD' | 'OI'
  unificar_en_pdf_default: boolean
  aplicar_caratula_default: boolean
}

export interface EstudiosOftalmologicosConfig {
  presets: EstudioPresetItem[]
  operacion: EstudiosOperacionConfig
  caratula_activa?: boolean
}

export const DEFAULT_ESTUDIOS_PRESETS: EstudioPresetItem[] = [
  { id: 'oct_macular_papilar', nombre: 'OCT Macular y Papilar', activo: true, orden: 1 },
  { id: 'campo_visual', nombre: 'Campo Visual Computarizado', activo: true, orden: 2 },
  { id: 'topografia_corneal', nombre: 'Topografía Corneal (Pentacam)', activo: true, orden: 3 },
  { id: 'biometria_ocular', nombre: 'Biometría Ocular (IOL Master)', activo: true, orden: 4 },
  { id: 'paquimetria_corneal', nombre: 'Paquimetría Corneal', activo: true, orden: 5 },
  { id: 'retinografia_color', nombre: 'Retinografía Color', activo: true, orden: 6 },
  { id: 'ecografia_ocular', nombre: 'Ecografía Ocular Modo A/B', activo: true, orden: 7 },
  { id: 'recuento_endotelial', nombre: 'Recuento Endotelial', activo: true, orden: 8 },
  { id: 'aberrometria_opd', nombre: 'Aberrometría / OPD Scan', activo: true, orden: 9 },
  { id: 'meibografia_ojo_seco', nombre: 'Meibografía / Ojo Seco', activo: true, orden: 10 },
]

export const DEFAULT_ESTUDIOS_OPERACION: EstudiosOperacionConfig = {
  ojo_default: 'AO',
  unificar_en_pdf_default: true,
  aplicar_caratula_default: true,
}

export const GECLISA_MAX_TITLE_CHARS = 45
export const GECLISA_RECOMMENDED_TAG_CHARS = 30

export function getGeclisaTitleInfo(nombre: string, ojo = 'AO') {
  const cleanName = (nombre || '').trim()
  const cleanOjo = (ojo || 'AO').trim() || 'AO'
  const geclisaTitle = cleanName ? `Estudio - ${cleanName} (${cleanOjo})` : ''
  return {
    geclisaTitle,
    length: geclisaTitle.length,
    exceedsLimit: geclisaTitle.length > GECLISA_MAX_TITLE_CHARS,
    tagLength: cleanName.length,
    exceedsRecommendedTag: cleanName.length > GECLISA_RECOMMENDED_TAG_CHARS,
  }
}
