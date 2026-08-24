'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  FileCheck2,
  Download,
  Eye,
  RefreshCw,
  Sparkles,
  Phone,
  Radio,
  Timer,
  Edit2,
  XCircle,
  Send,
  Loader2,
  FileText,
  AlertTriangle,
  UploadCloud,
  CheckCheck,
  Trash2,
  ShieldCheck,
  Search,
  X,
  ListFilter
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { formatearHoraDesdeIso, calcularMinutosTranscurridos } from '@/lib/dateUtils'
import ModalDetalleCirugiaEnVivo from './ModalDetalleCirugiaEnVivo'
import ModalPausaQuirurgicaOms from './modal/ModalPausaQuirurgicaOms'

interface PizarraQuirofanoEnVivoProps {
  onEditarTurno?: (turno: any) => void
}

export default function PizarraQuirofanoEnVivo({ onEditarTurno }: PizarraQuirofanoEnVivoProps) {
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10))
  const [quirofanoFiltro, setQuirofanoFiltro] = useState<string>('todos')
  const [quirofanos, setQuirofanos] = useState<any[]>([])
  const [turnos, setTurnos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [horaActual, setHoraActual] = useState(new Date())
  const [turnoModalDetalle, setTurnoModalDetalle] = useState<any | null>(null)
  const [turnoParaPausaOms, setTurnoParaPausaOms] = useState<any | null>(null)
  const [subiendoGeclisaId, setSubiendoGeclisaId] = useState<string | null>(null)
  const [desvinculandoGeclisaId, setDesvinculandoGeclisaId] = useState<string | null>(null)
  const [subiendoConsentimientoId, setSubiendoConsentimientoId] = useState<string | null>(null)

  // Filtros operativos y búsqueda en tiempo real
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'programado' | 'en_espera' | 'en_operacion' | 'operado'>('programado')
  const [busqueda, setBusqueda] = useState<string>('')

  // Restaurar preferencias guardadas del usuario en localStorage al montar el componente
  useEffect(() => {
    try {
      const savedEstado = localStorage.getItem('quirofano_filtro_estado') as any
      if (savedEstado && ['todos', 'programado', 'en_espera', 'en_operacion', 'operado'].includes(savedEstado)) {
        setFiltroEstado(savedEstado)
      }
      const savedSala = localStorage.getItem('quirofano_filtro_sala')
      if (savedSala) {
        setQuirofanoFiltro(savedSala)
      }
    } catch (e) {
      console.warn('Error cargando preferencias de quirofano en localStorage:', e)
    }
  }, [])

  // Cambiar y persistir filtro de estado en localStorage
  const handleSeleccionarFiltroEstado = (nuevoEstado: 'todos' | 'programado' | 'en_espera' | 'en_operacion' | 'operado') => {
    setFiltroEstado(nuevoEstado)
    try {
      localStorage.setItem('quirofano_filtro_estado', nuevoEstado)
    } catch (e) {
      console.warn('Error guardando quirofano_filtro_estado en localStorage:', e)
    }
  }

  // Cambiar y persistir filtro de sala en localStorage
  const handleSeleccionarSala = (salaId: string) => {
    setQuirofanoFiltro(salaId)
    try {
      localStorage.setItem('quirofano_filtro_sala', salaId)
    } catch (e) {
      console.warn('Error guardando quirofano_filtro_sala en localStorage:', e)
    }
  }

  // Ticker de hora actual para cronómetros cada 1 segundo
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Cargar salas de quirófano
  useEffect(() => {
    const loadQuirofanos = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/quirofanos?solo_activos=true`)
        const data = await res.json()
        if (data.success && data.quirofanos) {
          setQuirofanos(data.quirofanos)
        }
      } catch (err) {
        console.error('Error cargando quirófanos:', err)
      }
    }
    loadQuirofanos()
  }, [])

  // Cargar turnos del día
  const fetchTurnosDia = async () => {
    try {
      setCargando(true)
      let url = `${BACKEND_URL}/api/turnos-quirofano-dia?fecha=${fecha}`
      if (quirofanoFiltro !== 'todos') {
        url += `&quirofano_id=${quirofanoFiltro}`
      }
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos(data.turnos || [])
      } else {
        setTurnos([])
      }
    } catch (err) {
      console.error('Error cargando turnos del día:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchTurnosDia()
  }, [fecha, quirofanoFiltro])

  // Suscripción Realtime a Supabase
  useEffect(() => {
    const channel = supabase
      .channel('realtime-pizarra-quirofano')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos_quirofano' },
        () => {
          fetchTurnosDia()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fecha, quirofanoFiltro])

  // Cambiar estado del turno (en_espera, en_operacion, operado, cancelado)
  const handleCambiarEstado = async (turnoId: string, nuevoEstado: string) => {
    try {
      setProcesandoId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/cambiar-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos((prev) =>
          prev.map((t) => (t.id === turnoId ? { ...t, estado: nuevoEstado, ...data.turno } : t))
        )
      } else {
        alert(data.detail || data.error || 'Error al cambiar estado')
      }
    } catch (err) {
      console.error('Error actualizando estado:', err)
    } finally {
      setProcesandoId(null)
    }
  }

  // Subir Protocolo Quirúrgico Oficial a Geclisa
  const handleSubirProtocoloGeclisa = async (turnoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setSubiendoGeclisaId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/subir-parte-quirurgico-geclisa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos((prev) =>
          prev.map((t) =>
            t.id === turnoId
              ? {
                  ...t,
                  ...data.turno,
                  parte_quirurgico_geclisa_archivo_id: data.archivo_id,
                  parte_quirurgico_geclisa_sincronizado_at: data.sincronizado_at
                }
              : t
          )
        )
      } else {
        alert(data.detail || data.error || 'Error al subir protocolo a Geclisa')
      }
    } catch (err: any) {
      console.error('Error subiendo protocolo a Geclisa:', err)
      alert(err.message || 'Error de conexión con el servidor.')
    } finally {
      setSubiendoGeclisaId(null)
    }
  }

  // Eliminar Protocolo de Geclisa
  const handleEliminarProtocoloGeclisa = async (turnoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Desea eliminar el Protocolo Quirúrgico de la Historia Clínica en Geclisa? Podrá volver a subirlo tras realizar correcciones.')) {
      return
    }
    try {
      setDesvinculandoGeclisaId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/desvincular-documento-geclisa/parte_quirurgico`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos((prev) =>
          prev.map((t) =>
            t.id === turnoId
              ? {
                  ...t,
                  ...data.turno,
                  parte_quirurgico_geclisa_archivo_id: null,
                  parte_quirurgico_geclisa_sincronizado_at: null
                }
              : t
          )
        )
      } else {
        alert(data.detail || data.error || 'Error al eliminar protocolo de Geclisa')
      }
    } catch (err: any) {
      console.error('Error eliminando protocolo de Geclisa:', err)
      alert(err.message || 'Error de conexión.')
    } finally {
      setDesvinculandoGeclisaId(null)
    }
  }

  // Subir Consentimiento Informado a Geclisa
  const handleSubirConsentimientoGeclisa = async (turnoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setSubiendoConsentimientoId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/subir-consentimiento-geclisa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos((prev) =>
          prev.map((t) =>
            t.id === turnoId
              ? {
                  ...t,
                  ...data.turno,
                  consentimiento_geclisa_archivo_id: data.archivo_id,
                  consentimiento_geclisa_sincronizado_at: data.sincronizado_at
                }
              : t
          )
        )
      } else {
        alert(data.detail || data.error || 'Error al subir consentimiento a Geclisa')
      }
    } catch (err: any) {
      console.error('Error subiendo consentimiento a Geclisa:', err)
      alert(err.message || 'Error de conexión.')
    } finally {
      setSubiendoConsentimientoId(null)
    }
  }

  // Eliminar Consentimiento de Geclisa
  const handleEliminarConsentimientoGeclisa = async (turnoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Desea eliminar el Consentimiento Informado de la Historia Clínica en Geclisa? Podrá volver a subirlo tras realizar correcciones.')) {
      return
    }
    try {
      setDesvinculandoGeclisaId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/desvincular-documento-geclisa/consentimiento`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos((prev) =>
          prev.map((t) =>
            t.id === turnoId
              ? {
                  ...t,
                  ...data.turno,
                  consentimiento_geclisa_archivo_id: null,
                  consentimiento_geclisa_sincronizado_at: null
                }
              : t
          )
        )
      } else {
        alert(data.detail || data.error || 'Error al eliminar consentimiento de Geclisa')
      }
    } catch (err: any) {
      console.error('Error eliminando consentimiento de Geclisa:', err)
      alert(err.message || 'Error de conexión.')
    } finally {
      setDesvinculandoGeclisaId(null)
    }
  }

  // Navegación de fechas
  const cambiarDia = (diasDelta: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + diasDelta)
    setFecha(d.toISOString().slice(0, 10))
  }

  // Métricas del día
  const metricas = useMemo(() => {
    const total = turnos.length
    const programados = turnos.filter((t) => t.estado === 'programado').length
    const enEspera = turnos.filter((t) => t.estado === 'en_espera').length
    const enOperacion = turnos.filter((t) => t.estado === 'en_operacion').length
    const operados = turnos.filter((t) => t.estado === 'operado').length
    return { total, programados, enEspera, enOperacion, operados }
  }, [turnos])

  // Filtrado reactivo por pestaña de estado y búsqueda en vivo
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      const pac = t.pacientes || {}
      const q = busqueda.toLowerCase().trim()

      if (q) {
        const pacNom = (pac.nombre || '').toLowerCase()
        const pacDni = (pac.dni || '').toLowerCase()
        const cirNom = (t.cirujano_nombre || '').toLowerCase()
        const pracNom = (t.practica_nombre || '').toLowerCase()
        const matchText = pacNom.includes(q) || pacDni.includes(q) || cirNom.includes(q) || pracNom.includes(q)
        if (!matchText) return false
      }

      if (filtroEstado === 'todos') return true
      return t.estado === filtroEstado
    })
  }, [turnos, filtroEstado, busqueda])

  // Calcular tiempo transcurrido en quirófano con alertas de sobretiempo
  const calcularTiempoEnOperacion = (inicioIso?: string, duracionEstimada: number = 20) => {
    if (!inicioIso) return { minutos: 0, segundos: 0, texto: '00:00', esExcedidoModerado: false, esExcedidoCritico: false, minutosExcedidos: 0 }
    const start = new Date(inicioIso).getTime()
    const now = horaActual.getTime()
    const diffSec = Math.max(0, Math.floor((now - start) / 1000))
    const min = Math.floor(diffSec / 60)
    const sec = diffSec % 60
    const esExcedidoModerado = min > duracionEstimada && min <= duracionEstimada * 1.3
    const esExcedidoCritico = min > duracionEstimada * 1.3
    const minutosExcedidos = Math.max(0, min - duracionEstimada)

    return {
      minutos: min,
      segundos: sec,
      texto: `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`,
      esExcedidoModerado,
      esExcedidoCritico,
      minutosExcedidos
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. BARRA SUPERIOR DE CONTROL, FECHA, FILTRO Y BÚSQUEDA */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Selector de Fecha */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-[var(--border)]">
            <button
              onClick={() => cambiarDia(-1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-[var(--secondary)] hover:text-[var(--foreground)] transition"
              title="Día anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setFecha(new Date().toISOString().slice(0, 10))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                fecha === new Date().toISOString().slice(0, 10)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-white dark:hover:bg-slate-700 text-[var(--secondary)]'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => cambiarDia(1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-[var(--secondary)] hover:text-[var(--foreground)] transition"
              title="Día siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
          />

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
            <Radio size={12} className="animate-pulse text-emerald-500" />
            <span>En Vivo</span>
          </div>
        </div>

        {/* Buscador Rápido y Filtro por Quirófano */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end">
          {/* Input de Búsqueda Rápida */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por DNI, paciente, médico..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-7 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--foreground)]"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por Quirófano */}
          <select
            value={quirofanoFiltro}
            onChange={(e) => handleSeleccionarSala(e.target.value)}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
          >
            <option value="todos">Todas las Salas</option>
            {quirofanos.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nombre} ({q.codigo})
              </option>
            ))}
          </select>

          <button
            onClick={fetchTurnosDia}
            disabled={cargando}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-[var(--border)] transition"
            title="Refrescar datos"
          >
            <RefreshCw size={15} className={cargando ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* 2. KPI COUNTERS INTERACTIVOS CON FILTRADO RÁPIDO (1 CLIC) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* KPI 1: Por Llegar / Citados (VISTA POR DEFECTO) */}
        <button
          type="button"
          onClick={() => handleSeleccionarFiltroEstado('programado')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            filtroEstado === 'programado'
              ? 'bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/30 shadow-md'
              : 'bg-slate-100/60 dark:bg-slate-800/40 border-[var(--border)] hover:border-blue-400/60 opacity-85 hover:opacity-100'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Por Llegar (Citados)
              </p>
            </div>
            <p className="text-2xl font-extrabold text-[var(--foreground)] font-mono mt-1">
              {metricas.programados}
            </p>
          </div>
          <Clock size={22} className={filtroEstado === 'programado' ? 'text-blue-600' : 'text-blue-400 opacity-60'} />
        </button>

        {/* KPI 2: En Sala de Espera */}
        <button
          type="button"
          onClick={() => handleSeleccionarFiltroEstado('en_espera')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            filtroEstado === 'en_espera'
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
              : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-400 opacity-85 hover:opacity-100'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                En Sala de Espera
              </p>
            </div>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1">
              {metricas.enEspera}
            </p>
          </div>
          <Activity size={22} className={filtroEstado === 'en_espera' ? 'text-amber-600' : 'text-amber-500 opacity-60'} />
        </button>

        {/* KPI 3: En Quirófano */}
        <button
          type="button"
          onClick={() => handleSeleccionarFiltroEstado('en_operacion')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            filtroEstado === 'en_operacion'
              ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30 shadow-md'
              : 'bg-purple-500/5 border-purple-500/20 hover:border-purple-400 opacity-85 hover:opacity-100'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-purple-600 dark:text-purple-400">
                En Quirófano
              </p>
            </div>
            <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono mt-1">
              {metricas.enOperacion}
            </p>
          </div>
          <Timer size={22} className={filtroEstado === 'en_operacion' ? 'text-purple-600 animate-spin' : 'text-purple-500 opacity-70'} />
        </button>

        {/* KPI 4: Operados / Concluidos */}
        <button
          type="button"
          onClick={() => handleSeleccionarFiltroEstado('operado')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            filtroEstado === 'operado'
              ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
              : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-400 opacity-85 hover:opacity-100'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Operados (Concluidos)
              </p>
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {metricas.operados}
            </p>
          </div>
          <CheckCircle2 size={22} className={filtroEstado === 'operado' ? 'text-emerald-600' : 'text-emerald-500 opacity-70'} />
        </button>

        {/* KPI 5: Todos / Total */}
        <button
          type="button"
          onClick={() => handleSeleccionarFiltroEstado('todos')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            filtroEstado === 'todos'
              ? 'bg-slate-200/80 dark:bg-slate-700/80 border-slate-400 dark:border-slate-500 ring-2 ring-slate-400/30 shadow-md'
              : 'bg-slate-100/40 dark:bg-slate-800/20 border-[var(--border)] hover:border-slate-400 opacity-80 hover:opacity-100'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <ListFilter size={12} className="text-slate-500" />
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Todos los Turnos
              </p>
            </div>
            <p className="text-2xl font-extrabold text-[var(--foreground)] font-mono mt-1">
              {metricas.total}
            </p>
          </div>
          <Calendar size={22} className={filtroEstado === 'todos' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 opacity-60'} />
        </button>
      </div>

      {/* 3. LISTADO DE CIRUGÍAS FILTRADO EN TIEMPO REAL */}
      {cargando ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span>Cargando pizarra de cirugías del día...</span>
        </div>
      ) : turnos.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] bg-[var(--card)] border border-dashed rounded-2xl">
          No hay turnos quirúrgicos programados para la fecha seleccionada ({fecha}).
        </div>
      ) : turnosFiltrados.length === 0 ? (
        <div className="p-10 text-center bg-[var(--card)] border border-dashed border-[var(--border)] rounded-2xl space-y-3">
          <p className="text-sm font-bold text-[var(--foreground)]">
            {busqueda
              ? `No se encontraron cirugías que coincidan con "${busqueda}".`
              : filtroEstado === 'programado'
              ? 'No hay pacientes pendientes por llegar en este momento.'
              : filtroEstado === 'en_espera'
              ? 'No hay pacientes en sala de espera actualmente.'
              : filtroEstado === 'en_operacion'
              ? 'No hay cirugías en curso en este momento.'
              : 'No hay cirugías concluidas en esta fecha.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Limpiar Búsqueda
              </button>
            )}
            {filtroEstado !== 'todos' && (
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition"
              >
                Ver Todas las Cirugías ({metricas.total})
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {turnosFiltrados.map((t) => {
            const pac = t.pacientes || {}
            const q = t.quirofanos || {}
            const duracionEstimada = t.duracion_minutos || 20
            const tiempoOp = calcularTiempoEnOperacion(t.inicio_cirugia_at, duracionEstimada)
            const esProgramado = t.estado === 'programado'
            const esEnEspera = t.estado === 'en_espera'
            const esEnOperacion = t.estado === 'en_operacion'
            const esOperado = t.estado === 'operado'

            // Borde Lateral de Alto Contraste (5px) según Estado
            const borderCls = esEnOperacion
              ? 'border-l-[5px] border-l-purple-600 border-y-purple-200 dark:border-y-purple-900 border-r-purple-200 dark:border-r-purple-900 bg-purple-50/25 dark:bg-purple-950/15 ring-2 ring-purple-500/20'
              : esEnEspera
              ? 'border-l-[5px] border-l-amber-500 border-y-amber-200 dark:border-y-amber-900 border-r-amber-200 dark:border-r-amber-900 bg-amber-50/20 dark:bg-amber-950/10'
              : esOperado
              ? 'border-l-[5px] border-l-emerald-500 border-y-emerald-200/60 dark:border-y-emerald-900/60 border-r-emerald-200/60 dark:border-r-emerald-900/60 bg-emerald-50/10 dark:bg-emerald-950/5 opacity-95'
              : 'border-l-[5px] border-l-blue-500 border-y-[var(--border)] border-r-[var(--border)] bg-[var(--card)]'

            const minutosEsperando = esEnEspera ? calcularMinutosTranscurridos(t.llegada_at) : 0

            return (
              <div
                key={t.id}
                onClick={() => setTurnoModalDetalle(t)}
                className={`p-4 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:shadow-md ${borderCls}`}
                title="💡 Clic para abrir Ficha de Programación, Historia Clínica e Indicaciones Médicas de Geclisa"
              >
                {/* Bloque Izquierdo: Horario, Sala, Paciente y Cirugía */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  {/* Fila 1: Horario + Sala + Badges de Trazabilidad */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-600 text-white text-xs font-mono font-extrabold shadow-sm">
                      <Clock size={13} />
                      <span>{String(t.hora_inicio).slice(0, 5)} hs</span>
                    </div>

                    <span className="text-xs font-bold text-[var(--foreground)] px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[var(--border)]">
                      {q.nombre || 'Quirófano'}
                    </span>

                    <span className="text-[11px] font-semibold text-[var(--secondary)]">
                      ⏱ {duracionEstimada} min estimados
                    </span>

                    {/* Badge Lateralidad Ocular */}
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold">
                      {t.ojo === 'OD' ? 'Ojo Derecho (OD)' : t.ojo === 'OI' ? 'Ojo Izquierdo (OI)' : 'Ambos Ojos (AO)'}
                    </span>

                    {/* Badge de Llegada / Espera */}
                    {t.llegada_at && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        Llegó: {formatearHoraDesdeIso(t.llegada_at)}
                      </span>
                    )}

                    {/* Badge Dinámico de Tiempo en Espera */}
                    {esEnEspera && (
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                        minutosEsperando > 40
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                      }`}>
                        <Clock size={12} />
                        <span>Esperando hace {minutosEsperando} min</span>
                      </span>
                    )}
                  </div>

                  {/* Fila 2: Paciente & Cirugía */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-base font-extrabold text-[var(--foreground)] tracking-tight">
                      {pac.nombre || 'Paciente sin nombre'}
                    </h3>
                    <span className="text-xs text-[var(--secondary)] font-mono">DNI: {pac.dni || 'S/D'}</span>
                    {pac.telefono && (
                      <span className="text-xs text-[var(--secondary)] flex items-center gap-1">
                        <Phone size={11} /> {pac.telefono}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {t.obra_social || pac.obra_social || 'Particular'}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Scissors size={13} />
                    <span>{t.practica_nombre || 'Cirugía Oftalmológica'}</span>
                  </p>

                  {/* Fila 3: Equipo Médico & Consentimiento */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--secondary)] pt-1 border-t border-[var(--border)]">
                    <div>
                      👨‍⚕️ <b>Cirujano:</b> {t.cirujano_nombre || 'No asignado'}
                    </div>
                    {t.medico_derivador_nombre && (
                      <div>
                        📥 <b>Derivador:</b> {t.medico_derivador_nombre}
                      </div>
                    )}
                    {t.anestesiologo_nombre && (
                      <div>
                        💉 <b>Anestesista:</b> {t.anestesiologo_nombre}
                      </div>
                    )}
                    {t.instrumentador_nombre && (
                      <div>
                        ✂ <b>Instrumentador:</b> {t.instrumentador_nombre}
                      </div>
                    )}

                    {/* Información del Lente LIO */}
                    {t.lleva_lente && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold">
                        <span>👁 LIO: {t.lente_tipo || 'Estándar'}</span>
                        {t.lente_dioptria && <span>• Diop: {t.lente_dioptria}</span>}
                        {t.es_torico && <span>• Tórico: T{t.lente_torico_valor || 0} (Eje {t.lente_torico_eje || 90}°)</span>}
                        {t.lente_lote && <span>• Lote: {t.lente_lote}</span>}
                      </div>
                    )}

                    {/* Estado del Consentimiento & Geclisa */}
                    {t.consentimiento_estado === 'firmado_digital' ? (
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-1">
                          <ShieldCheck size={12} />
                          <span>Consentimiento Firmado</span>
                        </span>

                        {/* Botón o Badge de Subida de Consentimiento a Geclisa */}
                        {t.consentimiento_geclisa_archivo_id ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-0.5"
                              title={`Consentimiento adjuntado a Geclisa (ID #${t.consentimiento_geclisa_archivo_id})`}
                            >
                              <CheckCheck size={11} />
                              <span>Geclisa: #{t.consentimiento_geclisa_archivo_id}</span>
                            </span>
                            <button
                              type="button"
                              disabled={desvinculandoGeclisaId === t.id}
                              onClick={(e) => handleEliminarConsentimientoGeclisa(t.id, e)}
                              className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Eliminar de Geclisa"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={subiendoConsentimientoId === t.id}
                            onClick={(e) => handleSubirConsentimientoGeclisa(t.id, e)}
                            className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-extrabold flex items-center gap-1 hover:bg-indigo-100 transition disabled:opacity-50"
                            title="Subir Consentimiento a Historia Clínica de Geclisa"
                          >
                            {subiendoConsentimientoId === t.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <UploadCloud size={10} />
                            )}
                            <span>Subir a Geclisa</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-bold flex items-center gap-1">
                        <AlertCircle size={12} />
                        <span>Consentimiento Pendiente</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bloque Derecho: Botones de Transición de 1 Clic y Cronómetros */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-center gap-2.5 shrink-0">
                  {/* Cronómetro en Operación */}
                  {esEnOperacion && (
                    <div className={`px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm font-mono transition-all ${
                      tiempoOp.esExcedidoCritico
                        ? 'bg-rose-600 text-white animate-pulse border border-rose-400'
                        : tiempoOp.esExcedidoModerado
                        ? 'bg-amber-500 text-slate-950 font-bold border border-amber-300'
                        : 'bg-purple-600 text-white'
                    }`}>
                      {tiempoOp.esExcedidoCritico || tiempoOp.esExcedidoModerado ? (
                        <AlertTriangle size={15} />
                      ) : (
                        <Timer size={15} className="animate-spin" />
                      )}
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold opacity-90">
                          {tiempoOp.esExcedidoCritico ? 'Sobreduración' : tiempoOp.esExcedidoModerado ? 'Tiempo Excedido' : 'En Quirófano'}
                        </p>
                        <p className="text-xs font-extrabold">
                          {tiempoOp.texto} <span className="text-[10px] opacity-80">/ {duracionEstimada}m</span>
                          {tiempoOp.minutosExcedidos > 0 && (
                            <span className="ml-1 text-[10px] font-black underline">
                              (+{tiempoOp.minutosExcedidos}m)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Botonera de Acción Directa */}
                  <div className="flex items-center gap-2">
                    {/* Botón 1: Recepcionar (marcar en espera) */}
                    {esProgramado && (
                      <button
                        type="button"
                        disabled={procesandoId === t.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCambiarEstado(t.id, 'en_espera')
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow transition disabled:opacity-50"
                        title="Marcar llegada del paciente a la clínica"
                      >
                        {procesandoId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Clock size={14} />}
                        <span>Recepcionar</span>
                      </button>
                    )}

                    {/* Botón 2: Iniciar Cirugía (dispara Pausa Quirúrgica OMS) */}
                    {esEnEspera && (
                      <button
                        type="button"
                        disabled={procesandoId === t.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setTurnoParaPausaOms(t)
                        }}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition disabled:opacity-50"
                        title="Iniciar Cirugía (Abre Checklist de Pausa Quirúrgica OMS)"
                      >
                        {procesandoId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={14} />}
                        <span>🟣 Iniciar Cirugía</span>
                      </button>
                    )}

                    {/* Botón 3: Finalizar Cirugía (marcar operado) */}
                    {esEnOperacion && (
                      <button
                        type="button"
                        disabled={procesandoId === t.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCambiarEstado(t.id, 'operado')
                        }}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
                        title="Finalizar y cerrar acto quirúrgico"
                      >
                        {procesandoId === t.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        <span>🟢 Finalizar (Operado)</span>
                      </button>
                    )}

                    {/* Si ya está operado: Protocolo Quirúrgico y Sincronización Geclisa */}
                    {esOperado && (
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                          <Check size={13} />
                          <span>Concluido</span>
                        </span>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${t.id}/parte-quirurgico`)
                              const data = await res.json()
                              if (res.ok && data.pdf_url) {
                                window.open(`${BACKEND_URL}${data.pdf_url}`, '_blank')
                              }
                            } catch (err) {
                              console.error('Error abriendo parte Qx:', err)
                            }
                          }}
                          className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-bold flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                          title="Previsualizar / Descargar Protocolo Quirúrgico Oficial en PDF"
                        >
                          <FileText size={12} />
                          <span>📄 Ver Protocolo PDF</span>
                        </button>

                        {t.parte_quirurgico_geclisa_archivo_id ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 shadow-sm"
                              title={`Protocolo adjuntado en Geclisa (ID #${t.parte_quirurgico_geclisa_archivo_id})`}
                            >
                              <CheckCheck size={13} />
                              <span>✔ Subido a Geclisa (#{t.parte_quirurgico_geclisa_archivo_id})</span>
                            </span>
                            <button
                              type="button"
                              disabled={desvinculandoGeclisaId === t.id}
                              onClick={(e) => handleEliminarProtocoloGeclisa(t.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Eliminar Protocolo de Geclisa para volver a subirlo"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={subiendoGeclisaId === t.id}
                            onClick={(e) => handleSubirProtocoloGeclisa(t.id, e)}
                            className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold flex items-center gap-1 shadow transition disabled:opacity-50"
                            title="Adjuntar y sincronizar Protocolo Quirúrgico en la Historia Clínica de Geclisa"
                          >
                            {subiendoGeclisaId === t.id ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Subiendo...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud size={12} />
                                <span>📤 Subir a Geclisa</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Editar Ficha Completa */}
                    {onEditarTurno && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditarTurno(t)
                        }}
                        className="p-1.5 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[var(--foreground)] transition"
                        title="Editar / Ver ficha médica completa"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 4. MODAL DETALLE DE CIRUGÍA EN VIVO (FICHA, LIO, GECLISA HC E INDICACIONES) */}
      {turnoModalDetalle && (
        <ModalDetalleCirugiaEnVivo
          isOpen={!!turnoModalDetalle}
          onClose={() => setTurnoModalDetalle(null)}
          turno={turnoModalDetalle}
          quirofanos={quirofanos}
          onTurnoGuardado={(tUpd) => {
            setTurnos((prev) => prev.map((t) => (t.id === tUpd.id ? { ...t, ...tUpd } : t)))
            setTurnoModalDetalle(tUpd)
          }}
        />
      )}

      {/* 5. MODAL DE PAUSA QUIRÚRGICA OMS (CHECKLIST DE SEGURIDAD PREVIO A INCISIÓN) */}
      {turnoParaPausaOms && (
        <ModalPausaQuirurgicaOms
          isOpen={!!turnoParaPausaOms}
          onClose={() => setTurnoParaPausaOms(null)}
          turno={turnoParaPausaOms}
          onConfirmarInicio={async () => {
            const tId = turnoParaPausaOms.id
            setTurnoParaPausaOms(null)
            await handleCambiarEstado(tId, 'en_operacion')
          }}
          procesando={procesandoId === turnoParaPausaOms.id}
        />
      )}
    </div>
  )
}
