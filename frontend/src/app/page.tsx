'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, FileText, Bot, DollarSign, ArrowUpRight, Activity, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const [stats, setStats] = useState({
    pacientesCount: 0,
    presupuestosCount: 0,
    activeBots: 0,
    totalFacturado: 0
  })
  const [loading, setLoading] = useState(true)

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // 1. Contar pacientes
      const { count: pacsCount } = await supabase.from('pacientes').select('*', { count: 'exact', head: true })
      
      // 2. Contar presupuestos
      const { count: presCount } = await supabase.from('presupuestos').select('*', { count: 'exact', head: true })
      
      // 3. Contar conversaciones con bot activo (bot_disabled = false)
      const { count: activeBotsCount } = await supabase.from('conversaciones').select('*', { count: 'exact', head: true }).eq('bot_disabled', false)
      
      // 4. Calcular suma de presupuestos aprobados
      const { data: presSum } = await supabase.from('presupuestos').select('total').eq('estado', 'aprobado')
      
      const totalFact = presSum ? presSum.reduce((acc, curr) => acc + Number(curr.total), 0) : 0

      setStats({
        pacientesCount: pacsCount || 0,
        presupuestosCount: presCount || 0,
        activeBots: activeBotsCount || 0,
        totalFacturado: totalFact
      })
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const statCards = [
    {
      title: 'Pacientes Registrados',
      value: stats.pacientesCount,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20',
      description: 'Total de JIDs de WhatsApp capturados',
      link: '/pacientes'
    },
    {
      title: 'Presupuestos Emitidos',
      value: stats.presupuestosCount,
      icon: FileText,
      color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/20',
      description: 'Presupuestos médicos generados',
      link: '/presupuestos'
    },
    {
      title: 'Bots de WhatsApp Activos',
      value: stats.activeBots,
      icon: Bot,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20',
      description: 'Conversaciones automatizadas',
      link: '/chat'
    },
    {
      title: 'Facturación Aprobada',
      value: `$${stats.totalFacturado.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20',
      description: 'Total de presupuestos aceptados',
      link: '/presupuestos'
    }
  ]

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full">
      {/* Saludo y Fecha */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Panel de Control</h1>
          <p className="text-xs text-[var(--secondary)] font-medium">
            Bienvenido al gestor inteligente de la clínica médica.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm">
          <Calendar size={15} className="text-blue-600" />
          <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <div 
              key={idx} 
              className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative group overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--secondary)] uppercase tracking-wider">{card.title}</span>
                <div className={`p-2.5 rounded-xl ${card.color} transition-all group-hover:scale-110`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="mt-4">
                {loading ? (
                  <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
                ) : (
                  <span className="text-2xl font-black tracking-tight">{card.value}</span>
                )}
                <p className="text-[11px] text-[var(--secondary)] mt-1.5 font-medium">{card.description}</p>
              </div>
              <Link 
                href={card.link}
                className="absolute bottom-4 right-4 text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
              >
                Ver <ArrowUpRight size={13} />
              </Link>
            </div>
          )
        })}
      </div>

      {/* Vista de Actividades Médicas / Agenda Simulada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Accesos rápidos */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Activity size={18} className="text-blue-600" />
            Acciones Clave del CRM
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link 
              href="/chat" 
              className="p-4 rounded-xl border border-[var(--border)] hover:border-blue-500/50 hover:bg-blue-50/10 transition-all flex flex-col justify-between h-28"
            >
              <div>
                <p className="text-xs font-bold leading-snug">Responder Chats</p>
                <p className="text-[10px] text-[var(--secondary)] mt-1">Inbox de WhatsApp integrado con switch de operador humano.</p>
              </div>
              <span className="text-xs font-semibold text-blue-600 flex items-center gap-0.5">Abrir Chats →</span>
            </Link>

            <Link 
              href="/presupuestos" 
              className="p-4 rounded-xl border border-[var(--border)] hover:border-cyan-500/50 hover:bg-cyan-50/10 transition-all flex flex-col justify-between h-28"
            >
              <div>
                <p className="text-xs font-bold leading-snug">Generar Presupuesto</p>
                <p className="text-[10px] text-[var(--secondary)] mt-1">Crear cotizaciones médicas con cálculo automático y exportación en PDF.</p>
              </div>
              <span className="text-xs font-semibold text-cyan-600 flex items-center gap-0.5">Generar →</span>
            </Link>
          </div>
        </div>

        {/* Estado de Integración de WhatsApp */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Bot size={18} className="text-emerald-500" />
            Agente Inteligente
          </h2>
          
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl flex items-center justify-between">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">Motor Gemini AI</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-[10px] text-emerald-800 dark:text-emerald-400 font-bold">Activo (v2.5)</span>
            </div>
            
            <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
              El bot monitorea y responde consultas sobre turnos, especialidades y presupuestos de manera automática. Para dudas de salud complejas, deriva automáticamente al personal médico.
            </p>
            
            <div className="border-t border-[var(--border)] pt-3.5 flex justify-between items-center">
              <span className="text-[10px] text-[var(--secondary)] font-bold uppercase">Sesión QR WhatsApp</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" title="Sesión activa" />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
