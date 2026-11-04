'use client'

import React, { useState, useEffect } from 'react'
import {
  Megaphone,
  ShieldCheck,
  Image as ImageIcon,
  Upload,
  Play,
  Pause,
  CheckCircle2,
  Sliders,
  Smartphone,
  Users,
  Sparkles,
  Loader2,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import OpticaSubNavHeader from '@/components/optica/OpticaSubNavHeader'
import { apiFetch } from '@/lib/api'
import { OpticaCampana, OpticaPlaca, OpticaSaludLinea } from '@/types/optica'

interface PlantillaOptica {
  id?: string
  name: string
  titulo_amigable?: string
  category?: string
  status?: string
  body_text?: string
  buttons?: Array<{ type?: string; text?: string; url?: string }>
}

export default function OpticaCampanasPage() {
  const [salud, setSalud] = useState<OpticaSaludLinea | null>(null)
  const [placas, setPlacas] = useState<OpticaPlaca[]>([])
  const [campanas, setCampanas] = useState<OpticaCampana[]>([])
  const [plantillas, setPlantillas] = useState<PlantillaOptica[]>([])
  const [loading, setLoading] = useState(true)

  // Subida de nueva placa promocional
  const [nuevaPlacaTitulo, setNuevaPlacaTitulo] = useState('')
  const [nuevaPlacaUrl, setNuevaPlacaUrl] = useState('')
  const [nuevaPlacaCat, setNuevaPlacaCat] = useState('VOUCHER_TURNO')
  const [uploadingPlaca, setUploadingPlaca] = useState(false)

  // Wizard de 4 pasos para Crear Campaña Anti-Bloqueo
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [campNombre, setCampNombre] = useState('Campaña Voucher 20% OFF Pacientes Consultorio')
  const [campSegmento, setCampSegmento] = useState('TURNOS_PROXIMOS_CON_DESCUENTO')
  const [campEstrategia, setCampEstrategia] = useState<'DOBLE_PASO' | 'DIRECTA_IMAGEN'>('DOBLE_PASO')
  const [campTemplate, setCampTemplate] = useState('vortix_beneficio_turno_v1')
  const [campPlacaUrl, setCampPlacaUrl] = useState('')
  const [campDescuento, setCampDescuento] = useState('20% OFF en Cristales y Armazones')
  const [jitterMin, setJitterMin] = useState(35)
  const [jitterMax, setJitterMax] = useState(90)
  const [loteMaxHora, setLoteMaxHora] = useState(35)
  const [creatingCamp, setCreatingCamp] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [resS, resP, resC, resT] = await Promise.all([
        apiFetch('/api/optica-vortix/salud-linea', { cache: 'no-store' }).catch(() => null),
        apiFetch('/api/optica-vortix/placas', { cache: 'no-store' }).catch(() => null),
        apiFetch('/api/optica-vortix/campanas', { cache: 'no-store' }).catch(() => null),
        apiFetch('/api/optica-vortix/plantillas', { cache: 'no-store' }).catch(() => null),
      ])
      if (resS?.ok) setSalud(await resS.json())
      if (resP?.ok) {
        const dp = await resP.json()
        const listP = Array.isArray(dp) ? dp : dp.items || []
        setPlacas(listP)
        if (!campPlacaUrl && listP.length > 0) setCampPlacaUrl(listP[0].url_imagen)
      }
      if (resC?.ok) {
        const dc = await resC.json()
        setCampanas(Array.isArray(dc) ? dc : dc.items || [])
      }
      if (resT?.ok) {
        const dt = await resT.json()
        const listT: PlantillaOptica[] = Array.isArray(dt) ? dt : dt.plantillas || dt.items || []
        setPlantillas(listT)
        if (listT.length > 0) {
          const yaExiste = listT.some((p) => p.name === campTemplate)
          if (!yaExiste) {
            const preferida = listT.find((p) => p.status === 'APPROVED') || listT[0]
            setCampTemplate(preferida.name)
          }
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleUploadPlaca = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaPlacaTitulo.trim() || !nuevaPlacaUrl.trim()) return
    setUploadingPlaca(true)
    try {
      const res = await apiFetch('/api/optica-vortix/placas/upload', {
        method: 'POST',
        body: JSON.stringify({
          titulo: nuevaPlacaTitulo.trim(),
          url_imagen: nuevaPlacaUrl.trim(),
          categoria: nuevaPlacaCat,
        }),
      })
      if (res.ok) {
        setNuevaPlacaTitulo('')
        setNuevaPlacaUrl('')
        await loadAll()
      }
    } catch {
    } finally {
      setUploadingPlaca(false)
    }
  }

  const handleCrearYLanzarCampana = async () => {
    setCreatingCamp(true)
    try {
      const res = await apiFetch('/api/optica-vortix/campanas', {
        method: 'POST',
        body: JSON.stringify({
          nombre: campNombre,
          segmento: campSegmento,
          estrategia: campEstrategia,
          template_name: campTemplate,
          placa_url: campPlacaUrl,
          descuento_texto: campDescuento,
          jitter_min_seg: jitterMin,
          jitter_max_seg: jitterMax,
          lote_max_hora: loteMaxHora,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        const campId = created.id || created.campana?.id
        if (campId) {
          await apiFetch(`/api/optica-vortix/campanas/${campId}/lanzar`, { method: 'POST' })
        }
        await loadAll()
        setStep(1)
      }
    } catch {
    } finally {
      setCreatingCamp(false)
    }
  }

  const handleToggleCampana = async (camp: OpticaCampana) => {
    const endpoint =
      camp.estado === 'EN_CURSO'
        ? `/api/optica-vortix/campanas/${camp.id}/pausar`
        : `/api/optica-vortix/campanas/${camp.id}/lanzar`
    await apiFetch(endpoint, { method: 'POST' })
    await loadAll()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <OpticaSubNavHeader />

      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner de Salud Anti-Bloqueo de Meta */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white p-5 border border-emerald-500/30 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-black">
                  Escudo Anti-Bloqueo Meta WhatsApp Cloud API — Activo
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                  Calidad: {salud?.quality_rating || 'GREEN'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Protección automática por Cooldown de 30 días, deduplicación por teléfono familiar, respeto estricto de Opt-Out y freno de emergencia si la calidad pasa a YELLOW/RED.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10">
              <span className="block text-[10px] text-emerald-200">Tier Diario Meta</span>
              <strong className="font-black">{salud?.messaging_limit_tier || 'TIER_1K'}</strong>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10">
              <span className="block text-[10px] text-emerald-200">Opt-Outs Respetados</span>
              <strong className="font-black">{salud?.opt_outs_total ?? 0} excluidos</strong>
            </div>
          </div>
        </div>

        {/* Grid: Constructor de Campañas en 4 Pasos + Previsualizador WhatsApp */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Constructor 4 Pasos (2 columnas) */}
          <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="text-base font-black text-[var(--foreground)]">
                  Constructor de Campañas con Goteo Humanizado
                </h2>
                <p className="text-xs text-[var(--secondary)]">
                  Diseña envíos promocionales cuidando la reputación de la Línea 3 de Óptica Vortix
                </p>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep(s as any)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                      step === s
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Paso 1 • Nombre y Segmento Clínico de Geclisa
                </h3>
                <div>
                  <label className="block text-xs font-bold mb-1">Nombre de la Campaña</label>
                  <input
                    type="text"
                    value={campNombre}
                    onChange={(e) => setCampNombre(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Audiencia Objetivo (Con exclusión automática de Opt-Out y Cooldown 30 días)
                  </label>
                  <select
                    value={campSegmento}
                    onChange={(e) => setCampSegmento(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                  >
                    <option value="TURNOS_PROXIMOS_CON_DESCUENTO">
                      🎟️ Pacientes con Turno de Consultorio Próximo (Voucher Descuento)
                    </option>
                    <option value="RECETAS_AEREOS_ULTIMOS_7_DIAS">
                      👓 Pacientes con Indicación de Lentes Aéreos (Últimos 7 días sin compra)
                    </option>
                    <option value="USUARIOS_LENTES_CONTACTO">
                      💧 Reposición de Lentes de Contacto y Soluciones
                    </option>
                    <option value="CONTROL_ANUAL_RECETA">
                      📅 Renovación Anual de Cristales (+12 meses desde última receta)
                    </option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    Siguiente: Estrategia & Placa →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Paso 2 • Estrategia Anti-Bloqueo, Plantilla Meta y Placa Gráfica
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCampEstrategia('DOBLE_PASO')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      campEstrategia === 'DOBLE_PASO'
                        ? 'border-indigo-600 bg-indigo-500/10'
                        : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-xs font-black block">
                      🛡️ Estrategia Doble Paso (Recomendada)
                    </span>
                    <span className="text-[11px] text-[var(--secondary)]">
                      Envía plantilla breve con botones rápidos; cuando el paciente pulsa &ldquo;Quiero mi voucher&rdquo;, envía la placa HD sin costo adicional.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampEstrategia('DIRECTA_IMAGEN')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      campEstrategia === 'DIRECTA_IMAGEN'
                        ? 'border-indigo-600 bg-indigo-500/10'
                        : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-xs font-black block">
                      🖼️ Plantilla Directa con Header de Imagen
                    </span>
                    <span className="text-[11px] text-[var(--secondary)]">
                      Envía la placa promocional de descuento en el encabezado del primer mensaje.
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Plantilla Oficial Meta</label>
                    <select
                      value={campTemplate}
                      onChange={(e) => setCampTemplate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold text-[var(--foreground)]"
                    >
                      {plantillas.length > 0 ? (
                        plantillas.map((p) => {
                          const badge =
                            p.status === 'APPROVED'
                              ? '✅ Aprobada'
                              : p.status === 'PENDING'
                              ? '⏳ En Revisión'
                              : p.status === 'REJECTED'
                              ? '❌ Rechazada'
                              : '⚙️ Sin aprovisionar'
                          return (
                            <option key={p.name} value={p.name}>
                              {p.titulo_amigable || p.name} ({badge})
                            </option>
                          )
                        })
                      ) : (
                        <>
                          <option value="vortix_beneficio_turno_v1">
                            Óptica Vortix • Voucher Descuento por Turno (✅ Base Oficial)
                          </option>
                          <option value="vortix_receta_lentes_aereos_v1">
                            Óptica Vortix • Cotización Receta Lentes Aéreos (✅ Base Oficial)
                          </option>
                          <option value="vortix_receta_lentes_contacto_v1">
                            Óptica Vortix • Lentes de Contacto y Adaptación (✅ Base Oficial)
                          </option>
                          <option value="vortix_lentes_listos_retiro_v1">
                            Óptica Vortix • Aviso de Lentes Listos para Retirar (✅ Base Oficial)
                          </option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Beneficio / Voucher</label>
                    <input
                      type="text"
                      value={campDescuento}
                      onChange={(e) => setCampDescuento(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    URL de Placa Gráfica Seleccionada
                  </label>
                  <input
                    type="text"
                    value={campPlacaUrl}
                    onChange={(e) => setCampPlacaUrl(e.target.value)}
                    placeholder="https://.../placa-vortix-descuento.jpg"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
                  />
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    Siguiente: Cadencia & Jitter →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                  Paso 3 • Configuración de Goteo, Jitter Aleatorio y Ventana Horaria
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Jitter Mínimo (seg)</label>
                    <input
                      type="number"
                      value={jitterMin}
                      onChange={(e) => setJitterMin(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Jitter Máximo (seg)</label>
                    <input
                      type="number"
                      value={jitterMax}
                      onChange={(e) => setJitterMax(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Máx. Mensajes / Hora</label>
                    <input
                      type="number"
                      value={loteMaxHora}
                      onChange={(e) => setLoteMaxHora(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)] font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    Siguiente: Confirmar y Lanzar →
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-emerald-600">
                  Paso 4 • Resumen de Protección y Lanzamiento
                </h3>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--border)] text-xs space-y-1.5">
                  <p>
                    <strong>Campaña:</strong> {campNombre}
                  </p>
                  <p>
                    <strong>Segmento:</strong> {campSegmento}
                  </p>
                  <p>
                    <strong>Estrategia:</strong> {campEstrategia} ({campTemplate})
                  </p>
                  <p>
                    <strong>Cadencia:</strong> 1 envío cada {jitterMin}s–{jitterMax}s (máx.{' '}
                    {loteMaxHora}/hora en horario comercial 09:00 a 20:00 hs).
                  </p>
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    onClick={handleCrearYLanzarCampana}
                    disabled={creatingCamp}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md"
                  >
                    {creatingCamp ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    Iniciar Campaña en Cola Anti-Bloqueo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previsualizador de Teléfono WhatsApp */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-xl flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-emerald-400" />
                <span className="text-xs font-black">Previsualización WhatsApp Paciente</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                {campTemplate}
              </span>
            </div>

            <div className="bg-[#0b141a] rounded-2xl p-3.5 space-y-2.5 text-xs border border-slate-800/80">
              {campPlacaUrl && (
                <div className="rounded-xl overflow-hidden bg-slate-800 max-h-36 flex items-center justify-center">
                  <img
                    src={campPlacaUrl}
                    alt="Preview Placa"
                    className="max-h-36 w-full object-cover"
                  />
                </div>
              )}
              <div className="bg-[#005c4b] text-white rounded-xl p-3 space-y-1.5 text-[11px] leading-relaxed">
                {(() => {
                  const tpl = plantillas.find((p) => p.name === campTemplate)
                  if (!tpl?.body_text) {
                    return (
                      <>
                        <p>
                          ¡Hola <strong>María</strong>! 👋 Te escribimos de <strong>Óptica Vortix</strong> (en Planta Baja de la clínica).
                        </p>
                        <p>
                          Por tu atención en el centro contás con un voucher exclusivo:{' '}
                          <strong>{campDescuento}</strong> código <strong>#VORTIX-20OFF</strong>.
                        </p>
                      </>
                    )
                  }
                  const isRetiro = campTemplate.includes('retiro') || campTemplate.includes('listos')
                  const isContacto = campTemplate.includes('contacto')
                  let preview = tpl.body_text
                    .replace(/\{\{1\}\}/g, 'María')
                    .replace(/\{\{2\}\}/g, isRetiro ? 'anteojos monofocales' : isContacto ? 'el Dr. Arago' : 'esta semana')
                    .replace(/\{\{3\}\}/g, isRetiro ? '09:00 a 19:30 hs' : isContacto ? '#VORTIX-LC' : campDescuento)
                    .replace(/\{\{4\}\}/g, '#VORTIX-20OFF')

                  return (
                    <div className="space-y-1 whitespace-pre-line">
                      {preview}
                    </div>
                  )
                })()}
              </div>

              {(() => {
                const tpl = plantillas.find((p) => p.name === campTemplate)
                if (tpl?.buttons && Array.isArray(tpl.buttons) && tpl.buttons.length > 0) {
                  return (
                    <div className="grid grid-cols-1 gap-1 pt-1">
                      {tpl.buttons.map((btn: any, bIdx: number) => {
                        const btnText = typeof btn === 'string' ? btn : btn.text || `Opción ${bIdx + 1}`
                        const isOptOut =
                          btnText.toLowerCase().includes('baja') ||
                          btnText.toLowerCase().includes('no recibir')
                        return (
                          <div
                            key={bIdx}
                            className={`py-1.5 text-center rounded-lg font-bold text-[11px] ${
                              isOptOut
                                ? 'bg-[#202c33] text-slate-400 text-[10px]'
                                : 'bg-[#202c33] text-cyan-400'
                            }`}
                          >
                            {btnText}
                          </div>
                        )
                      })}
                    </div>
                  )
                }
                return (
                  <div className="grid grid-cols-1 gap-1 pt-1">
                    <div className="py-1.5 text-center rounded-lg bg-[#202c33] text-cyan-400 font-bold text-[11px]">
                      🎟️ Quiero mi voucher de descuento
                    </div>
                    <div className="py-1.5 text-center rounded-lg bg-[#202c33] text-cyan-400 font-bold text-[11px]">
                      👓 Cotizar mi receta por WhatsApp
                    </div>
                    <div className="py-1.5 text-center rounded-lg bg-[#202c33] text-slate-400 font-semibold text-[10px]">
                      No recibir avisos de óptica
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Galería de Placas Gráficas Promocionales + Subida */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-[var(--foreground)] flex items-center gap-2">
                <ImageIcon size={17} className="text-amber-500" />
                Galería de Placas Gráficas Promocionales
              </h3>
              <p className="text-xs text-[var(--secondary)]">
                Placas listas para usar en la Automatización de Turnos o en el Chat Comercial
              </p>
            </div>

            <form onSubmit={handleUploadPlaca} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Título de la placa..."
                value={nuevaPlacaTitulo}
                onChange={(e) => setNuevaPlacaTitulo(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
              <input
                type="text"
                placeholder="URL de imagen (JPG/PNG)..."
                value={nuevaPlacaUrl}
                onChange={(e) => setNuevaPlacaUrl(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
              />
              <button
                type="submit"
                disabled={uploadingPlaca}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5"
              >
                <Upload size={13} /> Subir Placa
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {placas.map((pl) => (
              <div
                key={pl.id}
                onClick={() => setCampPlacaUrl(pl.url_imagen)}
                className={`cursor-pointer rounded-2xl border p-3 transition-all flex flex-col justify-between gap-2 ${
                  campPlacaUrl === pl.url_imagen
                    ? 'border-indigo-600 bg-indigo-500/10'
                    : 'border-[var(--border)] bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
                  <img
                    src={pl.url_imagen}
                    alt={pl.titulo}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold truncate">{pl.titulo}</p>
                  <p className="text-[10px] text-[var(--secondary)]">{pl.categoria}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monitoreo de Campañas Lanzadas */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-3">
          <h3 className="text-sm font-black text-[var(--foreground)]">
            Historial y Embudo en Vivo de Campañas de Óptica
          </h3>
          {campanas.length === 0 ? (
            <p className="text-xs text-[var(--secondary)]">
              Aún no se han lanzado campañas masivas. Usa el constructor de arriba para iniciar una.
            </p>
          ) : (
            <div className="space-y-2">
              {campanas.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-black text-[var(--foreground)]">{c.nombre}</p>
                    <p className="text-[11px] text-[var(--secondary)]">
                      Segmento: {c.segmento} • Plantilla: {c.template_name} • Estado:{' '}
                      <strong>{c.estado}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>
                      Enviados: <strong>{c.enviados ?? 0}</strong>/{c.total_audiencia ?? 0}
                    </span>
                    <span>
                      Leídos: <strong>{c.leidos ?? 0}</strong>
                    </span>
                    <span>
                      Respondidos: <strong className="text-emerald-600">{c.respondidos ?? 0}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleCampana(c)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-1"
                    >
                      {c.estado === 'EN_CURSO' ? <Pause size={12} /> : <Play size={12} />}
                      {c.estado === 'EN_CURSO' ? 'Pausar' : 'Reanudar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
