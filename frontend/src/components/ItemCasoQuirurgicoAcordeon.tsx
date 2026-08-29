'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import ModalCrearPresupuestoPaciente from '@/components/ModalCrearPresupuestoPaciente'
import ModalEnviarPresupuestoWhatsApp from '@/components/ModalEnviarPresupuestoWhatsApp'
import ModalCerrarCasoQuirurgico from '@/components/ModalCerrarCasoQuirurgico'
import ModalPlantillasWhatsAppQuirurgicas from '@/components/ModalPlantillasWhatsAppQuirurgicas'

// Subcomponentes Especializados Modulares
import CasoAcordeonHeader from '@/components/asesoria/CasoAcordeonHeader'
import CasoFichaResumen from '@/components/asesoria/CasoFichaResumen'
import CasoFormularioActivo from '@/components/asesoria/CasoFormularioActivo'

export interface PresupuestoPaciente {
  id: string
  paciente_id: string
  asesoria_id?: string | null
  estado: 'borrador' | 'enviado' | 'aprobado' | 'rechazado'
  total: number
  total_ars?: number
  total_usd?: number
  pdf_url: string | null
  created_at: string
  items_presupuesto?: Array<{
    id: string
    servicio_id?: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    nombre?: string
    moneda?: string
  }>
}

export interface AsesoriaQuirurgica {
  id: string
  codigo_caso?: string | null
  paciente_id: string
  medico_derivador_id?: number | null
  medico_derivador_nombre?: string | null
  medico_derivador_matricula?: string | null
  medico_cirujano_id?: number | null
  medico_cirujano_nombre?: string | null
  medico_cirujano_matricula?: string | null
  practica_codigo?: string | null
  practica_nombre: string
  cobertura_obra_social?: string | null
  monto_extra: number
  moneda_extra: string
  monto_sena?: number
  estado_pago?: 'pendiente' | 'seniado' | 'totalmente_cobrado'
  medio_pago?: string | null
  presupuesto_id?: string | null
  fecha_probable_cirugia?: string | null
  fecha_definitiva_cirugia?: string | null
  control_postop_24h?: boolean
  control_postop_7d?: boolean
  alta_medica_definitiva?: boolean
  ojo?: 'OD' | 'OI' | 'AO'
  modalidad_bilateral?: 'escalonada' | 'simultanea' | null
  orden_ojos_escalonada?: 'OD_primero' | 'OI_primero' | null
  fecha_probable_2do_ojo?: string | null
  fecha_definitiva_2do_ojo?: string | null
  estado: 'derivado' | 'en_asesoramiento' | 'en_analisis' | 'presupuesto_enviado' | 'confirmado' | 'operado' | 'cancelado'
  situacion_paciente?: string | null
  motivo_cancelacion?: string | null
  checklist_prequirurgico?: Record<string, any> | null
  proxima_accion_fecha?: string | null
  proxima_accion_texto?: string | null
  ultimo_contacto_at?: string | null
  turnos_activos?: any[]
  turnos_quirofano?: any[]
  lio_calculado?: boolean
  lente_tipo?: string | null
  lente_dioptria?: string | null
  created_at: string
  updated_at: string
}

interface ItemCasoQuirurgicoAcordeonProps {
  caso: AsesoriaQuirurgica
  index: number
  isExpanded: boolean
  onToggle: () => void
  pacienteId: string
  pacienteNombre: string
  pacienteDni?: string | null
  pacienteTelefono?: string | null
  obraSocialDefault?: string | null
  onCasoActualizado: (casoActualizado: AsesoriaQuirurgica) => void
  onCasoEliminado: (casoId: string) => void
}

