'use client'

import React from 'react'
import {
  TrendingUp,
  DollarSign,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

interface Props {
  resumenData: any
  moneda: 'ARS' | 'USD' | 'TODAS'
  loading: boolean
}

const ETAPAS_COLORES: Record<string, string> = {
  derivado: '#3b82f6',
  en_asesoramiento: '#f59e0b',
  en_analisis: '#a855f7',
  confirmado: '#10b981',
  programado: '#06b6d4',
  operado: '#14b8a6',
  cancelado: '#ef4444'
}

const ETAPAS_TITULOS: Record<string, string> = {
  derivado: '1. Derivados',
  en_asesoramiento: '2. En Asesoramiento',
  en_analisis: '3. En Análisis',
  confirmado: '4. Confirmados',
  programado: '5. Programados Qx',
  operado: '6. Operados',
  cancelado: 'Cancelados / Pausa'
}

export default function TabResumenEjecutivo({ resumenData, moneda, loading }: Props) {
  const kpis = resumenData?.kpis || {}
  const tendencia = resumenData?.tendencia_facturacion || []
  const distPipeline = resumenData?.distribucion_pipeline || { conteo: {}, monto_ars: {}, monto_usd: {} }

  // Datos para Pie Chart
  const pieData = Object.entries(distPipeline.conteo || {}).map(([etapa, cantidad]) => ({
    name: ETAPAS_TITULOS[etapa] || etapa,
    etapaKey: etapa,
    value: Number(cantidad),
    color: ETAPAS_COLORES[etapa] || '#94a3b8'
  })).filter(x => x.value > 0)

  // Formateador de moneda
  const formatMonto = (num: number, mon: string = 'ARS') => {
    return `${mon === 'USD' ? 'USD ' : '$ '}${num.toLocaleString('es-AR')}`
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4 Scorecards Macro Ejecutivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Facturación Aprobada */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Facturación Aprobada</span>
            <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-emerald-400 tracking-tight">
              ${(kpis.facturacion_aprobada_ars || 0).toLocaleString('es-AR')}{' '}
              <span className="text-xs font-semibold text-emerald-500">ARS</span>
            </div>
            {(moneda === 'TODAS' || moneda === 'USD') && (kpis.facturacion_aprobada_usd > 0) && (
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                USD {(kpis.facturacion_aprobada_usd || 0).toLocaleString('es-AR')}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
            <span>Presupuestos Aprobados:</span>
            <span className="font-bold font-mono text-white">{kpis.presupuestos_aprobados || 0}</span>
          </div>
        </div>

        {/* 2. Conversión de Presupuestos */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Conversión Presupuestos</span>
            <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-blue-400 tracking-tight">
              {kpis.tasa_conversion_presupuestos || 0}%
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {kpis.presupuestos_aprobados || 0} de {kpis.presupuestos_emitidos || 0} cotizaciones
            </p>
          </div>
          <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
            <span>Total Emitidos:</span>
            <span className="font-bold font-mono text-white">{kpis.presupuestos_emitidos || 0}</span>
          </div>
        </div>

        {/* 3. Cirugías y Quirófano */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Actividad Quirúrgica</span>
            <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
              <Activity size={18} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-cyan-300 tracking-tight">
              {kpis.cirugias_programadas || 0}{' '}
              <span className="text-xs font-semibold text-gray-400 font-sans">en agenda</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {kpis.cirugias_operadas || 0} operadas con éxito | {kpis.cirugias_canceladas || 0} canceladas
            </p>
          </div>
          <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
            <span>Tasa de Efectividad Qx:</span>
            <span className="font-bold font-mono text-emerald-400">{kpis.tasa_efectividad_qx || 100}%</span>
          </div>
        </div>

        {/* 4. Capital en Riesgo SLA */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Capital en Riesgo (SLA)</span>
            <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div>
            <div className="text-xl font-black font-mono text-red-400 tracking-tight">
              ${(kpis.capital_riesgo_ars || 0).toLocaleString('es-AR')}
            </div>
            {(moneda === 'TODAS' || moneda === 'USD') && (kpis.capital_riesgo_usd > 0) && (
              <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                USD {(kpis.capital_riesgo_usd || 0).toLocaleString('es-AR')}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-gray-400">
            <span>Casos con demora &gt;3 días:</span>
            <span className="font-bold font-mono text-red-300">{kpis.casos_en_riesgo_sla || 0}</span>
          </div>
        </div>
      </div>

      {/* Gráficos de Tendencia y Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Tendencia de Facturación en el Tiempo (2 cols) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] lg:col-span-2 space-y-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                Evolución de Facturación Aprobada ($ ARS)
              </h3>
              <p className="text-[11px] text-gray-400">Ingresos consolidados por fecha de aprobación</p>
            </div>
            <span className="text-[10.5px] px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 font-mono font-bold border border-emerald-500/30">
              {tendencia.length} fechas registradas
            </span>
          </div>

          <div className="h-64 w-full">
            {tendencia.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-[var(--border)] rounded-xl">
                No hay movimientos de facturación en el rango de fechas seleccionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tendencia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFacturacion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis 
                    dataKey="fecha" 
                    stroke="#737373" 
                    fontSize={10} 
                    tickFormatter={(val) => val.substring(5)} 
                  />
                  <YAxis 
                    stroke="#737373" 
                    fontSize={10} 
                    tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} 
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(value: any) => [`$ ${Number(value).toLocaleString('es-AR')} ARS`, 'Facturación']}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="monto_ars"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFacturacion)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Composición del Pipeline Quirúrgico (1 col) */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-4 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-blue-400" />
              Distribución del Pipeline
            </h3>
            <p className="text-[11px] text-gray-400">Casos quirúrgicos por estadio de atención</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {pieData.length === 0 ? (
              <div className="text-xs text-gray-500">Sin datos de pipeline</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(value: any, name: any) => [`${value} casos`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[var(--border)]/60 text-[10.5px]">
            {pieData.slice(0, 6).map((item) => (
              <div key={item.etapaKey} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-gray-300 truncate">{item.name}:</span>
                <span className="font-bold font-mono text-white ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
