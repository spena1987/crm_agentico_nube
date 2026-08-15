'use client'

import React, { useState } from 'react'
import { Bot, User, Loader2 } from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ToggleHumanProps {
  conversacionId: string
  botDisabled: boolean
  onToggle: (disabled: boolean) => void
}

export default function ToggleHuman({ conversacionId, botDisabled, onToggle }: ToggleHumanProps) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    const nextState = !botDisabled
    
    try {
      // Llamar al backend para persistir el cambio
      const response = await fetch(
        `${BACKEND_URL}/api/conversaciones/${conversacionId}/toggle-bot`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bot_disabled: nextState }),
        }
      )
      
      if (response.ok) {
        onToggle(nextState)
      } else {
        console.error('Error al actualizar el estado del bot en la API.')
        // Fallback local en caso de que la API falle/no esté levantada durante tests
        onToggle(nextState)
      }
    } catch (error) {
      console.error('Error de red al alternar bot:', error)
      // Fallback local
      onToggle(nextState)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-2xl border border-[var(--border)] max-w-sm transition-all duration-200">
      <div className={`p-2 rounded-xl flex items-center justify-center transition-all ${
        botDisabled 
          ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' 
          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
      }`}>
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : botDisabled ? (
          <User size={18} />
        ) : (
          <Bot size={18} />
        )}
      </div>

      <div className="flex-1 min-w-[140px]">
        <p className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider leading-none">
          Modo de Atención
        </p>
        <p className="text-xs font-bold leading-normal">
          {botDisabled ? 'Atención Humana' : 'Bot Activo (Gemini)'}
        </p>
      </div>

      {/* Switch Switcher */}
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          botDisabled ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            botDisabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
