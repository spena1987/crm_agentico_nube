'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  ClipboardList, 
  Edit3, 
  Check, 
  X, 
  Plus, 
  Database, 
  ShieldCheck, 
  MapPin, 
  MessageSquare, 
  Receipt,
  Sparkles,
  Calendar,
  Stethoscope,
  Save,
  Loader2,
  User,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileHeart
} from 'lucide-react'
import ModalBuscarGeclisa from '@/components/ModalBuscarGeclisa'
import ModalEditarPaciente from '@/components/ModalEditarPaciente'
import ModalConfirmarEliminar from '@/components/ModalConfirmarEliminar'
import ModalHistoriaClinica from '@/components/ModalHistoriaClinica'

interface Paciente {
  id: string
  telefono: string
  nombre: string
  email: string | null
  geclisa_ficha_id?: number | null
  dni?: string | null
  nro_hc?: string | null
  obra_social?: string | null
  plan_cobertura?: string | null
  fecha_nacimiento?: string | null
  sexo?: string | null
  direccion?: string | null
  telefono_fijo?: string | null
  medico_cabecera?: string | null
  historial_notas: string | null
  created_at: string
}

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Estado editable para el paciente seleccionado
  const [medicoCabeceraTemp, setMedicoCabeceraTemp] = useState('')
  const [notasTemp, setNotasTemp] = useState('')
  const [guardandoNotas, setGuardandoNotas] = useState(false)
  const [guardandoMedico, setGuardandoMedico] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  // Estados de acciones (Sincronizar, Editar, Eliminar)
  const [sincronizandoGeclisa, setSincronizandoGeclisa] = useState(false)
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [eliminandoPaciente, setEliminandoPaciente] = useState(false)

  // Modales de alta e Historia Clínica
  const [mostrarModalGeclisa, setMostrarModalGeclisa] = useState(false)
  const [mostrarModalManual, setMostrarModalManual] = useState(false)
  const [mostrarModalHC, setMostrarModalHC] = useState(false)

  // Formulario manual
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevoDni, setNuevoDni] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevaObraSocial, setNuevaObraSocial] = useState('')
  const [nuevoMedico, setNuevoMedico] = useState('')
  const [errorModal, setErrorModal] = useState('')

  const fetchPacientes = async (autoSelectId?: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .order('nombre')

      if (error) throw error
      const lista = data || []
      setPacientes(lista)

      // Seleccionar paciente
      if (autoSelectId) {
        setSelectedPacienteId(autoSelectId)
      } else if (lista.length > 0 && !selectedPacienteId) {
        setSelectedPacienteId(lista[0].id)
      }
    } catch (err) {
      console.error('Error cargando pacientes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPacientes()
  }, [])

  // Paciente actualmente seleccionado
  const pacienteSeleccionado = pacientes.find((p) => p.id === selectedPacienteId) || null

  // Sincronizar estados locales cuando cambia el paciente seleccionado
  useEffect(() => {
    if (pacienteSeleccionado) {
      setNotasTemp(pacienteSeleccionado.historial_notas || '')
      setMedicoCabeceraTemp(pacienteSeleccionado.medico_cabecera || '')
      setMensajeGuardado(null)
      setErrorAccion(null)
    }
  }, [selectedPacienteId, pacienteSeleccionado?.id])

  // Callback cuando se importa un paciente desde Geclisa
  const handlePacienteImportado = (nuevoPaciente: Paciente) => {
    setPacientes((prev) => {
      const existe = prev.some((p) => p.id === nuevoPaciente.id)
      if (existe) {
        return prev.map((p) => (p.id === nuevoPaciente.id ? nuevoPaciente : p))
      }
      return [nuevoPaciente, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre))
    })
    setSelectedPacienteId(nuevoPaciente.id)
  }

  // Sincronizar datos en vivo desde Geclisa
  const handleSincronizarGeclisa = async () => {
    if (!pacienteSeleccionado) return
    setErrorAccion(null)
    setMensajeGuardado(null)
    setSincronizandoGeclisa(true)

    try {
      const res = await fetch(`/api/geclisa/pacientes/sincronizar/${pacienteSeleccionado.id}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'No se pudo sincronizar la información con Geclisa.')
      }

      const pacienteActualizado: Paciente = data.paciente
      setPacientes((prev) =>
        prev.map((p) => (p.id === pacienteActualizado.id ? pacienteActualizado : p))
      )
      setMensajeGuardado(`✔ Datos de ${pacienteActualizado.nombre} actualizados con éxito desde Geclisa.`)
      setTimeout(() => setMensajeGuardado(null), 4000)
    } catch (err: any) {
      console.error('Error sincronizando con Geclisa:', err)
      setErrorAccion(err.message || 'Error al conectar con el servidor de Geclisa.')
    } finally {
      setSincronizandoGeclisa(false)
    }
  }

  // Guardar edición de datos directamente en la base de datos del CRM (Supabase)
  const handleGuardarEdicionPaciente = async (datos: Partial<Paciente>) => {
    if (!pacienteSeleccionado) return
    setGuardandoEdicion(true)
    setErrorAccion(null)

    try {
      // Modificación exclusiva en la BD local de Supabase (sin afectar Geclisa)
      const { data, error } = await supabase
        .from('pacientes')
        .update({
          nombre: datos.nombre,
          telefono: datos.telefono,
          dni: datos.dni || null,
          nro_hc: datos.nro_hc || null,
          email: datos.email || null,
          obra_social: datos.obra_social || null,
          plan_cobertura: datos.plan_cobertura || null,
          medico_cabecera: datos.medico_cabecera || null,
          telefono_fijo: datos.telefono_fijo || null,
          direccion: datos.direccion || null,
          fecha_nacimiento: datos.fecha_nacimiento || null,
          sexo: datos.sexo || null,
        } as any)
        .eq('id', pacienteSeleccionado.id)
        .select()

      if (error) {
        throw new Error(error.message || 'Error al modificar los datos del paciente en el CRM.')
      }

      const pacienteActualizado: Paciente = (data && data[0]) ? data[0] : { ...pacienteSeleccionado, ...datos }
      setPacientes((prev) =>
        prev.map((p) => (p.id === pacienteActualizado.id ? pacienteActualizado : p)).sort((a, b) => a.nombre.localeCompare(b.nombre))
      )
      setMostrarModalEditar(false)
      setMensajeGuardado(`✔ Datos de ${pacienteActualizado.nombre} modificados correctamente en el CRM.`)
      setTimeout(() => setMensajeGuardado(null), 4000)
    } catch (err: any) {
      console.error('Error guardando modificaciones en CRM:', err)
      throw err
    } finally {
      setGuardandoEdicion(false)
    }
  }

  // Eliminar paciente exclusivamente a nivel de CRM (Supabase) con borrado en cascada
  const handleEliminarPaciente = async () => {
    if (!pacienteSeleccionado) return
    setEliminandoPaciente(true)
    setErrorAccion(null)

    try {
      const idAEliminar = pacienteSeleccionado.id
      const nombreEliminado = pacienteSeleccionado.nombre

      // Borrado en Supabase (las claves foráneas en CASCADE eliminan conversaciones, mensajes y presupuestos)
      const { error } = await supabase
        .from('pacientes')
        .delete()
        .eq('id', idAEliminar)

      if (error) {
        throw new Error(error.message || 'Error al eliminar el paciente del CRM.')
      }

      // Remover del estado local del CRM
      const listaRestante = pacientes.filter((p) => p.id !== idAEliminar)
      setPacientes(listaRestante)
      
      // Auto-seleccionar el primer paciente restante o null
      if (listaRestante.length > 0) {
        setSelectedPacienteId(listaRestante[0].id)
      } else {
        setSelectedPacienteId(null)
      }

      setMostrarModalEliminar(false)
      setMensajeGuardado(`✔ Expediente de ${nombreEliminado} eliminado correctamente del CRM.`)
      setTimeout(() => setMensajeGuardado(null), 4000)
    } catch (err: any) {
      console.error('Error eliminando paciente del CRM:', err)
      setErrorAccion(err.message || 'Error al eliminar el paciente.')
    } finally {
      setEliminandoPaciente(false)
    }
  }

  // Guardar notas médicas
  const handleSaveNotas = async () => {
    if (!selectedPacienteId) return
    try {
      setGuardandoNotas(true)
      const { error } = await supabase
        .from('pacientes')
        .update({ historial_notas: notasTemp })
        .eq('id', selectedPacienteId)

      if (error) throw error

      setPacientes((prev) =>
        prev.map((p) => (p.id === selectedPacienteId ? { ...p, historial_notas: notasTemp } : p))
      )
      setMensajeGuardado('Observaciones guardadas con éxito.')
      setTimeout(() => setMensajeGuardado(null), 3000)
    } catch (err) {
      console.error('Error guardando observaciones:', err)
    } finally {
      setGuardandoNotas(false)
    }
  }

  // Guardar médico de cabecera
  const handleSaveMedico = async () => {
    if (!selectedPacienteId) return
    try {
      setGuardandoMedico(true)
      const { error } = await supabase
        .from('pacientes')
        .update({ medico_cabecera: medicoCabeceraTemp.trim() || null })
        .eq('id', selectedPacienteId)

      if (error) throw error

      setPacientes((prev) =>
        prev.map((p) => (p.id === selectedPacienteId ? { ...p, medico_cabecera: medicoCabeceraTemp.trim() || null } : p))
      )
      setMensajeGuardado('Médico de cabecera actualizado.')
      setTimeout(() => setMensajeGuardado(null), 3000)
    } catch (err) {
      console.error('Error guardando médico de cabecera:', err)
    } finally {
      setGuardandoMedico(false)
    }
  }

  // Crear paciente manualmente
  const handleCrearPacienteManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoNombre || !nuevoTelefono) return
    setErrorModal('')

    try {
      const { data, error } = await supabase
        .from('pacientes')
        .insert({
          nombre: nuevoNombre,
          telefono: nuevoTelefono,
          dni: nuevoDni || null,
          email: nuevoEmail || null,
          obra_social: nuevaObraSocial || null,
          medico_cabecera: nuevoMedico || null,
          historial_notas: ''
        } as any)
        .select()

      if (error) {
        if (error.code === '23505') {
          setErrorModal('Este número de teléfono ya está registrado.')
        } else {
          setErrorModal(error.message || 'Error al registrar paciente.')
        }
        return
      }

      if (data && data.length > 0) {
        const nuevo = data[0]
        await supabase
          .from('conversaciones')
          .insert({ paciente_id: nuevo.id, bot_disabled: false })

        setPacientes((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        setSelectedPacienteId(nuevo.id)
      }

      // Limpiar y cerrar modal
      setNuevoNombre('')
      setNuevoTelefono('')
      setNuevoDni('')
      setNuevoEmail('')
      setNuevaObraSocial('')
      setNuevoMedico('')
      setErrorModal('')
      setMostrarModalManual(false)
    } catch (error: any) {
      console.error('Error al agregar paciente:', error)
      setErrorModal(error.message || 'Ocurrió un error inesperado.')
    }
  }

  // Calcular edad si tiene fecha de nacimiento
  const calcularEdad = (fecha?: string | null) => {
    if (!fecha) return null
    const hoy = new Date()
    const nac = new Date(fecha)
    let edad = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
      edad--
    }
    return isNaN(edad) ? null : `${edad} años`
  }

  // Filtrado de pacientes en cliente
  const filteredPacientes = pacientes.filter((p) => {
    const term = search.toLowerCase().trim()
    if (!term) return true
    return (
      p.nombre.toLowerCase().includes(term) ||
      p.telefono.includes(term) ||
      (p.dni && p.dni.includes(term)) ||
      (p.obra_social && p.obra_social.toLowerCase().includes(term)) ||
      (p.nro_hc && p.nro_hc.toLowerCase().includes(term)) ||
      (p.medico_cabecera && p.medico_cabecera.toLowerCase().includes(term))
    )
  })

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-7xl mx-auto w-full gap-3">
      
      {/* Barra Superior de Acciones Globales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Expedientes de Pacientes</h1>
          <p className="text-xs text-[var(--secondary)]">
            Gestión integral, consulta hospitalaria con Geclisa y canal de WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarModalGeclisa(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow flex items-center gap-2"
          >
            <Database size={14} />
            Buscar en Geclisa (DNI)
          </button>

          <button
            onClick={() => setMostrarModalManual(true)}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-[var(--border)] rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5"
          >
            <Plus size={14} />
            Crear Manual
          </button>
        </div>
      </div>

      {/* Estructura Split-View (Master-Detail) */}
      <div className="flex-1 flex flex-col md:flex-row border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)] shadow-lg min-h-0">
        
        {/* ==================================================================== */}
        {/* PANEL LATERAL IZQUIERDO: LISTA DE PACIENTES COMPACTA */}
        {/* ==================================================================== */}
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col bg-neutral-950/40 shrink-0 min-h-0">
          
          {/* Header del Panel Lateral & Buscador */}
          <div className="p-3.5 border-b border-[var(--border)] space-y-2.5 bg-[var(--card)] shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Users size={14} className="text-blue-500" />
                Listado ({filteredPacientes.length})
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por DNI, Nombre, HC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-900/80 border border-[var(--border)] focus:border-blue-500 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none transition-all font-mono"
              />
            </div>
          </div>

          {/* Lista Scrolleable de Pacientes */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]/50">
            {loading ? (
              <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                Cargando expedientes...
              </div>
            ) : filteredPacientes.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 space-y-2">
                <p>No se encontraron pacientes.</p>
                <button
                  onClick={() => setMostrarModalGeclisa(true)}
                  className="text-blue-400 hover:underline font-semibold text-[11px]"
                >
                  + Buscar en Geclisa
                </button>
              </div>
            ) : (
              filteredPacientes.map((paciente) => {
                const isSelected = paciente.id === selectedPacienteId
                return (
                  <button
                    key={paciente.id}
                    onClick={() => setSelectedPacienteId(paciente.id)}
                    className={`w-full text-left p-3.5 transition-all flex items-start gap-3 relative hover:bg-white/5 ${
                      isSelected 
                        ? 'bg-blue-600/10 border-l-4 border-l-blue-500 shadow-inner' 
                        : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Avatar Circular */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                      isSelected 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-neutral-800 text-gray-300 border border-[var(--border)]'
                    }`}>
                      {(paciente.nombre?.[0] || 'P').toUpperCase()}
                    </div>

                    {/* Datos Básicos: Nombre, DNI, HC */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-blue-300' : 'text-gray-200'}`}>
                          {paciente.nombre}
                        </h4>
                        {paciente.geclisa_ficha_id && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/40 shrink-0">
                            #{paciente.geclisa_ficha_id}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-gray-400 font-mono">
                        {paciente.dni ? (
                          <span>DNI: {paciente.dni}</span>
                        ) : (
                          <span className="text-gray-500">S/ DNI</span>
                        )}
                        {paciente.nro_hc && (
                          <span className="text-blue-400/80">• HC: {paciente.nro_hc}</span>
                        )}
                      </div>

                      {paciente.obra_social && (
                        <div className="text-[10px] text-gray-500 truncate mt-0.5 font-sans">
                          {paciente.obra_social}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

        </div>

        {/* ==================================================================== */}
        {/* PANEL PRINCIPAL DERECHO: DETALLE COMPLETO DEL EXPEDIENTE */}
        {/* ==================================================================== */}
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--card)] overflow-y-auto">
          {pacienteSeleccionado ? (
            <div className="p-6 space-y-6 flex-1">
              
              {/* Header del Expediente y Acciones */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/60 border border-[var(--border)] shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-xl text-white shadow-md shrink-0">
                    {(pacienteSeleccionado.nombre?.[0] || 'P').toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-extrabold text-white tracking-tight">
                        {pacienteSeleccionado.nombre}
                      </h2>
                      {pacienteSeleccionado.geclisa_ficha_id && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          Geclisa #{pacienteSeleccionado.geclisa_ficha_id}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-400 font-mono">
                      {pacienteSeleccionado.dni && (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-gray-300 border border-[var(--border)]">
                          DNI: {pacienteSeleccionado.dni}
                        </span>
                      )}
                      {pacienteSeleccionado.nro_hc && (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-blue-300 border border-[var(--border)]">
                          Historia Clínica: {pacienteSeleccionado.nro_hc}
                        </span>
                      )}
                      {pacienteSeleccionado.sexo && (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-gray-300 border border-[var(--border)]">
                          Sexo: {pacienteSeleccionado.sexo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Toolbar de Acciones del Paciente (WhatsApp, Presupuesto, Geclisa, Editar, Eliminar) */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* WhatsApp */}
                  <Link
                    href={`/chat?pacienteId=${pacienteSeleccionado.id}&telefono=${encodeURIComponent(pacienteSeleccionado.telefono)}`}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                    title="Abrir chat de WhatsApp"
                  >
                    <MessageSquare size={14} />
                    WhatsApp
                  </Link>

                  {/* Historia Clínica (Geclisa On-Demand) */}
                  <button
                    type="button"
                    onClick={() => setMostrarModalHC(true)}
                    className="px-3.5 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    title="Consultar evoluciones médicas recientes en Geclisa"
                  >
                    <FileHeart size={14} className="text-rose-400" />
                    Historia Clínica
                  </button>

                  {/* Presupuesto */}
                  <Link
                    href="/presupuestos"
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-[var(--border)] rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    title="Crear presupuesto médico"
                  >
                    <Receipt size={14} className="text-blue-400" />
                    Presupuesto
                  </Link>

                  {/* Sincronizar desde Geclisa */}
                  <button
                    type="button"
                    onClick={handleSincronizarGeclisa}
                    disabled={sincronizandoGeclisa}
                    className="px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                    title="Actualizar datos desde el servidor hospitalario Geclisa"
                  >
                    {sincronizandoGeclisa ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-blue-400" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} className="text-blue-400" />
                        Sincronizar Geclisa
                      </>
                    )}
                  </button>

                  {/* Modificar en CRM */}
                  <button
                    type="button"
                    onClick={() => setMostrarModalEditar(true)}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-[var(--border)] rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    title="Modificar todos los datos del paciente en el CRM"
                  >
                    <Edit3 size={14} className="text-amber-400" />
                    Modificar
                  </button>

                  {/* Eliminar Paciente */}
                  <button
                    type="button"
                    onClick={() => setMostrarModalEliminar(true)}
                    className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    title="Eliminar paciente y registros vinculados en cascada"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Mensajes de Feedback o Error */}
              {mensajeGuardado && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <Check size={15} className="text-emerald-400 shrink-0" />
                  <span className="font-medium">{mensajeGuardado}</span>
                </div>
              )}

              {errorAccion && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                  <span>{errorAccion}</span>
                </div>
              )}

              {/* Grilla de Información Médica, Demográfica y Contacto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Médico de Cabecera (Editable) */}
                <div className="p-4 rounded-xl bg-neutral-900/50 border border-[var(--border)] space-y-2">
                  <label className="text-xs font-bold text-indigo-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Stethoscope size={14} className="text-indigo-400" />
                      Médico de Cabecera / Tratante
                    </span>
                    {medicoCabeceraTemp !== (pacienteSeleccionado.medico_cabecera || '') && (
                      <span className="text-[10px] text-amber-400 font-semibold">• Cambios sin guardar</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Dr. Carlos Martínez (Ginecología / Fertilidad)"
                      value={medicoCabeceraTemp}
                      onChange={(e) => setMedicoCabeceraTemp(e.target.value)}
                      className="flex-1 px-3 py-2 bg-neutral-900 border border-[var(--border)] focus:border-indigo-500 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleSaveMedico}
                      disabled={guardandoMedico}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                    >
                      {guardandoMedico ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Guardar
                    </button>
                  </div>
                </div>

                {/* 2. Cobertura Médica / Obra Social */}
                <div className="p-4 rounded-xl bg-neutral-900/50 border border-[var(--border)] space-y-1.5">
                  <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-blue-400" />
                    Obra Social & Plan
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {pacienteSeleccionado.obra_social || 'Particular / Sin cobertura registrada'}
                  </div>
                  {pacienteSeleccionado.plan_cobertura && (
                    <div className="text-[11px] text-gray-400">
                      Plan: <span className="font-semibold text-gray-300">{pacienteSeleccionado.plan_cobertura}</span>
                    </div>
                  )}
                </div>

                {/* 3. Datos de Contacto */}
                <div className="p-4 rounded-xl bg-neutral-900/50 border border-[var(--border)] space-y-2">
                  <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Phone size={14} className="text-emerald-400" />
                    Canales de Contacto
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium">WhatsApp:</span>
                      <span className="font-mono text-emerald-400 font-semibold">{pacienteSeleccionado.telefono}</span>
                    </div>
                    {pacienteSeleccionado.telefono_fijo && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium">Fijo:</span>
                        <span className="font-mono">{pacienteSeleccionado.telefono_fijo}</span>
                      </div>
                    )}
                    {pacienteSeleccionado.email && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium">Email:</span>
                        <span className="truncate">{pacienteSeleccionado.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Fecha de Nacimiento y Ubicación */}
                <div className="p-4 rounded-xl bg-neutral-900/50 border border-[var(--border)] space-y-2">
                  <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Calendar size={14} className="text-amber-400" />
                    Datos Demográficos & Domicilio
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    {pacienteSeleccionado.fecha_nacimiento && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium">Nacimiento:</span>
                        <span>
                          {pacienteSeleccionado.fecha_nacimiento}{' '}
                          {calcularEdad(pacienteSeleccionado.fecha_nacimiento) && (
                            <span className="text-gray-400 font-semibold">
                              ({calcularEdad(pacienteSeleccionado.fecha_nacimiento)})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {pacienteSeleccionado.direccion && (
                      <div className="flex items-start gap-2">
                        <MapPin size={13} className="text-red-400 shrink-0 mt-0.5" />
                        <span className="text-gray-300">{pacienteSeleccionado.direccion}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Sección de Observaciones & Notas Clínicas */}
              <div className="p-5 rounded-2xl bg-neutral-900/40 border border-[var(--border)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-500" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Observaciones Médicas, Diagnósticos & Seguimiento
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveNotas}
                    disabled={guardandoNotas}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
                  >
                    {guardandoNotas ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        Guardar Observaciones
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  value={notasTemp}
                  onChange={(e) => setNotasTemp(e.target.value)}
                  rows={6}
                  placeholder="Registra antecedentes clínicos, indicaciones médicas, alergias, motivos de consulta y seguimiento del paciente..."
                  className="w-full p-4 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-all text-white placeholder-gray-500 leading-relaxed"
                />
              </div>

            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-[var(--border)] flex items-center justify-center text-gray-500 shadow-inner">
                <User size={30} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Selecciona un paciente del lateral izquierdo</h3>
                <p className="text-xs text-[var(--secondary)] max-w-sm">
                  Haz clic sobre cualquier expediente para ver su información médica, sincronizar con Geclisa, modificar o iniciar conversaciones por WhatsApp.
                </p>
              </div>
              <button
                onClick={() => setMostrarModalGeclisa(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-2 transition-colors shadow"
              >
                <Database size={14} />
                Buscar paciente en Geclisa por DNI
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Modal Buscar en Geclisa */}
      <ModalBuscarGeclisa
        isOpen={mostrarModalGeclisa}
        onClose={() => setMostrarModalGeclisa(false)}
        onPacienteImportado={handlePacienteImportado}
      />

      {/* Modal Modificar Datos en CRM */}
      <ModalEditarPaciente
        isOpen={mostrarModalEditar}
        paciente={pacienteSeleccionado}
        guardando={guardandoEdicion}
        onClose={() => setMostrarModalEditar(false)}
        onSave={handleGuardarEdicionPaciente}
      />

      {/* Modal Confirmar Eliminación en Cascada */}
      <ModalConfirmarEliminar
        isOpen={mostrarModalEliminar}
        nombrePaciente={pacienteSeleccionado?.nombre || 'este paciente'}
        eliminando={eliminandoPaciente}
        onClose={() => setMostrarModalEliminar(false)}
        onConfirm={handleEliminarPaciente}
      />

      {/* Modal Historia Clínica On-Demand (Evoluciones Recientes Geclisa) */}
      <ModalHistoriaClinica
        isOpen={mostrarModalHC}
        onClose={() => setMostrarModalHC(false)}
        paciente={pacienteSeleccionado}
      />

      {/* Modal para Crear Paciente Manual */}
      {mostrarModalManual && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="text-blue-500" size={18} />
                Agregar Paciente Manual
              </h2>
              <button
                onClick={() => setMostrarModalManual(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCrearPacienteManual} className="space-y-3.5">
              {errorModal && (
                <p className="text-xs text-red-400 font-bold bg-red-950/30 p-2.5 rounded-xl border border-red-900/40">
                  {errorModal}
                </p>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">Teléfono (WhatsApp) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 5492615551234"
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">DNI</label>
                  <input
                    type="text"
                    placeholder="Ej: 34123456"
                    value={nuevoDni}
                    onChange={(e) => setNuevoDni(e.target.value)}
                    className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Obra Social</label>
                  <input
                    type="text"
                    placeholder="Ej: OSDE"
                    value={nuevaObraSocial}
                    onChange={(e) => setNuevaObraSocial(e.target.value)}
                    className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">Médico de Cabecera (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Dr. Carlos Martínez"
                  value={nuevoMedico}
                  onChange={(e) => setNuevoMedico(e.target.value)}
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">Email (Opcional)</label>
                <input
                  type="email"
                  placeholder="Ej: juan.perez@email.com"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => { setMostrarModalManual(false); setErrorModal(''); }}
                  className="px-4 py-2 border border-[var(--border)] rounded-xl text-gray-400 hover:bg-neutral-800 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow"
                >
                  Guardar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
