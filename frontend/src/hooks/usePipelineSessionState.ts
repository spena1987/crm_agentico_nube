'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'

export interface PipelineFiltrosState {
  texto: string
  cirujano: string
  obraSocial: string
  practica: string
  fechaTipo: 'todas' | 'vencidas' | '7dias' | '30dias' | 'sin_fecha' | 'personalizado'
  recordatorio: 'todos' | 'confirmados' | 'enviados' | 'con_consulta' | 'sin_enviar'
  seguimiento: 'todos' | 'activos' | 'snooze' | 'reactivados'
  soloAlertas: boolean
  fechaDesde: string
  fechaHasta: string
}

export interface PipelineSessionData {
  version: number
  userId: string
  fecha: string
  modoVisualizacion: 'vertical' | 'kanban'
  vistaActual: 'activos' | 'cerrados'
  subfiltroCerrados: 'todos' | 'operado' | 'cancelado'
  etapasColapsadas: Record<string, boolean>
  filtros: PipelineFiltrosState
}

const STORAGE_KEY = 'crm_pipeline_session_v1'

// Estado predeterminado inicial: todas las 5 etapas contraídas (true = colapsada)
export const ETAPAS_COLAPSADAS_DEFAULT: Record<string, boolean> = {
  derivado: true,
  en_asesoramiento: true,
  en_analisis: true,
  confirmado: true,
  programado: true
}

export const FILTROS_DEFAULT: PipelineFiltrosState = {
  texto: '',
  cirujano: 'todos',
  obraSocial: 'todos',
  practica: 'todas',
  fechaTipo: 'todas',
  recordatorio: 'todos',
  seguimiento: 'activos',
  soloAlertas: false,
  fechaDesde: '',
  fechaHasta: ''
}

