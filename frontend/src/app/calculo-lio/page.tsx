'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Eye,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  User,
  Scissors,
  Calendar,
  Building2,
  Layers,
  FileText,
  Plus,
  Trash2,
  Save,
  Check,
  PackageCheck,
  Package,
  FileCheck2,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  RefreshCw,
  Phone,
  HelpCircle,
  Copy,
  ChevronRight,
  Lock,
  Unlock,
  Edit3,
  ShieldCheck,
  Zap,
  Barcode,
  Boxes,
  Compass,
  SlidersHorizontal,
  Info
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { formatearHoraDesdeIso } from '@/lib/dateUtils'

interface OpcionLio {
  id: string
  tipo_opcion: 'principal' | 'alternativa' | 'torico' | 'sulcus'
  etiqueta: string
  modelo: string
  modelo_lio_id?: string
  dioptria: string
  es_torico: boolean
  torico_valor: number | null
  torico_eje: number | null
  target_refractivo: string
  formula: string
  observaciones: string
  es_implantado?: boolean
  es_personalizado?: boolean
  constante_a_custom?: number
}

const FORMULAS_LIO = [
  'Barrett Universal II',
  'Kane',
  'EVO 2.0',
  'Hill-RBF 3.0',
  'Haigis',
  'SRK/T',
  'Holladay 1',
  'Hoffer Q',
  'Olsen'
]

const TARGETS_REFRACTIVOS = [
  'Emetropía (0.00 D)',
  '-0.25 D (Miopía Leve)',
  '-0.50 D (Micro-monovisión)',
  '-0.75 D',
  '-1.00 D (Monovisión Intermedia)',
  '-1.50 D (Monovisión Lectura)',
  '+0.25 D'
]

const TORICOS_OPCIONES = [
  { valor: 2, label: 'T2 (Cil 1.00 D)' },
  { valor: 3, label: 'T3 (Cil 1.50 D)' },
  { valor: 4, label: 'T4 (Cil 2.25 D)' },
  { valor: 5, label: 'T5 (Cil 3.00 D)' },
  { valor: 6, label: 'T6 (Cil 3.75 D)' },
  { valor: 7, label: 'T7 (Cil 4.50 D)' },
  { valor: 8, label: 'T8 (Cil 5.25 D)' },
  { valor: 9, label: 'T9 (Cil 6.00 D)' }
]

