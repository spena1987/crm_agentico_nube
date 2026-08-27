'use client'

import React from 'react'
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
  CheckCheck
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

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

      {/* Grid de Configuración de Cirugía */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sala de Quirófano */}
        <div>
          <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Sala de Quirófano</label>
          <select
            value={formData.quirofano_id}
            onChange={(e) => setFormData({ ...formData, quirofano_id: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Seleccionar sala...</option>
            {quirofanos.map((q) => (
              <option key={q.id} value={q.id}>{q.nombre} ({q.codigo})</option>
            ))}
          </select>
        </div>

        {/* Lateralidad Ocular */}
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

      {/* Sección LIO / Implante */}
      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.lleva_lente}
              onChange={(e) => setFormData({ ...formData, lleva_lente: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
            />
            <span className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Sparkles size={15} className="text-blue-600" />
              <span>Implante de Lente Intraocular (LIO)</span>
            </span>
          </label>
        </div>

        {formData.lleva_lente && (
          <>
            {/* Selector de Opciones Pre-Calculadas por el Cirujano */}
            {Array.isArray(turno.lio_calculo_opciones) && turno.lio_calculo_opciones.length > 0 && (
              <div className="p-3 rounded-xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/80 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-cyan-800 dark:text-cyan-200 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-500" />
                    <span>Opciones Calculadas por el Cirujano ({turno.lio_calculo_opciones.length}):</span>
                  </span>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">
                    1-Clic para cargar a la cirugía
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {turno.lio_calculo_opciones.map((op: any, i: number) => {
                    const esSeleccionado =
                      formData.lente_tipo === op.modelo && formData.lente_dioptria === op.dioptria

                    return (
                      <button
                        key={op.id || i}
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
                        className={`p-2.5 rounded-xl text-left border transition text-xs flex items-center justify-between ${
                          esSeleccionado
                            ? 'bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-500/40 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-cyan-400'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-extrabold text-cyan-900 dark:text-cyan-200 block text-xs truncate">
                            {op.etiqueta || `Opción ${i + 1}`}
                          </span>
                          <span className="text-[11px] text-[var(--secondary)] block truncate">
                            {op.modelo} <b className="text-blue-600 dark:text-blue-400">({op.dioptria} D)</b>
                            {op.es_torico ? ` • T${op.torico_valor} (${op.torico_eje}°)` : ''}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            esSeleccionado
                              ? 'bg-cyan-500 text-black'
                              : 'bg-slate-100 dark:bg-slate-800 text-[var(--foreground)]'
                          }`}
                        >
                          {esSeleccionado ? 'Activo' : 'Cargar'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 animate-fade-in text-xs">
            <div>
              <label className="block font-bold text-[var(--foreground)] mb-1">Modelo de LIO</label>
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
              <label className="block font-bold text-[var(--foreground)] mb-1">Dioptría (Poder)</label>
              <input
                type="text"
                value={formData.lente_dioptria}
                onChange={(e) => setFormData({ ...formData, lente_dioptria: e.target.value })}
                placeholder="Ej: +21.50 D"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--foreground)] mb-1">N° de Lote</label>
              <input
                type="text"
                value={formData.lente_lote || ''}
                onChange={(e) => setFormData({ ...formData, lente_lote: e.target.value })}
                placeholder="Ej: LOT-98214"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--foreground)] mb-1">N° de Serie</label>
              <input
                type="text"
                value={formData.lente_serie || ''}
                onChange={(e) => setFormData({ ...formData, lente_serie: e.target.value })}
                placeholder="Ej: SN-44120"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Configuración Tórica */}
            <div className="col-span-full pt-2 flex flex-wrap items-center gap-4 border-t border-blue-200/60 dark:border-blue-800/40">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.es_torico}
                  onChange={(e) => setFormData({ ...formData, es_torico: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
                <span className="font-bold text-purple-700 dark:text-purple-300">Lente Tórico (Astigmatismo)</span>
              </label>

              {formData.es_torico && (
                <div className="flex items-center gap-3">
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
          </div>
        </>
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

      {/* Observaciones Prequirúrgicas & Intraoperatorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1">Observaciones Prequirúrgicas</label>
          <textarea
            rows={3}
            value={formData.observaciones}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            placeholder="Antecedentes, indicaciones especiales, requerimientos de anestesia..."
            className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block font-bold text-[var(--foreground)] mb-1 flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
            <Scissors size={14} />
            <span>Notas Intraoperatorias (Técnica y Hallazgos)</span>
          </label>
          <textarea
            rows={3}
            value={formData.observaciones_intraoperatorias}
            onChange={(e) => setFormData({ ...formData, observaciones_intraoperatorias: e.target.value })}
            placeholder="Detalle de la técnica quirúrgica, rotura capsular, suturas, complicaciones..."
            className="w-full p-3 rounded-xl border border-purple-300 dark:border-purple-800 bg-[var(--background)] outline-none focus:ring-2 focus:ring-purple-500 font-sans"
          />
        </div>
      </div>

      {/* Botón Guardar Cambios */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        {mensajeExito ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            ✔ {mensajeExito}
          </span>
        ) : <span />}

        <button
          type="submit"
          disabled={guardando}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow transition disabled:opacity-50"
        >
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>Guardar Cambios de Programación</span>
        </button>
      </div>
    </form>
  )
}