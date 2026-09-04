'use client'

import React, { useMemo } from 'react'
import { User, Shield, AlertCircle, Phone, Calendar, CheckCircle } from 'lucide-react'
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

  return (
    <div className="bg-white border-b border-[#dde6ec] shadow-sm z-30 flex-shrink-0 text-[#16323f]">
      {/* Barra superior con título y estado de guardado */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#eef3f6] bg-[#f7fafb]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-wide text-[#0e7c86]">
            HISTORIA CLÍNICA OFTALMOLÓGICA
          </span>
          {paciente.geclisa_ficha_id && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
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

      {/* Cuerpo del Header: 2 Columnas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#eef3f6]">
        {/* Columna Izquierda: Datos filiatorios (4 cols) */}
        <div className="lg:col-span-4 p-3 bg-white space-y-2">
          <div className="text-[8.5px] uppercase tracking-wider font-extrabold text-[#9db0bc]">
            Datos del Paciente
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Nombre y Apellido</label>
              <input
                type="text"
                value={paciente.nombre || ''}
                onChange={e => onUpdatePaciente({ nombre: e.target.value })}
                className="w-full font-black text-sm text-[#16323f] border border-[#dde6ec] rounded px-2 py-1 bg-white focus:border-[#0e7c86] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">DNI</label>
              <input
                type="text"
                value={paciente.dni || ''}
                onChange={e => onUpdatePaciente({ dni: e.target.value })}
                className="w-full font-semibold border border-[#dde6ec] rounded px-2 py-1 bg-white focus:border-[#0e7c86] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Teléfono</label>
              <input
                type="text"
                value={paciente.telefono || ''}
                onChange={e => onUpdatePaciente({ telefono: e.target.value })}
                className="w-full font-semibold border border-[#dde6ec] rounded px-2 py-1 bg-white focus:border-[#0e7c86] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Nacimiento</label>
              <input
                type="date"
                value={paciente.fecha_nacimiento || ''}
                onChange={e => onUpdatePaciente({ fecha_nacimiento: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1.5 py-1 text-xs bg-white focus:border-[#0e7c86] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Edad</label>
              <input
                type="text"
                value={edadCalculada || '—'}
                readOnly
                className="w-full border border-[#c3e2e4] rounded px-1.5 py-1 bg-[#e4f3f4] text-[#0e7c86] font-bold text-center outline-none cursor-default"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Sexo</label>
              <select
                value={paciente.sexo || ''}
                onChange={e => onUpdatePaciente({ sexo: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1 py-1 focus:border-[#0e7c86] outline-none bg-white text-center font-semibold cursor-pointer"
              >
                <option value=""></option>
                <option value="F">F</option>
                <option value="M">M</option>
                <option value="X">X</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Celular</label>
              <input
                type="text"
                placeholder="para videos"
                value={paciente.telefono || ''}
                onChange={e => onUpdatePaciente({ telefono: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1.5 py-1 focus:border-[#0e7c86] outline-none text-[11px]"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Obra Social</label>
              <input
                type="text"
                value={paciente.obra_social || ''}
                onChange={e => onUpdatePaciente({ obra_social: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1.5 py-1 focus:border-[#0e7c86] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">Plan</label>
              <input
                type="text"
                value={paciente.plan_cobertura || ''}
                onChange={e => onUpdatePaciente({ plan_cobertura: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1.5 py-1 focus:border-[#0e7c86] outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[9px] uppercase font-bold text-[#9db0bc] block mb-0.5">N° de Afiliado</label>
              <input
                type="text"
                value={paciente.direccion || ''}
                onChange={e => onUpdatePaciente({ direccion: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-1.5 py-1 focus:border-[#0e7c86] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Columna Derecha: Antecedentes Relevantes y Medicación */}
        <div className="lg:col-span-7 p-2.5 bg-[#f7fafb] space-y-2">
          <div className="text-[9px] uppercase tracking-wider font-extrabold text-[#9db0bc]">
            Datos Relevantes y Factores de Riesgo
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {/* Antecedentes oculares */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9.5px] uppercase font-extrabold text-[#728a99]">Antecedentes Oculares</span>
              </div>
              <TagSelectorPopover
                catKey="antOc"
                values={historia.antecedentes_oculares || []}
                onChange={tags => onUpdateHistoria({ antecedentes_oculares: tags })}
                placeholder="agregar antecedentes"
                label="Antecedentes Oculares"
                extraItems={historia.extra_catalogos?.['antOc'] || []}
                onAddExtra={tag => handleAddExtraTag('antOc', tag)}
              />
            </div>

            {/* Antecedentes generales */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9.5px] uppercase font-extrabold text-[#728a99]">Antec. Generales</span>
              </div>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
            {/* Medicación */}
            <div className="md:col-span-8">
              <span className="text-[9.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Medicación Habitual</span>
              <TagSelectorPopover
                catKey="medic"
                values={historia.medicacion_habitual || []}
                onChange={tags => onUpdateHistoria({ medicacion_habitual: tags })}
                placeholder="medicación de riesgo / gotas"
                label="Medicación"
                extraItems={historia.extra_catalogos?.['medic'] || []}
                onAddExtra={tag => handleAddExtraTag('medic', tag)}
              />
              <input
                type="text"
                placeholder="otra medicación, dosis, horario..."
                value={historia.medicacion_otra || ''}
                onChange={e => onUpdateHistoria({ medicacion_otra: e.target.value })}
                className="w-full mt-1 border border-[#dde6ec] rounded px-2 py-0.5 text-xs bg-white focus:border-[#0e7c86] outline-none"
              />
            </div>

            {/* Alergias */}
            <div className="md:col-span-4">
              <span className="text-[9.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Alergias</span>
              <input
                type="text"
                placeholder="—"
                value={historia.alergias || ''}
                onChange={e => onUpdateHistoria({ alergias: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs bg-white focus:border-[#0e7c86] outline-none font-semibold text-[#b4531a]"
              />
            </div>
          </div>

          {/* Observaciones permanentes */}
          <div>
            <span className="text-[9.5px] uppercase font-extrabold text-[#728a99] block mb-0.5">Observaciones Fijas</span>
            <textarea
              rows={1}
              placeholder="texto libre permanente de la historia clínica..."
              value={historia.observaciones_permanentes || ''}
              onChange={e => onUpdateHistoria({ observaciones_permanentes: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs bg-white focus:border-[#0e7c86] outline-none resize-y"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
