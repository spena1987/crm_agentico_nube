import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
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
      <body className="flex h-screen overflow-hidden bg-[var(--background)]">
        <Navigation />
        <main className="flex-1 flex flex-col overflow-y-auto p-8 relative">
          {children}
        </main>
      </body>
    </html>
  )
}
