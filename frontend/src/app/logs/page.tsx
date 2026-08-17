'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { 
  ScrollText, 
  Search, 
  RefreshCw, 
  Download, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Flame, 
  Cpu, 
  Database, 
  MessageSquare, 
  FileText, 
  Users, 
  Globe, 
  Activity, 
  Copy, 
  Check, 
  X, 
  Clock, 
  ChevronRight, 
  Filter, 
  Terminal, 
  ExternalLink,
  ShieldAlert,
  Radio
} from 'lucide-react'

interface SystemLog {
  id: string
  created_at: string
  nivel: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  modulo: 'IA_GEMINI' | 'GECLISA' | 'WHATSAPP' | 'PRESUPUESTOS' | 'PACIENTES' | 'SISTEMA' | 'FRONTEND' | 'DATABASE'
  accion: string
  mensaje: string
  detalles: Record<string, any>
  duracion_ms?: number | null
  http_status?: number | null
  paciente_id?: string | null
  trace?: string | null
}

interface LogStats {
  total_24h: number
  errores_24h: number
  warnings_24h: number
  por_modulo: Record<string, number>
  ultimos_errores: SystemLog[]
}

const MODULOS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  GECLISA: { 
    label: 'Geclisa API', 
    icon: Globe, 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-500/10', 
    border: 'border-purple-500/20' 
  },
  IA_GEMINI: { 
    label: 'Gemini IA', 
    icon: Cpu, 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/20' 
  },
  WHATSAPP: { 
    label: 'WhatsApp Gateway', 
    icon: MessageSquare, 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20' 
  },
  PRESUPUESTOS: { 
    label: 'Presupuestos & PDF', 
    icon: FileText, 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/20' 
  },
  PACIENTES: { 
    label: 'Ficha Pacientes', 
    icon: Users, 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bg: 'bg-cyan-500/10', 
    border: 'border-cyan-500/20' 
  },
  DATABASE: { 
    label: 'Supabase DB', 
    icon: Database, 
    color: 'text-orange-600 dark:text-orange-400', 
    bg: 'bg-orange-500/10', 
    border: 'border-orange-500/20' 
  },
  FRONTEND: { 
    label: 'Cliente Web', 
    icon: Activity, 
    color: 'text-pink-600 dark:text-pink-400', 
    bg: 'bg-pink-500/10', 
    border: 'border-pink-500/20' 
  },
  SISTEMA: { 
    label: 'Sistema / Núcleo', 
    icon: Terminal, 
    color: 'text-slate-600 dark:text-slate-400', 
    bg: 'bg-slate-500/10', 
    border: 'border-slate-500/20' 
  }
}

