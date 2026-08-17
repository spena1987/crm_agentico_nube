'use client'

import React, { useState, useEffect } from 'react'
import {
  PhoneCall,
  MessageSquare,
  Building2,
  Mail,
  FileEdit,
  Plus,
  Trash2,
  Clock,
  User,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ClipboardList,
  ShieldCheck
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export interface AsesoriaEvolucion {
  id: string
  asesoria_id: string
  paciente_id: string
  usuario_id?: string | null
  usuario_nombre: string
  tipo_contacto: 'llamada' | 'whatsapp' | 'presencial' | 'email' | 'interno'
  contenido: string
  fecha_contacto: string
  created_at: string
}

interface TimelineEvolucionesAsesoriaProps {
  asesoriaId?: string | null
  pacienteId: string
  pacienteNombre: string
}

const CANALES: {
  id: AsesoriaEvolucion['tipo_contacto']
  label: string
  icon: React.ElementType
  color: string
  border: string
  badge: string
}[] = [
  {
    id: 'llamada',
    label: 'Llamada Telefónica',
    icon: PhoneCall,
    color: 'text-blue-400 bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-950 text-blue-300 border-blue-800/40'
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-950 text-emerald-300 border-emerald-800/40'
  },
  {
    id: 'presencial',
    label: 'Presencial en Clínica',
    icon: Building2,
    color: 'text-purple-400 bg-purple-500/10',
    border: 'border-purple-500/30',
    badge: 'bg-purple-950 text-purple-300 border-purple-800/40'
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    color: 'text-amber-400 bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-950 text-amber-300 border-amber-800/40'
  },
  {
    id: 'interno',
    label: 'Nota Interna',
    icon: FileEdit,
    color: 'text-indigo-400 bg-indigo-500/10',
    border: 'border-indigo-500/30',
    badge: 'bg-indigo-950 text-indigo-300 border-indigo-800/40'
  }
]

export default function TimelineEvolucionesAsesoria({
  asesoriaId,
  pacienteId,
  pacienteNombre
}: TimelineEvolucionesAsesoriaProps) {
  const { user } = useAuth()
  const [evoluciones, setEvoluciones] = useState<AsesoriaEvolucion[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Formulario de nueva evolución (Canal y Contenido únicamente; Asesora y Fecha son 100% automáticas)
  const [tipoContacto, setTipoContacto] = useState<AsesoriaEvolucion['tipo_contacto']>('llamada')
  const [contenido, setContenido] = useState('')

  // Nombre de la asesora obtenido automáticamente de la sesión activa
  const obtenerNombreAsesora = () => {
    if (!user) return 'Asesora Quirúrgica'
    return (
      user.user_metadata?.full_name ||
      user.user_metadata?.nombre ||
      (user.email ? user.email.split('@')[0] : 'Asesora Quirúrgica')
    )
  }

  const nombreAsesoraActual = obtenerNombreAsesora()

  // Cargar evoluciones desde Backend o Supabase
  const fetchEvoluciones = async () => {
    if (!asesoriaId) {
      setEvoluciones([])
      return
    }
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${asesoriaId}/evoluciones`)
      const data = await res.json()
      if (res.ok && data.success) {
        setEvoluciones(data.evoluciones || [])
      } else {
        // Fallback Supabase
        const { data: sbData, error: sbErr } = await supabase
          .from('asesoria_evoluciones')
          .select('*')
          .eq('asesoria_id', asesoriaId)
          .order('fecha_contacto', { ascending: false })
        if (!sbErr && sbData) {
          setEvoluciones(sbData as unknown as AsesoriaEvolucion[])
        }
      }
    } catch (err) {
      console.error('Error cargando evoluciones:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchEvoluciones()

    if (!asesoriaId) return

    // Suscripción en tiempo real para colaboración multi-usuario
    const channel = supabase
      .channel(`evoluciones-${asesoriaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asesoria_evoluciones',
          filter: `asesoria_id=eq.${asesoriaId}`
        },
        () => {
          fetchEvoluciones()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [asesoriaId])

  // Guardar nueva evolución (Asesora y Fecha automáticas)
  const handleGuardarEvolucion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contenido.trim()) {
      setError('Por favor escribe el detalle de la evolución.')
      return
    }
    if (!asesoriaId) {
      setError('Debes guardar primero el caso quirúrgico antes de asentar evoluciones.')
      return
    }

    try {
      setGuardando(true)
      setError(null)

      const fechaActualIso = new Date().toISOString()
      const payload = {
        asesoria_id: asesoriaId,
        paciente_id: pacienteId,
        usuario_id: user?.id || null,
        usuario_nombre: nombreAsesoraActual,
        tipo_contacto: tipoContacto,
        contenido: contenido.trim(),
        fecha_contacto: fechaActualIso
      }

      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${asesoriaId}/evoluciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al guardar evolución.')
      }

      // Actualización inmediata en UI
      setEvoluciones((prev) => [data.evolucion, ...prev])
      setContenido('')
      setMensajeExito('✔ Evolución registrada en la bitácora.')
      setTimeout(() => setMensajeExito(null), 3000)
    } catch (err: any) {
      console.error('Error al guardar evolución:', err)
      // Fallback Supabase directo
      try {
        const fechaActualIso = new Date().toISOString()
        const { data: sbIns, error: sbErr } = await supabase
          .from('asesoria_evoluciones')
          .insert({
            asesoria_id: asesoriaId,
            paciente_id: pacienteId,
            usuario_id: user?.id || null,
            usuario_nombre: nombreAsesoraActual,
            tipo_contacto: tipoContacto,
            contenido: contenido.trim(),
            fecha_contacto: fechaActualIso
          })
          .select()
        if (!sbErr && sbIns && sbIns.length > 0) {
          setEvoluciones((prev) => [sbIns[0] as unknown as AsesoriaEvolucion, ...prev])
          setContenido('')
          setMensajeExito('✔ Evolución registrada en la bitácora.')
          setTimeout(() => setMensajeExito(null), 3000)
        } else {
          throw sbErr || new Error('No se pudo guardar la evolución.')
        }
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || 'Error al registrar la evolución.')
      }
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar evolución
  const handleEliminarEvolucion = async (evolucionId: string) => {
    if (!confirm('¿Deseas eliminar este registro de la bitácora?')) return

    try {
      setEvoluciones((prev) => prev.filter((ev) => ev.id !== evolucionId))
      await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/evoluciones/${evolucionId}`, {
        method: 'DELETE'
      })
      await supabase.from('asesoria_evoluciones').delete().eq('id', evolucionId)
    } catch (err) {
      console.error('Error al eliminar evolución:', err)
      fetchEvoluciones()
    }
  }

  // Formateador de fecha amigable
  const formatearFecha = (fechaIso: string) => {
    if (!fechaIso) return ''
    const d = new Date(fechaIso)
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      
      {/* Header de la Bitácora */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-blue-400" />
          <h4 className="text-xs font-bold text-gray-200">
            Bitácora de Asesoramiento & Evolución del Paciente ({evoluciones.length})
          </h4>
        </div>
        <span className="text-[10px] text-gray-400">
          Registros cronológicos automáticos
        </span>
      </div>

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

      {/* Formulario de Entrada Rápida (Sin fricción: solo Canal y Texto) */}
      <form
        onSubmit={handleGuardarEvolucion}
        className="p-4 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3 shadow-inner"
      >
        {/* Selector de Canales */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-400">
            Canal de Contacto:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CANALES.map((c) => {
              const Icon = c.icon
              const isSelected = tipoContacto === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTipoContacto(c.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
                    isSelected
                      ? `${c.color} ${c.border} shadow-sm font-bold scale-[1.02]`
                      : 'bg-neutral-950/70 border-[var(--border)] text-gray-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Icon size={13} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Textarea de Contenido */}
        <div className="space-y-1">
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={3}
            placeholder="Asentar aquí: lo conversado con el paciente, presupuesto explicado, dudas resueltas, requisitos prequirúrgicos acordados, autorizaciones pendientes o motivos de seguimiento..."
            className="w-full p-3 text-xs border border-[var(--border)] rounded-xl bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-500 leading-relaxed resize-none"
          />
        </div>

        {/* Pie del Formulario: Metadatos Automáticos y Botón de Registro */}
        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="flex items-center gap-1 font-medium text-gray-300">
              <User size={12} className="text-blue-400" />
              {nombreAsesoraActual}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-gray-500">
              <Clock size={11} />
              Registro automático al guardar
            </span>
          </div>

          <button
            type="submit"
            disabled={guardando || !contenido.trim() || !asesoriaId}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
          >
            {guardando ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Guardando en bitácora...
              </>
            ) : (
              <>
                <Plus size={13} />
                + Registrar Evolución
              </>
            )}
          </button>
        </div>
      </form>

      {/* Timeline Cronológico de Entradas */}
      <div className="space-y-3 pt-2">
        {cargando ? (
          <div className="p-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin text-blue-400" />
            Cargando historial de evoluciones...
          </div>
        ) : evoluciones.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-[var(--border)] rounded-xl text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-400">Sin evoluciones registradas aún</p>
            <p className="text-[11px]">
              Selecciona el canal y redacta el primer contacto para iniciar la bitácora.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3 border-l-2 border-[var(--border)]/70 ml-3">
            {evoluciones.map((ev) => {
              const canalInfo = CANALES.find((c) => c.id === ev.tipo_contacto) || CANALES[0]
              const Icon = canalInfo.icon

              return (
                <div key={ev.id} className="relative group">
                  {/* Nodo circular en el timeline */}
                  <div
                    className={`absolute -left-[31px] top-3 w-5 h-5 rounded-full ${canalInfo.color} border ${canalInfo.border} flex items-center justify-center shadow-sm`}
                  >
                    <Icon size={10} />
                  </div>

                  {/* Tarjeta de la Evolución */}
                  <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-[var(--border)] space-y-2 hover:border-gray-700 transition-colors">
                    {/* Header de la tarjeta */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {ev.usuario_nombre || 'Asesora Quirúrgica'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${canalInfo.badge}`}
                        >
                          {canalInfo.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                          <Clock size={11} className="text-gray-500" />
                          {formatearFecha(ev.fecha_contacto)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEliminarEvolucion(ev.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 rounded transition-all"
                          title="Eliminar registro"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Contenido de lo conversado */}
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {ev.contenido}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
