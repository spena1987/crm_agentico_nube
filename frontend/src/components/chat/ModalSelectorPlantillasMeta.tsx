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
  Clock
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export interface MetaTemplateOption {
  name: string
  title: string
  category: 'UTILITY' | 'MARKETING'
  language: string
  description: string
  previewText: string
  paramLabels: string[]
}

const TEMPLATES_CATALOGO: MetaTemplateOption[] = [
  {
    name: 'hello_world',
    title: '👋 Saludo Inicial / Reactivación Oficial (Default Meta)',
    category: 'UTILITY',
    language: 'en_US',
    description: 'Plantilla de prueba oficial aprobada automáticamente por Meta en todas las cuentas.',
    previewText: 'Hello World! Welcome and congratulations on your first message.',
    paramLabels: []
  },
  {
    name: 'confirmacion_turno_clinico',
    title: '📅 Recordatorio & Confirmación de Turno Médico',
    category: 'UTILITY',
    language: 'es_AR',
    description: 'Notifica al paciente sobre su próximo turno e invita a reanudar el contacto.',
    previewText: 'Hola {{1}}, te recordamos tu turno médico programado para el {{2}} con el profesional {{3}}. Por favor confirma tu asistencia.',
    paramLabels: ['Nombre del Paciente', 'Fecha y Hora del Turno', 'Especialista / Médico']
  },
  {
    name: 'seguimiento_quirurgico',
    title: '🏥 Seguimiento de Presupuesto & Cirugía',
    category: 'UTILITY',
    language: 'es_AR',
    description: 'Contacta al paciente para continuar la gestión quirúrgica o preoperatoria.',
    previewText: 'Hola {{1}}, nos comunicamos del área quirúrgica para coordinar los avances de tu procedimiento de {{2}}. ¿Podrías responder este mensaje para asesorarte?',
    paramLabels: ['Nombre del Paciente', 'Procedimiento Quirúrgico']
  }
]

interface ModalSelectorPlantillasMetaProps {
  isOpen: boolean
  onClose: () => void
  pacienteNombre: string
  pacienteTelefono: string
  conversacionId?: string | null
  onEnviadoExitoso?: () => void
}

