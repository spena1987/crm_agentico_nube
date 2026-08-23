'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Receipt,
  Download,
  Send,
  Trash2,
  CheckCircle2,
  Clock,
  Plus,
  Stethoscope,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Filter
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'

export interface ItemPresupuestoDetalle {
  id?: string
  nombre?: string
  cantidad?: number
  precio_unitario?: number
  subtotal?: number
  moneda?: string
}

export interface PresupuestoPaciente {
  id: string
  paciente_id: string
  asesoria_id?: string | null
  total: number
  total_ars?: number
  total_usd?: number
  estado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
  pdf_url?: string
  created_at: string
  updated_at?: string
  items_presupuesto?: ItemPresupuestoDetalle[]
}

interface CasoQuirurgicoSimple {
  id: string
  practica_nombre?: string
  practica_codigo?: string
  estado?: string
}

interface ModalHistorialPresupuestosPacienteProps {
  isOpen: boolean
  onClose: () => void
  pacienteId: string
  pacienteNombre: string
  pacienteDni?: string
  pacienteTelefono?: string
  casosQuirurgicos?: CasoQuirurgicoSimple[]
  onAbrirEmisorPresupuesto?: () => void
  onEnviarPresupuestoWhatsApp?: (presupuesto: PresupuestoPaciente) => void
}

