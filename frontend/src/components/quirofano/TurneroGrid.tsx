'use client'

import React from 'react'
import { Lock, FileCheck2, Send, Clock, User, Eye } from 'lucide-react'

interface TurneroGridProps {
  quirofanos: any[]
  turnos: any[]
  bloqueos: any[]
  fechaSeleccionada: string
  onSlotClick: (quirofanoId: string, hora: string) => void
  onTurnoClick: (turno: any) => void
  onEliminarBloqueo: (bloqueoId: string) => void
}

const GENERAR_SLOTS_HORARIOS = () => {
  const slots: string[] = []
  for (let h = 8; h <= 14; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === 14 && m > 30) break
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }
  return slots
}

export default function TurneroGrid({
  quirofanos,
  turnos,
  bloqueos,
  fechaSeleccionada,
  onSlotClick,
  onTurnoClick,
  onEliminarBloqueo
}: TurneroGridProps) {
  const slots = GENERAR_SLOTS_HORARIOS()

  return (
    <div className="w-full overflow-x-auto bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm">
      <table className="w-full border-collapse text-left min-w-[750px]">
        {/* Cabecera de Quirófanos */}
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-[var(--border)]">
            <th className="p-3 text-xs font-bold text-[var(--secondary)] w-20 border-r border-[var(--border)] text-center">
              Hora
            </th>
            {quirofanos.map((q) => (
              <th key={q.id} className="p-3 text-xs font-bold text-[var(--foreground)] border-r border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                  <span className="truncate">{q.nombre}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {q.codigo}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Cuerpo de Slots */}
        <tbody>
          {slots.map((hora) => (
            <tr key={hora} className="border-b border-[var(--border)]/60 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
              {/* Celda de Hora */}
              <td className="p-2 text-center font-mono text-[11px] font-bold text-[var(--secondary)] bg-slate-50/50 dark:bg-slate-900/30 border-r border-[var(--border)]">
                {hora}
              </td>

              {/* Celdas de cada Quirófano */}
              {quirofanos.map((q) => {
                // Buscar turno que coincida con esta hora de inicio
                const turno = turnos.find(
                  (t) => t.quirofano_id === q.id && (t.hora_inicio || '').slice(0, 5) === hora
                )

                // Buscar bloqueo que abarque esta hora
                const bloqueo = bloqueos.find((b) => {
                  if (b.quirofano_id !== q.id) return false
                  const desde = (b.hora_desde || '').slice(0, 5)
                  const hasta = (b.hora_hasta || '').slice(0, 5)
                  return hora >= desde && hora < hasta
                })

                if (bloqueo) {
                  return (
                    <td
                      key={q.id}
                      className="p-1.5 border-r border-[var(--border)] last:border-0 bg-red-50/60 dark:bg-red-950/20"
                    >
                      <div className="p-2 rounded-xl border border-red-500/30 bg-red-100/70 dark:bg-red-900/30 flex items-center justify-between text-red-700 dark:text-red-300">
                        <div className="flex items-center gap-1.5">
                          <Lock size={13} className="shrink-0" />
                          <span className="text-[11px] font-bold uppercase">{bloqueo.motivo}</span>
                        </div>
                        <button
                          onClick={() => onEliminarBloqueo(bloqueo.id)}
                          className="text-[10px] text-red-500 hover:underline"
                        >
                          Desbloquear
                        </button>
                      </div>
                    </td>
                  )
                }

                if (turno) {
                  const pac = turno.pacientes || {}
                  const ojo = turno.ojo || 'OD'
                  const ojoBadge = ojo === 'OD' ? 'Ojo Der' : ojo === 'OI' ? 'Ojo Izq' : 'Ambos'
                  const isFirmado = turno.consentimiento_estado === 'firmado_digital'
                  const isEnviado = turno.consentimiento_estado === 'enviado_whatsapp'

                  return (
                    <td key={q.id} className="p-1.5 border-r border-[var(--border)] last:border-0">
                      <div
                        onClick={() => onTurnoClick(turno)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all shadow-sm hover:shadow-md ${
                          isFirmado
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-500'
                            : isEnviado
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 hover:border-amber-500'
                            : 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/40 hover:border-blue-500'
                        }`}
                      >
                        {/* Fila Superior */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-[var(--foreground)] truncate">
                            {pac.nombre || 'Paciente'}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 shrink-0">
                            {ojoBadge}
                          </span>
                        </div>

                        {/* Cirugía & Médico */}
                        <p className="text-[11px] text-[var(--secondary)] truncate mt-0.5">
                          {turno.practica_nombre} • <span className="font-semibold">{turno.cirujano_nombre}</span>
                        </p>

                        {/* Cobertura & Estado de Consentimiento */}
                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-[var(--border)]/40 text-[10px]">
                          <span className="font-semibold text-slate-600 dark:text-slate-400">
                            {turno.obra_social || 'Particular'}
                          </span>

                          <span
                            className={`font-bold flex items-center gap-1 ${
                              isFirmado
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isEnviado
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {isFirmado ? (
                              <>
                                <FileCheck2 size={11} /> Firmado
                              </>
                            ) : isEnviado ? (
                              <>
                                <Send size={11} /> WA Enviado
                              </>
                            ) : (
                              'Pendiente WA'
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                  )
                }

                // Slot Vacío (Clickeable para agendar nuevo turno)
                return (
                  <td
                    key={q.id}
                    onClick={() => onSlotClick(q.id, hora)}
                    className="p-2 border-r border-[var(--border)] last:border-0 cursor-pointer hover:bg-blue-500/10 transition-colors group"
                  >
                    <span className="text-[10px] font-medium text-slate-300 dark:text-slate-700 group-hover:text-blue-600 transition-colors">
                      + Agendar {hora}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
