'use client'

import React, { useState } from 'react'
import { RecetaAnteojos, ConsultaOftalmo, PacienteData } from '../types'
import { Printer, Copy, Plus, Trash2 } from 'lucide-react'

interface TabRecetasAnteojosProps {
  paciente: PacienteData
  recetas: RecetaAnteojos[]
  consultaActiva?: ConsultaOftalmo
  onAddReceta: (receta: Omit<RecetaAnteojos, 'id' | 'paciente_id'>) => Promise<void>
  onDeleteReceta: (id: string) => Promise<void>
  onImprimirReceta: (receta: RecetaAnteojos) => void
}

export default function TabRecetasAnteojos({
  paciente,
  recetas,
  consultaActiva,
  onAddReceta,
  onDeleteReceta,
  onImprimirReceta
}: TabRecetasAnteojosProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [lejosOd, setLejosOd] = useState({ esf: '', cil: '', eje: '', dnp: '' })
  const [lejosOi, setLejosOi] = useState({ esf: '', cil: '', eje: '', dnp: '' })
  const [cercaOd, setCercaOd] = useState({ esf: '', cil: '', eje: '', dnp: '' })
  const [cercaOi, setCercaOi] = useState({ esf: '', cil: '', eje: '', dnp: '' })
  const [tipoCristal, setTipoCristal] = useState('Monofocales')
  const [observaciones, setObservaciones] = useState('Filtro antirreflejo + protección Blue Light')
  const [guardando, setGuardando] = useState(false)

  // Copiar de la consulta activa
  const copiarRefraccion = () => {
    if (!consultaActiva?.refraccion) {
      alert('La consulta actual no tiene refracción registrada.')
      return
    }
    const od = consultaActiva.refraccion.od || {}
    const oi = consultaActiva.refraccion.oi || {}

    setLejosOd({ esf: od.esf || '', cil: od.cil || '', eje: od.eje || '', dnp: '' })
    setLejosOi({ esf: oi.esf || '', cil: oi.cil || '', eje: oi.eje || '', dnp: '' })

    // Calcular cerca sumando la adición si existe
    const addOd = parseFloat(String(od.add || '0').replace(',', '.')) || 0
    const esfNumOd = parseFloat(String(od.esf || '0').replace(',', '.')) || 0
    const addOi = parseFloat(String(oi.add || '0').replace(',', '.')) || 0
    const esfNumOi = parseFloat(String(oi.esf || '0').replace(',', '.')) || 0

    if (addOd || addOi) {
      setCercaOd({
        esf: (esfNumOd + addOd).toFixed(2),
        cil: od.cil || '',
        eje: od.eje || '',
        dnp: ''
      })
      setCercaOi({
        esf: (esfNumOi + addOi).toFixed(2),
        cil: oi.cil || '',
        eje: oi.eje || '',
        dnp: ''
      })
      setTipoCristal('Multifocales / Progresivos')
    }
  }

  const handleGuardar = async () => {
    setGuardando(true)
    try {
      await onAddReceta({
        fecha,
        lejos: { od: lejosOd, oi: lejosOi },
        cerca: { od: cercaOd, oi: cercaOi },
        tipo_cristal: tipoCristal,
        observaciones
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4 text-[#16323f]">
      {/* Editor de Receta */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#eef3f6]">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
            Nueva Prescripción Óptica
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copiarRefraccion}
              className="px-2.5 py-1 bg-[#e4f3f4] hover:bg-[#c3e2e4] text-[#0e7c86] font-bold rounded flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar valores de refracción actual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lejos */}
          <div className="border border-[#dde6ec] rounded-lg p-2.5 bg-[#f7fafb]">
            <div className="text-[10px] uppercase font-black text-[#0e7c86] mb-1.5">
              Visión de Lejos
            </div>
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="text-[8.5px] uppercase text-[#728a99] font-extrabold">
                  <th className="w-7"></th>
                  <th>Esfera</th>
                  <th>Cilindro</th>
                  <th>Eje</th>
                  <th>DNP (mm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f6]">
                <tr>
                  <td className="p-1 font-bold text-[#0e7c86]">OD</td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOd.esf}
                      onChange={e => setLejosOd({ ...lejosOd, esf: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOd.cil}
                      onChange={e => setLejosOd({ ...lejosOd, cil: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOd.eje}
                      onChange={e => setLejosOd({ ...lejosOd, eje: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOd.dnp}
                      onChange={e => setLejosOd({ ...lejosOd, dnp: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="p-1 font-bold text-[#0e7c86]">OI</td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOi.esf}
                      onChange={e => setLejosOi({ ...lejosOi, esf: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOi.cil}
                      onChange={e => setLejosOi({ ...lejosOi, cil: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOi.eje}
                      onChange={e => setLejosOi({ ...lejosOi, eje: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={lejosOi.dnp}
                      onChange={e => setLejosOi({ ...lejosOi, dnp: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center text-xs"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cerca */}
          <div className="border border-[#dde6ec] rounded-lg p-2.5 bg-[#f7fafb]">
            <div className="text-[10px] uppercase font-black text-[#0e7c86] mb-1.5">
              Visión de Cerca
            </div>
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="text-[8.5px] uppercase text-[#728a99] font-extrabold">
                  <th className="w-7"></th>
                  <th>Esfera</th>
                  <th>Cilindro</th>
                  <th>Eje</th>
                  <th>DNP (mm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f6]">
                <tr>
                  <td className="p-1 font-bold text-[#0e7c86]">OD</td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOd.esf}
                      onChange={e => setCercaOd({ ...cercaOd, esf: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOd.cil}
                      onChange={e => setCercaOd({ ...cercaOd, cil: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOd.eje}
                      onChange={e => setCercaOd({ ...cercaOd, eje: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOd.dnp}
                      onChange={e => setCercaOd({ ...cercaOd, dnp: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="p-1 font-bold text-[#0e7c86]">OI</td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOi.esf}
                      onChange={e => setCercaOi({ ...cercaOi, esf: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOi.cil}
                      onChange={e => setCercaOi({ ...cercaOi, cil: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOi.eje}
                      onChange={e => setCercaOi({ ...cercaOi, eje: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      value={cercaOi.dnp}
                      onChange={e => setCercaOi({ ...cercaOi, dnp: e.target.value })}
                      className="w-full border border-[#dde6ec] rounded py-0.5 text-center text-xs"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-4">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Tipo de cristales</label>
            <select
              value={tipoCristal}
              onChange={e => setTipoCristal(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs font-bold"
            >
              <option>Monofocales</option>
              <option>Multifocales / Progresivos</option>
              <option>Bifocales</option>
              <option>Ocupacionales</option>
              <option>Para descanso / Pantallas</option>
            </select>
          </div>
          <div className="md:col-span-8">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Tratamientos / Indicaciones ópticas</label>
            <input
              type="text"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#eef3f6]">
          <button
            type="button"
            disabled={guardando}
            onClick={handleGuardar}
            className="px-4 py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar e Imprimir Receta'}
          </button>
        </div>
      </div>

      {/* Historial de Recetas */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-3 border-b border-[#eef3f6]">
          Recetas de Anteojos Emitidas ({recetas.length})
        </h2>

        {recetas.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#728a99] italic">
            No hay recetas registradas para este paciente.
          </div>
        ) : (
          <div className="space-y-2">
            {recetas.map(r => (
              <div
                key={r.id}
                className="p-3 rounded-lg border border-[#dde6ec] bg-[#f7fafb] flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs flex items-center gap-2">
                    <span>{r.fecha ? r.fecha.slice(0, 10) : 'Sin fecha'}</span>
                    <span className="text-[#0e7c86] font-extrabold">{r.tipo_cristal}</span>
                  </div>
                  <div className="text-[11px] text-[#728a99] mt-0.5">
                    OD: {r.lejos?.od?.esf || '0.00'} {r.lejos?.od?.cil ? `${r.lejos?.od?.cil}×${r.lejos?.od?.eje}°` : ''} ·
                    OI: {r.lejos?.oi?.esf || '0.00'} {r.lejos?.oi?.cil ? `${r.lejos?.oi?.cil}×${r.lejos?.oi?.eje}°` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onImprimirReceta(r)}
                    className="px-2.5 py-1 bg-white border border-[#dde6ec] hover:bg-[#e4f3f4] text-[#0e7c86] rounded text-xs font-bold flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Eliminar esta receta?')) {
                        onDeleteReceta(r.id)
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

