'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  Lock, 
  Building, 
  User, 
  Hash,
  Loader2
} from 'lucide-react'

import { BACKEND_URL } from '@/lib/api'

export default function PaginaVerificarConsentimiento() {
  const params = useParams()
  const token = params?.token as string

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<any>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!token) return

    async function verificar() {
      try {
        setCargando(true)
        setError(null)
        const baseUrl = BACKEND_URL || 'https://crmagenticonube-production.up.railway.app'
        const res = await fetch(`${baseUrl}/api/consentimiento/verificar/${token}`)
        
        let data: any = null
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          data = await res.json()
        } else {
          const rawText = await res.text()
          try {
            data = JSON.parse(rawText)
          } catch {
            throw new Error(`El servicio de verificación no devolvió un formato válido (HTTP ${res.status}).`)
          }
        }

        if (!res.ok || !data.success) {
          throw new Error(data.detail || 'No se pudo verificar el documento informado.')
        }
        setDatos(data)
      } catch (err: any) {
        setError(err.message || 'Error al conectar con el servicio pericial de verificación.')
      } finally {
        setCargando(false)
      }
    }

    verificar()
  }, [token])

  const copiarHash = () => {
    if (datos?.auditoria?.hash_sha256) {
      navigator.clipboard.writeText(datos.auditoria.hash_sha256)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-emerald-400 mx-auto" size={44} />
          <div className="text-white font-bold text-base">Verificando Evidencia Pericial y Hash Criptográfico...</div>
          <p className="text-slate-400 text-xs">Cotejando firma digital en los servidores de Clínica Médica Nube</p>
        </div>
      </div>
    )
  }

  if (error || !datos) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-red-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle size={36} />
          </div>
          <h1 className="text-lg font-bold text-white">Documento No Verificado</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || 'El código identificador proporcionado no corresponde a un consentimiento emitido o ha caducado.'}
          </p>
        </div>
      </div>
    )
  }

  const { paciente, cirugia, auditoria, pdf_url } = datos

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">

        {/* Encabezado Institucional */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck size={14} />
            <span>Sistema Oficial de Verificación Pericial</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            CLÍNICA MÉDICA NUBE
          </h1>
          <p className="text-xs text-slate-400">
            Plataforma de Firma Electrónica Médica &middot; Ley Nacional 25.506 (Art. 5) y Ley 26.529
          </p>
        </div>

        {/* Tarjeta de Certificación Principal */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">

          {/* Banner de Estado Válido */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
              <CheckCircle2 size={28} />
            </div>
            <div className="text-center sm:text-left space-y-1">
              <div className="text-sm font-black text-emerald-300 uppercase tracking-wide flex items-center justify-center sm:justify-start gap-2">
                <span>DOCUMENTO AUTÉNTICO E INALTERADO</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Este consentimiento informado cuenta con manifestación expresa de voluntad, trazo manuscrito en pantalla y sello criptográfico con fecha cierta inalterable.
              </p>
            </div>
          </div>

          {/* Grilla de Datos Médicos del Paciente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-700/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <User size={13} />
                <span>Titular Firmante</span>
              </div>
              <div className="text-white font-bold text-sm">{paciente?.nombre}</div>
              <div className="text-slate-400 font-mono text-[11px]">D.N.I.: {paciente?.dni}</div>
            </div>

            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-700/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <FileText size={13} />
                <span>Procedimiento Quirúrgico</span>
              </div>
              <div className="text-white font-bold text-sm">{cirugia?.practica}</div>
              <div className="text-emerald-400 font-bold text-[11px]">Lateralidad: {cirugia?.ojo}</div>
            </div>

            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-700/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <Building size={13} />
                <span>Equipo Médico & Sede</span>
              </div>
              <div className="text-slate-200 font-semibold">Dr/a. {cirugia?.cirujano}</div>
              <div className="text-slate-400 text-[11px]">{cirugia?.quirofano}</div>
            </div>

            <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-slate-700/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <Calendar size={13} />
                <span>Fecha Prevista de Cirugía</span>
              </div>
              <div className="text-slate-200 font-semibold">{cirugia?.fecha}</div>
              <div className="text-slate-400 text-[11px]">{cirugia?.hora ? `${cirugia.hora} hs` : 'Horario a confirmar'}</div>
            </div>
          </div>

          {/* Faja Forense y Auditoría Criptográfica */}
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                <Lock size={14} />
                <span>Evidencia Criptográfica & Trazabilidad Forense</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">ART (UTC-3)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400">Fecha y Hora Oficial Argentina:</span>
                <div className="font-bold text-white">{auditoria?.firmado_at_art}</div>
              </div>
              <div>
                <span className="text-slate-400">Sello Timestamp UTC:</span>
                <div className="font-mono text-slate-300">{auditoria?.firmado_at_utc} UTC</div>
              </div>
              <div>
                <span className="text-slate-400">Dirección IP de Origen:</span>
                <div className="font-mono text-slate-300">{auditoria?.ip_origen}</div>
              </div>
              <div>
                <span className="text-slate-400">Marco Jurídico de Homologación:</span>
                <div className="text-emerald-400 font-semibold text-[10px]">Ley 25.506 (Art. 5) &middot; CCCN Art. 288</div>
              </div>
            </div>

            {/* Hash SHA-256 con Botón Copiar */}
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Hash size={11} />
                  <span>Hash Criptográfico de Integridad (SHA-256)</span>
                </span>
                <button
                  type="button"
                  onClick={copiarHash}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copiado ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiado ? 'Copiado al portapapeles' : 'Copiar Hash'}</span>
                </button>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl font-mono text-[10px] text-emerald-400 break-all border border-slate-800 shadow-inner">
                {auditoria?.hash_sha256}
              </div>
            </div>
          </div>

          {/* Botón de Descarga del PDF Oficial */}
          {pdf_url && (
            <a
              href={pdf_url.startsWith('http') ? pdf_url : `${BACKEND_URL || 'https://crmagenticonube-production.up.railway.app'}${pdf_url.startsWith('/') ? '' : '/'}${pdf_url}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow-xl transition-all"
            >
              <Download size={16} />
              <span>Descargar Documento PDF Oficial Certificado</span>
            </a>
          )}

          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            La información contenida en este certificado refleja fielmente los registros inmutables almacenados en la base de datos de auditoría de la institución médica.
          </p>
        </div>

      </div>
    </div>
  )
}
