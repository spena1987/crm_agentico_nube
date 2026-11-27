'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Send,
  Settings,
  Sliders,
  Trash2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'

type TabKey = 'estado' | 'config' | 'mapeos' | 'envios'

interface EncuestasConfig {
  activo: boolean
  pausado_por_calidad: boolean
  motivo_pausa: string | null
  template_name: string
  template_language: string
  hora_envio_art: string
  hora_fin_envio_art: string
  ttl_dias_enlace: number
  surveymonkey_url: string
  jitter_min_seg: number
  jitter_max_seg: number
  batch_size: number
  max_envios_dia: number
  reserva_diaria_estudios: number
}

interface LineHealth {
  configured: boolean
  quality_rating: string | null
  messaging_limit_tier: string | null
  display_phone_number: string | null
  estudios_24h: number
  encuestas_24h: number
}

interface TemplateStatus {
  exists: boolean
  name: string
  status: string | null
  category: string | null
  language: string | null
  updated_at: string | null
}

interface MapeoItem {
  id: number
  tipo_entidad: 'servicio' | 'prestador' | 'sede'
  geclisa_id: string
  geclisa_nombre_raw: string
  unidad_negocio: 'consultas' | 'estudios' | 'excluido'
  nombre_canonico: string
  incluir_en_envio: boolean
}

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60'

const CARD_CLASS =
  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100'

