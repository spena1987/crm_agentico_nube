'use client'

import React, { useState, useEffect } from 'react'
import {
  Stethoscope,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  ClipboardList
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import ItemCasoQuirurgicoAcordeon, { AsesoriaQuirurgica } from '@/components/ItemCasoQuirurgicoAcordeon'

interface PanelAsesoriaQuirurgicaProps {
  pacienteId: string
  pacienteNombre: string
  pacienteDni?: string | null
  pacienteTelefono?: string | null
  obraSocialDefault?: string | null
}

export default function PanelAsesoriaQuirurgica({
  pacienteId,
  pacienteNombre,
  pacienteDni,
  pacienteTelefono,
  obraSocialDefault
}: PanelAsesoriaQuirurgicaProps) {
  const [asesorias, setAsesorias] = useState<AsesoriaQuirurgica[]>([])
  const [desplegados, setDesplegados] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [creandoNuevo, setCreandoNuevo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Cargar todos los casos quirúrgicos del paciente
  const fetchAsesorias = async () => {
    if (!pacienteId) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/paciente/${pacienteId}`)
      const data = await res.json()

      let lista: AsesoriaQuirurgica[] = []
      if (res.ok && data.success) {
        lista = data.asesorias || []
      } else {
        // Fallback Supabase
        const { data: sbData, error: sbErr } = await supabase
          .from('asesorias_quirurgicas')
          .select('*')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })

        if (!sbErr && sbData) {
          lista = sbData as AsesoriaQuirurgica[]
        }
      }

      setAsesorias(lista)

      // Abrir por defecto el caso más reciente si no hay ninguno abierto
      if (lista.length > 0) {
        setDesplegados((prev) => {
          if (Object.keys(prev).length === 0) {
            return { [lista[0].id]: true }
          }
          return prev
        })
      }
    } catch (err: any) {
      console.error('Error cargando asesorías:', err)
      setError(err.message || 'Error al cargar los casos quirúrgicos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setDesplegados({})
    fetchAsesorias()

    // Suscripción Realtime a asesorías quirúrgicas de este paciente
    const channel = supabase
      .channel(`asesorias-paciente-${pacienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asesorias_quirurgicas',
          filter: `paciente_id=eq.${pacienteId}`
        },
        () => {
          fetchAsesorias()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pacienteId])

  // Alternar despliegue de un caso
  const toggleDespliegue = (id: string) => {
    setDesplegados((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Crear una nueva cirugía / procedimiento para este paciente
  const handleCrearNuevaCirugia = async () => {
    try {
      setCreandoNuevo(true)
      setError(null)

      const payload = {
        paciente_id: pacienteId,
        practica_nombre: 'Nueva Cirugía / Procedimiento',
        cobertura_obra_social: obraSocialDefault || null,
        estado: 'en_asesoramiento',
        moneda_extra: 'ARS',
        monto_extra: 0
      }

      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al crear nuevo caso.')
      }

      const nuevaAsesoria: AsesoriaQuirurgica = data.asesoria
      setAsesorias((prev) => [nuevaAsesoria, ...prev])
      
      // Desplegar automáticamente el nuevo caso creado
      setDesplegados((prev) => ({
        ...prev,
        [nuevaAsesoria.id]: true
      }))

      setMensajeExito(`✔ Nuevo sector de cirugía #${asesorias.length + 1} habilitado para configurar.`)
      setTimeout(() => setMensajeExito(null), 3500)
    } catch (err: any) {
      console.error('Error al crear nuevo caso:', err)
      // Fallback Supabase directo
      try {
        const { data: sbData, error: sbErr } = await supabase
          .from('asesorias_quirurgicas')
          .insert({
            paciente_id: pacienteId,
            practica_nombre: 'Nueva Cirugía / Procedimiento',
            cobertura_obra_social: obraSocialDefault || null,
            estado: 'en_asesoramiento',
            moneda_extra: 'ARS',
            monto_extra: 0
          })
          .select()

        if (!sbErr && sbData && sbData.length > 0) {
          const nueva = sbData[0] as AsesoriaQuirurgica
          setAsesorias((prev) => [nueva, ...prev])
          setDesplegados((prev) => ({ ...prev, [nueva.id]: true }))
          setMensajeExito(`✔ Nuevo sector de cirugía #${asesorias.length + 1} habilitado.`)
          setTimeout(() => setMensajeExito(null), 3500)
        } else {
          throw sbErr || new Error('No se pudo crear el caso en Supabase.')
        }
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || 'Error inesperado al crear nuevo caso.')
      }
    } finally {
      setCreandoNuevo(false)
    }
  }

  // Callback cuando se actualiza un caso
  const handleCasoActualizado = (casoActualizado: AsesoriaQuirurgica) => {
    setAsesorias((prev) =>
      prev.map((c) => (c.id === casoActualizado.id ? casoActualizado : c))
    )
  }

  // Callback cuando se elimina un caso
  const handleCasoEliminado = (casoId: string) => {
    setAsesorias((prev) => prev.filter((c) => c.id !== casoId))
    setDesplegados((prev) => {
      const copy = { ...prev }
      delete copy[casoId]
      return copy
    })
    setMensajeExito('✔ Procedimiento quirúrgico eliminado.')
    setTimeout(() => setMensajeExito(null), 3000)
  }

  return (
    <div className="space-y-4 pt-4 border-t border-[var(--border)]">
      
      {/* ==================================================================== */}
      {/* HEADER PRINCIPAL DEL SECTOR DE ASESORAMIENTO QUIRÚRGICO */}
      {/* ==================================================================== */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-neutral-900/80 border border-blue-500/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shadow-inner">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white tracking-tight">
                Sector de Asesoramiento Quirúrgico & Cirugías
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/40">
                {asesorias.length} {asesorias.length === 1 ? 'Procedimiento' : 'Procedimientos'}
              </span>
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Gestión individual y secuencial de cada cirugía programada para <strong className="text-white">{pacienteNombre}</strong>.
            </p>
          </div>
        </div>

        {/* Botón para incorporar nueva cirugía / procedimiento */}
        <button
          type="button"
          onClick={handleCrearNuevaCirugia}
          disabled={creandoNuevo || loading}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
        >
          {creandoNuevo ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Creando sector...
            </>
          ) : (
            <>
              <Plus size={14} />
              + Nueva Cirugía / Procedimiento
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mensajeExito && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LISTADO DE CASOS EN ACORDEÓN CROMÁTICO DESPLEGABLE */}
      {/* ==================================================================== */}
      {loading ? (
        <div className="p-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2.5 bg-neutral-900/30 rounded-2xl border border-[var(--border)]">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <span>Cargando procedimientos quirúrgicos del paciente...</span>
        </div>
      ) : asesorias.length === 0 ? (
        /* Estado vacío: Sin cirugías asignadas aún */
        <div className="p-8 text-center border-2 border-dashed border-[var(--border)] rounded-2xl bg-neutral-950/40 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-[var(--border)] flex items-center justify-center text-gray-500 mx-auto">
            <Layers size={22} className="text-blue-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">No hay cirugías registradas para este paciente</h4>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Inicia el seguimiento derivando una nueva prestación médica al sector de asesoramiento quirúrgico.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCrearNuevaCirugia}
            disabled={creandoNuevo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow"
          >
            <Plus size={14} />
            + Registrar Primera Cirugía
          </button>
        </div>
      ) : (
        /* Lista de Tarjetas de Acordeón Quirúrgico */
        <div className="space-y-3">
          {asesorias.map((caso, idx) => (
            <ItemCasoQuirurgicoAcordeon
              key={caso.id}
              caso={caso}
              index={idx}
              isExpanded={!!desplegados[caso.id]}
              onToggle={() => toggleDespliegue(caso.id)}
              pacienteId={pacienteId}
              pacienteNombre={pacienteNombre}
              pacienteDni={pacienteDni}
              pacienteTelefono={pacienteTelefono}
              obraSocialDefault={obraSocialDefault}
              onCasoActualizado={handleCasoActualizado}
              onCasoEliminado={handleCasoEliminado}
            />
          ))}
        </div>
      )}

    </div>
  )
}
