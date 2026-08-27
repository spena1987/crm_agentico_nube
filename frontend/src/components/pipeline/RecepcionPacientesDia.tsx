'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  Clock,
  User,
  Phone,
  FileCheck2,
  Send,
  Download,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Activity,
  Sparkles,
  Check,
  Radio,
  X,
  Stethoscope,
  Layers,
  ListFilter
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { formatearHoraDesdeIso, calcularMinutosTranscurridos } from '@/lib/dateUtils'

interface TurnoRecepcion {
  id: string
  paciente_id: string
  paciente_nombre?: string
  paciente_dni?: string
  paciente_telefono?: string
  fecha_cirugia: string
  hora_inicio: string
  practica_nombre: string
  practica_codigo?: string
  ojo: 'OD' | 'OI' | 'AO'
  cirujano_nombre?: string
  tipo_anestesia?: string
  estado: 'programado' | 'en_espera' | 'pre_quirofano' | 'en_operacion' | 'operado' | 'cancelado'
  llegada_at?: string
  ingreso_pre_quirofano_at?: string
  inicio_cirugia_at?: string
  fin_cirugia_at?: string
  consentimiento_token?: string
  consentimiento_estado?: string
  consentimiento_pdf_url?: string
  lente_tipo?: string
  lente_dioptria?: string
  lente_lote?: string
  quirofanos?: {
    id: string
    nombre: string
    codigo: string
  }
  pacientes?: {
    id: string
    nombre: string
    dni: string
    telefono?: string
    obra_social?: string
    nro_afiliado?: string
  }
}

const ESTADOS_ORDEN = ['programado', 'en_espera', 'pre_quirofano', 'en_operacion', 'operado']

const NOMBRES_ESTADOS: Record<string, string> = {
  programado: 'Por Llegar',
  en_espera: 'En Sala de Espera',
  pre_quirofano: 'En Pre-Quirófano',
  en_operacion: 'En Quirófano',
  operado: 'Operados',
  todos: 'Todos'
}

