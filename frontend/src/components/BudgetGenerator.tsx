'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Plus,
  Trash2,
  FileText,
  Download,
  CheckCircle,
  RefreshCw,
  Loader2,
  Search,
  DollarSign,
  X,
  AlertCircle,
  CheckSquare,
  Square
} from 'lucide-react'

interface Paciente {
  id: string
  nombre: string
  telefono: string
  obra_social?: string | null
  dni?: string | null
}

interface SearchResultPractice {
  id: string
  codigo: string
  nombre: string
  categoria: string
  nomenclador_id: string
  nomenclador_nombre: string
  nomenclador_codigo: string
  precio: number
  moneda: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  tiene_precio: boolean
}

interface BudgetItem {
  id: string
  codigo: string
  nombre: string
  cantidad: number
  precio_unitario: number
  moneda: 'ARS' | 'USD'
  subtotal: number
}

interface ModalSelectedMap {
  [practiceId: string]: {
    practice: SearchResultPractice
    cantidad: number
    precio_unitario: number
  }
}
import { BACKEND_URL as API_BASE_URL } from '@/lib/api'
import ModalEnviarPresupuestoWhatsApp from '@/components/ModalEnviarPresupuestoWhatsApp'
import { Send } from 'lucide-react'

export default function BudgetGenerator() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [selectedPacienteId, setSelectedPacienteId] = useState('')

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResultPractice[]>([])
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [modalFilterMoneda, setModalFilterMoneda] = useState<'todas' | 'ARS' | 'USD'>('todas')
  const [modalSelected, setModalSelected] = useState<ModalSelectedMap>({})

  // Lista de Ítems del presupuesto
  const [items, setItems] = useState<BudgetItem[]>([])
  const [creando, setCreando] = useState(false)
  const [presupuestoCreado, setPresupuestoCreado] = useState<any | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)

  // Cargar Pacientes
  const loadPacientes = async () => {
    try {
      const { data: pacs } = await supabase.from('pacientes').select('*').order('nombre')
      if (pacs) setPacientes(pacs as unknown as Paciente[])
    } catch (error) {
      console.error('Error cargando pacientes:', error)
    }
  }

  useEffect(() => {
    loadPacientes()
  }, [])

  // Disparar búsqueda explícita en catálogo
  const handleTriggerSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = searchQuery.trim()
    if (!query) {
      setMensaje({ tipo: 'error', texto: 'Ingresa un código o nombre de práctica para buscar.' })
      return
    }

    try {
      setSearching(true)
      setMensaje(null)
      setModalSelected({})
      setModalFilterMoneda('todas')

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/buscar-presupuesto?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        const results: SearchResultPractice[] = data.resultados || []
        setSearchResults(results)
        setIsSearchModalOpen(true)
      } else {
        setMensaje({ tipo: 'error', texto: 'No se pudo consultar el catálogo de prácticas.' })
      }
    } catch (err) {
      console.error('Error al buscar prácticas:', err)
      setMensaje({ tipo: 'error', texto: 'Error al conectar con el servidor para buscar prácticas.' })
    } finally {
      setSearching(false)
    }
  }

  // Selección/deselección de práctica en el modal
  const handleToggleModalSelection = (practice: SearchResultPractice) => {
    const updated = { ...modalSelected }
    if (updated[practice.id]) {
      delete updated[practice.id]
    } else {
      updated[practice.id] = {
        practice,
        cantidad: 1,
        precio_unitario: practice.precio || 0
      }
    }
    setModalSelected(updated)
  }

  // Modificar cantidad en el modal
  const handleUpdateModalQuantity = (practiceId: string, qty: number) => {
    if (!modalSelected[practiceId]) return
    const updated = { ...modalSelected }
    updated[practiceId].cantidad = Math.max(1, qty)
    setModalSelected(updated)
  }

  // Modificar precio unitario en el modal
  const handleUpdateModalPrice = (practiceId: string, price: number) => {
    if (!modalSelected[practiceId]) return
    const updated = { ...modalSelected }
    updated[practiceId].precio_unitario = Math.max(0, price)
    setModalSelected(updated)
  }

  // Filtrar resultados visibles en el modal únicamente por Moneda (ARS / USD)
  const filteredResults = searchResults.filter((item) => {
    if (modalFilterMoneda !== 'todas' && item.moneda !== modalFilterMoneda) return false
    return true
  })

  const areAllFilteredSelected = filteredResults.length > 0 && filteredResults.every((item) => !!modalSelected[item.id])

  const handleToggleSelectAll = () => {
    const updated = { ...modalSelected }
    if (areAllFilteredSelected) {
      filteredResults.forEach((item) => {
        delete updated[item.id]
      })
    } else {
      filteredResults.forEach((item) => {
        if (!updated[item.id]) {
          updated[item.id] = {
            practice: item,
            cantidad: 1,
            precio_unitario: item.precio || 0
          }
        }
      })
    }
    setModalSelected(updated)
  }

  // Confirmar y agregar al presupuesto en lote
  const handleAddSelectedToBudget = () => {
    const selectedEntries = Object.values(modalSelected)
    if (selectedEntries.length === 0) return

    const updatedItems = [...items]

    selectedEntries.forEach(({ practice, cantidad, precio_unitario }) => {
      const existIdx = updatedItems.findIndex((it) => it.codigo === practice.codigo && it.moneda === practice.moneda)
      if (existIdx > -1) {
        updatedItems[existIdx].cantidad += cantidad
        updatedItems[existIdx].subtotal = updatedItems[existIdx].cantidad * updatedItems[existIdx].precio_unitario
      } else {
        updatedItems.push({
          id: practice.id,
          codigo: practice.codigo,
          nombre: practice.nombre,
          cantidad,
          precio_unitario,
          moneda: practice.moneda,
          subtotal: cantidad * precio_unitario
        })
      }
    })

    setItems(updatedItems)
    setIsSearchModalOpen(false)
    setModalSelected({})
    setSearchQuery('')
    setMensaje({ tipo: 'success', texto: `Se agregaron ${selectedEntries.length} prestación(es) al presupuesto.` })
  }

  // Quitar ítem de la tabla principal
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // Actualizar cantidad en la tabla principal
  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return
    const updated = [...items]
    updated[index].cantidad = newQty
    updated[index].subtotal = newQty * updated[index].precio_unitario
    setItems(updated)
  }

  // Actualizar precio unitario en la tabla principal
  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    const updated = [...items]
    updated[index].precio_unitario = Math.max(0, newPrice)
    updated[index].subtotal = updated[index].cantidad * updated[index].precio_unitario
    setItems(updated)
  }

  // Totales por Moneda
  const totalARS = items.filter((it) => it.moneda === 'ARS').reduce((acc, it) => acc + it.subtotal, 0)
  const totalUSD = items.filter((it) => it.moneda === 'USD').reduce((acc, it) => acc + it.subtotal, 0)

  // Enviar a la API del Backend para generar presupuesto y PDF
  const handleSaveBudget = async () => {
    if (!selectedPacienteId) {
      setMensaje({ tipo: 'error', texto: 'Por favor selecciona un paciente destinatario.' })
      return
    }
    if (items.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Agrega al menos una prestación médica al presupuesto.' })
      return
    }

    setCreando(true)
    setMensaje(null)
    setPresupuestoCreado(null)

    const payload = {
      paciente_id: selectedPacienteId,
      items: items.map((it) => ({
        codigo_servicio: it.codigo,
        nombre_prestacion: it.nombre,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        moneda: it.moneda
      }))
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/presupuestos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setPresupuestoCreado(data.presupuesto)
        setItems([])
        setSelectedPacienteId('')
        setMensaje({ tipo: 'success', texto: '¡Presupuesto médico y documento PDF generados exitosamente!' })
      } else {
        setMensaje({ tipo: 'error', texto: data.error || 'No se pudo generar el presupuesto.' })
      }
    } catch (error) {
      console.error('Error al generar presupuesto:', error)
      setMensaje({ tipo: 'error', texto: 'No se pudo conectar con el servidor de presupuestos.' })
    } finally {
      setCreando(false)
    }
  }

  const countSelected = Object.keys(modalSelected).length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full p-2 md:p-4">
      {/* Columna Izquierda: Formulario Principal y Buscador */}
      <div className="lg:col-span-2 space-y-6">
        {/* Cabecera del Paciente */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-md font-bold flex items-center gap-2">
              <FileText className="text-blue-600" size={20} />
              Emisión de Presupuesto Médico
            </h2>
            <button
              onClick={loadPacientes}
              className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 transition"
            >
              <RefreshCw size={13} /> Actualizar Pacientes
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Paciente Destinatario
            </label>
            <select
              value={selectedPacienteId}
              onChange={(e) => setSelectedPacienteId(e.target.value)}
              className="w-full text-xs p-3 border border-[var(--border)] rounded-xl bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">-- Seleccionar Paciente Registrado --</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.dni ? `• DNI ${p.dni}` : ''} ({p.telefono}) {p.obra_social ? `• ${p.obra_social}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sección de Búsqueda de Prácticas */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Search size={14} className="text-blue-600" />
              Búsqueda de Prestaciones y Prácticas
            </h3>
            <span className="text-[11px] text-slate-400">Precios en Pesos ($ ARS) y Dólares (USD)</span>
          </div>

          <form onSubmit={handleTriggerSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escribe el código o nombre de la práctica (ej: 420101, Consulta, Ecografía, FIV)..."
                className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={searching}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shrink-0 disabled:opacity-50"
            >
              {searching ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Buscar Prácticas
                </>
              )}
            </button>
          </form>

          {mensaje && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                mensaje.tipo === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'
              }`}
            >
              <AlertCircle size={15} className="shrink-0" />
              {mensaje.texto}
            </div>
          )}
        </div>

        {/* Tabla de Prestaciones Incluidas */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Prestaciones en Presupuesto ({items.length})
            </h3>
            {items.length > 0 && (
              <button
                onClick={() => setItems([])}
                className="text-[11px] text-red-500 hover:underline font-semibold"
              >
                Limpiar lista
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs border border-dashed border-[var(--border)] rounded-xl space-y-2">
              <Search size={24} className="mx-auto text-slate-300 dark:text-slate-700" />
              <p>No has agregado ninguna prestación al presupuesto.</p>
              <p className="text-[11px] text-slate-500">Ingresa un código o término arriba y haz clic en &quot;Buscar Prácticas&quot; para abrir el catálogo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3 text-center">Moneda</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3 text-right">P. Unitario</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((item, idx) => {
                    const isUSD = item.moneda === 'USD'
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600">{item.codigo}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{item.nombre}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              isUSD
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {item.moneda}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => handleUpdateItemQuantity(idx, parseInt(e.target.value) || 1)}
                            className="w-14 text-center text-xs p-1 rounded border border-[var(--border)] bg-[var(--background)] font-mono"
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="relative inline-block w-32">
                            <span className="absolute left-1.5 top-1 text-slate-400 text-[11px] font-bold">
                              {isUSD ? 'USD' : '$'}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.precio_unitario}
                              onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                              className="w-full text-right text-xs pl-8 pr-1.5 py-1 rounded border border-[var(--border)] bg-[var(--background)] font-mono font-bold text-emerald-600"
                            />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {isUSD ? 'USD ' : '$ '}
                          {item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Totales por Moneda y Emisión */}
      <div className="space-y-6">
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-6 sticky top-6">
          <h3 className="text-md font-bold text-slate-900 dark:text-slate-100 border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={18} />
            Resumen del Presupuesto
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Cantidad de Prestaciones:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{items.reduce((a, b) => a + b.cantidad, 0)}</span>
            </div>

            {/* Total ARS */}
            {totalARS > 0 && (
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                  🇦🇷 Total en Pesos ($ ARS)
                </div>
                <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-200 font-mono">
                  ${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {/* Total USD */}
            {totalUSD > 0 && (
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
                <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                  🇺🇸 Total en Dólares (USD)
                </div>
                <div className="text-lg font-extrabold text-amber-700 dark:text-amber-200 font-mono">
                  USD {totalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {totalARS === 0 && totalUSD === 0 && (
              <div className="text-slate-400 italic text-center py-2">
                Agrega prestaciones para calcular el total.
              </div>
            )}
          </div>

          <button
            onClick={handleSaveBudget}
            disabled={creando || items.length === 0 || !selectedPacienteId}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generando Presupuesto y PDF...
              </>
            ) : (
              <>
                <FileText size={16} />
                Emitir Presupuesto y Crear PDF
              </>
            )}
          </button>

          {presupuestoCreado && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3 animate-scale-in">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <CheckCircle size={16} className="text-emerald-600" />
                ¡Presupuesto Emitido con Éxito!
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(true)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Send size={13} />
                  Enviar por WhatsApp
                </button>

                {presupuestoCreado.pdf_url && (
                  <a
                    href={`${API_BASE_URL}${presupuestoCreado.pdf_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-[var(--border)] text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Download size={13} />
                    Ver PDF
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* POP-UP MODAL: RESULTADOS DE BÚSQUEDA & SELECCIÓN MÚLTIPLE */}
      {/* ==================================================================== */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] flex flex-col">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Search className="text-blue-600" size={18} />
                  Catálogo de Prácticas
                </h3>
                <p className="text-xs text-[var(--secondary)] mt-0.5">
                  Búsqueda para: <span className="font-mono font-bold text-blue-600">&quot;{searchQuery}&quot;</span> • {searchResults.length} coincidencia(s) encontrada(s)
                </p>
              </div>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filtro Simple por Moneda (ARS / USD) */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setModalFilterMoneda('todas')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    modalFilterMoneda === 'todas'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Todas las Monedas ({searchResults.length})
                </button>
                <button
                  onClick={() => setModalFilterMoneda('ARS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    modalFilterMoneda === 'ARS'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  🇦🇷 Pesos ($ ARS) ({searchResults.filter((r) => r.moneda === 'ARS').length})
                </button>
                <button
                  onClick={() => setModalFilterMoneda('USD')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    modalFilterMoneda === 'USD'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  🇺🇸 Dólares (USD) ({searchResults.filter((r) => r.moneda === 'USD').length})
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition flex items-center gap-1.5"
                >
                  {areAllFilteredSelected ? (
                    <>
                      <CheckSquare size={14} /> Deseleccionar todas
                    </>
                  ) : (
                    <>
                      <Square size={14} /> Seleccionar todas
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Listado de Prácticas con Checkboxes */}
            <div className="flex-1 overflow-y-auto border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-slate-50/50 dark:bg-slate-900/30">
              {filteredResults.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No se encontraron prácticas con los filtros seleccionados.
                </div>
              ) : (
                filteredResults.map((item) => {
                  const isSelected = !!modalSelected[item.id]
                  const selectedData = modalSelected[item.id]
                  const isUSD = item.moneda === 'USD'

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-600'
                          : 'hover:bg-white dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleModalSelection(item)}
                          className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded text-[11px] font-bold">
                              {item.codigo}
                            </span>
                            <span>{item.nombre}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {item.categoria}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                                isUSD
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {item.moneda}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Configuración de Cantidad y Precio de la Fila */}
                      <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-bold text-slate-500">Cant:</span>
                              <input
                                type="number"
                                min="1"
                                value={selectedData?.cantidad || 1}
                                onChange={(e) => handleUpdateModalQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="w-14 text-center text-xs p-1 rounded border border-[var(--border)] bg-[var(--background)] font-mono font-bold"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-bold text-slate-500">Precio:</span>
                              <div className="relative w-28">
                                <span className="absolute left-1.5 top-1 text-slate-400 text-[10px] font-bold">
                                  {isUSD ? 'USD' : '$'}
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={selectedData?.precio_unitario ?? (item.precio || 0)}
                                  onChange={(e) => handleUpdateModalPrice(item.id, parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs pl-7 pr-1.5 py-1 rounded border border-[var(--border)] bg-[var(--background)] font-mono font-bold text-emerald-600"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {!isSelected && (item.precio > 0 ? (
                          <span
                            className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg border ${
                              isUSD
                                ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
                                : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {isUSD ? 'USD ' : '$ '}
                            {item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            Sin arancel cargado
                          </span>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleToggleModalSelection(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Seleccionada' : 'Seleccionar'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer del Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border)] pt-3 shrink-0">
              <div className="text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {countSelected} prestación(es) seleccionada(s)
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsSearchModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleAddSelectedToBudget}
                  disabled={countSelected === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={15} />
                  Agregar {countSelected > 0 ? `(${countSelected})` : ''} al Presupuesto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Envío por WhatsApp */}
      {presupuestoCreado && (
        <ModalEnviarPresupuestoWhatsApp
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          presupuestoId={presupuestoCreado.id}
          pacienteNombre={pacientes.find((p) => p.id === selectedPacienteId)?.nombre}
          telefonoDefault={pacientes.find((p) => p.id === selectedPacienteId)?.telefono}
          pdfUrl={presupuestoCreado.pdf_url}
          totalArs={totalARS}
          totalUsd={totalUSD}
          onSuccess={() => {
            setMensaje({ tipo: 'success', texto: '¡Presupuesto y PDF enviados por WhatsApp exitosamente!' })
          }}
        />
      )}
    </div>
  )
}
