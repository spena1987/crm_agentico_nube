'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  FileSpreadsheet,
  Upload,
  Download,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  DollarSign,
  Layers,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  ArrowRight,
  FileText
} from 'lucide-react'

interface Nomenclador {
  id: string
  codigo: string
  nombre: string
  moneda_default: 'ARS' | 'USD'
  descripcion?: string
  activo: boolean
  total_practicas?: number
}

interface PracticaCatalogo {
  id: string
  nomenclador_id: string
  nomenclador_nombre: string
  nomenclador_codigo: string
  codigo: string
  nombre: string
  categoria: string
  descripcion?: string
  activo: boolean
  precio: number
  moneda: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  arancel_id?: string | null
  tiene_arancel: boolean
}
import { BACKEND_URL as API_BASE_URL } from '@/lib/api'

export default function NomencladorSettingsCard() {
  const [loading, setLoading] = useState(true)
  const [nomencladores, setNomencladores] = useState<Nomenclador[]>([])
  const [selectedNomId, setSelectedNomId] = useState<string>('all')

  // Prácticas
  const [practicas, setPracticas] = useState<PracticaCatalogo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroMoneda, setFiltroMoneda] = useState<'todas' | 'ARS' | 'USD'>('todas')
  const [filtroVigencia, setFiltroVigencia] = useState<'todas' | 'vigentes' | 'futuras' | 'sin_precio'>('todas')
  const [loadingPracticas, setLoadingPracticas] = useState(false)

  // Modales
  const [modalPracticaOpen, setModalPracticaOpen] = useState(false)
  const [editingPractica, setEditingPractica] = useState<PracticaCatalogo | null>(null)
  const [practicaForm, setPracticaForm] = useState({
    nomenclador_id: '',
    codigo: '',
    nombre: '',
    categoria: 'General',
    precio: '',
    moneda: 'ARS' as 'ARS' | 'USD',
    vigencia_desde: new Date().toISOString().split('T')[0],
    vigencia_hasta: '',
    descripcion: ''
  })

  // Importador Excel
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importNomId, setImportNomId] = useState<string>('')
  const [importModo, setImportModo] = useState<'upsert' | 'replace'>('upsert')
  const [importVigDesde, setImportVigDesde] = useState(new Date().toISOString().split('T')[0])
  const [importVigHasta, setImportVigHasta] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Feedback
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    loadNomencladores()
  }, [])

  useEffect(() => {
    loadPracticas()
  }, [selectedNomId, searchQuery])

  const loadNomencladores = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/api/nomencladores`)
      if (res.ok) {
        const data = await res.json()
        const noms = data.nomencladores || []
        setNomencladores(noms)
        if (noms.length > 0 && !importNomId) {
          setImportNomId(noms[0].id)
        }
      }
    } catch (err) {
      console.error('Error cargando nomencladores:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPracticas = async () => {
    try {
      setLoadingPracticas(true)
      const params = new URLSearchParams()
      if (selectedNomId !== 'all') params.append('nomenclador_id', selectedNomId)
      if (searchQuery.trim()) params.append('q', searchQuery.trim())

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setPracticas(data.practicas || [])
      }
    } catch (err) {
      console.error('Error cargando prácticas:', err)
    } finally {
      setLoadingPracticas(false)
    }
  }

  // Guardar / Editar Práctica
  const handleSavePractica = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!practicaForm.codigo.trim() || !practicaForm.nombre.trim() || !practicaForm.nomenclador_id) {
      setFeedback({ tipo: 'error', texto: 'Nomenclador, código y nombre son obligatorios.' })
      return
    }

    try {
      const nomElegido = nomencladores.find((n) => n.id === practicaForm.nomenclador_id)
      const monedaFinal = nomElegido ? nomElegido.moneda_default : practicaForm.moneda

      const payload = {
        nomenclador_id: practicaForm.nomenclador_id,
        codigo: practicaForm.codigo.trim().toUpperCase(),
        nombre: practicaForm.nombre.trim(),
        categoria: practicaForm.categoria.trim() || 'General',
        precio: parseFloat(practicaForm.precio) || 0.0,
        moneda: monedaFinal,
        vigencia_desde: practicaForm.vigencia_desde || new Date().toISOString().split('T')[0],
        vigencia_hasta: practicaForm.vigencia_hasta || null,
        descripcion: practicaForm.descripcion.trim()
      }

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setFeedback({ tipo: 'success', texto: 'Práctica guardada correctamente.' })
        setModalPracticaOpen(false)
        setEditingPractica(null)
        loadPracticas()
        loadNomencladores()
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error al guardar la práctica.' })
    }
  }

  // Eliminar Práctica
  const handleDeletePractica = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta prestación del catálogo?')) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setPracticas(practicas.filter((p) => p.id !== id))
        setFeedback({ tipo: 'success', texto: 'Práctica eliminada.' })
        loadNomencladores()
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error al eliminar práctica.' })
    }
  }

  // Importar Excel
  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importFile) {
      setFeedback({ tipo: 'error', texto: 'Por favor selecciona un archivo Excel (.xlsx) o CSV.' })
      return
    }
    if (!importNomId) {
      setFeedback({ tipo: 'error', texto: 'Selecciona la moneda del nomenclador (Pesos o Dólares).' })
      return
    }

    try {
      setImporting(true)
      setFeedback(null)

      const nomElegido = nomencladores.find((n) => n.id === importNomId)
      const monedaDestino = nomElegido?.moneda_default || 'ARS'

      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('nomenclador_id', importNomId)
      formData.append('modo', importModo)
      formData.append('default_moneda', monedaDestino)
      if (importVigDesde) formData.append('default_vigencia_desde', importVigDesde)
      if (importVigHasta) formData.append('default_vigencia_hasta', importVigHasta)

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/importar-excel`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({ tipo: 'success', texto: data.mensaje || 'Planilla Excel importada exitosamente.' })
        setImportFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        loadPracticas()
        loadNomencladores()
      } else {
        setFeedback({ tipo: 'error', texto: data.detail || 'Error al procesar el archivo Excel.' })
      }
    } catch (err) {
      console.error('Error importando Excel:', err)
      setFeedback({ tipo: 'error', texto: 'Error al conectar con el servidor para importar Excel.' })
    } finally {
      setImporting(false)
    }
  }

  // Filtrado en cliente
  const filteredPracticas = practicas.filter((p) => {
    if (filtroMoneda !== 'todas' && p.moneda !== filtroMoneda) return false
    const today = new Date().toISOString().split('T')[0]
    if (filtroVigencia === 'vigentes') {
      return p.tiene_arancel && (!p.vigencia_desde || p.vigencia_desde <= today) && (!p.vigencia_hasta || p.vigencia_hasta >= today)
    }
    if (filtroVigencia === 'futuras') {
      return p.tiene_arancel && p.vigencia_desde && p.vigencia_desde > today
    }
    if (filtroVigencia === 'sin_precio') {
      return !p.tiene_arancel || p.precio === 0
    }
    return true
  })

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Encabezado del Módulo */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <DollarSign className="text-emerald-600" size={22} />
              Catálogo de Nomencladores y Aranceles (Pesos y Dólares)
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-1">
              Gestiona los aranceles de tus prácticas médicas diferenciados por moneda (**Pesos ARS** y **Dólares USD**), con control de vigencias temporales e importación masiva vía Excel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`${API_BASE_URL}/api/nomenclador/descargar-plantilla`}
              download
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-[var(--border)]"
            >
              <Download size={14} /> Descargar Plantilla Excel
            </a>

            <a
              href={`${API_BASE_URL}/api/nomenclador/exportar-excel`}
              download
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-[var(--border)]"
            >
              <FileSpreadsheet size={14} /> Exportar a Excel
            </a>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 animate-scale-in ${
              feedback.tipo === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.tipo === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.texto}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold hover:underline">
              Cerrar
            </button>
          </div>
        )}

        {/* Pestañas de Moneda / Nomenclador */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedNomId('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-2 ${
              selectedNomId === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <span>Todos los Precios</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">
              {nomencladores.reduce((acc, curr) => acc + (curr.total_practicas || 0), 0)}
            </span>
          </button>

          {nomencladores.map((nom) => {
            const isUSD = nom.moneda_default === 'USD'
            return (
              <button
                key={nom.id}
                onClick={() => setSelectedNomId(nom.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                  selectedNomId === nom.id
                    ? isUSD
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{isUSD ? '🇺🇸 Nomenclador en Dólares (USD)' : '🇦🇷 Nomenclador en Pesos (ARS)'}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono font-bold">
                  {nom.total_practicas || 0} prácticas
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECCIÓN 1: IMPORTADOR MASIVO EXCEL CON VIGENCIAS */}
      {/* ==================================================================== */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <FileSpreadsheet className="text-emerald-600" size={18} />
            Importar Prácticas y Valores desde Excel
          </h3>
          <span className="text-[11px] text-slate-400">Formatos aceptados: .xlsx y .csv</span>
        </div>

        <form onSubmit={handleImportExcel} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Nomenclador / Moneda de Destino */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Moneda del Nomenclador</label>
            <select
              value={importNomId}
              onChange={(e) => setImportNomId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold outline-none focus:ring-2 focus:ring-blue-500"
            >
              {nomencladores.map((nom) => (
                <option key={nom.id} value={nom.id}>
                  {nom.moneda_default === 'USD' ? '🇺🇸 Dólares (USD)' : '🇦🇷 Pesos (ARS)'} - {nom.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Vigencia Desde */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Vigencia Desde (Inicio)</label>
            <input
              type="date"
              value={importVigDesde}
              onChange={(e) => setImportVigDesde(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Vigencia Hasta (Opcional) */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">
              Vigencia Hasta <span className="text-[10px] text-slate-400">(Opcional)</span>
            </label>
            <input
              type="date"
              value={importVigHasta}
              onChange={(e) => setImportVigHasta(e.target.value)}
              placeholder="Indefinido"
              className="w-full text-xs p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Selector de Archivo */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="hidden"
              id="excel-file-input"
            />
            <label
              htmlFor="excel-file-input"
              className="w-full text-xs p-2.5 rounded-xl border border-dashed border-blue-400 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-blue-100/50 transition truncate block text-center"
            >
              <Upload size={14} className="inline" />
              {importFile ? importFile.name : 'Seleccionar Archivo Excel'}
            </label>
          </div>

          <div className="md:col-span-3 flex items-center gap-4 pt-1">
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-400">Modo:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="modo_import"
                  value="upsert"
                  checked={importModo === 'upsert'}
                  onChange={() => setImportModo('upsert')}
                  className="text-blue-600"
                />
                <span>Actualizar precios existentes y agregar nuevas prácticas</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-amber-600 dark:text-amber-400">
                <input
                  type="radio"
                  name="modo_import"
                  value="replace"
                  checked={importModo === 'replace'}
                  onChange={() => setImportModo('replace')}
                  className="text-blue-600"
                />
                <span>Reemplazar catálogo completo</span>
              </label>
            </div>
          </div>

          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={importing || !importFile}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <Upload size={14} /> Importar Planilla
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ==================================================================== */}
      {/* SECCIÓN 2: TABLA DE PRÁCTICAS Y ARANCELES */}
      {/* ==================================================================== */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código, nombre o categoría..."
                className="w-full text-xs pl-10 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Filtro Moneda */}
            <select
              value={filtroMoneda}
              onChange={(e: any) => setFiltroMoneda(e.target.value)}
              className="text-xs p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
            >
              <option value="todas">Todas las Monedas</option>
              <option value="ARS">Pesos ($ ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>

            {/* Filtro Vigencia */}
            <select
              value={filtroVigencia}
              onChange={(e: any) => setFiltroVigencia(e.target.value)}
              className="text-xs p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
            >
              <option value="todas">Todos los Estados</option>
              <option value="vigentes">🟢 Vigentes Hoy</option>
              <option value="futuras">🟡 Programadas a Futuro</option>
              <option value="sin_precio">⚪ Sin Precio Cargado</option>
            </select>
          </div>

          <button
            onClick={() => {
              setEditingPractica(null)
              setPracticaForm({
                nomenclador_id: selectedNomId !== 'all' ? selectedNomId : (nomencladores[0]?.id || ''),
                codigo: '',
                nombre: '',
                categoria: 'General',
                precio: '',
                moneda: 'ARS',
                vigencia_desde: new Date().toISOString().split('T')[0],
                vigencia_hasta: '',
                descripcion: ''
              })
              setModalPracticaOpen(true)
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Plus size={15} /> Nueva Práctica Manual
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 font-semibold uppercase">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Descripción / Práctica</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Arancel Vigente</th>
                <th className="py-3 px-4 text-center">Vigencia</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loadingPracticas ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Cargando catálogo de prácticas...
                  </td>
                </tr>
              ) : filteredPracticas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No se encontraron prácticas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredPracticas.map((p) => {
                  const isUSD = p.moneda === 'USD'
                  const today = new Date().toISOString().split('T')[0]
                  const isVigente = p.tiene_arancel && (!p.vigencia_desde || p.vigencia_desde <= today) && (!p.vigencia_hasta || p.vigencia_hasta >= today)
                  const isFutura = p.tiene_arancel && p.vigencia_desde && p.vigencia_desde > today

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{p.codigo}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{p.nombre}</div>
                        {p.descripcion && <div className="text-[11px] text-slate-400">{p.descripcion}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {p.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.tiene_arancel ? (
                          <div className="font-mono font-bold text-xs flex items-center justify-end gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                isUSD
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {p.moneda}
                            </span>
                            <span className="text-slate-900 dark:text-slate-100">
                              {isUSD ? 'USD ' : '$ '}
                              {p.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin precio</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isVigente && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                            🟢 Vigente
                          </span>
                        )}
                        {isFutura && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                            🟡 Rige {p.vigencia_desde}
                          </span>
                        )}
                        {!p.tiene_arancel && (
                          <span className="text-[10px] text-slate-400">⚪ Pendiente</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => {
                            setEditingPractica(p)
                            setPracticaForm({
                              nomenclador_id: p.nomenclador_id,
                              codigo: p.codigo,
                              nombre: p.nombre,
                              categoria: p.categoria,
                              precio: p.precio ? p.precio.toString() : '',
                              moneda: p.moneda,
                              vigencia_desde: p.vigencia_desde || new Date().toISOString().split('T')[0],
                              vigencia_hasta: p.vigencia_hasta || '',
                              descripcion: p.descripcion || ''
                            })
                            setModalPracticaOpen(true)
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePractica(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
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

      {/* ==================================================================== */}
      {/* MODAL: CREAR / EDITAR PRÁCTICA INDIVIDUAL */}
      {/* ==================================================================== */}
      {modalPracticaOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Plus className="text-blue-600" size={18} />
              {editingPractica ? 'Editar Práctica y Arancel' : 'Nueva Práctica del Catálogo'}
            </h3>

            <form onSubmit={handleSavePractica} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Moneda del Nomenclador</label>
                  <select
                    value={practicaForm.nomenclador_id}
                    onChange={(e) => setPracticaForm({ ...practicaForm, nomenclador_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
                  >
                    {nomencladores.map((nom) => (
                      <option key={nom.id} value={nom.id}>
                        {nom.moneda_default === 'USD' ? '🇺🇸 Dólares (USD)' : '🇦🇷 Pesos (ARS)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Código de Práctica</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: 420101 o FIV-01"
                    value={practicaForm.codigo}
                    onChange={(e) => setPracticaForm({ ...practicaForm, codigo: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono font-bold outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Nombre descriptivo</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Consulta Médica / Ecografía Tocoginecológica"
                  value={practicaForm.nombre}
                  onChange={(e) => setPracticaForm({ ...practicaForm, nombre: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <label className="font-bold text-slate-500 block mb-1">Precio / Arancel</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={practicaForm.precio}
                    onChange={(e) => setPracticaForm({ ...practicaForm, precio: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono font-bold text-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Vigencia Desde</label>
                  <input
                    type="date"
                    required
                    value={practicaForm.vigencia_desde}
                    onChange={(e) => setPracticaForm({ ...practicaForm, vigencia_desde: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Vigencia Hasta (Opcional)</label>
                  <input
                    type="date"
                    value={practicaForm.vigencia_hasta}
                    onChange={(e) => setPracticaForm({ ...practicaForm, vigencia_hasta: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Categoría</label>
                <input
                  type="text"
                  placeholder="ej: Consultas, Fertilidad, Diagnóstico"
                  value={practicaForm.categoria}
                  onChange={(e) => setPracticaForm({ ...practicaForm, categoria: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModalPracticaOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Guardar Práctica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
