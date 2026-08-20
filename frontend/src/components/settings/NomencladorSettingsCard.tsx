'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building,
  DollarSign,
  Calendar,
  Sparkles,
  RefreshCw,
  X,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Filter
} from 'lucide-react'

interface GeclisaTipoNomenclador {
  nomId: number
  nomNom: string
}

interface GeclisaPracticaItem {
  nomCod: string
  nombre?: string
  practica?: string
  codyPractica?: string
  tipo?: string
  ya_en_crm: boolean
  crm_practica_id?: string | null
  precio_crm: number
  moneda_crm: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  arancel_activo?: boolean
}

interface CrmPracticaConfigurada {
  id: string
  codigo: string
  nombre: string
  categoria: string
  descripcion: string
  origen: 'GECLISA' | 'MANUAL'
  precio: number
  moneda: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  arancel_id?: string | null
  activo: boolean
  created_at: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function NomencladorSettingsCard() {
  // Estado de Tipos de Nomenclador Geclisa
  const [tiposGeclisa, setTiposGeclisa] = useState<GeclisaTipoNomenclador[]>([])
  const [selectedNomId, setSelectedNomId] = useState<number | ''>('')
  
  // Búsqueda en Geclisa
  const [searchGeclisaQuery, setSearchGeclisaQuery] = useState('')
  const [searchingGeclisa, setSearchingGeclisa] = useState(false)
  const [geclisaResults, setGeclisaResults] = useState<GeclisaPracticaItem[]>([])

  // Catálogo Maestro en CRM
  const [crmPracticas, setCrmPracticas] = useState<CrmPracticaConfigurada[]>([])
  const [loadingCrm, setLoadingCrm] = useState(true)
  const [filtroTab, setFiltroTab] = useState<'todas' | 'ARS' | 'USD' | 'MANUAL' | 'GECLISA'>('todas')
  const [crmSearchTerm, setCrmSearchTerm] = useState('')

  // Modal de Configuración / Creación de Arancel
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'geclisa' | 'manual' | 'edit'>('geclisa')
  const [savingModal, setSavingModal] = useState(false)

  // Datos del Formulario del Modal
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    categoria: 'General',
    descripcion: '',
    origen: 'GECLISA' as 'GECLISA' | 'MANUAL',
    nom_id: null as number | null,
    precio: 0,
    moneda: 'ARS' as 'ARS' | 'USD',
    vigencia_desde: new Date().toISOString().split('T')[0],
    vigencia_hasta: ''
  })

  // Mensaje de feedback
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  // 1. Cargar tipos de Geclisa y catálogo actual del CRM al inicio
  useEffect(() => {
    loadTiposGeclisa()
    loadCatalogoCrm()
  }, [])

  const loadTiposGeclisa = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/geclisa/nomenclador/tipos`)
      if (res.ok) {
        const data = await res.json()
        const tipos: GeclisaTipoNomenclador[] = data.tipos || []
        setTiposGeclisa(tipos)
        if (tipos.length > 0 && selectedNomId === '') {
          setSelectedNomId(tipos[0].nomId)
        }
      }
    } catch (err) {
      console.error('Error al cargar tipos de nomenclador de Geclisa:', err)
    }
  }

  const loadCatalogoCrm = async () => {
    try {
      setLoadingCrm(true)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-configuradas`)
      if (res.ok) {
        const data = await res.json()
        setCrmPracticas(data.practicas || [])
      }
    } catch (err) {
      console.error('Error al cargar catálogo configurado en CRM:', err)
    } finally {
      setLoadingCrm(false)
    }
  }

  // 2. Disparar búsqueda en vivo en Geclisa
  const handleSearchGeclisa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setSearchingGeclisa(true)
      setFeedback(null)
      const params = new URLSearchParams()
      if (selectedNomId) params.append('nom_id', String(selectedNomId))
      if (searchGeclisaQuery.trim()) params.append('q', searchGeclisaQuery.trim())

      const res = await fetch(`${API_BASE_URL}/api/geclisa/nomenclador/buscar?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setGeclisaResults(data.practicas || [])
        if ((data.practicas || []).length === 0) {
          setFeedback({ tipo: 'error', texto: 'No se encontraron prácticas en Geclisa para esa búsqueda.' })
        }
      } else {
        setFeedback({ tipo: 'error', texto: 'No se pudo consultar el nomenclador de Geclisa.' })
      }
    } catch (err) {
      console.error('Error al buscar en Geclisa:', err)
      setFeedback({ tipo: 'error', texto: 'Error al conectar con la API de Geclisa.' })
    } finally {
      setSearchingGeclisa(false)
    }
  }

  // 3. Abrir Modal para práctica de Geclisa
  const handleOpenConfigureGeclisa = (item: GeclisaPracticaItem) => {
    const today = new Date().toISOString().split('T')[0]
    setModalMode('geclisa')
    setFormData({
      codigo: item.nomCod,
      nombre: item.nombre || item.practica || `Práctica ${item.nomCod}`,
      categoria: item.tipo || 'Oftalmología',
      descripcion: '',
      origen: 'GECLISA',
      nom_id: typeof selectedNomId === 'number' ? selectedNomId : 1,
      precio: item.precio_crm || 0,
      moneda: item.moneda_crm || 'ARS',
      vigencia_desde: item.vigencia_desde || today,
      vigencia_hasta: item.vigencia_hasta || ''
    })
    setIsModalOpen(true)
  }

  // 4. Abrir Modal para crear práctica manual
  const handleOpenCreateManual = () => {
    const today = new Date().toISOString().split('T')[0]
    setModalMode('manual')
    setFormData({
      codigo: '',
      nombre: '',
      categoria: 'General',
      descripcion: '',
      origen: 'MANUAL',
      nom_id: null,
      precio: 0,
      moneda: 'ARS',
      vigencia_desde: today,
      vigencia_hasta: ''
    })
    setIsModalOpen(true)
  }

  // 5. Abrir Modal para editar práctica del CRM existente
  const handleOpenEditCrm = (p: CrmPracticaConfigurada) => {
    const today = new Date().toISOString().split('T')[0]
    setModalMode('edit')
    setFormData({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria || 'General',
      descripcion: p.descripcion || '',
      origen: p.origen || 'GECLISA',
      nom_id: null,
      precio: p.precio || 0,
      moneda: p.moneda || 'ARS',
      vigencia_desde: p.vigencia_desde || today,
      vigencia_hasta: p.vigencia_hasta || ''
    })
    setIsModalOpen(true)
  }

  // 6. Guardar práctica con arancel en CRM
  const handleSavePracticaArancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      setFeedback({ tipo: 'error', texto: 'El código y nombre de la práctica son obligatorios.' })
      return
    }

    try {
      setSavingModal(true)
      setFeedback(null)

      const payload = {
        codigo: formData.codigo.trim().toUpperCase(),
        nombre: formData.nombre.trim(),
        categoria: formData.categoria.trim() || 'General',
        descripcion: formData.descripcion.trim(),
        origen: formData.origen,
        precio: parseFloat(String(formData.precio)) || 0,
        moneda: formData.moneda,
        vigencia_desde: formData.vigencia_desde || new Date().toISOString().split('T')[0],
        vigencia_hasta: formData.vigencia_hasta ? formData.vigencia_hasta : null
      }

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/guardar-practica-arancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setIsModalOpen(false)
        setFeedback({ tipo: 'success', texto: `¡Práctica ${formData.codigo.toUpperCase()} guardada con éxito en el CRM!` })
        // Refrescar catálogo local y resultados de Geclisa
        await loadCatalogoCrm()
        if (geclisaResults.length > 0) {
          handleSearchGeclisa()
        }
      } else {
        const errData = await res.json()
        setFeedback({ tipo: 'error', texto: errData.detail || 'Error al guardar la práctica.' })
      }
    } catch (err) {
      console.error('Error al guardar práctica:', err)
      setFeedback({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' })
    } finally {
      setSavingModal(false)
    }
  }

  // 7. Eliminar práctica del CRM
  const handleDeleteCrmPractica = async (practicaId: string, codigo: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la práctica ${codigo} del catálogo del CRM?`)) {
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-configuradas/${practicaId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setFeedback({ tipo: 'success', texto: `Práctica ${codigo} eliminada correctamente.` })
        loadCatalogoCrm()
        if (geclisaResults.length > 0) {
          handleSearchGeclisa()
        }
      }
    } catch (err) {
      console.error('Error al eliminar práctica:', err)
      setFeedback({ tipo: 'error', texto: 'No se pudo eliminar la práctica.' })
    }
  }

  // Filtrado de la tabla maestra del CRM
  const filteredCrmPracticas = crmPracticas.filter((p) => {
    // Filtro por Tab
    if (filtroTab === 'ARS' && p.moneda !== 'ARS') return false
    if (filtroTab === 'USD' && p.moneda !== 'USD') return false
    if (filtroTab === 'MANUAL' && p.origen !== 'MANUAL') return false
    if (filtroTab === 'GECLISA' && p.origen !== 'GECLISA') return false

    // Filtro por texto
    if (crmSearchTerm.trim()) {
      const term = crmSearchTerm.toLowerCase()
      const matchCod = p.codigo.toLowerCase().includes(term)
      const matchNom = p.nombre.toLowerCase().includes(term)
      const matchCat = (p.categoria || '').toLowerCase().includes(term)
      if (!matchCod && !matchNom && !matchCat) return false
    }

    return true
  })

  // Estadísticas
  const totalArs = crmPracticas.filter((p) => p.moneda === 'ARS').length
  const totalUsd = crmPracticas.filter((p) => p.moneda === 'USD').length
  const totalManuales = crmPracticas.filter((p) => p.origen === 'MANUAL').length

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* 1. Header Principal & Métricas */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Building className="text-blue-600" size={22} />
              Nomenclador & Gestión de Aranceles Médicos
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-1">
              Consulta en vivo el nomenclador hospitalario de Geclisa o crea prácticas personalizadas. Define el valor, la moneda (ARS / USD) y las fechas de vigencia para presupuestos automáticos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateManual}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Plus size={15} />
              + Crear Práctica Personalizada
            </button>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-[var(--border)]">
            <span className="text-[11px] text-slate-400 font-semibold block">Prácticas en CRM</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{crmPracticas.length}</span>
          </div>
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold block">Aranceles en Pesos ($ ARS)</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-200">{totalArs}</span>
          </div>
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold block">Aranceles en Dólares (USD)</span>
            <span className="text-lg font-extrabold text-amber-600 dark:text-amber-200">{totalUsd}</span>
          </div>
          <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold block">Prácticas Manuales / Propias</span>
            <span className="text-lg font-extrabold text-purple-600 dark:text-purple-200">{totalManuales}</span>
          </div>
        </div>

        {/* Alerta de Feedback */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 animate-scale-in ${
              feedback.tipo === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.tipo === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.texto}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold hover:underline">
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* 2. Buscador en Vivo en Nomenclador de Geclisa */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-lg">
              <Search size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Buscador en Vivo del Nomenclador Hospitalario (Geclisa)
              </h3>
              <p className="text-[11px] text-slate-400">
                Consulta códigos oficiales de Geclisa para vincularlos y fijarles arancel en el CRM.
              </p>
            </div>
          </div>
        </div>

        {/* Formulario de Búsqueda */}
        <form onSubmit={handleSearchGeclisa} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          <div className="sm:col-span-4">
            <label className="font-bold text-slate-500 block mb-1">Tipo de Nomenclador Geclisa</label>
            <select
              value={selectedNomId}
              onChange={(e) => setSelectedNomId(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              {tiposGeclisa.map((t) => (
                <option key={t.nomId} value={t.nomId}>
                  {t.nomNom} ({t.nomId})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-6">
            <label className="font-bold text-slate-500 block mb-1">Código o Nombre de Práctica</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchGeclisaQuery}
                onChange={(e) => setSearchGeclisaQuery(e.target.value)}
                placeholder="ej: 100, 111, Consulta, Ecografía, Fondo de Ojo, Blefaroplastia..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={searchingGeclisa}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {searchingGeclisa ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar en Geclisa
            </button>
          </div>
        </form>

        {/* Resultados de Geclisa */}
        {geclisaResults.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{geclisaResults.length} práctica(s) encontrada(s) en Geclisa:</span>
              <button
                onClick={() => setGeclisaResults([])}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
              >
                Ocultar resultados
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-slate-50/50 dark:bg-slate-900/30">
              {geclisaResults.map((item, idx) => {
                const nombre = item.nombre || item.practica || `Práctica ${item.nomCod}`
                return (
                  <div
                    key={idx}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white dark:hover:bg-slate-800 transition"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                        {item.nomCod}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{nombre}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{item.tipo || 'Geclisa'}</span>
                          {item.ya_en_crm ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.2 rounded">
                              <CheckCircle2 size={11} /> En CRM: {item.moneda_crm === 'USD' ? 'USD' : '$'} {item.precio_crm.toLocaleString('es-AR')} {item.vigencia_desde ? `(Vig: ${item.vigencia_desde})` : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                              Sin arancel en CRM
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleOpenConfigureGeclisa(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          item.ya_en_crm
                            ? 'bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        }`}
                      >
                        {item.ya_en_crm ? <Edit2 size={12} /> : <Plus size={12} />}
                        {item.ya_en_crm ? 'Editar Arancel' : 'Configurar en CRM'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Tabla Maestra de Prácticas y Aranceles Configurados en CRM */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="text-emerald-600" size={18} />
              Catálogo de Tarifas y Prácticas en el CRM ({crmPracticas.length})
            </h3>
            <p className="text-[11px] text-slate-400">
              Prácticas activas disponibles para el cotizador de presupuestos y el agente de WhatsApp.
            </p>
          </div>

          <button
            onClick={loadCatalogoCrm}
            className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 transition"
          >
            <RefreshCw size={13} /> Actualizar Tabla
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda Local */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFiltroTab('todas')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filtroTab === 'todas'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Todas ({crmPracticas.length})
            </button>
            <button
              onClick={() => setFiltroTab('ARS')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filtroTab === 'ARS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              🇦🇷 Pesos ARS ({totalArs})
            </button>
            <button
              onClick={() => setFiltroTab('USD')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filtroTab === 'USD'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              🇺🇸 Dólares USD ({totalUsd})
            </button>
            <button
              onClick={() => setFiltroTab('MANUAL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filtroTab === 'MANUAL'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              ✨ Personalizadas ({totalManuales})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={crmSearchTerm}
              onChange={(e) => setCrmSearchTerm(e.target.value)}
              placeholder="Filtrar en catálogo local..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tabla de Prácticas */}
        {loadingCrm ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
            Cargando tarifas del CRM...
          </div>
        ) : filteredCrmPracticas.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-[var(--border)] rounded-xl">
            No hay prácticas configuradas con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-slate-400 font-semibold uppercase text-[11px]">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Descripción / Práctica</th>
                  <th className="py-2.5 px-3 text-center">Origen</th>
                  <th className="py-2.5 px-3 text-center">Moneda</th>
                  <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                  <th className="py-2.5 px-3 text-center">Vigencia</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredCrmPracticas.map((p) => {
                  const isUSD = p.moneda === 'USD'
                  const isManual = p.origen === 'MANUAL'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">{p.codigo}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{p.nombre}</div>
                        <div className="text-[10px] text-slate-400">{p.categoria}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isManual
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {isManual ? 'Personalizada' : 'Geclisa'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            isUSD
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {p.moneda}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {isUSD ? 'USD ' : '$ '}
                        {p.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center text-[11px] text-slate-500 font-mono">
                        {p.vigencia_desde || 'Hoy'} {p.vigencia_hasta ? `hasta ${p.vigencia_hasta}` : '• Indefinida'}
                      </td>
                      <td className="py-3 px-3 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCrm(p)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Editar Arancel y Vigencia"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCrmPractica(p.id, p.codigo)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Eliminar del CRM"
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

      {/* ==================================================================== */}
      {/* MODAL DE CONFIGURACIÓN DE ARANCEL / CREACIÓN DE PRÁCTICA */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <DollarSign className="text-emerald-600" size={20} />
                {modalMode === 'manual'
                  ? 'Nueva Práctica Personalizada'
                  : modalMode === 'edit'
                  ? 'Actualizar Arancel & Vigencia'
                  : 'Configurar Práctica desde Geclisa'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSavePracticaArancel} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Código de Práctica</label>
                  <input
                    type="text"
                    required
                    readOnly={modalMode === 'geclisa'}
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                    placeholder="ej: CIR-01, 100, PACK-FIV"
                    className={`w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                      modalMode === 'geclisa' ? 'bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Categoría / Especialidad</label>
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="ej: Oftalmología, Estética, Cirugía..."
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Nombre o Descripción de la Prestación</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="ej: Consulta Oftalmológica Especializada / Pack Quirúrgico"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Selector de Moneda y Precio */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Moneda del Arancel</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, moneda: 'ARS' })}
                        className={`p-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                          formData.moneda === 'ARS'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        🇦🇷 Pesos ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, moneda: 'USD' })}
                        className={`p-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                          formData.moneda === 'USD'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        🇺🇸 Dólares (USD)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 block mb-1">
                      Precio / Arancel ({formData.moneda === 'USD' ? 'USD' : '$'})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-bold">
                        {formData.moneda === 'USD' ? 'USD' : '$'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.precio}
                        onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-11 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Fechas de Vigencia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Vigencia Desde</label>
                    <input
                      type="date"
                      required
                      value={formData.vigencia_desde}
                      onChange={(e) => setFormData({ ...formData, vigencia_desde: e.target.value })}
                      className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Vigencia Hasta (Opcional)</label>
                    <input
                      type="date"
                      value={formData.vigencia_hasta}
                      onChange={(e) => setFormData({ ...formData, vigencia_hasta: e.target.value })}
                      className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingModal}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {savingModal ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Guardar en el CRM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
