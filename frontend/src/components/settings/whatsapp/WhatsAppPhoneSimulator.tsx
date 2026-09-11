'use client'

import React, { useState } from 'react'
import { 
  CheckCheck, 
  ArrowLeft, 
  MoreVertical, 
  Phone, 
  Video, 
  Sparkles, 
  Building2, 
  ExternalLink,
  MessageSquare,
  Eye,
  SlidersHorizontal
} from 'lucide-react'

interface WhatsAppPhoneSimulatorProps {
  headerType?: string
  headerContent?: string
  bodyText: string
  footerText?: string
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>
  variableMappings?: Record<string, string>
  sampleValues?: Record<string, string>
  clinicName?: string
}

export default function WhatsAppPhoneSimulator({
  headerType = 'NONE',
  headerContent = '',
  bodyText = '',
  footerText = '',
  buttons = [],
  variableMappings = {},
  sampleValues = {},
  clinicName = 'MedCRM Clínica'
}: WhatsAppPhoneSimulatorProps) {
  const [showResolvedValues, setShowResolvedValues] = useState<boolean>(true)

  // Catálogo de valores de ejemplo para variables clínicas
  const defaultSampleCatalog: Record<string, string> = {
    paciente_nombre: 'Carlos Menéndez',
    turno_fecha: 'Jueves 15 de Octubre',
    turno_hora: '11:30 hs',
    medico_nombre: 'Dra. Sofía Martínez',
    practica_nombre: 'Consulta Oftalmológica',
    quirofano_nombre: 'Sede Central - Consultorio 4',
    presupuesto_monto: '$ 45.000'
  }

  // Renderizar el cuerpo reemplazando o resaltando variables
  const renderFormattedBody = () => {
    if (!bodyText) {
      return <span className="text-slate-400 italic">Escribe el contenido de la plantilla para previsualizar el globo de WhatsApp...</span>
    }

    // Dividir por variables {{1}}, {{2}}
    const parts = bodyText.split(/(\{\{\d+\}\})/g)

    return parts.map((part, index) => {
      const match = part.match(/^\{\{(\d+)\}\}$/)
      if (match) {
        const varNum = match[1]
        const mappedField = variableMappings[varNum] || ''
        const resolvedValue = sampleValues[varNum] || defaultSampleCatalog[mappedField] || `[Variable {{${varNum}}}]`

        if (showResolvedValues) {
          return (
            <span 
              key={index} 
              className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 px-1.5 py-0.5 rounded text-[12.5px] font-semibold border border-emerald-300 dark:border-emerald-700 mx-0.5 inline-block shadow-2xs"
              title={`Variable {{${varNum}}} mapeada a: ${mappedField || 'Personalizada'}`}
            >
              {resolvedValue}
            </span>
          )
        } else {
          return (
            <span 
              key={index} 
              className="bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 px-1 py-0.5 rounded font-mono text-[11px] font-bold border border-amber-300 dark:border-amber-700 mx-0.5 inline-block"
            >
              {`{{${varNum}}}`}
            </span>
          )
        }
      }

      // Procesar saltos de línea y texto normal
      return (
        <span key={index} className="whitespace-pre-line">
          {part}
        </span>
      )
    })
  }

  return (
    <div className="flex flex-col items-center select-none">
      {/* Selector de modo de vista previa */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 mb-3 text-xs">
        <button
          type="button"
          onClick={() => setShowResolvedValues(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
            showResolvedValues 
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' 
              : 'text-slate-550 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Con Datos Clínicos
        </button>
        <button
          type="button"
          onClick={() => setShowResolvedValues(false)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
            !showResolvedValues 
              ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs' 
              : 'text-slate-550 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Con Etiquetas {'{{#}}'}
        </button>
      </div>

      {/* Marco de Smartphone */}
      <div className="w-[340px] h-[580px] bg-slate-900 rounded-[38px] p-2.5 shadow-2xl border-4 border-slate-800 relative flex flex-col overflow-hidden">
        {/* Notch / Barra de estado */}
        <div className="h-5 w-full flex items-center justify-between px-6 text-[10px] text-white/70 font-medium z-20">
          <span>09:41</span>
          <div className="w-20 h-3.5 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-1.5 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900/80 ml-auto mr-1" />
          </div>
          <div className="flex items-center gap-1">
            <span>5G</span>
            <div className="w-4 h-2 border border-white/70 rounded-xs p-0.5">
              <div className="w-full h-full bg-white/80 rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Pantalla Interna */}
        <div className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] rounded-[28px] flex flex-col overflow-hidden relative shadow-inner">
          {/* Barra Superior WhatsApp */}
          <div className="bg-[#075e54] dark:bg-[#202c33] text-white px-3 py-2 flex items-center gap-2.5 shadow-sm z-10">
            <ArrowLeft className="w-4 h-4 text-white/80 cursor-pointer" />
            <div className="w-7 h-7 rounded-full bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              🩺
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate leading-tight">{clinicName}</div>
              <div className="text-[9.5px] text-emerald-200/90 dark:text-emerald-400/90 leading-none">en línea (WhatsApp Oficial)</div>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <Video className="w-3.5 h-3.5 opacity-60" />
              <Phone className="w-3.5 h-3.5 opacity-60" />
              <MoreVertical className="w-3.5 h-3.5 opacity-60" />
            </div>
          </div>

          {/* Área de Conversación con Fondo de WhatsApp */}
          <div className="flex-1 p-3.5 overflow-y-auto flex flex-col justify-end space-y-2 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Aviso de Cifrado */}
            <div className="text-center mb-1">
              <span className="bg-[#ffeecd]/90 dark:bg-[#182229]/90 text-amber-900 dark:text-amber-200/80 text-[9px] px-2.5 py-1 rounded-md shadow-2xs inline-block max-w-[90%] border border-amber-200/50 dark:border-slate-800">
                🔒 Los mensajes y llamadas están cifrados de extremo a extremo.
              </span>
            </div>

            {/* Burbuja de Mensaje de Plantilla */}
            <div className="max-w-[90%] self-start flex flex-col shadow-sm rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
              <div className="bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 p-2.5 rounded-t-lg text-xs leading-relaxed break-words relative">
                {/* Cabecera (Header) */}
                {headerType === 'TEXT' && headerContent && (
                  <div className="font-bold text-[13px] text-slate-900 dark:text-white mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-700/50">
                    {headerContent}
                  </div>
                )}

                {/* Cuerpo (Body) */}
                <div className="text-[12.5px] leading-snug">
                  {renderFormattedBody()}
                </div>

                {/* Pie de página (Footer) y Hora */}
                <div className="mt-2 pt-1 flex items-baseline justify-between gap-3 text-[10px] text-slate-450 dark:text-slate-400">
                  <span className="italic truncate">{footerText || ''}</span>
                  <span className="flex items-center gap-1 shrink-0 ml-auto text-[9.5px]">
                    11:30
                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                  </span>
                </div>
              </div>

              {/* Botones de Acción Rápida (Quick Replies / Call-to-action) */}
              {buttons && buttons.length > 0 && (
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/60 bg-white/95 dark:bg-[#202c33]/95 border-t border-slate-100 dark:border-slate-700/50">
                  {buttons.map((btn, bIdx) => (
                    <div 
                      key={bIdx}
                      className="py-2 px-3 text-center text-[#00a884] dark:text-[#00a884] font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                    >
                      {btn.type === 'URL' ? (
                        <ExternalLink className="w-3.5 h-3.5" />
                      ) : btn.type === 'PHONE_NUMBER' ? (
                        <Phone className="w-3.5 h-3.5" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5" />
                      )}
                      <span>{btn.text || `Botón ${bIdx + 1}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Barra Inferior Simulada (Input) */}
          <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-3 py-2 flex items-center gap-2 border-t border-slate-200 dark:border-slate-700/50">
            <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-3 py-1.5 text-[11px] text-slate-400">
              Escribe un mensaje...
            </div>
            <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-xs">
              <Phone className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Barra de inicio del iPhone */}
        <div className="w-24 h-1 bg-white/40 rounded-full mx-auto mt-2 mb-0.5" />
      </div>
    </div>
  )
}
