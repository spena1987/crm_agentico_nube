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
  Loader2
} from 'lucide-react'
import ToggleHuman from './ToggleHuman'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'
import ChatMediaViewer, { DeliveryStatusIcon } from './chat/ChatMediaViewer'
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

  // Para pruebas/simulación
  const [simTelefono, setSimTelefono] = useState('5491123456789')
  const [simTexto, setSimTexto] = useState('')
  const [simulando, setSimulando] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setNuevoMensaje('')

    const tempId = `temp_${Date.now()}`
    const optimisticMsg: Mensaje = {
      id: tempId,
      conversacion_id: selectedConvId,
      emisor: 'operador',
      contenido: mensajeAEnviar,
      metadata_json: { status: 'delivered' },
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
            conversacion_id: selectedConvId
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
            metadata_json: {}
          })

        await supabase
          .from('conversaciones')
          .update({ ultimo_mensaje: mensajeAEnviar })
          .eq('id', selectedConvId)
      }

      setTimeout(() => {
        fetchMensajes(selectedConvId)
      }, 500)

    } catch (err) {
      console.error('Error enviando mensaje:', err)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedConvId || !selectedConv) return

    const paciente = getPatient(selectedConv)
    setSubiendoArchivo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('telefono', paciente?.telefono || '')
      formData.append('conversacion_id', selectedConvId)
      formData.append('caption', file.name)

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
    } finally {
      setSubiendoArchivo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
    <div className="flex h-[calc(100vh-2rem)] border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)] shadow-lg max-w-7xl mx-auto w-full">
      
      <div className="w-88 border-r border-[var(--border)] flex flex-col bg-slate-50/50 dark:bg-slate-900/10 min-w-[320px] max-w-[360px]">
        
        <div className="p-3.5 border-b border-[var(--border)] flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <h2 className="font-bold flex items-center gap-1.5 text-sm">
              <MessageCircle size={17} className="text-blue-600 shrink-0" />
              Inbox Pacientes
            </h2>
            <Link 
              href="/ajustes" 
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                isWaConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isWaConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
              <span>{isWaConnected ? 'WhatsApp Online' : 'Vincular'}</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowSimulator(!showSimulator)}
              className={`p-1.5 rounded-lg text-xs transition-colors ${showSimulator ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Smartphone size={15} />
            </button>
            <button 
              onClick={fetchConversaciones}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <div className="p-2.5 border-b border-[var(--border)] bg-white dark:bg-slate-900">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-2.5 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 text-slate-400"><X size={13} /></button>
            )}
          </div>
        </div>

        <div className="p-1.5 grid grid-cols-4 gap-1 border-b border-[var(--border)] bg-slate-100/60 text-[11px] font-semibold">
          <button onClick={() => setActiveTab('derivados')} className={`py-1.5 rounded-lg ${activeTab === 'derivados' ? 'bg-white text-rose-600' : 'text-slate-600'}`}>
            🔴 Humano ({derivadosCount})
          </button>
          <button onClick={() => setActiveTab('bot')} className={`py-1.5 rounded-lg ${activeTab === 'bot' ? 'bg-white text-emerald-600' : 'text-slate-600'}`}>
            🤖 Bot ({botCount})
          </button>
          <button onClick={() => setActiveTab('todos')} className={`py-1.5 rounded-lg ${activeTab === 'todos' ? 'bg-white text-blue-600' : 'text-slate-600'}`}>
            💬 Todos ({todosCount})
          </button>
          <button onClick={() => setActiveTab('archivados')} className={`py-1.5 rounded-lg ${activeTab === 'archivados' ? 'bg-white text-slate-900' : 'text-slate-600'}`}>
            ✅ Cerrados ({archivadosCount})
          </button>
        </div>

        {showSimulator && (
          <div className="p-3 bg-blue-50/70 border-b border-[var(--border)]">
            <form onSubmit={handleSimulateIncoming} className="flex flex-col gap-1.5">
              <input type="text" value={simTelefono} onChange={(e) => setSimTelefono(e.target.value)} className="px-2 py-1 text-xs border rounded" />
              <div className="flex gap-1.5">
                <input type="text" value={simTexto} onChange={(e) => setSimTexto(e.target.value)} className="flex-1 px-2 py-1 text-xs border rounded" />
                <button type="submit" className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded">Enviar</button>
              </div>
            </form>
          </div>
        )}

        {/* Listado de Tarjetas de Conversación Filtradas */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
          {cargandoConversaciones ? (
            <div className="p-6 text-center text-xs text-[var(--secondary)] flex flex-col items-center gap-2">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              <span>Cargando conversaciones...</span>
            </div>
          ) : filteredConversaciones.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-2">
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                <MessageCircle size={20} className="text-slate-400" />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {searchQuery ? 'No hay resultados para tu búsqueda' : 'No hay conversaciones en esta pestaña'}
              </span>
              <p className="text-[11px] text-slate-500">
                {searchQuery ? 'Prueba buscando con otro término o número' : 'Los nuevos mensajes aparecerán aquí automáticamente'}
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
                  className={`p-3 cursor-pointer transition-all flex items-start gap-2.5 relative border-l-4 ${
                    active 
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-l-blue-600' 
                      : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/30 border-l-transparent'
                  }`}
                >
                  {/* Avatar con Iniciales y Estado */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                      isDerivado 
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {initials}
                    </div>
                    {/* Dot de Atención */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      isArchivada
                        ? 'bg-slate-400'
                        : isDerivado
                        ? 'bg-rose-500 ring-2 ring-rose-300 dark:ring-rose-900 animate-pulse'
                        : 'bg-emerald-500'
                    }`} />
                  </div>

                  {/* Datos del Paciente y Preview de Mensaje */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${active ? 'font-bold text-blue-900 dark:text-blue-200' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>
                        {paciente?.nombre || `Paciente (${paciente?.telefono ? paciente.telefono.slice(-4) : '...' })`}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formattedTime}
                      </span>
                    </div>

                    {/* Fila de Teléfono e Insignia */}
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[10.5px] text-[var(--secondary)] truncate">
                        {paciente?.telefono ? formatPhoneDisplay(paciente.telefono) : 'Sin teléfono'}
                      </span>

                      {/* Badge de Triage */}
                      {isArchivada ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Resuelto
                        </span>
                      ) : isDerivado ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center gap-0.5">
                          <User size={9} /> Humano
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5">
                          <Bot size={9} /> Gemini
                        </span>
                      )}
                    </div>

                    {/* Último Mensaje Snippet */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1 leading-tight">
                      {snippet}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 2. Área de Mensajes del Chat (Derecha) */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/10">
          
          {/* Header del Chat Activo */}
          <div className="p-3.5 border-b border-[var(--border)] bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-xs">
            
            {/* Info del Paciente y Enlace a Ficha Médica */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold flex items-center justify-center text-sm shrink-0">
                {getInitials(currentPaciente?.nombre)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm truncate text-slate-900 dark:text-slate-100">
                    {currentPaciente?.nombre || 'Paciente'}
                  </h3>
                  {currentPaciente?.id && (
                    <Link 
                      href={`/pacientes?pacienteId=${currentPaciente.id}`}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 hover:underline"
                      title="Ver Ficha Médica Completa"
                    >
                      <span>Ficha</span> <ExternalLink size={10} />
                    </Link>
                  )}
                </div>
                <p className="text-[11px] text-[var(--secondary)] flex items-center gap-1.5">
                  <Phone size={11} /> {currentPaciente?.telefono ? formatPhoneDisplay(currentPaciente.telefono) : 'Sin teléfono'}
                </p>
              </div>
            </div>

            {/* Acciones Rápidas: Archivar / Resolver y Switch Humano/Bot */}
            <div className="flex items-center gap-2">
              
              {/* Botón Archivar / Marcar como Resuelto */}
              <button
                onClick={() => handleToggleArchivar(selectedConv.id, selectedConv.archivada)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                  selectedConv.archivada
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-[var(--border)] hover:bg-slate-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                }`}
                title={selectedConv.archivada ? 'Reabrir conversación' : 'Marcar conversación como resuelta / archivar'}
              >
                {selectedConv.archivada ? (
                  <>
                    <ArchiveRestore size={14} className="text-slate-500" />
                    <span>Reabrir Chat</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Marcar Resuelto</span>
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
            </div>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {cargandoMensajes ? (
              <div className="text-center text-xs text-[var(--secondary)] py-8 flex flex-col items-center gap-2">
                <Loader2 size={18} className="animate-spin text-blue-600" />
                <span>Cargando historial de mensajes...</span>
              </div>
            ) : mensajes.length === 0 ? (
              <div className="text-center text-xs text-[var(--secondary)] py-12 flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <MessageCircle size={22} className="text-slate-400" />
                </div>
                <span className="font-semibold">No hay mensajes en esta conversación</span>
                <p className="text-[11px]">Escribe un mensaje abajo para iniciar el chat con el paciente</p>
              </div>
            ) : (
              mensajes.map((msg) => {
                const isOperator = msg.emisor === 'operador'
                const isBot = msg.emisor === 'bot'
                const isSystem = msg.metadata_json?.sistema === true
                
                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900/40">
                        {msg.contenido}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOperator ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl p-3.5 shadow-sm text-xs relative ${
                        isOperator
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : isBot
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-slate-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40 rounded-tl-none'
                          : 'bg-white dark:bg-slate-800 border border-[var(--border)] rounded-tl-none text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {/* Badge del emisor */}
                      <div className="flex items-center gap-1 text-[9px] font-bold opacity-80 mb-1.5 uppercase tracking-wider">
                        {isOperator ? (
                          <>
                            <User size={10} /> Operador Humano (CRM)
                          </>
                        ) : isBot ? (
                          <>
                            <Bot size={10} className="text-emerald-500" />
                            <Sparkles size={8} className="text-emerald-400 animate-pulse" />
                            Bot Gemini
                          </>
                        ) : (
                          <>
                            <User size={10} /> Paciente
                          </>
                        )}
                      </div>
                      
                      {/* Contenido textual (si no es un placeholder genérico de media) */}
                      {msg.contenido && (!msg.metadata_json?.tipo || (!msg.contenido.startsWith('[') && !msg.contenido.endsWith(']'))) && (
                        <p className="whitespace-pre-line leading-relaxed">{msg.contenido}</p>
                      )}
                      
                      {/* Visualizador Multimedia (Fotos con Lightbox, Audios, PDFs, Documentos) */}
                      <ChatMediaViewer metadata={msg.metadata_json} isOperator={isOperator} />
                      
                      {/* Pie con Hora y Tildes de lectura */}
                      <div className="flex items-center justify-end gap-1 text-[8px] mt-1.5 opacity-75">
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

          {/* Caja de Entrada de Mensajes del Operador */}
          <div className="p-3 border-t border-[var(--border)] bg-white dark:bg-slate-900">
            <form onSubmit={handleSend} className="flex items-center gap-2">
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
                disabled={subiendoArchivo}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors shrink-0 disabled:opacity-50"
                title="Adjuntar archivo o imagen (PDF, JPG, PNG, Audio)"
              >
                {subiendoArchivo ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <Paperclip size={18} />}
              </button>

              <input 
                type="text"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                placeholder={selectedConv.bot_disabled ? "Escribe un mensaje como operador (saldrá por WhatsApp real)..." : "¡El bot responderá! Activa 'Atención Humana' para responder tú..."}
                className="flex-1 px-4 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button 
                type="submit"
                disabled={!nuevoMensaje.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              >
                <Send size={13} />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--secondary)] bg-slate-50/50 dark:bg-slate-900/10">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 shadow-xs">
            <MessageCircle size={32} className="text-slate-400" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Ningún chat seleccionado</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Selecciona una conversación de la izquierda para ver el historial y responder.
          </p>
        </div>
      )}
    </div>
  )
}
