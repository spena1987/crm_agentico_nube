'use client'

import React from 'react'
import RecepcionPacientesDia from '@/components/pipeline/RecepcionPacientesDia'
import { UserCheck, Layers } from 'lucide-react'
import Link from 'next/link'

export default function AsesoramientoRecepcionPage() {
  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-8 max-w-[1600px] mx-auto min-w-0">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <UserCheck className="text-amber-500" size={28} />
            <span>Recepción Quirúrgica & Pacientes del Día</span>
          </h1>
          <p className="text-xs md:text-sm text-[var(--secondary)] mt-1">
            Check-in de pacientes citados para hoy, verificación de Consentimiento Informado y pase a sala de espera.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/pipeline-quirurgico"
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] rounded-xl text-xs font-bold flex items-center gap-2 border border-[var(--border)] transition"
          >
            <Layers size={15} />
            <span>Ver Pipeline Kanban</span>
          </Link>
        </div>
      </div>

      {/* Componente de Recepción */}
      <RecepcionPacientesDia />
    </div>
  )
}
