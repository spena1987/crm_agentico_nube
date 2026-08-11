'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, Phone, User, Bot, Sparkles, MessageCircle, RefreshCw, Smartphone } from 'lucide-react'
import ToggleHuman from './ToggleHuman'

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

export default function ChatInbox() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true)
  
  // Para pruebas/simulación
  const [simTelefono, setSimTelefono] = useState('5491123456789')
  const [simTexto, setSimTexto] = useState('')
  const [simulando, setSimulando] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      setConversaciones(data as unknown as Conversacion[])
      
      // Auto-seleccionar la primera si no hay ninguna seleccionada
      if (data && data.length > 0 && !selectedConvId) {
        setSelectedConvId(data[0].id)
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
      setMensajes(data || [])
    } catch (err) {
      console.error('Error cargando mensajes:', err)
    } finally {
      setCargandoMensajes(false)
    }
  }

  useEffect(() => {
    fetchConversaciones()
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
          
          // Si el mensaje corresponde a la conversación activa, añadirlo al listado
          if (newMsg.conversacion_id === selectedConvId) {
            setMensajes((prev) => [...prev, newMsg])
          }
          
          // Actualizar último mensaje en la lista de conversaciones
          setConversaciones((prevConvs) => 
            prevConvs.map((conv) => {
              if (conv.id === newMsg.conversacion_id) {
                return {
                  ...conv,
                  ultimo_mensaje: newMsg.contenido,
                  updated_at: newMsg.created_at
                }
              }
              return conv;
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
              return conv;
            })
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversaciones' },
        () => {
          // Refrescar conversaciones si se añade una nueva conversación
          fetchConversaciones()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConvId])

  const selectedConv = conversaciones.find((c) => c.id === selectedConvId)

  // Enviar mensaje manual del operador/clínica
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !selectedConvId) return

    const mensajeAEnviar = nuevoMensaje
    setNuevoMensaje('')

    try {
      // 1. Insertar el mensaje en Supabase
      const { error } = await supabase
        .from('mensajes')
        .insert({
          conversacion_id: selectedConvId,
          emisor: 'operador',
          contenido: mensajeAEnviar,
          metadata_json: {}
        })

      if (error) throw error

      // 2. Actualizar el último mensaje en la conversación localmente/remotamente
      await supabase
        .from('conversaciones')
        .update({ ultimo_mensaje: mensajeAEnviar })
        .eq('id', selectedConvId)

    } catch (err) {
      console.error('Error enviando mensaje:', err)
    }
  }

  // Simular un mensaje entrante de un paciente (para testing de Gemini)
  const handleSimulateIncoming = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simTexto.trim()) return

    setSimulando(true)
    try {
      const response = await fetch('http://localhost:8000/api/simulate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telefono: simTelefono,
          mensaje: simTexto
        })
      })

      if (response.ok) {
        setSimTexto('')
        // Recargar conversaciones tras simulación por si se creó un paciente
        setTimeout(() => {
          fetchConversaciones()
        }, 1500)
      } else {
        console.error('Error enviando simulación.')
      }
    } catch (error) {
      console.error('Error al conectar con la API de simulación del backend:', error)
    } finally {
      setSimulando(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)] shadow-lg max-w-7xl mx-auto w-full">
      
      {/* 1. Panel de Conversaciones (Izquierda) */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col bg-slate-50/50 dark:bg-slate-900/10">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2 text-md">
            <MessageCircle size={18} className="text-blue-600" />
            Chats Recientes
          </h2>
          <button 
            onClick={fetchConversaciones}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            title="Refrescar chats"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Simulador para testing fácil sin WhatsApp físico */}
        <div className="p-3 bg-blue-50/40 dark:bg-blue-950/10 border-b border-[var(--border)]">
          <form onSubmit={handleSimulateIncoming} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <Smartphone size={12} />
              Simular Cliente (WhatsApp)
            </div>
            <input 
              type="text"
              value={simTelefono}
              onChange={(e) => setSimTelefono(e.target.value)}
              placeholder="Teléfono"
              className="px-2 py-1 text-xs border border-[var(--border)] rounded bg-white dark:bg-slate-800 focus:outline-none"
            />
            <div className="flex gap-1.5">
              <input 
                type="text"
                value={simTexto}
                onChange={(e) => setSimTexto(e.target.value)}
                placeholder="Enviar mensaje..."
                className="flex-1 px-2 py-1 text-xs border border-[var(--border)] rounded bg-white dark:bg-slate-800 focus:outline-none"
              />
              <button 
                type="submit" 
                disabled={simulando}
                className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-all flex items-center justify-center min-w-[50px]"
              >
                {simulando ? '...' : 'Sim.'}
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
              const colorMode = conv.bot_disabled ? 'border-amber-400' : 'border-emerald-400'
              
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
                      {paciente?.telefono}
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
                <Phone size={11} /> {selectedConv.pacientes?.telefono}
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
                            <User size={10} /> Operador
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
                      <p className="whitespace-pre-line leading-relaxed">{msg.contenido}</p>
                      
                      {/* Hora */}
                      <span className="block text-[8px] text-right mt-1.5 opacity-60">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Envío de Mensaje */}
          <form onSubmit={handleSend} className="p-4 border-t border-[var(--border)] bg-[var(--card)] flex gap-2">
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder={
                selectedConv.bot_disabled 
                  ? "Escribe un mensaje como operador..." 
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
