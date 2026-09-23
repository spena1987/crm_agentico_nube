'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertTriangle, ArrowRight, X, PhoneCall, Stethoscope } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export default function UrgentSurgeryGlobalBanner() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [urgencias, setUrgencias] = useState<any[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])

  // Cargar urgencias activas para este médico o clínica
  const fetchUrgencias = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('conversaciones')
        .select(`
          id,
          paciente_id,
          asignado_a_usuario_id,
          estado_gestion,
          ultimo_mensaje,
          metadata_json,
          pacientes (
            id,
            nombre,
            dni,
            telefono
          )
        `)
        .eq('estado_gestion', 'URGENCIA_POSTQUIRURGICA' as any)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error consultando urgencias quirúrgicas globales:', error)
        return
      }

      // Filtrar las pertinentes: asignadas a este médico o sin asignar (guardia general)
      const pertinentes = (data || []).filter((c: any) => {
        if (!c.asignado_a_usuario_id) return true
        return c.asignado_a_usuario_id === user.id
      })

      setUrgencias(pertinentes)
    } catch (err) {
      console.error('Error inesperado consultando urgencias globales:', err)
    }
  }

  useEffect(() => {
    fetchUrgencias()

    // Suscripción Realtime a cambios en conversaciones
    const channel = supabase
      .channel('urgencias-global-listener')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversaciones' },
        () => {
          fetchUrgencias()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Filtrar las que el usuario no haya descartado manualmente en esta sesión
  const urgenciaActiva = urgencias.find((u) => !dismissedIds.includes(u.id))

  // Si no hay urgencia activa, o ya estamos dentro de /chat con esa conversación seleccionada
  if (!urgenciaActiva) return null

  const pacienteNombre = urgenciaActiva.pacientes?.nombre || 'Paciente'
  const sintoma = urgenciaActiva.metadata_json?.motivo_detectado || urgenciaActiva.ultimo_mensaje || 'Molestia aguda'
  const ojo = urgenciaActiva.metadata_json?.contexto_quirurgico?.ojo || 'OD'

  const handleIrAlChat = () => {
    router.push(`/chat?conv=${urgenciaActiva.id}`)
  }

  const handleDismiss = () => {
    setDismissedIds((prev) => [...prev, urgenciaActiva.id])
  }

  return (
    <div className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-2.5 shadow-xl flex items-center justify-between gap-3 text-xs z-50 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className="p-1 rounded-lg bg-black/20 shrink-0 animate-pulse">
          <AlertTriangle size={16} className="text-white fill-white" />
        </span>
        <div className="truncate">
          <span className="font-extrabold tracking-wide uppercase mr-2 bg-black/30 px-1.5 py-0.5 rounded text-[10px]">
            🚨 ALERTA QUIRÚRGICA
          </span>
          <span className="font-semibold text-white">
            Tu paciente <strong>{pacienteNombre}</strong> (Ojo {ojo}) reportó síntomas de alarma por WhatsApp:
          </span>
          <span className="italic opacity-90 ml-1.5 truncate hidden sm:inline">
            "{sintoma}"
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleIrAlChat}
          className="px-3 py-1.5 rounded-lg bg-white text-red-700 hover:bg-red-50 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
        >
          <span>Atender Caso Ahora</span>
          <ArrowRight size={13} />
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-white/80 hover:text-white hover:bg-black/20 rounded-md transition-all cursor-pointer"
          title="Ocultar aviso"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
