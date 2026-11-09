'use client'

import React, { useState, useEffect } from 'react'
import {
  Send,
  Clock,
  Calendar,
  Save,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
  HelpCircle,
  FileText,
  CalendarDays
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface NotificacionesConfig {
  enabled: boolean
  anticipacion_dias_habiles: number
  hora_corte: string
  timezone: string
  linea_waba: string
  plantilla_nombre: string
  idioma_plantilla: string
  incluir_sabados: boolean
  proxima_fecha_proyectada?: string
}

export default function ConfiguracionNotificacionesCirugiasCard() {
  const [config, setConfig] = useState<NotificacionesConfig>({
    enabled: true,
    anticipacion_dias_habiles: 2,
    hora_corte: '19:00',
    timezone: 'America/Argentina/Buenos_Aires',
    linea_waba: 'estudios',
    plantilla_nombre: 'agenda_quirurgica_prestador',
    idioma_plantilla: 'es_AR',
    incluir_sabados: false,
    proxima_fecha_proyectada: ''
  })

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [ejecutandoTest, setEjecutandoTest] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [resultadoTest, setResultadoTest] = useState<any | null>(null)

  useEffect(() => {
    cargarConfig()
  }, [])

  const cargarConfig = async () => {
    setCargando(true)
    try {
      const res = await apiFetch(
        '/api/turnos-quirofano/notificaciones-prestadores/configuracion'
      )
      if (res.ok) {
        const data = await res.json()
        if (data) setConfig(data)
      }
    } catch (err: any) {
      console.error('Error cargando configuración de notificaciones:', err)
      setMensajeError('No se pudo cargar la configuración de notificaciones de agendas.')
    } finally {
      setCargando(false)
    }
  }

  const handleGuardar = async () => {
    setGuardando(true)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const res = await apiFetch(
        '/api/turnos-quirofano/notificaciones-prestadores/configuracion',
        {
          method: 'PUT',
          body: JSON.stringify({
            enabled: config.enabled,
            anticipacion_dias_habiles: Number(config.anticipacion_dias_habiles),
            hora_corte: config.hora_corte,
            incluir_sabados: config.incluir_sabados
          })
        }
      )

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) {
          setMensajeExito('✅ Configuración guardada exitosamente.')
          if (data.configuracion) {
            setConfig((prev) => ({ ...prev, ...data.configuracion }))
          }
        } else {
          setMensajeError('Hubo un error al guardar los cambios.')
        }
      } else {
        setMensajeError('Error en el servidor al guardar la configuración.')
      }
    } catch (err: any) {
      console.error('Error guardando configuración:', err)
      setMensajeError(err?.message || 'Error al guardar la configuración.')
    } finally {
      setGuardando(false)
    }
  }

  const handleEjecutarCorteTest = async () => {
    if (!confirm('¿Desea ejecutar ahora una prueba del corte automático con la proyección calculada?')) {
      return
    }

    setEjecutandoTest(true)
    setResultadoTest(null)
    setMensajeExito(null)
    setMensajeError(null)

    try {
      const res = await apiFetch(
        '/api/turnos-quirofano/notificaciones-prestadores/ejecutar-corte-diario',
        { method: 'POST' }
      )
      if (res.ok) {
        const data = await res.json()
        if (data && data.success) {
          setResultadoTest(data.resultado)
          setMensajeExito('✅ Corte diario ejecutado. Verifique los resultados en el panel inferior.')
        } else {
          setMensajeError('No se pudo completar la ejecución del corte diario.')
        }
      } else {
        setMensajeError('Error en el servidor al ejecutar el corte diario.')
      }
    } catch (err: any) {
      console.error('Error ejecutando corte diario:', err)
      setMensajeError(err?.message || 'Error al ejecutar el corte diario.')
    } finally {
      setEjecutandoTest(false)
    }
  }

  if (cargando) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
        <span className="text-xs">Cargando parámetros de notificaciones a prestadores...</span>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/30 text-sky-400">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Envío Automático de Agendas a Prestadores
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                WhatsApp Cloud
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Despacho consolidado de cronogramas en PDF adjunto a cirujanos y médicos derivadores
            </p>
          </div>
        </div>

        {/* Toggle Switch General */}
        <label className="flex items-center gap-3 cursor-pointer select-none bg-slate-800/60 border border-slate-700/80 px-4 py-2 rounded-xl">
          <span className="text-xs font-bold text-slate-300">
            {config.enabled ? 'Automatismo ACTIVO' : 'Automatismo PAUSADO'}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="sr-only"
            />
            <div
              className={`w-11 h-6 rounded-full transition-colors ${
                config.enabled ? 'bg-sky-500' : 'bg-slate-700'
              }`}
            />
            <div
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                config.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Grid de Configuración */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Días Hábiles de Anticipación */}
        <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
            <CalendarDays className="w-4 h-4" />
            <span>Anticipación de Corte (Días Hábiles)</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={7}
              value={config.anticipacion_dias_habiles}
              onChange={(e) =>
                setConfig({
                  ...config,
                  anticipacion_dias_habiles: Math.max(1, Math.min(7, parseInt(e.target.value) || 2))
                })
              }
              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold text-base focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <span className="text-xs text-slate-300 font-medium">días hábiles quirúrgicos</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <b>Regla clínica:</b> De Lunes a Jueves proyecta T + N días hábiles. El <b>Viernes a las 19:00 hs</b> proyecta y notifica automáticamente las cirugías del <b>Lunes subsiguiente</b> (72 hs hábiles).
          </p>
        </div>

        {/* Hora de Corte */}
        <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Hora Oficial de Corte Diario</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={config.hora_corte}
              onChange={(e) => setConfig({ ...config, hora_corte: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold text-base focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400 font-mono">
              (UTC-3 / Buenos Aires)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Momento en que el servidor compila y envía el cronograma en PDF. Se sugiere mantener a las <b>19:00 hs</b> para permitir el cierre administrativo de la grilla.
          </p>
        </div>
      </div>

      {/* Parámetros Adicionales y Proyección Actual */}
      <div className="p-4 rounded-xl bg-slate-800/20 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="text-slate-400">
            Línea WABA Emisora:{' '}
            <b className="text-slate-200">Centrovisión - Unidad de Estudios Oftalmológicos</b>
          </div>
          <div className="text-slate-400">
            Plantilla Meta (Utility):{' '}
            <code className="bg-slate-950 px-2 py-0.5 rounded text-sky-400 font-mono">
              {config.plantilla_nombre}
            </code>{' '}
            (Document Header PDF)
          </div>
        </div>

        {config.proxima_fecha_proyectada && (
          <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/40 text-sky-200">
            <span className="text-[11px] text-slate-400 block font-medium">Próxima fecha proyectada:</span>
            <span className="text-sm font-bold text-sky-300">
              📅 {config.proxima_fecha_proyectada}
            </span>
          </div>
        )}
      </div>

      {/* Mensajes de Alerta */}
      {mensajeExito && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {mensajeError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{mensajeError}</span>
        </div>
      )}

      {/* Resultados de Test */}
      {resultadoTest && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
          <div className="font-bold text-slate-200 flex items-center gap-2">
            <span>Resultados del Corte Ejecutado:</span>
            <span className="text-sky-400 font-mono">Fecha: {resultadoTest.fecha_cirugia}</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span>Total prestadores: <b>{resultadoTest.total}</b></span>
            <span className="text-emerald-400">Enviados: <b>{resultadoTest.enviados}</b></span>
            <span className="text-amber-400">Omitidos (ya enviados): <b>{resultadoTest.omitidos_por_previo}</b></span>
            <span className="text-rose-400">Fallidos / Sin teléfono: <b>{resultadoTest.fallidos}</b></span>
          </div>
        </div>
      )}

      {/* Barra de Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={handleEjecutarCorteTest}
          disabled={ejecutandoTest || guardando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition disabled:opacity-50"
          title="Fuerza la ejecución inmediata del corte automático con la proyección calculada para pruebas"
        >
          {ejecutandoTest ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              Ejecutando Corte...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-sky-400" />
              Probar Corte Automático Ahora
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleGuardar}
          disabled={guardando || ejecutandoTest}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
        >
          {guardando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  )
}
