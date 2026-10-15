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
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react'
import QRCode from 'qrcode'
import { BACKEND_URL, apiFetch } from '@/lib/api'

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
  const [mostrarGuiaKiosk, setMostrarGuiaKiosk] = useState<boolean>(false)
  const [copiado, setCopiado] = useState<boolean>(false)

  const comandoKiosk = `chrome.exe --app="https://crm-agentico-nube.vercel.app/asesoramiento-recepcion" --kiosk-printing --user-data-dir="C:\\MedCRM_Kiosk"`

  const handleCopiarComando = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(comandoKiosk)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  // Cargar datos consolidados para la pulsera
  useEffect(() => {
    if (!isOpen || !turnoId) return

    const cargarDatos = async () => {
      try {
        setCargando(true)
        setError(null)
        const res = await apiFetch(`/api/turnos-quirofano/${turnoId}/datos-pulsera`)
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
        await apiFetch(`/api/turnos-quirofano/${turnoId}/marcar-pulsera-impresa`, {
          method: 'POST',
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
                    TSC TDP-225 • ArgusID® ProBand (240x25 mm)
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
                    <span>Vista Previa de la Pulsera (Zona Térmica Imprimible 150mm x 25mm):</span>
                    <span className="font-mono text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      ArgusID® ProBand (24 cm x 2.5 cm)
                    </span>
                  </div>

                  {/* Simulación Gráfica de la Pulsera Real ArgusID ProBand */}
                  <div className="p-4 bg-neutral-950 rounded-2xl border border-gray-800 overflow-x-auto flex items-center justify-center">
                    <div className="flex items-center select-none">
                      
                      {/* Cuerpo Imprimible Blanco (150mm x 25mm) */}
                      <div className="w-[590px] h-[115px] bg-white text-black rounded-l-lg shadow-xl p-2.5 flex items-center gap-3 border border-gray-400 relative font-sans">
                        
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
                                <span className="font-mono bg-black text-white px-1 py-0.5 rounded text-[10px] mr-1.5">{cir.codigo_turno || cir.codigo_caso || 'QX-26-0012-OD'}</span>
                                {pac.nombre}
                              </h4>
                              <p className="text-[9px] font-bold text-gray-800 font-mono">
                                DNI: {pac.dni} {pac.edad && `• ${pac.edad}`} {pac.obra_social && `• ${pac.obra_social}`}
                              </p>
                            </div>

                            {/* Badge de Ojo de Alto Impacto */}
                            <div className="px-2 py-1 rounded text-[10px] font-black tracking-wider text-white shrink-0 uppercase bg-black">
                              {cir.ojo_texto}
                            </div>
                          </div>

                          {/* Fila 2: Práctica y Cirujano */}
                          <div className="text-[9px] text-gray-900 font-extrabold truncate">
                            {cir.practica_nombre} • <span className="font-semibold text-gray-700">Cirujano:</span> <strong className="text-black">{cir.cirujano_nombre}</strong> {cir.quirofano_nombre && `(${cir.quirofano_nombre})`}
                          </div>

                          {/* Fila 3: LIO & Alergias */}
                          <div className="flex items-center justify-between text-[8.5px] font-bold pt-0.5 border-t border-black/10">
                            <span className="text-blue-900 truncate max-w-[320px]">
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

                      {/* Tira / Extensión de Sujeción ArgusID® (140mm con cierre y broche) */}
                      <div className="w-[140px] h-[95px] bg-neutral-800/80 border-y border-r border-dashed border-gray-600 rounded-r-xl flex flex-col items-center justify-center p-2 text-center text-gray-400 gap-1.5 shadow-inner">
                        <span className="text-[9px] font-mono font-bold text-gray-300 uppercase tracking-wider">ArgusID® ProBand</span>
                        <div className="flex items-center gap-1.5 opacity-60">
                          <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />
                          <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />
                          <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />
                          <div className="w-2.5 h-2.5 rounded-full border border-gray-400" />
                        </div>
                        <span className="text-[7.5px] text-gray-400 leading-none">Tira de 24 cm con cierre inviolable</span>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Panel de Ayuda y Modo Kiosk */}
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-gray-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-amber-400" />
                      <span className="font-bold text-white">Impresión Silenciosa Instantánea (Modo Kiosk)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMostrarGuiaKiosk(!mostrarGuiaKiosk)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                    >
                      <span>{mostrarGuiaKiosk ? 'Ocultar Guía' : 'Ver Guía de Configuración'}</span>
                      {mostrarGuiaKiosk ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Al confirmar, el CRM disparará la impresión directa hacia la <strong>TSC TDP-225</strong>. 
                    Si la PC está en modo Kiosk, la pulsera saldrá al instante sin cuadros de diálogo.
                  </p>

                  {mostrarGuiaKiosk && (
                    <div className="mt-3 p-3 bg-neutral-900/90 rounded-lg border border-blue-500/20 space-y-3 text-[11px] text-gray-300 animate-in fade-in duration-150">
                      <div>
                        <p className="font-bold text-white mb-1">1. Calibración en Windows (Driver TSC TDP-225):</p>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-300 pl-1">
                          <li>Abrir <em>Preferencias de Impresión</em> de la TSC TDP-225.</li>
                          <li>Crear tamaño personalizado: <strong>Ancho: 25.0 mm • Alto: 240.0 mm</strong> (o 24 cm).</li>
                          <li>Sensor: <em>Marca Negra (Black Mark) o Separación</em> • Márgenes: <em>0 mm</em>.</li>
                        </ul>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-white">2. Acceso directo de 1-Clic (Sin diálogo de confirmación):</p>
                          <button
                            type="button"
                            onClick={handleCopiarComando}
                            className="text-[10px] px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded border border-blue-500/30 flex items-center gap-1 transition"
                          >
                            {copiado ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>{copiado ? '¡Copiado!' : 'Copiar comando'}</span>
                          </button>
                        </div>
                        <div className="p-2 bg-black rounded font-mono text-[10px] text-gray-300 break-all select-all border border-gray-800">
                          {comandoKiosk}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Cree un acceso directo en el escritorio de Windows con este comando para abrir el CRM con impresión silenciosa directa.
                        </p>
                      </div>
                    </div>
                  )}
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
                    [{cir.codigo_turno || cir.codigo_caso || 'QX-26-0012-OD'}] {pac.nombre}
                  </div>
                  <div className="wristband-ojo-badge">
                    {cir.ojo_texto}
                  </div>
                </div>

                {/* Subtítulo DNI y Edad */}
                <div className="wristband-sub-info">
                  DNI: {pac.dni} {pac.edad && `• ${pac.edad}`} {pac.obra_social && `• ${pac.obra_social}`}
                </div>

                {/* Práctica y Cirujano en línea amplia */}
                <div className="wristband-practica-text">
                  {cir.practica_nombre} • Cirujano: {cir.cirujano_nombre} {cir.quirofano_nombre && `(${cir.quirofano_nombre})`}
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
            size: 240mm 25mm landscape;
            margin: 0 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 240mm !important;
            height: 25mm !important;
            overflow: hidden !important;
            background: #FFFFFF !important;
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
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 240mm !important;
            height: 25mm !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          .wristband-container {
            width: 240mm;
            height: 25mm;
            display: flex;
            align-items: center;
            padding-left: 6mm;
            box-sizing: border-box;
          }

          /* ÁREA IMPRIMIBLE AMPLIADA A 150 MM Y ALTO MAXIMIZADO A 24 MM */
          .wristband-printable-body {
            width: 150mm;
            height: 24mm;
            border: 1pt solid #000000;
            border-radius: 2pt;
            display: flex;
            align-items: center;
            padding: 1.2mm 2.5mm;
            gap: 3mm;
            box-sizing: border-box;
            background: #FFFFFF;
          }

          .wristband-qr-box {
            width: 20mm;
            height: 20mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .wristband-qr-img {
            width: 18mm;
            height: 18mm;
            object-fit: contain;
            image-rendering: pixelated;
          }

          .wristband-qr-label {
            font-size: 4.5pt;
            font-family: monospace;
            font-weight: 900;
            color: #000000;
            line-height: 1;
            margin-top: 0.5mm;
          }

          .wristband-info-box {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
            overflow: hidden;
            line-height: 1.15;
          }

          .wristband-row-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 0.6pt solid #000000;
            padding-bottom: 0.4mm;
          }

          /* NOMBRE EN 8.5PT CON HASTA 95 MM DE ANCHO (NUNCA SE RECORTA) */
          .wristband-paciente-title {
            font-size: 8.5pt;
            font-weight: 900;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 95mm;
            color: #000000;
            font-family: Arial, sans-serif;
          }

          .wristband-ojo-badge {
            background: #000000 !important;
            color: #FFFFFF !important;
            font-size: 7.5pt;
            font-weight: 900;
            padding: 0.5mm 2mm;
            border-radius: 2pt;
            white-space: nowrap;
            font-family: Arial, sans-serif;
          }

          .wristband-sub-info {
            font-size: 6pt;
            font-weight: 700;
            color: #000000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: Arial, sans-serif;
          }

          .wristband-practica-text {
            font-size: 6.5pt;
            font-weight: 800;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #000000;
            font-family: Arial, sans-serif;
          }

          .wristband-bottom-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 6pt;
            font-weight: 800;
            border-top: 0.6pt solid #000000;
            padding-top: 0.4mm;
            color: #000000;
            font-family: Arial, sans-serif;
          }

          .wristband-lio-text {
            color: #000000;
            font-weight: 800;
            max-width: 80mm;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .wristband-alergias-text {
            color: #000000;
            font-weight: 900;
            text-transform: uppercase;
            white-space: nowrap;
          }
        }
      `}</style>
    </>
  )
}
