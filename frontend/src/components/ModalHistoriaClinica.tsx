'use client'

import React, { useState, useEffect } from 'react'
import { 
  FileHeart, 
  X, 
  RefreshCw, 
  Loader2, 
  Search, 
  Calendar, 
  Clock, 
  UserCheck, 
  Stethoscope, 
  AlertCircle, 
  FileQuestion,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Pill,
  ChevronsUpDown,
  ChevronsDownUp,
  Receipt,
  Layers,
  FolderDown,
  Trash2,
  Download,
  ExternalLink,
  FileCheck
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

type TabTipo = 'evoluciones' | 'indicaciones' | 'archivos'

interface EvolucionClinica {
  hc_id: number
  fecha: string
  fecha_hora?: string
  hora: string
  prestador: string
  especialidad: string
  area: string
  texto: string
  nombre_plantilla: string
}

interface IndicacionMedica {
  id: number
  tipo: 'INDICACION' | 'MEDICACION_PROTOCOLO' | 'MEDICACION_ACTIVA' | 'RECETA' | string
  tipo_label: string
  fecha: string
  hora: string
  prestador: string
  especialidad: string
  titulo: string
  texto: string
  plantilla: string
}

interface ArchivoGeclisa {
  as_id: number
  fecha: string
  titulo: string
  prestador: string
  clase: string
  formato: string
  url?: string
}

interface HistoriaClinicaResponse {
  encontrado: boolean
  motivo?: 'sin_dni' | 'sin_ficha_geclisa' | 'no_encontrado_geclisa' | string
  mensaje?: string
  paciente_id?: string
  ficha_id?: number
  paciente_nombre?: string
  paciente_dni?: string
  fecha_generacion?: string
  evoluciones_recientes?: EvolucionClinica[]
  total_evoluciones?: number
}

interface IndicacionesResponse {
  encontrado: boolean
  motivo?: 'sin_dni' | 'sin_ficha_geclisa' | 'no_encontrado_geclisa' | string
  mensaje?: string
  paciente_id?: string
  ficha_id?: number
  paciente_nombre?: string
  paciente_dni?: string
  indicaciones?: IndicacionMedica[]
  total_indicaciones?: number
}

interface ArchivosResponse {
  success: boolean
  encontrado: boolean
  ficha_id?: number
  paciente_nombre?: string
  archivos: ArchivoGeclisa[]
  total_archivos?: number
  mensaje?: string
}

interface ModalHistoriaClinicaProps {
  isOpen: boolean
  onClose: () => void
  paciente: {
    id: string
    nombre: string
    dni?: string | null
    geclisa_ficha_id?: number | null
    nro_hc?: string | null
    telefono?: string
  } | null
}

export default function ModalHistoriaClinica({
  isOpen,
  onClose,
  paciente
}: ModalHistoriaClinicaProps) {
  // Pestaña activa (Evolución vs Indicaciones vs Archivos)
  const [activeTab, setActiveTab] = useState<TabTipo | null>(null)

  // Estados de carga por pestaña (Carga Lazy / On-Demand)
  const [cargandoEvoluciones, setCargandoEvoluciones] = useState<boolean>(false)
  const [cargandoIndicaciones, setCargandoIndicaciones] = useState<boolean>(false)
  const [cargandoArchivos, setCargandoArchivos] = useState<boolean>(false)
  const [eliminandoArchivoId, setEliminandoArchivoId] = useState<number | null>(null)

  // Datos cacheados en sesión del modal
  const [dataHc, setDataHc] = useState<HistoriaClinicaResponse | null>(null)
  const [dataInd, setDataInd] = useState<IndicacionesResponse | null>(null)
  const [dataArchivos, setDataArchivos] = useState<ArchivosResponse | null>(null)

  // Errores locales
  const [errorHc, setErrorHc] = useState<string>('')
  const [errorInd, setErrorInd] = useState<string>('')
  const [errorArchivos, setErrorArchivos] = useState<string>('')

  // Búsqueda
  const [busqueda, setBusqueda] = useState<string>('')

  // Estado de tarjetas expandidas (IDs de evoluciones e indicaciones)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  // Al abrir el modal, reiniciar estados y seleccionar 'evoluciones'
  useEffect(() => {
    if (isOpen && paciente) {
      setActiveTab('evoluciones')
      setBusqueda('')
      setExpandedItems({})
      // Cargar evoluciones de inicio
      cargarEvoluciones()
    } else {
      setActiveTab(null)
      setDataHc(null)
      setDataInd(null)
      setDataArchivos(null)
      setErrorHc('')
      setErrorInd('')
      setErrorArchivos('')
      setBusqueda('')
      setExpandedItems({})
    }
  }, [isOpen, paciente?.id])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const getQueryId = () => {
    return paciente?.id || paciente?.dni || paciente?.geclisa_ficha_id
  }

  // 1. Cargar Evoluciones Recientes
  const cargarEvoluciones = async (force: boolean = false) => {
    const queryId = getQueryId()
    if (!queryId) {
      setErrorHc('El paciente no cuenta con ID ni DNI para consultar en Geclisa.')
      return
    }

    if (dataHc && !force) return // Ya cargado en caché

    setCargandoEvoluciones(true)
    setErrorHc('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(queryId)}/historia-clinica`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.mensaje || `Error al consultar Geclisa (HTTP ${res.status})`)
      }
      const data: HistoriaClinicaResponse = await res.json()
      setDataHc(data)
    } catch (err: any) {
      console.error('Error al obtener evoluciones:', err)
      setErrorHc(err.message || 'No se pudo conectar con el servidor de Geclisa.')
    } finally {
      setCargandoEvoluciones(false)
    }
  }

  // 2. Cargar Indicaciones Médicas (Solo al hacer clic en el botón)
  const cargarIndicaciones = async (force: boolean = false) => {
    const queryId = getQueryId()
    if (!queryId) {
      setErrorInd('El paciente no cuenta con ID ni DNI para consultar en Geclisa.')
      return
    }

    if (dataInd && !force) return // Ya cargado en caché

    setCargandoIndicaciones(true)
    setErrorInd('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(queryId)}/indicaciones`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.mensaje || `Error al consultar Geclisa (HTTP ${res.status})`)
      }
      const data: IndicacionesResponse = await res.json()
      setDataInd(data)
    } catch (err: any) {
      console.error('Error al obtener indicaciones:', err)
      setErrorInd(err.message || 'No se pudo conectar con el servidor de Geclisa.')
    } finally {
      setCargandoIndicaciones(false)
    }
  }

  // 3. Cargar Archivos / Documentos de Geclisa
  const cargarArchivos = async (force: boolean = false) => {
    const queryId = paciente?.id
    if (!queryId) {
      setErrorArchivos('El paciente no cuenta con ID para consultar archivos.')
      return
    }

    if (dataArchivos && !force) return

    setCargandoArchivos(true)
    setErrorArchivos('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(queryId)}/archivos`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.mensaje || `Error al consultar archivos en Geclisa (HTTP ${res.status})`)
      }
      const data: ArchivosResponse = await res.json()
      setDataArchivos(data)
    } catch (err: any) {
      console.error('Error al obtener archivos de Geclisa:', err)
      setErrorArchivos(err.message || 'No se pudo conectar con el servidor de Geclisa.')
    } finally {
      setCargandoArchivos(false)
    }
  }

  // Eliminar archivo de Geclisa
  const handleEliminarArchivo = async (asId: number) => {
    if (!confirm(`¿Está seguro de eliminar el archivo #${asId} de la Historia Clínica en Geclisa? Esta acción borrará el registro hospitalario.`)) {
      return
    }
    try {
      setEliminandoArchivoId(asId)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/archivos/${asId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDataArchivos((prev) => {
          if (!prev) return prev
          const filtrados = prev.archivos.filter((a) => a.as_id !== asId)
          return {
            ...prev,
            archivos: filtrados,
            total_archivos: filtrados.length
          }
        })
      } else {
        alert(data.detail || data.error || 'Error al eliminar archivo de Geclisa')
      }
    } catch (err: any) {
      console.error('Error eliminando archivo de Geclisa:', err)
      alert(err.message || 'Error de conexión.')
    } finally {
      setEliminandoArchivoId(null)
    }
  }

  // Cambio de Pestaña con llamada On-Demand
  const handleSelectTab = (tab: TabTipo) => {
    setActiveTab(tab)
    setBusqueda('')
    if (tab === 'evoluciones' && !dataHc) {
      cargarEvoluciones()
    } else if (tab === 'indicaciones' && !dataInd) {
      cargarIndicaciones()
    } else if (tab === 'archivos' && !dataArchivos) {
      cargarArchivos()
    }
  }

  // Toggle individual de expansión de tarjeta
  const toggleExpand = (id: string | number) => {
    const key = String(id)
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (!isOpen || !paciente) return null

  // Listados y filtros
  const evoluciones = dataHc?.evoluciones_recientes || []
  const evolucionesFiltradas = evoluciones.filter((ev) => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      (ev.texto && ev.texto.toLowerCase().includes(q)) ||
      (ev.prestador && ev.prestador.toLowerCase().includes(q)) ||
      (ev.especialidad && ev.especialidad.toLowerCase().includes(q)) ||
      (ev.fecha && ev.fecha.includes(q)) ||
      (ev.nombre_plantilla && ev.nombre_plantilla.toLowerCase().includes(q))
    )
  })

  const indicaciones = dataInd?.indicaciones || []
  const indicacionesFiltradas = indicaciones.filter((ind) => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      (ind.titulo && ind.titulo.toLowerCase().includes(q)) ||
      (ind.texto && ind.texto.toLowerCase().includes(q)) ||
      (ind.prestador && ind.prestador.toLowerCase().includes(q)) ||
      (ind.especialidad && ind.especialidad.toLowerCase().includes(q)) ||
      (ind.fecha && ind.fecha.includes(q)) ||
      (ind.plantilla && ind.plantilla.toLowerCase().includes(q))
    )
  })

  const archivos = dataArchivos?.archivos || []
  const archivosFiltrados = archivos.filter((arc) => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      (arc.titulo && arc.titulo.toLowerCase().includes(q)) ||
      (arc.prestador && arc.prestador.toLowerCase().includes(q)) ||
      (arc.clase && arc.clase.toLowerCase().includes(q)) ||
      (arc.fecha && arc.fecha.includes(q)) ||
      (arc.as_id && String(arc.as_id).includes(q))
    )
  })

  // Control Expandir / Contraer Todo
  const currentItemsList = activeTab === 'evoluciones' 
    ? evolucionesFiltradas.map((e) => String(e.hc_id))
    : activeTab === 'indicaciones'
    ? indicacionesFiltradas.map((i, idx) => String(i.id || idx))
    : []

  const allExpanded = currentItemsList.length > 0 && currentItemsList.every((k) => !!expandedItems[k])

  const handleToggleExpandAll = () => {
    const nextState = !allExpanded
    const updated: Record<string, boolean> = { ...expandedItems }
    currentItemsList.forEach((k) => {
      updated[k] = nextState
    })
    setExpandedItems(updated)
  }

  const fichaIdActual = dataHc?.ficha_id || dataInd?.ficha_id || dataArchivos?.ficha_id || paciente.geclisa_ficha_id
  const estaCargando = 
    activeTab === 'evoluciones' 
      ? cargandoEvoluciones 
      : activeTab === 'indicaciones' 
      ? cargandoIndicaciones 
      : cargandoArchivos
  const errorActual = 
    activeTab === 'evoluciones' 
      ? errorHc 
      : activeTab === 'indicaciones' 
      ? errorInd 
      : errorArchivos

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header del Pop-up */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-inner">
              <FileHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Expediente Clínico Geclisa
                </h3>
                {fichaIdActual && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    Ficha #{fichaIdActual}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--secondary)] flex items-center gap-1.5 mt-0.5">
                <span className="text-gray-200 font-medium">{paciente.nombre}</span>
                {paciente.dni && <span className="text-gray-400 font-mono">• DNI: {paciente.dni}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (activeTab === 'evoluciones') cargarEvoluciones(true)
                if (activeTab === 'indicaciones') cargarIndicaciones(true)
                if (activeTab === 'archivos') cargarArchivos(true)
              }}
              disabled={estaCargando}
              title="Actualizar datos en vivo desde Geclisa"
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-[var(--border)] disabled:opacity-50"
            >
              <RefreshCw size={16} className={estaCargando ? 'animate-spin text-rose-400' : ''} />
            </button>
            <button
              onClick={onClose}
              disabled={estaCargando}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-[var(--border)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Selección de Modo (3 Botones Principales: Evolución, Indicaciones y Archivos) */}
        <div className="p-3 bg-neutral-950/60 border-b border-[var(--border)] flex items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            {/* Botón 1: Evolución */}
            <button
              type="button"
              onClick={() => handleSelectTab('evoluciones')}
              className={`px-3 sm:px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all border ${
                activeTab === 'evoluciones'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/40'
                  : 'bg-neutral-900/80 text-gray-300 border-[var(--border)] hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <FileText size={15} className={activeTab === 'evoluciones' ? 'text-white' : 'text-rose-400'} />
              <span>Evolución</span>
              {dataHc?.total_evoluciones !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  activeTab === 'evoluciones' ? 'bg-rose-700 text-white' : 'bg-neutral-800 text-gray-400'
                }`}>
                  {dataHc.total_evoluciones}
                </span>
              )}
            </button>

            {/* Botón 2: Indicaciones */}
            <button
              type="button"
              onClick={() => handleSelectTab('indicaciones')}
              className={`px-3 sm:px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all border ${
                activeTab === 'indicaciones'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/40'
                  : 'bg-neutral-900/80 text-gray-300 border-[var(--border)] hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <Pill size={15} className={activeTab === 'indicaciones' ? 'text-white' : 'text-indigo-400'} />
              <span>Indicaciones</span>
              {dataInd?.total_indicaciones !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  activeTab === 'indicaciones' ? 'bg-indigo-700 text-white' : 'bg-neutral-800 text-gray-400'
                }`}>
                  {dataInd.total_indicaciones}
                </span>
              )}
            </button>

            {/* Botón 3: Archivos y Documentos */}
            <button
              type="button"
              onClick={() => handleSelectTab('archivos')}
              className={`px-3 sm:px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all border ${
                activeTab === 'archivos'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/40'
                  : 'bg-neutral-900/80 text-gray-300 border-[var(--border)] hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <FolderDown size={15} className={activeTab === 'archivos' ? 'text-white' : 'text-blue-400'} />
              <span>Archivos / PDFs</span>
              {dataArchivos?.total_archivos !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  activeTab === 'archivos' ? 'bg-blue-700 text-white' : 'bg-neutral-800 text-gray-400'
                }`}>
                  {dataArchivos.total_archivos}
                </span>
              )}
            </button>
          </div>

          {/* Botón Expandir / Contraer Todo (solo en Evoluciones e Indicaciones) */}
          {((activeTab === 'evoluciones' && evolucionesFiltradas.length > 0) ||
            (activeTab === 'indicaciones' && indicacionesFiltradas.length > 0)) && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-[var(--border)] transition-colors"
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp size={14} className="text-amber-400" />
                  <span>Contraer todo</span>
                </>
              ) : (
                <>
                  <ChevronsUpDown size={14} className="text-emerald-400" />
                  <span>Expandir todo</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Barra de Filtro / Búsqueda */}
        {((activeTab === 'evoluciones' && evoluciones.length > 0) ||
          (activeTab === 'indicaciones' && indicaciones.length > 0) ||
          (activeTab === 'archivos' && archivos.length > 0)) && (
          <div className="px-5 py-2.5 border-b border-[var(--border)] bg-neutral-900/30 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
              <input
                type="text"
                placeholder={
                  activeTab === 'evoluciones'
                    ? "Buscar en evoluciones por diagnóstico, médico, texto..."
                    : activeTab === 'indicaciones'
                    ? "Buscar en indicaciones por fármaco, dosis, médico..."
                    : "Buscar en archivos por título, médico, ID..."
                }
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-950/60 border border-[var(--border)] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  Limpiar
                </button>
              )}
            </div>
            <span className="text-[11px] font-medium text-gray-400 shrink-0">
              {activeTab === 'evoluciones' && `${evolucionesFiltradas.length} de ${evoluciones.length}`}
              {activeTab === 'indicaciones' && `${indicacionesFiltradas.length} de ${indicaciones.length}`}
              {activeTab === 'archivos' && `${archivosFiltrados.length} de ${archivos.length}`}
            </span>
          </div>
        )}

        {/* Contenido Principal con Scroll */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          
          {/* ESTADO: CARGANDO */}
          {estaCargando && (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                <Loader2 size={26} className="animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {activeTab === 'evoluciones'
                    ? 'Consultando evoluciones médicas en Geclisa...'
                    : activeTab === 'indicaciones'
                    ? 'Consultando indicaciones y esquemas de medicación en Geclisa...'
                    : 'Consultando archivos y documentos en Geclisa...'}
                </p>
                <p className="text-xs text-[var(--secondary)] mt-0.5">
                  Conexión segura de solo lectura en vivo.
                </p>
              </div>
            </div>
          )}

          {/* ESTADO: ERROR */}
          {!estaCargando && errorActual && (
            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-200">Error de comunicación con Geclisa</p>
                <p>{errorActual}</p>
                <button
                  onClick={() => {
                    if (activeTab === 'evoluciones') cargarEvoluciones(true)
                    if (activeTab === 'indicaciones') cargarIndicaciones(true)
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <RefreshCw size={12} />
                  Reintentar consulta
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 1: EVOLUCIONES */}
          {/* ========================================================================= */}
          {!estaCargando && !errorActual && activeTab === 'evoluciones' && (
            <>
              {/* Sin Historia Clínica */}
              {dataHc && !dataHc.encontrado && (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
                  <div className="p-3.5 rounded-2xl bg-neutral-900 border border-[var(--border)] text-amber-400 shadow-inner">
                    <FileQuestion size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-white">
                      {dataHc.motivo === 'sin_dni' 
                        ? 'Falta el número de DNI' 
                        : 'Sin Historia Clínica en Geclisa'}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {dataHc.mensaje || 'Este paciente no registra ficha activa ni historia clínica en el sistema hospitalario.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Ficha encontrada pero sin evoluciones */}
              {dataHc?.encontrado && evoluciones.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-3 rounded-2xl bg-neutral-900 border border-[var(--border)] text-gray-400">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Sin Evoluciones Registradas</h4>
                    <p className="text-xs text-[var(--secondary)] mt-1 max-w-sm">
                      El paciente posee Ficha activa (#{dataHc.ficha_id}), pero no registra entradas de evolución médica recientes.
                    </p>
                  </div>
                </div>
              )}

              {/* Lista filtrada vacía */}
              {dataHc?.encontrado && evoluciones.length > 0 && evolucionesFiltradas.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs text-gray-400 font-medium">
                    No se encontraron evoluciones que coincidan con "<span className="text-white">{busqueda}</span>".
                  </p>
                  <button onClick={() => setBusqueda('')} className="text-xs text-rose-400 hover:underline font-semibold">
                    Restablecer filtro
                  </button>
                </div>
              )}

              {/* Listado de Evoluciones Colapsables (Acordeón) */}
              {dataHc?.encontrado && evolucionesFiltradas.length > 0 && (
                <div className="space-y-2.5">
                  {evolucionesFiltradas.map((ev) => {
                    const isExp = !!expandedItems[String(ev.hc_id)]
                    return (
                      <div
                        key={ev.hc_id}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isExp 
                            ? 'bg-neutral-900/90 border-rose-500/40 shadow-md' 
                            : 'bg-neutral-900/60 border-[var(--border)] hover:border-neutral-700'
                        }`}
                      >
                        {/* Cabecera Clickeable para Expandir / Contraer */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(ev.hc_id)}
                          className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                            {/* Fecha */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20 text-xs shrink-0">
                              <Calendar size={11} />
                              {ev.fecha}
                            </span>

                            {ev.hora && (
                              <span className="inline-flex items-center gap-1 text-gray-400 font-mono text-[11px] shrink-0">
                                <Clock size={10} />
                                {ev.hora} hs
                              </span>
                            )}

                            {/* Prestador */}
                            {ev.prestador && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-neutral-800 text-gray-200 border border-[var(--border)] font-medium text-[11px] truncate max-w-[200px]">
                                <UserCheck size={11} className="text-emerald-400 shrink-0" />
                                <span className="truncate">{ev.prestador}</span>
                              </span>
                            )}

                            {/* Plantilla / Especialidad */}
                            {ev.nombre_plantilla && (
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold truncate max-w-[150px]">
                                {ev.nombre_plantilla}
                              </span>
                            )}

                            {/* Preview de texto si está colapsado */}
                            {!isExp && ev.texto && (
                              <p className="text-[11px] text-gray-400 truncate flex-1 ml-1 hidden sm:block">
                                {ev.texto.replace(/\s+/g, ' ')}
                              </p>
                            )}
                          </div>

                          {/* Flecha Expandir / Contraer */}
                          <div className="text-gray-400 shrink-0 p-1 rounded-lg hover:text-white">
                            {isExp ? <ChevronUp size={16} className="text-rose-400" /> : <ChevronDown size={16} />}
                          </div>
                        </button>

                        {/* Contenido Expandido */}
                        {isExp && (
                          <div className="p-4 pt-1 border-t border-[var(--border)]/60 bg-neutral-950/60 animate-in fade-in duration-100">
                            {ev.especialidad && (
                              <p className="text-[10px] text-blue-400 font-medium mb-2 flex items-center gap-1">
                                <Stethoscope size={11} />
                                Especialidad: {ev.especialidad} {ev.area ? `(Área ${ev.area})` : ''}
                              </p>
                            )}
                            <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-gray-200 text-xs leading-relaxed whitespace-pre-wrap font-sans selection:bg-rose-500/30 selection:text-white">
                              {ev.texto || (
                                <span className="italic text-gray-500">Sin contenido de texto registrado en esta entrada.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 2: INDICACIONES */}
          {/* ========================================================================= */}
          {!estaCargando && !errorActual && activeTab === 'indicaciones' && (
            <>
              {/* Sin Indicaciones ni Ficha */}
              {dataInd && !dataInd.encontrado && (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
                  <div className="p-3.5 rounded-2xl bg-neutral-900 border border-[var(--border)] text-indigo-400 shadow-inner">
                    <FileQuestion size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-white">Sin Indicaciones Registradas</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {dataInd.mensaje || 'El paciente no posee indicaciones médicas, recetas ni protocolos activos en Geclisa.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Ficha encontrada pero sin indicaciones */}
              {dataInd?.encontrado && indicaciones.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-3 rounded-2xl bg-neutral-900 border border-[var(--border)] text-gray-400">
                    <Pill size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Sin Indicaciones Médicas</h4>
                    <p className="text-xs text-[var(--secondary)] mt-1 max-w-sm">
                      El paciente posee Ficha activa (#{dataInd.ficha_id}), pero no registra protocolos de medicación ni recetas emitidas.
                    </p>
                  </div>
                </div>
              )}

              {/* Lista filtrada vacía */}
              {dataInd?.encontrado && indicaciones.length > 0 && indicacionesFiltradas.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs text-gray-400 font-medium">
                    No se encontraron indicaciones que coincidan con "<span className="text-white">{busqueda}</span>".
                  </p>
                  <button onClick={() => setBusqueda('')} className="text-xs text-indigo-400 hover:underline font-semibold">
                    Restablecer filtro
                  </button>
                </div>
              )}

              {/* Listado de Indicaciones Colapsables (Acordeón) */}
              {dataInd?.encontrado && indicacionesFiltradas.length > 0 && (
                <div className="space-y-2.5">
                  {indicacionesFiltradas.map((ind, idx) => {
                    const itemKey = String(ind.id || idx)
                    const isExp = !!expandedItems[itemKey]

                    // Color de badge según tipo
                    const badgeColor = 
                      ind.tipo === 'MEDICACION_PROTOCOLO' 
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : ind.tipo === 'RECETA'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'

                    return (
                      <div
                        key={itemKey}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isExp 
                            ? 'bg-neutral-900/90 border-indigo-500/40 shadow-md' 
                            : 'bg-neutral-900/60 border-[var(--border)] hover:border-neutral-700'
                        }`}
                      >
                        {/* Cabecera Clickeable */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(itemKey)}
                          className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                            {/* Badge de Tipo */}
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${badgeColor} shrink-0`}>
                              {ind.tipo_label}
                            </span>

                            {/* Fecha */}
                            {ind.fecha && (
                              <span className="inline-flex items-center gap-1 text-gray-300 font-medium text-xs shrink-0">
                                <Calendar size={11} className="text-gray-400" />
                                {ind.fecha}
                              </span>
                            )}

                            {/* Título de la indicación / protocolo */}
                            <span className="font-bold text-white text-xs truncate max-w-[200px]">
                              {ind.titulo}
                            </span>

                            {/* Prestador */}
                            {ind.prestador && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-800 text-gray-300 border border-[var(--border)] text-[10px] truncate max-w-[150px]">
                                <UserCheck size={10} className="text-emerald-400 shrink-0" />
                                <span className="truncate">{ind.prestador}</span>
                              </span>
                            )}

                            {/* Preview si está colapsado */}
                            {!isExp && ind.texto && (
                              <p className="text-[11px] text-gray-400 truncate flex-1 ml-1 hidden sm:block">
                                {ind.texto.replace(/\s+/g, ' ')}
                              </p>
                            )}
                          </div>

                          {/* Flecha */}
                          <div className="text-gray-400 shrink-0 p-1 rounded-lg hover:text-white">
                            {isExp ? <ChevronUp size={16} className="text-indigo-400" /> : <ChevronDown size={16} />}
                          </div>
                        </button>

                        {/* Contenido Expandido */}
                        {isExp && (
                          <div className="p-4 pt-1 border-t border-[var(--border)]/60 bg-neutral-950/60 animate-in fade-in duration-100 space-y-2">
                            {ind.plantilla && (
                              <p className="text-[10px] text-indigo-300 font-semibold flex items-center gap-1">
                                <Layers size={11} />
                                Plantilla aplicada: {ind.plantilla}
                              </p>
                            )}
                            <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-gray-200 text-xs leading-relaxed whitespace-pre-wrap font-sans selection:bg-indigo-500/30 selection:text-white">
                              {ind.texto || (
                                <span className="italic text-gray-500">Sin indicaciones textuales registradas.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 3: ARCHIVOS Y DOCUMENTOS GECLISA */}
          {/* ========================================================================= */}
          {!estaCargando && !errorActual && activeTab === 'archivos' && (
            <>
              {/* Sin Ficha en Geclisa */}
              {dataArchivos && !dataArchivos.encontrado && (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
                  <div className="p-3.5 rounded-2xl bg-neutral-900 border border-[var(--border)] text-blue-400 shadow-inner">
                    <FileQuestion size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-white">Sin Archivos en Geclisa</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {dataArchivos.mensaje || 'El paciente no posee Ficha en Geclisa para listar archivos adjuntos.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Ficha encontrada pero sin archivos */}
              {dataArchivos?.encontrado && archivos.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-3 rounded-2xl bg-neutral-900 border border-[var(--border)] text-gray-400">
                    <FolderDown size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Sin Archivos Adjuntos</h4>
                    <p className="text-xs text-[var(--secondary)] mt-1 max-w-sm">
                      El paciente posee Ficha activa (#{dataArchivos.ficha_id}), pero aún no registra documentos, consentimientos ni protocolos subidos.
                    </p>
                  </div>
                </div>
              )}

              {/* Lista filtrada vacía */}
              {dataArchivos?.encontrado && archivos.length > 0 && archivosFiltrados.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <p className="text-xs text-gray-400 font-medium">
                    No se encontraron archivos que coincidan con "<span className="text-white">{busqueda}</span>".
                  </p>
                  <button onClick={() => setBusqueda('')} className="text-xs text-blue-400 hover:underline font-semibold">
                    Restablecer filtro
                  </button>
                </div>
              )}

              {/* Listado de Archivos en Geclisa */}
              {dataArchivos?.encontrado && archivosFiltrados.length > 0 && (
                <div className="space-y-2.5">
                  {archivosFiltrados.map((arc) => (
                    <div
                      key={arc.as_id}
                      className="p-3.5 rounded-2xl border bg-neutral-900/60 border-[var(--border)] hover:border-blue-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white text-xs truncate">
                              {arc.titulo || 'Documento sin título'}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 font-bold">
                              ID #{arc.as_id}
                            </span>
                            {arc.clase && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-gray-300 border border-[var(--border)]">
                                {arc.clase}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 font-mono mt-1">
                            {arc.fecha && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={10} className="text-gray-400" />
                                {arc.fecha}
                              </span>
                            )}
                            {arc.prestador && (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <UserCheck size={10} />
                                {arc.prestador}
                              </span>
                            )}
                            {arc.formato && (
                              <span className="text-gray-500 uppercase">
                                .{arc.formato}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Acciones de Archivo */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {arc.url && (
                          <a
                            href={arc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow transition-all"
                            title="Descargar o visualizar archivo"
                          >
                            <ExternalLink size={12} />
                            <span>Ver</span>
                          </a>
                        )}

                        <button
                          type="button"
                          disabled={eliminandoArchivoId === arc.as_id}
                          onClick={() => handleEliminarArchivo(arc.as_id)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                          title="Eliminar este archivo de la Historia Clínica de Geclisa"
                        >
                          {eliminandoArchivoId === arc.as_id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-neutral-900/70 text-xs">
          <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Consulta hospitalaria Geclisa (Solo lectura / No persistente)
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-[var(--border)] rounded-xl font-semibold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
