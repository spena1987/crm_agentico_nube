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
  Sparkles,
  ChevronDown
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import ConsolaCabeceraIntraoperatoria from './modal/ConsolaCabeceraIntraoperatoria'
import TabProgramacionLio from './modal/TabProgramacionLio'
import TabHistoriaClinicaGeclisa from './modal/TabHistoriaClinicaGeclisa'
import TabIndicacionesGeclisa from './modal/TabIndicacionesGeclisa'

type TabTipo = 'programacion' | 'historia_clinica' | 'indicaciones'

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
      } catch (e) {}
    }
    fetchLio()
  }, [])

  // Cargar Historia Clínica de Geclisa cuando se abre la pestaña 2
  const fetchHistoriaClinica = async () => {
    if (!turnoLocal?.paciente_id) return
    try {
      setCargandoHC(true)
      setErrorHC(null)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${turnoLocal.paciente_id}/historia-clinica`)
      const data = await res.json()
      if (res.ok && data.success) {
        setDatosHC(data.data || data)
      } else {
        throw new Error(data.detail || 'No se pudo cargar la Historia Clínica desde Geclisa.')
      }
    } catch (err: any) {
      console.error('Error cargando HC:', err)
      setErrorHC(err.message || 'Error de conexión con el servidor de Geclisa.')
    } finally {
      setCargandoHC(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'historia_clinica' && !datosHC && turnoLocal?.paciente_id) {
      fetchHistoriaClinica()
    }
  }, [activeTab, turnoLocal?.paciente_id, datosHC])

  // Cargar Indicaciones Médicas de Geclisa cuando se abre la pestaña 3
  const fetchIndicaciones = async () => {
    if (!turnoLocal?.paciente_id) return
    try {
      setCargandoInd(true)
      setErrorInd(null)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${turnoLocal.paciente_id}/indicaciones`)
      const data = await res.json()
      if (res.ok && data.success) {
        setDatosInd(data.data || data)
      } else {
        throw new Error(data.detail || 'No se pudieron cargar las Indicaciones Médicas desde Geclisa.')
      }
    } catch (err: any) {
      console.error('Error cargando Indicaciones:', err)
      setErrorInd(err.message || 'Error de conexión con el servidor de Geclisa.')
    } finally {
      setCargandoInd(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'indicaciones' && !datosInd && turnoLocal?.paciente_id) {
      fetchIndicaciones()
    }
  }, [activeTab, turnoLocal?.paciente_id, datosInd])

  // Cambiar estado del turno en tiempo real
  const handleCambiarEstado = async (nuevoEstado: string) => {
    if (!turnoLocal?.id) return
    try {
      setProcesandoEstado(true)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoLocal.id}/cambiar-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const tUpd = data.turno || { ...turnoLocal, estado: nuevoEstado }
        setTurnoLocal(tUpd)
        if (onEstadoCambiado) onEstadoCambiado(turnoLocal.id, nuevoEstado, tUpd)
      } else {
        alert(data.detail || 'Error al cambiar estado del turno')
      }
    } catch (e) {
      console.error('Error al cambiar estado:', e)
    } finally {
      setProcesandoEstado(false)
    }
  }

  // Guardar Cambios en la Ficha de Programación
  const handleGuardarProgramacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!turnoLocal?.id) return
    try {
      setGuardandoProg(true)
      setMensajeExitoProg(null)

      const payload = {
        quirofano_id: formData.quirofano_id,
        ojo: formData.ojo,
        tipo_anestesia: formData.tipo_anestesia,
        cirujano_nombre: formData.cirujano_nombre,
        ayudante_nombre: formData.ayudante_nombre,
        anestesiologo_nombre: formData.anestesiologo_nombre,
        instrumentador_nombre: formData.instrumentador_nombre,
        lleva_lente: formData.lleva_lente,
        lente_tipo: formData.lente_tipo,
        lente_dioptria: formData.lente_dioptria,
        es_torico: formData.es_torico,
        lente_torico_valor: formData.lente_torico_valor,
        lente_torico_eje: formData.lente_torico_eje,
        lente_lote: formData.lente_lote,
        lente_serie: formData.lente_serie,
        observaciones: formData.observaciones,
        observaciones_intraoperatorias: formData.observaciones_intraoperatorias
      }

      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoLocal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
          />
        </div>

        {/* Barra de 3 Pestañas */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-[var(--border)] bg-slate-50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('programacion')}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'programacion'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Calendar size={15} />
            <span>1. Programación & LIO</span>
          </button>

          <button
            onClick={() => setActiveTab('historia_clinica')}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'historia_clinica'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <FileHeart size={15} />
            <span>2. Historia Clínica (Geclisa)</span>
          </button>

          <button
            onClick={() => setActiveTab('indicaciones')}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'indicaciones'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-xl shadow-sm'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Pill size={15} />
            <span>3. Indicaciones Médicas (Geclisa)</span>
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
              onRecargar={fetchHistoriaClinica}
            />
          )}

          {activeTab === 'indicaciones' && (
            <TabIndicacionesGeclisa
              cargando={cargandoInd}
              datosInd={datosInd}
              errorInd={errorInd}
              filtroTexto={filtroTextoInd}
              setFiltroTexto={setFiltroTextoInd}
              onRecargar={fetchIndicaciones}
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
    </div>
  )
}