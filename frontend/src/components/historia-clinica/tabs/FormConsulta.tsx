'use client'

import React, { useMemo, useState } from 'react'
import { ConsultaOftalmo, RecetaAnteojos } from '../types'
import TagSelectorPopover from '../TagSelectorPopover'
import { 
  MOTIVOS, 
  USO_LENTES, 
  CATARATA, 
  CONDUCTAS 
} from '../catalogos'
import { MessageSquare, Video, Sparkles, Glasses, Copy, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface FormConsultaProps {
  consulta: ConsultaOftalmo
  onChange: (fields: Partial<ConsultaOftalmo>) => void
  onOpenResumenWA: () => void
  onOpenVideosWA: (esp?: boolean) => void
  onGenerarRecetaAnteojos?: (receta: Omit<RecetaAnteojos, 'id' | 'paciente_id'>) => Promise<void>
}

export default function FormConsulta({
  consulta,
  onChange,
  onOpenResumenWA,
  onOpenVideosWA,
  onGenerarRecetaAnteojos
}: FormConsultaProps) {
  const [generandoReceta, setGenerandoReceta] = useState(false)
  const [recetaGeneradaOk, setRecetaGeneradaOk] = useState(false)

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

  const modoSo = consulta.superficie_ocular?.modo || 'ao'
  const modoBmc = consulta.biomicroscopia?.modo || 'ao'
  const modoFo = consulta.fondo_ojo?.modo || 'ao'
  const modoPlan = consulta.conducta?.modo_plan || 'ao'

  const toggleDual = (section: 'so' | 'bmc' | 'fo' | 'plan') => {
    if (section === 'so') {
      const nuevo = modoSo === 'ao' ? 'sep' : 'ao'
      updateNested('superficie_ocular', 'modo', nuevo)
    } else if (section === 'bmc') {
      const nuevo = modoBmc === 'ao' ? 'sep' : 'ao'
      updateNested('biomicroscopia', 'modo', nuevo)
    } else if (section === 'fo') {
      const nuevo = modoFo === 'ao' ? 'sep' : 'ao'
      updateNested('fondo_ojo', 'modo', nuevo)
    } else if (section === 'plan') {
      const nuevo = modoPlan === 'ao' ? 'sep' : 'ao'
      updateNested('conducta', 'modo_plan', nuevo)
    }
  }

  // Duplicar Refracción OD -> OI
  const handleCopiarOdAOi = () => {
    const od = consulta.refraccion?.od || {}
    onChange({
      refraccion: {
        od: {
          esf: od.esf || '',
          cil: od.cil || '',
          eje: od.eje || '',
          add: od.add || ''
        },
        oi: {
          esf: od.esf || '',
          cil: od.cil || '',
          eje: od.eje || '',
          add: od.add || ''
        }
      }
    })
  }

  // Sincronización automática de Adición OD -> OI si OI está vacío o sincronizado
  const handleUpdateAddOd = (val: string) => {
    const prevOd = consulta.refraccion?.od || {}
    const prevOi = consulta.refraccion?.oi || {}
    const debeSincronizarOi = !prevOi.add || prevOi.add === prevOd.add
    onChange({
      refraccion: {
        od: { ...prevOd, add: val },
        oi: debeSincronizarOi ? { ...prevOi, add: val } : prevOi
      }
    })
  }

  // Prescripción Óptica 1-Clic
  const handleGenerarReceta1Clic = async () => {
    if (!onGenerarRecetaAnteojos) return
    const od = consulta.refraccion?.od || {}
    const oi = consulta.refraccion?.oi || {}

    const calcCercaEsf = (esfStr?: string, addStr?: string) => {
      const e = parseFloat(String(esfStr || '').replace(',', '.'))
      const a = parseFloat(String(addStr || '').replace(',', '.'))
      if (isNaN(e) && isNaN(a)) return ''
      const total = (isNaN(e) ? 0 : e) + (isNaN(a) ? 0 : a)
      return total > 0 ? `+${total.toFixed(2)}` : total.toFixed(2)
    }

    const tieneAdd = !!(od.add?.trim() || oi.add?.trim())
    const cercaOdEsf = calcCercaEsf(od.esf, od.add)
    const cercaOiEsf = calcCercaEsf(oi.esf, oi.add)

    let tipoCristal = 'Monofocales'
    if (tieneAdd) {
      if (consulta.lentes_anteriores?.tipo?.toLowerCase().includes('bifocal')) {
        tipoCristal = 'Bifocales'
      } else {
        tipoCristal = 'Multifocales / progresivos'
      }
    } else if (consulta.lentes_anteriores?.tipo) {
      tipoCristal = consulta.lentes_anteriores.tipo
    }

    const obsArray: string[] = []
    if (consulta.lentes_anteriores?.tipo) {
      obsArray.push(`Uso previo: ${consulta.lentes_anteriores.tipo}`)
    }
    if (consulta.estabilidad_refractiva) {
      obsArray.push(`Estabilidad: ${consulta.estabilidad_refractiva}`)
    }
    const observaciones = obsArray.join('. ')

    const payload: Omit<RecetaAnteojos, 'id' | 'paciente_id'> = {
      consulta_id: consulta.id,
      fecha: consulta.fecha || new Date().toISOString().slice(0, 10),
      tipo_lente: tipoCristal,
      tipo_cristal: tipoCristal,
      od_esfera: od.esf || '',
      od_cilindro: od.cil || '',
      od_eje: od.eje || '',
      od_adicion: od.add || '',
      oi_esfera: oi.esf || '',
      oi_cilindro: oi.cil || '',
      oi_eje: oi.eje || '',
      oi_adicion: oi.add || '',
      observaciones,
      indicaciones_optico: observaciones,
      lejos: {
        od: { esf: od.esf || '', cil: od.cil || '', eje: od.eje || '', dnp: '' },
        oi: { esf: oi.esf || '', cil: oi.cil || '', eje: oi.eje || '', dnp: '' }
      },
      cerca: {
        od: { esf: tieneAdd ? cercaOdEsf : '', cil: tieneAdd ? (od.cil || '') : '', eje: tieneAdd ? (od.eje || '') : '', dnp: '' },
        oi: { esf: tieneAdd ? cercaOiEsf : '', cil: tieneAdd ? (oi.cil || '') : '', eje: tieneAdd ? (oi.eje || '') : '', dnp: '' }
      }
    }

    try {
      setGenerandoReceta(true)
      await onGenerarRecetaAnteojos(payload)
      setRecetaGeneradaOk(true)
      setTimeout(() => setRecetaGeneradaOk(false), 4000)
    } finally {
      setGenerandoReceta(false)
    }
  }

  // Macro Examen Normal AO (1-Clic)
  const handleCargarExamenNormalAO = () => {
    onChange({
      superficie_ocular: {
        ...(consulta.superficie_ocular || {}),
        modo: 'ao',
        od: { but: '10', tin: 'Negativa', mei: 'Normal y clara' },
        oi: { but: '10', tin: 'Negativa', mei: 'Normal y clara' },
        blef: 'No',
        demodex: 'No',
        frota: 'No'
      },
      biomicroscopia: {
        ...(consulta.biomicroscopia || {}),
        modo: 'ao',
        od: 'Córnea transparente, cámara anterior profunda, libre de Tyndall y Flare, iris regular, cristalino transparente, pupila reactiva.',
        oi: 'Córnea transparente, cámara anterior profunda, libre de Tyndall y Flare, iris regular, cristalino transparente, pupila reactiva.',
        cat_od: 'Transparente',
        cat_oi: 'Transparente',
        dilata: 'Buena'
      },
      fondo_ojo: {
        ...(consulta.fondo_ojo || {}),
        modo: 'ao',
        od: 'Papila de bordes netos, coloración rosada fisiológica, excavación 0.3, mácula con brillo foveal conservado, retina aplicada, vasos de calibre y trayecto normales.',
        oi: 'Papila de bordes netos, coloración rosada fisiológica, excavación 0.3, mácula con brillo foveal conservado, retina aplicada, vasos de calibre y trayecto normales.'
      }
    })
  }

  // Presets Agudeza Visual
  const handleSetAvPresetLejos = (valor: string) => {
    const curAv = consulta.agudeza_visual || {}
    onChange({
      agudeza_visual: {
        ...curAv,
        od: { ...(curAv.od || {}), sc: valor },
        oi: { ...(curAv.oi || {}), sc: valor },
        ao: { ...(curAv.ao || {}), sc: valor }
      }
    })
  }

  const handleSetAvPresetCerca = (valor: string) => {
    const curAv = consulta.agudeza_visual || {}
    onChange({
      agudeza_visual: {
        ...curAv,
        cerca_od: { ...((curAv as any).cerca_od || {}), sc: valor },
        cerca_oi: { ...((curAv as any).cerca_oi || {}), sc: valor },
        cerca_ao: { ...((curAv as any).cerca_ao || {}), sc: valor }
      }
    })
  }

  // Helper alerta PIO
  const isHighPio = (val?: string) => {
    if (!val) return false
    const num = parseFloat(String(val).replace(',', '.'))
    return !isNaN(num) && num >= 21
  }

  const hayPioElevada = 
    isHighPio(consulta.presion_intraocular?.od?.aire) ||
    isHighPio(consulta.presion_intraocular?.od?.apl) ||
    isHighPio(consulta.presion_intraocular?.oi?.aire) ||
    isHighPio(consulta.presion_intraocular?.oi?.apl)

  return (
    <div className="space-y-3 text-[#16323f]">
      {/* 1. Datos de la consulta */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#eef3f6]">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
            Consulta Médica
          </h2>
          <span className="text-[10px] text-[#728a99]">
            Los datos personales y antecedentes quedan fijos en la cabecera superior
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
          <div className="md:col-span-4">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Motivo de consulta</label>
            <select
              value={consulta.motivo_consulta || ''}
              onChange={e => onChange({ motivo_consulta: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white focus:border-[#0e7c86] outline-none"
            >
              <option value="">Seleccione motivo...</option>
              {MOTIVOS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Evaluada por</label>
            <input
              type="text"
              placeholder="quién atiende hoy"
              value={consulta.profesional_nombre || ''}
              onChange={e => onChange({ profesional_nombre: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 focus:border-[#0e7c86] outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Derivado por</label>
            <input
              type="text"
              value={consulta.derivado_por || ''}
              onChange={e => onChange({ derivado_por: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 focus:border-[#0e7c86] outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Ocupación / hobbies</label>
            <input
              type="text"
              placeholder="deportes, computación..."
              value={consulta.ocupacion || ''}
              onChange={e => onChange({ ocupacion: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 focus:border-[#0e7c86] outline-none"
            />
          </div>
          <div className="md:col-span-12">
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Observaciones de la consulta</label>
            <textarea
              rows={1}
              value={consulta.observaciones_consulta || ''}
              onChange={e => onChange({ observaciones_consulta: e.target.value })}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
            />
          </div>
        </div>
      </div>

      {/* Grid de 2 columnas para AV y Refracción */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Agudeza Visual */}
        <div className="lg:col-span-5 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1.5 mb-2 border-b border-[#eef3f6]">
            Agudeza Visual
          </h2>

          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9.5px] uppercase font-extrabold text-[#728a99]">Visión de Lejos</span>
                <div className="flex items-center gap-1">
                  <span className="text-[8.5px] uppercase font-bold text-[#9db0bc]">Chips AO:</span>
                  {['20/20', '20/25', '20/30', '20/40', 'CF', 'MM'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSetAvPresetLejos(val)}
                      className="px-1 py-0.2 text-[9px] font-bold bg-[#f0f4f7] hover:bg-[#e4f3f4] text-[#16323f] hover:text-[#0e7c86] rounded border border-[#dde6ec] transition-colors"
                      title={`Fijar ${val} en OD, OI y AO`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-[#f7fafb] text-[9px] uppercase text-[#728a99] font-bold">
                    <th className="p-1 w-8"></th>
                    <th className="p-1">AVSC</th>
                    <th className="p-1">AVCC</th>
                    <th className="p-1">Estenop.</th>
                    <th className="p-1">AVCSC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f6]">
                  {(['od', 'oi', 'ao'] as const).map(eye => (
                    <tr key={eye}>
                      <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                      {(['sc', 'cc', 'est', 'csc'] as const).map(fld => (
                        <td key={fld} className="p-0.5">
                          <input
                            type="text"
                            value={consulta.agudeza_visual?.[eye]?.[fld] || ''}
                            onChange={e => {
                              const av = consulta.agudeza_visual || {}
                              const curEye = av[eye] || {}
                              onChange({
                                agudeza_visual: {
                                  ...av,
                                  [eye]: { ...curEye, [fld]: e.target.value }
                                }
                              })
                            }}
                            className="w-full border border-[#dde6ec] rounded py-0.5 px-1 text-center font-semibold text-xs focus:border-[#0e7c86] outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9.5px] uppercase font-extrabold text-[#728a99]">Visión de Cerca</span>
                <div className="flex items-center gap-1">
                  <span className="text-[8.5px] uppercase font-bold text-[#9db0bc]">Chips AO:</span>
                  {['J1', 'J2', 'J3', '1.0'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSetAvPresetCerca(val)}
                      className="px-1 py-0.2 text-[9px] font-bold bg-[#f0f4f7] hover:bg-[#e4f3f4] text-[#16323f] hover:text-[#0e7c86] rounded border border-[#dde6ec] transition-colors"
                      title={`Fijar ${val} en OD, OI y AO cerca`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-[#f7fafb] text-[9px] uppercase text-[#728a99] font-bold">
                    <th className="p-1 w-8"></th>
                    <th className="p-1">SC</th>
                    <th className="p-1">C/ Lejos</th>
                    <th className="p-1">C/ Cerca</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f6]">
                  {(['cerca_od', 'cerca_oi', 'cerca_ao'] as const).map(eyeKey => {
                    const eyeLabel = eyeKey.replace('cerca_', '').toUpperCase()
                    return (
                      <tr key={eyeKey}>
                        <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eyeLabel}</td>
                        {(['sc', 'cl', 'cc'] as const).map(fld => (
                          <td key={fld} className="p-0.5">
                            <input
                              type="text"
                              value={(consulta.agudeza_visual as any)?.[eyeKey]?.[fld] || ''}
                              onChange={e => {
                                const av = consulta.agudeza_visual || {}
                                const curEye = (av as any)[eyeKey] || {}
                                onChange({
                                  agudeza_visual: {
                                    ...av,
                                    [eyeKey]: { ...curEye, [fld]: e.target.value }
                                  }
                                })
                              }}
                              className="w-full border border-[#dde6ec] rounded py-0.5 px-1 text-center font-semibold text-xs focus:border-[#0e7c86] outline-none"
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Refracción Subjetiva y Lentes Anteriores */}
        <div className="lg:col-span-7 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#eef3f6]">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
                Refracción Subjetiva
              </h2>
              <button
                type="button"
                onClick={handleCopiarOdAOi}
                className="text-[10px] text-[#0e7c86] hover:text-[#095f67] font-bold flex items-center gap-1 bg-[#e4f3f4] hover:bg-[#c3e2e4] px-2 py-0.5 rounded transition-colors"
                title="Copiar datos refractivos de Ojo Derecho a Ojo Izquierdo"
              >
                <Copy className="w-3 h-3" />
                Copiar OD ➔ OI
              </button>
            </div>
            <span className="text-[10px] font-bold text-[#0e7c86] bg-[#e4f3f4] px-2 py-0.5 rounded border border-[#c3e2e4]">
              EE se calcula solo
            </span>
          </div>

          <table className="w-full border-collapse text-center text-xs mb-2">
            <thead>
              <tr className="bg-[#f7fafb] text-[9px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-8"></th>
                <th className="p-1">Esfera</th>
                <th className="p-1">Cilindro</th>
                <th className="p-1">Eje</th>
                <th className="p-1">EE</th>
                <th className="p-1">Adición</th>
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
                        className="w-full border border-[#dde6ec] rounded py-1 px-1 text-center font-bold text-xs focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curRx.cil || ''}
                        onChange={e => updateEyeNested('refraccion', eye, 'cil', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-1 px-1 text-center font-bold text-xs focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curRx.eje || ''}
                        onChange={e => updateEyeNested('refraccion', eye, 'eje', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-1 px-1 text-center font-bold text-xs focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curEE || ''}
                        readOnly
                        className="w-full border border-[#c3e2e4] bg-[#e4f3f4] text-[#0e7c86] rounded py-1 px-1 text-center font-extrabold text-xs cursor-default outline-none"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={curRx.add || ''}
                        onChange={e => {
                          if (eye === 'od') {
                            handleUpdateAddOd(e.target.value)
                          } else {
                            updateEyeNested('refraccion', eye, 'add', e.target.value)
                          }
                        }}
                        className="w-full border border-[#dde6ec] rounded py-1 px-1 text-center font-bold text-xs focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Botón Prescripción Óptica 1-Clic */}
          <div className="flex items-center justify-between mb-3 pt-2 border-t border-[#eef3f6]">
            <button
              type="button"
              onClick={handleGenerarReceta1Clic}
              disabled={generandoReceta || (!rxOd.esf && !rxOi.esf && !rxOd.cil && !rxOi.cil)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${
                recetaGeneradaOk
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0e7c86] hover:bg-[#095f67] text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
              title="Genera la receta de anteojos calculando cerca automáticamente e imprime de inmediato sin salir de esta pestaña"
            >
              {recetaGeneradaOk ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ¡Receta Generada e Impresa!
                </>
              ) : (
                <>
                  <Glasses className="w-3.5 h-3.5" />
                  {generandoReceta ? 'Generando receta...' : 'Generar e Imprimir Receta de Anteojos (1-Clic)'}
                </>
              )}
            </button>
            <span className="text-[10px] text-[#728a99]">
              {rxOd.add || rxOi.add ? 'Auto-cálculo: Multifocal / Cerca' : 'Monofocales Lejos'}
            </span>
          </div>

          {/* Lentes anteriores y Estabilidad */}
          <div className="pt-2 border-t border-[#eef3f6]">
            <div className="text-[9.5px] uppercase font-extrabold text-[#728a99] mb-1">
              Lentes Anteriores y Estabilidad
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Tipo de lentes</label>
                <select
                  value={consulta.lentes_anteriores?.tipo || ''}
                  onChange={e => updateNested('lentes_anteriores', 'tipo', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs"
                >
                  <option value=""></option>
                  <option>Monofocales</option>
                  <option>Multifocales / progresivos</option>
                  <option>Bifocales</option>
                  <option>Ocupacionales</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Cuánto los usa</label>
                <select
                  value={consulta.lentes_anteriores?.uso || ''}
                  onChange={e => updateNested('lentes_anteriores', 'uso', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 bg-white text-xs"
                >
                  <option value=""></option>
                  {USO_LENTES.map(u => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Estabilidad refractiva</label>
                <select
                  value={consulta.estabilidad_refractiva || ''}
                  onChange={e => onChange({ estabilidad_refractiva: e.target.value })}
                  className={`w-full border rounded px-2 py-1 font-bold text-xs bg-white ${
                    consulta.estabilidad_refractiva?.includes('Estable')
                      ? 'bg-[#e6f5ec] text-[#1a7f4b] border-[#1a7f4b]'
                      : consulta.estabilidad_refractiva?.includes('Progresión') || consulta.estabilidad_refractiva?.includes('Cambio')
                      ? 'bg-[#fdf1e7] text-[#b4531a] border-[#b4531a]'
                      : 'border-[#dde6ec]'
                  }`}
                >
                  <option value=""></option>
                  <option>Estable (&lt;0.50 D en 12 meses)</option>
                  <option>Cambio 0.50–1.00 D</option>
                  <option>Progresión &gt;1.00 D</option>
                  <option>Sin datos previos</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de mediciones: ARM, Queratometría, PIO */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
        {/* ARM y Cicloplejia */}
        <div className="md:col-span-5 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider pb-1 mb-2 border-b border-[#eef3f6]">
            ARM y Cicloplejia
          </h2>
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-[#f7fafb] text-[9px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-7"></th>
                <th colSpan={3} className="p-1 border-b border-[#eef3f6] text-[#0e7c86]">ARM</th>
                <th colSpan={3} className="p-1 border-b border-[#eef3f6]">Con Cicloplejia</th>
              </tr>
              <tr className="text-[8.5px] uppercase text-[#9db0bc] font-extrabold">
                <th></th>
                <th>Esf</th><th>Cil</th><th>Eje</th>
                <th>Esf</th><th>Cil</th><th>Eje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {(['od', 'oi'] as const).map(eye => (
                <tr key={eye}>
                  <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                  {(['esf', 'cil', 'eje'] as const).map(c => (
                    <td key={`arm_${c}`} className="p-0.5">
                      <input
                        type="text"
                        value={consulta.arm_cicloplejia?.[`arm_${eye}_${c}`] || ''}
                        onChange={e => updateNested('arm_cicloplejia', `arm_${eye}_${c}`, e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                  ))}
                  {(['esf', 'cil', 'eje'] as const).map(c => (
                    <td key={`cic_${c}`} className="p-0.5">
                      <input
                        type="text"
                        value={consulta.arm_cicloplejia?.[`cic_${eye}_${c}`] || ''}
                        onChange={e => updateNested('arm_cicloplejia', `cic_${eye}_${c}`, e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={qEye.k2 || ''}
                        onChange={e => updateEyeNested('queratometria', eye, 'k2', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={qEye.ejec || ''}
                        onChange={e => updateEyeNested('queratometria', eye, 'ejec', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none"
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
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none"
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
                const aireElevada = isHighPio(pioEye.aire)
                const aplElevada = isHighPio(pioEye.apl)
                return (
                  <tr key={eye}>
                    <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{eye.toUpperCase()}</td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={pioEye.aire || ''}
                        onChange={e => updateEyeNested('presion_intraocular', eye, 'aire', e.target.value)}
                        className={`w-full border rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none ${
                          aireElevada
                            ? 'bg-red-50 text-red-700 border-red-400 ring-1 ring-red-400 font-black'
                            : 'border-[#dde6ec]'
                        }`}
                        title={aireElevada ? 'PIO Aire elevada (≥21 mmHg)' : ''}
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={pioEye.apl || ''}
                        onChange={e => updateEyeNested('presion_intraocular', eye, 'apl', e.target.value)}
                        className={`w-full border rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none ${
                          aplElevada
                            ? 'bg-red-50 text-red-700 border-red-400 ring-1 ring-red-400 font-black'
                            : 'border-[#dde6ec]'
                        }`}
                        title={aplElevada ? 'PIO Aplanación elevada (≥21 mmHg)' : ''}
                      />
                    </td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={pioEye.paq_aire || ''}
                        onChange={e => updateEyeNested('presion_intraocular', eye, 'paq_aire', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold focus:border-[#0e7c86] outline-none"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {hayPioElevada && (
            <div className="mt-1.5 p-1.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 font-bold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-red-600" />
              <span>PIO ≥ 21 mmHg detectada.</span>
            </div>
          )}
          <div className="mt-2">
            <input
              type="text"
              placeholder="tratamiento hipotensor..."
              value={consulta.presion_intraocular?.tto || ''}
              onChange={e => updateNested('presion_intraocular', 'tto', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-1.5 py-0.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Barra de Cabecera Examen Físico Ocular + Macro Normal AO */}
      <div className="bg-white border border-[#dde6ec] rounded-lg px-3 py-2 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
            Examen Físico Ocular
          </span>
          <span className="text-[10px] text-[#728a99] hidden sm:inline">
            Superficie Ocular, Biomicroscopía y Fondo de Ojo
          </span>
        </div>
        <button
          type="button"
          onClick={handleCargarExamenNormalAO}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition-all"
          title="Pre-carga automática de hallazgos fisiológicos normales bilaterales (AO)"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Cargar Examen Normal AO
        </button>
      </div>

      {/* Examen ocular: Superficie Ocular, Biomicroscopía, Fondo de Ojo */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
        {/* Superficie Ocular */}
        <div className="md:col-span-4 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#eef3f6]">
            <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
              Superficie Ocular
            </h2>
            <button
              type="button"
              onClick={() => toggleDual('so')}
              className="text-[10px] text-[#0e7c86] font-bold hover:underline"
            >
              {modoSo === 'ao' ? 'separar OD/OI' : 'unificar AO'}
            </button>
          </div>

          <table className="w-full border-collapse text-center mb-2">
            <thead>
              <tr className="bg-[#f7fafb] text-[8.5px] uppercase text-[#728a99] font-bold">
                <th className="p-1 w-8"></th>
                <th className="p-1">BUT (s)</th>
                <th className="p-1">Tinción</th>
                <th className="p-1">Meibomio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {(modoSo === 'ao' ? (['od'] as const) : (['od', 'oi'] as const)).map(eye => {
                const soEye = consulta.superficie_ocular?.[eye] || {}
                const label = modoSo === 'ao' ? 'AO' : eye.toUpperCase()
                return (
                  <tr key={eye}>
                    <td className="p-1 font-extrabold text-[#0e7c86] bg-[#f7fafb] rounded">{label}</td>
                    <td className="p-0.5">
                      <input
                        type="text"
                        value={soEye.but || ''}
                        onChange={e => updateEyeNested('superficie_ocular', eye, 'but', e.target.value)}
                        className="w-12 border border-[#dde6ec] rounded py-0.5 px-0.5 text-center text-xs font-semibold"
                      />
                    </td>
                    <td className="p-0.5">
                      <select
                        value={soEye.tin || ''}
                        onChange={e => updateEyeNested('superficie_ocular', eye, 'tin', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-1 bg-white text-xs"
                      >
                        <option value=""></option>
                        <option>Negativa</option>
                        <option>Punteado leve</option>
                        <option>Punteado moderado</option>
                        <option>Punteado severo</option>
                        <option>Confluente</option>
                        <option>Defecto epitelial</option>
                      </select>
                    </td>
                    <td className="p-0.5">
                      <select
                        value={soEye.mei || ''}
                        onChange={e => updateEyeNested('superficie_ocular', eye, 'mei', e.target.value)}
                        className="w-full border border-[#dde6ec] rounded py-0.5 px-1 bg-white text-xs"
                      >
                        <option value=""></option>
                        <option>Normal y clara</option>
                        <option>Turbia</option>
                        <option>Espesa o pastosa</option>
                        <option>En pasta de dientes</option>
                        <option>No expresible</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#eef3f6]">
            <div>
              <label className="text-[8.5px] uppercase font-bold text-[#728a99] block mb-0.5">Blefaritis</label>
              <select
                value={consulta.superficie_ocular?.blef || ''}
                onChange={e => updateNested('superficie_ocular', 'blef', e.target.value)}
                className="w-full border border-[#dde6ec] rounded px-1 py-0.5 bg-white text-xs"
              >
                <option value=""></option>
                <option>No</option>
                <option>Anterior</option>
                <option>Posterior / DGM</option>
                <option>Mixta</option>
              </select>
            </div>
            <div>
              <label className="text-[8.5px] uppercase font-bold text-[#728a99] block mb-0.5">Demodex</label>
              <select
                value={consulta.superficie_ocular?.demodex || ''}
                onChange={e => updateNested('superficie_ocular', 'demodex', e.target.value)}
                className="w-full border border-[#dde6ec] rounded px-1 py-0.5 bg-white text-xs"
              >
                <option value=""></option>
                <option>No</option>
                <option>Sí</option>
                <option>No evaluado</option>
              </select>
            </div>
            <div>
              <label className="text-[8.5px] uppercase font-bold text-[#728a99] block mb-0.5">Frota ojos</label>
              <select
                value={consulta.superficie_ocular?.frota || ''}
                onChange={e => updateNested('superficie_ocular', 'frota', e.target.value)}
                className="w-full border border-[#dde6ec] rounded px-1 py-0.5 bg-white text-xs"
              >
                <option value=""></option>
                <option>No</option>
                <option>Ocasional</option>
                <option>Sí, frecuente</option>
                <option>Sí, intenso</option>
              </select>
            </div>
          </div>
        </div>

        {/* Biomicroscopía (BMC) */}
        <div className="md:col-span-4 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#eef3f6]">
            <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
              Biomicroscopía
            </h2>
            <button
              type="button"
              onClick={() => toggleDual('bmc')}
              className="text-[10px] text-[#0e7c86] font-bold hover:underline"
            >
              {modoBmc === 'ao' ? 'separar OD/OI' : 'unificar AO'}
            </button>
          </div>

          {modoBmc === 'ao' ? (
            <div className="mb-2">
              <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Ambos Ojos (AO)</label>
              <textarea
                rows={2}
                value={consulta.biomicroscopia?.od || ''}
                onChange={e => {
                  updateNested('biomicroscopia', 'od', e.target.value)
                  updateNested('biomicroscopia', 'oi', e.target.value)
                }}
                className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-2">
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

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#eef3f6]">
            <div>
              <label className="text-[8.5px] uppercase font-bold text-[#728a99] block mb-0.5">Catarata OD</label>
              <select
                value={consulta.biomicroscopia?.cat_od || ''}
                onChange={e => updateNested('biomicroscopia', 'cat_od', e.target.value)}
                className="w-full border border-[#dde6ec] rounded px-1 py-0.5 bg-white text-xs"
              >
                <option value=""></option>
                {CATARATA.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[8.5px] uppercase font-bold text-[#728a99] block mb-0.5">Catarata OI</label>
              <select
                value={consulta.biomicroscopia?.cat_oi || ''}
                onChange={e => updateNested('biomicroscopia', 'cat_oi', e.target.value)}
                className="w-full border border-[#dde6ec] rounded px-1 py-0.5 bg-white text-xs"
              >
                <option value=""></option>
                {CATARATA.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[8.5px] uppercase font-bold text-[#728a99] block mb-0.5">Dilatación</label>
              <select
                value={consulta.biomicroscopia?.dilata || ''}
                onChange={e => updateNested('biomicroscopia', 'dilata', e.target.value)}
                className="w-full border border-[#dde6ec] rounded px-1 py-0.5 bg-white text-xs"
              >
                <option value=""></option>
                <option>Buena</option>
                <option>Pobre / riesgo IFIS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Fondo de Ojo (FO) */}
        <div className="md:col-span-4 bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#eef3f6]">
            <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
              Fondo de Ojo
            </h2>
            <button
              type="button"
              onClick={() => toggleDual('fo')}
              className="text-[10px] text-[#0e7c86] font-bold hover:underline"
            >
              {modoFo === 'ao' ? 'separar OD/OI' : 'unificar AO'}
            </button>
          </div>

          {modoFo === 'ao' ? (
            <div>
              <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Ambos Ojos (AO)</label>
              <textarea
                rows={3}
                value={consulta.fondo_ojo?.od || ''}
                onChange={e => {
                  updateNested('fondo_ojo', 'od', e.target.value)
                  updateNested('fondo_ojo', 'oi', e.target.value)
                }}
                className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">OD</label>
                <textarea
                  rows={3}
                  value={consulta.fondo_ojo?.od || ''}
                  onChange={e => updateNested('fondo_ojo', 'od', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">OI</label>
                <textarea
                  rows={3}
                  value={consulta.fondo_ojo?.oi || ''}
                  onChange={e => updateNested('fondo_ojo', 'oi', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Conducta, Plan, Comunicación al Paciente y Asesoramiento */}
      <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-xs">
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#eef3f6]">
          <h2 className="text-xs font-black uppercase text-[#0e7c86] tracking-wider">
            Conducta Médica y Quirúrgica
          </h2>
          <button
            type="button"
            onClick={() => toggleDual('plan')}
            className="text-[10px] text-[#0e7c86] font-bold hover:underline"
          >
            {modoPlan === 'ao' ? 'separar conducta OD/OI' : 'unificar conducta AO'}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">
              Diagnóstico Presuntivo
            </label>
            <input
              type="text"
              placeholder="si lo dejás vacío usa los antecedentes oculares"
              value={consulta.conducta?.dx_presuntivo || ''}
              onChange={e => updateNested('conducta', 'dx_presuntivo', e.target.value)}
              className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none font-semibold text-[#16323f]"
            />
          </div>

          {modoPlan === 'ao' ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold px-2 py-1 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
                AO
              </span>
              <div className="flex-1">
                <select
                  value={consulta.conducta?.plan_cx || ''}
                  onChange={e => updateNested('conducta', 'plan_cx', e.target.value)}
                  className="w-full border border-[#dde6ec] rounded px-2 py-1.5 bg-white text-xs font-bold text-[#0e7c86]"
                >
                  <option value="">Seleccione conducta...</option>
                  {CONDUCTAS.map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-1 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
                  OD
                </span>
                <select
                  value={consulta.conducta?.plan_cx || ''}
                  onChange={e => updateNested('conducta', 'plan_cx', e.target.value)}
                  className="flex-1 border border-[#dde6ec] rounded px-2 py-1.5 bg-white text-xs font-bold text-[#0e7c86]"
                >
                  <option value="">Conducta Ojo Derecho...</option>
                  {CONDUCTAS.map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-1 rounded bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4]">
                  OI
                </span>
                <select
                  value={consulta.conducta?.plan_cx2 || ''}
                  onChange={e => updateNested('conducta', 'plan_cx2', e.target.value)}
                  className="flex-1 border border-[#dde6ec] rounded px-2 py-1.5 bg-white text-xs font-bold text-[#0e7c86]"
                >
                  <option value="">Conducta Ojo Izquierdo...</option>
                  {CONDUCTAS.map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">
              Explico al Paciente (genera el texto informado para WhatsApp y consentimiento)
            </label>
            <TagSelectorPopover
              catKey="explico"
              values={consulta.conducta?.explico || []}
              onChange={tags => updateNested('conducta', 'explico', tags)}
              placeholder="agregar temas conversados con el paciente..."
              label="Temas conversados"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-8">
              <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Indicaciones</label>
              <textarea
                rows={2}
                placeholder="Olopatadina + lubricación. Explico NO FROTAR."
                value={consulta.indicaciones_texto || ''}
                onChange={e => onChange({ indicaciones_texto: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none resize-y"
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-[9px] uppercase font-bold text-[#728a99] block mb-0.5">Próximo control</label>
              <input
                type="text"
                placeholder="en 6 meses, tras el CXL..."
                value={consulta.proximo_control || ''}
                onChange={e => onChange({ proximo_control: e.target.value })}
                className="w-full border border-[#dde6ec] rounded px-2 py-1 text-xs focus:border-[#0e7c86] outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="w-3 h-3 text-[#0e7c86]" />
              <label className="text-[9px] uppercase font-extrabold text-[#0e7c86]">
                Para Asesoramiento Comercial Pasar Valores De
              </label>
            </div>
            <TagSelectorPopover
              catKey="valores"
              values={consulta.conducta?.valores_pasar || []}
              onChange={tags => updateNested('conducta', 'valores_pasar', tags)}
              placeholder="seleccionar opciones para cotización en asesoría..."
              label="Valores a pasar"
            />
          </div>

          <div className="pt-2 border-t border-[#eef3f6] flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[#728a99] mr-1">
              Enviar al paciente:
            </span>
            <button
              type="button"
              onClick={onOpenResumenWA}
              className="px-3 py-1.5 bg-[#0e7c86] text-white rounded text-xs font-bold hover:bg-[#0a636b] flex items-center gap-1.5 shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Resumen de la consulta por WhatsApp
            </button>
            <button
              type="button"
              onClick={() => onOpenVideosWA(false)}
              className="px-3 py-1.5 bg-white border border-[#dde6ec] rounded text-xs font-bold hover:bg-[#e4f3f4] text-[#16323f] flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5 text-[#0e7c86]" />
              Enviar video explicativo
            </button>
            <button
              type="button"
              onClick={() => onOpenVideosWA(true)}
              className="px-3 py-1.5 bg-white border border-[#dde6ec] rounded text-xs font-bold hover:bg-[#e4f3f4] text-[#16323f] flex items-center gap-1.5"
            >
              Casos especiales
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

