'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Link2,
  Stethoscope,
  UserCheck,
  Calendar,
  DollarSign,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Loader2,
  Trash2,
  Receipt,
  FileText,
  Download,
  Check,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Send,
  MessageCircle,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  Tag
} from 'lucide-react'
import { AsesoriaQuirurgica, PresupuestoPaciente } from '@/components/ItemCasoQuirurgicoAcordeon'
import ChecklistPrequirurgico from '@/components/ChecklistPrequirurgico'
import TimelineEvolucionesAsesoria from '@/components/TimelineEvolucionesAsesoria'
import CasoPagosWidget from './CasoPagosWidget'
import { BACKEND_URL } from '@/lib/api'

interface PrestadorGeclisa {
  pre_id: number
  nombre: string
  matricula: string
  especialidad?: string
}

interface PracticaNomenclador {
  codigo: string
  nombre: string
  categoria?: string
  precio?: number
  moneda?: string
}

interface CasoFormularioActivoProps {
  caso: AsesoriaQuirurgica
  pacienteId: string
  pacienteNombre: string
  pacienteDni?: string | null
  pacienteTelefono?: string | null
  obraSocialDefault?: string | null
  presupuestos: PresupuestoPaciente[]
  cargandoPresupuestos: boolean
  guardando: boolean
  mensajeGuardado: string | null
  errorAccion: string | null
  consentimientoInfo?: any
  etapas: Array<{
    id: AsesoriaQuirurgica['estado']
    label: string
    color: string
    headerBg: string
    headerBorder: string
    desc: string
  }>
  onGuardar: (datosActualizados: Partial<AsesoriaQuirurgica>) => Promise<void>
  onAbrirModalPresupuesto: (datosPractica?: { codigo: string; nombre: string; precio: number; moneda: string }) => void
  onAbrirModalWhatsApp: () => void
  onAbrirModalCierre: () => void
  onEliminar: () => void
  onAprobarRechazarPresupuesto: (presupuestoId: string, nuevoEstado: 'aprobado' | 'rechazado') => Promise<void> | void
  onDesvincularPresupuesto: () => void
  onVincularPresupuesto?: (presupuesto: PresupuestoPaciente) => void
  onEnviarPresupuestoWhatsApp?: (presupuesto: PresupuestoPaciente) => void
}

