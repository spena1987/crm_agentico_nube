'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Stethoscope,
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Send,
  MessageSquare,
  ShieldAlert,
  Archive,
  Layers,
  XCircle,
  Check,
  Building2,
  Activity,
  Phone,
  RotateCcw,
  CalendarDays,
  X
} from 'lucide-react'
import Link from 'next/link'
import { BACKEND_URL } from '@/lib/api'
import ModalPlantillasWhatsAppQuirurgicas from '@/components/ModalPlantillasWhatsAppQuirurgicas'
import ModalCerrarCasoQuirurgico from '@/components/ModalCerrarCasoQuirurgico'

interface PacienteData {
  id: string
  nombre: string
  dni?: string | null
  telefono?: string | null
  obra_social?: string | null
  email?: string | null
}

interface AsesoriaCasoPipeline {
  id: string
  paciente_id: string
  pacientes?: PacienteData | null
  practica_codigo?: string | null
  practica_nombre: string
  medico_cirujano_nombre?: string | null
  medico_derivador_nombre?: string | null
  cobertura_obra_social?: string | null
  monto_extra?: number
  moneda_extra?: string
  fecha_probable_cirugia?: string | null
  fecha_definitiva_cirugia?: string | null
  estado: string
  situacion_paciente?: string | null
  motivo_cancelacion?: string | null
  proxima_accion_fecha?: string | null
  proxima_accion_texto?: string | null
  ultimo_contacto_at?: string | null
  dias_sin_contacto?: number
  es_alerta?: boolean
  es_critico?: boolean
  created_at: string
  updated_at?: string
}

interface MetricasPipeline {
  total_casos: number
  casos_activos: number
  casos_en_alerta: number
  casos_operados?: number
  casos_cancelados?: number
  tasa_conversion?: number
  total_monto_ars: number
  total_monto_usd: number
  total_operado_ars?: number
  total_operado_usd?: number
  sla_dias_alerta: number
  sla_dias_critico: number
}

// 4 Columnas para casos ABIERTOS / EN GESTIÓN
const ETAPAS_COLUMNAS_ACTIVAS = [
  {
    id: 'derivado',
    titulo: '1. Derivados',
    subtitulo: 'Pacientes recién ingresados',
    colorHeader: 'bg-blue-600/10 text-blue-400 border-blue-500/30',
    colorDot: 'bg-blue-400'
  },
  {
    id: 'en_asesoramiento',
    titulo: '2. En Asesoramiento',
    subtitulo: 'En contacto inicial y cotización',
    colorHeader: 'bg-amber-600/10 text-amber-400 border-amber-500/30',
    colorDot: 'bg-amber-400'
  },
  {
    id: 'en_analisis',
    titulo: '3. En Análisis',
    subtitulo: 'Evaluando presupuesto / prepaga',
    colorHeader: 'bg-purple-600/10 text-purple-400 border-purple-500/30',
    colorDot: 'bg-purple-400'
  },
  {
    id: 'confirmado',
    titulo: '4. Confirmados',
    subtitulo: 'Fecha de quirófano coordinada',
    colorHeader: 'bg-emerald-600/10 text-emerald-300 border-emerald-500/30',
    colorDot: 'bg-emerald-400'
  }
]

