'use client'

import React, { useState, useEffect } from 'react'
import { Eye, Tag, FileText, Sliders } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import EstudiosTiposSettingsCard from './EstudiosTiposSettingsCard'
import CaratulaEstudiosSettingsCard from './CaratulaEstudiosSettingsCard'
import EstudiosOperacionSettingsCard from './EstudiosOperacionSettingsCard'

type SubSectionId = 'etiquetas' | 'caratula' | 'operacion'

interface Props {
  initialSubSection?: string | null
}

export default function EstudiosOftalmologicosSettingsCard({ initialSubSection }: Props) {
  const { can, isAdmin } = usePermissions()
  const canEdit =
    isAdmin ||
    can('ajustes', 'editar_estudios_oftalmologicos') ||
    can('ajustes', 'ver_clinica')

  const resolveSub = (val?: string | null): SubSectionId => {
    if (val === 'caratula' || val === 'operacion' || val === 'etiquetas') return val
    return 'etiquetas'
  }

  const [activeSub, setActiveSub] = useState<SubSectionId>(() => resolveSub(initialSubSection))

  useEffect(() => {
    if (initialSubSection) {
      setActiveSub(resolveSub(initialSubSection))
    }
  }, [initialSubSection])

  const subTabs: Array<{ id: SubSectionId; label: string; icon: React.ComponentType<any>; desc: string }> = [
    { id: 'etiquetas', label: 'Etiquetas de Estudios', icon: Tag, desc: 'Tipos rápidos en consola' },
    { id: 'caratula', label: 'Carátula de Estudios', icon: FileText, desc: 'Membrete y portada PDF' },
    { id: 'operacion', label: 'Parámetros Operativos', icon: Sliders, desc: 'Valores iniciales por defecto' },
  ]

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 shrink-0">
            <Eye size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Configuración del Módulo de Estudios Oftalmológicos
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-0.5">
              Administra las etiquetas rápidas de la consola técnica, el diseño de la carátula institucional y los valores operativos por defecto.
            </p>
          </div>
        </div>

        {/* Sub-pestañas modulares */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
          {subTabs.map((st) => {
            const Icon = st.icon
            const active = activeSub === st.id
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveSub(st.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                  active
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-[var(--border)] text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                <span>{st.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sub-sección activa */}
      {activeSub === 'etiquetas' && (
        <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <EstudiosTiposSettingsCard canEdit={canEdit} />
        </div>
      )}

      {activeSub === 'caratula' && <CaratulaEstudiosSettingsCard />}

      {activeSub === 'operacion' && (
        <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
          <EstudiosOperacionSettingsCard canEdit={canEdit} />
        </div>
      )}
    </div>
  )
}
