'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Eye,
  Plus,
  Trash2,
  Edit2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  Layers,
  Info,
  QrCode,
  PackageCheck,
  Package,
  Boxes,
  Barcode,
  Check,
  RefreshCw,
  Tag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ModeloLio {
  id?: string
  marca: string
  modelo: string
  tipo_optica: string
  constante_a?: number
  acd_estimado?: number
  rango_dioptrias_min?: number
  rango_dioptrias_max?: number
  paso_dioptrias?: number
  admite_toricos?: boolean
  apto_sulcus?: boolean
  descripcion?: string | null
  activo?: boolean
  items_count?: number
  created_at?: string
}

interface ModeloLioItem {
  id?: string
  modelo_lio_id: string
  geclisa_ele_id: number
  geclisa_ele_cod: string
  geclisa_nombre?: string
  dioptria: number
  es_torico?: boolean
  torico_valor?: string | null
  stock_quirofano?: number
  stock_consignacion?: number
  lotes_quirofano?: any[]
  consultando_stock?: boolean
  created_at?: string
}

const TIPOS_OPTICA = [
  'Monofocal Asférico',
  'Monofocal Esférico',
  'Monofocal Plus (Visión Intermedia)',
  'Trifocal',
  'EDOF (Rango Extendido)',
  'Tórico Monofocal',
  'Tórico Multifocal',
  'Fáquico ICL',
  'Otro / Especial'
]

const TORICOS_OPCIONES = [
  'T2 (Cil 1.00 D)',
  'T3 (Cil 1.50 D)',
  'T4 (Cil 2.25 D)',
  'T5 (Cil 3.00 D)',
  'T6 (Cil 3.75 D)',
  'T7 (Cil 4.50 D)',
  'T8 (Cil 5.25 D)',
  'T9 (Cil 6.00 D)'
]

