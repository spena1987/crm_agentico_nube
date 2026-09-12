'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Send, 
  Phone, 
  User, 
  Bot, 
  Sparkles, 
  MessageCircle, 
  RefreshCw, 
  Smartphone, 
  Settings, 
  Search,
  X,
  CheckCircle2,
  Archive,
  ArchiveRestore,
  Clock,
  AlertCircle,
  ExternalLink,
  Paperclip,
  Loader2,
  Lock,
  ShieldCheck,
  Zap,
  Wand2,
  FileText,
  Check,
  Copy,
  Info,
  Smile,
  ChevronRight,
  ChevronDown,
  Reply,
  Pin,
  PinOff,
  Mail,
  MailCheck,
  UserCheck,
  UserPlus,
  Users,
  Share2,
  Eye,
  ArrowRightLeft
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import ToggleHuman from './ToggleHuman'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'
import ChatMediaViewer, { DeliveryStatusIcon } from './chat/ChatMediaViewer'
import WhatsAppFormattedText from './chat/WhatsAppFormattedText'
import ChatFloatingFormatToolbar from './chat/ChatFloatingFormatToolbar'
import ChatPatientSidebar from './chat/ChatPatientSidebar'
import ChatQuickRepliesMenu from './chat/ChatQuickRepliesMenu'
import ChatEmojiPicker from './chat/ChatEmojiPicker'
import ChatMessageContextMenu from './chat/ChatMessageContextMenu'
import ChatContactContextMenu from './chat/ChatContactContextMenu'
import ModalHistoriaClinica from './ModalHistoriaClinica'
import ModalEditarPaciente from './ModalEditarPaciente'
import ModalSelectorPlantillasMeta from './chat/ModalSelectorPlantillasMeta'
import { BACKEND_URL } from '@/lib/api'

export interface OperadorAsignado {
  id: string
  nombre_completo: string
  email: string
  avatar_url?: string | null
  rol_id?: string | null
  roles?: {
    id: string
    codigo: string
    nombre: string
  } | null
}

interface Paciente {
  id: string
  telefono: string
  nombre: string
  email: string | null
  geclisa_ficha_id?: number | null
  dni?: string | null
  obra_social?: string | null
  plan_cobertura?: string | null
  nro_hc?: string | null
  nro_afiliado?: string | null
  alertas_medicas?: string | null
  direccion?: string | null
}

interface Conversacion {
  id: string
  paciente_id: string
  bot_disabled: boolean
  archivada?: boolean
  agente_asignado_codigo?: string
  asignado_a_usuario_id?: string | null
  estado_gestion?: 'SIN_ASIGNAR' | 'EN_GESTION' | 'RESUELTO' | string | null
  asignado_a?: OperadorAsignado | null
  ultimo_mensaje: string | null
  updated_at: string
  unread_count?: number
  metadata_json?: any
  pacientes: Paciente | Paciente[] | null
  is_window_open?: boolean
  window_expires_at?: string | null
  window_remaining_minutes?: number
  window_hours_left?: number
  window_minutes_left?: number
  last_inbound_at?: string | null
}

interface Mensaje {
  id: string
  conversacion_id: string
  emisor: 'paciente' | 'bot' | 'operador'
  contenido: string
  metadata_json: any
  created_at: string
}

interface WAStatus {
  status: string
  is_logged_in: boolean
}

export const getPatient = (conv?: Conversacion | null): Paciente | null => {
  if (!conv || !conv.pacientes) return null
  if (Array.isArray(conv.pacientes)) {
    return (conv.pacientes as Paciente[])[0] || null
  }
  return conv.pacientes as Paciente
}

const getInitials = (name?: string): string => {
  if (!name) return 'P'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const formatTimestamp = (dateString?: string): string => {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' })
  } catch (e) {
    return ''
  }
}

const formatMessageSnippet = (content?: string | null): string => {
  if (!content) return 'Sin mensajes aún'
  if (content.includes('[IMAGEN]') || content.includes('[IMAGE]')) return '📷 Foto adjunta'
  if (content.includes('[DOCUMENTO]') || content.includes('[DOCUMENT]')) return '📄 Documento PDF'
  if (content.includes('[AUDIO]')) return '🎤 Nota de voz'
  if (content.includes('[VIDEO]')) return '🎥 Video'
  if (content.includes('[STICKER]')) return '✨ Sticker'
  return content
}

