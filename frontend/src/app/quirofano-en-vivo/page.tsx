'use client'

import React, { useState, useEffect } from 'react'
import PizarraQuirofanoEnVivo from '@/components/quirofano/PizarraQuirofanoEnVivo'
import FichaTurnoModal from '@/components/quirofano/FichaTurnoModal'
import { Activity, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { BACKEND_URL } from '@/lib/api'

export default function QuirofanoEnVivoPage() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<any | null>(null)
  const [quirofanos, setQuirofanos] = useState<any[]>([])

  useEffect(() => {
    const fetchQ = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/quirofanos?solo_activos=true`)
        const data = await res.json()
        if (data.success && data.quirofanos) {
          setQuirofanos(data.quirofanos)
        }
      } catch (e) {
        console.error('Error cargando quirofanos:', e)
      }
    }
    fetchQ()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-8 max-w-[1600px] mx-auto min-w-0">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <Activity className="text-blue-600 animate-pulse" size={28} />
            <span>Pizarra de Quirófano en Vivo</span>
          </h1>
          <p className="text-xs md:text-sm text-[var(--secondary)] mt-1">
            Monitoreo en tiempo real de cirugías del día, tiempos de ocupación, recepción y cierre quirúrgico.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/programacion-quirurgica"
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] rounded-xl text-xs font-bold flex items-center gap-2 border border-[var(--border)] transition"
          >
            <CalendarDays size={15} />
            <span>Ver Agenda & Slots</span>
          </Link>
        </div>
      </div>

      {/* Componente Pizarra en Vivo */}
      <PizarraQuirofanoEnVivo
        onEditarTurno={(t) => {
          setTurnoSeleccionado(t)
          setModalAbierto(true)
        }}
      />

      {/* Modal Ficha de Turno */}
      {modalAbierto && (
        <FichaTurnoModal
          turno={turnoSeleccionado}
          quirofanos={quirofanos}
          onClose={() => {
            setModalAbierto(false)
            setTurnoSeleccionado(null)
          }}
          onSaved={() => {
            setModalAbierto(false)
            setTurnoSeleccionado(null)
          }}
        />
      )}
    </div>
  )
}
