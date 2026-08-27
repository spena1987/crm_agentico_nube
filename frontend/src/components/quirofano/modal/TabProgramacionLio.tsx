'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  User,
  Scissors,
  Stethoscope,
  Eye,
  FileCheck2,
  Sparkles,
  Save,
  Loader2,
  Building2,
  AlertCircle,
  UploadCloud,
  CheckCheck,
  CheckCircle2,
  PackageCheck,
  Package,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Lock,
  Layers,
  Compass,
  Check
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { formatearHoraDesdeIso } from '@/lib/dateUtils'

interface TabProgramacionLioProps {
  turno: any
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
  quirofanos: any[]
  modelosLio: any[]
  guardando: boolean
  onGuardar: (e: React.FormEvent) => void
  mensajeExito: string | null
}

export default function TabProgramacionLio({
  turno,
  formData,
  setFormData,
  quirofanos,
  modelosLio,
  guardando,
  onGuardar,
  mensajeExito
}: TabProgramacionLioProps) {
  const paciente = turno.pacientes || {}
  const opcionesCalculadas = turno.lio_calculo_opciones || []
  const tieneOpciones = Array.isArray(opcionesCalculadas) && opcionesCalculadas.length > 0
  const esConfirmado = Boolean(turno.lio_calculado)
  const stockReservado = Boolean(turno.lio_stock_reservado)

  const [reservandoStock, setReservandoStock] = useState<boolean>(false)
  const [stockLocal, setStockLocal] = useState<boolean>(stockReservado)

  // Función rápida para reservar stock desde el mismo modal de quirófano
  const handleToggleStock = async () => {
    if (!turno.id) return
    try {
      setReservandoStock(true)
      const nuevoEstado = !stockLocal
      const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turno.id}/reservar-stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservado: nuevoEstado })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStockLocal(nuevoEstado)
      }
    } catch (e) {
      console.error('Error al actualizar reserva de stock:', e)
    } finally {
      setReservandoStock(false)
    }
  }

  return (
    <form onSubmit={onGuardar} className="space-y-6">
      {/* Resumen del Paciente */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
            <User size={16} className="text-blue-600" />
            <span>{paciente.nombre || 'Paciente sin nombre'}</span>
          </h4>
          <p className="text-xs text-[var(--secondary)] mt-0.5 font-mono">
            DNI: {paciente.dni || 'S/D'} • Obra Social: {turno.obra_social || paciente.obra_social || 'Particular'}
          </p>
        </div>

        {/* Documentos Médicos Oficiales */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Consentimiento Informado */}
          {turno.consentimiento_estado === 'firmado_digital' ? (
            <a
              href={`${BACKEND_URL}${turno.consentimiento_pdf_url || '/static/consentimiento_' + turno.id + '.pdf'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition"
            >
              <FileCheck2 size={14} />
              <span>Consentimiento Firmado (PDF)</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <AlertCircle size={14} />
              <span>Consentimiento Pendiente</span>
            </span>
          )}

          {/* Protocolo Quirúrgico Oficial */}
          {turno.estado === 'operado' && (
            <a
              href={`${BACKEND_URL}${turno.parte_quirurgico_pdf_url || '/static/parte_quirurgico_' + turno.id + '.pdf'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition"
            >
              <FileCheck2 size={14} />
              <span>Protocolo Qx (PDF)</span>
            </a>
          )}

          {/* Badge Geclisa */}
          {turno.parte_quirurgico_geclisa_archivo_id && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <CheckCheck size={14} />
              <span>Geclisa: #{turno.parte_quirurgico_geclisa_archivo_id}</span>
            </span>
          )}
        </div>
      </div>

      {/* Selector de Quirófano, Ojo y Anestesia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sala de Quirófano */}
        <div>
          <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Sala de Quirófano</label>
          <select
            value={formData.quirofano_id}
            onChange={(e) => setFormData({ ...formData, quirofano_id: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {quirofanos.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nombre} ({q.codigo})
              </option>
            ))}
          </select>
        </div>

        {/* Ojo a Intervenir */}
        <div>
          <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Ojo a Intervenir</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'OD', label: 'Ojo Derecho (OD)' },
              { id: 'OI', label: 'Ojo Izquierdo (OI)' },
              { id: 'AO', label: 'Ambos (AO)' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFormData({ ...formData, ojo: item.id })}
                className={`py-2 rounded-xl text-xs font-bold border transition ${
                  formData.ojo === item.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'border-[var(--border)] bg-[var(--background)] text-[var(--secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                {item.id}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo de Anestesia */}
        <div>
          <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Tipo de Anestesia</label>
          <select
            value={formData.tipo_anestesia}
            onChange={(e) => setFormData({ ...formData, tipo_anestesia: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Tópica + Sedación">Tópica + Sedación</option>
            <option value="Peribulbar / Retrobulbar">Peribulbar / Retrobulbar</option>
            <option value="General">General</option>
            <option value="Tópica Pura">Tópica Pura</option>
          </select>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CONSOLA QUIRÚRGICA DE LIO: SEMÁFORO DE SEGURIDAD & PLANES MULTILENTE */}
      {/* ==================================================================== */}
      <div className="p-5 rounded-3xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 space-y-5 shadow-sm">
        {/* Encabezado y Checkbox */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.lleva_lente}
              onChange={(e) => setFormData({ ...formData, lleva_lente: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
            />
            <span className="text-sm font-extrabold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <Sparkles size={17} className="text-blue-600 dark:text-blue-400" />
              <span>Implante de Lente Intraocular (LIO)</span>
            </span>
          </label>

          <Link
            href="/calculo-lio"
            target="_blank"
            className="text-xs font-extrabold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>Mesa de Cálculo de LIO</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        {formData.lleva_lente && (
          <div className="space-y-4 animate-fade-in">
            {/* 1. SEMÁFORO DE SEGURIDAD QUIRÚRGICA DE 4 ESTADOS */}
            {esConfirmado && stockLocal ? (
              /* ESTADO 1 (VERDE): Confirmado y Stock OK */
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-black shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                      <span>LISTO PARA CIRUGÍA — LIO Confirmado & Stock en Quirófano OK</span>
                      <PackageCheck size={14} className="text-emerald-500" />
                    </h5>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Cálculo sellado por <b>{turno.lio_calculado_por || turno.cirujano_nombre || 'Cirujano'}</b>
                      {turno.lio_calculado_at && ` (${formatearHoraDesdeIso(turno.lio_calculado_at)})`}
                      {' ' }• Lentes físicamente separados en quirófano.
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide">
                  Seguridad OMS: OK
                </span>
              </div>
            ) : esConfirmado && !stockLocal ? (
              /* ESTADO 2 (NARANJA/AMBAR): Confirmado pero falta separar Stock */
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black shrink-0">
                    <Package size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                      <span>ALERTA LOGÍSTICA — LIO Confirmado • Stock Físico Pendiente</span>
                      <AlertTriangle size={14} className="text-amber-500" />
                    </h5>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Cálculo sellado por <b>{turno.lio_calculado_por || turno.cirujano_nombre}</b>, pero las cajas aún no se marcaron como reservadas en quirófano.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={reservandoStock}
                  onClick={handleToggleStock}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
                >
                  {reservandoStock ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={14} />}
                  <span>Confirmar Stock en Quirófano</span>
                </button>
              </div>
            ) : tieneOpciones && !esConfirmado ? (
              /* ESTADO 3 (AMARILLO): Guardado como Borrador (No Confirmado) */
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black shrink-0">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-amber-950 dark:text-amber-100">
                      PRECAUCIÓN — Cálculo de LIO en Borrador (No Confirmado)
                    </h5>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      El cirujano cargó {opcionesCalculadas.length} opciones biométricas pero aún no las selló formalmente.
                    </p>
                  </div>
                </div>

                <Link
                  href="/calculo-lio"
                  target="_blank"
                  className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-extrabold flex items-center gap-1 hover:bg-amber-700 transition"
                >
                  <span>Revisar en Cálculo LIO</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            ) : (
              /* ESTADO 4 (ROJO): Sin Iniciar / Sin Cálculo */
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black shrink-0">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-rose-950 dark:text-rose-100">
                      ALERTA CRÍTICA — LIO Sin Calcular / Sin Iniciar
                    </h5>
                    <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">
                      Este turno no cuenta con opciones biométricas de LIO registradas en el sistema.
                    </p>
                  </div>
                </div>

                <Link
                  href="/calculo-lio"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Eye size={14} />
                  <span>Ir a Calcular LIO</span>
                </Link>
              </div>
            )}

            {/* 2. CUADRÍCULA DE PLANES MULTILENTE CARGADOS POR EL CIRUJANO */}
            {tieneOpciones ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                    <Layers size={14} className="text-cyan-500" />
                    <span>Planes Biométricos del Cirujano ({opcionesCalculadas.length}):</span>
                  </h5>
                  <span className="text-[11px] text-[var(--secondary)]">
                    Haz clic en <b>[ ✓ Usar / Implantar ]</b> para registrar la opción colocada
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {opcionesCalculadas.map((op: any, idx: number) => {
                    const esImplantado =
                      formData.lente_tipo === op.modelo &&
                      formData.lente_dioptria === op.dioptria &&
                      Boolean(formData.es_torico) === Boolean(op.es_torico)

                    return (
                      <div
                        key={op.id || idx}
                        className={`p-3.5 rounded-2xl border transition-all relative flex flex-col justify-between gap-3 ${
                          esImplantado
                            ? 'bg-cyan-500/15 border-cyan-500 ring-2 ring-cyan-500/40 shadow-md'
                            : 'bg-[var(--card)] border-[var(--border)] hover:border-cyan-400/50'
                        }`}
                      >
                        <div>
                          {/* Encabezado del Plan */}
                          <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-[var(--border)]">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                op.tipo_opcion === 'principal'
                                  ? 'bg-cyan-500 text-black'
                                  : op.tipo_opcion === 'torico'
                                  ? 'bg-indigo-600 text-white'
                                  : op.tipo_opcion === 'sulcus'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-800 text-[var(--foreground)]'
                              }`}
                            >
                              {op.etiqueta || `Opción ${idx + 1}`}
                            </span>

                            {esImplantado && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-black text-[9px] font-black tracking-wider flex items-center gap-1">
                                <Check size={10} /> IMPLANTADO
                              </span>
                            )}
                          </div>

                          {/* Modelo y Dioptría */}
                          <div className="mt-2.5">
                            <h6 className="text-xs font-extrabold text-[var(--foreground)] leading-snug line-clamp-2">
                              {op.modelo}
                            </h6>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                                {op.dioptria} D
                              </span>
                              {op.target_refractivo && (
                                <span className="text-[10px] text-[var(--secondary)] font-semibold truncate">
                                  Tg: {op.target_refractivo}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Parámetros Tóricos (si aplica) */}
                          {op.es_torico && (
                            <div className="mt-2 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 font-bold">
                                <span>Cilindro Tórico:</span>
                                <span>T{op.torico_valor || 0}</span>
                              </div>
                              <div className="flex items-center justify-between text-indigo-900 dark:text-indigo-200 font-black">
                                <span className="flex items-center gap-1">
                                  <Compass size={12} /> Eje de Alineación:
                                </span>
                                <span className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                                  {op.torico_eje || 90}°
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Fórmula & Notas */}
                          <div className="text-[10px] text-[var(--secondary)] mt-2 space-y-0.5">
                            {op.formula && <p>📐 Fórmula: <b>{op.formula}</b></p>}
                            {op.observaciones && (
                              <p className="italic text-slate-600 dark:text-slate-400 line-clamp-2">
                                💬 "{op.observaciones}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Botón de Selección del Plan Implantado */}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev: any) => ({
                              ...prev,
                              lleva_lente: true,
                              lente_tipo: op.modelo,
                              lente_dioptria: op.dioptria,
                              es_torico: Boolean(op.es_torico),
                              lente_torico_valor: op.torico_valor || 0,
                              lente_torico_eje: op.torico_eje || 90
                            }))
                          }}
                          className={`w-full py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                            esImplantado
                              ? 'bg-cyan-500 text-black shadow-sm font-black'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/20 text-[var(--foreground)] border border-[var(--border)]'
                          }`}
                        >
                          {esImplantado ? <Check size={14} /> : <CheckCircle2 size={14} />}
                          <span>{esImplantado ? 'Lente Seleccionado' : 'Usar este Lente'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* 3. CAJA DE TRAZABILIDAD REAL DEL BLÍSTER (LOTE, SERIE Y VENCIMIENTO) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[var(--border)] space-y-3 pt-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <h5 className="text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                  <PackageCheck size={15} className="text-blue-600" />
                  <span>Trazabilidad del Blíster Físico Implantado</span>
                </h5>
                <span className="text-[10px] text-[var(--secondary)]">
                  Datos grabados en el Protocolo Quirúrgico PDF
                </span>
              </div>

              {/* Si no hay opciones estructuradas, mostrar selector manual */}
              {!tieneOpciones && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1">Modelo de LIO</label>
                    <select
                      value={formData.lente_tipo}
                      onChange={(e) => {
                        const val = e.target.value
                        const modObj = modelosLio.find((m) => `${m.modelo} (${m.marca})` === val || m.modelo === val)
                        setFormData((prev: any) => ({
                          ...prev,
                          lente_tipo: val,
                          es_torico: modObj && modObj.tipo_optica && modObj.tipo_optica.toLowerCase().includes('tóric') ? true : prev.es_torico
                        }))
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-xs"
                    >
                      <option value="">-- Seleccionar Modelo de LIO --</option>
                      {modelosLio.map((m) => (
                        <option key={m.id || m.modelo} value={`${m.modelo} (${m.marca})`}>
                          {m.marca} — {m.modelo} ({m.tipo_optica || 'LIO'})
                        </option>
                      ))}
                      {formData.lente_tipo && !modelosLio.some((m) => `${m.modelo} (${m.marca})` === formData.lente_tipo) && (
                        <option value={formData.lente_tipo}>{formData.lente_tipo}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--foreground)] mb-1">Dioptría (Poder)</label>
                    <input
                      type="text"
                      value={formData.lente_dioptria}
                      onChange={(e) => setFormData({ ...formData, lente_dioptria: e.target.value })}
                      placeholder="Ej: +21.50 D"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Lote, Serie y Vencimiento del Blíster */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                    N° de Lote (Blíster) *
                  </label>
                  <input
                    type="text"
                    value={formData.lente_lote || ''}
                    onChange={(e) => setFormData({ ...formData, lente_lote: e.target.value })}
                    placeholder="Ej: LOT-98214"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                    N° de Serie (SN) *
                  </label>
                  <input
                    type="text"
                    value={formData.lente_serie || ''}
                    onChange={(e) => setFormData({ ...formData, lente_serie: e.target.value })}
                    placeholder="Ej: SN-44120"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono text-xs font-bold text-[var(--foreground)] outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--secondary)] mb-1">
                    Vencimiento LIO
                  </label>
                  <input
                    type="date"
                    value={formData.lente_vencimiento || ''}
                    onChange={(e) => setFormData({ ...formData, lente_vencimiento: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono text-xs text-[var(--foreground)] outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Checkbox Tórico Manual (si no viene de cálculo) */}
              {!tieneOpciones && (
                <div className="col-span-full pt-2 flex flex-wrap items-center gap-4 border-t border-blue-200/60 dark:border-blue-800/40">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.es_torico}
                      onChange={(e) => setFormData({ ...formData, es_torico: e.target.checked })}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                    />
                    <span className="font-bold text-xs text-purple-700 dark:text-purple-300">Lente Tórico (Astigmatismo)</span>
                  </label>

                  {formData.es_torico && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[var(--secondary)]">Valor Tórico:</span>
                        <input
                          type="number"
                          min="1"
                          max="9"
                          value={formData.lente_torico_valor}
                          onChange={(e) => setFormData({ ...formData, lente_torico_valor: Number(e.target.value) })}
                          className="w-16 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] font-bold text-center"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[var(--secondary)]">Eje de Implante:</span>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          value={formData.lente_torico_eje}
                          onChange={(e) => setFormData({ ...formData, lente_torico_eje: Number(e.target.value) })}
                          className="w-20 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] font-bold text-center text-purple-600"
                        />
                        <span className="font-bold text-purple-600">°</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Equipo Médico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1">Cirujano Principal</label>
          <input
            type="text"
            value={formData.cirujano_nombre}
            onChange={(e) => setFormData({ ...formData, cirujano_nombre: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1">Cirujano Ayudante</label>
          <input
            type="text"
            value={formData.ayudante_nombre}
            onChange={(e) => setFormData({ ...formData, ayudante_nombre: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1">Anestesiólogo</label>
          <input
            type="text"
            value={formData.anestesiologo_nombre}
            onChange={(e) => setFormData({ ...formData, anestesiologo_nombre: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1">Instrumentador/a</label>
          <input
            type="text"
            value={formData.instrumentador_nombre}
            onChange={(e) => setFormData({ ...formData, instrumentador_nombre: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Observaciones y Notas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1">Observaciones Prequirúrgicas</label>
          <textarea
            rows={3}
            value={formData.observaciones}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            placeholder="Antecedentes, indicaciones especiales, requerimientos de anestesia..."
            className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1 flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
            <Scissors size={14} />
            <span>Notas Intraoperatorias (Técnica y Hallazgos)</span>
          </label>
          <textarea
            rows={3}
            value={formData.observaciones_intraoperatorias || ''}
            onChange={(e) => setFormData({ ...formData, observaciones_intraoperatorias: e.target.value })}
            placeholder="Detalle de la técnica quirúrgica, rotura capsular, suturas, complicaciones..."
            className="w-full p-3 rounded-xl border border-purple-300 dark:border-purple-800 bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>
      </div>

      {/* Botón de Guardado */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        {mensajeExito ? (
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 size={14} /> {mensajeExito}
          </span>
        ) : <span />}

        <button
          type="submit"
          disabled={guardando}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-500/20 transition disabled:opacity-50"
        >
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>Guardar Cambios de Programación</span>
        </button>
      </div>
    </form>
  )
}
