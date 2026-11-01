'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Send,
  ExternalLink,
  Copy,
  Check,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Video,
  Calendar,
  User,
  Clock,
  Sparkles,
  Phone,
  Loader2,
  ShieldCheck,
  FileText,
  Stethoscope,
  Info,
  CheckSquare,
  Search,
  ChevronDown,
  Layers,
  Zap,
  Building,
  DollarSign,
  Link as LinkIcon
} from 'lucide-react'
import { BACKEND_URL, getAuthHeaders, apiFetch } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { normalizePhoneNumber } from '@/lib/phoneUtils'
import { PacienteData, ConsultaOftalmo } from '../types'
import { ALL_VIDEOS } from '../catalogos'
import { useAuth } from '@/context/AuthContext'

export interface MensajeClinicoHCE {
  id: string
  created_at: string
  emisor: string
  contenido: string
  tipo_comunicacion?: string
  delivery_status?: 'enviado' | 'entregado' | 'leido' | 'fallido' | string
  metadata_json?: {
    origen?: string
    modulo?: string
    tipo_comunicacion?: 'prequirurgico' | 'prequirurgico_video' | 'resumen_consulta' | 'video_educativo' | 'estudio_medico' | 'aviso_asistencial' | 'postoperatorio' | string
    consulta_id?: string
    medico_nombre?: string
    medico_usuario_id?: string
    linea_emision?: string
    video_url?: string
    [key: string]: any
  }
}

export interface TemplateDinamicaHCE {
  id?: string
  name: string
  titulo_amigable?: string
  grupo_crm?: string
  category?: string
  status?: string
  header_type?: string
  header_content?: string
  body_text: string
  footer_text?: string
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>
  variable_mappings?: Record<string, string>
  visible_en_hce?: boolean
  activo?: boolean
}

export interface TabConversacionHCEProps {
  paciente: PacienteData | null
  consultaActiva: ConsultaOftalmo | null
  currentUserName?: string | null
}

const VIDEO_URLS_DEFAULT: Record<string, string> = {
  catarata: 'https://centrovision.com.ar/videos/cataratas',
  lio: 'https://centrovision.com.ar/videos/lentes-intraoculares',
  refractiva: 'https://centrovision.com.ar/videos/cirugia-refractiva',
  ind_lasik: 'https://centrovision.com.ar/videos/indicaciones-lasik',
  ind_prk: 'https://centrovision.com.ar/videos/indicaciones-prk',
  querato: 'https://centrovision.com.ar/videos/queratocono',
  ind_cxl: 'https://centrovision.com.ar/videos/crosslinking',
  ind_faco: 'https://centrovision.com.ar/videos/facoemulsificacion',
  ind_anillos: 'https://centrovision.com.ar/videos/anillos-corneales',
  postop: 'https://centrovision.com.ar/videos/postoperatorio-inmediato',
  esp_miopia40: 'https://centrovision.com.ar/videos/refractiva-miopia-40',
  esp_fuchs: 'https://centrovision.com.ar/videos/cataratas-distrofia-fuchs',
  esp_glaucoma: 'https://centrovision.com.ar/videos/cataratas-glaucoma',
  esp_retina: 'https://centrovision.com.ar/videos/cataratas-retina',
  esp_trifocal: 'https://centrovision.com.ar/videos/lentes-trifocales'
}

// Texto modelo predeterminado para el parámetro de escritura libre de la plantilla prequirúrgica
export const TEXTO_MODELO_PREQUIRURGICO = `Para mañana:
* Vení con un acompañante
* Ropa cómoda, sin maquillaje, cremas ni perfume
* Tomá tu medicación habitual, salvo que te hayamos indicado otra cosa

Esta noche, cená tranquilo/a y dormí bien. Ya hiciste todo lo necesario, ahora nos toca a nosotros. 😊`

// Plantilla oficial prequirúrgica con video e indicaciones (sin botones interactivos)
export const PLANTILLA_PREQUIRURGICO_VIDEO_DEF: TemplateDinamicaHCE = {
  name: 'prequirurgico_video_indicaciones_v1',
  titulo_amigable: 'Prequirúrgico + Video con Indicaciones',
  grupo_crm: 'Seguimiento Quirúrgico',
  category: 'UTILITY',
  status: 'APPROVED',
  body_text: 'Hola {{1}} \nMañana es tu cirugía y la Dra/Dr. {{2}} te dejó un mensaje para que llegues tranquilo/a y sepas cómo va a ser todo:\n👉 {{3}}\n{{4}}',
  footer_text: '',
  variable_mappings: {
    '1': 'paciente_nombre',
    '2': 'medico_nombre',
    '3': 'video_url',
    '4': 'texto_libre_adicional'
  },
  buttons: []
}

