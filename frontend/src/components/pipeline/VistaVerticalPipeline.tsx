'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Clock,
  ExternalLink,
  MessageSquare,
  Check,
  Calendar,
  Building2,
  User,
  Stethoscope,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  FileCheck2,
  FileText,
  Eye,
  Layers,
  Sparkles
} from 'lucide-react'

import type { AsesoriaCasoPipeline } from '@/app/pipeline-quirurgico/page'

interface ColumnaInfo {
  id: string
  titulo: string
  subtitulo: string
  colorHeader: string
  colorDot: string
}

interface VistaVerticalPipelineProps {
  columnasEtapas: ColumnaInfo[]
  etapasActivasFiltradas: Record<string, AsesoriaCasoPipeline[]>
  onCambiarEtapa: (caso: AsesoriaCasoPipeline, nuevaEtapa: string) => Promise<void>
  onAbrirWhatsApp: (caso: AsesoriaCasoPipeline) => void
  onMarcarContactadoHoy: (caso: AsesoriaCasoPipeline) => Promise<void>
  actualizandoCasoId: string | null
  canChangeStage: boolean
}

export default function VistaVerticalPipeline({
  columnasEtapas,
  etapasActivasFiltradas,
  onCambiarEtapa,
  onAbrirWhatsApp,
  onMarcarContactadoHoy,
  actualizandoCasoId,
  canChangeStage
}: VistaVerticalPipelineProps) {
  // Estado para colapsar o expandir cada etapa (todas abiertas por defecto)
  const [etapasColapsadas, setEtapasColapsadas] = useState<Record<string, boolean>>({})

  const toggleColapso = (colId: string) => {
    setEtapasColapsadas((prev) => ({
      ...prev,
      [colId]: !prev[colId]
    }))
  }

  const expandirTodas = () => setEtapasColapsadas({})
  const colapsarTodas = () => {
    const todas: Record<string, boolean> = {}
    columnasEtapas.forEach((c) => {
      todas[c.id] = true
    })
    setEtapasColapsadas(todas)
  }

  return (
    <div className="w-full space-y-4 pb-12">
      {/* Barra de control rápido de acordeones */}
      <div className="flex items-center justify-between px-1 text-xs text-gray-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Layers size={14} className="text-blue-400" />
          Vista Vertical de Flujo Continuo por Etapas
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandirTodas}
            className="text-[11px] hover:text-white transition-colors underline"
          >
            Expandir todas
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={colapsarTodas}
            className="text-[11px] hover:text-white transition-colors underline"
          >
            Colapsar todas
          </button>
        </div>
      </div>

      {/* Lista de Secciones Verticales por Etapa */}
      {columnasEtapas.map((col) => {
        const casos = etapasActivasFiltradas[col.id] || []
        const isColapsada = !!etapasColapsadas[col.id]

        const montoARS = casos
          .filter((c) => c.moneda_extra !== 'USD')
          .reduce((acc, c) => acc + Number(c.monto_extra || 0), 0)

        const montoUSD = casos
          .filter((c) => c.moneda_extra === 'USD')
          .reduce((acc, c) => acc + Number(c.monto_extra || 0), 0)

        return (
          <div
            key={col.id}
            className="rounded-2xl border border-[var(--border)] bg-neutral-950/70 overflow-hidden shadow-sm transition-all"
          >
            {/* Header del Acordeón de la Etapa */}
            <button
              type="button"
              onClick={() => toggleColapso(col.id)}
              className={`w-full flex items-center justify-between p-3.5 sm:px-5 transition-colors border-b ${
                isColapsada ? 'border-transparent hover:bg-neutral-900/60' : 'border-[var(--border)] bg-neutral-900/40 hover:bg-neutral-900/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-gray-400">
                  {isColapsada ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.colorDot}`} />
                  <h3 className="text-sm font-bold text-white tracking-wide">{col.titulo}</h3>
                  <span className="text-[11px] text-gray-400 hidden md:inline">• {col.subtitulo}</span>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/30">
                  {casos.length} {casos.length === 1 ? 'cirugía' : 'cirugías'}
                </span>
              </div>

              {/* Acumuladores de Montos por Etapa */}
              <div className="flex items-center gap-3 font-mono text-xs">
                {montoARS > 0 && (
                  <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                    ${montoARS.toLocaleString('es-AR')} ARS
                  </span>
                )}
                {montoUSD > 0 && (
                  <span className="font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                    USD {montoUSD.toLocaleString('es-AR')}
                  </span>
                )}
              </div>
            </button>

            {/* Contenedor de Casos Desplegable */}
            {!isColapsada && (
              <div className="p-3 sm:p-4 space-y-3">
                {casos.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500 border border-dashed border-[var(--border)] rounded-xl bg-neutral-900/20">
                    No hay cirugías en esta etapa con los filtros seleccionados
                  </div>
                ) : (
                  casos.map((caso) => {
                    const pac = caso.pacientes
                    const isCritico = caso.es_critico
                    const isAlerta = caso.es_alerta
                    const os = caso.cobertura_obra_social || pac?.obra_social
                    const checklist = caso.checklist_prequirurgico || {}

                    // Normalizar estadoSelectValue para quirófano en vivo
                    const estadoSelectValue = ['en_espera', 'pre_quirofano', 'en_operacion'].includes(caso.estado)
                      ? 'programado'
                      : caso.estado

                    // Cálculo semáforo de próxima acción
                    let labelFechaAccion = ''
                    let diasAccionDiferencia: number | null = null
                    let esAccionHoy = false
                    let esAccionVencida = false

                    if (caso.proxima_accion_fecha) {
                      const partes = caso.proxima_accion_fecha.split('-')
                      if (partes.length === 3) {
                        labelFechaAccion = `${partes[2]}/${partes[1]}`
                      } else {
                        labelFechaAccion = caso.proxima_accion_fecha
                      }

                      const hoy = new Date()
                      hoy.setHours(0, 0, 0, 0)
                      const fechaObj = new Date(`${caso.proxima_accion_fecha}T00:00:00`)
                      if (!isNaN(fechaObj.getTime())) {
                        const diffMs = fechaObj.getTime() - hoy.getTime()
                        diasAccionDiferencia = Math.round(diffMs / (1000 * 60 * 60 * 24))
                        if (diasAccionDiferencia === 0) esAccionHoy = true
                        else if (diasAccionDiferencia < 0) esAccionVencida = true
                      }
                    }

                    return (
                      <div
                        key={caso.id}
                        className={`p-4 rounded-xl border transition-all bg-neutral-900/90 hover:bg-neutral-900 ${
                          isCritico
                            ? 'border-red-500/60 shadow-sm shadow-red-950/20'
                            : isAlerta
                            ? 'border-amber-500/50 shadow-sm shadow-amber-950/20'
                            : 'border-[var(--border)] hover:border-blue-500/40'
                        }`}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                          {/* ==================================================================== */}
                          {/* COLUMNA 1: PACIENTE & IDENTIFICACIÓN (Lg: 3 cols) */}
                          {/* ==================================================================== */}
                          <div className="lg:col-span-3 space-y-1.5 border-b lg:border-b-0 lg:border-r border-[var(--border)] pb-3 lg:pb-0 lg:pr-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-500/40">
                                {caso.codigo_caso || 'QX-26-0001'}
                              </span>
                              {caso.ojo && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-gray-300 border border-[var(--border)]">
                                  {caso.ojo === 'AO' ? 'AO (Bilateral)' : caso.ojo}
                                </span>
                              )}
                              {caso.dias_sin_contacto !== undefined && (
                                <span
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 flex items-center gap-1 ${
                                    isCritico
                                      ? 'bg-red-950 text-red-300 border-red-500/60'
                                      : isAlerta
                                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                                      : 'bg-neutral-800 text-gray-400 border-[var(--border)]'
                                  }`}
                                  title={`Último contacto: hace ${caso.dias_sin_contacto} días`}
                                >
                                  <Clock size={10} />
                                  {caso.dias_sin_contacto === 0 ? 'Hoy' : `${caso.dias_sin_contacto}d sin contacto`}
                                </span>
                              )}
                            </div>

                            <div>
                              <Link
                                href={`/pacientes?id=${caso.paciente_id}`}
                                className="text-sm font-bold text-white hover:text-blue-400 transition-colors flex items-center gap-1.5"
                                title="Ver expediente clínico y caso quirúrgico"
                              >
                                <span>{pac?.nombre || 'Paciente sin nombre'}</span>
                                <ExternalLink size={12} className="text-blue-400 opacity-70 hover:opacity-100 shrink-0" />
                              </Link>
                              <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono pt-0.5">
                                {pac?.dni && <span>DNI: {pac.dni}</span>}
                                {pac?.telefono && (
                                  <>
                                    <span>•</span>
                                    <span>Tel: {pac.telefono}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ==================================================================== */}
                          {/* COLUMNA 2: CLÍNICA, CIRUJANO & OBRA SOCIAL (Lg: 3 cols) */}
                          {/* ==================================================================== */}
                          <div className="lg:col-span-3 space-y-1.5 border-b lg:border-b-0 lg:border-r border-[var(--border)] pb-3 lg:pb-0 lg:pr-3">
                            <div className="flex items-start gap-1.5 text-xs text-gray-200 font-medium">
                              <Stethoscope size={13} className="text-blue-400 shrink-0 mt-0.5" />
                              <span className="leading-snug">
                                {caso.practica_nombre || 'Práctica quirúrgica no especificada'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-gray-400 gap-2">
                              {caso.medico_cirujano_nombre ? (
                                <span className="flex items-center gap-1 text-emerald-400/90 font-medium truncate">
                                  <User size={12} className="shrink-0" />
                                  Dr/a. {caso.medico_cirujano_nombre}
                                </span>
                              ) : (
                                <span className="text-gray-500 italic">Sin cirujano asignado</span>
                              )}

                              {os && (
                                <span className="flex items-center gap-1 text-purple-300 font-medium shrink-0 max-w-[140px] truncate" title={os}>
                                  <Building2 size={12} className="shrink-0 text-purple-400" />
                                  {os}
                                </span>
                              )}
                            </div>

                            {/* Badge Bilateral si aplica */}
                            {checklist._progreso_bilateral?.es_bilateral && (
                              <div className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                                <span>👁️ Bilateral:</span>
                                <span>
                                  {checklist._progreso_bilateral.od_operado && !checklist._progreso_bilateral.oi_operado
                                    ? 'OD Operado • OI Pendiente'
                                    : !checklist._progreso_bilateral.od_operado && checklist._progreso_bilateral.oi_operado
                                    ? 'OI Operado • OD Pendiente'
                                    : 'Ambos ojos en proceso'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* ==================================================================== */}
                          {/* COLUMNA 3: FECHAS & PRÓXIMA ACCIÓN PROGRAMADA (Lg: 3 cols) */}
                          {/* ==================================================================== */}
                          <div className="lg:col-span-3 space-y-1.5 border-b lg:border-b-0 lg:border-r border-[var(--border)] pb-3 lg:pb-0 lg:pr-3">
                            {/* Fecha de Cirugía */}
                            <div className="text-xs">
                              {caso.fecha_definitiva_cirugia ? (
                                <div className="flex items-center gap-1.5 text-cyan-300 font-mono font-bold bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/30">
                                  <CalendarClock size={13} className="shrink-0 text-cyan-400" />
                                  <span>Definitiva: {caso.fecha_definitiva_cirugia}</span>
                                  {caso.turno_quirofano_info?.hora && (
                                    <span className="text-[10px] text-gray-400 font-normal">
                                      ({caso.turno_quirofano_info.hora}hs {caso.turno_quirofano_info.quirofano_nombre || ''})
                                    </span>
                                  )}
                                </div>
                              ) : caso.fecha_probable_cirugia ? (
                                <div className="flex items-center gap-1.5 text-gray-300 font-mono text-[11px]">
                                  <Calendar size={13} className="shrink-0 text-amber-400" />
                                  <span>Probable: {caso.fecha_probable_cirugia}</span>
                                </div>
                              ) : (
                                <span className="text-gray-500 text-[11px] italic">Sin fecha quirúrgica pautada</span>
                              )}
                            </div>

                            {/* Próxima Acción Programada */}
                            {Boolean(caso.proxima_accion_fecha || caso.proxima_accion_texto) && (
                              <div
                                className={`p-1.5 rounded-lg border text-[11px] flex items-start gap-1.5 ${
                                  esAccionVencida
                                    ? 'bg-red-950/40 border-red-500/40 text-red-200'
                                    : esAccionHoy
                                    ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                                    : 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                                }`}
                              >
                                <Clock size={12} className="shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {caso.proxima_accion_fecha && (
                                      <span className="font-mono font-bold">
                                        {esAccionHoy ? 'HOY' : esAccionVencida ? `Vencida (${labelFechaAccion})` : `${labelFechaAccion} (${diasAccionDiferencia}d)`}
                                      </span>
                                    )}
                                    {caso.proxima_accion_texto && (
                                      <span className="truncate opacity-90">• {caso.proxima_accion_texto}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Mini Checklist de Preparación */}
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded border ${
                                  checklist.estudios_completos
                                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                                    : 'bg-neutral-800 text-gray-500 border-neutral-700'
                                }`}
                              >
                                {checklist.estudios_completos ? '✓ Estudios' : 'Estudios'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded border ${
                                  checklist.lente_seleccionado
                                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                                    : 'bg-neutral-800 text-gray-500 border-neutral-700'
                                }`}
                              >
                                {checklist.lente_seleccionado ? '✓ LIO' : 'LIO'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded border ${
                                  checklist.consentimiento_firmado
                                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                                    : 'bg-neutral-800 text-gray-500 border-neutral-700'
                                }`}
                              >
                                {checklist.consentimiento_firmado ? '✓ C.I. Firmado' : 'C.I.'}
                              </span>
                            </div>
                          </div>

                          {/* ==================================================================== */}
                          {/* COLUMNA 4: ECONÓMICO & ACCIONES RÁPIDAS (Lg: 3 cols) */}
                          {/* ==================================================================== */}
                          <div className="lg:col-span-3 flex flex-col justify-between space-y-2.5">
                            {/* Monto de la Cirugía */}
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                Presupuesto:
                              </span>
                              <span className="text-xs font-mono font-bold">
                                {Number(caso.monto_extra || 0) > 0 ? (
                                  caso.moneda_extra === 'USD' ? (
                                    <span className="text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                                      USD {Number(caso.monto_extra).toLocaleString('es-AR')}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                                      ${Number(caso.monto_extra).toLocaleString('es-AR')} ARS
                                    </span>
                                  )
                                ) : (
                                  <span className="text-gray-500 font-normal">Sin cotizar</span>
                                )}
                              </span>
                            </div>

                            {/* Fila de Botones y Selector de Etapa */}
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              {/* Botón Agendar si está Confirmado o Programado */}
                              {(caso.estado === 'confirmado' || caso.estado === 'programado') && (
                                <Link
                                  href={`/programacion-quirurgica?asesoria_id=${caso.id}&paciente_id=${caso.paciente_id}`}
                                  className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10.5px] flex items-center gap-1 shadow transition-colors"
                                  title="Asignar o editar turno en el Quirófano"
                                >
                                  <CalendarClock size={12} />
                                  <span>{caso.estado === 'programado' ? 'Turno Qx' : 'Agendar'}</span>
                                </Link>
                              )}

                              {/* Botón WhatsApp */}
                              <button
                                type="button"
                                onClick={() => onAbrirWhatsApp(caso)}
                                className="px-2 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-[10.5px] font-bold flex items-center gap-1 transition-colors"
                                title="Enviar mensaje de WhatsApp al paciente"
                              >
                                <MessageSquare size={12} />
                                <span>WhatsApp</span>
                              </button>

                              {/* Botón Contactado Hoy */}
                              <button
                                type="button"
                                onClick={() => onMarcarContactadoHoy(caso)}
                                disabled={actualizandoCasoId === caso.id}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-[var(--border)] text-gray-300 hover:text-blue-400 transition-colors"
                                title="Registrar contacto hoy (reinicia SLA)"
                              >
                                <Check size={13} />
                              </button>

                              {/* Selector para mover de etapa */}
                              <select
                                value={estadoSelectValue}
                                disabled={actualizandoCasoId === caso.id}
                                onChange={(e) => onCambiarEtapa(caso, e.target.value)}
                                className="text-[10.5px] font-semibold bg-neutral-800 border border-[var(--border)] text-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                              >
                                <option value="derivado">1. Derivado</option>
                                <option value="en_asesoramiento">2. Asesoramiento</option>
                                <option value="en_analisis">3. Análisis</option>
                                <option value="confirmado">4. Confirmado</option>
                                <option value="programado">5. Programado</option>
                                <option disabled>──────────</option>
                                <option value="operado">✔ Operado (Cerrar)</option>
                                <option value="cancelado">✖ Cancelar (Cerrar)</option>
                              </select>
                            </div>
                          </div>

                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
