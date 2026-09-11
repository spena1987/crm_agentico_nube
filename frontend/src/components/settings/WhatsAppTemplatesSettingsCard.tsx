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
  Search
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
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
}

// Catálogo de variables clínicas inteligentes disponibles
const CLINICAL_VARIABLES = [
  { id: 'paciente_nombre', label: 'Nombre Paciente', icon: User, sample: 'Carlos Menéndez' },
  { id: 'turno_fecha', label: 'Fecha Turno', icon: Calendar, sample: 'Jueves 15 de Octubre' },
  { id: 'turno_hora', label: 'Hora Turno', icon: Clock, sample: '10:30 hs' },
  { id: 'medico_nombre', label: 'Profesional / Médico', icon: Stethoscope, sample: 'Dr. Roberto Gómez' },
  { id: 'practica_nombre', label: 'Práctica / Cirugía', icon: FileText, sample: 'Cirugía de Cataratas' },
  { id: 'quirofano_nombre', label: 'Sede / Quirófano', icon: Building, sample: 'Sede Central - Quirófano 1' },
  { id: 'presupuesto_monto', label: 'Monto Presupuesto', icon: DollarSign, sample: '$ 45.000' }
]

interface PremadeTemplate {
  title: string
  name: string
  category: 'UTILITY' | 'MARKETING'
  header_content: string
  body_text: string
  footer_text: string
  variable_mappings: Record<string, string>
  buttons: Array<{ type: string; text: string }>
}

// Plantillas pre-diseñadas para carga rápida
const PREMADE_TEMPLATES: PremadeTemplate[] = [
  {
    title: 'Recordatorio de Turno Quirúrgico',
    name: 'recordatorio_turno_quirurgico',
    category: 'UTILITY' as const,
    header_content: 'Recordatorio de Turno Quirúrgico 🩺',
    body_text: 'Hola {{1}}, le recordamos su turno quirúrgico programado para el día {{2}} a las {{3}} con el {{4}} para la práctica de {{5}} en {{6}}.\n\nPor favor confirme su asistencia respondiendo a este mensaje.',
    footer_text: 'MedCRM • Centro Quirúrgico',
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
    title: 'Confirmación de Consulta Médica',
    name: 'confirmacion_consulta_medica',
    category: 'UTILITY' as const,
    header_content: 'Confirmación de Consulta 📅',
    body_text: 'Estimado/a {{1}}, le confirmamos su turno para consulta médica el día {{2}} a las {{3}} hs con el {{4}}.\n\nRecuerde asistir con DNI y credencial de cobertura.',
    footer_text: 'MedCRM • Gestión de Turnos',
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
    title: 'Aviso de Presupuesto Disponible',
    name: 'aviso_presupuesto_cirugia',
    category: 'UTILITY' as const,
    header_content: 'Presupuesto Médico Disponible 📄',
    body_text: 'Hola {{1}}, ya se encuentra listo el presupuesto para su procedimiento de {{2}}. El monto total estimado es {{3}}.\n\nPuede consultar los detalles y planes de cobertura respondiendo a este mensaje.',
    footer_text: 'MedCRM • Área de Presupuestos',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'practica_nombre',
      '3': 'presupuesto_monto'
    },
    buttons: [
      { type: 'QUICK_REPLY', text: 'Ver Presupuesto' }
    ]
  }
]

