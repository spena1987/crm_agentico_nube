'use client'

import React, { useEffect } from 'react'
import { ShieldAlert, LogOut, CheckCircle, Clock } from 'lucide-react'

interface IdleWarningModalProps {
  remainingSeconds: number
  totalWarningSeconds: number
  onContinue: () => void
  onLogout: () => void
}

export default function IdleWarningModal({
  remainingSeconds,
  totalWarningSeconds,
  onContinue,
  onLogout,
}: IdleWarningModalProps) {
  // Permitir cancelar presionando Enter o Espacio o Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onContinue()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onContinue])

  // Porcentaje restante para la barra de progreso
  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / (totalWarningSeconds || 60)) * 100))

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
      <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Barra superior de progreso de tiempo restante */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Icono de Seguridad */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/10 animate-bounce">
          <ShieldAlert size={34} />
        </div>

        {/* Título y Mensaje */}
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight text-[var(--foreground)]">
            ¿Sigues ahí?
          </h2>
          <p className="text-xs text-[var(--secondary)] leading-relaxed">
            Por razones de seguridad y confidencialidad médica, tu sesión se cerrará automáticamente por inactividad.
          </p>
        </div>

        {/* Segundero Grande */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <Clock size={12} />
            Tu sesión caduca en
          </span>
          <span className="text-3xl font-black text-amber-500 font-mono tracking-tight">
            {remainingSeconds}s
          </span>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-1/2 py-3 px-4 border border-[var(--border)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={15} />
            <span>Cerrar Sesión</span>
          </button>

          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="w-full sm:w-1/2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-xl glow-primary flex items-center justify-center gap-2"
          >
            <CheckCircle size={15} />
            <span>Continuar Trabajando</span>
          </button>
        </div>

        <p className="text-[10px] text-slate-400">
          💡 Puedes presionar <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-[var(--border)] rounded text-[9px] font-mono">Enter</kbd> o mover el mouse para continuar.
        </p>
      </div>
    </div>
  )
}
