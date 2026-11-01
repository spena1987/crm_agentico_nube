'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Send,
  ExternalLink,
  Copy,
  Check,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Video,
  Calendar,
  User,
  Clock,
  Sparkles,
  Phone,
  Loader2,
  ShieldCheck,
  FileText,
  Stethoscope,
  Info,
  CheckSquare
} from 'lucide-react'
import { BACKEND_URL, getAuthHeaders } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { normalizePhoneNumber } from '@/lib/phoneUtils'
import { PacienteData, ConsultaOftalmo } from '../types'
import { ALL_VIDEOS } from '../catalogos'
import { useAuth } from '@/context/AuthContext'

export interface MensajeClinicoHCE {
  id: string
  created_at: string
  emisor: string
  contenido: string
  tipo_comunicacion?: string
  delivery_status?: 'enviado' | 'entregado' | 'leido' | 'fallido' | string
  metadata_json?: {
    origen?: string
    modulo?: string
    tipo_comunicacion?: 'prequirurgico' | 'prequirurgico_video' | 'resumen_consulta' | 'video_educativo' | 'estudio_medico' | 'aviso_asistencial' | 'postoperatorio' | string
    consulta_id?: string
    medico_nombre?: string
    medico_usuario_id?: string
    linea_emision?: string
    video_url?: string
    [key: string]: any
  }
}

export type TipoPlantillaHCE =
  | 'prequirurgico'
  | 'postoperatorio'
  | 'video'
  | 'asistencial'

export interface TabConversacionHCEProps {
  paciente: PacienteData | null
  consultaActiva: ConsultaOftalmo | null
  currentUserName?: string | null
}

const VIDEO_URLS_DEFAULT: Record<string, string> = {
  catarata: 'https://centrovision.com.ar/videos/cataratas',
  lio: 'https://centrovision.com.ar/videos/lentes-intraoculares',
  refractiva: 'https://centrovision.com.ar/videos/cirugia-refractiva',
  ind_lasik: 'https://centrovision.com.ar/videos/indicaciones-lasik',
  ind_prk: 'https://centrovision.com.ar/videos/indicaciones-prk',
  querato: 'https://centrovision.com.ar/videos/queratocono',
  ind_cxl: 'https://centrovision.com.ar/videos/crosslinking',
  ind_faco: 'https://centrovision.com.ar/videos/facoemulsificacion',
  ind_anillos: 'https://centrovision.com.ar/videos/anillos-corneales',
  postop: 'https://centrovision.com.ar/videos/postoperatorio-inmediato',
  esp_miopia40: 'https://centrovision.com.ar/videos/refractiva-miopia-40',
  esp_fuchs: 'https://centrovision.com.ar/videos/cataratas-distrofia-fuchs',
  esp_glaucoma: 'https://centrovision.com.ar/videos/cataratas-glaucoma',
  esp_retina: 'https://centrovision.com.ar/videos/cataratas-retina',
  esp_trifocal: 'https://centrovision.com.ar/videos/lentes-trifocales'
}

