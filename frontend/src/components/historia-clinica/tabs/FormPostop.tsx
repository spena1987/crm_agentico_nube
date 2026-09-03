'use client'

import React, { useMemo } from 'react'
import { ConsultaOftalmo } from '../types'
import TagSelectorPopover from '../TagSelectorPopover'
import { CIRUGIAS } from '../catalogos'
import { Video } from 'lucide-react'

interface FormPostopProps {
  consulta: ConsultaOftalmo
  onChange: (fields: Partial<ConsultaOftalmo>) => void
  onOpenVideosWA: (esp?: boolean) => void
}

export default function FormPostop({
  consulta,
  onChange,
  onOpenVideosWA
}: FormPostopProps) {
  const updateNested = (parentKey: keyof ConsultaOftalmo, subKey: string, val: any) => {
    const parentObj = (consulta[parentKey] as Record<string, any>) || {}
    onChange({
      [parentKey]: {
        ...parentObj,
        [subKey]: val
      }
    })
  }

  const updateEyeNested = (parentKey: keyof ConsultaOftalmo, eye: 'od' | 'oi', subKey: string, val: any) => {
    const parentObj = (consulta[parentKey] as Record<string, any>) || {}
    const eyeObj = (parentObj[eye] as Record<string, any>) || {}
    onChange({
      [parentKey]: {
        ...parentObj,
        [eye]: {
          ...eyeObj,
          [subKey]: val
        }
      }
    })
  }

  // Cálculo automático de días de postoperatorio
  const diasPostopCalc = useMemo(() => {
    const fechaCx = consulta.datos_postop?.fecha_cx
    const fechaVisita = consulta.fecha
    if (!fechaCx || !fechaVisita) return ''
    try {
      const fCx = new Date(fechaCx)
      const fV = new Date(fechaVisita)
      const diff = Math.round((fV.getTime() - fCx.getTime()) / 86400000)
      if (isNaN(diff)) return ''
      if (diff === 0) return 'el mismo día'
      if (diff === 1) return '1 día'
      if (diff < 0) return 'cirugía posterior (revisar)'
      if (diff < 30) return `${diff} días`
      if (diff < 365) return `${diff} días (${(diff / 30.44).toFixed(1)} meses)`
      return `${diff} días (${(diff / 365.25).toFixed(1)} años)`
    } catch {
      return ''
    }
  }, [consulta.datos_postop?.fecha_cx, consulta.fecha])

  const rxOd = consulta.refraccion?.od || {}
  const rxOi = consulta.refraccion?.oi || {}

  const calcEE = (esfStr?: string, cilStr?: string) => {
    const e = parseFloat(String(esfStr || '').replace(',', '.'))
    const c = parseFloat(String(cilStr || '').replace(',', '.'))
    if (isNaN(e) && isNaN(c)) return ''
    return ((isNaN(e) ? 0 : e) + (isNaN(c) ? 0 : c) / 2).toFixed(2)
  }

  const eeOd = useMemo(() => calcEE(rxOd.esf, rxOd.cil), [rxOd.esf, rxOd.cil])
  const eeOi = useMemo(() => calcEE(rxOi.esf, rxOi.cil), [rxOi.esf, rxOi.cil])

  const modoBmc = consulta.biomicroscopia?.modo || 'ao'
  const modoFo = consulta.fondo_ojo?.modo || 'ao'

  return (
    <div className="space-y-3 text-[#16323f]">
      {/* 1. Header de Postoperatorio */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#eef3f6]">
          <h2 className="text-xs font-black uppercase text-[#1a7f4b] tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1a7f4b]" />
            Control Postoperatorio
          </h2>
          <span className="text-[10px] font-bold text-[#1a7f4b] bg-[#e6f5ec] px-2 py-0.5 rounded border border-[#b8e5cb]">
            {diasPostopCalc ? `Postop: ${diasPostopCalc}` : 'Postop'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Fecha de la cirugía</label>
            <input
              type="date"
              value={consulta.datos_postop?.fecha_cx ? consulta.datos_postop.fecha_cx.slice(0, 10) : ''}
              onChange={e => updateNested('datos_postop', 'fecha_cx', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Postoperatorio</label>
            <input
              type="text"
              readOnly
              value={diasPostopCalc}
              className="w-full border border-[#b8e5cb] bg-[#e6f5ec] text-[#1a7f4b] font-bold rounded px-2 py-1 text-xs outline-none cursor-default"
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Cirugía realizada</label>
            <select
              value={consulta.datos_postop?.cx_realizada || ''}
              onChange={e => updateNested('datos_postop', 'cx_realizada', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs font-bold text-[#0e7c86]"
            >
              <option value="">Seleccione cirugía...</option>
              {CIRUGIAS.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Ojo</label>
            <select
              value={consulta.datos_postop?.ojo || 'OD'}
              onChange={e => updateNested('datos_postop', 'ojo', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-1 py-1 bg-white text-xs font-bold text-center"
            >
              <option>OD</option>
              <option>OI</option>
              <option>AO</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Cirujano/a</label>
            <input
              type="text"
              value={consulta.datos_postop?.cirujano || ''}
              onChange={e => updateNested('datos_postop', 'cirujano', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Evaluada por</label>
            <input
              type="text"
              placeholder="quién controla hoy"
              value={consulta.profesional_nombre || ''}
              onChange={e => onChange({ profesional_nombre: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Grid de 3 columnas: AV, Refracción, ARM */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
        {/* Agudeza Visual Postop */}
        <div className="md:col-span-4 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-2 border-b border-[#eef3f6]">
            Agudeza Visual
          </h2>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#f7fafb] text-[9px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-8"></th>
                <th className="p-1">AVSC</th>
                <th className="p-1">AVCC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {(['od', 'oi', 'ao'] as const).map(eye => (
                <tr key={eye}>
                  <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      list="dlLejos"
                      value={consulta.agudeza_visual?.[eye]?.sc || ''}
                      onChange={e => {
                        const av = consulta.agudeza_visual || {}
                        const curEye = av[eye] || {}
                        onChange({
                          agudeza_visual: { ...av, [eye]: { ...curEye, sc: e.target.value } }
                        })
                      }}
                      className="w-full border border-[#dde6ec] rounded py-0.5 px-1 text-center font-bold text-xs"
                    />
                  </td>
                  <td className="p-0.5">
                    <input
                      type="text"
                      list="dlLejos"
                      value={consulta.agudeza_visual?.[eye]?.cc || ''}
                      onChange={e => {
                        const av = consulta.agudeza_visual || {}
                        const curEye = av[eye] || {}
                        onChange({
                          agudeza_visual: { ...av, [eye]: { ...curEye, cc: e.target.value } }
                        })
                      }}
                      className="w-full border border-[#dde6ec] rounded py-0.5 px-1 text-center font-bold text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Refracción Subjetiva Postop */}
        <div className="md:col-span-5 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#eef3f6]">
            <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
              Refracción Subjetiva
            </h2>
            <span className="text-[10px] font-bold text-[#0e7c86] bg-[#e4f3f4] px-1.5 py-0.2 rounded">
              EE auto
            </span>
          </div>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#f7fafb] text-[9px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-8"></th>
                <th className="p-1">Esf</th>
                <th className="p-1">Cil</th>
                <th className="p-1">Eje</th>
                <th className="p-1">EE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {(['od', 'oi'] as const).map(eye => {
                const curRx = eye === 'od' ? rxOd : rxOi
                const curEE = eye === 'od' ? eeOd : eeOi
                return (
                  <tr key={eye}>
                    <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curRx.esf || ''}
                        onChange={e => updateEyeNested('refraccion', eye, 'esf', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-1 text-center font-bold text-xs"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curRx.cil || ''}
                        onChange={e => updateEyeNested('refraccion', eye, 'cil', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-1 text-center font-bold text-xs"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curRx.eje || ''}
                        onChange={e => updateEyeNested('refraccion', eye, 'eje', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-1 text-center font-bold text-xs"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curEE || ''}
                        readOnly
                        className="w-full border border-[#c3e2e4] bg-[#e4f3f4] text-[#0e7c86] rounded py-0.5 px-1 text-center font-extrabold text-xs cursor-default"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ARM Postop */}
        <div className="md:col-span-3 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-2 border-b border-[#eef3f6]">
            ARM
          </h2>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#f7fafb] text-[9px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-8"></th>
                <th className="p-1">Esf</th>
                <th className="p-1">Cil</th>
                <th className="p-1">Eje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {(['od', 'oi'] as const).map(eye => (
                <tr key={eye}>
                  <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                  {(['esf', 'cil', 'eje'] as const).map(c => (
                    <td key={c} className="p-0.5">
                      <input
                        type="text"
                        value={consulta.arm_cicloplejia?.[`arm_${eye}_${c}`] || ''}
                        onChange={e => updateNested('arm_cicloplejia', `arm_${eye}_${c}`, e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Queratometría, PIO y Complicaciones */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
        {/* Queratometría */}
        <div className="md:col-span-4 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-2 border-b border-[#eef3f6]">
            Queratometría
          </h2>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#f7fafb] text-[8.5px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-7"></th>
                <th className="p-1">K1</th>
                <th className="p-1">K2</th>
                <th className="p-1">Eje c.</th>
                <th className="p-1">Cil</th>
                <th className="p-1">Eje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {(['od', 'oi'] as const).map(eye => {
                const qEye = consulta.queratometria?.[eye] || {}
                return (
                  <tr key={eye}>
                    <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={qEye.k1 || ''}
                        onChange={e => updateEyeNested('queratometria', eye, 'k1', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={qEye.k2 || ''}
                        onChange={e => updateEyeNested('queratometria', eye, 'k2', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={qEye.ejec || ''}
                        onChange={e => updateEyeNested('queratometria', eye, 'ejec', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={qEye.cil || ''}
                        readOnly
                        className="w-full border border-[#c3e2e4] bg-[#e4f3f4] text-[#0e7c86] rounded py-0.5 px-0.5 text-center text-xs font-bold"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={qEye.eje || ''}
                        onChange={e => updateEyeNested('queratometria', eye, 'eje', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* PIO y Paquimetría */}
        <div className="md:col-span-3 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-2 border-b border-[#eef3f6]">
            PIO y Paquimetría
          </h2>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#f7fafb] text-[8.5px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-7"></th>
                <th className="p-1">Aire</th>
                <th className="p-1">Aplan.</th>
                <th className="p-1">Paq.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {(['od', 'oi'] as const).map(eye => {
                const pioEye = consulta.presion_intraocular?.[eye] || {}
                return (
                  <tr key={eye}>
                    <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={pioEye.aire || ''}
                        onChange={e => updateEyeNested('presion_intraocular', eye, 'aire', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={pioEye.apl || ''}
                        onChange={e => updateEyeNested('presion_intraocular', eye, 'apl', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={pioEye.paq_aire || ''}
                        onChange={e => updateEyeNested('presion_intraocular', eye, 'paq_aire', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Complicaciones */}
        <div className="md:col-span-5 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-2 border-b border-[#eef3f6]">
            Complicaciones
          </h2>
          <TagSelectorPopover
            catKey="complic"
            values={consulta.datos_postop?.complicaciones || []}
            onChange={tags => updateNested('datos_postop', 'complicaciones', tags)}
            placeholder="Ninguna marcada — clic para agregar..."
            label="Complicaciones"
          />
          <div className="mt-2">
            <input
              type="text"
              placeholder="Detalle o conducta tomada..."
              value={consulta.datos_postop?.complic_detalle || ''}
              onChange={e => updateNested('datos_postop', 'complic_detalle', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Biomicroscopía y Fondo de Ojo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* BMC */}
        <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#eef3f6]">
            <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
              Biomicroscopía
            </h2>
            <button
              type="button"
              onClick={() => updateNested('biomicroscopia', 'modo', modoBmc === 'ao' ? 'sep' : 'ao')}
              className="text-[10px] text-[#0e7c86] font-bold hover:underline"
            >
              {modoBmc === 'ao' ? 'separar OD/OI' : 'unificar AO'}
            </button>
          </div>
          {modoBmc === 'ao' ? (
            <textarea
              rows={2}
              value={consulta.biomicroscopia?.od || ''}
              onChange={e => {
                updateNested('biomicroscopia', 'od', e.target.value)
                updateNested('biomicroscopia', 'oi', e.target.value)
              }}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">OD</label>
                <textarea
                  rows={2}
                  value={consulta.biomicroscopia?.od || ''}
                  onChange={e => updateNested('biomicroscopia', 'od', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">OI</label>
                <textarea
                  rows={2}
                  value={consulta.biomicroscopia?.oi || ''}
                  onChange={e => updateNested('biomicroscopia', 'oi', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
                />
              </div>
            </div>
          )}
        </div>

        {/* FO */}
        <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#eef3f6]">
            <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
              Fondo de Ojo
            </h2>
            <button
              type="button"
              onClick={() => updateNested('fondo_ojo', 'modo', modoFo === 'ao' ? 'sep' : 'ao')}
              className="text-[10px] text-[#0e7c86] font-bold hover:underline"
            >
              {modoFo === 'ao' ? 'separar OD/OI' : 'unificar AO'}
            </button>
          </div>
          {modoFo === 'ao' ? (
            <textarea
              rows={2}
              value={consulta.fondo_ojo?.od || ''}
              onChange={e => {
                updateNested('fondo_ojo', 'od', e.target.value)
                updateNested('fondo_ojo', 'oi', e.target.value)
              }}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">OD</label>
                <textarea
                  rows={2}
                  value={consulta.fondo_ojo?.od || ''}
                  onChange={e => updateNested('fondo_ojo', 'od', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">OI</label>
                <textarea
                  rows={2}
                  value={consulta.fondo_ojo?.oi || ''}
                  onChange={e => updateNested('fondo_ojo', 'oi', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Satisfacción, Evolución y Medicación de Alta */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs space-y-3">
        <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-2 border-b border-[#eef3f6]">
          Satisfacción, Evolución e Indicaciones
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Satisfacción</label>
            <select
              value={consulta.datos_postop?.satisfaccion || ''}
              onChange={e => updateNested('datos_postop', 'satisfaccion', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs"
            >
              <option value=""></option>
              <option>Muy satisfecho</option>
              <option>Satisfecho</option>
              <option>Neutral</option>
              <option>Insatisfecho</option>
              <option>Muy insatisfecho</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Síntomas</label>
            <select
              value={consulta.datos_postop?.sintomas || ''}
              onChange={e => updateNested('datos_postop', 'sintomas', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs"
            >
              <option value=""></option>
              <option>Sin síntomas</option>
              <option>Halos / glare</option>
              <option>Ojo seco</option>
              <option>Fluctuación visual</option>
              <option>Dolor / molestia</option>
              <option>Visión borrosa</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Evolución</label>
            <select
              value={consulta.datos_postop?.evolucion || ''}
              onChange={e => updateNested('datos_postop', 'evolucion', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs font-semibold"
            >
              <option value=""></option>
              <option>Favorable</option>
              <option>Lenta pero favorable</option>
              <option>Estacionaria</option>
              <option>Desfavorable</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Medicación Indicada (esquema y descenso)</label>
          <textarea
            rows={2}
            value={consulta.indicaciones_texto || ''}
            onChange={e => onChange({ indicaciones_texto: e.target.value })}
            className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-8">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Notas internas</label>
            <input
              type="text"
              value={consulta.notas_internas || ''}
              onChange={e => onChange({ notas_internas: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Próximo control</label>
            <input
              type="text"
              placeholder="en 1 semana..."
              value={consulta.proximo_control || ''}
              onChange={e => onChange({ proximo_control: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => onOpenVideosWA(false)}
              className="w-full py-1.5 px-2 bg-[#0e7c86] text-white rounded text-xs font-bold hover:bg-[#0a636b] flex items-center justify-center gap-1"
            >
              <Video className="w-3.5 h-3.5" />
              Enviar video
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

