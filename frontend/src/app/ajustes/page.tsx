'use client'

import React, { useState } from 'react'
import { QrCode, Bot, Building2, Terminal, BookOpen, FileCheck, ShieldCheck, Stethoscope } from 'lucide-react'
import WhatsAppConfigCard from '@/components/settings/WhatsAppConfigCard'
import BotSettingsCard from '@/components/settings/BotSettingsCard'
import ClinicProfileCard from '@/components/settings/ClinicProfileCard'
import SystemLogsCard from '@/components/settings/SystemLogsCard'
import NomencladorSettingsCard from '@/components/settings/NomencladorSettingsCard'
import BudgetTemplateDesignerCard from '@/components/settings/BudgetTemplateDesignerCard'
import SecuritySettingsCard from '@/components/settings/SecuritySettingsCard'
import SurgicalSettingsCard from '@/components/settings/SurgicalSettingsCard'

type TabType = 'whatsapp' | 'bot' | 'clinica' | 'quirurgico' | 'nomenclador' | 'plantilla_presupuesto' | 'seguridad' | 'logs'

export default function AjustesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('whatsapp')

  const tabs = [
    { id: 'whatsapp' as TabType, label: 'WhatsApp & QR', icon: QrCode, description: 'Sincronización multidispositivo' },
    { id: 'bot' as TabType, label: 'Agente IA', icon: Bot, description: 'Directivas y escalamiento' },
    { id: 'quirurgico' as TabType, label: 'Quirúrgico & Lead', icon: Stethoscope, description: 'SLA, plantillas y checklist' },
    { id: 'clinica' as TabType, label: 'Perfil Clínica', icon: Building2, description: 'Datos del consultorio' },
    { id: 'nomenclador' as TabType, label: 'Nomencladores', icon: BookOpen, description: 'Aranceles y catálogo' },
    { id: 'plantilla_presupuesto' as TabType, label: 'Diseñador PDF', icon: FileCheck, description: 'Plantilla de presupuestos' },
    { id: 'seguridad' as TabType, label: 'Seguridad & Sesión', icon: ShieldCheck, description: 'Inactividad y bloqueo' },
    { id: 'logs' as TabType, label: 'Monitor Logs', icon: Terminal, description: 'Consola técnica en vivo' },
  ]

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 space-y-5 max-w-7xl mx-auto w-full min-w-0 panel-scroll animate-fade-in">
      {/* Selector de Sub-Pestañas de Configuración */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-[var(--border)] shrink-0">
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
                <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span className="text-xs font-bold truncate">{t.label}</span>
              </div>
              <span className="text-[10px] text-[var(--secondary)] hidden sm:block mt-1 truncate w-full">
                {t.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Contenido de la Tarjeta Seleccionada */}
      <div className="transition-all duration-300">
        {activeTab === 'whatsapp' && <WhatsAppConfigCard />}
        {activeTab === 'bot' && <BotSettingsCard />}
        {activeTab === 'quirurgico' && <SurgicalSettingsCard />}
        {activeTab === 'clinica' && <ClinicProfileCard />}
        {activeTab === 'nomenclador' && <NomencladorSettingsCard />}
        {activeTab === 'plantilla_presupuesto' && <BudgetTemplateDesignerCard />}
        {activeTab === 'seguridad' && <SecuritySettingsCard />}
        {activeTab === 'logs' && <SystemLogsCard />}
      </div>
    </div>
  )
}
