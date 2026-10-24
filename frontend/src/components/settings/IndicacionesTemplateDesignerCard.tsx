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
  RefreshCw,
  Pill,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Send,
  HelpCircle,
  Layers
} from 'lucide-react'
import { BACKEND_URL as API_BASE_URL } from '@/lib/api'

interface MedicamentoItem {
  droga: string
  dosis: string
  frecuencia: string
  duracion: string
  instrucciones: string
}

interface PlantillaIndicacionConfig {
  id?: string
  titulo: string
  categoria: string
  tipo_fase: 'prequirurgico' | 'postquirurgico' | 'ambos'
  geclisa_pim_id?: number | null
  cuerpo_indicaciones: string
  medicamentos: MedicamentoItem[]
  cuidados_generales: string
  pautas_alarma: string
  config_diseno: {
    color_primario: string
    color_secundario: string
    titulo_documento: string
    pie_pagina: string
    mostrar_logo: boolean
    mostrar_firma: boolean
    mostrar_qr: boolean
  }
}

const PALETA_COLORES = [
  { nombre: 'Azul Quirúrgico', hex: '#1E3A8A' },
  { nombre: 'Azul Real', hex: '#2563EB' },
  { nombre: 'Turquesa Oftalmo', hex: '#0D9488' },
  { nombre: 'Verde Médico', hex: '#15803D' },
  { nombre: 'Índigo Clínico', hex: '#4338CA' },
  { nombre: 'Gris Grafito', hex: '#334155' }
]

const DEFAULT_PLANTILLA: PlantillaIndicacionConfig = {
  titulo: 'Protocolo de Gotas y Colirios - Cataratas',
  categoria: 'Cataratas',
  tipo_fase: 'postquirurgico',
  geclisa_pim_id: 43,
  cuerpo_indicaciones: 'Indicaciones médicas postoperatorias de Cirugía de Catarata (Facoemulsificación con Implante de LIO). Aplicar las gotas oftálmicas según el esquema indicado a partir de la fecha de cirugía.',
  medicamentos: [
    { droga: 'Gatimicin D (Antibiótico + Corticoide)', dosis: '1 gota', frecuencia: 'Cada 4 horas', duracion: '7 días', instrucciones: 'Agitar bien antes de colocar' },
    { droga: 'Berlofen (Ketorolac)', dosis: '1 gota', frecuencia: 'Cada 4 horas', duracion: '7 días', instrucciones: 'Esperar 10 min respecto a la gota anterior' }
  ],
  cuidados_generales: '- No refregar ni frotar el ojo operado.\n- Usar protector ocular transparente para dormir durante 7 noches.\n- No sumergirse en piscinas ni hacer esfuerzos físicos pesados por 20 días.\n- Limpieza facial con toalla suave sin frotar.',
  pautas_alarma: 'Consulte de forma INMEDIATA a la guardia ante: dolor ocular agudo que no calma con analgésicos, visión borrosa súbita o secreción espesa.',
  config_diseno: {
    color_primario: '#1E3A8A',
    color_secundario: '#2563EB',
    titulo_documento: 'INDICACIONES MÉDICAS QUIRÚRGICAS',
    pie_pagina: 'Centro Visión - Documento oficial de indicaciones médicas postoperatorias.',
    mostrar_logo: true,
    mostrar_firma: true,
    mostrar_qr: true
  }
}

