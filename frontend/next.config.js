/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy inverso para peticiones de API al backend FastAPI.
  // Usamos fallback para que las rutas de API estáticas y dinámicas de Next.js (como /api/admin/roles/[id])
  // tengan prioridad y no sean secuestradas por el rewrite antes de evaluarse.
  async rewrites() {
    let backendUrl = 
      process.env.BACKEND_URL || 
      process.env.NEXT_PUBLIC_BACKEND_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'https://crmagenticonube-production.up.railway.app' 
        : 'http://127.0.0.1:8000')
    if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
      backendUrl = `https://${backendUrl}`
    }
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: '/static/:path*',
          destination: `${backendUrl}/static/:path*`,
        },
      ],
    }
  },
  // Permitimos imágenes de Supabase Storage u otros servidores si fuera necesario
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig

