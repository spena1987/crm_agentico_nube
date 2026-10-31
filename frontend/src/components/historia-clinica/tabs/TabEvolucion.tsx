'use client'

import React, { useState } from 'react'
import { ConsultaOftalmo, PacienteData, RecetaAnteojos } from '../types'
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
  FileText,
  Activity,
  AlertTriangle,
  Lock,
  PenTool,
  PlusCircle,
  ShieldCheck
} from 'lucide-react'
import ModalEnmienda from '../ModalEnmienda'

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
  onGenerarRecetaAnteojos?: (receta: Omit<RecetaAnteojos, 'id' | 'paciente_id'>) => Promise<void>
  onOpenDrawer?: (tab: 'farmacos' | 'pedidos' | 'estudios') => void
  onFirmarConsulta?: (consultaId: string) => Promise<void>
  firmandoConsulta?: boolean
  onAgregarEnmienda?: (consultaId: string, motivo: string, texto: string) => Promise<boolean>
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
  onImprimirEvolucion,
  onGenerarRecetaAnteojos,
  onOpenDrawer,
  onFirmarConsulta,
  firmandoConsulta,
  onAgregarEnmienda
}: TabEvolucionProps) {
  const [modoEvolucion, setModoEvolucion] = useState<TipoEvolucion | null>(null)
  const [modalEnmiendaOpen, setModalEnmiendaOpen] = useState(false)

  const sortedConsultas = [...consultas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  const consultaActivaIndex = sortedConsultas.findIndex(c => c.id === consultaActivaId)
  const consultaActiva = sortedConsultas[consultaActivaIndex >= 0 ? consultaActivaIndex : 0]
  const isFirmada = consultaActiva?.estado_legal === 'SIGNED' || consultaActiva?.estado_legal === 'AMENDED'
  // La consulta inmediatamente previa en el tiempo
  const consultaPrevia = consultaActivaIndex >= 0 && consultaActivaIndex < sortedConsultas.length - 1
    ? sortedConsultas[consultaActivaIndex + 1]
    : sortedConsultas.length > 1 && sortedConsultas[0].id === consultaActiva?.id
    ? sortedConsultas[1]
    : null

  return (
    <div className="flex flex-col lg:flex-row gap-2.5">
      {/* Sidebar Izquierda: Lista de Consultas y Vistas de Evolución */}
      <div className="w-full lg:w-56 flex-shrink-0 space-y-2">
        {/* Acciones principales de nueva visita */}
        <div className="bg-white border border-[#dde6ec] rounded-lg p-2 shadow-xs space-y-1.5">
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
                const pioOd = c.presion_intraocular?.od?.apl || c.presion_intraocular?.od?.aire
                const pioOi = c.presion_intraocular?.oi?.apl || c.presion_intraocular?.oi?.aire
                const tienePio = pioOd || pioOi
                const pioAlta = (parseFloat(pioOd || '0') >= 21) || (parseFloat(pioOi || '0') >= 21)

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
                      {c.geclisa_hc_id && (
                        <span className="text-[8px] font-mono bg-[#e4f3f4] text-[#0e7c86] border border-[#c3e2e4] px-1 py-0.2 rounded font-bold" title="Sincronizado en Geclisa">
                          hc#{c.geclisa_hc_id}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#728a99] mt-0.5 truncate font-medium">
                      {isPostop
                        ? c.datos_postop?.cx_realizada || 'Control postoperatorio'
                        : c.motivo_consulta || c.conducta?.plan_cx || 'Consulta de rutina'}
                    </div>

                    {/* Resumen clínico rápido en la tarjeta de visita */}
                    {tienePio && (
                      <div className="mt-1 flex items-center gap-1.5 text-[9.5px]">
                        <span className={`px-1 py-0.2 rounded font-bold ${
                          pioAlta ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-[#526b7a]'
                        }`}>
                          PIO: {pioOd || '-'}/{pioOi || '-'}
                        </span>
                      </div>
                    )}

                    {c.profesional_nombre && (
                      <div className="text-[10px] text-[#9db0bc] mt-0.5">
                        Dr/a: {c.profesional_nombre}
                      </div>
                    )}

                    {/* Botón eliminar consulta o Icono de bloqueo legal */}
                    {c.estado_legal === 'SIGNED' || c.estado_legal === 'AMENDED' ? (
                      <span
                        title="Consulta Médica Firmada e Inalterable (Ley 26.529)"
                        className="absolute bottom-2 right-2 p-1 text-emerald-600 opacity-70 group-hover:opacity-100 transition-opacity"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        title="Eliminar borrador de consulta"
                        onClick={e => {
                          e.stopPropagation()
                          if (confirm('¿Confirma que desea eliminar este borrador de consulta?')) {
                            onEliminarConsulta(c.id)
                          }
                        }}
                        className="absolute bottom-2 right-2 p-1 text-[#9db0bc] hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
              Inyecta la evolución estructurada de texto directamente en la Historia Clínica nativa de Geclisa.
            </p>
            {consultaActiva && (
              <button
                type="button"
                disabled={sincronizandoGeclisa}
                onClick={() => onSincronizarGeclisa(consultaActiva.id)}
                className={`w-full py-1.5 px-2 font-bold rounded text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 border ${
                  consultaActiva.geclisa_hc_id
                    ? 'bg-[#e4f3f4] text-[#0e7c86] border-[#c3e2e4] hover:bg-[#d0ecee]'
                    : 'bg-white text-[#0e7c86] border-[#dde6ec] hover:bg-[#e4f3f4]'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoGeclisa ? 'animate-spin' : ''}`} />
                {sincronizandoGeclisa
                  ? 'Sincronizando...'
                  : consultaActiva.geclisa_hc_id
                  ? `Actualizar en Geclisa (hcId #${consultaActiva.geclisa_hc_id})`
                  : 'Inyectar en HC Geclisa'}
              </button>
            )}
            {consultaActiva?.geclisa_hc_id ? (
              <div className="text-[10px] text-[#1a7f4b] font-bold flex items-center gap-1 bg-[#e6f5ec] px-2 py-1 rounded border border-[#b8e5cb]">
                <Check className="w-3.5 h-3.5" />
                Registrado en Geclisa nativo (hcId: #{consultaActiva.geclisa_hc_id})
              </div>
            ) : consultaActiva?.geclisa_sincronizado_en ? (
              <div className="text-[10px] text-[#1a7f4b] font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                Sincronizado {consultaActiva.geclisa_sincronizado_en.slice(0, 16).replace('T', ' ')}
              </div>
            ) : null}
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
                  disabled={isFirmada}
                  value={consultaActiva.fecha ? consultaActiva.fecha.slice(0, 10) : ''}
                  onChange={e => onUpdateConsultaActiva({ fecha: e.target.value })}
                  className="border border-[#dde6ec] rounded px-2 py-1 font-bold text-xs focus:border-[#0e7c86] outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                    consultaActiva.tipo === 'postop'
                      ? 'bg-[#e6f5ec] text-[#1a7f4b] border-[#b8e5cb]'
                      : 'bg-[#e4f3f4] text-[#0e7c86] border-[#c3e2e4]'
                  }`}
                >
                  {consultaActiva.tipo === 'postop' ? 'Control Postop' : 'Consulta Médica'}
                </span>

                {/* Badge de Trazabilidad e Inmutabilidad Legal (Ley 26.529) */}
                {isFirmada ? (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                    consultaActiva.estado_legal === 'AMENDED'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}>
                    <Lock className="w-3 h-3 text-emerald-600" />
                    {consultaActiva.estado_legal === 'AMENDED' ? 'Firmada con Adendas' : 'Firmada e Inmutable'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Borrador en edición
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Botón de Firma Digital o Agregar Adenda */}
                {isFirmada ? (
                  <button
                    type="button"
                    onClick={() => setModalEnmiendaOpen(true)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                    + Adenda / Salvado
                  </button>
                ) : onFirmarConsulta ? (
                  <button
                    type="button"
                    disabled={firmandoConsulta}
                    onClick={() => onFirmarConsulta(consultaActiva.id)}
                    className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white font-bold rounded text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <PenTool className={`w-3.5 h-3.5 ${firmandoConsulta ? 'animate-spin' : ''}`} />
                    {firmandoConsulta ? 'Firmando e Inyectando...' : 'Firmar y Cerrar (1-Clic)'}
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={isFirmada}
                  onClick={onOpenOCR}
                  className="px-2.5 py-1 bg-white border border-[#dde6ec] hover:border-[#0e7c86] hover:bg-[#e4f3f4] text-[#0e7c86] font-bold rounded text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Leer OCR
                </button>
                <button
                  type="button"
                  onClick={onImprimirFicha}
                  className="px-2.5 py-1 bg-white border border-[#dde6ec] hover:border-[#0e7c86] text-[#16323f] font-bold rounded text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0e7c86]" />
                  Imprimir ficha
                </button>
              </div>
            </div>

            {/* Formulario Activo (Consulta o Postop) */}
            {consultaActiva.tipo === 'postop' ? (
              <FormPostop
                consulta={consultaActiva}
                onChange={onUpdateConsultaActiva}
                onOpenVideosWA={onOpenVideosWA}
              />
            ) : (
              <FormConsulta
                consulta={consultaActiva}
                consultaPrevia={consultaPrevia}
                onChange={onUpdateConsultaActiva}
                onOpenResumenWA={onOpenResumenWA}
                onOpenVideosWA={onOpenVideosWA}
                onGenerarRecetaAnteojos={onGenerarRecetaAnteojos}
                onOpenDrawer={onOpenDrawer}
              />
            )}

            {/* Registro de Adendas y Modificaciones Foliadas (Art. 15 Ley 26.529) */}
            {consultaActiva.enmiendas && consultaActiva.enmiendas.length > 0 && (
              <div className="bg-amber-50/50 border border-amber-300 rounded-xl p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>Adendas y Modificaciones Foliadas (Art. 15 Ley 26.529)</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-100/60 px-2 py-0.5 rounded-full">
                    {consultaActiva.enmiendas.length} {consultaActiva.enmiendas.length === 1 ? 'adenda registrada' : 'adendas registradas'}
                  </span>
                </div>

                <div className="space-y-2">
                  {consultaActiva.enmiendas.map((enm, idx) => (
                    <div key={enm.id || idx} className="bg-white border border-amber-200 rounded-lg p-2.5 text-xs text-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-950">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          {enm.motivo_enmienda}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {enm.created_at?.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      <p className="text-slate-700 pl-5 whitespace-pre-wrap leading-relaxed text-[11px]">
                        {enm.texto_adenda}
                      </p>
                      <div className="flex items-center justify-between pl-5 pt-1 text-[10px] text-slate-500 border-t border-slate-100 mt-1">
                        <span>
                          Firmado por: <strong>{enm.profesional_nombre}</strong> {enm.profesional_matricula ? `(M.P. ${enm.profesional_matricula})` : ''}
                        </span>
                        {enm.signature_sha256 && (
                          <span className="font-mono text-slate-400" title={enm.signature_sha256}>
                            SHA: {enm.signature_sha256.slice(0, 12)}...
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#dde6ec] rounded-xl p-8 text-center text-xs text-[#728a99] italic">
            Seleccione una consulta o presione "+ Consulta" para comenzar.
          </div>
        )}
      </div>

      {/* Modal para Registrar Adenda / Enmienda Formal */}
      <ModalEnmienda
        isOpen={modalEnmiendaOpen}
        onClose={() => setModalEnmiendaOpen(false)}
        consultaId={consultaActiva?.id || ''}
        profesionalNombre={consultaActiva?.profesional_nombre}
        profesionalMatricula={consultaActiva?.profesional_matricula || undefined}
        onSubmit={async (motivo, texto) => {
          if (!onAgregarEnmienda || !consultaActiva) return false
          return await onAgregarEnmienda(consultaActiva.id, motivo, texto)
        }}
      />
    </div>
  )
}
