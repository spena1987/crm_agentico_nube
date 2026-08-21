'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Save,
  Loader2,
  Calendar,
  Clock,
  User,
  Shield,
  FileText,
  Eye,
  Activity,
  MessageSquare,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Send,
  Printer,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  Timer
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface FichaTurnoModalProps {
  isOpen: boolean
  onClose: () => void
  turnoId?: string | null
  initialData?: any
  quirofanos: any[]
  duracionesConfig: Record<string, number>
  onSaved: () => void
}

const PRACTICAS_PREDEFINIDAS = [
  { nombre: 'Catarata con Facoemulsificación', codigo: '34031', key: 'catarata_faco', defMin: 20 },
  { nombre: 'Catarata Compleja / Combinada', codigo: '34032', key: 'catarata_compleja', defMin: 30 },
  { nombre: 'Inyección Intravítrea (Antiangiogénico)', codigo: '34025', key: 'inyeccion', defMin: 10 },
  { nombre: 'Vitrectomía Posterior / Retina', codigo: '34045', key: 'vitrectomia', defMin: 60 },
  { nombre: 'Cirugía Refractiva LASIK / PRK', codigo: '34015', key: 'lasik', defMin: 15 },
  { nombre: 'Glaucoma Trabeculectomía / Válvula', codigo: '34050', key: 'catarata_compleja', defMin: 30 },
  { nombre: 'Pterigión con Autoinjerto', codigo: '34010', key: 'catarata_faco', defMin: 20 }
]

