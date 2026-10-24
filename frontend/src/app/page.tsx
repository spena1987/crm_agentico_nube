'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
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
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

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
  const [tabActiva, setTabActiva] = useState<'operativa' | 'ejecutiva'>('operativa')

  // Estado pestaña operativa
  const [stats, setStats] = useState({
    pacientesCount: 0,
    presupuestosCount: 0,
    activeBots: 0,
    totalFacturado: 0
  })

  // Estado pestaña ejecutiva / pipeline financiero
  const [casosFinancieros, setCasosFinancieros] = useState<CasoFinanciero[]>([])
  const [filtroCirujano, setFiltroCirujano] = useState<string>('todos')
  const [filtroPractica, setFiltroPractica] = useState<string>('todas')
  const [filtroMoneda, setFiltroMoneda] = useState<'todas' | 'ARS' | 'USD'>('todas')
  
  const [loading, setLoading] = useState(true)

  // Cargar datos consolidados
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // 1. Contar pacientes
      const { count: pacsCount } = await supabase.from('pacientes').select('*', { count: 'exact', head: true })
      
      // 2. Contar presupuestos
      const { count: presCount } = await supabase.from('presupuestos').select('*', { count: 'exact', head: true })
      
      // 3. Contar conversaciones con bot activo (bot_disabled = false)
      const { count: activeBotsCount } = await supabase.from('conversaciones').select('*', { count: 'exact', head: true }).eq('bot_disabled', false)
      
      // 4. Calcular suma de presupuestos aprobados
      const { data: presSum } = await supabase.from('presupuestos').select('total').eq('estado', 'aprobado')
      const totalFact = presSum ? presSum.reduce((acc, curr) => acc + Number(curr.total || 0), 0) : 0

      setStats({
        pacientesCount: pacsCount || 0,
        presupuestosCount: presCount || 0,
        activeBots: activeBotsCount || 0,
        totalFacturado: totalFact
      })

      // 5. Cargar casos de asesorías quirúrgicas para la Vista Ejecutiva
      const { data: casosData, error: casosError } = await supabase
        .from('asesorias_quirurgicas')
        .select('id, estado, monto_extra, moneda_extra, medico_cirujano_nombre, practica_nombre, ultimo_contacto_at, created_at')

      if (!casosError && casosData) {
        setCasosFinancieros(casosData as CasoFinanciero[])
      }
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Listas únicas para filtros
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

  // Casos filtrados para la Vista Ejecutiva
  const casosFiltrados = useMemo(() => {
    return casosFinancieros.filter((c) => {
      if (filtroCirujano !== 'todos' && c.medico_cirujano_nombre !== filtroCirujano) return false
      if (filtroPractica !== 'todas' && c.practica_nombre !== filtroPractica) return false
      if (filtroMoneda !== 'todas') {
        const mon = (c.moneda_extra || 'ARS').toUpperCase()
        if (mon !== filtroMoneda) return false
      }
      return true
    })
  }, [casosFinancieros, filtroCirujano, filtroPractica, filtroMoneda])

  // Métricas financieras calculadas para Vista Ejecutiva
  const metricasEjecutivas = useMemo(() => {
    const ESTADOS_ACTIVOS = ['derivado', 'en_asesoramiento', 'en_analisis', 'confirmado', 'programado']

    let carteraActivaARS = 0
    let carteraActivaUSD = 0
    let carteraActivaCount = 0

    let enAnalisisARS = 0
    let enAnalisisUSD = 0
    let enAnalisisCount = 0

    let aseguradoARS = 0
    let aseguradoUSD = 0
    let aseguradoCount = 0

    let riesgoARS = 0
    let riesgoUSD = 0
    let riesgoCount = 0

    const desglosePorEtapa: Record<string, { casos: number; montoARS: number; montoUSD: number }> = {}
    ETAPAS_ORDENADAS.forEach((e) => {
      desglosePorEtapa[e.id] = { casos: 0, montoARS: 0, montoUSD: 0 }
    })

    const desglosePorCirujano: Record<string, { casos: number; montoARS: number; montoUSD: number }> = {}

    casosFiltrados.forEach((c) => {
      const monto = Number(c.monto_extra || 0)
      const moneda = (c.moneda_extra || 'ARS').toUpperCase()
      const estado = c.estado || 'derivado'

      // Acumular por etapa
      if (!desglosePorEtapa[estado]) {
        desglosePorEtapa[estado] = { casos: 0, montoARS: 0, montoUSD: 0 }
      }
      desglosePorEtapa[estado].casos += 1
      if (moneda === 'USD') {
        desglosePorEtapa[estado].montoUSD += monto
      } else {
        desglosePorEtapa[estado].montoARS += monto
      }

      // Cartera Activa
      if (ESTADOS_ACTIVOS.includes(estado)) {
        carteraActivaCount += 1
        if (moneda === 'USD') carteraActivaUSD += monto
        else carteraActivaARS += monto

        // En Análisis
        if (estado === 'en_analisis') {
          enAnalisisCount += 1
          if (moneda === 'USD') enAnalisisUSD += monto
          else enAnalisisARS += monto
        }

        // Asegurado (Confirmados y Programados)
        if (estado === 'confirmado' || estado === 'programado') {
          aseguradoCount += 1
          if (moneda === 'USD') aseguradoUSD += monto
          else aseguradoARS += monto
        }

        // Riesgo por retraso en seguimiento SLA (+3 días sin contacto)
        const fechaRef = c.ultimo_contacto_at || c.created_at
        const diasSinContacto = fechaRef ? Math.floor((Date.now() - new Date(fechaRef).getTime()) / (1000 * 60 * 60 * 24)) : 0
        if (diasSinContacto >= 3) {
          riesgoCount += 1
          if (moneda === 'USD') riesgoUSD += monto
          else riesgoARS += monto
        }

        // Desglose por cirujano en activos
        const cirName = c.medico_cirujano_nombre || 'Sin Asignar'
        if (!desglosePorCirujano[cirName]) {
          desglosePorCirujano[cirName] = { casos: 0, montoARS: 0, montoUSD: 0 }
        }
        desglosePorCirujano[cirName].casos += 1
        if (moneda === 'USD') desglosePorCirujano[cirName].montoUSD += monto
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
      enAnalisisARS,
      enAnalisisUSD,
      enAnalisisCount,
      aseguradoARS,
      aseguradoUSD,
      aseguradoCount,
      riesgoARS,
      riesgoUSD,
      riesgoCount,
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

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 min-w-0 pb-12">
      {/* Saludo, Fecha y Selector de Pestañas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Panel de Control</h1>
          <p className="text-xs text-[var(--secondary)] font-medium">
            Gestor integral y visión ejecutiva de la clínica médica.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de Pestañas: Operativa vs Ejecutiva */}
          <div className="flex items-center p-1 rounded-xl bg-neutral-900 border border-[var(--border)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTabActiva('operativa')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                tabActiva === 'operativa'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Activity size={14} />
              <span>Vista Asistencial</span>
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('ejecutiva')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                tabActiva === 'ejecutiva'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <TrendingUp size={14} />
              <span>Vista Ejecutiva / Dirección</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-emerald-200 font-mono">
                Pipeline $
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs">
            <Calendar size={15} className="text-blue-600" />
            <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: VISTA ASISTENCIAL / OPERATIVA */}
      {/* ========================================================================= */}
      {tabActiva === 'operativa' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Grid de Estadísticas */}
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

          {/* Vista de Actividades Médicas / Agenda */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Accesos rápidos */}
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

      {/* ========================================================================= */}
      {/* PESTAÑA 2: VISTA EJECUTIVA / DIRECCIÓN (PIPELINE FINANCIERO) */}
      {/* ========================================================================= */}
      {tabActiva === 'ejecutiva' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Barra de Filtros Ejecutivos */}
          <div className="p-3.5 rounded-2xl bg-neutral-900 border border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
              <Filter size={14} className="text-emerald-400" />
              <span>Filtros Gerenciales:</span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap flex-1 justify-end">
              {/* Filtro por Cirujano */}
              <div className="flex items-center gap-1.5 min-w-[180px]">
                <Stethoscope size={13} className="text-emerald-400 shrink-0" />
                <select
                  value={filtroCirujano}
                  onChange={(e) => setFiltroCirujano(e.target.value)}
                  className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todos">Todos los Cirujanos ({listaCirujanos.length})</option>
                  {listaCirujanos.map((cir) => (
                    <option key={cir} value={cir}>
                      Dr/a. {cir}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Práctica */}
              <div className="flex items-center gap-1.5 min-w-[180px]">
                <Building2 size={13} className="text-blue-400 shrink-0" />
                <select
                  value={filtroPractica}
                  onChange={(e) => setFiltroPractica(e.target.value)}
                  className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todas">Todas las Prácticas ({listaPracticas.length})</option>
                  {listaPracticas.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Moneda */}
              <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-xl border border-[var(--border)] text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroMoneda('todas')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filtroMoneda === 'todas' ? 'bg-neutral-800 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ARS & USD
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMoneda('ARS')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filtroMoneda === 'ARS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Solo ARS
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMoneda('USD')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filtroMoneda === 'USD' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Solo USD
                </button>
              </div>

              {/* Botón Refrescar */}
              <button
                type="button"
                onClick={loadDashboardData}
                disabled={loading}
                className="p-1.5 rounded-xl border border-[var(--border)] hover:bg-neutral-800 text-gray-300 hover:text-white transition-all cursor-pointer"
                title="Recargar datos financieros"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin text-emerald-400' : ''} />
              </button>
            </div>
          </div>

          {/* 4 KPIs Financieros Ejecutivos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Cartera Activa Total */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cartera Activa Total</span>
                <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div>
                <div className="text-lg font-black font-mono text-emerald-400 tracking-tight">
                  ${metricasEjecutivas.carteraActivaARS.toLocaleString('es-AR')} <span className="text-xs font-semibold text-emerald-500">ARS</span>
                </div>
                {metricasEjecutivas.carteraActivaUSD > 0 && (
                  <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                    USD {metricasEjecutivas.carteraActivaUSD.toLocaleString('es-AR')}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
                <span>Cirugías en gestión activa:</span>
                <span className="font-bold font-mono text-white">{metricasEjecutivas.carteraActivaCount}</span>
              </div>
            </div>

            {/* 2. Fondos en Evaluación (En Análisis) */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">En Evaluación (Presupuestos)</span>
                <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400">
                  <FileText size={18} />
                </div>
              </div>
              <div>
                <div className="text-lg font-black font-mono text-purple-300 tracking-tight">
                  ${metricasEjecutivas.enAnalisisARS.toLocaleString('es-AR')} <span className="text-xs font-semibold text-purple-400">ARS</span>
                </div>
                {metricasEjecutivas.enAnalisisUSD > 0 && (
                  <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                    USD {metricasEjecutivas.enAnalisisUSD.toLocaleString('es-AR')}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
                <span>Pacientes decidiendo:</span>
                <span className="font-bold font-mono text-white">{metricasEjecutivas.enAnalisisCount}</span>
              </div>
            </div>

            {/* 3. Fondos Asegurados (Confirmados y Qx) */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asegurado (Confirmado / Qx)</span>
                <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div>
                <div className="text-lg font-black font-mono text-cyan-300 tracking-tight">
                  ${metricasEjecutivas.aseguradoARS.toLocaleString('es-AR')} <span className="text-xs font-semibold text-cyan-400">ARS</span>
                </div>
                {metricasEjecutivas.aseguradoUSD > 0 && (
                  <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                    USD {metricasEjecutivas.aseguradoUSD.toLocaleString('es-AR')}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
                <span>Cirugías con fecha/sala:</span>
                <span className="font-bold font-mono text-white">{metricasEjecutivas.aseguradoCount}</span>
              </div>
            </div>

            {/* 4. Capital en Riesgo (Alertas SLA) */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Capital en Riesgo (SLA)</span>
                <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div>
                <div className="text-lg font-black font-mono text-red-400 tracking-tight">
                  ${metricasEjecutivas.riesgoARS.toLocaleString('es-AR')} <span className="text-xs font-semibold text-red-500">ARS</span>
                </div>
                {metricasEjecutivas.riesgoUSD > 0 && (
                  <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                    USD {metricasEjecutivas.riesgoUSD.toLocaleString('es-AR')}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
                <span>Casos retrasados (+3/+6d):</span>
                <span className="font-bold font-mono text-red-300">{metricasEjecutivas.riesgoCount}</span>
              </div>
            </div>
          </div>

          {/* Tabla Matriz Financiera por Estadio Quirúrgico */}
          <div className="rounded-2xl bg-neutral-900 border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="p-4 sm:px-6 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Matriz Financiera por Estadio del Pipeline</h3>
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
                        {/* Nombre de la etapa */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${etapa.color}`} />
                            <span className="font-bold text-white text-xs">{etapa.titulo}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 block pl-4">{etapa.subtitulo}</span>
                        </td>

                        {/* Cirugías */}
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] border ${etapa.textBadge}`}>
                            {dataEtapa.casos}
                          </span>
                        </td>

                        {/* Total ARS */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {dataEtapa.montoARS > 0 ? `$ ${dataEtapa.montoARS.toLocaleString('es-AR')}` : '-'}
                        </td>

                        {/* Total USD */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                          {dataEtapa.montoUSD > 0 ? `USD ${dataEtapa.montoUSD.toLocaleString('es-AR')}` : '-'}
                        </td>

                        {/* Ticket Promedio */}
                        <td className="py-3 px-4 text-right font-mono text-gray-300">
                          {ticketPromedioARS > 0 ? `$ ${ticketPromedioARS.toLocaleString('es-AR')}` : '-'}
                        </td>

                        {/* Barra de Porcentaje */}
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

                        {/* Enlace directo */}
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

          {/* Ranking de Cirujanos por Volumen Económico Activo */}
          <div className="rounded-2xl bg-neutral-900 border border-[var(--border)] p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Stethoscope size={16} className="text-blue-400" />
                Distribución de Cartera Activa por Médico Cirujano
              </h3>
              <span className="text-[11px] text-gray-400">Casos activos en cotización y prequirúrgico</span>
            </div>

            {metricasEjecutivas.rankingCirujanos.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 border border-dashed border-[var(--border)] rounded-xl">
                No hay cirugías activas registradas con los filtros seleccionados.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {metricasEjecutivas.rankingCirujanos.slice(0, 6).map((cir, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-neutral-950/80 border border-[var(--border)] space-y-1.5 hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[170px]" title={cir.nombre}>
                        Dr/a. {cir.nombre}
                      </span>
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 font-mono font-bold border border-blue-500/20">
                        {cir.casos} {cir.casos === 1 ? 'caso' : 'casos'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border)]/40 font-mono">
                      <span className="text-emerald-400 font-bold">
                        ${cir.montoARS > 0 ? cir.montoARS.toLocaleString('es-AR') : '0'} ARS
                      </span>
                      {cir.montoUSD > 0 && (
                        <span className="text-amber-400 font-bold">
                          USD {cir.montoUSD.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  )
}
