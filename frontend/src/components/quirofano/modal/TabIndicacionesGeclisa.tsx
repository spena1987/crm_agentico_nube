'use client'

import React from 'react'
import {
  Pill,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  CheckCircle2
} from 'lucide-react'

interface TabIndicacionesGeclisaProps {
  cargando: boolean
  datosInd: any
  errorInd: string | null
  filtroTexto: string
  setFiltroTexto: (val: string) => void
  onRecargar: () => void
}

export default function TabIndicacionesGeclisa({
  cargando,
  datosInd,
  errorInd,
  filtroTexto,
  setFiltroTexto,
  onRecargar
}: TabIndicacionesGeclisaProps) {
  if (cargando) {
    return (
      <div className="py-16 text-center space-y-3">
        <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto" />
        <p className="text-xs font-bold text-[var(--foreground)]">Consultando Indicaciones Médicas en Geclisa...</p>
        <p className="text-[11px] text-[var(--secondary)]">Recuperando recetas, protocolos de colirios y medicación postoperatoria.</p>
      </div>
    )
  }

  if (errorInd) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-3 text-center">
        <AlertCircle size={28} className="mx-auto" />
        <p className="text-xs font-bold">{errorInd}</p>
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

  const recetas = datosInd?.recetas || []
  const protocolos = datosInd?.protocolos || []

  const recetasFiltradas = recetas.filter((r: any) => {
    if (!filtroTexto.trim()) return true
    const q = filtroTexto.toLowerCase()
    return (
      String(r.medicamento || '').toLowerCase().includes(q) ||
      String(r.posologia || '').toLowerCase().includes(q) ||
      String(r.medico || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por medicamento o posología..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:ring-2 focus:ring-emerald-500"
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

      {/* Protocolos Quirúrgicos y Colirios */}
      {protocolos.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
          <h5 className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 size={15} />
            <span>Protocolo de Gotas & Colirios Prequirúrgicos</span>
          </h5>
          <ul className="text-xs text-[var(--foreground)] space-y-1 list-disc list-inside">
            {protocolos.map((p: any, i: number) => (
              <li key={i}>{typeof p === 'string' ? p : p.descripcion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recetas / Indicaciones Médicas */}
      <div className="space-y-3">
        <h5 className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
          <Pill size={15} className="text-emerald-600" />
          <span>Medicamentos & Recetas Prescriptas ({recetasFiltradas.length})</span>
        </h5>

        {recetasFiltradas.length === 0 ? (
          <p className="text-xs text-[var(--secondary)] italic text-center py-8">
            No se registraron indicaciones médicas activas.
          </p>
        ) : (
          recetasFiltradas.map((r: any, idx: number) => (
            <div
              key={r.id || idx}
              className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/40 space-y-2 hover:border-emerald-500/40 transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[var(--border)] pb-2">
                <p className="font-extrabold text-[var(--foreground)] text-sm">
                  💊 {r.medicamento || r.droga || 'Medicamento prescrito'}
                </p>
                <span className="text-[11px] font-mono text-[var(--secondary)] flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{r.fecha || 'Receta vigente'}</span>
                </span>
              </div>

              <p className="text-xs text-[var(--foreground)] font-semibold">
                Posología: <span className="font-normal text-[var(--secondary)]">{r.posologia || r.indicacion || 'Según criterio médico'}</span>
              </p>

              {r.duracion && (
                <p className="text-[11px] text-[var(--secondary)] flex items-center gap-1">
                  <Clock size={12} />
                  <span>Duración del tratamiento: {r.duracion}</span>
                </p>
              )}

              {r.medico && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Prescrito por: Dr/a. {r.medico}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}