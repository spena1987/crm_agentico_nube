'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  PhoneOff,
  UserX,
  Clock,
  Calendar,
  RefreshCw,
  Eye,
  Check,
  ShieldAlert,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface DestinatarioItem {
  key: string
  prestador_id: string | null
  geclisa_pre_id: number | null
  nombre: string
  telefono: string | null
  roles: string[]
  estado: 'LISTO_PARA_ENVIO' | 'SIN_TELEFONO' | 'DERIVADOR_NO_RESOLUBLE'
  cantidad_cirugias: number
}

interface StatusData {
  fecha_cirugia: string
  total_prestadores: number
  listos_para_envio: number
  sin_telefono: number
  derivadores_no_resolubles: number
  destinatarios: DestinatarioItem[]
}

interface ModalEnvioAgendasPrestadoresProps {
  isOpen: boolean
  onClose: () => void
  fechaInicial?: string
}

export default function ModalEnvioAgendasPrestadores({
  isOpen,
  onClose,
  fechaInicial
}: ModalEnvioAgendasPrestadoresProps) {
  const [fecha, setFecha] = useState(fechaInicial || new Date().toISOString().slice(0, 10))
  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [forzarReenvio, setForzarReenvio] = useState(false)
  const [resultadoDespacho, setResultadoDespacho] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (fechaInicial) {
      setFecha(fechaInicial)
    }
  }, [fechaInicial])

  useEffect(() => {
    if (isOpen) {
      cargarStatus()
      setResultadoDespacho(null)
      setErrorMsg(null)
    }
  }, [isOpen, fecha])

  const cargarStatus = async () => {
    setCargando(true)
    setErrorMsg(null)
    try {
      const res = await apiFetch(
        `/api/turnos-quirofano/notificaciones-prestadores/destinatarios-status?fecha=${fecha}`
      )
      if (res.ok) {
        const data = await res.json()
        setStatusData(data)
      } else {
        setErrorMsg('Error al consultar estado de destinatarios.')
      }
    } catch (err: any) {
      console.error('Error cargando estado de destinatarios:', err)
      setErrorMsg('No se pudo verificar el estado de los destinatarios.')
    } finally {
      setCargando(false)
    }
  }

  const handleDespachar = async () => {
    if (!statusData || statusData.listos_para_envio === 0) return
    setEnviando(true)
    setErrorMsg(null)
    setResultadoDespacho(null)

    try {
      const res = await apiFetch(
        '/api/turnos-quirofano/notificaciones-prestadores/despachar',
        {
          method: 'POST',
          body: JSON.stringify({
            fecha_cirugia: fecha,
            forzar_reenvio: forzarReenvio,
            asincrono: true
          })
        }
      )

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) {
          setResultadoDespacho(
            `✅ Envío iniciado con éxito (Job ID: ${data.job_id || 'OK'}). Las agendas se están despachando en segundo plano a los teléfonos de los prestadores.`
          )
        } else {
          setErrorMsg(data?.mensaje || 'Hubo un inconveniente al procesar el envío.')
        }
      } else {
        setErrorMsg('Error de comunicación con el servidor al despachar.')
      }
    } catch (err: any) {
      console.error('Error despachando agendas:', err)
      setErrorMsg(err?.message || 'Error de comunicación al solicitar el despacho.')
    } finally {
      setEnviando(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Notificación de Agendas a Prestadores
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Línea Centrovisión Estudios
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Envío consolidado de partes quirúrgicos en PDF a cirujanos y derivadores por WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Selector de Fecha y Refresco */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-sky-400" />
              <div>
                <label className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Fecha de Cirugías
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="mt-0.5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cargarStatus}
                disabled={cargando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors border border-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                Actualizar Diagnóstico
              </button>
            </div>
          </div>

          {/* Tarjetas de Resumen / Métricas */}
          {statusData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xl font-bold text-emerald-300">
                    {statusData.listos_para_envio}
                  </div>
                  <div className="text-xs text-emerald-400/80 font-medium">Listos para Notificar</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                <PhoneOff className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xl font-bold text-amber-300">{statusData.sin_telefono}</div>
                  <div className="text-xs text-amber-400/80 font-medium">Sin Teléfono Cargado</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-3">
                <UserX className="w-6 h-6 text-purple-400 shrink-0" />
                <div>
                  <div className="text-xl font-bold text-purple-300">
                    {statusData.derivadores_no_resolubles}
                  </div>
                  <div className="text-xs text-purple-400/80 font-medium">Derivadores No Asociados</div>
                </div>
              </div>
            </div>
          )}

          {/* Alertas preventivas destacadas */}
          {statusData && (statusData.sin_telefono > 0 || statusData.derivadores_no_resolubles > 0) && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/30 flex items-start gap-3 text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-amber-300">
                  Atención: Hay profesionales con cirugías asignadas que no recibirán su cronograma.
                </p>
                <p className="text-amber-200/80">
                  {statusData.sin_telefono > 0 &&
                    `• ${statusData.sin_telefono} prestador(es) no poseen número de WhatsApp en su ficha de Ajustes. `}
                  {statusData.derivadores_no_resolubles > 0 &&
                    `• ${statusData.derivadores_no_resolubles} derivador(es) figuran con nombres en texto libre no identificados.`}
                </p>
              </div>
            </div>
          )}

          {/* Lista Detallada de Destinatarios */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Destinatarios para la fecha ({statusData?.total_prestadores || 0})</span>
              <span className="text-[11px] font-normal text-slate-500">
                1 solo mensaje consolidado por médico
              </span>
            </h3>

            {cargando ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                <span className="text-xs">Analizando grilla quirúrgica y prestadores...</span>
              </div>
            ) : statusData && statusData.destinatarios.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {statusData.destinatarios.map((d) => (
                  <div
                    key={d.key}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                      d.estado === 'LISTO_PARA_ENVIO'
                        ? 'bg-slate-800/40 border-slate-700/60'
                        : d.estado === 'SIN_TELEFONO'
                        ? 'bg-amber-950/20 border-amber-800/40'
                        : 'bg-purple-950/20 border-purple-800/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-sm">{d.nombre}</span>
                        {d.roles.map((r) => (
                          <span
                            key={r}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              r.includes('Cirujano')
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>Pacientes asignados: <b>{d.cantidad_cirugias}</b></span>
                        {d.telefono ? (
                          <span className="text-slate-300">📱 {d.telefono}</span>
                        ) : (
                          <span className="text-amber-400 font-medium">⚠️ Sin teléfono asignado</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {d.estado === 'LISTO_PARA_ENVIO' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Listo
                        </span>
                      ) : d.estado === 'SIN_TELEFONO' ? (
                        <Link
                          href="/ajustes?tab=prestadores"
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-medium text-[11px] flex items-center gap-1 transition-colors"
                        >
                          Cargar Teléfono <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium text-[11px]">
                          Asociar Prestador
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-800/20 rounded-xl border border-slate-800">
                No hay cirugías activas programadas para esta fecha.
              </div>
            )}
          </div>

          {/* Opciones avanzadas */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer hover:text-slate-300">
              <input
                type="checkbox"
                checked={forzarReenvio}
                onChange={(e) => setForzarReenvio(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              <span>Forzar reenvío a prestadores que ya recibieron hoy</span>
            </label>
          </div>

          {/* Mensajes de Resultado o Error */}
          {resultadoDespacho && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{resultadoDespacho}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>

          <button
            onClick={handleDespachar}
            disabled={enviando || cargando || !statusData || statusData.listos_para_envio === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Despachando Agendas...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar Agendas ({statusData?.listos_para_envio || 0} prestadores)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
