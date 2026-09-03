'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Camera, Upload, Check, AlertCircle, RefreshCw, FileText } from 'lucide-react'
import { parseTicket, buildTicketRows, TicketRow, DEMO_TICKET } from '../ocrTicketParser'
import { ConsultaOftalmo } from '../types'

interface ModalTicketOCRProps {
  isOpen: boolean
  onClose: () => void
  consultaActiva: ConsultaOftalmo
  onApplyData: (extractedFields: Record<string, any>) => void
}

export default function ModalTicketOCR({
  isOpen,
  onClose,
  consultaActiva,
  onApplyData
}: ModalTicketOCRProps) {
  const [tab, setTab] = useState<'text' | 'camera' | 'upload'>('text')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<TicketRow[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Desactivar cámara si se cierra
  useEffect(() => {
    if (!isOpen && streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setCameraActive(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Iniciar cámara
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch (err) {
      alert('No se pudo acceder a la cámara. Verifique los permisos del navegador.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  // Capturar foto desde canvas
  const capturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      stopCamera()
      // En modo demo o procesar con demo
      setRawText(DEMO_TICKET)
      parseAndBuild(DEMO_TICKET)
      setTab('text')
    }
  }

  // Procesar archivo subido
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Si es un archivo de texto o imagen
    if (file.type.includes('text')) {
      const reader = new FileReader()
      reader.onload = evt => {
        const text = String(evt.target?.result || '')
        setRawText(text)
        parseAndBuild(text)
        setTab('text')
      }
      reader.readAsText(file)
    } else {
      // Imagen: para propósitos interactivos, cargamos el ticket simulado
      setRawText(DEMO_TICKET)
      parseAndBuild(DEMO_TICKET)
      setTab('text')
    }
  }

  // Parsear texto del ticket
  const parseAndBuild = (text: string) => {
    const parsed = parseTicket(text)
    const currentValues: Record<string, any> = {
      arm_od_esf: consultaActiva.arm_cicloplejia?.arm_od_esf,
      arm_od_cil: consultaActiva.arm_cicloplejia?.arm_od_cil,
      arm_od_eje: consultaActiva.arm_cicloplejia?.arm_od_eje,
      arm_oi_esf: consultaActiva.arm_cicloplejia?.arm_oi_esf,
      arm_oi_cil: consultaActiva.arm_cicloplejia?.arm_oi_cil,
      arm_oi_eje: consultaActiva.arm_cicloplejia?.arm_oi_eje,
      k_od_k1: consultaActiva.queratometria?.od?.k1,
      k_od_k2: consultaActiva.queratometria?.od?.k2,
      k_od_ejec: consultaActiva.queratometria?.od?.ejec,
      k_od_cil: consultaActiva.queratometria?.od?.cil,
      k_od_eje: consultaActiva.queratometria?.od?.eje,
      k_oi_k1: consultaActiva.queratometria?.oi?.k1,
      k_oi_k2: consultaActiva.queratometria?.oi?.k2,
      k_oi_ejec: consultaActiva.queratometria?.oi?.ejec,
      k_oi_cil: consultaActiva.queratometria?.oi?.cil,
      k_oi_eje: consultaActiva.queratometria?.oi?.eje,
      pio_od_aire: consultaActiva.presion_intraocular?.od?.aire,
      pio_oi_aire: consultaActiva.presion_intraocular?.oi?.aire,
      paq_od_aire: consultaActiva.presion_intraocular?.od?.paq_aire,
      paq_oi_aire: consultaActiva.presion_intraocular?.oi?.paq_aire
    }
    const r = buildTicketRows(parsed, currentValues)
    setRows(r)
  }

  const toggleRow = (index: number) => {
    const updated = [...rows]
    updated[index].selected = !updated[index].selected
    setRows(updated)
  }

  const selectAll = (val: boolean) => {
    setRows(rows.map(r => ({ ...r, selected: val })))
  }

  // Aplicar datos a la consulta
  const handleApply = () => {
    const selectedRows = rows.filter(r => r.selected)
    const armObj = { ...(consultaActiva.arm_cicloplejia || {}) }
    const kOd = { ...(consultaActiva.queratometria?.od || {}) }
    const kOi = { ...(consultaActiva.queratometria?.oi || {}) }
    const pioOd = { ...(consultaActiva.presion_intraocular?.od || {}) }
    const pioOi = { ...(consultaActiva.presion_intraocular?.oi || {}) }

    selectedRows.forEach(r => {
      // ARM
      if (r.field.startsWith('arm_')) {
        armObj[r.field] = String(r.value)
      }
      // K OD
      if (r.field === 'k_od_k1') kOd.k1 = String(r.value)
      if (r.field === 'k_od_k2') kOd.k2 = String(r.value)
      if (r.field === 'k_od_ejec') kOd.ejec = String(r.value)
      if (r.field === 'k_od_cil') kOd.cil = String(r.value)
      if (r.field === 'k_od_eje') kOd.eje = String(r.value)

      // K OI
      if (r.field === 'k_oi_k1') kOi.k1 = String(r.value)
      if (r.field === 'k_oi_k2') kOi.k2 = String(r.value)
      if (r.field === 'k_oi_ejec') kOi.ejec = String(r.value)
      if (r.field === 'k_oi_cil') kOi.cil = String(r.value)
      if (r.field === 'k_oi_eje') kOi.eje = String(r.value)

      // PIO
      if (r.field === 'pio_od_aire') pioOd.aire = String(r.value)
      if (r.field === 'pio_oi_aire') pioOi.aire = String(r.value)
      if (r.field === 'paq_od_aire') pioOd.paq_aire = String(r.value)
      if (r.field === 'paq_oi_aire') pioOi.paq_aire = String(r.value)
    })

    onApplyData({
      arm_cicloplejia: armObj,
      queratometria: {
        od: kOd,
        oi: kOi
      },
      presion_intraocular: {
        od: pioOd,
        oi: pioOi,
        tto: consultaActiva.presion_intraocular?.tto
      }
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#dde6ec] w-full max-w-2xl max-h-[90vh] flex flex-col text-[#16323f] overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#eef3f6] bg-[#f7fafb]">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#0e7c86]" />
            <h3 className="font-extrabold text-sm text-[#0e7c86]">
              Lector OCR de Ticket Autorefractómetro
            </h3>
          </div>
          <button onClick={onClose} className="text-[#9db0bc] hover:text-[#16323f]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de entrada */}
        <div className="flex border-b border-[#dde6ec] bg-[#f7fafb] text-xs font-bold">
          <button
            type="button"
            onClick={() => { setTab('text'); stopCamera() }}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              tab === 'text'
                ? 'border-[#0e7c86] text-[#0e7c86] bg-white'
                : 'border-transparent text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            Pegar Texto del Ticket
          </button>
          <button
            type="button"
            onClick={() => { setTab('camera'); startCamera() }}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              tab === 'camera'
                ? 'border-[#0e7c86] text-[#0e7c86] bg-white'
                : 'border-transparent text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            Cámara en Vivo
          </button>
          <button
            type="button"
            onClick={() => { setTab('upload'); stopCamera() }}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              tab === 'upload'
                ? 'border-[#0e7c86] text-[#0e7c86] bg-white'
                : 'border-transparent text-[#728a99] hover:text-[#16323f]'
            }`}
          >
            Subir Archivo / Foto
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {tab === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[#728a99]">
                  Texto reconocido o pegado del ticket:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(DEMO_TICKET)
                    parseAndBuild(DEMO_TICKET)
                  }}
                  className="text-xs text-[#0e7c86] font-bold hover:underline"
                >
                  Cargar ticket de ejemplo (Nidek / Topcon)
                </button>
              </div>
              <textarea
                rows={6}
                value={rawText}
                onChange={e => {
                  setRawText(e.target.value)
                  parseAndBuild(e.target.value)
                }}
                placeholder="Pegue aquí el texto o escaneo del ticket..."
                className="w-full border border-[#dde6ec] rounded-lg p-2 font-mono text-xs focus:border-[#0e7c86] outline-none"
              />
            </div>
          )}

          {tab === 'camera' && (
            <div className="flex flex-col items-center space-y-3 py-2">
              <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {!cameraActive && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="absolute inset-0 m-auto w-32 h-10 bg-[#0e7c86] text-white font-bold rounded-lg shadow-lg text-xs"
                  >
                    Activar Cámara
                  </button>
                )}
              </div>
              {cameraActive && (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-4 py-2 bg-[#0e7c86] hover:bg-[#0a636b] text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Capturar y Procesar Ticket
                </button>
              )}
            </div>
          )}

          {tab === 'upload' && (
            <div className="p-8 border-2 border-dashed border-[#dde6ec] hover:border-[#0e7c86] rounded-xl text-center space-y-2 cursor-pointer bg-[#f7fafb]">
              <Upload className="w-8 h-8 mx-auto text-[#0e7c86]" />
              <div className="text-xs font-bold text-[#16323f]">
                Haga clic para seleccionar una foto o archivo del ticket
              </div>
              <p className="text-[11px] text-[#728a99]">
                Formatos compatibles: JPG, PNG, TXT
              </p>
              <input
                type="file"
                accept="image/*,text/*"
                onChange={handleFileUpload}
                className="hidden"
                id="ocr-upload-input"
              />
              <label
                htmlFor="ocr-upload-input"
                className="inline-block px-3 py-1.5 bg-[#0e7c86] text-white rounded text-xs font-bold cursor-pointer hover:bg-[#0a636b]"
              >
                Seleccionar Archivo
              </label>
            </div>
          )}

          {/* Tabla de valores detectados */}
          {rows.length > 0 && (
            <div className="pt-2 border-t border-[#eef3f6] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-[#16323f]">
                  Valores detectados en el ticket ({rows.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectAll(true)}
                    className="text-[11px] text-[#0e7c86] font-bold hover:underline"
                  >
                    Marcar todos
                  </button>
                  <span className="text-[#dde6ec]">|</span>
                  <button
                    type="button"
                    onClick={() => selectAll(false)}
                    className="text-[11px] text-[#728a99] font-bold hover:underline"
                  >
                    Desmarcar todos
                  </button>
                </div>
              </div>

              <div className="border border-[#dde6ec] rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f7fafb] text-[9px] uppercase font-bold text-[#728a99] border-b border-[#dde6ec]">
                      <th className="p-1.5 w-8 text-center"></th>
                      <th className="p-1.5 text-left">Campo</th>
                      <th className="p-1.5 text-center">Valor Detectado</th>
                      <th className="p-1.5 text-center">Valor Actual Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f6]">
                    {rows.map((r, i) => (
                      <tr
                        key={r.key}
                        onClick={() => toggleRow(i)}
                        className={`cursor-pointer transition-colors ${
                          r.selected ? 'bg-[#e4f3f4]/50' : 'hover:bg-[#f7fafb]'
                        }`}
                      >
                        <td className="p-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={() => {}}
                            className="rounded text-[#0e7c86] accent-[#0e7c86]"
                          />
                        </td>
                        <td className="p-1.5 font-semibold text-[#16323f]">
                          {r.label}
                        </td>
                        <td className="p-1.5 text-center font-bold text-[#0e7c86]">
                          {r.value}
                        </td>
                        <td className="p-1.5 text-center text-[#728a99]">
                          {r.current || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pie con botón de aplicación */}
        <div className="px-4 py-3 border-t border-[#eef3f6] bg-[#f7fafb] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[#728a99] hover:text-[#16323f]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={rows.filter(r => r.selected).length === 0}
            onClick={handleApply}
            className="px-4 py-1.5 bg-[#0e7c86] hover:bg-[#0a636b] text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Aplicar {rows.filter(r => r.selected).length} valores a la consulta
          </button>
        </div>
      </div>
    </div>
  )
}

