'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Sliders, Save, RefreshCw, Lock, AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import {
  EstudiosOperacionConfig,
  DEFAULT_ESTUDIOS_OPERACION
} from '@/lib/estudiosDefaults'

interface Props {
  canEdit: boolean
}

export default function EstudiosOperacionSettingsCard({ canEdit }: Props) {
  const [operacion, setOperacion] = useState<EstudiosOperacionConfig>(DEFAULT_ESTUDIOS_OPERACION)
  const [caratulaActiva, setCaratulaActiva] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/estudios-tecnicos/config')
      if (res.ok) {
        const data = await res.json()
        if (data.operacion) {
          setOperacion(data.operacion)
        }
        setCaratulaActiva(Boolean(data.caratula_activa ?? true))
      }
    } catch (err) {
      console.error('Error cargando parámetros operativos de estudios:', err)
    } finally {
      setLoading(false)
      setDirty(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/estudios-tecnicos/config', {
        method: 'PUT',
        body: JSON.stringify({ operacion })
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.detail || 'No se pudieron guardar los parámetros.' })
        return
      }
      if (data.operacion) setOperacion(data.operacion)
      setDirty(false)
      setFeedback({ type: 'success', text: 'Parámetros operativos actualizados correctamente.' })
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error de conexión al guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <Sliders size={18} className="text-cyan-600" />
            Parámetros Operativos por Defecto
          </h3>
          <p className="text-xs text-[var(--secondary)] mt-0.5">
            Valores iniciales que verá el técnico al abrir la consola de Estudios. El técnico siempre puede cambiarlos puntualmente por cada estudio.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{dirty ? 'Guardar parámetros' : 'Guardado'}</span>
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <Lock size={14} className="shrink-0" />
          <span>Modo solo lectura: tu rol no posee `editar_estudios_oftalmologicos`.</span>
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

      {loading ? (
        <div className="p-6 text-center text-xs text-[var(--secondary)]">Cargando parámetros...</div>
      ) : (
        <div className="space-y-4">
          {/* Lateralidad por defecto */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2">
            <label className="block text-xs font-bold text-[var(--foreground)]">
              Lateralidad / Ojo inicial por defecto
            </label>
            <div className="grid grid-cols-3 gap-2 max-w-md">
              {(['AO', 'OD', 'OI'] as const).map((oj) => (
                <button
                  key={oj}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    setOperacion(prev => ({ ...prev, ojo_default: oj }))
                    setDirty(true)
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${
                    operacion.ojo_default === oj
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'border-[var(--border)] text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {oj === 'AO' ? 'Ambos Ojos (AO)' : oj === 'OD' ? 'Ojo Derecho (OD)' : 'Ojo Izquierdo (OI)'}
                </button>
              ))}
            </div>
          </div>

          {/* Unificar en PDF por defecto */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={operacion.unificar_en_pdf_default}
              onChange={(e) => {
                setOperacion(prev => ({ ...prev, unificar_en_pdf_default: e.target.checked }))
                setDirty(true)
              }}
              className="mt-0.5 h-4 w-4 accent-cyan-600 rounded"
            />
            <div className="text-xs">
              <span className="font-bold text-[var(--foreground)] block">
                Convertir y unificar imágenes en PDF limpio por defecto
              </span>
              <span className="text-[var(--secondary)] mt-0.5 block">
                Cuando está activo, incluso las imágenes sueltas se convierten a PDF (utilizando la plantilla oficial de documento PDF en WhatsApp en lugar de la plantilla de imagen).
              </span>
            </div>
          </label>

          {/* Aplicar Carátula por defecto */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] cursor-pointer">
            <input
              type="checkbox"
              disabled={!canEdit || !caratulaActiva}
              checked={caratulaActiva && operacion.aplicar_caratula_default}
              onChange={(e) => {
                setOperacion(prev => ({ ...prev, aplicar_caratula_default: e.target.checked }))
                setDirty(true)
              }}
              className="mt-0.5 h-4 w-4 accent-cyan-600 rounded"
            />
            <div className="text-xs">
              <span className="font-bold text-[var(--foreground)] block">
                Incluir membrete / carátula institucional Centrovisión por defecto
              </span>
              <span className="text-[var(--secondary)] mt-0.5 block">
                Define el estado inicial del checkbox en `/estudios-tecnicos` cuando la carátula institucional está habilitada globalmente.
              </span>
              {!caratulaActiva && (
                <span className="mt-1.5 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                  <AlertTriangle size={12} />
                  La carátula está desactivada globalmente en la sub-pestaña Carátula de Estudios.
                </span>
              )}
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
