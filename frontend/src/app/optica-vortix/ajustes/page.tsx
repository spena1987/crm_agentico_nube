'use client'

import React, { useState, useEffect } from 'react'
import {
  Settings,
  Building2,
  Stethoscope,
  ShieldCheck,
  Clock,
  Sparkles,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Lock,
  Plus,
  X,
  PhoneCall,
  CheckSquare,
  Square
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import { apiFetch } from '@/lib/api'
import { OpticaConfig, OpticaSaludLinea } from '@/types/optica'

// Catálogo oficial de las 4 ubicaciones reales en Geclisa
const UBICACIONES_GECLISA_OFICIALES = [
  {
    id: '3',
    nombre: 'Mitre 540 - Ciudad de Mendoza',
    etiqueta: 'Sede Central (Planta Baja Óptica Vortix)',
    esCentral: true,
    consultorios: 'Consultorios Mendoza'
  },
  {
    id: '6',
    nombre: 'Mitre 538 3er Piso Dpto 4 - Ciudad de Mendoza',
    etiqueta: 'Sede Mitre 538 (Estudios Técnicos)',
    esCentral: false,
    consultorios: 'OCT, Campo Visual, Biometría, Pentacam'
  },
  {
    id: '4',
    nombre: 'Roca 71 - Luján de Cuyo',
    etiqueta: 'Sede Luján de Cuyo (Calle Roca)',
    esCentral: false,
    consultorios: 'Consultorios Roca Luján'
  },
  {
    id: '7',
    nombre: 'Boedo 2879 Oficina Q (portero 18) - Lujan de Cuyo',
    etiqueta: 'Sede Luján de Cuyo (Calle Boedo)',
    esCentral: false,
    consultorios: 'Consultorios Boedo Luján'
  }
]

// Catálogo oficial de servicios en Geclisa (/api/Turnos/asistente/servicios)
const SERVICIOS_GECLISA_OFICIALES = [
  {
    id: '123',
    nombre: 'CONSULTAS',
    descripcion: 'Consultas oftalmológicas generales y pediátricas (Principal fuente de recetas de anteojos)',
    aptoRecomendado: true,
    bloqueado: false
  },
  {
    id: '124',
    nombre: 'ESTUDIOS VARIOS',
    descripcion: 'Estudios diagnósticos técnicos (OCT, Campimetría, Topografía, Paquimetría)',
    aptoRecomendado: false,
    bloqueado: false
  },
  {
    id: '122',
    nombre: 'ASESORAMIENTO',
    descripcion: 'Orientación clínica previa y asesoramiento al paciente',
    aptoRecomendado: true,
    bloqueado: false
  },
  {
    id: '134',
    nombre: 'INVESTIGACION',
    descripcion: 'Protocolos de investigación y ensayos clínicos',
    aptoRecomendado: false,
    bloqueado: false
  },
  {
    id: '127',
    nombre: 'ESPECIALES',
    descripcion: 'Prácticas y procedimientos ambulatorios especiales',
    aptoRecomendado: false,
    bloqueado: false
  },
  {
    id: '128',
    nombre: 'ESTETICA',
    descripcion: 'Procedimientos y consultas perioculares estéticas',
    aptoRecomendado: false,
    bloqueado: false
  },
  {
    id: '125',
    nombre: 'CIRUGIA',
    descripcion: 'Quirófano / Cirugías (Faco, Catarata, Pterigión, LIO)',
    aptoRecomendado: false,
    bloqueado: true
  },
  {
    id: '126',
    nombre: 'ANESTESISTAS',
    descripcion: 'Servicio anestesiológico de quirófano',
    aptoRecomendado: false,
    bloqueado: true
  }
]

const DEFAULT_CONFIG_LOCAL: OpticaConfig = {
  waba_id: '3731563350343089',
  phone_number_id: '',
  display_phone_number: '',
  verified_name: 'Óptica Vortix',
  auto_turnos_activo: true,
  auto_turnos_dias_anticipacion: 1,
  auto_turnos_hora_envio: '10:00',
  auto_turnos_descuento_pct: 20,
  auto_turnos_placa_url: '',
  auto_turnos_template_name: 'vortix_beneficio_turno_v1',
  auto_turnos_excluir_quirurgicos: true,
  auto_turnos_servicios_excluidos: ['CIRUGIA', 'QUIROFANO', 'ANESTESIA', 'POSOPERATORIO', 'POSTOPERATORIO'],
  auto_recetas_modo: 'ASISTIDO',
  auto_recetas_delay_minutos: 45,
  auto_recetas_template_aereos: 'vortix_receta_lentes_aereos_v1',
  auto_recetas_template_contacto: 'vortix_receta_lentes_contacto_v1',
  auto_recetas_keywords_aereos: ['receta de lentes', 'lentes aéreos', 'anteojos', 'multifocal', 'monofocal', 'armazón'],
  auto_recetas_keywords_contacto: ['lentes de contacto', 'blandos tóricos', 'adaptación lc'],
  auto_recetas_exclusiones_lio: ['lio', 'lente intraocular', 'facoe', 'catarata quirúrgica'],
  antibloqueo_cooldown_dias: 30,
  antibloqueo_jitter_min_seg: 35,
  antibloqueo_jitter_max_seg: 90,
  antibloqueo_ventana_horaria_inicio: '09:00',
  antibloqueo_ventana_horaria_fin: '20:00',
  antibloqueo_pausa_calidad_amarilla: true,
  telefonos_whitelist_prueba: [
    '5492614703230',
    '2614703230'
  ],
  sedes_habilitadas_campana: [
    'Mitre 540 - Ciudad de Mendoza',
    'Mitre 538 3er Piso Dpto 4 - Ciudad de Mendoza'
  ],
  servicios_habilitados_campana: [
    'CONSULTAS',
    'ASESORAMIENTO'
  ]
}

export default function OpticaAjustesPage() {
  const [config, setConfig] = useState<OpticaConfig>(DEFAULT_CONFIG_LOCAL)
  const [salud, setSalud] = useState<OpticaSaludLinea | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [newKeyword, setNewKeyword] = useState('')

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        const [resC, resS] = await Promise.all([
          apiFetch('/api/optica-vortix/config', { cache: 'no-store' }).catch(() => null),
          apiFetch('/api/optica-vortix/salud-linea', { cache: 'no-store' }).catch(() => null)
        ])
        if (resC?.ok) {
          const dc = await resC.json()
          const loadedCfg = dc.config || dc
          setConfig({
            ...DEFAULT_CONFIG_LOCAL,
            ...loadedCfg,
            sedes_habilitadas_campana: Array.isArray(loadedCfg.sedes_habilitadas_campana) && loadedCfg.sedes_habilitadas_campana.length > 0
              ? loadedCfg.sedes_habilitadas_campana
              : DEFAULT_CONFIG_LOCAL.sedes_habilitadas_campana,
            servicios_habilitados_campana: Array.isArray(loadedCfg.servicios_habilitados_campana) && loadedCfg.servicios_habilitados_campana.length > 0
              ? loadedCfg.servicios_habilitados_campana
              : DEFAULT_CONFIG_LOCAL.servicios_habilitados_campana
          })
        }
        if (resS?.ok) {
          setSalud(await resS.json())
        }
      } catch (e) {
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await apiFetch('/api/optica-vortix/config', {
        method: 'PUT',
        body: JSON.stringify(config)
      })
      if (res.ok) {
        setFeedback({
          type: 'ok',
          text: 'Ajustes de Óptica Vortix guardados correctamente y sincronizados con el Escudo Anti-Bloqueo.'
        })
      } else {
        const err = await res.json().catch(() => null)
        setFeedback({
          type: 'err',
          text: err?.detail || 'Error al guardar la configuración en Supabase.'
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Error de conexión con el servidor.'
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleSede = (nombreSede: string) => {
    const sedesActuales = config.sedes_habilitadas_campana || []
    if (sedesActuales.includes(nombreSede)) {
      setConfig({
        ...config,
        sedes_habilitadas_campana: sedesActuales.filter((s) => s !== nombreSede)
      })
    } else {
      setConfig({
        ...config,
        sedes_habilitadas_campana: [...sedesActuales, nombreSede]
      })
    }
  }

  const toggleServicio = (nombreServicio: string) => {
    const srvActuales = config.servicios_habilitados_campana || []
    if (srvActuales.includes(nombreServicio)) {
      setConfig({
        ...config,
        servicios_habilitados_campana: srvActuales.filter((s) => s !== nombreServicio)
      })
    } else {
      setConfig({
        ...config,
        servicios_habilitados_campana: [...srvActuales, nombreServicio]
      })
    }
  }

  const handleAddKeyword = () => {
    const kw = newKeyword.trim().toUpperCase()
    if (!kw) return
    const lista = config.auto_turnos_servicios_excluidos || []
    if (!lista.includes(kw)) {
      setConfig({
        ...config,
        auto_turnos_servicios_excluidos: [...lista, kw]
      })
    }
    setNewKeyword('')
  }

  const handleRemoveKeyword = (kwToRemove: string) => {
    setConfig({
      ...config,
      auto_turnos_servicios_excluidos: (config.auto_turnos_servicios_excluidos || []).filter(
        (k) => k !== kwToRemove
      )
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <OpticaSubNavHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16">
      <OpticaSubNavHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full space-y-6">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  Ajustes de Óptica Vortix
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                    Módulo Autónomo
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Configuración independiente de sedes, servicios clínicos de Geclisa y parámetros del escudo anti-bloqueo.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Ajustes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notificación de Feedback */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm">{feedback.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECCIÓN 1: SEDES Y UBICACIONES OFICIALES GECLISA */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-base font-semibold text-white">Ubicaciones Oficiales Geclisa</h2>
                  <p className="text-xs text-slate-400">
                    Sedes donde se programan turnos. Activa cuáles aplican por defecto a las campañas de Óptica.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {UBICACIONES_GECLISA_OFICIALES.map((sede) => {
                const activa = (config.sedes_habilitadas_campana || []).includes(sede.nombre)
                return (
                  <div
                    key={sede.id}
                    onClick={() => toggleSede(sede.nombre)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                      activa
                        ? 'bg-indigo-950/20 border-indigo-500/30 text-slate-100 hover:border-indigo-500/50'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="pt-0.5">
                      {activa ? (
                        <CheckSquare className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{sede.etiqueta}</span>
                        {sede.esCentral && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Local Físico PB
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{sede.nombre}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Consultorios: {sede.consultorios}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Datos validados directamente contra el endpoint <code>/api/Consultorios</code> de Geclisa.
            </p>
          </div>

          {/* SECCIÓN 2: SERVICIOS CLÍNICOS OFICIALES GECLISA */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Stethoscope className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-base font-semibold text-white">Servicios Clínicos Oficiales</h2>
                  <p className="text-xs text-slate-400">
                    Clasificación oficial de <code>/api/Turnos/asistente/servicios</code> de Geclisa.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {SERVICIOS_GECLISA_OFICIALES.map((srv) => {
                const activo = (config.servicios_habilitados_campana || []).includes(srv.nombre)
                if (srv.bloqueado) {
                  return (
                    <div
                      key={srv.id}
                      className="p-3 rounded-xl border border-rose-500/20 bg-rose-950/10 text-slate-400 flex items-start gap-3 opacity-75"
                    >
                      <Lock className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-rose-300 line-through">{srv.nombre}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                            Exclusión Quirúrgica Estricta
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{srv.descripcion}</p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={srv.id}
                    onClick={() => toggleServicio(srv.nombre)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      activo
                        ? 'bg-indigo-950/20 border-indigo-500/30 text-slate-100 hover:border-indigo-500/50'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="pt-0.5">
                      {activo ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{srv.nombre}</span>
                        {srv.aptoRecomendado && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Recomendado Óptica
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{srv.descripcion}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: PALABRAS CLAVE DE EXCLUSIÓN QUIRÚRGICA */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Palabras Clave de Exclusión Quirúrgica</h2>
              <p className="text-xs text-slate-400">
                Cualquier turno cuya práctica, servicio o médico contenga estos términos será descartado automáticamente del envío.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {(config.auto_turnos_servicios_excluidos || []).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(kw)}
                  className="hover:text-rose-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 max-w-md pt-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddKeyword()
                }
              }}
              placeholder="Ej: CATARATA, FACO, LIO..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir
            </button>
          </div>
        </div>

        {/* SECCIÓN 4: PARÁMETROS DEL ESCUDO ANTI-BLOQUEO & BENEFICIOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Escudo Anti-Spam</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Cooldown Mismo Paciente (Días)
                </label>
                <input
                  type="number"
                  min={7}
                  max={90}
                  value={config.antibloqueo_cooldown_dias}
                  onChange={(e) =>
                    setConfig({ ...config, antibloqueo_cooldown_dias: parseInt(e.target.value) || 30 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  No vuelve a contactar al paciente antes de este período.
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Cadencia Humana (Jitter Segundos)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={config.antibloqueo_jitter_min_seg}
                    onChange={(e) =>
                      setConfig({ ...config, antibloqueo_jitter_min_seg: parseInt(e.target.value) || 35 })
                    }
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                    placeholder="Mínimo (35s)"
                  />
                  <input
                    type="number"
                    min={30}
                    max={300}
                    value={config.antibloqueo_jitter_max_seg}
                    onChange={(e) =>
                      setConfig({ ...config, antibloqueo_jitter_max_seg: parseInt(e.target.value) || 90 })
                    }
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                    placeholder="Máximo (90s)"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Whitelist / Teléfonos de Prueba (Exentos de Cooldown)
                </label>
                <input
                  type="text"
                  value={(config.telefonos_whitelist_prueba || []).join(', ')}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      telefonos_whitelist_prueba: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="Ej: 5492614703230, 2614703230"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Separados por coma. Estos números pueden recibir campañas y pruebas ilimitadas sin restricción de 30 días.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Voucher por Defecto</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Descuento Ofrecido (%)
                </label>
                <input
                  type="number"
                  min={5}
                  max={70}
                  value={config.auto_turnos_descuento_pct}
                  onChange={(e) =>
                    setConfig({ ...config, auto_turnos_descuento_pct: parseInt(e.target.value) || 20 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Días de Anticipación al Turno
                </label>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={config.auto_turnos_dias_anticipacion}
                  onChange={(e) =>
                    setConfig({ ...config, auto_turnos_dias_anticipacion: parseInt(e.target.value) || 1 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  1 = Enviar el beneficio el día previo al turno.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Identidad Línea 3 Meta</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block">Número Mostrado:</span>
                <span className="font-semibold text-emerald-400 text-sm">
                  {salud?.display_phone_number || '+54 9 261 568-0272'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block">Nombre Verificado:</span>
                <span className="font-medium text-slate-200">
                  {salud?.verified_name || 'Óptica Vortix'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">Calidad Meta:</span>
                  <span className="font-semibold text-emerald-400">
                    {salud?.quality_rating || 'GREEN'}
                  </span>
                </div>
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