// Plantillas predeterminadas de contingencia homologadas
const PLANTILLAS_CLINICAS_DEFAULT: TemplateDinamicaHCE[] = [
  PLANTILLA_PREQUIRURGICO_VIDEO_DEF,
  {
    name: 'recordatorio_cirugia_preparacion_v1',
    titulo_amigable: 'Recordatorio Quirúrgico con Pautas',
    grupo_crm: 'Seguimiento Quirúrgico',
    category: 'UTILITY',
    status: 'APPROVED',
    body_text: 'Hola {{1}}, le recordamos que su cirugía de {{2}} está programada para el día {{3}} a las {{4}} hs en Centrovisión.\n\n📋 Indicaciones de preparación:\n{{5}}\n\nPor favor, presione el botón inferior para confirmar su asistencia. Ante cualquier consulta, estamos a su disposición.',
    footer_text: 'Centrovisión Clínica Oftalmológica',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre',
      '3': 'turno_fecha',
      '4': 'turno_hora',
      '5': 'preparacion_texto'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar Asistencia' },
      { type: 'QUICK_REPLY', text: 'Tengo una consulta' }
    ]
  },
  {
    name: 'indicaciones_prequirurgicas_video_v1',
    titulo_amigable: 'Prequirúrgico + Video Explicativo',
    grupo_crm: 'Seguimiento Quirúrgico',
    category: 'UTILITY',
    status: 'APPROVED',
    body_text: 'Hola {{1}}, le recordamos que su procedimiento con {{2}} está programado para {{3}}. Le compartimos el video explicativo con todas las pautas de preparación y tranquilidad:\n\n👉 {{4}}\n\nAnte cualquier duda puede responder a este mensaje.',
    footer_text: 'Centrovisión • Quirófano',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'medico_nombre',
      '3': 'turno_fecha',
      '4': 'video_url'
    },
    buttons: []
  },
  {
    name: 'comunicacion_asistencial_paciente_v1',
    titulo_amigable: 'Aviso Asistencial con Mensaje Libre',
    grupo_crm: 'Atención General',
    category: 'UTILITY',
    status: 'APPROVED',
    body_text: 'Hola {{1}}, le escribimos desde el centro de atención médica de Centrovisión en relación a su gestión de asesoramiento:\n\n{{2}}\n\nAnte cualquier duda, puede responder a este mensaje y un asesor lo atenderá a la brevedad.',
    footer_text: 'Centrovisión • Oftalmología Integral',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'mensaje_asistencial'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Responder consulta' }
    ]
  },
  {
    name: 'consentimiento_informado_quirurgico_v1',
    titulo_amigable: 'Consentimiento Informado (Firma Digital)',
    grupo_crm: 'Seguimiento Quirúrgico',
    category: 'UTILITY',
    status: 'APPROVED',
    body_text: 'Hola {{1}}, le escribimos de Centrovisión respecto a su cirugía de {{2}} programada para el día {{3}} con el/la Dr/a. {{4}}.\n\n📄 Para que pueda leerlo con tranquilidad y firmarlo digitalmente desde su celular antes de asistir a la clínica, le compartimos su Consentimiento Informado oficial:\n{{5}}\n\nAnte cualquier consulta, estamos a su disposición.',
    footer_text: 'Centrovisión • Quirófano',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre',
      '3': 'turno_fecha',
      '4': 'medico_nombre',
      '5': 'enlace_consentimiento'
    },
    buttons: []
  },
  {
    name: 'confirmacion_consentimiento_quirurgico_v1',
    titulo_amigable: 'Confirmación Firma de Consentimiento',
    grupo_crm: 'Seguimiento Quirúrgico',
    category: 'UTILITY',
    status: 'APPROVED',
    body_text: '¡Muchas gracias {{1}}! Hemos registrado tu consentimiento firmado digitalmente para tu cirugía del {{2}} en Centrovisión. Ante cualquier consulta, estamos a tu disposición.',
    footer_text: 'Centrovisión • Quirófano',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'turno_fecha'
    },
    buttons: []
  },
  {
    name: 'entrega_estudio_oftalmologico_v1',
    titulo_amigable: 'Entrega de Estudio Clínico (Texto)',
    grupo_crm: 'Entrega de Estudios',
    category: 'UTILITY',
    status: 'APPROVED',
    body_text: 'Hola {{1}}, le informamos que su estudio oftalmológico de {{2}} ya fue procesado y archivado en su Historia Clínica de Centrovisión.\n\nAnte cualquier duda sobre el informe, estamos a su disposición.',
    footer_text: 'Centrovisión Oftalmología',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Tengo una consulta' }
    ]
  },
  {
    name: 'recordatorio_turno_quirurgico',
    titulo_amigable: 'Recordatorio Turno Quirúrgico',
    grupo_crm: 'Recordatorios de Turnos',
    category: 'UTILITY',
    status: 'APPROVED',
    header_content: 'Recordatorio de Turno Quirúrgico',
    body_text: 'Hola {{1}}, le recordamos su turno quirúrgico programado para el día {{2}} a las {{3}} con el {{4}} para la práctica de {{5}} en {{6}}.\n\nPor favor confirme su asistencia respondiendo a este mensaje.',
    footer_text: 'Centrovisión • Área Quirúrgica',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'turno_fecha',
      '3': 'turno_hora',
      '4': 'medico_nombre',
      '5': 'practica_nombre',
      '6': 'quirofano_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar Turno' },
      { type: 'QUICK_REPLY', text: 'Reprogramar' }
    ]
  }
]

export const CATEGORIAS_HCE = [
  'TODAS',
  'Seguimiento Quirúrgico',
  'Atención General',
  'Entrega de Estudios',
  'Recordatorios de Turnos'
] as const

