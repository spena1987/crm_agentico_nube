'use client'

import React, { useEffect, useRef, useState } from 'react'
import { 
  Mail, 
  MailCheck, 
  Pin, 
  PinOff, 
  Archive, 
  ArchiveRestore, 
  Bot, 
  User, 
  Copy, 
  FileText, 
  Trash2, 
  Check 
} from 'lucide-react'

interface ChatContactContextMenuProps {
  conversacion: any
  position: { x: number; y: number }
  onClose: () => void
  onToggleUnread: (conv: any) => void | Promise<any>
  onTogglePin: (conv: any) => void | Promise<any>
  onToggleArchive: (conv: any) => void | Promise<any>
  onToggleBot: (conv: any) => void | Promise<any>
  onCopyPhone: (phone: string) => void
  onOpenPatientFile: (conv: any) => void
  onDelete: (conv: any) => void | Promise<any>
}

export default function ChatContactContextMenu({
  conversacion,
  position,
  onClose,
  onToggleUnread,
  onTogglePin,
  onToggleArchive,
  onToggleBot,
  onCopyPhone,
  onOpenPatientFile,
  onDelete
}: ChatContactContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x: position.x, y: position.y })
  const [copied, setCopied] = useState(false)

  const isUnread = (conversacion.unread_count || 0) > 0
  const isPinned = Boolean(conversacion.metadata_json?.is_pinned)
  const isArchived = Boolean(conversacion.archivada)
  const isBotDisabled = Boolean(conversacion.bot_disabled)

  const paciente = Array.isArray(conversacion.pacientes)
    ? conversacion.pacientes[0]
    : conversacion.pacientes || {}

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
    if (paciente.telefono) {
      onCopyPhone(paciente.telefono)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        onClose()
      }, 400)
    }
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      <div
        ref={menuRef}
        style={{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px` }}
        className="pointer-events-auto absolute bg-[#162340] border border-slate-700/80 shadow-2xl rounded-2xl p-1.5 min-w-[230px] max-w-[290px] text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5 z-50 text-slate-200"
      >
        {/* Encabezado con Nombre del Contacto */}
        <div className="px-3 py-1.5 border-b border-slate-700/50 mb-0.5">
          <p className="font-bold text-slate-100 truncate text-[11.5px]">
            {paciente.nombre || 'Paciente'}
          </p>
          <span className="text-[10px] text-slate-400 font-mono">
            {paciente.telefono || 'Sin teléfono'}
          </span>
        </div>

        {/* 1. Marcar como no leído / Marcar como leído */}
        <button
          type="button"
          onClick={() => {
            onToggleUnread(conversacion)
            onClose()
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-600/20 hover:text-emerald-300 transition-colors text-left w-full cursor-pointer font-medium"
        >
          {isUnread ? (
            <>
              <MailCheck size={15} className="text-emerald-400 shrink-0" />
              <span>Marcar como leído</span>
            </>
          ) : (
            <>
              <Mail size={15} className="text-emerald-400 shrink-0" />
              <span>Marcar como no leído</span>
            </>
          )}
        </button>

        {/* 2. Fijar / Desfijar Conversación */}
        <button
          type="button"
          onClick={() => {
            onTogglePin(conversacion)
            onClose()
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600/20 hover:text-blue-300 transition-colors text-left w-full cursor-pointer font-medium"
        >
          {isPinned ? (
            <>
              <PinOff size={15} className="text-blue-400 shrink-0" />
              <span>Desfijar conversación</span>
            </>
          ) : (
            <>
              <Pin size={15} className="text-blue-400 shrink-0" />
              <span>Fijar conversación</span>
            </>
          )}
        </button>

        {/* 3. Archivar / Desarchivar */}
        <button
          type="button"
          onClick={() => {
            onToggleArchive(conversacion)
            onClose()
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-700/60 transition-colors text-left w-full cursor-pointer font-medium"
        >
          {isArchived ? (
            <>
              <ArchiveRestore size={15} className="text-slate-400 shrink-0" />
              <span>Reabrir conversación</span>
            </>
          ) : (
            <>
              <Archive size={15} className="text-slate-400 shrink-0" />
              <span>Archivar / Resolver</span>
            </>
          )}
        </button>

        {/* 4. Alternar Bot Gemini / Atención Humana */}
        <button
          type="button"
          onClick={() => {
            onToggleBot(conversacion)
            onClose()
          }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left w-full cursor-pointer font-medium ${
            isBotDisabled
              ? 'hover:bg-emerald-600/20 hover:text-emerald-300'
              : 'hover:bg-rose-600/20 hover:text-rose-300'
          }`}
        >
          {isBotDisabled ? (
            <>
              <Bot size={15} className="text-emerald-400 shrink-0" />
              <span>Activar Bot Gemini</span>
            </>
          ) : (
            <>
              <User size={15} className="text-rose-400 shrink-0" />
              <span>Pausar Bot (Atención Humana)</span>
            </>
          )}
        </button>

        {/* Separador */}
        <div className="h-px bg-slate-700/50 my-0.5" />

        {/* 5. Copiar Teléfono */}
        {paciente.telefono && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-700/60 transition-colors text-left w-full cursor-pointer font-medium"
          >
            {copied ? (
              <>
                <Check size={15} className="text-emerald-400 shrink-0" />
                <span className="text-emerald-300 font-semibold">¡Teléfono copiado!</span>
              </>
            ) : (
              <>
                <Copy size={15} className="text-slate-400 shrink-0" />
                <span>Copiar teléfono</span>
              </>
            )}
          </button>
        )}

        {/* 6. Ver Ficha 360° / Historia Clínica */}
        {paciente.id && (
          <button
            type="button"
            onClick={() => {
              onOpenPatientFile(conversacion)
              onClose()
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-600/20 hover:text-blue-300 transition-colors text-left w-full cursor-pointer font-medium"
          >
            <FileText size={15} className="text-blue-400 shrink-0" />
            <span>Ver Ficha 360°</span>
          </button>
        )}

        {/* 7. Eliminar Conversación */}
        <button
          type="button"
          onClick={() => {
            onDelete(conversacion)
            onClose()
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-600/20 hover:text-red-300 transition-colors text-left w-full cursor-pointer font-medium text-slate-400 hover:text-red-400"
        >
          <Trash2 size={15} className="text-red-400 shrink-0" />
          <span>Eliminar chat</span>
        </button>
      </div>
    </div>
  )
}
