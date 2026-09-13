'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Building2, MapPin, Phone, Mail, Clock, MessageSquare, Save, CheckCircle2, Upload, Image as ImageIcon, Trash2, Loader2, AlertCircle, RotateCw } from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export default function ClinicProfileCard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [nombre, setNombre] = useState('Centrovisión Oftalmología Integral')
  const [direccion, setDireccion] = useState('Mitre 540, Ciudad de Mendoza, Mendoza')
  const [telefonoGuardia, setTelefonoGuardia] = useState('0800-222-4040')
  const [email, setEmail] = useState('info@centrovision.com.ar')
  const [horarios, setHorarios] = useState('Lunes a Viernes de 08:00 a 19:00 hs. Sábados de 09:00 a 13:00 hs.')
  const [mensajeBienvenida, setMensajeBienvenida] = useState('¡Hola! Gracias por comunicarte con Centrovisión Oftalmología Integral. ¿En qué podemos ayudarte hoy?')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [rotatingLogo, setRotatingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      let clinica: any = null

      try {
        const res = await fetch(`${BACKEND_URL}/api/settings`)
        if (res.ok) {
          const data = await res.json()
          clinica = data.clinica || null
        }
      } catch (apiErr) {
        console.warn('API /api/settings no disponible, consultando Supabase:', apiErr)
      }

      if (!clinica) {
        const { data: dbData } = await (supabase as any)
          .from('configuracion_sistema')
          .select('valor')
          .eq('clave', 'ajustes_crm')
          .maybeSingle()
        if (dbData && dbData.valor) {
          clinica = (dbData.valor as any).clinica || null
        }
      }

      if (clinica) {
        setNombre(clinica.nombre || '')
        setDireccion(clinica.direccion || '')
        setTelefonoGuardia(clinica.telefono_guardia || '')
        setEmail(clinica.email_contacto || '')
        setHorarios(clinica.horarios_atencion || '')
        setMensajeBienvenida(clinica.mensaje_bienvenida || '')
        setLogoUrl(clinica.logo_url || null)
      }
    } catch (err) {
      console.error('Error cargando perfil de la clínica:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setLogoError('El archivo seleccionado debe ser una imagen (PNG, JPG, SVG o WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoError('El archivo excede el tamaño máximo permitido de 5 MB.')
      return
    }

    try {
      setUploadingLogo(true)
      setLogoError(null)

      let uploadedUrl: string | null = null

      // 1. Intentar primero por el endpoint del backend (que guarda copia local y sube a Supabase Storage)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`${BACKEND_URL}/api/settings/upload-logo`, {
          method: 'POST',
          body: formData
        })
        if (res.ok) {
          const data = await res.json()
          uploadedUrl = data.logo_url
        }
      } catch (backendErr) {
        console.warn('Backend upload-logo falló, intentando subida directa a Supabase:', backendErr)
      }

      // 2. Fallback directo a Supabase Storage bucket 'branding' si backend no respondió
      if (!uploadedUrl) {
        const ext = file.name.split('.').pop() || 'png'
        const fileName = `logo_institucional.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('branding')
          .upload(fileName, file, { upsert: true, contentType: file.type })

        if (uploadErr) {
          throw new Error(`Error en subida a Supabase: ${uploadErr.message}`)
        }

        const { data: pubData } = supabase.storage
          .from('branding')
          .getPublicUrl(fileName)

        uploadedUrl = pubData.publicUrl
      }

      if (uploadedUrl) {
        setLogoUrl(uploadedUrl)
        setFeedback('¡Logo institucional subido y propagado correctamente!')
        setTimeout(() => setFeedback(null), 4000)

        // Sincronizar directamente en Supabase configuracion_sistema
        const { data: currentDb } = await (supabase as any)
          .from('configuracion_sistema')
          .select('valor')
          .eq('clave', 'ajustes_crm')
          .maybeSingle()

        const currentVal = (currentDb && currentDb.valor) ? (currentDb.valor as any) : {}
        const newVal = {
          ...currentVal,
          clinica: {
            ...(currentVal.clinica || {}),
            logo_url: uploadedUrl
          },
          plantilla_presupuesto: {
            ...(currentVal.plantilla_presupuesto || {}),
            logo_url: uploadedUrl
          }
        }

        await (supabase as any)
          .from('configuracion_sistema')
          .upsert({
            clave: 'ajustes_crm',
            valor: newVal,
            updated_at: new Date().toISOString(),
            actualizado_por: 'admin_crm'
          })
      }
    } catch (err: any) {
      console.error('Error al subir logo:', err)
      setLogoError(err.message || 'Error al subir la imagen del logo.')
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLogo = async () => {
    try {
      setLogoUrl(null)
      const { data: currentDb } = await (supabase as any)
        .from('configuracion_sistema')
        .select('valor')
        .eq('clave', 'ajustes_crm')
        .maybeSingle()

      const currentVal = (currentDb && currentDb.valor) ? (currentDb.valor as any) : {}
      const newVal = {
        ...currentVal,
        clinica: {
          ...(currentVal.clinica || {}),
          logo_url: ''
        },
        plantilla_presupuesto: {
          ...(currentVal.plantilla_presupuesto || {}),
          logo_url: ''
        }
      }

      await (supabase as any)
        .from('configuracion_sistema')
        .upsert({
          clave: 'ajustes_crm',
          valor: newVal,
          updated_at: new Date().toISOString(),
          actualizado_por: 'admin_crm'
        })

      setFeedback('Logo institucional removido.')
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      console.error('Error removiendo logo:', err)
    }
  }

  const rotateImageViaCanvas = async (imgSrc: string, degrees: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('No se pudo inicializar canvas 2D')

          const rads = (degrees * Math.PI) / 180
          const is90or270 = Math.abs(degrees % 180) === 90
          canvas.width = is90or270 ? img.height : img.width
          canvas.height = is90or270 ? img.width : img.height

          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate(rads)
          ctx.drawImage(img, -img.width / 2, -img.height / 2)

          canvas.toBlob(async (blob) => {
            if (!blob) throw new Error('No se pudo generar blob de imagen')
            const fileName = 'logo_institucional.png'
            const { error: uploadErr } = await supabase.storage
              .from('branding')
              .upload(fileName, blob, { upsert: true, contentType: 'image/png' })

            if (uploadErr) throw uploadErr

            const { data: pubData } = supabase.storage.from('branding').getPublicUrl(fileName)
            const stampedUrl = `${pubData.publicUrl.split('?')[0]}?t=${Date.now()}`

            const { data: currentDb } = await (supabase as any)
              .from('configuracion_sistema')
              .select('valor')
              .eq('clave', 'ajustes_crm')
              .maybeSingle()

            const currentVal = (currentDb && currentDb.valor) ? (currentDb.valor as any) : {}
            const newVal = {
              ...currentVal,
              clinica: { ...(currentVal.clinica || {}), logo_url: stampedUrl },
              plantilla_presupuesto: { ...(currentVal.plantilla_presupuesto || {}), logo_url: stampedUrl }
            }

            await (supabase as any)
              .from('configuracion_sistema')
              .upsert({
                clave: 'ajustes_crm',
                valor: newVal,
                updated_at: new Date().toISOString(),
                actualizado_por: 'admin_crm'
              })

            resolve(stampedUrl)
          }, 'image/png')
        } catch (e) {
          reject(e)
        }
      }
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para rotación'))
      img.src = imgSrc
    })
  }

  const handleRotateLogo = async (degrees = 90) => {
    try {
      setRotatingLogo(true)
      setLogoError(null)

      let newUrl: string | null = null
      try {
        const res = await fetch(`${BACKEND_URL}/api/settings/rotate-logo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ degrees })
        })
        if (res.ok) {
          const data = await res.json()
          newUrl = data.logo_url
        }
      } catch (e) {
        console.warn('Backend rotate-logo no respondió, intentando rotación cliente:', e)
      }

      if (!newUrl && logoUrl) {
        newUrl = await rotateImageViaCanvas(logoUrl, degrees)
      }

      if (newUrl) {
        setLogoUrl(newUrl)
        setFeedback(`¡Logo girado ${degrees}° exitosamente!`)
        setTimeout(() => setFeedback(null), 3500)
      }
    } catch (err: any) {
      console.error('Error al girar logo:', err)
      setLogoError(err.message || 'No se pudo girar la imagen del logo.')
    } finally {
      setRotatingLogo(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setFeedback(null)
      const clinicaPayload = {
        nombre,
        direccion,
        telefono_guardia: telefonoGuardia,
        email_contacto: email,
        horarios_atencion: horarios,
        mensaje_bienvenida: mensajeBienvenida,
        logo_url: logoUrl
      }

      let apiSaved = false
      try {
        const res = await fetch(`${BACKEND_URL}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinica: clinicaPayload })
        })
        if (res.ok) apiSaved = true
      } catch (apiErr) {
        console.warn('API /api/settings no respondió, guardando en Supabase:', apiErr)
      }

      // Sincronización directa en Supabase
      const { data: currentDb } = await (supabase as any)
        .from('configuracion_sistema')
        .select('valor')
        .eq('clave', 'ajustes_crm')
        .maybeSingle()

      const currentVal = (currentDb && currentDb.valor) ? (currentDb.valor as any) : {}
      const newVal = {
        ...currentVal,
        clinica: clinicaPayload
      }

      const { error: dbError } = await (supabase as any)
        .from('configuracion_sistema')
        .upsert({
          clave: 'ajustes_crm',
          valor: newVal,
          updated_at: new Date().toISOString(),
          actualizado_por: 'admin_crm'
        })

      if (apiSaved || !dbError) {
        setFeedback('¡Datos de la clínica actualizados correctamente en la base de datos!')
        setTimeout(() => setFeedback(null), 4000)
      }
    } catch (err) {
      console.error('Error guardando perfil de la clínica:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-600/10 text-blue-600">
            <Building2 size={26} />
          </div>
          <div>
            <h3 className="font-bold text-base">Perfil y Datos Institucionales de la Clínica</h3>
            <p className="text-xs text-[var(--secondary)]">
              Esta información y su imagen de marca se proyectan en presupuestos, consentimientos y respuestas del bot.
            </p>
          </div>
        </div>

        {/* Identidad Visual & Logo Institucional */}
        <div className="p-5 rounded-2xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/20 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-600/10 text-blue-600">
                <ImageIcon size={18} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Logo e Imagen Institucional de la Clínica
                </h4>
                <p className="text-xs text-[var(--secondary)]">
                  Se proyecta automáticamente en: Presupuestos PDF, Consentimientos Web, Protocolos Quirúrgicos y Menú del CRM.
                </p>
              </div>
            </div>
            {logoUrl && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Logo Activo
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)]">
            {/* Visualizador / Preview */}
            <div className="relative w-40 h-24 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-inner">
              {logoUrl ? (
                <img
                  src={logoUrl.startsWith('http') ? logoUrl : `${BACKEND_URL}${logoUrl}`}
                  alt="Logo de la clínica"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-1 text-center">
                  <ImageIcon size={24} />
                  <span className="text-[10px] font-medium">Sin logo cargado</span>
                </div>
              )}
            </div>

            {/* Acciones de Carga */}
            <div className="flex-1 space-y-2 text-center sm:text-left w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={handleLogoFileChange}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Subiendo imagen...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>{logoUrl ? 'Cambiar Logo' : 'Subir Logo Institucional'}</span>
                    </>
                  )}
                </button>

                {logoUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRotateLogo(90)}
                      disabled={uploadingLogo || rotatingLogo}
                      title="Girar imagen 90° en sentido horario"
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-[var(--border)] flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                    >
                      {rotatingLogo ? (
                        <Loader2 size={14} className="animate-spin text-blue-600" />
                      ) : (
                        <RotateCw size={14} className="text-blue-600" />
                      )}
                      <span>Girar 90° ↻</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo || rotatingLogo}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800/40 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      <span>Eliminar</span>
                    </button>
                  </>
                )}
              </div>

              <p className="text-[11px] text-[var(--secondary)]">
                Formatos soportados: PNG, SVG, JPG, WebP. Fondo transparente recomendado. Tamaño máx. 5 MB.
              </p>

              {logoError && (
                <p className="text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle size={14} />
                  <span>{logoError}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Nombre de la Institución Médica
            </label>
            <input 
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Dirección del Consultorio / Sede
            </label>
            <div className="relative">
              <input 
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                required
              />
              <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Teléfono de Guardia / Emergencias
            </label>
            <div className="relative">
              <input 
                type="text"
                value={telefonoGuardia}
                onChange={(e) => setTelefonoGuardia(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <Phone size={16} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
              Email Institucional
            </label>
            <div className="relative">
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
            Horarios de Atención
          </label>
          <div className="relative">
            <input 
              type="text"
              value={horarios}
              onChange={(e) => setHorarios(e.target.value)}
              className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <Clock size={16} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--secondary)] mb-1">
            Mensaje de Bienvenida Inicial
          </label>
          <div className="relative">
            <textarea 
              rows={3}
              value={mensajeBienvenida}
              onChange={(e) => setMensajeBienvenida(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          {feedback && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 glow-primary transition-all shadow-md disabled:opacity-50"
        >
          <Save size={15} />
          <span>{saving ? 'Guardando...' : 'Guardar Datos de la Clínica'}</span>
        </button>
      </div>
    </form>
  )
}