export default function WhatsAppTemplatesSettingsCard() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')

  // Modal de Creación / Edición
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
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
  const [footerText, setFooterText] = useState('MedCRM • Clínica Médica')
  const [buttons, setButtons] = useState<Array<{ type: string; text: string }>>([
    { type: 'QUICK_REPLY', text: 'Confirmar Turno' }
  ])
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({})
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({})

  // Modal de previsualización independiente
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null)

  // Cargar plantillas de la base de datos
  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/cloud/templates`)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.data || [])
      }
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
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/cloud/templates/sync`, {
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

    // Extraer variables presentes en el texto
    const varMatches = Array.from(new Set((bodyText.match(/\{\{(\d+)\}\}/g) || []).map(m => m.replace(/\D/g, ''))))
    const orderedSampleValues = varMatches.map(vNum => sampleValues[vNum] || `Muestra ${vNum}`)

    try {
      setCreating(true)
      const payload = {
        name: name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category,
        language,
        header_type: headerType,
        header_content: headerType === 'TEXT' ? headerContent : null,
        body_text: bodyText,
        footer_text: footerText || null,
        buttons: buttons.filter(b => b.text.trim().length > 0),
        variable_mappings: variableMappings,
        sample_values: orderedSampleValues
      }

      const res = await fetch(`${BACKEND_URL}/api/whatsapp/cloud/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (err: any) {
      setErrorFeedback(`Error en la solicitud: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  // Eliminar plantilla
  const handleDeleteTemplate = async (tplName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la plantilla '${tplName}' de Meta y del CRM?`)) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/cloud/templates/${tplName}`, {
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

  const resetForm = () => {
    setName('')
    setCategory('UTILITY')
    setHeaderType('TEXT')
    setHeaderContent('')
    setBodyText('')
    setFooterText('MedCRM • Clínica Médica')
    setButtons([{ type: 'QUICK_REPLY', text: 'Confirmar Turno' }])
    setVariableMappings({})
    setSampleValues({})
  }

  // Filtrado de lista
  const filteredTemplates = templates.filter(tpl => {
    const matchesSearch = tpl.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
                          tpl.body_text.toLowerCase().includes(searchFilter.toLowerCase())
    const matchesCategory = categoryFilter === 'ALL' || tpl.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Contadores
  const countApproved = templates.filter(t => t.status === 'APPROVED').length
  const countPending = templates.filter(t => t.status === 'PENDING').length
  const countRejected = templates.filter(t => t.status === 'REJECTED').length

  return (
    <div className="space-y-6">
      {/* Encabezado y Barra de Acciones */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700/60 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquareText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                Plantillas de WhatsApp (Meta Cloud API)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/50">
                Oficial Meta v21+
              </span>
            </div>
            <p className="text-sm text-slate-550 dark:text-slate-400 mt-1 max-w-2xl">
              Diseña y sincroniza plantillas pre-aprobadas para iniciar conversaciones clínicas y enviar recordatorios de turnos fuera de la ventana de 24 horas sin costos adicionales.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleSyncWithMeta}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              title="Sincronizar plantillas con tu cuenta de Meta"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar con Meta'}</span>
            </button>

            <button
              onClick={() => {
                resetForm()
                setIsCreateModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Plantilla</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {successFeedback && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successFeedback}</span>
          </div>
        )}
        {errorFeedback && !isCreateModalOpen && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorFeedback}</span>
          </div>
        )}

        {/* Estadísticas / KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/60">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-750/50 border border-slate-100 dark:border-slate-700/40">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Plantillas</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{templates.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Aprobadas
            </div>
            <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{countApproved}</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> En Revisión
            </div>
            <div className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-0.5">{countPending}</div>
          </div>
          <div className="p-3 rounded-lg bg-red-50/70 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
            <div className="text-xs font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Rechazadas
            </div>
            <div className="text-xl font-bold text-red-800 dark:text-red-300 mt-0.5">{countRejected}</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar plantilla por nombre o contenido..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              categoryFilter === 'ALL' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setCategoryFilter('UTILITY')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              categoryFilter === 'UTILITY' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Utilidad (Turnos)
          </button>
          <button
            onClick={() => setCategoryFilter('MARKETING')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              categoryFilter === 'MARKETING' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Marketing
          </button>
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
            {searchFilter ? 'No hay plantillas que coincidan con tu búsqueda.' : 'Aún no tienes plantillas creadas. Puedes crear tu primera plantilla para recordatorios de turnos haciendo clic en el botón superior.'}
          </p>
          {!searchFilter && (
            <button
              onClick={() => {
                resetForm()
                setIsCreateModalOpen(true)
              }}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Crear Primera Plantilla
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => (
            <div 
              key={tpl.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4.5 flex flex-col justify-between hover:shadow-md transition-shadow group"
            >
              <div>
                {/* Cabecera de la tarjeta */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate" title={tpl.name}>
                      {tpl.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {tpl.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {tpl.language}
                      </span>
                    </div>
                  </div>

                  {/* Badge de Estado */}
                  <div className="shrink-0">
                    {tpl.status === 'APPROVED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300/50">
                        <CheckCircle2 className="w-3 h-3" /> Aprobada
                      </span>
                    ) : tpl.status === 'PENDING' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center gap-1 border border-amber-300/50">
                        <Clock className="w-3 h-3" /> En Revisión
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 flex items-center gap-1 border border-red-300/50" title={tpl.rejection_reason || 'Rechazada por Meta'}>
                        <AlertCircle className="w-3 h-3" /> Rechazada
                      </span>
                    )}
                  </div>
                </div>

                {/* Previsualización del Contenido */}
                <div className="bg-slate-50 dark:bg-slate-750/60 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50 my-2.5">
                  {tpl.header_content && (
                    <div className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200 mb-1 line-clamp-1">
                      {tpl.header_content}
                    </div>
                  )}
                  <p className="text-xs text-slate-650 dark:text-slate-300 line-clamp-4 leading-relaxed font-sans">
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
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tpl.buttons.map((b, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[10.5px] bg-slate-100 dark:bg-slate-700/80 text-[#00a884] font-medium border border-slate-200/60 dark:border-slate-650">
                        🔘 {b.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Acciones de la Tarjeta */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between mt-1">
                <button
                  onClick={() => setPreviewTemplate(tpl)}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver en Simulador
                </button>

                <button
                  onClick={() => handleDeleteTemplate(tpl.name)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                  title="Eliminar plantilla"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / DRAWER CREADOR DE PLANTILLAS CON SIMULADOR EN VIVO */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  Diseñador de Plantilla WhatsApp (Meta Graph API v21+)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Redacta el mensaje, inserta variables clínicas y previsualiza en tiempo real el teléfono de WhatsApp.
                </p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal: Pantalla Dividida */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Formulario (7 Cols) */}
              <form onSubmit={handleCreateTemplate} className="lg:col-span-7 space-y-4">
                {/* Accesos Rápidos de Plantillas Pre-diseñadas */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3">
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Plantillas Médicas Pre-armadas (1 Clic)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PREMADE_TEMPLATES.map((pm, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleLoadPremade(pm)}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-medium border border-emerald-200/60 dark:border-emerald-800 shadow-2xs transition-colors"
                      >
                        {pm.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre y Categoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre Técnico (Meta) *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      placeholder="ej: recordatorio_turno_medico"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <span className="text-[10px] text-slate-450 mt-0.5 block">Solo minúsculas, números y guiones bajos.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Categoría en Meta *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="UTILITY">UTILITY (Recomendada: Recordatorios y Confirmaciones)</option>
                      <option value="MARKETING">MARKETING (Promociones y Novedades)</option>
                    </select>
                    <span className="text-[10px] text-slate-450 mt-0.5 block">UTILITY aprueba en minutos y tiene menor costo.</span>
                  </div>
                </div>

                {/* Cabecera (Opcional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Título de Cabecera (Opcional)
                  </label>
                  <input
                    type="text"
                    value={headerContent}
                    onChange={(e) => setHeaderContent(e.target.value)}
                    placeholder="ej: Recordatorio de Turno Quirúrgico 🩺"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Cuerpo con Selector de Fichas Clínicas */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Cuerpo del Mensaje (Body) *
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {bodyText.length}/1024 caracteres
                    </span>
                  </div>

                  {/* Barra de Fichas de Variables Clínicas */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-750/70 rounded-t-lg border border-b-0 border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
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
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 rounded text-xs font-medium border border-slate-200 dark:border-slate-600 transition-colors shadow-2xs"
                          >
                            <Icon className="w-3 h-3 text-emerald-600" />
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
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-b-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                    required
                  />
                </div>

                {/* Pie de Página (Footer) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pie de Página Institucional (Footer)
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="ej: MedCRM • Clínica Médica"
                    maxLength={60}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Botones de Acción Rápida (Quick Reply) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Botones de Respuesta Rápida (Hasta 3)
                    </label>
                    {buttons.length < 3 && (
                      <button
                        type="button"
                        onClick={() => setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: '' }])}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Agregar Botón
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {buttons.map((btn, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono w-4">{idx + 1}.</span>
                        <input
                          type="text"
                          value={btn.text}
                          maxLength={25}
                          onChange={(e) => {
                            const val = e.target.value
                            setButtons(prev => prev.map((b, i) => i === idx ? { ...b, text: val } : b))
                          }}
                          placeholder={`ej: ${idx === 0 ? 'Confirmar Turno' : idx === 1 ? 'Reprogramar' : 'Cancelar'}`}
                          className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setButtons(prev => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {errorFeedback && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorFeedback}</span>
                  </div>
                )}
              </form>

              {/* Columna Derecha: Simulador en Vivo de WhatsApp (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Vista Previa en Tiempo Real
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
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 rounded-b-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>La plantilla se enviará automáticamente a Meta para revisión oficial.</span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-650 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateTemplate}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-md transition-colors disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando a Meta...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Guardar y Enviar a Revisión</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 relative animate-in zoom-in-95">
            <button
              onClick={() => setPreviewTemplate(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
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
