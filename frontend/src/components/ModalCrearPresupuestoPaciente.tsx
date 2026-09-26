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
  AlertCircle,
  FileCheck2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import ModalSmartBundleSugerencias, {
  RelacionPracticaPresupuesto,
  ItemSeleccionadoBundle
} from './ModalSmartBundleSugerencias'

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
  requiere_lente?: boolean
}

export interface LioComercial {
  id: string
  codigo: string
  nombre: string
  categoria: string
  precio: number
  moneda: 'ARS' | 'USD'
  es_torico: boolean
  tipo_vision: string
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
  obraSocial,
  asesoriaId,
  practicaInicial,
  onPresupuestoCreado
}: ModalCrearPresupuestoPacienteProps) {
  const [monedaDefault, setMonedaDefault] = useState<'ARS' | 'USD'>('ARS')
  const [items, setItems] = useState<ItemPresupuestoForm[]>([])
  
  // Búsqueda en Nomenclador
  const [busqueda, setBusqueda] = useState('')
  const [practicasCatalogo, setPracticasCatalogo] = useState<PracticaNomenclador[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarDropdown, setMostrarDropdown] = useState(false)

  // LIOs Comerciales (1-Clic)
  const [liosDisponibles, setLiosDisponibles] = useState<LioComercial[]>([])
  const [practicaRequiereLente, setPracticaRequiereLente] = useState(false)

  const [emitirEstado, setEmitirEstado] = useState<'enviado' | 'borrador' | 'aprobado'>('enviado')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prácticas Vinculadas (Smart Bundle)
  const [bundlePracticaPrincipal, setBundlePracticaPrincipal] = useState<{ codigo?: string; nombre: string } | null>(null)
  const [bundleRelaciones, setBundleRelaciones] = useState<RelacionPracticaPresupuesto[]>([])
  const [mostrarBundleModal, setMostrarBundleModal] = useState(false)

  // Consultar y abrir modal de prácticas conexas / Smart Bundle
  const consultarRelaciones = async (practicaId: string, practicaNombre: string, practicaCodigo?: string) => {
    if (!practicaId) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/nomenclador/practicas/${practicaId}/relacionadas`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.relaciones && data.relaciones.length > 0) {
          setBundlePracticaPrincipal({ codigo: practicaCodigo, nombre: practicaNombre })
          setBundleRelaciones(data.relaciones)
          setMostrarBundleModal(true)
        }
      }
    } catch (err) {
      console.error('Error al consultar prácticas vinculadas:', err)
    }
  }

  // Cargar LIOs habilitados para una práctica específica
  const cargarLiosParaPractica = async (practicaIdOrCodigo?: string) => {
    try {
      const url = practicaIdOrCodigo
        ? `${BACKEND_URL}/api/nomenclador/lios-comerciales?practica_id=${encodeURIComponent(practicaIdOrCodigo)}&solo_habilitados=true`
        : `${BACKEND_URL}/api/nomenclador/lios-comerciales`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && data.lios) {
        setLiosDisponibles(data.lios.filter((l: any) => l.habilitado_en_practica !== false))
      }
    } catch (err) {
      console.error('Error cargando LIOs comerciales:', err)
    }
  }

  // Al abrir el modal, inicializar ítems, LIOs y estados
  useEffect(() => {
    if (isOpen) {
      setError(null)
      const listaInicial: ItemPresupuestoForm[] = []
      
      if (practicaInicial && practicaInicial.nombre) {
        const pPrecio = Number(practicaInicial.precio) || 0
        const pMoneda = (practicaInicial.moneda === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
        const pCodigo = practicaInicial.codigo || 'QUIR-01'
        const pNombre = practicaInicial.nombre

        const nomLow = pNombre.toLowerCase()
        const codLow = (pCodigo || '').toLowerCase()
        const esCatarata = nomLow.includes('catarata') || nomLow.includes('faco') || codLow.includes('34031') || nomLow.includes('lio')
        setPracticaRequiereLente(esCatarata)

        if (esCatarata && (pCodigo || pNombre)) {
          cargarLiosParaPractica(pCodigo || pNombre)
        }

        listaInicial.push({
          codigo: pCodigo,
          nombre: pNombre,
          cantidad: 1,
          precio_unitario: pPrecio,
          subtotal: pPrecio,
          moneda: pMoneda
        })

        if (pMoneda === 'USD') {
          setMonedaDefault('USD')
        }

        // Buscar en nomenclador para resolver precio sugerido e ID de práctica para Smart Bundle
        if (pNombre !== 'Nueva Cirugía / Procedimiento') {
          fetch(`${BACKEND_URL}/api/nomenclador/buscar-presupuesto?q=${encodeURIComponent(pCodigo || pNombre)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data.success && data.resultados && data.resultados.length > 0) {
                const sugerido = data.resultados[0]
                if (sugerido.requiere_lente || esCatarata) {
                  setPracticaRequiereLente(true)
                  cargarLiosParaPractica(sugerido.id || sugerido.codigo || pCodigo)
                }
                if (pPrecio === 0 && sugerido.precio && sugerido.precio > 0) {
                  setItems([{
                    servicio_id: sugerido.id,
                    codigo: sugerido.codigo || pCodigo,
                    nombre: sugerido.nombre || pNombre,
                    cantidad: 1,
                    precio_unitario: sugerido.precio,
                    subtotal: sugerido.precio,
                    moneda: (sugerido.moneda === 'USD' ? 'USD' : 'ARS')
                  }])
                  if (sugerido.moneda === 'USD') setMonedaDefault('USD')
                }
                // Si la práctica tiene ID, verificar si posee prácticas vinculadas (Anestesia, Quirófano, Insumos)
                if (sugerido.id) {
                  consultarRelaciones(sugerido.id, sugerido.nombre || pNombre, sugerido.codigo || pCodigo)
                }
              }
            })
            .catch(() => {})
        }
      } else {
        setPracticaRequiereLente(false)
        setLiosDisponibles([])
      }

      setItems(listaInicial)
      buscarPracticasCatalogo('')
    }
  }, [isOpen, practicaInicial?.nombre, practicaInicial?.codigo, practicaInicial?.precio, practicaInicial?.moneda])

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

    // Si la práctica requiere LIO, activar panel rápido de sugerencias de LIOs y cargar los habilitados para ella
    if (p.requiere_lente || (p.nombre && (p.nombre.toLowerCase().includes('catarata') || p.nombre.toLowerCase().includes('faco') || p.codigo === '34031'))) {
      setPracticaRequiereLente(true)
      cargarLiosParaPractica(p.id || p.codigo || p.nombre)
    }

    // Si tiene ID, consultar prácticas vinculadas (Anestesia, Quirófano, Insumos)
    if (p.id) {
      consultarRelaciones(p.id, p.nombre, p.codigo)
    }
  }

  // Agregar LIO comercial al presupuesto en 1-clic
  const handleAgregarLio = (lio: LioComercial) => {
    const precio = Number(lio.precio) || 0
    const nuevo: ItemPresupuestoForm = {
      servicio_id: lio.id,
      codigo: lio.codigo,
      nombre: lio.nombre,
      cantidad: 1,
      precio_unitario: precio,
      subtotal: precio,
      moneda: lio.moneda
    }
    setItems((prev) => [...prev, nuevo])
    if (lio.moneda === 'USD' && items.every((it) => it.moneda === 'USD' || it.precio_unitario === 0)) {
      setMonedaDefault('USD')
    }
  }

  // Confirmar y agregar selección de prácticas vinculadas (Smart Bundle)
  const handleConfirmarBundle = (seleccionadas: ItemSeleccionadoBundle[]) => {
    if (!seleccionadas || seleccionadas.length === 0) return
    const nuevosItems: ItemPresupuestoForm[] = seleccionadas.map((s) => ({
      servicio_id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      cantidad: s.cantidad,
      precio_unitario: s.precio_unitario,
      subtotal: s.cantidad * s.precio_unitario,
      moneda: s.moneda
    }))
    setItems((prev) => [...prev, ...nuevosItems])
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
      // Notificar al componente padre para que abra de inmediato el ModalEnviarPresupuestoWhatsApp unificado
      onPresupuestoCreado(pres)
      onClose()
    } catch (err: any) {
      console.error('Error emitiendo presupuesto:', err)
      setError(err.message || 'Error inesperado al emitir el presupuesto.')
    } finally {
      setGuardando(false)
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
                  Emitir Presupuesto Médico Oficial
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

        {/* Formulario de Ítems y Aranceles */}
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

          {/* Panel Inteligente de LIOs Disponibles (Inserción en 1 Clic) */}
          {practicaRequiereLente && liosDisponibles.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-neutral-950 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💎</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-200">
                      Lentes Intraoculares Disponibles (Opciones Comerciales con Precio)
                    </h4>
                    <p className="text-[11px] text-amber-300/80">
                      Esta cirugía incluye implante de LIO. Haz clic en las opciones para agregarlas al presupuesto y permitir que el paciente evalúe alternativas:
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  1-Clic
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {liosDisponibles.map((lio) => {
                  const yaAgregado = items.some((it) => it.servicio_id === lio.id || it.codigo === lio.codigo || it.nombre === lio.nombre)
                  return (
                    <button
                      key={lio.id || lio.codigo}
                      type="button"
                      onClick={() => handleAgregarLio(lio)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 group ${
                        yaAgregado
                          ? 'bg-amber-500/15 border-amber-400/50 text-white ring-1 ring-amber-400/30'
                          : 'bg-neutral-900/90 border-neutral-700/80 hover:border-amber-400/60 hover:bg-neutral-800 text-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold leading-tight group-hover:text-amber-300 transition-colors">
                          {lio.nombre}
                        </span>
                        {yaAgregado && (
                          <span className="text-[9px] bg-amber-500/30 text-amber-200 font-bold px-1.5 py-0.5 rounded shrink-0">
                            ✓ Cotizado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                        <span className="text-gray-400 text-[10px] font-medium">
                          {lio.tipo_vision || (lio.es_torico ? 'Tórico' : 'Estándar')}
                        </span>
                        <span className="font-mono font-bold text-amber-300">
                          {lio.moneda === 'USD' ? 'USD ' : '$ '}
                          {lio.precio.toLocaleString('es-AR', { minimumFractionDigits: lio.moneda === 'USD' ? 0 : 2 })}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
                  Emitir Presupuesto & Continuar a WhatsApp
                </>
              )}
            </button>
          </div>

        </form>

      </div>

      {/* Modal Sugerencias Smart Bundle (Prácticas y Costos Conexos) */}
      {mostrarBundleModal && bundlePracticaPrincipal && bundleRelaciones.length > 0 && (
        <ModalSmartBundleSugerencias
          isOpen={mostrarBundleModal}
          onClose={() => setMostrarBundleModal(false)}
          practicaPrincipal={bundlePracticaPrincipal}
          relaciones={bundleRelaciones}
          onConfirmar={handleConfirmarBundle}
        />
      )}
    </div>
  )
}
