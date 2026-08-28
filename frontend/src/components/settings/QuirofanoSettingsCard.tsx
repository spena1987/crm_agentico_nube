'use client'

import React, { useState, useEffect } from 'react'
import {
  CalendarClock,
  Clock,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Building2,
  FileCheck2,
  MessageSquare,
  Scissors,
  UserCheck,
  Edit2,
  Sliders,
  Timer,
  CalendarDays,
  Eye
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import LioSettingsCard from './LioSettingsCard'

interface Quirofano {
  id?: string
  nombre: string
  codigo: string
  color: string
  duracion_slot_minutos?: number
  hora_inicio?: string
  hora_fin?: string
  dias_operativos?: number[] // [1, 2, 3, 4, 5] donde 1=Lunes, 7=Domingo
  activo: boolean
  orden: number
}

interface BloqueMedico {
  id?: string
  quirofano_id: string
  medico_id: number
  medico_nombre: string
  dia_semana: number
  hora_desde: string
  hora_hasta: string
  activo?: boolean
  quirofanos?: { nombre: string; codigo: string; color: string }
}

interface PlantillaConsentimiento {
  id: string
  tipo: string
  titulo: string
  cuerpo: string
}

interface PracticaDuracionItem {
  id: string
  nombre: string
  minutos: number
}

const DIAS_SEMANA = [
  { id: 1, label: 'Lunes', short: 'Lun' },
  { id: 2, label: 'Martes', short: 'Mar' },
  { id: 3, label: 'Miércoles', short: 'Mié' },
  { id: 4, label: 'Jueves', short: 'Jue' },
  { id: 5, label: 'Viernes', short: 'Vie' },
  { id: 6, label: 'Sábado', short: 'Sáb' },
  { id: 7, label: 'Domingo', short: 'Dom' }
]

const PALETA_COLORES = [
  { hex: '#3B82F6', label: 'Azul' },
  { hex: '#10B981', label: 'Verde' },
  { hex: '#8B5CF6', label: 'Púrpura' },
  { hex: '#F59E0B', label: 'Ámbar' },
  { hex: '#EC4899', label: 'Rosa' },
  { hex: '#06B6D4', label: 'Cian' },
  { hex: '#6366F1', label: 'Índigo' }
]

export default function QuirofanoSettingsCard({
  initialSubSection
}: {
  initialSubSection?: 'salas' | 'duraciones' | 'ficha_turno' | 'bloques' | 'consentimientos' | 'whatsapp'
}) {
  const [activeSubSection, setActiveSubSection] = useState<'salas' | 'duraciones' | 'ficha_turno' | 'bloques' | 'consentimientos' | 'whatsapp'>(
    initialSubSection || 'salas'
  )

  useEffect(() => {
    if (initialSubSection) {
      setActiveSubSection(initialSubSection)
    }
  }, [initialSubSection])

  // ====================================================================
  // GESTIÓN DE MODELOS DE LENTES INTRAOCULARES (LIO)
  // ====================================================================
  const [modelosLio, setModelosLio] = useState<any[]>([])
  const [cargandoLio, setCargandoLio] = useState(false)
  const [mostrandoFormLio, setMostrandoFormLio] = useState(false)
  const [modeloEnEdicion, setModeloEnEdicion] = useState<any | null>(null)

  const fetchModelosLio = async () => {
    try {
      setCargandoLio(true)
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio`)
      const data = await res.json()
      if (data.success && data.modelos) {
        setModelosLio(data.modelos)
      }
    } catch (err) {
      console.error('Error cargando modelos LIO:', err)
    } finally {
      setCargandoLio(false)
    }
  }

  useEffect(() => {
    if (activeSubSection === 'ficha_turno') {
      fetchModelosLio()
    }
  }, [activeSubSection])

  const handleGuardarModeloLio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modeloEnEdicion?.modelo?.trim() || !modeloEnEdicion?.marca?.trim()) {
      setError('La marca y el nombre del modelo son obligatorios.')
      return
    }

    try {
      setGuardando(true)
      setError(null)
      const esEdit = !!modeloEnEdicion.id
      const url = esEdit ? `${BACKEND_URL}/api/modelos-lio/${modeloEnEdicion.id}` : `${BACKEND_URL}/api/modelos-lio`
      const method = esEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modeloEnEdicion)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(esEdit ? '✔ Modelo de LIO actualizado.' : '✔ Nuevo modelo de LIO registrado.')
        setMostrandoFormLio(false)
        setModeloEnEdicion(null)
        fetchModelosLio()
        setTimeout(() => setMensajeExito(null), 3000)
      } else {
        throw new Error(data.detail || 'Error al guardar modelo de LIO')
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar modelo')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarModeloLio = async (id: string) => {
    if (!confirm('¿Desea eliminar este modelo de lente intraocular?')) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/modelos-lio/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setModelosLio((prev) => prev.filter((m) => m.id !== id))
        setMensajeExito('✔ Modelo eliminado.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar modelo.')
    }
  }

  const [quirofanos, setQuirofanos] = useState<Quirofano[]>([])
  const [bloques, setBloques] = useState<BloqueMedico[]>([])
  
  // Lista de duraciones dinámicas por práctica
  const [practicasLista, setPracticasLista] = useState<PracticaDuracionItem[]>([
    { id: 'inyeccion', nombre: 'Inyección Intravítrea (Antiangiogénico)', minutos: 10 },
    { id: 'catarata_faco', nombre: 'Catarata con Facoemulsificación Estándar', minutos: 20 },
    { id: 'catarata_compleja', nombre: 'Catarata Compleja / Combinada', minutos: 30 },
    { id: 'vitrectomia', nombre: 'Vitrectomía Posterior / Retina', minutos: 60 },
    { id: 'lasik', nombre: 'Cirugía Refractiva LASIK / PRK', minutos: 15 }
  ])

  // Parámetros Generales de la Grilla
  const [horaAperturaGeneral, setHoraAperturaGeneral] = useState('08:00')
  const [horaCierreGeneral, setHoraCierreGeneral] = useState('15:00')
  const [slotIntervaloGeneral, setSlotIntervaloGeneral] = useState(10)

  const [plantillasConsentimiento, setPlantillasConsentimiento] = useState<PlantillaConsentimiento[]>([])
  const [waMensajeEnvio, setWaMensajeEnvio] = useState('')
  const [waMensajeConfirmacion, setWaMensajeConfirmacion] = useState('')
  const [vigenciaHoras, setVigenciaHoras] = useState(72)

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Estado para Crear / Editar Sala
  const [salaEnEdicion, setSalaEnEdicion] = useState<Quirofano | null>(null)
  const [mostrandoFormSala, setMostrandoFormSala] = useState(false)

  // Nueva Práctica
  const [nuevaPracticaNombre, setNuevaPracticaNombre] = useState('')
  const [nuevaPracticaMinutos, setNuevaPracticaMinutos] = useState(20)
  const [mostrandoFormPractica, setMostrandoFormPractica] = useState(false)

  // Nuevo Bloque
  const [nuevoBloque, setNuevoBloque] = useState({
    quirofano_id: '',
    medico_id: 6162,
    medico_nombre: 'Dr. Bonanno, Pablo Antonio',
    dia_semana: 5,
    hora_desde: '08:00',
    hora_hasta: '13:00'
  })
  const [mostrandoFormBloque, setMostrandoFormBloque] = useState(false)

  const fetchAll = async () => {
    try {
      setCargando(true)
      setError(null)

      const [resConf, resSalas, resBloques] = await Promise.all([
        fetch(`${BACKEND_URL}/api/configuracion-quirofano`),
        fetch(`${BACKEND_URL}/api/quirofanos`),
        fetch(`${BACKEND_URL}/api/quirofanos/bloques-medicos`)
      ])

      const dataConf = await resConf.json()
      const dataSalas = await resSalas.json()
      const dataBloques = await resBloques.json()

      if (dataConf.success && dataConf.configuracion) {
        const c = dataConf.configuracion
        if (c.duraciones_prestaciones) {
          if (Array.isArray(c.duraciones_prestaciones)) {
            setPracticasLista(c.duraciones_prestaciones)
          } else {
            const items: PracticaDuracionItem[] = Object.entries(c.duraciones_prestaciones).map(([k, v]) => ({
              id: k,
              nombre: k.replace(/_/g, ' ').toUpperCase(),
              minutos: Number(v) || 20
            }))
            if (items.length > 0) setPracticasLista(items)
          }
        }
        if (c.hora_apertura_general) setHoraAperturaGeneral(c.hora_apertura_general)
        if (c.hora_cierre_general) setHoraCierreGeneral(c.hora_cierre_general)
        if (c.slot_intervalo_general) setSlotIntervaloGeneral(c.slot_intervalo_general)

        setPlantillasConsentimiento(c.plantillas_consentimiento || [])
        setWaMensajeEnvio(c.whatsapp_mensaje_envio || '')
        setWaMensajeConfirmacion(c.whatsapp_mensaje_confirmacion || '')
        setVigenciaHoras(c.vigencia_enlace_horas || 72)
      }

      if (dataSalas.success && dataSalas.quirofanos) {
        setQuirofanos(dataSalas.quirofanos)
        if (dataSalas.quirofanos.length > 0 && !nuevoBloque.quirofano_id) {
          setNuevoBloque((prev) => ({ ...prev, quirofano_id: dataSalas.quirofanos[0].id }))
        }
      }

      if (dataBloques.success && dataBloques.bloques) {
        setBloques(dataBloques.bloques)
      }
    } catch (err: any) {
      console.error('Error cargando configuración:', err)
      setError('No se pudo conectar con el servidor para cargar las configuraciones.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleGuardarConfigGeneral = async () => {
    try {
      setGuardando(true)
      setError(null)

      const dictDuraciones: Record<string, number> = {}
      practicasLista.forEach((p) => {
        dictDuraciones[p.id || p.nombre.toLowerCase().replace(/\s+/g, '_')] = p.minutos
      })

      const payload = {
        duraciones_prestaciones: dictDuraciones,
        hora_apertura_general: horaAperturaGeneral,
        hora_cierre_general: horaCierreGeneral,
        slot_intervalo_general: Number(slotIntervaloGeneral) || 10,
        plantillas_consentimiento: plantillasConsentimiento,
        whatsapp_mensaje_envio: waMensajeEnvio,
        whatsapp_mensaje_confirmacion: waMensajeConfirmacion,
        vigencia_enlace_horas: Number(vigenciaHoras) || 72
      }

      const res = await fetch(`${BACKEND_URL}/api/configuracion-quirofano`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Error al guardar la configuración.')
      }

      setMensajeExito('✔ Configuración de quirófano y consentimientos guardada con éxito.')
      setTimeout(() => setMensajeExito(null), 3500)
    } catch (err: any) {
      console.error('Error guardando:', err)
      setError(err.message || 'Error al guardar cambios.')
    } finally {
      setGuardando(false)
    }
  }

  // Toggle de un día operativo en la sala en edición
  const handleToggleDiaOperativo = (diaId: number) => {
    if (!salaEnEdicion) return
    const actual = salaEnEdicion.dias_operativos || [1, 2, 3, 4, 5]
    let nuevos: number[]
    if (actual.includes(diaId)) {
      nuevos = actual.filter((d) => d !== diaId)
    } else {
      nuevos = [...actual, diaId].sort((a, b) => a - b)
    }
    setSalaEnEdicion({ ...salaEnEdicion, dias_operativos: nuevos })
  }

  // Guardar Sala (Crear o Actualizar)
  const handleGuardarSala = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!salaEnEdicion?.nombre.trim() || !salaEnEdicion?.codigo.trim()) {
      setError('Debe completar el nombre y código de la sala.')
      return
    }

    try {
      setGuardando(true)
      const esEdicion = !!salaEnEdicion.id
      const url = esEdicion ? `${BACKEND_URL}/api/quirofanos/${salaEnEdicion.id}` : `${BACKEND_URL}/api/quirofanos`
      const method = esEdicion ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...salaEnEdicion,
          duracion_slot_minutos: Number(salaEnEdicion.duracion_slot_minutos) || 15,
          hora_inicio: salaEnEdicion.hora_inicio || '08:00',
          hora_fin: salaEnEdicion.hora_fin || '14:00',
          dias_operativos: salaEnEdicion.dias_operativos || [1, 2, 3, 4, 5]
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (esEdicion) {
          setQuirofanos((prev) => prev.map((q) => (q.id === data.quirofano.id ? data.quirofano : q)))
          setMensajeExito('✔ Sala actualizada con éxito.')
        } else {
          setQuirofanos((prev) => [...prev, data.quirofano])
          setMensajeExito('✔ Nueva sala de quirófano creada.')
        }
        setMostrandoFormSala(false)
        setSalaEnEdicion(null)
        setTimeout(() => setMensajeExito(null), 3000)
      } else {
        throw new Error(data.detail || 'Error al guardar sala')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarSala = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Desea eliminar este quirófano?')) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/quirofanos/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setQuirofanos((prev) => prev.filter((q) => q.id !== id))
        setMensajeExito('✔ Sala eliminada.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar sala.')
    }
  }

  // Agregar Nueva Práctica Dinámica
  const handleAgregarPractica = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaPracticaNombre.trim()) return
    const idKey = nuevaPracticaNombre.toLowerCase().trim().replace(/\s+/g, '_')
    setPracticasLista((prev) => [
      ...prev,
      { id: idKey, nombre: nuevaPracticaNombre.trim(), minutos: Number(nuevaPracticaMinutos) || 20 }
    ])
    setNuevaPracticaNombre('')
    setNuevaPracticaMinutos(20)
    setMostrandoFormPractica(false)
  }

  const handleEliminarPractica = (index: number) => {
    setPracticasLista((prev) => prev.filter((_, i) => i !== index))
  }

  // Bloques Médicos
  const handleCrearBloque = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoBloque.quirofano_id || !nuevoBloque.medico_nombre) {
      setError('Complete los datos del bloque médico.')
      return
    }

    try {
      setGuardando(true)
      const res = await fetch(`${BACKEND_URL}/api/quirofanos/bloques-medicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoBloque)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setBloques((prev) => [...prev, data.bloque])
        setMostrandoFormBloque(false)
        setMensajeExito('✔ Bloque médico asignado con éxito.')
        setTimeout(() => setMensajeExito(null), 3000)
      } else {
        throw new Error(data.detail || 'Error al crear bloque')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarBloque = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Eliminar esta asignación de horario médico?')) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/quirofanos/bloques-medicos/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setBloques((prev) => prev.filter((b) => b.id !== id))
        setMensajeExito('✔ Bloque médico eliminado.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar bloque.')
    }
  }

  if (cargando) {
    return (
      <div className="bg-[var(--card)] p-8 rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-sm font-medium text-[var(--secondary)]">Cargando configuración de Quirófanos y Consentimientos...</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--card)] p-5 md:p-6 rounded-2xl border border-[var(--border)] space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/20">
            <CalendarClock size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Quirófanos, Duración de Turnos & Consentimiento
            </h2>
            <p className="text-xs text-[var(--secondary)]">
              Configure las salas, días operativos (Lunes a Domingo), duración de slots y plantillas de WhatsApp.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGuardarConfigGeneral}
          disabled={guardando}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Guardar Cambios</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {mensajeExito && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* Subpestañas */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-[var(--border)]">
        {[
          { id: 'salas', label: 'Salas de Quirófano & Días', icon: Building2 },
          { id: 'duraciones', label: 'Duraciones por Práctica', icon: Timer },
          { id: 'bloques', label: 'Bloques de Cirujanos', icon: Scissors },
          { id: 'ficha_turno', label: 'Modelos de LIO (Lentes)', icon: Eye },
          { id: 'consentimientos', label: 'Textos de Consentimiento', icon: FileCheck2 },
          { id: 'whatsapp', label: 'Mensajes WhatsApp', icon: MessageSquare }
        ].map((sub) => {
          const Icon = sub.icon
          const isActive = activeSubSection === sub.id
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubSection(sub.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-[var(--border)]'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon size={15} />
              <span>{sub.label}</span>
            </button>
          )
        })}
      </div>

      {/* SECCIÓN 1: SALAS DE QUIRÓFANO, DÍAS OPERATIVOS Y DURACIÓN */}
      {activeSubSection === 'salas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">Salas de Cirugía, Días Operativos y Duración</h3>
              <p className="text-xs text-[var(--secondary)]">
                Defina qué días de la semana opera cada sala (Lunes a Domingo), su duración de slot y horarios.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSalaEnEdicion({
                  nombre: '',
                  codigo: '',
                  color: '#3B82F6',
                  duracion_slot_minutos: 20,
                  hora_inicio: '08:00',
                  hora_fin: '14:00',
                  dias_operativos: [1, 2, 3, 4, 5],
                  activo: true,
                  orden: quirofanos.length + 1
                })
                setMostrandoFormSala(true)
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-all"
            >
              <Plus size={14} />
              <span>Nueva Sala</span>
            </button>
          </div>

          {/* Formulario Crear / Editar Sala */}
          {mostrandoFormSala && salaEnEdicion && (
            <form onSubmit={handleGuardarSala} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-blue-500/40 space-y-4 animate-fade-in shadow-md">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={15} />
                  <span>{salaEnEdicion.id ? 'Editar Sala de Quirófano' : 'Nueva Sala de Quirófano'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setMostrandoFormSala(false)
                    setSalaEnEdicion(null)
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕ Cerrar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Nombre de la Sala *</label>
                  <input
                    type="text"
                    value={salaEnEdicion.nombre}
                    onChange={(e) => setSalaEnEdicion({ ...salaEnEdicion, nombre: e.target.value })}
                    placeholder="Ej: Quirófano 1 - Principal / Cataratas"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Código Identificador *</label>
                  <input
                    type="text"
                    value={salaEnEdicion.codigo}
                    onChange={(e) => setSalaEnEdicion({ ...salaEnEdicion, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ej: Q01, SALA_INJ"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] uppercase outline-none focus:border-blue-500 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">
                    Duración del Turno / Slot (Minutos) *
                  </label>
                  <select
                    value={salaEnEdicion.duracion_slot_minutos || 20}
                    onChange={(e) =>
                      setSalaEnEdicion({
                        ...salaEnEdicion,
                        duracion_slot_minutos: parseInt(e.target.value) || 20
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-blue-600"
                  >
                    <option value={5}>5 minutos (Láser / Curación rápida)</option>
                    <option value={10}>10 minutos (Inyección Intravítrea)</option>
                    <option value={15}>15 minutos (Cirugía Refractiva / LASIK)</option>
                    <option value={20}>20 minutos (Catarata Estándar)</option>
                    <option value={30}>30 minutos (Catarata Compleja / Glaucoma)</option>
                    <option value={45}>45 minutos (Cirugías Combinadas)</option>
                    <option value={60}>60 minutos (Vitrectomía / Retina)</option>
                    <option value={90}>90 minutos (Procedimientos Mayores)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Hora de Apertura / Inicio</label>
                  <input
                    type="time"
                    value={salaEnEdicion.hora_inicio || '08:00'}
                    onChange={(e) => setSalaEnEdicion({ ...salaEnEdicion, hora_inicio: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Hora de Cierre / Fin</label>
                  <input
                    type="time"
                    value={salaEnEdicion.hora_fin || '14:00'}
                    onChange={(e) => setSalaEnEdicion({ ...salaEnEdicion, hora_fin: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Color Identificador</label>
                  <div className="flex items-center gap-2 mt-2">
                    {PALETA_COLORES.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSalaEnEdicion({ ...salaEnEdicion, color: c.hex })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          salaEnEdicion.color === c.hex
                            ? 'scale-125 border-slate-900 dark:border-white shadow'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Selector de Días Operativos (Lunes a Domingo) */}
              <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <CalendarDays size={15} className="text-blue-600" />
                    <span>Días Operativos de esta Sala (Lunes a Domingo) *</span>
                  </label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSalaEnEdicion({ ...salaEnEdicion, dias_operativos: [1, 2, 3, 4, 5] })}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Lun a Vie
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSalaEnEdicion({ ...salaEnEdicion, dias_operativos: [1, 2, 3, 4, 5, 6] })}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Lun a Sáb
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSalaEnEdicion({ ...salaEnEdicion, dias_operativos: [1, 2, 3, 4, 5, 6, 7] })}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 pt-1">
                  {DIAS_SEMANA.map((d) => {
                    const diasActivos = salaEnEdicion.dias_operativos || [1, 2, 3, 4, 5]
                    const isSelected = diasActivos.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleToggleDiaOperativo(d.id)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all text-center border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-[var(--secondary)] border-transparent hover:bg-slate-200'
                        }`}
                      >
                        <p className="text-[11px]">{d.short}</p>
                        <p className="text-[9px] opacity-80">{isSelected ? 'Activo' : 'Cerrado'}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setMostrandoFormSala(false)
                    setSalaEnEdicion(null)
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow"
                >
                  {guardando ? 'Guardando...' : 'Guardar Parámetros de Sala'}
                </button>
              </div>
            </form>
          )}

          {/* Listado de Salas con Días y Parámetros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {quirofanos.map((q) => {
              const dias = q.dias_operativos || [1, 2, 3, 4, 5]
              return (
                <div
                  key={q.id || q.codigo}
                  className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3 hover:border-blue-500/50 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-12 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--foreground)]">{q.nombre}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                            {q.codigo}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">● Activo en turnero</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSalaEnEdicion(q)
                          setMostrandoFormSala(true)
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                        title="Editar sala, días y duración"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarSala(q.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                        title="Eliminar sala"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Badges de Días Operativos */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-[var(--secondary)]">Días Operativos:</span>
                    <div className="flex flex-wrap gap-1">
                      {DIAS_SEMANA.map((d) => {
                        const isOp = dias.includes(d.id)
                        return (
                          <span
                            key={d.id}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md font-mono ${
                              isOp
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'
                            }`}
                          >
                            {d.short}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Parámetros de Duración y Horario de la Sala */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]/60 text-xs">
                    <div className="p-2 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-0.5">
                      <span className="text-[10px] text-[var(--secondary)] font-semibold block flex items-center gap-1">
                        <Timer size={11} className="text-blue-500" /> Slot del Turno:
                      </span>
                      <span className="font-bold text-blue-600 font-mono">
                        {q.duracion_slot_minutos || 15} minutos
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-0.5">
                      <span className="text-[10px] text-[var(--secondary)] font-semibold block flex items-center gap-1">
                        <Clock size={11} className="text-purple-500" /> Operatividad:
                      </span>
                      <span className="font-bold text-[var(--foreground)] font-mono text-[11px]">
                        {q.hora_inicio || '08:00'} - {q.hora_fin || '14:00'} hs
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SUBSECCIÓN: CONFIGURACIÓN FICHA DE TURNO QUIRÚRGICO & MODELOS LIO */}
      {activeSubSection === 'ficha_turno' && (
        <div className="space-y-4 animate-fade-in">
          <LioSettingsCard />
        </div>
      )}

      {/* SECCIÓN 2: DURACIONES POR PRÁCTICA */}
      {activeSubSection === 'duraciones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">Duraciones Predeterminadas por Práctica</h3>
              <p className="text-xs text-[var(--secondary)]">
                Personalice los minutos que ocupa cada cirugía. Puede agregar nuevas prácticas, editar duraciones o eliminar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMostrandoFormPractica(!mostrandoFormPractica)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
            >
              <Plus size={14} />
              <span>{mostrandoFormPractica ? 'Cancelar' : 'Nueva Práctica'}</span>
            </button>
          </div>

          {mostrandoFormPractica && (
            <form onSubmit={handleAgregarPractica} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-blue-500/30 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Nombre de la Práctica / Cirugía *</label>
                <input
                  type="text"
                  value={nuevaPracticaNombre}
                  onChange={(e) => setNuevaPracticaNombre(e.target.value)}
                  placeholder="Ej: Glaucoma Trabeculectomía, Capsulotomía YAG..."
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold"
                  required
                />
              </div>
              <div className="w-36">
                <label className="text-[11px] font-semibold text-[var(--secondary)]">Minutos Ocupados *</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={nuevaPracticaMinutos}
                  onChange={(e) => setNuevaPracticaMinutos(parseInt(e.target.value) || 20)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-blue-600"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Agregar
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {practicasLista.map((p, idx) => (
              <div
                key={p.id || idx}
                className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={p.nombre}
                    onChange={(e) => {
                      const copia = [...practicasLista]
                      copia[idx].nombre = e.target.value
                      setPracticasLista(copia)
                    }}
                    className="w-full bg-transparent border-0 text-xs font-bold text-[var(--foreground)] truncate focus:bg-[var(--card)] focus:border focus:border-[var(--border)] rounded px-1"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={p.minutos}
                    onChange={(e) => {
                      const copia = [...practicasLista]
                      copia[idx].minutos = parseInt(e.target.value) || 20
                      setPracticasLista(copia)
                    }}
                    className="w-16 px-2 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-blue-600 font-mono text-center"
                  />
                  <span className="text-[11px] text-[var(--secondary)]">min</span>
                  <button
                    type="button"
                    onClick={() => handleEliminarPractica(idx)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded"
                    title="Eliminar práctica"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN 3: BLOQUES DE CIRUJANOS */}
      {activeSubSection === 'bloques' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">Bloques Quirúrgicos por Cirujano</h3>
              <p className="text-xs text-[var(--secondary)]">Asignación fija de días, horas y quirófano a cada profesional.</p>
            </div>
            <button
              type="button"
              onClick={() => setMostrandoFormBloque(!mostrandoFormBloque)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
            >
              <Plus size={14} />
              <span>{mostrandoFormBloque ? 'Cancelar' : 'Asignar Bloque'}</span>
            </button>
          </div>

          {mostrandoFormBloque && (
            <form onSubmit={handleCrearBloque} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-blue-500/30 space-y-3">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Nuevo Bloque Quirúrgico</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Cirujano *</label>
                  <input
                    type="text"
                    value={nuevoBloque.medico_nombre}
                    onChange={(e) => setNuevoBloque({ ...nuevoBloque, medico_nombre: e.target.value })}
                    placeholder="Ej: Dr. Bonanno, Pablo Antonio"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Quirófano *</label>
                  <select
                    value={nuevoBloque.quirofano_id}
                    onChange={(e) => setNuevoBloque({ ...nuevoBloque, quirofano_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold"
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
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Día de la Semana *</label>
                  <select
                    value={nuevoBloque.dia_semana}
                    onChange={(e) => setNuevoBloque({ ...nuevoBloque, dia_semana: parseInt(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
                  >
                    {DIAS_SEMANA.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="text-[11px] font-semibold text-[var(--secondary)]">Desde</label>
                    <input
                      type="time"
                      value={nuevoBloque.hora_desde}
                      onChange={(e) => setNuevoBloque({ ...nuevoBloque, hora_desde: e.target.value })}
                      className="w-full mt-1 px-2 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
                      required
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="text-[11px] font-semibold text-[var(--secondary)]">Hasta</label>
                    <input
                      type="time"
                      value={nuevoBloque.hora_hasta}
                      onChange={(e) => setNuevoBloque({ ...nuevoBloque, hora_hasta: e.target.value })}
                      className="w-full mt-1 px-2 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  Asignar Horario
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {bloques.length === 0 ? (
              <p className="text-xs text-[var(--secondary)] italic py-4 text-center">No hay bloques médicos configurados.</p>
            ) : (
              bloques.map((b) => {
                const diaNombre = DIAS_SEMANA.find((d) => d.id === b.dia_semana)?.label || 'Día'
                return (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--foreground)]">{b.medico_nombre}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                            {diaNombre} {b.hora_desde.slice(0, 5)} - {b.hora_hasta.slice(0, 5)} hs
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--secondary)]">
                          Quirófano: {b.quirofanos?.nombre || 'Sala asignada'} ({b.quirofanos?.codigo || 'Q'})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEliminarBloque(b.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                      title="Eliminar bloque"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* SECCIÓN 4: TEXTOS DE CONSENTIMIENTO */}
      {activeSubSection === 'consentimientos' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">Textos Legales y Plantillas de Consentimiento</h3>
            <p className="text-xs text-[var(--secondary)]">
              Redacta las cláusulas que leerá y firmará el paciente en su celular según la práctica indicada.
            </p>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div>
              <b>Variables dinámicas permitidas:</b> <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded">{"{paciente}"}</code>,{' '}
              <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded">{"{dni}"}</code>,{' '}
              <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded">{"{cirugia}"}</code>,{' '}
              <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded">{"{ojo_intervenido}"}</code>,{' '}
              <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded">{"{cirujano}"}</code>,{' '}
              <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded">{"{quirofano}"}</code>,{' '}
              <code className="bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded">{"{fecha_cirugia}"}</code>.
            </div>
          </div>

          <div className="space-y-4">
            {plantillasConsentimiento.map((pl, idx) => (
              <div key={pl.id || idx} className="p-4 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 uppercase">{pl.titulo || pl.id}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                    ID: {pl.id}
                  </span>
                </div>
                <input
                  type="text"
                  value={pl.titulo}
                  onChange={(e) => {
                    const copia = [...plantillasConsentimiento]
                    copia[idx].titulo = e.target.value
                    setPlantillasConsentimiento(copia)
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                  placeholder="Título del documento"
                />
                <textarea
                  rows={4}
                  value={pl.cuerpo}
                  onChange={(e) => {
                    const copia = [...plantillasConsentimiento]
                    copia[idx].cuerpo = e.target.value
                    setPlantillasConsentimiento(copia)
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] leading-relaxed"
                  placeholder="Cuerpo del consentimiento..."
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN 5: MENSAJES WHATSAPP */}
      {activeSubSection === 'whatsapp' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">Plantillas de Mensajes de WhatsApp y Firma</h3>
            <p className="text-xs text-[var(--secondary)]">
              Mensajes automáticos que recibe el paciente con el enlace único para firmar desde su smartphone.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[var(--foreground)]">Mensaje de Envío con Enlace de Firma</label>
              <textarea
                rows={3}
                value={waMensajeEnvio}
                onChange={(e) => setWaMensajeEnvio(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
                placeholder="Hola {paciente}, confirmamos tu turno..."
              />
              <p className="text-[11px] text-[var(--secondary)] mt-1">
                Debe incluir el tag <code className="font-mono text-blue-600">{"{enlace_firma}"}</code>.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--foreground)]">Mensaje de Confirmación tras la Firma (Con Ayuno)</label>
              <textarea
                rows={2}
                value={waMensajeConfirmacion}
                onChange={(e) => setWaMensajeConfirmacion(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
                placeholder="¡Muchas gracias {paciente}! Hemos registrado tu consentimiento..."
              />
            </div>

            <div className="pt-2">
              <label className="text-xs font-bold text-[var(--foreground)]">Vigencia del Enlace Web Seguro</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={12}
                  max={720}
                  value={vigenciaHoras}
                  onChange={(e) => setVigenciaHoras(parseInt(e.target.value) || 72)}
                  className="w-24 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                />
                <span className="text-xs text-[var(--secondary)]">horas antes de expirar el enlace</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
