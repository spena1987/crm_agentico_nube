'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Eye,
  Search,
  Upload,
  Send,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Phone,
  User,
  Database,
  Smartphone,
  Clock,
  Check,
  CheckCheck,
  X,
  ExternalLink,
  Sparkles,
  Layers,
  ShieldCheck,
  ClipboardPaste,
  FolderOpen,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  Edit3,
  Trash2,
  Ban,
  Info
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { apiFetch, BACKEND_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import {
  formatPhoneDisplay,
  normalizePhoneNumber,
  extractLocalArgentineNumber,
  cleanLocalInputDigits,
  assembleInternationalPhone
} from '@/lib/phoneUtils'

const ESTUDIOS_PRESETS = [
  'OCT Macular y Papilar',
  'Campo Visual Computarizado',
  'Topografía Corneal (Pentacam)',
  'Biometría Ocular (IOL Master)',
  'Paquimetría Corneal',
  'Retinografía Color',
  'Ecografía Ocular Modo A/B',
  'Recuento Endotelial',
  'Aberrometría / OPD Scan',
  'Meibografía / Ojo Seco'
]

interface PacienteGeclisaInfo {
  dni: string
  nombre_completo: string
  geclisa_pac_id: number | null
  geclisa_ficha_id: number | null
  telefono_geclisa: string
  telefono_normalizado: string
  telefono_display: string
  obra_social: string
  plan: string
  nro_afiliado: string
  email: string
  existe_en_crm_quirurgico: boolean
  paciente_crm_id: string | null
}

interface ArchivoGeclisaItem {
  as_id: number
  ficha_id: number
  fecha: string
  hora: string
  titulo: string
  observaciones: string
  profesional_nombre: string
  pre_id: number
}

interface EstudioHistorialItem {
  id: string
  dni_paciente: string
  nombre_paciente: string
  telefono_destino: string
  tipo: string
  ojo: string
  fecha: string
  nombre_archivo: string
  mime_type: string
  tamano_bytes: number
  geclisa_ficha_id: number
  geclisa_as_id: number | null
  wamid: string | null
  whatsapp_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped' | string
  whatsapp_error?: string | null
  whatsapp_sent_at?: string | null
  whatsapp_delivered_at?: string | null
  whatsapp_read_at?: string | null
  tecnico_nombre?: string | null
  tecnico_pre_id?: number | null
  created_at: string
  estado?: 'activo' | 'editado' | 'anulado'
  motivo_anulacion?: string | null
  anulado_at?: string | null
  anulado_por_nombre?: string | null
  anulado_por_usuario_id?: string | null
  eliminado_geclisa?: boolean
  editado_at?: string | null
  editado_por_nombre?: string | null
  editado_por_usuario_id?: string | null
  historial_cambios?: Array<{
    campo: string
    anterior: string | null
    nuevo: string | null
    fecha: string
    usuario: string
  }>
  observaciones?: string | null
}

interface EstudioTemplateItem {
  id?: string
  name: string
  header_type: 'DOCUMENT' | 'IMAGE' | 'TEXT' | string
  header_content?: string
  body_text: string
  status?: string
  category?: string
  titulo_amigable?: string
  buttons?: Array<{ type: string; text: string; url?: string }>
}

export default function EstudiosTecnicosPage() {
  const { user } = useAuth()
  const { profile, isAdmin, refreshPermissions } = usePermissions()

  // Estado de la Línea 2 de WhatsApp
  const [lineaEstudiosStatus, setLineaEstudiosStatus] = useState<{
    configured: boolean
    connected?: boolean
    phone_number_id?: string
    display_phone_number?: string
    verified_name?: string
  } | null>(null)

  // Paso 1: Búsqueda por DNI en Geclisa
  const [dniInput, setDniInput] = useState('')
  const [buscandoPaciente, setBuscandoPaciente] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [paciente, setPaciente] = useState<PacienteGeclisaInfo | null>(null)
  const [archivosGeclisa, setArchivosGeclisa] = useState<ArchivoGeclisaItem[]>([])
  const [showArchivosGeclisa, setShowArchivosGeclisa] = useState(false)

  // Paso 2: Datos del Estudio y Teléfono (Estrategia 1: Prefijo Fijo + Celular Local)
  const [codigoPais, setCodigoPais] = useState('549')
  const [telefonoLocal, setTelefonoLocal] = useState('')
  const telefonoDestino = assembleInternationalPhone(telefonoLocal, codigoPais)
  const [tipoEstudio, setTipoEstudio] = useState('OCT Macular y Papilar')
  const [ojo, setOjo] = useState<'AO' | 'OD' | 'OI'>('AO')
  const [observaciones, setObservaciones] = useState('')

  // Paso 3: Archivos (Drag & Drop + Ctrl+V)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [unificarEnPdf, setUnificarEnPdf] = useState(true)
  const [aplicarCaratula, setAplicarCaratula] = useState(true)
  const [guardarEnGeclisa, setGuardarEnGeclisa] = useState(true)
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Prestador Geclisa (fallback manual para Admin si no tiene pre_id en su perfil)
  const [manualPreId, setManualPreId] = useState<string>('')
  const [prestadoresGeclisa, setPrestadoresGeclisa] = useState<Array<{ id: number; nombre: string }>>([])

  // Plantillas de WhatsApp para Estudios (Meta Cloud API Línea 2)
  const [estudiosTemplates, setEstudiosTemplates] = useState<EstudioTemplateItem[]>([])
  const [defaultTemplates, setDefaultTemplates] = useState<{ default_pdf: string; default_img: string }>({
    default_pdf: 'entrega_estudio_oftalmologico_pdf',
    default_img: 'entrega_estudio_oftalmologico_img'
  })
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>('auto')
  const [mostrarPreviewPlantilla, setMostrarPreviewPlantilla] = useState<boolean>(false)

  // Estado de ejecución de envío
  const [enviandoEstudio, setEnviandoEstudio] = useState(false)
  const [enviandoExistenteId, setEnviandoExistenteId] = useState<number | null>(null)
  const [reintentandoId, setReintentandoId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error'
    title: string
    detail: string
  } | null>(null)

  // Historial y métricas del día
  const [historial, setHistorial] = useState<EstudioHistorialItem[]>([])
  const [metricas, setMetricas] = useState({
    total_hoy: 0,
    guardados_geclisa_hoy: 0,
    entregados_o_leidos_hoy: 0,
    leidos_azul_hoy: 0,
    fallidos_hoy: 0,
    anulados_hoy: 0
  })
  const [filtroDniHistorial, setFiltroDniHistorial] = useState('')
  const [filtroStatusWa, setFiltroStatusWa] = useState('ALL')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'anulados'>('todos')
  const [cargandoHistorial, setCargandoHistorial] = useState(true)

  // Estados para Edición / Rectificación
  const [editingItem, setEditingItem] = useState<EstudioHistorialItem | null>(null)
  const [editTipo, setEditTipo] = useState('')
  const [editOjo, setEditOjo] = useState('AO')
  const [editObservaciones, setEditObservaciones] = useState('')
  const [editandoGuardando, setEditandoGuardando] = useState(false)

  // Estados para Anulación y Purga Segura
  const [anulatingItem, setAnulatingItem] = useState<EstudioHistorialItem | null>(null)
  const [anularMotivo, setAnularMotivo] = useState('')
  const [anularEliminarGeclisa, setAnularEliminarGeclisa] = useState(true)
  const [anularNotificarWa, setAnularNotificarWa] = useState(false)
  const [anularMensajeWa, setAnularMensajeWa] = useState('')
  const [anulandoGuardando, setAnulandoGuardando] = useState(false)

  // Modal para ver detalles / historial de auditoría
  const [detalleItem, setDetalleItem] = useState<EstudioHistorialItem | null>(null)

  const tecnicoPreId = profile?.geclisa_pre_id || (manualPreId ? parseInt(manualPreId, 10) : null)
  const tecnicoNombre =
    profile?.geclisa_prestador_nombre ||
    profile?.nombre_completo ||
    user?.email?.split('@')[0] ||
    'Técnico Oftalmólogo'

  const isImageWorkflow =
    selectedFiles.length > 0 &&
    selectedFiles.every((f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(f.name)) &&
    !unificarEnPdf

  const activeTemplateName =
    plantillaSeleccionada === 'auto'
      ? (isImageWorkflow ? defaultTemplates.default_img : defaultTemplates.default_pdf)
      : plantillaSeleccionada

  const activeTemplate = estudiosTemplates.find((t) => t.name === activeTemplateName) || {
    name: activeTemplateName,
    header_type: isImageWorkflow ? 'IMAGE' : 'DOCUMENT',
    body_text:
      'Hola {{1}}, le compartimos su estudio oftalmológico de {{2}} realizado en Centrovisión.\n\nEl archivo oficial se encuentra adjunto a este mensaje.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Confirmar recepción' }]
  }

  const previewBodyText = (activeTemplate.body_text || '')
    .replace('{{1}}', paciente?.nombre_completo || 'Paciente')
    .replace('{{2}}', tipoEstudio || 'Estudio Oftalmológico')


  const fetchLineaStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/whatsapp/lines')
      if (res.ok) {
        const data = await res.json()
        setLineaEstudiosStatus(data.linea_estudios || null)
      }
    } catch (e) {}
  }, [])

  const fetchHistorial = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filtroDniHistorial.trim()) params.set('dni', filtroDniHistorial.trim())
      if (filtroStatusWa !== 'ALL') params.set('status_wa', filtroStatusWa)
      if (filtroEstado !== 'todos') params.set('estado', filtroEstado)
      params.set('limit', '50')

      const res = await apiFetch(`/api/estudios-tecnicos/historial?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setHistorial(data.items || [])
        if (data.metricas) setMetricas(data.metricas)
      }
    } catch (e) {
      console.error('Error cargando historial de estudios:', e)
    } finally {
      setCargandoHistorial(false)
    }
  }, [filtroDniHistorial, filtroStatusWa, filtroEstado])

  useEffect(() => {
    refreshPermissions()
    fetchLineaStatus()
    // Cargar catálogo de plantillas oficiales para estudios oftalmológicos
    apiFetch('/api/whatsapp/estudios-templates')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.templates && Array.isArray(d.templates)) {
          setEstudiosTemplates(d.templates)
        }
        if (d?.default_pdf || d?.default_img) {
          setDefaultTemplates({
            default_pdf: d.default_pdf || 'entrega_estudio_oftalmologico_pdf',
            default_img: d.default_img || 'entrega_estudio_oftalmologico_img'
          })
        }
      })
      .catch(() => {})

    fetchHistorial()

    // Si el usuario no tiene geclisa_pre_id en su perfil, cargar lista de prestadores para selección rápida
    if (!profile?.geclisa_pre_id) {
      apiFetch('/api/geclisa/prestadores')
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d?.prestadores) {
            setPrestadoresGeclisa(
              d.prestadores.map((p: any) => ({
                id: p.PreId || p.id,
                nombre: p.NombreCompleto || p.nombre || `Prestador #${p.PreId}`
              }))
            )
          }
        })
        .catch(() => {})
    }

    // Suscripción Realtime a public.estudios_oftalmo para ver cambio de tildes (sent -> delivered -> read) en vivo
    const channel = supabase
      .channel('estudios-oftalmo-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estudios_oftalmo' },
        () => {
          fetchHistorial()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLineaStatus, fetchHistorial, profile?.geclisa_pre_id])

  // Soporte global para pegar capturas con Ctrl + V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) return
      const pastedFiles = Array.from(e.clipboardData.files).filter(f =>
        ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(f.type.toLowerCase())
      )
      if (pastedFiles.length > 0) {
        e.preventDefault()
        setSelectedFiles(prev => [...prev, ...pastedFiles])
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const handleBuscarPaciente = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanDni = dniInput.replace(/\D/g, '')
    if (cleanDni.length < 6) {
      setErrorBusqueda('Ingresa un número de DNI válido (al menos 6 dígitos).')
      return
    }

    setBuscandoPaciente(true)
    setErrorBusqueda(null)
    setFeedback(null)

    try {
      const res = await apiFetch(`/api/estudios-tecnicos/buscar-paciente?dni=${cleanDni}`)
      const data = await res.json()
      if (!res.ok) {
        setPaciente(null)
        setArchivosGeclisa([])
        setErrorBusqueda(data.detail || `No se encontró ningún paciente con DNI ${cleanDni} en Geclisa.`)
        return
      }

      const rawPaciente = data.paciente || {}
      const fichaId = rawPaciente.geclisa_ficha_id ?? rawPaciente.ficha_id ?? data.ficha_id ?? null
      const pacId = rawPaciente.geclisa_pac_id ?? rawPaciente.pac_id ?? data.pac_id ?? fichaId
      const telNorm = rawPaciente.telefono_normalizado || normalizePhoneNumber(rawPaciente.telefono_geclisa || '')

      const normalizedPaciente: PacienteGeclisaInfo = {
        dni: rawPaciente.dni || cleanDni,
        nombre_completo: rawPaciente.nombre_completo || 'Paciente',
        geclisa_pac_id: pacId ? Number(pacId) : null,
        geclisa_ficha_id: fichaId ? Number(fichaId) : null,
        telefono_geclisa: rawPaciente.telefono_geclisa || '',
        telefono_normalizado: telNorm,
        telefono_display: rawPaciente.telefono_display || (telNorm ? formatPhoneDisplay(telNorm) : ''),
        obra_social: rawPaciente.obra_social || '',
        plan: rawPaciente.plan || rawPaciente.plan_cobertura || '',
        nro_afiliado: rawPaciente.nro_afiliado || '',
        email: rawPaciente.email || '',
        existe_en_crm_quirurgico: Boolean(rawPaciente.existe_en_crm_quirurgico),
        paciente_crm_id: rawPaciente.paciente_crm_id || null
      }

      setPaciente(normalizedPaciente)
      const rawTel = normalizedPaciente.telefono_geclisa || normalizedPaciente.telefono_normalizado || ''
      setTelefonoLocal(extractLocalArgentineNumber(rawTel))
      setCodigoPais('549')

      const rawArchivos = Array.isArray(data.archivos_geclisa) ? data.archivos_geclisa : []
      const normalizedArchivos: ArchivoGeclisaItem[] = rawArchivos.map((arc: any) => ({
        as_id: Number(arc.as_id ?? arc.asId ?? arc.id ?? 0),
        ficha_id: Number(arc.ficha_id ?? arc.fichaId ?? normalizedPaciente.geclisa_ficha_id ?? 0),
        fecha: arc.fecha || '',
        hora: arc.hora || '',
        titulo: arc.titulo || 'Estudio / Documento',
        extension: arc.extension || 'pdf',
        observaciones: arc.observaciones || '',
        prestador: arc.prestador || arc.preNombre || ''
      }))
      setArchivosGeclisa(normalizedArchivos)
    } catch (err: any) {
      setErrorBusqueda(err.message || 'Error consultando Geclisa.')
    } finally {
      setBuscandoPaciente(false)
    }
  }

  const handleFileChange = (filesList: FileList | null) => {
    if (!filesList) return
    const valid = Array.from(filesList).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      return ['pdf', 'jpg', 'jpeg', 'png'].includes(ext)
    })
    if (valid.length === 0) {
      setFeedback({
        type: 'error',
        title: 'Formato no válido',
        detail: 'Solo se permiten archivos PDF, JPG o PNG.'
      })
      return
    }
    setSelectedFiles(prev => [...prev, ...valid])
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleEnviarEstudio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviandoEstudio) return
    if (!paciente || !paciente.geclisa_ficha_id) {
      setFeedback({
        type: 'error',
        title: 'Paciente no seleccionado',
        detail: 'Primero busca al paciente por DNI en Geclisa para obtener su Ficha Clínica.'
      })
      return
    }
    if (selectedFiles.length === 0) {
      setFeedback({
        type: 'error',
        title: 'Sin archivo adjunto',
        detail: 'Arrastra o selecciona al menos un archivo (PDF, JPG o PNG) del estudio oftalmológico.'
      })
      return
    }
    if (guardarEnGeclisa && !tecnicoPreId) {
      setFeedback({
        type: 'error',
        title: 'Falta Prestador Geclisa (PreId)',
        detail: 'Selecciona tu Prestador de Geclisa o pide a un Administrador que lo vincule en Ajustes > Usuarios.'
      })
      return
    }
    if (enviarWhatsapp && (!telefonoLocal.trim() || !telefonoDestino.trim())) {
      setFeedback({
        type: 'error',
        title: 'Teléfono requerido',
        detail: 'Ingresa el número de celular del paciente para enviar el estudio por WhatsApp.'
      })
      return
    }
    if (enviarWhatsapp && codigoPais === '549' && telefonoLocal.length < 10) {
      setFeedback({
        type: 'error',
        title: 'Celular incompleto',
        detail: `El celular para Argentina debe tener 10 dígitos (código de área + número, ej: 261 470 3230). Actualmente tiene ${telefonoLocal.length} dígitos.`
      })
      return
    }

    setEnviandoEstudio(true)
    setFeedback(null)

    try {
      const formData = new FormData()
      selectedFiles.forEach(f => formData.append('files', f))
      formData.append('dni', paciente.dni)
      formData.append('nombre_paciente', paciente.nombre_completo)
      formData.append('telefono', telefonoDestino.trim())
      formData.append('geclisa_ficha_id', String(paciente.geclisa_ficha_id))
      if (paciente.geclisa_pac_id) {
        formData.append('geclisa_pac_id', String(paciente.geclisa_pac_id))
      }
      if (paciente.obra_social) {
        formData.append('obra_social', paciente.obra_social)
      }
      if (paciente.plan) {
        formData.append('plan', paciente.plan)
      }
      formData.append('tipo_estudio', tipoEstudio.trim())
      formData.append('ojo', ojo)
      formData.append('observaciones', observaciones.trim())
      formData.append('unificar_en_pdf', String(unificarEnPdf))
      formData.append('aplicar_caratula', String(aplicarCaratula))
      formData.append('guardar_en_geclisa', String(guardarEnGeclisa))
      formData.append('enviar_whatsapp', String(enviarWhatsapp))
      if (enviarWhatsapp && plantillaSeleccionada && plantillaSeleccionada !== 'auto') {
        formData.append('plantilla_whatsapp', plantillaSeleccionada)
      }
      if (user?.id) formData.append('usuario_id', user.id)
      formData.append('usuario_nombre', tecnicoNombre)
      if (tecnicoPreId) formData.append('tecnico_pre_id', String(tecnicoPreId))

      const res = await apiFetch('/api/estudios-tecnicos/enviar', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'No se pudo completar el proceso',
          detail: data.detail || 'Ocurrió un error al procesar el estudio.'
        })
        return
      }

      const onlyGeclisa = guardarEnGeclisa && !enviarWhatsapp
      const onlyWa = !guardarEnGeclisa && enviarWhatsapp
      const both = guardarEnGeclisa && enviarWhatsapp

      if (both && data.geclisa_ok && data.whatsapp_ok) {
        setFeedback({
          type: 'success',
          title: '¡Estudio archivado en Geclisa y enviado por WhatsApp!',
          detail: `Guardado en Ficha #${paciente.geclisa_ficha_id} (Solapa Archivos Clínicos, AS_ID #${data.geclisa_as_id || 'OK'}) y despachado a ${formatPhoneDisplay(telefonoDestino)}.`
        })
        setSelectedFiles([])
        setObservaciones('')
      } else if (onlyGeclisa && data.geclisa_ok) {
        setFeedback({
          type: 'success',
          title: '¡Estudio guardado exitosamente en Geclisa!',
          detail: `El archivo quedó archivado en la Historia Clínica (Ficha #${paciente.geclisa_ficha_id}, Solapa Archivos Clínicos, AS_ID #${data.geclisa_as_id || 'OK'}).`
        })
        setSelectedFiles([])
        setObservaciones('')
      } else if (onlyWa && data.whatsapp_ok) {
        setFeedback({
          type: 'success',
          title: '¡Estudio enviado por WhatsApp!',
          detail: `Despachado con éxito a ${formatPhoneDisplay(telefonoDestino)}.`
        })
        setSelectedFiles([])
        setObservaciones('')
      } else if (data.geclisa_ok && !data.whatsapp_ok) {
        setFeedback({
          type: 'warning',
          title: 'Guardado en Geclisa OK, pero falló el envío por WhatsApp',
          detail: `El archivo ya quedó seguro en Geclisa (AS_ID #${data.geclisa_as_id}). Motivo WhatsApp: ${data.whatsapp_error}. Puedes reintentar desde la tabla inferior sin duplicar el archivo.`
        })
        setSelectedFiles([])
      } else if (!data.geclisa_ok && data.whatsapp_ok && both) {
        setFeedback({
          type: 'warning',
          title: 'Enviado por WhatsApp OK, pero NO se pudo guardar en Geclisa',
          detail: `Detalle Geclisa: ${data.geclisa_error || 'Error desconocido'}`
        })
      } else {
        setFeedback({
          type: 'error',
          title: 'No se pudo guardar en Geclisa',
          detail: data.geclisa_error || 'Ocurrió un error al guardar el estudio en la Historia Clínica.'
        })
      }

      // Refrescar archivos de Geclisa del paciente e historial
      handleBuscarPaciente()
      fetchHistorial()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Error de red',
        detail: err.message || 'Error comunicándose con el servidor.'
      })
    } finally {
      setEnviandoEstudio(false)
    }
  }

  const handleEnviarArchivoExistenteGeclisa = async (arc: ArchivoGeclisaItem) => {
    if (!paciente) return
    if (!telefonoDestino.trim()) {
      setFeedback({
        type: 'error',
        title: 'Falta teléfono',
        detail: 'Verifica el número de celular del paciente antes de enviar el archivo por WhatsApp.'
      })
      return
    }
    setEnviandoExistenteId(arc.as_id)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/estudios-tecnicos/enviar-existente-geclisa', {
        method: 'POST',
        body: JSON.stringify({
          geclisa_as_id: arc.as_id,
          geclisa_ficha_id: paciente.geclisa_ficha_id,
          geclisa_pac_id: paciente.geclisa_pac_id,
          dni_paciente: paciente.dni,
          nombre_paciente: paciente.nombre_completo,
          telefono: telefonoDestino.trim(),
          tipo_estudio: arc.titulo || tipoEstudio,
          ojo: 'AO',
          observaciones: arc.observaciones || '',
          usuario_id: user?.id,
          usuario_nombre: tecnicoNombre,
          tecnico_pre_id: tecnicoPreId,
          plantilla_whatsapp: plantillaSeleccionada !== 'auto' ? plantillaSeleccionada : undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          title: '¡Archivo histórico de Geclisa enviado por WhatsApp!',
          detail: `El estudio "${arc.titulo}" (AS_ID #${arc.as_id}) fue enviado a ${formatPhoneDisplay(telefonoDestino)} sin duplicarse en Geclisa.`
        })
        fetchHistorial()
      } else {
        setFeedback({
          type: 'error',
          title: 'Error enviando archivo existente',
          detail: data.detail || 'No se pudo enviar por WhatsApp.'
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Error de conexión',
        detail: err.message
      })
    } finally {
      setEnviandoExistenteId(null)
    }
  }

  const handleReintentarWhatsapp = async (item: EstudioHistorialItem) => {
    if (item.estado === 'anulado') {
      alert('No se puede reenviar por WhatsApp un estudio anulado. Debe registrar uno nuevo si corresponde.')
      return
    }
    const defaultLocal = extractLocalArgentineNumber(item.telefono_destino || telefonoDestino)
    const nuevoTel = window.prompt(
      `Confirmar o corregir celular de WhatsApp para ${item.nombre_paciente} (código de área + número, sin 0 ni 15):\nEjemplo: 261 470 3230`,
      defaultLocal || item.telefono_destino || ''
    )
    if (!nuevoTel) return

    const normalizedTel = normalizePhoneNumber(nuevoTel.trim())
    setReintentandoId(item.id)
    setFeedback(null)
    try {
      const res = await apiFetch(`/api/estudios-tecnicos/${item.id}/reintentar-whatsapp`, {
        method: 'POST',
        body: JSON.stringify({
          telefono: normalizedTel,
          plantilla_whatsapp: plantillaSeleccionada !== 'auto' ? plantillaSeleccionada : undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          title: '¡Reenvío por WhatsApp exitoso!',
          detail: `El estudio se recuperó directamente desde Geclisa (AS_ID #${item.geclisa_as_id}) y se despachó a ${formatPhoneDisplay(nuevoTel)}.`
        })
        fetchHistorial()
      } else {
        setFeedback({
          type: 'error',
          title: 'Falló el reintento de WhatsApp',
          detail: data.detail || 'Error al reintentar.'
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Error de conexión',
        detail: err.message
      })
    } finally {
      setReintentandoId(null)
    }
  }

  const handleOpenEdit = (item: EstudioHistorialItem) => {
    if (item.estado === 'anulado') {
      alert('No se puede rectificar un estudio que ha sido anulado.')
      return
    }
    setEditingItem(item)
    setEditTipo(item.tipo || '')
    setEditOjo(item.ojo || 'AO')
    setEditObservaciones(item.observaciones || '')
  }

  const handleGuardarEdicion = async () => {
    if (!editingItem) return
    setEditandoGuardando(true)
    try {
      const res = await apiFetch(`/api/estudios-tecnicos/${editingItem.id}/editar`, {
        method: 'PATCH',
        body: JSON.stringify({
          tipo_estudio: editTipo.trim(),
          ojo: editOjo.trim(),
          observaciones: editObservaciones.trim(),
          usuario_id: user?.id,
          usuario_nombre: tecnicoNombre,
          is_admin: isAdmin
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          title: 'Estudio rectificado con éxito',
          detail: `Se actualizaron los metadatos de ${editingItem.nombre_paciente} (${editTipo} - ${editOjo}).`
        })
        setEditingItem(null)
        fetchHistorial()
      } else {
        alert(data.detail || data.error || 'No se pudo editar el estudio.')
      }
    } catch (e: any) {
      alert(`Error al guardar cambios: ${e.message}`)
    } finally {
      setEditandoGuardando(false)
    }
  }

  const handleOpenAnular = (item: EstudioHistorialItem) => {
    if (item.estado === 'anulado') {
      alert('Este estudio ya se encuentra en estado anulado.')
      return
    }
    setAnulatingItem(item)
    setAnularMotivo('')
    setAnularEliminarGeclisa(Boolean(item.geclisa_as_id))
    setAnularNotificarWa(false)
    setAnularMensajeWa('')
  }

  const handleConfirmarAnulacion = async () => {
    if (!anulatingItem) return
    if (!anularMotivo.trim() || anularMotivo.trim().length < 3) {
      alert('Debe especificar un motivo de anulación válido (mínimo 3 caracteres).')
      return
    }
    setAnulandoGuardando(true)
    try {
      const res = await apiFetch(`/api/estudios-tecnicos/${anulatingItem.id}/anular`, {
        method: 'POST',
        body: JSON.stringify({
          motivo: anularMotivo.trim(),
          eliminar_de_geclisa: anularEliminarGeclisa,
          notificar_whatsapp: anularNotificarWa,
          mensaje_whatsapp_personalizado: anularMensajeWa.trim() || undefined,
          usuario_id: user?.id,
          usuario_nombre: tecnicoNombre,
          is_admin: isAdmin
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'warning',
          title: 'Estudio Anulado',
          detail: `El estudio de ${anulatingItem.nombre_paciente} ha sido anulado.${data.geclisa_purgado ? ' Se eliminó de la Historia Clínica en Geclisa.' : ''}${data.whatsapp_notificado ? ' Se notificó al paciente por WhatsApp.' : ''}`
        })
        setAnulatingItem(null)
        fetchHistorial()
      } else {
        alert(data.detail || data.error || 'No se pudo anular el estudio.')
      }
    } catch (e: any) {
      alert(`Error al anular estudio: ${e.message}`)
    } finally {
      setAnulandoGuardando(false)
    }
  }

  const renderWhatsAppStatusBadge = (item: EstudioHistorialItem) => {
    const st = item.whatsapp_status
    if (st === 'read') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30">
          <CheckCheck size={14} className="text-sky-500" />
          Leído
        </span>
      )
    }
    if (st === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          <CheckCheck size={14} />
          Entregado
        </span>
      )
    }
    if (st === 'sent') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[var(--border)]">
          <Check size={14} />
          Enviado
        </span>
      )
    }
    if (st === 'failed') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30"
          title={item.whatsapp_error || 'Error de entrega'}
        >
          <AlertTriangle size={13} />
          Error
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-300">
        <Clock size={12} />
        {st}
      </span>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* CABECERA DEL MÓDULO */}
      <div className="p-5 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/20 shrink-0">
            <Eye size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--foreground)]">
                Consola de Estudios Oftalmológicos (Técnicos)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                Archivo Geclisa + WhatsApp Línea 2
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--secondary)] mt-1">
              Busca al paciente por DNI en Geclisa, adjunta el estudio (`PDF`, `JPG`, `PNG` o `Ctrl+V`) y envíalo al instante sin imprimir papel ni ensuciar el chat quirúrgico.
            </p>
          </div>
        </div>

        {/* Estado de Credenciales del Técnico y Línea 2 */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Badge Prestador Geclisa */}
          <div className={`px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2 ${
            tecnicoPreId
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          }`}>
            <Database size={15} />
            <div>
              <span className="block text-[10px] uppercase font-bold opacity-75">
                Firma Geclisa {profile?.nombre_completo ? `• ${profile.nombre_completo}` : ''}
              </span>
              <span className="font-bold">
                {tecnicoPreId ? `${tecnicoNombre} (PreId #${tecnicoPreId})` : 'Sin PreId asignado'}
              </span>
            </div>
          </div>

          {/* Badge Línea 2 WhatsApp */}
          <div className={`px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2 ${
            lineaEstudiosStatus?.connected
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          }`}>
            <Smartphone size={15} />
            <div>
              <span className="block text-[10px] uppercase font-bold opacity-75">Línea 2 Estudios</span>
              <span className="font-bold">
                {lineaEstudiosStatus?.connected
                  ? lineaEstudiosStatus.display_phone_number || 'Conectada'
                  : 'Configurar en Ajustes'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta si el técnico no tiene geclisa_pre_id vinculado */}
      {!tecnicoPreId && (
        <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle size={20} className="text-amber-500 shrink-0" />
            <div>
              <p className="font-bold">Tu usuario no tiene un Prestador de Geclisa (`geclisa_pre_id`) fijo en su perfil.</p>
              <p className="opacity-90">
                Selecciona temporalmente el prestador aquí a la derecha para subir a Geclisa, o vincúlalo de forma permanente en{' '}
                <Link href="/ajustes/usuarios" className="underline font-bold">Ajustes &gt; Usuarios</Link>.
              </p>
            </div>
          </div>
          {prestadoresGeclisa.length > 0 && (
            <select
              value={manualPreId}
              onChange={(e) => setManualPreId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-amber-500/40 text-[var(--foreground)]"
            >
              <option value="">Seleccionar Prestador Geclisa...</option>
              {prestadoresGeclisa.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nombre} (#{p.id})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* KPIs DEL DÍA */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">Estudios Hoy</span>
          <div className="text-2xl font-extrabold text-[var(--foreground)] mt-1">{metricas.total_hoy}</div>
          <span className="text-[11px] text-[var(--secondary)]">Procesados en el día</span>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Archivados en Geclisa</span>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{metricas.guardados_geclisa_hoy}</div>
          <span className="text-[11px] text-[var(--secondary)]">0 bytes en Supabase Storage</span>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Enviados / Leídos WA</span>
          <div className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-1">
            {metricas.entregados_o_leidos_hoy}{' '}
            <span className="text-xs font-semibold text-sky-500">({metricas.leidos_azul_hoy} leídos ✓✓)</span>
          </div>
          <span className="text-[11px] text-[var(--secondary)]">Vía Línea 2 exclusiva</span>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Con Incidencia WA</span>
          <div className="text-2xl font-extrabold text-rose-500 mt-1">{metricas.fallidos_hoy}</div>
          <span className="text-[11px] text-[var(--secondary)]">Reintentables en 1 clic</span>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Anulados Hoy</span>
          <div className="text-2xl font-extrabold text-slate-700 dark:text-slate-200 mt-1">{metricas.anulados_hoy}</div>
          <span className="text-[11px] text-[var(--secondary)]">Auditoría / Purga</span>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
            : feedback.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
        }`}>
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-sm">{feedback.title}</p>
              <p className="leading-relaxed">{feedback.detail}</p>
            </div>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* FLUJO DE 3 PASOS: BUSCAR PACIENTE -> CONFIGURAR ESTUDIO -> ADJUNTAR Y ENVIAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA (5 cols): PASO 1 - BUSCADOR DE PACIENTE EN GECLISA */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="font-bold text-base text-[var(--foreground)]">
                Buscar Paciente por DNI en Geclisa
              </h2>
            </div>

            <form onSubmit={handleBuscarPaciente} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--secondary)]" />
                <input
                  type="text"
                  placeholder="Ingresa el DNI y presiona Enter..."
                  value={dniInput}
                  onChange={(e) => setDniInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-mono bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={buscandoPaciente}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
              >
                {buscandoPaciente ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
                <span>{buscandoPaciente ? 'Buscando...' : 'Buscar'}</span>
              </button>
            </form>

            {errorBusqueda && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{errorBusqueda}</span>
              </div>
            )}

            {/* Tarjeta del Paciente Encontrado en Geclisa */}
            {paciente && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-cyan-500/30 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                      <User size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[var(--foreground)]">
                        {paciente.nombre_completo}
                      </h3>
                      <p className="text-xs text-[var(--secondary)] font-mono">
                        DNI: {paciente.dni} • Ficha Geclisa #{paciente.geclisa_ficha_id}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    ✓ Geclisa Activo
                  </span>
                </div>

                {paciente.obra_social && (
                  <div className="text-xs text-[var(--secondary)] bg-white dark:bg-slate-900/60 px-3 py-2 rounded-xl border border-[var(--border)]">
                    <span className="font-semibold text-[var(--foreground)]">Cobertura:</span> {paciente.obra_social}{' '}
                    {paciente.plan ? `(${paciente.plan})` : ''}
                  </div>
                )}

                {/* Campo editable de Celular para WhatsApp con Prefijo Fijo (+54 9) y Entrada Local */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                      <Phone size={13} className="text-cyan-500" />
                      Celular del Paciente (Editable si cambió)
                    </label>
                    <span className="text-[10px] text-[var(--secondary)] font-medium">
                      Área + Número (sin 0 ni 15)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Badge / Selector de Prefijo de País */}
                    <div className="relative shrink-0">
                      <select
                        value={codigoPais}
                        onChange={(e) => setCodigoPais(e.target.value)}
                        className="appearance-none bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-[var(--border)] text-xs font-bold px-3 py-2.5 pr-7 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500 text-[var(--foreground)] transition-colors shadow-sm"
                        title="Prefijo internacional para WhatsApp"
                      >
                        <option value="549">🇦🇷 +54 9 (Arg)</option>
                        <option value="569">🇨🇱 +56 9 (Chile)</option>
                        <option value="598">🇺🇾 +598 (Uruguay)</option>
                        <option value="55">🇧🇷 +55 (Brasil)</option>
                        <option value="">🌐 + (Otro)</option>
                      </select>
                      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--secondary)]" />
                    </div>

                    {/* Input de dígitos locales */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={telefonoLocal}
                        onChange={(e) => setTelefonoLocal(cleanLocalInputDigits(e.target.value, codigoPais))}
                        placeholder={codigoPais === '549' ? 'Ej: 261 470 3230 o 11 4123 4567' : 'Número móvil sin prefijo'}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono bg-white dark:bg-slate-900 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
                      />
                      {telefonoLocal && (
                        <button
                          type="button"
                          onClick={() => setTelefonoLocal('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1.5 py-0.5 rounded"
                          title="Limpiar número"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resumen dinámico y validación visual */}
                  {telefonoLocal ? (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      <span>
                        Destino WhatsApp verificado: <strong>{formatPhoneDisplay(telefonoDestino)}</strong>
                      </span>
                      {codigoPais === '549' && telefonoLocal.length < 10 && (
                        <span className="text-amber-500 text-[10px] font-normal ml-auto">
                          (Faltan {10 - telefonoLocal.length} dígitos para los 10 de Argentina)
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                      Ingresá solo el código de área y el número (sin 0 y sin 15). Ej: para Mendoza <span className="font-mono text-cyan-500">261 470-3230</span>, CABA/GBA <span className="font-mono text-cyan-500">11 4123-4567</span>.
                    </p>
                  )}
                </div>

                {/* Archivos ya existentes en la Historia Clínica de Geclisa (Reenvío en 1 clic) */}
                {archivosGeclisa.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setShowArchivosGeclisa(!showArchivosGeclisa)}
                      className="w-full flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <FolderOpen size={14} />
                        Archivos en Geclisa (Solapa Archivos Clínicos) ({archivosGeclisa.length})
                      </span>
                      <span>{showArchivosGeclisa ? 'Ocultar ▲' : 'Ver / Enviar ▼'}</span>
                    </button>

                    {showArchivosGeclisa && (
                      <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                        {archivosGeclisa.map((arc) => (
                          <div
                            key={arc.as_id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-[var(--foreground)] truncate" title={arc.titulo}>
                                {arc.titulo || `Archivo #${arc.as_id}`}
                              </p>
                              <p className="text-[10px] text-[var(--secondary)]">
                                {arc.fecha} • AS_ID #{arc.as_id}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={`${BACKEND_URL}/api/geclisa/archivos/${arc.as_id}/ver`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300"
                                title="Ver archivo desde Geclisa"
                              >
                                <ExternalLink size={13} />
                              </a>
                              <button
                                type="button"
                                disabled={enviandoExistenteId === arc.as_id}
                                onClick={() => handleEnviarArchivoExistenteGeclisa(arc)}
                                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                                title="Enviar este archivo ya guardado en Geclisa por WhatsApp sin volver a subirlo"
                              >
                                <Send size={11} />
                                <span>{enviandoExistenteId === arc.as_id ? '...' : 'Enviar WA'}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA (7 cols): PASO 2 Y 3 - TIPO DE ESTUDIO, DRAG & DROP Y ENVÍO DUAL */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleEnviarEstudio}
            className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-5"
          >
            {/* Paso 2: Selección rápida de Estudio y Ojo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h2 className="font-bold text-base text-[var(--foreground)]">
                    Tipo de Estudio Oftalmológico y Lateralidad
                  </h2>
                </div>
              </div>

              {/* Chips de 1 Clic */}
              <div className="flex flex-wrap gap-1.5">
                {ESTUDIOS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTipoEstudio(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      tipoEstudio === preset
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-[var(--border)] text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
                    Título del Estudio (se guardará en la ficha de Geclisa y en el mensaje)
                  </label>
                  <input
                    type="text"
                    value={tipoEstudio}
                    onChange={(e) => setTipoEstudio(e.target.value)}
                    placeholder="Ej: OCT Macular y Papilar"
                    className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
                    Ojo / Lateralidad
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['AO', 'OD', 'OI'] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setOjo(o)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          ojo === o
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-[var(--border)] text-[var(--foreground)]'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Paso 3: Zona Drag & Drop + Pegado Ctrl+V */}
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h2 className="font-bold text-base text-[var(--foreground)]">
                    Adjuntar Estudio (`PDF`, `JPG`, `PNG` o `Ctrl+V`)
                  </h2>
                </div>
                <span className="text-[11px] text-[var(--secondary)] flex items-center gap-1">
                  <ClipboardPaste size={13} className="text-cyan-600" />
                  Puedes pegar capturas directamente con <strong>Ctrl + V</strong>
                </span>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  handleFileChange(e.dataTransfer.files)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-[var(--border)] hover:border-cyan-500/60 bg-slate-50/70 dark:bg-slate-800/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files)}
                />
                <Upload size={28} className="mx-auto text-cyan-600 mb-2" />
                <p className="text-sm font-bold text-[var(--foreground)]">
                  Arrastra el estudio aquí o haz clic para seleccionarlo
                </p>
                <p className="text-xs text-[var(--secondary)] mt-1">
                  Soporta archivos <strong>PDF, JPG y PNG</strong> (hasta 20 MB). Si subes imágenes de ambos ojos (OD + OI), se pueden unificar en un solo PDF automáticamente.
                </p>
              </div>

              {/* Lista de archivos seleccionados */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? (
                          <FileText size={18} className="text-rose-500 shrink-0" />
                        ) : (
                          <ImageIcon size={18} className="text-cyan-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--foreground)] truncate">{file.name}</p>
                          <p className="text-[10px] text-[var(--secondary)]">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}

                  {/* Opción de consolidar imágenes en 1 PDF */}
                  {selectedFiles.every(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(f.name)) && (
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={unificarEnPdf}
                        onChange={(e) => setUnificarEnPdf(e.target.checked)}
                        className="h-4 w-4 accent-cyan-600 rounded"
                      />
                      <Layers size={14} className="text-cyan-600 shrink-0" />
                      <span className="font-semibold text-[var(--foreground)]">
                        Convertir y unificar imagen(es) en un documento PDF limpio (Recomendado para OD + OI)
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Observaciones opcionales */}
              <div>
                <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
                  Observaciones para la Historia Clínica de Geclisa (Opcional)
                </label>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Estudio solicitado por Dr. Gómez..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Opciones de destino */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={guardarEnGeclisa}
                      onChange={(e) => setGuardarEnGeclisa(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600 rounded"
                    />
                    <span>Guardar en Geclisa</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={enviarWhatsapp}
                      onChange={(e) => setEnviarWhatsapp(e.target.checked)}
                      className="h-4 w-4 accent-cyan-600 rounded"
                    />
                    <span>Enviar por WhatsApp (Línea 2)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-teal-600 dark:text-teal-400">
                    <input
                      type="checkbox"
                      checked={aplicarCaratula}
                      onChange={(e) => setAplicarCaratula(e.target.checked)}
                      className="h-4 w-4 accent-teal-600 rounded"
                    />
                    <span>Incluir membrete institucional Centrovisión</span>
                  </label>
                </div>

              {/* Selector y Vista Previa de Plantilla WhatsApp cuando enviarWhatsapp está activo */}
              {enviarWhatsapp && (
                <div className="p-3.5 rounded-2xl bg-cyan-500/5 border border-cyan-500/25 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-cyan-600 shrink-0" />
                      <label className="text-xs font-bold text-[var(--foreground)]">
                        Plantilla de WhatsApp Oficial (Meta Línea 2)
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMostrarPreviewPlantilla(!mostrarPreviewPlantilla)}
                      className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
                    >
                      <Eye size={13} />
                      <span>{mostrarPreviewPlantilla ? 'Ocultar vista previa' : 'Ver mensaje que recibirá el paciente'}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <select
                      value={plantillaSeleccionada}
                      onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-cyan-500/30 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="auto">
                        ✦ Automática (según archivo: PDF ➔ {defaultTemplates.default_pdf} | Imagen ➔ {defaultTemplates.default_img})
                      </option>
                      {estudiosTemplates.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.titulo_amigable || t.name} [{t.header_type}] {t.name === defaultTemplates.default_pdf ? '★ Predeterminada PDF' : t.name === defaultTemplates.default_img ? '★ Predeterminada Imagen' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[var(--secondary)]">
                      {plantillaSeleccionada === 'auto'
                        ? `El CRM elegirá automáticamente la plantilla predeterminada (${activeTemplateName}) según si envías PDF o Imagen.`
                        : `Plantilla personalizada seleccionada por el técnico: "${activeTemplateName}" [${activeTemplate.header_type}].`}
                    </p>
                  </div>

                  {/* Vista previa WhatsApp en tiempo real */}
                  {mostrarPreviewPlantilla && (
                    <div className="p-3 rounded-xl bg-slate-900 text-slate-100 border border-slate-700/60 text-xs space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                        <span className="flex items-center gap-1.5 font-semibold text-cyan-400">
                          <Smartphone size={13} />
                          Destino: {telefonoDestino ? formatPhoneDisplay(telefonoDestino) : '(Ingresa el celular en Paso 1)'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {activeTemplateName} ({activeTemplate.header_type})
                        </span>
                      </div>

                      <div className="max-w-md mx-auto bg-[#0b141a] p-3 rounded-2xl border border-emerald-950/40 shadow-inner space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#202c33] text-emerald-400 text-[11px] font-medium">
                          {activeTemplate.header_type === 'IMAGE' ? (
                            <ImageIcon size={15} />
                          ) : (
                            <FileText size={15} />
                          )}
                          <span>
                            {activeTemplate.header_type === 'IMAGE'
                              ? '📷 [Imagen del estudio oftalmológico adjunta]'
                              : '📄 [Documento PDF del estudio oftalmológico adjunto]'}
                          </span>
                        </div>

                        <p className="text-[12px] text-slate-100 whitespace-pre-wrap leading-relaxed font-sans">
                          {previewBodyText}
                        </p>

                        <div className="text-[10px] text-slate-400 text-right">
                          <span>Hoy 10:30 • Línea 2 Oficial Centrovisión</span>
                        </div>

                        {activeTemplate.buttons && activeTemplate.buttons.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-700/40 flex flex-col gap-1">
                            {activeTemplate.buttons.map((btn, i) => (
                              <div
                                key={i}
                                className="py-1 px-3 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-center text-[11px] text-cyan-400 font-semibold"
                              >
                                {btn.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}


                <button
                  type="submit"
                  disabled={enviandoEstudio || !paciente || selectedFiles.length === 0}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  {enviandoEstudio ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Procesando en paralelo (Geclisa + Meta)...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Archivar en Geclisa y Enviar por WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA DE ENVÍOS EN TIEMPO REAL */}
      <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base text-[var(--foreground)] flex items-center gap-2">
              <ShieldCheck size={18} className="text-cyan-600" />
              Historial y Trazabilidad de Estudios Enviados
            </h2>
            <p className="text-xs text-[var(--secondary)]">
              Actualización en tiempo real de lectura de WhatsApp (`✓` Enviado, `✓✓` Entregado, `✓✓` Leído Azul) y enlace directo al archivo en Geclisa.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Filtrar por DNI..."
              value={filtroDniHistorial}
              onChange={(e) => setFiltroDniHistorial(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-[var(--border)]"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] font-medium"
            >
              <option value="todos">Todos los estados</option>
              <option value="activos">Vigentes (Activos / Editados)</option>
              <option value="anulados">Anulados (Baja)</option>
            </select>
            <select
              value={filtroStatusWa}
              onChange={(e) => setFiltroStatusWa(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)]"
            >
              <option value="ALL">Todos los estados WA</option>
              <option value="read">Leídos (✓✓ Azul)</option>
              <option value="delivered">Entregados (✓✓)</option>
              <option value="sent">Enviados (✓)</option>
              <option value="failed">Fallidos (⚠️)</option>
            </select>
            <button
              type="button"
              onClick={fetchHistorial}
              className="p-2 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Actualizar tabla"
            >
              <RefreshCw size={14} className={cargandoHistorial ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--secondary)]">
                <th className="py-3 px-3">Fecha / Hora</th>
                <th className="py-3 px-3">Paciente / DNI</th>
                <th className="py-3 px-3">Estudio / Ojo</th>
                <th className="py-3 px-3">Archivo Geclisa</th>
                <th className="py-3 px-3">WhatsApp (Línea 2)</th>
                <th className="py-3 px-3">Técnico</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {historial.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--secondary)]">
                    {cargandoHistorial ? 'Cargando historial de estudios...' : 'Aún no hay estudios registrados con los filtros actuales.'}
                  </td>
                </tr>
              ) : (
                historial.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.estado === 'anulado'
                        ? 'opacity-65 bg-rose-500/[0.04] hover:opacity-95'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-[var(--secondary)]">
                      {new Date(item.created_at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <p className={`font-bold ${item.estado === 'anulado' ? 'text-slate-500 line-through' : 'text-[var(--foreground)]'}`}>
                        {item.nombre_paciente || 'Paciente'}
                      </p>
                      <p className="text-[11px] font-mono text-[var(--secondary)]">
                        DNI {item.dni_paciente || '-'} • {formatPhoneDisplay(item.telefono_destino || '')}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-bold ${item.estado === 'anulado' ? 'text-slate-500' : 'text-[var(--foreground)]'}`}>
                          {item.tipo}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold text-[10px]">
                          {item.ojo || 'AO'}
                        </span>
                        {item.estado === 'anulado' && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[10px] inline-flex items-center gap-0.5"
                            title={`Anulado por ${item.anulado_por_nombre || 'Técnico'}: ${item.motivo_anulacion || ''}`}
                          >
                            <Ban size={10} />
                            Anulado
                          </span>
                        )}
                        {item.estado === 'editado' && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[10px] inline-flex items-center gap-0.5"
                            title={`Rectificado por ${item.editado_por_nombre || 'Técnico'}`}
                          >
                            <Sparkles size={10} />
                            Editado
                          </span>
                        )}
                      </div>
                      {item.nombre_archivo && (
                        <p className="text-[10px] text-[var(--secondary)] truncate max-w-[200px]">
                          {item.nombre_archivo}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.estado === 'anulado' && item.eliminado_geclisa ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-medium"
                          title="El archivo fue purgado de la Historia Clínica en Geclisa para evitar errores diagnósticos"
                        >
                          <Trash2 size={12} />
                          <span>Purgado Geclisa</span>
                        </span>
                      ) : item.geclisa_as_id ? (
                        <a
                          href={`${BACKEND_URL}/api/geclisa/archivos/${item.geclisa_as_id}/ver`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] hover:underline"
                        >
                          <CheckCircle2 size={13} />
                          <span>AS #{item.geclisa_as_id}</span>
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-[11px] text-[var(--secondary)]">Ficha #{item.geclisa_ficha_id}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderWhatsAppStatusBadge(item)}
                      {item.whatsapp_error && (
                        <p className="text-[10px] text-rose-500 max-w-[220px] truncate mt-0.5" title={item.whatsapp_error}>
                          {item.whatsapp_error}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-[11px] text-[var(--secondary)]">
                      {item.tecnico_nombre || '-'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.estado !== 'anulado' && item.geclisa_as_id && (
                          <button
                            type="button"
                            disabled={reintentandoId === item.id}
                            onClick={() => handleReintentarWhatsapp(item)}
                            className="px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold inline-flex items-center gap-1"
                            title="Reenviar por WhatsApp recuperando el archivo directamente desde Geclisa sin duplicarlo"
                          >
                            <RotateCcw size={12} className={reintentandoId === item.id ? 'animate-spin text-cyan-600' : ''} />
                            <span>{item.whatsapp_status === 'failed' ? 'Reintentar WA' : 'Reenviar WA'}</span>
                          </button>
                        )}

                        {item.estado !== 'anulado' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--foreground)] hover:text-cyan-600 transition-colors"
                              title="Rectificar tipo de estudio, ojo u observaciones"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAnular(item)}
                              className="p-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Anular estudio y opcionalmente purgar de Geclisa"
                            >
                              <Ban size={13} />
                            </button>
                          </>
                        )}

                        {(item.estado === 'anulado' || (item.historial_cambios && item.historial_cambios.length > 0)) && (
                          <button
                            type="button"
                            onClick={() => setDetalleItem(item)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-cyan-500 transition-colors"
                            title="Ver auditoría y detalles de rectificación / anulación"
                          >
                            <Info size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: RECTIFICACIÓN / EDICIÓN DE METADATOS */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--foreground)]">Rectificar Metadatos de Estudio</h3>
                  <p className="text-xs text-[var(--secondary)]">{editingItem.nombre_paciente} • DNI {editingItem.dni_paciente}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Tipo de Estudio</label>
                <input
                  type="text"
                  list="presets-estudios"
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] text-[var(--foreground)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Lateralidad / Ojo</label>
                <div className="grid grid-cols-3 gap-2">
                  {['OD', 'OI', 'AO'].map((oj) => (
                    <button
                      key={oj}
                      type="button"
                      onClick={() => setEditOjo(oj)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        editOjo === oj
                          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-300'
                          : 'border-[var(--border)] text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {oj === 'OD' ? 'Ojo Derecho (OD)' : oj === 'OI' ? 'Ojo Izquierdo (OI)' : 'Ambos Ojos (AO)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Observaciones / Notas Clínicas</label>
                <textarea
                  rows={3}
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  placeholder="Indicaciones o aclaraciones complementarias..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={editandoGuardando || !editTipo.trim()}
                onClick={handleGuardarEdicion}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {editandoGuardando ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Guardar Rectificación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ANULACIÓN CON PURGA SEGURA EN GECLISA */}
      {anulatingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-[var(--card)] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--foreground)]">Anular Envío de Estudio Oftalmológico</h3>
                  <p className="text-xs text-[var(--secondary)]">{anulatingItem.nombre_paciente} • DNI {anulatingItem.dni_paciente}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnulatingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-200">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                Atención: El estudio quedará registrado como ANULADO en el historial.
              </p>
              <p className="mt-1 opacity-90">
                No se borrará físicamente del CRM para preservar la trazabilidad forense de la clínica.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                  Motivo de Anulación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={anularMotivo}
                  onChange={(e) => setAnularMotivo(e.target.value)}
                  placeholder="Ej: Archivo adjunto incorrecto, paciente equivocado, estudio no correspondía a esta fecha..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] text-[var(--foreground)]"
                />
              </div>

              {anulatingItem.geclisa_as_id && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={anularEliminarGeclisa}
                    onChange={(e) => setAnularEliminarGeclisa(e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-[var(--foreground)]">
                      Purgar archivo adjunto de Geclisa (AS #{anulatingItem.geclisa_as_id})
                    </span>
                    <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                      Recomendado: Elimina el archivo de la Historia Clínica del paciente en Geclisa para evitar errores diagnósticos durante la consulta médica.
                    </p>
                  </div>
                </label>
              )}

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={anularNotificarWa}
                    onChange={(e) => setAnularNotificarWa(e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-[var(--foreground)]">
                      Enviar mensaje formal de revocación por WhatsApp al paciente
                    </span>
                    <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                      Informa al paciente al número {formatPhoneDisplay(anulatingItem.telefono_destino)} que desestime el documento previo debido a un error administrativo.
                    </p>
                  </div>
                </label>

                {anularNotificarWa && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--secondary)] mb-1">
                      Mensaje personalizado (opcional, dejar en blanco para plantilla estándar):
                    </label>
                    <textarea
                      rows={2}
                      value={anularMensajeWa}
                      onChange={(e) => setAnularMensajeWa(e.target.value)}
                      placeholder="Estimado/a paciente, le informamos que el archivo previo ha sido revocado..."
                      className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-[var(--border)] text-[var(--foreground)]"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setAnulatingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={anulandoGuardando || anularMotivo.trim().length < 3}
                onClick={handleConfirmarAnulacion}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-sm shadow-rose-500/20 disabled:opacity-50"
              >
                {anulandoGuardando ? <RefreshCw size={14} className="animate-spin" /> : <Ban size={14} />}
                <span>Confirmar Anulación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: AUDITORÍA FORENSE Y DETALLES */}
      {detalleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600">
                  <Info size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--foreground)]">Trazabilidad y Auditoría Forense</h3>
                  <p className="text-xs text-[var(--secondary)]">{detalleItem.nombre_paciente} • DNI {detalleItem.dni_paciente}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetalleItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border)] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[var(--secondary)]">Estado actual:</span>
                  <span className={`font-bold uppercase ${detalleItem.estado === 'anulado' ? 'text-rose-500' : detalleItem.estado === 'editado' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {detalleItem.estado || 'activo'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--secondary)]">Técnico original:</span>
                  <span className="font-medium text-[var(--foreground)]">{detalleItem.tecnico_nombre || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--secondary)]">Creado el:</span>
                  <span className="font-mono text-[var(--foreground)]">{new Date(detalleItem.created_at).toLocaleString('es-AR')}</span>
                </div>
              </div>

              {detalleItem.estado === 'anulado' && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                  <span className="font-bold text-rose-600 dark:text-rose-400 block">Detalles de Anulación</span>
                  <p className="text-[var(--foreground)]"><strong>Motivo:</strong> {detalleItem.motivo_anulacion || '-'}</p>
                  <p className="text-[var(--secondary)]"><strong>Anulado por:</strong> {detalleItem.anulado_por_nombre || 'Técnico'}</p>
                  {detalleItem.anulado_at && (
                    <p className="text-[var(--secondary)] font-mono"><strong>Fecha anulación:</strong> {new Date(detalleItem.anulado_at).toLocaleString('es-AR')}</p>
                  )}
                  <p className="text-[var(--secondary)]"><strong>Archivo en Geclisa:</strong> {detalleItem.eliminado_geclisa ? 'Purgado con éxito' : 'Conservado o sin AS_ID'}</p>
                </div>
              )}

              {detalleItem.historial_cambios && detalleItem.historial_cambios.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-[var(--foreground)] block">Historial de Rectificaciones ({detalleItem.historial_cambios.length})</span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {detalleItem.historial_cambios.map((c, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-[var(--border)] text-[11px]">
                        <div className="flex justify-between font-bold text-cyan-600 dark:text-cyan-400">
                          <span>Campo: {c.campo.toUpperCase()}</span>
                          <span className="font-mono text-[10px] text-[var(--secondary)]">{new Date(c.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="mt-1 text-[var(--secondary)]">
                          <span className="line-through">{c.anterior || '(vacío)'}</span> → <span className="font-bold text-[var(--foreground)]">{c.nuevo}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">Por {c.usuario}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDetalleItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
