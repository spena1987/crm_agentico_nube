import express from 'express'
import cors from 'cors'
import qrcode from 'qrcode'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pino from 'pino'
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.WHATSAPP_SERVICE_PORT || 3001
const FASTAPI_WEBHOOK = process.env.FASTAPI_WEBHOOK_URL || 'http://127.0.0.1:8000/api/whatsapp/webhook/incoming'
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, 'sessions')

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Estado global de la pasarela
let sock = null
let qrDataUri = null
let qrRaw = null
let pairingCode = null
let pairingPhone = null
let pairingTimestamp = 0
let qrTimestamp = 0
let connectionStatus = 'DISCONNECTED' // DISCONNECTED | INITIALIZING | PAIRING_QR_READY | PAIRING_CODE_READY | CONNECTED
let deviceInfo = {
  phone: null,
  push_name: null,
  business_name: null,
  platform: 'WhatsApp Web Baileys',
  jid: null,
  connected_at: null
}
const logsBuffer = []

function addLog(level, message) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const entry = {
    id: `${Date.now()}_${logsBuffer.length}`,
    timestamp: now,
    level,
    message
  }
  logsBuffer.push(entry)
  if (logsBuffer.length > 80) logsBuffer.shift()
  console.log(`[${now}] [${level}] ${message}`)
}

// Normalización de números para Argentina (549) e Internacional
function normalizePhone(raw) {
  if (!raw) return ''
  let digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = digits.substring(1)
  }
  if (!digits.startsWith('54') && (digits.length === 10 || digits.length === 11)) {
    digits = '549' + (digits.startsWith('9') ? digits.substring(1) : digits)
  }
  if (digits.startsWith('54') && !digits.startsWith('549') && digits.length >= 11) {
    digits = '549' + digits.substring(2)
  }
  return digits
}

function phoneToJid(phone) {
  const clean = normalizePhone(phone)
  return `${clean}@s.whatsapp.net`
}

async function initBaileys(forceClean = false) {
  try {
    if (forceClean) {
      addLog('INFO', 'Limpiando sesión previa para nueva vinculación...')
      if (fs.existsSync(SESSIONS_DIR)) {
        try {
          fs.rmSync(SESSIONS_DIR, { recursive: true, force: true })
          fs.mkdirSync(SESSIONS_DIR, { recursive: true })
        } catch (e) {
          addLog('WARNING', `No se pudo limpiar directorio de sesiones: ${e.message}`)
        }
      }
      qrDataUri = null
      qrRaw = null
      pairingCode = null
      pairingPhone = null
      deviceInfo = { phone: null, push_name: null, business_name: null, platform: 'WhatsApp Web Baileys', jid: null, connected_at: null }
    }

    connectionStatus = 'INITIALIZING'
    addLog('INFO', 'Iniciando cliente WhatsApp Baileys...')

    const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR)
    const { version } = await fetchLatestBaileysVersion()

    const logger = pino({ level: 'silent' })

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Chrome'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false
    })

    // Guardar credenciales de sesión automáticamente
    sock.ev.on('creds.update', saveCreds)

    // Manejo de actualizaciones de conexión
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        qrRaw = qr
        qrTimestamp = Date.now()
        qrDataUri = await qrcode.toDataURL(qr, { scale: 7, margin: 2 })
        connectionStatus = 'PAIRING_QR_READY'
        addLog('INFO', `¡Código QR generado con éxito! Listo para escanear.`)
      }

      if (connection === 'open') {
        connectionStatus = 'CONNECTED'
        qrDataUri = null
        qrRaw = null
        pairingCode = null
        
        const userJid = sock.user?.id || ''
        const cleanPhone = userJid.split(':')[0].split('@')[0]
        deviceInfo = {
          phone: cleanPhone,
          push_name: sock.user?.name || 'Dispositivo WhatsApp',
          business_name: sock.user?.name || null,
          platform: 'WhatsApp Multi-Device Baileys',
          jid: userJid,
          connected_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        }
        addLog('INFO', `¡Conexión abierta y autenticada con WhatsApp! Teléfono: +${cleanPhone}`)
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        addLog('WARNING', `Conexión cerrada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`)

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'DISCONNECTED'
          addLog('INFO', 'Sesión cerrada formalmente. Reiniciando almacenamiento...')
          await initBaileys(true)
        } else if (shouldReconnect) {
          connectionStatus = 'INITIALIZING'
          setTimeout(() => initBaileys(false), 3000)
        }
      }
    })

    // Manejo de mensajes entrantes (Reenvío al Webhook de FastAPI)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const msg of messages) {
        try {
          if (!msg.message) continue
          const remoteJid = msg.key.remoteJid || ''
          
          // Ignorar estados y listas de difusión
          if (remoteJid === 'status@broadcast' || remoteJid.includes('@newsletter') || remoteJid.includes('@broadcast')) {
            continue
          }

          const fromMe = Boolean(msg.key.fromMe)
          const senderPhone = remoteJid.split('@')[0]
          
          // Extraer texto
          let text = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     msg.message?.imageMessage?.caption || 
                     msg.message?.documentMessage?.caption || 
                     msg.message?.videoMessage?.caption || ''

          // Determinar tipo de mensaje
          let messageType = 'text'
          if (msg.message.imageMessage) messageType = 'image'
          else if (msg.message.audioMessage) messageType = 'audio'
          else if (msg.message.documentMessage) messageType = 'document'
          else if (msg.message.videoMessage) messageType = 'video'
          else if (msg.message.stickerMessage) messageType = 'sticker'

          addLog('INFO', `Mensaje recibido de +${senderPhone} [${messageType}]: ${text.substring(0, 40)}`)

          // Despachar al webhook de FastAPI en segundo plano
          axios.post(FASTAPI_WEBHOOK, {
            message_id: msg.key.id,
            from_me: fromMe,
            phone: senderPhone,
            jid: remoteJid,
            name: msg.pushName || 'Paciente',
            text: text,
            message_type: messageType,
            timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000),
            raw_message: msg
          }).catch(err => {
            addLog('WARNING', `Webhook FastAPI no disponible: ${err.message}`)
          })

        } catch (msgErr) {
          addLog('ERROR', `Error procesando mensaje entrante: ${msgErr.message}`)
        }
      }
    })

  } catch (error) {
    connectionStatus = 'ERROR'
    addLog('ERROR', `Error al inicializar Baileys: ${error.message}`)
  }
}

