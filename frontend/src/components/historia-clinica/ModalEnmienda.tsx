'use client'

import React, { useState } from 'react'
import { X, ShieldCheck, AlertCircle, FileText, Check } from 'lucide-react'

interface ModalEnmiendaProps {
  isOpen: boolean
  onClose: () => void
  consultaId: string
  profesionalNombre?: string
  profesionalMatricula?: string
  onSubmit: (motivo: string, texto: string) => Promise<boolean>
}

const MOTIVOS_COMUNES = [
  'Salvado de error tipográfico u ortográfico',
  'Aclaración diagnóstica / semiológica',
  'Corrección de dosis o posología farmacológica',
  'Aclaración sobre ojo evaluado / lateralidad',
  'Evolución complementaria post-consulta',
  'Otro motivo médico justificado'
]

export default function ModalEnmienda({
  isOpen,
  onClose,
  consultaId,
  profesionalNombre,
  profesionalMatricula,
  onSubmit
}: ModalEnmiendaProps) {
  const [motivo, setMotivo] = useState(MOTIVOS_COMUNES[0])
  const [motivoCustom, setMotivoCustom] = useState('')
  const [texto, setTexto] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const motivoFinal = motivo === 'Otro motivo médico justificado' && motivoCustom.trim()
    ? motivoCustom.trim()
    : motivo

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) {
      setError('Debe ingresar el texto de la adenda o aclaración clínica.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const ok = await onSubmit(motivoFinal, texto.trim())
      if (ok) {
        setTexto('')
        setMotivoCustom('')
        onClose()
      }
    } catch (err: any) {
      setError(err?.message || 'Error al registrar la adenda.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">
                Nueva Adenda / Enmienda Legal
              </h3>
              <p className="text-[11px] text-amber-100">
                Ley 26.529 Art. 15 · Salvado de Errores e Inmutabilidad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 border-b border-amber-200/70 px-5 py-3 flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            La consulta médica firmada es inalterable. Esta enmienda se foliara cronológicamente
            con firma electrónica y sello de tiempo inmutable.
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Motivo o Justificación del Salvado
            </label>
            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            >
              {MOTIVOS_COMUNES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {motivo === 'Otro motivo médico justificado' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Especifique el motivo
              </label>
              <input
                type="text"
                value={motivoCustom}
                onChange={e => setMotivoCustom(e.target.value)}
                placeholder="Ej: Ampliación tras interconsulta con especialista..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Texto de la Adenda / Corrección Clínica *
            </label>
            <textarea
              rows={4}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Describa el salvado o adenda. Ej: 'Donde decía OD 0.75, corresponde corregir a OD 1.25 según prueba ambulatoria...'"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none leading-relaxed"
            />
          </div>

          {/* Profesional actuante */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex items-center justify-between text-[11px] text-slate-600">
            <div>
              <span className="font-bold text-slate-700">Profesional:</span> {profesionalNombre || 'Médico actuante'}
              {profesionalMatricula && (
                <span className="text-slate-500 ml-1.5">(M.P. {profesionalMatricula})</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SHA-256</span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold transition-colors text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !texto.trim()}
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold transition-all shadow-md flex items-center gap-1.5 text-xs"
            >
              {submitting ? (
                <>Guardando...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Registrar Adenda Foliada
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
