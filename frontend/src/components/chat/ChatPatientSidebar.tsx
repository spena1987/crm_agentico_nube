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
  Tag
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/api'
import { formatPhoneDisplay } from '@/lib/phoneUtils'

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
  const [turnos, setTurnos] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [cargandoTurnos, setCargandoTurnos] = useState(false)
  const [cargandoPresupuestos, setCargandoPresupuestos] = useState(false)
  
  // Secciones colapsables (Presupuestos colapsado por defecto)
  const [presupuestosOpen, setPresupuestosOpen] = useState(false)

  useEffect(() => {
    if (!paciente?.id) return

    const loadData = async () => {
      // 1. Cargar turnos
      try {
        setCargandoTurnos(true)
        const { data: turnosData } = await (supabase as any)
          .from('turnos')
          .select('*')
          .eq('paciente_id', paciente.id)
          .order('fecha_hora', { ascending: true })
          .limit(5)
        setTurnos(turnosData || [])
      } catch (err) {
        console.error('Error cargando turnos del paciente:', err)
      } finally {
        setCargandoTurnos(false)
      }

      // 2. Cargar presupuestos enriquecidos (con servicios_precios y asesoria quirúrgica)
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
          
          // Filtrar solo casos activos/pendientes (excluir rechazados/desistidos)
          const activos = (fallback.data || []).filter(
            (p: any) => !['rechazado', 'cancelado', 'desistido'].includes((p.estado || '').toLowerCase())
          )
          setPresupuestos(activos)
        } else {
          // Filtrar solo casos activos/pendientes
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

    loadData()
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
    
    // Obtener nombre de la práctica
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
        <div className="p-3 rounded-xl bg-[#14203d] border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100 truncate">{paciente.nombre}</h3>
            {onOpenEditarPaciente && (
              <button
                onClick={() => onOpenEditarPaciente(paciente)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2"
              >
                Editar
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-slate-300 text-[11px]">
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-slate-400 shrink-0" />
              <span>{formatPhoneDisplay(paciente.telefono)}</span>
            </div>

            {paciente.dni && (
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-slate-400 shrink-0" />
                <span>DNI: {paciente.dni}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Stethoscope size={13} className="text-blue-400 shrink-0" />
              <span>Cobertura: <strong className="text-slate-200">{paciente.obra_social || 'Particular'}</strong></span>
              {paciente.nro_afiliado && (
                <span className="text-[10px] text-slate-400">({paciente.nro_afiliado})</span>
              )}
            </div>

            {paciente.alertas_medicas && (
              <div className="mt-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[10px] flex items-start gap-1.5">
                <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Alerta:</strong> {paciente.alertas_medicas}</span>
              </div>
            )}
          </div>

          {/* Acciones Rápidas */}
          <div className="pt-2 border-t border-slate-700/60 flex items-center gap-2">
            {onOpenHistoriaClinica && (
              <button
                onClick={() => onOpenHistoriaClinica(paciente.id)}
                className="flex-1 py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <FileText size={12} />
                <span>Historia Clínica</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. PRÓXIMOS TURNOS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-emerald-400" />
              <span>Turnos Agendados</span>
            </h5>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold">
              {turnos.length}
            </span>
          </div>

          {cargandoTurnos ? (
            <div className="p-3 text-center text-slate-400">
              <Loader2 size={16} className="animate-spin mx-auto text-blue-400" />
            </div>
          ) : turnos.length === 0 ? (
            <div className="p-2.5 rounded-xl bg-[#14203d]/40 border border-slate-800 text-center text-slate-400 text-[11px]">
              No registra turnos próximos.
            </div>
          ) : (
            <div className="space-y-1.5">
              {turnos.map((t) => {
                const fecha = new Date(t.fecha_hora)
                const estado = t.estado || 'pendiente'
                return (
                  <div key={t.id} className="p-2.5 rounded-xl bg-[#14203d] border border-slate-700/60 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        {t.especialidad || 'Consulta Médica'}
                      </span>
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        estado === 'confirmado' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' :
                        estado === 'cancelado' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40' :
                        'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                      }`}>
                        {estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10.5px]">
                      <Clock size={12} className="text-slate-400" />
                      <span>{fecha.toLocaleDateString([], { day: '2-digit', month: 'short' })} a las {fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs</span>
                    </div>
                    {t.profesional_nombre && (
                      <p className="text-[10px] text-slate-400">Dr/a: {t.profesional_nombre}</p>
                    )}
                  </div>
                )
              })}
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
                size={15} 
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
    </div>
  )
}

