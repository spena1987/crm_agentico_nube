'use client'

import React from 'react'
import { CheckCircle2, Clock, Receipt, Wallet } from 'lucide-react'

interface CasoPagosWidgetProps {
  totalArs?: number
  totalUsd?: number
  senaArs?: number
  senaUsd?: number
  montoTotalFallback?: number
  monedaFallback?: string
  montoSenaFallback?: number
  estadoPago: 'pendiente' | 'seniado' | 'totalmente_cobrado'
  medioPago?: string | null
  disabled?: boolean
  onChange: (data: {
    senaArs: number
    senaUsd: number
    montoSenaTotal: number
    estadoPago: 'pendiente' | 'seniado' | 'totalmente_cobrado'
    medioPago?: string | null
  }) => void
}

const MEDIOS_PAGO = [
  'Transferencia Bancaria',
  'Efectivo',
  'Tarjeta Débito',
  'Tarjeta Crédito',
  'Cobertura Prepaga',
  'Otro'
]

export default function CasoPagosWidget({
  totalArs,
  totalUsd,
  senaArs,
  senaUsd,
  montoTotalFallback,
  monedaFallback = 'ARS',
  montoSenaFallback,
  estadoPago,
  medioPago,
  disabled = false,
  onChange
}: CasoPagosWidgetProps) {
  // 1. Normalización de Totales y Señas (Soporte Multimoneda)
  const isFallbackUsd = monedaFallback === 'USD'
  
  const tArs = Number(
    totalArs !== undefined 
      ? totalArs 
      : (!isFallbackUsd ? (montoTotalFallback || 0) : 0)
  )
  const tUsd = Number(
    totalUsd !== undefined 
      ? totalUsd 
      : (isFallbackUsd ? (montoTotalFallback || 0) : 0)
  )

  const sArs = Number(
    senaArs !== undefined 
      ? senaArs 
      : (!isFallbackUsd ? (montoSenaFallback || 0) : 0)
  )
  const sUsd = Number(
    senaUsd !== undefined 
      ? senaUsd 
      : (isFallbackUsd ? (montoSenaFallback || 0) : 0)
  )

  const saldoArs = Math.max(0, tArs - sArs)
  const saldoUsd = Math.max(0, tUsd - sUsd)

  const esMultimoneda = tArs > 0 && tUsd > 0
  const soloUsd = tUsd > 0 && tArs === 0

  // 2. Manejo de cambios en Señas
  const handleSenaArsChange = (valStr: string) => {
    const rawVal = parseFloat(valStr)
    const newSArs = isNaN(rawVal) ? 0 : Math.max(0, rawVal)
    calcularYNotificar(newSArs, sUsd, medioPago)
  }

  const handleSenaUsdChange = (valStr: string) => {
    const rawVal = parseFloat(valStr)
    const newSUsd = isNaN(rawVal) ? 0 : Math.max(0, rawVal)
    calcularYNotificar(sArs, newSUsd, medioPago)
  }

  const calcularYNotificar = (newSArs: number, newSUsd: number, newMedio: string | null | undefined) => {
    let nuevoEstado: 'pendiente' | 'seniado' | 'totalmente_cobrado' = 'pendiente'
    
    const remArs = Math.max(0, tArs - newSArs)
    const remUsd = Math.max(0, tUsd - newSUsd)

    if ((tArs > 0 || tUsd > 0) && remArs === 0 && remUsd === 0) {
      nuevoEstado = 'totalmente_cobrado'
    } else if (newSArs > 0 || newSUsd > 0) {
      nuevoEstado = 'seniado'
    }

    const montoSenaTotal = newSArs > 0 ? newSArs : newSUsd

    onChange({
      senaArs: newSArs,
      senaUsd: newSUsd,
      montoSenaTotal,
      estadoPago: nuevoEstado,
      medioPago: newMedio !== undefined ? newMedio : medioPago
    })
  }

  const handleEstadoChange = (nuevoEstado: 'pendiente' | 'seniado' | 'totalmente_cobrado') => {
    let newSArs = sArs
    let newSUsd = sUsd

    if (nuevoEstado === 'totalmente_cobrado') {
      newSArs = tArs
      newSUsd = tUsd
    } else if (nuevoEstado === 'pendiente') {
      newSArs = 0
      newSUsd = 0
    }

    const montoSenaTotal = newSArs > 0 ? newSArs : newSUsd

    onChange({
      senaArs: newSArs,
      senaUsd: newSUsd,
      montoSenaTotal,
      estadoPago: nuevoEstado,
      medioPago: medioPago
    })
  }

  return (
    <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Wallet size={14} className="text-amber-400" />
            Control de Seña & Cobranza
          </label>
          {esMultimoneda && (
            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700/50">
              Multimoneda (ARS / USD)
            </span>
          )}
        </div>
        
        {/* Badge del Estado del Pago */}
        <span
          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
            estadoPago === 'totalmente_cobrado'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              : estadoPago === 'seniado'
              ? 'bg-blue-950 text-blue-300 border-blue-500/40'
              : 'bg-neutral-800 text-gray-400 border-[var(--border)]'
          }`}
        >
          {estadoPago === 'totalmente_cobrado' && <CheckCircle2 size={11} />}
          {estadoPago === 'seniado' && <Receipt size={11} />}
          {estadoPago === 'pendiente' && <Clock size={11} />}
          {estadoPago === 'totalmente_cobrado'
            ? 'Totalmente Cobrado'
            : estadoPago === 'seniado'
            ? 'Señado'
            : 'Cobro Pendiente'}
        </span>
      </div>

      {/* CASO A: MULTIMONEDA (ARS y USD DISCRIMINADOS) */}
      {esMultimoneda ? (
        <div className="space-y-2.5">
          {/* Fila 1: Pesos Argentinos (ARS) */}
          <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-emerald-500/20 space-y-1.5">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center justify-between">
              <span>Monto en Pesos Argentinos (ARS)</span>
              <span className="text-[9px] font-mono text-gray-400">Moneda Local</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded-lg bg-neutral-900 border border-[var(--border)]">
                <div className="text-[9.5px] text-gray-400 font-semibold">Cotizado ARS</div>
                <div className="text-xs font-mono font-bold text-emerald-300 mt-0.5">
                  $ {tArs.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="p-1.5 rounded-lg bg-blue-950/20 border border-blue-500/30">
                <div className="text-[9.5px] text-blue-400 font-semibold">Seña ARS</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-xs font-mono text-blue-400 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    disabled={disabled}
                    value={sArs || ''}
                    placeholder="0"
                    onChange={(e) => handleSenaArsChange(e.target.value)}
                    className="w-full text-center text-xs font-mono font-bold bg-neutral-900 border border-blue-500/40 rounded px-1 py-0.5 text-blue-300 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div
                className={`p-1.5 rounded-lg border ${
                  saldoArs > 0
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-emerald-950/20 border-emerald-500/30'
                }`}
              >
                <div
                  className={`text-[9.5px] font-semibold ${
                    saldoArs > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  Saldo Qx ARS
                </div>
                <div
                  className={`text-xs font-mono font-bold mt-0.5 ${
                    saldoArs > 0 ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  $ {saldoArs.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          </div>

          {/* Fila 2: Dólares Estadounidenses (USD) */}
          <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-cyan-500/20 space-y-1.5">
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wide flex items-center justify-between">
              <span>Monto en Dólares (USD)</span>
              <span className="text-[9px] font-mono text-gray-400">Divisa Extranjera</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded-lg bg-neutral-900 border border-[var(--border)]">
                <div className="text-[9.5px] text-gray-400 font-semibold">Cotizado USD</div>
                <div className="text-xs font-mono font-bold text-cyan-300 mt-0.5">
                  USD {tUsd.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="p-1.5 rounded-lg bg-blue-950/20 border border-blue-500/30">
                <div className="text-[9.5px] text-blue-400 font-semibold">Seña USD</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-[10px] font-mono text-blue-400 font-bold">USD</span>
                  <input
                    type="number"
                    min="0"
                    disabled={disabled}
                    value={sUsd || ''}
                    placeholder="0"
                    onChange={(e) => handleSenaUsdChange(e.target.value)}
                    className="w-full text-center text-xs font-mono font-bold bg-neutral-900 border border-blue-500/40 rounded px-1 py-0.5 text-blue-300 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div
                className={`p-1.5 rounded-lg border ${
                  saldoUsd > 0
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-emerald-950/20 border-emerald-500/30'
                }`}
              >
                <div
                  className={`text-[9.5px] font-semibold ${
                    saldoUsd > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  Saldo Qx USD
                </div>
                <div
                  className={`text-xs font-mono font-bold mt-0.5 ${
                    saldoUsd > 0 ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  USD {saldoUsd.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CASO B: MONOMONEDA (SOLO ARS O SOLO USD) */
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Total */}
          <div className="p-2 rounded-lg bg-neutral-950/80 border border-[var(--border)]">
            <div className="text-[10px] text-gray-500 font-bold uppercase">
              {soloUsd ? 'Monto Total (USD)' : 'Monto Total (ARS)'}
            </div>
            <div className="text-xs font-mono font-bold text-white mt-0.5">
              {soloUsd ? `USD ${tUsd.toLocaleString('es-AR')}` : `$ ${tArs.toLocaleString('es-AR')}`}
            </div>
          </div>

          {/* Seña Input */}
          <div className="p-2 rounded-lg bg-blue-950/20 border border-blue-500/30">
            <div className="text-[10px] text-blue-400 font-bold uppercase">
              {soloUsd ? 'Seña (USD)' : 'Seña (ARS)'}
            </div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <span className="text-xs font-mono text-blue-400 font-bold">{soloUsd ? 'USD' : '$'}</span>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={(soloUsd ? sUsd : sArs) || ''}
                placeholder="0"
                onChange={(e) => soloUsd ? handleSenaUsdChange(e.target.value) : handleSenaArsChange(e.target.value)}
                className="w-full text-center text-xs font-mono font-bold bg-neutral-900 border border-blue-500/40 rounded px-1 py-0.5 text-blue-300 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Saldo Restante */}
          <div
            className={`p-2 rounded-lg border ${
              (soloUsd ? saldoUsd : saldoArs) > 0
                ? 'bg-amber-950/20 border-amber-500/30'
                : 'bg-emerald-950/20 border-emerald-500/30'
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase ${
                (soloUsd ? saldoUsd : saldoArs) > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              Saldo el Día Qx
            </div>
            <div
              className={`text-xs font-mono font-bold mt-0.5 ${
                (soloUsd ? saldoUsd : saldoArs) > 0 ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {soloUsd
                ? `USD ${saldoUsd.toLocaleString('es-AR')}`
                : `$ ${saldoArs.toLocaleString('es-AR')}`}
            </div>
          </div>
        </div>
      )}

      {/* Botones de Estado y Selector de Medio de Pago */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border)]">
        {/* Pills de Estado Rápido */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleEstadoChange('pendiente')}
            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
              estadoPago === 'pendiente'
                ? 'bg-neutral-700 text-white shadow'
                : 'bg-neutral-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            Pendiente
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleEstadoChange('seniado')}
            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
              estadoPago === 'seniado'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-neutral-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            Señado
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleEstadoChange('totalmente_cobrado')}
            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
              estadoPago === 'totalmente_cobrado'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-neutral-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            Cobrado Total
          </button>
        </div>

        {/* Selector de Medio de Pago */}
        <div className="flex items-center gap-1.5">
          <select
            disabled={disabled}
            value={medioPago || ''}
            onChange={(e) => {
              const nuevoMedio = e.target.value || null
              calcularYNotificar(sArs, sUsd, nuevoMedio)
            }}
            className="text-[11px] px-2.5 py-1 bg-neutral-900 border border-[var(--border)] rounded-lg text-gray-200 focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="">Medio de pago no especificado</option>
            {MEDIOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
