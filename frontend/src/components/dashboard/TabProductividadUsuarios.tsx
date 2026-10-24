'use client'

import React, { useState, useMemo } from 'react'
import {
  Users,
  MessageSquare,
  Phone,
  UserCheck,
  FileSpreadsheet,
  Award,
  Clock,
  ArrowUpDown,
  Search,
  Filter
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'

interface UsuarioProductividad {
  id: string
  nombre: string
  email: string
  rol: string
  es_oficial: boolean
  contactos_totales: number
  canales: {
    whatsapp: number
    llamada: number
    presencial: number
    interno: number
  }
  estudios_procesados: number
  estudios_leidos: number
  presupuestos_relacionados: number
  ultima_actividad: string | null
}

interface Props {
  productividadData: any
  loading: boolean
}

export default function TabProductividadUsuarios({ productividadData, loading }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [ordenarPor, setOrdenarPor] = useState<'acciones' | 'whatsapp' | 'llamadas' | 'estudios'>('acciones')
  const [soloOficiales, setSoloOficiales] = useState(false)

  const usuarios: UsuarioProductividad[] = productividadData?.usuarios || []
  const canalesTotales = productividadData?.canales_totales || { whatsapp: 0, llamada: 0, presencial: 0, interno: 0 }
  const totalAcciones = productividadData?.total_acciones || 0

  // Filtrado y ordenamiento de la tabla
  const usuariosFiltrados = useMemo(() => {
    return usuarios
      .filter((u) => {
        if (soloOficiales && !u.es_oficial) return false
        if (!busqueda) return true
        const q = busqueda.toLowerCase()
        return u.nombre.toLowerCase().includes(q) || u.rol.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (ordenarPor === 'whatsapp') return (b.canales.whatsapp || 0) - (a.canales.whatsapp || 0)
        if (ordenarPor === 'llamadas') return (b.canales.llamada || 0) - (a.canales.llamada || 0)
        if (ordenarPor === 'estudios') return (b.estudios_procesados || 0) - (a.estudios_procesados || 0)
        return (b.contactos_totales + b.estudios_procesados) - (a.contactos_totales + a.estudios_procesados)
      })
  }, [usuarios, busqueda, ordenarPor, soloOficiales])

  // Datos para el gráfico de barras apiladas (Top 8 colaboradores)
  const chartData = useMemo(() => {
    return usuarios
      .slice(0, 8)
      .map((u) => ({
        nombre: u.nombre.length > 16 ? u.nombre.substring(0, 15) + '…' : u.nombre,
        WhatsApp: u.canales?.whatsapp || 0,
        Llamadas: u.canales?.llamada || 0,
        Presencial: u.canales?.presencial || 0,
        Interno: u.canales?.interno || 0,
        Estudios: u.estudios_procesados || 0
      }))
  }, [usuarios])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4 Métricas de Productividad Colectiva */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Acciones Totales</span>
            <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400">
              <Award size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white tracking-tight">
            {totalAcciones.toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-gray-400">
            Contactos clínicos, llamadas, chats y estudios registrados
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contactos por WhatsApp</span>
            <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {(canalesTotales.whatsapp || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-gray-400">
            Canal principal de contacto ({totalAcciones > 0 ? Math.round((canalesTotales.whatsapp / totalAcciones) * 100) : 0}% del volumen)
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Llamadas Telefónicas</span>
            <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400">
              <Phone size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 tracking-tight">
            {(canalesTotales.llamada || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-gray-400">
            Gestión telefónica personalizada de presupuestos y dudas
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Atención Presencial</span>
            <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-purple-300 tracking-tight">
            {(canalesTotales.presencial || 0).toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-gray-400">
            Entrevistas y asesoramiento directo en clínica
          </p>
        </div>
      </div>

      {/* Gráfico de Barras Apiladas por Colaborador */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              Comparativa de Actividad por Usuaria/o y Canal
            </h3>
            <p className="text-[11px] text-gray-400">Desglose de contactos y estudios en el periodo seleccionado</p>
          </div>
        </div>

        <div className="h-64 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-[var(--border)] rounded-xl">
              No hay acciones de staff en este rango de fechas.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis 
                  dataKey="nombre" 
                  stroke="#737373" 
                  fontSize={10} 
                  angle={-15} 
                  textAnchor="end" 
                />
                <YAxis stroke="#737373" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', borderRadius: '12px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="WhatsApp" stackId="a" fill="#10b981" />
                <Bar dataKey="Llamadas" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Presencial" stackId="a" fill="#a855f7" />
                <Bar dataKey="Interno" stackId="a" fill="#64748b" />
                <Bar dataKey="Estudios" stackId="a" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabla Detallada de Productividad del Staff */}
      <div className="rounded-2xl bg-neutral-900 border border-[var(--border)] overflow-hidden shadow-sm space-y-0">
        <div className="p-4 sm:px-6 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Matriz Individual de Productividad</h3>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Buscador */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar colaboradora..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="text-xs bg-neutral-950 border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-gray-200 focus:outline-hidden focus:border-blue-500 w-48"
              />
            </div>

            {/* Selector de ordenamiento */}
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <ArrowUpDown size={13} className="text-gray-400" />
              <select
                value={ordenarPor}
                onChange={(e: any) => setOrdenarPor(e.target.value)}
                className="text-xs bg-neutral-950 border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-gray-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="acciones">Ordenar: Más Acciones</option>
                <option value="whatsapp">Ordenar: Más WhatsApp</option>
                <option value="llamadas">Ordenar: Más Llamadas</option>
                <option value="estudios">Ordenar: Más Estudios</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/80 text-gray-400 font-bold border-b border-[var(--border)] uppercase text-[10.5px]">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Colaborador/a</th>
                <th className="py-3 px-4">Rol / Función</th>
                <th className="py-3 px-4 text-center">Contactos Totales</th>
                <th className="py-3 px-4 text-center">WhatsApp</th>
                <th className="py-3 px-4 text-center">Llamadas</th>
                <th className="py-3 px-4 text-center">Presencial</th>
                <th className="py-3 px-4 text-center">Estudios Qx</th>
                <th className="py-3 px-4 text-right">Última Actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-xs text-gray-500">
                    No se encontraron registros de productividad con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u, idx) => {
                  const esTop3 = idx < 3
                  const medalla = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null

                  return (
                    <tr key={u.nombre + idx} className="hover:bg-neutral-800/40 transition-colors">
                      {/* Posición / Medalla */}
                      <td className="py-3 px-4 text-center font-bold text-gray-400">
                        {medalla ? <span className="text-sm">{medalla}</span> : idx + 1}
                      </td>

                      {/* Nombre del colaborador */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] ${
                            esTop3 ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-gray-300'
                          }`}>
                            {u.nombre.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block">{u.nombre}</span>
                            {u.email && <span className="text-[10px] text-gray-400">{u.email}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-gray-300 text-[10.5px]">
                          {u.rol}
                        </span>
                      </td>

                      {/* Contactos Totales */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-white">
                        <span className="px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/30">
                          {u.contactos_totales}
                        </span>
                      </td>

                      {/* WhatsApp */}
                      <td className="py-3 px-4 text-center font-mono text-emerald-400 font-semibold">
                        {u.canales.whatsapp > 0 ? u.canales.whatsapp : '-'}
                      </td>

                      {/* Llamadas */}
                      <td className="py-3 px-4 text-center font-mono text-amber-400 font-semibold">
                        {u.canales.llamada > 0 ? u.canales.llamada : '-'}
                      </td>

                      {/* Presencial */}
                      <td className="py-3 px-4 text-center font-mono text-purple-300 font-semibold">
                        {u.canales.presencial > 0 ? u.canales.presencial : '-'}
                      </td>

                      {/* Estudios */}
                      <td className="py-3 px-4 text-center font-mono text-cyan-300 font-semibold">
                        {u.estudios_procesados > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                            {u.estudios_procesados}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Última Actividad */}
                      <td className="py-3 px-4 text-right text-gray-400 font-mono text-[11px]">
                        {u.ultima_actividad ? (
                          <div className="flex items-center justify-end gap-1">
                            <Clock size={12} className="text-gray-500" />
                            <span>{new Date(u.ultima_actividad).toLocaleDateString('es-AR')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
