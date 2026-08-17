'use client'

import React from 'react'
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'

export interface ItemChecklistConfig {
  id: string
  label: string
}

const ITEMS_DEFAULT: ItemChecklistConfig[] = [
  { id: 'presupuesto_aceptado', label: 'Presupuesto Aceptado / Cotización Aprobada' },
  { id: 'autorizacion_obra_social', label: 'Autorización / Bono de Obra Social Aprobado' },
  { id: 'estudios_laboratorio', label: 'Laboratorio Completo & Coagulograma' },
  { id: 'ecg_riesgo_quirurgico', label: 'ECG & Evaluación Cardiológica (Riesgo Quirúrgico)' },
  { id: 'consentimiento_firmado', label: 'Consentimiento Informado Quirúrgico Firmado' },
  { id: 'reserva_quirofano', label: 'Reserva y Asignación de Quirófano' }
]

interface ChecklistPrequirurgicoProps {
  checklist?: Record<string, boolean> | null
  itemsConfig?: ItemChecklistConfig[]
  onChange: (nuevoChecklist: Record<string, boolean>) => void
  disabled?: boolean
}

export default function ChecklistPrequirurgico({
  checklist = {},
  itemsConfig,
  onChange,
  disabled = false
}: ChecklistPrequirurgicoProps) {
  const items = itemsConfig && itemsConfig.length > 0 ? itemsConfig : ITEMS_DEFAULT
  const checkState = checklist || {}

  const completados = items.filter((it) => !!checkState[it.id]).length
  const total = items.length
  const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0
  const isCompleto = completados === total && total > 0

  const handleToggle = (id: string) => {
    if (disabled) return
    const nuevo = {
      ...checkState,
      [id]: !checkState[id]
    }
    onChange(nuevo)
  }

  return (
    <div className="p-4 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3.5 shadow-inner">
      {/* Header del Checklist */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-emerald-400" />
          <h4 className="text-xs font-bold text-gray-200">
            Checklist Prequirúrgico Asistido
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-gray-300">
            {completados} de {total} requisitos ({porcentaje}%)
          </span>
          {isCompleto && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
              <Sparkles size={11} />
              Listo para Quirófano
            </span>
          )}
        </div>
      </div>

      {/* Barra de Progreso Dinámica */}
      <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-[var(--border)]">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            porcentaje === 100
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : porcentaje >= 50
              ? 'bg-gradient-to-r from-amber-500 to-emerald-500'
              : 'bg-gradient-to-r from-blue-500 to-amber-500'
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {/* Lista de Requisitos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {items.map((it) => {
          const checked = !!checkState[it.id]
          return (
            <button
              key={it.id}
              type="button"
              disabled={disabled}
              onClick={() => handleToggle(it.id)}
              className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-2.5 ${
                checked
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-neutral-950/70 border-[var(--border)] text-gray-400 hover:text-gray-200 hover:bg-neutral-800/60'
              }`}
            >
              {checked ? (
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={15} className="text-gray-500 shrink-0" />
              )}
              <span className={`truncate ${checked ? 'line-through opacity-90' : ''}`}>
                {it.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
