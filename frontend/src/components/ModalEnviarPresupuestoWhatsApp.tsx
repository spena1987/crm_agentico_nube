'use client'

import React, { useState, useEffect } from 'react'
import {
  Send,
  X,
  FileText,
  Phone,
  User,
  RotateCcw,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  DollarSign
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ModalEnviarPresupuestoWhatsAppProps {
  isOpen: boolean
  onClose: () => void
  presupuestoId: string
  pacienteNombre?: string
  telefonoDefault?: string
  pdfUrl?: string | null
  totalArs?: number
  totalUsd?: number
  onSuccess?: () => void
}

export default function ModalEnviarPresupuestoWhatsApp({
  isOpen,
  onClose,
  presupuestoId,
  pacienteNombre = '',
  telefonoDefault = '',
  pdfUrl = null,
  totalArs = 0,
  totalUsd = 0,
  onSuccess
}: ModalEnviarPresupuestoWhatsAppProps) {
  const [telefono, setTelefono] = useState(telefonoDefault)
  const [mensaje, setMensaje] = useState('')
  const [plantillaOriginal, setPlantillaOriginal] = useState('')
  const [loadingTemplate, setLoadingTemplate] = useState(true)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && presupuestoId) {
      cargarMensajeSugerido()
    }
  }, [isOpen, presupuestoId])

  useEffect(() => {
    if (telefonoDefault) {
      setTelefono(telefonoDefault)
    }
  }, [telefonoDefault])

  const cargarMensajeSugerido = async () => {
    try {
      setLoadingTemplate(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/presupuestos/${presupuestoId}/mensaje-sugerido`)
      if (res.ok) {
        const data = await res.json()
        const texto = data.mensaje_sugerido || ''
        setMensaje(texto)
        setPlantillaOriginal(texto)
        if (data.telefono && !telefono) {
          setTelefono(data.telefono)
        }
      } else {
        // Fallback mensaje ameno
        const fallback = `¡Hola ${pacienteNombre || 'Estimado/a'}! 👋 Esperamos que estés muy bien.\n\nTe compartimos adjunto tu Presupuesto Médico Oficial.\n\nQuedamos a tu disposición para coordinar tu turno o responder cualquier consulta. 🩺✨`
        setMensaje(fallback)
        setPlantillaOriginal(fallback)
      }
    } catch (err) {
      console.error('Error cargando mensaje sugerido:', err)
      setError('No se pudo cargar la plantilla automática. Puedes redactar el mensaje manualmente.')
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleCopiarTexto = () => {
    navigator.clipboard.writeText(mensaje)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRestablecer = () => {
    setMensaje(plantillaOriginal)
  }

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telefono.trim()) {
      setError('Debes ingresar un número de teléfono válido para WhatsApp.')
      return
    }

    try {
      setSending(true)
      setError(null)
      setSuccessMsg(null)

      const res = await fetch(`${BACKEND_URL}/api/presupuestos/${presupuestoId}/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: telefono.trim(),
          mensaje: mensaje.trim()
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg('¡Presupuesto y mensaje enviados exitosamente por WhatsApp!')
        setTimeout(() => {
          if (onSuccess) onSuccess()
          onClose()
        }, 1200)
      } else {
        setError(data.detail || data.error || 'Error al enviar por WhatsApp.')
      }
    } catch (err: any) {
      console.error('Error enviando por WhatsApp:', err)
      setError('Error de conexión con el servidor de WhatsApp.')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-xl">
              <Send size={18} />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Enviar Presupuesto por WhatsApp
              </h3>
              <p className="text-[11px] text-slate-400">
                Entrega el documento PDF membretado junto con el mensaje protocolar ameno al paciente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alertas */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleEnviar} className="space-y-4 text-xs">
          {/* Ficha del Destinatario & Adjunto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-xl">
            <div>
              <label className="font-bold text-slate-500 block mb-1 flex items-center gap-1">
                <User size={12} /> Paciente Destinatario
              </label>
              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {pacienteNombre || 'Paciente sin nombre'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {totalArs > 0 && <span className="mr-2 text-emerald-600 font-bold">ARS: ${totalArs.toLocaleString('es-AR')}</span>}
                {totalUsd > 0 && <span className="text-amber-600 font-bold">USD: ${totalUsd.toLocaleString('es-AR')}</span>}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-500 block mb-1 flex items-center gap-1">
                <Phone size={12} /> Teléfono WhatsApp
              </label>
              <input
                type="text"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="ej: 5492615551234"
                className="w-full p-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Adjunto PDF */}
          <div className="flex items-center justify-between p-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <FileText size={16} />
              <span className="font-bold">presupuesto_{presupuestoId.slice(0, 8)}.pdf</span>
              <span className="text-[10px] text-slate-400">(Documento Oficial)</span>
            </div>
            {pdfUrl && (
              <a
                href={`${BACKEND_URL}${pdfUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                Ver PDF <ExternalLink size={11} />
              </a>
            )}
          </div>

          {/* Editor de Texto del Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-500">
                Mensaje Cordial de Acompañamiento
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRestablecer}
                  className="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1 transition"
                  title="Restablecer plantilla inicial"
                >
                  <RotateCcw size={10} /> Restablecer
                </button>
                <button
                  type="button"
                  onClick={handleCopiarTexto}
                  className="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1 transition"
                  title="Copiar texto"
                >
                  {copied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {loadingTemplate ? (
              <div className="h-44 flex items-center justify-center border border-[var(--border)] rounded-xl text-slate-400">
                <Loader2 size={16} className="animate-spin mr-2" /> Cargando plantilla amena...
              </div>
            ) : (
              <textarea
                rows={8}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe el mensaje protocolar para el paciente..."
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-normal leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-sans"
              />
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              💡 Puedes personalizar el texto antes del envío. El documento PDF se adjuntará automáticamente a este mensaje.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending || loadingTemplate}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? 'Enviando por WhatsApp...' : 'Enviar por WhatsApp Ahora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
