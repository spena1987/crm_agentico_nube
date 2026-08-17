'use client'

import React from 'react'

interface WhatsAppFormattedTextProps {
  text: string
  className?: string
}

/**
 * Parsea y renderiza texto con formato enriquecido nativo de WhatsApp:
 * - *negrita* -> <strong>
 * - _cursiva_ -> <em>
 * - ~tachado~ -> <del>
 * - ```monoespaciado``` -> <code>
 * - > cita -> <blockquote>
 * - Listas con viñetas (- item / * item) y numeradas (1. item)
 * - Enlaces web automáticos (https://...)
 */
export default function WhatsAppFormattedText({ text, className = '' }: WhatsAppFormattedTextProps) {
  if (!text) return null

  // Dividir por líneas para procesar citas y listas
  const lines = text.split('\n')

  const renderLine = (line: string, lineIndex: number) => {
    // 1. Citas de WhatsApp (> texto)
    if (line.startsWith('> ') || line === '>') {
      const quoteContent = line.replace(/^>\s?/, '')
      return (
        <blockquote
          key={lineIndex}
          className="border-l-3 border-blue-400 pl-2.5 my-1 italic text-slate-200 bg-black/10 dark:bg-white/5 py-0.5 rounded-r"
        >
          {parseInlineFormatting(quoteContent)}
        </blockquote>
      )
    }

    // 2. Listas con viñetas (- item o * item al inicio de línea)
    if (/^[-*]\s+/.test(line)) {
      const itemContent = line.replace(/^[-*]\s+/, '')
      return (
        <div key={lineIndex} className="flex items-start gap-1.5 ml-1 my-0.5">
          <span className="text-blue-400 select-none">•</span>
          <span className="flex-1">{parseInlineFormatting(itemContent)}</span>
        </div>
      )
    }

    // 3. Listas numeradas (1. item, 2. item)
    const numMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) {
      return (
        <div key={lineIndex} className="flex items-start gap-1.5 ml-1 my-0.5">
          <span className="text-blue-400 select-none font-semibold text-[10px] min-w-[14px]">
            {numMatch[1]}.
          </span>
          <span className="flex-1">{parseInlineFormatting(numMatch[2])}</span>
        </div>
      )
    }

    // 4. Línea estándar
    return (
      <div key={lineIndex} className={line === '' ? 'h-3' : 'min-h-[1.25em]'}>
        {parseInlineFormatting(line)}
      </div>
    )
  }

  return (
    <div className={`space-y-0.5 break-words ${className}`}>
      {lines.map((line, idx) => renderLine(line, idx))}
    </div>
  )
}

/**
 * Parsea formato inline:
 * ```código```, *negrita*, _cursiva_, ~tachado~ y enlaces https://
 */
function parseInlineFormatting(str: string): React.ReactNode[] {
  if (!str) return []

  // Tokenizar por bloques de código primero (```...```)
  const codeBlockRegex = /```([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parseMarkdownElements(str.substring(lastIndex, match.index)))
    }
    parts.push(
      <code
        key={`code_${match.index}`}
        className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-slate-950/80 text-emerald-300 border border-emerald-800/40"
      >
        {match[1]}
      </code>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < str.length) {
    parts.push(...parseMarkdownElements(str.substring(lastIndex)))
  }

  return parts
}

/**
 * Parsea negrita (*), cursiva (_), tachado (~) y links
 */
function parseMarkdownElements(str: string): React.ReactNode[] {
  // Regex combinada para WhatsApp Markdown y URLs
  // Negrita: *(.*?)*
  // Cursiva: _(.*?)_
  // Tachado: ~(.*?)~
  // URLs: (https?:\/\/[^\s]+)
  const combinedRegex = /(\*([^*\n]+)\*)|(_([^_\n]+)_)|(~([^~\n]+)~)|(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g
  const elements: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = combinedRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      elements.push(str.substring(lastIndex, match.index))
    }

    const fullMatch = match[0]
    const key = `el_${match.index}_${fullMatch}`

    if (fullMatch.startsWith('*') && fullMatch.endsWith('*') && fullMatch.length > 2) {
      // Negrita
      elements.push(
        <strong key={key} className="font-bold text-slate-50">
          {match[2]}
        </strong>
      )
    } else if (fullMatch.startsWith('_') && fullMatch.endsWith('_') && fullMatch.length > 2) {
      // Cursiva
      elements.push(
        <em key={key} className="italic opacity-95">
          {match[4]}
        </em>
      )
    } else if (fullMatch.startsWith('~') && fullMatch.endsWith('~') && fullMatch.length > 2) {
      // Tachado
      elements.push(
        <del key={key} className="line-through opacity-75">
          {match[6]}
        </del>
      )
    } else if (fullMatch.startsWith('http://') || fullMatch.startsWith('https://')) {
      // URL Clicable
      elements.push(
        <a
          key={key}
          href={fullMatch}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300 hover:text-blue-200 underline underline-offset-2 break-all inline-flex items-center gap-0.5 font-medium transition-colors"
        >
          {fullMatch}
        </a>
      )
    } else {
      elements.push(fullMatch)
    }

    lastIndex = match.index + fullMatch.length
  }

  if (lastIndex < str.length) {
    elements.push(str.substring(lastIndex))
  }

  return elements
}
