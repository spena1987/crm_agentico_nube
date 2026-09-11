import React from 'react'
import type { Metadata } from 'next'
import LegalPageLayout from '@/components/legal/LegalPageLayout'
import Link from 'next/link'
import { 
  ShieldCheck, 
  FileText, 
  Cpu, 
  Server, 
  Lock, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Database,
  Eye,
  MessageSquare
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Política de Privacidad | WhatsApp Cloud API & CRM Clínico',
  description: 'Política de Privacidad y Tratamiento de Datos Personales del canal oficial de WhatsApp y CRM Clínico.',
}

export default function PoliticaPrivacidadPage() {
  return (
    <LegalPageLayout
      title="Política de Privacidad y Protección de Datos"
      subtitle="Tratamiento transparente y seguro de datos personales y médicos a través de nuestro canal oficial de WhatsApp Cloud API y plataforma CRM."
      lastUpdated="11 de Septiembre de 2026"
    >
      <div className="prose prose-slate max-w-none space-y-10">
        {/* Resumen Ejecutivo */}
        <div className="p-5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 text-sm leading-relaxed not-prose">
          <div className="flex items-center gap-2 font-bold text-blue-900 mb-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Compromiso de Privacidad y Confidencialidad Médica</span>
          </div>
          <p>
            Nuestra institución médica valora y respeta la confidencialidad de su información personal y de salud. 
            Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y protegemos sus datos 
            cuando interactúa con nuestro <strong>Canal Oficial de WhatsApp Business</strong> y nuestros servicios de gestión clínica (CRM), 
            en estricto cumplimiento con la <strong>Ley 25.326 de Protección de los Datos Personales</strong>, los lineamientos oficiales 
            de <strong>Meta WhatsApp Business Platform</strong> y las normas sanitarias de confidencialidad médico-asistencial.
          </p>
        </div>

        {/* 1. Responsable del Tratamiento */}
        <section id="responsable" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">1</span>
            Responsable del Tratamiento de sus Datos
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            El responsable del tratamiento de los datos personales obtenidos a través de este canal de mensajería y del CRM es 
            la entidad prestadora de salud debidamente habilitada ante las autoridades sanitarias correspondientes. 
            Para cualquier consulta, reclamo o ejercicio de sus derechos de protección de datos personales, puede dirigirse 
            formalmente a nuestra casilla de cumplimiento:
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-1 text-slate-700">
            <p><strong>Entidad:</strong> Centro Médico / Clínica Médica Responsable</p>
            <p><strong>Canal de Privacidad & DPO:</strong> <span className="font-mono text-blue-600 font-semibold">privacidad@centromediconube.com</span></p>
            <p><strong>Finalidad del Canal:</strong> Coordinación asistencial, confirmación de turnos médicos, asesoramiento quirúrgico y orientación clínica al paciente.</p>
          </div>
        </section>

        {/* 2. Alcance del Canal de WhatsApp Business Cloud API */}
        <section id="alcance" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">2</span>
            Alcance del Canal Oficial de WhatsApp
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            Nuestro número corporativo verificado de WhatsApp opera mediante la <strong>WhatsApp Cloud API oficial de Meta Platforms, Inc.</strong> 
            Este canal tiene fines exclusivamente informativos, administrativos y de asistencia en la gestión médica de los pacientes:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
            <li><strong>Recordatorios de Turnos (Categoría Utility):</strong> Notificaciones de fecha, hora, profesional y sede de turnos médicos previamente solicitados, con botones de confirmación o cancelación inmediata.</li>
            <li><strong>Presupuestos y Cotizaciones Quirúrgicas:</strong> Envío a solicitud del paciente de presupuestos formales para cirugías y estudios oftalmológicos/médicos.</li>
            <li><strong>Envío de Consentimientos Informados:</strong> Enlaces seguros y temporales para que el paciente revise y suscriba consentimientos quirúrgicos.</li>
            <li><strong>Asistencia Administrativa y Triaje de Consultas:</strong> Respuestas a consultas frecuentes (horarios, ubicación, preparación para estudios) mediante agentes asistidos por Inteligencia Artificial y personal administrativo.</li>
          </ul>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 mt-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>Aviso de Urgencias Médicas:</strong> Este canal de WhatsApp NO constituye un servicio de urgencias médicas ni guardia médica 24 horas. 
              En caso de encontrarse ante una emergencia médica que comprometa su vida o salud, comuníquese inmediatamente al 107 / 911 o acuda al centro hospitalario de guardia más cercano.
            </p>
          </div>
        </section>

        {/* 3. Datos Personales Recopilados */}
        <section id="datos" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">3</span>
            Datos Personales que Recopilamos
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            Únicamente recopilamos los datos estrictamente necesarios para brindar el servicio asistencial solicitado por el usuario:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 not-prose">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Datos Identificatorios</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Número de teléfono celular (MSISDN)</li>
                <li>• Nombre de perfil de WhatsApp</li>
                <li>• Nombre y apellido completo del paciente</li>
                <li>• Número de DNI / Documento</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Datos Clínicos y Cobertura</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Cobertura médica / Obra social y plan</li>
                <li>• Motivo de consulta o especialidad</li>
                <li>• Prácticas médicas presupuestadas</li>
                <li>• Estudios adjuntados voluntariamente</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <Server className="w-4 h-4 text-purple-600" />
                <span>Metadatos Técnicos</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Identificador de mensaje de Meta (`wamid`)</li>
                <li>• Marcas de tiempo (envío, entrega, lectura)</li>
                <li>• Interacciones con botones rápidos</li>
                <li>• Estado de la conversación (activa / en espera)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 4. Finalidades del Tratamiento y Base Legal */}
        <section id="finalidades" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">4</span>
            Finalidad y Base Legal del Tratamiento
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            La base legal principal para el tratamiento de sus datos es su <strong>consentimiento expreso</strong> al iniciar una conversación 
            en nuestro canal de WhatsApp o al solicitar un turno o presupuesto, así como la <strong>ejecución de la relación asistencial médico-paciente</strong>.
          </p>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Sus datos se utilizan exclusivamente para:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Responder a sus consultas asistenciales y derivar su caso al profesional médico adecuado.</li>
              <li>Coordinar, agendar y recordarle oportunamente turnos médicos y quirúrgicos.</li>
              <li>Elaborar y enviarle presupuestos informativos sobre cirugías y estudios diagnósticos.</li>
              <li>Permitirle acceder y firmar de manera remota y segura consentimientos informados requeridos para sus procedimientos.</li>
              <li>Mantener el registro clínico y administrativo de la atención médica de conformidad con la ley de ejercicio de la medicina.</li>
            </ol>
            <p className="pt-2 font-medium text-slate-800">
              ❌ Bajo ninguna circunstancia vendemos, alquilamos ni comercializamos sus datos personales ni números telefónicos a terceros para fines publicitarios o ajenos a su atención clínica.
            </p>
          </div>
        </section>

        {/* 5. Subprocesadores Tecnológicos y Uso de Inteligencia Artificial */}
        <section id="subprocesadores" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">5</span>
            Proveedores Tecnológicos y Uso de Inteligencia Artificial
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            Para garantizar la más alta disponibilidad, seguridad y capacidad de respuesta 24/7, el CRM y el canal de WhatsApp 
            integran proveedores tecnológicos líderes bajo estrictos acuerdos de confidencialidad y procesamiento seguro de datos:
          </p>

          <div className="space-y-3 not-prose">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="text-sm space-y-1">
                <div className="font-bold text-slate-900">Meta Platforms, Inc. (WhatsApp Cloud API)</div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Provee la infraestructura de telecomunicaciones y entrega de mensajería empresarial en la nube con cifrado 
                  en tránsito mediante protocolo Signal y TLS. Cumple con los estándares internacionales de seguridad SOC 2 / ISO 27001.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="text-sm space-y-1">
                <div className="font-bold text-slate-900">Google Cloud (Google Gemini Enterprise API)</div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Asiste en la comprensión de lenguaje natural para categorizar consultas de pacientes, interpretar fechas de turnos 
                  y redactar respuestas asistenciales preliminares. <strong>Garantía de Privacidad de Google Cloud:</strong> Los datos, consultas y 
                  mensajes procesados mediante la API empresarial <em>NUNCA son utilizados por Google para entrenar sus modelos públicos de inteligencia artificial</em>.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="text-sm space-y-1">
                <div className="font-bold text-slate-900">Supabase Inc. (Base de Datos en la Nube con Cifrado)</div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Alojamiento de bases de datos PostgreSQL con cifrado AES-256 en reposo, conexiones SSL obligatorias y políticas de seguridad 
                  a nivel de fila (Row Level Security - RLS) para que solo el personal autorizado de la clínica pueda acceder a los registros.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Derechos del Paciente (Derechos ARCO) */}
        <section id="derechos" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">6</span>
            Derechos de los Titulares de los Datos (Derechos ARCO)
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            En virtud de la Ley 25.326 y principios universales de protección de datos, usted tiene derecho a ejercer en cualquier momento:
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1.5">
            <li><strong>Derecho de Acceso:</strong> Conocer qué datos personales suyos obran en nuestros registros y cómo están siendo procesados.</li>
            <li><strong>Derecho de Rectificación / Actualización:</strong> Solicitar la corrección de datos inexactos, desactualizados o incompletos (teléfono, obra social, etc.).</li>
            <li><strong>Derecho de Supresión / Cancelación:</strong> Solicitar el borrado de sus datos de contacto y registros de chat cuando no sean necesarios para la relación asistencial.</li>
            <li><strong>Derecho de Oposición:</strong> Negarse a recibir comunicaciones o recordatorios automáticos por WhatsApp.</li>
          </ul>

          <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 not-prose">
            <div>
              <p className="font-bold text-slate-900">¿Desea solicitar la eliminación de sus datos de WhatsApp?</p>
              <p className="text-xs text-slate-500">Consulte nuestras instrucciones detalladas paso a paso conforme a las directrices de Meta.</p>
            </div>
            <Link
              href="/eliminacion-datos"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors shrink-0"
            >
              <span>Ver Instrucciones de Eliminación</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>

        {/* 7. Conservación de Datos y Secreto Médico */}
        <section id="seguridad" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">7</span>
            Plazos de Conservación y Medidas de Seguridad
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            Mantenemos sus datos de mensajería durante el tiempo necesario para cumplir las finalidades asistenciales. 
            No obstante, de conformidad con la legislación sanitaria (Ley 26.529 de Derechos del Paciente e Historia Clínica), 
            los registros clínicos formalmente incorporados a su Historia Clínica deben conservarse por el plazo legal mínimo obligatorio de 10 años.
          </p>
          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Medidas de seguridad implementadas en el CRM:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cifrado estricto de extremo a extremo y en tránsito mediante HTTPS/TLS 1.3.</li>
              <li>Autenticación segura de dos factores y cierre automático de sesión por inactividad para el personal médico y administrativo.</li>
              <li>Sanitización automática de logs técnicos (sin exposición de claves ni teléfonos en texto plano).</li>
              <li>Control de acceso basado en roles (RBAC) para limitar la visualización de datos únicamente al personal médico tratante.</li>
            </ul>
          </div>
        </section>

        {/* 8. Modificaciones a la Política */}
        <section id="modificaciones" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm flex items-center justify-center font-bold">8</span>
            Actualizaciones y Contacto
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm">
            Nos reservamos el derecho de actualizar periódicamente esta Política de Privacidad para reflejar cambios tecnológicos o normativos. 
            Cualquier modificación sustancial será comunicada a través de esta página pública con su correspondiente fecha de actualización.
          </p>
          <p className="text-slate-600 leading-relaxed text-sm">
            Para ejercer sus derechos o enviar consultas sobre privacidad, escriba a <strong className="text-slate-800 font-mono">privacidad@centromediconube.com</strong> detallando su nombre completo, DNI y número de teléfono celular registrado.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  )
}
