'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Check, Link2, Loader2, Search, UserCheck, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { GeclisaPacienteCandidato, OpticaConversacion } from '@/types/optica'

interface ModalVincularPacienteGeclisaProps {
  isOpen: boolean
  onClose: () => void
  conversacion: OpticaConversacion
  onVinculado: (conversacionActualizada: OpticaConversacion) => void
}

const FUENTE_LABEL: Record<string, { text: string; badgeClass: string }> = {
  geclisa: {
    text: 'Geclisa en vivo',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  optica_contactos: {
    text: 'Contactos Óptica',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  },
  pacientes: {
    text: 'CRM Pacientes',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
}

export default function ModalVincularPacienteGeclisa({
  isOpen,
  onClose,
  conversacion,
  onVinculado,
}: ModalVincularPacienteGeclisaProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [vincularId, setVincularId] = useState<string | null>(null)
  const [candidatos, setCandidatos] = useState<GeclisaPacienteCandidato[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setCandidatos([])
      setWarning(null)
      setErrorMsg(null)
      setVincularId(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setCandidatos([])
      setWarning(null)
      setLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setErrorMsg(null)
      try {
        const res = await apiFetch(
          `/api/optica-vortix/geclisa/buscar-paciente?q=${encodeURIComponent(trimmed)}`,
          { cache: 'no-store' }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setErrorMsg(data.detail || 'No se pudo buscar el paciente.')
          setCandidatos([])
        } else {
          setCandidatos(Array.isArray(data.candidatos) ? data.candidatos : [])
          setWarning(data.warning || null)
        }
      } catch (err) {
        setErrorMsg('Error de conexión al buscar paciente en Geclisa.')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, isOpen])

  if (!isOpen) return null

  const titularNombre =
    conversacion.titular_telefono_nombre || conversacion.nombre_paciente || conversacion.telefono

  const handleVincular = async (cand: GeclisaPacienteCandidato) => {
    setVincularId(cand.ficha_geclisa_id)
    setErrorMsg(null)
    try {
      const res = await apiFetch(
        `/api/optica-vortix/conversaciones/${conversacion.id}/vincular-paciente`,
        {
          method: 'POST',
          body: JSON.stringify({
            ficha_geclisa_id: cand.ficha_geclisa_id,
            nombre: cand.nombre,
            dni: cand.dni || null,
            obra_social: cand.obra_social || null,
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.detail || 'No se pudo vincular la ficha.')
        return
      }
      if (data.conversacion) {
        onVinculado(data.conversacion)
      }
      onClose()
    } catch {
      setErrorMsg('Error de red al vincular la ficha.')
    } finally {
      setVincularId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Cabecera */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Link2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--foreground)]">
                Vincular otra ficha de Geclisa a este chat
              </h3>
              <p className="text-[11px] text-[var(--secondary)]">
                Tel. +{conversacion.telefono} • Titular: <strong>{titularNombre}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-[var(--secondary)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-800 dark:text-indigo-200 leading-relaxed">
            <strong>Teléfono compartido:</strong> Esta acción asocia la historia clínica, obra social y recetas OCR{' '}
            <strong>solo a esta conversación</strong>. El titular del teléfono ({titularNombre}) se mantiene intacto para futuras campañas.
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ingresá DNI o N° de ficha Geclisa (en vivo), o nombre/apellido local..."
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
            <p className="text-[10.5px] text-[var(--secondary)]">
              Tip: Con números (ej. <code className="font-mono">39111222</code> o N° de ficha) consulta Geclisa en vivo; con texto busca pacientes ya sincronizados en el CRM.
            </p>
          </div>

          {warning && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-[var(--secondary)]">
              <Loader2 size={20} className="animate-spin text-indigo-500" />
              <span className="text-xs">Buscando fichas de pacientes...</span>
            </div>
          ) : query.trim().length < 2 ? (
            <div className="py-8 text-center text-xs text-[var(--secondary)]">
              Escribí al menos 2 caracteres para buscar al paciente real que escribe desde este teléfono.
            </div>
          ) : candidatos.length === 0 ? (
            <div className="py-8 text-center space-y-1 text-xs text-[var(--secondary)]">
              <p className="font-bold text-[var(--foreground)]">Sin coincidencias</p>
              <p>Probá buscar por el DNI exacto o número de ficha de Geclisa.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidatos.map((cand) => {
                const fuenteMeta = FUENTE_LABEL[cand.fuente] || {
                  text: cand.fuente,
                  badgeClass: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
                }
                const isSaving = vincularId === cand.ficha_geclisa_id
                const isAlready =
                  Boolean(conversacion.vinculacion_manual) &&
                  String(conversacion.paciente_vinculado_ficha_id || '') === cand.ficha_geclisa_id

                return (
                  <div
                    key={cand.ficha_geclisa_id}
                    className="p-3 rounded-xl border border-[var(--border)] bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-[var(--foreground)] truncate">
                          {cand.nombre}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-bold border ${fuenteMeta.badgeClass}`}
                        >
                          {fuenteMeta.text}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--secondary)]">
                        Ficha N° <strong>{cand.ficha_geclisa_id}</strong>
                        {cand.dni ? ` • DNI ${cand.dni}` : ''}
                        {cand.obra_social ? ` • ${cand.obra_social}` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(vincularId) || isAlready}
                      onClick={() => handleVincular(cand)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                        isAlready
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60'
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : isAlready ? (
                        <Check size={13} />
                      ) : (
                        <UserCheck size={13} />
                      )}
                      <span>{isAlready ? 'Vinculado' : 'Vincular'}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
