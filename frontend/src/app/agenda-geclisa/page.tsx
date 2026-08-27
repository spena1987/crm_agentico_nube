'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Search, 
  Clock, 
  User, 
  FileText, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Loader2, 
  Stethoscope, 
  Building2, 
  MessageSquare, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  Layers,
  ArrowRight,
  Filter,
  MapPin,
  DoorOpen,
  RotateCcw
} from 'lucide-react'

import { BACKEND_URL } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import ModalHistoriaClinica from '@/components/ModalHistoriaClinica'

interface Prestador {
  pre_id: number
  nombre: string
  matricula?: string
  especialidad?: string
}

interface TurnoGeclisa {
  turno_id: number
  fecha_hora: string
  hora: string
  paciente: string
  ficha_id: number
  dni?: string | null
  telefono?: string | null
  obra_social: string
  servicio: string
  practica: string
  consultorio: string
  ubicacion: string
  prestador_id: number
  prestador_nombre: string
  observaciones: string
  es_sobreturno: boolean
  estado_key: 'reservado' | 'confirmado' | 'ingresado' | 'atendido' | 'cancelado'
  estado_label: string
  confirmado: boolean
  en_espera: boolean
  asistio: boolean
  cancelado: boolean
}

interface MetricasAgenda {
  total: number
  reservado: number
  confirmado: number
  ingresado: number
  atendido: number
  cancelado: number
}

interface Catalogos {
  servicios: string[]
  ubicaciones: string[]
  consultorios: string[]
  prestadores: Prestador[]
}

