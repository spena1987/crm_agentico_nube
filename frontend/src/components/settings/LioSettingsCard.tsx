'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Eye,
  Plus,
  Edit2,
  Trash2,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  SlidersHorizontal,
  Package,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  Building2,
  RefreshCw,
  Info,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import AlconCatalogModal from './AlconCatalogModal'

// Tipos de datos
export interface ModeloLioItem {
  id: string
  modelo_lio_id: string
  geclisa_ele_id: number
  geclisa_ele_cod: string
  geclisa_nombre: string
  dioptria: number
  es_torico: boolean
  torico_valor?: string
  stock_quirofano?: number
  stock_consignacion?: number
  stock_farmacia?: number
  stock_total?: number
  lotes_quirofano?: any[]
  lotes_consignacion?: any[]
  lotes_farmacia?: any[]
  stock_cargando?: boolean
  modelos_lio?: {
    id: string
    marca: string
    modelo: string
    tipo_optica: string
    constante_a: number
  }
}

export interface ModeloLio {
  id?: string
  marca: string
  modelo: string
  tipo_optica: string
  constante_a: number
  acd_estimado?: number
  rango_dioptrias_min?: number
  rango_dioptrias_max?: number
  paso_dioptrias?: number
  admite_toricos?: boolean
  apto_sulcus?: boolean
  descripcion?: string
  activo?: boolean
  items_count?: number
  stock_total_acumulado?: number
  created_at?: string
  items?: ModeloLioItem[]
}

