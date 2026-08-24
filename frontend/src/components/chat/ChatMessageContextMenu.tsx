'use client'

import React, { useEffect, useRef, useState } from 'react'
import { 
  Reply, 
  Copy, 
  FileText, 
  Lock, 
  Trash2, 
  Check
} from 'lucide-react'

export interface Mensaje {
  id: string
  conversacion_id: string
  emisor: 'paciente' | 'operador' | 'bot'
  contenido: string
  created_at: string
  metadata_json?: any
}

interface ChatMessageContextMenuProps {
  message: any
  position: { x: number; y: number }
  onClose: () => void
  onReply: (msg: any) => void
  onCopy: (text: string) => void
  onReact: (msg: any, emoji: string) => void | Promise<any>
  onSaveClinicalNote: (msg: any) => void | Promise<any>
  onConvertToInternalNote: (msg: any) => void | Promise<any>
  onDelete: (msg: any) => void | Promise<any>
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export default function ChatMessageContextMenu({
  message,
  position,
  onClose,
  onReply,
  onCopy,
  onReact,
  onSaveClinicalNote,
  onConvertToInternalNote,
  onDelete
}: ChatMessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x: position.x, y: position.y })
  const [copied, setCopied] = useState(false)

  // Ajustar posición si el menú se sale de la pantalla
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const padding = 16
    let newX = position.x
    let newY = position.y

    if (newX + rect.width > window.innerWidth - padding) {
      newX = window.innerWidth - rect.width - padding
    }
    if (newX < padding) newX = padding

    if (newY + rect.height > window.innerHeight - padding) {
      newY = window.innerHeight - rect.height - padding
    }
    if (newY < padding) newY = padding

    setAdjustedPos({ x: newX, y: newY })
  }, [position])

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  const handleCopy = () => {
    onCopy(message.contenido)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      onClose()
    }, 400)
  }

  const isInternal = Boolean(message.metadata_json?.is_internal_note || message.metadata_json?.tipo === 'nota_interna')

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      <div
        ref={menuRef}
        style={{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px` }}
        className="pointer-events-auto absolute bg-[#162340] border border-slate-700/80 shadow-2xl rounded-2xl p-1.5 min-w-[220px] max-w-[280px] text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 z-50 text-slate-200"
      >
        {/* Barra Superior: Reacciones Rápidas de Emojis */}
        {!isInternal && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-[#0e172a] rounded-xl border border-slate-800 mb-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(message, emoji)
                  onClose()
                }}
                className="hover:scale-125 active:scale-95 transition-transform text-base p-1 rounded-lg hover:bg-slate-700/50 cursor-pointer"
                title={`Reaccionar con ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Acciones Principales */}
        <div className="flex flex-col gap-0.5">
          {/* 1. Responder / Citar */}
          <button
            type="button"
            onClick={() => {
              onReply(message)
              onClose()
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600/20 hover:text-blue-300 transition-colors text-left w-full cursor-pointer font-medium"
          >
            <Reply size={15} className="text-blue-400 shrink-0" />
            <span>Responder</span>
          </button>

          {/* 2. Copiar Texto */}
          {message.contenido && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-700/60 transition-colors text-left w-full cursor-pointer font-medium"
            >
              {copied ? (
                <>
                  <Check size={15} className="text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-semibold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={15} className="text-slate-400 shrink-0" />
                  <span>Copiar texto</span>
                </>
              )}
            </button>
          )}

          {/* Separador */}
          <div className="h-px bg-slate-700/50 my-0.5" />

          {/* 3. Guardar en Ficha Clínica 360° */}
          <button
            type="button"
            onClick={() => {
              onSaveClinicalNote(message)
              onClose()
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-600/20 hover:text-emerald-300 transition-colors text-left w-full cursor-pointer font-medium"
            title="Añade este texto al historial de notas clínicas del paciente"
          >
            <FileText size={15} className="text-emerald-400 shrink-0" />
            <span>Guardar en Ficha Clínica</span>
          </button>

          {/* 4. Convertir a Nota Interna Médica */}
          {!isInternal && (
            <button
              type="button"
              onClick={() => {
                onConvertToInternalNote(message)
                onClose()
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-amber-600/20 hover:text-amber-300 transition-colors text-left w-full cursor-pointer font-medium"
              title="Crea una nota interna privada con el contenido de este mensaje"
            >
              <Lock size={15} className="text-amber-400 shrink-0" />
              <span>Convertir a Nota Interna</span>
            </button>
          )}

          {/* 5. Eliminar Mensaje */}
          <button
            type="button"
            onClick={() => {
              onDelete(message)
              onClose()
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-600/20 hover:text-red-300 transition-colors text-left w-full cursor-pointer font-medium text-slate-400 hover:text-red-400"
          >
            <Trash2 size={15} className="text-red-400 shrink-0" />
            <span>Eliminar mensaje</span>
          </button>
        </div>
      </div>
    </div>
  )
}
