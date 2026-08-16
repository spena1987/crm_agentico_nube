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
  Sparkles
} from 'lucide-react'

import { BACKEND_URL } from '@/lib/api'

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
  const [cargando, setCargando] = useState<boolean>(false)
  const [dataHc, setDataHc] = useState<HistoriaClinicaResponse | null>(null)
  const [errorLocal, setErrorLocal] = useState<string>('')
  const [busqueda, setBusqueda] = useState<string>('')

  // Cargar historia clínica al abrir
  useEffect(() => {
    if (isOpen && paciente?.id) {
      cargarHistoriaClinica()
    } else {
      setDataHc(null)
      setErrorLocal('')
      setBusqueda('')
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

  const cargarHistoriaClinica = async () => {
    const queryId = paciente?.id || paciente?.dni || paciente?.geclisa_ficha_id
    if (!queryId) {
      setErrorLocal('El paciente no cuenta con ID ni DNI para consultar en Geclisa.')
      return
    }

    setCargando(true)
    setErrorLocal('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${encodeURIComponent(queryId)}/historia-clinica`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.mensaje || `Error al consultar Geclisa (HTTP ${res.status})`)
      }
      const data: HistoriaClinicaResponse = await res.json()
      setDataHc(data)
    } catch (err: any) {
      console.error('Error al obtener historia clínica:', err)
      setErrorLocal(err.message || 'No se pudo conectar con el servidor de Geclisa.')
    } finally {
      setCargando(false)
    }
  }

  if (!isOpen || !paciente) return null

  // Filtrado de evoluciones por búsqueda
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header del Pop-up */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-inner">
              <FileHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Historia Clínica
                </h3>
                {dataHc?.ficha_id && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    Ficha #{dataHc.ficha_id}
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
              onClick={cargarHistoriaClinica}
              disabled={cargando}
              title="Actualizar en vivo desde Geclisa"
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-[var(--border)] disabled:opacity-50"
            >
              <RefreshCw size={16} className={cargando ? 'animate-spin text-rose-400' : ''} />
            </button>
            <button
              onClick={onClose}
              disabled={cargando}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-[var(--border)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Filtro / Búsqueda */}
        {dataHc?.encontrado && evoluciones.length > 0 && (
          <div className="px-5 py-3 border-b border-[var(--border)] bg-neutral-900/40 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type="text"
                placeholder="Buscar por diagnóstico, médico, medicación o fecha..."
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
              {evolucionesFiltradas.length} de {evoluciones.length} evoluciones
            </span>
          </div>
        )}

        {/* Contenido Principal con Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* ESTADO 1: CARGANDO */}
          {cargando && (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                <Loader2 size={26} className="animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Consultando en vivo a Geclisa...</p>
                <p className="text-xs text-[var(--secondary)] mt-0.5">
                  Extrayendo las notas de evolución médica del servidor hospitalario.
                </p>
              </div>
            </div>
          )}

          {/* ESTADO 2: ERROR DE CONEXIÓN */}
          {!cargando && errorLocal && (
            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-200">Error de comunicación</p>
                <p>{errorLocal}</p>
                <button
                  onClick={cargarHistoriaClinica}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <RefreshCw size={12} />
                  Reintentar consulta
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 3: PACIENTE NO TIENE HISTORIA CLÍNICA / NO ENCONTRADO */}
          {!cargando && !errorLocal && dataHc && !dataHc.encontrado && (
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
              {dataHc.motivo === 'sin_dni' && (
                <p className="text-[11px] text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                  Edita el paciente e ingresa su DNI para vincularlo automáticamente.
                </p>
              )}
            </div>
          )}

          {/* ESTADO 4: PACIENTE CON HISTORIA CLÍNICA PERO SIN NOTAS RECIENTES */}
          {!cargando && !errorLocal && dataHc?.encontrado && evoluciones.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-2xl bg-neutral-900 border border-[var(--border)] text-gray-400">
                <Sparkles size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Sin Evoluciones Recientes</h4>
                <p className="text-xs text-[var(--secondary)] mt-1 max-w-sm">
                  El paciente posee Ficha activa (#{dataHc.ficha_id}), pero no registra entradas de evolución médica en su expediente hospitalario.
                </p>
              </div>
            </div>
          )}

          {/* ESTADO 5: LISTADO DE EVOLUCIONES FILTRADAS VACÍO */}
          {!cargando && !errorLocal && dataHc?.encontrado && evoluciones.length > 0 && evolucionesFiltradas.length === 0 && (
            <div className="py-10 text-center space-y-2">
              <p className="text-xs text-gray-400 font-medium">
                No se encontraron notas médicas que coincidan con "<span className="text-white">{busqueda}</span>".
              </p>
              <button
                onClick={() => setBusqueda('')}
                className="text-xs text-rose-400 hover:underline font-semibold"
              >
                Restablecer filtro
              </button>
            </div>
          )}

          {/* ESTADO 6: LISTADO DE EVOLUCIONES MÉDICAS (TIMELINE) */}
          {!cargando && !errorLocal && dataHc?.encontrado && evolucionesFiltradas.length > 0 && (
            <div className="space-y-3.5">
              {evolucionesFiltradas.map((ev, idx) => (
                <div
                  key={ev.hc_id || idx}
                  className="p-4 rounded-2xl bg-neutral-900/70 border border-[var(--border)] hover:border-neutral-700 transition-all space-y-2.5 shadow-sm"
                >
                  {/* Encabezado de la nota de evolución */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    
                    {/* Fecha y Hora */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">
                        <Calendar size={12} />
                        {ev.fecha}
                      </span>
                      {ev.hora && (
                        <span className="inline-flex items-center gap-1 text-gray-400 font-mono text-[11px]">
                          <Clock size={11} />
                          {ev.hora} hs
                        </span>
                      )}
                    </div>

                    {/* Prestador / Especialidad */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ev.prestador && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 text-gray-200 border border-[var(--border)] font-medium text-[11px]">
                          <UserCheck size={12} className="text-emerald-400" />
                          {ev.prestador}
                        </span>
                      )}
                      {ev.especialidad && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-800 text-gray-400 border border-[var(--border)] text-[10px]">
                          <Stethoscope size={10} className="text-blue-400" />
                          {ev.especialidad}
                        </span>
                      )}
                      {ev.nombre_plantilla && (
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold">
                          {ev.nombre_plantilla}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cuerpo del Texto Clínico */}
                  <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 text-gray-200 text-xs leading-relaxed whitespace-pre-wrap font-sans selection:bg-rose-500/30 selection:text-white">
                    {ev.texto ? (
                      ev.texto
                    ) : (
                      <span className="italic text-gray-500">Sin contenido de texto registrado en esta entrada.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-neutral-900/60 text-xs">
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Consulta en vivo vía API Geclisa (No persistente)
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
