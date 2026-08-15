'use client'

import React, { useState, useEffect } from 'react'
import { Bot, Sparkles, Sliders, ShieldAlert, Save, CheckCircle2, Plus, X } from 'lucide-react'

export default function BotSettingsCard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [botEnabled, setBotEnabled] = useState(true)
  const [typingDelay, setTypingDelay] = useState(3)
  const [modelName, setModelName] = useState('gemini-2.5-flash')
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [systemOverride, setSystemOverride] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('http://localhost:8000/api/settings')
      if (res.ok) {
        const data = await res.json()
        const bot = data.bot || {}
        setBotEnabled(bot.enabled ?? true)
        setTypingDelay(bot.typing_delay_seconds ?? 3)
        setModelName(bot.model_name || 'gemini-2.5-flash')
        setKeywords(bot.human_escalation_keywords || ['urgencia', 'operador', 'humano'])
        setSystemOverride(bot.system_instructions_override || '')
      }
    } catch (err) {
      console.error('Error cargando configuración del bot:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newKeyword.trim().toLowerCase()
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed])
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setFeedback(null)
      const payload = {
        bot: {
          enabled: botEnabled,
          typing_delay_seconds: Number(typingDelay),
          model_name: modelName,
          human_escalation_keywords: keywords,
          system_instructions_override: systemOverride
        }
      }
      const res = await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setFeedback('¡Ajustes del agente de IA guardados exitosamente!')
        setTimeout(() => setFeedback(null), 4000)
      }
    } catch (err) {
      console.error('Error guardando ajustes:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Switch Maestro del Bot */}
      <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-blue-600/10 text-blue-600">
              <Bot size={26} />
            </div>
            <div>
              <h3 className="font-bold text-base">Atención Automática por IA (Gemini 2.5)</h3>
              <p className="text-xs text-[var(--secondary)]">
                Permite al agente responder mensajes entrantes, responder dudas y generar presupuestos médicos.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={botEnabled} 
              onChange={(e) => setBotEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Grid de Parámetros del Bot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Parámetros de Simulación y Modelo */}
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-blue-600" />
            <h4 className="font-bold text-sm">Comportamiento y Modelo</h4>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Modelo de Inteligencia Artificial
            </label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Rápido y Eficiente - Recomendado)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Razonamiento Complejo)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--secondary)]">
                Retardo de Escritura Humana Simulada
              </label>
              <span className="text-xs font-bold text-blue-600">{typingDelay} segundos</span>
            </div>
            <input 
              type="range"
              min={1}
              max={8}
              value={typingDelay}
              onChange={(e) => setTypingDelay(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-[11px] text-[var(--secondary)] mt-1">
              Evita respuestas robóticas inmediatas, haciendo que el paciente perciba una atención natural.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Directivas Personalizadas de la Clínica (System Prompt)
            </label>
            <textarea
              rows={4}
              value={systemOverride}
              onChange={(e) => setSystemOverride(e.target.value)}
              placeholder="Ej: Recuerda a los pacientes traer su documento nacional de identidad y acudir en ayunas para análisis de sangre..."
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Palabras Clave de Escalamiento Humano */}
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-amber-500" />
            <h4 className="font-bold text-sm">Escalamiento a Operador Humano</h4>
          </div>
          <p className="text-xs text-[var(--secondary)]">
            Si un paciente envía alguna de estas palabras, el bot se pausará automáticamente para que un operador humano tome el control en el CRM.
          </p>

          <form onSubmit={handleAddKeyword} className="flex gap-2">
            <input 
              type="text"
              placeholder="Ej: urgencia, dolor, reclamo..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 glow-primary transition-all"
            >
              <Plus size={14} />
              <span>Añadir</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center gap-1.5"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(kw)}
                  className="hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* Botón Guardar y Feedback */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {feedback && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 glow-primary transition-all shadow-md disabled:opacity-50"
        >
          <Save size={15} />
          <span>{saving ? 'Guardando Ajustes...' : 'Guardar Configuración de IA'}</span>
        </button>
      </div>
    </div>
  )
}
