'use client'

import React, { useState, useEffect } from 'react'
import { 
  QrCode, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  LogOut, 
  Send, 
  ShieldCheck, 
  Zap, 
  Radio,
  ExternalLink,
  Info
} from 'lucide-react'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'
import { BACKEND_URL } from '@/lib/api'

interface WhatsAppStatus {
  available: boolean
  status: string
  is_logged_in: boolean
  qr_ready: boolean
  qr_expires_in: number
  device_info: {
    phone: string | null
    push_name: string | null
    business_name: string | null
    platform: string | null
    jid: string | null
    connected_at: string | null
  }
}

export default function WhatsAppConfigCard() {
  const [statusData, setStatusData] = useState<WhatsAppStatus | null>(null)
  const [qrDataUri, setQrDataUri] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [cargando, setCargando] = useState<boolean>(true)
  const [conectando, setConectando] = useState<boolean>(false)
  const [desconectando, setDesconectando] = useState<boolean>(false)
  
  // Para mensaje de prueba
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('¡Hola! Este es un mensaje de prueba desde MedCRM. 🩺')
  const [enviandoTest, setEnviandoTest] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/status`)
      if (res.ok) {
        const data: WhatsAppStatus = await res.json()
        setStatusData(data)
        
        // Si no está conectado, solicitar siempre el código QR activo
        if (!data.is_logged_in && data.status !== 'CONNECTED') {
          await fetchQR()
        } else {
          setQrDataUri(null)
        }
      }
    } catch (err) {
      console.error('Error obteniendo estado de WhatsApp:', err)
    } finally {
      setCargando(false)
    }
  }

  const fetchQR = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/qr`)
      if (res.ok) {
        const qrInfo = await res.json()
        if (qrInfo.qr_data_uri) {
          setQrDataUri(qrInfo.qr_data_uri)
          setCountdown(qrInfo.expires_in || 30)
        }
      }
    } catch (err) {
      console.error('Error obteniendo QR:', err)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Polling inteligente cada 3.5 segundos
    const interval = setInterval(() => {
      fetchStatus()
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  // Decremento de contador
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchQR()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleConnect = async (force = false) => {
    try {
      setConectando(true)
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/connect?force=${force}`, {
        method: 'POST'
      })
      if (res.ok) {
        await fetchStatus()
        await fetchQR()
      }
    } catch (err) {
      console.error('Error conectando WhatsApp:', err)
    } finally {
      setConectando(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('¿Estás seguro de que deseas desvincular este número de WhatsApp? Se cerrará la sesión multidispositivo.')) {
      return
    }
    try {
      setDesconectando(true)
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/logout`, {
        method: 'POST'
      })
      if (res.ok) {
        setQrDataUri(null)
        await fetchStatus()
      }
    } catch (err) {
      console.error('Error cerrando sesión:', err)
    } finally {
      setDesconectando(false)
    }
  }

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone.trim()) {
      setTestFeedback({ type: 'error', text: 'Por favor ingresa un número de teléfono.' })
      return
    }

    setEnviandoTest(true)
    setTestFeedback(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: testPhone,
          mensaje: testMsg
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestFeedback({ 
          type: 'success', 
          text: data.enviado_real 
            ? '¡Mensaje entregado exitosamente a WhatsApp!' 
            : 'Mensaje procesado en base de datos (Modo simulado).' 
        })
      } else {
        setTestFeedback({ type: 'error', text: data.detail || data.error || 'Error al enviar mensaje' })
      }
    } catch (err: any) {
      setTestFeedback({ type: 'error', text: err.message || 'Error de conexión con el backend.' })
    } finally {
      setEnviandoTest(false)
    }
  }

  const isConnected = statusData?.is_logged_in || statusData?.status === 'CONNECTED'
  const isPairing = statusData?.status === 'PAIRING_QR_READY' || (Boolean(qrDataUri) && !isConnected)

  return (
    <div className="space-y-6">
      {/* Banner Superior de Estado de Conexión */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 ${
        isConnected 
          ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/20' 
          : isPairing 
            ? 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20' 
            : 'bg-slate-100 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl flex items-center justify-center ${
              isConnected 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : isPairing 
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 animate-pulse' 
                  : 'bg-slate-400 text-white'
            }`}>
              <Smartphone size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Estado de WhatsApp</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 ${
                  isConnected 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                    : isPairing 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' 
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : isPairing ? 'bg-amber-500 animate-ping' : 'bg-slate-400'
                  }`} />
                  {isConnected ? 'Conectado y Operativo' : isPairing ? 'Esperando Escaneo de QR' : 'Desconectado'}
                </span>
              </div>
              <p className="text-sm text-[var(--secondary)] mt-0.5">
                {isConnected 
                  ? `Vinculado al número ${statusData?.device_info?.phone ? formatPhoneDisplay(statusData.device_info.phone) : 'Móvil'} • Sesión multidispositivo activa`
                  : isPairing 
                    ? 'Abre WhatsApp en tu teléfono y escanea el código QR a continuación.'
                    : 'Inicia el proceso para sincronizar tu cuenta de WhatsApp con el CRM.'}
              </p>
            </div>
          </div>

          {/* Botones de Acción Global */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleConnect(true)}
              disabled={conectando}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--card)] border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--foreground)] flex items-center gap-2 transition-all shadow-sm"
              title="Reiniciar conexión y regenerar socket"
            >
              <RefreshCw size={14} className={conectando ? 'animate-spin' : ''} />
              <span>{conectando ? 'Reconectando...' : 'Reconectar'}</span>
            </button>

            {isConnected && (
              <button
                onClick={handleLogout}
                disabled={desconectando}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 transition-all"
              >
                <LogOut size={14} />
                <span>{desconectando ? 'Desvinculando...' : 'Cerrar Sesión'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Principal: QR Scanner vs Información del Dispositivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Lado Izquierdo: QR o Ficha de Dispositivo */}
        <div className="lg:col-span-7 space-y-6">
          {!isConnected ? (
            /* Tarjeta de Código QR */
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-2">
                <QrCode className="text-blue-600" size={24} />
                <h3 className="font-bold text-base">Escanear Código QR</h3>
              </div>
              <p className="text-xs text-[var(--secondary)] max-w-sm mb-6">
                Abre WhatsApp en tu teléfono celular y escanea este código para autorizar a MedCRM.
              </p>

              {/* Contenedor del QR */}
              <div className="relative p-4 rounded-2xl bg-white border-2 border-dashed border-blue-500/40 shadow-inner flex flex-col items-center justify-center min-h-[280px] min-w-[280px]">
                {qrDataUri ? (
                  <div className="flex flex-col items-center animate-fade-in">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={qrDataUri} 
                      alt="Código QR WhatsApp" 
                      className="w-60 h-60 object-contain rounded-lg transition-transform hover:scale-105 duration-200"
                    />
                    
                    {/* Temporizador regresivo */}
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Radio size={14} className="text-blue-600 animate-pulse" />
                      <span>El código se actualiza en: <strong className="text-blue-600">{countdown}s</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                      <RefreshCw size={24} className="animate-spin" />
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      Generando código QR seguro con Neonize...
                    </p>
                    <button
                      onClick={() => handleConnect(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 glow-primary transition-all"
                    >
                      Generar Código QR
                    </button>
                  </div>
                )}
              </div>

              {/* Guía Paso a Paso */}
              <div className="mt-6 w-full text-left bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-[var(--border)]">
                <p className="text-xs font-bold text-[var(--foreground)] mb-2 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-600" />
                  Instrucciones de Vinculación:
                </p>
                <ol className="text-xs text-[var(--secondary)] space-y-1.5 list-decimal list-inside">
                  <li>Abre WhatsApp en tu teléfono celular.</li>
                  <li>Toca <strong>Menú (⋮)</strong> en Android o <strong>Ajustes (⚙️)</strong> en iPhone.</li>
                  <li>Selecciona <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.</li>
                  <li>Apunta la cámara de tu teléfono hacia esta pantalla para escanear el código QR.</li>
                </ol>
              </div>
            </div>
          ) : (
            /* Tarjeta de Dispositivo Vinculado */
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-600/10 text-emerald-600">
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Dispositivo Vinculado</h3>
                    <p className="text-xs text-[var(--secondary)]">Sesión activa y sincronizada con WhatsApp Web Gateway</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)]">
                  <span className="text-[11px] font-semibold text-[var(--secondary)] uppercase tracking-wider">Número de Teléfono</span>
                  <p className="text-sm font-bold text-[var(--foreground)] mt-1">
                    {statusData?.device_info?.phone ? formatPhoneDisplay(statusData.device_info.phone) : 'No disponible'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)]">
                  <span className="text-[11px] font-semibold text-[var(--secondary)] uppercase tracking-wider">Nombre del Perfil</span>
                  <p className="text-sm font-bold text-[var(--foreground)] mt-1 truncate">
                    {statusData?.device_info?.push_name || 'Clínica Médica'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)]">
                  <span className="text-[11px] font-semibold text-[var(--secondary)] uppercase tracking-wider">Plataforma</span>
                  <p className="text-sm font-bold text-[var(--foreground)] mt-1">
                    {statusData?.device_info?.platform || 'Neonize Multi-Device'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)]">
                  <span className="text-[11px] font-semibold text-[var(--secondary)] uppercase tracking-wider">Sincronizado desde</span>
                  <p className="text-sm font-bold text-[var(--foreground)] mt-1">
                    {statusData?.device_info?.connected_at || 'Recientemente'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 flex items-start gap-3">
                <Zap className="text-blue-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-blue-950 dark:text-blue-200 space-y-1">
                  <p className="font-bold">Sincronización en Tiempo Real Activa</p>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300">
                    Todos los mensajes entrantes de tus pacientes se guardan automáticamente en Supabase y son atendidos por el agente Gemini con presupuestador médico.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lado Derecho: Enviar Mensaje de Prueba & Parámetros */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Send className="text-blue-600" size={20} />
              <h3 className="font-bold text-base">Enviar Mensaje de Prueba</h3>
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Verifica el despacho de mensajes en tiempo real enviando un mensaje directo a tu celular u otro número.
            </p>

            <form onSubmit={handleSendTest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
                  Número de Teléfono (ej: 011 15 1234-5678, 11 1234 5678)
                </label>
                <input 
                  type="text"
                  placeholder="011 15 1234-5678 o 5491123456789"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
                {testPhone && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">
                    Se normalizará a: <strong>{formatPhoneDisplay(testPhone)}</strong> ({normalizePhoneNumber(testPhone)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
                  Contenido del Mensaje
                </label>
                <textarea 
                  rows={3}
                  value={testMsg}
                  onChange={(e) => setTestMsg(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              {testFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  testFeedback.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  {testFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{testFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={enviandoTest}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 glow-primary transition-all disabled:opacity-50"
              >
                <Send size={14} className={enviandoTest ? 'animate-bounce' : ''} />
                <span>{enviandoTest ? 'Despachando Mensaje...' : 'Despachar Mensaje de Prueba'}</span>
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
