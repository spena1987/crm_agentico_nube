'use client'

import React, { useState, useEffect } from 'react'
import { 
  MessageSquareText, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Eye, 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  HelpCircle,
  X,
  FileText,
  Calendar,
  User,
  Stethoscope,
  Building,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  Search,
  Link as LinkIcon,
  ExternalLink,
  Zap,
  Pencil
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import WhatsAppPhoneSimulator from './whatsapp/WhatsAppPhoneSimulator'

interface TemplateItem {
  id: string
  waba_id: string
  meta_template_id?: string
  name: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  language: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
  header_type: string
  header_content?: string
  body_text: string
  footer_text?: string
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>
  variable_mappings?: Record<string, string>
  rejection_reason?: string
  created_at?: string
  activo?: boolean
  visible_en_chat?: boolean
  grupo_crm?: string
  titulo_amigable?: string
  descripcion?: string
  orden?: number
}

// Grupos funcionales en el CRM
export const CRM_TEMPLATE_GROUPS = [
  'Seguimiento Quirúrgico',
  'Recordatorios de Turnos',
  'Entrega de Estudios',
  'Presupuestos',
  'Atención General'
] as const

// Catálogo de variables clínicas inteligentes disponibles
const CLINICAL_VARIABLES = [
  { id: 'paciente_nombre', label: 'Nombre Paciente', icon: User, sample: 'Carlos Menéndez' },
  { id: 'mensaje_asistencial', label: 'Mensaje Asistencial Libre', icon: MessageSquareText, sample: 'Le informamos que sus estudios prequirúrgicos ya fueron recibidos por el especialista y se encuentran autorizados.' },
  { id: 'turno_fecha', label: 'Fecha Turno', icon: Calendar, sample: 'Jueves 15 de Octubre' },
  { id: 'turno_hora', label: 'Hora Turno', icon: Clock, sample: '10:30 hs' },
  { id: 'medico_nombre', label: 'Profesional / Médico', icon: Stethoscope, sample: 'Dr. Roberto Gómez' },
  { id: 'practica_nombre', label: 'Práctica / Cirugía', icon: FileText, sample: 'Cirugía de Cataratas' },
  { id: 'quirofano_nombre', label: 'Sede / Quirófano', icon: Building, sample: 'Sede Central - Quirófano 1' },
  { id: 'presupuesto_monto', label: 'Monto Presupuesto', icon: DollarSign, sample: '$ 45.000' },
  { id: 'preparacion_texto', label: 'Preparación Prequirúrgica', icon: ShieldCheck, sample: 'Ayuno de 8 hs de sólidos y líquidos. Concurrir con DNI y estudios prequirúrgicos.' },
  { id: 'enlace_consentimiento', label: 'Enlace Firma Consentimiento', icon: LinkIcon, sample: 'https://crm-agentico-nube.vercel.app/consentimiento/tok_abc123' }
]

interface PremadeTemplate {
  title: string
  name: string
  category: 'UTILITY' | 'MARKETING'
  header_content: string
  body_text: string
  footer_text: string
  variable_mappings: Record<string, string>
  buttons: Array<{ type: string; text: string; url?: string }>
}

// Plantillas pre-diseñadas para carga rápida (con soporte de ambas opciones de botones)
const PREMADE_TEMPLATES: PremadeTemplate[] = [
  {
    title: 'Entrega Estudio Oftalmológico (PDF)',
    name: 'entrega_estudio_oftalmologico_pdf',
    category: 'UTILITY' as const,
    header_content: 'Documento Clínico',
    body_text: 'Hola {{1}}, le compartimos su estudio oftalmológico de {{2}} realizado en Centrovisión.\n\nEl archivo oficial se encuentra adjunto a este mensaje.',
    footer_text: 'Centrovisión Oftalmología',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar recepción' }
    ]
  },
  {
    title: 'Entrega Estudio Oftalmológico (Imagen)',
    name: 'entrega_estudio_oftalmologico_img',
    category: 'UTILITY' as const,
    header_content: 'Estudio Fotográfico',
    body_text: 'Hola {{1}}, le compartimos su estudio oftalmológico de {{2}} realizado en Centrovisión.\n\nLa imagen oficial se encuentra adjunta a este mensaje.',
    footer_text: 'Centrovisión Oftalmología',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar recepción' }
    ]
  },
  {
    title: 'Entrega Estudio Oftalmológico (Texto)',
    name: 'entrega_estudio_oftalmologico_v1',
    category: 'UTILITY' as const,
    header_content: '',
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
    title: 'Apertura Asistencial con Mensaje Libre (UTILITY)',
    name: 'comunicacion_asistencial_paciente_v1',
    category: 'UTILITY' as const,
    header_content: '',
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
    title: 'Consentimiento Informado Quirúrgico (Firma Digital)',
    name: 'consentimiento_informado_quirurgico_v1',
    category: 'UTILITY' as const,
    header_content: '',
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
    title: 'Apertura de Conversación (Ventana 24h)',
    name: 'apertura_conversacion',
    category: 'UTILITY' as const,
    header_content: '',
    body_text: 'Hola {{1}}, nos comunicamos de Centrovisión respecto a su cirugía programada. Por favor responda a este mensaje para activar el canal y enviarle la documentación prequirúrgica.',
    footer_text: 'Centrovisión Oftalmología',
    variable_mappings: {
      '1': 'paciente_nombre'
    },
    buttons: []
  },
  {
    title: 'Recordatorio Cirugía con Preparación (Prequirúrgico)',
    name: 'recordatorio_cirugia_preparacion_v1',
    category: 'UTILITY' as const,
    header_content: '',
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
    title: 'Recordatorio Turno Quirúrgico',
    name: 'recordatorio_turno_quirurgico',
    category: 'UTILITY' as const,
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
  },
  {
    title: 'Presupuesto: Envío PDF en Chat (Opción 2)',
    name: 'presupuesto_entrega_pdf',
    category: 'UTILITY' as const,
    header_content: 'Presupuesto Médico Disponible',
    body_text: 'Hola {{1}}, ya se encuentra listo el presupuesto para su procedimiento de {{2}}. El monto total estimado es {{3}}.\n\nPresione el botón inferior si desea recibir el archivo PDF oficial con el membrete directamente en este chat de WhatsApp.',
    footer_text: 'Centrovisión • Área Quirúrgica',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre',
      '3': 'presupuesto_monto'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Recibir Presupuesto PDF' }
    ]
  },
  {
    title: 'Presupuesto: Enlace Web Directo (Opción 1)',
    name: 'presupuesto_enlace_web',
    category: 'UTILITY' as const,
    header_content: 'Presupuesto Quirúrgico',
    body_text: 'Estimado/a {{1}}, le acercamos la cotización formal para su procedimiento de {{2}} con un total de {{3}}.\n\nPuede acceder al presupuesto detallado en línea y descargarlo pulsando el botón a continuación:',
    footer_text: 'Centrovisión • Área Quirúrgica',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre',
      '3': 'presupuesto_monto'
    },
    buttons: [
      { 
        type: 'URL', 
        text: 'Ver Presupuesto Web', 
        url: 'https://crmagenticonube-production.up.railway.app/api/presupuestos/pdf/{{1}}' 
      }
    ]
  },
  {
    title: 'Confirmación de Consulta Médica',
    name: 'confirmacion_consulta_medica',
    category: 'UTILITY' as const,
    header_content: 'Confirmación de Consulta',
    body_text: 'Estimado/a {{1}}, le confirmamos su turno para consulta médica el día {{2}} a las {{3}} hs con el {{4}}.\n\nRecuerde asistir con DNI y credencial de cobertura.',
    footer_text: 'Centrovisión • Gestión de Turnos',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'turno_fecha',
      '3': 'turno_hora',
      '4': 'medico_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar Asistencia' }
    ]
  },
  {
    title: 'Seguimiento Asesoramiento (D+3 - Toque 1)',
    name: 'seguimiento_asesoramiento_t1',
    category: 'UTILITY' as const,
    header_content: 'Seguimiento Asistencial',
    body_text: 'Hola {{1}}, le escribimos desde el equipo quirúrgico de Centrovisión. Queríamos consultarle si le quedó alguna duda sobre la indicación médica para {{2}} o si desea coordinar una fecha tentativa.',
    footer_text: 'Centrovisión Oftalmología',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Quiero operarme' },
      { type: 'QUICK_REPLY', text: 'Tengo dudas' }
    ]
  },
  {
    title: 'Seguimiento Asesoramiento (D+8 - Toque 2)',
    name: 'seguimiento_asesoramiento_t2',
    category: 'UTILITY' as const,
    header_content: 'Estudios Prequirúrgicos y Cobertura',
    body_text: 'Estimado/a {{1}}, esperamos que se encuentre muy bien. Respecto a su procedimiento de {{2}}, le recordamos que nuestro equipo puede asesorarlo con la gestión de estudios prequirúrgicos y autorizaciones con su obra social. ¿Desea que lo asistamos?',
    footer_text: 'Centrovisión Quirófano',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Sí, por favor' },
      { type: 'QUICK_REPLY', text: 'Lo veo más adelante' }
    ]
  },
  {
    title: 'Seguimiento Asesoramiento (D+18 - Toque 3)',
    name: 'seguimiento_asesoramiento_t3',
    category: 'UTILITY' as const,
    header_content: 'Consulta de Estado Quirúrgico',
    body_text: 'Hola {{1}}, desde Centrovisión queremos saber cómo se encuentra respecto a su cirugía de {{2}}. Si aún está evaluando los tiempos o prefiere que retomemos el contacto el próximo mes, háganoslo saber para acompañarlo cuando mejor le convenga.',
    footer_text: 'Centrovisión Oftalmología',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Retomar ahora' },
      { type: 'QUICK_REPLY', text: 'Posponer 30 días' }
    ]
  },
  {
    title: 'Seguimiento Análisis (D+2 - Toque 1)',
    name: 'seguimiento_analisis_t1',
    category: 'UTILITY' as const,
    header_content: 'Presupuesto Quirúrgico Formal',
    body_text: 'Hola {{1}}, nos comunicamos para confirmar si pudo abrir y revisar el presupuesto médico formal que le enviamos para {{2}}. Si tiene alguna consulta sobre los aranceles, insumos o formas de pago, estamos a su total disposición.',
    footer_text: 'Centrovisión Área Quirúrgica',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Pude revisarlo' },
      { type: 'QUICK_REPLY', text: 'Tengo dudas de pago' }
    ]
  },
  {
    title: 'Seguimiento Análisis (D+6 - Toque 2)',
    name: 'seguimiento_analisis_t2',
    category: 'UTILITY' as const,
    header_content: 'Opciones de Financiación y Cobertura',
    body_text: 'Estimado/a {{1}}, respecto a su cotización para {{2}}, le recordamos que disponemos de facilidades de pago en cuotas y orientación personalizada para reintegros con su cobertura médica. ¿Desea que le acerquemos más información?',
    footer_text: 'Centrovisión Administración',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Consultar cuotas' },
      { type: 'QUICK_REPLY', text: 'Sigo analizando' }
    ]
  },
  {
    title: 'Seguimiento Análisis (D+13 - Toque 3: Vencimiento Arancel)',
    name: 'seguimiento_analisis_t3',
    category: 'UTILITY' as const,
    header_content: 'Aviso de Vigencia Arancelaria',
    body_text: 'Estimado/a {{1}}, le informamos que el presupuesto emitido para {{2}} se encuentra a 48 horas de cumplir su plazo de validez arancelaria de 15 días. Si desea congelar el valor cotizado y reservar su fecha en quirófano antes del reajuste, avísenos con un clic.',
    footer_text: 'Centrovisión Área Quirúrgica',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Congelar arancel' },
      { type: 'QUICK_REPLY', text: 'Pausar seguimiento' }
    ]
  },
  {
    title: 'Seguimiento Análisis (D+25 - Toque 4: Cierre Suave)',
    name: 'seguimiento_analisis_t4',
    category: 'UTILITY' as const,
    header_content: 'Actualización de su Expediente',
    body_text: 'Hola {{1}}, nos comunicamos para consultarle si desea que mantengamos activa su propuesta para {{2}} o si prefiere posponerla para más adelante. De no confirmar, dejaremos el caso en pausa para no importunarlo, quedando a su entera disposición.',
    footer_text: 'Centrovisión Oftalmología',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Mantener activa' },
      { type: 'QUICK_REPLY', text: 'Posponer por ahora' }
    ]
  }
]

