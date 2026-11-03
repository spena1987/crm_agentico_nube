'use client'

import React, { useState, useEffect } from 'react'
import {
  Cpu,
  PhoneCall,
  KeyRound,
  CheckCircle2,
  Sparkles,
  CalendarClock,
  Stethoscope,
  ShieldCheck,
  Search,
  Send,
  Save,
  Loader2,
  FileCheck2,
  AlertCircle,
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import { apiFetch } from '@/lib/api'
import { OpticaConfig } from '@/types/optica'

const DEFAULT_CONFIG: OpticaConfig = {
  waba_id: '3731563350343089',
  phone_number_id: '',
  display_phone_number: '',
  verified_name: 'Óptica Vortix',
  auto_turnos_activo: true,
  auto_turnos_dias_anticipacion: 1,
  auto_turnos_hora_envio: '10:00',
  auto_turnos_descuento_pct: 20,
  auto_turnos_placa_url: '',
  auto_turnos_template_name: 'optica_vortix_beneficio_turno',
  auto_turnos_excluir_quirurgicos: true,
  auto_turnos_servicios_excluidos: ['CIRUGIA', 'QUIROFANO', 'GUARDIA'],
  auto_recetas_modo: 'ASISTIDO',
  auto_recetas_delay_minutos: 45,
  auto_recetas_template_aereos: 'optica_vortix_receta_consulta',
  auto_recetas_template_contacto: 'optica_vortix_lentes_contacto',
  auto_recetas_keywords_aereos: [
    'receta de lentes',
    'lentes aéreos',
    'anteojos',
    'multifocal',
    'monofocal',
    'armazón',
    'control óptico',
  ],
  auto_recetas_keywords_contacto: ['lentes de contacto', 'blandos tóricos', 'adaptación lc'],
  auto_recetas_exclusiones_lio: ['lio', 'lente intraocular', 'facoe', 'catarata quirúrgica'],
  antibloqueo_cooldown_dias: 30,
  antibloqueo_jitter_min_seg: 35,
  antibloqueo_jitter_max_seg: 90,
  antibloqueo_ventana_horaria_inicio: '09:00',
  antibloqueo_ventana_horaria_fin: '20:00',
  antibloqueo_pausa_calidad_amarilla: true,
}

export default function OpticaAutomatizacionesPage() {
  const [config, setConfig] = useState<OpticaConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Estados de Vinculación Línea 3 Meta
  const [metodoCodigo, setMetodoCodigo] = useState<'SMS' | 'VOICE'>('SMS')
  const [pinSeisDigitos, setPinSeisDigitos] = useState('')
  const [linkingLine, setLinkingLine] = useState(false)
  const [provisioningTemplates, setProvisioningTemplates] = useState(false)

  // Estados de Dry-Run de Turnos de Mañana
  const [previewTurnos, setPreviewTurnos] = useState<any[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [syncingTurnos, setSyncingTurnos] = useState(false)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await apiFetch('/api/optica-vortix/config', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setConfig({ ...DEFAULT_CONFIG, ...(data.config || data) })
        }
      } catch {}
    }
    loadConfig()
  }, [])

  const handleSaveConfig = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/optica-vortix/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setFeedback({
          type: 'ok',
          text: 'Configuración de automatizaciones y Línea 3 guardada correctamente.',
        })
      }
    } catch {
      setFeedback({ type: 'err', text: 'No se pudo guardar la configuración.' })
    } finally {
      setSaving(false)
    }
  }

  const handleVincularLinea = async () => {
    setLinkingLine(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/optica-vortix/linea/vincular', {
        method: 'POST',
        body: JSON.stringify({
          waba_id: config.waba_id || '3731563350343089',
          phone_number_id: config.phone_number_id,
          display_phone_number: config.display_phone_number,
          verified_name: config.verified_name,
        }),
      })
      const data = await res.json()
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text: data.message || 'Línea 3 vinculada en el portafolio WABA 3731563350343089.',
      })
    } catch {
    } finally {
      setLinkingLine(false)
    }
  }

  const handleSolicitarCodigo = async () => {
    setLinkingLine(true)
    try {
      const res = await apiFetch('/api/optica-vortix/linea/solicitar-codigo', {
        method: 'POST',
        body: JSON.stringify({
          phone_number_id: config.phone_number_id,
          code_method: metodoCodigo,
        }),
      })
      const data = await res.json()
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text: data.message || `Código solicitado por ${metodoCodigo} a Meta.`,
      })
    } catch {
    } finally {
      setLinkingLine(false)
    }
  }

  const handleActivarPin = async () => {
    if (!pinSeisDigitos.trim()) return
    setLinkingLine(true)
    try {
      const res = await apiFetch('/api/optica-vortix/linea/activar-pin', {
        method: 'POST',
        body: JSON.stringify({
          phone_number_id: config.phone_number_id,
          pin: pinSeisDigitos.trim(),
        }),
      })
      const data = await res.json()
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text: data.message || 'Número registrado y PIN activado en Meta Cloud API.',
      })
    } catch {
    } finally {
      setLinkingLine(false)
    }
  }

  const handleAprovisionarPlantillas = async () => {
    setProvisioningTemplates(true)
    try {
      const res = await apiFetch('/api/optica-vortix/plantillas/aprovisionar-base', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text:
          data.message ||
          'Plantillas oficiales de Óptica Vortix enviadas a revisión en el WABA 3731563350343089.',
      })
    } catch {
    } finally {
      setProvisioningTemplates(false)
    }
  }

  const handleDryRunTurnos = async () => {
    setLoadingPreview(true)
    try {
      const res = await apiFetch(
        `/api/optica-vortix/oportunidades/preview-turnos?dias_anticipacion=${config.auto_turnos_dias_anticipacion}`,
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        setPreviewTurnos(Array.isArray(data) ? data : data.turnos || data.items || [])
      }
    } catch {
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleDispararEncoladoTurnos = async () => {
    setSyncingTurnos(true)
    try {
      const res = await apiFetch('/api/optica-vortix/oportunidades/sincronizar-turnos', {
        method: 'POST',
        body: JSON.stringify({
          dias_anticipacion: config.auto_turnos_dias_anticipacion,
          encolar_envios: true,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setFeedback({
          type: 'ok',
          text: `Se encolaron ${data.encolados ?? data.total ?? previewTurnos.length} vouchers de descuento para los turnos seleccionados.`,
        })
      }
    } catch {
    } finally {
      setSyncingTurnos(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <OpticaSubNavHeader
        rightSlot={
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Guardar Configuración</span>
          </button>
        }
      />

      <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-6">
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* SECCIÓN 1: Vinculación de Línea 3 (Óptica Vortix) en Meta Developers */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
                <PhoneCall size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--foreground)]">
                  1. Vinculación de Línea 3 (Óptica Vortix) en Meta Cloud API
                </h2>
                <p className="text-xs text-[var(--secondary)]">
                  Misma App de Meta Developers y mismo portafolio WABA (
                  <code className="font-mono font-bold text-indigo-500">3731563350343089</code>) con ruteo independiente por <code className="font-mono">phone_number_id</code>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAprovisionarPlantillas}
              disabled={provisioningTemplates}
              className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
            >
              {provisioningTemplates ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileCheck2 size={14} />
              )}
              <span>Aprovisionar Plantillas Base de Óptica en Meta</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                WABA ID Compartido
              </label>
              <input
                type="text"
                value={config.waba_id}
                onChange={(e) => setConfig({ ...config, waba_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Phone Number ID (Línea 3 Meta)
              </label>
              <input
                type="text"
                placeholder="Ej: 105998877665544"
                value={config.phone_number_id}
                onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Número de Teléfono (Óptica)
              </label>
              <input
                type="text"
                placeholder="+54 9 261 ..."
                value={config.display_phone_number}
                onChange={(e) => setConfig({ ...config, display_phone_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Nombre Visible Verificado
              </label>
              <input
                type="text"
                value={config.verified_name}
                onChange={(e) => setConfig({ ...config, verified_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleVincularLinea}
                disabled={linkingLine}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Vincular en Meta
              </button>

              <select
                value={metodoCodigo}
                onChange={(e) => setMetodoCodigo(e.target.value as any)}
                className="px-2.5 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
              >
                <option value="SMS">Código por SMS</option>
                <option value="VOICE">Llamada de Voz</option>
              </select>

              <button
                type="button"
                onClick={handleSolicitarCodigo}
                disabled={linkingLine}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
              >
                Solicitar Código
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="PIN 6 dígitos"
                value={pinSeisDigitos}
                onChange={(e) => setPinSeisDigitos(e.target.value)}
                className="w-32 px-3 py-2 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
              <button
                type="button"
                onClick={handleActivarPin}
                disabled={linkingLine}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
              >
                <KeyRound size={13} /> Activar PIN 2FA
              </button>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: Automatización 1 — Envío de Placa de Descuento a Turnos de Geclisa a N Días Vista */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <CalendarClock size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--foreground)]">
                  2. Automatización 1 — Envío de Placa de Descuento a Turnos de Geclisa a N Días Vista
                </h2>
                <p className="text-xs text-[var(--secondary)]">
                  Anticipa al paciente que mañana asiste a su consulta oftalmológica con un voucher de descuento para cotizar sus lentes al salir.
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.auto_turnos_activo}
                onChange={(e) => setConfig({ ...config, auto_turnos_activo: e.target.checked })}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-xs font-black">
                {config.auto_turnos_activo ? 'Automatización Activa' : 'Pausada'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Anticipación (N días antes)
              </label>
              <select
                value={config.auto_turnos_dias_anticipacion}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    auto_turnos_dias_anticipacion: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              >
                <option value={1}>1 día antes (Turnos de Mañana)</option>
                <option value={2}>2 días antes (48 hs)</option>
                <option value={3}>3 días antes (72 hs)</option>
                <option value={0}>Mismo día (08:00 hs)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Hora de Ejecución Diaria
              </label>
              <input
                type="time"
                value={config.auto_turnos_hora_envio}
                onChange={(e) =>
                  setConfig({ ...config, auto_turnos_hora_envio: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Descuento del Voucher (% OFF)
              </label>
              <input
                type="number"
                value={config.auto_turnos_descuento_pct}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    auto_turnos_descuento_pct: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Plantilla Meta Asociada
              </label>
              <input
                type="text"
                value={config.auto_turnos_template_name}
                onChange={(e) =>
                  setConfig({ ...config, auto_turnos_template_name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDryRunTurnos}
              disabled={loadingPreview}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm"
            >
              {loadingPreview ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              <span>🔍 Previsualizar Turnos de Mañana en Vivo (Dry-Run)</span>
            </button>

            {previewTurnos.length > 0 && (
              <button
                type="button"
                onClick={handleDispararEncoladoTurnos}
                disabled={syncingTurnos}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-sm"
              >
                {syncingTurnos ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>Encolar Envío de Vouchers a esta Lista ({previewTurnos.length})</span>
              </button>
            )}
          </div>

          {/* Tabla Dry-Run de Turnos de Mañana */}
          {previewTurnos.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] overflow-hidden mt-3">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-[var(--secondary)]">
                  <tr>
                    <th className="p-2.5 text-left">Paciente</th>
                    <th className="p-2.5 text-left">Teléfono Normalizado</th>
                    <th className="p-2.5 text-left">Médico / Servicio</th>
                    <th className="p-2.5 text-left">Cupón Generado</th>
                    <th className="p-2.5 text-left">Filtro Anti-Bloqueo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {previewTurnos.map((t, i) => (
                    <tr key={i}>
                      <td className="p-2.5 font-bold">{t.nombre_paciente || t.paciente}</td>
                      <td className="p-2.5 font-mono">+{t.telefono_normalizado || t.telefono}</td>
                      <td className="p-2.5">{t.medico_nombre || t.servicio_turno || 'Consulta'}</td>
                      <td className="p-2.5 font-bold text-amber-600">
                        {t.cupon_codigo || '#VORTIX-20'}
                      </td>
                      <td className="p-2.5">
                        {t.excluido || t.motivo_exclusion ? (
                          <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-600 text-[10px] font-bold">
                            Filtrado: {t.motivo_exclusion || 'Duplicado / Fijo'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 text-[10px] font-bold">
                            ✓ Apto para Envío
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECCIÓN 3: Automatización 2 — Detección de Indicaciones de Lentes Aéreos y Contacto en Historia Clínica */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Stethoscope size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--foreground)]">
                  3. Automatización 2 — Detección de Recetas de Lentes Aéreos y Contacto en Historia Clínica del Día
                </h2>
                <p className="text-xs text-[var(--secondary)]">
                  Escanea las evoluciones médicas de Geclisa detectando prescripciones ópticas y excluyendo estrictamente lentes intraoculares (LIO).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setConfig({ ...config, auto_recetas_modo: 'ASISTIDO' })}
              className={`p-4 rounded-2xl border text-left transition-all ${
                config.auto_recetas_modo === 'ASISTIDO'
                  ? 'border-indigo-600 bg-indigo-500/10'
                  : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <span className="text-xs font-black block">
                👩‍💼 Modo Asistido — Bandeja 1-Clic (Recomendado)
              </span>
              <span className="text-[11px] text-[var(--secondary)]">
                Las recetas detectadas hoy en Geclisa aparecen en &ldquo;Oportunidades del Día&rdquo; para que el óptico revise la evolución y dispare el mensaje con 1 clic.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setConfig({ ...config, auto_recetas_modo: 'AUTOMATICO' })}
              className={`p-4 rounded-2xl border text-left transition-all ${
                config.auto_recetas_modo === 'AUTOMATICO'
                  ? 'border-indigo-600 bg-indigo-500/10'
                  : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <span className="text-xs font-black block">
                🤖 Modo 100% Automático con Delay Post-Consulta
              </span>
              <span className="text-[11px] text-[var(--secondary)]">
                Encola automáticamente la invitación a cotizar {config.auto_recetas_delay_minutos} minutos después de cerrada la evolución médica en Geclisa.
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] space-y-2">
              <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                👓 Keywords Positivas (Lentes Aéreos)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {config.auto_recetas_keywords_aereos.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] space-y-2">
              <p className="text-[11px] font-black text-cyan-600 dark:text-cyan-400">
                💧 Keywords Positivas (Lentes de Contacto)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {config.auto_recetas_keywords_contacto.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 text-[10px] font-bold"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] space-y-2">
              <p className="text-[11px] font-black text-red-600 dark:text-red-400">
                🚫 Exclusiones Quirúrgicas (LIO / Catarata)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {config.auto_recetas_exclusiones_lio.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-300 text-[10px] font-bold"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
