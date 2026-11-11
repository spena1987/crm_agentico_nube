'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Sparkles, Loader2, Volume2 } from 'lucide-react'

interface ChatVoicePlayerProps {
  mediaUrl: string
  mensajeId?: string
  transcripcionPrevia?: string | null
  onTranscribeRequest?: (mensajeId: string) => Promise<string | null>
}

export function ChatVoicePlayer({
  mediaUrl,
  mensajeId,
  transcripcionPrevia,
  onTranscribeRequest,
}: ChatVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [transcripcion, setTranscripcion] = useState<string | null>(transcripcionPrevia || null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showTranscription, setShowTranscription] = useState(Boolean(transcripcionPrevia))

  // Cargar preferencia de velocidad persistida
  useEffect(() => {
    try {
      const savedRate = localStorage.getItem('vortix_audio_playback_rate')
      if (savedRate) {
        const rate = parseFloat(savedRate)
        if ([1, 1.5, 2].includes(rate)) {
          setPlaybackRate(rate)
        }
      }
    } catch {
      // Ignorar error de storage
    }
  }, [])

  // Sincronizar velocidad en el elemento de audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {
        setIsPlaying(false)
      })
    }
  }

  const handleCycleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1
    setPlaybackRate(nextRate)
    try {
      localStorage.setItem('vortix_audio_playback_rate', String(nextRate))
    } catch {
      // Ignorar error de storage
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return
    const dur = audioRef.current.duration
    if (dur && !isNaN(dur) && isFinite(dur)) {
      setDuration(dur)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newPct = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = newPct * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleTranscribeClick = async () => {
    if (transcripcion) {
      setShowTranscription(!showTranscription)
      return
    }
    if (!mensajeId || !onTranscribeRequest) return
    try {
      setIsTranscribing(true)
      const res = await onTranscribeRequest(mensajeId)
      if (res) {
        setTranscripcion(res)
        setShowTranscription(true)
      }
    } finally {
      setIsTranscribing(false)
    }
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-[280px] sm:max-w-[320px] select-none">
      <audio
        ref={audioRef}
        src={mediaUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-750/70 px-3 py-2 rounded-xl backdrop-blur-sm shadow-inner">
        {/* Botón Circular Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-transform active:scale-95 shadow-md flex-shrink-0"
          title={isPlaying ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Scrubber y Tiempos */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div
            onClick={handleSeek}
            className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden cursor-pointer relative group"
          >
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-75 relative"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration || 0)}</span>
          </div>
        </div>

        {/* Píldora de Velocidad 1x / 1.5x / 2x */}
        <button
          type="button"
          onClick={handleCycleSpeed}
          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-[11px] font-semibold border border-slate-700/70 transition-colors flex-shrink-0"
          title="Cambiar velocidad de reproducción"
        >
          {playbackRate}x
        </button>

        {/* Botón de Transcripción IA */}
        {onTranscribeRequest && (
          <button
            type="button"
            onClick={handleTranscribeClick}
            disabled={isTranscribing}
            className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
              transcripcion
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
            title={transcripcion ? 'Ver/Ocultar transcripción IA' : 'Transcribir nota de voz con Gemini IA'}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Caja desplegable de transcripción */}
      {showTranscription && transcripcion && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-200/90 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1 text-[11px]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transcripción Gemini IA</span>
          </div>
          <p className="italic font-sans">"{transcripcion}"</p>
        </div>
      )}
    </div>
  )
}