const ETAPAS: {
  id: AsesoriaQuirurgica['estado']
  label: string
  color: string
  headerBg: string
  headerBorder: string
  desc: string
}[] = [
  {
    id: 'derivado',
    label: '1. Derivado',
    color: 'border-blue-500 text-blue-400 bg-blue-500/10',
    headerBg: 'bg-gradient-to-r from-blue-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-blue-500/30 hover:border-blue-500/50',
    desc: 'Derivado desde consulta médica'
  },
  {
    id: 'en_asesoramiento',
    label: '2. En Asesoramiento',
    color: 'border-amber-500 text-amber-400 bg-amber-500/10',
    headerBg: 'bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-amber-500/30 hover:border-amber-500/50',
    desc: 'Asesorando en quirófano y presupuesto'
  },
  {
    id: 'en_analisis',
    label: '3. En Análisis',
    color: 'border-purple-500 text-purple-400 bg-purple-500/10',
    headerBg: 'bg-gradient-to-r from-purple-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-purple-500/30 hover:border-purple-500/50',
    desc: 'Paciente evalúa propuesta y autorizaciones'
  },
  {
    id: 'confirmado',
    label: '4. Cirugía Confirmada',
    color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
    headerBg: 'bg-gradient-to-r from-emerald-950/50 via-neutral-900 to-neutral-900',
    headerBorder: 'border-emerald-500/40 hover:border-emerald-500/60',
    desc: 'Fecha definitiva fijada en quirófano'
  },
  {
    id: 'operado',
    label: '5. Operado',
    color: 'border-teal-500 text-teal-300 bg-teal-500/10',
    headerBg: 'bg-gradient-to-r from-teal-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-teal-500/40 hover:border-teal-500/60',
    desc: 'Intervención realizada con éxito'
  },
  {
    id: 'cancelado',
    label: 'Cancelado / Desistido',
    color: 'border-red-500 text-red-400 bg-red-500/10',
    headerBg: 'bg-gradient-to-r from-red-950/40 via-neutral-900 to-neutral-900',
    headerBorder: 'border-red-500/30 hover:border-red-500/50',
    desc: 'Procedimiento cancelado o desistido'
  }
]

