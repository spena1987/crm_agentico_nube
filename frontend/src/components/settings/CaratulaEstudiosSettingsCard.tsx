'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText,
  Smartphone,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCcw,
  Sliders,
  Layers,
  Sparkles,
  Palette,
  ExternalLink,
  Building2,
  Phone,
  MessageSquare
} from 'lucide-react'
import { BACKEND_URL, apiFetch } from '@/lib/api'

interface CaratulaConfig {
  activo: boolean
  modo_hibrido: boolean
  titulo_informe: string
  subtitulo: string
  color_primario: string
  color_secundario: string
  mostrar_ficha: boolean
  mostrar_tecnico: boolean
  mostrar_cobertura: boolean
  mostrar_sedes: boolean
  sedes: string[]
  telefono_0800: string
  whatsapp_contacto: string
  texto_indicaciones: string
  pie_legal: string
}

const DEFAULT_CONFIG: CaratulaConfig = {
  activo: true,
  modo_hibrido: true,
  titulo_informe: 'INFORME DE DIAGNÓSTICO OFTALMOLÓGICO',
  subtitulo: 'CENTROVISIÓN • OFTALMOLOGÍA INTEGRAL',
  color_primario: '#007A87',
  color_secundario: '#0F172A',
  mostrar_ficha: true,
  mostrar_tecnico: true,
  mostrar_cobertura: true,
  mostrar_sedes: true,
  sedes: [
    'Mitre 540 | Ciudad de Mendoza',
    'Roca 71 | Luján de Cuyo | Mendoza',
    'Boedo 2879 | Carrodilla - Luján de Cuyo'
  ],
  telefono_0800: '0-800-222-4040',
  whatsapp_contacto: '261 553-0888',
  texto_indicaciones: 'Presente este informe a su médico oftalmólogo en su próxima consulta de control.',
  pie_legal: 'Documento e informe técnico generado electrónicamente por Centrovisión Oftalmología Integral.'
}

