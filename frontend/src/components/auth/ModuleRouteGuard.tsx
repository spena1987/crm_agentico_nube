'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import { ShieldAlert, ArrowLeft, Loader2, Lock } from 'lucide-react'
import { SYSTEM_MODULES } from '@/config/modules'

// Mapeo de prefijos de ruta al código del módulo
const ROUTE_TO_MODULE: Record<string, string> = {
  '/': 'dashboard',
  '/agenda-geclisa': 'agenda-geclisa',
  '/chat': 'chat',
  '/pipeline-quirurgico': 'pipeline-quirurgico',
  '/asesoramiento-recepcion': 'asesoramiento-recepcion',
  '/programacion-quirurgica': 'programacion-quirurgica',
  '/quirofano-en-vivo': 'quirofano-en-vivo',
  '/calculo-lio': 'calculo-lio',
  '/presupuestos': 'presupuestos',
  '/pacientes': 'pacientes',
  '/logs': 'logs',
  '/ajustes': 'ajustes',
}

function resolveModuleCode(pathname: string): string | null {
  if (pathname === '/') return 'dashboard'

  // Buscar coincidencia exacta o por prefijo más específico
  const sortedRoutes = Object.keys(ROUTE_TO_MODULE).sort((a, b) => b.length - a.length)
  for (const route of sortedRoutes) {
    if (route !== '/' && (pathname === route || pathname.startsWith(route + '/'))) {
      return ROUTE_TO_MODULE[route]
    }
  }

  return null
}

export default function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAdmin, canAccess, loading, profile, effectiveLandingRoute } = usePermissions()

  const moduleCode = resolveModuleCode(pathname)

  // Si está en la raíz y no tiene permiso para el Dashboard General, redirigir a su landing page efectiva
  useEffect(() => {
    if (!loading && pathname === '/' && !isAdmin && !canAccess('dashboard')) {
      if (effectiveLandingRoute && effectiveLandingRoute !== '/') {
        router.replace(effectiveLandingRoute)
      }
    }
  }, [loading, pathname, isAdmin, canAccess, effectiveLandingRoute, router])

  // Si no pertenece a un módulo conocido o es ruta pública/no mapeada, dejar pasar
  if (!moduleCode) {
    return <>{children}</>
  }

  // Mientras se cargan permisos y perfil por primera vez (arranque en frío)
  if (loading && !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 gap-3 min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-xs font-semibold">Verificando permisos de acceso...</p>
      </div>
    )
  }

  // Si está en la raíz pero redirigiéndose a su módulo predeterminado
  if (pathname === '/' && !isAdmin && !canAccess('dashboard') && effectiveLandingRoute !== '/') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 gap-3 min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-xs font-semibold">Redirigiendo a tu sección principal...</p>
      </div>
    )
  }

  // Si es Administrador o tiene permiso de acceso 'ver' al módulo
  if (isAdmin || canAccess(moduleCode)) {
    return <>{children}</>
  }

  // Si no tiene permiso, obtener detalles para la pantalla de 403
  const moduleDef = SYSTEM_MODULES.find((m) => m.code === moduleCode)
  const moduleName = moduleDef?.name || moduleCode
  const userRole = profile?.roles?.nombre || 'Personal sin rol asignado'

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[70vh] animate-fade-in select-none">
      <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 shadow-xl flex flex-col items-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 dark:text-red-400 flex items-center justify-center ring-8 ring-red-500/5">
          <ShieldAlert size={36} />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[11px] font-bold">
            <Lock size={12} />
            <span>Acceso Denegado (403)</span>
          </div>
          <h2 className="text-lg font-black text-[var(--foreground)] tracking-tight">
            Acceso no autorizado a {moduleName}
          </h2>
          <p className="text-xs text-[var(--secondary)] leading-relaxed">
            Tu perfil actual (<strong className="text-[var(--foreground)]">{userRole}</strong>) no tiene permisos asignados para visualizar ni interactuar con este módulo.
          </p>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-[var(--border)] text-left w-full text-[11px] text-[var(--secondary)]">
          <p className="font-semibold text-[var(--foreground)] mb-0.5">¿Necesitas acceso?</p>
          <p>Comunícate con un Administrador General del sistema para que actualice tu perfil o matriz de permisos en Ajustes.</p>
        </div>

        <Link
          href={effectiveLandingRoute || '/'}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md glow-primary"
        >
          <ArrowLeft size={16} />
          <span>Volver a mi Sección de Inicio</span>
        </Link>
      </div>
    </div>
  )
}
