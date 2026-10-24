'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  Activity,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  Building2,
  Stethoscope,
  ChevronRight,
  FileCheck
} from 'lucide-react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts'

interface Props {
  asesoriaData: any
  quirofanoData: any
  estudiosData: any
  loading: boolean
}

export default function TabRendimientoModulos({
  asesoriaData,
  quirofanoData,
  estudiosData,
  loading
}: Props) {
  const [subModulo, setSubModulo] = useState<'todos' | 'asesoramiento' | 'quirofano' | 'estudios'>('todos')

  // Datos de Asesoramiento
  const funnelAsesoria = asesoriaData?.funnel || []
  const cirujanosAsesoria = asesoriaData?.cirujanos || []
  const practicasAsesoria = asesoriaData?.practicas || []

  // Datos de Quirófano
  const cirujanosQx = quirofanoData?.cirujanos || []
  const lioMetricas = quirofanoData?.lio_metricas || { total_con_lio: 0, calculados: 0, stock_reservado: 0 }
  const consentimientos = quirofanoData?.consentimientos || {}

  // Datos de Estudios
  const estadosWa = estudiosData?.estados_whatsapp || {}
  const tecnicosEst = estudiosData?.tecnicos || []
  const tiposEstudios = estudiosData?.tipos_estudios || []

  const pieWaData = [
    { name: 'Leídos (Azul)', value: estadosWa.read || 0, color: '#10b981' },
    { name: 'Entregados', value: estadosWa.delivered || 0, color: '#3b82f6' },
    { name: 'Enviados', value: estadosWa.sent || 0, color: '#06b6d4' },
    { name: 'Fallidos / Error', value: estadosWa.failed || 0, color: '#ef4444' },
    { name: 'Omitidos / Sin WA', value: estadosWa.skipped || 0, color: '#64748b' }
  ].filter((x) => x.value > 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Selector de Sub-Módulo */}
      <div className="flex items-center p-1 rounded-xl bg-neutral-900 border border-[var(--border)] text-xs font-semibold w-fit">
        <button
          type="button"
          onClick={() => setSubModulo('todos')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            subModulo === 'todos' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Vista Global de Módulos
        </button>
        <button
          type="button"
          onClick={() => setSubModulo('asesoramiento')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            subModulo === 'asesoramiento' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <TrendingUp size={13} />
          <span>Asesoramiento</span>
        </button>
        <button
          type="button"
          onClick={() => setSubModulo('quirofano')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            subModulo === 'quirofano' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Activity size={13} />
          <span>Quirófano</span>
        </button>
        <button
          type="button"
          onClick={() => setSubModulo('estudios')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            subModulo === 'estudios' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Eye size={13} />
          <span>Estudios Técnicos</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. MÓDULO ASESORAMIENTO & PIPELINE */}
      {/* ========================================================================= */}
      {(subModulo === 'todos' || subModulo === 'asesoramiento') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Módulo 1: Asesoramiento Quirúrgico & Pipeline Lead-to-Surgery
              </h3>
            </div>
            <Link
              href="/pipeline-quirurgico"
              className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-0.5"
            >
              Abrir Pipeline <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Embudo de Conversión (2 cols) */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Embudo de Etapas Quirúrgicas</span>
                <span className="text-[11px] text-gray-400">{asesoriaData?.total_casos || 0} oportunidades</span>
              </div>

              <div className="space-y-2 pt-2">
                {funnelAsesoria.map((f: any) => {
                  const maxCasos = Math.max(...funnelAsesoria.map((x: any) => x.conteo || 1), 1)
                  const porcentaje = Math.round((f.conteo / maxCasos) * 100)

                  return (
                    <div key={f.etapa} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-gray-300 capitalize">{f.etapa.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-white">{f.conteo} casos</span>
                          {f.monto_ars > 0 && (
                            <span className="text-[11px] text-emerald-400">
                              (${Math.round(f.monto_ars / 1000).toLocaleString('es-AR')}k ARS)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                          style={{ width: `${Math.max(porcentaje, 4)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Prácticas Más Demandadas (1 col) */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3">
              <span className="text-xs font-bold text-gray-300">Prácticas Más Cotizadas</span>
              <div className="space-y-2 pt-1">
                {practicasAsesoria.slice(0, 5).map((p: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-neutral-950 border border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="text-gray-300 truncate max-w-[170px]" title={p.practica}>
                      {p.practica}
                    </span>
                    <span className="font-mono font-bold text-amber-400">{p.cantidad} cotiz.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MÓDULO QUIRÓFANO & EFICIENCIA OPERATIVA */}
      {/* ========================================================================= */}
      {(subModulo === 'todos' || subModulo === 'quirofano') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Módulo 2: Quirófano, Biometría LIO & Consentimientos
              </h3>
            </div>
            <Link
              href="/programacion-quirurgica"
              className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-0.5"
            >
              Ver Agenda Qx <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Actividad por Médico Cirujano */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Cirugías por Cirujano</span>
                <Stethoscope size={15} className="text-cyan-400" />
              </div>
              <div className="space-y-2">
                {cirujanosQx.slice(0, 5).map((c: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-neutral-950 border border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[150px]">Dr/a. {c.nombre}</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-cyan-400 font-bold">{c.programadas} prog.</span>
                      <span className="text-emerald-400 font-bold">{c.operadas} op.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flujo Biométrico de Lentes (LIO) */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Trazabilidad Biométrica LIO</span>
                <Eye size={15} className="text-blue-400" />
              </div>
              <div className="space-y-3 pt-1 text-xs">
                <div className="p-3 rounded-xl bg-neutral-950 border border-[var(--border)] space-y-1">
                  <div className="flex justify-between text-gray-300">
                    <span>Cirugías con Requerimiento LIO:</span>
                    <span className="font-bold font-mono text-white">{lioMetricas.total_con_lio}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950 border border-[var(--border)] space-y-1">
                  <div className="flex justify-between text-gray-300">
                    <span>LIOs Calculados en Sistema:</span>
                    <span className="font-bold font-mono text-emerald-400">{lioMetricas.calculados}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950 border border-[var(--border)] space-y-1">
                  <div className="flex justify-between text-gray-300">
                    <span>Stock Reservado en Geclisa:</span>
                    <span className="font-bold font-mono text-cyan-300">{lioMetricas.stock_reservado}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Consentimientos Digitales */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Consentimiento Digital</span>
                <FileCheck size={15} className="text-emerald-400" />
              </div>
              <div className="space-y-2 pt-1 text-xs">
                {Object.entries(consentimientos).map(([estado, cant]: any) => (
                  <div key={estado} className="p-2.5 rounded-xl bg-neutral-950 border border-[var(--border)] flex items-center justify-between">
                    <span className="text-gray-300 capitalize">{estado.replace('_', ' ')}</span>
                    <span className="font-mono font-bold text-white">{cant}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MÓDULO ESTUDIOS TÉCNICOS & WHATSAPP LÍNEA 2 */}
      {/* ========================================================================= */}
      {(subModulo === 'todos' || subModulo === 'estudios') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-purple-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Módulo 3: Estudios Técnicos & Línea 2 WhatsApp
              </h3>
            </div>
            <Link
              href="/estudios-tecnicos"
              className="text-xs font-bold text-purple-400 hover:underline flex items-center gap-0.5"
            >
              Consola Técnicos <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Tasa de Entrega y Lectura WhatsApp */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3">
              <span className="text-xs font-bold text-gray-300">Efectividad WhatsApp Cloud API</span>
              <div className="h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieWaData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieWaData.map((entry, index) => (
                        <Cell key={`cell-wa-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10.5px]">
                {pieWaData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-400 truncate">{item.name}:</span>
                    <span className="font-mono font-bold text-white ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rendimiento por Técnico */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3">
              <span className="text-xs font-bold text-gray-300">Despacho por Técnico</span>
              <div className="space-y-2 pt-1">
                {tecnicosEst.map((t: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-neutral-950 border border-[var(--border)] space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-white">
                      <span>{t.nombre}</span>
                      <span className="text-cyan-400 font-mono">{t.total} estudios</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400 pt-1 border-t border-[var(--border)]/40 font-mono">
                      <span>Geclisa: <strong className="text-white">{t.guardados_geclisa}</strong></span>
                      <span>Leídos WA: <strong className="text-emerald-400">{t.leidos}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tipos de Estudios Demandados */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-3">
              <span className="text-xs font-bold text-gray-300">Estudios Diagnósticos Top</span>
              <div className="space-y-1.5 pt-1">
                {tiposEstudios.slice(0, 5).map((te: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-xl bg-neutral-950 border border-[var(--border)] flex items-center justify-between text-xs">
                    <span className="text-gray-300 truncate max-w-[160px]" title={te.tipo}>
                      {te.tipo}
                    </span>
                    <span className="font-mono font-bold text-purple-300">{te.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
