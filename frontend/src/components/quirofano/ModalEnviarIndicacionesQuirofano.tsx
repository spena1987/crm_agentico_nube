'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Pill,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Stethoscope,
  Phone,
  Eye,
  Sparkles,
  FileText,
  Building,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Check,
  Calendar,
  Layers
} from 'lucide-react'
import { BACKEND_URL as API_BASE_URL, apiFetch } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface ModalEnviarIndicacionesQuirofanoProps {
  isOpen: boolean
  onClose: () => void
  turnoId: string
  onIndicacionesEnviadas?: () => void
}

export default function ModalEnviarIndicacionesQuirofano({
  isOpen,
  onClose,
  turnoId,
  onIndicacionesEnviadas
}: ModalEnviarIndicacionesQuirofanoProps) {
  const { user } = useAuth()
  const operadorNombre =
    (user as any)?.user_metadata?.nombre_completo ||
    (user as any)?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Quirófano'
  const operadorId = user?.id || null

  const [loading, setLoading] = useState<boolean>(true)
  const [enviando, setEnviando] = useState<boolean>(false)
  const [generandoPreview, setGenerandoPreview] = useState<boolean>(false)

  const [datos, setDatos] = useState<any>(null)
  const [telefono, setTelefono] = useState<string>('')
  const [textoIndicaciones, setTextoIndicaciones] = useState<string>('')
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [cuidadosGenerales, setCuidadosGenerales] = useState<string>('')
  const [pautasAlarma, setPautasAlarma] = useState<string>('')
  const [modulosAsignados, setModulosAsignados] = useState<any[]>([])
  const [modulosSeleccionadosIds, setModulosSeleccionadosIds] = useState<string[]>([])

  const [plantillasCrm, setPlantillasCrm] = useState<any[]>([])
  const [plantillaManualId, setPlantillaManualId] = useState<string>('')

  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [pdfUrlEnviado, setPdfUrlEnviado] = useState<string | null>(null)

  // Cargar catálogo de plantillas CRM para selección manual si la práctica no tiene regla
  useEffect(() => {
    apiFetch('/api/indicaciones/plantillas')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.plantillas)) {
          setPlantillasCrm(d.plantillas.filter((p: any) => p.activo !== false))
        }
      })
      .catch((e) => console.error('Error cargando biblioteca de indicaciones:', e))
  }, [])

  // Cargar datos del turno y resolver indicaciones post-qx
  const cargarDatosTurno = useCallback(async () => {
    if (!turnoId) return
    setLoading(true)
    setMensajeError(null)
    try {
      const res = await apiFetch(`/api/turnos-quirofano/${turnoId}/preparar-indicaciones-postqx`)
      const data = await res.json()
      if (res.ok && data.success) {
        setDatos(data)
        const pacTel = data.paciente?.telefono || ''
        setTelefono(pacTel)

        if (data.ya_enviado && data.pdf_url) {
          setPdfUrlEnviado(data.pdf_url)
        }

        const sug = data.sugerencia
        if (sug) {
          setTextoIndicaciones(sug.texto_indicaciones || sug.cuerpo_indicaciones || '')
          setMedicamentos(sug.medicamentos || [])
          setCuidadosGenerales(sug.cuidados_generales || '')
          setPautasAlarma(sug.pautas_alarma || '')

          if (Array.isArray(sug.modulos_asignados) && sug.modulos_asignados.length > 0) {
            setModulosAsignados(sug.modulos_asignados)
            setModulosSeleccionadosIds(sug.modulos_asignados.map((m: any) => m.id))
          } else {
            setModulosAsignados([])
            setModulosSeleccionadosIds([])
          }
        }
      } else {
        setMensajeError(data.error || 'No se pudieron preparar las indicaciones del turno.')
      }
    } catch (err: any) {
      console.error('Error preparando indicaciones:', err)
      setMensajeError('Fallo al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [turnoId])

  useEffect(() => {
    if (isOpen) {
      setMensajeExito(null)
      cargarDatosTurno()
    }
  }, [isOpen, cargarDatosTurno])

  // Alternar módulos activos (1 a N)
  const handleToggleModulo = (moduloId: string) => {
    let nuevosIds: string[]
    if (modulosSeleccionadosIds.includes(moduloId)) {
      nuevosIds = modulosSeleccionadosIds.filter((id) => id !== moduloId)
    } else {
      nuevosIds = [...modulosSeleccionadosIds, moduloId]
    }
    setModulosSeleccionadosIds(nuevosIds)

    const modulosFiltrados = modulosAsignados.filter((m: any) => nuevosIds.includes(m.id))
    const textos = modulosFiltrados.map((m: any) => m.cuerpo_indicaciones).filter(Boolean)
    setTextoIndicaciones(textos.join('\n\n---\n\n'))

    const todosMeds: any[] = []
    modulosFiltrados.forEach((m: any) => {
      ;(m.medicamentos || []).forEach((med: any) => {
        if (!todosMeds.some((x) => x.droga === med.droga)) {
          todosMeds.push(med)
        }
      })
    })
    setMedicamentos(todosMeds)

    const todosCuidados = modulosFiltrados.map((m: any) => m.cuidados_generales).filter(Boolean)
    setCuidadosGenerales(todosCuidados.join('\n'))

    const todasAlarmas = modulosFiltrados.map((m: any) => m.pautas_alarma).filter(Boolean)
    setPautasAlarma(todasAlarmas.join('\n'))
  }

  // Selección manual de plantilla si no hay regla preconfigurada
  const handleSelectPlantillaManual = (plantillaId: string) => {
    setPlantillaManualId(plantillaId)
    const match = plantillasCrm.find((p) => p.id === plantillaId)
    if (match) {
      setTextoIndicaciones(match.cuerpo_indicaciones || '')
      setMedicamentos(match.medicamentos || [])
      setCuidadosGenerales(match.cuidados_generales || '')
      setPautasAlarma(match.pautas_alarma || '')
      setModulosAsignados([])
      setModulosSeleccionadosIds([])
    }
  }

  // Previsualizar PDF Express
  const handleVerPreviewPdf = async () => {
    setGenerandoPreview(true)
    setMensajeError(null)
    try {
      const payload = {
        datos_emision: {
          paciente_nombre: datos?.paciente?.nombre || 'Paciente',
          paciente_dni: datos?.paciente?.dni || '',
          paciente_obra_social: datos?.paciente?.obra_social || '',
          practica_nombre: datos?.cirugia?.practica_nombre || 'Cirugía Oftalmológica',
          medico_nombre: datos?.cirujano?.nombre || 'Médico Cirujano',
          medico_id: datos?.cirujano?.id,
          cuerpo_indicaciones: textoIndicaciones,
          medicamentos: medicamentos,
          cuidados_generales: cuidadosGenerales,
          pautas_alarma: pautasAlarma,
          tipo_documento: 'postquirurgico',
          titulo_documento: 'INDICACIONES MÉDICAS POSTQUIRÚRGICAS'
        }
      }
      const res = await apiFetch('/api/indicaciones/preview-pdf', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
      } else {
        setMensajeError('No se pudo generar la previsualización del PDF.')
      }
    } catch (e) {
      setMensajeError('Error al generar preview del PDF.')
    } finally {
      setGenerandoPreview(false)
    }
  }

  // Despacho oficial por WhatsApp
  const handleEnviarWhatsApp = async () => {
    if (!telefono || telefono.trim().length < 8) {
      setMensajeError('Por favor ingrese un número de WhatsApp válido para el paciente.')
      return
    }

    setEnviando(true)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const modulosActivos = modulosAsignados.filter((m: any) => modulosSeleccionadosIds.includes(m.id))

      const res = await apiFetch(`/api/turnos-quirofano/${turnoId}/enviar-indicaciones-postqx`, {
        method: 'POST',
        body: JSON.stringify({
          telefono_override: telefono.trim(),
          texto_indicaciones: textoIndicaciones,
          medicamentos: medicamentos,
          cuidados_generales: cuidadosGenerales,
          pautas_alarma: pautasAlarma,
          modulos: modulosActivos.length > 0 ? modulosActivos : undefined,
          operador_id: operadorId,
          operador_nombre: operadorNombre
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito('¡Indicaciones postquirúrgicas enviadas con éxito por WhatsApp!')
        if (data.pdf_url) {
          setPdfUrlEnviado(data.pdf_url)
        }
        if (onIndicacionesEnviadas) {
          onIndicacionesEnviadas()
        }
      } else {
        setMensajeError(data.error || data.detail || 'Fallo al enviar indicaciones por WhatsApp.')
      }
    } catch (err: any) {
      console.error('Error enviando indicaciones:', err)
      setMensajeError('Error de conexión al despachar WhatsApp.')
    } finally {
      setEnviando(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/80 flex items-center justify-center">
              <Pill size={17} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                <span>Indicaciones Médicas Postquirúrgicas (WhatsApp)</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Quirófano Express
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Envío oficial con esquema de colirios, reposo y firma digitalizada del cirujano
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body con Scroll */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-cyan-400" />
              <span>Preparando protocolo postquirúrgico y cirujano participante...</span>
            </div>
          ) : (
            <>
              {/* Avisos de Feedback */}
              {mensajeExito && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="font-semibold text-xs">{mensajeExito}</span>
                  </div>
                  {pdfUrlEnviado && (
                    <a
                      href={pdfUrlEnviado.startsWith('http') ? pdfUrlEnviado : `${API_BASE_URL}${pdfUrlEnviado}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-900/60 text-emerald-200 border border-emerald-700/80 hover:bg-emerald-800/80 font-bold text-[11px] flex items-center gap-1"
                    >
                      <Eye size={12} /> Ver PDF
                    </a>
                  )}
                </div>
              )}

              {mensajeError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 flex items-center gap-2 animate-in fade-in">
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span className="text-xs">{mensajeError}</span>
                </div>
              )}

              {/* Fila 1: Paciente y Cirujano */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase tracking-wider">
                    Paciente Intervenido
                  </span>
                  <p className="font-extrabold text-slate-100 text-xs truncate">
                    {datos?.paciente?.nombre || 'Paciente'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    DNI: {datos?.paciente?.dni || 'S/D'} • {datos?.paciente?.obra_social || 'Particular'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10.5px] text-slate-500 font-bold block uppercase tracking-wider">
                    Cirujano Participante
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-emerald-400 shrink-0" />
                    <p className="font-extrabold text-slate-100 text-xs truncate">
                      {datos?.cirujano?.nombre || 'Médico Cirujano'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[10.5px] text-emerald-400 font-medium">
                    <ShieldCheck size={12} />
                    <span>Firma Digitalizada con Fondo Transparente</span>
                  </div>
                </div>
              </div>

              {/* Fila 2: Práctica y Procedimiento */}
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10.5px] text-slate-500 block">Práctica Realizada:</span>
                  <span className="font-bold text-slate-200">
                    {datos?.cirugia?.practica_nombre || 'Cirugía Oftalmológica'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10.5px] text-slate-500 block">Ojo:</span>
                  <span className="font-extrabold px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/80 text-[11px]">
                    {datos?.cirugia?.ojo || 'OI'}
                  </span>
                </div>
              </div>

              {/* Badge de Procedencia del Protocolo */}
              <div>
                {datos?.origen_resolucion?.startsWith('regla_cirujano') ? (
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-400 shrink-0" />
                    <span>
                      <strong>Protocolo Personalizado Activo:</strong> Asignado según técnica y esquema de colirios del{' '}
                      <strong className="underline">{datos?.cirujano?.nombre}</strong>.
                    </span>
                  </div>
                ) : datos?.origen_resolucion?.startsWith('institucional') ? (
                  <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/80 text-blue-300 flex items-center gap-2">
                    <Building size={14} className="text-blue-400 shrink-0" />
                    <span>
                      <strong>Protocolo Institucional Centro Visión:</strong> Aplicado por defecto para esta práctica en fase postoperatoria.
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-300 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-amber-400 shrink-0" />
                      <span>
                        Esta práctica no cuenta con un protocolo automatizado preconfigurado. Seleccione una plantilla de la biblioteca:
                      </span>
                    </div>
                    <select
                      value={plantillaManualId}
                      onChange={(e) => handleSelectPlantillaManual(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-100"
                    >
                      <option value="">-- Seleccionar Plantilla de Indicaciones --</option>
                      {plantillasCrm.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.titulo} ({p.categoria || 'General'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Módulos 1 a N si hay más de 1 asignado */}
              {modulosAsignados.length > 1 && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-300 flex items-center gap-1.5">
                      <Layers size={13} className="text-cyan-400" />
                      Módulos Complementarios ({modulosAsignados.length}):
                    </span>
                    <span className="text-[10px] text-slate-500">Tilde los que aplican a este paciente</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modulosAsignados.map((m: any) => {
                      const isActivo = modulosSeleccionadosIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleModulo(m.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                            isActivo
                              ? 'bg-cyan-950 text-cyan-200 border-cyan-700 shadow-sm'
                              : 'bg-slate-900 text-slate-500 border-slate-800 line-through opacity-50'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                            isActivo ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                          }`}>
                            ✓
                          </span>
                          <span>{m.titulo}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Resumen de Medicamentos / Gotas */}
              {medicamentos.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-[11px] text-slate-300 block">
                    💊 Esquema Posológico de Colirios & Gotas ({medicamentos.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {medicamentos.map((m: any, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-blue-950/60 text-blue-300 border border-blue-900 text-[10.5px] font-medium"
                      >
                        {m.droga} {m.frecuencia ? `• ${m.frecuencia}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Teléfono de Destino WhatsApp */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Phone size={13} className="text-emerald-400" />
                    <span>WhatsApp del Paciente o Familiar Acompañante:</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Editable antes del envío</span>
                </div>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 5492615555555"
                  className="w-full text-xs p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Cuidados Generales y Pautas de Alarma (Colapsable o resumen) */}
              {cuidadosGenerales && (
                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <span className="font-bold text-slate-300 block">Cuidados & Reposo:</span>
                  <p className="line-clamp-2 italic">{cuidadosGenerales}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || generandoPreview || !textoIndicaciones}
              onClick={handleVerPreviewPdf}
              className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {generandoPreview ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
              <span>Previsualizar PDF</span>
            </button>

            <button
              type="button"
              disabled={loading || enviando || !textoIndicaciones || !telefono}
              onClick={handleEnviarWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition disabled:opacity-50"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>🚀 Enviar Indicaciones por WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
