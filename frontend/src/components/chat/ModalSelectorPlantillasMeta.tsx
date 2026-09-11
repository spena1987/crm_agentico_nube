'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Calendar,
  FileText,
  Clock,
  ClipboardCopy,
  DollarSign,
  ExternalLink,
  Info,
  Check,
  RefreshCw,
  Zap
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export interface MetaTemplateButton {
  type: string
  text: string
  url?: string
  phone_number?: string
}

export interface MetaTemplateData {
  id?: string
  name: string
  title?: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | string
  language: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | string
  header_type?: string
  header_content?: string | null
  body_text: string
  footer_text?: string | null
  buttons?: MetaTemplateButton[]
  variable_mappings?: Record<string, string>
  description?: string
  created_at?: string
}

// Catálogo de respaldo en caso de desconexión o base de datos vacía
const FALLBACK_TEMPLATES: MetaTemplateData[] = [
  {
    name: 'hello_world',
    title: '👋 Saludo Inicial / Reactivación Oficial (Default Meta)',
    category: 'UTILITY',
    language: 'en_US',
    status: 'APPROVED',
    description: 'Plantilla de prueba oficial aprobada automáticamente por Meta en todas las cuentas de WhatsApp Business.',
    body_text: 'Hello World! Welcome and congratulations on your first message.',
    variable_mappings: {}
  },
  {
    name: 'recordatorio_turno_quirurgico_v1',
    title: '📅 Recordatorio de Turno Quirúrgico',
    category: 'UTILITY',
    language: 'es_AR',
    status: 'APPROVED',
    header_type: 'TEXT',
    header_content: 'Recordatorio Quirurgico',
    description: 'Notifica al paciente sobre su turno quirúrgico con fecha, profesional e instrucciones.',
    body_text: 'Hola {{1}}, te recordamos tu turno médico programado para el {{2}} con el profesional {{3}}. Por favor confirma tu asistencia.',
    footer_text: 'MedCRM Clínica Quirúrgica',
    variable_mappings: {
      '1': 'paciente_nombre',
      '2': 'turno_fecha',
      '3': 'profesional_nombre'
    }
  },
  {
    name: 'seguimiento_quirurgico',
    title: '🏥 Seguimiento de Procedimiento Quirúrgico',
    category: 'UTILITY',
    language: 'es_AR',
    status: 'APPROVED',
    header_type: 'NONE',
    description: 'Contacta al paciente para continuar la gestión quirúrgica o preoperatoria.',
    body_text: 'Hola {{1}}, nos comunicamos del área de atención para coordinar los avances de tu procedimiento médico. ¿Podrías responder este mensaje para asesorarte?',
    footer_text: 'Atención al Paciente',
    variable_mappings: {
      '1': 'paciente_nombre'
    }
  }
]

interface ModalSelectorPlantillasMetaProps {
  isOpen: boolean
  onClose: () => void
  pacienteNombre: string
  pacienteTelefono: string
  pacienteId?: string
  conversacionId?: string | null
  isWindowOpen?: boolean
  onInsertText?: (text: string) => void
  onEnviadoExitoso?: () => void
}