const COLOR_PRESETS = [
  { name: 'Teal Centrovisión', hex: '#007A87' },
  { name: 'Azul Médico', hex: '#1E3A8A' },
  { name: 'Celeste Clínico', hex: '#0284C7' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Pizarra Oscura', hex: '#334155' }
]

export default function CaratulaEstudiosSettingsCard() {
  const [config, setConfig] = useState<CaratulaConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [previewTab, setPreviewTab] = useState<'mobile' | 'a4'>('mobile')
  const [previewEstudio, setPreviewEstudio] = useState('OCT Macular y Papilar')
  const [previewOjo, setPreviewOjo] = useState<'AO' | 'OD' | 'OI'>('AO')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await apiFetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.caratula_estudios) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...data.caratula_estudios,
            sedes: Array.isArray(data.caratula_estudios.sedes) && data.caratula_estudios.sedes.length > 0
              ? data.caratula_estudios.sedes
              : DEFAULT_CONFIG.sedes
          })
        }
      }
    } catch (e) {
      console.warn('Error cargando configuración de carátulas:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setFeedback(null)
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caratula_estudios: config
        })
      })
      if (res.ok) {
        setFeedback({
          type: 'success',
          msg: '¡Configuración del Diseñador de Carátulas guardada correctamente!'
        })
      } else {
        const err = await res.json()
        setFeedback({
          type: 'error',
          msg: err.detail || 'Error al guardar la configuración.'
        })
      }
    } catch (e: any) {
      setFeedback({ type: 'error', msg: e.message || 'Error de conexión.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSedeChange = (index: number, val: string) => {
    const newSedes = [...config.sedes]
    newSedes[index] = val
    setConfig({ ...config, sedes: newSedes })
  }

  const handleAddSede = () => {
    setConfig({ ...config, sedes: [...config.sedes, 'Nueva sede'] })
  }

  const handleRemoveSede = (index: number) => {
    const newSedes = config.sedes.filter((_, i) => i !== index)
    setConfig({ ...config, sedes: newSedes })
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--secondary)] animate-pulse">
        Cargando configuración del Diseñador de Carátulas...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Informativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-teal-900/20 via-cyan-900/10 to-slate-900/30 border border-teal-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-teal-500/15 text-teal-400">
              <FileText size={20} />
            </span>
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              Diseñador de Carátulas & Membretes de Estudios
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Opción 2 • Híbrido Mobile-First
            </span>
          </div>
          <p className="text-xs text-[var(--secondary)] max-w-2xl">
            Personaliza el membrete oficial, la carátula formal A4 y la lámina clínica digital que reciben los pacientes por WhatsApp y que se archiva en la historia clínica de Geclisa.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-95 text-white font-semibold text-xs transition-all shadow-lg shadow-teal-900/30 disabled:opacity-50"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
          {saving ? 'Guardando...' : 'Guardar Diseñador'}
        </button>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Grid: Editor a la Izquierda | Live Preview a la Derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: CONTROLES DE DISEÑO (7 Cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Tarjeta 1: Modos y Switches Maestros */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--secondary)] flex items-center gap-1.5">
              <Sliders size={13} className="text-teal-500" />
              Comportamiento del Generador
            </h4>

            {/* Switch Activar */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] cursor-pointer">
              <div>
                <p className="text-xs font-bold text-[var(--foreground)]">Activar Carátula Institucional</p>
                <p className="text-[11px] text-[var(--secondary)]">
                  Estampa automáticamente el membrete de Centrovisión antes de subir a Geclisa y enviar por WhatsApp.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.activo}
                onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
            </label>

            {/* Switch Modo Híbrido */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] cursor-pointer">
              <div>
                <p className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <Smartphone size={13} className="text-teal-500" />
                  Modo Híbrido Mobile-First (Recomendado)
                </p>
                <p className="text-[11px] text-[var(--secondary)]">
                  Si el técnico sube 1 sola imagen, genera una lámina unificada en 1 sola página para abrir directamente en WhatsApp. Si es PDF multipágina, antepone la carátula A4 formal.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.modo_hibrido}
                onChange={(e) => setConfig({ ...config, modo_hibrido: e.target.checked })}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Tarjeta 2: Identidad y Textos */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--secondary)] flex items-center gap-1.5">
              <Palette size={13} className="text-teal-500" />
              Textos e Identidad Visual
            </h4>

            <div>
              <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1">
                Título del Informe Médico
              </label>
              <input
                type="text"
                value={config.titulo_informe}
                onChange={(e) => setConfig({ ...config, titulo_informe: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1">
                Subtítulo Institucional
              </label>
              <input
                type="text"
                value={config.subtitulo}
                onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Presets de Color */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1.5">
                Color de Acento Institucional
              </label>
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => setConfig({ ...config, color_primario: p.hex })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                      config.color_primario.toLowerCase() === p.hex.toLowerCase()
                        ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                        : 'border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--secondary)]'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.hex }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Sedes y Teléfonos Oficiales */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--secondary)] flex items-center gap-1.5">
              <Building2 size={13} className="text-teal-500" />
              Líneas de Contacto y Sedes de Centrovisión
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1 flex items-center gap-1">
                  <Phone size={11} className="text-teal-500" /> Teléfono Gratuito / Urgencias
                </label>
                <input
                  type="text"
                  value={config.telefono_0800}
                  onChange={(e) => setConfig({ ...config, telefono_0800: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1 flex items-center gap-1">
                  <MessageSquare size={11} className="text-teal-500" /> WhatsApp Oficial Recepción
                </label>
                <input
                  type="text"
                  value={config.whatsapp_contacto}
                  onChange={(e) => setConfig({ ...config, whatsapp_contacto: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-[var(--foreground)]">
                  Sedes Clínicas (Mitre, Roca, Boedo)
                </label>
                <button
                  type="button"
                  onClick={handleAddSede}
                  className="text-[10px] text-teal-500 hover:underline font-semibold"
                >
                  + Agregar sede
                </button>
              </div>
              <div className="space-y-1.5">
                {config.sedes.map((sede, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={sede}
                      onChange={(e) => handleSedeChange(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {config.sedes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSede(idx)}
                        className="text-xs text-rose-500 hover:text-rose-400 px-2 py-1"
                        title="Eliminar sede"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tarjeta 4: Campos Dinámicos y Textos de Ayuda */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--secondary)] flex items-center gap-1.5">
              <Layers size={13} className="text-teal-500" />
              Campos Dinámicos Visibles
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mostrar_ficha}
                  onChange={(e) => setConfig({ ...config, mostrar_ficha: e.target.checked })}
                  className="accent-teal-600 rounded"
                />
                <span className="text-[var(--foreground)] font-medium">Ficha Geclisa (#)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mostrar_tecnico}
                  onChange={(e) => setConfig({ ...config, mostrar_tecnico: e.target.checked })}
                  className="accent-teal-600 rounded"
                />
                <span className="text-[var(--foreground)] font-medium">Técnico Operador</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mostrar_cobertura}
                  onChange={(e) => setConfig({ ...config, mostrar_cobertura: e.target.checked })}
                  className="accent-teal-600 rounded"
                />
                <span className="text-[var(--foreground)] font-medium">Obra Social / Plan</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mostrar_sedes}
                  onChange={(e) => setConfig({ ...config, mostrar_sedes: e.target.checked })}
                  className="accent-teal-600 rounded"
                />
                <span className="text-[var(--foreground)] font-medium">Sedes y Teléfonos</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1">
                Indicaciones Clínicas para el Paciente
              </label>
              <textarea
                value={config.texto_indicaciones}
                onChange={(e) => setConfig({ ...config, texto_indicaciones: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: LIVE PREVIEW INTERACTIVO (6 Cols) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Header de Previsualización */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)]">
            <div className="flex items-center gap-1.5">
              <Eye size={15} className="text-teal-500" />
              <span className="text-xs font-bold text-[var(--foreground)]">Previsualización en Vivo</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setPreviewTab('mobile')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  previewTab === 'mobile'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                <Smartphone size={12} />
                Lámina Móvil (WhatsApp)
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('a4')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  previewTab === 'a4'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                <FileText size={12} />
                Carátula A4 Formal
              </button>
            </div>
          </div>

          {/* Maqueta Interactiva de la Hoja */}
          <div className="p-4 rounded-2xl bg-slate-200 dark:bg-slate-950 border border-[var(--border)] flex flex-col items-center justify-center min-h-[580px] overflow-hidden">
            {previewTab === 'mobile' ? (
              /* VISTA MÓVIL: Lámina unificada de 1 sola página */
              <div className="w-[340px] bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col text-[11px]">
                {/* Banner Oficial Centrovisión */}
                <div className="p-2 border-b border-slate-200 bg-white flex justify-center">
                  <img
                    src="/branding/centrovision_banner.png"
                    alt="Centrovisión Banner"
                    className="w-full h-auto object-contain max-h-12"
                  />
                </div>

                {/* Barra Clínica */}
                <div
                  className="px-3 py-2 border-y flex flex-col gap-0.5"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderColor: config.color_primario
                  }}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[12px] truncate" style={{ color: config.color_primario }}>
                      {previewEstudio}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-100 text-teal-800 font-mono">
                      Ojo: {previewOjo}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">
                    PEÑA, JUAN SEBASTIAN • DNI 33.516.799 • 23/10/2026
                  </div>
                </div>

                {/* Área del Scan Médico */}
                <div className="p-3 bg-slate-900 flex-1 flex flex-col items-center justify-center text-center min-h-[220px]">
                  <div className="w-full h-44 rounded border border-slate-700 bg-slate-800/80 flex flex-col items-center justify-center p-2 relative overflow-hidden">
                    {/* Gráfico decorativo de OCT / Topografía */}
                    <div className="w-24 h-24 rounded-full border-4 border-dashed border-teal-500/60 flex items-center justify-center mb-1 animate-pulse">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-500/40 via-cyan-400/40 to-emerald-400/40 flex items-center justify-center text-[9px] font-bold text-white">
                        MAPA AO
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-teal-300">
                      [ Imagen de Alta Definición del Equipo ]
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Escalado proporcional sin recortes
                    </span>
                  </div>
                </div>

                {/* Pie Institucional */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[9px] text-slate-500 space-y-0.5">
                  <div className="font-semibold text-slate-700">
                    Centrovisión • Urgencias: {config.telefono_0800} | WhatsApp: {config.whatsapp_contacto}
                  </div>
                  <div className="truncate text-slate-500">
                    {config.sedes.join(' • ')}
                  </div>
                  <div className="text-[8px] text-slate-400 italic">
                    {config.texto_indicaciones}
                  </div>
                </div>
              </div>
            ) : (
              /* VISTA A4: Carátula Formal de Página 1 */
              <div className="w-[380px] bg-white text-slate-900 rounded-lg shadow-2xl border border-slate-300 p-5 flex flex-col text-[10px] space-y-3 min-h-[520px]">
                {/* Banner */}
                <div className="border-b border-slate-200 pb-2">
                  <img
                    src="/branding/centrovision_banner.png"
                    alt="Centrovisión Banner"
                    className="w-full h-auto object-contain max-h-11"
                  />
                </div>

                {/* Título de Informe */}
                <div className="text-center space-y-0.5">
                  <h5 className="font-bold text-[12px] uppercase" style={{ color: config.color_primario }}>
                    {config.titulo_informe}
                  </h5>
                  <p className="text-[8px] text-slate-400 font-semibold tracking-wider">
                    {config.subtitulo}
                  </p>
                </div>

                {/* Card Estudio */}
                <div
                  className="p-2.5 rounded border flex items-center justify-between"
                  style={{
                    backgroundColor: '#F0FDFA',
                    borderColor: config.color_primario
                  }}
                >
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase block">Estudio Solicitado</span>
                    <span className="font-bold text-[11px] text-slate-900">{previewEstudio}</span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[9px] font-bold text-white"
                    style={{ backgroundColor: config.color_primario }}
                  >
                    Lateralidad: {previewOjo}
                  </span>
                </div>

                {/* Grilla Paciente */}
                <div className="border border-slate-200 rounded overflow-hidden text-[9px]">
                  <div className="grid grid-cols-4 border-b border-slate-200">
                    <span className="p-1.5 bg-slate-100 font-bold text-slate-600">PACIENTE</span>
                    <span className="p-1.5 font-bold text-slate-900 col-span-3">PEÑA, JUAN SEBASTIAN</span>
                  </div>
                  <div className="grid grid-cols-4 border-b border-slate-200">
                    <span className="p-1.5 bg-slate-100 font-bold text-slate-600">D.N.I.</span>
                    <span className="p-1.5 text-slate-800">33.516.799</span>
                    <span className="p-1.5 bg-slate-100 font-bold text-slate-600">FICHA</span>
                    <span className="p-1.5 text-slate-800">#242646</span>
                  </div>
                  <div className="grid grid-cols-4 border-b border-slate-200">
                    <span className="p-1.5 bg-slate-100 font-bold text-slate-600">COBERTURA</span>
                    <span className="p-1.5 text-slate-800">OSDE (210)</span>
                    <span className="p-1.5 bg-slate-100 font-bold text-slate-600">TÉCNICO</span>
                    <span className="p-1.5 text-slate-800">TARIFEÑO, C.</span>
                  </div>
                  <div className="grid grid-cols-4">
                    <span className="p-1.5 bg-slate-100 font-bold text-slate-600">FECHA/HORA</span>
                    <span className="p-1.5 text-slate-800 col-span-3">23/10/2026 • 10:57 hs</span>
                  </div>
                </div>

                {/* Cuadro de Aviso */}
                <div className="p-2 rounded bg-amber-50 border border-amber-300 text-[8.5px] text-amber-900">
                  <span className="font-bold block">Aviso Clínico:</span>
                  Las imágenes diagnósticas se adjuntan a continuación. {config.texto_indicaciones}
                </div>

                {/* Footer Sedes */}
                <div className="mt-auto pt-2 border-t border-slate-200 text-[8px] text-slate-500 text-center space-y-0.5">
                  <div>
                    Central: <b>{config.telefono_0800}</b> | WhatsApp: <b>{config.whatsapp_contacto}</b>
                  </div>
                  <div className="text-[7.5px] text-slate-400">
                    {config.sedes.join(' • ')}
                  </div>
                  <div className="text-[7px] text-slate-400 italic">
                    {config.pie_legal}
                  </div>
                </div>
              </div>
            )}

            {/* Enlace para abrir PDF Real */}
            <div className="mt-3 flex items-center gap-2">
              <a
                href={`${BACKEND_URL}/api/estudios-tecnicos/preview-caratula?modo=${previewTab}&tipo_estudio=${encodeURIComponent(
                  previewEstudio
                )}&ojo=${previewOjo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-teal-600 dark:text-teal-400 text-xs font-semibold border border-teal-500/30 transition-colors shadow-sm"
              >
                <ExternalLink size={12} />
                Abrir PDF Real de Muestra
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
