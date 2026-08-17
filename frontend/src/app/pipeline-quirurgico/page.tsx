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
  ShieldAlert
} from 'lucide-react'
import Link from 'next/link'
import { BACKEND_URL } from '@/lib/api'

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
}

interface MetricasPipeline {
  total_casos: number
  casos_activos: number
  casos_en_alerta: number
  total_monto_ars: number
  total_monto_usd: number
  sla_dias_alerta: number
  sla_dias_critico: number
}

const ETAPAS_COLUMNAS = [
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
  },
  {
    id: 'operado',
    titulo: '5. Operados',
    subtitulo: 'Cirugías completadas con éxito',
    colorHeader: 'bg-teal-600/10 text-teal-300 border-teal-500/30',
    colorDot: 'bg-teal-400'
  }
]

export default function PipelineQuirurgicoPage() {
  const [etapas, setEtapas] = useState<Record<string, AsesoriaCasoPipeline[]>>({})
  const [metricas, setMetricas] = useState<MetricasPipeline | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroTexto, setFiltroTexto] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [actualizandoCasoId, setActualizandoCasoId] = useState<string | null>(null)

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

  // Cambiar etapa directamente desde el Kanban
  const handleCambiarEtapa = async (casoId: string, nuevaEtapa: string) => {
    try {
      setActualizandoCasoId(casoId)
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${casoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevaEtapa })
      })
      if (!res.ok) throw new Error('Error al mover de etapa.')
      await fetchPipeline()
    } catch (err) {
      console.error('Error al mover de etapa:', err)
    } finally {
      setActualizandoCasoId(null)
    }
  }

  // Filtrado de casos por columna
  const etapasFiltradas = useMemo(() => {
    const q = filtroTexto.toLowerCase().trim()
    const res: Record<string, AsesoriaCasoPipeline[]> = {}

    for (const etapaKey of Object.keys(etapas)) {
      res[etapaKey] = (etapas[etapaKey] || []).filter((caso) => {
        const pacNombre = (caso.pacientes?.nombre || '').toLowerCase()
        const pacDni = (caso.pacientes?.dni || '').toLowerCase()
        const cirugia = (caso.practica_nombre || '').toLowerCase()
        const cirujano = (caso.medico_cirujano_nombre || '').toLowerCase()

        const matchTexto =
          !q ||
          pacNombre.includes(q) ||
          pacDni.includes(q) ||
          cirugia.includes(q) ||
          cirujano.includes(q)

        const matchAlerta = !soloAlertas || caso.es_critico || caso.es_alerta

        return matchTexto && matchAlerta
      })
    }

    return res
  }, [etapas, filtroTexto, soloAlertas])

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 min-w-0 pb-12 animate-fade-in">
      
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
              Monitoreo y seguimiento secuencial de todos los pacientes en proceso de cotización y programación quirúrgica.
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
      {/* 2. TARJETAS DE KPIS SUPERIORES */}
      {/* ==================================================================== */}
      {metricas && (
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
              Procedimientos en Curso
            </span>
            <p className="text-lg font-black text-purple-300 font-mono">
              {metricas.casos_activos} {metricas.casos_activos === 1 ? 'Caso' : 'Casos'}
            </p>
            <span className="text-[10px] text-gray-500 block">
              De un total de {metricas.total_casos} registrados
            </span>
          </div>

          {/* KPI 4: Alertas de Tiempo SLA (Pacientes Enfriándose) */}
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

      {/* ==================================================================== */}
      {/* 3. BARRA DE HERRAMIENTAS Y FILTROS */}
      {/* ==================================================================== */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-neutral-900/60 border border-[var(--border)]">
        
        {/* Buscador */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por paciente, DNI, cirugía o cirujano..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-950 border border-[var(--border)] focus:border-blue-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
          />
        </div>

        {/* Toggle Alertas SLA */}
        <button
          type="button"
          onClick={() => setSoloAlertas(!soloAlertas)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
            soloAlertas
              ? 'bg-red-950 text-red-300 border-red-500/50'
              : 'bg-neutral-950 text-gray-400 border-[var(--border)] hover:text-white'
          }`}
        >
          <Clock size={13} className={soloAlertas ? 'text-red-400' : 'text-gray-400'} />
          Solo Pacientes en Alerta SLA
        </button>

      </div>

      {/* ==================================================================== */}
      {/* 4. TABLERO KANBAN DE ETAPAS QUIRÚRGICAS */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start">
        {ETAPAS_COLUMNAS.map((col) => {
          const casosColumna = etapasFiltradas[col.id] || []
          const montoTotalColumna = casosColumna.reduce(
            (acc, c) => acc + Number(c.monto_extra || 0),
            0
          )

          return (
            <div
              key={col.id}
              className="flex flex-col bg-neutral-900/60 border border-[var(--border)] rounded-2xl p-3 min-h-[480px] space-y-3"
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
                  <div className="p-6 text-center text-xs text-gray-500 border border-dashed border-[var(--border)] rounded-xl">
                    Sin cirugías en esta etapa
                  </div>
                ) : (
                  casosColumna.map((caso) => {
                    const pac = caso.pacientes
                    const isCritico = caso.es_critico
                    const isAlerta = caso.es_alerta

                    return (
                      <div
                        key={caso.id}
                        className={`p-3 rounded-xl border transition-all space-y-2.5 bg-neutral-950/80 hover:bg-neutral-950 group ${
                          isCritico
                            ? 'border-red-500/50 shadow-sm shadow-red-950/20'
                            : isAlerta
                            ? 'border-amber-500/40'
                            : 'border-[var(--border)] hover:border-blue-500/40'
                        }`}
                      >
                        {/* Cabecera de la Tarjeta */}
                        <div className="flex items-center justify-between gap-1.5">
                          <Link
                            href={`/pacientes?id=${caso.paciente_id}`}
                            className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1 truncate"
                            title="Ver expediente del paciente"
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
                            >
                              <Clock size={10} />
                              {caso.dias_sin_contacto === 0
                                ? 'Hoy'
                                : `${caso.dias_sin_contacto} d`}
                            </span>
                          )}
                        </div>

                        {/* Detalle Quirúrgico */}
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

                        {/* Footer de Tarjeta: Monto y Mover Etapa */}
                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold text-amber-300">
                            {Number(caso.monto_extra || 0) > 0
                              ? `$ ${Number(caso.monto_extra).toLocaleString()} ${caso.moneda_extra || 'ARS'}`
                              : 'Sin cotizar'}
                          </span>

                          {/* Selector rápido para mover etapa */}
                          <select
                            value={caso.estado}
                            disabled={actualizandoCasoId === caso.id}
                            onChange={(e) => handleCambiarEtapa(caso.id, e.target.value)}
                            className="text-[10px] font-semibold bg-neutral-900 border border-[var(--border)] text-gray-300 rounded-lg px-1.5 py-0.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="derivado">1. Derivado</option>
                            <option value="en_asesoramiento">2. Asesoramiento</option>
                            <option value="en_analisis">3. Análisis</option>
                            <option value="confirmado">4. Confirmado</option>
                            <option value="operado">5. Operado</option>
                          </select>
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

    </div>
  )
}
