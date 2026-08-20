'use client'

import React, { useState, useEffect } from 'react'
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
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  TrendingUp,
  Stethoscope
} from 'lucide-react'

import { BACKEND_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

interface NavItem {
  code: string
  label: string
  href: string
  icon: any
}

const allNavItems: NavItem[] = [
  { code: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { code: 'chat', label: 'Chats / WhatsApp', href: '/chat', icon: MessageSquare },
  { code: 'pipeline-quirurgico', label: 'Pipeline Quirúrgico', href: '/pipeline-quirurgico', icon: TrendingUp },
  { code: 'presupuestos', label: 'Presupuestos', href: '/presupuestos', icon: FileText },
  { code: 'pacientes', label: 'Pacientes', href: '/pacientes', icon: Users },
  { code: 'logs', label: 'Logs & Auditoría', href: '/logs', icon: ScrollText },
  { code: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: Settings },
]

export default function Navigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { profile, canAccess, isAdmin } = usePermissions()

  // Estado de colapso para monitores medianos/laptops
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Estado para menú móvil/drawer en pantallas pequeñas
  const [mobileOpen, setMobileOpen] = useState(false)
  // Contador de chats con mensajes no leídos
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0)

  const fetchUnreadMetrics = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversaciones/metricas`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setUnreadChatCount(data.no_leidos_count || 0)
      }
    } catch (e) {}
  }

  // Cargar preferencia guardada de colapso y auto-colapsar en pantallas medianas
  useEffect(() => {
    const saved = localStorage.getItem('crm_sidebar_collapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    } else if (window.innerWidth < 1280 && window.innerWidth >= 1024) {
      setIsCollapsed(true)
    }

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)

    // Cargar métricas iniciales y configurar polling de respaldo
    fetchUnreadMetrics()
    const intervalMetrics = setInterval(fetchUnreadMetrics, 5000)

    // Suscripción Realtime a mensajes para actualizar badge en vivo
    const channel = supabase
      .channel('nav-unread-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes' },
        () => {
          fetchUnreadMetrics()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversaciones' },
        () => {
          fetchUnreadMetrics()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(intervalMetrics)
      supabase.removeChannel(channel)
    }
  }, [])

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('crm_sidebar_collapsed', String(next))
  }

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

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between select-none">
      {/* Parte Superior: Logo & Links */}
      <div className="flex flex-col">
        {/* Cabecera Logo */}
        <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all ${
          isCollapsed ? 'px-2 justify-center' : 'px-5'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center glow-primary shrink-0">
              <Activity size={22} className="animate-pulse" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="font-bold text-base leading-tight tracking-tight text-[var(--foreground)]">MedCRM</h1>
                <p className="text-[11px] text-[var(--secondary)] font-medium">Clínica Nube</p>
              </div>
            )}
          </div>

          {/* Botón Toggle Colapso (Visible en desktop) */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Links de Navegación */}
        <nav className="p-3 flex flex-col gap-1 mt-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/' 
              ? pathname === '/' 
              : pathname === item.href || pathname.startsWith(item.href + '/')
            const isChat = item.code === 'chat'
            const hasUnread = isChat && unreadChatCount > 0

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? `${item.label}${hasUnread ? ` (${unreadChatCount} sin leer)` : ''}` : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-xs glow-primary' 
                    : 'text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-[var(--foreground)]'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon 
                    size={19} 
                    className={`transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'
                    }`} 
                  />
                  {/* Badge en modo colapsado */}
                  {isCollapsed && hasUnread && (
                    <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[var(--background)] animate-pulse" />
                  )}
                </div>
                
                {!isCollapsed && (
                  <>
                    <span className="truncate text-xs font-medium tracking-tight">
                      {item.label}
                    </span>
                    {/* Badge numérico en modo expandido */}
                    {hasUnread && (
                      <span className="ml-auto bg-emerald-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-xs animate-pulse">
                        {unreadChatCount > 99 ? '99+' : unreadChatCount}
                      </span>
                    )}
                  </>
                )}

                {/* Tooltip flotante al estar colapsado */}
                {isCollapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {hasUnread && (
                      <span className="bg-emerald-500 text-white font-bold text-[9.5px] px-1.5 py-0.2 rounded-full">
                        {unreadChatCount}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer del Sidebar con Usuario, Rol y Logout */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className={`flex items-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] transition-all ${
          isCollapsed ? 'p-1.5 justify-center' : 'p-2.5 justify-between gap-2'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 glow-primary"
              title={isCollapsed ? `${displayName} (${roleName})` : undefined}
            >
              {initials}
            </div>
            {!isCollapsed && (
              <div className="truncate min-w-0">
                <p className="text-xs font-bold leading-tight truncate text-[var(--foreground)]" title={displayName}>
                  {displayName}
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate" title={roleName}>
                  {roleName}
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button 
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors shrink-0"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Botón flotante para dispositivos móviles / tablets < 1024px */}
      <div className="lg:hidden fixed top-3 left-3 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] shadow-md hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Abrir menú de navegación"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Backdrop overlay para móvil */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      {/* Drawer Móvil Deslizable */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[var(--card)] shadow-2xl transform transition-transform duration-200 ease-in-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        {sidebarContent}
      </div>

      {/* Sidebar Desktop con soporte Colapsable Fijo */}
      <aside 
        className={`hidden lg:flex flex-col border-r border-[var(--border)] bg-[var(--card)] h-[100dvh] shrink-0 sticky top-0 transition-all duration-200 z-30 ${
          isCollapsed ? 'w-16' : 'w-56 xl:w-60'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
