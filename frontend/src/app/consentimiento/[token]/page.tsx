'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Download,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Building2,
  Eye,
  Coffee
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

export default function ConsentimientoPublicoPage() {
  const params = useParams()
  const token = params?.token as string

  const [datos, setDatos] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Firma
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [firmando, setFirmando] = useState(false)
  const [firmadoExito, setFirmadoExito] = useState<any>(null)
  const [aceptoTerminos, setAceptoTerminos] = useState(false)

  // Cargar datos del consentimiento
  useEffect(() => {
    if (!token) return

    const fetchDatos = async () => {
      try {
        setCargando(true)
        setError(null)
        const res = await fetch(`${BACKEND_URL}/api/consentimiento-publico/${token}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.detail || 'Enlace no válido o caducado')
        }
        setDatos(data)
        if (data.turno?.consentimiento_estado === 'firmado_digital') {
          setFirmadoExito({
            pdf_url: data.turno.consentimiento_pdf_url,
            paciente_nombre: data.paciente?.nombre,
            fecha_cirugia: data.turno?.fecha_cirugia,
            hora_inicio: data.turno?.hora_inicio
          })
        }
      } catch (err: any) {
        setError(err.message || 'Error cargando consentimiento')
      } finally {
        setCargando(false)
      }
    }
    fetchDatos()
  }, [token])

  // Canvas drawing handlers
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: any) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top

    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0F172A'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  // Enviar firma
  const handleConfirmarFirma = async () => {
    if (!hasDrawn) {
      setError('Por favor, dibuje su firma en el recuadro antes de continuar.')
      return
    }
    if (!aceptoTerminos) {
      setError('Debe tildar la casilla de confirmación para otorgar su consentimiento.')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const firmaB64 = canvas.toDataURL('image/png')

    try {
      setFirmando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/consentimiento-publico/${token}/firmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firma_base64: firmaB64,
          ip_origen: 'Mobile-Client',
          user_agent: navigator.userAgent
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Error al registrar firma')
      }
      setFirmadoExito(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFirmando(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={36} />
          <p className="text-sm font-bold text-slate-700">Cargando su Consentimiento Informado...</p>
        </div>
      </div>
    )
  }

  if (error && !datos) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-red-200 text-center space-y-3">
          <AlertCircle size={40} className="text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Enlace No Válido</h2>
          <p className="text-xs text-slate-600">{error}</p>
        </div>
      </div>
    )
  }

  const { turno, paciente, consentimiento } = datos || {}

  // PANTALLA DE ÉXITO TRAS FIRMAR
  if (firmadoExito) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white p-6 sm:p-8 rounded-3xl shadow-2xl border border-emerald-500/30 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">¡Consentimiento Registrado con Éxito!</h1>
            <p className="text-xs text-slate-600 mt-1">
              Muchas gracias, <b>{paciente?.nombre}</b>. Su confirmación ya se encuentra registrada en el sistema de quirófano.
            </p>
          </div>

          {/* Recordatorio Quirúrgico */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <Calendar size={16} />
              <span>Fecha de Cirugía: {turno?.fecha_cirugia}</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <Clock size={16} />
              <span>Hora: {turno?.hora_inicio?.slice(0, 5)} hs</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <Eye size={16} />
              <span>Lateralidad: {turno?.ojo_desc}</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-amber-900 pt-2 border-t border-blue-200">
              <Coffee size={16} />
              <span>Recuerde: 8 horas de ayuno total (líquidos y sólidos).</span>
            </div>
          </div>

          {firmadoExito.pdf_url && (
            <a
              href={`${BACKEND_URL}${firmadoExito.pdf_url}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
            >
              <Download size={16} />
              <span>Descargar Copia del Consentimiento (PDF)</span>
            </a>
          )}
        </div>
      </div>
    )
  }

  // PANTALLA PRINCIPAL DE LECTURA Y FIRMA
  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 flex justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-5 sm:p-6 text-center space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200">CLÍNICA OFTALMOLÓGICA</p>
          <h1 className="text-lg sm:text-xl font-bold">{consentimiento?.titulo || 'Consentimiento Informado'}</h1>
          <p className="text-xs text-blue-200">Documento Médico-Legal de Autorización Quirúrgica</p>
        </div>

        <div className="p-5 sm:p-6 space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resumen de la Intervención */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100 text-xs">
            <div>
              <p className="text-[10px] font-semibold text-slate-500">Paciente</p>
              <p className="font-bold text-slate-900 truncate">{paciente?.nombre}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500">DNI</p>
              <p className="font-mono font-bold text-slate-900">{paciente?.dni || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500">Cirujano</p>
              <p className="font-bold text-blue-800 truncate">{turno?.cirujano_nombre}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500">Ojo a Operar</p>
              <p className="font-bold text-emerald-700">{turno?.ojo_desc}</p>
            </div>
          </div>

          {/* Texto Legal */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed max-h-60 overflow-y-auto space-y-2.5">
            <p className="font-semibold text-slate-900">DECLARACIÓN DEL PACIENTE / REPRESENTANTE:</p>
            <p>{consentimiento?.cuerpo}</p>
          </div>

          {/* Checkbox de Conformidad */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={aceptoTerminos}
              onChange={(e) => setAceptoTerminos(e.target.checked)}
              className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <span className="text-xs font-semibold text-slate-900 leading-snug">
              He leído y comprendido la información sobre el procedimiento de <b>{turno?.practica_nombre}</b> en mi{' '}
              <b>{turno?.ojo_desc}</b>. Acepto los cuidados y autorizo la realización de la cirugía.
            </span>
          </label>

          {/* Canvas de Firma Táctil */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900">Dibuje su firma en el recuadro:</label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
              >
                Borrar y Reintentar
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-white touch-none">
              <canvas
                ref={canvasRef}
                width={500}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 cursor-crosshair block"
              />
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              Firme con su dedo o lápiz táctil dentro del recuadro blanco.
            </p>
          </div>

          {/* Botón de Confirmación */}
          <button
            type="button"
            onClick={handleConfirmarFirma}
            disabled={firmando || !hasDrawn || !aceptoTerminos}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {firmando ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={18} />}
            <span>Confirmar y Enviar Consentimiento Firmado</span>
          </button>
        </div>
      </div>
    </div>
  )
}
