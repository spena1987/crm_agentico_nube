import React from 'react'
import type { Metadata } from 'next'
import LegalPageLayout from '@/components/legal/LegalPageLayout'
import Link from 'next/link'
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  MessageSquare, 
  PhoneCall, 
  Clock, 
  Stethoscope
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Términos y Condiciones del Servicio | WhatsApp Cloud API & CRM',
  description: 'Términos y condiciones de uso del canal oficial de WhatsApp y servicios asociados de gestión médica.',
}

export default function TerminosCondicionesPage() {
  return (
    <LegalPageLayout
      title="Términos y Condiciones del Servicio"
      subtitle="Condiciones generales de uso para el canal oficial de WhatsApp Business y servicios de comunicación asistencial."
      lastUpdated="11 de Septiembre de 2026"
    >
      <div className="prose prose-slate max-w-none space-y-10 text-sm leading-relaxed text-slate-700">
        {/* Banner de Aviso de Emergencias */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 not-prose flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold block text-sm mb-1 text-amber-950">Aviso Crítico: Canal No Apto para Urgencias Médicas</span>
            El canal de WhatsApp no debe emplearse bajo ninguna circunstancia para situaciones de emergencia, riesgo de vida o cuadros clínicos agudos que requieran intervención inmediata. Ante una urgencia médica, llame al <strong>107</strong> o <strong>911</strong> o concurra sin demora a la guardia médica hospitalaria más cercana.
          </div>
        </div>

        {/* 1. Objeto del Servicio */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            1. Objeto y Alcance del Canal de WhatsApp
          </h2>
          <p>
            El canal oficial de WhatsApp de la institución médica tiene por finalidad facilitar la comunicación administrativa, 
            la coordinación de turnos médicos, el envío de recordatorios, la orientación sobre preparación para estudios y la 
            remisión de presupuestos quirúrgicos y consentimientos informados solicitados voluntariamente por los pacientes.
          </p>
          <p>
            La interacción con este canal implica la aceptación plena y sin reservas de los presentes Términos y Condiciones, 
            así como de nuestra <Link href="/politica-privacidad" className="text-blue-600 hover:underline font-semibold">Política de Privacidad</Link>.
          </p>
        </section>

        {/* 2. Asistencia Automatizada e Inteligencia Artificial */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            2. Asistencia Asistida por Inteligencia Artificial y Supervisión Humana
          </h2>
          <p>
            El usuario reconoce y acepta que los mensajes iniciales y respuestas a dudas frecuentes pueden ser generados o clasificados 
            mediante tecnologías de Inteligencia Artificial (Google Gemini) supervisadas por nuestro equipo médico y administrativo.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li>La información brindada por el bot inteligente tiene carácter puramente orientativo y administrativo.</li>
            <li>En ningún caso las respuestas automáticas constituyen un diagnóstico definitivo, prescripción médica o tratamiento clínico vinculante.</li>
            <li>En cualquier momento, el paciente puede solicitar la intervención directa de un operador humano escribiendo palabras como "asesor", "operador" o "humano".</li>
          </ul>
        </section>

        {/* 3. Compromisos y Responsabilidad del Usuario */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            3. Obligaciones y Exactitud de la Información
          </h2>
          <p>
            El paciente o usuario se compromete a:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
            <li>Suministrar información verídica, actualizada y exacta relativa a su identidad (Nombre, DNI, Cobertura Médica).</li>
            <li>Mantener la custodia y privacidad de su dispositivo móvil y de su cuenta de WhatsApp para evitar accesos no autorizados a información médica personal.</li>
            <li>No utilizar el servicio con fines fraudulentos, envío de material ofensivo o actividades que perjudiquen la infraestructura del servicio.</li>
          </ul>
        </section>

        {/* 4. Turnos Médicos y Presupuestos */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            4. Confirmación de Turnos y Validez de Presupuestos
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
            <li><strong>Turnos Médicos:</strong> La confirmación o cancelación de turnos a través de los botones interactivos de WhatsApp tiene validez formal en la agenda del centro médico.</li>
            <li><strong>Presupuestos Quirúrgicos:</strong> Las cotizaciones remitidas vía WhatsApp o enlaces en PDF tienen un plazo de validez expresamente especificado en cada documento (generalmente 15 a 30 días corridos) y están sujetas a la evaluación clínica presencial del cirujano o médico tratante.</li>
          </ul>
        </section>

        {/* 5. Modificaciones del Servicio */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            5. Disponibilidad y Modificaciones
          </h2>
          <p>
            La institución médica se reserva el derecho de modificar, suspender temporalmente o actualizar las funcionalidades del 
            canal de WhatsApp o del CRM con el propósito de realizar mantenimientos técnicos o mejoras en la seguridad del servicio.
          </p>
        </section>

        {/* 6. Contacto Legal */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
            6. Legislación Aplicable y Jurisdicción
          </h2>
          <p>
            Los presentes Términos y Condiciones se rigen por las leyes de la República Argentina y las regulaciones sanitarias de ejercicio de la medicina. 
            Ante cualquier controversia, las partes se someten a los tribunales ordinarios competentes del domicilio del centro médico.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  )
}
