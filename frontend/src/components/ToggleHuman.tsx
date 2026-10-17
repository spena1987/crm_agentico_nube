'use client'

import React, { useState } from 'react'
import { Bot, User, Sparkles, Loader2 } from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'

export type ModoAtencion = 'autonomo' | 'copiloto' | 'humano'

interface ToggleHumanProps {
  conversacionId: string
  botDisabled: boolean
  modoAtencion?: ModoAtencion
  onToggle?: (disabled: boolean) => void
  onModoChange?: (modo: ModoAtencion) => void
}

export default function ToggleHuman({
  conversacionId,
  botDisabled,
  modoAtencion,
  onToggle,
  onModoChange,
}: ToggleHumanProps) {
  const { can } = usePermissions()
  const canIntervene = can('chat', 'intervenir_bot')
  const [loading, setLoading] = useState(false)
  const [botGlobalActivo, setBotGlobalActivo] = useState<boolean | null>(null)

  // Determinar modo actual efectivo alineado con el estado real del bot en base de datos
  const effectiveModo: ModoAtencion = botDisabled ? 'humano' : (modoAtencion || 'autonomo')

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

  const handleChangeModo = async (targetModo: ModoAtencion) => {
    const isBotDisabled = targetModo === 'humano'
    if (!canIntervene || loading || (targetModo === effectiveModo && isBotDisabled === botDisabled)) return
    setLoading(true)

    try {
      // 1. Persistencia directa en Supabase
      try {
        const { data: convData } = await (supabase as any)
          .from('conversaciones')
          .select('metadata_json')
          .eq('id', conversacionId)
          .single()

        const currMeta: Record<string, any> = { ...((convData?.metadata_json as Record<string, any>) || {}) }
        currMeta.modo_atencion = targetModo

        if (targetModo === 'humano') {
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
            bot_disabled: isBotDisabled,
            metadata_json: currMeta,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversacionId)
      } catch (errDb) {
        console.warn('Advertencia actualizando Supabase directamente en ToggleHuman:', errDb)
      }

      // 2. Llamar al backend para sincronizar
      try {
        await fetch(
          `${BACKEND_URL}/api/conversaciones/${conversacionId}/toggle-bot`, 
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              bot_disabled: isBotDisabled,
              modo_atencion: targetModo
            }),
          }
        )
      } catch (fetchErr) {
        console.warn('Advertencia en fetch backend toggle-bot:', fetchErr)
      }

      if (onToggle) onToggle(isBotDisabled)
      if (onModoChange) onModoChange(targetModo)
    } catch (error) {
      console.error('Error al cambiar modo de atención:', error)
      if (onToggle) onToggle(isBotDisabled)
      if (onModoChange) onModoChange(targetModo)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1 bg-[#0f172a] p-1 rounded-xl border border-slate-700/70 shadow-inner">
      {/* Botón 1: Autónomo */}
      <button
        type="button"
        onClick={() => handleChangeModo('autonomo')}
        disabled={loading || !canIntervene || botGlobalActivo === false}
        title={
          botGlobalActivo === false
            ? 'Bot pausado globalmente'
            : 'Modo Autónomo: El Asistente IA responde automáticamente a las dudas frecuentes del paciente.'
        }
        className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          effectiveModo === 'autonomo' && botGlobalActivo !== false
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        } ${!canIntervene || botGlobalActivo === false ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Bot size={13} className={effectiveModo === 'autonomo' && botGlobalActivo !== false ? 'text-emerald-200' : ''} />
        <span className="hidden sm:inline">Autónomo</span>
      </button>

      {/* Botón 2: Copiloto (Recomendado) */}
      <button
        type="button"
        onClick={() => handleChangeModo('copiloto')}
        disabled={loading || !canIntervene || botGlobalActivo === false}
        title={
          botGlobalActivo === false
            ? 'Bot pausado globalmente'
            : 'Modo Copiloto (Recomendado): La IA redacta sugerencias para que el asesor las revise y apruebe en 1 clic antes de enviar.'
        }
        className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          effectiveModo === 'copiloto' && botGlobalActivo !== false
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        } ${!canIntervene || botGlobalActivo === false ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Sparkles size={13} className={effectiveModo === 'copiloto' && botGlobalActivo !== false ? 'text-amber-300' : ''} />
        <span className="hidden sm:inline">Copiloto</span>
        <span className="text-[9px] bg-blue-500/30 text-blue-200 px-1 py-0.2 rounded font-normal hidden md:inline">HITL</span>
      </button>

      {/* Botón 3: Humano */}
      <button
        type="button"
        onClick={() => handleChangeModo('humano')}
        disabled={loading || !canIntervene}
        title="Modo Humano: Atención médica/secretaría 100% manual. La IA se mantiene en silencio absoluto."
        className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          effectiveModo === 'humano' || botGlobalActivo === false
            ? 'bg-rose-600 text-white shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        } ${!canIntervene ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <User size={13} className={effectiveModo === 'humano' ? 'text-rose-200' : ''} />
        )}
        <span className="hidden sm:inline">Humano</span>
      </button>

      {botGlobalActivo === false && (
        <span className="text-[9.5px] font-bold text-amber-300 px-1.5 py-0.5 bg-amber-950/60 rounded border border-amber-800/40 hidden lg:inline" title="El bot está desactivado a nivel clínica en Ajustes">
          Pausa Global
        </span>
      )}
    </div>
  )
}
