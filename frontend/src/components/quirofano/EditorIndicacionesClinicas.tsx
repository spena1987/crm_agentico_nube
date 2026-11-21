'use client'

import React, { useState, useEffect, useId } from 'react'
import { Plus, Trash2, RotateCcw, AlertTriangle, Pill, FileText, ShieldAlert, Sparkles } from 'lucide-react'

export interface MedicamentoEditable {
  droga: string
  dosis: string
  frecuencia: string
  duracion: string
  instrucciones: string
}

export interface ModuloIndicacionEditable {
  id: string
  titulo: string
  activo: boolean
  cuerpo_indicaciones: string
  medicamentos: MedicamentoEditable[]
  cuidados_generales: string
  pautas_alarma: string
  origen?: string
}

export interface EditorIndicacionesClinicasProps {
  modulos: ModuloIndicacionEditable[]
  snapshotOriginal: ModuloIndicacionEditable[]
  onChange: (modulos: ModuloIndicacionEditable[]) => void
  variant?: 'dark' | 'light'
  disabled?: boolean
}

const FRECUENCIAS_SUGERIDAS = [
  '1 gota cada 4 hs',
  '1 gota cada 6 hs',
  '1 gota cada 8 hs',
  '1 gota cada 12 hs',
  '1 gota cada 24 hs',
  '1 gota cada 2 hs',
  '1 aplicación antes de dormir',
  'Según necesidad por ardor o arenilla'
]

export function normalizarMedicamento(med: any): MedicamentoEditable {
  if (!med || typeof med !== 'object') {
    return { droga: '', dosis: '', frecuencia: '', duracion: '', instrucciones: '' }
  }
  return {
    droga: String(med.droga ?? med.medicamento ?? med.nombre ?? ''),
    dosis: String(med.dosis ?? ''),
    frecuencia: String(med.frecuencia ?? med.horario ?? ''),
    duracion: String(med.duracion ?? ''),
    instrucciones: String(med.instrucciones ?? med.notas ?? '')
  }
}

export function normalizarModulo(m: any, idx = 0): ModuloIndicacionEditable {
  return {
    id: String(m?.id || m?.plantilla_id || `mod-${idx}`),
    titulo: String(m?.titulo || `Indicación #${idx + 1}`),
    activo: m?.activo !== false,
    cuerpo_indicaciones: String(m?.cuerpo_indicaciones ?? m?.texto_indicaciones ?? m?.texto ?? ''),
    medicamentos: Array.isArray(m?.medicamentos) ? m.medicamentos.map(normalizarMedicamento) : [],
    cuidados_generales: String(m?.cuidados_generales ?? ''),
    pautas_alarma: String(m?.pautas_alarma ?? ''),
    origen: m?.origen ? String(m.origen) : undefined
  }
}

export function legacyEmisionAModulos(emision: any, tituloFallback = 'Indicaciones Médicas'): ModuloIndicacionEditable[] {
  if (!emision) return []
  if (Array.isArray(emision.modulos_emitidos_json) && emision.modulos_emitidos_json.length > 0) {
    return emision.modulos_emitidos_json.map((m: any, idx: number) => normalizarModulo(m, idx))
  }
  return [
    normalizarModulo(
      {
        id: emision.id || 'legacy-0',
        titulo: emision.practica_nombre || tituloFallback,
        activo: true,
        cuerpo_indicaciones: emision.texto_indicaciones || emision.cuerpo_indicaciones || '',
        medicamentos: emision.medicamentos || [],
        cuidados_generales: emision.cuidados_generales || '',
        pautas_alarma: emision.pautas_alarma || ''
      },
      0
    )
  ]
}

function moduloEsIgual(a?: ModuloIndicacionEditable, b?: ModuloIndicacionEditable): boolean {
  if (!a || !b) return false
  if ((a.cuerpo_indicaciones || '').trim() !== (b.cuerpo_indicaciones || '').trim()) return false
  if ((a.cuidados_generales || '').trim() !== (b.cuidados_generales || '').trim()) return false
  if ((a.pautas_alarma || '').trim() !== (b.pautas_alarma || '').trim()) return false
  if ((a.medicamentos || []).length !== (b.medicamentos || []).length) return false
  for (let i = 0; i < a.medicamentos.length; i++) {
    const ma = a.medicamentos[i]
    const mb = b.medicamentos[i]
    if (
      ma.droga.trim() !== mb.droga.trim() ||
      ma.dosis.trim() !== mb.dosis.trim() ||
      ma.frecuencia.trim() !== mb.frecuencia.trim() ||
      ma.duracion.trim() !== mb.duracion.trim() ||
      ma.instrucciones.trim() !== mb.instrucciones.trim()
    ) {
      return false
    }
  }
  return true
}

