'use client'

import React from 'react'
import { Lock, Users, FileCheck2, Send, Clock, User, Eye, UserCheck, Timer, CalendarX } from 'lucide-react'

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
  onSeleccionarQuirofano?: (quirofanoId: string) => void
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
  onEliminarBloqueo,
  onSeleccionarQuirofano
}: TurneroGridProps) {
  const quirofanoActual = quirofanos.find((q) => q.id === quirofanoSeleccionadoId) || quirofanos[0]

  // Hora y minuto actual para el indicador "Línea de Ahora" en tiempo real
  const [minutoActual, setMinutoActual] = React.useState<number>(() => {
    const ahora = new Date()
    return ahora.getHours() * 60 + ahora.getMinutes()
  })

  React.useEffect(() => {
    const timer = setInterval(() => {
      const ahora = new Date()
      setMinutoActual(ahora.getHours() * 60 + ahora.getMinutes())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const fechaHoyStr = new Date().toISOString().slice(0, 10)
  const esFechaHoy = fechaSeleccionada === fechaHoyStr

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
                const turnosSalaHoy = turnos.filter(
                  (t) => t.quirofano_id === q.id && t.fecha_cirugia === fechaSeleccionada && t.estado !== 'cancelado'
                )

                return (
                  <th key={q.id} className="p-3 text-xs font-bold text-[var(--foreground)] border-r border-[var(--border)] last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                        <span className="truncate">{q.nombre}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                          {q.codigo}
                        </span>
                        <span
                          className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                            turnosSalaHoy.length > 0
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                              : 'opacity-40 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {turnosSalaHoy.length} {turnosSalaHoy.length === 1 ? 'cirugía' : 'cirugías'}
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
                  (t) => t.quirofano_id === quirofanoActual?.id && t.fecha_cirugia === d.fecha && t.estado !== 'cancelado'
                )
                const turnosOtrasSalas = turnos.filter(
                  (t) => t.quirofano_id !== quirofanoActual?.id && t.fecha_cirugia === d.fecha && t.estado !== 'cancelado'
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
                    <div className="flex flex-col gap-1.5">
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
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[10px] font-mono opacity-80">{d.fecha.slice(5)}</p>
                            {turnosEsteDia.length > 0 && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {turnosEsteDia.length} {turnosEsteDia.length === 1 ? 'cirugía' : 'cirugías'}
                              </span>
                            )}
                          </div>
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

                      {/* Aviso interactivo si hay cirugías en OTRAS salas este mismo día */}
                      {turnosOtrasSalas.length > 0 && (
                        <div className="pt-1.5 border-t border-[var(--border)]/50 flex flex-wrap gap-1 items-center">
                          <span className="text-[8.5px] uppercase font-bold text-[var(--secondary)]">
                            En otra sala:
                          </span>
                          {quirofanos
                            .filter((q) => q.id !== quirofanoActual?.id && turnosOtrasSalas.some((t) => t.quirofano_id === q.id))
                            .map((otraQ) => {
                              const cantEnOtra = turnosOtrasSalas.filter((t) => t.quirofano_id === otraQ.id).length
                              return (
                                <button
                                  key={otraQ.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onSeleccionarQuirofano?.(otraQ.id)
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 transition-all border shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                                  style={{
                                    backgroundColor: `${otraQ.color || '#8b5cf6'}18`,
                                    borderColor: `${otraQ.color || '#8b5cf6'}40`,
                                    color: otraQ.color || '#8b5cf6'
                                  }}
                                  title={`Hay ${cantEnOtra} cirugía(s) agendada(s) en ${otraQ.nombre} el día ${d.fecha}. Haz clic para ver esa sala.`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: otraQ.color || '#8b5cf6' }} />
                                  <span>{cantEnOtra} en {otraQ.codigo || otraQ.nombre.slice(0, 10)} ↗</span>
                                </button>
                              )
                            })}
                        </div>
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
            const esSlotActual = esFechaHoy && minutoActual >= slotMin && minutoActual < slotMin + pasoMinutos

            return (
              <tr
                key={horaSlot}
                className={`border-b border-[var(--border)]/60 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors relative ${
                  esSlotActual ? 'bg-rose-500/[0.04] border-t-2 border-t-rose-500' : ''
                }`}
              >
                {/* Hora */}
                <td className={`p-2 text-center font-mono text-[11px] font-bold text-[var(--secondary)] bg-slate-50/50 dark:bg-slate-900/30 border-r border-[var(--border)] sticky left-0 z-10 relative ${
                  esSlotActual ? 'border-t-2 border-t-rose-500 text-rose-600 dark:text-rose-400' : ''
                }`}>
                  {esSlotActual && (
                    <div
                      className="absolute -top-[10px] left-1 z-30 flex items-center gap-1 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md pointer-events-none animate-pulse whitespace-nowrap"
                      title={`Hora actual: ${minutosAHora(minutoActual)} hs`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {minutosAHora(minutoActual)}
                    </div>
                  )}
                  {horaSlot}
                </td>

                {modo === 'dia' ? (
                  // VISTA DÍA
                  quirofanos.map((q) => {
                    const diasOp = q.dias_operativos || [1, 2, 3, 4, 5]
                    const estaOperativoHoy = diasOp.includes(numDiaHoy)
                    const permiteSimultaneos = Boolean(q.permite_simultaneos)
                    const capacidadMax = permiteSimultaneos ? Math.max(1, Number(q.capacidad_simultanea) || 3) : 1

                    const turnosInicio = turnos.filter(
                      (t) =>
                        t.quirofano_id === q.id &&
                        t.fecha_cirugia === fechaSeleccionada &&
                        (t.hora_inicio || '').slice(0, 5) === horaSlot &&
                        t.estado !== 'cancelado'
                    )

                    const turnosCubriendo = turnos.filter((t) => {
                      if (t.quirofano_id !== q.id || t.fecha_cirugia !== fechaSeleccionada || t.estado === 'cancelado') return false
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

                    if (!estaOperativoHoy && turnosInicio.length === 0 && turnosCubriendo.length === 0 && !bloqueo) {
                      return (
                        <td
                          key={q.id}
                          className="p-1 border-r border-[var(--border)] last:border-0 bg-slate-100/50 dark:bg-slate-900/20 select-none opacity-40 text-center"
                        >
                          <span className="text-[9px] text-slate-400 italic">No operativo</span>
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

                    if (turnosInicio.length > 0) {
                      return (
                        <td key={q.id} className="p-1.5 border-r border-[var(--border)] last:border-0 align-top">
                          <div className="space-y-1.5">
                            {permiteSimultaneos && turnosInicio.length > 1 && (
                              <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold text-amber-600 dark:text-amber-300">
                                <span className="flex items-center gap-1">
                                  <Users size={10} /> {turnosInicio.length}/{capacidadMax} simultáneos
                                </span>
                              </div>
                            )}

                            {turnosInicio.map((tItem: any) => {
                              const pac = tItem.pacientes || {}
                              const ojo = tItem.ojo || 'OD'
                              const ojoBadge = ojo === 'OD' ? 'Ojo Der' : ojo === 'OI' ? 'Ojo Izq' : 'Ambos'
                              const isFirmado = tItem.consentimiento_estado === 'firmado_digital'
                              const isEnviado = tItem.consentimiento_estado === 'enviado_whatsapp'
                              const duracion = tItem.duracion_minutos || q.duracion_slot_minutos || 20

                              return (
                                <div
                                  key={tItem.id}
                                  onClick={() => onTurnoClick(tItem)}
                                  className={`p-2 rounded-xl border cursor-pointer transition-all shadow-xs hover:shadow-md ${
                                    isFirmado
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-500'
                                      : isEnviado
                                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 hover:border-amber-500'
                                      : 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/40 hover:border-blue-500'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11.5px] font-bold text-[var(--foreground)] truncate">
                                      {pac.nombre || 'Paciente'}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                        {ojoBadge}
                                      </span>
                                      <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-1 py-0.2 rounded">
                                        {duracion}m
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-[10px] text-[var(--secondary)] truncate mt-0.5">
                                    {tItem.practica_nombre} • <span className="font-semibold">{tItem.cirujano_nombre}</span>
                                  </p>

                                  <div className="flex items-center justify-between mt-1 pt-0.5 border-t border-[var(--border)]/40 text-[9.5px]">
                                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                                      {tItem.obra_social || 'Particular'}
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
                                          <FileCheck2 size={10} /> Firmado
                                        </>
                                      ) : isEnviado ? (
                                        <>
                                          <Send size={10} /> WA Enviado
                                        </>
                                      ) : (
                                        'Pendiente WA'
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}

                            {permiteSimultaneos && turnosInicio.length < capacidadMax && (
                              <button
                                type="button"
                                onClick={() => onSlotClick(q.id, horaSlot, fechaSeleccionada)}
                                className="w-full py-1 px-1.5 rounded-lg border border-dashed border-amber-500/40 hover:bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[9.5px] font-bold transition-all text-center flex items-center justify-center gap-1"
                              >
                                <span>+ Sumar Paciente ({turnosInicio.length}/{capacidadMax})</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    }

                    if (turnosCubriendo.length > 0 && (!permiteSimultaneos || turnosCubriendo.length >= capacidadMax)) {
                      return (
                        <td
                          key={q.id}
                          className="p-1 border-r border-[var(--border)] last:border-0 bg-blue-50/20 dark:bg-blue-950/10 border-dashed"
                        >
                          <div className="h-5 flex items-center justify-center">
                            <span className="text-[9px] font-mono text-blue-400 opacity-60">
                              ▲ Ocupado ({turnosCubriendo[0].practica_nombre?.slice(0, 18)}...)
                            </span>
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
                    const permiteSimultaneos = Boolean(quirofanoActual?.permite_simultaneos)
                    const capacidadMax = permiteSimultaneos ? Math.max(1, Number(quirofanoActual?.capacidad_simultanea) || 3) : 1

                    const turnosInicio = turnos.filter(
                      (t) =>
                        t.quirofano_id === qId &&
                        t.fecha_cirugia === d.fecha &&
                        (t.hora_inicio || '').slice(0, 5) === horaSlot &&
                        t.estado !== 'cancelado'
                    )

                    const turnosCubriendo = turnos.filter((t) => {
                      if (t.quirofano_id !== qId || t.fecha_cirugia !== d.fecha || t.estado === 'cancelado') return false
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
                    if (!estaOperativoEsteDia && turnosInicio.length === 0 && turnosCubriendo.length === 0 && !bloqueo) {
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

                    if (turnosInicio.length > 0) {
                      return (
                        <td key={d.fecha} className="p-1.5 border-r border-[var(--border)] last:border-0 align-top">
                          <div className="space-y-1.5">
                            {permiteSimultaneos && turnosInicio.length > 1 && (
                              <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold text-amber-600 dark:text-amber-300">
                                <span className="flex items-center gap-1">
                                  <Users size={10} /> {turnosInicio.length}/{capacidadMax} simultáneos
                                </span>
                              </div>
                            )}

                            {turnosInicio.map((tItem: any) => {
                              const pac = tItem.pacientes || {}
                              const ojo = tItem.ojo || 'OD'
                              const ojoBadge = ojo === 'OD' ? 'OD' : ojo === 'OI' ? 'OI' : 'AO'
                              const isFirmado = tItem.consentimiento_estado === 'firmado_digital'
                              const isEnviado = tItem.consentimiento_estado === 'enviado_whatsapp'
                              const duracion = tItem.duracion_minutos || quirofanoActual?.duracion_slot_minutos || 20

                              return (
                                <div
                                  key={tItem.id}
                                  onClick={() => onTurnoClick(tItem)}
                                  className={`p-2 rounded-xl border cursor-pointer transition-all shadow-xs hover:shadow-md ${
                                    isFirmado
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-500'
                                      : isEnviado
                                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/40 hover:border-amber-500'
                                      : 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/40 hover:border-blue-500'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-bold text-[var(--foreground)] truncate">
                                      {pac.nombre || 'Paciente'}
                                    </span>
                                    <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                      {ojoBadge} ({duracion}m)
                                    </span>
                                  </div>

                                  <p className="text-[9.5px] text-[var(--secondary)] truncate mt-0.5">
                                    {tItem.practica_nombre} • <span className="font-semibold">{tItem.cirujano_nombre}</span>
                                  </p>

                                  <div className="flex items-center justify-between mt-1 pt-0.5 border-t border-[var(--border)]/40 text-[9px]">
                                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                                      {tItem.obra_social || 'Particular'}
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
                              )
                            })}

                            {permiteSimultaneos && turnosInicio.length < capacidadMax && (
                              <button
                                type="button"
                                onClick={() => onSlotClick(qId, horaSlot, d.fecha)}
                                className="w-full py-1 px-1.5 rounded-lg border border-dashed border-amber-500/40 hover:bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[9px] font-bold transition-all text-center flex items-center justify-center gap-1"
                              >
                                <span>+ Sumar Paciente ({turnosInicio.length}/{capacidadMax})</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    }

                    if (turnosCubriendo.length > 0 && (!permiteSimultaneos || turnosCubriendo.length >= capacidadMax)) {
                      return (
                        <td
                          key={d.fecha}
                          className="p-1 border-r border-[var(--border)] last:border-0 bg-blue-50/20 dark:bg-blue-950/10 border-dashed"
                        >
                          <div className="h-5 flex items-center justify-center">
                            <span className="text-[9px] font-mono text-blue-400 opacity-60">
                              ▲ Ocupado ({turnosCubriendo[0].practica_nombre?.slice(0, 15)}...)
                            </span>
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
