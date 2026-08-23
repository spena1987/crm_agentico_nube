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
  Calendar,
  Clock,
  UserCheck
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
          className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow hover:bg-amber-700 transition"
        >
          <RefreshCw size={14} />
          <span>Reintentar Consulta</span>
        </button>
      </div>
    )
  }

  const evoluciones = datosHC?.evoluciones || datosHC?.evoluciones_recientes || datosHC?.data?.evoluciones || []
  const pacienteNombre = datosHC?.paciente_nombre || datosHC?.data?.paciente_nombre
  const fichaId = datosHC?.ficha_id || datosHC?.data?.ficha_id

  const evolucionesFiltradas = evoluciones.filter((ev: any) => {
    if (!filtroTexto.trim()) return true
    const q = filtroTexto.toLowerCase()
    return (
      String(ev.prestador || ev.medico || '').toLowerCase().includes(q) ||
      String(ev.especialidad || '').toLowerCase().includes(q) ||
      String(ev.texto || ev.nota || ev.evolucion || '').toLowerCase().includes(q) ||
      String(ev.nombre_plantilla || ev.diagnostico || '').toLowerCase().includes(q) ||
      String(ev.fecha || '').toLowerCase().includes(q)
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
            placeholder="Buscar por médico, especialidad o nota..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {fichaId && (
            <span className="text-[11px] font-mono text-[var(--secondary)] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
              Ficha Geclisa: #{fichaId}
            </span>
          )}

          <button
            type="button"
            onClick={onRecargar}
            className="px-3.5 py-2 rounded-xl border border-[var(--border)] hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 transition"
            title="Recargar evoluciones desde Geclisa"
          >
            <RefreshCw size={14} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Listado de Evoluciones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
            <FileHeart size={16} className="text-blue-600" />
            <span>Evoluciones Clínicas Registradas ({evolucionesFiltradas.length})</span>
          </h5>
          {pacienteNombre && (
            <span className="text-[11px] text-[var(--secondary)]">
              Paciente: <b>{pacienteNombre}</b>
            </span>
          )}
        </div>

        {evolucionesFiltradas.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-[var(--border)]">
            <p className="text-xs text-[var(--secondary)] italic">
              No se encontraron evoluciones registradas en Geclisa para este paciente.
            </p>
          </div>
        ) : (
          evolucionesFiltradas.map((ev: any, idx: number) => {
            const medicoNombre = ev.prestador || ev.medico || 'Médico Tratante'
            const especialidad = ev.especialidad || ev.area || 'Oftalmología'
            const fechaStr = ev.fecha || ev.fecha_hora || 'Sin fecha'
            const horaStr = ev.hora || ''
            const titulo = ev.nombre_plantilla || ev.diagnostico || 'Evolución Clínica'
            const contenido = ev.texto || ev.nota || ev.evolucion || 'Sin detalles de la evolución.'

            return (
              <div
                key={ev.hc_id || ev.id || idx}
                className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/60 dark:bg-slate-800/40 space-y-2 hover:border-blue-500/40 transition shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                    <Stethoscope size={15} className="text-blue-600 shrink-0" />
                    <span>Dr/a. {medicoNombre}</span>
                    {especialidad && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 font-medium">
                        {especialidad}
                      </span>
                    )}
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

                {titulo && titulo !== 'Evolución Clínica' && (
                  <p className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                    {titulo}
                  </p>
                )}

                <div className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap font-sans bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-[var(--border)]">
                  {contenido}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}