'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Pill,
  Send,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Stethoscope,
  Clock,
  ShieldCheck,
  Plus,
  Trash2
} from 'lucide-react'
import { BACKEND_URL as API_BASE_URL } from '@/lib/api'

interface SeccionIndicacionesExpedienteProps {
  asesoriaId?: string | null
  practicaNombre?: string | null
  practicaCodigo?: string | null
  practicaId?: string | null
  medicoNombre?: string | null
  medicoId?: number | string | null
  pacienteNombre?: string | null
  pacienteTelefono?: string | null
  indicacionGeclisaImId?: number | null
  indicacionesEmitidasAt?: string | null
  indicacionesPdfUrl?: string | null
  onIndicacionEmitida?: (resultado: any) => void
}

export default function SeccionIndicacionesExpediente({
  asesoriaId,
  practicaNombre,
  practicaCodigo,
  practicaId,
  medicoNombre,
  medicoId,
  pacienteNombre,
  pacienteTelefono,
  indicacionGeclisaImId,
  indicacionesEmitidasAt,
  indicacionesPdfUrl,
  onIndicacionEmitida
}: SeccionIndicacionesExpedienteProps) {
  const [desplegado, setDesplegado] = useState<boolean>(true)
  const [resolviendo, setResolviendo] = useState<boolean>(false)
  const [emitiendo, setEmitiendo] = useState<boolean>(false)
  
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<any>(null)
  const [textoIndicaciones, setTextoIndicaciones] = useState<string>('')
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [cuidadosGenerales, setCuidadosGenerales] = useState<string>('')
  const [pautasAlarma, setPautasAlarma] = useState<string>('')
  
  const [geclisaImId, setGeclisaImId] = useState<number | null>(indicacionGeclisaImId || null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(indicacionesPdfUrl || null)
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null)
  
  const [modalPreviewOpen, setModalPreviewOpen] = useState<boolean>(false)
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(null)
  const [generandoPreview, setGenerandoPreview] = useState<boolean>(false)
  
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)

  // Resolver sugerencia inteligente cuando cambia la práctica o el cirujano
  const resolverSugerencia = useCallback(async () => {
    if (!practicaNombre && !medicoNombre) return
    setResolviendo(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/resolver-sugerencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practica_nombre: practicaNombre,
          practica_codigo: practicaCodigo,
          practica_id: practicaId,
          medico_nombre: medicoNombre
        })
      })

      if (res.ok) {
        const data = await res.json()
        const sug = data.sugerencia
        if (sug) {
          setPlantillaSeleccionada(sug)
          setTextoIndicaciones(sug.texto_indicaciones || sug.cuerpo_indicaciones || '')
          setMedicamentos(sug.medicamentos || [])
          setCuidadosGenerales(sug.cuidados_generales || '')
          setPautasAlarma(sug.pautas_alarma || '')
        }
      }
    } catch (err) {
      console.error('Error resolviendo sugerencia de indicación:', err)
    } finally {
      setResolviendo(false)
    }
  }, [practicaNombre, medicoNombre, practicaCodigo, practicaId])

  useEffect(() => {
    resolverSugerencia()
  }, [resolverSugerencia])

  // Previsualizar PDF con ReportLab
  const handlePreviewPdf = async () => {
    setGenerandoPreview(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/preview-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datos_emision: {
            paciente_nombre: pacienteNombre || 'Paciente',
            practica_nombre: practicaNombre || 'Cirugía Oftalmológica',
            medico_nombre: medicoNombre || 'Médico Cirujano',
            cuerpo_indicaciones: textoIndicaciones,
            medicamentos: medicamentos,
            cuidados_generales: cuidadosGenerales,
            pautas_alarma: pautasAlarma,
            geclisa_im_id: geclisaImId
          }
        })
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setPreviewPdfBlobUrl(url)
        setModalPreviewOpen(true)
      } else {
        setMensajeError('No se pudo generar la previsualización del PDF.')
      }
    } catch (e: any) {
      setMensajeError('Fallo al conectar con el servicio de PDF.')
    } finally {
      setGenerandoPreview(false)
    }
  }

  // Disparo de emisión formal a Geclisa y envío por WhatsApp
  const handleEmitirIndicaciones = async () => {
    if (!asesoriaId) {
      setMensajeError('Debe guardar primero el expediente para poder emitir las indicaciones formalmente en Geclisa.')
      return
    }

    setEmitiendo(true)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/expediente-quirurgico/${asesoriaId}/emitir-indicaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enviar_whatsapp: true,
          texto_indicaciones: textoIndicaciones,
          medicamentos: medicamentos,
          cuidados_generales: cuidadosGenerales,
          pautas_alarma: pautasAlarma
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setGeclisaImId(data.geclisa_im_id)
        setPdfUrl(data.pdf_url)
        setWhatsappStatus(data.whatsapp_status)
        
        let msg = '¡Indicaciones médicas emitidas con éxito!'
        if (data.geclisa_im_id) {
          msg += ` Registrada en Geclisa (ID #${data.geclisa_im_id}).`
        }
        if (data.whatsapp_status === 'enviado') {
          msg += ' Mensaje y PDF enviados por WhatsApp al paciente.'
        }
        setMensajeExito(msg)

        if (onIndicacionEmitida) {
          onIndicacionEmitida(data)
        }
      } else {
        setMensajeError(data.detail || data.error || 'Error al emitir la indicación médica.')
      }
    } catch (err: any) {
      setMensajeError('Error de red al conectar con el servidor.')
    } finally {
      setEmitiendo(false)
    }
  }

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 overflow-hidden transition-all text-xs">
      {/* Barra de título colapsable */}
      <div 
        onClick={() => setDesplegado(!desplegado)}
        className="p-3.5 bg-gradient-to-r from-blue-900/10 to-indigo-900/10 flex items-center justify-between cursor-pointer hover:bg-blue-500/10 transition"
      >
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-600 text-white">
            <Pill size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[var(--foreground)] text-sm">
                Indicaciones Médicas Quirúrgicas
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600/10 text-blue-600 border border-blue-600/20">
                Opción C • Automático
              </span>
              {geclisaImId && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600/10 text-emerald-600 border border-emerald-600/20 flex items-center gap-1">
                  <CheckCircle size={11} />
                  <span>Geclisa #{geclisaImId}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--secondary)]">
              {plantillaSeleccionada?.titulo ? (
                <>Sugerida: <b>{plantillaSeleccionada.titulo}</b> ({plantillaSeleccionada.origen || 'Geclisa'})</>
              ) : (
                'Resuelve automáticamente protocolo de gotas y reposo por práctica y cirujano.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {resolviendo && <Loader2 size={14} className="animate-spin text-blue-600" />}
          {desplegado ? <ChevronUp size={18} className="text-[var(--secondary)]" /> : <ChevronDown size={18} className="text-[var(--secondary)]" />}
        </div>
      </div>

      {/* Contenido expandido */}
      {desplegado && (
        <div className="p-4 space-y-3.5 border-t border-blue-500/10">
          {/* Mensajes de feedback */}
          {mensajeExito && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
              <CheckCircle size={15} />
              <span>{mensajeExito}</span>
            </div>
          )}
          {mensajeError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{mensajeError}</span>
            </div>
          )}

          {/* Información contextual del médico y práctica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-[var(--card-bg)] p-2.5 rounded-xl border border-[var(--border-color)] text-[11px]">
            <div>
              <span className="text-[var(--secondary)] block">Práctica Quirúrgica:</span>
              <span className="font-bold text-[var(--foreground)]">{practicaNombre || 'No seleccionada'}</span>
            </div>
            <div>
              <span className="text-[var(--secondary)] block">Cirujano Asignado:</span>
              <span className="font-bold text-[var(--foreground)]">{medicoNombre || 'No asignado'}</span>
            </div>
            <div>
              <span className="text-[var(--secondary)] block">Destinatario WhatsApp:</span>
              <span className="font-bold text-[var(--foreground)]">{pacienteNombre || 'Paciente'} ({pacienteTelefono || 'Sin teléfono'})</span>
            </div>
          </div>

          {/* Texto de las Indicaciones */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-[var(--foreground)]">
                Texto de las Indicaciones Médicas (Se asentará en Geclisa):
              </label>
              <button
                type="button"
                onClick={resolverSugerencia}
                disabled={resolviendo}
                className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
              >
                <RefreshCw size={11} className={resolviendo ? 'animate-spin' : ''} />
                <span>Re-analizar sugerencia</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={textoIndicaciones}
              onChange={(e) => setTextoIndicaciones(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] font-mono text-[11px] leading-relaxed"
              placeholder="Instrucciones postquirúrgicas para el paciente..."
            />
          </div>

          {/* Fármacos y Gotas estructurados */}
          {medicamentos.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-bold text-[var(--foreground)] block">
                Colirios y Gotas Programadas ({medicamentos.length}):
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {medicamentos.map((m, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-blue-600 block">{m.droga}</span>
                      <span className="text-[10px] text-[var(--secondary)]">{m.dosis} • {m.frecuencia} • {m.duracion}</span>
                    </div>
                    {m.instrucciones && (
                      <span className="text-[10px] italic text-[var(--secondary)] max-w-[120px] truncate" title={m.instrucciones}>
                        {m.instrucciones}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones principales de emisión */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-blue-500/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviewPdf}
                disabled={generandoPreview}
                className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] font-semibold text-[var(--foreground)] flex items-center gap-1.5 transition"
              >
                {generandoPreview ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                <span>Ver PDF</span>
              </button>

              {pdfUrl && (
                <a
                  href={`${API_BASE_URL}${pdfUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-semibold flex items-center gap-1.5 hover:bg-slate-900 transition"
                >
                  <ExternalLink size={13} />
                  <span>Abrir Documento Emitido</span>
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEmitirIndicaciones}
                disabled={emitiendo || !asesoriaId}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                {emitiendo ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Emitir a Geclisa y Enviar WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Previsualización PDF */}
      {modalPreviewOpen && previewPdfBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--hover-bg)]/40">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <h3 className="font-bold text-sm text-[var(--foreground)]">
                  Vista Previa Oficial: Indicación Médica Centro Visión
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPreviewOpen(false)}
                className="px-3 py-1 rounded-lg border border-[var(--border-color)] text-xs font-bold hover:bg-[var(--hover-bg)]"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 bg-slate-900/10">
              <iframe src={previewPdfBlobUrl} className="w-full h-full border-0" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
