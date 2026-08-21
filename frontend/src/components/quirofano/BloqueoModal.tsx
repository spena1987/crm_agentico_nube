'use client'

import React, { useState } from 'react'
import { X, Lock, Save, Loader2, AlertCircle } from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface BloqueoModalProps {
  isOpen: boolean
  onClose: () => void
  quirofanos: any[]
  fechaSeleccionada: string
  onSaved: () => void
}

export default function BloqueoModal({
  isOpen,
  onClose,
  quirofanos,
  fechaSeleccionada,
  onSaved
}: BloqueoModalProps) {
  const [quirofanoId, setQuirofanoId] = useState(quirofanos[0]?.id || '')
  const [fecha, setFecha] = useState(fechaSeleccionada || new Date().toISOString().split('T')[0])
  const [horaDesde, setHoraDesde] = useState('08:00')
  const [horaHasta, setHoraHasta] = useState('09:00')
  const [motivo, setMotivo] = useState('NO DAR TURNO')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setGuardando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/quirofano-bloqueos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quirofano_id: quirofanoId || quirofanos[0]?.id,
          fecha,
          hora_desde: horaDesde,
          hora_hasta: horaHasta,
          motivo,
          descripcion
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Error al crear bloqueo')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--card)] w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 text-red-600">
            <Lock size={18} />
            <h3 className="text-sm font-bold text-[var(--foreground)]">Bloquear Horario de Quirófano</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleGuardar} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-[var(--secondary)]">Quirófano / Sala</label>
            <select
              value={quirofanoId}
              onChange={(e) => setQuirofanoId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
              required
            >
              {quirofanos.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nombre} ({q.codigo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--secondary)]">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Desde</label>
              <input
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                className="w-full mt-1 px-2.5 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Hasta</label>
              <input
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                className="w-full mt-1 px-2.5 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--secondary)]">Motivo Principal</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-red-600"
            >
              <option value="NO DAR TURNO">NO DAR TURNO</option>
              <option value="Mantenimiento de Equipo">Mantenimiento de Equipo</option>
              <option value="Congreso / Ausencia Médica">Congreso / Ausencia Médica</option>
              <option value="Limpieza Profunda">Limpieza Profunda</option>
              <option value="Feriado / Asueto">Feriado / Asueto</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--secondary)]">Descripción / Nota</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles adicionales..."
              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow"
            >
              {guardando ? 'Bloqueando...' : 'Crear Bloqueo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
