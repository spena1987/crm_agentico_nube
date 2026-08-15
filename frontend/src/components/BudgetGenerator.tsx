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
  Sparkles,
  DollarSign,
  Building2,
  Check,
  X,
  AlertCircle,
  Layers,
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
  origen: 'crm_propio' | 'geclisa'
  origen_label: string
  codigo: string
  nombre: string
  categoria: string
  nom_id?: number | null
  nom_cod?: string
  tipo_nomenclador: string
  precio_sugerido: number
  origen_precio: 'crm_propio' | 'crm_override' | 'geclisa_particular' | 'sin_precio'
  override_activo: boolean
}

interface BudgetItem {
  id: string
  origen: 'crm_propio' | 'geclisa'
  codigo: string
  nombre: string
  tipo_nomenclador: string
  nom_id?: number | null
  nom_cod?: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  origen_precio: string
}

interface ModalSelectedMap {
  [practiceId: string]: {
    practice: SearchResultPractice
    cantidad: number
    precio_unitario: number
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function BudgetGenerator() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [selectedPacienteId, setSelectedPacienteId] = useState('')

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResultPractice[]>([])
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [modalFilter, setModalFilter] = useState<'todos' | 'creo' | 'nacional' | 'crm'>('todos')
  const [modalSelected, setModalSelected] = useState<ModalSelectedMap>({})

  // Lista de Ítems del presupuesto
  const [items, setItems] = useState<BudgetItem[]>([])
  const [creando, setCreando] = useState(false)
  const [presupuestoCreado, setPresupuestoCreado] = useState<any | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

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

  // Disparar búsqueda explícita
  const handleTriggerSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = searchQuery.trim()
    if (!query) {
      setMensaje({ tipo: 'error', texto: 'Por favor ingresa un término de búsqueda (ej. ICSI, 420101, Consulta, Ecografía).' })
      return
    }

    try {
      setSearching(true)
      setMensaje(null)
      setModalSelected({})
      setModalFilter('todos')

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/buscar-unificado?q=${encodeURIComponent(query)}`)
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

  // Manejar selección/deselección de una práctica en el modal
  const handleToggleModalSelection = (practice: SearchResultPractice) => {
    const updated = { ...modalSelected }
    if (updated[practice.id]) {
      delete updated[practice.id]
    } else {
      updated[practice.id] = {
        practice,
        cantidad: 1,
        precio_unitario: practice.precio_sugerido || 0
      }
    }
    setModalSelected(updated)
  }

  // Modificar cantidad de una práctica seleccionada en el modal
  const handleUpdateModalQuantity = (practiceId: string, qty: number) => {
    if (!modalSelected[practiceId]) return
    const updated = { ...modalSelected }
    updated[practiceId].cantidad = Math.max(1, qty)
    setModalSelected(updated)
  }

  // Modificar precio unitario en el modal si se desea
  const handleUpdateModalPrice = (practiceId: string, price: number) => {
    if (!modalSelected[practiceId]) return
    const updated = { ...modalSelected }
    updated[practiceId].precio_unitario = Math.max(0, price)
    setModalSelected(updated)
  }

  // Seleccionar todas / deseleccionar todas las visibles
  const filteredResults = searchResults.filter((item) => {
    if (modalFilter === 'creo') return item.nom_id === 6
    if (modalFilter === 'nacional') return item.nom_id === 1 || item.nom_id === 2 || item.nom_id === 5
    if (modalFilter === 'crm') return item.origen === 'crm_propio'
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
            precio_unitario: item.precio_sugerido || 0
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
      const existIdx = updatedItems.findIndex((it) => it.codigo === practice.codigo)
      if (existIdx > -1) {
        // Incrementar cantidad
        updatedItems[existIdx].cantidad += cantidad
        updatedItems[existIdx].subtotal = updatedItems[existIdx].cantidad * updatedItems[existIdx].precio_unitario
      } else {
        // Agregar nuevo ítem
        updatedItems.push({
          id: practice.id,
          origen: practice.origen,
          codigo: practice.codigo,
          nombre: practice.nombre,
          tipo_nomenclador: practice.tipo_nomenclador,
          nom_id: practice.nom_id,
          nom_cod: practice.nom_cod,
          cantidad,
          precio_unitario,
          subtotal: cantidad * precio_unitario,
          origen_precio: practice.origen_precio
        })
      }
    })

    setItems(updatedItems)
    setIsSearchModalOpen(false)
    setModalSelected({})
    setSearchQuery('')
    setMensaje({ tipo: 'success', texto: `Se agregaron ${selectedEntries.length} práctica(s) al presupuesto.` })
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

  // Total
  const total = items.reduce((acc, it) => acc + it.subtotal, 0)

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
        precio_unitario: it.precio_unitario
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

  // Insignia de procedencia de tarifa
  const renderOriginBadge = (origenPrecio: string) => {
    switch (origenPrecio) {
      case 'crm_propio':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
            <Sparkles size={10} /> CRM Propio
          </span>
        )
      case 'crm_override':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
            <DollarSign size={10} /> Precio CRM Override
          </span>
        )
      case 'geclisa_particular':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
            <Building2 size={10} /> Geclisa Particular
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
            Manual
          </span>
        )
    }
  }

  const countSelected = Object.keys(modalSelected).length
  const modalSubtotal = Object.values(modalSelected).reduce((acc, curr) => acc + curr.cantidad * curr.precio_unitario, 0)

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

        {/* Sección de Búsqueda con Botón Explícito */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Search size={14} className="text-blue-600" />
              Búsqueda en Nomenclador de Geclisa & Catálogo Propio
            </h3>
            <span className="text-[11px] text-slate-400">Aranceles Particulares en ARS</span>
          </div>

          {/* Formulario de Búsqueda */}
          <form onSubmit={handleTriggerSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escribe el código o nombre de la práctica (ej: ICSI, 420101, Consulta, Ecografía)..."
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

          {/* Mensajes de Feedback */}
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

        {/* Tabla de Prestaciones Incluidas en el Presupuesto */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Prestaciones Incluidas ({items.length})
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
              <p className="text-[11px] text-slate-500">Ingresa un término arriba y haz clic en &quot;Buscar Prácticas&quot; para seleccionar del pop-up.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3">Origen Tarifa</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3 text-right">P. Unitario</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">{item.codigo}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{item.nombre}</div>
                        <div className="text-[11px] text-slate-400">{item.tipo_nomenclador}</div>
                      </td>
                      <td className="py-3 px-3">{renderOriginBadge(item.origen_precio)}</td>
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
                        <div className="relative inline-block w-28">
                          <span className="absolute left-1.5 top-1 text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-full text-right text-xs pl-4 pr-1.5 py-1 rounded border border-[var(--border)] bg-[var(--background)] font-mono font-semibold"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Resumen de Cotización & Generación de PDF */}
      <div className="space-y-6">
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-6 sticky top-6">
          <h3 className="text-md font-bold text-slate-900 dark:text-slate-100 border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={18} />
            Resumen del Presupuesto
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Cantidad de Prácticas:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{items.reduce((a, b) => a + b.cantidad, 0)}</span>
            </div>

            <div className="flex justify-between text-slate-500">
              <span>Aranceles Gravados / Honorarios:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between text-slate-500">
              <span>Moneda de Cotización:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">Pesos Argentinos (ARS)</span>
            </div>

            <div className="border-t border-[var(--border)] pt-3 flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Total Cotizado:</span>
              <span className="text-xl font-extrabold text-emerald-600 font-mono">
                ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
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

          {/* Presupuesto Creado & Descarga Directa */}
          {presupuestoCreado && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3 animate-scale-in">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <CheckCircle size={16} className="text-emerald-600" />
                ¡Presupuesto Emitido con Éxito!
              </div>

              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Total: <span className="font-bold">${presupuestoCreado.total?.toLocaleString('es-AR')}</span>
              </div>

              {presupuestoCreado.pdf_url && (
                <a
                  href={`${API_BASE_URL}${presupuestoCreado.pdf_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-white dark:bg-slate-800 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Download size={14} />
                  Descargar Documento PDF
                </a>
              )}
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
                  Resultados de Búsqueda de Prácticas
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

            {/* Filtros por Categoría / Nomenclador dentro del Modal */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => setModalFilter('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  modalFilter === 'todos'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Todas ({searchResults.length})
              </button>
              <button
                onClick={() => setModalFilter('creo')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  modalFilter === 'creo'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Nomenclador Creo ({searchResults.filter((r) => r.nom_id === 6).length})
              </button>
              <button
                onClick={() => setModalFilter('nacional')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  modalFilter === 'nacional'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Prestaciones Médicas ({searchResults.filter((r) => r.nom_id === 1 || r.nom_id === 2 || r.nom_id === 5).length})
              </button>
              <button
                onClick={() => setModalFilter('crm')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  modalFilter === 'crm'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                CRM Propias ({searchResults.filter((r) => r.origen === 'crm_propio').length})
              </button>

              <div className="ml-auto">
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
                  No se encontraron prácticas con el filtro seleccionado.
                </div>
              ) : (
                filteredResults.map((item) => {
                  const isSelected = !!modalSelected[item.id]
                  const selectedData = modalSelected[item.id]

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
                            <span>{item.tipo_nomenclador}</span>
                            {renderOriginBadge(item.origen_precio)}
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
                              <div className="relative w-24">
                                <span className="absolute left-1.5 top-1 text-slate-400 text-xs">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={selectedData?.precio_unitario ?? (item.precio_sugerido || 0)}
                                  onChange={(e) => handleUpdateModalPrice(item.id, parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs pl-3.5 pr-1.5 py-1 rounded border border-[var(--border)] bg-[var(--background)] font-mono font-bold text-emerald-600"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {!isSelected && (item.precio_sugerido > 0 ? (
                          <span className="font-mono font-bold text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            ${item.precio_sugerido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            Sin arancel Geclisa
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

            {/* Footer del Modal con Acción en Lote */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border)] pt-3 shrink-0">
              <div className="text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {countSelected} práctica(s) seleccionada(s)
                </span>
                {countSelected > 0 && (
                  <span className="text-slate-500 ml-2">
                    (Subtotal estimado: <strong className="text-emerald-600 font-mono">${modalSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>)
                  </span>
                )}
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
    </div>
  )
}
