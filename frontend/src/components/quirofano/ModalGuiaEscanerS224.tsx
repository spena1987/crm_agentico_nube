'use client'

import React, { useState } from 'react'
import {
  X,
  QrCode,
  Barcode,
  CheckCircle2,
  Volume2,
  Sparkles,
  Keyboard,
  Radio,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Copy,
  Info
} from 'lucide-react'
import { clasificarLecturaEscaneo, TipoClasificacionEscaneo } from '@/lib/gs1Parser'
import { reproducirBeepExito, reproducirBeepAlerta, reproducirBeepScan } from '@/lib/audioFeedback'
import { useSmartScannerEngine } from '@/hooks/useSmartScannerEngine'

interface ModalGuiaEscanerS224Props {
  isOpen: boolean
  onClose: () => void
}

export default function ModalGuiaEscanerS224({ isOpen, onClose }: ModalGuiaEscanerS224Props) {
  const [tabActiva, setTabActiva] = useState<'calibracion' | 'probador' | 'manual'>('calibracion')
  const [testInput, setTestInput] = useState('')
  const [historialPruebas, setHistorialPruebas] = useState<TipoClasificacionEscaneo[]>([])

  // Suscripción al escáner en tiempo real mientras el modal está abierto
  useSmartScannerEngine({
    enabled: isOpen,
    onScanGeneral: (resultado) => {
      setHistorialPruebas((prev) => [resultado, ...prev.slice(0, 7)])
      if (resultado.tipo === 'PULSERA_PACIENTE' || (resultado.tipo === 'LIO_DATAMATRIX' && resultado.gs1.esValido)) {
        reproducirBeepExito()
      } else {
        reproducirBeepAlerta()
      }
    }
  })

  if (!isOpen) return null

  const handleProbarManual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!testInput.trim()) return
    const res = clasificarLecturaEscaneo(testInput.trim())
    setHistorialPruebas((prev) => [res, ...prev.slice(0, 7)])
    setTestInput('')
    if (res.tipo === 'PULSERA_PACIENTE' || (res.tipo === 'LIO_DATAMATRIX' && res.gs1.esValido)) {
      reproducirBeepExito()
    } else {
      reproducirBeepAlerta()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fade-in text-[var(--foreground)]">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <QrCode size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Escáner ProSoft S224 • Guía & Calibración Quirúrgica</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  2.4 GHz HID
                </span>
              </h2>
              <p className="text-xs text-[var(--secondary)]">
                Configuración recomendada para lectura de pulseras QR y DataMatrix de Lentes Intraoculares (LIO).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas */}
        <div className="px-6 border-b border-[var(--border)] flex gap-4 bg-slate-50/30 dark:bg-slate-900/30">
          <button
            onClick={() => setTabActiva('calibracion')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              tabActiva === 'calibracion'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Radio size={14} />
            <span>Pasos de Calibración</span>
          </button>

          <button
            onClick={() => setTabActiva('probador')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              tabActiva === 'probador'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Sparkles size={14} />
            <span>Probador en Vivo con Audio</span>
            {historialPruebas.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-mono">
                {historialPruebas.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTabActiva('manual')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              tabActiva === 'manual'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Info size={14} />
            <span>Especificaciones del Manual</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
          {tabActiva === 'calibracion' && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
                <Info size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                  Para que el escáner inalámbrico funcione de forma óptima en Quirófano y Asesoría sin alterar caracteres especiales como paréntesis <code className="bg-blue-200/50 dark:bg-blue-900/50 px-1 py-0.5 rounded">()</code>, dos puntos <code className="bg-blue-200/50 dark:bg-blue-900/50 px-1 py-0.5 rounded">:</code> o barras <code className="bg-blue-200/50 dark:bg-blue-900/50 px-1 py-0.5 rounded">/</code>, escanee los siguientes códigos desde el <b>Manual de Usuario ProSoft S224</b> impreso:
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Paso 1 */}
                <div className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center font-mono">
                      1
                    </span>
                    <span className="text-xs font-bold text-[var(--foreground)]">Modo Estándar</span>
                  </div>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Pág. 3 del manual: Escanear código <b>"Modo Estándar (Sube datos al instante)"</b>.
                  </p>
                  <div className="text-[10px] font-mono bg-[var(--card)] p-2 rounded-xl border border-[var(--border)] text-center text-slate-600 dark:text-slate-400">
                    Transmisión inmediata en tiempo real vía dongle USB 2.4 GHz
                  </div>
                </div>

                {/* Paso 2 */}
                <div className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center font-mono">
                      2
                    </span>
                    <span className="text-xs font-bold text-[var(--foreground)]">Idioma Teclado</span>
                  </div>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Pág. 5 del manual: Escanear código <b>"Latinoamérica (Español)"</b>.
                  </p>
                  <div className="text-[10px] font-mono bg-[var(--card)] p-2 rounded-xl border border-[var(--border)] text-center text-slate-600 dark:text-slate-400">
                    Evita que los paréntesis () de los AIs de GS1 se conviertan en otros signos
                  </div>
                </div>

                {/* Paso 3 */}
                <div className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center font-mono">
                      3
                    </span>
                    <span className="text-xs font-bold text-[var(--foreground)]">Sufijo Enter (CR)</span>
                  </div>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Pág. 2 del manual: Escanear código <b>"Ingresar (CR)"</b>.
                  </p>
                  <div className="text-[10px] font-mono bg-[var(--card)] p-2 rounded-xl border border-[var(--border)] text-center text-slate-600 dark:text-slate-400">
                    Envía retorno de carro Enter al finalizar cada lectura óptica
                  </div>
                </div>
              </div>

              {/* Botones de audio test */}
              <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <Volume2 className="text-blue-500 shrink-0" size={18} />
                  <span>Prueba los tonos audibles de confirmación quirúrgica:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => reproducirBeepExito()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} />
                    <span>Tono Éxito (880-1760 Hz)</span>
                  </button>
                  <button
                    onClick={() => reproducirBeepAlerta()}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 transition flex items-center gap-1.5"
                  >
                    <AlertTriangle size={13} />
                    <span>Tono Alerta (330-220 Hz)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tabActiva === 'probador' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[var(--foreground)]">
                    Zona de Prueba Activa de Escaneo Manos Libres
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Dispara el ProSoft S224 a cualquier código. La pantalla capturará la ráfaga automáticamente.
                  </p>
                </div>
                {historialPruebas.length > 0 && (
                  <button
                    onClick={() => setHistorialPruebas([])}
                    className="text-xs text-[var(--secondary)] hover:text-[var(--foreground)] underline"
                  >
                    Limpiar historial
                  </button>
                )}
              </div>

              {/* Formulario de prueba manual */}
              <form onSubmit={handleProbarManual} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Pegar o escribir código para probar parser (ej: (01)00380658428867(17)281130... o MEDCRM:QX:...)"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-[var(--border)] rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Probar
                </button>
              </form>

              {/* Historial de lecturas capturadas */}
              <div className="space-y-2">
                {historialPruebas.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-[var(--border)] rounded-2xl text-xs text-[var(--secondary)]">
                    Esperando lectura del escáner... Puedes escanear una pulsera o un blister de LIO en este momento.
                  </div>
                ) : (
                  historialPruebas.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            item.tipo === 'PULSERA_PACIENTE'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : item.tipo === 'LIO_DATAMATRIX'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {item.tipo === 'PULSERA_PACIENTE' ? <QrCode size={16} /> : <Barcode size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--foreground)]">
                              {item.tipo === 'PULSERA_PACIENTE'
                                ? 'Pulsera Térmica de Paciente'
                                : item.tipo === 'LIO_DATAMATRIX'
                                ? 'Lente Intraocular (DataMatrix GS1)'
                                : 'Código de Barras 1D'}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.tipo}
                            </span>
                          </div>

                          {item.tipo === 'PULSERA_PACIENTE' && (
                            <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                              ID de Turno extraído: <code className="font-mono font-bold text-purple-600 dark:text-purple-400">{item.turnoId}</code>
                            </p>
                          )}

                          {item.tipo === 'LIO_DATAMATRIX' && (
                            <div className="text-[11px] text-[var(--secondary)] mt-0.5 space-x-2">
                              <span>GTIN: <b className="font-mono text-[var(--foreground)]">{item.gs1.gtin14 || item.gs1.gtin || 'N/A'}</b></span>
                              <span>• Lote: <b className="font-mono text-[var(--foreground)]">{item.gs1.lote || 'N/A'}</b></span>
                              <span>• Vto: <b className="font-mono text-[var(--foreground)]">{item.gs1.vencimiento || 'N/A'}</b></span>
                              <span>• Serie: <b className="font-mono text-[var(--foreground)]">{item.gs1.serie || 'N/A'}</b></span>
                            </div>
                          )}

                          <p className="text-[10px] text-slate-400 font-mono mt-1 truncate max-w-md">
                            RAW: {item.raw}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Lectura Correcta
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tabActiva === 'manual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5">
                  <span className="font-bold text-[var(--foreground)]">Modelo & Óptica</span>
                  <p className="text-[var(--secondary)]">ProSoft S224 Inalámbrico 2D (Receptor USB 2.4 GHz).</p>
                  <p className="text-[var(--secondary)]">Densidad óptica: ≥ 5 mil. Batería de 2000 mAh.</p>
                </div>
                <div className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5">
                  <span className="font-bold text-[var(--foreground)]">Simbologías Compatibles</span>
                  <p className="text-[var(--secondary)]">2D: QR Code (Pulseras), DataMatrix (LIOs), PDF417.</p>
                  <p className="text-[var(--secondary)]">1D: EAN-13, Code 128, GS1-128, UPC-A.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={16} />
                  <span>Recomendación de Seguridad en Quirófano</span>
                </div>
                <p className="text-amber-800 dark:text-amber-200 leading-relaxed text-[11px]">
                  El lector opera por emulación de teclado inalámbrico. Gracias al motor <b>useSmartScannerEngine</b> implementado en el CRM, el escaneo se captura en segundo plano sin importar en qué parte de la pantalla se encuentre el cursor, evitando que el personal deba quitarse los guantes o usar el ratón para hacer foco en un campo de texto.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-[var(--border)] flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <span className="text-[var(--secondary)]">
            Presiona <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px]">Esc</kbd> o el botón para cerrar.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold rounded-xl transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
