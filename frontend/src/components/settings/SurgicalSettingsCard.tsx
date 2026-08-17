'use client'

import React, { useState, useEffect } from 'react'
import {
  Stethoscope,
  Clock,
  MessageSquare,
  ClipboardCheck,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface ItemChecklist {
  id: string
  label: string
}

interface PlantillaWA {
  id: string
  titulo: string
  mensaje: string
}

export default function SurgicalSettingsCard() {
  const [slaAlerta, setSlaAlerta] = useState(3)
  const [slaCritico, setSlaCritico] = useState(6)
  const [checklistItems, setChecklistItems] = useState<ItemChecklist[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaWA[]>([])

  const [nuevoItemChecklist, setNuevoItemChecklist] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Cargar configuración actual
  const fetchConfig = async () => {
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${BACKEND_URL}/api/configuracion-quirurgica`)
      const data = await res.json()
      if (res.ok && data.success && data.configuracion) {
        const conf = data.configuracion
        setSlaAlerta(conf.sla_dias_alerta || 3)
        setSlaCritico(conf.sla_dias_critico || 6)
        setChecklistItems(conf.checklist_items || [])
        setPlantillas(conf.plantillas_whatsapp || [])
      }
    } catch (err: any) {
      console.error('Error cargando configuración quirúrgica:', err)
      setError('No se pudo conectar con el servidor para cargar la configuración.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  // Guardar configuración
  const handleGuardarConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setGuardando(true)
      setError(null)

      const payload = {
        sla_dias_alerta: slaAlerta,
        sla_dias_critico: slaCritico,
        checklist_items: checklistItems,
        plantillas_whatsapp: plantillas
      }

      const res = await fetch(`${BACKEND_URL}/api/configuracion-quirurgica`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al guardar configuración.')
      }

      setMensajeExito('✔ Configuración quirúrgica guardada y sincronizada.')
      setTimeout(() => setMensajeExito(null), 3500)
    } catch (err: any) {
      console.error('Error guardando configuración:', err)
      setError(err.message || 'Error al guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  // Agregar ítem al checklist
  const handleAgregarChecklist = () => {
    if (!nuevoItemChecklist.trim()) return
    const id = nuevoItemChecklist
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
    const item: ItemChecklist = {
      id: `${id}_${Date.now().toString().slice(-4)}`,
      label: nuevoItemChecklist.trim()
    }
    setChecklistItems((prev) => [...prev, item])
    setNuevoItemChecklist('')
  }

  // Eliminar ítem del checklist
  const handleEliminarChecklist = (id: string) => {
    setChecklistItems((prev) => prev.filter((it) => it.id !== id))
  }

  // Agregar plantilla de WhatsApp
  const handleAgregarPlantilla = () => {
    const nueva: PlantillaWA = {
      id: `plantilla_${Date.now()}`,
      titulo: 'Nueva Plantilla de Contacto',
      mensaje: 'Hola {paciente}, te contacto por tu procedimiento de {cirugia}...'
    }
    setPlantillas((prev) => [...prev, nueva])
  }

  // Actualizar plantilla
  const handleUpdatePlantilla = (id: string, campo: 'titulo' | 'mensaje', valor: string) => {
    setPlantillas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
    )
  }

  // Eliminar plantilla
  const handleEliminarPlantilla = (id: string) => {
    if (plantillas.length <= 1) {
      alert('Debes mantener al menos una plantilla de WhatsApp.')
      return
    }
    setPlantillas((prev) => prev.filter((p) => p.id !== id))
  }

  if (cargando) {
    return (
      <div className="p-12 text-center text-xs text-gray-500 flex items-center justify-center gap-2 bg-[var(--card)] rounded-2xl border border-[var(--border)]">
        <Loader2 size={16} className="animate-spin text-blue-500" />
        <span>Cargando configuración quirúrgica...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Header de la Sección */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-5 rounded-2xl bg-[var(--card)] border border-blue-500/20 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shadow-inner">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[var(--foreground)]">
              Configuración Quirúrgica & Conversión (Lead-to-Surgery)
            </h3>
            <p className="text-xs text-[var(--secondary)]">
              Personaliza las alertas SLA de seguimiento, plantillas de WhatsApp con 1 clic y requisitos del checklist prequirúrgico.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleGuardarConfig()}
          disabled={guardando}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
        >
          {guardando ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save size={14} />
              Guardar Configuración
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mensajeExito && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ==================================================================== */}
        {/* COLUMNA 1: CALIBRACIÓN DE SEMÁFORO SLA & CHECKLIST */}
        {/* ==================================================================== */}
        <div className="space-y-6">
          
          {/* 1. Calibración de Semáforo SLA */}
          <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <h4 className="text-xs font-bold text-[var(--foreground)]">
                Semáforo SLA de Seguimiento (Lead Aging)
              </h4>
            </div>

            <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
              Define los días máximos sin contacto para clasificar a los pacientes en el embudo y alertar a las asesoras.
            </p>

            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                <label className="text-xs font-bold text-amber-500 flex items-center justify-between">
                  <span>🟡 Alerta de Atención (Amarillo):</span>
                  <span className="font-mono text-sm">{slaAlerta} días</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={slaAlerta}
                  onChange={(e) => setSlaAlerta(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-[var(--secondary)] block">
                  Sin contacto entre {slaAlerta} y {slaCritico - 1} días.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-1.5">
                <label className="text-xs font-bold text-red-500 flex items-center justify-between">
                  <span>🔴 Alerta Crítica / Enfriándose (Rojo):</span>
                  <span className="font-mono text-sm">{slaCritico} días</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="15"
                  value={slaCritico}
                  onChange={(e) => setSlaCritico(Number(e.target.value))}
                  className="w-full accent-red-500 cursor-pointer"
                />
                <span className="text-[10px] text-[var(--secondary)] block">
                  Más de {slaCritico} días sin contacto registrado.
                </span>
              </div>
            </div>
          </div>

          {/* 2. Checklist Prequirúrgico Predeterminado */}
          <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-emerald-500" />
                <h4 className="text-xs font-bold text-[var(--foreground)]">
                  Checklist Prequirúrgico Global
                </h4>
              </div>
              <span className="text-[10px] text-[var(--secondary)] font-mono font-bold">
                {checklistItems.length} ítems
              </span>
            </div>

            <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
              Requisitos médicos y administrativos estándar requeridos antes de confirmar quirófano.
            </p>

            <div className="space-y-2">
              {checklistItems.map((it, idx) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-[var(--border)] text-xs text-[var(--foreground)] group"
                >
                  <span className="truncate pr-2 font-medium">
                    {idx + 1}. {it.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEliminarChecklist(it.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Agregar nuevo ítem */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Ej: Evaluación Neumonológica..."
                value={nuevoItemChecklist}
                onChange={(e) => setNuevoItemChecklist(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAgregarChecklist()
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] rounded-xl focus:outline-none focus:border-emerald-500 text-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={handleAgregarChecklist}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shrink-0"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

        </div>

        {/* ==================================================================== */}
        {/* COLUMNA 2 Y 3: EDITOR DE PLANTILLAS DE WHATSAPP (1-CLIC OUTREACH) */}
        {/* ==================================================================== */}
        <div className="lg:col-span-2 space-y-4 p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-500" />
              <h4 className="text-xs font-bold text-[var(--foreground)]">
                Plantillas de Mensajes de WhatsApp (1 Clic Outreach)
              </h4>
            </div>

            <button
              type="button"
              onClick={handleAgregarPlantilla}
              className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Plus size={13} />
              + Nueva Plantilla
            </button>
          </div>

          {/* Guía de Variables Dinámicas */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-[var(--secondary)] space-y-1.5">
            <p className="flex items-center gap-1.5 font-bold text-blue-500 text-[11px]">
              <Info size={13} />
              Variables Dinámicas Disponibles:
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {`{paciente}`}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {`{cirugia}`}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {`{medico_cirujano}`}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {`{monto}`}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {`{fecha_probable}`}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {`{fecha_definitiva}`}
              </span>
            </div>
          </div>

          {/* Lista de Plantillas Editables */}
          <div className="space-y-4 pt-2">
            {plantillas.map((p, idx) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-[var(--border)] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[var(--card)] text-slate-400 border border-[var(--border)]">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={p.titulo}
                      onChange={(e) => handleUpdatePlantilla(p.id, 'titulo', e.target.value)}
                      placeholder="Título de la plantilla..."
                      className="text-xs font-bold bg-transparent border-b border-transparent focus:border-emerald-500 text-[var(--foreground)] w-full focus:outline-none px-1 py-0.5"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEliminarPlantilla(p.id)}
                    className="text-slate-400 hover:text-red-500 p-1 transition-colors shrink-0"
                    title="Eliminar plantilla"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <textarea
                  value={p.mensaje}
                  onChange={(e) => handleUpdatePlantilla(p.id, 'mensaje', e.target.value)}
                  rows={3}
                  className="w-full p-3 text-xs border border-[var(--border)] rounded-xl bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed resize-none font-normal"
                />
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}
