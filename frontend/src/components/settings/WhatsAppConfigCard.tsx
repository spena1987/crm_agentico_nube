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
  Info,
  KeyRound,
  Copy,
  Check,
  ChevronRight
} from 'lucide-react'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'
import { BACKEND_URL } from '@/lib/api'

interface WhatsAppStatus {
  available: boolean
  status: string
  is_logged_in: boolean
  qr_ready: boolean
  qr_expires_in: number
  pairing_code?: string | null
  pairing_phone?: string | null
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
  
  // Vinculación por Código Numérico
  const [pairingMethod, setPairingMethod] = useState<'code' | 'qr'>('qr')
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>('549')
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [pairingCountdown, setPairingCountdown] = useState<number>(0)
  const [solicitandoCodigo, setSolicitandoCodigo] = useState<boolean>(false)
  const [codigoCopiado, setCodigoCopiado] = useState<boolean>(false)
  const [errorPairing, setErrorPairing] = useState<string | null>(null)

  // Para mensaje de prueba
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('¡Hola! Este es un mensaje de prueba desde MedCRM. 🩺')
  const [enviandoTest, setEnviandoTest] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/status`)
      if (res.ok) {
        const data: WhatsAppStatus & { qr_data_uri?: string } = await res.json()
        setStatusData(data)
        
        if (data.pairing_code) {
          setPairingCode(data.pairing_code)
        }

        if (data.qr_data_uri) {
          setQrDataUri(data.qr_data_uri)
          setCountdown(data.qr_expires_in || 30)
        }

        // Si no está conectado, asegurar que el QR esté disponible
        if (!data.is_logged_in && data.status !== 'CONNECTED') {
          if (!data.qr_data_uri) {
            await fetchQR()
          }
        } else {
          setQrDataUri(null)
          setPairingCode(null)
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
    const interval = setInterval(() => {
      fetchStatus()
    }, 3500)
    return () => clearInterval(interval)
  }, [pairingMethod])

  // Temporizador para código QR
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

  // Temporizador para código de emparejamiento numérico
  useEffect(() => {
    if (pairingCountdown <= 0) return
    const timer = setInterval(() => {
      setPairingCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [pairingCountdown])

  const handleRequestPairCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanDigits = phoneNumberInput.replace(/\D/g, '')
    if (!cleanDigits || cleanDigits.length < 8) {
      setErrorPairing('Ingresa el número con código de país (ej: 5491112345678).')
      return
    }

    setSolicitandoCodigo(true)
    setErrorPairing(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/pair-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: cleanDigits })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPairingCode(data.code)
        setPairingCountdown(data.expires_in || 120)
      } else {
        setErrorPairing(data.detail || data.error || 'No se pudo generar el código. Verifica la conexión.')
      }
    } catch (err: any) {
      setErrorPairing(err.message || 'Error al comunicarse con el servidor.')
    } finally {
      setSolicitandoCodigo(false)
    }
  }

  const handleCopyCode = () => {
    if (!pairingCode) return
    navigator.clipboard.writeText(pairingCode.replace('-', ''))
    setCodigoCopiado(true)
    setTimeout(() => setCodigoCopiado(false), 2500)
  }

  const handleConnect = async (force = false) => {
    try {
      setConectando(true)
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/connect?force=${force}`, {
        method: 'POST'
      })
      if (res.ok) {
        await fetchStatus()
        if (pairingMethod === 'qr') {
          await fetchQR()
        }
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
        setPairingCode(null)
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
  const isPairing = statusData?.status === 'PAIRING_QR_READY' || statusData?.status === 'PAIRING_CODE_READY' || Boolean(pairingCode) || (Boolean(qrDataUri) && !isConnected)

  return (
    <div className="space-y-6">
      {/* Banner Superior de Estado de Conexión */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 ${
        isConnected 
          ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/20' 
          : isPairing 
            ? 'bg-blue-500/10 border-blue-500/30 dark:bg-blue-950/20' 
            : 'bg-slate-100 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl flex items-center justify-center ${
              isConnected 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : isPairing 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 animate-pulse' 
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
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' 
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : isPairing ? 'bg-blue-500 animate-ping' : 'bg-slate-400'
                  }`} />
                  {isConnected ? 'Conectado y Operativo' : isPairing ? 'Esperando Vinculación' : 'Desconectado'}
                </span>
              </div>
              <p className="text-sm text-[var(--secondary)] mt-0.5">
                {isConnected 
                  ? `Vinculado al número ${statusData?.device_info?.phone ? formatPhoneDisplay(statusData.device_info.phone) : 'Móvil'} • Sesión multidispositivo activa`
                  : isPairing 
                    ? 'Ingresa el código en tu WhatsApp o escanea el QR para autorizar MedCRM.'
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

      {/* Grid Principal: Vinculación vs Mensaje de Prueba */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Lado Izquierdo: Vinculación (Código / QR) o Ficha de Dispositivo */}
        <div className="lg:col-span-7 space-y-6">
          {!isConnected ? (
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
              
              {/* Selector de Método: Código vs QR */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                    {pairingMethod === 'code' ? <KeyRound size={20} /> : <QrCode size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Vincular Dispositivo</h3>
                    <p className="text-xs text-[var(--secondary)]">Selecciona tu método de sincronización preferido</p>
                  </div>
                </div>

                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-[var(--border)]">
                  <button
                    onClick={() => setPairingMethod('code')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      pairingMethod === 'code'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-blue-600'
                    }`}
                  >
                    <KeyRound size={13} />
                    <span>Con Código</span>
                  </button>
                  <button
                    onClick={() => {
                      setPairingMethod('qr')
                      fetchQR()
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      pairingMethod === 'qr'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-blue-600'
                    }`}
                  >
                    <QrCode size={13} />
                    <span>Con QR</span>
                  </button>
                </div>
              </div>

              {/* OPCIÓN 1: VINCULAR CON CÓDIGO NUMÉRICO DE 8 DÍGITOS */}
              {pairingMethod === 'code' && (
                <div className="space-y-5 animate-fade-in">
                  <p className="text-xs text-[var(--secondary)]">
                    Ingresa el número de teléfono con el código de país (ej: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-blue-600">5491112345678</code>). Generaremos un código de 8 dígitos para vincular directamente desde tu app de WhatsApp.
                  </p>

                  <form onSubmit={handleRequestPairCode} className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-semibold text-xs">
                        +
                      </div>
                      <input
                        type="text"
                        value={phoneNumberInput}
                        onChange={(e) => setPhoneNumberInput(e.target.value)}
                        placeholder="5491112345678"
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={solicitandoCodigo}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 glow-primary transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shadow-sm"
                    >
                      {solicitandoCodigo ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Generando...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound size={14} />
                          <span>Obtener Código</span>
                        </>
                      )}
                    </button>
                  </form>

                  {errorPairing && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 text-xs flex items-center gap-2">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>{errorPairing}</span>
                    </div>
                  )}

                  {/* VISOR DEL CÓDIGO DE 8 DÍGITOS */}
                  {pairingCode ? (
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border border-blue-500/30 flex flex-col items-center text-center space-y-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                        Código de Vinculación de WhatsApp
                      </span>
                      
                      <div className="flex items-center gap-3">
                        <div className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-lg text-2xl sm:text-3xl font-black font-mono tracking-widest text-blue-600 dark:text-blue-400 select-all">
                          {pairingCode}
                        </div>
                        <button
                          onClick={handleCopyCode}
                          className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 flex items-center justify-center"
                          title="Copiar código"
                        >
                          {codigoCopiado ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Radio size={14} className="text-blue-600 animate-pulse" />
                        <span>Válido por: <strong className="text-blue-600">{pairingCountdown}s</strong></span>
                      </div>

                      {/* Instrucciones Rápidas */}
                      <div className="w-full text-left bg-white/80 dark:bg-slate-900/80 p-4 rounded-xl border border-blue-200 dark:border-blue-900/40 mt-2 space-y-1.5">
                        <p className="text-xs font-bold text-[var(--foreground)] mb-1 flex items-center gap-1.5">
                          <Info size={14} className="text-blue-600" />
                          Cómo ingresarlo en tu teléfono:
                        </p>
                        <ol className="text-xs text-[var(--secondary)] space-y-1 list-decimal list-inside">
                          <li>Abre WhatsApp en tu celular.</li>
                          <li>Toca <strong>Menú (⋮)</strong> o <strong>Ajustes (⚙️)</strong> &gt; <strong>Dispositivos vinculados</strong>.</li>
                          <li>Toca <strong>Vincular un dispositivo</strong>.</li>
                          <li>En la parte inferior de la cámara, toca <strong>&quot;Vincular con el número de teléfono&quot;</strong>.</li>
                          <li>Escribe el código <strong className="text-blue-600 font-mono">{pairingCode}</strong>.</li>
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-[var(--border)] text-xs text-[var(--secondary)] space-y-2">
                      <p className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                        <Info size={14} className="text-blue-600" />
                        ¿Cómo funciona la vinculación por código?
                      </p>
                      <p>
                        WhatsApp te permite vincularte ingresando tu número de teléfono y confirmando un código de 8 dígitos en tu móvil sin necesidad de apuntar la cámara al monitor.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* OPCIÓN 2: VINCULAR CON CÓDIGO QR */}
              {pairingMethod === 'qr' && (
                <div className="flex flex-col items-center text-center space-y-4 animate-fade-in">
                  <p className="text-xs text-[var(--secondary)] max-w-sm">
                    Abre WhatsApp en tu teléfono celular y escanea este código para autorizar a MedCRM.
                  </p>

                  <div className="relative p-4 rounded-2xl bg-white border-2 border-dashed border-blue-500/40 shadow-inner flex flex-col items-center justify-center min-h-[260px] min-w-[260px]">
                    {qrDataUri ? (
                      <div className="flex flex-col items-center animate-fade-in">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={qrDataUri} 
                          alt="Código QR WhatsApp" 
                          className="w-56 h-56 object-contain rounded-lg transition-transform hover:scale-105 duration-200"
                        />
                        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <Radio size={14} className="text-blue-600 animate-pulse" />
                          <span>El código se actualiza en: <strong className="text-blue-600">{countdown}s</strong></span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                          <RefreshCw size={24} className={conectando ? 'animate-spin' : ''} />
                        </div>
                        <p className="text-xs font-medium text-slate-500">
                          Generando código QR con Neonize...
                        </p>
                        <button
                          onClick={() => handleConnect(true)}
                          disabled={conectando}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 glow-primary transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                          {conectando ? 'Solicitando...' : 'Generar Código QR'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="w-full text-left bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs font-bold text-[var(--foreground)] mb-1.5 flex items-center gap-1.5">
                      <Info size={14} className="text-blue-600" />
                      Instrucciones de Escaneo:
                    </p>
                    <ol className="text-xs text-[var(--secondary)] space-y-1 list-decimal list-inside">
                      <li>Abre WhatsApp en tu teléfono celular.</li>
                      <li>Toca <strong>Menú (⋮)</strong> o <strong>Ajustes (⚙️)</strong> &gt; <strong>Dispositivos vinculados</strong>.</li>
                      <li>Toca <strong>Vincular un dispositivo</strong> y apunta la cámara a esta pantalla.</li>
                    </ol>
                  </div>
                </div>
              )}

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
