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
  HelpCircle,
  X,
  User,
  Calendar,
  Stethoscope,
  DollarSign,
  Tag,
  Glasses,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Pencil,
  Power,
  Lock
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import WhatsAppPhoneSimulator from '@/components/settings/whatsapp/WhatsAppPhoneSimulator'

export interface OpticaTemplate {
  id?: string
  waba_id?: string
  meta_template_id?: string
  name: string
  titulo_amigable?: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'NOT_PROVISIONED' | 'PAUSED' | 'DISABLED'
  header_type: 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT'
  header_content?: string
  body_text: string
  footer_text?: string
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>
  variable_mappings?: Record<string, string>
  sample_values?: string[]
  rejection_reason?: string
  activo?: boolean
  is_catalog_base?: boolean
  created_at?: string
  updated_at?: string
}

const OPTICA_VARIABLES = [
  { id: 'paciente_nombre', label: 'Primer Nombre Paciente', icon: User, sample: 'Mariana' },
  { id: 'prestador_nombre', label: 'Médico / Profesional', icon: Stethoscope, sample: 'Dr. Bonanno' },
  { id: 'turno_fecha_hora', label: 'Fecha y Hora Turno', icon: Calendar, sample: 'Mañana a las 10:30 hs' },
  { id: 'porcentaje_descuento', label: 'Descuento (% OFF)', icon: Tag, sample: '20% OFF' },
  { id: 'codigo_beneficio', label: 'Código Cupón Voucher', icon: Sparkles, sample: '#VORTIX-8A4F' },
  { id: 'detalle_trabajo', label: 'Tipo Lente / Armazón', icon: Glasses, sample: 'Multifocales Antirreflex' },
  { id: 'horario_atencion', label: 'Horario Retiro', icon: Clock, sample: 'Lunes a Viernes de 8:30 a 20 hs' }
]

const SAMPLE_VALUES_DICT: Record<string, string> = {
  paciente_nombre: 'Mariana',
  prestador_nombre: 'Dr. Bonanno',
  turno_fecha_hora: 'Mañana a las 10:30 hs',
  porcentaje_descuento: '20% OFF',
  codigo_beneficio: '#VORTIX-8A4F',
  detalle_trabajo: 'Multifocales con Filtro Azul',
  horario_atencion: 'Lunes a Viernes de 8:30 a 20 hs'
}

