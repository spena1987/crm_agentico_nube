'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Glasses,
  MessageSquare,
  Sparkles,
  Megaphone,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Radio,
  RefreshCw,
  MessageSquareText,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { OpticaSaludLinea } from '@/types/optica'

const SUB_TABS = [
  {
    href: '/optica-vortix/chat',
    label: 'Chat Comercial',
    shortLabel: 'Chat',
    icon: MessageSquare,
    badgeColor: 'bg-indigo-500',
  },
  {
    href: '/optica-vortix/oportunidades',
    label: 'Oportunidades Geclisa (Hoy)',
    shortLabel: 'Oportunidades',
    icon: Sparkles,
    badgeColor: 'bg-emerald-500',
  },
  {
    href: '/optica-vortix/campanas',
    label: 'Campañas Anti-Bloqueo',
    shortLabel: 'Campañas',
    icon: Megaphone,
    badgeColor: 'bg-amber-500',
  },
  {
    href: '/optica-vortix/automatizaciones',
    label: 'Automatizaciones & Línea 3',
    shortLabel: 'Automatismos',
    icon: Cpu,
    badgeColor: 'bg-purple-500',
  },
  {
    href: '/optica-vortix/plantillas',
    label: 'Plantillas WhatsApp (Meta)',
    shortLabel: 'Plantillas Meta',
    icon: MessageSquareText,
    badgeColor: 'bg-blue-500',
  },
]

export default function OpticaSubNavHeader({
  rightSlot,
}: {
  rightSlot?: React.ReactNode
}) {
  const pathname = usePathname()
  const [salud, setSalud] = useState<OpticaSaludLinea | null>(null)
  const [loadingSalud, setLoadingSalud] = useState(false)

  const fetchSalud = async () => {
    setLoadingSalud(true)
    try {
      const res = await apiFetch('/api/optica-vortix/salud-linea', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setSalud(data)
      }
    } catch {
      // Fallback silencioso
    } finally {
      setLoadingSalud(false)
    }
  }

  useEffect(() => {
    fetchSalud()
    const timer = setInterval(fetchSalud, 30000)
    return () => clearInterval(timer)
  }, [])

  const quality = (salud?.quality_rating || 'GREEN').toUpperCase()
  const qualityBadge =
    quality === 'GREEN'
      ? {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
          label: 'Calidad GREEN',
        }
      : quality === 'YELLOW'
      ? {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
          label: 'Calidad YELLOW',
        }
      : quality === 'RED'
      ? {
          bg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
          dot: 'bg-red-500',
          label: 'Calidad RED',
        }
      : {
          bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30',
          dot: 'bg-slate-400',
          label: 'Sin Vincular',
        }

  return (
    <header className="sticky top-0 z-20 bg-[var(--card)]/95 backdrop-blur-md border-b border-[var(--border)] px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Identidad Óptica Vortix + Pestañas */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/optica-vortix"
            className="flex items-center gap-2.5 pr-3 border-r border-[var(--border)] group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Glasses size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-[var(--foreground)]">
                  Óptica Vortix
                </span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Línea 3
                </span>
              </div>
              <p className="text-[10px] text-[var(--secondary)] font-medium leading-none mt-0.5">
                Conversión Clínica & WhatsApp Meta
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl border border-[var(--border)]">
            {SUB_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-white/60 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Semáforo en Vivo de la Línea 3 en Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {rightSlot}

          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border)] text-[11px]">
            <div className="flex items-center gap-1.5">
              <Radio
                size={13}
                className={salud?.connected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}
              />
              <span className="font-bold text-[var(--foreground)]">
                {salud?.display_phone_number || 'Línea 3 Óptica'}
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${qualityBadge.bg}`}
              title="Calidad de la línea en Meta WhatsApp Cloud API"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${qualityBadge.dot}`} />
              {qualityBadge.label}
            </span>

            <span
              className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]"
              title="Límite diario de conversaciones de negocio en Meta"
            >
              <ShieldCheck size={11} />
              {salud?.messaging_limit_tier || 'TIER_1K'}
            </span>

            <span
              className="hidden xl:inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--secondary)]"
              title="Envíos últimas 24h / En cola anti-bloqueo"
            >
              24h: <strong className="text-[var(--foreground)]">{salud?.enviados_ultimas_24h ?? 0}</strong> • Cola:{' '}
              <strong className="text-indigo-600 dark:text-indigo-400">{salud?.cola_pendientes ?? 0}</strong>
            </span>

            {salud?.circuit_breaker_activo && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-bold">
                <AlertTriangle size={11} /> Pausa Protectora
              </span>
            )}

            <button
              type="button"
              onClick={fetchSalud}
              className="p-1 rounded-lg text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              title="Actualizar estado de Línea 3 en Meta"
            >
              <RefreshCw size={12} className={loadingSalud ? 'animate-spin text-indigo-500' : ''} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
