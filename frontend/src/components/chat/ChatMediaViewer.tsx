'use client'

import React, { useState } from 'react'
import { 
  FileText, 
  Download, 
  Play, 
  Pause, 
  Volume2, 
  Maximize2, 
  X, 
  MapPin, 
  ExternalLink,
  Check,
  CheckCheck,
  Sparkles,
  Copy,
  Loader2
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface MediaMetadata {
  tipo?: 'imagen' | 'audio' | 'documento' | 'sticker' | 'video' | 'ubicacion' | 'contacto' | 'texto'
  media_url?: string
  relative_url?: string
  file_name?: string
  file_size_bytes?: number
  mime_type?: string
  caption?: string
  duration_seconds?: number
  is_voice_note?: boolean
  transcripcion?: string
  latitud?: number
  longitud?: number
  nombre?: string
  maps_url?: string
  vcard?: string
  delivery_status?: 'enviado' | 'entregado' | 'leido'
  reactions?: Array<{ emisor: string; emoji: string; timestamp?: string }>
  [key: string]: any
}

interface ChatMediaViewerProps {
  metadata?: MediaMetadata
  isOperator?: boolean
  mensajeId?: string
  onTranscribeSuccess?: (mensajeId: string, transcripcion: string) => void
}

export default function ChatMediaViewer({ metadata, isOperator, mensajeId, onTranscribeSuccess }: ChatMediaViewerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [transcribiendo, setTranscribiendo] = useState(false)
  const [transcripcionLocal, setTranscripcionLocal] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  if (!metadata || !metadata.tipo || metadata.tipo === 'texto') {
    return null
  }

  // Resolver URL del archivo multimedia
  const getFullUrl = (url?: string, relUrl?: string, dataUri?: string) => {
    if (dataUri && (dataUri.startsWith('data:') || dataUri.startsWith('blob:'))) {
      return dataUri
    }
    let target = relUrl || url
    if (!target) return ''
    if (target.startsWith('data:') || target.startsWith('blob:')) return target
    
    // Sanear URLs que vengan con localhost o 127.0.0.1 para que apunten al dominio de producción
    if (target.includes('localhost') || target.includes('127.0.0.1')) {
      const match = target.match(/\/static\/.+/)
      if (match) {
        target = match[0]
      }
    }

    if (target.startsWith('http://') || target.startsWith('https://')) {
      return target
    }

    const cleanRel = target.startsWith('/') ? target : `/${target}`
    return `${BACKEND_URL}${cleanRel}`
  }

  const mediaUrl = getFullUrl(metadata.media_url, metadata.relative_url, metadata.data_uri || metadata.base64)
  const textoTranscrito = metadata.transcripcion || transcripcionLocal

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleTranscribir = async () => {
    if (!mensajeId || transcribiendo) return
    setTranscribiendo(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/mensajes/${mensajeId}/transcribir`, {
        method: 'POST'
      })
      if (!res.ok) {
        throw new Error('Error en el servidor al transcribir audio')
      }
      const data = await res.json()
      if (data.transcripcion) {
        setTranscripcionLocal(data.transcripcion)
        if (onTranscribeSuccess) {
          onTranscribeSuccess(mensajeId, data.transcripcion)
        }
      }
    } catch (err) {
      console.error('Error transcribiendo audio:', err)
      alert('No se pudo transcribir el audio en este momento.')
    } finally {
      setTranscribiendo(false)
    }
  }

  const handleCopyTranscript = () => {
    if (!textoTranscrito) return
    navigator.clipboard.writeText(textoTranscrito)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const isPurged = Boolean(metadata.media_purged)

  return (
    <div className="mt-1 space-y-2">
      {/* 1. IMAGEN */}
      {metadata.tipo === 'imagen' && (
        isPurged ? (
          <div className="p-2.5 rounded-xl border border-slate-700/60 bg-[#111a30] text-slate-300 text-xs flex items-center gap-2 max-w-xs">
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
              <Maximize2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-200 truncate">{metadata.caption || metadata.file_name || 'Imagen adjunta'}</p>
              <span className="text-[10px] text-slate-400">Archivo depurado por política de 30 días</span>
            </div>
          </div>
        ) : mediaUrl ? (
          <div>
            <div 
              onClick={() => setModalOpen(true)}
              className="relative rounded-xl overflow-hidden cursor-pointer group border border-slate-700/60 shadow-sm max-w-xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={mediaUrl} 
                alt={metadata.caption || metadata.file_name || 'Imagen de WhatsApp'}
                className="w-full max-h-64 object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Maximize2 size={20} />
              </div>
            </div>

            {/* Modal Lightbox para Zoom de imagen médica */}
            {modalOpen && (
              <div 
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setModalOpen(false)}
              >
                <div 
                  className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2 flex flex-col items-center shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full flex items-center justify-between p-2 text-white border-b border-slate-800 mb-2">
                    <span className="text-xs font-semibold truncate max-w-md">
                      {metadata.caption || metadata.file_name || 'Estudio / Imagen Médica'}
                    </span>
                    <div className="flex items-center gap-2">
                      <a 
                        href={mediaUrl} 
                        download={metadata.file_name || 'imagen.jpg'}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                        title="Descargar imagen"
                      >
                        <Download size={16} />
                      </a>
                      <button 
                        onClick={() => setModalOpen(false)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={mediaUrl} 
                    alt="Vista ampliada" 
                    className="max-h-[75vh] w-auto object-contain rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        ) : null
      )}

      {/* 2. AUDIO / NOTA DE VOZ CON TRANSCRIPCIÓN IA */}
      {metadata.tipo === 'audio' && (
        isPurged ? (
          <div className="p-3 rounded-2xl border border-slate-700/60 bg-[#0e1629] text-slate-100 min-w-[260px] max-w-sm shadow-sm">
            <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold text-slate-400 mb-1.5 pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Volume2 size={13} className="text-slate-400" /> Nota de voz ({metadata.duration_seconds ? `${metadata.duration_seconds}s` : 'WhatsApp'})
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                Audio depurado &gt; 30d
              </span>
            </div>
            
            {textoTranscrito ? (
              <div className="mt-1 p-2.5 rounded-xl bg-[#080d1a] border border-blue-500/30 text-xs shadow-inner">
                <div className="flex items-center justify-between gap-1 mb-1 text-[10px] font-bold text-blue-300">
                  <span className="flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-400" /> Transcripción Preservada
                  </span>
                  <button 
                    onClick={handleCopyTranscript}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-800 transition-colors"
                    title="Copiar texto"
                  >
                    {copiado ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-slate-200 leading-relaxed font-sans select-text">
                  "{textoTranscrito}"
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Audio archivado</p>
            )}
          </div>
        ) : mediaUrl ? (
          <div className={`p-3 rounded-2xl border flex flex-col gap-2 min-w-[260px] max-w-sm ${
            isOperator 
              ? 'bg-blue-700/40 border-blue-500/40 text-white' 
              : 'bg-[#121c33] border-slate-700/80 text-slate-100'
          }`}>
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold opacity-90">
              <div className="flex items-center gap-1.5 text-blue-300">
                <Volume2 size={15} />
                <span>{metadata.is_voice_note ? 'Nota de voz' : 'Audio'}</span>
              </div>
              {metadata.duration_seconds ? (
                <span className="text-slate-400">{Math.floor(metadata.duration_seconds / 60)}:{String(metadata.duration_seconds % 60).padStart(2, '0')}</span>
              ) : null}
            </div>
            
            <audio 
              controls 
              src={mediaUrl} 
              className="w-full h-8 rounded-lg mt-0.5"
              preload="metadata"
            />

            {/* Bloque de Transcripción / Botón Transcribir */}
            {textoTranscrito ? (
              <div className="mt-1 p-2.5 rounded-xl bg-[#0b1326] border border-blue-500/30 text-slate-100 text-xs shadow-inner">
                <div className="flex items-center justify-between gap-1 mb-1.5 text-[10px] font-bold text-blue-300">
                  <span className="flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-400" /> Transcripción IA (Gemini)
                  </span>
                  <button 
                    onClick={handleCopyTranscript}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-800 transition-colors"
                    title="Copiar texto"
                  >
                    {copiado ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-slate-200 leading-relaxed font-sans select-text">
                  "{textoTranscrito}"
                </p>
              </div>
            ) : (
              <button
                onClick={handleTranscribir}
                disabled={transcribiendo || !mensajeId}
                className="mt-1 w-full py-1.5 px-3 rounded-xl bg-[#182647] hover:bg-[#20335e] border border-blue-500/40 text-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                title="Transcribir este audio automáticamente con Google Gemini"
              >
                {transcribiendo ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-blue-400" />
                    <span>Transcribiendo con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Transcribir Audio (IA)</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : null
      )}

      {/* 3. DOCUMENTO / PDF DE ESTUDIOS */}
      {metadata.tipo === 'documento' && (
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 min-w-[220px] max-w-sm ${
          isOperator 
            ? 'bg-blue-700/60 border-blue-500/50 text-white' 
            : 'bg-white dark:bg-slate-800 border-[var(--border)] text-[var(--foreground)] shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500 shrink-0">
              <FileText size={20} />
            </div>
            <div className="truncate min-w-0">
              <p className="text-xs font-bold truncate leading-tight" title={metadata.file_name}>
                {metadata.file_name || 'Documento adjunto'}
              </p>
              <span className="text-[10px] opacity-70">
                {formatFileSize(metadata.file_size_bytes) || 'PDF / Documento'}
              </span>
            </div>
          </div>

          {mediaUrl && (
            <a
              href={mediaUrl}
              download={metadata.file_name || 'documento.pdf'}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                isOperator 
                  ? 'hover:bg-blue-600 text-white' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600'
              }`}
              title="Descargar archivo"
            >
              <Download size={15} />
            </a>
          )}
        </div>
      )}

      {/* 4. STICKER */}
      {metadata.tipo === 'sticker' && mediaUrl && (
        <div className="max-w-[120px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={mediaUrl} 
            alt="Sticker" 
            className="w-28 h-28 object-contain hover:scale-110 transition-transform"
          />
        </div>
      )}

      {/* 5. UBICACIÓN */}
      {metadata.tipo === 'ubicacion' && (
        <a
          href={metadata.maps_url || `https://maps.google.com/?q=${metadata.latitud},${metadata.longitud}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors"
        >
          <MapPin size={16} className="text-blue-600 shrink-0" />
          <span className="truncate max-w-[200px]">{metadata.nombre || 'Ver en Google Maps'}</span>
          <ExternalLink size={12} className="shrink-0 opacity-60" />
        </a>
      )}

      {/* 6. BADGE DE REACCIONES */}
      {metadata.reactions && metadata.reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {metadata.reactions.map((r, i) => (
            <span 
              key={i} 
              className="px-1.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] shadow-xs"
              title={`Reacción de ${r.emisor}`}
            >
              {r.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function DeliveryStatusIcon({ status }: { status?: 'enviado' | 'entregado' | 'leido' | string }) {
  const normStatus = (status || 'enviado').toLowerCase()

  if (normStatus === 'leido' || normStatus === 'read' || normStatus === 'played') {
    return (
      <span title="Leído por el paciente (doble tilde azul)" className="inline-flex items-center">
        <CheckCheck size={14} className="text-cyan-400 font-bold shrink-0 ml-1 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]" />
      </span>
    )
  }

  if (normStatus === 'entregado' || normStatus === 'delivered') {
    return (
      <span title="Entregado al teléfono del paciente (doble tilde gris)" className="inline-flex items-center">
        <CheckCheck size={14} className="text-slate-300 opacity-85 shrink-0 ml-1" />
      </span>
    )
  }

  return (
    <span title="Enviado a los servidores de WhatsApp (1 tilde gris)" className="inline-flex items-center">
      <Check size={14} className="text-slate-300 opacity-80 shrink-0 ml-1" />
    </span>
  )
}
