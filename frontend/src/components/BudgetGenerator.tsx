'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, FileText, Download, CheckCircle, RefreshCw, Loader2 } from 'lucide-react'

interface Paciente {
  id: string
  nombre: string
  telefono: string
}

interface Servicio {
  id: string
  nombre_prestacion: string
  codigo: string
  precio: number
}

interface SelectedItem {
  servicio: Servicio
  cantidad: number
}

export default function BudgetGenerator() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  
  const [selectedPacienteId, setSelectedPacienteId] = useState('')
  const [selectedServicioId, setSelectedServicioId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  
  const [items, setItems] = useState<SelectedItem[]>([])
  const [creando, setCreando] = useState(false)
  const [presupuestoCreado, setPresupuestoCreado] = useState<any | null>(null)
  const [mensaje, setMensaje] = useState('')

  // Cargar pacientes y servicios
  const loadData = async () => {
    try {
      const { data: pacs } = await supabase.from('pacientes').select('id, nombre, telefono').order('nombre')
      const { data: servs } = await supabase.from('servicios_precios').select('*').eq('activo', true).order('nombre_prestacion')
      
      if (pacs) setPacientes(pacs)
      if (servs) setServicios(servs as unknown as Servicio[])
    } catch (error) {
      console.error('Error al cargar datos iniciales del presupuesto:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Agregar ítem al listado
  const handleAddItem = () => {
    if (!selectedServicioId) return
    const servicio = servicios.find((s) => s.id === selectedServicioId)
    if (!servicio) return

    // Buscar si ya existe
    const existIndex = items.findIndex((i) => i.servicio.id === selectedServicioId)
    if (existIndex > -1) {
      const updated = [...items]
      updated[existIndex].cantidad += cantidad
      setItems(updated)
    } else {
      setItems([...items, { servicio, cantidad }])
    }
    
    // Resetear selección
    setSelectedServicioId('')
    setCantidad(1)
  }

  // Quitar ítem
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // Calcular total dinámico
  const total = items.reduce((acc, item) => acc + item.servicio.precio * item.cantidad, 0)

  // Enviar a la API del Backend para crear presupuesto y PDF
  const handleSaveBudget = async () => {
    if (!selectedPacienteId) {
      setMensaje('Error: Por favor selecciona un paciente.')
      return
    }
    if (items.length === 0) {
      setMensaje('Error: Agrega al menos un servicio médico.')
      return
    }

    setCreando(true)
    setMensaje('')
    setPresupuestoCreado(null)

    const payload = {
      paciente_id: selectedPacienteId,
      items: items.map((it) => ({
        codigo_servicio: it.servicio.codigo,
        cantidad: it.cantidad
      }))
    }

    try {
      const response = await fetch('http://localhost:8000/api/presupuestos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setPresupuestoCreado(data.presupuesto)
        setItems([])
        setSelectedPacienteId('')
        setMensaje('¡Presupuesto y PDF médico creados exitosamente!')
      } else {
        setMensaje(`Error: ${data.error || 'No se pudo guardar el presupuesto.'}`)
      }
    } catch (error) {
      console.error('Error al guardar presupuesto:', error)
      setMensaje('Error: No se pudo conectar con el servidor de presupuestos.')
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full p-4">
      
      {/* Columna Izquierda: Formulario (2 columnas ancho en pantallas lg) */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Cabecera del Generador */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm">
          <h2 className="text-md font-bold mb-4 flex items-center gap-2">
            <FileText className="text-blue-600" size={20} />
            Crear Presupuesto Médico
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selección de Paciente */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Paciente</label>
              <select
                value={selectedPacienteId}
                onChange={(e) => setSelectedPacienteId(e.target.value)}
                className="px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="">-- Seleccionar Paciente --</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.telefono})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button 
                onClick={loadData}
                className="px-4 py-2.5 text-xs border border-[var(--border)] rounded-xl hover:bg-slate-50 text-[var(--secondary)] flex items-center gap-1.5 font-bold transition-all"
              >
                <RefreshCw size={14} /> Recargar Catálogos
              </button>
            </div>
          </div>
        </div>

        {/* Creador de Items */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Añadir Prestaciones Médicas</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-end">
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Prestación / Servicio</label>
              <select
                value={selectedServicioId}
                onChange={(e) => setSelectedServicioId(e.target.value)}
                className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="">-- Seleccionar Servicio --</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre_prestacion} [{s.codigo}] - ${s.precio}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Cant.</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                className="px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 text-center focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow flex items-center justify-center gap-1 h-9"
            >
              <Plus size={16} /> Agregar
            </button>
          </div>
        </div>

        {/* Listado de Servicios agregados */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detalle del Presupuesto</h3>
          
          {items.length === 0 ? (
            <p className="text-xs text-[var(--secondary)] py-8 text-center bg-slate-50 rounded-xl border border-dashed border-[var(--border)]">
              No se han agregado ítems al presupuesto médico
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-slate-400 font-semibold">
                    <th className="py-2.5">Código</th>
                    <th>Descripción</th>
                    <th className="text-right">Precio Unit.</th>
                    <th className="text-center">Cant.</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)] text-slate-700">
                      <td className="py-3 font-semibold">{item.servicio.codigo}</td>
                      <td>{item.servicio.nombre_prestacion}</td>
                      <td className="text-right">${Number(item.servicio.precio).toFixed(2)}</td>
                      <td className="text-center">{item.cantidad}</td>
                      <td className="text-right font-bold">${(item.servicio.precio * item.cantidad).toFixed(2)}</td>
                      <td className="text-center">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Resumen de Totales y Descarga */}
      <div className="space-y-6">
        
        {/* Resumen del Presupuesto */}
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumen Económico</h3>
          
          <div className="space-y-2 border-b border-[var(--border)] pb-3">
            <div className="flex justify-between text-xs text-[var(--secondary)]">
              <span>Items agregados</span>
              <span className="font-semibold">{items.length}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--secondary)]">
              <span>Moneda</span>
              <span className="font-semibold">USD</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm py-2">
            <span className="font-bold">Total Presupuestado:</span>
            <span className="text-lg font-extrabold text-blue-600">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleSaveBudget}
            disabled={creando || items.length === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            {creando ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Guardando...
              </>
            ) : (
              'Confirmar y Generar PDF'
            )}
          </button>

          {mensaje && (
            <p className={`text-xs text-center font-semibold mt-2 ${
              mensaje.startsWith('Error') ? 'text-red-500' : 'text-emerald-500'
            }`}>
              {mensaje}
            </p>
          )}
        </div>

        {/* Tarjeta de Éxito / Descarga de PDF */}
        {presupuestoCreado && (
          <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl shadow-sm space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={20} />
              <h3 className="text-xs font-bold uppercase tracking-wider">Documento Listo</h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-300">
              El presupuesto médico ha sido registrado y el archivo PDF se encuentra listo para descargar.
            </p>
            
            <a
              href={`http://localhost:8000${presupuestoCreado.pdf_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow flex items-center justify-center gap-1.5"
            >
              <Download size={15} />
              <span>Descargar PDF</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