export default function LioSettingsCard() {
  const [modelos, setModelos] = useState<ModeloLio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroOptica, setFiltroOptica] = useState('ALL')

  // Acordeones expandidos por familia ID
  const [familiasExpandidas, setFamiliasExpandidas] = useState<Record<string, boolean>>({})
  const [itemsPorFamilia, setItemsPorFamilia] = useState<Record<string, ModeloLioItem[]>>({})
  const [cargandoItemsFamilia, setCargandoItemsFamilia] = useState<Record<string, boolean>>({})

  // PANEL 1: ALTA DIRECTA DESDE GECLISA (Flujo Principal)
  const [mostrandoAltaGeclisa, setMostrandoAltaGeclisa] = useState(false)
  const [geclisaSearch, setGeclisaSearch] = useState('')
  const [geclisaResultados, setGeclisaResultados] = useState<any[]>([])
  const [buscandoGeclisa, setBuscandoGeclisa] = useState(false)
  const [elementoGeclisaSeleccionado, setElementoGeclisaSeleccionado] = useState<any | null>(null)

  // Campos de Parametrización en CRM para el elemento seleccionado
  const [familiaSeleccionadaId, setFamiliaSeleccionadaId] = useState<string>('')
  const [creandoNuevaFamilia, setCreandoNuevaFamilia] = useState<boolean>(false)
  const [nuevaFamiliaMarca, setNuevaFamiliaMarca] = useState<string>('')
  const [nuevaFamiliaModelo, setNuevaFamiliaModelo] = useState<string>('')
  const [nuevaFamiliaOptica, setNuevaFamiliaOptica] = useState<string>('Monofocal Asférico')
  const [nuevaFamiliaConstanteA, setNuevaFamiliaConstanteA] = useState<number>(118.9)
  
  // Parámetros de la graduación
  const [nuevaDioptria, setNuevaDioptria] = useState<string>('21.50')
  const [nuevoEsTorico, setNuevoEsTorico] = useState<boolean>(false)
  const [nuevoToricoValor, setNuevoToricoValor] = useState<string>('T3 (Cil 1.50 D)')
  const [guardandoMapeo, setGuardandoMapeo] = useState<boolean>(false)

  // PANEL 2: EDICIÓN / ALTA MANUAL DE FAMILIA
  const [mostrandoFormFamilia, setMostrandoFormFamilia] = useState(false)
  const [familiaEnEdicion, setFamiliaEnEdicion] = useState<ModeloLio | null>(null)
  const [guardandoFamilia, setGuardandoFamilia] = useState(false)

  // Cargar catálogo de modelos/familias
  const fetchModelos = async () => {
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio`)
      const data = await res.json()
      if (res.ok && data.success && data.modelos) {
        setModelos(data.modelos)
        if (data.modelos.length > 0 && !familiaSeleccionadaId) {
          setFamiliaSeleccionadaId(data.modelos[0].id)
        }
      } else {
        throw new Error(data.detail || 'Error al cargar catálogo de LIO.')
      }
    } catch (err: any) {
      console.error('Error cargando modelos LIO:', err)
      setError('No se pudo conectar con el servidor para cargar los modelos de LIO.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchModelos()
  }, [])

  // Búsqueda en vivo en Geclisa con debounce
  useEffect(() => {
    if (!geclisaSearch.trim() || geclisaSearch.length < 2) {
      setGeclisaResultados([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setBuscandoGeclisa(true)
        const res = await fetch(`${BACKEND_URL}/api/geclisa/elementos/buscar?q=${encodeURIComponent(geclisaSearch.trim())}`)
        const data = await res.json()
        if (res.ok && data.success) {
          setGeclisaResultados(data.elementos || [])
        } else {
          setGeclisaResultados([])
        }
      } catch (e) {
        console.error('Error buscando en Geclisa:', e)
        setGeclisaResultados([])
      } finally {
        setBuscandoGeclisa(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [geclisaSearch])

  // Cargar items de una familia específica
  const fetchItemsFamilia = async (familiaId: string) => {
    try {
      setCargandoItemsFamilia((prev) => ({ ...prev, [familiaId]: true }))
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/${familiaId}/items`)
      const data = await res.json()
      if (res.ok && data.success) {
        setItemsPorFamilia((prev) => ({ ...prev, [familiaId]: data.items || [] }))
      }
    } catch (e) {
      console.error(`Error cargando items de familia ${familiaId}:`, e)
    } finally {
      setCargandoItemsFamilia((prev) => ({ ...prev, [familiaId]: false }))
    }
  }

  // Toggle acordeón de familia
  const handleToggleFamilia = (familiaId: string) => {
    const nuevoEstado = !familiasExpandidas[familiaId]
    setFamiliasExpandidas((prev) => ({ ...prev, [familiaId]: nuevoEstado }))
    if (nuevoEstado && !itemsPorFamilia[familiaId]) {
      fetchItemsFamilia(familiaId)
    }
  }

  // Seleccionar elemento de Geclisa
  const handleSeleccionarGeclisaElemento = (el: any) => {
    setElementoGeclisaSeleccionado(el)
    setGeclisaResultados([])

    // Intentar auto-extraer dioptría
    const matchDiop = el.eleNombre?.match(/(\d{1,2}\.?\d{0,2})\s*(D|DIOP|POT)?/i)
    if (matchDiop && matchDiop[1]) {
      const val = parseFloat(matchDiop[1])
      if (val >= 5 && val <= 35) {
        setNuevaDioptria(val.toFixed(2))
      }
    }

    // Sugerir nombre de familia / marca si no hay seleccionada
    const nombreClean = (el.eleNombre || '').toUpperCase()
    if (nombreClean.includes('PANOPTIX')) {
      setNuevaFamiliaMarca('Alcon')
      setNuevaFamiliaModelo('AcrySof IQ PanOptix')
      setNuevaFamiliaOptica('Trifocal')
      setNuevaFamiliaConstanteA(119.1)
    } else if (nombreClean.includes('VIVITY')) {
      setNuevaFamiliaMarca('Alcon')
      setNuevaFamiliaModelo('Clareon Vivity')
      setNuevaFamiliaOptica('EDOF (Rango Extendido)')
      setNuevaFamiliaConstanteA(119.2)
    } else if (nombreClean.includes('GALAXY')) {
      setNuevaFamiliaMarca('Rayner')
      setNuevaFamiliaModelo('Galaxy RAO605G')
      setNuevaFamiliaOptica('Monofocal Asférico')
      setNuevaFamiliaConstanteA(118.9)
    } else if (nombreClean.includes('ISOPURE')) {
      setNuevaFamiliaMarca('Physiol')
      setNuevaFamiliaModelo('ISOPURE 123')
      setNuevaFamiliaOptica('Monofocal Plus (Visión Intermedia)')
      setNuevaFamiliaConstanteA(118.6)
    } else if (nombreClean.includes('PURESEE')) {
      setNuevaFamiliaMarca('Johnson & Johnson')
      setNuevaFamiliaModelo('Tecnis PureSee')
      setNuevaFamiliaOptica('EDOF (Rango Extendido)')
      setNuevaFamiliaConstanteA(119.3)
    }
  }

  // Guardar Mapeo desde Geclisa
  const handleGuardarDesdeGeclisa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!elementoGeclisaSeleccionado) {
      setError('Debes buscar y seleccionar un elemento en Geclisa.')
      return
    }

    const diopNum = parseFloat(nuevaDioptria)
    if (isNaN(diopNum)) {
      setError('Ingresa una dioptría válida.')
      return
    }

    try {
      setGuardandoMapeo(true)
      setError(null)

      let targetFamiliaId = familiaSeleccionadaId

      // Si el usuario eligió crear una nueva familia al vuelo
      if (creandoNuevaFamilia || !targetFamiliaId) {
        if (!nuevaFamiliaMarca.trim() || !nuevaFamiliaModelo.trim()) {
          setError('Ingresa la Marca y el Nombre del Grupo/Familia.')
          setGuardandoMapeo(false)
          return
        }

        const resFam = await fetch(`${BACKEND_URL}/api/modelos-lio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marca: nuevaFamiliaMarca.trim(),
            modelo: nuevaFamiliaModelo.trim(),
            tipo_optica: nuevaFamiliaOptica,
            constante_a: nuevaFamiliaConstanteA || 118.9,
            acd_estimado: 5.0,
            activo: true
          })
        })
        const dataFam = await resFam.json()
        if (!resFam.ok || !dataFam.success || !dataFam.modelo?.id) {
          throw new Error(dataFam.detail || 'Error al crear la nueva familia de LIO.')
        }
        targetFamiliaId = dataFam.modelo.id
      }

      // Guardar el SKU / GTIN mapeado a esa familia
      const resItem = await fetch(`${BACKEND_URL}/api/modelos-lio/${targetFamiliaId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geclisa_ele_id: elementoGeclisaSeleccionado.eleId,
          geclisa_ele_cod: elementoGeclisaSeleccionado.eleCod,
          geclisa_nombre: elementoGeclisaSeleccionado.eleNombre,
          dioptria: diopNum,
          es_torico: nuevoEsTorico,
          torico_valor: nuevoEsTorico ? nuevoToricoValor : null
        })
      })

      const dataItem = await resItem.json()
      if (!resItem.ok || !dataItem.success) {
        throw new Error(dataItem.detail || 'Error al vincular el GTIN a la familia.')
      }

      setMensajeExito(`✔ Lente ${elementoGeclisaSeleccionado.eleCod} (+${diopNum.toFixed(2)} D) agregado y configurado en el CRM.`)
      setTimeout(() => setMensajeExito(null), 4000)

      // Limpiar formulario y refrescar
      setElementoGeclisaSeleccionado(null)
      setGeclisaSearch('')
      setMostrandoAltaGeclisa(false)
      setCreandoNuevaFamilia(false)
      fetchModelos()
      fetchItemsFamilia(targetFamiliaId)
      setFamiliasExpandidas((prev) => ({ ...prev, [targetFamiliaId]: true }))
    } catch (err: any) {
      console.error('Error guardando LIO:', err)
      setError(err.message || 'Error al guardar el lente.')
    } finally {
      setGuardandoMapeo(false)
    }
  }

  // Consultar stock en vivo para un item
  const handleConsultarStockItem = async (familiaId: string, item: ModeloLioItem) => {
    try {
      setItemsPorFamilia((prev) => ({
        ...prev,
        [familiaId]: prev[familiaId].map((it) => (it.id === item.id ? { ...it, consultando_stock: true } : it))
      }))

      const res = await fetch(`${BACKEND_URL}/api/geclisa/elementos/${item.geclisa_ele_id}/stock-lotes`)
      const data = await res.json()
      if (res.ok && data.success && data.resumen) {
        const r = data.resumen
        setItemsPorFamilia((prev) => ({
          ...prev,
          [familiaId]: prev[familiaId].map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  stock_quirofano: r.stock_quirofano,
                  stock_consignacion: r.stock_consignacion,
                  lotes_quirofano: r.lotes_quirofano,
                  consultando_stock: false
                }
              : it
          )
        }))
      }
    } catch (e) {
      console.error('Error consultando stock en vivo:', e)
      setItemsPorFamilia((prev) => ({
        ...prev,
        [familiaId]: prev[familiaId].map((it) => (it.id === item.id ? { ...it, consultando_stock: false } : it))
      }))
    }
  }

  // Eliminar item
  const handleEliminarItem = async (familiaId: string, itemId?: string) => {
    if (!itemId) return
    if (!confirm('¿Deseas desvincular esta graduación GTIN de la familia?')) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/items/${itemId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        setItemsPorFamilia((prev) => ({
          ...prev,
          [familiaId]: prev[familiaId].filter((it) => it.id !== itemId)
        }))
        fetchModelos()
      }
    } catch (e) {
      console.error('Error eliminando item:', e)
    }
  }

  // Eliminar Familia completa
  const handleEliminarFamilia = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Estás seguro de que deseas eliminar este grupo/familia y todos sus GTINs mapeados?')) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        setModelos((prev) => prev.filter((m) => m.id !== id))
        setMensajeExito('✔ Familia de LIO eliminada.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err: any) {
      console.error('Error eliminando familia:', err)
      setError('Error al eliminar familia.')
    }
  }

  // Guardar edición de familia
  const handleGuardarFamilia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familiaEnEdicion?.marca?.trim() || !familiaEnEdicion?.modelo?.trim()) {
      setError('La marca y el modelo son obligatorios.')
      return
    }

    try {
      setGuardandoFamilia(true)
      setError(null)
      const esEdit = !!familiaEnEdicion.id
      const url = esEdit ? `${BACKEND_URL}/api/modelos-lio/${familiaEnEdicion.id}` : `${BACKEND_URL}/api/modelos-lio`
      const method = esEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(familiaEnEdicion)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(esEdit ? '✔ Familia actualizada con éxito.' : '✔ Nueva familia creada.')
        setTimeout(() => setMensajeExito(null), 3500)
        setMostrandoFormFamilia(false)
        setFamiliaEnEdicion(null)
        fetchModelos()
      }
    } catch (err: any) {
      console.error('Error guardando familia:', err)
      setError(err.message || 'Error al guardar familia.')
    } finally {
      setGuardandoFamilia(false)
    }
  }

  // Filtrado dinámico
  const filteredModelos = useMemo(() => {
    return modelos.filter((m) => {
      const matchesSearch =
        !searchTerm.trim() ||
        m.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.descripcion && m.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesOptica = filtroOptica === 'ALL' || m.tipo_optica === filtroOptica
      return matchesSearch && matchesOptica
    })
  }, [modelos, searchTerm, filtroOptica])

  return (
    <div className="bg-[var(--card)] p-5 md:p-6 rounded-3xl border border-[var(--border)] space-y-6 shadow-sm animate-fade-in">
      {/* 1. CABECERA PRINCIPAL & ACCIONES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 rounded-2xl border border-cyan-500/30 shadow-xs">
            <Eye size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-[var(--foreground)] tracking-tight">
                Catálogo & Parametrización de Lentes Intraoculares (LIO)
              </h2>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                {modelos.length} familias
              </span>
            </div>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Busca el artículo en Geclisa por API, impórtalo y configúrale su Familia, Dioptría, Toricidad y Constante A para Quirófano.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMostrandoAltaGeclisa(true)
              setElementoGeclisaSeleccionado(null)
              setGeclisaSearch('')
              setMostrandoFormFamilia(false)
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <QrCode size={16} />
            <span>+ Buscar y Agregar Lente desde Geclisa</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}
      {mensajeExito && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span className="font-bold">{mensajeExito}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. PANEL DE ALTA DIRECTA DESDE GECLISA (El Flujo Solicitado) */}
      {/* ==================================================================== */}
      {mostrandoAltaGeclisa && (
        <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-800/80 dark:to-blue-950/40 border-2 border-blue-500/50 shadow-xl space-y-5 animate-scale-in">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600 text-white">
                <Barcode size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                  Paso 1: Buscar Elemento en Geclisa vía API
                </h4>
                <p className="text-[11px] text-[var(--secondary)]">
                  Escribe el código, nombre comercial o pistolea el código de barras/QR DataMatrix del lente.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMostrandoAltaGeclisa(false)}
              className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          {/* Input de Búsqueda en Vivo */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" />
            <input
              type="text"
              autoFocus
              value={geclisaSearch}
              onChange={(e) => setGeclisaSearch(e.target.value)}
              placeholder="Ej: GALAXY, PANOPTIX, VIVITY, POD F, ISOPURE, TECNIS o código GTIN..."
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[var(--card)] border-2 border-blue-300 dark:border-blue-700 text-xs md:text-sm font-bold text-[var(--foreground)] outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm"
            />
            {buscandoGeclisa && (
              <Loader2 size={16} className="animate-spin text-blue-600 absolute right-4 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {/* Lista de Resultados de Geclisa */}
          {geclisaResultados.length > 0 && !elementoGeclisaSeleccionado && (
            <div className="max-h-60 overflow-y-auto rounded-2xl border border-blue-200 dark:border-blue-900 bg-[var(--card)] shadow-xl divide-y divide-[var(--border)] animate-fade-in">
              {geclisaResultados.map((el) => (
                <button
                  key={el.eleId}
                  type="button"
                  onClick={() => handleSeleccionarGeclisaElemento(el)}
                  className="w-full p-3 text-left text-xs hover:bg-blue-50/80 dark:hover:bg-blue-950/60 flex items-center justify-between transition gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-blue-600 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md text-[11px]">
                        {el.eleCod}
                      </span>
                      <span className="font-extrabold text-[var(--foreground)] truncate text-xs">
                        {el.eleNombre}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--secondary)]">
                      Categoría: {el.tipo} • ID Geclisa: #{el.eleId}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      Stock: {el.stockActual ?? 0} un
                    </span>
                    <span className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg text-[10px] flex items-center gap-1">
                      <span>Seleccionar</span>
                      <ChevronRight size={12} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* PASO 2: FORMULARIO DE PARAMETRIZACIÓN EN CRM AL SELECCIONAR ELEMENTO */}
          {elementoGeclisaSeleccionado && (
            <form
              onSubmit={handleGuardarDesdeGeclisa}
              className="p-5 rounded-2xl bg-[var(--card)] border-2 border-emerald-500/50 space-y-4 shadow-lg animate-scale-in"
            >
              {/* Tarjeta del Elemento Traído desde Geclisa */}
              <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-black shrink-0">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-emerald-950 dark:text-emerald-100 block">
                      {elementoGeclisaSeleccionado.eleNombre}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                      Código GTIN: <b>{elementoGeclisaSeleccionado.eleCod}</b> • ID #{elementoGeclisaSeleccionado.eleId} • Stock Geclisa: {elementoGeclisaSeleccionado.stockActual ?? 0} un
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setElementoGeclisaSeleccionado(null)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline"
                >
                  Cambiar elemento
                </button>
              </div>

              <h5 className="text-xs font-black text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5 pt-1">
                <Sparkles size={14} className="text-cyan-500" />
                <span>Paso 2: Configurar para Utilización en el CRM</span>
              </h5>

              {/* 1. Selección de Grupo / Familia */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[var(--secondary)]">
                    Grupo / Familia del LIO en el CRM *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreandoNuevaFamilia(!creandoNuevaFamilia)}
                    className="text-[11px] font-black text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>{creandoNuevaFamilia ? 'Seleccionar Familia Existente' : 'Crear Nuevo Grupo / Familia'}</span>
                  </button>
                </div>

                {!creandoNuevaFamilia ? (
                  <select
                    value={familiaSeleccionadaId}
                    onChange={(e) => setFamiliaSeleccionadaId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-bold text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.marca} — {m.modelo} ({m.tipo_optica}) • Constante A: {m.constante_a || 118.9}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--secondary)]">Marca / Laboratorio *</label>
                      <input
                        type="text"
                        value={nuevaFamiliaMarca}
                        onChange={(e) => setNuevaFamiliaMarca(e.target.value)}
                        placeholder="Ej: Alcon, Rayner..."
                        className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--secondary)]">Nombre del Grupo / Modelo *</label>
                      <input
                        type="text"
                        value={nuevaFamiliaModelo}
                        onChange={(e) => setNuevaFamiliaModelo(e.target.value)}
                        placeholder="Ej: AcrySof PanOptix..."
                        className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--secondary)]">Tipo de Óptica</label>
                      <select
                        value={nuevaFamiliaOptica}
                        onChange={(e) => setNuevaFamiliaOptica(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                      >
                        {TIPOS_OPTICA.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--secondary)]">Constante A Nominal</label>
                      <input
                        type="number"
                        step="0.01"
                        value={nuevaFamiliaConstanteA}
                        onChange={(e) => setNuevaFamiliaConstanteA(parseFloat(e.target.value) || 118.9)}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Graduación Óptica y Toricidad para este GTIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
                <div>
                  <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                    Dioptría Esférica (Poder) para este GTIN *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNuevaDioptria((prev) => (parseFloat(prev || '20') - 0.5).toFixed(2))}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200"
                    >
                      -0.50 D
                    </button>
                    <input
                      type="number"
                      step="0.25"
                      value={nuevaDioptria}
                      onChange={(e) => setNuevaDioptria(e.target.value)}
                      className="w-full text-center py-2 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm font-mono font-black text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setNuevaDioptria((prev) => (parseFloat(prev || '20') + 0.5).toFixed(2))}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200"
                    >
                      +0.50 D
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                    Variante Tórica (Astigmatismo)
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nuevoEsTorico}
                        onChange={(e) => setNuevoEsTorico(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                      />
                      <span className="text-xs font-bold text-[var(--foreground)]">Es Tórico</span>
                    </label>

                    {nuevoEsTorico && (
                      <select
                        value={nuevoToricoValor}
                        onChange={(e) => setNuevoToricoValor(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none"
                      >
                        {TORICOS_OPCIONES.map((tor) => (
                          <option key={tor} value={tor}>{tor}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setElementoGeclisaSeleccionado(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoMapeo}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {guardandoMapeo ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>Guardar y Habilitar en CRM</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. MODAL DE EDICIÓN MANUAL DE FAMILIA */}
      {/* ==================================================================== */}
      {mostrandoFormFamilia && familiaEnEdicion && (
        <form
          onSubmit={handleGuardarFamilia}
          className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-blue-500/40 space-y-4 shadow-md animate-scale-in"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              {familiaEnEdicion.id ? 'Editar Parámetros de la Familia de LIO' : 'Registrar Nuevo Grupo de LIO'}
            </h4>
            <button
              type="button"
              onClick={() => {
                setMostrandoFormFamilia(false)
                setFamiliaEnEdicion(null)
              }}
              className="p-1 text-slate-400 hover:text-[var(--foreground)] rounded-lg"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="text-[11px] font-bold text-[var(--secondary)]">Laboratorio / Marca *</label>
              <input
                type="text"
                value={familiaEnEdicion.marca}
                onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, marca: e.target.value })}
                placeholder="Ej: Alcon, Rayner, Zeiss..."
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--secondary)]">Nombre del Grupo / Modelo *</label>
              <input
                type="text"
                value={familiaEnEdicion.modelo}
                onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, modelo: e.target.value })}
                placeholder="Ej: AcrySof PanOptix, Clareon Vivity..."
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--secondary)]">Tipo de Óptica *</label>
              <select
                value={familiaEnEdicion.tipo_optica}
                onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, tipo_optica: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-semibold outline-none focus:border-blue-500"
              >
                {TIPOS_OPTICA.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-bold text-[var(--secondary)]">Constante A Nominal (Biometría)</label>
              <input
                type="number"
                step="0.01"
                value={familiaEnEdicion.constante_a || 118.9}
                onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, constante_a: parseFloat(e.target.value) || 0 })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-mono font-bold outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--secondary)]">Descripción o Notas Clínicas</label>
              <input
                type="text"
                value={familiaEnEdicion.descripcion || ''}
                onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, descripcion: e.target.value })}
                placeholder="Material acrílico hidrofóbico, filtro luz azul..."
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setMostrandoFormFamilia(false)
                setFamiliaEnEdicion(null)
              }}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoFamilia}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
            >
              {guardandoFamilia ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* 4. BARRA DE BÚSQUEDA Y FILTROS LOCALES */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-[var(--border)]">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar familias por marca o modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SlidersHorizontal size={14} className="text-slate-400" />
          <select
            value={filtroOptica}
            onChange={(e) => setFiltroOptica(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">Todos los Tipos de Óptica</option>
            {TIPOS_OPTICA.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span className="text-[11px] font-mono text-[var(--secondary)] font-bold ml-auto">
            {filteredModelos.length} grupos
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. LISTA DE FAMILIAS Y MATRIZ DE GRADUACIONES EN ACORDEÓN */}
      {/* ==================================================================== */}
      {cargando ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span>Cargando catálogo de lentes intraoculares...</span>
        </div>
      ) : filteredModelos.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-3xl space-y-2">
          <Eye size={28} className="mx-auto text-slate-400 opacity-50" />
          <p className="font-bold text-sm text-[var(--foreground)]">No hay familias de LIO configuradas</p>
          <p className="text-[11px]">
            Usa el botón superior <b>"+ Buscar y Agregar Lente desde Geclisa"</b> para incorporar tu primer lente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredModelos.map((m) => {
            const expandido = Boolean(familiasExpandidas[m.id!])
            const items = itemsPorFamilia[m.id!] || []
            const cargandoIts = Boolean(cargandoItemsFamilia[m.id!])

            return (
              <div
                key={m.id}
                className="rounded-3xl border border-[var(--border)] bg-slate-50/40 dark:bg-slate-800/30 overflow-hidden shadow-xs hover:border-blue-400/50 transition"
              >
                {/* Cabecera de la Familia */}
                <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)]">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleFamilia(m.id!)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-cyan-500 hover:text-black transition shrink-0 mt-0.5"
                      title={expandido ? 'Ocultar graduaciones' : 'Ver graduaciones'}
                    >
                      {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {m.marca}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {m.tipo_optica}
                        </span>
                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                          Constante A: {m.constante_a || 118.9}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-[var(--foreground)] tracking-tight">
                        {m.modelo}
                      </h3>

                      {m.descripcion && (
                        <p className="text-[11px] text-[var(--secondary)] truncate">{m.descripcion}</p>
                      )}
                    </div>
                  </div>

                  {/* Acciones de la Familia */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFamiliaSeleccionadaId(m.id!)
                        setCreandoNuevaFamilia(false)
                        setMostrandoAltaGeclisa(true)
                        setElementoGeclisaSeleccionado(null)
                        setGeclisaSearch(m.modelo.split(' ')[0] || '')
                      }}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Plus size={13} />
                      <span>+ Vincular GTIN a este Grupo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFamiliaEnEdicion({ ...m })
                        setMostrandoFormFamilia(true)
                        setMostrandoAltaGeclisa(false)
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Editar familia"
                    >
                      <Edit2 size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEliminarFamilia(m.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Eliminar familia"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Acordeón: Matriz de Graduaciones / GTINs de esta Familia */}
                {expandido && (
                  <div className="p-4 md:p-5 border-t border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                        <Boxes size={14} className="text-cyan-500" />
                        <span>Graduaciones & GTINs de Geclisa Vinculados ({items.length})</span>
                      </span>
                      <span className="text-[10px] text-[var(--secondary)]">
                        En Quirófano el médico selecciona este grupo y escribe la dioptría para resolver el GTIN
                      </span>
                    </div>

                    {cargandoIts ? (
                      <div className="p-6 text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                        <span>Cargando graduaciones...</span>
                      </div>
                    ) : items.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-[var(--border)] rounded-2xl text-xs text-[var(--secondary)]">
                        No hay graduaciones asociadas a este grupo. Usa el botón <b>"+ Vincular GTIN a este Grupo"</b> para buscar en Geclisa.
                      </div>
                    ) : (
                      <div className="border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs bg-[var(--card)]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800/80 text-[var(--secondary)] font-bold text-[10px] uppercase tracking-wider border-b border-[var(--border)]">
                              <th className="p-3">Dioptría (D)</th>
                              <th className="p-3">Toricidad</th>
                              <th className="p-3">Código GTIN Geclisa</th>
                              <th className="p-3">Nombre en Geclisa</th>
                              <th className="p-3">Stock Quirófano</th>
                              <th className="p-3 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {items.map((it) => (
                              <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                                  +{Number(it.dioptria).toFixed(2)} D
                                </td>
                                <td className="p-3">
                                  {it.es_torico ? (
                                    <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px]">
                                      {it.torico_valor || 'Tórico'}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">Esférico</span>
                                  )}
                                </td>
                                <td className="p-3 font-mono font-extrabold text-[var(--foreground)]">
                                  {it.geclisa_ele_cod}
                                </td>
                                <td className="p-3 text-[11px] text-[var(--secondary)] truncate max-w-xs" title={it.geclisa_nombre}>
                                  {it.geclisa_nombre || 'N/A'}
                                </td>
                                <td className="p-3">
                                  {it.stock_quirofano !== undefined ? (
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                      it.stock_quirofano > 0
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    }`}>
                                      {it.stock_quirofano} un
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={it.consultando_stock}
                                      onClick={() => handleConsultarStockItem(m.id!, it)}
                                      className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                      {it.consultando_stock ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                      <span>Ver Stock</span>
                                    </button>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarItem(m.id!, it.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                    title="Eliminar graduación"
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
