'use client'

import React, { useState, useEffect } from 'react'
import { 
  User, 
  Phone, 
  CreditCard, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  Send, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  ShieldCheck,
  Stethoscope,
  X,
  Tag,
  Database
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { formatPhoneDisplay } from '@/lib/phoneUtils'
import ModalBuscarGeclisa from '@/components/ModalBuscarGeclisa'

interface PatientSidebarProps {
  paciente: any
  conversacionId?: string
  onClose?: () => void
  onOpenHistoriaClinica?: (pacienteId: string) => void
  onOpenEditarPaciente?: (paciente: any) => void
  onInsertMessageToChat?: (text: string) => void
}

export default function ChatPatientSidebar({
  paciente,
  conversacionId,
  onClose,
  onOpenHistoriaClinica,
  onOpenEditarPaciente,
  onInsertMessageToChat
}: PatientSidebarProps) {
  // Estado local enriquecido del paciente (con fallback a BD)
  const [pacienteInfo, setPacienteInfo] = useState<any>(paciente || {})

  // Estados para Presupuestos
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [cargandoPresupuestos, setCargandoPresupuestos] = useState(false)
  const [presupuestosOpen, setPresupuestosOpen] = useState(false)

  // Estados para Turnos Geclisa (On-Demand / Sin guardar en BD)
  const [turnosGeclisa, setTurnosGeclisa] = useState<any[]>([])
  const [cargandoTurnosGeclisa, setCargandoTurnosGeclisa] = useState(false)
  const [turnosConsultados, setTurnosConsultados] = useState(false)
  const [turnosOpen, setTurnosOpen] = useState(false)
  const [selectedTurnoDetalle, setSelectedTurnoDetalle] = useState<any | null>(null)
  const [mostrarModalGeclisa, setMostrarModalGeclisa] = useState(false)

  // Consulta en vivo a la API de Geclisa: GET /api/Turnos/pendientes/{fichaId}
  const fetchTurnosGeclisa = async (fichaIdParam?: number | string) => {
    let fichaId = fichaIdParam || pacienteInfo?.geclisa_ficha_id || pacienteInfo?.ficha_id || paciente?.geclisa_ficha_id || paciente?.ficha_id

    // Fallback: Si no tenemos la ficha en memoria, buscarla directamente en Supabase
    if (!fichaId && (paciente?.id || pacienteInfo?.id)) {
      try {
        const pId = paciente?.id || pacienteInfo?.id
        const { data: pData } = await supabase
          .from('pacientes')
          .select('*')
          .eq('id', pId)
          .maybeSingle()
        if (pData) {
          setPacienteInfo(pData)
          fichaId = pData.geclisa_ficha_id
        }
      } catch (err) {
        console.error('Error recuperando ficha en fallback:', err)
      }
    }

    if (!fichaId) {
      setTurnosGeclisa([])
      setTurnosConsultados(true)
      return
    }

    try {
      setCargandoTurnosGeclisa(true)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/turnos/pendientes/${fichaId}`)
      if (res.ok) {
        const data = await res.json()
        setTurnosGeclisa(data.turnos || [])
      } else {
        console.warn('No se pudieron obtener turnos de Geclisa:', res.status)
        setTurnosGeclisa([])
      }
    } catch (err) {
      console.error('Error consultando turnos en Geclisa:', err)
      setTurnosGeclisa([])
    } finally {
      setCargandoTurnosGeclisa(false)
      setTurnosConsultados(true)
    }
  }

  // Manejar apertura de acordeón de turnos (Lazy Loading)
  const handleToggleTurnos = () => {
    const nextState = !turnosOpen
    setTurnosOpen(nextState)
    if (nextState && !turnosConsultados) {
      fetchTurnosGeclisa()
    }
  }

  useEffect(() => {
    if (!paciente?.id) return

    setPacienteInfo(paciente)
    // Resetear caché al cambiar de paciente
    setTurnosGeclisa([])
    setTurnosConsultados(false)
    setTurnosOpen(false)

    // Si el prop del paciente no trajo geclisa_ficha_id o dni, cargar ficha completa de Supabase
    if (!paciente.geclisa_ficha_id || !paciente.dni) {
      supabase
        .from('pacientes')
        .select('*')
        .eq('id', paciente.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setPacienteInfo((prev: any) => ({ ...prev, ...data }))
        })
    }

    const loadPresupuestos = async () => {
      try {
        setCargandoPresupuestos(true)
        const { data: presData, error: presError } = await supabase
          .from('presupuestos')
          .select(`
            id,
            paciente_id,
            asesoria_id,
            estado,
            total,
            pdf_url,
            created_at,
            items_presupuesto (
              id,
              servicio_id,
              cantidad,
              precio_unitario,
              subtotal,
              servicios_precios (
                nombre_prestacion,
                codigo
              )
            ),
            asesorias_quirurgicas!presupuestos_asesoria_id_fkey (
              practica_nombre,
              practica_codigo
            )
          `)
          .eq('paciente_id', paciente.id)
          .order('created_at', { ascending: false })

        if (presError) {
          console.warn('Error cargando presupuestos enriquecidos, intentando fallback simple:', presError)
          const fallback = await supabase
            .from('presupuestos')
            .select('*')
            .eq('paciente_id', paciente.id)
            .order('created_at', { ascending: false })
          
          const activos = (fallback.data || []).filter(
            (p: any) => !['rechazado', 'cancelado', 'desistido'].includes((p.estado || '').toLowerCase())
          )
          setPresupuestos(activos)
        } else {
          const activos = (presData || []).filter(
            (p: any) => !['rechazado', 'cancelado', 'desistido'].includes((p.estado || '').toLowerCase())
          )
          setPresupuestos(activos)
        }
      } catch (err) {
        console.error('Error cargando presupuestos del paciente:', err)
      } finally {
        setCargandoPresupuestos(false)
      }
    }

    loadPresupuestos()
  }, [paciente?.id])

  if (!paciente) {
    return (
      <div className="w-80 border-l border-slate-800 bg-[#0d1527] p-4 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
        <User size={32} className="text-slate-600 mb-2" />
        <p>No se encontró ficha asociada para este chat.</p>
      </div>
    )
  }

  // Enviar link del presupuesto directamente al chat de WhatsApp
  const handleEnviarPresupuestoWhatsApp = async (p: any) => {
    if (!p.pdf_url && !p.id) return
    const rawPdf = p.pdf_url || `/static/presupuesto_${p.id}.pdf`
    const pdfLink = rawPdf.startsWith('http') ? rawPdf : `${BACKEND_URL.replace(/\/$/, '')}/${rawPdf.replace(/^\//, '')}`
    
    const practicaNombre = 
      p.asesorias_quirurgicas?.practica_nombre || 
      p.items_presupuesto?.[0]?.servicios_precios?.nombre_prestacion || 
      'Presupuesto de Consulta / Práctica Médica'
    
    const monto = Number(p.total ?? p.monto_total ?? 0).toLocaleString('es-AR')
    const shortId = p.id ? p.id.slice(0, 8) : '0000'

    const mensajeTexto = `Estimado/a *${paciente.nombre}*, adjuntamos el detalle de su presupuesto formal emitido por la clínica:\n\n🩺 *Práctica*: ${practicaNombre}\n📄 *Presupuesto #*: ${shortId}\n💰 *Monto Total*: $${monto}\n🔗 *Descargar PDF*: ${pdfLink}\n\nQuedamos a su entera disposición ante cualquier consulta o para coordinar la fecha. ¡Saludos!`

    if (onInsertMessageToChat) {
      onInsertMessageToChat(mensajeTexto)
    }
  }

  // Enviar recordatorio del turno al chat de WhatsApp
  const handleEnviarRecordatorioTurno = (t: any) => {
    if (!t) return
    const fechaObj = t.fecha_hora ? new Date(t.fecha_hora) : null
    const fechaStr = fechaObj ? fechaObj.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Fecha a confirmar'
    const horaStr = fechaObj ? fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Horario a confirmar'
    
    const mensajeTexto = `Hola *${paciente.nombre}*, le recordamos su turno agendado en la clínica:\n\n📅 *Fecha*: ${fechaStr}\n⏰ *Hora*: ${horaStr} hs\n🩺 *Especialidad*: ${t.especialidad || 'Consulta Médica'}\n👨‍⚕️ *Profesional*: ${t.profesional_nombre || 'Médico Asignado'}\n🏥 *Lugar/Consultorio*: ${t.consultorio || 'Sede Central'}\n\nPor favor concurrir con DNI y credencial médica con 10 minutos de anticipación. ¡Lo/a esperamos!`
    
    if (onInsertMessageToChat) {
      onInsertMessageToChat(mensajeTexto)
      setSelectedTurnoDetalle(null)
    }
  }

  return (
    <div className="w-80 md:w-88 border-l border-slate-800 bg-[#0d1527] flex flex-col h-full overflow-y-auto panel-scroll text-slate-100 shrink-0 text-xs">
      
      {/* Cabecera del Sidebar */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-[#101b33] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <ShieldCheck size={16} />
          </div>
          <div>
            <h4 className="font-bold text-slate-200">Ficha 360° del Paciente</h4>
            <p className="text-[10px] text-slate-400">Contexto clínico en vivo</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        
        {/* 1. FICHA PRINCIPAL */}
        <div className="p-3 rounded-xl bg-[#14203d] border border-slate-700/60 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-100 truncate">{paciente.nombre}</h3>
              {/* Badge de Estado Geclisa */}
              <div className="mt-1">
                {(pacienteInfo.geclisa_ficha_id || pacienteInfo.ficha_id || paciente.geclisa_ficha_id) ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-950/70 border border-emerald-600/40 text-emerald-300">
                    <ShieldCheck size={11} className="text-emerald-400" />
                    Geclisa Ficha #{pacienteInfo.geclisa_ficha_id || pacienteInfo.ficha_id || paciente.geclisa_ficha_id}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-amber-950/70 border border-amber-600/40 text-amber-300">
                    <AlertTriangle size={11} className="text-amber-400" />
                    Paciente Nuevo / Sin Geclisa
                  </span>
                )}
              </div>
            </div>

            {onOpenEditarPaciente && (
              <button
                onClick={() => onOpenEditarPaciente(paciente)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 shrink-0 pt-0.5"
              >
                Editar
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-slate-300 text-[11px]">
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-slate-400 shrink-0" />
              <span>{formatPhoneDisplay(pacienteInfo.telefono || paciente.telefono)}</span>
            </div>

            {(pacienteInfo.dni || paciente.dni) && (
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-slate-400 shrink-0" />
                <span>DNI: {pacienteInfo.dni || paciente.dni}</span>
              </div>
            )}

            {(pacienteInfo.geclisa_ficha_id || pacienteInfo.ficha_id || paciente.geclisa_ficha_id) && (
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-emerald-400 shrink-0" />
                <span>Ficha Geclisa: <strong className="text-emerald-300">#{pacienteInfo.geclisa_ficha_id || pacienteInfo.ficha_id || paciente.geclisa_ficha_id}</strong></span>
                {(pacienteInfo.nro_hc || paciente.nro_hc) && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    (HC: {pacienteInfo.nro_hc || paciente.nro_hc})
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Stethoscope size={13} className="text-blue-400 shrink-0" />
              <span>Cobertura: <strong className="text-slate-200">{pacienteInfo.obra_social || paciente.obra_social || 'Particular'}</strong></span>
              {(pacienteInfo.plan_cobertura || pacienteInfo.nro_afiliado || paciente.nro_afiliado) && (
                <span className="text-[10px] text-slate-400">({pacienteInfo.plan_cobertura || pacienteInfo.nro_afiliado || paciente.nro_afiliado})</span>
              )}
            </div>

            {(pacienteInfo.alertas_medicas || paciente.alertas_medicas) && (
              <div className="mt-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[10px] flex items-start gap-1.5">
                <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Alerta:</strong> {pacienteInfo.alertas_medicas || paciente.alertas_medicas}</span>
              </div>
            )}
          </div>

          {/* Acciones Rápidas */}
          <div className="pt-2 border-t border-slate-700/60 flex items-center gap-2">
            {onOpenHistoriaClinica && (
              <button
                onClick={() => onOpenHistoriaClinica(pacienteInfo.id || paciente.id)}
                className="flex-1 py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <FileText size={12} />
                <span>Historia Clínica</span>
              </button>
            )}

            <button
              onClick={() => setMostrarModalGeclisa(true)}
              className="flex-1 py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors"
              title="Buscar en Geclisa por DNI y vincular a este chat"
            >
              <Database size={12} />
              <span>{pacienteInfo.geclisa_ficha_id ? 'Re-sincronizar' : 'Vincular Geclisa'}</span>
            </button>
          </div>
        </div>

        {/* 2. PRÓXIMOS TURNOS (CONSULTA EN VIVO A GECLISA - COLAPSABLE POR DEFECTO) */}
        <div className="space-y-2">
          
          {/* Botón Acordeón Cabecera */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#14203d] border border-slate-700/60 transition-colors">
            <button
              type="button"
              onClick={handleToggleTurnos}
              className="flex-1 flex items-center justify-between text-left pr-2"
            >
              <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px]">
                <Calendar size={13} className="text-emerald-400" />
                <span>Turnos Agendados (Geclisa)</span>
              </div>
              <div className="flex items-center gap-2">
                {turnosConsultados && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    turnosGeclisa.length > 0
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {turnosGeclisa.length}
                  </span>
                )}
                <ChevronDown 
                  size={15} 
                  className={`text-slate-400 transition-transform duration-200 ${turnosOpen ? 'rotate-180 text-emerald-300' : ''}`} 
                />
              </div>
            </button>

            {/* Botón Refrescar en Vivo si está abierto */}
            {turnosOpen && (
              <button
                type="button"
                onClick={() => fetchTurnosGeclisa()}
                disabled={cargandoTurnosGeclisa}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                title="Consultar agenda de Geclisa nuevamente"
              >
                <Loader2 size={13} className={cargandoTurnosGeclisa ? 'animate-spin text-emerald-400' : 'hidden'} />
                {!cargandoTurnosGeclisa && <Clock size={13} />}
              </button>
            )}
          </div>

          {/* Contenido Desplegable de Turnos */}
          {turnosOpen && (
            <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {cargandoTurnosGeclisa ? (
                <div className="p-3 text-center text-slate-400 space-y-1">
                  <Loader2 size={16} className="animate-spin mx-auto text-emerald-400" />
                  <p className="text-[10px]">Consultando agenda en vivo en Geclisa...</p>
                </div>
              ) : !paciente?.geclisa_ficha_id && !paciente?.ficha_id ? (
                <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-center text-amber-300 text-[10.5px]">
                  Paciente sin Ficha Geclisa vinculada.
                </div>
              ) : turnosGeclisa.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-[#14203d]/40 border border-slate-800 text-center text-slate-400 text-[11px]">
                  No registra turnos pendientes en Geclisa.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {turnosGeclisa.map((t, idx) => {
                    const fechaObj = t.fecha_hora ? new Date(t.fecha_hora) : null
                    const fechaStr = fechaObj ? fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : 's/d'
                    const horaStr = fechaObj ? fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
                    const estado = (t.estado || 'Pendiente').toLowerCase()

                    return (
                      <div 
                        key={t.id || idx} 
                        onClick={() => setSelectedTurnoDetalle(t)}
                        className="p-2.5 rounded-xl bg-[#14203d] hover:bg-[#1a2b52] border border-slate-700/60 hover:border-emerald-500/50 flex flex-col gap-1 transition-all cursor-pointer shadow-xs group"
                        title="Haz clic para ver el detalle completo del turno"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors truncate">
                            {t.especialidad || 'Consulta Médica'}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                            estado.includes('confirm') ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' :
                            estado.includes('cancel') ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' :
                            'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                          }`}>
                            {t.estado || 'Pendiente'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-400 text-[10.5px]">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-emerald-400" />
                            <span>{fechaStr} a las {horaStr} hs</span>
                          </span>
                          {t.sobreturno && (
                            <span className="text-[8.5px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800/50">
                              Sobreturno
                            </span>
                          )}
                        </div>

                        {t.profesional_nombre && (
                          <p className="text-[10px] text-slate-400 truncate">
                            Dr/a: <strong className="text-slate-300">{t.profesional_nombre}</strong>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. PRESUPUESTOS Y COTIZACIONES PENDIENTES (ACORDEÓN COLAPSABLE POR DEFECTO) */}
        <div className="space-y-2">
          
          {/* Botón Acordeón Cabecera */}
          <button
            type="button"
            onClick={() => setPresupuestosOpen(!presupuestosOpen)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#14203d] hover:bg-[#1a2b52] border border-slate-700/60 transition-colors text-left"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px]">
              <FileText size={13} className="text-blue-400" />
              <span>Presupuestos Pendientes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                presupuestos.length > 0
                  ? 'bg-blue-950 text-blue-300 border-blue-800/60'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {presupuestos.length}
              </span>
              <ChevronDown 
                size={15 
                } 
                className={`text-slate-400 transition-transform duration-200 ${presupuestosOpen ? 'rotate-180 text-blue-300' : ''}`} 
              />
            </div>
          </button>

          {/* Contenido Desplegable */}
          {presupuestosOpen && (
            <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {cargandoPresupuestos ? (
                <div className="p-3 text-center text-slate-400">
                  <Loader2 size={16} className="animate-spin mx-auto text-blue-400" />
                </div>
              ) : presupuestos.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-[#14203d]/40 border border-slate-800 text-center text-slate-400 text-[11px]">
                  No registra presupuestos pendientes o activos.
                </div>
              ) : (
                presupuestos.map((p) => {
                  const monto = Number(p.total ?? p.monto_total ?? 0).toLocaleString('es-AR')
                  const estado = p.estado || 'borrador'
                  const fechaStr = p.created_at 
                    ? new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'Reciente'
                  
                  // Práctica o Tratamiento
                  const practicaNombre = 
                    p.asesorias_quirurgicas?.practica_nombre || 
                    p.items_presupuesto?.[0]?.servicios_precios?.nombre_prestacion || 
                    'Consulta / Práctica Médica'
                  
                  const shortId = p.id ? p.id.slice(0, 8) : '0000'

                  return (
                    <div key={p.id} className="p-3 rounded-xl bg-[#14203d] border border-slate-700/60 space-y-2 shadow-xs">
                      
                      {/* Cabecera del Presupuesto */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-100 text-xs truncate" title={practicaNombre}>
                            {practicaNombre}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>#{shortId}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={10} /> {fechaStr}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                          estado === 'aprobado' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' :
                          estado === 'enviado' ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60' :
                          'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                        }`}>
                          {estado}
                        </span>
                      </div>

                      {/* Monto Total Destacado */}
                      <div className="p-2 rounded-lg bg-[#0d1527] border border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-semibold">Total a Abonar:</span>
                        <span className="text-sm font-extrabold text-emerald-400">${monto}</span>
                      </div>

                      {/* Botón para enviar PDF al chat */}
                      <button
                        onClick={() => handleEnviarPresupuestoWhatsApp(p)}
                        className="w-full py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs border border-blue-500/40"
                        title="Insertar texto y link de descarga en la caja de chat"
                      >
                        <Send size={11} />
                        <span>Enviar PDF por WhatsApp</span>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* MODAL / POP-UP DE DETALLE DEL TURNO */}
      {selectedTurnoDetalle && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedTurnoDetalle(null)}
        >
          <div 
            className="bg-[#0f172a] border border-emerald-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Detalle del Turno Agendado</h3>
                  <p className="text-[10px] text-slate-400">Origen: Geclisa Hospitalario</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTurnoDetalle(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Cuerpo del Turno */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#14203d] border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Especialidad</span>
                  <span className="font-bold text-emerald-300 text-sm">{selectedTurnoDetalle.especialidad || 'Consulta Médica'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Profesional</span>
                  <span className="font-semibold text-slate-100">{selectedTurnoDetalle.profesional_nombre || 'Médico Asignado'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Fecha y Hora</span>
                  <span className="font-bold text-slate-200">
                    {selectedTurnoDetalle.fecha_hora 
                      ? new Date(selectedTurnoDetalle.fecha_hora).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) + ' - ' + new Date(selectedTurnoDetalle.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs'
                      : 's/d'}
                  </span>
                </div>
                {selectedTurnoDetalle.consultorio && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Consultorio / Sede</span>
                    <span className="text-slate-200">{selectedTurnoDetalle.consultorio}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Estado</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 uppercase">
                    {selectedTurnoDetalle.estado || 'Pendiente'}
                  </span>
                </div>
              </div>

              {selectedTurnoDetalle.observaciones && (
                <div className="p-3 rounded-xl bg-[#0d1527] border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Observaciones / Indicaciones:</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{selectedTurnoDetalle.observaciones}</p>
                </div>
              )}
            </div>

            {/* Acciones del Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTurnoDetalle(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => handleEnviarRecordatorioTurno(selectedTurnoDetalle)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
              >
                <Send size={12} />
                <span>Enviar Recordatorio al Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buscar y Vincular en Geclisa */}
      <ModalBuscarGeclisa
        isOpen={mostrarModalGeclisa}
        onClose={() => setMostrarModalGeclisa(false)}
        onPacienteImportado={(pacImportado) => {
          setPacienteInfo((prev: any) => ({ ...prev, ...pacImportado }))
          setMostrarModalGeclisa(false)
          if (pacImportado?.geclisa_ficha_id) {
            fetchTurnosGeclisa(pacImportado.geclisa_ficha_id)
          }
        }}
      />
    </div>
  )
}

