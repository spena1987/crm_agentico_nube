'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  clasificarLecturaEscaneo,
  TipoClasificacionEscaneo,
  Gs1ParsedData,
  normalizarDistorsionTecladoEscaner
} from '@/lib/gs1Parser'
import {
  reproducirBeepScan,
  reproducirBeepExito,
  reproducirBeepAlerta
} from '@/lib/audioFeedback'

export interface SmartScannerOptions {
  enabled?: boolean
  reproducirAudio?: boolean
  onScanPaciente?: (turnoId: string, rawCode: string) => void
  onScanLio?: (gs1: Gs1ParsedData, rawCode: string) => void
  onScanGtin?: (gtin14: string, rawCode: string) => void
  onScanGeneral?: (resultado: TipoClasificacionEscaneo) => void
}

export function useSmartScannerEngine({
  enabled = true,
  reproducirAudio = true,
  onScanPaciente,
  onScanLio,
  onScanGtin,
  onScanGeneral
}: SmartScannerOptions = {}) {
  const [ultimoEscaneo, setUltimoEscaneo] = useState<TipoClasificacionEscaneo | null>(null)
  const [estaEscaneando, setEstaEscaneando] = useState<boolean>(false)

  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const burstCountRef = useRef<number>(0)
  const timeoutClearRef = useRef<NodeJS.Timeout | null>(null)

  // Guardar callbacks en refs para evitar re-suscribir el listener en cada render
  const callbacksRef = useRef({ onScanPaciente, onScanLio, onScanGtin, onScanGeneral, reproducirAudio })
  useEffect(() => {
    callbacksRef.current = { onScanPaciente, onScanLio, onScanGtin, onScanGeneral, reproducirAudio }
  })

  useEffect(() => {
    if (!enabled) return

    const despacharCodigoEscaneado = (rawCode: string, isInput?: boolean, target?: HTMLElement | null) => {
      if (!rawCode || rawCode.length < 4) return

      // Si el foco estaba en un input y el escáner escribió caracteres dentro, limpiarlos
      if (isInput && target && 'value' in target) {
        const inputElem = target as HTMLInputElement
        if (inputElem.value && inputElem.value.includes(rawCode)) {
          inputElem.value = inputElem.value.replace(rawCode, '').trim()
          inputElem.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }

      if (callbacksRef.current.reproducirAudio) {
        reproducirBeepScan()
      }

      setEstaEscaneando(true)
      setTimeout(() => setEstaEscaneando(false), 800)

      // Clasificar código mediante el motor GS1 / Pulsera con normalización de teclado
      const rawLimpio = normalizarDistorsionTecladoEscaner(rawCode)
      const clasificacion = clasificarLecturaEscaneo(rawLimpio)
      setUltimoEscaneo(clasificacion)

      // Disparar callbacks específicos
      if (clasificacion.tipo === 'PULSERA_PACIENTE') {
        callbacksRef.current.onScanPaciente?.(clasificacion.turnoId, rawLimpio)
      } else if (clasificacion.tipo === 'LIO_DATAMATRIX') {
        callbacksRef.current.onScanLio?.(clasificacion.gs1, rawLimpio)
      } else if (clasificacion.tipo === 'CODIGO_1D_GTIN') {
        callbacksRef.current.onScanGtin?.(clasificacion.gtin14, rawLimpio)
      }

      callbacksRef.current.onScanGeneral?.(clasificacion)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTimeRef.current
      lastKeyTimeRef.current = currentTime

      // Si el intervalo entre teclas es largo (> 90ms) y teníamos pocos caracteres (< 4), reiniciar buffer
      if (timeDiff > 90 && bufferRef.current.length > 0 && bufferRef.current.length < 4) {
        bufferRef.current = ''
        burstCountRef.current = 0
      }

      // Finalizador de ráfaga: Enter o Tab (según la configuración del escáner en el manual)
      if (e.key === 'Enter' || e.key === 'Tab') {
        const rawCode = bufferRef.current.trim()
        bufferRef.current = ''
        burstCountRef.current = 0
        if (timeoutClearRef.current) clearTimeout(timeoutClearRef.current)

        // Un código de barras o DataMatrix válido tiene mínimo 4 caracteres
        if (rawCode.length >= 4) {
          e.preventDefault()
          e.stopPropagation()
          despacharCodigoEscaneado(rawCode, !!isInput, target)
        }
        return
      }

      // Acumular caracteres imprimibles simples
      if (e.key.length === 1) {
        bufferRef.current += e.key
        burstCountRef.current += 1

        // Temporizador de seguridad: si no llega el delimitador Enter tras la ráfaga,
        // pero se acumularon >= 4 caracteres a alta velocidad de lectura láser, procesar al vuelo
        if (timeoutClearRef.current) clearTimeout(timeoutClearRef.current)
        timeoutClearRef.current = setTimeout(() => {
          const rawCode = bufferRef.current.trim()
          const count = burstCountRef.current
          bufferRef.current = ''
          burstCountRef.current = 0

          if (rawCode.length >= 4 && count >= 4) {
            despacharCodigoEscaneado(rawCode, !!isInput, target)
          }
        }, 280)
      }
    }

    // Capturar en fase de captura para interceptar antes que formularios nativos
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      if (timeoutClearRef.current) clearTimeout(timeoutClearRef.current)
    }
  }, [enabled])

  const limpiarUltimoEscaneo = useCallback(() => {
    setUltimoEscaneo(null)
  }, [])

  return {
    ultimoEscaneo,
    estaEscaneando,
    limpiarUltimoEscaneo
  }
}
