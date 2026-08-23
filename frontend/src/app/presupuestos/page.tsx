'use client'

import React, { useEffect, useState } from 'react'
import BudgetGenerator from '@/components/BudgetGenerator'
import ModalEnviarPresupuestoWhatsApp from '@/components/ModalEnviarPresupuestoWhatsApp'
import ModalVisorPdfPresupuesto from '@/components/ModalVisorPdfPresupuesto'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import {
  FileText,
  PlusCircle,
  History,
  Download,
  Trash2,
  Send,
  CheckCircle,
  RefreshCw,
  Clock,
  AlertCircle,
  Sparkles,
  User,
  Copy,
  Eye,
  MessageSquareHeart
} from 'lucide-react'

interface Paciente {
  id?: string
  nombre: string
  telefono: string
}

interface Presupuesto {
  id: string
  paciente_id: string
  estado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
  total: number
  total_ars?: number
  total_usd?: number
  pdf_url: string | null
  created_at: string
  pacientes: Paciente | null
}

export default function PresupuestosPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(false)
  const [presupuestoParaClonar, setPresupuestoParaClonar] = useState<any | null>(null)

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
          paciente_id,
          estado,
          total,
          total_ars,
          total_usd,
          pdf_url,
          created_at,
          pacientes (
            id,
            nombre,
            telefono
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
  }, [activeTab])

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

  // Duplicar / Re-cotizar presupuesto con fallback dual resiliente
  const handleDuplicarPresupuesto = async (pres: Presupuesto) => {
    try {
      setLoading(true)
      let dataToClone: any = null

      // 1. Intentar vía API Backend
      try {
        const res = await fetch(`${BACKEND_URL}/api/presupuestos/${pres.id}/duplicar`)
        if (res.ok) {
          const apiData = await res.json()
          if (apiData.success) {
            dataToClone = apiData
          }
        }
      } catch (apiErr) {
        console.warn('API Backend duplicar no disponible, intentando vía Supabase:', apiErr)
      }

      // 2. Fallback robusto directo de Supabase
      if (!dataToClone) {
        const { data: pData, error } = await supabase
          .from('presupuestos')
          .select('*, pacientes(*), items_presupuesto(*, servicios_precios(*))')
          .eq('id', pres.id)
          .single()

        if (error) throw error

        if (pData) {
          const itemsRaw = pData.items_presupuesto || []
          const parsedItems = itemsRaw.map((it: any) => {
            const srv = it.servicios_precios || {}
            return {
              id: srv.id || it.id || String(Math.random()),
              codigo: srv.codigo || 'PRACT',
              nombre: srv.nombre_prestacion || 'Prestación Médica',
              cantidad: Number(it.cantidad || 1),
              precio_unitario: Number(it.precio_unitario || 0),
              moneda: String(it.moneda || srv.moneda || 'ARS').toUpperCase(),
              subtotal: Number(it.subtotal || (Number(it.cantidad || 1) * Number(it.precio_unitario || 0)))
            }
          })

          const pAny = pData as any
          dataToClone = {
            paciente: pAny.pacientes,
            paciente_id: pAny.paciente_id,
            total_ars: Number(pAny.total_ars || 0),
            total_usd: Number(pAny.total_usd || 0),
            items: parsedItems
          }
        }
      }

      if (dataToClone) {
        setPresupuestoParaClonar(dataToClone)
        setActiveTab('create')
      } else {
        alert('No se pudieron obtener los datos para duplicar el presupuesto.')
      }
    } catch (err) {
      console.error('Error al clonar presupuesto:', err)
      alert('No se pudo duplicar el presupuesto. Revisa la conexión con el servidor.')
    } finally {
      setLoading(false)
    }
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
            Genera presupuestos multi-moneda en PDF membretado, envíalos por WhatsApp con 1 clic y realiza seguimiento comercial.
          </p>
        </div>

        {/* Tabs de Selección */}
        <div className="flex bg-slate-100 dark:bg-slate-800/40 p-1.5 rounded-xl border border-[var(--border)] self-start md:self-auto">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-white dark:bg-slate-800 shadow text-blue-600'
                : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <PlusCircle size={15} />
            {presupuestoParaClonar ? 'Re-cotizar Presupuesto' : 'Crear Presupuesto'}
          </button>
          <button
            onClick={() => {
              setPresupuestoParaClonar(null)
              setActiveTab('list')
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-white dark:bg-slate-800 shadow text-blue-600'
                : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <History size={15} />
            Historial Emitidos ({presupuestos.length})
          </button>
        </div>
      </div>

      {/* Contenido según el Tab Activo */}
      {activeTab === 'create' ? (
        <BudgetGenerator
          presupuestoInicial={presupuestoParaClonar}
          onPresupuestoEmitido={() => {
            setPresupuestoParaClonar(null)
            fetchPresupuestos()
          }}
        />
      ) : (
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FileText className="text-blue-600" size={18} />
              Historial de Presupuestos ({presupuestos.length})
            </h2>
            <button 
              onClick={fetchPresupuestos}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[var(--secondary)] hover:text-blue-600 transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <RefreshCw size={13} /> Recargar
            </button>
          </div>

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
                    <th className="py-3 pl-2">ID</th>
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
                          {pres.id.slice(0, 8).toUpperCase()}
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
                          <button
                            onClick={() => handleDuplicarPresupuesto(pres)}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition inline-flex items-center"
                            title="Duplicar / Re-cotizar este presupuesto"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenWhatsApp(pres)}
                            className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition inline-flex items-center"
                            title="Enviar / Reenviar por WhatsApp con 1 Clic"
                          >
                            <Send size={14} />
                          </button>
                          <button
                            onClick={() => deletePresupuesto(pres.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded-lg transition"
                            title="Eliminar presupuesto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
          pacienteNombre={selectedPresupuestoVisor.pacientes?.nombre}
          onEnviarWhatsApp={() => {
            handleOpenWhatsApp(selectedPresupuestoVisor)
          }}
        />
      )}

    </div>
  )
}
