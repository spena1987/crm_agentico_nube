'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Glasses,
  Search,
  Send,
  Sparkles,
  Calculator,
  Image as ImageIcon,
  FileText,
  Clock,
  CheckCheck,
  Check,
  StickyNote,
  Bot,
  PauseCircle,
  PlayCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Plus,
  Ticket,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Loader2,
  UserCheck,
  Phone,
  Stethoscope,
  BellRing,
  SlidersHorizontal,
  Wand2,
  AlertTriangle,
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import { apiFetch } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import {
  EtapaComercialOptica,
  OpticaConversacion,
  OpticaGraduacion,
  OpticaMensaje,
  OpcionCotizacionOptica,
  OpticaPlaca,
  OpticaTemplateMeta,
} from '@/types/optica'

// Helpers de sanitización y validación estricta para Cotizador
const sanitizeMoney = (val: unknown): number => {
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''))
  return !Number.isFinite(num) || num < 0 ? 0 : Math.round(num)
}

const sanitizeDiscount = (val: unknown): number => {
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(num)) return 0
  return Math.min(100, Math.max(0, Math.round(num)))
}

const formatCurrencySafe = (val: number): string => {
  const safe = sanitizeMoney(val)
  return safe.toLocaleString('es-AR')
}

const ETAPAS_EMBUDO: {
  code: EtapaComercialOptica
  label: string
  short: string
  color: string
}[] = [
  {
    code: 'NUEVA_CONSULTA',
    label: 'Nueva Consulta',
    short: 'Nueva',
    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  {
    code: 'CONSULTA_ARMAZON',
    label: 'Consulta Armazón',
    short: 'Armazón',
    color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
  {
    code: 'PRESUPUESTO_AEREOS',
    label: 'Presupuesto Aéreos',
    short: 'Ppto. Aéreos',
    color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  {
    code: 'LENTES_CONTACTO',
    label: 'Lentes de Contacto',
    short: 'Contacto',
    color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  },
  {
    code: 'EN_LABORATORIO',
    label: 'En Laboratorio / Taller',
    short: 'Laboratorio',
    color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  {
    code: 'LISTO_PARA_RETIRAR',
    label: 'Listo para Retirar',
    short: 'Listo Retiro',
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  {
    code: 'VENDIDO',
    label: 'Vendido / Entregado',
    short: 'Vendido',
    color: 'bg-green-600/20 text-green-700 dark:text-green-300 border-green-500/40',
  },
]

const ATAJOS_RAPIDOS = [
  {
    cmd: '/horarios',
    titulo: 'Horarios y Dirección',
    texto:
      '📍 *Óptica Vortix* te espera de Lunes a Viernes de 8:30 a 20:00 hs y Sábados de 9:00 a 13:00 hs, dentro del Centro Oftalmológico. ¡Podés pasar sin turno previo!',
  },
  {
    cmd: '/ubicacion',
    titulo: 'Ubicación en Planta Baja',
    texto:
      '✨ Estamos ubicados en la Planta Baja de la clínica, justo a la salida de los consultorios oftalmológicos, para que puedas cotizar tu receta en el momento con tu descuento de paciente.',
  },
  {
    cmd: '/obras_sociales',
    titulo: 'Cobertura y Reintegros',
    texto:
      '💳 Trabajamos con descuentos directos por convenio y emitimos factura oficial con el detalle dióptrico para reintegro inmediato en tu Obra Social o Prepaga.',
  },
  {
    cmd: '/garantia',
    titulo: 'Garantía de Adaptación',
    texto:
      '🛡️ Todos nuestros cristales monofocales y multifocales cuentan con *Garantía de Adaptación Recetada* en conjunto con tu médico oftalmólogo de la clínica.',
  },
  {
    cmd: '/medios_pago',
    titulo: 'Cuotas y Medios de Pago',
    texto:
      '💰 Contás con 3 y 6 cuotas sin interés con tarjetas bancarias, o un 15% OFF adicional abonando por transferencia o efectivo.',
  },
  {
    cmd: '/limpieza_lc',
    titulo: 'Cuidado Lentes de Contacto',
    texto:
      '💧 Recordá utilizar siempre solución multipropósito estéril para tus lentes de contacto, renovar el líquido del estuche a diario y no dormir con ellos salvo indicación médica.',
  },
]

const EMPTY_GRADUACION: OpticaGraduacion = {
  od_lejos: { esfera: '', cilindro: '', eje: '', dnp: '' },
  oi_lejos: { esfera: '', cilindro: '', eje: '', dnp: '' },
  od_cerca: { esfera: '', cilindro: '', eje: '' },
  oi_cerca: { esfera: '', cilindro: '', eje: '' },
  add: '',
  tipo_lente_sugerido: 'Monofocal Antirreflex + Filtro Azul',
  observaciones: '',
  fuente: 'MANUAL',
}

export default function OpticaVortixChatPage() {
  const searchParams = useSearchParams()
  const initialConvId = searchParams.get('conv_id')

  // Estados de lista de conversaciones
  const [conversaciones, setConversaciones] = useState<OpticaConversacion[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroTab, setFiltroTab] = useState<'TODOS' | 'SIN_LEER' | 'RECETA_HOY' | 'VOUCHERS'>('TODOS')
  const [filtroEtapa, setFiltroEtapa] = useState<EtapaComercialOptica | 'TODAS'>('TODAS')

  // Conversación seleccionada y mensajes
  const [selectedConv, setSelectedConv] = useState<OpticaConversacion | null>(null)
  const [mensajes, setMensajes] = useState<OpticaMensaje[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [showFicha360, setShowFicha360] = useState(true)

  // Ficha Óptica 360° & Graduación editable
  const [graduacion, setGraduacion] = useState<OpticaGraduacion>(EMPTY_GRADUACION)
  const [evolucionHoy, setEvolucionHoy] = useState<{
    fecha: string
    medico: string
    texto_evolucion: string
    tipo_indicacion?: string
  } | null>(null)
  const [savingGraduacion, setSavingGraduacion] = useState(false)

  // Composer de mensaje
  const [inputMsg, setInputMsg] = useState('')
  const [modoNotaInterna, setModoNotaInterna] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [copilotoLoading, setCopilotoLoading] = useState(false)
  const [showCopilotoMenu, setShowCopilotoMenu] = useState(false)

  // Modales: Cotizador, Placas, Plantillas, Visor OCR Receta, Nueva Conversación
  const [showCotizadorModal, setShowCotizadorModal] = useState(false)
  const [cotizadorOpciones, setCotizadorOpciones] = useState<OpcionCotizacionOptica[]>([
    {
      titulo: 'Opción 1 • Esencial Antirreflex',
      cristal: 'Orgánico 1.50 c/ Antirreflex',
      tratamiento: 'AR Hidrofóbico + UV400',
      armazon: 'Armazón Línea Clásica Incluido',
      precio_lista: 95000,
      descuento_pct: 20,
      precio_final: 76000,
    },
    {
      titulo: 'Opción 2 • Digital Blue Block (Recomendada)',
      cristal: 'Blue Light Cut 1.56 Alto Confort',
      tratamiento: 'Filtro Luz Azul + Antirreflex Super',
      armazon: 'Armazón Acetato / Metal Premium',
      precio_lista: 138000,
      descuento_pct: 20,
      precio_final: 110400,
    },
    {
      titulo: 'Opción 3 • Ultradelgado Policarbonato',
      cristal: 'Policarbonato 1.59 Alta Resistencia',
      tratamiento: 'Blue Block + Antirrayas + Antirreflex',
      armazon: 'Armazón Vortix Titanium / Diseño',
      precio_lista: 185000,
      descuento_pct: 20,
      precio_final: 148000,
    },
  ])

  const [showPlacasModal, setShowPlacasModal] = useState(false)
  const [placas, setPlacas] = useState<OpticaPlaca[]>([])
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [templatesMeta, setTemplatesMeta] = useState<OpticaTemplateMeta[]>([])

  // Visor OCR de Imagen de Receta
  const [visorImagenUrl, setVisorImagenUrl] = useState<string | null>(null)
  const [visorZoom, setVisorZoom] = useState(1)
  const [visorRotation, setVisorRotation] = useState(0)
  const [ocrLoading, setOcrLoading] = useState(false)

  // Modal Nueva Conversación Manual
  const [showNuevaConvModal, setShowNuevaConvModal] = useState(false)
  const [nuevoTel, setNuevoTel] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoDni, setNuevoDni] = useState('')

  // Confirmación de aviso "Lentes Listos para Retirar"
  const [showConfirmListoRetirar, setShowConfirmListoRetirar] = useState(false)
  const [cotizadorError, setCotizadorError] = useState<string | null>(null)

  // Referencias estables para evitar pestañeo (flickering) y salto involuntario de conversación
  const selectedConvIdRef = useRef<string | null>(null)
  const hasInitialSelectedRef = useRef<boolean>(false)
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchConversaciones = async (isBackground = false) => {
    try {
      const params = new URLSearchParams()
      if (filtroEtapa !== 'TODAS') params.set('etapa_comercial', filtroEtapa)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      const res = await apiFetch(`/api/optica-vortix/conversaciones?${params.toString()}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        const list: OpticaConversacion[] = Array.isArray(data) ? data : data.items || []
        setConversaciones(list)

        // Auto-selección única inicial: solo se ejecuta la primera vez que carga la página
        // y nunca más se sobreescribe durante el polling periódico de fondo
        if (!selectedConvIdRef.current && !hasInitialSelectedRef.current && list.length > 0) {
          hasInitialSelectedRef.current = true
          const match = initialConvId ? list.find((c) => c.id === initialConvId) : list[0]
          if (match) {
            handleSelectConv(match, false)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      if (!isBackground) {
        setLoadingConvs(false)
      }
    }
  }

  useEffect(() => {
    fetchConversaciones(false)
    const interval = setInterval(() => {
      fetchConversaciones(true)
    }, 12000)
    return () => clearInterval(interval)
  }, [filtroEtapa, searchQuery])

  // UX-02: Suscripción en Tiempo Real con Supabase Realtime para la conversación activa
  useEffect(() => {
    if (!selectedConv?.id) return

    const activeConvId = selectedConv.id
    const channelName = `optica-chat-${activeConvId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'optica_mensajes',
          filter: `conversacion_id=eq.${activeConvId}`,
        },
        (payload) => {
          const nuevoMsg = payload.new as OpticaMensaje
          setMensajes((prev) => {
            if (prev.some((m) => m.id === nuevoMsg.id || (m.metadata?.wamid && m.metadata.wamid === nuevoMsg.metadata?.wamid))) {
              return prev
            }
            return [...prev, nuevoMsg]
          })

          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 60)

          setConversaciones((prevConvs) =>
            prevConvs
              .map((c) =>
                c.id === activeConvId
                  ? {
                      ...c,
                      ultimo_mensaje: nuevoMsg.contenido,
                      ultimo_mensaje_at: nuevoMsg.created_at,
                      no_leidos: nuevoMsg.direccion === 'inbound' ? 0 : c.no_leidos,
                    }
                  : c
              )
              .sort(
                (a, b) =>
                  new Date(b.ultimo_mensaje_at || 0).getTime() -
                  new Date(a.ultimo_mensaje_at || 0).getTime()
              )
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'optica_mensajes',
          filter: `conversacion_id=eq.${activeConvId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as OpticaMensaje
          setMensajes((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConv?.id])

  const handleSelectConv = async (conv: OpticaConversacion, isSilent = false) => {
    const isDifferentConv = conv.id !== selectedConvIdRef.current
    selectedConvIdRef.current = conv.id
    setSelectedConv(conv)

    if (isDifferentConv && !isSilent) {
      setLoadingMsgs(true)
    }

    if (conv.graduacion_actual_json) {
      setGraduacion({ ...EMPTY_GRADUACION, ...conv.graduacion_actual_json })
    } else {
      setGraduacion(EMPTY_GRADUACION)
    }

    try {
      const [resM, resF] = await Promise.all([
        apiFetch(`/api/optica-vortix/conversaciones/${conv.id}/mensajes`, { cache: 'no-store' }),
        apiFetch(`/api/optica-vortix/conversaciones/${conv.id}/ficha-optica`, { cache: 'no-store' }),
      ])
      if (resM.ok) {
        const dataM = await resM.json()
        setMensajes(Array.isArray(dataM) ? dataM : dataM.items || [])
      }
      if (resF.ok) {
        const dataF = await resF.json()
        if (dataF.graduacion) {
          setGraduacion({ ...EMPTY_GRADUACION, ...dataF.graduacion })
        }
        setEvolucionHoy(dataF.evolucion_geclisa_hoy || null)
      }
    } catch {
      // ignore
    } finally {
      if (isDifferentConv && !isSilent) {
        setLoadingMsgs(false)
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedConv || !inputMsg.trim() || sendingMsg) return

    setSendingMsg(true)
    const tipo = modoNotaInterna ? 'nota_interna' : 'text'
    const texto = inputMsg.trim()
    setInputMsg('')
    setShowSlashMenu(false)

    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`, {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          contenido: texto,
        }),
      })
      if (res.ok) {
        const nuevo = await res.json()
        setMensajes((prev) => [...prev, nuevo.mensaje || nuevo])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      }
    } catch {
      // ignore
    } finally {
      setSendingMsg(false)
    }
  }

  const handleChangeEtapa = async (nuevaEtapa: EtapaComercialOptica, notificarListo = false) => {
    if (!selectedConv) return
    if (nuevaEtapa === 'LISTO_PARA_RETIRAR' && !notificarListo && !showConfirmListoRetirar) {
      setShowConfirmListoRetirar(true)
      return
    }
    setShowConfirmListoRetirar(false)
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          etapa_comercial: nuevaEtapa,
          notificar_lentes_listos: notificarListo,
        }),
      })
      if (res.ok) {
        setSelectedConv({ ...selectedConv, etapa_comercial: nuevaEtapa })
        setConversaciones((prev) =>
          prev.map((c) => (c.id === selectedConv.id ? { ...c, etapa_comercial: nuevaEtapa } : c))
        )
        if (notificarListo) {
          handleSelectConv({ ...selectedConv, etapa_comercial: nuevaEtapa })
        }
      }
    } catch {}
  }

  const handleToggleBot = async () => {
    if (!selectedConv) return
    const nextPaused = !selectedConv.bot_paused
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ bot_paused: nextPaused }),
      })
      if (res.ok) {
        setSelectedConv({ ...selectedConv, bot_paused: nextPaused })
      }
    } catch {}
  }

  const handleSaveGraduacion = async () => {
    if (!selectedConv) return
    setSavingGraduacion(true)
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ graduacion_actual_json: graduacion }),
      })
      if (res.ok) {
        setSelectedConv({ ...selectedConv, graduacion_actual_json: graduacion })
      }
    } catch {
    } finally {
      setSavingGraduacion(false)
    }
  }

  const handleRunOcrReceta = async (mediaUrl: string, rotacionGrados: number = visorRotation) => {
    if (!selectedConv) return
    setOcrLoading(true)
    try {
      const res = await apiFetch('/api/optica-vortix/ia/ocr-receta', {
        method: 'POST',
        body: JSON.stringify({
          media_url: mediaUrl,
          conversacion_id: selectedConv.id,
          rotacion_grados: rotacionGrados,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const extraida: OpticaGraduacion = data.graduacion || data
        setGraduacion({
          ...EMPTY_GRADUACION,
          ...extraida,
          fuente: 'OCR_IA',
        })
        setShowFicha360(true)
        setVisorImagenUrl(null)
      }
    } catch {
    } finally {
      setOcrLoading(false)
    }
  }

  const handleCopilotoIA = async (accion: 'sugerir' | 'mejorar' | 'resumir') => {
    if (!selectedConv) return
    setCopilotoLoading(true)
    setShowCopilotoMenu(false)
    try {
      const res = await apiFetch('/api/optica-vortix/ia/copiloto', {
        method: 'POST',
        body: JSON.stringify({
          conversacion_id: selectedConv.id,
          accion,
          texto_actual: inputMsg,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.texto || data.sugerencia) {
          setInputMsg(data.texto || data.sugerencia)
        }
      }
    } catch {
    } finally {
      setCopilotoLoading(false)
    }
  }

  const handleEnviarCotizacion = async () => {
    if (!selectedConv) return
    setCotizadorError(null)

    // Validar opciones con importes positivos
    const validas = cotizadorOpciones.filter((op) => op.precio_lista > 0 && op.precio_final > 0)
    if (validas.length === 0) {
      setCotizadorError('Al menos una opción debe tener precio de lista y precio final válidos mayores a $0.')
      return
    }

    const cupon = selectedConv.cupon_codigo || '#VORTIX-PACIENTE'
    const lineas = [
      `👓 *PRESUPUESTO ÓPTICA VORTIX* (${cupon})`,
      `Paciente: *${selectedConv.nombre_paciente}*`,
      '',
      ...validas.map(
        (op) =>
          `🔹 *${op.titulo || 'Opción'}*\n• Cristal: ${op.cristal || 'Estándar'}\n• Tratamiento: ${op.tratamiento || 'Básico'}\n• Armazón: ${op.armazon || 'A elección'}\n• Precio Lista: ~${formatCurrencySafe(op.precio_lista)}~ (-${op.descuento_pct}% OFF)\n👉 *Valor Final Paciente: ${formatCurrencySafe(op.precio_final)}*`
      ),
      '',
      '✅ *Incluye:* Garantía de adaptación médica, estuche rígido y paño microfibra. 3 y 6 cuotas sin interés.',
    ].join('\n')

    setShowCotizadorModal(false)
    setSendingMsg(true)
    try {
      const res = await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'cotizacion',
          contenido: lineas,
          metadata: {
            cotizacion_opciones: validas,
            cupon_aplicado: cupon,
          },
        }),
      })
      if (res.ok) {
        const nuevo = await res.json()
        setMensajes((prev) => [...prev, nuevo.mensaje || nuevo])
        handleChangeEtapa('PRESUPUESTO_AEREOS')
      }
    } catch {
    } finally {
      setSendingMsg(false)
    }
  }

  const openPlacasModal = async () => {
    setShowPlacasModal(true)
    try {
      const res = await apiFetch('/api/optica-vortix/placas')
      if (res.ok) {
        const data = await res.json()
        setPlacas(Array.isArray(data) ? data : data.items || [])
      }
    } catch {}
  }

  const openTemplatesModal = async () => {
    setShowTemplatesModal(true)
    setTemplateError(null)
    try {
      const res = await apiFetch('/api/optica-vortix/plantillas', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const listT: OpticaTemplateMeta[] = Array.isArray(data)
          ? data
          : data.plantillas || data.items || []
        setTemplatesMeta(listT)
      } else {
        const resAlt = await apiFetch('/api/optica-vortix/salud-linea', { cache: 'no-store' })
        if (resAlt.ok) {
          const dataAlt = await resAlt.json()
          setTemplatesMeta(dataAlt.plantillas_optica || dataAlt.templates || [])
        }
      }
    } catch {}
  }

  const handleIniciarConversacion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoTel.trim()) return
    try {
      const res = await apiFetch('/api/optica-vortix/conversaciones/iniciar', {
        method: 'POST',
        body: JSON.stringify({
          telefono: nuevoTel.trim(),
          nombre_paciente: nuevoNombre.trim() || 'Paciente Óptica',
          dni: nuevoDni.trim() || null,
        }),
      })
      if (res.ok) {
        const conv = await res.json()
        setShowNuevaConvModal(false)
        setNuevoTel('')
        setNuevoNombre('')
        setNuevoDni('')
        await fetchConversaciones()
        handleSelectConv(conv.conversacion || conv)
      }
    } catch {}
  }

  // Filtrado local complementario por pestaña rápida
  const conversacionesFiltradas = conversaciones.filter((c) => {
    if (filtroTab === 'SIN_LEER') return (c.no_leidos || 0) > 0
    if (filtroTab === 'RECETA_HOY') return Boolean(c.receta_detectada_hoy || c.origen === 'DETECCION_RECETA_HOY')
    if (filtroTab === 'VOUCHERS') return Boolean(c.cupon_codigo || c.origen === 'PLACA_TURNO')
    return true
  })

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      <OpticaSubNavHeader
        rightSlot={
          <button
            type="button"
            onClick={() => setShowNuevaConvModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus size={14} />
            <span>Nuevo Chat Óptica</span>
          </button>
        }
      />

      {/* Contenedor 3 Paneles */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* PANEL IZQUIERDO: Lista de Conversaciones & Embudo */}
        <aside className="w-80 xl:w-96 border-r border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0">
          {/* Buscador y Pestañas */}
          <div className="p-3 border-b border-[var(--border)] space-y-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar paciente, DNI, teléfono o #VORTIX..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Pestañas rápidas */}
            <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              {[
                { id: 'TODOS', label: 'Todos' },
                { id: 'SIN_LEER', label: 'Sin Leer' },
                { id: 'RECETA_HOY', label: '👓 Receta' },
                { id: 'VOUCHERS', label: '🎟️ Voucher' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFiltroTab(t.id as any)}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all truncate ${
                    filtroTab === t.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filtro horizontal de Etiquetas de Embudo Óptico */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setFiltroEtapa('TODAS')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition-all ${
                  filtroEtapa === 'TODAS'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-[var(--secondary)] border-[var(--border)]'
                }`}
              >
                Todas las Etapas
              </button>
              {ETAPAS_EMBUDO.map((et) => (
                <button
                  key={et.code}
                  type="button"
                  onClick={() => setFiltroEtapa(et.code)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 border transition-all ${
                    filtroEtapa === et.code
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : `${et.color}`
                  }`}
                >
                  {et.short}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Tarjetas de Conversación */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
            {loadingConvs ? (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 size={22} className="animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">Cargando bandeja de Óptica Vortix...</span>
              </div>
            ) : conversacionesFiltradas.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Glasses size={28} className="mx-auto text-slate-400" />
                <p className="text-xs font-bold text-[var(--foreground)]">
                  No hay conversaciones en este filtro
                </p>
                <p className="text-[11px] text-[var(--secondary)]">
                  Sincroniza las indicaciones de Geclisa en &ldquo;Oportunidades&rdquo; o inicia un chat nuevo.
                </p>
              </div>
            ) : (
              conversacionesFiltradas.map((conv) => {
                const isSelected = selectedConv?.id === conv.id
                const etapaObj =
                  ETAPAS_EMBUDO.find((e) => e.code === conv.etapa_comercial) || ETAPAS_EMBUDO[0]

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConv(conv)}
                    className={`w-full text-left p-3.5 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-l-4 border-l-indigo-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[var(--foreground)] truncate">
                            {conv.nombre_paciente || conv.telefono}
                          </span>
                          {conv.ventana_24h_activa && (
                            <span
                              className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                              title="Ventana Meta 24h abierta (mensajes libres sin costo)"
                            />
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--secondary)] font-medium">
                          +{conv.telefono} {conv.obra_social ? `• ${conv.obra_social}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {conv.no_leidos > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px]">
                            {conv.no_leidos}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[var(--secondary)] line-clamp-1">
                      {conv.ultimo_mensaje || 'Sin mensajes recientes'}
                    </p>

                    <div className="flex items-center flex-wrap gap-1 pt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border ${etapaObj.color}`}
                      >
                        {etapaObj.short}
                      </span>

                      {conv.cupon_codigo && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                          <Ticket size={10} />
                          {conv.cupon_codigo}
                        </span>
                      )}

                      {(conv.receta_detectada_hoy || conv.origen === 'DETECCION_RECETA_HOY') && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          👓 Receta Detectada
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* PANEL CENTRAL: Lienzo Conversacional Fluido */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/40">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Glasses size={32} />
              </div>
              <h2 className="text-base font-black text-[var(--foreground)]">
                Selecciona una conversación de Óptica Vortix
              </h2>
              <p className="text-xs text-[var(--secondary)] max-w-md">
                Desde aquí puedes cotizar cristales monofocales, multifocales y lentes de contacto, extraer recetas por foto con Gemini Vision y consultar la indicación médica de Geclisa.
              </p>
            </div>
          ) : (
            <>
              {/* Cabecera del Chat */}
              <div className="px-4 py-2.5 bg-[var(--card)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {(selectedConv.nombre_paciente || 'OV').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-[var(--foreground)] truncate">
                        {selectedConv.nombre_paciente}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedConv.ventana_24h_activa
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {selectedConv.ventana_24h_activa ? 'Ventana 24h Abierta' : 'Ventana 24h Cerrada (Usar Plantilla)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--secondary)] flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> +{selectedConv.telefono}
                      </span>
                      {selectedConv.dni && <span>• DNI {selectedConv.dni}</span>}
                      {selectedConv.obra_social && <span>• {selectedConv.obra_social}</span>}
                    </p>
                  </div>
                </div>

                {/* Controles Superiores: Selector Etapa 1-clic, Bot, Cotizador, Toggle Ficha */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedConv.etapa_comercial}
                    onChange={(e) => handleChangeEtapa(e.target.value as EtapaComercialOptica)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {ETAPAS_EMBUDO.map((et) => (
                      <option key={et.code} value={et.code}>
                        Etapa: {et.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowCotizadorModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Calculator size={14} />
                    <span className="hidden sm:inline">Cotizador Rápido</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleBot}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-colors ${
                      selectedConv.bot_paused
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    }`}
                    title="Pausar o reactivar asistente IA en esta conversación"
                  >
                    {selectedConv.bot_paused ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                    <span className="hidden md:inline">
                      {selectedConv.bot_paused ? 'IA Pausada' : 'IA Activa'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFicha360(!showFicha360)}
                    className="p-1.5 rounded-xl border border-[var(--border)] text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={showFicha360 ? 'Ocultar Ficha Óptica 360°' : 'Mostrar Ficha Óptica 360°'}
                  >
                    {showFicha360 ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                  </button>
                </div>
              </div>

              {/* Banner de confirmación para notificar lentes listos */}
              {showConfirmListoRetirar && (
                <div className="px-4 py-2.5 bg-emerald-600 text-white flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <BellRing size={15} className="animate-bounce" />
                    <span>
                      ¿Deseas enviar automáticamente el aviso por WhatsApp: &ldquo;¡Tus lentes están listos para retirar en Óptica Vortix!&rdquo;?
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleChangeEtapa('LISTO_PARA_RETIRAR', true)}
                      className="px-3 py-1 rounded-lg bg-white text-emerald-800 font-black hover:bg-emerald-50"
                    >
                      Sí, Notificar y Mover
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeEtapa('LISTO_PARA_RETIRAR', false)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
                    >
                      Solo Mover Etapa
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmListoRetirar(false)}
                      className="p-1 hover:bg-emerald-700 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline de Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                    <span className="text-xs font-semibold">Cargando historial de mensajes...</span>
                  </div>
                ) : mensajes.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[var(--secondary)]">
                    No hay mensajes aún en esta conversación. Puedes enviar una plantilla o usar el Cotizador Rápido.
                  </div>
                ) : (
                  mensajes.map((msg) => {
                    const isOutbound = msg.direccion === 'outbound'
                    const isNota = msg.tipo === 'nota_interna'
                    const isCotizacion = msg.tipo === 'cotizacion'

                    if (isNota) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="max-w-lg w-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-2xl px-4 py-2.5 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              <span className="flex items-center gap-1">
                                <StickyNote size={12} /> Nota Interna de Óptica ({msg.autor_nombre || 'Asesor'})
                              </span>
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.contenido}</p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xl rounded-2xl px-4 py-2.5 text-xs shadow-xs space-y-2 ${
                            isCotizacion
                              ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white border border-indigo-400/30'
                              : isOutbound
                              ? 'bg-indigo-600 text-white rounded-br-xs'
                              : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-bl-xs'
                          }`}
                        >
                          {/* Si tiene imagen (ej. foto de receta o placa enviada) */}
                          {msg.media_url && (
                            <div className="space-y-1.5">
                              <div className="relative rounded-xl overflow-hidden border border-white/15 bg-black/10">
                                <img
                                  src={msg.media_url}
                                  alt="Adjunto óptico"
                                  className="max-h-60 w-auto object-contain mx-auto cursor-pointer"
                                  onClick={() => {
                                    setVisorImagenUrl(msg.media_url || null)
                                    setVisorZoom(1)
                                    setVisorRotation(0)
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVisorImagenUrl(msg.media_url || null)
                                    setVisorZoom(1)
                                    setVisorRotation(0)
                                  }}
                                  className="px-2 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-[10px] font-bold flex items-center gap-1"
                                >
                                  <ZoomIn size={11} /> Zoom / Rotar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRunOcrReceta(msg.media_url!)}
                                  disabled={ocrLoading}
                                  className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-black flex items-center gap-1 shadow-xs"
                                >
                                  {ocrLoading ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={11} />
                                  )}
                                  ✨ Extraer Graduación con IA
                                </button>
                              </div>
                            </div>
                          )}

                          {msg.template_name && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/15 text-[10px] font-bold">
                              <FileText size={10} /> Plantilla Meta: {msg.template_name}
                            </div>
                          )}

                          <p className="whitespace-pre-wrap leading-relaxed">{msg.contenido}</p>

                          <div
                            className={`flex items-center justify-end gap-1.5 text-[10px] ${
                              isOutbound ? 'text-indigo-100/80' : 'text-[var(--secondary)]'
                            }`}
                          >
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isOutbound && (
                              <span>
                                {msg.estado_entrega === 'read' ? (
                                  <CheckCheck size={13} className="text-cyan-300" />
                                ) : msg.estado_entrega === 'delivered' ? (
                                  <CheckCheck size={13} />
                                ) : (
                                  <Check size={13} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra Inferior de Escritura con Herramientas Ópticas */}
              <div className="p-3 bg-[var(--card)] border-t border-[var(--border)] space-y-2 relative">
                {/* Menú flotante de Atajos Rápidos (/) */}
                {showSlashMenu && (
                  <div className="absolute bottom-full left-3 mb-2 w-80 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-black uppercase text-[var(--secondary)] flex items-center justify-between">
                      <span>Atajos Rápidos de Óptica Vortix</span>
                      <button type="button" onClick={() => setShowSlashMenu(false)}>
                        <X size={12} />
                      </button>
                    </div>
                    {ATAJOS_RAPIDOS.map((at) => (
                      <button
                        key={at.cmd}
                        type="button"
                        onClick={() => {
                          setInputMsg(at.texto)
                          setShowSlashMenu(false)
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-indigo-500/10 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                            {at.cmd}
                          </span>
                          <span className="text-[10px] font-semibold text-[var(--foreground)]">
                            {at.titulo}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--secondary)] truncate">{at.texto}</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Menú flotante de Copiloto IA Óptico */}
                {showCopilotoMenu && (
                  <div className="absolute bottom-full left-36 mb-2 w-64 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                      ✨ Copiloto IA Óptico (Gemini)
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopilotoIA('sugerir')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500/10"
                    >
                      👓 Sugerir argumento óptico según receta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopilotoIA('mejorar')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500/10"
                    >
                      ✨ Mejorar tono comercial del borrador
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopilotoIA('resumir')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500/10"
                    >
                      📋 Resumir conversación para laboratorio
                    </button>
                  </div>
                )}

                {/* Barra de Botones de Acción Rápida */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowSlashMenu(!showSlashMenu)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 text-[var(--foreground)] border border-[var(--border)]"
                    >
                      / Atajos
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCopilotoMenu(!showCopilotoMenu)}
                      disabled={copilotoLoading}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1"
                    >
                      {copilotoLoading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Wand2 size={12} />
                      )}
                      ✨ Copiloto IA
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCotizadorModal(true)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"
                    >
                      <Calculator size={12} />
                      🧮 Cotizador 1-Clic
                    </button>

                    <button
                      type="button"
                      onClick={openPlacasModal}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1"
                    >
                      <ImageIcon size={12} />
                      🖼️ Placas
                    </button>

                    <button
                      type="button"
                      onClick={openTemplatesModal}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1"
                    >
                      <FileText size={12} />
                      📋 Plantillas Meta
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModoNotaInterna(!modoNotaInterna)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                      modoNotaInterna
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] border-[var(--border)]'
                    }`}
                  >
                    <StickyNote size={12} />
                    {modoNotaInterna ? 'Modo Nota Interna Activo' : 'Nota Interna'}
                  </button>
                </div>

                {/* Input y botón Enviar */}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputMsg}
                    onChange={(e) => {
                      setInputMsg(e.target.value)
                      if (e.target.value === '/') setShowSlashMenu(true)
                    }}
                    placeholder={
                      modoNotaInterna
                        ? 'Escribe una nota interna para el equipo de óptica (no se envía al paciente)...'
                        : 'Escribe un mensaje por WhatsApp o presiona "/" para atajos rápidos...'
                    }
                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 ${
                      modoNotaInterna
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400/50 focus:ring-amber-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 border-[var(--border)] focus:ring-indigo-500/30'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!inputMsg.trim() || sendingMsg}
                    className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all ${
                      modoNotaInterna
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {sendingMsg ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    <span>{modoNotaInterna ? 'Guardar Nota' : 'Enviar'}</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </section>

        {/* PANEL DERECHO: Ficha Óptica 360° Geclisa */}
        {selectedConv && showFicha360 && (
          <aside className="w-80 xl:w-96 border-l border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3.5 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Glasses size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[var(--foreground)]">
                    Ficha Óptica 360° Geclisa
                  </h3>
                  <p className="text-[10px] text-[var(--secondary)]">
                    Receta Dióptrica, Voucher & Evolución
                  </p>
                </div>
              </div>
              {graduacion.fuente && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Fuente: {graduacion.fuente}
                </span>
              )}
            </div>

            <div className="p-3.5 space-y-4">
              {/* Cupón Activo */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket size={18} className="text-amber-500" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                      Voucher de Descuento
                    </p>
                    <p className="text-xs font-black text-[var(--foreground)]">
                      {selectedConv.cupon_codigo || '#VORTIX-20OFF'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCotizadorModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] hover:bg-amber-400"
                >
                  Cotizar con Cupón
                </button>
              </div>

              {/* Tabla Editable de Graduación / Receta Óptica (OD y OI) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[var(--foreground)]">
                    Graduación / Receta (Lejos)
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveGraduacion}
                    disabled={savingGraduacion}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center gap-1"
                  >
                    {savingGraduacion ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Save size={11} />
                    )}
                    Guardar Ficha
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-[var(--secondary)]">
                      <tr>
                        <th className="py-1.5 px-2 text-left">Ojo</th>
                        <th className="py-1.5 px-1.5 text-center">Esfera</th>
                        <th className="py-1.5 px-1.5 text-center">Cilindro</th>
                        <th className="py-1.5 px-1.5 text-center">Eje</th>
                        <th className="py-1.5 px-1.5 text-center">DNP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      <tr>
                        <td className="py-1.5 px-2 font-black text-indigo-600 dark:text-indigo-400">
                          OD
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="+0.00"
                            value={graduacion.od_lejos?.esfera || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, esfera: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="-0.00"
                            value={graduacion.od_lejos?.cilindro || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, cilindro: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="0°"
                            value={graduacion.od_lejos?.eje || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, eje: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="31"
                            value={graduacion.od_lejos?.dnp || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                od_lejos: { ...graduacion.od_lejos, dnp: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-black text-emerald-600 dark:text-emerald-400">
                          OI
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="+0.00"
                            value={graduacion.oi_lejos?.esfera || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, esfera: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="-0.00"
                            value={graduacion.oi_lejos?.cilindro || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, cilindro: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="0°"
                            value={graduacion.oi_lejos?.eje || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, eje: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="31"
                            value={graduacion.oi_lejos?.dnp || ''}
                            onChange={(e) =>
                              setGraduacion({
                                ...graduacion,
                                oi_lejos: { ...graduacion.oi_lejos, dnp: e.target.value },
                              })
                            }
                            className="w-full text-center py-1 rounded bg-slate-50 dark:bg-slate-800/70 border border-[var(--border)] font-semibold"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Adición Cerca y Tipo de Cristal Sugerido */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Adición (ADD)
                    </label>
                    <input
                      type="text"
                      placeholder="+2.00"
                      value={graduacion.add || ''}
                      onChange={(e) => setGraduacion({ ...graduacion, add: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Cristal / Lente Sugerido
                    </label>
                    <input
                      type="text"
                      placeholder="Multifocal Digital / Blue Cut"
                      value={graduacion.tipo_lente_sugerido || ''}
                      onChange={(e) =>
                        setGraduacion({ ...graduacion, tipo_lente_sugerido: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-[var(--border)] font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Indicación Médica Detectada en Geclisa */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Stethoscope size={12} /> Evolución Geclisa Detectada
                  </span>
                  {evolucionHoy?.fecha && (
                    <span className="text-[10px] text-[var(--secondary)] font-semibold">
                      {evolucionHoy.fecha}
                    </span>
                  )}
                </div>

                {evolucionHoy ? (
                  <>
                    <p className="text-[11px] font-bold text-[var(--foreground)]">
                      Dr/a. {evolucionHoy.medico}
                    </p>
                    <p className="text-xs text-[var(--secondary)] bg-[var(--card)] p-2.5 rounded-xl border border-[var(--border)] leading-relaxed">
                      {evolucionHoy.texto_evolucion}
                    </p>
                  </>
                ) : selectedConv.resumen_receta ? (
                  <p className="text-xs text-[var(--secondary)] leading-relaxed">
                    {selectedConv.resumen_receta}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--secondary)]">
                    Sin evolución óptica sincronizada hoy o paciente de ingreso directo. Puedes extraer la receta desde una foto enviada en el chat con el botón <strong>✨ Extraer Graduación con IA</strong>.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL: Cotizador Comparativo 1-Clic */}
      {showCotizadorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">
                    Cotizador Comparativo 1-Clic — Óptica Vortix
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Arma hasta 3 alternativas con el descuento del voucher y envíalas formateadas por WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCotizadorModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--foreground)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {cotizadorOpciones.map((op, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end"
                >
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Título Opción #{idx + 1}
                    </label>
                    <input
                      type="text"
                      value={op.titulo}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].titulo = e.target.value
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Cristal
                    </label>
                    <input
                      type="text"
                      value={op.cristal}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].cristal = e.target.value
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Tratamiento
                    </label>
                    <input
                      type="text"
                      value={op.tratamiento}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].tratamiento = e.target.value
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--secondary)] mb-0.5">
                      Precio Lista ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={op.precio_lista}
                      onChange={(e) => {
                        const val = sanitizeMoney(e.target.value)
                        const next = [...cotizadorOpciones]
                        next[idx].precio_lista = val
                        next[idx].precio_final = Math.round(val * (1 - next[idx].descuento_pct / 100))
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--card)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-600 mb-0.5">
                      Final c/ {op.descuento_pct}% OFF
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={op.precio_final}
                      onChange={(e) => {
                        const next = [...cotizadorOpciones]
                        next[idx].precio_final = sanitizeMoney(e.target.value)
                        setCotizadorOpciones(next)
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/30"
                    />
                  </div>
                </div>
              ))}
            </div>

            {cotizadorError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold">
                ⚠️ {cotizadorError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowCotizadorModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnviarCotizacion}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-md"
              >
                <Send size={14} />
                Enviar Cotización Comparativa al Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visor OCR de Imagen de Receta con Zoom y Rotación */}
      {visorImagenUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-white/15 rounded-2xl px-4 py-2 mb-3 text-white">
            <button
              type="button"
              onClick={() => setVisorZoom((z) => Math.min(z + 0.25, 3))}
              className="p-1.5 hover:bg-white/10 rounded-lg"
              title="Acercar"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => setVisorZoom((z) => Math.max(z - 0.25, 0.5))}
              className="p-1.5 hover:bg-white/10 rounded-lg"
              title="Alejar"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={() => setVisorRotation((r) => (r + 90) % 360)}
              className="p-1.5 hover:bg-white/10 rounded-lg"
              title="Rotar 90°"
            >
              <RotateCw size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleRunOcrReceta(visorImagenUrl, visorRotation)}
              disabled={ocrLoading}
              className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
            >
              {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              ✨ Extraer Graduación con IA (Gemini Vision)
            </button>
            <button
              type="button"
              onClick={() => setVisorImagenUrl(null)}
              className="p-1.5 hover:bg-red-500/20 text-red-300 rounded-lg ml-2"
            >
              <X size={16} />
            </button>
          </div>
          <div className="max-w-4xl max-h-[80vh] overflow-auto flex items-center justify-center p-4">
            <img
              src={visorImagenUrl}
              alt="Receta Óptica"
              style={{
                transform: `scale(${visorZoom}) rotate(${visorRotation}deg)`,
                transition: 'transform 0.2s ease',
              }}
              className="max-h-[75vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* MODAL: Galería de Placas Gráficas */}
      {showPlacasModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--foreground)]">
                🖼️ Enviar Placa Gráfica Promocional al Chat
              </h3>
              <button type="button" onClick={() => setShowPlacasModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {placas.length === 0 ? (
                <p className="text-xs text-[var(--secondary)] col-span-2 text-center py-6">
                  Puedes subir nuevas placas promocionales desde la sección &ldquo;Campañas & Placas&rdquo;.
                </p>
              ) : (
                placas.map((pl) => (
                  <div
                    key={pl.id}
                    className="p-3 rounded-2xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-[var(--foreground)]">{pl.titulo}</p>
                      <p className="text-[10px] text-[var(--secondary)]">{pl.categoria}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedConv) return
                        setShowPlacasModal(false)
                        await apiFetch(`/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`, {
                          method: 'POST',
                          body: JSON.stringify({
                            tipo: 'image',
                            media_url: pl.url_imagen,
                            contenido: pl.descripcion || pl.titulo,
                          }),
                        })
                        handleSelectConv(selectedConv)
                      }}
                      className="w-full py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                    >
                      Enviar Placa al Paciente
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Plantillas Oficiales Meta de Óptica */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-black text-[var(--foreground)]">
                  📋 Enviar Plantilla Oficial Meta (Línea 3 Óptica)
                </h3>
                <p className="text-xs text-[var(--secondary)]">
                  Abre o continúa la conversación con plantillas aprobadas por Meta Cloud API
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTemplatesModal(false)
                  setTemplateError(null)
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-[var(--foreground)]"
              >
                <X size={18} />
              </button>
            </div>

            {templateError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{templateError}</span>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(templatesMeta.length > 0
                ? templatesMeta
                : [
                    {
                      name: 'vortix_beneficio_turno_v1',
                      titulo_amigable: 'Óptica Vortix • Voucher Descuento por Turno',
                      status: 'APPROVED',
                      category: 'MARKETING',
                      language: 'es_AR',
                      body_text:
                        'Hola {{1}}, vimos que tenes un turno programado en la clinica para el {{2}}. Por ser paciente, tenes activado un beneficio exclusivo de {{3}} en *Optica Vortix* presentando tu codigo {{4}} luego de tu consulta.',
                    },
                    {
                      name: 'vortix_receta_lentes_aereos_v1',
                      titulo_amigable: 'Óptica Vortix • Cotización Receta Lentes Aéreos',
                      status: 'APPROVED',
                      category: 'UTILITY',
                      language: 'es_AR',
                      body_text:
                        'Hola {{1}}, esperamos que haya salido muy bien tu consulta de hoy con {{2}}. En *Optica Vortix* ya podemos cotizar tu nueva receta de anteojos por WhatsApp con tu descuento de paciente ({{3}}) - Codigo {{4}}.',
                    },
                    {
                      name: 'vortix_receta_lentes_contacto_v1',
                      titulo_amigable: 'Óptica Vortix • Lentes de Contacto y Adaptación',
                      status: 'APPROVED',
                      category: 'UTILITY',
                      language: 'es_AR',
                      body_text:
                        'Hola {{1}}, vimos que en tu consulta con {{2}} se evaluaron Lentes de Contacto. En *Optica Vortix* contamos con stock de lentes blandos esfericos, toricos y multifocales con beneficio exclusivo (Codigo {{3}}).',
                    },
                    {
                      name: 'vortix_lentes_listos_retiro_v1',
                      titulo_amigable: 'Óptica Vortix • Aviso de Lentes Listos para Retirar',
                      status: 'APPROVED',
                      category: 'UTILITY',
                      language: 'es_AR',
                      body_text:
                        '¡Hola {{1}}! Te escribimos desde *Optica Vortix* para avisarte que tu pedido ({{2}}) ya salio del laboratorio, paso el control de calidad optico y esta *listo para retirar* en el horario de {{3}}.',
                    },
                  ]
              ).map((tpl: any) => {
                const isApproved = tpl.status === 'APPROVED'
                const isPending = tpl.status === 'PENDING'
                const badgeColor = isApproved
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : isPending
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-500/15 text-slate-500'

                const isSendingThis = sendingTemplate === tpl.name

                return (
                  <div
                    key={tpl.name}
                    className="p-3.5 rounded-2xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-[var(--foreground)]">
                          {tpl.titulo_amigable || tpl.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({tpl.name})
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${badgeColor}`}>
                          {tpl.status || 'OFFICIAL'}
                        </span>
                      </div>
                      {(tpl.body_text || tpl.preview_body) && (
                        <p className="text-[11px] text-[var(--secondary)] line-clamp-2 leading-relaxed">
                          {tpl.body_text || tpl.preview_body}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isSendingThis || Boolean(sendingTemplate)}
                      onClick={async () => {
                        if (!selectedConv || sendingTemplate) return
                        setSendingTemplate(tpl.name)
                        setTemplateError(null)

                        try {
                          const res = await apiFetch(
                            `/api/optica-vortix/conversaciones/${selectedConv.id}/enviar`,
                            {
                              method: 'POST',
                              body: JSON.stringify({
                                tipo: 'template',
                                template_name: tpl.name,
                                template_language: tpl.language || 'es_AR',
                                contenido: tpl.body_text || tpl.preview_body || `[Plantilla Meta: ${tpl.name}]`,
                                parameters: [selectedConv.nombre_paciente || 'Paciente'],
                              }),
                            }
                          )

                          if (res.ok) {
                            const resData = await res.json()
                            if (resData.mensaje) {
                              setMensajes((prev) => [...prev, resData.mensaje])
                            }
                            setShowTemplatesModal(false)
                            handleSelectConv(selectedConv, true) // refresco silencioso sin spinner
                          } else {
                            const errData = await res.json().catch(() => null)
                            setTemplateError(
                              errData?.detail ||
                                'Meta Cloud API rechazó el envío de la plantilla. Verifica que esté aprobada.'
                            )
                          }
                        } catch (err: any) {
                          setTemplateError(err?.message || 'Error de conexión enviando plantilla')
                        } finally {
                          setSendingTemplate(null)
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      {isSendingThis ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Enviar a WhatsApp</span>
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Iniciar Nueva Conversación */}
      {showNuevaConvModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleIniciarConversacion}
            className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-black text-[var(--foreground)]">
                Iniciar Nueva Conversación en Óptica Vortix
              </h3>
              <button type="button" onClick={() => setShowNuevaConvModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                  Teléfono WhatsApp (Ej: 5492615551234)
                </label>
                <input
                  type="text"
                  required
                  value={nuevoTel}
                  onChange={(e) => setNuevoTel(e.target.value)}
                  placeholder="549261..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                  Nombre y Apellido del Paciente
                </label>
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: María Gómez"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                  DNI (Opcional para cruzar con Geclisa)
                </label>
                <input
                  type="text"
                  value={nuevoDni}
                  onChange={(e) => setNuevoDni(e.target.value)}
                  placeholder="Ej: 30123456"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowNuevaConvModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Crear y Abrir Chat
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