export default function TabConversacionHCE({
  paciente,
  consultaActiva,
  currentUserName: currentUserNameProp
}: TabConversacionHCEProps) {
  const { user } = useAuth()

  // Nombre del usuario actual para el emisor
  const currentUserName = useMemo(() => {
    return (
      currentUserNameProp ||
      user?.user_metadata?.nombre_completo ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      'Médico en Sesión'
    )
  }, [currentUserNameProp, user])

  // Estado del timeline de mensajes
  const [mensajes, setMensajes] = useState<MensajeClinicoHCE[]>([])
  const [cargandoTimeline, setCargandoTimeline] = useState<boolean>(true)
  const [errorTimeline, setErrorTimeline] = useState<string | null>(null)

  // Selector de Plantilla Activa en Panel Derecho
  const [tipoPlantilla, setTipoPlantilla] = useState<TipoPlantillaHCE>('prequirurgico')

  // Campos de formulario para personalizar la plantilla
  const [cirujanoNombre, setCirujanoNombre] = useState<string>('')
  const [fechaCirugiaTexto, setFechaCirugiaTexto] = useState<string>('Mañana')
  const [videoSeleccionadoKey, setVideoSeleccionadoKey] = useState<string>('catarata')
  const [videoUrlPersonalizada, setVideoUrlPersonalizada] = useState<string>('')
  const [mensajeTexto, setMensajeTexto] = useState<string>('')
  const [textoLibreAsistencial, setTextoLibreAsistencial] = useState<string>('')

  // Estados de envío y feedback
  const [enviando, setEnviando] = useState<boolean>(false)
  const [enviadoExito, setEnviadoExito] = useState<boolean>(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<boolean>(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState<boolean>(false)

  // Inicializar cirujano por defecto
  useEffect(() => {
    if (consultaActiva?.profesional_nombre) {
      setCirujanoNombre(consultaActiva.profesional_nombre)
    } else if (currentUserName) {
      setCirujanoNombre(currentUserName)
    } else {
      setCirujanoNombre('Dra. Malena')
    }
  }, [consultaActiva, currentUserName])

  // Actualizar URL por defecto cuando cambia el video seleccionado
  useEffect(() => {
    const urlDefecto = VIDEO_URLS_DEFAULT[videoSeleccionadoKey] || `https://centrovision.com.ar/videos/${videoSeleccionadoKey}`
    setVideoUrlPersonalizada(urlDefecto)
  }, [videoSeleccionadoKey])

  // Generador dinámico del texto según la plantilla y campos
  useEffect(() => {
    const nombrePac = paciente?.nombre || 'Paciente'
    const cirujano = cirujanoNombre.trim() || 'el equipo médico'
    const linkVideo = videoUrlPersonalizada.trim() || 'https://centrovision.com.ar/videos'
    const nombreVideoObj = ALL_VIDEOS.find(v => v.k === videoSeleccionadoKey)
    const temaVideo = nombreVideoObj?.t || 'tu procedimiento oftalmológico'

    if (tipoPlantilla === 'prequirurgico') {
      const txt = [
        `Hola ${nombrePac}`,
        '',
        `${fechaCirugiaTexto} es tu cirugía y ${cirujano.startsWith('Dr') ? cirujano : `la Dra. ${cirujano}`} te dejó un mensaje en video para que llegues tranquilo/a y sepas cómo va a ser todo:`,
        '',
        `👉 ${linkVideo}`,
        '',
        `Para ${fechaCirugiaTexto.toLowerCase()}:`,
        `* Vení con un acompañante`,
        `* Ropa cómoda, sin maquillaje, cremas ni perfume`,
        `* Tomá tu medicación habitual, salvo que te hayamos indicado otra cosa`,
        '',
        `Esta noche, cená tranquilo/a y dormí bien. Ya hiciste todo lo necesario, ahora nos toca a nosotros. 😊`
      ].join('\n')
      setMensajeTexto(txt)
    } else if (tipoPlantilla === 'postoperatorio') {
      const txt = [
        `Hola ${nombrePac}`,
        '',
        `Esperamos que estés descansando muy bien luego de tu cirugía. Te recordamos las pautas postoperatorias iniciales para cuidar tu recuperación:`,
        '',
        `* Usá el protector ocular rígido o anteojos de sol según te indicamos.`,
        `* Colocate las gotas colirios respetando los horarios y lavándote muy bien las manos previamente.`,
        `* NO te frotes ni presiones los ojos bajo ninguna circunstancia.`,
        `* Evitá esfuerzos físicos bruscos o levantar peso superior a 5 kg.`,
        '',
        `Ante cualquier molestia persistente, disminución repentina de la visión o duda, tenés a tu disposición nuestro canal asistencial.`,
        '',
        `¡Te deseamos una pronta recuperación!`,
        `Equipo Médico Centrovisión`
      ].join('\n')
      setMensajeTexto(txt)
    } else if (tipoPlantilla === 'video') {
      const txt = [
        `Hola ${nombrePac}`,
        '',
        `Te compartimos este video informativo sobre *${temaVideo}* preparado por nuestro equipo médico para que conozcas los detalles y cuidados del tratamiento:`,
        '',
        `👉 ${linkVideo}`,
        '',
        `Cualquier consulta estamos a tu disposición.`,
        `Saludos cordiales,`,
        `${cirujano} · Centrovisión`
      ].join('\n')
      setMensajeTexto(txt)
    } else if (tipoPlantilla === 'asistencial') {
      const cuerpo = textoLibreAsistencial.trim() || 'Nos comunicamos desde el equipo médico de Centrovisión respecto a tu atención clínica.'
      const txt = [
        `Hola ${nombrePac}`,
        '',
        cuerpo,
        '',
        `Saludos cordiales,`,
        `${cirujano} · Centrovisión`
      ].join('\n')
      setMensajeTexto(txt)
    }
  }, [
    tipoPlantilla,
    paciente?.nombre,
    cirujanoNombre,
    fechaCirugiaTexto,
    videoSeleccionadoKey,
    videoUrlPersonalizada,
    textoLibreAsistencial
  ])

  // Cargar Mensajes del Timeline
  const cargarMensajesHCE = useCallback(async () => {
    if (!paciente?.id) {
      setMensajes([])
      setCargandoTimeline(false)
      return
    }

    setCargandoTimeline(true)
    setErrorTimeline(null)

    try {
      // 1. Intentar endpoint backend específico
      let obtenidos: MensajeClinicoHCE[] | null = null
      try {
        const res = await fetch(`${BACKEND_URL}/api/oftalmo/pacientes/${paciente.id}/mensajes-hce`, {
          headers: await getAuthHeaders(),
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.mensajes)) {
            obtenidos = data.mensajes
          } else if (Array.isArray(data)) {
            obtenidos = data
          }
        }
      } catch (errBackend) {
        console.warn('Backend endpoint mensajes-hce no disponible, consultando Supabase:', errBackend)
      }

      // 2. Si no se obtuvieron desde el endpoint, consultar Supabase con filtro estricto de origen HCE
      if (!obtenidos) {
        const { data: convs, error: errConvs } = await supabase
          .from('conversaciones')
          .select('id')
          .eq('paciente_id', paciente.id)

        if (!errConvs && convs && convs.length > 0) {
          const convIds = convs.map(c => c.id)
          const { data: dbMsgs, error: errMsgs } = await supabase
            .from('mensajes')
            .select('*')
            .in('conversacion_id', convIds)
            .order('created_at', { ascending: true })

          if (!errMsgs && dbMsgs) {
            // Filtrar estrictamente mensajes con origen HCE o tipo asistencial
            const filtrados = (dbMsgs as any[]).filter(m => {
              const meta = m.metadata_json || {}
              return (
                meta.origen === 'hce' ||
                meta.modulo === 'historia_oftalmo' ||
                meta.tipo_comunicacion ||
                meta.linea_emision === 'estudios_informativa' ||
                (typeof m.contenido === 'string' && m.contenido.includes('resumen de tu consulta'))
              )
            })

            obtenidos = filtrados.map(m => ({
              id: m.id,
              created_at: m.created_at,
              emisor: m.emisor || 'sistema',
              contenido: m.contenido,
              tipo_comunicacion: m.tipo_comunicacion || m.metadata_json?.tipo_comunicacion || m.metadata_json?.tipo,
              delivery_status: m.delivery_status || m.metadata_json?.delivery_status || 'enviado',
              metadata_json: m.metadata_json
            }))
          }
        }
      }

      setMensajes(obtenidos || [])
    } catch (err: any) {
      console.error('Error cargando mensajes HCE:', err)
      setErrorTimeline('No se pudieron recuperar las comunicaciones del paciente.')
    } finally {
      setCargandoTimeline(false)
    }
  }, [paciente?.id])

  useEffect(() => {
    cargarMensajesHCE()
  }, [cargarMensajesHCE])

  // Despacho Oficial por WhatsApp (Línea Transaccional Informativa)
  const handleDespacharMensaje = async () => {
    if (!paciente?.id || !mensajeTexto.trim()) return

    setEnviando(true)
    setErrorEnvio(null)
    setEnviadoExito(false)

    const esPrequirurgico = tipoPlantilla === 'prequirurgico'
    const medicoEmisor = cirujanoNombre.trim() || currentUserName || 'Equipo Médico'
    const fechaCirugiaValor = fechaCirugiaTexto.trim() || 'Mañana'
    const videoUrlValor = videoUrlPersonalizada.trim() || ''

    const payload: Record<string, any> = {
      paciente_id: paciente.id,
      texto: mensajeTexto.trim(),
      tipo_comunicacion: esPrequirurgico ? 'prequirurgico_video' : tipoPlantilla,
      consulta_id: consultaActiva?.id || null,
      medico_nombre: medicoEmisor,
      video_url: (esPrequirurgico || tipoPlantilla === 'video') ? videoUrlValor : null,
      linea: 'estudios'
    }

    if (esPrequirurgico) {
      payload.template_name = 'indicaciones_prequirurgicas_video_v1'
      payload.cirujano_nombre = medicoEmisor
      payload.fecha_cirugia = fechaCirugiaValor
      payload.video_url = videoUrlValor
      payload.medico_nombre = medicoEmisor
    }

    try {
      let despachoExitoso = false
      let responseData: any = null

      const res = await fetch(`${BACKEND_URL}/api/oftalmo/pacientes/${paciente.id}/enviar-comunicacion-hce`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        responseData = await res.json()
        if (responseData && responseData.success === false) {
          throw new Error(responseData.error || responseData.detail || 'Operación rechazada por el servidor.')
        }
        despachoExitoso = true
      } else {
        let detalleError = `HTTP ${res.status}`
        try {
          const errData = await res.json()
          detalleError = errData.detail || errData.message || errData.error || detalleError
        } catch {
          // Respuesta sin JSON
        }
        throw new Error(detalleError)
      }

      if (despachoExitoso) {
        setEnviadoExito(true)
        setMostrarConfirmacion(false)
        await cargarMensajesHCE()
        setTimeout(() => setEnviadoExito(false), 5000)
      }
    } catch (err: any) {
      console.error('Error al despachar mensaje HCE:', err)
      const errorMsg = err?.message || 'Servicio no disponible o error de red.'
      setErrorEnvio(`Error al despachar el mensaje por WhatsApp: ${errorMsg}`)
    } finally {
      setEnviando(false)
    }
  }

  // Fallback con enlace directo wa.me
  const handleFallbackWaMe = () => {
    if (!paciente?.telefono) {
      alert('El paciente no tiene un número de celular registrado.')
      return
    }

    let fullTel = normalizePhoneNumber(paciente.telefono)
    if (!fullTel) {
      let clean = (paciente.telefono || '').replace(/\D/g, '')
      clean = clean.replace(/^0+/, '')
      if (clean.startsWith('15')) {
        clean = clean.slice(2)
      }
      clean = clean.replace(/^(11|261|351|341|221|223|381|387|299|342|379|388)15(\d+)$/, '$1$2')
      if (clean.startsWith('549')) {
        fullTel = clean
      } else if (clean.startsWith('54')) {
        fullTel = `549${clean.slice(2)}`
      } else if (clean.length >= 8) {
        fullTel = `549${clean}`
      } else {
        fullTel = clean
      }
    }

    const url = `https://wa.me/${fullTel}?text=${encodeURIComponent(mensajeTexto)}`
    window.open(url, '_blank')
  }

  // Copiar al portapapeles
  const handleCopiar = () => {
    navigator.clipboard.writeText(mensajeTexto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // Detección de links en contenido de mensajes para renderizar accesos directos
  const renderContenidoMensaje = (texto: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const partes = texto.split(urlRegex)

    // Extraer URLs de video
    const urlsEncontradas = texto.match(urlRegex) || []

    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap leading-relaxed text-slate-800 text-xs">
          {partes.map((parte, i) => {
            if (parte.match(urlRegex)) {
              return (
                <a
                  key={i}
                  href={parte}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 hover:text-cyan-900 underline font-semibold break-all inline-flex items-center gap-1"
                >
                  {parte}
                  <ExternalLink className="w-3 h-3 inline" />
                </a>
              )
            }
            return parte
          })}
        </p>

        {urlsEncontradas.length > 0 && (
          <div className="pt-2 border-t border-slate-200/70 flex flex-wrap gap-2">
            {urlsEncontradas.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-md text-[11px] font-bold transition-colors shadow-xs"
              >
                <Video className="w-3.5 h-3.5 text-cyan-700" />
                <span>Ver Video Explicativo</span>
                <ExternalLink className="w-3 h-3 text-cyan-600" />
              </a>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Renderizador de Insignia de Tipo
  const renderBadgeTipo = (tipo?: string) => {
    switch (tipo) {
      case 'prequirurgico':
      case 'prequirurgico_video':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
            <CheckSquare className="w-3 h-3" />
            📋 Prequirúrgico
          </span>
        )
      case 'resumen_consulta':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <FileText className="w-3 h-3" />
            📄 Resumen de Consulta
          </span>
        )
      case 'video':
      case 'video_educativo':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
            <Video className="w-3 h-3" />
            🎥 Video Explicativo
          </span>
        )
      case 'estudio_medico':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            <Stethoscope className="w-3 h-3" />
            🔬 Estudio Diagnóstico
          </span>
        )
      case 'postoperatorio':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Sparkles className="w-3 h-3" />
            🩹 Pautas Postoperatorias
          </span>
        )
      case 'asistencial':
      case 'aviso_asistencial':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">
            <MessageSquare className="w-3 h-3" />
            💬 Aviso Asistencial
          </span>
        )
    }
  }

  // Renderizador de Estado de Entrega Meta
  const renderEstadoEntrega = (status?: string) => {
    switch (status) {
      case 'leido':
      case 'read':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600" title="Mensaje leído por el paciente">
            <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
            Leído
          </span>
        )
      case 'entregado':
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500" title="Entregado al dispositivo">
            <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
            Entregado
          </span>
        )
      case 'fallido':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600" title="Error en la entrega">
            <AlertCircle className="w-3.5 h-3.5" />
            Fallido
          </span>
        )
      case 'enviado':
      case 'sent':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400" title="Despachado a Meta WhatsApp">
            <Check className="w-3.5 h-3.5" />
            Enviado
          </span>
        )
    }
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-3 min-h-[580px]">
      
      {/* ========================================================================= */}
      {/* PANEL IZQUIERDO (60%): TIMELINE DE MENSAJES HCE (SOLO LECTURA)            */}
      {/* ========================================================================= */}
      <div className="flex-1 lg:w-3/5 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Banner Superior Distintivo de Seguridad Clínica */}
        <div className="bg-gradient-to-r from-teal-900 via-[#103a49] to-slate-900 text-white px-4 py-3 flex items-start gap-3 border-b border-teal-800">
          <div className="p-1.5 bg-teal-500/20 text-teal-300 rounded-lg shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs tracking-wide uppercase text-teal-200 flex items-center gap-1.5">
                Línea Transaccional de Notificaciones Médicas
              </h3>
              <span className="text-[10px] bg-teal-800/80 text-teal-100 font-bold px-2 py-0.5 rounded-full border border-teal-700">
                Canal No-Reply (Línea 2)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              Solo se visualizan comunicaciones clínicas emitidas desde la HCE (recordatorios, pautas, videos y estudios). Este canal asistencial garantiza confidencialidad médico-legal y no recibe chats informales.
            </p>
          </div>
          <button
            type="button"
            onClick={cargarMensajesHCE}
            disabled={cargandoTimeline}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
            title="Refrescar historial de mensajes"
          >
            <RefreshCw className={`w-4 h-4 ${cargandoTimeline ? 'animate-spin text-teal-300' : ''}`} />
          </button>
        </div>

        {/* Listado Cronológico de Burbujas */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] space-y-3.5">
          {cargandoTimeline ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
              <p className="text-xs font-semibold">Cargando comunicaciones clínicas...</p>
            </div>
          ) : errorTimeline ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorTimeline}</span>
            </div>
          ) : mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400 border border-slate-200">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Sin comunicaciones previas</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Aún no se han emitido comunicaciones transaccionales por WhatsApp para este paciente desde la Historia Clínica.
              </p>
              <div className="mt-4 p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-[11px] max-w-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Utilice el panel derecho para emitir el recordatorio prequirúrgico con video o pautas postoperatorias.</span>
              </div>
            </div>
          ) : (
            mensajes.map((msg) => {
              const meta = msg.metadata_json || {}
              const fechaObj = msg.created_at ? new Date(msg.created_at) : new Date()
              const fechaLegible = fechaObj.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
              const horaLegible = fechaObj.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit'
              })
              const profesionalEmisor = meta.medico_nombre || meta.autor || 'Equipo Asistencial'
              const tipoComunicacion = msg.tipo_comunicacion || meta.tipo_comunicacion || meta.tipo || (msg as any).tipo || 'aviso_asistencial'

              return (
                <div
                  key={msg.id}
                  className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs transition-shadow hover:shadow-sm"
                >
                  {/* Header de la Burbuja */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {renderBadgeTipo(tipoComunicacion)}
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {profesionalEmisor}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {fechaLegible} {horaLegible}
                      </span>
                      <span className="text-slate-300">·</span>
                      {renderEstadoEntrega(msg.delivery_status)}
                    </div>
                  </div>

                  {/* Cuerpo del Mensaje Formateado */}
                  {renderContenidoMensaje(msg.contenido)}
                </div>
              )
            })
          )}
        </div>

        {/* Footer Informativo del Panel Izquierdo */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Total comunicaciones registradas: <strong>{mensajes.length}</strong></span>
          <span className="text-[10px] text-slate-400">Trazabilidad en tiempo real · Ley 26.529</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANEL DERECHO (40%): CENTRO DE EMISIÓN RÁPIDA DE COMUNICACIONES           */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-2/5 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Cabecera del Panel Derecho */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <Send className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs tracking-wide uppercase text-white">
                Centro de Emisión Rápida
              </h3>
              <p className="text-[11px] text-emerald-100">
                Plantillas oficiales pre-aprobadas de Meta
              </p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold bg-emerald-700/80 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-600">
            WhatsApp Oficial
          </span>
        </div>

        {/* Selector de Acciones / Plantillas */}
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
            Seleccionar Acción Asistencial:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTipoPlantilla('prequirurgico')}
              className={`p-2 rounded-lg text-left text-xs font-bold border transition-all flex items-start gap-1.5 ${
                tipoPlantilla === 'prequirurgico'
                  ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-xs font-black'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <div>Prequirúrgico + Video</div>
                <div className="text-[10px] font-normal text-purple-700">Día previo a cirugía</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTipoPlantilla('postoperatorio')}
              className={`p-2 rounded-lg text-left text-xs font-bold border transition-all flex items-start gap-1.5 ${
                tipoPlantilla === 'postoperatorio'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs font-black'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <div>Postoperatorio</div>
                <div className="text-[10px] font-normal text-indigo-700">Cuidados inmediatos</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTipoPlantilla('video')}
              className={`p-2 rounded-lg text-left text-xs font-bold border transition-all flex items-start gap-1.5 ${
                tipoPlantilla === 'video'
                  ? 'bg-cyan-50 border-cyan-400 text-cyan-900 shadow-xs font-black'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Video className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <div>Video Educativo</div>
                <div className="text-[10px] font-normal text-cyan-700">Cataratas, LIOs, etc.</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTipoPlantilla('asistencial')}
              className={`p-2 rounded-lg text-left text-xs font-bold border transition-all flex items-start gap-1.5 ${
                tipoPlantilla === 'asistencial'
                  ? 'bg-teal-50 border-teal-400 text-teal-900 shadow-xs font-black'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <div>Aviso Asistencial</div>
                <div className="text-[10px] font-normal text-teal-700">Texto libre médico</div>
              </div>
            </button>
          </div>
        </div>

        {/* Formulario de Variables según la Plantilla */}
        <div className="p-3 border-b border-slate-200 bg-white space-y-2.5">
          
          {/* Fila 1: Cirujano / Profesional */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                <User className="w-3 h-3 text-slate-400" />
                Profesional / Cirujano
              </label>
              <input
                type="text"
                value={cirujanoNombre}
                onChange={(e) => setCirujanoNombre(e.target.value)}
                placeholder="Ej. Dra. Malena"
                className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {tipoPlantilla === 'prequirurgico' ? (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Fecha Cirugía
                </label>
                <input
                  type="text"
                  value={fechaCirugiaTexto}
                  onChange={(e) => setFechaCirugiaTexto(e.target.value)}
                  placeholder="Ej. Mañana o 15/11"
                  className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  WhatsApp Destino
                </label>
                <div className="text-xs font-bold px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 truncate">
                  {paciente?.telefono ? paciente.telefono : '⚠️ Sin número'}
                </div>
              </div>
            )}
          </div>

          {/* Fila 2: Selector de Video si corresponde */}
          {(tipoPlantilla === 'prequirurgico' || tipoPlantilla === 'video') && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Video className="w-3 h-3 text-slate-400" />
                Video Explicativo de la Clínica
              </label>
              <select
                value={videoSeleccionadoKey}
                onChange={(e) => setVideoSeleccionadoKey(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {ALL_VIDEOS.map((vid) => (
                  <option key={vid.k} value={vid.k}>
                    {vid.t}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="text"
                  value={videoUrlPersonalizada}
                  onChange={(e) => setVideoUrlPersonalizada(e.target.value)}
                  placeholder="URL del video (https://...)"
                  className="flex-1 text-[11px] font-mono px-2 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                {videoUrlPersonalizada && (
                  <a
                    href={videoUrlPersonalizada}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-cyan-700 hover:text-cyan-900 hover:bg-cyan-50 rounded"
                    title="Probar enlace"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Fila 3: Texto Libre para Aviso Asistencial */}
          {tipoPlantilla === 'asistencial' && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                <MessageSquare className="w-3 h-3 text-slate-400" />
                Mensaje Médico Personalizado
              </label>
              <textarea
                rows={3}
                value={textoLibreAsistencial}
                onChange={(e) => setTextoLibreAsistencial(e.target.value)}
                placeholder="Escriba aquí la indicación puntual para el paciente..."
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}
        </div>

        {/* Vista Previa Interactiva del Mensaje */}
        <div className="flex-1 p-3 flex flex-col bg-[#f0fdf4]/40 border-b border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Vista Previa Interactiva:
            </span>
            <button
              type="button"
              onClick={handleCopiar}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
            >
              {copiado ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          <textarea
            value={mensajeTexto}
            onChange={(e) => setMensajeTexto(e.target.value)}
            className="flex-1 w-full text-xs font-sans p-2.5 bg-white border border-emerald-200 rounded-lg text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner leading-relaxed"
            placeholder="Mensaje a enviar..."
          />
        </div>

        {/* Alertas de Éxito / Error */}
        {enviadoExito && (
          <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">¡Mensaje transaccional enviado con éxito e indexado en la HCE!</span>
          </div>
        )}

        {errorEnvio && (
          <div className="px-3 py-2.5 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{errorEnvio}</div>
                <div className="text-[10px] text-rose-700 mt-0.5">
                  El mensaje no pudo despacharse por la línea oficial. Puede enviarlo de forma inmediata mediante contingencia:
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFallbackWaMe}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold shrink-0 shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir y enviar por WhatsApp Web (wa.me)</span>
            </button>
          </div>
        )}

        {/* Acciones de Despacho y Fallback */}
        <div className="p-3 bg-white space-y-2">
          
          {/* Modal / Dialog de Confirmación Previo */}
          {mostrarConfirmacion ? (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
              <div className="text-xs text-amber-900 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                ¿Confirmar emisión transaccional?
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                El mensaje saldrá por la <strong>Línea Informativa 2 (Estudios/No-Reply)</strong> hacia <strong>{paciente?.nombre}</strong> ({paciente?.telefono || 'sin celular'}).
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={enviando}
                  onClick={handleDespacharMensaje}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm transition-colors"
                >
                  {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Confirmar y Enviar
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => setMostrarConfirmacion(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMostrarConfirmacion(true)}
                disabled={enviando || !mensajeTexto.trim()}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Despachando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar por WhatsApp (Línea Informativa)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleFallbackWaMe}
                className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                title="Abrir en WhatsApp Web / wa.me como contingencia"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">wa.me</span>
              </button>
            </div>
          )}

          <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-slate-400" />
            Meta WhatsApp Cloud API v21+ · Auditoría clínica foliada
          </div>
        </div>

      </div>

    </div>
  )
}
