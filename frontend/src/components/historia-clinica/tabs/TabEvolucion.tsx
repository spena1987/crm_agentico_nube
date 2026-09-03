'use client'

import React, { useState } from 'react'
import { ConsultaOftalmo, PacienteData } from '../types'
import FormConsulta from './FormConsulta'
import FormPostop from './FormPostop'
import TablaEvolucionClinica, { TipoEvolucion } from './TablaEvolucionClinica'
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Camera, 
  Printer, 
  RefreshCw, 
  Check, 
  TrendingUp,
  FileText
} from 'lucide-react'

interface TabEvolucionProps {
  paciente: PacienteData
  consultas: ConsultaOftalmo[]
  consultaActivaId: string | null
  onSelectConsulta: (id: string) => void
  onNuevaConsulta: (tipo: 'consulta' | 'postop') => void
  onEliminarConsulta: (id: string) => void
  onUpdateConsultaActiva: (fields: Partial<ConsultaOftalmo>) => void
  onSincronizarGeclisa: (consultaId: string) => void
  sincronizandoGeclisa: boolean
  onOpenOCR: () => void
  onOpenResumenWA: () => void
  onOpenVideosWA: (esp?: boolean) => void
  onImprimirFicha: () => void
  onImprimirEvolucion: (tipo: TipoEvolucion) => void
}

