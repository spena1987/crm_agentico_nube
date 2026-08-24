'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  Clock,
  User,
  Activity,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Download,
  Send,
  Radio,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Check,
  Building2,
  Loader2,
  ExternalLink,
  MessageSquare
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'

export default function RecepcionPacientesDia() {
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10))
  const [turnos, setTurnos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)

  const fetchTurnosHoy = async () => {
    try {
      setCargando(true)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano-dia?fecha=${fecha}`)
      const data = await res.json()
      if (data.success && data.turnos) {
        setTurnos(data.turnos)
      }
    } catch (err) {
      console.error('Error cargando turnos de recepción:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchTurnosHoy()
  }, [fecha])

  // Suscripción Realtime a Supabase
  useEffect(() => {
    const channel = supabase
      .channel('realtime-recepcion-asesoria')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos_quirofano' },
        () => {
          fetchTurnosHoy()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fecha])

  // Recepcionar paciente (marcar en espera)
  const handleRecepcionar = async (turnoId: string) => {
    try {
      setProcesandoId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/cambiar-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'en_espera' })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTurnos((prev) =>
          prev.map((t) => (t.id === turnoId ? { ...t, estado: 'en_espera', ...data.turno } : t))
        )
      }
    } catch (err) {
      console.error('Error al recepcionar paciente:', err)
    } finally {
      setProcesandoId(null)
    }
  }

  // Enviar consentimiento por WhatsApp si aún no lo firmó
  const handleReenviarConsentimientoWA = async (turnoId: string) => {
    try {
      setProcesandoId(turnoId)
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/enviar-consentimiento-wa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert('✔ Enlace de consentimiento enviado por WhatsApp al paciente.')
        fetchTurnosHoy()
      } else {
        alert(data.detail || 'Error al enviar consentimiento.')
      }
    } catch (err) {
      console.error('Error enviando consentimiento:', err)
    } finally {
      setProcesandoId(null)
    }
  }

  const cambiarDia = (delta: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setFecha(d.toISOString().slice(0, 10))
  }

  const metricas = useMemo(() => {
    const total = turnos.length
    const citados = turnos.filter((t) => t.estado === 'programado').length
    const recepcionados = turnos.filter((t) => t.estado === 'en_espera').length
    const enQx = turnos.filter((t) => t.estado === 'en_operacion').length
    const operados = turnos.filter((t) => t.estado === 'operado').length
    return { total, citados, recepcionados, enQx, operados }
  }, [turnos])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Barra de Control de Fecha & Realtime */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-[var(--border)]">
            <button
              onClick={() => cambiarDia(-1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-[var(--secondary)] transition"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setFecha(new Date().toISOString().slice(0, 10))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                fecha === new Date().toISOString().slice(0, 10)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--secondary)] hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => cambiarDia(1)}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-[var(--secondary)] transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-[var(--border)] text-xs font-mono font-bold outline-none"
          />

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
            <Radio size={12} className="animate-pulse" />
            <span>Sincronizado con Quirófano</span>
          </div>
        </div>

        <button
          onClick={fetchTurnosHoy}
          className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-[var(--border)] self-end sm:self-auto"
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin text-blue-600' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
          <p className="text-[10px] font-bold uppercase text-blue-600">Pacientes Citados</p>
          <p className="text-xl font-extrabold text-[var(--foreground)] font-mono mt-0.5">{metricas.total}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
          <p className="text-[10px] font-bold uppercase text-amber-600">En Sala de Espera</p>
          <p className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">{metricas.recepcionados}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40">
          <p className="text-[10px] font-bold uppercase text-purple-600">En Mesa Quirúrgica</p>
          <p className="text-xl font-extrabold text-purple-600 font-mono mt-0.5">{metricas.enQx}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
          <p className="text-[10px] font-bold uppercase text-emerald-600">Cirugías Finalizadas</p>
          <p className="text-xl font-extrabold text-emerald-600 font-mono mt-0.5">{metricas.operados}</p>
        </div>
      </div>

      {/* Listado de Pacientes para Recepción */}
      {cargando ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] flex flex-col items-center justify-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span>Cargando pacientes del día...</span>
        </div>
      ) : turnos.length === 0 ? (
        <div className="p-12 text-center text-xs text-[var(--secondary)] bg-[var(--card)] border border-dashed rounded-2xl">
          No hay cirugías programadas para el día ({fecha}).
        </div>
      ) : (
        <div className="space-y-3.5">
          {turnos.map((t) => {
            const pac = t.pacientes || {}
            const q = t.quirofanos || {}
            const esOperado = t.estado === 'operado'
            const esEnOperacion = t.estado === 'en_operacion'
            const esEnEspera = t.estado === 'en_espera'
            const tieneConsentimiento = t.consentimiento_estado === 'firmado_digital'

            return (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  esEnOperacion
                    ? 'border-purple-500 bg-purple-50/20 dark:bg-purple-950/10'
                    : esEnEspera
                    ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/10'
                    : esOperado
                    ? 'border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/5 opacity-80'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white text-xs font-mono font-extrabold">
                      {String(t.hora_inicio).slice(0, 5)} hs
                    </span>
                    <span className="text-xs font-bold text-[var(--foreground)] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                      {q.nombre || 'Quirófano'}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        esEnOperacion
                          ? 'bg-purple-600 text-white animate-pulse'
                          : esEnEspera
                          ? 'bg-amber-500 text-white'
                          : esOperado
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {esEnOperacion && <Activity size={11} className="animate-spin" />}
                      {esEnEspera && <Activity size={11} />}
                      {esOperado && <Check size={11} />}
                      <span>
                        {esEnOperacion
                          ? 'En Mesa Quirúrgica'
                          : esEnEspera
                          ? 'En Sala de Espera'
                          : esOperado
                          ? 'Cirugía Finalizada'
                          : 'Citado'}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3">
                    <h4 className="text-sm font-extrabold text-[var(--foreground)] truncate">
                      {pac.nombre || t.paciente_nombre}
                    </h4>
                    <span className="text-xs text-[var(--secondary)] font-mono">
                      DNI: {pac.dni || t.paciente_dni || 'S/D'} • Tel: {pac.telefono || t.paciente_telefono || 'S/D'}
                    </span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate">
                      {t.practica_nombre} ({t.ojo})
                    </span>
                  </div>

                  {/* ALERTA DE CONSENTIMIENTO INFORMADO */}
                  <div className="pt-1">
                    {!tieneConsentimiento ? (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-amber-700 dark:text-amber-300 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertCircle size={14} className="shrink-0 text-amber-600" />
                          <span>⚠ El paciente aún no ha firmado el Consentimiento Informado.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.consentimiento_token && (
                            <a
                              href={`/consentimiento/${t.consentimiento_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                            >
                              <FileCheck2 size={12} />
                              <span>Firmar en Tablet / Celular</span>
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={procesandoId === t.id || !(pac.telefono || t.paciente_telefono)}
                            onClick={() => handleReenviarConsentimientoWA(t.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm disabled:opacity-50 transition-all"
                          >
                            <Send size={11} />
                            <span>Reenviar WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 size={14} />
                        <span>Consentimiento Firmado Digitalmente</span>
                        <a
                          href={`${BACKEND_URL}${t.consentimiento_pdf_url || '/static/consentimiento_' + t.id + '.pdf'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 ml-2"
                        >
                          <Download size={11} />
                          <span>Ver PDF</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones de Recepción */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {t.estado === 'programado' && (
                    <button
                      type="button"
                      disabled={procesandoId === t.id}
                      onClick={() => handleRecepcionar(t.id)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                    >
                      {procesandoId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                      <span>🟡 Recepcionar Paciente</span>
                    </button>
                  )}

                  {esEnEspera && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-800">
                      En Sala de Espera
                    </div>
                  )}

                  {esEnOperacion && (
                    <div className="px-3 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-300 dark:border-purple-800 animate-pulse">
                      En Mesa de Quirófano
                    </div>
                  )}

                  {esOperado && (
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                      Operado ✔
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
