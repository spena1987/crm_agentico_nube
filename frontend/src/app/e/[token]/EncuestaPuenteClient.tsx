'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Stethoscope,
  UserCheck,
} from 'lucide-react'

interface TurnoEncuestaItem {
  turno_id: number
  profesional: string
  sede: string
  servicio: string
  fecha: string
  horario: string
  ya_abierto: boolean
  surveymonkey_url: string
}

interface EncuestaPublicaResponse {
  estado: 'valido' | 'expirado' | 'no_encontrado'
  turnos: TurnoEncuestaItem[]
}

export default function EncuestaPuenteClient({ token }: { token: string }) {
  const [data, setData] = useState<EncuestaPublicaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setErrorMsg(null)
        const res = await fetch(`/api/encuestas-publico/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error('No se pudo cargar la encuesta en este momento.')
        }
        const json: EncuestaPublicaResponse = await res.json()
        if (!cancelled) {
          setData(json)
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Error al cargar el enlace de encuesta.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleOpenSurvey = (turno: TurnoEncuestaItem) => {
    // Registro no bloqueante same-origin para no demorar ni impedir la apertura de SurveyMonkey
    const clickUrl = `/api/encuestas-publico/${encodeURIComponent(token)}/click`
    try {
      fetch(clickUrl, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: turno.turno_id }),
      }).catch(() => {})
    } catch {
      // Ignorar errores de telemetría para priorizar la respuesta del paciente
    }

    setData((prev) =>
      prev
        ? {
            ...prev,
            turnos: prev.turnos.map((t) =>
              t.turno_id === turno.turno_id ? { ...t, ya_abierto: true } : t
            ),
          }
        : prev
    )

    window.location.assign(turno.surveymonkey_url)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-600 font-medium">Cargando información de tu atención...</p>
        </div>
      </main>
    )
  }

  if (errorMsg || !data || data.estado === 'no_encontrado' || data.estado === 'expirado') {
    const isExpired = data?.estado === 'expirado'
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            {isExpired ? 'Este enlace ha vencido' : 'Enlace no disponible'}
          </h1>
          <p className="text-sm text-slate-600">
            {errorMsg ||
              (isExpired
                ? 'El plazo para completar esta encuesta ya finalizó. Muchas gracias por tu tiempo.'
                : 'No pudimos encontrar una encuesta válida para este enlace.')}
          </p>
        </div>
      </main>
    )
  }

  const multiple = data.turnos.length > 1

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2 text-center">
          <h1 className="text-xl font-bold text-slate-900">
            {multiple ? '¿Cómo fue tu atención en la clínica?' : 'Contanos cómo fue tu atención'}
          </h1>
          <p className="text-sm text-slate-600">
            {multiple
              ? 'Registramos más de una atención en esa jornada. Podés responder la encuesta de cada una por separado.'
              : 'Tu opinión nos ayuda a mejorar la atención médica y las instalaciones.'}
          </p>
        </div>

        <div className="space-y-4">
          {data.turnos.map((turno) => (
            <div
              key={turno.turno_id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 text-slate-900 font-semibold">
                  <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>{turno.profesional}</span>
                </div>
                {turno.ya_abierto && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Abierta
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{turno.servicio}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{turno.sede}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{turno.fecha}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{turno.horario} hs</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenSurvey(turno)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 transition-colors"
              >
                <span>Responder encuesta</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