export default function ModalSelectorPlantillasMeta({
  isOpen,
  onClose,
  pacienteNombre,
  pacienteTelefono,
  conversacionId,
  onEnviadoExitoso
}: ModalSelectorPlantillasMetaProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplateOption>(TEMPLATES_CATALOGO[0])
  const [paramValues, setParamValues] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null)
      setSuccessMsg(null)
      // Inicializar parámetros por defecto
      if (selectedTemplate.paramLabels.length > 0) {
        setParamValues([
          pacienteNombre || 'Estimado/a Paciente',
          new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          'Equipo Médico de la Clínica'
        ])
      } else {
        setParamValues([])
      }
    }
  }, [isOpen, selectedTemplate, pacienteNombre])

  if (!isOpen) return null

  const handleSendTemplate = async () => {
    if (!pacienteTelefono) {
      setErrorMsg('El paciente no tiene un número de teléfono registrado.')
      return
    }

    setEnviando(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // Formatear componentes si la plantilla tiene parámetros
      const components: any[] = []
      if (selectedTemplate.paramLabels.length > 0 && paramValues.length > 0) {
        const bodyParams = paramValues.slice(0, selectedTemplate.paramLabels.length).map((val) => ({
          type: 'text',
          text: val.trim() || '-'
        }))
        components.push({
          type: 'body',
          parameters: bodyParams
        })
      }

      const payload = {
        to_phone: pacienteTelefono,
        template_name: selectedTemplate.name,
        language_code: selectedTemplate.language,
        components: components.length > 0 ? components : undefined
      }

      const res = await fetch(`${BACKEND_URL}/api/whatsapp/cloud/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Fallo al despachar plantilla de Meta')
      }

      // Guardar también en public.mensajes para que aparezca en el chat
      if (conversacionId) {
        let renderedText = selectedTemplate.previewText
        paramValues.forEach((val, idx) => {
          renderedText = renderedText.replace(`{{${idx + 1}}}`, val || '')
        })

        try {
          await supabase.from('mensajes').insert({
            conversacion_id: conversacionId,
            emisor: 'operador',
            contenido: `📄 [PLANTILLA OFICIAL: ${selectedTemplate.title}]\n\n${renderedText}`,
            metadata_json: {
              tipo: 'template',
              template_name: selectedTemplate.name,
              wamid: data.wamid,
              delivery_status: 'enviado',
              provider: 'meta_cloud_api'
            }
          } as any)
          await supabase.from('conversaciones').update({
            ultimo_mensaje: `📄 ${selectedTemplate.title}`
          } as any).eq('id', conversacionId)
        } catch (dbErr) {
          console.warn('Error guardando plantilla en chat:', dbErr)
        }
      }

      setSuccessMsg('¡Plantilla homologada enviada exitosamente! La ventana de 24h se reactivará en cuanto el paciente responda.')
      if (onEnviadoExitoso) onEnviadoExitoso()

      setTimeout(() => {
        onClose()
      }, 1800)
    } catch (err: any) {
      console.error('Error enviando plantilla:', err)
      setErrorMsg(err.message || 'Error de conexión con WhatsApp Cloud API')
    } finally {
      setEnviando(false)
    }
  }

  // Previsualización interactiva sustituyendo parámetros
  let livePreview = selectedTemplate.previewText
  paramValues.forEach((val, idx) => {
    livePreview = livePreview.replace(`{{${idx + 1}}}`, val || `{{${idx + 1}}}`)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#162036]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Reabrir Conversación con Plantilla Oficial de Meta
              </h2>
              <p className="text-xs text-slate-400">
                Para: <span className="text-slate-200 font-semibold">{pacienteNombre}</span> ({pacienteTelefono})
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

        {/* Cuerpo */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-3.5 flex items-start gap-3 text-slate-300">
            <Sparkles size={18} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-300 block mb-0.5">Ventana de Atención de 24 Horas de Meta</span>
              Las plantillas homologadas permiten contactar al paciente fuera de la ventana de 24 horas. En cuanto el paciente responda a este mensaje, podrás volver a intercambiar mensajes de texto libre y multimedia normalmente.
            </div>
          </div>

          {/* Selección de Plantilla */}
          <div>
            <label className="font-semibold text-slate-200 block mb-2">Selecciona la Plantilla:</label>
            <div className="grid grid-cols-1 gap-2.5">
              {TEMPLATES_CATALOGO.map((tpl) => (
                <div
                  key={tpl.name}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedTemplate.name === tpl.name
                      ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{tpl.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase font-mono">
                      {tpl.category} • {tpl.language}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{tpl.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Parámetros Dinámicos */}
          {selectedTemplate.paramLabels.length > 0 && (
            <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <label className="font-semibold text-slate-200 block">Campos Dinámicos de la Plantilla:</label>
              {selectedTemplate.paramLabels.map((lbl, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">{`{{${idx + 1}}}`} - {lbl}</span>
                  <input
                    type="text"
                    value={paramValues[idx] || ''}
                    onChange={(e) => {
                      const newVals = [...paramValues]
                      newVals[idx] = e.target.value
                      setParamValues(newVals)
                    }}
                    className="w-full bg-[#131d33] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={`Ingresa ${lbl.toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Vista Previa de WhatsApp */}
          <div>
            <label className="font-semibold text-slate-200 block mb-2">Vista previa en WhatsApp del Paciente:</label>
            <div className="bg-[#0b141a] border border-emerald-900/40 rounded-xl p-4 shadow-inner">
              <div className="bg-[#1f2c34] text-slate-100 p-3 rounded-tr-xl rounded-b-xl max-w-[85%] text-xs shadow-md space-y-2 border-l-4 border-emerald-500">
                <p className="whitespace-pre-wrap leading-relaxed">{livePreview}</p>
                <div className="text-[9px] text-slate-400 text-right">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-[#162036]">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 text-xs text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSendTemplate}
            disabled={enviando}
            className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            {enviando ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Despachando a Meta...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Enviar Plantilla Oficial</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
