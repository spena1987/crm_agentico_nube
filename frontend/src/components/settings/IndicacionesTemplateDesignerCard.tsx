'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText,
  Palette,
  Save,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  History,
  Sparkles,
  Building2,
  Layers,
  Edit2,
  Send,
  X,
  Stethoscope
} from 'lucide-react'
import { BACKEND_URL as API_BASE_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

interface LienzoIndicacionesConfig {
  titulo_documento: string
  nombre_institucion: string
  subtitulo_institucion: string
  direccion: string
  telefono: string
  email: string
  sitio_web: string
  color_primario: string
  color_secundario: string
  tamano_hoja: 'letter' | 'a4'
  pie_pagina: string
  mostrar_logo: boolean
  mostrar_firma: boolean
  mostrar_qr: boolean
  logo_url?: string
}

const PALETA_COLORES = [
  { nombre: 'Azul Quirúrgico', hex: '#0369A1' },
  { nombre: 'Azul Nube', hex: '#1E3A8A' },
  { nombre: 'Azul Real', hex: '#2563EB' },
  { nombre: 'Turquesa Oftalmo', hex: '#0D9488' },
  { nombre: 'Verde Clínico', hex: '#15803D' },
  { nombre: 'Índigo Médico', hex: '#4338CA' },
  { nombre: 'Gris Grafito', hex: '#334155' }
]

const DEFAULT_LIENZO: LienzoIndicacionesConfig = {
  titulo_documento: 'ORDEN MÉDICA DE PROCEDIMIENTO',
  nombre_institucion: 'CENTRO VISIÓN',
  subtitulo_institucion: 'Especialidades Oftalmológicas y Cirugía de Alta Complejidad',
  direccion: 'Mitre 540, Ciudad de Mendoza, Mendoza',
  telefono: '0800-222-4040',
  email: 'info@centrovision.com.ar',
  sitio_web: 'www.centrovision.com.ar',
  color_primario: '#0369A1',
  color_secundario: '#0284C7',
  tamano_hoja: 'letter',
  pie_pagina: 'Documento médico oficial emitido electrónicamente por Centro Visión.',
  mostrar_logo: true,
  mostrar_firma: true,
  mostrar_qr: true,
  logo_url: ''
}

export default function IndicacionesTemplateDesignerCard() {
  const [config, setConfig] = useState<LienzoIndicacionesConfig>(DEFAULT_LIENZO)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [tipoMuestra, setTipoMuestra] = useState<'oct' | 'gotas'>('oct')

  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [tabPrincipal, setTabPrincipal] = useState<'disenador' | 'historial'>('disenador')
  const [vistaActiva, setVistaActiva] = useState<'editor' | 'preview'>('editor')

  // Historial de emisiones
  const [emisiones, setEmisiones] = useState<any[]>([])
  const [cargandoEmisiones, setCargandoEmisiones] = useState(false)
  const [modalReedicionOpen, setModalReedicionOpen] = useState(false)
  const [emisionParaReeditar, setEmisionParaReeditar] = useState<any | null>(null)
  const [textoReedicion, setTextoReedicion] = useState('')
  const [reenviarWaReedicion, setReenviarWaReedicion] = useState(true)
  const [guardandoReedicion, setGuardandoReedicion] = useState(false)

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  const cargarConfiguracion = async () => {
    try {
      setLoading(true)
      let data: any = null
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings`)
        if (res.ok) {
          data = await res.json()
        }
      } catch (e) {
        console.warn('Error consultando /api/settings, fallback a Supabase:', e)
      }

      if (!data) {
        const { data: dbData } = await (supabase as any)
          .from('configuracion_sistema')
          .select('valor')
          .eq('clave', 'ajustes_crm')
          .maybeSingle()
        if (dbData && dbData.valor) {
          data = dbData.valor
        }
      }

      if (data) {
        const lienzo = data.lienzo_indicaciones || {}
        const clinica = data.clinica || {}
        setConfig({
          ...DEFAULT_LIENZO,
          ...lienzo,
          nombre_institucion: lienzo.nombre_institucion || clinica.nombre || DEFAULT_LIENZO.nombre_institucion,
          logo_url: lienzo.logo_url || clinica.logo_url || ''
        })
      }
    } catch (err) {
      console.error('Error al cargar configuración del lienzo de indicaciones:', err)
    } finally {
      setLoading(false)
    }
  }

  const cargarEmisiones = async () => {
    setCargandoEmisiones(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/emisiones?limit=100`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setEmisiones(data.emisiones || [])
        }
      }
    } catch (e) {
      console.error('Error cargando emisiones:', e)
    } finally {
      setCargandoEmisiones(false)
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setSaving(true)
      setFeedback(null)

      let apiSaved = false
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lienzo_indicaciones: config
          })
        })
        if (res.ok) apiSaved = true
      } catch (apiErr) {
        console.warn('API /api/settings no respondió, guardando en Supabase:', apiErr)
      }

      const { data: currentDb } = await (supabase as any)
        .from('configuracion_sistema')
        .select('valor')
        .eq('clave', 'ajustes_crm')
        .maybeSingle()

      const currentVal = currentDb && currentDb.valor ? (currentDb.valor as any) : {}
      const newVal = {
        ...currentVal,
        lienzo_indicaciones: {
          ...(currentVal.lienzo_indicaciones || {}),
          ...config
        }
      }

      const { error: dbError } = await (supabase as any)
        .from('configuracion_sistema')
        .upsert({
          clave: 'ajustes_crm',
          valor: newVal,
          updated_at: new Date().toISOString(),
          actualizado_por: 'admin_crm'
        })

      if (apiSaved || !dbError) {
        setFeedback({ tipo: 'success', texto: '¡Lienzo maestro de indicaciones guardado exitosamente!' })
      } else {
        setFeedback({ tipo: 'error', texto: 'Error al guardar la configuración del lienzo.' })
      }
    } catch (err) {
      console.error('Error guardando lienzo:', err)
      setFeedback({ tipo: 'error', texto: 'Error al conectar con el servidor.' })
    } finally {
      setSaving(false)
    }
  }

  // Previsualizar PDF usando el lienzo maestro actual
  const handleGenerarPreviewPdf = async (modo: 'oct' | 'gotas' = tipoMuestra) => {
    setGenerandoPdf(true)
    try {
      const datosMuestraOCT = {
        paciente_nombre: 'PEÑA, JUAN SEBASTIAN',
        paciente_dni: '033516799',
        paciente_obra_social: 'SWISS MEDICAL S.A.',
        paciente_afiliado: '8000061154099011000',
        paciente_domicilio: 'LAS CAÑAS 800 GUAYMALLEN',
        medico_nombre: 'GRAS, HERNAN',
        medico_matricula: '5432',
        cuerpo_indicaciones: 'Solicito:\n\nOCT Digital Bilateral\n\nDiagnóstico:\nDegeneración Macular',
        medicamentos: [],
        cuidados_generales: '',
        pautas_alarma: ''
      }

      const datosMuestraGotas = {
        paciente_nombre: 'PEÑA, JUAN SEBASTIAN',
        paciente_dni: '033516799',
        paciente_obra_social: 'SWISS MEDICAL S.A.',
        paciente_afiliado: '8000061154099011000',
        paciente_domicilio: 'LAS CAÑAS 800 GUAYMALLEN',
        medico_nombre: 'GRAS, HERNAN',
        medico_matricula: '5432',
        cuerpo_indicaciones: 'Indicaciones médicas postoperatorias de Facoemulsificación con Implante de LIO Premium.',
        medicamentos: [
          { droga: 'Gatimicin D (Antibiótico + Corticoide)', dosis: '1 gota', frecuencia: 'Cada 4 horas', duracion: '7 días', instrucciones: 'Agitar antes de colocar' },
          { droga: 'Berlofen (Ketorolac)', dosis: '1 gota', frecuencia: 'Cada 4 horas', duracion: '7 días', instrucciones: 'Esperar 10 min respecto a la gota anterior' }
        ],
        cuidados_generales: '- No refregar ni frotar el ojo operado.\n- Usar protector ocular transparente para dormir por 7 noches.\n- Evitar esfuerzos físicos pesados por 15 días.',
        pautas_alarma: 'Consulte de forma INMEDIATA a la guardia ante: dolor ocular agudo o disminución brusca de visión.'
      }

      const payload = {
        datos_emision: modo === 'oct' ? datosMuestraOCT : datosMuestraGotas,
        config_diseno: config
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
        setFeedback({ tipo: 'error', texto: 'Error generando la vista previa del PDF.' })
      }
    } catch (e: any) {
      console.error(e)
      setFeedback({ tipo: 'error', texto: 'Fallo al conectar con el motor de generación PDF.' })
    } finally {
      setGenerandoPdf(false)
    }
  }

  const handleAbrirReedicion = (emision: any) => {
    setEmisionParaReeditar(emision)
    setTextoReedicion(emision.texto_indicaciones || '')
    setReenviarWaReedicion(true)
    setModalReedicionOpen(true)
  }

  const handleGuardarReedicion = async () => {
    if (!emisionParaReeditar) return
    setGuardandoReedicion(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/indicaciones/emisiones/${emisionParaReeditar.id}/reeditar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto_indicaciones: textoReedicion,
          reenviar_whatsapp: reenviarWaReedicion
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({ tipo: 'success', texto: 'Indicación médica actualizada exitosamente y nuevo PDF generado.' })
        setModalReedicionOpen(false)
        cargarEmisiones()
      } else {
        setFeedback({ tipo: 'error', texto: data.detail || data.error || 'No se pudo actualizar la indicación.' })
      }
    } catch (err: any) {
      setFeedback({ tipo: 'error', texto: 'Error de conexión al reeditar la indicación.' })
    } finally {
      setGuardandoReedicion(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin text-blue-600" />
        <span>Cargando configuración del lienzo de indicaciones...</span>
      </div>
    )
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
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Lienzo Maestro de Indicaciones Médicas (Canva Único)
              </h2>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Define el membrete, logo, tamaño de hoja y pie de página general donde se incrustan las indicaciones de cada práctica.
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setTabPrincipal('disenador')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tabPrincipal === 'disenador'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Palette size={14} /> Lienzo & Canva PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setTabPrincipal('historial')
              cargarEmisiones()
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              tabPrincipal === 'historial'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <History size={14} /> Historial & Auditoría
          </button>
        </div>

        {/* Acciones principales en modo diseñador */}
        {tabPrincipal === 'disenador' && (
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
              onClick={() => handleGenerarPreviewPdf(tipoMuestra)}
              disabled={generandoPdf}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {generandoPdf ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              <span>Generar Muestra</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Guardar Lienzo</span>
            </button>
          </div>
        )}
      </div>

      {/* Alertas */}
      {feedback && (
        <div
          className={`mx-6 mt-4 p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.tipo === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          {feedback.tipo === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.texto}</span>
        </div>
      )}

      {/* Contenido Principal */}
      {tabPrincipal === 'disenador' ? (
        <div className="p-6">
          {/* Banner explicativo del Lienzo */}
          <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-3">
            <span className="p-1.5 rounded-lg bg-blue-600 text-white mt-0.5">
              <Layers size={16} />
            </span>
            <div className="text-xs">
              <h4 className="font-bold text-blue-900 dark:text-blue-300">
                Arquitectura de Canvas Institucional (1 Lienzo para Muchas Indicaciones)
              </h4>
              <p className="text-slate-600 dark:text-slate-300 mt-1">
                Este lienzo define la identidad visual común de las órdenes médicas y recetas. La redacción clínica específica (textos, fármacos, pautas de alarma) se administra de forma modular en <b>Ajustes &gt; Nomencladores &gt; Indicaciones Médicas</b>.
              </p>
            </div>
          </div>

          {vistaActiva === 'preview' && pdfPreviewUrl ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-300">Tipo de Muestra:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMuestra('oct')
                      handleGenerarPreviewPdf('oct')
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                      tipoMuestra === 'oct' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Muestra OCT / Solicitud (Solo Cuerpo)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMuestra('gotas')
                      handleGenerarPreviewPdf('gotas')
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                      tipoMuestra === 'gotas' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Muestra Cataratas (Con Gotas y Cuidados)
                  </button>
                </div>

                <a
                  href={pdfPreviewUrl}
                  download="muestra_indicaciones.pdf"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download size={13} />
                  <span>Descargar PDF</span>
                </a>
              </div>

              <div className="w-full h-[750px] rounded-xl overflow-hidden border border-[var(--border-color)] bg-slate-900">
                <iframe src={pdfPreviewUrl} className="w-full h-full" title="Vista Previa PDF" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda: Encabezado y Marca */}
              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                    <Building2 size={16} /> Encabezado Institucional
                  </h3>

                  <div>
                    <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                      Título General del Documento:
                    </label>
                    <input
                      type="text"
                      value={config.titulo_documento}
                      onChange={(e) => setConfig({ ...config, titulo_documento: e.target.value })}
                      placeholder="ORDEN MÉDICA DE PROCEDIMIENTO"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)]/30 text-xs text-[var(--foreground)] font-semibold focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-[var(--secondary)] mt-1">
                      Aparece en la cabecera superior derecha del PDF.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                      Nombre de la Institución:
                    </label>
                    <input
                      type="text"
                      value={config.nombre_institucion}
                      onChange={(e) => setConfig({ ...config, nombre_institucion: e.target.value })}
                      placeholder="CENTRO VISIÓN"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)]/30 text-xs text-[var(--foreground)] focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                      Subtítulo o Especialidades:
                    </label>
                    <input
                      type="text"
                      value={config.subtitulo_institucion}
                      onChange={(e) => setConfig({ ...config, subtitulo_institucion: e.target.value })}
                      placeholder="Especialidades Oftalmológicas y Cirugía de Alta Complejidad"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)]/30 text-xs text-[var(--foreground)] focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[var(--border-color)]">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      Mostrar Logo Institucional en Cabecera
                    </span>
                    <input
                      type="checkbox"
                      checked={config.mostrar_logo}
                      onChange={(e) => setConfig({ ...config, mostrar_logo: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Formato de Hoja y Tamaño */}
                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                    <FileText size={16} /> Formato y Tamaño de Hoja
                  </h3>

                  <div>
                    <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                      Tamaño de Página:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, tamano_hoja: 'letter' })}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                          config.tamano_hoja === 'letter'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'border-[var(--border-color)] text-[var(--secondary)] hover:bg-[var(--hover-bg)]'
                        }`}
                      >
                        Carta (Letter - 21.6 x 27.9 cm)
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, tamano_hoja: 'a4' })}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                          config.tamano_hoja === 'a4'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'border-[var(--border-color)] text-[var(--secondary)] hover:bg-[var(--hover-bg)]'
                        }`}
                      >
                        A4 (21.0 x 29.7 cm)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Paleta de Colores y Pie de Página */}
              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                    <Palette size={16} /> Paleta de Identidad Médica
                  </h3>

                  <div>
                    <label className="text-xs font-bold text-[var(--foreground)] block mb-2">
                      Color Primario (Títulos, Tablas y Líneas Divisorias):
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {PALETA_COLORES.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setConfig({ ...config, color_primario: c.hex })}
                          className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] font-semibold transition ${
                            config.color_primario === c.hex
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 font-bold'
                              : 'border-[var(--border-color)] hover:bg-[var(--hover-bg)]'
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                          <span className="truncate">{c.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pie de Página y Firma */}
                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                    <Stethoscope size={16} /> Pie de Página y Validación Legal
                  </h3>

                  <div>
                    <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                      Texto Legal al Pie:
                    </label>
                    <textarea
                      rows={2}
                      value={config.pie_pagina}
                      onChange={(e) => setConfig({ ...config, pie_pagina: e.target.value })}
                      placeholder="Documento médico oficial emitido electrónicamente por Centro Visión."
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)]/30 text-xs text-[var(--foreground)] focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[var(--border-color)]">
                    <div>
                      <span className="text-xs font-medium text-[var(--foreground)] block">
                        Mostrar Firma y Sello del Cirujano al Pie
                      </span>
                      <span className="text-[10px] text-[var(--secondary)]">
                        Imprime el nombre y matrícula profesional del médico al pie del documento.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.mostrar_firma}
                      onChange={(e) => setConfig({ ...config, mostrar_firma: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Pestaña: Historial de Emisiones & Reedición */
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)]">
                Registro de Emisiones de Indicaciones Médicas
              </h3>
              <p className="text-xs text-[var(--secondary)]">
                Historial de documentos generados, estados de entrega por WhatsApp y reedición clínica.
              </p>
            </div>
            <button
              type="button"
              onClick={cargarEmisiones}
              disabled={cargandoEmisiones}
              className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs font-semibold hover:bg-[var(--hover-bg)] transition flex items-center gap-1.5"
            >
              {cargandoEmisiones ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
              <span>Actualizar Historial</span>
            </button>
          </div>

          {cargandoEmisiones ? (
            <div className="p-8 text-center text-xs text-[var(--secondary)] flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span>Cargando auditoría de emisiones...</span>
            </div>
          ) : emisiones.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--secondary)] border border-dashed border-[var(--border-color)] rounded-xl">
              No hay emisiones registradas en el sistema.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--hover-bg)] text-[var(--secondary)] uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Médico</th>
                    <th className="p-3">Práctica</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {emisiones.map((em) => (
                    <tr key={em.id} className="hover:bg-[var(--hover-bg)]/40 transition">
                      <td className="p-3 text-[var(--secondary)] whitespace-nowrap">
                        {em.created_at ? new Date(em.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-3 font-semibold text-[var(--foreground)]">
                        {em.pacientes?.nombre || 'Paciente'}
                      </td>
                      <td className="p-3 text-[var(--secondary)]">{em.medico_nombre || '-'}</td>
                      <td className="p-3 text-[var(--foreground)] max-w-xs truncate">{em.practica_nombre || '-'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            em.whatsapp_status === 'enviado'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                              : em.whatsapp_status === 'fallido'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                          }`}
                        >
                          {em.whatsapp_status || 'pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        {em.pdf_url && (
                          <a
                            href={em.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                          >
                            <Download size={12} /> PDF
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAbrirReedicion(em)}
                          className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 font-semibold"
                        >
                          <Edit2 size={12} /> Reeditar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Reedición de Emisión */}
      {modalReedicionOpen && emisionParaReeditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[var(--foreground)]">
                  Reeditar Indicación Médica Emitida
                </h3>
                <p className="text-[11px] text-[var(--secondary)]">
                  {emisionParaReeditar.pacientes?.nombre} • {emisionParaReeditar.practica_nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalReedicionOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--foreground)] block mb-1">
                Texto de Indicaciones Médicas:
              </label>
              <textarea
                rows={6}
                value={textoReedicion}
                onChange={(e) => setTextoReedicion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-xs text-[var(--foreground)] font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--hover-bg)]/50 border border-[var(--border-color)]">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                Reenviar PDF actualizado por WhatsApp al paciente
              </span>
              <input
                type="checkbox"
                checked={reenviarWaReedicion}
                onChange={(e) => setReenviarWaReedicion(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setModalReedicionOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[var(--hover-bg)] text-[var(--secondary)] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarReedicion}
                disabled={guardandoReedicion}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                {guardandoReedicion ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Guardar y Reemitir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
