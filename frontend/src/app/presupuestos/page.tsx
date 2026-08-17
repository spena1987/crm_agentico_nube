'use client'

import React, { useEffect, useState } from 'react'
import BudgetGenerator from '@/components/BudgetGenerator'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { FileText, PlusCircle, History, Download, Trash2, ArrowUpRight, CheckCircle, RefreshCw } from 'lucide-react'

interface Paciente {
  nombre: string
  telefono: string
}

interface Presupuesto {
  id: string
  paciente_id: string
  estado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
  total: number
  pdf_url: string | null
  created_at: string
  pacientes: Paciente | null
}

export default function PresupuestosPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(false)

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
          pdf_url,
          created_at,
          pacientes (
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
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
      case 'rechazado':
        return 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
      case 'enviado':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400'
    }
  }

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 space-y-5 max-w-7xl mx-auto w-full min-w-0 panel-scroll">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Presupuestos Médicos</h1>
          <p className="text-xs text-[var(--secondary)]">
            Genera cotizaciones estéticas de prestaciones en PDF y realiza seguimiento de aprobación.
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
            Crear Presupuesto
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'bg-white dark:bg-slate-800 shadow text-blue-600'
                : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <History size={15} />
            Historial Emitidos
          </button>
        </div>
      </div>

      {/* Contenido según el Tab Activo */}
      {activeTab === 'create' ? (
        <BudgetGenerator />
      ) : (
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <FileText className="text-slate-500" size={18} />
              Presupuestos Generados
            </h2>
            <button 
              onClick={fetchPresupuestos}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[var(--secondary)] transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <RefreshCw size={13} /> Recargar
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-[var(--secondary)]">Cargando historial de presupuestos...</div>
          ) : presupuestos.length === 0 ? (
            <div className="text-center py-12 text-xs text-[var(--secondary)]">No hay presupuestos médicos emitidos aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-slate-400 font-semibold">
                    <th className="py-3 pl-2">ID</th>
                    <th>Paciente</th>
                    <th>Fecha Emisión</th>
                    <th className="text-right">Monto Total</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center">PDF</th>
                    <th className="text-right pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuestos.map((pres) => (
                    <tr key={pres.id} className="border-b border-[var(--border)] text-slate-700 dark:text-slate-300">
                      <td className="py-4 pl-2 font-mono font-bold text-[10px] text-slate-500">
                        {pres.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="font-semibold">
                        {pres.pacientes?.nombre || 'N/A'}
                        <span className="block text-[10px] text-[var(--secondary)] font-normal">{pres.pacientes?.telefono}</span>
                      </td>
                      <td>{new Date(pres.created_at).toLocaleDateString('es-ES')}</td>
                      <td className="text-right font-extrabold text-blue-600">${Number(pres.total).toFixed(2)}</td>
                      <td className="text-center">
                        <select
                          value={pres.estado}
                          onChange={(e) => updateEstado(pres.id, e.target.value as any)}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/25 ${getBadgeColor(pres.estado)}`}
                        >
                          <option value="borrador">Borrador</option>
                          <option value="enviado">Enviado</option>
                          <option value="aprobado">Aprobado</option>
                          <option value="rechazado">Rechazado</option>
                        </select>
                      </td>
                      <td className="text-center">
                        {pres.pdf_url ? (
                          <a
                            href={`${BACKEND_URL}${pres.pdf_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg inline-flex items-center justify-center transition-all"
                            title="Descargar PDF"
                          >
                            <Download size={14} />
                          </a>
                        ) : (
                          <span className="text-[10px] text-[var(--secondary)] italic">No generado</span>
                        )}
                      </td>
                      <td className="text-right pr-2">
                        <button
                          onClick={() => deletePresupuesto(pres.id)}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
