'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Download,
  FileCheck,
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
  FileText,
  Plus,
  ExternalLink,
  Save
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

  // Catálogo de Modelos de LIO cargados desde Ajustes
  const [modelosLio, setModelosLio] = useState<any[]>([])
  // Modal flotante para Administrar Modelos de LIO sin salir de la ficha
  const [mostrarModalConfigLio, setMostrarModalConfigLio] = useState(false)
  const [nuevoModeloLio, setNuevoModeloLio] = useState({
    marca: '',
    modelo: '',
    tipo_optica: 'Monofocal Asférico',
    descripcion: ''
  })
  const [guardandoNuevoLio, setGuardandoNuevoLio] = useState(false)

  const handleCrearModeloLioRapido = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoModeloLio.marca.trim() || !nuevoModeloLio.modelo.trim()) {
      setError('Marca y modelo de LIO son obligatorios.')
      return
    }
    try {
      setGuardandoNuevoLio(true)
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevoModeloLio, activo: true })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const itemCreado = data.modelo
        setModelosLio((prev) => [itemCreado, ...prev])
        setFormData((prev) => ({ ...prev, lente_tipo: `${itemCreado.modelo} (${itemCreado.marca})` }))
        setNuevoModeloLio({ marca: '', modelo: '', tipo_optica: 'Monofocal Asférico', descripcion: '' })
        setMostrarModalConfigLio(false)
      } else {
        throw new Error(data.detail || 'Error al guardar modelo de LIO')
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrar modelo')
    } finally {
      setGuardandoNuevoLio(false)
    }
  }


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
    lleva_lente: turno?.lleva_lente ?? (
      (turno?.practica_nombre || '').toLowerCase().includes('catarata') ||
      (turno?.practica_nombre || '').toLowerCase().includes('faco') ||
      (turno?.practica_nombre || '').toLowerCase().includes('lio') ||
      false
    ),
    lente_tipo: turno?.lente_tipo || 'AcrySof IQ SN60WF (Alcon)',
    lente_dioptria: turno?.lente_dioptria !== undefined && turno?.lente_dioptria !== null ? turno.lente_dioptria : '+21.50',
    es_torico: turno?.es_torico ?? false,
    lente_torico_valor: turno?.lente_torico_valor !== undefined && turno?.lente_torico_valor !== null ? turno.lente_torico_valor : 0,
    lente_torico_eje: turno?.lente_torico_eje !== undefined && turno?.lente_torico_eje !== null ? turno.lente_torico_eje : 90,
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

    const nomPractica = (caso.practica_nombre || '').toLowerCase()
    const requiereLio = nomPractica.includes('catarata') || nomPractica.includes('faco') || nomPractica.includes('lio')

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
      lleva_lente: requiereLio,
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
        
        const [resCasos, resPipe, resPrestadores, resLio, resConf] = await Promise.all([
          fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/pendientes-quirofano`),
          fetch(`${BACKEND_URL}/api/pipeline-quirurgico`),
          fetch(`${BACKEND_URL}/api/prestadores?solo_activos=true`),
          fetch(`${BACKEND_URL}/api/modelos-lio?solo_activos=true`),
          fetch(`${BACKEND_URL}/api/configuracion-quirofano`)
        ])

        const dataCasos = await resCasos.json()
        const dataPipe = await resPipe.json()
        const dataPrestadores = await resPrestadores.json()
        const dataLio = await resLio.json()
        const dataConf = await resConf.json()

        // Prestadores por rol
        if (dataLio.success && dataLio.modelos) {
          setModelosLio(dataLio.modelos)
        }
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

    if (!esDiaOperativo(formData.fecha_cirugia, quirofanoActual)) {
      setError(`La sala seleccionada (${quirofanoActual?.nombre}) no se encuentra operativa los ${diaSeleccionadoNombre}s. Por favor elija un día habilitado.`)
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
        hora_inicio: (formData.hora_inicio || horaDefecto || '08:30').slice(0, 5),
        lleva_lente: !!formData.lleva_lente,
        es_torico: !!formData.es_torico,
        lente_torico_valor: formData.es_torico ? Number(formData.lente_torico_valor) || 0 : null,
        lente_torico_eje: formData.es_torico ? Number(formData.lente_torico_eje) || 0 : null,
        lente_dioptria: formData.lleva_lente ? formData.lente_dioptria : null,
        lente_tipo: formData.lleva_lente ? formData.lente_tipo : null
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

  // Quirófano actual seleccionado
  const quirofanoActual = quirofanos.find((q) => q.id === formData.quirofano_id) || quirofanos[0]

  // Generar slots de horario discretos configurados para la sala seleccionada
  const generarSlotsHorarios = (q: any) => {
    if (!q) return []
    const horaIni = q.hora_inicio || '08:00'
    const horaFin = q.hora_fin || '19:00'
    const slotMin = Number(q.duracion_slot_minutos) || 15

    const [hI, mI] = horaIni.split(':').map(Number)
    const [hF, mF] = horaFin.split(':').map(Number)

    const startMin = hI * 60 + mI
    const endMin = hF * 60 + mF

    const slots: string[] = []
    for (let m = startMin; m < endMin; m += slotMin) {
      const h = Math.floor(m / 60)
      const min = m % 60
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
    }
    return slots
  }

  const slotsDisponibles = generarSlotsHorarios(quirofanoActual)

  // Nombres y validación de días operativos (1=Lun .. 7=Dom)
  const nombresDiasMap: Record<number, string> = {
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
  }

  const getDiaSemanaNumero = (fechaStr: string) => {
    if (!fechaStr) return 1
    const d = new Date(fechaStr + 'T12:00:00')
    const dow = d.getDay()
    return dow === 0 ? 7 : dow
  }

  const esDiaOperativo = (fechaStr: string, q: any) => {
    if (!fechaStr || !q) return true
    const diasOp: number[] = q.dias_operativos || [1, 2, 3, 4, 5]
    const numDia = getDiaSemanaNumero(fechaStr)
    return diasOp.includes(numDia)
  }

  const fechaEsValida = esDiaOperativo(formData.fecha_cirugia, quirofanoActual)
  const diaSeleccionadoNombre = nombresDiasMap[getDiaSemanaNumero(formData.fecha_cirugia)]

  // Función para mover al próximo día operativo
  const moverAProximoDiaOperativo = () => {
    if (!formData.fecha_cirugia) return
    let d = new Date(formData.fecha_cirugia + 'T12:00:00')
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() + 1)
      const iso = d.toISOString().slice(0, 10)
      if (esDiaOperativo(iso, quirofanoActual)) {
        setFormData({ ...formData, fecha_cirugia: iso })
        break
      }
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

          {/* SECCIÓN ESTADO DE CONSENTIMIENTO INFORMADO */}
          {esEdicion && turno && (
            <div className={`p-4 rounded-2xl border transition-all space-y-2 shadow-sm ${
              turno.consentimiento_estado === 'firmado_digital'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : turno.consentimiento_estado === 'enviado_whatsapp'
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-slate-500/10 border-slate-500/20'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    turno.consentimiento_estado === 'firmado_digital'
                      ? 'bg-emerald-600 text-white'
                      : turno.consentimiento_estado === 'enviado_whatsapp'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-600 text-white'
                  }`}>
                    {turno.consentimiento_estado === 'firmado_digital' ? <ShieldCheck size={18} /> : <FileCheck2 size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--foreground)]">Consentimiento Informado:</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        turno.consentimiento_estado === 'firmado_digital'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : turno.consentimiento_estado === 'enviado_whatsapp'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {turno.consentimiento_estado === 'firmado_digital'
                          ? '✔ Firmado Digitalmente'
                          : turno.consentimiento_estado === 'enviado_whatsapp'
                          ? '⏳ Enviado por WhatsApp (Pendiente Firma)'
                          : '⚪ Pendiente de Envío'}
                      </span>
                    </div>
                    {turno.consentimiento_firmado_at && (
                      <p className="text-[11px] text-[var(--secondary)] font-mono mt-0.5">
                        Firmado el: {new Date(turno.consentimiento_firmado_at).toLocaleString('es-AR')} • IP/Dispositivo: {turno.consentimiento_firma_ip || 'Móvil'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {turno.consentimiento_estado === 'firmado_digital' && (
                    <a
                      href={`${BACKEND_URL}${turno.consentimiento_pdf_url || '/static/consentimiento_' + turno.id + '.pdf'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all"
                    >
                      <Download size={14} />
                      <span>Descargar PDF Firmado</span>
                    </a>
                  )}
                  {turno.consentimiento_token && (
                    <a
                      href={`/consentimiento/${turno.consentimiento_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 border border-[var(--border)] transition-all"
                    >
                      <Eye size={13} />
                      <span>Ver Portal</span>
                    </a>
                  )}
                </div>
              </div>
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
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={15} />
                <span>2. Sala de Quirófano, Fecha & Horario Asignado</span>
              </h4>
              <div className="text-[11px] text-[var(--secondary)] font-medium">
                Días habilitados:{' '}
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {(quirofanoActual?.dias_operativos || [1, 2, 3, 4, 5])
                    .map((d: number) => nombresDiasMap[d])
                    .join(', ')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* 1. Quirófano / Sala */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Quirófano / Sala *</label>
                <select
                  value={formData.quirofano_id}
                  onChange={(e) => {
                    const nuevoQId = e.target.value
                    const nuevoQ = quirofanos.find((q) => q.id === nuevoQId)
                    const nuevosSlots = generarSlotsHorarios(nuevoQ)
                    setFormData({
                      ...formData,
                      quirofano_id: nuevoQId,
                      hora_inicio: nuevosSlots.includes(formData.hora_inicio) ? formData.hora_inicio : (nuevosSlots[0] || '08:00')
                    })
                  }}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                  required
                >
                  {quirofanos.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nombre} ({q.codigo}) — {q.duracion_slot_minutos || 15}m
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Fecha de Cirugía con Validación de Días Operativos */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Fecha de Cirugía *</label>
                  <span className={`text-[10px] font-bold ${fechaEsValida ? 'text-emerald-500' : 'text-red-500'}`}>
                    {diaSeleccionadoNombre}
                  </span>
                </div>
                <input
                  type="date"
                  value={formData.fecha_cirugia}
                  onChange={(e) => setFormData({ ...formData, fecha_cirugia: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border text-xs font-mono font-bold outline-none transition-all ${
                    fechaEsValida
                      ? 'border-[var(--border)] text-[var(--foreground)] focus:border-blue-500'
                      : 'border-red-500 text-red-500 ring-2 ring-red-500/20'
                  }`}
                  required
                />
              </div>

              {/* 3. Hora de Inicio: Menú Desplegable con Slots Configurados */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--secondary)] flex items-center justify-between">
                  <span>Hora de Inicio *</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                    (Paso {quirofanoActual?.duracion_slot_minutos || 15}m)
                  </span>
                </label>
                <select
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-mono font-bold outline-none focus:border-blue-500"
                  required
                >
                  {slotsDisponibles.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot} hs
                    </option>
                  ))}
                  {/* Si el turno actual tiene un horario previo que no coincide con un slot, se mantiene como opción */}
                  {formData.hora_inicio && !slotsDisponibles.includes(formData.hora_inicio) && (
                    <option value={formData.hora_inicio}>
                      {formData.hora_inicio} hs (Horario Asignado)
                    </option>
                  )}
                </select>
              </div>

              {/* 4. Duración en Minutos */}
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

            {/* Banner de Advertencia si se selecciona un día NO operativo */}
            {!fechaEsValida && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>
                    El <b>{quirofanoActual?.nombre}</b> no opera los <b>{diaSeleccionadoNombre}s</b>. Días habilitados:{' '}
                    {(quirofanoActual?.dias_operativos || [1, 2, 3, 4, 5])
                      .map((d: number) => nombresDiasMap[d])
                      .join(', ')}.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={moverAProximoDiaOperativo}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shrink-0 shadow-sm transition-all"
                >
                  ➔ Mover a Próximo Día Hábil
                </button>
              </div>
            )}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
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
            </div>

            {/* SECCIÓN DETALLADA: LENTE INTRAOCULAR (LIO), TORICIDAD & DIOPTRÍA */}
            <div className="p-4 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/40 border-[var(--border)] space-y-3.5">
              {/* Checkbox Principal: ¿Lleva Lente? */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.lleva_lente}
                    onChange={(e) => setFormData({ ...formData, lleva_lente: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-[var(--border)]"
                  />
                  <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <span>¿Lleva Lente Intraocular (LIO)?</span>
                  </span>
                </label>

                {formData.lleva_lente && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMostrarModalConfigLio(true)}
                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all"
                    >
                      <Plus size={11} />
                      <span>+ Crear / Gestionar LIO</span>
                    </button>
                    <a
                      href="/ajustes?tab=quirurgicos_turnos&sub=ficha_turno"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--secondary)] hover:text-blue-600 font-semibold flex items-center gap-0.5 hover:underline"
                      title="Abrir panel completo de Ajustes de Quirófano en nueva pestaña"
                    >
                      <ExternalLink size={10} />
                      <span>Ajustes</span>
                    </a>
                  </div>
                )}
              </div>

              {formData.lleva_lente ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 pt-2 border-t border-[var(--border)] animate-fade-in">
                  {/* 1. Modelo de LIO */}
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-semibold text-[var(--secondary)]">Modelo de Lente Intraocular *</label>
                    <select
                      value={formData.lente_tipo}
                      onChange={(e) => setFormData({ ...formData, lente_tipo: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                    >
                      <option value="">-- Seleccionar Modelo de LIO --</option>
                      {modelosLio.length > 0 ? (
                        modelosLio.map((m) => (
                          <option key={m.id || m.modelo} value={`${m.modelo} (${m.marca})`}>
                            {m.marca} - {m.modelo} ({m.tipo_optica})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="AcrySof IQ SN60WF (Alcon)">Alcon - AcrySof IQ SN60WF (Monofocal)</option>
                          <option value="Clareon CNA0T0 (Alcon)">Alcon - Clareon CNA0T0 (Monofocal Asférico)</option>
                          <option value="PanOptix TFNT00 (Alcon)">Alcon - PanOptix TFNT00 (Trifocal)</option>
                          <option value="TECNIS ZCB00 (J&J)">Johnson & Johnson - TECNIS ZCB00 (Monofocal)</option>
                          <option value="TECNIS Eyhance ICB00 (J&J)">Johnson & Johnson - TECNIS Eyhance ICB00 (Monofocal Plus)</option>
                          <option value="RayOne EMV (Rayner)">Rayner - RayOne EMV (EDOF)</option>
                          <option value="AT LISA tri 839MP (Zeiss)">Zeiss - AT LISA tri 839MP (Trifocal)</option>
                        </>
                      )}
                      {formData.lente_tipo && !modelosLio.some((m) => `${m.modelo} (${m.marca})` === formData.lente_tipo) && (
                        <option value={formData.lente_tipo}>{formData.lente_tipo}</option>
                      )}
                    </select>
                  </div>

                  {/* 2. Dioptría Esférica (Saltos de 0.25) */}
                  <div>
                    <label className="text-[11px] font-semibold text-[var(--secondary)] flex items-center justify-between">
                      <span>Dioptría (Esfera) *</span>
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">Paso 0.25 D</span>
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="-15.00"
                      max="45.00"
                      value={formData.lente_dioptria}
                      onChange={(e) => setFormData({ ...formData, lente_dioptria: e.target.value })}
                      placeholder="+21.50"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-blue-600 dark:text-blue-400 font-mono font-extrabold text-center outline-none focus:border-blue-500"
                      required={formData.lleva_lente}
                    />
                  </div>

                  {/* 3. Tórico (Checkbox + Input Entero de Toricidad + Eje 0-180°) */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-[var(--secondary)]">
                      <input
                        type="checkbox"
                        checked={formData.es_torico}
                        onChange={(e) => setFormData({ ...formData, es_torico: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>¿Es Tórico?</span>
                    </label>

                    {formData.es_torico ? (
                      <div className="flex items-center gap-2">
                        <div className="w-1/2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="9"
                            value={formData.lente_torico_valor}
                            onChange={(e) => setFormData({ ...formData, lente_torico_valor: parseInt(e.target.value) || 0 })}
                            placeholder="T3"
                            className="w-full px-2 py-1.5 rounded-xl bg-[var(--card)] border border-blue-500/50 text-xs font-mono font-bold text-center outline-none"
                            title="Valor tórico cilíndrico (salto discreto de 1)"
                          />
                        </div>
                        <div className="w-1/2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="180"
                            value={formData.lente_torico_eje}
                            onChange={(e) => setFormData({ ...formData, lente_torico_eje: parseInt(e.target.value) || 0 })}
                            placeholder="Eje 90°"
                            className="w-full px-2 py-1.5 rounded-xl bg-[var(--card)] border border-purple-500/50 text-xs font-mono font-bold text-center outline-none"
                            title="Eje de alineación tórica en grados (0° a 180°)"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-400 font-medium text-center">
                        No Tórico
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs italic flex items-center gap-2">
                  <span>ℹ Cirugía sin implante de Lente Intraocular.</span>
                </div>
              )}
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
        {/* MODAL RÁPIDO PARA REGISTRAR / ADMINISTRAR MODELOS DE LIO */}
        {mostrarModalConfigLio && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-600 text-white rounded-xl">
                    <Eye size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--foreground)]">Administrar Modelos de LIO</h3>
                    <p className="text-[10px] text-[var(--secondary)]">Agregue marcas y modelos para usarlos de inmediato en el turno.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalConfigLio(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCrearModeloLioRapido} className="p-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--secondary)] uppercase">Laboratorio / Marca *</label>
                    <input
                      type="text"
                      value={nuevoModeloLio.marca}
                      onChange={(e) => setNuevoModeloLio({ ...nuevoModeloLio, marca: e.target.value })}
                      placeholder="Ej: Alcon, J&J, Rayner..."
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-bold outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--secondary)] uppercase">Nombre del Modelo *</label>
                    <input
                      type="text"
                      value={nuevoModeloLio.modelo}
                      onChange={(e) => setNuevoModeloLio({ ...nuevoModeloLio, modelo: e.target.value })}
                      placeholder="Ej: AcrySof IQ SN60WF..."
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-bold outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--secondary)] uppercase">Tipo de Óptica</label>
                  <select
                    value={nuevoModeloLio.tipo_optica}
                    onChange={(e) => setNuevoModeloLio({ ...nuevoModeloLio, tipo_optica: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium outline-none focus:border-blue-500"
                  >
                    <option value="Monofocal Asférico">Monofocal Asférico</option>
                    <option value="Monofocal Esférico">Monofocal Esférico</option>
                    <option value="Monofocal Plus">Monofocal Plus (Visión Intermedia)</option>
                    <option value="Trifocal">Trifocal</option>
                    <option value="EDOF (Rango Extendido)">EDOF (Rango Extendido)</option>
                    <option value="Tórico Monofocal">Tórico Monofocal</option>
                    <option value="Tórico Multifocal">Tórico Multifocal</option>
                    <option value="Fáquico ICL">Fáquico ICL</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--secondary)] uppercase">Descripción / Detalles</label>
                  <input
                    type="text"
                    value={nuevoModeloLio.descripcion}
                    onChange={(e) => setNuevoModeloLio({ ...nuevoModeloLio, descripcion: e.target.value })}
                    placeholder="Material, filtro UV, constante biométrica..."
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[var(--border)]">
                  <a
                    href="/ajustes?tab=quirurgicos_turnos&sub=ficha_turno"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 hover:underline font-bold flex items-center gap-1"
                  >
                    <ExternalLink size={12} />
                    <span>Ver Catálogo Completo en Ajustes</span>
                  </a>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMostrarModalConfigLio(false)}
                      className="px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoNuevoLio}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
                    >
                      {guardandoNuevoLio ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      <span>Guardar y Usar</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