export default function ModalSelectorPlantillasMeta({
  isOpen,
  onClose,
  pacienteNombre,
  pacienteTelefono,
  pacienteId,
  conversacionId,
  isWindowOpen = true,
  onInsertText,
  onEnviadoExitoso
}: ModalSelectorPlantillasMetaProps) {
  const [templates, setTemplates] = useState<MetaTemplateData[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplateData | null>(null)
  const [paramValues, setParamValues] = useState<string[]>([])
  const [buttonParamValue, setButtonParamValue] = useState<string>('')
  const [cargandoTemplates, setCargandoTemplates] = useState<boolean>(true)
  const [enviando, setEnviando] = useState(false)
  const [copiadoTexto, setCopiadoTexto] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // 1. Cargar plantillas desde Backend / Supabase
  const loadTemplates = async () => {
    setCargandoTemplates(true)
    setErrorMsg(null)
    try {
      let loaded: MetaTemplateData[] = []

      // Intentar primero desde endpoint oficial de WhatsApp Cloud
      try {
        const res = await fetch(`${BACKEND_URL}/api/whatsapp/cloud/templates`)
        if (res.ok) {
          const json = await res.json()
          if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
            loaded = json.data
          }
        }
      } catch (err) {
        console.warn('Fallo fetch templates vía backend, intentando Supabase directo:', err)
      }

      // Si no trajo desde el backend, consultar tabla whatsapp_templates en Supabase
      if (loaded.length === 0) {
        const { data, error } = await (supabase.from as any)('whatsapp_templates')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          loaded = data as MetaTemplateData[]
        }
      }

      // Si aún no hay plantillas, usar las de respaldo
      if (loaded.length === 0) {
        loaded = FALLBACK_TEMPLATES
      }

      setTemplates(loaded)
      // Seleccionar por defecto la primera aprobada o la primera disponible
      const defaultTpl = loaded.find((t) => t.status === 'APPROVED') || loaded[0]
      setSelectedTemplate(defaultTpl)
    } catch (err: any) {
      console.error('Error cargando plantillas:', err)
      setTemplates(FALLBACK_TEMPLATES)
      setSelectedTemplate(FALLBACK_TEMPLATES[0])
    } finally {
      setCargandoTemplates(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null)
      setSuccessMsg(null)
      setCopiadoTexto(false)
      loadTemplates()
    }
  }, [isOpen])

  // 2. Extraer variables {{1}}, {{2}}... de la plantilla seleccionada
  const extractVariableIndexes = (bodyText: string): number[] => {
    if (!bodyText) return []
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || []
    const nums = matches.map((m) => parseInt(m.replace(/[{}]/g, ''), 10))
    return Array.from(new Set(nums)).sort((a, b) => a - b)
  }

  const varIndexes = selectedTemplate ? extractVariableIndexes(selectedTemplate.body_text) : []

  // 3. Auto-rellenar variables con datos clínicos del paciente
  useEffect(() => {
    if (!selectedTemplate) return

    const mappings = selectedTemplate.variable_mappings || {}

    // Intentar buscar turno próximo si hay pacienteId
    const autoFillParams = async () => {
      let proximoTurnoStr = ''
      let profesionalStr = 'Equipo Médico de la Clínica'
      let presupuestoTotalStr = ''

      if (pacienteId) {
        try {
          const { data: turnoData } = await (supabase.from as any)('turnos')
            .select('fecha_hora, profesional, estado')
            .eq('paciente_id', pacienteId)
            .gte('fecha_hora', new Date().toISOString())
            .order('fecha_hora', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (turnoData) {
            const dt = new Date(turnoData.fecha_hora)
            proximoTurnoStr = `${dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} a las ${dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`
            if (turnoData.profesional) profesionalStr = turnoData.profesional
          }

          const { data: presupData } = await supabase
            .from('presupuestos')
            .select('total, id')
            .eq('paciente_id', pacienteId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (presupData) {
            presupuestoTotalStr = `$ ${Number(presupData.total || 0).toLocaleString('es-AR')}`
            if (!buttonParamValue) setButtonParamValue(presupData.id || 'presupuesto')
          }
        } catch (e) {
          console.warn('Error resolviendo datos del paciente:', e)
        }
      }

      if (!proximoTurnoStr) {
        const manana = new Date()
        manana.setDate(manana.getDate() + 1)
        proximoTurnoStr = `${manana.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} a las 10:30 hs`
      }

      const currentVarIndexes = extractVariableIndexes(selectedTemplate.body_text)
      const filled = currentVarIndexes.map((idx) => {
        const key = mappings[String(idx)] || ''
        if (key === 'paciente_nombre' || idx === 1) {
          return pacienteNombre || 'Estimado/a Paciente'
        }
        if (key === 'turno_fecha' || idx === 2) {
          return proximoTurnoStr
        }
        if (key === 'profesional_nombre' || idx === 3) {
          return profesionalStr
        }
        if (key === 'presupuesto_total') {
          return presupuestoTotalStr || '$ 150.000'
        }
        return `Valor ${idx}`
      })

      setParamValues(filled)
    }

    autoFillParams()
  }, [selectedTemplate, pacienteId, pacienteNombre])

  if (!isOpen) return null

  // 4. Renderizar texto completo para previsualización o pegado libre
  const getRenderedBody = (): string => {
    if (!selectedTemplate) return ''
    let text = selectedTemplate.body_text
    varIndexes.forEach((varNum, arrayIdx) => {
      const val = paramValues[arrayIdx] !== undefined ? paramValues[arrayIdx] : `{{${varNum}}}`
      text = text.replace(new RegExp(`\\{\\{${varNum}\\}\\}`, 'g'), val || '')
    })
    return text
  }

  const getFullRenderedMessage = (): string => {
    if (!selectedTemplate) return ''
    const parts: string[] = []
    if (selectedTemplate.header_content && selectedTemplate.header_type === 'TEXT') {
      parts.push(`*${selectedTemplate.header_content}*`)
    }
    parts.push(getRenderedBody())
    if (selectedTemplate.footer_text) {
      parts.push(`_${selectedTemplate.footer_text}_`)
    }
    return parts.join('\n\n')
  }

  // 5. Acción Opción 1: Pegar al chat como texto libre (GRATIS)
  const handleInsertAsFreeText = () => {
    const fullText = getFullRenderedMessage()
    if (onInsertText) {
      onInsertText(fullText)
    } else {
      navigator.clipboard.writeText(fullText)
      setCopiadoTexto(true)
    }
    onClose()
  }

  // 6. Acción Opción 2: Enviar como plantilla oficial de Meta Cloud API
  const handleSendOfficialTemplate = async () => {
    if (!pacienteTelefono) {
      setErrorMsg('El paciente no tiene un número de teléfono registrado en el CRM.')
      return
    }

    if (!selectedTemplate) return

    if (selectedTemplate.status !== 'APPROVED') {
      setErrorMsg(`La plantilla '${selectedTemplate.name}' no está aprobada por Meta (Estado: ${selectedTemplate.status}). Solo plantillas APPROVED pueden enviarse vía Cloud API.`)
      return
    }

    setEnviando(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // Construir componentes de Meta
      const components: any[] = []

      // Componente BODY si tiene parámetros
      if (varIndexes.length > 0 && paramValues.length > 0) {
        const bodyParams = paramValues.slice(0, varIndexes.length).map((val) => ({
          type: 'text',
          text: (val || '-').trim()
        }))
        components.push({
          type: 'body',
          parameters: bodyParams
        })
      }

      // Componente BUTTON si hay URL dinámica
      const hasDynamicUrlButton = selectedTemplate.buttons?.some(
        (b) => b.type === 'URL' && b.url && b.url.includes('{{1}}')
      )
      if (hasDynamicUrlButton && buttonParamValue) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: buttonParamValue.trim()
            }
          ]
        })
      }

      const payload = {
        to_phone: pacienteTelefono,
        template_name: selectedTemplate.name,
        language_code: selectedTemplate.language || 'es_AR',
        components: components.length > 0 ? components : undefined
      }

      const res = await fetch(`${BACKEND_URL}/api/whatsapp/cloud/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Error devuelto por Meta al despachar la plantilla')
      }

      // Registrar mensaje en la tabla mensajes para visualización en el chat
      if (conversacionId) {
        const renderedFull = getFullRenderedMessage()
        try {
          await supabase.from('mensajes').insert({
            conversacion_id: conversacionId,
            emisor: 'operador',
            contenido: `📄 [PLANTILLA OFICIAL: ${selectedTemplate.name}]\n\n${renderedFull}`,
            metadata_json: {
              tipo: 'template',
              template_name: selectedTemplate.name,
              category: selectedTemplate.category,
              wamid: data.wamid,
              delivery_status: 'enviado',
              provider: 'meta_cloud_api'
            }
          } as any)

          await supabase.from('conversaciones').update({
            ultimo_mensaje: `📄 ${selectedTemplate.name}`,
            updated_at: new Date().toISOString()
          } as any).eq('id', conversacionId)
        } catch (dbErr) {
          console.warn('Advertencia al registrar mensaje en base de datos:', dbErr)
        }
      }

      setSuccessMsg('¡Plantilla oficial enviada con éxito a través de Meta Cloud API!')
      if (onEnviadoExitoso) onEnviadoExitoso()

      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Error enviando plantilla oficial:', err)
      setErrorMsg(err.message || 'Error de conexión con WhatsApp Cloud API')
    } finally {
      setEnviando(false)
    }
  }

  const renderedPreviewBody = getRenderedBody()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0f172a] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#162036]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Plantillas Oficiales de WhatsApp (Meta Cloud API)
              </h2>
              <p className="text-xs text-slate-400">
                Destinatario: <span className="text-slate-200 font-semibold">{pacienteNombre}</span> ({pacienteTelefono})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner Informativo sobre Ventana de 24 Horas y Costo */}
        <div className="px-6 pt-4">
          {isWindowOpen ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-3 text-xs text-emerald-200">
              <Sparkles size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-emerald-300 block mb-0.5">
                  🟢 Ventana de 24 Horas Abierta (Sin costo por texto libre)
                </span>
                El paciente interactuó recientemente. Tienes dos opciones: <strong className="text-white">Pegar como texto libre (Gratis)</strong> para no incurrir en cargos de Meta, o <strong className="text-white">Enviar Plantilla Oficial</strong> con botones interactivos (con tarifa de plantilla de Meta).
              </div>
            </div>
          ) : (
            <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 flex items-start gap-3 text-xs text-rose-200">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-rose-300 block mb-0.5">
                  ⚠️ Ventana de 24 Horas Vencida (Reapertura Requerida)
                </span>
                Meta no permite enviar mensajes de texto común ni respuestas rápidas fuera de la ventana. Debes enviar una <strong className="text-white">Plantilla Oficial de Meta</strong> para reanudar el chat. En cuanto el paciente responda, la ventana de 24h volverá a abrirse gratuitamente.
              </div>
            </div>
          )}
        </div>

        {/* Contenedor de 2 Columnas (Selector y Editor a la izquierda, Vista Previa a la derecha) */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          
          {/* Columna Izquierda: Lista de Plantillas y Campos Dinámicos */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-400" />
                  <span>Plantillas Disponibles en Meta ({templates.length})</span>
                </label>
                <button
                  type="button"
                  onClick={loadTemplates}
                  disabled={cargandoTemplates}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw size={11} className={cargandoTemplates ? 'animate-spin' : ''} />
                  <span>Actualizar</span>
                </button>
              </div>

              {cargandoTemplates ? (
                <div className="flex items-center justify-center p-8 bg-[#14203d]/40 rounded-xl border border-slate-800">
                  <Loader2 size={20} className="animate-spin text-blue-400 mr-2" />
                  <span className="text-xs text-slate-400">Cargando plantillas de Meta...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                  No hay plantillas creadas en la cuenta.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplate?.name === tpl.name
                    const isApproved = tpl.status === 'APPROVED'
                    return (
                      <div
                        key={tpl.name}
                        onClick={() => setSelectedTemplate(tpl)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                            : 'bg-[#14203d]/60 border-slate-800/80 hover:bg-[#18274a] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-xs text-white truncate">
                            {tpl.title || tpl.name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                isApproved
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : tpl.status === 'PENDING'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {tpl.status || 'APPROVED'}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {tpl.category}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {tpl.body_text}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Parámetros Dinámicos del Cuerpo */}
            {selectedTemplate && varIndexes.length > 0 && (
              <div className="p-4 bg-[#14203d]/70 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Variables Dinámicas de la Plantilla ({varIndexes.length})</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Autocompletadas con datos del paciente</span>
                </div>

                <div className="space-y-2.5">
                  {varIndexes.map((varNum, idx) => {
                    const mappings = selectedTemplate.variable_mappings || {}
                    const varKey = mappings[String(varNum)] || `Variable {{${varNum}}}`
                    let labelName = varKey
                    if (varKey === 'paciente_nombre') labelName = 'Nombre del Paciente'
                    else if (varKey === 'turno_fecha') labelName = 'Fecha y Hora del Turno'
                    else if (varKey === 'profesional_nombre') labelName = 'Especialista / Médico'
                    else if (varKey === 'presupuesto_total') labelName = 'Monto del Presupuesto'

                    return (
                      <div key={varNum} className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-300 font-medium">
                            <span className="text-blue-400 font-mono font-bold">{`{{${varNum}}}`}</span> - {labelName}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={paramValues[idx] || ''}
                          onChange={(e) => {
                            const newVals = [...paramValues]
                            newVals[idx] = e.target.value
                            setParamValues(newVals)
                          }}
                          className="w-full bg-[#0b1324] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder={`Valor para {{${varNum}}}...`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Parámetro de Botón URL si aplica */}
            {selectedTemplate?.buttons?.some((b) => b.type === 'URL' && b.url?.includes('{{1}}')) && (
              <div className="p-3.5 bg-blue-950/30 border border-blue-500/30 rounded-xl space-y-2">
                <label className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                  <ExternalLink size={13} />
                  <span>Parámetro de URL para Botón Dinámico:</span>
                </label>
                <input
                  type="text"
                  value={buttonParamValue}
                  onChange={(e) => setButtonParamValue(e.target.value)}
                  className="w-full bg-[#0b1324] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Ej: id_presupuesto o token de acceso"
                />
              </div>
            )}
          </div>

          {/* Columna Derecha: Vista Previa en WhatsApp (Burbuja Real) */}
          <div className="lg:col-span-5 flex flex-col">
            <label className="font-semibold text-slate-200 text-xs mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Vista Previa en WhatsApp del Paciente</span>
            </label>

            <div className="flex-1 bg-[#0b141a] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-inner min-h-[300px]">
              
              {/* Mensaje WhatsApp */}
              <div className="w-full max-w-[95%] bg-[#1f2c34] text-slate-100 rounded-2xl rounded-tl-xs p-3.5 shadow-md border-l-4 border-emerald-500 space-y-2">
                {/* Cabecera */}
                {selectedTemplate?.header_content && (
                  <div className="font-bold text-xs text-emerald-400 pb-1 border-b border-slate-700/60">
                    {selectedTemplate.header_content}
                  </div>
                )}

                {/* Cuerpo con texto reemplazado */}
                <div className="text-xs whitespace-pre-wrap leading-relaxed">
                  {renderedPreviewBody || 'Selecciona una plantilla para previsualizar...'}
                </div>

                {/* Pie de página */}
                {selectedTemplate?.footer_text && (
                  <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-700/40">
                    {selectedTemplate.footer_text}
                  </div>
                )}

                {/* Hora de envío */}
                <div className="text-[9px] text-slate-400 text-right">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                {/* Botones Interactivos de WhatsApp */}
                {selectedTemplate?.buttons && selectedTemplate.buttons.length > 0 && (
                  <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                    {selectedTemplate.buttons.map((btn, bIdx) => (
                      <div
                        key={bIdx}
                        className="w-full py-1.5 px-3 bg-[#2a3942] hover:bg-[#32444f] rounded-lg text-center text-xs font-semibold text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-1.5 cursor-default transition-colors"
                      >
                        {btn.type === 'URL' && <ExternalLink size={12} />}
                        {btn.type === 'PHONE_NUMBER' && <Calendar size={12} />}
                        <span>{btn.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Badges de Información y Tarifas */}
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Idioma Meta:</span>
                  <span className="font-mono text-slate-300 font-bold">{selectedTemplate?.language || 'es_AR'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Categoría de Facturación:</span>
                  <span className="font-mono text-blue-400 font-bold">{selectedTemplate?.category || 'UTILITY'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Estado de Aprobación:</span>
                  <span className={`font-bold ${selectedTemplate?.status === 'APPROVED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedTemplate?.status || 'APPROVED'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mensajes de Alerta / Éxito */}
        {(errorMsg || successMsg) && (
          <div className="px-6 pb-2">
            {errorMsg && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Pie de Acciones Inteligentes según la Ventana de 24 Horas */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-[#162036]">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 text-xs text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            {/* Opción A: Pegar como Texto Libre (Solo si la ventana está abierta) */}
            {isWindowOpen && (
              <button
                type="button"
                onClick={handleInsertAsFreeText}
                disabled={enviando || !selectedTemplate}
                className="px-4 py-2.5 text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/50 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                title="Inserta este texto en el chat para enviarlo sin costo de plantilla de Meta"
              >
                {copiadoTexto ? <Check size={14} className="text-emerald-400" /> : <ClipboardCopy size={14} className="text-emerald-400" />}
                <span>Pegar al Chat como Texto Libre (Gratis / $0)</span>
              </button>
            )}

            {/* Opción B: Enviar como Plantilla Oficial de Meta */}
            <button
              type="button"
              onClick={handleSendOfficialTemplate}
              disabled={enviando || !selectedTemplate || selectedTemplate.status !== 'APPROVED'}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                selectedTemplate?.status === 'APPROVED'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
              title={
                selectedTemplate?.status !== 'APPROVED'
                  ? 'Esta plantilla debe estar APROBADA por Meta para despacharse vía API'
                  : isWindowOpen
                  ? 'Enviar como plantilla oficial con botones interactivos (Aplica tarifa de plantilla de Meta)'
                  : 'Enviar plantilla oficial para reabrir la conversación de 24 horas'
              }
            >
              {enviando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Despachando a Meta...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>
                    {isWindowOpen
                      ? 'Enviar Plantilla Oficial (Costo Meta)'
                      : 'Enviar Plantilla Oficial (Reabrir)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
