export interface PacienteData {
  id: string
  telefono?: string | null
  nombre: string
  email?: string | null
  geclisa_ficha_id?: number | null
  dni?: string | null
  nro_hc?: string | null
  obra_social?: string | null
  plan_cobertura?: string | null
  fecha_nacimiento?: string | null
  sexo?: string | null
  direccion?: string | null
  telefono_fijo?: string | null
  medico_cabecera?: string | null
}

export interface HistoriaClinicaOftalmo {
  id: string
  paciente_id: string
  antecedentes_oculares: string[]
  antecedentes_generales: string[]
  medicacion_habitual: string[]
  medicacion_otra?: string
  alergias?: string
  observaciones_permanentes?: string
  extra_catalogos?: Record<string, string[]>
}

export interface RefraccionOjo {
  esf?: string
  cil?: string
  eje?: string
  ee?: string | number
  add?: string
}

export interface RefraccionData {
  od: RefraccionOjo
  oi: RefraccionOjo
}

export interface AvOjo {
  sc?: string
  cc?: string
  est?: string
  csc?: string
}

export interface AgudezaVisualData {
  od?: AvOjo
  oi?: AvOjo
  ao?: AvOjo
  cerca_od?: { sc?: string; cl?: string; cc?: string }
  cerca_oi?: { sc?: string; cl?: string; cc?: string }
  cerca_ao?: { sc?: string; cl?: string; cc?: string }
}

export interface QueratometriaOjo {
  k1?: string
  k2?: string
  ejec?: string
  cil?: string | number
  eje?: string
}

export interface QueratometriaData {
  od?: QueratometriaOjo
  oi?: QueratometriaOjo
}

export interface PioOjo {
  aire?: string
  apl?: string
  paq_aire?: string
  corr?: string
}

export interface PresionIntraocularData {
  od?: PioOjo
  oi?: PioOjo
  tto?: string
}

export interface SuperficieOcularData {
  modo?: 'ao' | 'sep'
  od?: { but?: string; tin?: string; mei?: string }
  oi?: { but?: string; tin?: string; mei?: string }
  blef?: string
  demodex?: string
  frota?: string
}

export interface BiomicroscopiaData {
  modo?: 'ao' | 'sep'
  od?: string
  oi?: string
  cat_od?: string
  cat_oi?: string
  dilata?: string
}

export interface FondoOjoData {
  modo?: 'ao' | 'sep'
  od?: string
  oi?: string
}

export interface ConductaData {
  modo_plan?: 'ao' | 'sep'
  dx_presuntivo?: string
  plan_cx?: string
  plan_cx2?: string
  plan_ojo?: string
  explico?: string[]
  valores_pasar?: string[]
}

export interface DatosPostopData {
  fecha_cx?: string
  dias_postop?: string
  cx_realizada?: string
  ojo?: 'OD' | 'OI' | 'AO'
  cirujano?: string
  complicaciones?: string[]
  complic_detalle?: string
  satisfaccion?: string
  sintomas?: string
  evolucion?: string
  comentario_paciente?: string
}

export interface ConsultaOftalmo {
  id: string
  historia_id?: string
  paciente_id: string
  tipo: 'consulta' | 'postop'
  fecha: string
  profesional_nombre?: string
  motivo_consulta?: string
  derivado_por?: string
  ocupacion?: string
  observaciones_consulta?: string
  agudeza_visual?: AgudezaVisualData
  refraccion?: RefraccionData
  lentes_anteriores?: Record<string, any>
  estabilidad_refractiva?: string
  arm_cicloplejia?: Record<string, any>
  queratometria?: QueratometriaData
  presion_intraocular?: PresionIntraocularData
  lentes_contacto?: Record<string, any>
  examen_sensoriomotor?: Record<string, any>
  superficie_ocular?: SuperficieOcularData
  biomicroscopia?: BiomicroscopiaData
  fondo_ojo?: FondoOjoData
  conducta?: ConductaData
  datos_postop?: DatosPostopData
  indicaciones_texto?: string
  proximo_control?: string

  notas_internas?: string
  resumen_enviado_at?: string
  videos_enviados?: string[]
  sincronizado_geclisa_at?: string
  geclisa_sincronizado_en?: string
  geclisa_as_id?: number
  geclisa_hc_id?: number | null
  created_at?: string
}


export interface EstudioOftalmo {
  id: string
  paciente_id: string
  consulta_id?: string | null
  tipo?: string
  tipo_estudio?: string
  ojo: 'AO' | 'OD' | 'OI'
  fecha: string
  notas?: string
  informe?: string
  archivo_url?: string
  archivo_nombre?: string
  k_med?: string
  paquimetria?: string
  created_at?: string
}

export interface RecetaAnteojos {
  id: string
  paciente_id: string
  consulta_id?: string | null
  fecha: string
  tipo_lente?: string
  tipo_cristal?: string
  od_esfera?: string
  od_cilindro?: string
  od_eje?: string
  od_adicion?: string
  oi_esfera?: string
  oi_cilindro?: string
  oi_eje?: string
  oi_adicion?: string
  dnp?: string
  tratamiento?: string
  indicaciones_optico?: string
  observaciones?: string
  lejos?: {
    od?: { esf?: string; cil?: string; eje?: string; dnp?: string }
    oi?: { esf?: string; cil?: string; eje?: string; dnp?: string }
  }
  cerca?: {
    od?: { esf?: string; cil?: string; eje?: string; dnp?: string }
    oi?: { esf?: string; cil?: string; eje?: string; dnp?: string }
  }
  created_at?: string
}

export interface RecetaFarmacoItem {
  med?: string
  pos?: string
  farmaco?: string
  posologia?: string
  ojo?: string
}

export interface RecetaFarmacos {
  id: string
  paciente_id: string
  consulta_id?: string | null
  fecha: string
  diagnostico?: string
  items: RecetaFarmacoItem[]
  indicaciones_generales?: string
  created_at?: string
}

export interface PedidoEstudio {
  id: string
  paciente_id: string
  consulta_id?: string | null
  lote_id?: string
  fecha: string
  grupo_preset?: string
  titulo?: string
  items?: string[]
  estudios?: string[]
  ojo?: string
  diagnostico?: string
  observaciones?: string
  created_at?: string
}

export type PedidoEstudios = PedidoEstudio


export interface EvolucionGeclisa {
  hc_id?: number
  fecha?: string
  fecha_hora?: string
  hora?: string
  prestador?: string
  especialidad?: string
  area?: string
  texto?: string
  nombre_plantilla?: string
  origen?: 'crm' | 'geclisa_escritorio'
  es_crm?: boolean
}

export interface HistoriaOftalmoPayload {
  success: boolean
  paciente: PacienteData
  historia: HistoriaClinicaOftalmo
  consultas: ConsultaOftalmo[]
  evoluciones_geclisa?: EvolucionGeclisa[]
  estudios: EstudioOftalmo[]
  recetas_anteojos: RecetaAnteojos[]
  recetas_farmacos: RecetaFarmacos[]
  pedidos_estudios: PedidoEstudio[]
}
