/**
 * Configuración centralizada de la URL del Backend (FastAPI / Railway)
 * Permite cambiar entre local (http://localhost:8000) y producción (URL de Railway)
 * simplemente configurando la variable de entorno NEXT_PUBLIC_BACKEND_URL en Vercel.
 */
const rawBackendUrl = 
  process.env.NEXT_PUBLIC_BACKEND_URL || 
  process.env.NEXT_PUBLIC_API_URL || 
  'http://localhost:8000';

const formatUrl = (url: string) => {
  let clean = (url || '').trim()
  if (!clean) return 'http://localhost:8000'
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
