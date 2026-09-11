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
  DollarSign,
  ShieldCheck,
  Sparkles,
  Link2,
  Clock
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
  onSuccess?: (resData?: any) => void
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
  const [loadingData, setLoadingData] = useState(true)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Estado de la ventana de 24 horas y plantilla de Meta
  const [isWindowOpen, setIsWindowOpen] = useState<boolean>(false)
  const [hoursLeft, setHoursLeft] = useState<number>(0)
  const [minutesLeft, setMinutesLeft] = useState<number>(0)
  const [pdfFullUrl, setPdfFullUrl] = useState<string>('')
  
  // Parámetros de la plantilla oficial 'presupuesto_entrega_pdf'
  const [var1Nombre, setVar1Nombre] = useState<string>('')
  const [var2Practica, setVar2Practica] = useState<string>('')
  const [var3MontoLink, setVar3MontoLink] = useState<string>('')
  const [modoEnvio, setModoEnvio] = useState<'template' | 'free_text'>('template')

  useEffect(() => {
    if (isOpen && presupuestoId) {
      cargarDatosPresupuesto()
    }
  }, [isOpen, presupuestoId])

  useEffect(() => {
    if (telefonoDefault) {
      setTelefono(telefonoDefault)
    }
  }, [telefonoDefault])

  const cargarDatosPresupuesto = async () => {
    try {
      setLoadingData(true)
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

        const windowOpen = Boolean(data.is_window_open)
        setIsWindowOpen(windowOpen)
        setModoEnvio(windowOpen ? 'free_text' : 'template')

        const wStatus = data.window_status || {}
        setHoursLeft(wStatus.hours_left || 0)
        setMinutesLeft(wStatus.minutes_left || 0)

        const linkAbs = data.pdf_full_url || `${BACKEND_URL}/static/presupuesto_${presupuestoId}.pdf`
        setPdfFullUrl(linkAbs)

        // Configuración de la plantilla oficial
        const tInfo = data.template_info || {}
        setVar1Nombre(tInfo.variable_1 || pacienteNombre || 'Estimado/a Paciente')
        setVar2Practica(tInfo.variable_2 || tInfo.practica_nombre || 'Tratamiento Médico')
        setVar3MontoLink(tInfo.variable_3 || `${tInfo.monto_formateado || '$0'}\n🔗 Ver online: ${linkAbs}`)
      } else {
        // Fallback básico
        const fallback = `¡Hola ${pacienteNombre || 'Estimado/a'}! 👋 Esperamos que estés muy bien.\n\nTe compartimos adjunto tu Presupuesto Médico Oficial.\n\nQuedamos a tu disposición para coordinar tu turno o responder cualquier consulta. 🩺✨`
        setMensaje(fallback)
        setPlantillaOriginal(fallback)
        setIsWindowOpen(false)
        setModoEnvio('template')
        setVar1Nombre(pacienteNombre || 'Estimado/a Paciente')
        setVar2Practica('Tratamiento Quirúrgico')
        const fallbackLink = `${BACKEND_URL}/static/presupuesto_${presupuestoId}.pdf`
        setPdfFullUrl(fallbackLink)
        setVar3MontoLink(`$ ${(totalArs || 0).toLocaleString('es-AR')} ARS\n🔗 Ver online: ${fallbackLink}`)
      }
    } catch (err) {
      console.error('Error cargando mensaje sugerido:', err)
      setError('No se pudo cargar la información de la ventana de WhatsApp. Puedes verificar los campos manualmente.')
      setIsWindowOpen(false)
      setModoEnvio('template')
    } finally {
      setLoadingData(false)
    }
  }

  const handleCopiarTexto = () => {
    navigator.clipboard.writeText(mensaje)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopiarEnlacePdf = () => {
    if (!pdfFullUrl) return
    navigator.clipboard.writeText(pdfFullUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
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

      const payload: any = {
        telefono: telefono.trim(),
        mensaje: mensaje.trim(),
        modo: isWindowOpen ? modoEnvio : 'template'
      }

      if (payload.modo === 'template') {
        payload.template_params = {
          '1': var1Nombre.trim() || pacienteNombre || 'Estimado/a',
          '2': var2Practica.trim() || 'Tratamiento Médico',
          '3': var3MontoLink.trim()
        }
      }

      const res = await fetch(`${BACKEND_URL}/api/presupuestos/${presupuestoId}/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const modoDesc = payload.modo === 'template' 
          ? 'Plantilla Oficial de Meta (Utility) despachada exitosamente con botón de entrega de PDF.' 
          : 'Presupuesto y PDF enviados exitosamente por WhatsApp.'
        setSuccessMsg(`¡${modoDesc}`)
        setTimeout(() => {
          if (onSuccess) onSuccess(data)
          onClose()
        }, 1500)
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-blue-500/30 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
              <Send size={18} />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Enviar Presupuesto por WhatsApp
              </h3>
              <p className="text-[11px] text-slate-400">
                Entrega del documento PDF membretado y notificación oficial al paciente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alertas de Estado */}
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Banner Informativo sobre Ventana de 24 Horas */}
        {loadingData ? (
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-blue-400" />
            <span>Consultando estado de la ventana de WhatsApp con el paciente...</span>
          </div>
        ) : isWindowOpen ? (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5">
            <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-emerald-300 block mb-0.5">
                🟢 Ventana de 24 Horas Abierta ({hoursLeft}h {minutesLeft}m restantes)
              </span>
              El paciente interactuó recientemente. Puedes enviar el presupuesto como texto libre con PDF adjunto sin costo de plantilla de Meta.
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setModoEnvio(modoEnvio === 'free_text' ? 'template' : 'free_text')}
                className="text-[10px] underline text-emerald-400 hover:text-emerald-300"
              >
                {modoEnvio === 'free_text' ? 'Usar Plantilla Oficial' : 'Usar Texto Libre'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-blue-200 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-blue-300 block mb-0.5">
                ⚠️ Ventana de 24 Horas Cerrada (Meta Cloud API)
              </span>
              Meta no permite enviar mensajes de texto libre ni archivos fuera de la ventana. Se utilizará la <strong className="text-white">Plantilla Oficial Homologada (Utility)</strong> que incluye el enlace web directo y el botón para recibir el PDF en el chat.
            </div>
          </div>
        )}

        <form onSubmit={handleEnviar} className="space-y-4 text-xs">
          {/* Ficha del Destinatario & Teléfono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#14203d]/60 border border-slate-800 rounded-xl">
            <div>
              <label className="font-bold text-slate-400 block mb-1 flex items-center gap-1">
                <User size={12} className="text-blue-400" /> Paciente Destinatario
              </label>
              <div className="font-semibold text-white truncate">
                {pacienteNombre || 'Paciente sin nombre'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {totalArs > 0 && <span className="mr-2 text-emerald-400 font-bold">ARS: ${totalArs.toLocaleString('es-AR')}</span>}
                {totalUsd > 0 && <span className="text-amber-400 font-bold">USD: ${totalUsd.toLocaleString('es-AR')}</span>}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-400 block mb-1 flex items-center gap-1">
                <Phone size={12} className="text-blue-400" /> Teléfono WhatsApp
              </label>
              <input
                type="text"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="ej: 5492615551234"
                className="w-full p-2 rounded-lg border border-slate-700 bg-[#0b1324] font-mono text-xs font-bold text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Caja del Repositorio de Documentos PDF */}
          <div className="flex items-center justify-between p-3 bg-[#14203d]/40 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <FileText size={16} className="text-blue-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-slate-200 truncate text-xs">
                  presupuesto_{presupuestoId.slice(0, 8)}.pdf
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Repositorio Digital Oficial de Presupuestos
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopiarEnlacePdf}
                disabled={!pdfFullUrl}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-[#0b1324] hover:bg-slate-800 border border-slate-700 rounded-lg flex items-center gap-1 transition"
                title="Copiar enlace web permanente al portapapeles"
              >
                {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Link2 size={12} />}
                <span>{copiedLink ? 'Copiado' : 'Copiar Link'}</span>
              </button>
              {pdfFullUrl && (
                <a
                  href={pdfFullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-950/40 border border-blue-500/30 rounded-lg flex items-center gap-1 transition hover:underline"
                >
                  <span>Ver PDF</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          {/* VISTA 1: MODO PLANTILLA OFICIAL DE META (Ventana cerrada o conmutada) */}
          {(modoEnvio === 'template' || !isWindowOpen) ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-400" />
                  <span>Plantilla Oficial Homologada: <span className="font-mono text-blue-400 font-semibold">presupuesto_entrega_pdf</span></span>
                </label>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  APPROVED (Meta Utility)
                </span>
              </div>

              {/* Vista Previa de WhatsApp con Burbuja */}
              <div className="bg-[#0b141a] border border-slate-800 rounded-xl p-3.5 shadow-inner">
                <div className="w-full max-w-[95%] bg-[#1f2c34] text-slate-100 rounded-xl rounded-tl-xs p-3 shadow-md border-l-4 border-emerald-500 space-y-2 text-xs">
                  <div className="font-bold text-emerald-400 text-xs pb-1 border-b border-slate-700/60">
                    Presupuesto Médico Disponible
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    Hola <span className="text-blue-300 font-semibold">{var1Nombre || 'Juan Sebastián'}</span>, ya se encuentra listo el presupuesto para su procedimiento de <span className="text-blue-300 font-semibold">{var2Practica || 'Cirugía'}</span>. El monto total estimado es <span className="text-emerald-300 font-semibold">{var3MontoLink}</span>.
                    {'\n\n'}Presione el botón inferior si desea recibir el archivo PDF oficial con el membrete directamente en este chat de WhatsApp.
                  </div>
                  <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-700/40">
                    MedCRM • Área Quirúrgica
                  </div>
                  <div className="pt-2 border-t border-slate-700/60">
                    <div className="w-full py-1.5 px-3 bg-[#2a3942] rounded-lg text-center text-xs font-semibold text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-1.5 cursor-default">
                      <FileText size={13} />
                      <span>Recibir Presupuesto PDF</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Parámetros de la Plantilla Editables */}
              <div className="p-3 bg-[#14203d]/70 border border-slate-800 rounded-xl space-y-2.5">
                <span className="font-bold text-slate-300 block text-[11px]">
                  Variables Dinámicas de la Plantilla:
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {"{{1}}"} Nombre del Paciente:
                    </label>
                    <input
                      type="text"
                      value={var1Nombre}
                      onChange={(e) => setVar1Nombre(e.target.value)}
                      className="w-full bg-[#0b1324] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {"{{2}}"} Práctica / Procedimiento:
                    </label>
                    <input
                      type="text"
                      value={var2Practica}
                      onChange={(e) => setVar2Practica(e.target.value)}
                      className="w-full bg-[#0b1324] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    {"{{3}}"} Monto Cotizado y Enlace Web al Repositorio:
                  </label>
                  <input
                    type="text"
                    value={var3MontoLink}
                    onChange={(e) => setVar3MontoLink(e.target.value)}
                    className="w-full bg-[#0b1324] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Monto y link al PDF..."
                  />
                </div>
              </div>
            </div>
          ) : (
            /* VISTA 2: MODO TEXTO LIBRE AMENO + PDF ADJUNTO (Solo ventana abierta) */
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-300">
                  Mensaje Cordial de Acompañamiento
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRestablecer}
                    className="px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded flex items-center gap-1 transition"
                    title="Restablecer plantilla inicial"
                  >
                    <RotateCcw size={10} /> Restablecer
                  </button>
                  <button
                    type="button"
                    onClick={handleCopiarTexto}
                    className="px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded flex items-center gap-1 transition"
                    title="Copiar texto"
                  >
                    {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <textarea
                rows={6}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe el mensaje protocolar para el paciente..."
                className="w-full p-3 rounded-xl border border-slate-700 bg-[#0b1324] text-xs font-normal text-slate-100 leading-relaxed outline-none focus:ring-1 focus:ring-blue-500 resize-none font-sans"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                💡 El documento PDF membretado oficial se adjuntará automáticamente a este mensaje.
              </p>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={sending || loadingData}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 ${
                (modoEnvio === 'template' || !isWindowOpen)
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Despachando a Meta...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>
                    {(modoEnvio === 'template' || !isWindowOpen)
                      ? 'Enviar Plantilla Oficial de Presupuesto'
                      : 'Enviar Presupuesto (Texto Libre + PDF)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
