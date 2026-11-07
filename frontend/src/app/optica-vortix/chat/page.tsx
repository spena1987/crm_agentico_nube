'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Glasses,
  Search,
  Send,
  Sparkles,
  Calculator,
  Image as ImageIcon,
  FileText,
  Clock,
  CheckCheck,
  Check,
  StickyNote,
  Bot,
  PauseCircle,
  PlayCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Plus,
  Ticket,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Loader2,
  UserCheck,
  Phone,
  Stethoscope,
  BellRing,
  SlidersHorizontal,
  Wand2,
  AlertTriangle,
  Paperclip,
  Mic,
  Smile,
  Reply,
  Pin,
  Trash2,
  Copy,
  AlertCircle,
  BookOpen,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import WhatsAppFormattedText from '@/components/chat/WhatsAppFormattedText'
import ChatMediaViewer, { DeliveryStatusIcon } from '@/components/chat/ChatMediaViewer'
import ChatEmojiPicker from '@/components/chat/ChatEmojiPicker'
import ChatFloatingFormatToolbar from '@/components/chat/ChatFloatingFormatToolbar'
import ChatMessageContextMenu from '@/components/chat/ChatMessageContextMenu'
import ChatContactContextMenu from '@/components/chat/ChatContactContextMenu'
import ChatQuickRepliesMenu, { QuickReplyTemplate } from '@/components/chat/ChatQuickRepliesMenu'
import ToggleHuman from '@/components/ToggleHuman'
import ModalReenviarMensaje from '@/components/chat/ModalReenviarMensaje'
import ModalSelectorPlantillasMeta from '@/components/chat/ModalSelectorPlantillasMeta'
import ModalHistoriaClinica from '@/components/ModalHistoriaClinica'
import { apiFetch } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { formatDateArg, getCalendarDayKey, formatDateBadge } from '@/lib/dateUtils'
import {
  EtapaComercialOptica,
  OpticaConversacion,
  OpticaGraduacion,
  OpticaMensaje,
  OpcionCotizacionOptica,
  OpticaPlaca,
  OpticaTemplateMeta,
} from '@/types/optica'

// Helpers de sanitización y validación estricta para Cotizador
const sanitizeMoney = (val: unknown): number => {
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''))
  return !Number.isFinite(num) || num < 0 ? 0 : Math.round(num)
}

const sanitizeDiscount = (val: unknown): number => {
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(num)) return 0
  return Math.min(100, Math.max(0, Math.round(num)))
}

const formatCurrencySafe = (val: number): string => {
  const safe = sanitizeMoney(val)
  return safe.toLocaleString('es-AR')
}

