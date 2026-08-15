'use client'

import React, { useState, useEffect } from 'react'
import { Edit3, X, Save, Loader2, Phone, Mail, User, ShieldCheck, MapPin, Calendar, Stethoscope, FileText } from 'lucide-react'

interface PacienteData {
  id: string
  nombre: string
  telefono: string
  dni?: string | null
  nro_hc?: string | null
  email?: string | null
  obra_social?: string | null
  plan_cobertura?: string | null
  medico_cabecera?: string | null
  telefono_fijo?: string | null
  direccion?: string | null
  fecha_nacimiento?: string | null
  sexo?: string | null
  geclisa_ficha_id?: number | null
}

interface ModalEditarPacienteProps {
  isOpen: boolean
  paciente: PacienteData | null
  guardando: boolean
  onClose: () => void
  onSave: (datosActualizados: Partial<PacienteData>) => Promise<void>
}

export default function ModalEditarPaciente({
  isOpen,
  paciente,
  guardando,
  onClose,
  onSave,
}: ModalEditarPacienteProps) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [dni, setDni] = useState('')
  const [nroHc, setNroHc] = useState('')
  const [email, setEmail] = useState('')
  const [obraSocial, setObraSocial] = useState('')
  const [planCobertura, setPlanCobertura] = useState('')
  const [medicoCabecera, setMedicoCabecera] = useState('')
  const [telefonoFijo, setTelefonoFijo] = useState('')
  const [direccion, setDireccion] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [sexo, setSexo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (paciente) {
      setNombre(paciente.nombre || '')
      setTelefono(paciente.telefono || '')
      setDni(paciente.dni || '')
      setNroHc(paciente.nro_hc || '')
      setEmail(paciente.email || '')
      setObraSocial(paciente.obra_social || '')
      setPlanCobertura(paciente.plan_cobertura || '')
      setMedicoCabecera(paciente.medico_cabecera || '')
      setTelefonoFijo(paciente.telefono_fijo || '')
      setDireccion(paciente.direccion || '')
      setFechaNacimiento(paciente.fecha_nacimiento || '')
      setSexo(paciente.sexo || '')
      setError('')
    }
  }, [paciente, isOpen])

  if (!isOpen || !paciente) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !telefono.trim()) {
      setError('El nombre y el teléfono de WhatsApp son obligatorios.')
      return
    }

    try {
      setError('')
      await onSave({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        dni: dni.trim() || null,
        nro_hc: nroHc.trim() || null,
        email: email.trim() || null,
        obra_social: obraSocial.trim() || null,
        plan_cobertura: planCobertura.trim() || null,
        medico_cabecera: medicoCabecera.trim() || null,
        telefono_fijo: telefonoFijo.trim() || null,
        direccion: direccion.trim() || null,
        fecha_nacimiento: fechaNacimiento.trim() || null,
        sexo: sexo.trim() || null,
      })
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Modificar Datos del Paciente</h3>
              <p className="text-xs text-[var(--secondary)]">
                Actualiza la información médica, personal y de contacto en el CRM.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={guardando}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Sección 1: Identificación Principal */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} />
              Identificación y Filiación
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Pérez, Juan Carlos"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Número de DNI</label>
                <input
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Ej: 34123456"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Nro. Historia Clínica (HC)</label>
                <input
                  type="text"
                  value={nroHc}
                  onChange={(e) => setNroHc(e.target.value)}
                  placeholder="Ej: 8891"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Contacto */}
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone size={13} />
              Canales de Contacto
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Teléfono WhatsApp (Móvil) *</label>
                <input
                  type="text"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 5492615551234"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-gray-500">Incluye código de país/área para WhatsApp.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Teléfono Fijo (Opcional)</label>
                <input
                  type="text"
                  value={telefonoFijo}
                  onChange={(e) => setTelefonoFijo(e.target.value)}
                  placeholder="Ej: 2614234567"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej: paciente@correo.com"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Datos Médicos y Cobertura */}
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={13} />
              Atención Médica & Cobertura
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Médico de Cabecera / Tratante</label>
                <input
                  type="text"
                  value={medicoCabecera}
                  onChange={(e) => setMedicoCabecera(e.target.value)}
                  placeholder="Ej: Dr. Carlos Martínez (Ginecología)"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Obra Social / Prepaga</label>
                <input
                  type="text"
                  value={obraSocial}
                  onChange={(e) => setObraSocial(e.target.value)}
                  placeholder="Ej: OSDE, Swiss Medical, Particular"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Plan de Cobertura</label>
                <input
                  type="text"
                  value={planCobertura}
                  onChange={(e) => setPlanCobertura(e.target.value)}
                  placeholder="Ej: 210, 310, Galeno Oro"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Sección 4: Demografía y Domicilio */}
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} />
              Demografía & Domicilio
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Sexo / Género</label>
                <select
                  value={sexo}
                  onChange={(e) => setSexo(e.target.value)}
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="F">Femenino (F)</option>
                  <option value="M">Masculino (M)</option>
                  <option value="O">Otro / No especificado</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-300">Dirección / Localidad</label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Av. San Martín 1234, Ciudad de Mendoza"
                  className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Footer de Acciones */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors border border-[var(--border)]"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow flex items-center gap-2"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Guardando Cambios...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Guardar Modificaciones
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
