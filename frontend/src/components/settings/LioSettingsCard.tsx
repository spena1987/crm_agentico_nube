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
  Building2,
  Compass,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle
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
  modelos_lio?: {
    id: string
    marca: string
    modelo: string
    tipo_optica: string
    constante_a?: number
  }
}

const TIPOS_OPTICA = [
  'Monofocal Asférico',
  'Monofocal Esférico',
  'Monofocal Plus (Visión Intermedia)',
  'Trifocal',
  'EDOF (Rango Extendido)',
  'Tórico Monofocal',
  'Tórico Multifocal',
  'Sulcus (3 Piezas)',
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

// Función auxiliar para parsear tramas GS1 DataMatrix de blísteres de LIO
function parsearGs1DataMatrix(rawInput: string): { gtin: string; lote?: string; fechaVto?: string; serie?: string } {
  const clean = rawInput.trim()
  
  // Formato GS1 con paréntesis: (01)07612797123456(17)261231(10)LOT123(21)SN456
  const matchParen = clean.match(/\(01\)(\d{13,14})/)
  if (matchParen && matchParen[1]) {
    const res: any = { gtin: matchParen[1] }
    const matchLot = clean.match(/\(10\)([^()]+)/)
    if (matchLot) res.lote = matchLot[1]
    const matchExp = clean.match(/\(17\)(\d{6})/)
    if (matchExp) res.fechaVto = matchExp[1]
    const matchSn = clean.match(/\(21\)([^()]+)/)
    if (matchSn) res.serie = matchSn[1]
    return res
  }

  // Formato crudo GS1 sin paréntesis que empieza con 01: 010761279712345617...
  if (clean.startsWith('01') && clean.length >= 16 && /^\d+$/.test(clean.slice(0, 16))) {
    const gtin = clean.slice(2, 16)
    return { gtin }
  }

  return { gtin: clean }
}

export default function LioSettingsCard() {
  // Pestaña activa: 'familias' | 'gtins'
  const [subTabActiva, setSubTabActiva] = useState<'familias' | 'gtins'>('familias')

  // Datos
  const [familias, setFamilias] = useState<ModeloLio[]>([])
  const [itemsGtin, setItemsGtin] = useState<ModeloLioItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoItems, setCargandoItems] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // ====================================================================
  // ESTADOS SUBPESTAÑA 1: GESTOR DE FAMILIAS
  // ====================================================================
  const [filtroFamiliaSearch, setFiltroFamiliaSearch] = useState('')
  const [filtroFamiliaOptica, setFiltroFamiliaOptica] = useState('ALL')
  const [mostrandoFormFamilia, setMostrandoFormFamilia] = useState(false)
  const [familiaEnEdicion, setFamiliaEnEdicion] = useState<ModeloLio | null>(null)
  const [guardandoFamilia, setGuardandoFamilia] = useState(false)

  // ====================================================================
  // ESTADOS SUBPESTAÑA 2: ESCÁNER / GESTOR DE GTINs
  // ====================================================================
  const [filtroGtinSearch, setFiltroGtinSearch] = useState('')
  const [filtroGtinFamilia, setFiltroGtinFamilia] = useState('ALL')
  const [mostrandoAltaGtin, setMostrandoAltaGtin] = useState(false)
  const [scannerInput, setScannerInput] = useState('')
  const [buscandoGeclisa, setBuscandoGeclisa] = useState(false)
  const [geclisaResultados, setGeclisaResultados] = useState<any[]>([])
  const [elementoGeclisaSeleccionado, setElementoGeclisaSeleccionado] = useState<any | null>(null)

  // Validación de Unicidad de GTIN
  const [gtinDuplicadoInfo, setGtinDuplicadoInfo] = useState<any | null>(null)
  const [validandoGtin, setValidandoGtin] = useState(false)

  // Parámetros para registrar el GTIN
  const [gtinFamiliaId, setGtinFamiliaId] = useState<string>('')
  const [gtinDioptria, setGtinDioptria] = useState<string>('21.50')
  const [gtinEsTorico, setGtinEsTorico] = useState<boolean>(false)
  const [gtinToricoValor, setGtinToricoValor] = useState<string>('T3 (Cil 1.50 D)')
  const [guardandoGtin, setGuardandoGtin] = useState(false)

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
        if (data.modelos.length > 0 && !gtinFamiliaId) {
          setGtinFamiliaId(data.modelos[0].id)
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
      console.error('Error cargando GTINs:', err)
    } finally {
      setCargandoItems(false)
    }
  }

  useEffect(() => {
    fetchFamilias()
    fetchItemsGtin()
  }, [])

  // ====================================================================
  // BÚSQUEDA Y PARSER EN GECLISA (SUBPESTAÑA 2)
  // ====================================================================
  useEffect(() => {
    if (!scannerInput.trim() || scannerInput.length < 2) {
      setGeclisaResultados([])
      setGtinDuplicadoInfo(null)
      return
    }

    const { gtin } = parsearGs1DataMatrix(scannerInput)

    const timer = setTimeout(async () => {
      try {
        setBuscandoGeclisa(true)

        // 1. Validar si el GTIN ya existe en el CRM
        if (gtin.length >= 4) {
          setValidandoGtin(true)
          const resVal = await fetch(`${BACKEND_URL}/api/modelos-lio/validar-gtin?gtin=${encodeURIComponent(gtin)}`)
          const dataVal = await resVal.json()
          if (resVal.ok && dataVal.success && dataVal.existe) {
            setGtinDuplicadoInfo(dataVal.item)
          } else {
            setGtinDuplicadoInfo(null)
          }
          setValidandoGtin(false)
        }

        // 2. Buscar en Geclisa por el término / GTIN
        const res = await fetch(`${BACKEND_URL}/api/geclisa/elementos/buscar?q=${encodeURIComponent(gtin)}`)
        const data = await res.json()
        if (res.ok && data.success) {
          setGeclisaResultados(data.elementos || [])
        } else {
          setGeclisaResultados([])
        }
      } catch (e) {
        console.error('Error en búsqueda de Geclisa:', e)
        setGeclisaResultados([])
      } finally {
        setBuscandoGeclisa(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [scannerInput])

  const handleSeleccionarElementoGeclisa = (el: any) => {
    setElementoGeclisaSeleccionado(el)
    setGeclisaResultados([])

    // Auto-detectar dioptría si está en el nombre
    const match = el.eleNombre?.match(/(\d{1,2}\.?\d{0,2})\s*(D|DIOP|POT)?/i)
    if (match && match[1]) {
      const val = parseFloat(match[1])
      if (val >= 5 && val <= 35) {
        setGtinDioptria(val.toFixed(2))
      }
    }

    // Auto-sugerir familia si coincide con alguna existente
    const nClean = (el.eleNombre || '').toUpperCase()
    const famMatch = familias.find((f) => nClean.includes(f.modelo.toUpperCase()) || nClean.includes(f.marca.toUpperCase()))
    if (famMatch) {
      setGtinFamiliaId(famMatch.id!)
    }
  }

  // ====================================================================
  // GUARDAR FAMILIA (SUBPESTAÑA 1)
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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(familiaEnEdicion)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(esEdit ? '✔ Familia actualizada correctamente.' : '✔ Nueva familia creada.')
        setMostrandoFormFamilia(false)
        setFamiliaEnEdicion(null)
        fetchFamilias()
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
        setMensajeExito('✔ Familia eliminada.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar familia.')
    }
  }

  // ====================================================================
  // GUARDAR GTIN EN CRM (SUBPESTAÑA 2)
  // ====================================================================
  const handleGuardarGtin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!elementoGeclisaSeleccionado) {
      setError('Selecciona un elemento de Geclisa.')
      return
    }

    if (!gtinFamiliaId) {
      setError('Selecciona una familia para vincular el GTIN.')
      return
    }

    const diopNum = parseFloat(gtinDioptria)
    if (isNaN(diopNum)) {
      setError('Ingresa una dioptría válida.')
      return
    }

    try {
      setGuardandoGtin(true)
      setError(null)

      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/${gtinFamiliaId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geclisa_ele_id: elementoGeclisaSeleccionado.eleId,
          geclisa_ele_cod: elementoGeclisaSeleccionado.eleCod,
          geclisa_nombre: elementoGeclisaSeleccionado.eleNombre,
          dioptria: diopNum,
          es_torico: gtinEsTorico,
          torico_valor: gtinEsTorico ? gtinToricoValor : null
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'No se pudo guardar el GTIN (posible duplicado).')
      }

      setMensajeExito(`✔ GTIN ${elementoGeclisaSeleccionado.eleCod} (+${diopNum.toFixed(2)} D) registrado con éxito.`)
      setElementoGeclisaSeleccionado(null)
      setScannerInput('')
      setMostrandoAltaGtin(false)
      fetchItemsGtin()
      fetchFamilias()
      setTimeout(() => setMensajeExito(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Error al guardar el GTIN.')
    } finally {
      setGuardandoGtin(false)
    }
  }

  const handleEliminarGtin = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Deseas desvincular este código GTIN del CRM?')) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/items/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItemsGtin((prev) => prev.filter((it) => it.id !== id))
        fetchFamilias()
      }
    } catch (e) {
      console.error('Error eliminando GTIN:', e)
    }
  }

  const handleConsultarStockGtin = async (item: ModeloLioItem) => {
    try {
      setItemsGtin((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, consultando_stock: true } : it))
      )
      const res = await fetch(`${BACKEND_URL}/api/geclisa/elementos/${item.geclisa_ele_id}/stock-lotes`)
      const data = await res.json()
      if (res.ok && data.success && data.resumen) {
        const r = data.resumen
        setItemsGtin((prev) =>
          prev.map((it) =>
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
        )
      }
    } catch (e) {
      setItemsGtin((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, consultando_stock: false } : it))
      )
    }
  }

  // Filtrado de Familias
  const familiasFiltradas = useMemo(() => {
    return familias.filter((f) => {
      const matchSearch =
        !filtroFamiliaSearch.trim() ||
        f.marca.toLowerCase().includes(filtroFamiliaSearch.toLowerCase()) ||
        f.modelo.toLowerCase().includes(filtroFamiliaSearch.toLowerCase()) ||
        (f.descripcion && f.descripcion.toLowerCase().includes(filtroFamiliaSearch.toLowerCase()))
      const matchOptica = filtroFamiliaOptica === 'ALL' || f.tipo_optica === filtroFamiliaOptica
      return matchSearch && matchOptica
    })
  }, [familias, filtroFamiliaSearch, filtroFamiliaOptica])

  // Filtrado de GTINs
  const itemsGtinFiltrados = useMemo(() => {
    return itemsGtin.filter((it) => {
      const matchSearch =
        !filtroGtinSearch.trim() ||
        it.geclisa_ele_cod.toLowerCase().includes(filtroGtinSearch.toLowerCase()) ||
        (it.geclisa_nombre && it.geclisa_nombre.toLowerCase().includes(filtroGtinSearch.toLowerCase())) ||
        (it.modelos_lio && it.modelos_lio.modelo.toLowerCase().includes(filtroGtinSearch.toLowerCase()))
      const matchFam = filtroGtinFamilia === 'ALL' || it.modelo_lio_id === filtroGtinFamilia
      return matchSearch && matchFam
    })
  }, [itemsGtin, filtroGtinSearch, filtroGtinFamilia])

  return (
    <div className="bg-[var(--card)] p-5 md:p-6 rounded-3xl border border-[var(--border)] space-y-6 shadow-sm animate-fade-in">
      {/* 1. CABECERA & SELECTOR DE PESTAÑAS (OPCIÓN 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 rounded-2xl border border-cyan-500/30">
            <Eye size={26} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--foreground)] tracking-tight">
              Lentes Intraoculares (LIO) & Trazabilidad GTIN
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Administra familias clínicas, constantes biométricas y vincula códigos GTIN de Geclisa para escáner QR.
            </p>
          </div>
        </div>

        {/* Botones Switch de Pestañas */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={() => setSubTabActiva('familias')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
              subTabActiva === 'familias'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-[var(--border)]'
                : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Building2 size={15} />
            <span>1. Familias Clínicas ({familias.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTabActiva('gtins')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
              subTabActiva === 'gtins'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-[var(--border)]'
                : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Barcode size={15} />
            <span>2. Catálogo de GTINs Geclisa ({itemsGtin.length})</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}
      {mensajeExito && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span className="font-bold">{mensajeExito}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBPESTAÑA 1: GESTOR DE FAMILIAS Y CONSTANTES BIOMÉTRICAS           */}
      {/* ==================================================================== */}
      {subTabActiva === 'familias' && (
        <div className="space-y-5 animate-fade-in">
          {/* Barra de Acciones de Familias */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar familia o marca..."
                  value={filtroFamiliaSearch}
                  onChange={(e) => setFiltroFamiliaSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={filtroFamiliaOptica}
                onChange={(e) => setFiltroFamiliaOptica(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500 font-semibold shrink-0"
              >
                <option value="ALL">Todas las Ópticas</option>
                {TIPOS_OPTICA.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setFamiliaEnEdicion({
                  marca: '',
                  modelo: '',
                  tipo_optica: 'Monofocal Asférico',
                  constante_a: 118.9,
                  acd_estimado: 5.0,
                  rango_dioptrias_min: 6.0,
                  rango_dioptrias_max: 30.0,
                  paso_dioptrias: 0.5,
                  admite_toricos: false,
                  apto_sulcus: false,
                  activo: true
                })
                setMostrandoFormFamilia(true)
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>+ Nueva Familia de LIO</span>
            </button>
          </div>

          {/* Modal / Formulario de Edición de Familia */}
          {mostrandoFormFamilia && familiaEnEdicion && (
            <form
              onSubmit={handleGuardarFamilia}
              className="p-5 md:p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/70 border-2 border-blue-500/50 space-y-4 shadow-lg animate-scale-in"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-blue-600" />
                  <h4 className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                    {familiaEnEdicion.id ? 'Editar Familia Clínica de LIO' : 'Configurar Nueva Familia de LIO'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrandoFormFamilia(false)}
                  className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-xl"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-[11px] font-bold text-[var(--secondary)]">Marca / Laboratorio *</label>
                  <input
                    type="text"
                    value={familiaEnEdicion.marca}
                    onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, marca: e.target.value })}
                    placeholder="Ej: Alcon, Johnson & Johnson, Rayner..."
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
                    placeholder="Ej: AcrySof IQ PanOptix, Clareon Vivity..."
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

              {/* Parámetros Biométricos */}
              <div className="p-4 rounded-2xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/50 space-y-3">
                <span className="text-[11px] font-black text-cyan-900 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass size={13} className="text-cyan-600" />
                  <span>Constantes Ópticas para Cálculo Biométrico (/calculo-lio)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--secondary)]">Constante A Nominal</label>
                    <input
                      type="number"
                      step="0.01"
                      value={familiaEnEdicion.constante_a || 118.9}
                      onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, constante_a: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-black text-cyan-600 dark:text-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--secondary)]">ACD Estimado (mm)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={familiaEnEdicion.acd_estimado || 5.0}
                      onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, acd_estimado: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--secondary)]">Rango Dioptrías (Mín - Máx)</label>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Mín"
                        value={familiaEnEdicion.rango_dioptrias_min || 6}
                        onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, rango_dioptrias_min: parseFloat(e.target.value) || 6 })}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-center"
                      />
                      <span className="text-xs text-slate-400">-</span>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Máx"
                        value={familiaEnEdicion.rango_dioptrias_max || 30}
                        onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, rango_dioptrias_max: parseFloat(e.target.value) || 30 })}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--secondary)]">Paso Dióptrico</label>
                    <select
                      value={familiaEnEdicion.paso_dioptrias || 0.5}
                      onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, paso_dioptrias: parseFloat(e.target.value) || 0.5 })}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none"
                    >
                      <option value={0.5}>0.50 D (Estándar)</option>
                      <option value={0.25}>0.25 D (Alta Precisión)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2 border-t border-cyan-200/60 dark:border-cyan-800/40">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(familiaEnEdicion.admite_toricos)}
                      onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, admite_toricos: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                    />
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">Admite Variantes Tórcas (Cilindros T2-T9)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(familiaEnEdicion.apto_sulcus)}
                      onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, apto_sulcus: e.target.checked })}
                      className="w-4 h-4 rounded text-purple-600 accent-purple-600"
                    />
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-300">Apto para Implante en Sulcus</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--secondary)]">Descripción / Notas Clínicas</label>
                <input
                  type="text"
                  value={familiaEnEdicion.descripcion || ''}
                  onChange={(e) => setFamiliaEnEdicion({ ...familiaEnEdicion, descripcion: e.target.value })}
                  placeholder="Acrílico hidrofóbico, filtro luz azul, diseño háptico..."
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setMostrandoFormFamilia(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoFamilia}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2"
                >
                  {guardandoFamilia ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Guardar Familia</span>
                </button>
              </div>
            </form>
          )}

          {/* Grilla de Familias */}
          {cargando ? (
            <div className="p-12 text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-blue-600" />
              <span>Cargando familias de LIO...</span>
            </div>
          ) : familiasFiltradas.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-3xl space-y-2">
              <Building2 size={28} className="mx-auto text-slate-400 opacity-50" />
              <p className="font-bold text-sm text-[var(--foreground)]">No hay familias configuradas</p>
              <p className="text-[11px]">Usa el botón superior para dar de alta tu primera familia de LIO.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {familiasFiltradas.map((f) => (
                <div
                  key={f.id}
                  className="p-5 rounded-3xl border border-[var(--border)] bg-slate-50/40 dark:bg-slate-800/30 flex flex-col justify-between gap-4 hover:border-blue-400/60 transition shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {f.marca}
                      </span>
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        Constante A: {f.constante_a || 118.9}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-[var(--foreground)] tracking-tight">
                      {f.modelo}
                    </h3>

                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {f.tipo_optica}
                    </p>

                    {f.descripcion && (
                      <p className="text-[11px] text-[var(--secondary)] line-clamp-2">{f.descripcion}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)] text-[10px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        📦 {f.items_count ?? 0} GTINs cargados
                      </span>
                      {f.admite_toricos && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                          Tóricos OK
                        </span>
                      )}
                      {f.apto_sulcus && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                          Sulcus
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGtinFamiliaId(f.id!)
                        setSubTabActiva('gtins')
                        setMostrandoAltaGtin(true)
                        setScannerInput('')
                        setElementoGeclisaSeleccionado(null)
                      }}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition"
                    >
                      <Barcode size={13} />
                      <span>+ Vincular GTINs</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFamiliaEnEdicion({ ...f })
                          setMostrandoFormFamilia(true)
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Editar familia"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarFamilia(f.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Eliminar familia"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBPESTAÑA 2: CATÁLOGO DE GTINs, ESCÁNER QR & STOCK GECLISA          */}
      {/* ==================================================================== */}
      {subTabActiva === 'gtins' && (
        <div className="space-y-5 animate-fade-in">
          {/* Barra de Acciones de GTINs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por código GTIN o descripción..."
                  value={filtroGtinSearch}
                  onChange={(e) => setFiltroGtinSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <select
                value={filtroGtinFamilia}
                onChange={(e) => setFiltroGtinFamilia(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500 font-bold shrink-0"
              >
                <option value="ALL">Todas las Familias ({familias.length})</option>
                {familias.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.marca} — {f.modelo}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setMostrandoAltaGtin(true)
                setScannerInput('')
                setElementoGeclisaSeleccionado(null)
                setGtinDuplicadoInfo(null)
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode size={16} />
              <span>+ Escanear / Agregar GTIN desde Geclisa</span>
            </button>
          </div>

          {/* Panel de Escáner e Importación Directa de GTIN */}
          {mostrandoAltaGtin && (
            <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-800/80 dark:to-blue-950/40 border-2 border-blue-500/50 shadow-xl space-y-4 animate-scale-in">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-600 text-white">
                    <Barcode size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                      Escanear o Buscar Código GTIN en Geclisa
                    </h4>
                    <p className="text-[11px] text-[var(--secondary)]">
                      Pistolea el código QR / DataMatrix del blíster o escribe el nombre / GTIN en Geclisa.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrandoAltaGtin(false)}
                  className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-xl"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Input con Soporte para Lector QR / DataMatrix */}
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" />
                <input
                  type="text"
                  autoFocus
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  placeholder="Pistolea el QR de la caja o escribe (ej: GALAXY, 07612797..., PANOPTIX, VIVITY)..."
                  className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[var(--card)] border-2 border-blue-300 dark:border-blue-700 text-xs md:text-sm font-mono font-bold text-[var(--foreground)] outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm"
                />
                {buscandoGeclisa && (
                  <Loader2 size={16} className="animate-spin text-blue-600 absolute right-4 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {/* Alerta de GTIN Duplicado si ya existe */}
              {gtinDuplicadoInfo && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 dark:text-amber-100 flex items-start gap-3 animate-fade-in">
                  <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-black block">
                      ⚠ Este código GTIN ya se encuentra registrado en el CRM
                    </span>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Pertenece a la familia <b>{gtinDuplicadoInfo.modelos_lio?.marca} {gtinDuplicadoInfo.modelos_lio?.modelo}</b> con graduación <b>+{Number(gtinDuplicadoInfo.dioptria).toFixed(2)} D</b> {gtinDuplicadoInfo.es_torico && `(Tórico: ${gtinDuplicadoInfo.torico_valor})`}.
                      No es necesario volver a darlo de alta.
                    </p>
                  </div>
                </div>
              )}

              {/* Resultados de Búsqueda de Geclisa */}
              {geclisaResultados.length > 0 && !elementoGeclisaSeleccionado && (
                <div className="max-h-60 overflow-y-auto rounded-2xl border border-blue-200 dark:border-blue-900 bg-[var(--card)] shadow-xl divide-y divide-[var(--border)] animate-fade-in">
                  {geclisaResultados.map((el) => (
                    <button
                      key={el.eleId}
                      type="button"
                      onClick={() => handleSeleccionarElementoGeclisa(el)}
                      className="w-full p-3 text-left text-xs hover:bg-blue-50/80 dark:hover:bg-blue-950/60 flex items-center justify-between transition gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-blue-600 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md text-[11px]">
                            GTIN: {el.eleCod}
                          </span>
                          <span className="font-extrabold text-[var(--foreground)] truncate text-xs">
                            {el.eleNombre}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--secondary)]">
                          ID Geclisa: #{el.eleId} • Tipo: {el.tipo}
                        </span>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                          Stock: {el.stockActual ?? 0} un
                        </span>
                        <span className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg text-[10px] flex items-center gap-1">
                          <span>Vincular</span>
                          <ChevronRight size={12} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Formulario de Parametrización para el GTIN */}
              {elementoGeclisaSeleccionado && (
                <form
                  onSubmit={handleGuardarGtin}
                  className="p-5 rounded-2xl bg-[var(--card)] border-2 border-emerald-500/50 space-y-4 shadow-lg animate-scale-in"
                >
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
                      Cambiar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Familia */}
                    <div>
                      <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                        Asignar a Familia Clínica *
                      </label>
                      <select
                        value={gtinFamiliaId}
                        onChange={(e) => setGtinFamiliaId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-bold text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        required
                      >
                        {familias.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.marca} — {f.modelo} (Constante A: {f.constante_a || 118.9})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dioptría */}
                    <div>
                      <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                        Dioptría Esférica para este GTIN *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setGtinDioptria((prev) => (parseFloat(prev || '20') - 0.5).toFixed(2))}
                          className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200"
                        >
                          -0.5
                        </button>
                        <input
                          type="number"
                          step="0.25"
                          value={gtinDioptria}
                          onChange={(e) => setGtinDioptria(e.target.value)}
                          className="w-full text-center py-2 px-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm font-mono font-black text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setGtinDioptria((prev) => (parseFloat(prev || '20') + 0.5).toFixed(2))}
                          className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200"
                        >
                          +0.5
                        </button>
                      </div>
                    </div>

                    {/* Toricidad */}
                    <div>
                      <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                        Variante Tórica
                      </label>
                      <div className="flex items-center gap-2 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={gtinEsTorico}
                            onChange={(e) => setGtinEsTorico(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                          />
                          <span className="text-xs font-bold text-[var(--foreground)]">Es Tórico</span>
                        </label>

                        {gtinEsTorico && (
                          <select
                            value={gtinToricoValor}
                            onChange={(e) => setGtinToricoValor(e.target.value)}
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

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setElementoGeclisaSeleccionado(null)}
                      className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoGtin}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      {guardandoGtin ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      <span>Guardar GTIN en CRM</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Tabla Consolidada de GTINs Registrados en el CRM */}
          {cargandoItems ? (
            <div className="p-12 text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-blue-600" />
              <span>Cargando catálogo de códigos GTIN...</span>
            </div>
          ) : itemsGtinFiltrados.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-3xl space-y-2">
              <Barcode size={28} className="mx-auto text-slate-400 opacity-50" />
              <p className="font-bold text-sm text-[var(--foreground)]">No hay códigos GTIN registrados</p>
              <p className="text-[11px]">Usa el botón superior para escanear o buscar artículos en Geclisa.</p>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-3xl overflow-hidden shadow-xs bg-[var(--card)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-[var(--secondary)] font-bold text-[10px] uppercase tracking-wider border-b border-[var(--border)]">
                      <th className="p-3.5">Código GTIN (Blíster)</th>
                      <th className="p-3.5">Familia / Marca</th>
                      <th className="p-3.5">Dioptría (Poder)</th>
                      <th className="p-3.5">Toricidad</th>
                      <th className="p-3.5">Descripción Oficial en Geclisa</th>
                      <th className="p-3.5">Stock Quirófano</th>
                      <th className="p-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {itemsGtinFiltrados.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono font-black text-blue-600 dark:text-blue-400 text-xs">
                          {it.geclisa_ele_cod}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-[var(--foreground)] block">
                            {it.modelos_lio?.modelo || 'Sin familia'}
                          </span>
                          <span className="text-[10px] text-[var(--secondary)]">
                            {it.modelos_lio?.marca} • {it.modelos_lio?.tipo_optica}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-black text-sm text-[var(--foreground)]">
                          +{Number(it.dioptria).toFixed(2)} D
                        </td>
                        <td className="p-3.5">
                          {it.es_torico ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px]">
                              {it.torico_valor || 'Tórico'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Esférico</span>
                          )}
                        </td>
                        <td className="p-3.5 text-[11px] text-[var(--secondary)] truncate max-w-xs" title={it.geclisa_nombre}>
                          {it.geclisa_nombre || 'N/A'}
                        </td>
                        <td className="p-3.5">
                          {it.stock_quirofano !== undefined ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                it.stock_quirofano > 0
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              }`}>
                                Q: {it.stock_quirofano} un
                              </span>
                              {(it.stock_consignacion ?? 0) > 0 && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  Consig: {it.stock_consignacion} un
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={it.consultando_stock}
                              onClick={() => handleConsultarStockGtin(it)}
                              className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {it.consultando_stock ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                              <span>Consultar Stock</span>
                            </button>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleEliminarGtin(it.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            title="Desvincular GTIN"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
