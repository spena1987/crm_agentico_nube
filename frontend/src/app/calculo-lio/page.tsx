'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Eye,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  User,
  Scissors,
  Calendar,
  Building2,
  Layers,
  FileText,
  Plus,
  Trash2,
  Save,
  Check,
  PackageCheck,
  Package,
  FileCheck2,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  RefreshCw,
  Phone,
  HelpCircle,
  Copy,
  ChevronRight
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { formatearHoraDesdeIso } from '@/lib/dateUtils'

interface OpcionLio {
  id: string
  tipo_opcion: 'principal' | 'alternativa' | 'torico' | 'sulcus'
  etiqueta: string
  modelo: string
  dioptria: string
  es_torico: boolean
  torico_valor: number | null
  torico_eje: number | null
  target_refractivo: string
  formula: string
  observaciones: string
  es_implantado?: boolean
}

const FORMULAS_LIO = [
  'Barrett Universal II',
  'Kane',
  'EVO 2.0',
  'Hill-RBF 3.0',
  'Haigis',
  'SRK/T',
  'Holladay 1',
  'Hoffer Q',
  'Olsen'
]

const TARGETS_REFRACTIVOS = [
  'Emetropía (0.00 D)',
  '-0.25 D (Miopía Leve)',
  '-0.50 D (Micro-monovisión)',
  '-0.75 D',
  '-1.00 D (Monovisión Intermedia)',
  '-1.50 D (Monovisión Lectura)',
  '+0.25 D'
]

const TORICOS_OPCIONES = [
  { valor: 2, label: 'T2 (Cil 1.00 D)' },
  { valor: 3, label: 'T3 (Cil 1.50 D)' },
  { valor: 4, label: 'T4 (Cil 2.25 D)' },
  { valor: 5, label: 'T5 (Cil 3.00 D)' },
  { valor: 6, label: 'T6 (Cil 3.75 D)' },
  { valor: 7, label: 'T7 (Cil 4.50 D)' },
  { valor: 8, label: 'T8 (Cil 5.25 D)' },
  { valor: 9, label: 'T9 (Cil 6.00 D)' }
]

