'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2,
  X,
  AlertTriangle,
  Loader2,
  Eye,
  ShieldCheck,
  Stethoscope,
  Activity,
  ArrowRight,
  Clock,
  Sparkles,
  Volume2
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ModalVerificacionQRProps {
  isOpen: boolean
  onClose: () => void
  rawQR: string
  turnoId: string
  estacion?: string
  onEstadoActualizado?: (turnoActualizado: any) => void
}

// Reproductor de sonido de verificación médica exitosa (Web Audio API)
function reproducirBeepExito() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }

    // Doble tono ascendente agradable (880 Hz -> 1760 Hz)
    playTone(880, 0, 0.08)
    playTone(1760, 0.09, 0.12)
  } catch (e) {
    // Ignorar si el navegador bloquea audio
  }
}

export default function ModalVerificacionQR({
  isOpen,
  onClose,
  rawQR,
  turnoId,
  estacion = 'Pizarra Quirúrgica',
  onEstadoActualizado
}: ModalVerificacionQRProps) {
  const [procesando, setProcesando] = useState<boolean>(true)
  const [ejecutandoAccion, setEjecutandoAccion] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [contadorAutoCierre, setContadorAutoCierre] = useState<number | null>(null)

  // Procesar escaneo al abrir
  useEffect(() => {
    if (!isOpen || !turnoId) return

    const procesarEscaneo = async () => {
      try {
        setProcesando(true)
        setError(null)
        setContadorAutoCierre(null)

        const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/escanear-qr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo_qr: rawQR || `MEDCRM:QX:${turnoId}`,
            estacion: estacion,
            usuario_crm: 'Operador Scanner QR'
          })
        })

        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.detail || data.error || 'Error al validar código QR.')
        }

        setResultado(data)
        reproducirBeepExito()

        if (onEstadoActualizado && data.turno) {
          onEstadoActualizado(data.turno)
        }

        // Auto-cierre tras 4 segundos de confirmación
        setContadorAutoCierre(4)
      } catch (err: any) {
        console.error('Error procesando escaneo QR:', err)
        setError(err.message || 'No se pudo verificar el turno quirúrgico.')
      } finally {
        setProcesando(false)
      }
    }

    procesarEscaneo()
  }, [isOpen, turnoId, rawQR, estacion])

  // Manejador del contador de auto-cierre
  useEffect(() => {
    if (contadorAutoCierre === null || contadorAutoCierre <= 0) return

    const timer = setTimeout(() => {
      if (contadorAutoCierre === 1) {
        onClose()
      } else {
        setContadorAutoCierre(contadorAutoCierre - 1)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [contadorAutoCierre, onClose])

  // Forzar cambio a un estado específico
  const handleForzarEstado = async (nuevoEstado: string) => {
    try {
      setEjecutandoAccion(true)
      setContadorAutoCierre(null) // Cancelar auto-cierre si el usuario interactúa
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/escanear-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_qr: rawQR || `MEDCRM:QX:${turnoId}`,
          estacion: estacion,
          accion_deseada: nuevoEstado,
          usuario_crm: 'Operador Manual QR'
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setResultado(data)
        reproducirBeepExito()
        if (onEstadoActualizado && data.turno) {
          onEstadoActualizado(data.turno)
        }
      }
    } catch (err: any) {
      console.error('Error forzando estado:', err)
    } finally {
      setEjecutandoAccion(false)
    }
  }

  if (!isOpen) return null

  const seg = resultado?.seguridad || {}
  const esOD = seg.ojo === 'OD'
  const esOI = seg.ojo === 'OI'
  const nuevoEst = resultado?.nuevo_estado || 'en_espera'
  const anteriorEst = resultado?.estado_anterior || 'programado'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border-2 border-emerald-500/50 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header con Indicador de Escaneo Exitoso */}
        <div className="p-4 bg-gradient-to-r from-emerald-950/80 via-neutral-950 to-neutral-950 border-b border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-tight">
                  Verificación de Seguridad Quirúrgica
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Volume2 size={11} />
                  Time-Out OMS
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Estación: <strong className="text-emerald-300">{estacion}</strong> • Identificación Inequívoca
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 space-y-5">
          {procesando ? (
            <div className="p-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
              <Loader2 size={32} className="animate-spin text-emerald-400" />
              <span>Validando código QR y actualizando Pizarra en Vivo...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-400 shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">Error en Lectura de QR</p>
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tarjeta Gigante de Verificación Inequívoca */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-gray-800 space-y-4 shadow-inner">
                
                {/* Paciente y DNI */}
                <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Paciente Identificado</span>
                    <h4 className="text-lg font-black text-white tracking-tight uppercase">
                      {seg.paciente_nombre}
                    </h4>
                    <span className="text-xs text-gray-400 font-mono">
                      DNI: <strong className="text-gray-200">{seg.paciente_dni}</strong>
                    </span>
                  </div>

                  {/* LATERALIDAD DE OJO (GIGANTE) */}
                  <div className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center text-center shadow-lg ${
                    esOD
                      ? 'bg-blue-950/60 border-blue-500 text-blue-300 ring-2 ring-blue-500/30'
                      : esOI
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                      : 'bg-purple-950/60 border-purple-500 text-purple-300'
                  }`}>
                    <Eye size={20} className="mb-0.5" />
                    <span className="text-[11px] font-black uppercase tracking-wider">
                      {seg.ojo_texto}
                    </span>
                  </div>
                </div>

                {/* Práctica, Cirujano y LIO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-gray-800">
                    <span className="text-[10px] text-gray-400 font-bold block">Procedimiento:</span>
                    <span className="font-extrabold text-blue-400">{seg.practica_nombre}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-gray-800">
                    <span className="text-[10px] text-gray-400 font-bold block">Cirujano Asignado:</span>
                    <span className="font-bold text-gray-200">{seg.cirujano_nombre}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-gray-800 sm:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block">Lente Intraocular (LIO):</span>
                      <span className="font-extrabold text-white">{seg.lente_info}</span>
                    </div>
                    {seg.alergias && seg.alergias !== 'Sin alergias declaradas' && (
                      <span className="px-2 py-1 rounded bg-red-950 text-red-300 border border-red-500/40 text-[10px] font-black uppercase">
                        ⚠ {seg.alergias}
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* BANNER DE TRANSICIÓN DE ESTADO */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-neutral-950 to-neutral-950 border border-emerald-500/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-black text-white">Estado Quirúrgico Actualizado:</p>
                    <div className="flex items-center gap-1.5 text-gray-300 font-mono text-[11px] mt-0.5">
                      <span className="opacity-60">{anteriorEst}</span>
                      <ArrowRight size={12} className="text-emerald-400" />
                      <span className="font-bold text-emerald-400 uppercase">{nuevoEst}</span>
                    </div>
                  </div>
                </div>

                {contadorAutoCierre !== null && (
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-gray-400 block">Cerrando en:</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs">
                      {contadorAutoCierre}s
                    </span>
                  </div>
                )}
              </div>

              {/* ACCIONES RÁPIDAS MANUALES ALTERNATIVAS */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Cambiar manualmente a otra etapa:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    disabled={ejecutandoAccion || nuevoEst === 'en_espera'}
                    onClick={() => handleForzarEstado('en_espera')}
                    className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <span>🟡 En Espera</span>
                  </button>

                  <button
                    type="button"
                    disabled={ejecutandoAccion || nuevoEst === 'pre_quirofano'}
                    onClick={() => handleForzarEstado('pre_quirofano')}
                    className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <span>🩵 Pre-Qx</span>
                  </button>

                  <button
                    type="button"
                    disabled={ejecutandoAccion || nuevoEst === 'en_operacion'}
                    onClick={() => handleForzarEstado('en_operacion')}
                    className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold transition flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <span>🟣 Quirófano</span>
                  </button>

                  <button
                    type="button"
                    disabled={ejecutandoAccion || nuevoEst === 'operado'}
                    onClick={() => handleForzarEstado('operado')}
                    className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <span>🟢 Operado</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-end bg-neutral-950">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition"
          >
            Listo / Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
