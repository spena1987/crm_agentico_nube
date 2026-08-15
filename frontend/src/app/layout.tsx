import type { Metadata } from 'next'
import { AuthProvider } from '@/context/AuthContext'
import AppLayoutWrapper from '@/components/AppLayoutWrapper'
import './globals.css'

export const metadata: Metadata = {
  title: 'CRM Clínico Nube',
  description: 'Gestión clínica inteligente con integración de agente de WhatsApp.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <AppLayoutWrapper>{children}</AppLayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}
