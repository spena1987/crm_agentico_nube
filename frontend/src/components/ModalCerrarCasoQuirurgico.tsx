'use client'

import React, { useState } from 'react'
import {
  X,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  HelpCircle,
  ShieldAlert
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

interface ModalCerrarCasoQuirurgicoProps {
  isOpen: boolean
  onClose: () => void
  casoId: string
  pacienteId: string
  pacienteNombre: string
  practicaNombre: string
  numeroCirugia: number
  onCasoCerrado: (casoActualizado: any) => void
}

const MOTIVOS_FRECUENTES_CANCELADO = [
  'Desistimiento del paciente por costos / copago elevado',
  'Falta de cobertura / rechazo de autorización de obra social',
  'Decisión personal del paciente / postergación indefinida',
  'Tratamiento médico conservador alternativo (no requiere cirugía)',
  'Derivación a otro centro de salud / profesional externo',
  'Comorbilidad o contraindicación médica sobreviniente',
  'Otro motivo de desistimiento'
]

const MOTIVOS_FRECUENTES_OPERADO = [
  'Cirugía realizada y completada con éxito en quirófano',
  'Intervención finalizada según planificación médica',
  'Procedimiento quirúrgico ambulatorio concluido'
]

export default function ModalCerrarCasoQuirurgico({
  isOpen,
  onClose,
  casoId,
  pacienteId,
  pacienteNombre,
  practicaNombre,
  numeroCirugia,
  onCasoCerrado
}: ModalCerrarCasoQuirurgicoProps) {
  const { user } = useAuth()
  const [tipoCierre, setTipoCierre] = useState<'cancelado' | 'operado'>('cancelado')
  const [motivoPrincipal, setMotivoPrincipal] = useState(MOTIVOS_FRECUENTES_CANCELADO[0])
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombreUsuario =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.nombre ||
    (user?.email ? user.email.split('@')[0] : 'Asesora Quirúrgica')

  if (!isOpen) return null

  const handleConfirmarCierre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivoPrincipal) {
      setError('Debes seleccionar un motivo principal de cierre.')
      return
    }

    try {
      setGuardando(true)
      setError(null)

      const motivoCompleto = detalle.trim()
        ? `[${motivoPrincipal}] ${detalle.trim()}`
        : motivoPrincipal

      // 1. Actualizar estado del caso en Backend / Supabase
      const payloadCaso = {
        estado: tipoCierre,
        motivo_cancelacion: motivoCompleto
      }

      let casoActualizado = null
      try {
        const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${casoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadCaso)
        })
        const data = await res.json()
        if (res.ok && data.success) {
          casoActualizado = data.asesoria
        }
      } catch (apiErr) {
        console.warn('Fallback directo a Supabase:', apiErr)
      }

      if (!casoActualizado) {
        const { data: sbData, error: sbErr } = await supabase
          .from('asesorias_quirurgicas')
          .update({
            estado: tipoCierre,
            motivo_cancelacion: motivoCompleto,
            updated_at: new Date().toISOString()
          })
          .eq('id', casoId)
          .select()
        if (!sbErr && sbData && sbData.length > 0) {
          casoActualizado = sbData[0]
        }
      }

      // 2. Registrar automáticamente una nota de evolución interna en la bitácora
      const textoEvolucion = `🔒 CIERRE FORMAL DEL CASO QUIRÚRGICO\n• Resultado: ${
        tipoCierre === 'operado' ? 'Operado con Éxito' : 'Cancelado / Desistido'
      }\n• Motivo: ${motivoPrincipal}${detalle.trim() ? `\n• Observaciones: ${detalle.trim()}` : ''}`

      const payloadEvolucion = {
        asesoria_id: casoId,
        paciente_id: pacienteId,
        usuario_id: user?.id || null,
        usuario_nombre: nombreUsuario,
        tipo_contacto: 'interno' as const,
        contenido: textoEvolucion,
        fecha_contacto: new Date().toISOString()
      }

      try {
        await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${casoId}/evoluciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadEvolucion)
        })
      } catch (evErr) {
        await supabase.from('asesoria_evoluciones').insert(payloadEvolucion)
      }

      onCasoCerrado(casoActualizado || { id: casoId, ...payloadCaso })
      onClose()
    } catch (err: any) {
      console.error('Error al cerrar caso:', err)
      setError(err.message || 'Error inesperado al cerrar el caso.')
    } finally {
      setGuardando(false)
    }
  }

  const listaMotivos =
    tipoCierre === 'operado'
      ? MOTIVOS_FRECUENTES_OPERADO
      : MOTIVOS_FRECUENTES_CANCELADO

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header del Modal */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Cerrar Caso: Cirugía #{numeroCirugia}
              </h3>
              <p className="text-[11px] text-gray-400 truncate max-w-xs">
                {practicaNombre} • {pacienteNombre}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Formulario de Cierre */}
        <form onSubmit={handleConfirmarCierre} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Selección de Resultado del Cierre */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300">
              Tipo de Cierre del Procedimiento:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTipoCierre('cancelado')
                  setMotivoPrincipal(MOTIVOS_FRECUENTES_CANCELADO[0])
                }}
                className={`p-3 rounded-xl text-left border transition-all flex items-center gap-2.5 ${
                  tipoCierre === 'cancelado'
                    ? 'bg-red-950/50 border-red-500/50 text-red-300 shadow-sm font-bold'
                    : 'bg-neutral-950 border-[var(--border)] text-gray-400 hover:text-white'
                }`}
              >
                <XCircle size={16} className="text-red-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Desistido / Cancelado</div>
                  <div className="text-[10px] text-gray-500 font-normal">No se opera</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTipoCierre('operado')
                  setMotivoPrincipal(MOTIVOS_FRECUENTES_OPERADO[0])
                }}
                className={`p-3 rounded-xl text-left border transition-all flex items-center gap-2.5 ${
                  tipoCierre === 'operado'
                    ? 'bg-teal-950/50 border-teal-500/50 text-teal-300 shadow-sm font-bold'
                    : 'bg-neutral-950 border-[var(--border)] text-gray-400 hover:text-white'
                }`}
              >
                <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Operado con Éxito</div>
                  <div className="text-[10px] text-gray-500 font-normal">Cirugía realizada</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Motivo Principal Categorizado */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300">
              Motivo Principal del Cierre:
            </label>
            <select
              value={motivoPrincipal}
              onChange={(e) => setMotivoPrincipal(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-[var(--border)] focus:border-amber-500 rounded-xl text-white font-medium focus:outline-none"
            >
              {listaMotivos.map((m, i) => (
                <option key={i} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Detalle u Observaciones Adicionales */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300">
              Detalle u Observaciones del Cierre (Opcional):
            </label>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              rows={3}
              placeholder="Explica brevemente el motivo o acuerdo final con el paciente..."
              className="w-full p-3 text-xs border border-[var(--border)] rounded-xl bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-amber-500 text-white placeholder-gray-500 leading-relaxed resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/60 border border-[var(--border)] text-[11px] text-gray-400 space-y-1">
            <p className="flex items-center gap-1.5 text-gray-300 font-semibold">
              <FileText size={12} className="text-blue-400" />
              Impacto del Cierre:
            </p>
            <p>
              Se asentará automáticamente una nota interna en la <strong>Bitácora de Evoluciones</strong> registrada por <strong>{nombreUsuario}</strong> con la fecha/hora actual.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 border border-[var(--border)] rounded-xl text-gray-400 hover:bg-neutral-800 text-xs font-bold transition-all"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                tipoCierre === 'operado'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'
              }`}
            >
              {guardando ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Cerrando caso...
                </>
              ) : (
                <>
                  <Lock size={13} />
                  Confirmar Cierre de Cirugía
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
