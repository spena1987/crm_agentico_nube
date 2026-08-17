'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  FileText,
  Search,
  Loader2,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  FileCheck2,
  Send,
  MessageSquare,
  ExternalLink,
  Download
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'

interface ItemPresupuestoForm {
  servicio_id?: string
  codigo?: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface PracticaNomenclador {
  id?: string
  codigo: string
  nombre: string
  categoria?: string
  precio?: number
  moneda?: string
}

interface ModalCrearPresupuestoPacienteProps {
  isOpen: boolean
  onClose: () => void
  pacienteId: string
  pacienteNombre: string
  pacienteDni?: string | null
  pacienteTelefono?: string | null
  obraSocial?: string | null
  asesoriaId?: string | null
  practicaInicial?: {
    codigo?: string | null
    nombre?: string | null
    precio?: number | null
    moneda?: string | null
  } | null
  onPresupuestoCreado: (nuevoPresupuesto: any) => void
}

export default function ModalCrearPresupuestoPaciente({
  isOpen,
  onClose,
  pacienteId,
  pacienteNombre,
  pacienteDni,
  pacienteTelefono,
  obraSocial,
  asesoriaId,
  practicaInicial,
  onPresupuestoCreado
}: ModalCrearPresupuestoPacienteProps) {
  const [paso, setPaso] = useState<'formulario' | 'whatsapp'>('formulario')
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS')
  const [items, setItems] = useState<ItemPresupuestoForm[]>([])
  
  // Búsqueda en Nomenclador
  const [busqueda, setBusqueda] = useState('')
  const [practicasCatalogo, setPracticasCatalogo] = useState<PracticaNomenclador[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarDropdown, setMostrarDropdown] = useState(false)

  const [emitirEstado, setEmitirEstado] = useState<'enviado' | 'borrador' | 'aprobado'>('enviado')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Datos para el envío de WhatsApp posterior
  const [presupuestoGenerado, setPresupuestoGenerado] = useState<any | null>(null)
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState('')
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState('')
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false)
  const [whatsappEnviado, setWhatsappEnviado] = useState(false)

  // Al abrir el modal, inicializar ítems y estados
  useEffect(() => {
    if (isOpen) {
      setPaso('formulario')
      setError(null)
      setPresupuestoGenerado(null)
      setWhatsappEnviado(false)
      setTelefonoWhatsApp(pacienteTelefono || '')
      
      const listaInicial: ItemPresupuestoForm[] = []
      
      if (practicaInicial && practicaInicial.nombre) {
        const pPrecio = Number(practicaInicial.precio) || 0
        listaInicial.push({
          codigo: practicaInicial.codigo || 'QUIR-01',
          nombre: practicaInicial.nombre,
          cantidad: 1,
          precio_unitario: pPrecio,
          subtotal: pPrecio
        })
        if (practicaInicial.moneda === 'USD') {
          setMoneda('USD')
        }
      }

      setItems(listaInicial)
      buscarPracticasCatalogo('')
    }
  }, [isOpen, practicaInicial?.nombre, practicaInicial?.codigo, pacienteTelefono])

  // Buscar prácticas en el nomenclador
  const buscarPracticasCatalogo = async (query: string) => {
    try {
      setBuscando(true)
      const qClean = (query || '').trim()
      const res = await fetch(`/api/nomenclador/buscar-presupuesto?q=${encodeURIComponent(qClean)}`)
      const data = await res.json()

      let lista: PracticaNomenclador[] = []
      if (res.ok && data.success) {
        lista = data.resultados || data.prestaciones || []
      }

      if (lista.length === 0) {
        let sbQuery = supabase
          .from('nomenclador_practicas')
          .select('id, codigo, nombre, categoria')
          .eq('activo', true)

        if (qClean) {
          sbQuery = sbQuery.or(`codigo.ilike.%${qClean}%,nombre.ilike.%${qClean}%,categoria.ilike.%${qClean}%`)
        }

        const { data: sbData } = await sbQuery.order('nombre').limit(50)
        if (sbData) {
          lista = sbData as PracticaNomenclador[]
        }
      }

      setPracticasCatalogo(lista)
    } catch (err) {
      console.error('Error buscando en nomenclador:', err)
    } finally {
      setBuscando(false)
    }
  }

