'use client'

import React, { useState, useRef } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Minus,
  Eye,
  Edit3,
  Columns,
  Sparkles,
  Check,
  Info,
} from 'lucide-react'

export interface MarkdownVariableItem {
  tag: string
  label: string
  desc: string
}

export const DEFAULT_CLINICAL_VARIABLES: MarkdownVariableItem[] = [
  { tag: '{paciente}', label: 'Paciente', desc: 'Nombre completo del paciente' },
  { tag: '{dni}', label: 'DNI', desc: 'Documento de identidad' },
  { tag: '{cirujano}', label: 'Cirujano', desc: 'Profesional tratante' },
  { tag: '{practica}', label: 'Práctica', desc: 'Cirugía o estudio a realizar' },
  { tag: '{ojo_intervenido}', label: 'Ojo (OD/OI/AO)', desc: 'Lateralidad quirúrgica' },
  { tag: '{fecha}', label: 'Fecha Hoy', desc: 'Fecha actual de emisión' },
]

export interface RichMarkdownEditorProps {
  value: string
  onChange: (newValue: string) => void
  placeholder?: string
  minHeight?: string
  showVariables?: boolean
  variables?: MarkdownVariableItem[]
  previewContext?: Record<string, string>
  previewTitle?: string
  previewSubtitle?: string
  variant?: 'light' | 'dark'
  compact?: boolean
  disabled?: boolean
  defaultViewMode?: 'edit' | 'split' | 'preview'
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const DEFAULT_EXAMPLE_BADGES: Record<string, { text: string; colorClass: string }> = {
  paciente: {
    text: '[Ej: Juan Pérez]',
    colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  },
  dni: {
    text: '[Ej: 30.123.456]',
    colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  },
  cirujano: {
    text: '[Ej: Dr. Martín Gómez]',
    colorClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  },
  practica: {
    text: '[Ej: Cirugía de Cataratas]',
    colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  ojo_intervenido: {
    text: '[Ej: Ojo Derecho (OD)]',
    colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  fecha: {
    text: '[Ej: 22/08/2026]',
    colorClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  },
}

export default function RichMarkdownEditor({
  value,
  onChange,
  placeholder = 'Escriba el texto aquí... Soporta formato Markdown y variables dinámicas.',
  minHeight,
  showVariables = true,
  variables = DEFAULT_CLINICAL_VARIABLES,
  previewContext,
  previewTitle = 'Vista Previa (con variables)',
  previewSubtitle = 'Así lo visualizará el paciente',
  variant = 'light',
  compact = false,
  disabled = false,
  defaultViewMode,
}: RichMarkdownEditorProps) {
  const initialMode = defaultViewMode ?? (compact ? 'edit' : 'split')
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>(initialMode)
  const [copiedTag, setCopiedTag] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDark = variant === 'dark'
  const effectiveMinHeight = minHeight ?? (compact ? '120px' : '420px')
  const textareaMinHeight = compact ? '96px' : '380px'

  const applyFormat = (prefix: string, suffix: string = '', defaultText: string = 'texto') => {
    if (disabled) return
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const textToInsert = selectedText || defaultText

    const before = value.substring(0, start)
    const after = value.substring(end)

    const newValue = `${before}${prefix}${textToInsert}${suffix}${after}`
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + prefix.length + textToInsert.length + suffix.length
      textarea.setSelectionRange(
        selectedText ? newCursorPos : start + prefix.length,
        selectedText ? newCursorPos : start + prefix.length + textToInsert.length
      )
    }, 10)
  }

  const insertVariable = (tag: string) => {
    if (disabled) return
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(`${value}${tag}`)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = value.substring(0, start)
    const after = value.substring(end)

    const newValue = `${before}${tag}${after}`
    onChange(newValue)

    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 1200)

    setTimeout(() => {
      textarea.focus()
      const pos = start + tag.length
      textarea.setSelectionRange(pos, pos)
    }, 10)
  }