export default function PipelineQuirurgicoPage() {
  const [etapas, setEtapas] = useState<Record<string, AsesoriaCasoPipeline[]>>({})
  const [metricas, setMetricas] = useState<MetricasPipeline | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Vista activa: 'activos' (Pipeline Kanban de 4 etapas) o 'cerrados' (Historial Operados y Cancelados)
  const [vistaActual, setVistaActual] = useState<'activos' | 'cerrados'>('activos')
  const [subfiltroCerrados, setSubfiltroCerrados] = useState<'todos' | 'operado' | 'cancelado'>('todos')

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroCirujano, setFiltroCirujano] = useState<string>('todos')
  const [filtroObraSocial, setFiltroObraSocial] = useState<string>('todos')
  const [filtroPractica, setFiltroPractica] = useState<string>('todas')
  const [filtroFechaTipo, setFiltroFechaTipo] = useState<
    'todas' | 'vencidas' | '7dias' | '30dias' | 'sin_fecha' | 'personalizado'
  >('todas')
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  const [soloAlertas, setSoloAlertas] = useState(false)

  // Estados de Drag & Drop
  const [draggedCaso, setDraggedCaso] = useState<AsesoriaCasoPipeline | null>(null)
  const [dragOverColumnaId, setDragOverColumnaId] = useState<string | null>(null)

  // Feedback y estados de acción
  const [actualizandoCasoId, setActualizandoCasoId] = useState<string | null>(null)
  const [notificacionExito, setNotificacionExito] = useState<string | null>(null)

  // Modales
  const [modalWhatsAppOpen, setModalWhatsAppOpen] = useState(false)
  const [casoParaWhatsApp, setCasoParaWhatsApp] = useState<AsesoriaCasoPipeline | null>(null)

  const [modalCierreOpen, setModalCierreOpen] = useState(false)
  const [casoParaCierre, setCasoParaCierre] = useState<AsesoriaCasoPipeline | null>(null)

  // Cargar Pipeline
  const fetchPipeline = async () => {
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/pipeline-quirurgico`)
      const data = await res.json()
      if (res.ok && data.success) {
        setEtapas(data.etapas || {})
        setMetricas(data.metricas || null)
      } else {
        throw new Error(data.detail || 'Error al obtener datos del pipeline.')
      }
    } catch (err: any) {
      console.error('Error cargando pipeline:', err)
      setError('No se pudo cargar el pipeline quirúrgico.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchPipeline()
  }, [])

  // Mostrar mensaje de éxito temporal
  const mostrarToast = (mensaje: string) => {
    setNotificacionExito(mensaje)
    setTimeout(() => {
      setNotificacionExito(null)
    }, 3500)
  }

  // Mover etapa vía Drag & Drop con actualización optimista inmediata
  const handleMoverEtapaDrop = async (caso: AsesoriaCasoPipeline, nuevaEtapa: string) => {
    if (caso.estado === nuevaEtapa) return

    // Guardar estado previo para posible rollback
    const etapasPrevias = { ...etapas }

    // Actualización optimista inmediata en UI
    setEtapas((prev) => {
      const origen = (prev[caso.estado] || []).filter((c) => c.id !== caso.id)
      const casoActualizado: AsesoriaCasoPipeline = {
        ...caso,
        estado: nuevaEtapa,
        updated_at: new Date().toISOString()
      }
      const destino = [casoActualizado, ...(prev[nuevaEtapa] || [])]
      return {
        ...prev,
        [caso.estado]: origen,
        [nuevaEtapa]: destino
      }
    })

    try {
      setActualizandoCasoId(caso.id)
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevaEtapa })
      })
      if (!res.ok) throw new Error('Error al mover de etapa.')
      
      const colDestino = ETAPAS_COLUMNAS_ACTIVAS.find((c) => c.id === nuevaEtapa)
      mostrarToast(`Caso movido a ${colDestino ? colDestino.titulo : nuevaEtapa}.`)
    } catch (err) {
      console.error('Error al mover de etapa por drag and drop:', err)
      setEtapas(etapasPrevias)
      setError('No se pudo actualizar la etapa del caso.')
    } finally {
      setActualizandoCasoId(null)
    }
  }

  // Lista única de cirujanos, obras sociales y prácticas vigentes para los filtros
  const { listaCirujanos, listaObrasSociales, listaPracticas } = useMemo(() => {
    const cirujanosSet = new Set<string>()
    const obrasSet = new Set<string>()
    const practicasMap = new Map<string, number>()

    Object.entries(etapas).forEach(([etapaKey, lista]) => {
      lista.forEach((c) => {
        if (c.medico_cirujano_nombre?.trim()) {
          cirujanosSet.add(c.medico_cirujano_nombre.trim())
        }
        const os = c.cobertura_obra_social || c.pacientes?.obra_social
        if (os?.trim()) {
          obrasSet.add(os.trim())
        }
        if (c.practica_nombre?.trim()) {
          const pr = c.practica_nombre.trim()
          practicasMap.set(pr, (practicasMap.get(pr) || 0) + 1)
        }
      })
    })

    return {
      listaCirujanos: Array.from(cirujanosSet).sort(),
      listaObrasSociales: Array.from(obrasSet).sort(),
      listaPracticas: Array.from(practicasMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([nombre, count]) => ({ nombre, count }))
    }
  }, [etapas])

  // Indicador si hay algún filtro activo y función para restablecer
  const hayFiltrosActivos =
    filtroTexto !== '' ||
    filtroCirujano !== 'todos' ||
    filtroObraSocial !== 'todos' ||
    filtroPractica !== 'todas' ||
    filtroFechaTipo !== 'todas' ||
    soloAlertas ||
    fechaDesde !== '' ||
    fechaHasta !== ''

  const handleLimpiarFiltros = () => {
    setFiltroTexto('')
    setFiltroCirujano('todos')
    setFiltroObraSocial('todos')
    setFiltroPractica('todas')
    setFiltroFechaTipo('todas')
    setFechaDesde('')
    setFechaHasta('')
    setSoloAlertas(false)
  }

  // Cambiar etapa directamente desde el Kanban o abrir modal de cierre si es operado/cancelado
  const handleSeleccionarEtapa = async (caso: AsesoriaCasoPipeline, nuevaEtapa: string) => {
    if (nuevaEtapa === 'operado' || nuevaEtapa === 'cancelado') {
      setCasoParaCierre(caso)
      setModalCierreOpen(true)
      return
    }

    try {
      setActualizandoCasoId(caso.id)
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevaEtapa })
      })
      if (!res.ok) throw new Error('Error al mover de etapa.')
      mostrarToast(`Etapa actualizada a ${nuevaEtapa.replace('_', ' ')}.`)
      await fetchPipeline()
    } catch (err) {
      console.error('Error al mover de etapa:', err)
    } finally {
      setActualizandoCasoId(null)
    }
  }

  // Acción rápida: Marcar como contactado hoy (resetea SLA)
  const handleMarcarContactadoHoy = async (caso: AsesoriaCasoPipeline) => {
    try {
      setActualizandoCasoId(caso.id)
      const nowIso = new Date().toISOString()
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ultimo_contacto_at: nowIso })
      })
      if (!res.ok) throw new Error('Error al actualizar contacto.')
      mostrarToast(`Contacto registrado hoy para ${caso.pacientes?.nombre || 'el paciente'}.`)
      await fetchPipeline()
    } catch (err) {
      console.error('Error al registrar contacto:', err)
    } finally {
      setActualizandoCasoId(null)
    }
  }

  // Acción rápida: Abrir modal WhatsApp
  const handleAbrirWhatsApp = (caso: AsesoriaCasoPipeline) => {
    setCasoParaWhatsApp(caso)
    setModalWhatsAppOpen(true)
  }

  // Filtrado de casos por etapa
  const matchFiltrosGenerales = (caso: AsesoriaCasoPipeline, q: string) => {
    const pacNombre = (caso.pacientes?.nombre || '').toLowerCase()
    const pacDni = (caso.pacientes?.dni || '').toLowerCase()
    const cirugia = (caso.practica_nombre || '').toLowerCase()
    const cirujano = (caso.medico_cirujano_nombre || '').toLowerCase()
    const motivo = (caso.motivo_cancelacion || '').toLowerCase()
    const os = (caso.cobertura_obra_social || caso.pacientes?.obra_social || '').toLowerCase()

    const matchTexto =
      !q ||
      pacNombre.includes(q) ||
      pacDni.includes(q) ||
      cirugia.includes(q) ||
      cirujano.includes(q) ||
      motivo.includes(q)

    const matchCirujano =
      filtroCirujano === 'todos' ||
      (caso.medico_cirujano_nombre || '').trim() === filtroCirujano

    const matchObraSocial =
      filtroObraSocial === 'todos' ||
      os.trim().toLowerCase() === filtroObraSocial.toLowerCase()

    const matchPractica =
      filtroPractica === 'todas' ||
      (caso.practica_nombre || '').trim().toLowerCase() === filtroPractica.toLowerCase()

    // Lógica de fechas (fecha_definitiva_cirugia o fecha_probable_cirugia)
    let matchFecha = true
    const fechaCirugia = caso.fecha_definitiva_cirugia || caso.fecha_probable_cirugia

    if (filtroFechaTipo !== 'todas') {
      const hoy = new Date()
      const hoyStr = hoy.toISOString().slice(0, 10) // YYYY-MM-DD

      if (filtroFechaTipo === 'sin_fecha') {
        matchFecha = !fechaCirugia
      } else if (!fechaCirugia) {
        matchFecha = false
      } else {
        const fechaCasoStr = fechaCirugia.slice(0, 10)

        if (filtroFechaTipo === 'vencidas') {
          matchFecha = fechaCasoStr < hoyStr
        } else if (filtroFechaTipo === '7dias') {
          const d7 = new Date(hoy)
          d7.setDate(d7.getDate() + 7)
          const d7Str = d7.toISOString().slice(0, 10)
          matchFecha = fechaCasoStr >= hoyStr && fechaCasoStr <= d7Str
        } else if (filtroFechaTipo === '30dias') {
          const d30 = new Date(hoy)
          d30.setDate(d30.getDate() + 30)
          const d30Str = d30.toISOString().slice(0, 10)
          matchFecha = fechaCasoStr >= hoyStr && fechaCasoStr <= d30Str
        } else if (filtroFechaTipo === 'personalizado') {
          if (fechaDesde && fechaCasoStr < fechaDesde) {
            matchFecha = false
          }
          if (fechaHasta && fechaCasoStr > fechaHasta) {
            matchFecha = false
          }
        }
      }
    }

    return matchTexto && matchCirujano && matchObraSocial && matchPractica && matchFecha
  }

  // Casos activos filtrados por columna
  const etapasActivasFiltradas = useMemo(() => {
    const q = filtroTexto.toLowerCase().trim()
    const res: Record<string, AsesoriaCasoPipeline[]> = {}

    ETAPAS_COLUMNAS_ACTIVAS.forEach((col) => {
      res[col.id] = (etapas[col.id] || []).filter((caso) => {
        const matchGen = matchFiltrosGenerales(caso, q)
        const matchAlerta = !soloAlertas || caso.es_critico || caso.es_alerta
        return matchGen && matchAlerta
      })
    })

    return res
  }, [
    etapas,
    filtroTexto,
    filtroCirujano,
    filtroObraSocial,
    filtroPractica,
    filtroFechaTipo,
    fechaDesde,
    fechaHasta,
    soloAlertas
  ])

  // Casos cerrados (Operados y Cancelados)
  const casosCerradosFiltrados = useMemo(() => {
    const q = filtroTexto.toLowerCase().trim()
    const operados = etapas['operado'] || []
    const cancelados = etapas['cancelado'] || []
    let lista: AsesoriaCasoPipeline[] = []

    if (subfiltroCerrados === 'todos') {
      lista = [...operados, ...cancelados]
    } else if (subfiltroCerrados === 'operado') {
      lista = operados
    } else {
      lista = cancelados
    }

    return lista.filter((caso) => matchFiltrosGenerales(caso, q))
  }, [
    etapas,
    filtroTexto,
    filtroCirujano,
    filtroObraSocial,
    filtroPractica,
    filtroFechaTipo,
    fechaDesde,
    fechaHasta,
    subfiltroCerrados
  ])

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 min-w-0 pb-16 animate-fade-in">
      
      {/* Toast de Éxito */}
      {notificacionExito && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-xl backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{notificacionExito}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. HEADER PRINCIPAL DEL PIPELINE */}
      {/* ==================================================================== */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl bg-neutral-900 border border-blue-500/20 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shadow-inner">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Pipeline de Conversión Quirúrgica (Lead-to-Surgery)
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/40">
                En Vivo
              </span>
            </h1>
            <p className="text-xs text-[var(--secondary)]">
              Embudo comercial y clínico de pacientes en proceso de asesoramiento, cotización y quirófano.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/ajustes"
            className="px-3.5 py-2 rounded-xl border border-[var(--border)] hover:bg-neutral-800 text-xs font-bold text-gray-300 transition-all flex items-center gap-1.5"
          >
            <Stethoscope size={13} className="text-blue-400" />
            Configurar SLA & Plantillas
          </Link>

          <button
            type="button"
            onClick={fetchPipeline}
            disabled={cargando}
            className="p-2.5 rounded-xl border border-[var(--border)] hover:bg-neutral-800 text-gray-300 hover:text-white transition-all"
            title="Refrescar datos"
          >
            <RefreshCw size={14} className={cargando ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. SELECTOR DE VISTA: PIPELINE ACTIVO vs HISTORIAL CERRADOS */}
      {/* ==================================================================== */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[var(--border)] pb-2">
        <div className="flex items-center gap-2 bg-neutral-900/90 p-1 rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setVistaActual('activos')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              vistaActual === 'activos'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers size={14} />
            Tablero Activo
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
              vistaActual === 'activos' ? 'bg-blue-900 text-blue-200' : 'bg-neutral-800 text-gray-400'
            }`}>
              {metricas?.casos_activos ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVistaActual('cerrados')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              vistaActual === 'cerrados'
                ? 'bg-neutral-800 text-white shadow-md border border-[var(--border)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Archive size={14} />
            Historial de Cerrados
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
              vistaActual === 'cerrados' ? 'bg-neutral-700 text-gray-200' : 'bg-neutral-800 text-gray-400'
            }`}>
              {(metricas?.casos_operados ?? 0) + (metricas?.casos_cancelados ?? 0)}
            </span>
          </button>
        </div>

        {/* Indicador de conversión / resumen rápido */}
        {metricas && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity size={13} className="text-emerald-400" />
              Efectividad Histórica:
              <strong className="text-emerald-300 font-mono font-bold">
                {metricas.tasa_conversion ?? 0}%
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. TARJETAS DE KPIS SUPERIORES SEGÚN VISTA */}
      {/* ==================================================================== */}
      {metricas && vistaActual === 'activos' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Ingresos en Seguimiento (ARS) */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
              <DollarSign size={13} className="text-emerald-400" />
              Monto en Cotización (ARS)
            </span>
            <p className="text-lg font-black text-white font-mono">
              $ {metricas.total_monto_ars.toLocaleString('es-AR')}
            </p>
            <span className="text-[10px] text-gray-500 block">
              En casos activos de asesoramiento
            </span>
          </div>

          {/* KPI 2: Ingresos en Seguimiento (USD) */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
              <DollarSign size={13} className="text-blue-400" />
              Monto en Cotización (USD)
            </span>
            <p className="text-lg font-black text-blue-300 font-mono">
              USD {metricas.total_monto_usd.toLocaleString('es-AR')}
            </p>
            <span className="text-[10px] text-gray-500 block">
              En moneda extranjera
            </span>
          </div>

          {/* KPI 3: Casos Quirúrgicos Activos */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
              <Stethoscope size={13} className="text-purple-400" />
              Procedimientos Activos
            </span>
            <p className="text-lg font-black text-purple-300 font-mono">
              {metricas.casos_activos} {metricas.casos_activos === 1 ? 'Caso' : 'Casos'}
            </p>
            <span className="text-[10px] text-gray-500 block">
              De {metricas.total_casos} registrados históricamente
            </span>
          </div>

          {/* KPI 4: Alertas de Tiempo SLA */}
          <div className={`p-4 rounded-2xl border space-y-1 ${
            metricas.casos_en_alerta > 0
              ? 'bg-red-950/20 border-red-500/40 text-red-300'
              : 'bg-neutral-900/80 border-[var(--border)] text-gray-300'
          }`}>
            <span className="text-[11px] font-bold flex items-center gap-1.5">
              <ShieldAlert size={13} className={metricas.casos_en_alerta > 0 ? 'text-red-400' : 'text-emerald-400'} />
              Alertas SLA de Seguimiento
            </span>
            <p className="text-lg font-black font-mono">
              {metricas.casos_en_alerta} {metricas.casos_en_alerta === 1 ? 'Paciente' : 'Pacientes'}
            </p>
            <span className="text-[10px] opacity-80 block">
              {metricas.casos_en_alerta > 0
                ? `Sin contacto hace más de ${metricas.sla_dias_alerta} días`
                : 'Todos los casos al día'}
            </span>
          </div>
        </div>
      )}

      {metricas && vistaActual === 'cerrados' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI Cerrados 1: Tasa de Conversión */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-emerald-500/30 space-y-1">
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
              <Activity size={13} />
              Tasa de Éxito (Conversión)
            </span>
            <p className="text-xl font-black text-emerald-300 font-mono">
              {metricas.tasa_conversion ?? 0}%
            </p>
            <span className="text-[10px] text-gray-400 block">
              Cirugías operadas vs canceladas
            </span>
          </div>

          {/* KPI Cerrados 2: Total Operados */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-bold text-teal-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Cirugías Realizadas
            </span>
            <p className="text-xl font-black text-white font-mono">
              {metricas.casos_operados ?? 0}
            </p>
            <span className="text-[10px] text-gray-500 block">
              Intervenciones concluidas con éxito
            </span>
          </div>

          {/* KPI Cerrados 3: Total Cancelados */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-bold text-red-400 flex items-center gap-1.5">
              <XCircle size={13} />
              Casos Desistidos / Cancelados
            </span>
            <p className="text-xl font-black text-red-300 font-mono">
              {metricas.casos_cancelados ?? 0}
            </p>
            <span className="text-[10px] text-gray-500 block">
              Desistimiento por costos o prepaga
            </span>
          </div>

          {/* KPI Cerrados 4: Facturación en Operados */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-1">
            <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
              <DollarSign size={13} />
              Monto Facturado (ARS)
            </span>
            <p className="text-lg font-black text-amber-300 font-mono">
              $ {(metricas.total_operado_ars || 0).toLocaleString('es-AR')}
            </p>
            <span className="text-[10px] text-gray-500 block">
              Total copagos y extras concretados
            </span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. BARRA DE HERRAMIENTAS Y FILTROS AVANZADOS */}
      {/* ==================================================================== */}
      <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          
          {/* Buscador de Texto */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por paciente, DNI, cirugía, cirujano o motivo..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-[var(--border)] focus:border-blue-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
            />
          </div>

          {/* Filtro por Práctica / Cirugía */}
          <div className="flex items-center gap-1.5 min-w-[170px] max-w-[220px]">
            <Stethoscope size={13} className="text-blue-400 shrink-0" />
            <select
              value={filtroPractica}
              onChange={(e) => setFiltroPractica(e.target.value)}
              className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
              title="Filtrar por tipo de práctica quirúrgica"
            >
              <option value="todas">Todas las Prácticas ({listaPracticas.reduce((a, b) => a + b.count, 0)})</option>
              {listaPracticas.map((p) => (
                <option key={p.nombre} value={p.nombre}>
                  {p.nombre} ({p.count})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Cirujano */}
          <div className="flex items-center gap-1.5 min-w-[160px] max-w-[200px]">
            <User size={13} className="text-emerald-400 shrink-0" />
            <select
              value={filtroCirujano}
              onChange={(e) => setFiltroCirujano(e.target.value)}
              className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
            >
              <option value="todos">Todos los Cirujanos</option>
              {listaCirujanos.map((cir) => (
                <option key={cir} value={cir}>
                  Dr/a. {cir}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Obra Social */}
          <div className="flex items-center gap-1.5 min-w-[160px] max-w-[200px]">
            <Building2 size={13} className="text-purple-400 shrink-0" />
            <select
              value={filtroObraSocial}
              onChange={(e) => setFiltroObraSocial(e.target.value)}
              className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
            >
              <option value="todos">Todas las Obras Sociales</option>
              {listaObrasSociales.map((os) => (
                <option key={os} value={os}>
                  {os}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Fecha de Cirugía (Presets) */}
          <div className="flex items-center gap-1.5 min-w-[170px]">
            <Calendar size={13} className="text-amber-400 shrink-0" />
            <select
              value={filtroFechaTipo}
              onChange={(e) => setFiltroFechaTipo(e.target.value as any)}
              className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
              title="Filtrar por fecha de cirugía"
            >
              <option value="todas">Todas las Fechas</option>
              <option value="vencidas">⚠️ Vencidas (&lt; Hoy)</option>
              <option value="7dias">⏱️ Próximos 7 días</option>
              <option value="30dias">📅 Próximos 30 días</option>
              <option value="sin_fecha">❓ Sin fecha asignada</option>
              <option value="personalizado">🎯 Rango Personalizado...</option>
            </select>
          </div>

          {/* En vista Activa: Toggle Alertas SLA */}
          {vistaActual === 'activos' && (
            <button
              type="button"
              onClick={() => setSoloAlertas(!soloAlertas)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0 ${
                soloAlertas
                  ? 'bg-red-950 text-red-300 border-red-500/50 shadow-sm'
                  : 'bg-neutral-950 text-gray-400 border-[var(--border)] hover:text-white'
              }`}
            >
              <Clock size={13} className={soloAlertas ? 'text-red-400' : 'text-gray-400'} />
              Solo Alertas SLA
            </button>
          )}

          {/* En vista Cerrados: Sub-filtro Operado vs Cancelado */}
          {vistaActual === 'cerrados' && (
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-[var(--border)] text-xs">
              <button
                type="button"
                onClick={() => setSubfiltroCerrados('todos')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  subfiltroCerrados === 'todos' ? 'bg-neutral-800 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSubfiltroCerrados('operado')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  subfiltroCerrados === 'operado' ? 'bg-teal-950 text-teal-300 border border-teal-500/30' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <CheckCircle2 size={12} className="text-teal-400" />
                Operados
              </button>
              <button
                type="button"
                onClick={() => setSubfiltroCerrados('cancelado')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  subfiltroCerrados === 'cancelado' ? 'bg-red-950 text-red-300 border border-red-500/30' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <XCircle size={12} className="text-red-400" />
                Cancelados
              </button>
            </div>
          )}

          {/* Botón Limpiar Filtros */}
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={handleLimpiarFiltros}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white border border-[var(--border)] text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={12} className="text-blue-400" />
              Limpiar
            </button>
          )}

        </div>

        {/* Fila 2: Selector de Rango de Fechas Personalizado */}
        {filtroFechaTipo === 'personalizado' && (
          <div className="pt-2 border-t border-[var(--border)]/60 flex items-center flex-wrap gap-3 text-xs animate-in fade-in slide-in-from-top-1">
            <span className="font-bold text-gray-400 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-amber-400" />
              Rango de Fecha de Cirugía:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-gray-400">Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="bg-neutral-950 border border-[var(--border)] rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-gray-400">Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="bg-neutral-950 border border-[var(--border)] rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            {(fechaDesde || fechaHasta) && (
              <button
                type="button"
                onClick={() => {
                  setFechaDesde('')
                  setFechaHasta('')
                }}
                className="text-[11px] text-gray-400 hover:text-red-300 underline transition-colors"
              >
                Borrar fechas
              </button>
            )}
          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* 5A. TABLERO KANBAN DE ETAPAS ABIERTAS / ACTIVAS (4 COLUMNAS) */}
      {/* ==================================================================== */}
      {vistaActual === 'activos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 items-start">
          {ETAPAS_COLUMNAS_ACTIVAS.map((col) => {
            const casosColumna = etapasActivasFiltradas[col.id] || []
            const montoTotalColumna = casosColumna.reduce(
              (acc, c) => acc + Number(c.monto_extra || 0),
              0
            )

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDragEnter={() => {
                  if (draggedCaso && draggedCaso.estado !== col.id) {
                    setDragOverColumnaId(col.id)
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverColumnaId(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverColumnaId(null)
                  if (draggedCaso) {
                    handleMoverEtapaDrop(draggedCaso, col.id)
                  }
                }}
                className={`flex flex-col rounded-2xl p-3 min-h-[520px] space-y-3 transition-all duration-200 ${
                  dragOverColumnaId === col.id
                    ? 'ring-2 ring-blue-500/80 bg-blue-950/25 border-blue-500/60 shadow-lg shadow-blue-950/40'
                    : 'bg-neutral-900/60 border border-[var(--border)]'
                }`}
              >
                {/* Header de la Columna */}
                <div className={`p-2.5 rounded-xl border ${col.colorHeader} space-y-1`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${col.colorDot}`} />
                      <h3 className="text-xs font-bold">{col.titulo}</h3>
                    </div>
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded-full bg-black/40">
                      {casosColumna.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] opacity-80">
                    <span className="truncate">{col.subtitulo}</span>
                    {montoTotalColumna > 0 && (
                      <span className="font-mono font-bold shrink-0">
                        $ {montoTotalColumna.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Lista de Tarjetas */}
                <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                  {casosColumna.length === 0 ? (
                    <div className={`p-6 text-center text-xs border border-dashed rounded-xl transition-all ${
                      dragOverColumnaId === col.id
                        ? 'border-blue-400/60 text-blue-300 bg-blue-950/30'
                        : 'border-[var(--border)] text-gray-500'
                    }`}>
                      {dragOverColumnaId === col.id ? 'Soltar aquí para mover' : 'Sin cirugías en esta etapa'}
                    </div>
                  ) : (
                    casosColumna.map((caso) => {
                      const pac = caso.pacientes
                      const isCritico = caso.es_critico
                      const isAlerta = caso.es_alerta
                      const os = caso.cobertura_obra_social || pac?.obra_social

                      return (
                        <div
                          key={caso.id}
                          draggable={true}
                          onDragStart={(e) => {
                            setDraggedCaso(caso)
                            e.dataTransfer.setData('text/plain', caso.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDraggedCaso(null)
                            setDragOverColumnaId(null)
                          }}
                          className={`p-3.5 rounded-xl border transition-all space-y-2.5 bg-neutral-950/80 hover:bg-neutral-950 group relative cursor-grab active:cursor-grabbing select-none ${
                            draggedCaso?.id === caso.id
                              ? 'opacity-40 scale-95 ring-2 ring-blue-500/80 border-blue-500'
                              : isCritico
                              ? 'border-red-500/50 shadow-sm shadow-red-950/20 hover:border-red-400'
                              : isAlerta
                              ? 'border-amber-500/40 hover:border-amber-400'
                              : 'border-[var(--border)] hover:border-blue-500/50 hover:shadow-md'
                          }`}
                        >
                          {/* Cabecera de la Tarjeta */}
                          <div className="flex items-center justify-between gap-1.5">
                            <Link
                              href={`/pacientes?id=${caso.paciente_id}`}
                              className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1 truncate"
                              title="Ver expediente completo"
                            >
                              <span className="truncate">{pac?.nombre || 'Paciente'}</span>
                              <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 shrink-0 text-blue-400" />
                            </Link>

                            {/* Chip SLA */}
                            {caso.dias_sin_contacto !== undefined && (
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 flex items-center gap-1 ${
                                  isCritico
                                    ? 'bg-red-950 text-red-300 border-red-500/60'
                                    : isAlerta
                                    ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                                    : 'bg-neutral-900 text-gray-400 border-[var(--border)]'
                                }`}
                                title={`Último contacto: hace ${caso.dias_sin_contacto} días`}
                              >
                                <Clock size={10} />
                                {caso.dias_sin_contacto === 0
                                  ? 'Hoy'
                                  : `${caso.dias_sin_contacto} d`}
                              </span>
                            )}
                          </div>

                          {/* Detalle Quirúrgico y Médico */}
                          <div className="text-[11px] space-y-1">
                            <div className="flex items-center gap-1 text-gray-300 font-medium">
                              <Stethoscope size={12} className="text-blue-400 shrink-0" />
                              <span className="truncate">{caso.practica_nombre}</span>
                            </div>

                            {caso.medico_cirujano_nombre && (
                              <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                                <User size={11} className="text-emerald-400 shrink-0" />
                                <span className="truncate">Dr/a. {caso.medico_cirujano_nombre}</span>
                              </div>
                            )}

                            {os && (
                              <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                                <Building2 size={11} className="text-blue-400 shrink-0" />
                                <span className="truncate">{os}</span>
                              </div>
                            )}

                            {(caso.fecha_definitiva_cirugia || caso.fecha_probable_cirugia) && (
                              <div className="flex items-center gap-1 text-gray-400 text-[10px] font-mono">
                                <Calendar size={11} className="text-purple-400 shrink-0" />
                                <span className="truncate">
                                  {caso.fecha_definitiva_cirugia
                                    ? `Definitiva: ${caso.fecha_definitiva_cirugia}`
                                    : `Probable: ${caso.fecha_probable_cirugia}`}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Próxima Acción */}
                          {caso.proxima_accion_texto && (
                            <div className="p-1.5 rounded-lg bg-blue-950/30 border border-blue-500/20 text-[10px] text-blue-300 flex items-start gap-1">
                              <Clock size={11} className="shrink-0 mt-0.5 text-blue-400" />
                              <span className="truncate">{caso.proxima_accion_texto}</span>
                            </div>
                          )}

                          {/* Botones de Acción Rápida (WhatsApp + Contacto Hoy) */}
                          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-1.5">
                            
                            {/* Monto de la Cirugía */}
                            <span className="text-[11px] font-mono font-bold text-amber-300 truncate">
                              {Number(caso.monto_extra || 0) > 0
                                ? `$ ${Number(caso.monto_extra).toLocaleString()} ${caso.moneda_extra || 'ARS'}`
                                : 'Sin cotizar'}
                            </span>

                            <div className="flex items-center gap-1">
                              {/* Botón WhatsApp */}
                              <button
                                type="button"
                                onClick={() => handleAbrirWhatsApp(caso)}
                                className="p-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition-colors"
                                title="Enviar mensaje de WhatsApp con plantillas"
                              >
                                <MessageSquare size={12} />
                              </button>

                              {/* Botón Contactado Hoy */}
                              <button
                                type="button"
                                onClick={() => handleMarcarContactadoHoy(caso)}
                                disabled={actualizandoCasoId === caso.id}
                                className="p-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-[var(--border)] text-gray-400 hover:text-blue-400 transition-colors"
                                title="Registrar contacto hoy (reinicia SLA)"
                              >
                                <Check size={12} />
                              </button>

                              {/* Selector para mover de etapa */}
                              <select
                                value={caso.estado}
                                disabled={actualizandoCasoId === caso.id}
                                onChange={(e) => handleSeleccionarEtapa(caso, e.target.value)}
                                className="text-[10px] font-semibold bg-neutral-900 border border-[var(--border)] text-gray-300 rounded-lg px-1.5 py-0.5 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[105px]"
                              >
                                <option value="derivado">1. Derivado</option>
                                <option value="en_asesoramiento">2. Asesoramiento</option>
                                <option value="en_analisis">3. Análisis</option>
                                <option value="confirmado">4. Confirmado</option>
                                <option disabled>──────────</option>
                                <option value="operado">✔ Operado (Cerrar)</option>
                                <option value="cancelado">✖ Cancelar (Cerrar)</option>
                              </select>
                            </div>

                          </div>

                        </div>
                      )
                    })
                  )}
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5B. VISTA DE HISTORIAL DE CASOS CERRADOS (OPERADOS Y CANCELADOS) */}
      {/* ==================================================================== */}
      {vistaActual === 'cerrados' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>
              Mostrando <strong>{casosCerradosFiltrados.length}</strong> casos cerrados históricos
            </span>
          </div>

          {casosCerradosFiltrados.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-dashed border-[var(--border)] space-y-2">
              <Archive size={32} className="mx-auto text-gray-500 opacity-60" />
              <p className="text-sm font-semibold text-gray-300">No se encontraron casos cerrados con los filtros seleccionados</p>
              <p className="text-xs text-gray-500">Prueba ajustando el texto de búsqueda o los filtros superiores.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {casosCerradosFiltrados.map((caso) => {
                const pac = caso.pacientes
                const esOperado = caso.estado === 'operado'

                return (
                  <div
                    key={caso.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 bg-neutral-900/80 ${
                      esOperado
                        ? 'border-teal-500/30 hover:border-teal-500/60'
                        : 'border-red-500/20 hover:border-red-500/40'
                    }`}
                  >
                    {/* Header Tarjeta Cerrada */}
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/pacientes?id=${caso.paciente_id}`}
                        className="text-sm font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-1.5 truncate"
                      >
                        <span className="truncate">{pac?.nombre || 'Paciente'}</span>
                        <ExternalLink size={12} className="text-blue-400 shrink-0" />
                      </Link>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                          esOperado
                            ? 'bg-teal-950 text-teal-300 border-teal-500/50'
                            : 'bg-red-950 text-red-300 border-red-500/50'
                        }`}
                      >
                        {esOperado ? (
                          <>
                            <CheckCircle2 size={11} className="text-teal-400" />
                            OPERADO
                          </>
                        ) : (
                          <>
                            <XCircle size={11} className="text-red-400" />
                            CANCELADO
                          </>
                        )}
                      </span>
                    </div>

                    {/* Práctica & Cirujano */}
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-gray-200 font-medium">
                        <Stethoscope size={13} className="text-blue-400 shrink-0" />
                        <span className="truncate">{caso.practica_nombre}</span>
                      </div>

                      {caso.medico_cirujano_nombre && (
                        <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                          <User size={12} className="text-emerald-400 shrink-0" />
                          <span className="truncate">Dr/a. {caso.medico_cirujano_nombre}</span>
                        </div>
                      )}

                      {(caso.cobertura_obra_social || pac?.obra_social) && (
                        <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                          <Building2 size={12} className="text-blue-400 shrink-0" />
                          <span className="truncate">{caso.cobertura_obra_social || pac?.obra_social}</span>
                        </div>
                      )}
                    </div>

                    {/* Motivo de Cancelación / Cierre */}
                    {caso.motivo_cancelacion && (
                      <div className={`p-2 rounded-xl border text-[11px] space-y-0.5 ${
                        esOperado
                          ? 'bg-teal-950/20 border-teal-500/20 text-teal-200'
                          : 'bg-red-950/20 border-red-500/20 text-red-300'
                      }`}>
                        <span className="font-bold block text-[10px] opacity-75">
                          {esOperado ? 'Resolución de Cirugía:' : 'Motivo de Desistimiento:'}
                        </span>
                        <p className="line-clamp-2">{caso.motivo_cancelacion}</p>
                      </div>
                    )}

                    {/* Footer con Monto y Fechas */}
                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-amber-300">
                        {Number(caso.monto_extra || 0) > 0
                          ? `$ ${Number(caso.monto_extra).toLocaleString()} ${caso.moneda_extra || 'ARS'}`
                          : 'Sin monto cotizado'}
                      </span>

                      {/* Selector para reabrir si fue un error */}
                      <select
                        value={caso.estado}
                        disabled={actualizandoCasoId === caso.id}
                        onChange={(e) => handleSeleccionarEtapa(caso, e.target.value)}
                        className="text-[10px] font-semibold bg-neutral-950 border border-[var(--border)] text-gray-400 hover:text-white rounded-lg px-2 py-0.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                        title="Reabrir caso a una etapa activa"
                      >
                        <option value="operado" disabled={esOperado}>Operado</option>
                        <option value="cancelado" disabled={!esOperado}>Cancelado</option>
                        <option disabled>── Reabrir a: ──</option>
                        <option value="derivado">1. Derivado</option>
                        <option value="en_asesoramiento">2. Asesoramiento</option>
                        <option value="en_analisis">3. Análisis</option>
                        <option value="confirmado">4. Confirmado</option>
                      </select>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODALES: WHATSAPP Y CIERRE DE CASO */}
      {/* ==================================================================== */}
      {modalWhatsAppOpen && casoParaWhatsApp && (
        <ModalPlantillasWhatsAppQuirurgicas
          isOpen={modalWhatsAppOpen}
          onClose={() => {
            setModalWhatsAppOpen(false)
            setCasoParaWhatsApp(null)
          }}
          casoId={casoParaWhatsApp.id}
          pacienteId={casoParaWhatsApp.paciente_id}
          pacienteNombre={casoParaWhatsApp.pacientes?.nombre || 'Paciente'}
          pacienteTelefono={casoParaWhatsApp.pacientes?.telefono || null}
          practicaNombre={casoParaWhatsApp.practica_nombre}
          medicoCirujanoNombre={casoParaWhatsApp.medico_cirujano_nombre || null}
          montoExtra={casoParaWhatsApp.monto_extra}
          monedaExtra={casoParaWhatsApp.moneda_extra || 'ARS'}
          fechaProbable={casoParaWhatsApp.fecha_probable_cirugia}
          fechaDefinitiva={casoParaWhatsApp.fecha_definitiva_cirugia}
          onMensajeEnviado={() => {
            mostrarToast('Mensaje de WhatsApp enviado y contacto registrado.')
            fetchPipeline()
          }}
        />
      )}

      {modalCierreOpen && casoParaCierre && (
        <ModalCerrarCasoQuirurgico
          isOpen={modalCierreOpen}
          onClose={() => {
            setModalCierreOpen(false)
            setCasoParaCierre(null)
          }}
          casoId={casoParaCierre.id}
          pacienteId={casoParaCierre.paciente_id}
          pacienteNombre={casoParaCierre.pacientes?.nombre || 'Paciente'}
          practicaNombre={casoParaCierre.practica_nombre}
          numeroCirugia={1}
          onCasoCerrado={(casoAct) => {
            mostrarToast(`El caso fue cerrado como ${casoAct.estado}.`)
            fetchPipeline()
          }}
        />
      )}

    </div>
  )
}
