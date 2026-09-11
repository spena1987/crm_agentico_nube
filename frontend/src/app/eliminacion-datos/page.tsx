'use client'

import React, { useState } from 'react'
import LegalPageLayout from '@/components/legal/LegalPageLayout'
import Link from 'next/link'
import { 
  Trash2, 
  MessageSquare, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Send,
  Loader2,
  FileText
} from 'lucide-react'

export default function EliminacionDatosPage() {
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [motivo, setMotivo] = useState('Deseo no recibir más recordatorios por WhatsApp y eliminar mi historial de chat')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [codigoSeguimiento, setCodigoSeguimiento] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulación de generación de ticket de eliminación ARCO
    setTimeout(() => {
      const randomCode = 'DEL-' + Math.floor(100000 + Math.random() * 900000)
      setCodigoSeguimiento(randomCode)
      setLoading(false)
      setEnviado(true)
    }, 1200)
  }

  return (
    <LegalPageLayout
      title="Instrucciones para la Eliminación de Datos de Usuario"
      subtitle="Guía oficial conforme a los requerimientos de Meta Platforms y normativas de protección de datos personales para solicitar la supresión de información de WhatsApp y CRM."
      lastUpdated="11 de Septiembre de 2026"
    >
      <div className="space-y-10 text-slate-700 text-sm leading-relaxed">
        {/* Banner de Meta Developers Compliance */}
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">Cumplimiento con Meta WhatsApp Business Platform</span>
            Esta página proporciona las instrucciones exigidas por Meta (User Data Deletion Instructions) para que cualquier paciente o titular de datos ejerza su derecho a la supresión o bloqueo de sus datos de contacto e interacciones en WhatsApp.
          </div>
        </div>

        {/* Canales Disponibles para Solicitar la Eliminación */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
            ¿Cómo solicitar la eliminación de sus datos?
          </h2>
          <p>
            Usted puede solicitar la eliminación de su número telefónico y registros de chat asociados a través de cualquiera de los siguientes dos métodos simples:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Método 1: Por WhatsApp */}
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span>Opción 1: Directo por WhatsApp</span>
              </div>
              <p className="text-xs text-slate-600">
                Es el método más ágil y no requiere completar formularios adicionales:
              </p>
              <ol className="list-decimal pl-5 text-xs text-slate-700 space-y-2">
                <li>Abra el chat oficial de la clínica en su aplicación de WhatsApp.</li>
                <li>Escriba y envíe un mensaje con la palabra <strong className="text-emerald-700 font-mono text-sm bg-emerald-100/60 px-1.5 py-0.5 rounded">BAJA</strong> o <strong className="text-emerald-700 font-mono text-sm bg-emerald-100/60 px-1.5 py-0.5 rounded">ELIMINAR MIS DATOS</strong>.</li>
                <li>El sistema automatizado confirmará la recepción de su solicitud y suspenderá inmediatamente los recordatorios automáticos de turnos.</li>
                <li>En un plazo máximo de 48 horas hábiles, el personal administrativo purgará las conversaciones temporales asociadas a su línea.</li>
              </ol>
            </div>

            {/* Método 2: Por Correo Electrónico */}
            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-3">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-base">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Mail className="w-5 h-5" />
                </div>
                <span>Opción 2: Correo de Privacidad</span>
              </div>
              <p className="text-xs text-slate-600">
                Para solicitudes formales por escrito o consultas específicas:
              </p>
              <ol className="list-decimal pl-5 text-xs text-slate-700 space-y-2">
                <li>Envíe un email a <strong className="text-blue-700 font-mono text-xs">privacidad@centromediconube.com</strong>.</li>
                <li>Asunto: <span className="italic font-medium">"Solicitud de Supresión de Datos - WhatsApp"</span>.</li>
                <li>Indique su nombre completo, número de DNI y el número de celular que desea desvincular.</li>
                <li>Recibirá una constancia de procesamiento con número de expediente en un plazo no mayor a 5 días hábiles.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Formulario en línea de solicitud directa */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">
            Formulario en Línea de Solicitud de Supresión
          </h2>
          <p className="text-xs text-slate-600">
            También puede iniciar su trámite directamente desde este sitio web para generar un número de seguimiento:
          </p>

          {enviado ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold">¡Solicitud Registrada con Éxito!</h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                Hemos recibido su pedido de eliminación. Su número de seguimiento es:
              </p>
              <div className="inline-block py-2 px-4 rounded-xl bg-white border border-emerald-300 font-mono font-bold text-emerald-700 text-lg shadow-sm">
                {codigoSeguimiento}
              </div>
              <p className="text-xs text-slate-500 pt-2">
                Su número telefónico ha sido ingresado en la lista de exclusión de mensajería (Do Not Contact) y sus registros de chat serán purgados en un lapso de 48 a 72 horas hábiles.
              </p>
              <button
                onClick={() => setEnviado(false)}
                type="button"
                className="mt-2 text-xs text-blue-600 hover:underline font-medium"
              >
                Enviar otra solicitud
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Número de WhatsApp a desvincular *</label>
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. +54 9 11 1234-5678"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">DNI / Documento de Identidad *</label>
                  <input
                    type="text"
                    required
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ej. 30123456"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Alcance de la Solicitud</label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Deseo no recibir más recordatorios por WhatsApp y eliminar mi historial de chat">
                      Eliminar historial de WhatsApp y bloquear notificaciones
                    </option>
                    <option value="Eliminación integral de cuenta y datos de contacto del CRM">
                      Eliminación de datos de contacto del CRM
                    </option>
                    <option value="Revocación de consentimiento para comunicaciones">
                      Revocación de consentimiento
                    </option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registrando solicitud...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Solicitud de Eliminación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Explicación de Datos Eliminables vs Obligaciones Sanitarias */}
        <section className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            Alcance Legal y Datos Sujetos a Conservación Médica
          </h2>
          <p className="text-xs text-slate-600">
            Al procesar su solicitud de eliminación, distinguimos entre los datos de telecomunicación y los registros médicos obligatorios:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Datos que se ELIMINAN de inmediato:</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Historial de mensajes y chats mantenidos por WhatsApp.</li>
                <li>• Identificadores de sesión y caché de mensajes temporales.</li>
                <li>• Número telefónico de las listas de recordatorios automatizados.</li>
                <li>• Presupuestos y cotizaciones preliminares no formalizados.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Datos conservados por Obligación Legal:</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Historias Clínicas y evoluciones médicas formalizadas (plazo legal de 10 años conforme a la Ley 26.529).</li>
                <li>• Facturas y comprobantes fiscales de pago según exigencias de AFIP/ARCA.</li>
                <li>• Consentimientos quirúrgicos efectivamente firmados y ejecutados.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </LegalPageLayout>
  )
}
