'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Tag,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit3,
  Check,
  X,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  AlertTriangle,
  Lock
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import {
  EstudioPresetItem,
  DEFAULT_ESTUDIOS_PRESETS,
  GECLISA_MAX_TITLE_CHARS,
  getGeclisaTitleInfo
} from '@/lib/estudiosDefaults'

interface Props {
  canEdit: boolean
}

export default function EstudiosTiposSettingsCard({ canEdit }: Props) {
  const [presets, setPresets] = useState<EstudioPresetItem[]>(DEFAULT_ESTUDIOS_PRESETS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showDisabled, setShowDisabled] = useState(true)
  const [newTagName, setNewTagName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/estudios-tecnicos/config')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.presets) && data.presets.length > 0) {
          setPresets(data.presets)
        }
      }
    } catch (err) {
      console.error('Error cargando etiquetas de estudios:', err)
    } finally {
      setLoading(false)
      setDirty(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ')

  const isDuplicate = (candidate: string, excludeId?: string) => {
    const key = normalizeName(candidate).toLowerCase()
    return presets.some(p => p.id !== excludeId && normalizeName(p.nombre).toLowerCase() === key)
  }

  const handleAddTag = () => {
    if (!canEdit) return
    const clean = normalizeName(newTagName)
    if (!clean) {
      setFeedback({ type: 'error', text: 'Ingresa un nombre válido para la etiqueta.' })
      return
    }
    if (isDuplicate(clean)) {
      setFeedback({ type: 'error', text: `Ya existe una etiqueta con el nombre "${clean}".` })
      return
    }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `tag_${crypto.randomUUID().slice(0, 8)}`
      : `tag_${Date.now()}`
    const next: EstudioPresetItem[] = [
      ...presets,
      { id, nombre: clean, activo: true, orden: presets.length + 1 }
    ]
    setPresets(next)
    setNewTagName('')
    setDirty(true)
    setFeedback(null)
  }

  const handleStartEdit = (item: EstudioPresetItem) => {
    if (!canEdit) return
    setEditingId(item.id)
    setEditingValue(item.nombre)
    setFeedback(null)
  }

  const handleConfirmEdit = (id: string) => {
    const clean = normalizeName(editingValue)
    if (!clean) {
      setFeedback({ type: 'error', text: 'El nombre de la etiqueta no puede quedar vacío.' })
      return
    }
    if (isDuplicate(clean, id)) {
      setFeedback({ type: 'error', text: `Ya existe otra etiqueta con el nombre "${clean}".` })
      return
    }
    setPresets(prev => prev.map(p => (p.id === id ? { ...p, nombre: clean } : p)))
    setEditingId(null)
    setEditingValue('')
    setDirty(true)
    setFeedback(null)
  }

  const handleToggleActive = (id: string) => {
    if (!canEdit) return
    setPresets(prev => prev.map(p => (p.id === id ? { ...p, activo: !p.activo } : p)))
    setDirty(true)
    setFeedback(null)
  }

  const handleMove = (index: number, delta: -1 | 1) => {
    if (!canEdit) return
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= presets.length) return
    const copy = [...presets]
    const [moved] = copy.splice(index, 1)
    copy.splice(targetIndex, 0, moved)
    setPresets(copy.map((p, idx) => ({ ...p, orden: idx + 1 })))
    setDirty(true)
    setFeedback(null)
  }

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    setFeedback(null)
    try {
      const payload = presets.map((p, idx) => ({
        id: p.id,
        nombre: normalizeName(p.nombre),
        activo: p.activo,
        orden: idx + 1
      }))
      const res = await apiFetch('/api/estudios-tecnicos/config', {
        method: 'PUT',
        body: JSON.stringify({ presets: payload })
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.detail || 'No se pudieron guardar las etiquetas.' })
        return
      }
      if (Array.isArray(data.presets)) {
        setPresets(data.presets)
      }
      setDirty(false)
      setFeedback({ type: 'success', text: 'Etiquetas guardadas correctamente. Los registros históricos permanecen intactos.' })
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error de conexión al guardar.' })
    } finally {
      setSaving(false)
    }
  }

  const newTagInfo = getGeclisaTitleInfo(newTagName)
  const visiblePresets = showDisabled ? presets : presets.filter(p => p.activo)
  const activeCount = presets.filter(p => p.activo).length

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <Tag size={18} className="text-cyan-600" />
            Etiquetas Rápidas de Estudios Oftalmológicos
          </h3>
          <p className="text-xs text-[var(--secondary)] mt-0.5">
            Configura las opciones rápidas visibles en la consola de Estudios Técnicos. Editar o deshabilitar una etiqueta no altera estudios históricos ya enviados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDisabled(v => !v)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--secondary)] inline-flex items-center gap-1.5"
          >
            {showDisabled ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showDisabled ? 'Ocultar deshabilitadas' : `Ver todas (${presets.length})`}</span>
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{dirty ? 'Guardar cambios' : 'Guardado'}</span>
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <Lock size={14} className="shrink-0" />
          <span>Modo solo lectura: tu rol permite consultar etiquetas pero no modificarlas (`editar_estudios_oftalmologicos`).</span>
        </div>
      )}

      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-medium ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Alta de nueva etiqueta */}
      {canEdit && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-slate-50/60 dark:bg-slate-900/40 space-y-2">
          <label className="block text-xs font-bold text-[var(--foreground)]">
            Agregar nueva etiqueta de estudio
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="Ej: Angiografía OCT (Angio-OCT)"
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-[var(--card)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-cyan-600 hover:opacity-90 text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={14} />
              <span>Agregar etiqueta</span>
            </button>
          </div>
          {newTagName.trim() && (
            <div className={`text-[11px] flex items-center justify-between gap-2 ${
              newTagInfo.exceedsLimit ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-[var(--secondary)]'
            }`}>
              <span className="truncate">
                Vista previa en Geclisa: <code className="font-mono">{newTagInfo.geclisaTitle}</code>
              </span>
              <span className="shrink-0 font-mono">
                {newTagInfo.length}/{GECLISA_MAX_TITLE_CHARS} chars
                {newTagInfo.exceedsLimit && ' (Geclisa truncará el título a 45)'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Listado de etiquetas */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-[var(--border)] flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
          <span>Etiquetas configuradas ({activeCount} activas / {presets.length} totales)</span>
          <span>Acciones</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-[var(--secondary)]">Cargando etiquetas...</div>
        ) : visiblePresets.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--secondary)]">
            No hay etiquetas visibles. Activa alguna o crea una nueva arriba.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {visiblePresets.map((item) => {
              const realIdx = presets.findIndex(p => p.id === item.id)
              const isEditing = editingId === item.id
              const info = getGeclisaTitleInfo(isEditing ? editingValue : item.nombre)

              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    item.activo ? 'bg-[var(--card)]' : 'bg-slate-50/60 dark:bg-slate-900/40 opacity-65'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmEdit(item.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          autoFocus
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-cyan-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmEdit(item.id)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                          title="Confirmar nombre"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Cancelar"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-[var(--secondary)] w-6">#{realIdx + 1}</span>
                        <span className={`text-xs font-bold ${item.activo ? 'text-[var(--foreground)]' : 'line-through text-[var(--secondary)]'}`}>
                          {item.nombre}
                        </span>
                        {!item.activo && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Deshabilitada
                          </span>
                        )}
                        {info.exceedsLimit && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            title={`En Geclisa se enviará "${info.geclisaTitle}" (${info.length}/45 caracteres)`}
                          >
                            <AlertTriangle size={10} />
                            {info.length}/45 Geclisa
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {canEdit && !isEditing && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={realIdx === 0}
                        onClick={() => handleMove(realIdx, -1)}
                        className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                        title="Subir orden"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={realIdx === presets.length - 1}
                        onClick={() => handleMove(realIdx, 1)}
                        className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                        title="Bajar orden"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600"
                        title="Editar nombre"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                          item.activo
                            ? 'border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                            : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {item.activo ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
