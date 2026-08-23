'use client'

import React, { useState } from 'react'
import {
  Play,
  CheckCircle2,
  Timer,
  Clock,
  Download,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { formatearHoraDesdeIso, calcularMinutosTranscurridos } from '@/lib/dateUtils'
import ModalPausaQuirurgicaOms from './ModalPausaQuirurgicaOms'

interface ConsolaCabeceraProps {
  turno: any
  onCambiarEstado: (nuevoEstado: string) => Promise<void>
  procesandoEstado: boolean
}

export default function ConsolaCabeceraIntraoperatoria({
  turno,
  onCambiarEstado,
  procesandoEstado
}: ConsolaCabeceraProps) {
  const [modalPausaAbierto, setModalPausaAbierto] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(false)

  const estado = turno.estado || 'programado'
  const esProgramado = estado === 'programado'
  const esEnEspera = estado === 'en_espera'
  const esEnOperacion = estado === 'en_operacion'
  const esOperado = estado === 'operado'

  const duracionEstimada = turno.duracion_minutos || 20
  const minutosEnQx = esEnOperacion ? calcularMinutosTranscurridos(turno.inicio_cirugia_at) : 0
  const esTiempoExcedidoModerado = esEnOperacion && minutosEnQx > duracionEstimada && minutosEnQx <= duracionEstimada * 1.3
  const esTiempoExcedidoCritico = esEnOperacion && minutosEnQx > duracionEstimada * 1.3
  const minutosExcedidos = Math.max(0, minutosEnQx - duracionEstimada)

  const handleDescargarParteQx = async () => {
    try {
      setDescargandoPdf(true)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turno.id}/parte-quirurgico`)
      const data = await res.json()
      if (res.ok && data.pdf_url) {
        window.open(`${BACKEND_URL}${data.pdf_url}`, '_blank')
      } else {
        alert('No se pudo generar el Parte Quirúrgico.')
      }
    } catch (e) {
      console.error('Error al descargar Parte Quirúrgico:', e)
    } finally {
      setDescargandoPdf(false)
    }
  }

  const handleConfirmarInicioPausa = async () => {
    setModalPausaAbierto(false)
    await onCambiarEstado('en_operacion')
  }

  return (
    <>
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Lado Izquierdo: Marcas de Tiempo Clínico */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock size={15} className="text-blue-400" />
            <span>Llegada:</span>
            <b className="text-white font-mono">{formatearHoraDesdeIso(turno.llegada_at, 'Pendiente')}</b>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Timer size={15} className="text-purple-400" />
            <span>Ingreso a Quirófano:</span>
            <b className="text-white font-mono">{formatearHoraDesdeIso(turno.inicio_cirugia_at, 'No iniciado')}</b>
          </div>

          {turno.fin_cirugia_at && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>Fin de Cirugía:</span>
              <b className="text-white font-mono">{formatearHoraDesdeIso(turno.fin_cirugia_at)}</b>
            </div>
          )}
        </div>

        {/* Lado Derecho: Cronómetro Quirúrgico y Acciones de 1 Clic */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Cronómetro Dinámico en Operación */}
          {esEnOperacion && (
            <div className={`px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all ${
              esTiempoExcedidoCritico
                ? 'bg-rose-600 text-white animate-pulse border border-rose-400'
                : esTiempoExcedidoModerado
                ? 'bg-amber-500 text-slate-950 font-bold border border-amber-300'
                : 'bg-purple-600 text-white'
            }`}>
              {esTiempoExcedidoCritico || esTiempoExcedidoModerado ? <AlertTriangle size={17} /> : <Timer size={17} className="animate-spin" />}
              <div className="text-left font-mono">
                <p className="text-[9px] uppercase tracking-wider font-extrabold opacity-90">
                  {esTiempoExcedidoCritico ? 'Alerta Sobreduración' : esTiempoExcedidoModerado ? 'Tiempo Excedido' : 'En Quirófano'}
                </p>
                <p className="text-sm font-extrabold">
                  {minutosEnQx}m <span className="text-[10px] opacity-80">/ {duracionEstimada}m</span>
                  {minutosExcedidos > 0 && <span className="ml-1 text-[11px] font-black underline">(+{minutosExcedidos}m)</span>}
                </p>
              </div>
            </div>
          )}

          {/* Botón 1: Recepcionar Llegada */}
          {esProgramado && (
            <button
              type="button"
              disabled={procesandoEstado}
              onClick={() => onCambiarEstado('en_espera')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow transition disabled:opacity-50"
            >
              {procesandoEstado ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
              <span>Recepcionar Paciente</span>
            </button>
          )}

          {/* Botón 2: Iniciar Cirugía (dispara Pausa Quirúrgica OMS) */}
          {esEnEspera && (
            <button
              type="button"
              disabled={procesandoEstado}
              onClick={() => setModalPausaAbierto(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-purple-500/30 transition disabled:opacity-50"
            >
              {procesandoEstado ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              <span>🟣 Iniciar Cirugía (Pausa OMS)</span>
            </button>
          )}

          {/* Botón 3: Finalizar Cirugía */}
          {esEnOperacion && (
            <button
              type="button"
              disabled={procesandoEstado}
              onClick={() => onCambiarEstado('operado')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            >
              {procesandoEstado ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>🟢 Finalizar Cirugía (Operado)</span>
            </button>
          )}

          {/* Si ya está Operado: Botón Descargar Protocolo Quirúrgico Oficial */}
          {esOperado && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>Cirugía Concluida</span>
              </span>

              <button
                type="button"
                disabled={descargandoPdf}
                onClick={handleDescargarParteQx}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
                title="Descargar Protocolo / Parte Quirúrgico Oficial en PDF"
              >
                {descargandoPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                <span>Protocolo Quirúrgico (PDF)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pausa Quirúrgica OMS */}
      <ModalPausaQuirurgicaOms
        isOpen={modalPausaAbierto}
        onClose={() => setModalPausaAbierto(false)}
        turno={turno}
        onConfirmarInicio={handleConfirmarInicioPausa}
        procesando={procesandoEstado}
      />
    </>
  )
}