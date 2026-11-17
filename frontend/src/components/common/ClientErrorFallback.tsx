'use client'

import React, { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Copy, Check, RefreshCw, RotateCcw } from 'lucide-react'
import { isChunkLoadError } from '@/lib/clientErrorHandler'

interface ClientErrorFallbackProps {
  error: unknown
  pathname?: string
  onReset?: () => void
}

/**
 * Vista de recuperación amigable cuando ocurre una excepción en el navegador,
 * reemplazando la pantalla negra genérica de Next.js.
 */
export default function ClientErrorFallback({
  error,
  pathname,
  onReset,
}: ClientErrorFallbackProps) {
  const [mostrarDetalle, setMostrarDetalle] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const errObj = error as any
  const esChunk = isChunkLoadError(error)
  const errorName = errObj?.name ? String(errObj.name) : 'Error'
  const errorMessage = errObj?.message ? String(errObj.message) : String(error || 'Error inesperado')
  const digest = errObj?.digest ? String(errObj.digest) : ''
  const ruta = pathname || (typeof window !== 'undefined' ? window.location.pathname : '')

  const detalleTexto = [
    `Ruta: ${ruta || '(desconocida)'}`,
    `Tipo: ${errorName}`,
    `Mensaje: ${errorMessage}`,
    digest ? `Digest: ${digest}` : null,
    `Fecha: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n')

  const handleCopiar = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard
      .writeText(detalleTexto)
      .then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center p-6 bg-neutral-950 text-white">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-900/90 border border-neutral-800 p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">
              {esChunk
                ? 'Hay una nueva versión del sistema disponible'
                : 'Ocurrió un inconveniente al mostrar esta pantalla'}
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              {esChunk
                ? 'Se publicó una actualización reciente en el servidor. Recargá la página para continuar trabajando con la versión actualizada.'
                : 'El error quedó registrado automáticamente para revisión técnica. Podés reintentar o recargar la página para continuar.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {onReset && !esChunk && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw size={14} />
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} />
            Recargar página
          </button>
        </div>

        <div className="pt-2 border-t border-neutral-800/80">
          <button
            type="button"
            onClick={() => setMostrarDetalle((v) => !v)}
            className="text-[11px] font-medium text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer"
          >
            {mostrarDetalle ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Detalle técnico para soporte
          </button>

          {mostrarDetalle && (
            <div className="mt-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {detalleTexto}
              </pre>
              <button
                type="button"
                onClick={handleCopiar}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-medium text-gray-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiado ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiado ? 'Copiado' : 'Copiar detalle'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
