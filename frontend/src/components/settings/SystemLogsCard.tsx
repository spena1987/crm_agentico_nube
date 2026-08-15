'use client'

import React, { useState, useEffect } from 'react'
import { Terminal, RefreshCw, Trash2, Copy, Check, Filter } from 'lucide-react'

interface LogEntry {
  id: string
  timestamp: string
  level: 'INFO' | 'WARNING' | 'ERROR'
  message: string
}

export default function SystemLogsCard() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARNING' | 'ERROR'>('ALL')
  const [copied, setCopied] = useState(false)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const res = await fetch('http://localhost:8000/api/whatsapp/logs?limit=60')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Error obteniendo logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const filteredLogs = logs.filter((l) => {
    if (filterLevel === 'ALL') return true
    return l.level === filterLevel
  })

  const handleCopyLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400">
            <Terminal size={22} />
          </div>
          <div>
            <h3 className="font-bold text-base">Consola de Eventos y Diagnóstico Neonize</h3>
            <p className="text-xs text-[var(--secondary)]">
              Registro cronológico en tiempo real de eventos del socket, sincronización QR y mensajería.
            </p>
          </div>
        </div>

        {/* Controles de Consola */}
        <div className="flex items-center gap-2">
          {/* Filtro */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-[var(--border)]"
          >
            <option value="ALL">Todos los Niveles</option>
            <option value="INFO">Solo Info</option>
            <option value="WARNING">Advertencias</option>
            <option value="ERROR">Errores</option>
          </select>

          {/* Auto refresh switch */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              autoRefresh 
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' 
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>En vivo</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--secondary)]"
            title="Refrescar logs ahora"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--secondary)]"
            title="Copiar logs al portapapeles"
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {/* Visor Estilo Terminal */}
      <div className="w-full bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[420px] overflow-y-auto border border-slate-800 shadow-inner">
        {filteredLogs.length === 0 ? (
          <p className="text-slate-500 italic py-8 text-center">No hay eventos registrados recientemente en la consola.</p>
        ) : (
          <div className="space-y-1.5">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed hover:bg-slate-900/60 px-1 py-0.5 rounded">
                <span className="text-slate-500 text-[11px] shrink-0">{log.timestamp}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                  log.level === 'ERROR' 
                    ? 'bg-red-950 text-red-400 border border-red-800' 
                    : log.level === 'WARNING' 
                      ? 'bg-amber-950 text-amber-400 border border-amber-800' 
                      : 'bg-blue-950 text-blue-400 border border-blue-800'
                }`}>
                  {log.level}
                </span>
                <span className="text-slate-300 break-words">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
