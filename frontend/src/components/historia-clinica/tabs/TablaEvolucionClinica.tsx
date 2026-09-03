'use client'

import React from 'react'
import { ConsultaOftalmo } from '../types'
import { Printer, ArrowLeft } from 'lucide-react'

export type TipoEvolucion = 'rx' | 'k' | 'pio' | 'bmc' | 'fo' | 'conducta'

interface TablaEvolucionClinicaProps {
  tipo: TipoEvolucion
  consultas: ConsultaOftalmo[]
  consultaActivaId?: string
  onSelectConsulta: (id: string) => void
  onVolver: () => void
  onImprimir: () => void
}

export default function TablaEvolucionClinica({
  tipo,
  consultas,
  consultaActivaId,
  onSelectConsulta,
  onVolver,
  onImprimir
}: TablaEvolucionClinicaProps) {
  const sorted = [...consultas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

  const rxLine = (c: ConsultaOftalmo, eye: 'od' | 'oi') => {
    const rx = c.refraccion?.[eye]
    if (!rx || (!rx.esf && !rx.cil)) return '—'
    const parts = [
      rx.esf || '',
      rx.cil ? `${rx.cil}${rx.eje ? ` × ${rx.eje}°` : ''}` : '',
      rx.add ? `add ${rx.add}` : ''
    ].filter(Boolean)
    return parts.join(' ') || '—'
  }

  const conductaLine = (c: ConsultaOftalmo) => {
    if (c.tipo === 'postop') {
      return `Control postop — ${c.datos_postop?.cx_realizada || ''}`
    }
    const cond = c.conducta || {}
    if (cond.plan_cx2) {
      return `OD: ${cond.plan_cx || ''} · OI: ${cond.plan_cx2 || ''}`
    }
    return cond.plan_cx || '—'
  }

  return (
    <div className="bg-white border border-[#dde6ec] rounded-lg p-3 shadow-sm text-[#16323f]">
      {/* Barra superior de acciones */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#eef3f6]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVolver}
            className="px-2.5 py-1 text-xs font-bold text-[#0e7c86] bg-[#e4f3f4] hover:bg-[#c3e2e4] rounded flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la ficha
          </button>
          <h3 className="text-xs font-black uppercase tracking-wider text-[#16323f]">
            Evolución comparativa:{' '}
            {tipo === 'rx' && 'Refracción y Agudeza Visual'}
            {tipo === 'k' && 'Queratometrías'}
            {tipo === 'pio' && 'Presión Intraocular y Paquimetría'}
            {tipo === 'bmc' && 'Biomicroscopía y Catarata'}
            {tipo === 'fo' && 'Fondo de Ojo'}
            {tipo === 'conducta' && 'Conducta e Indicaciones'}
          </h3>
        </div>

        <button
          type="button"
          onClick={onImprimir}
          className="px-3 py-1 bg-white border border-[#dde6ec] hover:bg-[#f7fafb] text-xs font-bold rounded flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5 text-[#0e7c86]" />
          Imprimir esta evolución
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#728a99]">No hay consultas registradas para comparar.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#f7fafb] text-[#728a99] uppercase text-[9px] font-extrabold border-b border-[#dde6ec]">
                <th className="p-2 text-left">Fecha</th>
                {tipo === 'rx' && (
                  <>
                    <th className="p-2 text-center">AVSC OD</th>
                    <th className="p-2 text-center">AVCC OD</th>
                    <th className="p-2 text-left">Refracción OD</th>
                    <th className="p-2 text-center">AVSC OI</th>
                    <th className="p-2 text-center">AVCC OI</th>
                    <th className="p-2 text-left">Refracción OI</th>
                  </>
                )}
                {tipo === 'k' && (
                  <>
                    <th className="p-2 text-center">K1 OD</th>
                    <th className="p-2 text-center">K2 OD</th>
                    <th className="p-2 text-center">Eje curvo OD</th>
                    <th className="p-2 text-center">Cil OD</th>
                    <th className="p-2 text-center">K1 OI</th>
                    <th className="p-2 text-center">K2 OI</th>
                    <th className="p-2 text-center">Eje curvo OI</th>
                    <th className="p-2 text-center">Cil OI</th>
                  </>
                )}
                {tipo === 'pio' && (
                  <>
                    <th className="p-2 text-center">Aire OD</th>
                    <th className="p-2 text-center">Aplan. OD</th>
                    <th className="p-2 text-center">Paq. OD</th>
                    <th className="p-2 text-center">Aire OI</th>
                    <th className="p-2 text-center">Aplan. OI</th>
                    <th className="p-2 text-center">Paq. OI</th>
                  </>
                )}
                {tipo === 'bmc' && (
                  <>
                    <th className="p-2 text-left">OD</th>
                    <th className="p-2 text-left">OI</th>
                    <th className="p-2 text-center">Catarata OD</th>
                    <th className="p-2 text-center">Catarata OI</th>
                  </>
                )}
                {tipo === 'fo' && (
                  <>
                    <th className="p-2 text-left">OD</th>
                    <th className="p-2 text-left">OI</th>
                  </>
                )}
                {tipo === 'conducta' && (
                  <>
                    <th className="p-2 text-left">Conducta</th>
                    <th className="p-2 text-center">Ojo</th>
                    <th className="p-2 text-left">Indicaciones</th>
                    <th className="p-2 text-left">Próximo control</th>
                  </>
                )}
                <th className="p-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f6]">
              {sorted.map(c => {
                const isActive = c.id === consultaActivaId
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-[#f7fafb] transition-colors ${
                      isActive ? 'bg-[#e4f3f4]/60 font-semibold' : ''
                    }`}
                  >
                    <td className="p-2 font-bold whitespace-nowrap text-left">
                      {c.fecha ? c.fecha.slice(0, 10) : '—'}
                      {c.tipo === 'postop' && (
                        <span className="ml-1.5 text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#e6f5ec] text-[#1a7f4b]">
                          postop
                        </span>
                      )}
                    </td>

                    {tipo === 'rx' && (
                      <>
                        <td className="p-2 text-center">{c.agudeza_visual?.od?.sc || '—'}</td>
                        <td className="p-2 text-center">{c.agudeza_visual?.od?.cc || '—'}</td>
                        <td className="p-2 text-left font-mono">{rxLine(c, 'od')}</td>
                        <td className="p-2 text-center">{c.agudeza_visual?.oi?.sc || '—'}</td>
                        <td className="p-2 text-center">{c.agudeza_visual?.oi?.cc || '—'}</td>
                        <td className="p-2 text-left font-mono">{rxLine(c, 'oi')}</td>
                      </>
                    )}

                    {tipo === 'k' && (
                      <>
                        <td className="p-2 text-center">{c.queratometria?.od?.k1 || '—'}</td>
                        <td className="p-2 text-center">{c.queratometria?.od?.k2 || '—'}</td>
                        <td className="p-2 text-center">{c.queratometria?.od?.ejec || '—'}</td>
                        <td className="p-2 text-center font-bold text-[#0e7c86]">{c.queratometria?.od?.cil || '—'}</td>
                        <td className="p-2 text-center">{c.queratometria?.oi?.k1 || '—'}</td>
                        <td className="p-2 text-center">{c.queratometria?.oi?.k2 || '—'}</td>
                        <td className="p-2 text-center">{c.queratometria?.oi?.ejec || '—'}</td>
                        <td className="p-2 text-center font-bold text-[#0e7c86]">{c.queratometria?.oi?.cil || '—'}</td>
                      </>
                    )}

                    {tipo === 'pio' && (
                      <>
                        <td className="p-2 text-center">{c.presion_intraocular?.od?.aire || '—'}</td>
                        <td className="p-2 text-center font-bold">{c.presion_intraocular?.od?.apl || '—'}</td>
                        <td className="p-2 text-center">{c.presion_intraocular?.od?.paq_aire || '—'}</td>
                        <td className="p-2 text-center">{c.presion_intraocular?.oi?.aire || '—'}</td>
                        <td className="p-2 text-center font-bold">{c.presion_intraocular?.oi?.apl || '—'}</td>
                        <td className="p-2 text-center">{c.presion_intraocular?.oi?.paq_aire || '—'}</td>
                      </>
                    )}

                    {tipo === 'bmc' && (
                      <>
                        <td className="p-2 text-left">{c.biomicroscopia?.od || '—'}</td>
                        <td className="p-2 text-left">{c.biomicroscopia?.oi || '—'}</td>
                        <td className="p-2 text-center">{c.biomicroscopia?.cat_od || '—'}</td>
                        <td className="p-2 text-center">{c.biomicroscopia?.cat_oi || '—'}</td>
                      </>
                    )}

                    {tipo === 'fo' && (
                      <>
                        <td className="p-2 text-left">{c.fondo_ojo?.od || '—'}</td>
                        <td className="p-2 text-left">{c.fondo_ojo?.oi || '—'}</td>
                      </>
                    )}

                    {tipo === 'conducta' && (
                      <>
                        <td className="p-2 text-left font-semibold text-[#0e7c86]">{conductaLine(c)}</td>
                        <td className="p-2 text-center font-bold">
                          {c.conducta?.plan_ojo || c.datos_postop?.ojo || 'AO'}
                        </td>
                        <td className="p-2 text-left">{c.indicaciones_texto || '—'}</td>
                        <td className="p-2 text-left">{c.proximo_control || '—'}</td>
                      </>
                    )}

                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectConsulta(c.id)}
                        className="text-xs font-bold text-[#0e7c86] hover:underline"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

