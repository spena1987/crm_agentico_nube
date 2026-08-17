'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Phone,
  User,
  FileText
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export interface PlantillaWhatsAppItem {
  id: string
  titulo: string
  mensaje: string
}

interface ModalPlantillasWhatsAppQuirurgicasProps {
  isOpen: boolean
  onClose: () => void
  casoId: string
  pacienteId: string
  pacienteNombre: string
  pacienteTelefono?: string | null
  practicaNombre: string
  medicoCirujanoNombre?: string | null
  montoExtra?: number | string
  monedaExtra?: string
  fechaProbable?: string | null
  fechaDefinitiva?: string | null
  onMensajeEnviado?: () => void
}

const PLANTILLAS_DEFAULT: PlantillaWhatsAppItem[] = [
  {
    id: 'seguimiento_cotizacion',
    titulo: '💰 Seguimiento de Presupuesto / Cotización',
    mensaje:
      'Hola {paciente}, te contacto del equipo de Asesoramiento Quirúrgico de la clínica. Te escribo para consultar si pudiste revisar la cotización para tu procedimiento de {cirugia}. Quedo a tu disposición por cualquier consulta sobre costos o formas de pago.'
  },
  {
    id: 'requisitos_prequirurgicos',
    titulo: '📋 Guía de Estudios Prequirúrgicos',
    mensaje:
      'Estimado/a {paciente}, para avanzar con la programación de tu cirugía ({cirugia}), te recordamos los estudios prequirúrgicos requeridos: 1) Análisis de sangre y coagulograma completo, 2) Electrocardiograma con evaluación de riesgo quirúrgico. Cuando los tengas listos, podés enviárnoslos por este medio.'
  },
  {
    id: 'guia_autorizacion',
    titulo: '🏥 Instrucciones de Autorización de Obra Social',
    mensaje:
      'Hola {paciente}, para gestionar la cobertura de tu procedimiento ({cirugia}), debes presentar la orden médica en tu obra social o prepaga. Si precisas el presupuesto membretado oficial o el código del nomenclador, avísanos y te lo enviamos de inmediato.'
  },
  {
    id: 'recordatorio_quirofano',
    titulo: '🗓 Confirmación e Instrucciones de Quirófano',
    mensaje:
      'Hola {paciente}, te confirmamos la fecha definitiva de tu cirugía para el día {fecha_definitiva}. Recordá concurrir con 8 horas de ayuno total (líquidos y sólidos), DNI y los estudios prequirúrgicos originales en mano.'
  }
]