export default function EncuestasAdminPage() {
  const { isAdmin, can } = usePermissions()
  const canEdit = isAdmin || can('encuestas', 'editar')
  const canExecute = isAdmin || can('encuestas', 'ejecutar')

  const [tab, setTab] = useState<TabKey>('estado')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [config, setConfig] = useState<EncuestasConfig | null>(null)
  const [lineHealth, setLineHealth] = useState<LineHealth | null>(null)
  const [ultimoLote, setUltimoLote] = useState<any>(null)
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus | null>(null)

  const [mapeos, setMapeos] = useState<MapeoItem[]>([])
  const [filtroTipoMapeo, setFiltroTipoMapeo] = useState<string>('')

  const [envios, setEnvios] = useState<any[]>([])
  const [contadores, setContadores] = useState<any>(null)
  const [optOuts, setOptOuts] = useState<any[]>([])
  const [nuevoOptOutTel, setNuevoOptOutTel] = useState('')

  const [fechaLote, setFechaLote] = useState('')
  const [dryRunResult, setDryRunResult] = useState<any>(null)

  const loadConfigAndHealth = useCallback(async () => {
    const res = await apiFetch('/api/encuestas/config')
    if (!res.ok) throw new Error('No se pudo cargar la configuración de encuestas.')
    const json = await res.json()
    setConfig(json.config)
    setLineHealth(json.line_health)
    setUltimoLote(json.ultimo_lote)
    setTemplateStatus(json.template_status || null)
  }, [])

  const loadMapeos = useCallback(async (tipo?: string) => {
    const tipoVal = tipo !== undefined ? tipo : filtroTipoMapeo
    const qs = tipoVal ? `?tipo_entidad=${encodeURIComponent(tipoVal)}` : ''
    const res = await apiFetch(`/api/encuestas/mapeos${qs}`)
    if (!res.ok) throw new Error('No se pudieron cargar los mapeos de Geclisa.')
    const json = await res.json()
    setMapeos(json.items || [])
  }, [filtroTipoMapeo])

  const loadEnviosYOptOuts = useCallback(async (fecha?: string) => {
    const fechaVal = fecha !== undefined ? fecha : fechaLote
    const qs = fechaVal ? `?fecha=${encodeURIComponent(fechaVal)}` : ''
    const [rEnv, rOpt] = await Promise.all([
      apiFetch(`/api/encuestas/envios${qs}`),
      apiFetch('/api/encuestas/opt-outs'),
    ])
    if (rEnv.ok) {
      const jEnv = await rEnv.json()
      setEnvios(jEnv.items || [])
      setContadores(jEnv.contadores || null)
    }
    if (rOpt.ok) {
      const jOpt = await rOpt.json()
      setOptOuts(jOpt.items || [])
    }
  }, [fechaLote])

  const reloadAll = useCallback(async () => {
    try {
      setLoading(true)
      await Promise.all([loadConfigAndHealth(), loadMapeos(), loadEnviosYOptOuts()])
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error cargando módulo de encuestas.' })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConfigAndHealth])

  useEffect(() => {
    reloadAll()
  }, [reloadAll])

  useEffect(() => {
    loadMapeos(filtroTipoMapeo).catch(() => {})
  }, [filtroTipoMapeo, loadMapeos])

  useEffect(() => {
    loadEnviosYOptOuts(fechaLote).catch(() => {})
  }, [fechaLote, loadEnviosYOptOuts])

  const handleSaveConfig = async (override?: Partial<EncuestasConfig>) => {
    if (!config || !canEdit) return
    try {
      setSaving(true)
      setFeedback(null)
      const body = { ...config, ...(override || {}) }
      const res = await apiFetch('/api/encuestas/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Error guardando configuración.')
      setConfig(json.config)
      await loadConfigAndHealth()
      setFeedback({ type: 'ok', text: 'Configuración guardada.' })
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'No se pudo guardar.' })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateMetaTemplate = async () => {
    if (!canEdit) return
    try {
      setTemplateBusy(true)
      setFeedback(null)
      const res = await apiFetch('/api/encuestas/plantilla/crear', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'No se pudo crear la plantilla en Meta.')
      await loadConfigAndHealth()
      setFeedback({
        type: 'ok',
        text: 'Plantilla enviada a Meta para revisión. Sincronizando estado...',
      })
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error creando plantilla en Meta.' })
    } finally {
      setTemplateBusy(false)
    }
  }

  const handleSyncMetaTemplate = async () => {
    if (!canEdit) return
    try {
      setTemplateBusy(true)
      setFeedback(null)
      const res = await apiFetch('/api/encuestas/plantilla/sincronizar', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'No se pudieron sincronizar plantillas desde Meta.')
      await loadConfigAndHealth()
      setFeedback({ type: 'ok', text: 'Plantillas sincronizadas desde Meta correctamente.' })
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error sincronizando plantillas desde Meta.' })
    } finally {
      setTemplateBusy(false)
    }
  }

  const handleUpdateMapeo = async (item: MapeoItem, patch: Partial<MapeoItem>) => {
    if (!canEdit) return
    try {
      setFeedback(null)
      const res = await apiFetch(`/api/encuestas/mapeos/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Error actualizando mapeo.')
      setMapeos((prev) => prev.map((m) => (m.id === item.id ? json.item : m)))
      setFeedback({ type: 'ok', text: `Mapeo actualizado para ${item.geclisa_nombre_raw}.` })
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error actualizando mapeo.' })
    }
  }

  const handleEjecutarLote = async (dryRun: boolean, despacharAhora = false) => {
    if (!canExecute) return
    if (!dryRun) {
      const msg = despacharAhora
        ? '¿Confirmás generar el lote real e iniciar el envío por WhatsApp Línea 2?'
        : '¿Confirmás generar y encolar el lote real en base de datos?'
      if (!window.confirm(msg)) return
    }
    try {
      setSaving(true)
      setFeedback(null)
      const res = await apiFetch('/api/encuestas/ejecutar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fechaLote || null,
          dry_run: dryRun,
          despachar_ahora: despacharAhora,
          guardar_mapeos: dryRun,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Error ejecutando lote.')
      setDryRunResult(json.resumen)
      const nuevas = json.resumen?.entidades_nuevas_detectadas?.length ?? 0
      setFeedback({
        type: 'ok',
        text: dryRun
          ? `Simulación dry_run completada (${json.resumen?.atendidos ?? 0} atendidos, ${nuevas} entidades nuevas cargadas en Mapeos Geclisa).`
          : `Lote generado (${json.resumen?.envios_creados ?? 0} envíos).`,
      })
      await Promise.all([
        loadMapeos(),
        loadEnviosYOptOuts(),
        !dryRun ? loadConfigAndHealth() : Promise.resolve(),
      ])
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Fallo al ejecutar lote.' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddOptOut = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || !nuevoOptOutTel.trim()) return
    try {
      setFeedback(null)
      const res = await apiFetch('/api/encuestas/opt-outs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: nuevoOptOutTel.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Teléfono inválido.')
      setNuevoOptOutTel('')
      await loadEnviosYOptOuts()
      setFeedback({ type: 'ok', text: 'Baja agregada.' })
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error registrando baja.' })
    }
  }

  const handleDeleteOptOut = async (id: number) => {
    if (!canEdit) return
    try {
      const res = await apiFetch(`/api/encuestas/opt-outs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar la baja.')
      await loadEnviosYOptOuts()
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error eliminando baja.' })
    }
  }

  if (loading && !config) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Cargando módulo de Encuestas...</span>
      </div>
    )
  }

  const tplStatusUpper = (templateStatus?.status || '').toUpperCase()
  const tplBadgeClass =
    tplStatusUpper === 'APPROVED'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      : tplStatusUpper === 'PENDING'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      : tplStatusUpper === 'REJECTED'
      ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Encuestas de Satisfacción
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Distribución automática D+1 vía WhatsApp Línea 2 hacia SurveyMonkey Team Advantage
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reloadAll}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {config?.pausado_por_calidad && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Envíos pausados por calidad:</strong> {config.motivo_pausa || 'Degradación detectada en Línea 2.'}
            </span>
          </div>
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveConfig({ pausado_por_calidad: false, motivo_pausa: null })}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              Reanudar envíos
            </button>
          )}
        </div>
      )}

      {ultimoLote?.estado === 'fallido' && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <span>
            <strong>Fallo en último lote ({ultimoLote.fecha_atencion}):</strong> {ultimoLote.error_detalle || 'Error consultando Geclisa.'}
          </span>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {(
          [
            ['estado', 'Estado de Línea', Activity],
            ['config', 'Configuración', Settings],
            ['mapeos', 'Mapeos Geclisa', Sliders],
            ['envios', 'Envíos y Bajas', Ban],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'estado' && lineHealth && config && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${CARD_CLASS} p-4`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">Quality Rating Línea 2</p>
            <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {lineHealth.quality_rating || 'Sin datos'}
            </p>
          </div>
          <div className={`${CARD_CLASS} p-4`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">Messaging Limit Tier</p>
            <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {lineHealth.messaging_limit_tier || 'Sin datos'}
            </p>
          </div>
          <div className={`${CARD_CLASS} p-4`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">Estudios 24h vs Reserva</p>
            <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {lineHealth.estudios_24h} / {config.reserva_diaria_estudios} res.
            </p>
          </div>
          <div className={`${CARD_CLASS} p-4`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">Encuestas 24h vs Tope</p>
            <p className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">
              {lineHealth.encuestas_24h} / {config.max_envios_dia}
            </p>
          </div>
        </div>
      )}

      {tab === 'config' && config && (
        <div className={`${CARD_CLASS} p-5 space-y-5`}>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Módulo activo</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Desactivar para pausar inmediatamente generación y envíos.
              </p>
            </div>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={config.activo}
              onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
              className="w-5 h-5 accent-blue-600"
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Plantilla en Meta:
                </span>
                <code className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                  {templateStatus?.name || config.template_name}
                </code>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${tplBadgeClass}`}>
                  {templateStatus?.exists ? tplStatusUpper || 'SIN ESTADO' : 'No registrada en Meta'}
                </span>
                {templateStatus?.category && (
                  <span className="text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                    Categoría: {templateStatus.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Por seguridad, las plantillas con prefijo <code>encuesta_</code> permanecen ocultas en Chat y HCE y se gestionan desde aquí.
              </p>
              {templateStatus?.category && templateStatus.category.toUpperCase() === 'MARKETING' && (
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  Atención: Meta categorizó esta plantilla como MARKETING. Monitoreá los rechazos 131049 y el quality rating.
                </p>
              )}
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                {!templateStatus?.exists && (
                  <button
                    type="button"
                    disabled={templateBusy}
                    onClick={handleCreateMetaTemplate}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {templateBusy ? 'Enviando...' : 'Crear y enviar a Meta'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={templateBusy}
                  onClick={handleSyncMetaTemplate}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 text-slate-700 dark:text-slate-200 text-xs font-medium"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${templateBusy ? 'animate-spin' : ''}`} />
                  Sincronizar desde Meta
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">URL Web Link SurveyMonkey</span>
              <input
                type="url"
                disabled={!canEdit}
                value={config.surveymonkey_url}
                onChange={(e) => setConfig({ ...config, surveymonkey_url: e.target.value })}
                placeholder="https://es.surveymonkey.com/r/..."
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Plantilla Meta</span>
              <input
                type="text"
                disabled={!canEdit}
                value={config.template_name}
                onChange={(e) => setConfig({ ...config, template_name: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Idioma de plantilla</span>
              <input
                type="text"
                disabled={!canEdit}
                value={config.template_language}
                onChange={(e) => setConfig({ ...config, template_language: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Vigencia enlace (días)</span>
              <input
                type="number"
                disabled={!canEdit}
                value={config.ttl_dias_enlace}
                onChange={(e) => setConfig({ ...config, ttl_dias_enlace: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Inicio envío ART (HH:MM)</span>
              <input
                type="text"
                disabled={!canEdit}
                value={config.hora_envio_art}
                onChange={(e) => setConfig({ ...config, hora_envio_art: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Fin envío ART (HH:MM)</span>
              <input
                type="text"
                disabled={!canEdit}
                value={config.hora_fin_envio_art}
                onChange={(e) => setConfig({ ...config, hora_fin_envio_art: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Jitter mínimo (seg)</span>
              <input
                type="number"
                step="0.5"
                disabled={!canEdit}
                value={config.jitter_min_seg}
                onChange={(e) => setConfig({ ...config, jitter_min_seg: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Jitter máximo (seg)</span>
              <input
                type="number"
                step="0.5"
                disabled={!canEdit}
                value={config.jitter_max_seg}
                onChange={(e) => setConfig({ ...config, jitter_max_seg: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Tamaño de bloque (batch_size)</span>
              <input
                type="number"
                disabled={!canEdit}
                value={config.batch_size}
                onChange={(e) => setConfig({ ...config, batch_size: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Tope diario (max_envios_dia)</span>
              <input
                type="number"
                disabled={!canEdit}
                value={config.max_envios_dia}
                onChange={(e) => setConfig({ ...config, max_envios_dia: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Reserva diaria estudios</span>
              <input
                type="number"
                disabled={!canEdit}
                value={config.reserva_diaria_estudios}
                onChange={(e) => setConfig({ ...config, reserva_diaria_estudios: Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </label>
          </div>

          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveConfig()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Guardar configuración
            </button>
          )}
        </div>
      )}

      {tab === 'mapeos' && (
        <div className={`${CARD_CLASS} p-5 space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Mapeo manual y exclusiones de Geclisa</h2>
            <select
              value={filtroTipoMapeo}
              onChange={(e) => setFiltroTipoMapeo(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm"
            >
              <option value="">Todos los tipos</option>
              <option value="servicio">Servicios</option>
              <option value="sede">Sedes</option>
              <option value="prestador">Prestadores</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-900 dark:text-slate-100">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">ID Geclisa</th>
                  <th className="py-2 pr-3">Nombre Geclisa</th>
                  <th className="py-2 pr-3">Unidad</th>
                  <th className="py-2 pr-3">Nombre Canónico</th>
                  <th className="py-2">Incluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {mapeos.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{m.tipo_entidad}</td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{m.geclisa_id}</td>
                    <td className="py-2 pr-3 text-slate-800 dark:text-slate-200">{m.geclisa_nombre_raw}</td>
                    <td className="py-2 pr-3">
                      <select
                        disabled={!canEdit}
                        value={m.unidad_negocio}
                        onChange={(e) =>
                          handleUpdateMapeo(m, { unidad_negocio: e.target.value as MapeoItem['unidad_negocio'] })
                        }
                        className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-xs"
                      >
                        <option value="consultas">consultas</option>
                        <option value="estudios">estudios</option>
                        <option value="excluido">excluido</option>
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        defaultValue={m.nombre_canonico}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value.trim() !== m.nombre_canonico) {
                            handleUpdateMapeo(m, { nombre_canonico: e.target.value.trim() })
                          }
                        }}
                        className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-xs w-48"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={m.incluir_en_envio}
                        onChange={(e) => handleUpdateMapeo(m, { incluir_en_envio: e.target.checked })}
                        className="accent-blue-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'envios' && (
        <div className="space-y-5">
          <div className={`${CARD_CLASS} p-5 flex flex-wrap items-end gap-3`}>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Fecha de atención (opcional)</span>
              <input
                type="date"
                value={fechaLote}
                onChange={(e) => setFechaLote(e.target.value)}
                className="block rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
            </label>
            {canExecute && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleEjecutarLote(true, false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 dark:text-slate-100 text-sm font-medium"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {saving ? 'Consultando Geclisa...' : 'Simular dry_run'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleEjecutarLote(false, false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium"
                >
                  {saving ? 'Procesando...' : 'Encolar lote (recuperación)'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleEjecutarLote(false, true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium"
                >
                  {saving ? 'Procesando...' : 'Encolar y despachar ahora'}
                </button>
              </>
            )}
          </div>

          {dryRunResult && (
            <div className={`${CARD_CLASS} p-4 space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Resultado del lote ({dryRunResult.fecha_atencion || 'sin fecha'}){dryRunResult.dry_run ? ' · Simulación' : ''}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Agenda total: {dryRunResult.total_agenda ?? 0} · Atendidos: {dryRunResult.atendidos ?? 0} · Válidos: {dryRunResult.validos ?? 0} · Omitidos por mapeo: {dryRunResult.omitidos_mapeo_excluido ?? 0} · Entidades nuevas: {dryRunResult.entidades_nuevas_detectadas?.length ?? 0}
                  </p>
                </div>
                {((dryRunResult.entidades_nuevas_detectadas?.length ?? 0) > 0 || (dryRunResult.omitidos_mapeo_excluido ?? 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => setTab('mapeos')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Ir a Mapeos Geclisa
                  </button>
                )}
              </div>
              <div className="bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-3 text-xs overflow-x-auto">
                <pre>{JSON.stringify(dryRunResult, null, 2)}</pre>
              </div>
            </div>
          )}

          {contadores && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className={`${CARD_CLASS} p-3`}>Enviados: <strong>{contadores.enviados}</strong></div>
              <div className={`${CARD_CLASS} p-3`}>Entregados / Leídos: <strong>{contadores.entregados} / {contadores.leidos}</strong></div>
              <div className={`${CARD_CLASS} p-3`}>Turnos con clic: <strong>{contadores.turnos_con_clic}</strong></div>
              <div className={`${CARD_CLASS} p-3`}>Rechazos 131049: <strong>{contadores.rechazos_131049}</strong></div>
            </div>
          )}

          <div className={`${CARD_CLASS} p-5 space-y-3`}>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Últimos envíos ({envios.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-900 dark:text-slate-100">
                <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Teléfono</th>
                    <th className="py-2 pr-3">Cola</th>
                    <th className="py-2 pr-3">WA Status</th>
                    <th className="py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {envios.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-3">{e.fecha_atencion}</td>
                      <td className="py-2 pr-3">{e.telefono_e164}</td>
                      <td className="py-2 pr-3">{e.estado_cola}</td>
                      <td className="py-2 pr-3">{e.wa_status || '-'}</td>
                      <td className="py-2">{e.wa_error_code ? `${e.wa_error_code}: ${e.wa_error_message || ''}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${CARD_CLASS} p-5 space-y-3`}>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Bajas registradas (opt-out)</h2>
            {canEdit && (
              <form onSubmit={handleAddOptOut} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={nuevoOptOutTel}
                  onChange={(e) => setNuevoOptOutTel(e.target.value)}
                  placeholder="Ej. 2615551234"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white text-sm font-medium"
                >
                  Agregar baja manual
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {optOuts.map((o) => (
                <div key={o.id} className="py-2 flex items-center justify-between">
                  <span className="text-slate-900 dark:text-slate-100">
                    {o.telefono_e164} <span className="text-xs text-slate-500 dark:text-slate-400">({o.origen})</span>
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOptOut(o.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1"
                      title="Quitar baja"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
