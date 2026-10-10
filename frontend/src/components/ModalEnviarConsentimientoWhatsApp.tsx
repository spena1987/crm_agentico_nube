'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  FileCheck2,
  Send,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Stethoscope,
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
  Link as LinkIcon,
  Copy,
  Info,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface TemplateInfo {
  id?: string
  name: string
  category: string
  status: string
  body_text?: string
}

interface DatosConsentimientoBackend {
  caso_id?: string
  turno_id?: string
  token: string
  enlace_firma: string
  paciente_id: string
  paciente_nombre: string
  saludo_nombre: string
  telefono: string
  cirugia: string
  cirugia_nombre_puro?: string
  ojo?: string
  ojo_desc?: string
  cirujano_nombre: string
  fecha: string
  fecha_iso?: string
  fecha_origen: string
  hora?: string
  quirofano_nombre?: string
  is_window_open: boolean
  window_hours_left?: number
  window_minutes_left?: number
  plantillas: TemplateInfo[]
  plantilla_recomendada: string
  consentimiento_estado?: string
  pdf_url?: string
}

interface ModalEnviarConsentimientoWhatsAppProps {
  isOpen: boolean
  onClose: () => void
  casoId?: string
  turnoId?: string
  pacienteId?: string
  pacienteNombreDefault?: string
  pacienteTelefonoDefault?: string
  onConsentimientoEnviado?: () => void
}

