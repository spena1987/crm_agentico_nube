'use client'

import React, { useState, useEffect } from 'react'
import { 
  FileHeart, 
  RefreshCw, 
  Loader2, 
  Search, 
  Calendar, 
  Clock, 
  UserCheck, 
  AlertCircle, 
  FileQuestion,
  ChevronDown,
  ChevronUp,
  FileText,
  Pill,
  ChevronsUpDown,
  ChevronsDownUp,
  FolderDown,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
  X
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
  tipo: string
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
  hora?: string
  titulo: string
  prestador: string
  clase: string
  formato: string
  url?: string
}

interface TabGeclisaLegadoProps {
  paciente: {
    id: string
    nombre: string
    dni?: string | null
    geclisa_ficha_id?: number | null
  }
}

export default function TabGeclisaLegado({ paciente }: TabGeclisaLegadoProps) {
  const [activeTab, setActiveTab] = useState<TabTipo>('evoluciones')
  const [cargandoEvoluciones, setCargandoEvoluciones] = useState(false)
  const [cargandoIndicaciones, setCargandoIndicaciones] = useState(false)
  const [cargandoArchivos, setCargandoArchivos] = useState(false)

  const [dataHc, setDataHc] = useState<{ evoluciones_recientes?: EvolucionClinica[] } | null>(null)
  const [dataInd, setDataInd] = useState<{ indicaciones?: IndicacionMedica[] } | null>(null)
  const [dataArchivos, setDataArchivos] = useState<{ archivos: ArchivoGeclisa[] } | null>(null)

  const [errorHc, setErrorHc] = useState('')
  const [errorInd, setErrorInd] = useState('')
  const [errorArchivos, setErrorArchivos] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const [archivoVisor, setArchivoVisor] = useState<ArchivoGeclisa | null>(null)
  const [visorPantallaCompleta, setVisorPantallaCompleta] = useState(false)

  const queryId = paciente.geclisa_ficha_id || paciente.id || paciente.dni

  useEffect(() => {
    cargarEvoluciones()
  }, [paciente.id, paciente.geclisa_ficha_id])

  const cargarEvoluciones = async () => {
    if (!queryId) return
    setCargandoEvoluciones(true)
    setErrorHc('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(queryId)}/historia-clinica`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setDataHc(data)
    } catch (err: any) {
      setErrorHc(err.message || 'No se pudo conectar con Geclisa.')
    } finally {
      setCargandoEvoluciones(false)
    }
  }

  const cargarIndicaciones = async () => {
    if (!queryId) return
    setCargandoIndicaciones(true)
    setErrorInd('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(queryId)}/indicaciones`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setDataInd(data)
    } catch (err: any) {
      setErrorInd(err.message || 'No se pudo conectar con Geclisa.')
    } finally {
      setCargandoIndicaciones(false)
    }
  }

  const cargarArchivos = async () => {
    if (!queryId) return
    setCargandoArchivos(true)
    setErrorArchivos('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(queryId)}/archivos`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setDataArchivos(data)
    } catch (err: any) {
      setErrorArchivos(err.message || 'No se pudo conectar con Geclisa.')
    } finally {
      setCargandoArchivos(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-3 text-[#16323f]">
      {/* Selector de subpestañas */}
      <div className="flex items-center justify-between border-b border-[#dde6ec] pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('evoluciones'); if (!dataHc) cargarEvoluciones() }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'evoluciones'
                ? 'bg-[#0e7c86] text-white shadow-sm'
                : 'bg-white border border-[#dde6ec] text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            <FileHeart className="w-3.5 h-3.5" />
            Evoluciones Geclisa
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('indicaciones'); if (!dataInd) cargarIndicaciones() }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'indicaciones'
                ? 'bg-[#0e7c86] text-white shadow-sm'
                : 'bg-white border border-[#dde6ec] text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            Indicaciones Geclisa
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('archivos'); if (!dataArchivos) cargarArchivos() }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'archivos'
                ? 'bg-[#0e7c86] text-white shadow-sm'
                : 'bg-white border border-[#dde6ec] text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            <FolderDown className="w-3.5 h-3.5" />
            Archivos Geclisa
          </button>
        </div>

        {/* Buscador */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#9db0bc]" />
          <input
            type="text"
            placeholder="Buscar en Geclisa..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs border border-[#dde6ec] rounded-lg bg-white outline-none focus:border-[#0e7c86]"
          />
        </div>
      </div>

      {/* Contenido según subpestaña */}
      {activeTab === 'evoluciones' && (
        <div className="space-y-2">
          {cargandoEvoluciones ? (
            <div className="py-12 text-center text-xs text-[#728a99] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0e7c86]" />
              Consultando evoluciones en Geclisa...
            </div>
          ) : errorHc ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs border border-red-200">
              {errorHc}
            </div>
          ) : dataHc?.evoluciones_recientes?.length ? (
            dataHc.evoluciones_recientes.map(ev => {
              const isExpanded = expandedItems[`ev_${ev.hc_id}`] !== false
              const isCrm = ev.texto?.includes('CRM Oftalmológico') || (ev as any).origen === 'crm' || (ev as any).es_crm
              return (
                <div key={ev.hc_id} className="bg-white border border-[#dde6ec] rounded-lg p-3 text-xs shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-[#0e7c86]">{ev.fecha}</span>
                      <span className="text-[10px] text-[#728a99]">{ev.hora}</span>
                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-semibold text-gray-700">
                        {ev.prestador} ({ev.especialidad || 'Oftalmología'})
                      </span>
                      {isCrm ? (
                        <span className="text-[9.5px] bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4] px-2 py-0.5 rounded-full font-black">
                          CRM Oftalmológico • hcId #{ev.hc_id}
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                          Geclisa Escritorio • hcId #{ev.hc_id}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleExpand(`ev_${ev.hc_id}`)}
                      className="text-[#728a99] hover:text-[#16323f]"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="bg-[#f7fafb] p-3 rounded border border-[#eef3f6] font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                      {ev.texto}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="py-8 text-center text-xs text-[#728a99] italic">
              No se encontraron evoluciones registradas en Geclisa para este paciente.
            </div>
          )}
        </div>
      )}

      {activeTab === 'indicaciones' && (
        <div className="space-y-2">
          {cargandoIndicaciones ? (
            <div className="py-12 text-center text-xs text-[#728a99] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0e7c86]" />
              Consultando indicaciones en Geclisa...
            </div>
          ) : errorInd ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs border border-red-200">
              {errorInd}
            </div>
          ) : dataInd?.indicaciones?.length ? (
            dataInd.indicaciones.map(ind => (
              <div key={ind.id} className="bg-white border border-[#dde6ec] rounded-lg p-3 text-xs shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#1a7f4b]">{ind.fecha} {ind.hora}</span>
                    <span className="text-[10px] bg-[#e6f5ec] text-[#1a7f4b] font-bold px-2 py-0.5 rounded">
                      {ind.tipo_label || ind.tipo}
                    </span>
                    <span className="text-[10px] text-[#728a99]">{ind.prestador}</span>
                  </div>
                </div>
                <div className="font-bold text-[#16323f]">{ind.titulo}</div>
                <div className="bg-[#f7fafb] p-2.5 rounded border border-[#eef3f6] whitespace-pre-wrap text-[11px]">
                  {ind.texto}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-[#728a99] italic">
              No hay indicaciones registradas en Geclisa para este paciente.
            </div>
          )}
        </div>
      )}

      {activeTab === 'archivos' && (
        <div className="space-y-2">
          {cargandoArchivos ? (
            <div className="py-12 text-center text-xs text-[#728a99] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0e7c86]" />
              Consultando archivos en Geclisa...
            </div>
          ) : errorArchivos ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs border border-red-200">
              {errorArchivos}
            </div>
          ) : dataArchivos?.archivos?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {dataArchivos.archivos.map(arch => (
                <div
                  key={arch.as_id}
                  className="bg-white border border-[#dde6ec] hover:border-[#0e7c86] rounded-lg p-3 text-xs shadow-sm flex items-center justify-between transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#16323f] truncate max-w-xs">{arch.titulo}</div>
                    <div className="text-[10px] text-[#728a99]">
                      {arch.fecha} · {arch.clase} ({arch.formato})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setArchivoVisor(arch)}
                    className="px-2.5 py-1 bg-[#e4f3f4] text-[#0e7c86] font-bold rounded hover:bg-[#c3e2e4] text-xs flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#728a99] italic">
              No hay archivos adjuntos en Geclisa para este paciente.
            </div>
          )}
        </div>
      )}

      {/* Visor modal de archivo */}
      {archivoVisor && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden ${
            visorPantallaCompleta ? 'w-full h-full' : 'w-full max-w-4xl h-[85vh]'
          }`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-[#f7fafb]">
              <span className="font-bold text-xs truncate max-w-md">{archivoVisor.titulo}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisorPantallaCompleta(!visorPantallaCompleta)}
                  className="p-1 text-[#728a99] hover:text-[#16323f]"
                >
                  {visorPantallaCompleta ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setArchivoVisor(null)}
                  className="p-1 text-[#728a99] hover:text-[#16323f]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 p-2">
              <iframe
                src={`${BACKEND_URL}/api/geclisa/archivos/${archivoVisor.as_id}/ver`}
                className="w-full h-full rounded border border-gray-300"
                title={archivoVisor.titulo}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

