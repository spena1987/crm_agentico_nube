'use client'

import React, { useState } from 'react'
import { Calculator, X, Sparkles, Check, Copy, HelpCircle, Eye } from 'lucide-react'
import { calcularSRKT, ResultadoSRKT } from '@/lib/biometria/srkt'

interface ModalAsistenteSRKTProps {
  abierto: boolean
  onCerrar: () => void
  constanteAInicial?: number
  onAplicarDioptria?: (dioptria: string) => void
}

export default function ModalAsistenteSRKT({
  abierto,
  onCerrar,
  constanteAInicial = 118.9,
  onAplicarDioptria
}: ModalAsistenteSRKTProps) {
  const [al, setAl] = useState<string>('23.50')
  const [k1, setK1] = useState<string>('43.50')
  const [k2, setK2] = useState<string>('44.00')
  const [constanteA, setConstanteA] = useState<string>(String(constanteAInicial))
  const [target, setTarget] = useState<number>(-0.25)
  const [resultado, setResultado] = useState<ResultadoSRKT | null>(null)
  const [copiado, setCopiado] = useState<boolean>(false)

  if (!abierto) return null

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault()
    const numAL = parseFloat(al)
    const numK1 = parseFloat(k1)
    const numK2 = parseFloat(k2)
    const numA = parseFloat(constanteA)

    if (isNaN(numAL) || isNaN(numK1) || isNaN(numK2) || isNaN(numA)) {
      alert('Por favor completa todos los parámetros con valores numéricos válidos.')
      return
    }

    const res = calcularSRKT({
      longitudAxial: numAL,
      k1: numK1,
      k2: numK2,
      constanteA: numA,
      targetRefractivo: target
    })

    setResultado(res)
  }

  const handleCopiarOpcion = (diop: number) => {
    const txt = diop >= 0 ? `+${diop.toFixed(2)}` : diop.toFixed(2)
    if (onAplicarDioptria) {
      onAplicarDioptria(txt)
      onCerrar()
    } else {
      navigator.clipboard.writeText(txt)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--foreground)] flex items-center gap-2">
                <span>Calculadora Asistida de Biometría (SRK/T)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] font-bold">
                  Consulta Manual
                </span>
              </h3>
              <p className="text-[11px] text-[var(--secondary)]">
                Fórmula teórica estándar de Sanders, Retzlaff y Kraff para verificación refractiva.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCalcular} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)]">Longitud Axial (AL mm)</label>
              <input
                type="number"
                step="0.01"
                min="18.0"
                max="36.0"
                value={al}
                onChange={(e) => setAl(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-mono font-black text-center"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)]">K1 (Dioptrías)</label>
              <input
                type="number"
                step="0.01"
                min="30.0"
                max="60.0"
                value={k1}
                onChange={(e) => setK1(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-mono font-black text-center"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)]">K2 (Dioptrías)</label>
              <input
                type="number"
                step="0.01"
                min="30.0"
                max="60.0"
                value={k2}
                onChange={(e) => setK2(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-mono font-black text-center"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--secondary)]">Constante A</label>
              <input
                type="number"
                step="0.01"
                value={constanteA}
                onChange={(e) => setConstanteA(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-mono font-black text-center text-cyan-600"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[var(--secondary)] text-[11px]">Target Refractivo:</span>
              <select
                value={target}
                onChange={(e) => setTarget(parseFloat(e.target.value))}
                className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-bold text-[var(--foreground)] outline-none"
              >
                <option value={0.0}>0.00 D (Emetropía)</option>
                <option value={-0.25}>-0.25 D (Miopía Leve)</option>
                <option value={-0.50}>-0.50 D (Micro-monovisión)</option>
                <option value={-0.75}>-0.75 D</option>
                <option value={-1.00}>-1.00 D (Monovisión)</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles size={14} />
              <span>Calcular Fórmula</span>
            </button>
          </div>
        </form>

        {resultado && (
          <div className="space-y-3 pt-2 border-t border-[var(--border)] animate-fade-in">
            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
              <div>
                <span className="text-[10px] text-[var(--secondary)] block">K Medio</span>
                <span className="text-xs font-mono font-black text-[var(--foreground)]">{resultado.kMedio} D</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--secondary)] block">Poder Emetropía</span>
                <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">+{resultado.poderEmetropia} D</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--secondary)] block">Dioptría Sugerida</span>
                <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">+{resultado.dioptriaSugerida.toFixed(2)} D</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[var(--secondary)] block">
                Tabla de Poderes y Refracción Residual Post-Qx (Haz clic para usar o copiar):
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {resultado.tablaOpciones.map((opt) => {
                  const esSugerida = opt.dioptria === resultado.dioptriaSugerida
                  return (
                    <button
                      key={opt.dioptria}
                      type="button"
                      onClick={() => handleCopiarOpcion(opt.dioptria)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between ${
                        esSugerida
                          ? 'bg-emerald-500/20 border-emerald-500 ring-1 ring-emerald-500/30'
                          : 'bg-[var(--background)] border-[var(--border)] hover:border-cyan-400'
                      }`}
                    >
                      <span className="text-xs font-mono font-black text-[var(--foreground)]">
                        +{opt.dioptria.toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-mono font-bold mt-0.5 ${
                        opt.refraccionResidual < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
                      }`}>
                        {opt.refraccionResidual >= 0 ? `+${opt.refraccionResidual.toFixed(2)}` : opt.refraccionResidual.toFixed(2)} D
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {copiado && (
              <p className="text-[11px] text-emerald-600 font-bold text-center animate-fade-in">
                ✔ Dioptría copiada al portapapeles.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
