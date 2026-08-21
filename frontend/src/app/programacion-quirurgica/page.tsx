'use client'

import React, { useState, useEffect } from 'react'
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
  Sparkles
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import TurneroGrid from '@/components/quirofano/TurneroGrid'
import FichaTurnoModal from '@/components/quirofano/FichaTurnoModal'
import BloqueoModal from '@/components/quirofano/BloqueoModal'

export default function ProgramacionQuirurgicaPage() {
  const searchParams = useSearchParams()
  const asesoriaIdParam = searchParams.get('asesoria_id')
  const pacienteIdParam = searchParams.get('paciente_id')

  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [quirofanos, setQuirofanos] = useState<any[]>([])
  const [turnos, setTurnos] = useState<any[]>([])
  const [bloqueos, setBloqueos] = useState<any[]>([])
  const [duracionesConfig, setDuracionesConfig] = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(true)

  // Filtros
  const [filtroQuirofano, setFiltroQuirofano] = useState<string>('all')
  const [filtroCirujano, setFiltroCirujano] = useState<string>('all')

  // Modales
  const [modalTurnoAbierto, setModalTurnoAbierto] = useState(false)
  const [turnoIdEditar, setTurnoIdEditar] = useState<string | null>(null)
  const [initialTurnoData, setInitialTurnoData] = useState<any>(null)
  const [modalBloqueoAbierto, setModalBloqueoAbierto] = useState(false)

  // Cargar datos
  const cargarDatos = async () => {
    try {
      setCargando(true)
      const [resSalas, resTurnos, resBloqueos, resConf] = await Promise.all([
        fetch(`${BACKEND_URL}/api/quirofanos?solo_activos=true`),
        fetch(`${BACKEND_URL}/api/turnos-quirofano?fecha_desde=${fechaSeleccionada}&fecha_hasta=${fechaSeleccionada}`),
        fetch(`${BACKEND_URL}/api/quirofano-bloqueos?fecha_desde=${fechaSeleccionada}&fecha_hasta=${fechaSeleccionada}`),
        fetch(`${BACKEND_URL}/api/configuracion-quirofano`)
      ])

      const dataSalas = await resSalas.json()
      const dataTurnos = await resTurnos.json()
      const dataBloqueos = await resBloqueos.json()
      const dataConf = await resConf.json()

      if (dataSalas.success) setQuirofanos(dataSalas.quirofanos || [])
      if (dataTurnos.success) setTurnos(dataTurnos.turnos || [])
      if (dataBloqueos.success) setBloqueos(dataBloqueos.bloqueos || [])
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
  }, [fechaSeleccionada])

  // Traspaso automático si viene desde Asesoría Quirúrgica (?asesoria_id=...)
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

  // Navegación de Fecha
  const handleCambiarDia = (delta: number) => {
    const d = new Date(fechaSeleccionada + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setFechaSeleccionada(d.toISOString().split('T')[0])
  }

  const handleSlotClick = (quirofanoId: string, hora: string) => {
    setInitialTurnoData({
      quirofano_id: quirofanoId,
      fecha_cirugia: fechaSeleccionada,
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

  // Métricas rápidas del día
  const totalCirugias = turnos.length
  const firmadosCount = turnos.filter((t) => t.consentimiento_estado === 'firmado_digital').length
  const enviadosCount = turnos.filter((t) => t.consentimiento_estado === 'enviado_whatsapp').length

  const quirofanosFiltrados = quirofanos.filter((q) =>
    filtroQuirofano === 'all' ? true : q.id === filtroQuirofano
  )

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-5 md:p-6 space-y-5 min-w-0 animate-fade-in pb-12">
      {/* Header & Navegación de Fecha */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock size={24} className="text-blue-600" />
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              Planificación & Turnero de Quirófano
            </h1>
          </div>
          <p className="text-xs text-[var(--secondary)] mt-0.5">
            Coordinación integral de cirugías oftalmológicas, asignación de salas y consentimiento por WhatsApp.
          </p>
        </div>

        {/* Selector de Fecha */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-[var(--border)]">
          <button
            onClick={() => handleCambiarDia(-1)}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-[var(--secondary)] hover:text-[var(--foreground)] transition-all"
            title="Día anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <input
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            className="px-3 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
          />

          <button
            onClick={() => handleCambiarDia(1)}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-[var(--secondary)] hover:text-[var(--foreground)] transition-all"
            title="Día siguiente"
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

      {/* KPI Cards & Acciones */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[var(--secondary)]">Cirugías Programadas</p>
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
              setInitialTurnoData({ fecha_cirugia: fechaSeleccionada, hora_inicio: '08:30' })
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

      {/* Grid del Turnero */}
      <TurneroGrid
        quirofanos={quirofanosFiltrados}
        turnos={turnos}
        bloqueos={bloqueos}
        fechaSeleccionada={fechaSeleccionada}
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