export default function WhatsAppTemplatesSettingsCard() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [registeringFollowUp, setRegisteringFollowUp] = useState<boolean>(false)
  const [registeringEstudios, setRegisteringEstudios] = useState<boolean>(false)
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [groupFilter, setGroupFilter] = useState<string>('ALL')
  const [statusUsageFilter, setStatusUsageFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'CHAT_ONLY'>('ALL')
  const [updatingGovernance, setUpdatingGovernance] = useState<string | null>(null)

  // Modal de Creación / Edición
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null)
  const [creating, setCreating] = useState<boolean>(false)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null)

  // Campos del formulario
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY')
  const [language, setLanguage] = useState('es_AR')
  const [headerType, setHeaderType] = useState('TEXT')
  const [headerContent, setHeaderContent] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [footerText, setFooterText] = useState('Centrovisión Oftalmología Integral')
  const [buttons, setButtons] = useState<Array<{ type: string; text: string; url?: string }>>([
    { type: 'QUICK_REPLY', text: 'Confirmar Turno' }
  ])
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({})
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({})

  // Modal de previsualización independiente
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null)
  const [defaultEstudiosTemplates, setDefaultEstudiosTemplates] = useState<{ default_pdf: string; default_img: string }>({
    default_pdf: 'entrega_estudio_oftalmologico_pdf',
    default_img: 'entrega_estudio_oftalmologico_img'
  })

  // Cargar plantillas de la base de datos
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await apiFetch('/api/whatsapp/cloud/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.data || [])
      }
      try {
        const resEst = await apiFetch('/api/whatsapp/estudios-templates')
        if (resEst.ok) {
          const dEst = await resEst.json()
          if (dEst?.default_pdf || dEst?.default_img) {
            setDefaultEstudiosTemplates({
              default_pdf: dEst.default_pdf || 'entrega_estudio_oftalmologico_pdf',
              default_img: dEst.default_img || 'entrega_estudio_oftalmologico_img'
            })
          }
        }
      } catch (e) {}

    } catch (err) {
      console.error('Error cargando plantillas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  // Sincronizar con Meta Graph API
  const handleSyncWithMeta = async () => {
    try {
      setSyncing(true)
      const res = await apiFetch('/api/whatsapp/cloud/templates/sync', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessFeedback(`Sincronización exitosa: ${data.synced_count} plantillas actualizadas desde Meta.`)
        setTimeout(() => setSuccessFeedback(null), 4000)
        fetchTemplates()
      } else {
        setErrorFeedback(data.detail || 'Error al sincronizar con Meta.')
      }
    } catch (err: any) {
      setErrorFeedback(`Fallo de conexión: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  // Registrar las 7 plantillas de seguimiento en Meta
  const handleRegisterFollowUpTemplates = async () => {
    try {
      setRegisteringFollowUp(true)
      setErrorFeedback(null)
      const res = await apiFetch('/api/whatsapp/cloud/templates/registrar-seguimiento', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        const creadas = data.resultados?.filter((r: any) => r.action === 'creada_en_meta').length || 0
        const existentes = data.resultados?.filter((r: any) => r.action === 'ya_registrada' || r.action === 'ya_existia_en_meta_sincronizada_local').length || 0
        setSuccessFeedback(`Pack de seguimiento procesado: ${creadas} registradas en Meta, ${existentes} vinculadas en el CRM.`)
        setTimeout(() => setSuccessFeedback(null), 5000)
        fetchTemplates()
      } else {
        setErrorFeedback(data.detail || 'Error registrando plantillas de seguimiento.')
      }
    } catch (err: any) {
      setErrorFeedback(`Error de conexión: ${err.message}`)
    } finally {
      setRegisteringFollowUp(false)
    }
  }

  // Registrar las plantillas oficiales del Módulo de Estudios Oftalmológicos en Meta
  const handleRegisterEstudiosTemplates = async () => {
    try {
      setRegisteringEstudios(true)
      setErrorFeedback(null)
      const res = await apiFetch('/api/whatsapp/cloud/templates/registrar-estudios', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        const creadas = data.resultados?.filter((r: any) => r.action === 'creada_en_meta').length || 0
        const existentes = data.resultados?.filter((r: any) => r.action === 'ya_registrada' || r.action === 'ya_existia_en_meta_sincronizada_local').length || 0
        setSuccessFeedback(`Plantillas de Estudios Oftalmológicos procesadas: ${creadas} enviadas a Meta, ${existentes} vinculadas en el CRM.`)
        setTimeout(() => setSuccessFeedback(null), 5000)
        fetchTemplates()
      } else {
        setErrorFeedback(data.detail || 'Error registrando plantillas de estudios oftalmológicos.')
      }
    } catch (err: any) {
      setErrorFeedback(`Error de conexión: ${err.message}`)
    } finally {
      setRegisteringEstudios(false)
    }
  }

  // Cargar plantilla prediseñada en el formulario
  const handleLoadPremade = (tpl: typeof PREMADE_TEMPLATES[0]) => {
    setName(tpl.name)
    setCategory(tpl.category)
    setHeaderType('TEXT')
    setHeaderContent(tpl.header_content)
    setBodyText(tpl.body_text)
    setFooterText(tpl.footer_text)
    setVariableMappings(tpl.variable_mappings)
    setButtons(tpl.buttons)

    // Autogenerar valores de muestra
    const samples: Record<string, string> = {}
    Object.entries(tpl.variable_mappings).forEach(([varKey, fieldId]) => {
      const foundVar = CLINICAL_VARIABLES.find(v => v.id === fieldId)
      if (foundVar) {
        samples[varKey] = foundVar.sample
      }
    })
    setSampleValues(samples)
  }

  // Insertar variable clínica en el cuerpo
  const handleInsertVariable = (variable: typeof CLINICAL_VARIABLES[0]) => {
    // Detectar cuáles variables ya están en uso
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || []
    const existingNumbers = matches.map(m => parseInt(m.replace(/\D/g, ''), 10))
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1

    const newTag = `{{${nextNumber}}}`
    setBodyText(prev => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + newTag)

    setVariableMappings(prev => ({
      ...prev,
      [String(nextNumber)]: variable.id
    }))

    setSampleValues(prev => ({
      ...prev,
      [String(nextNumber)]: variable.sample
    }))
  }

  // Crear plantilla y enviar a Meta
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorFeedback(null)

    if (!name.trim()) {
      setErrorFeedback('El nombre de la plantilla es obligatorio.')
      return
    }
    if (!bodyText.trim()) {
      setErrorFeedback('El texto del cuerpo es obligatorio.')
      return
    }

    // Validar que los botones de tipo URL tengan una dirección válida
    for (const b of buttons) {
      if (b.type === 'URL' && !b.url?.trim()) {
        setErrorFeedback(`El botón de enlace '${b.text || 'Web'}' requiere que especifiques una URL válida (ej: https://...).`)
        return
      }
    }

    // Extraer variables presentes en el texto
    const varMatches = Array.from(new Set((bodyText.match(/\{\{(\d+)\}\}/g) || []).map(m => m.replace(/\D/g, ''))))
    const orderedSampleValues = varMatches.map(vNum => sampleValues[vNum] || `Muestra ${vNum}`)

    try {
      setCreating(true)
      // Sanitizar encabezado conforme a las políticas de Meta (sin emojis, asteriscos ni saltos)
      const sanitizedHeader = headerType === 'TEXT' && headerContent
        ? headerContent.replace(/[\r\n]+/g, ' ').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,;:!?()/\-_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
        : null

      const payload = {
        name: name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category,
        language,
        header_type: headerType,
        header_content: sanitizedHeader || null,
        body_text: bodyText,
        footer_text: footerText || null,
        buttons: buttons.filter(b => b.text.trim().length > 0),
        variable_mappings: variableMappings,
        sample_values: orderedSampleValues
      }

      if (editingTemplate) {
        // Actualizar plantilla existente en Meta sin crear duplicados (PUT)
        const res = await apiFetch(`/api/whatsapp/cloud/templates/${editingTemplate.name}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })

        const data = await res.json()
        if (res.ok) {
          setSuccessFeedback(`¡Plantilla '${editingTemplate.name}' actualizada con éxito y enviada a revisión en Meta! Estado: ${data.template_status || 'PENDING'}`)
          setTimeout(() => setSuccessFeedback(null), 6000)
          setIsCreateModalOpen(false)
          resetForm()
          fetchTemplates()
        } else {
          setErrorFeedback(data.detail || 'Meta rechazó la actualización de la plantilla.')
        }
      } else {
        // Crear nueva plantilla en Meta (POST)
        const res = await apiFetch('/api/whatsapp/cloud/templates', {
          method: 'POST',
          body: JSON.stringify(payload)
        })

        const data = await res.json()
        if (res.ok) {
          setSuccessFeedback(`¡Plantilla '${payload.name}' enviada con éxito a Meta! Estado inicial: ${data.template?.status || 'PENDING'}`)
          setTimeout(() => setSuccessFeedback(null), 5000)
          setIsCreateModalOpen(false)
          resetForm()
          fetchTemplates()
        } else {
          setErrorFeedback(data.detail || 'Meta rechazó la plantilla. Revisa el formato.')
        }
      }
    } catch (err: any) {
      setErrorFeedback(`Error en la solicitud: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  // Cargar plantilla en modo edición
  const handleStartEdit = (tpl: TemplateItem) => {
    setEditingTemplate(tpl)
    setName(tpl.name)
    setCategory(tpl.category === 'MARKETING' ? 'MARKETING' : 'UTILITY')
    setLanguage(tpl.language || 'es_AR')
    setHeaderType(tpl.header_type || 'NONE')
    setHeaderContent(tpl.header_content || '')
    setBodyText(tpl.body_text || '')
    setFooterText(tpl.footer_text || '')
    setButtons(tpl.buttons && tpl.buttons.length > 0 ? tpl.buttons : [])
    setVariableMappings(tpl.variable_mappings || {})

    // Autogenerar valores de muestra para previsualización
    const samples: Record<string, string> = {}
    const varMatches = Array.from(new Set((tpl.body_text.match(/\{\{(\d+)\}\}/g) || []).map(m => m.replace(/\D/g, ''))))
    varMatches.forEach(vNum => {
      const fieldId = tpl.variable_mappings ? tpl.variable_mappings[vNum] : null
      const foundVar = fieldId ? CLINICAL_VARIABLES.find(v => v.id === fieldId) : null
      samples[vNum] = foundVar ? foundVar.sample : `Muestra ${vNum}`
    })
    setSampleValues(samples)
    setErrorFeedback(null)
    setIsCreateModalOpen(true)
  }

  // Eliminar plantilla
  const handleDeleteTemplate = async (tplName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la plantilla '${tplName}' de Meta y del CRM?`)) return

    try {
      const res = await apiFetch(`/api/whatsapp/cloud/templates/${tplName}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.name !== tplName))
      } else {
        alert('No se pudo eliminar la plantilla.')
      }
    } catch (err) {
      console.error('Error eliminando plantilla:', err)
    }
  }

  // Actualizar gobernanza (activo, visible_en_chat, grupo_crm)
  const handleUpdateGovernance = async (
    tplName: string,
    patch: { activo?: boolean; visible_en_chat?: boolean; grupo_crm?: string; titulo_amigable?: string }
  ) => {
    // Actualización optimista en memoria
    setTemplates(prev => prev.map(t => t.name === tplName ? { ...t, ...patch } : t))
    setUpdatingGovernance(tplName)

    try {
      const res = await apiFetch(`/api/whatsapp/cloud/templates/${tplName}/config`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Error al actualizar configuración de plantilla')
      }
      setSuccessFeedback(`Configuración de '${tplName}' guardada con éxito.`)
      setTimeout(() => setSuccessFeedback(null), 3000)
    } catch (err: any) {
      console.error('Error guardando gobernanza de plantilla:', err)
      setErrorFeedback(`No se pudo guardar la configuración: ${err.message}`)
      setTimeout(() => setErrorFeedback(null), 5000)
      fetchTemplates() // revertir
    } finally {
      setUpdatingGovernance(null)
    }
  }

  const resetForm = () => {
    setEditingTemplate(null)
    setName('')
    setCategory('UTILITY')
    setHeaderType('TEXT')
    setHeaderContent('')
    setBodyText('')
    setFooterText('Centrovisión Oftalmología Integral')
    setButtons([{ type: 'QUICK_REPLY', text: 'Confirmar Turno' }])
    setVariableMappings({})
    setSampleValues({})
  }

  // Filtrado de lista con gobernanza y grupos
  const filteredTemplates = templates.filter(tpl => {
    // Búsqueda por nombre técnico, título amigable o texto del cuerpo
    const q = searchFilter.toLowerCase().trim()
    const matchesSearch = !q ||
      tpl.name.toLowerCase().includes(q) ||
      (tpl.titulo_amigable && tpl.titulo_amigable.toLowerCase().includes(q)) ||
      tpl.body_text.toLowerCase().includes(q)

    // Filtro por categoría Meta
    const matchesCategory = categoryFilter === 'ALL' || 
      (categoryFilter === 'SEGUIMIENTO' ? tpl.name.startsWith('seguimiento_') : tpl.category === categoryFilter)

    // Filtro por Grupo CRM
    const matchesGroup = groupFilter === 'ALL' || (tpl.grupo_crm || 'Atención General') === groupFilter

    // Filtro por Estado de Uso / Visibilidad en Chat
    let matchesStatusUsage = true
    if (statusUsageFilter === 'ACTIVE') {
      matchesStatusUsage = tpl.activo !== false
    } else if (statusUsageFilter === 'INACTIVE') {
      matchesStatusUsage = tpl.activo === false
    } else if (statusUsageFilter === 'CHAT_ONLY') {
      matchesStatusUsage = tpl.activo !== false && tpl.visible_en_chat !== false && tpl.status === 'APPROVED'
    }

    return matchesSearch && matchesCategory && matchesGroup && matchesStatusUsage
  })

  // Contadores
  const countApproved = templates.filter(t => t.status === 'APPROVED').length
  const countPending = templates.filter(t => t.status === 'PENDING').length
  const countRejected = templates.filter(t => t.status === 'REJECTED').length
  const countActivas = templates.filter(t => t.activo !== false).length
  const countInactivas = templates.filter(t => t.activo === false).length
  const countChatVisible = templates.filter(t => t.activo !== false && t.visible_en_chat !== false && t.status === 'APPROVED').length

  return (
    <div className="space-y-6">
      {/* Encabezado y Barra de Acciones */}
      <div className="bg-[#121c29] rounded-xl p-6 border border-[#1e2d42] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquareText className="w-6 h-6 text-emerald-400" />
                Plantillas de WhatsApp (Meta Cloud API)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                Oficial Meta v21+
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Diseña y sincroniza plantillas pre-aprobadas para iniciar conversaciones clínicas y enviar recordatorios de turnos fuera de la ventana de 24 horas sin costos adicionales.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleRegisterEstudiosTemplates}
              disabled={registeringEstudios}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              title="Registrar las plantillas oficiales de entrega de Estudios Oftalmológicos (PDF / Imagen / Interactivo) en Meta Graph API"
            >
              <Eye className={`w-4 h-4 ${registeringEstudios ? 'animate-spin text-white' : 'text-cyan-100'}`} />
              <span>{registeringEstudios ? 'Registrando...' : 'Pack Estudios Oftalmo'}</span>
            </button>

            <button
              onClick={handleRegisterFollowUpTemplates}
              disabled={registeringFollowUp}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              title="Registrar las 7 plantillas oficiales de seguimiento quirúrgico en Meta Graph API y en el CRM"
            >
              <Zap className={`w-4 h-4 ${registeringFollowUp ? 'animate-bounce text-amber-300' : 'text-amber-300'}`} />
              <span>{registeringFollowUp ? 'Registrando en Meta...' : 'Registrar Pack Seguimiento'}</span>
            </button>

            <button
              onClick={handleSyncWithMeta}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1a2738] hover:bg-[#23354c] text-slate-200 border border-[#2b3e58] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              title="Sincronizar plantillas con tu cuenta de Meta"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar con Meta'}</span>
            </button>

            <button
              onClick={() => {
                resetForm()
                setIsCreateModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Plantilla</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {successFeedback && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-sm flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successFeedback}</span>
          </div>
        )}
        {errorFeedback && !isCreateModalOpen && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorFeedback}</span>
          </div>
        )}

        {/* Estadísticas / KPIs de Gobernanza */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-[#1e2d42]">
          <div className="p-3 rounded-lg bg-[#162232] border border-[#233348]">
            <div className="text-xs font-medium text-slate-400">Total en Meta</div>
            <div className="text-xl font-bold text-white mt-0.5">{templates.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#0b2923]/60 border border-[#134e48]">
            <div className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Aprobadas Meta
            </div>
            <div className="text-xl font-bold text-emerald-300 mt-0.5">{countApproved}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#0d2738]/60 border border-[#174e6f]">
            <div className="text-xs font-medium text-cyan-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Activas en CRM
            </div>
            <div className="text-xl font-bold text-cyan-300 mt-0.5">{countActivas}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#162038]/60 border border-[#2b3a68]">
            <div className="text-xs font-medium text-blue-400 flex items-center gap-1">
              <Send className="w-3.5 h-3.5" /> Visibles en Chat
            </div>
            <div className="text-xl font-bold text-blue-300 mt-0.5">{countChatVisible}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#2a151b]/60 border border-[#581c25]">
            <div className="text-xs font-medium text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Inactivas / Fuera de uso
            </div>
            <div className="text-xl font-bold text-red-300 mt-0.5">{countInactivas}</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros: Búsqueda, Disponibilidad y Grupos */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, título o contenido..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#162232] border border-[#233348] rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-white placeholder:text-slate-500"
            />
          </div>

          {/* Filtro por estado en CRM */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#162232] p-1 rounded-lg border border-[#233348] text-xs flex-wrap">
            <button
              onClick={() => setStatusUsageFilter('ALL')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusUsageFilter === 'ALL' ? 'bg-[#23354c] text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({templates.length})
            </button>
            <button
              onClick={() => setStatusUsageFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusUsageFilter === 'ACTIVE' ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              Activas ({countActivas})
            </button>
            <button
              onClick={() => setStatusUsageFilter('CHAT_ONLY')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusUsageFilter === 'CHAT_ONLY' ? 'bg-blue-950 text-blue-300 font-semibold border border-blue-800/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              En Chat ({countChatVisible})
            </button>
            <button
              onClick={() => setStatusUsageFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusUsageFilter === 'INACTIVE' ? 'bg-red-950 text-red-300 font-semibold border border-red-800/50' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fuera de uso ({countInactivas})
            </button>
          </div>
        </div>

        {/* Barra de Filtro por Grupo Funcional CRM */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-slate-400">
          <span className="shrink-0 text-slate-500 font-medium pl-1">Grupo CRM:</span>
          <button
            onClick={() => setGroupFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              groupFilter === 'ALL' ? 'bg-[#23354c] text-white' : 'bg-[#121c29] border border-[#202e42] hover:text-white'
            }`}
          >
            Todos los Grupos
          </button>
          {CRM_TEMPLATE_GROUPS.map((grp) => {
            const countInGroup = templates.filter(t => (t.grupo_crm || 'Atención General') === grp).length
            return (
              <button
                key={grp}
                onClick={() => setGroupFilter(grp)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap border transition-colors ${
                  groupFilter === grp
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 font-semibold'
                    : 'bg-[#121c29] border-[#202e42] text-slate-400 hover:text-white'
                }`}
              >
                {grp} <span className="opacity-70 text-[10px]">({countInGroup})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Catálogo de Plantillas */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700/60">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Cargando catálogo de plantillas...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700/60">
          <MessageSquareText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No se encontraron plantillas</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {searchFilter ? 'No hay plantillas que coincidan con tu búsqueda.' : 'No hay plantillas que coincidan con los filtros seleccionados.'}
          </p>
          {(searchFilter || groupFilter !== 'ALL' || statusUsageFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchFilter('')
                setGroupFilter('ALL')
                setStatusUsageFilter('ALL')
              }}
              className="mt-4 px-4 py-2 bg-[#1a2738] hover:bg-[#23354c] text-white rounded-lg text-sm font-medium inline-flex items-center gap-2 border border-[#2b3e58]"
            >
              Restablecer Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => {
            const isSaving = updatingGovernance === tpl.name
            const isInactive = tpl.activo === false

            return (
              <div 
                key={tpl.id}
                className={`rounded-xl border p-4.5 flex flex-col justify-between transition-all shadow-sm ${
                  isInactive 
                    ? 'bg-[#0f1722] border-slate-800/80 opacity-75 hover:opacity-100 hover:border-slate-700' 
                    : 'bg-[#131e2c] border-[#223247] hover:border-emerald-500/40'
                }`}
              >
                <div>
                  {/* Cabecera de la tarjeta con Título Amigable y Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-white truncate" title={tpl.titulo_amigable || tpl.name}>
                        {tpl.titulo_amigable || tpl.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-400 truncate max-w-[190px]" title={tpl.name}>
                          {tpl.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#1a2738] text-slate-300 border border-[#27394f]">
                          {tpl.category}
                        </span>
                      </div>
                    </div>

                    {/* Badge de Estado Meta */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {tpl.status === 'APPROVED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-950/80 text-emerald-300 flex items-center gap-1 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Aprobada
                        </span>
                      ) : tpl.status === 'PENDING' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-950/80 text-amber-300 flex items-center gap-1 border border-amber-500/40">
                          <Clock className="w-3 h-3 text-amber-400" /> En Revisión
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-red-950/80 text-red-300 flex items-center gap-1 border border-red-500/40" title={tpl.rejection_reason || 'Rechazada por Meta'}>
                          <AlertCircle className="w-3 h-3 text-red-400" /> Rechazada
                        </span>
                      )}

                      {/* Pill de Grupo CRM actual */}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1e2e42] text-slate-300 border border-[#2a3e59]">
                        {tpl.grupo_crm || 'Atención General'}
                      </span>
                      {/* Badge Predeterminada Línea 2 Estudios */}
                      {tpl.name === defaultEstudiosTemplates.default_pdf && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          ★ Predeterminada PDF (Línea 2)
                        </span>
                      )}
                      {tpl.name === defaultEstudiosTemplates.default_img && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                          ★ Predeterminada Imagen (Línea 2)
                        </span>
                      )}

                    </div>
                  </div>

                  {/* Previsualización del Contenido */}
                  <div className="bg-[#0b131d] rounded-lg p-3 border border-[#1e2d40] my-2">
                    {tpl.header_content && (
                      <div className="text-[11.5px] font-bold text-white mb-1 line-clamp-1">
                        {tpl.header_content}
                      </div>
                    )}
                    <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed font-sans">
                      {tpl.body_text}
                    </p>
                    {tpl.footer_text && (
                      <div className="text-[10px] text-slate-400 italic mt-1.5 truncate">
                        {tpl.footer_text}
                      </div>
                    )}
                  </div>

                  {/* Botones de acción rápida en la plantilla */}
                  {tpl.buttons && tpl.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tpl.buttons.map((b, idx) => (
                        <span 
                          key={idx} 
                          className={`px-2 py-0.5 rounded text-[10.5px] font-medium border flex items-center gap-1 ${
                            b.type === 'URL' 
                              ? 'bg-sky-950/60 text-sky-300 border-sky-800/60' 
                              : 'bg-[#1a2738] text-[#00a884] border-[#27394f]'
                          }`}
                          title={b.type === 'URL' ? `Enlace: ${b.url || 'URL dinámica'}` : 'Respuesta Rápida Interactiva'}
                        >
                          {b.type === 'URL' ? (
                            <LinkIcon className="w-3 h-3 text-sky-400" />
                          ) : (
                            <Zap className="w-3 h-3 text-[#00a884]" />
                          )}
                          <span>{b.text}</span>
                          {b.type === 'URL' && <span className="text-[9px] opacity-75 font-mono">(Web)</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Panel de Gobernanza CRM: Switches y Selector de Grupo */}
                  <div className="mt-3 pt-2.5 border-t border-[#1e2d42] space-y-2 bg-[#0d1622]/60 p-2.5 rounded-lg border border-[#1a293c]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1">
                        Gobernanza CRM
                        {isSaving && <RefreshCw className="w-3 h-3 animate-spin text-emerald-400 inline" />}
                      </span>
                      {isInactive && (
                        <span className="text-[10px] text-amber-400/90 font-medium">Fuera de uso</span>
                      )}
                    </div>

                    {/* Fila de Switches: Activo en CRM y Visible en Chat */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {/* Switch: Activo */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={tpl.activo !== false}
                          disabled={isSaving}
                          onChange={(e) => handleUpdateGovernance(tpl.name, { activo: e.target.checked })}
                          className="sr-only"
                        />
                        <div className={`w-7 h-4 rounded-full transition-colors relative ${tpl.activo !== false ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                          <div className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${tpl.activo !== false ? 'left-3.5' : 'left-0.5'}`} />
                        </div>
                        <span className={`text-[11px] font-medium ${tpl.activo !== false ? 'text-emerald-300' : 'text-slate-400'}`}>
                          {tpl.activo !== false ? 'En Uso' : 'Inactiva'}
                        </span>
                      </label>

                      {/* Switch: Visible en Chat */}
                      <label className={`flex items-center gap-2 select-none ${isInactive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          disabled={isInactive || isSaving}
                          checked={tpl.visible_en_chat !== false && !isInactive}
                          onChange={(e) => handleUpdateGovernance(tpl.name, { visible_en_chat: e.target.checked })}
                          className="sr-only"
                        />
                        <div className={`w-7 h-4 rounded-full transition-colors relative ${tpl.visible_en_chat !== false && !isInactive ? 'bg-blue-600' : 'bg-slate-700'}`}>
                          <div className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${tpl.visible_en_chat !== false && !isInactive ? 'left-3.5' : 'left-0.5'}`} />
                        </div>
                        <span className={`text-[11px] font-medium ${tpl.visible_en_chat !== false && !isInactive ? 'text-blue-300' : 'text-slate-400'}`}>
                          En Chat
                        </span>
                      </label>
                    </div>

                    {/* Selector de Grupo CRM */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>Categoría Operativa:</span>
                      </div>
                      <select
                        value={tpl.grupo_crm || 'Atención General'}
                        disabled={isSaving}
                        onChange={(e) => handleUpdateGovernance(tpl.name, { grupo_crm: e.target.value })}
                        className="w-full bg-[#142030] text-slate-200 border border-[#23354c] rounded px-2 py-1 text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                      >
                        {CRM_TEMPLATE_GROUPS.map((grp) => (
                          <option key={grp} value={grp}>
                            {grp}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="pt-3 border-t border-[#1e2d42] flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setPreviewTemplate(tpl)}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver en Simulador
                    </button>

                    <button
                      onClick={() => handleStartEdit(tpl)}
                      className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                      title="Editar contenido y revalidar en Meta manteniendo trazabilidad"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteTemplate(tpl.name)}
                    className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded cursor-pointer"
                    title="Eliminar plantilla"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / DRAWER CREADOR DE PLANTILLAS CON SIMULADOR EN VIVO */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121c29] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-[#1e2d42] animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 border-b border-[#1e2d42] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {editingTemplate ? (
                    <>
                      <Pencil className="w-5 h-5 text-cyan-400" />
                      Editar Plantilla en Meta (Actualizar Contenido)
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      Diseñador de Plantilla WhatsApp (Meta Graph API v21+)
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingTemplate 
                    ? `Modifica el texto o componentes de '${editingTemplate.name}'. Meta revisará la actualización manteniendo intacta la trazabilidad y métricas.`
                    : 'Redacta el mensaje, inserta variables clínicas y previsualiza en tiempo real el teléfono de WhatsApp.'
                  }
                </p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2738] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal: Pantalla Dividida */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Formulario (7 Cols) */}
              <form onSubmit={handleCreateTemplate} className="lg:col-span-7 space-y-4">
                {/* Accesos Rápidos de Plantillas Pre-diseñadas (Solo si es nueva plantilla) */}
                {!editingTemplate && (
                  <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-3">
                    <div className="text-xs font-semibold text-emerald-300 mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Plantillas Médicas Pre-armadas (1 Clic)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PREMADE_TEMPLATES.map((pm, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleLoadPremade(pm)}
                          className="px-2.5 py-1 bg-[#1a2738] hover:bg-[#25374d] text-emerald-300 rounded-md text-xs font-medium border border-emerald-800/40 shadow-2xs transition-colors"
                        >
                          {pm.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nombre y Categoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Nombre Técnico (Meta) *</span>
                      {editingTemplate && (
                        <span className="text-[10px] text-cyan-400 font-normal">Inmutable en Meta</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={name}
                      disabled={!!editingTemplate}
                      onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      placeholder="ej: recordatorio_turno_medico"
                      className={`w-full px-3 py-2 border rounded-lg text-sm text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 ${
                        editingTemplate 
                          ? 'bg-[#0f1722] border-slate-700/60 opacity-80 cursor-not-allowed text-slate-300' 
                          : 'bg-[#162232] border-[#233348]'
                      }`}
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {editingTemplate 
                        ? 'Se actualiza la plantilla existente sin crear duplicados.' 
                        : 'Solo minúsculas, números y guiones bajos.'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Categoría en Meta *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#162232] border border-[#233348] rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="UTILITY">UTILITY (Recomendada: Recordatorios y Confirmaciones)</option>
                      <option value="MARKETING">MARKETING (Promociones y Novedades)</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">UTILITY aprueba en minutos y tiene menor costo.</span>
                  </div>
                </div>

                {/* Cabecera (Opcional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Título de Cabecera (Opcional)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {headerContent.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    value={headerContent}
                    maxLength={60}
                    onChange={(e) => {
                      // Filtrar en vivo cualquier emoji o carácter prohibido por Meta
                      const cleanVal = e.target.value.replace(/[\r\n]+/g, ' ').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,;:!?()/\-_]/g, '')
                      setHeaderContent(cleanVal)
                    }}
                    placeholder="ej: Presupuesto Quirurgico"
                    className="w-full px-3 py-2 bg-[#162232] border border-[#233348] rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10.5px] text-amber-400/90 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Meta prohíbe terminantemente emojis (📄, 🩺), asteriscos (*) y saltos de línea en el encabezado.
                  </p>
                </div>

                {/* Cuerpo con Selector de Fichas Clínicas */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Cuerpo del Mensaje (Body) *
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {bodyText.length}/1024 caracteres
                    </span>
                  </div>

                  {/* Barra de Fichas de Variables Clínicas */}
                  <div className="p-2.5 bg-[#162232] rounded-t-lg border border-b-0 border-[#233348] flex flex-col gap-1.5">
                    <div className="text-[11px] font-medium text-slate-400">
                      Haz clic para insertar variables clínicas automáticas:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {CLINICAL_VARIABLES.map((v) => {
                        const Icon = v.icon
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleInsertVariable(v)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1a2738] hover:bg-[#25374d] text-slate-200 hover:text-emerald-300 rounded text-xs font-medium border border-[#2b3e58] transition-colors shadow-2xs"
                          >
                            <Icon className="w-3 h-3 text-emerald-400" />
                            <span>{v.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={5}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Hola {{1}}, le recordamos su turno para el {{2}} a las {{3}} hs con el {{4}}..."
                    className="w-full p-3 bg-[#0b131d] border border-[#1e2d40] rounded-b-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                    required
                  />
                </div>

                {/* Pie de Página (Footer) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pie de Página Institucional (Footer)
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="ej: MedCRM • Clínica Médica"
                    maxLength={60}
                    className="w-full px-3 py-2 bg-[#162232] border border-[#233348] rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Botones Interactivos de WhatsApp (Hasta 3) */}
                <div className="bg-[#0e1722] p-3.5 rounded-xl border border-[#1e2d42] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Botones Interactivos (Hasta 3)
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Soporta tanto <span className="text-emerald-300 font-medium">Respuesta Rápida</span> (entrega de PDF o confirmación en chat) como <span className="text-sky-300 font-medium">Enlace Web</span> (URL a PDF o Portal).
                      </p>
                    </div>
                    {buttons.length < 3 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: '' }])}
                          className="text-[11px] px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50 rounded font-medium flex items-center gap-1 transition-colors"
                          title="Agregar botón de respuesta interactiva en chat"
                        >
                          <Zap className="w-3 h-3" /> + Respuesta
                        </button>
                        <button
                          type="button"
                          onClick={() => setButtons(prev => [...prev, { 
                            type: 'URL', 
                            text: 'Ver Presupuesto', 
                            url: 'https://crmagenticonube-production.up.railway.app/api/presupuestos/pdf/{{1}}' 
                          }])}
                          className="text-[11px] px-2 py-1 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-800/50 rounded font-medium flex items-center gap-1 transition-colors"
                          title="Agregar botón de enlace web dinámico"
                        >
                          <LinkIcon className="w-3 h-3" /> + Enlace Web
                        </button>
                      </div>
                    )}
                  </div>

                  {buttons.length === 0 && (
                    <div className="text-center py-2 text-xs text-slate-500 italic">
                      Sin botones configurados. (Opcional)
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {buttons.map((btn, idx) => (
                      <div key={idx} className="bg-[#14202e] border border-[#22354c] rounded-lg p-2.5 space-y-2">
                        {/* Cabecera del Botón */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                            <select
                              value={btn.type}
                              onChange={(e) => {
                                const newType = e.target.value
                                setButtons(prev => prev.map((b, i) => {
                                  if (i !== idx) return b
                                  return {
                                    ...b,
                                    type: newType,
                                    url: newType === 'URL' 
                                      ? (b.url || 'https://crmagenticonube-production.up.railway.app/api/presupuestos/pdf/{{1}}') 
                                      : undefined
                                  }
                                }))
                              }}
                              className="text-xs px-2 py-1 bg-[#0b131d] border border-[#2a3f5a] rounded text-slate-200 font-medium focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="QUICK_REPLY">⚡ Respuesta Rápida (Recibir PDF / Confirmar)</option>
                              <option value="URL">🔗 Enlace Web (URL a PDF o Portal)</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setButtons(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-400 p-1 transition-colors"
                            title="Quitar botón"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Texto del Botón */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={btn.text}
                            maxLength={25}
                            onChange={(e) => {
                              const val = e.target.value
                              setButtons(prev => prev.map((b, i) => i === idx ? { ...b, text: val } : b))
                            }}
                            placeholder={btn.type === 'URL' ? 'ej: Ver Presupuesto Web' : 'ej: Recibir Presupuesto PDF o Confirmar Turno'}
                            className="flex-1 px-3 py-1.5 bg-[#0b131d] border border-[#233348] rounded text-xs text-white focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">
                            {btn.text.length}/25
                          </span>
                        </div>

                        {/* Campo Adicional para Tipo URL */}
                        {btn.type === 'URL' && (
                          <div className="space-y-1">
                            <label className="text-[10.5px] font-semibold text-sky-300 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3 text-sky-400" /> Dirección URL de Destino
                            </label>
                            <input
                              type="text"
                              value={btn.url || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setButtons(prev => prev.map((b, i) => i === idx ? { ...b, url: val } : b))
                              }}
                              placeholder="https://crmagenticonube-production.up.railway.app/api/presupuestos/pdf/{{1}}"
                              className="w-full px-2.5 py-1.5 bg-[#0b131d] border border-[#233348] rounded text-xs text-sky-200 font-mono focus:ring-2 focus:ring-sky-500"
                            />
                            <p className="text-[10px] text-slate-400 leading-tight">
                              💡 Meta exige estrictamente que <code className="text-sky-300 bg-black/40 px-1 rounded">{'{{1}}'}</code> esté al final de la URL (ej: <code className="text-sky-300">.../pdf/{'{{1}}'}</code>). El CRM insertará el ID del presupuesto automáticamente.
                            </p>
                          </div>
                        )}

                        {/* Ayuda para QUICK_REPLY */}
                        {btn.type === 'QUICK_REPLY' && (
                          <p className="text-[10px] text-slate-400 leading-tight">
                            ⚡ Al presionar este botón en WhatsApp, el CRM detecta la intención y responderá entregando el PDF o confirmando la cita al instante.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {errorFeedback && (
                  <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorFeedback}</span>
                  </div>
                )}
              </form>

              {/* Columna Derecha: Simulador en Vivo de WhatsApp (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center bg-[#0b131d] p-4 rounded-xl border border-[#1e2d40]">
                <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" /> Vista Previa en Tiempo Real
                </div>

                <WhatsAppPhoneSimulator
                  headerType={headerType}
                  headerContent={headerContent}
                  bodyText={bodyText}
                  footerText={footerText}
                  buttons={buttons.filter(b => b.text.trim().length > 0)}
                  variableMappings={variableMappings}
                  sampleValues={sampleValues}
                />
              </div>
            </div>

            {/* Pie del Modal: Botones de Acción */}
            <div className="px-6 py-4 border-t border-[#1e2d42] flex items-center justify-between bg-[#121c29] rounded-b-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>La plantilla se enviará automáticamente a Meta para revisión oficial.</span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:bg-[#1a2738] rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateTemplate}
                  className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-semibold shadow-md transition-colors disabled:opacity-50 cursor-pointer ${
                    editingTemplate 
                      ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20' 
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{editingTemplate ? 'Actualizando en Meta...' : 'Enviando a Meta...'}</span>
                    </>
                  ) : (
                    <>
                      {editingTemplate ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      <span>{editingTemplate ? 'Guardar Cambios y Revalidar en Meta' : 'Guardar y Enviar a Revisión'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE PREVISUALIZACIÓN INDEPENDIENTE DESDE LA LISTA */}
      {/* ========================================================================= */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#121c29] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1e2d42] relative animate-in zoom-in-95">
            <button
              onClick={() => setPreviewTemplate(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-3">
              <h3 className="font-bold text-white text-base truncate">
                {previewTemplate.name}
              </h3>
              <div className="text-xs text-slate-400 mt-0.5">
                Categoría: {previewTemplate.category} • {previewTemplate.language}
              </div>
            </div>

            <div className="flex justify-center">
              <WhatsAppPhoneSimulator
                headerType={previewTemplate.header_type}
                headerContent={previewTemplate.header_content}
                bodyText={previewTemplate.body_text}
                footerText={previewTemplate.footer_text}
                buttons={previewTemplate.buttons}
                variableMappings={previewTemplate.variable_mappings}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
