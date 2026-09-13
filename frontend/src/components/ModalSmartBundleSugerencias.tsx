'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Sparkles,
  CheckSquare,
  Square,
  AlertCircle,
  Plus,
  Package,
  Layers,
  HeartPulse,
  Activity,
  ShieldCheck,
  Check
} from 'lucide-react'

export interface RelacionPracticaPresupuesto {
  id: string // UUID de la práctica relacionada
  relacion_id?: string
  codigo: string
  nombre: string
  categoria?: string
  tipo_relacion: 'anestesia' | 'quirofano' | 'insumo' | 'estudio' | 'honorario' | 'general'
  es_obligatoria: boolean
  cantidad_default: number
  notas?: string
  precio: number
  moneda: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  tiene_precio: boolean
}

export interface ItemSeleccionadoBundle {
  id: string
  codigo: string
  nombre: string
  cantidad: number
  precio_unitario: number
  moneda: 'ARS' | 'USD'
}

interface ModalSmartBundleSugerenciasProps {
  isOpen: boolean
  onClose: () => void
  practicaPrincipal: {
    codigo?: string
    nombre: string
  }
  relaciones: RelacionPracticaPresupuesto[]
  onConfirmar: (seleccionadas: ItemSeleccionadoBundle[]) => void
}

export default function ModalSmartBundleSugerencias({
  isOpen,
  onClose,
  practicaPrincipal,
  relaciones,
  onConfirmar
}: ModalSmartBundleSugerenciasProps) {
  // Estado de selección por ID: { [id]: { seleccionada: boolean, cantidad: number, precio: number } }
  const [itemsConfig, setItemsConfig] = useState<Record<string, { seleccionada: boolean; cantidad: number; precio: number }>>({})

  // Inicializar selecciones al abrir o cambiar las relaciones
  useEffect(() => {
    if (isOpen && relaciones.length > 0) {
      const init: Record<string, { seleccionada: boolean; cantidad: number; precio: number }> = {}
      relaciones.forEach((r) => {
        // Por defecto, pre-seleccionamos obligatorias
        init[r.id] = {
          seleccionada: r.es_obligatoria !== false,
          cantidad: r.cantidad_default || 1,
          precio: Number(r.precio) || 0
        }
      })
      setItemsConfig(init)
    }
  }, [isOpen, relaciones])

  if (!isOpen || relaciones.length === 0) return null

  // Alternar selección
  const toggleSeleccion = (id: string) => {
    setItemsConfig((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        seleccionada: !prev[id]?.seleccionada
      }
    }))
  }

  // Modificar cantidad
  const handleCantidadChange = (id: string, cant: number) => {
    setItemsConfig((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        cantidad: Math.max(1, cant)
      }
    }))
  }

  // Toggle seleccionar todo / deseleccionar todo
  const seleccionadasCount = relaciones.filter((r) => itemsConfig[r.id]?.seleccionada).length
  const todosSeleccionados = seleccionadasCount === relaciones.length

  const handleToggleTodos = () => {
    const nuevoEstado = !todosSeleccionados
    const update: Record<string, { seleccionada: boolean; cantidad: number; precio: number }> = {}
    relaciones.forEach((r) => {
      update[r.id] = {
        ...itemsConfig[r.id],
        seleccionada: nuevoEstado
      }
    })
    setItemsConfig(update)
  }

  // Totales estimados del bundle a agregar
  const totalARS = relaciones
    .filter((r) => itemsConfig[r.id]?.seleccionada && r.moneda === 'ARS')
    .reduce((acc, r) => acc + (itemsConfig[r.id].precio * itemsConfig[r.id].cantidad), 0)

  const totalUSD = relaciones
    .filter((r) => itemsConfig[r.id]?.seleccionada && r.moneda === 'USD')
    .reduce((acc, r) => acc + (itemsConfig[r.id].precio * itemsConfig[r.id].cantidad), 0)

  // Confirmar y emitir elementos seleccionados
  const handleConfirmar = () => {
    const seleccionadas: ItemSeleccionadoBundle[] = []
    relaciones.forEach((r) => {
      const cfg = itemsConfig[r.id]
      if (cfg && cfg.seleccionada) {
        seleccionadas.push({
          id: r.id,
          codigo: r.codigo,
          nombre: r.nombre,
          cantidad: cfg.cantidad,
          precio_unitario: cfg.precio,
          moneda: r.moneda || 'ARS'
        })
      }
    })
    onConfirmar(seleccionadas)
    onClose()
  }

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'anestesia':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1">
            <HeartPulse size={11} className="text-purple-400" />
            Anestesia
          </span>
        )
      case 'quirofano':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/50 flex items-center gap-1">
            <Activity size={11} className="text-amber-400" />
            Quirófano / Sala
          </span>
        )
      case 'insumo':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 flex items-center gap-1">
            <Package size={11} className="text-cyan-400" />
            Insumo / LIO
          </span>
        )
      case 'estudio':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1">
            <ShieldCheck size={11} className="text-emerald-400" />
            Estudio Previo
          </span>
        )
      case 'honorario':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-950/80 text-pink-300 border border-pink-800/50 flex items-center gap-1">
            <Sparkles size={11} className="text-pink-400" />
            Honorarios
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-800 text-gray-300 border border-neutral-700 flex items-center gap-1">
            <Layers size={11} className="text-gray-400" />
            Conexo
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-indigo-500/40 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header con gradiente distintivo Smart Bundle */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-950/90 via-neutral-900 to-purple-950/80 border-b border-[var(--border)] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Prácticas y Costos Conexos Vinculados
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Smart Bundle
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                Para: <strong className="text-white">{practicaPrincipal.nombre}</strong> {practicaPrincipal.codigo && <span className="font-mono text-indigo-300 font-semibold">({practicaPrincipal.codigo})</span>}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner Explicativo */}
        <div className="px-5 py-3 bg-indigo-950/40 border-b border-indigo-500/20 text-xs text-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-indigo-400 shrink-0" />
            <span>
              El nomenclador configuró <strong>{relaciones.length}</strong> prácticas vinculadas recomendadas para este procedimiento.
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleTodos}
            className="text-[11px] font-bold text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors underline decoration-indigo-400/50"
          >
            {todosSeleccionados ? 'Deseleccionar todas' : 'Seleccionar todas'}
          </button>
        </div>

        {/* Lista de Prácticas Relacionadas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {relaciones.map((rel) => {
            const isChecked = !!itemsConfig[rel.id]?.seleccionada
            const cant = itemsConfig[rel.id]?.cantidad || 1
            const precio = itemsConfig[rel.id]?.precio || 0

            return (
              <div
                key={rel.id}
                onClick={() => toggleSeleccion(rel.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                  isChecked
                    ? 'bg-indigo-950/30 border-indigo-500/60 shadow-md shadow-indigo-950/30'
                    : 'bg-neutral-950/40 border-[var(--border)] hover:border-neutral-700 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="p-1 text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSeleccion(rel.id)
                    }}
                  >
                    {isChecked ? (
                      <CheckSquare size={18} className="text-indigo-400" />
                    ) : (
                      <Square size={18} className="text-gray-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs text-white truncate">
                        {rel.nombre}
                      </span>
                      {getTipoBadge(rel.tipo_relacion)}
                      {rel.es_obligatoria ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-red-950/80 text-red-300 border border-red-800/40">
                          Obligatoria
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-800 text-gray-400">
                          Opcional
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 font-mono">
                      <span>Cód: {rel.codigo}</span>
                      {rel.categoria && <span>• {rel.categoria}</span>}
                      {rel.notas && <span className="text-indigo-300 italic font-sans truncate">• {rel.notas}</span>}
                    </div>
                  </div>
                </div>

                {/* Cantidad y Arancel */}
                <div className="flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Selector de Cantidad */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Cant:</span>
                    <input
                      type="number"
                      min="1"
                      value={cant}
                      onChange={(e) => handleCantidadChange(rel.id, parseInt(e.target.value) || 1)}
                      className="w-12 px-1.5 py-1 text-xs text-center font-mono font-bold bg-neutral-900 border border-[var(--border)] focus:border-indigo-500 rounded-lg text-white"
                    />
                  </div>

                  {/* Arancel vigente */}
                  <div className="text-right min-w-[100px]">
                    {rel.tiene_precio ? (
                      <div>
                        <span className={`text-xs font-mono font-black ${rel.moneda === 'USD' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {rel.moneda === 'USD' ? 'USD ' : '$ '}
                          {(precio * cant).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        {cant > 1 && (
                          <div className="text-[10px] text-gray-500 font-mono">
                            {rel.moneda === 'USD' ? 'USD ' : '$ '}
                            {precio.toLocaleString('es-AR')} c/u
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-500 italic">Arancel a definir</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer con Resumen y Acciones */}
        <div className="p-4 bg-neutral-950 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Resumen de Seleccionadas y Total Estimado */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs text-gray-300 font-medium">
              <strong className="text-white font-bold">{seleccionadasCount}</strong> de {relaciones.length} seleccionada(s)
            </span>

            {(totalARS > 0 || totalUSD > 0) && (
              <div className="flex items-center gap-2 pl-3 border-l border-neutral-800">
                <span className="text-[11px] text-gray-400 uppercase font-bold">Adicional:</span>
                {totalARS > 0 && (
                  <span className="text-xs font-mono font-black text-emerald-400">
                    +${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                )}
                {totalUSD > 0 && (
                  <span className="text-xs font-mono font-black text-amber-400">
                    +USD {totalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-[var(--border)] rounded-xl text-gray-400 hover:text-white hover:bg-neutral-800 text-xs font-bold transition-all"
            >
              Omitir adicionales
            </button>

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={seleccionadasCount === 0}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <Sparkles size={13} className="text-indigo-200" />
              <span>
                Agregar seleccionadas (+{seleccionadasCount})
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