  const formatInline = (text: string): string => {
    // 1. Escape HTML characters first to prevent XSS before inserting our own HTML tags
    let formatted = escapeHtml(text)

    // 2. Bold & Italic (respecting word boundaries for underscores so snake_case is preserved)
    formatted = formatted
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')

    // 3. Replace dynamic variables {{var}} and {var}
    formatted = formatted.replace(/\{\{([a-zA-Z0-9_]+)\}\}|\{([a-zA-Z0-9_]+)\}/g, (match, dblKey, sglKey) => {
      const key = (dblKey || sglKey || '').toLowerCase()
      const realValue = previewContext?.[key]
      if (realValue !== undefined && realValue !== '') {
        const badgeCls = isDark
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
        return `<span class="px-1.5 py-0.5 rounded font-bold ${badgeCls}">${escapeHtml(realValue)}</span>`
      }
      const example = DEFAULT_EXAMPLE_BADGES[key]
      if (example) {
        return `<span class="px-1 rounded font-bold ${example.colorClass}">${example.text}</span>`
      }
      return match
    })

    return formatted
  }

  const renderMarkdownPreview = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 italic text-xs py-8">
          <Eye size={24} className="mb-2 opacity-30" />
          <p>Comience a escribir para ver la vista previa renderizada.</p>
        </div>
      )
    }

    const lines = text.split('\n')

    return (
      <div className={`space-y-1.5 text-[13px] leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800 dark:text-slate-200'}`}>
        {lines.map((line, i) => {
          const trimmed = line.trim()
          if (!trimmed) return <div key={i} className="h-2" />

          // Horizontal divider
          if (trimmed === '---' || trimmed === '***') {
            return <hr key={i} className={`my-2.5 border-t ${isDark ? 'border-slate-700' : 'border-slate-200 dark:border-slate-700'}`} />
          }

          // Headings
          if (trimmed.startsWith('# ')) {
            return (
              <h1
                key={i}
                className={`text-base font-extrabold border-b pb-1 mt-3 mb-1.5 ${
                  isDark ? 'text-white border-slate-700' : 'text-slate-900 dark:text-white border-slate-200 dark:border-slate-700'
                }`}
                dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }}
              />
            )
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2
                key={i}
                className={`text-sm font-bold mt-2.5 mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700 dark:text-blue-400'}`}
                dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(3)) }}
              />
            )
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3
                key={i}
                className={`text-[13px] font-bold mt-2 mb-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800 dark:text-slate-200'}`}
                dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(4)) }}
              />
            )
          }

          // Blockquote / Medical Warning
          if (trimmed.startsWith('> ')) {
            return (
              <blockquote
                key={i}
                className={`border-l-4 border-amber-500 px-3 py-1.5 rounded-r-lg italic text-xs my-1.5 ${
                  isDark
                    ? 'bg-amber-950/30 text-amber-200'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                }`}
                dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }}
              />
            )
          }

          // Bullet list
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={i} className="flex items-start gap-2 pl-2">
                <span className="text-blue-500 font-bold mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }} />
              </div>
            )
          }

          // Numbered list
          const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/)
          if (numMatch) {
            return (
              <div key={i} className="flex items-start gap-2 pl-2">
                <span className="text-blue-500 font-bold min-w-[18px]">{numMatch[1]}</span>
                <span dangerouslySetInnerHTML={{ __html: formatInline(numMatch[2]) }} />
              </div>
            )
          }

          // Standard paragraph
          return (
            <p
              key={i}
              className="leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatInline(line) }}
            />
          )
        })}
      </div>
    )
  }

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const charCount = value.length

  const containerCls = isDark
    ? 'border border-slate-700/80 rounded-xl overflow-hidden bg-slate-950/80 shadow-xs'
    : 'border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)] shadow-xs'

  const toolbarBgCls = isDark
    ? 'bg-slate-900/90 border-b border-slate-800 px-2.5 py-1.5'
    : 'bg-slate-50 dark:bg-slate-900/60 border-b border-[var(--border)] px-3 py-2'

  const btnGroupCls = isDark
    ? 'flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5'
    : 'flex items-center bg-white dark:bg-slate-800 border border-[var(--border)] rounded-lg p-0.5 shadow-xs'

  const toolBtnCls = isDark
    ? 'p-1.5 hover:bg-slate-700 rounded text-slate-300 transition disabled:opacity-40'
    : 'p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition disabled:opacity-40'

  const textBtnCls = isDark
    ? 'px-2 py-1 hover:bg-slate-700 rounded text-slate-300 text-[11px] transition disabled:opacity-40'
    : 'px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 text-[11px] transition disabled:opacity-40'

  return (
    <div className={`${containerCls} flex flex-col ${disabled ? 'opacity-70' : ''}`}>
      {/* 1. Toolbar */}
      <div className={`${toolbarBgCls} flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex flex-wrap items-center gap-1">
          <div className={btnGroupCls}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyFormat('**', '**', 'negrita')}
              className={`${toolBtnCls} font-bold`}
              title="Negrita (**texto**)"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyFormat('*', '*', 'cursiva')}
              className={`${toolBtnCls} italic`}
              title="Cursiva (*texto*)"
            >
              <Italic size={13} />
            </button>
          </div>

          {!compact && (
            <div className={btnGroupCls}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyFormat('# ', '', 'Título Principal')}
                className={`${textBtnCls} font-extrabold`}
                title="Título 1 (# Título)"
              >
                H1
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyFormat('## ', '', 'Sección')}
                className={`${textBtnCls} font-bold`}
                title="Título 2 (## Sección)"
              >
                H2
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyFormat('### ', '', 'Subtítulo')}
                className={`${textBtnCls} font-semibold`}
                title="Título 3 (### Subtítulo)"
              >
                H3
              </button>
            </div>
          )}

          <div className={btnGroupCls}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyFormat('- ', '', 'Elemento de lista')}
              className={toolBtnCls}
              title="Lista con Viñetas (- ítem)"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyFormat('1. ', '', 'Primer paso')}
              className={toolBtnCls}
              title="Lista Numerada (1. ítem)"
            >
              <ListOrdered size={13} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => applyFormat('> ', '', 'Advertencia médica importante')}
              className={toolBtnCls}
              title="Cita / Alerta Médica (> Advertencia)"
            >
              <Quote size={13} />
            </button>
            {!compact && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => applyFormat('\n---\n', '', '')}
                className={toolBtnCls}
                title="Línea Divisoria (---)"
              >
                <Minus size={13} />
              </button>
            )}
          </div>
        </div>

        {/* View Mode Selector */}
        <div
          className={`flex items-center rounded-xl p-0.5 border ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white dark:bg-slate-800 border-[var(--border)] shadow-xs'
          }`}
        >
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] transition ${
              viewMode === 'edit'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark
                  ? 'text-slate-400 hover:bg-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Edit3 size={12} />
            Editor
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden md:flex px-2 py-1 rounded-lg font-bold items-center gap-1 text-[11px] transition ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark
                    ? 'text-slate-400 hover:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Columns size={12} />
              Dividido
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] transition ${
              viewMode === 'preview'
                ? 'bg-purple-600 text-white shadow-xs'
                : isDark
                  ? 'text-slate-400 hover:bg-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Eye size={12} />
            Vista Previa
          </button>
        </div>
      </div>

      {/* 2. Dynamic Variable Chips */}
      {showVariables && variables.length > 0 && (
        <div
          className={`px-3 py-1.5 border-b flex flex-wrap items-center gap-1.5 text-[11px] ${
            isDark
              ? 'bg-purple-950/25 border-slate-800'
              : 'bg-purple-50/50 dark:bg-purple-950/20 border-[var(--border)]'
          }`}
        >
          <span
            className={`font-bold flex items-center gap-1 mr-1 ${
              isDark ? 'text-purple-300' : 'text-purple-900 dark:text-purple-300'
            }`}
          >
            <Sparkles size={11} className="text-purple-500" />
            Variables:
          </span>
          {variables.map((v) => {
            const isJustCopied = copiedTag === v.tag
            return (
              <button
                key={v.tag}
                type="button"
                disabled={disabled}
                onClick={() => insertVariable(v.tag)}
                className={`px-2 py-0.5 rounded-lg border font-mono font-bold transition flex items-center gap-1 text-[10px] disabled:opacity-40 ${
                  isJustCopied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isDark
                      ? 'bg-slate-900 border-purple-700/70 text-purple-300 hover:bg-purple-900/40'
                      : 'bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 shadow-xs'
                }`}
                title={`${v.desc} (clic para insertar)`}
              >
                {isJustCopied ? <Check size={10} /> : null}
                {v.tag}
              </button>
            )
          })}
        </div>
      )}

      {/* 3. Work Area */}
      <div
        className={`grid ${
          viewMode === 'split' && !compact
            ? `grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x ${isDark ? 'divide-slate-800' : 'divide-[var(--border)]'}`
            : 'grid-cols-1'
        } ${isDark ? 'bg-slate-950/60' : 'bg-[var(--background)]'}`}
        style={{ minHeight: effectiveMinHeight }}
      >
        {(viewMode === 'edit' || (viewMode === 'split' && !compact)) && (
          <div className="p-2.5 flex flex-col flex-1">
            {!compact && (
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                <span>Entrada de Texto (Markdown soportado)</span>
                <span>{viewMode === 'split' ? 'Editor' : ''}</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              disabled={disabled}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`w-full flex-1 p-2 bg-transparent border-0 outline-none font-mono text-xs leading-relaxed resize-y ${
                isDark
                  ? 'text-slate-100 placeholder-slate-500'
                  : 'text-slate-800 dark:text-slate-100 placeholder-slate-400'
              }`}
              style={{ minHeight: textareaMinHeight }}
            />
          </div>
        )}

        {(viewMode === 'preview' || (viewMode === 'split' && !compact)) && (
          <div
            className={`p-3 flex flex-col flex-1 overflow-y-auto ${
              compact ? 'max-h-[260px]' : 'max-h-[550px]'
            } ${isDark ? 'bg-slate-900/40' : 'bg-slate-50/40 dark:bg-slate-900/30'}`}
          >
            <div
              className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-2 pb-1 border-b ${
                isDark
                  ? 'text-purple-400 border-slate-800'
                  : 'text-purple-600 dark:text-purple-400 border-[var(--border)]'
              }`}
            >
              <span className="flex items-center gap-1">
                <Eye size={11} />
                {previewTitle}
              </span>
              {!compact && (
                <span className="text-[10px] text-slate-400 normal-case font-normal">
                  {previewSubtitle}
                </span>
              )}
            </div>
            <div
              className={`p-3 rounded-xl border flex-1 ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800'
                  : 'bg-white dark:bg-slate-950 border-[var(--border)] shadow-xs'
              }`}
            >
              {renderMarkdownPreview(value)}
            </div>
          </div>
        )}
      </div>

      {/* 4. Status Bar */}
      <div
        className={`px-3 py-1.5 border-t flex items-center justify-between text-[10px] text-slate-400 ${
          isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 dark:bg-slate-900/60 border-[var(--border)]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span>
            <b>{wordCount}</b> palabras
          </span>
          <span>•</span>
          <span>
            <b>{charCount.toLocaleString('es-AR')}</b> caracteres
          </span>
        </div>

        {!compact && (
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <Info size={11} />
            <span>
              Markdown: <code className="font-mono text-purple-500"># Título</code>,{' '}
              <code className="font-mono text-purple-500">**Negrita**</code>,{' '}
              <code className="font-mono text-purple-500">- Viñeta</code>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