// ==========================================
// ENDPOINTS REST PARA FASTAPI Y FRONTEND
// ==========================================

// 1. Estado general
app.get('/status', (req, res) => {
  const isConnected = connectionStatus === 'CONNECTED'
  const qrExpiresIn = Math.max(5, 30 - Math.floor((Date.now() - qrTimestamp) / 1000))
  
  res.json({
    available: true,
    engine: 'Baileys',
    status: isConnected ? 'CONNECTED' : (qrDataUri ? 'PAIRING_QR_READY' : connectionStatus),
    is_logged_in: isConnected,
    qr_ready: Boolean(qrDataUri && !isConnected),
    qr_expires_in: qrExpiresIn,
    pairing_code: pairingCode,
    pairing_phone: pairingPhone,
    device_info: deviceInfo,
    session_dir: SESSIONS_DIR
  })
})

// 2. Obtener Código QR
app.get('/qr', (req, res) => {
  const isConnected = connectionStatus === 'CONNECTED'
  const qrExpiresIn = Math.max(5, 30 - Math.floor((Date.now() - qrTimestamp) / 1000))
  
  res.json({
    qr_data_uri: isConnected ? null : qrDataUri,
    expires_in: qrExpiresIn,
    status: isConnected ? 'CONNECTED' : (qrDataUri ? 'PAIRING_QR_READY' : connectionStatus)
  })
})

