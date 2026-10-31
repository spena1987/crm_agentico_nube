'use client'

import React, { useState, useEffect } from 'react'
import { X, MessageSquare, Copy, Check, Send, Sparkles, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { ConsultaOftalmo, PacienteData, HistoriaClinicaOftalmo } from '../types'
import { TXT_CONDUCTA, TXT_EXPLICO } from '../catalogos'
import { BACKEND_URL, getAuthHeaders } from '@/lib/api'

interface ModalResumenWhatsAppProps {
  isOpen: boolean
  onClose: () => void
  paciente: PacienteData
  historia: HistoriaClinicaOftalmo
  consulta: ConsultaOftalmo
}

export default function ModalResumenWhatsApp({
  isOpen,
  onClose,
  paciente,
  historia,
  consulta
}: ModalResumenWhatsAppProps) {
  const [mensaje, setMensaje] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviadoExito, setEnviadoExito] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [requiereWaMe, setRequiereWaMe] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setEnviadoExito(false)
    setErrorEnvio(null)
    setRequiereWaMe(false)

    const lineas: string[] = []
    lineas.push(`Hola *${paciente.nombre || ''}*, te compartimos el resumen de tu consulta oftalmológica de hoy:`)
    lineas.push('')

    // Diagnóstico y conducta
    const dx = consulta.conducta?.dx_presuntivo || historia.antecedentes_oculares?.join(', ') || 'Control de salud visual'
    lineas.push(`*Diagnóstico:* ${dx}`)

    const plan1 = consulta.conducta?.plan_cx
    const plan2 = consulta.conducta?.plan_cx2
    if (plan1 || plan2) {
      if (plan2) {
        lineas.push(`*Conducta médica:* OD: ${plan1 || ''} · OI: ${plan2 || ''}`)
      } else {
        lineas.push(`*Conducta médica:* ${plan1}`)
      }
    }

    // Explicación para el paciente
    const expls: string[] = []
    if (consulta.conducta?.explico && consulta.conducta.explico.length > 0) {
      consulta.conducta.explico.forEach(item => {
        if (TXT_EXPLICO[item]) {
          expls.push(TXT_EXPLICO[item])
        }
      })
    }
    if (plan1 && TXT_CONDUCTA[plan1]) {
      expls.push(TXT_CONDUCTA[plan1])
    }
    if (plan2 && TXT_CONDUCTA[plan2] && plan2 !== plan1) {
      expls.push(TXT_CONDUCTA[plan2])
    }

    if (expls.length > 0) {
      lineas.push('')
      lineas.push('*Información sobre tu tratamiento:*')
      expls.forEach(e => lineas.push(`• ${e}`))
    }

    // Indicaciones y recetas
    if (consulta.indicaciones_texto) {
      lineas.push('')
      lineas.push(`*Indicaciones:* ${consulta.indicaciones_texto}`)
    }

    // Próximo control
    if (consulta.proximo_control) {
      lineas.push('')
      lineas.push(`*Próximo control sugerido:* ${consulta.proximo_control}`)
    }

    lineas.push('')
    lineas.push('Ante cualquier duda o molestia, estamos a tu disposición. ¡Que tengas un excelente día!')

    setMensaje(lineas.join('\n'))
  }, [isOpen, paciente, historia, consulta])

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(mensaje)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // Envío Directo Oficial Meta Cloud API
  const handleDespachoOficialWA = async () => {
    if (!paciente.id || !consulta.id) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/oftalmo/consultas/${consulta.id}/despachar-whatsapp`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          paciente_id: paciente.id,
          texto: mensaje
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setEnviadoExito(true)
      } else {
        setErrorEnvio(data.detail || data.error || 'No se pudo despachar el mensaje por WhatsApp Cloud API.')
        if (data.requiere_wa_me) {
          setRequiereWaMe(true)
        }
      }
    } catch (err: any) {
      setErrorEnvio(err?.message || 'Error de conexión con el servicio de mensajería.')
    } finally {
      setEnviando(false)
    }
  }

  // Fallback con wa.me
  const handleFallbackWaMe = () => {
    const rawTel = (paciente.telefono || '').replace(/\D/g, '')
    let fullTel = rawTel
    if (fullTel.startsWith('0')) fullTel = fullTel.slice(1)
    if (fullTel.startsWith('15')) fullTel = fullTel.slice(2)
    if (!fullTel.startsWith('54') && fullTel.length >= 10) fullTel = '549' + fullTel

    const url = `https://wa.me/${fullTel}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col text-[#16323f] overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">
                Resumen Clínico para WhatsApp
              </h3>
              <p className="text-[11px] text-emerald-100">
                Meta Cloud API Oficial · Integración Transaccional CRM
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificaciones de Estado */}
        {enviadoExito && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>¡Resumen enviado con éxito al WhatsApp del paciente e indexado en el CRM!</span>
          </div>
        )}

        {errorEnvio && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-start gap-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div>{errorEnvio}</div>
              {requiereWaMe && (
                <div className="text-[11px] text-amber-700 mt-1">
                  La ventana de 24 hs de Meta puede estar cerrada. Puede abrir directamente WhatsApp Web con el botón auxiliar.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Editor de mensaje */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#728a99]">
              Destinatario: <strong className="text-[#16323f]">{paciente.nombre}</strong> ({paciente.telefono || 'Sin celular'})
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-bold text-[#0e7c86] hover:underline flex items-center gap-1"
            >
              {copiado ? <Check className="w-3.5 h-3.5 text-[#1a7f4b]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiado ? '¡Copiado!' : 'Copiar texto'}
            </button>
          </div>

          <textarea
            rows={11}
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            className="w-full border border-slate-200 rounded-xl p-3.5 text-xs font-sans leading-relaxed focus:border-[#0e7c86] focus:ring-2 focus:ring-[#0e7c86]/20 outline-none resize-none bg-slate-50/50"
          />
        </div>

        {/* Pie de acciones */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Cerrar
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFallbackWaMe}
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              title="Abrir en WhatsApp Web clásico"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Abrir Web</span>
            </button>
            <button
              type="button"
              disabled={enviando || !paciente.telefono}
              onClick={handleDespachoOficialWA}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Send className={`w-3.5 h-3.5 ${enviando ? 'animate-spin' : ''}`} />
              <span>{enviando ? 'Despachando...' : 'Enviar por WhatsApp Oficial'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
