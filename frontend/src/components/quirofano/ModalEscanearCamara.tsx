'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Camera,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  QrCode,
  ShieldCheck,
  SwitchCamera,
  CheckCircle2
} from 'lucide-react'
import jsQR from 'jsqr'
import { extraerTurnoIdDeQRString } from '@/hooks/useQRScannerListener'

interface ModalEscanearCamaraProps {
  isOpen: boolean
  onClose: () => void
  onScanExitoso: (rawCode: string, turnoId: string) => void
}

export default function ModalEscanearCamara({
  isOpen,
  onClose,
  onScanExitoso
}: ModalEscanearCamaraProps) {
  const [error, setError] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState<boolean>(true)
  const [codigoManual, setCodigoManual] = useState<string>('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [escaneadoExito, setEscaneadoExito] = useState<boolean>(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      detenerCamara()
      return
    }

    setEscaneadoExito(false)
    iniciarCamara()

    return () => {
      detenerCamara()
    }
  }, [isOpen, facingMode])

  const iniciarCamara = async () => {
    try {
      setIniciando(true)
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador o dispositivo no soporta acceso a la cámara.')
      }

      // Detener stream anterior si cambiamos de cámara
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIniciando(false)
        iniciarEscaneoFrame()
      }
    } catch (err: any) {
      console.error('Error al iniciar cámara:', err)
      setError(err.message || 'No se pudo acceder a la cámara del dispositivo.')
      setIniciando(false)
    }
  }

  const detenerCamara = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  const procesarLecturaExitosa = (rawVal: string) => {
    const turnoId = extraerTurnoIdDeQRString(rawVal)
    if (turnoId) {
      setEscaneadoExito(true)
      detenerCamara()
      setTimeout(() => {
        onScanExitoso(rawVal, turnoId)
        onClose()
      }, 300)
    }
  }

  const iniciarEscaneoFrame = () => {
    // 1. Intentar BarcodeDetector nativo si está disponible
    let barcodeDetector: any = null
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      } catch (e) {
        barcodeDetector = null
      }
    }

    const canvas = canvasRef.current || document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const detectLoop = async () => {
      const video = videoRef.current
      if (video && video.readyState >= 2 && !escaneadoExito) {
        // Opción A: BarcodeDetector nativo
        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(video)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              procesarLecturaExitosa(barcodes[0].rawValue)
              return
            }
          } catch (e) {
            // Fallback a jsQR
          }
        }

        // Opción B: jsQR universal (para Safari, iOS, iPads y navegadores sin BarcodeDetector)
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          })

          if (code && code.data) {
            procesarLecturaExitosa(code.data)
            return
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(detectLoop)
    }

    animFrameRef.current = requestAnimationFrame(detectLoop)
  }

  // Ingreso manual de código o simulación
  const handleIngresoManual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigoManual.trim()) return
    const turnoId = extraerTurnoIdDeQRString(codigoManual.trim())
    if (turnoId) {
      detenerCamara()
      onScanExitoso(codigoManual.trim(), turnoId)
      onClose()
    } else {
      setError('Formato de código QR inválido.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-blue-500/30 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Escanear Pulsera Quirúrgica</h3>
              <p className="text-[11px] text-gray-400">Apunte el código QR de la pulsera al visor</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleFacingMode}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition"
              title="Cambiar de cámara (Frontal/Trasera)"
            >
              <SwitchCamera size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Visor de Cámara */}
        <div className="p-4 space-y-4">
          <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-2 border-dashed border-blue-500/40 flex items-center justify-center">
            {iniciando && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950 text-gray-400 text-xs">
                <Loader2 size={24} className="animate-spin text-blue-400" />
                <span>Iniciando sensor óptico...</span>
              </div>
            )}

            {error && (
              <div className="p-4 text-center text-xs text-red-300 space-y-2">
                <AlertTriangle size={24} className="text-red-400 mx-auto" />
                <p>{error}</p>
                <p className="text-[10px] text-gray-400">Puede ingresar el código manualmente abajo.</p>
              </div>
            )}

            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Canvas oculto para decodificación jsQR */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Feedback de Escaneo Exitoso */}
            {escaneadoExito && (
              <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-emerald-400 animate-in zoom-in-95">
                <CheckCircle2 size={48} className="animate-bounce" />
                <span className="text-sm font-black text-white">¡Código QR Verificado!</span>
              </div>
            )}

            {/* Retícula de Enfoque */}
            {!iniciando && !error && !escaneadoExito && (
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <QrCode size={40} className="text-emerald-400/30" />
              </div>
            )}
          </div>

          {/* Formulario de Ingreso Manual / Pistola USB */}
          <form onSubmit={handleIngresoManual} className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase block">
              O tipear código manualmente / Pistola USB:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="MEDCRM:QX:xxxx-xxxx... o UUID"
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value)}
                className="flex-1 px-3 py-2 bg-neutral-950 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
              >
                Validar
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 bg-neutral-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
