'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Zap, 
  Calendar, 
  Clock, 
  MapPin, 
  CreditCard, 
  AlertCircle, 
  FileCheck, 
  HeartHandshake, 
  Search,
  X 
} from 'lucide-react'

export interface QuickReplyTemplate {
  id: string
  command: string
  title: string
  icon: any
  category: string
  template: string
}

export const DEFAULT_TEMPLATES: QuickReplyTemplate[] = [
  {
    id: 'bienvenida',
    command: '/bienvenida',
    title: 'Saludo y Bienvenida',
    category: 'General',
    icon: HeartHandshake,
    template: '¡Hola *{{nombre}}*! Gracias por comunicarte con *MedCRM Clínica*. ¿En qué podemos ayudarte hoy?'
  },
  {
    id: 'turno_confirmacion',
    command: '/turno',
    title: 'Confirmación de Turno',
    category: 'Turnos',
    icon: Calendar,
    template: 'Estimado/a *{{nombre}}*, le recordamos su turno médico agendado para el día *{{fecha}}* a las *{{hora}} hs*. Por favor recuerde asistir con DNI y carnet de cobertura médica.'
  },
  {
    id: 'ayuno_estudios',
    command: '/ayuno',
    title: 'Preparación de Estudios / Ayuno',
    category: 'Estudios',
    icon: AlertCircle,
    template: 'Para su estudio de análisis/ecografía, recuerde asistir con *8 horas de ayuno estricto* (solo puede beber pequeños sorbos de agua sin gas). Traer orden médica autorizada.'
  },
  {
    id: 'ubicacion_horarios',
    command: '/ubicacion',
    title: 'Ubicación y Horarios de Atención',
    category: 'Información',
    icon: MapPin,
    template: 'Nuestra sede central está ubicada en *Av. San Martín 1420, Ciudad*. Atendemos de lunes a viernes de 08:00 a 20:00 hs y sábados de 09:00 a 13:00 hs.'
  },
  {
    id: 'medios_pago',
    command: '/pago',
    title: 'Medios de Pago y Transferencia',
    category: 'Facturación',
    icon: CreditCard,
    template: 'Aceptamos transferencias bancarias, tarjetas de débito/crédito y efectivo en recepción.\n\n🏦 *Alias CBU*: CLINICA.MEDCRM.PAGOS\n*Titular*: MedCRM Salud S.A.\nPor favor envíe el comprobante por este medio una vez realizado el pago.'
  },
  {
    id: 'recetas_ordenes',
    command: '/receta',
    title: 'Solicitud de Recetas Médicas',
    category: 'Secretaría',
    icon: FileCheck,
    template: 'Para solicitar renovación de recetas, por favor indíquenos:\n1. Nombre y DNI del paciente\n2. Medicamento exacto y dosis diaria\n3. Foto de la última receta o carnet de afiliado\nDemora habitual de confección: 24 a 48 hs hábiles.'
  },
  {
    id: 'demora_medica',
    command: '/demora',
    title: 'Aviso de Demora Médica',
    category: 'Atención',
    icon: Clock,
    template: 'Estimado/a *{{nombre}}*, le informamos que debido a una urgencia en consultorio, los turnos de hoy presentan una demora estimada de 20 minutos. Agradecemos su comprensión.'
  }
]

interface ChatQuickRepliesMenuProps {
  isOpen: boolean
  searchFilter: string
  pacienteNombre?: string
  pacienteTelefono?: string
  onSelect: (processedText: string) => void
  onClose: () => void
}

export default function ChatQuickRepliesMenu({
  isOpen,
  searchFilter,
  pacienteNombre = 'Paciente',
  pacienteTelefono = '',
  onSelect,
  onClose
}: ChatQuickRepliesMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Filtrar plantillas según lo que escribe el usuario después de la barra "/"
  const cleanFilter = searchFilter.replace(/^\//, '').toLowerCase().trim()
  const filteredTemplates = DEFAULT_TEMPLATES.filter(
    (t) =>
      t.command.toLowerCase().includes(cleanFilter) ||
      t.title.toLowerCase().includes(cleanFilter) ||
      t.template.toLowerCase().includes(cleanFilter) ||
      t.category.toLowerCase().includes(cleanFilter)
  )

  // Reiniciar índice al cambiar filtro
  useEffect(() => {
    setSelectedIndex(0)
  }, [cleanFilter])

  // Reemplazar variables dinámicas
  const processTemplate = (rawTemplate: string): string => {
    const today = new Date()
    const fechaFormateada = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const horaFormateada = '10:00'

    return rawTemplate
      .replace(/\{\{nombre\}\}/g, pacienteNombre || 'Paciente')
      .replace(/\{\{telefono\}\}/g, pacienteTelefono || '')
      .replace(/\{\{fecha\}\}/g, fechaFormateada)
      .replace(/\{\{hora\}\}/g, horaFormateada)
  }

  // Navegación por teclado (Flechas ↑ ↓, Enter, Escape)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % (filteredTemplates.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + (filteredTemplates.length || 1)) % (filteredTemplates.length || 1))
      } else if (e.key === 'Enter') {
        if (filteredTemplates.length > 0) {
          e.preventDefault()
          const chosen = filteredTemplates[selectedIndex]
          if (chosen) {
            onSelect(processTemplate(chosen.template))
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredTemplates, pacienteNombre, pacienteTelefono, onSelect, onClose])

  if (!isOpen) return null

  return (
    <div 
      ref={menuRef}
      className="absolute bottom-16 left-3 right-3 sm:left-12 sm:right-16 z-40 bg-[#0f172a] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-72 flex flex-col text-slate-100 backdrop-blur-md"
    >
      {/* Cabecera del Menú */}
      <div className="p-2.5 px-3.5 bg-[#14203d] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
          <Zap size={14} className="text-amber-400" />
          <span>Respuestas Rápidas (Comando Slash)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="hidden sm:inline">Usa ↑ ↓ y Enter para elegir</span>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Lista de Plantillas */}
      <div className="overflow-y-auto p-1.5 space-y-1 panel-scroll">
        {filteredTemplates.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-xs">
            No se encontraron plantillas con el comando <span className="font-mono text-blue-300">/{cleanFilter}</span>
          </div>
        ) : (
          filteredTemplates.map((t, idx) => {
            const Icon = t.icon
            const isSelected = idx === selectedIndex
            return (
              <div
                key={t.id}
                onClick={() => onSelect(processTemplate(t.template))}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-start gap-3 text-xs ${
                  isSelected ? 'bg-blue-600/30 border border-blue-500/50 text-white' : 'hover:bg-slate-800/60 text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-bold text-slate-100">{t.title}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-blue-300 font-semibold">
                      {t.command}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                    {processTemplate(t.template)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
