'use client'

import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  User,
  Shield,
  AlertCircle,
  Phone,
  Calendar,
  CheckCircle,
  HeartPulse,
  Eye,
  Edit3,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  CreditCard
} from 'lucide-react'
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
  const [modalEditarFiliacion, setModalEditarFiliacion] = useState(false)
  const [expandirObservaciones, setExpandirObservaciones] = useState(false)

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
    return edad >= 0 && edad < 125 ? `${edad}a` : ''
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
      obsRef.current.style.height = `${Math.min(Math.max(obsRef.current.scrollHeight, 26), 110)}px`
    }
  }, [historia.observaciones_permanentes, expandirObservaciones])

  const tieneAlergias = !!historia.alergias?.trim()

  return (
    <div className="bg-white border-b border-[#dde6ec] shadow-sm z-30 flex-shrink-0 text-[#16323f]">
      {/* 1. RIBBON COMPACTO SUPERIOR (Filiación + Cobertura + Estado) */}
      <div className="px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#eef3f6] bg-[#f8fafc]">
        {/* Identidad del Paciente */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#0e7c86]/10 text-[#0e7c86] flex items-center justify-center font-black text-xs flex-shrink-0">
            {paciente.sexo || <User className="w-4 h-4" />}
          </div>
          <div className="flex items-baseline gap-2 truncate">
            <h1 className="font-black text-sm text-[#16323f] tracking-tight truncate">
              {paciente.nombre || 'Paciente Sin Nombre'}
            </h1>
            <span className="text-xs font-bold text-[#0e7c86] bg-[#e4f3f4] px-1.5 py-0.5 rounded border border-[#c3e2e4]">
              {edadCalculada ? `${edadCalculada}` : '—'} {paciente.sexo ? `(${paciente.sexo})` : ''}
            </span>
            <span className="text-xs text-[#526b7a] font-medium hidden sm:inline">
              DNI: <strong className="text-[#16323f] font-bold">{paciente.dni || '—'}</strong>
            </span>
          </div>

          {paciente.geclisa_ficha_id && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4] flex items-center gap-1" title="Ficha en sistema de escritorio Geclisa">
              <Eye className="w-3 h-3" />
              Ficha #{paciente.geclisa_ficha_id}
            </span>
          )}

          <button
            type="button"
            onClick={() => setModalEditarFiliacion(true)}
            className="text-[11px] font-bold text-[#0e7c86] hover:text-[#095f67] hover:bg-[#e4f3f4] px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1"
            title="Editar datos demográficos y de cobertura"
          >
            <Edit3 className="w-3 h-3" />
            <span className="hidden md:inline">Editar Filiación</span>
          </button>
        </div>

        {/* Cobertura + Teléfono + Guardado */}
        <div className="flex items-center gap-3 text-xs">
          {/* Obra Social y Plan */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#526b7a]">
            <Shield className="w-3.5 h-3.5 text-[#0e7c86]" />
            <span className="font-bold text-[#16323f]">{paciente.obra_social || 'Particular'}</span>
            {paciente.plan_cobertura && (
              <span className="text-[11px] bg-white border border-[#dde6ec] px-1 rounded font-semibold text-[#728a99]">
                {paciente.plan_cobertura}
              </span>
            )}
            {paciente.nro_afiliado && (
              <span className="text-[11px] text-[#728a99]" title="Número de afiliado / credencial">
                (Af: {paciente.nro_afiliado})
              </span>
            )}
          </div>

          {/* Teléfono */}
          {paciente.telefono && (
            <div className="hidden md:flex items-center gap-1 text-xs text-[#526b7a]">
              <Phone className="w-3 h-3 text-[#1a7f4b]" />
              <span className="font-semibold">{paciente.telefono}</span>
            </div>
          )}

          {/* Estado de Guardado */}
          <div className="text-[11px] font-medium text-[#728a99] flex items-center gap-1.5">
            {guardando ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-600 font-semibold">Guardando...</span>
              </>
            ) : ultimoGuardado ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-[#1a7f4b]" />
                <span className="text-[#1a7f4b] font-semibold">Guardado {ultimoGuardado}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FACTORES DE RIESGO CLÍNICOS Y OBSERVACIONES FIJAS */}
      <div className="px-3 py-1.5 bg-[#fbfcfd] space-y-1.5 text-xs">
        <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap">
          {/* Alergias Destacadas (Prioridad Máxima de Seguridad) */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
            tieneAlergias
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-white border-[#dde6ec] text-[#526b7a]'
          }`}>
            <span className="text-[9px] uppercase font-black tracking-wider flex items-center gap-1 text-red-600">
              <AlertTriangle className="w-3 h-3" />
              Alergias:
            </span>
            <input
              type="text"
              placeholder="sin alergias conocidas"
              value={historia.alergias || ''}
              onChange={e => onUpdateHistoria({ alergias: e.target.value })}
              className={`bg-transparent outline-none font-bold text-xs w-28 sm:w-36 ${
                tieneAlergias ? 'text-red-900 font-black' : 'text-[#728a99]'
              }`}
            />
          </div>

          {/* Antecedentes Oculares */}
          <div className="flex-1 min-w-[200px]">
            <TagSelectorPopover
              catKey="antOc"
              values={historia.antecedentes_oculares || []}
              onChange={tags => onUpdateHistoria({ antecedentes_oculares: tags })}
              placeholder="antecedentes oculares..."
              label="Antec. Oculares"
              extraItems={historia.extra_catalogos?.['antOc'] || []}
              onAddExtra={tag => handleAddExtraTag('antOc', tag)}
            />
          </div>

          {/* Antecedentes Generales */}
          <div className="flex-1 min-w-[190px]">
            <TagSelectorPopover
              catKey="antGr"
              values={historia.antecedentes_generales || []}
              onChange={tags => onUpdateHistoria({ antecedentes_generales: tags })}
              placeholder="antec. generales..."
              label="Antec. Generales"
              extraItems={historia.extra_catalogos?.['antGr'] || []}
              onAddExtra={tag => handleAddExtraTag('antGr', tag)}
            />
          </div>

          {/* Medicación Habitual */}
          <div className="flex-1 min-w-[200px]">
            <TagSelectorPopover
              catKey="medic"
              values={historia.medicacion_habitual || []}
              onChange={tags => onUpdateHistoria({ medicacion_habitual: tags })}
              placeholder="gotas / medicación..."
              label="Medicación"
              extraItems={historia.extra_catalogos?.['medic'] || []}
              onAddExtra={tag => handleAddExtraTag('medic', tag)}
            />
          </div>

          {/* Botón toggle observaciones permanentes */}
          <button
            type="button"
            onClick={() => setExpandirObservaciones(!expandirObservaciones)}
            className="text-[10px] font-bold text-[#0e7c86] hover:bg-[#e4f3f4] px-2 py-1 rounded border border-[#c3e2e4] flex items-center gap-1 transition-colors flex-shrink-0"
            title="Ver o editar observaciones permanentes de la historia clínica"
          >
            <span>Obs. Fijas</span>
            {expandirObservaciones ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Observaciones Fijas (Desplegable o con contenido) */}
        {(expandirObservaciones || !!historia.observaciones_permanentes?.trim()) && (
          <div className="pt-1 border-t border-[#eef3f6]">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8.5px] uppercase font-bold text-[#728a99]">
                Observaciones Clínicas Permanentes (historial previo, notas de cuidado continuo):
              </span>
            </div>
            <textarea
              ref={obsRef}
              rows={1}
              placeholder="texto libre permanente de la historia clínica..."
              value={historia.observaciones_permanentes || ''}
              onChange={e => onUpdateHistoria({ observaciones_permanentes: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs bg-white focus:border-[#0e7c86] outline-none transition-all duration-150 leading-relaxed resize-y overflow-y-auto"
              style={{ minHeight: '26px', maxHeight: '100px' }}
            />
          </div>
        )}
      </div>

      {/* MODAL POPOVER PARA EDITAR FILIACIÓN Y COBERTURA (Bajo demanda) */}
      {modalEditarFiliacion && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#dde6ec] w-full max-w-2xl overflow-hidden text-[#16323f]">
            {/* Cabecera Modal */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#f7fafb] border-b border-[#eef3f6]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0e7c86]" />
                <h2 className="font-extrabold text-sm text-[#16323f]">
                  Editar Datos Filiatorios y Cobertura
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarFiliacion(false)}
                className="text-[#9db0bc] hover:text-[#16323f] p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Nombre y Apellido</label>
                  <input
                    type="text"
                    value={paciente.nombre || ''}
                    onChange={e => onUpdatePaciente({ nombre: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2.5 py-1.5 font-bold text-xs focus:border-[#0e7c86] outline-none"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">DNI</label>
                  <input
                    type="text"
                    value={paciente.dni || ''}
                    onChange={e => onUpdatePaciente({ dni: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2.5 py-1.5 font-bold text-xs focus:border-[#0e7c86] outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Fecha Nacimiento</label>
                  <input
                    type="date"
                    value={paciente.fecha_nacimiento || ''}
                    onChange={e => onUpdatePaciente({ fecha_nacimiento: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2 py-1.5 text-xs focus:border-[#0e7c86] outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5 text-center">Sexo</label>
                  <select
                    value={paciente.sexo || ''}
                    onChange={e => onUpdatePaciente({ sexo: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-1.5 py-1.5 text-center font-bold text-xs bg-white focus:border-[#0e7c86] outline-none cursor-pointer"
                  >
                    <option value=""></option>
                    <option value="F">F</option>
                    <option value="M">M</option>
                    <option value="X">X</option>
                  </select>
                </div>
                <div className="sm:col-span-6">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Teléfono / Celular WhatsApp</label>
                  <input
                    type="text"
                    value={paciente.telefono || ''}
                    onChange={e => onUpdatePaciente({ telefono: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2.5 py-1.5 text-xs font-semibold focus:border-[#0e7c86] outline-none"
                    placeholder="ej. 5492614703230"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Obra Social / Prepaga</label>
                  <input
                    type="text"
                    value={paciente.obra_social || ''}
                    onChange={e => onUpdatePaciente({ obra_social: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2.5 py-1.5 text-xs font-semibold focus:border-[#0e7c86] outline-none"
                    placeholder="OSDE, SWISS MEDICAL..."
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Plan</label>
                  <input
                    type="text"
                    value={paciente.plan_cobertura || ''}
                    onChange={e => onUpdatePaciente({ plan_cobertura: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2.5 py-1.5 text-xs focus:border-[#0e7c86] outline-none"
                    placeholder="210, Obligatorio..."
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">N° Afiliado / Credencial</label>
                  <input
                    type="text"
                    value={paciente.nro_afiliado || ''}
                    onChange={e => onUpdatePaciente({ nro_afiliado: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2.5 py-1.5 text-xs font-semibold focus:border-[#0e7c86] outline-none"
                    placeholder="N° credencial"
                  />
                </div>

                <div className="sm:col-span-12">
                  <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Domicilio / Dirección</label>
                  <input
                    type="text"
                    value={paciente.direccion || ''}
                    onChange={e => onUpdatePaciente({ direccion: e.target.value })}
                    className="w-full border border-[#dde6ec] rounded px-2.5 py-1.5 text-xs focus:border-[#0e7c86] outline-none"
                    placeholder="Calle, número, localidad..."
                  />
                </div>
              </div>
            </div>

            {/* Pie Modal */}
            <div className="px-4 py-2.5 bg-[#f7fafb] border-t border-[#eef3f6] flex justify-end">
              <button
                type="button"
                onClick={() => setModalEditarFiliacion(false)}
                className="px-4 py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white rounded-lg text-xs font-bold transition-colors"
              >
                Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