export default function AgendaGeclisaPage() {
  const { user } = useAuth()
  const { profile } = usePermissions()

  // Fecha seleccionada (YYYY-MM-DD)
  const getTodayISO = () => new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState<string>(getTodayISO())

  // Prestador Seleccionado (Inicializado estrictamente con el prestador del usuario o 969 por defecto)
  const [selectedPreId, setSelectedPreId] = useState<string>('969')
  const [prestadorInfo, setPrestadorInfo] = useState<{ pre_id: number; nombre: string; matricula?: string } | null>(null)

  // Filtros Secundarios (Por defecto: 'todos')
  const [selectedServicio, setSelectedServicio] = useState<string>('todos')
  const [selectedUbicacion, setSelectedUbicacion] = useState<string>('todos')
  const [selectedConsultorio, setSelectedConsultorio] = useState<string>('todos')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [search, setSearch] = useState('')

  // Catálogos
  const [catalogoPrestadores, setCatalogoPrestadores] = useState<Prestador[]>([])
  const [catalogos, setCatalogos] = useState<Catalogos>({
    servicios: [],
    ubicaciones: [],
    consultorios: [],
    prestadores: []
  })

  // Turnos & Datos
  const [turnos, setTurnos] = useState<TurnoGeclisa[]>([])
  const [metricas, setMetricas] = useState<MetricasAgenda>({
    total: 0,
    reservado: 0,
    confirmado: 0,
    ingresado: 0,
    atendido: 0,
    cancelado: 0
  })
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Estado de actualización por turno
  const [updatingTurnoId, setUpdatingTurnoId] = useState<number | null>(null)

  // Modal Historia Clínica
  const [historiaModalOpen, setHistoriaModalOpen] = useState(false)
  const [selectedPaciente, setSelectedPaciente] = useState<{
    id: string
    nombre: string
    dni?: string | null
    geclisa_ficha_id?: number | null
  } | null>(null)

  // 1. Cargar lista completa de prestadores mediante el proxy seguro
  const cargarCatalogoPrestadores = async () => {
    try {
      const res = await fetch('/api/admin/geclisa-prestadores')
      if (res.ok) {
        const data = await res.json()
        setCatalogoPrestadores(data.prestadores || [])
      }
    } catch (e) {
      console.error('Error cargando catalogo de prestadores:', e)
    }
  }

  // 2. Establecer prestador asignado al usuario logueado en el CRM
  useEffect(() => {
    cargarCatalogoPrestadores()
    if (profile?.geclisa_pre_id) {
      setSelectedPreId(String(profile.geclisa_pre_id))
    }
  }, [profile])

  // 3. Cargar agenda estricta de ese prestador
  const cargarAgenda = async (preIdToUse?: string, fechaToUse?: string) => {
    const pId = preIdToUse !== undefined ? preIdToUse : selectedPreId
    const fDate = fechaToUse || fecha
    if (!pId) return

    try {
      setLoading(true)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/agenda?pre_id=${pId}&fecha=${fDate}`)
      if (!res.ok) {
        throw new Error('No se pudo obtener la agenda de Geclisa.')
      }
      const data = await res.json()
      setTurnos(data.turnos || [])
      setMetricas(data.metricas || {
        total: 0,
        reservado: 0,
        confirmado: 0,
        ingresado: 0,
        atendido: 0,
        cancelado: 0
      })
      if (data.prestador) {
        setPrestadorInfo(data.prestador)
      }
      if (data.catalogos) {
        setCatalogos({
          servicios: data.catalogos.servicios || [],
          ubicaciones: data.catalogos.ubicaciones || [],
          consultorios: data.catalogos.consultorios || [],
          prestadores: data.catalogos.prestadores || []
        })
      }
    } catch (err: any) {
      console.error('Error cargando agenda:', err)
      setFeedback({ type: 'error', message: err.message || 'Error al conectar con Geclisa.' })
    } finally {
      setLoading(false)
    }
  }

  // Cargar al cambiar de fecha o de prestador
  useEffect(() => {
    if (selectedPreId) {
      cargarAgenda(selectedPreId, fecha)
    }
  }, [selectedPreId, fecha])

  // Navegación de Fechas
  const cambiarDia = (offset: number) => {
    const [y, m, d] = fecha.split('-').map(Number)
    const curr = new Date(y, m - 1, d)
    curr.setDate(curr.getDate() + offset)
    const newY = curr.getFullYear()
    const newM = String(curr.getMonth() + 1).padStart(2, '0')
    const newD = String(curr.getDate()).padStart(2, '0')
    const nextDate = `${newY}-${newM}-${newD}`
    setFecha(nextDate)
  }

  const irAHoy = () => {
    setFecha(getTodayISO())
  }

  // Formato de fecha legible
  const fechaLegible = useMemo(() => {
    if (!fecha) return ''
    const [y, m, d] = fecha.split('-').map(Number)
    const dateObj = new Date(y, m - 1, d)
    return dateObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [fecha])

  // Resetear filtros secundarios
  const limpiarFiltros = () => {
    setSelectedServicio('todos')
    setSelectedUbicacion('todos')
    setSelectedConsultorio('todos')
    setFiltroEstado('todos')
    setSearch('')
  }

  const hayFiltrosActivos = selectedServicio !== 'todos' || selectedUbicacion !== 'todos' || selectedConsultorio !== 'todos' || filtroEstado !== 'todos' || search !== ''

  // Cambiar estado de un turno
  const handleCambiarEstado = async (turnoId: number, nuevoEstado: string) => {
    try {
      setUpdatingTurnoId(turnoId)
      setFeedback(null)

      const res = await fetch(`${BACKEND_URL}/api/geclisa/agenda/turnos/${turnoId}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nuevo_estado: nuevoEstado,
          canal: 7,
          motivo_id: 1,
          usuario_crm: profile?.nombre_completo || user?.email || 'Usuario CRM'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Error al cambiar estado en Geclisa.')
      }

      setFeedback({
        type: 'success',
        message: `Turno #${turnoId} actualizado a estado "${nuevoEstado.toUpperCase()}" exitosamente en Geclisa.`
      })

      await cargarAgenda()
    } catch (err: any) {
      console.error('Error al cambiar estado:', err)
      setFeedback({ type: 'error', message: err.message || 'No se pudo actualizar el estado.' })
    } finally {
      setUpdatingTurnoId(null)
    }
  }

  // Filtrado Reactivo de turnos
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      // Filtro por Estado
      if (filtroEstado !== 'todos' && t.estado_key !== filtroEstado) {
        return false
      }
      // Filtro por Servicio
      if (selectedServicio !== 'todos' && t.servicio !== selectedServicio) {
        return false
      }
      // Filtro por Ubicación
      if (selectedUbicacion !== 'todos' && t.ubicacion !== selectedUbicacion) {
        return false
      }
      // Filtro por Consultorio
      if (selectedConsultorio !== 'todos' && t.consultorio !== selectedConsultorio) {
        return false
      }
      // Filtro de Búsqueda
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchNombre = t.paciente.toLowerCase().includes(q)
        const matchFicha = String(t.ficha_id).includes(q)
        const matchDNI = t.dni ? t.dni.includes(q) : false
        const matchOS = t.obra_social.toLowerCase().includes(q)
        const matchPractica = t.practica.toLowerCase().includes(q)
        return matchNombre || matchFicha || matchDNI || matchOS || matchPractica
      }
      return true
    })
  }, [turnos, filtroEstado, selectedServicio, selectedUbicacion, selectedConsultorio, search])

  // Estilos de Tarjetas Coloreadas por Estadio Completo
  const getCardTheme = (estadoKey: string) => {
    switch (estadoKey) {
      case 'confirmado':
        return {
          cardBg: 'bg-blue-500/10 dark:bg-blue-950/30 border-blue-400/50 dark:border-blue-700/60 shadow-blue-500/5',
          headerBadge: 'bg-blue-600 text-white',
          practicaBadge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
          selectBg: 'bg-blue-100/80 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
          label: 'Confirmado',
          dot: 'bg-blue-500'
        }
      case 'ingresado':
        return {
          cardBg: 'bg-purple-500/10 dark:bg-purple-950/30 border-purple-400/50 dark:border-purple-700/60 shadow-purple-500/5',
          headerBadge: 'bg-purple-600 text-white',
          practicaBadge: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
          selectBg: 'bg-purple-100/80 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
          label: 'En Sala / Ingresado',
          dot: 'bg-purple-500'
        }
      case 'atendido':
        return {
          cardBg: 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-400/50 dark:border-emerald-700/60 shadow-emerald-500/5',
          headerBadge: 'bg-emerald-600 text-white',
          practicaBadge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
          selectBg: 'bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
          label: 'Atendido',
          dot: 'bg-emerald-500'
        }
      case 'cancelado':
        return {
          cardBg: 'bg-red-500/10 dark:bg-red-950/20 border-red-300/40 dark:border-red-800/40 opacity-75 shadow-red-500/5',
          headerBadge: 'bg-red-500 text-white',
          practicaBadge: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
          selectBg: 'bg-red-100/80 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
          label: 'Cancelado',
          dot: 'bg-red-500'
        }
      default:
        return {
          cardBg: 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400/50 dark:border-amber-700/60 shadow-amber-500/5',
          headerBadge: 'bg-amber-500 text-white',
          practicaBadge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
          selectBg: 'bg-amber-100/80 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
          label: 'Reservado',
          dot: 'bg-amber-500'
        }
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold shadow-sm">
              <Calendar size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
                Agenda de Turnos Geclisa
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  En Vivo
                </span>
              </h1>
              <p className="text-xs text-[var(--secondary)]">
                {prestadorInfo ? (
                  <span>
                    Agenda de: <strong>{prestadorInfo.nombre}</strong> {prestadorInfo.matricula ? `(Mat: ${prestadorInfo.matricula})` : ''}
                  </span>
                ) : (
                  'Consulta hospitalaria en tiempo real del profesional asignado.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Prestador & Fechas */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Prestador */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-[var(--border)] px-3 py-1.5 rounded-xl shadow-sm">
            <Stethoscope size={14} className="text-blue-600 shrink-0" />
            <select
              value={selectedPreId}
              onChange={(e) => setSelectedPreId(e.target.value)}
              className="text-xs font-bold bg-transparent border-0 text-[var(--foreground)] focus:outline-none focus:ring-0 max-w-[200px] truncate"
            >
              {catalogoPrestadores.length > 0 ? (
                catalogoPrestadores.map((p) => (
                  <option key={p.pre_id} value={String(p.pre_id)}>
                    {p.nombre} {p.matricula ? `(${p.matricula})` : ''}
                  </option>
                ))
              ) : (
                <option value={selectedPreId}>
                  {prestadorInfo?.nombre || `Prestador #${selectedPreId}`}
                </option>
              )}
            </select>
          </div>

          {/* Navegación por Días */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => cambiarDia(-1)}
              className="p-2 border border-[var(--border)] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-bold"
              title="Día anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={irAHoy}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                fecha === getTodayISO()
                  ? 'bg-blue-600 text-white border-blue-600 shadow glow-primary'
                  : 'border-[var(--border)] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Hoy
            </button>

            <button
              onClick={() => cambiarDia(1)}
              className="p-2 border border-[var(--border)] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-bold"
              title="Día siguiente"
            >
              <ChevronRight size={16} />
            </button>

            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-bold border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <button
              onClick={() => cargarAgenda()}
              disabled={loading}
              className="p-2 border border-[var(--border)] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm"
              title="Actualizar agenda en vivo"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Combinados (Servicio, Ubicación, Consultorio) */}
      <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-blue-600" />
            <span className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
              Filtros Operativos
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">
              ({turnosFiltrados.length} de {turnos.length} turnos)
            </span>
          </div>

          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 hover:underline transition-all"
            >
              <RotateCcw size={12} />
              <span>Limpiar Filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Selector de Servicio */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Building2 size={11} className="text-purple-600" /> Servicio / Especialidad
            </label>
            <select
              value={selectedServicio}
              onChange={(e) => setSelectedServicio(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="todos">Todos los Servicios</option>
              {catalogos.servicios.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Selector de Ubicación / Sede */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <MapPin size={11} className="text-emerald-600" /> Ubicación / Sede
            </label>
            <select
              value={selectedUbicacion}
              onChange={(e) => setSelectedUbicacion(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="todos">Todas las Sedes</option>
              {catalogos.ubicaciones.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Selector de Consultorio */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <DoorOpen size={11} className="text-amber-600" /> Consultorio / Sala
            </label>
            <select
              value={selectedConsultorio}
              onChange={(e) => setSelectedConsultorio(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="todos">Todos los Consultorios</option>
              {catalogos.consultorios.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alertas de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Métricas y Filtros de Estado */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'todos', label: 'Todos', count: metricas.total, color: 'border-slate-300 text-slate-700 dark:text-slate-200 bg-[var(--card)]' },
          { key: 'reservado', label: 'Reservados', count: metricas.reservado, color: 'border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20' },
          { key: 'confirmado', label: 'Confirmados', count: metricas.confirmado, color: 'border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20' },
          { key: 'ingresado', label: 'En Sala / Espera', count: metricas.ingresado, color: 'border-purple-300 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/20' },
          { key: 'atendido', label: 'Atendidos', count: metricas.atendido, color: 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' },
          { key: 'cancelado', label: 'Cancelados', count: metricas.cancelado, color: 'border-red-300 text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-950/20' },
        ].map((f) => {
          const isActive = filtroEstado === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFiltroEstado(f.key)}
              className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${f.color} ${
                isActive ? 'ring-2 ring-blue-500 shadow-md font-bold' : 'opacity-80 hover:opacity-100 hover:shadow-sm'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wider font-semibold opacity-75">{f.label}</p>
              <p className="text-xl font-bold mt-1">{f.count}</p>
              {isActive && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              )}
            </button>
          )
        })}
      </div>

      {/* Buscador de Pacientes */}
      <div className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] px-4 py-2.5 rounded-2xl shadow-sm">
        <Search size={18} className="text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Buscar turno por paciente, DNI, Ficha, práctica médica (ej: OCT, Cirugía) o cobertura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs bg-transparent border-0 focus:outline-none focus:ring-0 text-[var(--foreground)]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 text-xs">
            <XCircle size={16} />
          </button>
        )}
      </div>

      {/* Lista de Turnos / Grilla Tematizada por Colores de Estadio */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[var(--card)] rounded-2xl border border-[var(--border)] text-slate-400 gap-3">
          <Loader2 size={36} className="animate-spin text-blue-600" />
          <p className="text-xs font-semibold">Consultando agenda en tiempo real en Geclisa...</p>
        </div>
      ) : turnosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-[var(--card)] rounded-2xl border border-[var(--border)] text-slate-400 space-y-2">
          <Calendar size={42} className="mx-auto opacity-40 text-blue-600" />
          <p className="text-sm font-bold text-[var(--foreground)]">No hay turnos registrados</p>
          <p className="text-xs text-[var(--secondary)]">
            No se encontraron turnos para la fecha ({fecha}) con los filtros actuales.
          </p>
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all inline-flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw size={12} />
              <span>Ver todos los turnos del prestador</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {turnosFiltrados.map((t) => {
            const theme = getCardTheme(t.estado_key)
            const isUpdating = updatingTurnoId === t.turno_id

            return (
              <div
                key={t.turno_id}
                className={`border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative group ${theme.cardBg}`}
              >
                {/* Header de Tarjeta: Hora & Selector de Estado */}
                <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs flex items-center gap-1 shadow-sm ${theme.headerBadge}`}>
                      <Clock size={13} />
                      <span>{t.hora}</span>
                    </div>
                    {t.es_sobreturno && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-300">
                        Sobreturno
                      </span>
                    )}
                  </div>

                  {/* Selector interactivo de estado */}
                  <div className="relative">
                    <select
                      value={t.estado_key}
                      disabled={isUpdating}
                      onChange={(e) => handleCambiarEstado(t.turno_id, e.target.value)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${theme.selectBg}`}
                    >
                      <option value="reservado">🟡 Reservado</option>
                      <option value="confirmado">🔵 Confirmado</option>
                      <option value="ingresado">🟣 En Sala (Ingresado)</option>
                      <option value="atendido">🟢 Atendido</option>
                      <option value="cancelado">🔴 Cancelado</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 pointer-events-none text-slate-400">
                      {isUpdating ? (
                        <Loader2 size={12} className="animate-spin text-blue-600" />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Badge de Práctica / Prestación Médica Visible */}
                <div className="space-y-1.5">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${theme.practicaBadge}`}>
                    <Sparkles size={12} className="shrink-0" />
                    <span className="truncate">{t.practica}</span>
                  </div>

                  {/* Datos del Paciente */}
                  <div className="flex items-start justify-between gap-2 pt-1">
                    <h3 className="font-bold text-xs text-[var(--foreground)] group-hover:text-blue-600 transition-colors line-clamp-1">
                      {t.paciente}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      Ficha #{t.ficha_id}
                    </span>
                  </div>

                  {/* Detalles Operativos: Obra Social, Sede & Consultorio */}
                  <div className="space-y-1 text-[11px] text-[var(--secondary)]">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                      <span className="truncate">{t.obra_social}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{t.ubicacion} • {t.consultorio}</span>
                    </div>

                    {t.observaciones && (
                      <p className="text-[10px] italic text-slate-500 bg-white/60 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/60 line-clamp-2">
                        {t.observaciones}
                      </p>
                    )}
                  </div>
                </div>

                {/* Botonera de Acciones Rápidas */}
                <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedPaciente({
                        id: String(t.ficha_id),
                        nombre: t.paciente,
                        dni: t.dni,
                        geclisa_ficha_id: t.ficha_id
                      })
                      setHistoriaModalOpen(true)
                    }}
                    className="flex-1 py-1.5 px-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-[var(--foreground)] rounded-xl text-[11px] font-bold transition-all border border-[var(--border)] flex items-center justify-center gap-1.5 shadow-sm"
                    title="Ver Historia Clínica, Evoluciones y Visor de PDFs"
                  >
                    <FileText size={13} className="text-blue-600" />
                    <span>Expediente</span>
                  </button>

                  <a
                    href={`/chat`}
                    className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-all flex items-center justify-center shadow-sm"
                    title="Abrir WhatsApp"
                  >
                    <MessageSquare size={14} />
                  </a>

                  <a
                    href={`/pipeline-quirurgico`}
                    className="p-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-800 transition-all flex items-center justify-center shadow-sm"
                    title="Pipeline Quirúrgico / Asesoría"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Historia Clínica con Visor In-App */}
      {historiaModalOpen && selectedPaciente && (
        <ModalHistoriaClinica
          isOpen={historiaModalOpen}
          paciente={selectedPaciente}
          onClose={() => {
            setHistoriaModalOpen(false)
            setSelectedPaciente(null)
          }}
        />
      )}
    </div>
  )
}
