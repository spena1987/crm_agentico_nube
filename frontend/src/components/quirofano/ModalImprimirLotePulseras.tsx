'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Printer,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Zap,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  Copy
} from 'lucide-react'
import QRCode from 'qrcode'
import { apiFetch } from '@/lib/api'
import { formatDateArg } from '@/lib/dateUtils'

interface TurnoPulseraItem {
  turno_id: string
  qr_payload: string
  paciente: {
    id?: string
    nombre: string
    dni: string
    edad?: string
    fecha_nacimiento?: string
    obra_social?: string
    nro_afiliado?: string
    telefono?: string
  }
  cirugia: {
    codigo_turno?: string
    fecha?: string
    hora?: string
    ojo?: string
    ojo_texto?: string
    practica_codigo?: string
    practica_nombre?: string
    cirujano_nombre?: string
    quirofano_nombre?: string
    quirofano_id?: string
    lleva_lente?: boolean
    lente_tipo?: string
    lente_dioptria?: string
    lente_lote?: string
  }
  estado?: string
  pulsera_impresa: boolean
  pulsera_impresa_at?: string
}

interface ModalImprimirLotePulserasProps {
  isOpen: boolean
  onClose: () => void
  fechaDefault?: string
  quirofanos?: any[]
  onPulserasImpresas?: () => void
}

