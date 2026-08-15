'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  Layers,
  Sparkles,
  HelpCircle,
  Search,
  Check,
  X,
  AlertCircle
} from 'lucide-react'

interface NomencladorTipo {
  nomId: number
  nomNom: string
}

interface NomencladorConfig {
  id?: string
  nomencladores_activos: number[]
  geclisa_particular_os_id: number
  geclisa_particular_plan_id: number
  geclisa_area_default: string
}

interface PracticaCRM {
  id: string
  codigo: string
  nombre: string
  categoria: string
  precio: number
  descripcion?: string
  activo: boolean
}

interface PrecioOverride {
  id: string
  nom_id: number
  nom_cod: string
  nombre_referencia: string
  precio_override: number
  observacion?: string
  activo: boolean
}

const DEFAULT_TIPOS: NomencladorTipo[] = [
  { nomId: 1, nomNom: 'Prestaciones Medicas' },
  { nomId: 2, nomNom: 'Bioquimicas' },
  { nomId: 5, nomNom: 'NBU' },
  { nomId: 6, nomNom: 'Nomenclador Creo' }
]

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function NomencladorSettingsCard() {
  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Configuración
  const [tiposNomenclador, setTiposNomenclador] = useState<NomencladorTipo[]>(DEFAULT_TIPOS)
  const [config, setConfig] = useState<NomencladorConfig>({
    nomencladores_activos: [1, 6],
    geclisa_particular_os_id: 8118,
    geclisa_particular_plan_id: 215,
    geclisa_area_default: 'A'
  })

  // Prácticas Propias CRM
  const [practicasCRM, setPracticasCRM] = useState<PracticaCRM[]>([])
  const [modalPracticaOpen, setModalPracticaOpen] = useState(false)
  const [editingPractica, setEditingPractica] = useState<PracticaCRM | null>(null)
  const [practicaForm, setPracticaForm] = useState({
    codigo: '',
    nombre: '',
    categoria: 'Fertilidad',
    precio: '',
    descripcion: '',
    activo: true
  })

  // Precios Override
  const [overrides, setOverrides] = useState<PrecioOverride[]>([])
  const [modalOverrideOpen, setModalOverrideOpen] = useState(false)
  const [searchGeclisaQuery, setSearchGeclisaQuery] = useState('')
  const [geclisaSearchResults, setGeclisaSearchResults] = useState<any[]>([])
  const [searchingGeclisa, setSearchingGeclisa] = useState(false)
  const [selectedGeclisaItem, setSelectedGeclisaItem] = useState<any | null>(null)
  const [overridePriceForm, setOverridePriceForm] = useState('')
  const [overrideObsForm, setOverrideObsForm] = useState('')

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      // 1. Cargar Configuración y Tipos de forma tolerante
      try {
        const resCfg = await fetch(`${API_BASE_URL}/api/nomenclador/config`)
        if (resCfg.ok) {
          const data = await resCfg.json()
          if (data.config) setConfig(data.config)
        }
      } catch (e) {
        console.warn('No se pudo conectar con el endpoint de config:', e)
      }

      try {
        const resTipos = await fetch(`${API_BASE_URL}/api/nomenclador/tipos`)
        if (resTipos.ok) {
          const data = await resTipos.json()
          if (data.tipos && data.tipos.length > 0) {
            setTiposNomenclador(data.tipos)
          }
        }
      } catch (e) {
        console.warn('Usando tipos de nomenclador por defecto:', e)
      }

      try {
        const resPracticas = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-crm`)
        if (resPracticas.ok) {
          const data = await resPracticas.json()
          if (data.practicas) setPracticasCRM(data.practicas)
        }
      } catch (e) {
        console.warn('No se pudo conectar con practicas-crm:', e)
      }

      try {
        const resOverrides = await fetch(`${API_BASE_URL}/api/nomenclador/precios-override`)
        if (resOverrides.ok) {
          const data = await resOverrides.json()
          if (data.overrides) setOverrides(data.overrides)
        }
      } catch (e) {
        console.warn('No se pudo conectar con precios-override:', e)
      }
    } catch (err) {
      console.error('Error cargando ajustes de nomenclador:', err)
    } finally {
      setLoading(false)
    }
  }

  // Toggle tipo de nomenclador activo
  const handleToggleNomenclador = (nomId: number) => {
    const current = config.nomencladores_activos || []
    let updated: number[]
    if (current.includes(nomId)) {
      updated = current.filter((id) => id !== nomId)
    } else {
      updated = [...current, nomId]
    }
    setConfig({ ...config, nomencladores_activos: updated })
  }

  // Guardar configuración general
  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true)
      setFeedback(null)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.ok) {
        setFeedback('Configuración del Nomenclador y Financiador guardada correctamente.')
        setTimeout(() => setFeedback(null), 4000)
      }
    } catch (err) {
      console.error('Error guardando configuración:', err)
    } finally {
      setSavingConfig(false)
    }
  }

  // CRUD Prácticas Propias
  const handleOpenNewPractica = () => {
    setEditingPractica(null)
    setPracticaForm({
      codigo: '',
      nombre: '',
      categoria: 'Fertilidad',
      precio: '',
      descripcion: '',
      activo: true
    })
    setModalPracticaOpen(true)
  }

  const handleEditPractica = (p: PracticaCRM) => {
    setEditingPractica(p)
    setPracticaForm({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria || 'General',
      precio: p.precio.toString(),
      descripcion: p.descripcion || '',
      activo: p.activo
    })
    setModalPracticaOpen(true)
  }

  const handleSavePractica = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        codigo: practicaForm.codigo.trim().toUpperCase(),
        nombre: practicaForm.nombre.trim(),
        categoria: practicaForm.categoria.trim(),
        precio: parseFloat(practicaForm.precio) || 0,
        descripcion: practicaForm.descripcion.trim(),
        activo: practicaForm.activo
      }

      if (editingPractica) {
        const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-crm/${editingPractica.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          const data = await res.json()
          setPracticasCRM(practicasCRM.map((p) => p.id === editingPractica.id ? data.practica : p))
          setModalPracticaOpen(false)
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-crm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          const data = await res.json()
          setPracticasCRM([...practicasCRM, data.practica])
          setModalPracticaOpen(false)
        }
      }
    } catch (err) {
      console.error('Error guardando práctica CRM:', err)
    }
  }

  const handleDeletePractica = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta práctica personalizada del CRM?')) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-crm/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setPracticasCRM(practicasCRM.filter((p) => p.id !== id))
      }
    } catch (err) {
      console.error('Error eliminando práctica CRM:', err)
    }
  }

  // Búsqueda de Geclisa para Override
  const handleSearchGeclisa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchGeclisaQuery.trim()) return
    try {
      setSearchingGeclisa(true)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/buscar-unificado?q=${encodeURIComponent(searchGeclisaQuery)}`)
      if (res.ok) {
        const data = await res.json()
        const geclisaOnly = (data.resultados || []).filter((r: any) => r.origen === 'geclisa')
        setGeclisaSearchResults(geclisaOnly)
      }
    } catch (err) {
      console.error('Error buscando en Geclisa:', err)
    } finally {
      setSearchingGeclisa(false)
    }
  }

  const handleSelectGeclisaForOverride = (item: any) => {
    setSelectedGeclisaItem(item)
    setOverridePriceForm(item.precio_sugerido > 0 ? item.precio_sugerido.toString() : '')
    setOverrideObsForm('')
  }

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGeclisaItem) return
    try {
      const payload = {
        nom_id: selectedGeclisaItem.nom_id,
        nom_cod: selectedGeclisaItem.nom_cod,
        nombre_referencia: selectedGeclisaItem.nombre,
        precio_override: parseFloat(overridePriceForm) || 0,
        observacion: overrideObsForm.trim(),
        activo: true
      }

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/precios-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        const exists = overrides.some((o) => o.nom_id === payload.nom_id && o.nom_cod === payload.nom_cod)
        if (exists) {
          setOverrides(overrides.map((o) => (o.nom_id === payload.nom_id && o.nom_cod === payload.nom_cod) ? data.override : o))
        } else {
          setOverrides([...overrides, data.override])
        }
        setModalOverrideOpen(false)
        setSelectedGeclisaItem(null)
        setSearchGeclisaQuery('')
        setGeclisaSearchResults([])
      }
    } catch (err) {
      console.error('Error guardando precio override:', err)
    }
  }

  const handleDeleteOverride = async (id: string) => {
    if (!confirm('¿Deseas eliminar este precio personalizado? La práctica volverá a usar el valor que retorne la API de Geclisa.')) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/precios-override/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setOverrides(overrides.filter((o) => o.id !== id))
      }
    } catch (err) {
      console.error('Error eliminando override:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 animate-pulse bg-[var(--card)] border border-[var(--border)] rounded-2xl">
        Cargando configuración de nomenclador y aranceles...
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Alerta de Feedback */}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          {feedback}
        </div>
      )}

      {/* SECCIÓN 1: Parámetros del Nomenclador y Financiador Particular */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="text-blue-600" size={20} />
              Nomenclador de Geclisa & Financiador Particular
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Configura qué catálogos hospitalarios se consultan al presupuestar y los identificadores de paciente Particular.
            </p>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm shrink-0 disabled:opacity-50"
          >
            <Save size={15} />
            {savingConfig ? 'Guardando...' : 'Guardar Parámetros'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nomencladores Activos */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers size={14} className="text-blue-500" />
              Nomencladores a Consultar en Geclisa
            </label>
            <div className="space-y-2">
              {tiposNomenclador.map((t) => {
                const isChecked = config.nomencladores_activos?.includes(t.nomId)
                return (
                  <label
                    key={t.nomId}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                        : 'bg-slate-50/50 dark:bg-slate-900/30 border-[var(--border)] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleNomenclador(t.nomId)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div>
                        <span className="text-sm font-semibold">{t.nomNom}</span>
                        <span className="text-xs text-slate-400 ml-2">(ID: {t.nomId})</span>
                      </div>
                    </div>
                    {isChecked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        Activo
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Financiador Particular en Geclisa */}
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-[var(--border)]">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-500" />
              Financiador Particular (Aranceles por Defecto)
            </label>
            <p className="text-xs text-[var(--secondary)]">
              Al cotizar, el CRM solicita a Geclisa el arancel oficial asociado a la Obra Social Particular.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">ID Obra Social Particular</label>
                <input
                  type="number"
                  value={config.geclisa_particular_os_id}
                  onChange={(e) => setConfig({ ...config, geclisa_particular_os_id: parseInt(e.target.value) || 8118 })}
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">ID Plan Particular</label>
                <input
                  type="number"
                  value={config.geclisa_particular_plan_id}
                  onChange={(e) => setConfig({ ...config, geclisa_particular_plan_id: parseInt(e.target.value) || 215 })}
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Área Sanatorial</label>
              <input
                type="text"
                value={config.geclisa_area_default}
                onChange={(e) => setConfig({ ...config, geclisa_area_default: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="A (Ambulatorio)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: Prácticas Propias del CRM (Fuera de Nomenclador) */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="text-amber-500" size={20} />
              Prácticas Propias de la Clínica (Fuera de Nomenclador)
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Crea tratamientos, paquetes o servicios exclusivos que no están registrados en el nomenclador hospitalario de Geclisa.
            </p>
          </div>

          <button
            onClick={handleOpenNewPractica}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm shrink-0"
          >
            <Plus size={15} />
            Nueva Práctica Propia
          </button>
        </div>

        {practicasCRM.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-[var(--border)] rounded-xl">
            No tienes prácticas propias cargadas. Haz clic en &quot;Nueva Práctica Propia&quot; para agregar una.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Prestación</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Precio Particular (ARS)</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {practicasCRM.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                    <td className="py-3 px-3 font-mono font-bold text-amber-600">{p.codigo}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{p.nombre}</div>
                      {p.descripcion && <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.descripcion}</div>}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {p.categoria}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                      ${p.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.activo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {p.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      <button
                        onClick={() => handleEditPractica(p)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeletePractica(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
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

      {/* SECCIÓN 3: Sobrescritura de Precios (Price Overrides para Geclisa) */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="text-emerald-600" size={20} />
              Sobrescritura de Precios (Overrides para Geclisa)
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Si defines un precio aquí para una práctica del Nomenclador de Geclisa, el CRM usará este valor en lugar del retornado por la API.
            </p>
          </div>

          <button
            onClick={() => {
              setSelectedGeclisaItem(null)
              setSearchGeclisaQuery('')
              setGeclisaSearchResults([])
              setModalOverrideOpen(true)
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm shrink-0"
          >
            <Plus size={15} />
            Fijar Precio Personalizado
          </button>
        </div>

        {overrides.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-[var(--border)] rounded-xl">
            No tienes precios personalizados fijados. Al presupuestar, se usarán los valores oficiales de Geclisa.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Nomenclador</th>
                  <th className="py-2.5 px-3">Práctica Geclisa</th>
                  <th className="py-2.5 px-3 text-right">Precio CRM Override (ARS)</th>
                  <th className="py-2.5 px-3">Observación</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {overrides.map((ov) => (
                  <tr key={ov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600">{ov.nom_cod}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                        {ov.nom_id === 1 ? 'Prest. Médicas (1)' : ov.nom_id === 6 ? 'Nomenclador Creo (6)' : `Nom ${ov.nom_id}`}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {ov.nombre_referencia}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                      ${ov.precio_override.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                      {ov.observacion || '-'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDeleteOverride(ov.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                        title="Quitar Override (Restaurar Geclisa)"
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

      {/* MODAL: Crear/Editar Práctica Propia CRM */}
      {modalPracticaOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-md font-bold flex items-center gap-2">
                <Sparkles className="text-amber-500" size={18} />
                {editingPractica ? 'Editar Práctica Propia' : 'Nueva Práctica Propia'}
              </h3>
              <button onClick={() => setModalPracticaOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePractica} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Código Interno</label>
                <input
                  type="text"
                  required
                  value={practicaForm.codigo}
                  onChange={(e) => setPracticaForm({ ...practicaForm, codigo: e.target.value })}
                  placeholder="Ej: CRM-FIV-01"
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-amber-500 outline-none font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Nombre de la Prestación</label>
                <input
                  type="text"
                  required
                  value={practicaForm.nombre}
                  onChange={(e) => setPracticaForm({ ...practicaForm, nombre: e.target.value })}
                  placeholder="Ej: Paquete FIV Integral con Acompañamiento"
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Categoría</label>
                  <input
                    type="text"
                    value={practicaForm.categoria}
                    onChange={(e) => setPracticaForm({ ...practicaForm, categoria: e.target.value })}
                    placeholder="Fertilidad / Quirúrgico"
                    className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Precio Particular (ARS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={practicaForm.precio}
                    onChange={(e) => setPracticaForm({ ...practicaForm, precio: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Descripción / Observaciones</label>
                <textarea
                  rows={2}
                  value={practicaForm.descripcion}
                  onChange={(e) => setPracticaForm({ ...practicaForm, descripcion: e.target.value })}
                  placeholder="Detalles sobre lo que incluye la práctica..."
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chkActivo"
                  checked={practicaForm.activo}
                  onChange={(e) => setPracticaForm({ ...practicaForm, activo: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                />
                <label htmlFor="chkActivo" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Práctica Activa para Presupuestos
                </label>
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
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Save size={14} />
                  Guardar Práctica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Fijar Override de Precio para Práctica Geclisa */}
      {modalOverrideOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-md font-bold flex items-center gap-2">
                <DollarSign className="text-emerald-600" size={18} />
                Fijar Precio Personalizado para Práctica Geclisa
              </h3>
              <button onClick={() => setModalOverrideOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {!selectedGeclisaItem ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--secondary)]">
                  Busca la práctica en el catálogo de Geclisa por código o descripción:
                </p>
                <form onSubmit={handleSearchGeclisa} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchGeclisaQuery}
                      onChange={(e) => setSearchGeclisaQuery(e.target.value)}
                      placeholder="Ej: CONSULTA, 420101, ECOGRAFIA..."
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searchingGeclisa}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {searchingGeclisa ? 'Buscando...' : 'Buscar'}
                  </button>
                </form>

                {/* Resultados de búsqueda */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-[var(--border)] rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/30">
                  {geclisaSearchResults.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      {searchingGeclisa ? 'Consultando API Geclisa...' : 'Ingresa un término y presiona Buscar.'}
                    </div>
                  ) : (
                    geclisaSearchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectGeclisaForOverride(item)}
                        className="p-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 cursor-pointer transition flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            <span className="font-mono text-emerald-600 mr-2">[{item.codigo}]</span>
                            {item.nombre}
                          </div>
                          <div className="text-[11px] text-slate-400">{item.tipo_nomenclador} (Nom ID: {item.nom_id})</div>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-lg text-[11px] font-bold"
                        >
                          Seleccionar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveOverride} className="space-y-4">
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold uppercase">
                      Práctica Seleccionada ({selectedGeclisaItem.tipo_nomenclador})
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      [{selectedGeclisaItem.codigo}] {selectedGeclisaItem.nombre}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGeclisaItem(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Cambiar
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Precio Personalizado CRM (ARS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={overridePriceForm}
                    onChange={(e) => setOverridePriceForm(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-base font-bold"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Este valor sustituirá cualquier precio retornado por Geclisa para esta práctica.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Motivo / Observación (Opcional)</label>
                  <input
                    type="text"
                    value={overrideObsForm}
                    onChange={(e) => setOverrideObsForm(e.target.value)}
                    placeholder="Ej: Tarifa convenio especial 2026"
                    className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setSelectedGeclisaItem(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Save size={14} />
                    Fijar Precio Override
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
