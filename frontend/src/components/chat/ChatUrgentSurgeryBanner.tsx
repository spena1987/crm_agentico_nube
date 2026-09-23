'use client'

import React, { useState } from 'react'
import { 
  AlertTriangle, 
  Eye, 
  PhoneCall, 
  CheckCircle2, 
  UserCheck, 
  Calendar, 
  Clock, 
  Stethoscope, 
  ShieldAlert,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { formatPhoneDisplay } from '@/lib/phoneUtils'

interface ChatUrgentSurgeryBannerProps {
  conversacion: any
  paciente: any
  onResolverUrgencia: () => Promise<void>
  onOpenHistoriaClinica?: () => void
}

export default function ChatUrgentSurgeryBanner({
  conversacion,
  paciente,
  onResolverUrgencia,
  onOpenHistoriaClinica
}: ChatUrgentSurgeryBannerProps) {
  const [resolving, setResolving] = useState(false)

  const meta = conversacion?.metadata_json || {}
  const ctxQx = meta?.contexto_quirurgico || {}

  const ojo = ctxQx?.ojo || meta?.ojo || 'OD'
  const practica = ctxQx?.practica_nombre || 'Cirugía Oftalmológica'
  const fechaQx = ctxQx?.fecha_cirugia || 'Reciente'
  const diasPostop = ctxQx?.dias_postop !== undefined && ctxQx?.dias_postop !== null ? ctxQx.dias_postop : null
  const lio = ctxQx?.lio_detalle || null
  const cirujano = meta?.cirujano_notificado || ctxQx?.cirujano_nombre_caso || 'Médico de Guardia'
  const sintoma = meta?.motivo_detectado || conversacion?.ultimo_mensaje || 'Molestia aguda reportada por el paciente'

  const handleResolve = async () => {
    try {
      setResolving(true)
      await onResolverUrgencia()
    } finally {
      setResolving(false)
    }
  }

  const pacienteTel = paciente?.telefono || conversacion?.paciente?.telefono

  return (
    <div className="bg-gradient-to-r from-red-950/90 via-red-900/80 to-slate-900 border-b border-red-500/60 p-3 sm:p-4 text-white shadow-lg animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Lado Izquierdo: Insignia y Datos Clínicos Clave */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1.5 shadow-sm animate-pulse">
              <AlertTriangle size={12} className="fill-white" />
              <span>ALERTA DE SEGURIDAD QUIRÚRGICA</span>
            </span>

            {/* Ojo Operado */}
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-900/80 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <Eye size={12} />
              <span>Ojo: {ojo}</span>
            </span>

            {/* Días Postoperatorios */}
            {diasPostop !== null && (
              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-900/80 text-slate-200 border border-slate-700 flex items-center gap-1">
                <Clock size={11} className="text-slate-400" />
                <span>Post-QX: hace {diasPostop} {diasPostop === 1 ? 'día' : 'días'}</span>
              </span>
            )}

            {/* Cirujano Notificado */}
            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-900/80 text-emerald-300 border border-emerald-600/40 flex items-center gap-1 truncate max-w-[200px]" title={`Cirujano: ${cirujano}`}>
              <UserCheck size={11} className="text-emerald-400 shrink-0" />
              <span className="truncate">{cirujano}</span>
            </span>
          </div>

          {/* Procedimiento y LIO */}
          <div className="text-xs text-slate-200 flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{practica}</span>
            {fechaQx && <span className="text-slate-400 text-[11px]">({fechaQx})</span>}
            {lio && (
              <span className="text-[11px] text-blue-300 bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-800/50">
                LIO: {lio}
              </span>
            )}
          </div>

          {/* Síntoma de Alarma Reportado */}
          <div className="p-2 rounded-lg bg-black/40 border border-red-500/30 text-xs">
            <span className="text-red-300 font-bold uppercase text-[10px] tracking-wider block mb-0.5">
              ⚠️ Síntoma de Alarma Informado por el Paciente:
            </span>
            <p className="text-red-100 font-medium italic truncate">
              "{sintoma}"
            </p>
          </div>
        </div>

        {/* Lado Derecho: Acciones Médicas de Emergencia */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Botón de Llamada Rápida */}
          {pacienteTel && (
            <a
              href={`tel:${pacienteTel.replace(/\D/g, '')}`}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md hover:shadow-emerald-600/30 transition-all cursor-pointer"
              title={`Llamar a ${formatPhoneDisplay(pacienteTel)}`}
            >
              <PhoneCall size={14} />
              <span>Llamar Paciente</span>
            </a>
          )}

          {/* Ver Historia Clínica */}
          {onOpenHistoriaClinica && (
            <button
              type="button"
              onClick={onOpenHistoriaClinica}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
            >
              <ExternalLink size={13} />
              <span>Historia Clínica</span>
            </button>
          )}

          {/* Marcar Urgencia Resuelta */}
          <button
            type="button"
            onClick={handleResolve}
            disabled={resolving}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md hover:shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
            title="Desactivar el alerta roja una vez que el paciente fue atendido o medicado"
          >
            {resolving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            <span>{resolving ? 'Guardando...' : 'Marcar Atendida'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
