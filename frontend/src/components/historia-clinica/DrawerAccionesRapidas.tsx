'use client'

import React, { useState } from 'react'
import {
  X,
  Pill,
  ClipboardList,
  FileText,
  Printer,
  Plus,
  Trash2,
  ExternalLink,
  Paperclip,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import {
  PacienteData,
  ConsultaOftalmo,
  RecetaFarmacos,
  PedidoEstudios,
  EstudioOftalmo
} from './types'
import { MEDS, POSOL, PRESETS, ESTUDIOS } from './catalogos'

export type DrawerTab = 'farmacos' | 'pedidos' | 'estudios'

interface DrawerAccionesRapidasProps {
  isOpen: boolean
  onClose: () => void
  activeDrawerTab: DrawerTab
  setActiveDrawerTab: (tab: DrawerTab) => void
  paciente: PacienteData
  consultaActiva?: ConsultaOftalmo
  recetasFarmacos: RecetaFarmacos[]
  pedidosEstudios: PedidoEstudios[]
  estudios: EstudioOftalmo[]
  onAddRecetaFarmacos: (receta: Omit<RecetaFarmacos, 'id' | 'paciente_id'>) => Promise<void>
  onDeleteRecetaFarmacos: (id: string) => Promise<void>
  onImprimirRecetaFarmacos: (receta: RecetaFarmacos) => void
  onAddPedidoEstudios: (pedido: Omit<PedidoEstudios, 'id' | 'paciente_id'>) => Promise<void>
  onDeletePedidoEstudios: (id: string) => Promise<void>
  onImprimirPedidoEstudios: (pedido: PedidoEstudios) => void
  onAddEstudio: (estudio: Omit<EstudioOftalmo, 'id' | 'paciente_id'>) => Promise<void>
  onDeleteEstudio: (id: string) => Promise<void>
}

export default function DrawerAccionesRapidas({
  isOpen,
  onClose,
  activeDrawerTab,
  setActiveDrawerTab,
  paciente,
  consultaActiva,
  recetasFarmacos,
  pedidosEstudios,
  estudios,
  onAddRecetaFarmacos,
  onDeleteRecetaFarmacos,
  onImprimirRecetaFarmacos,
  onAddPedidoEstudios,
  onDeletePedidoEstudios,
  onImprimirPedidoEstudios,
  onAddEstudio,
  onDeleteEstudio
}: DrawerAccionesRapidasProps) {
  // Estado local para receta de fármacos rápida
  const [farmacoSel, setFarmacoSel] = useState('')
  const [posologiaSel, setPosologiaSel] = useState('')
  const [ojoFarmaco, setOjoFarmaco] = useState<'AO' | 'OD' | 'OI'>('AO')
  const [itemsReceta, setItemsReceta] = useState<Array<{ farmaco: string; posologia: string; ojo: string }>>([])
  const [indicacionesGenerales, setIndicacionesGenerales] = useState('Esperar 5 min entre cada gota diferente.')
  const [guardandoFarmacos, setGuardandoFarmacos] = useState(false)

  // Estado local para pedidos de estudios rápidos
  const [estudiosSeleccionados, setEstudiosSeleccionados] = useState<string[]>([])
  const [ojoPedido, setOjoPedido] = useState<'AO' | 'OD' | 'OI'>('AO')
  const [guardandoPedido, setGuardandoPedido] = useState(false)

  if (!isOpen) return null

  const handleAgregarItemFarmaco = () => {
    if (!farmacoSel) return
    setItemsReceta(prev => [
      ...prev,
      {
        farmaco: farmacoSel,
        posologia: posologiaSel || '1 gota cada 8 horas',
        ojo: ojoFarmaco
      }
    ])
    setFarmacoSel('')
  }

  const handleGuardarRecetaCompleta = async () => {
    if (itemsReceta.length === 0) return
    setGuardandoFarmacos(true)
    try {
      await onAddRecetaFarmacos({
        consulta_id: consultaActiva?.id,
        fecha: consultaActiva?.fecha || new Date().toISOString().slice(0, 10),
        diagnostico: consultaActiva?.conducta?.dx_presuntivo || 'Control oftalmológico',
        items: itemsReceta.map(it => ({
          med: it.farmaco,
          pos: it.posologia,
          ojo: it.ojo
        })),
        indicaciones_generales: indicacionesGenerales
      })
      setItemsReceta([])
    } finally {
      setGuardandoFarmacos(false)
    }
  }

  const handleToggleEstudio = (nombre: string) => {
    setEstudiosSeleccionados(prev =>
      prev.includes(nombre) ? prev.filter(s => s !== nombre) : [...prev, nombre]
    )
  }

  const handleGuardarPedido = async () => {
    if (estudiosSeleccionados.length === 0) return
    setGuardandoPedido(true)
    try {
      await onAddPedidoEstudios({
        consulta_id: consultaActiva?.id,
        fecha: consultaActiva?.fecha || new Date().toISOString().slice(0, 10),
        titulo: estudiosSeleccionados.length === 1 ? estudiosSeleccionados[0] : 'Solicitud de Estudios Complementarios',
        items: estudiosSeleccionados,
        estudios: estudiosSeleccionados,
        ojo: ojoPedido,
        diagnostico: consultaActiva?.conducta?.dx_presuntivo || 'Evaluación diagnóstica oftalmológica'
      })
      setEstudiosSeleccionados([])
    } finally {
      setGuardandoPedido(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white border-l border-[#dde6ec] shadow-2xl flex flex-col text-[#16323f] animate-in slide-in-from-right duration-200">
      {/* Cabecera del Drawer */}
      <div className="px-4 py-3 bg-[#f7fafb] border-b border-[#eef3f6] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-[#0e7c86] tracking-tight">
            Acciones Rápidas
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
            En paralelo
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#9db0bc] hover:text-[#16323f] p-1 rounded-lg transition-colors"
          title="Cerrar panel lateral"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs del Drawer */}
      <div className="flex border-b border-[#dde6ec] bg-[#edf3f6] text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveDrawerTab('farmacos')}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 transition-all ${
            activeDrawerTab === 'farmacos'
              ? 'bg-white text-[#0e7c86] border-b-2 border-[#0e7c86] font-extrabold'
              : 'text-[#526b7a] hover:bg-white/60'
          }`}
        >
          <Pill className="w-3.5 h-3.5" />
          <span>Fármacos ({recetasFarmacos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDrawerTab('pedidos')}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 transition-all ${
            activeDrawerTab === 'pedidos'
              ? 'bg-white text-[#0e7c86] border-b-2 border-[#0e7c86] font-extrabold'
              : 'text-[#526b7a] hover:bg-white/60'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Pedidos ({pedidosEstudios.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDrawerTab('estudios')}
          className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 transition-all ${
            activeDrawerTab === 'estudios'
              ? 'bg-white text-[#0e7c86] border-b-2 border-[#0e7c86] font-extrabold'
              : 'text-[#526b7a] hover:bg-white/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Estudios ({estudios.length})</span>
        </button>
      </div>

      {/* Contenido según Tab Activo */}
      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
        {/* TAB 1: FÁRMACOS (RP) */}
        {activeDrawerTab === 'farmacos' && (
          <div className="space-y-3">
            <div className="bg-[#f8fafc] border border-[#dde6ec] rounded-lg p-2.5 space-y-2">
              <span className="text-[9.5px] uppercase font-black text-[#0e7c86] tracking-wider block">
                Prescribir Colirio / Fármaco
              </span>

              <div className="space-y-1.5">
                <div>
                  <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">Colirio o Medicamento</label>
                  <select
                    value={farmacoSel}
                    onChange={e => setFarmacoSel(e.target.value)}
                    className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs bg-white font-semibold outline-none focus:border-[#0e7c86]"
                  >
                    <option value="">Seleccione colirio...</option>
                    {MEDS.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-12 gap-1.5">
                  <div className="col-span-8">
                    <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">Posología</label>
                    <select
                      value={posologiaSel}
                      onChange={e => setPosologiaSel(e.target.value)}
                      className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs bg-white outline-none focus:border-[#0e7c86]"
                    >
                      <option value="">Seleccione esquema...</option>
                      {POSOL.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5 text-center">Ojo</label>
                    <select
                      value={ojoFarmaco}
                      onChange={e => setOjoFarmaco(e.target.value as any)}
                      className="w-full border border-[#dde6ec] rounded px-1 py-1 text-xs bg-white font-bold text-center outline-none focus:border-[#0e7c86]"
                    >
                      <option>AO</option>
                      <option>OD</option>
                      <option>OI</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAgregarItemFarmaco}
                  disabled={!farmacoSel}
                  className="w-full py-1 bg-white border border-[#dde6ec] hover:border-[#0e7c86] hover:bg-[#e4f3f4] text-[#0e7c86] font-bold rounded text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar a la receta
                </button>
              </div>

              {/* Items en borrador de la receta */}
              {itemsReceta.length > 0 && (
                <div className="pt-2 border-t border-[#eef3f6] space-y-1.5">
                  <span className="text-[8.5px] uppercase font-bold text-[#728a99] block">
                    Medicamentos incluidos ({itemsReceta.length}):
                  </span>
                  <div className="space-y-1">
                    {itemsReceta.map((it, idx) => (
                      <div key={idx} className="bg-white p-1.5 rounded border border-[#dde6ec] flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-[#16323f]">{it.farmaco}</strong> ({it.ojo})
                          <div className="text-[10px] text-[#728a99]">{it.posologia}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setItemsReceta(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={guardandoFarmacos}
                    onClick={handleGuardarRecetaCompleta}
                    className="w-full py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white font-bold rounded text-xs transition-colors shadow-xs"
                  >
                    {guardandoFarmacos ? 'Guardando receta...' : 'Emitir Receta Rp'}
                  </button>
                </div>
              )}
            </div>

            {/* Recetas emitidas previamente */}
            <div className="space-y-1.5">
              <span className="text-[9.5px] uppercase font-bold text-[#728a99] block">
                Historial de Recetas Farmacológicas
              </span>
              {recetasFarmacos.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#728a99] italic">
                  No hay recetas de medicamentos emitidas.
                </div>
              ) : (
                recetasFarmacos.map(r => (
                  <div key={r.id} className="p-2 rounded-lg border border-[#dde6ec] bg-white flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-[#16323f]">
                        {r.fecha ? r.fecha.slice(0, 10) : 'Sin fecha'} · {r.items?.length || 0} fármaco(s)
                      </div>
                      <div className="text-[10.5px] text-[#728a99] truncate max-w-[220px]">
                        {r.items?.map(i => i.farmaco || i.med).join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onImprimirRecetaFarmacos(r)}
                        className="p-1 text-[#0e7c86] hover:bg-[#e4f3f4] rounded"
                        title="Imprimir receta"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('¿Eliminar esta receta?')) onDeleteRecetaFarmacos(r.id)
                        }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Eliminar receta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PEDIDOS DE ESTUDIOS */}
        {activeDrawerTab === 'pedidos' && (
          <div className="space-y-3">
            <div className="bg-[#f8fafc] border border-[#dde6ec] rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] uppercase font-black text-[#0e7c86] tracking-wider">
                  Solicitar Estudios
                </span>
                <select
                  value={ojoPedido}
                  onChange={e => setOjoPedido(e.target.value as any)}
                  className="border border-[#dde6ec] rounded px-1.5 py-0.5 text-xs bg-white font-bold"
                >
                  <option>AO</option>
                  <option>OD</option>
                  <option>OI</option>
                </select>
              </div>

              {/* Chips rápidos de estudios comunes */}
              <div className="grid grid-cols-2 gap-1">
                {[
                  'OCT Macular y Papilar',
                  'Campo Visual Computarizado',
                  'Topografía Corneal (Pentacam)',
                  'Paquimetría Corneal',
                  'Biometría (IOL Master)',
                  'Recuento Endotelial',
                  'Retinografía Color',
                  'Ecografía Modo B'
                ].map(est => {
                  const isChecked = estudiosSeleccionados.includes(est)
                  return (
                    <button
                      key={est}
                      type="button"
                      onClick={() => handleToggleEstudio(est)}
                      className={`p-1.5 rounded border text-left text-[11px] font-semibold transition-all ${
                        isChecked
                          ? 'border-[#0e7c86] bg-[#e4f3f4] text-[#0e7c86] font-bold'
                          : 'border-[#dde6ec] bg-white hover:border-[#b3c7d1]'
                      }`}
                    >
                      {est}
                    </button>
                  )
                })}
              </div>

              {estudiosSeleccionados.length > 0 && (
                <button
                  type="button"
                  disabled={guardandoPedido}
                  onClick={handleGuardarPedido}
                  className="w-full mt-2 py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white font-bold rounded text-xs transition-colors shadow-xs"
                >
                  {guardandoPedido ? 'Guardando...' : `Generar Pedido (${estudiosSeleccionados.length})`}
                </button>
              )}
            </div>

            {/* Historial de pedidos */}
            <div className="space-y-1.5">
              <span className="text-[9.5px] uppercase font-bold text-[#728a99] block">
                Pedidos de Estudios Registrados
              </span>
              {pedidosEstudios.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#728a99] italic">
                  No hay pedidos de estudios registrados.
                </div>
              ) : (
                pedidosEstudios.map(p => (
                  <div key={p.id} className="p-2 rounded-lg border border-[#dde6ec] bg-white flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-[#16323f]">
                        {p.titulo} ({p.ojo || 'AO'})
                      </div>
                      <div className="text-[10px] text-[#728a99]">
                        {p.fecha ? p.fecha.slice(0, 10) : 'Sin fecha'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onImprimirPedidoEstudios(p)}
                        className="p-1 text-[#0e7c86] hover:bg-[#e4f3f4] rounded"
                        title="Imprimir orden"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('¿Eliminar este pedido de estudio?')) onDeletePedidoEstudios(p.id)
                        }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Eliminar pedido"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ESTUDIOS REALIZADOS / VISOR */}
        {activeDrawerTab === 'estudios' && (
          <div className="space-y-3">
            <span className="text-[9.5px] uppercase font-black text-[#0e7c86] tracking-wider block">
              Estudios Informados del Paciente
            </span>

            {estudios.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#728a99] italic">
                No hay estudios cargados para este paciente.
              </div>
            ) : (
              estudios.map(est => (
                <div key={est.id} className="p-2.5 rounded-lg border border-[#dde6ec] bg-white space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-[#16323f]">
                      {est.tipo_estudio || est.tipo}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
                      {est.ojo || 'AO'}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#728a99]">
                    Fecha: {est.fecha ? est.fecha.slice(0, 10) : 'Sin fecha'}
                  </div>

                  {est.informe && (
                    <p className="text-xs text-[#16323f] bg-[#f8fafc] p-2 rounded border border-[#eef3f6] whitespace-pre-wrap">
                      {est.informe}
                    </p>
                  )}

                  {est.archivo_url && (
                    <div className="pt-1">
                      <a
                        href={est.archivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0e7c86] hover:underline bg-[#e4f3f4] px-2 py-1 rounded"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Ver informe adjunto
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
