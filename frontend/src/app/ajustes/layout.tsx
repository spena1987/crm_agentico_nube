'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Users, ShieldCheck } from 'lucide-react'

export default function AjustesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const tabs = [
    {
      label: 'Usuarios & Accesos',
      href: '/ajustes/usuarios',
      icon: Users,
      description: 'Altas, bajas y credenciales del personal',
    },
    {
      label: 'Perfiles & Permisos (RBAC)',
      href: '/ajustes/roles',
      icon: ShieldCheck,
      description: 'Matriz de control de acceso por módulo',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Cabecera Principal de Ajustes */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2.5 text-blue-600 mb-1">
            <Settings size={22} className="animate-spin-slow" />
            <span className="text-xs font-bold uppercase tracking-wider">Configuración del Sistema</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
            Ajustes & Administración
          </h1>
          <p className="text-xs text-[var(--secondary)] mt-0.5">
            Gestiona los usuarios de la clínica, define roles de acceso y personaliza los permisos por módulo.
          </p>
        </div>
      </div>

      {/* Tabs de Navegación de Ajustes */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm glow-primary'
                  : 'text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[var(--foreground)]'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Contenido de la Sub-Página */}
      <div className="pt-2">
        {children}
      </div>
    </div>
  )
}
