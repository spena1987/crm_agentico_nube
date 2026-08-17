'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Navigation from '@/components/Navigation'
import IdleTimeoutManager from '@/components/auth/IdleTimeoutManager'
import { Loader2 } from 'lucide-react'

export default function AppLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push('/login')
    }
  }, [user, loading, isLoginPage, router])

  // Si estamos en la página de login, renderizamos el contenido sin navegación
  if (isLoginPage) {
    return <>{children}</>
  }

  // Si aún está validando la sesión
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-[var(--secondary)]">
            Comprobando autenticación...
          </p>
        </div>
      </div>
    )
  }

  // Si no está autenticado y aún no ha completado el push
  if (!user) {
    return null
  }

  // Usuario autenticado en el CRM con monitor de inactividad activo
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      <IdleTimeoutManager />
      <Navigation />
      <main className="flex-1 flex flex-col overflow-y-auto p-8 relative">
        {children}
      </main>
    </div>
  )
}
