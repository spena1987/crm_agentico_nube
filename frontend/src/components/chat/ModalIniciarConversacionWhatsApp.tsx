'use client'

import React, { useState } from 'react'
import {
  X,
  Search,
  Zap,
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Database,
  Building,
  CreditCard,
  MessageCircle,
  FileText
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { normalizePhoneNumber, formatPhoneDisplay } from '@/lib/phoneUtils'

interface GeclisaPacienteResultado {
  encontrado: boolean
  ficha_id?: number
  nombre?: string
  apellido?: string
  nombre_completo?: string
  dni?: string
  nro_hc?: string
  telefono?: string
  celular?: string
  obra_social?: string
  plan_cobertura?: string
  ya_en_crm?: boolean
  crm_paciente_id?: string
  mensaje?: string
}

interface ModalIniciarConversacionWhatsAppProps {
  isOpen: boolean
  onClose: () => void
  onConversacionIniciada: (conversacion: any, yaExistia: boolean) => void
  currentUserId?: string
  currentUserName?: string
}

export default function ModalIniciarConversacionWhatsApp({
  isOpen,
  onClose,
  onConversacionIniciada,
  currentUserId,
  currentUserName
}: ModalIniciarConversacionWhatsAppProps) {
  const [tab, setTab] = useState<'dni' | 'telefono'>('dni')

  // Estados Tab 1 (DNI Geclisa)
  const [dniInput, setDniInput] = useState('')
  const [buscandoDni, setBuscandoDni] = useState(false)
  const [resultadoGeclisa, setResultadoGeclisa] = useState<GeclisaPacienteResultado | null>(null)
  const [telefonoGeclisaEditable, setTelefonoGeclisaEditable] = useState('')
  const [errorDni, setErrorDni] = useState<string | null>(null)

  // Estados Tab 2 (Teléfono Directo)
  const [telefonoDirectoInput, setTelefonoDirectoInput] = useState('')
  const [nombreReferenciaInput, setNombreReferenciaInput] = useState('')
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null)

  // Estado general de inicio
  const [iniciandoChat, setIniciandoChat] = useState(false)

  if (!isOpen) return null

  const resetFormulario = () => {
    setDniInput('')
    setResultadoGeclisa(null)
    setTelefonoGeclisaEditable('')
    setErrorDni(null)
    setTelefonoDirectoInput('')
    setNombreReferenciaInput('')
    setErrorTelefono(null)
    setIniciandoChat(false)
  }

  const handleClose = () => {
    resetFormulario()
    onClose()
  }

  // Búsqueda en Geclisa por DNI
  const handleBuscarDNI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const dniLimpio = dniInput.replace(/\D/g, '')
    if (!dniLimpio || dniLimpio.length < 6) {
      setErrorDni('Ingresa un número de DNI válido (mínimo 6 dígitos).')
      return
    }

    try {
      setBuscandoDni(true)
      setErrorDni(null)
      setResultadoGeclisa(null)

      const res = await apiFetch(`/api/geclisa/pacientes/buscar-por-dni?dni=${dniLimpio}`)
      const data = await res.json()

      if (!res.ok || !data.encontrado) {
        setErrorDni(data?.mensaje || data?.error || `No se encontró paciente con DNI ${dniLimpio} en Geclisa.`)
        return
      }

      setResultadoGeclisa(data)
      const telSugerido = data.celular || data.telefono || ''
      setTelefonoGeclisaEditable(telSugerido)
    } catch (err: any) {
      console.error('Error buscando por DNI:', err)
      setErrorDni(err?.message || 'Error de conexión al consultar el padrón de Geclisa.')
    } finally {
      setBuscandoDni(false)
    }
  }

  // Iniciar conversación desde Camino A (DNI Geclisa)
  const handleIniciarDesdeDNI = async () => {
    if (!resultadoGeclisa) return

    const telFinal = telefonoGeclisaEditable.trim()
    if (!telFinal) {
      setErrorDni('Debes especificar un número de WhatsApp celular para el paciente.')
      return
    }

    try {
      setIniciandoChat(true)
      setErrorDni(null)

      const payload = {
        modalidad: 'geclisa_dni',
        dni: resultadoGeclisa.dni || dniInput.replace(/\D/g, ''),
        datos_geclisa: resultadoGeclisa,
        telefono: telFinal,
        operador_id: currentUserId || null,
        operador_nombre: currentUserName || null
      }

      const res = await apiFetch('/api/conversaciones/iniciar-rapido', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data?.detail || data?.mensaje || 'No se pudo iniciar la conversación.')
      }

      onConversacionIniciada(data.conversacion, Boolean(data.ya_existia))
      handleClose()
    } catch (err: any) {
      console.error('Error al iniciar conversación por DNI:', err)
      setErrorDni(err?.message || 'Error al iniciar la conversación.')
    } finally {
      setIniciandoChat(false)
    }
  }

  // Iniciar conversación desde Camino B (Teléfono Directo)
  const handleIniciarDesdeTelefono = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const telLimpio = telefonoDirectoInput.trim()
    const digitos = telLimpio.replace(/\D/g, '')

    if (!telLimpio || digitos.length < 8) {
      setErrorTelefono('Ingresa un número de celular válido con código de área (ej: 261 614-2191).')
      return
    }

    try {
      setIniciandoChat(true)
      setErrorTelefono(null)

      const payload = {
        modalidad: 'telefono_directo',
        telefono: telLimpio,
        nombre_referencia: nombreReferenciaInput.trim() || null,
        operador_id: currentUserId || null,
        operador_nombre: currentUserName || null
      }

      const res = await apiFetch('/api/conversaciones/iniciar-rapido', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data?.detail || data?.mensaje || 'No se pudo iniciar la conversación directa.')
      }

      onConversacionIniciada(data.conversacion, Boolean(data.ya_existia))
      handleClose()
    } catch (err: any) {
      console.error('Error al iniciar conversación por teléfono:', err)
      setErrorTelefono(err?.message || 'Error al iniciar la conversación directa.')
    } finally {
      setIniciandoChat(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#14203a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Iniciar Conversación de WhatsApp
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Comienza un chat directo o vincula de inmediato con el padrón de Geclisa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas de Selección de Camino */}
        <div className="grid grid-cols-2 p-1.5 bg-[#0a101f] border-b border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('dni')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'dni'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Database size={14} />
            <span>Por DNI (Geclisa)</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('telefono')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'telefono'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap size={14} />
            <span>Contacto Rápido</span>
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: POR DNI GECLISA */}
          {tab === 'dni' && (
            <div className="space-y-4">
              <form onSubmit={handleBuscarDNI} className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Número de Documento (DNI):
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={dniInput}
                      onChange={(e) => setDniInput(e.target.value)}
                      placeholder="Ej: 32456789 (sin puntos)"
                      className="w-full px-3 py-2 text-sm bg-[#131d33] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={buscandoDni || !dniInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-600/30 shrink-0 cursor-pointer"
                  >
                    {buscandoDni ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    <span>Buscar en Geclisa</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Consulta en tiempo real el padrón institucional para cargar ficha médica, historia clínica y cobertura.
                </p>
              </form>

              {/* Mensaje de Error en Búsqueda DNI */}
              {errorDni && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2 animate-fade-in">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <span>{errorDni}</span>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTab('telefono')
                          setErrorDni(null)
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 underline font-semibold flex items-center gap-1"
                      >
                        <Zap size={11} /> ¿Prefieres iniciar como Contacto Rápido por número de teléfono?
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Resultado de Geclisa Encontrado */}
              {resultadoGeclisa && (
                <div className="p-4 rounded-xl bg-[#14223d] border border-blue-500/40 space-y-3.5 animate-fade-in shadow-md">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                    <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-blue-400" />
                      Paciente Encontrado en Geclisa
                    </span>
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/80 font-mono">
                      Ficha #{resultadoGeclisa.ficha_id}
                    </span>
                  </div>

                  {/* Datos del Paciente */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Nombre Completo:</span>
                      <strong className="text-slate-100">{resultadoGeclisa.nombre_completo || `${resultadoGeclisa.apellido}, ${resultadoGeclisa.nombre}`}</strong>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">DNI:</span>
                      <span className="text-slate-200 font-mono font-medium">{resultadoGeclisa.dni || dniInput}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Obra Social / Plan:</span>
                      <span className="text-slate-200">
                        {resultadoGeclisa.obra_social || 'Particular'} {resultadoGeclisa.plan_cobertura ? `(${resultadoGeclisa.plan_cobertura})` : ''}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">Historia Clínica (HC):</span>
                      <span className="text-slate-200 font-mono">{resultadoGeclisa.nro_hc || 'S/D'}</span>
                    </div>
                  </div>

                  {/* Campo Editable de Teléfono WhatsApp */}
                  <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Phone size={13} className="text-emerald-400" />
                      Número de WhatsApp de Contacto:
                    </label>
                    <input
                      type="text"
                      value={telefonoGeclisaEditable}
                      onChange={(e) => setTelefonoGeclisaEditable(e.target.value)}
                      placeholder="Ej: +54 9 261 614-2191 o 2616142191"
                      className="w-full px-3 py-2 text-xs bg-[#0b1222] border border-emerald-500/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[10.5px] text-slate-400">
                      Verifica o actualiza el número de celular al que se enviará la conversación de WhatsApp.
                    </p>
                  </div>

                  {/* Aviso de Conversación Existente */}
                  {resultadoGeclisa.ya_en_crm && (
                    <div className="p-2.5 rounded-lg bg-indigo-950/50 border border-indigo-700/60 text-indigo-300 text-[11px] flex items-center gap-2">
                      <CheckCircle2 size={14} className="shrink-0 text-indigo-400" />
                      <span>Este paciente ya posee un chat en el CRM. Al presionar continuar serás redirigido al hilo activo.</span>
                    </div>
                  )}

                  {/* Botón de Confirmación */}
                  <button
                    type="button"
                    onClick={handleIniciarDesdeDNI}
                    disabled={iniciandoChat || !telefonoGeclisaEditable.trim()}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    {iniciandoChat ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                    <span>
                      {resultadoGeclisa.ya_en_crm ? 'Ir a la Conversación del Paciente' : 'Iniciar Chat con Ficha Vinculada'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONTACTO RÁPIDO (SOLO TELÉFONO) */}
          {tab === 'telefono' && (
            <form onSubmit={handleIniciarDesdeTelefono} className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-start gap-2.5">
                <Zap size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong className="font-bold block text-emerald-200">Inicio Inmediato de Chat</strong>
                  <span>
                    No es necesario cargar ficha ni DNI previamente. La conversación se abrirá al instante y podrás vincularla a Geclisa en cualquier momento.
                  </span>
                </div>
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-400" />
                  Número de Teléfono Celular (WhatsApp) *:
                </label>
                <input
                  type="text"
                  value={telefonoDirectoInput}
                  onChange={(e) => setTelefonoDirectoInput(e.target.value)}
                  placeholder="Ej: +54 9 261 614-2191 o 2616142191"
                  className="w-full px-3 py-2 text-sm bg-[#131d33] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
                <p className="text-[10.5px] text-slate-400">
                  Formato local o internacional. El sistema normaliza automáticamente a formato WhatsApp (+54 9...).
                </p>
              </div>

              {/* Nombre de Referencia Opcional */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User size={13} className="text-blue-400" />
                  Nombre o Referencia (Opcional):
                </label>
                <input
                  type="text"
                  value={nombreReferenciaInput}
                  onChange={(e) => setNombreReferenciaInput(e.target.value)}
                  placeholder="Ej: Sra. Gómez o Consulta Cirugía Dr. Rossi"
                  className="w-full px-3 py-2 text-xs bg-[#131d33] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-[10.5px] text-slate-400">
                  Nombre provisorio para identificar el chat en la lista antes de asociar su DNI.
                </p>
              </div>

              {/* Error Teléfono */}
              {errorTelefono && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{errorTelefono}</span>
                </div>
              )}

              {/* Botón de Inicio Rápido */}
              <button
                type="submit"
                disabled={iniciandoChat || !telefonoDirectoInput.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                {iniciandoChat ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ArrowRight size={15} />
                )}
                <span>Iniciar Chat Inmediato</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
