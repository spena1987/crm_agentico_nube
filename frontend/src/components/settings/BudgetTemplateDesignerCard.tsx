'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText,
  Palette,
  Save,
  Download,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  Sparkles,
  RefreshCw
} from 'lucide-react'

interface PlantillaPresupuestoConfig {
  titulo_documento: string
  nombre_institucion: string
  subtitulo_institucion: string
  direccion: string
  telefono: string
  email: string
  sitio_web: string
  color_primario: string
  color_secundario: string
  validez_dias: number
  terminos_condiciones: string[]
  pie_pagina: string
  mostrar_firma: boolean
  texto_firma: string
}

const DEFAULT_PLANTILLA: PlantillaPresupuestoConfig = {
  titulo_documento: 'PRESUPUESTO MÉDICO',
  nombre_institucion: 'CLÍNICA MÉDICA NUBE',
  subtitulo_institucion: 'Atención Médica Digital & Especialidades',
  direccion: 'Av. Corrientes 1234, CABA, Argentina',
  telefono: '+54 9 11 5555-0199',
  email: 'contacto@centromediconube.com',
  sitio_web: 'www.centromediconube.com',
  color_primario: '#1E3A8A',
  color_secundario: '#2563EB',
  validez_dias: 30,
  terminos_condiciones: [
    'Este presupuesto tiene una validez de 30 días corridos a partir de la fecha de emisión.',
    'Los precios cotizados respetan la moneda especificada (Pesos ARS o Dólares USD).',
    'La confirmación de turnos quirúrgicos, prácticas y estudios de alta complejidad queda supeditada a disponibilidad de agenda y confirmación de pago.',
    'Formas de pago habilitadas: Transferencia bancaria, Tarjetas de crédito/débito y Efectivo en administración.'
  ],
  pie_pagina: 'Documento emitido electrónicamente por el sistema CRM Médico Nube.',
  mostrar_firma: true,
  texto_firma: 'Firma y Sello Profesional / Autorización Médica'
}

