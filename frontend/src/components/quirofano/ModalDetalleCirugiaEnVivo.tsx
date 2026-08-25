'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Clock,
  User,
  Scissors,
  FileHeart,
  Pill,
  FolderDown,
  Sparkles,
  ChevronDown,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Loader2,
  FileText
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import ConsolaCabeceraIntraoperatoria from './modal/ConsolaCabeceraIntraoperatoria'
import TabProgramacionLio from './modal/TabProgramacionLio'
import TabHistoriaClinicaGeclisa from './modal/TabHistoriaClinicaGeclisa'
import TabIndicacionesGeclisa from './modal/TabIndicacionesGeclisa'
import TabArchivosGeclisa, { ArchivoGeclisa } from './modal/TabArchivosGeclisa'

type TabTipo = 'programacion' | 'historia_clinica' | 'indicaciones' | 'archivos'

interface ModalDetalleCirugiaEnVivoProps {
  isOpen: boolean
  onClose: () => void
  turno: any
  quirofanos: any[]
  onEstadoCambiado?: (turnoId: string, nuevoEstado: string, turnoActualizado: any) => void
  onTurnoGuardado?: (turnoActualizado: any) => void
}

export default function ModalDetalleCirugiaEnVivo({
  isOpen,
  onClose,
  turno,
  quirofanos,
  onEstadoCambiado,
  onTurnoGuardado
}: ModalDetalleCirugiaEnVivoProps) {
  const [activeTab, setActiveTab] = useState<TabTipo>('programacion')
  const [procesandoEstado, setProcesandoEstado] = useState(false)
  const [turnoLocal, setTurnoLocal] = useState<any>(turno || {})

  // Pestaña 2: Historia Clínica
  const [cargandoHC, setCargandoHC] = useState(false)
  const [datosHC, setDatosHC] = useState<any | null>(null)
  const [errorHC, setErrorHC] = useState<string | null>(null)
  const [filtroTextoHC, setFiltroTextoHC] = useState('')

  // Pestaña 3: Indicaciones Médicas
  const [cargandoInd, setCargandoInd] = useState(false)
  const [datosInd, setDatosInd] = useState<any | null>(null)
  const [errorInd, setErrorInd] = useState<string | null>(null)
  const [filtroTextoInd, setFiltroTextoInd] = useState('')

  // Pestaña 4: Archivos y Estudios en PDF
  const [cargandoArchivos, setCargandoArchivos] = useState(false)
  const [datosArchivos, setDatosArchivos] = useState<any | null>(null)
  const [errorArchivos, setErrorArchivos] = useState<string | null>(null)
  const [filtroTextoArchivos, setFiltroTextoArchivos] = useState('')
  const [eliminandoArchivoId, setEliminandoArchivoId] = useState<number | null>(null)

  // Visor Modal In-App
  const [archivoVisor, setArchivoVisor] = useState<ArchivoGeclisa | null>(null)
  const [cargandoVisor, setCargandoVisor] = useState(false)
  const [visorPantallaCompleta, setVisorPantallaCompleta] = useState(false)

  // Pestaña 1: Edición de Programación
  const [formData, setFormData] = useState<any>({
    quirofano_id: '',
    fecha_cirugia: '',
    hora_inicio: '',
    duracion_minutos: 20,
    ojo: 'OD',
    cirujano_nombre: '',
    ayudante_nombre: '',
    anestesiologo_nombre: '',
    instrumentador_nombre: '',
    medico_derivador_nombre: '',
    lleva_lente: false,
    lente_tipo: '',
    lente_dioptria: '',
    es_torico: false,
    lente_torico_valor: 0,
    lente_torico_eje: 90,
    lente_lote: '',
    lente_serie: '',
    tipo_anestesia: 'Tópica + Sedación',
    observaciones: '',
    observaciones_intraoperatorias: ''
  })
  const [guardandoProg, setGuardandoProg] = useState(false)
  const [mensajeExitoProg, setMensajeExitoProg] = useState<string | null>(null)
  const [modelosLio, setModelosLio] = useState<any[]>([])

  // Sincronizar datos al abrir o cambiar turno
  useEffect(() => {
    if (turno) {
      setTurnoLocal(turno)
      setFormData({
        quirofano_id: turno.quirofano_id || '',
        fecha_cirugia: turno.fecha_cirugia || '',
        hora_inicio: String(turno.hora_inicio || '').slice(0, 5),
        duracion_minutos: turno.duracion_minutos || 20,
        ojo: turno.ojo || 'OD',
        cirujano_nombre: turno.cirujano_nombre || '',
        ayudante_nombre: turno.ayudante_nombre || '',
        anestesiologo_nombre: turno.anestesiologo_nombre || '',
        instrumentador_nombre: turno.instrumentador_nombre || '',
        medico_derivador_nombre: turno.medico_derivador_nombre || '',
        lleva_lente: turno.lleva_lente || false,
        lente_tipo: turno.lente_tipo || '',
        lente_dioptria: turno.lente_dioptria || '',
        es_torico: turno.es_torico || false,
        lente_torico_valor: turno.lente_torico_valor || 0,
        lente_torico_eje: turno.lente_torico_eje || 90,
        lente_lote: turno.lente_lote || '',
        lente_serie: turno.lente_serie || '',
        tipo_anestesia: turno.tipo_anestesia || 'Tópica + Sedación',
        observaciones: turno.observaciones || '',
        observaciones_intraoperatorias: turno.observaciones_intraoperatorias || ''
      })
    }
  }, [turno])

  // Cargar catálogo de modelos LIO
  useEffect(() => {
    const fetchLio = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/modelos-lio`)
        const data = await res.json()
        if (data.success && data.modelos) {
          setModelosLio(data.modelos)
        }
      } catch (err) {
        console.error('Error cargando modelos LIO:', err)
      }
    }
    fetchLio()
  }, [])

  // Resolver ID de consulta para Geclisa (Ficha ID, DNI o Paciente ID)
  const getQueryId = () => {
    const pac = turnoLocal?.pacientes || {}
    return pac.geclisa_ficha_id || pac.dni || pac.id || turnoLocal.paciente_id
  }

  // 1. Cargar Historia Clínica de Geclisa
  const fetchHistoriaClinica = async (force = false) => {
    if (datosHC && !force) return
    const qId = getQueryId()
    if (!qId) {
      setErrorHC('No hay identificador de paciente o DNI para consultar en Geclisa.')
      return
    }
    try {
      setCargandoHC(true)
      setErrorHC(null)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(qId)}/historia-clinica`)
      const data = await res.json()
      if (res.ok) {
        setDatosHC(data)
      } else {
        setErrorHC(data.detail || data.mensaje || 'No se pudo obtener la historia clínica.')
      }
    } catch (err: any) {
      setErrorHC(err.message || 'Error de conexión con Geclisa.')
    } finally {
      setCargandoHC(false)
    }
  }

  // 2. Cargar Indicaciones Médicas de Geclisa
  const fetchIndicaciones = async (force = false) => {
    if (datosInd && !force) return
    const qId = getQueryId()
    if (!qId) {
      setErrorInd('No hay identificador de paciente o DNI para consultar en Geclisa.')
      return
    }
    try {
      setCargandoInd(true)
      setErrorInd(null)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(qId)}/indicaciones`)
      const data = await res.json()
      if (res.ok) {
        setDatosInd(data)
      } else {
        setErrorInd(data.detail || data.mensaje || 'No se pudieron obtener las indicaciones médicas.')
      }
    } catch (err: any) {
      setErrorInd(err.message || 'Error de conexión con Geclisa.')
    } finally {
      setCargandoInd(false)
    }
  }

  // 3. Cargar Archivos y Estudios en PDF de Geclisa
  const fetchArchivos = async (force = false) => {
    if (datosArchivos && !force) return
    const qId = getQueryId()
    if (!qId) {
      setErrorArchivos('No hay identificador de paciente o DNI para consultar archivos en Geclisa.')
      return
    }
    try {
      setCargandoArchivos(true)
      setErrorArchivos(null)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(qId)}/archivos`)
      const data = await res.json()
      if (res.ok) {
        setDatosArchivos(data)
      } else {
        setErrorArchivos(data.detail || data.mensaje || 'No se pudieron obtener los archivos adjuntos.')
      }
    } catch (err: any) {
      setErrorArchivos(err.message || 'Error de conexión con Geclisa.')
    } finally {
      setCargandoArchivos(false)
    }
  }

  // Carga reactiva de datos al cambiar pestaña
  useEffect(() => {
    if (!isOpen) return
    if (activeTab === 'historia_clinica') {
      fetchHistoriaClinica()
    } else if (activeTab === 'indicaciones') {
      fetchIndicaciones()
    } else if (activeTab === 'archivos') {
      fetchArchivos()
    }
  }, [activeTab, isOpen])

  // Eliminar Archivo de Geclisa
  const handleEliminarArchivo = async (asId: number) => {
    if (!confirm(`¿Desea eliminar el archivo ID #${asId} de la Historia Clínica de Geclisa?`)) {
      return
    }
    try {
      setEliminandoArchivoId(asId)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/archivos/${asId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setDatosArchivos((prev: any) => {
          if (!prev) return prev
          const filtrados = (prev.archivos || []).filter((a: any) => a.as_id !== asId)
          return { ...prev, archivos: filtrados, total_archivos: filtrados.length }
        })
      } else {
        const data = await res.json()
        alert(data.detail || 'Error al eliminar el archivo en Geclisa')
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión')
    } finally {
      setEliminandoArchivoId(null)
    }
  }

  // Cambiar estado intraoperatorio
  const handleCambiarEstado = async (nuevoEstado: string) => {
    try {
      setProcesandoEstado(true)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoLocal.id}/cambiar-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const turnoActualizado = { ...turnoLocal, estado: nuevoEstado, ...data.turno }
        setTurnoLocal(turnoActualizado)
        if (onEstadoCambiado) {
          onEstadoCambiado(turnoLocal.id, nuevoEstado, turnoActualizado)
        }
        if (onTurnoGuardado) {
          onTurnoGuardado(turnoActualizado)
        }
      } else {
        alert(data.detail || data.error || 'Error al actualizar estado')
      }
    } catch (err) {
      console.error('Error al actualizar estado:', err)
    } finally {
      setProcesandoEstado(false)
    }
  }

  // Guardar cambios de programación & LIO
  const handleGuardarProgramacion = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setGuardandoProg(true)
      setMensajeExitoProg(null)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoLocal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExitoProg('Cambios guardados con éxito en Quirófano y Asesoría.')
        setTurnoLocal(data.turno)
        if (onTurnoGuardado) onTurnoGuardado(data.turno)
        setTimeout(() => setMensajeExitoProg(null), 3000)
      } else {
        alert(data.detail || 'Error al guardar cambios de programación')
      }
    } catch (err) {
      console.error('Error guardando programación:', err)
    } finally {
      setGuardandoProg(false)
    }
  }

  if (!isOpen || !turno) return null

  const paciente = turnoLocal?.pacientes || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6 animate-fade-in">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabecera Principal */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-sm border border-blue-500/20">
              Qx
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-wider font-extrabold text-blue-600">
                  {turnoLocal.quirofanos?.nombre || 'Quirófano Central'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-[var(--secondary)] font-medium">
                  {turnoLocal.fecha_cirugia} • {String(turnoLocal.hora_inicio || '').slice(0, 5)} hs
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] tracking-tight">
                {turnoLocal.practica_nombre || 'Cirugía Oftalmológica'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={22} />
          </button>
        </div>

        {/* Consola Intraoperatoria Superior */}
        <div className="p-4 bg-slate-950 border-b border-slate-800">
          <ConsolaCabeceraIntraoperatoria
            turno={turnoLocal}
            onCambiarEstado={handleCambiarEstado}
            procesandoEstado={procesandoEstado}
            onTurnoActualizado={(tUpd) => {
              setTurnoLocal(tUpd)
              if (onTurnoGuardado) onTurnoGuardado(tUpd)
            }}
          />
        </div>

        {/* Barra de 4 Pestañas */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3 border-b border-[var(--border)] bg-slate-50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('programacion')}
            className={`px-3.5 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'programacion'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Calendar size={14} />
            <span>1. Programación & LIO</span>
          </button>

          <button
            onClick={() => setActiveTab('historia_clinica')}
            className={`px-3.5 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'historia_clinica'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <FileHeart size={14} />
            <span>2. Historia Clínica (Geclisa)</span>
          </button>

          <button
            onClick={() => setActiveTab('indicaciones')}
            className={`px-3.5 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'indicaciones'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Pill size={14} />
            <span>3. Indicaciones Médicas (Geclisa)</span>
          </button>

          <button
            onClick={() => setActiveTab('archivos')}
            className={`px-3.5 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'archivos'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <FolderDown size={14} />
            <span>4. Archivos / PDFs (Geclisa)</span>
            {datosArchivos?.total_archivos !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'archivos' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {datosArchivos.total_archivos}
              </span>
            )}
          </button>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'programacion' && (
            <TabProgramacionLio
              turno={turnoLocal}
              formData={formData}
              setFormData={setFormData}
              quirofanos={quirofanos}
              modelosLio={modelosLio}
              guardando={guardandoProg}
              onGuardar={handleGuardarProgramacion}
              mensajeExito={mensajeExitoProg}
            />
          )}

          {activeTab === 'historia_clinica' && (
            <TabHistoriaClinicaGeclisa
              cargando={cargandoHC}
              datosHC={datosHC}
              errorHC={errorHC}
              filtroTexto={filtroTextoHC}
              setFiltroTexto={setFiltroTextoHC}
              onRecargar={() => fetchHistoriaClinica(true)}
            />
          )}

          {activeTab === 'indicaciones' && (
            <TabIndicacionesGeclisa
              cargando={cargandoInd}
              datosInd={datosInd}
              errorInd={errorInd}
              filtroTexto={filtroTextoInd}
              setFiltroTexto={setFiltroTextoInd}
              onRecargar={() => fetchIndicaciones(true)}
            />
          )}

          {activeTab === 'archivos' && (
            <TabArchivosGeclisa
              cargando={cargandoArchivos}
              dataArchivos={datosArchivos}
              errorArchivos={errorArchivos}
              filtroTexto={filtroTextoArchivos}
              setFiltroTexto={setFiltroTextoArchivos}
              onRecargar={() => fetchArchivos(true)}
              onVerArchivo={(arc) => {
                setArchivoVisor(arc)
                setCargandoVisor(true)
              }}
              onEliminarArchivo={handleEliminarArchivo}
              eliminandoArchivoId={eliminandoArchivoId}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--secondary)]">
          <div className="flex items-center gap-2 font-mono">
            <span>ID: {String(turnoLocal.id || '').slice(0, 8)}...</span>
            <span>•</span>
            <span>Cirujano: {turnoLocal.cirujano_nombre || 'Asignado'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-[var(--border)] hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-[var(--foreground)] transition"
          >
            Cerrar Ficha
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* VISOR MODAL IN-APP DE ARCHIVOS Y ESTUDIOS GECLISA EN PANTALLA COMPLETA */}
      {/* ========================================================================= */}
      {archivoVisor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className={`bg-slate-950 border border-slate-800 flex flex-col shadow-2xl transition-all duration-200 overflow-hidden ${
              visorPantallaCompleta
                ? 'w-full h-full rounded-none'
                : 'w-full max-w-5xl h-[90vh] rounded-3xl'
            }`}
          >
            {/* Cabecera del Visor */}
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white truncate">
                      {archivoVisor.titulo || 'Estudio / Documento Clínico'}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 font-bold">
                      ID #{archivoVisor.as_id}
                    </span>
                    {archivoVisor.clase && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {archivoVisor.clase}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                    <span className="text-slate-200 font-medium">{paciente.nombre}</span>
                    {archivoVisor.fecha && <span>• Fecha: {archivoVisor.fecha} {archivoVisor.hora || ''}</span>}
                    {archivoVisor.prestador && <span className="text-emerald-400">• {archivoVisor.prestador}</span>}
                  </p>
                </div>
              </div>

              {/* Botones de Acción del Visor */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`${BACKEND_URL}/api/geclisa/archivos/${archivoVisor.as_id}/descargar?nombre=${encodeURIComponent(archivoVisor.titulo || 'estudio')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Descargar archivo al ordenador"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Descargar</span>
                </a>

                <a
                  href={`${BACKEND_URL}/api/geclisa/archivos/${archivoVisor.as_id}/ver`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Abrir en pestaña nueva del navegador"
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Pestaña</span>
                </a>

                <button
                  type="button"
                  onClick={() => setVisorPantallaCompleta(!visorPantallaCompleta)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                  title={visorPantallaCompleta ? 'Restaurar tamaño' : 'Pantalla completa'}
                >
                  {visorPantallaCompleta ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => setArchivoVisor(null)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors ml-1"
                  title="Cerrar visor"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Cuerpo del Visor con Iframe */}
            <div className="flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden">
              {cargandoVisor && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3 text-center p-4">
                  <Loader2 size={32} className="text-blue-500 animate-spin" />
                  <p className="text-xs text-slate-300 font-medium">
                    Cargando documento en alta resolución desde Geclisa...
                  </p>
                </div>
              )}

              <iframe
                src={`${BACKEND_URL}/api/geclisa/archivos/${archivoVisor.as_id}/ver`}
                className="w-full h-full border-0 bg-white"
                title={archivoVisor.titulo || 'Visor de Archivo'}
                onLoad={() => setCargandoVisor(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
