'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Megaphone,
  ShieldCheck,
  Image as ImageIcon,
  Upload,
  Play,
  Pause,
  CheckCircle2,
  Sliders,
  Smartphone,
  Users,
  Sparkles,
  Loader2,
  Plus,
  AlertTriangle,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  User,
  Clock,
  RefreshCw,
  Search,
  Trash2,
  X,
  FileImage,
  Check,
  FileText,
  Eye,
  Info,
  Send,
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import { apiFetch } from '@/lib/api'
import { OpticaCampana, OpticaPlaca, OpticaSaludLinea } from '@/types/optica'
import { formatDateArg } from '@/lib/dateUtils'

interface PlantillaOptica {
  id?: string
  name: string
  titulo_amigable?: string
  category?: string
  status?: string
  body_text?: string
  buttons?: Array<{ type?: string; text?: string; url?: string }>
}

interface PacienteTurnoGeclisa {
  turno_id: string
  ficha_id: string
  paciente_nombre: string
  dni: string
  telefono: string
  hora_turno: string
  fecha_turno: string
  prestador_id: string
  prestador_nombre: string
  ubicacion?: string
  ubicacion_id?: string
  consultorio?: string
  servicio?: string
  servicio_id?: string
  practica?: string
  servicio_practica: string
  obra_social: string
  codigo_beneficio: string
  estado_envio: 'ELEGIBLE' | 'COOLDOWN_ACTIVO' | 'OPT_OUT' | 'SIN_CELULAR'
  motivo_exclusion?: string | null
  seleccionado?: boolean
}

interface PrestadorFiltro {
  id: string
  nombre: string
  cantidad_turnos?: number
}

interface UbicacionFiltro {
  id: string
  nombre: string
  cantidad_turnos?: number
}

interface ServicioFiltro {
  id: string
  nombre: string
  cantidad_turnos?: number
}