export default function LogsAuditoriaPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [stats, setStats] = useState<LogStats>({
    total_24h: 0,
    errores_24h: 0,
    warnings_24h: 0,
    por_modulo: {},
    ultimos_errores: []
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  
  // Filtros
  const [search, setSearch] = useState('')
  const [nivelFiltro, setNivelFiltro] = useState<string>('ALL')
  const [moduloFiltro, setModuloFiltro] = useState<string>('ALL')
  
  // Inspector
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)
  const [copiadoInforme, setCopiadoInforme] = useState(false)
  const [copiadoJson, setCopiadoJson] = useState(false)

  // Cargar logs desde API o Supabase
  const fetchLogsData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      else setRefreshing(true)

      // 1. Cargar logs
      const params = new URLSearchParams()
      params.append('limit', '100')
      if (nivelFiltro !== 'ALL') params.append('nivel', nivelFiltro)
      if (moduloFiltro !== 'ALL') params.append('modulo', moduloFiltro)
      if (search.trim()) params.append('search', search.trim())

      const res = await fetch(`${BACKEND_URL}/api/logs?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      } else {
        // Fallback directo a Supabase en caso de que el backend esté reiniciándose
        let query = supabase.from('system_logs' as any).select('*').order('created_at', { ascending: false }).limit(100)
        if (nivelFiltro !== 'ALL') query = query.eq('nivel', nivelFiltro)
        if (moduloFiltro !== 'ALL') query = query.eq('modulo', moduloFiltro)
        const { data: supaLogs } = await query
        if (supaLogs) setLogs(supaLogs as unknown as SystemLog[])
      }

      // 2. Cargar estadísticas 24h
      const resStats = await fetch(`${BACKEND_URL}/api/logs/stats`)
      if (resStats.ok) {
        const dataStats = await resStats.json()
        if (dataStats.stats) setStats(dataStats.stats)
      }
    } catch (err) {
      console.error('Error al cargar logs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLogsData(true)
  }, [nivelFiltro, moduloFiltro])

  // Suscripción Realtime en Supabase para recibir eventos en vivo
  useEffect(() => {
    const channel = supabase
      .channel('system-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_logs' },
        (payload) => {
          const nuevoLog = payload.new as SystemLog
          setLogs((prev) => {
            // Verificar si coincide con los filtros actuales
            const coincideNivel = nivelFiltro === 'ALL' || nuevoLog.nivel === nivelFiltro
            const coincideModulo = moduloFiltro === 'ALL' || nuevoLog.modulo === moduloFiltro
            const coincideSearch = !search.trim() || 
              nuevoLog.mensaje.toLowerCase().includes(search.toLowerCase()) || 
              nuevoLog.accion.toLowerCase().includes(search.toLowerCase())

            if (coincideNivel && coincideModulo && coincideSearch) {
              return [nuevoLog, ...prev.slice(0, 99)]
            }
            return prev
          })

          // Actualizar métricas locales en vivo
          setStats((prev) => ({
            ...prev,
            total_24h: prev.total_24h + 1,
            errores_24h: (nuevoLog.nivel === 'ERROR' || nuevoLog.nivel === 'CRITICAL') ? prev.errores_24h + 1 : prev.errores_24h,
            warnings_24h: nuevoLog.nivel === 'WARNING' ? prev.warnings_24h + 1 : prev.warnings_24h,
            por_modulo: {
              ...prev.por_modulo,
              [nuevoLog.modulo]: (prev.por_modulo[nuevoLog.modulo] || 0) + 1
            }
          }))
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [nivelFiltro, moduloFiltro, search])

  // Filtrar en cliente para búsqueda en tiempo real
  const filteredLogs = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return logs
    return logs.filter((l) => 
      l.mensaje?.toLowerCase().includes(term) ||
      l.accion?.toLowerCase().includes(term) ||
      l.modulo?.toLowerCase().includes(term) ||
      JSON.stringify(l.detalles || {}).toLowerCase().includes(term)
    )
  }, [logs, search])

  // Módulo más activo
  const moduloMasActivo = useMemo(() => {
    if (!stats.por_modulo || Object.keys(stats.por_modulo).length === 0) return 'Ninguno'
    let max = 0
    let nombre = 'N/A'
    for (const [k, v] of Object.entries(stats.por_modulo)) {
      if (v > max) {
        max = v
        nombre = MODULOS_CONFIG[k]?.label || k
      }
    }
    return `${nombre} (${max})`
  }, [stats.por_modulo])

  // Exportar logs a JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `auditoria_crm_logs_${new Date().toISOString().slice(0, 19)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Copiar informe estructurado de diagnóstico
  const handleCopiarInforme = () => {
    if (!selectedLog) return
    const reporte = `
### 🛠️ Informe de Diagnóstico del CRM Médico
* **Fecha/Hora (UTC)**: ${selectedLog.created_at}
* **Nivel de Severidad**: ${selectedLog.nivel}
* **Módulo Afectado**: ${selectedLog.modulo} (${MODULOS_CONFIG[selectedLog.modulo]?.label || selectedLog.modulo})
* **Acción Ejecutada**: \`${selectedLog.accion}\`
* **Latencia / Duración**: ${selectedLog.duracion_ms ? `${selectedLog.duracion_ms} ms` : 'N/A'}
* **Código HTTP**: ${selectedLog.http_status || 'N/A'}
* **Mensaje Descriptivo**: ${selectedLog.mensaje}

#### 📦 Metadatos Técnicos (JSON):
\`\`\`json
${JSON.stringify(selectedLog.detalles, null, 2)}
\`\`\`

${selectedLog.trace ? `#### 🛑 Stack Trace de Error:\n\`\`\`text\n${selectedLog.trace}\n\`\`\`` : ''}
`.trim()

    navigator.clipboard.writeText(reporte)
    setCopiadoInforme(true)
    setTimeout(() => setCopiadoInforme(false), 2500)
  }

  // Copiar JSON crudo
  const handleCopiarJson = () => {
    if (!selectedLog) return
    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2))
    setCopiadoJson(true)
    setTimeout(() => setCopiadoJson(false), 2000)
  }

  // Renderizador de badge de nivel
  const renderNivelBadge = (nivel: string) => {
    switch (nivel) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-600 text-white shadow-sm animate-pulse">
            <Flame size={13} /> CRÍTICO
          </span>
        )
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <AlertCircle size={13} /> ERROR
          </span>
        )
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle size={13} /> ADVERTENCIA
          </span>
        )
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Info size={13} /> INFO
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full bg-[var(--background)] text-[var(--foreground)] p-3 sm:p-4 md:p-5 gap-3.5 overflow-hidden min-w-0">
      
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border)] pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
              <ScrollText size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Logs & Auditoría del Sistema</h1>
              <p className="text-xs text-[var(--muted)]">
                Monitoreo en tiempo real de eventos, llamadas a Geclisa, inferencias de Gemini y diagnósticos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Indicador Realtime */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            realtimeConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}>
            <Radio size={14} className={realtimeConnected ? 'animate-pulse' : ''} />
            {realtimeConnected ? 'Tiempo Real Activo' : 'Conectando Realtime...'}
          </div>

          <button
            onClick={() => fetchLogsData(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-[var(--card)] transition-colors disabled:opacity-50"
            title="Refrescar logs"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refrescar
          </button>

          <button
            onClick={handleExportJson}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Download size={15} />
            Exportar JSON
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas (24 Horas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        
        {/* Total Eventos */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-[var(--muted)]">Eventos (Últimas 24h)</span>
            <div className="text-xl font-bold tracking-tight">{stats.total_24h}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
            <Activity size={18} />
          </div>
        </div>

        {/* Errores */}
        <div className="p-3.5 rounded-xl border border-red-500/20 bg-[var(--card)] flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-red-500">Errores Críticos / Fallas</span>
            <div className="text-xl font-bold tracking-tight text-red-600 dark:text-red-400">
              {stats.errores_24h}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-red-500/10 text-red-600">
            <AlertCircle size={18} />
          </div>
        </div>

        {/* Advertencias */}
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-[var(--card)] flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-amber-500">Advertencias (Warnings)</span>
            <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {stats.warnings_24h}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
            <AlertTriangle size={18} />
          </div>
        </div>

        {/* Módulo más activo */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-[var(--muted)]">Módulo Mayor Tráfico</span>
            <div className="text-xs font-semibold tracking-tight truncate max-w-[160px]">
              {moduloMasActivo}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
            <Cpu size={18} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        
        {/* Buscador */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por acción, mensaje o detalle..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filtros Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          
          {/* Selector de Severidad */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-[var(--muted)]" />
            <select
              value={nivelFiltro}
              onChange={(e) => setNivelFiltro(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">Todos los Niveles</option>
              <option value="ERROR">Solo Errores (Error / Crítico)</option>
              <option value="WARNING">Solo Advertencias</option>
              <option value="INFO">Solo Información</option>
              <option value="CRITICAL">Solo Críticos</option>
            </select>
          </div>

          {/* Selector de Módulo */}
          <select
            value={moduloFiltro}
            onChange={(e) => setModuloFiltro(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="ALL">Todos los Módulos</option>
            <option value="GECLISA">Geclisa API</option>
            <option value="IA_GEMINI">Gemini IA</option>
            <option value="WHATSAPP">WhatsApp Gateway</option>
            <option value="PRESUPUESTOS">Presupuestos</option>
            <option value="PACIENTES">Pacientes</option>
            <option value="DATABASE">Base de Datos</option>
            <option value="FRONTEND">Cliente Web</option>
            <option value="SISTEMA">Sistema General</option>
          </select>

          {/* Contador de resultados */}
          <span className="text-xs text-[var(--muted)] font-medium ml-auto md:ml-1 font-mono">
            {filteredLogs.length} eventos
          </span>
        </div>
      </div>

      {/* Tabla / Feed de Logs Contenido */}
      <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs flex flex-col min-h-0 min-w-0">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3 my-auto">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <p className="text-xs text-[var(--muted)]">Cargando registros de auditoría...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2 my-auto">
            <CheckCircle2 size={30} className="text-emerald-500" />
            <p className="text-sm font-semibold">No se encontraron eventos con los filtros seleccionados</p>
            <p className="text-xs text-[var(--muted)]">El sistema se encuentra operando sin incidencias en este criterio.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 panel-scroll">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)] text-xs font-semibold text-[var(--muted)]">
                  <th className="py-3 px-4 w-32">Nivel</th>
                  <th className="py-3 px-4 w-44">Módulo</th>
                  <th className="py-3 px-4 w-52">Acción</th>
                  <th className="py-3 px-4">Mensaje & Diagnóstico</th>
                  <th className="py-3 px-4 w-28 text-center">Latencia</th>
                  <th className="py-3 px-4 w-36 text-right">Fecha / Hora</th>
                  <th className="py-3 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredLogs.map((log) => {
                  const modConfig = MODULOS_CONFIG[log.modulo] || MODULOS_CONFIG.SISTEMA
                  const ModIcon = modConfig.icon

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-blue-500/5 cursor-pointer transition-colors ${
                        selectedLog?.id === log.id ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      {/* Nivel */}
                      <td className="py-3 px-4">
                        {renderNivelBadge(log.nivel)}
                      </td>

                      {/* Módulo */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${modConfig.bg} ${modConfig.color} ${modConfig.border}`}>
                          <ModIcon size={12} />
                          {modConfig.label}
                        </span>
                      </td>

                      {/* Acción */}
                      <td className="py-3 px-4 font-mono text-xs text-[var(--foreground)]">
                        <span className="bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)]">
                          {log.accion}
                        </span>
                      </td>

                      {/* Mensaje */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--foreground)] truncate max-w-lg">
                          {log.mensaje}
                        </div>
                        {log.http_status && (
                          <span className="text-[11px] text-[var(--muted)]">
                            HTTP {log.http_status}
                          </span>
                        )}
                      </td>

                      {/* Latencia */}
                      <td className="py-3 px-4 text-center">
                        {log.duracion_ms ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
                            log.duracion_ms > 2000 
                              ? 'text-red-500 bg-red-500/10' 
                              : log.duracion_ms > 800 
                              ? 'text-amber-500 bg-amber-500/10' 
                              : 'text-slate-500 dark:text-slate-400 bg-slate-500/10'
                          }`}>
                            <Clock size={11} />
                            {log.duracion_ms}ms
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">-</span>
                        )}
                      </td>

                      {/* Fecha / Hora */}
                      <td className="py-3 px-4 text-right text-xs font-mono text-[var(--muted)]">
                        {new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <div className="text-[10px] text-[var(--muted)]/70">
                          {new Date(log.created_at).toLocaleDateString('es-AR')}
                        </div>
                      </td>

                      {/* Botón Ver Detalle */}
                      <td className="py-3 px-4 text-right">
                        <ChevronRight size={16} className="text-[var(--muted)]" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer / Modal Inspector de Diagnóstico */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-[var(--card)] h-full shadow-2xl border-l border-[var(--border)] flex flex-col justify-between animate-in slide-in-from-right duration-200">
            
            {/* Header del Inspector */}
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {renderNivelBadge(selectedLog.nivel)}
                  <span className="text-xs font-mono bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)]">
                    {selectedLog.modulo}
                  </span>
                </div>
                <h2 className="text-lg font-bold tracking-tight">Inspector de Diagnóstico</h2>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido Scrolleable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              
              {/* Tarjeta de Mensaje Principal */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-2">
                <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Mensaje del Evento</div>
                <div className="text-base font-semibold text-[var(--foreground)] leading-relaxed">
                  {selectedLog.mensaje}
                </div>
              </div>

              {/* Grid de Metadatos Clave */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  <div className="text-[11px] text-[var(--muted)]">Acción</div>
                  <div className="font-mono text-xs font-semibold truncate" title={selectedLog.accion}>
                    {selectedLog.accion}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  <div className="text-[11px] text-[var(--muted)]">Latencia</div>
                  <div className="font-mono text-xs font-semibold">
                    {selectedLog.duracion_ms ? `${selectedLog.duracion_ms} ms` : 'N/A'}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  <div className="text-[11px] text-[var(--muted)]">Código HTTP</div>
                  <div className="font-mono text-xs font-semibold">
                    {selectedLog.http_status || 'N/A'}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  <div className="text-[11px] text-[var(--muted)]">Timestamp</div>
                  <div className="font-mono text-[11px] font-semibold truncate" title={selectedLog.created_at}>
                    {new Date(selectedLog.created_at).toLocaleTimeString('es-AR')}
                  </div>
                </div>
              </div>

              {/* Paciente Asociado (si aplica) */}
              {selectedLog.paciente_id && (
                <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-xs">
                    <Users size={14} />
                    <span>ID de Paciente Asociado:</span>
                    <span className="font-mono">{selectedLog.paciente_id}</span>
                  </div>
                </div>
              )}

              {/* Visor de Detalles JSON */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    Parámetros y Detalles Técnicos (JSON)
                  </span>
                  <button
                    onClick={handleCopiarJson}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    {copiadoJson ? <Check size={12} /> : <Copy size={12} />}
                    {copiadoJson ? 'Copiado' : 'Copiar JSON'}
                  </button>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono text-xs overflow-x-auto max-h-64">
                  <pre className="text-slate-800 dark:text-slate-200">
                    {JSON.stringify(selectedLog.detalles || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Stack Trace si existe */}
              {selectedLog.trace && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-500 uppercase tracking-wider">
                    <ShieldAlert size={14} />
                    <span>Traza Técnica del Error (Stack Trace)</span>
                  </div>
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 font-mono text-xs text-red-600 dark:text-red-400 overflow-x-auto max-h-64 whitespace-pre-wrap">
                    {selectedLog.trace}
                  </div>
                </div>
              )}
            </div>

            {/* Footer de Acciones del Inspector */}
            <div className="p-6 border-t border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--background)]">
              <button
                onClick={handleCopiarInforme}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition-colors"
              >
                {copiadoInforme ? <Check size={16} /> : <Copy size={16} />}
                {copiadoInforme ? '¡Informe de Diagnóstico Copiado!' : 'Copiar Informe para Soporte'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
