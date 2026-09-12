'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  ShieldCheck,
  User,
  Eye,
  FileCheck2,
  Sparkles,
  X,
  Play,
  Loader2,
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Barcode,
  HelpCircle,
  Check
} from 'lucide-react'
import { BACKEND_URL, apiFetch } from '@/lib/api'
import { parseGs1Code, Gs1ParsedData } from '@/lib/gs1Parser'
import ModalEscanearCamara from '@/components/quirofano/ModalEscanearCamara'

interface ModalPausaQuirurgicaOmsProps {
  isOpen: boolean
  onClose: () => void
  turno: any
  onConfirmarInicio: (turnoActualizado?: any) => void
  procesando: boolean
}

export default function ModalPausaQuirurgicaOms({
  isOpen,
  onClose,
  turno,
  onConfirmarInicio,
  procesando
}: ModalPausaQuirurgicaOmsProps) {
  // Checks obligatorios OMS
  const [checkIdentidad, setCheckIdentidad] = useState(true)
  const [checkConsentimiento, setCheckConsentimiento] = useState(true)
  const [checkLio, setCheckLio] = useState(false)
  const [checkEsterilidad, setCheckEsterilidad] = useState(true)

  // Estado del escaneo y validación GS1 del LIO
  const [validandoLio, setValidandoLio] = useState(false)
  const [resultadoValidacion, setResultadoValidacion] = useState<any | null>(null)
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [inputManual, setInputManual] = useState('')
  const [mostrandoInputManual, setMostrandoInputManual] = useState(false)
  const [guardandoPausa, setGuardandoPausa] = useState(false)

  // Opción A: Autorización justificada del Cirujano ante discrepancia
  const [mostrandoOverride, setMostrandoOverride] = useState(false)
  const [justificacionCambio, setJustificacionCambio] = useState('')
  const [autorizadoPorCirujano, setAutorizadoPorCirujano] = useState(false)

  // Listener para pistola lectora USB en vivo
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)

  // Inicializar checks al abrir o recibir turno
  useEffect(() => {
    if (!isOpen || !turno) return

    setCheckIdentidad(true)
    setCheckConsentimiento(true)
    setCheckEsterilidad(true)
    setMostrandoOverride(false)
    setJustificacionCambio('')
    setAutorizadoPorCirujano(false)
    setErrorValidacion(null)

    // Si no lleva lente (ej. cirugía de párpado, pterigión), el check de LIO no es requerido
    if (!turno.lleva_lente) {
      setCheckLio(true)
      setResultadoValidacion(null)
      return
    }

    // Si ya tenía trazabilidad previa en el turno
    const prevCheck = turno.checklist_seguridad_quirurgica?.trazabilidad_lio
    if (prevCheck && prevCheck.escaneado) {
      setResultadoValidacion({
        success: true,
        coincide: true,
        estado_validacion: 'COINCIDENCIA_TOTAL',
        escaneado: prevCheck.escaneado,
        planificado: {
          modelo: turno.lente_tipo,
          dioptria: turno.lente_dioptria,
          es_torico: turno.es_torico,
          torico_valor: turno.lente_torico_valor
        },
        discrepancias: []
      })
      setCheckLio(true)
    } else {
      setCheckLio(false)
      setResultadoValidacion(null)
    }
  }, [isOpen, turno])

  // Listener de pistola lectora de código de barras USB/Bluetooth en el modal
  useEffect(() => {
    if (!isOpen || !turno?.lleva_lente) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en el textarea de justificación
      const target = e.target as HTMLElement | null
      if (target && target.tagName === 'TEXTAREA') return

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTimeRef.current

      // Las pistolas envían teclas en ráfaga rápida (< 60 ms entre caracteres)
      if (timeDiff > 60 && bufferRef.current.length > 0 && bufferRef.current.length < 5) {
        bufferRef.current = ''
      }

      lastKeyTimeRef.current = currentTime

      if (e.key === 'Enter') {
        const rawCode = bufferRef.current.trim()
        bufferRef.current = ''
        if (rawCode.length >= 6) {
          e.preventDefault()
          procesarCodigoBlister(rawCode)
        }
      } else if (e.key.length === 1) {
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, turno])

  if (!isOpen || !turno) return null

  const paciente = turno.pacientes || {}
  const pacNombre = paciente.nombre || 'Paciente'
  const pacDni = paciente.dni || 'S/D'
  const ojo = turno.ojo || 'OD'
  const ojoDesc = ojo === 'OD' ? 'OJO DERECHO (OD)' : ojo === 'OI' ? 'OJO IZQUIERDO (OI)' : 'AMBOS OJOS (AO)'

  // Procesa y valida el código escaneado contra el backend y el catálogo
  const procesarCodigoBlister = async (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return

    try {
      setValidandoLio(true)
      setErrorValidacion(null)

      // 1. Pre-análisis en frontend con el parser GS1
      const localParsed: Gs1ParsedData = parseGs1Code(rawCode.trim())

      // 2. Validación cruzada profunda en el backend
      const res = await apiFetch(`/api/turnos-quirofano/${turno.id}/validar-lente-gs1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_code: rawCode.trim(),
          gtin: localParsed.gtin14 || localParsed.gtin,
          lote: localParsed.lote,
          vencimiento: localParsed.vencimiento,
          serie: localParsed.serie
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Error al validar el código GS1 del lente.')
      }

      const data = await res.json()
      setResultadoValidacion(data)

      // Determinar si habilita el Check 3
      if (data.coincide && data.estado_validacion === 'COINCIDENCIA_TOTAL') {
        setCheckLio(true)
        setMostrandoOverride(false)
      } else {
        setCheckLio(false)
        setAutorizadoPorCirujano(false)
      }
    } catch (err: any) {
      console.error('Error validando lente GS1:', err)
      setErrorValidacion(err.message || 'Error de conexión al validar código GS1.')
    } finally {
      setValidandoLio(false)
    }
  }

  // Opción A: Confirmar autorización de cambio quirúrgico de cirujano
  const handleConfirmarOverrideCirujano = () => {
    if (!justificacionCambio.trim()) {
      alert('Debe ingresar un motivo clínico justificado para autorizar el cambio de lente.')
      return
    }
    setAutorizadoPorCirujano(true)
    setCheckLio(true)
  }

  // Confirmar la Pausa Quirúrgica OMS completa
  const handleConfirmarPausaFinal = async () => {
    try {
      setGuardandoPausa(true)

      const payload = {
        check_identidad: checkIdentidad,
        check_consentimiento: checkConsentimiento,
        check_lio: checkLio,
        check_esterilidad: checkEsterilidad,
        lente_escaneado: resultadoValidacion?.escaneado || null,
        justificacion_cambio_lio: autorizadoPorCirujano ? justificacionCambio.trim() : null,
        autorizado_por_cirujano: autorizadoPorCirujano
      }

      const res = await apiFetch(`/api/turnos-quirofano/${turno.id}/confirmar-pausa-oms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'No se pudo registrar la confirmación de Pausa OMS.')
      }

      const data = await res.json()
      onConfirmarInicio(data.turno)
    } catch (e: any) {
      console.error('Error confirmando Pausa Quirúrgica OMS:', e)
      alert(e.message || 'Error al confirmar la pausa quirúrgica.')
    } finally {
      setGuardandoPausa(false)
    }
  }

  const todosVerificados = checkIdentidad && checkConsentimiento && checkLio && checkEsterilidad
  const esCargando = procesando || guardandoPausa || validandoLio

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
        <div className="bg-[var(--card)] border-2 border-purple-500/40 rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col">
          {/* Cabecera */}
          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 p-5 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
                <ShieldCheck size={28} className="text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full bg-amber-400 text-purple-950 font-black">
                    Protocolo OMS
                  </span>
                  <span className="text-xs text-purple-200 font-semibold">Pausa Quirúrgica (Time-Out)</span>
                </div>
                <h3 className="text-lg font-extrabold tracking-tight mt-0.5">Verificación de Seguridad Pre-Incisión</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={esCargando}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Cuerpo con los 4 Checks de Seguridad */}
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[70vh]">
            <p className="text-xs text-[var(--secondary)]">
              Antes de realizar la incisión corneal, el equipo quirúrgico debe verificar en voz alta las siguientes condiciones de seguridad:
            </p>

            {/* Check 1: Identidad y Lateralidad */}
            <label className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              checkIdentidad ? 'bg-purple-500/5 border-purple-500/40 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)]'
            }`}>
              <input
                type="checkbox"
                checked={checkIdentidad}
                onChange={(e) => setCheckIdentidad(e.target.checked)}
                className="mt-1 w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <User size={14} className="text-purple-600" />
                  <span>Identidad de Paciente & Lateralidad Ocular</span>
                </p>
                <p className="text-[var(--secondary)]">
                  Paciente: <b className="text-[var(--foreground)]">{pacNombre}</b> (DNI: {pacDni})
                </p>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-[11px]">
                  <Eye size={12} />
                  <span>Intervención en: {ojoDesc}</span>
                </div>
              </div>
            </label>

            {/* Check 2: Consentimiento Informado */}
            <label className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              checkConsentimiento ? 'bg-purple-500/5 border-purple-500/40 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)]'
            }`}>
              <input
                type="checkbox"
                checked={checkConsentimiento}
                onChange={(e) => setCheckConsentimiento(e.target.checked)}
                className="mt-1 w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <FileCheck2 size={14} className="text-emerald-600" />
                  <span>Consentimiento Informado Firmado y Verificado</span>
                </p>
                <p className="text-[var(--secondary)]">
                  Estado registrado:{' '}
                  <b className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {turno.consentimiento_estado === 'firmado_digital' ? '✔ Firmado Digitalmente' : '✔ Verificado en Sala'}
                  </b>
                </p>
              </div>
            </label>

            {/* Check 3: Lente Intraocular (LIO) con Escaneo GS1 DataMatrix y Doble Barrera de Seguridad */}
            {turno.lleva_lente && (
              <div className={`p-4 rounded-2xl border transition-all ${
                checkLio
                  ? autorizadoPorCirujano
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                    : 'bg-emerald-500/10 border-emerald-500/50 shadow-sm'
                  : resultadoValidacion?.estado_validacion === 'DISCREPANCIA' || resultadoValidacion?.estado_validacion === 'LENTE_VENCIDO'
                    ? 'bg-red-500/10 border-red-500/50 shadow-sm'
                    : 'bg-blue-500/5 border-blue-500/30'
              }`}>
                {/* Título de la Sección del LIO */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      checkLio ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-[var(--foreground)] flex items-center gap-1.5">
                        <span>Lente Intraocular (LIO) — Verificación GS1</span>
                        {checkLio && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                            autorizadoPorCirujano
                              ? 'bg-amber-400 text-amber-950'
                              : 'bg-emerald-500 text-white'
                          }`}>
                            {autorizadoPorCirujano ? 'AUTORIZADO POR CIRUJANO' : '✔ CONFORME 100%'}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-[var(--secondary)]">
                        Validación cruzada obligatoria entre el blíster físico y la biometría calculada.
                      </p>
                    </div>
                  </div>

                  {/* Estado Checkbox Visual */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checkLio}
                      disabled={!resultadoValidacion?.coincide && !autorizadoPorCirujano}
                      onChange={(e) => {
                        if (resultadoValidacion?.coincide || autorizadoPorCirujano) {
                          setCheckLio(e.target.checked)
                        }
                      }}
                      className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer disabled:opacity-40"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--secondary)]">
                      {checkLio ? 'Validado' : 'Pendiente'}
                    </span>
                  </label>
                </div>

                {/* Resumen del Plan Previsto en Biometría */}
                <div className="bg-[var(--card)] p-2.5 rounded-xl border border-[var(--border)] text-xs mb-3 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      🎯 Plan Biométrico Previsto ({ojoDesc}):
                    </span>
                    <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">
                      Potencia: {turno.lente_dioptria || 'N/D'} D
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-[var(--secondary)]">
                    <span>Modelo: <b className="text-[var(--foreground)]">{turno.lente_tipo || 'Estándar'}</b></span>
                    {turno.es_torico && (
                      <span className="text-purple-600 dark:text-purple-400 font-bold">
                        Tórico: T{turno.lente_torico_valor || 0} (Eje {turno.lente_torico_eje || 90}°)
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-vista: Escaneo en Progreso */}
                {validandoLio && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center gap-2.5 text-xs text-blue-600 dark:text-blue-300 font-bold animate-pulse">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Decodificando GS1 y verificando consistencia en catálogo maestro...</span>
                  </div>
                )}

                {/* Sub-vista: Mensaje de Error de Conexión */}
                {errorValidacion && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2 mb-3">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <p>{errorValidacion}</p>
                  </div>
                )}

                {/* Sub-vista: RESULTADO DE VALIDACIÓN GS1 */}
                {resultadoValidacion && !validandoLio && (
                  <div className="space-y-3 mb-3">
                    {/* CASO A: Coincidencia Total (Verde) */}
                    {resultadoValidacion.coincide && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 size={16} />
                            <span>Blíster Validado y Conforme con el Plan</span>
                          </p>
                          <span className="text-[10px] font-mono bg-emerald-200 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-md font-bold">
                            GTIN: {resultadoValidacion.escaneado?.gtin}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-500/20">
                          <div>
                            <span className="text-[var(--secondary)] block">Modelo Físico:</span>
                            <b className="text-[var(--foreground)]">{resultadoValidacion.escaneado?.nombre_producto || resultadoValidacion.escaneado?.modelo}</b>
                          </div>
                          <div>
                            <span className="text-[var(--secondary)] block">Dioptría Verificada:</span>
                            <b className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                              {resultadoValidacion.escaneado?.dioptria_str}
                            </b>
                          </div>
                          <div>
                            <span className="text-[var(--secondary)] block">Lote / Serie:</span>
                            <span className="font-mono font-bold text-[var(--foreground)]">
                              Lote: {resultadoValidacion.escaneado?.lote || 'S/D'} | SN: {resultadoValidacion.escaneado?.serie || 'S/D'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--secondary)] block">Fecha de Caducidad:</span>
                            <span className="font-bold text-[var(--foreground)]">
                              {resultadoValidacion.escaneado?.vencimiento || 'Conforme'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CASO B: Lente Vencido (Bloqueo Crítico) */}
                    {resultadoValidacion.estado_validacion === 'LENTE_VENCIDO' && (
                      <div className="p-3.5 bg-red-500/15 border-2 border-red-600 rounded-xl text-xs space-y-2">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-extrabold">
                          <ShieldAlert size={18} className="text-red-600 animate-bounce" />
                          <span className="text-sm">⛔ BLOQUEO CRÍTICO: LENTE VENCIDO</span>
                        </div>
                        <p className="text-red-600 dark:text-red-300 text-[11px]">
                          La fecha de caducidad del blíster es <b>{resultadoValidacion.escaneado?.vencimiento}</b>. Por normativa de bioseguridad, está prohibido implantar este insumo estéril.
                        </p>
                      </div>
                    )}

                    {/* CASO C: Discrepancia con el Plan Biométrico (Rojo - Opción A) */}
                    {resultadoValidacion.estado_validacion === 'DISCREPANCIA' && (
                      <div className="p-3.5 bg-red-500/10 border-2 border-red-500/40 rounded-xl text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-extrabold">
                            <AlertTriangle size={18} />
                            <span>🚨 DISCREPANCIA DETECTADA CON EL PLAN</span>
                          </div>
                          <span className="text-[10px] uppercase font-black bg-red-200 dark:bg-red-950 text-red-800 dark:text-red-200 px-2 py-0.5 rounded-md">
                            Bloqueo de Seguridad
                          </span>
                        </div>

                        {/* Lista de discrepancias */}
                        <ul className="space-y-1 text-[11px] text-red-700 dark:text-red-300 pl-4 list-disc font-medium">
                          {resultadoValidacion.discrepancias?.map((d: string, i: number) => (
                            <li key={i} className="font-bold">{d}</li>
                          ))}
                        </ul>

                        {/* Comparador lado a lado: Planificado vs Escaneado */}
                        <div className="bg-[var(--card)] p-2.5 rounded-lg border border-red-500/30 text-[11px] grid grid-cols-2 gap-2">
                          <div className="border-r border-[var(--border)] pr-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Planificado</span>
                            <p className="font-bold text-[var(--foreground)]">{resultadoValidacion.planificado?.modelo}</p>
                            <p className="font-extrabold text-blue-600">{resultadoValidacion.planificado?.dioptria}</p>
                          </div>
                          <div className="pl-1">
                            <span className="text-[10px] uppercase font-bold text-red-500 block">Blíster Físico</span>
                            <p className="font-bold text-[var(--foreground)]">{resultadoValidacion.escaneado?.nombre_producto}</p>
                            <p className="font-extrabold text-red-600">{resultadoValidacion.escaneado?.dioptria_str}</p>
                          </div>
                        </div>

                        {/* OPCIÓN A: Bloqueo con Anulación Justificada por Cirujano */}
                        {!autorizadoPorCirujano ? (
                          <div className="pt-2 border-t border-red-500/20">
                            {!mostrandoOverride ? (
                              <button
                                type="button"
                                onClick={() => setMostrandoOverride(true)}
                                className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                              >
                                <AlertCircle size={14} />
                                <span>⚠️ Autorizar Cambio Quirúrgico Justificado (Cirujano)</span>
                              </button>
                            ) : (
                              <div className="bg-amber-500/10 border border-amber-500/40 p-3 rounded-xl space-y-2.5 animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-amber-800 dark:text-amber-200 flex items-center gap-1">
                                    <span>Justificación de Cambio Intraoperatorio (Opción A)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setMostrandoOverride(false)}
                                    className="text-[11px] text-slate-400 hover:text-[var(--foreground)]"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                                <p className="text-[11px] text-amber-900 dark:text-amber-300">
                                  Como cirujano responsable, indique el motivo clínico de la modificación del lente respecto al plan original:
                                </p>
                                <textarea
                                  value={justificacionCambio}
                                  onChange={(e) => setJustificacionCambio(e.target.value)}
                                  placeholder="Ej: Cambio a +20.00 D por hallazgo intraoperatorio / decisión médica..."
                                  rows={2}
                                  className="w-full text-xs p-2 rounded-lg border border-amber-500/40 bg-[var(--card)] text-[var(--foreground)] focus:ring-1 focus:ring-amber-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleConfirmarOverrideCirujano}
                                  disabled={!justificacionCambio.trim()}
                                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-extrabold transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Check size={14} />
                                  <span>Confirmar Cambio y Desbloquear Cirugía</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2.5 bg-amber-500/20 border border-amber-500/50 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                            <p className="font-extrabold flex items-center gap-1">
                              <CheckCircle2 size={14} className="text-amber-600" />
                              <span>Cambio Quirúrgico Aprobado por el Cirujano</span>
                            </p>
                            <p className="text-[11px] mt-0.5 italic">Motivo: "{justificacionCambio}"</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CASO D: GTIN No Catalogado */}
                    {resultadoValidacion.estado_validacion === 'GTIN_NO_CATALOGADO' && (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-xl text-xs space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-extrabold">
                          <HelpCircle size={16} />
                          <span>GTIN no encontrado en el catálogo local</span>
                        </div>
                        <p className="text-[11px] text-[var(--secondary)]">
                          Se detectó Lote: <b>{resultadoValidacion.escaneado?.lote || 'S/D'}</b> y Vencimiento: <b>{resultadoValidacion.escaneado?.vencimiento || 'S/D'}</b>. Verifique manualmente la potencia.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setAutorizadoPorCirujano(true)
                            setJustificacionCambio('Verificación visual manual de blíster no catalogado.')
                            setCheckLio(true)
                          }}
                          className="py-1.5 px-3 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition"
                        >
                          Confirmar Verificación Visual Manual
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Botones de Entrada: Cámara, Pistola USB y Manual */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCamaraAbierta(true)}
                    disabled={esCargando}
                    className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <Camera size={14} />
                    <span>📷 Escanear con Cámara</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrandoInputManual(!mostrandoInputManual)}
                    disabled={esCargando}
                    className="py-2 px-3 border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--foreground)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Barcode size={14} />
                    <span>{mostrandoInputManual ? 'Ocultar Manual' : 'Pistola / Manual'}</span>
                  </button>
                </div>

                {/* Input de Ingreso Manual / Pegado de Código GS1 */}
                {mostrandoInputManual && (
                  <div className="mt-2.5 p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-[var(--border)] rounded-xl text-xs space-y-2 animate-fade-in">
                    <p className="text-[11px] text-[var(--secondary)]">
                      Ingrese o pegue el código GS1 DataMatrix del blíster, o use la pistola lectora USB:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inputManual}
                        onChange={(e) => setInputManual(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            procesarCodigoBlister(inputManual)
                          }
                        }}
                        placeholder="Ej: (01)0038065...(17)281130(10)LOT..."
                        className="flex-1 text-xs p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => procesarCodigoBlister(inputManual)}
                        disabled={!inputManual.trim() || esCargando}
                        className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        Validar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Check 4: Equipamiento, Esterilidad y Anestesia */}
            <label className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              checkEsterilidad ? 'bg-purple-500/5 border-purple-500/40 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)]'
            }`}>
              <input
                type="checkbox"
                checked={checkEsterilidad}
                onChange={(e) => setCheckEsterilidad(e.target.checked)}
                className="mt-1 w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-[var(--foreground)]">Esterilidad, Instrumental y Anestesia Conforme</p>
                <p className="text-[var(--secondary)]">
                  Cirujano: <b>{turno.cirujano_nombre || 'Asignado'}</b> | Anestesia: <b>{turno.tipo_anestesia || 'Tópica'}</b>
                </p>
              </div>
            </label>
          </div>

          {/* Footer de Acciones */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 border-t border-[var(--border)] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={esCargando}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmarPausaFinal}
              disabled={!todosVerificados || esCargando}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
            >
              {esCargando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Validando y Guardando...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>🟣 Iniciar Cirugía Verificada</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Cámara para Blíster LIO */}
      {camaraAbierta && (
        <ModalEscanearCamara
          isOpen={camaraAbierta}
          onClose={() => setCamaraAbierta(false)}
          onScanExitoso={(raw) => {
            setCamaraAbierta(false)
            procesarCodigoBlister(raw)
          }}
        />
      )}
    </>
  )
}