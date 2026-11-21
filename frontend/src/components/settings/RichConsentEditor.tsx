'use client'

import React from 'react'
import RichMarkdownEditor from '../shared/RichMarkdownEditor'

interface RichConsentEditorProps {
  value: string
  onChange: (newValue: string) => void
  placeholder?: string
  minHeight?: string
  showVariables?: boolean
}

export function RichConsentEditor({
  value,
  onChange,
  placeholder = 'Escriba el contenido del consentimiento aquí... Soporta formato Markdown.',
  minHeight = '420px',
  showVariables = true,
}: RichConsentEditorProps) {
  return (
    <RichMarkdownEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      minHeight={minHeight}
      showVariables={showVariables}
      previewTitle="Vista Previa Legal (con variables simuladas)"
      previewSubtitle="Así lo visualizará el paciente"
      variant="light"
      compact={false}
    />
  )
}

export default RichConsentEditor