export default function RecepcionPacientesDia() {
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [turnos, setTurnos] = useState<TurnoRecepcion[]>([])
  const [cargando, setCargando] = useState<boolean>(true)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  
  // Multiselección de filtros de estado (soporta Ctrl/Cmd y Shift + Clic)
  const [filtrosEstado, setFiltrosEstado] = useState<string[]>(['todos'])
  const [ultimoEstadoClickeado, setUltimoEstadoClickeado] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState<string>('')

  // Restaurar estado de filtros desde URL o localStorage al cargar
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const tabsUrl = urlParams.get('tabs') || urlParams.get('tab')
      const stored = localStorage.getItem('crm_recepcion_filtros_estado')

      if (tabsUrl) {
        const parts = tabsUrl.split(',').filter((s) => s === 'todos' || ESTADOS_ORDEN.includes(s))
        if (parts.length > 0) {
          setFiltrosEstado(parts)
          localStorage.setItem('crm_recepcion_filtros_estado', JSON.stringify(parts))
          return
        }
      }

      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFiltrosEstado(parsed)
          if (!parsed.includes('todos')) {
            const url = new URL(window.location.href)
            url.searchParams.set('tabs', parsed.join(','))
            window.history.replaceState({}, '', url.toString())
          }
        }
      }
    } catch (e) {
      console.warn('Error restaurando filtros de recepción:', e)
    }
  }, [])

  // Guardar filtros en estado, localStorage y URL
  const guardarFiltros = (nuevos: string[]) => {
    setFiltrosEstado(nuevos)
    try {
      localStorage.setItem('crm_recepcion_filtros_estado', JSON.stringify(nuevos))
      const url = new URL(window.location.href)
      if (nuevos.includes('todos') || nuevos.length === 0) {
        url.searchParams.delete('tabs')
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tabs', nuevos.join(','))
      }
      window.history.replaceState({}, '', url.toString())
    } catch (e) {
      console.warn('Error guardando filtros de recepción:', e)
    }
  }

  // Manejo de clic en KPI con soporte de Ctrl/Cmd + Clic y Shift + Clic
  const handleKpiClick = (estado: string, e: React.MouseEvent) => {
    if (estado === 'todos') {
      guardarFiltros(['todos'])
      setUltimoEstadoClickeado('todos')
      return
    }

    const esCtrl = e.ctrlKey || e.metaKey
    const esShift = e.shiftKey

    if (esCtrl) {
      if (filtrosEstado.includes('todos')) {
        guardarFiltros([estado])
        setUltimoEstadoClickeado(estado)
        return
      }

      let nuevos: string[] = []
      if (filtrosEstado.includes(estado)) {
        nuevos = filtrosEstado.filter((s) => s !== estado)
        if (nuevos.length === 0) {
          nuevos = ['todos']
        }
      } else {
        nuevos = [...filtrosEstado, estado]
        if (ESTADOS_ORDEN.every((st) => nuevos.includes(st))) {
          nuevos = ['todos']
        }
      }
      guardarFiltros(nuevos)
      setUltimoEstadoClickeado(estado)
    } else if (esShift) {
      const refEstado = ESTADOS_ORDEN.includes(ultimoEstadoClickeado) ? ultimoEstadoClickeado : 'programado'
      const idx1 = ESTADOS_ORDEN.indexOf(refEstado)
      const idx2 = ESTADOS_ORDEN.indexOf(estado)
      if (idx1 !== -1 && idx2 !== -1) {
        const minIdx = Math.min(idx1, idx2)
        const maxIdx = Math.max(idx1, idx2)
        const rango = ESTADOS_ORDEN.slice(minIdx, maxIdx + 1)
        if (rango.length === ESTADOS_ORDEN.length) {
          guardarFiltros(['todos'])
        } else {
          guardarFiltros(rango)
        }
      } else {
        guardarFiltros([estado])
      }
      setUltimoEstadoClickeado(estado)
    } else {
      // Clic simple: Selección exclusiva
      guardarFiltros([estado])
      setUltimoEstadoClickeado(estado)
    }
  }

  // Helper para verificar si un KPI está activo
  const esKpiActivo = (estado: string) => {
    if (estado === 'todos') {
      return filtrosEstado.includes('todos')
    }
    if (filtrosEstado.includes('todos')) {
      return false
    }
    return filtrosEstado.includes(estado)
  }

  // Cargar turnos del día seleccionado
  const fetchTurnosHoy = async () => {
    try {
      setCargando(true)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano?fecha_desde=${fecha}&fecha_hasta=${fecha}`, {
        cache: 'no-store'
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.turnos)) {
          setTurnos(data.turnos)
          return
        }
      }

      // Fallback Supabase directo
      const { data: sbData, error } = await supabase
        .from('turnos_quirofano' as any)
        .select('*, pacientes(*), quirofanos(id, nombre, codigo)')
        .eq('fecha_cirugia', fecha)
        .order('hora_inicio', { ascending: true })

      if (!error && sbData) {
        setTurnos(sbData as any)
      } else {
        setTurnos([])
      }
    } catch (err) {
      console.error('Error cargando turnos de recepción:', err)
      setTurnos([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchTurnosHoy()

    // Suscripción Realtime para actualizar la recepción al instante
    const channel = supabase
      .channel(`recepcion-turnos-${fecha}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos_quirofano', filter: `fecha_cirugia=eq.${fecha}` },
        () => {
          fetchTurnosHoy()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fecha])

  // Recepcionar Paciente: Pasa a 'en_espera'
  const handleRecepcionar = async (turnoId: string) => {
    try {
      setProcesandoId(turnoId)
      const ahoraIso = new Date().toISOString()
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/cambiar-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'en_espera' })
      })

      if (res.ok) {
        const data = await res.json()
        const turnoActualizado = data.turno || {}
        setTurnos((prev) =>
          prev.map((t) => (t.id === turnoId ? { ...t, estado: 'en_espera', llegada_at: ahoraIso, ...turnoActualizado } : t))
        )
      } else {
        await supabase
          .from('turnos_quirofano' as any)
          .update({ estado: 'en_espera', llegada_at: ahoraIso, updated_at: ahoraIso })
          .eq('id', turnoId)
        fetchTurnosHoy()
      }
    } catch (err) {
      console.error('Error al recepcionar paciente:', err)
    } finally {
      setProcesandoId(null)
    }
  }

  // Enviar consentimiento por WhatsApp
  const handleReenviarConsentimientoWA = async (turnoId: string) => {
    try {
      setProcesandoId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/enviar-consentimiento-wa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert('✔ Enlace de consentimiento enviado por WhatsApp al paciente.')
        fetchTurnosHoy()
      } else {
        alert(data.detail || 'Error al enviar consentimiento.')
      }
    } catch (err) {
      console.error('Error enviando consentimiento:', err)
    } finally {
      setProcesandoId(null)
    }
  }

  const cambiarDia = (delta: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setFecha(d.toISOString().slice(0, 10))
  }

  // Métricas del día
  const metricas = useMemo(() => {
    const total = turnos.length
    const citados = turnos.filter((t) => t.estado === 'programado').length
    const recepcionados = turnos.filter((t) => t.estado === 'en_espera').length
    const preQuirofano = turnos.filter((t) => t.estado === 'pre_quirofano').length
    const enQx = turnos.filter((t) => t.estado === 'en_operacion').length
    const operados = turnos.filter((t) => t.estado === 'operado').length
    return { total, citados, recepcionados, preQuirofano, enQx, operados }
  }, [turnos])

  // Filtrado reactivo por pestaña y por buscador de texto
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      // 1. Filtro por multiselección de estado
      if (!filtrosEstado.includes('todos') && !filtrosEstado.includes(t.estado)) {
        return false
      }

      // 2. Filtro por buscador de texto (DNI, Nombre, Teléfono, Práctica, Cirujano)
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim()
        const pacNombre = (t.pacientes?.nombre || t.paciente_nombre || '').toLowerCase()
        const pacDni = (t.pacientes?.dni || t.paciente_dni || '').toLowerCase()
        const pacTel = (t.pacientes?.telefono || t.paciente_telefono || '').toLowerCase()
        const pracNom = (t.practica_nombre || '').toLowerCase()
        const cirujNom = (t.cirujano_nombre || '').toLowerCase()

        return (
          pacNombre.includes(q) ||
          pacDni.includes(q) ||
          pacTel.includes(q) ||
          pracNom.includes(q) ||
          cirujNom.includes(q)
        )
      }

      return true
    })
  }, [turnos, filtrosEstado, busqueda])

  const esMultiseleccionActiva = filtrosEstado.length > 1 && !filtrosEstado.includes('todos')

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* ==================================================================== */}
      {/* 1. BARRA SUPERIOR DE CONTROL: FECHA, ESTADO REALTIME Y BUSCADOR */}
      {/* ==================================================================== */}
      <div className="bg-neutral-900/90 border border-[var(--border)] rounded-2xl p-4 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Selector de Día */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-neutral-950 rounded-xl p-1 border border-[var(--border)]">
            <button
              type="button"
              onClick={() => cambiarDia(-1)}
              className="p-1.5 hover:bg-neutral-800 rounded-lg text-gray-300 transition"
              title="Día anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setFecha(new Date().toISOString().slice(0, 10))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                fecha === new Date().toISOString().slice(0, 10)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => cambiarDia(1)}
              className="p-1.5 hover:bg-neutral-800 rounded-lg text-gray-300 transition"
              title="Día siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-xl border border-[var(--border)]">
            <Calendar size={14} className="text-blue-400" />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
            <Radio size={12} className="animate-pulse text-emerald-400" />
            <span>Sincronizado con Quirófano</span>
          </div>
        </div>

        {/* Buscador Rápido y Refresco */}
        <div className="flex items-center gap-2 flex-1 lg:max-w-md justify-end">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por DNI, Nombre, Cirujano..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-neutral-950 border border-[var(--border)] focus:border-blue-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={fetchTurnosHoy}
            className="p-2 bg-neutral-950 hover:bg-neutral-800 border border-[var(--border)] rounded-xl text-gray-300 hover:text-white transition shadow-sm shrink-0"
            title="Refrescar listado"
          >
            <RefreshCw size={14} className={cargando ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. TARJETAS KPIS INTERACTIVAS (CON SOPORTE CTRL/SHIFT + CLIC) */}
      {/* ==================================================================== */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          
          {/* Tab 1: Todos */}
          <button
            type="button"
            onClick={(e) => handleKpiClick('todos', e)}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden select-none cursor-pointer ${
              esKpiActivo('todos')
                ? 'bg-neutral-800 border-slate-400 shadow-md ring-2 ring-slate-400/40'
                : 'bg-neutral-900/90 border-[var(--border)] hover:bg-neutral-800/80 opacity-80 hover:opacity-100'
            }`}
            title="Ver todos los turnos del día sin filtros"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Todos</span>
              <ListFilter size={13} className={esKpiActivo('todos') ? 'text-slate-200' : 'text-gray-500'} />
            </div>
            <p className="text-xl font-black text-white font-mono mt-1">{metricas.total}</p>
            <span className="text-[10px] text-gray-400 block mt-0.5">Visión del día</span>
          </button>

          {/* Tab 2: Citados / Por Llegar */}
          <button
            type="button"
            onClick={(e) => handleKpiClick('programado', e)}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden select-none cursor-pointer ${
              esKpiActivo('programado')
                ? 'bg-blue-950/70 border-blue-500 shadow-md ring-2 ring-blue-500/50'
                : 'bg-neutral-900/90 border-[var(--border)] hover:bg-blue-950/20 opacity-85 hover:opacity-100'
            }`}
            title="💡 Clic simple: Ver solo Por Llegar • Ctrl + Clic: Sumar a selección • Shift + Clic: Selección de rango"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Por Llegar</span>
              <Clock size={13} className="text-blue-400" />
            </div>
            <p className="text-xl font-black text-blue-400 font-mono mt-1">{metricas.citados}</p>
            <span className="text-[10px] text-blue-300/70 block mt-0.5">Pendientes recepción</span>
          </button>

          {/* Tab 3: En Sala de Espera */}
          <button
            type="button"
            onClick={(e) => handleKpiClick('en_espera', e)}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden select-none cursor-pointer ${
              esKpiActivo('en_espera')
                ? 'bg-amber-950/70 border-amber-500 shadow-md ring-2 ring-amber-500/50'
                : 'bg-neutral-900/90 border-[var(--border)] hover:bg-amber-950/20 opacity-85 hover:opacity-100'
            }`}
            title="💡 Clic simple: Ver solo En Espera • Ctrl + Clic: Sumar a selección • Shift + Clic: Selección de rango"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">En Espera</span>
              <Activity size={13} className="text-amber-400" />
            </div>
            <p className="text-xl font-black text-amber-400 font-mono mt-1">{metricas.recepcionados}</p>
            <span className="text-[10px] text-amber-300/70 block mt-0.5">Listos para quirófano</span>
          </button>

          {/* Tab 4: En Mesa Quirúrgica */}
          <button
            type="button"
            onClick={(e) => handleKpiClick('en_operacion', e)}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden select-none cursor-pointer ${
              esKpiActivo('en_operacion')
                ? 'bg-purple-950/70 border-purple-500 shadow-md ring-2 ring-purple-500/50'
                : 'bg-neutral-900/90 border-[var(--border)] hover:bg-purple-950/20 opacity-85 hover:opacity-100'
            }`}
            title="💡 Clic simple: Ver solo En Quirófano • Ctrl + Clic: Sumar a selección • Shift + Clic: Selección de rango"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400">En Quirófano</span>
              <Activity size={13} className="text-purple-400 animate-spin" />
            </div>
            <p className="text-xl font-black text-purple-400 font-mono mt-1">{metricas.enQx}</p>
            <span className="text-[10px] text-purple-300/70 block mt-0.5">En operación</span>
          </button>

          {/* Tab 5: Cirugías Finalizadas */}
          <button
            type="button"
            onClick={(e) => handleKpiClick('operado', e)}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden select-none cursor-pointer ${
              esKpiActivo('operado')
                ? 'bg-emerald-950/70 border-emerald-500 shadow-md ring-2 ring-emerald-500/50'
                : 'bg-neutral-900/90 border-[var(--border)] hover:bg-emerald-950/20 opacity-85 hover:opacity-100'
            }`}
            title="💡 Clic simple: Ver solo Operados • Ctrl + Clic: Sumar a selección • Shift + Clic: Selección de rango"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Finalizadas</span>
              <CheckCircle2 size={13} className="text-emerald-400" />
            </div>
            <p className="text-xl font-black text-emerald-400 font-mono mt-1">{metricas.operados}</p>
            <span className="text-[10px] text-emerald-300/70 block mt-0.5">Postoperatorio</span>
          </button>
        </div>

        {/* Banner Informativo de Selección Múltiple Activa */}
        {esMultiseleccionActiva && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/40 rounded-xl px-3.5 py-2 text-xs font-semibold text-blue-200 shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-blue-400" />
              <span>
                Filtro múltiple activo (<b>{filtrosEstado.length} estados</b>):{' ' }
                <span className="font-extrabold text-white">
                  {filtrosEstado.map((e) => NOMBRES_ESTADOS[e] || e).join(' + ')}
                </span>{' ' }
                • <b>{turnosFiltrados.length} pacientes</b>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-blue-300/75 hidden sm:inline">💡 Tip: Usa Ctrl + Clic para agregar/quitar estados</span>
              <button
                type="button"
                onClick={() => guardarFiltros(['programado'])}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
              >
                <X size={12} />
                <span>Restablecer a Por Llegar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. LISTADO DE TURNOS CON SEMAFORIZACIÓN DE ALTO CONTRASTE */}
      {/* ==================================================================== */}
      {cargando ? (
        <div className="p-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2 bg-neutral-900/80 border border-[var(--border)] rounded-2xl">
          <Loader2 size={26} className="animate-spin text-blue-500" />
          <span>Cargando programación del día...</span>
        </div>
      ) : turnosFiltrados.length === 0 ? (
        <div className="p-12 text-center text-xs text-gray-400 bg-neutral-900/60 border border-dashed border-gray-800 rounded-2xl space-y-2">
          <p className="text-sm font-bold text-gray-300">No se encontraron turnos quirúrgicos</p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {busqueda
              ? `No hay coincidencias para "${busqueda}" en los estados seleccionados.`
              : filtrosEstado.length === 1 && filtrosEstado[0] === 'programado'
              ? 'No hay pacientes pendientes por llegar en este momento.'
              : filtrosEstado.length === 1 && filtrosEstado[0] === 'en_espera'
              ? 'No hay pacientes en sala de espera actualmente.'
              : filtrosEstado.length === 1 && filtrosEstado[0] === 'pre_quirofano'
              ? 'No hay pacientes en Pre-Quirófano en este momento.'
              : filtrosEstado.length === 1 && filtrosEstado[0] === 'en_operacion'
              ? 'No hay cirugías en curso en este momento.'
              : filtrosEstado.length === 1 && filtrosEstado[0] === 'operado'
              ? 'No hay pacientes operados registrados para esta fecha.'
              : !filtrosEstado.includes('todos')
              ? 'No hay pacientes en los estados operativos seleccionados para hoy.'
              : `No hay cirugías programadas para el día ${fecha}.`}
          </p>
          {(!filtrosEstado.includes('todos') || busqueda) && (
            <button
              type="button"
              onClick={() => {
                guardarFiltros(['todos'])
                setBusqueda('')
              }}
              className="mt-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition shadow"
            >
              Restablecer Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {turnosFiltrados.map((t) => {
            const pac: any = t.pacientes || {}
            const q: any = t.quirofanos || {}
            const esOperado = t.estado === 'operado'
            const esEnOperacion = t.estado === 'en_operacion'
            const esPreQuirofano = t.estado === 'pre_quirofano'
            const esEnEspera = t.estado === 'en_espera'
            const esProgramado = t.estado === 'programado'
            const tieneConsentimiento = t.consentimiento_estado === 'firmado_digital'
            const telefonoValido = pac.telefono || t.paciente_telefono

            // Determinación de Borde Lateral y Estilo Cromático de Alto Impacto
            let cardClasses = 'border-l-4 border-l-blue-500 bg-neutral-900/90 border-gray-800 hover:border-gray-700'
            let badgeEstadoClasses = 'bg-blue-600/20 text-blue-300 border-blue-500/40'
            let estadoLabel = 'Citado / Por Llegar'

            if (esEnEspera) {
              cardClasses = 'border-l-[6px] border-l-amber-500 bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
              badgeEstadoClasses = 'bg-amber-500 text-black font-black border-amber-400'
              estadoLabel = '🟡 En Sala de Espera'
            } else if (esPreQuirofano) {
              cardClasses = 'border-l-[6px] border-l-cyan-500 bg-cyan-950/20 border-cyan-500/40 shadow-lg shadow-cyan-950/20'
              badgeEstadoClasses = 'bg-cyan-500 text-black font-black border-cyan-400'
              estadoLabel = '🩵 En Pre-Quirófano'
            } else if (esEnOperacion) {
              cardClasses = 'border-l-[6px] border-l-purple-500 bg-purple-950/25 border-purple-500/50 shadow-xl shadow-purple-950/30 animate-pulse'
              badgeEstadoClasses = 'bg-purple-600 text-white font-black border-purple-400'
              estadoLabel = '🟣 En Mesa Quirúrgica'
            } else if (esOperado) {
              cardClasses = 'border-l-4 border-l-emerald-500 bg-emerald-950/15 border-emerald-500/30 opacity-90'
              badgeEstadoClasses = 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
              estadoLabel = '✔ Cirugía Finalizada'
            }

            return (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${cardClasses}`}
              >
                {/* Información Principal del Paciente y Quirófano */}
                <div className="space-y-2 flex-1 min-w-0">
                  
                  {/* Encabezado: Horario, Quirófano y Badge de Estado */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-neutral-950 border border-gray-700 text-white text-xs font-mono font-extrabold flex items-center gap-1.5 shadow-sm">
                      <Clock size={12} className="text-blue-400" />
                      {String(t.hora_inicio).slice(0, 5)} hs
                    </span>

                    <span className="text-xs font-bold text-gray-300 px-2.5 py-1 rounded-xl bg-neutral-950 border border-gray-800">
                      {q.nombre || 'Quirófano Central'}
                    </span>

                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl border flex items-center gap-1 ${badgeEstadoClasses}`}>
                      {esEnOperacion && <Activity size={11} className="animate-spin" />}
                      {esPreQuirofano && <Sparkles size={11} />}
                      {esEnEspera && <Activity size={11} />}
                      {esOperado && <Check size={11} />}
                      <span>{estadoLabel}</span>
                    </span>

                    {/* Timestamps de Trazabilidad */}
                    {t.llegada_at && (
                      <span className="text-[11px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/20">
                        Llegó: {formatearHoraDesdeIso(t.llegada_at)}
                      </span>
                    )}

                    {t.ingreso_pre_quirofano_at && (
                      <span className="text-[11px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20">
                        Pre-Qx: {formatearHoraDesdeIso(t.ingreso_pre_quirofano_at)}
                      </span>
                    )}

                    {t.cirujano_nombre && (
                      <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 ml-auto md:ml-0">
                        <Stethoscope size={12} className="text-indigo-400" />
                        {t.cirujano_nombre}
                      </span>
                    )}
                  </div>

                  {/* Fila del Paciente y Práctica */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3 flex-wrap">
                    <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                      {pac.nombre || t.paciente_nombre || 'Paciente sin nombre'}
                    </h4>
                    <span className="text-xs text-gray-400 font-mono">
                      DNI: <strong className="text-gray-200">{pac.dni || t.paciente_dni || 'S/D'}</strong> • Tel: <strong className="text-gray-200">{telefonoValido || 'S/D'}</strong>
                    </span>
                    <span className="text-xs font-bold text-blue-400 truncate">
                      {t.practica_nombre} ({t.ojo})
                    </span>
                  </div>

                  {/* BANNER / ACCIONES DE CONSENTIMIENTO INFORMADO */}
                  <div className="pt-1">
                    {!tieneConsentimiento ? (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-amber-300 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertCircle size={14} className="shrink-0 text-amber-400" />
                          <span>⚠ El paciente aún no ha firmado el Consentimiento Informado.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.consentimiento_token && (
                            <a
                              href={`/consentimiento/${t.consentimiento_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                            >
                              <FileCheck2 size={12} />
                              <span>Firmar en Tablet / Celular</span>
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={procesandoId === t.id || !telefonoValido}
                            onClick={() => handleReenviarConsentimientoWA(t.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm disabled:opacity-50 transition"
                          >
                            <Send size={11} />
                            <span>Reenviar WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                        <CheckCircle2 size={14} />
                        <span>Consentimiento Firmado Digitalmente</span>
                        <a
                          href={`${BACKEND_URL}${t.consentimiento_pdf_url || '/static/consentimiento_' + t.id + '.pdf'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-400 hover:underline flex items-center gap-0.5 ml-2"
                        >
                          <Download size={11} />
                          <span>Ver PDF</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones de Recepción a la derecha */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {esProgramado && (
                    <button
                      type="button"
                      disabled={procesandoId === t.id}
                      onClick={() => handleRecepcionar(t.id)}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                    >
                      {procesandoId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                      <span>🟡 Recepcionar Paciente</span>
                    </button>
                  )}
                  {esEnEspera && (
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1">
                      <Activity size={12} className="text-amber-400" />
                      <span>En Sala de Espera</span>
                    </span>
                  )}
                  {esPreQuirofano && (
                    <span className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <Sparkles size={13} className="text-cyan-400" />
                      <span>En Pre-Quirófano (Preparación)</span>
                    </span>
                  )}
                  {esEnOperacion && (
                    <span className="px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center gap-1">
                      <Activity size={12} className="animate-spin text-purple-400" />
                      <span>Cirugía en Curso</span>
                    </span>
                  )}
                  {esOperado && (
                    <span className="px-3 py-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1">
                      <Check size={12} />
                      <span>Operado</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