export default function IndicacionesTemplateDesignerCard() {
  const [plantillasCRM, setPlantillasCRM] = useState<PlantillaIndicacionConfig[]>([])
  const [plantillasGeclisa, setPlantillasGeclisa] = useState<any[]>([])
  const [plantillaActual, setPlantillaActual] = useState<PlantillaIndicacionConfig>(DEFAULT_PLANTILLA)
  
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [vistaActiva, setVistaActiva] = useState<'editor' | 'preview'>('editor')

  // Cargar plantillas del CRM y Geclisa al montar
  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    setMensajeError(null)
    try {
      // 1. Plantillas CRM
      const resCRM = await fetch(`${API_BASE_URL}/api/indicaciones/plantillas`)
      if (resCRM.ok) {
        const dataCRM = await resCRM.json()
        if (dataCRM.plantillas && dataCRM.plantillas.length > 0) {
          setPlantillasCRM(dataCRM.plantillas)
          setPlantillaActual(dataCRM.plantillas[0])
        }
      }

      // 2. Plantillas Geclisa en vivo
      const resGec = await fetch(`${API_BASE_URL}/api/indicaciones/plantillas-geclisa`)
      if (resGec.ok) {
        const dataGec = await resGec.json()
        if (dataGec.plantillas) {
          setPlantillasGeclisa(dataGec.plantillas)
        }
      }
    } catch (err: any) {
      console.error('Error cargando plantillas de indicaciones:', err)
      setMensajeError('No se pudo conectar con el servidor para cargar las plantillas.')
    } finally {
      setCargando(false)
    }
  }

  // Previsualizar PDF con ReportLab
  const handleGenerarPreviewPdf = async () => {
    setGenerandoPdf(true)
    try {
      const payload = {
        datos_emision: {
          paciente_nombre: 'María González',
          paciente_dni: '28.450.912',
          paciente_obra_social: 'OSDE 210',
          practica_nombre: 'Facoemulsificación con Implante de LIO Premium',
          ojo: 'OD',
          medico_nombre: 'Dr. Leonardo Bonanno',
          medico_matricula: '8421',
          cuerpo_indicaciones: plantillaActual.cuerpo_indicaciones,
          medicamentos: plantillaActual.medicamentos,
          cuidados_generales: plantillaActual.cuidados_generales,
          pautas_alarma: plantillaActual.pautas_alarma,
          geclisa_im_id: plantillaActual.geclisa_pim_id || 9510
        },
        config_diseno: plantillaActual.config_diseno
      }

      const res = await fetch(`${API_BASE_URL}/api/indicaciones/preview-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setPdfPreviewUrl(url)
        setVistaActiva('preview')
      } else {
        setMensajeError('Error generando la vista previa del PDF.')
      }
    } catch (e: any) {
      console.error(e)
      setMensajeError('Fallo al conectar con el motor de generación PDF.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  // Guardar plantilla en el CRM
  const handleGuardarPlantilla = async () => {
    setGuardando(true)
    setMensajeExito(null)
    setMensajeError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/plantillas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plantillaActual)
      })

      if (res.ok) {
        const data = await res.json()
        setMensajeExito('Plantilla de Indicaciones Médicas guardada con éxito.')
        // Refrescar lista
        const resCRM = await fetch(`${API_BASE_URL}/api/indicaciones/plantillas`)
        if (resCRM.ok) {
          const d = await resCRM.json()
          setPlantillasCRM(d.plantillas || [])
        }
        setTimeout(() => setMensajeExito(null), 4000)
      } else {
        const err = await res.json()
        setMensajeError(err.detail || 'Error al guardar la plantilla.')
      }
    } catch (e: any) {
      setMensajeError('No se pudo conectar con el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  // Agregar medicamento a la tabla
  const handleAgregarMedicamento = () => {
    setPlantillaActual({
      ...plantillaActual,
      medicamentos: [
        ...plantillaActual.medicamentos,
        { droga: '', dosis: '1 gota', frecuencia: 'Cada 4 horas', duracion: '7 días', instrucciones: '' }
      ]
    })
  }

  // Quitar medicamento
  const handleQuitarMedicamento = (index: number) => {
    const copia = [...plantillaActual.medicamentos]
    copia.splice(index, 1)
    setPlantillaActual({ ...plantillaActual, medicamentos: copia })
  }

  // Actualizar campo de medicamento
  const handleUpdateMed = (index: number, campo: keyof MedicamentoItem, valor: string) => {
    const copia = [...plantillaActual.medicamentos]
    copia[index] = { ...copia[index], [campo]: valor }
    setPlantillaActual({ ...plantillaActual, medicamentos: copia })
  }

  // Importar texto desde plantilla Geclisa
  const handleImportarDeGeclisa = (pimIdStr: string) => {
    const pimId = parseInt(pimIdStr)
    const match = plantillasGeclisa.find(p => p.pimId === pimId)
    if (match) {
      setPlantillaActual({
        ...plantillaActual,
        titulo: match.pimNombre,
        geclisa_pim_id: match.pimId,
        cuerpo_indicaciones: match.pimTexto || ''
      })
      setMensajeExito(`Texto cargado desde la plantilla de Geclisa #${pimId} (${match.pimNombre})`)
      setTimeout(() => setMensajeExito(null), 3000)
    }
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden transition-all">
      {/* Encabezado */}
      <div className="p-6 border-b border-[var(--border-color)] bg-gradient-to-r from-blue-900/10 via-transparent to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
              <FileText size={22} />
            </span>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Diseñador de Indicaciones Médicas & PDF
            </h2>
          </div>
          <p className="text-xs text-[var(--secondary)] mt-1">
            Personaliza el formato visual de las órdenes médicas quirúrgicas que se emiten en Geclisa y se envían por WhatsApp.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVistaActiva(vistaActiva === 'editor' ? 'preview' : 'editor')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
              vistaActiva === 'preview'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <Eye size={15} />
            <span>{vistaActiva === 'preview' ? 'Modo Editor' : 'Vista Previa PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleGenerarPreviewPdf}
            disabled={generandoPdf}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {generandoPdf ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            <span>Actualizar PDF</span>
          </button>

          <button
            type="button"
            onClick={handleGuardarPlantilla}
            disabled={guardando}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>Guardar Plantilla</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{mensajeExito}</span>
        </div>
      )}
      {mensajeError && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{mensajeError}</span>
        </div>
      )}

      {/* Selector de Plantilla y Sincronización con Geclisa */}
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--hover-bg)]/40 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="font-bold text-[var(--foreground)] block mb-1">
            Plantilla Guardada en CRM:
          </label>
          <select
            value={plantillaActual.id || ''}
            onChange={(e) => {
              const p = plantillasCRM.find(item => item.id === e.target.value)
              if (p) setPlantillaActual(p)
            }}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500"
          >
            {plantillasCRM.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.categoria})
              </option>
            ))}
            <option value="">-- Nueva Plantilla / Personalizada --</option>
          </select>
        </div>

        <div>
          <label className="font-bold text-[var(--foreground)] block mb-1">
            Vincular con Plantilla Nativa Geclisa:
          </label>
          <select
            value={plantillaActual.geclisa_pim_id || ''}
            onChange={(e) => handleImportarDeGeclisa(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Seleccionar de Geclisa (107 disponibles) --</option>
            {plantillasGeclisa.map((pg) => (
              <option key={pg.pimId} value={pg.pimId}>
                #{pg.pimId} - {pg.pimNombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-bold text-[var(--foreground)] block mb-1">
            Fase Quirúrgica:
          </label>
          <select
            value={plantillaActual.tipo_fase}
            onChange={(e) => setPlantillaActual({ ...plantillaActual, tipo_fase: e.target.value as any })}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500"
          >
            <option value="postquirurgico">Postquirúrgico (Gotas, Reposo y Cuidados)</option>
            <option value="prequirurgico">Prequirúrgico (Ayuno y Preparación)</option>
            <option value="ambos">Integral (Pre + Post)</option>
          </select>
        </div>
      </div>

      {/* Cuerpo principal: Editor o Preview */}
      {vistaActiva === 'preview' && pdfPreviewUrl ? (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-[var(--secondary)]">
            <span className="font-medium">
              Previsualización en tiempo real generada con el motor PDF de Centro Visión.
            </span>
            <a
              href={pdfPreviewUrl}
              download="indicaciones_medicas_preview.pdf"
              className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-bold"
            >
              <Download size={14} />
              <span>Descargar PDF</span>
            </a>
          </div>
          <div className="w-full h-[650px] rounded-xl overflow-hidden border border-[var(--border-color)] bg-slate-900/5">
            <iframe src={pdfPreviewUrl} className="w-full h-full border-0" title="Vista Previa de Indicaciones Médicas" />
          </div>
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel Izquierdo: Configuración Visual y Branding (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] space-y-4">
              <h3 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider flex items-center gap-2">
                <Palette size={16} className="text-blue-600" />
                <span>Estilo Visual & Identidad</span>
              </h3>

              {/* Selector de Color Primario */}
              <div>
                <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1.5">
                  Color Primario del Documento:
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {PALETA_COLORES.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.nombre}
                      onClick={() =>
                        setPlantillaActual({
                          ...plantillaActual,
                          config_diseno: { ...plantillaActual.config_diseno, color_primario: c.hex }
                        })
                      }
                      style={{ backgroundColor: c.hex }}
                      className={`h-7 rounded-lg transition-transform ${
                        plantillaActual.config_diseno.color_primario === c.hex
                          ? 'scale-110 ring-2 ring-offset-2 ring-blue-500'
                          : 'hover:scale-105 opacity-80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Título del documento */}
              <div>
                <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                  Título en Cabecera:
                </label>
                <input
                  type="text"
                  value={plantillaActual.config_diseno.titulo_documento}
                  onChange={(e) =>
                    setPlantillaActual({
                      ...plantillaActual,
                      config_diseno: { ...plantillaActual.config_diseno, titulo_documento: e.target.value }
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--foreground)]"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-color)] text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={plantillaActual.config_diseno.mostrar_logo}
                    onChange={(e) =>
                      setPlantillaActual({
                        ...plantillaActual,
                        config_diseno: { ...plantillaActual.config_diseno, mostrar_logo: e.target.checked }
                      })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Mostrar Logo Institucional Centro Visión</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={plantillaActual.config_diseno.mostrar_firma}
                    onChange={(e) =>
                      setPlantillaActual({
                        ...plantillaActual,
                        config_diseno: { ...plantillaActual.config_diseno, mostrar_firma: e.target.checked }
                      })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Firma y Sello Digital del Cirujano</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={plantillaActual.config_diseno.mostrar_qr}
                    onChange={(e) =>
                      setPlantillaActual({
                        ...plantillaActual,
                        config_diseno: { ...plantillaActual.config_diseno, mostrar_qr: e.target.checked }
                      })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Código de Autenticidad / Trazabilidad</span>
                </label>
              </div>

              {/* Pie de página */}
              <div>
                <label className="text-[11px] font-bold text-[var(--secondary)] block mb-1">
                  Leyenda al Pie:
                </label>
                <input
                  type="text"
                  value={plantillaActual.config_diseno.pie_pagina}
                  onChange={(e) =>
                    setPlantillaActual({
                      ...plantillaActual,
                      config_diseno: { ...plantillaActual.config_diseno, pie_pagina: e.target.value }
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--foreground)]"
                />
              </div>
            </div>
          </div>

          {/* Panel Derecho: Contenidos Clínicos y Tabla de Medicación (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Título de Plantilla y Categoría */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                  Nombre de la Plantilla:
                </label>
                <input
                  type="text"
                  value={plantillaActual.titulo}
                  onChange={(e) => setPlantillaActual({ ...plantillaActual, titulo: e.target.value })}
                  placeholder="Ej: Facoemulsificación Cataratas - Protocolo Dr. Bonanno"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--foreground)] font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                  Categoría Clínica:
                </label>
                <input
                  type="text"
                  value={plantillaActual.categoria}
                  onChange={(e) => setPlantillaActual({ ...plantillaActual, categoria: e.target.value })}
                  placeholder="Ej: Cataratas, Refractiva, Glaucoma"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--foreground)]"
                />
              </div>
            </div>

            {/* Texto de la Indicación Médica */}
            <div>
              <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                Cuerpo de Indicaciones (Texto que se asienta en Geclisa):
              </label>
              <textarea
                rows={4}
                value={plantillaActual.cuerpo_indicaciones}
                onChange={(e) => setPlantillaActual({ ...plantillaActual, cuerpo_indicaciones: e.target.value })}
                placeholder="Instrucciones postoperatorias, frecuencia de gotas..."
                className="w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--foreground)] font-mono leading-relaxed"
              />
              <p className="text-[10px] text-[var(--secondary)] mt-1">
                Soporta tags dinámicas: <code className="bg-[var(--hover-bg)] px-1 rounded">&#123;&#123;paciente&#125;&#125;</code>, <code className="bg-[var(--hover-bg)] px-1 rounded">&#123;&#123;ojo&#125;&#125;</code>, <code className="bg-[var(--hover-bg)] px-1 rounded">&#123;&#123;cirujano&#125;&#125;</code>, <code className="bg-[var(--hover-bg)] px-1 rounded">&#123;&#123;fecha&#125;&#125;</code>.
              </p>
            </div>

            {/* Tabla Estructurada de Medicación / Gotas */}
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)]/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Pill size={16} className="text-emerald-600" />
                  <h4 className="text-xs font-bold text-[var(--foreground)]">
                    Esquema de Medicación y Gotas Oftálmicas
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleAgregarMedicamento}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <Plus size={13} />
                  <span>Añadir Fármaco / Gota</span>
                </button>
              </div>

              {plantillaActual.medicamentos.length === 0 ? (
                <p className="text-xs text-[var(--secondary)] py-3 text-center italic">
                  No hay fármacos estructurados. Haz clic en "Añadir Fármaco" para agregar colirios con sus intervalos.
                </p>
              ) : (
                <div className="space-y-2 overflow-x-auto">
                  {plantillaActual.medicamentos.map((m, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-[var(--card-bg)] p-2 rounded-lg border border-[var(--border-color)] text-xs"
                    >
                      <input
                        type="text"
                        value={m.droga}
                        onChange={(e) => handleUpdateMed(idx, 'droga', e.target.value)}
                        placeholder="Droga / Gotas (ej: Gatimicin D)"
                        className="col-span-4 px-2 py-1 rounded border border-[var(--border-color)] bg-transparent text-[var(--foreground)] font-semibold"
                      />
                      <input
                        type="text"
                        value={m.dosis}
                        onChange={(e) => handleUpdateMed(idx, 'dosis', e.target.value)}
                        placeholder="Dosis (1 gota)"
                        className="col-span-2 px-2 py-1 rounded border border-[var(--border-color)] bg-transparent text-[var(--foreground)]"
                      />
                      <input
                        type="text"
                        value={m.frecuencia}
                        onChange={(e) => handleUpdateMed(idx, 'frecuencia', e.target.value)}
                        placeholder="Frecuencia (c/ 4 hs)"
                        className="col-span-2 px-2 py-1 rounded border border-[var(--border-color)] bg-transparent text-[var(--foreground)]"
                      />
                      <input
                        type="text"
                        value={m.duracion}
                        onChange={(e) => handleUpdateMed(idx, 'duracion', e.target.value)}
                        placeholder="Duración (7 días)"
                        className="col-span-2 px-2 py-1 rounded border border-[var(--border-color)] bg-transparent text-[var(--foreground)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuitarMedicamento(idx)}
                        className="col-span-2 p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded flex items-center justify-center transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cuidados Generales y Reposo */}
            <div>
              <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                Cuidados Generales y Reposo Postoperatorio:
              </label>
              <textarea
                rows={3}
                value={plantillaActual.cuidados_generales}
                onChange={(e) => setPlantillaActual({ ...plantillaActual, cuidados_generales: e.target.value })}
                placeholder="Pautas de higiene, protector ocular, actividades restringidas..."
                className="w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--foreground)]"
              />
            </div>

            {/* Pautas de Alarma */}
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <ShieldAlert size={16} />
                <label className="text-xs font-bold">
                  Pautas de Alarma & Urgencias (Recuadro Destacado en PDF):
                </label>
              </div>
              <textarea
                rows={2}
                value={plantillaActual.pautas_alarma}
                onChange={(e) => setPlantillaActual({ ...plantillaActual, pautas_alarma: e.target.value })}
                placeholder="Síntomas que exigen consulta inmediata de guardia..."
                className="w-full p-2.5 rounded-lg border border-rose-500/30 bg-[var(--card-bg)] text-xs text-rose-700 dark:text-rose-300 font-medium"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
