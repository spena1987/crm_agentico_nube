'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  FileCheck2,
  Download,
  Eye,
  RefreshCw,
  Sparkles,
  Phone,
  Radio,
  Timer,
  Edit2,
  XCircle,
  Send,
  Loader2,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import ModalDetalleCirugiaEnVivo from './ModalDetalleCirugiaEnVivo'
import ModalPausaQuirurgicaOms from './modal/ModalPausaQuirurgicaOms'

interface PizarraQuirofanoEnVivoProps {
  onEditarTurno?: (turno: any) => void
}

export default function PizarraQuirofanoEnVivo({ onEditarTurno }: PizarraQuirofanoEnVivoProps) {
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10))
  const [quirofanoFiltro, setQuirofanoFiltro] = useState<string>('todos')
  const [quirofanos, setQuirofanos] = useState<any[]>([])
  const [turnos, setTurnos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [horaActual, setHoraActual] = useState(new Date())
  const [turnoModalDetalle, setTurnoModalDetalle] = useState<any | null>(null)
  const [turnoParaPausaOms, setTurnoParaPausaOms] = useState<any | null>(null)

  // Ticker de hora actual para cronómetros cada 1 segundo
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Cargar salas de quirófano
  useEffect(() => {
    const loadQuirofanos = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/quirofanos?solo_activos=true`)
        const data = await res.json()
        if (data.success && data.quirofanos) {
          setQuirofanos(data.quirofanos)
        }
      } catch (err) {
        console.error('Error cargando quirófanos:', err)
      }
    }
    loadQuirofanos()
  }, [])

  // Cargar turnos del día
  const fetchTurnosDia = async () => {
    try {
      setCargando(true)
      let url = `${BACKEND_URL}/api/turnos-quirofano-dia?fecha=${fecha}`
      if (quirofanoFiltro !== 'todos') {
        url += `&quirofano_id=${quirofanoFiltro}`
      }
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos(data.turnos || [])
      } else {
        setTurnos([])
      }
    } catch (err) {
      console.error('Error cargando turnos del día:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchTurnosDia()
  }, [fecha, quirofanoFiltro])

  // Suscripción Realtime a Supabase
  useEffect(() => {
    const channel = supabase
      .channel('realtime-pizarra-quirofano')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos_quirofano' },
        () => {
          fetchTurnosDia()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fecha, quirofanoFiltro])

  // Cambiar estado del turno (en_espera, en_operacion, operado, cancelado)
  const handleCambiarEstado = async (turnoId: string, nuevoEstado: string) => {
    try {
      setProcesandoId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/cambiar-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos((prev) =>
          prev.map((t) => (t.id === turnoId ? { ...t, estado: nuevoEstado, ...data.turno } : t))
        )
      } else {
        alert(data.detail || data.error || 'Error al cambiar estado')
      }
    } catch (err) {
      console.error('Error actualizando estado:', err)
    } finally {
      setProcesandoId(null)
    }
  }

  // Navegación de fechas
  const cambiarDia = (diasDelta: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + diasDelta)
    setFecha(d.toISOString().slice(0, 10))
  }

  // Métricas del día
  const metricas = useMemo(() => {
    const total = turnos.length
    const programados = turnos.filter((t) => t.estado === 'programado').length
    const enEspera = turnos.filter((t) => t.estado === 'en_espera').length
    const enOperacion = turnos.filter((t) => t.estado === 'en_operacion').length
    const operados = turnos.filter((t) => t.estado === 'operado').length
    return { total, programados, enEspera, enOperacion, operados }
  }, [turnos])

  // Calcular tiempo transcurrido en quirófano con alertas de sobretiempo
  const calcularTiempoEnOperacion = (inicioIso?: string, duracionEstimada: number = 20) => {
    if (!inicioIso) return { minutos: 0, segundos: 0, texto: '00:00', esExcedidoModerado: false, esExcedidoCritico: false, minutosExcedidos: 0 }
    const start = new Date(inicioIso).getTime()
    const now = horaActual.getTime()
    const diffSec = Math.max(0, Math.floor((now - start) / 1000))
    const min = Math.floor(diffSec / 60)
    const sec = diffSec % 60
    const esExcedidoModerado = min > duracionEstimada && min <= duracionEstimada * 1.3
    const esExcedidoCritico = min > duracionEstimada * 1.3
    const minutosExcedidos = Math.max(0, min - duracionEstimada)

    return {
      minutos: min,
      segundos: sec,
      texto: `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`,
      esExcedidoModerado,
      esExcedidoCritico,
      minutosExcedidos
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. BARRA SUPERIOR DE CONTROL, FECHA, FILTRO Y REALTIME */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Selector de Fecha */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-[var(--border)]">
            <button
              onClick={() => cambiarDia(-1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-[var(--secondary)] hover:text-[var(--foreground)] transition"
              title="Día anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setFecha(new Date().toISOString().slice(0, 10))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                fecha === new Date().toISOString().slice(0, 10)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-white dark:hover:bg-slate-700 text-[var(--secondary)]'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => cambiarDia(1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-[var(--secondary)] hover:text-[var(--foreground)] transition"
              title="Día siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
          />

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
            <Radio size={12} className="animate-pulse text-emerald-500" />
            <span>En Vivo</span>
          </div>
        </div>

        {/* Filtro por Quirófano */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--secondary)] hidden sm:block">Sala / Quirófano:</label>
          <select
            value={quirofanoFiltro}
            onChange={(e) => setQuirofanoFiltro(e.target.value)}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
          >
            <option value="todos">Todas las Salas de Quirófano</option>
            {quirofanos.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nombre} ({q.codigo})
              </option>
            ))}
          </select>
          <button
            onClick={fetchTurnosDia}
            disabled={cargando}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-[var(--border)] transition"
            title="Refrescar datos"
          >
            <RefreshCw size={15} className={cargando ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* 2. KPI COUNTERS DEL DÍA */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Total Cirugías</p>
            <p className="text-xl font-extrabold text-[var(--foreground)] font-mono mt-0.5">{metricas.total}</p>
          </div>
          <Calendar size={20} className="text-blue-500 opacity-60" />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-100/60 dark:bg-slate-800/40 border border-[var(--border)] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Programados</p>
            <p className="text-xl font-extrabold text-[var(--foreground)] font-mono mt-0.5">{metricas.programados}</p>
          </div>
          <Clock size={20} className="text-slate-400 opacity-60" />
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">En Espera (Llegaron)</p>
            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">{metricas.enEspera}</p>
          </div>
          <Activity size={20} className="text-amber-500 opacity-60" />
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between animate-pulse">
          <div>
            <p className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">En Quirófano</p>
            <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 font-mono mt-0.5">{metricas.enOperacion}</p>
          </div>
          <Timer size={20} className="text-purple-500 opacity-80" />
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Operados (Concluidos)</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{metricas.operados}</p>
          </div>
          <CheckCircle2 size={20} className="text-emerald-500 opacity-80" />
        </div>
      </div>

      {/* 3. LISTADO DE CIRUGÍAS DEL DÍA EN TIEMPO REAL */}
      {cargando ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span>Cargando pizarra de cirugías del día...</span>
        </div>
      ) : turnos.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] bg-[var(--card)] border border-dashed rounded-2xl">
          No hay turnos quirúrgicos programados para la fecha seleccionada ({fecha}).
        </div>
      ) : (
        <div className="space-y-3.5">
          {turnos.map((t) => {
            const pac = t.pacientes || {}
            const q = t.quirofanos || {}
            const duracionEstimada = t.duracion_minutos || 20
            const tiempoOp = calcularTiempoEnOperacion(t.inicio_cirugia_at, duracionEstimada)
            const esEnOperacion = t.estado === 'en_operacion'
            const esOperado = t.estado === 'operado'
            const esEnEspera = t.estado === 'en_espera'

            // Color del borde según estado
            const borderCls = esEnOperacion
              ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20 dark:bg-purple-950/10'
              : esEnEspera
              ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/10'
              : esOperado
              ? 'border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/5 opacity-90'
              : 'border-[var(--border)] bg-[var(--card)]'

            return (
              <div
                key={t.id}
                onClick={() => setTurnoModalDetalle(t)}
                className={`p-4 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:border-blue-500/60 hover:shadow-md ${borderCls}`}
                title="💡 Clic para abrir Ficha de Programación, Historia Clínica e Indicaciones Médicas de Geclisa"
              >
                {/* Bloque Izquierdo: Horario, Sala, Paciente y Cirugía */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  {/* Fila 1: Horario + Sala + Estado Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-600 text-white text-xs font-mono font-extrabold shadow-sm">
                      <Clock size={13} />
                      <span>{String(t.hora_inicio).slice(0, 5)} hs</span>
                    </div>

                    <span className="text-xs font-bold text-[var(--foreground)] px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[var(--border)]">
                      {q.nombre || 'Quirófano'}
                    </span>

                    <span className="text-[11px] font-semibold text-[var(--secondary)]">
                      ⏱ {duracionEstimada} min estimados
                    </span>

                    {/* Badge Lateralidad Ocular */}
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold">
                      {t.ojo === 'OD' ? 'Ojo Derecho (OD)' : t.ojo === 'OI' ? 'Ojo Izquierdo (OI)' : 'Ambos Ojos (AO)'}
                    </span>

                    {/* Estado de Llegada */}
                    {t.llegada_at && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        Llegó: {String(t.llegada_at).slice(11, 16)} hs
                      </span>
                    )}
                  </div>

                  {/* Fila 2: Paciente & Cirugía */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-base font-extrabold text-[var(--foreground)] tracking-tight">
                      {pac.nombre || 'Paciente sin nombre'}
                    </h3>
                    <span className="text-xs text-[var(--secondary)] font-mono">DNI: {pac.dni || 'S/D'}</span>
                    {pac.telefono && (
                      <span className="text-xs text-[var(--secondary)] flex items-center gap-1">
                        <Phone size={11} /> {pac.telefono}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {t.obra_social || pac.obra_social || 'Particular'}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Scissors size={13} />
                    <span>{t.practica_nombre || 'Cirugía Oftalmológica'}</span>
                  </p>

                  {/* Fila 3: Equipo Médico & Consentimiento */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--secondary)] pt-1 border-t border-[var(--border)]">
                    <div>
                      👨‍⚕️ <b>Cirujano:</b> {t.cirujano_nombre || 'No asignado'}
                    </div>
                    {t.medico_derivador_nombre && (
                      <div>
                        📥 <b>Derivador:</b> {t.medico_derivador_nombre}
                      </div>
                    )}
                    {t.anestesiologo_nombre && (
                      <div>
                        💉 <b>Anestesista:</b> {t.anestesiologo_nombre}
                      </div>
                    )}
                    {t.instrumentador_nombre && (
                      <div>
                        ✂ <b>Instrumentador:</b> {t.instrumentador_nombre}
                      </div>
                    )}

                    {/* Información del Lente LIO */}
                    {t.lleva_lente && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold">
                        <span>👁 LIO: {t.lente_tipo || 'Estándar'}</span>
                        {t.lente_dioptria && <span>• Diop: {t.lente_dioptria}</span>}
                        {t.es_torico && <span>• Tórico: T{t.lente_torico_valor || 0} (Eje {t.lente_torico_eje || 90}°)</span>}
                        {t.lente_lote && <span>• Lote: {t.lente_lote}</span>}
                      </div>
                    )}

                    {/* Estado del Consentimiento */}
                    <div>
                      {t.consentimiento_estado === 'firmado_digital' ? (
                        <a
                          href={`${BACKEND_URL}${t.consentimiento_pdf_url || '/static/consentimiento_' + t.id + '.pdf'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                        >
                          <FileCheck2 size={12} />
                          <span>Consentimiento Firmado</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <AlertCircle size={12} />
                          <span>Consentimiento Pendiente</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bloque Derecho: Cronómetro Quirúrgico & Botones de Acción de 1 Clic */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-center gap-2.5 shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border)] pt-3 lg:pt-0 lg:pl-4">
                  {/* Cronómetro en Vivo para cirugías en curso */}
                  {esEnOperacion && (
                    <div className={`p-2.5 rounded-xl text-white font-mono flex items-center gap-2 shadow-md w-full sm:w-auto text-center justify-center ${
                      tiempoOp.esExcedidoCritico
                        ? 'bg-rose-600 animate-bounce border border-rose-300'
                        : tiempoOp.esExcedidoModerado
                        ? 'bg-amber-500 text-slate-950 font-bold border border-amber-300 animate-pulse'
                        : 'bg-purple-600 animate-pulse'
                    }`}>
                      {tiempoOp.esExcedidoCritico || tiempoOp.esExcedidoModerado ? <AlertTriangle size={16} /> : <Timer size={16} />}
                      <div className="text-left">
                        <p className="text-[9px] uppercase font-bold tracking-wider opacity-90">
                          {tiempoOp.esExcedidoCritico ? 'Sobreduración' : tiempoOp.esExcedidoModerado ? 'Tiempo Excedido' : 'En Quirófano'}
                        </p>
                        <p className="text-sm font-extrabold">
                          {tiempoOp.texto} <span className="text-[10px] opacity-80 font-normal">/ {duracionEstimada}m</span>
                          {tiempoOp.minutosExcedidos > 0 && <span className="ml-1 text-[11px] font-black underline">(+{tiempoOp.minutosExcedidos}m)</span>}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Acciones de Estado */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Si está en Programado, avisar que aún no llegó a recepción */}
                    {t.estado === 'programado' && (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-[var(--border)] flex items-center gap-1.5">
                          <Clock size={13} />
                          <span>Citado (Pendiente Recepción)</span>
                        </span>
                        {/* Opción rápida de respaldo */}
                        <button
                          type="button"
                          disabled={procesandoId === t.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCambiarEstado(t.id, 'en_espera')
                          }}
                          className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-[11px] font-bold transition-all"
                          title="Marcar llegada directamente en caso de emergencia"
                        >
                          <span>+ Recepcionar</span>
                        </button>
                      </div>
                    )}

                    {/* Botón 2: Iniciar Cirugía (Abre Pausa Quirúrgica OMS) */}
                    {t.estado === 'en_espera' && (
                      <button
                        type="button"
                        disabled={procesandoId === t.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setTurnoParaPausaOms(t)
                        }}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                        title="Abrir verificación de Pausa Quirúrgica OMS e iniciar intervención"
                      >
                        {procesandoId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        <span>🟣 Iniciar Cirugía (Pausa OMS)</span>
                      </button>
                    )}

                    {/* Botón 3: Finalizar Cirugía */}
                    {t.estado === 'en_operacion' && (
                      <button
                        type="button"
                        disabled={procesandoId === t.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCambiarEstado(t.id, 'operado')
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                        title="Finalizar cirugía, registrar egreso, emitir Parte Qx y archivar como operado"
                      >
                        {procesandoId === t.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        <span>🟢 Finalizar (Operado)</span>
                      </button>
                    )}

                    {/* Si ya está operado */}
                    {esOperado && (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                          <Check size={13} />
                          <span>Concluido</span>
                        </span>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${t.id}/parte-quirurgico`)
                              const data = await res.json()
                              if (res.ok && data.pdf_url) {
                                window.open(`${BACKEND_URL}${data.pdf_url}`, '_blank')
                              }
                            } catch (err) {
                              console.error('Error abriendo parte Qx:', err)
                            }
                          }}
                          className="px-2 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-bold flex items-center gap-1 hover:bg-blue-100 transition"
                          title="Descargar Protocolo / Parte Quirúrgico Oficial en PDF"
                        >
                          <FileText size={12} />
                          <span>Parte Qx</span>
                        </button>
                      </div>
                    )}

                    {/* Editar Ficha */}
                    {onEditarTurno && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditarTurno(t)
                        }}
                        className="p-1.5 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[var(--foreground)] transition"
                        title="Ver / Editar ficha completa"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Clínico de 3 Pestañas con Geclisa */}
      {turnoModalDetalle && (
        <ModalDetalleCirugiaEnVivo
          isOpen={!!turnoModalDetalle}
          onClose={() => setTurnoModalDetalle(null)}
          turno={turnoModalDetalle}
          quirofanos={quirofanos}
          onEstadoCambiado={(tId, nuevoEst, tActualizado) => {
            setTurnos((prev) =>
              prev.map((t) => (t.id === tId ? { ...t, estado: nuevoEst, ...tActualizado } : t))
            )
            setTurnoModalDetalle(tActualizado)
          }}
          onTurnoGuardado={(tActualizado) => {
            setTurnos((prev) =>
              prev.map((t) => (t.id === tActualizado.id ? { ...t, ...tActualizado } : t))
            )
            setTurnoModalDetalle(tActualizado)
          }}
        />
      )}

      {/* Modal de Pausa Quirúrgica OMS al iniciar desde la tarjeta */}
      {turnoParaPausaOms && (
        <ModalPausaQuirurgicaOms
          isOpen={!!turnoParaPausaOms}
          onClose={() => setTurnoParaPausaOms(null)}
          turno={turnoParaPausaOms}
          onConfirmarInicio={async () => {
            const tId = turnoParaPausaOms.id
            setTurnoParaPausaOms(null)
            await handleCambiarEstado(tId, 'en_operacion')
          }}
          procesando={procesandoId === turnoParaPausaOms.id}
        />
      )}
    </div>
  )
}