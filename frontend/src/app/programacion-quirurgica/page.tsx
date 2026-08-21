'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Lock,
  FileCheck2,
  Send,
  Loader2,
  Building2,
  CalendarDays,
  Clock,
  Sparkles,
  User,
  Scissors,
  CheckCircle2,
  X,
  Check
} from 'lucide-react'
import TurneroGrid from '@/components/quirofano/TurneroGrid'
import FichaTurnoModal from '@/components/quirofano/FichaTurnoModal'
import { BACKEND_URL } from '@/lib/api'

function ProgramacionQuirurgicaContent() {
  const searchParams = useSearchParams()
  const paramAsesoriaId = searchParams.get('asesoria_id') || ''
  const paramPacienteId = searchParams.get('paciente_id') || ''

  const [modoVista, setModoVista] = useState<'dia' | 'semana'>('semana')
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().slice(0, 10))
  const [quirofanoSeleccionadoId, setQuirofanoSeleccionadoId] = useState<string>('')

  const [quirofanos, setQuirofanos] = useState<any[]>([])
  const [turnos, setTurnos] = useState<any[]>([])
  const [bloqueos, setBloqueos] = useState<any[]>([])
  const [bloquesMedicos, setBloquesMedicos] = useState<any[]>([])
  const [casosConfirmados, setCasosConfirmados] = useState<any[]>([])

  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<any | null>(null)
  const [casoConfirmadoSeleccionado, setCasoConfirmadoSeleccionado] = useState<any | null>(null)
  const [slotClickData, setSlotClickData] = useState<{ quirofanoId: string; hora: string; fecha?: string } | null>(null)

  // Panel lateral de casos confirmados pendientes
  const [drawerCasosAbierto, setDrawerCasosAbierto] = useState(false)

  // Cálculo de fechas de la semana (Lunes a Domingo)
  const calcularDiasSemana = (fechaBaseStr: string) => {
    const base = new Date(fechaBaseStr + 'T12:00:00')
    const day = base.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day

    const monday = new Date(base)
    monday.setDate(base.getDate() + diffToMonday)

    const nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const hoyStr = new Date().toISOString().slice(0, 10)

    const dias = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const fechaIso = d.toISOString().slice(0, 10)
      dias.push({
        fecha: fechaIso,
        nombreDia: nombresDias[i],
        numeroDia: i + 1,
        esHoy: fechaIso === hoyStr
      })
    }
    return dias
  }

  const diasSemana = calcularDiasSemana(fechaSeleccionada)
  const fechaDesdeSemana = diasSemana[0].fecha
  const fechaHastaSemana = diasSemana[6].fecha

  const fetchDatos = async () => {
    try {
      setCargando(true)

      const fDesde = modoVista === 'dia' ? fechaSeleccionada : fechaDesdeSemana
      const fHasta = modoVista === 'dia' ? fechaSeleccionada : fechaHastaSemana

      const [resQ, resT, resB, resBM, resCasos, resPipe] = await Promise.all([
        fetch(`${BACKEND_URL}/api/quirofanos?solo_activos=true`),
        fetch(`${BACKEND_URL}/api/turnos-quirofano?fecha_desde=${fDesde}&fecha_hasta=${fHasta}`),
        fetch(`${BACKEND_URL}/api/quirofano-bloqueos?fecha_desde=${fDesde}&fecha_hasta=${fHasta}`),
        fetch(`${BACKEND_URL}/api/quirofanos/bloques-medicos`),
        fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/pendientes-quirofano`),
        fetch(`${BACKEND_URL}/api/pipeline-quirurgico`)
      ])

      const dataQ = await resQ.json()
      const dataT = await resT.json()
      const dataB = await resB.json()
      const dataBM = await resBM.json()
      const dataCasos = await resCasos.json()
      const dataPipe = await resPipe.json()

      if (dataQ.success) {
        setQuirofanos(dataQ.quirofanos || [])
        if (dataQ.quirofanos.length > 0 && !quirofanoSeleccionadoId) {
          setQuirofanoSeleccionadoId(dataQ.quirofanos[0].id)
        }
      }
      if (dataT.success) setTurnos(dataT.turnos || [])
      if (dataB.success) setBloqueos(dataB.bloqueos || [])
      if (dataBM.success) setBloquesMedicos(dataBM.bloques || [])

      let listaConfirmados: any[] = []
      if (dataCasos.success && Array.isArray(dataCasos.casos) && dataCasos.casos.length > 0) {
        listaConfirmados = dataCasos.casos
      } else if (dataPipe.success && dataPipe.etapas?.confirmado) {
        listaConfirmados = dataPipe.etapas.confirmado
      }
      setCasosConfirmados(listaConfirmados)

      // Si viene por parámetro de URL con asesoria_id, abrir directamente el modal
      if (paramAsesoriaId && !modalAbierto) {
        const caso = listaConfirmados.find((c) => c.id === paramAsesoriaId)
        if (caso) {
          setCasoConfirmadoSeleccionado(caso)
          setModalAbierto(true)
        } else {
          setModalAbierto(true)
        }
      }
    } catch (err) {
      console.error('Error cargando turnero quirúrgico:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchDatos()
  }, [fechaSeleccionada, modoVista, quirofanoSeleccionadoId, paramAsesoriaId])

  const cambiarSemana = (delta: number) => {
    const base = new Date(fechaSeleccionada + 'T12:00:00')
    base.setDate(base.getDate() + delta * 7)
    setFechaSeleccionada(base.toISOString().slice(0, 10))
  }

  const cambiarDia = (delta: number) => {
    const base = new Date(fechaSeleccionada + 'T12:00:00')
    base.setDate(base.getDate() + delta)
    setFechaSeleccionada(base.toISOString().slice(0, 10))
  }

  const handleSlotClick = (quirofanoId: string, hora: string, fecha?: string) => {
    setSlotClickData({ quirofanoId, hora, fecha: fecha || fechaSeleccionada })
    setTurnoSeleccionado(null)
    setCasoConfirmadoSeleccionado(null)
    setModalAbierto(true)
  }

  const handleTurnoClick = (turno: any) => {
    setTurnoSeleccionado(turno)
    setCasoConfirmadoSeleccionado(null)
    setSlotClickData(null)
    setModalAbierto(true)
  }

  const handleAgendarCasoConfirmado = (caso: any) => {
    setCasoConfirmadoSeleccionado(caso)
    setTurnoSeleccionado(null)
    setSlotClickData(null)
    setDrawerCasosAbierto(false)
    setModalAbierto(true)
  }

  const handleEliminarBloqueo = async (bloqueoId: string) => {
    if (!confirm('¿Desea desbloquear este horario de quirófano?')) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/quirofano-bloqueos/${bloqueoId}`, { method: 'DELETE' })
      if (res.ok) fetchDatos()
    } catch (err) {
      console.error('Error al eliminar bloqueo:', err)
    }
  }

  const quirofanoActual = quirofanos.find((q) => q.id === quirofanoSeleccionadoId) || quirofanos[0]

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <Building2 className="text-blue-600" size={28} />
            <span>Programación y Planificación de Quirófano</span>
          </h1>
          <p className="text-xs md:text-sm text-[var(--secondary)] mt-1">
            Coordinación eficiente de cirugías confirmadas, ocupación dinámica de salas y sincronización continua.
          </p>
        </div>

        {/* Botones de Acción y Bandeja de Confirmados */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón Bandeja de Casos Confirmados */}
          <button
            onClick={() => setDrawerCasosAbierto(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-sm hover:bg-blue-100 transition-all"
          >
            <Sparkles size={16} className="text-blue-600 animate-bounce" />
            <span>Casos Confirmados</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono text-[11px]">
              {casosConfirmados.length}
            </span>
          </button>

          {/* Toggle Vista Día / Semana */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setModoVista('dia')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                modoVista === 'dia'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <CalendarIcon size={14} />
              <span>Vista Día</span>
            </button>
            <button
              onClick={() => setModoVista('semana')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                modoVista === 'semana'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <CalendarDays size={14} />
              <span>Vista Semanal (L-D)</span>
            </button>
          </div>

          <button
            onClick={() => {
              setTurnoSeleccionado(null)
              setCasoConfirmadoSeleccionado(null)
              setSlotClickData(null)
              setModalAbierto(true)
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all"
          >
            <Plus size={16} />
            <span>Nuevo Turno</span>
          </button>
        </div>
      </div>

      {/* Selector de Quirófano (Pestañas cuando está en Vista Semanal) */}
      {modoVista === 'semana' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-[var(--secondary)] shrink-0 mr-1 flex items-center gap-1">
            <Building2 size={14} /> Quirófano Activo:
          </span>
          {quirofanos.map((q) => {
            const isSelected = q.id === quirofanoActual?.id
            return (
              <button
                key={q.id}
                onClick={() => setQuirofanoSeleccionadoId(q.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                  isSelected
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-500 shadow-sm'
                    : 'bg-slate-100/60 dark:bg-slate-900/40 text-[var(--secondary)] border-transparent hover:bg-slate-200'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                <span>{q.nombre}</span>
                <span className="text-[10px] font-mono opacity-80 font-normal">({q.duracion_slot_minutos || 15}m)</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Barra de Navegación de Fecha / Semana */}
      <div className="p-3.5 bg-[var(--card)] rounded-2xl border border-[var(--border)] flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (modoVista === 'dia' ? cambiarDia(-1) : cambiarSemana(-1))}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={modoVista === 'dia' ? 'Día anterior' : 'Semana anterior'}
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={() => setFechaSeleccionada(new Date().toISOString().slice(0, 10))}
            className="px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Hoy
          </button>

          <button
            onClick={() => (modoVista === 'dia' ? cambiarDia(1) : cambiarSemana(1))}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={modoVista === 'dia' ? 'Día siguiente' : 'Semana siguiente'}
          >
            <ChevronRight size={16} />
          </button>

          <div className="ml-2 flex items-center gap-2">
            <CalendarIcon size={16} className="text-blue-600" />
            <span className="text-xs font-bold text-[var(--foreground)]">
              {modoVista === 'dia'
                ? `Día: ${fechaSeleccionada}`
                : `Semana: ${fechaDesdeSemana} al ${fechaHastaSemana}`}
            </span>
          </div>
        </div>

        {/* Input Selector de Fecha */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-[var(--secondary)]">Ir a Fecha:</label>
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* GRILLA DEL TURNERO */}
      {cargando ? (
        <div className="p-16 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex flex-col items-center justify-center gap-3 min-h-[400px]">
          <Loader2 className="animate-spin text-blue-600" size={36} />
          <p className="text-xs font-medium text-[var(--secondary)]">Cargando grilla quirúrgica y ocupación de salas...</p>
        </div>
      ) : (
        <TurneroGrid
          modo={modoVista}
          quirofanos={quirofanos}
          quirofanoSeleccionadoId={quirofanoSeleccionadoId}
          turnos={turnos}
          bloqueos={bloqueos}
          bloquesMedicos={bloquesMedicos}
          fechaSeleccionada={fechaSeleccionada}
          diasSemana={diasSemana}
          onSlotClick={handleSlotClick}
          onTurnoClick={handleTurnoClick}
          onEliminarBloqueo={handleEliminarBloqueo}
        />
      )}

      {/* DRAWER / SLIDE-OVER: BANDEJA DE CASOS CONFIRMADOS DESDE ASESORAMIENTO */}
      {drawerCasosAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--card)] border-l border-[var(--border)] w-full max-w-md h-full flex flex-col shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  Casos Confirmados en Asesoramiento ({casosConfirmados.length})
                </h3>
              </div>
              <button
                onClick={() => setDrawerCasosAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--secondary)]">
              Pacientes que ya confirmaron su cirugía y están listos para ser agendados en el turnero de quirófano.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {casosConfirmados.length === 0 ? (
                <p className="text-xs text-[var(--secondary)] italic py-8 text-center">
                  No hay cirugías confirmadas pendientes por el momento.
                </p>
              ) : (
                casosConfirmados.map((c) => {
                  const pac = c.pacientes || {}
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/40 space-y-2 hover:border-blue-500/50 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[var(--foreground)]">{pac.nombre || 'Paciente'}</p>
                          <p className="text-[11px] text-[var(--secondary)] font-mono">DNI: {pac.dni || 'S/D'}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold uppercase">
                          Confirmado
                        </span>
                      </div>

                      <div className="text-[11px] space-y-0.5 text-[var(--secondary)]">
                        <p className="font-medium text-[var(--foreground)] truncate">🔪 {c.practica_nombre}</p>
                        <p>👨‍⚕️ Cirujano: <span className="font-semibold">{c.medico_cirujano_nombre || 'A designar'}</span></p>
                        {c.cobertura_obra_social && (
                          <p>🛡 Obra Social: {c.cobertura_obra_social}</p>
                        )}
                        {c.fecha_probable_cirugia && (
                          <p className="font-mono text-blue-600">🗓 Fecha pactada: {c.fecha_probable_cirugia}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAgendarCasoConfirmado(c)}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all"
                      >
                        <Plus size={14} />
                        <span>Agendar en Quirófano</span>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FICHA DE TURNO / AGENDAMIENTO */}
      {modalAbierto && (
        <FichaTurnoModal
          turno={turnoSeleccionado}
          asesoriaIdInicial={paramAsesoriaId}
          pacienteIdInicial={paramPacienteId}
          casoConfirmadoInicial={casoConfirmadoSeleccionado}
          quirofanos={quirofanos}
          quirofanoDefectoId={slotClickData?.quirofanoId || quirofanoSeleccionadoId}
          fechaDefecto={slotClickData?.fecha || fechaSeleccionada}
          horaDefecto={slotClickData?.hora || '08:30'}
          onClose={() => {
            setModalAbierto(false)
            setTurnoSeleccionado(null)
            setCasoConfirmadoSeleccionado(null)
            setSlotClickData(null)
          }}
          onSaved={fetchDatos}
        />
      )}
    </div>
  )
}

export default function ProgramacionQuirurgicaPage() {
  return (
    <Suspense fallback={
      <div className="p-16 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600" size={36} />
      </div>
    }>
      <ProgramacionQuirurgicaContent />
    </Suspense>
  )
}