export default function ChatInbox() {
  const { user } = useAuth()
  const currentUserId = user?.id
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true)
  const [waStatus, setWaStatus] = useState<WAStatus | null>(null)
  
  // Triaging y Filtros Multi-Operador
  const [activeTab, setActiveTab] = useState<'mis_chats' | 'sin_asignar' | 'todos' | 'bot' | 'archivados'>('mis_chats')
  const [filtroOperadorId, setFiltroOperadorId] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSimulator, setShowSimulator] = useState(false)

  // Operadores disponibles y gestión de traspasos
  const [operadores, setOperadores] = useState<OperadorAsignado[]>([])
  const [cargandoOperadores, setCargandoOperadores] = useState(false)
  const [showDerivarModal, setShowDerivarModal] = useState(false)
  const [derivarUsuarioId, setDerivarUsuarioId] = useState('')
  const [derivarNota, setDerivarNota] = useState('')
  const [derivando, setDerivando] = useState(false)
  const [tomandoCaso, setTomandoCaso] = useState(false)
  const [finalizandoCaso, setFinalizandoCaso] = useState(false)

  // Presencia y Detección de Colisiones entre Operadores (Supabase Realtime Presence)
  const [activeOperatorsInChat, setActiveOperatorsInChat] = useState<Array<{
    user_id: string
    user_name: string
    avatar_url?: string
  }>>([])
  const presenceChannelRef = useRef<any>(null)

  // Opciones avanzadas de CRM
  const [showPatientSidebar, setShowPatientSidebar] = useState(true)
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false)
  const [copilotLoading, setCopilotLoading] = useState<'sugerir' | 'mejorar' | 'resumir' | null>(null)
  const [aiSummaryText, setAiSummaryText] = useState<string | null>(null)
  const [selectedPacienteHistoriaClinica, setSelectedPacienteHistoriaClinica] = useState<any | null>(null)
  const [selectedPacienteEditar, setSelectedPacienteEditar] = useState<any | null>(null)
  const [guardandoPaciente, setGuardandoPaciente] = useState(false)

  // Para pruebas/simulación
  const [simTelefono, setSimTelefono] = useState('5491123456789')
  const [simTexto, setSimTexto] = useState('')
  const [simulando, setSimulando] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef<boolean>(true)
  const isInitialLoadRef = useRef<boolean>(true)
  const prevMessagesLengthRef = useRef<number>(0)
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false)
  const [unreadNewCount, setUnreadNewCount] = useState<number>(0)
  const [replyingToMessage, setReplyingToMessage] = useState<Mensaje | null>(null)
  const [contextMenu, setContextMenu] = useState<{ message: Mensaje; position: { x: number; y: number } } | null>(null)
  const [contactContextMenu, setContactContextMenu] = useState<{ conversacion: Conversacion; position: { x: number; y: number } } | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false)

  const messagesCacheRef = useRef<Record<string, Mensaje[]>>({})
  const conversacionesRef = useRef<Conversacion[]>([])
  const selectedConvIdRef = useRef<string | null>(null)

  useEffect(() => {
    conversacionesRef.current = conversaciones
  }, [conversaciones])

  useEffect(() => {
    selectedConvIdRef.current = selectedConvId
  }, [selectedConvId])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)

  // Cálculo en tiempo real de la Ventana de Atención de 24 Horas de Meta
  const getMeta24hStatus = () => {
    if (!selectedConvId) return { isOpen: true, hoursLeft: 24, minutesLeft: 0, isExpired: false, isUrgent: false }

    // 1. Prioridad: Estado oficial calculado por el servidor desde patient_conversations
    const activeConv = conversaciones.find((c) => c.id === selectedConvId)
    if (activeConv && typeof activeConv.is_window_open === 'boolean') {
      if (activeConv.window_expires_at) {
        const expTime = new Date(activeConv.window_expires_at).getTime()
        const now = Date.now()
        const remMs = expTime - now
        if (remMs > 0) {
          const hoursLeft = Math.floor(remMs / (1000 * 60 * 60))
          const minutesLeft = Math.floor((remMs % (1000 * 60 * 60)) / (1000 * 60))
          return { isOpen: true, hoursLeft, minutesLeft, isExpired: false, isUrgent: hoursLeft < 2 }
        } else {
          return { isOpen: false, hoursLeft: 0, minutesLeft: 0, isExpired: true, isUrgent: false }
        }
      } else {
        return {
          isOpen: activeConv.is_window_open,
          hoursLeft: activeConv.window_hours_left ?? 0,
          minutesLeft: activeConv.window_minutes_left ?? 0,
          isExpired: !activeConv.is_window_open,
          isUrgent: (activeConv.window_hours_left ?? 0) < 2
        }
      }
    }

    // 2. Fallback heurístico en base a mensajes en memoria
    const patientMsgs = mensajes.filter((m) => m.emisor === 'paciente')
    if (patientMsgs.length === 0) {
      return { isOpen: false, hoursLeft: 0, minutesLeft: 0, isExpired: true, isUrgent: false }
    }
    const lastPatientMsg = patientMsgs[patientMsgs.length - 1]
    const lastTime = new Date(lastPatientMsg.created_at).getTime()
    const now = Date.now()
    const elapsedMs = now - lastTime
    const twentyFourHoursMs = 24 * 60 * 60 * 1000
    const remainingMs = twentyFourHoursMs - elapsedMs

    if (remainingMs <= 0) {
      return { isOpen: false, hoursLeft: 0, minutesLeft: 0, isExpired: true, isUrgent: false }
    }

    const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60))
    const minutesLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
    const isUrgent = hoursLeft < 2

    return { isOpen: true, hoursLeft, minutesLeft, isExpired: false, isUrgent }
  }

  const metaWindow = getMeta24hStatus()
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastPresenceSentRef = useRef<number>(0)

  const sendPresence = async (convId: string, presence: 'composing' | 'paused') => {
    if (!convId) return
    try {
      await fetch(`${BACKEND_URL}/api/conversaciones/${convId}/presencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presence })
      })
    } catch (e) {
      // Silenciar errores de red en presencia
    }
  }

  const handleTypingPresence = () => {
    if (isInternalNote || !selectedConvId) return

    const now = Date.now()
    if (now - lastPresenceSentRef.current > 3000) {
      lastPresenceSentRef.current = now
      sendPresence(selectedConvId, 'composing')
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (selectedConvId && !isInternalNote) {
        sendPresence(selectedConvId, 'paused')
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
  }, [selectedConvId])

  const fetchWAStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/status`)
      if (res.ok) {
        const data = await res.json()
        setWaStatus(data)
      }
    } catch (err) {}
  }

  const searchParams = useSearchParams()
  const paramPacienteId = searchParams ? searchParams.get('pacienteId') : null
  const paramTelefono = searchParams ? searchParams.get('telefono') : null

  const fetchConversaciones = async (isBackground = false) => {
    try {
      if (!isBackground && conversacionesRef.current.length === 0) {
        setCargandoConversaciones(true)
      }
      let convs: Conversacion[] = []
      
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversaciones`, { cache: 'no-store' })
        if (res.ok) {
          const apiData = await res.json()
          if (Array.isArray(apiData) && apiData.length > 0) {
            convs = apiData
          }
        }
      } catch (e) {}

      if (convs.length === 0 && conversacionesRef.current.length === 0) {
        const { data, error } = await supabase
          .from('conversaciones')
          .select(`
            id,
            paciente_id,
            bot_disabled,
            archivada,
            agente_asignado_codigo,
            ultimo_mensaje,
            updated_at,
            unread_count,
            metadata_json,
            pacientes (*)
          `)
          .order('updated_at', { ascending: false })
        
        if (!error && data) {
          convs = (data as unknown as Conversacion[]) || []
        }
      }

      if (convs.length > 0) {
        const activeId = selectedConvIdRef.current
        setConversaciones(convs.map((c) => (c.id === activeId ? { ...c, unread_count: 0 } : c)))
      }
      
      if (paramPacienteId && convs.length > 0 && !selectedConvIdRef.current) {
        const target = convs.find((c) => {
          const p = getPatient(c)
          return c.paciente_id === paramPacienteId || p?.id === paramPacienteId
        })
        if (target) {
          setSelectedConvId(target.id)
          return
        }
      }
      if (paramTelefono && convs.length > 0 && !selectedConvIdRef.current) {
        const target = convs.find((c) => {
          const p = getPatient(c)
          return p?.telefono === paramTelefono
        })
        if (target) {
          setSelectedConvId(target.id)
          return
        }
      }
    } catch (err) {
      console.error('Error cargando conversaciones:', err)
    } finally {
      setCargandoConversaciones(false)
    }
  }

  const fetchMensajes = async (convId: string) => {
    try {
      const cached = messagesCacheRef.current[convId]
      if (cached && cached.length > 0) {
        setMensajes(cached)
        setCargandoMensajes(false)
      } else {
        setCargandoMensajes(true)
      }

      let msgs: Mensaje[] = []

      try {
        const res = await fetch(`${BACKEND_URL}/api/conversaciones/${convId}/mensajes`, { cache: 'no-store' })
        if (res.ok) {
          const apiMsgs = await res.json()
          if (Array.isArray(apiMsgs)) {
            msgs = apiMsgs
          }
        }
      } catch (e) {}

      if (msgs.length === 0 && (!cached || cached.length === 0)) {
        const { data, error } = await supabase
          .from('mensajes')
          .select('*')
          .eq('conversacion_id', convId)
          .order('created_at', { ascending: true })
        
        if (!error && data) {
          msgs = (data as unknown as Mensaje[]) || []
        }
      }

      if (msgs.length > 0) {
        const uniqueMap = new Map<string, Mensaje>()
        for (const m of msgs) {
          const dedupKey = m.metadata_json?.wamid || m.metadata_json?.whatsapp_message_id ? `wa_${m.metadata_json?.wamid || m.metadata_json?.whatsapp_message_id}` : m.id
          uniqueMap.set(dedupKey, m)
        }
        const finalMsgs = Array.from(uniqueMap.values())
        messagesCacheRef.current[convId] = finalMsgs
        if (selectedConvIdRef.current === convId) {
          setMensajes(finalMsgs)
        }
      }
    } catch (err) {
      console.error('Error cargando mensajes:', err)
    } finally {
      if (selectedConvIdRef.current === convId) {
        setCargandoMensajes(false)
      }
    }
  }

  useEffect(() => {
    fetchConversaciones()
    fetchWAStatus()
    const intervalStatus = setInterval(fetchWAStatus, 30000)
    
    const intervalConvs = setInterval(() => {
      fetchConversaciones(true)
    }, 30000)

    const onFocus = () => {
      fetchConversaciones(true)
      fetchWAStatus()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(intervalStatus)
      clearInterval(intervalConvs)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Control inteligente de posición de scroll
  const handleScroll = () => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const isNear = scrollHeight - scrollTop - clientHeight < 120
    isNearBottomRef.current = isNear
    if (isNear) {
      setShowScrollBottom(false)
      setUnreadNewCount(0)
    } else {
      setShowScrollBottom(true)
    }
  }

  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      if (smooth) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      } else {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    }
    setShowScrollBottom(false)
    setUnreadNewCount(0)
    isNearBottomRef.current = true
  }

  useEffect(() => {
    if (!selectedConvId) return
    isInitialLoadRef.current = true
    setShowScrollBottom(false)
    setUnreadNewCount(0)

    // Reset optimista instantáneo del unread_count en la conversación seleccionada
    setConversaciones((prev) =>
      prev.map((c) => (c.id === selectedConvId ? { ...c, unread_count: 0 } : c))
    )

    fetchMensajes(selectedConvId)
    // Notificar a WhatsApp y marcar mensajes como leídos en Supabase y Meta
    fetch(`${BACKEND_URL}/api/conversaciones/${selectedConvId}/leer`, { method: 'POST' }).catch(() => {})

    const intervalMsgs = setInterval(() => {
      if (!selectedConvId) return
      supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', selectedConvId)
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            const uniqueMap = new Map<string, Mensaje>()
            for (const m of (data as unknown as Mensaje[])) {
              const dedupKey = m.metadata_json?.wamid || m.metadata_json?.whatsapp_message_id ? `wa_${m.metadata_json?.wamid || m.metadata_json?.whatsapp_message_id}` : m.id
              uniqueMap.set(dedupKey, m)
            }
            const newArr = Array.from(uniqueMap.values())
            messagesCacheRef.current[selectedConvId] = newArr
            setMensajes((prev) => {
              if (prev.length === newArr.length && prev.length > 0) {
                const lastPrev = prev[prev.length - 1]
                const lastNew = newArr[newArr.length - 1]
                const sameLastId = lastPrev.id === lastNew.id
                const sameDelivery = lastPrev.metadata_json?.delivery_status === lastNew.metadata_json?.delivery_status
                if (sameLastId && sameDelivery) {
                  return prev
                }
              }
              return newArr
            })
          }
        })
    }, 25000)

    return () => clearInterval(intervalMsgs)
  }, [selectedConvId])

  // Desplazamiento inteligente condicional al cambiar mensajes
  useEffect(() => {
    if (mensajes.length === 0) return

    if (isInitialLoadRef.current) {
      // 1. Carga inicial: Posicionamiento instantáneo al fondo sin animación de deslizamiento
      requestAnimationFrame(() => {
        scrollToBottom(false)
      })
      isInitialLoadRef.current = false
      prevMessagesLengthRef.current = mensajes.length
      return
    }

    // 2. Si aumentaron los mensajes (mensaje nuevo)
    if (mensajes.length > prevMessagesLengthRef.current) {
      const lastMsg = mensajes[mensajes.length - 1]
      const isMine = lastMsg?.emisor === 'operador'

      if (isNearBottomRef.current || isMine) {
        requestAnimationFrame(() => {
          scrollToBottom(true)
        })
      } else {
        // El usuario está leyendo arriba: no mover la pantalla, mostrar botón flotante con badge
        setShowScrollBottom(true)
        setUnreadNewCount((prev) => prev + (mensajes.length - prevMessagesLengthRef.current))
      }
    }
    prevMessagesLengthRef.current = mensajes.length
  }, [mensajes])

  useEffect(() => {
    const channel = supabase
      .channel('chat-inbox-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          const newMsg = payload.new as Mensaje
          const currentActive = selectedConvIdRef.current
          if (newMsg.conversacion_id === currentActive) {
            setMensajes((prev) => {
              const newKey = newMsg.metadata_json?.wamid || newMsg.metadata_json?.whatsapp_message_id ? `wa_${newMsg.metadata_json?.wamid || newMsg.metadata_json?.whatsapp_message_id}` : newMsg.id
              if (prev.some((m) => (m.metadata_json?.wamid || m.metadata_json?.whatsapp_message_id ? `wa_${m.metadata_json?.wamid || m.metadata_json?.whatsapp_message_id}` : m.id) === newKey)) {
                return prev
              }
              const updated = [...prev.filter((m) => !m.id.startsWith('temp_')), newMsg]
              if (currentActive) {
                messagesCacheRef.current[currentActive] = updated
              }
              return updated
            })
            // Si llega un mensaje nuevo mientras tenemos el chat abierto, marcarlo leído
            if (newMsg.emisor === 'paciente' && currentActive) {
              fetch(`${BACKEND_URL}/api/conversaciones/${currentActive}/leer`, { method: 'POST' }).catch(() => {})
            }
          }
          setConversaciones((prevConvs) => 
            prevConvs.map((conv) => {
              if (conv.id === newMsg.conversacion_id) {
                const isCurrentActive = conv.id === selectedConvIdRef.current
                const unreadDelta = (newMsg.emisor === 'paciente' && !isCurrentActive) ? 1 : 0
                return {
                  ...conv,
                  ultimo_mensaje: newMsg.contenido,
                  updated_at: newMsg.created_at,
                  unread_count: isCurrentActive ? 0 : (conv.unread_count || 0) + unreadDelta
                }
              }
              return conv
            }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mensajes' },
        (payload) => {
          const updatedMsg = payload.new as Mensaje
          const currentActive = selectedConvIdRef.current
          if (updatedMsg.conversacion_id === currentActive) {
            setMensajes((prev) => {
              const updated = prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
              if (currentActive) {
                messagesCacheRef.current[currentActive] = updated
              }
              return updated
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversaciones' },
        (payload) => {
          const updatedConv = payload.new as Conversacion
          setConversaciones((prevConvs) => 
            prevConvs.map((conv) => {
              if (conv.id === updatedConv.id) {
                const isCurrentActive = conv.id === selectedConvIdRef.current
                return {
                  ...conv,
                  bot_disabled: updatedConv.bot_disabled,
                  archivada: updatedConv.archivada,
                  asignado_a_usuario_id: updatedConv.asignado_a_usuario_id,
                  estado_gestion: updatedConv.estado_gestion,
                  ultimo_mensaje: updatedConv.ultimo_mensaje,
                  updated_at: updatedConv.updated_at,
                  unread_count: isCurrentActive ? 0 : (updatedConv.unread_count !== undefined ? updatedConv.unread_count : conv.unread_count)
                }
              }
              return conv
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Cargar lista de operadores activos para derivación y filtros
  useEffect(() => {
    const fetchOperadores = async () => {
      try {
        setCargandoOperadores(true)
        const res = await fetch(`${BACKEND_URL}/api/conversaciones/operadores-activos`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setOperadores(data)
          }
        }
      } catch (e) {
        console.error('Error al cargar operadores:', e)
      } finally {
        setCargandoOperadores(false)
      }
    }
    fetchOperadores()
  }, [])

  // Presencia en tiempo real para Detección de Colisiones (Supabase Realtime Presence)
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('crm-operators-presence', {
      config: { presence: { key: user.id } }
    })
    presenceChannelRef.current = channel

    const syncPresence = () => {
      const state = channel.presenceState()
      const currentActiveId = selectedConvIdRef.current
      if (!currentActiveId) {
        setActiveOperatorsInChat([])
        return
      }

      const others: Array<{ user_id: string; user_name: string; avatar_url?: string }> = []
      Object.keys(state).forEach((key) => {
        const presences = state[key] as any[]
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p.user_id !== user.id && p.conversacion_id === currentActiveId) {
              others.push({
                user_id: p.user_id,
                user_name: p.user_name || 'Colega',
                avatar_url: p.avatar_url
              })
            }
          })
        }
      })
      setActiveOperatorsInChat(others)
    }

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const userName = user.user_metadata?.nombre_completo || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operador'
          await channel.track({
            user_id: user.id,
            user_name: userName,
            conversacion_id: selectedConvIdRef.current,
            joined_at: new Date().toISOString()
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
      presenceChannelRef.current = null
    }
  }, [user])

  // Actualizar el canal de presencia cada vez que cambia la conversación seleccionada
  useEffect(() => {
    if (presenceChannelRef.current && user) {
      const userName = user.user_metadata?.nombre_completo || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operador'
      presenceChannelRef.current.track({
        user_id: user.id,
        user_name: userName,
        conversacion_id: selectedConvId,
        joined_at: new Date().toISOString()
      }).catch(() => {})
    }
  }, [selectedConvId, user])

  // Acciones Multi-Operador
  const handleTomarConversacion = async () => {
    if (!selectedConvId || !user) return
    setTomandoCaso(true)
    try {
      const userName = user.user_metadata?.nombre_completo || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Operador'
      const res = await fetch(`${BACKEND_URL}/api/conversaciones/${selectedConvId}/tomar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id,
          usuario_nombre: userName
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setConversaciones((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  asignado_a_usuario_id: user.id,
                  estado_gestion: 'EN_GESTION',
                  bot_disabled: true,
                  asignado_a: {
                    id: user.id,
                    nombre_completo: userName,
                    email: user.email || '',
                    avatar_url: null
                  }
                }
              : c
          )
        )
        fetchMensajes(selectedConvId)
      } else {
        alert(data.detail || 'No se pudo tomar la conversación.')
      }
    } catch (err) {
      console.error('Error al tomar caso:', err)
    } finally {
      setTomandoCaso(false)
    }
  }

  const handleOpenDerivarModal = () => {
    setDerivarUsuarioId('')
    setDerivarNota('')
    setShowDerivarModal(true)
  }

  const handleConfirmarDerivacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConvId || !derivarUsuarioId) {
      alert('Por favor selecciona un operador de destino.')
      return
    }
    setDerivando(true)
    try {
      const origenNombre = user?.user_metadata?.nombre_completo || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operador'
      const destinoOp = operadores.find((o) => o.id === derivarUsuarioId)
      const destinoNombre = destinoOp?.nombre_completo || destinoOp?.email || 'Colega'

      const res = await fetch(`${BACKEND_URL}/api/conversaciones/${selectedConvId}/derivar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nuevo_usuario_id: derivarUsuarioId,
          nota_traspaso: derivarNota.trim(),
          origen_nombre: origenNombre,
          destino_nombre: destinoNombre
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setShowDerivarModal(false)
        setDerivarNota('')
        setDerivarUsuarioId('')
        setConversaciones((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  asignado_a_usuario_id: derivarUsuarioId,
                  estado_gestion: 'EN_GESTION',
                  bot_disabled: true,
                  asignado_a: destinoOp
                    ? {
                        id: destinoOp.id,
                        nombre_completo: destinoOp.nombre_completo,
                        email: destinoOp.email,
                        avatar_url: destinoOp.avatar_url || null
                      }
                    : {
                        id: derivarUsuarioId,
                        nombre_completo: destinoNombre,
                        email: '',
                        avatar_url: null
                      }
                }
              : c
          )
        )
        fetchMensajes(selectedConvId)
      } else {
        alert(data.detail || 'No se pudo derivar la conversación.')
      }
    } catch (err) {
      console.error('Error al derivar caso:', err)
      alert('Error de red al derivar el caso.')
    } finally {
      setDerivando(false)
    }
  }

  const handleFinalizarConversacion = async () => {
    if (!selectedConvId) return
    const confirmar = window.confirm(
      '¿Deseas finalizar la atención de este caso?\n\nLa conversación se marcará como Resuelta y el Asistente Virtual Gemini quedará activo de forma inmediata para responder consultas futuras del paciente.'
    )
    if (!confirmar) return

    setFinalizandoCaso(true)
    try {
      const userName = user?.user_metadata?.nombre_completo || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operador'
      const res = await fetch(`${BACKEND_URL}/api/conversaciones/${selectedConvId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_nombre: userName
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setConversaciones((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  estado_gestion: 'RESUELTO',
                  archivada: true,
                  asignado_a_usuario_id: null,
                  asignado_a: null,
                  bot_disabled: false
                }
              : c
          )
        )
        fetchMensajes(selectedConvId)
      } else {
        alert(data.detail || 'No se pudo finalizar la conversación.')
      }
    } catch (err) {
      console.error('Error al finalizar caso:', err)
    } finally {
      setFinalizandoCaso(false)
    }
  }

  const selectedConv = conversaciones.find((c) => c.id === selectedConvId)

  // Handlers del Menú Contextual (WhatsApp Web + Clínico)
  const handleOpenContextMenu = (e: React.MouseEvent, msg: Mensaje) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      message: msg,
      position: { x: e.clientX, y: e.clientY }
    })
  }

  const handleReplyMessage = (msg: Mensaje) => {
    setReplyingToMessage(msg)
    setTimeout(() => {
      messageInputRef.current?.focus()
    }, 60)
  }

  const handleCancelReply = () => {
    setReplyingToMessage(null)
  }

  const handleCopyText = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const handleReactToMessage = async (msg: Mensaje, emoji: string) => {
    try {
      setMensajes((prev) =>
        prev.map((m) => {
          if (m.id === msg.id) {
            const prevReactions = m.metadata_json?.reactions || []
            const filtered = prevReactions.filter((r: any) => r.emisor !== 'operador')
            return {
              ...m,
              metadata_json: {
                ...(m.metadata_json || {}),
                reactions: [...filtered, { emisor: 'operador', emoji, created_at: new Date().toISOString() }]
              }
            }
          }
          return m
        })
      )

      await fetch(`${BACKEND_URL}/api/mensajes/${msg.id}/reaccionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      })
    } catch (err) {
      console.error('Error enviando reacción:', err)
    }
  }

  const handleSaveClinicalNote = async (msg: Mensaje) => {
    if (!selectedConv) return
    const pac = getPatient(selectedConv)
    if (!pac || !pac.id) return

    try {
      const fechaStr = new Date(msg.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
      const autor = msg.emisor === 'paciente' ? (pac.nombre || 'Paciente') : 'Operador CRM'
      const nuevaNota = `[${fechaStr} - ${autor}]: ${msg.contenido}`
      
      const notasActuales = (pac as any).historial_notas ? `${(pac as any).historial_notas}\n\n${nuevaNota}` : nuevaNota

      await fetch(`${BACKEND_URL}/api/pacientes/${pac.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historial_notas: notasActuales })
      })

      alert(`✅ Nota clínica guardada en el historial de ${pac.nombre || 'Paciente'}.`)
    } catch (err) {
      console.error('Error guardando nota clínica:', err)
      alert('No se pudo guardar la nota clínica.')
    }
  }

  const handleConvertToInternalNote = async (msg: Mensaje) => {
    if (!selectedConvId) return
    const autor = msg.emisor === 'paciente' ? 'Paciente' : 'Operador'
    const textoNota = `[REF ${autor.toUpperCase()}]: ${msg.contenido}`
    
    try {
      await supabase.from('mensajes').insert({
        conversacion_id: selectedConvId,
        emisor: 'operador',
        contenido: textoNota,
        metadata_json: { is_internal_note: true, tipo: 'nota_interna' }
      })
      fetchMensajes(selectedConvId)
    } catch (err) {
      console.error('Error creando nota interna:', err)
    }
  }

  const handleDeleteMessage = async (msg: Mensaje) => {
    if (!confirm('¿Deseas eliminar este mensaje del chat?')) return
    try {
      setMensajes((prev) => prev.filter((m) => m.id !== msg.id))
      await fetch(`${BACKEND_URL}/api/mensajes/${msg.id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Error eliminando mensaje:', err)
    }
  }

  // Handlers del Menú Contextual de Contactos/Conversaciones
  const handleOpenContactContextMenu = (e: React.MouseEvent, conv: Conversacion) => {
    e.preventDefault()
    e.stopPropagation()
    setContactContextMenu({
      conversacion: conv,
      position: { x: e.clientX, y: e.clientY }
    })
  }

  const handleToggleUnreadContact = async (conv: Conversacion) => {
    const currentlyUnread = (conv.unread_count || 0) > 0
    const newCount = currentlyUnread ? 0 : 1
    setConversaciones((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: newCount } : c))
    )
    try {
      if (currentlyUnread) {
        await fetch(`${BACKEND_URL}/api/conversaciones/${conv.id}/leer`, { method: 'POST' })
      } else {
        await fetch(`${BACKEND_URL}/api/conversaciones/${conv.id}/marcar-no-leido`, { method: 'POST' })
      }
    } catch (err) {
      console.error('Error alternando estado de no leído:', err)
    }
  }

  const handleTogglePinContact = async (conv: Conversacion) => {
    const isPinned = Boolean(conv.metadata_json?.is_pinned)
    const newPinned = !isPinned
    setConversaciones((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? { ...c, metadata_json: { ...(c.metadata_json || {}), is_pinned: newPinned } }
          : c
      )
    )
    try {
      await fetch(`${BACKEND_URL}/api/conversaciones/${conv.id}/fijar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fijada: newPinned })
      })
    } catch (err) {
      console.error('Error fijando conversación:', err)
    }
  }

  const handleToggleArchiveContact = async (conv: Conversacion) => {
    handleToggleArchivar(conv.id, conv.archivada)
  }

  const handleToggleBotContact = async (conv: Conversacion) => {
    const newDisabled = !conv.bot_disabled
    setConversaciones((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, bot_disabled: newDisabled } : c))
    )
    try {
      await fetch(`${BACKEND_URL}/api/conversaciones/${conv.id}/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_disabled: newDisabled })
      })
    } catch (err) {
      console.error('Error alternando bot:', err)
    }
  }

  const handleCopyPhoneContact = (phone: string) => {
    if (!phone) return
    navigator.clipboard.writeText(phone).catch(() => {})
  }

  const handleOpenPatientFileContact = (conv: Conversacion) => {
    const p = getPatient(conv)
    if (p) {
      setSelectedPacienteHistoriaClinica(p)
    }
  }

  const handleDeleteContact = async (conv: Conversacion) => {
    if (!confirm('¿Deseas eliminar esta conversación completa y su historial del CRM?')) return
    try {
      setConversaciones((prev) => prev.filter((c) => c.id !== conv.id))
      if (selectedConvId === conv.id) setSelectedConvId(null)
      await fetch(`${BACKEND_URL}/api/conversaciones/${conv.id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Error eliminando conversación:', err)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !selectedConvId || !selectedConv) return

    // Si la ventana de 24h está cerrada y no es nota interna, advertir y ofrecer abrir plantillas
    if (metaWindow.isExpired && !isInternalNote) {
      const abrirModal = window.confirm(
        '⚠️ La ventana de 24 horas de WhatsApp está cerrada para este paciente.\n\nMeta no permite enviar mensajes de texto libre fuera de la ventana. Debes reabrir la conversación utilizando una Plantilla Oficial de Meta.\n\n¿Deseas abrir el selector de Plantillas Meta ahora?'
      )
      if (abrirModal) {
        setShowTemplateModal(true)
      }
      return
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    if (selectedConvId && !isInternalNote) {
      sendPresence(selectedConvId, 'paused')
    }

    const mensajeAEnviar = nuevoMensaje.trim()
    const esNotaInternaActual = isInternalNote
    const currentReply = replyingToMessage
    setNuevoMensaje('')
    setReplyingToMessage(null)
    setQuickRepliesOpen(false)

    const quotedId = currentReply?.metadata_json?.whatsapp_message_id || currentReply?.id
    const quotedData = currentReply ? {
      id: currentReply.id,
      emisor: currentReply.emisor,
      contenido: currentReply.contenido,
      nombre: currentReply.emisor === 'paciente' ? (getPatient(selectedConv)?.nombre || 'Paciente') : 'Operador Humano'
    } : undefined

    const tempId = `temp_${Date.now()}`
    const metaOpt: any = esNotaInternaActual 
      ? { is_internal_note: true, tipo: 'nota_interna' } 
      : { delivery_status: 'enviado', provider: 'meta_cloud_api' }
    if (quotedData) metaOpt.quoted_message = quotedData

    const optimisticMsg: Mensaje = {
      id: tempId,
      conversacion_id: selectedConvId,
      emisor: 'operador',
      contenido: mensajeAEnviar,
      metadata_json: metaOpt,
      created_at: new Date().toISOString()
    }
    setMensajes((prev) => [...prev, optimisticMsg])

    try {
      const paciente = getPatient(selectedConv)
      const telefonoDestino = paciente?.telefono || ''
      
      let dispatchedViaBackend = false
      try {
        const response = await fetch(`${BACKEND_URL}/api/whatsapp/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefono: telefonoDestino,
            mensaje: mensajeAEnviar,
            conversacion_id: selectedConvId,
            is_internal_note: esNotaInternaActual,
            quoted_message_id: quotedId,
            quoted_message_data: quotedData
          })
        })

        if (response.ok) {
          dispatchedViaBackend = true
          // Conmutar a atención humana automática al intervenir el operador
          if (!esNotaInternaActual && selectedConv && !selectedConv.bot_disabled) {
            setConversaciones((prev) =>
              prev.map((c) => (c.id === selectedConvId ? { ...c, bot_disabled: true } : c))
            )
            fetch(`${BACKEND_URL}/api/conversaciones/${selectedConvId}/toggle-bot`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bot_disabled: true })
            }).catch(() => {})
          }
        } else {
          // Despacho falló en backend: marcar mensaje como fallido para que el operador pueda reintentar o usar plantilla
          const errData = await response.json().catch(() => ({}))
          const errMsg = errData.detail || errData.error || 'Error al despachar por WhatsApp'
          const isWindowError = errMsg.includes('Ventana de 24 horas') || errMsg.includes('WINDOW_CLOSED') || errMsg.includes('131026') || errMsg.includes('requiere_plantilla')

          setMensajes((prev) =>
            prev.map((m) =>
              m.id === optimisticMsg.id
                ? {
                    ...m,
                    metadata_json: {
                      ...(m.metadata_json || {}),
                      delivery_status: 'fallido',
                      error_message: errMsg,
                      is_window_closed_error: isWindowError
                    }
                  }
                : m
            )
          )

          if (isWindowError) {
            setShowTemplateModal(true)
          }
          return
        }
      } catch (backendErr: any) {
        console.warn('Backend WhatsApp no disponible:', backendErr)
        setMensajes((prev) =>
          prev.map((m) =>
            m.id === optimisticMsg.id
              ? {
                  ...m,
                  metadata_json: {
                    ...(m.metadata_json || {}),
                    delivery_status: 'fallido',
                    error_message: 'Servidor no disponible o error de red'
                  }
                }
              : m
          )
        )
        return
      }

      setTimeout(() => {
        fetchMensajes(selectedConvId)
      }, 500)

    } catch (err) {
      console.error('Error enviando mensaje:', err)
    }
  }

  // Subir archivo reutilizable (input file o pegado con Ctrl+V)
  const handleUploadFileDirect = async (file: File) => {
    if (!file || !selectedConvId || !selectedConv) return

    const paciente = getPatient(selectedConv)
    setSubiendoArchivo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('telefono', paciente?.telefono || '')
      formData.append('conversacion_id', selectedConvId)
      formData.append('caption', file.name || 'Captura de pantalla')

      const res = await fetch(`${BACKEND_URL}/api/whatsapp/send-media`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Error al enviar archivo')

      setTimeout(() => {
        fetchMensajes(selectedConvId)
      }, 600)
    } catch (err) {
      console.error('Error subiendo archivo:', err)
      alert('No se pudo enviar el archivo adjunto.')
    } finally {
      setSubiendoArchivo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUploadFileDirect(file)
  }

  // Pegado de imágenes con Ctrl+V directo en la caja de texto
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile()
        if (blob) {
          e.preventDefault()
          const file = new File([blob], `captura_${Date.now()}.png`, { type: blob.type })
          handleUploadFileDirect(file)
          break
        }
      }
    }
  }

  // ====================================================================
  // COPILOTO DE IA CON GOOGLE GEMINI
  // ====================================================================

  const handleCopilotSugerir = async () => {
    if (!selectedConvId || copilotLoading) return
    setCopilotLoading('sugerir')
    try {
      const paciente = getPatient(selectedConv)
      const res = await fetch(`${BACKEND_URL}/api/chat/copilot/sugerir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: selectedConvId,
          paciente_id: paciente?.id || selectedConv?.paciente_id,
          historial: mensajes.slice(-10)
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.sugerencia) {
          setNuevoMensaje(data.sugerencia)
          setTimeout(() => messageInputRef.current?.focus(), 50)
        }
      }
    } catch (err) {
      console.error('Error sugiriendo respuesta con Copilot:', err)
    } finally {
      setCopilotLoading(null)
    }
  }

  const handleCopilotMejorar = async () => {
    if (!nuevoMensaje.trim() || copilotLoading) return
    setCopilotLoading('mejorar')
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/copilot/mejorar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: nuevoMensaje })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.texto_mejorado) {
          setNuevoMensaje(data.texto_mejorado)
          setTimeout(() => messageInputRef.current?.focus(), 50)
        }
      }
    } catch (err) {
      console.error('Error mejorando texto con Copilot:', err)
    } finally {
      setCopilotLoading(null)
    }
  }

  const handleCopilotResumir = async () => {
    if (!selectedConvId || copilotLoading) return
    setCopilotLoading('resumir')
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/copilot/resumir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: selectedConvId,
          historial: mensajes.slice(-25)
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.resumen) {
          setAiSummaryText(data.resumen)
        }
      }
    } catch (err) {
      console.error('Error resumiendo chat con Copilot:', err)
    } finally {
      setCopilotLoading(null)
    }
  }

  const handleSavePaciente = async (datosActualizados: any) => {
    if (!selectedPacienteEditar?.id) return
    setGuardandoPaciente(true)
    try {
      const { error } = await supabase
        .from('pacientes')
        .update(datosActualizados)
        .eq('id', selectedPacienteEditar.id)

      if (error) throw error

      // Refrescar conversaciones
      fetchConversaciones()
      setSelectedPacienteEditar(null)
    } catch (err) {
      console.error('Error guardando paciente:', err)
      alert('No se pudo guardar la información del paciente.')
    } finally {
      setGuardandoPaciente(false)
    }
  }

  const handleToggleArchivar = async (convId: string, currentArchivada?: boolean) => {
    const nextState = !currentArchivada
    setConversaciones((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, archivada: nextState } : c))
    )
    try {
      await fetch(`${BACKEND_URL}/api/conversaciones/${convId}/archivar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivada: nextState })
      })
    } catch (e) {
      console.error('Error archivando conversación:', e)
    }
  }

  const handleSimulateIncoming = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simTexto.trim()) return

    setSimulando(true)
    try {
      await fetch(`${BACKEND_URL}/api/simulate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: simTelefono, mensaje: simTexto })
      })
      setSimTexto('')
    } catch (error) {
      console.error('Error enviando simulación:', error)
    } finally {
      setSimulando(false)
    }
  }

  // Métricas multi-operador
  const misChats = conversaciones.filter(
    (c) => !c.archivada && c.estado_gestion !== 'RESUELTO' && c.asignado_a_usuario_id === currentUserId
  )
  const misChatsCount = misChats.length
  const misChatsNoLeidos = misChats.filter((c) => (c.unread_count || 0) > 0).length

  const sinAsignar = conversaciones.filter(
    (c) =>
      !c.archivada &&
      c.estado_gestion !== 'RESUELTO' &&
      !c.asignado_a_usuario_id &&
      (c.bot_disabled || c.estado_gestion === 'SIN_ASIGNAR')
  )
  const sinAsignarCount = sinAsignar.length

  const todosCount = conversaciones.filter((c) => !c.archivada && c.estado_gestion !== 'RESUELTO').length
  const botCount = conversaciones.filter((c) => !c.bot_disabled && !c.archivada && c.estado_gestion !== 'RESUELTO').length
  const archivadosCount = conversaciones.filter((c) => Boolean(c.archivada) || c.estado_gestion === 'RESUELTO').length
  const totalNoLeidosGlobal = conversaciones.filter((c) => (c.unread_count || 0) > 0 && !c.archivada).length

  // Actualización dinámica del título del navegador
  useEffect(() => {
    if (misChatsNoLeidos > 0) {
      document.title = `(${misChatsNoLeidos}) MedCRM - Mis Chats`
    } else if (totalNoLeidosGlobal > 0) {
      document.title = `(${totalNoLeidosGlobal}) MedCRM - Chats`
    } else {
      document.title = 'MedCRM - Clínica Nube'
    }
  }, [misChatsNoLeidos, totalNoLeidosGlobal])

  const filteredConversaciones = conversaciones
    .filter((conv) => {
      const paciente = getPatient(conv)
      const nombre = (paciente?.nombre || '').toLowerCase()
      const telefono = (paciente?.telefono || '').toLowerCase()
      const dni = (paciente?.dni || '').toLowerCase()
      const ultimoMsg = (conv.ultimo_mensaje || '').toLowerCase()
      const opNombre = (conv.asignado_a?.nombre_completo || '').toLowerCase()
      const q = searchQuery.trim().toLowerCase()

      const matchesSearch = !q || nombre.includes(q) || telefono.includes(q) || dni.includes(q) || ultimoMsg.includes(q) || opNombre.includes(q)
      if (!matchesSearch) return false

      const isArchived = Boolean(conv.archivada) || conv.estado_gestion === 'RESUELTO'

      if (activeTab === 'mis_chats') {
        return !isArchived && conv.asignado_a_usuario_id === currentUserId
      }
      if (activeTab === 'sin_asignar') {
        return !isArchived && !conv.asignado_a_usuario_id && (conv.bot_disabled || conv.estado_gestion === 'SIN_ASIGNAR')
      }
      if (activeTab === 'bot') {
        return !isArchived && !conv.bot_disabled
      }
      if (activeTab === 'todos') {
        if (isArchived) return false
        if (filtroOperadorId !== 'todos') {
          if (filtroOperadorId === 'sin_asignar') {
            return !conv.asignado_a_usuario_id
          }
          return conv.asignado_a_usuario_id === filtroOperadorId
        }
        return true
      }
      if (activeTab === 'archivados') {
        return isArchived
      }
      return !isArchived
    })
    .sort((a, b) => {
      const aPinned = Boolean(a.metadata_json?.is_pinned)
      const bPinned = Boolean(b.metadata_json?.is_pinned)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  const isWaConnected = waStatus?.is_logged_in || waStatus?.status === 'CONNECTED'
  const currentPaciente = getPatient(selectedConv)

  return (
    <div className="flex flex-1 h-full min-h-0 border border-slate-800 rounded-2xl overflow-hidden bg-[#0a101d] shadow-2xl w-full text-slate-100 min-w-0">
      
      {/* 1. Panel de Conversaciones (Izquierda) */}
      <div className="w-80 md:w-88 border-r border-slate-800 flex flex-col bg-[#0d1527] min-w-[280px] max-w-[360px] min-h-0 shrink-0">
        
        {/* Cabecera de Chats y Estado de WhatsApp */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-[#101b33]">
          <div className="flex items-center gap-2">
            <h2 className="font-bold flex items-center gap-1.5 text-sm text-slate-100">
              <MessageCircle size={17} className="text-blue-400 shrink-0" />
              Inbox Pacientes
            </h2>
            <Link 
              href="/ajustes" 
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all border ${
                isWaConnected 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60' 
                  : 'bg-amber-950/80 text-amber-300 border-amber-800/60 hover:bg-amber-900/60'
              }`}
              title="Click para ir a Ajustes de WhatsApp"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isWaConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
              <span>{isWaConnected ? 'WhatsApp Online' : 'Vincular QR'}</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowSimulator(!showSimulator)}
              className={`p-1.5 rounded-lg text-xs transition-colors border ${
                showSimulator 
                  ? 'bg-blue-900/60 text-blue-300 border-blue-700/60' 
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/60'
              }`}
              title="Abrir Simulador de pruebas"
            >
              <Smartphone size={15} />
            </button>
            <button 
              onClick={() => fetchConversaciones(false)}
              className="p-1.5 hover:bg-slate-800/60 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              title="Refrescar chats"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Barra de Búsqueda Rápida en Vivo (Tema Oscuro) */}
        <div className="p-2.5 border-b border-slate-800 bg-[#0d1527]">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar paciente, teléfono o texto..."
              className="w-full pl-8 pr-7 py-2 text-xs border border-slate-700/80 rounded-xl bg-[#14203d] text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-inner"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-200 p-0.5"
                title="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Pestañas de Estado con Contadores Dinámicos Multi-Operador */}
        <div className="p-1.5 grid grid-cols-5 gap-1 border-b border-slate-800 bg-[#0a101d] text-[10px] font-semibold">
          
          {/* 1. MIS CHATS */}
          <button
            onClick={() => setActiveTab('mis_chats')}
            className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'mis_chats'
                ? 'bg-[#0f2e22] text-emerald-300 border-emerald-500/60 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
            title="Conversaciones asignadas a mi usuario"
          >
            <span className="truncate flex items-center gap-0.5">
              <UserCheck size={11} className="shrink-0" />
              <span>Míos</span>
            </span>
            <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold border ${
              misChatsNoLeidos > 0 
                ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/60 animate-pulse font-extrabold' 
                : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
            }`}>
              {misChatsNoLeidos > 0 ? `${misChatsCount} (${misChatsNoLeidos})` : misChatsCount}
            </span>
          </button>

          {/* 2. SIN ASIGNAR */}
          <button
            onClick={() => setActiveTab('sin_asignar')}
            className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'sin_asignar'
                ? 'bg-[#2a1b12] text-amber-300 border-amber-500/60 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
            title="Pacientes en espera de atención humana"
          >
            <span className="truncate flex items-center gap-0.5">
              <UserPlus size={11} className="shrink-0 text-amber-400" />
              <span>Espera</span>
            </span>
            <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold border ${
              sinAsignarCount > 0 
                ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 animate-pulse' 
                : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
            }`}>
              {sinAsignarCount}
            </span>
          </button>

          {/* 3. TODOS */}
          <button
            onClick={() => setActiveTab('todos')}
            className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'todos'
                ? 'bg-[#162547] text-blue-300 border-blue-500/50 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
            title="Todas las conversaciones activas del equipo"
          >
            <span className="truncate flex items-center gap-0.5">
              <Users size={11} className="shrink-0" />
              <span>Todos</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold bg-slate-800 text-slate-300 border border-slate-700/60">
              {todosCount}
            </span>
          </button>

          {/* 4. BOT GEMINI */}
          <button
            onClick={() => setActiveTab('bot')}
            className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'bot'
                ? 'bg-[#122822] text-teal-300 border-teal-500/50 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
            title="Conversaciones atendidas de forma autónoma por Gemini"
          >
            <span className="truncate flex items-center gap-0.5">
              <Bot size={11} className="shrink-0" />
              <span>Bot IA</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold bg-slate-800 text-slate-300 border border-slate-700/50">
              {botCount}
            </span>
          </button>

          {/* 5. RESUELTOS */}
          <button
            onClick={() => setActiveTab('archivados')}
            className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'archivados'
                ? 'bg-[#1e293b] text-slate-200 border-slate-600 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
            title="Conversaciones resueltas o archivadas"
          >
            <span className="truncate flex items-center gap-0.5">
              <CheckCircle2 size={11} className="shrink-0" />
              <span>Cerrados</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold bg-slate-800 text-slate-400 border border-slate-700/60">
              {archivadosCount}
            </span>
          </button>
        </div>

        {/* Sub-barra de filtro por Asesor cuando la pestaña 'Todos' está activa */}
        {activeTab === 'todos' && operadores.length > 0 && (
          <div className="px-3 py-1.5 bg-[#0b1324] border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-[10.5px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
              <Users size={12} className="text-blue-400" />
              <span>Filtrar:</span>
            </span>
            <select
              value={filtroOperadorId}
              onChange={(e) => setFiltroOperadorId(e.target.value)}
              className="w-full text-[11px] py-1 px-2 bg-[#142038] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="todos">Todos los asesores</option>
              <option value="sin_asignar">Sin Asignar (En espera)</option>
              {operadores.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nombre_completo}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Simulador colapsable para testing */}
        {showSimulator && (
          <div className="p-3 bg-[#111a30] border-b border-slate-800 transition-all">
            <form onSubmit={handleSimulateIncoming} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Smartphone size={12} /> Simulador Paciente
                </span>
                <Link href="/ajustes" className="hover:underline flex items-center gap-1 text-[10px]">
                  <Settings size={10} /> QR Real
                </Link>
              </div>
              <input 
                type="text"
                value={simTelefono}
                onChange={(e) => setSimTelefono(e.target.value)}
                placeholder="Teléfono (ej: 5491123456789)"
                className="px-2.5 py-1.5 text-xs border border-slate-700 rounded-lg bg-[#182442] text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-1.5">
                <input 
                  type="text"
                  value={simTexto}
                  onChange={(e) => setSimTexto(e.target.value)}
                  placeholder="Mensaje del paciente..."
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-700 rounded-lg bg-[#182442] text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button 
                  type="submit" 
                  disabled={simulando}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all flex items-center justify-center min-w-[55px]"
                >
                  {simulando ? '...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Listado de Tarjetas de Conversación Filtradas (Tema Oscuro) */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {cargandoConversaciones ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Loader2 size={20} className="animate-spin text-blue-400" />
              <span>Cargando conversaciones...</span>
            </div>
          ) : filteredConversaciones.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2.5">
              <div className="p-3 bg-[#14203d] border border-slate-700/60 rounded-full text-slate-400 shadow-inner">
                <MessageCircle size={22} />
              </div>
              <span className="font-semibold text-slate-200 text-sm">
                {searchQuery ? 'No hay resultados para tu búsqueda' : 'No hay conversaciones en esta pestaña'}
              </span>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                {searchQuery ? 'Prueba buscando con otro término o número de teléfono' : 'Los nuevos mensajes de WhatsApp aparecerán aquí en vivo'}
              </p>
            </div>
          ) : (
            filteredConversaciones.map((conv) => {
              const active = conv.id === selectedConvId
              const paciente = getPatient(conv)
              const initials = getInitials(paciente?.nombre)
              const formattedTime = formatTimestamp(conv.updated_at)
              const snippet = formatMessageSnippet(conv.ultimo_mensaje)
              const isDerivado = Boolean(conv.bot_disabled)
              const isArchivada = Boolean(conv.archivada)
              const isPinned = Boolean(conv.metadata_json?.is_pinned)
              const unread = conv.unread_count || 0
              const hasUnread = unread > 0
              
              return (
                <div
                  key={conv.id}
                  onContextMenu={(e) => handleOpenContactContextMenu(e, conv)}
                  onClick={() => {
                    setConversaciones((prev) =>
                      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
                    )
                    setSelectedConvId(conv.id)
                  }}
                  className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 relative border-l-4 group ${
                    active 
                      ? 'bg-[#162547] border-l-blue-500 shadow-xs' 
                      : hasUnread
                      ? 'bg-[#0f1d38]/80 hover:bg-[#142345] border-l-emerald-500 shadow-inner'
                      : isPinned
                      ? 'bg-[#11192e]/60 hover:bg-[#152038] border-l-blue-400/60'
                      : 'bg-transparent hover:bg-[#111c33] border-l-transparent'
                  }`}
                >
                  {/* Avatar con Iniciales y Estado */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border ${
                      isDerivado 
                        ? 'bg-rose-950 text-rose-300 border-rose-700/60' 
                        : 'bg-blue-950 text-blue-300 border-blue-700/60'
                    }`}>
                      {initials}
                    </div>
                    {/* Dot de Atención */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d1527] ${
                      isArchivada
                        ? 'bg-slate-500'
                        : isDerivado
                        ? 'bg-rose-500 ring-2 ring-rose-900 animate-pulse'
                        : hasUnread
                        ? 'bg-emerald-400 ring-2 ring-emerald-900 animate-pulse'
                        : 'bg-emerald-500'
                    }`} />
                  </div>

                  {/* Datos del Paciente y Preview de Mensaje */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${
                        active 
                          ? 'font-bold text-blue-200' 
                          : hasUnread 
                          ? 'font-extrabold text-white' 
                          : 'font-semibold text-slate-100'
                      }`}>
                        {paciente?.nombre || `Paciente (${paciente?.telefono ? paciente.telefono.slice(-4) : '...' })`}
                      </p>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {isPinned && (
                          <span title="Conversación fijada">
                            <Pin size={11} className="text-blue-400 shrink-0" />
                          </span>
                        )}
                        <span className={`text-[10px] font-medium ${hasUnread ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          {formattedTime}
                        </span>
                      </div>
                    </div>

                    {/* Fila de Teléfono e Insignia */}
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[10.5px] text-slate-400 truncate">
                        {paciente?.telefono ? formatPhoneDisplay(paciente.telefono) : 'Sin teléfono'}
                      </span>

                      {/* Badges de Triage y Operador */}
                      <div className="flex items-center gap-1 shrink-0">
                        {conv.asignado_a ? (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 flex items-center gap-1 max-w-[95px] truncate" title={`Asignado a: ${conv.asignado_a.nombre_completo}`}>
                            <UserCheck size={9} className="shrink-0 text-indigo-400" />
                            <span className="truncate">{conv.asignado_a.nombre_completo.split(' ')[0]}</span>
                          </span>
                        ) : (isDerivado || conv.estado_gestion === 'SIN_ASIGNAR') && !isArchivada ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 flex items-center gap-0.5" title="En espera de asignación">
                            <UserPlus size={9} className="shrink-0 text-amber-400" /> Espera
                          </span>
                        ) : null}

                        {isArchivada ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                            Resuelto
                          </span>
                        ) : isDerivado ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 flex items-center gap-0.5">
                            <User size={9} /> Humano
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 flex items-center gap-0.5">
                            <Bot size={9} /> Gemini
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Último Mensaje Snippet con Badge de No Leídos y Botón Hover Desplegable */}
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <p className={`text-[11px] truncate leading-tight flex-1 ${hasUnread ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                        {snippet}
                      </p>

                      <div className="flex items-center gap-1 shrink-0">
                        {hasUnread && (
                          <span className="bg-emerald-500 text-white font-bold text-[9.5px] px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-xs animate-pulse">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}

                        {/* Botón flotante Hover para Menú de Conversación */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenContactContextMenu(e, conv)}
                          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 cursor-pointer"
                          title="Opciones de la conversación"
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 2. Área Central y Lateral del Chat Activo (Derecha) */}
      {selectedConv ? (
        <div className="flex-1 flex min-w-0 min-h-0">
          
          {/* Panel Principal del Chat (Mensajes + Entrada) */}
          <div className="flex-1 flex flex-col bg-[#090e1a] min-w-0 min-h-0">
            
            {/* Header del Chat Activo */}
            <div className="p-3 border-b border-slate-800 bg-[#101b33] flex items-center justify-between gap-3 shadow-xs shrink-0">
              
              {/* Info del Paciente */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-950 text-blue-300 border border-blue-700/60 font-bold flex items-center justify-center text-sm shrink-0 shadow-sm">
                  {getInitials(currentPaciente?.nombre)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm truncate text-slate-100">
                      {currentPaciente?.nombre || 'Paciente'}
                    </h3>
                    {currentPaciente?.id && (
                      <button
                        onClick={() => setSelectedPacienteHistoriaClinica(currentPaciente)}
                        className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 hover:underline"
                        title="Ver Historia Clínica"
                      >
                        <span>HC</span> <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Phone size={11} /> {currentPaciente?.telefono ? formatPhoneDisplay(currentPaciente.telefono) : 'Sin teléfono'}
                    </p>
                    {/* Badge Ventana de 24 Horas de Meta */}
                    {metaWindow.isExpired ? (
                      <button
                        type="button"
                        onClick={() => setShowTemplateModal(true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/80 hover:bg-rose-900 transition-all cursor-pointer shadow-xs"
                        title="La ventana de 24h cerró. Haz clic para enviar una plantilla homologada de Meta."
                      >
                        <AlertCircle size={10} className="text-rose-400 shrink-0" />
                        <span>Ventana 24h cerrada • Reabrir</span>
                      </button>
                    ) : metaWindow.isUrgent ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800/70"
                        title="Menos de 2 horas restantes para el cierre de la ventana."
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>24h: {metaWindow.hoursLeft}h {metaWindow.minutesLeft}m restantes</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/70"
                        title="Ventana de 24 horas de Meta abierta. Puedes enviar texto libre y multimedia."
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>24h activa ({metaWindow.hoursLeft}h {metaWindow.minutesLeft}m)</span>
                      </span>
                    )}

                    {/* Badge de Operador Asignado */}
                    {selectedConv.asignado_a ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60" title={`Asignado a: ${selectedConv.asignado_a.email}`}>
                        <UserCheck size={10} className="text-indigo-400" />
                        <span>Asignado: {selectedConv.asignado_a.nombre_completo}</span>
                      </span>
                    ) : !selectedConv.archivada ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                        <UserPlus size={10} className="text-amber-400" />
                        <span>Sin Asignar</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Acciones Rápidas de la Cabecera */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                
                {/* Botón Tomar Conversación */}
                {(!selectedConv.asignado_a_usuario_id || selectedConv.asignado_a_usuario_id !== currentUserId) && !selectedConv.archivada && (
                  <button
                    type="button"
                    onClick={handleTomarConversacion}
                    disabled={tomandoCaso}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-600/30 disabled:opacity-50"
                    title="Asignarme este paciente para atenderlo de forma exclusiva"
                  >
                    <UserCheck size={13} />
                    <span className="hidden sm:inline">{tomandoCaso ? 'Tomando...' : 'Tomar Caso'}</span>
                  </button>
                )}

                {/* Botón Derivar Conversación */}
                {!selectedConv.archivada && (
                  <button
                    type="button"
                    onClick={handleOpenDerivarModal}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/60 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                    title="Transferir este paciente a otro asesor o colega con nota interna"
                  >
                    <Share2 size={13} className="text-indigo-400" />
                    <span className="hidden sm:inline">Derivar</span>
                  </button>
                )}

                {/* Botón Finalizar Atención o Reabrir */}
                {!selectedConv.archivada ? (
                  <button
                    type="button"
                    onClick={handleFinalizarConversacion}
                    disabled={finalizandoCaso}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-800/70 hover:bg-emerald-900/60 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                    title="Finalizar atención: archiva el caso y reactiva de inmediato al asistente virtual Gemini"
                  >
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span className="hidden md:inline">{finalizandoCaso ? 'Finalizando...' : 'Finalizar'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleArchivar(selectedConv.id, true)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title="Reabrir conversación"
                  >
                    <ArchiveRestore size={13} className="text-slate-400" />
                    <span className="hidden md:inline">Reabrir</span>
                  </button>
                )}

                {/* Botón Resumir Chat con IA */}
                <button
                  onClick={handleCopilotResumir}
                  disabled={copilotLoading === 'resumir'}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-700/50 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                  title="Generar resumen ejecutivo de la conversación con Gemini IA"
                >
                  {copilotLoading === 'resumir' ? (
                    <Loader2 size={13} className="animate-spin text-purple-300" />
                  ) : (
                    <Sparkles size={13} className="text-purple-300" />
                  )}
                  <span className="hidden sm:inline">Resumir Chat</span>
                </button>

                {/* Switch de Atención Humano / Bot */}
                <ToggleHuman
                  conversacionId={selectedConv.id}
                  botDisabled={selectedConv.bot_disabled}
                  onToggle={(disabled) => {
                    setConversaciones((prev) =>
                      prev.map((c) => (c.id === selectedConv.id ? { ...c, bot_disabled: disabled } : c))
                    )
                  }}
                />

                {/* Toggle de Sidebar 360 */}
                <button
                  onClick={() => setShowPatientSidebar(!showPatientSidebar)}
                  className={`p-1.5 rounded-xl text-xs transition-colors border ${
                    showPatientSidebar
                      ? 'bg-blue-900/60 text-blue-300 border-blue-600/60'
                      : 'text-slate-400 hover:text-slate-200 border-slate-700/60 hover:bg-slate-800/60'
                  }`}
                  title={showPatientSidebar ? "Ocultar Ficha 360°" : "Mostrar Ficha 360°"}
                >
                  <ShieldCheck size={16} />
                </button>
              </div>
            </div>

            {/* Historial de Mensajes con Contenedor Relativo y Botón Flotante */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-[#090e1a] panel-scroll"
              >
                {cargandoMensajes ? (
                  <div className="text-center text-xs text-slate-400 py-8 flex flex-col items-center gap-2">
                    <Loader2 size={20} className="animate-spin text-blue-400" />
                    <span>Cargando historial de mensajes...</span>
                  </div>
                ) : mensajes.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-12 flex flex-col items-center justify-center gap-2.5">
                    <div className="p-3 bg-[#131d35] border border-slate-700/60 rounded-full">
                      <MessageCircle size={24} className="text-slate-400" />
                    </div>
                    <span className="font-semibold text-slate-200 text-sm">No hay mensajes en esta conversación</span>
                    <p className="text-[11px] text-slate-400">Escribe un mensaje abajo para iniciar el chat con el paciente</p>
                  </div>
                ) : (
                  mensajes.map((msg) => {
                    const isOperator = msg.emisor === 'operador'
                    const isBot = msg.emisor === 'bot'
                    const isSystem = msg.metadata_json?.sistema === true
                    const isInternal = Boolean(msg.metadata_json?.is_internal_note || msg.metadata_json?.tipo === 'nota_interna')
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <div className="bg-amber-950/40 text-amber-300 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-800/50 shadow-xs">
                            {msg.contenido}
                          </div>
                        </div>
                      )
                    }

                    // 1. NOTA INTERNA PRIVADA (ÁMBAR / DORADO / ALERTA DERIVACIÓN)
                    if (isInternal) {
                      const isDerivacion = msg.metadata_json?.evento === 'escalado_humano' || msg.contenido?.includes('DERIVACIÓN A ATENCIÓN HUMANA')
                      const urgencia = (msg.metadata_json?.urgencia || 'ALTA').toUpperCase()

                      return (
                        <div 
                          key={msg.id} 
                          onContextMenu={(e) => handleOpenContextMenu(e, msg)}
                          className="flex justify-center my-2.5 group relative px-2"
                        >
                          <div className={`max-w-md w-full rounded-2xl p-3.5 shadow-md text-xs relative ${
                            isDerivacion 
                              ? 'bg-[#2a1306] border-2 border-rose-500/80 text-rose-100 ring-2 ring-rose-500/20' 
                              : 'bg-[#241a06] border border-amber-500/60 text-amber-200'
                          }`}>
                            {/* Botón flotante Hover para menú */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenContextMenu(e, msg)}
                              className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/90 text-amber-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md cursor-pointer z-10"
                              title="Menú de nota interna"
                            >
                              <ChevronDown size={14} />
                            </button>

                            <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold mb-1.5 pb-1 border-b border-amber-800/40 pr-6">
                              <span className={`flex items-center gap-1.5 ${isDerivacion ? 'text-rose-400 font-black' : 'text-amber-400'}`}>
                                <Lock size={12} className={isDerivacion ? 'text-rose-400' : 'text-amber-400'} />
                                {isDerivacion ? `🚨 DERIVACIÓN A ATENCIÓN HUMANA (${urgencia})` : '🔒 NOTA INTERNA (Privado del Equipo Médico)'}
                              </span>
                              <span className="text-[9px] opacity-75 font-mono">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <WhatsAppFormattedText text={msg.contenido} className={`leading-relaxed ${isDerivacion ? 'text-rose-100 font-medium' : 'text-amber-100'}`} />
                          </div>
                        </div>
                      )
                    }

                    // 2. MENSAJE NORMAL DE WHATSAPP O STICKER
                    const isSticker = msg.metadata_json?.tipo === 'sticker'
                    const isButton = msg.metadata_json?.tipo === 'button' || msg.contenido?.startsWith('🔘') || msg.contenido === '[BUTTON] Mensaje recibido'
                    const isTemplate = msg.metadata_json?.tipo === 'template' || Boolean(msg.metadata_json?.template_name) || Boolean(msg.contenido?.includes('[PLANTILLA OFICIAL'))
                    const isFailed = msg.metadata_json?.delivery_status === 'fallido' || 
                                     msg.metadata_json?.delivery_status === 'failed' || 
                                     Boolean(msg.metadata_json?.error_message)
                    const isWindowClosedError = Boolean(msg.metadata_json?.is_window_closed_error)

                    const hasText = Boolean(
                      msg.contenido && (
                        isButton ||
                        isTemplate ||
                        !msg.metadata_json?.tipo ||
                        (!msg.contenido.startsWith('[') && !msg.contenido.endsWith(']'))
                      )
                    )
                    const hasMedia = Boolean(
                      msg.metadata_json?.tipo &&
                      msg.metadata_json?.tipo !== 'texto' &&
                      msg.metadata_json?.tipo !== 'button' &&
                      msg.metadata_json?.tipo !== 'template'
                    )

                    return (
                      <div
                        key={msg.id}
                        onContextMenu={(e) => handleOpenContextMenu(e, msg)}
                        className={`flex ${isOperator ? 'justify-end' : 'justify-start'} group relative`}
                      >
                        {isSticker ? (
                          <div className="relative group p-1 max-w-[140px]">
                            {/* Botón flotante Hover para Menú Contextual */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenContextMenu(e, msg)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md cursor-pointer z-10"
                              title="Opciones del sticker"
                            >
                              <ChevronDown size={14} />
                            </button>

                            <div className="relative inline-block">
                              <ChatMediaViewer 
                                metadata={msg.metadata_json} 
                                isOperator={isOperator} 
                                mensajeId={msg.id}
                              />

                              {/* Micro-badge translúcido en la esquina inferior del sticker */}
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[9.5px] flex items-center gap-1 shadow-sm select-none">
                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {isOperator || isBot ? (
                                  <DeliveryStatusIcon status={msg.metadata_json?.delivery_status || 'enviado'} />
                                ) : (
                                  <DeliveryStatusIcon 
                                    status={msg.metadata_json?.leido_por_operador ? 'leido' : 'entregado'} 
                                    isPatientMessage={true} 
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`max-w-[80%] sm:max-w-[70%] rounded-xl px-3 py-1.5 shadow-sm text-[13px] leading-snug relative ${
                              isFailed
                                ? 'bg-rose-950/90 border-2 border-rose-500 text-rose-100 rounded-tr-none shadow-rose-950/50 ring-1 ring-rose-500/40'
                                : isOperator
                                ? isTemplate
                                  ? 'bg-[#182642] border border-blue-400/30 text-white rounded-tr-none shadow-blue-950/40'
                                  : 'bg-blue-600 text-white rounded-tr-none shadow-blue-900/20'
                                : isBot
                                ? 'bg-[#0c221e] text-emerald-100 border border-emerald-800/60 rounded-tl-none'
                                : 'bg-[#131d35] border border-slate-700/60 text-slate-100 rounded-tl-none'
                            }`}
                          >
                            {/* Botón flotante Hover para Menú Contextual (Estilo WhatsApp Web) */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenContextMenu(e, msg)}
                              className="absolute top-1 right-1.5 p-0.5 rounded-full bg-black/40 hover:bg-black/70 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md cursor-pointer z-10"
                              title="Opciones del mensaje"
                            >
                              <ChevronDown size={13} />
                            </button>

                            {/* Renderizado de Mensaje Citado (Reply preview dentro de la burbuja) */}
                            {msg.metadata_json?.quoted_message && (
                              <div className="mb-1.5 p-1.5 rounded-lg bg-black/30 border-l-4 border-blue-400 text-[11px] select-none flex flex-col gap-0.5">
                                <span className="font-bold text-blue-300 text-[9.5px]">
                                  {msg.metadata_json.quoted_message.nombre || (msg.metadata_json.quoted_message.emisor === 'paciente' ? (currentPaciente?.nombre || 'Paciente') : 'Operador Humano')}
                                </span>
                                <span className="text-slate-200 line-clamp-2 italic opacity-90">
                                  {msg.metadata_json.quoted_message.contenido}
                                </span>
                              </div>
                            )}

                            {/* Badge del emisor: Nombre del paciente registrado o Tú (Operador) / Bot */}
                            <div className="flex items-center gap-1 text-[11px] font-bold mb-0.5 tracking-tight pr-5">
                              {isOperator ? (
                                <span className="text-blue-200">Tú (Operador)</span>
                              ) : isBot ? (
                                <span className="text-teal-400 flex items-center gap-1 font-semibold">
                                  <Bot size={11} /> Bot Gemini
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold">
                                  {currentPaciente?.nombre || 'Paciente'}
                                </span>
                              )}
                            </div>
                            
                            {/* Visualizador Multimedia (si tiene imagen, video, documento, audio) */}
                            {hasMedia && (
                              <div className="relative mb-1">
                                <ChatMediaViewer 
                                  metadata={msg.metadata_json} 
                                  isOperator={isOperator} 
                                  mensajeId={msg.id}
                                  onTranscribeSuccess={(mId, transcript) => {
                                    setMensajes((prev) =>
                                      prev.map((m) =>
                                        m.id === mId
                                          ? { ...m, metadata_json: { ...(m.metadata_json || {}), transcripcion: transcript } }
                                          : m
                                      )
                                    )
                                  }}
                                />
                                {/* Si es media puro sin texto adicional, colocar badge flotante sobre la media */}
                                {!hasText && (
                                  <div className="absolute bottom-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[9.5px] flex items-center gap-1 shadow-sm select-none">
                                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isOperator || isBot ? (
                                      <DeliveryStatusIcon status={msg.metadata_json?.delivery_status || 'enviado'} />
                                    ) : (
                                      <DeliveryStatusIcon 
                                        status={msg.metadata_json?.leido_por_operador ? 'leido' : 'entregado'} 
                                        isPatientMessage={true} 
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Contenido textual con Hora y Tildes en el MISMO renglón (WhatsApp Web Nativo) */}
                            {hasText && (
                              <div className="text-[13px] leading-snug break-words">
                                {isButton ? (
                                  <div className="inline-flex items-center gap-1.5 py-1 px-2.5 my-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium text-xs shadow-xs select-none">
                                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300">Botón Clickeado</span>
                                    <span>{msg.contenido === '[BUTTON] Mensaje recibido' ? 'Recibir Presupuesto PDF' : msg.contenido.replace(/^🔘\s*/, '')}</span>
                                  </div>
                                ) : isTemplate ? (
                                  <div className="space-y-1.5 pt-0.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded w-fit select-none">
                                      <FileText size={11} className="text-amber-400" />
                                      <span>PLANTILLA OFICIAL META</span>
                                    </div>
                                    <WhatsAppFormattedText text={msg.contenido} className="block whitespace-pre-wrap leading-relaxed" />
                                  </div>
                                ) : (
                                  <WhatsAppFormattedText text={msg.contenido} className="inline" />
                                )}
                                <span className="inline-flex items-center gap-1 float-right ml-2.5 mt-0.5 select-none align-bottom text-[10px] opacity-85 leading-none">
                                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {isOperator || isBot ? (
                                    <DeliveryStatusIcon status={msg.metadata_json?.delivery_status || 'enviado'} />
                                  ) : (
                                    <DeliveryStatusIcon 
                                      status={msg.metadata_json?.leido_por_operador ? 'leido' : 'entregado'} 
                                      isPatientMessage={true} 
                                    />
                                  )}
                                </span>
                              </div>
                            )}

                            {/* Alerta interactiva ante fallo de entrega en WhatsApp */}
                            {isFailed && (
                              <div className="mt-2 pt-2 border-t border-rose-800/70 flex flex-col gap-1.5 text-xs select-none">
                                <div className="flex items-center gap-1.5 text-rose-300 font-bold text-[11px]">
                                  <AlertCircle size={13} className="text-rose-400 shrink-0" />
                                  <span>No entregado: {msg.metadata_json?.error_message || 'Error de entrega en Meta'}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {isWindowClosedError ? (
                                    <button
                                      type="button"
                                      onClick={() => setShowTemplateModal(true)}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10.5px] font-black rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                                    >
                                      <FileText size={12} />
                                      <span>Enviar Plantilla Oficial de Meta</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNuevoMensaje(msg.contenido)
                                        setMensajes((prev) => prev.filter((m) => m.id !== msg.id))
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10.5px] font-bold rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                                    >
                                      <RefreshCw size={11} />
                                      <span>Reintentar</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setMensajes((prev) => prev.filter((m) => m.id !== msg.id))}
                                    className="px-2 py-0.5 text-slate-400 hover:text-white text-[10.5px] transition cursor-pointer"
                                  >
                                    Descartar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Botón flotante para scroll al fondo (Estilo WhatsApp Web) */}
              {showScrollBottom && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="absolute bottom-4 right-4 z-20 bg-[#162340] hover:bg-[#20325b] text-white border border-blue-500/50 shadow-2xl rounded-full p-2.5 flex items-center gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95 group cursor-pointer"
                  title="Ir al último mensaje"
                >
                  <ChevronDown size={18} className="text-blue-300 group-hover:text-white transition-colors" />
                  {unreadNewCount > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-xs animate-pulse">
                      {unreadNewCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Banner de Advertencia de Colisión entre Operadores (Supabase Realtime Presence) */}
            {activeOperatorsInChat.length > 0 && (
              <div className="px-4 py-2 bg-amber-500/15 border-t border-b border-amber-500/40 flex items-center justify-between text-xs text-amber-300 animate-fadeIn shrink-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="font-semibold">
                    Atención en simultáneo: {activeOperatorsInChat.map(o => o.user_name).join(', ')} {activeOperatorsInChat.length === 1 ? 'está visualizando' : 'están visualizando'} esta conversación.
                  </span>
                </div>
                <span className="text-[10px] text-amber-400/80 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">
                  Prevención de colisión
                </span>
              </div>
            )}

            {/* Caja de Entrada de Mensajes y Barra de Copiloto IA (Tema Oscuro) */}
            <div className="p-3 border-t border-slate-800 bg-[#101b33] flex flex-col gap-2 shrink-0">
              
              {/* Barra Superior: Selector de Modo (WhatsApp vs Nota Interna) + Copiloto IA */}
              <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                
                {/* Selector de Modo */}
                <div className="flex items-center bg-[#0d1527] p-0.5 rounded-xl border border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(false)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10.5px] flex items-center gap-1 transition-all ${
                      !isInternalNote
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MessageCircle size={11} />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(true)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10.5px] flex items-center gap-1 transition-all ${
                      isInternalNote
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    <Lock size={11} />
                    <span>Nota Interna</span>
                  </button>
                </div>

                {/* Acciones de Copiloto IA Gemini */}
                <div className="flex items-center gap-1">
                  {/* 1. Sugerir Respuesta */}
                  <button
                    type="button"
                    onClick={handleCopilotSugerir}
                    disabled={Boolean(copilotLoading)}
                    className="px-2 py-1 bg-[#162345] hover:bg-[#1f315e] border border-blue-500/40 text-blue-300 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                    title="Pedirle a Gemini que redacte una sugerencia de respuesta para este paciente"
                  >
                    {copilotLoading === 'sugerir' ? <Loader2 size={11} className="animate-spin text-blue-400" /> : <Sparkles size={11} className="text-amber-400" />}
                    <span>Sugerir (IA)</span>
                  </button>

                  {/* 2. Mejorar Redacción */}
                  {nuevoMensaje.trim() && (
                    <button
                      type="button"
                      onClick={handleCopilotMejorar}
                      disabled={Boolean(copilotLoading)}
                      className="px-2 py-1 bg-[#162345] hover:bg-[#1f315e] border border-emerald-500/40 text-emerald-300 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all disabled:opacity-50 animate-in fade-in duration-150"
                      title="Mejorar ortografía, tono y formato del borrador actual"
                    >
                      {copilotLoading === 'mejorar' ? <Loader2 size={11} className="animate-spin text-emerald-400" /> : <Wand2 size={11} className="text-emerald-400" />}
                      <span>Mejorar</span>
                    </button>
                  )}

                  {/* 3. Botón Respuestas Rápidas (Atajos locales $0 costo dentro de 24h) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (metaWindow.isExpired && !isInternalNote) {
                        alert('⚠️ La ventana de 24 horas está cerrada. Las respuestas rápidas son texto libre que Meta rechazará. Utiliza el botón "Plantillas Meta" para reabrir la conversación.')
                        return
                      }
                      setQuickRepliesOpen(!quickRepliesOpen)
                    }}
                    disabled={metaWindow.isExpired && !isInternalNote}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all border ${
                      metaWindow.isExpired && !isInternalNote
                        ? 'opacity-40 cursor-not-allowed bg-[#101726] text-slate-500 border-slate-800'
                        : quickRepliesOpen 
                        ? 'bg-amber-600/30 text-amber-300 border-amber-500/60' 
                        : 'bg-[#162345] hover:bg-[#1f315e] text-slate-300 border-slate-700/60'
                    }`}
                    title={
                      metaWindow.isExpired && !isInternalNote
                        ? "Respuestas rápidas deshabilitadas: La ventana de 24h de Meta está cerrada"
                        : "Respuestas rápidas locales ($0 costo, o escribe / en el chat)"
                    }
                  >
                    <Zap size={11} className={metaWindow.isExpired && !isInternalNote ? "text-slate-500" : "text-amber-400"} />
                    <span>Respuestas Rápidas (/)</span>
                  </button>

                  {/* 4. Botón Plantillas Oficiales Meta (Reapertura de 24h y HSM homologadas) */}
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all border cursor-pointer ${
                      metaWindow.isExpired && !isInternalNote
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500/60 animate-pulse shadow-xs shadow-blue-500/20'
                        : 'bg-[#162345] hover:bg-[#1f315e] text-blue-300 border-slate-700/60 hover:border-blue-500/40'
                    }`}
                    title="Plantillas homologadas de Meta WhatsApp Cloud API (Reapertura de ventana / HSM)"
                  >
                    <FileText size={11} className="text-blue-400" />
                    <span>Plantillas Meta</span>
                  </button>
                </div>
              </div>

              {/* Banner de Cita/Respuesta (Estilo WhatsApp Web) */}
              {replyingToMessage && (
                <div className="flex items-center justify-between p-2.5 bg-[#0b1324] border-l-4 border-blue-500 rounded-xl border border-slate-700/60 shadow-lg animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1">
                      <Reply size={11} /> Respondiendo a {replyingToMessage.emisor === 'paciente' ? (getPatient(selectedConv)?.nombre || 'Paciente') : 'Operador Humano'}
                    </span>
                    <span className="text-xs text-slate-300 truncate max-w-md italic mt-0.5">
                      {replyingToMessage.contenido || '[Archivo Multimedia]'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
                    title="Cancelar respuesta"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Banner de Ventana de 24 Horas Cerrada (Meta Policy) */}
              {metaWindow.isExpired && !isInternalNote && (
                <div className="flex items-center justify-between p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl shadow-md text-xs text-rose-200 animate-in fade-in mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle size={15} className="text-rose-400 shrink-0" />
                    <span className="truncate">
                      <strong>Ventana de 24h de WhatsApp vencida</strong>: Meta exige enviar una plantilla oficial para reanudar el chat.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px] shrink-0 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer ml-2"
                  >
                    <Send size={11} />
                    <span>Reabrir con Plantilla</span>
                  </button>
                </div>
              )}

              {/* Formulario Principal de Envío */}
              <form onSubmit={handleSend} className="flex items-end gap-2 relative">
                
                {/* Menú Flotante de Respuestas Rápidas (Comando Slash) */}
                <ChatQuickRepliesMenu
                  isOpen={quickRepliesOpen || nuevoMensaje.startsWith('/')}
                  searchFilter={nuevoMensaje.startsWith('/') ? nuevoMensaje : ''}
                  pacienteNombre={currentPaciente?.nombre}
                  pacienteTelefono={currentPaciente?.telefono}
                  onSelect={(text) => {
                    setNuevoMensaje(text)
                    setQuickRepliesOpen(false)
                    setTimeout(() => messageInputRef.current?.focus(), 50)
                  }}
                  onClose={() => setQuickRepliesOpen(false)}
                />

                {/* Adjuntar Archivo */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*,.pdf,.doc,.docx,audio/*"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={subiendoArchivo || isInternalNote}
                  className="p-2.5 bg-[#14203d] hover:bg-[#1c2c54] border border-slate-700/60 rounded-xl text-slate-300 transition-colors shrink-0 disabled:opacity-40 mb-0.5"
                  title="Adjuntar archivo o imagen (PDF, JPG, PNG, Audio)"
                >
                  {subiendoArchivo ? <Loader2 size={18} className="animate-spin text-blue-400" /> : <Paperclip size={18} />}
                </button>

                {/* Selector de Emojis */}
                <ChatEmojiPicker
                  onSelectEmoji={(emoji) => {
                    setNuevoMensaje((prev) => prev + emoji)
                    setTimeout(() => messageInputRef.current?.focus(), 50)
                  }}
                />

                {/* Caja de Texto Multilínea con Globo Flotante de Formato y Soporte Pegar Capturas */}
                <div className="flex-1 relative">
                  <ChatFloatingFormatToolbar
                    textareaRef={messageInputRef}
                    value={nuevoMensaje}
                    onChange={(val) => setNuevoMensaje(val)}
                  />
                  <textarea
                    ref={messageInputRef}
                    rows={1}
                    value={nuevoMensaje}
                    onChange={(e) => {
                      setNuevoMensaje(e.target.value)
                      handleTypingPresence()
                    }}
                    onBlur={() => {
                      if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current)
                        typingTimeoutRef.current = null
                      }
                      if (selectedConvId && !isInternalNote) {
                        sendPresence(selectedConvId, 'paused')
                      }
                    }}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend(e)
                      }
                    }}
                    placeholder={
                      isInternalNote
                        ? "🔒 Escribe una nota interna para el equipo (solo visible en el CRM)..."
                        : metaWindow.isExpired
                        ? "⚠️ Ventana de 24h vencida. Haz clic en 'Reabrir con Plantilla' arriba para contactar al paciente..."
                        : selectedConv.bot_disabled
                        ? "Escribe un mensaje (*negrita*, _cursiva_, /plantillas, o pega capturas Ctrl+V)..."
                        : "¡El bot responderá! Activa 'Atención Humana' para responder tú..."
                    }
                    className={`w-full px-4 py-2.5 text-xs border rounded-xl text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 resize-none max-h-32 min-h-[38px] overflow-y-auto ${
                      isInternalNote
                        ? 'bg-[#1a1408] border-amber-500/50 focus:ring-amber-500 focus:border-amber-500'
                        : 'bg-[#14203d] border-slate-700/80 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>

                {/* Botón Enviar / Guardar Nota */}
                <button 
                  type="submit"
                  disabled={!nuevoMensaje.trim()}
                  className={`px-4 py-2.5 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 mb-0.5 ${
                    isInternalNote
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                  }`}
                >
                  {isInternalNote ? <Lock size={13} /> : <Send size={13} />}
                  <span>{isInternalNote ? 'Guardar Nota' : 'Enviar'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* 3. Panel Lateral Contextual 360° del Paciente (Drawer Derecho) */}
          {showPatientSidebar && (
            <ChatPatientSidebar
              paciente={currentPaciente}
              conversacionId={selectedConv.id}
              onClose={() => setShowPatientSidebar(false)}
              onOpenHistoriaClinica={(pId) => setSelectedPacienteHistoriaClinica(currentPaciente)}
              onOpenEditarPaciente={(p) => setSelectedPacienteEditar(p)}
              onInsertMessageToChat={(text) => {
                setNuevoMensaje(text)
                setTimeout(() => messageInputRef.current?.focus(), 50)
              }}
            />
          )}

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-[#090e1a]">
          <div className="p-4 bg-[#101b33] border border-slate-800 rounded-full mb-3 shadow-inner">
            <MessageCircle size={32} className="text-slate-400" />
          </div>
          <h3 className="font-bold text-sm text-slate-200">Ningún chat seleccionado</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Selecciona una conversación de la izquierda para ver el historial y responder.
          </p>
        </div>
      )}

      {/* MODAL HISTORIA CLÍNICA */}
      {selectedPacienteHistoriaClinica && (
        <ModalHistoriaClinica
          isOpen={Boolean(selectedPacienteHistoriaClinica)}
          onClose={() => setSelectedPacienteHistoriaClinica(null)}
          paciente={selectedPacienteHistoriaClinica}
        />
      )}

      {/* MODAL EDITAR PACIENTE */}
      {selectedPacienteEditar && (
        <ModalEditarPaciente
          isOpen={Boolean(selectedPacienteEditar)}
          paciente={selectedPacienteEditar}
          guardando={guardandoPaciente}
          onClose={() => setSelectedPacienteEditar(null)}
          onSave={handleSavePaciente}
        />
      )}

      {/* MODAL RESUMEN DEL CHAT (GEMINI IA) */}
      {aiSummaryText && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAiSummaryText(null)}
        >
          <div 
            className="bg-[#0f172a] border border-purple-500/50 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-700/50">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Resumen Inteligente del Chat</h3>
                  <p className="text-[10px] text-slate-400">Generado por Google Gemini</p>
                </div>
              </div>
              <button 
                onClick={() => setAiSummaryText(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#14203d] border border-slate-700/60 text-xs leading-relaxed">
              <WhatsAppFormattedText text={aiSummaryText} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiSummaryText)
                  alert('Resumen copiado al portapapeles.')
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Copy size={13} />
                <span>Copiar</span>
              </button>
              <button
                onClick={() => setAiSummaryText(null)}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENÚ CONTEXTUAL DE MENSAJES (CLIC DERECHO Y HOVER) */}
      {contextMenu && (
        <ChatMessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onReply={handleReplyMessage}
          onCopy={handleCopyText}
          onReact={handleReactToMessage}
          onSaveClinicalNote={handleSaveClinicalNote}
          onConvertToInternalNote={handleConvertToInternalNote}
          onDelete={handleDeleteMessage}
        />
      )}

      {/* MENÚ CONTEXTUAL DE CONTACTOS/CONVERSACIONES (CLIC DERECHO Y HOVER) */}
      {contactContextMenu && (
        <ChatContactContextMenu
          conversacion={contactContextMenu.conversacion}
          position={contactContextMenu.position}
          onClose={() => setContactContextMenu(null)}
          onToggleUnread={handleToggleUnreadContact}
          onTogglePin={handleTogglePinContact}
          onToggleArchive={handleToggleArchiveContact}
          onToggleBot={handleToggleBotContact}
          onCopyPhone={handleCopyPhoneContact}
          onOpenPatientFile={handleOpenPatientFileContact}
          onDelete={handleDeleteContact}
        />
      )}

      {/* MODAL SELECTOR DE PLANTILLAS HOMOLOGADAS DE META (VENTANA 24H) */}
      {showTemplateModal && currentPaciente && (
        <ModalSelectorPlantillasMeta
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          pacienteNombre={currentPaciente.nombre}
          pacienteTelefono={currentPaciente.telefono}
          pacienteId={currentPaciente.id}
          conversacionId={selectedConvId}
          isWindowOpen={!metaWindow.isExpired}
          onInsertText={(text) => {
            setNuevoMensaje(text)
            setTimeout(() => messageInputRef.current?.focus(), 50)
          }}
          onEnviadoExitoso={() => {
            if (selectedConvId) fetchMensajes(selectedConvId)
          }}
        />
      )}

      {/* MODAL PARA DERIVAR CONVERSACIÓN A OTRO ASESOR/OPERADOR */}
      {showDerivarModal && selectedConv && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111c35] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Share2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Derivar Conversación</h3>
                  <p className="text-xs text-slate-400">Transfiere la atención a otro miembro del equipo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDerivarModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Seleccionar Asesor / Operador Destino
                </label>
                {cargandoOperadores ? (
                  <div className="text-xs text-slate-400 py-2 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Cargando asesores disponibles...
                  </div>
                ) : (
                  <select
                    value={derivarUsuarioId}
                    onChange={(e) => setDerivarUsuarioId(e.target.value)}
                    className="w-full bg-[#0b1324] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="">-- Seleccionar operador --</option>
                    {operadores
                      .filter((op) => op.id !== currentUserId)
                      .map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.nombre_completo} ({op.roles?.nombre || op.email})
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nota interna de traspaso (opcional)
                </label>
                <textarea
                  value={derivarNota}
                  onChange={(e) => setDerivarNota(e.target.value)}
                  placeholder="Ej: Paciente consulta por implante molar. Solicita turno vespertino urgente con el Dr. Pérez..."
                  className="w-full bg-[#0b1324] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 h-24 resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Esta nota se registrará como nota interna visible en el CRM y no será enviada al paciente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDerivarModal(false)}
                disabled={derivando}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarDerivacion}
                disabled={derivando || !derivarUsuarioId}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 disabled:opacity-50"
              >
                {derivando ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Derivando...</span>
                  </>
                ) : (
                  <>
                    <Share2 size={13} />
                    <span>Confirmar Traspaso</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
