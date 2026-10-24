'use client'

import React from 'react'
import { X, Pill, ShieldCheck, Stethoscope } from 'lucide-react'
import SeccionIndicacionesExpediente from './SeccionIndicacionesExpediente'

interface ModalIndicacionesMedicasCasoProps {
  isOpen: boolean
  onClose: () => void
  caso: any | null
  onIndicacionEmitida?: (resultado: any) => void
}

export default function ModalIndicacionesMedicasCaso({
  isOpen,
  onClose,
  caso,
  onIndicacionEmitida
}: ModalIndicacionesMedicasCasoProps) {
  if (!isOpen || !caso) return null

  const paciente = caso.pacientes || {}
  const pacNombre = paciente.nombre || 'Paciente'
  const pacDni = paciente.dni || '-'
  const pacTelefono = paciente.telefono || ''
  const pacObraSocial = caso.cobertura_obra_social || paciente.obra_social || '-'
  const pacAfiliado = paciente.nro_afiliado || paciente.numero_afiliado || '-'
  const pacDomicilio = paciente.direccion || paciente.domicilio || '-'
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="p-4 border-b border-[var(--border-color)] bg-gradient-to-r from-blue-900/15 via-transparent to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
              <Pill size={20} />
            </span>
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)]">
                Emisión de Indicaciones Médicas Quirúrgicas
              </h3>
              <p className="text-[11px] text-[var(--secondary)]">
                {pacNombre} • DNI: {pacDni} • {caso.practica_nombre || 'Cirugía Oftalmológica'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal con la Sección de Indicaciones */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          <SeccionIndicacionesExpediente
            asesoriaId={caso.id}
            practicaId={caso.practica_id || caso.nomenclador_practica_id}
            practicaNombre={caso.practica_nombre}
            practicaCodigo={caso.practica_codigo}
            medicoNombre={caso.medico_cirujano_nombre}
            medicoId={caso.medico_cirujano_id}
            pacienteNombre={pacNombre}
            pacienteTelefono={pacTelefono}
            pacienteDni={pacDni}
            pacienteObraSocial={pacObraSocial}
            pacienteAfiliado={pacAfiliado}
            pacienteDomicilio={pacDomicilio}
            indicacionGeclisaImId={caso.indicacion_geclisa_im_id}
            indicacionesEmitidasAt={caso.indicaciones_emitidas_at}
            indicacionesPdfUrl={caso.indicaciones_pdf_url}
            onIndicacionEmitida={(res) => {
              if (onIndicacionEmitida) onIndicacionEmitida(res)
            }}
          />
        </div>
      </div>
    </div>
  )
}
