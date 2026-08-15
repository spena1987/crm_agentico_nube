'use client'

import React, { useState } from 'react'
import { 
  Search, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  FileText, 
  X, 
  Loader2, 
  ArrowRight, 
  Check, 
  Sparkles,
  MessageSquare,
  Receipt
} from 'lucide-react'
import Link from 'next/link'
import { BACKEND_URL } from '@/lib/api'

interface GeclisaPacienteData {
  encontrado: boolean
  ficha_id?: number
  nombre?: string
  apellido?: string
  nombre_completo?: string
  dni?: string
  nro_hc?: string
  telefono?: string
  celular?: string
  telefono_fijo?: string
  email?: string
  fecha_nacimiento?: string
  sexo?: string
  obra_social?: string
  plan_cobertura?: string
  direccion?: string
  ya_en_crm?: boolean
  crm_paciente_id?: string
  mensaje?: string
  error?: string
}

interface ModalBuscarGeclisaProps {
  isOpen: boolean
  onClose: () => void
  onPacienteImportado: (paciente: any) => void
}

export default function ModalBuscarGeclisa({ isOpen, onClose, onPacienteImportado }: ModalBuscarGeclisaProps) {
  const [tipoBusqueda, setTipoBusqueda] = useState<'dni' | 'ficha'>('dni')
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [resultado, setResultado] = useState<GeclisaPacienteData | null>(null)
  const [exitoImportacion, setExitoImportacion] = useState<{ id: string; nombre: string; telefono: string } | null>(null)

  // Teléfono editable en la previsualización para asegurar formato WhatsApp
  const [telefonoEditable, setTelefonoEditable] = useState('')

  if (!isOpen) return null

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = terminoBusqueda.trim()
    if (!query) return

    setLoading(true)
    setErrorBusqueda(null)
    setResultado(null)
    setExitoImportacion(null)

    try {
      let endpoint = ''
      if (tipoBusqueda === 'dni') {
        const dniLimpio = query.replace(/\D/g, '')
        endpoint = `${BACKEND_URL}/api/geclisa/pacientes/buscar-por-dni?dni=${dniLimpio}`
      } else {
        endpoint = `${BACKEND_URL}/api/geclisa/pacientes/buscar-por-ficha?ficha_id=${encodeURIComponent(query)}`
      }

      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      })

      if (!res.ok) {
        const errorText = await res.text()
        let parsedDetail = `Error del servidor (${res.status})`
        try {
          const jsonErr = JSON.parse(errorText)
          parsedDetail = jsonErr.detail || jsonErr.mensaje || jsonErr.error || parsedDetail
        } catch {
          if (errorText && errorText.length < 200) parsedDetail = errorText
        }
        throw new Error(parsedDetail)
      }

      const data: GeclisaPacienteData = await res.json()

      if (!data.encontrado) {
        setErrorBusqueda(data.mensaje || data.error || 'No se encontró ningún paciente con los datos ingresados en Geclisa.')
        return
      }

      setResultado(data)
      setTelefonoEditable(data.telefono || data.celular || '')
    } catch (err: any) {
      console.error('Error buscando paciente en Geclisa:', err)
      setErrorBusqueda(err.message || 'No se pudo conectar con el servidor para consultar Geclisa. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  const handleImportar = async () => {
    if (!resultado) return

    setImporting(true)
    setErrorBusqueda(null)

    try {
      const payload = {
        ...resultado,
        telefono: telefonoEditable.trim() || resultado.telefono,
      }

      const res = await fetch(`${BACKEND_URL}/api/geclisa/pacientes/importar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al guardar el paciente en el CRM.')
      }

      const pacienteGuardado = data.paciente
      setExitoImportacion({
        id: pacienteGuardado.id,
        nombre: pacienteGuardado.nombre,
        telefono: pacienteGuardado.telefono
      })

      onPacienteImportado(pacienteGuardado)
    } catch (err: any) {
      console.error('Error importando paciente:', err)
      setErrorBusqueda(err.message || 'Ocurrió un error al incorporar el paciente al CRM.')
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setTerminoBusqueda('')
    setResultado(null)
    setErrorBusqueda(null)
    setExitoImportacion(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-blue-900/20 via-indigo-900/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Buscar en Servidor Geclisa</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  En Vivo
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)]">
                Consulta historias clínicas por DNI e incorpóralas a la base del CRM para gestionar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Barra de Búsqueda */}
          <form onSubmit={handleBuscar} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300">
                Criterio de búsqueda en Geclisa
              </label>
              <div className="flex bg-neutral-900/80 p-0.5 rounded-lg border border-[var(--border)] text-xs">
                <button
                  type="button"
                  onClick={() => { setTipoBusqueda('dni'); handleReset(); }}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    tipoBusqueda === 'dni' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Por DNI (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => { setTipoBusqueda('ficha'); handleReset(); }}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    tipoBusqueda === 'ficha' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Por Nro. Ficha
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={tipoBusqueda === 'dni' ? 'text' : 'number'}
                  autoFocus
                  placeholder={tipoBusqueda === 'dni' ? 'Ej: 34123456 (sin puntos)' : 'Ej: 14502'}
                  value={terminoBusqueda}
                  onChange={(e) => setTerminoBusqueda(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-900/60 border border-[var(--border)] focus:border-blue-500 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !terminoBusqueda.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-md flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Consultar
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Mensajes de Error */}
          {errorBusqueda && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorBusqueda}</span>
            </div>
          )}

          {/* Estado de Éxito de Importación */}
          {exitoImportacion && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs space-y-3">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ¡Paciente incorporado exitosamente al CRM!
              </div>
              <p className="text-gray-300">
                Se ha creado el expediente de <strong className="text-white">{exitoImportacion.nombre}</strong> con su historial y conversación habilitada.
              </p>
              
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href="/chat"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors shadow"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ir al Chat de WhatsApp
                </Link>
                <Link
                  href="/presupuestos"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-200 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors border border-[var(--border)]"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Crear Presupuesto
                </Link>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-2 text-gray-400 hover:text-white text-xs font-medium"
                >
                  Buscar otro paciente
                </button>
              </div>
            </div>
          )}

          {/* Tarjeta de Ficha Encontrada en Geclisa */}
          {resultado && resultado.encontrado && !exitoImportacion && (
            <div className="border border-[var(--border)] rounded-xl bg-neutral-900/50 overflow-hidden shadow-inner space-y-4 p-5">
              
              {/* Header de la Ficha */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-lg text-white shadow-md">
                    {(resultado.nombre?.[0] || 'P').toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      {resultado.nombre_completo || `${resultado.apellido}, ${resultado.nombre}`}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {resultado.dni && (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 font-mono text-[11px] border border-[var(--border)]">
                          DNI: {resultado.dni}
                        </span>
                      )}
                      {resultado.nro_hc && (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-blue-300 font-mono text-[11px] border border-[var(--border)]">
                          HC: {resultado.nro_hc}
                        </span>
                      )}
                      {resultado.ficha_id && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-400 text-[11px] font-semibold border border-blue-800/40">
                          Ficha Geclisa #{resultado.ficha_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {resultado.ya_en_crm ? (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Ya en CRM
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                    Nuevo en CRM
                  </span>
                )}
              </div>

              {/* Grilla de Datos Clínicos y Demográficos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                
                {/* Cobertura / Obra Social */}
                <div className="p-3 rounded-lg bg-neutral-900 border border-[var(--border)] space-y-1">
                  <div className="text-gray-400 flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Obra Social / Cobertura
                  </div>
                  <div className="font-semibold text-white">
                    {resultado.obra_social || 'Particular / Sin cobertura'} 
                    {resultado.plan_cobertura && (
                      <span className="text-gray-400 font-normal ml-1">
                        (Plan: {resultado.plan_cobertura})
                      </span>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="p-3 rounded-lg bg-neutral-900 border border-[var(--border)] space-y-1">
                  <div className="text-gray-400 flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    Correo Electrónico
                  </div>
                  <div className="font-semibold text-white truncate">
                    {resultado.email || 'No registrado'}
                  </div>
                </div>

                {/* Teléfono Fijo */}
                <div className="p-3 rounded-lg bg-neutral-900 border border-[var(--border)] space-y-1">
                  <div className="text-gray-400 flex items-center gap-1.5 font-medium">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    Teléfono Fijo
                  </div>
                  <div className="font-semibold text-white">
                    {resultado.telefono_fijo || 'No registrado'}
                  </div>
                </div>

                {/* Domicilio */}
                <div className="p-3 rounded-lg bg-neutral-900 border border-[var(--border)] space-y-1">
                  <div className="text-gray-400 flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    Domicilio
                  </div>
                  <div className="font-semibold text-white truncate">
                    {resultado.direccion || 'No registrado'}
                  </div>
                </div>

              </div>

              {/* Teléfono Celular / WhatsApp editable */}
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-2">
                <label className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  Número de WhatsApp / Celular para Notificaciones:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={telefonoEditable}
                    onChange={(e) => setTelefonoEditable(e.target.value)}
                    placeholder="Ej: 5492615551234 (con código de país/área)"
                    className="w-full px-3 py-2 bg-neutral-900 border border-blue-500/40 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Verifica que el número incluya el código internacional (ej: 549 para Argentina) para habilitar el bot de WhatsApp.
                </p>
              </div>

              {/* Aviso si ya existe en el CRM */}
              {resultado.ya_en_crm && (
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
                  <span>Este paciente ya está registrado en el CRM. Puedes actualizar sus datos o abrir su chat.</span>
                  <Link
                    href="/chat"
                    onClick={onClose}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 transition-colors"
                  >
                    Ir al Chat
                  </Link>
                </div>
              )}

              {/* Botón de Incorporación */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 text-xs text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors font-medium"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleImportar}
                  disabled={importing}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando en CRM...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {resultado.ya_en_crm ? 'Actualizar Ficha en CRM' : 'Incorporar al CRM & Iniciar Gestión'}
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-neutral-950/40 flex justify-between items-center text-[11px] text-gray-500">
          <span>Servidor Geclisa • CREO Mendoza</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
