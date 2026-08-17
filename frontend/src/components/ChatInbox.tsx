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
  ChevronRight
} from 'lucide-react'
import ToggleHuman from './ToggleHuman'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'
import ChatMediaViewer, { DeliveryStatusIcon } from './chat/ChatMediaViewer'
import WhatsAppFormattedText from './chat/WhatsAppFormattedText'
import ChatFloatingFormatToolbar from './chat/ChatFloatingFormatToolbar'
import ChatPatientSidebar from './chat/ChatPatientSidebar'
import ChatQuickRepliesMenu from './chat/ChatQuickRepliesMenu'
import ChatEmojiPicker from './chat/ChatEmojiPicker'
import ModalHistoriaClinica from './ModalHistoriaClinica'
import ModalEditarPaciente from './ModalEditarPaciente'
import { BACKEND_URL } from '@/lib/api'

interface Paciente {
  id: string
  telefono: string
  nombre: string
  email: string | null
}

interface Conversacion {
  id: string
  paciente_id: string
  bot_disabled: boolean
  archivada?: boolean
  agente_asignado_codigo?: string
  ultimo_mensaje: string | null
  updated_at: string
  pacientes: Paciente | Paciente[] | null
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
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true)
  const [waStatus, setWaStatus] = useState<WAStatus | null>(null)
  
  // Filtros y Búsqueda
  const [activeTab, setActiveTab] = useState<'derivados' | 'bot' | 'todos' | 'archivados'>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSimulator, setShowSimulator] = useState(false)

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)

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

  const fetchConversaciones = async () => {
    try {
      setCargandoConversaciones(true)
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

      if (convs.length === 0) {
        const { data, error } = await supabase
          .from('conversaciones')
          .select(`
            id,
            paciente_id,
            bot_disabled,
            archivada,
            ultimo_mensaje,
            updated_at,
            pacientes (
              id,
              telefono,
              nombre,
              email
            )
          `)
          .order('updated_at', { ascending: false })
        
        if (!error && data) {
          convs = (data as unknown as Conversacion[]) || []
        }
      }

      setConversaciones(convs)
      
      if (paramPacienteId && convs.length > 0) {
        const target = convs.find((c) => {
          const p = getPatient(c)
          return c.paciente_id === paramPacienteId || p?.id === paramPacienteId
        })
        if (target) {
          setSelectedConvId(target.id)
          return
        }
      }
      if (paramTelefono && convs.length > 0) {
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
      setCargandoMensajes(true)
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

      if (msgs.length === 0) {
        const { data, error } = await supabase
          .from('mensajes')
          .select('*')
          .eq('conversacion_id', convId)
          .order('created_at', { ascending: true })
        
        if (!error && data) {
          msgs = (data as unknown as Mensaje[]) || []
        }
      }

      const uniqueMap = new Map<string, Mensaje>()
      for (const m of msgs) {
        uniqueMap.set(m.id, m)
      }
      setMensajes(Array.from(uniqueMap.values()))
    } catch (err) {
      console.error('Error cargando mensajes:', err)
    } finally {
      setCargandoMensajes(false)
    }
  }

  useEffect(() => {
    fetchConversaciones()
    fetchWAStatus()
    const intervalStatus = setInterval(fetchWAStatus, 5000)
    
    const intervalConvs = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversaciones`, { cache: 'no-store' })
        if (res.ok) {
          const apiData = await res.json()
          if (Array.isArray(apiData) && apiData.length > 0) {
            setConversaciones(apiData)
            return
          }
        }
      } catch (e) {}

      supabase
        .from('conversaciones')
        .select(`
          id,
          paciente_id,
          bot_disabled,
          archivada,
          ultimo_mensaje,
          updated_at,
          pacientes (
            id,
            telefono,
            nombre,
            email
          )
        `)
        .order('updated_at', { ascending: false })
        .then(({ data }) => {
          if (data) {
            setConversaciones(data as unknown as Conversacion[])
          }
        })
    }, 4000)

    return () => {
      clearInterval(intervalStatus)
      clearInterval(intervalConvs)
    }
  }, [])

  useEffect(() => {
    if (!selectedConvId) return
    fetchMensajes(selectedConvId)

    const intervalMsgs = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversaciones/${selectedConvId}/mensajes`, { cache: 'no-store' })
        if (res.ok) {
          const apiMsgs = await res.json()
          if (Array.isArray(apiMsgs)) {
            const uniqueMap = new Map<string, Mensaje>()
            for (const m of apiMsgs) {
              uniqueMap.set(m.id, m)
            }
            setMensajes(Array.from(uniqueMap.values()))
            return
          }
        }
      } catch (e) {}

      supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', selectedConvId)
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            const uniqueMap = new Map<string, Mensaje>()
            for (const m of (data as unknown as Mensaje[])) {
              uniqueMap.set(m.id, m)
            }
            setMensajes(Array.from(uniqueMap.values()))
          }
        })
    }, 2000)

    return () => clearInterval(intervalMsgs)
  }, [selectedConvId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => {
    const channel = supabase
      .channel('chat-inbox-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          const newMsg = payload.new as Mensaje
          if (newMsg.conversacion_id === selectedConvId) {
            setMensajes((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev.filter((m) => !m.id.startsWith('temp_')), newMsg]
            })
          }
          setConversaciones((prevConvs) => 
            prevConvs.map((conv) => {
              if (conv.id === newMsg.conversacion_id) {
                return {
                  ...conv,
                  ultimo_mensaje: newMsg.contenido,
                  updated_at: newMsg.created_at
                }
              }
              return conv
            }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          )
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
                return {
                  ...conv,
                  bot_disabled: updatedConv.bot_disabled,
                  archivada: updatedConv.archivada,
                  ultimo_mensaje: updatedConv.ultimo_mensaje,
                  updated_at: updatedConv.updated_at
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
  }, [selectedConvId])

  const selectedConv = conversaciones.find((c) => c.id === selectedConvId)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !selectedConvId || !selectedConv) return

    const mensajeAEnviar = nuevoMensaje.trim()
    const esNotaInternaActual = isInternalNote
    setNuevoMensaje('')
    setQuickRepliesOpen(false)

    const tempId = `temp_${Date.now()}`
    const optimisticMsg: Mensaje = {
      id: tempId,
      conversacion_id: selectedConvId,
      emisor: 'operador',
      contenido: mensajeAEnviar,
      metadata_json: esNotaInternaActual 
        ? { is_internal_note: true, tipo: 'nota_interna' } 
        : { status: 'delivered' },
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
            is_internal_note: esNotaInternaActual
          })
        })
        if (response.ok) {
          dispatchedViaBackend = true
        }
      } catch (backendErr) {
        console.warn('Backend WhatsApp no disponible:', backendErr)
      }

      if (!dispatchedViaBackend) {
        await supabase
          .from('mensajes')
          .insert({
            conversacion_id: selectedConvId,
            emisor: 'operador',
            contenido: mensajeAEnviar,
            metadata_json: esNotaInternaActual ? { is_internal_note: true, tipo: 'nota_interna' } : {}
          })

        if (!esNotaInternaActual) {
          await supabase
            .from('conversaciones')
            .update({ ultimo_mensaje: mensajeAEnviar })
            .eq('id', selectedConvId)
        }
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

  const derivadosCount = conversaciones.filter((c) => Boolean(c.bot_disabled) && !c.archivada).length
  const botCount = conversaciones.filter((c) => !c.bot_disabled && !c.archivada).length
  const todosCount = conversaciones.filter((c) => !c.archivada).length
  const archivadosCount = conversaciones.filter((c) => Boolean(c.archivada)).length

  const filteredConversaciones = conversaciones.filter((conv) => {
    const paciente = getPatient(conv)
    const nombre = (paciente?.nombre || '').toLowerCase()
    const telefono = (paciente?.telefono || '').toLowerCase()
    const ultimoMsg = (conv.ultimo_mensaje || '').toLowerCase()
    const q = searchQuery.trim().toLowerCase()

    const matchesSearch = !q || nombre.includes(q) || telefono.includes(q) || ultimoMsg.includes(q)
    if (!matchesSearch) return false

    if (activeTab === 'derivados') return Boolean(conv.bot_disabled) && !conv.archivada
    if (activeTab === 'bot') return !conv.bot_disabled && !conv.archivada
    if (activeTab === 'archivados') return Boolean(conv.archivada)
    return !conv.archivada
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
              onClick={fetchConversaciones}
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

        {/* Pestañas de Estado con Contadores Dinámicos (Tema Oscuro Coherente) */}
        <div className="p-1.5 grid grid-cols-4 gap-1 border-b border-slate-800 bg-[#0a101d] text-[11px] font-semibold">
          
          {/* 1. DERIVADOS / ATENCIÓN HUMANA */}
          <button
            onClick={() => setActiveTab('derivados')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'derivados'
                ? 'bg-[#2a1722] text-rose-300 border-rose-500/50 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
          >
            <span className="truncate flex items-center gap-1">
              🔴 Humano
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold border ${
              derivadosCount > 0 
                ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 animate-pulse' 
                : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
            }`}>
              {derivadosCount}
            </span>
          </button>

          {/* 2. BOT GEMINI ACTIVO */}
          <button
            onClick={() => setActiveTab('bot')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'bot'
                ? 'bg-[#122822] text-emerald-300 border-emerald-500/50 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
          >
            <span className="truncate flex items-center gap-1">
              🤖 Con Bot
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
              {botCount}
            </span>
          </button>

          {/* 3. TODOS LOS CHATS ACTIVOS */}
          <button
            onClick={() => setActiveTab('todos')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'todos'
                ? 'bg-[#162547] text-blue-300 border-blue-500/50 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
          >
            <span className="truncate">
              💬 Todos
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold bg-slate-800 text-slate-300 border border-slate-700/60">
              {todosCount}
            </span>
          </button>

          {/* 4. CERRADOS / ARCHIVADOS */}
          <button
            onClick={() => setActiveTab('archivados')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all border ${
              activeTab === 'archivados'
                ? 'bg-[#1e293b] text-slate-200 border-slate-600 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#131e36]/60'
            }`}
          >
            <span className="truncate">
              ✅ Cerrados
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full mt-0.5 font-bold bg-slate-800 text-slate-400 border border-slate-700/60">
              {archivadosCount}
            </span>
          </button>
        </div>

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
              
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 relative border-l-4 ${
                    active 
                      ? 'bg-[#162547] border-l-blue-500 shadow-xs' 
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
                        : 'bg-emerald-500'
                    }`} />
                  </div>

                  {/* Datos del Paciente y Preview de Mensaje */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${active ? 'font-bold text-blue-200' : 'font-semibold text-slate-100'}`}>
                        {paciente?.nombre || `Paciente (${paciente?.telefono ? paciente.telefono.slice(-4) : '...' })`}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formattedTime}
                      </span>
                    </div>

                    {/* Fila de Teléfono e Insignia */}
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[10.5px] text-slate-400 truncate">
                        {paciente?.telefono ? formatPhoneDisplay(paciente.telefono) : 'Sin teléfono'}
                      </span>

                      {/* Badge de Triage */}
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

                    {/* Último Mensaje Snippet */}
                    <p className="text-[11px] text-slate-400 truncate mt-1 leading-tight">
                      {snippet}
                    </p>
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
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Phone size={11} /> {currentPaciente?.telefono ? formatPhoneDisplay(currentPaciente.telefono) : 'Sin teléfono'}
                  </p>
                </div>
              </div>

              {/* Acciones Rápidas de la Cabecera */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                
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

                {/* Botón Archivar / Marcar como Resuelto */}
                <button
                  onClick={() => handleToggleArchivar(selectedConv.id, selectedConv.archivada)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                    selectedConv.archivada
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70 hover:bg-emerald-900/60'
                  }`}
                  title={selectedConv.archivada ? 'Reabrir conversación' : 'Marcar conversación como resuelta'}
                >
                  {selectedConv.archivada ? (
                    <>
                      <ArchiveRestore size={13} className="text-slate-400" />
                      <span className="hidden md:inline">Reabrir</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span className="hidden md:inline">Resolver</span>
                    </>
                  )}
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

            {/* Historial de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#090e1a] panel-scroll">
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

                  // 1. NOTA INTERNA PRIVADA (ÁMBAR)
                  if (isInternal) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="max-w-md w-full bg-[#241a06] border border-amber-500/50 text-amber-200 rounded-2xl p-3 shadow-md text-xs">
                          <div className="flex items-center justify-between gap-1 text-[9.5px] font-bold text-amber-400 mb-1.5 pb-1 border-b border-amber-800/40">
                            <span className="flex items-center gap-1">
                              <Lock size={11} /> NOTA INTERNA (Privado del Equipo Médico)
                            </span>
                            <span className="text-[8.5px] opacity-70">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <WhatsAppFormattedText text={msg.contenido} className="leading-relaxed text-amber-100" />
                        </div>
                      </div>
                    )
                  }

                  // 2. MENSAJE NORMAL DE WHATSAPP
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOperator ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl p-3.5 shadow-sm text-xs relative ${
                          isOperator
                            ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-900/20'
                            : isBot
                            ? 'bg-[#0c221e] text-emerald-100 border border-emerald-800/60 rounded-tl-none'
                            : 'bg-[#131d35] border border-slate-700/60 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        {/* Badge del emisor */}
                        <div className="flex items-center gap-1 text-[9px] font-bold opacity-85 mb-1.5 uppercase tracking-wider">
                          {isOperator ? (
                            <>
                              <User size={10} className="text-blue-200" /> Operador Humano (CRM)
                            </>
                          ) : isBot ? (
                            <>
                              <Bot size={10} className="text-emerald-400" />
                              <Sparkles size={8} className="text-emerald-300 animate-pulse" />
                              Bot Gemini
                            </>
                          ) : (
                            <>
                              <User size={10} className="text-slate-300" /> Paciente
                            </>
                          )}
                        </div>
                        
                        {/* Contenido textual con formato enriquecido */}
                        {msg.contenido && (!msg.metadata_json?.tipo || (!msg.contenido.startsWith('[') && !msg.contenido.endsWith(']'))) && (
                          <WhatsAppFormattedText text={msg.contenido} className="leading-relaxed" />
                        )}
                        
                        {/* Visualizador Multimedia */}
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
                        
                        {/* Pie con Hora y Tildes */}
                        <div className="flex items-center justify-end gap-1 text-[8px] mt-1.5 opacity-70">
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isOperator && (
                            <DeliveryStatusIcon status={msg.metadata_json?.delivery_status} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

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

                  {/* 3. Botón Respuestas Rápidas */}
                  <button
                    type="button"
                    onClick={() => setQuickRepliesOpen(!quickRepliesOpen)}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all border ${
                      quickRepliesOpen 
                        ? 'bg-amber-600/30 text-amber-300 border-amber-500/60' 
                        : 'bg-[#162345] hover:bg-[#1f315e] text-slate-300 border-slate-700/60'
                    }`}
                    title="Abrir menú de plantillas rápidas (o escribe / en el chat)"
                  >
                    <Zap size={11} className="text-amber-400" />
                    <span>Plantillas (/)</span>
                  </button>
                </div>
              </div>

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
                    onChange={(e) => setNuevoMensaje(e.target.value)}
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
    </div>
  )
}
