'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  Scissors,
  Syringe,
  Phone,
  Hash,
  UserCheck
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface Prestador {
  id?: string
  matricula: string
  nombre_apellido: string
  rol: 'Instrumentador' | 'Anestesista' | 'Cirujano' | 'Otro'
  telefono?: string
  email?: string
  activo: boolean
}

export default function PrestadoresSettingsCard() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [filtroRol, setFiltroRol] = useState<string>('todos')
  const [prestadorEnEdicion, setPrestadorEnEdicion] = useState<Prestador | null>(null)
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false)

  const fetchPrestadores = async () => {
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/prestadores`)
      const data = await res.json()
      if (data.success && data.prestadores) {
        setPrestadores(data.prestadores)
      }
    } catch (err: any) {
      console.error('Error cargando prestadores:', err)
      setError('No se pudo conectar con el servidor para cargar los prestadores.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchPrestadores()
  }, [])

  const handleGuardarPrestador = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prestadorEnEdicion?.nombre_apellido.trim()) {
      setError('El nombre y apellido del prestador es obligatorio.')
      return
    }

    try {
      setGuardando(true)
      setError(null)
      const esEdicion = !!prestadorEnEdicion.id
      const url = esEdicion
        ? `${BACKEND_URL}/api/prestadores/${prestadorEnEdicion.id}`
        : `${BACKEND_URL}/api/prestadores`
      const method = esEdicion ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prestadorEnEdicion)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (esEdicion) {
          setPrestadores((prev) => prev.map((p) => (p.id === data.prestador.id ? data.prestador : p)))
          setMensajeExito('✔ Prestador actualizado con éxito.')
        } else {
          setPrestadores((prev) => [...prev, data.prestador])
          setMensajeExito('✔ Nuevo prestador registrado.')
        }
        setMostrandoFormulario(false)
        setPrestadorEnEdicion(null)
        setTimeout(() => setMensajeExito(null), 3000)
      } else {
        throw new Error(data.detail || 'Error al guardar prestador')
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar prestador')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarPrestador = async (id?: string) => {
    if (!id) return
    if (!confirm('¿Desea eliminar este prestador?')) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/prestadores/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPrestadores((prev) => prev.filter((p) => p.id !== id))
        setMensajeExito('✔ Prestador eliminado.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar prestador.')
    }
  }

  const prestadoresFiltrados = prestadores.filter((p) => {
    if (filtroRol === 'todos') return true
    return p.rol === filtroRol
  })

  return (
    <div className="bg-[var(--card)] p-5 md:p-6 rounded-2xl border border-[var(--border)] space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl border border-purple-500/20">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Gestión de Prestadores del Equipo Quirúrgico
            </h2>
            <p className="text-xs text-[var(--secondary)]">
              Configure instrumentadores, anestesistas y profesionales para su asignación directa en el turnero.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setPrestadorEnEdicion({
              matricula: '',
              nombre_apellido: '',
              rol: 'Instrumentador',
              telefono: '',
              email: '',
              activo: true
            })
            setMostrandoFormulario(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
        >
          <Plus size={16} />
          <span>Nuevo Prestador</span>
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

      {/* Formulario Crear / Editar */}
      {mostrandoFormulario && prestadorEnEdicion && (
        <form onSubmit={handleGuardarPrestador} className="p-4 md:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-blue-500/40 space-y-4 animate-fade-in shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck size={16} />
              <span>{prestadorEnEdicion.id ? 'Editar Prestador' : 'Registrar Nuevo Prestador'}</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setMostrandoFormulario(false)
                setPrestadorEnEdicion(null)
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕ Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Nombre y Apellido *</label>
              <input
                type="text"
                value={prestadorEnEdicion.nombre_apellido}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, nombre_apellido: e.target.value })}
                placeholder="Ej: Lic. Martínez, Laura"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Rol Quirúrgico *</label>
              <select
                value={prestadorEnEdicion.rol}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, rol: e.target.value as any })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500"
              >
                <option value="Instrumentador">Instrumentador</option>
                <option value="Anestesista">Anestesista</option>
                <option value="Cirujano">Cirujano</option>
                <option value="Otro">Otro Prestador</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Matrícula Profesional</label>
              <input
                type="text"
                value={prestadorEnEdicion.matricula}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, matricula: e.target.value })}
                placeholder="Ej: 5421"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Teléfono / WhatsApp</label>
              <input
                type="text"
                value={prestadorEnEdicion.telefono || ''}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, telefono: e.target.value })}
                placeholder="Ej: +5492615555566"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setMostrandoFormulario(false)
                setPrestadorEnEdicion(null)
              }}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Guardar Prestador</span>
            </button>
          </div>
        </form>
      )}

      {/* Filtros y Listado */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-[var(--border)] text-xs font-bold">
          {['todos', 'Instrumentador', 'Anestesista'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFiltroRol(r)}
              className={`px-3 py-1 rounded-lg transition-all ${
                filtroRol === r
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              {r === 'todos' ? 'Todos los Prestadores' : `${r}es`}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--secondary)] font-mono font-bold">
          Total: {prestadoresFiltrados.length}
        </span>
      </div>

      {cargando ? (
        <div className="p-8 text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-blue-600" />
          <span>Cargando catálogo de prestadores...</span>
        </div>
      ) : prestadoresFiltrados.length === 0 ? (
        <div className="p-8 text-center text-xs text-[var(--secondary)] border border-dashed rounded-2xl">
          No hay prestadores registrados con el filtro seleccionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {prestadoresFiltrados.map((p) => {
            const isInst = p.rol === 'Instrumentador'
            return (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-3 hover:border-blue-500/50 transition-all shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      isInst
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300'
                        : 'bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-300'
                    }`}
                  >
                    {isInst ? <Scissors size={18} /> : <Syringe size={18} />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[var(--foreground)]">{p.nombre_apellido}</p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isInst
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300'
                        }`}
                      >
                        {p.rol}
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--secondary)] font-mono flex items-center gap-1">
                      <Hash size={11} /> Matrícula: {p.matricula || 'S/D'}
                    </p>

                    {p.telefono && (
                      <p className="text-[11px] text-[var(--secondary)] font-mono flex items-center gap-1">
                        <Phone size={11} /> {p.telefono}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPrestadorEnEdicion(p)
                      setMostrandoFormulario(true)
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Editar prestador"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminarPrestador(p.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    title="Eliminar prestador"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
