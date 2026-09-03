'use client'

import React, { useState, useEffect } from 'react'
import { X, Video, Send, ExternalLink, Sparkles } from 'lucide-react'
import { PacienteData } from '../types'
import { VIDEOS, VIDEOS_ESP } from '../catalogos'

interface ModalVideosWhatsAppProps {
  isOpen: boolean
  onClose: () => void
  paciente: PacienteData
  especialesInicial?: boolean
}

export default function ModalVideosWhatsApp({
  isOpen,
  onClose,
  paciente,
  especialesInicial = false
}: ModalVideosWhatsAppProps) {
  const [esEspeciales, setEsEspeciales] = useState(especialesInicial)
  const [videoSeleccionado, setVideoSeleccionado] = useState<string>('')
  const [mensajePersonalizado, setMensajePersonalizado] = useState('')

  const listaActual = esEspeciales ? VIDEOS_ESP : VIDEOS
  const currentVid = listaActual.find(v => v.k === videoSeleccionado) || listaActual[0]

  useEffect(() => {
    setEsEspeciales(especialesInicial)
  }, [especialesInicial])

  useEffect(() => {
    if (listaActual.length > 0 && !listaActual.find(v => v.k === videoSeleccionado)) {
      setVideoSeleccionado(listaActual[0].k)
    }
  }, [esEspeciales, listaActual, videoSeleccionado])

  useEffect(() => {
    if (currentVid) {
      const txt = `Hola *${paciente.nombre || ''}*, te compartimos este breve video explicativo sobre *${currentVid.t}* para que conozcas en detalle el procedimiento.\n\nCualquier consulta estamos a tu disposición.`
      setMensajePersonalizado(txt)
    }
  }, [currentVid, paciente.nombre])

  if (!isOpen) return null

  const handleSendWA = () => {
    const rawTel = (paciente.telefono || '').replace(/\D/g, '')
    let fullTel = rawTel
    if (fullTel.startsWith('0')) fullTel = fullTel.slice(1)
    if (fullTel.startsWith('15')) fullTel = fullTel.slice(2)
    if (!fullTel.startsWith('54') && fullTel.length >= 10) fullTel = '549' + fullTel

    const url = `https://wa.me/${fullTel}?text=${encodeURIComponent(mensajePersonalizado)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#dde6ec] w-full max-w-xl flex flex-col text-[#16323f] overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#eef3f6] bg-[#f7fafb]">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#0e7c86]" />
            <h3 className="font-extrabold text-sm text-[#16323f]">
              Enviar Video Explicativo al Paciente
            </h3>
          </div>
          <button onClick={onClose} className="text-[#9db0bc] hover:text-[#16323f]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas: Estándar vs Casos Especiales */}
        <div className="flex border-b border-[#dde6ec] bg-[#f7fafb] text-xs font-bold">
          <button
            type="button"
            onClick={() => setEsEspeciales(false)}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              !esEspeciales
                ? 'border-[#0e7c86] text-[#0e7c86] bg-white'
                : 'border-transparent text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            Videos de Cirugías y Procedimientos
          </button>
          <button
            type="button"
            onClick={() => setEsEspeciales(true)}
            className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1 ${
              esEspeciales
                ? 'border-[#0e7c86] text-[#0e7c86] bg-white'
                : 'border-transparent text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Casos Especiales y Complejos
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-1">
              Seleccionar Video Educativo
            </label>
            <select
              value={videoSeleccionado}
              onChange={e => setVideoSeleccionado(e.target.value)}
              className="w-full border border-[#dde6ec] rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white focus:border-[#0e7c86] outline-none"
            >
              {listaActual.map(v => (
                <option key={v.k} value={v.k}>
                  {v.t}
                </option>
              ))}
            </select>
          </div>

          {currentVid && (
            <div className="p-2.5 bg-[#f7fafb] rounded-lg border border-[#dde6ec] flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-[#16323f]">{currentVid.t}</div>
                <div className="text-[11px] text-[#728a99]">Material audiovisual institucional</div>
              </div>
            </div>
          )}


          <div>
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-1">
              Mensaje que se enviará por WhatsApp
            </label>
            <textarea
              rows={5}
              value={mensajePersonalizado}
              onChange={e => setMensajePersonalizado(e.target.value)}
              className="w-full border border-[#dde6ec] rounded-lg p-2.5 text-xs focus:border-[#0e7c86] outline-none"
            />
          </div>
        </div>

        {/* Pie */}
        <div className="px-4 py-3 border-t border-[#eef3f6] bg-[#f7fafb] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[#728a99] hover:text-[#16323f]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSendWA}
            className="px-4 py-1.5 bg-[#1a7f4b] hover:bg-[#136139] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

