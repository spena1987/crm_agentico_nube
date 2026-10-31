'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Pill,
  Send,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Stethoscope,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  Layers,
  FileCheck2,
  History,
  ArrowLeft,
  Share2,
  Edit2,
  X,
  Save,
  Download,
  Calendar
} from 'lucide-react'
import { BACKEND_URL as API_BASE_URL } from '@/lib/api'

interface SeccionIndicacionesExpedienteProps {
  asesoriaId?: string | null
  practicaNombre?: string | null
  practicaCodigo?: string | null
  practicaId?: string | null
  medicoNombre?: string | null
  medicoId?: number | string | null
  pacienteNombre?: string | null
  pacienteTelefono?: string | null
  pacienteDni?: string | null
  pacienteObraSocial?: string | null
  pacienteAfiliado?: string | null
  pacienteDomicilio?: string | null
  indicacionGeclisaImId?: number | null
  indicacionesEmitidasAt?: string | null
  indicacionesPdfUrl?: string | null
  fechaCirugia?: string | null
  desplegadoInicial?: boolean
  onIndicacionEmitida?: (resultado: any) => void
}

export default function SeccionIndicacionesExpediente({
  asesoriaId,
  practicaNombre,
  practicaCodigo,
  practicaId,
  medicoNombre,
  medicoId,
  pacienteNombre,
  pacienteTelefono,
  pacienteDni,
  pacienteObraSocial,
  pacienteAfiliado,
  pacienteDomicilio,
  indicacionGeclisaImId,
  indicacionesEmitidasAt,
  indicacionesPdfUrl,
  fechaCirugia,
  desplegadoInicial = false,
  onIndicacionEmitida
}: SeccionIndicacionesExpedienteProps) {
  const [desplegado, setDesplegado] = useState<boolean>(desplegadoInicial)
  const [resolviendo, setResolviendo] = useState<boolean>(false)
  const [emitiendo, setEmitiendo] = useState<boolean>(false)
  
  // Historial de emisiones acumuladas en el expediente
  const [historialEmisiones, setHistorialEmisiones] = useState<any[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(false)
  const [modoVista, setModoVista] = useState<'historial' | 'formulario'>('formulario')
  
  // Categoría del documento a emitir
  const [tipoDocumento, setTipoDocumento] = useState<string>('orden_medica')
  const [tituloDocumento, setTituloDocumento] = useState<string>('ORDEN MÉDICA DE PROCEDIMIENTO')
  
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<any>(null)
  const [textoIndicaciones, setTextoIndicaciones] = useState<string>('')
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [cuidadosGenerales, setCuidadosGenerales] = useState<string>('')
  const [pautasAlarma, setPautasAlarma] = useState<string>('')
  
  // Módulos activos para asignaciones 1 a N del Nomenclador
  const [modulosSeleccionadosIds, setModulosSeleccionadosIds] = useState<string[]>([])
  
  const [geclisaImId, setGeclisaImId] = useState<number | null>(indicacionGeclisaImId || null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(indicacionesPdfUrl || null)
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null)
  
  const [modalPreviewOpen, setModalPreviewOpen] = useState<boolean>(false)
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(null)
  const [generandoPreview, setGenerandoPreview] = useState<boolean>(false)
  
  // Fecha de Emisión del Documento (permite posfechar a fecha de cirugía o libre)
  const [fechaEmision, setFechaEmision] = useState<string>(() => new Date().toISOString().slice(0, 10))

  // Estado para reenviar WhatsApp
  const [reenviandoWaId, setReenviandoWaId] = useState<string | null>(null)
  
  // Modal de reedición
  const [modalReedicionOpen, setModalReedicionOpen] = useState<boolean>(false)
  const [emisionParaReeditar, setEmisionParaReeditar] = useState<any | null>(null)
  const [textoReedicion, setTextoReedicion] = useState<string>('')
  const [fechaReedicion, setFechaReedicion] = useState<string>('')
  const [reenviarWaReedicion, setReenviarWaReedicion] = useState<boolean>(true)
  const [guardandoReedicion, setGuardandoReedicion] = useState<boolean>(false)
  
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)

  const [localAfiliado, setLocalAfiliado] = useState<string>(pacienteAfiliado || '')
  const [localDomicilio, setLocalDomicilio] = useState<string>(pacienteDomicilio || '')

  // 1. Cargar datos demográficos si faltan
  useEffect(() => {
    if (pacienteAfiliado && pacienteAfiliado !== '-') setLocalAfiliado(pacienteAfiliado)
    if (pacienteDomicilio && pacienteDomicilio !== '-') setLocalDomicilio(pacienteDomicilio)

    if ((!pacienteAfiliado || pacienteAfiliado === '-' || !pacienteDomicilio || pacienteDomicilio === '-') && asesoriaId) {
      import('@/lib/supabase').then(({ supabase }) => {
        supabase
          .from('asesorias_quirurgicas')
          .select('*, pacientes(*)')
          .eq('id', asesoriaId)
          .maybeSingle()
          .then(({ data }) => {
            const pac = data?.pacientes as any
            if (pac) {
              if (pac.nro_afiliado || pac.numero_afiliado) setLocalAfiliado(pac.nro_afiliado || pac.numero_afiliado)
              if (pac.direccion || pac.domicilio) setLocalDomicilio(pac.direccion || pac.domicilio)
            }
          })
      })
    }
  }, [pacienteAfiliado, pacienteDomicilio, asesoriaId])

  // 2. Cargar historial de emisiones para este expediente quirúrgico
  const cargarHistorial = useCallback(async () => {
    if (!asesoriaId) return
    setCargandoHistorial(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/expediente-quirurgico/${asesoriaId}/historial-indicaciones`)
      if (res.ok) {
        const data = await res.json()
        const items = data.emisiones || []
        setHistorialEmisiones(items)
        // Si ya hay emisiones registradas, mostrar la vista de historial de forma predeterminada
        if (items.length > 0) {
          setModoVista('historial')
        }
      }
    } catch (e) {
      console.error('Error cargando historial de emisiones del expediente:', e)
    } finally {
      setCargandoHistorial(false)
    }
  }, [asesoriaId])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])
  
  // 3. Catálogos Geclisa y CRM
  const [plantillasCatalogoGeclisa, setPlantillasCatalogoGeclisa] = useState<any[]>([])
  const [plantillasCrm, setPlantillasCrm] = useState<any[]>([])

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/indicaciones/plantillas-geclisa`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setPlantillasCatalogoGeclisa(d.plantillas || []) })
      .catch((e) => console.error('Error cargando catalogo Geclisa:', e))

    fetch(`${API_BASE_URL}/api/indicaciones/plantillas`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setPlantillasCrm(d.plantillas || []) })
      .catch((e) => console.error('Error cargando biblioteca CRM:', e))
  }, [])

  // 4. Resolver sugerencia inteligente cuando cambia la práctica o el cirujano
  const resolverSugerencia = useCallback(async () => {
    if (!practicaNombre && !medicoNombre && !practicaCodigo && !practicaId) return
    setResolviendo(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/resolver-sugerencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practica_nombre: practicaNombre,
          practica_codigo: practicaCodigo,
          practica_id: practicaId,
          medico_nombre: medicoNombre
        })
      })

      if (res.ok) {
        const data = await res.json()
        const sug = data.sugerencia
        if (sug) {
          setPlantillaSeleccionada(sug)
          const txt = sug.texto_indicaciones || sug.cuerpo_indicaciones || ''
          setTextoIndicaciones(txt)
          setMedicamentos(sug.medicamentos || [])
          setCuidadosGenerales(sug.cuidados_generales || '')
          setPautasAlarma(sug.pautas_alarma || '')

          // Auto-detectar categoría
          const txtL = txt.toLowerCase()
          if (txtL.includes('certifico') || txtL.includes('certificado')) {
            setTipoDocumento('certificado')
            setTituloDocumento('CERTIFICADO MÉDICO')
          } else if (txtL.includes('solicito:') || txtL.includes('solicito ') || txtL.includes('pedido')) {
            setTipoDocumento('orden_medica')
            setTituloDocumento('ORDEN MÉDICA DE PROCEDIMIENTO')
          } else if (txtL.includes('ayuno') || txtL.includes('preoperatori')) {
            setTipoDocumento('prequirurgico')
            setTituloDocumento('INDICACIONES PREQUIRÚRGICAS')
          } else {
            setTipoDocumento('postquirurgico')
            setTituloDocumento('INDICACIONES POSTQUIRÚRGICAS')
          }

          if (Array.isArray(sug.modulos_asignados) && sug.modulos_asignados.length > 0) {
            setModulosSeleccionadosIds(sug.modulos_asignados.map((m: any) => m.id))
          } else {
            setModulosSeleccionadosIds([])
          }
        } else {
          setPlantillaSeleccionada(null)
          setModulosSeleccionadosIds([])
        }
      }
    } catch (err) {
      console.error('Error resolviendo sugerencia de indicación:', err)
    } finally {
      setResolviendo(false)
    }
  }, [practicaNombre, medicoNombre, practicaCodigo, practicaId])

  useEffect(() => {
    resolverSugerencia()
  }, [resolverSugerencia])

  // Alternar módulos en caso de 1 a N
  const handleToggleModulo = (moduloId: string) => {
    if (!plantillaSeleccionada || !Array.isArray(plantillaSeleccionada.modulos_asignados)) return
    
    let nuevosIds: string[]
    if (modulosSeleccionadosIds.includes(moduloId)) {
      nuevosIds = modulosSeleccionadosIds.filter((id) => id !== moduloId)
    } else {
      nuevosIds = [...modulosSeleccionadosIds, moduloId]
    }
    setModulosSeleccionadosIds(nuevosIds)

    const modulosFiltrados = plantillaSeleccionada.modulos_asignados.filter((m: any) =>
      nuevosIds.includes(m.id)
    )

    const textos = modulosFiltrados.map((m: any) => m.cuerpo_indicaciones).filter(Boolean)
    setTextoIndicaciones(textos.join('\n\n---\n\n'))

    const todosMeds: any[] = []
    modulosFiltrados.forEach((m: any) => {
      ;(m.medicamentos || []).forEach((med: any) => {
        if (!todosMeds.some((x) => x.droga === med.droga)) {
          todosMeds.push(med)
        }
      })
    })
    setMedicamentos(todosMeds)

    const todosCuidados = modulosFiltrados.map((m: any) => m.cuidados_generales).filter(Boolean)
    setCuidadosGenerales(todosCuidados.join('\n'))

    const todasAlarmas = modulosFiltrados.map((m: any) => m.pautas_alarma).filter(Boolean)
    setPautasAlarma(todasAlarmas.join('\n'))
  }

  // Cambio manual de categoría de documento
  const handleCambiarCategoria = (cat: string) => {
    setTipoDocumento(cat)
    if (cat === 'orden_medica') {
      setTituloDocumento('ORDEN MÉDICA DE PROCEDIMIENTO')
      // Buscar primera plantilla de orden o retina si existe
      const p = plantillasCrm.find((x) => x.tipo_fase === 'orden_medica' || x.categoria?.toLowerCase().includes('retina'))
      if (p) handleSelectPlantilla(`crm_${p.id}`)
    } else if (cat === 'prequirurgico') {
      setTituloDocumento('INDICACIONES PREQUIRÚRGICAS')
      const p = plantillasCrm.find((x) => x.tipo_fase === 'prequirurgico' || x.categoria?.toLowerCase().includes('pre'))
      if (p) handleSelectPlantilla(`crm_${p.id}`)
    } else if (cat === 'postquirurgico') {
      setTituloDocumento('INDICACIONES POSTQUIRÚRGICAS')
      const p = plantillasCrm.find((x) => x.tipo_fase === 'postquirurgico' || x.categoria?.toLowerCase().includes('cataratas'))
      if (p) handleSelectPlantilla(`crm_${p.id}`)
    } else if (cat === 'certificado') {
      setTituloDocumento('CERTIFICADO MÉDICO')
      const p = plantillasCrm.find((x) => x.tipo_fase === 'certificado' || x.categoria?.toLowerCase().includes('certificado'))
      if (p) handleSelectPlantilla(`crm_${p.id}`)
    } else {
      setTituloDocumento('INDICACIONES MÉDICAS')
    }
  }

  // Selector unificado agrupado
  const handleSelectPlantilla = (valor: string) => {
    if (valor === 'nomenclador') {
      resolverSugerencia()
      return
    }

    if (valor.startsWith('crm_')) {
      const crmId = valor.replace('crm_', '')
      const match = plantillasCrm.find((p) => p.id === crmId)
      if (match) {
        setPlantillaSeleccionada({
          crm_plantilla_id: match.id,
          titulo: match.titulo,
          texto_indicaciones: match.cuerpo_indicaciones,
          medicamentos: match.medicamentos || [],
          cuidados_generales: match.cuidados_generales || '',
          pautas_alarma: match.pautas_alarma || '',
          origen: 'biblioteca_crm',
          geclisa_pim_id: match.geclisa_pim_id || null
        })
        setTextoIndicaciones(match.cuerpo_indicaciones || '')
        setMedicamentos(match.medicamentos || [])
        setCuidadosGenerales(match.cuidados_generales || '')
        setPautasAlarma(match.pautas_alarma || '')
        setModulosSeleccionadosIds([])

        if (match.tipo_fase) {
          setTipoDocumento(match.tipo_fase)
          if (match.tipo_fase === 'certificado') setTituloDocumento('CERTIFICADO MÉDICO')
          else if (match.tipo_fase === 'prequirurgico') setTituloDocumento('INDICACIONES PREQUIRÚRGICAS')
          else if (match.tipo_fase === 'orden_medica') setTituloDocumento('ORDEN MÉDICA DE PROCEDIMIENTO')
          else setTituloDocumento('INDICACIONES POSTQUIRÚRGICAS')
        }
      }
      return
    }

    if (valor.startsWith('geclisa_')) {
      const pimId = Number(valor.replace('geclisa_', ''))
      const match = plantillasCatalogoGeclisa.find((p) => p.pimId === pimId)
      if (match) {
        setPlantillaSeleccionada({
          geclisa_pim_id: match.pimId,
          titulo: match.pimNombre,
          texto_indicaciones: match.pimTexto,
          medicamentos: [],
          cuidados_generales: '',
          pautas_alarma: '',
          origen: 'geclisa_manual'
        })
        setTextoIndicaciones(match.pimTexto || '')
        setMedicamentos([])
        setCuidadosGenerales('')
        setPautasAlarma('')
        setModulosSeleccionadosIds([])
      }
      return
    }

    if (valor === 'custom') {
      setPlantillaSeleccionada({
        titulo: 'Texto Personalizado Libre',
        origen: 'personalizado'
      })
      setModulosSeleccionadosIds([])
    }
  }

  // Previsualizar PDF con ReportLab
  const handlePreviewPdf = async () => {
    setGenerandoPreview(true)
    try {
      const modulosActivos = (plantillaSeleccionada?.modulos_asignados || []).filter((m: any) =>
        modulosSeleccionadosIds.includes(m.id)
      )

      const fechaParts = fechaEmision ? fechaEmision.split('-') : null
      const fechaFormateada = fechaParts && fechaParts.length === 3 ? `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}` : undefined
      const datosPayload: any = {
        paciente_nombre: pacienteNombre || 'Paciente',
        paciente_dni: pacienteDni || '',
        paciente_obra_social: pacienteObraSocial || '',
        paciente_afiliado: localAfiliado || pacienteAfiliado || '',
        paciente_domicilio: localDomicilio || pacienteDomicilio || '',
        practica_nombre: practicaNombre || 'Cirugía Oftalmológica',
        medico_nombre: medicoNombre || 'Médico Cirujano',
        cuerpo_indicaciones: textoIndicaciones,
        medicamentos: medicamentos,
        cuidados_generales: cuidadosGenerales,
        pautas_alarma: pautasAlarma,
        geclisa_im_id: geclisaImId,
        asesoria_id: asesoriaId,
        tipo_documento: tipoDocumento,
        titulo_documento: tituloDocumento,
        fecha: fechaFormateada,
        fecha_emision: fechaEmision
      }

      if (modulosActivos.length > 0) {
        datosPayload.modulos = modulosActivos
      }

      const res = await fetch(`${API_BASE_URL}/api/indicaciones/preview-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datos_emision: datosPayload,
          asesoria_id: asesoriaId
        })
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setPreviewPdfBlobUrl(url)
        setModalPreviewOpen(true)
      } else {
        setMensajeError('No se pudo generar la previsualización del PDF.')
      }
    } catch (e: any) {
      setMensajeError('Fallo al conectar con el servicio de PDF.')
    } finally {
      setGenerandoPreview(false)
    }
  }

  // Disparo de emisión formal a Geclisa y envío por WhatsApp
  const handleEmitirIndicaciones = async () => {
    if (!asesoriaId) {
      setMensajeError('Debe guardar primero el expediente para poder emitir formalmente en Geclisa.')
      return
    }

    setEmitiendo(true)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const modulosActivos = (plantillaSeleccionada?.modulos_asignados || []).filter((m: any) =>
        modulosSeleccionadosIds.includes(m.id)
      )

      const res = await fetch(`${API_BASE_URL}/api/expediente-quirurgico/${asesoriaId}/emitir-indicaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enviar_whatsapp: true,
          texto_indicaciones: textoIndicaciones,
          medicamentos: medicamentos,
          cuidados_generales: cuidadosGenerales,
          pautas_alarma: pautasAlarma,
          modulos: modulosActivos.length > 0 ? modulosActivos : undefined,
          tipo_documento: tipoDocumento,
          titulo_documento: tituloDocumento,
          fecha_emision: fechaEmision
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setGeclisaImId(data.geclisa_im_id)
        setPdfUrl(data.pdf_url)
        setWhatsappStatus(data.whatsapp_status)
        
        let msg = `¡${tituloDocumento} emitida con éxito!`
        if (data.geclisa_im_id) {
          msg += ` Registrada en Geclisa (ID #${data.geclisa_im_id}).`
        }
        if (data.whatsapp_status === 'enviado') {
          msg += ' Enviado por WhatsApp al paciente.'
        }
        setMensajeExito(msg)

        if (onIndicacionEmitida) {
          onIndicacionEmitida(data)
        }

        // Actualizar historial y volver a vista de lista
        await cargarHistorial()
        setModoVista('historial')
      } else {
        setMensajeError(data.detail || data.error || 'Error al emitir el documento.')
      }
    } catch (err: any) {
      setMensajeError('Error de red al conectar con el servidor.')
    } finally {
      setEmitiendo(false)
    }
  }

  // Reenviar por WhatsApp una indicación ya emitida
  const handleReenviarWhatsApp = async (emisionId: string) => {
    setReenviandoWaId(emisionId)
    setMensajeExito(null)
    setMensajeError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/emisiones/${emisionId}/reenviar-whatsapp`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(data.mensaje || 'Documento reenviado exitosamente por WhatsApp al paciente.')
        cargarHistorial()
      } else {
        setMensajeError(data.detail || data.error || 'No se pudo reenviar por WhatsApp.')
      }
    } catch (e) {
      setMensajeError('Error de conexión al reenviar por WhatsApp.')
    } finally {
      setReenviandoWaId(null)
    }
  }

  // Abrir modal de reedición
  const handleAbrirReedicion = (em: any) => {
    setEmisionParaReeditar(em)
    setTextoReedicion(em.texto_indicaciones || '')
    setFechaReedicion(em.fecha_emision ? String(em.fecha_emision).slice(0, 10) : new Date().toISOString().slice(0, 10))
    setReenviarWaReedicion(true)
    setModalReedicionOpen(true)
  }

  // Guardar reedición
  const handleGuardarReedicion = async () => {
    if (!emisionParaReeditar) return
    setGuardandoReedicion(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/emisiones/${emisionParaReeditar.id}/reeditar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto_indicaciones: textoReedicion,
          reenviar_whatsapp: reenviarWaReedicion,
          fecha_emision: fechaReedicion || undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito('Documento reeditado y actualizado exitosamente.')
        setModalReedicionOpen(false)
        cargarHistorial()
      } else {
        setMensajeError(data.detail || data.error || 'Error al guardar reedición.')
      }
    } catch (e) {
      setMensajeError('Error al conectar con el servidor.')
    } finally {
      setGuardandoReedicion(false)
    }
  }

  // Iniciar confección de nueva indicación limpia
  const handleIniciarNuevaEmision = () => {
    resolverSugerencia()
    setMensajeExito(null)
    setMensajeError(null)
    setModoVista('formulario')
  }

  const currentSelectValue = (() => {
    if (plantillaSeleccionada?.origen === 'nomenclador_modular_1_a_n') return 'nomenclador'
    if (plantillaSeleccionada?.crm_plantilla_id) return `crm_${plantillaSeleccionada.crm_plantilla_id}`
    if (plantillaSeleccionada?.geclisa_pim_id) return `geclisa_${plantillaSeleccionada.geclisa_pim_id}`
    if (plantillaSeleccionada?.origen === 'personalizado') return 'custom'
    return 'custom'
  })()

  // Agrupamiento de plantillas CRM por categoría
  const plantillasPreOp = plantillasCrm.filter((p) => p.tipo_fase === 'prequirurgico' || p.categoria?.toLowerCase().includes('pre'))
  const plantillasPostOp = plantillasCrm.filter((p) => p.tipo_fase === 'postquirurgico' || p.categoria?.toLowerCase().includes('cataratas') || p.categoria?.toLowerCase().includes('refractiva'))
  const plantillasCertificados = plantillasCrm.filter((p) => p.tipo_fase === 'certificado' || p.categoria?.toLowerCase().includes('certificado'))
  const plantillasOrdenes = plantillasCrm.filter((p) => p.tipo_fase === 'orden_medica' || p.categoria?.toLowerCase().includes('retina'))
  const plantillasOtras = plantillasCrm.filter(
    (p) =>
      !plantillasPreOp.includes(p) &&
      !plantillasPostOp.includes(p) &&
      !plantillasCertificados.includes(p) &&
      !plantillasOrdenes.includes(p)
  )

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 overflow-hidden transition-all text-xs">
      {/* Barra de título colapsable */}
      <div 
        onClick={() => setDesplegado(!desplegado)}
        className="p-3.5 bg-gradient-to-r from-blue-900/10 to-indigo-900/10 flex items-center justify-between cursor-pointer hover:bg-blue-500/10 transition"
      >
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-600 text-white">
            <Pill size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-[var(--foreground)] text-sm">
                Indicaciones & Órdenes Médicas
              </h4>

              {historialEmisiones.length > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle size={11} />
                  <span>{historialEmisiones.length} documento{historialEmisiones.length > 1 ? 's' : ''} emitido{historialEmisiones.length > 1 ? 's' : ''}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/15 text-slate-500 border border-slate-500/30">
                  Sin emisiones aún
                </span>
              )}

              {plantillaSeleccionada?.total_modulos > 1 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600/10 text-blue-600 border border-blue-600/20">
                  Modular ({plantillaSeleccionada.total_modulos} protocolos)
                </span>
              )}
            </div>

            <div className="text-[11px] text-[var(--secondary)] mt-0.5">
              Gestión cronológica de órdenes prequirúrgicas, solicitudes de estudios, pautas de alta y certificados médicos.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cargandoHistorial && <Loader2 size={14} className="animate-spin text-blue-600" />}
          {desplegado ? <ChevronUp size={18} className="text-[var(--secondary)]" /> : <ChevronDown size={18} className="text-[var(--secondary)]" />}
        </div>
      </div>

      {/* Contenido expandido */}
      {desplegado && (
        <div className="p-4 space-y-4 border-t border-blue-500/10">
          {/* Mensajes de feedback */}
          {mensajeExito && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} />
                <span>{mensajeExito}</span>
              </div>
              <button type="button" onClick={() => setMensajeExito(null)} className="text-emerald-600 hover:text-emerald-800">
                <X size={14} />
              </button>
            </div>
          )}
          {mensajeError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{mensajeError}</span>
              </div>
              <button type="button" onClick={() => setMensajeError(null)} className="text-rose-600 hover:text-rose-800">
                <X size={14} />
              </button>
            </div>
          )}

          {/* VISTA 1: HISTORIAL DE EMISIONES DEL EXPEDIENTE */}
          {modoVista === 'historial' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-xs text-[var(--foreground)] flex items-center gap-1.5">
                    <History size={14} className="text-blue-600" />
                    Registro de Documentos Emitidos ({historialEmisiones.length}):
                  </h5>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Todos los documentos oficiales emitidos bajo este expediente en Geclisa y enviados por WhatsApp.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleIniciarNuevaEmision}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <Plus size={14} />
                  <span>Nueva Indicación o Certificado</span>
                </button>
              </div>

              {historialEmisiones.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--card-bg)] space-y-2">
                  <p className="text-xs text-[var(--secondary)]">
                    No hay indicaciones ni órdenes emitidas para este expediente aún.
                  </p>
                  <button
                    type="button"
                    onClick={handleIniciarNuevaEmision}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Emitir Primera Indicación</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {historialEmisiones.map((em, idx) => {
                    const tipo = em.tipo_documento || 'general'
                    const isOrden = tipo === 'orden_medica' || em.texto_indicaciones?.toLowerCase().includes('solicito')
                    const isPre = tipo === 'prequirurgico' || em.texto_indicaciones?.toLowerCase().includes('ayuno')
                    const isCert = tipo === 'certificado' || em.texto_indicaciones?.toLowerCase().includes('certifico')

                    return (
                      <div
                        key={em.id || idx}
                        className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:border-blue-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
                      >
                        {/* Datos principales del documento */}
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Badge de tipo de documento */}
                            {isCert ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <ShieldCheck size={11} />
                                <span>Certificado Médico</span>
                              </span>
                            ) : isPre ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                <Clock size={11} />
                                <span>Preoperatorio</span>
                              </span>
                            ) : isOrden ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                <FileCheck2 size={11} />
                                <span>Orden Médica / Solicitud</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Pill size={11} />
                                <span>Postoperatorio & Gotas</span>
                              </span>
                            )}

                            {/* Badge de Geclisa IM ID */}
                            {em.geclisa_im_id && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                                Geclisa #{em.geclisa_im_id}
                              </span>
                            )}

                            {/* Badge de estado de WhatsApp */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                em.whatsapp_status === 'enviado'
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                  : em.whatsapp_status === 'fallido'
                                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                              }`}
                            >
                              <Send size={10} />
                              <span>{em.whatsapp_status === 'enviado' ? 'WhatsApp Enviado ✓' : em.whatsapp_status || 'Pendiente'}</span>
                            </span>

                            {/* Fecha de emisión / Vigencia médica */}
                            <span
                              className="text-[10px] font-medium text-[var(--foreground)] px-2 py-0.5 rounded-md bg-[var(--hover-bg)] border border-[var(--border-color)]"
                              title={em.fecha_emision ? `Fecha Documento: ${em.fecha_emision} | Generado: ${new Date(em.created_at).toLocaleString('es-AR')}` : undefined}
                            >
                              📅 {em.fecha_emision
                                ? (em.fecha_emision.includes('-') ? em.fecha_emision.split('-').reverse().join('/') : em.fecha_emision)
                                : (em.created_at ? new Date(em.created_at).toLocaleDateString('es-AR') : '-')}
                            </span>
                          </div>

                          <div className="font-bold text-xs text-[var(--foreground)]">
                            {em.titulo_documento || em.practica_nombre || 'Indicación Médica'}
                          </div>

                          <p className="text-[11px] text-[var(--secondary)] font-mono line-clamp-1 max-w-xl">
                            {em.texto_indicaciones?.replace(/\n/g, ' ')}
                          </p>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                          {em.pdf_url && (
                            <a
                              href={`${API_BASE_URL}${em.pdf_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-[11px] flex items-center gap-1 transition"
                            >
                              <Download size={12} />
                              <span>PDF</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleReenviarWhatsApp(em.id)}
                            disabled={reenviandoWaId === em.id}
                            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--hover-bg)] font-semibold text-[11px] text-[var(--foreground)] flex items-center gap-1 transition"
                            title="Reenviar PDF por WhatsApp al paciente"
                          >
                            {reenviandoWaId === em.id ? (
                              <Loader2 size={12} className="animate-spin text-blue-600" />
                            ) : (
                              <Share2 size={12} className="text-emerald-600" />
                            )}
                            <span>Reenviar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAbrirReedicion(em)}
                            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--hover-bg)] font-semibold text-[11px] text-[var(--foreground)] flex items-center gap-1 transition"
                            title="Reeditar texto de la indicación"
                          >
                            <Edit2 size={12} className="text-blue-600" />
                            <span>Reeditar</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: FORMULARIO DE CONFECCIÓN DE NUEVA INDICACIÓN */}
          {modoVista === 'formulario' && (
            <div className="space-y-3.5">
              {/* Botón para volver al historial si ya existen emisiones */}
              {historialEmisiones.length > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setModoVista('historial')}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ArrowLeft size={13} />
                    <span>← Volver al Historial ({historialEmisiones.length} documento{historialEmisiones.length > 1 ? 's' : ''} emitido{historialEmisiones.length > 1 ? 's' : ''})</span>
                  </button>

                  <span className="text-[11px] font-semibold text-[var(--secondary)]">
                    Emitiendo nuevo documento para este expediente
                  </span>
                </div>
              )}

              {/* Selector Rápido de Categoría / Fase */}
              <div>
                <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                  Tipo de Documento a Emitir:
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/40 rounded-xl border border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => handleCambiarCategoria('orden_medica')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      tipoDocumento === 'orden_medica'
                        ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-white/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileCheck2 size={13} />
                    <span>Orden Médica / Solicitud</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCambiarCategoria('prequirurgico')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      tipoDocumento === 'prequirurgico'
                        ? 'bg-blue-600 text-white shadow-xs ring-1 ring-white/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Clock size={13} />
                    <span>Preoperatorio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCambiarCategoria('postquirurgico')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      tipoDocumento === 'postquirurgico'
                        ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-white/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Pill size={13} />
                    <span>Postoperatorio & Gotas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCambiarCategoria('certificado')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      tipoDocumento === 'certificado'
                        ? 'bg-amber-600 text-white shadow-xs ring-1 ring-white/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck size={13} />
                    <span>Certificado Médico</span>
                  </button>
                </div>
              </div>

              {/* Información contextual del médico y práctica */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-[var(--card-bg)] p-2.5 rounded-xl border border-[var(--border-color)] text-[11px]">
                <div>
                  <span className="text-[var(--secondary)] block">Práctica Quirúrgica:</span>
                  <span className="font-bold text-[var(--foreground)]">{practicaNombre || 'No seleccionada'}</span>
                </div>
                <div>
                  <span className="text-[var(--secondary)] block">Cirujano Asignado:</span>
                  <span className="font-bold text-[var(--foreground)]">{medicoNombre || 'No asignado'}</span>
                </div>
                <div>
                  <span className="text-[var(--secondary)] block">Destinatario WhatsApp:</span>
                  <span className="font-bold text-[var(--foreground)]">{pacienteNombre || 'Paciente'} ({pacienteTelefono || 'Sin teléfono'})</span>
                </div>
              </div>

              {/* Selector de Fecha de Emisión Oficial (Vigencia Clínica / Posdatado) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-500 shrink-0" />
                  <div>
                    <span className="font-bold text-[var(--foreground)] block">Fecha de Emisión del Documento</span>
                    <span className="text-[11px] text-[var(--secondary)]">
                      Fecha legal y clínica impresa en la orden o receta. Puede emitirse hoy o posdatarse a la fecha de cirugía.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFechaEmision(new Date().toISOString().slice(0, 10))}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                      fechaEmision === new Date().toISOString().slice(0, 10)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[var(--card-bg)] text-[var(--foreground)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    Hoy
                  </button>
                  {fechaCirugia && (
                    <button
                      type="button"
                      onClick={() => {
                        const fClean = fechaCirugia.split('T')[0]
                        setFechaEmision(fClean)
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                        fechaEmision === fechaCirugia.split('T')[0]
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[var(--card-bg)] text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                      }`}
                      title={`Fijar a fecha de cirugía: ${fechaCirugia.split('T')[0]}`}
                    >
                      Fecha Cirugía
                    </button>
                  )}
                </div>
              </div>

              {/* Selector Agrupado por Categorías */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[var(--card-bg)] p-2 rounded-xl border border-[var(--border-color)]">
                <span className="font-bold text-[var(--secondary)] text-[11px] whitespace-nowrap">
                  Plantilla Seleccionada:
                </span>
                <select
                  value={currentSelectValue}
                  onChange={(e) => handleSelectPlantilla(e.target.value)}
                  className="flex-1 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium text-xs outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {plantillaSeleccionada?.origen === 'nomenclador_modular_1_a_n' && (
                    <optgroup label="⚡ Nomenclador (Protocolo Asignado a esta Práctica)">
                      <option value="nomenclador">
                        ✓ {plantillaSeleccionada.titulo} ({plantillaSeleccionada.total_modulos || 1} protocolos activos)
                      </option>
                    </optgroup>
                  )}

                  {/* Grupo: Órdenes Médicas */}
                  {plantillasOrdenes.length > 0 && (
                    <optgroup label="📋 Órdenes Médicas / Solicitudes">
                      {plantillasOrdenes.map((p) => (
                        <option key={p.id} value={`crm_${p.id}`}>
                          {p.titulo}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Grupo: Preoperatorio */}
                  {plantillasPreOp.length > 0 && (
                    <optgroup label="⏱️ Preoperatorio & Preparación">
                      {plantillasPreOp.map((p) => (
                        <option key={p.id} value={`crm_${p.id}`}>
                          {p.titulo}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Grupo: Postoperatorio y Gotas */}
                  {plantillasPostOp.length > 0 && (
                    <optgroup label="💊 Postoperatorio & Colirios">
                      {plantillasPostOp.map((p) => (
                        <option key={p.id} value={`crm_${p.id}`}>
                          {p.titulo}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Grupo: Certificados Médicos */}
                  {plantillasCertificados.length > 0 && (
                    <optgroup label="📜 Certificados Médicos">
                      {plantillasCertificados.map((p) => (
                        <option key={p.id} value={`crm_${p.id}`}>
                          {p.titulo}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Grupo: Otras de la Biblioteca CRM */}
                  {plantillasOtras.length > 0 && (
                    <optgroup label="📁 Otras Plantillas CRM">
                      {plantillasOtras.map((p) => (
                        <option key={p.id} value={`crm_${p.id}`}>
                          {p.titulo}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Grupo: Catálogo Geclisa */}
                  <optgroup label="🌐 Catálogo Oficial Geclisa (107 Plantillas)">
                    {plantillasCatalogoGeclisa.map((p) => (
                      <option key={p.pimId} value={`geclisa_${p.pimId}`}>
                        #{p.pimId} - {p.pimNombre}
                      </option>
                    ))}
                  </optgroup>

                  {/* Grupo: Personalizado */}
                  <optgroup label="✏️ Personalizado">
                    <option value="custom">-- Texto Personalizado Libre --</option>
                  </optgroup>
                </select>
              </div>

              {/* Panel Interactivo de Módulos 1 a N del Nomenclador (si aplica) */}
              {plantillaSeleccionada?.modulos_asignados && plantillaSeleccionada.modulos_asignados.length > 1 && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-500" />
                      Módulos Asignados a la Práctica ({plantillaSeleccionada.modulos_asignados.length}):
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Marque o desmarque los protocolos u órdenes para este paciente
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {plantillaSeleccionada.modulos_asignados.map((m: any, mIdx: number) => {
                      const isActivo = modulosSeleccionadosIds.includes(m.id)
                      return (
                        <button
                          key={m.id || mIdx}
                          type="button"
                          onClick={() => handleToggleModulo(m.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-sm ${
                            isActivo
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-[var(--border-color)] line-through opacity-60'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                            {isActivo ? '✓' : '✗'}
                          </span>
                          <span>#{mIdx + 1} {m.titulo}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Título y Texto de las Indicaciones */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[var(--foreground)] flex items-center gap-2">
                    <span>Texto del Documento (Se asentará en Geclisa):</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      (Editable libremente antes de emitir)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={resolverSugerencia}
                    disabled={resolviendo}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
                  >
                    <RefreshCw size={11} className={resolviendo ? 'animate-spin' : ''} />
                    <span>Re-analizar sugerencia</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={textoIndicaciones}
                  onChange={(e) => setTextoIndicaciones(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px] leading-relaxed outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Redacte aquí las indicaciones, orden médica o certificado..."
                />
              </div>

              {/* Fármacos y Gotas estructurados (si aplica) */}
              {medicamentos.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--foreground)] block">
                    Colirios y Gotas Programadas ({medicamentos.length}):
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {medicamentos.map((m, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between">
                        <div>
                          <span className="font-bold text-blue-600 block">{m.droga}</span>
                          <span className="text-[10px] text-[var(--secondary)]">{m.dosis} • {m.frecuencia} • {m.duracion}</span>
                        </div>
                        {m.instrucciones && (
                          <span className="text-[10px] italic text-[var(--secondary)] max-w-[120px] truncate" title={m.instrucciones}>
                            {m.instrucciones}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones principales de emisión */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-blue-500/10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewPdf}
                    disabled={generandoPreview}
                    className="px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] font-semibold text-[var(--foreground)] flex items-center gap-1.5 transition"
                  >
                    {generandoPreview ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                    <span>Ver PDF Previo</span>
                  </button>

                  {historialEmisiones.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setModoVista('historial')}
                      className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-xs"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEmitirIndicaciones}
                    disabled={emitiendo || !asesoriaId}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    {emitiendo ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Emitir a Geclisa y Enviar WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Previsualización PDF */}
      {modalPreviewOpen && previewPdfBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--hover-bg)]/40">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <h3 className="font-bold text-sm text-[var(--foreground)]">
                  Vista Previa Oficial: {tituloDocumento}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPreviewOpen(false)}
                className="px-3 py-1 rounded-lg border border-[var(--border-color)] text-xs font-bold hover:bg-[var(--hover-bg)]"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 bg-slate-900/10">
              <iframe src={previewPdfBlobUrl} className="w-full h-full border-0" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reedición */}
      {modalReedicionOpen && emisionParaReeditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[var(--foreground)]">
                  Reeditar Documento Emitido
                </h3>
                <p className="text-[11px] text-[var(--secondary)]">
                  Geclisa #{emisionParaReeditar.geclisa_im_id} • {emisionParaReeditar.practica_nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalReedicionOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                Fecha del Documento (Emisión):
              </label>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="date"
                  value={fechaReedicion}
                  onChange={(e) => setFechaReedicion(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setFechaReedicion(new Date().toISOString().slice(0, 10))}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--hover-bg)] text-[var(--foreground)] border border-[var(--border-color)]"
                >
                  Hoy
                </button>
                {fechaCirugia && (
                  <button
                    type="button"
                    onClick={() => setFechaReedicion(fechaCirugia.split('T')[0])}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                  >
                    Fecha Cirugía
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                Texto de Indicaciones / Orden Médica:
              </label>
              <textarea
                rows={6}
                value={textoReedicion}
                onChange={(e) => setTextoReedicion(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--hover-bg)]/50 border border-[var(--border-color)]">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                Reenviar PDF actualizado por WhatsApp al paciente
              </span>
              <input
                type="checkbox"
                checked={reenviarWaReedicion}
                onChange={(e) => setReenviarWaReedicion(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setModalReedicionOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[var(--hover-bg)] text-[var(--secondary)] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarReedicion}
                disabled={guardandoReedicion}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                {guardandoReedicion ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Guardar y Reemitir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