export default function OpticaTemplatesManager() {
  const [plantillas, setPlantillas] = useState<OpticaTemplate[]>([])
  const [metricas, setMetricas] = useState({ aprobadas: 0, en_revision: 0, rechazadas: 0, no_aprovisionadas: 0 })
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [aprovisionandoBase, setAprovisionandoBase] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<OpticaTemplate | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'NOT_PROVISIONED'>('ALL')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  // Modal Diseñador / Editor
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<OpticaTemplate | null>(null)
  const [nombrePlantilla, setNombrePlantilla] = useState('')
  const [tituloAmigable, setTituloAmigable] = useState('')
  const [categoria, setCategoria] = useState<'MARKETING' | 'UTILITY'>('MARKETING')
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT'>('NONE')
  const [headerContent, setHeaderContent] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [footerText, setFooterText] = useState('Óptica Vortix • Responde BAJA para no recibir promos')
  const [buttons, setButtons] = useState<Array<{ type: string; text: string; url?: string }>>([
    { type: 'QUICK_REPLY', text: 'Quiero mi descuento' }
  ])
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)

  const cargarPlantillas = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const res = await apiFetch('/api/optica-vortix/plantillas')
      const data = await res.json()
      if (res.ok && data.success) {
        setPlantillas(data.plantillas || [])
        if (data.metricas) setMetricas(data.metricas)
        if (!selectedTemplate && data.plantillas?.length > 0) {
          setSelectedTemplate(data.plantillas[0])
        } else if (selectedTemplate) {
          const updated = (data.plantillas || []).find((p: OpticaTemplate) => p.name === selectedTemplate.name)
          if (updated) setSelectedTemplate(updated)
        }
      }
    } catch (err: any) {
      if (!silencioso) {
        setFeedback({ type: 'error', text: 'No se pudieron cargar las plantillas de Óptica Vortix.' })
      }
    } finally {
      if (!silencioso) setLoading(false)
    }
  }

  useEffect(() => {
    cargarPlantillas()
  }, [])

  const handleSincronizarMeta = async () => {
    setSincronizando(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/optica-vortix/plantillas/sincronizar', {
        method: 'POST',
        timeoutMs: 35000
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          text: data.mensaje || 'Sincronización con Meta WABA completada con éxito.'
        })
        await cargarPlantillas(true)
      } else {
        setFeedback({
          type: 'error',
          text: data.detail || data.mensaje || 'Error al sincronizar plantillas con Meta.'
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: 'Error de red o timeout al sincronizar con Meta. Verifica la conexión del servidor.'
      })
    } finally {
      setSincronizando(false)
    }
  }

  const handleAprovisionarBase = async () => {
    setAprovisionandoBase(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/optica-vortix/plantillas/aprovisionar-base', {
        method: 'POST',
        timeoutMs: 40000
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          text: `¡Se enviaron a Meta las 4 plantillas base de Óptica Vortix! Estado actual: ${data.plantillas?.map((p: any) => `${p.name} (${p.status})`).join(', ')}.`
        })
        await cargarPlantillas(true)
      } else {
        setFeedback({
          type: 'error',
          text: data.detail || 'Meta rechazó el aprovisionamiento de las plantillas base.'
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: 'Demora al comunicar con Meta Cloud API. Por favor pulsa "Sincronizar con Meta" en unos segundos para verificar su recepción.'
      })
    } finally {
      setAprovisionandoBase(false)
    }
  }

  const handleAprovisionarIndividual = async (tpl: OpticaTemplate) => {
    setFeedback(null)
    try {
      const res = await apiFetch(`/api/optica-vortix/plantillas/${tpl.name}/aprovisionar`, {
        method: 'POST',
        timeoutMs: 35000
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          text: data.mensaje || `Plantilla '${tpl.name}' enviada a Meta con éxito.`
        })
        await cargarPlantillas(true)
      } else {
        setFeedback({
          type: 'error',
          text: data.detail || 'Error al aprovisionar la plantilla en Meta.'
        })
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Error de conexión o timeout al comunicar con Meta. Pulsa "Sincronizar con Meta" en unos segundos.'
      })
    }
  }

  const handleToggleActivo = async (tpl: OpticaTemplate) => {
    setFeedback(null)
    try {
      const res = await apiFetch(`/api/optica-vortix/plantillas/${tpl.name}/toggle-activo`, {
        method: 'PATCH'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          text: data.mensaje || `Plantilla '${tpl.name}' ${data.activo ? 'habilitada' : 'deshabilitada'}.`
        })
        await cargarPlantillas(true)
      } else {
        setFeedback({
          type: 'error',
          text: data.detail || 'Error al cambiar estado de la plantilla.'
        })
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Error de conexión al cambiar estado de la plantilla.'
      })
    }
  }

  const handleAbrirCrear = () => {
    setEditingTemplate(null)
    setNombrePlantilla('')
    setTituloAmigable('')
    setCategoria('MARKETING')
    setHeaderType('NONE')
    setHeaderContent('')
    setBodyText('')
    setFooterText('Óptica Vortix • Responde BAJA para no recibir promos')
    setButtons([{ type: 'QUICK_REPLY', text: 'Quiero mi descuento' }])
    setShowModal(true)
  }

  const handleEditarPlantilla = (tpl: OpticaTemplate) => {
    setEditingTemplate(tpl)
    setNombrePlantilla(tpl.name)
    setTituloAmigable(tpl.titulo_amigable || tpl.name)
    setCategoria(tpl.category === 'AUTHENTICATION' ? 'MARKETING' : tpl.category)
    setHeaderType(tpl.header_type || 'NONE')
    setHeaderContent(tpl.header_content || '')
    setBodyText(tpl.body_text || '')
    setFooterText(tpl.footer_text || 'Óptica Vortix • Responde BAJA para no recibir promos')
    setButtons(
      tpl.buttons && tpl.buttons.length > 0
        ? tpl.buttons.map(b => ({ type: b.type, text: b.text, url: b.url }))
        : [{ type: 'QUICK_REPLY', text: 'Quiero mi descuento' }]
    )
    setShowModal(true)
  }

  const handleEliminarPlantilla = async (tpl: OpticaTemplate) => {
    if (tpl.status === 'APPROVED') {
      alert('Las plantillas aprobadas por Meta no se pueden eliminar para proteger las campañas y automatismos activos. Puedes deshabilitarla.')
      return
    }

    if (!confirm(`¿Estás seguro de eliminar la plantilla '${tpl.name}' de Meta y del CRM? Esta acción es irreversible.`)) {
      return
    }
    setFeedback(null)
    try {
      const res = await apiFetch(`/api/optica-vortix/plantillas/${tpl.name}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({ type: 'success', text: data.mensaje || `Plantilla '${tpl.name}' eliminada.` })
        // Remoción inmediata del estado local para respuesta instantánea en UI
        setPlantillas(prev => {
          const updated = prev.filter(p => p.name !== tpl.name)
          if (selectedTemplate?.name === tpl.name) {
            setSelectedTemplate(updated.length > 0 ? updated[0] : null)
          }
          return updated
        })
        await cargarPlantillas(true)
      } else {
        setFeedback({ type: 'error', text: data.detail || 'Error al eliminar la plantilla en Meta.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error al solicitar la eliminación a Meta.' })
    }
  }

  const handleInsertarVariable = (varId: string) => {
    // Busca cuál es el siguiente número de variable {{N}}
    const matches = bodyText.match(/\{\{(\d+)\}\}/g)
    const nextIndex = matches ? matches.length + 1 : 1
    setBodyText(prev => `${prev} {{${nextIndex}}}`)
  }

  const handleGuardarPlantillaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedBody = bodyText.trim()
    if (!nombrePlantilla.trim() || !trimmedBody) {
      alert('Ingresa el nombre y el cuerpo del mensaje de la plantilla.')
      return
    }

    // Validación preventiva de reglas de Meta (Error 2388299)
    if (/^\s*\{\{\d+\}\}/.test(trimmedBody)) {
      alert(
        "Regla de Meta WhatsApp (Error 2388299): La plantilla no puede comenzar directamente con una variable {{N}}. Debes anteponer texto fijo al inicio (ej: 'Hola {{1}}...')."
      )
      return
    }
    if (/\{\{\d+\}\}[\s\.\!\?\:\;]*$/.test(trimmedBody)) {
      alert(
        "Regla de Meta WhatsApp (Error 2388299): La plantilla no puede terminar con una variable {{N}} al final. Debes incluir texto fijo de cierre después de la variable (ej: '...en el horario de {{3}}. ¡Te esperamos!')."
      )
      return
    }

    setGuardandoPlantilla(true)
    setFeedback(null)
    const isEditing = !!editingTemplate
    const cleanName = isEditing ? editingTemplate.name : nombrePlantilla.toLowerCase().replace(/[^a-z0-9_]/g, '')
    const endpoint = isEditing ? `/api/optica-vortix/plantillas/${editingTemplate.name}` : '/api/optica-vortix/plantillas'
    const method = isEditing ? 'PUT' : 'POST'

    const cleanButtons = buttons.filter(b => b.text && b.text.trim())

    // Generar muestras exactas para Meta en base a la cantidad de variables {{N}}
    const varMatches = trimmedBody.match(/\{\{(\d+)\}\}/g) || []
    const uniqueVars = Array.from(new Set(varMatches.map(m => parseInt(m.replace(/\D/g, ''), 10)))).sort((a, b) => a - b)
    const defaultSamples = [
      'Mariana',
      'Dr. Bonanno',
      '20% OFF',
      '#VORTIX-8A4F',
      'Multifocales Antirreflex',
      'Lunes a Viernes de 9 a 20 hs'
    ]
    const sampleValues = uniqueVars.map((vNum, i) => {
      if (editingTemplate?.sample_values && editingTemplate.sample_values[i]) {
        return editingTemplate.sample_values[i]
      }
      return defaultSamples[i] || `Muestra ${vNum}`
    })

    try {
      const res = await apiFetch(endpoint, {
        method,
        timeoutMs: 40000,
        body: JSON.stringify({
          name: cleanName,
          titulo_amigable: tituloAmigable.trim() || cleanName,
          category: categoria,
          language: 'es_AR',
          header_type: headerType,
          header_content: headerType === 'TEXT' ? headerContent.trim() : undefined,
          body_text: trimmedBody,
          footer_text: footerText.trim() || undefined,
          buttons: cleanButtons,
          sample_values: sampleValues
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setShowModal(false)
        setEditingTemplate(null)
        setFeedback({
          type: 'success',
          text: data.mensaje || `¡Plantilla '${cleanName}' guardada con éxito!`
        })

        // Actualización optimista inmediata en memoria
        if (isEditing) {
          setPlantillas(prev =>
            prev.map(p => {
              if (p.name === cleanName) {
                const updated: OpticaTemplate = {
                  ...p,
                  titulo_amigable: tituloAmigable.trim() || cleanName,
                  category: categoria,
                  header_type: headerType,
                  header_content: headerType === 'TEXT' ? headerContent.trim() : undefined,
                  body_text: bodyText.trim(),
                  footer_text: footerText.trim() || undefined,
                  buttons: cleanButtons,
                  status: data.status || p.status
                }
                if (selectedTemplate?.name === cleanName) {
                  setSelectedTemplate(updated)
                }
                return updated
              }
              return p
            })
          )
        }

        await cargarPlantillas(true)
      } else {
        alert(data.detail || 'Meta rechazó la plantilla.')
      }
    } catch (err: any) {
      alert('Error de red o timeout al enviar la plantilla a Meta. Verifica que los campos sean válidos.')
    } finally {
      setGuardandoPlantilla(false)
    }
  }

  const filteredPlantillas = plantillas.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.titulo_amigable || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.body_text.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchSearch) return false

    if (statusFilter === 'ALL') return true
    return p.status === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : feedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' && <CheckCircle2 size={18} className="shrink-0" />}
            {feedback.type === 'error' && <AlertCircle size={18} className="shrink-0" />}
            {feedback.type === 'info' && <Info size={18} className="shrink-0" />}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tarjeta Superior: Métricas de Autorización de Meta + Botonera de Acción */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <MessageSquareText size={18} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Plantillas Oficiales de WhatsApp (Meta WABA) • Óptica Vortix
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Gestión centralizada de plantillas pre-aprobadas por Meta para envíos automatizados, campañas de
              descuento y recetas. Aislamiento comercial estricto respecto a las líneas médicas del CRM.
            </p>
          </div>

          {/* Botonera Principal */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleSincronizarMeta}
              disabled={sincronizando}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
              <span>{sincronizando ? 'Sincronizando con Meta...' : 'Sincronizar con Meta'}</span>
            </button>

            <button
              onClick={handleAprovisionarBase}
              disabled={aprovisionandoBase}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
              title="Envía a aprobación en Meta las 4 plantillas base oficiales de Óptica Vortix"
            >
              <Zap size={14} className={aprovisionandoBase ? 'animate-pulse' : ''} />
              <span>{aprovisionandoBase ? 'Aprovisionando...' : 'Aprovisionar 4 Plantillas Base'}</span>
            </button>

            <button
              onClick={handleAbrirCrear}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus size={15} />
              <span>Nueva Plantilla</span>
            </button>
          </div>
        </div>

        {/* Barra de Estadísticas de Aprobación */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[var(--border)]">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Aprobadas (Meta)</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{metricas.aprobadas}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">En Revisión (Meta)</p>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{metricas.en_revision}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Por Aprovisionar</p>
              <p className="text-xl font-bold text-blue-400 mt-0.5">{metricas.no_aprovisionadas}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Zap size={18} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Rechazadas</p>
              <p className="text-xl font-bold text-red-400 mt-0.5">{metricas.rechazadas}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros y Buscador */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Buscador */}
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, código o texto..."
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Pestañas de Filtro de Estado */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'Todas' },
              { id: 'APPROVED', label: 'Aprobadas' },
              { id: 'PENDING', label: 'En Revisión' },
              { id: 'NOT_PROVISIONED', label: 'Por Aprovisionar' },
              { id: 'REJECTED', label: 'Rechazadas' }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de 2 Columnas: Lista de Plantillas vs Simulador en Vivo */}
      {loading ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center">
          <RefreshCw size={28} className="animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">Cargando plantillas de Óptica Vortix...</p>
        </div>
      ) : filteredPlantillas.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
            <MessageSquareText size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No se encontraron plantillas</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchTerm
                ? 'No hay plantillas que coincidan con la búsqueda ingresada.'
                : 'Aún no se han aprovisionado plantillas para Óptica Vortix en la WABA.'}
            </p>
          </div>
          {!searchTerm && (
            <button
              onClick={handleAprovisionarBase}
              disabled={aprovisionandoBase}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all"
            >
              <Zap size={14} />
              <span>Aprovisionar las 4 Plantillas Base Ahora</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Tarjetas de Plantillas (7 columnas) */}
          <div className="lg:col-span-7 space-y-3.5">
            {filteredPlantillas.map(tpl => {
              const isSelected = selectedTemplate?.name === tpl.name
              const isApproved = tpl.status === 'APPROVED'
              const isPending = tpl.status === 'PENDING'
              const isNotProv = tpl.status === 'NOT_PROVISIONED'
              const isRejected = tpl.status === 'REJECTED'

              return (
                <div
                  key={tpl.name}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-950/20 border-blue-500/50 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/30'
                      : 'bg-[var(--card)] border-[var(--border)] hover:border-slate-700 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-white tracking-wide">
                          {tpl.name}
                        </span>

                        {/* Badge de Categoría */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {tpl.category}
                        </span>

                        {/* Badge de Catálogo Base */}
                        {tpl.is_catalog_base && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            Base Oficial
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-slate-200">
                        {tpl.titulo_amigable || tpl.name}
                      </h4>
                    </div>

                    {/* Badge de Estado Meta */}
                    <div className="shrink-0">
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 size={12} />
                          <span>Aprobada</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock size={12} className="animate-spin" />
                          <span>En Revisión</span>
                        </span>
                      )}
                      {isNotProv && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          <Zap size={12} />
                          <span>Por Aprovisionar</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                          <AlertCircle size={12} />
                          <span>Rechazada</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cuerpo del Mensaje */}
                  <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed font-sans">
                    {tpl.body_text}
                  </p>

                  {/* Pie de la tarjeta con acciones */}
                  <div className="flex items-center justify-between gap-3 mt-3.5 pt-3 border-t border-[var(--border)] text-[11px]">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>Header: {tpl.header_type || 'NONE'}</span>
                      <span>•</span>
                      <span>Botones: {tpl.buttons?.length || 0}</span>
                      <span>•</span>
                      <span>es_AR</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isApproved ? (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleToggleActivo(tpl)
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                              tpl.activo !== false
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-amber-500/20 hover:text-amber-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-slate-700'
                            }`}
                            title={
                              tpl.activo !== false
                                ? 'Plantilla habilitada en CRM. Clic para pausar.'
                                : 'Plantilla pausada. Clic para habilitar.'
                            }
                          >
                            <Power size={11} />
                            <span>{tpl.activo !== false ? 'Habilitada' : 'Deshabilitada'}</span>
                          </button>

                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleEditarPlantilla(tpl)
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 border border-blue-500/30 transition-colors"
                            title="Editar texto y actualizar versión en Meta Cloud API (Opción 1)"
                          >
                            <Pencil size={11} />
                            <span>Editar en Meta</span>
                          </button>

                          <span
                            className="p-1 rounded-lg text-slate-600 cursor-not-allowed opacity-50"
                            title="Las plantillas aprobadas por Meta no pueden eliminarse directamente para proteger campañas y automatizaciones activas. Puedes deshabilitarla."
                          >
                            <Lock size={13} />
                          </span>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleEditarPlantilla(tpl)
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-colors"
                            title="Editar plantilla"
                          >
                            <Pencil size={11} />
                            <span>Editar</span>
                          </button>

                          {isNotProv && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                handleAprovisionarIndividual(tpl)
                              }}
                              className="px-2.5 py-1 rounded-lg font-medium text-[11px] bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-colors"
                              title="Aprovisionar y enviar a revisión en Meta"
                            >
                              Aprovisionar en Meta
                            </button>
                          )}

                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleEliminarPlantilla(tpl)
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                            title="Eliminar de Meta y del CRM"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Columna Derecha: Simulador de Celular WhatsApp Oficial (5 columnas) */}
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            {selectedTemplate ? (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                      Vista Previa en Smartphone
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Renderizado fiel del mensaje tal como lo recibe el paciente
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {selectedTemplate.name}
                  </span>
                </div>

                {/* Simulador de Celular WhatsApp */}
                <div className="flex justify-center">
                  <WhatsAppPhoneSimulator
                    headerType={selectedTemplate.header_type}
                    headerContent={selectedTemplate.header_content}
                    bodyText={selectedTemplate.body_text}
                    footerText={selectedTemplate.footer_text}
                    buttons={selectedTemplate.buttons}
                    variableMappings={selectedTemplate.variable_mappings}
                    sampleValues={SAMPLE_VALUES_DICT}
                    clinicName="Óptica Vortix • Centrovisión"
                  />
                </div>

                {/* Motivo de Rechazo de Meta si existe */}
                {selectedTemplate.status === 'REJECTED' && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle size={14} />
                      Motivo de Rechazo por Meta Cloud API:
                    </p>
                    <p className="text-[11px] text-red-200/90 leading-relaxed">
                      {selectedTemplate.rejection_reason ||
                        'Meta rechazó el contenido o la categoría. Las plantillas comerciales no deben incluir diagnósticos clínicos invasivos ni violar políticas de privacidad.'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center text-slate-500 text-xs">
                Selecciona una plantilla de la lista para ver su previsualización en el simulador móvil.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Diseñador / Editor de Plantillas para Meta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  {editingTemplate ? <Pencil size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingTemplate
                      ? `Editar Plantilla: ${editingTemplate.name}`
                      : 'Diseñar Nueva Plantilla para Meta'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingTemplate
                      ? editingTemplate.status === 'APPROVED'
                        ? 'Edición oficial de plantilla aprobada vía Meta Cloud API (Opción 1).'
                        : `Modifica el contenido antes de someter a Meta (${editingTemplate.status}).`
                      : 'Se enviará a revisión en la WABA 3731563350343089 con prefijo obligatorio vortix_.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingTemplate(null)
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Banner Informativo de Opción 1 de Meta si está Aprobada */}
            {editingTemplate && editingTemplate.status === 'APPROVED' && (
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 space-y-1">
                <div className="flex items-center gap-2 font-bold text-blue-200">
                  <Sparkles size={14} />
                  <span>Actualización de Versión en Meta (Opción 1 Oficial)</span>
                </div>
                <p className="text-[11px] text-blue-200/90 leading-relaxed">
                  Al guardar, se actualizarán los componentes en Meta Cloud API bajo el mismo identificador.
                  Meta someterá el nuevo texto a revisión (estado <code>PENDING</code>). Mientras tanto,
                  WhatsApp preserva la entrega de la versión actual para que tus campañas y automatizaciones no se detengan.
                </p>
              </div>
            )}

            <form onSubmit={handleGuardarPlantillaSubmit} className="space-y-4 text-xs">
              {/* Nombre Interno y Título Amigable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">
                    Nombre en Meta (minúsculas y guiones bajos):
                  </label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white">
                    <span className="text-blue-400 font-mono font-bold select-none pr-1">vortix_</span>
                    <input
                      type="text"
                      value={nombrePlantilla.replace(/^vortix_/, '')}
                      onChange={e =>
                        !editingTemplate &&
                        setNombrePlantilla(
                          `vortix_${e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')}`
                        )
                      }
                      readOnly={!!editingTemplate}
                      placeholder="promo_armazones_v1"
                      className={`bg-transparent focus:outline-none w-full font-mono text-xs ${
                        editingTemplate ? 'text-slate-400 cursor-not-allowed' : ''
                      }`}
                      required
                    />
                  </div>
                  {editingTemplate && (
                    <span className="text-[10px] text-slate-500">
                      El nombre técnico de Meta no puede modificarse al editar.
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Título Descriptivo (para el CRM):</label>
                  <input
                    type="text"
                    value={tituloAmigable}
                    onChange={e => setTituloAmigable(e.target.value)}
                    placeholder="Óptica Vortix • Promo Armazones Verano"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Categoría y Encabezado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Categoría Meta:</label>
                  <select
                    value={categoria}
                    onChange={e => setCategoria(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="MARKETING">MARKETING (Promos, Cupones, Descuentos)</option>
                    <option value="UTILITY">UTILITY (Cotizaciones de Receta, Avisos de Retiro)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Tipo de Encabezado (Header):</label>
                  <select
                    value={headerType}
                    onChange={e => setHeaderType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="NONE">Sin encabezado</option>
                    <option value="TEXT">Texto destacado (máx 60 caracteres)</option>
                    <option value="IMAGE">Imagen promocional (JPG/PNG)</option>
                    <option value="DOCUMENT">Documento adjunto (PDF)</option>
                  </select>
                </div>
              </div>

              {headerType === 'TEXT' && (
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Texto del Encabezado:</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={headerContent}
                    onChange={e => setHeaderContent(e.target.value)}
                    placeholder="Beneficio Exclusivo en Óptica Vortix"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Chips de Inserción de Variables Inteligentes */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Insertar Variable Inteligente en el Cuerpo:</label>
                  <span className="text-[11px] text-slate-500">Haz clic en un chip para inyectar</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {OPTICA_VARIABLES.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleInsertarVariable(v.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 border border-slate-700 hover:border-blue-500/40 transition-colors"
                    >
                      <v.icon size={11} />
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cuerpo del Mensaje */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Cuerpo del Mensaje (Body):</label>
                  <span className="text-[11px] text-slate-500">{bodyText.length} / 1024 caracteres</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={1024}
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  placeholder="¡Hola {{1}}! Te escribimos de Óptica Vortix con una promo especial..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  💡 <strong className="text-slate-300">Regla de Meta:</strong> Las variables <code className="text-blue-300 font-mono">{"{{N}}"}</code> deben estar rodeadas de texto (no pueden ser la primera ni la última palabra del mensaje).
                </p>
              </div>

              {/* Pie de Página (Footer) */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Pie de Página (Footer / Opt-Out):</label>
                <input
                  type="text"
                  maxLength={60}
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  placeholder="Óptica Vortix • Responde BAJA para desuscribirte"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Botones de Acción */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Botones de Respuesta Rápida (máx 2):</label>
                  <button
                    type="button"
                    onClick={() => setButtons([
                      { type: 'QUICK_REPLY', text: 'Quiero más información' },
                      { type: 'QUICK_REPLY', text: 'Contactar un asesor' }
                    ])}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline font-semibold"
                  >
                    Usar: Info + Asesor
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    maxLength={25}
                    value={buttons[0]?.text || ''}
                    onChange={e =>
                      setButtons(prev => [{ type: 'QUICK_REPLY', text: e.target.value }, prev[1]].filter(Boolean))
                    }
                    placeholder="Botón 1: Quiero más información"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    maxLength={25}
                    value={buttons[1]?.text || ''}
                    onChange={e =>
                      setButtons(prev => [prev[0], { type: 'QUICK_REPLY', text: e.target.value }].filter(Boolean))
                    }
                    placeholder="Botón 2: Contactar un asesor"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Botones del Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingTemplate(null)
                  }}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPlantilla}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                  <Send size={14} className={guardandoPlantilla ? 'animate-pulse' : ''} />
                  <span>
                    {guardandoPlantilla
                      ? 'Guardando...'
                      : editingTemplate
                      ? editingTemplate.status === 'APPROVED'
                        ? 'Actualizar Versión en Meta'
                        : 'Guardar Cambios'
                      : 'Enviar a Meta para Aprobación'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