// Obtener fecha local YYYY-MM-DD
function getFechaLocalActual(): string {
  try {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function usePipelineSessionState() {
  const { user } = useAuth()
  const userId = user?.id || 'anon'
  const fechaHoy = getFechaLocalActual()

  // Estados locales en React
  const [modoVisualizacion, setModoVisualizacionState] = useState<'vertical' | 'kanban'>('vertical')
  const [vistaActual, setVistaActualState] = useState<'activos' | 'cerrados'>('activos')
  const [subfiltroCerrados, setSubfiltroCerradosState] = useState<'todos' | 'operado' | 'cancelado'>('todos')
  const [etapasColapsadas, setEtapasColapsadasState] = useState<Record<string, boolean>>(ETAPAS_COLAPSADAS_DEFAULT)
  const [filtros, setFiltrosState] = useState<PipelineFiltrosState>(FILTROS_DEFAULT)
  const [isLoaded, setIsLoaded] = useState(false)

  // Referencia para evitar guardar antes de haber cargado el estado inicial
  const yaCargadoRef = useRef(false)

  // 1. Cargar estado de sesión al montar o al cambiar de usuario/día
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: PipelineSessionData = JSON.parse(raw)
        // Validar que pertenezca al mismo usuario autenticado y a la misma fecha calendario local
        const esMismoUsuario = parsed.userId === userId
        const esMismoDia = parsed.fecha === fechaHoy

        if (esMismoUsuario && esMismoDia && parsed.version === 1) {
          // Restaurar sesión activa de la jornada
          if (parsed.modoVisualizacion) setModoVisualizacionState(parsed.modoVisualizacion)
          if (parsed.vistaActual) setVistaActualState(parsed.vistaActual)
          if (parsed.subfiltroCerrados) setSubfiltroCerradosState(parsed.subfiltroCerrados)
          if (parsed.etapasColapsadas) {
            setEtapasColapsadasState({ ...ETAPAS_COLAPSADAS_DEFAULT, ...parsed.etapasColapsadas })
          }
          if (parsed.filtros) {
            setFiltrosState({ ...FILTROS_DEFAULT, ...parsed.filtros })
          }
          yaCargadoRef.current = true
          setIsLoaded(true)
          return
        }
      }
    } catch (e) {
      console.warn('Error leyendo sesión del pipeline:', e)
    }

    // Si es un nuevo login, nuevo día o no había estado guardado: Estado base limpio
    sessionStorage.removeItem(STORAGE_KEY)
    setEtapasColapsadasState(ETAPAS_COLAPSADAS_DEFAULT)
    setFiltrosState(FILTROS_DEFAULT)
    setVistaActualState('activos')
    setModoVisualizacionState('vertical')
    setSubfiltroCerradosState('todos')
    yaCargadoRef.current = true
    setIsLoaded(true)
  }, [userId, fechaHoy])

  // 2. Función helper para guardar el estado consolidado en sessionStorage
  const guardarEnStorage = useCallback((
    nuevoModo: 'vertical' | 'kanban',
    nuevaVista: 'activos' | 'cerrados',
    nuevoSubfiltro: 'todos' | 'operado' | 'cancelado',
    nuevasEtapas: Record<string, boolean>,
    nuevosFiltros: PipelineFiltrosState
  ) => {
    if (typeof window === 'undefined' || !yaCargadoRef.current) return
    try {
      const payload: PipelineSessionData = {
        version: 1,
        userId,
        fecha: fechaHoy,
        modoVisualizacion: nuevoModo,
        vistaActual: nuevaVista,
        subfiltroCerrados: nuevoSubfiltro,
        etapasColapsadas: nuevasEtapas,
        filtros: nuevosFiltros
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (e) {
      console.warn('No se pudo guardar la sesión del pipeline:', e)
    }
  }, [userId, fechaHoy])

  // 3. Setters reactivos que sincronizan React state y sessionStorage
  const setModoVisualizacion = useCallback((modo: 'vertical' | 'kanban') => {
    setModoVisualizacionState(modo)
    guardarEnStorage(modo, vistaActual, subfiltroCerrados, etapasColapsadas, filtros)
  }, [vistaActual, subfiltroCerrados, etapasColapsadas, filtros, guardarEnStorage])

  const setVistaActual = useCallback((vista: 'activos' | 'cerrados') => {
    setVistaActualState(vista)
    guardarEnStorage(modoVisualizacion, vista, subfiltroCerrados, etapasColapsadas, filtros)
  }, [modoVisualizacion, subfiltroCerrados, etapasColapsadas, filtros, guardarEnStorage])

  const setSubfiltroCerrados = useCallback((sub: 'todos' | 'operado' | 'cancelado') => {
    setSubfiltroCerradosState(sub)
    guardarEnStorage(modoVisualizacion, vistaActual, sub, etapasColapsadas, filtros)
  }, [modoVisualizacion, vistaActual, etapasColapsadas, filtros, guardarEnStorage])

  const toggleColapsoEtapa = useCallback((colId: string) => {
    setEtapasColapsadasState((prev) => {
      const next = { ...prev, [colId]: !prev[colId] }
      guardarEnStorage(modoVisualizacion, vistaActual, subfiltroCerrados, next, filtros)
      return next
    })
  }, [modoVisualizacion, vistaActual, subfiltroCerrados, filtros, guardarEnStorage])

  const colapsarTodasEtapas = useCallback(() => {
    const next = { ...ETAPAS_COLAPSADAS_DEFAULT }
    setEtapasColapsadasState(next)
    guardarEnStorage(modoVisualizacion, vistaActual, subfiltroCerrados, next, filtros)
  }, [modoVisualizacion, vistaActual, subfiltroCerrados, filtros, guardarEnStorage])

  const expandirTodasEtapas = useCallback((columnasIds: string[]) => {
    const next: Record<string, boolean> = {}
    columnasIds.forEach((id) => {
      next[id] = false
    })
    setEtapasColapsadasState(next)
    guardarEnStorage(modoVisualizacion, vistaActual, subfiltroCerrados, next, filtros)
  }, [modoVisualizacion, vistaActual, subfiltroCerrados, filtros, guardarEnStorage])

  const actualizarFiltro = useCallback(<K extends keyof PipelineFiltrosState>(
    key: K,
    valor: PipelineFiltrosState[K]
  ) => {
    setFiltrosState((prev) => {
      const next = { ...prev, [key]: valor }
      guardarEnStorage(modoVisualizacion, vistaActual, subfiltroCerrados, etapasColapsadas, next)
      return next
    })
  }, [modoVisualizacion, vistaActual, subfiltroCerrados, etapasColapsadas, guardarEnStorage])

  const limpiarFiltros = useCallback(() => {
    setFiltrosState(FILTROS_DEFAULT)
    guardarEnStorage(modoVisualizacion, vistaActual, subfiltroCerrados, etapasColapsadas, FILTROS_DEFAULT)
  }, [modoVisualizacion, vistaActual, subfiltroCerrados, etapasColapsadas, guardarEnStorage])

  const resetCompleto = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    setModoVisualizacionState('vertical')
    setVistaActualState('activos')
    setSubfiltroCerradosState('todos')
    setEtapasColapsadasState(ETAPAS_COLAPSADAS_DEFAULT)
    setFiltrosState(FILTROS_DEFAULT)
  }, [])

  return {
    isLoaded,
    modoVisualizacion,
    setModoVisualizacion,
    vistaActual,
    setVistaActual,
    subfiltroCerrados,
    setSubfiltroCerrados,
    etapasColapsadas,
    toggleColapsoEtapa,
    colapsarTodasEtapas,
    expandirTodasEtapas,
    filtros,
    actualizarFiltro,
    limpiarFiltros,
    resetCompleto
  }
}
