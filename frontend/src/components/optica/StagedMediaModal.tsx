'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Send, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

interface StagedMediaModalProps {
  file: File | null
  previewUrl: string | null
  isOpen: boolean
  isUploading: boolean
  onClose: () => void
  onSend: (file: File, caption: string) => Promise<void>
}

export function StagedMediaModal({
  file,
  previewUrl,
  isOpen,
  isUploading,
  onClose,
  onSend,
}: StagedMediaModalProps) {
  const [caption, setCaption] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setCaption('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape' && !isUploading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isUploading, onClose])

  if (!isOpen || !file) return null

  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleConfirmSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isUploading) return
    await onSend(file, caption.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            {isImage ? (
              <ImageIcon className="w-5 h-5 text-emerald-400" />
            ) : (
              <FileText className="w-5 h-5 text-blue-400" />
            )}
            <span>{isImage ? 'Enviar Imagen' : isPdf ? 'Enviar Documento PDF' : 'Enviar Archivo'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Preview */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-950/60 min-h-[240px] max-h-[360px] overflow-hidden">
          {isImage && previewUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="max-h-[260px] max-w-full object-contain rounded-lg border border-slate-800 shadow-md"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 max-w-xs truncate">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">{formatFileSize(file.size)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Input de Caption y Acciones */}
        <form onSubmit={handleConfirmSend} className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escribe un mensaje explicativo (opcional)..."
              disabled={isUploading}
              className="flex-1 bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
            <span>Presiona Enter para enviar • Esc para cancelar</span>
            <span>{formatFileSize(file.size)}</span>
          </div>
        </form>
      </div>
    </div>
  )
}