// 3. Solicitar Código de Vinculación Numérico (8 dígitos)
app.post('/pair-code', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) {
      return res.status(400).json({ error: 'El número de teléfono es obligatorio.' })
    }

    const cleanPhone = normalizePhone(phone)
    addLog('INFO', `Solicitando código de vinculación para +${cleanPhone}...`)

    if (!sock || connectionStatus !== 'PAIRING_QR_READY' && connectionStatus !== 'INITIALIZING' && connectionStatus !== 'DISCONNECTED') {
      await initBaileys(false)
      // Esperar brevemente a que el socket esté listo
      await new Promise(r => setTimeout(r, 1500))
    }

    const rawCode = await sock.requestPairingCode(cleanPhone)
    const formattedCode = rawCode.length === 8 && !rawCode.includes('-') 
      ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` 
      : rawCode

    pairingCode = formattedCode
    pairingPhone = cleanPhone
    pairingTimestamp = Date.now()
    connectionStatus = 'PAIRING_CODE_READY'

    addLog('INFO', `¡Código de vinculación generado con éxito!: ${formattedCode}`)

    res.json({
      success: true,
      phone: cleanPhone,
      code: formattedCode,
      raw_code: rawCode,
      expires_in: 120,
      instructions: [
        'Abre WhatsApp en tu teléfono celular.',
        'Toca Menú (⋮) en Android o Ajustes (⚙️) en iPhone > Dispositivos vinculados.',
        'Toca "Vincular un dispositivo".',
        'En la parte inferior de la cámara, toca "Vincular con el número de teléfono".',
        `Ingresa este código de 8 caracteres: ${formattedCode}`
      ]
    })
  } catch (error) {
    addLog('ERROR', `Error al solicitar código de vinculación: ${error.message}`)
    res.status(500).json({ error: `Error al generar código: ${error.message}` })
  }
})

// 4. Enviar Mensaje de Texto
app.post('/send-message', async (req, res) => {
  try {
    const { phone, text } = req.body
    if (!phone || !text) {
      return res.status(400).json({ error: 'phone y text son requeridos.' })
    }

    if (!sock || connectionStatus !== 'CONNECTED') {
      return res.status(503).json({ error: 'WhatsApp no está conectado.', status: connectionStatus })
    }

    const jid = phoneToJid(phone)
    const result = await sock.sendMessage(jid, { text })

    addLog('INFO', `Mensaje enviado a +${normalizePhone(phone)}: ${text.substring(0, 50)}...`)
    res.json({
      success: true,
      message_id: result.key.id,
      phone: normalizePhone(phone)
    })
  } catch (error) {
    addLog('ERROR', `Error enviando mensaje: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
})

// 5. Enviar Mensaje Multimedia (PDF, Imagen, Audio)
app.post('/send-media', async (req, res) => {
  try {
    const { phone, media_url, media_type, caption, filename, file_path } = req.body
    if (!phone || (!media_url && !file_path)) {
      return res.status(400).json({ error: 'phone y media_url o file_path son requeridos.' })
    }

    if (!sock || connectionStatus !== 'CONNECTED') {
      return res.status(503).json({ error: 'WhatsApp no está conectado.', status: connectionStatus })
    }

    const jid = phoneToJid(phone)
    let buffer = null
    let mimetype = 'application/octet-stream'

    if (file_path && fs.existsSync(file_path)) {
      buffer = fs.readFileSync(file_path)
    } else if (media_url) {
      const response = await axios.get(media_url, { responseType: 'arraybuffer' })
      buffer = Buffer.from(response.data)
      mimetype = response.headers['content-type'] || mimetype
    }

    if (!buffer) {
      return res.status(400).json({ error: 'No se pudo obtener el archivo multimedia.' })
    }

    let payload = {}
    if (media_type === 'image' || mimetype.startsWith('image/')) {
      payload = { image: buffer, caption: caption || '', mimetype: 'image/jpeg' }
    } else if (media_type === 'audio' || mimetype.startsWith('audio/')) {
      payload = { audio: buffer, mimetype: 'audio/mp4', ptt: true } // ptt=true envía como nota de voz
    } else {
      // Documento / PDF por defecto
      payload = { 
        document: buffer, 
        mimetype: 'application/pdf', 
        fileName: filename || 'Presupuesto_Medico.pdf', 
        caption: caption || '' 
      }
    }

    const result = await sock.sendMessage(jid, payload)
    addLog('INFO', `Multimedia [${media_type || 'document'}] enviado a +${normalizePhone(phone)}`)

    res.json({
      success: true,
      message_id: result.key.id,
      phone: normalizePhone(phone)
    })
  } catch (error) {
    addLog('ERROR', `Error enviando multimedia: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
})

// 6. Cerrar Sesión y Desvincular
app.post('/logout', async (req, res) => {
  try {
    addLog('INFO', 'Cerrando sesión de WhatsApp...')
    if (sock) {
      try {
        await sock.logout()
      } catch (e) {
        // Ignorar error si ya estaba desconectado
      }
    }
    await initBaileys(true)
    res.json({ success: true, message: 'Sesión cerrada y credenciales eliminadas.' })
  } catch (error) {
    addLog('ERROR', `Error en logout: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
})

// 7. Reiniciar Conexión
app.post('/connect', async (req, res) => {
  const force = req.query.force === 'true'
  addLog('INFO', `Reinicio de conexión solicitado (force=${force})`)
  await initBaileys(force)
  res.json({ success: true, message: 'Conexión iniciada.' })
})

// 8. Logs
app.get('/logs', (req, res) => {
  res.json({ logs: [...logsBuffer].reverse() })
})

// Iniciar servidor Express
app.listen(PORT, '0.0.0.0', () => {
  addLog('INFO', `Microservicio WhatsApp Baileys escuchando en http://0.0.0.0:${PORT}`)
  initBaileys(false)
})
