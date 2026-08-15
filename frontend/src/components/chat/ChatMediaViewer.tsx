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
  CheckCheck
} from 'lucide-react'

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
}

export default function ChatMediaViewer({ metadata, isOperator }: ChatMediaViewerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  if (!metadata || !metadata.tipo || metadata.tipo === 'texto') {
    return null
  }

  // Resolver URL del archivo multimedia
  const getFullUrl = (url?: string, relUrl?: string) => {
    const target = url || relUrl
    if (!target) return ''
    if (target.startsWith('http')) return target
    return `http://localhost:8000${target.startsWith('/') ? '' : '/'}${target}`
  }

  const mediaUrl = getFullUrl(metadata.media_url, metadata.relative_url)
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="mt-1 space-y-2">
      {/* 1. IMAGEN */}
      {metadata.tipo === 'imagen' && mediaUrl && (
        <div>
          <div 
            onClick={() => setModalOpen(true)}
            className="relative rounded-xl overflow-hidden cursor-pointer group border border-black/10 shadow-sm max-w-xs"
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
                className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden p-2 flex flex-col items-center"
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
      )}

      {/* 2. AUDIO / NOTA DE VOZ */}
      {metadata.tipo === 'audio' && mediaUrl && (
        <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 min-w-[240px] ${
          isOperator 
            ? 'bg-blue-700/50 border-blue-500/40 text-white' 
            : 'bg-slate-100 dark:bg-slate-800/80 border-[var(--border)] text-[var(--foreground)]'
        }`}>
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold opacity-90">
            <div className="flex items-center gap-1.5">
              <Volume2 size={14} />
              <span>{metadata.is_voice_note ? 'Nota de voz' : 'Audio'}</span>
            </div>
            {metadata.duration_seconds ? (
              <span>{Math.floor(metadata.duration_seconds / 60)}:{String(metadata.duration_seconds % 60).padStart(2, '0')}</span>
            ) : null}
          </div>
          <audio 
            controls 
            src={mediaUrl} 
            className="w-full h-8 rounded mt-1"
            preload="metadata"
          />
        </div>
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

export function DeliveryStatusIcon({ status }: { status?: 'enviado' | 'entregado' | 'leido' }) {
  if (!status) return null

  if (status === 'leido') {
    return (
      <span title="Leído (doble tilde azul)" className="inline-flex items-center">
        <CheckCheck size={13} className="text-cyan-300 shrink-0 ml-1" />
      </span>
    )
  }

  if (status === 'entregado') {
    return (
      <span title="Entregado (doble tilde gris)" className="inline-flex items-center">
        <CheckCheck size={13} className="opacity-70 shrink-0 ml-1" />
      </span>
    )
  }

  return (
    <span title="Enviado al servidor" className="inline-flex">
      <Check size={13} className="opacity-70 shrink-0 ml-1" />
    </span>
  )
}
