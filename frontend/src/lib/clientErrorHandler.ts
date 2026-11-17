'use client'

const CHUNK_RELOAD_KEY = 'crm_chunk_reload_at'
const CHUNK_RELOAD_COOLDOWN_MS = 30_000

/**
 * Detecta si una excepción del navegador corresponde a un fallo al cargar
 * un chunk de Next.js (habitual cuando hay un despliegue nuevo en Vercel
 * mientras el usuario mantiene una pestaña abierta).
 */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  const name = typeof err === 'object' && 'name' in err ? String((err as any).name || '') : ''
  const msg =
    typeof err === 'string'
      ? err
      : typeof err === 'object' && 'message' in err
      ? String((err as any).message || '')
      : String(err)

  return (
    name === 'ChunkLoadError' ||
    /chunkloaderror|loading chunk [\d\w-]+ failed|loading css chunk [\d\w-]+ failed|failed to fetch dynamically imported module|importing a module script failed/i.test(
      msg
    )
  )
}

/**
 * Si el error es un ChunkLoadError y no se recargó recientemente, recarga la página
 * una única vez para descargar el manifiesto y los chunks del despliegue actual.
 */
export function tryAutoRecoverChunkError(err: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(err)) return false
  try {
    const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0')
    const now = Date.now()
    if (!lastReload || now - lastReload > CHUNK_RELOAD_COOLDOWN_MS) {
      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
      window.location.reload()
      return true
    }
  } catch {
    // Si sessionStorage está bloqueado, no entramos en bucle de recarga
  }
  return false
}

/**
 * Reporta de forma asíncrona (fire-and-forget) una excepción cliente al endpoint
 * existente `/api/logs/client` para visibilidad en el módulo de Logs.
 */
export function reportClientError(
  err: unknown,
  extra?: {
    pathname?: string
    source?: string
    componentStack?: string
    userEmail?: string
  }
): void {
  if (typeof window === 'undefined') return
  try {
    const errObj = err as any
    const errorName = errObj?.name ? String(errObj.name) : 'Error'
    const errorMessage = errObj?.message ? String(errObj.message) : String(err || 'Error desconocido')
    const stack = errObj?.stack ? String(errObj.stack).slice(0, 2500) : undefined
    const pathname = extra?.pathname || window.location.pathname
    const chunkError = isChunkLoadError(err)

    fetch('/api/logs/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        nivel: chunkError ? 'WARNING' : 'ERROR',
        modulo: 'FRONTEND',
        accion: chunkError ? 'CHUNK_LOAD_ERROR' : 'CLIENT_EXCEPTION',
        mensaje: `[${extra?.source || 'UI'}] ${errorName}: ${errorMessage}`.slice(0, 500),
        detalles: {
          pathname,
          source: extra?.source || 'unknown',
          error_name: errorName,
          digest: errObj?.digest || null,
          user_email: extra?.userEmail || null,
          component_stack: extra?.componentStack ? extra.componentStack.slice(0, 1200) : null,
        },
        trace: stack || null,
      }),
    }).catch(() => {})
  } catch {
    // Nunca lanzar un error secundario desde el reporter
  }
}
