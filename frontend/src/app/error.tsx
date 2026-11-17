'use client'

import React, { useEffect } from 'react'
import ClientErrorFallback from '@/components/common/ClientErrorFallback'
import { reportClientError, tryAutoRecoverChunkError } from '@/lib/clientErrorHandler'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const recargando = tryAutoRecoverChunkError(error)
    reportClientError(error, {
      source: recargando ? 'app/error.tsx(auto-reload)' : 'app/error.tsx',
    })
  }, [error])

  return <ClientErrorFallback error={error} onReset={reset} />
}
