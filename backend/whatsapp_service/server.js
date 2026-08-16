import express from 'express'
import cors from 'cors'
import qrcode from 'qrcode'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pino from 'pino'
import dotenv from 'dotenv'
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  isLidUser,
  downloadMediaMessage
} from '@whiskeysockets/baileys'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config({ path: path.join(__dirname, '../../.env') })

const PORT = process.env.WHATSAPP_SERVICE_PORT || 3001
const FASTAPI_PORT = process.env.PORT || 8000
const FASTAPI_WEBHOOK = process.env.FASTAPI_WEBHOOK_URL || `http://127.0.0.1:${FASTAPI_PORT}/api/whatsapp/webhook/incoming`
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
let isInitializing = false
let reconnectTimeout = null
const lidToPhoneMap = new Map()
let lastContactedPhone = null

const LID_MAP_FILE = path.join(SESSIONS_DIR, 'lid_mappings.json')

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://ppbgmkxxpeuiutvuynaw.supabase.co').replace(/\/$/, '')
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

// 1. Restaurar todos los archivos de sesión desde Supabase PostgreSQL
async function restoreSessionsFromSupabase() {
  if (!SUPABASE_KEY) {
    addLog('WARNING', 'SUPABASE_KEY no configurado para persistencia remota de sesiones.')
    return false
  }
  try {
    const url = `${SUPABASE_URL}/rest/v1/whatsapp_sessions?select=key,value`
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
    const response = await axios.get(url, { headers, timeout: 8000 })
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true })
      }
      let restoredCount = 0
      for (const item of response.data) {
        if (item.key && item.value) {
          const filePath = path.join(SESSIONS_DIR, item.key)
          fs.writeFileSync(filePath, JSON.stringify(item.value, null, 2), 'utf-8')
          restoredCount++
        }
      }
      addLog('INFO', `✔ Sesión persistente restaurada desde Supabase (${restoredCount} archivos). Vinculación preservada.`)
      loadLidMappings()
      return true
    }
  } catch (e) {
    addLog('WARNING', `No se pudo restaurar sesión desde Supabase: ${e.message}`)
  }
  return false
}

// 2. Sincronizar directorio local de sesiones hacia Supabase PostgreSQL
let isSyncingToSupabase = false
async function syncSessionsToSupabase() {
  if (!SUPABASE_KEY || !fs.existsSync(SESSIONS_DIR) || isSyncingToSupabase) return
  try {
    isSyncingToSupabase = true
    const files = fs.readdirSync(SESSIONS_DIR)
    const items = []
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const rawContent = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8')
        const content = JSON.parse(rawContent)
        items.push({
          key: file,
          value: content,
          updated_at: new Date().toISOString()
        })
      } catch (err) {}
    }

    if (items.length > 0) {
      const url = `${SUPABASE_URL}/rest/v1/whatsapp_sessions`
      const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      }
      await axios.post(url, items, { headers, timeout: 10000 })
    }
  } catch (e) {
    addLog('WARNING', `Error sincronizando sesión a Supabase: ${e.message}`)
  } finally {
    isSyncingToSupabase = false
  }
}

// 3. Eliminar sesión de Supabase al hacer logout
async function clearSessionsFromSupabase() {
  if (!SUPABASE_KEY) return
  try {
    const url = `${SUPABASE_URL}/rest/v1/whatsapp_sessions?key=neq.`
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
    await axios.delete(url, { headers, timeout: 8000 })
    addLog('INFO', 'Credenciales de sesión eliminadas de Supabase.')
  } catch (e) {
    addLog('WARNING', `Error eliminando sesión de Supabase: ${e.message}`)
  }
}

// 4. Subir archivo multimedia desencriptado a Supabase Storage (Bucket: whatsapp-media)
async function uploadMediaToSupabaseStorage(buffer, filename, mimetype) {
  if (!SUPABASE_KEY || !buffer || buffer.length === 0) return null
  try {
    const cleanName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `media/${Date.now()}_${cleanName}`
    const url = `${SUPABASE_URL}/storage/v1/object/whatsapp-media/${storagePath}`
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': mimetype || 'application/octet-stream',
      'x-upsert': 'true'
    }
    const resp = await axios.post(url, buffer, {
      headers,
      timeout: 25000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    })
    if (resp.status === 200 || resp.status === 201) {
      return `${SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${storagePath}`
    }
  } catch (e) {
    addLog('WARNING', `Error subiendo multimedia a Supabase Storage: ${e.message}`)
  }
  return null
}

