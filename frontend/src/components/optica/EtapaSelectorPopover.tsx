'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Clock, ShieldCheck } from 'lucide-react'
import { EtapaComercialOptica } from '@/types/optica'

export interface EtapaOpticaMeta {
  code: EtapaComercialOptica
  label: string
  short: string
  grupo: 'ingreso' | 'gestion_30d' | 'cierre'
  color: string
  dotClass: string
  protegida30d?: boolean
}

export const ETAPAS_OPTICA_LIST: EtapaOpticaMeta[] = [
  {
    code: 'NUEVA_CONSULTA',
    label: 'Nueva Consulta',
    short: 'Nueva',
    grupo: 'ingreso',
    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-500',
  },
  {
    code: 'CONSULTA_ARMAZON',
    label: 'Consulta Armazón',
    short: 'Armazón',
    grupo: 'gestion_30d',
    color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    dotClass: 'bg-purple-500',
    protegida30d: true,
  },
  {
    code: 'PRESUPUESTO_AEREOS',
    label: 'Presupuesto Aéreos',
    short: 'Aéreos',
    grupo: 'gestion_30d',
    color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-500',
    protegida30d: true,
  },
  {
    code: 'LENTES_CONTACTO',
    label: 'Lentes de Contacto',
    short: 'Contacto',
    grupo: 'gestion_30d',
    color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    dotClass: 'bg-cyan-500',
    protegida30d: true,
  },
  {
    code: 'EN_LABORATORIO',
    label: 'En Laboratorio',
    short: 'Laboratorio',
    grupo: 'gestion_30d',
    color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    dotClass: 'bg-indigo-500',
    protegida30d: true,
  },
  {
    code: 'LISTO_PARA_RETIRAR',
    label: 'Listo para Retirar',
    short: 'Retirar',
    grupo: 'gestion_30d',
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    protegida30d: true,
  },
  {
    code: 'VENDIDO',
    label: 'Vendido',
    short: 'Vendido',
    grupo: 'cierre',
    color: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
    dotClass: 'bg-green-500',
  },
  {
    code: 'SIN_INTERES',
    label: 'Sin Interés',
    short: 'Sin interés',
    grupo: 'cierre',
    color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    dotClass: 'bg-slate-400',
  },
]

const GRUPOS_ETAPAS: { key: EtapaOpticaMeta['grupo']; titulo: string; subtitulo?: string }[] = [
  { key: 'ingreso', titulo: 'Ingreso' },
  { key: 'gestion_30d', titulo: 'En Gestión', subtitulo: 'Permanece activa hasta 30 días' },
  { key: 'cierre', titulo: 'Cierre' },
]

interface EtapaSelectorPopoverProps {
  value: EtapaComercialOptica
  onChange: (etapa: EtapaComercialOptica) => void | Promise<void>
  disabled?: boolean
  variant?: 'header' | 'compact'
  etapaUpdatedAt?: string | null
  clasificacionOrigen?: string | null
}

export default function EtapaSelectorPopover({
  value,
  onChange,
  disabled = false,
  variant = 'header',
  etapaUpdatedAt,
  clasificacionOrigen,
}: EtapaSelectorPopoverProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentMeta =
    ETAPAS_OPTICA_LIST.find((e) => e.code === value) || ETAPAS_OPTICA_LIST[0]

  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleSelect = async (etapa: EtapaComercialOptica) => {
    setOpen(false)
    if (etapa !== value) {
      await onChange(etapa)
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={
          etapaUpdatedAt
            ? `Etapa actualizada (${clasificacionOrigen || 'manual'})`
            : 'Clasificar etapa del paciente'
        }
        className={`flex items-center gap-1.5 rounded-xl border font-bold transition-all disabled:opacity-60 ${
          variant === 'compact'
            ? 'w-full justify-between px-2.5 py-1.5 text-[11px]'
            : 'px-3 py-1.5 text-xs'
        } ${currentMeta.color} hover:brightness-95`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${currentMeta.dotClass}`} />
          <span className="truncate">
            {variant === 'compact' ? currentMeta.label : `Etapa: ${currentMeta.label}`}
          </span>
        </span>
        {currentMeta.protegida30d && variant === 'header' && (
          <span
            className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/60 dark:bg-slate-900/50 text-[9.5px] font-black"
            title="Esta etapa no se cierra a las 24h; permanece en Activas hasta 30 días sin movimiento"
          >
            <ShieldCheck size={10} />
            30d
          </span>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-64 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl z-50 overflow-hidden py-1.5"
        >
          {GRUPOS_ETAPAS.map((grupo, idx) => {
            const items = ETAPAS_OPTICA_LIST.filter((e) => e.grupo === grupo.key)
            return (
              <div
                key={grupo.key}
                className={idx > 0 ? 'mt-1 pt-1 border-t border-[var(--border)]' : ''}
              >
                <div className="px-3 py-1 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--secondary)]">
                    {grupo.titulo}
                  </span>
                  {grupo.subtitulo && (
                    <span className="text-[9.5px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                      <Clock size={9} />
                      30d activa
                    </span>
                  )}
                </div>
                <div className="px-1.5 space-y-0.5">
                  {items.map((item) => {
                    const selected = item.code === value
                    return (
                      <button
                        key={item.code}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => handleSelect(item.code)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                          selected
                            ? 'bg-indigo-600 text-white'
                            : 'text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              selected ? 'bg-white' : item.dotClass
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {selected && <Check size={13} className="shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
