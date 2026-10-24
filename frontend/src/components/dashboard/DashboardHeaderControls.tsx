'use client'

import React from 'react'
import { Calendar, RefreshCw, FileDown, Filter, DollarSign } from 'lucide-react'

export interface RangoFiltro {
  tipo: '30d' | '7d' | 'mes' | 'hoy' | 'custom'
  dias: number
  fechaInicio?: string
  fechaFin?: string
}

interface Props {
  rango: RangoFiltro
  onRangoChange: (rango: RangoFiltro) => void
  moneda: 'ARS' | 'USD' | 'TODAS'
  onMonedaChange: (moneda: 'ARS' | 'USD' | 'TODAS') => void
  loading: boolean
  onRefresh: () => void
  onExportPdf: () => void
}

export default function DashboardHeaderControls({
  rango,
  onRangoChange,
  moneda,
  onMonedaChange,
  loading,
  onRefresh,
  onExportPdf
}: Props) {
  const handleSelectTipo = (tipo: '30d' | '7d' | 'mes' | 'hoy' | 'custom') => {
    if (tipo === '30d') {
      onRangoChange({ tipo: '30d', dias: 30 })
    } else if (tipo === '7d') {
      onRangoChange({ tipo: '7d', dias: 7 })
    } else if (tipo === 'mes') {
      const hoy = new Date()
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
      const hoyStr = hoy.toISOString().split('T')[0]
      onRangoChange({ tipo: 'mes', dias: 31, fechaInicio: primerDia, fechaFin: hoyStr })
    } else if (tipo === 'hoy') {
      const hoyStr = new Date().toISOString().split('T')[0]
      onRangoChange({ tipo: 'hoy', dias: 1, fechaInicio: hoyStr, fechaFin: hoyStr })
    } else {
      onRangoChange({ 
        tipo: 'custom', 
        dias: 30,
        fechaInicio: rango.fechaInicio || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        fechaFin: rango.fechaFin || new Date().toISOString().split('T')[0]
      })
    }
  }

  return (
    <div className="p-3.5 rounded-2xl bg-neutral-900 border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 shadow-xs">
      {/* Selector de Rango */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300 mr-1">
          <Calendar size={15} className="text-blue-400" />
          <span>Periodo:</span>
        </div>

        <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-[var(--border)] text-xs">
          <button
            type="button"
            onClick={() => handleSelectTipo('hoy')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rango.tipo === 'hoy' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => handleSelectTipo('7d')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rango.tipo === '7d' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
            }`}
          >
            7 Días
          </button>
          <button
            type="button"
            onClick={() => handleSelectTipo('30d')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rango.tipo === '30d' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
            }`}
          >
            Últimos 30 días
          </button>
          <button
            type="button"
            onClick={() => handleSelectTipo('mes')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rango.tipo === 'mes' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
            }`}
          >
            Mes en Curso
          </button>
          <button
            type="button"
            onClick={() => handleSelectTipo('custom')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rango.tipo === 'custom' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-400 hover:text-white'
            }`}
          >
            Personalizado
          </button>
        </div>

        {rango.tipo === 'custom' && (
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="date"
              value={rango.fechaInicio || ''}
              onChange={(e) => onRangoChange({ ...rango, fechaInicio: e.target.value })}
              className="bg-neutral-950 border border-[var(--border)] rounded-lg px-2 py-1 text-gray-200 focus:outline-hidden focus:border-blue-500"
            />
            <span className="text-gray-500">a</span>
            <input
              type="date"
              value={rango.fechaFin || ''}
              onChange={(e) => onRangoChange({ ...rango, fechaFin: e.target.value })}
              className="bg-neutral-950 border border-[var(--border)] rounded-lg px-2 py-1 text-gray-200 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* Selector de Moneda y Acciones */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-[var(--border)] text-xs">
          <button
            type="button"
            onClick={() => onMonedaChange('TODAS')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              moneda === 'TODAS' ? 'bg-neutral-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            ARS & USD
          </button>
          <button
            type="button"
            onClick={() => onMonedaChange('ARS')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              moneda === 'ARS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'text-gray-400 hover:text-white'
            }`}
          >
            ARS
          </button>
          <button
            type="button"
            onClick={() => onMonedaChange('USD')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              moneda === 'USD' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'text-gray-400 hover:text-white'
            }`}
          >
            USD
          </button>
        </div>

        {/* Botón Refrescar */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] hover:bg-neutral-800 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
          title="Recargar datos gerenciales"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-blue-400' : ''} />
          <span>Refrescar</span>
        </button>

        {/* Botón Exportar PDF */}
        <button
          type="button"
          onClick={onExportPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <FileDown size={14} />
          <span>Exportar Informe</span>
        </button>
      </div>
    </div>
  )
}