export default function ItemCasoQuirurgicoAcordeon({
  caso,
  index,
  isExpanded,
  onToggle,
  pacienteId,
  pacienteNombre,
  pacienteDni,
  pacienteTelefono,
  obraSocialDefault,
  onCasoActualizado,
  onCasoEliminado
}: ItemCasoQuirurgicoAcordeonProps) {
  const [guardando, setGuardando] = useState(false)
  const [consentimientoInfo, setConsentimientoInfo] = useState<any>(null)
  
  // Modales
  const [mostrarModalPresupuesto, setMostrarModalPresupuesto] = useState(false)
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false)
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false)
  const [presupuestoParaEnviarWA, setPresupuestoParaEnviarWA] = useState<PresupuestoPaciente | null>(null)
  const [practicaParaModalPresupuesto, setPracticaParaModalPresupuesto] = useState<{
    codigo: string
    nombre: string
    precio: number
    moneda: string
  }>({
    codigo: caso.practica_codigo || '',
    nombre: caso.practica_nombre || '',
    precio: caso.monto_extra || 0,
    moneda: caso.moneda_extra || 'ARS'
  })

  // Presupuestos vinculados
  const [presupuestos, setPresupuestos] = useState<PresupuestoPaciente[]>([])
  const [cargandoPresupuestos, setCargandoPresupuestos] = useState(false)

  // Feedback
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  // Determinar si es un caso cerrado
  const esCasoCerrado = caso.estado === 'operado' || caso.estado === 'cancelado' || !!caso.motivo_cancelacion

  // Calcular inactividad SLA
  const diasSinContacto = useMemo(() => {
    const fechaRef = caso.ultimo_contacto_at || caso.updated_at || caso.created_at
    if (!fechaRef) return 0
    const diffMs = Date.now() - new Date(fechaRef).getTime()
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  }, [caso.ultimo_contacto_at, caso.updated_at, caso.created_at])

  const alertaSla = diasSinContacto >= 3 && diasSinContacto < 7
  const criticoSla = diasSinContacto >= 7

  // Cargar Consentimiento Informado
  const fetchConsentimiento = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}/consentimiento`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.consentimiento) {
          setConsentimientoInfo(data.consentimiento)
        }
      }
    } catch (e) {
      // Silencioso
    }
  }

  // Cargar Presupuestos del Paciente
  const fetchPresupuestos = async () => {
    try {
      setCargandoPresupuestos(true)
      const res = await fetch(`${BACKEND_URL}/api/pacientes/${pacienteId}/presupuestos`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPresupuestos(data.presupuestos || [])
        }
      } else {
        const { data: sbData } = await supabase
          .from('presupuestos')
          .select('*, items_presupuesto(*)')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })
        if (sbData) setPresupuestos(sbData as any)
      }
    } catch (e) {
      console.error('Error cargando presupuestos:', e)
    } finally {
      setCargandoPresupuestos(false)
    }
  }

  useEffect(() => {
    if (isExpanded) {
      fetchConsentimiento()
      fetchPresupuestos()
    }
  }, [isExpanded, pacienteId, caso.id])

  // Guardar Cambios en Backend
  const handleGuardarCambios = async (datosActualizados: Partial<AsesoriaQuirurgica>) => {
    setGuardando(true)
    setErrorAccion(null)
    setMensajeGuardado(null)

    try {
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizados)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.mensaje || 'Error al guardar cambios.')
      }

      const casoGuardado: AsesoriaQuirurgica = data.asesoria
      onCasoActualizado(casoGuardado)
      setMensajeGuardado('✔ Caso quirúrgico actualizado correctamente.')
      setTimeout(() => setMensajeGuardado(null), 3000)
    } catch (err: any) {
      console.error('Error guardando caso:', err)
      // Fallback Supabase directo
      try {
        const { data: sbData, error: sbErr } = await supabase
          .from('asesorias_quirurgicas')
          .update(datosActualizados as any)
          .eq('id', caso.id)
          .select()

        if (!sbErr && sbData && sbData.length > 0) {
          onCasoActualizado(sbData[0] as AsesoriaQuirurgica)
          setMensajeGuardado('✔ Caso actualizado en CRM.')
          setTimeout(() => setMensajeGuardado(null), 3000)
        } else {
          throw sbErr || new Error('No se pudo guardar.')
        }
      } catch (fallbackErr: any) {
        setErrorAccion(fallbackErr.message || 'Error al guardar modificaciones.')
      }
    } finally {
      setGuardando(false)
    }
  }

  // Reabrir un caso cerrado
  const handleReabrirCaso = async () => {
    const confirmacion = window.confirm(
      '¿Deseas reabrir este caso quirúrgico para permitir nuevas modificaciones?'
    )
    if (!confirmacion) return

    await handleGuardarCambios({
      estado: 'en_asesoramiento',
      motivo_cancelacion: null
    })
  }

  // Toggle de checks postoperatorios
  const handleTogglePostOpCheck = async (campo: 'control_postop_24h' | 'control_postop_7d' | 'alta_medica_definitiva') => {
    const nuevoValor = !caso[campo]
    await handleGuardarCambios({ [campo]: nuevoValor })
  }

  // Eliminar caso
  const handleEliminarCaso = async () => {
    const confirmacion = window.confirm('¿Seguro que deseas eliminar este caso quirúrgico?')
    if (!confirmacion) return

    setGuardando(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/asesorias-quirurgicas/${caso.id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        onCasoEliminado(caso.id)
      } else {
        await supabase.from('asesorias_quirurgicas').delete().eq('id', caso.id)
        onCasoEliminado(caso.id)
      }
    } catch (e) {
      console.error('Error al eliminar caso:', e)
    } finally {
      setGuardando(false)
    }
  }

  // Aprobar / Rechazar Presupuesto
  const handleAprobarRechazarPresupuesto = async (presId: string, nuevoEstado: 'aprobado' | 'rechazado') => {
    try {
      const { error } = await supabase
        .from('presupuestos')
        .update({ estado: nuevoEstado })
        .eq('id', presId)

      if (!error) {
        setPresupuestos((prev) =>
          prev.map((p) => (p.id === presId ? { ...p, estado: nuevoEstado } : p))
        )
      }
    } catch (e) {
      console.error('Error al actualizar presupuesto:', e)
    }
  }

  // Callback cuando se crea presupuesto
  const handlePresupuestoCreado = async (nuevoPresupuesto: PresupuestoPaciente) => {
    setPresupuestos((prev) => [nuevoPresupuesto, ...prev])

    // Extraer práctica del presupuesto emitido si está disponible
    let codPrac = caso.practica_codigo
    let nomPrac = caso.practica_nombre

    if (nuevoPresupuesto.items_presupuesto && nuevoPresupuesto.items_presupuesto.length > 0) {
      const primerItem: any = nuevoPresupuesto.items_presupuesto[0]
      const cod = primerItem.codigo || primerItem.servicios_precios?.codigo
      const nom = primerItem.nombre || primerItem.servicios_precios?.nombre_prestacion
      if (cod) codPrac = cod
      if (nom && nom !== 'Prestación médica') nomPrac = nom
    }

    const moneda = (nuevoPresupuesto.total_usd && nuevoPresupuesto.total_usd > 0) ? 'USD' : 'ARS'
    const monto = moneda === 'USD' ? Number(nuevoPresupuesto.total_usd) : Number(nuevoPresupuesto.total_ars || nuevoPresupuesto.total || 0)

    const payloadActualizacion: Partial<AsesoriaQuirurgica> = {
      presupuesto_id: nuevoPresupuesto.id,
      monto_extra: monto,
      moneda_extra: moneda
    }

    if (codPrac && (!caso.practica_codigo || caso.practica_nombre === 'Nueva Cirugía / Procedimiento')) {
      payloadActualizacion.practica_codigo = codPrac
    }
    if (nomPrac && (!caso.practica_nombre || caso.practica_nombre === 'Nueva Cirugía / Procedimiento')) {
      payloadActualizacion.practica_nombre = nomPrac
    }

    await handleGuardarCambios(payloadActualizacion)
    setMostrarModalPresupuesto(false)
  }

  const estadoNormalizado = caso.estado === 'presupuesto_enviado' ? 'en_analisis' : caso.estado
  const etapaActual = ETAPAS.find((e) => e.id === estadoNormalizado) || ETAPAS[0]

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        esCasoCerrado
          ? caso.estado === 'operado'
            ? 'border-teal-500/40 shadow-sm'
            : 'border-red-500/30 shadow-sm'
          : isExpanded
          ? 'border-blue-500/40 shadow-xl ring-1 ring-blue-500/20'
          : 'border-[var(--border)] hover:border-gray-700 shadow-sm'
      }`}
    >
      {/* 1. Header del Acordeón */}
      <CasoAcordeonHeader
        caso={caso}
        index={index}
        isExpanded={isExpanded}
        onToggle={onToggle}
        etapaActual={etapaActual}
        esCasoCerrado={esCasoCerrado}
        diasSinContacto={diasSinContacto}
        alertaSla={alertaSla}
        criticoSla={criticoSla}
        consentimientoInfo={consentimientoInfo}
      />

      {/* 2. Cuerpo del Acordeón Desplegado */}
      {isExpanded && (
        <>
          {esCasoCerrado ? (
            /* Modo A: Ficha Resumen de Archivo Clínico (Read-Only) */
            <CasoFichaResumen
              caso={caso}
              pacienteNombre={pacienteNombre}
              presupuestos={presupuestos}
              consentimientoInfo={consentimientoInfo}
              guardando={guardando}
              onReabrirCaso={handleReabrirCaso}
              onTogglePostOpCheck={handleTogglePostOpCheck}
            />
          ) : (
            /* Modo B: Formulario Interactivo Activo en 2 Columnas */
            <CasoFormularioActivo
              caso={caso}
              pacienteId={pacienteId}
              pacienteNombre={pacienteNombre}
              pacienteDni={pacienteDni}
              pacienteTelefono={pacienteTelefono}
              obraSocialDefault={obraSocialDefault}
              presupuestos={presupuestos}
              cargandoPresupuestos={cargandoPresupuestos}
              guardando={guardando}
              mensajeGuardado={mensajeGuardado}
              errorAccion={errorAccion}
              consentimientoInfo={consentimientoInfo}
              etapas={ETAPAS}
              onGuardar={handleGuardarCambios}
              onAbrirModalPresupuesto={(datos) => {
                if (datos) {
                  setPracticaParaModalPresupuesto(datos)
                } else {
                  setPracticaParaModalPresupuesto({
                    codigo: caso.practica_codigo || '',
                    nombre: caso.practica_nombre || '',
                    precio: caso.monto_extra || 0,
                    moneda: caso.moneda_extra || 'ARS'
                  })
                }
                setMostrarModalPresupuesto(true)
              }}
              onAbrirModalWhatsApp={() => setMostrarModalWhatsApp(true)}
              onAbrirModalCierre={() => setMostrarModalCierre(true)}
              onEliminar={handleEliminarCaso}
              onAprobarRechazarPresupuesto={handleAprobarRechazarPresupuesto}
              onDesvincularPresupuesto={() => handleGuardarCambios({ presupuesto_id: null })}
              onVincularPresupuesto={async (pres) => {
                try {
                  setGuardando(true)
                  try {
                    await fetch(`${BACKEND_URL}/api/presupuestos/${pres.id}/vincular-asesoria`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ asesoria_id: caso.id })
                    })
                  } catch (e) {
                    await supabase.from('presupuestos').update({ asesoria_id: caso.id }).eq('id', pres.id)
                  }

                  setPresupuestos((prev) =>
                    prev.map((p) => (p.id === pres.id ? { ...p, asesoria_id: caso.id } : p))
                  )

                  const montoTotal = Number(pres.total_ars || pres.total || 0)
                  const moneda = pres.total_usd && pres.total_usd > 0 ? 'USD' : 'ARS'
                  await handleGuardarCambios({
                    presupuesto_id: pres.id,
                    monto_extra: moneda === 'USD' ? Number(pres.total_usd) : montoTotal,
                    moneda_extra: moneda
                  })
                } catch (err) {
                  console.error('Error al vincular presupuesto:', err)
                } finally {
                  setGuardando(false)
                }
              }}
              onEnviarPresupuestoWhatsApp={(pres) => setPresupuestoParaEnviarWA(pres)}
            />
          )}
        </>
      )}

      {/* Modal Crear Presupuesto */}
      {mostrarModalPresupuesto && (
        <ModalCrearPresupuestoPaciente
          isOpen={mostrarModalPresupuesto}
          onClose={() => setMostrarModalPresupuesto(false)}
          pacienteId={pacienteId}
          asesoriaId={caso.id}
          pacienteNombre={pacienteNombre}
          pacienteDni={pacienteDni}
          pacienteTelefono={pacienteTelefono}
          obraSocial={obraSocialDefault}
          practicaInicial={practicaParaModalPresupuesto}
          onPresupuestoCreado={handlePresupuestoCreado}
        />
      )}

      {/* Modal Enviar Presupuesto WhatsApp */}
      {presupuestoParaEnviarWA && (
        <ModalEnviarPresupuestoWhatsApp
          isOpen={!!presupuestoParaEnviarWA}
          onClose={() => setPresupuestoParaEnviarWA(null)}
          presupuestoId={presupuestoParaEnviarWA.id}
          pacienteNombre={pacienteNombre}
          telefonoDefault={pacienteTelefono || ''}
          totalArs={presupuestoParaEnviarWA.total}
          pdfUrl={presupuestoParaEnviarWA.pdf_url}
        />
      )}

      {/* Modal Cerrar / Desistir Caso */}
      {mostrarModalCierre && (
        <ModalCerrarCasoQuirurgico
          isOpen={mostrarModalCierre}
          onClose={() => setMostrarModalCierre(false)}
          casoId={caso.id}
          pacienteId={pacienteId}
          pacienteNombre={pacienteNombre}
          practicaNombre={caso.practica_nombre}
          numeroCirugia={index + 1}
          onCasoCerrado={(casoCerrado) => {
            onCasoActualizado(casoCerrado)
            setMostrarModalCierre(false)
          }}
        />
      )}

      {/* Modal Plantillas WhatsApp Quirúrgicas */}
      {mostrarModalWhatsApp && (
        <ModalPlantillasWhatsAppQuirurgicas
          isOpen={mostrarModalWhatsApp}
          onClose={() => setMostrarModalWhatsApp(false)}
          casoId={caso.id}
          pacienteId={pacienteId}
          pacienteNombre={pacienteNombre}
          pacienteTelefono={pacienteTelefono || ''}
          practicaNombre={caso.practica_nombre}
          medicoCirujanoNombre={caso.medico_cirujano_nombre}
          montoExtra={caso.monto_extra}
          monedaExtra={caso.moneda_extra}
          fechaProbable={caso.fecha_probable_cirugia}
          fechaDefinitiva={caso.fecha_definitiva_cirugia}
        />
      )}
    </div>
  )
}
