'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  CalendarClock,
  CalendarX,
  Trash2,
  Calendar,
  Clock,
  User,
  Scissors,
  FileCheck2,
  Send,
  Loader2,
  Building2,
  AlertCircle,
  Eye,
  CreditCard,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  Link2,
  CheckCircle2,
  Search,
  Timer,
  Check,
  UserCheck,
  Syringe,
  FileText
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface FichaTurnoModalProps {
  turno?: any
  asesoriaIdInicial?: string
  pacienteIdInicial?: string
  casoConfirmadoInicial?: any
  quirofanos: any[]
  quirofanoDefectoId?: string
  fechaDefecto?: string
  horaDefecto?: string
  onClose: () => void
  onSaved: () => void
}

export default function FichaTurnoModal({
  turno,
  asesoriaIdInicial,
  pacienteIdInicial,
  casoConfirmadoInicial,
  quirofanos,
  quirofanoDefectoId,
  fechaDefecto,
  horaDefecto,
  onClose,
  onSaved
}: FichaTurnoModalProps) {
  const esEdicion = !!turno?.id

  // Casos confirmados desde Asesoramiento Quirúrgico
  const [casosConfirmados, setCasosConfirmados] = useState<any[]>([])
  const [cargandoCasos, setCargandoCasos] = useState(false)
  const [casoSeleccionadoId, setCasoSeleccionadoId] = useState<string>(
    turno?.asesoria_id || asesoriaIdInicial || ''
  )
  const [modoCarga, setModoCarga] = useState<'asesoria' | 'manual'>('asesoria')

  // Prestadores cargados desde Ajustes (Instrumentadores y Anestesistas)
  const [instrumentadores, setInstrumentadores] = useState<any[]>([])
  const [anestesistas, setAnestesistas] = useState<any[]>([])

  // Catálogo de Cirugías con duración
  const [catalogoPracticas, setCatalogoPracticas] = useState<{ id: string; nombre: string; minutos: number }[]>([
    { id: 'inyeccion', nombre: 'Inyección Intravítrea (Antiangiogénico)', minutos: 10 },
    { id: 'catarata_faco', nombre: 'Catarata con Facoemulsificación Estándar', minutos: 20 },
    { id: 'catarata_compleja', nombre: 'Catarata Compleja / Combinada', minutos: 30 },
    { id: 'vitrectomia', nombre: 'Vitrectomía Posterior / Retina', minutos: 60 },
    { id: 'lasik', nombre: 'Cirugía Refractiva LASIK / PRK', minutos: 15 }
  ])

  // Formulario de Turno Quirúrgico
  const [formData, setFormData] = useState({
    asesoria_id: turno?.asesoria_id || asesoriaIdInicial || '',
    paciente_id: turno?.paciente_id || pacienteIdInicial || '',
    paciente_nombre: turno?.pacientes?.nombre || '',
    paciente_dni: turno?.pacientes?.dni || '',
    paciente_telefono: turno?.pacientes?.telefono || '',
    quirofano_id: turno?.quirofano_id || quirofanoDefectoId || quirofanos[0]?.id || '',
    fecha_cirugia: turno?.fecha_cirugia || fechaDefecto || new Date().toISOString().slice(0, 10),
    hora_inicio: (turno?.hora_inicio || horaDefecto || '08:30').slice(0, 5),
    duracion_minutos: turno?.duracion_minutos || 20,
    ojo: turno?.ojo || 'OD',
    es_bilateral_escalonada: turno?.es_bilateral_escalonada || false,
    cirujano_id: turno?.cirujano_id || 1067,
    cirujano_nombre: turno?.cirujano_nombre || 'ABRAHAM, IRINA',
    medico_derivador_nombre: turno?.medico_derivador_nombre || turno?.asesorias_quirurgicas?.medico_derivador_nombre || '',
    instrumentador_nombre: turno?.instrumentador_nombre || '',
    anestesiologo_nombre: turno?.anestesiologo_nombre || '',
    practica_codigo: turno?.practica_codigo || '',
    practica_nombre: turno?.practica_nombre || turno?.asesorias_quirurgicas?.practica_nombre || '',
    obra_social: turno?.obra_social || '',
    plan_obra_social: turno?.plan_obra_social || '',
    lente_tipo: turno?.lente_tipo || '',
    lente_dioptria: turno?.lente_dioptria || '',
    lente_lote: turno?.lente_lote || '',
    tipo_anestesia: turno?.tipo_anestesia || 'Tópica + Sedación',
    observaciones: turno?.observaciones || '',
    estado: turno?.estado || 'programado'
  })

  const [guardando, setGuardando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [enviandoWA, setEnviandoWA] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Aplicar datos heredados desde la asesoría quirúrgica confirmada
  const aplicarCasoConfirmado = (caso: any) => {
    if (!caso) return
    const pac = caso.pacientes || {}

    let duracionSugerida = 20
    const practicaMatch = catalogoPracticas.find(
      (p) => p.nombre.toLowerCase().includes((caso.practica_nombre || '').toLowerCase()) ||
             (caso.practica_nombre || '').toLowerCase().includes(p.nombre.toLowerCase())
    )
    if (practicaMatch) {
      duracionSugerida = practicaMatch.minutos
    }

    setFormData((prev) => ({
      ...prev,
      asesoria_id: caso.id,
      paciente_id: caso.paciente_id || pac.id || '',
      paciente_nombre: pac.nombre || '',
      paciente_dni: pac.dni || '',
      paciente_telefono: pac.telefono || '',
      practica_nombre: caso.practica_nombre || prev.practica_nombre,
      practica_codigo: caso.practica_codigo || prev.practica_codigo,
      cirujano_nombre: caso.medico_cirujano_nombre || prev.cirujano_nombre,
      cirujano_id: caso.medico_cirujano_id || prev.cirujano_id,
      medico_derivador_nombre: caso.medico_derivador_nombre || prev.medico_derivador_nombre || '',
      obra_social: caso.cobertura_obra_social || pac.obra_social || '',
      plan_obra_social: pac.plan_obra_social || '',
      ojo: caso.ojo || prev.ojo || 'OD',
      duracion_minutos: duracionSugerida,
      fecha_cirugia: caso.fecha_definitiva_cirugia || caso.fecha_probable_cirugia || prev.fecha_cirugia
    }))

    setCasoSeleccionadoId(caso.id)
    setMensajeExito(`✓ Datos heredados de la asesoría de ${pac.nombre || 'Paciente'}`)
    setTimeout(() => setMensajeExito(null), 3000)
  }

  // Cargar prestadores, catálogo y casos confirmados
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargandoCasos(true)
        
        const [resCasos, resPipe, resPrestadores, resConf] = await Promise.all([
          fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/pendientes-quirofano`),
          fetch(`${BACKEND_URL}/api/pipeline-quirurgico`),
          fetch(`${BACKEND_URL}/api/prestadores?solo_activos=true`),
          fetch(`${BACKEND_URL}/api/configuracion-quirofano`)
        ])

        const dataCasos = await resCasos.json()
        const dataPipe = await resPipe.json()
        const dataPrestadores = await resPrestadores.json()
        const dataConf = await resConf.json()

        // Prestadores por rol
        if (dataPrestadores.success && dataPrestadores.prestadores) {
          const allPrestadores = dataPrestadores.prestadores
          setInstrumentadores(allPrestadores.filter((p: any) => p.rol === 'Instrumentador'))
          setAnestesistas(allPrestadores.filter((p: any) => p.rol === 'Anestesista'))
        }

        let listaCasos: any[] = []
        if (dataCasos.success && Array.isArray(dataCasos.casos) && dataCasos.casos.length > 0) {
          listaCasos = dataCasos.casos
        } else if (dataPipe.success && dataPipe.etapas?.confirmado) {
          listaCasos = dataPipe.etapas.confirmado
        }

        setCasosConfirmados(listaCasos)

        if (casoConfirmadoInicial) {
          aplicarCasoConfirmado(casoConfirmadoInicial)
        } else if (asesoriaIdInicial) {
          const match = listaCasos.find((c) => c.id === asesoriaIdInicial)
          if (match) aplicarCasoConfirmado(match)
        }

        if (dataConf.success && dataConf.configuracion?.duraciones_prestaciones) {
          const dur = dataConf.configuracion.duraciones_prestaciones
          if (Array.isArray(dur)) {
            setCatalogoPracticas(dur)
          } else {
            const items = Object.entries(dur).map(([k, v]) => ({
              id: k,
              nombre: k.replace(/_/g, ' ').toUpperCase(),
              minutos: Number(v) || 20
            }))
            if (items.length > 0) setCatalogoPracticas(items)
          }
        }
      } catch (err) {
        console.error('Error cargando datos iniciales:', err)
      } finally {
        setCargandoCasos(false)
      }
    }

    cargarDatos()
  }, [asesoriaIdInicial, casoConfirmadoInicial])

  // Calcular hora de fin estimada
  const calcularHoraFin = () => {
    if (!formData.hora_inicio) return ''
    const [h, m] = formData.hora_inicio.split(':').map(Number)
    const dur = Number(formData.duracion_minutos) || 20
    const totalMin = h * 60 + m + dur
    const hFin = Math.floor(totalMin / 60) % 24
    const mFin = totalMin % 60
    return `${hFin.toString().padStart(2, '0')}:${mFin.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.paciente_nombre.trim()) {
      setError('Debe especificar el paciente o seleccionar un caso confirmado.')
      return
    }

    try {
      setGuardando(true)
      setError(null)

      const payload = {
        ...formData,
        obra_social: formData.obra_social?.trim() || 'Particular',
        duracion_minutos: Number(formData.duracion_minutos) || 20,
        fecha_cirugia: formData.fecha_cirugia || fechaDefecto || new Date().toISOString().slice(0, 10),
        hora_inicio: (formData.hora_inicio || horaDefecto || '08:30').slice(0, 5)
      }

      const url = esEdicion
        ? `${BACKEND_URL}/api/turnos-quirofano/${turno.id}`
        : `${BACKEND_URL}/api/turnos-quirofano`
      const method = esEdicion ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Error al guardar el turno de quirófano')
      }

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('Error guardando turno:', err)
      setError(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const handleCancelarTurno = async () => {
    if (!turno?.id) return
    const confirmacion = confirm(
      '¿Está seguro de que desea cancelar este turno quirúrgico?\n\n' +
      '• El paciente saldrá del turnero de quirófano.\n' +
      '• El estado volverá automáticamente a "Caso Confirmado" en Asesoramiento Quirúrgico.\n' +
      '• Podrá volver a asignarle una nueva fecha y sala en cualquier momento.'
    )
    if (!confirmacion) return

    try {
      setCancelando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turno.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Error al cancelar el turno de quirófano')
      }
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('Error cancelando turno:', err)
      setError(err.message || 'Error al cancelar el turno')
    } finally {
      setCancelando(false)
    }
  }

  const handleEnviarConsentimientoWA = async () => {
    if (!turno?.id) return
    try {
      setEnviandoWA(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turno.id}/enviar-consentimiento-wa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Error enviando WhatsApp')
      }
      setMensajeExito('✔ Consentimiento enviado al WhatsApp del paciente.')
      onSaved()
      setTimeout(() => setMensajeExito(null), 3500)
    } catch (err: any) {
      setError(err.message || 'Error al enviar WhatsApp')
    } finally {
      setEnviandoWA(false)
    }
  }

  const casoSeleccionadoActual = casosConfirmados.find((c) => c.id === casoSeleccionadoId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="p-4 md:p-5 border-b border-[var(--border)] flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/20">
              <Scissors size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
                <span>{esEdicion ? 'Ficha de Turno Quirúrgico' : 'Programar Cirugía en Quirófano'}</span>
                {formData.asesoria_id && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300/40 flex items-center gap-1">
                    <Link2 size={10} /> Sincronizado con Asesoramiento
                  </span>
                )}
              </h3>
              <p className="text-xs text-[var(--secondary)]">
                Complete o edite los datos de sala, horario y equipo. Se mantendrán sincronizados con la ficha del paciente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notificaciones */}
        {error && (
          <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {mensajeExito && (
          <div className="m-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          
          {/* BANNER: SELECTOR DE CASOS CONFIRMADOS */}
          {!esEdicion && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border-2 border-blue-500/40 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                  <Sparkles size={16} className="text-blue-600 animate-pulse" />
                  <span>Casos Confirmados desde Asesoramiento Quirúrgico</span>
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-[var(--border)] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setModoCarga('asesoria')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      modoCarga === 'asesoria'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    ⚡ Seleccionar de Asesoría ({casosConfirmados.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoCarga('manual')
                      setCasoSeleccionadoId('')
                    }}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      modoCarga === 'manual'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    ✍ Carga Manual
                  </button>
                </div>
              </div>

              {modoCarga === 'asesoria' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--foreground)] block mb-1">
                      Seleccione el paciente confirmado a programar:
                    </label>
                    <select
                      value={casoSeleccionadoId}
                      onChange={(e) => {
                        const cid = e.target.value
                        setCasoSeleccionadoId(cid)
                        const match = casosConfirmados.find((c) => c.id === cid)
                        if (match) aplicarCasoConfirmado(match)
                      }}
                      className="w-full p-2.5 rounded-xl bg-[var(--card)] border-2 border-blue-500/50 text-xs font-bold text-blue-600 dark:text-blue-400 outline-none focus:border-blue-600 shadow-sm"
                    >
                      <option value="">-- Seleccionar de la lista ({casosConfirmados.length} cirugías confirmadas) --</option>
                      {casosConfirmados.map((c) => {
                        const pac = c.pacientes || {}
                        return (
                          <option key={c.id} value={c.id}>
                            {pac.nombre || 'Paciente'} (DNI: {pac.dni || 'S/D'}) — {c.practica_nombre} — Cirujano: {c.medico_cirujano_nombre || 'Sin cirujano'}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {casoSeleccionadoActual && (
                    <div className="p-3 rounded-xl bg-blue-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/20">
                          <UserCheck size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-xs">
                            {casoSeleccionadoActual.pacientes?.nombre || 'Paciente'}
                          </p>
                          <p className="text-[11px] text-white/80">
                            DNI: {casoSeleccionadoActual.pacientes?.dni || 'S/D'} • Tel: {casoSeleccionadoActual.pacientes?.telefono || 'S/D'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-white/90">
                        <p className="font-semibold">{casoSeleccionadoActual.practica_nombre}</p>
                        <p className="text-white/80">Derivador: {casoSeleccionadoActual.medico_derivador_nombre || 'S/D'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BANNER DINÁMICO DE FRANJA HORARIA */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-blue-600 shrink-0" />
              <span className="font-bold text-[var(--foreground)]">
                Horario Quirúrgico Asignado:{' '}
                <span className="font-mono text-blue-600 font-extrabold text-sm">
                  {formData.hora_inicio} hs ➔ {calcularHoraFin()} hs
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 font-semibold text-[var(--secondary)]">
              <Timer size={14} className="text-purple-500" />
              <span>Duración: <b className="text-purple-600 dark:text-purple-400 font-mono">{formData.duracion_minutos} min</b></span>
            </div>
          </div>

          {/* SECCIÓN 1: DATOS DEL PACIENTE, COBERTURA Y PRÁCTICA */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <User size={15} />
              <span>1. Identificación del Paciente, Cobertura & Práctica Indicada</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Nombre del Paciente *</label>
                <input
                  type="text"
                  value={formData.paciente_nombre}
                  onChange={(e) => setFormData({ ...formData, paciente_nombre: e.target.value })}
                  placeholder="Ej: Pérez, Juan Carlos"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">DNI / Documento</label>
                <input
                  type="text"
                  value={formData.paciente_dni}
                  onChange={(e) => setFormData({ ...formData, paciente_dni: e.target.value })}
                  placeholder="Ej: 30123456"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Teléfono WhatsApp</label>
                <input
                  type="text"
                  value={formData.paciente_telefono}
                  onChange={(e) => setFormData({ ...formData, paciente_telefono: e.target.value })}
                  placeholder="Ej: +5491123456789"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Financiador / Obra Social</label>
                <input
                  type="text"
                  value={formData.obra_social}
                  onChange={(e) => setFormData({ ...formData, obra_social: e.target.value })}
                  placeholder="Ej: OSDE, Swiss Medical, Particular..."
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Plan / Afiliado</label>
                <input
                  type="text"
                  value={formData.plan_obra_social}
                  onChange={(e) => setFormData({ ...formData, plan_obra_social: e.target.value })}
                  placeholder="Ej: 210, Premium"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                />
              </div>

              {/* CAMPO DESTACADO: PRÁCTICA CARGADA EN ASESORAMIENTO */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)] flex items-center gap-1">
                  <FileText size={12} className="text-blue-500" /> Práctica en Asesoramiento Quirúrgico:
                </label>
                <input
                  type="text"
                  value={formData.practica_nombre}
                  onChange={(e) => setFormData({ ...formData, practica_nombre: e.target.value })}
                  placeholder="Ej: Catarata con Facoemulsificación..."
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: ASIGNACIÓN DE SALA, FECHA Y DURACIÓN */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={15} />
              <span>2. Sala de Quirófano, Horario & Duración</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Quirófano / Sala *</label>
                <select
                  value={formData.quirofano_id}
                  onChange={(e) => setFormData({ ...formData, quirofano_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                  required
                >
                  {quirofanos.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nombre} ({q.codigo}) - {q.duracion_slot_minutos || 15}m
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
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-mono font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Hora de Inicio *</label>
                <input
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-mono font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Duración en Minutos *</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={formData.duracion_minutos}
                  onChange={(e) => setFormData({ ...formData, duracion_minutos: parseInt(e.target.value) || 20 })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-blue-600 font-bold font-mono outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: EQUIPO MÉDICO (CIRUJANO, DERIVADOR, INSTRUMENTADOR Y ANESTESISTA) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope size={15} />
              <span>3. Equipo Quirúrgico, Prestadores, Lateralidad & LIO</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Cirujano Principal *</label>
                <input
                  type="text"
                  value={formData.cirujano_nombre}
                  onChange={(e) => setFormData({ ...formData, cirujano_nombre: e.target.value })}
                  placeholder="Ej: ABRAHAM, IRINA"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* MÉDICO DERIVADOR (TRAÍDO DE ASESORAMIENTO) */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Médico Derivador (Asesoramiento)</label>
                <input
                  type="text"
                  value={formData.medico_derivador_nombre}
                  onChange={(e) => setFormData({ ...formData, medico_derivador_nombre: e.target.value })}
                  placeholder="Ej: ABRAHAM, IRINA"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* INSTRUMENTADOR (DESPLEGABLE DE PRESTADORES) */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)] flex items-center gap-1">
                  <Scissors size={12} className="text-purple-500" /> Instrumentador *
                </label>
                <select
                  value={formData.instrumentador_nombre}
                  onChange={(e) => setFormData({ ...formData, instrumentador_nombre: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                >
                  <option value="">-- Seleccionar Instrumentador --</option>
                  {instrumentadores.map((inst) => (
                    <option key={inst.id || inst.matricula} value={inst.nombre_apellido}>
                      {inst.nombre_apellido} {inst.matricula ? `(Mat. ${inst.matricula})` : ''}
                    </option>
                  ))}
                  {formData.instrumentador_nombre && !instrumentadores.some((i) => i.nombre_apellido === formData.instrumentador_nombre) && (
                    <option value={formData.instrumentador_nombre}>{formData.instrumentador_nombre}</option>
                  )}
                </select>
              </div>

              {/* ANESTESISTA (DESPLEGABLE DE PRESTADORES) */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)] flex items-center gap-1">
                  <Syringe size={12} className="text-teal-500" /> Médico Anestesiólogo *
                </label>
                <select
                  value={formData.anestesiologo_nombre}
                  onChange={(e) => setFormData({ ...formData, anestesiologo_nombre: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                >
                  <option value="">-- Seleccionar Anestesista --</option>
                  {anestesistas.map((an) => (
                    <option key={an.id || an.matricula} value={an.nombre_apellido}>
                      {an.nombre_apellido} {an.matricula ? `(Mat. ${an.matricula})` : ''}
                    </option>
                  ))}
                  {formData.anestesiologo_nombre && !anestesistas.some((a) => a.nombre_apellido === formData.anestesiologo_nombre) && (
                    <option value={formData.anestesiologo_nombre}>{formData.anestesiologo_nombre}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Ojo a Intervenir *</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { id: 'OD', label: 'Ojo Derecho' },
                    { id: 'OI', label: 'Ojo Izquierdo' },
                    { id: 'AO', label: 'Ambos Ojos' }
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, ojo: o.id })}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        formData.ojo === o.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow'
                          : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] border-transparent hover:bg-slate-200'
                      }`}
                    >
                      {o.id}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Tipo de Anestesia</label>
                <select
                  value={formData.tipo_anestesia}
                  onChange={(e) => setFormData({ ...formData, tipo_anestesia: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-medium"
                >
                  <option value="Tópica + Sedación">Tópica + Sedación (Catarata / Inyección)</option>
                  <option value="Peribulbar / Retrobulbar">Peribulbar / Retrobulbar (Retina / Compleja)</option>
                  <option value="General">General</option>
                  <option value="Local Pura">Local Pura</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Lente Intraocular / Dioptría / Lote</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={formData.lente_tipo}
                    onChange={(e) => setFormData({ ...formData, lente_tipo: e.target.value })}
                    placeholder="Modelo (ej: SN60WF)"
                    className="w-1/2 px-2.5 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={formData.lente_dioptria}
                    onChange={(e) => setFormData({ ...formData, lente_dioptria: e.target.value })}
                    placeholder="Diop"
                    className="w-1/4 px-2 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono text-center"
                  />
                  <input
                    type="text"
                    value={formData.lente_lote}
                    onChange={(e) => setFormData({ ...formData, lente_lote: e.target.value })}
                    placeholder="Lote"
                    className="w-1/4 px-2 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono text-center"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* OBSERVACIONES */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--secondary)]">Observaciones y Notas Quirúrgicas</label>
            <textarea
              rows={2}
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Instrucciones de instrumental, insumos especiales o comentarios del cirujano..."
              className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
            />
          </div>
        </form>

        {/* Pie del Modal con Acciones */}
        <div className="p-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center gap-2">
            {esEdicion && (
              <>
                {/* Botón Cancelar Turno (Devuelve a Confirmado en Asesoramiento) */}
                <button
                  type="button"
                  onClick={handleCancelarTurno}
                  disabled={cancelando || guardando}
                  className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Eliminar este turno y devolver el caso a 'Confirmado' en Asesoramiento Quirúrgico"
                >
                  {cancelando ? <Loader2 size={14} className="animate-spin" /> : <CalendarX size={14} />}
                  <span>Cancelar Turno</span>
                </button>

                {/* Botón Enviar Consentimiento */}
                <button
                  type="button"
                  onClick={handleEnviarConsentimientoWA}
                  disabled={enviandoWA || !formData.paciente_telefono || cancelando}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                >
                  {enviandoWA ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Enviar Consentimiento WA</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando || cancelando}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={guardando || cancelando}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
            >
              {guardando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : esEdicion ? (
                <CalendarClock size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              <span>
                {esEdicion
                  ? 'Reprogramar / Guardar Cambios'
                  : 'Guardar y Agendar Turno'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
