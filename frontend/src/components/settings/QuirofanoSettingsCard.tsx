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
  UserCheck
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface Quirofano {
  id?: string
  nombre: string
  codigo: string
  color: string
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

const DIAS_SEMANA = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 7, label: 'Domingo' }
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

export default function QuirofanoSettingsCard() {
  const [activeSubSection, setActiveSubSection] = useState<'salas' | 'duraciones' | 'bloques' | 'consentimientos' | 'whatsapp'>('salas')

  const [quirofanos, setQuirofanos] = useState<Quirofano[]>([])
  const [bloques, setBloques] = useState<BloqueMedico[]>([])
  const [duraciones, setDuraciones] = useState<Record<string, number>>({
    inyeccion: 10,
    catarata_faco: 20,
    catarata_compleja: 30,
    vitrectomia: 60,
    lasik: 15
  })
  const [plantillasConsentimiento, setPlantillasConsentimiento] = useState<PlantillaConsentimiento[]>([])
  const [waMensajeEnvio, setWaMensajeEnvio] = useState('')
  const [waMensajeConfirmacion, setWaMensajeConfirmacion] = useState('')
  const [vigenciaHoras, setVigenciaHoras] = useState(72)

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [nuevaSala, setNuevaSala] = useState<Quirofano>({
    nombre: '',
    codigo: '',
    color: '#3B82F6',
    activo: true,
    orden: 1
  })
  const [mostrandoFormSala, setMostrandoFormSala] = useState(false)

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
        setDuraciones(c.duraciones_prestaciones || {})
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
      console.error('Error cargando configuración de quirófano:', err)
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

      const payload = {
        duraciones_prestaciones: duraciones,
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

  const handleCrearSala = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaSala.nombre.trim() || !nuevaSala.codigo.trim()) {
      setError('Debe completar el nombre y código de la sala.')
      return
    }

    try {
      setGuardando(true)
      const res = await fetch(`${BACKEND_URL}/api/quirofanos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaSala)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setQuirofanos((prev) => [...prev, data.quirofano])
        setNuevaSala({ nombre: '', codigo: '', color: '#3B82F6', activo: true, orden: quirofanos.length + 1 })
        setMostrandoFormSala(false)
        setMensajeExito('✔ Sala de quirófano creada.')
        setTimeout(() => setMensajeExito(null), 3000)
      } else {
        throw new Error(data.detail || 'Error al crear sala')
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
              Quirófanos, Programación & Consentimiento Digital
            </h2>
            <p className="text-xs text-[var(--secondary)]">
              Configure las salas de cirugía, duraciones de slots, bloques de cirujanos y plantillas de consentimiento por WhatsApp.
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

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-[var(--border)]">
        {[
          { id: 'salas', label: 'Salas de Quirófano', icon: Building2 },
          { id: 'duraciones', label: 'Duraciones por Cirugía', icon: Clock },
          { id: 'bloques', label: 'Bloques de Cirujanos', icon: Scissors },
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

      {activeSubSection === 'salas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">Catálogo de Salas y Quirófanos</h3>
              <p className="text-xs text-[var(--secondary)]">Salas disponibles para asignación en el turnero.</p>
            </div>
            <button
              type="button"
              onClick={() => setMostrandoFormSala(!mostrandoFormSala)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
            >
              <Plus size={14} />
              <span>{mostrandoFormSala ? 'Cancelar' : 'Nueva Sala'}</span>
            </button>
          </div>

          {mostrandoFormSala && (
            <form onSubmit={handleCrearSala} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-blue-500/30 space-y-3">
              <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Crear Nueva Sala</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Nombre de la Sala *</label>
                  <input
                    type="text"
                    value={nuevaSala.nombre}
                    onChange={(e) => setNuevaSala({ ...nuevaSala, nombre: e.target.value })}
                    placeholder="Ej: Quirófano 1 - Principal"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Código Identificador *</label>
                  <input
                    type="text"
                    value={nuevaSala.codigo}
                    onChange={(e) => setNuevaSala({ ...nuevaSala, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ej: Q01, SALA_INJ"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] uppercase outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Color Identificador</label>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {PALETA_COLORES.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setNuevaSala({ ...nuevaSala, color: c.hex })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          nuevaSala.color === c.hex ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition-all"
                >
                  Guardar Sala
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {quirofanos.map((q) => (
              <div
                key={q.id || q.codigo}
                className="p-4 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between hover:border-slate-400 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-10 rounded-full" style={{ backgroundColor: q.color }} />
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
                <button
                  type="button"
                  onClick={() => handleEliminarSala(q.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                  title="Eliminar sala"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubSection === 'duraciones' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">Duraciones Predeterminadas (Slots en Minutos)</h3>
            <p className="text-xs text-[var(--secondary)]">
              Define cuántos minutos ocupa automáticamente cada tipo de cirugía al agendarse en el turnero.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5">
              <label className="text-xs font-bold text-[var(--foreground)]">Inyección Intravítrea (Avastin/Eylea)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={duraciones.inyeccion || 10}
                  onChange={(e) => setDuraciones({ ...duraciones, inyeccion: parseInt(e.target.value) || 10 })}
                  className="w-24 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                />
                <span className="text-xs text-[var(--secondary)]">minutos</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5">
              <label className="text-xs font-bold text-[var(--foreground)]">Catarata Facoemulsificación Estándar</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={duraciones.catarata_faco || 20}
                  onChange={(e) => setDuraciones({ ...duraciones, catarata_faco: parseInt(e.target.value) || 20 })}
                  className="w-24 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                />
                <span className="text-xs text-[var(--secondary)]">minutos</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5">
              <label className="text-xs font-bold text-[var(--foreground)]">Catarata Compleja / Combinada</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={15}
                  step={5}
                  value={duraciones.catarata_compleja || 30}
                  onChange={(e) => setDuraciones({ ...duraciones, catarata_compleja: parseInt(e.target.value) || 30 })}
                  className="w-24 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                />
                <span className="text-xs text-[var(--secondary)]">minutos</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5">
              <label className="text-xs font-bold text-[var(--foreground)]">Vitrectomía Posterior / Retina</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={20}
                  step={10}
                  value={duraciones.vitrectomia || 60}
                  onChange={(e) => setDuraciones({ ...duraciones, vitrectomia: parseInt(e.target.value) || 60 })}
                  className="w-24 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                />
                <span className="text-xs text-[var(--secondary)]">minutos</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5">
              <label className="text-xs font-bold text-[var(--foreground)]">Cirugía Refractiva (LASIK / PRK)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={duraciones.lasik || 15}
                  onChange={(e) => setDuraciones({ ...duraciones, lasik: parseInt(e.target.value) || 15 })}
                  className="w-24 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)]"
                />
                <span className="text-xs text-[var(--secondary)]">minutos</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--secondary)]">Quirófano *</label>
                  <select
                    value={nuevoBloque.quirofano_id}
                    onChange={(e) => setNuevoBloque({ ...nuevoBloque, quirofano_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)]"
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