function loadLidMappings() {
  try {
    if (fs.existsSync(LID_MAP_FILE)) {
      const data = JSON.parse(fs.readFileSync(LID_MAP_FILE, 'utf-8'))
      for (const [lid, phone] of Object.entries(data)) {
        if (lid && phone) {
          lidToPhoneMap.set(String(lid).replace(/\D/g, ''), normalizePhone(phone))
        }
      }
    }
  } catch (e) {
    addLog('WARNING', `No se pudieron cargar mapeos de LID: ${e.message}`)
  }
  // Mapeo conocido por defecto para el dispositivo de prueba
  if (!lidToPhoneMap.has('194149819109552')) {
    lidToPhoneMap.set('194149819109552', '5492614703230')
  }
}

function saveLidMapping(lid, phone) {
  if (!lid || !phone) return
  const cleanLid = String(lid).replace(/\D/g, '')
  const cleanPhone = normalizePhone(phone)
  if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return
  
  lidToPhoneMap.set(cleanLid, cleanPhone)
  try {
    const obj = {}
    for (const [k, v] of lidToPhoneMap.entries()) {
      obj[k] = v
    }
    fs.writeFileSync(LID_MAP_FILE, JSON.stringify(obj, null, 2), 'utf-8')
    addLog('INFO', `LID ${cleanLid} vinculado exitosamente a teléfono +${cleanPhone}`)
    syncSessionsToSupabase()
  } catch (e) {
    addLog('WARNING', `Error guardando mapeo de LID en disco: ${e.message}`)
  }
}

loadLidMappings()

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

async function getValidJid(phone) {
  const clean = normalizePhone(phone)
  const candidateJid = `${clean}@s.whatsapp.net`
  
  if (!sock) return candidateJid

  try {
    const results = await sock.onWhatsApp(candidateJid)
    if (results && results.length > 0 && results[0].exists) {
      return results[0].jid
    }
  } catch (e) {
    addLog('WARNING', `onWhatsApp check falló para ${candidateJid}: ${e.message}`)
  }

  // Para cuentas de Argentina creadas sin el 9
  if (clean.startsWith('549')) {
    const fallbackWithout9 = '54' + clean.slice(3) + '@s.whatsapp.net'
    try {
      const results = await sock.onWhatsApp(fallbackWithout9)
      if (results && results.length > 0 && results[0].exists) {
        addLog('INFO', `Destinatario WhatsApp resuelto como: ${results[0].jid}`)
        return results[0].jid
      }
    } catch (e) {}
  }

  return candidateJid
}

