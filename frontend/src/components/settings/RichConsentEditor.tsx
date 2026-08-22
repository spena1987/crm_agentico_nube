'use client'

import React, { useState, useRef } from 'react'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Eye,
  Edit3,
  Columns,
  Sparkles,
  Info,
  Check
} from 'lucide-react'

interface RichConsentEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  showVariables?: boolean
}

export function RichConsentEditor({
  value,
  onChange,
  placeholder = 'Escriba el cuerpo legal del consentimiento...',
  minHeight = '360px',
  showVariables = true
}: RichConsentEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split')
  const [copiedTag, setCopiedTag] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const variables = [
    { tag: '{paciente}', label: 'Paciente', desc: 'Nombre completo' },
    { tag: '{dni}', label: 'DNI', desc: 'Doc. Identidad' },
    { tag: '{cirujano}', label: 'Cirujano', desc: 'Médico actuante' },
    { tag: '{practica}', label: 'Práctica', desc: 'Cirugía/Prestación' },
    { tag: '{ojo_intervenido}', label: 'Ojo', desc: 'Lateralidad OD/OI/Bilateral' },
    { tag: '{fecha}', label: 'Fecha', desc: 'Fecha de la práctica' }
  ]

  // Inserta texto o rodea la selección con prefijos/sufijos
  const applyFormat = (prefix: string, suffix: string = '', defaultText: string = 'texto') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentText = textarea.value
    const selectedText = currentText.substring(start, end) || defaultText

    const replacement = `${prefix}${selectedText}${suffix}`
    const nextValue =
      currentText.substring(0, start) +
      replacement +
      currentText.substring(end)

    onChange(nextValue)

    setTimeout(() => {
      textarea.focus()
      const cursorStart = start + prefix.length
      const cursorEnd = cursorStart + selectedText.length
      textarea.setSelectionRange(cursorStart, cursorEnd)
    }, 10)
  }

  // Inserta variable dinámica en la posición del cursor
  const insertVariable = (tag: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(value + ' ' + tag)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentText = textarea.value

    const nextValue =
      currentText.substring(0, start) +
      tag +
      currentText.substring(end)

    onChange(nextValue)

    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 1500)

    setTimeout(() => {
      textarea.focus()
      const newPos = start + tag.length
      textarea.setSelectionRange(newPos, newPos)
    }, 10)
  }

  // Formateador inline para **negrita** e *cursiva*
  const formatInline = (text: string) => {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')

    return <span dangerouslySetInnerHTML={{ __html: formatted }} />
  }

  // Renderizador simple y elegante de Markdown
  const renderMarkdownPreview = (content: string) => {
    if (!content.trim()) {
      return (
        <div className="text-center text-slate-400 py-12 text-xs italic">
          La vista previa se generará automáticamente a medida que escribas...
        </div>
      )
    }

    // Reemplaza variables con ejemplos visuales resaltados
    let processed = content
      .replace(/{paciente}/g, '<span class="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold font-sans text-xs">[Ej: Juan Pérez]</span>')
      .replace(/{dni}/g, '<span class="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold font-mono text-xs">[Ej: 30.123.456]</span>')
      .replace(/{cirujano}/g, '<span class="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold font-sans text-xs">[Ej: Dr. Martín Gómez]</span>')
      .replace(/{practica}/g, '<span class="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold font-sans text-xs">[Ej: Cirugía de Cataratas]</span>')
      .replace(/{ojo_intervenido}/g, '<span class="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold font-sans text-xs">[Ej: Ojo Derecho (OD)]</span>')
      .replace(/{fecha}/g, '<span class="bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded font-bold font-mono text-xs">[Ej: 22/08/2026]</span>')

    const lines = processed.split('\n')

    return (
      <div className="space-y-3 text-xs leading-relaxed font-sans text-slate-800 dark:text-slate-200">
        {lines.map((line, idx) => {
          const trimmed = line.trim()

          // Separador horizontal
          if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            return <hr key={idx} className="my-4 border-slate-300 dark:border-slate-700" />
          }

          // Encabezado 1
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-base font-extrabold text-slate-900 dark:text-slate-100 pt-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                {formatInline(trimmed.substring(2))}
              </h1>
            )
          }

          // Encabezado 2
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-sm font-bold text-blue-800 dark:text-blue-300 pt-2">
                {formatInline(trimmed.substring(3))}
              </h2>
            )
          }

          // Encabezado 3
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-xs font-bold text-slate-800 dark:text-slate-200 pt-1">
                {formatInline(trimmed.substring(4))}
              </h3>
            )
          }

          // Cita / Bloque de advertencia
          if (trimmed.startsWith('> ')) {
            return (
              <div key={idx} className="p-2.5 my-1.5 bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r-lg text-amber-900 dark:text-amber-200">
                {formatInline(trimmed.substring(2))}
              </div>
            )
          }

          // Lista con viñeta
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-slate-700 dark:text-slate-300">
                {formatInline(trimmed.substring(2))}
              </li>
            )
          }

          // Línea vacía
          if (!trimmed) {
            return <div key={idx} className="h-2" />
          }

          // Párrafo estándar
          return (
            <p key={idx} className="text-slate-700 dark:text-slate-300">
              {formatInline(line)}
            </p>
          )
        })}
      </div>
    )
  }

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const charCount = value.length

  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)] shadow-sm flex flex-col">
      {/* 1. Barra de Herramientas Principal */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/70 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Controles de Formato */}
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-[var(--border)] rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => applyFormat('**', '**', 'negrita')}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-bold transition"
              title="Negrita (**texto**)"
            >
              <Bold size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('*', '*', 'cursiva')}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 italic transition"
              title="Cursiva (*texto*)"
            >
              <Italic size={14} />
            </button>
          </div>

          <div className="flex items-center bg-white dark:bg-slate-800 border border-[var(--border)] rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => applyFormat('# ', '', 'Título Principal')}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-extrabold text-[11px] transition"
              title="Título 1 (# Título)"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => applyFormat('## ', '', 'Sección / Cláusula')}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-bold text-[11px] transition"
              title="Título 2 (## Sección)"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => applyFormat('### ', '', 'Subcláusula')}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition"
              title="Título 3 (### Subtítulo)"
            >
              H3
            </button>
          </div>

          <div className="flex items-center bg-white dark:bg-slate-800 border border-[var(--border)] rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => applyFormat('- ', '', 'Elemento de lista')}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition"
              title="Lista con Viñetas (- ítem)"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('1. ', '', 'Primer paso')}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition"
              title="Lista Numerada (1. ítem)"
            >
              <ListOrdered size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('> ', '', 'Advertencia médica importante')}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition"
              title="Cita / Alerta Médica (> Advertencia)"
            >
              <Quote size={14} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('\n---\n', '', '')}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition"
              title="Línea Divisoria (---)"
            >
              <Minus size={14} />
            </button>
          </div>
        </div>

        {/* Selector de Modo de Visualización */}
        <div className="flex items-center bg-white dark:bg-slate-800 border border-[var(--border)] rounded-xl p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 text-xs transition ${
              viewMode === 'edit'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Edit3 size={13} />
            Editor
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden md:flex px-2.5 py-1 rounded-lg font-bold items-center gap-1.5 text-xs transition ${
              viewMode === 'split'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Columns size={13} />
            Dividido
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 text-xs transition ${
              viewMode === 'preview'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Eye size={13} />
            Vista Previa
          </button>
        </div>
      </div>

      {/* 2. Chips de Variables Dinámicas del CRM */}
      {showVariables && (
        <div className="px-3 py-2 bg-purple-50/50 dark:bg-purple-950/20 border-b border-[var(--border)] flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1 mr-1">
            <Sparkles size={12} className="text-purple-600" />
            Variables Automáticas:
          </span>
          {variables.map((v) => {
            const isJustCopied = copiedTag === v.tag
            return (
              <button
                key={v.tag}
                type="button"
                onClick={() => insertVariable(v.tag)}
                className={`px-2 py-0.5 rounded-lg border font-mono font-bold transition flex items-center gap-1 shadow-xs ${
                  isJustCopied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                }`}
                title={`${v.desc} (clic para insertar)`}
              >
                {isJustCopied ? <Check size={11} /> : null}
                {v.tag}
              </button>
            )
          })}
        </div>
      )}

      {/* 3. Área de Trabajo (Editor / Split / Preview) */}
      <div
        className={`grid ${
          viewMode === 'split'
            ? 'grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]'
            : 'grid-cols-1'
        } bg-[var(--background)]`}
        style={{ minHeight }}
      >
        {/* Panel Editor de Texto */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="p-3 flex flex-col flex-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
              <span>Entrada de Texto (Markdown soportado)</span>
              <span>{viewMode === 'split' ? 'Editor' : ''}</span>
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full flex-1 p-3 bg-transparent border-0 outline-none font-mono text-xs leading-relaxed resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
              style={{ minHeight: '380px' }}
            />
          </div>
        )}

        {/* Panel de Vista Previa Renderizada */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="p-4 flex flex-col flex-1 bg-slate-50/40 dark:bg-slate-900/30 overflow-y-auto max-h-[550px]">
            <div className="flex items-center justify-between text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider mb-3 pb-1 border-b border-[var(--border)]">
              <span className="flex items-center gap-1">
                <Eye size={12} />
                Vista Previa Legal (con variables simuladas)
              </span>
              <span className="text-[10px] text-slate-400 normal-case font-normal">
                Así lo visualizará el paciente
              </span>
            </div>
            <div className="p-4 bg-white dark:bg-slate-950 rounded-xl border border-[var(--border)] shadow-xs flex-1">
              {renderMarkdownPreview(value)}
            </div>
          </div>
        )}
      </div>

      {/* 4. Barra de Estado Inferior */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            <b>{wordCount}</b> palabras
          </span>
          <span>•</span>
          <span>
            <b>{charCount.toLocaleString('es-AR')}</b> caracteres
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <Info size={12} />
          <span>Soporta sintaxis Markdown: <code className="font-mono text-purple-600"># Título</code>, <code className="font-mono text-purple-600">**Negrita**</code>, <code className="font-mono text-purple-600">- Viñeta</code></span>
        </div>
      </div>
    </div>
  )
}
