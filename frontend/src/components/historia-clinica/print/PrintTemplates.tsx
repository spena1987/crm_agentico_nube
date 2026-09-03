'use client'

import React from 'react'
import { 
  PacienteData, 
  HistoriaClinicaOftalmo, 
  ConsultaOftalmo, 
  RecetaAnteojos, 
  RecetaFarmacos, 
  PedidoEstudios 
} from '../types'

interface PrintContainerProps {
  tipo: 'ficha' | 'receta_anteojos' | 'receta_farmacos' | 'pedido_estudios' | 'indicaciones' | 'evolucion'
  paciente: PacienteData
  historia?: HistoriaClinicaOftalmo
  consulta?: ConsultaOftalmo
  recetaAnteojos?: RecetaAnteojos
  recetaFarmacos?: RecetaFarmacos
  pedidoEstudios?: PedidoEstudios
  indicacionesTexto?: { titulo: string; contenido: string }
  evolucionData?: { titulo: string; contenido: string }
}

export default function PrintContainer({
  tipo,
  paciente,
  historia,
  consulta,
  recetaAnteojos,
  recetaFarmacos,
  pedidoEstudios,
  indicacionesTexto
}: PrintContainerProps) {
  return (
    <div className="hidden print:block print:w-full print:p-6 bg-white text-black font-sans text-xs">
      {/* Membrete institucional */}
      <div className="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-wide uppercase">CENTRO OFTALMOLÓGICO</h1>
          <p className="text-[10px] text-gray-600">Cirugía Refractiva, Catarata y Glaucoma</p>
        </div>
        <div className="text-right text-[10px] text-gray-600">
          <div>Fecha: {new Date().toLocaleDateString('es-AR')}</div>
          {paciente.geclisa_ficha_id && <div>HC Geclisa: #{paciente.geclisa_ficha_id}</div>}
        </div>
      </div>

      {/* Recuadro de datos del paciente */}
      <div className="border border-gray-400 rounded p-2 mb-4 bg-gray-50/50">
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <div><strong>Paciente:</strong> {paciente.nombre}</div>
          <div><strong>DNI:</strong> {paciente.dni || '—'}</div>
          <div><strong>N° HC:</strong> {paciente.nro_hc || '—'}</div>
          <div><strong>Teléfono:</strong> {paciente.telefono || '—'}</div>
          <div><strong>Obra Social:</strong> {paciente.obra_social || 'Particular'}</div>
          <div><strong>Plan:</strong> {paciente.plan_cobertura || '—'}</div>
          <div><strong>Afiliado:</strong> {paciente.direccion || '—'}</div>
          <div><strong>Fecha Nac.:</strong> {paciente.fecha_nacimiento ? paciente.fecha_nacimiento.slice(0, 10) : '—'}</div>
        </div>
      </div>

      {/* 1. FICHA DE CONSULTA */}
      {tipo === 'ficha' && consulta && (
        <div className="space-y-4">
          <div className="text-center font-bold uppercase text-sm border-b pb-1">
            {consulta.tipo === 'postop' ? 'Ficha de Control Postoperatorio' : 'Evolución Clínica Oftalmológica'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Fecha de consulta:</strong> {consulta.fecha ? consulta.fecha.slice(0, 10) : ''}
            </div>
            <div>
              <strong>Profesional actuante:</strong> {consulta.profesional_nombre || '—'}
            </div>
            {consulta.motivo_consulta && (
              <div className="col-span-2">
                <strong>Motivo de consulta:</strong> {consulta.motivo_consulta}
              </div>
            )}
          </div>

          {/* Agudeza Visual y Refracción */}
          <div className="border rounded p-2 space-y-2">
            <div className="font-bold border-b pb-1">Examen Refractivo y Visual</div>
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b bg-gray-100 font-bold">
                  <th>Ojo</th>
                  <th>AVSC</th>
                  <th>AVCC</th>
                  <th>Esfera</th>
                  <th>Cilindro</th>
                  <th>Eje</th>
                  <th>Adición</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="font-bold">OD</td>
                  <td>{consulta.agudeza_visual?.od?.sc || '—'}</td>
                  <td>{consulta.agudeza_visual?.od?.cc || '—'}</td>
                  <td>{consulta.refraccion?.od?.esf || '—'}</td>
                  <td>{consulta.refraccion?.od?.cil || '—'}</td>
                  <td>{consulta.refraccion?.od?.eje || '—'}</td>
                  <td>{consulta.refraccion?.od?.add || '—'}</td>
                </tr>
                <tr>
                  <td className="font-bold">OI</td>
                  <td>{consulta.agudeza_visual?.oi?.sc || '—'}</td>
                  <td>{consulta.agudeza_visual?.oi?.cc || '—'}</td>
                  <td>{consulta.refraccion?.oi?.esf || '—'}</td>
                  <td>{consulta.refraccion?.oi?.cil || '—'}</td>
                  <td>{consulta.refraccion?.oi?.eje || '—'}</td>
                  <td>{consulta.refraccion?.oi?.add || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Biomicroscopía y PIO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded p-2">
              <div className="font-bold border-b pb-1">Presión Intraocular (PIO)</div>
              <div className="pt-1">
                OD: {consulta.presion_intraocular?.od?.apl || consulta.presion_intraocular?.od?.aire || '—'} mmHg ·
                OI: {consulta.presion_intraocular?.oi?.apl || consulta.presion_intraocular?.oi?.aire || '—'} mmHg
              </div>
            </div>
            <div className="border rounded p-2">
              <div className="font-bold border-b pb-1">Biomicroscopía</div>
              <div className="pt-1">
                {consulta.biomicroscopia?.od ? `OD: ${consulta.biomicroscopia.od}` : ''}
                {consulta.biomicroscopia?.oi ? ` · OI: ${consulta.biomicroscopia.oi}` : ''}
              </div>
            </div>
          </div>

          {/* Diagnóstico y Conducta */}
          <div className="border rounded p-2 space-y-1">
            <div className="font-bold border-b pb-1">Diagnóstico y Plan</div>
            <div><strong>Diagnóstico:</strong> {consulta.conducta?.dx_presuntivo || '—'}</div>
            <div><strong>Conducta:</strong> {consulta.conducta?.plan_cx || '—'}</div>
            {consulta.indicaciones_texto && (
              <div><strong>Indicaciones:</strong> {consulta.indicaciones_texto}</div>
            )}
            {consulta.proximo_control && (
              <div><strong>Próximo control:</strong> {consulta.proximo_control}</div>
            )}
          </div>
        </div>
      )}

      {/* 2. RECETA DE ANTEOJOS */}
      {tipo === 'receta_anteojos' && recetaAnteojos && (
        <div className="space-y-6 pt-4">
          <div className="text-center font-black uppercase text-base border-b-2 pb-1">
            PRESCRIPCIÓN ÓPTICA DE ANTEOJOS
          </div>

          <div className="border-2 border-black rounded-lg p-4 space-y-4">
            <div>
              <div className="font-bold uppercase text-xs mb-1">Para Visión de Lejos:</div>
              <table className="w-full text-center border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100 border-b border-black">
                    <th className="p-1 border-r border-black">Ojo</th>
                    <th className="p-1 border-r border-black">Esfera</th>
                    <th className="p-1 border-r border-black">Cilindro</th>
                    <th className="p-1 border-r border-black">Eje</th>
                    <th className="p-1">DNP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-1.5 font-bold border-r border-black">OD</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.lejos?.od?.esf || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.lejos?.od?.cil || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.lejos?.od?.eje || '—'}</td>
                    <td className="p-1.5">{recetaAnteojos.lejos?.od?.dnp || '—'}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 font-bold border-r border-black">OI</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.lejos?.oi?.esf || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.lejos?.oi?.cil || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.lejos?.oi?.eje || '—'}</td>
                    <td className="p-1.5">{recetaAnteojos.lejos?.oi?.dnp || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="font-bold uppercase text-xs mb-1">Para Visión de Cerca:</div>
              <table className="w-full text-center border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100 border-b border-black">
                    <th className="p-1 border-r border-black">Ojo</th>
                    <th className="p-1 border-r border-black">Esfera</th>
                    <th className="p-1 border-r border-black">Cilindro</th>
                    <th className="p-1 border-r border-black">Eje</th>
                    <th className="p-1">DNP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-1.5 font-bold border-r border-black">OD</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.cerca?.od?.esf || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.cerca?.od?.cil || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.cerca?.od?.eje || '—'}</td>
                    <td className="p-1.5">{recetaAnteojos.cerca?.od?.dnp || '—'}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 font-bold border-r border-black">OI</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.cerca?.oi?.esf || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.cerca?.oi?.cil || '—'}</td>
                    <td className="p-1.5 border-r border-black">{recetaAnteojos.cerca?.oi?.eje || '—'}</td>
                    <td className="p-1.5">{recetaAnteojos.cerca?.oi?.dnp || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-black space-y-1">
              <div><strong>Tipo de cristales:</strong> {recetaAnteojos.tipo_cristal}</div>
              {recetaAnteojos.observaciones && (
                <div><strong>Indicaciones ópticas:</strong> {recetaAnteojos.observaciones}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. RECETA DE FÁRMACOS (Rp) */}
      {tipo === 'receta_farmacos' && recetaFarmacos && (
        <div className="space-y-6 pt-4">
          <div className="text-center font-black uppercase text-base border-b-2 pb-1">
            RECETA MÉDICA (Rp.)
          </div>

          <div className="border-2 border-black rounded-lg p-5 space-y-4 min-h-[300px]">
            {recetaFarmacos.diagnostico && (
              <div className="border-b pb-2">
                <strong>Diagnóstico:</strong> {recetaFarmacos.diagnostico}
              </div>
            )}

            <div className="space-y-4 text-sm font-serif">
              <div className="text-xl font-black italic">Rp.</div>
              {recetaFarmacos.items?.map((it, idx) => (
                <div key={idx} className="pl-4 space-y-1">
                  <div className="font-bold text-base">
                    {idx + 1}. {it.farmaco} ({it.ojo || 'AO'})
                  </div>
                  <div className="italic text-gray-700 pl-4">
                    Posología: {it.posologia}
                  </div>
                </div>
              ))}
            </div>

            {recetaFarmacos.indicaciones_generales && (
              <div className="pt-4 border-t text-xs text-gray-600">
                <strong>Indicaciones:</strong> {recetaFarmacos.indicaciones_generales}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. PEDIDO DE ESTUDIOS */}
      {tipo === 'pedido_estudios' && pedidoEstudios && (
        <div className="space-y-6 pt-4">
          <div className="text-center font-black uppercase text-base border-b-2 pb-1">
            SOLICITUD DE PRÁCTICAS Y ESTUDIOS COMPLEMENTARIOS
          </div>

          <div className="border-2 border-black rounded-lg p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 border-b pb-2">
              <div><strong>Diagnóstico:</strong> {pedidoEstudios.diagnostico || 'Evaluación oftalmológica'}</div>
              <div><strong>Ojo solicitado:</strong> {pedidoEstudios.ojo || 'AO'}</div>
            </div>

            <div>
              <div className="font-bold uppercase text-xs mb-2">Estudios a realizar:</div>
              <ul className="space-y-1.5 pl-4">
                {pedidoEstudios.estudios?.map((est, i) => (
                  <li key={i} className="font-bold text-sm flex items-center gap-2">
                    <span className="w-3 h-3 border border-black inline-block" />
                    {est} ({pedidoEstudios.ojo || 'AO'})
                  </li>
                ))}
              </ul>
            </div>

            {pedidoEstudios.observaciones && (
              <div className="pt-2 border-t">
                <strong>Observaciones:</strong> {pedidoEstudios.observaciones}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. HOJA DE INDICACIONES */}
      {tipo === 'indicaciones' && indicacionesTexto && (
        <div className="space-y-4 pt-2">
          <div className="text-center font-black uppercase text-base border-b-2 pb-1">
            {indicacionesTexto.titulo}
          </div>
          <div className="border border-black rounded-lg p-5 whitespace-pre-wrap font-sans text-xs leading-relaxed">
            {indicacionesTexto.contenido}
          </div>
        </div>
      )}

      {/* Firma y sello al pie */}
      <div className="mt-16 pt-8 flex justify-end">
        <div className="text-center border-t border-black w-56 pt-1">
          <div className="font-bold text-xs">Firma y Sello Médico</div>
          <div className="text-[10px] text-gray-500">M.P. / Especialista en Oftalmología</div>
        </div>
      </div>
    </div>
  )
}

