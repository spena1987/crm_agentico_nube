'use client'

import React, { useState, useEffect, useRef } from 'react'
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
  UserCheck,
  RefreshCw,
  Upload,
  FileSignature,
  Building2,
  Sparkles,
  Search
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface Prestador {
  id?: string
  matricula: string
  nombre_apellido: string
  rol: 'Instrumentador' | 'Anestesista' | 'Cirujano' | 'Otro'
  geclisa_pre_id?: number | null
  especialidad?: string | null
  firma_url?: string | null
  telefono?: string
  email?: string
  activo: boolean
}

interface PrestadorGeclisa {
  pre_id: number
  nombre: string
  matricula: string | null
  especialidad: string | null
}

export default function PrestadoresSettingsCard() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [sincronizandoGeclisa, setSincronizandoGeclisa] = useState(false)
  const [subiendoFirmaId, setSubiendoFirmaId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [filtroRol, setFiltroRol] = useState<string>('todos')
  const [prestadorEnEdicion, setPrestadorEnEdicion] = useState<Prestador | null>(null)
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false)

  // Búsqueda en catálogo en vivo de Geclisa para autocompletar
  const [busquedaGeclisa, setBusquedaGeclisa] = useState('')
  const [resultadosGeclisa, setResultadosGeclisa] = useState<PrestadorGeclisa[]>([])
  const [buscandoGeclisa, setBuscandoGeclisa] = useState(false)
  const [mostrarDropdownGeclisa, setMostrarDropdownGeclisa] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [archivoFirmaSeleccionado, setArchivoFirmaSeleccionado] = useState<File | null>(null)
  const [previewFirmaLocal, setPreviewFirmaLocal] = useState<string | null>(null)

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

  // Buscar en Geclisa en vivo
  const handleBuscarGeclisa = async (query: string) => {
    setBusquedaGeclisa(query)
    const qClean = query.trim()
    if (!qClean) {
      setResultadosGeclisa([])
      setMostrarDropdownGeclisa(false)
      return
    }

    try {
      setBuscandoGeclisa(true)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/prestadores?query=${encodeURIComponent(qClean)}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setResultadosGeclisa(data.prestadores || [])
        setMostrarDropdownGeclisa(true)
      }
    } catch (err) {
      console.error('Error buscando prestadores en Geclisa:', err)
    } finally {
      setBuscandoGeclisa(false)
    }
  }

  const handleSeleccionarPrestadorGeclisa = (g: PrestadorGeclisa) => {
    if (!prestadorEnEdicion) return
    const espNorm = (g.especialidad || '').toUpperCase()
    const rolDetectado =
      espNorm.includes('ANEST') ? 'Anestesista' :
      espNorm.includes('INSTRUM') ? 'Instrumentador' : 'Cirujano'

    setPrestadorEnEdicion({
      ...prestadorEnEdicion,
      nombre_apellido: g.nombre,
      matricula: g.matricula || '',
      geclisa_pre_id: g.pre_id,
      rol: rolDetectado,
      especialidad: espNorm.includes('MEDICO') || espNorm.includes('OFTALMO') ? 'Médico Oftalmólogo' : (g.especialidad || 'Médico Oftalmólogo')
    })
    setBusquedaGeclisa('')
    setMostrarDropdownGeclisa(false)
  }

  // Sincronización masiva desde Geclisa
  const handleSincronizarGeclisa = async () => {
    try {
      setSincronizandoGeclisa(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/prestadores/sincronizar-geclisa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(`✔ ${data.mensaje || 'Sincronización completada con éxito.'}`)
        await fetchPrestadores()
        setTimeout(() => setMensajeExito(null), 4000)
      } else {
        throw new Error(data.error || data.detail || 'Error en la sincronización.')
      }
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar con Geclisa.')
    } finally {
      setSincronizandoGeclisa(false)
    }
  }

  // Guardar datos básicos del prestador
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
        const prestadorGuardado = data.prestador

        // Si hay archivo de firma seleccionado en el formulario, subirlo ahora
        if (archivoFirmaSeleccionado && prestadorGuardado?.id) {
          await subirFirmaParaPrestador(prestadorGuardado.id, archivoFirmaSeleccionado)
        }

        if (esEdicion) {
          setPrestadores((prev) => prev.map((p) => (p.id === prestadorGuardado.id ? { ...prestadorGuardado, firma_url: previewFirmaLocal || prestadorGuardado.firma_url } : p)))
          setMensajeExito('✔ Prestador actualizado con éxito.')
        } else {
          setPrestadores((prev) => [...prev, { ...prestadorGuardado, firma_url: previewFirmaLocal || prestadorGuardado.firma_url }])
          setMensajeExito('✔ Nuevo prestador registrado.')
        }
        setMostrandoFormulario(false)
        setPrestadorEnEdicion(null)
        setArchivoFirmaSeleccionado(null)
        setPreviewFirmaLocal(null)
        fetchPrestadores()
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

  // Subir imagen de firma con procesamiento de fondo transparente
  const subirFirmaParaPrestador = async (prestadorId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${BACKEND_URL}/api/prestadores/${prestadorId}/firma`, {
      method: 'POST',
      body: formData
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.detail || 'Error al procesar y subir la firma.')
    }
    return data
  }

  // Carga directa de firma desde tarjeta de prestador
  const handleCargaFirmaDirecta = async (prestadorId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setSubiendoFirmaId(prestadorId)
      setError(null)
      const data = await subirFirmaParaPrestador(prestadorId, file)
      setPrestadores((prev) =>
        prev.map((p) => (p.id === prestadorId ? { ...p, firma_url: data.firma_url } : p))
      )
      setMensajeExito('✔ Firma digitalizada con fondo transparente guardada.')
      setTimeout(() => setMensajeExito(null), 3500)
    } catch (err: any) {
      setError(err.message || 'Error al subir la firma.')
    } finally {
      setSubiendoFirmaId(null)
      e.target.value = ''
    }
  }

  // Eliminar firma de un prestador
  const handleEliminarFirma = async (prestadorId: string) => {
    if (!confirm('¿Desea eliminar la firma digital de este profesional?')) return
    try {
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/prestadores/${prestadorId}/firma`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setPrestadores((prev) =>
          prev.map((p) => (p.id === prestadorId ? { ...p, firma_url: null } : p))
        )
        if (prestadorEnEdicion?.id === prestadorId) {
          setPrestadorEnEdicion({ ...prestadorEnEdicion, firma_url: null })
        }
        setMensajeExito('✔ Firma eliminada.')
        setTimeout(() => setMensajeExito(null), 3000)
      }
    } catch (err) {
      setError('Error al eliminar la firma.')
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
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/20">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Gestión de Prestadores & Firmas Digitales
            </h2>
            <p className="text-xs text-[var(--secondary)]">
              Sincronice cirujanos, anestesistas e instrumentadores con Geclisa y configure sus firmas para indicaciones y quirófano.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSincronizarGeclisa}
            disabled={sincronizandoGeclisa}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] text-xs font-bold rounded-xl border border-[var(--border)] shadow-sm transition-all"
            title="Sincronizar catálogo oficial desde Geclisa"
          >
            <RefreshCw size={14} className={sincronizandoGeclisa ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            <span>{sincronizandoGeclisa ? 'Sincronizando...' : 'Sincronizar con Geclisa'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPrestadorEnEdicion({
                matricula: '',
                nombre_apellido: '',
                rol: 'Cirujano',
                especialidad: 'Médico Oftalmólogo',
                telefono: '',
                email: '',
                activo: true
              })
              setArchivoFirmaSeleccionado(null)
              setPreviewFirmaLocal(null)
              setMostrandoFormulario(true)
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus size={16} />
            <span>Nuevo Prestador</span>
          </button>
        </div>
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
              <span>{prestadorEnEdicion.id ? 'Editar Prestador & Firma' : 'Registrar Nuevo Prestador'}</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setMostrandoFormulario(false)
                setPrestadorEnEdicion(null)
                setArchivoFirmaSeleccionado(null)
                setPreviewFirmaLocal(null)
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕ Cerrar
            </button>
          </div>

          {/* Buscador inteligente en Geclisa para autocompletar */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-2 relative">
            <label className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-blue-600" />
              <span>Vincular con Catálogo Oficial de Geclisa (Opcional)</span>
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={busquedaGeclisa}
                onChange={(e) => handleBuscarGeclisa(e.target.value)}
                placeholder="Escriba apellido o matrícula del médico en Geclisa (Ej: GRAS, HERNAN)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-blue-500 font-medium"
              />
              {buscandoGeclisa && (
                <Loader2 size={14} className="animate-spin text-blue-600 absolute right-3 top-2.5" />
              )}
            </div>

            {mostrarDropdownGeclisa && resultadosGeclisa.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
                {resultadosGeclisa.map((g) => (
                  <button
                    key={g.pre_id}
                    type="button"
                    onClick={() => handleSeleccionarPrestadorGeclisa(g)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs flex items-center justify-between transition-colors"
                  >
                    <div>
                      <p className="font-bold text-[var(--foreground)]">{g.nombre}</p>
                      <p className="text-[10px] text-[var(--secondary)] font-mono">
                        PreId #{g.pre_id} • Matrícula: {g.matricula || 'S/D'} • {g.especialidad || 'Médico'}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold rounded-lg">
                      Seleccionar
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Nombre y Apellido *</label>
              <input
                type="text"
                value={prestadorEnEdicion.nombre_apellido}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, nombre_apellido: e.target.value })}
                placeholder="Ej: GRAS, HERNAN"
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
                <option value="Cirujano">Cirujano</option>
                <option value="Anestesista">Anestesista</option>
                <option value="Instrumentador">Instrumentador</option>
                <option value="Otro">Otro Prestador</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Matrícula Profesional</label>
              <input
                type="text"
                value={prestadorEnEdicion.matricula}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, matricula: e.target.value })}
                placeholder="Ej: 7307"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">ID Geclisa (preId)</label>
              <input
                type="number"
                value={prestadorEnEdicion.geclisa_pre_id || ''}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, geclisa_pre_id: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Ej: 945"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-mono outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--secondary)]">Especialidad / Título</label>
              <input
                type="text"
                value={prestadorEnEdicion.especialidad || ''}
                onChange={(e) => setPrestadorEnEdicion({ ...prestadorEnEdicion, especialidad: e.target.value })}
                placeholder="Ej: Médico Oftalmólogo"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs outline-none focus:border-blue-500 font-medium"
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

          {/* Sección de Firma Digitalizada */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-[var(--border)] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                <FileSignature size={15} className="text-blue-600" />
                <span>Firma & Sello Digitalizado (Fondo Transparente)</span>
              </label>
              <span className="text-[10px] text-[var(--secondary)]">
                Se estampa automáticamente en Indicaciones Médicas, Certificados y Quirófano
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Contenedor de previsualización */}
              <div className="w-48 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center p-2 relative shadow-inner overflow-hidden">
                {previewFirmaLocal || prestadorEnEdicion.firma_url ? (
                  <img
                    src={previewFirmaLocal || prestadorEnEdicion.firma_url!}
                    alt="Firma del profesional"
                    className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium text-center">
                    Sin firma asignada
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setArchivoFirmaSeleccionado(file)
                      const objUrl = URL.createObjectURL(file)
                      setPreviewFirmaLocal(objUrl)
                    }
                  }}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-900 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Upload size={14} />
                    <span>{prestadorEnEdicion.firma_url || previewFirmaLocal ? 'Cambiar Imagen de Firma' : 'Subir Foto de Sello & Firma'}</span>
                  </button>

                  {(prestadorEnEdicion.firma_url || previewFirmaLocal) && (
                    <button
                      type="button"
                      onClick={() => {
                        setArchivoFirmaSeleccionado(null)
                        setPreviewFirmaLocal(null)
                        if (prestadorEnEdicion.id) {
                          handleEliminarFirma(prestadorEnEdicion.id)
                        } else {
                          setPrestadorEnEdicion({ ...prestadorEnEdicion, firma_url: null })
                        }
                      }}
                      className="px-2.5 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/40 font-bold transition-all"
                    >
                      Quitar Firma
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[var(--secondary)]">
                  ⚡ La imagen se procesará automáticamente eliminando el fondo blanco de papel para que quede solo la tinta y el sello.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setMostrandoFormulario(false)
                setPrestadorEnEdicion(null)
                setArchivoFirmaSeleccionado(null)
                setPreviewFirmaLocal(null)
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

      {/* Filtros de Rol */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-[var(--border)] text-xs font-bold">
          {[
            { id: 'todos', label: 'Todos los Prestadores' },
            { id: 'Cirujano', label: 'Cirujanos' },
            { id: 'Anestesista', label: 'Anestesistas' },
            { id: 'Instrumentador', label: 'Instrumentadores' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltroRol(item.id)}
              className={`px-3 py-1 rounded-lg transition-all ${
                filtroRol === item.id
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              {item.label}
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
        <div className="p-8 text-center text-xs text-[var(--secondary)] border border-dashed rounded-2xl space-y-2">
          <p>No hay prestadores registrados con el filtro seleccionado.</p>
          <button
            type="button"
            onClick={handleSincronizarGeclisa}
            className="text-xs text-blue-600 hover:underline font-bold"
          >
            Sincronizar médicos desde Geclisa ahora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {prestadoresFiltrados.map((p) => {
            const isCirujano = p.rol === 'Cirujano'
            const isAnest = p.rol === 'Anestesista'
            const isInst = p.rol === 'Instrumentador'

            const badgeBg = isCirujano
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
              : isAnest
              ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900'
              : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900'

            const iconBg = isCirujano
              ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
              : isAnest
              ? 'bg-teal-500/10 text-teal-600 border-teal-500/20'
              : 'bg-purple-500/10 text-purple-600 border-purple-500/20'

            return (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between gap-3 hover:border-blue-500/50 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${iconBg}`}>
                      {isCirujano ? <Stethoscope size={18} /> : isAnest ? <Syringe size={18} /> : <Scissors size={18} />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-[var(--foreground)]">{p.nombre_apellido}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                          {p.rol}
                        </span>
                      </div>

                      <p className="text-[11px] text-[var(--secondary)] font-mono flex items-center gap-1">
                        <Hash size={11} /> Matrícula: <strong className="text-[var(--foreground)]">{p.matricula || 'S/D'}</strong>
                      </p>

                      {p.geclisa_pre_id && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono flex items-center gap-1">
                          <Building2 size={10} /> Geclisa ID: #{p.geclisa_pre_id}
                        </p>
                      )}

                      {p.especialidad && (
                        <p className="text-[10px] text-[var(--secondary)] font-medium">
                          {p.especialidad}
                        </p>
                      )}

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
                      title="Editar prestador y firma"
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

                {/* Footer de la Card: Estado de Firma Digital */}
                <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                  {p.firma_url ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-8 bg-white dark:bg-slate-900 rounded-lg border border-[var(--border)] flex items-center justify-center p-0.5 overflow-hidden shadow-inner">
                        <img src={p.firma_url} alt="Firma" className="max-h-full max-w-full object-contain" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Firma Activa
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      Sin firma cargada
                    </span>
                  )}

                  <label className="cursor-pointer text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                    {subiendoFirmaId === p.id ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={11} />
                        <span>{p.firma_url ? 'Cambiar Firma' : 'Cargar Firma'}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      disabled={subiendoFirmaId === p.id}
                      onChange={(e) => p.id && handleCargaFirmaDirecta(p.id, e)}
                    />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