export default function ModalEnviarConsentimientoWhatsApp({
  isOpen,
  onClose,
  casoId,
  turnoId,
  pacienteId,
  pacienteNombreDefault,
  pacienteTelefonoDefault,
  onConsentimientoEnviado
}: ModalEnviarConsentimientoWhatsAppProps) {
  const [cargando, setCargando] = useState<boolean>(true)
  const [enviando, setEnviando] = useState<boolean>(false)
  const [copiado, setCopiado] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [exitoMsg, setExitoMsg] = useState<string | null>(null)

  // Datos de origen devueltos por el backend
  const [datosOriginales, setDatosOriginales] = useState<DatosConsentimientoBackend | null>(null)

  // Campos editables
  const [telefono, setTelefono] = useState<string>('')
  const [pacienteNombre, setPacienteNombre] = useState<string>('')
  const [cirugia, setCirugia] = useState<string>('')
  const [fecha, setFecha] = useState<string>('')
  const [cirujanoNombre, setCirujanoNombre] = useState<string>('')
  const [enlaceFirma, setEnlaceFirma] = useState<string>('')
  const [modoEnvio, setModoEnvio] = useState<'template' | 'free_text'>('template')
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>('consentimiento_informado_quirurgico_v1')
  const [plantillasDisponibles, setPlantillasDisponibles] = useState<TemplateInfo[]>([])

  useEffect(() => {
    if (!isOpen || (!casoId && !turnoId)) return

    let isMounted = true
    setCargando(true)
    setErrorMsg(null)
    setExitoMsg(null)

    const cargarDatos = async () => {
      try {
        const endpoint = casoId
          ? `/api/asesorias-quirurgicas/${casoId}/datos-consentimiento-whatsapp`
          : `/api/turnos-quirofano/${turnoId}/datos-consentimiento-whatsapp`

        const res = await apiFetch(endpoint)
        if (!isMounted) return

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || 'No se pudieron resolver los datos del consentimiento.')
        }

        const resp = await res.json()
        if (resp && resp.ok) {
          const d = resp as DatosConsentimientoBackend
          setDatosOriginales(d)
          setTelefono(d.telefono || pacienteTelefonoDefault || '')
          setPacienteNombre(d.saludo_nombre || d.paciente_nombre || pacienteNombreDefault || '')
          setCirugia(d.cirugia || 'Cirugía Oftalmológica')
          setFecha(d.fecha || 'Fecha programada')
          setCirujanoNombre(d.cirujano_nombre || 'Médico Cirujano')
          setEnlaceFirma(d.enlace_firma || '')
          setPlantillasDisponibles(d.plantillas || [])

          // Modo de envío inicial según estado de la ventana 24h
          if (d.is_window_open) {
            setModoEnvio('free_text')
          } else {
            setModoEnvio('template')
            // Si la plantilla oficial está disponible o se sugiere apertura
            const tieneOficial = (d.plantillas || []).some(
              (p) => p.name === 'consentimiento_informado_quirurgico_v1' && p.status === 'APPROVED'
            )
            setPlantillaSeleccionada(
              tieneOficial ? 'consentimiento_informado_quirurgico_v1' : (d.plantilla_recomendada || 'apertura_conversacion')
            )
          }
        }
      } catch (err: any) {
        if (!isMounted) return
        console.error('Error cargando datos de consentimiento para WhatsApp:', err)
        setErrorMsg(err.message || 'Error cargando datos del consentimiento informado.')
      } finally {
        if (isMounted) setCargando(false)
      }
    }

    cargarDatos()

    return () => {
      isMounted = false
    }
  }, [isOpen, casoId, turnoId, pacienteNombreDefault, pacienteTelefonoDefault])

  if (!isOpen) return null

  const handleCopiarEnlace = () => {
    if (!enlaceFirma) return
    navigator.clipboard.writeText(enlaceFirma)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  const handleRestablecer = () => {
    if (!datosOriginales) return
    setTelefono(datosOriginales.telefono || '')
    setPacienteNombre(datosOriginales.saludo_nombre || datosOriginales.paciente_nombre || '')
    setCirugia(datosOriginales.cirugia || '')
    setFecha(datosOriginales.fecha || '')
    setCirujanoNombre(datosOriginales.cirujano_nombre || '')
    setEnlaceFirma(datosOriginales.enlace_firma || '')
    setErrorMsg(null)
  }

  // Plantilla actual seleccionada en la BD
  const templateActualInfo = plantillasDisponibles.find(
    (t) => t.name.toLowerCase() === plantillaSeleccionada.toLowerCase()
  )
  const templateStatus = templateActualInfo ? templateActualInfo.status : 'NO_REGISTRADA'
  const isAprobadaMeta = templateStatus === 'APPROVED'

  // Generar texto completo del mensaje para previsualización
  const cuerpoTextoRenderizado = modoEnvio === 'template' && plantillaSeleccionada === 'apertura_conversacion'
    ? `Hola ${pacienteNombre || '[Paciente]'}, nos comunicamos de Centrovisión respecto a su cirugía programada. Por favor responda a este mensaje para activar el canal y enviarle la documentación prequirúrgica.`
    : `Hola ${pacienteNombre || '[Paciente]'}, le escribimos de Centrovisión respecto a su cirugía de ${cirugia || '[Cirugía]'} programada para el día ${fecha || '[Fecha]'} con el/la Dr/a. ${cirujanoNombre || '[Cirujano]'}.\n\n📄 Para que pueda leerlo con tranquilidad y firmarlo digitalmente desde su celular antes de asistir a la clínica, le compartimos su Consentimiento Informado oficial:\n${enlaceFirma || '[Enlace de firma]'}\n\nAnte cualquier consulta, estamos a su disposición.`

  const handleEnviar = async () => {
    if (!telefono || telefono.trim().length < 8) {
      setErrorMsg('Debe especificar un número de WhatsApp válido.')
      return
    }

    try {
      setEnviando(true)
      setErrorMsg(null)
      setExitoMsg(null)

      const payload = {
        asesoria_id: casoId || datosOriginales?.caso_id || null,
        turno_id: turnoId || datosOriginales?.turno_id || null,
        paciente_id: pacienteId || datosOriginales?.paciente_id || null,
        telefono: telefono.trim(),
        modo_envio: modoEnvio,
        template_name: modoEnvio === 'template' ? plantillaSeleccionada : null,
        language_code: 'es_AR',
        enlace_firma: enlaceFirma,
        token: datosOriginales?.token,
        variables: {
          paciente_nombre: pacienteNombre,
          cirugia: cirugia,
          fecha: fecha,
          cirujano_nombre: cirujanoNombre,
          enlace_firma: enlaceFirma
        },
        texto_renderizado: cuerpoTextoRenderizado
      }

      const res = await apiFetch('/api/consentimiento-whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Error al despachar el consentimiento por WhatsApp.')
      }

      const data = await res.json()
      setExitoMsg(data.mensaje || 'Consentimiento Informado enviado por WhatsApp exitosamente.')

      if (onConsentimientoEnviado) {
        onConsentimientoEnviado()
      }

      setTimeout(() => {
        onClose()
      }, 1600)
    } catch (err: any) {
      console.error('Error al enviar consentimiento informado:', err)
      setErrorMsg(err.message || 'Error al conectar con el servidor para despachar WhatsApp.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Enviar Consentimiento Informado por WhatsApp
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Meta Cloud API
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Firma digital asistida en móvil (Ley 25.506) con sincronización en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Estado de Ventana 24h */}
        {datosOriginales && (
          <div className={`px-6 py-2.5 flex items-center justify-between text-xs border-b ${
            datosOriginales.is_window_open
              ? 'bg-emerald-50/90 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40'
              : 'bg-amber-50/90 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40'
          }`}>
            <div className="flex items-center gap-2">
              {datosOriginales.is_window_open ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    <strong>Ventana 24h Abierta:</strong> Restan {datosOriginales.window_hours_left || 0}h {datosOriginales.window_minutes_left || 0}m de conversación libre. Se puede enviar texto personalizado directo.
                  </span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Ventana 24h Cerrada:</strong> Requiere plantilla oficial de Meta. Si usa <em>Apertura</em>, el link se enviará automáticamente apenas responda.
                  </span>
                </>
              )}
            </div>
            {datosOriginales.fecha_origen && (
              <span className="font-medium text-[11px] px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                Fecha tomada de: {datosOriginales.fecha_origen === 'expediente_definitiva' ? 'Expediente (Definitiva)' : datosOriginales.fecha_origen === 'turno_quirofano' ? 'Turno Quirófano' : 'Expediente (Probable)'}
              </span>
            )}
          </div>
        )}

        {/* Body dividido en 2 columnas */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {cargando ? (
            <div className="col-span-12 py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium text-slate-500">Cargando datos del consentimiento y evaluando WhatsApp...</p>
            </div>
          ) : (
            <>
              {/* Columna Izquierda: Formulario de Configuración (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Selector de Modo de Envío */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Canal y Modo de Envío:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModoEnvio('template')}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left flex items-center justify-between ${
                        modoEnvio === 'template'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div>Plantilla Oficial Meta</div>
                        <div className="text-[10px] font-normal text-slate-500">Permite ventana cerrada</div>
                      </div>
                      {modoEnvio === 'template' && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>

                    <button
                      type="button"
                      disabled={!datosOriginales?.is_window_open}
                      onClick={() => setModoEnvio('free_text')}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left flex items-center justify-between ${
                        !datosOriginales?.is_window_open
                          ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-400'
                          : modoEnvio === 'free_text'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div>Mensaje Libre (24h)</div>
                        <div className="text-[10px] font-normal text-slate-500">
                          {datosOriginales?.is_window_open ? 'Ventana activa' : 'Requiere ventana abierta'}
                        </div>
                      </div>
                      {modoEnvio === 'free_text' && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  </div>

                  {modoEnvio === 'template' && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Plantilla Homologada Meta:
                      </label>
                      <select
                        value={plantillaSeleccionada}
                        onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                        className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="consentimiento_informado_quirurgico_v1">
                          consentimiento_informado_quirurgico_v1 (Oficial con enlace directo)
                        </option>
                        <option value="apertura_conversacion">
                          apertura_conversacion (Fallback seguro con envío automático diferido)
                        </option>
                      </select>

                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-500">Estado en Meta:</span>
                        <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                          isAprobadaMeta
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : templateStatus === 'PENDING'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {isAprobadaMeta
                            ? 'APROBADA (Oficial Meta v21+)'
                            : templateStatus === 'PENDING'
                            ? 'EN REVISIÓN (Meta evaluando)'
                            : templateStatus}
                        </span>
                        {templateStatus === 'PENDING' && plantillaSeleccionada === 'consentimiento_informado_quirurgico_v1' && (
                          <span className="text-blue-600 dark:text-blue-400 text-[10px]">
                            (Meta está evaluando la plantilla. Puede usar 'apertura_conversacion' si desea enviar ahora)
                          </span>
                        )}
                        {!isAprobadaMeta && templateStatus !== 'PENDING' && plantillaSeleccionada === 'consentimiento_informado_quirurgico_v1' && (
                          <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                            (Si Meta la rechaza, use 'apertura_conversacion')
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Campos de Datos Editables */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Teléfono WhatsApp (E.164):
                    </label>
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="+54 9 11 1234-5678"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Nombre Paciente (Saludo):
                    </label>
                    <input
                      type="text"
                      value={pacienteNombre}
                      onChange={(e) => setPacienteNombre(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Práctica Quirúrgica:
                    </label>
                    <input
                      type="text"
                      value={cirugia}
                      onChange={(e) => setCirugia(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Médico Cirujano:
                    </label>
                    <input
                      type="text"
                      value={cirujanoNombre}
                      onChange={(e) => setCirujanoNombre(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Fecha de la Cirugía (Prioridad Expediente Quirúrgico):
                    </label>
                    <input
                      type="text"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-emerald-700 dark:text-emerald-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Enlace Único de Firma Digital (Token Seguro):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={enlaceFirma}
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono select-all focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopiarEnlace}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                        title="Copiar link"
                      >
                        {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                      </button>
                      {enlaceFirma && (
                        <a
                          href={enlaceFirma}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                          title="Abrir en pestaña nueva"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={handleRestablecer}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer valores originales</span>
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Validez pericial según Ley 25.506 Art. 5
                  </span>
                </div>
              </div>

              {/* Columna Derecha: Simulador WhatsApp (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-start">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Simulador de Entrega en Celular:</span>
                </div>

                {/* Marco de Smartphone */}
                <div className="w-[300px] sm:w-[320px] bg-slate-900 rounded-[36px] p-3 shadow-2xl border-4 border-slate-700/60 overflow-hidden">
                  {/* Notch / Barra superior */}
                  <div className="flex justify-between items-center px-4 py-1 text-[11px] text-white/80 font-mono mb-1">
                    <span>10:30</span>
                    <div className="w-16 h-3 bg-slate-800 rounded-full mx-auto" />
                    <span>100%</span>
                  </div>

                  {/* WhatsApp Header */}
                  <div className="bg-[#075e54] text-white px-3 py-2 rounded-t-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold text-white border border-white/20">
                        C
                      </div>
                      <div>
                        <div className="text-xs font-semibold leading-tight">Centrovisión Quirúrgica</div>
                        <div className="text-[9px] text-emerald-200">En línea • Cuenta de Empresa</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <Phone className="w-3.5 h-3.5" />
                      <Video className="w-3.5 h-3.5" />
                      <MoreVertical className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* WhatsApp Chat Body */}
                  <div className="bg-[#efeae2] dark:bg-[#0b141a] p-3 min-h-[340px] max-h-[380px] overflow-y-auto rounded-b-2xl space-y-2 flex flex-col justify-end">
                    {/* Burbuja del mensaje */}
                    <div className="bg-[#dcf8c6] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 p-2.5 rounded-lg rounded-tr-none shadow-sm text-xs space-y-2 self-end max-w-[92%]">
                      <div className="whitespace-pre-line text-[11px] leading-relaxed">
                        {cuerpoTextoRenderizado}
                      </div>

                      <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 dark:text-slate-300">
                        <span>10:30</span>
                        <CheckCheck className="w-3 h-3 text-sky-500" />
                      </div>
                    </div>

                    {modoEnvio === 'template' && plantillaSeleccionada === 'apertura_conversacion' && (
                      <div className="text-[10px] text-center text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 p-1.5 rounded-md border border-slate-300 dark:border-slate-700">
                        💡 Al contestar el paciente, el sistema le enviará automáticamente el enlace con firma digital.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer / Acciones */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex-1">
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {exitoMsg && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{exitoMsg}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleEnviar}
              disabled={enviando || cargando}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Despachando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar por WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