export default function CasoFormularioActivo({
  caso,
  pacienteId,
  pacienteNombre,
  pacienteDni,
  pacienteTelefono,
  obraSocialDefault,
  presupuestos,
  cargandoPresupuestos,
  guardando,
  mensajeGuardado,
  errorAccion,
  consentimientoInfo,
  etapas,
  onGuardar,
  onAbrirModalPresupuesto,
  onAbrirModalWhatsApp,
  onAbrirModalCierre,
  onEliminar,
  onAprobarRechazarPresupuesto,
  onDesvincularPresupuesto,
  onVincularPresupuesto,
  onEnviarPresupuestoWhatsApp
}: CasoFormularioActivoProps) {
  // Estados Locales Editables
  const estadoInicial = (caso.estado === 'presupuesto_enviado' ? 'en_analisis' : caso.estado) as AsesoriaQuirurgica['estado']
  const [estado, setEstado] = useState<AsesoriaQuirurgica['estado']>(estadoInicial)
  const [cobertura, setCobertura] = useState(caso.cobertura_obra_social || obraSocialDefault || '')
  
  // Médicos
  const [medicoDerivador, setMedicoDerivador] = useState<{ id?: number | null; nombre?: string | null; matricula?: string | null }>({
    id: caso.medico_derivador_id,
    nombre: caso.medico_derivador_nombre,
    matricula: caso.medico_derivador_matricula
  })
  const [busquedaDerivador, setBusquedaDerivador] = useState(caso.medico_derivador_nombre || '')
  const [prestadoresDerivador, setPrestadoresDerivador] = useState<PrestadorGeclisa[]>([])
  const [buscandoDerivador, setBuscandoDerivador] = useState(false)
  const [mostrarDropdownDerivador, setMostrarDropdownDerivador] = useState(false)

  const [medicoCirujano, setMedicoCirujano] = useState<{ id?: number | null; nombre?: string | null; matricula?: string | null }>({
    id: caso.medico_cirujano_id,
    nombre: caso.medico_cirujano_nombre,
    matricula: caso.medico_cirujano_matricula
  })
  const [busquedaCirujano, setBusquedaCirujano] = useState(caso.medico_cirujano_nombre || '')
  const [prestadoresCirujano, setPrestadoresCirujano] = useState<PrestadorGeclisa[]>([])
  const [buscandoCirujano, setBuscandoCirujano] = useState(false)
  const [mostrarDropdownCirujano, setMostrarDropdownCirujano] = useState(false)

  // Práctica / Nomenclador
  const [practicaCodigo, setPracticaCodigo] = useState(caso.practica_codigo || '')
  const [practicaNombre, setPracticaNombre] = useState(caso.practica_nombre || '')
  const [busquedaPractica, setBusquedaPractica] = useState(
    caso.practica_codigo ? `[${caso.practica_codigo}] ${caso.practica_nombre}` : caso.practica_nombre || ''
  )
  const [practicasNomenclador, setPracticasNomenclador] = useState<PracticaNomenclador[]>([])
  const [buscandoPractica, setBuscandoPractica] = useState(false)
  const [mostrarDropdownPractica, setMostrarDropdownPractica] = useState(false)

  // Selector colapsable de presupuestos históricos del paciente
  const [mostrarOtrosPresupuestos, setMostrarOtrosPresupuestos] = useState(false)

  // Económico y Señas
  const [montoExtra, setMontoExtra] = useState<number>(caso.monto_extra || 0)
  const [monedaExtra, setMonedaExtra] = useState<string>(caso.moneda_extra || 'ARS')
  const [montoSena, setMontoSena] = useState<number>(caso.monto_sena || 0)
  const [estadoPago, setEstadoPago] = useState<'pendiente' | 'seniado' | 'totalmente_cobrado'>(
    caso.estado_pago || 'pendiente'
  )
  const [medioPago, setMedioPago] = useState<string | null>(caso.medio_pago || null)
  const [presupuestoId, setPresupuestoId] = useState<string | null>(caso.presupuesto_id || null)

  // Fechas
  const [fechaProbable, setFechaProbable] = useState(caso.fecha_probable_cirugia || '')
  const [fechaDefinitiva, setFechaDefinitiva] = useState(caso.fecha_definitiva_cirugia || '')

  // Checklist y Notas
  const [checklist, setChecklist] = useState<Record<string, boolean>>(caso.checklist_prequirurgico || {})
  const [proximaAccionFecha, setProximaAccionFecha] = useState(caso.proxima_accion_fecha || '')
  const [proximaAccionTexto, setProximaAccionTexto] = useState(caso.proxima_accion_texto || '')
  const [situacionPaciente, setSituacionPaciente] = useState(caso.situacion_paciente || '')

  // --------------------------------------------------------------------------
  // DETECCIÓN DE CAMBIOS SIN GUARDAR (DIRTY STATE)
  // --------------------------------------------------------------------------
  const hasUnsavedChanges = useMemo(() => {
    return (
      estado !== caso.estado ||
      cobertura !== (caso.cobertura_obra_social || obraSocialDefault || '') ||
      (medicoDerivador.nombre || '') !== (caso.medico_derivador_nombre || '') ||
      (medicoCirujano.nombre || '') !== (caso.medico_cirujano_nombre || '') ||
      practicaCodigo !== (caso.practica_codigo || '') ||
      practicaNombre !== (caso.practica_nombre || '') ||
      Number(montoExtra) !== Number(caso.monto_extra || 0) ||
      monedaExtra !== (caso.moneda_extra || 'ARS') ||
      Number(montoSena) !== Number(caso.monto_sena || 0) ||
      estadoPago !== (caso.estado_pago || 'pendiente') ||
      medioPago !== (caso.medio_pago || null) ||
      presupuestoId !== (caso.presupuesto_id || null) ||
      fechaProbable !== (caso.fecha_probable_cirugia || '') ||
      fechaDefinitiva !== (caso.fecha_definitiva_cirugia || '') ||
      proximaAccionFecha !== (caso.proxima_accion_fecha || '') ||
      proximaAccionTexto !== (caso.proxima_accion_texto || '') ||
      situacionPaciente !== (caso.situacion_paciente || '') ||
      JSON.stringify(checklist) !== JSON.stringify(caso.checklist_prequirurgico || {})
    )
  }, [
    estado,
    cobertura,
    medicoDerivador,
    medicoCirujano,
    practicaCodigo,
    practicaNombre,
    montoExtra,
    monedaExtra,
    montoSena,
    estadoPago,
    medioPago,
    presupuestoId,
    fechaProbable,
    fechaDefinitiva,
    proximaAccionFecha,
    proximaAccionTexto,
    situacionPaciente,
    checklist,
    caso,
    obraSocialDefault
  ])

  // Filtrado reactivo en memoria para médicos Geclisa
  const derivadoresFiltrados = useMemo(() => {
    const q = (busquedaDerivador || '').trim().toLowerCase()
    if (!q) return prestadoresDerivador
    return prestadoresDerivador.filter(
      (p) =>
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.matricula && String(p.matricula).toLowerCase().includes(q)) ||
        (p.especialidad && p.especialidad.toLowerCase().includes(q))
    )
  }, [prestadoresDerivador, busquedaDerivador])

  const cirujanosFiltrados = useMemo(() => {
    const q = (busquedaCirujano || '').trim().toLowerCase()
    if (!q) return prestadoresCirujano
    return prestadoresCirujano.filter(
      (p) =>
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.matricula && String(p.matricula).toLowerCase().includes(q)) ||
        (p.especialidad && p.especialidad.toLowerCase().includes(q))
    )
  }, [prestadoresCirujano, busquedaCirujano])

  // Buscar prestadores en Geclisa
  const buscarPrestador = async (tipo: 'derivador' | 'cirujano', query: string) => {
    const qClean = (query || '').trim()
    if (tipo === 'derivador') setBuscandoDerivador(true)
    if (tipo === 'cirujano') setBuscandoCirujano(true)

    try {
      const res = await fetch(`/api/geclisa/prestadores/buscar?query=${encodeURIComponent(qClean)}&q=${encodeURIComponent(qClean)}`)
      const data = await res.json()
      if (res.ok && data.success) {
        const lista = data.prestadores || []
        if (tipo === 'derivador') setPrestadoresDerivador(lista)
        if (tipo === 'cirujano') setPrestadoresCirujano(lista)
      }
    } catch (err) {
      console.error('Error buscando prestador en Geclisa:', err)
    } finally {
      if (tipo === 'derivador') setBuscandoDerivador(false)
      if (tipo === 'cirujano') setBuscandoCirujano(false)
    }
  }

  // Buscar en Nomenclador del CRM
  const buscarPracticasNomenclador = async (query: string) => {
    setBuscandoPractica(true)
    let qClean = (query || '').trim()
    // Si contiene formato [CODIGO] Nombre, extraer el término de búsqueda
    if (qClean.startsWith('[') && qClean.includes(']')) {
      qClean = qClean.replace(/^\[[^\]]+\]\s*/, '').trim()
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/nomenclador/buscar-presupuesto?q=${encodeURIComponent(qClean)}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setPracticasNomenclador(data.resultados || [])
      } else {
        setPracticasNomenclador([])
      }
    } catch (err) {
      console.error('Error al buscar en nomenclador:', err)
      setPracticasNomenclador([])
    } finally {
      setBuscandoPractica(false)
    }
  }

  const casoIdAnteriorRef = React.useRef(caso.id)

  // Sincronizar estados locales cuando cambia el caso de forma segura (sin sobreescribir ediciones activas)
  useEffect(() => {
    const esCambioDeCaso = casoIdAnteriorRef.current !== caso.id
    casoIdAnteriorRef.current = caso.id

    // Si cambió de caso, o si no hay cambios locales sucios, sincronizar todo
    if (esCambioDeCaso || !hasUnsavedChanges) {
      const est = (caso.estado === 'presupuesto_enviado' ? 'en_analisis' : caso.estado) as AsesoriaQuirurgica['estado']
      setEstado(est)
      setCobertura(caso.cobertura_obra_social || obraSocialDefault || '')
      setMedicoDerivador({
        id: caso.medico_derivador_id,
        nombre: caso.medico_derivador_nombre,
        matricula: caso.medico_derivador_matricula
      })
      setBusquedaDerivador(caso.medico_derivador_nombre || '')
      setMedicoCirujano({
        id: caso.medico_cirujano_id,
        nombre: caso.medico_cirujano_nombre,
        matricula: caso.medico_cirujano_matricula
      })
      setBusquedaCirujano(caso.medico_cirujano_nombre || '')
      setPracticaCodigo(caso.practica_codigo || '')
      setPracticaNombre(caso.practica_nombre || '')
      setBusquedaPractica(
        caso.practica_codigo ? `[${caso.practica_codigo}] ${caso.practica_nombre}` : caso.practica_nombre || ''
      )
      setMontoExtra(caso.monto_extra || 0)
      setMonedaExtra(caso.moneda_extra || 'ARS')
      setMontoSena(caso.monto_sena || 0)
      setEstadoPago(caso.estado_pago || 'pendiente')
      setMedioPago(caso.medio_pago || null)
      setPresupuestoId(caso.presupuesto_id || null)
      setFechaProbable(caso.fecha_probable_cirugia || '')
      setFechaDefinitiva(caso.fecha_definitiva_cirugia || '')
      setChecklist(caso.checklist_prequirurgico || {})
      setProximaAccionFecha(caso.proxima_accion_fecha || '')
      setProximaAccionTexto(caso.proxima_accion_texto || '')
      setSituacionPaciente(caso.situacion_paciente || '')
    } else {
      // Si el usuario está editando pero el servidor actualizó el presupuesto o práctica desde un modal
      if (caso.presupuesto_id && caso.presupuesto_id !== presupuestoId) {
        setPresupuestoId(caso.presupuesto_id)
        if (caso.monto_extra) setMontoExtra(caso.monto_extra)
        if (caso.moneda_extra) setMonedaExtra(caso.moneda_extra)
      }
      if (caso.practica_codigo && caso.practica_codigo !== practicaCodigo && caso.practica_nombre !== 'Nueva Cirugía / Procedimiento') {
        setPracticaCodigo(caso.practica_codigo)
        setPracticaNombre(caso.practica_nombre || '')
        setBusquedaPractica(`[${caso.practica_codigo}] ${caso.practica_nombre}`)
      }
    }
  }, [
    caso.id,
    caso.updated_at,
    caso.practica_nombre,
    caso.practica_codigo,
    caso.medico_cirujano_nombre,
    caso.medico_derivador_nombre,
    caso.estado,
    caso.presupuesto_id,
    caso.monto_extra,
    caso.moneda_extra,
    caso.monto_sena,
    caso.estado_pago,
    caso.medio_pago,
    caso.fecha_probable_cirugia,
    caso.fecha_definitiva_cirugia
  ])

  // Guardar Cambios
    // Handler para emitir presupuesto guardando automáticamente el formulario previo
  const handleEmitirPresupuesto = () => {
    let cleanPracticaNombre = (practicaNombre || '').trim()
    if (!cleanPracticaNombre && busquedaPractica) {
      cleanPracticaNombre = busquedaPractica.replace(/^\[.*?\]\s*/, '').trim()
    }
    if (!cleanPracticaNombre) cleanPracticaNombre = 'Nueva Cirugía / Procedimiento'

    const derivNombre = (medicoDerivador.nombre || busquedaDerivador || '').trim() || null
    const cirujNombre = (medicoCirujano.nombre || busquedaCirujano || '').trim() || null

    // Guardado integral automático previo
    const payload: Partial<AsesoriaQuirurgica> = {
      estado,
      cobertura_obra_social: (cobertura || '').trim() || null,
      medico_derivador_id: medicoDerivador.id || null,
      medico_derivador_nombre: derivNombre,
      medico_derivador_matricula: medicoDerivador.matricula || null,
      medico_cirujano_id: medicoCirujano.id || null,
      medico_cirujano_nombre: cirujNombre,
      medico_cirujano_matricula: medicoCirujano.matricula || null,
      practica_codigo: practicaCodigo || null,
      practica_nombre: cleanPracticaNombre,
      monto_extra: Number(montoExtra) || 0,
      moneda_extra: monedaExtra,
      monto_sena: Number(montoSena) || 0,
      estado_pago: estadoPago,
      medio_pago: medioPago,
      presupuesto_id: presupuestoId || null,
      fecha_probable_cirugia: fechaProbable || null,
      fecha_definitiva_cirugia: fechaDefinitiva || null,
      checklist_prequirurgico: checklist,
      proxima_accion_fecha: proximaAccionFecha || null,
      proxima_accion_texto: proximaAccionTexto || null,
      situacion_paciente: situacionPaciente || ''
    }

    onGuardar(payload)

    onAbrirModalPresupuesto({
      codigo: practicaCodigo || '',
      nombre: cleanPracticaNombre,
      precio: Number(montoExtra) || 0,
      moneda: monedaExtra || 'ARS'
    })
  }

  const handleGuardarCambios = () => {
    let cleanPracticaNombre = (practicaNombre || '').trim()
    if (!cleanPracticaNombre && busquedaPractica) {
      cleanPracticaNombre = busquedaPractica.replace(/^\[.*?\]\s*/, '').trim()
    }
    if (!cleanPracticaNombre) cleanPracticaNombre = 'Nueva Cirugía / Procedimiento'

    const derivNombre = (medicoDerivador.nombre || busquedaDerivador || '').trim() || null
    const cirujNombre = (medicoCirujano.nombre || busquedaCirujano || '').trim() || null

    const payload: Partial<AsesoriaQuirurgica> = {
      estado,
      cobertura_obra_social: (cobertura || '').trim() || null,
      medico_derivador_id: medicoDerivador.id || null,
      medico_derivador_nombre: derivNombre,
      medico_derivador_matricula: medicoDerivador.matricula || null,
      medico_cirujano_id: medicoCirujano.id || null,
      medico_cirujano_nombre: cirujNombre,
      medico_cirujano_matricula: medicoCirujano.matricula || null,
      practica_codigo: practicaCodigo || null,
      practica_nombre: cleanPracticaNombre,
      monto_extra: Number(montoExtra) || 0,
      moneda_extra: monedaExtra,
      monto_sena: Number(montoSena) || 0,
      estado_pago: estadoPago,
      medio_pago: medioPago,
      presupuesto_id: presupuestoId || null,
      fecha_probable_cirugia: fechaProbable || null,
      fecha_definitiva_cirugia: fechaDefinitiva || null,
      checklist_prequirurgico: checklist,
      proxima_accion_fecha: proximaAccionFecha || null,
      proxima_accion_texto: proximaAccionTexto || null,
      situacion_paciente: situacionPaciente || ''
    }

    onGuardar(payload)
  }

  // 1. Presupuestos emitidos estrictamente para este caso quirúrgico
  const presupuestosDelCaso = useMemo(() => {
    return presupuestos.filter((p) => p.asesoria_id === caso.id)
  }, [presupuestos, caso.id])

  // 2. Otros presupuestos del paciente no asignados a esta cirugía
  const otrosPresupuestosPaciente = useMemo(() => {
    return presupuestos.filter((p) => p.asesoria_id !== caso.id)
  }, [presupuestos, caso.id])

  const presupuestoVinculado = presupuestos.find((p) => p.id === presupuestoId)

  return (
    <div className="p-4 sm:p-5 space-y-4 bg-neutral-950/60">
      
      {/* ==================================================================== */}
      {/* 1. STEPPER DE ETAPAS QUIRÚRGICAS (COMPACTO) */}
      {/* ==================================================================== */}
      <div className="p-3 rounded-2xl bg-neutral-900/80 border border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={13} className="text-blue-400" />
            Progreso del Embudo Quirúrgico
          </span>
          <span className="text-[10px] text-gray-400 font-mono">
            Paso: <strong className="text-blue-400">{estado.toUpperCase()}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {etapas
            .filter((e) => e.id !== 'cancelado')
            .map((e, idx) => {
              const isSelected = estado === e.id
              const isOperado = e.id === 'operado'
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEstado(e.id)}
                  disabled={guardando}
                  className={`p-2 rounded-xl text-left transition-all border flex flex-col justify-between ${
                    isSelected
                      ? isOperado
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-md ring-1 ring-teal-500/30'
                        : 'bg-blue-600/20 border-blue-500 text-white shadow-md ring-1 ring-blue-500/30'
                      : 'bg-neutral-950/60 border-[var(--border)] text-gray-400 hover:bg-neutral-800 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold opacity-75">0{idx + 1}</span>
                    {isSelected && <CheckCircle2 size={12} className={isOperado ? 'text-teal-400' : 'text-blue-400'} />}
                  </div>
                  <span className="text-xs font-black truncate mt-1">{e.label.replace(/^[0-9]+\.\s*/, '')}</span>
                </button>
              )
            })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. DISTRIBUCIÓN ERGONÓMICA EN 2 COLUMNAS EQUILIBRADAS */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        
        {/* ================================================================== */}
        {/* COLUMNA IZQUIERDA: CLÍNICA, MÉDICOS & ECONÓMICA */}
        {/* ================================================================== */}
        <div className="space-y-4">
          
          {/* Card: Práctica Quirúrgica / Nomenclador */}
          <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-2 relative">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <ClipboardList size={14} className="text-indigo-400" />
              Práctica Quirúrgica (Nomenclador CRM)
            </label>

            <div className="relative">
              <input
                type="text"
                disabled={guardando}
                placeholder="Buscar código o nombre en el Nomenclador..."
                value={busquedaPractica}
                onChange={(e) => {
                  setBusquedaPractica(e.target.value)
                  setPracticaNombre(e.target.value)
                  buscarPracticasNomenclador(e.target.value)
                  setMostrarDropdownPractica(true)
                }}
                onFocus={() => {
                  buscarPracticasNomenclador(busquedaPractica)
                  setMostrarDropdownPractica(true)
                }}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-indigo-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
              />
              {buscandoPractica && (
                <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400" />
              )}

              {mostrarDropdownPractica && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-neutral-900 border border-indigo-500/40 rounded-xl shadow-2xl z-50 divide-y divide-[var(--border)]">
                  {buscandoPractica && practicasNomenclador.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin text-indigo-400" />
                      <span>Buscando en el nomenclador...</span>
                    </div>
                  ) : practicasNomenclador.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-500">
                      No se encontraron prácticas con &quot;{busquedaPractica}&quot;
                    </div>
                  ) : (
                    practicasNomenclador.map((p) => (
                      <button
                        key={p.codigo}
                        type="button"
                        onClick={() => {
                          setPracticaCodigo(p.codigo)
                          setPracticaNombre(p.nombre)
                          setBusquedaPractica(`[${p.codigo}] ${p.nombre}`)
                          if (p.precio && p.precio > 0) {
                            setMontoExtra(p.precio)
                            if (p.moneda) setMonedaExtra(p.moneda)
                          }
                          setMostrarDropdownPractica(false)
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-600/20 text-xs transition-colors group flex items-center justify-between"
                      >
                        <div className="flex flex-col pr-2">
                          <span className="font-bold text-white group-hover:text-indigo-300">
                            [{p.codigo}] {p.nombre}
                          </span>
                          {p.categoria && <span className="text-[10px] text-gray-500">{p.categoria}</span>}
                        </div>
                        {p.precio && p.precio > 0 ? (
                          <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                            {p.moneda === 'USD' ? 'USD ' : '$ '}
                            {p.precio.toLocaleString('es-AR')}
                          </span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-gray-400">Cobertura:</span>
              <input
                type="text"
                value={cobertura}
                placeholder="Particular / Obra Social"
                onChange={(e) => setCobertura(e.target.value)}
                className="flex-1 px-2 py-1 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Card: Equipo Médico (Derivador & Cirujano) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Médico Derivador */}
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-2 relative">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <UserCheck size={14} className="text-blue-400" />
                Médico Derivador
              </label>

              <div className="relative">
                <input
                  type="text"
                  disabled={guardando}
                  placeholder="Buscar en Geclisa..."
                  value={busquedaDerivador}
                  onChange={(e) => {
                    setBusquedaDerivador(e.target.value)
                    setMedicoDerivador({ nombre: e.target.value })
                    buscarPrestador('derivador', e.target.value)
                    setMostrarDropdownDerivador(true)
                  }}
                  onFocus={() => {
                    buscarPrestador('derivador', busquedaDerivador)
                    setMostrarDropdownDerivador(true)
                  }}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-blue-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
                />
                {buscandoDerivador && (
                  <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-blue-400" />
                )}

                {mostrarDropdownDerivador && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-blue-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                    {derivadoresFiltrados.length > 0 ? (
                      derivadoresFiltrados.map((p) => (
                        <button
                          key={p.pre_id}
                          type="button"
                          onClick={() => {
                            setMedicoDerivador({ id: p.pre_id, nombre: p.nombre, matricula: p.matricula })
                            setBusquedaDerivador(p.nombre)
                            setMostrarDropdownDerivador(false)
                          }}
                          className="w-full text-left p-2.5 hover:bg-blue-600/15 text-xs transition-colors group flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-white group-hover:text-blue-300">{p.nombre}</span>
                            {p.especialidad && <span className="text-[10px] text-gray-500">{p.especialidad}</span>}
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono shrink-0">Mat: {p.matricula || 'S/M'}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-gray-400 space-y-1.5">
                        <p className="text-[11px]">No se encontró &quot;{busquedaDerivador}&quot; en Geclisa.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setMedicoDerivador({ nombre: busquedaDerivador })
                            setMostrarDropdownDerivador(false)
                          }}
                          className="px-2.5 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-bold"
                        >
                          Usar médico externo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Médico Cirujano */}
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-2 relative">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Stethoscope size={14} className="text-emerald-400" />
                Médico Cirujano (Qx)
              </label>

              <div className="relative">
                <input
                  type="text"
                  disabled={guardando}
                  placeholder="Buscar en Geclisa..."
                  value={busquedaCirujano}
                  onChange={(e) => {
                    setBusquedaCirujano(e.target.value)
                    setMedicoCirujano({ nombre: e.target.value })
                    buscarPrestador('cirujano', e.target.value)
                    setMostrarDropdownCirujano(true)
                  }}
                  onFocus={() => {
                    buscarPrestador('cirujano', busquedaCirujano)
                    setMostrarDropdownCirujano(true)
                  }}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-emerald-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
                />
                {buscandoCirujano && (
                  <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                )}

                {mostrarDropdownCirujano && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-emerald-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                    {cirujanosFiltrados.length > 0 ? (
                      cirujanosFiltrados.map((p) => (
                        <button
                          key={p.pre_id}
                          type="button"
                          onClick={() => {
                            setMedicoCirujano({ id: p.pre_id, nombre: p.nombre, matricula: p.matricula })
                            setBusquedaCirujano(p.nombre)
                            setMostrarDropdownCirujano(false)
                          }}
                          className="w-full text-left p-2.5 hover:bg-emerald-600/15 text-xs transition-colors group flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-white group-hover:text-emerald-300">{p.nombre}</span>
                            {p.especialidad && <span className="text-[10px] text-gray-500">{p.especialidad}</span>}
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono shrink-0">Mat: {p.matricula || 'S/M'}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-gray-400 space-y-1.5">
                        <p className="text-[11px]">No se encontró &quot;{busquedaCirujano}&quot; en Geclisa.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setMedicoCirujano({ nombre: busquedaCirujano })
                            setMostrarDropdownCirujano(false)
                          }}
                          className="px-2.5 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold"
                        >
                          Usar cirujano externo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card: Fechas Quirúrgicas (Probable vs Definitiva) */}
          <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3">
            <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-400" />
              Programación de Fechas de Cirugía
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">Fecha Probable / Tentativa</label>
                <input
                  type="date"
                  disabled={guardando}
                  value={fechaProbable}
                  onChange={(e) => setFechaProbable(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-amber-500 rounded-xl text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-emerald-400 font-bold block mb-1">Fecha Definitiva (Fijada en Qx)</label>
                <input
                  type="date"
                  disabled={guardando}
                  value={fechaDefinitiva}
                  onChange={(e) => setFechaDefinitiva(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-emerald-500/40 focus:border-emerald-500 rounded-xl text-emerald-300 font-mono font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card: Control de Presupuesto, Cotización y Seña */}
          <div className="space-y-3">
            {/* Presupuesto Oficial Vinculado (Aislamiento Estricto por Caso) */}
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-blue-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Receipt size={14} />
                  Presupuestos Oficiales del Caso ({presupuestosDelCaso.length})
                </div>
                <button
                  type="button"
                  onClick={handleEmitirPresupuesto}
                  className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-[11px] font-bold transition-all shadow flex items-center gap-1"
                >
                  + Emitir Cotización PDF
                </button>
              </div>

              {/* Listado Exclusivo de Presupuestos de Este Caso */}
              {presupuestosDelCaso.length > 0 ? (
                <div className="space-y-2">
                  {presupuestosDelCaso.map((p) => {
                    const isPrincipal = p.id === presupuestoId
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl transition-all border ${
                          isPrincipal
                            ? 'bg-blue-950/40 border-blue-500/60 shadow-md ring-1 ring-blue-500/30'
                            : 'bg-neutral-950 border-[var(--border)] hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-white">
                                #{p.id.slice(0, 8)}
                              </span>
                              {isPrincipal && (
                                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1 shadow-sm">
                                  ⭐ Principal
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                  p.estado === 'aprobado'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                    : p.estado === 'rechazado'
                                    ? 'bg-red-950 text-red-300 border-red-500/40'
                                    : 'bg-amber-950 text-amber-300 border-amber-500/40'
                                }`}
                              >
                                {p.estado.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(p.created_at).toLocaleDateString('es-AR')}
                              </span>
                            </div>

                            {/* Ítems del presupuesto */}
                            {p.items_presupuesto && p.items_presupuesto.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {p.items_presupuesto.map((it, idx) => (
                                  <div key={idx} className="text-[11px] text-gray-300 flex items-center gap-1.5">
                                    <span className="text-gray-500">•</span>
                                    <span className="truncate">{it.nombre || 'Prestación médica'}</span>
                                    <span className="text-gray-400 font-mono text-[10px]">
                                      ({it.cantidad}x {it.moneda || 'ARS'} ${Number(it.precio_unitario || 0).toLocaleString('es-AR')})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Monto Total */}
                            <div className="mt-1.5 flex items-center gap-3 text-xs font-mono font-bold">
                              {(p.total_ars || (p.total_usd ? 0 : p.total)) > 0 && (
                                <span className="text-emerald-400">
                                  ARS ${Number(p.total_ars || p.total || 0).toLocaleString('es-AR')}
                                </span>
                              )}
                              {Number(p.total_usd || 0) > 0 && (
                                <span className="text-cyan-400">
                                  USD ${Number(p.total_usd).toLocaleString('es-AR')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Botones de acción por presupuesto */}
                          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                            {p.pdf_url && (
                              <a
                                href={p.pdf_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-blue-300 rounded-lg text-xs font-bold transition-all"
                                title="Ver / Descargar PDF Oficial"
                              >
                                <Download size={13} />
                              </a>
                            )}

                            {onEnviarPresupuestoWhatsApp && (
                              <button
                                type="button"
                                onClick={() => onEnviarPresupuestoWhatsApp(p)}
                                className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50 rounded-lg text-xs font-bold transition-all"
                                title="Enviar presupuesto por WhatsApp"
                              >
                                <Send size={13} />
                              </button>
                            )}

                            {!isPrincipal && onVincularPresupuesto && (
                              <button
                                type="button"
                                onClick={() => onVincularPresupuesto(p)}
                                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-gray-700 rounded-lg text-[10px] font-bold"
                                title="Establecer como cotización principal de esta cirugía"
                              >
                                Vincular
                              </button>
                            )}

                            {p.estado !== 'aprobado' && (
                              <button
                                type="button"
                                onClick={() => onAprobarRechazarPresupuesto(p.id, 'aprobado')}
                                className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold"
                              >
                                Aprobar
                              </button>
                            )}

                            {isPrincipal && (
                              <button
                                type="button"
                                onClick={onDesvincularPresupuesto}
                                className="px-1.5 py-1 text-gray-500 hover:text-red-400 text-[10px]"
                                title="Desvincular presupuesto"
                              >
                                Desvincular
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-neutral-950/60 border border-dashed border-gray-800 text-center py-3.5 space-y-1">
                    <p className="text-xs text-gray-400">
                      No hay presupuestos oficiales emitidos aún para este procedimiento.
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Puedes emitir una cotización membretada en PDF o fijar un monto estimado directo:
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        value={montoExtra || ''}
                        placeholder="Monto cotizado estimado directo..."
                        onChange={(e) => setMontoExtra(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-xl text-white font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <select
                      value={monedaExtra}
                      onChange={(e) => setMonedaExtra(e.target.value)}
                      className="px-2 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-xl text-gray-300 font-bold"
                    >
                      <option value="ARS">ARS ($)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Selector Opcional: Vincular presupuesto previo del paciente */}
              {otrosPresupuestosPaciente.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]/60">
                  <button
                    type="button"
                    onClick={() => setMostrarOtrosPresupuestos(!mostrarOtrosPresupuestos)}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Link2 size={12} />
                    <span>{mostrarOtrosPresupuestos ? '▲ Ocultar cotizaciones previas del paciente' : `🔗 Vincular cotización previa del paciente (${otrosPresupuestosPaciente.length})`}</span>
                  </button>

                  {mostrarOtrosPresupuestos && (
                    <div className="mt-2 space-y-1.5 p-2.5 rounded-xl bg-neutral-950 border border-blue-500/20 max-h-48 overflow-y-auto">
                      <p className="text-[10px] text-gray-400 mb-1">
                        Cotizaciones emitidas previamente al paciente que puedes asignar a esta cirugía:
                      </p>
                      {otrosPresupuestosPaciente.map((op) => (
                        <div key={op.id} className="p-2 rounded-lg bg-neutral-900/90 border border-[var(--border)] flex items-center justify-between gap-2 text-xs hover:border-gray-700">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-gray-200">#{op.id.slice(0, 8)}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-gray-300 uppercase font-bold">{op.estado}</span>
                              <span className="text-[10px] text-gray-400">{new Date(op.created_at).toLocaleDateString('es-AR')}</span>
                            </div>
                            <div className="text-[11px] font-mono text-emerald-400 font-bold mt-0.5">
                              Total: ${Number(op.total_ars || op.total || 0).toLocaleString('es-AR')} {Number(op.total_usd || 0) > 0 ? `| USD $${Number(op.total_usd).toLocaleString('es-AR')}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {op.pdf_url && (
                              <a href={op.pdf_url} target="_blank" rel="noreferrer" className="p-1 bg-neutral-800 hover:bg-neutral-700 text-blue-300 rounded text-xs" title="Ver PDF">
                                <Download size={12} />
                              </a>
                            )}
                            {onVincularPresupuesto && (
                              <button
                                type="button"
                                onClick={() => {
                                  onVincularPresupuesto(op)
                                  setMostrarOtrosPresupuestos(false)
                                }}
                                className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded text-[10px] font-bold"
                              >
                                + Asignar a este Caso
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Widget de Seña y Cobranza */}
            <CasoPagosWidget
              montoTotal={presupuestoVinculado ? Number(presupuestoVinculado.total) : montoExtra}
              moneda={monedaExtra}
              montoSena={montoSena}
              estadoPago={estadoPago}
              medioPago={medioPago}
              disabled={guardando}
              onChange={(data) => {
                setMontoSena(data.montoSena)
                setEstadoPago(data.estadoPago)
                setMedioPago(data.medioPago || null)
              }}
            />
          </div>
        </div>

        {/* ================================================================== */}
        {/* COLUMNA DERECHA: CONVERSIÓN, CHECKLIST & BITÁCORA REALTIME */}
        {/* ================================================================== */}
        <div className="space-y-4">
          
          {/* Card: Checklist Prequirúrgico Asistido */}
          <ChecklistPrequirurgico
            checklist={checklist}
            disabled={guardando}
            onChange={(nuevoChecklist) => setChecklist(nuevoChecklist)}
          />

          {/* Card: Próxima Acción de Seguimiento & WhatsApp Rápido */}
          <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Clock size={14} className="text-purple-400" />
                Próxima Acción Programada
              </div>
              
              <button
                type="button"
                onClick={onAbrirModalWhatsApp}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow"
              >
                <Send size={12} />
                WhatsApp Rápido
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <input
                  type="date"
                  value={proximaAccionFecha}
                  onChange={(e) => setProximaAccionFecha(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={proximaAccionTexto}
                  placeholder="Ej: Llamar para confirmar fecha / Solicitar estudios..."
                  onChange={(e) => setProximaAccionTexto(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white placeholder-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Card: Bitácora Cronológica de Evoluciones en Vivo */}
          <TimelineEvolucionesAsesoria
            asesoriaId={caso.id}
            pacienteId={pacienteId}
            pacienteNombre={pacienteNombre}
            disabled={false}
          />
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 3. FOOTER CON ACCIONES Y ALERTA DE CAMBIOS SIN GUARDAR */}
      {/* ==================================================================== */}
      <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Alerta de Dirty State / Cambios pendientes / Confirmación de guardado */}
        <div className="flex items-center gap-2 flex-wrap">
          {mensajeGuardado && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              {mensajeGuardado}
            </span>
          )}

          {errorAccion && (
            <span className="px-2.5 py-1 rounded-lg bg-red-950/90 text-red-300 border border-red-500/50 text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              {errorAccion}
            </span>
          )}

          {!mensajeGuardado && !errorAccion && (
            hasUnsavedChanges ? (
              <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <AlertCircle size={13} className="text-amber-400 shrink-0" />
                Tienes modificaciones sin guardar
              </span>
            ) : (
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                Datos sincronizados
              </span>
            )
          )}
        </div>

        {/* Botonera de Acciones */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={onAbrirModalCierre}
            disabled={guardando}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all"
          >
            Desistir / Cerrar Caso
          </button>

          <button
            type="button"
            onClick={onEliminar}
            disabled={guardando}
            className="p-2 bg-neutral-900 hover:bg-red-950/40 text-gray-400 hover:text-red-300 border border-[var(--border)] rounded-xl text-xs transition-all"
            title="Eliminar procedimiento"
          >
            <Trash2 size={15} />
          </button>

          <button
            type="button"
            onClick={handleGuardarCambios}
            disabled={guardando}
            className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              hasUnsavedChanges
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 ring-2 ring-blue-400/50 shadow-blue-500/20'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {guardando ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
