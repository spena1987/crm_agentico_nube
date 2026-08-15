'use client'

import React, { useState } from 'react'
import { QrCode, Bot, Building2, Terminal, Settings, ShieldCheck, BookOpen } from 'lucide-react'
import WhatsAppConfigCard from '@/components/settings/WhatsAppConfigCard'
import BotSettingsCard from '@/components/settings/BotSettingsCard'
import ClinicProfileCard from '@/components/settings/ClinicProfileCard'
import SystemLogsCard from '@/components/settings/SystemLogsCard'
import NomencladorSettingsCard from '@/components/settings/NomencladorSettingsCard'

type TabType = 'whatsapp' | 'bot' | 'clinica' | 'nomenclador' | 'logs'

export default function AjustesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('whatsapp')

  const tabs = [
    { id: 'whatsapp' as TabType, label: 'WhatsApp & Vinculación QR', icon: QrCode, description: 'Sincronización multidispositivo con tu teléfono móvil' },
    { id: 'bot' as TabType, label: 'Agente IA & Automatización', icon: Bot, description: 'Directivas de Gemini, retardo de tipeo y escalamiento' },
    { id: 'clinica' as TabType, label: 'Perfil de la Clínica', icon: Building2, description: 'Datos del consultorio, horarios y mensajes' },
    { id: 'nomenclador' as TabType, label: 'Nomenclador & Aranceles', icon: BookOpen, description: 'Catálogos Geclisa, prácticas propias y precios' },
    { id: 'logs' as TabType, label: 'Monitor & Logs en Vivo', icon: Terminal, description: 'Consola técnica de eventos del daemon de WhatsApp' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
              <Settings size={24} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Centro de Ajustes y Configuración</h1>
          </div>
          <p className="text-sm text-[var(--secondary)] mt-1">
            Administra la vinculación de WhatsApp Web, la inteligencia artificial del agente, los aranceles y la información de la clínica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 shadow-sm">
            <ShieldCheck size={14} className="text-blue-600" />
            Neonize v0.2.1 • Multi-Device Ready
          </span>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-[var(--border)]">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center sm:items-start p-3 rounded-xl transition-all duration-200 text-left ${
                isActive 
                  ? 'bg-[var(--card)] text-blue-600 shadow-md shadow-slate-200/50 dark:shadow-none border border-[var(--border)]' 
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-white/50 dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span className="text-xs sm:text-sm font-bold truncate">{t.label}</span>
              </div>
              <span className="text-[11px] text-[var(--secondary)] hidden sm:block mt-1 truncate w-full">
                {t.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Contenido de la Pestaña Activa */}
      <div className="transition-all duration-300">
        {activeTab === 'whatsapp' && <WhatsAppConfigCard />}
        {activeTab === 'bot' && <BotSettingsCard />}
        {activeTab === 'clinica' && <ClinicProfileCard />}
        {activeTab === 'nomenclador' && <NomencladorSettingsCard />}
        {activeTab === 'logs' && <SystemLogsCard />}
      </div>
    </div>
  )
}

