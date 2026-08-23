'use client'

import React, { useState } from 'react'
import {
  X,
  Download,
  Send,
  FileText,
  Loader2,
  ExternalLink,
  RefreshCw,
  Printer
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ModalVisorPdfPresupuestoProps {
  isOpen: boolean
  onClose: () => void
  pdfUrl?: string | null
  presupuestoId: string
  pacienteNombre?: string
  onEnviarWhatsApp?: () => void
}

export default function ModalVisorPdfPresupuesto({
  isOpen,
  onClose,
  pdfUrl,
  presupuestoId,
  pacienteNombre = '',
  onEnviarWhatsApp
}: ModalVisorPdfPresupuestoProps) {
  const [cargando, setCargando] = useState(true)

  if (!isOpen || !pdfUrl) return null

  const fullPdfUrl = pdfUrl.startsWith('http')
    ? pdfUrl
    : `${BACKEND_URL}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-preview-frame') as HTMLIFrameElement
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print()
    } else {
      window.open(fullPdfUrl, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-[var(--border)] rounded-2xl w-full max-w-5xl h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white tracking-tight">
                  Documento PDF Oficial • Presupuesto #{presupuestoId.slice(0, 8).toUpperCase()}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40">
                  Membretado
                </span>
              </div>
              {pacienteNombre && (
                <p className="text-xs text-gray-400">
                  Paciente: <strong className="text-gray-200">{pacienteNombre}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            {onEnviarWhatsApp && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEnviarWhatsApp()
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow"
              >
                <Send size={13} />
                Enviar WhatsApp
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-gray-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition"
              title="Imprimir"
            >
              <Printer size={15} />
            </button>

            <a
              href={fullPdfUrl}
              download={`presupuesto_${presupuestoId}.pdf`}
              className="p-2 text-gray-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition"
              title="Descargar PDF"
            >
              <Download size={15} />
            </a>

            <a
              href={fullPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink size={15} />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Visor PDF Frame */}
        <div className="flex-1 relative bg-neutral-950 flex items-center justify-center overflow-hidden">
          {cargando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-gray-400 bg-neutral-950/80 z-10">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span>Cargando previsualización del documento...</span>
            </div>
          )}

          <iframe
            id="pdf-preview-frame"
            src={`${fullPdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
            onLoad={() => setCargando(false)}
            className="w-full h-full border-0"
            title={`Presupuesto ${presupuestoId}`}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-neutral-950/90 border-t border-[var(--border)] flex items-center justify-between text-xs text-gray-400">
          <span>Emitido con validez oficial por el CRM Médico.</span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono">ID: {presupuestoId}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
