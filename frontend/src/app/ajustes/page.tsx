'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  QrCode, 
  Bot, 
  Building2, 
  Terminal, 
  BookOpen, 
  FileCheck, 
  ShieldCheck, 
  Stethoscope, 
  CalendarClock, 
  Users, 
  Loader2,
  Search,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  X
} from 'lucide-react'
import WhatsAppConfigCard from '@/components/settings/WhatsAppConfigCard'
import BotSettingsCard from '@/components/settings/BotSettingsCard'
import ClinicProfileCard from '@/components/settings/ClinicProfileCard'
import SystemLogsCard from '@/components/settings/SystemLogsCard'
import NomencladorSettingsCard from '@/components/settings/NomencladorSettingsCard'
import BudgetTemplateDesignerCard from '@/components/settings/BudgetTemplateDesignerCard'
import SecuritySettingsCard from '@/components/settings/SecuritySettingsCard'
import SurgicalSettingsCard from '@/components/settings/SurgicalSettingsCard'
import QuirofanoSettingsCard from '@/components/settings/QuirofanoSettingsCard'
import PrestadoresSettingsCard from '@/components/settings/PrestadoresSettingsCard'

type TabType = 
  | 'whatsapp' 
  | 'bot' 
  | 'quirurgicos_turnos' 
  | 'prestadores' 
  | 'quirurgico' 
  | 'clinica' 
  | 'nomenclador' 
  | 'plantilla_presupuesto' 
  | 'seguridad' 
  | 'logs'

interface TabItem {
  id: TabType
  label: string
  icon: any
  description: string
  badge?: string
}

interface TabCategory {
  id: string
  label: string
  icon: any
  items: TabItem[]
}

const tabCategories: TabCategory[] = [
  {
    id: 'automation',
    label: 'Canales & Automatización',
    icon: Bot,
    items: [
      { id: 'whatsapp', label: 'WhatsApp & Gateway', icon: QrCode, description: 'Sincronización QR y estado de sesión' },
      { id: 'bot', label: 'Agente IA Gemini', icon: Bot, description: 'Directivas, prompt y escalamiento', badge: 'v2.5' },
    ]
  },
  {
    id: 'surgical',
    label: 'Gestión Médica & Quirúrgica',
    icon: Stethoscope,
    items: [
      { id: 'quirurgicos_turnos', label: 'Quirófano & Consentimientos', icon: CalendarClock, description: 'Salas, slots y confirmaciones' },
      { id: 'prestadores', label: 'Equipo & Prestadores', icon: Users, description: 'Instrumentadores y Anestesistas' },
      { id: 'quirurgico', label: 'Asesoría & Lead-to-Surgery', icon: Stethoscope, description: 'SLA, alertas y checklist quirúrgico' },
    ]
  },
  {
    id: 'clinic_billing',
    label: 'Clínica & Facturación',
    icon: Building2,
    items: [
      { id: 'clinica', label: 'Perfil del Centro Médico', icon: Building2, description: 'Datos y membrete institucional' },
      { id: 'nomenclador', label: 'Nomencladores & Aranceles', icon: BookOpen, description: 'Catálogo de prácticas y valores' },
      { id: 'plantilla_presupuesto', label: 'Diseñador de Presupuestos', icon: FileCheck, description: 'Plantillas y estilo PDF' },
    ]
  },
  {
    id: 'system',
    label: 'Sistema & Diagnóstico',
    icon: ShieldCheck,
    items: [
      { id: 'seguridad', label: 'Seguridad & Sesión', icon: ShieldCheck, description: 'Inactividad y bloqueo de pantalla' },
      { id: 'logs', label: 'Monitor de Logs & Auditoría', icon: Terminal, description: 'Consola técnica en tiempo real' },
    ]
  }
]

function AjustesContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabType | null
  const subParam = searchParams.get('sub') as any

  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'whatsapp')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  // Filtrar pestañas si el usuario escribe en el buscador
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return tabCategories
    const q = searchTerm.toLowerCase().trim()
    
    return tabCategories.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => 
        item.label.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q)
      )
    })).filter((cat) => cat.items.length > 0)
  }, [searchTerm])

  // Obtener ítem actualmente activo para el encabezado del panel
  const currentTabItem = useMemo(() => {
    for (const cat of tabCategories) {
      const found = cat.items.find((it) => it.id === activeTab)
      if (found) return found
    }
    return tabCategories[0].items[0]
  }, [activeTab])

  const CurrentIcon = currentTabItem.icon

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* Layout Dividido Master-Detail */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* ==================================================================== */}
        {/* PANEL LATERAL IZQUIERDO: MENÚ DE CONFIGURACIONES POR CATEGORÍA */}
        {/* ==================================================================== */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden flex flex-col">
          
          {/* Header del menú lateral con buscador */}
          <div className="p-4 border-b border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--secondary)]">
                <SlidersHorizontal size={14} className="text-blue-600" />
                <span>Módulos de Ajustes</span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800/40">
                10 secciones
              </span>
            </div>

            {/* Buscador de Ajustes */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ajuste..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] text-[var(--foreground)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--foreground)]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Navegación por Categorías */}
          <div className="p-2 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto panel-scroll">
            {filteredCategories.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--secondary)] space-y-1">
                <p className="font-semibold">No se encontraron ajustes</p>
                <p className="text-[10px]">Intenta con otro término de búsqueda.</p>
              </div>
            ) : (
              filteredCategories.map((category) => (
                <div key={category.id} className="space-y-1">
                  {/* Título de Categoría */}
                  <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <span>{category.label}</span>
                  </div>

                  {/* Ítems de la Categoría */}
                  <div className="space-y-1">
                    {category.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeTab === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full text-left p-2.5 rounded-xl transition-all duration-200 flex items-center justify-between group relative ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md glow-primary'
                              : 'text-[var(--secondary)] hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-[var(--foreground)]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className={`p-2 rounded-lg transition-colors shrink-0 ${
                              isActive 
                                ? 'bg-white/20 text-white' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-blue-600'
                            }`}>
                              <Icon size={16} />
                            </div>

                            <div className="truncate min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-xs font-bold truncate leading-tight ${
                                  isActive ? 'text-white' : 'text-[var(--foreground)]'
                                }`}>
                                  {item.label}
                                </p>
                                {item.badge && (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono font-bold shrink-0 ${
                                    isActive ? 'bg-white/25 text-white' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  }`}>
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[10px] truncate mt-0.5 font-normal ${
                                isActive ? 'text-blue-100' : 'text-slate-400'
                              }`}>
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <ChevronRight size={14} className={`shrink-0 transition-transform ${
                            isActive ? 'text-white translate-x-0.5' : 'text-slate-400 opacity-0 group-hover:opacity-100'
                          }`} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* ==================================================================== */}
        {/* PANEL PRINCIPAL DERECHO: TARJETA DE CONFIGURACIÓN ACTIVA */}
        {/* ==================================================================== */}
        <div className="flex-1 w-full min-w-0 space-y-4">
          
          {/* Header Contextual de la Tarjeta Seleccionada */}
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                <CurrentIcon size={20} />
              </div>
              <div className="truncate min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-[var(--foreground)] tracking-tight truncate">
                    {currentTabItem.label}
                  </h2>
                  {currentTabItem.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      {currentTabItem.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--secondary)] truncate">
                  {currentTabItem.description}
                </p>
              </div>
            </div>
          </div>

          {/* Componente Activo Renderizado */}
          <div className="transition-all duration-300">
            {activeTab === 'whatsapp' && <WhatsAppConfigCard />}
            {activeTab === 'bot' && <BotSettingsCard />}
            {activeTab === 'quirurgicos_turnos' && <QuirofanoSettingsCard initialSubSection={subParam} />}
            {activeTab === 'prestadores' && <PrestadoresSettingsCard />}
            {activeTab === 'quirurgico' && <SurgicalSettingsCard />}
            {activeTab === 'clinica' && <ClinicProfileCard />}
            {activeTab === 'nomenclador' && <NomencladorSettingsCard />}
            {activeTab === 'plantilla_presupuesto' && <BudgetTemplateDesignerCard />}
            {activeTab === 'seguridad' && <SecuritySettingsCard />}
            {activeTab === 'logs' && <SystemLogsCard />}
          </div>

        </div>

      </div>

    </div>
  )
}

export default function AjustesPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
        <Loader2 size={20} className="animate-spin text-blue-600" />
        <span>Cargando panel de configuración...</span>
      </div>
    }>
      <AjustesContent />
    </Suspense>
  )
}
