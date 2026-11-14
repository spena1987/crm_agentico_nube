'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  CalendarClock,
  CalendarX,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Building2,
  Clock,
  Calendar,
  ArrowRightLeft,
  Ban
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface ModalSuspenderReprogramarTurnoProps {
  isOpen: boolean
  onClose: () => void
  turno: any | null
  quirofanos?: any[]
  onSuccess: (res?: any) => void
}

const MOTIVOS_SUGERIDOS = [
  'Decisión del paciente en el día',
  'Ayuno incompleto / Sin preparación',
  'Cuadro clínico / Hipertensión / No apto anestesia',
  'Falta de estudios / Autorización / LIO',
  'Reprogramación institucional / Médico',
  'Otro motivo'
]

export default function ModalSuspenderReprogramarTurno({
  isOpen,
  onClose,
  turno,
  quirofanos: quirofanosProp,
  onSuccess
}: ModalSuspenderReprogramarTurnoProps) {
  const { user } = useAuth()
  const [modo, setModo] = useState<'reprogramar_sin_fecha' | 'reprogramar_con_fecha' | 'cancelar_definitivo'>('reprogramar_sin_fecha')
  const [motivo, setMotivo] = useState<string>(MOTIVOS_SUGERIDOS[0])
  const [observaciones, setObservaciones] = useState<string>('')
  const [nuevaFechaProbable, setNuevaFechaProbable] = useState<string>('')
  const [nuevaFecha, setNuevaFecha] = useState<string>('')
  const [quirofanoId, setQuirofanoId] = useState<string>('')
  const [horaInicio, setHoraInicio] = useState<string>('08:30')
  const [duracionMinutos, setDuracionMinutos] = useState<number>(20)
  const [quirofanos, setQuirofanos] = useState<any[]>(quirofanosProp || [])
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [conflictoDetectado, setConflictoDetectado] = useState<any | null>(null)

  useEffect(() => {
    if (!isOpen || !turno) return
    setModo('reprogramar_sin_fecha')
    setMotivo(MOTIVOS_SUGERIDOS[0])
    setObservaciones('')
    setNuevaFechaProbable('')
    setNuevaFecha('')
    setQuirofanoId(turno.quirofano_id || '')
    setHoraInicio(String(turno.hora_inicio || '08:30').slice(0, 5))
    setDuracionMinutos(Number(turno.duracion_minutos || 20))
    setErrorMsg(null)
    setConflictoDetectado(null)
  }, [isOpen, turno])

  useEffect(() => {
    if (quirofanosProp && quirofanosProp.length > 0) {
      setQuirofanos(quirofanosProp)
      return
    }
    if (!isOpen) return
    let active = true
    apiFetch('/api/quirofanos?solo_activos=true')
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.success && Array.isArray(d.quirofanos)) {
          setQuirofanos(d.quirofanos)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isOpen, quirofanosProp])

  if (!isOpen || !turno) return null

  const pac = turno.pacientes || {}
  const nombrePaciente = pac.nombre || turno.paciente_nombre || 'Paciente'
  const fechaActualStr = turno.fecha_cirugia || ''
  const horaActualStr = String(turno.hora_inicio || '').slice(0, 5)
  const usuarioNombre = (user as any)?.nombre_completo || (user as any)?.nombre || user?.email || 'Equipo Quirúrgico / Asesoramiento'

  const ejecutarAccion = async (forzar: boolean = false) => {
    if (modo === 'reprogramar_con_fecha' && !nuevaFecha) {
      setErrorMsg('Debe seleccionar la nueva fecha quirúrgica.')
      return
    }

    try {
      setEnviando(true)
      setErrorMsg(null)
      setConflictoDetectado(null)

      const res = await apiFetch(`/api/turnos-quirofano/${turno.id}/suspender-reprogramar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo,
          motivo,
          observaciones: observaciones.trim() || null,
          usuario_nombre: usuarioNombre,
          nueva_fecha: modo === 'reprogramar_con_fecha' ? nuevaFecha : null,
          quirofano_id: modo === 'reprogramar_con_fecha' ? (quirofanoId || turno.quirofano_id) : null,
          hora_inicio: modo === 'reprogramar_con_fecha' ? horaInicio : null,
          duracion_minutos: modo === 'reprogramar_con_fecha' ? duracionMinutos : null,
          nueva_fecha_probable: modo === 'reprogramar_sin_fecha' ? (nuevaFechaProbable || null) : null,
          forzar
        })
      })

      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data?.conflicto) {
        setConflictoDetectado(data.conflicto)
        setErrorMsg(data.error || 'Existe un conflicto de horario en la sala seleccionada.')
        return
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.detail || data?.error || 'No se pudo procesar la suspensión/reprogramación.')
      }

      onSuccess(data)
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar la solicitud.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <ArrowRightLeft size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-[var(--foreground)] truncate">
                Suspender o Reprogramar Cirugía
              </h3>
              <p className="text-xs text-[var(--secondary)] truncate">
                {nombrePaciente} • {turno.ojo || 'Qx'} • {fechaActualStr} {horaActualStr} hs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Resumen del turno actual */}
          <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block">
                Procedimiento Programado
              </span>
              <span className="font-bold text-white">
                {turno.practica_nombre || 'Cirugía Oftalmológica'} ({turno.ojo || 'OD'})
              </span>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono font-bold">
                {turno.quirofanos?.nombre || 'Quirófano'} • {horaActualStr} hs
              </span>
            </div>
          </div>

          {/* Selector de Acción */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--secondary)] block">
              1. Seleccione cómo proceder
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setModo('reprogramar_sin_fecha')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                  modo === 'reprogramar_sin_fecha'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-neutral-900/60 border-[var(--border)] text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <CalendarClock size={15} className="text-amber-400 shrink-0" />
                  <span>Pasar a Asesoramiento</span>
                </div>
                <p className="text-[11px] opacity-80 leading-snug">
                  Libera el quirófano hoy y devuelve el caso a &quot;En Análisis&quot; para coordinar nueva fecha.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModo('reprogramar_con_fecha')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                  modo === 'reprogramar_con_fecha'
                    ? 'bg-blue-500/15 border-blue-500 text-blue-200 ring-1 ring-blue-500/40'
                    : 'bg-neutral-900/60 border-[var(--border)] text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <Calendar size={15} className="text-blue-400 shrink-0" />
                  <span>Reprogramar Fecha Hoy</span>
                </div>
                <p className="text-[11px] opacity-80 leading-snug">
                  Libera el turno actual y agenda inmediatamente la nueva fecha y horario en sala.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModo('cancelar_definitivo')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                  modo === 'cancelar_definitivo'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-200 ring-1 ring-rose-500/40'
                    : 'bg-neutral-900/60 border-[var(--border)] text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <Ban size={15} className="text-rose-400 shrink-0" />
                  <span>Cancelar Definitivo</span>
                </div>
                <p className="text-[11px] opacity-80 leading-snug">
                  Suspende la cirugía y cierra el caso como cancelado (salvo otro ojo activo).
                </p>
              </button>
            </div>
          </div>

          {/* Campos condicionales según modo */}
          {modo === 'reprogramar_sin_fecha' && (
            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <label className="text-xs font-bold text-amber-300 block">
                Fecha Probable Tentativa (Opcional)
              </label>
              <input
                type="date"
                value={nuevaFechaProbable}
                onChange={(e) => setNuevaFechaProbable(e.target.value)}
                className="w-full md:w-64 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-amber-200/70">
                Se programará automáticamente un recontacto prioritario en Asesoramiento Quirúrgico para mañana.
              </p>
            </div>
          )}

          {modo === 'reprogramar_con_fecha' && (
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-blue-300 uppercase flex items-center gap-1 mb-1">
                  <Calendar size={12} /> Nueva Fecha *
                </label>
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-blue-300 uppercase flex items-center gap-1 mb-1">
                  <Building2 size={12} /> Sala / Quirófano
                </label>
                <select
                  value={quirofanoId}
                  onChange={(e) => setQuirofanoId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                >
                  {quirofanos.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-blue-300 uppercase flex items-center gap-1 mb-1">
                  <Clock size={12} /> Hora de Inicio
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-blue-300 uppercase mb-1 block">
                  Duración (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={duracionMinutos}
                  onChange={(e) => setDuracionMinutos(Number(e.target.value) || 20)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Motivo y Observaciones */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--secondary)] block mb-1.5">
                2. Motivo de Suspensión / Reprogramación
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium text-[var(--foreground)] outline-none focus:border-amber-500"
              >
                {MOTIVOS_SUGERIDOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--secondary)] block mb-1">
                Observaciones Clínicas / Administrativas (Se registra en Historia del Caso)
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Paciente refiere no haber realizado ayuno / solicita pasar cirugía para la próxima semana..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 space-y-2">
                <p className="font-bold">{errorMsg}</p>
                {conflictoDetectado && (
                  <button
                    type="button"
                    onClick={() => ejecutarAccion(true)}
                    disabled={enviando}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold"
                  >
                    Forzar Agendamiento en Este Horario
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] bg-neutral-950/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-gray-300 hover:bg-white/5 transition"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={() => ejecutarAccion(false)}
            disabled={enviando}
            className={`px-5 py-2 rounded-xl text-xs font-black text-white shadow-lg flex items-center gap-2 transition disabled:opacity-50 ${
              modo === 'cancelar_definitivo'
                ? 'bg-rose-600 hover:bg-rose-700'
                : modo === 'reprogramar_con_fecha'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            <span>
              {modo === 'reprogramar_con_fecha'
                ? 'Confirmar Reprogramación'
                : modo === 'cancelar_definitivo'
                  ? 'Confirmar Cancelación'
                  : 'Liberar Turno y Pasar a Asesoramiento'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
