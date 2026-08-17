'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  Quote, 
  List, 
  ListOrdered 
} from 'lucide-react'

export interface ChatFloatingFormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  value: string
  onChange: (newValue: string) => void
}

type FormatAction = 'bold' | 'italic' | 'strike' | 'code' | 'quote' | 'bullet' | 'number'

export default function ChatFloatingFormatToolbar({
  textareaRef,
  value,
  onChange
}: ChatFloatingFormatToolbarProps) {
  const [showToolbar, setShowToolbar] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Detectar selección de texto
  const updateToolbarPosition = useCallback(() => {
    const input = textareaRef.current
    if (!input) {
      setShowToolbar(false)
      return
    }

    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0

    if (start === end || document.activeElement !== input) {
      setShowToolbar(false)
      return
    }

    const selectedText = input.value.substring(start, end).trim()
    if (!selectedText) {
      setShowToolbar(false)
      return
    }

    // Calcular posición del tooltip sobre el input
    const rect = input.getBoundingClientRect()
    const containerRect = input.parentElement?.getBoundingClientRect() || rect

    // Centrar horizontalmente respecto a la selección o el contenedor
    const leftOffset = Math.max(10, Math.min(containerRect.width - 240, (rect.left - containerRect.left) + 40))
    const topOffset = -42 // Mostrar flotando justo arriba de la caja de entrada

    setPosition({
      top: topOffset,
      left: leftOffset
    })
    setShowToolbar(true)
  }, [textareaRef])

  // Aplicar formato al texto seleccionado
  const applyFormat = (action: FormatAction) => {
    const input = textareaRef.current
    if (!input) return

    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    const currentValue = input.value
    const selected = currentValue.substring(start, end)

    let formatted = ''
    let newCursorStart = start
    let newCursorEnd = end

    switch (action) {
      case 'bold':
        if (selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2) {
          formatted = selected.slice(1, -1)
          newCursorStart = start
          newCursorEnd = start + formatted.length
        } else {
          formatted = `*${selected}*`
          newCursorStart = start
          newCursorEnd = start + formatted.length
        }
        break

      case 'italic':
        if (selected.startsWith('_') && selected.endsWith('_') && selected.length >= 2) {
          formatted = selected.slice(1, -1)
          newCursorStart = start
          newCursorEnd = start + formatted.length
        } else {
          formatted = `_${selected}_`
          newCursorStart = start
          newCursorEnd = start + formatted.length
        }
        break

      case 'strike':
        if (selected.startsWith('~') && selected.endsWith('~') && selected.length >= 2) {
          formatted = selected.slice(1, -1)
          newCursorStart = start
          newCursorEnd = start + formatted.length
        } else {
          formatted = `~${selected}~`
          newCursorStart = start
          newCursorEnd = start + formatted.length
        }
        break

      case 'code':
        if (selected.startsWith('```') && selected.endsWith('```') && selected.length >= 6) {
          formatted = selected.slice(3, -3)
          newCursorStart = start
          newCursorEnd = start + formatted.length
        } else {
          formatted = `\`\`\`${selected}\`\`\``
          newCursorStart = start
          newCursorEnd = start + formatted.length
        }
        break

      case 'quote':
        const quoteLines = selected.split('\n').map(l => l.startsWith('> ') ? l.slice(2) : `> ${l}`).join('\n')
        formatted = quoteLines
        newCursorStart = start
        newCursorEnd = start + formatted.length
        break

      case 'bullet':
        const bulletLines = selected.split('\n').map(l => l.startsWith('- ') ? l.slice(2) : `- ${l}`).join('\n')
        formatted = bulletLines
        newCursorStart = start
        newCursorEnd = start + formatted.length
        break

      case 'number':
        const numLines = selected.split('\n').map((l, i) => /^\d+\.\s+/.test(l) ? l.replace(/^\d+\.\s+/, '') : `${i + 1}. ${l}`).join('\n')
        formatted = numLines
        newCursorStart = start
        newCursorEnd = start + formatted.length
        break
    }

    const updatedText = currentValue.substring(0, start) + formatted + currentValue.substring(end)
    onChange(updatedText)

    // Reenfocar y seleccionar el nuevo rango
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(newCursorStart, newCursorEnd)
      updateToolbarPosition()
    }, 10)
  }

  // Atajos de teclado en el input (Ctrl+B, Ctrl+I, Ctrl+Shift+X, Ctrl+E)
  useEffect(() => {
    const input = textareaRef.current
    if (!input) return

    const handleKeyDown = (e: Event) => {
      const kbEvent = e as KeyboardEvent
      const isCtrlOrCmd = kbEvent.ctrlKey || kbEvent.metaKey

      if (isCtrlOrCmd && (kbEvent.key === 'b' || kbEvent.key === 'B')) {
        kbEvent.preventDefault()
        applyFormat('bold')
      } else if (isCtrlOrCmd && (kbEvent.key === 'i' || kbEvent.key === 'I')) {
        kbEvent.preventDefault()
        applyFormat('italic')
      } else if (isCtrlOrCmd && kbEvent.shiftKey && (kbEvent.key === 'x' || kbEvent.key === 'X')) {
        kbEvent.preventDefault()
        applyFormat('strike')
      } else if (isCtrlOrCmd && (kbEvent.key === 'e' || kbEvent.key === 'E')) {
        kbEvent.preventDefault()
        applyFormat('code')
      }
    }

    const handleSelect = () => {
      setTimeout(updateToolbarPosition, 10)
    }

    const handleBlur = (e: Event) => {
      const focusEvent = e as FocusEvent
      if (toolbarRef.current && toolbarRef.current.contains(focusEvent.relatedTarget as Node)) {
        return
      }
      setTimeout(() => setShowToolbar(false), 200)
    }

    input.addEventListener('keydown', handleKeyDown)
    input.addEventListener('select', handleSelect)
    input.addEventListener('mouseup', handleSelect)
    input.addEventListener('keyup', handleSelect)
    input.addEventListener('blur', handleBlur)

    return () => {
      input.removeEventListener('keydown', handleKeyDown)
      input.removeEventListener('select', handleSelect)
      input.removeEventListener('mouseup', handleSelect)
      input.removeEventListener('keyup', handleSelect)
      input.removeEventListener('blur', handleBlur)
    }
  }, [textareaRef, updateToolbarPosition, value])

  if (!showToolbar) return null

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="z-30 flex items-center gap-0.5 bg-[#14203d] border border-blue-500/50 shadow-2xl p-1 rounded-xl text-slate-200 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
      onMouseDown={(e) => e.preventDefault()} // Evita perder la selección del input
    >
      {/* 1. NEGRITA */}
      <button
        type="button"
        onClick={() => applyFormat('bold')}
        className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center justify-center"
        title="Negrita (*texto*) - Ctrl+B"
      >
        <Bold size={13} />
      </button>

      {/* 2. CURSIVA */}
      <button
        type="button"
        onClick={() => applyFormat('italic')}
        className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs italic flex items-center justify-center"
        title="Cursiva (_texto_) - Ctrl+I"
      >
        <Italic size={13} />
      </button>

      {/* 3. TACHADO */}
      <button
        type="button"
        onClick={() => applyFormat('strike')}
        className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs flex items-center justify-center"
        title="Tachado (~texto~) - Ctrl+Shift+X"
      >
        <Strikethrough size={13} />
      </button>

      <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

      {/* 4. MONOESPACIADO / CÓDIGO */}
      <button
        type="button"
        onClick={() => applyFormat('code')}
        className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs flex items-center justify-center font-mono"
        title="Monoespaciado (```texto```) - Ctrl+E"
      >
        <Code size={13} />
      </button>

      {/* 5. CITA */}
      <button
        type="button"
        onClick={() => applyFormat('quote')}
        className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs flex items-center justify-center"
        title="Cita (> texto)"
      >
        <Quote size={13} />
      </button>

      {/* 6. LISTA CON VIÑETAS */}
      <button
        type="button"
        onClick={() => applyFormat('bullet')}
        className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs flex items-center justify-center"
        title="Lista con viñetas (- item)"
      >
        <List size={13} />
      </button>

      {/* 7. LISTA NUMERADA */}
      <button
        type="button"
        onClick={() => applyFormat('number')}
        className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-xs flex items-center justify-center"
        title="Lista numerada (1. item)"
      >
        <ListOrdered size={13} />
      </button>
    </div>
  )
}
