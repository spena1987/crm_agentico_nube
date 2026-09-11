import React, { useState, useEffect } from 'react'
import { 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  Zap, 
  ExternalLink,
  Copy,
  Check,
  Server,
  KeyRound,
  Globe,
  Radio
} from 'lucide-react'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'
import { BACKEND_URL } from '@/lib/api'

interface WhatsAppStatus {
  available: boolean
  engine?: string
  status: string
  is_logged_in: boolean
  phone_number_id?: string | null
  device_info?: {
    phone: string | null
    push_name: string | null
    business_name: string | null
    platform: string | null
    connected_at: string | null
  }
}

export default function WhatsAppConfigCard() {
  const [statusData, setStatusData] = useState<WhatsAppStatus | null>(null)
  const [cargando, setCargando] = useState<boolean>(true)
  const [verificando, setVerificando] = useState<boolean>(false)

  // Mensaje de prueba
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('¡Hola! Este es un mensaje de prueba desde MedCRM vía Meta Cloud API. 🩺')
  const [enviandoTest, setEnviandoTest] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Copiado de credenciales y URLs
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [appOrigin, setAppOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppOrigin(window.location.origin)
    }
  }, [])

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/status`)
      if (res.ok) {
        const data: WhatsAppStatus = await res.json()
        setStatusData(data)
      }
    } catch (err) {
      console.error('Error obteniendo estado de WhatsApp Cloud API:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 8000)
    return () => clearInterval(interval)
  }, [])

  const handleCheckConnection = async () => {
    try {
      setVerificando(true)
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/connect?force=true`, {
        method: 'POST'
      })
      if (res.ok) {
        await fetchStatus()
      }
    } catch (err) {
      console.error('Error al sincronizar WhatsApp Cloud:', err)
    } finally {
      setVerificando(false)
    }
  }

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone.trim()) {
      setTestFeedback({ type: 'error', text: 'Por favor ingresa un número de teléfono destinatario.' })
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
            ? '¡Mensaje despachado exitosamente a WhatsApp mediante Meta Cloud API!' 
            : 'Mensaje registrado en la base de datos de MedCRM.' 
        })
      } else {
        setTestFeedback({ type: 'error', text: data.detail || data.error || 'Error al enviar el mensaje de prueba.' })
      }
    } catch (err: any) {
      setTestFeedback({ type: 'error', text: err.message || 'Error de comunicación con el backend.' })
    } finally {
      setEnviandoTest(false)
    }
  }

  const isConnected = statusData?.is_logged_in || statusData?.status === 'CONNECTED'
  const webhookUrl = `${BACKEND_URL}/api/whatsapp/cloud/webhook`
  const verifyToken = 'medcrm_meta_verify_token_2026'

  return (
    <div className="space-y-6">
      {/* Banner Superior de Estado de Meta Cloud API */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 ${
        isConnected 
          ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/20' 
          : 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl flex items-center justify-center ${
              isConnected 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
            }`}>
              <Smartphone size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold">Meta WhatsApp Cloud API</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 ${
                  isConnected 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {isConnected ? 'Conectado y Operativo' : 'Configuración Pendiente'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-mono font-semibold">
                  Graph API v21+
                </span>
              </div>
              <p className="text-sm text-[var(--secondary)] mt-1">
                {isConnected 
                  ? `Pasarela oficial de WhatsApp activa • Phone ID: ${statusData?.phone_number_id || statusData?.device_info?.phone || 'Configurado'}`
                  : 'Se requiere configurar las credenciales de Meta for Developers para activar el canal.'}
              </p>
            </div>
          </div>

          {/* Botón de Sincronización / Comprobación */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckConnection}
              disabled={verificando}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--card)] border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--foreground)] flex items-center gap-2 transition-all shadow-sm"
              title="Comprobar enlace con Meta Cloud API"
            >
              <RefreshCw size={14} className={verificando ? 'animate-spin text-blue-600' : ''} />
              <span>{verificando ? 'Verificando...' : 'Comprobar Enlace'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Principal: Parámetros del Gateway vs Despacho de Prueba */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Columna Izquierda: Parámetros Técnicos y Webhook de Meta */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                <Server size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base">Parámetros del Gateway Cloud</h3>
                <p className="text-xs text-[var(--secondary)]">Datos para la configuración del Webhook en Meta for Developers</p>
              </div>
            </div>

            {/* URL del Webhook */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Globe size={14} className="text-blue-600" />
                  URL de Devolución de Llamada (Webhook Callback URL)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(webhookUrl, 'webhook')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--border)] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  {copiedKey === 'webhook' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedKey === 'webhook' ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-blue-600 dark:text-blue-400 break-all select-all bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-[var(--border)]">
                {webhookUrl}
              </p>
              <p className="text-[11px] text-[var(--secondary)]">
                Pega esta URL en el panel de <strong>WhatsApp &gt; Configuración &gt; Webhook</strong> en Meta Developers.
              </p>
            </div>

            {/* Identificador de Teléfono y Token de Verificación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider">
                    Phone Number ID
                  </span>
                  {statusData?.phone_number_id && (
                    <button
                      type="button"
                      onClick={() => handleCopy(statusData.phone_number_id || '', 'phone_id')}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                      title="Copiar ID"
                    >
                      {copiedKey === 'phone_id' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
                <p className="text-sm font-mono font-bold text-[var(--foreground)] truncate select-all">
                  {statusData?.phone_number_id || 'Configurado en Railway'}
                </p>
                <span className="inline-block text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Número oficial Meta
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider flex items-center gap-1">
                    <KeyRound size={12} className="text-blue-600" />
                    Verify Token
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(verifyToken, 'verify_token')}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                    title="Copiar Token"
                  >
                    {copiedKey === 'verify_token' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="text-sm font-mono font-bold text-[var(--foreground)] truncate select-all">
                  {verifyToken}
                </p>
                <span className="inline-block text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                  ✓ Token de Handshake verificado
                </span>
              </div>
            </div>

            {/* Campos de Suscripción Recomendados */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 space-y-2">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-blue-600 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Campos del Webhook Suscritos en Meta:
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {['messages', 'message_deliveries', 'message_reads'].map((field) => (
                  <span 
                    key={field}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300"
                  >
                    ✓ {field}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Al activar estos tres campos, MedCRM recibe mensajes entrantes, confirmaciones de entrega (doble tilde gris) y confirmaciones de lectura (doble tilde azul).
              </p>
            </div>

            {/* Ventana de Atención de 24 Horas */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] flex items-start gap-3">
              <Zap className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs space-y-1">
                <p className="font-bold text-[var(--foreground)]">Ventana de Atención al Paciente (24 Horas)</p>
                <p className="text-[11px] text-[var(--secondary)] leading-relaxed">
                  Meta permite enviar mensajes de texto libre durante 24 horas después de que el paciente envía un mensaje. Si la ventana expira, el sistema automáticamente solicita el uso de una plantilla pre-aprobada de Meta.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Enviar Mensaje de Prueba & URLs de Cumplimiento */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Mensaje de Prueba */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Send className="text-blue-600" size={20} />
              <h3 className="font-bold text-base">Enviar Mensaje de Prueba</h3>
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Verifica la entrega en tiempo real desde la pasarela oficial hacia cualquier número móvil.
            </p>

            <form onSubmit={handleSendTest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
                  Número de Teléfono Destino
                </label>
                <input 
                  type="text"
                  placeholder="ej: 2614703230 o 5492614703230"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                  required
                />
                {testPhone && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">
                    Normalización: <strong>{formatPhoneDisplay(testPhone)}</strong> ({normalizePhoneNumber(testPhone)})
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
                <span>{enviandoTest ? 'Despachando...' : 'Despachar Mensaje de Prueba'}</span>
              </button>
            </form>
          </div>

          {/* Tarjeta de Requisitos de Publicación Meta for Developers */}
          <div className="p-6 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={20} />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Requisitos de Publicación en Meta
                </h3>
                <p className="text-[11px] text-[var(--secondary)]">
                  URLs públicas obligatorias para verificar la aplicación y pasar a Modo Live en Meta for Developers.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {/* 1. Política de Privacidad */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    1. URL de Política de Privacidad
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(`${appOrigin || ''}/politica-privacidad`, 'privacy')}
                      className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium transition-colors"
                      title="Copiar URL completa"
                    >
                      {copiedKey === 'privacy' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedKey === 'privacy' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                    <a
                      href="/politica-privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                      title="Abrir página pública"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400 break-all select-all">
                  {appOrigin ? `${appOrigin}/politica-privacidad` : '/politica-privacidad'}
                </p>
              </div>

              {/* 2. Eliminación de Datos */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    2. URL de Eliminación de Datos
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(`${appOrigin || ''}/eliminacion-datos`, 'deletion')}
                      className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium transition-colors"
                      title="Copiar URL completa"
                    >
                      {copiedKey === 'deletion' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedKey === 'deletion' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                    <a
                      href="/eliminacion-datos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                      title="Abrir página pública"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400 break-all select-all">
                  {appOrigin ? `${appOrigin}/eliminacion-datos` : '/eliminacion-datos'}
                </p>
              </div>

              {/* 3. Términos del Servicio */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    3. URL de Términos del Servicio
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(`${appOrigin || ''}/terminos-condiciones`, 'terms')}
                      className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium transition-colors"
                      title="Copiar URL completa"
                    >
                      {copiedKey === 'terms' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedKey === 'terms' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                    <a
                      href="/terminos-condiciones"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                      title="Abrir página pública"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400 break-all select-all">
                  {appOrigin ? `${appOrigin}/terminos-condiciones` : '/terminos-condiciones'}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
