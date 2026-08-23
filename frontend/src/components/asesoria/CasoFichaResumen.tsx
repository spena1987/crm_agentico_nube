'use client'

import React from 'react'
import {
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Stethoscope,
  UserCheck,
  Calendar,
  DollarSign,
  ClipboardList,
  ShieldCheck,
  FileText,
  FileCheck2,
  HeartPulse,
  Activity
} from 'lucide-react'
import { AsesoriaQuirurgica, PresupuestoPaciente } from '@/components/ItemCasoQuirurgicoAcordeon'
import TimelineEvolucionesAsesoria from '@/components/TimelineEvolucionesAsesoria'

interface CasoFichaResumenProps {
  caso: AsesoriaQuirurgica
  pacienteNombre: string
  presupuestos: PresupuestoPaciente[]
  consentimientoInfo?: any
  guardando: boolean
  onReabrirCaso: () => void
  onTogglePostOpCheck: (campo: 'control_postop_24h' | 'control_postop_7d' | 'alta_medica_definitiva') => void
}

export default function CasoFichaResumen({
  caso,
  pacienteNombre,
  presupuestos,
  consentimientoInfo,
  guardando,
  onReabrirCaso,
  onTogglePostOpCheck
}: CasoFichaResumenProps) {
  const esOperado = caso.estado === 'operado'
  const presupuestoVinculado = presupuestos.find((p) => p.id === caso.presupuesto_id)

  return (
    <div className="p-5 space-y-5 bg-neutral-950/70">
      {/* Sello de Expediente Cerrado / Concluido */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          esOperado
            ? 'bg-teal-950/30 border-teal-500/40 text-teal-200'
            : 'bg-red-950/30 border-red-500/40 text-red-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              esOperado
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-red-500/20 text-red-300 border border-red-500/40'
            }`}
          >
            {esOperado ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">
                {esOperado
                  ? 'Ficha de Cirugía Concluida (Operado)'
                  : 'Ficha de Caso Desistido / Cancelado'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-gray-300">
                🔒 Solo Lectura
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              {esOperado
                ? `Intervención quirúrgica efectuada con éxito para ${pacienteNombre}.`
                : `Procedimiento cancelado. Motivo: ${caso.motivo_cancelacion || 'No especificado'}.`}
            </p>
          </div>
        </div>

        {/* Botón Reabrir Caso */}
        <button
          type="button"
          onClick={onReabrirCaso}
          disabled={guardando}
          className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow shrink-0 self-start sm:self-center"
        >
          <Unlock size={14} className="text-amber-400" />
          <span>Reabrir Caso para Modificar</span>
        </button>
      </div>

      {/* Grilla de 2 Columnas de Archivo Clínico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* COLUMNA 1: Datos Médicos, Económicos y Fechas */}
        <div className="space-y-4">
          {/* Card: Práctica & Cobertura */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-2">
            <div className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-1.5">
              <ClipboardList size={13} className="text-indigo-400" />
              Práctica Quirúrgica & Cobertura
            </div>
            <div className="text-sm font-bold text-white">
              {caso.practica_codigo && <span className="font-mono text-indigo-300 font-bold mr-1.5">[{caso.practica_codigo}]</span>}
              {caso.practica_nombre}
            </div>
            <div className="text-xs text-gray-400">
              Cobertura / Prepaga:{' '}
              <strong className="text-blue-300">{caso.cobertura_obra_social || 'Particular'}</strong>
            </div>
          </div>

          {/* Card: Equipo Médico */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-[var(--border)] grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                <UserCheck size={12} className="text-blue-400" />
                Médico Derivador
              </div>
              <div className="text-xs font-bold text-white mt-1">
                {caso.medico_derivador_nombre || 'No registrado'}
              </div>
              {caso.medico_derivador_matricula && (
                <div className="text-[10px] text-gray-400 font-mono">
                  Mat: {caso.medico_derivador_matricula}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                <Stethoscope size={12} className="text-emerald-400" />
                Médico Cirujano
              </div>
              <div className="text-xs font-bold text-white mt-1">
                {caso.medico_cirujano_nombre || 'No asignado'}
              </div>
              {caso.medico_cirujano_matricula && (
                <div className="text-[10px] text-gray-400 font-mono">
                  Mat: {caso.medico_cirujano_matricula}
                </div>
              )}
            </div>
          </div>

          {/* Card: Fechas & Liquidación */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-[var(--border)] grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                <Calendar size={12} className="text-amber-400" />
                Fecha Quirúrgica
              </div>
              <div className="text-xs font-mono font-bold text-emerald-300 mt-1">
                {caso.fecha_definitiva_cirugia || caso.fecha_probable_cirugia || 'Sin fecha fijada'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-400" />
                Cotización / Monto
              </div>
              <div className="text-xs font-mono font-bold text-white mt-1">
                {Number(caso.monto_extra || 0) > 0 ? (
                  caso.moneda_extra === 'USD' ? (
                    <span className="text-amber-400">USD {Number(caso.monto_extra).toLocaleString('es-AR')}</span>
                  ) : (
                    <span className="text-emerald-400">${Number(caso.monto_extra).toLocaleString('es-AR')} ARS</span>
                  )
                ) : (
                  <span className="text-gray-500">Sin cotizar</span>
                )}
              </div>
              {Number(caso.monto_sena || 0) > 0 && (
                <div className="text-[10px] text-blue-300 font-mono mt-0.5">
                  Seña abonada: ${Number(caso.monto_sena).toLocaleString('es-AR')}
                </div>
              )}
            </div>
          </div>

          {/* Sub-etapa: Controles Post-Quirúrgicos (Habilitado para seguimiento clínico) */}
          {esOperado && (
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-teal-500/30 space-y-2.5">
              <div className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <HeartPulse size={14} className="text-teal-400" />
                Seguimiento & Controles Post-Quirúrgicos
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950/80 border border-[var(--border)] cursor-pointer hover:border-teal-500/50 transition-all text-xs">
                  <input
                    type="checkbox"
                    checked={!!caso.control_postop_24h}
                    onChange={() => onTogglePostOpCheck('control_postop_24h')}
                    className="rounded text-teal-600 focus:ring-teal-500 bg-neutral-900 border-gray-700"
                  />
                  <span className="text-gray-300 text-[11px]">Control 24h</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950/80 border border-[var(--border)] cursor-pointer hover:border-teal-500/50 transition-all text-xs">
                  <input
                    type="checkbox"
                    checked={!!caso.control_postop_7d}
                    onChange={() => onTogglePostOpCheck('control_postop_7d')}
                    className="rounded text-teal-600 focus:ring-teal-500 bg-neutral-900 border-gray-700"
                  />
                  <span className="text-gray-300 text-[11px]">Control 7-10d</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950/80 border border-[var(--border)] cursor-pointer hover:border-teal-500/50 transition-all text-xs">
                  <input
                    type="checkbox"
                    checked={!!caso.alta_medica_definitiva}
                    onChange={() => onTogglePostOpCheck('alta_medica_definitiva')}
                    className="rounded text-teal-600 focus:ring-teal-500 bg-neutral-900 border-gray-700"
                  />
                  <span className="text-gray-300 text-[11px]">Alta Definitiva</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA 2: Bitácora Histórica Bloqueada */}
        <div className="space-y-4">
          <TimelineEvolucionesAsesoria
            asesoriaId={caso.id}
            pacienteId={caso.paciente_id}
            pacienteNombre={pacienteNombre}
            disabled={true}
          />
        </div>
      </div>
    </div>
  )
}
