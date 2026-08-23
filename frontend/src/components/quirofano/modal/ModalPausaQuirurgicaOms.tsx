'use client'

import React, { useState } from 'react'
import { ShieldCheck, User, Eye, FileCheck2, Sparkles, X, Play, Loader2 } from 'lucide-react'

interface ModalPausaQuirurgicaOmsProps {
  isOpen: boolean
  onClose: () => void
  turno: any
  onConfirmarInicio: () => void
  procesando: boolean
}

export default function ModalPausaQuirurgicaOms({
  isOpen,
  onClose,
  turno,
  onConfirmarInicio,
  procesando
}: ModalPausaQuirurgicaOmsProps) {
  const [checkIdentidad, setCheckIdentidad] = useState(true)
  const [checkConsentimiento, setCheckConsentimiento] = useState(true)
  const [checkLio, setCheckLio] = useState(true)
  const [checkEsterilidad, setCheckEsterilidad] = useState(true)

  if (!isOpen || !turno) return null

  const paciente = turno.pacientes || {}
  const pacNombre = paciente.nombre || 'Paciente'
  const pacDni = paciente.dni || 'S/D'
  const ojo = turno.ojo || 'OD'
  const ojoDesc = ojo === 'OD' ? 'OJO DERECHO (OD)' : ojo === 'OI' ? 'OJO IZQUIERDO (OI)' : 'AMBOS OJOS (AO)'

  const todosVerificados = checkIdentidad && checkConsentimiento && checkLio && checkEsterilidad

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[var(--card)] border-2 border-purple-500/40 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
              <ShieldCheck size={26} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-amber-400 text-purple-950 font-extrabold">
                  Protocolo OMS
                </span>
                <span className="text-xs text-purple-200 font-semibold">Pausa Quirúrgica (Time-Out)</span>
              </div>
              <h3 className="text-lg font-extrabold tracking-tight mt-0.5">Verificación de Seguridad Pre-Incisión</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={procesando}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo con 4 Checks de Seguridad */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-[var(--secondary)]">
            Antes de dar inicio a la intervención quirúrgica, el equipo debe verificar en voz alta las siguientes condiciones de seguridad:
          </p>

          {/* Check 1: Identidad y Lateralidad */}
          <label className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
            checkIdentidad ? 'bg-purple-500/5 border-purple-500/40 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)]'
          }`}>
            <input
              type="checkbox"
              checked={checkIdentidad}
              onChange={(e) => setCheckIdentidad(e.target.checked)}
              className="mt-1 w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
            />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                <User size={14} className="text-purple-600" />
                <span>Identidad de Paciente & Lateralidad Ocular</span>
              </p>
              <p className="text-[var(--secondary)]">
                Paciente: <b className="text-[var(--foreground)]">{pacNombre}</b> (DNI: {pacDni})
              </p>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-[11px]">
                <Eye size={12} />
                <span>Intervención en: {ojoDesc}</span>
              </div>
            </div>
          </label>

          {/* Check 2: Consentimiento Informado */}
          <label className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
            checkConsentimiento ? 'bg-purple-500/5 border-purple-500/40 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)]'
          }`}>
            <input
              type="checkbox"
              checked={checkConsentimiento}
              onChange={(e) => setCheckConsentimiento(e.target.checked)}
              className="mt-1 w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
            />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                <FileCheck2 size={14} className="text-emerald-600" />
                <span>Consentimiento Informado Firmado y Verificado</span>
              </p>
              <p className="text-[var(--secondary)]">
                Estado registrado: <b className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {turno.consentimiento_estado === 'firmado_digital' ? '✔ Firmado Digitalmente' : '✔ Verificado en Sala'}
                </b>
              </p>
            </div>
          </label>

          {/* Check 3: Lente Intraocular (LIO) en Sala */}
          {turno.lleva_lente && (
            <label className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              checkLio ? 'bg-purple-500/5 border-purple-500/40 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)]'
            }`}>
              <input
                type="checkbox"
                checked={checkLio}
                onChange={(e) => setCheckLio(e.target.checked)}
                className="mt-1 w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <Sparkles size={14} className="text-blue-600" />
                  <span>Lente Intraocular (LIO) Verificado en Quirófano</span>
                </p>
                <div className="text-[11px] text-[var(--secondary)] space-y-0.5 font-medium">
                  <p>Modelo: <b className="text-[var(--foreground)]">{turno.lente_tipo || 'Estándar'}</b> | Dioptría: <b className="text-blue-600">{turno.lente_dioptria || 'N/D'} D</b></p>
                  {turno.es_torico && (
                    <p className="text-purple-600 dark:text-purple-400 font-bold">
                      Tórico: T{turno.lente_torico_valor || 0} - Eje de Implante: {turno.lente_torico_eje || 90}°
                    </p>
                  )}
                </div>
              </div>
            </label>
          )}

          {/* Check 4: Equipamiento, Esterilidad y Anestesia */}
          <label className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
            checkEsterilidad ? 'bg-purple-500/5 border-purple-500/40 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)]'
          }`}>
            <input
              type="checkbox"
              checked={checkEsterilidad}
              onChange={(e) => setCheckEsterilidad(e.target.checked)}
              className="mt-1 w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
            />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-[var(--foreground)]">Esterilidad, Instrumental y Anestesia Conforme</p>
              <p className="text-[var(--secondary)]">
                Cirujano: <b>{turno.cirujano_nombre || 'Asignado'}</b> | Anestesia: <b>{turno.tipo_anestesia || 'Tópica'}</b>
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 border-t border-[var(--border)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirmarInicio}
            disabled={!todosVerificados || procesando}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
          >
            {procesando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Iniciando...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>🟣 Iniciar Cirugía Verificada</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}