'use client'

import React, { useState, useEffect } from 'react'
import { X, MessageSquare, Copy, Check, Send } from 'lucide-react'
import { ConsultaOftalmo, PacienteData, HistoriaClinicaOftalmo } from '../types'
import { TXT_CONDUCTA, TXT_EXPLICO } from '../catalogos'

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

  useEffect(() => {
    if (!isOpen) return

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

  const handleSendWA = () => {
    const rawTel = (paciente.telefono || '').replace(/\D/g, '')
    let fullTel = rawTel
    if (fullTel.startsWith('0')) fullTel = fullTel.slice(1)
    if (fullTel.startsWith('15')) fullTel = fullTel.slice(2)
    if (!fullTel.startsWith('54') && fullTel.length >= 10) fullTel = '549' + fullTel

    const url = `https://wa.me/${fullTel}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#dde6ec] w-full max-w-xl flex flex-col text-[#16323f] overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#eef3f6] bg-[#f7fafb]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#1a7f4b]" />
            <h3 className="font-extrabold text-sm text-[#16323f]">
              Resumen de la Consulta para WhatsApp
            </h3>
          </div>
          <button onClick={onClose} className="text-[#9db0bc] hover:text-[#16323f]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editor de mensaje */}
        <div className="p-4 space-y-3">
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
            rows={12}
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            className="w-full border border-[#dde6ec] rounded-lg p-3 text-xs font-sans leading-relaxed focus:border-[#0e7c86] outline-none"
          />
        </div>

        {/* Pie de acciones */}
        <div className="px-4 py-3 border-t border-[#eef3f6] bg-[#f7fafb] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[#728a99] hover:text-[#16323f]"
          >
            Cerrar
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-white border border-[#dde6ec] hover:bg-gray-50 text-xs font-bold rounded-lg flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar
            </button>
            <button
              type="button"
              onClick={handleSendWA}
              className="px-4 py-1.5 bg-[#1a7f4b] hover:bg-[#136139] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

