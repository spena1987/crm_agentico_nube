'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  Info,
  ClipboardList,
  Stethoscope,
  LayoutGrid,
  ArrowLeft,
  ArrowRight,
  ArrowDownAZ,
  ArrowUpZA,
  ArrowUpDown
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDateArg } from '@/lib/dateUtils'
import { apiFetch, BACKEND_URL } from '@/lib/api'
import { optimizeStudyFilesForUpload } from '@/lib/imageOptimizer'
import {
  StudyFileItem,
  isAllowedStudyFile,
  isPdfStudyFile,
  sortFilesNatural,
  sortStudyItemsNatural,
  generateThumbnailsInQueue
} from '@/lib/studyThumbnails'
import { supabase } from '@/lib/supabase'
import {
  formatPhoneDisplay,
  normalizePhoneNumber,
  extractLocalArgentineNumber,
  cleanLocalInputDigits,
  assembleInternationalPhone
} from '@/lib/phoneUtils'
import {
  EstudioPresetItem,
  DEFAULT_ESTUDIOS_PRESETS,
  getGeclisaTitleInfo
} from '@/lib/estudiosDefaults'

// Flag para reactivar el Worklist de órdenes médicas cuando se habilite el flujo de consultorio
const ENABLE_WORKLIST_ORDENES = false

interface PacienteGeclisaInfo {
  dni: string
  tipo_documento?: string
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

interface CandidatoGeclisaItem {
  ficha_id: number
  nombre_completo: string
  tipo_documento: string
  dni: string
  fecha_nacimiento?: string | null
  celular?: string
}

interface ArchivoGeclisaItem {
  as_id: number
  ficha_id: number
  fecha: string
  hora: string
  titulo: string
  observaciones: string
  profesional_nombre: string
  prestador?: string
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
  const [candidatosGeclisa, setCandidatosGeclisa] = useState<CandidatoGeclisaItem[]>([])
  const [archivosGeclisa, setArchivosGeclisa] = useState<ArchivoGeclisaItem[]>([])
  const [showArchivosGeclisa, setShowArchivosGeclisa] = useState(false)

  // Paso 2: Datos del Estudio y Teléfono (Estrategia 1: Prefijo Fijo + Celular Local)
  const [codigoPais, setCodigoPais] = useState('549')
  const [telefonoLocal, setTelefonoLocal] = useState('')
  const telefonoDestino = assembleInternationalPhone(telefonoLocal, codigoPais)
  const [estudiosPresets, setEstudiosPresets] = useState<EstudioPresetItem[]>(DEFAULT_ESTUDIOS_PRESETS)
  const formTouchedRef = useRef(false)
  const [tipoEstudio, setTipoEstudio] = useState('OCT Macular y Papilar')
  const [ojo, setOjo] = useState<'AO' | 'OD' | 'OI'>('AO')
  const [observaciones, setObservaciones] = useState('')

  // Paso 3: Archivos (Drag & Drop + Ctrl+V)
  const [studyItems, setStudyItems] = useState<StudyFileItem[]>([])
  const selectedFiles = useMemo(() => studyItems.map((i) => i.file), [studyItems])
  const thumbUrlsRef = useRef<Set<string>>(new Set())
  const isMountedRef = useRef(true)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [unificarEnPdf, setUnificarEnPdf] = useState(true)
  const [grilla2x2, setGrilla2x2] = useState(false)
  const [progresoOptimizacion, setProgresoOptimizacion] = useState<string | null>(null)
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
  // Worklist de Pedidos Médicos (Fase 3 HCE CRM)
  const [worklistPedidos, setWorklistPedidos] = useState<any[]>([])
  const [cargandoWorklist, setCargandoWorklist] = useState<boolean>(false)
  const [mostrarWorklist, setMostrarWorklist] = useState<boolean>(true)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<any | null>(null)

  const cargarWorklist = useCallback(async () => {
    setCargandoWorklist(true)
    try {
      const res = await apiFetch('/api/oftalmo/worklist-estudios?estado=PENDIENTE')
      const data = await res.json()
      if (res.ok && data?.pedidos) {
        setWorklistPedidos(data.pedidos)
      }
    } catch (err) {
      console.warn('Aviso cargando worklist de estudios:', err)
    } finally {
      setCargandoWorklist(false)
    }
  }, [])

  useEffect(() => {
    if (ENABLE_WORKLIST_ORDENES) {
      cargarWorklist()
    }
  }, [cargarWorklist])

  const handleSeleccionarPedidoWorklist = (pedido: any) => {
    setPedidoSeleccionado(pedido)
    const dniPac = pedido.pacientes?.dni || ''
    if (dniPac) {
      setDniInput(dniPac)
      const cleanDni = dniPac.replace(/\D/g, '').replace(/^0+/, '') || dniPac.replace(/\D/g, '')
      if (cleanDni.length >= 6) {
        void ejecutarBusquedaPaciente(cleanDni)
      }
    }
    const listaEstudios: string[] = Array.isArray(pedido.estudios)
      ? pedido.estudios
      : Array.isArray(pedido.items)
      ? pedido.items
      : []

    if (
      listaEstudios.length > 0 &&
      (!pedido.titulo || pedido.titulo === 'Solicitud de Estudios Complementarios' || pedido.titulo === 'Pedido de estudios')
    ) {
      setTipoEstudio(listaEstudios.join(' + '))
    } else if (pedido.titulo) {
      setTipoEstudio(pedido.titulo)
    } else if (listaEstudios.length > 0) {
      setTipoEstudio(listaEstudios[0])
    }
    if (pedido.ojo) {
      setOjo(pedido.ojo)
    }
    if (pedido.observaciones) {
      setObservaciones(pedido.observaciones)
    }
  }

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

    // Cargar etiquetas y parámetros operativos configurados desde Ajustes
    apiFetch('/api/estudios-tecnicos/config')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        const activos: EstudioPresetItem[] = Array.isArray(d.presets)
          ? d.presets.filter((p: EstudioPresetItem) => p.activo)
          : DEFAULT_ESTUDIOS_PRESETS
        setEstudiosPresets(activos)

