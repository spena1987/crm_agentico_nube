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
  Info
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ModeloLio {
  id?: string
  marca: string
  modelo: string
  tipo_optica: string
  descripcion?: string | null
  activo?: boolean
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

export default function LioSettingsCard() {
  const [modelos, setModelos] = useState<ModeloLio[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroOptica, setFiltroOptica] = useState('ALL')

  // Formulario de edición/creación
  const [mostrandoForm, setMostrandoForm] = useState(false)
  const [modeloEnEdicion, setModeloEnEdicion] = useState<ModeloLio | null>(null)

  const fetchModelos = async () => {
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio`)
      const data = await res.json()
      if (res.ok && data.success && data.modelos) {
        setModelos(data.modelos)
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

  const handleAbrirNuevo = () => {
    setModeloEnEdicion({
      marca: '',
      modelo: '',
      tipo_optica: 'Monofocal Asférico',
      descripcion: '',
      activo: true
    })
    setMostrandoForm(true)
  }

  const handleAbrirEditar = (m: ModeloLio) => {
    setModeloEnEdicion({ ...m })
    setMostrandoForm(true)
  }

  const handleCerrarForm = () => {
    setMostrandoForm(false)
    setModeloEnEdicion(null)
  }

  const handleGuardarModelo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modeloEnEdicion?.marca?.trim() || !modeloEnEdicion?.modelo?.trim()) {
      setError('La marca y el nombre del modelo son obligatorios.')
      return
    }

    try {
      setGuardando(true)
      setError(null)
      const esEdit = !!modeloEnEdicion.id
      const url = esEdit 
        ? `${BACKEND_URL}/api/modelos-lio/${modeloEnEdicion.id}` 
        : `${BACKEND_URL}/api/modelos-lio`
      const method = esEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modeloEnEdicion)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(esEdit ? '✔ Modelo de LIO actualizado con éxito.' : '✔ Nuevo modelo de LIO registrado.')
        handleCerrarForm()
        fetchModelos()
        setTimeout(() => setMensajeExito(null), 3500)
      } else {
        throw new Error(data.detail || 'Error al guardar el modelo de LIO.')
      }
    } catch (err: any) {
      console.error('Error guardando LIO:', err)
      setError(err.message || 'Error al guardar el modelo.')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarModelo = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Estás seguro de que deseas eliminar este modelo de lente intraocular del catálogo?')) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        setModelos((prev) => prev.filter((m) => m.id !== id))
        setMensajeExito('✔ Modelo de LIO eliminado.')
        setTimeout(() => setMensajeExito(null), 3000)
      } else {
        throw new Error(data.detail || 'Error al eliminar modelo.')
      }
    } catch (err: any) {
      console.error('Error eliminando LIO:', err)
      setError(err.message || 'Error al eliminar modelo.')
    }
  }

  // Filtrado dinámico en frontend
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

  // Marcas únicas disponibles
  const marcasUnicas = useMemo(() => {
    const setMarcas = new Set<string>()
    modelos.forEach((m) => {
      if (m.marca) setMarcas.add(m.marca)
    })
    return Array.from(setMarcas)
  }, [modelos])

  return (
    <div className="bg-[var(--card)] p-5 md:p-6 rounded-2xl border border-[var(--border)] space-y-6 shadow-sm">
      
      {/* Header Principal de la Sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/20">
            <Eye size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Catálogo de Lentes Intraoculares (LIO)
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800/40">
                {modelos.length} modelos
              </span>
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Administra las marcas, modelos y tecnologías ópticas disponibles en la Ficha de Turno Quirúrgico.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAbrirNuevo}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all shrink-0"
        >
          <Plus size={16} />
          <span>+ Nuevo Modelo LIO</span>
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {mensajeExito && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* Formulario Modal / Drawer Inline de Creación y Edición */}
      {mostrandoForm && modeloEnEdicion && (
        <form 
          onSubmit={handleGuardarModelo} 
          className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-blue-500/40 space-y-4 shadow-md animate-scale-in"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                {modeloEnEdicion.id ? 'Editar Modelo de Lente Intraocular' : 'Registrar Nuevo Modelo de LIO'}
              </h4>
            </div>
            <button
              type="button"
              onClick={handleCerrarForm}
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
                value={modeloEnEdicion.marca}
                onChange={(e) => setModeloEnEdicion({ ...modeloEnEdicion, marca: e.target.value })}
                placeholder="Ej: Alcon, Johnson & Johnson, Rayner, Zeiss..."
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--secondary)]">Nombre del Modelo *</label>
              <input
                type="text"
                value={modeloEnEdicion.modelo}
                onChange={(e) => setModeloEnEdicion({ ...modeloEnEdicion, modelo: e.target.value })}
                placeholder="Ej: AcrySof IQ SN60WF, PanOptix, Clareon..."
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--secondary)]">Tipo de Óptica *</label>
              <select
                value={modeloEnEdicion.tipo_optica}
                onChange={(e) => setModeloEnEdicion({ ...modeloEnEdicion, tipo_optica: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-semibold outline-none focus:border-blue-500"
              >
                {TIPOS_OPTICA.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[var(--secondary)]">Descripción, Constante A o Material</label>
            <input
              type="text"
              value={modeloEnEdicion.descripcion || ''}
              onChange={(e) => setModeloEnEdicion({ ...modeloEnEdicion, descripcion: e.target.value })}
              placeholder="Detalles ópticos, constante A sugerida (ej: 118.7), filtro de luz azul o material acrílico hidrofóbico..."
              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleCerrarForm}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{modeloEnEdicion.id ? 'Guardar Cambios' : 'Registrar Modelo'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Barra de Filtros y Búsqueda de LIOs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-[var(--border)]">
        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por marca o modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--foreground)]"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filtro por Tipo de Óptica */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SlidersHorizontal size={14} className="text-slate-400" />
          <select
            value={filtroOptica}
            onChange={(e) => setFiltroOptica(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">Todos los Tipos de Óptica</option>
            {TIPOS_OPTICA.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <span className="text-[11px] font-mono text-[var(--secondary)] font-bold ml-auto sm:ml-2">
            {filteredModelos.length} ítems
          </span>
        </div>
      </div>

      {/* Guía Rápida */}
      <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
        <div className="text-[11px] leading-relaxed">
          Los modelos registrados aquí se listan automáticamente en el desplegable de <b>LIO (Lente Intraocular)</b> dentro del modal de programación de turnos y en el panel quirúrgico de enfermería.
        </div>
      </div>

      {/* Grid de Modelos Registrados */}
      {cargando ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span>Cargando catálogo de lentes intraoculares...</span>
        </div>
      ) : filteredModelos.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-2xl space-y-2">
          <Eye size={28} className="mx-auto text-slate-400 opacity-50" />
          <p className="font-bold text-sm text-[var(--foreground)]">No se encontraron modelos de LIO</p>
          <p className="text-[11px]">
            {searchTerm || filtroOptica !== 'ALL' 
              ? 'Intenta modificando los filtros de búsqueda.' 
              : 'Comienza registrando los modelos y marcas de lentes con el botón "+ Nuevo Modelo LIO".'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredModelos.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-3 hover:border-blue-500/50 transition-all shadow-xs group"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {m.marca}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {m.tipo_optica}
                  </span>
                </div>
                
                <p className="text-xs font-bold text-[var(--foreground)] truncate" title={m.modelo}>
                  {m.modelo}
                </p>
                
                {m.descripcion ? (
                  <p className="text-[11px] text-[var(--secondary)] line-clamp-2 leading-relaxed" title={m.descripcion}>
                    {m.descripcion}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">Sin observaciones adicionales</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleAbrirEditar(m)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                  title="Editar modelo"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleEliminarModelo(m.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                  title="Eliminar modelo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
