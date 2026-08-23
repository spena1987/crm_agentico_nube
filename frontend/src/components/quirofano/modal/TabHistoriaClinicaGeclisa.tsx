'use client'

import React from 'react'
import {
  FileHeart,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Stethoscope,
  Activity,
  Calendar
} from 'lucide-react'

interface TabHistoriaClinicaGeclisaProps {
  cargando: boolean
  datosHC: any
  errorHC: string | null
  filtroTexto: string
  setFiltroTexto: (val: string) => void
  onRecargar: () => void
}

export default function TabHistoriaClinicaGeclisa({
  cargando,
  datosHC,
  errorHC,
  filtroTexto,
  setFiltroTexto,
  onRecargar
}: TabHistoriaClinicaGeclisaProps) {
  if (cargando) {
    return (
      <div className="py-16 text-center space-y-3">
        <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
        <p className="text-xs font-bold text-[var(--foreground)]">Consultando Historia Clínica en Geclisa...</p>
        <p className="text-[11px] text-[var(--secondary)]">Recuperando antecedentes, diagnósticos y evoluciones médicas en vivo.</p>
      </div>
    )
  }

  if (errorHC) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-3 text-center">
        <AlertCircle size={28} className="mx-auto" />
        <p className="text-xs font-bold">{errorHC}</p>
        <button
          type="button"
          onClick={onRecargar}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow"
        >
          <RefreshCw size={14} />
          <span>Reintentar Consulta</span>
        </button>
      </div>
    )
  }

  const evoluciones = datosHC?.evoluciones || []
  const antecedentes = datosHC?.antecedentes || 'Sin antecedentes patológicos registrados en Geclisa.'

  const evolucionesFiltradas = evoluciones.filter((ev: any) => {
    if (!filtroTexto.trim()) return true
    const q = filtroTexto.toLowerCase()
    return (
      String(ev.medico || '').toLowerCase().includes(q) ||
      String(ev.diagnostico || '').toLowerCase().includes(q) ||
      String(ev.nota || '').toLowerCase().includes(q) ||
      String(ev.fecha || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Barra de Filtro y Recarga */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por médico, diagnóstico o nota..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={onRecargar}
          className="px-3.5 py-2 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-[var(--secondary)] hover:text-[var(--foreground)] flex items-center gap-1.5 transition"
        >
          <RefreshCw size={14} />
          <span>Actualizar desde Geclisa</span>
        </button>
      </div>

      {/* Antecedentes Médicos */}
      <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-1.5">
        <h5 className="text-xs font-extrabold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
          <Activity size={15} />
          <span>Antecedentes Médicos & Factores de Riesgo</span>
        </h5>
        <p className="text-xs text-[var(--foreground)] leading-relaxed">{antecedentes}</p>
      </div>

      {/* Listado de Evoluciones */}
      <div className="space-y-3">
        <h5 className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
          <FileHeart size={15} className="text-blue-600" />
          <span>Evoluciones Clínicas Registradas ({evolucionesFiltradas.length})</span>
        </h5>

        {evolucionesFiltradas.length === 0 ? (
          <p className="text-xs text-[var(--secondary)] italic text-center py-8">
            No se encontraron evoluciones que coincidan con la búsqueda.
          </p>
        ) : (
          evolucionesFiltradas.map((ev: any, idx: number) => (
            <div
              key={ev.id || idx}
              className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/40 space-y-2 hover:border-blue-500/40 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[var(--border)] pb-2">
                <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                  <Stethoscope size={14} className="text-blue-600" />
                  <span>Dr/a. {ev.medico || 'Médico Tratante'}</span>
                  {ev.especialidad && <span className="text-[10px] text-[var(--secondary)] font-normal">({ev.especialidad})</span>}
                </div>
                <span className="text-[11px] font-mono text-[var(--secondary)] flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{ev.fecha || 'Sin fecha'}</span>
                </span>
              </div>

              {ev.diagnostico && (
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  Diagnóstico: {ev.diagnostico}
                </p>
              )}

              <p className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                {ev.nota || ev.evolucion || 'Sin detalles de la evolución.'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}