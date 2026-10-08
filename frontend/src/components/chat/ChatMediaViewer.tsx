'use client'

import React, { useState } from 'react'
import { 
  FileText, 
  FileSpreadsheet,
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
  Loader2,
  AlertCircle,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Eye,
  UserCheck,
  Phone
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface MediaMetadata {
  tipo?: 'imagen' | 'audio' | 'documento' | 'sticker' | 'video' | 'ubicacion' | 'contacto' | 'texto' | 'reaction'
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
  direccion?: string
  maps_url?: string
  contact_name?: string
  contact_phone?: string
  contacts?: any[]
  vcard?: string
  delivery_status?: 'enviado' | 'entregado' | 'leido'
  reactions?: Array<{ emisor: string; emoji: string; timestamp?: string }>
  [key: string]: any
}

interface ChatMediaViewerProps {
  metadata?: MediaMetadata
  isOperator?: boolean
  mensajeId?: string
  contenidoTexto?: string
  onTranscribeSuccess?: (mensajeId: string, transcripcion: string) => void
}

export default function ChatMediaViewer({ 
  metadata: propMetadata, 
  isOperator, 
  mensajeId, 
  contenidoTexto,
  onTranscribeSuccess 
}: ChatMediaViewerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [rotacion, setRotacion] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [transcribiendo, setTranscribiendo] = useState(false)
  const [transcripcionLocal, setTranscripcionLocal] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [copiadoContacto, setCopiadoContacto] = useState(false)

  // Inferencia defensiva: Si metadata no tiene tipo pero el contenido o metadata indica un archivo
  let metadata: MediaMetadata = { ...(propMetadata || {}) }
  
  if (!metadata.tipo && contenidoTexto) {
    const txt = contenidoTexto.trim()
    if (txt.toLowerCase().endsWith('.pdf') || txt.toLowerCase().includes('.pdf')) {
      metadata.tipo = 'documento'
      metadata.file_name = metadata.file_name || txt
    } else if (txt.toLowerCase().endsWith('.docx') || txt.toLowerCase().endsWith('.doc')) {
      metadata.tipo = 'documento'
      metadata.file_name = metadata.file_name || txt
    } else if (txt.toLowerCase().endsWith('.xlsx') || txt.toLowerCase().endsWith('.xls')) {
      metadata.tipo = 'documento'
      metadata.file_name = metadata.file_name || txt
    } else if (txt.includes('📷') || txt.toLowerCase().includes('[foto]')) {
      metadata.tipo = 'imagen'
    } else if (txt.startsWith('📍 Ubicación:') || txt.includes('[LOCATION]')) {
      metadata.tipo = 'ubicacion'
    } else if (txt.startsWith('👤 Contacto:') || txt.includes('[CONTACTS]')) {
      metadata.tipo = 'contacto'
    }
  }

  if (!metadata || !metadata.tipo || metadata.tipo === 'texto' || metadata.tipo === 'reaction') {
    return null
  }

  // Resolver URL del archivo multimedia
  const getFullUrl = (url?: string, relUrl?: string, dataUri?: string) => {
    if (dataUri && (dataUri.startsWith('data:') || dataUri.startsWith('blob:'))) {
      return dataUri
    }

    // 1. Si existe URL absoluta pública (ej. Supabase Storage o CDN), priorizarla siempre
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      let cleanUrl = url.replace(/\?+$/, '')
      // Si por alguna razón vino con localhost o 127.0.0.1, redirigir a BACKEND_URL
      if (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1')) {
        const match = cleanUrl.match(/\/static\/.+/)
        if (match) {
          return `${BACKEND_URL}${match[0]}`
        }
      }
      return cleanUrl
    }

    // 2. Fallback a ruta relativa del backend local
    let target = relUrl || url
    if (!target) return ''
    if (target.startsWith('data:') || target.startsWith('blob:')) return target
    
    // Saneamiento de query params residuales (? al final)
    target = target.replace(/\?+$/, '')

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

  const handleCopyContactPhone = () => {
    const ph = metadata.contact_phone || ''
    if (!ph) return
    navigator.clipboard.writeText(ph)
    setCopiadoContacto(true)
    setTimeout(() => setCopiadoContacto(false), 2000)
  }

  const isPurged = Boolean(metadata.media_purged)

  // Obtener icono e identidad para tipos de documentos
  const getDocTypeInfo = (fileName?: string) => {
    const f = (fileName || '').toLowerCase()
    if (f.endsWith('.pdf')) {
      return { label: 'PDF', bgIcon: 'bg-red-500/15 text-red-500', isPdf: true }
    }
    if (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')) {
      return { label: 'Excel', bgIcon: 'bg-emerald-500/15 text-emerald-500', isExcel: true }
    }
    if (f.endsWith('.docx') || f.endsWith('.doc')) {
      return { label: 'Word', bgIcon: 'bg-blue-500/15 text-blue-500', isWord: true }
    }
    return { label: 'Documento', bgIcon: 'bg-indigo-500/15 text-indigo-400' }
  }

  return (
    <div className="mt-1 space-y-2">
      {/* 1. IMAGEN / ESTUDIO MÉDICO */}
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
              onClick={() => {
                setRotacion(0)
                setZoom(1)
                setModalOpen(true)
              }}
              className="relative rounded-xl overflow-hidden cursor-pointer group border border-slate-700/60 shadow-sm max-w-xs bg-slate-950/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={mediaUrl} 
                alt={metadata.caption || metadata.file_name || 'Imagen de WhatsApp'}
                className="w-full max-h-64 object-cover group-hover:scale-102 transition-transform duration-200"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2">
                <Maximize2 size={22} className="drop-shadow-md" />
                <span className="text-xs font-semibold drop-shadow-md">Ampliar</span>
              </div>
            </div>

            {/* Modal Lightbox con Zoom Panorámico y Rotación Médica (90°) */}
            {modalOpen && (
              <div 
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none"
                onClick={() => setModalOpen(false)}
              >
                <div 
                  className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col items-center shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Barra de herramientas superior */}
                  <div className="w-full flex items-center justify-between p-3 text-white border-b border-slate-800 bg-slate-950/70">
                    <span className="text-xs font-semibold truncate max-w-sm text-slate-200">
                      {metadata.caption || metadata.file_name || 'Estudio / Imagen Médica'}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {/* Botón Rotar 90° */}
                      <button
                        type="button"
                        onClick={() => setRotacion((prev) => (prev + 90) % 360)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs"
                        title="Rotar 90° (útil para recetas u órdenes médicas horizontales)"
                      >
                        <RotateCw size={15} />
                        <span className="text-[11px] hidden sm:inline">Rotar</span>
                      </button>

                      {/* Botones Zoom */}
                      <button
                        type="button"
                        onClick={() => setZoom((prev) => Math.min(prev + 0.25, 3))}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Acercar zoom"
                      >
                        <ZoomIn size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.75))}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title="Alejar zoom"
                      >
                        <ZoomOut size={15} />
                      </button>
                      {zoom !== 1 && (
                        <button
                          type="button"
                          onClick={() => setZoom(1)}
                          className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-[10px] text-blue-300 transition-colors"
                          title="Restablecer zoom normal"
                        >
                          100%
                        </button>
                      )}

                      <div className="h-4 w-px bg-slate-700 mx-1" />

                      {/* Botón Descargar */}
                      <a 
                        href={mediaUrl} 
                        download={metadata.file_name || 'imagen_medica.jpg'}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-emerald-400 transition-colors"
                        title="Descargar imagen en tamaño original"
                      >
                        <Download size={16} />
                      </a>

                      {/* Botón Cerrar */}
                      <button 
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-slate-400 transition-colors ml-1"
                        title="Cerrar visor"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  </div>

                  {/* Lienzo de imagen con transformaciones */}
                  <div className="w-full flex-1 min-h-[300px] max-h-[78vh] overflow-auto flex items-center justify-center p-4 bg-slate-950/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={mediaUrl} 
                      alt="Vista ampliada" 
                      style={{
                        transform: `rotate(${rotacion}deg) scale(${zoom})`,
                        transition: 'transform 0.2s ease-out'
                      }}
                      className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-lg select-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-slate-700/60 bg-[#111a30] text-slate-300 text-xs flex items-center gap-2.5 max-w-xs shadow-sm">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-200 truncate leading-snug">Foto médica</p>
              <span className="text-[10.5px] text-slate-400 leading-tight block">Imagen recibida por WhatsApp</span>
            </div>
          </div>
        )
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
      {metadata.tipo === 'documento' && (() => {
        const docInfo = getDocTypeInfo(metadata.file_name)
        return (
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 min-w-[240px] max-w-sm ${
            isOperator 
              ? 'bg-blue-700/60 border-blue-500/50 text-white shadow-sm' 
              : 'bg-white dark:bg-slate-800 border-[var(--border)] text-[var(--foreground)] shadow-sm'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={`p-2.5 rounded-xl ${docInfo.bgIcon} shrink-0`}>
                {docInfo.isExcel ? (
                  <FileSpreadsheet size={20} />
                ) : (
                  <FileText size={20} />
                )}
              </div>
              <div className="truncate min-w-0 flex-1">
                <p className="text-xs font-bold truncate leading-tight" title={metadata.file_name}>
                  {metadata.file_name || 'Documento adjunto'}
                </p>
                <div className="flex items-center gap-2 text-[10px] opacity-75 mt-0.5">
                  <span className="font-semibold uppercase tracking-wider">{docInfo.label}</span>
                  {metadata.file_size_bytes ? (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(metadata.file_size_bytes)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {mediaUrl ? (
              <div className="flex items-center gap-1 shrink-0">
                {/* Botón Ver / Abrir en pestaña */}
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-lg transition-colors ${
                    isOperator 
                      ? 'hover:bg-blue-600 text-white/90 hover:text-white' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  title="Abrir y previsualizar documento en nueva pestaña"
                >
                  <Eye size={15} />
                </a>

                {/* Botón Descargar */}
                <a
                  href={mediaUrl}
                  download={metadata.file_name || 'documento.pdf'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-lg transition-colors ${
                    isOperator 
                      ? 'hover:bg-blue-600 text-white' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400'
                  }`}
                  title="Descargar archivo en tu equipo"
                >
                  <Download size={15} />
                </a>
              </div>
            ) : (
              <span className="text-[10px] text-amber-500 font-medium px-2 py-1 rounded bg-amber-500/10 shrink-0">
                Adjunto
              </span>
            )}
          </div>
        )
      })()}

      {/* 3.5. VIDEO / GIF */}
      {metadata.tipo === 'video' && (
        isPurged ? (
          <div className="p-2.5 rounded-xl border border-slate-700/60 bg-[#111a30] text-slate-300 text-xs flex items-center gap-2 max-w-xs">
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
              <Play size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-200 truncate">{metadata.caption || metadata.file_name || 'Video / GIF'}</p>
              <span className="text-[10px] text-slate-400">Archivo depurado por política de 30 días</span>
            </div>
          </div>
        ) : mediaUrl ? (
          <div className="rounded-xl overflow-hidden max-w-xs border border-slate-700/60 shadow-sm bg-black/50">
            <video 
              src={mediaUrl} 
              controls={!metadata.is_gif} 
              autoPlay={Boolean(metadata.is_gif)} 
              loop={Boolean(metadata.is_gif)} 
              muted={Boolean(metadata.is_gif)} 
              playsInline 
              className="w-full max-h-64 object-cover rounded-xl"
            />
            {metadata.caption && (
              <p className="text-xs px-2.5 py-1.5 text-slate-200 bg-slate-900/80">{metadata.caption}</p>
            )}
          </div>
        ) : null
      )}

      {/* 4. STICKER */}
      {metadata.tipo === 'sticker' && (
        <div className="max-w-[130px] p-0.5">
          {mediaUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img 
              src={mediaUrl} 
              alt="Sticker WhatsApp" 
              className="w-28 h-28 object-contain hover:scale-105 transition-transform drop-shadow-md"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-slate-800/70 border border-slate-700/60 rounded-xl px-2.5 py-2 shadow-xs">
              <Sparkles size={16} className="text-amber-400 animate-pulse" />
              <span className="font-semibold">Sticker</span>
            </div>
          )}
        </div>
      )}

      {/* 5. UBICACIÓN */}
      {metadata.tipo === 'ubicacion' && (
        <a
          href={metadata.maps_url || `https://maps.google.com/?q=${metadata.latitud},${metadata.longitud}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 p-3 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 text-xs font-semibold hover:bg-blue-100/90 dark:hover:bg-blue-900/40 transition-all shadow-xs group max-w-sm"
        >
          <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
            <MapPin size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-bold block truncate text-slate-900 dark:text-slate-100">{metadata.nombre || 'Ubicación Compartida'}</span>
            {metadata.direccion && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{metadata.direccion}</span>
            )}
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1 mt-0.5">
              Ver en Google Maps <ExternalLink size={10} />
            </span>
          </div>
        </a>
      )}

      {/* 5.5. CONTACTO */}
      {metadata.tipo === 'contacto' && (
        <div className="p-3 rounded-xl border border-slate-700/60 bg-[#121c33] text-slate-100 text-xs flex items-center justify-between gap-3 min-w-[230px] max-w-sm shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400 shrink-0">
              <UserCheck size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-100 truncate text-xs">
                {metadata.contact_name || metadata.nombre || 'Contacto'}
              </p>
              {metadata.contact_phone && (
                <p className="text-[11px] text-slate-300 font-mono mt-0.5 truncate flex items-center gap-1">
                  <Phone size={11} className="text-teal-400" />
                  {metadata.contact_phone}
                </p>
              )}
            </div>
          </div>

          {metadata.contact_phone && (
            <button
              type="button"
              onClick={handleCopyContactPhone}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0 flex items-center gap-1"
              title="Copiar teléfono del contacto"
            >
              {copiadoContacto ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
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

export function DeliveryStatusIcon({ 
  status, 
  isPatientMessage = false 
}: { 
  status?: 'enviado' | 'entregado' | 'leido' | 'fallido' | string
  isPatientMessage?: boolean 
}) {
  const normStatus = (status || (isPatientMessage ? 'leido' : 'enviado')).toLowerCase()

  if (normStatus === 'fallido' || normStatus === 'failed' || normStatus === 'error') {
    return (
      <span title="Fallo en la entrega por WhatsApp" className="inline-flex items-center">
        <AlertCircle size={14} className="text-rose-400 font-bold shrink-0 ml-1 animate-pulse" />
      </span>
    )
  }

  if (normStatus === 'leido' || normStatus === 'read' || normStatus === 'played') {
    return (
      <span 
        title={isPatientMessage ? "Leído por el equipo médico del CRM" : "Leído por el paciente (doble tilde azul)"} 
        className="inline-flex items-center"
      >
        <CheckCheck size={14} className="text-cyan-300 font-bold shrink-0 ml-1 drop-shadow-[0_0_4px_rgba(103,232,249,0.9)]" />
      </span>
    )
  }

  if (normStatus === 'entregado' || normStatus === 'delivered') {
    return (
      <span 
        title={isPatientMessage ? "Recibido en el CRM (pendiente de lectura)" : "Entregado al teléfono del paciente (doble tilde blanca)"} 
        className="inline-flex items-center"
      >
        <CheckCheck size={14} className={isPatientMessage ? "text-slate-400 shrink-0 ml-1" : "text-white/90 shrink-0 ml-1 font-medium"} />
      </span>
    )
  }

  return (
    <span 
      title={isPatientMessage ? "Recibido en el CRM" : "Enviado a los servidores de WhatsApp (1 tilde blanca)"} 
      className="inline-flex items-center"
    >
      <Check size={14} className={isPatientMessage ? "text-slate-400 shrink-0 ml-1" : "text-white/80 shrink-0 ml-1"} />
    </span>
  )
}
