'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  FileCheck2,
  Send,
  Users,
  Activity,
  Sparkles,
  CalendarDays,
  CalendarRange,
  Building2
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import TurneroGrid from '@/components/quirofano/TurneroGrid'
import FichaTurnoModal from '@/components/quirofano/FichaTurnoModal'
import BloqueoModal from '@/components/quirofano/BloqueoModal'

const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Obtener Lunes de la semana dada
const getLunesSemana = (fechaStr: string) => {
  const d = new Date(fechaStr + 'T12:00:00')
  const day = d.getDay() // 0 es domingo, 1 es lunes...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const lunes = new Date(d.setDate(diff))
  return lunes.toISOString().split('T')[0]
}

export default function ProgramacionQuirurgicaPage() {
  const searchParams = useSearchParams()
  const asesoriaIdParam = searchParams.get('asesoria_id')
  const pacienteIdParam = searchParams.get('paciente_id')

  // Modo de visualización: 'dia' o 'semana'
  const [modoVista, setModoVista] = useState<'dia' | 'semana'>('semana')

  // Fecha de referencia (en modo día es el día; en modo semana es el lunes de esa semana)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  )

  // Quirófano seleccionado para la vista semanal
  const [quirofanoSeleccionadoId, setQuirofanoSeleccionadoId] = useState<string>('')

  const [quirofanos, setQuirofanos] = useState<any[]>([])
  const [turnos, setTurnos] = useState<any[]>([])
  const [bloqueos, setBloqueos] = useState<any[]>([])
  const [bloquesMedicos, setBloquesMedicos] = useState<any[]>([])
  const [duracionesConfig, setDuracionesConfig] = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(true)

  // Modales
  const [modalTurnoAbierto, setModalTurnoAbierto] = useState(false)
  const [turnoIdEditar, setTurnoIdEditar] = useState<string | null>(null)
  const [initialTurnoData, setInitialTurnoData] = useState<any>(null)
  const [modalBloqueoAbierto, setModalBloqueoAbierto] = useState(false)

  // Calcular rango de fechas para consultar a la API
  const { fechaDesde, fechaHasta, diasSemanaCalculados } = useMemo(() => {
    if (modoVista === 'dia') {
      return {
        fechaDesde: fechaSeleccionada,
        fechaHasta: fechaSeleccionada,
        diasSemanaCalculados: []
      }
    }

    // Modo Semana: 7 días desde el Lunes
    const lunesStr = getLunesSemana(fechaSeleccionada)
    const dias = []
    const hoyStr = new Date().toISOString().split('T')[0]

    for (let i = 0; i < 7; i++) {
      const d = new Date(lunesStr + 'T12:00:00')
      d.setDate(d.getDate() + i)
      const fStr = d.toISOString().split('T')[0]
      const numDia = i === 6 ? 7 : i + 1 // 1=Lun, 7=Dom
      dias.push({
        fecha: fStr,
        nombreDia: NOMBRES_DIAS[d.getDay()],
        numeroDia: numDia,
        esHoy: fStr === hoyStr
      })
    }

    return {
      fechaDesde: dias[0].fecha,
      fechaHasta: dias[6].fecha,
      diasSemanaCalculados: dias
    }
  }, [modoVista, fechaSeleccionada])

  // Cargar datos
  const cargarDatos = async () => {
    try {
      setCargando(true)
      const [resSalas, resTurnos, resBloqueos, resBloquesMed, resConf] = await Promise.all([
        fetch(`${BACKEND_URL}/api/quirofanos?solo_activos=true`),
        fetch(`${BACKEND_URL}/api/turnos-quirofano?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`),
        fetch(`${BACKEND_URL}/api/quirofano-bloqueos?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`),
        fetch(`${BACKEND_URL}/api/quirofanos/bloques-medicos`),
        fetch(`${BACKEND_URL}/api/configuracion-quirofano`)
      ])

      const dataSalas = await resSalas.json()
      const dataTurnos = await resTurnos.json()
      const dataBloqueos = await resBloqueos.json()
      const dataBloquesMed = await resBloquesMed.json()
      const dataConf = await resConf.json()

      if (dataSalas.success && dataSalas.quirofanos) {
        setQuirofanos(dataSalas.quirofanos)
        if (!quirofanoSeleccionadoId && dataSalas.quirofanos.length > 0) {
          setQuirofanoSeleccionadoId(dataSalas.quirofanos[0].id)
        }
      }
      if (dataTurnos.success) setTurnos(dataTurnos.turnos || [])
      if (dataBloqueos.success) setBloqueos(dataBloqueos.bloqueos || [])
      if (dataBloquesMed.success) setBloquesMedicos(dataBloquesMed.bloques || [])
      if (dataConf.success && dataConf.configuracion) {
        setDuracionesConfig(dataConf.configuracion.duraciones_prestaciones || {})
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [fechaDesde, fechaHasta])

  // Traspaso automático desde Asesoría Quirúrgica (?asesoria_id=...)
  useEffect(() => {
    if (asesoriaIdParam && pacienteIdParam) {
      setInitialTurnoData({
        asesoria_id: asesoriaIdParam,
        paciente_id: pacienteIdParam,
        fecha_cirugia: fechaSeleccionada,
        hora_inicio: '09:00'
      })
      setTurnoIdEditar(null)
      setModalTurnoAbierto(true)
    }
  }, [asesoriaIdParam, pacienteIdParam])

  // Navegación de Fecha / Semana
  const handleCambiarPeriodo = (delta: number) => {
    const d = new Date(fechaSeleccionada + 'T12:00:00')
    const diasASumar = modoVista === 'dia' ? delta : delta * 7
    d.setDate(d.getDate() + diasASumar)
    setFechaSeleccionada(d.toISOString().split('T')[0])
  }

  const handleSlotClick = (quirofanoId: string, hora: string, fecha?: string) => {
    setInitialTurnoData({
      quirofano_id: quirofanoId || quirofanoSeleccionadoId,
      fecha_cirugia: fecha || fechaSeleccionada,
      hora_inicio: hora
    })
    setTurnoIdEditar(null)
    setModalTurnoAbierto(true)
  }

  const handleTurnoClick = (t: any) => {
    setTurnoIdEditar(t.id)
    setInitialTurnoData(null)
    setModalTurnoAbierto(true)
  }

  const handleEliminarBloqueo = async (bloqueoId: string) => {
    if (!confirm('¿Desea desbloquear este horario de quirófano?')) return
    try {
      await fetch(`${BACKEND_URL}/api/quirofano-bloqueos/${bloqueoId}`, { method: 'DELETE' })
      cargarDatos()
    } catch (e) {
      console.error(e)
    }
  }

  // Métricas del periodo
  const totalCirugias = turnos.length
  const firmadosCount = turnos.filter((t) => t.consentimiento_estado === 'firmado_digital').length
  const enviadosCount = turnos.filter((t) => t.consentimiento_estado === 'enviado_whatsapp').length

  const quirofanoActivo = quirofanos.find((q) => q.id === quirofanoSeleccionadoId) || quirofanos[0]

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-5 md:p-6 space-y-5 min-w-0 animate-fade-in pb-12">
      {/* Header & Navegación */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock size={24} className="text-blue-600" />
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              Planificación & Turnero de Quirófano
            </h1>
          </div>
          <p className="text-xs text-[var(--secondary)] mt-0.5">
            Ocupación dinámica de tiempo según práctica, asignación de salas y consentimiento digital por WhatsApp.
          </p>
        </div>

        {/* Controles de Vista & Navegación */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Modo Día / Modo Semana */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-[var(--border)]">
            <button
              onClick={() => setModoVista('dia')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modoVista === 'dia'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow border border-[var(--border)]'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <CalendarDays size={14} />
              <span>Vista Día</span>
            </button>

            <button
              onClick={() => setModoVista('semana')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modoVista === 'semana'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow border border-[var(--border)]'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <CalendarRange size={14} />
              <span>Vista Semanal (L-D)</span>
            </button>
          </div>

          {/* Navegador de Fecha / Semana */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => handleCambiarPeriodo(-1)}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-[var(--secondary)] hover:text-[var(--foreground)] transition-all"
              title={modoVista === 'dia' ? 'Día anterior' : 'Semana anterior'}
            >
              <ChevronLeft size={18} />
            </button>

            {modoVista === 'dia' ? (
              <input
                type="date"
                value={fechaSeleccionada}
                onChange={(e) => setFechaSeleccionada(e.target.value)}
                className="px-3 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
              />
            ) : (
              <span className="text-xs font-bold text-[var(--foreground)] px-2 font-mono">
                Semana: {diasSemanaCalculados[0]?.fecha.slice(5)} al {diasSemanaCalculados[6]?.fecha.slice(5)}
              </span>
            )}

            <button
              onClick={() => handleCambiarPeriodo(1)}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-[var(--secondary)] hover:text-[var(--foreground)] transition-all"
              title={modoVista === 'dia' ? 'Día siguiente' : 'Semana siguiente'}
            >
              <ChevronRight size={18} />
            </button>

            <button
              onClick={() => setFechaSeleccionada(new Date().toISOString().split('T')[0])}
              className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
            >
              Hoy
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Quirófano en Vista Semanal */}
      {modoVista === 'semana' && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm">
          <span className="text-xs font-bold text-[var(--secondary)] px-2 flex items-center gap-1.5">
            <Building2 size={15} className="text-blue-600" />
            <span>Seleccionar Quirófano:</span>
          </span>

          {quirofanos.map((q) => {
            const isSelected = (quirofanoSeleccionadoId || quirofanos[0]?.id) === q.id
            return (
              <button
                key={q.id}
                onClick={() => setQuirofanoSeleccionadoId(q.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: isSelected ? '#FFFFFF' : q.color }}
                />
                <span>{q.nombre}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                    isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {q.codigo}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* KPI Cards & Acciones */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[var(--secondary)]">
              Cirugías {modoVista === 'dia' ? 'Hoy' : 'en la Semana'}
            </p>
            <p className="text-lg font-bold text-blue-600">{totalCirugias}</p>
          </div>
          <Activity size={20} className="text-blue-500 opacity-60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[var(--secondary)]">Consentimientos Firmados</p>
            <p className="text-lg font-bold text-emerald-600">{firmadosCount}</p>
          </div>
          <FileCheck2 size={20} className="text-emerald-500 opacity-60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[var(--secondary)]">Enviados x WhatsApp</p>
            <p className="text-lg font-bold text-amber-600">{enviadosCount}</p>
          </div>
          <Send size={20} className="text-amber-500 opacity-60" />
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setInitialTurnoData({
                quirofano_id: quirofanoSeleccionadoId || quirofanos[0]?.id,
                fecha_cirugia: fechaSeleccionada,
                hora_inicio: '08:30'
              })
              setTurnoIdEditar(null)
              setModalTurnoAbierto(true)
            }}
            className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all"
          >
            <Plus size={16} />
            <span>Nuevo Turno</span>
          </button>
          <button
            onClick={() => setModalBloqueoAbierto(true)}
            className="px-3 flex flex-col items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-100 transition-all"
            title="Bloquear Horario"
          >
            <Lock size={15} />
            <span className="text-[10px]">Bloquear</span>
          </button>
        </div>
      </div>

      {/* Grid del Turnero (Día o Semana) */}
      <TurneroGrid
        modo={modoVista}
        quirofanos={quirofanos}
        quirofanoSeleccionadoId={quirofanoSeleccionadoId || quirofanos[0]?.id}
        turnos={turnos}
        bloqueos={bloqueos}
        bloquesMedicos={bloquesMedicos}
        fechaSeleccionada={fechaSeleccionada}
        diasSemana={diasSemanaCalculados}
        onSlotClick={handleSlotClick}
        onTurnoClick={handleTurnoClick}
        onEliminarBloqueo={handleEliminarBloqueo}
      />

      {/* Modal Ficha de Turno */}
      <FichaTurnoModal
        isOpen={modalTurnoAbierto}
        onClose={() => setModalTurnoAbierto(false)}
        turnoId={turnoIdEditar}
        initialData={initialTurnoData}
        quirofanos={quirofanos}
        duracionesConfig={duracionesConfig}
        onSaved={cargarDatos}
      />

      {/* Modal Bloqueo */}
      <BloqueoModal
        isOpen={modalBloqueoAbierto}
        onClose={() => setModalBloqueoAbierto(false)}
        quirofanos={quirofanos}
        fechaSeleccionada={fechaSeleccionada}
        onSaved={cargarDatos}
      />
    </div>
  )
}
