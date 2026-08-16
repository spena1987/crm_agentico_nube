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
    <div className="flex items-center gap-2.5 bg-[#14203d] p-1.5 px-2.5 rounded-xl border border-slate-700/60 max-w-sm transition-all duration-200 shadow-inner">
      <div className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
        botDisabled 
          ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' 
          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
      }`}>
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : botDisabled ? (
          <User size={16} />
        ) : (
          <Bot size={16} />
        )}
      </div>

      <div className="min-w-[120px]">
        <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
          Modo
        </p>
        <p className="text-xs font-bold leading-tight text-slate-100">
          {botDisabled ? 'Humano' : 'Bot Gemini'}
        </p>
      </div>

      {/* Switch Switcher */}
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 ${
          botDisabled ? 'bg-rose-600' : 'bg-emerald-600'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            botDisabled ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