async function initBaileys(forceClean = false) {
  if (isInitializing) return
  isInitializing = true

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  try {
    if (sock) {
      try {
        sock.ev.removeAllListeners('connection.update')
        sock.ev.removeAllListeners('creds.update')
        sock.ev.removeAllListeners('messages.upsert')
        sock.end(undefined)
      } catch (e) {}
      sock = null
    }

    if (forceClean) {
      addLog('INFO', 'Limpiando sesión previa para nueva vinculación...')
      await clearSessionsFromSupabase()
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
    } else {
      // Restaurar credenciales desde Supabase si la carpeta local no tiene creds.json (ej: nuevo deploy)
      if (!fs.existsSync(path.join(SESSIONS_DIR, 'creds.json'))) {
        await restoreSessionsFromSupabase()
      }
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
      syncFullHistory: false,
      markOnlineOnConnect: true
    })

    // Guardar credenciales de sesión automáticamente en disco y respaldar en Supabase
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds()
        syncSessionsToSupabase()
      } catch (err) {
        addLog('WARNING', `Error guardando credenciales: ${err.message}`)
      }
    })

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
        
        const userJid = sock?.user?.id || ''
        const cleanPhone = userJid.split(':')[0].split('@')[0]
        deviceInfo = {
          phone: cleanPhone,
          push_name: sock?.user?.name || 'Dispositivo WhatsApp',
          business_name: sock?.user?.name || null,
          platform: 'WhatsApp Multi-Device Baileys',
          jid: userJid,
          connected_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        }
        addLog('INFO', `¡Conexión abierta y autenticada con WhatsApp! Teléfono: +${cleanPhone}`)
        syncSessionsToSupabase()
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        addLog('WARNING', `Conexión cerrada. Código: ${statusCode}.`)

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'DISCONNECTED'
          addLog('INFO', 'Sesión cerrada formalmente. Reiniciando almacenamiento...')
          initBaileys(true)
        } else if (statusCode === 440) {
          connectionStatus = 'DISCONNECTED'
          addLog('WARNING', 'Conflicto de sesión (440 - connectionReplaced). Esperando 12s para estabilizar...')
          reconnectTimeout = setTimeout(() => initBaileys(false), 12000)
        } else {
          connectionStatus = 'INITIALIZING'
          reconnectTimeout = setTimeout(() => initBaileys(false), 4000)
        }
      }
    })

    // Manejo de mensajes entrantes (Reenvío al Webhook de FastAPI con deduplicación)
    const processedMessageIds = new Set()

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const msg of messages) {
        try {
          if (!msg.message) continue
          const messageId = msg.key?.id
          if (messageId) {
            if (processedMessageIds.has(messageId)) {
              continue
            }
            processedMessageIds.add(messageId)
            if (processedMessageIds.size > 2000) {
              const first = processedMessageIds.values().next().value
              processedMessageIds.delete(first)
            }
          }

          const remoteJid = msg.key.remoteJid || ''
          
          // Ignorar estados y listas de difusión
          if (remoteJid === 'status@broadcast' || remoteJid.includes('@newsletter') || remoteJid.includes('@broadcast')) {
            continue
          }

          const fromMe = Boolean(msg.key.fromMe)
          
          // Resolución inteligente de JID / Teléfono (incluyendo LIDs de WhatsApp)
          let rawJid = msg.key.remoteJidAlt || msg.key.participant || remoteJid || ''
          let senderPhone = rawJid.split('@')[0].split(':')[0]
          const isLid = isLidUser(remoteJid) || remoteJid.includes('@lid') || rawJid.includes('@lid')
          const lidDigits = (remoteJid.includes('@lid') ? remoteJid : rawJid).split('@')[0].split(':')[0]

          if (isLid || senderPhone.length > 14 || !senderPhone.startsWith('54')) {
            if (msg.key.remoteJidAlt && !msg.key.remoteJidAlt.includes('@lid')) {
              senderPhone = normalizePhone(msg.key.remoteJidAlt)
              saveLidMapping(lidDigits, senderPhone)
            } else if (msg.key.participant && !msg.key.participant.includes('@lid')) {
              senderPhone = normalizePhone(msg.key.participant)
              saveLidMapping(lidDigits, senderPhone)
            } else if (lidToPhoneMap.has(lidDigits)) {
              senderPhone = lidToPhoneMap.get(lidDigits)
              addLog('INFO', `LID ${lidDigits} resuelto exitosamente desde mapa a teléfono +${senderPhone}`)
            } else if (lastContactedPhone) {
              senderPhone = lastContactedPhone
              saveLidMapping(lidDigits, lastContactedPhone)
            }
          } else {
            if (remoteJid.includes('@lid')) {
              saveLidMapping(lidDigits, senderPhone)
            }
          }
          
          // Extraer texto
          let text = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     msg.message?.imageMessage?.caption || 
                     msg.message?.documentMessage?.caption || 
                     msg.message?.videoMessage?.caption || ''

          // Determinar tipo de mensaje y procesar multimedia
          let messageType = 'text'
          let mediaInfo = null

          const isMedia = Boolean(
            msg.message.imageMessage || 
            msg.message.documentMessage || 
            msg.message.documentWithCaptionMessage || 
            msg.message.audioMessage || 
            msg.message.videoMessage || 
            msg.message.stickerMessage
          )

          if (isMedia) {
            try {
              let mediaBuffer = null
              try {
                mediaBuffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {},
                  { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                )
              } catch (dlErr) {
                addLog('WARNING', `Error descargando buffer de media: ${dlErr.message}`)
              }

              let mimeType = 'application/octet-stream'
              let fileName = 'archivo.bin'
              let tipo = 'documento'

              if (msg.message.imageMessage) {
                messageType = 'image'
                tipo = 'imagen'
                mimeType = msg.message.imageMessage.mimetype || 'image/jpeg'
                fileName = `imagen_${Date.now()}.jpg`
              } else if (msg.message.audioMessage) {
                messageType = 'audio'
                tipo = 'audio'
                mimeType = msg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus'
                fileName = `audio_${Date.now()}.ogg`
              } else if (msg.message.documentMessage || msg.message.documentWithCaptionMessage) {
                messageType = 'document'
                tipo = 'documento'
                const doc = msg.message.documentMessage || msg.message.documentWithCaptionMessage?.message?.documentMessage
                mimeType = doc?.mimetype || 'application/pdf'
                fileName = doc?.fileName || doc?.title || `documento_${Date.now()}.pdf`
              } else if (msg.message.videoMessage) {
                messageType = 'video'
                tipo = 'video'
                mimeType = msg.message.videoMessage.mimetype || 'video/mp4'
                fileName = `video_${Date.now()}.mp4`
              } else if (msg.message.stickerMessage) {
                messageType = 'sticker'
                tipo = 'sticker'
                mimeType = msg.message.stickerMessage.mimetype || 'image/webp'
                fileName = `sticker_${Date.now()}.webp`
              }

              let mediaUrl = null
              if (mediaBuffer && mediaBuffer.length > 0) {
                mediaUrl = await uploadMediaToSupabaseStorage(mediaBuffer, fileName, mimeType)
                addLog('INFO', `Archivo [${tipo}] subido exitosamente a Supabase Storage: ${fileName}`)
              }

              mediaInfo = {
                tipo,
                media_url: mediaUrl,
                file_name: fileName,
                mime_type: mimeType,
                file_size_bytes: mediaBuffer ? mediaBuffer.length : 0,
                caption: text,
                is_voice_note: Boolean(msg.message.audioMessage?.ptt)
              }
            } catch (mediaErr) {
              addLog('WARNING', `Error procesando media adjunto: ${mediaErr.message}`)
            }
          }

          addLog('INFO', `Mensaje recibido de +${senderPhone} [${messageType}]: ${text ? text.substring(0, 40) : `[${messageType.toUpperCase()}]`}`)

          // Despachar al webhook dinámico de FastAPI con metadatos multimedia
          axios.post(FASTAPI_WEBHOOK, {
            message_id: msg.key.id,
            from_me: fromMe,
            phone: senderPhone,
            jid: remoteJid,
            name: msg.pushName || 'Paciente',
            text: text,
            message_type: messageType,
            media: mediaInfo,
            timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000),
            raw_message: msg
          }).catch(err => {
            addLog('WARNING', `Webhook FastAPI no disponible (${FASTAPI_WEBHOOK}): ${err.message}`)
          })

        } catch (msgErr) {
          addLog('ERROR', `Error procesando mensaje entrante: ${msgErr.message}`)
        }
      }
    })

  } catch (error) {
    connectionStatus = 'ERROR'
    addLog('ERROR', `Error al inicializar Baileys: ${error.message}`)
  } finally {
    isInitializing = false
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

    const cleanNormPhone = normalizePhone(phone)
    lastContactedPhone = cleanNormPhone
    const jid = await getValidJid(phone)
    const result = await sock.sendMessage(jid, { text })

    // Si el socket resolvió o devolvió un LID, asociarlo
    if (result && result.key && result.key.remoteJid && result.key.remoteJid.includes('@lid')) {
      const lidD = result.key.remoteJid.split('@')[0].split(':')[0]
      saveLidMapping(lidD, cleanNormPhone)
    }

    addLog('INFO', `Mensaje enviado a ${jid}: ${text.substring(0, 50)}...`)
    res.json({
      success: true,
      message_id: result.key.id,
      jid,
      phone: cleanNormPhone
    })
  } catch (error) {
    addLog('ERROR', `Error enviando mensaje: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
})

// Vincular manualmente o desde backend un LID a un teléfono
app.post('/link-lid', (req, res) => {
  const { lid, phone } = req.body
  if (!lid || !phone) {
    return res.status(400).json({ error: 'lid y phone requeridos' })
  }
  saveLidMapping(lid, phone)
  res.json({ success: true, lid: String(lid).replace(/\D/g, ''), phone: normalizePhone(phone) })
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

    const jid = await getValidJid(phone)
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
    addLog('INFO', `Multimedia [${media_type || 'document'}] enviado a ${jid}`)

    res.json({
      success: true,
      message_id: result.key.id,
      jid,
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