export default function ModalPlantillasWhatsAppQuirurgicas({
  isOpen,
  onClose,
  casoId,
  pacienteId,
  pacienteNombre,
  pacienteTelefono,
  practicaNombre,
  medicoCirujanoNombre,
  montoExtra,
  monedaExtra = 'ARS',
  fechaProbable,
  fechaDefinitiva,
  onMensajeEnviado
}: ModalPlantillasWhatsAppQuirurgicasProps) {
  const { user } = useAuth()
  const [plantillas, setPlantillas] = useState<PlantillaWhatsAppItem[]>(PLANTILLAS_DEFAULT)
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState<string>(PLANTILLAS_DEFAULT[0].id)
  const [telefono, setTelefono] = useState(pacienteTelefono || '')
  const [mensajeTexto, setMensajeTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const nombreUsuario =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.nombre ||
    (user?.email ? user.email.split('@')[0] : 'Asesora Quirúrgica')

  // Cargar plantillas de configuración
  useEffect(() => {
    const fetchPlantillas = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/configuracion-quirurgica`)
        const data = await res.json()
        if (res.ok && data.success && data.configuracion?.plantillas_whatsapp?.length > 0) {
          setPlantillas(data.configuracion.plantillas_whatsapp)
          setPlantillaSeleccionadaId(data.configuracion.plantillas_whatsapp[0].id)
        }
      } catch (err) {
        console.warn('Usando plantillas por defecto:', err)
      }
    }
    if (isOpen) {
      fetchPlantillas()
      setTelefono(pacienteTelefono || '')
    }
  }, [isOpen, pacienteTelefono])

  // Reemplazar variables dinámicas
  const aplicarVariables = (textoTemplate: string) => {
    let t = textoTemplate
    t = t.replace(/{paciente}/g, pacienteNombre || 'Paciente')
    t = t.replace(/{cirugia}/g, practicaNombre || 'Cirugía')
    t = t.replace(/{medico_cirujano}/g, medicoCirujanoNombre || 'Cirujano a cargo')
    t = t.replace(
      /{monto}/g,
      montoExtra ? `$ ${Number(montoExtra).toLocaleString()} ${monedaExtra}` : 'cotizado'
    )
    t = t.replace(/{fecha_probable}/g, fechaProbable || 'a coordinar')
    t = t.replace(/{fecha_definitiva}/g, fechaDefinitiva || fechaProbable || 'a coordinar')
    return t
  }

  // Actualizar texto al cambiar plantilla seleccionada
  useEffect(() => {
    const p = plantillas.find((item) => item.id === plantillaSeleccionadaId) || plantillas[0]
    if (p) {
      setMensajeTexto(aplicarVariables(p.mensaje))
    }
  }, [plantillaSeleccionadaId, plantillas, practicaNombre, pacienteNombre, fechaDefinitiva, fechaProbable])

  if (!isOpen) return null

  // Enviar WhatsApp y registrar evolución
  const handleEnviarWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telefono.trim()) {
      setError('Por favor especifica el número de teléfono del paciente.')
      return
    }
    if (!mensajeTexto.trim()) {
      setError('El mensaje no puede estar vacío.')
      return
    }

    try {
      setEnviando(true)
      setError(null)

      // 1. Obtener o crear conversación en Supabase
      let conversacionId: string | null = null
      try {
        if (pacienteId) {
          const { data: convData } = await supabase
            .from('conversaciones')
            .select('id')
            .eq('paciente_id', pacienteId)
            .maybeSingle()

          if (convData?.id) {
            conversacionId = convData.id
          } else {
            const { data: newConv } = await supabase
              .from('conversaciones')
              .insert({ paciente_id: pacienteId, bot_disabled: false })
              .select('id')
              .single()
            if (newConv?.id) conversacionId = newConv.id
          }
        }
      } catch (convErr) {
        console.warn('Error resolviendo conversación en Supabase:', convErr)
      }

      // 2. Enviar mensaje por WhatsApp (API Baileys)
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: telefono.trim(),
          mensaje: mensajeTexto.trim(),
          phone: telefono.trim(),
          message: mensajeTexto.trim(),
          paciente_id: pacienteId,
          conversacion_id: conversacionId
        })
      })

      const data = await res.json()
      if (!res.ok || data.error || data.success === false) {
        let msgError = 'Error al enviar mensaje por WhatsApp.'
        if (typeof data.detail === 'string') {
          msgError = data.detail
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          msgError = data.detail.map((d: any) => d.msg || (typeof d === 'string' ? d : JSON.stringify(d))).join(', ')
        } else if (data.error) {
          msgError = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        } else if (typeof data.mensaje === 'string') {
          msgError = data.mensaje
        }
        throw new Error(msgError)
      }

      const pTitulo = plantillas.find((p) => p.id === plantillaSeleccionadaId)?.titulo || 'WhatsApp'

      // 3. Asegurar registro inmediato en el Chat (tabla mensajes y conversaciones)
      if (conversacionId) {
        try {
          await supabase.from('mensajes').insert({
            conversacion_id: conversacionId,
            emisor: 'operador',
            contenido: mensajeTexto.trim(),
            metadata_json: {
              tipo_plantilla: pTitulo,
              whatsapp_message_id: data.message_id || null,
              origen: 'pipeline_quirurgico',
              autor: nombreUsuario
            }
          })

          await supabase
            .from('conversaciones')
            .update({
              ultimo_mensaje: mensajeTexto.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', conversacionId)
        } catch (chatDbErr) {
          console.warn('Error registrando mensaje en tabla mensajes:', chatDbErr)
        }
      }

      // 4. Asentar automáticamente en la Bitácora de Evoluciones
      const payloadEvolucion = {
        asesoria_id: casoId,
        paciente_id: pacienteId,
        usuario_id: user?.id || null,
        usuario_nombre: nombreUsuario,
        tipo_contacto: 'whatsapp' as const,
        contenido: `📲 ENVÍO DE WHATSAPP (${pTitulo}):\n"${mensajeTexto.trim()}"`,
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

      // 5. Actualizar ultimo_contacto_at en el caso
      await supabase
        .from('asesorias_quirurgicas')
        .update({
          ultimo_contacto_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', casoId)

      setMensajeExito('✔ Mensaje de WhatsApp enviado y registrado en la bitácora.')
      if (onMensajeEnviado) onMensajeEnviado()
      setTimeout(() => {
        setMensajeExito(null)
        onClose()
      }, 2000)
    } catch (err: any) {
      console.error('Error enviando WhatsApp:', err)
      setError(err.message || 'Error al procesar el envío de WhatsApp.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-[var(--border)] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header del Modal */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                WhatsApp Rápido de Seguimiento Quirúrgico
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

        {/* Formulario */}
        <form onSubmit={handleEnviarWhatsApp} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* 1. Selector de Plantillas */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300">
              Seleccionar Plantilla Preconfigurada:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {plantillas.map((p) => {
                const isSelected = plantillaSeleccionadaId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlantillaSeleccionadaId(p.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200 font-bold shadow-sm scale-[1.01]'
                        : 'bg-neutral-950 border-[var(--border)] text-gray-400 hover:text-white hover:bg-neutral-800/60'
                    }`}
                  >
                    <span className="truncate block">{p.titulo}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Teléfono Destino */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Phone size={13} className="text-emerald-400" />
              Teléfono WhatsApp del Paciente:
            </label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: +5491144445555"
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-[var(--border)] focus:border-emerald-500 rounded-xl text-white font-mono focus:outline-none"
            />
          </div>

          {/* 3. Editor / Vista Previa del Mensaje */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
              <span>Mensaje a Enviar (Personalizable):</span>
              <span className="text-[10px] text-gray-500 font-mono">
                Variables dinámicas auto-completadas
              </span>
            </label>
            <textarea
              value={mensajeTexto}
              onChange={(e) => setMensajeTexto(e.target.value)}
              rows={5}
              className="w-full p-3 text-xs border border-[var(--border)] rounded-xl bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white placeholder-gray-500 leading-relaxed resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/60 border border-[var(--border)] text-[11px] text-gray-400 space-y-1">
            <p className="flex items-center gap-1.5 text-gray-300 font-semibold">
              <Sparkles size={12} className="text-emerald-400" />
              Acción Automática:
            </p>
            <p>
              Al enviar, el mensaje saldrá por WhatsApp y se registrará automáticamente en la <strong>Bitácora de Evoluciones</strong> a nombre de <strong>{nombreUsuario}</strong>, actualizando el semáforo SLA de seguimiento al día de hoy.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-4 py-2 border border-[var(--border)] rounded-xl text-gray-400 hover:bg-neutral-800 text-xs font-bold transition-all"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={enviando || !telefono.trim() || !mensajeTexto.trim()}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              {enviando ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Enviando por WhatsApp...
                </>
              ) : (
                <>
                  <Send size={13} />
                  Enviar WhatsApp & Registrar Evolución
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
