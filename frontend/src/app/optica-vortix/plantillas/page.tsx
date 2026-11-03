'use client'

import React from 'react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import OpticaTemplatesManager from '@/components/optica/OpticaTemplatesManager'

export default function OpticaPlantillasPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Subnavegador superior unificado de Óptica Vortix */}
      <OpticaSubNavHeader />

      {/* Contenido principal del gestor de plantillas de Meta */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        <OpticaTemplatesManager />
      </main>
    </div>
  )
}
