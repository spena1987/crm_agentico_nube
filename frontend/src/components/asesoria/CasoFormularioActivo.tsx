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
  Pencil,
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
  Tag,
  Eye,
  X,
  Info,
  Printer,
  FileSignature,
  BellRing,
  Plus,
  Building2
} from 'lucide-react'
import { AsesoriaQuirurgica, PresupuestoPaciente } from '@/components/ItemCasoQuirurgicoAcordeon'
import ChecklistPrequirurgico from '@/components/ChecklistPrequirurgico'
import TimelineEvolucionesAsesoria from '@/components/TimelineEvolucionesAsesoria'
import CasoPagosWidget from './CasoPagosWidget'
import ModalEnviarConsentimientoWhatsApp from '@/components/ModalEnviarConsentimientoWhatsApp'
import { apiFetch, BACKEND_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

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
  onAbrirRecordatorioQx?: () => void
  onAbrirModalCierre: () => void
  onEliminar: () => void
  onAprobarRechazarPresupuesto: (presupuestoId: string, nuevoEstado: 'aprobado' | 'rechazado') => Promise<void> | void
  onDesvincularPresupuesto: () => void
  onVincularPresupuesto?: (presupuesto: PresupuestoPaciente) => void
  onEnviarPresupuestoWhatsApp?: (presupuesto: PresupuestoPaciente) => void
  onModificarPresupuesto?: (presupuesto: PresupuestoPaciente) => void
  onEliminarPresupuesto?: (presupuestoId: string) => Promise<void> | void
}

