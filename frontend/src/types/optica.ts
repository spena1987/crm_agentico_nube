export type EtapaComercialOptica =
  | 'NUEVA_CONSULTA'
  | 'CONSULTA_ARMAZON'
  | 'PRESUPUESTO_AEREOS'
  | 'LENTES_CONTACTO'
  | 'EN_LABORATORIO'
  | 'LISTO_PARA_RETIRAR'
  | 'VENDIDO'
  | 'DESCARTADO'

export type OrigenConversacionOptica =
  | 'PLACA_TURNO'
  | 'DETECCION_RECETA_HOY'
  | 'ORGANICO'
  | 'CAMPANA_MARKETING'

export interface OjoGraduacion {
  esfera: string
  cilindro: string
  eje: string
  adicion?: string
  dnp?: string
  altura?: string
}

export interface OpticaGraduacion {
  od_lejos: OjoGraduacion
  oi_lejos: OjoGraduacion
  od_cerca?: OjoGraduacion
  oi_cerca?: OjoGraduacion
  add?: string
  dnp_od?: string
  dnp_oi?: string
  tipo_lente_sugerido?: string
  tratamientos_sugeridos?: string[]
  observaciones?: string
  medico_firmante?: string
  fecha_receta?: string
  fuente?: 'GECLISA' | 'OCR_IA' | 'MANUAL'
}

export interface OpticaConversacion {
  id: string
  telefono: string
  nombre_paciente: string
  dni?: string | null
  paciente_geclisa_id?: string | null
  obra_social?: string | null
  etapa_comercial: EtapaComercialOptica
  origen: OrigenConversacionOptica
  cupon_codigo?: string | null
  receta_detectada_hoy?: boolean
  resumen_receta?: string | null
  graduacion_actual_json?: OpticaGraduacion | null
  ultimo_mensaje?: string | null
  ultimo_mensaje_at?: string | null
  ventana_24h_activa?: boolean
  ventana_24h_expira_at?: string | null
  no_leidos: number
  bot_paused: boolean
  archivada: boolean
  opt_out?: boolean
  asignado_a?: string | null
  created_at?: string
  updated_at?: string
}

export type TipoMensajeOptica =
  | 'text'
  | 'template'
  | 'image'
  | 'document'
  | 'audio'
  | 'nota_interna'
  | 'cotizacion'

export interface OpcionCotizacionOptica {
  titulo: string
  cristal: string
  tratamiento: string
  armazon: string
  precio_lista: number
  descuento_pct: number
  precio_final: number
}

export interface OpticaMensaje {
  id: string
  conversacion_id: string
  direccion: 'inbound' | 'outbound'
  tipo: TipoMensajeOptica
  contenido: string
  media_url?: string | null
  template_name?: string | null
  estado_entrega?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  error_detalle?: string | null
  autor_nombre?: string | null
  metadata?: {
    cotizacion_opciones?: OpcionCotizacionOptica[]
    cupon_aplicado?: string
    ocr_extraido?: boolean
    [key: string]: any
  } | null
  created_at: string
}

export interface OpticaFicha360 {
  conversacion: OpticaConversacion
  graduacion: OpticaGraduacion | null
  evolucion_geclisa_hoy?: {
    fecha: string
    medico: string
    servicio?: string
    texto_evolucion: string
    tipo_indicacion: 'LENTES_AEREOS' | 'LENTES_CONTACTO' | 'AMBOS'
  } | null
  oportunidades_previas?: OpticaOportunidadGeclisa[]
}

export type TipoOportunidadOptica =
  | 'LENTES_AEREOS'
  | 'LENTES_CONTACTO'
  | 'AMBOS'
  | 'TURNO_ANTICIPADO'

export type EstadoComercialOportunidad =
  | 'DETECTADO'
  | 'ENCOLADO'
  | 'ENVIADO'
  | 'EN_CONVERSACION'
  | 'COTIZADO'
  | 'VENDIDO'
  | 'SIN_INTERES'
  | 'EXCLUIDO'

export interface OpticaOportunidadGeclisa {
  id: string
  fecha_evento: string
  paciente_geclisa_id?: string | null
  nombre_paciente: string
  dni?: string | null
  telefono_raw?: string | null
  telefono_normalizado: string
  telefono_valido?: boolean
  obra_social?: string | null
  medico_nombre?: string | null
  servicio_turno?: string | null
  tipo_oportunidad: TipoOportunidadOptica
  extracto_clinico?: string | null
  palabras_clave_detectadas?: string[]
  graduacion_extraida?: OpticaGraduacion | null
  cupon_codigo?: string | null
  estado_comercial: EstadoComercialOportunidad
  motivo_exclusion?: string | null
  conversacion_id?: string | null
  enviado_at?: string | null
  created_at?: string
}

export interface OpticaTemplateMeta {
  name: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | string
  category: 'UTILITY' | 'MARKETING' | string
  language: string
  preview_body?: string
}

export interface OpticaSaludLinea {
  connected: boolean
  waba_id?: string
  phone_number_id: string
  display_phone_number: string
  verified_name: string
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | string
  messaging_limit_tier: string
  enviados_ultimas_24h: number
  cola_pendientes: number
  circuit_breaker_activo?: boolean
  opt_outs_total?: number
  templates: OpticaTemplateMeta[]
}

export interface OpticaPlaca {
  id: string
  titulo: string
  descripcion?: string
  categoria: 'VOUCHER_TURNO' | 'LENTES_AEREOS' | 'LENTES_CONTACTO' | 'PROMO_TEMPORADA' | string
  url_imagen: string
  descuento_sugerido?: string
  activa: boolean
  created_at?: string
}

export interface OpticaCampana {
  id: string
  nombre: string
  segmento: string
  estrategia: 'DIRECTA_IMAGEN' | 'DOBLE_PASO'
  template_name: string
  placa_url?: string | null
  descuento_texto?: string | null
  estado: 'BORRADOR' | 'EN_CURSO' | 'PAUSADA' | 'COMPLETADA' | 'PAUSADA_POR_SALUD'
  total_audiencia: number
  excluidos_proteccion: number
  enviados: number
  entregados: number
  leidos: number
  respondidos: number
  conversiones: number
  jitter_min_seg: number
  jitter_max_seg: number
  lote_max_hora: number
  created_at: string
}

export interface OpticaConfig {
  waba_id: string
  phone_number_id: string
  display_phone_number: string
  verified_name: string
  pin_activado?: boolean
  // Automatización 1: Turnos próximos con placa de descuento
  auto_turnos_activo: boolean
  auto_turnos_dias_anticipacion: number
  auto_turnos_hora_envio: string
  auto_turnos_descuento_pct: number
  auto_turnos_placa_url: string
  auto_turnos_template_name: string
  auto_turnos_excluir_quirurgicos: boolean
  auto_turnos_servicios_excluidos: string[]
  // Automatización 2: Detección en Historia Clínica del día
  auto_recetas_modo: 'ASISTIDO' | 'AUTOMATICO'
  auto_recetas_delay_minutos: number
  auto_recetas_template_aereos: string
  auto_recetas_template_contacto: string
  auto_recetas_keywords_aereos: string[]
  auto_recetas_keywords_contacto: string[]
  auto_recetas_exclusiones_lio: string[]
  // Protección Anti-Bloqueo
  antibloqueo_cooldown_dias: number
  antibloqueo_jitter_min_seg: number
  antibloqueo_jitter_max_seg: number
  antibloqueo_ventana_horaria_inicio: string
  antibloqueo_ventana_horaria_fin: string
  antibloqueo_pausa_calidad_amarilla: boolean
}
