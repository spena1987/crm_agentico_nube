'use client'

import React, { useEffect, useState } from 'react'
import ModalEnviarPresupuestoWhatsApp from '@/components/ModalEnviarPresupuestoWhatsApp'
import ModalVisorPdfPresupuesto from '@/components/ModalVisorPdfPresupuesto'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import {
  FileText,
  Trash2,
  Send,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Eye,
  Info
} from 'lucide-react'

interface Paciente {
  id?: string
  nombre: string
  telefono: string
}

interface Presupuesto {
  id: string
  numero_presupuesto?: number | null
  paciente_id: string
  asesoria_id?: string | null
  estado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
  total: number
  total_ars?: number
  total_usd?: number
  pdf_url: string | null
  motivo_desistimiento?: string | null
  created_at: string
  pacientes: Paciente | null
  asesorias_quirurgicas?: {
    id: string
    estado: string
    fecha_definitiva_cirugia?: string | null
  } | null
}

export default function PresupuestosPage() {
  const { can, canAccess } = usePermissions()
  const canApprove = can('presupuestos', 'aprobar_presupuesto')
  const canDelete = can('presupuestos', 'eliminar')

  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(false)
  const [conciliando, setConciliando] = useState(false)
  const [mensajeConciliacion, setMensajeConciliacion] = useState<string | null>(null)

  // Estado para el modal de WhatsApp
  const [selectedPresupuestoWhatsApp, setSelectedPresupuestoWhatsApp] = useState<Presupuesto | null>(null)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)

  // Estado para el visor de PDF integrado
  const [selectedPresupuestoVisor, setSelectedPresupuestoVisor] = useState<Presupuesto | null>(null)
  const [isVisorModalOpen, setIsVisorModalOpen] = useState(false)

  const fetchPresupuestos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('presupuestos')
        .select(`
          id,
          numero_presupuesto,
          paciente_id,
          asesoria_id,
          estado,
          total,
          total_ars,
          total_usd,
          pdf_url,
          motivo_desistimiento,
          created_at,
          pacientes (
            id,
            nombre,
            telefono
          ),
          asesorias_quirurgicas!presupuestos_asesoria_id_fkey (
            id,
            estado,
            fecha_definitiva_cirugia
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPresupuestos(data as unknown as Presupuesto[])
    } catch (err) {
      console.error('Error cargando listado presupuestos:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConciliarConQuirofano = async () => {
    try {
      setConciliando(true)
      setMensajeConciliacion(null)
      const res = await fetch(`${BACKEND_URL}/api/presupuestos/conciliar-estados`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeConciliacion(
          `Sincronización completada: ${data.total_conciliados} presupuesto(s) actualizados a "Aprobado" automáticamente tras conciliar con Quirófano.`
        )
        await fetchPresupuestos()
        setTimeout(() => setMensajeConciliacion(null), 7000)
      } else {
        alert(data.detail || data.error || 'No se pudo completar la sincronización.')
      }
    } catch (e: any) {
      console.error('Error al conciliar presupuestos:', e)
      alert('Error de conexión al sincronizar con quirófano.')
    } finally {
      setConciliando(false)
    }
  }

  useEffect(() => {
    fetchPresupuestos()

    // Suscripción Realtime a la tabla presupuestos para sincronización instantánea
    const channel = supabase
      .channel('presupuestos-live-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presupuestos' },
        () => {
          fetchPresupuestos()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Cambiar estado del presupuesto con sincronización bidireccional
  const updateEstado = async (id: string, nuevoEstado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado') => {
    try {
      // 1. Actualización optimista en la UI
      setPresupuestos((prev) => 
        prev.map((p) => p.id === id ? { ...p, estado: nuevoEstado } : p)
      )

      // 2. Notificar al backend para que sincronice la etapa en asesorías quirúrgicas
      try {
        const res = await fetch(`${BACKEND_URL}/api/presupuestos/${id}/estado`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nuevoEstado })
        })
        if (!res.ok) {
          throw new Error('Error en API')
        }
      } catch (apiErr) {
        // Fallback Supabase
        await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id)
      }
    } catch (error) {
      console.error('Error actualizando estado presupuesto:', error)
      fetchPresupuestos()
    }
  }

  // Abrir modal de WhatsApp para un presupuesto
  const handleOpenWhatsApp = (pres: Presupuesto) => {
    setSelectedPresupuestoWhatsApp(pres)
    setIsWhatsAppModalOpen(true)
  }

  // Abrir visor de PDF
  const handleOpenVisor = (pres: Presupuesto) => {
    setSelectedPresupuestoVisor(pres)
    setIsVisorModalOpen(true)
  }

  // Eliminar presupuesto
  const deletePresupuesto = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este presupuesto?')) return
    try {
      const { error } = await supabase
        .from('presupuestos')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setPresupuestos((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error('Error eliminando presupuesto:', error)
    }
  }

  const getBadgeColor = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
      case 'rechazado':
        return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
      case 'enviado':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    }
  }

  // Cálculo de días transcurridos para badges de seguimiento
  const getFollowUpStatus = (createdAt: string, estado: string) => {
    if (estado === 'aprobado' || estado === 'rechazado') return null
    const diffDays = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 3600 * 24))
    if (diffDays <= 2) {
      return { tipo: 'reciente', label: `${diffDays === 0 ? 'Hoy' : `${diffDays}d`} • Reciente`, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200' }
    } else if (diffDays <= 7) {
      return { tipo: 'seguimiento', label: `${diffDays}d • Requiere Seguimiento`, color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200' }
    } else {
      return { tipo: 'vencimiento', label: `${diffDays}d • Por vencer`, color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200' }
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-5 md:p-6 space-y-5 min-w-0 pb-12 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Presupuestos Médicos & Cotizaciones
          </h1>
          <p className="text-xs text-[var(--secondary)]">
            Historial oficial y repositorio de presupuestos médicos multi-moneda. Las cotizaciones se emiten y gestionan directamente desde el caso quirúrgico del paciente.
          </p>
        </div>

        {/* Acciones Globales */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleConciliarConQuirofano}
            disabled={conciliando}
            className="px-3.5 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 dark:text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            title="Sincronizar automáticamente estados de presupuestos con cirugías confirmadas y turnos de quirófano"
          >
            <RefreshCw size={13} className={conciliando ? 'animate-spin' : ''} />
            {conciliando ? 'Sincronizando...' : 'Sincronizar con Quirófano'}
          </button>
          <button 
            type="button"
            onClick={fetchPresupuestos}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-[var(--secondary)] hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-bold border border-[var(--border)]"
            title="Recargar listado"
          >
            <RefreshCw size={13} /> Recargar
          </button>
        </div>
      </div>

      {/* Banner Informativo de Trazabilidad Quirúrgica */}
      <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200/90 flex items-center gap-2.5">
        <Info size={16} className="text-blue-400 shrink-0" />
        <span>
          <strong>Trazabilidad Quirúrgica Activa:</strong> Para garantizar la continuidad clínica, prequirúrgica y el control de ojos/procedimientos, la emisión de presupuestos se realiza exclusivamente desde el <strong>Sector de Asesoramiento Quirúrgico & Cirugías</strong> en el expediente de cada paciente.
        </span>
      </div>

      {/* Historial de Presupuestos Emitidos */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <FileText className="text-blue-600" size={18} />
            Historial de Presupuestos ({presupuestos.length})
          </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConciliarConQuirofano}
                disabled={conciliando}
                className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 dark:text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                title="Sincronizar automáticamente estados de presupuestos con cirugías confirmadas y turnos de quirófano"
              >
                <RefreshCw size={12} className={conciliando ? 'animate-spin' : ''} />
                {conciliando ? 'Sincronizando...' : 'Sincronizar con Quirófano'}
              </button>
              <button 
                type="button"
                onClick={fetchPresupuestos}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[var(--secondary)] hover:text-blue-600 transition-colors flex items-center gap-1 text-xs font-bold"
                title="Recargar listado"
              >
                <RefreshCw size={13} /> Recargar
              </button>
            </div>
          </div>

          {mensajeConciliacion && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{mensajeConciliacion}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-xs text-[var(--secondary)]">Cargando historial de presupuestos...</div>
          ) : presupuestos.length === 0 ? (
            <div className="text-center py-12 text-xs text-[var(--secondary)] border border-dashed border-[var(--border)] rounded-xl">
              No hay presupuestos médicos emitidos aún.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-slate-400 font-semibold uppercase text-[11px]">
                    <th className="py-3 pl-2">Número</th>
                    <th>Paciente</th>
                    <th>Emisión & Seguimiento</th>
                    <th className="text-right">Monto Multi-Moneda</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center">PDF</th>
                    <th className="text-right pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {presupuestos.map((pres) => {
                    const ars = Number(pres.total_ars || 0)
                    const usd = Number(pres.total_usd || 0)
                    const totalDefault = Number(pres.total || 0)
                    const followUp = getFollowUpStatus(pres.created_at, pres.estado)

                    return (
                      <tr key={pres.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition text-slate-700 dark:text-slate-300">
                        <td className="py-3 pl-2 font-mono font-bold text-[11px] text-blue-600">
                          {pres.numero_presupuesto ? String(pres.numero_presupuesto).padStart(8, '0') : pres.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {pres.pacientes?.nombre || 'Paciente sin nombre'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <span>{pres.pacientes?.telefono || 'Sin teléfono'}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="text-slate-600 dark:text-slate-300 font-medium">
                            {new Date(pres.created_at).toLocaleDateString('es-AR')}
                          </div>
                          {followUp && (
                            <button
                              type="button"
                              onClick={() => handleOpenWhatsApp(pres)}
                              className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 hover:opacity-80 transition cursor-pointer ${followUp.color}`}
                              title="Clic para enviar mensaje de seguimiento por WhatsApp"
                            >
                              {followUp.label}
                            </button>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono font-bold">
                          {ars > 0 && usd > 0 ? (
                            <div className="space-y-0.5">
                              <div className="text-emerald-600 font-extrabold text-[11px]">
                                ${ars.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                              </div>
                              <div className="text-amber-600 font-extrabold text-[11px]">
                                USD {usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          ) : usd > 0 ? (
                            <span className="text-amber-600 font-extrabold">
                              USD {usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-extrabold">
                              ${(ars > 0 ? ars : totalDefault).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {canApprove ? (
                            <div className="flex flex-col items-center gap-1">
                              <select
                                value={pres.estado}
                                onChange={(e) => updateEstado(pres.id, e.target.value as any)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/25 ${getBadgeColor(pres.estado)}`}
                              >
                                <option value="borrador">Borrador</option>
                                <option value="enviado">Enviado</option>
                                <option value="aprobado">Aprobado</option>
                                <option value="rechazado">Rechazado</option>
                              </select>
                              {pres.asesorias_quirurgicas?.estado && ['confirmado', 'fecha_programada', 'programado', 'operado'].includes(pres.asesorias_quirurgicas.estado) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5" title={`Caso Quirúrgico: ${pres.asesorias_quirurgicas.estado.toUpperCase()}${pres.asesorias_quirurgicas.fecha_definitiva_cirugia ? ` (Qx: ${pres.asesorias_quirurgicas.fecha_definitiva_cirugia})` : ''}`}>
                                  Qx {pres.asesorias_quirurgicas.estado === 'operado' ? 'Operado' : 'Programado'}
                                </span>
                              )}
                              {pres.estado === 'rechazado' && pres.motivo_desistimiento && (
                                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-medium max-w-[140px] truncate" title={pres.motivo_desistimiento}>
                                  {pres.motivo_desistimiento}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${getBadgeColor(pres.estado)}`}>
                                {pres.estado.toUpperCase()}
                              </span>
                              {pres.asesorias_quirurgicas?.estado && ['confirmado', 'fecha_programada', 'programado', 'operado'].includes(pres.asesorias_quirurgicas.estado) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5" title={`Caso Quirúrgico: ${pres.asesorias_quirurgicas.estado.toUpperCase()}${pres.asesorias_quirurgicas.fecha_definitiva_cirugia ? ` (Qx: ${pres.asesorias_quirurgicas.fecha_definitiva_cirugia})` : ''}`}>
                                  Qx {pres.asesorias_quirurgicas.estado === 'operado' ? 'Operado' : 'Programado'}
                                </span>
                              )}
                              {pres.estado === 'rechazado' && pres.motivo_desistimiento && (
                                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-medium max-w-[140px] truncate" title={pres.motivo_desistimiento}>
                                  {pres.motivo_desistimiento}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {pres.pdf_url ? (
                            <button
                              type="button"
                              onClick={() => handleOpenVisor(pres)}
                              className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg inline-flex items-center justify-center transition"
                              title="Previsualizar PDF Oficial en Visor Integrado"
                            >
                              <Eye size={14} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No generado</span>
                          )}
                        </td>
                        <td className="py-3 text-right pr-2 space-x-1">
                          {canAccess('chat') && (
                            <button
                              onClick={() => handleOpenWhatsApp(pres)}
                              className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition inline-flex items-center"
                              title="Enviar / Reenviar por WhatsApp con 1 Clic"
                            >
                              <Send size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => deletePresupuesto(pres.id)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded-lg transition"
                              title="Eliminar presupuesto"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* Modal de Envío por WhatsApp */}
      {selectedPresupuestoWhatsApp && (
        <ModalEnviarPresupuestoWhatsApp
          isOpen={isWhatsAppModalOpen}
          onClose={() => {
            setIsWhatsAppModalOpen(false)
            setSelectedPresupuestoWhatsApp(null)
          }}
          presupuestoId={selectedPresupuestoWhatsApp.id}
          pacienteNombre={selectedPresupuestoWhatsApp.pacientes?.nombre}
          telefonoDefault={selectedPresupuestoWhatsApp.pacientes?.telefono}
          pdfUrl={selectedPresupuestoWhatsApp.pdf_url}
          totalArs={selectedPresupuestoWhatsApp.total_ars || 0}
          totalUsd={selectedPresupuestoWhatsApp.total_usd || 0}
          onSuccess={() => {
            fetchPresupuestos()
          }}
        />
      )}

      {/* Modal de Visor de PDF Membretado Integrado */}
      {selectedPresupuestoVisor && (
        <ModalVisorPdfPresupuesto
          isOpen={isVisorModalOpen}
          onClose={() => {
            setIsVisorModalOpen(false)
            setSelectedPresupuestoVisor(null)
          }}
          pdfUrl={selectedPresupuestoVisor.pdf_url}
          presupuestoId={selectedPresupuestoVisor.id}
          numeroPresupuesto={selectedPresupuestoVisor.numero_presupuesto}
          pacienteNombre={selectedPresupuestoVisor.pacientes?.nombre}
          onEnviarWhatsApp={() => {
            handleOpenWhatsApp(selectedPresupuestoVisor)
          }}
        />
      )}

    </div>
  )
}