export default function TabEvolucion({
  paciente,
  consultas,
  consultaActivaId,
  onSelectConsulta,
  onNuevaConsulta,
  onEliminarConsulta,
  onUpdateConsultaActiva,
  onSincronizarGeclisa,
  sincronizandoGeclisa,
  onOpenOCR,
  onOpenResumenWA,
  onOpenVideosWA,
  onImprimirFicha,
  onImprimirEvolucion
}: TabEvolucionProps) {
  const [modoEvolucion, setModoEvolucion] = useState<TipoEvolucion | null>(null)

  const sortedConsultas = [...consultas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  const consultaActiva = consultas.find(c => c.id === consultaActivaId) || sortedConsultas[0]

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* Sidebar Izquierda: Lista de Consultas y Vistas de Evolución */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-3">
        {/* Acciones principales de nueva visita */}
        <div className="bg-white border border-[#dde6ec] rounded-lg p-2.5 shadow-sm space-y-2">
          <div className="text-[9px] uppercase font-black text-[#9db0bc] tracking-wider">
            Consultas y Controles
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setModoEvolucion(null)
                onNuevaConsulta('consulta')
              }}
              className="px-2 py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white rounded text-xs font-bold flex items-center justify-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Consulta
            </button>
            <button
              type="button"
              onClick={() => {
                setModoEvolucion(null)
                onNuevaConsulta('postop')
              }}
              className="px-2 py-1.5 bg-[#1a7f4b] hover:bg-[#136139] text-white rounded text-xs font-bold flex items-center justify-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Postop
            </button>
          </div>
        </div>

        {/* Lista de visitas registradas */}
        <div className="bg-white border border-[#dde6ec] rounded-lg p-2.5 shadow-sm">
          <div className="text-[9px] uppercase font-black text-[#9db0bc] tracking-wider mb-2 flex items-center justify-between">
            <span>Historial ({sortedConsultas.length})</span>
            {sortedConsultas.length > 0 && <Calendar className="w-3 h-3 text-[#728a99]" />}
          </div>

          <div className="space-y-1 max-h-[380px] overflow-y-auto pr-0.5">
            {sortedConsultas.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#728a99] italic">
                No hay consultas registradas aún
              </div>
            ) : (
              sortedConsultas.map(c => {
                const isActive = !modoEvolucion && c.id === consultaActiva?.id
                const isPostop = c.tipo === 'postop'
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setModoEvolucion(null)
                      onSelectConsulta(c.id)
                    }}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all group relative ${
                      isActive
                        ? 'border-[#0e7c86] bg-[#e4f3f4] text-[#0e7c86]'
                        : 'border-[#dde6ec] bg-white hover:border-[#b3c7d1] text-[#16323f]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs">
                        {c.fecha ? c.fecha.slice(0, 10) : 'Sin fecha'}
                      </span>
                      <span
                        className={`text-[8.5px] uppercase font-black px-1.5 py-0.5 rounded border ${
                          isPostop
                            ? 'bg-[#e6f5ec] text-[#1a7f4b] border-[#b8e5cb]'
                            : 'bg-[#f7fafb] text-[#728a99] border-[#dde6ec]'
                        }`}
                      >
                        {isPostop ? 'Postop' : 'Consulta'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#728a99] mt-0.5 truncate font-medium">
                      {isPostop
                        ? c.datos_postop?.cx_realizada || 'Control postoperatorio'
                        : c.motivo_consulta || c.conducta?.plan_cx || 'Consulta de rutina'}
                    </div>

                    {c.profesional_nombre && (
                      <div className="text-[10px] text-[#9db0bc] mt-0.5">
                        Dr/a: {c.profesional_nombre}
                      </div>
                    )}

                    {/* Botón eliminar consulta */}
                    <button
                      type="button"
                      title="Eliminar consulta"
                      onClick={e => {
                        e.stopPropagation()
                        if (confirm('¿Confirma que desea eliminar esta consulta?')) {
                          onEliminarConsulta(c.id)
                        }
                      }}
                      className="absolute bottom-2 right-2 p-1 text-[#9db0bc] hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Ver en el tiempo (Tablas comparativas) */}
        <div className="bg-white border border-[#dde6ec] rounded-lg p-2.5 shadow-sm space-y-1">
          <div className="text-[9px] uppercase font-black text-[#9db0bc] tracking-wider mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#0e7c86]" />
            Ver en el tiempo
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            {(
              [
                ['rx', 'Refracción'],
                ['k', 'Queratometría'],
                ['pio', 'PIO / Paquim.'],
                ['bmc', 'Biomicroscopía'],
                ['fo', 'Fondo de ojo'],
                ['conducta', 'Conductas']
              ] as [TipoEvolucion, string][]
            ).map(([tipo, label]) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setModoEvolucion(tipo)}
                className={`p-1.5 rounded border text-left font-bold transition-all ${
                  modoEvolucion === tipo
                    ? 'border-[#0e7c86] bg-[#0e7c86] text-white'
                    : 'border-[#dde6ec] bg-[#f7fafb] text-[#16323f] hover:border-[#0e7c86]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sincronización con Geclisa */}
        {paciente.geclisa_ficha_id && (
          <div className="bg-[#f7fafb] border border-[#dde6ec] rounded-lg p-2.5 text-xs space-y-2">
            <div className="text-[9px] uppercase font-black text-[#9db0bc] tracking-wider flex items-center justify-between">
              <span>Geclisa</span>
              <span className="text-[#0e7c86] font-bold">#{paciente.geclisa_ficha_id}</span>
            </div>
            <p className="text-[11px] text-[#728a99]">
              Genera la evolución y adjunta el resumen clínico a la historia de Geclisa.
            </p>
            {consultaActiva && (
              <button
                type="button"
                disabled={sincronizandoGeclisa}
                onClick={() => onSincronizarGeclisa(consultaActiva.id)}
                className="w-full py-1.5 px-2 bg-white border border-[#dde6ec] hover:bg-[#e4f3f4] text-[#0e7c86] font-bold rounded text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoGeclisa ? 'animate-spin' : ''}`} />
                {sincronizandoGeclisa ? 'Sincronizando...' : 'Sincronizar con Geclisa'}
              </button>
            )}
            {consultaActiva?.geclisa_sincronizado_en && (
              <div className="text-[10px] text-[#1a7f4b] font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                Sincronizado {consultaActiva.geclisa_sincronizado_en.slice(0, 16).replace('T', ' ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenido Principal: Formulario de Visita o Tabla Comparativa */}
      <div className="flex-1 min-w-0">
        {modoEvolucion ? (
          <TablaEvolucionClinica
            tipo={modoEvolucion}
            consultas={consultas}
            consultaActivaId={consultaActiva?.id}
            onSelectConsulta={id => {
              setModoEvolucion(null)
              onSelectConsulta(id)
            }}
            onVolver={() => setModoEvolucion(null)}
            onImprimir={() => onImprimirEvolucion(modoEvolucion)}
          />
        ) : consultaActiva ? (
          <div className="space-y-3">
            {/* Barra de herramientas superior de la consulta activa */}
            <div className="bg-white border border-[#dde6ec] rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-extrabold text-[#728a99]">Fecha:</span>
                <input
                  type="date"
                  value={consultaActiva.fecha ? consultaActiva.fecha.slice(0, 10) : ''}
                  onChange={e => onUpdateConsultaActiva({ fecha: e.target.value })}
                  className="border border-[#dde6ec] rounded px-2 py-1 font-bold text-xs focus:border-[#0e7c86] outline-none"
                />
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                    consultaActiva.tipo === 'postop'
                      ? 'bg-[#e6f5ec] text-[#1a7f4b] border-[#b8e5cb]'
                      : 'bg-[#e4f3f4] text-[#0e7c86] border-[#c3e2e4]'
                  }`}
                >
                  {consultaActiva.tipo === 'postop' ? 'Control Postoperatorio' : 'Consulta Médica'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenOCR}
                  className="px-2.5 py-1 bg-white border border-[#dde6ec] hover:border-[#0e7c86] hover:bg-[#e4f3f4] text-[#0e7c86] font-bold rounded text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Leer ticket autoref (OCR)
                </button>
                <button
                  type="button"
                  onClick={onImprimirFicha}
                  className="px-2.5 py-1 bg-white border border-[#dde6ec] hover:bg-[#f7fafb] text-[#16323f] font-bold rounded text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0e7c86]" />
                  Imprimir ficha de hoy
                </button>
              </div>
            </div>

            {/* Render del formulario específico */}
            {consultaActiva.tipo === 'postop' ? (
              <FormPostop
                consulta={consultaActiva}
                onChange={onUpdateConsultaActiva}
                onOpenVideosWA={onOpenVideosWA}
              />
            ) : (
              <FormConsulta
                consulta={consultaActiva}
                onChange={onUpdateConsultaActiva}
                onOpenResumenWA={onOpenResumenWA}
                onOpenVideosWA={onOpenVideosWA}
              />
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#dde6ec] rounded-lg p-12 text-center text-xs text-[#728a99]">
            <FileText className="w-8 h-8 mx-auto text-[#9db0bc] mb-2" />
            <p className="font-bold text-[#16323f]">No hay ninguna consulta seleccionada.</p>
            <p className="mt-1">Crea una nueva consulta o postoperatorio desde el menú de la izquierda.</p>
          </div>
        )}
      </div>
    </div>
  )
}

