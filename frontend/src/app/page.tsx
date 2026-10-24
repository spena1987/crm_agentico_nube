'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { 
  Users, 
  FileText, 
  Bot, 
  DollarSign, 
  ArrowUpRight, 
  Activity, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Stethoscope,
  Layers,
  ChevronRight,
  Filter,
  Building2,
  RefreshCw,
  Sparkles,
  Award,
  Eye,
  FileDown
} from 'lucide-react'
import Link from 'next/link'

import DashboardHeaderControls, { RangoFiltro } from '@/components/dashboard/DashboardHeaderControls'
import TabResumenEjecutivo from '@/components/dashboard/TabResumenEjecutivo'
import TabProductividadUsuarios from '@/components/dashboard/TabProductividadUsuarios'
import TabRendimientoModulos from '@/components/dashboard/TabRendimientoModulos'
import ReportePdfExportModal from '@/components/dashboard/ReportePdfExportModal'

interface CasoFinanciero {
  id: string
  estado: string
  monto_extra: number | null
  moneda_extra: string | null
  medico_cirujano_nombre: string | null
  practica_nombre: string | null
  ultimo_contacto_at: string | null
  created_at: string | null
}

const ETAPAS_ORDENADAS = [
  { id: 'derivado', titulo: '1. Derivados', subtitulo: 'Recién ingresados', color: 'bg-blue-500', textBadge: 'bg-blue-950/60 text-blue-300 border-blue-500/30' },
  { id: 'en_asesoramiento', titulo: '2. En Asesoramiento', subtitulo: 'Contacto inicial y cotización', color: 'bg-amber-500', textBadge: 'bg-amber-950/60 text-amber-300 border-amber-500/30' },
  { id: 'en_analisis', titulo: '3. En Análisis', subtitulo: 'Evaluando presupuesto / prepaga', color: 'bg-purple-500', textBadge: 'bg-purple-950/60 text-purple-300 border-purple-500/30' },
  { id: 'confirmado', titulo: '4. Confirmados', subtitulo: 'Cirugía confirmada (Pendiente Qx)', color: 'bg-emerald-500', textBadge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30' },
  { id: 'programado', titulo: '5. Programados Qx', subtitulo: 'Fecha y sala de quirófano asignada', color: 'bg-cyan-500', textBadge: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30' },
  { id: 'operado', titulo: '6. Operados', subtitulo: 'Cirugías completadas con éxito', color: 'bg-teal-500', textBadge: 'bg-teal-950/60 text-teal-300 border-teal-500/30' },
  { id: 'cancelado', titulo: 'Cancelados / Pausa', subtitulo: 'Cirugías no concretadas', color: 'bg-red-500', textBadge: 'bg-red-950/60 text-red-300 border-red-500/30' }
]

export default function Dashboard() {
  // Pestañas del Sistema Gerencial & Operativo
  const [tabActiva, setTabActiva] = useState<'operativa' | 'ejecutiva' | 'productividad' | 'modulos'>('ejecutiva')

  // Filtros Globales (Default: Últimos 30 días, según requerimiento de Dirección)
  const [rango, setRango] = useState<RangoFiltro>({ tipo: '30d', dias: 30 })
  const [moneda, setMoneda] = useState<'ARS' | 'USD' | 'TODAS'>('TODAS')

  // Modal de Exportación PDF
  const [modalExportarOpen, setModalExportarOpen] = useState(false)

  // Estado de Datos Operativos (Vista Operativa Clásica)
  const [stats, setStats] = useState({
    pacientesCount: 0,
    presupuestosCount: 0,
    activeBots: 0,
    totalFacturado: 0
  })

  // Estado de Datos Analíticos (SIG / BI)
  const [resumenData, setResumenData] = useState<any>(null)
  const [productividadData, setProductividadData] = useState<any>(null)
  const [asesoriaData, setAsesoriaData] = useState<any>(null)
  const [quirofanoData, setQuirofanoData] = useState<any>(null)
  const [estudiosData, setEstudiosData] = useState<any>(null)

  // Estado pestaña financiera / pipeline clásico
  const [casosFinancieros, setCasosFinancieros] = useState<CasoFinanciero[]>([])
  const [filtroCirujano, setFiltroCirujano] = useState<string>('todos')
  const [filtroPractica, setFiltroPractica] = useState<string>('todas')

  const [loading, setLoading] = useState(true)

  // Carga centralizada de datos
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Cargar contadores operativos directos de Supabase
      const [pacsRes, presRes, botsRes, presSumRes, casosRes] = await Promise.all([
        supabase.from('pacientes').select('*', { count: 'exact', head: true }),
        supabase.from('presupuestos').select('*', { count: 'exact', head: true }),
        supabase.from('conversaciones').select('*', { count: 'exact', head: true }).eq('bot_disabled', false),
        supabase.from('presupuestos').select('total').eq('estado', 'aprobado'),
        supabase.from('asesorias_quirurgicas').select('id, estado, monto_extra, moneda_extra, medico_cirujano_nombre, practica_nombre, ultimo_contacto_at, created_at')
      ])

      const totalFact = presSumRes.data ? presSumRes.data.reduce((acc, curr) => acc + Number(curr.total || 0), 0) : 0

      setStats({
        pacientesCount: pacsRes.count || 0,
        presupuestosCount: presRes.count || 0,
        activeBots: botsRes.count || 0,
        totalFacturado: totalFact
      })

      if (casosRes.data) {
        setCasosFinancieros(casosRes.data as CasoFinanciero[])
      }

      // 2. Cargar endpoints del servicio analítico (/api/analytics/...)
      const queryParams = new URLSearchParams()
      queryParams.set('dias', String(rango.dias || 30))
      if (rango.fechaInicio) queryParams.set('fecha_inicio', rango.fechaInicio)
      if (rango.fechaFin) queryParams.set('fecha_fin', rango.fechaFin)
      const qStr = queryParams.toString()

      const [resResumen, resProd, resAsesoria, resQx, resEstudios] = await Promise.all([
        apiFetch(`/api/analytics/resumen-gerencial?${qStr}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/api/analytics/productividad-staff?${qStr}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/api/analytics/modulos/asesoramiento?${qStr}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/api/analytics/modulos/quirofano?${qStr}`).then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch(`/api/analytics/modulos/estudios?${qStr}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      if (resResumen) setResumenData(resResumen)
      if (resProd) setProductividadData(resProd)
      if (resAsesoria) setAsesoriaData(resAsesoria)
      if (resQx) setQuirofanoData(resQx)
      if (resEstudios) setEstudiosData(resEstudios)

    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [rango])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Listas únicas para filtros clásicos
  const listaCirujanos = useMemo(() => {
    const setCir = new Set<string>()
    casosFinancieros.forEach((c) => {
      if (c.medico_cirujano_nombre) setCir.add(c.medico_cirujano_nombre.trim())
    })
    return Array.from(setCir).sort()
  }, [casosFinancieros])

  const listaPracticas = useMemo(() => {
    const setPrac = new Set<string>()
    casosFinancieros.forEach((c) => {
      if (c.practica_nombre) setPrac.add(c.practica_nombre.trim())
    })
    return Array.from(setPrac).sort()
  }, [casosFinancieros])

  // Casos filtrados para matriz clásica
  const casosFiltrados = useMemo(() => {
    return casosFinancieros.filter((c) => {
      if (filtroCirujano !== 'todos' && c.medico_cirujano_nombre !== filtroCirujano) return false
      if (filtroPractica !== 'todas' && c.practica_nombre !== filtroPractica) return false
      if (moneda !== 'TODAS') {
        const mon = (c.moneda_extra || 'ARS').toUpperCase()
        if (mon !== moneda) return false
      }
      return true
    })
  }, [casosFinancieros, filtroCirujano, filtroPractica, moneda])

  // Métricas financieras calculadas para Matriz
  const metricasEjecutivas = useMemo(() => {
    const ESTADOS_ACTIVOS = ['derivado', 'en_asesoramiento', 'en_analisis', 'confirmado', 'programado']

    let carteraActivaARS = 0
    let carteraActivaUSD = 0
    let carteraActivaCount = 0

    const desglosePorEtapa: Record<string, { casos: number; montoARS: number; montoUSD: number }> = {}
    ETAPAS_ORDENADAS.forEach((e) => {
      desglosePorEtapa[e.id] = { casos: 0, montoARS: 0, montoUSD: 0 }
    })

    const desglosePorCirujano: Record<string, { casos: number; montoARS: number; montoUSD: number }> = {}

    casosFiltrados.forEach((c) => {
      const monto = Number(c.monto_extra || 0)
      const monedaStr = (c.moneda_extra || 'ARS').toUpperCase()
      const estado = c.estado || 'derivado'

      if (!desglosePorEtapa[estado]) {
        desglosePorEtapa[estado] = { casos: 0, montoARS: 0, montoUSD: 0 }
      }
      desglosePorEtapa[estado].casos += 1
      if (monedaStr === 'USD') {
        desglosePorEtapa[estado].montoUSD += monto
      } else {
        desglosePorEtapa[estado].montoARS += monto
      }

      if (ESTADOS_ACTIVOS.includes(estado)) {
        carteraActivaCount += 1
        if (monedaStr === 'USD') carteraActivaUSD += monto
        else carteraActivaARS += monto

        const cirName = c.medico_cirujano_nombre || 'Sin Asignar'
        if (!desglosePorCirujano[cirName]) {
          desglosePorCirujano[cirName] = { casos: 0, montoARS: 0, montoUSD: 0 }
        }
        desglosePorCirujano[cirName].casos += 1
        if (monedaStr === 'USD') desglosePorCirujano[cirName].montoUSD += monto
        else desglosePorCirujano[cirName].montoARS += monto
      }
    })

    const rankingCirujanos = Object.entries(desglosePorCirujano)
      .map(([nombre, val]) => ({ nombre, ...val }))
      .sort((a, b) => b.montoARS + b.montoUSD * 1200 - (a.montoARS + a.montoUSD * 1200))

    return {
      carteraActivaARS,
      carteraActivaUSD,
      carteraActivaCount,
      desglosePorEtapa,
      rankingCirujanos
    }
  }, [casosFiltrados])

  // Tarjetas informativas de la vista operativa
  const statCards = [
    {
      title: 'Pacientes Registrados',
      value: stats.pacientesCount,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20',
      description: 'Total de JIDs de WhatsApp capturados',
      link: '/pacientes'
    },
    {
      title: 'Presupuestos Emitidos',
      value: stats.presupuestosCount,
      icon: FileText,
      color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/20',
      description: 'Presupuestos médicos generados',
      link: '/presupuestos'
    },
    {
      title: 'Bots de WhatsApp Activos',
      value: stats.activeBots,
      icon: Bot,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20',
      description: 'Conversaciones automatizadas',
      link: '/chat'
    },
    {
      title: 'Facturación Aprobada',
      value: `$${stats.totalFacturado.toLocaleString('es-AR')}`,
      icon: DollarSign,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20',
      description: 'Total de presupuestos aceptados',
      link: '/presupuestos'
    }
  ]

  // Texto amigable de rango para encabezado y reporte PDF
  const rangoTexto = useMemo(() => {
    if (rango.tipo === '30d') return 'Últimos 30 días'
    if (rango.tipo === '7d') return 'Últimos 7 días'
    if (rango.tipo === 'mes') return 'Mes en Curso'
    if (rango.tipo === 'hoy') return 'Actividad de Hoy'
    if (rango.tipo === 'custom' && rango.fechaInicio && rango.fechaFin) {
      return `${rango.fechaInicio} al ${rango.fechaFin}`
    }
    return 'Periodo Seleccionado'
  }, [rango])

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 min-w-0 pb-16">
      
      {/* Encabezado Principal y Selector de Vistas Estratégicas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Panel de Control Gerencial</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10.5px] font-mono font-bold">
              SIG v2.0
            </span>
          </div>
          <p className="text-xs text-[var(--secondary)] font-medium mt-0.5">
            Sistema de información estratégica, productividad de staff y rendimiento de módulos.
          </p>
        </div>

        {/* Barra de 4 Pestañas Principales */}
        <div className="flex items-center p-1 rounded-xl bg-neutral-900 border border-[var(--border)] text-xs font-semibold overflow-x-auto">
          {/* Pestaña 1: Dirección & Macro KPIs */}
          <button
            type="button"
            onClick={() => setTabActiva('ejecutiva')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              tabActiva === 'ejecutiva'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp size={14} />
            <span>Dirección & Finanzas</span>
          </button>

          {/* Pestaña 2: Productividad Staff */}
          <button
            type="button"
            onClick={() => setTabActiva('productividad')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              tabActiva === 'productividad'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Award size={14} />
            <span>Productividad Staff</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-blue-200 font-mono">
              Usuarias
            </span>
          </button>

          {/* Pestaña 3: Módulos Operativos */}
          <button
            type="button"
            onClick={() => setTabActiva('modulos')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              tabActiva === 'modulos'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>Módulos Operativos</span>
          </button>

          {/* Pestaña 4: Vista Asistencial / Operativa (Clásica) */}
          <button
            type="button"
            onClick={() => setTabActiva('operativa')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              tabActiva === 'operativa'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity size={14} />
            <span>Operativa</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros Globales (Rango Temporal, Monedas y Exportación) */}
      <DashboardHeaderControls
        rango={rango}
        onRangoChange={setRango}
        moneda={moneda}
        onMonedaChange={setMoneda}
        loading={loading}
        onRefresh={loadDashboardData}
        onExportPdf={() => setModalExportarOpen(true)}
      />

      {/* ========================================================================= */}
      {/* 1. PESTAÑA: DIRECCIÓN & FINANZAS (RESUMEN EJECUTIVO & GRÁFICOS) */}
      {/* ========================================================================= */}
      {tabActiva === 'ejecutiva' && (
        <div className="space-y-6">
          <TabResumenEjecutivo
            resumenData={resumenData}
            moneda={moneda}
            loading={loading}
          />

          {/* Matriz Financiera por Estadio del Pipeline (Preservada y Mejorada) */}
          <div className="rounded-2xl bg-neutral-900 border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="p-4 sm:px-6 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Matriz Financiera por Estadio Quirúrgico</h3>
              </div>
              <Link 
                href="/pipeline-quirurgico" 
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                Abrir Pipeline Operativo <ChevronRight size={14} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 text-gray-400 font-bold border-b border-[var(--border)] uppercase text-[10.5px]">
                  <tr>
                    <th className="py-3 px-4">Estadio Quirúrgico</th>
                    <th className="py-3 px-4 text-center">Cirugías</th>
                    <th className="py-3 px-4 text-right">Total $ ARS</th>
                    <th className="py-3 px-4 text-right">Total USD</th>
                    <th className="py-3 px-4 text-right">Ticket Promedio (ARS)</th>
                    <th className="py-3 px-4 text-center">% de Cartera</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60">
                  {ETAPAS_ORDENADAS.map((etapa) => {
                    const dataEtapa = metricasEjecutivas.desglosePorEtapa[etapa.id] || { casos: 0, montoARS: 0, montoUSD: 0 }
                    const porcentajeARS = metricasEjecutivas.carteraActivaARS > 0 
                      ? Math.round((dataEtapa.montoARS / metricasEjecutivas.carteraActivaARS) * 100) 
                      : 0
                    const ticketPromedioARS = dataEtapa.casos > 0 ? Math.round(dataEtapa.montoARS / dataEtapa.casos) : 0

                    return (
                      <tr key={etapa.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${etapa.color}`} />
                            <span className="font-bold text-white text-xs">{etapa.titulo}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 block pl-4">{etapa.subtitulo}</span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] border ${etapa.textBadge}`}>
                            {dataEtapa.casos}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {dataEtapa.montoARS > 0 ? `$ ${dataEtapa.montoARS.toLocaleString('es-AR')}` : '-'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                          {dataEtapa.montoUSD > 0 ? `USD ${dataEtapa.montoUSD.toLocaleString('es-AR')}` : '-'}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-gray-300">
                          {ticketPromedioARS > 0 ? `$ ${ticketPromedioARS.toLocaleString('es-AR')}` : '-'}
                        </td>

                        <td className="py-3 px-4 text-center min-w-[120px]">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-2 rounded-full bg-neutral-800 overflow-hidden">
                              <div 
                                className={`h-full ${etapa.color}`} 
                                style={{ width: `${Math.min(porcentajeARS, 100)}%` }} 
                              />
                            </div>
                            <span className="font-mono text-[10.5px] text-gray-400 w-8 text-right">
                              {etapa.id === 'operado' || etapa.id === 'cancelado' ? '-' : `${porcentajeARS}%`}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Link 
                            href={`/pipeline-quirurgico`}
                            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                          >
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PESTAÑA: PRODUCTIVIDAD DEL PERSONAL (USUARIAS/OS Y STAFF) */}
      {/* ========================================================================= */}
      {tabActiva === 'productividad' && (
        <TabProductividadUsuarios
          productividadData={productividadData}
          loading={loading}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. PESTAÑA: RENDIMIENTO DE MÓDULOS (ASESORAMIENTO, QUIRÓFANO, ESTUDIOS) */}
      {/* ========================================================================= */}
      {tabActiva === 'modulos' && (
        <TabRendimientoModulos
          asesoriaData={asesoriaData}
          quirofanoData={quirofanoData}
          estudiosData={estudiosData}
          loading={loading}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. PESTAÑA: VISTA OPERATIVA (ACCESOS CLÁSICOS) */}
      {/* ========================================================================= */}
      {tabActiva === 'operativa' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Grid de 4 Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {statCards.map((card, idx) => {
              const Icon = card.icon
              return (
                <div 
                  key={idx} 
                  className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xs hover:shadow-md transition-all duration-300 relative group overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--secondary)] uppercase tracking-wider">{card.title}</span>
                    <div className={`p-2.5 rounded-xl ${card.color} transition-all group-hover:scale-110`}>
                      <Icon size={20} />
                    </div>
                  </div>
                  <div className="mt-4">
                    {loading ? (
                      <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
                    ) : (
                      <span className="text-2xl font-black tracking-tight">{card.value}</span>
                    )}
                    <p className="text-[11px] text-[var(--secondary)] mt-1.5 font-medium">{card.description}</p>
                  </div>
                  <Link 
                    href={card.link}
                    className="absolute bottom-4 right-4 text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                  >
                    Ver <ArrowUpRight size={13} />
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Accesos rápidos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xs lg:col-span-2 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Activity size={18} className="text-blue-600" />
                Acciones Clave del CRM
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link 
                  href="/chat" 
                  className="p-4 rounded-xl border border-[var(--border)] hover:border-blue-500/50 hover:bg-blue-50/10 transition-all flex flex-col justify-between h-28"
                >
                  <div>
                    <p className="text-xs font-bold leading-snug">Responder Chats de WhatsApp</p>
                    <p className="text-[10px] text-[var(--secondary)] mt-1">Inbox de WhatsApp integrado con switch de operador humano y plantillas.</p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-0.5">Abrir Chats →</span>
                </Link>

                <Link 
                  href="/pipeline-quirurgico" 
                  className="p-4 rounded-xl border border-[var(--border)] hover:border-emerald-500/50 hover:bg-emerald-50/10 transition-all flex flex-col justify-between h-28"
                >
                  <div>
                    <p className="text-xs font-bold leading-snug">Pipeline Quirúrgico</p>
                    <p className="text-[10px] text-[var(--secondary)] mt-1">Flujo clínico continuo de cirugías, control de alertas SLA y recontactos.</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">Ir al Pipeline →</span>
                </Link>

                <Link 
                  href="/presupuestos" 
                  className="p-4 rounded-xl border border-[var(--border)] hover:border-cyan-500/50 hover:bg-cyan-50/10 transition-all flex flex-col justify-between h-28"
                >
                  <div>
                    <p className="text-xs font-bold leading-snug">Generar Presupuesto</p>
                    <p className="text-[10px] text-[var(--secondary)] mt-1">Cotizaciones médicas con cálculo automático de aranceles y exportación PDF.</p>
                  </div>
                  <span className="text-xs font-semibold text-cyan-600 flex items-center gap-0.5">Generar →</span>
                </Link>

                <Link 
                  href="/quirofano-en-vivo" 
                  className="p-4 rounded-xl border border-[var(--border)] hover:border-purple-500/50 hover:bg-purple-50/10 transition-all flex flex-col justify-between h-28"
                >
                  <div>
                    <p className="text-xs font-bold leading-snug">Quirófano en Vivo</p>
                    <p className="text-[10px] text-[var(--secondary)] mt-1">Monitoreo de salas quirúrgicas, anestesia y paso de etapas en tiempo real.</p>
                  </div>
                  <span className="text-xs font-semibold text-purple-600 flex items-center gap-0.5">Abrir Quirófano →</span>
                </Link>
              </div>
            </div>

            {/* Estado del Agente Inteligente */}
            <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xs space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Bot size={18} className="text-emerald-500" />
                Agente Inteligente
              </h2>
              
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">Motor Gemini AI</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-[10px] text-emerald-800 dark:text-emerald-400 font-bold">Activo (v2.5)</span>
                </div>
                
                <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
                  El bot monitorea y asiste consultas prequirúrgicas y recordatorios fuera de la ventana de 24 horas mediante Meta Cloud API. Para consultas médicas sensibles, escala automáticamente a las asesoras.
                </p>
                
                <div className="border-t border-[var(--border)] pt-3.5 flex justify-between items-center">
                  <span className="text-[10px] text-[var(--secondary)] font-bold uppercase">Sesión Meta WhatsApp Cloud API</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" title="Sesión activa" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportación PDF */}
      <ReportePdfExportModal
        isOpen={modalExportarOpen}
        onClose={() => setModalExportarOpen(false)}
        resumenData={resumenData}
        productividadData={productividadData}
        moduloAsesoriaData={asesoriaData}
        moduloQuirofanoData={quirofanoData}
        rangoTexto={rangoTexto}
      />

    </div>
  )
}
