'use client'

import React, { useState, useEffect } from 'react'
import { Building2, MapPin, Phone, Mail, Clock, MessageSquare, Save, CheckCircle2 } from 'lucide-react'

export default function ClinicProfileCard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [nombre, setNombre] = useState('Centro Médico Nube')
  const [direccion, setDireccion] = useState('Av. Corrientes 1234, CABA, Argentina')
  const [telefonoGuardia, setTelefonoGuardia] = useState('+54 9 11 5555-0199')
  const [email, setEmail] = useState('contacto@centromediconube.com')
  const [horarios, setHorarios] = useState('Lunes a Viernes de 08:00 a 20:00 hs. Sábados de 09:00 a 13:00 hs.')
  const [mensajeBienvenida, setMensajeBienvenida] = useState('¡Hola! Gracias por comunicarte con Centro Médico Nube. ¿En qué podemos ayudarte hoy?')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('http://localhost:8000/api/settings')
      if (res.ok) {
        const data = await res.json()
        const clinica = data.clinica || {}
        setNombre(clinica.nombre || '')
        setDireccion(clinica.direccion || '')
        setTelefonoGuardia(clinica.telefono_guardia || '')
        setEmail(clinica.email_contacto || '')
        setHorarios(clinica.horarios_atencion || '')
        setMensajeBienvenida(clinica.mensaje_bienvenida || '')
      }
    } catch (err) {
      console.error('Error cargando perfil de la clínica:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setFeedback(null)
      const payload = {
        clinica: {
          nombre,
          direccion,
          telefono_guardia: telefonoGuardia,
          email_contacto: email,
          horarios_atencion: horarios,
          mensaje_bienvenida: mensajeBienvenida
        }
      }
      const res = await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setFeedback('¡Datos de la clínica actualizados correctamente!')
        setTimeout(() => setFeedback(null), 4000)
      }
    } catch (err) {
      console.error('Error guardando perfil de la clínica:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-600/10 text-blue-600">
            <Building2 size={26} />
          </div>
          <div>
            <h3 className="font-bold text-base">Perfil y Datos Institucionales de la Clínica</h3>
            <p className="text-xs text-[var(--secondary)]">
              Esta información es utilizada por el bot para brindar respuestas precisas sobre ubicación, horarios y contacto.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Nombre de la Institución Médica
            </label>
            <input 
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Dirección del Consultorio / Sede
            </label>
            <div className="relative">
              <input 
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                required
              />
              <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Teléfono de Guardia / Emergencias
            </label>
            <div className="relative">
              <input 
                type="text"
                value={telefonoGuardia}
                onChange={(e) => setTelefonoGuardia(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Email Institucional
            </label>
            <div className="relative">
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
            Horarios de Atención
          </label>
          <div className="relative">
            <input 
              type="text"
              value={horarios}
              onChange={(e) => setHorarios(e.target.value)}
              className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <Clock size={16} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
            Mensaje de Bienvenida Inicial
          </label>
          <div className="relative">
            <textarea 
              rows={3}
              value={mensajeBienvenida}
              onChange={(e) => setMensajeBienvenida(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          {feedback && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 glow-primary transition-all shadow-md disabled:opacity-50"
        >
          <Save size={15} />
          <span>{saving ? 'Guardando...' : 'Guardar Datos de la Clínica'}</span>
        </button>
      </div>
    </form>
  )
}