export default function CalculoLioPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [cirujanos, setCirujanos] = useState<string[]>([])
  const [cirujanoSeleccionado, setCirujanoSeleccionado] = useState<string>('todos')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todos') // 'todos' | 'pendientes' | 'calculados' | 'stock_pendiente'
  const [busqueda, setBusqueda] = useState<string>('')
  const [cargando, setCargando] = useState<boolean>(true)
  const [guardando, setGuardando] = useState<boolean>(false)
  const [reservandoStock, setReservandoStock] = useState<boolean>(false)

  const [pacienteActivo, setPacienteActivo] = useState<any | null>(null)
  const [opcionesLio, setOpcionesLio] = useState<OpcionLio[]>([])
  const [modelosLio, setModelosLio] = useState<any[]>([])

  // Visor de Documentos Geclisa
  const [modalArchivosAbierto, setModalArchivosAbierto] = useState<boolean>(false)
  const [archivosGeclisa, setArchivosGeclisa] = useState<any[]>([])
  const [cargandoArchivos, setCargandoArchivos] = useState<boolean>(false)
  const [archivoVisor, setArchivoVisor] = useState<any | null>(null)
  const [visorPantallaCompleta, setVisorPantallaCompleta] = useState<boolean>(false)

  // Cargar catálogo de modelos de LIO
  useEffect(() => {
    const fetchModelos = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/modelos-lio?solo_activos=true`)
        const data = await res.json()
        if (data.success && data.modelos) {
          setModelosLio(data.modelos)
        }
      } catch (e) {
        console.error('Error cargando modelos de LIO:', e)
      }
    }
    fetchModelos()
  }, [])

  // Cargar pacientes para cálculo de LIO
  const fetchPacientes = async () => {
    try {
      setCargando(true)
      let url = `${BACKEND_URL}/api/calculo-lio/pacientes?estado_calculo=${estadoFiltro}`
      if (cirujanoSeleccionado !== 'todos') {
        url += `&cirujano_nombre=${encodeURIComponent(cirujanoSeleccionado)}`
      }
      if (busqueda.trim()) {
        url += `&busqueda=${encodeURIComponent(busqueda.trim())}`
      }

      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.success) {
        setPacientes(data.pacientes || [])
        setCirujanos(data.cirujanos || [])
        
        // Si hay un paciente activo, refrescar sus datos
        if (pacienteActivo) {
          const act = (data.pacientes || []).find(
            (p: any) =>
              (p.turno_id && p.turno_id === pacienteActivo.turno_id) ||
              (p.asesoria_id && p.asesoria_id === pacienteActivo.asesoria_id)
          )
          if (act) {
            setPacienteActivo(act)
          }
        } else if ((data.pacientes || []).length > 0 && !pacienteActivo) {
          seleccionarPaciente(data.pacientes[0])
        }
      } else {
        setPacientes([])
      }
    } catch (e) {
      console.error('Error cargando pacientes para cálculo de LIO:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchPacientes()
  }, [cirujanoSeleccionado, estadoFiltro])

  // Seleccionar paciente para la mesa de trabajo
  const seleccionarPaciente = (p: any) => {
    setPacienteActivo(p)
    const ops = p.lio_calculo_opciones || []
    if (ops.length > 0) {
      setOpcionesLio(ops)
    } else {
      // Inicializar con Opción Principal por defecto
      setOpcionesLio([
        {
          id: `opt-${Date.now()}-1`,
          tipo_opcion: 'principal',
          etiqueta: 'Plan A (Principal)',
          modelo: p.lente_tipo || 'AcrySof IQ SN60WF (Alcon)',
          dioptria: p.lente_dioptria || '+21.50',
          es_torico: Boolean(p.es_torico),
          torico_valor: p.lente_torico_valor || null,
          torico_eje: p.lente_torico_eje || null,
          target_refractivo: '-0.25 D (Miopía Leve)',
          formula: 'Barrett Universal II',
          observaciones: '',
          es_implantado: true
        }
      ])
    }
  }

  // Agregar nueva opción de lente
  const agregarOpcionLio = (tipo: 'principal' | 'alternativa' | 'torico' | 'sulcus' = 'alternativa') => {
    const num = opcionesLio.length + 1
    const etiqueta =
      tipo === 'principal'
        ? `Plan A (Principal)`
        : tipo === 'torico'
        ? `Opción Tórica (Astigmatismo)`
        : tipo === 'sulcus'
        ? `Opción Sulcus / 3 Piezas (MA60AC)`
        : `Opción ${num} (Alternativa ${num > 2 ? '+0.50D' : '-0.50D'})`

    const nueva: OpcionLio = {
      id: `opt-${Date.now()}-${num}`,
      tipo_opcion: tipo,
      etiqueta,
      modelo: tipo === 'sulcus' ? 'AcrySof MA60AC (Alcon)' : opcionesLio[0]?.modelo || 'AcrySof IQ SN60WF (Alcon)',
      dioptria: opcionesLio[0]?.dioptria || '+21.50',
      es_torico: tipo === 'torico',
      torico_valor: tipo === 'torico' ? 3 : null,
      torico_eje: tipo === 'torico' ? 85 : null,
      target_refractivo: opcionesLio[0]?.target_refractivo || '-0.25 D (Miopía Leve)',
      formula: opcionesLio[0]?.formula || 'Barrett Universal II',
      observaciones: '',
      es_implantado: false
    }

    setOpcionesLio([...opcionesLio, nueva])
  }

  // Eliminar opción de lente
  const eliminarOpcionLio = (id: string) => {
    if (opcionesLio.length === 1) {
      alert('Debe existir al menos una opción de cálculo de LIO.')
      return
    }
    setOpcionesLio(opcionesLio.filter((o) => o.id !== id))
  }

  // Actualizar campo de una opción
  const actualizarOpcionLio = (id: string, campo: keyof OpcionLio, valor: any) => {
    setOpcionesLio(
      opcionesLio.map((o) => {
        if (o.id !== id) return o
        const act = { ...o, [campo]: valor }
        if (campo === 'tipo_opcion') {
          if (valor === 'torico') {
            act.es_torico = true
            if (!act.torico_valor) act.torico_valor = 3
            if (!act.torico_eje) act.torico_eje = 90
          } else {
            act.es_torico = false
          }
        }
        return act
      })
    )
  }

  // Guardar cálculo de LIO
  const handleGuardarCalculo = async () => {
    if (!pacienteActivo) return
    if (opcionesLio.length === 0) {
      alert('Debe cargar al menos una opción de lente.')
      return
    }

    try {
      setGuardando(true)
      const cirujano = pacienteActivo.cirujano_nombre || 'Cirujano'
      const payload = {
        turno_id: pacienteActivo.turno_id,
        asesoria_id: pacienteActivo.asesoria_id,
        paciente_id: pacienteActivo.paciente_id,
        lio_calculado_por: cirujano,
        opciones: opcionesLio,
        ojo: pacienteActivo.ojo
      }

      const res = await fetch(`${BACKEND_URL}/api/calculo-lio/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok && data.success) {
        alert('✔ Cálculo de LIO guardado y sellado exitosamente.')
        fetchPacientes()
      } else {
        alert(data.detail || data.error || 'Error al guardar cálculo de LIO.')
      }
    } catch (e: any) {
      console.error('Error guardando cálculo:', e)
      alert(e.message || 'Error de conexión.')
    } finally {
      setGuardando(false)
    }
  }

  // Reservar Stock de LIO (función de Quirófano)
  const handleToggleReservaStock = async () => {
    if (!pacienteActivo || !pacienteActivo.turno_id) {
      alert('La reserva física de stock se asocia a turnos agendados en Quirófano.')
      return
    }

    try {
      setReservandoStock(true)
      const nuevoEstado = !pacienteActivo.lio_stock_reservado
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${pacienteActivo.turno_id}/reservar-stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPacienteActivo({ ...pacienteActivo, lio_stock_reservado: nuevoEstado })
        setPacientes((prev) =>
          prev.map((p) => (p.turno_id === pacienteActivo.turno_id ? { ...p, lio_stock_reservado: nuevoEstado } : p))
        )
      } else {
        alert(data.detail || 'Error al actualizar reserva de stock.')
      }
    } catch (e) {
      console.error('Error al reservar stock:', e)
    } finally {
      setReservandoStock(false)
    }
  }

  // Cargar archivos de Geclisa para el paciente activo
  const handleAbrirEstudiosGeclisa = async () => {
    if (!pacienteActivo) return
    setModalArchivosAbierto(true)
    setCargandoArchivos(true)
    try {
      const qId = pacienteActivo.geclisa_ficha_id || pacienteActivo.paciente_dni || pacienteActivo.paciente_id
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${qId}/archivos`)
      const data = await res.json()
      if (res.ok && data.success) {
        setArchivosGeclisa(data.archivos || [])
      } else {
        setArchivosGeclisa([])
      }
    } catch (e) {
      console.error('Error cargando archivos de Geclisa:', e)
    } finally {
      setCargandoArchivos(false)
    }
  }

  // Métricas de resumen
  const metricas = useMemo(() => {
    const total = pacientes.length
    const pendientes = pacientes.filter((p) => !p.lio_calculado).length
    const calculados = pacientes.filter((p) => p.lio_calculado).length
    const stockPendiente = pacientes.filter((p) => p.lio_calculado && !p.lio_stock_reservado).length
    return { total, pendientes, calculados, stockPendiente }
  }, [pacientes])

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-8 max-w-[1700px] mx-auto min-w-0">
      {/* 1. CABECERA PRINCIPAL & METRICAS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <Eye className="text-cyan-500" size={28} />
            <span>Cálculo de Lentes Intraoculares (LIO)</span>
          </h1>
          <p className="text-xs md:text-sm text-[var(--secondary)] mt-1">
            Definición biométrica multilente (Plan A, B, Tórico y Sulcus), consulta de estudios Geclisa y reserva de stock para quirófano.
          </p>
        </div>

        {/* Filtro por Cirujano / Prestador */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-[var(--border)]">
            <User size={15} className="text-slate-400 ml-1.5" />
            <span className="text-xs font-bold text-[var(--secondary)]">Cirujano:</span>
            <select
              value={cirujanoSeleccionado}
              onChange={(e) => setCirujanoSeleccionado(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-[var(--foreground)] outline-none pr-2 cursor-pointer"
            >
              <option value="todos">Todos los Cirujanos</option>
              {cirujanos.map((cir) => (
                <option key={cir} value={cir}>
                  {cir}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchPacientes}
            disabled={cargando}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-[var(--border)] transition"
            title="Refrescar listado"
          >
            <RefreshCw size={15} className={cargando ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* 2. KPIS Y FILTROS RÁPIDOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* KPI 1: Todos */}
        <button
          type="button"
          onClick={() => setEstadoFiltro('todos')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            estadoFiltro === 'todos'
              ? 'bg-slate-200/80 dark:bg-slate-700/80 border-slate-400 ring-2 ring-slate-400/30 shadow-md'
              : 'bg-slate-100/40 dark:bg-slate-800/20 border-[var(--border)] hover:border-slate-400 opacity-80 hover:opacity-100'
          }`}
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Asignados
            </p>
            <p className="text-2xl font-extrabold text-[var(--foreground)] font-mono mt-0.5">{metricas.total}</p>
          </div>
          <Layers size={22} className="text-slate-400" />
        </button>

        {/* KPI 2: Pendientes de Cálculo */}
        <button
          type="button"
          onClick={() => setEstadoFiltro('pendientes')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            estadoFiltro === 'pendientes'
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
              : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-400 opacity-85 hover:opacity-100'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Pendientes LIO
              </p>
            </div>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {metricas.pendientes}
            </p>
          </div>
          <AlertCircle size={22} className="text-amber-500" />
        </button>

        {/* KPI 3: LIO Calculados */}
        <button
          type="button"
          onClick={() => setEstadoFiltro('calculados')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            estadoFiltro === 'calculados'
              ? 'bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-500/30 shadow-md'
              : 'bg-cyan-500/5 border-cyan-500/20 hover:border-cyan-400 opacity-85 hover:opacity-100'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
                LIO Calculados
              </p>
            </div>
            <p className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
              {metricas.calculados}
            </p>
          </div>
          <CheckCircle2 size={22} className="text-cyan-500" />
        </button>

        {/* KPI 4: Stock Pendiente de Reserva */}
        <button
          type="button"
          onClick={() => setEstadoFiltro('stock_pendiente')}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
            estadoFiltro === 'stock_pendiente'
              ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30 shadow-md'
              : 'bg-purple-500/5 border-purple-500/20 hover:border-purple-400 opacity-85 hover:opacity-100'
          }`}
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-purple-600 dark:text-purple-400">
              Stock Pendiente
            </p>
            <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono mt-0.5">
              {metricas.stockPendiente}
            </p>
          </div>
          <Package size={22} className="text-purple-500" />
        </button>
      </div>

      {/* 3. DISPOSICIÓN PRINCIPAL (MASTER-DETAIL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: LISTADO DE PACIENTES ASIGNADOS */}
        <div className="lg:col-span-4 space-y-3">
          {/* Barra de Búsqueda */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por paciente, DNI, práctica..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPacientes()}
              className="w-full pl-8 pr-7 py-2 bg-[var(--card)] rounded-xl border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-slate-400 outline-none focus:border-cyan-500"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('')
                  fetchPacientes()
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--foreground)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Listado de Tarjetas de Pacientes */}
          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {cargando ? (
              <div className="p-8 text-center text-xs text-[var(--secondary)] flex flex-col items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
                <Loader2 size={20} className="animate-spin text-cyan-500" />
                <span>Cargando pacientes asignados...</span>
              </div>
            ) : pacientes.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--secondary)] bg-[var(--card)] border border-dashed rounded-2xl">
                No se encontraron pacientes para los filtros seleccionados.
              </div>
            ) : (
              pacientes.map((p) => {
                const esSeleccionado =
                  pacienteActivo &&
                  ((p.turno_id && p.turno_id === pacienteActivo.turno_id) ||
                    (p.asesoria_id && p.asesoria_id === pacienteActivo.asesoria_id))

                return (
                  <div
                    key={p.turno_id || p.asesoria_id}
                    onClick={() => seleccionarPaciente(p)}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left relative ${
                      esSeleccionado
                        ? 'bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/30 shadow-md'
                        : 'bg-[var(--card)] border-[var(--border)] hover:border-cyan-400/60'
                    }`}
                  >
                    {/* Fila 1: Ojo + Fecha / Asesoramiento + Badge de Cálculo */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black">
                          {p.ojo || 'OD'}
                        </span>
                        <span className="text-[11px] font-bold text-[var(--secondary)]">
                          {p.fecha_cirugia ? `${p.fecha_cirugia} (${String(p.hora_inicio).slice(0, 5)}hs)` : 'En Asesoramiento'}
                        </span>
                      </div>

                      {p.lio_calculado ? (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[10px] font-extrabold flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          <span>Calculado ({p.lio_calculo_opciones?.length || 1})</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-extrabold flex items-center gap-1">
                          <AlertCircle size={11} />
                          <span>Pendiente</span>
                        </span>
                      )}
                    </div>

                    {/* Fila 2: Nombre del Paciente */}
                    <h3 className="text-sm font-extrabold text-[var(--foreground)] mt-2 tracking-tight truncate">
                      {p.paciente_nombre}
                    </h3>
                    <p className="text-xs text-[var(--secondary)] font-mono">DNI: {p.paciente_dni} • {p.paciente_obra_social}</p>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1 truncate">
                      {p.practica_nombre}
                    </p>

                    {/* Fila 3: Cirujano & Stock */}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--secondary)] mt-2 pt-2 border-t border-[var(--border)]">
                      <span className="truncate">👨‍⚕️ {p.cirujano_nombre}</span>
                      {p.lio_stock_reservado ? (
                        <span className="text-purple-600 dark:text-purple-400 font-extrabold flex items-center gap-1">
                          <PackageCheck size={12} /> Stock OK
                        </span>
                      ) : (
                        p.lio_calculado && <span className="text-slate-400">Stock s/reserva</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: MESA DE TRABAJO DE CÁLCULO DE LIO */}
        <div className="lg:col-span-8">
          {!pacienteActivo ? (
            <div className="p-16 text-center bg-[var(--card)] border border-dashed rounded-3xl space-y-3">
              <Eye size={40} className="text-slate-400 mx-auto opacity-50" />
              <h3 className="text-base font-bold text-[var(--foreground)]">Selecciona un paciente para calcular LIO</h3>
              <p className="text-xs text-[var(--secondary)] max-w-md mx-auto">
                Elige un paciente de la lista izquierda para cargar las opciones biométricas de lentes intraoculares, consultar estudios y guardar el cálculo.
              </p>
            </div>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 md:p-6 shadow-sm space-y-6">
              {/* ENCABEZADO DEL PACIENTE SELECCIONADO */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-xs font-black">
                      {pacienteActivo.ojo === 'OD' ? 'OJO DERECHO (OD)' : pacienteActivo.ojo === 'OI' ? 'OJO IZQUIERDO (OI)' : 'AMBOS OJOS (AO)'}
                    </span>
                    <span className="text-xs font-bold text-[var(--secondary)]">
                      {pacienteActivo.fecha_cirugia ? `Fecha Qx: ${pacienteActivo.fecha_cirugia}` : 'Caso en Asesoramiento'}
                    </span>
                    {pacienteActivo.lio_calculado && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-extrabold flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        <span>Calculado</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-extrabold text-[var(--foreground)] mt-1.5 tracking-tight">
                    {pacienteActivo.paciente_nombre}
                  </h2>
                  <p className="text-xs text-[var(--secondary)] font-mono">
                    DNI: {pacienteActivo.paciente_dni} • {pacienteActivo.paciente_obra_social} • Cirujano:{' '}
                    <b>{pacienteActivo.cirujano_nombre}</b>
                  </p>
                </div>

                {/* Botón Acceso Rápido a Biometrías / PDFs Geclisa */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAbrirEstudiosGeclisa}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-500/20 transition"
                  >
                    <FileText size={15} />
                    <span>📁 Ver Biometría & PDFs Geclisa</span>
                  </button>
                </div>
              </div>

              {/* GESTOR DINÁMICO DE OPCIONES MULTILENTE */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                      <Sparkles size={16} className="text-cyan-500" />
                      <span>Opciones de Lente Intraocular ({opcionesLio.length})</span>
                    </h3>
                    <p className="text-[11px] text-[var(--secondary)]">
                      Carga el Plan Principal y las opciones alternativas (dioptría limítrofe, lente tórico con eje o sulcus).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => agregarOpcionLio('alternativa')}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-[var(--border)] transition"
                    >
                      <Plus size={13} />
                      <span>+ Opción Alternativa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => agregarOpcionLio('torico')}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 transition"
                    >
                      <Plus size={13} />
                      <span>+ Opción Tórica</span>
                    </button>
                  </div>
                </div>

                {/* Listado de Tarjetas de Opciones */}
                <div className="space-y-3.5">
                  {opcionesLio.map((op, index) => {
                    const esPpal = op.tipo_opcion === 'principal' || index === 0

                    return (
                      <div
                        key={op.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          esPpal
                            ? 'bg-cyan-50/20 dark:bg-cyan-950/10 border-cyan-300 dark:border-cyan-800 ring-1 ring-cyan-500/20'
                            : 'bg-slate-50/50 dark:bg-slate-900/40 border-[var(--border)]'
                        }`}
                      >
                        {/* Header de la Opción */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
                          <div className="flex items-center gap-2 flex-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                                esPpal
                                  ? 'bg-cyan-500 text-black'
                                  : op.tipo_opcion === 'torico'
                                  ? 'bg-indigo-600 text-white'
                                  : op.tipo_opcion === 'sulcus'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-800 text-[var(--foreground)]'
                              }`}
                            >
                              {esPpal ? 'Plan A (Principal)' : `Opción ${index + 1}`}
                            </span>

                            <input
                              type="text"
                              value={op.etiqueta}
                              onChange={(e) => actualizarOpcionLio(op.id, 'etiqueta', e.target.value)}
                              className="font-extrabold text-xs text-[var(--foreground)] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-cyan-500 outline-none px-1"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={op.tipo_opcion}
                              onChange={(e) => actualizarOpcionLio(op.id, 'tipo_opcion', e.target.value)}
                              className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg border border-[var(--border)] text-[11px] font-bold text-[var(--foreground)] outline-none"
                            >
                              <option value="principal">Principal</option>
                              <option value="alternativa">Alternativa (+/-0.50D)</option>
                              <option value="torico">Tórica (Astigmatismo)</option>
                              <option value="sulcus">Sulcus (3 Piezas)</option>
                            </select>

                            {opcionesLio.length > 1 && (
                              <button
                                type="button"
                                onClick={() => eliminarOpcionLio(op.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                title="Eliminar esta opción"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Campos de la Opción */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-3">
                          {/* Modelo de LIO */}
                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[11px] font-bold text-[var(--secondary)]">Modelo / Tipo de LIO</label>
                            <input
                              type="text"
                              value={op.modelo}
                              onChange={(e) => actualizarOpcionLio(op.id, 'modelo', e.target.value)}
                              list={`modelos-list-${op.id}`}
                              placeholder="Ej: AcrySof IQ SN60WF (Alcon)"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-cyan-500"
                            />
                            <datalist id={`modelos-list-${op.id}`}>
                              {modelosLio.map((m) => (
                                <option key={m.id} value={`${m.modelo} (${m.marca})`} />
                              ))}
                            </datalist>
                          </div>

                          {/* Dioptría (Poder) */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[var(--secondary)]">Dioptría (Poder)</label>
                            <input
                              type="text"
                              value={op.dioptria}
                              onChange={(e) => actualizarOpcionLio(op.id, 'dioptria', e.target.value)}
                              placeholder="+21.50"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs font-extrabold text-blue-600 dark:text-blue-400 outline-none focus:border-cyan-500 font-mono"
                            />
                          </div>

                          {/* Target Refractivo */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[var(--secondary)]">Target Refractivo</label>
                            <select
                              value={op.target_refractivo}
                              onChange={(e) => actualizarOpcionLio(op.id, 'target_refractivo', e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-cyan-500"
                            >
                              {TARGETS_REFRACTIVOS.map((tg) => (
                                <option key={tg} value={tg}>
                                  {tg}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Parámetros Tóricos (si aplica) */}
                        {op.es_torico && (
                          <div className="mt-3 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                Valor Tórico (Cilindro)
                              </label>
                              <select
                                value={op.torico_valor || 3}
                                onChange={(e) => actualizarOpcionLio(op.id, 'torico_valor', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-indigo-300 dark:border-indigo-700 text-xs font-bold text-indigo-900 dark:text-indigo-200 outline-none"
                              >
                                {TORICOS_OPCIONES.map((to) => (
                                  <option key={to.valor} value={to.valor}>
                                    {to.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                  Eje / Ángulo de Alineación (°)
                                </label>
                                <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                                  {op.torico_eje || 90}°
                                </span>
                              </div>
                              <input
                                type="number"
                                min={0}
                                max={180}
                                value={op.torico_eje || 90}
                                onChange={(e) => actualizarOpcionLio(op.id, 'torico_eje', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-indigo-300 dark:border-indigo-700 text-xs font-mono font-bold text-[var(--foreground)] outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {/* Fórmula y Observaciones */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--secondary)]">Fórmula Utilizada</label>
                            <select
                              value={op.formula}
                              onChange={(e) => actualizarOpcionLio(op.id, 'formula', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] outline-none"
                            >
                              {FORMULAS_LIO.map((f) => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-[var(--secondary)]">Notas para Quirófano</label>
                            <input
                              type="text"
                              value={op.observaciones}
                              onChange={(e) => actualizarOpcionLio(op.id, 'observaciones', e.target.value)}
                              placeholder="Ej: Si ACD < 3.0mm o en caso de desgarro capsular..."
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* BARRA INFERIOR DE ACCIONES Y RESERVA DE STOCK */}
              <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Gestión de Reserva de Stock (Quirófano) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={reservandoStock || !pacienteActivo.turno_id}
                    onClick={handleToggleReservaStock}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                      pacienteActivo.lio_stock_reservado
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] hover:text-[var(--foreground)] border-[var(--border)]'
                    }`}
                    title="Control de Quirófano: confirmar que las lentes ya están físicamente separadas en quirófano o en consignación"
                  >
                    {reservandoStock ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <PackageCheck size={15} />
                    )}
                    <span>
                      {pacienteActivo.lio_stock_reservado ? '✔ Stock Físico Reservado' : '📦 Marcar Stock Reservado'}
                    </span>
                  </button>
                  {pacienteActivo.lio_stock_reservado_at && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({formatearHoraDesdeIso(pacienteActivo.lio_stock_reservado_at)})
                    </span>
                  )}
                </div>

                {/* Guardar Cálculo */}
                <button
                  type="button"
                  disabled={guardando}
                  onClick={handleGuardarCalculo}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
                >
                  {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>💾 Guardar y Confirmar Cálculo de LIO</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. MODAL VISOR DE ESTUDIOS & BIOMETRÍAS DE GECLISA */}
      {modalArchivosAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  Estudios & Biometrías de Geclisa — {pacienteActivo?.paciente_nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalArchivosAbierto(false)
                  setArchivoVisor(null)
                }}
                className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {cargandoArchivos ? (
                <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                  <span>Consultando historia clínica y biometrías en Geclisa...</span>
                </div>
              ) : archivosGeclisa.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--secondary)] bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed">
                  No se encontraron archivos o biometrías adjuntas en Geclisa para este paciente.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {archivosGeclisa.map((arc) => (
                    <div
                      key={arc.as_id}
                      className="p-3.5 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/50 hover:border-blue-400 transition flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {arc.clase || 'ESTUDIO'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">#{arc.as_id}</span>
                        </div>
                        <h4 className="text-xs font-bold text-[var(--foreground)] mt-1.5 leading-snug line-clamp-2">
                          {arc.titulo}
                        </h4>
                        <p className="text-[10px] text-[var(--secondary)] mt-1">
                          📅 {arc.fecha} {arc.hora} {arc.prestador && `• ${arc.prestador}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                        <button
                          type="button"
                          onClick={() => setArchivoVisor(arc)}
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm transition"
                        >
                          <Eye size={12} />
                          <span>Ver Estudio</span>
                        </button>
                        <a
                          href={`${BACKEND_URL}/api/geclisa/archivos/${arc.as_id}/descargar`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 rounded-xl transition"
                          title="Descargar archivo original"
                        >
                          <Download size={13} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. VISOR IN-APP DE PANTALLA COMPLETA PARA PDF / ESTUDIO */}
      {archivoVisor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fade-in">
          <div
            className={`bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
              visorPantallaCompleta ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[88vh]'
            }`}
          >
            {/* Header Visor */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText size={18} className="text-cyan-400 shrink-0" />
                <div className="truncate">
                  <h3 className="text-xs sm:text-sm font-extrabold truncate">{archivoVisor.titulo}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Geclisa Doc #{archivoVisor.as_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVisorPantallaCompleta(!visorPantallaCompleta)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
                  title={visorPantallaCompleta ? 'Restaurar tamaño' : 'Pantalla completa'}
                >
                  {visorPantallaCompleta ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <a
                  href={`${BACKEND_URL}/api/geclisa/archivos/${archivoVisor.as_id}/ver`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Abrir en pestaña nueva"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setArchivoVisor(null)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* iFrame Embebido */}
            <div className="flex-1 bg-slate-950">
              <iframe
                src={`${BACKEND_URL}/api/geclisa/archivos/${archivoVisor.as_id}/ver`}
                className="w-full h-full border-0"
                title="Visor de Estudio"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