export default function OpticaCampanasPage() {
  const [salud, setSalud] = useState<OpticaSaludLinea | null>(null)
  const [placas, setPlacas] = useState<OpticaPlaca[]>([])
  const [campanas, setCampanas] = useState<OpticaCampana[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaOptica[]>([])
  const [loading, setLoading] = useState(true)

  // Subida de nueva placa promocional desde PC (Galería)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [nuevaPlacaTitulo, setNuevaPlacaTitulo] = useState('')
  const [nuevaPlacaCat, setNuevaPlacaCat] = useState('VOUCHER_TURNO')
  const [uploadingPlaca, setUploadingPlaca] = useState(false)
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deletingPlacaId, setDeletingPlacaId] = useState<string | null>(null)

  // Subida directa desde Paso 3 del Constructor
  const step3FileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingStep3Placa, setUploadingStep3Placa] = useState(false)
  const [step3IsDragging, setStep3IsDragging] = useState(false)
  const [step3UploadFeedback, setStep3UploadFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Wizard de 5 pasos para Crear Campaña Anti-Bloqueo
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [campNombre, setCampNombre] = useState('Campaña Voucher 20% OFF Pacientes Consultorio')
  const [campSegmento, setCampSegmento] = useState('TURNOS_PROXIMOS_CON_DESCUENTO')
  const [diasRecetasFiltro, setDiasRecetasFiltro] = useState<number>(30)

  // Paso 2: Selección Granular de Turnos de Geclisa con Timezone Mendoza UTC-3
  const getFechaOffsetStr = (diasOffset: number) => {
    const now = new Date()
    // Ajustar a timezone Mendoza UTC-3 sin desfasar a medianoche UTC
    const mza = new Date(now.getTime() - (now.getTimezoneOffset() - 180) * 60000)
    mza.setDate(mza.getDate() + diasOffset)
    return mza.toISOString().split('T')[0]
  }

  const [fechaTurnoFiltro, setFechaTurnoFiltro] = useState<string>(getFechaOffsetStr(1))
  const [turnosGeclisa, setTurnosGeclisa] = useState<PacienteTurnoGeclisa[]>([])
  const [selectedTurnoIds, setSelectedTurnoIds] = useState<Set<string>>(new Set())

  // Filtros locales en memoria (no resetean selección)
  const [prestadoresDisponibles, setPrestadoresDisponibles] = useState<PrestadorFiltro[]>([])
  const [prestadorFiltroId, setPrestadorFiltroId] = useState<string>('TODOS')
  const [ubicacionesDisponibles, setUbicacionesDisponibles] = useState<UbicacionFiltro[]>([])
  const [ubicacionFiltroId, setUbicacionFiltroId] = useState<string>('TODAS')
  const [serviciosDisponibles, setServiciosDisponibles] = useState<ServicioFiltro[]>([])
  const [servicioFiltroId, setServicioFiltroId] = useState<string>('TODOS')
  const [searchPaciente, setSearchPaciente] = useState<string>('')
  const [loadingTurnos, setLoadingTurnos] = useState(false)
  const [errorTurnos, setErrorTurnos] = useState<string | null>(null)
  const [pacientePreview, setPacientePreview] = useState<PacienteTurnoGeclisa | null>(null)

  // Pasos 3, 4 y 5: Estrategia, Plantilla, Jitter y Confirmación
  const [campEstrategia, setCampEstrategia] = useState<'DOBLE_PASO' | 'DIRECTA_IMAGEN'>('DOBLE_PASO')
  const [campTemplate, setCampTemplate] = useState('vortix_beneficio_turno_v1')
  const [campPlacaUrl, setCampPlacaUrl] = useState('')
  const [campDescuento, setCampDescuento] = useState('20% OFF en Cristales y Armazones')
  const [jitterMin, setJitterMin] = useState(35)
  const [jitterMax, setJitterMax] = useState(90)
  const [loteMaxHora, setLoteMaxHora] = useState(35)
  const [creatingCamp, setCreatingCamp] = useState(false)

  // Modal de Detalle de Campaña en Historial
  const [campanaDetalleModal, setCampanaDetalleModal] = useState<OpticaCampana | null>(null)
  const [destinatariosDetalle, setDestinatariosDetalle] = useState<any[]>([])
  const [loadingDestinatarios, setLoadingDestinatarios] = useState(false)

  // Disparo Inmediato de Prueba (Opción 1 y 2: Whitelist y Bypass Cooldown)
  const [telefonoPrueba, setTelefonoPrueba] = useState('2614703230')
  const [enviandoPrueba, setEnviandoPrueba] = useState(false)
  const [pruebaFeedback, setPruebaFeedback] = useState<{ type: 'success' | 'error'; text: string; wamid?: string } | null>(null)

  const handleEnviarPrueba = async () => {
    if (!telefonoPrueba.trim()) {
      setPruebaFeedback({ type: 'error', text: 'Por favor ingresa un número de celular de prueba.' })
      return
    }
    setEnviandoPrueba(true)
    setPruebaFeedback(null)
    try {
      const res = await apiFetch('/api/optica-vortix/campanas/enviar-prueba', {
        method: 'POST',
        body: JSON.stringify({
          telefono: telefonoPrueba.trim(),
          template_name: campTemplate,
          nombre_contacto: pacientePreview?.paciente_nombre || 'Paciente Prueba',
          descuento_texto: campDescuento,
          estrategia: campEstrategia,
          placa_url: campPlacaUrl || null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPruebaFeedback({
          type: 'success',
          text: `¡WhatsApp de prueba enviado con éxito a ${data.telefono}!`,
          wamid: data.wamid,
        })
      } else {
        setPruebaFeedback({
          type: 'error',
          text: data?.detail || data?.message || 'Error al enviar WhatsApp de prueba desde la Línea 3.',
        })
      }
    } catch (err: any) {
      setPruebaFeedback({
        type: 'error',
        text: err?.message || 'Error de conexión al disparar el WhatsApp de prueba.',
      })
    } finally {
      setEnviandoPrueba(false)
    }
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const [resS, resP, resC, resT] = await Promise.all([
        apiFetch('/api/optica-vortix/salud-linea', { cache: 'no-store' }).catch(() => null),
        apiFetch('/api/optica-vortix/placas', { cache: 'no-store' }).catch(() => null),
        apiFetch('/api/optica-vortix/campanas', { cache: 'no-store' }).catch(() => null),
        apiFetch('/api/optica-vortix/plantillas', { cache: 'no-store' }).catch(() => null),
      ])
      if (resS?.ok) setSalud(await resS.json())
      if (resP?.ok) {
        const dp = await resP.json()
        const listP = Array.isArray(dp) ? dp : dp.items || []
        setPlacas(listP)
        if (!campPlacaUrl && listP.length > 0) setCampPlacaUrl(listP[0].url_imagen)
      }
      if (resC?.ok) {
        const dc = await resC.json()
        setCampanas(Array.isArray(dc) ? dc : dc.items || [])
      }
      if (resT?.ok) {
        const dt = await resT.json()
        const listT: PlantillaOptica[] = Array.isArray(dt) ? dt : dt.plantillas || dt.items || []
        setPlantillas(listT)
        if (listT.length > 0) {
          const yaExiste = listT.some((p) => p.name === campTemplate)
          if (!yaExiste) {
            const preferida = listT.find((p) => p.status === 'APPROVED') || listT[0]
            setCampTemplate(preferida.name)
          }
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Drag & drop handlers para Galería general
  const handleFilePicked = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadFeedback({ type: 'error', text: 'Por favor selecciona un archivo de imagen (PNG, JPG o WEBP).' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadFeedback({ type: 'error', text: 'La imagen supera el límite de 10 MB.' })
      return
    }
    setSelectedFile(file)
    setUploadFeedback(null)
    if (!nuevaPlacaTitulo.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setNuevaPlacaTitulo(nameWithoutExt.replace(/[-_]/g, ' ').slice(0, 60))
    }
    const reader = new FileReader()
    reader.onload = (e) => setFilePreviewUrl(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFilePicked(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFilePicked(file)
  }

  const handleClearSelectedFile = () => {
    setSelectedFile(null)
    setFilePreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUploadNuevaPlaca = async () => {
    if (!selectedFile) return
    setUploadingPlaca(true)
    setUploadFeedback(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('titulo', nuevaPlacaTitulo.trim() || selectedFile.name)
      formData.append('categoria', nuevaPlacaCat)

      const res = await apiFetch('/api/optica-vortix/placas/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const nueva = await res.json()
        setUploadFeedback({ type: 'success', text: '¡Placa subida con éxito a Supabase Storage!' })
        setCampPlacaUrl(nueva.url_imagen)
        handleClearSelectedFile()
        setNuevaPlacaTitulo('')
        await loadAll()
      } else {
        const err = await res.json().catch(() => null)
        setUploadFeedback({ type: 'error', text: err?.detail || 'Error al subir la placa al almacenamiento.' })
      }
    } catch (err: any) {
      setUploadFeedback({ type: 'error', text: err?.message || 'Error de conexión al subir la placa.' })
    } finally {
      setUploadingPlaca(false)
    }
  }

  // Subida Directa en Paso 3 (Drag & Drop + Input File)
  const handleStep3UploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStep3UploadFeedback({ type: 'error', text: 'El archivo debe ser una imagen (PNG, JPG o WEBP).' })
      return
    }
    setUploadingStep3Placa(true)
    setStep3UploadFeedback(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('titulo', file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').slice(0, 50))
      formData.append('categoria', 'VOUCHER_TURNO')

      const res = await apiFetch('/api/optica-vortix/placas/upload', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const uploaded = await res.json()
        setCampPlacaUrl(uploaded.url_imagen)
        setPlacas((prev) => [uploaded, ...prev])
        setStep3UploadFeedback({ type: 'success', text: '¡Placa subida y aplicada como portada de campaña!' })
      } else {
        const err = await res.json().catch(() => null)
        setStep3UploadFeedback({ type: 'error', text: err?.detail || 'No se pudo subir la placa.' })
      }
    } catch (err: any) {
      setStep3UploadFeedback({ type: 'error', text: err?.message || 'Error de conexión al subir placa.' })
    } finally {
      setUploadingStep3Placa(false)
    }
  }

  const handleDeletePlaca = async (e: React.MouseEvent, pl: OpticaPlaca) => {
    e.stopPropagation()
    if (!confirm(`¿Eliminar la placa promocional "${pl.titulo}"?`)) return
    setDeletingPlacaId(pl.id)
    try {
      await apiFetch(`/api/optica-vortix/placas/${encodeURIComponent(pl.id)}`, {
        method: 'DELETE',
      })
      if (campPlacaUrl === pl.url_imagen) {
        setCampPlacaUrl('')
      }
      setPlacas((prev) => prev.filter((item) => item.id !== pl.id))
      await loadAll()
    } catch (err) {
      setPlacas((prev) => prev.filter((item) => item.id !== pl.id))
      if (campPlacaUrl === pl.url_imagen) {
        setCampPlacaUrl('')
      }
    } finally {
      setDeletingPlacaId(null)
    }
  }

  // Consulta de Audiencia a Geclisa / Recetas
  const fetchAudienciaGeclisa = async (
    fechaParam?: string,
    segmentoParam?: string,
    diasRecetasParam?: number,
    forceRefresh: boolean = false
  ) => {
    setLoadingTurnos(true)
    setErrorTurnos(null)
    const targetFecha = fechaParam || fechaTurnoFiltro
    const targetSeg = segmentoParam || campSegmento
    const targetDiasRecetas = diasRecetasParam || diasRecetasFiltro

    try {
      const q = new URLSearchParams()
      if (targetFecha) q.set('fecha', targetFecha)
      if (targetSeg) q.set('segmento', targetSeg)
      if (targetDiasRecetas) q.set('dias_recetas', String(targetDiasRecetas))
      if (forceRefresh) q.set('force_refresh', 'true')

      // NOTA: No enviamos filtros de prestador/ubicacion/servicio para que el backend devuelva la nómina
      // completa del día/período y el frontend pueda filtrarla instantáneamente (0ms) sin borrar selecciones.
      const res = await apiFetch(`/api/optica-vortix/campanas/audiencia-geclisa?${q.toString()}`, {
        cache: 'no-store',
        timeoutMs: 45000,
      })
      if (res.ok) {
        const data = await res.json()
        const pacs: PacienteTurnoGeclisa[] = data.pacientes || []
        setTurnosGeclisa(pacs)

        // Inicializar seleccionados: por defecto todos los ELEGIBLES quedan marcados
        const elegibles = new Set(pacs.filter((p) => p.estado_envio === 'ELEGIBLE').map((p) => p.turno_id))
        setSelectedTurnoIds(elegibles)

        if (data.prestadores) {
          setPrestadoresDisponibles(data.prestadores)
        }
        if (data.ubicaciones) {
          setUbicacionesDisponibles(data.ubicaciones)
        }
        if (data.servicios) {
          setServiciosDisponibles(data.servicios)
        }
        if (pacs.length > 0) {
          const primerElegible = pacs.find((p) => p.estado_envio === 'ELEGIBLE') || pacs[0]
          setPacientePreview(primerElegible)
        } else {
          setPacientePreview(null)
        }
      } else {
        const errJson = await res.json().catch(() => null)
        setErrorTurnos(errJson?.detail || 'No se pudo conectar con la agenda de Geclisa. Por favor reintenta.')
      }
    } catch (err: any) {
      setErrorTurnos(err?.message || 'Error de conexión o tiempo de espera al consultar Geclisa.')
    } finally {
      setLoadingTurnos(false)
    }
  }

  // Recarga ÚNICAMENTE cuando cambia el paso, la fecha, el segmento o los días de recetas
  useEffect(() => {
    if (step === 2) {
      fetchAudienciaGeclisa(fechaTurnoFiltro, campSegmento, diasRecetasFiltro)
    }
  }, [step, fechaTurnoFiltro, campSegmento, diasRecetasFiltro])

  // Filtrado Instantáneo en Memoria (0 ms y SIN perder selecciones previas)
  const turnosFiltrados = useMemo(() => {
    return turnosGeclisa.filter((t) => {
      if (ubicacionFiltroId !== 'TODAS') {
        const uMatch =
          t.ubicacion_id === ubicacionFiltroId ||
          (t.ubicacion && t.ubicacion.toLowerCase().includes(ubicacionFiltroId.toLowerCase()))
        if (!uMatch) return false
      }
      if (servicioFiltroId !== 'TODOS') {
        const sMatch =
          t.servicio_id === servicioFiltroId ||
          (t.servicio && t.servicio.toLowerCase().includes(servicioFiltroId.toLowerCase()))
        if (!sMatch) return false
      }
      if (prestadorFiltroId !== 'TODOS') {
        if (t.prestador_id !== prestadorFiltroId) return false
      }
      if (searchPaciente.trim()) {
        const s = searchPaciente.toLowerCase()
        return (
          t.paciente_nombre.toLowerCase().includes(s) ||
          t.dni.includes(s) ||
          t.telefono.includes(s) ||
          t.prestador_nombre.toLowerCase().includes(s) ||
          (t.ubicacion && t.ubicacion.toLowerCase().includes(s)) ||
          (t.servicio && t.servicio.toLowerCase().includes(s)) ||
          (t.practica && t.practica.toLowerCase().includes(s)) ||
          (t.servicio_practica && t.servicio_practica.toLowerCase().includes(s)) ||
          t.obra_social.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [turnosGeclisa, ubicacionFiltroId, servicioFiltroId, prestadorFiltroId, searchPaciente])

  // Operaciones de Selección Persistente
  const toggleSeleccionarPaciente = (turnoId: string) => {
    setSelectedTurnoIds((prev) => {
      const next = new Set(prev)
      if (next.has(turnoId)) next.delete(turnoId)
      else next.add(turnoId)
      return next
    })
  }

  const toggleSeleccionarTodosAptos = (seleccionar: boolean) => {
    setSelectedTurnoIds((prev) => {
      const next = new Set(prev)
      turnosFiltrados.forEach((p) => {
        if (p.estado_envio === 'ELEGIBLE') {
          if (seleccionar) next.add(p.turno_id)
          else next.delete(p.turno_id)
        }
      })
      return next
    })
  }

  const seleccionarSoloSedeCentral = () => {
    setSelectedTurnoIds((prev) => {
      const next = new Set(prev)
      turnosGeclisa.forEach((p) => {
        if (p.estado_envio === 'ELEGIBLE') {
          const esCentral = (p.ubicacion || '').includes('540') || p.ubicacion_id === '3'
          if (esCentral) next.add(p.turno_id)
          else next.delete(p.turno_id)
        }
      })
      return next
    })
  }

  const seleccionarSoloConsultas = () => {
    setSelectedTurnoIds((prev) => {
      const next = new Set(prev)
      turnosGeclisa.forEach((p) => {
        if (p.estado_envio === 'ELEGIBLE') {
          const esConsulta =
            (p.servicio || '').toUpperCase().includes('CONSULTA') ||
            (p.servicio_practica || '').toUpperCase().includes('CONSULTA')
          if (esConsulta) next.add(p.turno_id)
          else next.delete(p.turno_id)
        }
      })
      return next
    })
  }

  const handleCrearYLanzarCampana = async () => {
    setCreatingCamp(true)
    try {
      const seleccionados = turnosGeclisa.filter(
        (p) => selectedTurnoIds.has(p.turno_id) && p.estado_envio === 'ELEGIBLE'
      )
      const res = await apiFetch('/api/optica-vortix/campanas', {
        method: 'POST',
        body: JSON.stringify({
          nombre: campNombre,
          segmento: campSegmento,
          estrategia: campEstrategia,
          template_name: campTemplate,
          placa_url: campPlacaUrl,
          descuento_texto: campDescuento,
          jitter_min_seg: jitterMin,
          jitter_max_seg: jitterMax,
          lote_max_hora: loteMaxHora,
          destinatarios_seleccionados: seleccionados.map((p) => ({
            telefono: p.telefono,
            paciente_nombre: p.paciente_nombre,
            dni: p.dni,
            obra_social: p.obra_social,
            ficha_id: p.ficha_id,
            codigo_beneficio: p.codigo_beneficio,
            hora_turno: p.hora_turno,
            fecha_turno: p.fecha_turno,
            prestador_nombre: p.prestador_nombre,
            servicio_practica: p.servicio_practica,
          })),
        }),
      })
      if (res.ok) {
        const created = await res.json()
        const campId = created.id || created.campana?.id
        if (campId) {
          await apiFetch(`/api/optica-vortix/campanas/${campId}/lanzar`, { method: 'POST' })
        }
        await loadAll()
        setStep(1)
      }
    } catch {
    } finally {
      setCreatingCamp(false)
    }
  }

  const handleToggleCampana = async (camp: OpticaCampana) => {
    const endpoint =
      camp.estado === 'EN_CURSO'
        ? `/api/optica-vortix/campanas/${camp.id}/pausar`
        : `/api/optica-vortix/campanas/${camp.id}/lanzar`
    await apiFetch(endpoint, { method: 'POST' })
    await loadAll()
  }

  const handleVerDetalleCampana = async (camp: OpticaCampana) => {
    setCampanaDetalleModal(camp)
    setLoadingDestinatarios(true)
    setDestinatariosDetalle([])
    try {
      const res = await apiFetch(`/api/optica-vortix/campanas/${camp.id}`, { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setDestinatariosDetalle(d.destinatarios || d.items || [])
      }
    } catch {
    } finally {
      setLoadingDestinatarios(false)
    }
  }

  const seleccionadosTotal = turnosGeclisa.filter(
    (p) => selectedTurnoIds.has(p.turno_id) && p.estado_envio === 'ELEGIBLE'
  ).length

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <OpticaSubNavHeader />

      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner de Salud Anti-Bloqueo de Meta */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white p-5 border border-emerald-500/30 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-black">
                  Escudo Anti-Bloqueo Meta WhatsApp Cloud API • Activo
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                  Calidad: {salud?.quality_rating || 'GREEN'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Protección automática por Cooldown de 30 días, deduplicación por teléfono familiar, respeto estricto de Opt-Out y freno de emergencia si la calidad pasa a YELLOW/RED.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <p className="text-emerald-300 font-bold">Línea 3 Óptica</p>
              <p className="text-[11px] text-slate-300 font-mono">+54 9 261 568-0272</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-right">
              <p className="text-emerald-300 font-bold">Límite Diario Tier</p>
              <p className="text-[11px] text-slate-300 font-bold">{(salud as any)?.tier || salud?.messaging_limit_tier || 'TIER_1K'} (1.000 msgs/día)</p>
            </div>
          </div>
        </div>

        {/* Wizard Constructor de Campañas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-5">
            {/* Header del Constructor */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-[var(--foreground)]">
                    Constructor de Campañas Anti-Bloqueo Óptica Vortix
                  </h2>
                  <p className="text-xs text-[var(--secondary)]">
                    Diseña envíos promocionales cuidando la reputación de la Línea 3 de Óptica Vortix
                  </p>
                </div>
              </div>

              {/* Indicador de Pasos 1 a 5 */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep(s as any)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                      step === s
                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                        : step > s
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* PASO 1: NOMBRE Y SEGMENTO CLÍNICO */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Paso 1 • Nombre y Segmento Clínico de Geclisa
                </h3>
                <div>
                  <label className="block text-xs font-bold mb-1">Nombre de la Campaña</label>
                  <input
                    type="text"
                    value={campNombre}
                    onChange={(e) => setCampNombre(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Audiencia Objetivo (Con exclusión automática de Opt-Out y Cooldown 30 días)
                  </label>
                  <select
                    value={campSegmento}
                    onChange={(e) => setCampSegmento(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                  >
                    <option value="TURNOS_PROXIMOS_CON_DESCUENTO">
                      📅 Pacientes con Turno de Consultorio Próximo (Voucher Descuento Cortesía)
                    </option>
                    <option value="RECETAS_AEREOS_ULTIMOS_7_DIAS">
                      👓 Pacientes con Indicación de Lentes Aéreos (Últimos 7 a 30 días sin compra)
                    </option>
                    <option value="USUARIOS_LENTES_CONTACTO">
                      👁️ Reposición de Lentes de Contacto y Soluciones
                    </option>
                    <option value="CONTROL_ANUAL_RECETA">
                      🔄 Renovación Anual de Cristales (+12 meses desde última receta)
                    </option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
                  >
                    Siguiente: Seleccionar Pacientes (Geclisa) →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 2: AUDIENCIA Y SELECCIÓN GRANULAR DE PACIENTES */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                      {campSegmento === 'TURNOS_PROXIMOS_CON_DESCUENTO'
                        ? 'Paso 2 • Audiencia y Selección Granular de Pacientes (Geclisa Centrovisión)'
                        : 'Paso 2 • Audiencia Clínica de Pacientes con Receta Oftalmológica (CRM)'}
                    </h3>
                    <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                      {campSegmento === 'TURNOS_PROXIMOS_CON_DESCUENTO'
                        ? 'Filtra por fecha y profesional. Selecciona individualmente o en lote cuidando las protecciones anti-bloqueo.'
                        : 'Pacientes con prescripción oftalmológica reciente sin compra en óptica. Protegidos por Cooldown de 30 días.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchAudienciaGeclisa(fechaTurnoFiltro, campSegmento, diasRecetasFiltro, true)}
                    disabled={loadingTurnos}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw size={13} className={loadingTurnos ? 'animate-spin' : ''} />
                    <span>Actualizar Nómina</span>
                  </button>
                </div>

                {errorTurnos && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="shrink-0 text-rose-500" />
                      <span>{errorTurnos}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchAudienciaGeclisa(fechaTurnoFiltro, campSegmento, diasRecetasFiltro, true)}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition-colors shrink-0"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Filtros de Fecha o Período */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {campSegmento === 'TURNOS_PROXIMOS_CON_DESCUENTO' ? (
                      /* Atajos de Fecha para Turnos */
                      <div className="sm:col-span-7 flex items-center gap-1.5">
                        {(() => {
                          const hoy = getFechaOffsetStr(0)
                          const manana = getFechaOffsetStr(1)
                          const pasado = getFechaOffsetStr(2)
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setFechaTurnoFiltro(hoy)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  fechaTurnoFiltro === hoy
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-[var(--border)] text-[var(--secondary)]'
                                }`}
                              >
                                Hoy
                              </button>
                              <button
                                type="button"
                                onClick={() => setFechaTurnoFiltro(manana)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  fechaTurnoFiltro === manana
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-[var(--border)] text-[var(--secondary)]'
                                }`}
                              >
                                Mañana
                              </button>
                              <button
                                type="button"
                                onClick={() => setFechaTurnoFiltro(pasado)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  fechaTurnoFiltro === pasado
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-[var(--border)] text-[var(--secondary)]'
                                }`}
                              >
                                Pasado
                              </button>
                              <input
                                type="date"
                                value={fechaTurnoFiltro}
                                onChange={(e) => setFechaTurnoFiltro(e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-[var(--border)] font-semibold"
                              />
                            </>
                          )
                        })()}
                      </div>
                    ) : (
                      /* Atajos de Período para Recetas */
                      <div className="sm:col-span-7 flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--secondary)] mr-1 flex items-center gap-1">
                          <Clock size={13} />
                          <span>Período:</span>
                        </span>
                        {[7, 14, 30, 60].map((dias) => (
                          <button
                            key={dias}
                            type="button"
                            onClick={() => setDiasRecetasFiltro(dias)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              diasRecetasFiltro === dias
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-[var(--border)] text-[var(--secondary)]'
                            }`}
                          >
                            {dias}d
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Buscador de Texto */}
                    <div className="sm:col-span-5 relative">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--secondary)]" />
                      <input
                        type="text"
                        placeholder="Buscar paciente, DNI, médico..."
                        value={searchPaciente}
                        onChange={(e) => setSearchPaciente(e.target.value)}
                        className="w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-[var(--border)] font-medium"
                      />
                    </div>
                  </div>

                  {/* Fila 2: Selectores de Sede, Servicio y Prestador (Filtrado Instantáneo en React) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1.5 border-t border-[var(--border)]/60">
                    <div className="sm:col-span-4">
                      <select
                        value={ubicacionFiltroId}
                        onChange={(e) => setUbicacionFiltroId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-[var(--border)] font-semibold truncate"
                      >
                        <option value="TODAS">🏢 Todas las Sedes</option>
                        {ubicacionesDisponibles.map((u) => (
                          <option key={u.id} value={u.id}>
                            🏢 {u.nombre.split('-')[0].trim()} {u.cantidad_turnos !== undefined ? `(${u.cantidad_turnos})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={servicioFiltroId}
                        onChange={(e) => setServicioFiltroId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-[var(--border)] font-semibold truncate"
                      >
                        <option value="TODOS">🩺 Todos los Servicios</option>
                        {serviciosDisponibles.map((s) => (
                          <option key={s.id} value={s.id}>
                            🩺 {s.nombre} {s.cantidad_turnos !== undefined ? `(${s.cantidad_turnos})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={prestadorFiltroId}
                        onChange={(e) => setPrestadorFiltroId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-[var(--border)] font-semibold truncate"
                      >
                        <option value="TODOS">👨‍⚕️ Todos los Profesionales</option>
                        {prestadoresDisponibles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.cantidad_turnos !== undefined ? `(${p.cantidad_turnos})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Métricas y Badges de Resumen Anti-Bloqueo */}
                {(() => {
                  const aptos = turnosGeclisa.filter((t) => t.estado_envio === 'ELEGIBLE').length
                  const cooldown = turnosGeclisa.filter((t) => t.estado_envio === 'COOLDOWN_ACTIVO').length
                  const optout = turnosGeclisa.filter((t) => t.estado_envio === 'OPT_OUT').length
                  const sinCel = turnosGeclisa.filter((t) => t.estado_envio === 'SIN_CELULAR').length

                  return (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold">
                        Total en agenda: <strong>{loadingTurnos ? 'Consultando...' : turnosGeclisa.length}</strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                        Aptos para envío: <strong>{loadingTurnos ? '...' : aptos}</strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold">
                        Seleccionados: <strong>{seleccionadosTotal}</strong> de {loadingTurnos ? '...' : aptos}
                      </span>
                      {cooldown > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                          Cooldown 30d: <strong>{cooldown}</strong>
                        </span>
                      )}
                      {optout > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-medium">
                          Opt-Out: <strong>{optout}</strong>
                        </span>
                      )}
                      {sinCel > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-500 font-medium">
                          Sin móvil: <strong>{sinCel}</strong>
                        </span>
                      )}

                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={seleccionarSoloSedeCentral}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-colors"
                          title="Seleccionar únicamente pacientes con turno en Mitre 540"
                        >
                          📍 Solo Mitre 540 (PB)
                        </button>
                        <button
                          type="button"
                          onClick={seleccionarSoloConsultas}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition-colors"
                          title="Seleccionar únicamente consultas oftalmológicas generales y pediátricas"
                        >
                          🩺 Solo Consultas
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSeleccionarTodosAptos(true)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors"
                        >
                          Todos los aptos
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSeleccionarTodosAptos(false)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] hover:bg-slate-200 transition-colors"
                        >
                          Deseleccionar
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Tabla de Pacientes */}
                <div className="border border-[var(--border)] rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                  {loadingTurnos ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[var(--secondary)]">
                      <Loader2 size={24} className="animate-spin text-indigo-600" />
                      <span>
                        {campSegmento === 'TURNOS_PROXIMOS_CON_DESCUENTO'
                          ? 'Consultando agenda de Geclisa Centrovisión...'
                          : 'Consultando prescripciones médicas en Supabase...'}
                      </span>
                    </div>
                  ) : turnosFiltrados.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--secondary)]">
                      No se encontraron pacientes para la fecha y filtros seleccionados.
                    </div>
                  ) : (
                    (() => {
                      const aptosFiltrados = turnosFiltrados.filter((t) => t.estado_envio === 'ELEGIBLE')
                      const todosSeleccionados =
                        aptosFiltrados.length > 0 && aptosFiltrados.every((t) => selectedTurnoIds.has(t.turno_id))

                      return (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 text-[11px] font-black text-[var(--secondary)] border-b border-[var(--border)] z-10">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleSeleccionarTodosAptos(!todosSeleccionados)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:opacity-80"
                                >
                                  {todosSeleccionados ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                              </th>
                              <th className="py-2.5 px-2 w-16">Hora/Fecha</th>
                              <th className="py-2.5 px-3">Paciente & DNI</th>
                              <th className="py-2.5 px-3">WhatsApp / Móvil</th>
                              <th className="py-2.5 px-3">Médico & Práctica</th>
                              <th className="py-2.5 px-3">Sede & Consultorio</th>
                              <th className="py-2.5 px-3">Obra Social</th>
                              <th className="py-2.5 px-3 text-right">Estado Anti-Bloqueo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {turnosFiltrados.map((t) => {
                              const isEligible = t.estado_envio === 'ELEGIBLE'
                              const isSelected = selectedTurnoIds.has(t.turno_id) && isEligible
                              const isCurrentPreview = pacientePreview?.turno_id === t.turno_id

                              return (
                                <tr
                                  key={t.turno_id}
                                  onClick={() => setPacientePreview(t)}
                                  className={`cursor-pointer transition-colors ${
                                    isCurrentPreview
                                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  <td
                                    className="py-2 px-3 text-center"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (isEligible) toggleSeleccionarPaciente(t.turno_id)
                                    }}
                                  >
                                    <button
                                      type="button"
                                      disabled={!isEligible}
                                      className={`transition-opacity ${
                                        !isEligible
                                          ? 'opacity-30 cursor-not-allowed text-slate-400'
                                          : isSelected
                                          ? 'text-indigo-600 dark:text-indigo-400'
                                          : 'text-slate-400 hover:text-slate-600'
                                      }`}
                                    >
                                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                  </td>
                                  <td className="py-2 px-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {t.hora_turno || '--:--'}
                                  </td>
                                  <td className="py-2 px-3">
                                    <p className="font-bold text-[var(--foreground)]">{t.paciente_nombre}</p>
                                    <p className="text-[11px] text-[var(--secondary)] font-mono">DNI: {t.dni || 'S/D'}</p>
                                  </td>
                                  <td className="py-2 px-3 font-mono">
                                    {t.telefono ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        {t.telefono}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic text-[11px]">Sin móvil</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <p className="font-semibold text-[var(--foreground)]">{t.prestador_nombre}</p>
                                    <p className="text-[11px] text-[var(--secondary)] truncate max-w-[170px]" title={t.practica || t.servicio_practica}>
                                      {t.practica || t.servicio_practica}
                                    </p>
                                  </td>
                                  <td className="py-2 px-3">
                                    <p className="text-[11px] text-[var(--foreground)] font-medium truncate max-w-[150px]" title={t.ubicacion}>
                                      {t.ubicacion || 'Mitre 540'}
                                    </p>
                                    <p className="text-[10px] text-[var(--secondary)]">{t.consultorio || 'Consultorio'}</p>
                                  </td>
                                  <td className="py-2 px-3 text-[11px] text-[var(--secondary)] truncate max-w-[120px]" title={t.obra_social}>
                                    {t.obra_social || 'Particular'}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {(() => {
                                      const isWlTest = t.telefono && (
                                        t.telefono.includes('2614703230') || 
                                        t.telefono.endsWith('4703230') ||
                                        t.telefono.includes('5492614703230')
                                      );
                                      if (isWlTest) {
                                        return (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs" title="Teléfono de prueba exento de Cooldown (Whitelist Desarrollador)">
                                            ✓ APTO (Whitelist Test)
                                          </span>
                                        );
                                      }
                                      if (isEligible) {
                                        return (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            ✓ APTO
                                          </span>
                                        );
                                      }
                                      if (t.estado_envio === 'COOLDOWN_ACTIVO') {
                                        return (
                                          <span
                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                            title={t.motivo_exclusion || 'Ya contactado en los últimos 30 días'}
                                          >
                                            Cooldown 30d
                                          </span>
                                        );
                                      }
                                      if (t.estado_envio === 'OPT_OUT') {
                                        return (
                                          <span
                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                            title={t.motivo_exclusion || 'Opt-Out solicitado'}
                                          >
                                            Opt-Out
                                          </span>
                                        );
                                      }
                                      return (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                                          Sin Celular
                                        </span>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )
                    })()
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={seleccionadosTotal === 0}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                  >
                    Siguiente: Estrategia & Plantilla (Paso 3) →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 3: ESTRATEGIA, PLANTILLA META Y SUBIDA DIRECTA DE PLACA */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Paso 3 • Estrategia Anti-Bloqueo, Plantilla Meta y Placa Gráfica
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCampEstrategia('DOBLE_PASO')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      campEstrategia === 'DOBLE_PASO'
                        ? 'border-indigo-600 bg-indigo-500/10'
                        : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-xs font-black block">
                      🛡️ Estrategia Doble Paso (Recomendada)
                    </span>
                    <span className="text-[11px] text-[var(--secondary)]">
                      Envía plantilla breve con botones rápidos; cuando el paciente pulsa &ldquo;Quiero mi voucher&rdquo;, envía la placa HD sin costo adicional.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampEstrategia('DIRECTA_IMAGEN')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      campEstrategia === 'DIRECTA_IMAGEN'
                        ? 'border-indigo-600 bg-indigo-500/10'
                        : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-xs font-black block">
                      🖼️ Plantilla Directa con Header de Imagen
                    </span>
                    <span className="text-[11px] text-[var(--secondary)]">
                      Envía la placa promocional de descuento en el encabezado del primer mensaje.
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Plantilla Oficial Meta</label>
                    <select
                      value={campTemplate}
                      onChange={(e) => setCampTemplate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold text-[var(--foreground)]"
                    >
                      {plantillas.length > 0 ? (
                        plantillas.map((p) => {
                          const badge =
                            p.status === 'APPROVED'
                              ? '✓ Aprobada'
                              : p.status === 'PENDING'
                              ? '⏳ En Revisión'
                              : p.status === 'REJECTED'
                              ? '✕ Rechazada'
                              : '⚙️ Sin aprovisionar'
                          return (
                            <option key={p.name} value={p.name}>
                              {p.titulo_amigable || p.name} ({badge})
                            </option>
                          )
                        })
                      ) : (
                        <>
                          <option value="vortix_beneficio_turno_v1">
                            Óptica Vortix • Voucher Descuento por Turno (✓ Base Oficial)
                          </option>
                          <option value="vortix_receta_lentes_aereos_v1">
                            Óptica Vortix • Cotización Receta Lentes Aéreos (✓ Base Oficial)
                          </option>
                          <option value="vortix_receta_lentes_contacto_v1">
                            Óptica Vortix • Lentes de Contacto y Adaptación (✓ Base Oficial)
                          </option>
                          <option value="vortix_lentes_listos_retiro_v1">
                            Óptica Vortix • Aviso de Lentes Listos para Retirar (✓ Base Oficial)
                          </option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Beneficio / Voucher</label>
                    <input
                      type="text"
                      value={campDescuento}
                      onChange={(e) => setCampDescuento(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                    />
                  </div>
                </div>

                {/* Subida Directa de Placa con Drag & Drop en Paso 3 */}
                <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)]">
                        Placa Gráfica Promocional (Supabase Storage)
                      </label>
                      <p className="text-[11px] text-[var(--secondary)]">
                        Selecciona una placa existente o arrastra una nueva imagen desde tu PC aquí mismo.
                      </p>
                    </div>
                  </div>

                  {/* Input File oculto para Paso 3 */}
                  <input
                    type="file"
                    ref={step3FileInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleStep3UploadFile(f)
                    }}
                  />

                  {/* Zona Drag & Drop Paso 3 */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setStep3IsDragging(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setStep3IsDragging(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setStep3IsDragging(false)
                      const f = e.dataTransfer.files?.[0]
                      if (f) handleStep3UploadFile(f)
                    }}
                    onClick={() => step3FileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      step3IsDragging
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40'
                        : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                        {uploadingStep3Placa ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-[var(--foreground)]">
                          {uploadingStep3Placa
                            ? 'Subiendo imagen a Supabase Storage...'
                            : 'Arrastra una placa aquí o haz clic para subir desde tu PC'}
                        </p>
                        <p className="text-[10px] text-[var(--secondary)]">
                          Formatos: PNG, JPG, WEBP. Se guardará en la galería y se aplicará de inmediato.
                        </p>
                      </div>
                    </div>
                  </div>

                  {step3UploadFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        step3UploadFeedback.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      }`}
                    >
                      {step3UploadFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      <span>{step3UploadFeedback.text}</span>
                    </div>
                  )}

                  {/* Selector Rápido de Placas Guardadas */}
                  {placas.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      {placas.slice(0, 8).map((pl) => {
                        const isSelected = campPlacaUrl === pl.url_imagen
                        return (
                          <div
                            key={pl.id}
                            onClick={() => setCampPlacaUrl(pl.url_imagen)}
                            className={`cursor-pointer rounded-xl border p-2 text-left transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 ring-2 ring-indigo-500/40'
                                : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40 hover:border-slate-400'
                            }`}
                          >
                            <div className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden mb-1.5 flex items-center justify-center">
                              <img src={pl.url_imagen} alt={pl.titulo} className="h-full w-full object-cover" />
                            </div>
                            <p className="text-[11px] font-bold truncate text-[var(--foreground)]">{pl.titulo}</p>
                            <span className="text-[9px] text-[var(--secondary)]">{pl.categoria || 'VOUCHER'}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {campPlacaUrl && (
                    <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="truncate max-w-[280px]">✓ Placa activa seleccionada</span>
                      <button
                        type="button"
                        onClick={() => setCampPlacaUrl('')}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-bold"
                      >
                        Quitar placa
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
                  >
                    ← Anterior (Paso 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    Siguiente: Cadencia & Jitter (Paso 4) →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 4: CADENCIA Y JITTER */}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Paso 4 • Configuración de Goteo, Jitter Aleatorio y Ventana Horaria
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Jitter Mínimo (seg)</label>
                    <input
                      type="number"
                      value={jitterMin}
                      onChange={(e) => setJitterMin(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Jitter Máximo (seg)</label>
                    <input
                      type="number"
                      value={jitterMax}
                      onChange={(e) => setJitterMax(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Máx. Mensajes / Hora</label>
                    <input
                      type="number"
                      value={loteMaxHora}
                      onChange={(e) => setLoteMaxHora(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
                  >
                    ← Anterior (Paso 3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    Siguiente: Confirmar y Lanzar (Paso 5) →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 5: RESUMEN Y LANZAMIENTO */}
            {step === 5 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-emerald-600">
                  Paso 5 • Resumen de Protección y Lanzamiento
                </h3>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border)] text-xs space-y-2">
                  <p>
                    <strong>Campaña:</strong> {campNombre}
                  </p>
                  <p>
                    <strong>Segmento:</strong> {campSegmento}
                  </p>
                  <p>
                    <strong>Destinatarios Seleccionados:</strong>{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      {seleccionadosTotal} pacientes
                    </span>{' '}
                    {campSegmento === 'TURNOS_PROXIMOS_CON_DESCUENTO'
                      ? `para la fecha ${formatDateArg(fechaTurnoFiltro)}.`
                      : `del período de recetas (${diasRecetasFiltro} días).`}
                  </p>
                  <p>
                    <strong>Estrategia:</strong> {campEstrategia} ({campTemplate})
                  </p>
                  <p>
                    <strong>Cadencia Humanizada:</strong> 1 envío cada {jitterMin}s–{jitterMax}s (máx.{' '}
                    {loteMaxHora}/hora en horario comercial 09:00 a 20:00 hs).
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
                  >
                    ← Anterior (Paso 4)
                  </button>
                  <button
                    type="button"
                    onClick={handleCrearYLanzarCampana}
                    disabled={creatingCamp || seleccionadosTotal === 0}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all"
                  >
                    {creatingCamp ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Encolando envíos con protección...</span>
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        <span>Confirmar y Encolar Campaña</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previsualizador de Teléfono WhatsApp (Reactivo) */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-xl flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-emerald-400" />
                <span className="text-xs font-black">Previsualización WhatsApp Paciente</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold truncate max-w-[140px]">
                {campTemplate}
              </span>
            </div>

            {pacientePreview && (
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-300">
                <span className="truncate max-w-[170px] font-bold text-emerald-300">
                  👤 {pacientePreview.paciente_nombre}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {pacientePreview.hora_turno ? `Turno: ${pacientePreview.hora_turno} hs` : ''}
                </span>
              </div>
            )}

            <div className="bg-[#0b141a] rounded-2xl p-3.5 space-y-2.5 text-xs border border-slate-800/80">
              {campPlacaUrl ? (
                <div className="rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 max-h-44 flex items-center justify-center relative shadow-inner">
                  <img
                    src={campPlacaUrl}
                    alt="Preview Placa WhatsApp"
                    className="max-h-44 w-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-[10px] text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                    <ImageIcon size={10} className="text-emerald-400" />
                    <span>Encabezado HD</span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-center">
                  <span className="text-[11px] text-slate-400 italic">
                    ⚠️ Mensaje sin placa gráfica adjunta (Envío solo texto)
                  </span>
                </div>
              )}
              <div className="bg-[#005c4b] text-white rounded-xl p-3 space-y-1.5 text-[11px] leading-relaxed">
                {(() => {
                  const tpl = plantillas.find((p) => p.name === campTemplate)
                  const nombreVisual = pacientePreview?.paciente_nombre
                    ? pacientePreview.paciente_nombre.split(' ')[0]
                    : 'María'
                  const voucherCodigo = pacientePreview?.codigo_beneficio || '#VORTIX-20OFF'

                  if (!tpl?.body_text) {
                    return (
                      <>
                        <p>
                          ¡Hola <strong>{nombreVisual}</strong>! 👋 Te escribimos de <strong>Óptica Vortix</strong> (en Planta Baja de la clínica).
                        </p>
                        <p>
                          Por tu atención en el centro contás con un voucher exclusivo:{' '}
                          <strong>{campDescuento}</strong> código <strong>{voucherCodigo}</strong>.
                        </p>
                      </>
                    )
                  }
                  const isRetiro = campTemplate.includes('retiro') || campTemplate.includes('listos')
                  const isContacto = campTemplate.includes('contacto')
                  const prestadorVisual = pacientePreview?.prestador_nombre || 'el Dr. Arago'
                  const turnoVisual = pacientePreview?.hora_turno
                    ? `tu turno de las ${pacientePreview.hora_turno} hs`
                    : 'esta semana'

                  let preview = tpl.body_text
                    .replace(/\{\{1\}\}/g, nombreVisual)
                    .replace(/\{\{2\}\}/g, isRetiro ? 'anteojos monofocales' : isContacto ? prestadorVisual : turnoVisual)
                    .replace(/\{\{3\}\}/g, isRetiro ? '09:00 a 19:30 hs' : isContacto ? '#VORTIX-LC' : campDescuento)
                    .replace(/\{\{4\}\}/g, voucherCodigo)

                  return (
                    <div className="space-y-1 whitespace-pre-line">
                      {preview}
                    </div>
                  )
                })()}
              </div>

              {(() => {
                const tpl = plantillas.find((p) => p.name === campTemplate)
                if (tpl?.buttons && Array.isArray(tpl.buttons) && tpl.buttons.length > 0) {
                  return (
                    <div className="grid grid-cols-1 gap-1 pt-1">
                      {tpl.buttons.map((btn: any, bIdx: number) => {
                        const btnText = typeof btn === 'string' ? btn : btn.text || `Opción ${bIdx + 1}`
                        const isOptOut =
                          btnText.toLowerCase().includes('baja') ||
                          btnText.toLowerCase().includes('no recibir')
                        return (
                          <div
                            key={bIdx}
                            className={`py-1.5 text-center rounded-lg font-bold text-[11px] ${
                              isOptOut
                                ? 'bg-[#202c33] text-slate-400 text-[10px]'
                                : 'bg-[#202c33] text-cyan-400'
                            }`}
                          >
                            {btnText}
                          </div>
                        )
                      })}
                    </div>
                  )
                }
                return (
                  <div className="grid grid-cols-1 gap-1 pt-1">
                    <div className="py-1.5 text-center rounded-lg bg-[#202c33] text-cyan-400 font-bold text-[11px]">
                      🎟️ Quiero mi voucher de descuento
                    </div>
                    <div className="py-1.5 text-center rounded-lg bg-[#202c33] text-cyan-400 font-bold text-[11px]">
                      🕶️ Cotizar mi receta por WhatsApp
                    </div>
                    <div className="py-1.5 text-center rounded-lg bg-[#202c33] text-slate-400 font-semibold text-[10px]">
                      No recibir avisos de óptica
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Widget Disparo Inmediato de Prueba (Opción 1 & 2: Whitelist) */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Send size={14} className="text-emerald-400" />
                  <span className="text-xs font-black text-white">Disparar WhatsApp de Prueba</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold">
                  🛡️ Whitelist Test
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Envía esta plantilla con su placa HD al instante a tu celular para verificar la recepción real. <strong>Exento de la regla de Cooldown de 30 días</strong>.
              </p>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={telefonoPrueba}
                      onChange={(e) => setTelefonoPrueba(e.target.value)}
                      placeholder="2614703230"
                      className="w-full bg-[#0b141a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-bold">MZA</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnviarPrueba}
                    disabled={enviandoPrueba || !telefonoPrueba.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-900/30 disabled:opacity-50 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    {enviandoPrueba ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Enviar Prueba</span>
                      </>
                    )}
                  </button>
                </div>

                {pruebaFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] leading-tight flex items-start gap-2 border ${
                      pruebaFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <span className="text-sm">{pruebaFeedback.type === 'success' ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <p className="font-semibold">{pruebaFeedback.text}</p>
                      {pruebaFeedback.type === 'success' && (
                        <p className="text-[10px] text-emerald-400/80 mt-0.5">
                          Revisá tu WhatsApp en {telefonoPrueba}. El mensaje fue enviado con éxito desde la Línea 3 de Óptica Vortix (+54 9 261 568-0272).
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Galería de Placas Gráficas Promocionales + Subida Real desde PC */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div>
              <h3 className="text-sm font-black text-[var(--foreground)] flex items-center gap-2">
                <ImageIcon size={18} className="text-amber-500" />
                Galería de Placas Gráficas Promocionales (Supabase Storage)
              </h3>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Sube imágenes HD desde tu PC y úsalas en campañas masivas, automatizaciones de turnos o en el chat directo
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              {placas.length} {placas.length === 1 ? 'placa guardada' : 'placas guardadas'}
            </span>
          </div>

          {/* Zona de Subida Real desde PC con Drag & Drop y Previsualización */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-2xl p-4 space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                    <Upload size={22} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-[var(--foreground)]">
                      📁 Elegir Imagen de mi PC <span className="font-normal text-[var(--secondary)]">o arrastra y suelta aquí</span>
                    </p>
                    <p className="text-[11px] text-[var(--secondary)]">
                      Formatos soportados: PNG, JPG, JPEG, WEBP (hasta 10 MB). Subida directa a Supabase Storage bucket.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <FileImage size={15} />
                    <span>Imagen seleccionada lista para subir</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelectedFile}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Descartar archivo"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-3">
                    {filePreviewUrl && (
                      <div className="h-28 w-full rounded-xl overflow-hidden bg-slate-900 border border-[var(--border)] flex items-center justify-center shadow-xs relative">
                        <img
                          src={filePreviewUrl}
                          alt="Previsualización"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-6 space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1">
                        Título de la Placa Promocional *
                      </label>
                      <input
                        type="text"
                        value={nuevaPlacaTitulo}
                        onChange={(e) => setNuevaPlacaTitulo(e.target.value)}
                        placeholder="Ej: Voucher 20% OFF Turnos Mitre 540"
                        className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-[var(--border)] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1">
                        Categoría de Uso
                      </label>
                      <select
                        value={nuevaPlacaCat}
                        onChange={(e) => setNuevaPlacaCat(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-[var(--border)] font-semibold"
                      >
                        <option value="VOUCHER_TURNO">🎟️ Voucher Descuento por Turno</option>
                        <option value="RECETA_AEREOS">👓 Prescripción Cristales y Armazones</option>
                        <option value="LENTES_CONTACTO">👁️ Lentes de Contacto y Soluciones</option>
                        <option value="ANTEOJOS_LISTOS">✅ Lentes Listos para Retirar</option>
                        <option value="INSTITUCIONAL">🏥 Institucional Óptica Vortix</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-3 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleUploadNuevaPlaca}
                      disabled={uploadingPlaca}
                      className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                    >
                      {uploadingPlaca ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Subiendo a Storage...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={15} />
                          <span>🚀 Subir a Storage</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelectedFile}
                      disabled={uploadingPlaca}
                      className="w-full px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {uploadFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
                  uploadFeedback.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  {uploadFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{uploadFeedback.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadFeedback(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Grilla de Placas en Galería */}
          {placas.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-2xl">
              <ImageIcon size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
              <p className="font-bold text-[var(--foreground)]">No hay placas promocionales guardadas</p>
              <p className="text-[11px] mt-0.5">Sube la primera placa desde tu PC para comenzar a usarla en las campañas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {placas.map((pl) => {
                const isSelected = campPlacaUrl === pl.url_imagen
                const isDeleting = deletingPlacaId === pl.id
                return (
                  <div
                    key={pl.id}
                    onClick={() => setCampPlacaUrl(pl.url_imagen)}
                    className={`group cursor-pointer rounded-2xl border p-3.5 transition-all flex flex-col justify-between gap-2.5 relative ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 ring-2 ring-indigo-500/30 shadow-md'
                        : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-xs'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleDeletePlaca(e, pl)}
                      disabled={isDeleting}
                      title="Eliminar placa promocional"
                      className="absolute top-5 right-5 z-10 w-7 h-7 rounded-lg bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all shadow-sm"
                    >
                      {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>

                    <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center relative">
                      <img
                        src={pl.url_imagen}
                        alt={pl.titulo}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {isSelected && (
                        <div className="absolute bottom-2 left-2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                          <Check size={11} strokeWidth={3} />
                          <span>Activa en Campaña</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-black truncate text-[var(--foreground)]" title={pl.titulo}>
                        {pl.titulo}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[var(--secondary)]">
                        <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 font-medium">
                          {pl.categoria || 'VOUCHER'}
                        </span>
                        {isSelected && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-[11px]">
                            ✓ Seleccionada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Historial y Embudo en Vivo de Campañas de Óptica */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-black text-[var(--foreground)] flex items-center gap-2">
                <Megaphone size={18} className="text-indigo-600" />
                Historial y Embudo en Vivo de Campañas de Óptica
              </h3>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Seguimiento en tiempo real de envíos, tasas de entrega, lecturas y conversiones por WhatsApp
              </p>
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Actualizar Embudo</span>
            </button>
          </div>

          {campanas.length === 0 ? (
            <p className="text-xs text-[var(--secondary)] py-4 text-center">
              Aún no se han lanzado campañas masivas. Usa el constructor de arriba para iniciar una.
            </p>
          ) : (
            <div className="space-y-3">
              {campanas.map((c) => {
                const tot = c.total_audiencia || (c as any).destinatarios_count || 1
                const env = c.enviados ?? 0
                const pctEnv = Math.min(100, Math.round((env / tot) * 100))
                const leidos = c.leidos ?? 0
                const resp = c.respondidos ?? 0

                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800/40 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm text-[var(--foreground)]">{c.nombre}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              c.estado === 'EN_CURSO'
                                ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 animate-pulse'
                                : c.estado === 'COMPLETADA'
                                ? 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30'
                                : 'bg-slate-200 dark:bg-slate-700 text-[var(--secondary)]'
                            }`}
                          >
                            {c.estado}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                          Segmento: <strong>{c.segmento || 'TURNOS'}</strong> • Plantilla:{' '}
                          <code className="text-indigo-600 dark:text-indigo-400 font-mono text-[10px]">{c.template_name}</code> •{' '}
                          Creada: {formatDateArg(c.created_at || (c as any).fecha_creacion || '')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleVerDetalleCampana(c)}
                          className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                        >
                          <Eye size={13} />
                          <span>Ver Destinatarios</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCampana(c)}
                          className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors ${
                            c.estado === 'EN_CURSO'
                              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {c.estado === 'EN_CURSO' ? <Pause size={13} /> : <Play size={13} />}
                          <span>{c.estado === 'EN_CURSO' ? 'Pausar' : 'Reanudar'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Barra de Progreso y Métricas de Conversión */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--border)]/60 items-center">
                      <div className="sm:col-span-2 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold text-[var(--secondary)]">
                            Progreso de Envío: {env} de {tot} ({pctEnv}%)
                          </span>
                          <span className="font-mono text-[10px] text-[var(--secondary)]">
                            Jitter: {c.jitter_min_seg || 15}s–{c.jitter_max_seg || 35}s
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                            style={{ width: `${pctEnv}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-center gap-4 text-center">
                        <div>
                          <p className="text-[10px] text-[var(--secondary)] font-bold">Leídos</p>
                          <p className="text-xs font-black text-cyan-600 dark:text-cyan-400">{leidos}</p>
                        </div>
                        <div className="h-6 w-px bg-[var(--border)]" />
                        <div>
                          <p className="text-[10px] text-[var(--secondary)] font-bold">Respondieron</p>
                          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{resp}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[var(--secondary)] block">Estrategia</span>
                        <span className="font-bold text-[11px] text-[var(--foreground)]">
                          {(c as any).estrategia_envio === 'template_directo' || c.estrategia === 'DIRECTA_IMAGEN' ? 'Directa con Placa' : 'Doble Paso'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal de Detalle de Destinatarios de Campaña */}
        {campanaDetalleModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)] flex items-center gap-2">
                    <Users size={17} className="text-indigo-600" />
                    Destinatarios de la Campaña: {campanaDetalleModal.nombre}
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                    Plantilla: {campanaDetalleModal.template_name} • Estado: {campanaDetalleModal.estado}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCampanaDetalleModal(null)}
                  className="p-1.5 rounded-xl border border-[var(--border)] hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto border border-[var(--border)] rounded-2xl">
                {loadingDestinatarios ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[var(--secondary)]">
                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                    <span>Cargando destinatarios y estados de entrega...</span>
                  </div>
                ) : destinatariosDetalle.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[var(--secondary)]">
                    No se registraron envíos en cola para esta campaña aún.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 text-[11px] font-black text-[var(--secondary)] border-b border-[var(--border)]">
                      <tr>
                        <th className="py-2.5 px-3">WhatsApp</th>
                        <th className="py-2.5 px-3">Programado Para</th>
                        <th className="py-2.5 px-3">Estado Envío</th>
                        <th className="py-2.5 px-3">Enviado En</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {destinatariosDetalle.map((d, dIdx) => (
                        <tr key={d.id || dIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {d.telefono}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-[var(--secondary)] font-mono">
                            {d.programado_para ? d.programado_para.replace('T', ' ').slice(0, 19) : '--'}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                d.estado === 'enviado'
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : d.estado === 'leido'
                                  ? 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30'
                                  : d.estado === 'pendiente'
                                  ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                              }`}
                            >
                              {d.estado}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-[var(--secondary)] font-mono">
                            {d.enviado_at ? d.enviado_at.replace('T', ' ').slice(0, 19) : 'Pendiente'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCampanaDetalleModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
