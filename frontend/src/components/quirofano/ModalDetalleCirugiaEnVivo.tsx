'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Clock,
  User,
  Scissors,
  Stethoscope,
  Activity,
  FileHeart,
  Pill,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  Timer,
  Download,
  FileCheck2,
  Eye,
  RefreshCw,
  Search,
  Send,
  Loader2,
  CalendarClock,
  Sparkles,
  ShieldCheck,
  Save,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

type TabTipo = 'programacion' | 'historia_clinica' | 'indicaciones'

interface ModalDetalleCirugiaEnVivoProps {
  isOpen: boolean
  onClose: () => void
  turno: any
  quirofanos: any[]
  onEstadoCambiado?: (turnoId: string, nuevoEstado: string, turnoActualizado: any) => void
  onTurnoGuardado?: (turnoActualizado: any) => void
}

export default function ModalDetalleCirugiaEnVivo({
  isOpen,
  onClose,
  turno,
  quirofanos,
  onEstadoCambiado,
  onTurnoGuardado
}: ModalDetalleCirugiaEnVivoProps) {
  const [activeTab, setActiveTab] = useState<TabTipo>('programacion')
  const [horaActual, setHoraActual] = useState(new Date())
  const [procesandoEstado, setProcesandoEstado] = useState(false)

  // Estado local del turno para reflejar cambios en vivo
  const [turnoLocal, setTurnoLocal] = useState<any>(turno || {})

  // Pestaña 2: Historia Clínica
  const [cargandoHC, setCargandoHC] = useState(false)
  const [datosHC, setDatosHC] = useState<any | null>(null)
  const [errorHC, setErrorHC] = useState<string | null>(null)
  const [filtroTextoHC, setFiltroTextoHC] = useState('')

  // Pestaña 3: Indicaciones Médicas
  const [cargandoInd, setCargandoInd] = useState(false)
  const [datosInd, setDatosInd] = useState<any | null>(null)
  const [errorInd, setErrorInd] = useState<string | null>(null)
  const [filtroTextoInd, setFiltroTextoInd] = useState('')

  // Pestaña 1: Edición de Programación
  const [formData, setFormData] = useState<any>({
    quirofano_id: '',
    fecha_cirugia: '',
    hora_inicio: '',
    duracion_minutos: 20,
    ojo: 'OD',
    cirujano_nombre: '',
    ayudante_nombre: '',
    anestesiologo_nombre: '',
    instrumentador_nombre: '',
    medico_derivador_nombre: '',
    lleva_lente: false,
    lente_tipo: '',
    lente_dioptria: '',
    es_torico: false,
    lente_torico_valor: 0,
    lente_torico_eje: 90,
    tipo_anestesia: 'Tópica + Sedación',
    observaciones: '',
    observaciones_intraoperatorias: ''
  })
  const [guardandoProg, setGuardandoProg] = useState(false)
  const [mensajeExitoProg, setMensajeExitoProg] = useState<string | null>(null)
  const [modelosLio, setModelosLio] = useState<any[]>([])

  // Sincronizar datos al abrir
  useEffect(() => {
    if (turno) {
      setTurnoLocal(turno)
      setFormData({
        quirofano_id: turno.quirofano_id || '',
        fecha_cirugia: turno.fecha_cirugia || '',
        hora_inicio: String(turno.hora_inicio || '').slice(0, 5),
        duracion_minutos: turno.duracion_minutos || 20,
        ojo: turno.ojo || 'OD',
        cirujano_nombre: turno.cirujano_nombre || '',
        ayudante_nombre: turno.ayudante_nombre || '',
        anestesiologo_nombre: turno.anestesiologo_nombre || '',
        instrumentador_nombre: turno.instrumentador_nombre || '',
        medico_derivador_nombre: turno.medico_derivador_nombre || '',
        lleva_lente: turno.lleva_lente || false,
        lente_tipo: turno.lente_tipo || '',
        lente_dioptria: turno.lente_dioptria || '',
        es_torico: turno.es_torico || false,
        lente_torico_valor: turno.lente_torico_valor || 0,
        lente_torico_eje: turno.lente_torico_eje || 90,
        tipo_anestesia: turno.tipo_anestesia || 'Tópica + Sedación',
        observaciones: turno.observaciones || '',
        observaciones_intraoperatorias: turno.observaciones_intraoperatorias || ''
      })
    }
  }, [turno])

  // Cargar catálogo de modelos LIO
  useEffect(() => {
    const fetchLio = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/modelos-lio`)
        const data = await res.json()
        if (data.success && data.modelos) {
          setModelosLio(data.modelos)
        }
      } catch (e) {}
    }
    fetchLio()
  }, [])

  // Ticker de 1 segundo para el cronómetro
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Cargar Historia Clínica de Geclisa cuando se abre la pestaña 2
  useEffect(() => {
    if (activeTab === 'historia_clinica' && !datosHC && turnoLocal?.paciente_id) {
      consultarHistoriaClinica()
    }
  }, [activeTab, turnoLocal?.paciente_id])

  // Cargar Indicaciones Médicas de Geclisa cuando se abre la pestaña 3
  useEffect(() => {
    if (activeTab === 'indicaciones' && !datosInd && turnoLocal?.paciente_id) {
      consultarIndicacionesMedicas()
    }
  }, [activeTab, turnoLocal?.paciente_id])

  const consultarHistoriaClinica = async () => {
    try {
      setCargandoHC(true)
      setErrorHC(null)
      const pacId = turnoLocal.paciente_id || turnoLocal.pacientes?.id || turnoLocal.paciente_dni
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(pacId)}/historia-clinica`)
      const data = await res.json()
      if (res.ok && data.encontrado) {
        setDatosHC(data)
      } else {
        setDatosHC(null)
        setErrorHC(data.mensaje || 'No se encontraron evoluciones en Geclisa para este paciente.')
      }
    } catch (err: any) {
      setErrorHC(err.message || 'Error al conectar con la API de Geclisa.')
    } finally {
      setCargandoHC(false)
    }
  }

  const consultarIndicacionesMedicas = async () => {
    try {
      setCargandoInd(true)
      setErrorInd(null)
      const pacId = turnoLocal.paciente_id || turnoLocal.pacientes?.id || turnoLocal.paciente_dni
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(pacId)}/indicaciones`)
      const data = await res.json()
      if (res.ok && data.encontrado) {
        setDatosInd(data)
      } else {
        setDatosInd(null)
        setErrorInd(data.mensaje || 'No se encontraron indicaciones médicas en Geclisa para este paciente.')
      }
    } catch (err: any) {
      setErrorInd(err.message || 'Error al conectar con la API de Geclisa.')
    } finally {
      setCargandoInd(false)
    }
  }

  // Cambio de estado intraoperatorio
  const handleCambiarEstado = async (nuevoEstado: string) => {
    if (!turnoLocal?.id) return
    try {
      setProcesandoEstado(true)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoLocal.id}/cambiar-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const actualizado = { ...turnoLocal, estado: nuevoEstado, ...data.turno }
        setTurnoLocal(actualizado)
        if (onEstadoCambiado) {
          onEstadoCambiado(turnoLocal.id, nuevoEstado, actualizado)
        }
      } else {
        alert(data.detail || data.error || 'Error al actualizar estado')
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err)
    } finally {
      setProcesandoEstado(false)
    }
  }

  // Guardar cambios en programación del turno
  const handleGuardarProgramacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!turnoLocal?.id) return
    try {
      setGuardandoProg(true)
      setMensajeExitoProg(null)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoLocal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExitoProg('✔ Cambios de programación guardados exitosamente.')
        const turnoActualizado = { ...turnoLocal, ...formData, ...data.turno }
        setTurnoLocal(turnoActualizado)
        if (onTurnoGuardado) onTurnoGuardado(turnoActualizado)
        setTimeout(() => setMensajeExitoProg(null), 3500)
      } else {
        alert(data.detail || 'Error al guardar programación')
      }
    } catch (err) {
      console.error('Error guardando programación:', err)
    } finally {
      setGuardandoProg(false)
    }
  }

  if (!isOpen || !turno) return null

  const pac = turnoLocal.pacientes || {}
  const q = quirofanos.find((item) => item.id === turnoLocal.quirofano_id) || turnoLocal.quirofanos || {}
  const esEnOperacion = turnoLocal.estado === 'en_operacion'
  const esOperado = turnoLocal.estado === 'operado'
  const esEnEspera = turnoLocal.estado === 'en_espera'

  // Cálculo del cronómetro
  const calcularTiempoEnOperacion = () => {
    if (!turnoLocal.inicio_cirugia_at) return { texto: '00:00', min: 0 }
    const start = new Date(turnoLocal.inicio_cirugia_at).getTime()
    const now = horaActual.getTime()
    const diffSec = Math.max(0, Math.floor((now - start) / 1000))
    const min = Math.floor(diffSec / 60)
    const sec = diffSec % 60
    return {
      min,
      texto: `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }
  }
  const cronometro = calcularTiempoEnOperacion()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
        
        {/* ==================================================================== */}
        {/* 1. CABECERA CLÍNICA & CONSOLA INTRAOPERATORIA */}
        {/* ==================================================================== */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-slate-50/80 dark:bg-slate-900/80 flex flex-col gap-3.5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-xl bg-blue-600 text-white text-xs font-mono font-extrabold shadow-sm">
                  🕒 {String(turnoLocal.hora_inicio || '').slice(0, 5)} hs
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[var(--foreground)] text-xs font-bold">
                  {q.nombre || 'Quirófano'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                  {turnoLocal.ojo === 'OD' ? 'Ojo Derecho (OD)' : turnoLocal.ojo === 'OI' ? 'Ojo Izquierdo (OI)' : 'Ambos Ojos (AO)'}
                </span>

                {/* Badge de Estado */}
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    esEnOperacion
                      ? 'bg-purple-600 text-white animate-pulse'
                      : esEnEspera
                      ? 'bg-amber-500 text-white'
                      : esOperado
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {esEnOperacion && <Activity size={12} className="animate-spin" />}
                  {esEnEspera && <Activity size={12} />}
                  {esOperado && <Check size={12} />}
                  <span>
                    {esEnOperacion
                      ? 'En Operación'
                      : esEnEspera
                      ? 'En Sala de Espera'
                      : esOperado
                      ? 'Cirugía Finalizada (Operado)'
                      : 'Programado'}
                  </span>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 pt-0.5">
                <h2 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] truncate">
                  {pac.nombre || turnoLocal.paciente_nombre || 'Paciente'}
                </h2>
                <span className="text-xs text-[var(--secondary)] font-mono">
                  DNI: {pac.dni || turnoLocal.paciente_dni || 'S/D'} • Obra Social: {turnoLocal.obra_social || pac.obra_social || 'Particular'}
                </span>
              </div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                🩺 {turnoLocal.practica_nombre} • Cirujano: {turnoLocal.cirujano_nombre || 'No asignado'}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-800 transition shrink-0"
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>

          {/* BARRA DE CONTROLES INTRAOPERATORIOS & TRAZABILIDAD */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-[var(--border)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Trazabilidad Horaria */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--secondary)]">
              <div>
                🕒 <b>Llegada:</b>{' '}
                <span className="font-mono text-[var(--foreground)]">
                  {turnoLocal.llegada_at ? new Date(turnoLocal.llegada_at).toLocaleTimeString().slice(0, 5) + ' hs' : '--:--'}
                </span>
              </div>
              <div>
                🕒 <b>Ingreso Qx:</b>{' '}
                <span className="font-mono text-[var(--foreground)]">
                  {turnoLocal.inicio_cirugia_at ? new Date(turnoLocal.inicio_cirugia_at).toLocaleTimeString().slice(0, 5) + ' hs' : '--:--'}
                </span>
              </div>
              <div>
                🕒 <b>Egreso Qx:</b>{' '}
                <span className="font-mono text-[var(--foreground)]">
                  {turnoLocal.fin_cirugia_at ? new Date(turnoLocal.fin_cirugia_at).toLocaleTimeString().slice(0, 5) + ' hs' : '--:--'}
                </span>
              </div>
            </div>

            {/* Botones de Acción de Estado y Cronómetro */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              {/* Cronómetro en Vivo */}
              {esEnOperacion && (
                <div className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-mono flex items-center gap-2 shadow-sm animate-pulse">
                  <Timer size={15} />
                  <span className="text-xs font-extrabold">{cronometro.texto}</span>
                  <span className="text-[10px] opacity-75 font-normal">/ {turnoLocal.duracion_minutos || 20}m</span>
                </div>
              )}

              {/* Botón: Iniciar Cirugía */}
              {(turnoLocal.estado === 'programado' || turnoLocal.estado === 'en_espera') && (
                <button
                  type="button"
                  disabled={procesandoEstado}
                  onClick={() => handleCambiarEstado('en_operacion')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                  title="Registrar ingreso del paciente al quirófano e iniciar intervención"
                >
                  {procesandoEstado ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  <span>🟣 Iniciar Cirugía</span>
                </button>
              )}

              {/* Botón: Finalizar Cirugía */}
              {esEnOperacion && (
                <button
                  type="button"
                  disabled={procesandoEstado}
                  onClick={() => handleCambiarEstado('operado')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                  title="Concluir intervención, sellar horario de fin y archivar como operado"
                >
                  {procesandoEstado ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>🟢 Finalizar Cirugía (Operado)</span>
                </button>
              )}

              {esOperado && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <Check size={14} />
                  <span>Cirugía Concluida</span>
                </div>
              )}
            </div>
          </div>

          {/* BARRA DE NAVEGACIÓN DE LAS 3 PESTAÑAS */}
          <div className="flex items-center gap-2 p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setActiveTab('programacion')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'programacion'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-[var(--border)]'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <Calendar size={15} />
              <span>1. Programación del Turno</span>
            </button>

            <button
              onClick={() => setActiveTab('historia_clinica')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'historia_clinica'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-[var(--border)]'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <FileHeart size={15} />
              <span>2. Historia Clínica (Geclisa)</span>
            </button>

            <button
              onClick={() => setActiveTab('indicaciones')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'indicaciones'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-[var(--border)]'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <Pill size={15} />
              <span>3. Indicaciones Médicas</span>
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 2. CUERPO DE LAS PESTAÑAS (SCROLLABLE) */}
        {/* ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ==================================================================== */}
          {/* PESTAÑA 1: PROGRAMACIÓN DEL TURNO & LIO & EQUIPO */}
          {/* ==================================================================== */}
          {activeTab === 'programacion' && (
            <form onSubmit={handleGuardarProgramacion} className="space-y-6 animate-fade-in">
              {mensajeExitoProg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{mensajeExitoProg}</span>
                </div>
              )}

              {/* SECCIÓN A: EQUIPO QUIRÚRGICO & LATERALIDAD */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-4">
                <h4 className="text-xs font-bold uppercase text-[var(--secondary)] tracking-wider flex items-center gap-1.5">
                  <Scissors size={14} className="text-blue-600" />
                  <span>Equipo Médico, Cirujano & Lateralidad</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--secondary)]">Cirujano Principal *</label>
                    <input
                      type="text"
                      value={formData.cirujano_nombre}
                      onChange={(e) => setFormData({ ...formData, cirujano_nombre: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--secondary)]">Médico Derivador</label>
                    <input
                      type="text"
                      value={formData.medico_derivador_nombre}
                      onChange={(e) => setFormData({ ...formData, medico_derivador_nombre: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--secondary)]">Anestesiólogo</label>
                    <input
                      type="text"
                      value={formData.anestesiologo_nombre}
                      onChange={(e) => setFormData({ ...formData, anestesiologo_nombre: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[var(--secondary)]">Instrumentador / Asistente</label>
                    <input
                      type="text"
                      value={formData.instrumentador_nombre}
                      onChange={(e) => setFormData({ ...formData, instrumentador_nombre: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN B: LENTE INTRAOCULAR (LIO), DIOPTRÍA & TÓRICO */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="lleva_lente_modal"
                      checked={formData.lleva_lente}
                      onChange={(e) => setFormData({ ...formData, lleva_lente: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="lleva_lente_modal" className="text-xs font-bold text-[var(--foreground)] cursor-pointer">
                      ¿Lleva Implante de Lente Intraocular (LIO)?
                    </label>
                  </div>
                  {formData.lleva_lente && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                      Configuración de Biometría
                    </span>
                  )}
                </div>

                {formData.lleva_lente ? (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[11px] font-bold text-[var(--secondary)]">Modelo de LIO</label>
                        <select
                          value={formData.lente_tipo}
                          onChange={(e) => setFormData({ ...formData, lente_tipo: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                        >
                          <option value="">Seleccione modelo configurado...</option>
                          {modelosLio.map((m) => (
                            <option key={m.id} value={`${m.modelo} (${m.marca})`}>
                              {m.modelo} — {m.marca} ({m.tipo_optica})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-[var(--secondary)]">
                          Dioptría Esférica (Paso 0.25 D)
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          value={formData.lente_dioptria}
                          onChange={(e) => setFormData({ ...formData, lente_dioptria: e.target.value })}
                          placeholder="Ej: +21.50, +22.00, -2.50..."
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* TORICIDAD */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-[var(--border)] space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="es_torico_modal"
                          checked={formData.es_torico}
                          onChange={(e) => setFormData({ ...formData, es_torico: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="es_torico_modal" className="text-xs font-bold text-[var(--foreground)] cursor-pointer">
                          ¿Es Lente Tórico (Corrección de Astigmatismo)?
                        </label>
                      </div>

                      {formData.es_torico && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-[var(--border)]">
                          <div>
                            <label className="text-[11px] font-bold text-[var(--secondary)]">
                              Valor Tórico (Entero, paso discreto 1)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={formData.lente_torico_valor}
                              onChange={(e) => setFormData({ ...formData, lente_torico_valor: parseInt(e.target.value) || 0 })}
                              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-[var(--secondary)]">
                              Eje de Alineación Tórica (0° a 180°)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="180"
                              value={formData.lente_torico_eje}
                              onChange={(e) => setFormData({ ...formData, lente_torico_eje: parseInt(e.target.value) || 0 })}
                              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--secondary)] italic">
                    ℹ Procedimiento programado sin implante de Lente Intraocular.
                  </p>
                )}
              </div>

              {/* SECCIÓN C: CONSENTIMIENTO INFORMADO & OBSERVACIONES */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-4">
                <h4 className="text-xs font-bold uppercase text-[var(--secondary)] tracking-wider flex items-center gap-1.5">
                  <FileCheck2 size={14} className="text-emerald-600" />
                  <span>Consentimiento Informado & Observaciones</span>
                </h4>

                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-[var(--border)]">
                  <div>
                    <p className="text-xs font-bold text-[var(--foreground)]">Estado de Firma Digital</p>
                    <p className="text-[11px] text-[var(--secondary)]">
                      {turnoLocal.consentimiento_estado === 'firmado_digital'
                        ? 'Firmado por el paciente con IP y sellado de tiempo de auditoría.'
                        : 'Pendiente de firma digital por el paciente.'}
                    </p>
                  </div>

                  {turnoLocal.consentimiento_estado === 'firmado_digital' ? (
                    <a
                      href={`${BACKEND_URL}${turnoLocal.consentimiento_pdf_url || '/static/consentimiento_' + turnoLocal.id + '.pdf'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <Download size={14} />
                      <span>Descargar PDF Firmado</span>
                    </a>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-bold flex items-center gap-1">
                      <AlertCircle size={14} />
                      <span>Pendiente de Firma</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--secondary)] flex items-center gap-1.5">
                      <span>Observaciones Prequirúrgicas</span>
                      <span className="text-[10px] text-slate-400 font-normal">(Ayuno, dilatación, alergias)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      placeholder="Instrucciones previas al ingreso a quirófano..."
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <Activity size={13} />
                      <span>Observaciones / Comentarios Intraoperatorios</span>
                      <span className="text-[10px] text-slate-400 font-normal">(Durante la Cirugía)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={formData.observaciones_intraoperatorias}
                      onChange={(e) => setFormData({ ...formData, observaciones_intraoperatorias: e.target.value })}
                      placeholder="Evolución en mesa quirúrgica, técnica, hallazgos, incidentes, lente implantado..."
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-purple-300 dark:border-purple-800/50 text-xs text-[var(--foreground)] outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* BOTÓN DE GUARDADO */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="submit"
                  disabled={guardandoProg}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2 transition"
                >
                  {guardandoProg ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>Guardar Cambios de Programación</span>
                </button>
              </div>
            </form>
          )}

          {/* ==================================================================== */}
          {/* PESTAÑA 2: HISTORIA CLÍNICA EN VIVO (GECLISA) */}
          {/* ==================================================================== */}
          {activeTab === 'historia_clinica' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-72">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={filtroTextoHC}
                      onChange={(e) => setFiltroTextoHC(e.target.value)}
                      placeholder="Buscar en evoluciones..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-xs outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={consultarHistoriaClinica}
                  disabled={cargandoHC}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 border border-[var(--border)] transition self-end sm:self-auto"
                >
                  <RefreshCw size={13} className={cargandoHC ? 'animate-spin text-blue-600' : ''} />
                  <span>Refrescar Geclisa</span>
                </button>
              </div>

              {cargandoHC ? (
                <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <span>Consultando historia clínica en Geclisa...</span>
                </div>
              ) : errorHC ? (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span>Historia Clínica no disponible en Geclisa</span>
                  </div>
                  <p>{errorHC}</p>
                </div>
              ) : !datosHC || (datosHC.evoluciones_recientes || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--secondary)] border border-dashed rounded-2xl">
                  No se registraron evoluciones previas en la historia clínica.
                </div>
              ) : (
                <div className="space-y-3">
                  {(datosHC.evoluciones_recientes || [])
                    .filter((ev: any) =>
                      !filtroTextoHC ||
                      (ev.texto || '').toLowerCase().includes(filtroTextoHC.toLowerCase()) ||
                      (ev.prestador || '').toLowerCase().includes(filtroTextoHC.toLowerCase()) ||
                      (ev.especialidad || '').toLowerCase().includes(filtroTextoHC.toLowerCase())
                    )
                    .map((ev: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/40 space-y-2 hover:border-blue-500/50 transition-all shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold text-[11px]">
                              📅 {ev.fecha || 'Sin fecha'} {ev.hora ? `• ${ev.hora} hs` : ''}
                            </span>
                            <span className="font-bold text-[var(--foreground)]">
                              👨‍⚕️ {ev.prestador || 'Médico'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {ev.especialidad || ev.area || 'Consulta'}
                          </span>
                        </div>

                        {ev.nombre_plantilla && (
                          <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            📋 {ev.nombre_plantilla}
                          </p>
                        )}

                        <p className="text-xs text-[var(--foreground)] whitespace-pre-line leading-relaxed font-sans">
                          {ev.texto}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ==================================================================== */}
          {/* PESTAÑA 3: INDICACIONES MÉDICAS EN VIVO (GECLISA) */}
          {/* ==================================================================== */}
          {activeTab === 'indicaciones' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-72">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={filtroTextoInd}
                      onChange={(e) => setFiltroTextoInd(e.target.value)}
                      placeholder="Buscar indicaciones / medicamentos..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-xs outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={consultarIndicacionesMedicas}
                  disabled={cargandoInd}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 border border-[var(--border)] transition self-end sm:self-auto"
                >
                  <RefreshCw size={13} className={cargandoInd ? 'animate-spin text-blue-600' : ''} />
                  <span>Refrescar Geclisa</span>
                </button>
              </div>

              {cargandoInd ? (
                <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <span>Consultando indicaciones médicas en Geclisa...</span>
                </div>
              ) : errorInd ? (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span>Indicaciones no disponibles en Geclisa</span>
                  </div>
                  <p>{errorInd}</p>
                </div>
              ) : !datosInd || (datosInd.indicaciones || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--secondary)] border border-dashed rounded-2xl">
                  No se registran indicaciones médicas ni protocolos de medicación activos.
                </div>
              ) : (
                <div className="space-y-3">
                  {(datosInd.indicaciones || [])
                    .filter((ind: any) =>
                      !filtroTextoInd ||
                      (ind.titulo || '').toLowerCase().includes(filtroTextoInd.toLowerCase()) ||
                      (ind.texto || '').toLowerCase().includes(filtroTextoInd.toLowerCase()) ||
                      (ind.prestador || '').toLowerCase().includes(filtroTextoInd.toLowerCase())
                    )
                    .map((ind: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/40 space-y-2 hover:border-emerald-500/50 transition-all shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px]">
                              💊 {ind.fecha || 'Sin fecha'} {ind.hora ? `• ${ind.hora} hs` : ''}
                            </span>
                            <span className="font-bold text-[var(--foreground)]">
                              👨‍⚕️ {ind.prestador || 'Médico'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            {ind.tipo_label || 'Indicación'}
                          </span>
                        </div>

                        <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {ind.titulo}
                        </h5>

                        <p className="text-xs text-[var(--foreground)] whitespace-pre-line leading-relaxed font-sans">
                          {ind.texto}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