const formatRecordTime = (secs: number) => {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

const ETAPAS_EMBUDO: {
  code: EtapaComercialOptica
  label: string
  short: string
  color: string
}[] = [
  {
    code: 'NUEVA_CONSULTA',
    label: 'Nueva Consulta',
    short: 'Nueva',
    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  {
    code: 'CONSULTA_ARMAZON',
    label: 'Consulta Armazón',
    short: 'Armazón',
    color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
  {
    code: 'PRESUPUESTO_AEREOS',
    label: 'Presupuesto Aéreos',
    short: 'Ppto. Aéreos',
    color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  {
    code: 'LENTES_CONTACTO',
    label: 'Lentes de Contacto',
    short: 'Contacto',
    color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  },
  {
    code: 'EN_LABORATORIO',
    label: 'En Laboratorio / Taller',
    short: 'Laboratorio',
    color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  {
    code: 'LISTO_PARA_RETIRAR',
    label: 'Listo para Retirar',
    short: 'Listo Retiro',
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  {
    code: 'VENDIDO',
    label: 'Vendido / Entregado',
    short: 'Vendido',
    color: 'bg-green-600/20 text-green-700 dark:text-green-300 border-green-500/40',
  },
]

const ATAJOS_RAPIDOS = [
  {
    cmd: '/cotizar',
    titulo: 'Presupuesto de Cristales',
    texto:
      '👓 *Presupuesto Óptica Vortix*: Estimado/a {{nombre}}, contamos con opciones en cristales monofocales y multifocales con hasta 20% de descuento y cuotas sin interés. ¿Te gustaría que te coticemos según tu receta?',
  },
  {
    cmd: '/receta',
    titulo: 'Solicitud de Receta Médica',
    texto:
      '📄 Para cotizar tus lentes con exactitud, por favor envíanos una foto nítida de tu orden o receta médica oftalmológica (OD / OI / Cerca / Lejos).',
  },
  {
    cmd: '/retiro',
    titulo: 'Lentes Listos para Retirar',
    texto:
      '✨ ¡Excelente noticia {{nombre}}! Tus lentes ya se encuentran listos para retirar en Óptica Vortix. Te esperamos en Planta Baja del Centro Oftalmológico.',
  },
  {
    cmd: '/cuidados',
    titulo: 'Cuidados y Mantenimiento',
    texto:
      '💧 *Cuidados y Mantenimiento*: Limpia tus cristales con paño de microfibra y spray óptico neutro. No uses alcohol directo ni papel tissue seco para evitar rayaduras.',
  },
  {
    cmd: '/ubicacion',
    titulo: 'Ubicación y Horarios en Planta Baja',
    texto:
      '📍 *Óptica Vortix* te espera en la Planta Baja del Centro Oftalmológico (Av. San Martín 1420), de Lunes a Viernes de 8:30 a 20:00 hs y Sábados de 9:00 a 13:00 hs. ¡Podés pasar sin turno previo!',
  },
  {
    cmd: '/formas_pago',
    titulo: 'Medios de Pago y Cuotas',
    texto:
      '💳 *Formas de Pago*: Contás con 3 y 6 cuotas sin interés con tarjetas bancarias, o un 15% OFF adicional abonando por transferencia o efectivo.',
  },
  {
    cmd: '/garantia',
    titulo: 'Garantía de Adaptación',
    texto:
      '🛡️ Todos nuestros cristales monofocales y multifocales cuentan con *Garantía de Adaptación Recetada* en conjunto con tu médico oftalmólogo de la clínica.',
  },
  {
    cmd: '/limpieza_lc',
    titulo: 'Cuidado Lentes de Contacto',
    texto:
      '💧 Recordá utilizar siempre solución multipropósito estéril para tus lentes de contacto, renovar el líquido del estuche a diario y no dormir con ellos salvo indicación médica.',
  },
]

const PLANTILLAS_OPTICA: QuickReplyTemplate[] = [
  {
    id: 'cotizar',
    command: '/cotizar',
    title: 'Presupuesto de Cristales 1-Clic',
    category: 'Ventas',
    icon: Glasses,
    template:
      '👓 *Presupuesto Óptica Vortix*: Estimado/a *{{nombre}}*, contamos con opciones en cristales monofocales y multifocales con hasta 20% de descuento y cuotas sin interés. ¿Te gustaría que te coticemos según tu receta?',
  },
  {
    id: 'receta',
    command: '/receta',
    title: 'Solicitud de Foto de Receta',
    category: 'Atención',
    icon: FileText,
    template:
      '📄 Para cotizar tus lentes con exactitud, por favor envíanos una foto nítida de tu orden o receta médica oftalmológica (OD / OI / Cerca / Lejos).',
  },
  {
    id: 'retiro',
    command: '/retiro',
    title: 'Lentes Listos para Retirar',
    category: 'Taller',
    icon: Sparkles,
    template:
      '✨ ¡Excelente noticia *{{nombre}}*! Tus lentes ya se encuentran listos para retirar en Óptica Vortix. Te esperamos en Planta Baja del Centro Oftalmológico.',
  },
  {
    id: 'cuidados',
    command: '/cuidados',
    title: 'Cuidados de Cristales y Armazón',
    category: 'Guía',
    icon: Glasses,
    template:
      '💧 *Cuidados y Mantenimiento*: Limpia tus cristales con paño de microfibra y spray óptico neutro. No uses alcohol directo ni papel tissue seco para evitar rayaduras.',
  },
  {
    id: 'ubicacion',
    command: '/ubicacion',
    title: 'Ubicación y Horarios en Planta Baja',
    category: 'Información',
    icon: Clock,
    template:
      '📍 *Óptica Vortix* te espera en la Planta Baja del Centro Oftalmológico (Av. San Martín 1420), de Lunes a Viernes de 8:30 a 20:00 hs y Sábados de 9:00 a 13:00 hs.',
  },
  {
    id: 'formas_pago',
    command: '/formas_pago',
    title: 'Medios de Pago y Cuotas Sin Interés',
    category: 'Facturación',
    icon: Calculator,
    template:
      '💳 *Formas de Pago*: Aceptamos transferencias bancarias, tarjetas de débito y crédito en 3 y 6 cuotas sin interés, o 15% OFF adicional por pago contado efectivo.',
  },
  {
    id: 'garantia',
    command: '/garantia',
    title: 'Garantía de Adaptación Recetada',
    category: 'Atención',
    icon: Sparkles,
    template:
      '🛡️ Todos nuestros cristales monofocales y multifocales cuentan con *Garantía de Adaptación Recetada* en conjunto con tu médico oftalmólogo de la clínica.',
  },
]

const EMPTY_GRADUACION: OpticaGraduacion = {
  od_lejos: { esfera: '', cilindro: '', eje: '', dnp: '' },
  oi_lejos: { esfera: '', cilindro: '', eje: '', dnp: '' },
  od_cerca: { esfera: '', cilindro: '', eje: '' },
  oi_cerca: { esfera: '', cilindro: '', eje: '' },
  add: '',
  tipo_lente_sugerido: 'Monofocal Antirreflex + Filtro Azul',
  observaciones: '',
  fuente: 'MANUAL',
}

export default function OpticaVortixChatPage() {
  const searchParams = useSearchParams()
  const initialConvId = searchParams.get('conv_id')

  // Pestañas Activas / Archivadas
  const [mainTab, setMainTab] = useState<'ACTIVAS' | 'ARCHIVADAS'>('ACTIVAS')

  // Estados de lista de conversaciones
  const [conversaciones, setConversaciones] = useState<OpticaConversacion[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroTab, setFiltroTab] = useState<'TODOS' | 'SIN_LEER' | 'RECETA_HOY' | 'VOUCHERS'>('TODOS')
  const [filtroEtapa, setFiltroEtapa] = useState<EtapaComercialOptica | 'TODAS'>('TODAS')

  // Conversación seleccionada y mensajes
  const [selectedConv, setSelectedConv] = useState<OpticaConversacion | null>(null)
  const [mensajes, setMensajes] = useState<OpticaMensaje[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [showFicha360, setShowFicha360] = useState(true)

  // Ficha Óptica 360° & Graduación editable
  const [graduacion, setGraduacion] = useState<OpticaGraduacion>(EMPTY_GRADUACION)
  const [evolucionHoy, setEvolucionHoy] = useState<{
    fecha: string
    medico: string
    texto_evolucion: string
    tipo_indicacion?: string
  } | null>(null)
  const [savingGraduacion, setSavingGraduacion] = useState(false)

  // Composer de mensaje
  const [inputMsg, setInputMsg] = useState('')
  const [modoNotaInterna, setModoNotaInterna] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [copilotoLoading, setCopilotoLoading] = useState(false)
  const [showCopilotoMenu, setShowCopilotoMenu] = useState(false)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)

  // Respuesta citada (Quoted Message)
  const [replyingToMessage, setReplyingToMessage] = useState<OpticaMensaje | null>(null)

  // Grabación de Audio con MediaRecorder
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Adjunto de archivos locales con Previsualización
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [stagedFilePreview, setStagedFilePreview] = useState<string | null>(null)
  const [stagedFileCaption, setStagedFileCaption] = useState('')
  const [sendingMedia, setSendingMedia] = useState(false)

  // Menús contextuales
  const [contextMenu, setContextMenu] = useState<{ message: OpticaMensaje; position: { x: number; y: number } } | null>(null)
  const [contactContextMenu, setContactContextMenu] = useState<{ conversacion: OpticaConversacion; position: { x: number; y: number } } | null>(null)

  // Modales de Reenvío, Historia Clínica y Plantillas Meta
  const [forwardingMessage, setForwardingMessage] = useState<OpticaMensaje | null>(null)
  const [selectedPacienteHistoriaClinica, setSelectedPacienteHistoriaClinica] = useState<{
    id: string
    nombre: string
    dni?: string | null
    geclisa_ficha_id?: number | null
    telefono?: string
    obra_social?: string | null
  } | null>(null)

  // Modales: Cotizador, Placas, Plantillas, Visor OCR Receta, Nueva Conversación
  const [showCotizadorModal, setShowCotizadorModal] = useState(false)
  const [cotizadorOpciones, setCotizadorOpciones] = useState<OpcionCotizacionOptica[]>([
    {
      titulo: 'Opción 1 • Esencial Antirreflex',
      cristal: 'Orgánico 1.50 c/ Antirreflex',
      tratamiento: 'AR Hidrofóbico + UV400',
      armazon: 'Armazón Línea Clásica Incluido',
      precio_lista: 95000,
      descuento_pct: 20,
      precio_final: 76000,
    },
    {
      titulo: 'Opción 2 • Digital Blue Block (Recomendada)',
      cristal: 'Blue Light Cut 1.56 Alto Confort',
      tratamiento: 'Filtro Luz Azul + Antirreflex Super',
      armazon: 'Armazón Acetato / Metal Premium',
      precio_lista: 138000,
      descuento_pct: 20,
      precio_final: 110400,
    },
    {
      titulo: 'Opción 3 • Ultradelgado Policarbonato',
      cristal: 'Policarbonato 1.59 Alta Resistencia',
      tratamiento: 'Blue Block + Antirrayas + Antirreflex',
      armazon: 'Armazón Vortix Titanium / Diseño',
      precio_lista: 185000,
      descuento_pct: 20,
      precio_final: 148000,
    },
  ])

  const [showPlacasModal, setShowPlacasModal] = useState(false)
  const [placas, setPlacas] = useState<OpticaPlaca[]>([])
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)

  // Visor OCR de Imagen de Receta
  const [visorImagenUrl, setVisorImagenUrl] = useState<string | null>(null)
  const [visorZoom, setVisorZoom] = useState(1)
  const [visorRotation, setVisorRotation] = useState(0)
  const [ocrLoading, setOcrLoading] = useState(false)

  // Modal Nueva Conversación Manual
  const [showNuevaConvModal, setShowNuevaConvModal] = useState(false)
  const [nuevoTel, setNuevoTel] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoDni, setNuevoDni] = useState('')

  // Confirmación de aviso "Lentes Listos para Retirar"
  const [showConfirmListoRetirar, setShowConfirmListoRetirar] = useState(false)
  const [cotizadorError, setCotizadorError] = useState<string | null>(null)

  // Toast visual de notificaciones (OCR, etc.)
  const [toastNotificacion, setToastNotificacion] = useState<{ mensaje: string; tipo?: 'success' | 'info' } | null>(null)

  // Búsqueda en mensajes del chat activo
  const [showSearchInChat, setShowSearchInChat] = useState(false)
  const [inChatSearchQuery, setInChatSearchQuery] = useState('')
  const [inChatSearchMatchIndex, setInChatSearchMatchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Indicador de Presencia ("composing" / "paused")
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastPresenceSentRef = useRef<number>(0)

  // Referencias estables para evitar pestañeo (flickering) y salto involuntario de conversación
  const selectedConvIdRef = useRef<string | null>(null)
  const hasInitialSelectedRef = useRef<boolean>(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mensajes que coinciden con la búsqueda dentro del chat activo
  const matchingMessageIds = useMemo(() => {
    const q = inChatSearchQuery.trim().toLowerCase()
    if (!q) return []
    return mensajes
      .filter((m) => m.contenido && m.contenido.toLowerCase().includes(q))
      .map((m) => m.id)
  }, [mensajes, inChatSearchQuery])

  useEffect(() => {
    setInChatSearchMatchIndex(0)
  }, [inChatSearchQuery])

  const scrollToMatch = useCallback((index: number) => {
    if (matchingMessageIds.length === 0) return
    const safeIndex = (index + matchingMessageIds.length) % matchingMessageIds.length
    setInChatSearchMatchIndex(safeIndex)
    const targetId = matchingMessageIds[safeIndex]
    if (targetId) {
      const el = document.getElementById(`msg-${targetId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [matchingMessageIds])

  // Atajo de teclado global Ctrl+F / Cmd+F para búsqueda en chat y Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (selectedConv) {
          e.preventDefault()
          setShowSearchInChat(true)
          setTimeout(() => searchInputRef.current?.focus(), 60)
        }
      } else if (e.key === 'Escape' && showSearchInChat) {
        e.preventDefault()
        setShowSearchInChat(false)
        setInChatSearchQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedConv, showSearchInChat])

  // Separadores cronológicos de mensajes agrupados por día
  interface MessageDayGroup {
    dateKey: string
    badgeText: string
    messages: OpticaMensaje[]
  }

  const messageDayGroups = useMemo<MessageDayGroup[]>(() => {
    const groups: MessageDayGroup[] = []
    let currentGroup: MessageDayGroup | null = null

    for (const msg of mensajes) {
      const dayKey = getCalendarDayKey(msg.created_at)
      if (!currentGroup || currentGroup.dateKey !== dayKey) {
        currentGroup = {
          dateKey: dayKey,
          badgeText: formatDateBadge(msg.created_at),
          messages: [msg],
        }
        groups.push(currentGroup)
      } else {
        currentGroup.messages.push(msg)
      }
    }

    return groups
  }, [mensajes])

  // Despacho de Presencia debounced ("composing" / "paused")
  const sendPresence = async (convId: string, presence: 'composing' | 'paused') => {
    if (!convId) return
    try {
      await apiFetch(`/api/optica-vortix/conversaciones/${convId}/presencia`, {
        method: 'POST',
        body: JSON.stringify({ presence }),
      })
    } catch {
      // silencioso
    }
  }

  const handleTypingPresence = () => {
    if (modoNotaInterna || !selectedConv?.id) return

    const now = Date.now()
    if (now - lastPresenceSentRef.current > 3000) {
      lastPresenceSentRef.current = now
      sendPresence(selectedConv.id, 'composing')
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (selectedConv?.id && !modoNotaInterna) {
        sendPresence(selectedConv.id, 'paused')
      }
    }, 2500)
  }

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [selectedConv?.id])

  const fetchConversaciones = async (isBackground = false) => {
    try {
      const params = new URLSearchParams()
      if (filtroEtapa !== 'TODAS') params.set('etapa_comercial', filtroEtapa)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      const res = await apiFetch(`/api/optica-vortix/conversaciones?${params.toString()}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        const list: OpticaConversacion[] = Array.isArray(data) ? data : data.items || []
        setConversaciones(list)

        // Auto-selección única inicial: solo se ejecuta la primera vez que carga la página
        if (!selectedConvIdRef.current && !hasInitialSelectedRef.current && list.length > 0) {
          hasInitialSelectedRef.current = true
          const match = initialConvId ? list.find((c) => c.id === initialConvId) : list[0]
          if (match) {
            handleSelectConv(match, false)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      if (!isBackground) {
        setLoadingConvs(false)
      }
    }
  }

  useEffect(() => {
    fetchConversaciones(false)
    const interval = setInterval(() => {
      fetchConversaciones(true)
    }, 12000)
    return () => clearInterval(interval)
  }, [filtroEtapa, searchQuery])

  // Limpieza de grabador de audio al desmontar
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
    }
  }, [])

  // UX-02: Suscripción en Tiempo Real con Supabase Realtime para la conversación activa
  useEffect(() => {
    if (!selectedConv?.id) return

    const activeConvId = selectedConv.id
    const channelName = `optica-chat-${activeConvId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'optica_mensajes',
          filter: `conversacion_id=eq.${activeConvId}`,
        },
        (payload) => {
          const nuevoMsg = payload.new as OpticaMensaje
          setMensajes((prev) => {
            if (prev.some((m) => m.id === nuevoMsg.id || (m.metadata?.wamid && m.metadata.wamid === nuevoMsg.metadata?.wamid))) {
              return prev
            }
            return [...prev, nuevoMsg]
          })

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 60)

          setConversaciones((prevConvs) =>
            prevConvs
              .map((c) =>
                c.id === activeConvId
                  ? {
                      ...c,
                      ultimo_mensaje: nuevoMsg.contenido,
                      ultimo_mensaje_at: nuevoMsg.created_at,
                      no_leidos: nuevoMsg.direccion === 'inbound' ? 0 : c.no_leidos,
                    }
                  : c
              )
              .sort(
                (a, b) =>
                  new Date(b.ultimo_mensaje_at || 0).getTime() -
                  new Date(a.ultimo_mensaje_at || 0).getTime()
              )
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'optica_mensajes',
          filter: `conversacion_id=eq.${activeConvId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as OpticaMensaje
          setMensajes((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConv?.id])

  const handleSelectConv = async (conv: OpticaConversacion, isSilent = false) => {
    const isDifferentConv = conv.id !== selectedConvIdRef.current
    selectedConvIdRef.current = conv.id
    setSelectedConv(conv)
    setReplyingToMessage(null)

    if (isDifferentConv && !isSilent) {
      setLoadingMsgs(true)
    }

    if (conv.graduacion_actual_json) {
      setGraduacion({ ...EMPTY_GRADUACION, ...conv.graduacion_actual_json })
    } else {
      setGraduacion(EMPTY_GRADUACION)
    }

    try {
      const [resM, resF] = await Promise.all([
        apiFetch(`/api/optica-vortix/conversaciones/${conv.id}/mensajes`, { cache: 'no-store' }),
        apiFetch(`/api/optica-vortix/conversaciones/${conv.id}/ficha-optica`, { cache: 'no-store' }),
      ])
      if (resM.ok) {
        const dataM = await resM.json()
        setMensajes(Array.isArray(dataM) ? dataM : dataM.items || [])
      }
      if (resF.ok) {
        const dataF = await resF.json()
        if (dataF.graduacion) {
          setGraduacion({ ...EMPTY_GRADUACION, ...dataF.graduacion })
        }
        setEvolucionHoy(dataF.evolucion_geclisa_hoy || null)
      }
    } catch {
      // ignore
    } finally {
      if (isDifferentConv && !isSilent) {
        setLoadingMsgs(false)
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  // Envío de Texto Libre o Nota Interna
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedConv || !inputMsg.trim() || sendingMsg) return

    setSendingMsg(true)
    const tipo = modoNotaInterna ? 'nota_interna' : 'text'
    const texto = inputMsg.trim()
    const currentReply = replyingToMessage
    setInputMsg('')
    setShowSlashMenu(false)
    setReplyingToMessage(null)

    const metadata: Record<string, any> = {}
    if (currentReply) {
      metadata.reply_to_id = currentReply.id
      metadata.reply_to_text = currentReply.contenido
      metadata.reply_to_emisor = currentReply.direccion === 'inbound' ? 'paciente' : 'operador'
    }

    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`, {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          contenido: texto,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      })
      if (res.ok) {
        const nuevo = await res.json()
        setMensajes((prev) => [...prev, nuevo.mensaje || nuevo])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      }
    } catch {
      // ignore
    } finally {
      setSendingMsg(false)
    }
  }

  // Despacho de Archivo Multimedia o Audio a WhatsApp (Línea 3 Óptica)
  const handleUploadMedia = async (file: File | Blob, tipo: 'audio' | 'imagen' | 'documento', caption?: string) => {
    if (!selectedConv) return
    setSendingMedia(true)
    try {
      const formData = new FormData()
      const fileName = file instanceof File ? file.name : `nota_voz_optica_${Date.now()}.ogg`
      formData.append('file', file, fileName)
      formData.append('telefono', selectedConv.telefono)
      formData.append('conversacion_id', selectedConv.id)
      if (caption) formData.append('caption', caption)
      formData.append('tipo', tipo)

      let ok = false
      let nuevoMensajeData: any = null

      // 1. Intentar endpoint dedicado si está disponible en el servidor
      try {
        const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar-media`, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          nuevoMensajeData = await res.json()
          ok = true
        }
      } catch {
        ok = false
      }

      // 2. Si no respondió OK, usar pipeline de subida a /placas/upload y posterior despacho vía /enviar
      if (!ok) {
        try {
          const uploadForm = new FormData()
          uploadForm.append('file', file, fileName)
          const uploadRes = await apiFetch('/api/optica-vortix/placas/upload', {
            method: 'POST',
            body: uploadForm,
          })
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            const mediaUrl = uploadData.url || uploadData.url_imagen
            if (mediaUrl) {
              const sendRes = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`, {
                method: 'POST',
                body: JSON.stringify({
                  tipo: tipo === 'audio' ? 'audio' : tipo === 'documento' ? 'document' : 'image',
                  media_url: mediaUrl,
                  media_type: tipo === 'audio' ? 'audio' : tipo === 'documento' ? 'document' : 'image',
                  contenido: caption || (tipo === 'audio' ? '🎤 Nota de voz' : fileName),
                  metadata: {
                    tipo,
                    file_name: fileName,
                    media_url: mediaUrl,
                    is_voice_note: tipo === 'audio',
                  },
                }),
              })
              if (sendRes.ok) {
                nuevoMensajeData = await sendRes.json()
                ok = true
              }
            }
          }
        } catch {
          ok = false
        }
      }

      if (ok && nuevoMensajeData) {
        const m = nuevoMensajeData.mensaje || nuevoMensajeData
        setMensajes((prev) => [...prev, m])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      } else {
        alert('No se pudo despachar el archivo multimedia por WhatsApp. Por favor intenta nuevamente.')
      }
    } catch (err) {
      console.error('Error enviando media en óptica:', err)
      alert('Error de conexión al enviar el archivo adjunto.')
    } finally {
      setSendingMedia(false)
      handleCancelStagedFile()
    }
  }

  // Grabador de Audio con MediaRecorder
  const startAudioRecording = async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('Tu navegador no soporta grabación de notas de voz.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.start(200)
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error accediendo al micrófono:', err)
      alert('No se pudo acceder al micrófono. Por favor habilita los permisos de audio en el navegador.')
    }
  }

  const cancelAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      } catch {}
      mediaRecorderRef.current = null
    }
    audioChunksRef.current = []
    setIsRecording(false)
    setRecordingDuration(0)
  }

  const stopAndSendAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    recorder.onstop = async () => {
      try {
        recorder.stream.getTracks().forEach((track) => track.stop())
        const mime = recorder.mimeType || 'audio/webm'
        const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mime })
        const audioFile = new File([audioBlob], `nota_voz_optica_${Date.now()}.${ext}`, { type: mime })
        await handleUploadMedia(audioFile, 'audio', '🎤 Nota de voz')
      } catch (err) {
        console.error('Error procesando nota de voz:', err)
      } finally {
        setIsRecording(false)
        setRecordingDuration(0)
        mediaRecorderRef.current = null
        audioChunksRef.current = []
      }
    }

    try {
      recorder.stop()
    } catch {
      cancelAudioRecording()
    }
  }

  // Manejo de Archivo Seleccionado con Previsualización
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStagedFile(file)
    setStagedFileCaption('')
    if (file.type.startsWith('image/')) {
      setStagedFilePreview(URL.createObjectURL(file))
    } else {
      setStagedFilePreview(null)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCancelStagedFile = () => {
    if (stagedFilePreview) {
      URL.revokeObjectURL(stagedFilePreview)
    }
    setStagedFile(null)
    setStagedFilePreview(null)
    setStagedFileCaption('')
  }

  const handleConfirmSendStagedFile = async () => {
    if (!stagedFile) return
    const isImg = stagedFile.type.startsWith('image/')
    const isAud = stagedFile.type.startsWith('audio/')
    const tipo = isImg ? 'imagen' : isAud ? 'audio' : 'documento'
    await handleUploadMedia(stagedFile, tipo, stagedFileCaption)
  }

  // Handlers de Menú Contextual de Mensaje
  const handleOpenContextMenu = (e: React.MouseEvent, msg: OpticaMensaje) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      message: msg,
      position: { x: e.clientX, y: e.clientY },
    })
  }

  const handleReplyMessage = (msg: OpticaMensaje) => {
    setReplyingToMessage(msg)
    setTimeout(() => {
      messageInputRef.current?.focus()
    }, 60)
  }

  const handleCopyText = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const handleReactToMessage = async (msg: OpticaMensaje, emoji: string) => {
    setMensajes((prev) =>
      prev.map((m) => {
        if (m.id === msg.id) {
          const reactions = m.metadata?.reactions || []
          const filtered = reactions.filter((r: any) => r.emisor !== 'operador')
          return {
            ...m,
            metadata: {
              ...(m.metadata || {}),
              reactions: [...filtered, { emisor: 'operador', emoji, timestamp: new Date().toISOString() }],
            },
          }
        }
        return m
      })
    )
    if (selectedConv) {
      try {
        await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/reaccionar`, {
          method: 'POST',
          body: JSON.stringify({ message_id: msg.id, emoji }),
        })
      } catch (err) {
        console.error('Error al despachar reacción a WhatsApp:', err)
      }
    }
  }

  const handleSaveClinicalNote = async (msg: OpticaMensaje) => {
    if (!selectedConv) return
    alert(`✅ Mensaje registrado en el historial de ${selectedConv.nombre_paciente}`)
  }

  const handleConvertToInternalNote = async (msg: OpticaMensaje) => {
    setMensajes((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, tipo: 'nota_interna' } : m))
    )
  }

  const handleDeleteMessage = async (msg: OpticaMensaje) => {
    setMensajes((prev) => prev.filter((m) => m.id !== msg.id))
  }

  // Handlers de Menú Contextual de Contacto/Conversación
  const handleOpenContactContextMenu = (e: React.MouseEvent, conv: OpticaConversacion) => {
    e.preventDefault()
    e.stopPropagation()
    setContactContextMenu({
      conversacion: conv,
      position: { x: e.clientX, y: e.clientY },
    })
  }

  const handleToggleUnreadContact = async (conv: any) => {
    const nextUnread = (conv.no_leidos || 0) > 0 ? 0 : 1
    setConversaciones((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, no_leidos: nextUnread } : c))
    )
    try {
      await apiFetch(`/api/optica-vortix/conversaciones/${conv.id}/marcar-no-leido`, {
        method: 'PUT',
        body: JSON.stringify({ no_leido: nextUnread > 0 }),
      })
    } catch (err) {
      console.error('Error al actualizar estado no leído en backend:', err)
    }
  }

  const handleTogglePinContact = async (conv: any) => {
    const nextPinned = !(conv as any).is_pinned
    setConversaciones((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, is_pinned: nextPinned } : c))
    )
    try {
      await apiFetch(`/api/optica-vortix/conversaciones/${conv.id}/fijar`, {
        method: 'PUT',
        body: JSON.stringify({ fijado: nextPinned }),
      })
    } catch (err) {
      console.error('Error al fijar conversación en backend:', err)
    }
  }

  const handleToggleArchiveContact = async (conv: any) => {
    const nextArchivada = !conv.archivada
    try {
      await apiFetch(`/api/optica-vortix/conversaciones/${conv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archivada: nextArchivada }),
      })
      setConversaciones((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, archivada: nextArchivada } : c))
      )
      if (selectedConv?.id === conv.id) {
        setSelectedConv((prev) => (prev ? { ...prev, archivada: nextArchivada } : null))
      }
    } catch {}
  }

  const handleToggleBotContact = async (conv: any) => {
    const nextPaused = !conv.bot_paused
    try {
      await apiFetch(`/api/optica-vortix/conversaciones/${conv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ bot_paused: nextPaused }),
      })
      setConversaciones((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, bot_paused: nextPaused } : c))
      )
      if (selectedConv?.id === conv.id) {
        setSelectedConv((prev) => (prev ? { ...prev, bot_paused: nextPaused } : null))
      }
    } catch {}
  }

  const handleCopyPhoneContact = (phone: string) => {
    if (phone) navigator.clipboard.writeText(phone).catch(() => {})
  }

  const handleOpenPatientFileContact = (conv: any) => {
    handleSelectConv(conv)
    setShowFicha360(true)
  }

  const handleDeleteContact = (conv: any) => {
    handleToggleArchiveContact(conv)
  }

  const handleChangeEtapa = async (nuevaEtapa: EtapaComercialOptica, notificarListo = false) => {
    if (!selectedConv) return
    if (nuevaEtapa === 'LISTO_PARA_RETIRAR' && !notificarListo && !showConfirmListoRetirar) {
      setShowConfirmListoRetirar(true)
      return
    }
    setShowConfirmListoRetirar(false)
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          etapa_comercial: nuevaEtapa,
          notificar_lentes_listos: notificarListo,
        }),
      })
      if (res.ok) {
        setSelectedConv({ ...selectedConv, etapa_comercial: nuevaEtapa })
        setConversaciones((prev) =>
          prev.map((c) => (c.id === selectedConv.id ? { ...c, etapa_comercial: nuevaEtapa } : c))
        )
        if (notificarListo) {
          handleSelectConv({ ...selectedConv, etapa_comercial: nuevaEtapa })
        }
      }
    } catch {}
  }

  const handleToggleBot = async () => {
    if (!selectedConv) return
    const nextPaused = !selectedConv.bot_paused
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ bot_paused: nextPaused }),
      })
      if (res.ok) {
        setSelectedConv({ ...selectedConv, bot_paused: nextPaused })
      }
    } catch {}
  }

  const handleSaveGraduacion = async () => {
    if (!selectedConv) return
    setSavingGraduacion(true)
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ graduacion_actual_json: graduacion }),
      })
      if (res.ok) {
        setSelectedConv({ ...selectedConv, graduacion_actual_json: graduacion })
      }
    } catch {
    } finally {
      setSavingGraduacion(false)
    }
  }

  const handleRunOcrReceta = async (mediaUrl: string, rotacionGrados: number = visorRotation) => {
    if (!selectedConv) return
    setOcrLoading(true)
    try {
      const res = await apiFetch('/api/optica-vortix/ia/ocr-receta', {
        method: 'POST',
        body: JSON.stringify({
          media_url: mediaUrl,
          conversacion_id: selectedConv.id,
          rotacion_grados: rotacionGrados,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const rawGrad: any = data.graduacion || data
        const extraida: OpticaGraduacion = {
          ...EMPTY_GRADUACION,
          ...rawGrad,
          fuente: 'OCR_IA',
        }

        setGraduacion(extraida)
        setSelectedConv((prev) => (prev ? { ...prev, graduacion_actual_json: extraida } : null))
        setConversaciones((prev) =>
          prev.map((c) => (c.id === selectedConv.id ? { ...c, graduacion_actual_json: extraida } : c))
        )
        setShowFicha360(true)
        setVisorImagenUrl(null)

        // Toast visual de éxito
        setToastNotificacion({
          mensaje: '✨ Graduación extraída con éxito de la receta (OD / OI)',
          tipo: 'success',
        })
        setTimeout(() => setToastNotificacion(null), 4500)

        // Auto-calibración del Cotizador 1-Clic para presbicia (add o adicion > 0)
        const rawAdd = String(rawGrad.add || rawGrad.adicion || '')
        const addNum = parseFloat(rawAdd.replace('+', '').trim())
        if (!isNaN(addNum) && addNum > 0) {
          const addStr = `+${addNum.toFixed(2)}`
          setCotizadorOpciones([
            {
              titulo: 'Opción 1 • Multifocal Standard Digital',
              cristal: `Multifocal Progresivo Balance 1.50 (Add ${addStr})`,
              tratamiento: 'Antirreflex Clásico + UV400',
              armazon: 'Armazón Línea Clásica Incluido',
              precio_lista: 180000,
              descuento_pct: 20,
              precio_final: 144000,
            },
            {
              titulo: 'Opción 2 • Multifocal Premium Free-Form (Recomendada)',
              cristal: `Multifocal Free-Form Amplio Campo 1.56 (Add ${addStr})`,
              tratamiento: 'Blue Light Cut + Antirreflex Super Hidrofóbico',
              armazon: 'Armazón Acetato / Metal Premium',
              precio_lista: 260000,
              descuento_pct: 20,
              precio_final: 208000,
            },
            {
              titulo: 'Opción 3 • Multifocal Fotocromático Transitions',
              cristal: `Multifocal Digital 1.59 Policarbonato / Transitions (Add ${addStr})`,
              tratamiento: 'Fotocromático Inteligente + Filtro Azul + Extra Dureza',
              armazon: 'Armazón Vortix Titanium / Alta Gama',
              precio_lista: 340000,
              descuento_pct: 20,
              precio_final: 272000,
            },
          ])
        }
      }
    } catch {
    } finally {
      setOcrLoading(false)
    }
  }

  const handleCopilotoIA = async (accion: 'sugerir' | 'mejorar' | 'resumir') => {
    if (!selectedConv) return
    setCopilotoLoading(true)
    setShowCopilotoMenu(false)
    try {
      const res = await apiFetch('/api/optica-vortix/ia/copiloto', {
        method: 'POST',
        body: JSON.stringify({
          conversacion_id: selectedConv.id,
          accion,
          texto_actual: inputMsg,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.texto || data.sugerencia) {
          setInputMsg(data.texto || data.sugerencia)
        }
      }
    } catch {
    } finally {
      setCopilotoLoading(false)
    }
  }

  const handleEnviarCotizacion = async () => {
    if (!selectedConv) return
    setCotizadorError(null)

    // Validar opciones con importes positivos
    const validas = cotizadorOpciones.filter((op) => op.precio_lista > 0 && op.precio_final > 0)
    if (validas.length === 0) {
      setCotizadorError('Al menos una opción debe tener precio de lista y precio final válidos mayores a $0.')
      return
    }

    const cupon = selectedConv.cupon_codigo || '#VORTIX-PACIENTE'
    const lineas = [
      `👓 *PRESUPUESTO ÓPTICA VORTIX* (${cupon})`,
      `Paciente: *${selectedConv.nombre_paciente}*`,
      '',
      ...validas.map(
        (op) =>
          `🔹 *${op.titulo || 'Opción'}*\n• Cristal: ${op.cristal || 'Estándar'}\n• Tratamiento: ${op.tratamiento || 'Básico'}\n• Armazón: ${op.armazon || 'A elección'}\n• Precio Lista: ~${formatCurrencySafe(op.precio_lista)}~ (-${op.descuento_pct}% OFF)\n👉 *Valor Final Paciente: ${formatCurrencySafe(op.precio_final)}*`
      ),
      '',
      '✅ *Incluye:* Garantía de adaptación médica, estuche rígido y paño microfibra. 3 y 6 cuotas sin interés.',
    ].join('\n')

    setShowCotizadorModal(false)
    setSendingMsg(true)
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'cotizacion',
          contenido: lineas,
          metadata: {
            cotizacion_opciones: validas,
            cupon_aplicado: cupon,
          },
        }),
      })
      if (res.ok) {
        const nuevo = await res.json()
        setMensajes((prev) => [...prev, nuevo.mensaje || nuevo])
        handleChangeEtapa('PRESUPUESTO_AEREOS')
      }
    } catch {
    } finally {
      setSendingMsg(false)
    }
  }

  const openPlacasModal = async () => {
    setShowPlacasModal(true)
    try {
      const res = await apiFetch('/api/optica-vortix/placas')
      if (res.ok) {
        const data = await res.json()
        setPlacas(Array.isArray(data) ? data : data.items || [])
      }
    } catch {}
  }

  const handleIniciarConversacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoTel.trim()) return
    try {
      const res = await apiFetch('/api/optica-vortix/conversaciones/iniciar', {
        method: 'POST',
        body: JSON.stringify({
          telefono: nuevoTel.trim(),
          nombre_paciente: nuevoNombre.trim() || 'Paciente Óptica',
          dni: nuevoDni.trim() || null,
        }),
      })
      if (res.ok) {
        const conv = await res.json()
        setShowNuevaConvModal(false)
        setNuevoTel('')
        setNuevoNombre('')
        setNuevoDni('')
        await fetchConversaciones()
        handleSelectConv(conv.conversacion || conv)
      }
    } catch {}
  }

  // Filtrado de conversaciones: Activas vs Archivadas y subfiltros
  const activasCount = conversaciones.filter((c) => !c.archivada).length
  const archivadasCount = conversaciones.filter((c) => c.archivada).length

  const conversacionesFiltradas = conversaciones
    .filter((c) => {
      if (mainTab === 'ARCHIVADAS') return Boolean(c.archivada)
      if (c.archivada) return false
      if (filtroTab === 'SIN_LEER') return (c.no_leidos || 0) > 0
      if (filtroTab === 'RECETA_HOY') return Boolean(c.receta_detectada_hoy || c.origen === 'DETECCION_RECETA_HOY')
      if (filtroTab === 'VOUCHERS') return Boolean(c.cupon_codigo || c.origen === 'PLACA_TURNO')
      return true
    })
    .sort((a, b) => {
      const pinA = (a as any).is_pinned ? 1 : 0
      const pinB = (b as any).is_pinned ? 1 : 0
      if (pinA !== pinB) return pinB - pinA
      return new Date(b.ultimo_mensaje_at || 0).getTime() - new Date(a.ultimo_mensaje_at || 0).getTime()
    })

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      <OpticaSubNavHeader
        rightSlot={
          <button
            type="button"
            onClick={() => setShowNuevaConvModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus size={14} />
            <span>Nuevo Chat Óptica</span>
          </button>
        }
      />

      {/* Contenedor 3 Paneles */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* PANEL IZQUIERDO: Lista de Conversaciones & Embudo */}
        <aside className="w-80 xl:w-96 border-r border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0">
          {/* Pestañas Principales: Activas vs Archivadas */}
          <div className="flex border-b border-[var(--border)] bg-slate-100/60 dark:bg-slate-800/40 p-1">
            <button
              type="button"
              onClick={() => setMainTab('ACTIVAS')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mainTab === 'ACTIVAS'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <span>Activas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                {activasCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMainTab('ARCHIVADAS')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mainTab === 'ARCHIVADAS'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <span>Archivadas</span>
              {archivadasCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-500/15 text-slate-500 dark:text-slate-400 font-bold">
                  {archivadasCount}
                </span>
              )}
            </button>
          </div>

          {/* Buscador y Pestañas Rápidas */}
          <div className="p-3 border-b border-[var(--border)] space-y-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar paciente, DNI, teléfono o #VORTIX..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {mainTab === 'ACTIVAS' && (
              <>
                {/* Pestañas rápidas */}
                <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
                  {[
                    { id: 'TODOS', label: 'Todos' },
                    { id: 'SIN_LEER', label: 'Sin Leer' },
                    { id: 'RECETA_HOY', label: '👓 Receta' },
                    { id: 'VOUCHERS', label: '🎟️ Voucher' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFiltroTab(t.id as any)}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all truncate ${
                        filtroTab === t.id
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Filtro horizontal de Etiquetas de Embudo Óptico (Pipeline de 7 Estados) */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setFiltroEtapa('TODAS')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition-all ${
                      filtroEtapa === 'TODAS'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-[var(--secondary)] border-[var(--border)]'
                    }`}
                  >
                    Todas las Etapas
                  </button>
                  {ETAPAS_EMBUDO.map((et) => (
                    <button
                      key={et.code}
                      type="button"
                      onClick={() => setFiltroEtapa(et.code)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition-all ${
                        filtroEtapa === et.code
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : `${et.color}`
                      }`}
                    >
                      {et.short}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Lista de Tarjetas de Conversación con soporte para Clic Derecho (ChatContactContextMenu) */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
            {loadingConvs ? (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 size={22} className="animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">Cargando bandeja de Óptica Vortix...</span>
              </div>
            ) : conversacionesFiltradas.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Glasses size={28} className="mx-auto text-slate-400" />
                <p className="text-xs font-bold text-[var(--foreground)]">
                  No hay conversaciones en este filtro
                </p>
                <p className="text-[11px] text-[var(--secondary)]">
                  Sincroniza las indicaciones de Geclisa en &ldquo;Oportunidades&rdquo; o inicia un chat nuevo.
                </p>
              </div>
            ) : (
              conversacionesFiltradas.map((conv) => {
                const isSelected = selectedConv?.id === conv.id
                const etapaObj =
                  ETAPAS_EMBUDO.find((e) => e.code === conv.etapa_comercial) || ETAPAS_EMBUDO[0]
                const isPinned = Boolean((conv as any).is_pinned)

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConv(conv)}
                    onContextMenu={(e) => handleOpenContactContextMenu(e, conv)}
                    className={`w-full text-left p-3.5 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-l-4 border-l-indigo-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isPinned && <Pin size={11} className="text-amber-500 rotate-45 shrink-0" />}
                          <span className="font-bold text-xs text-[var(--foreground)] truncate">
                            {conv.nombre_paciente || conv.telefono}
                          </span>
                          {conv.ventana_24h_activa && (
                            <span
                              className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                              title="Ventana Meta 24h abierta (mensajes libres sin costo)"
                            />
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--secondary)] font-medium">
                          +{conv.telefono} {conv.obra_social ? `• ${conv.obra_social}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {conv.no_leidos > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px]">
                            {conv.no_leidos}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[var(--secondary)] line-clamp-1">
                      {conv.ultimo_mensaje || 'Sin mensajes recientes'}
                    </p>

                    <div className="flex items-center flex-wrap gap-1 pt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border ${etapaObj.color}`}
                      >
                        {etapaObj.short}
                      </span>

                      {conv.cupon_codigo && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                          <Ticket size={10} />
                          {conv.cupon_codigo}
                        </span>
                      )}

                      {(conv.receta_detectada_hoy || conv.origen === 'DETECCION_RECETA_HOY') && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          👓 Receta Detectada
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* PANEL CENTRAL: Lienzo Conversacional Fluido */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/40">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Glasses size={32} />
              </div>
              <h2 className="text-base font-black text-[var(--foreground)]">
                Selecciona una conversación de Óptica Vortix
              </h2>
              <p className="text-xs text-[var(--secondary)] max-w-md">
                Desde aquí puedes cotizar cristales monofocales, multifocales y lentes de contacto, extraer recetas por foto con Gemini Vision y consultar la indicación médica de Geclisa.
              </p>
            </div>
          ) : (
            <>
              {/* Cabecera del Chat */}
              <div className="px-4 py-2.5 bg-[var(--card)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {(selectedConv.nombre_paciente || 'OV').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-[var(--foreground)] truncate">
                        {selectedConv.nombre_paciente}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedConv.ventana_24h_activa
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {selectedConv.ventana_24h_activa ? 'Ventana 24h Abierta' : 'Ventana 24h Cerrada (Usar Plantilla)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--secondary)] flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> +{selectedConv.telefono}
                      </span>
                      {selectedConv.dni && <span>• DNI {selectedConv.dni}</span>}
                      {selectedConv.obra_social && <span>• {selectedConv.obra_social}</span>}
                    </p>
                  </div>
                </div>

                {/* Controles Superiores: Selector Etapa 1-clic, Switch Bot ToggleHuman, Cotizador, Búsqueda, Toggle Ficha */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedConv.etapa_comercial}
                    onChange={(e) => handleChangeEtapa(e.target.value as EtapaComercialOptica)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {ETAPAS_EMBUDO.map((et) => (
                      <option key={et.code} value={et.code}>
                        Etapa: {et.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowCotizadorModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Calculator size={14} />
                    <span className="hidden sm:inline">Cotizador Rápido</span>
                  </button>

                  {/* Switch Bot IA en Cabecera (ToggleHuman 1-clic) */}
                  <ToggleHuman
                    conversacionId={selectedConv.id}
                    botDisabled={Boolean(selectedConv.bot_paused)}
                    onToggle={(disabled) => {
                      setSelectedConv((prev) => (prev ? { ...prev, bot_paused: disabled } : null))
                      setConversaciones((prev) =>
                        prev.map((c) => (c.id === selectedConv.id ? { ...c, bot_paused: disabled } : c))
                      )
                      apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ bot_paused: disabled }),
                      }).catch(() => {})
                    }}
                  />

                  {/* Botón Lupa de Búsqueda en Chat Activo (Ctrl + F) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchInChat(!showSearchInChat)
                      if (!showSearchInChat) {
                        setTimeout(() => searchInputRef.current?.focus(), 60)
                      } else {
                        setInChatSearchQuery('')
                      }
                    }}
                    className={`p-1.5 rounded-xl border transition-colors ${
                      showSearchInChat
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : 'border-[var(--border)] text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Buscar en mensajes de este chat (Ctrl + F)"
                  >
                    <Search size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFicha360(!showFicha360)}
                    className="p-1.5 rounded-xl border border-[var(--border)] text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={showFicha360 ? 'Ocultar Ficha Óptica 360°' : 'Mostrar Ficha Óptica 360°'}
                  >
                    {showFicha360 ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                  </button>
                </div>
              </div>

              {/* Barra Desplegable de Búsqueda de Mensajes en el Chat Activo */}
              {showSearchInChat && (
                <div className="px-4 py-2 bg-slate-100/95 dark:bg-slate-800/95 border-b border-[var(--border)] flex items-center justify-between gap-3 backdrop-blur-xs transition-all animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2 flex-1 max-w-md relative">
                    <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={inChatSearchQuery}
                      onChange={(e) => setInChatSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (e.shiftKey) {
                            scrollToMatch(inChatSearchMatchIndex - 1)
                          } else {
                            scrollToMatch(inChatSearchMatchIndex + 1)
                          }
                        }
                      }}
                      placeholder="Buscar en mensajes (Enter: sig., Shift+Enter: ant., Esc: cerrar)..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--secondary)] focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-xs">
                    <span className="text-[11px] font-semibold text-[var(--secondary)] px-2.5 py-1 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-[var(--border)]">
                      {matchingMessageIds.length === 0
                        ? '0 coincidencias'
                        : `${inChatSearchMatchIndex + 1} de ${matchingMessageIds.length}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => scrollToMatch(inChatSearchMatchIndex - 1)}
                      disabled={matchingMessageIds.length === 0}
                      className="p-1.5 rounded-lg border border-[var(--border)] bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 text-[var(--foreground)] transition-colors"
                      title="Coincidencia anterior (Shift + Enter)"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToMatch(inChatSearchMatchIndex + 1)}
                      disabled={matchingMessageIds.length === 0}
                      className="p-1.5 rounded-lg border border-[var(--border)] bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 text-[var(--foreground)] transition-colors"
                      title="Coincidencia siguiente (Enter)"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSearchInChat(false)
                        setInChatSearchQuery('')
                      }}
                      className="p-1.5 rounded-lg hover:bg-rose-500/15 hover:text-rose-500 text-[var(--secondary)] transition-colors ml-1"
                      title="Cerrar búsqueda (Esc)"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* Banner de confirmación para notificar lentes listos */}
              {showConfirmListoRetirar && (
                <div className="px-4 py-2.5 bg-emerald-600 text-white flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <BellRing size={15} className="animate-bounce" />
                    <span>
                      ¿Deseas enviar automáticamente el aviso por WhatsApp: &ldquo;¡Tus lentes están listos para retirar en Óptica Vortix!&rdquo;?
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleChangeEtapa('LISTO_PARA_RETIRAR', true)}
                      className="px-3 py-1 rounded-lg bg-white text-emerald-800 font-black hover:bg-emerald-50"
                    >
                      Sí, Notificar y Mover
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeEtapa('LISTO_PARA_RETIRAR', false)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
                    >
                      Solo Mover Etapa
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmListoRetirar(false)}
                      className="p-1 hover:bg-emerald-700 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline de Mensajes Enriquecido con Separadores Cronológicos por Día (WhatsAppFormattedText + ChatMediaViewer + ContextMenu) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                    <span className="text-xs font-semibold">Cargando historial de mensajes...</span>
                  </div>
                ) : mensajes.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[var(--secondary)]">
                    No hay mensajes aún en esta conversación. Puedes enviar una plantilla o usar el Cotizador Rápido.
                  </div>
                ) : (
                  messageDayGroups.map((group) => (
                    <div key={group.dateKey} className="space-y-3">
                      {/* Píldora de Separador Cronológico por Día (Estilo WhatsApp Web) */}
                      <div className="flex justify-center my-3 sticky top-1 z-10 select-none pointer-events-none">
                        <span className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-slate-200/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 shadow-xs border border-slate-300/40 dark:border-slate-700/60 uppercase backdrop-blur-xs pointer-events-auto">
                          {group.badgeText}
                        </span>
                      </div>

                      {group.messages.map((msg) => {
                        const isOutbound = msg.direccion === 'outbound'
                        const isNota = msg.tipo === 'nota_interna'
                        const isCotizacion = msg.tipo === 'cotizacion'
                        const hasMedia = Boolean(
                          msg.media_url ||
                          msg.metadata?.media_url ||
                          msg.tipo === 'image' ||
                          msg.tipo === 'document' ||
                          msg.tipo === 'audio'
                        )
                        const isCurrentSearchMatch = matchingMessageIds[inChatSearchMatchIndex] === msg.id

                        if (isNota) {
                          return (
                            <div
                              id={`msg-${msg.id}`}
                              key={msg.id}
                              className={`flex justify-center transition-all duration-200 ${
                                isCurrentSearchMatch ? 'ring-2 ring-amber-400 dark:ring-amber-300 rounded-2xl p-0.5' : ''
                              }`}
                              onContextMenu={(e) => handleOpenContextMenu(e, msg)}
                            >
                              <div className="max-w-lg w-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-2xl px-4 py-2.5 text-xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                  <span className="flex items-center gap-1">
                                    <StickyNote size={12} /> Nota Interna de Óptica ({msg.autor_nombre || 'Asesor'})
                                  </span>
                                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <WhatsAppFormattedText text={msg.contenido} className="leading-relaxed" />
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div
                            id={`msg-${msg.id}`}
                            key={msg.id}
                            className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} transition-all duration-200 ${
                              isCurrentSearchMatch ? 'ring-2 ring-amber-400 dark:ring-amber-300 rounded-2xl p-0.5' : ''
                            }`}
                            onContextMenu={(e) => handleOpenContextMenu(e, msg)}
                          >
                            <div
                              className={`max-w-xl rounded-2xl px-4 py-2.5 text-xs shadow-xs space-y-2 select-text ${
                                isCotizacion
                                  ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white border border-indigo-400/30'
                                  : isOutbound
                                  ? 'bg-indigo-600 text-white rounded-br-xs'
                                  : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-bl-xs'
                              }`}
                            >
                              {/* Visualizador de Multimedia Nativo con Transcripción conectada a Óptica */}
                              {hasMedia && (
                                <div className="space-y-1.5">
                                  <ChatMediaViewer
                                    metadata={{
                                      tipo:
                                        msg.tipo === 'audio'
                                          ? 'audio'
                                          : msg.tipo === 'document' || (msg.media_url && msg.media_url.endsWith('.pdf'))
                                          ? 'documento'
                                          : 'imagen',
                                      media_url: msg.media_url || msg.metadata?.media_url,
                                      file_name: msg.metadata?.file_name || msg.media_url?.split('/').pop(),
                                      caption: msg.contenido && !msg.contenido.startsWith('📷') && !msg.contenido.startsWith('🎤') ? msg.contenido : undefined,
                                      is_voice_note: msg.tipo === 'audio' || Boolean(msg.metadata?.is_voice_note),
                                      duration_seconds: msg.metadata?.duration_seconds,
                                      transcripcion: msg.metadata?.transcripcion,
                                      reactions: msg.metadata?.reactions,
                                      delivery_status: msg.metadata?.delivery_status || (msg.estado_entrega === 'read' ? 'leido' : msg.estado_entrega === 'delivered' ? 'entregado' : 'enviado'),
                                    }}
                                    isOperator={isOutbound}
                                    mensajeId={msg.id}
                                    contenidoTexto={msg.contenido}
                                    endpointTranscribir="/api/optica-vortix/mensajes"
                                    onTranscribeSuccess={(msgId, trans) => {
                                      setMensajes((prev) =>
                                        prev.map((m) =>
                                          m.id === msgId
                                            ? {
                                                ...m,
                                                metadata: {
                                                  ...(m.metadata || {}),
                                                  transcripcion: trans,
                                                },
                                              }
                                            : m
                                        )
                                      )
                                    }}
                                  />

                                  {/* Botón directo de Gemini Vision OCR para Recetas */}
                                  {msg.media_url && !msg.media_url.endsWith('.pdf') && msg.tipo !== 'audio' && (
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleRunOcrReceta(msg.media_url!)}
                                        disabled={ocrLoading}
                                        className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-black flex items-center gap-1 shadow-xs transition-colors"
                                      >
                                        {ocrLoading ? (
                                          <Loader2 size={11} className="animate-spin" />
                                        ) : (
                                          <Sparkles size={11} />
                                        )}
                                        ✨ Extraer Graduación con IA
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {msg.template_name && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/15 text-[10px] font-bold">
                                  <FileText size={10} /> Plantilla Meta: {msg.template_name}
                                </div>
                              )}

                              {/* Renderizado Enriquecido de Texto con Negritas, Cursivas, Enlaces */}
                              {(!hasMedia || (msg.contenido && !msg.contenido.startsWith('📷') && !msg.contenido.startsWith('🎤') && !msg.contenido.startsWith('📄'))) && (
                                <WhatsAppFormattedText text={msg.contenido} className="leading-relaxed" />
                              )}

                              {/* Reacciones con Emojis */}
                              {msg.metadata?.reactions && msg.metadata.reactions.length > 0 && (
                                <div className="flex items-center gap-1 pt-0.5">
                                  {msg.metadata.reactions.map((r: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 bg-black/20 rounded-full text-[11px]"
                                      title={`Reacción de ${r.emisor}`}
                                    >
                                      {r.emoji}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Tildes oficiales de entrega con DeliveryStatusIcon */}
                              <div
                                className={`flex items-center justify-end gap-1.5 text-[10px] ${
                                  isOutbound ? 'text-indigo-100/80' : 'text-[var(--secondary)]'
                                }`}
                              >
                                <span>
                                  {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {isOutbound && (
                                  <DeliveryStatusIcon
                                    status={msg.metadata?.delivery_status || msg.estado_entrega || 'enviado'}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra Inferior de Escritura con Herramientas Ópticas, Toolbar Flotante y Grabador de Audio */}
              <div className="p-3 bg-[var(--card)] border-t border-[var(--border)] space-y-2 relative">
                {/* Banner de Cita/Respuesta (Quoted Message estilo WhatsApp Web) */}
                {replyingToMessage && (
                  <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800/90 border-l-4 border-indigo-500 rounded-xl border border-[var(--border)] shadow-md animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Reply size={11} /> Respondiendo a {replyingToMessage.direccion === 'inbound' ? (selectedConv?.nombre_paciente || 'Paciente') : 'Óptica Vortix'}
                      </span>
                      <span className="text-xs text-[var(--secondary)] truncate max-w-md italic mt-0.5">
                        {replyingToMessage.contenido || '[Archivo Multimedia]'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                      title="Cancelar respuesta"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Banner de Ventana de 24 Horas Cerrada */}
                {!selectedConv.ventana_24h_activa && !modoNotaInterna && (
                  <div className="flex items-center justify-between p-2.5 bg-rose-950/20 border border-rose-500/30 rounded-xl shadow-xs text-xs text-rose-600 dark:text-rose-300 animate-in fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle size={15} className="text-rose-500 shrink-0" />
                      <span className="truncate">
                        <strong>Ventana 24h de WhatsApp cerrada</strong>: Meta exige enviar una plantilla aprobada para reabrir el chat.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTemplatesModal(true)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[11px] shrink-0 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer ml-2"
                    >
                      <Send size={11} />
                      <span>Reabrir con Plantilla</span>
                    </button>
                  </div>
                )}

                {/* Menú de Respuestas Rápidas (/) de Óptica Vortix */}
                <ChatQuickRepliesMenu
                  isOpen={showSlashMenu || inputMsg.startsWith('/')}
                  searchFilter={inputMsg.startsWith('/') ? inputMsg : ''}
                  pacienteNombre={selectedConv?.nombre_paciente || 'Paciente'}
                  pacienteTelefono={selectedConv?.telefono}
                  customTemplates={PLANTILLAS_OPTICA}
                  onSelect={(processedText) => {
                    setInputMsg(processedText)
                    setShowSlashMenu(false)
                    setTimeout(() => messageInputRef.current?.focus(), 50)
                  }}
                  onClose={() => setShowSlashMenu(false)}
                />

                {/* Menú flotante de Copiloto IA Óptico */}
                {showCopilotoMenu && (
                  <div className="absolute bottom-full left-36 mb-2 w-64 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                      ✨ Copiloto IA Óptico (Gemini)
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopilotoIA('sugerir')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500/10"
                    >
                      👓 Sugerir argumento óptico según receta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopilotoIA('mejorar')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500/10"
                    >
                      ✨ Mejorar tono comercial del borrador
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopilotoIA('resumir')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500/10"
                    >
                      📋 Resumir conversación para laboratorio
                    </button>
                  </div>
                )}

                {/* Barra de Botones de Acción Rápida */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowSlashMenu(!showSlashMenu)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 text-[var(--foreground)] border border-[var(--border)]"
                    >
                      / Atajos
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCopilotoMenu(!showCopilotoMenu)}
                      disabled={copilotoLoading}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1"
                    >
                      {copilotoLoading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Wand2 size={12} />
                      )}
                      ✨ Copiloto IA
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCotizadorModal(true)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"
                    >
                      <Calculator size={12} />
                      🧮 Cotizador 1-Clic
                    </button>

                    <button
                      type="button"
                      onClick={openPlacasModal}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1"
                    >
                      <ImageIcon size={12} />
                      🖼️ Placas
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTemplatesModal(true)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1"
                    >
                      <FileText size={12} />
                      📋 Plantillas Meta
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModoNotaInterna(!modoNotaInterna)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                      modoNotaInterna
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] border-[var(--border)]'
                    }`}
                  >
                    <StickyNote size={12} />
                    {modoNotaInterna ? 'Modo Nota Interna Activo' : 'Nota Interna'}
                  </button>
                </div>

                {/* Composer Multilínea con Clip Adjunto, Emojis, Floating Toolbar y Micrófono */}
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  {isRecording ? (
                    <div className="flex-1 flex items-center justify-between px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs font-black text-rose-500">Grabando nota de voz:</span>
                        <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatRecordTime(recordingDuration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelAudioRecording}
                          className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 transition-colors"
                          title="Cancelar grabación"
                        >
                          <Trash2 size={14} />
                          <span className="hidden sm:inline">Descartar</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopAndSendAudioRecording}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 transition-colors shadow-xs"
                          title="Enviar nota de voz"
                        >
                          <Send size={13} />
                          <span>Enviar Audio</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Botón Adjunto de Archivos Locales (Clip) */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,audio/*"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendingMedia || modoNotaInterna}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-[var(--border)] rounded-xl text-[var(--secondary)] hover:text-[var(--foreground)] transition-colors shrink-0 disabled:opacity-40 mb-0.5"
                        title="Adjuntar archivo local o imagen (PDF, JPG, PNG)"
                      >
                        {sendingMedia ? <Loader2 size={16} className="animate-spin text-indigo-500" /> : <Paperclip size={16} />}
                      </button>

                      {/* Selector Popover de Emojis */}
                      <ChatEmojiPicker
                        onSelectEmoji={(emoji) => {
                          setInputMsg((prev) => prev + emoji)
                          setTimeout(() => messageInputRef.current?.focus(), 50)
                        }}
                      />

                      {/* Textarea Multilínea con Barra Flotante de Formato (Negrita/Cursiva) */}
                      <div className="flex-1 relative">
                        <ChatFloatingFormatToolbar
                          textareaRef={messageInputRef}
                          value={inputMsg}
                          onChange={(val) => setInputMsg(val)}
                        />
                        <textarea
                          ref={messageInputRef}
                          rows={1}
                          value={inputMsg}
                          onChange={(e) => {
                            setInputMsg(e.target.value)
                            handleTypingPresence()
                            if (e.target.value === '/') setShowSlashMenu(true)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSendMessage()
                            }
                          }}
                          placeholder={
                            modoNotaInterna
                              ? '🔒 Escribe una nota interna para el equipo de óptica (solo visible en el CRM)...'
                              : !selectedConv.ventana_24h_activa
                              ? '⚠️ Ventana 24h cerrada. Haz clic en "Plantillas Meta" arriba para reabrir el chat...'
                              : 'Escribe un mensaje por WhatsApp (*negrita*, _cursiva_, / atajos)...'
                          }
                          className={`w-full px-4 py-2.5 text-xs border rounded-xl text-[var(--foreground)] placeholder:text-[var(--secondary)] focus:outline-none focus:ring-1 resize-none max-h-32 min-h-[38px] overflow-y-auto ${
                            modoNotaInterna
                              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400/50 focus:ring-amber-500 focus:border-amber-500'
                              : 'bg-slate-100 dark:bg-slate-800 border-[var(--border)] focus:ring-indigo-500 focus:border-indigo-500'
                          }`}
                        />
                      </div>

                      {/* Botón Grabadora de Notas de Voz */}
                      {!inputMsg.trim() && !modoNotaInterna && (
                        <button
                          type="button"
                          onClick={startAudioRecording}
                          className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 border border-[var(--border)] rounded-xl text-[var(--secondary)] hover:text-rose-500 transition-colors shrink-0 mb-0.5"
                          title="Grabar nota de voz"
                        >
                          <Mic size={16} />
                        </button>
                      )}

                      {/* Botón Enviar */}
                      <button
                        type="submit"
                        disabled={!inputMsg.trim() || sendingMsg}
                        className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all shrink-0 mb-0.5 ${
                          modoNotaInterna
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {sendingMsg ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        <span>{modoNotaInterna ? 'Guardar' : 'Enviar'}</span>
                      </button>
                    </>
                  )}
                </form>
              </div>
            </>
          )}
        </section>

        {/* PANEL DERECHO: Ficha Óptica 360° Geclisa & Acceso a Historia Clínica */}
        {selectedConv && showFicha360 && (
          <aside className="w-80 xl:w-96 border-l border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3.5 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Glasses size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[var(--foreground)]">
                    Ficha Óptica 360° Geclisa
                  </h3>
                  <p className="text-[10px] text-[var(--secondary)]">
                    Receta Dióptrica, Voucher & Evolución
                  </p>
                </div>
              </div>
              {graduacion.fuente && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Fuente: {graduacion.fuente}
                </span>
              )}
            </div>

            <div className="p-3.5 space-y-4">
              {/* Botón Ver Historia Clínica Completa Geclisa */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPacienteHistoriaClinica({
                    id: selectedConv.paciente_geclisa_id || selectedConv.id,
                    nombre: selectedConv.nombre_paciente || 'Paciente',
                    dni: selectedConv.dni || null,
                    geclisa_ficha_id: selectedConv.paciente_geclisa_id ? parseInt(selectedConv.paciente_geclisa_id, 10) : null,
                    telefono: selectedConv.telefono,
                    obra_social: selectedConv.obra_social || null,
                  })
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Stethoscope size={15} />
                <span>Ver Historia Clínica Geclisa</span>
              </button>

              {/* Cupón Activo */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket size={18} className="text-amber-500" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                      Voucher de Descuento
                    </p>
                    <p className="text-xs font-black text-[var(--foreground)]">
                      {selectedConv.cupon_codigo || '#VORTIX-20OFF'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCotizadorModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400"
                >
                  Cotizar con Cupón
                </button>
              </div>

              {/* Tabla Editable de Graduación / Receta Óptica (OD y OI) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[var(--foreground)]">
                    Graduación / Receta (Lejos)
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveGraduacion}
                    disabled={savingGraduacion}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center gap-1"
                  >
                    {savingGraduacion ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Save size={11} />
                    )}
                    Guardar Ficha
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-[var(--secondary)]">
                      <tr>
                        <th className="py-1.5 px-2 text-left">Ojo</th>
                        <th className="py-1.5 px-1.5 text-center">Esfera</th>
                        <th className="py-1.5 px-1.5 text-center">Cilindro</th>
                        <th className="py-1.5 px-1.5 text-center">Eje</th>
                        <th className="py-1.5 px-1.5 text-center">DNP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      <tr>
                        <td className="py-1.5 px-2 font-black text-indigo-600 dark:text-indigo-400">
                          OD
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="+0.00"
                            value={graduacion.od_lejos?.esfera || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, esfera: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="-0.00"
                            value={graduacion.od_lejos?.cilindro || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, cilindro: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="0°"
                            value={graduacion.od_lejos?.eje || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, eje: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="31"
                            value={graduacion.od_lejos?.dnp || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, dnp: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-black text-emerald-600 dark:text-emerald-400">
                          OI
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="+0.00"
                            value={graduacion.oi_lejos?.esfera || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, esfera: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="-0.00"
                            value={graduacion.oi_lejos?.cilindro || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, cilindro: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="0°"
                            value={graduacion.oi_lejos?.eje || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, eje: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="31"
                            value={graduacion.oi_lejos?.dnp || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, dnp: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Adición Cerca y Tipo de Cristal Sugerido */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Adición (ADD)
                    </label>
                    <input
                      type="text"
                      placeholder="+2.00"
                      value={graduacion.add || ''}
                      onChange={(e) => setGraduacion({ ...graduacion, add: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Cristal / Lente Sugerido
                    </label>
                    <input
                      type="text"
                      placeholder="Multifocal Digital / Blue Cut"
                      value={graduacion.tipo_lente_sugerido || ''}
                      onChange={(e) =>
                        setGraduacion({ ...graduacion, tipo_lente_sugerido: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-[var(--border)] font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Indicación Médica Detectada en Geclisa */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Stethoscope size={12} /> Evolución Geclisa Detectada
                  </span>
                  {evolucionHoy?.fecha && (
                    <span className="text-[10px] text-[var(--secondary)] font-semibold">
                      {formatDateArg(evolucionHoy.fecha)}
                    </span>
                  )}
                </div>

                {evolucionHoy ? (
                  <>
                    <p className="text-[11px] font-bold text-[var(--foreground)]">
                      Dr/a. {evolucionHoy.medico}
                    </p>
                    <p className="text-xs text-[var(--secondary)] bg-[var(--card)] p-2.5 rounded-xl border border-[var(--border)] leading-relaxed">
                      {evolucionHoy.texto_evolucion}
                    </p>
                  </>
                ) : selectedConv.resumen_receta ? (
                  <p className="text-xs text-[var(--secondary)] leading-relaxed">
                    {selectedConv.resumen_receta}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--secondary)]">
                    Sin evolución óptica sincronizada hoy o paciente de ingreso directo. Puedes extraer la receta desde una foto enviada en el chat con el botón <strong>✨ Extraer Graduación con IA</strong>.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL: Cotizador Comparativo 1-Clic */}
      {showCotizadorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">
                    Cotizador Comparativo 1-Clic — Óptica Vortix
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Arma hasta 3 alternativas con el descuento del voucher y envíalas formateadas por WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCotizadorModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--foreground)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {cotizadorOpciones.map((op, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end"
                >
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Título Opción #{idx + 1}
                    </label>
                    <input
                      type="text"
                      value={op.titulo}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].titulo = e.target.value
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Cristal
                    </label>
                    <input
                      type="text"
                      value={op.cristal}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].cristal = e.target.value
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Tratamiento
                    </label>
                    <input
                      type="text"
                      value={op.tratamiento}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].tratamiento = e.target.value
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Precio Lista ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={op.precio_lista}
                      onChange={(e) => {
                        const val = sanitizeMoney(e.target.value)
                        const next = [...cotizadorOpciones]
                        next[idx].precio_lista = val
                        next[idx].precio_final = Math.round(val * (1 - next[idx].descuento_pct / 100))
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-600 mb-0.5">
                      Final c/ {op.descuento_pct}% OFF
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={op.precio_final}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].precio_final = sanitizeMoney(e.target.value)
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/30"
                    />
                  </div>
                </div>
              ))}
            </div>

            {cotizadorError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold">
                ⚠️ {cotizadorError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowCotizadorModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnviarCotizacion}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-md"
              >
                <Send size={14} />
                Enviar Cotización Comparativa al Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visor OCR de Imagen de Receta con Zoom y Rotación */}
      {visorImagenUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-white/15 rounded-2xl px-4 py-2 mb-3 text-white">
            <button
              type="button"
              onClick={() => setVisorZoom((z) => Math.min(z + 0.25, 3))}
              className="p-1.5 hover:bg-white/10 rounded-lg"
              title="Acercar"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => setVisorZoom((z) => Math.max(z - 0.25, 0.5))}
              className="p-1.5 hover:bg-white/10 rounded-lg"
              title="Alejar"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={() => setVisorRotation((r) => (r + 90) % 360)}
              className="p-1.5 hover:bg-white/10 rounded-lg"
              title="Rotar 90°"
            >
              <RotateCw size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleRunOcrReceta(visorImagenUrl, visorRotation)}
              disabled={ocrLoading}
              className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
            >
              {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              ✨ Extraer Graduación con IA (Gemini Vision)
            </button>
            <button
              type="button"
              onClick={() => setVisorImagenUrl(null)}
              className="p-1.5 hover:bg-red-500/20 text-red-300 rounded-lg ml-2"
            >
              <X size={16} />
            </button>
          </div>
          <div className="max-w-4xl max-h-[80vh] overflow-auto flex items-center justify-center p-4">
            <img
              src={visorImagenUrl}
              alt="Receta Óptica"
              style={{
                transform: `scale(${visorZoom}) rotate(${visorRotation}deg)`,
                transition: 'transform 0.2s ease',
              }}
              className="max-h-[75vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* MODAL: Galería de Placas Gráficas Promocionales */}
      {showPlacasModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--foreground)]">
                🖼️ Enviar Placa Gráfica Promocional al Chat
              </h3>
              <button type="button" onClick={() => setShowPlacasModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {placas.length === 0 ? (
                <p className="text-xs text-[var(--secondary)] col-span-2 text-center py-6">
                  Puedes subir nuevas placas promocionales desde la sección &ldquo;Campañas & Placas&rdquo;.
                </p>
              ) : (
                placas.map((pl) => (
                  <div
                    key={pl.id}
                    className="p-3 rounded-2xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-[var(--foreground)]">{pl.titulo}</p>
                      <p className="text-[10px] text-[var(--secondary)]">{pl.categoria}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedConv) return
                        setShowPlacasModal(false)
                        await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`, {
                          method: 'POST',
                          body: JSON.stringify({
                            tipo: 'image',
                            media_url: pl.url_imagen,
                            contenido: pl.descripcion || pl.titulo,
                          }),
                        })
                        handleSelectConv(selectedConv)
                      }}
                      className="w-full py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                    >
                      Enviar Placa al Paciente
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Previsualización de Archivo Local Adjunto antes de Enviar */}
      {stagedFile && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div className="flex items-center gap-2">
                <Paperclip size={16} className="text-indigo-500" />
                <h3 className="text-sm font-black text-[var(--foreground)]">Vista Previa de Adjunto</h3>
              </div>
              <button
                type="button"
                onClick={handleCancelStagedFile}
                disabled={sendingMedia}
                className="p-1 rounded-lg text-slate-400 hover:text-[var(--foreground)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-4 min-h-[160px] max-h-[300px] overflow-hidden">
              {stagedFilePreview ? (
                <img
                  src={stagedFilePreview}
                  alt="Preview"
                  className="max-h-[260px] w-auto object-contain rounded-xl shadow-xs"
                />
              ) : (
                <div className="text-center space-y-2">
                  <FileText size={48} className="mx-auto text-indigo-500" />
                  <p className="text-xs font-bold text-[var(--foreground)] truncate max-w-xs">{stagedFile.name}</p>
                  <p className="text-[11px] text-[var(--secondary)]">{(stagedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                Mensaje / Epígrafe (opcional):
              </label>
              <input
                type="text"
                value={stagedFileCaption}
                onChange={(e) => setStagedFileCaption(e.target.value)}
                placeholder="Ej: Te envío la cotización de los multifocales..."
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmSendStagedFile()
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleCancelStagedFile}
                disabled={sendingMedia}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSendStagedFile}
                disabled={sendingMedia}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                {sendingMedia ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Enviar a WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENÚ CONTEXTUAL DE MENSAJES (Clic Derecho: Responder, Copiar, Reaccionar, Reenviar) */}
      {contextMenu && (
        <ChatMessageContextMenu
          message={{
            ...contextMenu.message,
            emisor: contextMenu.message.tipo === 'nota_interna' ? 'operador' : contextMenu.message.direccion === 'inbound' ? 'paciente' : 'operador',
            metadata_json: contextMenu.message.metadata || {},
          }}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onReply={() => {
            handleReplyMessage(contextMenu.message)
            setContextMenu(null)
          }}
          onCopy={handleCopyText}
          onForward={() => {
            setForwardingMessage(contextMenu.message)
            setContextMenu(null)
          }}
          onReact={(m, emoji) => handleReactToMessage(contextMenu.message, emoji)}
          onSaveClinicalNote={() => handleSaveClinicalNote(contextMenu.message)}
          onConvertToInternalNote={() => handleConvertToInternalNote(contextMenu.message)}
          onDelete={() => handleDeleteMessage(contextMenu.message)}
        />
      )}

      {/* MENÚ CONTEXTUAL DE CONTACTOS (Clic Derecho: Pin, Archivar, Marcar no leído) */}
      {contactContextMenu && (
        <ChatContactContextMenu
          conversacion={{
            ...contactContextMenu.conversacion,
            unread_count: contactContextMenu.conversacion.no_leidos,
            bot_disabled: contactContextMenu.conversacion.bot_paused,
            archivada: contactContextMenu.conversacion.archivada,
            pacientes: {
              id: contactContextMenu.conversacion.paciente_geclisa_id || contactContextMenu.conversacion.id,
              nombre: contactContextMenu.conversacion.nombre_paciente,
              telefono: contactContextMenu.conversacion.telefono,
              dni: contactContextMenu.conversacion.dni,
              obra_social: contactContextMenu.conversacion.obra_social,
            },
            metadata_json: {
              is_pinned: Boolean((contactContextMenu.conversacion as any).is_pinned),
            },
          }}
          position={contactContextMenu.position}
          onClose={() => setContactContextMenu(null)}
          onToggleUnread={() => handleToggleUnreadContact(contactContextMenu.conversacion)}
          onTogglePin={() => handleTogglePinContact(contactContextMenu.conversacion)}
          onToggleArchive={() => handleToggleArchiveContact(contactContextMenu.conversacion)}
          onToggleBot={() => handleToggleBotContact(contactContextMenu.conversacion)}
          onCopyPhone={handleCopyPhoneContact}
          onOpenPatientFile={() => handleOpenPatientFileContact(contactContextMenu.conversacion)}
          onDelete={() => handleDeleteContact(contactContextMenu.conversacion)}
        />
      )}

      {/* MODAL: Selector de Plantillas Meta Homologadas (Línea 3 Óptica) */}
      {showTemplatesModal && selectedConv && (
        <ModalSelectorPlantillasMeta
          isOpen={showTemplatesModal}
          onClose={() => setShowTemplatesModal(false)}
          pacienteNombre={selectedConv.nombre_paciente || 'Paciente'}
          pacienteTelefono={selectedConv.telefono}
          pacienteId={selectedConv.paciente_geclisa_id || selectedConv.id}
          conversacionId={selectedConv.id}
          isWindowOpen={Boolean(selectedConv.ventana_24h_activa)}
          onInsertText={(text) => {
            setInputMsg(text)
            setShowTemplatesModal(false)
            setTimeout(() => messageInputRef.current?.focus(), 50)
          }}
          onEnviadoExitoso={() => {
            setShowTemplatesModal(false)
            handleSelectConv(selectedConv, true)
          }}
        />
      )}

      {/* MODAL: Reenviar Mensaje a otra(s) conversación(es) */}
      {forwardingMessage && (
        <ModalReenviarMensaje
          isOpen={Boolean(forwardingMessage)}
          onClose={() => setForwardingMessage(null)}
          message={{
            ...forwardingMessage,
            metadata_json: forwardingMessage.metadata || {
              media_url: forwardingMessage.media_url,
              tipo: forwardingMessage.tipo,
            },
          }}
          conversaciones={conversaciones.map((c) => ({
            ...c,
            is_window_open: c.ventana_24h_activa,
            pacientes: {
              id: c.paciente_geclisa_id || c.id,
              nombre: c.nombre_paciente,
              telefono: c.telefono,
              dni: c.dni,
            },
          }))}
          currentConvId={selectedConv?.id}
          onForwardSuccess={() => {
            setForwardingMessage(null)
            if (selectedConv) handleSelectConv(selectedConv, true)
          }}
        />
      )}

      {/* MODAL: Historia Clínica Completa de Geclisa */}
      {selectedPacienteHistoriaClinica && (
        <ModalHistoriaClinica
          isOpen={Boolean(selectedPacienteHistoriaClinica)}
          onClose={() => setSelectedPacienteHistoriaClinica(null)}
          paciente={selectedPacienteHistoriaClinica}
        />
      )}

      {/* MODAL: Iniciar Nueva Conversación Manual */}
      {showNuevaConvModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleIniciarConversacion}
            className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--foreground)]">
                Iniciar Nueva Conversación en Óptica Vortix
              </h3>
              <button type="button" onClick={() => setShowNuevaConvModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                  Teléfono WhatsApp (Ej: 5492615551234)
                </label>
                <input
                  type="text"
                  required
                  value={nuevoTel}
                  onChange={(e) => setNuevoTel(e.target.value)}
                  placeholder="549261..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                  Nombre y Apellido del Paciente
                </label>
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: María Gómez"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                  DNI (Opcional para cruzar con Geclisa)
                </label>
                <input
                  type="text"
                  value={nuevoDni}
                  onChange={(e) => setNuevoDni(e.target.value)}
                  placeholder="Ej: 30123456"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowNuevaConvModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Crear y Abrir Chat
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Toast Visual de Notificación */}
      {toastNotificacion && (
        <div className="fixed top-20 right-8 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white border border-emerald-500/40 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
          <Sparkles size={16} className="text-amber-400 shrink-0" />
          <span className="text-xs font-semibold">{toastNotificacion.mensaje}</span>
          <button
            type="button"
            onClick={() => setToastNotificacion(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white ml-2 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
