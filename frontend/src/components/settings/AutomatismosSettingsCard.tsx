'use client'

import React, { useState, useEffect } from 'react'
import {
  Cpu,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  MessageSquare,
  FileCheck,
  Bot,
  HardDrive,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
  Sparkles,
  HelpCircle
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface AutomatismosConfig {
  seguimiento_quirurgico_activo: boolean
  consentimiento_anticipado_activo: boolean
  consentimiento_respetar_ventana_meta: boolean
  bot_gemini_activo: boolean
  purga_multimedia_activa: boolean
  dias_retencion_multimedia: number
}

const DEFAULT_CONFIG: AutomatismosConfig = {
  seguimiento_quirurgico_activo: true,
  consentimiento_anticipado_activo: false,
  consentimiento_respetar_ventana_meta: true,
  bot_gemini_activo: true,
  purga_multimedia_activa: true,
  dias_retencion_multimedia: 30
}

export default function AutomatismosSettingsCard() {
  const [config, setConfig] = useState<AutomatismosConfig>(DEFAULT_CONFIG)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const fetchConfig = async () => {
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/settings/automatismos`)
      const data = await res.json()
      if (res.ok && data.success && data.automatismos) {
        setConfig((prev) => ({
          ...prev,
          ...data.automatismos
        }))
      }
    } catch (err: any) {
      console.error('Error cargando configuración de automatismos:', err)
      setError('No se pudo conectar con el servidor para obtener los automatismos.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleGuardar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setGuardando(true)
      setError(null)

      const res = await fetch(`${BACKEND_URL}/api/settings/automatismos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al guardar la configuración.')
      }

      setMensajeExito('✔ Automatismos actualizados y sincronizados en toda la clínica.')
      setTimeout(() => setMensajeExito(null), 4000)
    } catch (err: any) {
      console.error('Error guardando automatismos:', err)
      setError(err.message || 'Error al persistir cambios.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2 bg-[var(--card)] rounded-2xl border border-[var(--border)]">
        <Loader2 size={16} className="animate-spin text-blue-500" />
        <span>Cargando panel central de automatismos...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Principal del Centro de Automatismos */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-5 rounded-2xl bg-[var(--card)] border border-cyan-500/20 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-inner">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-[var(--foreground)]">
                Centro de Automatismos del CRM
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                Gobernanza Central
              </span>
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Monitoreo y switches maestros de todos los procesos en segundo plano, tareas periódicas y envíos autónomos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchConfig()}
            disabled={guardando}
            className="p-2.5 bg-neutral-900 hover:bg-neutral-800 text-gray-300 border border-[var(--border)] rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Refrescar estado"
          >
            <RefreshCw size={14} className={guardando ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => handleGuardar()}
            disabled={guardando}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            {guardando ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={14} />
                Guardar Automatismos
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alertas de Error o Éxito */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mensajeExito && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* 2. Directiva de Arquitectura Institucional */}
      <div className="p-4 rounded-xl bg-neutral-950/70 border border-indigo-500/30 text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
          <Sparkles size={14} className="text-indigo-400" />
          <span>Directiva de Arquitectura & Protección Asistencial</span>
        </div>
        <p className="text-gray-400 leading-relaxed text-[11.5px]">
          Para preservar la experiencia del paciente y evitar comunicaciones invasivas no solicitadas,{' '}
          <strong>todo automatismo o tarea programada debe estar gobernada desde este Centro</strong>. Si un proceso
          está pausado centralmente, el servidor omite cualquier contacto en segundo plano y transfiere el 100% del control
          a los operadores y asesoras de forma manual.
        </p>
      </div>

      {/* 3. Rejilla de Automatismos */}
      <div className="grid grid-cols-1 gap-4">

        {/* AUTOMATISMO 1: SEGUIMIENTO QUIRÚRGICO */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          config.seguimiento_quirurgico_activo
            ? 'bg-gradient-to-r from-emerald-950/20 via-slate-900/50 to-[var(--card)] border-emerald-500/30'
            : 'bg-gradient-to-r from-amber-950/20 via-slate-900/50 to-[var(--card)] border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full ${config.seguimiento_quirurgico_activo ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <h4 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <MessageSquare size={16} className="text-emerald-400" />
                  Motor de Seguimiento Automatizado Quirúrgico (WhatsApp)
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  config.seguimiento_quirurgico_activo
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {config.seguimiento_quirurgico_activo ? '🟢 Activo' : '⏸️ Pausado'}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                  <Clock size={11} /> Cada 2 horas
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)] leading-relaxed max-w-2xl">
                Escanea casos en estado <em>En Asesoramiento</em> o <em>En Análisis</em> para despachar toques de cadencia programada
                (D+3, D+8, D+18 y aviso de caducidad arancelaria D+13). Al pausarlo, no se despachará ningún mensaje de seguimiento en frío.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.seguimiento_quirurgico_activo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, seguimiento_quirurgico_activo: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* AUTOMATISMO 2: CONSENTIMIENTO INFORMADO ANTICIPADO */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          config.consentimiento_anticipado_activo
            ? 'bg-gradient-to-r from-blue-950/20 via-slate-900/50 to-[var(--card)] border-blue-500/30'
            : 'bg-gradient-to-r from-neutral-950/40 via-slate-900/50 to-[var(--card)] border-neutral-700/60'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full ${config.consentimiento_anticipado_activo ? 'bg-blue-400 animate-pulse' : 'bg-neutral-500'}`} />
                <h4 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <FileCheck size={16} className="text-blue-400" />
                  Envío Automático Anticipado de Consentimiento (D-3 a D-1)
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  config.consentimiento_anticipado_activo
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}>
                  {config.consentimiento_anticipado_activo ? '🟢 Envíos Automáticos Habilitados' : '⏸️ Solo a Demanda Manual (Recomendado)'}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                  <Clock size={11} /> Cada 6 horas
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)] leading-relaxed max-w-2xl">
                Revisa cirugías programadas para los próximos 1 a 3 días y despacha el enlace de firma del consentimiento a los pacientes que aún no firmaron.
                Al mantenerlo en <strong>Solo a Demanda Manual</strong>, el consentimiento no se envía automáticamente, requiriendo que la asesora o quirófano presione el botón de envío cuando lo considere oportuno.
              </p>

              {/* Sub-opción: Proteger contra ventana de 24h Meta */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.consentimiento_respetar_ventana_meta}
                    onChange={(e) => setConfig((prev) => ({ ...prev, consentimiento_respetar_ventana_meta: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-700 bg-neutral-900 text-blue-600 focus:ring-0"
                  />
                  <span>
                    <strong>Protección Meta:</strong> Si la ventana de 24h está cerrada, omitir envío de texto libre para evitar rechazos (Error 131047 / Re-engagement).
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.consentimiento_anticipado_activo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, consentimiento_anticipado_activo: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* AUTOMATISMO 3: BOT GEMINI */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          config.bot_gemini_activo
            ? 'bg-gradient-to-r from-teal-950/20 via-slate-900/50 to-[var(--card)] border-teal-500/30'
            : 'bg-gradient-to-r from-amber-950/20 via-slate-900/50 to-[var(--card)] border-amber-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full ${config.bot_gemini_activo ? 'bg-teal-400 animate-pulse' : 'bg-amber-400'}`} />
                <h4 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <Bot size={16} className="text-teal-400" />
                  Agente IA Gemini (Respuestas Autónomas WhatsApp)
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  config.bot_gemini_activo
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {config.bot_gemini_activo ? '🟢 Activo en Toda la Clínica' : '⏸️ Pausado Centralmente'}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                  <Clock size={11} /> En tiempo real
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)] leading-relaxed max-w-2xl">
                Permite al agente conversacional responder dudas de pacientes, orientar sobre turnos y clasificar consultas.
                Al pausarlo, ningún mensaje entrante recibirá respuesta automática y todo pasará directamente a las asesoras humanas.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.bot_gemini_activo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bot_gemini_activo: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* AUTOMATISMO 4: PURGA DE MULTIMEDIA */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          config.purga_multimedia_activa
            ? 'bg-gradient-to-r from-purple-950/20 via-slate-900/50 to-[var(--card)] border-purple-500/30'
            : 'bg-gradient-to-r from-neutral-950/40 via-slate-900/50 to-[var(--card)] border-neutral-700/60'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full ${config.purga_multimedia_activa ? 'bg-purple-400' : 'bg-neutral-500'}`} />
                <h4 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <HardDrive size={16} className="text-purple-400" />
                  Mantenimiento y Purga Automática de Almacenamiento
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  config.purga_multimedia_activa
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}>
                  {config.purga_multimedia_activa ? '🟢 Activo' : '⏸️ Inactivo'}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                  <Clock size={11} /> Diario (03:00 hs)
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)] leading-relaxed max-w-2xl">
                Limpia automáticamente los archivos multimedia temporales (audios, fotos, notas de voz) con más de {config.dias_retencion_multimedia} días de antigüedad en el servidor para optimizar espacio en disco.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.purga_multimedia_activa}
                  onChange={(e) => setConfig((prev) => ({ ...prev, purga_multimedia_activa: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
