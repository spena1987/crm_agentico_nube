'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Printer,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Eye,
  ShieldCheck,
  Stethoscope,
  Info
} from 'lucide-react'
import QRCode from 'qrcode'
import { BACKEND_URL } from '@/lib/api'

interface ModalImprimirPulseraProps {
  isOpen: boolean
  onClose: () => void
  turnoId: string
  onPulseraImpresa?: () => void
}

export default function ModalImprimirPulsera({
  isOpen,
  onClose,
  turnoId,
  onPulseraImpresa
}: ModalImprimirPulseraProps) {
  const [cargando, setCargando] = useState<boolean>(true)
  const [imprimiendo, setImprimiendo] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<any>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  // Cargar datos consolidados para la pulsera
  useEffect(() => {
    if (!isOpen || !turnoId) return

    const cargarDatos = async () => {
      try {
        setCargando(true)
        setError(null)
        const res = await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/datos-pulsera`)
        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.detail || data.error || 'No se pudieron obtener los datos de la pulsera.')
        }

        setDatos(data)

        // Generar QR en alta resolución vectorial
        const qrUrl = await QRCode.toDataURL(data.qr_payload || `MEDCRM:QX:${turnoId}`, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 250,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        setQrDataUrl(qrUrl)
      } catch (err: any) {
        console.error('Error cargando pulsera:', err)
        setError(err.message || 'Error al preparar la pulsera térmica.')
      } finally {
        setCargando(false)
      }
    }

    cargarDatos()
  }, [isOpen, turnoId])

  // Disparar impresión nativa del navegador calibrada para TSC TDP-225 (29mm x 290mm)
  const handleImprimir = async () => {
    try {
      setImprimiendo(true)

      // 1. Notificar al backend que se imprimió la pulsera
      try {
        await fetch(`${BACKEND_URL}/api/turnos-quirofano/${turnoId}/marcar-pulsera-impresa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario_crm: 'Operador Recepción' })
        })
      } catch (e) {
        console.warn('Aviso registrando impresión en backend:', e)
      }

      if (onPulseraImpresa) {
        onPulseraImpresa()
      }

      // 2. Disparar impresión nativa de Windows con los estilos CSS @media print
      window.print()
    } catch (err: any) {
      console.error('Error al imprimir pulsera:', err)
    } finally {
      setImprimiendo(false)
    }
  }

  if (!isOpen) return null

  const pac = datos?.paciente || {}
  const cir = datos?.cirugia || {}
  const ojo = cir.ojo || 'OD'
  const esOD = ojo === 'OD'
  const esOI = ojo === 'OI'
  const esAO = ojo === 'AO'

  return (
    <>
      {/* ==================================================================== */}
      {/* 1. MODAL EN PANTALLA (PREVIEW INTERACTIVO PARA EL OPERADOR) */}
      {/* ==================================================================== */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200 no-print">
        <div className="bg-neutral-900 border border-blue-500/30 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header del Modal */}
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-neutral-950/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-inner">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Impresión de Pulsera Térmica Quirúrgica
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40">
                    TSC TDP-225 (2 Pulgadas)
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Identificación Inequívoca del Paciente & Trazabilidad Quirúrgica con Código QR
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Cuerpo del Modal */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            {cargando ? (
              <div className="p-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                <Loader2 size={28} className="animate-spin text-blue-400" />
                <span>Generando datos clínicos y código QR de seguridad...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <>
                {/* Alerta de Seguridad de Paciente */}
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-start gap-2.5 text-xs text-blue-200">
                  <ShieldCheck size={18} className="text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">Verificación Pre-Impresión (Time-Out OMS):</p>
                    <p className="text-[11px] text-blue-300/80">
                      Verifique que la lateralidad del <strong>Ojo ({ojo})</strong> y el <strong>LIO Asignado</strong> coincidan con el parte quirúrgico antes de colocar la pulsera en la muñeca del paciente.
                    </p>
                  </div>
                </div>

                {/* VISTA PREVIA VISUAL DE LA PULSERA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                    <span>Vista Previa de la Pulsera (Zona Imprimible Central 100mm x 25mm):</span>
                    <span className="font-mono text-[10px] text-blue-400">29 mm x 290 mm</span>
                  </div>

                  {/* Simulación Gráfica de la Pulsera */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-gray-800 overflow-x-auto flex items-center justify-center">
                    <div className="w-[580px] h-[115px] bg-white text-black rounded-lg shadow-xl p-2.5 flex items-center gap-3 border border-gray-300 select-none relative font-sans">
                      
                      {/* Código QR */}
                      <div className="shrink-0 flex flex-col items-center justify-center">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="QR Trazabilidad" className="w-[90px] h-[90px] object-contain" />
                        ) : (
                          <div className="w-[90px] h-[90px] bg-gray-200 animate-pulse rounded" />
                        )}
                        <span className="text-[8px] font-mono font-bold text-gray-700 tracking-tighter">MEDCRM-QX</span>
                      </div>

                      {/* Información Clínica */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5 leading-tight">
                        
                        {/* Fila 1: Nombre y Ojo */}
                        <div className="flex items-start justify-between gap-1 border-b border-black/20 pb-1">
                          <div className="min-w-0">
                            <h4 className="text-xs font-black uppercase text-black truncate tracking-tight">
                              {pac.nombre}
                            </h4>
                            <p className="text-[9px] font-bold text-gray-800 font-mono">
                              DNI: {pac.dni} {pac.edad && `• ${pac.edad}`} {pac.obra_social && `• ${pac.obra_social}`}
                            </p>
                          </div>

                          {/* Badge de Ojo de Alto Impacto */}
                          <div className={`px-2 py-1 rounded text-[10px] font-black tracking-wider text-white shrink-0 uppercase ${
                            esOD ? 'bg-black' : esOI ? 'bg-black' : 'bg-black'
                          }`}>
                            {cir.ojo_texto}
                          </div>
                        </div>

                        {/* Fila 2: Práctica y Cirujano */}
                        <div className="space-y-0.5 text-[9px] text-gray-900">
                          <p className="font-extrabold truncate">
                            {cir.practica_nombre}
                          </p>
                          <p className="font-semibold text-gray-700">
                            Cirujano: <strong className="text-black">{cir.cirujano_nombre}</strong> • {cir.quirofano_nombre}
                          </p>
                        </div>

                        {/* Fila 3: LIO & Alergias */}
                        <div className="flex items-center justify-between text-[8.5px] font-bold pt-0.5 border-t border-black/10">
                          <span className="text-blue-900 truncate max-w-[280px]">
                            {cir.lleva_lente && cir.lente_tipo
                              ? `LIO: ${cir.lente_tipo} (${cir.lente_dioptria || ''} D)`
                              : 'No requiere LIO'}
                          </span>
                          <span className="text-red-700 font-extrabold uppercase truncate">
                            {pac.alergias && pac.alergias !== 'Sin alergias declaradas' ? `ALERGIA: ${pac.alergias}` : 'SIN ALERGIAS'}
                          </span>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {/* Guía de Configuración Rápida para el Driver TSC */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-gray-800 text-[11px] text-gray-400 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-gray-300">
                    <Info size={13} className="text-blue-400" />
                    <span>Configuración en el diálogo de impresión de Windows:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-gray-400 pl-1 text-[10.5px]">
                    <li>Seleccionar destino: <strong>TSC TDP-225 (o TDP-225W)</strong>.</li>
                    <li>Tamaño de papel / etiqueta: <strong>Pulsera 29 mm x 290 mm (o 1" x 11")</strong>.</li>
                    <li>Márgenes: <strong>Ninguno (0 mm)</strong> • Escala: <strong>Ajustar al área de impresión</strong>.</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Footer de Acciones */}
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-neutral-950/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={cargando || !!error || imprimiendo}
              onClick={handleImprimir}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {imprimiendo ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              <span>Imprimir Pulsera Térmica</span>
            </button>
          </div>

        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. ÁREA DE IMPRESIÓN TÉRMICA ESTRICTA (SOLO VISIBLE AL IMPRIMIR) */}
      {/* ==================================================================== */}
      <div id="thermal-wristband-print-area" className="only-print">
        {datos && (
          <div className="wristband-container">
            <div className="wristband-printable-body">
              {/* Código QR de Alta Definición */}
              <div className="wristband-qr-box">
                {qrDataUrl && <img src={qrDataUrl} alt="QR" className="wristband-qr-img" />}
                <span className="wristband-qr-label">MEDCRM</span>
              </div>

              {/* Contenido Clínico Vectorial */}
              <div className="wristband-info-box">
                {/* Nombre y Ojo */}
                <div className="wristband-row-header">
                  <div className="wristband-paciente-title">
                    {pac.nombre}
                  </div>
                  <div className="wristband-ojo-badge">
                    {cir.ojo_texto}
                  </div>
                </div>

                {/* Subtítulo DNI y Edad */}
                <div className="wristband-sub-info">
                  DNI: {pac.dni} {pac.edad && `• ${pac.edad}`} {pac.obra_social && `• ${pac.obra_social}`}
                </div>

                {/* Práctica y Cirujano */}
                <div className="wristband-practica-text">
                  {cir.practica_nombre}
                </div>

                <div className="wristband-doctor-text">
                  Cirujano: {cir.cirujano_nombre} • {cir.quirofano_nombre}
                </div>

                {/* LIO y Alergias */}
                <div className="wristband-bottom-row">
                  <span className="wristband-lio-text">
                    {cir.lleva_lente && cir.lente_tipo ? `LIO: ${cir.lente_tipo} (${cir.lente_dioptria || ''} D)` : 'Sin LIO'}
                  </span>
                  <span className="wristband-alergias-text">
                    {pac.alergias && pac.alergias !== 'Sin alergias declaradas' ? `ALERGIAS: ${pac.alergias}` : 'SIN ALERGIAS'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ESTILOS CSS ESTRICTOS PARA IMPRESIÓN TÉRMICA */}
      <style jsx global>{`
        @media screen {
          .only-print {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: 29mm 290mm landscape;
            margin: 0 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .no-print, .no-print * {
            display: none !important;
          }

          #thermal-wristband-print-area, #thermal-wristband-print-area * {
            visibility: visible !important;
          }

          #thermal-wristband-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 290mm !important;
            height: 29mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .wristband-container {
            width: 290mm;
            height: 29mm;
            display: flex;
            align-items: center;
            padding-left: 20mm;
            box-sizing: border-box;
          }

          .wristband-printable-body {
            width: 110mm;
            height: 26mm;
            border: 1.5pt solid black;
            border-radius: 4pt;
            display: flex;
            align-items: center;
            padding: 2mm 3mm;
            gap: 3mm;
            box-sizing: border-box;
            background: white;
          }

          .wristband-qr-box {
            width: 22mm;
            height: 22mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            shrink: 0;
          }

          .wristband-qr-img {
            width: 19mm;
            height: 19mm;
            object-fit: contain;
          }

          .wristband-qr-label {
            font-size: 5pt;
            font-family: monospace;
            font-weight: 900;
          }

          .wristband-info-box {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
            overflow: hidden;
            line-height: 1.1;
          }

          .wristband-row-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 0.5pt solid black;
            padding-bottom: 0.5mm;
          }

          .wristband-paciente-title {
            font-size: 8pt;
            font-weight: 900;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 60mm;
          }

          .wristband-ojo-badge {
            background: black !important;
            color: white !important;
            font-size: 7.5pt;
            font-weight: 900;
            padding: 0.5mm 1.5mm;
            border-radius: 2pt;
            white-space: nowrap;
          }

          .wristband-sub-info {
            font-size: 6pt;
            font-weight: 700;
            color: #222;
          }

          .wristband-practica-text {
            font-size: 6.5pt;
            font-weight: 800;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .wristband-doctor-text {
            font-size: 5.5pt;
            font-weight: 600;
            color: #333;
          }

          .wristband-bottom-row {
            display: flex;
            justify-content: space-between;
            font-size: 5.5pt;
            font-weight: 800;
            border-top: 0.5pt solid #888;
            padding-top: 0.5mm;
          }

          .wristband-lio-text {
            color: #000;
          }

          .wristband-alergias-text {
            color: #000;
            font-weight: 900;
          }
        }
      `}</style>
    </>
  )
}