  // Agregar ítem desde el catálogo
  const handleAgregarItem = (p: PracticaNomenclador) => {
    const precio = Number(p.precio) || 0
    const nuevo: ItemPresupuestoForm = {
      servicio_id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      cantidad: 1,
      precio_unitario: precio,
      subtotal: precio
    }
    setItems((prev) => [...prev, nuevo])
    setBusqueda('')
    setMostrarDropdown(false)
  }

  // Agregar ítem manual o personalizado
  const handleAgregarManual = () => {
    const nuevo: ItemPresupuestoForm = {
      codigo: 'EXTRA',
      nombre: 'Concepto adicional / Honorarios / Descartables',
      cantidad: 1,
      precio_unitario: 0,
      subtotal: 0
    }
    setItems((prev) => [...prev, nuevo])
  }

  // Modificar cantidad o precio de un ítem
  const handleUpdateItem = (index: number, field: 'cantidad' | 'precio_unitario' | 'nombre', val: any) => {
    setItems((prev) => {
      const copy = [...prev]
      const target = { ...copy[index] }
      
      if (field === 'cantidad') {
        const cant = Math.max(1, parseInt(val) || 1)
        target.cantidad = cant
        target.subtotal = cant * target.precio_unitario
      } else if (field === 'precio_unitario') {
        const pu = Math.max(0, parseFloat(val) || 0)
        target.precio_unitario = pu
        target.subtotal = target.cantidad * pu
      } else if (field === 'nombre') {
        target.nombre = val
      }
      
      copy[index] = target
      return copy
    })
  }

  // Eliminar ítem
  const handleEliminarItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Total acumulado
  const totalGeneral = items.reduce((acc, it) => acc + (it.subtotal || 0), 0)

