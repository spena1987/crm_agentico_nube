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
  ChevronDown,
  Menu,
  X,
  TrendingUp,
  Stethoscope,
  CalendarCheck2,
  Calendar,
  Building2,
  UserCheck,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'

import { apiFetch, BACKEND_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

interface SubNavItem {
  code: string
  label: string
  href: string
  icon: any
}

interface NavItem {
  code: string
  label: string
  href: string
  icon: any
  subItems?: SubNavItem[]
}

const allNavItems: NavItem[] = [
  { code: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { code: 'agenda-geclisa', label: 'Agenda Geclisa', href: '/agenda-geclisa', icon: Calendar },
  { code: 'chat', label: 'Chats / WhatsApp', href: '/chat', icon: MessageSquare },
  {
    code: 'pipeline-quirurgico',
    label: 'Asesoramiento',
    href: '/pipeline-quirurgico',
    icon: Stethoscope,
    subItems: [
      { code: 'pipeline-quirurgico', label: 'Pipeline', href: '/pipeline-quirurgico', icon: TrendingUp },
      { code: 'asesoramiento-recepcion', label: 'Recepción del Día', href: '/asesoramiento-recepcion', icon: UserCheck }
    ]
  },
  {
    code: 'programacion-quirurgica',
    label: 'Quirófano',
    href: '/programacion-quirurgica',
    icon: Building2,
    subItems: [
      { code: 'programacion-quirurgica', label: 'Agenda & Slots', href: '/programacion-quirurgica', icon: CalendarCheck2 },
      { code: 'quirofano-en-vivo', label: 'Pizarra en Vivo', href: '/quirofano-en-vivo', icon: Activity },
      { code: 'calculo-lio', label: 'Cálculo de LIO', href: '/calculo-lio', icon: Eye }
    ]
  },
  { code: 'presupuestos', label: 'Presupuestos', href: '/presupuestos', icon: FileText },
  { code: 'pacientes', label: 'Pacientes', href: '/pacientes', icon: Users },
  { code: 'estudios-tecnicos', label: 'Estudios (Técnicos)', href: '/estudios-tecnicos', icon: Eye },
  { code: 'logs', label: 'Logs & Auditoría', href: '/logs', icon: ScrollText },
  { code: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: Settings },
  { code: 'ayuda', label: 'Centro de Ayuda', href: '/ayuda', icon: HelpCircle },
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
  // Contador de recontactos quirúrgicos pendientes del día o vencidos
  const [recontactosPendientesCount, setRecontactosPendientesCount] = useState<number>(0)
  const [quirofanoMenuOpen, setQuirofanoMenuOpen] = useState(true)
  const [asesoriaMenuOpen, setAsesoriaMenuOpen] = useState(true)
  const [clinicLogo, setClinicLogo] = useState<string | null>(null)
  const [clinicName, setClinicName] = useState<string>('Centro Médico Nube')

  // Modal de autogestión de contraseña
  const [showPassModal, setShowPassModal] = useState(false)
  const [selfNewPass, setSelfNewPass] = useState('')
  const [selfConfirmPass, setSelfConfirmPass] = useState('')
  const [showSelfPass, setShowSelfPass] = useState(false)
  const [selfPassLoading, setSelfPassLoading] = useState(false)
  const [selfPassFeedback, setSelfPassFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSelfPassFeedback(null)

    if (selfNewPass.trim().length < 6) {
      setSelfPassFeedback({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }
    if (selfNewPass.trim() !== selfConfirmPass.trim()) {
      setSelfPassFeedback({ type: 'error', message: 'Las contraseñas ingresadas no coinciden.' })
      return
    }

    setSelfPassLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }

      const res = await fetch('/api/auth/me/password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newPassword: selfNewPass.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar la contraseña.')
      }

      setSelfPassFeedback({ type: 'success', message: 'Contraseña actualizada correctamente.' })
      setSelfNewPass('')
      setSelfConfirmPass('')
      setTimeout(() => {
        setShowPassModal(false)
        setSelfPassFeedback(null)
      }, 1500)
    } catch (err: any) {
      setSelfPassFeedback({ type: 'error', message: err.message })
    } finally {
      setSelfPassLoading(false)
    }
  }

  const fetchUnreadMetrics = async () => {
    try {
      const [resC, resR] = await Promise.all([
        apiFetch('/api/conversaciones/metricas', { cache: 'no-store' }),
        apiFetch('/api/pipeline-quirurgico/metricas-recontactos', { cache: 'no-store' })
      ])
      if (resC.ok) {
        const data = await resC.json()
        setUnreadChatCount(data.no_leidos_count || 0)
      }
      if (resR.ok) {
        const dataR = await resR.json()
        setRecontactosPendientesCount(dataR.total || 0)
      }
    } catch (e) {}
  }

  const fetchClinicBranding = async () => {
    try {
      let clinica: any = null
      try {
        const res = await apiFetch('/api/settings', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          clinica = data.clinica || null
        }
      } catch (e) {}

      if (!clinica) {
        const { data: dbData } = await (supabase as any)
          .from('configuracion_sistema')
          .select('valor')
          .eq('clave', 'ajustes_crm')
          .maybeSingle()
        if (dbData && dbData.valor) {
          clinica = (dbData.valor as any).clinica || null
        }
      }

      if (clinica) {
        if (clinica.logo_url) setClinicLogo(clinica.logo_url)
        if (clinica.nombre) setClinicName(clinica.nombre)
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

    // Cargar branding institucional y métricas iniciales
    fetchClinicBranding()
    fetchUnreadMetrics()
    const intervalMetrics = setInterval(fetchUnreadMetrics, 20000)

    // Suscripción Realtime a mensajes y cambios de configuración para actualizar logo en vivo
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracion_sistema' },
        () => {
          fetchClinicBranding()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asesorias_quirurgicas' },
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
  const visibleNavItems = allNavItems
    .map((item) => {
      if (isAdmin) return item

      if (item.subItems) {
        const allowedSubItems = item.subItems.filter((sub) => canAccess(sub.code))
        if (allowedSubItems.length > 0) {
          const firstAllowedHref = allowedSubItems[0].href
          return {
            ...item,
            href: canAccess(item.code) ? item.href : firstAllowedHref,
            subItems: allowedSubItems,
          }
        }
        return null
      }

      return canAccess(item.code) ? item : null
    })
    .filter(Boolean) as NavItem[]

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between select-none">
      {/* Parte Superior: Logo & Links */}
      <div className="flex flex-col">
        {/* Cabecera Logo */}
        <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all ${
          isCollapsed ? 'px-2 justify-center' : 'px-5'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            {clinicLogo ? (
              <div className="h-9 w-9 rounded-xl bg-white dark:bg-slate-800 p-1 border border-[var(--border)] shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={clinicLogo.startsWith('http') ? clinicLogo : `${BACKEND_URL}${clinicLogo}`}
                  alt="Logo Institución"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center glow-primary shrink-0">
                <Activity size={22} className="animate-pulse" />
              </div>
            )}
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="font-bold text-sm leading-tight tracking-tight text-[var(--foreground)] truncate">
                  {clinicName}
                </h1>
                <p className="text-[10px] text-[var(--secondary)] font-medium">CRM Médico Institucional</p>
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
            const isQuirofano = item.code === 'programacion-quirurgica'
            const isQuirofanoActive = pathname === '/programacion-quirurgica' || pathname === '/quirofano-en-vivo' || pathname === '/calculo-lio'
            
            const isActive = isQuirofano 
              ? isQuirofanoActive
              : item.href === '/' 
              ? pathname === '/' 
              : pathname === item.href || pathname.startsWith(item.href + '/')
              
            const isChat = item.code === 'chat'
            const hasUnread = isChat && unreadChatCount > 0

            const isAsesoria = item.code === 'pipeline-quirurgico'
            const isAsesoriaActive = pathname === '/pipeline-quirurgico' || pathname === '/asesoramiento-recepcion'
            
            const isGroupActive = isQuirofano ? isQuirofanoActive : isAsesoria ? isAsesoriaActive : isActive

            if (item.subItems && !isCollapsed) {
              const isMenuOpen = isQuirofano ? quirofanoMenuOpen : asesoriaMenuOpen
              const toggleMenu = () => {
                if (isQuirofano) setQuirofanoMenuOpen(!quirofanoMenuOpen)
                else if (isAsesoria) setAsesoriaMenuOpen(!asesoriaMenuOpen)
              }

              return (
                <div key={item.code} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={toggleMenu}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                      isGroupActive
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon size={19} className={isGroupActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                      <span className="truncate text-xs font-semibold tracking-tight">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAsesoria && recontactosPendientesCount > 0 && (
                        <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-0.5" title={`${recontactosPendientesCount} recontactos pendientes hoy o vencidos`}>
                          🔥 {recontactosPendientesCount}
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180 text-blue-600' : ''}`}
                      />
                    </div>
                  </button>

                  {isMenuOpen && (
                    <div className="pl-6 pr-1 flex flex-col gap-1 py-1 border-l-2 border-slate-200 dark:border-slate-800 ml-4">
                      {item.subItems.map((sub) => {
                        const SubIcon = sub.icon || Activity
                        const isSubActive = pathname === sub.href
                        const esPipeline = sub.code === 'pipeline-quirurgico'
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                              isSubActive
                                ? 'bg-blue-600 text-white font-bold shadow-sm'
                                : 'text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <SubIcon size={14} className={isSubActive ? 'text-white' : 'text-slate-400'} />
                              <span className="truncate">{sub.label}</span>
                            </div>
                            {esPipeline && recontactosPendientesCount > 0 && (
                              <span className={`px-1.5 py-0.2 text-[9.5px] font-bold rounded-full ${isSubActive ? 'bg-white text-blue-700' : 'bg-purple-500 text-white animate-pulse'}`}>
                                {recontactosPendientesCount}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? `${item.label}${hasUnread ? ` (${unreadChatCount} sin leer)` : isAsesoria && recontactosPendientesCount > 0 ? ` (${recontactosPendientesCount} recontactos)` : ''}` : undefined}
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
                  {isCollapsed && isAsesoria && recontactosPendientesCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-purple-500 rounded-full ring-2 ring-[var(--background)] animate-pulse" />
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
            <button
              type="button"
              onClick={() => {
                setSelfPassFeedback(null)
                setSelfNewPass('')
                setSelfConfirmPass('')
                setShowPassModal(true)
              }}
              className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 glow-primary hover:ring-2 hover:ring-blue-400 transition-all"
              title={`${displayName} (${profile?.username ? `@${profile.username} • ` : ''}${roleName}) - Clic para cambiar contraseña`}
            >
              {initials}
            </button>
            {!isCollapsed && (
              <div className="truncate min-w-0">
                <p className="text-xs font-bold leading-tight truncate text-[var(--foreground)]" title={displayName}>
                  {displayName}
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate" title={roleName}>
                  {profile?.username ? `@${profile.username} • ` : ''}{roleName}
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelfPassFeedback(null)
                  setSelfNewPass('')
                  setSelfConfirmPass('')
                  setShowPassModal(true)
                }}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                title="Cambiar mi contraseña"
              >
                <KeyRound size={15} />
              </button>
              <Link
                href="/ayuda"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                title="Centro de Ayuda y Manuales"
              >
                <HelpCircle size={15} />
              </Link>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
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

      {/* Modal Autogestión: Cambiar mi Contraseña */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--foreground)]">Cambiar mi Contraseña</h3>
                  <p className="text-[10px] text-[var(--secondary)]">
                    {profile?.username ? `Usuario: @${profile.username}` : userEmail}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPassModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSelfPasswordChange} className="p-4 space-y-3.5">
              {selfPassFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    selfPassFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                  }`}
                >
                  {selfPassFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{selfPassFeedback.message}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showSelfPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={selfNewPass}
                    onChange={(e) => setSelfNewPass(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfPass(!showSelfPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showSelfPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type={showSelfPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Repite la nueva contraseña"
                  value={selfConfirmPass}
                  onChange={(e) => setSelfConfirmPass(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="px-3.5 py-2 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold"
                  disabled={selfPassLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={selfPassLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 glow-primary disabled:opacity-50"
                >
                  {selfPassLoading && <Loader2 size={14} className="animate-spin" />}
                  <span>Guardar Clave</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
