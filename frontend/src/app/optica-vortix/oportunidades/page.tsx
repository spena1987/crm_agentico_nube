'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  RefreshCw,
  Calendar,
  Glasses,
  Droplets,
  Ticket,
  MessageSquare,
  Send,
  Eye,
  CheckCircle2,
  Filter,
  Search,
  ShieldCheck,
  Loader2,
  X,
  Stethoscope,
  Phone,
  Users,
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import { apiFetch } from '@/lib/api'
import {
  OpticaOportunidadGeclisa,
  TipoOportunidadOptica,
  EstadoComercialOportunidad,
} from '@/types/optica'

export default function OpticaOportunidadesPage() {
  const router = useRouter()
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [tipoFiltro, setTipoFiltro] = useState<TipoOportunidadOptica | 'TODOS'>('TODOS')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoComercialOportunidad | 'TODOS'>('TODOS')
  const [search, setSearch] = useState('')

  const [oportunidades, setOportunidades] = useState<OpticaOportunidadGeclisa[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detalleModal, setDetalleModal] = useState<OpticaOportunidadGeclisa | null>(null)
  const [contactingId, setContactingId] = useState<string | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const fetchOportunidades = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ fecha })
      if (tipoFiltro !== 'TODOS') params.set('tipo_oportunidad', tipoFiltro)
      if (estadoFiltro !== 'TODOS') params.set('estado_comercial', estadoFiltro)
      const res = await apiFetch(`/api/optica-vortix/oportunidades?${params.toString()}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setOportunidades(Array.isArray(data) ? data : data.items || [])
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOportunidades()
  }, [fecha, tipoFiltro, estadoFiltro])

  const handleSincronizarHoy = async () => {
    setSyncing(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/optica-vortix/oportunidades/sincronizar-hoy', {
        method: 'POST',
        body: JSON.stringify({ fecha, auto_encolar: false }),
      })
      if (res.ok) {
        const data = await res.json()
        setFeedback(
          `Sincronización Geclisa completada: ${data.detectados ?? data.nuevos ?? 0} indicaciones ópticas detectadas (excluidos casos quirúrgicos/LIO).`
        )
        await fetchOportunidades()
      }
    } catch {
    } finally {
      setSyncing(false)
    }
  }

  const handleContactarUno = async (op: OpticaOportunidadGeclisa) => {
    setContactingId(op.id)
    try {
      const res = await apiFetch(`/api/optica-vortix/oportunidades/${op.id}/contactar`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (res.ok) {
        await fetchOportunidades()
      }
    } catch {
    } finally {
      setContactingId(null)
    }
  }

  const handleContactarLote = async () => {
    if (selectedIds.length === 0) return
    setBatchLoading(true)
    try {
      const res = await apiFetch('/api/optica-vortix/oportunidades/contactar-lote', {
        method: 'POST',
        body: JSON.stringify({ oportunidad_ids: selectedIds }),
      })
      if (res.ok) {
        setFeedback(
          `${selectedIds.length} oportunidades encoladas con goteo anti-bloqueo (jitter 35s-90s).`
        )
        setSelectedIds([])
        await fetchOportunidades()
      }
    } catch {
    } finally {
      setBatchLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const filtradas = oportunidades.filter((o) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (o.nombre_paciente || '').toLowerCase().includes(q) ||
      (o.dni || '').toLowerCase().includes(q) ||
      (o.telefono_normalizado || '').includes(q) ||
      (o.medico_nombre || '').toLowerCase().includes(q)
    )
  })

  // KPIs calculados
  const totalIndicaciones = oportunidades.length
  const totalAereos = oportunidades.filter(
    (o) => o.tipo_oportunidad === 'LENTES_AEREOS' || o.tipo_oportunidad === 'AMBOS'
  ).length
  const totalContacto = oportunidades.filter(
    (o) => o.tipo_oportunidad === 'LENTES_CONTACTO' || o.tipo_oportunidad === 'AMBOS'
  ).length
  const totalVouchersTurno = oportunidades.filter(
    (o) => o.tipo_oportunidad === 'TURNO_ANTICIPADO'
  ).length
  const totalEnCharlaOVendidos = oportunidades.filter((o) =>
    ['EN_CONVERSACION', 'COTIZADO', 'VENDIDO'].includes(o.estado_comercial)
  ).length

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <OpticaSubNavHeader />

      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-5">
        {/* Cabecera y Acción Principal */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
          <div className="space-y-0.5">
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
              Oportunidades Ópticas Detectadas en Geclisa
            </h1>
            <p className="text-xs text-[var(--secondary)]">
              Cruza automáticamente la historia clínica del día buscando indicaciones de <strong>Lentes Aéreos</strong> y <strong>Lentes de Contacto</strong> (excluyendo LIO quirúrgico).
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[var(--border)] text-xs">
              <Calendar size={14} className="text-indigo-500" />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent font-bold focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSincronizarHoy}
              disabled={syncing}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-md transition-all disabled:opacity-60"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>
                {syncing
                  ? 'Analizando Evoluciones Geclisa...'
                  : 'Sincronizar Indicaciones del Día en Geclisa'}
              </span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              {feedback}
            </span>
            <button type="button" onClick={() => setFeedback(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Barra de 5 KPIs del Día */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-1">
            <p className="text-[11px] font-bold text-[var(--secondary)]">
              Atendidos c/ Indicación
            </p>
            <p className="text-2xl font-black text-[var(--foreground)]">{totalIndicaciones}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-1">
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              👓 Lentes Aéreos
            </p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {totalAereos}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-1">
            <p className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
              💧 Lentes de Contacto
            </p>
            <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
              {totalContacto}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-1">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              🎟️ Turnos con Voucher
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {totalVouchersTurno}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-1">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              En Conversación / Vendidos
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {totalEnCharlaOVendidos}
            </p>
          </div>
        </div>

        {/* Barra de Filtros + Acción por Lote */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'LENTES_AEREOS', label: '👓 Lentes Aéreos' },
              { id: 'LENTES_CONTACTO', label: '💧 Lentes de Contacto' },
              { id: 'TURNO_ANTICIPADO', label: '🎟️ Turnos Próximos' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTipoFiltro(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  tipoFiltro === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="DETECTADO">Detectado (Sin enviar)</option>
              <option value="ENCOLADO">En Cola Anti-Bloqueo</option>
              <option value="ENVIADO">Plantilla Enviada</option>
              <option value="EN_CONVERSACION">En Conversación</option>
              <option value="COTIZADO">Cotizado</option>
              <option value="VENDIDO">Vendido</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente, DNI o médico..."
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
            </div>

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleContactarLote}
                disabled={batchLoading}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md"
              >
                {batchLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} />
                )}
                <span>
                  Enviar Estrategia en Cola Anti-Bloqueo ({selectedIds.length})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tabla Interactiva de Oportunidades */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-black uppercase text-[var(--secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="p-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={
                        filtradas.length > 0 && selectedIds.length === filtradas.length
                      }
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? filtradas.map((o) => o.id) : []
                        )
                      }
                    />
                  </th>
                  <th className="p-3 text-left">Paciente & Obra Social</th>
                  <th className="p-3 text-left">Teléfono Normalizado</th>
                  <th className="p-3 text-left">Médico / Servicio</th>
                  <th className="p-3 text-left">Indicación Detectada</th>
                  <th className="p-3 text-left">Estado Comercial</th>
                  <th className="p-3 text-right">Acciones Comerciales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      <Loader2 size={22} className="animate-spin mx-auto mb-2 text-indigo-500" />
                      Cargando oportunidades ópticas...
                    </td>
                  </tr>
                ) : filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center space-y-2">
                      <Glasses size={28} className="mx-auto text-slate-400" />
                      <p className="font-bold text-[var(--foreground)]">
                        No hay oportunidades registradas para la fecha seleccionada
                      </p>
                      <p className="text-[11px] text-[var(--secondary)]">
                        Haz clic en &ldquo;Sincronizar Indicaciones del Día en Geclisa&rdquo; para escanear las historias clínicas de hoy.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtradas.map((op) => {
                    const checked = selectedIds.includes(op.id)
                    return (
                      <tr
                        key={op.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(op.id)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-[var(--foreground)]">
                            {op.nombre_paciente}
                          </div>
                          <div className="text-[10px] text-[var(--secondary)]">
                            {op.dni ? `DNI ${op.dni}` : 'Sin DNI'}{' '}
                            {op.obra_social ? `• ${op.obra_social}` : ''}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                            <Phone size={11} className="text-emerald-500" />
                            +{op.telefono_normalizado || op.telefono_raw || 'Sin móvil'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-[var(--foreground)]">
                            {op.medico_nombre || 'Consultorio Oftalmológico'}
                          </div>
                          <div className="text-[10px] text-[var(--secondary)]">
                            {op.servicio_turno || 'Oftalmología General'}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {op.tipo_oportunidad === 'LENTES_CONTACTO' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                                💧 Lentes de Contacto
                              </span>
                            ) : op.tipo_oportunidad === 'TURNO_ANTICIPADO' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                🎟️ Voucher Pre-Turno ({op.cupon_codigo || '#VORTIX'})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                👓 Lentes Aéreos
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-[var(--foreground)]">
                            {op.estado_comercial}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetalleModal(op)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold flex items-center gap-1"
                              title="Ver evolución completa y receta extraída de Geclisa"
                            >
                              <Eye size={12} /> Evolución
                            </button>

                            <button
                              type="button"
                              onClick={() => handleContactarUno(op)}
                              disabled={contactingId === op.id}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1"
                            >
                              {contactingId === op.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Send size={12} />
                              )}
                              Contactar c/ Plantilla
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  op.conversacion_id
                                    ? `/optica-vortix/chat?conv_id=${op.conversacion_id}`
                                    : '/optica-vortix/chat'
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-[11px] font-bold flex items-center gap-1"
                            >
                              <MessageSquare size={12} /> Chat
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: Ver Detalle Completo de la Evolución / Receta de Geclisa */}
      {detalleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-indigo-500" />
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">
                    Detalle Clínico-Óptico en Geclisa
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    {detalleModal.nombre_paciente} • {detalleModal.medico_nombre || 'Oftalmología'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setDetalleModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border)] space-y-1.5">
                <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Extracto de la Evolución / Prescripción
                </p>
                <p className="leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
                  {detalleModal.extracto_clinico ||
                    'Indicación de corrección óptica detectada en la consulta oftalmológica del día.'}
                </p>
              </div>

              {detalleModal.palabras_clave_detectadas &&
                detalleModal.palabras_clave_detectadas.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-[var(--secondary)]">
                      Keywords detectadas:
                    </span>
                    {detalleModal.palabras_clave_detectadas.map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 text-[10px] font-bold"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDetalleModal(null)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = detalleModal
                  setDetalleModal(null)
                  handleContactarUno(item)
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Send size={13} /> Contactar ahora con Plantilla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