        if (!formTouchedRef.current) {
          setTipoEstudio(activos.length > 0 ? activos[0].nombre : '')
          if (d.operacion) {
            if (d.operacion.ojo_default) setOjo(d.operacion.ojo_default)
            if (typeof d.operacion.unificar_en_pdf_default === 'boolean') {
              setUnificarEnPdf(d.operacion.unificar_en_pdf_default)
            }
            if (typeof d.operacion.aplicar_caratula_default === 'boolean') {
              setAplicarCaratula(d.caratula_activa === false ? false : d.operacion.aplicar_caratula_default)
            }
          }
        }
      })
      .catch(() => {})

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

    // Si el usuario no tiene geclisa_pre_id en su perfil, cargar lista de prestadores activos del catálogo
    if (!profile?.geclisa_pre_id) {
      apiFetch('/api/prestadores?solo_activos=true&roles=Cirujano,Otro')
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d?.prestadores) {
            setPrestadoresGeclisa(
              d.prestadores
                .filter((p: any) => p.geclisa_pre_id != null)
                .map((p: any) => ({
                  id: p.geclisa_pre_id,
                  nombre: p.nombre_apellido || `Prestador #${p.geclisa_pre_id}`
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

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      thumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      thumbUrlsRef.current.clear()
    }
  }, [])

  const clearStudyItems = useCallback(() => {
    thumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    thumbUrlsRef.current.clear()
    setStudyItems([])
  }, [])

  const appendStudyFiles = useCallback((rawFiles: File[], sortBatch: boolean) => {
    const valid = rawFiles.filter(isAllowedStudyFile)
    if (valid.length === 0) {
      setFeedback({
        type: 'error',
        title: 'Formato no válido',
        detail: 'Solo se permiten archivos PDF, JPG o PNG.'
      })
      return
    }

    const batchHasPdf = valid.some(isPdfStudyFile)
    const batchHasImg = valid.some((f) => !isPdfStudyFile(f))
    if (batchHasPdf && batchHasImg) {
      setFeedback({
        type: 'error',
        title: 'No se pueden mezclar PDF e imágenes',
        detail: 'Envía archivos PDF por separado de las imágenes JPG/PNG para evitar descartes al compilar.'
      })
      return
    }

    const existingHasPdf = studyItems.some((i) => i.isPdf)
    const existingHasImg = studyItems.some((i) => !i.isPdf)
    if ((existingHasPdf && batchHasImg) || (existingHasImg && batchHasPdf)) {
      setFeedback({
        type: 'error',
        title: 'No se pueden mezclar PDF e imágenes',
        detail: 'Ya hay archivos de otro tipo cargados. Limpia la lista o envíalos por separado.'
      })
      return
    }

    const orderedBatch = sortBatch && valid.length > 1 ? sortFilesNatural(valid, 'asc') : valid
    const newItems: StudyFileItem[] = orderedBatch.map((file) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      isPdf: isPdfStudyFile(file),
      thumbUrl: null
    }))

    setStudyItems((prev) => [...prev, ...newItems])

    void generateThumbnailsInQueue(
      newItems,
      (id, url) => {
        if (!isMountedRef.current) {
          URL.revokeObjectURL(url)
          return
        }
        thumbUrlsRef.current.add(url)
        setStudyItems((prev) => {
          const exists = prev.some((item) => item.id === id)
          if (!exists) {
            URL.revokeObjectURL(url)
            thumbUrlsRef.current.delete(url)
            return prev
          }
          return prev.map((item) => (item.id === id ? { ...item, thumbUrl: url } : item))
        })
      },
      () => !isMountedRef.current
    )
  }, [studyItems])

  const anyModalOpen = Boolean(
    showArchivosGeclisa ||
      mostrarPreviewPlantilla ||
      lightboxItemId ||
      (candidatosGeclisa.length > 1 && !paciente) ||
      editingItem ||
      anulatingItem ||
      detalleItem
  )

  const lightboxIndex = useMemo(
    () => (lightboxItemId ? studyItems.findIndex((i) => i.id === lightboxItemId) : -1),
    [lightboxItemId, studyItems]
  )
  const lightboxItem = lightboxIndex >= 0 ? studyItems[lightboxIndex] : null

  useEffect(() => {
    if (!lightboxItem || lightboxItem.isPdf) {
      setLightboxUrl(null)
      return
    }
    const url = URL.createObjectURL(lightboxItem.file)
    setLightboxUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [lightboxItem])

  // Cerrar modales con Escape y navegar en lightbox con flechas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxItemId) {
        if (e.key === 'Escape') {
          setLightboxItemId(null)
          return
        }
        if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
          e.preventDefault()
          for (let i = lightboxIndex - 1; i >= 0; i--) {
            if (!studyItems[i].isPdf) {
              setLightboxItemId(studyItems[i].id)
              break
            }
          }
          return
        }
        if (e.key === 'ArrowRight' && lightboxIndex >= 0 && lightboxIndex < studyItems.length - 1) {
          e.preventDefault()
          for (let i = lightboxIndex + 1; i < studyItems.length; i++) {
            if (!studyItems[i].isPdf) {
              setLightboxItemId(studyItems[i].id)
              break
            }
          }
          return
        }
      }
      if (e.key !== 'Escape') return
      if (showArchivosGeclisa) setShowArchivosGeclisa(false)
      if (mostrarPreviewPlantilla) setMostrarPreviewPlantilla(false)
      if (candidatosGeclisa.length > 1 && !paciente) setCandidatosGeclisa([])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showArchivosGeclisa, mostrarPreviewPlantilla, candidatosGeclisa.length, paciente, lightboxItemId, lightboxIndex, studyItems])

  // Soporte global para pegar capturas con Ctrl + V (pausado si hay un modal abierto)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (anyModalOpen) return
      if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) return
      const pastedFiles = Array.from(e.clipboardData.files).filter(isAllowedStudyFile)
      if (pastedFiles.length > 0) {
        e.preventDefault()
        appendStudyFiles(pastedFiles, pastedFiles.length > 1)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [appendStudyFiles, anyModalOpen])

  const ejecutarBusquedaPaciente = async (cleanDni: string, fichaIdSeleccionada?: number) => {
    setBuscandoPaciente(true)
    setErrorBusqueda(null)
    setFeedback(null)

    try {
      const qs = fichaIdSeleccionada
        ? `dni=${cleanDni}&ficha_id=${fichaIdSeleccionada}`
        : `dni=${cleanDni}`
      const res = await apiFetch(`/api/estudios-tecnicos/buscar-paciente?${qs}`)
      const data = await res.json()
      if (!res.ok) {
        setPaciente(null)
        setCandidatosGeclisa([])
        setArchivosGeclisa([])
        setErrorBusqueda(data.detail || `No se encontró ningún paciente con DNI ${cleanDni} en Geclisa.`)
        return
      }

      if (data.multiple && Array.isArray(data.candidatos) && data.candidatos.length > 1) {
        setPaciente(null)
        setArchivosGeclisa([])
        setCandidatosGeclisa(data.candidatos)
        return
      }

      setCandidatosGeclisa([])
      const rawPaciente = data.paciente || {}
      const fichaId = rawPaciente.geclisa_ficha_id ?? rawPaciente.ficha_id ?? data.ficha_id ?? null
      const pacId = rawPaciente.geclisa_pac_id ?? rawPaciente.pac_id ?? data.pac_id ?? fichaId
      const telNorm = rawPaciente.telefono_normalizado || normalizePhoneNumber(rawPaciente.telefono_geclisa || '')

      const normalizedPaciente: PacienteGeclisaInfo = {
        dni: rawPaciente.dni || cleanDni,
        tipo_documento: rawPaciente.tipo_documento || 'D.N.I.',
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

  const handleBuscarPaciente = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanDni = dniInput.replace(/\D/g, '').replace(/^0+/, '') || dniInput.replace(/\D/g, '')
    if (cleanDni.length < 6) {
      setErrorBusqueda('Ingresa un número de DNI válido (al menos 6 dígitos).')
      return
    }
    await ejecutarBusquedaPaciente(cleanDni)
  }

  const handleSeleccionarCandidato = async (candidato: CandidatoGeclisaItem) => {
    const cleanDni = (candidato.dni || dniInput).replace(/\D/g, '').replace(/^0+/, '') || candidato.dni
    await ejecutarBusquedaPaciente(cleanDni, candidato.ficha_id)
  }

  const handleFileChange = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return
    appendStudyFiles(Array.from(filesList), true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeStudyItem = (id: string) => {
    setStudyItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target?.thumbUrl) {
        URL.revokeObjectURL(target.thumbUrl)
        thumbUrlsRef.current.delete(target.thumbUrl)
      }
      return prev.filter((i) => i.id !== id)
    })
  }

  const moveStudyItem = (fromIndex: number, toIndex: number) => {
    setStudyItems((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev
      }
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const moveStudyItemById = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return
    setStudyItems((prev) => {
      const fromIndex = prev.findIndex((i) => i.id === sourceId)
      const toIndex = prev.findIndex((i) => i.id === targetId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const sortAllStudyItems = (direction: 'asc' | 'desc') => {
    setStudyItems((prev) => sortStudyItemsNatural(prev, direction))
  }

  const reverseStudyItems = () => {
    setStudyItems((prev) => [...prev].reverse())
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
    setProgresoOptimizacion(null)
    setFeedback(null)

    try {
      const usarGrilla = grilla2x2 && selectedFiles.length > 1 && selectedFiles.every(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(f.name))
      const optRes = await optimizeStudyFilesForUpload(selectedFiles, {
        unificarEnPdf: unificarEnPdf || usarGrilla,
        grilla2x2: usarGrilla,
        onProgress: (done, total, phase) => {
          setProgresoOptimizacion(`${phase} (${done}/${total})...`)
        }
      })
      setProgresoOptimizacion(null)

      if (optRes.exceedsLimit) {
        setFeedback({
          type: 'error',
          title: 'El lote supera el límite de Geclisa (20 MB)',
          detail: `Incluso tras la optimización (${(optRes.optimizedBytes / (1024 * 1024)).toFixed(1)} MB), el estudio supera el techo seguro de 18,5 MB. ${!usarGrilla && selectedFiles.length > 1 ? 'Activa la opción "Agrupar 4 tomas por página (Grilla 2×2)" o divide' : 'Divide'} el estudio en dos envíos.`
        })
        return
      }

      const formData = new FormData()
      optRes.files.forEach(f => formData.append('files', f))
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
      formData.append('unificar_en_pdf', String(unificarEnPdf || usarGrilla))
      formData.append('grilla_2x2', String(usarGrilla))
      formData.append('aplicar_caratula', String(aplicarCaratula))
      formData.append('guardar_en_geclisa', String(guardarEnGeclisa))
      formData.append('enviar_whatsapp', String(enviarWhatsapp))
      if (enviarWhatsapp && plantillaSeleccionada && plantillaSeleccionada !== 'auto') {
        formData.append('plantilla_whatsapp', plantillaSeleccionada)
      }
      if (user?.id) formData.append('usuario_id', user.id)
      formData.append('usuario_nombre', tecnicoNombre)
      if (tecnicoPreId) formData.append('tecnico_pre_id', String(tecnicoPreId))

      const clientRequestId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      formData.append('client_request_id', clientRequestId)

      const res = await apiFetch('/api/estudios-tecnicos/enviar', {
        method: 'POST',
        body: formData,
        timeoutMs: 120000,
        retryOnNetworkError: false,
        headers: {
          'X-Idempotency-Key': clientRequestId
        }
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
        clearStudyItems()
        setObservaciones('')
      } else if (onlyGeclisa && data.geclisa_ok) {
        setFeedback({
          type: 'success',
          title: '¡Estudio guardado exitosamente en Geclisa!',
          detail: `El archivo quedó archivado en la Historia Clínica (Ficha #${paciente.geclisa_ficha_id}, Solapa Archivos Clínicos, AS_ID #${data.geclisa_as_id || 'OK'}).`
        })
        clearStudyItems()
        setObservaciones('')
      } else if (onlyWa && data.whatsapp_ok) {
        setFeedback({
          type: 'success',
          title: '¡Estudio enviado por WhatsApp!',
          detail: `Despachado con éxito a ${formatPhoneDisplay(telefonoDestino)}.`
        })
        clearStudyItems()
        setObservaciones('')
      } else if (data.geclisa_ok && !data.whatsapp_ok) {
        setFeedback({
          type: 'warning',
          title: 'Guardado en Geclisa OK, pero falló el envío por WhatsApp',
          detail: `El archivo ya quedó seguro en Geclisa (AS_ID #${data.geclisa_as_id}). Motivo WhatsApp: ${data.whatsapp_error}. Puedes reintentar desde la tabla inferior sin duplicar el archivo.`
        })
        clearStudyItems()
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

      // Si proviene de un pedido médico del worklist, completarlo automáticamente
      const estudioCreadoId = data.estudio_id || data.id || data.estudio?.id
      if (ENABLE_WORKLIST_ORDENES && pedidoSeleccionado?.id && estudioCreadoId) {
        try {
          await apiFetch(`/api/oftalmo/worklist-estudios/${pedidoSeleccionado.id}/completar`, {
            method: 'POST',
            body: JSON.stringify({
              estudio_id: estudioCreadoId,
              notificar_whatsapp: false
            })
          })
          setPedidoSeleccionado(null)
          cargarWorklist()
        } catch (exCompl) {
          console.warn('Aviso completando pedido worklist:', exCompl)
        }
      }

      // Refrescar archivos de Geclisa del paciente e historial sin perder la ficha seleccionada
      if (paciente.dni) {
        void ejecutarBusquedaPaciente(paciente.dni, paciente.geclisa_ficha_id ?? undefined)
      }
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
        timeoutMs: 60000,
        retryOnNetworkError: false,
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
    <div className="px-3 sm:px-5 py-2.5 max-w-7xl mx-auto space-y-2.5">
      {/* TOAST FLOTANTE DE FEEDBACK (Sin empujar el layout HD) */}
      {feedback && (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-md p-3.5 rounded-2xl border shadow-xl backdrop-blur-md flex items-start justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
              : feedback.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/50 text-amber-100'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-0.5">
              <p className="font-bold">{feedback.title}</p>
              <p className="opacity-90 leading-snug">{feedback.detail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 opacity-70 hover:opacity-100 shrink-0"
            title="Cerrar aviso"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* FRANJA SUPERIOR COMPACTA: TÍTULO + CREDENCIALES + 5 KPIs */}
      <div className="px-3.5 py-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-sm shrink-0">
            <Eye size={18} />
          </div>
          <h1 className="text-sm sm:text-base font-bold text-[var(--foreground)]">
            Estudios Oftalmológicos
          </h1>

          {/* Badge Firma Geclisa (con selector rápido inline si falta PreId) */}
          <div
            className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 ${
              tecnicoPreId
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <Database size={12} className="shrink-0" />
            {tecnicoPreId ? (
              <span className="font-semibold">
                {tecnicoNombre} <span className="opacity-75">(#{tecnicoPreId})</span>
              </span>
            ) : prestadoresGeclisa.length > 0 ? (
              <select
                value={manualPreId}
                onChange={(e) => setManualPreId(e.target.value)}
                className="bg-transparent font-bold text-[11px] focus:outline-none cursor-pointer"
                title="Seleccionar Prestador Geclisa"
              >
                <option value="">Asignar Prestador...</option>
                {prestadoresGeclisa.map((p) => (
                  <option key={p.id} value={String(p.id)} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                    {p.nombre} (#{p.id})
                  </option>
                ))}
              </select>
            ) : (
              <Link href="/ajustes/usuarios" className="font-bold underline">
                Sin PreId
              </Link>
            )}
          </div>

          {/* Badge Línea 2 */}
          <div
            className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 ${
              lineaEstudiosStatus?.connected
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <Smartphone size={12} className="shrink-0" />
            <span className="font-semibold">
              {lineaEstudiosStatus?.connected
                ? lineaEstudiosStatus.display_phone_number || 'L2 Activa'
                : 'L2 Sin conectar'}
            </span>
          </div>
        </div>

        {/* 5 KPIs compactos en línea */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-[var(--border)] font-semibold">
            Hoy: <strong className="text-[var(--foreground)]">{metricas.total_hoy}</strong>
          </span>
          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold">
            Geclisa: <strong>{metricas.guardados_geclisa_hoy}</strong>
          </span>
          <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-700 dark:text-cyan-300 font-semibold">
            WA: <strong>{metricas.entregados_o_leidos_hoy}</strong>{' '}
            <span className="text-sky-500">({metricas.leidos_azul_hoy}✓✓)</span>
          </span>
          <span
            className={`px-2 py-1 rounded-lg border font-semibold ${
              metricas.fallidos_hoy > 0
                ? 'bg-rose-500/15 border-rose-500/35 text-rose-500'
                : 'bg-slate-100 dark:bg-slate-800/70 border-[var(--border)] text-[var(--secondary)]'
            }`}
          >
            Error: <strong>{metricas.fallidos_hoy}</strong>
          </span>
          <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-[var(--border)] text-[var(--secondary)] font-semibold">
            Anul: <strong>{metricas.anulados_hoy}</strong>
          </span>
        </div>
      </div>

      {/* WORKLIST DESACTIVADO TEMPORALMENTE POR FEATURE FLAG */}
      {ENABLE_WORKLIST_ORDENES && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-lg border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400">
                <ClipboardList size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-sm tracking-wide">
                    Worklist de Órdenes Médicas Solicitadas
                  </h2>
                  <span className="bg-cyan-500/30 text-cyan-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-cyan-400/40">
                    {worklistPedidos.length} {worklistPedidos.length === 1 ? 'pendiente' : 'pendientes'}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={cargarWorklist}
              disabled={cargandoWorklist}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <RefreshCw size={14} className={cargandoWorklist ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}

      {/* PASO 1 HORIZONTAL: BUSCADOR DE PACIENTE + RESUMEN + CELULAR + MODAL GECLISA */}
      <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Buscador DNI */}
          <form onSubmit={handleBuscarPaciente} className="flex items-center gap-2 lg:w-[270px] shrink-0">
            <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--secondary)]" />
              <input
                type="text"
                placeholder="DNI y Enter..."
                value={dniInput}
                onChange={(e) => setDniInput(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={buscandoPaciente}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1 transition-all disabled:opacity-50 shrink-0"
            >
              {buscandoPaciente ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              <span>{buscandoPaciente ? '...' : 'Buscar'}</span>
            </button>
          </form>

          {/* Estado Derecho de la Barra de Paciente */}
          <div className="flex-1 min-w-0 lg:border-l lg:border-[var(--border)] lg:pl-3">
            {errorBusqueda ? (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span className="truncate">{errorBusqueda}</span>
              </div>
            ) : paciente ? (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                {/* Identidad y Cobertura */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 shrink-0">
                    <User size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-[var(--foreground)] truncate">
                        {paciente.nombre_completo}
                      </h3>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0">
                        ✓ Activo
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--secondary)] font-mono truncate">
                      {paciente.tipo_documento || 'D.N.I.'}: {paciente.dni} • Ficha #{paciente.geclisa_ficha_id}
                      {paciente.obra_social ? ` • ${paciente.obra_social}${paciente.plan ? ` (${paciente.plan})` : ''}` : ''}
                    </p>
                  </div>
                </div>

                {/* Celular Editable + Botón Modal Archivos Geclisa */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={codigoPais}
                      onChange={(e) => setCodigoPais(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800/80 border border-[var(--border)] text-[11px] font-bold px-2 py-1.5 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500 text-[var(--foreground)]"
                      title="Prefijo internacional para WhatsApp"
                    >
                      <option value="549">🇦🇷 +54 9</option>
                      <option value="569">🇨🇱 +56 9</option>
                      <option value="598">🇺🇾 +598</option>
                      <option value="55">🇧🇷 +55</option>
                      <option value="">🌐 +</option>
                    </select>
                    <div className="relative w-36 sm:w-40">
                      <input
                        type="text"
                        value={telefonoLocal}
                        onChange={(e) => setTelefonoLocal(cleanLocalInputDigits(e.target.value, codigoPais))}
                        placeholder="Área + Número"
                        className={`w-full pl-2.5 pr-6 py-1.5 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          codigoPais === '549' && telefonoLocal && telefonoLocal.length < 10
                            ? 'border-amber-500/60'
                            : 'border-[var(--border)]'
                        }`}
                        title={
                          telefonoLocal
                            ? `Destino WhatsApp: ${formatPhoneDisplay(telefonoDestino)}`
                            : 'Ingresá código de área y número sin 0 ni 15'
                        }
                      />
                      {telefonoLocal && (
                        <button
                          type="button"
                          onClick={() => setTelefonoLocal('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-[10px] px-1"
                          title="Limpiar número"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {archivosGeclisa.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowArchivosGeclisa(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <FolderOpen size={14} />
                      <span>Archivos Geclisa ({archivosGeclisa.length})</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--secondary)] flex items-center gap-2 py-1">
                <Info size={14} className="text-cyan-500 shrink-0" />
                <span>Ingresa el DNI del paciente para cargar su ficha, celular y archivos previos de Geclisa.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ÁREA OPERATIVA EN 2 COLUMNAS PARALELAS (Configuración + Envío a la Izquierda | Adjuntos + Miniaturas a la Derecha) */}
      <form onSubmit={handleEnviarEstudio} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch lg:h-[calc(100vh-205px)] lg:min-h-[395px] lg:max-h-[540px]">
        {/* COLUMNA IZQUIERDA (5 cols): PASO 2, OPCIONES, PLANTILLA Y BOTÓN ENVIAR SIEMPRE VISIBLE */}
        <div className="lg:col-span-5 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs flex flex-col gap-2.5 min-h-0">
          {/* Header Paso 2 + Lateralidad AO/OD/OI */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <h2 className="font-bold text-sm text-[var(--foreground)]">
                Estudio y Lateralidad
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(['AO', 'OD', 'OI'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    formTouchedRef.current = true
                    setOjo(o)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
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

          {/* Chips de Presets compactos */}
          {estudiosPresets.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-[82px] overflow-y-auto pr-1">
              {estudiosPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    formTouchedRef.current = true
                    setTipoEstudio(preset.nombre)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    tipoEstudio === preset.nombre
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-[var(--border)] text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset.nombre}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--secondary)] italic">
              Sin etiquetas activas — escribe el título manualmente.
            </p>
          )}

          {/* Título del Estudio */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[var(--secondary)]">
                Título del Estudio
              </label>
              <span
                className={`text-[10px] font-mono ${
                  tipoEstudio.trim() && getGeclisaTitleInfo(tipoEstudio, ojo).exceedsLimit
                    ? 'text-amber-500 font-bold'
                    : 'text-[var(--secondary)]'
                }`}
              >
                {getGeclisaTitleInfo(tipoEstudio, ojo).length}/45 Geclisa
              </span>
            </div>
            <input
              type="text"
              value={tipoEstudio}
              onChange={(e) => {
                formTouchedRef.current = true
                setTipoEstudio(e.target.value)
              }}
              placeholder="Escribe el tipo de estudio..."
              className="w-full px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          {/* Observaciones */}
          <div>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones para Historia Clínica (opcional)..."
              className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Checkboxes compactos */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] pt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={guardarEnGeclisa}
                onChange={(e) => setGuardarEnGeclisa(e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600 rounded"
              />
              <span>Guardar en Geclisa</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={enviarWhatsapp}
                onChange={(e) => setEnviarWhatsapp(e.target.checked)}
                className="h-3.5 w-3.5 accent-cyan-600 rounded"
              />
              <span>WhatsApp (L2)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-teal-600 dark:text-teal-400">
              <input
                type="checkbox"
                checked={aplicarCaratula}
                onChange={(e) => setAplicarCaratula(e.target.checked)}
                className="h-3.5 w-3.5 accent-teal-600 rounded"
              />
              <span>Membrete Centrovisión</span>
            </label>
          </div>

          {/* Plantilla WhatsApp en 1 línea + Botón Vista Previa Modal */}
          {enviarWhatsapp && (
            <div className="flex items-center gap-2 pt-0.5">
              <Sparkles size={14} className="text-cyan-600 shrink-0" />
              <select
                value={plantillaSeleccionada}
                onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-50 dark:bg-slate-900 border border-cyan-500/30 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                title="Plantilla de WhatsApp Oficial (Meta Línea 2)"
              >
                <option value="auto">
                  ✦ Auto ({activeTemplateName})
                </option>
                {estudiosTemplates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.titulo_amigable || t.name} [{t.header_type}]
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setMostrarPreviewPlantilla(true)}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-1 shrink-0"
                title="Ver mensaje que recibirá el paciente"
              >
                <Eye size={13} />
                <span>Previa</span>
              </button>
            </div>
          )}

          {/* CTA Principal fijado al pie de la columna izquierda */}
          <button
            type="submit"
            disabled={enviandoEstudio || !paciente || selectedFiles.length === 0}
            className="mt-auto w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {enviandoEstudio ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>{progresoOptimizacion || 'Procesando en paralelo (Geclisa + Meta)...'}</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Archivar en Geclisa y Enviar por WhatsApp</span>
              </>
            )}
          </button>
        </div>

        {/* COLUMNA DERECHA (7 cols): PASO 3 - ADJUNTAR, ORDENAR Y PREVISUALIZAR MINIATURAS */}
        <div className="lg:col-span-7 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs flex flex-col gap-2.5 min-h-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <h2 className="font-bold text-sm text-[var(--foreground)]">
                Adjuntar Estudio (`PDF`, `JPG`, `PNG` o `Ctrl+V`)
              </h2>
            </div>
            <span className="text-[11px] text-[var(--secondary)] flex items-center gap-1">
              <ClipboardPaste size={13} className="text-cyan-600" />
              Pegar con <strong>Ctrl + V</strong>
            </span>
          </div>

          {/* Dropzone adaptativo: amplio si está vacío, barra compacta si ya hay archivos */}
          <div
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDragging(false)
              }
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return
              e.preventDefault()
              setIsDragging(false)
              handleFileChange(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
              studyItems.length > 0 ? 'px-4 py-2.5 flex items-center justify-between gap-3' : 'p-8 text-center'
            } ${
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
            {studyItems.length > 0 ? (
              <>
                <div className="flex items-center gap-2.5 text-xs">
                  <Upload size={16} className="text-cyan-600 shrink-0" />
                  <span className="font-semibold text-[var(--foreground)]">
                    Agregar más archivos, arrastrar aquí o <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px]">Ctrl+V</kbd>
                  </span>
                </div>
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                  + Seleccionar
                </span>
              </>
            ) : (
              <>
                <Upload size={28} className="mx-auto text-cyan-600 mb-2" />
                <p className="text-sm font-bold text-[var(--foreground)]">
                  Arrastra el estudio aquí o haz clic para seleccionarlo
                </p>
                <p className="text-xs text-[var(--secondary)] mt-1">
                  Soporta <strong>PDF, JPG y PNG</strong> (hasta 20 MB). Las imágenes se ordenan en ascendente natural y puedes reordenarlas antes de enviar.
                </p>
              </>
            )}
          </div>

          {/* Grilla visual de miniaturas numeradas y reordenables */}
          {studyItems.length > 0 && (() => {
            const allImages = studyItems.every((i) => !i.isPdf)
            const mostrarAgrupado2x2 = grilla2x2 && studyItems.length > 1 && allImages

            const renderThumbCard = (item: StudyFileItem, idx: number) => {
              const isBeingDragged = draggedItemId === item.id
              const isDragTarget = dragOverItemId === item.id && draggedItemId !== item.id
              return (
                <div
                  key={item.id}
                  draggable={!enviandoEstudio}
                  onDragStart={(e) => {
                    if (enviandoEstudio) return
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/x-study-thumb', item.id)
                    setDraggedItemId(item.id)
                  }}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes('application/x-study-thumb')) return
                    e.preventDefault()
                    e.stopPropagation()
                    if (dragOverItemId !== item.id) {
                      setDragOverItemId(item.id)
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverItemId === item.id) {
                      setDragOverItemId(null)
                    }
                  }}
                  onDrop={(e) => {
                    if (!e.dataTransfer.types.includes('application/x-study-thumb')) return
                    e.preventDefault()
                    e.stopPropagation()
                    const sourceId = e.dataTransfer.getData('application/x-study-thumb')
                    setDraggedItemId(null)
                    setDragOverItemId(null)
                    moveStudyItemById(sourceId, item.id)
                  }}
                  onDragEnd={() => {
                    setDraggedItemId(null)
                    setDragOverItemId(null)
                  }}
                  className={`group relative rounded-xl border bg-slate-50 dark:bg-slate-800/60 overflow-hidden transition-all select-none ${
                    !enviandoEstudio ? 'cursor-grab active:cursor-grabbing' : 'opacity-70'
                  } ${
                    isDragTarget
                      ? 'border-cyan-500 ring-2 ring-cyan-500/40 scale-[1.02]'
                      : isBeingDragged
                        ? 'opacity-40 border-dashed border-cyan-500'
                        : 'border-[var(--border)] hover:border-cyan-500/50'
                  }`}
                >
                  <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-bold font-mono shadow-sm">
                    #{idx + 1}
                  </span>

                  <button
                    type="button"
                    disabled={enviandoEstudio}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeStudyItem(item.id)
                    }}
                    title="Quitar archivo"
                    className="absolute top-1 right-1 z-10 p-1 rounded bg-slate-900/75 hover:bg-rose-600 text-white transition-colors disabled:opacity-40"
                  >
                    <X size={11} />
                  </button>

                  <div
                    onClick={(e) => {
                      if (!item.isPdf) {
                        e.stopPropagation()
                        setLightboxItemId(item.id)
                      }
                    }}
                    title={item.isPdf ? item.file.name : 'Clic para ampliar imagen'}
                    className={`aspect-[4/3] w-full bg-slate-200/70 dark:bg-slate-900/70 flex items-center justify-center overflow-hidden ${
                      !item.isPdf ? 'cursor-zoom-in' : ''
                    }`}
                  >
                    {item.isPdf ? (
                      <div className="flex flex-col items-center gap-1 text-rose-500">
                        <FileText size={24} />
                        <span className="text-[10px] font-bold uppercase">PDF</span>
                      </div>
                    ) : item.thumbUrl ? (
                      <img
                        src={item.thumbUrl}
                        alt={item.file.name}
                        draggable={false}
                        className="w-full h-full object-contain bg-white dark:bg-slate-950"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center animate-pulse">
                        <ImageIcon size={20} className="text-cyan-500/60" />
                      </div>
                    )}
                  </div>

                  <div className="p-1.5 space-y-0.5 bg-white/70 dark:bg-slate-900/50 border-t border-[var(--border)]">
                    <p className="text-[10px] font-semibold text-[var(--foreground)] truncate" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] text-[var(--secondary)] font-mono">
                        {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      {studyItems.length > 1 && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={enviandoEstudio || idx === 0}
                            onClick={(e) => {
                              e.stopPropagation()
                              moveStudyItem(idx, idx - 1)
                            }}
                            title="Mover antes"
                            className="p-0.5 rounded hover:bg-cyan-500/15 text-[var(--secondary)] hover:text-cyan-600 disabled:opacity-25"
                          >
                            <ArrowLeft size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={enviandoEstudio || idx === studyItems.length - 1}
                            onClick={(e) => {
                              e.stopPropagation()
                              moveStudyItem(idx, idx + 1)
                            }}
                            title="Mover después"
                            className="p-0.5 rounded hover:bg-cyan-500/15 text-[var(--secondary)] hover:text-cyan-600 disabled:opacity-25"
                          >
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            const chunks: { sheetIndex: number; items: { item: StudyFileItem; globalIdx: number }[] }[] = []
            if (mostrarAgrupado2x2) {
              for (let i = 0; i < studyItems.length; i += 4) {
                chunks.push({
                  sheetIndex: Math.floor(i / 4) + 1,
                  items: studyItems.slice(i, i + 4).map((item, offset) => ({
                    item,
                    globalIdx: i + offset
                  }))
                })
              }
            }

            return (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                {/* Toolbar de ordenamiento */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-[var(--border)]">
                  <span className="text-[11px] font-semibold text-[var(--foreground)]">
                    {studyItems.length} {studyItems.length === 1 ? 'archivo' : 'archivos'} •{' '}
                    <span className="font-mono text-[var(--secondary)]">
                      {(studyItems.reduce((a, i) => a + i.file.size, 0) / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {studyItems.length > 1 && (
                      <>
                        <button
                          type="button"
                          disabled={enviandoEstudio}
                          onClick={() => sortAllStudyItems('asc')}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-900 border border-[var(--border)] hover:border-cyan-500/50 flex items-center gap-1 disabled:opacity-40"
                          title="Ordenar por nombre ascendente (A→Z)"
                        >
                          <ArrowDownAZ size={12} className="text-cyan-600" />
                          A→Z
                        </button>
                        <button
                          type="button"
                          disabled={enviandoEstudio}
                          onClick={() => sortAllStudyItems('desc')}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-900 border border-[var(--border)] hover:border-cyan-500/50 flex items-center gap-1 disabled:opacity-40"
                          title="Ordenar por nombre descendente (Z→A)"
                        >
                          <ArrowUpZA size={12} className="text-cyan-600" />
                          Z→A
                        </button>
                        <button
                          type="button"
                          disabled={enviandoEstudio}
                          onClick={reverseStudyItems}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-white dark:bg-slate-900 border border-[var(--border)] hover:border-cyan-500/50 flex items-center gap-1 disabled:opacity-40"
                          title="Invertir el orden actual"
                        >
                          <ArrowUpDown size={12} className="text-cyan-600" />
                          Invertir
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={enviandoEstudio}
                      onClick={clearStudyItems}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center gap-1 disabled:opacity-40"
                    >
                      <Trash2 size={11} />
                      Limpiar
                    </button>
                  </div>
                </div>

                {/* Grilla con scroll interno real en wrapper separado (evita compresión de filas en CSS Grid) */}
                {mostrarAgrupado2x2 ? (
                  <div className="flex-1 min-h-[180px] overflow-y-auto pr-1 space-y-2.5">
                    {chunks.map((chunk) => {
                      const startNum = chunk.items[0].globalIdx + 1
                      const endNum = chunk.items[chunk.items.length - 1].globalIdx + 1
                      return (
                        <div
                          key={chunk.sheetIndex}
                          className="p-2 rounded-xl bg-indigo-500/5 border border-indigo-500/25 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-300 px-0.5">
                            <span>Hoja {chunk.sheetIndex} (Tomas #{startNum}–#{endNum})</span>
                            {aplicarCaratula && (
                              <span className="text-[10px] font-normal text-[var(--secondary)]">
                                Pág. {chunk.sheetIndex + 1} del PDF
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 auto-rows-max">
                            {chunk.items.map(({ item, globalIdx }) => renderThumbCard(item, globalIdx))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 min-h-[180px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 auto-rows-max">
                      {studyItems.map((item, idx) => renderThumbCard(item, idx))}
                    </div>
                  </div>
                )}

                {/* Opciones de consolidación PDF / Grilla 2x2 en una fila compacta */}
                {allImages && (
                  <div className="mt-auto pt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={unificarEnPdf || (grilla2x2 && selectedFiles.length > 1)}
                        disabled={grilla2x2 && selectedFiles.length > 1}
                        onChange={(e) => setUnificarEnPdf(e.target.checked)}
                        className="h-3.5 w-3.5 accent-cyan-600 rounded"
                      />
                      <Layers size={13} className="text-cyan-600 shrink-0" />
                      <span>Unificar en PDF</span>
                    </label>

                    {selectedFiles.length > 1 && (
                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={grilla2x2}
                          onChange={(e) => {
                            const next = e.target.checked
                            setGrilla2x2(next)
                            if (next) setUnificarEnPdf(true)
                          }}
                          className="h-3.5 w-3.5 accent-indigo-600 rounded"
                        />
                        <LayoutGrid size={13} className="text-indigo-500 shrink-0" />
                        <span>Grilla 2×2 (4 por pág.)</span>
                      </label>
                    )}

                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium ml-auto">
                      Auto-optimización antes de subir
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </form>

      {/* MODAL: LIGHTBOX PARA INSPECCIONAR TOMA AMPLIADA */}
      {lightboxItem && lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-lightbox-title"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxItemId(null)}
        >
          <div
            className="w-full max-w-5xl flex items-center justify-between gap-3 text-white mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-cyan-600 text-xs font-bold font-mono shrink-0">
                #{lightboxIndex + 1} / {studyItems.length}
              </span>
              <h3 id="modal-lightbox-title" className="text-xs sm:text-sm font-bold truncate">
                {lightboxItem.file.name}
              </h3>
              <span className="text-[11px] text-slate-400 font-mono shrink-0">
                ({(lightboxItem.file.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLightboxItemId(null)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
              title="Cerrar (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="relative flex items-center justify-center max-w-5xl w-full max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={lightboxIndex <= 0}
              onClick={() => {
                for (let i = lightboxIndex - 1; i >= 0; i--) {
                  if (!studyItems[i].isPdf) {
                    setLightboxItemId(studyItems[i].id)
                    break
                  }
                }
              }}
              className="p-2.5 rounded-full bg-slate-900/80 hover:bg-cyan-600 text-white border border-slate-700 mr-3 disabled:opacity-25 shrink-0"
              title="Toma anterior (←)"
            >
              <ArrowLeft size={20} />
            </button>

            <img
              src={lightboxUrl}
              alt={lightboxItem.file.name}
              className="max-h-[78vh] max-w-full object-contain rounded-xl border border-slate-800 bg-black shadow-2xl"
            />

            <button
              type="button"
              disabled={lightboxIndex >= studyItems.length - 1}
              onClick={() => {
                for (let i = lightboxIndex + 1; i < studyItems.length; i++) {
                  if (!studyItems[i].isPdf) {
                    setLightboxItemId(studyItems[i].id)
                    break
                  }
                }
              }}
              className="p-2.5 rounded-full bg-slate-900/80 hover:bg-cyan-600 text-white border border-slate-700 ml-3 disabled:opacity-25 shrink-0"
              title="Toma siguiente (→)"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CANDIDATOS MÚLTIPLES EN GECLISA */}
      {candidatosGeclisa.length > 1 && !paciente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-candidatos-title"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCandidatosGeclisa([])}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300">
                <AlertTriangle size={18} />
                <h3 id="modal-candidatos-title" className="text-sm font-bold">
                  Se encontraron {candidatosGeclisa.length} fichas activas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCandidatosGeclisa([])}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-[var(--secondary)]"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Selecciona el paciente correcto para cargar su ficha de Geclisa:
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {candidatosGeclisa.map((cand) => (
                <button
                  key={cand.ficha_id}
                  type="button"
                  onClick={() => handleSeleccionarCandidato(cand)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 border border-[var(--border)] hover:border-cyan-500/50 transition-all flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-bold text-[var(--foreground)]">{cand.nombre_completo}</p>
                    <p className="text-[11px] text-[var(--secondary)] font-mono">
                      {cand.tipo_documento}: {cand.dni} • Ficha #{cand.ficha_id}
                      {cand.fecha_nacimiento ? ` • Nac: ${cand.fecha_nacimiento}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                    Elegir →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ARCHIVOS EXISTENTES EN GECLISA */}
      {showArchivosGeclisa && paciente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-archivos-geclisa-title"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowArchivosGeclisa(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen size={18} className="text-cyan-500 shrink-0" />
                <div className="min-w-0">
                  <h3 id="modal-archivos-geclisa-title" className="text-sm font-bold text-[var(--foreground)] truncate">
                    Archivos en Geclisa ({archivosGeclisa.length})
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)] truncate">
                    {paciente.nombre_completo} • Ficha #{paciente.geclisa_ficha_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowArchivosGeclisa(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-[var(--secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {archivosGeclisa.map((arc) => (
                <div
                  key={arc.as_id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-[var(--border)] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--foreground)] truncate" title={arc.titulo}>
                      {arc.titulo || `Archivo #${arc.as_id}`}
                    </p>
                    <p className="text-[11px] text-[var(--secondary)]">
                      {formatDateArg(arc.fecha)} • AS_ID #{arc.as_id}
                      {arc.prestador ? ` • ${arc.prestador}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`${BACKEND_URL}/api/geclisa/archivos/${arc.as_id}/ver`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-[var(--border)] hover:bg-slate-100 text-[var(--foreground)]"
                      title="Ver archivo desde Geclisa"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      disabled={enviandoExistenteId === arc.as_id}
                      onClick={() => handleEnviarArchivoExistenteGeclisa(arc)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      title="Enviar este archivo ya guardado en Geclisa por WhatsApp"
                    >
                      <Send size={12} />
                      <span>{enviandoExistenteId === arc.as_id ? 'Enviando...' : 'Enviar WA'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISTA PREVIA DE PLANTILLA WHATSAPP */}
      {mostrarPreviewPlantilla && enviarWhatsapp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-preview-wa-title"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setMostrarPreviewPlantilla(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Smartphone size={15} className="text-cyan-400" />
                <h3 id="modal-preview-wa-title" className="text-xs font-bold">
                  Vista previa WhatsApp ({activeTemplateName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMostrarPreviewPlantilla(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X size={15} />
              </button>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>
                Destino: {telefonoDestino ? formatPhoneDisplay(telefonoDestino) : '(Sin celular)'}
              </span>
              <span className="font-mono text-[10px]">{activeTemplate.header_type}</span>
            </div>

            <div className="bg-[#0b141a] p-3 rounded-2xl border border-emerald-950/40 space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#202c33] text-emerald-400 text-[11px] font-medium">
                {activeTemplate.header_type === 'IMAGE' ? <ImageIcon size={15} /> : <FileText size={15} />}
                <span>
                  {activeTemplate.header_type === 'IMAGE'
                    ? '📷 [Imagen del estudio oftalmológico adjunta]'
                    : '📄 [Documento PDF del estudio oftalmológico adjunto]'}
                </span>
              </div>
              <p className="text-[12px] text-slate-100 whitespace-pre-wrap leading-relaxed">
                {previewBodyText}
              </p>
              <div className="text-[10px] text-slate-400 text-right">
                Hoy 10:30 • Línea 2 Oficial Centrovisión
              </div>
              {activeTemplate.buttons && activeTemplate.buttons.length > 0 && (
                <div className="pt-1.5 border-t border-slate-700/40 flex flex-col gap-1">
                  {activeTemplate.buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="py-1 px-3 rounded-lg bg-[#202c33] text-center text-[11px] text-cyan-400 font-semibold"
                    >
                      {btn.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
