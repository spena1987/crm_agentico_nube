'use client'

import React, { useState } from 'react'
import {
  FileText,
  X,
  Eye,
  Download,
  Calendar,
  Building2,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  AlertTriangle
} from 'lucide-react'
import { BACKEND_URL, getAuthHeaders } from '@/lib/api'

interface ModalPlanillaQuirurgicaA4Props {
  isOpen: boolean
  onClose: () => void
  fecha: string
  quirofanos?: Array<{ id: string; nombre: string; codigo?: string }>
  totalCirugias?: number
}

export default function ModalPlanillaQuirurgicaA4({
  isOpen,
  onClose,
  fecha,
  quirofanos = [],
  totalCirugias = 0
}: ModalPlanillaQuirurgicaA4Props) {
  const [quirofanoId, setQuirofanoId] = useState<string>('all')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'con_lio' | 'sin_lio'>('todos')
  const [generando, setGenerando] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleEmitirPlanilla = async (modo: 'preview' | 'download') => {
    try {
      setGenerando(true)
      setError(null)

      const headers = await getAuthHeaders()
      const queryParams = new URLSearchParams({
        fecha,
        quirofano_id: quirofanoId,
        tipo_filtro: tipoFiltro
      })

      const targetUrl = `${BACKEND_URL}/api/quirofanos/planilla-diaria-pdf?${queryParams.toString()}`
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Error ${res.status}: ${errorText || 'No se pudo generar la planilla PDF'}`)
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)

      if (modo === 'preview') {
        window.open(blobUrl, '_blank')
      } else {
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = `Planilla_Control_Quirofano_${fecha}_${tipoFiltro}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err: any) {
      console.error('Error al generar planilla quirúrgica A4:', err)
      setError(err?.message || 'Error inesperado al emitir la planilla quirúrgica.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Planilla Quirúrgica Operativa Diaria
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  A4 Landscape
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                14 columnas de alta densidad visual para enfermería, instrumentación y anestesiología
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Tarjeta de Resumen de Parámetros */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <Calendar size={16} className="text-blue-500 shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Fecha Quirúrgica
                </span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  {fecha || 'Día de hoy'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-emerald-500 shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Pacientes en Pizarra
                </span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  {totalCirugias} {totalCirugias === 1 ? 'paciente' : 'pacientes'} programados
                </span>
              </div>
            </div>
          </div>

          {/* Selectores de Filtro */}
          <div className="space-y-4">
            {/* Filtro por Sala / Quirófano */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-500" />
                Sala / Quirófano:
              </label>
              <select
                value={quirofanoId}
                onChange={(e) => setQuirofanoId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition"
              >
                <option value="all">Todas las salas (Listado Unificado por Horario)</option>
                {quirofanos.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nombre} {q.codigo ? `(${q.codigo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Alcance de Procedimientos */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Filter size={14} className="text-slate-500" />
                Alcance de Procedimientos:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoFiltro('todos')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                    tipoFiltro === 'todos'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span>Todas las Cirugías</span>
                  <span className="text-[10px] font-normal opacity-80">Jornada completa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoFiltro('con_lio')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                    tipoFiltro === 'con_lio'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span>Solo con LIO</span>
                  <span className="text-[10px] font-normal opacity-80">Cataratas / Faco</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoFiltro('sin_lio')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                    tipoFiltro === 'sin_lio'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span>Sin LIO</span>
                  <span className="text-[10px] font-normal opacity-80">Inyecciones / Otros</span>
                </button>
              </div>
            </div>
          </div>

          {/* Puntos destacados del diseño */}
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5">
            <span className="font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Sparkles size={13} />
              Garantías operativas incluidas en esta planilla:
            </span>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1 pl-4 list-disc text-[10.5px]">
              <li><b>H. PAC.:</b> Hora de citación prequirúrgica (T-50m).</li>
              <li><b>Número (1, 2, U):</b> Secuencia bilateral automática.</li>
              <li><b>Lateralidad OJO:</b> Badge cromático rojo (OD) o verde (OI).</li>
              <li><b>LIO Condensado:</b> Modelo, dioptría, eje e incisión en mesa.</li>
            </ul>
          </div>
        </div>

        {/* Pie de Acciones */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleEmitirPlanilla('download')}
              disabled={generando}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Download size={14} />
              <span>{generando ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleEmitirPlanilla('preview')}
              disabled={generando}
              className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md hover:shadow-blue-500/20 disabled:opacity-50"
            >
              <Eye size={14} />
              <span>{generando ? 'Preparando...' : 'Previsualizar / Imprimir'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
