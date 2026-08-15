'use client'

import React from 'react'
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react'

interface ModalConfirmarEliminarProps {
  isOpen: boolean
  nombrePaciente: string
  eliminando: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ModalConfirmarEliminar({
  isOpen,
  nombrePaciente,
  eliminando,
  onConfirm,
  onClose,
}: ModalConfirmarEliminarProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[var(--card)] border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Eliminar Expediente</h3>
              <p className="text-xs text-red-400 font-semibold">Acción irreversible en cascada</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={eliminando}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensaje de Advertencia */}
        <div className="space-y-2 text-xs text-gray-300 bg-neutral-900/60 p-4 rounded-xl border border-[var(--border)]">
          <p>
            ¿Estás seguro de que deseas eliminar permanentemente el expediente de{' '}
            <strong className="text-white font-bold">{nombrePaciente}</strong>?
          </p>
          <p className="text-gray-400">
            Esta acción borrará en el CRM todos los datos vinculados:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-gray-400">
            <li>Historial de conversaciones y mensajes de WhatsApp.</li>
            <li>Observaciones, diagnósticos y notas clínicas.</li>
            <li>Presupuestos y cotizaciones emitidas.</li>
          </ul>
        </div>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={eliminando}
            className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors border border-[var(--border)]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={eliminando}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow flex items-center gap-1.5"
          >
            {eliminando ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                Sí, Eliminar Paciente
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
