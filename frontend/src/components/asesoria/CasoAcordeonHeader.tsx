'use client'

import React from 'react'
import {
  Stethoscope,
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  ShieldAlert,
  Tag
} from 'lucide-react'
import { AsesoriaQuirurgica } from '@/components/ItemCasoQuirurgicoAcordeon'

interface CasoAcordeonHeaderProps {
  caso: AsesoriaQuirurgica
  index: number
  isExpanded: boolean
  onToggle: () => void
  etapaActual: {
    id: string
    label: string
    color: string
    headerBg: string
    headerBorder: string
    desc: string
  }
  esCasoCerrado: boolean
  diasSinContacto: number
  alertaSla: boolean
  criticoSla: boolean
  consentimientoInfo?: any
}

export default function CasoAcordeonHeader({
  caso,
  index,
  isExpanded,
  onToggle,
  etapaActual,
  esCasoCerrado,
  diasSinContacto,
  alertaSla,
  criticoSla,
  consentimientoInfo
}: CasoAcordeonHeaderProps) {
  return (
    <div
      onClick={onToggle}
      className={`p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none transition-all ${
        esCasoCerrado
          ? caso.estado === 'operado'
            ? 'bg-neutral-900/90 border-b border-teal-500/20'
            : 'bg-neutral-900/90 border-b border-red-500/20'
          : isExpanded
          ? 'bg-neutral-900/95 border-b border-[var(--border)]'
          : 'bg-neutral-900/50 hover:bg-neutral-900/80'
      }`}
    >
      {/* Lado Izquierdo: Número Institucional QX, Lateralidad, Título de Práctica y Especialista */}
      <div className="flex items-start md:items-center gap-3 min-w-0">
        <div className="shrink-0 flex items-center gap-1">
          <div
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-bold font-mono text-xs shadow-sm border ${
              esCasoCerrado
                ? caso.estado === 'operado'
                  ? 'bg-teal-950 text-teal-300 border-teal-800'
                  : 'bg-red-950 text-red-300 border-red-800'
                : 'bg-blue-950/90 text-blue-300 border-blue-500/50'
            }`}
          >
            {esCasoCerrado ? <Lock size={12} className="text-teal-400" /> : <Tag size={12} className="text-blue-400" />}
            <span className="tracking-wide">{caso.codigo_caso || (caso.checklist_prequirurgico as any)?._codigo_caso || (caso.id ? `QX-26-${caso.id.slice(0, 4).toUpperCase()}` : `QX-26-${String(index + 1).padStart(4, '0')}`)}</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-white truncate max-w-md">
              {caso.practica_nombre || 'Cirugía / Procedimiento sin determinar'}
            </h4>
            {caso.practica_codigo && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-gray-400 border border-[var(--border)]">
                {caso.practica_codigo}
              </span>
            )}
            {/* Badge de Ojo */}
            {caso.ojo && (
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border font-mono ${
                caso.ojo === 'OD'
                  ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                  : caso.ojo === 'OI'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-purple-950/80 text-purple-300 border-purple-500/40'
              }`}>
                {caso.ojo === 'OD' ? '👁️ OD' : caso.ojo === 'OI' ? '👁️ OI' : '👁️👁️ AO'}
              </span>
            )}
            {/* Badge de Quirófano Agendado */}
            {(caso.turnos_activos?.length || (caso as any).turnos_quirofano?.filter((t: any) => t.estado !== 'cancelado')?.length) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                🏥 Quirófano Agendado
              </span>
            )}
            {esCasoCerrado && (
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  caso.estado === 'operado'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}
              >
                {caso.estado === 'operado' ? '✔ Expediente Operado' : '✖ Expediente Desistido'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
            {caso.medico_cirujano_nombre ? (
              <span className="flex items-center gap-1 text-gray-300">
                <Stethoscope size={12} className="text-emerald-400" />
                Cirujano: <strong className="text-white">{caso.medico_cirujano_nombre}</strong>
              </span>
            ) : (
              <span className="text-gray-500 italic">Cirujano sin asignar</span>
            )}

            {caso.medico_derivador_nombre && (
              <span className="text-gray-400 text-[11px]">
                • Derivado por: {caso.medico_derivador_nombre}
              </span>
            )}

            {caso.cobertura_obra_social && (
              <span className="text-blue-400/90 text-[11px] font-medium">
                • {caso.cobertura_obra_social}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lado Derecho: Semáforo SLA, Fechas, Importe y Flecha */}
      <div className="flex flex-wrap items-center gap-2.5 shrink-0 justify-end">
        {/* Alerta SLA de inactividad (solo en casos activos) */}
        {!esCasoCerrado && diasSinContacto > 0 && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
              criticoSla
                ? 'bg-red-950 text-red-300 border-red-500/40 animate-pulse'
                : alertaSla
                ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                : 'bg-neutral-800 text-gray-400 border-[var(--border)]'
            }`}
          >
            <Clock size={11} />
            {diasSinContacto}d sin contacto
          </span>
        )}

        {/* Badge de Consentimiento Informado */}
        {consentimientoInfo && consentimientoInfo.firmado && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-400" />
            CI Firmado
          </span>
        )}

        {/* Fecha Quirúrgica */}
        {caso.fecha_definitiva_cirugia ? (
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
            <Calendar size={12} className="text-emerald-400" />
            {caso.fecha_definitiva_cirugia}
          </span>
        ) : caso.fecha_probable_cirugia ? (
          <span className="text-xs font-mono px-2 py-1 rounded-xl bg-neutral-800 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
            <Calendar size={12} className="text-amber-400" />
            Probable: {caso.fecha_probable_cirugia}
          </span>
        ) : null}

        {/* Importe Cotizado / Extra */}
        {Number(caso.monto_extra || 0) > 0 ? (
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-neutral-900 border border-[var(--border)] shadow-sm">
            {caso.moneda_extra === 'USD' ? (
              <span className="text-amber-400">USD {Number(caso.monto_extra).toLocaleString('es-AR')}</span>
            ) : (
              <span className="text-emerald-400">${Number(caso.monto_extra).toLocaleString('es-AR')} ARS</span>
            )}
          </span>
        ) : null}

        {/* Etapa actual */}
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${etapaActual.color}`}
        >
          {etapaActual.label}
        </span>

        {/* Chevron Desplegable */}
        <div className="w-7 h-7 rounded-lg bg-neutral-800/80 border border-[var(--border)] flex items-center justify-center text-gray-400 group-hover:text-white">
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>
    </div>
  )
}