export default function TabConversacionHCE({
  paciente,
  consultaActiva,
  currentUserName: currentUserNameProp
}: TabConversacionHCEProps) {
  const { user } = useAuth()

  // Nombre del usuario actual para el emisor
  const currentUserName = useMemo(() => {
    return (
      currentUserNameProp ||
      user?.user_metadata?.nombre_completo ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      null
    )
  }, [currentUserNameProp, user])

  // Nombre del profesional / cirujano actuante para la variable {{2}}
  const profesionalActuante = useMemo(() => {
    if (consultaActiva?.profesional_nombre && consultaActiva.profesional_nombre.trim()) {
      return consultaActiva.profesional_nombre.trim()
    }
    if (currentUserName && currentUserName !== 'Médico en Sesión' && currentUserName.trim()) {
      return currentUserName.trim()
    }
    return 'Dra. Malena'
  }, [consultaActiva?.profesional_nombre, currentUserName])

  // Estado del timeline de mensajes (Panel Izquierdo)
  const [mensajes, setMensajes] = useState<MensajeClinicoHCE[]>([])
  const [cargandoTimeline, setCargandoTimeline] = useState<boolean>(true)
  const [errorTimeline, setErrorTimeline] = useState<string | null>(null)

  // =========================================================================
  // GESTOR DINÁMICO DE PLANTILLAS HCE (Panel Derecho)
  // =========================================================================
  const [plantillas, setPlantillas] = useState<TemplateDinamicaHCE[]>([])
  const [cargandoPlantillas, setCargandoPlantillas] = useState<boolean>(true)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS')
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<TemplateDinamicaHCE | null>(null)

  // Formulario Inteligente de Parámetros Dinámicos
  const [valoresVariables, setValoresVariables] = useState<Record<string, string>>({})
  
  // REQUERIMIENTO CLAVE DEL USUARIO: Campo de Escritura Libre para Consejos / Info Adicional
  const [textoLibreConsejos, setTextoLibreConsejos] = useState<string>(TEXTO_MODELO_PREQUIRURGICO)

  // Sincronizar texto modelo predeterminado si se selecciona la plantilla prequirúrgica y está vacío
  useEffect(() => {
    if (plantillaSeleccionada?.name === 'prequirurgico_video_indicaciones_v1') {
      setTextoLibreConsejos(prev => (!prev?.trim() ? TEXTO_MODELO_PREQUIRURGICO : prev))
    }
  }, [plantillaSeleccionada?.name])

  // Video opcional si la plantilla involucra video
  const [videoSeleccionadoKey, setVideoSeleccionadoKey] = useState<string>('catarata')
  const [videoUrlPersonalizada, setVideoUrlPersonalizada] = useState<string>('')

  // Texto final editable y previsualizado
  const [mensajeTextoCompilado, setMensajeTextoCompilado] = useState<string>('')

  // Estados de envío y feedback
  const [enviando, setEnviando] = useState<boolean>(false)
  const [enviadoExito, setEnviadoExito] = useState<boolean>(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<boolean>(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<boolean>(false)

  // 1. Cargar dinámicamente las plantillas aprobadas habilitadas para HCE
  const cargarPlantillasHCE = useCallback(async () => {
    setCargandoPlantillas(true)
    try {
      let obtenidas: TemplateDinamicaHCE[] = []

      // 1.1 Intentar endpoint específico con ?solo_hce=true
      try {
        const res = await apiFetch('/api/whatsapp/cloud/templates?solo_hce=true')
        if (res.ok) {
          const resData = await res.json()
          if (Array.isArray(resData?.data) && resData.data.length > 0) {
            obtenidas = resData.data
          }
        }
      } catch (errApi) {
        console.warn('Endpoint ?solo_hce=true no disponible, recurriendo a listado general:', errApi)
      }

      // 1.2 Si no obtuvo con solo_hce, intentar endpoint general y filtrar localmente
      if (obtenidas.length === 0) {
        try {
          const resGen = await apiFetch('/api/whatsapp/cloud/templates')
          if (resGen.ok) {
            const dataGen = await resGen.json()
            if (Array.isArray(dataGen?.data) && dataGen.data.length > 0) {
              const activasHce = dataGen.data.filter((tpl: TemplateDinamicaHCE) => {
                const esAprobada = tpl.status === 'APPROVED'
                const esActiva = tpl.activo !== false
                const visibleHce = tpl.visible_en_hce === true || (
                  tpl.visible_en_hce !== false && (
                    tpl.grupo_crm === 'Seguimiento Quirúrgico' ||
                    tpl.grupo_crm === 'Atención General' ||
                    tpl.grupo_crm === 'Entrega de Estudios' ||
                    tpl.grupo_crm === 'Recordatorios de Turnos'
                  )
                )
                return esAprobada && esActiva && visibleHce
              })
              if (activasHce.length > 0) {
                obtenidas = activasHce
              }
            }
          }
        } catch (errGen) {
          console.warn('Error en listado general de plantillas, recurriendo a Supabase:', errGen)
        }
      }

      // 1.3 Si falla, consultar directamente Supabase
      if (obtenidas.length === 0) {
        const { data: dbTpls, error: errDb } = await (supabase as any)
          .from('whatsapp_templates')
          .select('*')
          .eq('status', 'APPROVED')
          .eq('activo', true)

        if (!errDb && dbTpls && Array.isArray(dbTpls) && dbTpls.length > 0) {
          const filtradas = dbTpls.filter((t: any) => t.visible_en_hce !== false)
          obtenidas = (filtradas.length > 0 ? filtradas : dbTpls) as TemplateDinamicaHCE[]
        }
      }

      // 1.4 Fallback con catálogo predeterminado homologado si no hay conexión
      if (obtenidas.length === 0) {
        obtenidas = [...PLANTILLAS_CLINICAS_DEFAULT]
      }

      // Asegurar que la plantilla prequirúrgica oficial siempre esté presente con formato exacto sin botones
      const idxExistente = obtenidas.findIndex(t => t.name === 'prequirurgico_video_indicaciones_v1')
      if (idxExistente >= 0) {
        obtenidas[idxExistente] = {
          ...obtenidas[idxExistente],
          body_text: PLANTILLA_PREQUIRURGICO_VIDEO_DEF.body_text,
          buttons: [],
          variable_mappings: {
            ...PLANTILLA_PREQUIRURGICO_VIDEO_DEF.variable_mappings,
            ...(obtenidas[idxExistente].variable_mappings || {})
          }
        }
      } else {
        obtenidas.unshift(PLANTILLA_PREQUIRURGICO_VIDEO_DEF)
      }

      setPlantillas(obtenidas)

      // Seleccionar la primera por defecto (priorizando la prequirúrgica) si no hay ninguna seleccionada
      if (obtenidas.length > 0) {
        setPlantillaSeleccionada(prev => {
          if (prev) {
            if (prev.name === 'prequirurgico_video_indicaciones_v1') {
              return obtenidas.find(t => t.name === 'prequirurgico_video_indicaciones_v1') || prev
            }
            return prev
          }
          const preq = obtenidas.find(t => t.name === 'prequirurgico_video_indicaciones_v1')
          return preq || obtenidas[0]
        })
      }
    } catch (err) {
      console.error('Error cargando plantillas para HCE:', err)
      setPlantillas(PLANTILLAS_CLINICAS_DEFAULT)
      setPlantillaSeleccionada(prev => prev || PLANTILLAS_CLINICAS_DEFAULT[0])
    } finally {
      setCargandoPlantillas(false)
    }
  }, [])

  useEffect(() => {
    cargarPlantillasHCE()
  }, [cargarPlantillasHCE])

  // Inicializar URL por defecto cuando cambia el video seleccionado
  useEffect(() => {
    const urlDefecto = VIDEO_URLS_DEFAULT[videoSeleccionadoKey] || `https://centrovision.com.ar/videos/${videoSeleccionadoKey}`
    setVideoUrlPersonalizada(urlDefecto)
  }, [videoSeleccionadoKey])

  // Plantillas filtradas por Categoría seleccionada
  const plantillasFiltradas = useMemo(() => {
    if (categoriaFiltro === 'TODAS') return plantillas
    return plantillas.filter(t => (t.grupo_crm || 'Atención General') === categoriaFiltro)
  }, [plantillas, categoriaFiltro])

  // Extraer variables presentes en el cuerpo de la plantilla seleccionada
  const variablesEnPlantilla = useMemo(() => {
    if (!plantillaSeleccionada?.body_text) return []
    const matches = Array.from(new Set(plantillaSeleccionada.body_text.match(/\{\{(\d+)\}\}/g) || []))
    return matches.map(m => m.replace(/\D/g, '')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  }, [plantillaSeleccionada])

  // Determinar si la plantilla seleccionada tiene un parámetro asignado a video
  const tieneVariableVideo = useMemo(() => {
    if (!plantillaSeleccionada) return false
    if (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1') return true
    const mappings = plantillaSeleccionada.variable_mappings || {}
    const hasMapped = Object.values(mappings).some(v => v.includes('video'))
    const hasInName = plantillaSeleccionada.name.includes('video')
    return hasMapped || hasInName
  }, [plantillaSeleccionada])

  // Determinar si la plantilla tiene una variable abierta para texto libre (ej: mensaje_asistencial o preparacion_texto)
  const variableTextoLibreKey = useMemo(() => {
    if (!plantillaSeleccionada) return null
    if (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1') {
      return '4'
    }
    const mappings = plantillaSeleccionada.variable_mappings || {}
    for (const [key, field] of Object.entries(mappings)) {
      if (
        field === 'texto_libre_adicional' ||
        field === 'mensaje_asistencial' ||
        field === 'preparacion_texto' ||
        field.includes('texto') ||
        field.includes('mensaje')
      ) {
        return key
      }
    }
    return null
  }, [plantillaSeleccionada])

  // Inicializar valores inteligentes al cambiar de plantilla seleccionada o datos del paciente
  useEffect(() => {
    if (!plantillaSeleccionada) return

    const mappings = plantillaSeleccionada.variable_mappings || {}
    const nuevosValores: Record<string, string> = {}

    const nombrePac = paciente?.nombre || 'Paciente'
    const profesional = profesionalActuante
    const fechaTurno = 'Mañana'
    const horaTurno = '08:30 hs'
    const motivoPractica = consultaActiva?.conducta?.plan_cx || consultaActiva?.motivo_consulta || 'Cirugía Oftalmológica'
    const quirofano = 'Sede Central - Quirófano 1'
    const videoUrl = videoUrlPersonalizada || 'https://centrovision.com.ar/videos/cataratas'
    const linkConsentimiento = 'https://crm-agentico-nube.vercel.app/consentimiento'

    variablesEnPlantilla.forEach(varKey => {
      const fieldId = mappings[varKey] || ''

      if (fieldId === 'paciente_nombre' || (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1' && varKey === '1')) {
        nuevosValores[varKey] = nombrePac
      } else if (fieldId === 'medico_nombre' || fieldId === 'cirujano_nombre' || (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1' && varKey === '2')) {
        nuevosValores[varKey] = profesional
      } else if (fieldId.includes('video') || (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1' && varKey === '3')) {
        nuevosValores[varKey] = videoUrl
      } else if (fieldId === 'texto_libre_adicional' || (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1' && varKey === '4')) {
        nuevosValores[varKey] = textoLibreConsejos || TEXTO_MODELO_PREQUIRURGICO
      } else if (fieldId === 'turno_fecha' || fieldId === 'fecha_cirugia') {
        nuevosValores[varKey] = fechaTurno
      } else if (fieldId === 'turno_hora') {
        nuevosValores[varKey] = horaTurno
      } else if (fieldId === 'practica_nombre') {
        nuevosValores[varKey] = motivoPractica
      } else if (fieldId === 'quirofano_nombre') {
        nuevosValores[varKey] = quirofano
      } else if (fieldId === 'presupuesto_monto') {
        nuevosValores[varKey] = '$ 45.000'
      } else if (fieldId === 'enlace_consentimiento') {
        nuevosValores[varKey] = linkConsentimiento
      } else if (fieldId === 'preparacion_texto') {
        nuevosValores[varKey] = textoLibreConsejos || 'Ayuno de 6 hs de sólidos y líquidos. Concurrir con adulto acompañante y ropa cómoda.'
      } else if (fieldId === 'mensaje_asistencial') {
        nuevosValores[varKey] = textoLibreConsejos || 'Le informamos que sus estudios clínicos ya fueron revisados y autorizados por el especialista.'
      } else {
        // Fallback genérico inteligente por posición
        if (varKey === '1') nuevosValores[varKey] = nombrePac
        else if (varKey === '2' && fieldId.includes('practica')) nuevosValores[varKey] = motivoPractica
        else nuevosValores[varKey] = `Dato ${varKey}`
      }
    })

    setValoresVariables(nuevosValores)
  }, [
    plantillaSeleccionada,
    variablesEnPlantilla,
    paciente?.nombre,
    profesionalActuante,
    consultaActiva?.conducta?.plan_cx,
    consultaActiva?.motivo_consulta,
    videoUrlPersonalizada,
    textoLibreConsejos
  ])

  // Si cambia el texto libre de consejos y la plantilla tiene una variable asignada para ello, sincronizar
  useEffect(() => {
    if (variableTextoLibreKey) {
      setValoresVariables(prev => {
        if (prev[variableTextoLibreKey] === textoLibreConsejos) return prev
        return {
          ...prev,
          [variableTextoLibreKey]: textoLibreConsejos
        }
      })
    }
  }, [textoLibreConsejos, variableTextoLibreKey])

  // Sincronizar videoUrlPersonalizada con la variable correspondiente
  useEffect(() => {
    if (plantillaSeleccionada) {
      const vKey = Object.entries(plantillaSeleccionada.variable_mappings || {}).find(([_, v]) => v.includes('video'))?.[0] || 
        (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1' ? '3' : null)
      if (vKey && videoUrlPersonalizada) {
        setValoresVariables(prev => {
          if (prev[vKey] === videoUrlPersonalizada) return prev
          return {
            ...prev,
            [vKey]: videoUrlPersonalizada
          }
        })
      }
    }
  }, [videoUrlPersonalizada, plantillaSeleccionada])

  // Compilar el mensaje final en tiempo real (Cuerpo con variables reemplazadas + Consejos Libres Adicionales)
  useEffect(() => {
    if (!plantillaSeleccionada) {
      setMensajeTextoCompilado('')
      return
    }

    let texto = plantillaSeleccionada.body_text || ''

    // Reemplazar cada variable {{1}}, {{2}} con su valor
    variablesEnPlantilla.forEach(varKey => {
      const val = valoresVariables[varKey] !== undefined ? valoresVariables[varKey] : `{{${varKey}}}`
      texto = texto.replaceAll(`{{${varKey}}}`, val)
    })

    // REQUERIMIENTO CLAVE: Si el usuario escribió consejos / notas adicionales
    // y la plantilla NO tiene una variable específica donde se inyectaron, concatenar como bloque asistencial destacado
    if (textoLibreConsejos.trim() && !variableTextoLibreKey) {
      texto += `\n\n💬 *Información Adicional y Consejos Médicos:*\n${textoLibreConsejos.trim()}`
    }

    setMensajeTextoCompilado(texto)
  }, [plantillaSeleccionada, variablesEnPlantilla, valoresVariables, textoLibreConsejos, variableTextoLibreKey])

  // Cargar Mensajes del Timeline (Panel Izquierdo)
  const cargarMensajesHCE = useCallback(async () => {
    if (!paciente?.id) {
      setMensajes([])
      setCargandoTimeline(false)
      return
    }

    setCargandoTimeline(true)
    setErrorTimeline(null)

    try {
      // 1. Intentar endpoint backend específico
      let obtenidos: MensajeClinicoHCE[] | null = null
      try {
        const res = await fetch(`${BACKEND_URL}/api/oftalmo/pacientes/${paciente.id}/mensajes-hce`, {
          headers: await getAuthHeaders(),
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.mensajes)) {
            obtenidos = data.mensajes
          } else if (Array.isArray(data)) {
            obtenidos = data
          }
        }
      } catch (errBackend) {
        console.warn('Backend endpoint mensajes-hce no disponible, consultando Supabase:', errBackend)
      }

      // 2. Si no se obtuvieron desde el endpoint, consultar Supabase con filtro estricto de origen HCE
      if (!obtenidos) {
        const { data: convs, error: errConvs } = await supabase
          .from('conversaciones')
          .select('id')
          .eq('paciente_id', paciente.id)

        if (!errConvs && convs && convs.length > 0) {
          const convIds = convs.map(c => c.id)
          const { data: dbMsgs, error: errMsgs } = await supabase
            .from('mensajes')
            .select('*')
            .in('conversacion_id', convIds)
            .order('created_at', { ascending: true })

          if (!errMsgs && dbMsgs) {
            // Filtrar estrictamente mensajes con origen HCE o tipo asistencial
            const filtrados = (dbMsgs as any[]).filter(m => {
              const meta = m.metadata_json || {}
              return (
                meta.origen === 'hce' ||
                meta.modulo === 'historia_oftalmo' ||
                meta.tipo_comunicacion ||
                meta.linea_emision === 'estudios_informativa' ||
                (typeof m.contenido === 'string' && m.contenido.includes('resumen de tu consulta'))
              )
            })

            obtenidos = filtrados.map(m => ({
              id: m.id,
              created_at: m.created_at,
              emisor: m.emisor || 'sistema',
              contenido: m.contenido,
              tipo_comunicacion: m.tipo_comunicacion || m.metadata_json?.tipo_comunicacion || m.metadata_json?.tipo,
              delivery_status: m.delivery_status || m.metadata_json?.delivery_status || 'enviado',
              metadata_json: m.metadata_json
            }))
          }
        }
      }

      setMensajes(obtenidos || [])
    } catch (err: any) {
      console.error('Error cargando mensajes HCE:', err)
      setErrorTimeline('No se pudieron recuperar las comunicaciones del paciente.')
    } finally {
      setCargandoTimeline(false)
    }
  }, [paciente?.id])

  useEffect(() => {
    cargarMensajesHCE()
  }, [cargarMensajesHCE])

  // Despacho Oficial por WhatsApp (Línea Transaccional Informativa)
  const handleDespacharMensaje = async () => {
    if (!paciente?.id || !mensajeTextoCompilado.trim() || !plantillaSeleccionada) return

    setEnviando(true)
    setErrorEnvio(null)
    setEnviadoExito(false)

    const medicoEmisor = profesionalActuante
    const esPrequirurgico = plantillaSeleccionada.name.includes('prequirurg') || plantillaSeleccionada.grupo_crm === 'Seguimiento Quirúrgico'

    const varsFinal: Record<string, string> = { ...valoresVariables }
    if (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1') {
      varsFinal['1'] = varsFinal['1'] || paciente.nombre || 'Paciente'
      varsFinal['2'] = varsFinal['2'] || medicoEmisor
      varsFinal['3'] = varsFinal['3'] || videoUrlPersonalizada || 'https://centrovision.com.ar/videos/cataratas'
      varsFinal['4'] = varsFinal['4'] || textoLibreConsejos.trim() || TEXTO_MODELO_PREQUIRURGICO
    }

    const bodyParameters = Object.keys(varsFinal)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map(k => ({
        type: 'text',
        text: varsFinal[k]
      }))

    const payload: Record<string, any> = {
      paciente_id: paciente.id,
      texto: mensajeTextoCompilado.trim(),
      template_name: plantillaSeleccionada.name,
      tipo_comunicacion: esPrequirurgico ? 'prequirurgico_video' : 'aviso_asistencial',
      consulta_id: consultaActiva?.id || null,
      medico_nombre: varsFinal['2'] || medicoEmisor,
      cirujano_nombre: varsFinal['2'] || medicoEmisor,
      fecha_cirugia: 'Mañana',
      video_url: varsFinal['3'] || videoUrlPersonalizada || null,
      texto_adicional: textoLibreConsejos.trim() || null,
      texto_libre_adicional: (plantillaSeleccionada.name === 'prequirurgico_video_indicaciones_v1' ? (varsFinal['4'] || textoLibreConsejos.trim()) : textoLibreConsejos.trim()) || null,
      variables: varsFinal,
      variables_personalizadas: varsFinal,
      components: [
        {
          type: 'body',
          parameters: bodyParameters
        }
      ],
      linea: 'estudios'
    }

    try {
      let despachoExitoso = false
      let responseData: any = null

      const res = await fetch(`${BACKEND_URL}/api/oftalmo/pacientes/${paciente.id}/enviar-comunicacion-hce`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        responseData = await res.json()
        if (responseData && responseData.success === false) {
          throw new Error(responseData.error || responseData.detail || 'Operación rechazada por el servidor.')
        }
        despachoExitoso = true
      } else {
        let detalleError = `HTTP ${res.status}`
        try {
          const errData = await res.json()
          detalleError = errData.detail || errData.message || errData.error || detalleError
        } catch {
          // Respuesta sin JSON
        }
        throw new Error(detalleError)
      }

      if (despachoExitoso) {
        setEnviadoExito(true)
        setMostrarConfirmacion(false)
        await cargarMensajesHCE()
        setTimeout(() => setEnviadoExito(false), 5000)
      }
    } catch (err: any) {
      console.error('Error al despachar mensaje HCE:', err)
      const errorMsg = err?.message || 'Servicio no disponible o error de red.'
      setErrorEnvio(`Error al despachar la plantilla por WhatsApp: ${errorMsg}`)
    } finally {
      setEnviando(false)
    }
  }

  // Fallback con enlace directo wa.me
  const handleFallbackWaMe = () => {
    if (!paciente?.telefono) {
      alert('El paciente no tiene un número de celular registrado.')
      return
    }

    let fullTel = normalizePhoneNumber(paciente.telefono)
    if (!fullTel) {
      let clean = (paciente.telefono || '').replace(/\D/g, '')
      clean = clean.replace(/^0+/, '')
      if (clean.startsWith('15')) {
        clean = clean.slice(2)
      }
      clean = clean.replace(/^(11|261|351|341|221|223|381|387|299|342|379|388)15(\d+)$/, '$1$2')
      if (clean.startsWith('549')) {
        fullTel = clean
      } else if (clean.startsWith('54')) {
        fullTel = `549${clean.slice(2)}`
      } else if (clean.length >= 8) {
        fullTel = `549${clean}`
      } else {
        fullTel = clean
      }
    }

    const url = `https://wa.me/${fullTel}?text=${encodeURIComponent(mensajeTextoCompilado)}`
    window.open(url, '_blank')
  }

  // Copiar al portapapeles
  const handleCopiar = () => {
    navigator.clipboard.writeText(mensajeTextoCompilado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // Helper para etiquetas legibles de variables
  const getEtiquetaVariable = (varKey: string, fieldId?: string) => {
    if (fieldId === 'paciente_nombre' || (plantillaSeleccionada?.name === 'prequirurgico_video_indicaciones_v1' && varKey === '1')) {
      return { label: 'Nombre Paciente', icon: User }
    }
    if (fieldId === 'medico_nombre' || fieldId === 'cirujano_nombre' || (plantillaSeleccionada?.name === 'prequirurgico_video_indicaciones_v1' && varKey === '2')) {
      return { label: 'Profesional / Médico', icon: Stethoscope }
    }
    if (fieldId?.includes('video') || (plantillaSeleccionada?.name === 'prequirurgico_video_indicaciones_v1' && varKey === '3')) {
      return { label: 'Video de la Clínica', icon: Video }
    }
    if (fieldId === 'texto_libre_adicional' || (plantillaSeleccionada?.name === 'prequirurgico_video_indicaciones_v1' && varKey === '4')) {
      return { label: 'Consejos / Escritura Libre', icon: Sparkles }
    }
    if (fieldId === 'turno_fecha' || fieldId === 'fecha_cirugia') return { label: 'Fecha Turno / Cirugía', icon: Calendar }
    if (fieldId === 'turno_hora') return { label: 'Hora Turno', icon: Clock }
    if (fieldId === 'practica_nombre') return { label: 'Práctica / Procedimiento', icon: FileText }
    if (fieldId === 'quirofano_nombre') return { label: 'Sede / Quirófano', icon: Building }
    if (fieldId === 'presupuesto_monto') return { label: 'Monto Cotizado', icon: DollarSign }
    if (fieldId === 'enlace_consentimiento') return { label: 'Enlace Consentimiento', icon: LinkIcon }
    if (fieldId === 'preparacion_texto') return { label: 'Indicaciones Prequirúrgicas', icon: ShieldCheck }
    if (fieldId === 'mensaje_asistencial') return { label: 'Mensaje Asistencial Libre', icon: MessageSquare }
    return { label: `Parámetro {{${varKey}}}`, icon: Sparkles }
  }

  // Detección de links en contenido de mensajes
  const renderContenidoMensaje = (texto: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const partes = texto.split(urlRegex)
    const urlsEncontradas = texto.match(urlRegex) || []

    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap leading-relaxed text-slate-800 text-xs font-sans">
          {partes.map((parte, i) => {
            if (parte.match(urlRegex)) {
              return (
                <a
                  key={i}
                  href={parte}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 hover:text-cyan-900 underline font-semibold break-all inline-flex items-center gap-1"
                >
                  {parte}
                  <ExternalLink className="w-3 h-3 inline" />
                </a>
              )
            }
            return parte
          })}
        </p>

        {urlsEncontradas.length > 0 && (
          <div className="pt-2 border-t border-slate-200/70 flex flex-wrap gap-2">
            {urlsEncontradas.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-md text-[11px] font-bold transition-colors shadow-xs"
              >
                <Video className="w-3.5 h-3.5 text-cyan-700" />
                <span>Ver Enlace / Video</span>
                <ExternalLink className="w-3 h-3 text-cyan-600" />
              </a>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Renderizador de Insignia de Tipo
  const renderBadgeTipo = (tipo?: string) => {
    switch (tipo) {
      case 'prequirurgico':
      case 'prequirurgico_video':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
            <CheckSquare className="w-3 h-3" />
            📋 Prequirúrgico
          </span>
        )
      case 'resumen_consulta':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <FileText className="w-3 h-3" />
            📄 Resumen de Consulta
          </span>
        )
      case 'video':
      case 'video_educativo':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
            <Video className="w-3 h-3" />
            🎥 Video Explicativo
          </span>
        )
      case 'estudio_medico':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            <Stethoscope className="w-3 h-3" />
            🔬 Estudio Diagnóstico
          </span>
        )
      case 'postoperatorio':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Sparkles className="w-3 h-3" />
            🩹 Pautas Postoperatorias
          </span>
        )
      case 'asistencial':
      case 'aviso_asistencial':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">
            <MessageSquare className="w-3 h-3" />
            💬 Aviso Asistencial
          </span>
        )
    }
  }

  // Renderizador de Estado de Entrega Meta
  const renderEstadoEntrega = (status?: string) => {
    switch (status) {
      case 'leido':
      case 'read':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600" title="Mensaje leído por el paciente">
            <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
            Leído
          </span>
        )
      case 'entregado':
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500" title="Entregado al dispositivo">
            <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
            Entregado
          </span>
        )
      case 'fallido':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600" title="Error en la entrega">
            <AlertCircle className="w-3.5 h-3.5" />
            Fallido
          </span>
        )
      case 'enviado':
      case 'sent':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400" title="Despachado a Meta WhatsApp">
            <Check className="w-3.5 h-3.5" />
            Enviado
          </span>
        )
    }
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 min-h-[580px]">
      
      {/* ========================================================================= */}
      {/* PANEL IZQUIERDO (45%): TIMELINE DE MENSAJES HCE (SOLO LECTURA)            */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-5/12 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Banner Superior Distintivo de Seguridad Clínica */}
        <div className="bg-gradient-to-r from-teal-900 via-[#103a49] to-slate-900 text-white px-4 py-3 flex items-start gap-3 border-b border-teal-800">
          <div className="p-1.5 bg-teal-500/20 text-teal-300 rounded-lg shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs tracking-wide uppercase text-teal-200 flex items-center gap-1.5">
                Línea Transaccional de Notificaciones Médicas
              </h3>
              <span className="text-[10px] bg-teal-800/80 text-teal-100 font-bold px-2 py-0.5 rounded-full border border-teal-700">
                Canal No-Reply (Línea 2)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              Comunicaciones clínicas emitidas desde la HCE con auditoría foliada. Este canal asistencial garantiza confidencialidad médico-legal.
            </p>
          </div>
          <button
            type="button"
            onClick={cargarMensajesHCE}
            disabled={cargandoTimeline}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
            title="Refrescar historial de mensajes"
          >
            <RefreshCw className={`w-4 h-4 ${cargandoTimeline ? 'animate-spin text-teal-300' : ''}`} />
          </button>
        </div>

        {/* Listado Cronológico de Burbujas */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] space-y-3.5 max-h-[700px]">
          {cargandoTimeline ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
              <p className="text-xs font-semibold">Cargando comunicaciones clínicas...</p>
            </div>
          ) : errorTimeline ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorTimeline}</span>
            </div>
          ) : mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400 border border-slate-200">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Sin comunicaciones previas</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Aún no se han emitido comunicaciones transaccionales por WhatsApp para este paciente desde la Historia Clínica.
              </p>
              <div className="mt-4 p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-[11px] max-w-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Seleccione una plantilla homologada en el panel derecho para emitir notificaciones prequirúrgicas o asistenciales.</span>
              </div>
            </div>
          ) : (
            mensajes.map((msg) => {
              const meta = msg.metadata_json || {}
              const fechaObj = msg.created_at ? new Date(msg.created_at) : new Date()
              const fechaLegible = fechaObj.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
              const horaLegible = fechaObj.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit'
              })
              const profesionalEmisor = meta.medico_nombre || meta.autor || 'Equipo Asistencial'
              const tipoComunicacion = msg.tipo_comunicacion || meta.tipo_comunicacion || meta.tipo || (msg as any).tipo || 'aviso_asistencial'

              return (
                <div
                  key={msg.id}
                  className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs transition-shadow hover:shadow-sm"
                >
                  {/* Header de la Burbuja */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {renderBadgeTipo(tipoComunicacion)}
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {profesionalEmisor}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {fechaLegible} {horaLegible}
                      </span>
                      <span className="text-slate-300">·</span>
                      {renderEstadoEntrega(msg.delivery_status)}
                    </div>
                  </div>

                  {/* Cuerpo del Mensaje Formateado */}
                  {renderContenidoMensaje(msg.contenido)}
                </div>
              )
            })
          )}
        </div>

        {/* Footer Informativo del Panel Izquierdo */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Total comunicaciones registradas: <strong>{mensajes.length}</strong></span>
          <span className="text-[10px] text-slate-400">Trazabilidad en tiempo real · Ley 26.529</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANEL DERECHO (55%): CENTRO DE EMISIÓN RÁPIDA CON FORMULARIO DINÁMICO     */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-7/12 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Cabecera del Panel Derecho */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <Send className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs tracking-wide uppercase text-white flex items-center gap-2">
                Centro Dinámico de Emisión HCE
                <span className="text-[10px] font-semibold bg-emerald-500/30 text-emerald-200 px-2 py-0.2 rounded-full border border-emerald-400/30">
                  Meta v21+
                </span>
              </h3>
              <p className="text-[11px] text-emerald-100">
                Plantillas oficiales sincronizadas con formulario inteligente y consejos libres
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cargarPlantillasHCE}
            disabled={cargandoPlantillas}
            className="text-xs text-emerald-200 hover:text-white flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            title="Recargar catálogo de plantillas activas en HCE"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargandoPlantillas ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* 1. Barra de Filtro por Categorías / Grupos CRM */}
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pl-0.5">
              Categoría:
            </span>
            {CATEGORIAS_HCE.map(cat => {
              const count = cat === 'TODAS'
                ? plantillas.length
                : plantillas.filter(t => (t.grupo_crm || 'Atención General') === cat).length
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    categoriaFiltro === cat
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    categoriaFiltro === cat ? 'bg-emerald-900/80 text-emerald-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Selector de Plantilla */}
          <div className="mt-2.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Plantilla Oficial Seleccionada:
            </label>
            <select
              value={plantillaSeleccionada?.name || ''}
              onChange={(e) => {
                const found = plantillas.find(t => t.name === e.target.value)
                if (found) setPlantillaSeleccionada(found)
              }}
              className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-xs"
            >
              {plantillasFiltradas.map((tpl) => (
                <option key={tpl.name} value={tpl.name}>
                  {tpl.titulo_amigable || tpl.name} ({tpl.grupo_crm || 'Atención General'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. FORMULARIO INTELIGENTE DE PARÁMETROS DINÁMICOS */}
        <div className="p-3.5 border-b border-slate-200 bg-white space-y-3 overflow-y-auto max-h-[300px]">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              Parámetros Clínicos de la Plantilla:
            </span>
            <span className="text-[10px] text-slate-400">
              {variablesEnPlantilla.length} variable(s) detectada(s)
            </span>
          </div>

          {variablesEnPlantilla.length === 0 ? (
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 italic">
              Esta plantilla es de formato fijo y no requiere parámetros posicionales.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {variablesEnPlantilla.map((varKey) => {
                const fieldId = plantillaSeleccionada?.variable_mappings?.[varKey]
                const { label, icon: IconComponent } = getEtiquetaVariable(varKey, fieldId)
                const val = valoresVariables[varKey] || ''

                // Si esta variable es la asignada para el texto libre, advertir que se alimenta del campo inferior
                const esVariableLibre = varKey === variableTextoLibreKey

                return (
                  <div key={varKey} className={esVariableLibre ? 'sm:col-span-2' : ''}>
                    <label className="text-[10.5px] font-bold text-slate-600 uppercase flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <IconComponent className="w-3 h-3 text-slate-400" />
                        {label}
                      </span>
                      <span className="text-[9.5px] font-mono text-slate-400">
                        {'{{' + varKey + '}}'}
                      </span>
                    </label>

                    {esVariableLibre ? (
                      <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Este parámetro se sincroniza automáticamente con el campo de <strong>Escritura Libre</strong> a continuación.</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          setValoresVariables(prev => ({
                            ...prev,
                            [varKey]: e.target.value
                          }))
                        }}
                        placeholder={`Ingrese ${label.toLowerCase()}...`}
                        className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Selector de Video si la plantilla es o contiene video */}
          {tieneVariableVideo && (
            <div className="p-2.5 bg-cyan-50/60 border border-cyan-200 rounded-lg space-y-2 mt-2">
              <label className="text-[10px] font-bold text-cyan-900 uppercase flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-cyan-700" />
                Seleccionar Video Educativo Oficial:
              </label>
              <select
                value={videoSeleccionadoKey}
                onChange={(e) => setVideoSeleccionadoKey(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-cyan-300 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-cyan-900"
              >
                {ALL_VIDEOS.map((vid) => (
                  <option key={vid.k} value={vid.k}>
                    {vid.t}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={videoUrlPersonalizada}
                onChange={(e) => {
                  setVideoUrlPersonalizada(e.target.value)
                  // Actualizar también la variable correspondiente si existe
                  const vKey = Object.entries(plantillaSeleccionada?.variable_mappings || {}).find(([_, v]) => v.includes('video'))?.[0]
                  if (vKey) {
                    setValoresVariables(prev => ({ ...prev, [vKey]: e.target.value }))
                  }
                }}
                placeholder="URL del video explicativo"
                className="w-full text-[11px] font-mono px-2 py-1 bg-white border border-cyan-200 rounded focus:outline-none text-slate-700"
              />
            </div>
          )}
        </div>

        {/* 3. REQUERIMIENTO CLAVE: CAMPO DE ESCRITURA LIBRE PARA INFORMACIÓN ADICIONAL / CONSEJOS */}
        <div className="p-3.5 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 border-b border-amber-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Información Adicional / Consejos del Profesional (Texto Libre)</span>
            </label>
            <span className="text-[9.5px] font-extrabold uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
              Escritura Libre
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mb-2 leading-tight">
            Escriba aquí indicaciones particulares, consejos postoperatorios, pautas personalizadas o cualquier aclaración adicional para el paciente.
          </p>

          <textarea
            rows={3}
            value={textoLibreConsejos}
            onChange={(e) => setTextoLibreConsejos(e.target.value)}
            placeholder="Escriba aquí indicaciones particulares, cuidados especiales, pautas personalizadas o cualquier aclaración adicional para el paciente..."
            className="w-full text-xs font-medium p-2.5 bg-white border border-amber-300/80 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-inner placeholder:text-slate-400 placeholder:italic leading-relaxed resize-y"
          />

          <div className="flex items-center justify-between mt-1 text-[10.5px] text-slate-400">
            <span>
              {variableTextoLibreKey 
                ? '✓ Se inyecta en el parámetro {{' + variableTextoLibreKey + '}} de la plantilla.'
                : '✓ Se añadirá automáticamente como sección complementaria en la vista previa y mensaje final.'}
            </span>
            <span>{textoLibreConsejos.length} caracteres</span>
          </div>
        </div>

        {/* 4. SIMULADOR / VISTA PREVIA EN VIVO ESTILO WHATSAPP */}
        <div className="p-3.5 bg-[#f0f4f2] border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              Simulador en Vivo (Receptor: {paciente?.nombre || 'Paciente'}):
            </span>
            <button
              type="button"
              onClick={handleCopiar}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
            >
              {copiado ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-extrabold">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar Mensaje</span>
                </>
              )}
            </button>
          </div>

          {/* Burbuja WhatsApp Verde */}
          <div className="bg-[#d9fdd3] text-slate-800 rounded-lg p-3.5 shadow-sm border border-emerald-300/60 max-w-full">
            {plantillaSeleccionada?.header_content && (
              <div className="font-extrabold text-xs text-slate-900 pb-1.5 mb-1.5 border-b border-emerald-300/40">
                {plantillaSeleccionada.header_content}
              </div>
            )}

            <div className="text-xs whitespace-pre-wrap leading-relaxed font-sans text-slate-900">
              {mensajeTextoCompilado || 'Seleccione una plantilla para previsualizar...'}
            </div>

            {plantillaSeleccionada?.footer_text && (
              <div className="text-[10px] text-slate-500 italic mt-2 pt-1 border-t border-emerald-200/50">
                {plantillaSeleccionada.footer_text}
              </div>
            )}

            <div className="flex items-center justify-end gap-1 mt-1.5 text-[9.5px] text-slate-500 font-mono">
              <span>Hoy 08:30</span>
              <CheckCheck className="w-3.5 h-3.5 text-sky-600" />
            </div>

            {/* Botones Interactivos si existen */}
            {plantillaSeleccionada?.buttons && plantillaSeleccionada.buttons.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-emerald-300/60 flex flex-col gap-1.5">
                {plantillaSeleccionada.buttons.map((b, i) => (
                  <div
                    key={i}
                    className="py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-center text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 select-none"
                  >
                    {b.type === 'URL' ? <ExternalLink className="w-3 h-3" /> : <Zap className="w-3 h-3 text-emerald-600" />}
                    <span>{b.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. ALERTAS DE RETROALIMENTACIÓN */}
        {enviadoExito && (
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">¡Plantilla oficial enviada con éxito e indexada en la HCE del paciente!</span>
          </div>
        )}

        {errorEnvio && (
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{errorEnvio}</div>
                <div className="text-[10px] text-rose-700 mt-0.5">
                  Puede realizar el envío inmediato mediante el canal de contingencia seguro:
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFallbackWaMe}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir WhatsApp Web (wa.me)</span>
            </button>
          </div>
        )}

        {/* 6. ACCIONES DE DESPACHO OFICIAL Y FALLBACK */}
        <div className="p-3.5 bg-white space-y-2 mt-auto">
          
          {mostrarConfirmacion ? (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="text-xs text-amber-950 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>¿Confirmar emisión oficial por WhatsApp Cloud API?</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-snug">
                Se enviará la plantilla <strong>{plantillaSeleccionada?.titulo_amigable || plantillaSeleccionada?.name}</strong> hacia el número de <strong>{paciente?.nombre}</strong> ({paciente?.telefono || 'sin celular registrado'}) desde la Línea 2 (Estudios/Transaccional No-Reply).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={enviando}
                  onClick={handleDespacharMensaje}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Confirmar y Enviar</span>
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => setMostrarConfirmacion(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMostrarConfirmacion(true)}
                disabled={enviando || !mensajeTextoCompilado.trim() || !plantillaSeleccionada}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Despachando Plantilla...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Plantilla Oficial por WhatsApp (Línea Informativa)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleFallbackWaMe}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir en WhatsApp Web / wa.me como contingencia"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">wa.me</span>
              </button>
            </div>
          )}

          <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1">
            <ShieldCheck className="w-3 h-3 text-slate-400" />
            Meta WhatsApp Cloud API v21+ · Auditoría médica en tiempo real
          </div>
        </div>

      </div>

    </div>
  )
}