export default function FichaTurnoModal({
  isOpen,
  onClose,
  turnoId,
  initialData,
  quirofanos,
  duracionesConfig,
  onSaved
}: FichaTurnoModalProps) {
  const [formData, setFormData] = useState<any>({
    paciente_id: '',
    asesoria_id: null,
    quirofano_id: '',
    fecha_cirugia: new Date().toISOString().split('T')[0],
    hora_inicio: '09:00',
    duracion_minutos: 20,
    ojo: 'OD',
    es_bilateral_escalonada: false,
    fecha_segundo_ojo: '',
    hora_segundo_ojo: '09:00',
    cirujano_id: 6162,
    cirujano_nombre: 'Dr. Bonanno, Pablo Antonio',
    ayudante_nombre: '',
    anestesiologo_nombre: '',
    medico_derivador_nombre: '',
    practica_codigo: '34031',
    practica_nombre: 'Catarata con Facoemulsificación',
    codigo_obra_social: '020167',
    obra_social: 'OSDE',
    plan_obra_social: 'OBLIGATORIO',
    token_autorizacion: '',
    lente_tipo: 'Monofocal OS',
    lente_dioptria: '+21.50',
    lente_lote: '',
    tipo_anestesia: 'Local Asistida',
    checks_adicionales: {
      ficha_prequirurgica: true,
      monitoreo: true,
      tratamiento_dolor: false,
      biopsia: false,
      arco_en_c: false,
      uti: false
    },
    estado: 'programado',
    observaciones: ''
  })

  const [pacienteInfo, setPacienteInfo] = useState<any>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [enviandoWA, setEnviandoWA] = useState(false)
  const [mensajeWA, setMensajeWA] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Búsqueda rápida de pacientes
  const [busquedaPac, setBusquedaPac] = useState('')
  const [pacientesResultados, setPacientesResultados] = useState<any[]>([])
  const [buscandoPac, setBuscandoPac] = useState(false)

  // Calcular Hora Fin Estimada
  const calcularHoraFin = (inicio: string, minutos: number) => {
    if (!inicio) return ''
    const [hh, mm] = inicio.split(':').map(Number)
    const fecha = new Date()
    fecha.setHours(hh, mm + minutos, 0, 0)
    const hStr = fecha.getHours().toString().padStart(2, '0')
    const mStr = fecha.getMinutes().toString().padStart(2, '0')
    return `${hStr}:${mStr}`
  }

  const horaFinEstimada = calcularHoraFin(formData.hora_inicio || '09:00', formData.duracion_minutos || 20)

  useEffect(() => {
    if (!isOpen) return

    if (turnoId) {
      const fetchTurno = async () => {
        try {
          setCargando(true)
          const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano`)
          const data = await res.json()
          if (data.success && data.turnos) {
            const encontrado = data.turnos.find((t: any) => t.id === turnoId)
            if (encontrado) {
              setFormData(encontrado)
              setPacienteInfo(encontrado.pacientes || null)
            }
          }
        } catch (e) {
          console.error(e)
        } finally {
          setCargando(false)
        }
      }
      fetchTurno()
    } else if (initialData) {
      setFormData((prev: any) => ({
        ...prev,
        ...initialData,
        quirofano_id: initialData.quirofano_id || (quirofanos[0]?.id || '')
      }))
      if (initialData.pacientes) {
        setPacienteInfo(initialData.pacientes)
      } else if (initialData.paciente_id) {
        fetch(`${BACKEND_URL}/api/pacientes/${initialData.paciente_id}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.paciente) {
              setPacienteInfo(d.paciente)
              setFormData((prev: any) => ({
                ...prev,
                obra_social: d.paciente.obra_social || prev.obra_social,
                plan_obra_social: d.paciente.plan_cobertura || prev.plan_obra_social
              }))
            }
          })
          .catch((e) => console.error(e))
      }
    } else if (quirofanos.length > 0) {
      setFormData((prev: any) => ({
        ...prev,
        quirofano_id: prev.quirofano_id || quirofanos[0].id
      }))
    }
  }, [isOpen, turnoId, initialData, quirofanos])

  // Búsqueda dinámica de paciente
  useEffect(() => {
    if (!busquedaPac || busquedaPac.length < 2 || turnoId) {
      setPacientesResultados([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        setBuscandoPac(true)
        const res = await fetch(`${BACKEND_URL}/api/pacientes?q=${encodeURIComponent(busquedaPac)}`)
        const data = await res.json()
        if (data.success && data.pacientes) {
          setPacientesResultados(data.pacientes)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setBuscandoPac(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaPac, turnoId])

  const handleSelectPaciente = (p: any) => {
    setPacienteInfo(p)
    setFormData((prev: any) => ({
      ...prev,
      paciente_id: p.id,
      obra_social: p.obra_social || prev.obra_social,
      plan_obra_social: p.plan_cobertura || prev.plan_obra_social
    }))
    setPacientesResultados([])
    setBusquedaPac('')
  }

  // Cambio de práctica predefinida: ajusta automáticamente la duración
  const handleSeleccionarPracticaPredefinida = (nombre: string) => {
    const encontrada = PRACTICAS_PREDEFINIDAS.find((p) => p.nombre === nombre)
    if (encontrada) {
      const dur = duracionesConfig[encontrada.key] || encontrada.defMin
      setFormData((prev: any) => ({
        ...prev,
        practica_nombre: encontrada.nombre,
        practica_codigo: encontrada.codigo,
        duracion_minutos: dur
      }))
    } else {
      setFormData((prev: any) => ({ ...prev, practica_nombre: nombre }))
    }
  }

  // Guardar Turno
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.paciente_id) {
      setError('Debe seleccionar un paciente.')
      return
    }
    if (!formData.quirofano_id) {
      setError('Debe asignar una sala de quirófano.')
      return
    }

    try {
      setGuardando(true)
      setError(null)

      const url = turnoId ? `${BACKEND_URL}/api/turnos-quirofano/${turnoId}` : `${BACKEND_URL}/api/turnos-quirofano`
      const method = turnoId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Error al guardar turno de quirófano.')
      }

      if (!turnoId && formData.es_bilateral_escalonada && formData.fecha_segundo_ojo) {
        const ojo2 = formData.ojo === 'OD' ? 'OI' : 'OD'
        const payloadOjo2 = {
          ...formData,
          ojo: ojo2,
          fecha_cirugia: formData.fecha_segundo_ojo,
          hora_inicio: formData.hora_segundo_ojo || formData.hora_inicio,
          es_bilateral_escalonada: true,
          turno_par_id: data.turno?.id,
          observaciones: `2° Ojo (${ojo2}) - Vinculado a turno 1° Ojo.`
        }
        await fetch(`${BACKEND_URL}/api/turnos-quirofano`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadOjo2)
        })
      }

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al guardar turno')
    } finally {
      setGuardando(false)
    }
  }

  // Disparo de Consentimiento por WhatsApp
  const handleEnviarConsentimientoWA = async () => {
    if (!formData.id && !turnoId) {
      setError('Primero guarde el turno antes de enviar el consentimiento.')
      return
    }
    const idTarget = formData.id || turnoId

    try {
      setEnviandoWA(true)
      setMensajeWA(null)
      setError(null)

      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${idTarget}/enviar-consentimiento-wa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'No se pudo enviar el consentimiento por WhatsApp.')
      }

      setMensajeWA('✔ Mensaje de WhatsApp enviado con éxito al paciente con el enlace seguro.')
      setFormData((prev: any) => ({ ...prev, consentimiento_estado: 'enviado_whatsapp' }))
      setTimeout(() => setMensajeWA(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Error enviando WhatsApp')
    } finally {
      setEnviandoWA(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--card)] w-full max-w-4xl max-h-[92vh] rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl border border-blue-600/20">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">
                {turnoId ? 'Ficha de Turno Quirúrgico' : 'Nueva Programación de Quirófano'}
              </h2>
              <p className="text-xs text-[var(--secondary)]">
                Gestión integral de datos de cirugía, ocupación de tiempo, equipo y consentimiento.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleGuardar} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {mensajeWA && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{mensajeWA}</span>
            </div>
          )}

          {/* SECCIÓN 1: PACIENTE & COBERTURA */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} /> 1. Paciente & Cobertura Médica
              </span>
              {pacienteInfo && (
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  HC: {pacienteInfo.nro_hc || 'N/D'} | DNI: {pacienteInfo.dni || 'S/D'}
                </span>
              )}
            </div>

            {!pacienteInfo ? (
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={busquedaPac}
                      onChange={(e) => setBusquedaPac(e.target.value)}
                      placeholder="Buscar paciente por Nombre, DNI o N° de Historia Clínica..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {pacientesResultados.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {pacientesResultados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPaciente(p)}
                        className="w-full p-2.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between border-b border-[var(--border)] last:border-0"
                      >
                        <div>
                          <p className="font-bold text-[var(--foreground)]">{p.nombre}</p>
                          <p className="text-[10px] text-[var(--secondary)]">
                            DNI: {p.dni || '-'} | Tel: {p.telefono}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-600">{p.obra_social || 'Particular'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[var(--card)] p-3 rounded-xl border border-[var(--border)]">
                <div>
                  <p className="text-[10px] text-[var(--secondary)] font-semibold">Nombre Completo</p>
                  <p className="text-xs font-bold text-[var(--foreground)] truncate">{pacienteInfo.nombre}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--secondary)] font-semibold">Teléfono / WhatsApp</p>
                  <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {pacienteInfo.telefono}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--secondary)] font-semibold">Obra Social / Financiador</p>
                  <input
                    type="text"
                    value={formData.obra_social}
                    onChange={(e) => setFormData({ ...formData, obra_social: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-xs font-bold"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-[var(--secondary)] font-semibold">Token / N° Autorización</p>
                  <input
                    type="text"
                    value={formData.token_autorizacion || ''}
                    onChange={(e) => setFormData({ ...formData, token_autorizacion: e.target.value })}
                    placeholder="Ej: 849201"
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: HORARIO, OCUPACIÓN & LATERALIDAD */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-[var(--border)] space-y-3">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} /> 2. Horario, Ocupación de Quirófano & Lateralidad
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Sala de Quirófano *</label>
                <select
                  value={formData.quirofano_id}
                  onChange={(e) => setFormData({ ...formData, quirofano_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                  required
                >
                  {quirofanos.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nombre} ({q.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Fecha de Cirugía *</label>
                <input
                  type="date"
                  value={formData.fecha_cirugia}
                  onChange={(e) => setFormData({ ...formData, fecha_cirugia: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Hora de Inicio</label>
                <input
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground)]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Duración de la Práctica</label>
                <select
                  value={formData.duracion_minutos}
                  onChange={(e) => setFormData({ ...formData, duracion_minutos: parseInt(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                >
                  <option value={10}>10 min (Inyección / Láser)</option>
                  <option value={15}>15 min (LASIK / Refractiva)</option>
                  <option value={20}>20 min (Catarata Estándar)</option>
                  <option value={30}>30 min (Catarata Compleja)</option>
                  <option value={45}>45 min (Cirugía Combinada)</option>
                  <option value={60}>60 min (Vitrectomía / Retina)</option>
                </select>
              </div>
            </div>

            {/* Banner Dinámico de Franja Horaria Ocupada */}
            <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Timer size={16} className="text-blue-600 shrink-0" />
                <span className="font-semibold text-blue-950 dark:text-blue-200">
                  Franja ocupada en quirófano:
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-600 text-white text-xs">
                  {formData.hora_inicio} - {horaFinEstimada} hs
                </span>
              </div>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                {formData.duracion_minutos} minutos continuos
              </span>
            </div>

            {/* Selector de Lateralidad / Ojo */}
            <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--foreground)] block mb-1">
                  Ojo a Intervenir (Lateralidad) *
                </label>
                <div className="inline-flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1 gap-1">
                  {[
                    { id: 'OD', label: 'Ojo Derecho (OD)' },
                    { id: 'OI', label: 'Ojo Izquierdo (OI)' },
                    { id: 'AO', label: 'Ambos Ojos (AO)' }
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, ojo: o.id })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formData.ojo === o.id
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cirugía Bilateral Escalonada Toggle */}
              {!turnoId && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={formData.es_bilateral_escalonada}
                      onChange={(e) => setFormData({ ...formData, es_bilateral_escalonada: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>¿Programar 2° Ojo Escalonado?</span>
                  </label>
                  {formData.es_bilateral_escalonada && (
                    <input
                      type="date"
                      value={formData.fecha_segundo_ojo}
                      onChange={(e) => setFormData({ ...formData, fecha_segundo_ojo: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
                      placeholder="Fecha 2° ojo"
                      required
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 3: PROCEDIMIENTO, EQUIPO & LENTE (LIO) */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-[var(--border)] space-y-3">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <Eye size={14} /> 3. Procedimiento, Equipo Quirúrgico & Lente (LIO)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Práctica Nomenclador *</label>
                <input
                  type="text"
                  list="practicas-sugeridas"
                  value={formData.practica_nombre}
                  onChange={(e) => handleSeleccionarPracticaPredefinida(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
                  required
                />
                <datalist id="practicas-sugeridas">
                  {PRACTICAS_PREDEFINIDAS.map((p) => (
                    <option key={p.codigo} value={p.nombre}>
                      {p.codigo} ({p.defMin} min)
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Código Nomenclador</label>
                <input
                  type="text"
                  value={formData.practica_codigo}
                  onChange={(e) => setFormData({ ...formData, practica_codigo: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Código Obra Social</label>
                <input
                  type="text"
                  value={formData.codigo_obra_social}
                  onChange={(e) => setFormData({ ...formData, codigo_obra_social: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Cirujano Principal *</label>
                <input
                  type="text"
                  value={formData.cirujano_nombre}
                  onChange={(e) => setFormData({ ...formData, cirujano_nombre: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-blue-600"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">1° Ayudante</label>
                <input
                  type="text"
                  value={formData.ayudante_nombre || ''}
                  onChange={(e) => setFormData({ ...formData, ayudante_nombre: e.target.value })}
                  placeholder="Médico ayudante..."
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Tipo de Anestesia</label>
                <select
                  value={formData.tipo_anestesia}
                  onChange={(e) => setFormData({ ...formData, tipo_anestesia: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
                >
                  <option value="Local Asistida">Local Asistida</option>
                  <option value="Tópica">Tópica</option>
                  <option value="Sedación">Sedación</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            {/* Insumo LIO */}
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-blue-900 dark:text-blue-200">Tipo de Lente (LIO)</label>
                <select
                  value={formData.lente_tipo || 'Monofocal OS'}
                  onChange={(e) => setFormData({ ...formData, lente_tipo: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold"
                >
                  <option value="Monofocal OS">Monofocal de Obra Social</option>
                  <option value="Monofocal Premium">Monofocal Premium Asférica</option>
                  <option value="Tórica">Tórica (Astigmatismo)</option>
                  <option value="Multifocal">Multifocal / Trifocal</option>
                  <option value="EDOF">EDOF (Rango Extendido)</option>
                  <option value="No aplica">No aplica (Inyección / Vitrec)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-blue-900 dark:text-blue-200">Dioptría / Poder Calculado</label>
                <input
                  type="text"
                  value={formData.lente_dioptria || ''}
                  onChange={(e) => setFormData({ ...formData, lente_dioptria: e.target.value })}
                  placeholder="Ej: +21.50 D"
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-blue-900 dark:text-blue-200">N° Lote / Serie LIO</label>
                <input
                  type="text"
                  value={formData.lente_lote || ''}
                  onChange={(e) => setFormData({ ...formData, lente_lote: e.target.value })}
                  placeholder="Ej: LOT-994821"
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: CONSENTIMIENTO INFORMADO POR WHATSAPP */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck2 size={14} /> 4. Consentimiento Informado & Firma Digital
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  formData.consentimiento_estado === 'firmado_digital'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    : formData.consentimiento_estado === 'enviado_whatsapp'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                }`}
              >
                {formData.consentimiento_estado === 'firmado_digital'
                  ? '🟢 Firmado Digitalmente'
                  : formData.consentimiento_estado === 'enviado_whatsapp'
                  ? '🟡 Enviado por WhatsApp (Esperando firma)'
                  : '⚪ Pendiente de Envío'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleEnviarConsentimientoWA}
                disabled={enviandoWA}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all disabled:opacity-50"
              >
                {enviandoWA ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                <span>Enviar Consentimiento por WhatsApp</span>
              </button>

              {formData.consentimiento_token && (
                <a
                  href={`/consentimiento/${formData.consentimiento_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-all"
                >
                  <ExternalLink size={14} />
                  <span>Probar Enlace Móvil Paciente</span>
                </a>
              )}

              {formData.consentimiento_pdf_url && (
                <a
                  href={`${BACKEND_URL}${formData.consentimiento_pdf_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-200 transition-all"
                >
                  <FileText size={14} />
                  <span>Ver PDF Firmado</span>
                </a>
              )}
            </div>
          </div>

          {/* SECCIÓN 5: OBSERVACIONES */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--secondary)]">Observaciones y Notas de Quirófano</label>
            <textarea
              rows={2}
              value={formData.observaciones || ''}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Notas quirúrgicas, derivador, instrucciones de ayuno..."
              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all disabled:opacity-50"
            >
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{turnoId ? 'Actualizar Programación' : 'Confirmar Turno en Quirófano'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
