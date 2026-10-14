'use client'

import React, { useState } from 'react'
import { Bot, User, Loader2 } from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'

interface ToggleHumanProps {
  conversacionId: string
  botDisabled: boolean
  onToggle: (disabled: boolean) => void
}

export default function ToggleHuman({ conversacionId, botDisabled, onToggle }: ToggleHumanProps) {
  const { can } = usePermissions()
  const canIntervene = can('chat', 'intervenir_bot')
  const [loading, setLoading] = useState(false)
  const [botGlobalActivo, setBotGlobalActivo] = useState<boolean | null>(null)

  React.useEffect(() => {
    async function checkGlobalBot() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/settings/automatismos`)
        if (res.ok) {
          const data = await res.json()
          if (typeof data.bot_gemini_activo === 'boolean') {
            setBotGlobalActivo(data.bot_gemini_activo)
          }
        }
      } catch (e) {
        // Fallback silencioso
      }
    }
    checkGlobalBot()
  }, [])

  const handleToggle = async () => {
    if (!canIntervene) return
    setLoading(true)
    const nextState = !botDisabled
    
    try {
      // 1. Doble persistencia directa en Supabase (Garantía instantánea ante fallas o latencia de red)
      try {
        const { data: convData } = await (supabase as any)
          .from('conversaciones')
          .select('metadata_json')
          .eq('id', conversacionId)
          .single()

        const currMeta: Record<string, any> = { ...((convData?.metadata_json as Record<string, any>) || {}) }
        if (nextState) {
          currMeta.bloqueo_humano_manual = true
          currMeta.bloqueado_at = new Date().toISOString()
          currMeta.ultimo_mensaje_humano_at = Math.floor(Date.now() / 1000)
        } else {
          currMeta.bloqueo_humano_manual = false
          currMeta.ultimo_mensaje_humano_at = 0
          currMeta.fallback_strikes = 0
        }

        await (supabase as any)
          .from('conversaciones')
          .update({
            bot_disabled: nextState,
            metadata_json: currMeta,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversacionId)
      } catch (errDb) {
        console.warn('Advertencia actualizando Supabase directamente en ToggleHuman:', errDb)
      }

      // 2. Llamar al backend para sincronizar el estado en FastAPI
      try {
        await fetch(
          `${BACKEND_URL}/api/conversaciones/${conversacionId}/toggle-bot`, 
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bot_disabled: nextState }),
          }
        )
      } catch (fetchErr) {
        console.warn('Advertencia en fetch backend toggle-bot:', fetchErr)
      }

      onToggle(nextState)
    } catch (error) {
      console.error('Error al alternar bot:', error)
      onToggle(nextState)
    } finally {
      setLoading(false)
    }
  }

  const isEffectivelyDisabled = botDisabled || botGlobalActivo === false

  return (
    <div className="flex items-center gap-2.5 bg-[#14203d] p-1.5 px-2.5 rounded-xl border border-slate-700/60 max-w-sm transition-all duration-200 shadow-inner">
      <div className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
        botGlobalActivo === false
          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
          : botDisabled 
          ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' 
          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
      }`}>
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isEffectivelyDisabled ? (
          <User size={16} />
        ) : (
          <Bot size={16} />
        )}
      </div>

      <div className="min-w-[120px]">
        <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
          Modo
        </p>
        <p className={`text-xs font-bold leading-tight ${botGlobalActivo === false ? 'text-amber-200' : 'text-slate-100'}`}>
          {botGlobalActivo === false ? 'Humano (Pausa General)' : botDisabled ? 'Humano' : 'Bot Gemini'}
        </p>
      </div>

      {/* Switch Switcher */}
      <button
        onClick={handleToggle}
        disabled={loading || !canIntervene}
        title={
          botGlobalActivo === false
            ? 'El Agente IA está pausado centralmente en Ajustes. Ningún mensaje se responderá automáticamente.'
            : !canIntervene 
            ? 'No tienes permiso para pausar o alternar el Bot IA' 
            : 'Alternar modo Humano / Bot'
        }
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 ${
          !canIntervene ? 'opacity-50 cursor-not-allowed' : ''
        } ${
          isEffectivelyDisabled ? (botGlobalActivo === false ? 'bg-amber-600' : 'bg-rose-600') : 'bg-emerald-600'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            isEffectivelyDisabled ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
