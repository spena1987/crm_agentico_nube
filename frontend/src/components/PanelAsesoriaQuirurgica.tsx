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
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

interface PanelAsesoriaQuirurgicaProps {
  pacienteId: string
  pacienteNombre: string
  obraSocialDefault?: string | null
}

const ETAPAS: { id: AsesoriaQuirurgica['estado']; label: string; color: string; desc: string }[] = [
  { id: 'derivado', label: '1. Derivado', color: 'border-blue-500 text-blue-400 bg-blue-500/10', desc: 'Derivado desde consulta médica' },
  { id: 'en_asesoramiento', label: '2. En Asesoramiento', color: 'border-amber-500 text-amber-400 bg-amber-500/10', desc: 'Asesorando en quirófano y presupuesto' },
  { id: 'en_analisis', label: '3. En Análisis', color: 'border-purple-500 text-purple-400 bg-purple-500/10', desc: 'Paciente evalúa propuesta y autorizaciones' },
  { id: 'confirmado', label: '4. Cirugía Confirmada', color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10', desc: 'Fecha definitiva fijada en quirófano' },
  { id: 'operado', label: '5. Operado', color: 'border-teal-500 text-teal-300 bg-teal-500/10', desc: 'Intervención realizada con éxito' },
]

export default function PanelAsesoriaQuirurgica({
  pacienteId,
  pacienteNombre,
  obraSocialDefault
}: PanelAsesoriaQuirurgicaProps) {
  const [asesorias, setAsesorias] = useState<AsesoriaQuirurgica[]>([])
  const [asesoriaActivaId, setAsesoriaActivaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Estado del formulario de la asesoría activa
  const [estado, setEstado] = useState<AsesoriaQuirurgica['estado']>('en_asesoramiento')
  const [medicoDerivador, setMedicoDerivador] = useState<{ id?: number | null; nombre: string; matricula?: string }>({ nombre: '' })
  const [medicoCirujano, setMedicoCirujano] = useState<{ id?: number | null; nombre: string; matricula?: string }>({ nombre: '' })
  const [practicaCodigo, setPracticaCodigo] = useState('')
  const [practicaNombre, setPracticaNombre] = useState('')
  const [montoExtra, setMontoExtra] = useState<number | string>(0)
  const [monedaExtra, setMonedaExtra] = useState('ARS')
  const [fechaProbable, setFechaProbable] = useState('')
  const [fechaDefinitiva, setFechaDefinitiva] = useState('')
  const [situacionPaciente, setSituacionPaciente] = useState('')
  const [motivoCancelacion, setMotivoCancelacion] = useState('')

  // Autocompletados de Prestadores (Geclisa)
  const [busquedaDerivador, setBusquedaDerivador] = useState('')
  const [prestadoresDerivador, setPrestadoresDerivador] = useState<PrestadorGeclisa[]>([])
  const [buscandoDerivador, setBuscandoDerivador] = useState(false)
  const [mostrarDropdownDerivador, setMostrarDropdownDerivador] = useState(false)

  const [busquedaCirujano, setBusquedaCirujano] = useState('')
  const [prestadoresCirujano, setPrestadoresCirujano] = useState<PrestadorGeclisa[]>([])
  const [buscandoCirujano, setBuscandoCirujano] = useState(false)
  const [mostrarDropdownCirujano, setMostrarDropdownCirujano] = useState(false)

  // Autocompletado de Prácticas (Nomenclador CRM)
  const [busquedaPractica, setBusquedaPractica] = useState('')
  const [practicasNomenclador, setPracticasNomenclador] = useState<PracticaNomenclador[]>([])
  const [buscandoPractica, setBuscandoPractica] = useState(false)
  const [mostrarDropdownPractica, setMostrarDropdownPractica] = useState(false)

  // Cargar asesorías del paciente
  const fetchAsesorias = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/asesorias-quirurgicas/paciente/${pacienteId}`)
      const data = await res.json()

      if (res.ok && data.success) {
        const lista: AsesoriaQuirurgica[] = data.asesorias || []
        setAsesorias(lista)
        if (lista.length > 0) {
          setAsesoriaActivaId(lista[0].id)
          cargarAsesoriaEnFormulario(lista[0])
        } else {
          setAsesoriaActivaId(null)
          resetFormulario()
        }
      } else {
        // Fallback directo a Supabase
        const { data: sbData, error: sbErr } = await supabase
          .from('asesorias_quirurgicas')
          .select('*')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })

        if (!sbErr && sbData) {
          const lista = sbData as AsesoriaQuirurgica[]
          setAsesorias(lista)
          if (lista.length > 0) {
            setAsesoriaActivaId(lista[0].id)
            cargarAsesoriaEnFormulario(lista[0])
          } else {
            resetFormulario()
          }
        }
      }
    } catch (err: any) {
      console.error('Error cargando asesorías:', err)
      setError(err.message || 'Error al cargar casos quirúrgicos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pacienteId) {
      fetchAsesorias()
    }
  }, [pacienteId])

  // Cargar datos de una asesoría específica en los inputs
  const cargarAsesoriaEnFormulario = (item: AsesoriaQuirurgica) => {
    setEstado(item.estado)
    setMedicoDerivador({
      id: item.medico_derivador_id,
      nombre: item.medico_derivador_nombre || '',
      matricula: item.medico_derivador_matricula || ''
    })
    setBusquedaDerivador(item.medico_derivador_nombre ? `${item.medico_derivador_nombre} (Mat: ${item.medico_derivador_matricula || 'S/M'})` : '')
    
    setMedicoCirujano({
      id: item.medico_cirujano_id,
      nombre: item.medico_cirujano_nombre || '',
      matricula: item.medico_cirujano_matricula || ''
    })
    setBusquedaCirujano(item.medico_cirujano_nombre ? `${item.medico_cirujano_nombre} (Mat: ${item.medico_cirujano_matricula || 'S/M'})` : '')

    setPracticaCodigo(item.practica_codigo || '')
    setPracticaNombre(item.practica_nombre || '')
    setBusquedaPractica(item.practica_codigo ? `[${item.practica_codigo}] ${item.practica_nombre}` : item.practica_nombre || '')

    setMontoExtra(item.monto_extra || 0)
    setMonedaExtra(item.moneda_extra || 'ARS')
    setFechaProbable(item.fecha_probable_cirugia || '')
    setFechaDefinitiva(item.fecha_definitiva_cirugia || '')
    setSituacionPaciente(item.situacion_paciente || '')
    setMotivoCancelacion(item.motivo_cancelacion || '')
  }

  const resetFormulario = () => {
    setEstado('en_asesoramiento')
    setMedicoDerivador({ nombre: '' })
    setBusquedaDerivador('')
    setMedicoCirujano({ nombre: '' })
    setBusquedaCirujano('')
    setPracticaCodigo('')
    setPracticaNombre('')
    setBusquedaPractica('')
    setMontoExtra(0)
    setMonedaExtra('ARS')
    setFechaProbable('')
    setFechaDefinitiva('')
    setSituacionPaciente('')
    setMotivoCancelacion('')
  }

  // Buscar Médicos en Geclisa
  const buscarPrestadoresGeclisa = async (query: string, tipo: 'derivador' | 'cirujano') => {
    if (!query || query.length < 2) return
    try {
      if (tipo === 'derivador') setBuscandoDerivador(true)
      else setBuscandoCirujano(true)

      const res = await fetch(`/api/geclisa/prestadores/buscar?query=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (res.ok && data.success) {
        if (tipo === 'derivador') {
          setPrestadoresDerivador(data.prestadores || [])
          setMostrarDropdownDerivador(true)
        } else {
          setPrestadoresCirujano(data.prestadores || [])
          setMostrarDropdownCirujano(true)
        }
      }
    } catch (err) {
      console.error('Error buscando prestadores:', err)
    } finally {
      if (tipo === 'derivador') setBuscandoDerivador(false)
      else setBuscandoCirujano(false)
    }
  }

  // Buscar Prácticas en el Nomenclador
  const buscarPracticas = async (query: string) => {
    if (!query || query.length < 2) return
    try {
      setBuscandoPractica(true)
      const res = await fetch(`/api/nomenclador/buscar-presupuesto?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setPracticasNomenclador(data.prestaciones || [])
        setMostrarDropdownPractica(true)
      }
    } catch (err) {
      console.error('Error buscando prácticas:', err)
    } finally {
      setBuscandoPractica(false)
    }
  }

  // Guardar o Actualizar Caso Quirúrgico
  const handleGuardar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!practicaNombre.trim()) {
      setError('Debes especificar el nombre o código de la práctica quirúrgica solicitada.')
      return
    }

    setGuardando(true)
    setError(null)
    setMensajeExito(null)

    const payload = {
      paciente_id: pacienteId,
      medico_derivador_id: medicoDerivador.id || null,
      medico_derivador_nombre: medicoDerivador.nombre || null,
      medico_derivador_matricula: medicoDerivador.matricula || null,
      medico_cirujano_id: medicoCirujano.id || null,
      medico_cirujano_nombre: medicoCirujano.nombre || null,
      medico_cirujano_matricula: medicoCirujano.matricula || null,
      practica_codigo: practicaCodigo.trim() || null,
      practica_nombre: practicaNombre.trim(),
      cobertura_obra_social: obraSocialDefault || null,
      monto_extra: Number(montoExtra) || 0,
      moneda_extra: monedaExtra,
      fecha_probable_cirugia: fechaProbable || null,
      fecha_definitiva_cirugia: fechaDefinitiva || null,
      estado: estado,
      situacion_paciente: situacionPaciente.trim() || null,
      motivo_cancelacion: motivoCancelacion.trim() || null
    }

    try {
      let asesoriaGuardada: AsesoriaQuirurgica | null = null

      if (asesoriaActivaId) {
        // Actualizar existente
        const res = await fetch(`/api/asesorias-quirurgicas/${asesoriaActivaId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (res.ok && data.success) {
          asesoriaGuardada = data.asesoria
        } else {
          // Fallback Supabase
          const { data: sbData, error: sbErr } = await supabase
            .from('asesorias_quirurgicas')
            .update(payload as any)
            .eq('id', asesoriaActivaId)
            .select()
          if (sbErr) throw sbErr
          asesoriaGuardada = sbData ? sbData[0] as AsesoriaQuirurgica : null
        }
      } else {
        // Crear nueva
        const res = await fetch(`/api/asesorias-quirurgicas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (res.ok && data.success) {
          asesoriaGuardada = data.asesoria
        } else {
          // Fallback Supabase
          const { data: sbData, error: sbErr } = await supabase
            .from('asesorias_quirurgicas')
            .insert(payload as any)
            .select()
          if (sbErr) throw sbErr
          asesoriaGuardada = sbData ? sbData[0] as AsesoriaQuirurgica : null
        }
      }

      if (asesoriaGuardada) {
        setMensajeExito('✔ Caso de asesoramiento quirúrgico guardado correctamente.')
        setTimeout(() => setMensajeExito(null), 3500)
        fetchAsesorias()
      }
    } catch (err: any) {
      console.error('Error guardando asesoría:', err)
      setError(err.message || 'Error al guardar el caso quirúrgico.')
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar asesoría
  const handleEliminarAsesoria = async () => {
    if (!asesoriaActivaId) return
    if (!confirm('¿Estás seguro de que deseas eliminar este caso quirúrgico?')) return

    try {
      setGuardando(true)
      await fetch(`/api/asesorias-quirurgicas/${asesoriaActivaId}`, { method: 'DELETE' })
      await supabase.from('asesorias_quirurgicas').delete().eq('id', asesoriaActivaId)
      setMensajeExito('Caso quirúrgico eliminado.')
      setTimeout(() => setMensajeExito(null), 3000)
      fetchAsesorias()
    } catch (err: any) {
      setError(err.message || 'Error al eliminar.')
    } finally {
      setGuardando(false)
    }
  }

  // Crear nuevo caso quirúrgico en blanco
  const handleIniciarNuevaAsesoria = () => {
    setAsesoriaActivaId(null)
    resetFormulario()
    setMensajeExito('Formulario preparado para registrar un nuevo caso quirúrgico.')
    setTimeout(() => setMensajeExito(null), 3000)
  }

  return (
    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-[var(--border)] shadow-md space-y-5">
      
      {/* Header del Caso Quirúrgico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white tracking-tight">
                Sector de Asesoramiento Quirúrgico & Cirugías
              </h3>
              {asesorias.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  {asesorias.length} {asesorias.length === 1 ? 'caso' : 'casos'}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Registro de médico derivador, cirujano, práctica solicitada, extras y fechas de quirófano.
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleIniciarNuevaAsesoria}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-[var(--border)] rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} />
            + Nueva Cirugía
          </button>

          <button
            type="button"
            onClick={() => handleGuardar()}
            disabled={guardando}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow"
          >
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar Caso
          </button>
        </div>
      </div>

      {/* Historial de Pestañas si tiene más de 1 Asesoría */}
      {asesorias.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Casos:</span>
          {asesorias.map((a, idx) => {
            const isSelected = a.id === asesoriaActivaId
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAsesoriaActivaId(a.id)
                  cargarAsesoriaEnFormulario(a)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm' 
                    : 'bg-neutral-900 border-[var(--border)] text-gray-400 hover:text-white'
                }`}
              >
                #{idx + 1} {a.practica_nombre || 'Cirugía'} ({a.estado.replace('_', ' ')})
              </button>
            )
          })}
        </div>
      )}

      {/* Alertas de Feedback */}
      {mensajeExito && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. BARRA DE ETAPAS INTERACTIVA (PIPELINE QUIRÚRGICO) */}
      {/* ==================================================================== */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={13} className="text-indigo-400" />
          Etapa del Proceso Quirúrgico (Haz clic para cambiar de estado)
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ETAPAS.map((etapa) => {
            const isCurrent = estado === etapa.id
            return (
              <button
                key={etapa.id}
                type="button"
                onClick={() => setEstado(etapa.id)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isCurrent 
                    ? etapa.color + ' shadow-md ring-1 ring-white/20' 
                    : 'bg-neutral-900/60 border-[var(--border)] text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                <div className="text-xs font-bold truncate">{etapa.label}</div>
                <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{etapa.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. FORMULARIO ESTRUCTURADO DEL CASO */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* A. Médico Derivador (Geclisa) */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2 relative">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <UserCheck size={14} className="text-blue-400" />
            Médico Derivador (Indicó la cirugía en consulta)
          </label>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar médico en Geclisa por nombre o matrícula..."
              value={busquedaDerivador}
              onChange={(e) => {
                setBusquedaDerivador(e.target.value)
                setMedicoDerivador({ nombre: e.target.value })
                buscarPrestadoresGeclisa(e.target.value, 'derivador')
              }}
              onFocus={() => {
                if (prestadoresDerivador.length > 0) setMostrarDropdownDerivador(true)
              }}
              className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-blue-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
            />
            {buscandoDerivador && (
              <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-blue-400" />
            )}

            {/* Dropdown de Prestadores Geclisa */}
            {mostrarDropdownDerivador && prestadoresDerivador.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-blue-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                {prestadoresDerivador.map((p) => (
                  <button
                    key={p.pre_id}
                    type="button"
                    onClick={() => {
                      setMedicoDerivador({
                        id: p.pre_id,
                        nombre: p.nombre,
                        matricula: p.matricula
                      })
                      setBusquedaDerivador(`${p.nombre} (Mat: ${p.matricula || 'S/M'})`)
                      setMostrarDropdownDerivador(false)
                    }}
                    className="w-full text-left p-2.5 hover:bg-blue-600/10 text-xs transition-colors"
                  >
                    <div className="font-bold text-white">{p.nombre}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Matrícula: {p.matricula || 'S/M'} {p.especialidad && `• ${p.especialidad}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {medicoDerivador.id && (
            <div className="text-[10px] text-blue-400 font-mono">
              ✔ Vinculado a Geclisa Prestador #{medicoDerivador.id}
            </div>
          )}
        </div>

        {/* B. Médico Cirujano / Operador (Geclisa) */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2 relative">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Stethoscope size={14} className="text-emerald-400" />
            Médico Cirujano / Operador (Quién va a operar)
          </label>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cirujano en Geclisa por nombre o matrícula..."
              value={busquedaCirujano}
              onChange={(e) => {
                setBusquedaCirujano(e.target.value)
                setMedicoCirujano({ nombre: e.target.value })
                buscarPrestadoresGeclisa(e.target.value, 'cirujano')
              }}
              onFocus={() => {
                if (prestadoresCirujano.length > 0) setMostrarDropdownCirujano(true)
              }}
              className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-emerald-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
            />
            {buscandoCirujano && (
              <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
            )}

            {/* Dropdown de Prestadores Geclisa */}
            {mostrarDropdownCirujano && prestadoresCirujano.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-emerald-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                {prestadoresCirujano.map((p) => (
                  <button
                    key={p.pre_id}
                    type="button"
                    onClick={() => {
                      setMedicoCirujano({
                        id: p.pre_id,
                        nombre: p.nombre,
                        matricula: p.matricula
                      })
                      setBusquedaCirujano(`${p.nombre} (Mat: ${p.matricula || 'S/M'})`)
                      setMostrarDropdownCirujano(false)
                    }}
                    className="w-full text-left p-2.5 hover:bg-emerald-600/10 text-xs transition-colors"
                  >
                    <div className="font-bold text-white">{p.nombre}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Matrícula: {p.matricula || 'S/M'} {p.especialidad && `• ${p.especialidad}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {medicoCirujano.id && (
            <div className="text-[10px] text-emerald-400 font-mono">
              ✔ Vinculado a Geclisa Cirujano #{medicoCirujano.id}
            </div>
          )}
        </div>

        {/* C. Práctica del Nomenclador */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2 relative">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <ClipboardList size={14} className="text-indigo-400" />
            Prestación / Práctica Requerida (Nomenclador) *
          </label>
          
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Buscar práctica (ej: FIV-ICSI, Laparoscopía, Histero)..."
              value={busquedaPractica}
              onChange={(e) => {
                setBusquedaPractica(e.target.value)
                setPracticaNombre(e.target.value)
                buscarPracticas(e.target.value)
              }}
              onFocus={() => {
                if (practicasNomenclador.length > 0) setMostrarDropdownPractica(true)
              }}
              className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-indigo-500 rounded-xl text-white placeholder-gray-500 focus:outline-none font-medium"
            />
            {buscandoPractica && (
              <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400" />
            )}

            {/* Dropdown Nomenclador */}
            {mostrarDropdownPractica && practicasNomenclador.length > 0 && (
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
                    className="w-full text-left p-2.5 hover:bg-indigo-600/10 text-xs transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{p.nombre}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-indigo-300">
                        {p.codigo}
                      </span>
                    </div>
                    {p.precio && (
                      <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        Arancel Base: ${p.precio.toLocaleString()} {p.moneda || 'ARS'}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {practicaCodigo && (
            <div className="text-[10px] text-indigo-400 font-mono">
              Código Nomenclador: {practicaCodigo}
            </div>
          )}
        </div>

        {/* D. Aspectos Económicos: Extras a Abonar */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <DollarSign size={14} className="text-amber-400" />
            Condiciones Económicas & Extras / Copagos
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-semibold">Monto Extra a Pagar</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoExtra}
                onChange={(e) => setMontoExtra(e.target.value)}
                placeholder="0.00"
                className="px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-amber-500 rounded-xl text-white font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-semibold">Moneda</span>
              <select
                value={monedaExtra}
                onChange={(e) => setMonedaExtra(e.target.value)}
                className="px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-amber-500 rounded-xl text-white font-mono focus:outline-none"
              >
                <option value="ARS">ARS ($ Pesos)</option>
                <option value="USD">USD (U$S Dólares)</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-gray-400">
            Cobertura: <span className="text-white font-semibold">{obraSocialDefault || 'Particular'}</span>
          </div>
        </div>

        {/* E. Planificación de Fechas (Probable y Definitiva) */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-[var(--border)] space-y-2">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Calendar size={14} className="text-purple-400" />
            Fecha Probable de Cirugía (Estimación inicial)
          </label>
          
          <input
            type="date"
            value={fechaProbable}
            onChange={(e) => setFechaProbable(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-purple-500 rounded-xl text-white font-mono focus:outline-none"
          />
          <span className="text-[10px] text-gray-500">
            Fecha tentativa mientras el paciente analiza la propuesta.
          </span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/40 border border-emerald-500/20 space-y-2">
          <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <FileCheck2 size={14} className="text-emerald-400" />
            Fecha Definitiva de Cirugía (Quirófano Confirmado)
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
          <span className="text-[10px] text-emerald-400/80">
            Se fija cuando el paciente retorna y confirma que se opera.
          </span>
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 3. SITUACIÓN DEL PACIENTE & PROPUESTA OFRECIDA */}
      {/* ==================================================================== */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ClipboardList size={14} className="text-blue-400" />
            Situación del Paciente, Propuesta Ofrecida & Evolución del Asesoramiento
          </span>
          {asesoriaActivaId && (
            <button
              type="button"
              onClick={handleEliminarAsesoria}
              className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 size={12} />
              Eliminar Caso
            </button>
          )}
        </label>

        <textarea
          value={situacionPaciente}
          onChange={(e) => setSituacionPaciente(e.target.value)}
          rows={4}
          placeholder="Registra aquí: lo que se le ofreció, dudas planteadas por el paciente, requisitos prequirúrgicos acordados, autorizaciones pendientes y motivos de seguimiento..."
          className="w-full p-3.5 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-all text-white placeholder-gray-500 leading-relaxed"
        />
      </div>

    </div>
  )
}