export default function ModalHistorialPresupuestosPaciente({
  isOpen,
  onClose,
  pacienteId,
  pacienteNombre,
  pacienteDni,
  pacienteTelefono,
  casosQuirurgicos = [],
  onAbrirEmisorPresupuesto,
  onEnviarPresupuestoWhatsApp
}: ModalHistorialPresupuestosPacienteProps) {
  const [presupuestos, setPresupuestos] = useState<PresupuestoPaciente[]>([])
  const [casosLocales, setCasosLocales] = useState<CasoQuirurgicoSimple[]>(casosQuirurgicos)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'aprobado' | 'enviado' | 'rechazado'>('todos')
  const [filtroCaso, setFiltroCaso] = useState<string>('todos')
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [actualizandoEstadoId, setActualizandoEstadoId] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  // Cargar Presupuestos y Casos Quirúrgicos de forma ultra resiliente (API + Fallback Supabase)
  const fetchDatos = async () => {
    if (!pacienteId) return
    try {
      setLoading(true)
      setError(null)
      let listaPresupuestos: PresupuestoPaciente[] = []

      // 1. Intentar consultar Backend API
      try {
        const res = await fetch(`${BACKEND_URL}/api/pacientes/${pacienteId}/presupuestos`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.presupuestos)) {
            listaPresupuestos = data.presupuestos
          }
        }
      } catch (apiErr) {
        console.warn('API backend no disponible en este momento, consultando base de datos Supabase:', apiErr)
      }

      // 2. Si la API no respondió, consultar Supabase directamente con JOIN a servicios_precios
      if (listaPresupuestos.length === 0) {
        const { data: sbData, error: sbErr } = await supabase
          .from('presupuestos')
          .select('*, items_presupuesto(*, servicios_precios(nombre_prestacion, codigo))')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })

        if (!sbErr && sbData && sbData.length > 0) {
          listaPresupuestos = sbData.map((p: any) => {
            const items = (p.items_presupuesto || []).map((it: any) => ({
              id: it.id,
              nombre: it.nombre || it.servicios_precios?.nombre_prestacion || 'Prestación médica',
              cantidad: it.cantidad || 1,
              precio_unitario: Number(it.precio_unitario || 0),
              subtotal: Number(it.subtotal || 0),
              moneda: it.moneda || 'ARS'
            }))

            return {
              ...p,
              items_presupuesto: items
            }
          })
        }
      }

      setPresupuestos(listaPresupuestos)

      // 3. Cargar / Sincronizar Casos Quirúrgicos del paciente
      const { data: qxData, error: qxErr } = await supabase
        .from('asesorias_quirurgicas')
        .select('id, practica_nombre, practica_codigo, estado')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })

      if (!qxErr && qxData && qxData.length > 0) {
        setCasosLocales(qxData as CasoQuirurgicoSimple[])
      } else if (casosQuirurgicos.length > 0) {
        setCasosLocales(casosQuirurgicos)
      }

    } catch (err: any) {
      console.error('Error general al cargar presupuestos:', err)
      setError('Ocurrió un problema al cargar los presupuestos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && pacienteId) {
      fetchDatos()
    }
  }, [isOpen, pacienteId])

  // Mapeo rápido de asesoria_id a nombre del caso
  const mapaCasos = useMemo(() => {
    const mapa: Record<string, { titulo: string; codigo?: string; index: number }> = {}
    casosLocales.forEach((c, idx) => {
      mapa[c.id] = {
        titulo: c.practica_nombre || 'Cirugía Programada',
        codigo: c.practica_codigo,
        index: idx + 1
      }
    })
    return mapa
  }, [casosLocales])

  // KPIs Financieros
  const kpis = useMemo(() => {
    let totalArs = 0
    let totalUsd = 0
    let aprobados = 0
    let enviados = 0
    let rechazados = 0

    presupuestos.forEach((p) => {
      const ars = Number(p.total_ars || (p.total_usd ? 0 : p.total) || 0)
      const usd = Number(p.total_usd || 0)
      totalArs += ars
      totalUsd += usd

      if (p.estado === 'aprobado') aprobados++
      else if (p.estado === 'enviado') enviados++
      else if (p.estado === 'rechazado') rechazados++
    })

    return { totalArs, totalUsd, aprobados, enviados, rechazados, total: presupuestos.length }
  }, [presupuestos])

  // Filtrado de presupuestos
  const presupuestosFiltrados = useMemo(() => {
    return presupuestos.filter((p) => {
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
      if (filtroCaso !== 'todos') {
        if (filtroCaso === 'sin_caso' && p.asesoria_id) return false
        if (filtroCaso !== 'sin_caso' && p.asesoria_id !== filtroCaso) return false
      }
      return true
    })
  }, [presupuestos, filtroEstado, filtroCaso])

  // Cambiar estado comercial de un presupuesto
  const handleCambiarEstado = async (presId: string, nuevoEstado: 'aprobado' | 'enviado' | 'rechazado') => {
    try {
      setActualizandoEstadoId(presId)
      const res = await fetch(`${BACKEND_URL}/api/presupuestos/${presId}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })

      if (res.ok) {
        setPresupuestos((prev) =>
          prev.map((p) => (p.id === presId ? { ...p, estado: nuevoEstado } : p))
        )
      } else {
        await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', presId)
        setPresupuestos((prev) =>
          prev.map((p) => (p.id === presId ? { ...p, estado: nuevoEstado } : p))
        )
      }
    } catch (e) {
      console.error('Error al cambiar estado del presupuesto:', e)
    } finally {
      setActualizandoEstadoId(null)
    }
  }

  // Eliminar presupuesto
  const handleEliminar = async (presId: string) => {
    const ok = window.confirm('¿Seguro que deseas eliminar este presupuesto? Esta acción no se puede deshacer.')
    if (!ok) return

    try {
      setEliminandoId(presId)
      const res = await fetch(`${BACKEND_URL}/api/presupuestos/${presId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setPresupuestos((prev) => prev.filter((p) => p.id !== presId))
      } else {
        await supabase.from('presupuestos').delete().eq('id', presId)
        setPresupuestos((prev) => prev.filter((p) => p.id !== presId))
      }
    } catch (e) {
      console.error('Error al eliminar presupuesto:', e)
    } finally {
      setEliminandoId(null)
    }
  }

  // Copiar ID al portapapeles
  const handleCopiarId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[90vh] bg-neutral-900/95 border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* HEADER DEL MODAL */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-inner shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Centro de Cotizaciones & Presupuestos
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 font-bold">
                  {kpis.total} emitido{kpis.total !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <span>Paciente: <strong className="text-white">{pacienteNombre}</strong></span>
                {pacienteDni && <span>• DNI: {pacienteDni}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAbrirEmisorPresupuesto && (
              <button
                type="button"
                onClick={() => onAbrirEmisorPresupuesto()}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>+ Nueva Cotización PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors"
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* KPIS FINANCIEROS Y FILTROS */}
        <div className="p-4 border-b border-[var(--border)] bg-neutral-950/40 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-[var(--border)]">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Cotizado ($ ARS)</span>
              <span className="text-sm sm:text-base font-mono font-black text-emerald-400 mt-0.5 block">
                $ {kpis.totalArs.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-[var(--border)]">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Total Cotizado (USD)</span>
              <span className="text-sm sm:text-base font-mono font-black text-cyan-400 mt-0.5 block">
                USD $ {kpis.totalUsd.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-[var(--border)]">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Aprobados / Confirmados</span>
              <span className="text-sm sm:text-base font-mono font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                {kpis.aprobados}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-[var(--border)]">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">En Análisis / Pendientes</span>
              <span className="text-sm sm:text-base font-mono font-black text-amber-400 mt-0.5 flex items-center gap-1.5">
                <Clock size={14} />
                {kpis.enviados}
              </span>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mr-1">
                <Filter size={12} /> Estado:
              </span>
              {(['todos', 'aprobado', 'enviado', 'rechazado'] as const).map((est) => (
                <button
                  key={est}
                  type="button"
                  onClick={() => setFiltroEstado(est)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all border ${
                    filtroEstado === est
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-neutral-900 text-gray-400 border-[var(--border)] hover:bg-neutral-800 hover:text-gray-200'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>

            {casosLocales.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400">Filtrar Cirugía:</span>
                <select
                  value={filtroCaso}
                  onChange={(e) => setFiltroCaso(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-neutral-900 border border-[var(--border)] rounded-lg text-gray-300 font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="todos">Todos los procedimientos</option>
                  {casosLocales.map((c, idx) => (
                    <option key={c.id} value={c.id}>
                      Cirugía #{idx + 1}: {c.practica_nombre || 'Sin título'}
                    </option>
                  ))}
                  <option value="sin_caso">Sin caso quirúrgico asignado</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* TABLA / LISTADO DE PRESUPUESTOS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
              <RefreshCw size={24} className="animate-spin text-blue-400" />
              <span className="text-xs">Cargando presupuestos del paciente...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : presupuestosFiltrados.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-neutral-950/40 rounded-xl border border-dashed border-gray-800">
              <Receipt size={32} className="text-gray-600" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-300">No se encontraron presupuestos</p>
                <p className="text-xs text-gray-500 max-w-sm">
                  {filtroEstado !== 'todos' || filtroCaso !== 'todos'
                    ? 'No hay cotizaciones que coincidan con los filtros seleccionados.'
                    : 'Aún no se han emitido cotizaciones para este paciente.'}
                </p>
              </div>
              {onAbrirEmisorPresupuesto && (
                <button
                  type="button"
                  onClick={onAbrirEmisorPresupuesto}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow"
                >
                  + Emitir Primera Cotización PDF
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {presupuestosFiltrados.map((p) => {
                const casoInfo = p.asesoria_id ? mapaCasos[p.asesoria_id] : null

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-neutral-900/80 border border-[var(--border)] hover:border-gray-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      
                      {/* Lado Izquierdo */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopiarId(p.id)}
                            className="text-xs font-mono font-bold text-white hover:text-blue-300 flex items-center gap-1 bg-neutral-800 px-2 py-0.5 rounded-md border border-gray-700"
                            title="Copiar ID de presupuesto"
                          >
                            #{p.id.slice(0, 8)}
                            {copiadoId === p.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>

                          {casoInfo ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                              <Stethoscope size={11} />
                              Cirugía #{casoInfo.index}: {casoInfo.titulo}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-800 text-gray-400 border border-gray-700">
                              Cotización General
                            </span>
                          )}

                          <span className="text-[11px] text-gray-400 font-mono">
                            {new Date(p.created_at).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {/* Desglose de Ítems */}
                        {p.items_presupuesto && p.items_presupuesto.length > 0 && (
                          <div className="pt-1 space-y-0.5">
                            {p.items_presupuesto.map((it, idx) => (
                              <div key={idx} className="text-xs text-gray-300 flex items-center gap-1.5">
                                <span className="text-gray-500">•</span>
                                <span className="font-medium text-white">{it.nombre || 'Prestación médica'}</span>
                                <span className="text-gray-400 font-mono text-[11px]">
                                  ({it.cantidad}x {it.moneda || 'ARS'} ${Number(it.precio_unitario || 0).toLocaleString('es-AR')})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lado Derecho */}
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center flex-wrap justify-end">
                        <div className="text-right">
                          {(p.total_ars || (p.total_usd ? 0 : p.total)) > 0 && (
                            <div className="text-sm font-mono font-black text-emerald-400">
                              ARS ${Number(p.total_ars || p.total || 0).toLocaleString('es-AR')}
                            </div>
                          )}
                          {Number(p.total_usd || 0) > 0 && (
                            <div className="text-xs font-mono font-bold text-cyan-400">
                              USD ${Number(p.total_usd).toLocaleString('es-AR')}
                            </div>
                          )}
                        </div>

                        {/* Selector de Estado */}
                        <select
                          value={p.estado}
                          disabled={actualizandoEstadoId === p.id}
                          onChange={(e) => handleCambiarEstado(p.id, e.target.value as any)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border capitalize focus:outline-none ${
                            p.estado === 'aprobado'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : p.estado === 'rechazado'
                              ? 'bg-red-950 text-red-300 border-red-500/40'
                              : 'bg-amber-950 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          <option value="enviado">Enviado</option>
                          <option value="aprobado">Aprobado</option>
                          <option value="rechazado">Rechazado</option>
                        </select>

                        {/* Acciones */}
                        <div className="flex items-center gap-1">
                          {p.pdf_url && (
                            <a
                              href={p.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-blue-300 border border-gray-700 rounded-lg text-xs font-bold transition-all"
                              title="Ver / Descargar PDF Oficial"
                            >
                              <Download size={14} />
                            </a>
                          )}

                          {onEnviarPresupuestoWhatsApp && (
                            <button
                              type="button"
                              onClick={() => onEnviarPresupuestoWhatsApp(p)}
                              className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50 rounded-lg text-xs font-bold transition-all"
                              title="Enviar presupuesto por WhatsApp"
                            >
                              <Send size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={eliminandoId === p.id}
                            onClick={() => handleEliminar(p.id)}
                            className="p-1.5 bg-neutral-900 hover:bg-red-950/40 text-gray-500 hover:text-red-400 border border-[var(--border)] rounded-lg text-xs transition-all"
                            title="Eliminar presupuesto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3.5 border-t border-[var(--border)] bg-neutral-950/80 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Total en vista: <strong className="text-gray-300">{presupuestosFiltrados.length}</strong> de {presupuestos.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
