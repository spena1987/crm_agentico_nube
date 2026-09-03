'use client'

import React, { useState } from 'react'
import { RecetaFarmacos, RecetaFarmacoItem, PacienteData } from '../types'
import { MEDS, POSOL } from '../catalogos'
import { Printer, Plus, Trash2, Pill } from 'lucide-react'

interface TabRecetasMedicamentosProps {
  paciente: PacienteData
  recetas: RecetaFarmacos[]
  onAddReceta: (receta: Omit<RecetaFarmacos, 'id' | 'paciente_id'>) => Promise<void>
  onDeleteReceta: (id: string) => Promise<void>
  onImprimirReceta: (receta: RecetaFarmacos) => void
}

export default function TabRecetasMedicamentos({
  paciente,
  recetas,
  onAddReceta,
  onDeleteReceta,
  onImprimirReceta
}: TabRecetasMedicamentosProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [diagnostico, setDiagnostico] = useState('')
  const [indicacionesGenerales, setIndicacionesGenerales] = useState('Esperar 5 minutos entre cada gota diferente. Higiene de manos previa.')
  const [items, setItems] = useState<RecetaFarmacoItem[]>([
    { farmaco: 'Hialuronato de sodio 0.4%', posologia: '1 gota cada 6 a 8 horas', ojo: 'AO' }
  ])
  const [guardando, setGuardando] = useState(false)

  // Opciones de fármacos
  const medsFlat = MEDS


  const addItem = () => {
    setItems([...items, { farmaco: '', posologia: '1 gota cada 8 horas', ojo: 'AO' }])
  }

  const updateItem = (index: number, fields: Partial<RecetaFarmacoItem>) => {
    const updated = [...items]
    updated[index] = { ...updated[index], ...fields }
    setItems(updated)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleGuardar = async () => {
    const validItems = items.filter(it => (it.farmaco || '').trim().length > 0)
    if (validItems.length === 0) {
      alert('Debe agregar al menos un medicamento.')
      return
    }
    setGuardando(true)
    try {
      await onAddReceta({
        fecha,
        diagnostico,
        items: validItems,
        indicaciones_generales: indicacionesGenerales
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4 text-[#16323f]">
      {/* Creador de Receta Rp */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#eef3f6]">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5" />
            Nueva Receta de Medicamentos (Rp)
          </h2>
          <span className="text-[10px] text-[#728a99]">
            Válido para farmacia y cobertura
          </span>
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
          <div className="md:col-span-9">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Diagnóstico / Motivo</label>
            <input
              type="text"
              placeholder="Ojo seco evaporativo / Glaucoma / Conjuntivitis / Postquirúrgico..."
              value={diagnostico}
              onChange={e => setDiagnostico(e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
            />
          </div>
        </div>

        {/* Lista de Fármacos */}
        <div className="space-y-2">
          <div className="text-[9.5px] uppercase font-extrabold text-[#728a99] flex items-center justify-between">
            <span>Fármacos Prescriptos</span>
            <button
              type="button"
              onClick={addItem}
              className="text-[#0e7c86] font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar fármaco
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-[#f7fafb] p-2 rounded border border-[#dde6ec]">
              <span className="font-mono text-xs font-bold text-[#0e7c86] w-4">
                {idx + 1}.
              </span>
              <div className="flex-1">
                <input
                  type="text"
                  list="dlMeds"
                  placeholder="Escriba o seleccione medicamento..."
                  value={item.farmaco}
                  onChange={e => updateItem(idx, { farmaco: e.target.value })}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs font-semibold"
                />
                <datalist id="dlMeds">
                  {medsFlat.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div className="w-20">
                <select
                  value={item.ojo || 'AO'}
                  onChange={e => updateItem(idx, { ojo: e.target.value as any })}
                  className="w-full border border-[#dde6ec] rounded px-1 py-1 bg-white text-xs font-bold text-center"
                >
                  <option>AO</option>
                  <option>OD</option>
                  <option>OI</option>
                </select>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  list="dlPosol"
                  placeholder="Posología / Horarios..."
                  value={item.posologia}
                  onChange={e => updateItem(idx, { posologia: e.target.value })}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs"
                />
                <datalist id="dlPosol">
                  {POSOL.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-1 text-[#9db0bc] hover:text-red-600 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div>
          <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Indicaciones de administración</label>
          <input
            type="text"
            value={indicacionesGenerales}
            onChange={e => setIndicacionesGenerales(e.target.value)}
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
            {guardando ? 'Guardando...' : 'Guardar e Imprimir Rp'}
          </button>
        </div>
      </div>

      {/* Historial de Recetas Farmacológicas */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-3 border-b border-[#eef3f6]">
          Recetas Rp Emitidas ({recetas.length})
        </h2>

        {recetas.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#728a99] italic">
            No hay recetas farmacológicas registradas.
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
                    {r.diagnostico && <span className="text-[#0e7c86] font-semibold">({r.diagnostico})</span>}
                  </div>
                  <div className="text-[11px] text-[#728a99] mt-1 space-y-0.5">
                    {r.items?.map((it, i) => (
                      <div key={i}>
                        • <span className="font-bold text-[#16323f]">{it.farmaco || (it as any).med}</span> ({it.ojo || 'AO'}): {it.posologia || (it as any).pos}
                      </div>

                    ))}
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
                      if (confirm('¿Eliminar esta receta farmacológica?')) {
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

