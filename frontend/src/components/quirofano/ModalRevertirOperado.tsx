'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, RotateCcw, ShieldAlert, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatDateArg } from '@/lib/dateUtils'

interface ModalRevertirOperadoProps {
  isOpen: boolean
  turno: any | null
  onClose: () => void
  onRevertido: (turnoActualizado: any, advertencias?: string[]) => void
}

const OPCIONES_ESTADO = [
  { value: 'en_operacion', label: 'En Quirófano (limpia fin de cirugía)' },
  { value: 'pre_quirofano', label: 'Pre-Quirófano (limpia inicio y fin de cirugía)' },
  { value: 'en_espera', label: 'En Espera (limpia pre-qx, inicio y fin)' },
  { value: 'programado', label: 'Por Llegar / Citado (limpia todos los timestamps)' },
]

export default function ModalRevertirOperado({
  isOpen,
  turno,
  onClose,
  onRevertido,
}: ModalRevertirOperadoProps) {
  const [estadoDestino, setEstadoDestino] = useState<string>('programado')
  const [motivo, setMotivo] = useState<string>('')
  const [desvincularGeclisa, setDesvincularGeclisa] = useState<boolean>(false)
  const [enviando, setEnviando] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && turno) {
      setEstadoDestino(turno.inicio_cirugia_at ? 'en_operacion' : 'programado')
      setMotivo('')
      setDesvincularGeclisa(false)
      setErrorMsg(null)
    }
  }, [isOpen, turno])

  if (!isOpen || !turno) return null

  const pac = turno.pacientes || {}
  const tienePdf = Boolean(turno.parte_quirurgico_pdf_url)
  const tieneGeclisa = Boolean(turno.parte_quirurgico_geclisa_archivo_id)
  const tienePostQx = Boolean(turno.indicaciones_postqx_enviadas)

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivo.trim()) {
      setErrorMsg('Debe ingresar un motivo obligatorio para revertir el estado operado.')
      return
    }

    try {
      setEnviando(true)
      setErrorMsg(null)
      const res = await apiFetch(`/api/turnos-quirofano/${turno.id}/revertir-operado`, {
        method: 'POST',
        timeoutMs: 25000,
        body: JSON.stringify({
          estado_destino: estadoDestino,
          motivo: motivo.trim(),
          desvincular_geclisa: desvincularGeclisa,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setErrorMsg(data?.detail || data?.error || `Error al revertir (HTTP ${res.status})`)
        return
      }
      onRevertido(data.turno, data.advertencias)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error de conexión al revertir el turno operado.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={20} className="text-amber-500 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                Revertir Cirugía Marcada como Operada
              </h3>
              <p className="text-[11px] text-[var(--secondary)]">
                {pac.nombre || 'Paciente'} • {formatDateArg(turno.fecha_cirugia)} {(turno.hora_inicio || '').slice(0, 5)} hs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-slate-200/50 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleConfirmar} className="p-5 space-y-4">
          {(tienePdf || tieneGeclisa || tienePostQx) && (
            <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs space-y-1.5 text-amber-800 dark:text-amber-200">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Impacto de la reversión sobre registros existentes:</span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px]">
                {tienePdf && (
                  <li>Se limpiará la referencia del Protocolo Quirúrgico PDF generado en el CRM.</li>
                )}
                {tieneGeclisa && (
                  <li>
                    El Protocolo Quirúrgico ya fue subido a Geclisa (ID #{turno.parte_quirurgico_geclisa_archivo_id}).
                  </li>
                )}
                {tienePostQx && (
                  <li>Ya se enviaron indicaciones postquirúrgicas por WhatsApp a este paciente.</li>
                )}
              </ul>
              {tieneGeclisa && (
                <label className="flex items-center gap-2 pt-1.5 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={desvincularGeclisa}
                    onChange={(e) => setDesvincularGeclisa(e.target.checked)}
                    className="rounded border-amber-500 text-amber-600 focus:ring-amber-500"
                  />
                  <span>También eliminar el Protocolo Quirúrgico de Geclisa</span>
                </label>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--foreground)] mb-1.5">
              Estado destino en Pizarra
            </label>
            <select
              value={estadoDestino}
              onChange={(e) => setEstadoDestino(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {OPCIONES_ESTADO.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--foreground)] mb-1.5">
              Motivo de la reversión <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              required
              placeholder="Ej: Marcado como operado por error / turno reprogramado antes de ejecutarse..."
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300 font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !motivo.trim()}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              <span>Confirmar Reversión</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