export default function ModalImprimirLotePulseras({
  isOpen,
  onClose,
  fechaDefault,
  quirofanos = [],
  onPulserasImpresas
}: ModalImprimirLotePulserasProps) {
  const [fecha, setFecha] = useState<string>(() => fechaDefault || new Date().toISOString().slice(0, 10))
  const [cargando, setCargando] = useState<boolean>(true)
  const [imprimiendo, setImprimiendo] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [turnos, setTurnos] = useState<TurnoPulseraItem[]>([])

  // Filtros
  const [filtroQuirofano, setFiltroQuirofano] = useState<string>('todos')
  const [filtroCirujano, setFiltroCirujano] = useState<string>('todos')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'solo_pendientes' | 'solo_impresas'>('todos')
  const [busqueda, setBusqueda] = useState<string>('')

  // Selección de IDs para imprimir
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  // QRs en memoria base64
  const [qrMap, setQrMap] = useState<Record<string, string>>({})
  const [generandoQrs, setGenerandoQrs] = useState<boolean>(false)

  // Vista Previa de una pulsera específica (carrusel)
  const [previewIndex, setPreviewIndex] = useState<number>(0)

  // Guía Modo Kiosk
  const [mostrarGuiaKiosk, setMostrarGuiaKiosk] = useState<boolean>(false)
  const [copiado, setCopiado] = useState<boolean>(false)

  const comandoKiosk = `chrome.exe --app="https://crm-agentico-nube.vercel.app/asesoramiento-recepcion" --kiosk-printing --user-data-dir="C:\\MedCRM_Kiosk"`

  const handleCopiarComando = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(comandoKiosk)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  // Sincronizar fecha inicial
  useEffect(() => {
    if (fechaDefault) {
      setFecha(fechaDefault)
    }
  }, [fechaDefault])

  // Cargar datos de turnos del día
  useEffect(() => {
    if (!isOpen || !fecha) return

    let isMounted = true
    const cargarLote = async () => {
      try {
        setCargando(true)
        setError(null)
        const res = await apiFetch(`/api/turnos-quirofano-lote-pulseras?fecha=${fecha}`)
        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.detail || data.error || 'No se pudieron obtener las pulseras de la fecha.')
        }

        if (!isMounted) return

        const items: TurnoPulseraItem[] = data.pulseras || []
        setTurnos(items)

        // Por defecto: Si hay pendientes, preseleccionar únicamente las pendientes
        // Si todas ya están impresas, seleccionar todas
        const pendientes = items.filter((p) => !p.pulsera_impresa)
        if (pendientes.length > 0) {
          setSeleccionados(new Set(pendientes.map((p) => p.turno_id)))
        } else {
          setSeleccionados(new Set(items.map((p) => p.turno_id)))
        }

        setPreviewIndex(0)

        // Generar QRs vectoriales en memoria para todas las pulseras
        setGenerandoQrs(true)
        const qrs: Record<string, string> = {}
        await Promise.all(
          items.map(async (p) => {
            try {
              const url = await QRCode.toDataURL(p.qr_payload, {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 250,
                color: { dark: '#000000', light: '#FFFFFF' }
              })
              qrs[p.turno_id] = url
            } catch (err) {
              console.error('Error generando QR para turno', p.turno_id, err)
            }
          })
        )
        if (isMounted) {
          setQrMap(qrs)
          setGenerandoQrs(false)
        }
      } catch (err: any) {
        if (!isMounted) return
        console.error('Error cargando lote de pulseras:', err)
        setError(err.message || 'Error al preparar las pulseras del día.')
      } finally {
        if (isMounted) setCargando(false)
      }
    }

    cargarLote()

    return () => {
      isMounted = false
    }
  }, [isOpen, fecha])

  // Extraer listas de cirujanos únicos para los filtros
  const cirujanosDisponibles = useMemo(() => {
    const set = new Set<string>()
    turnos.forEach((t) => {
      if (t.cirugia?.cirujano_nombre) set.add(t.cirugia.cirujano_nombre)
    })
    return Array.from(set).sort()
  }, [turnos])

  // Filtrado de la lista en pantalla
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      // Filtro Quirófano
      if (filtroQuirofano !== 'todos') {
        if (t.cirugia?.quirofano_id !== filtroQuirofano) return false
      }
      // Filtro Cirujano
      if (filtroCirujano !== 'todos') {
        if (t.cirugia?.cirujano_nombre !== filtroCirujano) return false
      }
      // Filtro Estado
      if (filtroEstado === 'solo_pendientes' && t.pulsera_impresa) return false
      if (filtroEstado === 'solo_impresas' && !t.pulsera_impresa) return false
      // Búsqueda libre
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim()
        const matchPac = t.paciente?.nombre?.toLowerCase().includes(q)
        const matchDni = t.paciente?.dni?.toLowerCase().includes(q)
        const matchCod = t.cirugia?.codigo_turno?.toLowerCase().includes(q)
        const matchCir = t.cirugia?.cirujano_nombre?.toLowerCase().includes(q)
        if (!matchPac && !matchDni && !matchCod && !matchCir) return false
      }
      return true
    })
  }, [turnos, filtroQuirofano, filtroCirujano, filtroEstado, busqueda])

  // Lista de pulseras activamente seleccionadas que se imprimirán
  const turnosAImprimir = useMemo(() => {
    return turnos.filter((t) => seleccionados.has(t.turno_id))
  }, [turnos, seleccionados])

  // Turno actual en vista previa
  const turnoPreview = turnosAImprimir[previewIndex] || turnosAImprimir[0] || null

  // Métodos de selección rápida
  const handleSeleccionarTodos = () => {
    const nuevos = new Set(seleccionados)
    turnosFiltrados.forEach((t) => nuevos.add(t.turno_id))
    setSeleccionados(nuevos)
  }

  const handleSeleccionarSoloPendientes = () => {
    const nuevos = new Set<string>()
    turnosFiltrados.forEach((t) => {
      if (!t.pulsera_impresa) nuevos.add(t.turno_id)
    })
    setSeleccionados(nuevos)
    setFiltroEstado('solo_pendientes')
  }

  const handleDeseleccionarTodos = () => {
    setSeleccionados(new Set())
  }

  const handleToggleSeleccion = (id: string) => {
    const nuevos = new Set(seleccionados)
    if (nuevos.has(id)) {
      nuevos.delete(id)
    } else {
      nuevos.add(id)
    }
    setSeleccionados(nuevos)
  }

  // Disparar Impresión Continua en Rollo (Batch)
  const handleImprimirLote = async () => {
    if (turnosAImprimir.length === 0) return

    try {
      setImprimiendo(true)

      const idsAImprimir = turnosAImprimir.map((t) => t.turno_id)

      // 1. Notificar al backend en lote para asentar auditoría y estado pulsera_impresa = true
      try {
        await apiFetch('/api/turnos-quirofano-marcar-pulseras-lote', {
          method: 'POST',
          body: JSON.stringify({
            turno_ids: idsAImprimir,
            usuario_crm: 'Operador Recepción (Lote)'
          })
        })
      } catch (e) {
        console.warn('Aviso registrando impresión en lote:', e)
      }

      if (onPulserasImpresas) {
        onPulserasImpresas()
      }

      // 2. Disparar impresión nativa del navegador calibrada para TSC TDP-225 continua
      window.print()
    } catch (err: any) {
      console.error('Error al imprimir lote de pulseras:', err)
    } finally {
      setImprimiendo(false)
    }
  }

  if (!isOpen) return null

  // Formateo de fecha DD/MM/YYYY y hora HH:MM hs
  const formatearFecha = (f?: string) => {
    if (!f) return ''
    try {
      const parte = f.split('T')[0]
      const [y, m, d] = parte.split('-')
      if (y && m && d) return `${d}/${m}/${y}`
      return f
    } catch {
      return f
    }
  }

  return (
    <>
      {/* ==================================================================== */}
      {/* 1. MODAL EN PANTALLA (INTERACTIVO PARA LA ASESORA / RECEPCIÓN) */}
      {/* ==================================================================== */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200 no-print">
        <div className="bg-neutral-900 border border-blue-500/30 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          
          {/* Header del Modal */}
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-neutral-950/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-inner">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Impresión Masiva Continua de Pulseras Térmicas
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40">
                    TSC TDP-225 • ArgusID® ProBand (240x25 mm)
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Emisión en rollo continuo de todas las pulseras quirúrgicas del día con código QR y time-out OMS
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Barra de Filtros y Control de Fecha */}
          <div className="p-3.5 bg-neutral-950/60 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Selector de Fecha */}
            <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-xl border border-gray-800">
              <Calendar size={14} className="text-blue-400" />
              <span className="text-gray-300 font-bold">Fecha:</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent text-white font-mono font-bold focus:outline-none cursor-pointer"
              />
              <span className="text-gray-400 text-[11px] font-normal">({formatDateArg(fecha)})</span>
            </div>

            {/* Filtros de Quirófano y Cirujano */}
            <div className="flex items-center gap-2 flex-wrap">
              {quirofanos.length > 0 && (
                <select
                  value={filtroQuirofano}
                  onChange={(e) => setFiltroQuirofano(e.target.value)}
                  className="px-2.5 py-1.5 bg-neutral-900 border border-gray-800 rounded-xl text-gray-300 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="todos">Todos los Quirófanos</option>
                  {quirofanos.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nombre}
                    </option>
                  ))}
                </select>
              )}

              {cirujanosDisponibles.length > 0 && (
                <select
                  value={filtroCirujano}
                  onChange={(e) => setFiltroCirujano(e.target.value)}
                  className="px-2.5 py-1.5 bg-neutral-900 border border-gray-800 rounded-xl text-gray-300 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="todos">Todos los Cirujanos</option>
                  {cirujanosDisponibles.map((cir) => (
                    <option key={cir} value={cir}>
                      {cir}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as any)}
                className="px-2.5 py-1.5 bg-neutral-900 border border-gray-800 rounded-xl text-gray-300 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="todos">Todos los Estados</option>
                <option value="solo_pendientes">Solo Pendientes</option>
                <option value="solo_impresas">Solo Ya Impresas</option>
              </select>
            </div>

            {/* Botones de Selección Rápida */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSeleccionarTodos}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                title="Seleccionar todas las cirugías listadas"
              >
                <CheckSquare size={13} className="text-blue-400" />
                <span>Todos ({turnosFiltrados.length})</span>
              </button>

              <button
                type="button"
                onClick={handleSeleccionarSoloPendientes}
                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                title="Seleccionar únicamente las pulseras que aún no fueron impresas"
              >
                <Zap size={13} className="text-amber-400" />
                <span>Solo Pendientes</span>
              </button>

              <button
                type="button"
                onClick={handleDeseleccionarTodos}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-400 hover:text-gray-300 rounded-lg text-[11px] transition"
                title="Limpiar selección"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Cuerpo Principal del Modal */}
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {cargando ? (
              <div className="p-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                <Loader2 size={32} className="animate-spin text-blue-400" />
                <span>Cargando cirugías programadas y generando códigos QR...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            ) : turnos.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400 space-y-1">
                <p className="font-bold text-gray-300 text-sm">No hay cirugías programadas para el {formatDateArg(fecha)}.</p>
                <p className="text-gray-500">Seleccione otra fecha en el selector superior para imprimir pulseras.</p>
              </div>
            ) : (
              <>
                {/* 1. TABLA / LISTADO DE PACIENTES PARA REVISIÓN */}
                <div className="border border-gray-800 rounded-xl overflow-hidden bg-neutral-950/50">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-neutral-900 sticky top-0 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-800">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">Sel.</th>
                          <th className="py-2 px-3">Hora</th>
                          <th className="py-2 px-3">Código</th>
                          <th className="py-2 px-3">Paciente & DNI</th>
                          <th className="py-2 px-3">Ojo</th>
                          <th className="py-2 px-3">Cirugía & LIO</th>
                          <th className="py-2 px-3">Cirujano / Quirófano</th>
                          <th className="py-2 px-3 text-center">Estado Pulsera</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 font-sans">
                        {turnosFiltrados.map((t) => {
                          const estaSel = seleccionados.has(t.turno_id)
                          const ojo = t.cirugia?.ojo || 'OD'
                          return (
                            <tr
                              key={t.turno_id}
                              onClick={() => handleToggleSeleccion(t.turno_id)}
                              className={`cursor-pointer transition-colors ${
                                estaSel ? 'bg-blue-950/30 hover:bg-blue-950/40' : 'hover:bg-neutral-900/60 opacity-60'
                              }`}
                            >
                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={estaSel}
                                  onChange={() => handleToggleSeleccion(t.turno_id)}
                                  className="w-4 h-4 rounded text-blue-600 bg-neutral-800 border-gray-700 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-gray-200">
                                {t.cirugia?.hora || '--:--'} hs
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-gray-400">
                                {t.cirugia?.codigo_turno || '-'}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-bold text-white uppercase">{t.paciente?.nombre}</div>
                                <div className="text-[10px] text-gray-400 font-mono">
                                  DNI: {t.paciente?.dni} {t.paciente?.edad && `• ${t.paciente.edad}`} {t.paciente?.obra_social && `• ${t.paciente.obra_social}`}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-black text-white border border-gray-700">
                                  {ojo === 'OD' ? 'OJO DERECHO (OD)' : ojo === 'OI' ? 'OJO IZQUIERDO (OI)' : 'AMBOS OJOS (AO)'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <div className="text-gray-200 truncate max-w-[220px]" title={t.cirugia?.practica_nombre}>
                                  {t.cirugia?.practica_nombre}
                                </div>
                                <div className="text-[10px] text-blue-400 font-semibold truncate max-w-[220px]">
                                  {t.cirugia?.lleva_lente && t.cirugia?.lente_tipo
                                    ? `LIO: ${t.cirugia.lente_tipo} (${t.cirugia.lente_dioptria || ''} D)`
                                    : 'Sin LIO'}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-gray-300">
                                <div>{t.cirugia?.cirujano_nombre}</div>
                                <div className="text-[10px] text-gray-400">{t.cirugia?.quirofano_nombre}</div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {t.pulsera_impresa ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                                    <CheckCircle2 size={11} />
                                    <span>Impresa</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/70 text-amber-400 border border-amber-800/40">
                                    <Zap size={11} />
                                    <span>Pendiente</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. VISTA PREVIA INTERACTIVA DE PULSERA (CARRUSEL) */}
                {turnoPreview && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                      <div className="flex items-center gap-2">
                        <span>Vista Previa del Lote:</span>
                        <span className="text-white font-mono text-[11px] bg-neutral-800 px-2 py-0.5 rounded">
                          Pulsera {previewIndex + 1} de {turnosAImprimir.length} seleccionada(s)
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={previewIndex <= 0}
                          onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                          className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Ver pulsera anterior"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={previewIndex >= turnosAImprimir.length - 1}
                          onClick={() => setPreviewIndex((prev) => Math.min(turnosAImprimir.length - 1, prev + 1))}
                          className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Ver pulsera siguiente"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Simulación Gráfica ArgusID ProBand (4cm Solapa + 20cm Impresión) */}
                    <div className="p-3 bg-neutral-950 rounded-2xl border border-gray-800 overflow-x-auto flex items-center justify-center">
                      <div className="flex items-center select-none">
                        
                        {/* Solapa Inicial de Cierre Autoadhesivo (4 cm / 40mm) */}
                        <div className="w-[105px] h-[105px] bg-neutral-800/90 border border-gray-600 rounded-l-lg flex flex-col items-center justify-center p-2 text-center text-gray-300 gap-0.5 shadow-inner">
                          <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider">Cierre</span>
                          <span className="text-[7.5px] font-semibold text-gray-200">Autoadhesivo</span>
                          <span className="text-[7px] text-gray-400 font-mono">4 cm (40 mm)</span>
                          <div className="w-8 h-1 bg-amber-400/40 rounded-full mt-1" />
                        </div>

                        {/* Cuerpo Imprimible Blanco Extendido (20 cm / 200mm) */}
                        <div className="w-[620px] h-[105px] bg-white text-black rounded-r-lg shadow-xl p-2 flex items-center gap-2.5 border border-gray-400 relative font-sans">
                          
                          {/* Código QR */}
                          <div className="shrink-0 flex flex-col items-center justify-center">
                            {qrMap[turnoPreview.turno_id] ? (
                              <img
                                src={qrMap[turnoPreview.turno_id]}
                                alt="QR Trazabilidad"
                                className="w-[82px] h-[82px] object-contain"
                              />
                            ) : (
                              <div className="w-[82px] h-[82px] bg-gray-200 animate-pulse rounded" />
                            )}
                            <span className="text-[8px] font-mono font-bold text-gray-700 tracking-tighter">MEDCRM-QX</span>
                          </div>

                          {/* Información Clínica */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5 leading-tight">
                            
                            {/* Fila 1: Paciente, Ojo y Horario */}
                            <div className="flex items-center justify-start gap-2 border-b border-black/20 pb-1">
                              <div className="min-w-0 flex items-center gap-1.5 shrink-0">
                                <h4 className="text-xs font-black uppercase text-black truncate tracking-tight">
                                  <span className="font-mono bg-black text-white px-1 py-0.5 rounded text-[10px] mr-1.5">
                                    {turnoPreview.cirugia?.codigo_turno || 'QX-26-0000'}
                                  </span>
                                  {turnoPreview.paciente?.nombre}
                                </h4>
                              </div>

                              <div className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider text-white uppercase bg-black shrink-0">
                                {turnoPreview.cirugia?.ojo_texto || 'OJO DERECHO (OD)'}
                              </div>

                              <span className="text-[9px] font-bold text-gray-900 bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                                {formatearFecha(turnoPreview.cirugia?.fecha)} • {turnoPreview.cirugia?.hora} hs
                              </span>
                            </div>

                            {/* Fila 2: DNI, Edad y Cobertura */}
                            <div className="text-[9px] font-bold text-gray-800 font-mono">
                              DNI: {turnoPreview.paciente?.dni} {turnoPreview.paciente?.edad && `• ${turnoPreview.paciente.edad}`} {turnoPreview.paciente?.obra_social && `• ${turnoPreview.paciente.obra_social}`} {turnoPreview.paciente?.nro_afiliado && `(${turnoPreview.paciente.nro_afiliado})`}
                            </div>

                            {/* Fila 3: Práctica y Cirujano */}
                            <div className="text-[9px] text-gray-900 font-extrabold truncate">
                              {turnoPreview.cirugia?.practica_nombre} • <span className="font-semibold text-gray-700">Cirujano:</span> <strong className="text-black">{turnoPreview.cirugia?.cirujano_nombre}</strong> {turnoPreview.cirugia?.quirofano_nombre && `(${turnoPreview.cirugia?.quirofano_nombre})`}
                            </div>

                            {/* Fila 4: LIO */}
                            <div className="text-[8.5px] font-extrabold text-blue-900 pt-0.5 border-t border-black/10 truncate">
                              {turnoPreview.cirugia?.lleva_lente && turnoPreview.cirugia?.lente_tipo
                                ? `LIO: ${turnoPreview.cirugia.lente_tipo} (${turnoPreview.cirugia.lente_dioptria || ''} D)`
                                : 'Sin LIO'}
                            </div>

                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Panel de Modo Kiosk / Atajo */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-gray-800 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-amber-400" />
                      <span className="font-bold text-white">Impresión Silenciosa en Rollo Continuo</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMostrarGuiaKiosk(!mostrarGuiaKiosk)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                    >
                      <span>{mostrarGuiaKiosk ? 'Ocultar Guía' : 'Ver Guía de Impresora TSC'}</span>
                      {mostrarGuiaKiosk ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-1">
                    Al confirmar, el CRM enviará el lote de <strong>{turnosAImprimir.length} pulseras</strong> en una sola orden continua a la <strong>TSC TDP-225</strong>. El sensor de separación avanzará automáticamente entre pulsera y pulsera.
                  </p>

                  {mostrarGuiaKiosk && (
                    <div className="mt-2.5 p-3 bg-neutral-900/90 rounded-lg border border-blue-500/20 space-y-2 text-[11px] text-gray-300">
                      <div>
                        <p className="font-bold text-white mb-0.5">Calibración recomendada en Windows (Driver TSC TDP-225):</p>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-300 pl-1">
                          <li>Tamaño de etiqueta: <strong>Ancho: 25.0 mm • Alto/Largo: 240.0 mm</strong> (Landscape).</li>
                          <li>Tipo de sensor: <strong>Marca Negra (Black Mark) o Gap</strong> • Márgenes: <strong>0 mm</strong>.</li>
                        </ul>
                      </div>
                      <div className="pt-1 border-t border-gray-800 flex items-center justify-between">
                        <span className="text-gray-400">Atajo para omitir ventana de diálogo de Windows:</span>
                        <button
                          type="button"
                          onClick={handleCopiarComando}
                          className="px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded border border-blue-500/30 flex items-center gap-1 transition text-[10px]"
                        >
                          {copiado ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          <span>{copiado ? '¡Copiado!' : 'Copiar comando Kiosk'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer de Acciones */}
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-neutral-950/90">
            <div className="text-xs text-gray-400">
              <span className="font-bold text-white">{turnosAImprimir.length}</span> de <span className="font-bold text-white">{turnos.length}</span> pulseras seleccionadas para imprimir
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition"
              >
                Cerrar
              </button>

              <button
                type="button"
                disabled={cargando || !!error || imprimiendo || turnosAImprimir.length === 0}
                onClick={handleImprimirLote}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {imprimiendo ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                <span>Imprimir Lote ({turnosAImprimir.length} Pulseras Continuas)</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. ÁREA DE IMPRESIÓN MULTI-PÁGINA CONTINUA EN ROLLO TÉRMICO */}
      {/* ==================================================================== */}
      <div id="batch-wristband-print-area" className="only-print">
        {turnosAImprimir.map((t, idx) => {
          const pac = t.paciente || {}
          const cir = t.cirugia || {}
          const qrUrl = qrMap[t.turno_id]
          const fechaCirugia = formatearFecha(cir.fecha)
          const horaCirugia = cir.hora ? `${cir.hora} hs` : ''
          const fechaHoraTexto = [fechaCirugia, horaCirugia].filter(Boolean).join(' • ')

          return (
            <div key={t.turno_id || idx} className="wristband-batch-item">
              <div className="wristband-printable-body">
                
                {/* Código QR */}
                <div className="wristband-qr-box">
                  {qrUrl && <img src={qrUrl} alt="QR" className="wristband-qr-img" />}
                  <span className="wristband-qr-label">MEDCRM</span>
                </div>

                {/* Contenido Clínico */}
                <div className="wristband-info-box">
                  {/* Fila 1: Código, Nombre, Ojo y Fecha / Hora */}
                  <div className="wristband-row-header">
                    <div className="wristband-paciente-title">
                      [{cir.codigo_turno || 'QX-26-0000'}] {pac.nombre}
                    </div>

                    <div className="wristband-ojo-badge">
                      {cir.ojo_texto || 'OJO DERECHO (OD)'}
                    </div>

                    {fechaHoraTexto && (
                      <div className="wristband-fecha-hora">
                        {fechaHoraTexto}
                      </div>
                    )}
                  </div>

                  {/* Fila 2: Subtítulo DNI, Edad y Cobertura */}
                  <div className="wristband-sub-info">
                    DNI: {pac.dni} {pac.edad && `• ${pac.edad}`} {pac.obra_social && `• ${pac.obra_social}`} {pac.nro_afiliado && `(${pac.nro_afiliado})`}
                  </div>

                  {/* Fila 3: Práctica y Cirujano */}
                  <div className="wristband-practica-text">
                    {cir.practica_nombre} • Cirujano: {cir.cirujano_nombre} {cir.quirofano_nombre && `(${cir.quirofano_nombre})`}
                  </div>

                  {/* Fila 4: LIO */}
                  <div className="wristband-bottom-row">
                    <span className="wristband-lio-text">
                      {cir.lleva_lente && cir.lente_tipo ? `LIO: ${cir.lente_tipo} (${cir.lente_dioptria || ''} D)` : 'Sin LIO'}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </div>

      {/* ESTILOS CSS ESTRICTOS PARA IMPRESIÓN CONTINUA EN ROLLO */}
      <style jsx global>{`
        @media screen {
          .only-print {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: 240mm 25mm landscape;
            margin: 0 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          .no-print, .no-print * {
            display: none !important;
          }

          #batch-wristband-print-area, #batch-wristband-print-area * {
            visibility: visible !important;
          }

          #batch-wristband-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 240mm !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            display: block !important;
          }

          /* Cada pulsera individual en una página del rollo */
          .wristband-batch-item {
            width: 240mm !important;
            height: 24.8mm !important;
            max-height: 25mm !important;
            display: flex !important;
            align-items: center !important;
            padding-left: 40mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            background: #FFFFFF !important;
          }

          /* La última pulsera no debe forzar una página vacía final */
          .wristband-batch-item:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* ÁREA IMPRIMIBLE BLANCA (200 MM X 24 MM) */
          .wristband-printable-body {
            width: 200mm !important;
            height: 24mm !important;
            border: 1pt solid #000000 !important;
            border-radius: 2pt !important;
            display: flex !important;
            align-items: center !important;
            padding: 1.2mm 3mm !important;
            gap: 3.5mm !important;
            box-sizing: border-box !important;
            background: #FFFFFF !important;
          }

          .wristband-qr-box {
            width: 20mm !important;
            height: 20mm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }

          .wristband-qr-img {
            width: 18mm !important;
            height: 18mm !important;
            object-fit: contain !important;
            image-rendering: pixelated !important;
          }

          .wristband-qr-label {
            font-size: 4.5pt !important;
            font-family: monospace !important;
            font-weight: 900 !important;
            color: #000000 !important;
            line-height: 1 !important;
            margin-top: 0.5mm !important;
          }

          .wristband-info-box {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
            overflow: hidden !important;
            line-height: 1.15 !important;
          }

          .wristband-row-header {
            display: flex !important;
            justify-content: flex-start !important;
            align-items: center !important;
            border-bottom: 0.6pt solid #000000 !important;
            padding-bottom: 0.4mm !important;
            gap: 2.5mm !important;
          }

          .wristband-paciente-title {
            font-size: 8.5pt !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            white-space: nowrap !important;
            color: #000000 !important;
            font-family: Arial, sans-serif !important;
            flex-shrink: 0 !important;
          }

          .wristband-ojo-badge {
            background: #000000 !important;
            color: #FFFFFF !important;
            font-size: 7.5pt !important;
            font-weight: 900 !important;
            padding: 0.5mm 2mm !important;
            border-radius: 2pt !important;
            white-space: nowrap !important;
            font-family: Arial, sans-serif !important;
            flex-shrink: 0 !important;
          }

          .wristband-fecha-hora {
            font-size: 6.5pt !important;
            font-weight: 800 !important;
            color: #000000 !important;
            white-space: nowrap !important;
            font-family: Arial, sans-serif !important;
            border: 0.5pt solid #000000 !important;
            padding: 0.2mm 1.5mm !important;
            border-radius: 2pt !important;
            background: #f4f4f4 !important;
            flex-shrink: 0 !important;
          }

          .wristband-sub-info {
            font-size: 6pt !important;
            font-weight: 700 !important;
            color: #000000 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            font-family: Arial, sans-serif !important;
          }

          .wristband-practica-text {
            font-size: 6.5pt !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            color: #000000 !important;
            font-family: Arial, sans-serif !important;
          }

          .wristband-bottom-row {
            display: flex !important;
            align-items: center !important;
            font-size: 6.5pt !important;
            font-weight: 800 !important;
            border-top: 0.6pt solid #000000 !important;
            padding-top: 0.4mm !important;
            color: #000000 !important;
            font-family: Arial, sans-serif !important;
          }

          .wristband-lio-text {
            color: #000000 !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
          }
        }
      `}</style>
    </>
  )
}