export default function CalculoLioPage() {
  const [todosPacientes, setTodosPacientes] = useState<any[]>([])
  const [cirujanos, setCirujanos] = useState<string[]>([])
  const [cirujanoSeleccionado, setCirujanoSeleccionado] = useState<string>('todos')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todos') // 'todos' | 'pendientes' | 'calculados' | 'stock_pendiente'
  const [busqueda, setBusqueda] = useState<string>('')
  const [cargando, setCargando] = useState<boolean>(true)
  const [guardandoBorrador, setGuardandoBorrador] = useState<boolean>(false)
  const [confirmandoCalculo, setConfirmandoCalculo] = useState<boolean>(false)
  const [reabriendo, setReabriendo] = useState<boolean>(false)
  const [reservandoStock, setReservandoStock] = useState<boolean>(false)

  const [pacienteActivo, setPacienteActivo] = useState<any | null>(null)
  const [opcionesLio, setOpcionesLio] = useState<OpcionLio[]>([])
  const [modelosLio, setModelosLio] = useState<any[]>([])
  const [modoEdicion, setModoEdicion] = useState<boolean>(false)

  // Resolución en tiempo real de SKU y Stock de Geclisa (por opción ID)
  const [skusResueltos, setSkusResueltos] = useState<Record<string, any>>({})
  const [resolviendoSkus, setResolviendoSkus] = useState<Record<string, boolean>>({})

  // Visor de Documentos Geclisa
  const [modalArchivosAbierto, setModalArchivosAbierto] = useState<boolean>(false)
  const [archivosGeclisa, setArchivosGeclisa] = useState<any[]>([])
  const [cargandoArchivos, setCargandoArchivos] = useState<boolean>(false)
  const [archivoVisor, setArchivoVisor] = useState<any | null>(null)
  const [visorPantallaCompleta, setVisorPantallaCompleta] = useState<boolean>(false)

  // Cargar catálogo de modelos de LIO
  useEffect(() => {
    const fetchModelos = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/modelos-lio?solo_activos=true`)
        const data = await res.json()
        if (data.success && data.modelos) {
          setModelosLio(data.modelos)
        }
      } catch (e) {
        console.error('Error cargando modelos de LIO:', e)
      }
    }
    fetchModelos()
  }, [])

  // Cargar pacientes para cálculo de LIO (siempre carga universo completo para calcular métricas consistentes)
  const fetchPacientes = async () => {
    try {
      setCargando(true)
      let url = `${BACKEND_URL}/api/calculo-lio/pacientes?estado_calculo=todos`
      if (cirujanoSeleccionado !== 'todos') {
        url += `&cirujano_nombre=${encodeURIComponent(cirujanoSeleccionado)}`
      }
      if (busqueda.trim()) {
        url += `&busqueda=${encodeURIComponent(busqueda.trim())}`
      }

      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.success) {
        const listado = data.pacientes || []
        setTodosPacientes(listado)
        setCirujanos(data.cirujanos || [])
        
        // Si hay un paciente activo, refrescar sus datos
        if (pacienteActivo) {
          const act = listado.find(
            (p: any) =>
              (p.turno_id && p.turno_id === pacienteActivo.turno_id) ||
              (p.asesoria_id && p.asesoria_id === pacienteActivo.asesoria_id)
          )
          if (act) {
            setPacienteActivo(act)
          }
        } else if (listado.length > 0 && !pacienteActivo) {
          seleccionarPaciente(listado[0])
        }
      } else {
        setTodosPacientes([])
      }
    } catch (e) {
      console.error('Error cargando pacientes para cálculo de LIO:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchPacientes()
  }, [cirujanoSeleccionado, busqueda])

  // Filtrado reactivo en memoria para el listado lateral según tarjeta seleccionada
  const pacientesFiltrados = useMemo(() => {
    if (estadoFiltro === 'pendientes') {
      return todosPacientes.filter((p) => !p.lio_calculado)
    }
    if (estadoFiltro === 'calculados') {
      return todosPacientes.filter((p) => p.lio_calculado)
    }
    if (estadoFiltro === 'stock_pendiente') {
      return todosPacientes.filter((p) => p.lio_calculado && !p.lio_stock_reservado)
    }
    return todosPacientes
  }, [todosPacientes, estadoFiltro])

  // Auto-seleccionar primer paciente del filtro si el activo quedó fuera
  useEffect(() => {
    if (pacientesFiltrados.length > 0) {
      const estaEnFiltro = pacienteActivo && pacientesFiltrados.some(
        (p) =>
          (p.turno_id && p.turno_id === pacienteActivo.turno_id) ||
          (p.asesoria_id && p.asesoria_id === pacienteActivo.asesoria_id)
      )
      if (!estaEnFiltro) {
        seleccionarPaciente(pacientesFiltrados[0])
      }
    }
  }, [pacientesFiltrados])

  // Seleccionar paciente para la mesa de trabajo
  const seleccionarPaciente = (p: any) => {
    setPacienteActivo(p)
    const ops = p.lio_calculo_opciones || []
    if (ops.length > 0) {
      setOpcionesLio(ops)
    } else {
      // Inicializar con Opción Principal por defecto
      const modeloDefault =
        modelosLio.length > 0
          ? `${modelosLio[0].modelo} (${modelosLio[0].marca})`
          : p.lente_tipo || 'Clareon CNA0T0 (Alcon)'
      const modObj = modelosLio.find((m) => `${m.modelo} (${m.marca})` === modeloDefault || m.modelo === modeloDefault)

      setOpcionesLio([
        {
          id: `opt-${Date.now()}-1`,
          tipo_opcion: 'principal',
          etiqueta: 'Plan A (Principal)',
          modelo: modeloDefault,
          modelo_lio_id: modObj?.id,
          dioptria: p.lente_dioptria || '20.00',
          es_torico: Boolean(p.es_torico),
          torico_valor: p.lente_torico_valor || (p.es_torico ? 3 : null),
          torico_eje: p.lente_torico_eje || (p.es_torico ? 90 : null),
          target_refractivo: '-0.25 D (Miopía Leve)',
          formula: 'Barrett Universal II',
          observaciones: '',
          es_implantado: true
        }
      ])
    }

    // Si ya está confirmado, por defecto entra en modo protegido/lectura
    setModoEdicion(!p.lio_calculado)
  }

  // Hook de resolución en tiempo real de SKU y Stock de Geclisa para cada opción
  useEffect(() => {
    opcionesLio.forEach((op) => {
      const diopNum = parseFloat(op.dioptria)
      if (!op.modelo || isNaN(diopNum)) {
        setSkusResueltos((prev) => ({ ...prev, [op.id]: null }))
        return
      }

      const timer = setTimeout(async () => {
        try {
          setResolviendoSkus((prev) => ({ ...prev, [op.id]: true }))
          
          // Encontrar modelo_lio_id si no está asignado
          const modObj = modelosLio.find(
            (m) =>
              (op.modelo_lio_id && m.id === op.modelo_lio_id) ||
              `${m.modelo} (${m.marca})` === op.modelo ||
              m.modelo === op.modelo ||
              op.modelo.includes(m.modelo)
          )

          const payload = {
            modelo_lio_id: modObj?.id || op.modelo_lio_id || null,
            modelo_nombre: op.modelo,
            dioptria: diopNum,
            torico_valor: op.es_torico && op.torico_valor ? `T${op.torico_valor}` : null,
            es_torico: Boolean(op.es_torico)
          }

          const res = await fetch(`${BACKEND_URL}/api/modelos-lio/resolver-sku`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          const data = await res.json()
          if (res.ok && data.success && data.item) {
            setSkusResueltos((prev) => ({ ...prev, [op.id]: data }))
          } else {
            setSkusResueltos((prev) => ({ ...prev, [op.id]: null }))
          }
        } catch (e) {
          console.error('Error resolviendo SKU para opción:', op.id, e)
          setSkusResueltos((prev) => ({ ...prev, [op.id]: null }))
        } finally {
          setResolviendoSkus((prev) => ({ ...prev, [op.id]: false }))
        }
      }, 300)

      return () => clearTimeout(timer)
    })
  }, [opcionesLio, modelosLio])

  // Agregar nueva opción de lente con 1 clic
  const agregarOpcionLio = (tipo: 'principal' | 'alternativa' | 'torico' | 'sulcus' = 'alternativa') => {
    const num = opcionesLio.length + 1
    const baseOpt = opcionesLio[0] || {}
    const diopBase = parseFloat(baseOpt.dioptria || '20.00')

    let etiqueta = `Opción ${num} (Alternativa)`
    let modelo = baseOpt.modelo || (modelosLio.length > 0 ? `${modelosLio[0].modelo} (${modelosLio[0].marca})` : 'Clareon CNA0T0 (Alcon)')
    let modelo_lio_id = baseOpt.modelo_lio_id
    let dioptria = (diopBase - 0.5).toFixed(2)
    let es_torico = false
    let torico_valor: number | null = null
    let torico_eje: number | null = null
    let constante_custom: number | undefined = undefined

    if (tipo === 'principal') {
      etiqueta = `Plan A (Principal)`
      dioptria = (diopBase || 20.0).toFixed(2)
    } else if (tipo === 'alternativa') {
      etiqueta = `Plan B (Alternativa ${num > 2 ? '+0.50 D' : '-0.50 D'})`
      dioptria = num > 2 ? (diopBase + 0.5).toFixed(2) : (diopBase - 0.5).toFixed(2)
      es_torico = Boolean(baseOpt.es_torico)
      torico_valor = baseOpt.torico_valor
      torico_eje = baseOpt.torico_eje
    } else if (tipo === 'torico') {
      etiqueta = `Opción Tórica (Astigmatismo)`
      es_torico = true
      torico_valor = 3
      torico_eje = 85
      dioptria = (diopBase || 20.0).toFixed(2)
    } else if (tipo === 'sulcus') {
      etiqueta = `Opción Sulcus / 3 Piezas (Respaldo)`
      const sulcusMod = modelosLio.find((m) => m.apto_sulcus || m.tipo_optica?.toLowerCase().includes('sulcus') || m.modelo?.includes('MA60'))
      if (sulcusMod) {
        modelo = `${sulcusMod.modelo} (${sulcusMod.marca})`
        modelo_lio_id = sulcusMod.id
        constante_custom = sulcusMod.constante_a || 118.4
      } else {
        modelo = 'AcrySof 3 Piezas MA60AC (Alcon)'
        constante_custom = 118.4
      }
      dioptria = (diopBase - 0.5).toFixed(2)
    }

    const nueva: OpcionLio = {
      id: `opt-${Date.now()}-${num}`,
      tipo_opcion: tipo,
      etiqueta,
      modelo,
      modelo_lio_id,
      dioptria,
      es_torico,
      torico_valor,
      torico_eje,
      target_refractivo: baseOpt.target_refractivo || '-0.25 D (Miopía Leve)',
      formula: baseOpt.formula || 'Barrett Universal II',
      observaciones: tipo === 'sulcus' ? 'Ajuste de poder por implante en surco ciliar (Constante A 118.4)' : '',
      es_implantado: false,
      constante_a_custom: constante_custom
    }

    setOpcionesLio([...opcionesLio, nueva])
  }

  // Eliminar opción de lente
  const eliminarOpcionLio = (id: string) => {
    if (opcionesLio.length === 1) {
      alert('Debe existir al menos una opción de cálculo de LIO.')
      return
    }
    setOpcionesLio(opcionesLio.filter((o) => o.id !== id))
  }

  // Actualizar campo de una opción
  const actualizarOpcionLio = (id: string, campo: keyof OpcionLio, valor: any) => {
    setOpcionesLio(
      opcionesLio.map((o) => {
        if (o.id !== id) return o
        const act = { ...o, [campo]: valor }

        if (campo === 'tipo_opcion') {
          if (valor === 'torico') {
            act.es_torico = true
            if (!act.torico_valor) act.torico_valor = 3
            if (!act.torico_eje) act.torico_eje = 90
          } else if (valor === 'sulcus') {
            act.es_torico = false
            const sulcusMod = modelosLio.find((m) => m.apto_sulcus || m.modelo?.includes('MA60'))
            if (sulcusMod) {
              act.modelo = `${sulcusMod.modelo} (${sulcusMod.marca})`
              act.modelo_lio_id = sulcusMod.id
            }
          }
        }

        if (campo === 'es_torico') {
          if (valor === true) {
            if (!act.torico_valor) act.torico_valor = 3
            if (!act.torico_eje) act.torico_eje = 90
          } else {
            act.torico_valor = null
            act.torico_eje = null
          }
        }

        return act
      })
    )
  }

  // Acción 1: Guardar Borrador (no confirma, sigue en Pendiente LIO)
  const handleGuardarBorrador = async () => {
    if (!pacienteActivo) return
    if (opcionesLio.length === 0) {
      alert('Debe cargar al menos una opción de lente.')
      return
    }

    try {
      setGuardandoBorrador(true)
      const cirujano = pacienteActivo.cirujano_nombre || 'Cirujano'
      const payload = {
        turno_id: pacienteActivo.turno_id,
        asesoria_id: pacienteActivo.asesoria_id,
        paciente_id: pacienteActivo.paciente_id,
        lio_calculado_por: cirujano,
        opciones: opcionesLio,
        confirmar: false,
        ojo: pacienteActivo.ojo
      }

      const res = await fetch(`${BACKEND_URL}/api/calculo-lio/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok && data.success) {
        alert('💾 Borrador guardado exitosamente. El paciente permanece en estado "Pendiente LIO".')
        fetchPacientes()
      } else {
        alert(data.detail || data.error || 'Error al guardar borrador.')
      }
    } catch (e: any) {
      console.error('Error guardando borrador:', e)
      alert(e.message || 'Error de conexión.')
    } finally {
      setGuardandoBorrador(false)
    }
  }

  // Acción 2: Confirmar y Sellar Cálculo (cierra selección y pasa a Confirmado)
  const handleConfirmarCalculo = async () => {
    if (!pacienteActivo) return
    if (opcionesLio.length === 0) {
      alert('Debe cargar al menos una opción de lente.')
      return
    }

    // Validar que las opciones tengan modelo y dioptría
    const opIncompleta = opcionesLio.find((o) => !o.modelo || !o.dioptria)
    if (opIncompleta) {
      alert('Todas las opciones deben tener un Modelo y una Dioptría definidos.')
      return
    }

    try {
      setConfirmandoCalculo(true)
      const cirujano = pacienteActivo.cirujano_nombre || 'Cirujano'
      const payload = {
        turno_id: pacienteActivo.turno_id,
        asesoria_id: pacienteActivo.asesoria_id,
        paciente_id: pacienteActivo.paciente_id,
        lio_calculado_por: cirujano,
        opciones: opcionesLio,
        confirmar: true,
        ojo: pacienteActivo.ojo
      }

      const res = await fetch(`${BACKEND_URL}/api/calculo-lio/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok && data.success) {
        alert('✔ Cálculo de LIO confirmado y sellado. La selección ha sido bloqueada y está lista para quirófano.')
        setModoEdicion(false)
        fetchPacientes()
      } else {
        alert(data.detail || data.error || 'Error al confirmar cálculo de LIO.')
      }
    } catch (e: any) {
      console.error('Error confirmando cálculo:', e)
      alert(e.message || 'Error de conexión.')
    } finally {
      setConfirmandoCalculo(false)
    }
  }

  // Reabrir Cálculo Confirmado para Rectificación Médica
  const handleReabrirCalculo = async () => {
    if (!pacienteActivo) return
    if (!confirm('¿Deseas reabrir este cálculo para realizar modificaciones? El paciente volverá a estado de edición.')) {
      return
    }

    try {
      setReabriendo(true)
      const res = await fetch(`${BACKEND_URL}/api/calculo-lio/reabrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: pacienteActivo.turno_id,
          asesoria_id: pacienteActivo.asesoria_id,
          usuario: pacienteActivo.cirujano_nombre || 'Cirujano'
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setModoEdicion(true)
        setPacienteActivo({ ...pacienteActivo, lio_calculado: false })
        fetchPacientes()
      } else {
        alert(data.detail || 'Error al reabrir cálculo.')
      }
    } catch (e) {
      console.error('Error al reabrir cálculo:', e)
    } finally {
      setReabriendo(false)
    }
  }

  // Reservar Stock de LIO (función de Quirófano)
  const handleToggleReservaStock = async () => {
    if (!pacienteActivo || !pacienteActivo.turno_id) {
      alert('La reserva física de stock se asocia a turnos agendados en Quirófano.')
      return
    }

    try {
      setReservandoStock(true)
      const nuevoEstado = !pacienteActivo.lio_stock_reservado
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${pacienteActivo.turno_id}/reservar-stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPacienteActivo({ ...pacienteActivo, lio_stock_reservado: nuevoEstado })
        setTodosPacientes((prev) =>
          prev.map((p) => (p.turno_id === pacienteActivo.turno_id ? { ...p, lio_stock_reservado: nuevoEstado } : p))
        )
      } else {
        alert(data.detail || 'Error al actualizar reserva de stock.')
      }
    } catch (e) {
      console.error('Error al reservar stock:', e)
    } finally {
      setReservandoStock(false)
    }
  }

  // Cargar archivos de Geclisa para el paciente activo
  const handleAbrirEstudiosGeclisa = async () => {
    if (!pacienteActivo) return
    setModalArchivosAbierto(true)
    setCargandoArchivos(true)
    try {
      const qId = pacienteActivo.geclisa_ficha_id || pacienteActivo.paciente_dni || pacienteActivo.paciente_id
      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/${qId}/archivos`)
      const data = await res.json()
      if (res.ok && data.success) {
        setArchivosGeclisa(data.archivos || [])
      } else {
        setArchivosGeclisa([])
      }
    } catch (e) {
      console.error('Error cargando archivos de Geclisa:', e)
    } finally {
      setCargandoArchivos(false)
    }
  }

  // Métricas de resumen globales (Calculadas sobre todos los pacientes asignados sin mutar con el filtro)
  const metricas = useMemo(() => {
    const total = todosPacientes.length
    const pendientes = todosPacientes.filter((p) => !p.lio_calculado).length
    const calculados = todosPacientes.filter((p) => p.lio_calculado).length
    const stockPendiente = todosPacientes.filter((p) => p.lio_calculado && !p.lio_stock_reservado).length

    return { total, pendientes, calculados, stockPendiente }
  }, [todosPacientes])

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400 rounded-2xl border border-cyan-500/30 shadow-xs">
              <Eye size={24} />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[var(--foreground)] tracking-tight">
              Cálculo de Lentes Intraoculares (LIO)
            </h1>
          </div>
          <p className="text-xs text-[var(--secondary)]">
            Definición biométrica multilente (Plan A, B, Tórico y Sulcus), consulta de estudios Geclisa y reserva de stock para quirófano.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filtro por Cirujano */}
          <div className="flex items-center gap-2 bg-[var(--card)] px-3 py-1.5 rounded-2xl border border-[var(--border)] shadow-xs">
            <User size={14} className="text-[var(--secondary)]" />
            <select
              value={cirujanoSeleccionado}
              onChange={(e) => setCirujanoSeleccionado(e.target.value)}
              className="bg-transparent text-xs font-bold text-[var(--foreground)] outline-none cursor-pointer"
            >
              <option value="todos">Todos los Cirujanos</option>
              {cirujanos.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchPacientes}
            className="p-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-slate-500 hover:text-[var(--foreground)] transition shadow-xs cursor-pointer"
            title="Refrescar listado"
          >
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. TARJETAS DE MÉTRICAS GLOBALES (CON NÚMEROS FIJOS Y FILTRADO INSTANTÁNEO) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setEstadoFiltro('todos')}
          className={`p-4 rounded-3xl border text-left transition shadow-xs cursor-pointer ${
            estadoFiltro === 'todos'
              ? 'bg-blue-600/10 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
              : 'bg-[var(--card)] border-[var(--border)] hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
            <span>Total Asignados</span>
            <Layers size={14} />
          </div>
          <span className="text-2xl font-black font-mono mt-1 block">{metricas.total}</span>
        </button>

        <button
          type="button"
          onClick={() => setEstadoFiltro('pendientes')}
          className={`p-4 rounded-3xl border text-left transition shadow-xs cursor-pointer ${
            estadoFiltro === 'pendientes'
              ? 'bg-amber-600/10 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
              : 'bg-[var(--card)] border-[var(--border)] hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span>Pendientes LIO</span>
            <AlertCircle size={14} />
          </div>
          <span className="text-2xl font-black font-mono mt-1 block text-amber-600 dark:text-amber-400">
            {metricas.pendientes}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEstadoFiltro('calculados')}
          className={`p-4 rounded-3xl border text-left transition shadow-xs cursor-pointer ${
            estadoFiltro === 'calculados'
              ? 'bg-emerald-600/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-[var(--card)] border-[var(--border)] hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>LIO Confirmados</span>
            <CheckCircle2 size={14} />
          </div>
          <span className="text-2xl font-black font-mono mt-1 block text-emerald-600 dark:text-emerald-400">
            {metricas.calculados}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEstadoFiltro('stock_pendiente')}
          className={`p-4 rounded-3xl border text-left transition shadow-xs cursor-pointer ${
            estadoFiltro === 'stock_pendiente'
              ? 'bg-purple-600/10 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
              : 'bg-[var(--card)] border-[var(--border)] hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <span>Stock Pendiente</span>
            <Package size={14} />
          </div>
          <span className="text-2xl font-black font-mono mt-1 block text-purple-600 dark:text-purple-400">
            {metricas.stockPendiente}
          </span>
        </button>
      </div>

      {/* 3. LAYOUT MAESTRO-DETALLE (COLA QUIRÚRGICA & MESA DE TRABAJO BIOMÉTRICA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: LISTA DE PACIENTES / COLA FILTRADA */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por paciente, DNI, práctica..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 text-xs rounded-2xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-cyan-500 shadow-xs"
            />
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {cargando ? (
              <div className="p-8 text-center text-xs text-[var(--secondary)] space-y-2">
                <Loader2 size={20} className="animate-spin text-cyan-600 mx-auto" />
                <span>Cargando pacientes quirúrgicos...</span>
              </div>
            ) : pacientesFiltrados.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-3xl space-y-1">
                <FileText size={24} className="mx-auto text-slate-400 opacity-40" />
                <p className="font-bold text-[var(--foreground)]">No hay cirugías en este filtro</p>
                <p className="text-[11px]">Prueba seleccionando otra tarjeta de estado superior.</p>
              </div>
            ) : (
              pacientesFiltrados.map((p) => {
                const esActivo =
                  pacienteActivo &&
                  ((p.turno_id && p.turno_id === pacienteActivo.turno_id) ||
                    (p.asesoria_id && p.asesoria_id === pacienteActivo.asesoria_id))

                return (
                  <button
                    key={p.turno_id || p.asesoria_id}
                    type="button"
                    onClick={() => seleccionarPaciente(p)}
                    className={`w-full p-4 rounded-3xl border text-left transition shadow-xs flex flex-col justify-between gap-2.5 cursor-pointer ${
                      esActivo
                        ? 'border-cyan-500 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent'
                        : 'border-[var(--border)] bg-[var(--card)] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[10px] font-black">
                        {p.ojo || 'OD'}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--secondary)]">
                        {p.fecha_cx} {p.hora_cx ? `(${p.hora_cx}hs)` : ''}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          p.lio_calculado
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                        }`}
                      >
                        {p.lio_calculado ? 'Confirmado' : `Borrador (${p.lio_calculo_opciones?.length || 1})`}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-[var(--foreground)] uppercase tracking-tight">
                        {p.paciente_nombre}
                      </h4>
                      <p className="text-[10px] text-[var(--secondary)]">
                        DNI: {p.paciente_dni || 'N/A'} • {p.obra_social || 'Particular'}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate mt-0.5">
                        {p.practica_nombre || 'Cirugía de Catarata'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/60 text-[10px] text-[var(--secondary)]">
                      <span className="font-bold flex items-center gap-1">
                        <User size={11} />
                        <span>{p.cirujano_nombre || 'Cirujano'}</span>
                      </span>
                      {p.lio_stock_reservado && (
                        <span className="text-purple-600 dark:text-purple-400 font-extrabold flex items-center gap-1">
                          <PackageCheck size={12} />
                          <span>Stock Reservado</span>
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: MESA DE TRABAJO BIOMÉTRICA */}
        <div className="lg:col-span-8 space-y-5">
          {!pacienteActivo ? (
            <div className="p-16 text-center border border-dashed border-[var(--border)] rounded-3xl bg-[var(--card)] space-y-2">
              <Eye size={36} className="mx-auto text-cyan-600 opacity-60" />
              <h3 className="text-sm font-bold text-[var(--foreground)]">Selecciona una cirugía de la cola</h3>
              <p className="text-xs text-[var(--secondary)]">
                Podrás cargar los cálculos multilente, verificar stock físico en quirófano y sellar el protocolo.
              </p>
            </div>
          ) : (
            <div className="p-5 md:p-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] space-y-6 shadow-sm">
              {/* CABECERA DEL PACIENTE ACTIVO */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-black text-xs shadow-xs">
                      {pacienteActivo.ojo === 'OI' ? 'OJO IZQUIERDO (OI)' : 'OJO DERECHO (OD)'}
                    </span>
                    <span className="text-xs text-[var(--secondary)] font-bold">
                      Fecha Qx: {pacienteActivo.fecha_cx}
                    </span>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        pacienteActivo.lio_calculado
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {pacienteActivo.lio_calculado ? '✔ LIO Confirmado & Sellado' : '⏳ Pendiente LIO'}
                    </span>
                  </div>

                  <h2 className="text-lg md:text-xl font-black text-[var(--foreground)] mt-1 tracking-tight">
                    {pacienteActivo.paciente_nombre}
                  </h2>
                  <p className="text-xs text-[var(--secondary)]">
                    DNI: <b className="font-mono text-[var(--foreground)]">{pacienteActivo.paciente_dni || 'N/A'}</b> • {pacienteActivo.obra_social || 'Particular'} • Cirujano: <b className="text-[var(--foreground)]">{pacienteActivo.cirujano_nombre || 'Asignado'}</b>
                  </p>
                </div>

                {/* Botón Ver Biometría & Estudios Geclisa */}
                <button
                  type="button"
                  onClick={handleAbrirEstudiosGeclisa}
                  className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs font-black flex items-center gap-2 shadow-xs cursor-pointer transition"
                >
                  <FileText size={15} />
                  <span>Ver Biometría & PDFs Geclisa</span>
                </button>
              </div>

              {/* OPCIONES DE LIO (PLAN A, PLAN B, TÓRICO, SULCUS) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-cyan-500" />
                      <span>Opciones de Lente Intraocular ({opcionesLio.length})</span>
                    </h3>
                    <p className="text-[11px] text-[var(--secondary)]">
                      Carga el Plan Principal y las opciones alternativas con stock y GTIN en tiempo real.
                    </p>
                  </div>

                  {/* Botones de Acción Rápida "1-Clic" */}
                  {modoEdicion && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => agregarOpcionLio('alternativa')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
                        title="Duplica el Plan Principal con dioptría contigua"
                      >
                        <Plus size={13} />
                        <span>+ Opción Alternativa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => agregarOpcionLio('torico')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
                        title="Agrega opción tórica con selector de cilindro y eje"
                      >
                        <Compass size={13} />
                        <span>+ Opción Tórica</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => agregarOpcionLio('sulcus')}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
                        title="Agrega lente 3 piezas para implante en sulcus"
                      >
                        <Boxes size={13} />
                        <span>+ Opción Sulcus</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Grid / Lista de Opciones */}
                <div className="space-y-4">
                  {opcionesLio.map((op, idx) => {
                    const deshabilitado = !modoEdicion
                    const skuData = skusResueltos[op.id]
                    const resolviendo = resolviendoSkus[op.id]
                    const modObj = modelosLio.find((m) => `${m.modelo} (${m.marca})` === op.modelo || m.modelo === op.modelo)
                    const constanteCalculada = op.es_personalizado ? (op.constante_a_custom || 118.9) : (modObj?.constante_a || 118.9)

                    return (
                      <div
                        key={op.id}
                        className={`p-4 md:p-5 rounded-3xl border transition space-y-4 ${
                          op.tipo_opcion === 'principal'
                            ? 'border-cyan-500/60 bg-gradient-to-br from-cyan-50/50 via-[var(--card)] to-blue-50/30 dark:from-cyan-950/20 dark:to-blue-950/10'
                            : op.tipo_opcion === 'torico' || op.es_torico
                            ? 'border-indigo-400/60 bg-gradient-to-br from-indigo-50/50 via-[var(--card)] to-purple-50/30 dark:from-indigo-950/20 dark:to-purple-950/10'
                            : op.tipo_opcion === 'sulcus'
                            ? 'border-purple-400/60 bg-gradient-to-br from-purple-50/50 via-[var(--card)] to-pink-50/30 dark:from-purple-950/20 dark:to-pink-950/10'
                            : 'border-[var(--border)] bg-slate-50/40 dark:bg-slate-900/30'
                        }`}
                      >
                        {/* Encabezado de la Opción */}
                        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/60 pb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                                op.tipo_opcion === 'principal'
                                  ? 'bg-cyan-500 text-black shadow-xs'
                                  : op.tipo_opcion === 'torico' || op.es_torico
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : op.tipo_opcion === 'sulcus'
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-slate-200 dark:bg-slate-800 text-[var(--foreground)]'
                              }`}
                            >
                              {op.etiqueta || `Opción ${idx + 1}`}
                            </span>

                            {op.es_torico && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] flex items-center gap-1">
                                <Compass size={11} />
                                <span>Tórico (T{op.torico_valor || 3} @ {op.torico_eje || 90}°)</span>
                              </span>
                            )}

                            {op.es_personalizado && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                                ✏️ Modelo Libre
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {deshabilitado ? (
                              <span className="text-[11px] font-bold text-[var(--secondary)]">
                                {op.tipo_opcion === 'principal' ? 'Principal' : 'Alternativa'}
                              </span>
                            ) : (
                              <select
                                value={op.tipo_opcion}
                                onChange={(e) => actualizarOpcionLio(op.id, 'tipo_opcion', e.target.value)}
                                className="px-2.5 py-1 bg-white dark:bg-slate-800 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none cursor-pointer"
                              >
                                <option value="principal">Principal</option>
                                <option value="alternativa">Alternativa (+/-0.50 D)</option>
                                <option value="torico">Tórica (Astigmatismo)</option>
                                <option value="sulcus">Sulcus (3 Piezas)</option>
                              </select>
                            )}

                            {!deshabilitado && opcionesLio.length > 1 && (
                              <button
                                type="button"
                                onClick={() => eliminarOpcionLio(op.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                                title="Eliminar esta opción"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Campos Principales de la Opción */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                          {/* Modelo de LIO (Selector Híbrido: Catálogo vs Libre) */}
                          <div className="sm:col-span-2 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--secondary)]">
                              <span>Modelo de Lente Intraocular *</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-extrabold text-cyan-600 dark:text-cyan-400 text-[10px]">
                                  Constante A: {constanteCalculada}
                                </span>
                                {!deshabilitado && (
                                  <button
                                    type="button"
                                    onClick={() => actualizarOpcionLio(op.id, 'es_personalizado', !op.es_personalizado)}
                                    className="text-[10px] text-blue-600 font-extrabold hover:underline"
                                  >
                                    {op.es_personalizado ? 'Usar Catálogo' : 'Ingreso Libre'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {deshabilitado ? (
                              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-extrabold text-[var(--foreground)]">
                                {op.modelo || 'Sin especificar'}
                              </div>
                            ) : op.es_personalizado ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={op.modelo}
                                  onChange={(e) => actualizarOpcionLio(op.id, 'modelo', e.target.value)}
                                  placeholder="Escribe el modelo libre (ej: Rayner EMV 600U, Zeiss AT LISA, PMMA)..."
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-700 text-xs font-bold text-[var(--foreground)] outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <div className="flex items-center gap-2">
                                  <label className="text-[10px] text-[var(--secondary)] font-bold">Constante A manual:</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={op.constante_a_custom || 118.9}
                                    onChange={(e) => actualizarOpcionLio(op.id, 'constante_a_custom', parseFloat(e.target.value) || 118.9)}
                                    className="w-20 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-[var(--border)] text-xs font-mono font-bold text-center"
                                  />
                                </div>
                              </div>
                            ) : (
                              <select
                                value={op.modelo}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === '__CUSTOM__') {
                                    actualizarOpcionLio(op.id, 'es_personalizado', true)
                                    actualizarOpcionLio(op.id, 'modelo', '')
                                    actualizarOpcionLio(op.id, 'modelo_lio_id', undefined)
                                    return
                                  }
                                  const found = modelosLio.find((m) => `${m.modelo} (${m.marca})` === val || m.modelo === val)
                                  actualizarOpcionLio(op.id, 'modelo', val)
                                  if (found?.id) {
                                    actualizarOpcionLio(op.id, 'modelo_lio_id', found.id)
                                  }
                                  if (found?.tipo_optica?.toLowerCase().includes('tóric')) {
                                    actualizarOpcionLio(op.id, 'es_torico', true)
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-cyan-500 cursor-pointer shadow-xs"
                              >
                                <option value="">-- Seleccionar LIO de Ajustes ({modelosLio.length} disponibles) --</option>
                                {modelosLio.map((m) => (
                                  <option key={m.id || m.modelo} value={`${m.modelo} (${m.marca})`}>
                                    {m.marca} — {m.modelo} ({m.tipo_optica || 'LIO'})
                                  </option>
                                ))}
                                <option value="__CUSTOM__">✏️ + Ingreso Libre / Modelo Personalizado...</option>
                              </select>
                            )}
                          </div>

                          {/* Dioptría (Poder) */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[var(--secondary)]">Dioptría Esférica *</label>
                            {deshabilitado ? (
                              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                                {op.dioptria} D
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const v = (parseFloat(op.dioptria || '20.00') - 0.5).toFixed(2)
                                    actualizarOpcionLio(op.id, 'dioptria', v)
                                  }}
                                  className="px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="text"
                                  value={op.dioptria}
                                  onChange={(e) => actualizarOpcionLio(op.id, 'dioptria', e.target.value)}
                                  placeholder="20.00"
                                  className="w-full text-center px-2 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs font-black text-blue-600 dark:text-blue-400 outline-none focus:border-cyan-500 font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const v = (parseFloat(op.dioptria || '20.00') + 0.5).toFixed(2)
                                    actualizarOpcionLio(op.id, 'dioptria', v)
                                  }}
                                  className="px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Target Refractivo */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[var(--secondary)]">Target Refractivo</label>
                            {deshabilitado ? (
                              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-[var(--foreground)]">
                                {op.target_refractivo}
                              </div>
                            ) : (
                              <select
                                value={op.target_refractivo}
                                onChange={(e) => actualizarOpcionLio(op.id, 'target_refractivo', e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-cyan-500 cursor-pointer"
                              >
                                {TARGETS_REFRACTIVOS.map((tg) => (
                                  <option key={tg} value={tg}>
                                    {tg}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        {/* CHECKBOX EXPLÍCITO: ¿ES LENTE TÓRICO? */}
                        <div className="p-3 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                disabled={deshabilitado}
                                checked={Boolean(op.es_torico)}
                                onChange={(e) => actualizarOpcionLio(op.id, 'es_torico', e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                              />
                              <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                                <Compass size={14} className="text-indigo-600" />
                                <span>Lente Tórico (Corrección de Astigmatismo Corneal)</span>
                              </span>
                            </label>

                            {op.es_torico && (
                              <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                                T{op.torico_valor || 3} • {op.torico_eje || 90}°
                              </span>
                            )}
                          </div>

                          {/* CAMPOS DESPLEGABLES DE TORICIDAD */}
                          {op.es_torico && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40 animate-fade-in">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                                  Valor Tórico (Cilindro IOL) *
                                </label>
                                {deshabilitado ? (
                                  <div className="px-3 py-2 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold text-indigo-900 dark:text-indigo-200 border border-indigo-200">
                                    T{op.torico_valor} ({TORICOS_OPCIONES.find((t) => t.valor === op.torico_valor)?.label || 'Cilindro'})
                                  </div>
                                ) : (
                                  <select
                                    value={op.torico_valor || 3}
                                    onChange={(e) => actualizarOpcionLio(op.id, 'torico_valor', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 text-xs font-bold text-indigo-900 dark:text-indigo-200 outline-none cursor-pointer focus:border-indigo-500 shadow-xs"
                                  >
                                    {TORICOS_OPCIONES.map((to) => (
                                      <option key={to.valor} value={to.valor}>
                                        {to.label}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                                    Eje de Alineación Quirúrgica (°) *
                                  </label>
                                  <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                                    {op.torico_eje || 90}°
                                  </span>
                                </div>
                                {deshabilitado ? (
                                  <div className="px-3 py-2 bg-white dark:bg-slate-900 rounded-xl text-xs font-mono font-black text-indigo-600 border border-indigo-200">
                                    {op.torico_eje || 90}°
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      max={180}
                                      value={op.torico_eje || 90}
                                      onChange={(e) => actualizarOpcionLio(op.id, 'torico_eje', parseInt(e.target.value) || 0)}
                                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 text-xs font-mono font-black text-center text-[var(--foreground)] outline-none focus:border-indigo-500 shadow-xs"
                                    />
                                    <div className="flex items-center gap-1">
                                      {[0, 45, 90, 135, 180].map((ang) => (
                                        <button
                                          key={ang}
                                          type="button"
                                          onClick={() => actualizarOpcionLio(op.id, 'torico_eje', ang)}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                            op.torico_eje === ang
                                              ? 'bg-indigo-600 text-white shadow-xs'
                                              : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                                          }`}
                                        >
                                          {ang}°
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* BANNER EN TIEMPO REAL DE RESOLUCIÓN GTIN Y STOCK GECLISA */}
                        <div className="pt-1">
                          {resolviendo ? (
                            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-[11px] text-[var(--secondary)] flex items-center gap-2">
                              <Loader2 size={14} className="animate-spin text-blue-600" />
                              <span>Resolviendo SKU y stock en vivo en Geclisa para esta graduación...</span>
                            </div>
                          ) : skuData && skuData.item ? (
                            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 rounded-xl bg-emerald-500 text-black font-black shrink-0 shadow-xs">
                                  <Barcode size={18} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-black text-xs text-emerald-950 dark:text-emerald-200 bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                                      GTIN: {skuData.item.geclisa_ele_cod}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                                      {skuData.item.geclisa_nombre}
                                    </span>
                                  </div>
                                  {skuData.item.es_torico && (
                                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5 block">
                                      ✔ Variante Tórica identificada: {skuData.item.torico_valor}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Badges de Stock */}
                              <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-xs">
                                <span
                                  className={`px-3 py-1.5 rounded-xl font-black text-xs ${
                                    (skuData.resumen?.stock_total ?? skuData.resumen?.stock_quirofano ?? 0) > 0
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold'
                                  }`}
                                >
                                  Stock Total: {skuData.resumen?.stock_total ?? skuData.resumen?.stock_quirofano ?? 0} un
                                </span>

                                {(skuData.resumen?.stock_farmacia ?? 0) > 0 && (
                                  <span className="px-2.5 py-1 rounded-xl font-bold bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 text-xs" title="En Farmacia / Depósito Central">
                                    Farmacia: {skuData.resumen.stock_farmacia} un
                                  </span>
                                )}

                                {(skuData.resumen?.stock_quirofano ?? 0) > 0 && (
                                  <span className="px-2.5 py-1 rounded-xl font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs" title="En Quirófano">
                                    Quirófano: {skuData.resumen.stock_quirofano} un
                                  </span>
                                )}

                                {(skuData.resumen?.stock_consignacion ?? 0) > 0 && (
                                  <span className="px-2.5 py-1 rounded-xl font-bold bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-xs">
                                    Consignación: {skuData.resumen.stock_consignacion} un
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                              <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="font-bold block">
                                  {op.es_personalizado
                                    ? 'Modelo libre personalizado — Planificación habilitada sin bloqueos.'
                                    : op.es_torico
                                    ? `Familia catalogada en Alcon, pero sin unidades físicas cargadas en Geclisa para cilindro T${op.torico_valor || 3} y dioptría +${op.dioptria} D.`
                                    : `Sin código GTIN registrado en Geclisa para +${op.dioptria} D.`}
                                </span>
                                <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                                  Puedes continuar y sellar el protocolo quirúrgico; se registrará como orden de pedido especial al proveedor.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Fórmula y Observaciones */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--secondary)]">Fórmula Biometría</label>
                            {deshabilitado ? (
                              <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-[var(--foreground)]">
                                {op.formula}
                              </div>
                            ) : (
                              <select
                                value={op.formula}
                                onChange={(e) => actualizarOpcionLio(op.id, 'formula', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] outline-none cursor-pointer"
                              >
                                {FORMULAS_LIO.map((f) => (
                                  <option key={f} value={f}>
                                    {f}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-[var(--secondary)]">Notas Quirúrgicas</label>
                            {deshabilitado ? (
                              <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-[var(--foreground)]">
                                {op.observaciones || 'Sin notas especiales'}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={op.observaciones}
                                onChange={(e) => actualizarOpcionLio(op.id, 'observaciones', e.target.value)}
                                placeholder="Ej: En caso de desgarro capsular implantar en sulcus..."
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-[var(--border)] text-xs text-[var(--foreground)] outline-none focus:border-cyan-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* BARRA INFERIOR DE ACCIONES */}
              <div className="pt-4 border-t border-[var(--border)] flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Gestión de Reserva de Stock (Quirófano) */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <button
                    type="button"
                    disabled={reservandoStock || !pacienteActivo.turno_id}
                    onClick={handleToggleReservaStock}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                      pacienteActivo.lio_stock_reservado
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-[var(--border)] hover:bg-slate-200'
                    }`}
                  >
                    {reservandoStock ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <PackageCheck size={14} />
                    )}
                    <span>
                      {pacienteActivo.lio_stock_reservado ? 'Stock Reservado en Depósito' : 'Marcar Stock Reservado'}
                    </span>
                  </button>
                </div>

                {/* Botonera de Guardar / Sellar */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                  {!modoEdicion ? (
                    <button
                      type="button"
                      disabled={reabriendo}
                      onClick={handleReabrirCalculo}
                      className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-2xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {reabriendo ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                      <span>Reabrir / Modificar Cálculo</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={guardandoBorrador}
                        onClick={handleGuardarBorrador}
                        className="px-4 py-2.5 rounded-2xl border border-[var(--border)] bg-slate-100 dark:bg-slate-800 text-[var(--foreground)] hover:bg-slate-200 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {guardandoBorrador ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>Guardar Borrador</span>
                      </button>

                      <button
                        type="button"
                        disabled={confirmandoCalculo}
                        onClick={handleConfirmarCalculo}
                        className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-2xl text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer"
                      >
                        {confirmandoCalculo ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                        <span>Confirmar y Sellar LIO</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. MODAL VISOR DE ESTUDIOS & BIOMETRÍAS DE GECLISA */}
      {modalArchivosAbierto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full p-6 space-y-4 shadow-2xl flex flex-col transition-all ${
              visorPantallaCompleta ? 'h-full max-w-none' : 'max-w-4xl max-h-[90vh]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <FileText size={20} className="text-cyan-600" />
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">
                    Estudios & Biometría Geclisa — {pacienteActivo?.paciente_nombre}
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Archivos adjuntos, biometrías IOLMaster / Pentacam y reportes clínicos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisorPantallaCompleta(!visorPantallaCompleta)}
                  className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-lg"
                >
                  {visorPantallaCompleta ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalArchivosAbierto(false)
                    setArchivoVisor(null)
                  }}
                  className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {cargandoArchivos ? (
              <div className="py-16 text-center text-xs text-[var(--secondary)] space-y-2">
                <Loader2 size={24} className="animate-spin text-cyan-600 mx-auto" />
                <span>Consultando archivos en el servidor de Geclisa...</span>
              </div>
            ) : archivosGeclisa.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-2xl space-y-1">
                <FileText size={28} className="mx-auto text-slate-400 opacity-40" />
                <p className="font-bold text-[var(--foreground)]">No hay archivos en Geclisa para este paciente</p>
                <p className="text-[11px]">Verifica si la ficha o DNI coinciden en el sistema central.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden">
                {/* Lista de Archivos */}
                <div className="md:col-span-4 space-y-2 overflow-y-auto max-h-[500px] pr-1">
                  {archivosGeclisa.map((arch) => (
                    <button
                      key={arch.arcId || arch.nombre}
                      type="button"
                      onClick={() => setArchivoVisor(arch)}
                      className={`w-full p-3 rounded-2xl border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                        archivoVisor?.arcId === arch.arcId
                          ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30'
                          : 'border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-bold text-[var(--foreground)] block truncate">
                          {arch.arcNombre || arch.nombre || 'Documento'}
                        </span>
                        <span className="text-[10px] text-[var(--secondary)]">
                          {arch.arcFecha || 'Fecha N/A'}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>

                {/* Previsualizador */}
                <div className="md:col-span-8 border border-[var(--border)] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900/60 flex items-center justify-center min-h-[350px]">
                  {archivoVisor ? (
                    archivoVisor.arcUrl || archivoVisor.url ? (
                      <iframe
                        src={archivoVisor.arcUrl || archivoVisor.url}
                        className="w-full h-full min-h-[450px]"
                        title="Visor de Documento"
                      />
                    ) : (
                      <div className="text-center p-8 space-y-2">
                        <FileText size={32} className="mx-auto text-cyan-600" />
                        <p className="font-bold text-xs text-[var(--foreground)]">
                          {archivoVisor.arcNombre || archivoVisor.nombre}
                        </p>
                        <p className="text-[11px] text-[var(--secondary)]">
                          Este archivo se encuentra almacenado en el repositorio de Geclisa.
                        </p>
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-[var(--secondary)]">Selecciona un archivo para visualizarlo</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
