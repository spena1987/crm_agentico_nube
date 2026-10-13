'use client'

import React, { useState } from 'react'
import {
  X,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ChevronRight,
  User,
  FileText
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ModalQuickRecontactoProps {
  isOpen: boolean
  onClose: () => void
  caso: any
  onRecontactoGuardado: () => void
}

export default function ModalQuickRecontacto({
  isOpen,
  onClose,
  caso,
  onRecontactoGuardado
}: ModalQuickRecontactoProps) {
  const [accion, setAccion] = useState<'reprogramar' | 'confirmado' | 'no_responde' | 'desiste'>('reprogramar')
  const [nota, setNota] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().slice(0, 10)
  })
  const [categoriaCausa, setCategoriaCausa] = useState('Económica / Presupuesto')
  const [motivoDemora, setMotivoDemora] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !caso) return null

  const paciente = caso.pacientes || {}
  const telefono = paciente.telefono || caso.telefono || ''
  const nombrePaciente = paciente.nombre || caso.paciente_nombre || 'Paciente'

  // Presets rápidos para reprogramación
  const setPresetDias = (dias: number) => {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    setNuevaFecha(d.toISOString().slice(0, 10))
  }

  // Generar link directo de WhatsApp Web / App
  const cleanPhone = telefono.replace(/[^0-9]/g, '')
  const phoneFormatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`
  const textoMensajeWa = encodeURIComponent(
    `Hola ${nombrePaciente}, te escribo desde la clínica respecto a tu presupuesto para ${caso.practica_nombre || 'tu cirugía'}. ¿Pudiste evaluarlo o tienes alguna consulta que podamos resolverte?`
  )
  const waUrl = cleanPhone ? `https://wa.me/${phoneFormatted}?text=${textoMensajeWa}` : null

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setGuardando(true)
      setError(null)

      const payload = {
        accion,
        nota: nota.trim(),
        nueva_fecha: accion === 'reprogramar' || accion === 'no_responde' ? nuevaFecha : null,
        categoria_causa: accion === 'desiste' ? categoriaCausa : null,
        motivo_demora: accion === 'desiste' ? (motivoDemora.trim() || nota.trim()) : null,
        autor: 'Asesora Quirúrgica'
      }

      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}/quick-recontacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || 'Error al registrar el recontacto.')
      }

      onRecontactoGuardado()
      onClose()
    } catch (err: any) {
      console.error('Error registrando quick recontacto:', err)
      setError(err.message || 'No se pudo registrar la acción.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-neutral-950/80 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Registrar Recontacto de Asesoría</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {caso.codigo_caso || 'Qx'}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                {nombrePaciente} • {caso.practica_nombre || 'Cirugía Oftalmológica'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info Paciente y Contacto Rápido */}
        <div className="p-4 bg-neutral-950/40 border-b border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Phone size={13} className="text-emerald-400" />
              <strong className="text-gray-200">{telefono || 'Sin teléfono'}</strong>
            </span>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <MessageSquare size={13} />
                <span>Contactar por WhatsApp</span>
                <ExternalLink size={11} className="opacity-70" />
              </a>
            )}
          </div>
          {caso.proxima_accion_texto && (
            <p className="text-[11px] text-purple-300/90 bg-purple-950/30 p-2 rounded-lg border border-purple-500/20">
              📌 <strong>Acción previa:</strong> {caso.proxima_accion_texto}
            </p>
          )}
        </div>

        {/* Formulario de Resolución */}
        <form onSubmit={handleGuardar} className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector de Acción */}
          <div>
            <label className="text-gray-300 font-semibold block mb-1.5">
              Resultado del Recontacto:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccion('reprogramar')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  accion === 'reprogramar'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-bold'
                    : 'bg-neutral-950 border-[var(--border)] text-gray-400 hover:text-white'
                }`}
              >
                <Clock size={15} className="text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs truncate">Sigue Evaluando</div>
                  <div className="text-[10px] text-gray-400 truncate">Reprogramar fecha</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccion('confirmado')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  accion === 'confirmado'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 font-bold'
                    : 'bg-neutral-950 border-[var(--border)] text-gray-400 hover:text-white'
                }`}
              >
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs truncate">Confirmó Cirugía</div>
                  <div className="text-[10px] text-gray-400 truncate">Pasa a Confirmados</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccion('no_responde')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  accion === 'no_responde'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-200 font-bold'
                    : 'bg-neutral-950 border-[var(--border)] text-gray-400 hover:text-white'
                }`}
              >
                <Phone size={15} className="text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs truncate">No Responde</div>
                  <div className="text-[10px] text-gray-400 truncate">Reintento mañana</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccion('desiste')}
                className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                  accion === 'desiste'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-200 font-bold'
                    : 'bg-neutral-950 border-[var(--border)] text-gray-400 hover:text-white'
                }`}
              >
                <X size={15} className="text-rose-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs truncate">Desiste / Cancela</div>
                  <div className="text-[10px] text-gray-400 truncate">Registrar motivo</div>
                </div>
              </button>
            </div>
          </div>

          {/* Campos si es Reprogramar o No Responde */}
          {(accion === 'reprogramar' || accion === 'no_responde') && (
            <div className="p-3 bg-neutral-950/60 border border-[var(--border)] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-gray-300 font-semibold">
                  Próxima fecha de contacto:
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPresetDias(1)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-purple-300"
                  >
                    +24h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDias(2)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-purple-300"
                  >
                    +48h
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDias(7)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-purple-300"
                  >
                    +1 sem
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-[var(--border)] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {/* Campos si Desiste */}
          {accion === 'desiste' && (
            <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-2.5">
              <div>
                <label className="text-gray-300 font-semibold block mb-1">
                  Categoría de Causa (Pareto):
                </label>
                <select
                  value={categoriaCausa}
                  onChange={(e) => setCategoriaCausa(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-rose-500/40 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value="Económica / Presupuesto">Económica / Costo del Presupuesto</option>
                  <option value="Sin Cobertura Obra Social">Sin Cobertura por Obra Social</option>
                  <option value="Temor Quirúrgico / Duda Médica">Temor a la Cirugía / Consulta médica pendiente</option>
                  <option value="Segunda Opinión Externa">Prefiere segunda opinión / Otro centro</option>
                  <option value="Problemas Personales / Familiares">Problemas personales o de agenda</option>
                  <option value="Otro Motivo">Otro Motivo</option>
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-semibold block mb-1">
                  Motivo puntual:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Prefiere esperar al próximo año por viaje..."
                  value={motivoDemora}
                  onChange={(e) => setMotivoDemora(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-[var(--border)] rounded-xl text-white text-xs focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>
          )}

          {/* Observaciones generales para Bitácora */}
          <div>
            <label className="text-gray-300 font-semibold block mb-1">
              Observación para la Bitácora de Evoluciones:
            </label>
            <textarea
              rows={2}
              placeholder={
                accion === 'confirmado'
                  ? 'Ej: Se comunicó con la asesora, confirma para operarse el próximo mes...'
                  : accion === 'no_responde'
                  ? 'Ej: Se envió mensaje de WhatsApp y se llamó a las 11hs sin respuesta...'
                  : 'Ej: Lo habló con la familia, le interesa la lente tórica pero espera cobrar el sueldo...'
              }
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full p-2.5 bg-neutral-950 border border-[var(--border)] rounded-xl text-white text-xs focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-xl font-medium transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>Confirmar & Guardar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
