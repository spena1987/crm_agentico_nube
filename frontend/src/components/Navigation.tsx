'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  Users, 
  Activity, 
  LogOut,
  Settings,
  ScrollText
} from 'lucide-react'

interface NavItem {
  code: string
  label: string
  href: string
  icon: any
}

const allNavItems: NavItem[] = [
  { code: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { code: 'chat', label: 'Chats / WhatsApp', href: '/chat', icon: MessageSquare },
  { code: 'presupuestos', label: 'Presupuestos', href: '/presupuestos', icon: FileText },
  { code: 'pacientes', label: 'Pacientes', href: '/pacientes', icon: Users },
  { code: 'logs', label: 'Logs & Auditoría', href: '/logs', icon: ScrollText },
  { code: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: Settings },
]

export default function Navigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { profile, canAccess, isAdmin } = usePermissions()

  // Extraer iniciales y nombre a mostrar
  const userEmail = user?.email || 'Usuario'
  const displayName = profile?.nombre_completo || user?.user_metadata?.full_name || userEmail.split('@')[0]
  const roleName = profile?.roles?.nombre || (isAdmin ? 'Administrador' : 'Personal')
  const initials = displayName.substring(0, 2).toUpperCase()

  const handleLogout = async () => {
    await signOut()
  }

  // Filtrar ítems de navegación según los permisos del usuario
  const visibleNavItems = allNavItems.filter((item) => {
    if (isAdmin) return true
    return canAccess(item.code)
  })

  return (
    <aside className="w-64 border-r border-[var(--border)] bg-[var(--card)] h-screen flex flex-col justify-between sticky top-0">
      <div className="flex flex-col">
        {/* Cabecera Logo */}
        <div className="p-6 border-b border-[var(--border)] flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center glow-primary">
            <Activity size={24} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">MedCRM</h1>
            <p className="text-xs text-[var(--secondary)] font-medium">Clínica Nube</p>
          </div>
        </div>

        {/* Links de Navegación Dinámicos por Permiso */}
        <nav className="p-4 flex flex-col gap-1.5 mt-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/' 
              ? pathname === '/' 
              : pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white glow-primary' 
                    : 'text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-[var(--foreground)]'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer del Sidebar con Usuario, Rol y Logout */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 glow-primary">
              {initials}
            </div>
            <div className="truncate min-w-0">
              <p className="text-xs font-bold leading-tight truncate text-[var(--foreground)]" title={displayName}>
                {displayName}
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate" title={roleName}>
                {roleName}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors shrink-0 ml-1"
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