  // Emitir Presupuesto y Generar PDF
  const handleEmitir = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      setError('Debes incluir al menos una prestación o ítem en la cotización.')
      return
    }

    setGuardando(true)
    setError(null)

    const payload = {
      paciente_id: pacienteId,
      asesoria_id: asesoriaId || null,
      estado: emitirEstado,
      moneda: moneda,
      items: items.map((it) => ({
        servicio_id: it.servicio_id || null,
        codigo: it.codigo || null,
        nombre: it.nombre,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario
      }))
    }

    try {
      const res = await fetch('/api/presupuestos/crear-rapido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al emitir presupuesto.')
      }

      const pres = data.presupuesto
      setPresupuestoGenerado(pres)
      onPresupuestoCreado(pres)

      // Construir texto sugerido para WhatsApp
      const pdfFullUrl = pres.pdf_url?.startsWith('http')
        ? pres.pdf_url
        : `${BACKEND_URL}${pres.pdf_url?.startsWith('/') ? '' : '/'}${pres.pdf_url || ''}`

      const totalFormateado = `${moneda === 'USD' ? 'USD ' : '$ '}${Number(pres.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      const nombreItemPrincipal = items[0]?.nombre || 'Intervención Quirúrgica'

      const texto = `Estimado/a *${pacienteNombre}*,\n\nTe compartimos el Presupuesto Médico Oficial por tu procedimiento médico:\n📋 *Prestación:* ${nombreItemPrincipal}\n💰 *Monto Total:* ${totalFormateado} ${moneda}\n\n📄 Puedes descargar y revisar el presupuesto membretado aquí:\n${pdfFullUrl}\n\nQuedamos a tu entera disposición ante cualquier duda o para coordinar la fecha quirúrgica.\n\n*Equipo de Asesoramiento Quirúrgico*`

      setMensajeWhatsApp(texto)
      // Pasar a la pantalla de decisión de WhatsApp
      setPaso('whatsapp')
    } catch (err: any) {
      console.error('Error emitiendo presupuesto:', err)
      setError(err.message || 'Error inesperado al emitir el presupuesto.')
    } finally {
      setGuardando(false)
    }
  }

  // Enviar mensaje de WhatsApp
  const handleEnviarWhatsApp = async () => {
    if (!telefonoWhatsApp) {
      setError('Debes ingresar o confirmar un número de teléfono.')
      return
    }

    try {
      setEnviandoWhatsApp(true)
      setError(null)

      // 1. Obtener o crear conversación en Supabase
      let conversacionId: string | null = null
      try {
        if (pacienteId) {
          const { data: convData } = await supabase
            .from('conversaciones')
            .select('id')
            .eq('paciente_id', pacienteId)
            .maybeSingle()

          if (convData?.id) {
            conversacionId = convData.id
          } else {
            const { data: newConv } = await supabase
              .from('conversaciones')
              .insert({ paciente_id: pacienteId, bot_disabled: false })
              .select('id')
              .single()
            if (newConv?.id) conversacionId = newConv.id
          }
        }
      } catch (convErr) {
        console.warn('Error resolviendo conversación en Supabase:', convErr)
      }

      const res = await fetch(`${BACKEND_URL}/api/whatsapp/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: telefonoWhatsApp.trim(),
          mensaje: mensajeWhatsApp.trim(),
          phone: telefonoWhatsApp.trim(),
          message: mensajeWhatsApp.trim(),
          paciente_id: pacienteId,
          conversacion_id: conversacionId
        })
      })

      const data = await res.json()
      if (!res.ok || data.error || data.success === false) {
        throw new Error(data.detail || data.error || data.mensaje || 'Error al enviar WhatsApp.')
      }

      // 2. Asegurar persistencia en el muro del chat
      if (conversacionId) {
        try {
          await supabase.from('mensajes').insert({
            conversacion_id: conversacionId,
            emisor: 'operador',
            contenido: mensajeWhatsApp.trim(),
            metadata_json: {
              tipo: 'presupuesto_quirurgico',
              whatsapp_message_id: data.message_id || null
            }
          })

          await supabase
            .from('conversaciones')
            .update({
              ultimo_mensaje: mensajeWhatsApp.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', conversacionId)
        } catch (chatDbErr) {
          console.warn('Error registrando mensaje en tabla mensajes:', chatDbErr)
        }
      }

      setWhatsappEnviado(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Error enviando mensaje de WhatsApp:', err)
      setError(err.message || 'No se pudo enviar el mensaje por WhatsApp.')
    } finally {
      setEnviandoWhatsApp(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-[var(--border)] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header del Modal */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shadow-inner">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  {paso === 'whatsapp' ? '¿Enviar Presupuesto por WhatsApp?' : 'Emitir Presupuesto Médico Oficial'}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40">
                  PDF Membretado
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)]">
                Paciente: <strong className="text-white">{pacienteNombre}</strong> {pacienteDni && `(DNI: ${pacienteDni})`} • Obra Social: <strong className="text-blue-300">{obraSocial || 'Particular'}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* PASO 1: Formulario de Ítems y Aranceles */}
        {paso === 'formulario' ? (
          <form onSubmit={handleEmitir} className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
                <AlertCircle size={15} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Configuración de Moneda y Estado Inicial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-950/40 border border-[var(--border)]">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-amber-400" />
                  Moneda de Cotización
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMoneda('ARS')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      moneda === 'ARS'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                        : 'bg-neutral-900 border-[var(--border)] text-gray-400 hover:text-white'
                    }`}
                  >
                    $ Pesos Argentinos (ARS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoneda('USD')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      moneda === 'USD'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-neutral-900 border-[var(--border)] text-gray-400 hover:text-white'
                    }`}
                  >
                    U$S Dólares (USD)
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <FileCheck2 size={14} className="text-indigo-400" />
                  Estado Inicial del Presupuesto
                </label>
                <select
                  value={emitirEstado}
                  onChange={(e) => setEmitirEstado(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-indigo-500 rounded-xl text-white font-medium focus:outline-none"
                >
                  <option value="enviado">Enviado / En Análisis (Recomendado)</option>
                  <option value="borrador">Borrador Interno</option>
                  <option value="aprobado">Aprobado / Confirmado Directamente</option>
                </select>
              </div>
            </div>

            {/* Buscador de Prestaciones en el Nomenclador */}
            <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Search size={14} className="text-blue-400" />
                  Añadir Práctica o Concepto desde el Nomenclador
                </label>
                <button
                  type="button"
                  onClick={handleAgregarManual}
                  className="text-[11px] text-blue-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus size={12} />
                  + Agregar concepto libre / manual
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar prestación por código o nombre (ej: 180104, FIV, Laparoscopía, Anestesia)..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value)
                    buscarPracticasCatalogo(e.target.value)
                    setMostrarDropdown(true)
                  }}
                  onFocus={() => {
                    buscarPracticasCatalogo(busqueda)
                    setMostrarDropdown(true)
                  }}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-[var(--border)] focus:border-blue-500 rounded-xl text-white placeholder-gray-500 focus:outline-none"
                />
                {buscando && (
                  <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-blue-400" />
                )}

                {/* Dropdown del catálogo */}
                {mostrarDropdown && practicasCatalogo.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-neutral-900 border border-blue-500/30 rounded-xl shadow-2xl z-30 divide-y divide-[var(--border)]">
                    {practicasCatalogo.map((p, i) => (
                      <button
                        key={`${p.codigo}-${i}`}
                        type="button"
                        onClick={() => handleAgregarItem(p)}
                        className="w-full text-left p-2.5 hover:bg-blue-600/15 text-xs transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-bold text-white group-hover:text-blue-300 transition-colors">
                            {p.nombre}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            Código: {p.codigo} {p.categoria && `• ${p.categoria}`}
                          </div>
                        </div>
                        {p.precio ? (
                          <div className="text-xs font-mono font-bold text-emerald-400">
                            ${Number(p.precio).toLocaleString()} {p.moneda || 'ARS'}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-500">Arancel a definir</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de Ítems del Presupuesto */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300">
                Detalle de Prestaciones e Ítems a Cotizar ({items.length})
              </label>

              {items.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-[var(--border)] rounded-2xl text-xs text-gray-500 space-y-2">
                  <FileText size={24} className="mx-auto text-gray-600" />
                  <p>No hay ítems en este presupuesto aún.</p>
                  <button
                    type="button"
                    onClick={handleAgregarManual}
                    className="text-blue-400 hover:underline font-bold text-[11px]"
                  >
                    + Agregar primer ítem
                  </button>
                </div>
              ) : (
                <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
                  {/* Header de columnas */}
                  <div className="bg-neutral-950/80 px-3 py-2 text-[10px] font-bold text-gray-400 grid grid-cols-12 gap-2 uppercase">
                    <div className="col-span-6">Descripción de la Prestación / Concepto</div>
                    <div className="col-span-2 text-center">Cantidad</div>
                    <div className="col-span-2 text-right">Precio Unitario ({moneda})</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                  </div>

                  {/* Filas */}
                  {items.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-neutral-900/60 grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-6 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEliminarItem(idx)}
                          className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 size={13} />
                        </button>
                        <input
                          type="text"
                          value={item.nombre}
                          onChange={(e) => handleUpdateItem(idx, 'nombre', e.target.value)}
                          className="w-full bg-transparent text-white font-medium focus:outline-none border-b border-transparent focus:border-blue-500 text-xs"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => handleUpdateItem(idx, 'cantidad', e.target.value)}
                          className="w-full px-2 py-1 bg-neutral-950 border border-[var(--border)] rounded-lg text-center font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precio_unitario}
                          onChange={(e) => handleUpdateItem(idx, 'precio_unitario', e.target.value)}
                          className="w-full px-2 py-1 bg-neutral-950 border border-[var(--border)] rounded-lg text-right font-mono text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400">
                        ${item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}

                  {/* Footer Total */}
                  <div className="p-3 bg-neutral-950 flex items-center justify-between border-t border-[var(--border)]">
                    <span className="text-xs font-bold text-gray-300">TOTAL GENERAL COTIZADO:</span>
                    <span className="text-base font-black font-mono text-white tracking-tight">
                      {moneda === 'USD' ? 'USD ' : '$ '}
                      {totalGeneral.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-xs text-gray-400 font-sans font-normal">{moneda}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer de Acciones del Modal */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="px-4 py-2 border border-[var(--border)] rounded-xl text-gray-400 hover:bg-neutral-800 text-xs font-bold transition-all"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={guardando || items.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
              >
                {guardando ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generando PDF membretado...
                  </>
                ) : (
                  <>
                    <Receipt size={14} />
                    Emitir Presupuesto & Generar PDF
                  </>
                )}
              </button>
            </div>

          </form>
        ) : (
          /* PASO 2: Confirmación de Envío por WhatsApp */
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">¡Presupuesto Emitido con Éxito!</h4>
                <p className="text-xs text-emerald-300">
                  El PDF membretado ha sido generado y guardado en el expediente. ¿Deseas enviarlo ahora por WhatsApp al paciente?
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {whatsappEnviado ? (
              <div className="p-6 text-center space-y-2 bg-neutral-950 rounded-xl border border-emerald-500/40">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400 animate-bounce" />
                <h4 className="text-sm font-bold text-white">¡Mensaje Enviado por WhatsApp!</h4>
                <p className="text-xs text-gray-400">El paciente ya recibió la cotización y el enlace al documento membretado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-emerald-400" />
                      Número de WhatsApp del Paciente
                    </label>
                    <input
                      type="text"
                      value={telefonoWhatsApp}
                      onChange={(e) => setTelefonoWhatsApp(e.target.value)}
                      placeholder="Ej: +5491122334455 o 381..."
                      className="px-3 py-2 text-xs bg-neutral-950 border border-[var(--border)] focus:border-emerald-500 rounded-xl text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    {presupuestoGenerado?.pdf_url && (
                      <a
                        href={
                          presupuestoGenerado.pdf_url.startsWith('http')
                            ? presupuestoGenerado.pdf_url
                            : `${BACKEND_URL}${presupuestoGenerado.pdf_url.startsWith('/') ? '' : '/'}${presupuestoGenerado.pdf_url}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-[var(--border)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download size={13} className="text-blue-400" />
                        Ver PDF Generado
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">
                    Mensaje de WhatsApp a Enviar
                  </label>
                  <textarea
                    value={mensajeWhatsApp}
                    onChange={(e) => setMensajeWhatsApp(e.target.value)}
                    rows={6}
                    className="w-full p-3 text-xs border border-[var(--border)] rounded-xl bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans text-white leading-relaxed resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={enviandoWhatsApp}
                    className="px-4 py-2 border border-[var(--border)] rounded-xl text-gray-400 hover:bg-neutral-800 text-xs font-bold transition-all"
                  >
                    Omitir / Solo Guardar
                  </button>

                  <button
                    type="button"
                    onClick={handleEnviarWhatsApp}
                    disabled={enviandoWhatsApp || !telefonoWhatsApp}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
                  >
                    {enviandoWhatsApp ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Enviando por WhatsApp...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Sí, Enviar por WhatsApp
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
