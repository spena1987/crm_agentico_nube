/**
 * Configuración centralizada de la URL del Backend (FastAPI / Railway)
 * y cliente HTTP autenticado con Bearer Token de Supabase Auth.
 */
import { supabase } from './supabase'

const rawBackendUrl = 
  process.env.NEXT_PUBLIC_BACKEND_URL || 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://crmagenticonube-production.up.railway.app'
    : '');


const formatUrl = (url: string) => {
  let clean = (url || '').trim()
  if (!clean) return '' // Permite que el cliente use rutas relativas /api/... manejadas por el proxy rewrites de Next.js
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`
  }
  // Eliminar barras finales y sufijo /api accidental si el usuario lo incluyó en Vercel
  clean = clean.replace(/\/+$/, '')
  if (clean.endsWith('/api')) {
    clean = clean.slice(0, -4)
  }
  return clean
}

export const BACKEND_URL = formatUrl(rawBackendUrl);

/**
 * Obtiene los encabezados de autenticación con el JWT actual de la sesión de Supabase
 * o el token de acceso oficial del proyecto si no hay sesión individual iniciada.
 */
export async function getAuthHeaders(customHeaders: HeadersInit = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Si customHeaders ya tiene propiedades, mezclarlas
  if (customHeaders instanceof Headers) {
    customHeaders.forEach((val, key) => { headers[key] = val })
  } else if (Array.isArray(customHeaders)) {
    customHeaders.forEach(([key, val]) => { headers[key] = val })
  } else if (typeof customHeaders === 'object' && customHeaders !== null) {
    Object.assign(headers, customHeaders)
  }

  try {
    let session = (await supabase.auth.getSession()).data.session
    // Proactivamente refrescar token si caduca en menos de 60 segundos
    if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession()
        if (refreshed?.session) {
          session = refreshed.session
        }
      } catch (refErr) {
        console.warn('Fallo al refrescar sesión proactivamente:', refErr)
      }
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    } else if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    }
  } catch (err) {
    console.warn('No se pudo recuperar token de sesión para la petición API:', err)
    if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    }
  }

  return headers
}

/**
 * Wrapper de fetch que inyecta automáticamente la URL del backend y el token Bearer.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const fullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${BACKEND_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const baseHeaders: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' }
  const authHeaders = await getAuthHeaders(options.headers || baseHeaders)
  if (isFormData) {
    delete authHeaders['Content-Type'] // Dejar que el navegador configure el boundary multipart
  }

  let res = await fetch(fullUrl, {
    ...options,
    headers: authHeaders,
  })

  // Si retorna 401, reintentar una sola vez tras renovar sesión
  if (res.status === 401) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed?.session?.access_token) {
        const retryHeaders = { ...authHeaders, Authorization: `Bearer ${refreshed.session.access_token}` }
        res = await fetch(fullUrl, {
          ...options,
          headers: retryHeaders,
        })
      }
    } catch {
      // Si falla renovación, retornar respuesta 401 original
    }
  }

  return res
}

// Interceptor global en entorno de navegador para inyectar automáticamente Bearer token
// en cualquier llamada fetch a /api/* o a BACKEND_URL
if (typeof window !== 'undefined' && !(window as any).__MEDCRM_FETCH_INTERCEPTOR__) {
  (window as any).__MEDCRM_FETCH_INTERCEPTOR__ = true
  const originalFetch = window.fetch

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' 
      ? input 
      : (input instanceof URL ? input.href : (input as Request).url || '')

    const isApiCall = url.startsWith('/api/') || (BACKEND_URL && url.startsWith(BACKEND_URL))
    const isPublic = url.includes('/api/consentimiento-publico') || url.includes('/static/')

    if (isApiCall && !isPublic) {
      try {
        let token: string | null = null
        try {
          let session = (await supabase.auth.getSession()).data.session
          if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
            const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }))
            session = refreshed?.session || session
          }
          token = session?.access_token || null
        } catch {
          // ignore
        }
        if (!token) {
          token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null
        }

        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}))
          if (!headers.has('Authorization') && !headers.has('authorization')) {
            headers.set('Authorization', `Bearer ${token}`)
          }
          
          let res = await originalFetch(input, { ...init, headers })

          // Reintento resiliente ante 401 (token expirado durante la sesión)
          if (res.status === 401) {
            try {
              const { data: refreshed } = await supabase.auth.refreshSession()
              if (refreshed?.session?.access_token) {
                const retryHeaders = new Headers(headers)
                retryHeaders.set('Authorization', `Bearer ${refreshed.session.access_token}`)
                res = await originalFetch(input, { ...init, headers: retryHeaders })
              }
            } catch {
              // si falla refresco, devolver 401
            }
          }

          return res
        }
      } catch (err) {
        // Si hay error recuperando sesión, continuar con llamada original
      }
    }

    return originalFetch(input, init)
  }
}

