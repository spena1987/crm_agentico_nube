'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Smile, X } from 'lucide-react'

const EMOJI_CATEGORIES = [
  {
    name: 'Clínica y Turnos',
    emojis: ['🩺', '🏥', '💊', '💉', '🩹', '📅', '⏰', '📍', '📄', '📝', '📋', '✅', '👨‍⚕️', '👩‍⚕️']
  },
  {
    name: 'Saludos y Comunicación',
    emojis: ['👋', '😊', '🤝', '👍', '🙏', '❤️', '🙌', '💬', '📞', '💡', '⚠️', '⭐', '✨']
  }
]

interface ChatEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void
}

export default function ChatEmojiPicker({ onSelectEmoji }: ChatEmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-[#14203d] hover:bg-[#1c2c54] border border-slate-700/60 rounded-xl text-slate-300 hover:text-amber-300 transition-colors shrink-0 disabled:opacity-50 mb-0.5"
        title="Insertar Emoji"
      >
        <Smile size={18} />
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 z-50 bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl p-3 w-64 text-slate-100 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200">Emojis Frecuentes</span>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-3 max-h-48 overflow-y-auto panel-scroll pr-1">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">{cat.name}</p>
                <div className="grid grid-cols-7 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onSelectEmoji(emoji)
                        setIsOpen(false)
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-base flex items-center justify-center transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
