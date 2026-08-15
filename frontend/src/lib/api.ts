/**
 * Configuración centralizada de la URL del Backend (FastAPI / Railway)
 * Permite cambiar entre local (http://localhost:8000) y producción (URL de Railway)
 * simplemente configurando la variable de entorno NEXT_PUBLIC_BACKEND_URL en Vercel.
 */
export const BACKEND_URL = 
  process.env.NEXT_PUBLIC_BACKEND_URL || 
  process.env.NEXT_PUBLIC_API_URL || 
  'http://localhost:8000';
