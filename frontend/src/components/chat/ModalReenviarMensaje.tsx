'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  X,
  Search,
  Forward,
  Check,
  Loader2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Mic,
  Video as VideoIcon,
  Phone,
  User,
  Clock,
  Send,
  Lock,
  Sparkles
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ModalReenviarMensajeProps {
  isOpen: boolean
  onClose: () => void
  message: any | null
  conversaciones: any[]
  currentConvId?: string | null
  currentUserId?: string | null
  currentUserName?: string | null
  onForwardSuccess?: () => void
}

export default function ModalReenviarMensaje({
  isOpen,
  onClose,
  message,
  conversaciones = [],
  currentConvId,
  currentUserId,
  currentUserName,
  onForwardSuccess
}: ModalReenviarMensajeProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([])
  const [comoNotaInternaSiCerrada, setComoNotaInternaSiCerrada] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Reset al abrir o cambiar de mensaje
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      setSelectedConvIds([])
      setComoNotaInternaSiCerrada(true)
      setErrorMsg(null)
      setSuccessMsg(null)
      setEnviando(false)
    }
  }, [isOpen, message?.id])

  // Extraer información del paciente en una conversación
  const getConvPatient = (c: any) => {
    if (!c) return { nombre: 'Sin Paciente', telefono: '' }
    const p = c.pacientes
    if (Array.isArray(p) && p.length > 0) return p[0]
    if (p && typeof p === 'object') return p
    return { nombre: 'Paciente', telefono: c.wa_chat_id || '' }
  }

  // Filtrar lista de conversaciones excluyendo la actual
  const filteredConversaciones = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return conversaciones.filter((c) => {
      // Excluir la misma conversación de donde proviene el mensaje
      if (currentConvId && c.id === currentConvId) return false
      
      const pac = getConvPatient(c)
      const nombre = (pac.nombre || '').toLowerCase()
      const tel = (pac.telefono || c.wa_chat_id || '').toLowerCase()
      const ultimo = (c.ultimo_mensaje || '').toLowerCase()

      if (!term) return true
      return nombre.includes(term) || tel.includes(term) || ultimo.includes(term)
    })
  }, [conversaciones, currentConvId, searchTerm])

  if (!isOpen || !message) return null

  // Detectar tipo de contenido para el preview
  const meta = message.metadata_json || {}
  const mediaUrl = meta.media_url
  const tipoMedia = meta.tipo || ''
  const isImage = tipoMedia === 'imagen' || tipoMedia === 'image' || Boolean(message.contenido?.includes('📷'))
  const isAudio = tipoMedia === 'audio' || tipoMedia === 'voice' || Boolean(message.contenido?.includes('🎤'))
  const isDoc = tipoMedia === 'documento' || tipoMedia === 'document' || Boolean(meta.file_name?.endsWith('.pdf'))
  const isVideo = tipoMedia === 'video'
  const isInternal = Boolean(meta.is_internal_note || meta.tipo === 'nota_interna')

  const toggleSelectConv = (convId: string) => {
    setErrorMsg(null)
    if (selectedConvIds.includes(convId)) {
      setSelectedConvIds(selectedConvIds.filter((id) => id !== convId))
    } else {
      if (selectedConvIds.length >= 5) {
        setErrorMsg('Puedes reenviar a un máximo de 5 conversaciones simultáneas.')
        return
      }
      setSelectedConvIds([...selectedConvIds, convId])
    }
  }

  // Verificar si alguno de los seleccionados tiene la ventana cerrada
  const hasSelectedWithClosedWindow = selectedConvIds.some((cId) => {
    const c = conversaciones.find((item) => item.id === cId)
    return c && c.is_window_open === false
  })

  // Ejecutar el reenvío
  const handleExecuteForward = async () => {
    if (selectedConvIds.length === 0) {
      setErrorMsg('Selecciona al menos una conversación para reenviar.')
      return
    }

    setEnviando(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const payload = {
        mensaje_id: message.id,
        conversaciones_destino_ids: selectedConvIds,
        como_nota_interna_si_cerrada: comoNotaInternaSiCerrada,
        usuario_id: currentUserId || null,
        usuario_nombre: currentUserName || 'Operador'
      }

      const res = await fetch(`${BACKEND_URL}/api/whatsapp/forward-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Error al procesar el reenvío')
      }

      const enviadosCount = data.enviados ?? selectedConvIds.length
      setSuccessMsg(`¡Mensaje reenviado con éxito a ${enviadosCount} conversación(es)!`)

      if (onForwardSuccess) {
        onForwardSuccess()
      }

      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error('Error al reenviar mensaje:', err)
      setErrorMsg(err.message || 'Error de conexión al reenviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0f172a] border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#162036]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
              <Forward size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Reenviar Mensaje
              </h2>
              <p className="text-xs text-slate-400">
                Selecciona uno o más chats para enviar este mensaje
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta de Previsualización del Mensaje Origen */}
        <div className="px-5 pt-3.5 pb-2 bg-[#111c33]/50 border-b border-slate-800/80">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
            <span>Mensaje a reenviar:</span>
            {isInternal && (
              <span className="text-amber-400 flex items-center gap-0.5 ml-1">
                <Lock size={10} /> (Nota Interna)
              </span>
            )}
          </div>
          <div className="p-2.5 rounded-xl bg-[#0a101f] border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-300 shrink-0 mt-0.5">
              {isImage ? <ImageIcon size={14} /> : isAudio ? <Mic size={14} /> : isDoc ? <FileText size={14} /> : isVideo ? <VideoIcon size={14} /> : <Forward size={14} />}
            </div>
            <div className="min-w-0 flex-1">
              {meta.file_name && (
                <p className="font-semibold text-indigo-300 truncate text-[11.5px]">{meta.file_name}</p>
              )}
              <p className="line-clamp-2 text-slate-300 break-words leading-relaxed">
                {message.contenido || (meta.file_name ? 'Archivo multimedia adjunto' : 'Sin contenido de texto')}
              </p>
            </div>
          </div>
        </div>

        {/* Buscador de Chats */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por paciente, teléfono o mensaje..."
              className="w-full bg-[#162340] border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Chips de Destinatarios Seleccionados */}
          {selectedConvIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 animate-in fade-in">
              {selectedConvIds.map((cId) => {
                const convObj = conversaciones.find((c) => c.id === cId)
                const pacObj = getConvPatient(convObj)
                return (
                  <span
                    key={cId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] bg-indigo-950 border border-indigo-600/50 text-indigo-200 font-medium"
                  >
                    <span className="truncate max-w-[130px]">{pacObj.nombre}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectConv(cId)}
                      className="hover:text-white p-0.5 rounded-full hover:bg-indigo-800/60 ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Lista de Conversaciones Disponibles */}
        <div className="px-5 py-2 overflow-y-auto flex-1 space-y-1.5 min-h-[220px]">
          {filteredConversaciones.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
              <User size={28} className="text-slate-600 mb-2 opacity-60" />
              <p>No se encontraron conversaciones que coincidan con la búsqueda.</p>
            </div>
          ) : (
            filteredConversaciones.map((conv) => {
              const pac = getConvPatient(conv)
              const isSelected = selectedConvIds.includes(conv.id)
              const isWindowOpen = conv.is_window_open ?? false

              return (
                <div
                  key={conv.id}
                  onClick={() => toggleSelectConv(conv.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
                      : 'bg-[#142038]/60 border-slate-800/80 hover:bg-[#162340] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    {/* Checkbox Visual */}
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'border-slate-600 bg-slate-800/60'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>

                    {/* Avatar Iniciales */}
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                      {pac.nombre ? pac.nombre.slice(0, 2).toUpperCase() : 'PA'}
                    </div>

                    {/* Info Contacto */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-100 truncate">
                        {pac.nombre || 'Paciente Sin Nombre'}
                      </p>
                      <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone size={10} className="text-slate-500" />
                          {pac.telefono || conv.wa_chat_id || 'Sin teléfono'}
                        </span>
                        {conv.ultimo_mensaje && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px] italic opacity-80">
                              {conv.ultimo_mensaje}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Estado de Ventana de 24 Horas */}
                  <div className="shrink-0">
                    {isWindowOpen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-950/70 border border-emerald-600/40 text-emerald-300">
                        <Sparkles size={10} className="text-emerald-400" />
                        24h Abierta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-slate-900 border border-slate-700 text-slate-400">
                        <Clock size={10} className="text-slate-500" />
                        24h Vencida
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Advertencia / Opción para Ventana de 24h Vencida */}
        {hasSelectedWithClosedWindow && (
          <div className="px-5 py-2 bg-amber-950/30 border-t border-amber-900/40">
            <label className="flex items-start gap-2.5 text-[11px] text-amber-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={comoNotaInternaSiCerrada}
                onChange={(e) => setComoNotaInternaSiCerrada(e.target.checked)}
                className="rounded border-amber-600 text-indigo-600 focus:ring-0 mt-0.5"
              />
              <span className="leading-tight">
                <strong>Chats con Ventana 24h vencida</strong>: Meta no permite texto libre directo sin plantilla. Guardar el reenvío como <span className="underline decoration-amber-400">Nota Interna privada</span> en esos chats para consulta del equipo.
              </span>
            </label>
          </div>
        )}

        {/* Feedback de Error o Éxito */}
        {errorMsg && (
          <div className="px-5 py-2 bg-rose-950/60 border-t border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-5 py-2 bg-emerald-950/60 border-t border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Barra de Acciones Inferior */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-[#162036]">
          <span className="text-xs text-slate-400 font-medium">
            {selectedConvIds.length === 0
              ? 'Ningún chat seleccionado'
              : `${selectedConvIds.length} ${selectedConvIds.length === 1 ? 'chat seleccionado' : 'chats seleccionados'}`}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleExecuteForward}
              disabled={enviando || selectedConvIds.length === 0}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                enviando || selectedConvIds.length === 0
                  ? 'bg-indigo-600/50 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
              }`}
            >
              {enviando ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Reenviando...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Reenviar</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
