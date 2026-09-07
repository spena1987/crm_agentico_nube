'use client'

import React, { useMemo, useRef, useEffect } from 'react'
import { User, Shield, AlertCircle, Phone, Calendar, CheckCircle, HeartPulse, Eye } from 'lucide-react'
import { PacienteData, HistoriaClinicaOftalmo } from './types'
import TagSelectorPopover from './TagSelectorPopover'

interface HeaderPacienteFijoProps {
  paciente: PacienteData
  historia: HistoriaClinicaOftalmo
  onUpdatePaciente: (fields: Partial<PacienteData>) => void
  onUpdateHistoria: (fields: Partial<HistoriaClinicaOftalmo>) => void
  guardando: boolean
  ultimoGuardado: string | null
}

export default function HeaderPacienteFijo({
  paciente,
  historia,
  onUpdatePaciente,
  onUpdateHistoria,
  guardando,
  ultimoGuardado
}: HeaderPacienteFijoProps) {
  // Cálculo dinámico de edad
  const edadCalculada = useMemo(() => {
    if (!paciente.fecha_nacimiento) return ''
    const fn = new Date(paciente.fecha_nacimiento)
    if (isNaN(fn.getTime())) return ''
    const hoy = new Date()
    let edad = hoy.getFullYear() - fn.getFullYear()
    const m = hoy.getMonth() - fn.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) {
      edad--
    }
    return edad >= 0 && edad < 125 ? `${edad} años` : ''
  }, [paciente.fecha_nacimiento])

  const handleAddExtraTag = (catKey: string, newTag: string) => {
    const currentExtra = historia.extra_catalogos || {}
    const list = currentExtra[catKey] || []
    if (!list.includes(newTag)) {
      const updatedList = [...list, newTag]
      onUpdateHistoria({
        extra_catalogos: {
          ...currentExtra,
          [catKey]: updatedList
        }
      })
    }
  }

  // Ref y efecto para auto-crecimiento del textarea de observaciones fijas
  const obsRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (obsRef.current) {
      obsRef.current.style.height = 'auto'
      obsRef.current.style.height = `${Math.min(Math.max(obsRef.current.scrollHeight, 26), 140)}px`
    }
  }, [historia.observaciones_permanentes])

  return (
    <div className="bg-white border-b border-[#dde6ec] shadow-sm z-30 flex-shrink-0 text-[#16323f]">
      {/* Barra superior con título y estado de guardado */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#eef3f6] bg-[#f7fafb]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black tracking-wide text-[#0e7c86] flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#0e7c86]" />
            HISTORIA CLÍNICA OFTALMOLÓGICA
          </span>
          {paciente.geclisa_ficha_id && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
              Ficha Geclisa #{paciente.geclisa_ficha_id}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-medium text-[#728a99] flex items-center gap-1.5">
            {guardando ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Guardando...</span>
              </>
            ) : ultimoGuardado ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-[#1a7f4b]" />
                <span className="text-[#1a7f4b]">Guardado {ultimoGuardado}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Grid de 2 bloques horizontales optimizados */}
      <div className="p-2 space-y-2 text-xs">
        {/* BLOQUE 1: DATOS DEL PACIENTE (2 FILAS HORIZONTALES) */}
        <div className="bg-[#fafcfd] border border-[#e4ecf0] rounded-lg p-2 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-[#728a99] flex items-center gap-1">
              <User className="w-3 h-3 text-[#0e7c86]" />
              Datos del Paciente
            </span>
          </div>

          {/* Fila 1 Biometría y Filiación */}
          <div className="grid grid-cols-12 gap-1.5 items-end">
            <div className="col-span-12 sm:col-span-4 lg:col-span-3">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">Nombre y Apellido</label>
              <input
                type="text"
                value={paciente.nombre || ''}
                onChange={e => onUpdatePaciente({ nombre: e.target.value })}
                className="w-full font-black text-xs text-[#16323f] border border-[#dde6ec] rounded px-2 py-1 bg-white focus:border-[#0e7c86] outline-none"
                placeholder="Nombre completo"
              />
            </div>
            <div className="col-span-6 sm:col-span-2 lg:col-span-2">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">DNI</label>
              <input
                type="text"
                value={paciente.dni || ''}
                onChange={e => onUpdatePaciente({ dni: e.target.value })}
                className="w-full font-semibold border border-[#dde6ec] rounded px-2 py-1 bg-white focus:border-[#0e7c86] outline-none text-xs"
              />
            </div>
            <div className="col-span-6 sm:col-span-2 lg:col-span-2">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">Nacimiento</label>
              <input
                type="date"
                value={paciente.fecha_nacimiento || ''}
                onChange={e => onUpdatePaciente({ fecha_nacimiento: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1.5 py-1 text-xs bg-white focus:border-[#0e7c86] outline-none"
              />
            </div>
            <div className="col-span-4 sm:col-span-1 lg:col-span-1">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5 text-center">Edad</label>
              <input
                type="text"
                value={edadCalculada || '—'}
                readOnly
                className="w-full border border-[#c3e2e4] rounded px-1 py-1 bg-[#e4f3f4] text-[#0e7c86] font-extrabold text-center text-xs outline-none cursor-default"
              />
            </div>
            <div className="col-span-3 sm:col-span-1 lg:col-span-1">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5 text-center">Sexo</label>
              <select
                value={paciente.sexo || ''}
                onChange={e => onUpdatePaciente({ sexo: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1 py-1 focus:border-[#0e7c86] outline-none bg-white text-center font-bold text-xs cursor-pointer"
              >
                <option value=""></option>
                <option value="F">F</option>
                <option value="M">M</option>
                <option value="X">X</option>
              </select>
            </div>
            <div className="col-span-5 sm:col-span-2 lg:col-span-3">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">Teléfono / Celular</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={paciente.telefono || ''}
                  onChange={e => onUpdatePaciente({ telefono: e.target.value })}
                  className="w-full font-semibold border border-[#dde6ec] rounded px-2 py-1 bg-white focus:border-[#0e7c86] outline-none text-xs"
                  placeholder="Teléfono"
                />
              </div>
            </div>
          </div>

          {/* Fila 2 Cobertura Médica y N° Afiliado */}
          <div className="grid grid-cols-12 gap-1.5 items-end pt-1 border-t border-[#edf3f6]">
            <div className="col-span-12 sm:col-span-4 lg:col-span-4">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">Obra Social / Prepaga</label>
              <input
                type="text"
                value={paciente.obra_social || ''}
                onChange={e => onUpdatePaciente({ obra_social: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-2 py-0.5 text-xs bg-white focus:border-[#0e7c86] outline-none"
                placeholder="Ej. SWISS MEDICAL, OSDE..."
              />
            </div>
            <div className="col-span-6 sm:col-span-3 lg:col-span-3">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">Plan</label>
              <input
                type="text"
                value={paciente.plan_cobertura || ''}
                onChange={e => onUpdatePaciente({ plan_cobertura: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-2 py-0.5 text-xs bg-white focus:border-[#0e7c86] outline-none"
                placeholder="Plan"
              />
            </div>
            <div className="col-span-6 sm:col-span-5 lg:col-span-5">
              <label className="text-[8.5px] uppercase font-bold text-[#8ba0ae] block mb-0.5">N° de Afiliado / Dirección</label>
              <input
                type="text"
                value={paciente.direccion || ''}
                onChange={e => onUpdatePaciente({ direccion: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-2 py-0.5 text-xs bg-white focus:border-[#0e7c86] outline-none"
                placeholder="Credencial / N° de afiliado"
              />
            </div>
          </div>
        </div>

        {/* BLOQUE 2: DATOS RELEVANTES Y FACTORES DE RIESGO (FILAS 1, 2 Y OBSERVACIONES CON AUTO-RESIZE) */}
        <div className="bg-[#f7fafb] border border-[#dde6ec] rounded-lg p-2 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-[#728a99] flex items-center gap-1">
              <HeartPulse className="w-3 h-3 text-[#0e7c86]" />
              Datos Relevantes y Factores de Riesgo
            </span>
          </div>

          {/* Fila 1: Antecedentes Oculares, Generales y Alergias */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-4">
              <span className="text-[8.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Antecedentes Oculares</span>
              <TagSelectorPopover
                catKey="antOc"
                values={historia.antecedentes_oculares || []}
                onChange={tags => onUpdateHistoria({ antecedentes_oculares: tags })}
                placeholder="agregar antecedentes oculares"
                label="Antecedentes Oculares"
                extraItems={historia.extra_catalogos?.['antOc'] || []}
                onAddExtra={tag => handleAddExtraTag('antOc', tag)}
              />
            </div>

            <div className="md:col-span-4">
              <span className="text-[8.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Antec. Generales</span>
              <TagSelectorPopover
                catKey="antGr"
                values={historia.antecedentes_generales || []}
                onChange={tags => onUpdateHistoria({ antecedentes_generales: tags })}
                placeholder="agregar generales"
                label="Antecedentes Generales"
                extraItems={historia.extra_catalogos?.['antGr'] || []}
                onAddExtra={tag => handleAddExtraTag('antGr', tag)}
              />
            </div>

            <div className="md:col-span-4">
              <span className="text-[8.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Alergias</span>
              <input
                type="text"
                placeholder="—"
                value={historia.alergias || ''}
                onChange={e => onUpdateHistoria({ alergias: e.target.value })}
                className={`w-full border rounded px-2 py-0.5 text-xs bg-white focus:border-[#0e7c86] outline-none font-bold ${
                  historia.alergias?.trim()
                    ? 'border-amber-400 bg-amber-50/60 text-amber-900 ring-1 ring-amber-300'
                    : 'border-[#dde6ec] text-[#16323f]'
                }`}
              />
            </div>
          </div>

          {/* Fila 2: Medicación Habitual + Otra Medicación */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <div className="md:col-span-6">
              <span className="text-[8.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Medicación Habitual (Riesgo / Gotas)</span>
              <TagSelectorPopover
                catKey="medic"
                values={historia.medicacion_habitual || []}
                onChange={tags => onUpdateHistoria({ medicacion_habitual: tags })}
                placeholder="medicación de riesgo / gotas"
                label="Medicación"
                extraItems={historia.extra_catalogos?.['medic'] || []}
                onAddExtra={tag => handleAddExtraTag('medic', tag)}
              />
            </div>
            <div className="md:col-span-6">
              <span className="text-[8.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Dosis, Horario u Otra Medicación</span>
              <input
                type="text"
                placeholder="dosis, horario, fármacos no listados..."
                value={historia.medicacion_otra || ''}
                onChange={e => onUpdateHistoria({ medicacion_otra: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-2 py-0.5 text-xs bg-white focus:border-[#0e7c86] outline-none"
              />
            </div>
          </div>

          {/* Fila 3: Observaciones Fijas con Auto-expansión dinámica multilínea */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8.5px] uppercase font-extrabold text-[#728a99]">
                Observaciones Fijas (Texto permanente que se amplía al escribir multilíneas)
              </span>
              {historia.observaciones_permanentes && (
                <span className="text-[9px] text-[#0e7c86] font-semibold">
                  {historia.observaciones_permanentes.split('\n').length} línea(s)
                </span>
              )}
            </div>
            <textarea
              ref={obsRef}
              rows={1}
              placeholder="texto libre permanente de la historia clínica (se amplía automáticamente a medida que escribes)..."
              value={historia.observaciones_permanentes || ''}
              onChange={e => onUpdateHistoria({ observaciones_permanentes: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs bg-white focus:border-[#0e7c86] outline-none transition-all duration-150 leading-relaxed resize-y overflow-y-auto"
              style={{ minHeight: '28px', maxHeight: '140px' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