export function modulosTienenCambios(actuales: ModuloIndicacionEditable[], originales: ModuloIndicacionEditable[]): boolean {
  const act = actuales.filter((m) => m.activo)
  const orig = originales.filter((m) => m.activo)
  if (orig.length === 0) return false
  if (act.length !== orig.length) return true
  return act.some((m, i) => {
    const matchOrig = orig.find((o) => o.id === m.id) || orig[i]
    return !moduloEsIgual(m, matchOrig)
  })
}

export default function EditorIndicacionesClinicas({
  modulos,
  snapshotOriginal,
  onChange,
  variant = 'dark',
  disabled = false
}: EditorIndicacionesClinicasProps) {
  const datalistId = useId()
  const activos = modulos.filter((m) => m.activo)
  const [activeTabId, setActiveTabId] = useState<string>(activos[0]?.id || '')

  useEffect(() => {
    if (activos.length > 0 && !activos.some((m) => m.id === activeTabId)) {
      setActiveTabId(activos[0].id)
    }
  }, [activos, activeTabId])

  const isDark = variant === 'dark'

  const cls = {
    container: isDark
      ? 'rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-3'
      : 'rounded-xl bg-[var(--background)] border border-[var(--border-color)] p-3 space-y-3',
    label: isDark ? 'text-[11px] font-bold text-slate-300' : 'text-[11px] font-bold text-[var(--foreground)]',
    subLabel: isDark ? 'text-[10px] text-slate-500' : 'text-[10px] text-[var(--secondary)]',
    input: isDark
      ? 'w-full text-xs p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none'
      : 'w-full text-xs p-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] focus:border-blue-500 focus:outline-none',
    rowCard: isDark
      ? 'p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5'
      : 'p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] space-y-1.5',
    alarmBox: isDark
      ? 'w-full text-xs p-2 rounded-lg border border-amber-800/70 bg-amber-950/20 text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none'
      : 'w-full text-xs p-2 rounded-lg border border-amber-500/40 bg-amber-500/5 text-[var(--foreground)] focus:border-amber-500 focus:outline-none',
    tabActive: isDark
      ? 'bg-cyan-950 text-cyan-200 border-cyan-600'
      : 'bg-blue-600/15 text-blue-600 border-blue-500/60',
    tabInactive: isDark
      ? 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
      : 'bg-[var(--card-bg)] text-[var(--secondary)] border-[var(--border-color)] hover:text-[var(--foreground)]'
  }

  if (activos.length === 0) {
    return (
      <div className={cls.container}>
        <p className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
          <AlertTriangle size={14} />
          Active al menos un módulo o seleccione una plantilla para editar las indicaciones.
        </p>
      </div>
    )
  }

  const moduloActual = activos.find((m) => m.id === activeTabId) || activos[0]
  const origActual = snapshotOriginal.find((o) => o.id === moduloActual.id) || snapshotOriginal[0]
  const estaEditado = origActual ? !moduloEsIgual(moduloActual, origActual) : false

  const updateModulo = (updater: (m: ModuloIndicacionEditable) => ModuloIndicacionEditable) => {
    const next = modulos.map((m) => (m.id === moduloActual.id ? updater(m) : m))
    onChange(next)
  }

  const handleRestaurarOriginal = () => {
    if (!origActual) return
    updateModulo((m) => ({
      ...m,
      cuerpo_indicaciones: origActual.cuerpo_indicaciones,
      medicamentos: origActual.medicamentos.map((x) => ({ ...x })),
      cuidados_generales: origActual.cuidados_generales,
      pautas_alarma: origActual.pautas_alarma
    }))
  }

  const handleAddMed = () => {
    updateModulo((m) => ({
      ...m,
      medicamentos: [
        ...m.medicamentos,
        { droga: '', dosis: '1 gota', frecuencia: '', duracion: '', instrucciones: '' }
      ]
    }))
  }

  const handleUpdateMed = (idx: number, field: keyof MedicamentoEditable, val: string) => {
    updateModulo((m) => {
      const meds = [...m.medicamentos]
      meds[idx] = { ...meds[idx], [field]: val }
      return { ...m, medicamentos: meds }
    })
  }

  const handleRemoveMed = (idx: number) => {
    updateModulo((m) => ({
      ...m,
      medicamentos: m.medicamentos.filter((_, i) => i !== idx)
    }))
  }

  return (
    <div className={cls.container}>
      <datalist id={datalistId}>
        {FRECUENCIAS_SUGERIDAS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {/* Selector por módulo cuando hay 2+ módulos activos */}
      {activos.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800/60">
          {activos.map((m, idx) => {
            const origM = snapshotOriginal.find((o) => o.id === m.id) || snapshotOriginal[idx]
            const modEdit = origM ? !moduloEsIgual(m, origM) : false
            const isSel = m.id === moduloActual.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveTabId(m.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1.5 ${
                  isSel ? cls.tabActive : cls.tabInactive
                }`}
              >
                <span>
                  Hoja {idx + 1}: {m.titulo}
                </span>
                {modEdit && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Editado manualmente" />}
              </button>
            )
          })}
        </div>
      )}

      {/* Encabezado de estado del módulo actual */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileText size={13} className="text-cyan-400" />
          <span className={cls.label}>
            {activos.length > 1 ? `Editando: ${moduloActual.titulo}` : 'Contenido Clínico Editable'}
          </span>
          {estaEditado && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Sparkles size={10} />
              Editado para este paciente (plantilla maestra intacta)
            </span>
          )}
        </div>
        {estaEditado && origActual && !disabled && (
          <button
            type="button"
            onClick={handleRestaurarOriginal}
            className="text-[10.5px] font-bold text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition"
          >
            <RotateCcw size={11} />
            Restaurar original
          </button>
        )}
      </div>

      {/* 1. Cuerpo de indicaciones */}
      <div className="space-y-1">
        <label className={cls.label}>Cuerpo de la Indicación:</label>
        <textarea
          rows={4}
          disabled={disabled}
          value={moduloActual.cuerpo_indicaciones}
          onChange={(e) => updateModulo((m) => ({ ...m, cuerpo_indicaciones: e.target.value }))}
          placeholder="Escriba aquí el cuerpo de las indicaciones, horarios de control o aclaraciones puntuales..."
          className={cls.input}
        />
      </div>

      {/* 2. Medicamentos / Colirios editables */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className={`${cls.label} flex items-center gap-1.5`}>
            <Pill size={12} className="text-blue-400" />
            <span>Medicamentos, Dosis & Frecuencias ({moduloActual.medicamentos.length}):</span>
          </label>
          {!disabled && (
            <button
              type="button"
              onClick={handleAddMed}
              className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[10.5px] font-bold flex items-center gap-1 transition"
            >
              <Plus size={11} />
              Agregar medicamento
            </button>
          )}
        </div>

        {moduloActual.medicamentos.length === 0 ? (
          <p className={cls.subLabel}>Sin fármacos o colirios cargados. Puede agregar uno manualmente con el botón superior.</p>
        ) : (
          <div className="space-y-1.5">
            {moduloActual.medicamentos.map((med, idx) => (
              <div key={idx} className={cls.rowCard}>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                  <input
                    type="text"
                    disabled={disabled}
                    value={med.droga}
                    onChange={(e) => handleUpdateMed(idx, 'droga', e.target.value)}
                    placeholder="Droga / Colirio"
                    className={`${cls.input} sm:col-span-4`}
                  />
                  <input
                    type="text"
                    disabled={disabled}
                    value={med.dosis}
                    onChange={(e) => handleUpdateMed(idx, 'dosis', e.target.value)}
                    placeholder="Dosis (ej. 1 gota)"
                    className={`${cls.input} sm:col-span-2`}
                  />
                  <input
                    type="text"
                    list={datalistId}
                    disabled={disabled}
                    value={med.frecuencia}
                    onChange={(e) => handleUpdateMed(idx, 'frecuencia', e.target.value)}
                    placeholder="Frecuencia / Horario"
                    className={`${cls.input} sm:col-span-3`}
                  />
                  <input
                    type="text"
                    disabled={disabled}
                    value={med.duracion}
                    onChange={(e) => handleUpdateMed(idx, 'duracion', e.target.value)}
                    placeholder="Duración (ej. 7 días)"
                    className={`${cls.input} sm:col-span-2`}
                  />
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMed(idx)}
                      title="Quitar medicamento"
                      className="sm:col-span-1 p-1.5 rounded-lg text-red-400 hover:bg-red-500/15 flex items-center justify-center transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  disabled={disabled}
                  value={med.instrucciones}
                  onChange={(e) => handleUpdateMed(idx, 'instrucciones', e.target.value)}
                  placeholder="Instrucciones adicionales (ej. Agitar antes de usar, esperar 10 min entre gotas)"
                  className={cls.input}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Cuidados generales */}
      <div className="space-y-1">
        <label className={cls.label}>Cuidados Generales y Reposo:</label>
        <textarea
          rows={3}
          disabled={disabled}
          value={moduloActual.cuidados_generales}
          onChange={(e) => updateModulo((m) => ({ ...m, cuidados_generales: e.target.value }))}
          placeholder="Cuidados de higiene, reposo, uso de protector ocular..."
          className={cls.input}
        />
      </div>

      {/* 4. Pautas de alarma */}
      <div className="space-y-1">
        <label className={`${cls.label} flex items-center gap-1.5`}>
          <ShieldAlert size={12} className="text-amber-400" />
          <span>Pautas de Alarma:</span>
        </label>
        <textarea
          rows={2}
          disabled={disabled}
          value={moduloActual.pautas_alarma}
          onChange={(e) => updateModulo((m) => ({ ...m, pautas_alarma: e.target.value }))}
          placeholder="Signos de alarma por los cuales acudir a guardia..."
          className={cls.alarmBox}
        />
      </div>
    </div>
  )
}
