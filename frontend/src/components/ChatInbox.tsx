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
  Radio,
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
  ultimo_mensaje: string | null
  updated_at: string
  pacientes: Paciente | null
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

export default function ChatInbox() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true)
  const [waStatus, setWaStatus] = useState<WAStatus | null>(null)
  
  // Para pruebas/simulación
  const [simTelefono, setSimTelefono] = useState('5491123456789')
  const [simTexto, setSimTexto] = useState('')
  const [simulando, setSimulando] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar estado de WhatsApp
  const fetchWAStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/status`)
      if (res.ok) {
        const data = await res.json()
        setWaStatus(data)
      }
    } catch (err) {
      // Backend offline o simulado
    }
  }

  const searchParams = useSearchParams()
  const paramPacienteId = searchParams ? searchParams.get('pacienteId') : null
  const paramTelefono = searchParams ? searchParams.get('telefono') : null

  // Cargar conversaciones al iniciar
  const fetchConversaciones = async () => {
    try {
      setCargandoConversaciones(true)
      const { data, error } = await supabase
        .from('conversaciones')
        .select(`
          id,
          paciente_id,
          bot_disabled,
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
      
      if (error) throw error
      const convs = (data as unknown as Conversacion[]) || []
      setConversaciones(convs)
      
      // Auto-seleccionar conversación por pacienteId o teléfono si viene en query params
      if (paramPacienteId && convs.length > 0) {
        const target = convs.find((c) => c.paciente_id === paramPacienteId || c.pacientes?.id === paramPacienteId)
        if (target) {
          setSelectedConvId(target.id)
          return
        }
      }
      if (paramTelefono && convs.length > 0) {
        const target = convs.find((c) => c.pacientes?.telefono === paramTelefono)
        if (target) {
          setSelectedConvId(target.id)
          return
        }
      }

      // Auto-seleccionar la primera si no hay ninguna seleccionada
      if (convs.length > 0 && !selectedConvId) {
        setSelectedConvId(convs[0].id)
      }
    } catch (err) {
      console.error('Error cargando conversaciones:', err)
    } finally {
      setCargandoConversaciones(false)
    }
  }

  // Cargar mensajes de la conversación seleccionada
  const fetchMensajes = async (convId: string) => {
    try {
      setCargandoMensajes(true)
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', convId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setMensajes((data as unknown as Mensaje[]) || [])
    } catch (err) {
      console.error('Error cargando mensajes:', err)
    } finally {
      setCargandoMensajes(false)
    }
  }

  useEffect(() => {
    fetchConversaciones()
    fetchWAStatus()
    const interval = setInterval(fetchWAStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedConvId) {
      fetchMensajes(selectedConvId)
    }
  }, [selectedConvId])

  // Scroll automático al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // Configuración de Supabase Realtime para recibir mensajes en vivo
  useEffect(() => {
    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          const newMsg = payload.new as Mensaje
          
          if (newMsg.conversacion_id === selectedConvId) {
            setMensajes((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
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
                  ultimo_mensaje: updatedConv.ultimo_mensaje,
                  updated_at: updatedConv.updated_at
                }
              }
              return conv
            })
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversaciones' },
        () => {
          fetchConversaciones()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConvId])

  const selectedConv = conversaciones.find((c) => c.id === selectedConvId)

  // Enviar mensaje del operador directamente a WhatsApp y Supabase
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !selectedConvId || !selectedConv) return

    const mensajeAEnviar = nuevoMensaje
    setNuevoMensaje('')

    try {
      const telefonoDestino = selectedConv.pacientes?.telefono || ''
      
      // Intentar enviar mediante el gateway de WhatsApp del backend
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
        console.warn('Backend WhatsApp no disponible, guardando directo en Supabase:', backendErr)
      }

      // Si el backend no guardó en Supabase, lo guardamos directamente
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

    } catch (err) {
      console.error('Error enviando mensaje:', err)
    }
  }

  // Enviar archivo multimedia del operador al paciente
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedConvId || !selectedConv) return

    setSubiendoArchivo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('telefono', selectedConv.pacientes?.telefono || '')
      formData.append('conversacion_id', selectedConvId)
      formData.append('caption', file.name)

      const res = await fetch(`${BACKEND_URL}/api/whatsapp/send-media`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error('Error al enviar archivo por WhatsApp')
      }
    } catch (err) {
      console.error('Error subiendo archivo:', err)
      alert('Hubo un inconveniente al enviar el archivo adjunto.')
    } finally {
      setSubiendoArchivo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Simular mensaje entrante
  const handleSimulateIncoming = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simTexto.trim()) return

    setSimulando(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: simTelefono,
          mensaje: simTexto
        })
      })

      if (response.ok) {
        setSimTexto('')
      }
    } catch (error) {
      console.error('Error enviando simulación:', error)
    } finally {
      setSimulando(false)
    }
  }

  const isWaConnected = waStatus?.is_logged_in || waStatus?.status === 'CONNECTED'

  return (
    <div className="flex h-[calc(100vh-2rem)] border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)] shadow-lg max-w-7xl mx-auto w-full">
      
      {/* 1. Panel de Conversaciones (Izquierda) */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col bg-slate-50/50 dark:bg-slate-900/10">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold flex items-center gap-2 text-md">
              <MessageCircle size={18} className="text-blue-600" />
              Chats
            </h2>
            {/* Status pill de WhatsApp */}
            <Link 
              href="/ajustes" 
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                isWaConnected 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-200'
              }`}
              title="Click para ir a Ajustes de WhatsApp"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isWaConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
              <span>{isWaConnected ? 'WhatsApp Online' : 'Vincular QR'}</span>
            </Link>
          </div>
          <button 
            onClick={fetchConversaciones}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            title="Refrescar chats"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Simulador para testing rápido */}
        <div className="p-3 bg-blue-50/40 dark:bg-blue-950/10 border-b border-[var(--border)]">
          <form onSubmit={handleSimulateIncoming} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Smartphone size={12} />
                Simulador de Paciente
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
              className="px-2 py-1 text-xs border border-[var(--border)] rounded bg-white dark:bg-slate-800 focus:outline-none"
            />
            <div className="flex gap-1.5">
              <input 
                type="text"
                value={simTexto}
                onChange={(e) => setSimTexto(e.target.value)}
                placeholder="Mensaje del paciente..."
                className="flex-1 px-2 py-1 text-xs border border-[var(--border)] rounded bg-white dark:bg-slate-800 focus:outline-none"
              />
              <button 
                type="submit" 
                disabled={simulando}
                className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-all flex items-center justify-center min-w-[50px]"
              >
                {simulando ? '...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>

        {/* Listado de Chats */}
        <div className="flex-1 overflow-y-auto">
          {cargandoConversaciones ? (
            <div className="p-4 text-center text-xs text-[var(--secondary)]">Cargando chats...</div>
          ) : conversaciones.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--secondary)]">No hay conversaciones activas.</div>
          ) : (
            conversaciones.map((conv) => {
              const active = conv.id === selectedConvId
              const paciente = conv.pacientes
              
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3.5 border-b border-[var(--border)] cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    active 
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-600' 
                      : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/20 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold truncate">
                        {paciente?.nombre || `Paciente (${paciente?.telefono.slice(-4)})`}
                      </p>
                      <span className={`w-2 h-2 rounded-full ${conv.bot_disabled ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    </div>
                    <p className="text-[11px] text-[var(--secondary)] truncate mt-0.5">
                      {paciente?.telefono ? formatPhoneDisplay(paciente.telefono) : 'Sin teléfono'}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1">
                      {conv.ultimo_mensaje || 'Sin mensajes aún'}
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
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/10">
          
          {/* Header del Chat */}
          <div className="p-4 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">
                {selectedConv.pacientes?.nombre}
              </h3>
              <p className="text-[11px] text-[var(--secondary)] flex items-center gap-1.5">
                <Phone size={11} /> {selectedConv.pacientes?.telefono ? formatPhoneDisplay(selectedConv.pacientes.telefono) : 'Sin teléfono'}
              </p>
            </div>
            
            {/* Switch de Control Bot vs Humano */}
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

          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {cargandoMensajes ? (
              <div className="text-center text-xs text-[var(--secondary)]">Cargando historial...</div>
            ) : mensajes.length === 0 ? (
              <div className="text-center text-xs text-[var(--secondary)]">No hay mensajes. Envía uno para iniciar.</div>
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
                      {/* Badge pequeño del emisor */}
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
                      {/* Contenido textual */}
                      {msg.contenido && (
                        <p className="whitespace-pre-line leading-relaxed">{msg.contenido}</p>
                      )}
                      
                      {/* Visualizador Multimedia (Fotos, Audios, PDFs, Reacciones) */}
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

          {/* Formulario de Envío de Mensaje con Soporte de Adjuntos */}
          <form onSubmit={handleSend} className="p-4 border-t border-[var(--border)] bg-[var(--card)] flex items-center gap-2">
            {/* Input oculto para adjuntar fotos o PDFs */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*,application/pdf,.doc,.docx" 
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendoArchivo}
              className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--secondary)] hover:text-blue-600 rounded-xl transition-all disabled:opacity-50"
              title="Adjuntar foto de estudio, receta o PDF"
            >
              {subiendoArchivo ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <Paperclip size={16} />
              )}
            </button>

            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder={
                selectedConv.bot_disabled 
                  ? "Escribe un mensaje como operador (saldrá por WhatsApp real)..." 
                  : "¡El bot responderá! Activa 'Atención Humana' para responder tú..."
              }
              className="flex-1 px-4 py-3 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
            <button
              type="submit"
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <Send size={15} />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/10 text-[var(--secondary)]">
          <MessageCircle size={48} className="text-slate-300 animate-bounce mb-3" />
          <p className="text-sm font-semibold">Selecciona una conversación para chatear</p>
        </div>
      )}
    </div>
  )
}
