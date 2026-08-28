'use client'

import { useEffect, useRef } from 'react'

interface QRScannerOptions {
  onScan: (rawCode: string, turnoId: string) => void
  enabled?: boolean
  prefix?: string
}

export function extraerTurnoIdDeQRString(rawCode: string): string {
  if (!rawCode) return ''
  const raw = rawCode.trim()

  // 1. Prefijo institucional MEDCRM:QX:<uuid>
  if (raw.toUpperCase().startsWith('MEDCRM:QX:')) {
    const partes = raw.split(':')
    if (partes.length >= 3) {
      return partes[2].trim()
    }
  }

  // 2. Prefijo QX-<uuid>
  if (raw.toUpperCase().startsWith('QX-')) {
    return raw.slice(3).trim()
  }

  // 3. URL con query param ?t= o ?turno_id=
  if (raw.includes('http') && (raw.includes('?t=') || raw.includes('?turno_id='))) {
    try {
      const url = new URL(raw)
      const t = url.searchParams.get('t') || url.searchParams.get('turno_id')
      if (t) return t.trim()
    } catch (e) {
      // Ignorar error de parsing
    }
  }

  // 4. UUID directo (36 caracteres con 4 guiones)
  if (raw.length === 36 && (raw.match(/-/g) || []).length === 4) {
    return raw
  }

  return raw
}

export function useQRScannerListener({ onScan, enabled = true, prefix = 'MEDCRM' }: QRScannerOptions) {
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Verificar si el usuario está escribiendo en un input o textarea normal
      const target = e.target as HTMLElement | null
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTimeRef.current
      lastKeyTimeRef.current = currentTime

      // Si pasa mucho tiempo (> 100ms), reiniciar buffer salvo que sea inicio de ráfaga
      if (timeDiff > 120 && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      if (e.key === 'Enter') {
        const buffer = bufferRef.current.trim()
        bufferRef.current = ''

        if (buffer.length > 5) {
          const turnoId = extraerTurnoIdDeQRString(buffer)
          if (turnoId) {
            if (isInput) {
              // Prevenir que el Enter envíe formularios por accidente
              e.preventDefault()
            }
            onScan(buffer, turnoId)
          }
        }
        return
      }

      // Solo acumular caracteres imprimibles de longitud 1
      if (e.key.length === 1) {
        bufferRef.current += e.key

        // Limpiar buffer de seguridad tras 500ms si no llega Enter
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 500)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [enabled, onScan])
}
