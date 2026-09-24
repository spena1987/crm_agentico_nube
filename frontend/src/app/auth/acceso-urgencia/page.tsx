'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, AlertTriangle, Loader2, ArrowRight, Lock, Stethoscope } from 'lucide-react'
import Link from 'next/link'

function AccesoUrgenciaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [estado, setEstado] = useState<'validando' | 'autenticando' | 'exito' | 'error'>('validando')
  const [mensaje, setMensaje] = useState<string>('Validando credenciales médicas de emergencia...')
  const [errorInfo, setErrorInfo] = useState<{
    titulo: string
    detalle: string
    redirectUrl: string
  } | null>(null)

  useEffect(() => {
    if (!token) {
      setErrorInfo({
        titulo: 'Enlace Incompleto',
        detalle: 'No se ha detectado el token criptográfico de acceso de urgencia.',
        redirectUrl: '/login'
      })
      setEstado('error')
      return
    }

    const ejecutarAcceso = async () => {
      try {
        setEstado('validando')
        setMensaje('Validando token de seguridad quirúrgica...')

        const res = await fetch('/api/auth/acceso-urgencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.trim() })
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          const isExpired = data.code === 'EXPIRED'
          const isUsed = data.code === 'ALREADY_USED'

          const convUrl = data.conversacionId ? `/chat?conv=${data.conversacionId}` : '/chat'
          const loginTarget = `/login?returnUrl=${encodeURIComponent(convUrl)}&reason=token_expired`

          setErrorInfo({
            titulo: isExpired 
              ? 'Enlace de Urgencia Caducado' 
              : isUsed 
              ? 'Enlace ya Utilizado Previamente' 
              : 'Acceso no Válido',
            detalle: data.error || 'No se pudo verificar la autenticidad del enlace de urgencia.',
            redirectUrl: loginTarget
          })
          setEstado('error')
          return
        }

        // Token validado con éxito. Iniciar sesión formal en Supabase Auth.
        setEstado('autenticando')
        setMensaje(`Iniciando sesión segura para Dr./Dra. ${data.medico?.nombre || ''}...`)

        let sesionIniciada = false

        // 1. Intento primario: verifyOtp client-side con token_hash (Magic Link directo)
        if (data.hashedToken) {
          try {
            const { data: authData, error: authError } = await supabase.auth.verifyOtp({
              token_hash: data.hashedToken,
              type: 'magiclink'
            })

            if (!authError && authData.session) {
              sesionIniciada = true
            }
          } catch (otpErr) {
            console.warn('[AccesoUrgencia] Falló verifyOtp client-side, usando actionLink fallback:', otpErr)
          }
        }

        // 2. Si verifyOtp tuvo éxito, redirigir inmediatamente al chat
        if (sesionIniciada) {
          setEstado('exito')
          setMensaje('¡Autenticación exitosa! Abriendo chat de urgencia del paciente...')
          setTimeout(() => {
            router.replace(data.redirectUrl)
          }, 300)
          return
        }

        // 3. Fallback infalible: Redireccionar al actionLink oficial de Supabase
        if (data.actionLink) {
          setEstado('exito')
          setMensaje('Redirigiendo al expediente quirúrgico...')
          window.location.href = data.actionLink
          return
        }

        // 4. Último fallback: Redirigir al chat directamente
        setEstado('exito')
        router.replace(data.redirectUrl)
      } catch (err: any) {
        console.error('[AccesoUrgencia] Error en proceso de validación:', err)
        setErrorInfo({
          titulo: 'Error de Conexión',
          detalle: 'Ocurrió un inconveniente al conectar con el servidor de autenticación médica.',
          redirectUrl: '/login'
        })
        setEstado('error')
      }
    }

    ejecutarAcceso()
  }, [token, router])

  if (estado === 'error' && errorInfo) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center mx-auto text-red-400 shadow-inner">
            <AlertTriangle size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight">
              {errorInfo.titulo}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {errorInfo.detalle}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-slate-800 text-[11px] text-slate-400 text-left space-y-1">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock size={12} className="text-amber-400 shrink-0" />
              <span>Seguridad de Datos Clínicos</span>
            </p>
            <p className="leading-normal">
              Por confidencialidad médica y normativa legal, los enlaces directos expiran a los 30 minutos o tras el primer acceso. Puedes ingresar al caso iniciando sesión con tus credenciales habituales.
            </p>
          </div>

          <Link
            href={errorInfo.redirectUrl}
            className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            <span>Iniciar Sesión en el CRM</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in duration-300">
        <div className="relative w-16 h-16 rounded-2xl bg-blue-950/80 border border-blue-500/50 flex items-center justify-center mx-auto text-blue-400 shadow-inner">
          <Stethoscope size={30} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-slate-900 animate-ping" />
        </div>

        <div className="space-y-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Acceso Rápido de Urgencia Quirúrgica
          </span>
          <h2 className="text-lg font-black text-white tracking-tight">
            Centrovisión Oftalmología
          </h2>
          <p className="text-xs text-slate-300 min-h-[36px] flex items-center justify-center">
            {mensaje}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 pt-2">
          <Loader2 size={30} className="animate-spin text-blue-400" />
          <span className="text-[11px] text-slate-500 font-medium">
            Estableciendo sesión médica cifrada de un solo uso...
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AccesoUrgenciaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400 text-xs">
          Cargando verificación de urgencia...
        </div>
      }
    >
      <AccesoUrgenciaContent />
    </Suspense>
  )
}
