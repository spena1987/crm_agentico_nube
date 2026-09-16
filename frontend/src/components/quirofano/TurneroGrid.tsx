'use client'

import React from 'react'
import { Lock, FileCheck2, Send, Clock, User, Eye, UserCheck, Timer, CalendarX } from 'lucide-react'

interface TurneroGridProps {
  modo: 'dia' | 'semana'
  quirofanos: any[]
  quirofanoSeleccionadoId?: string
  turnos: any[]
  bloqueos: any[]
  bloquesMedicos?: any[]
  fechaSeleccionada: string // YYYY-MM-DD
  diasSemana?: { fecha: string; nombreDia: string; numeroDia: number; esHoy: boolean }[]
  onSlotClick: (quirofanoId: string, hora: string, fecha?: string) => void
  onTurnoClick: (turno: any) => void
  onEliminarBloqueo: (bloqueoId: string) => void
}

// Convertir "HH:MM" a minutos desde las 00:00
const horaAMinutos = (hora: string) => {
  if (!hora) return 0
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// Convertir minutos a "HH:MM"
const minutosAHora = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Obtener número de día de la semana (1=Lunes ... 7=Domingo) para una fecha YYYY-MM-DD
const getNumeroDiaSemana = (fechaStr: string) => {
  const d = new Date(fechaStr + 'T12:00:00')
  const day = d.getDay()
  return day === 0 ? 7 : day
}

export default function TurneroGrid({
  modo,
  quirofanos,
  quirofanoSeleccionadoId,
  turnos,
  bloqueos,
  bloquesMedicos = [],
  fechaSeleccionada,
  diasSemana = [],
  onSlotClick,
  onTurnoClick,
  onEliminarBloqueo
}: TurneroGridProps) {
  const quirofanoActual = quirofanos.find((q) => q.id === quirofanoSeleccionadoId) || quirofanos[0]

  // Paso de slots
  const pasoMinutos = modo === 'semana' && quirofanoActual?.duracion_slot_minutos
    ? quirofanoActual.duracion_slot_minutos
    : 10

  // Horarios
  const horaInicioMin = modo === 'semana' && quirofanoActual?.hora_inicio
    ? horaAMinutos(quirofanoActual.hora_inicio)
    : 8 * 60
  const horaFinMin = modo === 'semana' && quirofanoActual?.hora_fin
    ? horaAMinutos(quirofanoActual.hora_fin)
    : 14 * 60 + 30

  const slots: string[] = []
  for (let m = horaInicioMin; m <= horaFinMin; m += pasoMinutos) {
    slots.push(minutosAHora(m))
  }

  const numDiaHoy = getNumeroDiaSemana(fechaSeleccionada)
  const algunQuirofanoOperaHoy = quirofanos.some((q) => (q.dias_operativos || [1, 2, 3, 4, 5]).includes(numDiaHoy))
  const turnosHoy = turnos.filter((t) => t.fecha_cirugia === fechaSeleccionada)

  // Empty State para Vista Día si ningún quirófano opera hoy y no hay cirugías extraordinarias
  if (modo === 'dia' && !algunQuirofanoOperaHoy && turnosHoy.length === 0) {
    return (
      <div className="w-full bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm p-12 text-center space-y-3 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20 shadow-inner">
          <CalendarX size={30} />
        </div>
        <h3 className="text-base font-bold text-[var(--foreground)]">
          Quirófanos fuera de servicio para esta fecha
        </h3>
        <p className="text-xs text-[var(--secondary)] max-w-md mx-auto leading-relaxed">
          Ninguna sala de quirófano se encuentra operativa habitualmente para la fecha seleccionada ({fechaSeleccionada}).
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onSlotClick(quirofanoActual?.id || '', '08:00', fechaSeleccionada)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center gap-2"
          >
            <span>+ Programar Guardia o Cirugía Extraordinaria</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm">
      <table className="w-full border-collapse text-left min-w-[750px]">
        {/* Cabecera */}
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-[var(--border)]">
            <th className="p-3 text-xs font-bold text-[var(--secondary)] w-24 border-r border-[var(--border)] text-center sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">
              Hora
            </th>

            {modo === 'dia' ? (
              quirofanos.map((q) => {
                const diasOp = q.dias_operativos || [1, 2, 3, 4, 5]
                const estaOperativoHoy = diasOp.includes(numDiaHoy)

                return (
                  <th key={q.id} className="p-3 text-xs font-bold text-[var(--foreground)] border-r border-[var(--border)] last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                        <span className="truncate">{q.nombre}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                          {q.codigo}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 shrink-0">
                          ⏱ {q.duracion_slot_minutos || 15}m
                        </span>
                        {!estaOperativoHoy && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            Cerrado Hoy
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                )
              })
            ) : (
              diasSemana.map((d) => {
                const diasOp = quirofanoActual?.dias_operativos || [1, 2, 3, 4, 5]
                const estaOperativoEsteDia = diasOp.includes(d.numeroDia)
                const bloqueMed = bloquesMedicos.find(
                  (b) => b.quirofano_id === quirofanoActual?.id && b.dia_semana === d.numeroDia
                )
                const turnosEsteDia = turnos.filter(
                  (t) => t.quirofano_id === quirofanoActual?.id && t.fecha_cirugia === d.fecha
                )

                return (
                  <th
                    key={d.fecha}
                    className={`p-3 text-xs font-bold border-r border-[var(--border)] last:border-0 ${
                      !estaOperativoEsteDia
                        ? 'bg-amber-500/5 dark:bg-amber-950/20 text-slate-400'
                        : d.esHoy
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="uppercase text-[11px] font-bold">{d.nombreDia}</p>
                          {!estaOperativoEsteDia && (
                            turnosEsteDia.length > 0 ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800">
                                Excepción ({turnosEsteDia.length} QX)
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-normal">
                                No opera
                              </span>
                            )
                          )}
                        </div>
                        <p className="text-[10px] font-mono opacity-80">{d.fecha.slice(5)}</p>
                      </div>
                      {bloqueMed && estaOperativoEsteDia && (
                        <span
                          className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold truncate max-w-[110px]"
                          title={`${bloqueMed.medico_nombre} (${bloqueMed.hora_desde.slice(0, 5)}-${bloqueMed.hora_hasta.slice(0, 5)})`}
                        >
                          {bloqueMed.medico_nombre.split(',')[0]}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })
            )}
          </tr>
        </thead>

        {/* Cuerpo */}
        <tbody>
          {slots.map((horaSlot) => {
            const slotMin = horaAMinutos(horaSlot)

            return (
              <tr key={horaSlot} className="border-b border-[var(--border)]/60 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                {/* Hora */}
                <td className="p-2 text-center font-mono text-[11px] font-bold text-[var(--secondary)] bg-slate-50/50 dark:bg-slate-900/30 border-r border-[var(--border)] sticky left-0 z-10">
                  {horaSlot}
                </td>

                {modo === 'dia' ? (
                  // VISTA DÍA
                  quirofanos.map((q) => {
                    const diasOp = q.dias_operativos || [1, 2, 3, 4, 5]
                    const estaOperativoHoy = diasOp.includes(numDiaHoy)

                    const turnoInicio = turnos.find(
                      (t) =>
                        t.quirofano_id === q.id &&
                        t.fecha_cirugia === fechaSeleccionada &&
                        (t.hora_inicio || '').slice(0, 5) === horaSlot
                    )

                    const turnoCubriendo = turnos.find((t) => {
                      if (t.quirofano_id !== q.id || t.fecha_cirugia !== fechaSeleccionada) return false
                      const tInicioMin = horaAMinutos(t.hora_inicio)
                      const dur = t.duracion_minutos || q.duracion_slot_minutos || 20
                      const tFinMin = tInicioMin + dur
                      return slotMin > tInicioMin && slotMin < tFinMin
                    })

                    const bloqueo = bloqueos.find((b) => {
                      if (b.quirofano_id !== q.id || b.fecha !== fechaSeleccionada) return false
                      const desde = horaAMinutos(b.hora_desde)
                      const hasta = horaAMinutos(b.hora_hasta)
                      return slotMin >= desde && slotMin < hasta
                    })

                    if (!estaOperativoHoy && !turnoInicio && !turnoCubriendo && !bloqueo) {
                      return (
                        <td
                          key={q.id}
                          className="p-1 border-r border-[var(--border)] last:border-0 bg-slate-100/50 dark:bg-slate-900/20 select-none opacity-40 text-center"
                        >
                          <span className="text-[9px] text-slate-400 italic">No operativo</span>
                        </td>
                      )
                    }

                    if (turnoCubriendo) {
                      return (
                        <td
                          key={q.id}
                          className="p-1 border-r border-[var(--border)] last:border-0 bg-blue-50/20 dark:bg-blue-950/10 border-dashed"
                        >
                          <div className="h-5 flex items-center justify-center">
                            <span className="text-[9px] font-mono text-blue-400 opacity-60">
                              ▲ Ocupado ({turnoCubriendo.practica_nombre?.slice(0, 18)}...)
                            </span>
                          </div>
                        </td>
                      )
                    }

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
                              ✕
                            </button>
                          </div>
                        </td>
                      )
                    }

                    if (turnoInicio) {
                      const pac = turnoInicio.pacientes || {}
                      const ojo = turnoInicio.ojo || 'OD'
                      const ojoBadge = ojo === 'OD' ? 'Ojo Der' : ojo === 'OI' ? 'Ojo Izq' : 'Ambos'
                      const isFirmado = turnoInicio.consentimiento_estado === 'firmado_digital'
                      const isEnviado = turnoInicio.consentimiento_estado === 'enviado_whatsapp'
                      const duracion = turnoInicio.duracion_minutos || q.duracion_slot_minutos || 20

                      return (
                        <td key={q.id} className="p-1.5 border-r border-[var(--border)] last:border-0">
                          <div
                            onClick={() => onTurnoClick(turnoInicio)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all shadow-sm hover:shadow-md ${
                              isFirmado
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-500'
                                : isEnviado
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 hover:border-amber-500'
                                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/40 hover:border-blue-500'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-[var(--foreground)] truncate">
                                {pac.nombre || 'Paciente'}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                  {ojoBadge}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-1 py-0.2 rounded">
                                  {duracion}m
                                </span>
                              </div>
                            </div>

                            <p className="text-[11px] text-[var(--secondary)] truncate mt-0.5">
                              {turnoInicio.practica_nombre} • <span className="font-semibold">{turnoInicio.cirujano_nombre}</span>
                            </p>

                            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-[var(--border)]/40 text-[10px]">
                              <span className="font-semibold text-slate-600 dark:text-slate-400">
                                {turnoInicio.obra_social || 'Particular'}
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

                    return (
                      <td
                        key={q.id}
                        onClick={() => onSlotClick(q.id, horaSlot, fechaSeleccionada)}
                        className="p-2 border-r border-[var(--border)] last:border-0 cursor-pointer hover:bg-blue-500/10 transition-colors group"
                      >
                        <span className="text-[10px] font-medium text-slate-300 dark:text-slate-700 group-hover:text-blue-600 transition-colors">
                          + Agendar {horaSlot}
                        </span>
                      </td>
                    )
                  })
                ) : (
                  // VISTA SEMANAL
                  diasSemana.map((d) => {
                    const qId = quirofanoActual?.id
                    const diasOp = quirofanoActual?.dias_operativos || [1, 2, 3, 4, 5]
                    const estaOperativoEsteDia = diasOp.includes(d.numeroDia)

                    const turnoInicio = turnos.find(
                      (t) =>
                        t.quirofano_id === qId &&
                        t.fecha_cirugia === d.fecha &&
                        (t.hora_inicio || '').slice(0, 5) === horaSlot
                    )

                    const turnoCubriendo = turnos.find((t) => {
                      if (t.quirofano_id !== qId || t.fecha_cirugia !== d.fecha) return false
                      const tInicioMin = horaAMinutos(t.hora_inicio)
                      const dur = t.duracion_minutos || quirofanoActual?.duracion_slot_minutos || 20
                      const tFinMin = tInicioMin + dur
                      return slotMin > tInicioMin && slotMin < tFinMin
                    })

                    const bloqueo = bloqueos.find((b) => {
                      if (b.quirofano_id !== qId || b.fecha !== d.fecha) return false
                      const desde = horaAMinutos(b.hora_desde)
                      const hasta = horaAMinutos(b.hora_hasta)
                      return slotMin >= desde && slotMin < hasta
                    })

                    const bloqueMed = bloquesMedicos.find(
                      (b) =>
                        b.quirofano_id === qId &&
                        b.dia_semana === d.numeroDia &&
                        slotMin >= horaAMinutos(b.hora_desde) &&
                        slotMin < horaAMinutos(b.hora_hasta)
                    )

                    // Si este día no es operativo habitual y no hay turno ni bloqueo en este slot:
                    if (!estaOperativoEsteDia && !turnoInicio && !turnoCubriendo && !bloqueo) {
                      return (
                        <td
                          key={d.fecha}
                          onClick={() => onSlotClick(qId, horaSlot, d.fecha)}
                          className="p-1 border-r border-[var(--border)] last:border-0 bg-slate-100/50 dark:bg-slate-900/20 select-none opacity-40 hover:opacity-100 hover:bg-blue-500/10 transition-all text-center cursor-pointer group"
                          title="Día no operativo habitual. Clic para agendar guardia o jornada extraordinaria."
                        >
                          <span className="text-[9px] text-slate-400 group-hover:text-blue-600 italic font-medium">
                            Cerrado (+ Agendar)
                          </span>
                        </td>
                      )
                    }

                    if (turnoCubriendo) {
                      return (
                        <td
                          key={d.fecha}
                          className="p-1 border-r border-[var(--border)] last:border-0 bg-blue-50/20 dark:bg-blue-950/10 border-dashed"
                        >
                          <div className="h-5 flex items-center justify-center">
                            <span className="text-[9px] font-mono text-blue-400 opacity-60">
                              ▲ Ocupado ({turnoCubriendo.practica_nombre?.slice(0, 15)}...)
                            </span>
                          </div>
                        </td>
                      )
                    }

                    if (bloqueo) {
                      return (
                        <td
                          key={d.fecha}
                          className="p-1.5 border-r border-[var(--border)] last:border-0 bg-red-50/60 dark:bg-red-950/20"
                        >
                          <div className="p-2 rounded-xl border border-red-500/30 bg-red-100/70 dark:bg-red-900/30 flex items-center justify-between text-red-700 dark:text-red-300">
                            <div className="flex items-center gap-1.5">
                              <Lock size={12} className="shrink-0" />
                              <span className="text-[10px] font-bold uppercase">{bloqueo.motivo}</span>
                            </div>
                            <button
                              onClick={() => onEliminarBloqueo(bloqueo.id)}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      )
                    }

                    if (turnoInicio) {
                      const pac = turnoInicio.pacientes || {}
                      const ojo = turnoInicio.ojo || 'OD'
                      const ojoBadge = ojo === 'OD' ? 'OD' : ojo === 'OI' ? 'OI' : 'AO'
                      const isFirmado = turnoInicio.consentimiento_estado === 'firmado_digital'
                      const isEnviado = turnoInicio.consentimiento_estado === 'enviado_whatsapp'
                      const duracion = turnoInicio.duracion_minutos || quirofanoActual?.duracion_slot_minutos || 20

                      return (
                        <td key={d.fecha} className="p-1.5 border-r border-[var(--border)] last:border-0">
                          <div
                            onClick={() => onTurnoClick(turnoInicio)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all shadow-sm hover:shadow-md ${
                              isFirmado
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-500'
                                : isEnviado
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 hover:border-amber-500'
                                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/40 hover:border-blue-500'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-[var(--foreground)] truncate">
                                {pac.nombre || 'Paciente'}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                {ojoBadge} ({duracion}m)
                              </span>
                            </div>

                            <p className="text-[10px] text-[var(--secondary)] truncate mt-0.5">
                              {turnoInicio.practica_nombre} • <span className="font-semibold">{turnoInicio.cirujano_nombre}</span>
                            </p>

                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-[var(--border)]/40 text-[9px]">
                              <span className="font-semibold text-slate-600 dark:text-slate-400">
                                {turnoInicio.obra_social || 'Particular'}
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
                                {isFirmado ? '🟢 Firmado' : isEnviado ? '🟡 WA' : '⚪ Pend'}
                              </span>
                            </div>
                          </div>
                        </td>
                      )
                    }

                    return (
                      <td
                        key={d.fecha}
                        onClick={() => onSlotClick(qId, horaSlot, d.fecha)}
                        className={`p-2 border-r border-[var(--border)] last:border-0 cursor-pointer transition-colors group ${
                          bloqueMed
                            ? 'bg-blue-500/5 hover:bg-blue-500/15'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="text-[9px] font-medium text-slate-300 dark:text-slate-700 group-hover:text-blue-600 transition-colors">
                          {bloqueMed ? `+ ${bloqueMed.medico_nombre.split(',')[0]}` : `+ ${horaSlot}`}
                        </span>
                      </td>
                    )
                  })
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
