'use client'

import React, { useState, useEffect } from 'react'
import { 
  Search, 
  UserCheck, 
  Stethoscope, 
  X, 
  Loader2, 
  Check, 
  AlertCircle, 
  ShieldAlert, 
  Award,
  Sparkles,
  Trash2
} from 'lucide-react'

export interface PrestadorGeclisa {
  pre_id: number
  nombre: string
  matricula: string | null
  especialidad: string
  np_id?: number
  cant_max_turnos?: number | null
}

interface ModalAsignarMedicoProps {
  isOpen: boolean
  onClose: () => void
  paciente: {
    id: string
    nombre: string
    medico_cabecera_id?: number | null
    medico_cabecera_nombre?: string | null
    medico_cabecera_matricula?: string | null
    medico_cabecera_especialidad?: string | null
  } | null
  onMedicoAsignado: (pacienteActualizado: any) => void
}
import { BACKEND_URL } from '@/lib/api'

export default function ModalAsignarMedico({
  isOpen,
  onClose,
  paciente,
  onMedicoAsignado
}: ModalAsignarMedicoProps) {
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [resultados, setResultados] = useState<PrestadorGeclisa[]>([])
  const [busquedaRealizada, setBusquedaRealizada] = useState(false)

  // Limpiar estado al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setTerminoBusqueda('')
      setResultados([])
      setErrorBusqueda(null)
      setMensajeExito(null)
      setBusquedaRealizada(false)
    }
  }, [isOpen, paciente])

  if (!isOpen || !paciente) return null

  // Búsqueda estrictamente bajo demanda
  const handleBuscar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = terminoBusqueda.trim()
    
    setLoading(true)
    setErrorBusqueda(null)
    setMensajeExito(null)
    setBusquedaRealizada(true)

    try {
      const endpoint = `${BACKEND_URL}/api/geclisa/prestadores/buscar?query=${encodeURIComponent(query)}`
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Error en la consulta a Geclisa (${res.status}): ${errorText}`)
      }

      const data = await res.json()
      if (data && data.success && Array.isArray(data.prestadores)) {
        setResultados(data.prestadores)
      } else {
        setResultados([])
      }
    } catch (err: any) {
      console.error('Error buscando prestadores:', err)
      setErrorBusqueda(err.message || 'No se pudo consultar el catálogo de prestadores en Geclisa.')
      setResultados([])
    } finally {
      setLoading(false)
    }
  }

  // Asignar médico al paciente
  const handleSeleccionarMedico = async (medico: PrestadorGeclisa) => {
    setSaving(true)
    setErrorBusqueda(null)
    setMensajeExito(null)

    try {
      const payload = {
        pre_id: medico.pre_id,
        nombre: medico.nombre,
        matricula: medico.matricula,
        especialidad: medico.especialidad
      }

      const res = await fetch(`${BACKEND_URL}/api/pacientes/${paciente.id}/medico`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Error al guardar la asignación médica.')
      }

      const resData = await res.json()
      setMensajeExito(`Médico ${medico.nombre} asignado con éxito.`)
      
      if (resData.paciente) {
        onMedicoAsignado(resData.paciente)
      }

      // Cerrar modal tras breve feedback
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error('Error asignando médico:', err)
      setErrorBusqueda(err.message || 'Error al actualizar médico de cabecera.')
    } finally {
      setSaving(false)
    }
  }

  // Desvincular médico
  const handleDesvincularMedico = async () => {
    if (!confirm(`¿Está seguro de desvincular el médico de cabecera de ${paciente.nombre}?`)) return

    setSaving(true)
    setErrorBusqueda(null)
    try {
      const payload = {
        pre_id: null,
        nombre: null,
        matricula: null,
        especialidad: null
      }

      const res = await fetch(`${BACKEND_URL}/api/pacientes/${paciente.id}/medico`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Error al desvincular médico.')
      const resData = await res.json()
      
      if (resData.paciente) {
        onMedicoAsignado(resData.paciente)
      }
      onClose()
    } catch (err: any) {
      setErrorBusqueda(err.message || 'Error al desvincular médico.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Asignar Médico de Cabecera
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paciente: <span className="font-semibold text-slate-700 dark:text-slate-200">{paciente.nombre}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Médico actual si lo tiene */}
          {paciente.medico_cabecera_nombre && (
            <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Médico Asignado Actual
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {paciente.medico_cabecera_nombre}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {paciente.medico_cabecera_matricula ? `MP: ${paciente.medico_cabecera_matricula}` : 'Sin Matrícula'} • {paciente.medico_cabecera_especialidad || 'Especialidad General'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDesvincularMedico}
                disabled={saving}
                className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition border border-rose-200/50 dark:border-rose-900/50 flex items-center space-x-1"
                title="Desvincular médico"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Desvincular</span>
              </button>
            </div>
          )}

          {/* Formulario de Búsqueda Estrictamente Bajo Demanda */}
          <form onSubmit={handleBuscar} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Buscar en Geclisa (Nombre, Apellido o Matrícula)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={terminoBusqueda}
                  onChange={(e) => setTerminoBusqueda(e.target.value)}
                  placeholder="Ej: Sabatini, Garcia, 8643, 12355..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none dark:text-white transition"
                  disabled={loading || saving}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-xl transition flex items-center space-x-2 shadow-sm shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Consultando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              💡 Presione <strong>Buscar</strong> o Enter para consultar la base de datos de Geclisa bajo demanda.
            </p>
          </form>

          {/* Mensajes de Estado */}
          {errorBusqueda && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center space-x-2 text-rose-700 dark:text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorBusqueda}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 text-xs animate-fadeIn">
              <Check className="w-4 h-4 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* Resultados de la búsqueda */}
          {busquedaRealizada && !loading && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>Resultados encontrados: <strong>{resultados.length}</strong></span>
                {resultados.length > 0 && (
                  <span>Haga clic en <strong>Asignar</strong> sobre el médico deseado</span>
                )}
              </div>

              {resultados.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Stethoscope className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    No se encontraron prestadores con ese criterio.
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Verifique el nombre o intente buscar por los primeros dígitos de la matrícula.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {resultados.map((medico) => {
                    const esActual = paciente.medico_cabecera_id === medico.pre_id
                    return (
                      <div
                        key={medico.pre_id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between ${
                          esActual 
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700/60'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-emerald-400 dark:hover:border-emerald-600'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              {medico.nombre}
                            </span>
                            {esActual && (
                              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold rounded-full flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Actual</span>
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center font-mono bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-300">
                              {medico.matricula ? `MP: ${medico.matricula}` : 'Sin MP'}
                            </span>
                            <span>•</span>
                            <span className="text-slate-600 dark:text-slate-300">
                              {medico.especialidad || 'Médico General'}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              (ID: {medico.pre_id})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSeleccionarMedico(medico)}
                          disabled={saving || esActual}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                            esActual
                              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-default'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          }`}
                        >
                          {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : esActual ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Asignado</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Asignar</span>
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Pie de modal */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
