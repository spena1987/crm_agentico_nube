'use client'

import React, { useEffect } from 'react'
import ClientErrorFallback from '@/components/common/ClientErrorFallback'
import { reportClientError, tryAutoRecoverChunkError } from '@/lib/clientErrorHandler'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const recargando = tryAutoRecoverChunkError(error)
    reportClientError(error, {
      source: recargando ? 'app/global-error.tsx(auto-reload)' : 'app/global-error.tsx',
    })
  }, [error])

  return (
    <html lang="es">
      <body className="bg-neutral-950 text-white">
        <ClientErrorFallback error={error} onReset={reset} />
      </body>
    </html>
  )
}
