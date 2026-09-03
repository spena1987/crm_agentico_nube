'use client'

import React, { useState } from 'react'
import { PedidoEstudios, PacienteData } from '../types'
import { PRESETS, ESTUDIOS } from '../catalogos'
import { Printer, Plus, Trash2, ClipboardList, CheckSquare, Square } from 'lucide-react'

interface TabPedidosEstudiosProps {
  paciente: PacienteData
  pedidos: PedidoEstudios[]
  onAddPedido: (pedido: Omit<PedidoEstudios, 'id' | 'paciente_id'>) => Promise<void>
  onDeletePedido: (id: string) => Promise<void>
  onImprimirPedido: (pedido: PedidoEstudios) => void
}

export default function TabPedidosEstudios({
  paciente,
  pedidos,
  onAddPedido,
  onDeletePedido,
  onImprimirPedido
}: TabPedidosEstudiosProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [diagnostico, setDiagnostico] = useState('')
  const [ojo, setOjo] = useState<'OD' | 'OI' | 'AO'>('AO')
  const [observaciones, setObservaciones] = useState('Solicito evaluación prequirúrgica completa.')
  const [estudiosSeleccionados, setEstudiosSeleccionados] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  // Aplicar Preset
  const aplicarPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey]
    if (preset) {
      setEstudiosSeleccionados(preset.ordenes || [])
      setDiagnostico(preset.dx || '')
    }
  }


  const toggleEstudio = (estudio: string) => {
    if (estudiosSeleccionados.includes(estudio)) {
      setEstudiosSeleccionados(estudiosSeleccionados.filter(e => e !== estudio))
    } else {
      setEstudiosSeleccionados([...estudiosSeleccionados, estudio])
    }
  }

  const handleGuardar = async () => {
    if (estudiosSeleccionados.length === 0) {
      alert('Seleccione al menos un estudio para la orden médica.')
      return
    }
    setGuardando(true)
    try {
      await onAddPedido({
        fecha,
        diagnostico,
        ojo,
        estudios: estudiosSeleccionados,
        observaciones
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4 text-[#16323f]">
      {/* Editor de Orden de Estudios */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#eef3f6]">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            Nueva Orden Médica de Estudios
          </h2>
          <span className="text-[10px] text-[#728a99]">
            Para presentar en obras sociales o centro de diagnóstico
          </span>
        </div>

        {/* Presets Quirúrgicos */}
        <div>
          <label className="text-[9.5px] uppercase font-black text-[#728a99] block mb-1">
            Plantillas Rápidas (Presets Quirúrgicos)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['catarata', 'Pack Quirúrgico Catarata'],
              ['refractiva', 'Pack Cirugía Refractiva'],
              ['queratocono', 'Pack Queratocono / CXL'],
              ['glaucoma', 'Pack Glaucoma'],
              ['retina', 'Pack Retina y Mácula']
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => aplicarPreset(key)}
                className="px-2.5 py-1 rounded bg-[#e4f3f4] hover:bg-[#c3e2e4] text-[#0e7c86] font-bold text-xs border border-[#c3e2e4] transition-colors"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-3">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Ojo</label>
            <select
              value={ojo}
              onChange={e => setOjo(e.target.value as any)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs font-bold text-center"
            >
              <option>AO</option>
              <option>OD</option>
              <option>OI</option>
            </select>
          </div>
          <div className="md:col-span-7">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Diagnóstico / Justificación Clínica</label>
            <input
              type="text"
              placeholder="Catarata senil / Evaluación queratocono / Evaluación refractiva..."
              value={diagnostico}
              onChange={e => setDiagnostico(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
            />
          </div>
        </div>

        {/* Selección individual de estudios */}
        <div>
          <label className="text-[9.5px] uppercase font-black text-[#728a99] block mb-1.5">
            Estudios Solicitados ({estudiosSeleccionados.length})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 bg-[#f7fafb] p-2.5 rounded-lg border border-[#dde6ec] max-h-56 overflow-y-auto">
            {ESTUDIOS.map(est => {
              const checked = estudiosSeleccionados.includes(est.t)
              return (
                <label
                  key={est.t}
                  onClick={() => toggleEstudio(est.t)}
                  className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs border transition-colors ${
                    checked
                      ? 'bg-white border-[#0e7c86] font-bold text-[#0e7c86]'
                      : 'border-transparent hover:bg-white text-[#16323f]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    className="rounded text-[#0e7c86] accent-[#0e7c86]"
                  />
                  <span>{est.t}</span>
                </label>
              )
            })}

          </div>
        </div>

        <div>
          <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Observaciones adicionales para el centro</label>
          <input
            type="text"
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#eef3f6]">
          <button
            type="button"
            disabled={guardando}
            onClick={handleGuardar}
            className="px-4 py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar e Imprimir Orden'}
          </button>
        </div>
      </div>

      {/* Historial de Órdenes */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-3 border-b border-[#eef3f6]">
          Órdenes de Estudios Emitidas ({pedidos.length})
        </h2>

        {pedidos.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#728a99] italic">
            No hay pedidos de estudios registrados para este paciente.
          </div>
        ) : (
          <div className="space-y-2">
            {pedidos.map(p => (
              <div
                key={p.id}
                className="p-3 rounded-lg border border-[#dde6ec] bg-[#f7fafb] flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-2">
                    <span>{p.fecha ? p.fecha.slice(0, 10) : 'Sin fecha'}</span>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
                      {p.ojo || 'AO'}
                    </span>
                    {p.diagnostico && <span className="text-[#0e7c86] font-semibold">({p.diagnostico})</span>}
                  </div>
                  <div className="text-[11px] text-[#728a99] mt-1">
                    {(p.estudios || p.items)?.join(' · ')}
                  </div>

                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onImprimirPedido(p)}
                    className="px-2.5 py-1 bg-white border border-[#dde6ec] hover:bg-[#e4f3f4] text-[#0e7c86] rounded text-xs font-bold flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Eliminar esta orden médica?')) {
                        onDeletePedido(p.id)
                      }
                    }}
                    className="p-1 text-[#9db0bc] hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