const TIPOS_OPTICA = [
  'Monofocal Esférico',
  'Monofocal Asférico',
  'Monofocal Plus (EDOF Básico)',
  'EDOF (Rango Extendido)',
  'Bifocal',
  'Trifocal',
  'Acomodativo'
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

// Extrae el código GTIN limpio de una cadena de código de barras
function extractGtinFromBarcode(raw: string): { gtin: string } {
  const clean = raw.trim()
  const matchAi01 = clean.match(/\(01\)(\d{14})/)
  if (matchAi01) {
    return { gtin: matchAi01[1] }
  }
  const match01NoParentheses = clean.match(/^01(\d{14})/)
  if (match01NoParentheses) {
    return { gtin: match01NoParentheses[1] }
  }
  if (clean.length === 14 && /^\d+$/.test(clean)) {
    return { gtin: clean }
  }
  if (clean.length > 16 && clean.startsWith('01')) {
    const gtin = clean.slice(2, 16)
    return { gtin }
  }
  return { gtin: clean }
}

export default function LioSettingsCard() {
  // Datos
  const [familias, setFamilias] = useState<ModeloLio[]>([])
  const [itemsGtin, setItemsGtin] = useState<ModeloLioItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoItems, setCargandoItems] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Selección Master-Detail y Modo Responsive Móvil/Tablet
  const [familiaSeleccionadaId, setFamiliaSeleccionadaId] = useState<string | null>(null)
  const [vistaMovil, setVistaMovil] = useState<'familias' | 'graduaciones'>('familias')

  // Filtros Panel Izquierdo (Familias)
  const [filtroFamiliaSearch, setFiltroFamiliaSearch] = useState('')
  const [filtroFamiliaOptica, setFiltroFamiliaOptica] = useState('ALL')
  const [filtroMarca, setFiltroMarca] = useState('ALL')

  // Formulario Familia (Modal/Drawer in-situ)
  const [mostrandoFormFamilia, setMostrandoFormFamilia] = useState(false)
  const [familiaEnEdicion, setFamiliaEnEdicion] = useState<ModeloLio | null>(null)
  const [guardandoFamilia, setGuardandoFamilia] = useState(false)

  // Filtro y Formulario Vinculación GTIN in-situ (Panel Derecho)
  const [filtroDioptriaSearch, setFiltroDioptriaSearch] = useState('')
  const [mostrandoAltaGtin, setMostrandoAltaGtin] = useState(false)
  const [scannerInput, setScannerInput] = useState('')
  const [buscandoGeclisa, setBuscandoGeclisa] = useState(false)
  const [geclisaResultados, setGeclisaResultados] = useState<any[]>([])
  const [elementoGeclisaSeleccionado, setElementoGeclisaSeleccionado] = useState<any | null>(null)
  const [gtinDuplicadoInfo, setGtinDuplicadoInfo] = useState<any | null>(null)
  const [validandoGtin, setValidandoGtin] = useState(false)
  const [gtinDioptria, setGtinDioptria] = useState<string>('21.50')
  const [gtinEsTorico, setGtinEsTorico] = useState<boolean>(false)
  const [gtinToricoValor, setGtinToricoValor] = useState<string>('T3 (Cil 1.50 D)')
  const [guardandoGtin, setGuardandoGtin] = useState(false)

  // Popover interactivo de stock
  const [popoverStockGtin, setPopoverStockGtin] = useState<string | null>(null)

  // Drawer Catálogo Maestro
  const [mostrandoModalCatalogoAlcon, setMostrandoModalCatalogoAlcon] = useState(false)

  // Sincronización Geclisa
  const [sincronizandoGeclisa, setSincronizandoGeclisa] = useState(false)

  // ====================================================================
  // CARGA DE DATOS INICIALES
  // ====================================================================
  const fetchFamilias = async () => {
    try {
      setCargando(true)
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio`)
      const data = await res.json()
      if (res.ok && data.success && data.modelos) {
        setFamilias(data.modelos)
        if (data.modelos.length > 0) {
          setFamiliaSeleccionadaId((prev) => prev || data.modelos[0].id)
        }
      }
    } catch (err) {
      console.error('Error cargando familias:', err)
      setError('Error al cargar familias de LIO.')
    } finally {
      setCargando(false)
    }
  }

  const fetchItemsGtin = async () => {
    try {
      setCargandoItems(true)
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio-items`)
      const data = await res.json()
      if (res.ok && data.success && data.items) {
        setItemsGtin(data.items)
      }
    } catch (err) {
      console.error('Error cargando items GTIN:', err)
    } finally {
      setCargandoItems(false)
    }
  }

  useEffect(() => {
    fetchFamilias()
    fetchItemsGtin()
  }, [])

  // ====================================================================
  // CONSULTA DE STOCK GECLISA (MULTIDEPÓSITO)
  // ====================================================================
  const handleConsultarStockGtin = async (itemId: string, eleId: number) => {
    try {
      setItemsGtin((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, stock_cargando: true } : it))
      )
      const res = await fetch(`${BACKEND_URL}/api/geclisa/elementos/${eleId}/stock-lotes`)
      const data = await res.json()
      if (res.ok && data.success && data.resumen) {
        setItemsGtin((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  stock_quirofano: data.resumen.stock_quirofano,
                  stock_consignacion: data.resumen.stock_consignacion,
                  stock_farmacia: data.resumen.stock_farmacia || 0,
                  stock_total: data.resumen.stock_total || 0,
                  lotes_quirofano: data.resumen.lotes_quirofano || [],
                  lotes_consignacion: data.resumen.lotes_consignacion || [],
                  lotes_farmacia: data.resumen.lotes_farmacia || [],
                  stock_cargando: false
                }
              : it
          )
        )
      } else {
        setItemsGtin((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, stock_cargando: false } : it))
        )
      }
    } catch (e) {
      console.error('Error consultando stock de eleId:', eleId, e)
      setItemsGtin((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, stock_cargando: false } : it))
      )
    }
  }

  // Refrescar todo el stock de la familia activa
  const handleRefrescarStockFamilia = async (items: ModeloLioItem[]) => {
    for (const it of items) {
      if (it.geclisa_ele_id) {
        handleConsultarStockGtin(it.id, it.geclisa_ele_id)
      }
    }
  }

  // ====================================================================
  // SINCRONIZACIÓN MASIVA RÁPIDA CON GECLISA
  // ====================================================================
  const handleSincronizarGeclisaRapida = async () => {
    try {
      setSincronizandoGeclisa(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/catalogo-maestro/sincronizar-geclisa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(`✔ Sincronización completada: ${data.total_sincronizados || 0} blísteres cruzados con Geclisa.`)
        await fetchFamilias()
        await fetchItemsGtin()
        setTimeout(() => setMensajeExito(null), 4000)
      } else {
        throw new Error(data.detail || 'Error al sincronizar con Geclisa.')
      }
    } catch (e: any) {
      setError(e.message || 'Error al sincronizar.')
    } finally {
      setSincronizandoGeclisa(false)
    }
  }

  // ====================================================================
  // GUARDAR FAMILIA (CREAR / EDITAR)
  // ====================================================================
  const handleGuardarFamilia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familiaEnEdicion?.marca?.trim() || !familiaEnEdicion?.modelo?.trim()) {
      setError('La marca y el nombre de la familia son obligatorios.')
      return
    }

    try {
      setGuardandoFamilia(true)
      setError(null)
      const esEdit = !!familiaEnEdicion.id
      const url = esEdit ? `${BACKEND_URL}/api/modelos-lio/${familiaEnEdicion.id}` : `${BACKEND_URL}/api/modelos-lio`
      const method = esEdit ? 'PUT' : 'POST'

      const { items_count, created_at, ...cleanPayload } = familiaEnEdicion as any

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(esEdit ? '✔ Familia actualizada correctamente.' : '✔ Nueva familia creada.')
        setMostrandoFormFamilia(false)
        setFamiliaEnEdicion(null)
        await fetchFamilias()
        await fetchItemsGtin()
        setTimeout(() => setMensajeExito(null), 3500)
      } else {
        throw new Error(data.detail || 'Error al guardar la familia.')
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar familia.')
    } finally {
      setGuardandoFamilia(false)
    }
  }

  const handleEliminarFamilia = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Deseas eliminar esta familia y todas sus graduaciones GTIN vinculadas?')) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setFamilias((prev) => prev.filter((f) => f.id !== id))
        await fetchItemsGtin()
        if (familiaSeleccionadaId === id) {
          setFamiliaSeleccionadaId(familias.find((f) => f.id !== id)?.id || null)
        }
        setMensajeExito('✔ Familia eliminada.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar familia.')
    }
  }

  // ====================================================================
  // ASISTENTE DE ESCANEO / VINCULACIÓN DE GTIN
  // ====================================================================
  const handleBuscarEnGeclisa = async (termino: string) => {
    if (!termino.trim()) return
    try {
      setBuscandoGeclisa(true)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/elementos/autocomplete?search=${encodeURIComponent(termino.trim())}`)
      const data = await res.json()
      if (res.ok && data.success && Array.isArray(data.elementos)) {
        setGeclisaResultados(data.elementos)
      } else {
        setGeclisaResultados([])
      }
    } catch (e) {
      console.error('Error buscando elemento en Geclisa:', e)
      setGeclisaResultados([])
    } finally {
      setBuscandoGeclisa(false)
    }
  }

  const handleSeleccionarElementoGeclisa = (el: any) => {
    setElementoGeclisaSeleccionado(el)
    setGeclisaResultados([])
    if (el.eleCod) {
      const { gtin } = extractGtinFromBarcode(el.eleCod)
      setScannerInput(gtin)
      validarUnicidadGtin(gtin)
    }
    const matchDiop = el.eleNombre?.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:D|DIOP|DP)/i)
    if (matchDiop) {
      const parsed = parseFloat(matchDiop[1].replace(',', '.'))
      if (!isNaN(parsed)) setGtinDioptria(parsed.toFixed(2))
    }
    const matchTor = el.eleNombre?.match(/\bT([2-9])\b/i)
    if (matchTor) {
      setGtinEsTorico(true)
      const num = matchTor[1]
      const found = TORICOS_OPCIONES.find((t) => t.startsWith(`T${num}`))
      if (found) setGtinToricoValor(found)
    }
  }

  const validarUnicidadGtin = async (gtin: string) => {
    if (!gtin || gtin.length < 8) {
      setGtinDuplicadoInfo(null)
      return
    }
    try {
      setValidandoGtin(true)
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/validar-gtin?gtin=${encodeURIComponent(gtin)}`)
      const data = await res.json()
      if (res.ok && data.success && data.duplicado) {
        setGtinDuplicadoInfo(data)
      } else {
        setGtinDuplicadoInfo(null)
      }
    } catch (e) {
      console.error('Error validando unicidad:', e)
    } finally {
      setValidandoGtin(false)
    }
  }

  const handleGuardarGtinIndividual = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetFamId = familiaActiva?.id
    if (!targetFamId) {
      setError('Debes tener seleccionada una familia clínica.')
      return
    }
    if (!elementoGeclisaSeleccionado && !scannerInput.trim()) {
      setError('Debes ingresar un código GTIN o seleccionar un elemento de Geclisa.')
      return
    }

    try {
      setGuardandoGtin(true)
      setError(null)

      const payload = {
        geclisa_ele_id: elementoGeclisaSeleccionado?.eleId || 0,
        geclisa_ele_cod: scannerInput.trim() || elementoGeclisaSeleccionado?.eleCod || '',
        geclisa_nombre: elementoGeclisaSeleccionado?.eleNombre || `LIO ${scannerInput.trim()}`,
        dioptria: parseFloat(gtinDioptria) || 0,
        es_torico: gtinEsTorico,
        torico_valor: gtinEsTorico ? gtinToricoValor : null
      }

      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/${targetFamId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito('✔ Graduación GTIN vinculada exitosamente.')
        setMostrandoAltaGtin(false)
        setScannerInput('')
        setElementoGeclisaSeleccionado(null)
        setGtinDuplicadoInfo(null)
        await fetchItemsGtin()
        await fetchFamilias()
        setTimeout(() => setMensajeExito(null), 3500)
      } else {
        throw new Error(data.detail || 'Error al guardar el GTIN.')
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar el ítem.')
    } finally {
      setGuardandoGtin(false)
    }
  }

  const handleEliminarItemGtin = async (id: string) => {
    if (!confirm('¿Deseas desvincular este GTIN de la familia?')) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/items/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItemsGtin((prev) => prev.filter((it) => it.id !== id))
        await fetchFamilias()
        setMensajeExito('✔ Graduación desvinculada.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar ítem GTIN.')
    }
  }

  // ====================================================================
  // FILTRADO DE FAMILIAS & SELECCIÓN MASTER-DETAIL
  // ====================================================================
  const familiasFiltradas = useMemo(() => {
    const cleanSearch = filtroFamiliaSearch.trim().toLowerCase()
    return familias.filter((f) => {
      const matchSearch =
        !cleanSearch ||
        (f.marca || '').toLowerCase().includes(cleanSearch) ||
        (f.modelo || '').toLowerCase().includes(cleanSearch) ||
        (f.descripcion || '').toLowerCase().includes(cleanSearch)
      const matchOptica = filtroFamiliaOptica === 'ALL' || f.tipo_optica === filtroFamiliaOptica
      const matchMarca = filtroMarca === 'ALL' || f.marca === filtroMarca
      return matchSearch && matchOptica && matchMarca
    })
  }, [familias, filtroFamiliaSearch, filtroFamiliaOptica, filtroMarca])

  // Familia activa seleccionada
  const familiaActiva = useMemo(() => {
    return familias.find((f) => f.id === familiaSeleccionadaId) || familiasFiltradas[0] || null
  }, [familias, familiaSeleccionadaId, familiasFiltradas])

  // Graduaciones de la familia activa
  const itemsDeFamiliaActiva = useMemo(() => {
    if (!familiaActiva) return []
    const cleanDiop = filtroDioptriaSearch.trim().toLowerCase()
    return itemsGtin
      .filter((it) => it.modelo_lio_id === familiaActiva.id)
      .filter((it) => {
        if (!cleanDiop) return true
        const diopStr = it.dioptria !== undefined && it.dioptria !== null ? String(it.dioptria) : ''
        const codStr = it.geclisa_ele_cod || ''
        const nomStr = it.geclisa_nombre || ''
        return diopStr.includes(cleanDiop) || codStr.toLowerCase().includes(cleanDiop) || nomStr.toLowerCase().includes(cleanDiop)
      })
      .sort((a, b) => (a.dioptria || 0) - (b.dioptria || 0))
  }, [itemsGtin, familiaActiva, filtroDioptriaSearch])

  // Marcas únicas disponibles
  const marcasDisponibles = useMemo(() => {
    const setM = new Set(familias.map((f) => f.marca).filter(Boolean))
    return Array.from(setM)
  }, [familias])

  return (
    <div className="bg-[var(--card)] p-4 md:p-6 rounded-3xl border border-[var(--border)] space-y-6 shadow-sm animate-fade-in">
      {/* 1. CABECERA GLOBAL & ACCIONES UNIFICADAS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 rounded-2xl border border-cyan-500/30">
            <Eye size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-black text-[var(--foreground)] tracking-tight">
                Lentes Intraoculares (LIO) & Trazabilidad GTIN
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
                {familias.length} Familias • {itemsGtin.length} Graduaciones
              </span>
            </div>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Gestión centralizada de familias ópticas, constantes biométricas, blísteres y stock multidepósito en tiempo real con Geclisa ERP.
            </p>
          </div>
        </div>

        {/* Barra de Acciones Principales */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botón Drawer Catálogo Maestro */}
          <button
            type="button"
            onClick={() => setMostrandoModalCatalogoAlcon(true)}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-600/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            title="Abrir Biblioteca Global de 3.894 SKUs, Insumos, generador de stickers PDF y códigos QR"
          >
            <Sparkles size={14} className="text-amber-500 animate-pulse" />
            <span>Biblioteca Global & Stickers (3.894 SKUs)</span>
            <ExternalLink size={12} className="opacity-70" />
          </button>

          {/* Botón Sincronizar Geclisa */}
          <button
            type="button"
            disabled={sincronizandoGeclisa}
            onClick={handleSincronizarGeclisaRapida}
            className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] text-xs font-bold flex items-center gap-1.5 border border-[var(--border)] transition cursor-pointer"
            title="Cruzar códigos GTIN y actualizar existencias de Geclisa"
          >
            <Zap size={14} className={sincronizandoGeclisa ? 'animate-spin text-amber-500' : 'text-amber-500'} />
            <span>{sincronizandoGeclisa ? 'Sincronizando Geclisa...' : 'Sincronizar Geclisa'}</span>
          </button>

          {/* Botón + Nueva Familia */}
          <button
            type="button"
            onClick={() => {
              setFamiliaEnEdicion({
                marca: 'Alcon',
                modelo: '',
                tipo_optica: 'Monofocal Asférico',
                constante_a: 118.9,
                acd_estimado: 5.0,
                rango_dioptrias_min: 6.0,
                rango_dioptrias_max: 30.0,
                paso_dioptrias: 0.5,
                admite_toricos: false,
                apto_sulcus: false,
                descripcion: '',
                activo: true
              })
              setMostrandoFormFamilia(true)
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition transform hover:scale-[1.02]"
          >
            <Plus size={15} />
            <span>+ Nueva Familia</span>
          </button>
        </div>
      </div>

      {/* MENSAJES DE ESTADO */}
      {mensajeExito && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} />
          <span>{mensajeExito}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-rose-200/20 rounded-lg">
            <X size={14} />
          </button>
        </div>
      )}

      {/* SELECTOR RESPONSIVE DE VISTA EN TABLETS Y CELULARES (< LG) */}
      <div className="flex lg:hidden items-center p-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-[var(--border)] gap-1">
        <button
          type="button"
          onClick={() => setVistaMovil('familias')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            vistaMovil === 'familias'
              ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
              : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
          }`}
        >
          <Layers size={14} />
          <span>Familias ({familiasFiltradas.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setVistaMovil('graduaciones')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            vistaMovil === 'graduaciones'
              ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
              : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
          }`}
        >
          <Barcode size={14} />
          <span>Graduaciones & Stock ({itemsDeFamiliaActiva.length})</span>
        </button>
      </div>

      {/* 2. LAYOUT MASTER-DETAIL FLUIDO (GRID ADAPTATIVO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ==================================================================== */}
        {/* PANEL IZQUIERDO: LISTA DE FAMILIAS CLÍNICAS (COL-SPAN-4 / 2XL:COL-SPAN-3) */}
        {/* ==================================================================== */}
        <div className={`lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-4 ${vistaMovil === 'familias' ? 'block' : 'hidden lg:block'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[var(--secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} />
              <span>Familias Clínicas ({familiasFiltradas.length})</span>
            </h3>
          </div>

          {/* Filtro por Marca & Búsqueda */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={filtroFamiliaSearch}
                onChange={(e) => setFiltroFamiliaSearch(e.target.value)}
                placeholder="Buscar por modelo o marca..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-2xl text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Chips de Marca */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              <button
                type="button"
                onClick={() => setFiltroMarca('ALL')}
                className={`px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                  filtroMarca === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] hover:bg-slate-200'
                }`}
              >
                Todas
              </button>
              {marcasDisponibles.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFiltroMarca(m)}
                  className={`px-2.5 py-1 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                    filtroMarca === m
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Tarjetas de Familias */}
          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {cargando ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
                Cargando familias...
              </div>
            ) : familiasFiltradas.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-[var(--border)] rounded-2xl">
                No se encontraron familias clínicas.
              </div>
            ) : (
              familiasFiltradas.map((f) => {
                const esSeleccionada = f.id === familiaActiva?.id
                const conteoGtins = itemsGtin.filter((it) => it.modelo_lio_id === f.id).length
                const stockTotal = itemsGtin
                  .filter((it) => it.modelo_lio_id === f.id)
                  .reduce((acc, it) => acc + (it.stock_total || it.stock_quirofano || 0), 0)

                return (
                  <div
                    key={f.id}
                    onClick={() => {
                      setFamiliaSeleccionadaId(f.id!)
                      setMostrandoAltaGtin(false)
                      setVistaMovil('graduaciones')
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none relative group ${
                      esSeleccionada
                        ? 'bg-blue-500/10 border-blue-500/60 shadow-md ring-1 ring-blue-500/40'
                        : 'bg-white dark:bg-slate-900/60 border-[var(--border)] hover:border-blue-400/50 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-700 dark:text-slate-300">
                            {f.marca}
                          </span>
                          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                            {f.tipo_optica}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[var(--foreground)] tracking-tight">
                          {f.modelo}
                        </h4>
                        <p className="text-[11px] text-[var(--secondary)]">
                          Constante A: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{f.constante_a}</span>
                          {f.acd_estimado ? ` • ACD: ${f.acd_estimado} mm` : ''}
                        </p>
                      </div>

                      {/* Botones de acción rápida en la tarjeta */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFamiliaEnEdicion({ ...f })
                            setMostrandoFormFamilia(true)
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                          title="Editar parámetros de la familia"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEliminarFamilia(f.id)
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                          title="Eliminar familia"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Footer de la tarjeta con badges de GTINs y Stock */}
                    <div className="mt-2.5 pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <Barcode size={12} />
                        <span>{conteoGtins} Graduaciones</span>
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 ${
                          stockTotal > 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Package size={11} />
                        <span>Stock: {stockTotal} un</span>
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* PANEL DERECHO: DETALLE DE FAMILIA & GRADUACIONES EN VIVO (COL-SPAN-8 / 2XL:COL-SPAN-9) */}
        {/* ==================================================================== */}
        <div className={`lg:col-span-8 xl:col-span-8 2xl:col-span-9 space-y-4 ${vistaMovil === 'graduaciones' ? 'block' : 'hidden lg:block'}`}>
          {familiaActiva ? (
            <div className="space-y-4">
              {/* Botón Volver a Familias en Tablets / Celulares */}
              <div className="lg:hidden flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => setVistaMovil('familias')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-blue-600 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Volver a Lista de Familias</span>
                </button>
                <span className="text-[11px] font-mono text-[var(--secondary)]">
                  {familiaActiva.marca} • {familiaActiva.modelo}
                </span>
              </div>

              {/* HERO CARD DE LA FAMILIA SELECCIONADA */}
              <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-black text-xs">
                        {familiaActiva.marca}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs">
                        {familiaActiva.tipo_optica}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-mono font-bold text-xs">
                        Constante A: {familiaActiva.constante_a}
                      </span>
                      {familiaActiva.admite_toricos && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                          Admite Tóricos (T2-T9)
                        </span>
                      )}
                      {familiaActiva.apto_sulcus && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                          Apto Sulcus
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-[var(--foreground)] mt-1.5 tracking-tight">
                      {familiaActiva.modelo}
                    </h3>
                    {familiaActiva.descripcion && (
                      <p className="text-xs text-[var(--secondary)] mt-0.5">
                        {familiaActiva.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Acciones de la Familia */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleRefrescarStockFamilia(itemsDeFamiliaActiva)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 transition cursor-pointer border border-[var(--border)]"
                      title="Refrescar existencias y lotes de todas las graduaciones de esta familia"
                    >
                      <RefreshCw size={13} className="text-blue-500" />
                      <span>Refrescar Stock</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMostrandoAltaGtin(!mostrandoAltaGtin)}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{mostrandoAltaGtin ? 'Cerrar Formulario' : '+ Vincular Blíster GTIN'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* FORMULARIO IN-SITU PARA VINCULAR BLÍSTER / GTIN */}
              {mostrandoAltaGtin && (
                <form
                  onSubmit={handleGuardarGtinIndividual}
                  className="p-4 md:p-5 rounded-3xl bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-500/40 space-y-4 animate-fade-in"
                >
                  <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800/40 pb-2">
                    <div className="flex items-center gap-2">
                      <Barcode size={18} className="text-blue-600" />
                      <h4 className="text-xs font-black text-[var(--foreground)] uppercase tracking-wide">
                        Vincular Graduación / Blíster a {familiaActiva.modelo}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMostrandoAltaGtin(false)}
                      className="p-1 text-slate-400 hover:text-[var(--foreground)] rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Búsqueda en Geclisa o Entrada de GTIN */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[11px] font-black text-[var(--foreground)]">
                        Código de Blíster (GTIN-14) o Búsqueda en Geclisa *
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={scannerInput}
                          onChange={(e) => {
                            const val = e.target.value
                            setScannerInput(val)
                            const { gtin } = extractGtinFromBarcode(val)
                            validarUnicidadGtin(gtin)
                          }}
                          placeholder="Escanea el código de barras o ingresa el GTIN / SKU..."
                          className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] font-mono text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          disabled={buscandoGeclisa || !scannerInput.trim()}
                          onClick={() => handleBuscarEnGeclisa(scannerInput)}
                          className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[var(--foreground)] font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {buscandoGeclisa ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                          <span>Buscar en Geclisa</span>
                        </button>
                      </div>

                      {/* Resultados del Autocomplete de Geclisa */}
                      {geclisaResultados.length > 0 && (
                        <div className="mt-1.5 p-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl space-y-1 max-h-40 overflow-y-auto shadow-lg">
                          <p className="text-[10px] font-bold text-blue-600">Coincidencias en Geclisa (clic para autocompletar):</p>
                          {geclisaResultados.map((el) => (
                            <button
                              key={el.eleId}
                              type="button"
                              onClick={() => handleSeleccionarElementoGeclisa(el)}
                              className="w-full text-left p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-xs flex items-center justify-between"
                            >
                              <span className="font-bold truncate max-w-xs">{el.eleNombre}</span>
                              <span className="font-mono text-[10px] text-slate-500">Cod: {el.eleCod} (#{el.eleId})</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Alerta de duplicado */}
                      {gtinDuplicadoInfo?.duplicado && (
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-[11px] font-bold flex items-center gap-1.5">
                          <AlertCircle size={14} />
                          <span>Este GTIN ya se encuentra registrado bajo la familia <b>{gtinDuplicadoInfo.familia}</b>.</span>
                        </div>
                      )}
                    </div>

                    {/* Dioptría */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-[var(--foreground)]">Dioptría Esférica *</label>
                      <input
                        type="number"
                        step="0.25"
                        value={gtinDioptria}
                        onChange={(e) => setGtinDioptria(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] font-mono font-bold text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="21.50"
                      />
                    </div>

                    {/* Toricidad */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-[var(--foreground)]">Cilindro Tórico</label>
                        <label className={`flex items-center gap-1.5 text-[11px] font-bold ${
                          familiaActiva.admite_toricos ? 'text-slate-600 dark:text-slate-400 cursor-pointer' : 'text-slate-400 opacity-60 cursor-not-allowed'
                        }`}>
                          <input
                            type="checkbox"
                            checked={familiaActiva.admite_toricos ? gtinEsTorico : false}
                            disabled={!familiaActiva.admite_toricos}
                            onChange={(e) => setGtinEsTorico(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Es Tórico</span>
                        </label>
                      </div>
                      <select
                        value={gtinToricoValor}
                        disabled={!familiaActiva.admite_toricos || !gtinEsTorico}
                        onChange={(e) => setGtinToricoValor(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {TORICOS_OPCIONES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      {!familiaActiva.admite_toricos && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block pt-0.5">
                          ⚠️ Familia configurada como puramente esférica.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200 dark:border-blue-800/40">
                    <button
                      type="button"
                      onClick={() => setMostrandoAltaGtin(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoGtin}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
                    >
                      {guardandoGtin ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      <span>Vincular Graduación</span>
                    </button>
                  </div>
                </form>
              )}

              {/* BARRA DE FILTRO DE GRADUACIONES */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={filtroDioptriaSearch}
                    onChange={(e) => setFiltroDioptriaSearch(e.target.value)}
                    placeholder="Filtrar por dioptría o GTIN..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <span className="text-[11px] font-bold text-[var(--secondary)]">
                  Mostrando {itemsDeFamiliaActiva.length} graduaciones
                </span>
              </div>

              {/* TABLA DE GRADUACIONES & STOCK EN VIVO */}
              <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black text-[var(--secondary)] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Dioptría</th>
                        <th className="py-2.5 px-3">Tórico</th>
                        <th className="py-2.5 px-3">GTIN / Blíster</th>
                        <th className="py-2.5 px-3">Nombre Geclisa</th>
                        <th className="py-2.5 px-3">Stock Real (Geclisa)</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-medium">
                      {cargandoItems ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                            <Loader2 size={18} className="animate-spin mx-auto mb-1 text-blue-500" />
                            Cargando graduaciones...
                          </td>
                        </tr>
                      ) : itemsDeFamiliaActiva.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                            No hay graduaciones registradas para esta familia aún. Usa <b>+ Vincular Blíster GTIN</b> o la biblioteca global.
                          </td>
                        </tr>
                      ) : (
                        itemsDeFamiliaActiva.map((it) => {
                          const stockTotal = it.stock_total ?? it.stock_quirofano ?? 0
                          const tieneStock = stockTotal > 0
                          const estaAbiertoPopover = popoverStockGtin === it.id

                          return (
                            <tr key={it.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                              {/* Dioptría */}
                              <td className="py-2.5 px-3 font-mono font-black text-blue-600 dark:text-blue-400 text-xs whitespace-nowrap">
                                +{Number(it.dioptria).toFixed(2)} D
                              </td>

                              {/* Tórico */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {it.es_torico && it.torico_valor ? (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                                    {it.torico_valor}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Esférico</span>
                                )}
                              </td>

                              {/* GTIN */}
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                                {it.geclisa_ele_cod || 'S/D'}
                              </td>

                              {/* Nombre Geclisa */}
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[240px] xl:max-w-[400px] 2xl:max-w-[600px]" title={it.geclisa_nombre}>
                                {it.geclisa_nombre}
                              </td>

                              {/* STOCK REAL GECLISA CON POPOVER INTERACTIVO */}
                              <td className="py-2.5 px-3 whitespace-nowrap relative">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setPopoverStockGtin(estaAbiertoPopover ? null : it.id)}
                                    className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition cursor-pointer border ${
                                      tieneStock
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-200'
                                    }`}
                                  >
                                    <Package size={12} />
                                    <span>{tieneStock ? `Total: ${stockTotal} un` : 'Sin Stock (0 un)'}</span>
                                    <ChevronDown size={11} className="opacity-70" />
                                  </button>

                                  {/* Botón Refrescar Item */}
                                  <button
                                    type="button"
                                    disabled={it.stock_cargando}
                                    onClick={() => it.geclisa_ele_id && handleConsultarStockGtin(it.id, it.geclisa_ele_id)}
                                    className="p-1 text-slate-400 hover:text-blue-500 rounded-md transition"
                                    title="Consultar stock en vivo en Geclisa"
                                  >
                                    <RefreshCw size={12} className={it.stock_cargando ? 'animate-spin text-blue-500' : ''} />
                                  </button>
                                </div>

                                {/* POPOVER FLOTANTE CON EL DESGLOSE */}
                                {estaAbiertoPopover && (
                                  <div className="absolute top-full left-3 z-30 mt-1.5 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-[var(--border)] shadow-xl text-xs space-y-2 w-64 animate-scale-in">
                                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
                                      <span className="font-black text-[var(--foreground)]">Stock Multidepósito</span>
                                      <button onClick={() => setPopoverStockGtin(null)} className="text-slate-400 hover:text-slate-600">
                                        <X size={12} />
                                      </button>
                                    </div>

                                    <div className="space-y-1.5 text-[11px]">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-500">🏢 Farmacia (Dep 4):</span>
                                        <span className="font-bold text-cyan-600 dark:text-cyan-400">{it.stock_farmacia || 0} un</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-500">🏥 Quirófano (Dep 1):</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{it.stock_quirofano || 0} un</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-500">📦 Consignación (Dep 3):</span>
                                        <span className="font-bold text-purple-600 dark:text-purple-400">{it.stock_consignacion || 0} un</span>
                                      </div>
                                    </div>

                                    {/* Lotes de Farmacia / Quirófano si existen */}
                                    {((it.lotes_farmacia && it.lotes_farmacia.length > 0) || (it.lotes_quirofano && it.lotes_quirofano.length > 0)) && (
                                      <div className="pt-1.5 border-t border-[var(--border)] space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 block">Lotes Físicos:</span>
                                        {[...(it.lotes_quirofano || []), ...(it.lotes_farmacia || [])].map((lot, lIdx) => (
                                          <div key={lIdx} className="text-[10px] font-mono text-slate-600 dark:text-slate-300 flex justify-between">
                                            <span>Lote: {lot.lote}</span>
                                            <span>Cant: {lot.cantidad}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Acciones */}
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleEliminarItemGtin(it.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Desvincular GTIN"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 border border-dashed border-[var(--border)] rounded-3xl space-y-3">
              <Eye size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
              <h4 className="text-sm font-bold text-[var(--foreground)]">Selecciona una Familia Clínica</h4>
              <p className="text-xs text-[var(--secondary)] max-w-sm mx-auto">
                Haz clic en cualquier familia de la columna izquierda para explorar sus graduaciones, código de blíster y stock real en Geclisa.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* FORMULARIO MODAL PARA CREAR O EDITAR FAMILIA */}
      {/* ==================================================================== */}
      {mostrandoFormFamilia && familiaEnEdicion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0b1329] border border-[var(--border)] rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600 text-white font-bold">
                  {familiaEnEdicion.id ? <Edit2 size={16} /> : <Plus size={16} />}
                </div>
                <h3 className="text-sm font-black text-[var(--foreground)]">
                  {familiaEnEdicion.id ? 'Editar Familia Clínica' : 'Nueva Familia Clínica de LIO'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMostrandoFormFamilia(false)}
                className="p-1 text-slate-400 hover:text-[var(--foreground)]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardarFamilia} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Marca *</label>
                  <input
                    type="text"
                    required
                    value={familiaEnEdicion.marca}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, marca: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl font-bold text-[var(--foreground)]"
                    placeholder="Ej: Alcon, Zeiss, J&J..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Nombre del Modelo *</label>
                  <input
                    type="text"
                    required
                    value={familiaEnEdicion.modelo}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, modelo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl font-bold text-[var(--foreground)]"
                    placeholder="Ej: Clareon CNA0T0..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Tipo Óptica *</label>
                  <select
                    value={familiaEnEdicion.tipo_optica}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, tipo_optica: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl font-bold text-[var(--foreground)]"
                  >
                    {TIPOS_OPTICA.map((to) => (
                      <option key={to} value={to}>{to}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Constante A *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={familiaEnEdicion.constante_a}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, constante_a: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl font-bold text-[var(--foreground)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">ACD Estimado (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={familiaEnEdicion.acd_estimado || 5.0}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, acd_estimado: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl font-bold text-[var(--foreground)]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={familiaEnEdicion.admite_toricos || false}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, admite_toricos: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Admite Tóricos (T2-T9)</span>
                </label>
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={familiaEnEdicion.apto_sulcus || false}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, apto_sulcus: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Apto para Sulcus</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[var(--secondary)]">Descripción / Notas Clínicas</label>
                <textarea
                  rows={2}
                  value={familiaEnEdicion.descripcion || ''}
                  onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, descripcion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-[var(--border)] rounded-xl text-[var(--foreground)]"
                  placeholder="Material hidrofóbico, libre de glistenings..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setMostrandoFormFamilia(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoFamilia}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center gap-1.5 shadow-sm"
                >
                  {guardandoFamilia ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{familiaEnEdicion.id ? 'Guardar Cambios' : 'Crear Familia'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DRAWER LATERAL: CATÁLOGO MAESTRO GLOBAL & STICKERS (3.894 SKUs) */}
      {/* ==================================================================== */}
      <AlconCatalogModal
        abierto={mostrandoModalCatalogoAlcon}
        onCerrar={() => {
          setMostrandoModalCatalogoAlcon(false)
          fetchFamilias()
          fetchItemsGtin()
        }}
      />
    </div>
  )
}
