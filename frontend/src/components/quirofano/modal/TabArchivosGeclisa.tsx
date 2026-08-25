'use client'

import React from 'react'
import {
  FolderDown,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  Calendar,
  UserCheck,
  Eye,
  Download,
  Trash2,
  FileQuestion,
  X
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

export interface ArchivoGeclisa {
  as_id: number
  titulo?: string
  fecha?: string
  hora?: string
  prestador?: string
  clase?: string
  formato?: string
  tamano?: number
  url?: string
  download_url?: string
}

interface TabArchivosGeclisaProps {
  cargando: boolean
  dataArchivos: any
  errorArchivos: string | null
  filtroTexto: string
  setFiltroTexto: (val: string) => void
  onRecargar: () => void
  onVerArchivo: (archivo: ArchivoGeclisa) => void
  onEliminarArchivo?: (asId: number) => Promise<void>
  eliminandoArchivoId?: number | null
}

export default function TabArchivosGeclisa({
  cargando,
  dataArchivos,
  errorArchivos,
  filtroTexto,
  setFiltroTexto,
  onRecargar,
  onVerArchivo,
  onEliminarArchivo,
  eliminandoArchivoId
}: TabArchivosGeclisaProps) {
  if (cargando) {
    return (
      <div className="py-16 text-center space-y-3">
        <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
        <p className="text-xs font-bold text-[var(--foreground)]">Consultando Archivos y Estudios en Geclisa...</p>
        <p className="text-[11px] text-[var(--secondary)]">Recuperando protocolos, consentimientos, biometrías y adjuntos clínicos en vivo.</p>
      </div>
    )
  }

  if (errorArchivos) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-3 text-center">
        <AlertCircle size={28} className="mx-auto" />
        <p className="text-xs font-bold">{errorArchivos}</p>
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

  const archivos: ArchivoGeclisa[] = dataArchivos?.archivos || []

  const archivosFiltrados = archivos.filter((arc) => {
    if (!filtroTexto.trim()) return true
    const term = filtroTexto.toLowerCase()
    const titulo = (arc.titulo || '').toLowerCase()
    const prestador = (arc.prestador || '').toLowerCase()
    const clase = (arc.clase || '').toLowerCase()
    const asId = String(arc.as_id || '')
    return titulo.includes(term) || prestador.includes(term) || clase.includes(term) || asId.includes(term)
  })

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Barra de Filtro y Recarga */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/60 p-3 rounded-2xl border border-[var(--border)]">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título, médico, ID o tipo de estudio..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-slate-400 outline-none focus:border-blue-500 transition"
          />
          {filtroTexto && (
            <button
              type="button"
              onClick={() => setFiltroTexto('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--foreground)]"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {dataArchivos?.ficha_id && (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-extrabold">
              Ficha Geclisa #{dataArchivos.ficha_id}
            </span>
          )}

          <span className="text-xs font-bold text-[var(--secondary)]">
            {archivosFiltrados.length} de {archivos.length} archivos
          </span>

          <button
            type="button"
            onClick={onRecargar}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] transition"
            title="Refrescar archivos de Geclisa"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Sin Ficha en Geclisa */}
      {dataArchivos && !dataArchivos.encontrado && (
        <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-blue-500 shadow-inner">
            <FileQuestion size={28} />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-[var(--foreground)]">Sin Archivos en Geclisa</h4>
            <p className="text-xs text-[var(--secondary)] leading-relaxed">
              {dataArchivos.mensaje || 'El paciente no posee Ficha registrada en Geclisa para listar archivos adjuntos.'}
            </p>
          </div>
        </div>
      )}

      {/* Ficha encontrada pero sin archivos */}
      {dataArchivos?.encontrado && archivos.length === 0 && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-slate-400">
            <FolderDown size={28} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--foreground)]">Sin Archivos Adjuntos</h4>
            <p className="text-xs text-[var(--secondary)] mt-1 max-w-sm">
              El paciente posee Ficha activa (#{dataArchivos.ficha_id}), pero aún no registra estudios complementarios, biometrías ni protocolos subidos.
            </p>
          </div>
        </div>
      )}

      {/* Lista filtrada vacía */}
      {dataArchivos?.encontrado && archivos.length > 0 && archivosFiltrados.length === 0 && (
        <div className="py-10 text-center space-y-2">
          <p className="text-xs text-[var(--secondary)] font-medium">
            No se encontraron archivos que coincidan con "<span className="text-[var(--foreground)] font-bold">{filtroTexto}</span>".
          </p>
          <button
            type="button"
            onClick={() => setFiltroTexto('')}
            className="text-xs text-blue-600 hover:underline font-bold"
          >
            Restablecer búsqueda
          </button>
        </div>
      )}

      {/* Listado de Tarjetas de Archivos */}
      {dataArchivos?.encontrado && archivosFiltrados.length > 0 && (
        <div className="space-y-2.5">
          {archivosFiltrados.map((arc) => (
            <div
              key={arc.as_id}
              className="p-3.5 rounded-2xl border bg-[var(--card)] border-[var(--border)] hover:border-blue-500/50 dark:hover:border-blue-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                  <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--foreground)] text-xs truncate">
                      {arc.titulo || 'Documento sin título'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-extrabold">
                      ID #{arc.as_id}
                    </span>
                    {arc.clase && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[var(--border)] font-semibold">
                        {arc.clase}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--secondary)] font-mono mt-1">
                    {arc.fecha && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        {arc.fecha} {arc.hora || ''}
                      </span>
                    )}
                    {arc.prestador && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <UserCheck size={11} />
                        {arc.prestador}
                      </span>
                    )}
                    {arc.formato && (
                      <span className="text-slate-400 uppercase font-bold text-[10px]">
                        .{arc.formato}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botonera de Acción Directa */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {/* Botón 1: Ver (Abre Visor In-App) */}
                <button
                  type="button"
                  onClick={() => onVerArchivo(arc)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition hover:scale-105 active:scale-95"
                  title="Visualizar documento en pantalla completa"
                >
                  <Eye size={13} />
                  <span>Ver</span>
                </button>

                {/* Botón 2: Descargar con 1-clic */}
                <a
                  href={`${BACKEND_URL}/api/geclisa/archivos/${arc.as_id}/descargar?nombre=${encodeURIComponent(arc.titulo || 'documento')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] border border-[var(--border)] rounded-xl text-xs font-bold flex items-center justify-center transition"
                  title="Descargar archivo al disco"
                >
                  <Download size={14} />
                </a>

                {/* Botón 3: Eliminar de Geclisa (Opcional) */}
                {onEliminarArchivo && (
                  <button
                    type="button"
                    disabled={eliminandoArchivoId === arc.as_id}
                    onClick={() => onEliminarArchivo(arc.as_id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition disabled:opacity-50"
                    title="Eliminar este archivo de la Historia Clínica de Geclisa"
                  >
                    {eliminandoArchivoId === arc.as_id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
