'use client'

import React, { useState } from 'react'
import { EstudioOftalmo } from '../types'
import { ESTUDIOS } from '../catalogos'
import { Plus, Trash2, FileText, ExternalLink, Paperclip } from 'lucide-react'

interface TabEstudiosProps {
  estudios: EstudioOftalmo[]
  onAddEstudio: (estudio: Omit<EstudioOftalmo, 'id' | 'paciente_id'>) => Promise<void>
  onDeleteEstudio: (id: string) => Promise<void>
}

export default function TabEstudios({
  estudios,
  onAddEstudio,
  onDeleteEstudio
}: TabEstudiosProps) {
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState(new Date().toISOString().slice(0, 10))
  const [nuevoOjo, setNuevoOjo] = useState<'OD' | 'OI' | 'AO'>('AO')
  const [nuevoInforme, setNuevoInforme] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleCreate = async () => {
    if (!nuevoTipo) {
      alert('Seleccione o ingrese el tipo de estudio')
      return
    }
    setGuardando(true)
    try {
      await onAddEstudio({
        tipo_estudio: nuevoTipo,
        fecha: nuevaFecha,
        ojo: nuevoOjo,
        informe: nuevoInforme
      })
      setNuevoTipo('')
      setNuevoInforme('')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4 text-[#16323f]">
      {/* Formulario para cargar nuevo estudio */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-3 border-b border-[#eef3f6] flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Registrar Nuevo Estudio Complementario
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-4">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Tipo de estudio</label>
            <select
              value={nuevoTipo}
              onChange={e => setNuevoTipo(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs font-bold"
            >
              <option value="">Seleccione estudio...</option>
              {ESTUDIOS.map(e => (
                <option key={e.t} value={e.t}>{e.t}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Fecha realización</label>
            <input
              type="date"
              value={nuevaFecha}
              onChange={e => setNuevaFecha(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Ojo</label>
            <select
              value={nuevoOjo}
              onChange={e => setNuevoOjo(e.target.value as any)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs font-bold text-center"
            >
              <option>AO</option>
              <option>OD</option>
              <option>OI</option>
            </select>
          </div>
          <div className="md:col-span-3 flex items-end">
            <button
              type="button"
              disabled={guardando}
              onClick={handleCreate}
              className="w-full py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar Estudio'}
            </button>
          </div>
          <div className="md:col-span-12">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Informe / Conclusiones</label>
            <textarea
              rows={2}
              placeholder="Resultados relevantes (Kmax, paquimetría mínima, espesor foveal, densidad endotelial, etc.)..."
              value={nuevoInforme}
              onChange={e => setNuevoInforme(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Listado de estudios registrados */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-3 border-b border-[#eef3f6]">
          Estudios Realizados ({estudios.length})
        </h2>

        {estudios.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#728a99] italic">
            No hay estudios cargados en la historia clínica.
          </div>
        ) : (
          <div className="space-y-2">
            {estudios.map(est => (
              <div
                key={est.id}
                className="p-3 rounded-lg border border-[#dde6ec] hover:border-[#b3c7d1] bg-[#f7fafb] flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#16323f]">
                      {est.tipo_estudio}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
                      {est.ojo || 'AO'}
                    </span>
                    <span className="text-xs text-[#728a99]">
                      {est.fecha ? est.fecha.slice(0, 10) : 'Sin fecha'}
                    </span>
                  </div>
                  {est.informe && (
                    <p className="text-xs text-[#16323f] bg-white p-2 rounded border border-[#eef3f6] whitespace-pre-wrap">
                      {est.informe}
                    </p>
                  )}
                  {est.archivo_url && (
                    <a
                      href={est.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0e7c86] hover:underline pt-1"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Ver archivo adjunto
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Desea eliminar este registro de estudio?')) {
                        onDeleteEstudio(est.id)
                      }
                    }}
                    className="p-1.5 text-[#9db0bc] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar estudio"
                  >
                    <Trash2 className="w-4 h-4" />
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

