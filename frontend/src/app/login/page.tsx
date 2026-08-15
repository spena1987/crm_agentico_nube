'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Activity, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user, loading, signIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Si ya está autenticado, redirigir al dashboard principal
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!email.trim() || !password) {
      setErrorMsg('Por favor, ingresa tu correo electrónico y contraseña.')
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Credenciales incorrectas. Verifica tu correo y contraseña.')
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMsg('El correo electrónico no ha sido confirmado aún.')
        } else {
          setErrorMsg(error.message || 'Error al iniciar sesión. Intenta nuevamente.')
        }
        setIsSubmitting(false)
      } else {
        router.push('/')
      }
    } catch (err: any) {
      setErrorMsg('Ocurrió un error inesperado al conectar con el servidor de autenticación.')
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-[var(--secondary)]">Cargando sesión segura...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--background)] relative overflow-hidden">
      {/* Elementos visuales de fondo */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl p-8 relative z-10">
        {/* Cabecera y Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 rounded-2xl bg-blue-600/10 text-blue-600 mb-4 glow-primary">
            <Activity size={32} className="animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            MedCRM Clínico
          </h1>
          <p className="text-sm text-[var(--secondary)] mt-1.5">
            Ingreso exclusivo para personal médico y administrativo autorizado
          </p>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--secondary)] mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@clinica.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--secondary)] mb-2">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 bg-slate-50 dark:bg-slate-900/50 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Iniciar Sesión</span>
              </>
            )}
          </button>
        </form>

        {/* Nota de acceso por invitación */}
        <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
          <p className="text-xs text-[var(--secondary)] flex items-center justify-center gap-1.5">
            <Lock size={13} className="shrink-0" />
            Acceso restringido. Nuevas cuentas deben ser dadas de alta por la administración en Supabase.
          </p>
        </div>
      </div>
    </div>
  )
}