const sumarDiasFecha = (fechaStr: string, dias: number): string => {
  if (!fechaStr) return ''
  try {
    const d = new Date(fechaStr + 'T00:00:00')
    d.setDate(d.getDate() + dias)
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

const calcularDiferenciaDias = (fecha1: string, fecha2: string): number | null => {
  if (!fecha1 || !fecha2) return null
  try {
    const d1 = new Date(fecha1 + 'T00:00:00')
    const d2 = new Date(fecha2 + 'T00:00:00')
    const diffTime = d2.getTime() - d1.getTime()
    return Math.round(diffTime / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
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
  onAbrirRecordatorioQx,
  onAbrirModalCierre,
  onEliminar,
  onAprobarRechazarPresupuesto,
  onDesvincularPresupuesto,
  onVincularPresupuesto,
  onEnviarPresupuestoWhatsApp,
  onModificarPresupuesto,
  onEliminarPresupuesto
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
  
  // Soporte Multimoneda nativo para Señas
  const pagosIniciales = ((caso.checklist_prequirurgico as any)?._pagos) || {}
  const [senaArs, setSenaArs] = useState<number>(() => {
    if (pagosIniciales.sena_ars !== undefined) return Number(pagosIniciales.sena_ars)
    return caso.moneda_extra !== 'USD' ? Number(caso.monto_sena || 0) : 0
  })
  const [senaUsd, setSenaUsd] = useState<number>(() => {
    if (pagosIniciales.sena_usd !== undefined) return Number(pagosIniciales.sena_usd)
    return caso.moneda_extra === 'USD' ? Number(caso.monto_sena || 0) : 0
  })

  const [estadoPago, setEstadoPago] = useState<'pendiente' | 'seniado' | 'totalmente_cobrado'>(
    caso.estado_pago || 'pendiente'
  )
  const [medioPago, setMedioPago] = useState<string | null>(caso.medio_pago || null)
  const [presupuestoId, setPresupuestoId] = useState<string | null>(caso.presupuesto_id || null)

  // Lateralidad y Modalidad Bilateral
  const metaBilateralInicial = ((caso.checklist_prequirurgico as any)?._meta_bilateral) || {}
  const [ojo, setOjo] = useState<'OD' | 'OI' | 'AO'>((caso.ojo as any) || 'OD')
  const [modalidadBilateral, setModalidadBilateral] = useState<'escalonada' | 'simultanea'>(
    metaBilateralInicial.modalidad || (caso.ojo === 'AO' ? 'escalonada' : 'escalonada')
  )
  const [ordenOjos, setOrdenOjos] = useState<'OD_primero' | 'OI_primero'>(
    metaBilateralInicial.orden || 'OD_primero'
  )
  const [fechaProbable2doOjo, setFechaProbable2doOjo] = useState<string>(
    metaBilateralInicial.fecha_probable_2do_ojo || (caso as any).fecha_probable_2do_ojo || ''
  )
  const [fechaDefinitiva2doOjo, setFechaDefinitiva2doOjo] = useState<string>(
    metaBilateralInicial.fecha_definitiva_2do_ojo || (caso as any).fecha_definitiva_2do_ojo || ''
  )
  // Selección de LIO Comercial / Genérico en Lateralidad
  const lioSeleccionInicial = ((caso.checklist_prequirurgico as any)?._lio_seleccion) || {
    estado: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo) ? 'confirmado' : 'a_definir',
    lente_nombre: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo || ''),
    modalidad_bilateral: 'mismo_lente',
    lente_od: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo || ''),
    lente_oi: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo || ''),
    observaciones: ''
  }
  const [lioSeleccion, setLioSeleccion] = useState<any>(lioSeleccionInicial)
  const [catalogoLios, setCatalogoLios] = useState<any[]>([])
  const [practicaRequiereLente, setPracticaRequiereLente] = useState(false)
  const [adoptandoLio, setAdoptandoLio] = useState(false)

  // Fechas
  const [fechaProbable, setFechaProbable] = useState(caso.fecha_probable_cirugia || '')
  const [fechaDefinitiva, setFechaDefinitiva] = useState(caso.fecha_definitiva_cirugia || '')

  // Checklist y Notas
  const [checklist, setChecklist] = useState<Record<string, any>>(caso.checklist_prequirurgico || {})
  const [proximaAccionFecha, setProximaAccionFecha] = useState(caso.proxima_accion_fecha || '')
  const [proximaAccionTexto, setProximaAccionTexto] = useState(caso.proxima_accion_texto || '')
  const [situacionPaciente, setSituacionPaciente] = useState(caso.situacion_paciente || '')
  const [avisoValidacion, setAvisoValidacion] = useState<string | null>(null)

  // Seguimiento Automatizado, Snooze y Causa
  const [seguimientoAutoActivo, setSeguimientoAutoActivo] = useState<boolean>(caso.seguimiento_auto_activo ?? true)
  const [snoozeHasta, setSnoozeHasta] = useState<string>(caso.snooze_hasta || '')
  const [categoriaCausa, setCategoriaCausa] = useState<string>(caso.categoria_causa || '')
  const [motivoDemora, setMotivoDemora] = useState<string>(caso.motivo_demora || '')
  const [guardandoSeguimiento, setGuardandoSeguimiento] = useState<boolean>(false)
  const [feedbackSeguimiento, setFeedbackSeguimiento] = useState<string | null>(null)

  // Consentimiento Informado (Dual: WhatsApp Digital & Impresión en Papel)
  const [consentimiento, setConsentimiento] = useState<any>(null)
  const [esBilateralConsentimiento, setEsBilateralConsentimiento] = useState<boolean>(false)
  const [primerOjoConsentimiento, setPrimerOjoConsentimiento] = useState<any>(null)
  const [segundoOjoConsentimiento, setSegundoOjoConsentimiento] = useState<any>(null)
  const [cargandoConsentimiento, setCargandoConsentimiento] = useState(false)
  const [enviandoConsentimientoWa, setEnviandoConsentimientoWa] = useState(false)
  const [modalConsentimientoWhatsAppOpen, setModalConsentimientoWhatsAppOpen] = useState(false)
  const [modalOjoObjetivo, setModalOjoObjetivo] = useState<string | undefined>(undefined)
  const [mostrandoModalFirmaPapel, setMostrandoModalFirmaPapel] = useState(false)
  const [ojoObjetivoFirmaPapel, setOjoObjetivoFirmaPapel] = useState<'primer_ojo' | 'segundo_ojo' | 'ambos'>('ambos')
  const [obsFirmaPapel, setObsFirmaPapel] = useState('')
  const [guardandoFirmaPapel, setGuardandoFirmaPapel] = useState(false)
  const [feedbackConsentimiento, setFeedbackConsentimiento] = useState<{ tipo: 'ok' | 'err'; mensaje: string } | null>(null)

  // Estados interactivos para Próxima Acción Programada
  const [mostrandoCompletarAccion, setMostrandoCompletarAccion] = useState(false)
  const [conclusionAccion, setConclusionAccion] = useState('')
  const [completandoAccion, setCompletandoAccion] = useState(false)
  const [editandoProximaAccion, setEditandoProximaAccion] = useState(false)

  const aplicarPresetFecha = (dias: number) => {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setProximaAccionFecha(`${yyyy}-${mm}-${dd}`)
  }

  const handleConfirmarCompletarAccion = async () => {
    try {
      setCompletandoAccion(true)
      const payload = {
        resultado: conclusionAccion.trim() || 'Acción completada con éxito.',
        usuario_nombre: 'Asesora Quirúrgica',
        tipo_contacto: 'llamada'
      }

      let completado = false
      try {
        const res = await apiFetch(`/api/asesorias-quirurgicas/${caso.id}/completar-proxima-accion`, {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            completado = true
          }
        }
      } catch (e) {
        console.warn('Backend endpoint no disponible, completando por Supabase fallback:', e)
      }

      if (!completado) {
        const fechaPautada = caso.proxima_accion_fecha || 'Sin fecha'
        const textoPautado = caso.proxima_accion_texto || 'Contacto de seguimiento'
        await supabase.from('asesoria_evoluciones').insert({
          asesoria_id: caso.id,
          paciente_id: pacienteId,
          usuario_nombre: 'Asesora Quirúrgica',
          tipo_contacto: 'llamada',
          contenido: `✅ ACCIÓN PROGRAMADA CUMPLIDA:\n• Tarea pautada: ${textoPautado} (${fechaPautada})\n• Conclusión: ${conclusionAccion.trim() || 'Realizada con éxito.'}`,
          fecha_contacto: new Date().toISOString()
        })
        await supabase.from('asesorias_quirurgicas').update({
          proxima_accion_fecha: null,
          proxima_accion_texto: null,
          ultimo_contacto_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', caso.id)
      }

      setProximaAccionFecha('')
      setProximaAccionTexto('')
      setMostrandoCompletarAccion(false)
      setConclusionAccion('')
      setEditandoProximaAccion(false)

      await onGuardar({
        proxima_accion_fecha: null,
        proxima_accion_texto: null
      })
    } catch (err: any) {
      console.error('Error al completar próxima acción:', err)
    } finally {
      setCompletandoAccion(false)
    }
  }

  // Handlers para Consentimiento Informado Quirúrgico
  const fetchConsentimientoCaso = async () => {
    if (!caso?.id) return
    try {
      setCargandoConsentimiento(true)
      const res = await apiFetch(`/api/asesorias-quirurgicas/${caso.id}/consentimiento`)
      if (res.ok) {
        const data = await res.json()
        if (data?.ok) {
          setEsBilateralConsentimiento(Boolean(data.es_bilateral_escalonada))
          setPrimerOjoConsentimiento(data.primer_ojo || null)
          setSegundoOjoConsentimiento(data.segundo_ojo || null)
          setConsentimiento(data.consentimiento || null)
        }
      }
    } catch (err: any) {
      console.warn('No se pudo cargar consentimiento:', err?.message)
    } finally {
      setCargandoConsentimiento(false)
    }
  }

  useEffect(() => {
    fetchConsentimientoCaso()
  }, [caso?.id])

  const handleEnviarConsentimientoWA = async (ojoObjetivo: string = 'ambos') => {
    if (!caso?.id) return
    try {
      setEnviandoConsentimientoWa(true)
      setFeedbackConsentimiento(null)
      const res = await apiFetch(`/api/asesorias-quirurgicas/${caso.id}/enviar-consentimiento-wa?ojo_objetivo=${encodeURIComponent(ojoObjetivo)}`, {
        method: 'POST'
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setFeedbackConsentimiento({ tipo: 'ok', mensaje: data.mensaje || 'Consentimiento enviado por WhatsApp con éxito.' })
        await fetchConsentimientoCaso()
      } else {
        setFeedbackConsentimiento({ tipo: 'err', mensaje: data?.detail || 'Error al enviar por WhatsApp.' })
      }
    } catch (err: any) {
      setFeedbackConsentimiento({ tipo: 'err', mensaje: err?.message || 'Error de conexión al enviar WhatsApp.' })
    } finally {
      setEnviandoConsentimientoWa(false)
    }
  }

  const handleRegistrarFirmaPapel = async () => {
    if (!caso?.id) return
    try {
      setGuardandoFirmaPapel(true)
      setFeedbackConsentimiento(null)
      const res = await apiFetch(`/api/asesorias-quirurgicas/${caso.id}/registrar-firma-papel`, {
        method: 'POST',
        body: JSON.stringify({
          observaciones: obsFirmaPapel.trim(),
          ojo_objetivo: ojoObjetivoFirmaPapel
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setFeedbackConsentimiento({ tipo: 'ok', mensaje: 'Firma en papel registrada y sincronizada con Quirófano.' })
        setMostrandoModalFirmaPapel(false)
        setObsFirmaPapel('')
        setChecklist((prev: any) => ({
          ...(prev || {}),
          consentimiento_firmado: true,
          _consentimiento_modo: 'papel'
        }))
        await fetchConsentimientoCaso()
      } else {
        setFeedbackConsentimiento({ tipo: 'err', mensaje: data?.detail || 'Error al registrar firma en papel.' })
      }
    } catch (err: any) {
      setFeedbackConsentimiento({ tipo: 'err', mensaje: err?.message || 'Error de conexión al registrar firma.' })
    } finally {
      setGuardandoFirmaPapel(false)
    }
  }

  const handleImprimirConsentimientoPapel = (ojo?: string) => {
    const backendUrl = BACKEND_URL || ''
    const url = `${backendUrl}/api/asesorias-quirurgicas/${caso.id}/consentimiento-pdf?modo=papel${ojo ? `&ojo=${ojo}` : ''}`
    window.open(url, '_blank')
  }

  const handleVerConsentimientoFirmado = (ojo?: string, turnoId?: string) => {
    const backendUrl = BACKEND_URL || ''
    const query = [
      ojo ? `ojo=${ojo}` : null,
      turnoId ? `turno_id=${turnoId}` : null
    ].filter(Boolean).join('&')
    const url = `${backendUrl}/api/asesorias-quirurgicas/${caso.id}/consentimiento-pdf${query ? `?${query}` : ''}`
    window.open(url, '_blank')
  }

  const abrirModalWhatsApp = (ojo?: string) => {
    setModalOjoObjetivo(ojo)
    setModalConsentimientoWhatsAppOpen(true)
  }

  const abrirModalFirmaPapel = (ojoObjetivo: 'primer_ojo' | 'segundo_ojo' | 'ambos' = 'ambos') => {
    setOjoObjetivoFirmaPapel(ojoObjetivo)
    setMostrandoModalFirmaPapel(true)
  }

  // Turnos activos en Quirófano
  const turnosActivos = useMemo(() => {
    const list = caso.turnos_activos || (caso as any).turnos_quirofano || []
    return Array.isArray(list) ? list.filter((t: any) => t.estado !== 'cancelado') : []
  }, [caso.turnos_activos, (caso as any).turnos_quirofano])

  // Salas de Quirófano disponibles en el Sanatorio / Clínica
  const [quirofanos, setQuirofanos] = useState<any[]>([])
  const [cargandoQuirofanos, setCargandoQuirofanos] = useState(false)

  // Asignación de Turno en Quirófano (1° Ojo / Turno Principal)
  const [quirofanoId, setQuirofanoId] = useState<string>('')
  const [horaInicio, setHoraInicio] = useState<string>('08:00')
  const [duracionMinutos, setDuracionMinutos] = useState<number>(45)
  const [turnosFecha, setTurnosFecha] = useState<any[]>([])
  const [bloqueosFecha, setBloqueosFecha] = useState<any[]>([])
  const [cargandoAgendaFecha, setCargandoAgendaFecha] = useState(false)

  // Asignación de Turno en Quirófano para 2° Ojo (Bilateral Escalonada)
  const [quirofanoId2doOjo, setQuirofanoId2doOjo] = useState<string>('')
  const [horaInicio2doOjo, setHoraInicio2doOjo] = useState<string>('08:00')
  const [duracionMinutos2doOjo, setDuracionMinutos2doOjo] = useState<number>(45)
  const [turnosFecha2doOjo, setTurnosFecha2doOjo] = useState<any[]>([])
  const [bloqueosFecha2doOjo, setBloqueosFecha2doOjo] = useState<any[]>([])
  const [cargandoAgendaFecha2doOjo, setCargandoAgendaFecha2doOjo] = useState(false)

  // Cargar salas de quirófano activas al montar
  useEffect(() => {
    const cargarSalas = async () => {
      try {
        setCargandoQuirofanos(true)
        const res = await apiFetch('/api/quirofanos?solo_activos=true')
        if (res.ok) {
          const data = await res.json()
          const salas = data.quirofanos || data || []
          setQuirofanos(salas)
        }
      } catch (e) {
        console.error('Error cargando quirofanos:', e)
      } finally {
        setCargandoQuirofanos(false)
      }
    }
    cargarSalas()
  }, [])

  // Sincronizar quirófano y horarios desde turnos activos existentes
  useEffect(() => {
    if (turnosActivos.length > 0) {
      if (ojo === 'AO' && modalidadBilateral === 'escalonada') {
        const segundoOjo = ordenOjos === 'OD_primero' ? 'OI' : 'OD'
        const primerOjo = ordenOjos === 'OD_primero' ? 'OD' : 'OI'

        const turno1 = turnosActivos.find((t: any) => (t.ojo || '').toUpperCase() === primerOjo) || turnosActivos[0]
        if (turno1) {
          if (!fechaDefinitiva && turno1.fecha_cirugia) setFechaDefinitiva(turno1.fecha_cirugia)
          if (turno1.quirofano_id) setQuirofanoId(turno1.quirofano_id)
          if (turno1.hora_inicio) setHoraInicio(turno1.hora_inicio.slice(0, 5))
          if (turno1.duracion_minutos) setDuracionMinutos(Number(turno1.duracion_minutos))
        }

        const turno2 = turnosActivos.find((t: any) => (t.ojo || '').toUpperCase() === segundoOjo)
        if (turno2) {
          if (!fechaDefinitiva2doOjo && turno2.fecha_cirugia) setFechaDefinitiva2doOjo(turno2.fecha_cirugia)
          if (turno2.quirofano_id) setQuirofanoId2doOjo(turno2.quirofano_id)
          if (turno2.hora_inicio) setHoraInicio2doOjo(turno2.hora_inicio.slice(0, 5))
          if (turno2.duracion_minutos) setDuracionMinutos2doOjo(Number(turno2.duracion_minutos))
        }
      } else {
        const turnoUnico = turnosActivos.find((t: any) => (t.ojo || '').toUpperCase() === ojo) || turnosActivos[0]
        if (turnoUnico) {
          if (!fechaDefinitiva && turnoUnico.fecha_cirugia) setFechaDefinitiva(turnoUnico.fecha_cirugia)
          if (turnoUnico.quirofano_id) setQuirofanoId(turnoUnico.quirofano_id)
          if (turnoUnico.hora_inicio) setHoraInicio(turnoUnico.hora_inicio.slice(0, 5))
          if (turnoUnico.duracion_minutos) setDuracionMinutos(Number(turnoUnico.duracion_minutos))
        }
      }
    }
  }, [turnosActivos, ojo, modalidadBilateral, ordenOjos])

  // Cargar agenda de la fecha definitiva (1° ojo / Principal)
  useEffect(() => {
    if (!fechaDefinitiva) {
      setTurnosFecha([])
      setBloqueosFecha([])
      return
    }
    const cargarAgenda = async () => {
      try {
        setCargandoAgendaFecha(true)
        const [resT, resB] = await Promise.all([
          apiFetch(`/api/turnos-quirofano?fecha_desde=${fechaDefinitiva}&fecha_hasta=${fechaDefinitiva}`),
          apiFetch(`/api/quirofano-bloqueos?fecha_desde=${fechaDefinitiva}&fecha_hasta=${fechaDefinitiva}`)
        ])
        if (resT.ok) {
          const dataT = await resT.json()
          setTurnosFecha(dataT.turnos || dataT || [])
        }
        if (resB.ok) {
          const dataB = await resB.json()
          setBloqueosFecha(dataB.bloqueos || dataB || [])
        }
      } catch (e) {
        console.error('Error cargando agenda de la fecha:', e)
      } finally {
        setCargandoAgendaFecha(false)
      }
    }
    cargarAgenda()
  }, [fechaDefinitiva])

  // Cargar agenda de la fecha definitiva (2° ojo)
  useEffect(() => {
    if (!fechaDefinitiva2doOjo || ojo !== 'AO' || modalidadBilateral !== 'escalonada') {
      setTurnosFecha2doOjo([])
      setBloqueosFecha2doOjo([])
      return
    }
    const cargarAgenda2 = async () => {
      try {
        setCargandoAgendaFecha2doOjo(true)
        const [resT, resB] = await Promise.all([
          apiFetch(`/api/turnos-quirofano?fecha_desde=${fechaDefinitiva2doOjo}&fecha_hasta=${fechaDefinitiva2doOjo}`),
          apiFetch(`/api/quirofano-bloqueos?fecha_desde=${fechaDefinitiva2doOjo}&fecha_hasta=${fechaDefinitiva2doOjo}`)
        ])
        if (resT.ok) {
          const dataT = await resT.json()
          setTurnosFecha2doOjo(dataT.turnos || dataT || [])
        }
        if (resB.ok) {
          const dataB = await resB.json()
          setBloqueosFecha2doOjo(dataB.bloqueos || dataB || [])
        }
      } catch (e) {
        console.error('Error cargando agenda 2do ojo:', e)
      } finally {
        setCargandoAgendaFecha2doOjo(false)
      }
    }
    cargarAgenda2()
  }, [fechaDefinitiva2doOjo, ojo, modalidadBilateral])

  // Helpers para cálculo de slots y disponibilidad horaria
  const horaAMinutos = (hStr: string) => {
    if (!hStr) return 0
    const [h, m] = hStr.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const minutosAHora = (min: number) => {
    const h = Math.floor(min / 60) % 24
    const m = min % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const generarSlotsHorarios = (qActual: any) => {
    const horaIni = qActual?.hora_apertura || '07:00'
    const horaFin = qActual?.hora_cierre || '20:00'
    const slotMin = qActual?.duracion_slot_minutos || 15

    const [hI, mI] = horaIni.split(':').map(Number)
    const [hF, mF] = horaFin.split(':').map(Number)

    const startMin = (hI || 7) * 60 + (mI || 0)
    const endMin = (hF || 20) * 60 + (mF || 0)

    const slots: string[] = []
    for (let m = startMin; m < endMin; m += slotMin) {
      const h = Math.floor(m / 60)
      const min = m % 60
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
    }
    return slots
  }

  const getSlotInfo = (
    slotHora: string,
    qId: string,
    fecha: string,
    turnosList: any[],
    bloqueosList: any[],
    turnoExcluirId?: string
  ) => {
    const slotMin = horaAMinutos(slotHora)

    // 1. Bloqueo
    const bloqueo = (bloqueosList || []).find((b: any) => {
      if (b.quirofano_id && b.quirofano_id !== qId) return false
      if (b.fecha_desde && b.fecha_desde > fecha) return false
      if (b.fecha_hasta && b.fecha_hasta < fecha) return false
      if (!b.hora_inicio || !b.hora_fin) return true
      const bIni = horaAMinutos(b.hora_inicio)
      const bFin = horaAMinutos(b.hora_fin)
      return slotMin >= bIni && slotMin < bFin
    })
    if (bloqueo) {
      return { estado: 'bloqueado', label: `⛔ ${slotHora} hs • Bloqueado (${bloqueo.motivo || 'Mantenimiento'})` }
    }

    // 2. Turno solapado
    const turnoSolapado = (turnosList || []).find((t: any) => {
      if (t.estado === 'cancelado') return false
      if (turnoExcluirId && t.id === turnoExcluirId) return false
      if (t.asesoria_id && t.asesoria_id === caso.id) return false
      if (t.quirofano_id !== qId || t.fecha_cirugia !== fecha) return false
      const tIni = horaAMinutos(t.hora_inicio)
      const dur = Number(t.duracion_minutos) || 30
      const tFin = tIni + dur
      return slotMin >= tIni && slotMin < tFin
    })
    if (turnoSolapado) {
      const pacNom = turnoSolapado.pacientes?.nombre || turnoSolapado.cirujano_nombre || 'Paciente'
      return { estado: 'ocupado', label: `🔴 ${slotHora} hs • Ocupado (${pacNom})` }
    }

    return { estado: 'libre', label: `🟢 ${slotHora} hs • Disponible` }
  }

  // Datos biométricos de LIO calculados
  const chkData = checklist || {}
  const lioOD = chkData._lio_calculo_OD
  const lioOI = chkData._lio_calculo_OI
  const esCalcOD = Boolean(lioOD?.lio_calculado)
  const esCalcOI = Boolean(lioOI?.lio_calculado)
  const tieneLioCalculado = Boolean(caso.lio_calculado || esCalcOD || esCalcOI || chkData._lio_calculado)

  // Validación asistida al hacer clic en las etapas del stepper
  const handleCambiarEstadoStepper = (nuevoEstado: AsesoriaQuirurgica['estado']) => {
    setAvisoValidacion(null)
    const cleanPractica = (practicaNombre || busquedaPractica || '').trim()
    const cirujNombre = (medicoCirujano.nombre || busquedaCirujano || '').trim()

    // Validar requisitos para etapas avanzadas
    if (['confirmado', 'programado', 'operado'].includes(nuevoEstado)) {
      const faltantes: string[] = []
      if (!cleanPractica || cleanPractica === 'Nueva Cirugía / Procedimiento' || cleanPractica === 'Práctica Quirúrgica a Determinar') {
        faltantes.push('Práctica Quirúrgica (Nomenclador)')
      }
      if (!ojo) {
        faltantes.push('Lateralidad / Ojo')
      }
      if (!cirujNombre) {
        faltantes.push('Médico Cirujano')
      }

      if (faltantes.length > 0) {
        setAvisoValidacion(`⚠️ Para avanzar a [${nuevoEstado.toUpperCase()}], configure los siguientes datos obligatorios: ${faltantes.join(', ')}.`)
        setTimeout(() => setAvisoValidacion(null), 6000)
        return
      }
    }

    setEstado(nuevoEstado)
  }

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
      senaArs !== (pagosIniciales.sena_ars !== undefined ? Number(pagosIniciales.sena_ars) : (caso.moneda_extra !== 'USD' ? Number(caso.monto_sena || 0) : 0)) ||
      senaUsd !== (pagosIniciales.sena_usd !== undefined ? Number(pagosIniciales.sena_usd) : (caso.moneda_extra === 'USD' ? Number(caso.monto_sena || 0) : 0)) ||
      estadoPago !== (caso.estado_pago || 'pendiente') ||
      medioPago !== (caso.medio_pago || null) ||
      presupuestoId !== (caso.presupuesto_id || null) ||
      fechaProbable !== (caso.fecha_probable_cirugia || '') ||
      fechaDefinitiva !== (caso.fecha_definitiva_cirugia || '') ||
      fechaProbable2doOjo !== (metaBilateralInicial.fecha_probable_2do_ojo || '') ||
      fechaDefinitiva2doOjo !== (metaBilateralInicial.fecha_definitiva_2do_ojo || '') ||
      ojo !== (caso.ojo || 'OD') ||
      modalidadBilateral !== (metaBilateralInicial.modalidad || 'escalonada') ||
      ordenOjos !== (metaBilateralInicial.orden || 'OD_primero') ||
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
    senaArs,
    senaUsd,
    pagosIniciales,
    estadoPago,
    medioPago,
    presupuestoId,
    fechaProbable,
    fechaDefinitiva,
    fechaProbable2doOjo,
    fechaDefinitiva2doOjo,
    ojo,
    modalidadBilateral,
    ordenOjos,
    metaBilateralInicial,
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
  const casoEstadoAnteriorRef = React.useRef(caso.estado)

  // Sincronizar estados locales cuando cambia el caso de forma segura (sin sobreescribir ediciones activas)
  useEffect(() => {
    const esCambioDeCaso = casoIdAnteriorRef.current !== caso.id
    casoIdAnteriorRef.current = caso.id

    const estServidor = (caso.estado === 'presupuesto_enviado' ? 'en_analisis' : caso.estado) as AsesoriaQuirurgica['estado']
    const cambioEstadoServidor = casoEstadoAnteriorRef.current !== caso.estado
    casoEstadoAnteriorRef.current = caso.estado

    // Si el estado en el servidor cambió externamente (ej: enviado por WhatsApp -> en_analisis)
    if (cambioEstadoServidor) {
      setEstado(estServidor)
    }

    // Si cambió de caso, o si no hay cambios locales sucios, sincronizar todo
    if (esCambioDeCaso || !hasUnsavedChanges) {
      setEstado(estServidor)
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
      const pagosSync = ((caso.checklist_prequirurgico as any)?._pagos) || {}
      setSenaArs(
        pagosSync.sena_ars !== undefined
          ? Number(pagosSync.sena_ars)
          : (caso.moneda_extra !== 'USD' ? Number(caso.monto_sena || 0) : 0)
      )
      setSenaUsd(
        pagosSync.sena_usd !== undefined
          ? Number(pagosSync.sena_usd)
          : (caso.moneda_extra === 'USD' ? Number(caso.monto_sena || 0) : 0)
      )
      setEstadoPago(caso.estado_pago || 'pendiente')
      setMedioPago(caso.medio_pago || null)
      setPresupuestoId(caso.presupuesto_id || null)
      setFechaProbable(caso.fecha_probable_cirugia || '')
      setFechaDefinitiva(caso.fecha_definitiva_cirugia || '')
      setChecklist(caso.checklist_prequirurgico || {})
      setProximaAccionFecha(caso.proxima_accion_fecha || '')
      setProximaAccionTexto(caso.proxima_accion_texto || '')
      setSituacionPaciente(caso.situacion_paciente || '')
      const lioSync = ((caso.checklist_prequirurgico as any)?._lio_seleccion) || {
        estado: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo) ? 'confirmado' : 'a_definir',
        lente_nombre: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo || ''),
        modalidad_bilateral: 'mismo_lente',
        lente_od: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo || ''),
        lente_oi: ((caso.checklist_prequirurgico as any)?.lente_tipo || (caso as any).lente_tipo || ''),
        observaciones: ''
      }
      setLioSeleccion(lioSync)
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

  // 1. Presupuestos emitidos estrictamente para este caso quirúrgico
  const presupuestosDelCaso = useMemo(() => {
    return presupuestos.filter((p) => p.asesoria_id === caso.id)
  }, [presupuestos, caso.id])

  // 2. Otros presupuestos del paciente no asignados a esta cirugía
  const otrosPresupuestosPaciente = useMemo(() => {
    return presupuestos.filter((p) => p.asesoria_id !== caso.id)
  }, [presupuestos, caso.id])

  const presupuestoVinculado = presupuestos.find((p) => p.id === presupuestoId)

  // Totales multimoneda derivados del presupuesto vinculado o monto extra
  const { calcTotalArs, calcTotalUsd } = useMemo(() => {
    if (presupuestoVinculado) {
      const pArs = Number(presupuestoVinculado.total_ars || 0)
      const pUsd = Number(presupuestoVinculado.total_usd || 0)
      if (pArs > 0 || pUsd > 0) {
        return { calcTotalArs: pArs, calcTotalUsd: pUsd }
      }
      if (monedaExtra === 'USD') {
        return { calcTotalArs: 0, calcTotalUsd: Number(presupuestoVinculado.total || 0) }
      } else {
        return { calcTotalArs: Number(presupuestoVinculado.total || 0), calcTotalUsd: 0 }
      }
    }
    if (monedaExtra === 'USD') {
      return { calcTotalArs: 0, calcTotalUsd: Number(montoExtra || 0) }
    } else {
      return { calcTotalArs: Number(montoExtra || 0), calcTotalUsd: 0 }
    }
  }, [presupuestoVinculado, montoExtra, monedaExtra])

  // Detección de práctica que requiere LIO y catálogo comercial
  useEffect(() => {
    const pNom = (practicaNombre || caso.practica_nombre || '').toLowerCase()
    const pCod = (practicaCodigo || caso.practica_codigo || '').toLowerCase()
    const esCatarata = pNom.includes('catarata') || pNom.includes('faco') || pCod.includes('34031') || pNom.includes('lio')

    const targetCod = practicaCodigo || caso.practica_codigo
    if (targetCod) {
      fetch(`${BACKEND_URL}/api/nomenclador/resumen-operativo/${encodeURIComponent(targetCod)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.resumen) {
            setPracticaRequiereLente(!!data.resumen.requiere_lente || esCatarata)
          } else {
            setPracticaRequiereLente(esCatarata)
          }
        })
        .catch(() => setPracticaRequiereLente(esCatarata))
    } else {
      setPracticaRequiereLente(esCatarata)
    }

    const liosUrl = targetCod
      ? `${BACKEND_URL}/api/nomenclador/lios-comerciales?practica_id=${encodeURIComponent(targetCod)}`
      : `${BACKEND_URL}/api/nomenclador/lios-comerciales`

    fetch(liosUrl)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.lios) {
          setCatalogoLios(data.lios)
        }
      })
      .catch((err) => console.error('Error cargando catálogo LIOs:', err))
  }, [practicaCodigo, practicaNombre, caso.practica_codigo, caso.practica_nombre])

  // Atajo para adoptar el LIO cotizado en el presupuesto del paciente
  const handleAdoptarLioDelPresupuesto = async () => {
    try {
      setAdoptandoLio(true)
      let pId = presupuestoId || caso.presupuesto_id
      let presData: any = null

      if (pId) {
        const res = await fetch(`${BACKEND_URL}/api/presupuestos/${pId}`)
        if (res.ok) {
          const d = await res.json()
          presData = d.presupuesto || d
        }
      }

      if (!presData && caso.paciente_id) {
        const res = await fetch(`${BACKEND_URL}/api/presupuestos/paciente/${caso.paciente_id}`)
        if (res.ok) {
          const d = await res.json()
          const lista = d.presupuestos || []
          if (lista.length > 0) {
            presData = lista[0]
          }
        }
      }

      if (presData && presData.items) {
        const itemLio = presData.items.find((it: any) => {
          const n = (it.nombre || '').toLowerCase()
          const c = (it.codigo || '').toLowerCase()
          return (
            n.includes('lente') ||
            n.includes('lio') ||
            c.includes('lio') ||
            c.includes('clareon') ||
            c.includes('trifocal') ||
            c.includes('vivity')
          )
        })

        if (itemLio) {
          setLioSeleccion((prev: any) => ({
            ...prev,
            estado: presData.estado === 'aprobado' ? 'confirmado' : 'tentativo',
            lente_id: itemLio.servicio_id || prev.lente_id,
            lente_nombre: itemLio.nombre,
            lente_codigo: itemLio.codigo,
            precio: itemLio.precio_unitario,
            moneda: itemLio.moneda,
            lente_od: itemLio.nombre,
            lente_oi: itemLio.nombre
          }))
          setAvisoValidacion(`✓ Se adoptó "${itemLio.nombre}" desde el Presupuesto #${presData.numero_presupuesto || ''} (${presData.estado === 'aprobado' ? 'Confirmado' : 'Tentativo'}).`)
          setTimeout(() => setAvisoValidacion(null), 4500)
          return
        }
      }

      setAvisoValidacion('No se encontró ningún ítem de Lente Intraocular cotizado en los presupuestos del paciente.')
      setTimeout(() => setAvisoValidacion(null), 4500)
    } catch (err) {
      console.error('Error al adoptar LIO del presupuesto:', err)
    } finally {
      setAdoptandoLio(false)
    }
  }

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
      monto_sena: senaArs > 0 ? senaArs : senaUsd,
      estado_pago: estadoPago,
      medio_pago: medioPago,
      presupuesto_id: presupuestoId || null,
      fecha_probable_cirugia: fechaProbable || null,
      fecha_definitiva_cirugia: fechaDefinitiva || null,
      ojo: ojo,
      checklist_prequirurgico: {
        ...checklist,
        _pagos: {
          sena_ars: senaArs,
          sena_usd: senaUsd,
          total_ars: calcTotalArs,
          total_usd: calcTotalUsd
        },
        _meta_bilateral: {
          modalidad: ojo === 'AO' ? modalidadBilateral : null,
          orden: ojo === 'AO' && modalidadBilateral === 'escalonada' ? ordenOjos : null,
          fecha_probable_2do_ojo: ojo === 'AO' ? fechaProbable2doOjo || null : null,
          fecha_definitiva_2do_ojo: ojo === 'AO' ? fechaDefinitiva2doOjo || null : null
        },
        _lio_seleccion: {
          estado: lioSeleccion.estado || 'a_definir',
          lente_id: lioSeleccion.lente_id || null,
          lente_nombre: lioSeleccion.lente_nombre || null,
          lente_codigo: lioSeleccion.lente_codigo || null,
          precio: lioSeleccion.precio || null,
          moneda: lioSeleccion.moneda || null,
          modalidad_bilateral: ojo === 'AO' ? lioSeleccion.modalidad_bilateral || 'mismo_lente' : 'mismo_lente',
          lente_od: lioSeleccion.lente_od || lioSeleccion.lente_nombre || null,
          lente_oi: lioSeleccion.lente_oi || lioSeleccion.lente_nombre || null,
          observaciones: lioSeleccion.observaciones || null
        },
        lente_tipo: lioSeleccion.lente_nombre || null
      },
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

    const payload: Partial<AsesoriaQuirurgica> & Record<string, any> = {
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
      monto_sena: senaArs > 0 ? senaArs : senaUsd,
      estado_pago: estadoPago,
      medio_pago: medioPago,
      presupuesto_id: presupuestoId || null,
      fecha_probable_cirugia: fechaProbable || null,
      fecha_definitiva_cirugia: fechaDefinitiva || null,
      ojo: ojo,
      // Datos de agenda de quirófano sincronizada bidireccionalmente
      quirofano_id: quirofanoId || null,
      hora_inicio: horaInicio || null,
      duracion_minutos: duracionMinutos || 45,
      ...(ojo === 'AO' && modalidadBilateral === 'escalonada'
        ? {
            quirofano_id_2do_ojo: quirofanoId2doOjo || null,
            hora_inicio_2do_ojo: horaInicio2doOjo || null,
            duracion_minutos_2do_ojo: duracionMinutos2doOjo || 45
          }
        : {}),
      checklist_prequirurgico: {
        ...checklist,
        _agenda_qx: {
          quirofano_id: quirofanoId || null,
          hora_inicio: horaInicio || null,
          duracion_minutos: duracionMinutos || 45
        },
        _pagos: {
          sena_ars: senaArs,
          sena_usd: senaUsd,
          total_ars: calcTotalArs,
          total_usd: calcTotalUsd
        },
        _meta_bilateral: {
          modalidad: ojo === 'AO' ? modalidadBilateral : null,
          orden: ojo === 'AO' && modalidadBilateral === 'escalonada' ? ordenOjos : null,
          fecha_probable_2do_ojo: ojo === 'AO' ? fechaProbable2doOjo || null : null,
          fecha_definitiva_2do_ojo: ojo === 'AO' ? fechaDefinitiva2doOjo || null : null,
          quirofano_id_2do_ojo: ojo === 'AO' && modalidadBilateral === 'escalonada' ? quirofanoId2doOjo || null : null,
          hora_inicio_2do_ojo: ojo === 'AO' && modalidadBilateral === 'escalonada' ? horaInicio2doOjo || null : null,
          duracion_minutos_2do_ojo: ojo === 'AO' && modalidadBilateral === 'escalonada' ? duracionMinutos2doOjo || 45 : null
        },
        _lio_seleccion: {
          estado: lioSeleccion.estado || 'a_definir',
          lente_id: lioSeleccion.lente_id || null,
          lente_nombre: lioSeleccion.lente_nombre || null,
          lente_codigo: lioSeleccion.lente_codigo || null,
          precio: lioSeleccion.precio || null,
          moneda: lioSeleccion.moneda || null,
          modalidad_bilateral: ojo === 'AO' ? lioSeleccion.modalidad_bilateral || 'mismo_lente' : 'mismo_lente',
          lente_od: lioSeleccion.lente_od || lioSeleccion.lente_nombre || null,
          lente_oi: lioSeleccion.lente_oi || lioSeleccion.lente_nombre || null,
          observaciones: lioSeleccion.observaciones || null
        },
        lente_tipo: lioSeleccion.lente_nombre || null
      },
      proxima_accion_fecha: proximaAccionFecha || null,
      proxima_accion_texto: proximaAccionTexto || null,
      situacion_paciente: situacionPaciente || ''
    }

    onGuardar(payload)
  }

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
            Paso: <strong className={estado === 'programado' ? 'text-cyan-400 font-bold' : estado === 'operado' ? 'text-teal-400 font-bold' : estado === 'confirmado' ? 'text-emerald-400 font-bold' : 'text-blue-400 font-bold'}>{estado.toUpperCase()}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {etapas
            .filter((e) => e.id !== 'cancelado')
            .map((e, idx) => {
              const isSelected = estado === e.id
              const isOperado = e.id === 'operado'
              const isProgramado = e.id === 'programado'
              const isConfirmado = e.id === 'confirmado'
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => handleCambiarEstadoStepper(e.id)}
                  disabled={guardando}
                  className={`p-2 rounded-xl text-left transition-all border flex flex-col justify-between ${
                    isSelected
                      ? isOperado
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-md ring-1 ring-teal-500/30'
                        : isProgramado
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md ring-1 ring-cyan-500/30'
                        : isConfirmado
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-blue-600/20 border-blue-500 text-white shadow-md ring-1 ring-blue-500/30'
                      : 'bg-neutral-950/60 border-[var(--border)] text-gray-400 hover:bg-neutral-800 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold opacity-75">0{idx + 1}</span>
                    {isSelected && (
                      <CheckCircle2
                        size={12}
                        className={isOperado ? 'text-teal-400' : isProgramado ? 'text-cyan-400' : isConfirmado ? 'text-emerald-400' : 'text-blue-400'}
                      />
                    )}
                  </div>
                  <span className="text-xs font-black truncate mt-1">{e.label.replace(/^[0-9]+\.\s*/, '')}</span>
                </button>
              )
            })}
        </div>
      </div>

      {/* Alerta de Validación Asistida */}
      {avisoValidacion && (
        <div className="p-3 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <span>{avisoValidacion}</span>
        </div>
      )}

      {/* Banner de Turnos Activos en Quirófano */}
      {turnosActivos.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border border-blue-500/40 text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-500/30">
              <Calendar size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  {turnosActivos.length === 1 ? 'Turno Programado en Quirófano' : `${turnosActivos.length} Turnos Programados en Quirófano`}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Activo en Sala
                </span>
              </div>
              <p className="text-[11px] text-gray-300 mt-0.5">
                {turnosActivos.map((t: any) => `${t.quirofanos?.nombre || 'Quirófano'} • Fecha: ${t.fecha_cirugia || 'Sin fecha'} (${(t.hora_inicio || '08:30').slice(0, 5)} hs) • Ojo: ${t.ojo || 'OD'}`).join(' | ')}
              </p>
            </div>
          </div>
          <a
            href="/programacion-quirurgica"
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow"
          >
            <span>Ver en Quirófano</span>
            <ExternalLink size={13} />
          </a>
        </div>
      )}

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
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <ClipboardList size={14} className="text-indigo-400" />
                Práctica Quirúrgica (Nomenclador CRM)
              </label>
              {practicaCodigo && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                  Cód. {practicaCodigo}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                disabled={guardando}
                placeholder="Buscar código o nombre en el Nomenclador..."
                value={busquedaPractica}
                onChange={(e) => {
                  const val = e.target.value
                  setBusquedaPractica(val)
                  setPracticaNombre(val)
                  setPracticaCodigo('')
                  buscarPracticasNomenclador(val)
                  setMostrarDropdownPractica(true)
                }}
                onFocus={(e) => {
                  e.target.select()
                  buscarPracticasNomenclador(busquedaPractica)
                  setMostrarDropdownPractica(true)
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (!busquedaPractica.trim() && practicaNombre) {
                      setBusquedaPractica(practicaCodigo ? `[${practicaCodigo}] ${practicaNombre}` : practicaNombre)
                    }
                  }, 250)
                }}
                className="w-full pl-3 pr-14 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-indigo-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {busquedaPractica && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusquedaPractica('')
                      setPracticaNombre('')
                      setPracticaCodigo('')
                      buscarPracticasNomenclador('')
                      setMostrarDropdownPractica(false)
                    }}
                    className="p-1 text-gray-500 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
                    title="Limpiar y buscar otra práctica"
                  >
                    <X size={13} />
                  </button>
                )}
                {buscandoPractica && (
                  <Loader2 size={14} className="animate-spin text-indigo-400" />
                )}
              </div>

              {mostrarDropdownPractica && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-neutral-900 border border-indigo-500/40 rounded-xl shadow-2xl z-50 divide-y divide-[var(--border)]">
                  {buscandoPractica && practicasNomenclador.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin text-indigo-400" />
                      <span>Buscando en el nomenclador...</span>
                    </div>
                  ) : practicasNomenclador.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-500">
                      No se encontraron prácticas oficiales con &quot;{busquedaPractica}&quot;
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
                          // Desacoplado: No sobreescribir montoExtra ni forzar valor comercial
                          setMostrarDropdownPractica(false)
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-600/20 text-xs transition-colors group flex items-center justify-between gap-3"
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <span className="font-bold text-white group-hover:text-indigo-300 truncate" title={`[${p.codigo}] ${p.nombre}`}>
                            [{p.codigo}] {p.nombre}
                          </span>
                          {p.categoria && (
                            <span className="text-[10px] text-gray-400 truncate">
                              {p.categoria}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-800 text-gray-300 border border-neutral-700/60 shrink-0 group-hover:border-indigo-500/30 group-hover:text-indigo-200 transition-colors">
                          Cirugía
                        </span>
                      </button>
                    ))
                  )}

                  {/* Opción para usar la búsqueda como Práctica Manual (Fuera de Nomenclador) */}
                  {busquedaPractica.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const cleanNom = busquedaPractica.replace(/^\[.*?\]\s*/, '').trim()
                        setPracticaNombre(cleanNom)
                        setPracticaCodigo('')
                        setBusquedaPractica(cleanNom)
                        setMostrarDropdownPractica(false)
                      }}
                      className="w-full text-left p-2.5 bg-neutral-950/80 hover:bg-neutral-800 text-xs text-indigo-300 hover:text-white transition-colors flex items-center gap-2 border-t border-neutral-800"
                    >
                      <Plus size={13} className="text-indigo-400 shrink-0" />
                      <span className="truncate">
                        Usar como práctica manual: <strong>&quot;{busquedaPractica.replace(/^\[.*?\]\s*/, '').trim()}&quot;</strong> <span className="text-[10px] text-gray-400 font-normal">(Fuera de Nomenclador)</span>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Micro-nota asistencial informativa */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-950/40 border border-neutral-800/80 text-[11px] text-neutral-400 leading-tight">
              <Info size={12} className="text-indigo-400 shrink-0" />
              <span>
                Los aranceles, coberturas por obra social y lentes se gestionan formalmente en{' '}
                <strong className="text-gray-300 font-semibold">Presupuestos Oficiales del Caso</strong>.
              </span>
            </div>
            {/* ========================================================================================= */}
            {/* 1. MÓDULO UNIFICADO: LATERALIDAD & PROGRAMACIÓN QUIRÚRGICA                                 */}
            {/*    La lateralidad define la estructura médica y la programación de fechas y quirófanos.   */}
            {/* ========================================================================================= */}
            <div className="p-3 bg-neutral-950/70 border border-indigo-500/30 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  <Eye size={14} className="text-indigo-400" />
                  <span>Lateralidad & Programación Quirúrgica</span>
                </label>
                {ojo === 'AO' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {modalidadBilateral === 'escalonada' ? 'Bilateral Escalonada (2 Días)' : 'Bilateral Simultánea (Mismo Día)'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {ojo === 'OD' ? 'Ojo Derecho (OD)' : 'Ojo Izquierdo (OI)'}
                  </span>
                )}
              </div>

              {/* Selector Directo de Ojo */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOjo('OD')}
                  className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    ojo === 'OD'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-[var(--border)] text-gray-400 hover:text-white'
                  }`}
                >
                  <span>👁️ Ojo Derecho (OD)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOjo('OI')}
                  className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    ojo === 'OI'
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-[var(--border)] text-gray-400 hover:text-white'
                  }`}
                >
                  <span>👁️ Ojo Izquierdo (OI)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOjo('AO')
                    if (!fechaProbable2doOjo && fechaProbable) {
                      setFechaProbable2doOjo(sumarDiasFecha(fechaProbable, 7))
                    }
                  }}
                  className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    ojo === 'AO'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-[var(--border)] text-gray-400 hover:text-white'
                  }`}
                >
                  <span>👁️👁️ Ambos Ojos (AO)</span>
                </button>
              </div>

              {/* Selector de Modalidad si es Bilateral (AO) */}
              {ojo === 'AO' && (
                <div className="pt-2 border-t border-gray-800/80 flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-medium">Modalidad Bilateral:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setModalidadBilateral('escalonada')
                      if (!fechaProbable2doOjo && fechaProbable) {
                        setFechaProbable2doOjo(sumarDiasFecha(fechaProbable, 7))
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      modalidadBilateral === 'escalonada'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-neutral-900 text-gray-400 border-[var(--border)] hover:text-white'
                    }`}
                  >
                    2 Días Separados (Escalonada)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalidadBilateral('simultanea')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      modalidadBilateral === 'simultanea'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-neutral-900 text-gray-400 border-[var(--border)] hover:text-white'
                    }`}
                  >
                    Mismo Acto (Simultánea)
                  </button>
                </div>
              )}

              {/* --------------------------------------------------------------------------------- */}
              {/* CASO A: UNILATERAL (OD / OI) O BILATERAL SIMULTÁNEA (AO MISMO ACTO)               */}
              {/* --------------------------------------------------------------------------------- */}
              {(ojo !== 'AO' || modalidadBilateral === 'simultanea') && (
                <div className="p-3 bg-neutral-900/60 border border-[var(--border)] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                      <Calendar size={13} className="text-amber-400" />
                      {ojo === 'AO' ? 'Programación Quirúrgica - Ambos Ojos (Mismo Día)' : `Programación Quirúrgica - Ojo ${ojo === 'OD' ? 'Derecho (OD)' : 'Izquierdo (OI)'}`}
                    </span>
                    {fechaDefinitiva ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Fijada en Quirófano
                      </span>
                    ) : fechaProbable ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Fecha Estimada
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium block mb-1">
                        Fecha Probable / Tentativa:
                      </label>
                      <input
                        type="date"
                        disabled={guardando}
                        value={fechaProbable}
                        onChange={(e) => setFechaProbable(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-amber-500 rounded-xl text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-emerald-400 font-bold block mb-1">
                        Fecha Definitiva (Fijada en Qx):
                      </label>
                      <input
                        type="date"
                        disabled={guardando}
                        value={fechaDefinitiva}
                        onChange={(e) => setFechaDefinitiva(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-neutral-900 border border-emerald-500/40 focus:border-emerald-500 rounded-xl text-emerald-300 font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Asignación de Quirófano y Horario (Activo solo con fecha definitiva fijada) */}
                  {fechaDefinitiva ? (
                    <div className="pt-2.5 border-t border-neutral-800 bg-neutral-950/40 p-2.5 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <Building2 size={13} className="text-amber-400" />
                          Asignación de Agenda y Quirófano
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                          {cargandoAgendaFecha ? (
                            <Loader2 size={11} className="animate-spin text-amber-400" />
                          ) : (
                            <span className="text-emerald-400">● Sincronizado en tiempo real</span>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Quirófano / Sala */}
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1 font-semibold">
                            Quirófano / Sala:
                          </label>
                          <select
                            disabled={guardando}
                            value={quirofanoId}
                            onChange={(e) => setQuirofanoId(e.target.value)}
                            className="w-full p-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white outline-none focus:border-amber-400 font-semibold"
                          >
                            <option value="">-- Seleccionar Quirófano / Sala --</option>
                            {quirofanos.map((q: any) => (
                              <option key={q.id} value={q.id}>
                                {q.nombre} ({q.codigo || 'Qx'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Hora de Inicio con slots en vivo */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-gray-400 font-semibold">
                              Hora de Inicio:
                            </label>
                            {(() => {
                              const slotEstado = getSlotInfo(horaInicio, quirofanoId, fechaDefinitiva, turnosFecha, bloqueosFecha)
                              if (slotEstado.estado === 'sin_asignar') {
                                return <span className="text-[9px] font-medium text-gray-500">Pendiente</span>
                              }
                              return (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    slotEstado.estado === 'libre'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : slotEstado.estado === 'ocupado'
                                      ? 'bg-red-500/20 text-red-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {slotEstado.estado === 'libre' ? '🟢 Libre' : slotEstado.estado === 'ocupado' ? '🔴 Ocupado' : '⛔ Bloqueado'}
                                </span>
                              )
                            })()}
                          </div>
                          {(() => {
                            const qActual = quirofanos.find((q: any) => q.id === quirofanoId) || quirofanos[0]
                            const slots = generarSlotsHorarios(qActual)
                            return (
                              <select
                                disabled={guardando || !quirofanoId}
                                value={horaInicio}
                                onChange={(e) => setHoraInicio(e.target.value)}
                                className="w-full p-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white outline-none focus:border-amber-400 font-mono font-bold disabled:opacity-50"
                              >
                                <option value="">-- Seleccionar Horario --</option>
                                {slots.map((s) => {
                                  const info = getSlotInfo(s, quirofanoId, fechaDefinitiva, turnosFecha, bloqueosFecha)
                                  return (
                                    <option key={s} value={s}>
                                      {info.label}
                                    </option>
                                  )
                                })}
                              </select>
                            )
                          })()}
                        </div>

                        {/* Duración */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-gray-400 font-semibold">
                              Duración Estimada:
                            </label>
                            <span className="text-[9px] font-mono text-gray-400">
                              Fin: {horaInicio ? `${minutosAHora(horaAMinutos(horaInicio) + Number(duracionMinutos))} hs` : '--:--'}
                            </span>
                          </div>
                          <select
                            disabled={guardando}
                            value={duracionMinutos}
                            onChange={(e) => setDuracionMinutos(Number(e.target.value))}
                            className="w-full p-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white outline-none focus:border-amber-400 font-semibold"
                          >
                            <option value={15}>15 minutos</option>
                            <option value={20}>20 minutos</option>
                            <option value={30}>30 minutos</option>
                            <option value={45}>45 minutos</option>
                            <option value={60}>60 minutos (1 hora)</option>
                            <option value={90}>90 minutos (1h 30m)</option>
                            <option value={120}>120 minutos (2 horas)</option>
                          </select>
                        </div>
                      </div>

                      <div className="text-[10.5px] text-gray-400 flex items-center gap-1.5 pt-0.5">
                        <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                        <span>
                          {quirofanoId && horaInicio
                            ? 'Al guardar, se creará o actualizará el turno en la Agenda de Quirófano.'
                            : 'Seleccione Quirófano y Horario cuando la cirugía esté lista para impactar en la agenda.'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/80 text-[10.5px] text-gray-400 flex items-center gap-1.5">
                      <Info size={12} className="text-amber-400/80 shrink-0" />
                      <span>Fije la <strong>Fecha Definitiva</strong> para habilitar la asignación de quirófano y franja horaria.</span>
                    </div>
                  )}
                </div>
              )}

              {/* --------------------------------------------------------------------------------- */}
              {/* CASO B: BILATERAL ESCALONADA (AO EN 2 DÍAS SEPARADOS)                             */}
              {/* --------------------------------------------------------------------------------- */}
              {ojo === 'AO' && modalidadBilateral === 'escalonada' && (
                <div className="space-y-3 pt-1">
                  {/* Selector de Orden Quirúrgico */}
                  <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-purple-300">Orden de Intervención:</span>
                      <select
                        value={ordenOjos}
                        onChange={(e) => setOrdenOjos(e.target.value as any)}
                        className="p-1.5 rounded-lg bg-neutral-900 border border-purple-500/40 text-xs text-white outline-none focus:border-purple-400 font-semibold"
                      >
                        <option value="OD_primero">1° Ojo Derecho (OD) ➔ 2° Ojo Izquierdo (OI)</option>
                        <option value="OI_primero">1° Ojo Izquierdo (OI) ➔ 2° Ojo Derecho (OD)</option>
                      </select>
                    </div>

                    {/* Botones de sugerencia rápida de intervalo */}
                    {fechaProbable && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">Sugerir intervalo 2° ojo:</span>
                        {[7, 14, 21, 30].map((dias) => (
                          <button
                            key={dias}
                            type="button"
                            onClick={() => setFechaProbable2doOjo(sumarDiasFecha(fechaProbable, dias))}
                            className="px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/30 text-[10px] font-bold transition"
                            title={`Fijar fecha probable a ${dias} días del 1° ojo`}
                          >
                            +{dias}d
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sub-Tarjeta 1: 1° Ojo */}
                  <div className="p-3 bg-neutral-900/60 border border-blue-500/30 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <Calendar size={13} className="text-blue-400" />
                        1° Ojo a Operar: {ordenOjos === 'OD_primero' ? 'Ojo Derecho (OD)' : 'Ojo Izquierdo (OI)'}
                      </span>
                      {fechaDefinitiva ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Fijada en Qx
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-medium">1° Fecha</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-400 font-medium block mb-1">
                          Fecha Probable (1° Ojo):
                        </label>
                        <input
                          type="date"
                          disabled={guardando}
                          value={fechaProbable}
                          onChange={(e) => {
                            const nueva = e.target.value
                            setFechaProbable(nueva)
                            if (nueva && !fechaProbable2doOjo) {
                              setFechaProbable2doOjo(sumarDiasFecha(nueva, 7))
                            }
                          }}
                          className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-blue-500 rounded-xl text-white font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-emerald-400 font-bold block mb-1">
                          Fecha Definitiva (1° Ojo):
                        </label>
                        <input
                          type="date"
                          disabled={guardando}
                          value={fechaDefinitiva}
                          onChange={(e) => setFechaDefinitiva(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-neutral-900 border border-emerald-500/40 focus:border-emerald-500 rounded-xl text-emerald-300 font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Asignación Quirófano 1° Ojo */}
                    {fechaDefinitiva ? (
                      <div className="pt-2 border-t border-neutral-800 bg-neutral-950/40 p-2.5 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold text-blue-300 flex items-center gap-1.5">
                            <Building2 size={12} className="text-blue-400" />
                            Quirófano y Horario (1° Ojo)
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {cargandoAgendaFecha ? <Loader2 size={10} className="animate-spin text-blue-400" /> : '● En vivo'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-1 font-semibold">Quirófano / Sala:</label>
                            <select
                              disabled={guardando}
                              value={quirofanoId}
                              onChange={(e) => setQuirofanoId(e.target.value)}
                              className="w-full p-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white outline-none focus:border-blue-400 font-semibold"
                            >
                              <option value="">-- Seleccionar Quirófano --</option>
                              {quirofanos.map((q: any) => (
                                <option key={q.id} value={q.id}>
                                  {q.nombre} ({q.codigo || 'Qx'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-gray-400 font-semibold">Hora Inicio:</label>
                              {(() => {
                                const slotEstado = getSlotInfo(horaInicio, quirofanoId, fechaDefinitiva, turnosFecha, bloqueosFecha)
                                if (slotEstado.estado === 'sin_asignar') return <span className="text-[9px] text-gray-500">Pendiente</span>
                                return (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    slotEstado.estado === 'libre' ? 'bg-emerald-500/20 text-emerald-300' : slotEstado.estado === 'ocupado' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                                  }`}>
                                    {slotEstado.estado === 'libre' ? '🟢 Libre' : slotEstado.estado === 'ocupado' ? '🔴 Ocupado' : '⛔ Bloqueado'}
                                  </span>
                                )
                              })()}
                            </div>
                            {(() => {
                              const qActual = quirofanos.find((q: any) => q.id === quirofanoId) || quirofanos[0]
                              const slots = generarSlotsHorarios(qActual)
                              return (
                                <select
                                  disabled={guardando || !quirofanoId}
                                  value={horaInicio}
                                  onChange={(e) => setHoraInicio(e.target.value)}
                                  className="w-full p-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white outline-none focus:border-blue-400 font-mono font-bold disabled:opacity-50"
                                >
                                  <option value="">-- Seleccionar Horario --</option>
                                  {slots.map((s) => (
                                    <option key={s} value={s}>{getSlotInfo(s, quirofanoId, fechaDefinitiva, turnosFecha, bloqueosFecha).label}</option>
                                  ))}
                                </select>
                              )
                            })()}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-gray-400 font-semibold">Duración:</label>
                              <span className="text-[9px] font-mono text-gray-400">
                                Fin: {horaInicio ? `${minutosAHora(horaAMinutos(horaInicio) + Number(duracionMinutos))} hs` : '--:--'}
                              </span>
                            </div>
                            <select
                              disabled={guardando}
                              value={duracionMinutos}
                              onChange={(e) => setDuracionMinutos(Number(e.target.value))}
                              className="w-full p-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white outline-none focus:border-blue-400 font-semibold"
                            >
                              <option value={15}>15 minutos</option>
                              <option value={20}>20 minutos</option>
                              <option value={30}>30 minutos</option>
                              <option value={45}>45 minutos</option>
                              <option value={60}>60 minutos (1 hora)</option>
                              <option value={90}>90 minutos (1h 30m)</option>
                              <option value={120}>120 minutos (2 horas)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/80 text-[10.5px] text-gray-400 flex items-center gap-1.5">
                        <Info size={11} className="text-blue-400 shrink-0" />
                        <span>Fije la <strong>Fecha Definitiva del 1° ojo</strong> para habilitar su asignación en quirófano.</span>
                      </div>
                    )}
                  </div>

                  {/* Sub-Tarjeta 2: 2° Ojo */}
                  <div className="p-3 bg-neutral-900/60 border border-purple-500/30 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Calendar size={13} className="text-purple-400" />
                        2° Ojo a Operar: {ordenOjos === 'OD_primero' ? 'Ojo Izquierdo (OI)' : 'Ojo Derecho (OD)'}
                      </span>
                      {fechaDefinitiva2doOjo ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Fijada en Qx
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-medium">2° Fecha</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-400 font-medium block mb-1">
                          Fecha Probable (2° Ojo):
                        </label>
                        <input
                          type="date"
                          disabled={guardando}
                          value={fechaProbable2doOjo}
                          min={fechaProbable || undefined}
                          onChange={(e) => setFechaProbable2doOjo(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-neutral-900 border border-purple-500/40 focus:border-purple-400 rounded-xl text-white font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-emerald-400 font-bold block mb-1">
                          Fecha Definitiva (2° Ojo):
                        </label>
                        <input
                          type="date"
                          disabled={guardando}
                          value={fechaDefinitiva2doOjo}
                          min={fechaDefinitiva || fechaProbable || undefined}
                          onChange={(e) => setFechaDefinitiva2doOjo(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-neutral-900 border border-emerald-500/40 focus:border-emerald-500 rounded-xl text-emerald-300 font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Asignación Quirófano 2° Ojo */}
                    {fechaDefinitiva2doOjo ? (
                      <div className="pt-2 border-t border-purple-500/20 bg-purple-950/20 p-2.5 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold text-purple-300 flex items-center gap-1.5">
                            <Building2 size={12} className="text-purple-400" />
                            Quirófano y Horario (2° Ojo)
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {cargandoAgendaFecha2doOjo ? <Loader2 size={10} className="animate-spin text-purple-400" /> : '● En vivo'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-1 font-semibold">Quirófano / Sala:</label>
                            <select
                              disabled={guardando}
                              value={quirofanoId2doOjo}
                              onChange={(e) => setQuirofanoId2doOjo(e.target.value)}
                              className="w-full p-2 rounded-lg bg-neutral-900 border border-purple-500/40 text-xs text-white outline-none focus:border-purple-400 font-semibold"
                            >
                              <option value="">-- Seleccionar Quirófano --</option>
                              {quirofanos.map((q: any) => (
                                <option key={q.id} value={q.id}>
                                  {q.nombre} ({q.codigo || 'Qx'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-gray-400 font-semibold">Hora Inicio:</label>
                              {(() => {
                                const slotEstado2 = getSlotInfo(horaInicio2doOjo, quirofanoId2doOjo, fechaDefinitiva2doOjo, turnosFecha2doOjo, bloqueosFecha2doOjo)
                                if (slotEstado2.estado === 'sin_asignar') return <span className="text-[9px] text-gray-500">Pendiente</span>
                                return (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    slotEstado2.estado === 'libre' ? 'bg-emerald-500/20 text-emerald-300' : slotEstado2.estado === 'ocupado' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                                  }`}>
                                    {slotEstado2.estado === 'libre' ? '🟢 Libre' : slotEstado2.estado === 'ocupado' ? '🔴 Ocupado' : '⛔ Bloqueado'}
                                  </span>
                                )
                              })()}
                            </div>
                            {(() => {
                              const qActual2 = quirofanos.find((q: any) => q.id === quirofanoId2doOjo) || quirofanos[0]
                              const slots2 = generarSlotsHorarios(qActual2)
                              return (
                                <select
                                  disabled={guardando || !quirofanoId2doOjo}
                                  value={horaInicio2doOjo}
                                  onChange={(e) => setHoraInicio2doOjo(e.target.value)}
                                  className="w-full p-2 rounded-lg bg-neutral-900 border border-purple-500/40 text-xs text-white outline-none focus:border-purple-400 font-mono font-bold disabled:opacity-50"
                                >
                                  <option value="">-- Seleccionar Horario --</option>
                                  {slots2.map((s) => (
                                    <option key={s} value={s}>{getSlotInfo(s, quirofanoId2doOjo, fechaDefinitiva2doOjo, turnosFecha2doOjo, bloqueosFecha2doOjo).label}</option>
                                  ))}
                                </select>
                              )
                            })()}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] text-gray-400 font-semibold">Duración:</label>
                              <span className="text-[9px] font-mono text-gray-400">
                                Fin: {horaInicio2doOjo ? `${minutosAHora(horaAMinutos(horaInicio2doOjo) + Number(duracionMinutos2doOjo))} hs` : '--:--'}
                              </span>
                            </div>
                            <select
                              disabled={guardando}
                              value={duracionMinutos2doOjo}
                              onChange={(e) => setDuracionMinutos2doOjo(Number(e.target.value))}
                              className="w-full p-2 rounded-lg bg-neutral-900 border border-purple-500/40 text-xs text-white outline-none focus:border-purple-400 font-semibold"
                            >
                              <option value={15}>15 minutos</option>
                              <option value={20}>20 minutos</option>
                              <option value={30}>30 minutos</option>
                              <option value={45}>45 minutos</option>
                              <option value={60}>60 minutos (1 hora)</option>
                              <option value={90}>90 minutos (1h 30m)</option>
                              <option value={120}>120 minutos (2 horas)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-neutral-950/40 border border-purple-500/20 text-[10.5px] text-gray-400 flex items-center gap-1.5">
                        <Info size={11} className="text-purple-400 shrink-0" />
                        <span>Fije la <strong>Fecha Definitiva del 2° ojo</strong> para habilitar su asignación en quirófano.</span>
                      </div>
                    )}

                    {/* Validación visual de intervalo */}
                    {(() => {
                      const diff = calcularDiferenciaDias(fechaProbable, fechaProbable2doOjo)
                      if (diff === null) return null
                      if (diff > 0) {
                        return (
                          <p className="text-[11px] text-purple-300 flex items-center gap-1 font-medium bg-purple-950/40 px-2 py-1 rounded-lg border border-purple-500/20">
                            <span>✔ Intervalo programado: <strong>{diff} días</strong> entre el 1° y 2° ojo.</span>
                          </p>
                        )
                      } else if (diff === 0) {
                        return (
                          <p className="text-[11px] text-amber-300 flex items-center gap-1 font-medium bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-500/20">
                            <span>⚠️ Ambas fechas son el mismo día. Si opera en simultáneo, elija la modalidad &quot;Mismo Acto&quot;.</span>
                          </p>
                        )
                      } else {
                        return (
                          <p className="text-[11px] text-red-400 flex items-center gap-1 font-medium bg-red-950/40 px-2 py-1 rounded-lg border border-red-500/20">
                            <span>⚠️ La fecha del 2° ojo no puede ser anterior a la del 1° ojo.</span>
                          </p>
                        )
                      }
                    })()}
                  </div>
                </div>
              )}


              {/* Sub-bloque LIO Comercial Acordado / Propuesto */}
              {practicaRequiereLente && (
                <div className="pt-3 border-t border-gray-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💎</span>
                      <div>
                        <span className="text-xs font-bold text-amber-200 block">
                          Lente Intraocular (LIO) Comercial / Propuesto
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Tecnología elegida por el paciente (independiente de la dioptría biométrica)
                        </span>
                      </div>
                    </div>

                    {/* Botón de atajo para adoptar del presupuesto */}
                    <button
                      type="button"
                      onClick={handleAdoptarLioDelPresupuesto}
                      disabled={adoptandoLio}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition disabled:opacity-50"
                      title="Busca y pre-selecciona el LIO cotizado en el presupuesto del paciente"
                    >
                      <Sparkles size={11} className="text-amber-400" />
                      <span>{adoptandoLio ? 'Buscando...' : '💡 Adoptar LIO del Presupuesto'}</span>
                    </button>
                  </div>

                  {/* Selector de Estado: Tentativo vs Confirmado vs A definir */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Momento / Estado de la Elección:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setLioSeleccion((prev: any) => ({ ...prev, estado: 'tentativo' }))}
                        className={`p-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 border ${
                          lioSeleccion.estado === 'tentativo'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                            : 'bg-neutral-900 border-[var(--border)] text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>🟡 Tentativo</span>
                        <span className="text-[9px] opacity-75">En evaluación</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLioSeleccion((prev: any) => ({ ...prev, estado: 'confirmado' }))}
                        className={`p-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 border ${
                          lioSeleccion.estado === 'confirmado'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                            : 'bg-neutral-900 border-[var(--border)] text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>🟢 Confirmado</span>
                        <span className="text-[9px] opacity-75">Decisión tomada</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLioSeleccion((prev: any) => ({ ...prev, estado: 'a_definir' }))}
                        className={`p-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 border ${
                          lioSeleccion.estado === 'a_definir'
                            ? 'bg-neutral-800 border-gray-500 text-gray-200 shadow-sm'
                            : 'bg-neutral-900 border-[var(--border)] text-gray-500 hover:text-white'
                        }`}
                      >
                        <span>⚪ A Definir</span>
                        <span className="text-[9px] opacity-75">Sin elección aún</span>
                      </button>
                    </div>
                  </div>

                  {/* Selector del Lente */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Lente Intraocular Acordado:
                    </label>
                    <select
                      value={lioSeleccion.lente_nombre || ''}
                      onChange={(e) => {
                        const lioNom = e.target.value
                        const lioEncontrado = catalogoLios.find((l) => l.nombre === lioNom)
                        setLioSeleccion((prev: any) => ({
                          ...prev,
                          lente_nombre: lioNom,
                          lente_id: lioEncontrado?.id || prev.lente_id,
                          lente_codigo: lioEncontrado?.codigo || prev.lente_codigo,
                          precio: lioEncontrado?.precio ?? prev.precio,
                          moneda: lioEncontrado?.moneda ?? prev.moneda,
                          lente_od: lioNom,
                          lente_oi: lioNom
                        }))
                      }}
                      className="w-full p-2.5 rounded-xl bg-neutral-900 border border-amber-500/30 text-xs text-amber-200 font-bold outline-none focus:border-amber-400"
                    >
                      <option value="">-- Seleccionar Lente Comercial --</option>
                      {catalogoLios
                        .filter((lio) => lio.habilitado_en_practica !== false || lio.nombre === lioSeleccion.lente_nombre)
                        .map((lio) => (
                          <option key={lio.id || lio.codigo} value={lio.nombre}>
                            {lio.nombre} ({lio.moneda === 'USD' ? 'USD ' : '$'}{lio.precio?.toLocaleString('es-AR')}) - {lio.tipo_vision}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Si es AO (Ambos Ojos), permitir diferenciar por ojo si es Monovisión / Blend */}
                  {ojo === 'AO' && lioSeleccion.lente_nombre && (
                    <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-300">
                          Modalidad para Ambos Ojos:
                        </span>
                        <div className="flex gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setLioSeleccion((prev: any) => ({ ...prev, modalidad_bilateral: 'mismo_lente', lente_oi: prev.lente_od || prev.lente_nombre }))}
                            className={`px-2 py-0.5 rounded font-bold transition ${
                              lioSeleccion.modalidad_bilateral !== 'diferenciado'
                                ? 'bg-purple-600 text-white'
                                : 'bg-neutral-900 text-gray-400 border border-purple-500/30'
                            }`}
                          >
                            Mismo LIO en AO
                          </button>
                          <button
                            type="button"
                            onClick={() => setLioSeleccion((prev: any) => ({ ...prev, modalidad_bilateral: 'diferenciado' }))}
                            className={`px-2 py-0.5 rounded font-bold transition ${
                              lioSeleccion.modalidad_bilateral === 'diferenciado'
                                ? 'bg-purple-600 text-white'
                                : 'bg-neutral-900 text-gray-400 border border-purple-500/30'
                            }`}
                          >
                            Monovisión / Blend
                          </button>
                        </div>
                      </div>

                      {lioSeleccion.modalidad_bilateral === 'diferenciado' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                          <div>
                            <span className="text-[10px] text-blue-300 font-bold block mb-1">LIO Ojo Derecho (OD):</span>
                            <input
                              type="text"
                              value={lioSeleccion.lente_od || ''}
                              onChange={(e) => setLioSeleccion((prev: any) => ({ ...prev, lente_od: e.target.value }))}
                              placeholder="ej: Monofocal Plus"
                              className="w-full p-1.5 rounded-lg bg-neutral-900 border border-blue-500/40 text-xs text-white outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-300 font-bold block mb-1">LIO Ojo Izquierdo (OI):</span>
                            <input
                              type="text"
                              value={lioSeleccion.lente_oi || ''}
                              onChange={(e) => setLioSeleccion((prev: any) => ({ ...prev, lente_oi: e.target.value }))}
                              placeholder="ej: Monofocal Estándar"
                              className="w-full p-1.5 rounded-lg bg-neutral-900 border border-emerald-500/40 text-xs text-white outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Tarjeta de Cálculo Biométrico de LIO & Acceso Directo */}
            <div className={`p-3 rounded-xl border space-y-2 transition-all ${
              tieneLioCalculado
                ? 'bg-emerald-950/40 border-emerald-500/40'
                : 'bg-neutral-950/60 border-[var(--border)]'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Sparkles size={14} className={tieneLioCalculado ? 'text-emerald-400' : 'text-blue-400'} />
                  <span className={tieneLioCalculado ? 'text-emerald-300' : 'text-gray-300'}>
                    {tieneLioCalculado ? 'Cálculo Biométrico de LIO Sellado' : 'Mesa Biométrica & Cálculo de LIO'}
                  </span>
                </div>
                <a
                  href="/calculo-lio"
                  target="_blank"
                  rel="noreferrer"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-sm ${
                    tieneLioCalculado
                      ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  }`}
                >
                  <span>{tieneLioCalculado ? 'Ver Mesa Biométrica' : 'Abrir Cálculo LIO ➔'}</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              {tieneLioCalculado ? (
                <div className="space-y-1 text-xs text-gray-300 font-mono">
                  {lioOD && (
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-300 text-[10px] font-bold">OD</span>
                      <span className="text-white font-bold">{lioOD.opciones?.[0]?.modelo || 'Lente OD'}</span>
                      <span className="text-cyan-400 font-extrabold">+{lioOD.opciones?.[0]?.dioptria || '20.00'} D</span>
                      {lioOD.opciones?.[0]?.es_torico && (
                        <span className="text-[10px] text-purple-300">T{lioOD.opciones?.[0]?.torico_valor} @ {lioOD.opciones?.[0]?.torico_eje}°</span>
                      )}
                    </div>
                  )}
                  {lioOI && (
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-bold">OI</span>
                      <span className="text-white font-bold">{lioOI.opciones?.[0]?.modelo || 'Lente OI'}</span>
                      <span className="text-cyan-400 font-extrabold">+{lioOI.opciones?.[0]?.dioptria || '20.00'} D</span>
                      {lioOI.opciones?.[0]?.es_torico && (
                        <span className="text-[10px] text-purple-300">T{lioOI.opciones?.[0]?.torico_valor} @ {lioOI.opciones?.[0]?.torico_eje}°</span>
                      )}
                    </div>
                  )}
                  {(!lioOD && !lioOI && caso.lente_tipo) && (
                    <div className="text-white font-bold">
                      {caso.lente_tipo} (+{caso.lente_dioptria || '21.50'} D)
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">
                  Define la biometría y selección de lente intraocular para esta práctica en la mesa de cálculo.
                </p>
              )}
            </div>

            {/* 4. Cobertura */}
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
                              <div className="mt-2 space-y-1 bg-neutral-900/70 rounded-lg p-2 border border-neutral-800/60">
                                {p.items_presupuesto.map((it: any, idx: number) => {
                                  const nombrePrestacion = it.nombre_prestacion || it.nombre || it.servicios_precios?.nombre_prestacion || it.descripcion || 'Práctica Médica'
                                  const monedaItem = it.moneda || it.servicios_precios?.moneda || (Number(p.total_usd) > 0 && !Number(p.total_ars) ? 'USD' : 'ARS')
                                  const subtotalNum = Number(it.subtotal || (Number(it.precio_unitario || 0) * (it.cantidad || 1)))
                                  return (
                                    <div key={idx} className="text-[11px] text-gray-300 flex items-center justify-between gap-2 min-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="text-gray-500 shrink-0">•</span>
                                        <span className="truncate font-medium text-gray-200" title={nombrePrestacion}>
                                          {nombrePrestacion}
                                        </span>
                                        {it.cantidad > 1 && (
                                          <span className="text-[10px] text-gray-400 font-mono shrink-0">
                                            ({it.cantidad}x)
                                          </span>
                                        )}
                                      </div>
                                      {it.en_convenio ? (
                                        <span className="text-emerald-400 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 shrink-0">
                                          En convenio
                                        </span>
                                      ) : (
                                        <span className="text-gray-200 font-mono text-[10.5px] font-semibold shrink-0">
                                          {monedaItem === 'USD' ? 'USD ' : '$ '}
                                          {subtotalNum.toLocaleString('es-AR')}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
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
                            {(p.id || p.pdf_url) && (
                              <a
                                href={p.id ? `${BACKEND_URL}/api/presupuestos/${p.id}/pdf` : (p.pdf_url || undefined)}
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

                            {onModificarPresupuesto && (
                              <button
                                type="button"
                                onClick={() => onModificarPresupuesto(p)}
                                className="p-1.5 bg-neutral-800 hover:bg-amber-950 text-amber-300 hover:text-amber-200 border border-amber-600/30 rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="Modificar cotización (editar ítems / valores)"
                              >
                                <Pencil size={13} />
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

                            {onEliminarPresupuesto && (
                              <button
                                type="button"
                                onClick={() => onEliminarPresupuesto(p.id)}
                                className="p-1.5 bg-neutral-800 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="Eliminar este presupuesto"
                              >
                                <Trash2 size={13} />
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
                            {(op.id || op.pdf_url) && (
                              <a
                                href={op.id ? `${BACKEND_URL}/api/presupuestos/${op.id}/pdf` : (op.pdf_url || undefined)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 bg-neutral-800 hover:bg-neutral-700 text-blue-300 rounded text-xs"
                                title="Ver PDF"
                              >
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

            {/* Widget de Seña y Cobranza (Soporte Multimoneda nativo) */}
            <CasoPagosWidget
              totalArs={calcTotalArs}
              totalUsd={calcTotalUsd}
              senaArs={senaArs}
              senaUsd={senaUsd}
              montoTotalFallback={presupuestoVinculado ? Number(presupuestoVinculado.total) : montoExtra}
              monedaFallback={monedaExtra}
              montoSenaFallback={montoSena}
              estadoPago={estadoPago}
              medioPago={medioPago}
              disabled={guardando}
              onChange={(data) => {
                setSenaArs(data.senaArs)
                setSenaUsd(data.senaUsd)
                setMontoSena(data.montoSenaTotal)
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

          {/* Card: Consentimiento Informado Quirúrgico (Dual Bilateral Escalonado o Unitario) */}
          <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3">
            {/* Header de la Tarjeta */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg border ${
                  (ojo === 'AO' && modalidadBilateral === 'escalonada')
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                }`}>
                  <FileSignature size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    {(ojo === 'AO' && modalidadBilateral === 'escalonada') ? 'Consentimiento Informado Dual (2 Actos)' : 'Consentimiento Informado'}
                    {cargandoConsentimiento && <Loader2 size={12} className="animate-spin text-gray-400" />}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {(ojo === 'AO' && modalidadBilateral === 'escalonada')
                      ? 'Cirugía Bilateral: 1 consentimiento independiente por cada ojo / acto quirúrgico'
                      : ojo === 'AO'
                        ? 'Cirugía Bilateral Simultánea: 1 consentimiento único (Ambos Ojos en el mismo acto)'
                        : `Cirugía Unilateral (${ojo}): Firma digital anticipada por WhatsApp o impresión en papel`}
                  </p>
                </div>
              </div>

              {/* Badge de Estado Global / Resumen */}
              {(ojo === 'AO' && modalidadBilateral === 'escalonada') ? (
                primerOjoConsentimiento?.firmado && segundoOjoConsentimiento?.firmado ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 size={11} /> Ambos Ojos Firmados
                  </span>
                ) : primerOjoConsentimiento?.firmado || segundoOjoConsentimiento?.firmado ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <Clock size={11} /> 1 de 2 Firmado
                  </span>
                ) : (primerOjoConsentimiento?.estado?.includes('enviado') || segundoOjoConsentimiento?.estado?.includes('enviado')) ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 bg-sky-500/10 border border-sky-500/30 text-sky-400">
                    <Clock size={11} /> Enviado WhatsApp
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 border border-neutral-700 text-gray-400">
                    Pendientes
                  </span>
                )
              ) : consentimiento?.firmado ? (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                  consentimiento.modo_firma === 'papel'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  <CheckCircle2 size={11} />
                  {consentimiento.modo_firma === 'papel' ? 'Firmado en Papel' : 'Firmado Digitalmente'}
                </span>
              ) : (consentimiento?.estado === 'enviado_wa' || consentimiento?.estado === 'enviado_whatsapp' || consentimiento?.estado === 'esperando_apertura') ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Clock size={11} />
                  {consentimiento?.estado === 'esperando_apertura' ? 'Esperando Respuesta' : 'Enviado WhatsApp (Pendiente Firma)'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 border border-neutral-700 text-gray-400">
                  Pendiente
                </span>
              )}
            </div>

            {/* Mensajes de feedback */}
            {feedbackConsentimiento && (
              <div className={`p-2 rounded-lg text-[11px] flex items-center justify-between ${
                feedbackConsentimiento.tipo === 'ok'
                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
              }`}>
                <span>{feedbackConsentimiento.mensaje}</span>
                <button
                  type="button"
                  onClick={() => setFeedbackConsentimiento(null)}
                  className="text-gray-400 hover:text-white ml-2 text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* VISTA DUAL: CIRUGÍA BILATERAL ESCALONADA */}
            {(ojo === 'AO' && modalidadBilateral === 'escalonada') ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* SUB-CARD 1: PRIMER OJO */}
                  <div className="p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-bold text-gray-200">
                          1° {ordenOjos === 'OI_primero' ? 'Ojo Izquierdo (OI)' : 'Ojo Derecho (OD)'}
                        </span>
                        {primerOjoConsentimiento?.firmado ? (
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border ${
                            primerOjoConsentimiento.modo_firma === 'papel'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}>
                            {primerOjoConsentimiento.modo_firma === 'papel' ? 'Papel' : 'Digital'}
                          </span>
                        ) : primerOjoConsentimiento?.estado?.includes('enviado') ? (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            Enviado WA
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-neutral-800 text-gray-400">
                            Pendiente
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Calendar size={11} className="text-gray-500" />
                        <span>{primerOjoConsentimiento?.fecha_cirugia || primerOjoConsentimiento?.fecha || fechaDefinitiva || fechaProbable || 'Fecha no definida'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirModalWhatsApp(ordenOjos === 'OI_primero' ? 'OI' : 'OD')}
                          disabled={guardando}
                          className="px-2 py-1 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-all border border-emerald-500/30 cursor-pointer"
                          title={`Enviar consentimiento del 1° ojo (${ordenOjos === 'OI_primero' ? 'OI' : 'OD'}) por WhatsApp`}
                        >
                          <Send size={11} />
                          <span>WA 1° Ojo ({ordenOjos === 'OI_primero' ? 'OI' : 'OD'})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleImprimirConsentimientoPapel(ordenOjos === 'OI_primero' ? 'OI' : 'OD')}
                          disabled={guardando}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-200 rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-all border border-neutral-700 cursor-pointer"
                          title={`Imprimir documento oficial en blanco del 1° ojo (${ordenOjos === 'OI_primero' ? 'OI' : 'OD'})`}
                        >
                          <Printer size={11} className="text-gray-300" />
                          <span>Papel</span>
                        </button>
                      </div>

                      {primerOjoConsentimiento?.firmado ? (
                        <button
                          type="button"
                          onClick={() => handleVerConsentimientoFirmado(ordenOjos === 'OI_primero' ? 'OI' : 'OD', primerOjoConsentimiento?.turno_id)}
                          className="w-full py-0.5 text-center text-[10.5px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Download size={11} />
                          <span>Ver PDF Firmado (1° Ojo)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalFirmaPapel('primer_ojo')}
                          className="w-full py-0.5 text-center text-[10px] text-blue-400 hover:text-blue-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={11} />
                          <span>Asentar firma física 1° ojo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SUB-CARD 2: SEGUNDO OJO */}
                  <div className="p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-bold text-gray-200">
                          2° {ordenOjos === 'OI_primero' ? 'Ojo Derecho (OD)' : 'Ojo Izquierdo (OI)'}
                        </span>
                        {segundoOjoConsentimiento?.firmado ? (
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border ${
                            segundoOjoConsentimiento.modo_firma === 'papel'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}>
                            {segundoOjoConsentimiento.modo_firma === 'papel' ? 'Papel' : 'Digital'}
                          </span>
                        ) : segundoOjoConsentimiento?.estado?.includes('enviado') ? (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            Enviado WA
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-neutral-800 text-gray-400">
                            Pendiente
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Calendar size={11} className="text-gray-500" />
                        <span>{segundoOjoConsentimiento?.fecha_cirugia || segundoOjoConsentimiento?.fecha || fechaDefinitiva2doOjo || fechaProbable2doOjo || 'Fecha no definida'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirModalWhatsApp(ordenOjos === 'OI_primero' ? 'OD' : 'OI')}
                          disabled={guardando}
                          className="px-2 py-1 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-all border border-emerald-500/30 cursor-pointer"
                          title={`Enviar consentimiento del 2° ojo (${ordenOjos === 'OI_primero' ? 'OD' : 'OI'}) por WhatsApp`}
                        >
                          <Send size={11} />
                          <span>WA 2° Ojo ({ordenOjos === 'OI_primero' ? 'OD' : 'OI'})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleImprimirConsentimientoPapel(ordenOjos === 'OI_primero' ? 'OD' : 'OI')}
                          disabled={guardando}
                          className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-200 rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-all border border-neutral-700 cursor-pointer"
                          title={`Imprimir documento oficial en blanco del 2° ojo (${ordenOjos === 'OI_primero' ? 'OD' : 'OI'})`}
                        >
                          <Printer size={11} className="text-gray-300" />
                          <span>Papel</span>
                        </button>
                      </div>

                      {segundoOjoConsentimiento?.firmado ? (
                        <button
                          type="button"
                          onClick={() => handleVerConsentimientoFirmado(ordenOjos === 'OI_primero' ? 'OD' : 'OI', segundoOjoConsentimiento?.turno_id)}
                          className="w-full py-0.5 text-center text-[10.5px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Download size={11} />
                          <span>Ver PDF Firmado (2° Ojo)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalFirmaPapel('segundo_ojo')}
                          className="w-full py-0.5 text-center text-[10px] text-blue-400 hover:text-blue-300 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={11} />
                          <span>Asentar firma física 2° ojo</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones Masivas Unificadas Bilaterales */}
                <div className="pt-1 border-t border-neutral-800/80 flex items-center justify-between text-[11px] gap-2">
                  <button
                    type="button"
                    onClick={() => abrirModalWhatsApp('ambos')}
                    className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Send size={11} />
                    <span>Asistente WhatsApp (Ambos Ojos)</span>
                  </button>

                  {(!primerOjoConsentimiento?.firmado || !segundoOjoConsentimiento?.firmado) && (
                    <button
                      type="button"
                      onClick={() => abrirModalFirmaPapel('ambos')}
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <CheckCircle2 size={11} />
                      <span>Asentar Ambos en Papel</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* VISTA ESTÁNDAR: CIRUGÍA UNILATERAL O ACTO ÚNICO */
              <div className="space-y-3">
                {/* Acciones Rápidas de Consentimiento */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => abrirModalWhatsApp(ojo === 'AO' ? 'AO' : ojo)}
                    disabled={guardando}
                    className="px-2.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all border border-emerald-500/30 cursor-pointer shadow-sm"
                    title="Abrir asistente de envío y simulación del Consentimiento Informado por WhatsApp"
                  >
                    <Send size={12} />
                    <span>
                      {consentimiento?.estado === 'enviado_wa' || consentimiento?.estado === 'enviado_whatsapp'
                        ? `Reenviar WhatsApp (${ojo})`
                        : `Enviar por WhatsApp (${ojo})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleImprimirConsentimientoPapel(ojo === 'AO' ? 'AO' : ojo)}
                    disabled={guardando}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-200 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all border border-neutral-700 cursor-pointer"
                    title="Abrir e imprimir el consentimiento oficial en blanco para firma manuscrita"
                  >
                    <Printer size={12} className="text-gray-300" />
                    <span>Imprimir p/ Papel ({ojo})</span>
                  </button>
                </div>

                {/* Acciones Secundarias: Registrar Firma Papel o Ver PDF Firmado */}
                <div className="pt-1 flex items-center justify-between text-[11px] gap-2">
                  {!consentimiento?.firmado ? (
                    <button
                      type="button"
                      onClick={() => abrirModalFirmaPapel(ojo === 'AO' ? 'ambos' : 'primer_ojo')}
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 size={12} />
                      <span>¿Firmó en papel en clínica? Asentar aquí</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerConsentimientoFirmado()}
                        className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Download size={12} />
                        <span>Ver PDF Oficial Firmado</span>
                      </button>
                      {consentimiento.modo_firma === 'papel' && (
                        <span className="text-[10px] text-gray-400 italic">
                          ({consentimiento.observaciones_papel || 'Firma física manuscrita'})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Panel Desplegable para Asentar Firma en Papel */}
            {mostrandoModalFirmaPapel && (
              <div className="p-3 bg-neutral-950 border border-blue-500/40 rounded-lg space-y-2.5 animate-fade-in shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    Asentar Consentimiento Firmado en Papel
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrandoModalFirmaPapel(false)}
                    className="text-gray-400 hover:text-white p-0.5"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Si es bilateral escalonada, selector de objetivo */}
                {(ojo === 'AO' && modalidadBilateral === 'escalonada') && (
                  <div className="flex items-center gap-2 text-[10.5px]">
                    <span className="text-gray-400">Acto objetivo:</span>
                    <button
                      type="button"
                      onClick={() => setOjoObjetivoFirmaPapel('primer_ojo')}
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                        ojoObjetivoFirmaPapel === 'primer_ojo'
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-neutral-900 text-gray-400 border-neutral-700'
                      }`}
                    >
                      1° Ojo ({ordenOjos === 'OI_primero' ? 'OI' : 'OD'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOjoObjetivoFirmaPapel('segundo_ojo')}
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                        ojoObjetivoFirmaPapel === 'segundo_ojo'
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-neutral-900 text-gray-400 border-neutral-700'
                      }`}
                    >
                      2° Ojo ({ordenOjos === 'OI_primero' ? 'OD' : 'OI'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOjoObjetivoFirmaPapel('segundo_ojo')}
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                        ojoObjetivoFirmaPapel === 'segundo_ojo'
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-neutral-900 text-gray-400 border-neutral-700'
                      }`}
                    >
                      2° Ojo ({segundoOjoConsentimiento?.ojo || 'OI'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOjoObjetivoFirmaPapel('ambos')}
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                        ojoObjetivoFirmaPapel === 'ambos'
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-neutral-900 text-gray-400 border-neutral-700'
                      }`}
                    >
                      Ambos Ojos
                    </button>
                  </div>
                )}

                <p className="text-[10.5px] text-gray-300">
                  Esta acción registrará que el paciente firmó físicamente el documento impreso, marcará el ítem en el Checklist Prequirúrgico y sincronizará con Quirófano.
                </p>
                <input
                  type="text"
                  value={obsFirmaPapel}
                  onChange={(e) => setObsFirmaPapel(e.target.value)}
                  placeholder="Detalle opcional (ej: Firmado en recepción ante secretaria)..."
                  className="w-full px-2.5 py-1 text-xs bg-neutral-900 border border-[var(--border)] rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrandoModalFirmaPapel(false)}
                    className="px-2.5 py-1 text-[11px] text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRegistrarFirmaPapel}
                    disabled={guardandoFirmaPapel}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {guardandoFirmaPapel ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>Confirmar Firma en Papel</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card: Próxima Acción de Seguimiento & WhatsApp Rápido */}
          <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-400" />
                  Próxima Acción Programada
                </div>
                <p className="text-[10.5px] text-gray-400 mt-0.5">
                  Recordatorio interno de seguimiento y contacto del paciente
                </p>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                {onAbrirRecordatorioQx && (
                  <button
                    type="button"
                    onClick={onAbrirRecordatorioQx}
                    className="px-2.5 py-1 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 hover:text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm border border-indigo-500/40 cursor-pointer"
                    title="Enviar recordatorio oficial de fecha de cirugía y preparación prequirúrgica por WhatsApp (Meta UTILITY)"
                  >
                    <BellRing size={12} className="text-indigo-400" />
                    <span>Recordatorio Qx</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onAbrirModalWhatsApp}
                  className="px-2.5 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm border border-emerald-500/40 cursor-pointer"
                  title="Abrir modal para enviar plantillas quirúrgicas por WhatsApp"
                >
                  <Send size={12} />
                  <span>Contactar WhatsApp</span>
                </button>
              </div>
            </div>

            {/* CASO A: Diálogo para Registrar Cumplimiento y Pasar a Bitácora */}
            {mostrandoCompletarAccion && (
              <div className="p-3 bg-neutral-900 border border-emerald-500/40 rounded-xl space-y-2.5 animate-fade-in shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Registrar Cumplimiento de la Acción
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrandoCompletarAccion(false)}
                    className="text-gray-400 hover:text-white p-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-[11px] text-gray-300">
                  Se registrará en la <strong>Bitácora del Paciente</strong> que la acción fue cumplida y se liberará el recordatorio del caso.
                </p>
                <textarea
                  rows={2}
                  value={conclusionAccion}
                  onChange={(e) => setConclusionAccion(e.target.value)}
                  placeholder="Escribe la conclusión del contacto (ej: Hablé con el paciente, confirmó que presentará los estudios prequirúrgicos el martes)..."
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-[var(--border)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMostrandoCompletarAccion(false)}
                    className="px-2.5 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={completandoAccion}
                    onClick={handleConfirmarCompletarAccion}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    {completandoAccion ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    <span>Confirmar y Guardar en Bitácora</span>
                  </button>
                </div>
              </div>
            )}

            {/* CASO B: Tarjeta Activa de Recordatorio Guardado */}
            {!mostrandoCompletarAccion && Boolean(caso.proxima_accion_fecha || caso.proxima_accion_texto) && !editandoProximaAccion && (() => {
              let labelFecha = ''
              let diasDiferencia: number | null = null
              let esHoy = false
              let esVencida = false

              if (caso.proxima_accion_fecha) {
                const partes = caso.proxima_accion_fecha.split('-')
                if (partes.length === 3) {
                  labelFecha = `${partes[2]}/${partes[1]}/${partes[0]}`
                } else {
                  labelFecha = caso.proxima_accion_fecha
                }

                const hoy = new Date()
                hoy.setHours(0, 0, 0, 0)
                const fechaObj = new Date(`${caso.proxima_accion_fecha}T00:00:00`)
                if (!isNaN(fechaObj.getTime())) {
                  const diffMs = fechaObj.getTime() - hoy.getTime()
                  diasDiferencia = Math.round(diffMs / (1000 * 60 * 60 * 24))
                  if (diasDiferencia === 0) esHoy = true
                  else if (diasDiferencia < 0) esVencida = true
                }
              }

              const borderClase = esVencida
                ? 'border-red-500/50 bg-red-950/20'
                : esHoy
                ? 'border-amber-500/50 bg-amber-950/30 ring-1 ring-amber-500/30'
                : 'border-blue-500/40 bg-blue-950/20'

              const badgeClase = esVencida
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : esHoy
                ? 'bg-amber-500/30 text-amber-200 border-amber-500/50 animate-pulse'
                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'

              return (
                <div className={`p-3 rounded-xl border ${borderClase} space-y-2.5`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono flex items-center gap-1.5 ${badgeClase}`}>
                      <Clock size={12} />
                      {esHoy
                        ? '¡ACCIÓN PROGRAMADA PARA HOY!'
                        : esVencida
                        ? `VENCIDA (debía realizarse el ${labelFecha})`
                        : `PROGRAMADA: ${labelFecha} (en ${diasDiferencia} días)`}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMostrandoCompletarAccion(true)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        title="Marcar como cumplida y pasar a la bitácora"
                      >
                        <CheckCircle2 size={13} />
                        <span>Marcar como Realizada</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoProximaAccion(true)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-[var(--border)] transition-colors cursor-pointer"
                        title="Cambiar fecha o texto del recordatorio"
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-neutral-900/90 rounded-lg border border-white/5 text-xs text-white">
                    <p className="font-semibold text-gray-100">
                      {caso.proxima_accion_texto || 'Contacto de seguimiento pautado'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-gray-400 pt-0.5">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={11} /> Acción activa sincronizada con el Pipeline Quirúrgico
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProximaAccionFecha('')
                        setProximaAccionTexto('')
                        handleGuardarCambios()
                      }}
                      className="text-red-400 hover:text-red-300 hover:underline text-[10.5px] transition-colors"
                    >
                      Eliminar recordatorio
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* CASO C: Formulario de Carga / Edición de Acción Programada */}
            {(!Boolean(caso.proxima_accion_fecha || caso.proxima_accion_texto) || editandoProximaAccion) && !mostrandoCompletarAccion && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1">
                    <input
                      type="date"
                      value={proximaAccionFecha}
                      onChange={(e) => setProximaAccionFecha(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white font-mono"
                      title="Fecha para la próxima acción de contacto"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={proximaAccionTexto}
                      placeholder="Ej: Llamar para saber cómo está / Confirmar fecha..."
                      onChange={(e) => setProximaAccionTexto(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Accesos Rápidos de Intervalo de Seguimiento */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-gray-400">
                  <span className="font-semibold text-gray-400">Sugerir fecha:</span>
                  <button
                    type="button"
                    onClick={() => aplicarPresetFecha(3)}
                    className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-purple-300 border border-purple-500/20 transition-colors"
                  >
                    +3 días
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetFecha(7)}
                    className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-purple-300 border border-purple-500/20 transition-colors"
                  >
                    +7 días
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetFecha(15)}
                    className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-purple-300 border border-purple-500/20 transition-colors"
                  >
                    +15 días
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetFecha(30)}
                    className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-purple-300 border border-purple-500/20 transition-colors"
                  >
                    +30 días
                  </button>

                  {editandoProximaAccion && (
                    <button
                      type="button"
                      onClick={() => {
                        setProximaAccionFecha(caso.proxima_accion_fecha || '')
                        setProximaAccionTexto(caso.proxima_accion_texto || '')
                        setEditandoProximaAccion(false)
                      }}
                      className="ml-auto text-gray-400 hover:text-white underline text-[10.5px]"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                {/* Estado de persistencia / Guardado inmediato del recordatorio */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  {(proximaAccionFecha !== (caso.proxima_accion_fecha || '') || proximaAccionTexto !== (caso.proxima_accion_texto || '')) ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-amber-400 text-[10.5px] flex items-center gap-1 font-medium">
                        <Clock size={11} /> Acción modificada (sin guardar)
                      </span>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => {
                          handleGuardarCambios()
                          setEditandoProximaAccion(false)
                        }}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-colors shadow cursor-pointer"
                      >
                        Guardar Acción Programada
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-[10.5px]">
                      Define una fecha y motivo para recordar el seguimiento comercial en el Pipeline
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card: Automatización de Cadencias de Seguimiento y Snooze (Gestión por Excepción) */}
          <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-neutral-900/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    Seguimiento Asistido Automatizado
                    {seguimientoAutoActivo ? (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-semibold">
                        Activo
                      </span>
                    ) : (
                      <span className="text-[10px] bg-neutral-800 text-gray-400 border border-[var(--border)] px-1.5 py-0.2 rounded font-mono font-semibold">
                        Pausado
                      </span>
                    )}
                  </h4>
                  <p className="text-[10.5px] text-gray-400">
                    Cadencia oficial por WhatsApp ({caso.estado === 'en_analisis' ? 'Cadencia B: D+2, D+6, D+13, D+25' : 'Cadencia A: D+3, D+8, D+18'})
                  </p>
                </div>
              </div>

              {/* Switch On/Off */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={seguimientoAutoActivo}
                  onChange={(e) => setSeguimientoAutoActivo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Controles de Snooze (Pausa programada) */}
            <div className="pt-2 border-t border-[var(--border)]/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-semibold text-[11px] flex items-center gap-1.5">
                  <Clock size={12} className="text-purple-400" />
                  Postergación Programada (Snooze):
                </span>
                {snoozeHasta && (
                  <span className="text-[10px] text-purple-300 font-mono font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                    Pausado hasta: {snoozeHasta}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + 30)
                    setSnoozeHasta(d.toISOString().slice(0, 10))
                  }}
                  className="px-2 py-1 text-[10.5px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-purple-500/20 font-medium transition-colors"
                >
                  ⏸️ +30 días
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + 60)
                    setSnoozeHasta(d.toISOString().slice(0, 10))
                  }}
                  className="px-2 py-1 text-[10.5px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-purple-500/20 font-medium transition-colors"
                >
                  ⏸️ +60 días
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + 90)
                    setSnoozeHasta(d.toISOString().slice(0, 10))
                  }}
                  className="px-2 py-1 text-[10.5px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-purple-500/20 font-medium transition-colors"
                >
                  ⏸️ +90 días
                </button>
                {snoozeHasta && (
                  <button
                    type="button"
                    onClick={() => setSnoozeHasta('')}
                    className="px-2 py-1 text-[10.5px] text-rose-400 hover:underline ml-auto"
                  >
                    Quitar pausa
                  </button>
                )}
              </div>
            </div>

            {/* Tipificación de Causa de Demora o Desestimiento para Pareto */}
            <div className="pt-2 border-t border-[var(--border)]/60 space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 block">
                Causa Raíz de Demora u Objeción (Pareto):
              </label>
              <select
                value={categoriaCausa}
                onChange={(e) => setCategoriaCausa(e.target.value)}
                className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Seleccionar causa raíz...</option>
                <option value="economico">Económico / Costo Arancel</option>
                <option value="tiempos_personales">Tiempos / Compromisos Personales</option>
                <option value="miedo_dudas">Miedo / Dudas Asistenciales</option>
                <option value="eligio_otro_centro">Eligió Otra Clínica / Centro</option>
                <option value="medico_no_indica">Criterio Clínico / No Indica Aún</option>
                <option value="otros">Otras Causas / Sin Especificar</option>
              </select>
              <input
                type="text"
                placeholder="Detalle o comentario sobre la demora..."
                value={motivoDemora}
                onChange={(e) => setMotivoDemora(e.target.value)}
                className="w-full text-xs bg-neutral-950 border border-[var(--border)] text-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-indigo-500 placeholder-gray-500"
              />
            </div>

            {/* Guardar Configuración de Seguimiento */}
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                disabled={guardandoSeguimiento}
                onClick={async () => {
                  setGuardandoSeguimiento(true)
                  try {
                    const res = await apiFetch(`/api/asesorias-quirurgicas/${caso.id}/seguimiento-accion`, {
                      method: 'POST',
                      body: JSON.stringify({
                        activo: seguimientoAutoActivo,
                        snooze_hasta: snoozeHasta || null,
                        categoria_causa: categoriaCausa || null,
                        motivo_demora: motivoDemora || null
                      })
                    })
                    if (res.ok) {
                      const data = await res.json()
                      if (data.success) {
                        setFeedbackSeguimiento('Seguimiento guardado correctamente.')
                        setTimeout(() => setFeedbackSeguimiento(null), 3000)
                        if (onGuardar) onGuardar({})
                      }
                    }
                  } catch (e: any) {
                    console.error('Error guardando seguimiento:', e)
                    setFeedbackSeguimiento('Error al guardar seguimiento.')
                    setTimeout(() => setFeedbackSeguimiento(null), 3000)
                  } finally {
                    setGuardandoSeguimiento(false)
                  }
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50"
              >
                {guardandoSeguimiento ? 'Guardando...' : 'Aplicar Seguimiento'}
              </button>
            </div>
            {feedbackSeguimiento && (
              <p className="text-[11px] text-emerald-400 font-medium text-right animate-in fade-in">
                {feedbackSeguimiento}
              </p>
            )}
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

      {modalConsentimientoWhatsAppOpen && caso?.id && (
        <ModalEnviarConsentimientoWhatsApp
          isOpen={modalConsentimientoWhatsAppOpen}
          onClose={() => {
            setModalConsentimientoWhatsAppOpen(false)
            setModalOjoObjetivo(undefined)
          }}
          casoId={caso.id}
          pacienteId={pacienteId}
          pacienteNombreDefault={pacienteNombre}
          pacienteTelefonoDefault={pacienteTelefono || undefined}
          ojoDefault={modalOjoObjetivo}
          onConsentimientoEnviado={() => {
            fetchConsentimientoCaso()
            setFeedbackConsentimiento({ tipo: 'ok', mensaje: 'Consentimiento Informado enviado por WhatsApp con éxito.' })
          }}
        />
      )}
    </div>
  )
}
