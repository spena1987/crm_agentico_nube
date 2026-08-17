'use client'

import React, { useState, useEffect } from 'react'
import { 
  ShieldCheck, 
  Timer, 
  Bell, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  RefreshCw,
  Info
} from 'lucide-react'

export default function SecuritySettingsCard() {
  const [inactividadMinutos, setInactividadMinutos] = useState(20)
  const [avisoSegundos, setAvisoSegundos] = useState(60)
  const [inactividadHabilitada, setInactividadHabilitada] = useState(true)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Cargar configuración inicial
  const loadConfig = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/security')
      const data = await res.json()

      if (data.config) {
        setInactividadMinutos(data.config.inactividad_minutos ?? 20)
        setAvisoSegundos(data.config.aviso_segundos ?? 60)
        setInactividadHabilitada(data.config.inactividad_habilitada ?? true)
      }
    } catch (err) {
      console.error('Error al cargar configuración de seguridad:', err)
      setFeedback({ type: 'error', message: 'Error al conectar con el servidor.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  // Guardar configuración
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/settings/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inactividad_minutos: inactividadMinutos,
          aviso_segundos: avisoSegundos,
          inactividad_habilitada: inactividadHabilitada,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar la configuración.')
      }

      setFeedback({
        type: 'success',
        message: 'Parámetros de seguridad y sesión guardados con éxito. Se aplicarán en tiempo real a todos los usuarios.',
      })

      // Notificar por BroadcastChannel al hook local para recargar sin refrescar
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('crm_security_config')
        bc.postMessage({ type: 'CONFIG_UPDATED' })
        bc.close()
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-xs font-medium">Cargando parámetros de seguridad...</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
                Seguridad & Caducidad de Sesión
              </h2>
              <p className="text-xs text-[var(--secondary)]">
                Configura el tiempo máximo de inactividad antes de bloquear el acceso para proteger los expedientes clínicos.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadConfig}
          disabled={loading || saving}
          className="p-2 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs flex items-center gap-1.5 self-start sm:self-auto"
          title="Recargar configuración"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="text-[11px] font-bold">Recargar</span>
        </button>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Toggle Habilitar/Deshabilitar */}
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-xs font-bold text-[var(--foreground)] flex items-center gap-2">
              <Lock size={14} className="text-blue-600" />
              Cierre Automático por Inactividad
            </label>
            <p className="text-[11px] text-[var(--secondary)]">
              Si está activo, el sistema monitoreará el mouse y teclado para cerrar sesión cuando el consultorio quede desatendido.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={inactividadHabilitada}
              onChange={(e) => setInactividadHabilitada(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Parámetros de Tiempo */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 transition-opacity ${!inactividadHabilitada ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Tiempo de Inactividad */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
              <Timer size={16} />
              <span>Tiempo de Inactividad Permitido</span>
            </div>
            <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
              Tiempo que debe transcurrir sin ninguna interacción (mouse, clics, teclado, scroll) antes de activar el aviso preventivo.
            </p>

            <select
              value={inactividadMinutos}
              onChange={(e) => setInactividadMinutos(Number(e.target.value))}
              className="w-full p-2.5 text-xs font-bold border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value={5}>5 minutos (Alta rotación de consultorios)</option>
              <option value={10}>10 minutos</option>
              <option value={15}>15 minutos (Recomendado estándar)</option>
              <option value={20}>20 minutos (Por defecto)</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos (1 hora)</option>
            </select>
          </div>

          {/* Tiempo de Advertencia */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <Bell size={16} />
              <span>Tiempo de Advertencia Previa (Modal)</span>
            </div>
            <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
              Segundos durante los cuales se mostrará el modal emergente con cuenta regresiva para que el usuario pueda cancelar el cierre.
            </p>

            <select
              value={avisoSegundos}
              onChange={(e) => setAvisoSegundos(Number(e.target.value))}
              className="w-full p-2.5 text-xs font-bold border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value={30}>30 segundos</option>
              <option value={60}>60 segundos (1 minuto - Recomendado)</option>
              <option value={120}>120 segundos (2 minutos)</option>
            </select>
          </div>
        </div>

        {/* Banner Informativo de Cumplimiento Médico */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-3">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-blue-900 dark:text-blue-200">
            <p className="font-bold">¿Cómo protege esto a la clínica?</p>
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              Si un médico u operador deja su computadora encendida al salir a atender una emergencia o finalizar su turno, el sistema cerrará la sesión tras <strong>{inactividadMinutos} minutos</strong> de inactividad, evitando que pacientes o personas ajenas puedan visualizar información médica confidencial.
            </p>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2 glow-primary disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Guardar Configuración de Seguridad</span>
          </button>
        </div>
      </form>
    </div>
  )
}
