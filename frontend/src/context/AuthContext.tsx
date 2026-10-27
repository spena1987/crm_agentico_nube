'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Obtener la sesión inicial
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
      } catch (err) {
        console.error('Error al obtener la sesión inicial:', err)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // 2. Escuchar cambios de estado en tiempo real (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        if (_event === 'SIGNED_OUT') {
          try {
            sessionStorage.removeItem('crm_pipeline_session_v1')
          } catch (_) {}
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (identifier: string, password: string) => {
    try {
      const cleanId = identifier.trim()
      let targetEmail = cleanId.toLowerCase()

      // Resolver si es nombre de usuario o verificar estado activo de la cuenta
      try {
        const res = await fetch('/api/auth/resolve-identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanId }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo verificar la cuenta.')
        }

        if (data.email) {
          targetEmail = data.email
        }
      } catch (resolveErr: any) {
        // Si el endpoint devolvió explícitamente error de cuenta inactiva, propagarlo
        if (resolveErr.message && resolveErr.message.includes('desactivada')) {
          throw resolveErr
        }
        // Si hubo un fallo de red y no contiene '@', no podrá autenticar directamente
        if (!cleanId.includes('@')) {
          throw new Error('Error al resolver el nombre de usuario. Verifica tu conexión.')
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      })
      if (error) throw error
      return { error: null }
    } catch (error: any) {
      return { error }
    }
  }

  const signOut = async () => {
    try {
      try {
        sessionStorage.removeItem('crm_pipeline_session_v1')
      } catch (_) {}
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}