const PALETA_COLORES = [
  { nombre: 'Azul Clínico', hex: '#1E3A8A' },
  { nombre: 'Azul Real', hex: '#2563EB' },
  { nombre: 'Turquesa Médico', hex: '#0D9488' },
  { nombre: 'Verde Salud', hex: '#15803D' },
  { nombre: 'Índigo Moderno', hex: '#4338CA' },
  { nombre: 'Púrpura Especialidades', hex: '#7E22CE' },
  { nombre: 'Gris Corporativo', hex: '#334155' }
]

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function BudgetTemplateDesignerCard() {
  const [config, setConfig] = useState<PlantillaPresupuestoConfig>(DEFAULT_PLANTILLA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    loadTemplateSettings()
  }, [])

  const loadTemplateSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/api/settings`)
      if (res.ok) {
        const data = await res.json()
        if (data.plantilla_presupuesto) {
          setConfig({
            ...DEFAULT_PLANTILLA,
            ...data.plantilla_presupuesto,
            terminos_condiciones: data.plantilla_presupuesto.terminos_condiciones || DEFAULT_PLANTILLA.terminos_condiciones
          })
        }
      }
    } catch (err) {
      console.error('Error al cargar configuración de plantilla:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setSaving(true)
      setFeedback(null)

      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantilla_presupuesto: config
        })
      })

      if (res.ok) {
        setFeedback({ tipo: 'success', texto: '¡Diseño de plantilla de presupuesto guardado exitosamente!' })
      } else {
        setFeedback({ tipo: 'error', texto: 'Error al guardar la plantilla.' })
      }
    } catch (err) {
      console.error('Error guardando plantilla:', err)
      setFeedback({ tipo: 'error', texto: 'Error al conectar con el servidor.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadSamplePdf = async () => {
    try {
      setGeneratingPdf(true)
      // Guardar primero para asegurar que el PDF use los últimos cambios
      await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantilla_presupuesto: config })
      })

      const res = await fetch(`${API_BASE_URL}/api/presupuestos/plantilla-preview`)
      if (res.ok) {
        const data = await res.json()
        if (data.pdf_url) {
          window.open(`${API_BASE_URL}${data.pdf_url}`, '_blank')
        }
      }
    } catch (err) {
      console.error('Error generando PDF de muestra:', err)
      setFeedback({ tipo: 'error', texto: 'No se pudo generar el PDF de muestra.' })
    } finally {
      setGeneratingPdf(false)
    }
  }

  // Manejadores de términos y condiciones
  const handleAddTermino = () => {
    setConfig({
      ...config,
      terminos_condiciones: [...config.terminos_condiciones, 'Nueva condición o cláusula de atención médica.']
    })
  }

  const handleUpdateTermino = (index: number, value: string) => {
    const updated = [...config.terminos_condiciones]
    updated[index] = value
    setConfig({ ...config, terminos_condiciones: updated })
  }

  const handleRemoveTermino = (index: number) => {
    setConfig({
      ...config,
      terminos_condiciones: config.terminos_condiciones.filter((_, i) => i !== index)
    })
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
        Cargando diseñador de plantilla de presupuestos...
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Encabezado Principal del Diseñador */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FileText className="text-blue-600" size={22} />
              Diseñador de Plantillas de Presupuestos Médicos
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-1">
              Personaliza la identidad visual, colores institucionales, datos de contacto, términos y condiciones del documento PDF emitido a los pacientes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSamplePdf}
              disabled={generatingPdf}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-[var(--border)] disabled:opacity-50"
            >
              {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Descargar PDF de Prueba
            </button>

            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar Plantilla
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 animate-scale-in ${
              feedback.tipo === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.tipo === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.texto}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold hover:underline">
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Grid Principal: Formulario de Configuración (Izq) + Vista Previa en Vivo (Der) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Formulario de Configuración (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Identidad Institucional */}
          <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-[var(--border)] pb-3">
              <Building2 className="text-blue-600" size={18} />
              1. Identidad Institucional & Encabezado
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Nombre de la Institución / Clínica</label>
                  <input
                    type="text"
                    value={config.nombre_institucion}
                    onChange={(e) => setConfig({ ...config, nombre_institucion: e.target.value })}
                    placeholder="ej: CLÍNICA MÉDICA NUBE"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Título del Documento</label>
                  <input
                    type="text"
                    value={config.titulo_documento}
                    onChange={(e) => setConfig({ ...config, titulo_documento: e.target.value })}
                    placeholder="ej: PRESUPUESTO MÉDICO"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Subtítulo / Especialidades</label>
                <input
                  type="text"
                  value={config.subtitulo_institucion}
                  onChange={(e) => setConfig({ ...config, subtitulo_institucion: e.target.value })}
                  placeholder="ej: Atención Médica Digital & Especialidades"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Teléfono de Contacto</label>
                  <input
                    type="text"
                    value={config.telefono}
                    onChange={(e) => setConfig({ ...config, telefono: e.target.value })}
                    placeholder="ej: +54 9 11 5555-0199"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Email de Contacto</label>
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) => setConfig({ ...config, email: e.target.value })}
                    placeholder="ej: contacto@clinica.com"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Dirección del Consultorio</label>
                  <input
                    type="text"
                    value={config.direccion}
                    onChange={(e) => setConfig({ ...config, direccion: e.target.value })}
                    placeholder="ej: Av. Corrientes 1234, CABA"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Sitio Web (Opcional)</label>
                  <input
                    type="text"
                    value={config.sitio_web}
                    onChange={(e) => setConfig({ ...config, sitio_web: e.target.value })}
                    placeholder="ej: www.clinicamedica.com"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Color y Marca */}
          <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-[var(--border)] pb-3">
              <Palette className="text-blue-600" size={18} />
              2. Paleta de Colores de la Plantilla
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-500 block mb-2">Color Primario Institucional</label>
                <div className="flex flex-wrap items-center gap-2">
                  {PALETA_COLORES.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setConfig({ ...config, color_primario: c.hex, color_secundario: c.hex })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition ${
                        config.color_primario === c.hex
                          ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/40 font-bold'
                          : 'border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: c.hex }} />
                      <span>{c.nombre}</span>
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <input
                      type="color"
                      value={config.color_primario}
                      onChange={(e) => setConfig({ ...config, color_primario: e.target.value, color_secundario: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-[var(--border)] p-0.5 bg-transparent"
                    />
                    <span className="font-mono text-[11px] text-slate-500">{config.color_primario}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Días de Validez del Presupuesto</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={config.validez_dias}
                  onChange={(e) => setConfig({ ...config, validez_dias: parseInt(e.target.value) || 30 })}
                  className="w-32 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Términos y Condiciones */}
          <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <FileText className="text-blue-600" size={18} />
                3. Términos, Condiciones y Cláusulas
              </h3>
              <button
                type="button"
                onClick={handleAddTermino}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200 dark:border-blue-800"
              >
                <Plus size={13} /> Agregar Cláusula
              </button>
            </div>

            <div className="space-y-2.5">
              {config.terminos_condiciones.map((term, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="font-bold text-slate-400 text-xs mt-2.5 shrink-0">{index + 1}.</span>
                  <textarea
                    rows={2}
                    value={term}
                    onChange={(e) => handleUpdateTermino(index, e.target.value)}
                    className="flex-1 p-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTermino(index)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition mt-1 shrink-0"
                    title="Eliminar cláusula"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Firma y Pie de Página */}
          <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-[var(--border)] pb-3">
              <CheckCircle className="text-blue-600" size={18} />
              4. Firma y Pie de Página
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mostrar_firma}
                  onChange={(e) => setConfig({ ...config, mostrar_firma: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Incluir línea de firma y sello profesional al final del PDF
                </span>
              </label>

              {config.mostrar_firma && (
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Leyenda de la Firma</label>
                  <input
                    type="text"
                    value={config.texto_firma}
                    onChange={(e) => setConfig({ ...config, texto_firma: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-500 block mb-1">Texto del Pie de Página</label>
                <input
                  type="text"
                  value={config.pie_pagina}
                  onChange={(e) => setConfig({ ...config, pie_pagina: e.target.value })}
                  placeholder="ej: Documento emitido electrónicamente por el sistema..."
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Vista Previa en Vivo (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={14} className="text-blue-600" />
                Vista Previa en Tiempo Real
              </h3>
              <span className="text-[10px] text-slate-400">Simulación del documento PDF</span>
            </div>

            {/* Hoja de Presupuesto Simulada */}
            <div className="bg-white text-slate-800 p-6 rounded-2xl shadow-xl border border-slate-200 text-[11px] space-y-4 font-sans select-none overflow-hidden">
              {/* Encabezado */}
              <div className="flex items-start justify-between border-b pb-3" style={{ borderColor: config.color_primario }}>
                <div>
                  <div className="font-black text-sm tracking-tight" style={{ color: config.color_primario }}>
                    {config.nombre_institucion || 'CLÍNICA MÉDICA'}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    {config.subtitulo_institucion}
                  </div>
                  {(config.direccion || config.telefono) && (
                    <div className="text-[8px] text-slate-400 mt-0.5">
                      {config.direccion} • Tel: {config.telefono}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="font-bold text-xs" style={{ color: config.color_primario }}>
                    {config.titulo_documento || 'PRESUPUESTO MÉDICO'}
                  </div>
                  <div className="text-[9px] text-slate-500">Doc. N°: <b>39F2C255</b></div>
                  {config.sitio_web && (
                    <div className="text-[8px] text-slate-400">{config.sitio_web}</div>
                  )}
                </div>
              </div>

              {/* Paciente y Emisión */}
              <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px]">
                <div>
                  <div className="font-bold text-[9px] uppercase tracking-wider mb-1" style={{ color: config.color_primario }}>
                    Datos del Paciente:
                  </div>
                  <div className="space-y-0.5 text-slate-600">
                    <div><b>Nombre:</b> SOTTILE, MAYRA</div>
                    <div><b>Teléfono:</b> +54 9 261 470-3230</div>
                    <div><b>Cobertura:</b> Particular</div>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-[9px] uppercase tracking-wider mb-1" style={{ color: config.color_primario }}>
                    Detalle de Emisión:
                  </div>
                  <div className="space-y-0.5 text-slate-600">
                    <div><b>Fecha:</b> 2026-08-15</div>
                    <div><b>Validez:</b> {config.validez_dias} días</div>
                    <div><b>Moneda:</b> <span className="font-bold text-emerald-600">Multi-moneda (ARS / USD)</span></div>
                  </div>
                </div>
              </div>

              {/* Tabla de Prestaciones de Muestra */}
              <div className="rounded-lg overflow-hidden border border-slate-200">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="text-white font-bold" style={{ backgroundColor: config.color_primario }}>
                      <th className="py-1.5 px-2">Cód.</th>
                      <th className="py-1.5 px-2">Prestación / Descripción</th>
                      <th className="py-1.5 px-2 text-center">Mon.</th>
                      <th className="py-1.5 px-2 text-right">P. Unit.</th>
                      <th className="py-1.5 px-2 text-center">Cant.</th>
                      <th className="py-1.5 px-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-white">
                      <td className="py-1.5 px-2 font-mono font-bold text-blue-600">420101</td>
                      <td className="py-1.5 px-2">Consulta Médica en Consultorio</td>
                      <td className="py-1.5 px-2 text-center font-bold text-[9px]">ARS</td>
                      <td className="py-1.5 px-2 text-right font-mono">$ 8.500,00</td>
                      <td className="py-1.5 px-2 text-center">1</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold">$ 8.500,00</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-1.5 px-2 font-mono font-bold text-blue-600">180104</td>
                      <td className="py-1.5 px-2">Ecografía Tocoginecológica</td>
                      <td className="py-1.5 px-2 text-center font-bold text-[9px]">ARS</td>
                      <td className="py-1.5 px-2 text-right font-mono">$ 22.000,00</td>
                      <td className="py-1.5 px-2 text-center">1</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold">$ 22.000,00</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="py-1.5 px-2 font-mono font-bold text-blue-600">FIV-01</td>
                      <td className="py-1.5 px-2">Tratamiento FIV + ICSI Completo</td>
                      <td className="py-1.5 px-2 text-center font-bold text-[9px] text-amber-600">USD</td>
                      <td className="py-1.5 px-2 text-right font-mono text-amber-700">USD 1.500,00</td>
                      <td className="py-1.5 px-2 text-center">1</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-700">USD 1.500,00</td>
                    </tr>
                  </tbody>
                  <tfoot className="border-t-2" style={{ borderColor: config.color_primario }}>
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={4} className="py-1.5 px-2 text-right">TOTAL ARS:</td>
                      <td colSpan={2} className="py-1.5 px-2 text-right font-mono text-xs" style={{ color: config.color_primario }}>
                        $ 30.500,00
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={4} className="py-1.5 px-2 text-right">TOTAL USD:</td>
                      <td colSpan={2} className="py-1.5 px-2 text-right font-mono text-xs text-amber-700">
                        USD 1.500,00
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Términos y Condiciones */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[9px] space-y-1">
                <div className="font-bold text-[9px] uppercase tracking-wider" style={{ color: config.color_primario }}>
                  Términos y Condiciones del Presupuesto:
                </div>
                {config.terminos_condiciones.map((t, idx) => (
                  <div key={idx} className="text-slate-600">
                    <b>{idx + 1}.</b> {t}
                  </div>
                ))}
              </div>

              {/* Firma */}
              {config.mostrar_firma && (
                <div className="pt-4 flex justify-end">
                  <div className="text-center w-48 border-t border-slate-400 pt-1 text-[9px] font-bold text-slate-600">
                    {config.texto_firma}
                  </div>
                </div>
              )}

              {/* Pie de Página */}
              {config.pie_pagina && (
                <div className="text-center text-[8px] text-slate-400 pt-2 border-t border-slate-100">
                  {config.pie_pagina}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
