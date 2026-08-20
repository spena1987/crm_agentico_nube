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
  Download,
  RotateCcw,
  Copy,
  Check
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
  moneda: 'ARS' | 'USD'
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
  const [monedaDefault, setMonedaDefault] = useState<'ARS' | 'USD'>('ARS')
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
  const [copiado, setCopiado] = useState(false)

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
        const pMoneda = (practicaInicial.moneda === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
        listaInicial.push({
          codigo: practicaInicial.codigo || 'QUIR-01',
          nombre: practicaInicial.nombre,
          cantidad: 1,
          precio_unitario: pPrecio,
          subtotal: pPrecio,
          moneda: pMoneda
        })
        if (pMoneda === 'USD') {
          setMonedaDefault('USD')
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
      const res = await fetch(`${BACKEND_URL}/api/nomenclador/buscar-presupuesto?q=${encodeURIComponent(qClean)}`)
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
    const pMoneda: 'ARS' | 'USD' = p.moneda === 'USD' ? 'USD' : 'ARS'
    const nuevo: ItemPresupuestoForm = {
      servicio_id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      cantidad: 1,
      precio_unitario: precio,
      subtotal: precio,
      moneda: pMoneda
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
      subtotal: 0,
      moneda: monedaDefault
    }
    setItems((prev) => [...prev, nuevo])
  }

  // Modificar cantidad, precio, nombre o moneda de un ítem
  const handleUpdateItem = (index: number, field: 'cantidad' | 'precio_unitario' | 'nombre' | 'moneda', val: any) => {
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
      } else if (field === 'moneda') {
        target.moneda = val as 'ARS' | 'USD'
      }
      
      copy[index] = target
      return copy
    })
  }

  // Eliminar ítem
  const handleEliminarItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Totales independientes por moneda
  const totalARS = items.filter((it) => it.moneda === 'ARS').reduce((acc, it) => acc + (it.subtotal || 0), 0)
  const totalUSD = items.filter((it) => it.moneda === 'USD').reduce((acc, it) => acc + (it.subtotal || 0), 0)

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
      moneda: totalUSD > 0 && totalARS === 0 ? 'USD' : 'ARS',
      items: items.map((it) => ({
        servicio_id: it.servicio_id || null,
        codigo: it.codigo || null,
        nombre: it.nombre,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        moneda: it.moneda || 'ARS'
      }))
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/presupuestos/crear-rapido`, {
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

      // Cargar plantilla amena sugerida desde el backend
      try {
        const msgRes = await fetch(`${BACKEND_URL}/api/presupuestos/${pres.id}/mensaje-sugerido`)
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          if (msgData.mensaje_sugerido) {
            setMensajeWhatsApp(msgData.mensaje_sugerido)
          }
        }
      } catch (msgErr) {
        console.warn('Fallback al construir mensaje sugerido:', msgErr)
      }

      // Pasar a la pantalla de confirmación de WhatsApp
      setPaso('whatsapp')
    } catch (err: any) {
      console.error('Error emitiendo presupuesto:', err)
      setError(err.message || 'Error inesperado al emitir el presupuesto.')
    } finally {
      setGuardando(false)
    }
  }

  // Enviar mensaje y documento PDF por WhatsApp
  const handleEnviarWhatsApp = async () => {
    if (!telefonoWhatsApp || !telefonoWhatsApp.trim()) {
      setError('Debes ingresar o confirmar un número de teléfono válido para WhatsApp.')
      return
    }

    if (!presupuestoGenerado?.id) {
      setError('No se encontró el ID del presupuesto generado.')
      return
    }

    try {
      setEnviandoWhatsApp(true)
      setError(null)

      const res = await fetch(`${BACKEND_URL}/api/presupuestos/${presupuestoGenerado.id}/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: telefonoWhatsApp.trim(),
          mensaje: mensajeWhatsApp.trim()
        })
      })

      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.detail || data.error || data.mensaje || 'Error al enviar por WhatsApp.')
      }

      setWhatsappEnviado(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Error enviando mensaje de WhatsApp:', err)
      setError(err.message || 'No se pudo enviar el presupuesto por WhatsApp.')
    } finally {
      setEnviandoWhatsApp(false)
    }
  }

  const handleCopiarTexto = () => {
    navigator.clipboard.writeText(mensajeWhatsApp)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
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
                  {paso === 'whatsapp' ? '¿Enviar Presupuesto por WhatsApp al Paciente?' : 'Emitir Presupuesto Médico Oficial'}
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

            {/* Configuración de Moneda por Defecto y Estado Inicial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-950/40 border border-[var(--border)]">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-amber-400" />
                  Moneda por Defecto (Nuevos Ítems)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMonedaDefault('ARS')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      monedaDefault === 'ARS'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                        : 'bg-neutral-900 border-[var(--border)] text-gray-400 hover:text-white'
                    }`}
                  >
                    $ Pesos Argentinos (ARS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonedaDefault('USD')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      monedaDefault === 'USD'
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
                  placeholder="Buscar prestación por código o nombre (ej: 180104, 111, Consulta, Facoemulsificación, LIO)..."
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
                          <div className={`text-xs font-mono font-bold ${p.moneda === 'USD' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {p.moneda === 'USD' ? 'USD ' : '$ '}
                            {Number(p.precio).toLocaleString('es-AR')} {p.moneda || 'ARS'}
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
                    <div className="col-span-5">Descripción de la Prestación / Concepto</div>
                    <div className="col-span-2 text-center">Moneda</div>
                    <div className="col-span-1 text-center">Cant.</div>
                    <div className="col-span-2 text-right">Precio Unit.</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                  </div>

                  {/* Filas */}
                  {items.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-neutral-900/60 grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEliminarItem(idx)}
                          className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors shrink-0"
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

                      {/* Selector de Moneda por Fila */}
                      <div className="col-span-2 flex items-center justify-center">
                        <select
                          value={item.moneda || 'ARS'}
                          onChange={(e) => handleUpdateItem(idx, 'moneda', e.target.value)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border outline-none ${
                            item.moneda === 'USD'
                              ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                              : 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                          }`}
                        >
                          <option value="ARS">🇦🇷 ARS ($)</option>
                          <option value="USD">🇺🇸 USD ($)</option>
                        </select>
                      </div>

                      <div className="col-span-1">
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => handleUpdateItem(idx, 'cantidad', e.target.value)}
                          className="w-full px-1.5 py-1 bg-neutral-950 border border-[var(--border)] rounded-lg text-center font-mono text-xs text-white focus:outline-none focus:border-blue-500"
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

                      <div className="col-span-2 text-right font-mono font-bold">
                        <span className={item.moneda === 'USD' ? 'text-amber-400' : 'text-emerald-400'}>
                          {item.moneda === 'USD' ? 'USD ' : '$ '}
                          {item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Footer Totales Discriminados Multi-Moneda */}
                  <div className="p-3.5 bg-neutral-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[var(--border)]">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">
                      Total General Cotizado:
                    </span>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {totalARS > 0 && (
                        <div className="px-3 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-xl">
                          <span className="text-[10px] text-emerald-400 font-semibold mr-1.5">🇦🇷 Total ARS:</span>
                          <span className="text-sm font-black font-mono text-emerald-300">
                            ${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      
                      {totalUSD > 0 && (
                        <div className="px-3 py-1 bg-amber-950/60 border border-amber-800/60 rounded-xl">
                          <span className="text-[10px] text-amber-400 font-semibold mr-1.5">🇺🇸 Total USD:</span>
                          <span className="text-sm font-black font-mono text-amber-300">
                            USD {totalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {totalARS === 0 && totalUSD === 0 && (
                        <span className="text-xs font-mono font-bold text-gray-500">$ 0,00</span>
                      )}
                    </div>
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
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
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
          /* PASO 2: Confirmación de Envío por WhatsApp con Mensaje Ameno */
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">¡Presupuesto Emitido con Éxito!</h4>
                <p className="text-xs text-emerald-300">
                  El documento PDF membretado ha sido generado. Puedes despacharlo ahora por WhatsApp con el mensaje protocolar adjunto.
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
                <h4 className="text-sm font-bold text-white">¡Presupuesto y PDF Enviados por WhatsApp!</h4>
                <p className="text-xs text-gray-400">El paciente ya recibió la cotización y el documento PDF membretado en su WhatsApp.</p>
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
                      placeholder="Ej: +5492615551234"
                      className="px-3 py-2 text-xs bg-neutral-950 border border-[var(--border)] focus:border-emerald-500 rounded-xl text-white font-mono font-bold focus:outline-none"
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
                        Ver Documento PDF Oficial
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-300">
                      Mensaje de Acompañamiento (WhatsApp)
                    </label>
                    <button
                      type="button"
                      onClick={handleCopiarTexto}
                      className="px-2 py-0.5 text-[10px] font-bold text-gray-400 hover:text-white bg-neutral-800 rounded flex items-center gap-1 transition"
                    >
                      {copiado ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <textarea
                    value={mensajeWhatsApp}
                    onChange={(e) => setMensajeWhatsApp(e.target.value)}
                    rows={8}
                    className="w-full p-3 text-xs border border-[var(--border)] rounded-xl bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans text-white leading-relaxed resize-none"
                  />
                  <p className="text-[10px] text-gray-400">
                    💡 El archivo PDF oficial se adjuntará y enviará directamente al número de WhatsApp del paciente.
                  </p>
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
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
                  >
                    {enviandoWhatsApp ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Enviando PDF por WhatsApp...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        🚀 Enviar Presupuesto por WhatsApp Ahora
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
