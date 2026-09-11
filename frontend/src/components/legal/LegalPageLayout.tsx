'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ShieldCheck, 
  Lock, 
  FileText, 
  Trash2, 
  Printer, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  ArrowLeft,
  CheckCircle2
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

interface LegalLayoutProps {
  title: string
  subtitle: string
  lastUpdated?: string
  children: React.ReactNode
}

interface ClinicInfo {
  nombre: string
  direccion: string
  telefono_guardia: string
  email_contacto: string
  horarios_atencion: string
}

export default function LegalPageLayout({
  title,
  subtitle,
  lastUpdated = '11 de Septiembre de 2026',
  children
}: LegalLayoutProps) {
  const pathname = usePathname()
  const [clinic, setClinic] = useState<ClinicInfo>({
    nombre: 'Centro Médico Nube',
    direccion: 'Av. Corrientes 1234, CABA, Argentina',
    telefono_guardia: '+54 9 11 5555-0199',
    email_contacto: 'privacidad@centromediconube.com',
    horarios_atencion: 'Lunes a Viernes de 08:00 a 20:00 hs'
  })

  useEffect(() => {
    async function loadClinicSettings() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/settings`)
        if (res.ok) {
          const data = await res.json()
          if (data?.clinica) {
            setClinic(prev => ({
              nombre: data.clinica.nombre || prev.nombre,
              direccion: data.clinica.direccion || prev.direccion,
              telefono_guardia: data.clinica.telefono_guardia || prev.telefono_guardia,
              email_contacto: data.clinica.email_contacto || prev.email_contacto,
              horarios_atencion: data.clinica.horarios_atencion || prev.horarios_atencion
            }))
          }
        }
      } catch (err) {
        // Fallback por defecto si no hay conexión al backend
      }
    }
    loadClinicSettings()
  }, [])

  const navLinks = [
    { href: '/politica-privacidad', label: 'Política de Privacidad', icon: ShieldCheck },
    { href: '/terminos-condiciones', label: 'Términos del Servicio', icon: FileText },
    { href: '/eliminacion-datos', label: 'Eliminación de Datos', icon: Trash2 },
  ]

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-blue-100 selection:text-blue-900 print:bg-white print:text-black">
      {/* Barra de cabecera superior */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:bg-blue-700 transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight group-hover:text-blue-600 transition-colors">
                {clinic.nombre}
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Canal Oficial de WhatsApp & CRM Clínico
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              title="Imprimir o descargar esta página en PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Acceso al CRM</span>
            </Link>
          </div>
        </div>

        {/* Navegación por pestañas entre páginas legales */}
        <div className="bg-slate-100/80 border-t border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-4 overflow-x-auto py-1.5 scrollbar-none">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="bg-gradient-to-b from-white to-slate-100/70 border-b border-slate-200 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            Meta WhatsApp Cloud API Compliance & Marco Legal Asistencial
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            {subtitle}
          </p>
          <div className="text-xs text-slate-600 pt-2 flex items-center justify-center gap-2">
            <span>Última actualización: <strong className="text-slate-700">{lastUpdated}</strong></span>
            <span>•</span>
            <span>Aplica a pacientes, usuarios y comunicaciones institucionales de {clinic.nombre}</span>
          </div>
        </div>
      </section>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10">
          {children}
        </div>
      </main>

      {/* Footer Legal e Institucional */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 print:hidden">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <Building2 className="w-4 h-4 text-blue-600" />
              {clinic.nombre}
            </div>
            <p className="leading-relaxed">
              Solución de gestión de pacientes y comunicación automatizada certificada con la infraestructura oficial de Meta WhatsApp Cloud API.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 w-fit px-2.5 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Canal de Comunicación Institucional Verificado
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-slate-800 text-sm block">Contacto de Privacidad y Cumplimiento:</span>
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span>{clinic.direccion}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span>Línea Telefónica: {clinic.telefono_guardia}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span>Correo de Atención al Paciente y Privacidad: <strong>{clinic.email_contacto}</strong></span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {clinic.nombre}. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/politica-privacidad" className="hover:text-blue-600 transition-colors">Privacidad</Link>
            <Link href="/terminos-condiciones" className="hover:text-blue-600 transition-colors">Términos</Link>
            <Link href="/eliminacion-datos" className="hover:text-blue-600 transition-colors">Eliminación de Datos</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
