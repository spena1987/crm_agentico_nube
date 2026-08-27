'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

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
  } | null
}

export interface PermissionItem {
  modulo_codigo: string
  accion: string
  permitido: boolean
}

export function usePermissions() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setPermissions([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      // 1. Obtener el perfil del usuario logueado
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
            es_sistema
          )
        `)
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error al cargar perfil de usuario:', profileError)
      }

      if (profileData) {
        setProfile(profileData as unknown as UserProfile)

        // 2. Si tiene un rol asignado, cargar los permisos de ese rol
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
        }
      } else {
        // Si no existe perfil en la tabla pero está autenticado (ej. superadmin inicial creado desde dashboard),
        // se asume rol admin para no bloquear al creador
        setProfile({
          id: user.id,
          email: user.email || '',
          nombre_completo: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Administrador',
          rol_id: 'a0000000-0000-0000-0000-000000000001',
          activo: true,
          roles: {
            id: 'a0000000-0000-0000-0000-000000000001',
            codigo: 'admin',
            nombre: 'Administrador General',
            es_sistema: true,
          }
        })
      }
    } catch (err) {
      console.error('Error al inicializar permisos:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  // ¿Es Administrador?
  const isAdmin = profile?.roles?.codigo === 'admin' || !profile?.rol_id

  // Función para verificar si tiene una acción específica en un módulo
  const can = useCallback((modulo: string, accion: string = 'ver'): boolean => {
    // Si es Administrador, tiene acceso total a todo
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

  return {
    profile,
    permissions,
    isAdmin,
    loading,
    can,
    canAccess,
    refreshPermissions: loadPermissions,
  }
}
