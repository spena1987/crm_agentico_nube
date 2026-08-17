'use client'

import React, { useState, useEffect } from 'react'
import {
  Stethoscope,
  UserCheck,
  Calendar,
  DollarSign,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Save,
  Loader2,
  Search,
  ChevronRight,
  ShieldCheck,
  User,
  X,
  Sparkles,
  FileCheck2,
  Trash2,
  Receipt,
  FileText,
  Download,
  Check,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  ShieldAlert
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import ModalCrearPresupuestoPaciente from '@/components/ModalCrearPresupuestoPaciente'
import ModalCerrarCasoQuirurgico from '@/components/ModalCerrarCasoQuirurgico'
import TimelineEvolucionesAsesoria from '@/components/TimelineEvolucionesAsesoria'

export interface PresupuestoPaciente {
  id: string
  paciente_id: string
  asesoria_id?: string | null
  estado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
  total: number
  pdf_url: string | null
  created_at: string
  items_presupuesto?: Array<{
    id: string
    servicio_id?: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    nombre?: string
  }>
}

export interface AsesoriaQuirurgica {
  id: string
  paciente_id: string
  medico_derivador_id?: number | null
  medico_derivador_nombre?: string | null
  medico_derivador_matricula?: string | null
  medico_cirujano_id?: number | null
  medico_cirujano_nombre?: string | null
  medico_cirujano_matricula?: string | null
  practica_codigo?: string | null
  practica_nombre: string
  cobertura_obra_social?: string | null
  monto_extra: number
  moneda_extra: string
  presupuesto_id?: string | null
  fecha_probable_cirugia?: string | null
  fecha_definitiva_cirugia?: string | null
  estado: 'derivado' | 'en_asesoramiento' | 'en_analisis' | 'confirmado' | 'operado' | 'cancelado'
  situacion_paciente?: string | null
  motivo_cancelacion?: string | null
  created_at: string
  updated_at: string
}

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

interface ItemCasoQuirurgicoAcordeonProps {
  caso: AsesoriaQuirurgica
  index: number
  isExpanded: boolean
  onToggle: () => void
  pacienteId: string
  pacienteNombre: string
  pacienteDni?: string | null
  pacienteTelefono?: string | null
  obraSocialDefault?: string | null
  onCasoActualizado: (casoActualizado: AsesoriaQuirurgica) => void
  onCasoEliminado: (casoId: string) => void
}

const ETAPAS: {
  id: AsesoriaQuirurgica['estado']
  label: string
  color: string
  headerBg: string
  headerBorder: string
  desc: string
}[] = [
  {
    id: 'derivado',
    label: '1. Derivado',
    color: 'border-blue-500 text-blue-400 bg-blue-500/10',
    headerBg: 'bg-gradient-to-r from-blue-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-blue-500/30 hover:border-blue-500/50',
    desc: 'Derivado desde consulta médica'
  },
  {
    id: 'en_asesoramiento',
    label: '2. En Asesoramiento',
    color: 'border-amber-500 text-amber-400 bg-amber-500/10',
    headerBg: 'bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-amber-500/30 hover:border-amber-500/50',
    desc: 'Asesorando en quirófano y presupuesto'
  },
  {
    id: 'en_analisis',
    label: '3. En Análisis',
    color: 'border-purple-500 text-purple-400 bg-purple-500/10',
    headerBg: 'bg-gradient-to-r from-purple-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-purple-500/30 hover:border-purple-500/50',
    desc: 'Paciente evalúa propuesta y autorizaciones'
  },
  {
    id: 'confirmado',
    label: '4. Cirugía Confirmada',
    color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
    headerBg: 'bg-gradient-to-r from-emerald-950/50 via-neutral-900 to-neutral-900',
    headerBorder: 'border-emerald-500/40 hover:border-emerald-500/60',
    desc: 'Fecha definitiva fijada en quirófano'
  },
  {
    id: 'operado',
    label: '5. Operado',
    color: 'border-teal-500 text-teal-300 bg-teal-500/10',
    headerBg: 'bg-gradient-to-r from-teal-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-teal-500/40 hover:border-teal-500/60',
    desc: 'Intervención realizada con éxito'
  },
  {
    id: 'cancelado',
    label: 'Cancelado / Desistido',
    color: 'border-red-500 text-red-400 bg-red-500/10',
    headerBg: 'bg-gradient-to-r from-red-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-red-500/30 hover:border-red-500/50',
    desc: 'Procedimiento cancelado o desistido'
  }
]

export default function ItemCasoQuirurgicoAcordeon({
  caso,
  index,
  isExpanded,
  onToggle,
  pacienteId,
  pacienteNombre,
  pacienteDni,
  pacienteTelefono,
  obraSocialDefault,
  onCasoActualizado,
  onCasoEliminado
}: ItemCasoQuirurgicoAcordeonProps) {
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Estado del formulario de este caso
  const [estado, setEstado] = useState<AsesoriaQuirurgica['estado']>(caso.estado || 'en_asesoramiento')
  const [medicoDerivador, setMedicoDerivador] = useState<{ id?: number | null; nombre: string; matricula?: string }>({
    id: caso.medico_derivador_id,
    nombre: caso.medico_derivador_nombre || '',
    matricula: caso.medico_derivador_matricula || ''
  })
  const [medicoCirujano, setMedicoCirujano] = useState<{ id?: number | null; nombre: string; matricula?: string }>({
    id: caso.medico_cirujano_id,
    nombre: caso.medico_cirujano_nombre || '',
    matricula: caso.medico_cirujano_matricula || ''
  })
  const [practicaCodigo, setPracticaCodigo] = useState(caso.practica_codigo || '')
  const [practicaNombre, setPracticaNombre] = useState(caso.practica_nombre || '')
  const [montoExtra, setMontoExtra] = useState<number | string>(caso.monto_extra || 0)
  const [monedaExtra, setMonedaExtra] = useState(caso.moneda_extra || 'ARS')
  const [fechaProbable, setFechaProbable] = useState(caso.fecha_probable_cirugia || '')
  const [fechaDefinitiva, setFechaDefinitiva] = useState(caso.fecha_definitiva_cirugia || '')

  // Autocompletados de Prestadores (Geclisa)
  const [busquedaDerivador, setBusquedaDerivador] = useState(caso.medico_derivador_nombre || '')
  const [prestadoresDerivador, setPrestadoresDerivador] = useState<PrestadorGeclisa[]>([])
  const [buscandoDerivador, setBuscandoDerivador] = useState(false)
  const [mostrarDropdownDerivador, setMostrarDropdownDerivador] = useState(false)

  const [busquedaCirujano, setBusquedaCirujano] = useState(caso.medico_cirujano_nombre || '')
  const [prestadoresCirujano, setPrestadoresCirujano] = useState<PrestadorGeclisa[]>([])
  const [buscandoCirujano, setBuscandoCirujano] = useState(false)
  const [mostrarDropdownCirujano, setMostrarDropdownCirujano] = useState(false)

  // Autocompletado de Prácticas (Nomenclador CRM)
  const [busquedaPractica, setBusquedaPractica] = useState(
    caso.practica_codigo ? `[${caso.practica_codigo}] ${caso.practica_nombre}` : caso.practica_nombre || ''
  )
  const [practicasNomenclador, setPracticasNomenclador] = useState<PracticaNomenclador[]>([])
  const [buscandoPractica, setBuscandoPractica] = useState(false)
  const [mostrarDropdownPractica, setMostrarDropdownPractica] = useState(false)

  // Presupuestos vinculados al paciente
  const [presupuestos, setPresupuestos] = useState<PresupuestoPaciente[]>([])
  const [cargandoPresupuestos, setCargandoPresupuestos] = useState(false)
  const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false)
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false)
  const [actualizandoEstadoPresupuestoId, setActualizandoEstadoPresupuestoId] = useState<string | null>(null)

  // Reabrir caso cerrado
  const handleReabrirCaso = async () => {
    if (!confirm(`¿Deseas reabrir la cirugía #${index + 1} y volverla a poner en asesoramiento?`)) return
    try {
      setGuardando(true)
      const payload = {
        estado: 'en_asesoramiento',
        motivo_cancelacion: null
      }
      await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await supabase.from('asesorias_quirurgicas').update({
        estado: 'en_asesoramiento',
        motivo_cancelacion: null,
        updated_at: new Date().toISOString()
      }).eq('id', caso.id)

      setEstado('en_asesoramiento')
      onCasoActualizado({ ...caso, estado: 'en_asesoramiento', motivo_cancelacion: null })
      setMensajeExito('✔ Caso quirúrgico reabierto exitosamente.')
      setTimeout(() => setMensajeExito(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Error al reabrir el caso.')
    } finally {
      setGuardando(false)
    }
  }

  // Sincronizar estado si cambian las props
  useEffect(() => {
    setEstado(caso.estado || 'en_asesoramiento')
    setMedicoDerivador({
      id: caso.medico_derivador_id,
      nombre: caso.medico_derivador_nombre || '',
      matricula: caso.medico_derivador_matricula || ''
    })
    setBusquedaDerivador(caso.medico_derivador_nombre || '')
    setMedicoCirujano({
      id: caso.medico_cirujano_id,
      nombre: caso.medico_cirujano_nombre || '',
      matricula: caso.medico_cirujano_matricula || ''
    })
    setBusquedaCirujano(caso.medico_cirujano_nombre || '')
    setPracticaCodigo(caso.practica_codigo || '')
    setPracticaNombre(caso.practica_nombre || '')
    setBusquedaPractica(
      caso.practica_codigo ? `[${caso.practica_codigo}] ${caso.practica_nombre}` : caso.practica_nombre || ''
    )
    setMontoExtra(caso.monto_extra || 0)
    setMonedaExtra(caso.moneda_extra || 'ARS')
    setFechaProbable(caso.fecha_probable_cirugia || '')
    setFechaDefinitiva(caso.fecha_definitiva_cirugia || '')
  }, [caso])

  // Cargar presupuestos vinculados
  const fetchPresupuestos = async () => {
    try {
      setCargandoPresupuestos(true)
      const res = await fetch(`/api/presupuestos/paciente/${pacienteId}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setPresupuestos(data.presupuestos || [])
      } else {
        const { data: sbPres, error: sbErr } = await supabase
          .from('presupuestos')
          .select('*, items_presupuesto(*)')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })
        if (!sbErr && sbPres) {
          setPresupuestos(sbPres as unknown as PresupuestoPaciente[])
        }
      }
    } catch (err) {
      console.error('Error cargando presupuestos:', err)
    } finally {
      setCargandoPresupuestos(false)
    }
  }

  useEffect(() => {
    if (isExpanded) {
      fetchPresupuestos()
    }
  }, [isExpanded, pacienteId])

  // Buscar prestadores en Geclisa
  const buscarPrestador = async (tipo: 'derivador' | 'cirujano', query: string) => {
    const qClean = (query || '').trim()
    if (tipo === 'derivador') setBuscandoDerivador(true)
    if (tipo === 'cirujano') setBuscandoCirujano(true)

    try {
      const res = await fetch(`/api/geclisa/prestadores/buscar?q=${encodeURIComponent(qClean)}`)
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
    const qClean = (query || '').trim()
    try {
      const res = await fetch(`/api/nomenclador/buscar-presupuesto?q=${encodeURIComponent(qClean)}`)
      const data = await res.json()

      let lista: PracticaNomenclador[] = []
      if (res.ok && data.success) {
        lista = data.resultados || data.prestaciones || []
      }

      if (lista.length === 0) {
        let sbQuery = supabase
          .from('nomenclador_practicas')
          .select('id, codigo, nombre, categoria')
          .eq('activo', true)

        if (qClean) {
          sbQuery = sbQuery.or(`codigo.ilike.%${qClean}%,nombre.ilike.%${qClean}%,categoria.ilike.%${qClean}%`)
        }

        const { data: sbData } = await sbQuery.order('nombre').limit(50)
        if (sbData) {
          lista = sbData as PracticaNomenclador[]
        }
      }

      setPracticasNomenclador(lista)
    } catch (err) {
      console.error('Error buscando práctica en nomenclador:', err)
    } finally {
      setBuscandoPractica(false)
    }
  }

  // Guardar Cambios de este Caso
  const handleGuardar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!practicaNombre.trim()) {
      setError('Debes especificar el nombre o código de la práctica/cirugía.')
      return
    }

    try {
      setGuardando(true)
      setError(null)

      const payload = {
        paciente_id: pacienteId,
        medico_derivador_id: medicoDerivador.id || null,
        medico_derivador_nombre: medicoDerivador.nombre || null,
        medico_derivador_matricula: medicoDerivador.matricula || null,
        medico_cirujano_id: medicoCirujano.id || null,
        medico_cirujano_nombre: medicoCirujano.nombre || null,
        medico_cirujano_matricula: medicoCirujano.matricula || null,
        practica_codigo: practicaCodigo || null,
        practica_nombre: practicaNombre.trim(),
        cobertura_obra_social: obraSocialDefault || null,
        monto_extra: typeof montoExtra === 'number' ? montoExtra : parseFloat(montoExtra) || 0,
        moneda_extra: monedaExtra,
        fecha_probable_cirugia: fechaProbable || null,
        fecha_definitiva_cirugia: fechaDefinitiva || null,
        estado: estado
      }

      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al guardar caso.')
      }

      setMensajeExito('✔ Caso quirúrgico actualizado correctamente.')
      setTimeout(() => setMensajeExito(null), 3000)
      onCasoActualizado(data.asesoria)
    } catch (err: any) {
      console.error('Error guardando asesoría:', err)
      setError(err.message || 'Error al guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  // Cambiar estado del presupuesto
  const handleCambiarEstadoPresupuesto = async (
    presupuestoId: string,
    nuevoEstado: 'aprobado' | 'rechazado' | 'enviado'
  ) => {
    try {
      setActualizandoEstadoPresupuestoId(presupuestoId)
      setError(null)

      // Actualización inmediata en UI
      setPresupuestos((prev) =>
        prev.map((p) => (p.id === presupuestoId ? { ...p, estado: nuevoEstado } : p))
      )

      if (nuevoEstado === 'aprobado') {
        setEstado('confirmado')
        if (!fechaDefinitiva && fechaProbable) {
          setFechaDefinitiva(fechaProbable)
        }
        setMensajeExito('✔ Presupuesto aprobado. Etapa actualizada a 4. Cirugía Confirmada.')
      } else if (nuevoEstado === 'rechazado') {
        setMensajeExito('✖ Presupuesto marcado como desistido.')
      }

      try {
        await fetch(`${BACKEND_URL}/api/presupuestos/${presupuestoId}/estado`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado: nuevoEstado,
            asesoria_id: caso.id
          })
        })
      } catch (apiErr) {
        await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', presupuestoId)
        if (nuevoEstado === 'aprobado') {
          await supabase.from('asesorias_quirurgicas').update({
            estado: 'confirmado',
            presupuesto_id: presupuestoId,
            updated_at: new Date().toISOString()
          }).eq('id', caso.id)
        }
      }

      setTimeout(() => setMensajeExito(null), 3500)
      fetchPresupuestos()
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el presupuesto.')
    } finally {
      setActualizandoEstadoPresupuestoId(null)
    }
  }

  // Eliminar caso
  const handleEliminar = async () => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la cirugía #${index + 1} (${caso.practica_nombre})?`)) return
    try {
      await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, { method: 'DELETE' })
      await supabase.from('asesorias_quirurgicas').delete().eq('id', caso.id)
      onCasoEliminado(caso.id)
    } catch (err) {
      console.error('Error al eliminar caso:', err)
      onCasoEliminado(caso.id)
    }
  }

  // Obtener estilo cromático de la etapa actual
  const etapaActualInfo = ETAPAS.find((e) => e.id === estado) || ETAPAS[1]

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${etapaActualInfo.headerBorder} bg-neutral-900/60`}>
      
      {/* ==================================================================== */}
      {/* ENCABEZADO CROMÁTICO DEL CASO (DESPLEGABLE / COLAPSABLE) */}
      {/* ==================================================================== */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full p-4 flex items-center justify-between text-left transition-colors ${etapaActualInfo.headerBg} select-none`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Badge Numérico de la Cirugía */}
          <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-neutral-950/80 text-white border border-[var(--border)] shadow-sm">
            Cirugía #{index + 1}
          </span>

          {/* Nombre de la Prestación */}
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-white tracking-tight">
              {practicaNombre || 'Procedimiento / Cirugía Pendiente'}
            </h4>
            {practicaCodigo && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 text-indigo-300 border border-indigo-500/20">
                {practicaCodigo}
              </span>
            )}
          </div>

          {/* Badge de Etapa */}
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${etapaActualInfo.color}`}>
            {etapaActualInfo.label}
          </span>

          {/* Fecha Probable / Definitiva */}
          {(fechaDefinitiva || fechaProbable) && (
            <span className="text-[11px] font-mono text-gray-300 flex items-center gap-1 bg-neutral-950/60 px-2 py-0.5 rounded-lg border border-[var(--border)]">
              <Calendar size={12} className={fechaDefinitiva ? 'text-emerald-400' : 'text-purple-400'} />
              {fechaDefinitiva ? `Definitiva: ${fechaDefinitiva}` : `Probable: ${fechaProbable}`}
            </span>
          )}

          {/* Monto Extra Cotizado */}
          {Number(montoExtra) > 0 && (
            <span className="text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1 bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-500/30">
              <DollarSign size={12} />
              $ {Number(montoExtra).toLocaleString()} {monedaExtra}
            </span>
          )}
        </div>

        {/* Ícono de Despliegue */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
            {isExpanded ? 'Contraer sector' : 'Desplegar sector'}
          </span>
          <div className="p-1 rounded-lg bg-neutral-950/70 border border-[var(--border)] text-gray-300">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* ==================================================================== */}
      {/* CUERPO INTERNO DESPLEGABLE (FORMULARIO, PRESTADORES, PRESUPUESTO & BITÁCORA) */}
      {/* ==================================================================== */}
      {isExpanded && (
        <div className="p-5 border-t border-[var(--border)] space-y-6 bg-neutral-950/30 animate-in fade-in duration-200">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle size={15} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* BANNER DE CASO CERRADO / DESISTIDO / OPERADO */}
          {(estado === 'cancelado' || estado === 'operado' || caso.motivo_cancelacion) && (
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                estado === 'operado'
                  ? 'bg-teal-950/40 border-teal-500/40 text-teal-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black flex items-center gap-2">
                    <span>
                      {estado === 'operado' ? 'Caso Cerrado: Operado con Éxito' : 'Caso Cerrado: Desistido / Cancelado'}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-neutral-950/80 border border-current">
                      Cerrado
                    </span>
                  </div>
                  <p className="text-xs text-gray-200 leading-relaxed">
                    {caso.motivo_cancelacion || 'Procedimiento cerrado formalmente.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReabrirCaso}
                disabled={guardando}
                className="px-3 py-1.5 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white border border-[var(--border)] rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
              >
                <Unlock size={13} className="text-amber-400" />
                Reabrir Caso
              </button>
            </div>
          )}

          {/* 1. STEPPER INTERACTIVO DE ETAPAS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                Etapa del Proceso Quirúrgico
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {etapaActualInfo.desc}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ETAPAS.filter((e) => e.id !== 'cancelado').map((e) => {
                const isSelected = estado === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setEstado(e.id)
                      if (e.id === 'confirmado' && !fechaDefinitiva && fechaProbable) {
                        setFechaDefinitiva(fechaProbable)
                      }
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-left flex flex-col justify-between ${
                      isSelected
                        ? `${e.color} shadow-lg scale-[1.02]`
                        : 'bg-neutral-900 border-[var(--border)] text-gray-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{e.label}</span>
                      {isSelected && <Check size={13} className="shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. GRID DE PROFESIONALES, PRÁCTICA, ASPECTOS ECONÓMICOS Y FECHAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* A. Médico Derivador (Geclisa) */}
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2 relative">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <UserCheck size={14} className="text-blue-400" />
                Médico Derivador (Consulta / Diagnóstico)
              </label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar médico derivador en Geclisa..."
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

                {mostrarDropdownDerivador && prestadoresDerivador.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-blue-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                    {prestadoresDerivador.map((p) => (
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
                        <span className="font-bold text-white group-hover:text-blue-300 transition-colors">
                          {p.nombre}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          Mat: {p.matricula || 'S/M'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* B. Médico Cirujano (Geclisa) */}
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2 relative">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Stethoscope size={14} className="text-emerald-400" />
                Médico Cirujano (Opera en Quirófano)
              </label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar cirujano en Geclisa..."
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

                {mostrarDropdownCirujano && prestadoresCirujano.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-emerald-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                    {prestadoresCirujano.map((p) => (
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
                        <span className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                          {p.nombre}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          Mat: {p.matricula || 'S/M'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* C. Práctica del Nomenclador */}
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2 relative">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <ClipboardList size={14} className="text-indigo-400" />
                Práctica Quirúrgica (Nomenclador CRM)
              </label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar práctica por código o nombre..."
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
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-indigo-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                    {practicasNomenclador.map((p, i) => (
                      <button
                        key={`${p.codigo}-${i}`}
                        type="button"
                        onClick={() => {
                          setPracticaCodigo(p.codigo)
                          setPracticaNombre(p.nombre)
                          setBusquedaPractica(`[${p.codigo}] ${p.nombre}`)
                          if (p.precio && Number(p.precio) > 0) {
                            setMontoExtra(p.precio)
                            setMonedaExtra(p.moneda || 'ARS')
                          }
                          setMostrarDropdownPractica(false)
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-600/15 text-xs transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {p.nombre}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-indigo-300 border border-indigo-500/20 shrink-0">
                            {p.codigo}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* D. Presupuesto & Condiciones Económicas */}
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Receipt size={14} className="text-amber-400" />
                  Condiciones Económicas & Presupuesto
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarModalPresupuesto(true)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} />
                  + Armar Presupuesto
                </button>
              </div>

              {presupuestos.length > 0 ? (
                <div className="p-3 rounded-xl bg-neutral-950/70 border border-[var(--border)] space-y-2.5">
                  {(() => {
                    const pActivo = presupuestos[0]
                    const isAprobado = pActivo.estado === 'aprobado'
                    const isRechazado = pActivo.estado === 'rechazado'
                    const isCargandoAccion = actualizandoEstadoPresupuestoId === pActivo.id

                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <FileText size={13} className="text-blue-400 shrink-0" />
                            <span className="text-xs font-mono font-bold text-gray-200">
                              #{pActivo.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              isAprobado
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                : isRechazado
                                ? 'bg-red-950 text-red-300 border-red-500/40'
                                : 'bg-blue-950 text-blue-300 border-blue-500/40'
                            }`}
                          >
                            {isAprobado ? 'Confirmado' : isRechazado ? 'Desistido' : 'En Análisis'}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1 border-t border-[var(--border)]/50">
                          <div className="text-base font-black font-mono text-white tracking-tight">
                            $ {Number(pActivo.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs font-semibold text-blue-300">
                            {obraSocialDefault || 'Particular'}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]/50">
                          {pActivo.pdf_url && (
                            <a
                              href={
                                pActivo.pdf_url.startsWith('http')
                                  ? pActivo.pdf_url
                                  : `${BACKEND_URL}${pActivo.pdf_url.startsWith('/') ? '' : '/'}${pActivo.pdf_url}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-[var(--border)] rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                            >
                              <Download size={12} className="text-blue-400" />
                              PDF Oficial
                            </a>
                          )}

                          {!isAprobado && (
                            <button
                              type="button"
                              disabled={isCargandoAccion}
                              onClick={() => handleCambiarEstadoPresupuesto(pActivo.id, 'aprobado')}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                            >
                              {isCargandoAccion ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} />}
                              Confirmar
                            </button>
                          )}

                          {!isRechazado && (
                            <button
                              type="button"
                              disabled={isCargandoAccion}
                              onClick={() => handleCambiarEstadoPresupuesto(pActivo.id, 'rechazado')}
                              className="px-2.5 py-1 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                            >
                              <XCircle size={12} />
                              Desistir
                            </button>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-[var(--border)] text-center space-y-2">
                  <p className="text-[11px] text-gray-400">Sin presupuesto generado aún.</p>
                  <button
                    type="button"
                    onClick={() => setMostrarModalPresupuesto(true)}
                    className="w-full py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Receipt size={13} />
                    + Armar Presupuesto
                  </button>
                </div>
              )}
            </div>

            {/* E. Fechas Probable y Definitiva */}
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Calendar size={14} className="text-purple-400" />
                Fecha Probable de Cirugía (Estimación)
              </label>
              <input
                type="date"
                value={fechaProbable}
                onChange={(e) => setFechaProbable(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-purple-500 rounded-xl text-white font-mono focus:outline-none"
              />
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/40 border border-emerald-500/20 space-y-2">
              <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <FileCheck2 size={14} className="text-emerald-400" />
                Fecha Definitiva de Cirugía (Quirófano)
              </label>
              <input
                type="date"
                value={fechaDefinitiva}
                onChange={(e) => {
                  setFechaDefinitiva(e.target.value)
                  if (e.target.value && estado !== 'confirmado' && estado !== 'operado') {
                    setEstado('confirmado')
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-emerald-500/40 focus:border-emerald-500 rounded-xl text-white font-mono focus:outline-none"
              />
            </div>

          </div>

          {/* 3. BITÁCORA CRONOLÓGICA DE EVOLUCIONES DEL ASESORAMIENTO */}
          <div className="pt-3 border-t border-[var(--border)]">
            <TimelineEvolucionesAsesoria
              asesoriaId={caso.id}
              pacienteId={pacienteId}
              pacienteNombre={pacienteNombre}
            />
          </div>

          {/* 4. FOOTER DE ACCIONES DEL CASO */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEliminar}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold transition-colors"
            >
              <Trash2 size={13} />
              Eliminar Cirugía
            </button>

            <div className="flex items-center gap-2">
              {/* Botón de Cerrar o Reabrir Caso */}
              {estado === 'cancelado' || estado === 'operado' ? (
                <button
                  type="button"
                  onClick={handleReabrirCaso}
                  disabled={guardando}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
                >
                  <Unlock size={13} />
                  Reabrir Caso
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarModalCierre(true)}
                  disabled={guardando}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-[var(--border)] hover:border-red-500/40 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
                >
                  <Lock size={13} className="text-amber-400" />
                  Cerrar Caso...
                </button>
              )}

              <button
                type="button"
                onClick={() => handleGuardar()}
                disabled={guardando}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                {guardando ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>

          {/* MODAL PRESUPUESTO */}
          <ModalCrearPresupuestoPaciente
            isOpen={mostrarModalPresupuesto}
            onClose={() => setMostrarModalPresupuesto(false)}
            pacienteId={pacienteId}
            pacienteNombre={pacienteNombre}
            pacienteDni={pacienteDni}
            pacienteTelefono={pacienteTelefono}
            obraSocial={obraSocialDefault}
            asesoriaId={caso.id}
            practicaInicial={{
              codigo: practicaCodigo,
              nombre: practicaNombre,
              precio: typeof montoExtra === 'number' ? montoExtra : parseFloat(montoExtra) || 0,
              moneda: monedaExtra
            }}
            onPresupuestoCreado={(nuevoPres) => {
              setPresupuestos((prev) => [nuevoPres, ...prev])
              setMontoExtra(nuevoPres.total)
              setMensajeExito('✔ Presupuesto emitido con éxito.')
              setTimeout(() => setMensajeExito(null), 3000)
              handleGuardar()
              fetchPresupuestos()
            }}
          />

          {/* MODAL CERRAR CASO */}
          <ModalCerrarCasoQuirurgico
            isOpen={mostrarModalCierre}
            onClose={() => setMostrarModalCierre(false)}
            casoId={caso.id}
            pacienteId={pacienteId}
            pacienteNombre={pacienteNombre}
            practicaNombre={practicaNombre}
            numeroCirugia={index + 1}
            onCasoCerrado={(casoCerrado) => {
              setEstado(casoCerrado.estado)
              onCasoActualizado({
                ...caso,
                estado: casoCerrado.estado,
                motivo_cancelacion: casoCerrado.motivo_cancelacion
              })
              setMensajeExito(
                `✔ Cirugía #${index + 1} marcada como ${
                  casoCerrado.estado === 'operado' ? 'Operada con Éxito' : 'Cancelada / Desistida'
                }.`
              )
              setTimeout(() => setMensajeExito(null), 4000)
            }}
          />

        </div>
      )}

    </div>
  )
}
