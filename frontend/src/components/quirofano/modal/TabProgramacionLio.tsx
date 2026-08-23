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
  AlertCircle
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

        {/* Consentimiento */}
        <div>
          {turno.consentimiento_estado === 'firmado_digital' ? (
            <a
              href={`${BACKEND_URL}${turno.consentimiento_pdf_url || '/static/consentimiento_' + turno.id + '.pdf'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition"
            >
              <FileCheck2 size={14} />
              <span>Ver Consentimiento Firmado (PDF)</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <AlertCircle size={14} />
              <span>Consentimiento Pendiente</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 animate-fade-in text-xs">
            <div>
              <label className="block font-bold text-[var(--foreground)] mb-1">Modelo de LIO</label>
              <input
                type="text"
                list="modelos-lio-list"
                value={formData.lente_tipo}
                onChange={(e) => setFormData({ ...formData, lente_tipo: e.target.value })}
                placeholder="Ej: Alcon AcrySof IQ"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="modelos-lio-list">
                {modelosLio.map((m) => (
                  <option key={m.id} value={`${m.modelo} (${m.marca})`} />
                ))}
              </datalist>
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