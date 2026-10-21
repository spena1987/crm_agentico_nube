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
  Radio,
  Activity,
  Eye,
  Save,
  Lock,
  MessageSquareReply
} from 'lucide-react'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'
import { apiFetch, BACKEND_URL } from '@/lib/api'

interface WhatsAppStatus {
  available: boolean
  engine?: string
  status: string
  is_logged_in: boolean
  phone_number_id?: string | null
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | string | null
  messaging_limit_tier?: string | null
  display_phone_number?: string | null
  verified_name?: string | null
  code_verification_status?: string | null
  webhook_status?: string | null
  phi_sanitization?: string | null
  device_info?: {
    phone: string | null
    push_name: string | null
    business_name: string | null
    platform: string | null
    connected_at: string | null
  }
}

interface LineHealthInfo {
  configured: boolean
  connected?: boolean
  phone_number_id?: string | null
  display_phone_number?: string | null
  verified_name?: string | null
  quality_rating?: string | null
  messaging_limit_tier?: string | null
  code_verification_status?: string | null
  account_status?: string | null
  status?: string | null
  error?: string | null
  config?: {
    estudios_phone_number_id?: string
    estudios_display_phone?: string
    estudios_verified_name?: string
    estudios_template_pdf?: string
    estudios_template_img?: string
    estudios_auto_reply_enabled?: boolean
    estudios_derivacion_telefono?: string
    estudios_auto_reply_text?: string
  }
}

