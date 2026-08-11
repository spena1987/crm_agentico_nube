/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
