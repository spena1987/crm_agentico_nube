'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  BellRing,
  Send,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Stethoscope,
  Building2,
  Sparkles,
  RotateCcw,
  Loader2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  CheckCheck,
  Check,
  Phone,
  Video,
  MoreVertical,
  Layers,
  ChevronDown,
  RefreshCw
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface TemplateInfo {
  id?: string
  name: string
  category: string
  status: string
  body_text?: string
}

interface InfoOjoRecordatorio {
  turno_id?: string
  ojo: string
  ojo_label: string
  ojo_desc: string
  etapa?: string
  cirugia?: string
  fecha?: string
  fecha_iso?: string
  hora?: string
  hora_cirugia?: string
  hora_citacion?: string
  quirofano_nombre?: string
  recordatorio_estado?: string
  recordatorio_enviado_at?: string
  recordatorio_respondido_at?: string
  recordatorio_respuesta_texto?: string
  recordatorio_template?: string
}

interface DatosRecordatorioBackend {
  caso_id: string
  codigo_caso?: string
  paciente_id: string
  paciente_nombre: string
  saludo_nombre: string
  telefono: string
  cirugia: string
  cirujano_nombre?: string
  fecha: string
  fecha_iso?: string
  hora: string
  hora_cirugia?: string
  hora_citacion?: string
  quirofano_nombre?: string
  preparacion: string
  ayuno_horas?: number
  turno_id?: string
  ojo?: string
  recordatorio_estado?: string
  recordatorio_enviado_at?: string
  recordatorio_respondido_at?: string
  recordatorio_respuesta_texto?: string
  plantillas: TemplateInfo[]
  plantilla_recomendada: string
  es_bilateral_escalonada?: boolean
  primer_ojo?: InfoOjoRecordatorio
  segundo_ojo?: InfoOjoRecordatorio
}

interface ModalRecordatorioCirugiaWhatsAppProps {
  isOpen: boolean
  onClose: () => void
  casoId: string
  pacienteId?: string
  pacienteNombreDefault?: string
  pacienteTelefonoDefault?: string
  ojoDefault?: string
  turnoIdDefault?: string
  onMensajeEnviado?: () => void
}

function formatCirugiaConOjoCompleto(cirugiaBase?: string, ojoCod?: string): string {
  if (!cirugiaBase) return 'Cirugía Oftalmológica'
  const cod = (ojoCod || '').trim().toUpperCase()
  const mapDesc: Record<string, string> = {
    OD: 'OJO DERECHO',
    OI: 'OJO IZQUIERDO',
    AO: 'AMBOS OJOS'
  }
  const desc = mapDesc[cod]
  if (!desc) return cirugiaBase

  // Limpiar sufijos abreviados previos como (OD), (OI), (AO), - OD, etc.
  const limpia = cirugiaBase.replace(/\s*(\((OD|OI|AO|OJO DERECHO|OJO IZQUIERDO|AMBOS OJOS)\)|-\s*(OD|OI|AO|OJO DERECHO|OJO IZQUIERDO|AMBOS OJOS))\s*$/i, '').trim()
  if (limpia.toUpperCase().includes(desc)) return limpia
  return `${limpia} (${desc})`
}

export default function ModalRecordatorioCirugiaWhatsApp({
  isOpen,
  onClose,
  casoId,
  pacienteId,
  pacienteNombreDefault,
  pacienteTelefonoDefault,
  ojoDefault,
  turnoIdDefault,
  onMensajeEnviado
}: ModalRecordatorioCirugiaWhatsAppProps) {
  const [cargando, setCargando] = useState<boolean>(true)
  const [enviando, setEnviando] = useState<boolean>(false)
  const [sincronizandoEstado, setSincronizandoEstado] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [exitoMsg, setExitoMsg] = useState<string | null>(null)

  // Datos originales devueltos por el backend
  const [datosOriginales, setDatosOriginales] = useState<DatosRecordatorioBackend | null>(null)

  // Selección de ojo para cirugías bilaterales escalonadas
  const [ojoSeleccionado, setOjoSeleccionado] = useState<'primer_ojo' | 'segundo_ojo'>('primer_ojo')
  const [turnoIdSeleccionado, setTurnoIdSeleccionado] = useState<string | undefined>(turnoIdDefault)
  const [ojoTarget, setOjoTarget] = useState<string>('')

  // Campos editables por el usuario
  const [telefono, setTelefono] = useState<string>('')
  const [pacienteNombre, setPacienteNombre] = useState<string>('')
  const [cirugia, setCirugia] = useState<string>('')
  const [fecha, setFecha] = useState<string>('')
  const [hora, setHora] = useState<string>('')
  const [preparacion, setPreparacion] = useState<string>('')
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>('recordatorio_cirugia_preparacion_v1')

  // Plantillas conocidas desde BD
  const [plantillasDisponibles, setPlantillasDisponibles] = useState<TemplateInfo[]>([])

  useEffect(() => {
    if (!isOpen || !casoId) return

    let isMounted = true
    setCargando(true)
    setErrorMsg(null)
    setExitoMsg(null)

    const cargarDatos = async () => {
      try {
        const res = await apiFetch(`/api/asesorias-quirurgicas/${casoId}/datos-recordatorio-whatsapp`)
        if (!isMounted) return

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || 'No se pudieron cargar los datos del caso quirúrgico.')
        }

        const resp = await res.json()
        if (resp && resp.caso_id) {
          const d = resp as DatosRecordatorioBackend
          setDatosOriginales(d)
          setTelefono(d.telefono || pacienteTelefonoDefault || '')
          setPacienteNombre(d.saludo_nombre || d.paciente_nombre || pacienteNombreDefault || '')
          setPreparacion(d.preparacion || '')
          setPlantillasDisponibles(d.plantillas || [])

          let targetOjo: 'primer_ojo' | 'segundo_ojo' = 'primer_ojo'
          if (d.es_bilateral_escalonada) {
            const segOjoCode = (d.segundo_ojo?.ojo || '').toUpperCase()
            const ojoParam = (ojoDefault || '').toUpperCase()
            if (ojoParam === 'SEGUNDO_OJO' || ojoParam === '2DO_OJO' || (segOjoCode && ojoParam === segOjoCode)) {
              targetOjo = 'segundo_ojo'
            } else {
              targetOjo = 'primer_ojo'
            }
          }
          setOjoSeleccionado(targetOjo)

          if (d.es_bilateral_escalonada && targetOjo === 'segundo_ojo' && d.segundo_ojo) {
            setCirugia(formatCirugiaConOjoCompleto(d.segundo_ojo.cirugia || d.cirugia, d.segundo_ojo.ojo))
            setFecha(d.segundo_ojo.fecha || d.fecha || 'Fecha a confirmar')
            setHora(d.segundo_ojo.hora || d.hora || '07:30 hs')
            setTurnoIdSeleccionado(d.segundo_ojo.turno_id)
            setOjoTarget(d.segundo_ojo.ojo)
          } else if (d.es_bilateral_escalonada && d.primer_ojo) {
            setCirugia(formatCirugiaConOjoCompleto(d.primer_ojo.cirugia || d.cirugia, d.primer_ojo.ojo))
            setFecha(d.primer_ojo.fecha || d.fecha || 'Fecha a confirmar')
            setHora(d.primer_ojo.hora || d.hora || '07:30 hs')
            setTurnoIdSeleccionado(d.primer_ojo.turno_id)
            setOjoTarget(d.primer_ojo.ojo)
          } else {
            setCirugia(formatCirugiaConOjoCompleto(d.cirugia, d.ojo))
            setFecha(d.fecha || 'Fecha a confirmar')
            setHora(d.hora || '07:30 hs')
            setTurnoIdSeleccionado(d.turno_id)
            setOjoTarget(d.ojo || '')
          }

          const rec = d.plantilla_recomendada || 'recordatorio_cirugia_preparacion_v1'
          setPlantillaSeleccionada(rec)
        }
      } catch (err: any) {
        if (!isMounted) return
        console.error('Error al cargar datos sugeridos del recordatorio:', err)
        setErrorMsg(err.message || 'No se pudieron cargar los datos del caso quirúrgico.')
      } finally {
        if (isMounted) setCargando(false)
      }
    }

    cargarDatos()

    return () => {
      isMounted = false
    }
  }, [isOpen, casoId, pacienteNombreDefault, pacienteTelefonoDefault, ojoDefault])

  if (!isOpen) return null

  // Sincronizar y consultar estado en vivo con Meta
  const handleSincronizarEstado = async () => {
    try {
      setSincronizandoEstado(true)
      setErrorMsg(null)
      await apiFetch('/api/whatsapp/cloud/templates/sync', { method: 'POST' })
      const res = await apiFetch(`/api/asesorias-quirurgicas/${casoId}/datos-recordatorio-whatsapp`)
      if (res.ok) {
        const resp = await res.json()
        if (resp && resp.plantillas) {
          setPlantillasDisponibles(resp.plantillas)
        }
      }
    } catch (err: any) {
      console.error('Error sincronizando estado de plantillas con Meta:', err)
      setErrorMsg('No se pudo verificar el estado en vivo con Meta.')
    } finally {
      setSincronizandoEstado(false)
    }
  }

  // Cambiar entre 1° ojo y 2° ojo en bilateral escalonada
  const handleCambiarOjoObjetivo = (nuevoOjo: 'primer_ojo' | 'segundo_ojo') => {
    setOjoSeleccionado(nuevoOjo)
    setErrorMsg(null)
    if (!datosOriginales) return

    if (nuevoOjo === 'primer_ojo' && datosOriginales.primer_ojo) {
      setCirugia(formatCirugiaConOjoCompleto(datosOriginales.primer_ojo.cirugia || datosOriginales.cirugia, datosOriginales.primer_ojo.ojo))
      setFecha(datosOriginales.primer_ojo.fecha || datosOriginales.fecha || '')
      setHora(datosOriginales.primer_ojo.hora || datosOriginales.hora || '')
      setTurnoIdSeleccionado(datosOriginales.primer_ojo.turno_id)
      setOjoTarget(datosOriginales.primer_ojo.ojo)
    } else if (nuevoOjo === 'segundo_ojo' && datosOriginales.segundo_ojo) {
      setCirugia(formatCirugiaConOjoCompleto(datosOriginales.segundo_ojo.cirugia || datosOriginales.cirugia, datosOriginales.segundo_ojo.ojo))
      setFecha(datosOriginales.segundo_ojo.fecha || datosOriginales.fecha || '')
      setHora(datosOriginales.segundo_ojo.hora || datosOriginales.hora || '')
      setTurnoIdSeleccionado(datosOriginales.segundo_ojo.turno_id)
      setOjoTarget(datosOriginales.segundo_ojo.ojo)
    }
  }

  // Restablecer a los valores calculados
  const handleRestablecer = () => {
    if (!datosOriginales) return
    setTelefono(datosOriginales.telefono || '')
    setPacienteNombre(datosOriginales.saludo_nombre || datosOriginales.paciente_nombre || '')
    setPreparacion(datosOriginales.preparacion || '')

    if (datosOriginales.es_bilateral_escalonada) {
      if (ojoSeleccionado === 'segundo_ojo' && datosOriginales.segundo_ojo) {
        setCirugia(formatCirugiaConOjoCompleto(datosOriginales.segundo_ojo.cirugia, datosOriginales.segundo_ojo.ojo))
        setFecha(datosOriginales.segundo_ojo.fecha || '')
        setHora(datosOriginales.segundo_ojo.hora || '')
        setTurnoIdSeleccionado(datosOriginales.segundo_ojo.turno_id)
        setOjoTarget(datosOriginales.segundo_ojo.ojo)
      } else if (datosOriginales.primer_ojo) {
        setCirugia(formatCirugiaConOjoCompleto(datosOriginales.primer_ojo.cirugia, datosOriginales.primer_ojo.ojo))
        setFecha(datosOriginales.primer_ojo.fecha || '')
        setHora(datosOriginales.primer_ojo.hora || '')
        setTurnoIdSeleccionado(datosOriginales.primer_ojo.turno_id)
        setOjoTarget(datosOriginales.primer_ojo.ojo)
      }
    } else {
      setCirugia(formatCirugiaConOjoCompleto(datosOriginales.cirugia, datosOriginales.ojo))
      setFecha(datosOriginales.fecha || '')
      setHora(datosOriginales.hora || '')
      setTurnoIdSeleccionado(datosOriginales.turno_id)
      setOjoTarget(datosOriginales.ojo || '')
    }
    setErrorMsg(null)
  }

  // Plantilla actual seleccionada en la BD
  const templateActualInfo = plantillasDisponibles.find(
    (t) => t.name.toLowerCase() === plantillaSeleccionada.toLowerCase()
  )

  const templateStatus = templateActualInfo ? templateActualInfo.status : 'NO_REGISTRADA'
  const isAprobadaMeta = templateStatus === 'APPROVED'

  // Generar texto completo del mensaje para previsualización
  const cuerpoTextoRenderizado = `Hola ${pacienteNombre || '[Paciente]'}, le recordamos que su cirugía de ${cirugia || '[Procedimiento]'} está programada para el día ${fecha || '[Fecha]'} a las ${hora || '[Horario]'} hs en Centrovisión.

📋 Indicaciones de preparación:
${preparacion || '[Pautas de preparación y ayuno]'}

Por favor, presione el botón inferior para confirmar su asistencia. Ante cualquier consulta, estamos a su disposición.`

  // Manejador del despacho
  const handleEnviarWhatsApp = async () => {
    if (!telefono || telefono.trim().length < 8) {
      setErrorMsg('Por favor ingrese un número de teléfono de WhatsApp válido.')
      return
    }

    if (!isAprobadaMeta) {
      setErrorMsg(`La plantilla seleccionada se encuentra en estado "${templateStatus}". Solo se pueden emitir plantillas autorizadas (APPROVED) por Meta.`)
      return
    }

    setEnviando(true)
    setErrorMsg(null)

    try {
      const payload = {
        telefono: telefono.trim(),
        template_name: plantillaSeleccionada,
        language_code: 'es_AR',
        variables: {
          paciente_nombre: pacienteNombre,
          cirugia: cirugia,
          fecha: fecha,
          hora: hora,
          preparacion: preparacion
        },
        texto_renderizado: cuerpoTextoRenderizado,
        paciente_id: pacienteId || datosOriginales?.paciente_id,
        turno_id: turnoIdSeleccionado || datosOriginales?.turno_id,
        ojo: ojoTarget || datosOriginales?.ojo
      }

      const res = await apiFetch(`/api/asesorias-quirurgicas/${casoId}/enviar-recordatorio-whatsapp`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Error de despacho con Meta WhatsApp Cloud API.')
      }

      setExitoMsg('¡Recordatorio oficial enviado con éxito al paciente!')
      if (onMensajeEnviado) {
        onMensajeEnviado()
      }

      setTimeout(() => {
        onClose()
      }, 1600)
    } catch (err: any) {
      console.error('Error enviando recordatorio por WhatsApp:', err)
      setErrorMsg(
        err.message ||
        'Error de despacho con Meta WhatsApp Cloud API. Verifique si la plantilla fue homologada en Ajustes.'
      )
    } finally {
      setEnviando(false)
    }
  }

  const renderBadgeEstado = (estado?: string, respondidoAt?: string) => {
    if (estado === 'confirmado') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm shrink-0">
          <CheckCircle2 size={11} className="text-emerald-400" />
          <span>Confirmado por Paciente</span>
        </span>
      )
    }
    if (estado === 'con_consulta') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0">
          <AlertCircle size={11} className="text-amber-400" />
          <span>Tiene Consulta</span>
        </span>
      )
    }
    if (estado === 'enviado') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-500/40 flex items-center gap-1 shrink-0">
          <Send size={11} className="text-blue-400" />
          <span>Enviado (Esperando Conf.)</span>
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-800 text-gray-400 border border-neutral-700 shrink-0">
        Pendiente
      </span>
    )
  }

  const horaActualDisplay = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="bg-neutral-900 border border-[var(--border)] w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* ================================================================== */}
        {/* 1. HEADER MODAL */}
        {/* ================================================================== */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-neutral-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <BellRing size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Recordatorio Prequirúrgico Oficial
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/70 text-indigo-300 border border-indigo-500/30">
                  Meta Cloud API • UTILITY
                </span>
                <span className="text-[11px] font-mono font-bold text-gray-400">
                  {datosOriginales?.codigo_caso || ''}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Resuelve práctica médica, turno de quirófano y pautas del Nomenclador. Supera la ventana de 24 hs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================================================================== */}
        {/* 2. BODY CONTENT (2 COLUMNAS: FORMULARIO Y PREVIEW PHONE) */}
        {/* ================================================================== */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* ---------------------------------------------------------------- */}
          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN & EDICIÓN INTERACTIVA (7 cols) */}
          {/* ---------------------------------------------------------------- */}
          <div className="lg:col-span-7 space-y-4">

            {/* Selector de Ojo / Acto Quirúrgico si es Bilateral Escalonada */}
            {datosOriginales?.es_bilateral_escalonada && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/70 via-neutral-900 to-purple-950/70 border border-indigo-500/30 space-y-2.5 shadow-md">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-200">
                    <Sparkles size={13} className="text-indigo-400" />
                    <span>Cirugía Bilateral Escalonada (2 Actos Quirúrgicos)</span>
                  </div>
                  <span className="text-[10.5px] text-gray-400">
                    Seleccione el ojo para emitir o auditar su recordatorio:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Pestaña 1° Ojo */}
                  <button
                    type="button"
                    onClick={() => handleCambiarOjoObjetivo('primer_ojo')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      ojoSeleccionado === 'primer_ojo'
                        ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/40'
                        : 'bg-neutral-900/80 border-neutral-700/80 hover:border-gray-500 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{datosOriginales.primer_ojo?.ojo_label || '1° Ojo'}</span>
                      </span>
                      {renderBadgeEstado(datosOriginales.primer_ojo?.recordatorio_estado, datosOriginales.primer_ojo?.recordatorio_respondido_at)}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
                      <Calendar size={12} className="text-indigo-400 shrink-0" />
                      <span>{datosOriginales.primer_ojo?.fecha || 'Fecha a confirmar'}</span>
                    </div>
                    <div className="text-[10.5px] text-gray-400 flex items-center justify-between">
                      <span className="truncate">{datosOriginales.primer_ojo?.quirofano_nombre || 'Quirófano'}</span>
                      <span className="text-gray-300 font-mono font-medium">{datosOriginales.primer_ojo?.hora || ''}</span>
                    </div>
                  </button>

                  {/* Pestaña 2° Ojo */}
                  <button
                    type="button"
                    onClick={() => handleCambiarOjoObjetivo('segundo_ojo')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      ojoSeleccionado === 'segundo_ojo'
                        ? 'bg-purple-600/25 border-purple-500 text-white shadow-md ring-1 ring-purple-500/40'
                        : 'bg-neutral-900/80 border-neutral-700/80 hover:border-gray-500 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{datosOriginales.segundo_ojo?.ojo_label || '2° Ojo'}</span>
                      </span>
                      {renderBadgeEstado(datosOriginales.segundo_ojo?.recordatorio_estado, datosOriginales.segundo_ojo?.recordatorio_respondido_at)}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-purple-300 font-medium">
                      <Calendar size={12} className="text-purple-400 shrink-0" />
                      <span>{datosOriginales.segundo_ojo?.fecha || 'Fecha a confirmar'}</span>
                    </div>
                    <div className="text-[10.5px] text-gray-400 flex items-center justify-between">
                      <span className="truncate">{datosOriginales.segundo_ojo?.quirofano_nombre || 'Quirófano'}</span>
                      <span className="text-gray-300 font-mono font-medium">{datosOriginales.segundo_ojo?.hora || ''}</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Estado General si es Unilateral */}
            {!datosOriginales?.es_bilateral_escalonada && datosOriginales && (
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-[var(--border)] flex items-center justify-between gap-2">
                <span className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                  <BellRing size={13} className="text-indigo-400" />
                  Estado del Recordatorio Quirúrgico:
                </span>
                {renderBadgeEstado(datosOriginales.recordatorio_estado, datosOriginales.recordatorio_respondido_at)}
              </div>
            )}
            
            {/* Tarjeta de Verificación de Plantilla en Ajustes & Meta */}
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-[var(--border)] space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
                  <Layers size={14} className="text-blue-400" />
                  <span>Plantilla Homologada Meta WABA</span>
                </div>

                {/* Badge de Estado en Meta */}
                <div className="flex items-center gap-1.5">
                  {isAprobadaMeta ? (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Aprobada en Meta
                    </span>
                  ) : templateStatus === 'PENDING' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                      <Clock size={12} /> En Revisión Meta
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <AlertCircle size={12} /> No Registrada en Meta
                    </span>
                  )}

                  <a
                    href="/ajustes"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-0.5 ml-1"
                    title="Auditar y verificar plantillas en Ajustes -> Plantillas WhatsApp"
                  >
                    <span>Ajustes</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Selector de plantilla y comprobación en vivo */}
              <div className="flex items-center gap-2">
                <select
                  value={plantillaSeleccionada}
                  onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {plantillasDisponibles.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.category} • {t.status === 'APPROVED' ? 'Aprobada' : t.status === 'PENDING' ? 'En Revisión' : t.status})
                    </option>
                  ))}
                  {!plantillasDisponibles.some((t) => t.name === 'recordatorio_cirugia_preparacion_v1') && (
                    <option value="recordatorio_cirugia_preparacion_v1">
                      recordatorio_cirugia_preparacion_v1 (Recomendada • No Registrada)
                    </option>
                  )}
                </select>

                <button
                  type="button"
                  onClick={handleSincronizarEstado}
                  disabled={sincronizandoEstado}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 border border-[var(--border)] transition-colors disabled:opacity-50"
                  title="Consultar en tiempo real con Meta Graph API si la plantilla ya fue aprobada"
                >
                  <RefreshCw size={12} className={sincronizandoEstado ? 'animate-spin text-blue-400' : ''} />
                  <span>{sincronizandoEstado ? 'Verificando...' : 'Comprobar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestablecer}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 border border-[var(--border)] transition-colors"
                  title="Restablecer todos los campos a los valores automáticos sugeridos"
                >
                  <RotateCcw size={12} />
                  <span>Sugeridos</span>
                </button>
              </div>

              {!isAprobadaMeta && (
                <div className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 ${
                  templateStatus === 'PENDING'
                    ? 'bg-amber-950/30 border border-amber-500/20 text-amber-200/90'
                    : 'bg-rose-950/30 border border-rose-500/20 text-rose-200/90'
                }`}>
                  <AlertCircle size={14} className={`shrink-0 mt-0.5 ${templateStatus === 'PENDING' ? 'text-amber-400' : 'text-rose-400'}`} />
                  <div>
                    {templateStatus === 'PENDING' ? (
                      <>
                        Esta plantilla está registrada y en proceso de revisión por <strong>Meta WABA</strong>. Meta requiere su aprobación antes del primer despacho. Pulsa <strong>Comprobar</strong> para verificar si Meta ya la aprobó.
                      </>
                    ) : (
                      <>
                        Esta plantilla no se encuentra registrada ni homologada en Meta WhatsApp Cloud API. Para darla de alta, diríjase a{' '}
                        <a href="/ajustes" target="_blank" rel="noreferrer" className="underline font-bold text-rose-300">
                          Ajustes ➔ Plantillas WhatsApp
                        </a>.
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Formulario de Variables Clínicas Editables */}
            <div className="space-y-3 bg-neutral-950/60 p-4 rounded-xl border border-[var(--border)]">
              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-white/5">
                <Sparkles size={13} className="text-indigo-400" />
                <span>Variables del Mensaje (Editables)</span>
              </div>

              {/* Teléfono del Paciente */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                  Teléfono Destinatario (WhatsApp con código de país):
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: 5492614703230"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Variable 1: Nombre para Saludo */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">
                    Nombre Paciente {`{{1}}`}:
                  </label>
                  <input
                    type="text"
                    value={pacienteNombre}
                    onChange={(e) => setPacienteNombre(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Variable 2: Cirugía */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">
                    Cirugía / Procedimiento {`{{2}}`}:
                  </label>
                  <input
                    type="text"
                    value={cirugia}
                    onChange={(e) => setCirugia(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Variable 3: Fecha de Cirugía */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">
                    Fecha Cirugía {`{{3}}`}:
                  </label>
                  <input
                    type="text"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    placeholder="Ej: Viernes 30 de Octubre"
                    className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Variable 4: Horario */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">
                    Horario de Citación / Cirugía {`{{4}}`}:
                  </label>
                  <input
                    type="text"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    placeholder="Ej: 07:30 hs (Cirugía 08:15 hs)"
                    className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Variable 5: Preparación y Ayuno */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 flex items-center justify-between">
                  <span>Indicaciones de Preparación & Ayuno {`{{5}}`}:</span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    Desde Nomenclador de Prácticas
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={preparacion}
                  onChange={(e) => setPreparacion(e.target.value)}
                  placeholder="Detallar horas de ayuno, vestimenta, acompañante y estudios requeridos..."
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                />
              </div>

            </div>

            {/* Mensajes de Alerta / Error / Éxito */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMsg}</div>
              </div>
            )}

            {exitoMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <div className="flex-1 font-bold">{exitoMsg}</div>
              </div>
            )}

          </div>

          {/* ---------------------------------------------------------------- */}
          {/* COLUMNA DERECHA: PREVISUALIZACIÓN REALISTA DE WHATSAPP (5 cols) */}
          {/* ---------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[340px] bg-[#111b21] rounded-2xl border border-neutral-700 shadow-xl overflow-hidden flex flex-col">
              
              {/* WhatsApp Smartphone Header */}
              <div className="bg-[#202c33] px-3.5 py-2.5 flex items-center justify-between border-b border-neutral-800 text-gray-200">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow">
                    CV
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate text-white">
                      Centrovisión Clínica
                    </div>
                    <div className="text-[10px] text-emerald-400 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                      Cuenta Comercial Oficial
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-400 shrink-0">
                  <Video size={14} />
                  <Phone size={14} />
                  <MoreVertical size={14} />
                </div>
              </div>

              {/* Chat Canvas (Fondo oscuro con globo verde WhatsApp) */}
              <div className="p-3 flex-1 bg-[#0b141a] space-y-2 overflow-y-auto min-h-[320px] max-h-[390px] flex flex-col justify-end">
                
                {/* Badge Fecha hoy en chat */}
                <div className="text-center my-1">
                  <span className="px-2 py-0.5 rounded-md bg-[#182229] text-[9.5px] font-medium text-gray-400 shadow">
                    HOY
                  </span>
                </div>

                {/* Globo Oficial de WhatsApp Outbound */}
                <div className="self-end max-w-[92%] bg-[#005c4b] text-gray-100 rounded-2xl rounded-tr-xs p-3 shadow-md space-y-2 text-xs">
                  
                  {/* Cuerpo del Mensaje */}
                  <div className="text-[11.5px] leading-relaxed whitespace-pre-line text-white">
                    Hola <span className="font-bold text-emerald-200">{pacienteNombre || 'Paciente'}</span>, le recordamos que su cirugía de <span className="font-bold text-emerald-200">{cirugia || 'Cirugía Oftalmológica'}</span> está programada para el día <span className="font-bold text-emerald-200">{fecha || 'Fecha'}</span> a las <span className="font-bold text-emerald-200">{hora || 'Horario'}</span> hs en Centrovisión.
                    <br /><br />
                    📋 <span className="font-bold underline">Indicaciones de preparación:</span>
                    <br />
                    <span className="text-gray-100 italic">{preparacion || 'Ayuno y concurrir con DNI.'}</span>
                    <br /><br />
                    Por favor, presione el botón inferior para confirmar su asistencia. Ante cualquier consulta, estamos a su disposición.
                  </div>

                  {/* Footer & Meta Timestamp */}
                  <div className="pt-1 border-t border-emerald-600/30 flex items-center justify-between text-[9.5px] text-emerald-200/80">
                    <span className="truncate">Centrovisión Clínica Oftalmológica</span>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <span>{horaActualDisplay}</span>
                      <CheckCheck size={13} className="text-cyan-300" />
                    </div>
                  </div>
                </div>

                {/* Botones Interactivos Quick Reply oficiales */}
                <div className="self-end w-[92%] space-y-1.5 pt-1">
                  <div className="w-full py-1.5 px-3 bg-[#202c33] hover:bg-[#2a3942] text-cyan-400 rounded-xl text-center text-[11px] font-bold shadow border border-neutral-700/60 cursor-pointer flex items-center justify-center gap-1.5">
                    <Check size={12} className="text-cyan-400" />
                    <span>Confirmar Asistencia</span>
                  </div>
                  <div className="w-full py-1.5 px-3 bg-[#202c33] hover:bg-[#2a3942] text-cyan-400 rounded-xl text-center text-[11px] font-bold shadow border border-neutral-700/60 cursor-pointer flex items-center justify-center gap-1.5">
                    <MessageSquare size={12} className="text-cyan-400" />
                    <span>Tengo una consulta</span>
                  </div>
                </div>

              </div>

              {/* Chat Input Dummy */}
              <div className="bg-[#202c33] px-3 py-2 flex items-center gap-2 border-t border-neutral-800 text-gray-400 text-xs">
                <span className="flex-1 text-[11px] text-gray-500">Respuesta rápida activada...</span>
                <Send size={14} className="text-gray-500" />
              </div>

            </div>

            <p className="text-[10px] text-gray-400 text-center mt-2 max-w-[320px]">
              El paciente podrá responder pulsando un solo botón o escribiendo en el chat de WhatsApp.
            </p>
          </div>

        </div>

        {/* ================================================================== */}
        {/* 3. FOOTER DEL MODAL */}
        {/* ================================================================== */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] bg-neutral-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
            <span>
              Plantilla de Utilidad oficial de Meta. Asienta evolución en la historia clínica del caso.
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleEnviarWhatsApp}
              disabled={enviando || cargando || !isAprobadaMeta}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                isAprobadaMeta
                  ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white cursor-pointer'
                  : 'bg-neutral-800 text-gray-500 border border-neutral-700 cursor-not-allowed opacity-80'
              }`}
              title={!isAprobadaMeta ? 'La plantilla debe estar autorizada por Meta para poder ser enviada.' : undefined}
            >
              {enviando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Despachando a Meta...</span>
                </>
              ) : !isAprobadaMeta ? (
                <>
                  <Clock size={14} className="text-amber-400" />
                  <span>
                    {templateStatus === 'PENDING' ? 'Esperando Aprobación de Meta' : 'Plantilla No Aprobada'}
                  </span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Enviar Recordatorio por WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
