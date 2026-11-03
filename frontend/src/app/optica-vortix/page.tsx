'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Glasses,
  MessageSquare,
  Sparkles,
  Megaphone,
  Cpu,
  ArrowRight,
  ShieldCheck,
  TicketPercent,
  Eye,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import { apiFetch } from '@/lib/api'
import { OpticaSaludLinea } from '@/types/optica'

export default function OpticaVortixHubPage() {
  const [salud, setSalud] = useState<OpticaSaludLinea | null>(null)
  const [stats, setStats] = useState({
    conversacionesActivas: 0,
    oportunidadesHoy: 0,
    campanasActivas: 0,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [resS, resC, resO, resM] = await Promise.all([
          apiFetch('/api/optica-vortix/salud-linea', { cache: 'no-store' }).catch(() => null),
          apiFetch('/api/optica-vortix/conversaciones', { cache: 'no-store' }).catch(() => null),
          apiFetch(`/api/optica-vortix/oportunidades?fecha=${today}`, { cache: 'no-store' }).catch(() => null),
          apiFetch('/api/optica-vortix/campanas', { cache: 'no-store' }).catch(() => null),
        ])
        if (resS?.ok) setSalud(await resS.json())
        const convs = resC?.ok ? await resC.json() : []
        const opor = resO?.ok ? await resO.json() : []
        const camps = resM?.ok ? await resM.json() : []
        setStats({
          conversacionesActivas: Array.isArray(convs) ? convs.length : convs?.items?.length || 0,
          oportunidadesHoy: Array.isArray(opor) ? opor.length : opor?.items?.length || 0,
          campanasActivas: Array.isArray(camps) ? camps.length : camps?.items?.length || 0,
        })
      } catch {}
    }
    load()
  }, [])

  const cards = [
    {
      href: '/optica-vortix/chat',
      title: 'Chat Comercial & Cotizador Óptico',
      subtitle: 'Embudo WhatsApp Línea 3 + Ficha 360°',
      description:
        'Atiende consultas con etiquetas de embudo óptico, visor OCR de recetas con Gemini Vision, cotizador comparativo en 1 clic y aviso automático de lentes listos.',
      icon: MessageSquare,
      accent: 'from-indigo-600 to-blue-600',
      badge: `${stats.conversacionesActivas} conversaciones`,
    },
    {
      href: '/optica-vortix/oportunidades',
      title: 'Oportunidades del Día (Geclisa)',
      subtitle: 'Recetas Aéreas, Contacto y Turnos Próximos',
      description:
        'Detecta pacientes atendidos hoy con indicación de lentes aéreos o de contacto en la evolución médica de Geclisa (excluyendo LIO quirúrgico) y contactalos en 1 clic.',
      icon: Sparkles,
      accent: 'from-emerald-600 to-teal-600',
      badge: `${stats.oportunidadesHoy} oportunidades hoy`,
    },
    {
      href: '/optica-vortix/campanas',
      title: 'Campañas & Placas Anti-Bloqueo',
      subtitle: 'Estrategia Doble Paso & Goteo Humanizado',
      description:
        'Galería de placas gráficas con descuento, constructor de campañas en 4 pasos, exclusión de opt-out/cooldown y monitoreo del Quality Rating en Meta.',
      icon: Megaphone,
      accent: 'from-amber-500 to-orange-600',
      badge: `${stats.campanasActivas} campañas`,
    },
    {
      href: '/optica-vortix/automatizaciones',
      title: 'Automatizaciones & Vinculación Línea 3',
      subtitle: 'Meta Cloud API (WABA 3731563350343089)',
      description:
        'Vincula la 3ra línea telefónica en Meta, configura el envío automático de voucher a turnos a N días vista con Dry-Run en vivo y ajusta las reglas de detección clínica.',
      icon: Cpu,
      accent: 'from-violet-600 to-purple-600',
      badge: salud?.connected ? 'Línea 3 Conectada' : 'Configurar Línea 3',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <OpticaSubNavHeader />

      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-violet-900 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-indigo-500/20">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold text-indigo-200 border border-white/15">
                <Glasses size={14} />
                <span>Módulo Independiente • Tercera Línea Oficial WhatsApp</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                Óptica Vortix — Conversión Clínica a Venta Óptica
              </h1>
              <p className="text-xs md:text-sm text-indigo-100/80 leading-relaxed">
                Conectado en tiempo real con <strong>Geclisa</strong> para transformar turnos futuros y recetas médicas del día en ventas de lentes aéreos, armazones y lentes de contacto con protección anti-bloqueo de Meta.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                href="/optica-vortix/chat"
                className="px-4 py-2.5 rounded-xl bg-white text-indigo-950 font-black text-xs flex items-center gap-2 shadow-lg hover:bg-indigo-50 transition-all"
              >
                <MessageSquare size={15} />
                Abrir Chat Comercial
              </Link>
              <Link
                href="/optica-vortix/oportunidades"
                className="px-4 py-2.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/40 border border-white/20 text-white font-bold text-xs flex items-center gap-2 transition-all"
              >
                <Sparkles size={15} />
                Ver Recetas de Hoy
              </Link>
            </div>
          </div>
        </div>

        {/* Tarjetas de las 4 Vistas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.accent} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                    >
                      <Icon size={22} />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-[var(--foreground)] border border-[var(--border)]">
                      {card.badge}
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {card.subtitle}
                    </p>
                    <h2 className="text-base font-black text-[var(--foreground)] mt-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {card.title}
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--secondary)] leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>Ingresar a la consola</span>
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Pilares Operativos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TicketPercent size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-[var(--foreground)]">
                Automatización 1: Voucher Pre-Turno
              </h3>
              <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                Envía placa de descuento a pacientes con turno de consultorio mañana para que coticen sus lentes al salir.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-[var(--foreground)]">
                Automatización 2: Detección de Recetas
              </h3>
              <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                Analiza evoluciones del día en Geclisa identificando prescripciones de lentes aéreos o de contacto.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-[var(--foreground)]">
                Escudo Anti-Bloqueo Meta
              </h3>
              <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                Deduplicación por grupo familiar, goteo humanizado con jitter, respeto de opt-out y pausa automática por Quality Rating.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
