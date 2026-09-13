'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { LANDING_PAGE_OPTIONS } from '@/config/modules'

export interface UserProfile {
  id: string
  email: string
  nombre_completo: string
  rol_id: string | null
  activo: boolean
  geclisa_pre_id?: number | null
  geclisa_matricula?: string | null
  geclisa_prestador_nombre?: string | null
  roles?: {
    id: string
    codigo: string
    nombre: string
    es_sistema: boolean
    landing_page?: string | null
  } | null
}

export interface PermissionItem {
  modulo_codigo: string
  accion: string
  permitido: boolean
}

interface PermissionsContextType {
  profile: UserProfile | null
  permissions: PermissionItem[]
  isAdmin: boolean
  loading: boolean
  isRevalidating: boolean
  effectiveLandingRoute: string
  can: (modulo: string, accion?: string) => boolean
  canAccess: (modulo: string) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | null>(null)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isRevalidating, setIsRevalidating] = useState(false)

  // Referencias para evitar re-solicitudes destructivas
  const userId = user?.id || null
  const prevUserIdRef = useRef<string | null>(null)
  const profileRef = useRef<UserProfile | null>(null)
  profileRef.current = profile

  const loadPermissions = useCallback(async (isSilent: boolean = false) => {
    if (!userId) {
      setProfile(null)
      setPermissions([])
      setLoading(false)
      setIsRevalidating(false)
      prevUserIdRef.current = null
      return
    }

    // Si es revalidación silenciosa y ya tenemos datos, no bloqueamos la UI con loading=true
    if (isSilent && profileRef.current) {
      setIsRevalidating(true)
    } else {
      setLoading(true)
    }

    try {
      // 1. Obtener perfil del usuario
      const { data: profileData, error: profileError } = await supabase
        .from('usuarios_perfil')
        .select(`
          id,
          email,
          nombre_completo,
          rol_id,
          activo,
          geclisa_pre_id,
          geclisa_matricula,
          geclisa_prestador_nombre,
          roles (
            id,
            codigo,
            nombre,
            es_sistema,
            landing_page
          )
        `)
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        console.error('Error al cargar perfil en PermissionsContext:', profileError)
      }

      if (profileData) {
        // Seguridad: Si fue desactivado por un administrador, forzar logout inmediato
        if (profileData.activo === false) {
          console.warn('Usuario desactivado detectado. Cerrando sesión de inmediato...')
          await supabase.auth.signOut()
          window.location.href = '/login?error=account_deactivated'
          return
        }

        setProfile(profileData as unknown as UserProfile)

        // 2. Si tiene rol, cargar permisos
        if (profileData.rol_id) {
          const { data: permData, error: permError } = await supabase
            .from('rol_permisos')
            .select('modulo_codigo, accion, permitido')
            .eq('rol_id', profileData.rol_id)

          if (permError) {
            console.error('Error al cargar permisos del rol:', permError)
          } else {
            setPermissions(permData || [])
          }
        } else {
          setPermissions([])
        }
      } else if (!profileRef.current) {
        // Fallback superadmin inicial
        setProfile({
          id: userId,
          email: user?.email || '',
          nombre_completo: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Administrador',
          rol_id: 'a0000000-0000-0000-0000-000000000001',
          activo: true,
          roles: {
            id: 'a0000000-0000-0000-0000-000000000001',
            codigo: 'admin',
            nombre: 'Administrador General',
            es_sistema: true,
            landing_page: '/'
          }
        })
      }

      prevUserIdRef.current = userId
    } catch (err) {
      console.error('Error al inicializar permisos en contexto:', err)
    } finally {
      setLoading(false)
      setIsRevalidating(false)
    }
  }, [userId, user?.email, user?.user_metadata])

  // Carga inicial o revalidación por cambio de ID de usuario
  useEffect(() => {
    const isNewUser = userId !== prevUserIdRef.current
    if (isNewUser) {
      // Cambio real de usuario o primer arranque: carga completa
      loadPermissions(false)
    } else {
      // Re-render o foco de ventana con el mismo usuario: revalidación silenciosa en background
      loadPermissions(true)
    }
  }, [userId, loadPermissions])

  // ¿Es Administrador?
  const isAdmin = useMemo(() => {
    return profile?.roles?.codigo === 'admin' || !profile?.rol_id
  }, [profile])

  // Función para verificar si tiene una acción específica en un módulo
  const can = useCallback((modulo: string, accion: string = 'ver'): boolean => {
    if (isAdmin) return true
    const perm = permissions.find(
      (p) => p.modulo_codigo === modulo && p.accion === accion
    )
    return perm ? perm.permitido : false
  }, [isAdmin, permissions])

  // Función para verificar si puede acceder/ver un módulo
  const canAccess = useCallback((modulo: string): boolean => {
    return can(modulo, 'ver')
  }, [can])

  // Calcular la ruta de inicio efectiva
  const effectiveLandingRoute = useMemo((): string => {
    if (isAdmin) {
      return profile?.roles?.landing_page || '/'
    }

    const assignedLanding = profile?.roles?.landing_page
    if (assignedLanding) {
      const match = LANDING_PAGE_OPTIONS.find((opt) => opt.route === assignedLanding)
      if (match && canAccess(match.moduleCode)) {
        return assignedLanding
      }
    }

    const firstAllowed = LANDING_PAGE_OPTIONS.find((opt) => canAccess(opt.moduleCode))
    if (firstAllowed) {
      return firstAllowed.route
    }

    return '/'
  }, [isAdmin, profile, canAccess])

  const value = useMemo(() => ({
    profile,
    permissions,
    isAdmin,
    loading,
    isRevalidating,
    effectiveLandingRoute,
    can,
    canAccess,
    refreshPermissions: () => loadPermissions(false),
  }), [profile, permissions, isAdmin, loading, isRevalidating, effectiveLandingRoute, can, canAccess, loadPermissions])

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (!context) {
    throw new Error('usePermissions debe ser utilizado dentro de un PermissionsProvider')
  }
  return context
}
