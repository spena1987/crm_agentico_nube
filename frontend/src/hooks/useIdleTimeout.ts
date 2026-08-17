'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface SecurityConfig {
  inactividad_minutos: number
  aviso_segundos: number
  inactividad_habilitada: boolean
}

export function useIdleTimeout() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const [config, setConfig] = useState<SecurityConfig>({
    inactividad_minutos: 20,
    aviso_segundos: 60,
    inactividad_habilitada: true,
  })

  const [showWarning, setShowWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(60)

  // Referencias para temporizadores
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const configChannelRef = useRef<BroadcastChannel | null>(null)

  // 1. Cargar configuración de seguridad desde la API
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/security')
      const data = await res.json()
      if (data.config) {
        setConfig({
          inactividad_minutos: Number(data.config.inactividad_minutos ?? 20),
          aviso_segundos: Number(data.config.aviso_segundos ?? 60),
          inactividad_habilitada: Boolean(data.config.inactividad_habilitada ?? true),
        })
      }
    } catch (err) {
      console.error('Error cargando configuración de seguridad:', err)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // 2. Manejar cierre de sesión por inactividad
  const handlePerformLogout = useCallback(async () => {
    // Limpiar temporizadores
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setShowWarning(false)

    try {
      await signOut()
      router.push('/login?reason=inactivity')
    } catch (err) {
      console.error('Error al cerrar sesión por inactividad:', err)
      router.push('/login?reason=inactivity')
    }
  }, [signOut, router])

  // 3. Iniciar la cuenta regresiva del modal de advertencia
  const startWarningCountdown = useCallback(() => {
    setShowWarning(true)
    const warningDuration = config.aviso_segundos || 60
    setRemainingSeconds(warningDuration)

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    const startTime = Date.now()
    countdownIntervalRef.current = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
      const left = warningDuration - elapsedSeconds

      if (left <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
        handlePerformLogout()
      } else {
        setRemainingSeconds(left)
      }
    }, 500)
  }, [config.aviso_segundos, handlePerformLogout])

  // 4. Reiniciar ciclo de inactividad (reset timers)
  const resetTimer = useCallback(
    (syncWithOtherTabs = true) => {
      if (!config.inactividad_habilitada || !user) return

      lastActivityRef.current = Date.now()

      // Si el modal estaba abierto, cerrarlo y limpiar el intervalo
      setShowWarning(false)
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
      }

      // Tiempo antes de mostrar la advertencia = (inactividad_minutos * 60 - aviso_segundos) * 1000
      const totalIdleMs = config.inactividad_minutos * 60 * 1000
      const warningMs = config.aviso_segundos * 1000
      const timeBeforeWarning = Math.max(5000, totalIdleMs - warningMs)

      warningTimerRef.current = setTimeout(() => {
        startWarningCountdown()
      }, timeBeforeWarning)

      // Notificar a otras pestañas mediante BroadcastChannel
      if (syncWithOtherTabs && broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'ACTIVITY_PING', timestamp: Date.now() })
      }
    },
    [config, user, startWarningCountdown]
  )

  // 5. Inicializar listeners de actividad y canales de sincronización
  useEffect(() => {
    if (!user || !config.inactividad_habilitada) {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      setShowWarning(false)
      return
    }

    // Canal para sincronizar actividad entre pestañas
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannelRef.current = new BroadcastChannel('crm_idle_sync')
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data?.type === 'ACTIVITY_PING') {
          // Actividad registrada en otra pestaña, resetear localmente sin volver a emitir ping
          resetTimer(false)
        }
      }

      // Canal para escuchar cambios en los ajustes de seguridad
      configChannelRef.current = new BroadcastChannel('crm_security_config')
      configChannelRef.current.onmessage = (event) => {
        if (event.data?.type === 'CONFIG_UPDATED') {
          fetchConfig()
        }
      }
    }

    // Iniciar temporizador
    resetTimer(false)

    // Eventos a escuchar para detectar actividad humana con throttle de 1s
    let lastThrottle = 0
    const handleUserActivity = () => {
      const now = Date.now()
      if (now - lastThrottle > 1000) {
        lastThrottle = now
        resetTimer(true)
      }
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }))

    // Al volver a enfocar la ventana / pestaña
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsedSinceLastActivity = Date.now() - lastActivityRef.current
        const totalMaxIdleMs = config.inactividad_minutos * 60 * 1000

        if (elapsedSinceLastActivity >= totalMaxIdleMs) {
          handlePerformLogout()
        } else {
          resetTimer(true)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close()
        broadcastChannelRef.current = null
      }
      if (configChannelRef.current) {
        configChannelRef.current.close()
        configChannelRef.current = null
      }
    }
  }, [user, config, resetTimer, fetchConfig, handlePerformLogout])

  return {
    showWarning,
    remainingSeconds,
    totalWarningSeconds: config.aviso_segundos,
    continueSession: () => resetTimer(true),
    logoutNow: handlePerformLogout,
  }
}
