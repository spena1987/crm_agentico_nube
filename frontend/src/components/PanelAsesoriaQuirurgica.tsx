'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Stethoscope,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  ClipboardList,
  Filter
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
  const fetchAsesorias = async (silencioso = false) => {
    if (!pacienteId) return
    try {
      if (!silencioso) {
        setLoading(true)
      }
      setError(null)

      let lista: AsesoriaQuirurgica[] = []
      let obtenido = false

      // 1. Intentar por Backend si está disponible
      try {
        const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/paciente/${pacienteId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.asesorias) {
            lista = data.asesorias
            obtenido = true
          }
        }
      } catch (backendErr) {
        // Si el backend no responde o falla la red, continuamos transparentemente a Supabase
        console.warn('Backend no disponible temporalmente, usando Supabase directo:', backendErr)
      }

      // 2. Si no se obtuvo del backend, consultar Supabase directamente
      if (!obtenido) {
        const { data: sbData, error: sbErr } = await supabase
          .from('asesorias_quirurgicas')
          .select('*')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })

        if (sbErr) {
          throw sbErr
        }
        if (sbData) {
          lista = sbData as AsesoriaQuirurgica[]
        }
      }

      setAsesorias(lista)
      // Todas las cirugías inician colapsadas por defecto para una vista panorámica limpia
    } catch (err: any) {
      console.error('Error cargando asesorías:', err)
      if (!silencioso) {
        setError(err.message || 'Error al cargar los casos quirúrgicos.')
      }
    } finally {
      if (!silencioso) {
        setLoading(false)
      }
    }
  }


  useEffect(() => {
    setDesplegados({})
    fetchAsesorias(false)

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
          fetchAsesorias(true) // Refresco silencioso para no desmontar modales ni cerrar acordeones
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

  // Estado para el filtro de casos: 'todos' | 'activos' | 'cerrados'
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'cerrados'>('todos')

  // Helper para determinar si un caso está activo
  const esCasoActivo = (a: AsesoriaQuirurgica) =>
    a.estado !== 'operado' && a.estado !== 'cancelado' && !a.motivo_cancelacion

  // Contadores de casos activos y cerrados
  const totalCasos = asesorias.length
  const casosActivos = asesorias.filter(esCasoActivo).length
  const casosCerrados = totalCasos - casosActivos

  // Casos filtrados según la selección del usuario
  const asesoriasFiltradas = useMemo(() => {
    if (filtroEstado === 'activos') {
      return asesorias.filter(esCasoActivo)
    }
    if (filtroEstado === 'cerrados') {
      return asesorias.filter((a) => !esCasoActivo(a))
    }
    return asesorias
  }, [asesorias, filtroEstado])

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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-white tracking-tight">
                Sector de Asesoramiento Quirúrgico & Cirugías
              </h3>
              
              {/* Botón Filtro: Todos los Procedimientos */}
              <button
                type="button"
                onClick={() => setFiltroEstado('todos')}
                title="Mostrar todos los procedimientos"
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  filtroEstado === 'todos'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400 scale-105'
                    : 'bg-blue-950/70 text-blue-300 border border-blue-800/40 hover:bg-blue-900 hover:text-white opacity-80 hover:opacity-100 hover:scale-102'
                }`}
              >
                {filtroEstado === 'todos' && <Filter size={10} className="animate-pulse" />}
                <span>{totalCasos} {totalCasos === 1 ? 'Procedimiento' : 'Procedimientos'}</span>
              </button>

              {/* Botones Filtro: Activos y Cerrados */}
              {totalCasos > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setFiltroEstado('activos')}
                    title="Filtrar sólo procedimientos activos en curso"
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      filtroEstado === 'activos'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400 scale-105'
                        : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/80 hover:text-white opacity-80 hover:opacity-100 hover:scale-102'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${filtroEstado === 'activos' ? 'bg-white' : 'bg-emerald-400'}`} />
                    <span>{casosActivos} {casosActivos === 1 ? 'Activo' : 'Activos'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroEstado('cerrados')}
                    title="Filtrar procedimientos finalizados u operados"
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      filtroEstado === 'cerrados'
                        ? 'bg-neutral-600 text-white shadow-lg shadow-neutral-600/30 ring-2 ring-neutral-300 scale-105'
                        : 'bg-neutral-950 text-gray-400 border border-neutral-700 hover:bg-neutral-800 hover:text-gray-200 opacity-80 hover:opacity-100 hover:scale-102'
                    }`}
                  >
                    <span>{casosCerrados} {casosCerrados === 1 ? 'Cerrado' : 'Cerrados'}</span>
                  </button>
                </div>
              )}
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
      ) : asesoriasFiltradas.length === 0 ? (
        /* Estado vacío cuando el filtro seleccionado no tiene elementos */
        <div className="p-8 text-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-950/40 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-gray-500 mx-auto">
            <Filter size={18} className="text-blue-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white">
              No hay procedimientos {filtroEstado === 'activos' ? 'activos en curso' : 'cerrados'}
            </h4>
            <p className="text-xs text-gray-400">
              {filtroEstado === 'activos'
                ? `Este paciente tiene ${casosCerrados} procedimiento(s) en estado cerrado u operado.`
                : `Este paciente tiene ${casosActivos} procedimiento(s) activo(s) en seguimiento.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-blue-400 hover:text-blue-300 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 border border-neutral-700"
          >
            <span>Ver todos los procedimientos ({totalCasos})</span>
          </button>
        </div>
      ) : (
        /* Lista de Tarjetas de Acordeón Quirúrgico Filtradas */
        <div className="space-y-3">
          {asesoriasFiltradas.map((caso, idx) => (
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
