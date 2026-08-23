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
  CheckCircle2,
  Stethoscope,
  FileText
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
        <p className="text-[11px] text-[var(--secondary)]">Recuperando protocolos de gotas, colirios y medicación postoperatoria.</p>
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
          className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow hover:bg-amber-700 transition"
        >
          <RefreshCw size={14} />
          <span>Reintentar Consulta</span>
        </button>
      </div>
    )
  }

  const itemsIndicaciones = datosInd?.indicaciones || datosInd?.recetas || datosInd?.data?.indicaciones || []
  const pacienteNombre = datosInd?.paciente_nombre || datosInd?.data?.paciente_nombre
  const fichaId = datosInd?.ficha_id || datosInd?.data?.ficha_id

  const indicacionesFiltradas = itemsIndicaciones.filter((r: any) => {
    if (!filtroTexto.trim()) return true
    const q = filtroTexto.toLowerCase()
    return (
      String(r.titulo || r.medicamento || '').toLowerCase().includes(q) ||
      String(r.texto || r.posologia || r.indicacion || '').toLowerCase().includes(q) ||
      String(r.prestador || r.medico || '').toLowerCase().includes(q) ||
      String(r.especialidad || '').toLowerCase().includes(q) ||
      String(r.tipo_label || r.tipo || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Barra de Filtro, Info de Ficha y Recarga */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-[var(--border)]">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por indicación, fármaco o médico..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {fichaId && (
            <span className="text-[11px] font-mono text-[var(--secondary)] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              Ficha Geclisa: #{fichaId}
            </span>
          )}

          <button
            type="button"
            onClick={onRecargar}
            className="px-3.5 py-2 rounded-xl border border-[var(--border)] hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 transition"
            title="Recargar indicaciones desde Geclisa"
          >
            <RefreshCw size={14} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Listado de Indicaciones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
            <Pill size={16} className="text-emerald-600" />
            <span>Indicaciones Médicas & Protocolos ({indicacionesFiltradas.length})</span>
          </h5>
          {pacienteNombre && (
            <span className="text-[11px] text-[var(--secondary)]">
              Paciente: <b>{pacienteNombre}</b>
            </span>
          )}
        </div>

        {indicacionesFiltradas.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-[var(--border)]">
            <p className="text-xs text-[var(--secondary)] italic">
              No se registraron indicaciones médicas activas en Geclisa para este paciente.
            </p>
          </div>
        ) : (
          indicacionesFiltradas.map((r: any, idx: number) => {
            const titulo = r.titulo || r.medicamento || r.droga || 'Indicación Médica'
            const contenido = r.texto || r.posologia || r.indicacion || 'Sin especificaciones.'
            const medicoNombre = r.prestador || r.medico || 'Equipo Médico'
            const especialidad = r.especialidad || 'Oftalmología'
            const tipoLabel = r.tipo_label || (r.tipo === 'RECETA' ? 'Receta Médica' : 'Indicación Médica')
            const fechaStr = r.fecha || 'Vigente'
            const horaStr = r.hora || ''

            return (
              <div
                key={r.id || idx}
                className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/60 dark:bg-slate-800/40 space-y-2 hover:border-emerald-500/40 transition shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] border border-emerald-300 dark:border-emerald-800">
                      {tipoLabel}
                    </span>
                    <span className="font-extrabold text-[var(--foreground)] text-sm">
                      {titulo}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--secondary)]">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>{fechaStr}</span>
                    </span>
                    {horaStr && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{horaStr} hs</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap font-sans bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-[var(--border)] font-medium">
                  {contenido}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[var(--secondary)]">
                  <div className="flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-emerald-600" />
                    <span>Prescrito por: <b>Dr/a. {medicoNombre}</b> {especialidad && `(${especialidad})`}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}