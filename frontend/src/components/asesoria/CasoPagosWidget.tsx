'use client'

import React from 'react'
import { DollarSign, CheckCircle2, Clock, CreditCard, Receipt, Wallet } from 'lucide-react'

interface CasoPagosWidgetProps {
  montoTotal: number
  moneda: string
  montoSena: number
  estadoPago: 'pendiente' | 'seniado' | 'totalmente_cobrado'
  medioPago?: string | null
  disabled?: boolean
  onChange: (data: {
    montoSena: number
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
  montoTotal,
  moneda,
  montoSena,
  estadoPago,
  medioPago,
  disabled = false,
  onChange
}: CasoPagosWidgetProps) {
  const totalNum = Number(montoTotal) || 0
  const senaNum = Number(montoSena) || 0
  const saldoPendiente = Math.max(0, totalNum - senaNum)

  const handleSenaChange = (valStr: string) => {
    const rawVal = parseFloat(valStr)
    const val = isNaN(rawVal) ? 0 : Math.max(0, rawVal)
    
    let nuevoEstado: 'pendiente' | 'seniado' | 'totalmente_cobrado' = 'pendiente'
    if (val >= totalNum && totalNum > 0) {
      nuevoEstado = 'totalmente_cobrado'
    } else if (val > 0) {
      nuevoEstado = 'seniado'
    }

    onChange({
      montoSena: val,
      estadoPago: nuevoEstado,
      medioPago: medioPago
    })
  }

  const handleEstadoChange = (nuevoEstado: 'pendiente' | 'seniado' | 'totalmente_cobrado') => {
    let nuevoMontoSena = senaNum
    if (nuevoEstado === 'totalmente_cobrado') {
      nuevoMontoSena = totalNum
    } else if (nuevoEstado === 'pendiente') {
      nuevoMontoSena = 0
    }
    onChange({
      montoSena: nuevoMontoSena,
      estadoPago: nuevoEstado,
      medioPago: medioPago
    })
  }

  return (
    <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-[var(--border)] space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
          <Wallet size={14} className="text-amber-400" />
          Control de Seña & Cobranza
        </label>
        
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

      {/* Grilla: Total, Seña entregada y Saldo restante */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Total */}
        <div className="p-2 rounded-lg bg-neutral-950/80 border border-[var(--border)]">
          <div className="text-[10px] text-gray-500 font-bold uppercase">Monto Total</div>
          <div className="text-xs font-mono font-bold text-white mt-0.5">
            {moneda === 'USD' ? `USD ${totalNum.toLocaleString('es-AR')}` : `$ ${totalNum.toLocaleString('es-AR')}`}
          </div>
        </div>

        {/* Seña Input */}
        <div className="p-2 rounded-lg bg-blue-950/20 border border-blue-500/30">
          <div className="text-[10px] text-blue-400 font-bold uppercase">Seña Entregada</div>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <input
              type="number"
              min="0"
              disabled={disabled}
              value={senaNum || ''}
              placeholder="0"
              onChange={(e) => handleSenaChange(e.target.value)}
              className="w-full text-center text-xs font-mono font-bold bg-neutral-900 border border-blue-500/40 rounded px-1 py-0.5 text-blue-300 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Saldo Restante */}
        <div
          className={`p-2 rounded-lg border ${
            saldoPendiente > 0
              ? 'bg-amber-950/20 border-amber-500/30'
              : 'bg-emerald-950/20 border-emerald-500/30'
          }`}
        >
          <div
            className={`text-[10px] font-bold uppercase ${
              saldoPendiente > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            Saldo el Día Qx
          </div>
          <div
            className={`text-xs font-mono font-bold mt-0.5 ${
              saldoPendiente > 0 ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {moneda === 'USD'
              ? `USD ${saldoPendiente.toLocaleString('es-AR')}`
              : `$ ${saldoPendiente.toLocaleString('es-AR')}`}
          </div>
        </div>
      </div>

      {/* Botones de Estado y Selector de Medio de Pago */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {/* Pills de Estado */}
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
        <select
          disabled={disabled}
          value={medioPago || ''}
          onChange={(e) =>
            onChange({
              montoSena: senaNum,
              estadoPago: estadoPago,
              medioPago: e.target.value || null
            })
          }
          className="px-2 py-1 text-[10px] bg-neutral-900 border border-[var(--border)] rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 font-medium"
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
  )
}