export default function WhatsAppConfigCard() {
  const [statusData, setStatusData] = useState<WhatsAppStatus | null>(null)
  const [cargando, setCargando] = useState<boolean>(true)
  const [verificando, setVerificando] = useState<boolean>(false)

  // Estado Multi-Línea (Línea 1: Quirúrgico | Línea 2: Estudios Oftalmológicos)
  const [lineaQuirurgica, setLineaQuirurgica] = useState<LineHealthInfo | null>(null)
  const [lineaEstudios, setLineaEstudios] = useState<LineHealthInfo | null>(null)
  const [estudiosPhoneId, setEstudiosPhoneId] = useState('')
  const [estudiosDisplayPhone, setEstudiosDisplayPhone] = useState('')
  const [estudiosVerifiedName, setEstudiosVerifiedName] = useState('Centrovisión Estudios')
  const [estudiosTemplatePdf, setEstudiosTemplatePdf] = useState('entrega_estudio_oftalmologico_pdf')
  const [estudiosTemplateImg, setEstudiosTemplateImg] = useState('entrega_estudio_oftalmologico_img')
  const [estudiosAutoReplyEnabled, setEstudiosAutoReplyEnabled] = useState(true)
  const [estudiosDerivacionTelefono, setEstudiosDerivacionTelefono] = useState('')
  const [estudiosAutoReplyText, setEstudiosAutoReplyText] = useState('')
  const [guardandoLinea2, setGuardandoLinea2] = useState(false)
  const [linea2Feedback, setLinea2Feedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Registro de PIN 2FA (/register en Cloud API)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin2FA, setPin2FA] = useState('')
  const [registrandoPin, setRegistrandoPin] = useState(false)

  // Mensaje de prueba
  const [testLine, setTestLine] = useState<'quirurgico' | 'estudios'>('quirurgico')
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

  const fetchStatus = async (populateForm: boolean = false) => {
    try {
      const [resStatus, resLines] = await Promise.all([
        apiFetch('/api/whatsapp/status'),
        apiFetch('/api/whatsapp/lines')
      ])
      if (resStatus.ok) {
        const data: WhatsAppStatus = await resStatus.json()
        setStatusData(data)
      }
      if (resLines.ok) {
        const linesData = await resLines.json()
        setLineaQuirurgica(linesData.linea_quirurgica || null)
        setLineaEstudios(linesData.linea_estudios || null)
        const cfg = linesData.linea_estudios?.config
        if (cfg && populateForm) {
          setEstudiosPhoneId(cfg.estudios_phone_number_id || '')
          setEstudiosDisplayPhone(cfg.estudios_display_phone || '')
          setEstudiosVerifiedName(cfg.estudios_verified_name || 'Centrovisión Estudios')
          setEstudiosTemplatePdf(cfg.estudios_template_pdf || 'entrega_estudio_oftalmologico_pdf')
          setEstudiosTemplateImg(cfg.estudios_template_img || 'entrega_estudio_oftalmologico_img')
          setEstudiosAutoReplyEnabled(cfg.estudios_auto_reply_enabled !== false)
          setEstudiosDerivacionTelefono(cfg.estudios_derivacion_telefono || '')
          setEstudiosAutoReplyText(cfg.estudios_auto_reply_text || '')
        }
      }
    } catch (err) {
      console.error('Error obteniendo estado de WhatsApp Cloud API:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchStatus(true)
    const interval = setInterval(() => fetchStatus(false), 12000)
    return () => clearInterval(interval)
  }, [])

  const handleCheckConnection = async () => {
    try {
      setVerificando(true)
      const res = await apiFetch('/api/whatsapp/connect?force=true', {
        method: 'POST'
      })
      if (res.ok) {
        await fetchStatus(false)
      }
    } catch (err) {
      console.error('Error al sincronizar WhatsApp Cloud:', err)
    } finally {
      setVerificando(false)
    }
  }

  const handleSaveLinea2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardandoLinea2(true)
    setLinea2Feedback(null)
    try {
      const res = await apiFetch('/api/whatsapp/lines', {
        method: 'PUT',
        body: JSON.stringify({
          estudios_phone_number_id: estudiosPhoneId.trim(),
          estudios_display_phone: estudiosDisplayPhone.trim(),
          estudios_verified_name: estudiosVerifiedName.trim(),
          estudios_template_pdf: estudiosTemplatePdf.trim(),
          estudios_template_img: estudiosTemplateImg.trim(),
          estudios_auto_reply_enabled: estudiosAutoReplyEnabled,
          estudios_derivacion_telefono: estudiosDerivacionTelefono.trim(),
          estudios_auto_reply_text: estudiosAutoReplyText
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLineaQuirurgica(data.linea_quirurgica || null)
        setLineaEstudios(data.linea_estudios || null)
        setLinea2Feedback({
          type: 'success',
          text: data.linea_estudios?.connected
            ? '¡Línea 2 de Estudios Oftalmológicos guardada y verificada en vivo con Meta Graph API!'
            : 'Configuración de Línea 2 guardada. Si el número es nuevo en Meta, recuerda activarlo con su PIN 2FA.'
        })
      } else {
        setLinea2Feedback({
          type: 'error',
          text: data.detail || 'Error al guardar la configuración de la Línea 2.'
        })
      }
    } catch (err: any) {
      setLinea2Feedback({ type: 'error', text: err.message || 'Error de red.' })
    } finally {
      setGuardandoLinea2(false)
    }
  }

  const handleRegisterPinCloudApi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin2FA.replace(/\D/g, '').length !== 6) {
      setLinea2Feedback({ type: 'error', text: 'El PIN de verificación en dos pasos debe tener exactamente 6 dígitos.' })
      return
    }
    setRegistrandoPin(true)
    setLinea2Feedback(null)
    try {
      const res = await apiFetch('/api/whatsapp/register-line', {
        method: 'POST',
        body: JSON.stringify({
          line: 'estudios',
          phone_number_id: estudiosPhoneId.trim(),
          pin: pin2FA.replace(/\D/g, '')
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setShowPinModal(false)
        setPin2FA('')
        setLinea2Feedback({
          type: 'success',
          text: data.mensaje || '¡Número registrado y activado en Meta WhatsApp Cloud API!'
        })
        await fetchStatus(false)
      } else {
        setLinea2Feedback({
          type: 'error',
          text: data.detail || 'Meta rechazó el registro del PIN.'
        })
      }
    } catch (err: any) {
      setLinea2Feedback({ type: 'error', text: err.message || 'Error al registrar PIN.' })
    } finally {
      setRegistrandoPin(false)
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
      const endpoint = testLine === 'estudios' ? '/api/whatsapp/send-test-line' : '/api/whatsapp/send-test'
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          line: testLine,
          telefono: testPhone,
          mensaje: testMsg
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestFeedback({ 
          type: 'success', 
          text: data.enviado_real 
            ? `¡Mensaje despachado exitosamente desde la línea ${testLine === 'estudios' ? 'de Estudios Oftalmológicos' : 'Quirúrgica'}!` 
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
                <h2 className="text-lg font-bold">Meta WhatsApp Cloud API • Arquitectura Multi-Línea</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 ${
                  isConnected 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {isConnected ? 'WABA Conectada y Operativa' : 'Configuración Pendiente'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-mono font-semibold">
                  Graph API v21+
                </span>
              </div>
              <p className="text-sm text-[var(--secondary)] mt-1">
                {isConnected 
                  ? `Misma App de Meta y WABA operando líneas independientes por unidad de negocio (Quirúrgico vs Estudios Oftalmológicos).`
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
              title="Comprobar enlace de ambas líneas con Meta Cloud API"
            >
              <RefreshCw size={14} className={verificando ? 'animate-spin text-blue-600' : ''} />
              <span>{verificando ? 'Verificando...' : 'Comprobar Líneas'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* PANEL DUAL DE LÍNEAS TELEFÓNICAS (LÍNEA 1 QUIRÚRGICO VS LÍNEA 2 ESTUDIOS OFTALMOLÓGICOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TARJETA LÍNEA 1: ASESORAMIENTO QUIRÚRGICO */}
        <div className="p-6 rounded-2xl border border-emerald-500/30 bg-[var(--card)] shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  Línea 1 • Principal
                </span>
                <h3 className="font-bold text-base text-[var(--foreground)]">
                  Asesoramiento Quirúrgico & CRM
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Conectada
              </span>
            </div>

            <p className="text-xs text-[var(--secondary)] leading-relaxed">
              Línea vinculada a la bandeja de entrada de chats quirúrgicos, Agente IA Gemini, presupuestos, consentimientos informados y seguimiento prequirúrgico.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--secondary)] block">
                  Phone Number ID (Meta)
                </span>
                <span className="font-mono text-xs font-bold text-[var(--foreground)] select-all mt-0.5 block truncate">
                  {lineaQuirurgica?.phone_number_id || statusData?.phone_number_id || 'Configurado'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--secondary)] block">
                  Número / Nombre Verificado
                </span>
                <span className="text-xs font-bold text-[var(--foreground)] mt-0.5 block truncate">
                  {lineaQuirurgica?.display_phone_number || statusData?.display_phone_number || 'Oficial'} • {lineaQuirurgica?.verified_name || statusData?.verified_name || 'Centrovisión'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between text-xs">
            <span className="text-[var(--secondary)] font-medium">
              Calidad Meta: <strong className="text-emerald-600 dark:text-emerald-400">{lineaQuirurgica?.quality_rating || statusData?.quality_rating || 'GREEN'}</strong>
            </span>
            <span className="text-[var(--secondary)] font-medium">
              Límite: <strong className="text-[var(--foreground)]">{lineaQuirurgica?.messaging_limit_tier || statusData?.messaging_limit_tier || 'TIER_1K'}</strong>
            </span>
          </div>
        </div>

        {/* TARJETA LÍNEA 2: UNIDAD DE ESTUDIOS OFTALMOLÓGICOS (EXCLUSIVA TÉCNICOS) */}
        <div className="p-6 rounded-2xl border border-cyan-500/40 bg-[var(--card)] shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Eye size={13} />
                Línea 2 • Estudios
              </span>
              <h3 className="font-bold text-base text-[var(--foreground)]">
                Unidad de Estudios Oftalmológicos
              </h3>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
              lineaEstudios?.connected
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : estudiosPhoneId
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                lineaEstudios?.connected ? 'bg-emerald-500 animate-pulse' : estudiosPhoneId ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              {lineaEstudios?.connected
                ? `Conectada (${lineaEstudios.display_phone_number || 'Activa'})`
                : estudiosPhoneId
                ? 'Pendiente Registro / Verificación'
                : 'Sin Phone ID asignado'}
            </span>
          </div>

          <p className="text-xs text-[var(--secondary)] leading-relaxed">
            Número dedicado exclusivamente al despacho de estudios diagnósticos (`PDF`, `JPG`, `PNG`). <strong>Aislamiento estricto:</strong> los envíos y respuestas en esta línea nunca crean pacientes ni conversaciones en la bandeja quirúrgica.
          </p>

          <form onSubmit={handleSaveLinea2} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider mb-1">
                  Phone Number ID (Línea Estudios)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 109876543210987"
                  value={estudiosPhoneId}
                  onChange={(e) => setEstudiosPhoneId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--secondary)] uppercase tracking-wider mb-1">
                  Teléfono Derivación Consultas (wa.me)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 5492614703230"
                  value={estudiosDerivacionTelefono}
                  onChange={(e) => setEstudiosDerivacionTelefono(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            {/* Auto-reply toggle */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-[var(--foreground)]">
                  <MessageSquareReply size={14} className="text-cyan-600" />
                  Respuesta automática si el paciente escribe a la línea de estudios
                </span>
                <input
                  type="checkbox"
                  checked={estudiosAutoReplyEnabled}
                  onChange={(e) => setEstudiosAutoReplyEnabled(e.target.checked)}
                  className="h-4 w-4 accent-cyan-600 rounded cursor-pointer"
                />
              </div>
              {estudiosAutoReplyEnabled && (
                <textarea
                  rows={2}
                  value={estudiosAutoReplyText}
                  onChange={(e) => setEstudiosAutoReplyText(e.target.value)}
                  placeholder="Mensaje automático de cortesía informando que esta línea es solo para envío de estudios..."
                  className="w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-white dark:bg-slate-900 border border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              )}
            </div>

            {linea2Feedback && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                linea2Feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}>
                {linea2Feedback.type === 'success' ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}
                <span>{linea2Feedback.text}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="submit"
                disabled={guardandoLinea2}
                className="flex-1 py-2 px-4 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-sm"
              >
                <Save size={14} />
                <span>{guardandoLinea2 ? 'Guardando...' : 'Guardar Línea 2 (Estudios)'}</span>
              </button>

              {estudiosPhoneId && (
                <button
                  type="button"
                  onClick={() => setShowPinModal(true)}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--foreground)] border border-[var(--border)] flex items-center gap-1.5 transition-all"
                  title="Ejecutar POST /{phone_number_id}/register con el PIN de 6 dígitos en Meta Cloud API"
                >
                  <Lock size={13} className="text-cyan-600" />
                  <span>Activar PIN 2FA</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Modal para activar número nuevo con PIN de 6 dígitos en Meta Cloud API */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-500">
                  <Lock size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Registrar Número en Meta Cloud API</h4>
                  <p className="text-[11px] text-[var(--secondary)]">Phone ID: {estudiosPhoneId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-xs text-[var(--secondary)] hover:text-[var(--foreground)] px-2 py-1"
              >
                Cerrar
              </button>
            </div>
            <p className="text-xs text-[var(--secondary)] leading-relaxed">
              Cuando agregas un número nuevo en el portafolio de Meta y verificas el SMS/llamada, Meta exige invocar por única vez el endpoint <code>/register</code> con el <strong>PIN de 6 dígitos</strong> de verificación en dos pasos para que pase a estado <strong>Conectado</strong>.
            </p>
            <form onSubmit={handleRegisterPinCloudApi} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)] mb-1">
                  PIN de 6 dígitos (Verificación en 2 pasos de Meta)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="123456"
                  value={pin2FA}
                  onChange={(e) => setPin2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-center text-lg tracking-widest font-mono bg-slate-50 dark:bg-slate-800 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registrandoPin || pin2FA.length !== 6}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
                >
                  {registrandoPin ? 'Activando en Meta...' : 'Confirmar y Activar Número'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monitor de Salud y Observabilidad de la Línea Meta (Phase 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Card 1: Calidad de la Línea */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--secondary)] mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Calidad de Línea</span>
            <Activity size={14} className={
              statusData?.quality_rating === 'RED' ? 'text-rose-500' :
              statusData?.quality_rating === 'YELLOW' ? 'text-amber-500' : 'text-emerald-500'
            } />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${
              statusData?.quality_rating === 'RED' ? 'bg-rose-500 animate-pulse' :
              statusData?.quality_rating === 'YELLOW' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`} />
            <span className="font-bold text-sm text-[var(--foreground)]">
              {statusData?.quality_rating === 'GREEN' ? 'Óptima (GREEN)' :
               statusData?.quality_rating === 'YELLOW' ? 'Media (YELLOW)' :
               statusData?.quality_rating === 'RED' ? 'Riesgo (RED)' : 'Verificada'}
            </span>
          </div>
          <p className="text-[10px] text-[var(--secondary)] mt-1.5 leading-tight">
            Reputación oficial ante Meta contra bloqueos por spam.
          </p>
        </div>

        {/* Card 2: Límite de Envío */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--secondary)] mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Límite de Envío</span>
            <Zap size={14} className="text-blue-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold text-sm text-[var(--foreground)]">
              {statusData?.messaging_limit_tier === 'TIER_1K' ? '1.000 conv/día' :
               statusData?.messaging_limit_tier === 'TIER_10K' ? '10.000 conv/día' :
               statusData?.messaging_limit_tier === 'TIER_100K' ? '100.000 conv/día' :
               statusData?.messaging_limit_tier === 'TIER_UNLIMITED' ? 'Ilimitado' :
               (statusData?.messaging_limit_tier || '250 conv/día')}
            </span>
          </div>
          <p className="text-[10px] text-[var(--secondary)] mt-1.5 leading-tight">
            Volumen máximo de conversaciones iniciadas por 24h.
          </p>
        </div>

        {/* Card 3: Suscripción Webhook */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--secondary)] mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Eventos Webhook</span>
            <Radio size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span className="font-bold text-sm text-[var(--foreground)]">
              {statusData?.webhook_status === 'ACTIVE' ? 'En Vivo (v21+)' : 'Sincronizando'}
            </span>
          </div>
          <p className="text-[10px] text-[var(--secondary)] mt-1.5 leading-tight">
            Ruteo inteligente por <code>phone_number_id</code>.
          </p>
        </div>

        {/* Card 4: Anonimización PHI */}
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--secondary)] mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Privacidad PHI</span>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
              Ley 25.326 / HIPAA
            </span>
          </div>
          <p className="text-[10px] text-[var(--secondary)] mt-1.5 leading-tight">
            0 bytes en Supabase Storage para estudios médicos.
          </p>
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
                <h3 className="font-bold text-base">Parámetros del Gateway Cloud (Compartido WABA)</h3>
                <p className="text-xs text-[var(--secondary)]">Un único Webhook recibe eventos de ambos números y los separa por <code>metadata.phone_number_id</code></p>
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
                    Phone ID Quirúrgico (Línea 1)
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
                  ✓ Bandeja Quirúrgica & IA
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
                {['messages', 'message_deliveries', 'message_reads', 'message_template_status_update'].map((field) => (
                  <span 
                    key={field}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300"
                  >
                    ✓ {field}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Al activar estos campos, el CRM actualiza automáticamente los estados de entrega y lectura (doble tilde azul) tanto en los chats quirúrgicos como en la tabla de auditoría de Estudios Oftalmológicos.
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Enviar Mensaje de Prueba & URLs de Cumplimiento */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Mensaje de Prueba con selector de línea */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="text-blue-600" size={20} />
                <h3 className="font-bold text-base">Enviar Mensaje de Prueba</h3>
              </div>
            </div>
            <p className="text-xs text-[var(--secondary)]">
              Verifica la entrega en tiempo real seleccionando desde qué línea deseas despachar el mensaje.
            </p>

            <form onSubmit={handleSendTest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
                  Línea Emisora
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestLine('quirurgico')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      testLine === 'quirurgico'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    Línea 1: Quirúrgica
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestLine('estudios')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      testLine === 'estudios'
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    Línea 2: Estudios Oftalmo
                  </button>
                </div>
              </div>

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
                <span>{enviandoTest ? 'Despachando...' : `Probar Envío desde ${testLine === 'estudios' ? 'Línea 2 (Estudios)' : 'Línea 1 (Quirúrgica)'}`}</span>
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
