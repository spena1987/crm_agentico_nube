'use client'

import React, { useState, useMemo } from 'react'
import {
  Users,
  MessageSquare,
  Phone,
  CheckCircle2,
  Award,
  Clock,
  ArrowUpDown,
  Search,
  Info,
  Bot,
  UserCheck,
  FileText
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'

interface DesgloseUsuario {
  mensajes_chat: number
  plantillas_wa: number
  presupuestos_wa: number
  chats_tomados: number
  casos_finalizados: number
  derivaciones_chat: number
  llamadas: number
  presencial: number
  bitacora_interno: number
  estudios_procesados: number
  estudios_leidos: number
  quirofano_lio: number
}

interface UsuarioProductividad {
  id: string | null
  nombre: string
  email: string
  rol: string
  es_oficial: boolean
  es_humano?: boolean
  contactos_totales: number
  acciones_totales?: number
  canales: {
    whatsapp: number
    llamada: number
    presencial: number
    interno: number
  }
  desglose?: DesgloseUsuario
  estudios_procesados: number
  estudios_leidos: number
  presupuestos_relacionados: number
  ultima_actividad: string | null
}

interface Props {
  productividadData: any
  loading: boolean
}

interface InfoCalloutProps {
  titulo: string
  descripcion: string
  items: string[]
  fuente: string
  align?: 'left' | 'center' | 'right'
  direction?: 'down' | 'up'
}

function InfoCallout({
  titulo,
  descripcion,
  items,
  fuente,
  align = 'center',
  direction = 'down'
}: InfoCalloutProps) {
  const [open, setOpen] = useState(false)

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2'

  const dirClass =
    direction === 'up'
      ? 'bottom-full mb-2'
      : 'top-full mt-2'

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className="text-gray-400 hover:text-blue-400 transition-colors p-0.5 rounded-full focus:outline-hidden"
        aria-label={`Información sobre ${titulo}`}
      >
        <Info size={13} />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-72 p-3.5 rounded-xl bg-neutral-950 border border-neutral-700 shadow-2xl text-left normal-case font-normal tracking-normal pointer-events-none ${alignClass} ${dirClass}`}
        >
          <div className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
            <Info size={13} className="text-blue-400 shrink-0" />
            <span>{titulo}</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed mb-2">
            {descripcion}
          </p>
          <ul className="space-y-1 mb-2.5">
            {items.map((it, i) => (
              <li key={i} className="text-[10.5px] text-gray-400 flex items-start gap-1.5 leading-snug">
                <span className="text-blue-400 font-bold">•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
          <div className="pt-1.5 border-t border-neutral-800 flex items-center justify-between text-[10px] text-gray-400">
            <span className="font-semibold text-gray-500 uppercase">Fuente:</span>
            <span className="font-mono text-blue-300 bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-500/20">
              {fuente}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TabProductividadUsuarios({ productividadData }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [ordenarPor, setOrdenarPor] = useState<'acciones' | 'whatsapp' | 'chats' | 'presupuestos' | 'llamadas' | 'estudios'>('acciones')
  const [incluirAutomatismos, setIncluirAutomatismos] = useState(false)
  const [ocultarSinActividad, setOcultarSinActividad] = useState(true)

  const usuariosRaw: UsuarioProductividad[] = productividadData?.usuarios || []

  // Resumen activo según si se incluyen cuentas de sistema/automatismos o solo staff humano
  const resumenActivo = useMemo(() => {
    if (incluirAutomatismos && productividadData?.resumen_incluyendo_sistema) {
      return productividadData.resumen_incluyendo_sistema
    }
    if (productividadData?.resumen_humanos) {
      return productividadData.resumen_humanos
    }
    const ch = productividadData?.canales_totales || { whatsapp: 0, llamada: 0, presencial: 0, interno: 0 }
    return {
      acciones_totales: productividadData?.total_acciones || 0,
      whatsapp_total: ch.whatsapp || 0,
      mensajes_chat: ch.whatsapp || 0,
      plantillas_wa: 0,
      presupuestos_wa: 0,
      llamadas: ch.llamada || 0,
      presencial: ch.presencial || 0,
      casos_finalizados: 0,
      chats_tomados: 0,
      bitacora_interno: ch.interno || 0,
      estudios_procesados: 0,
      quirofano_lio: 0
    }
  }, [productividadData, incluirAutomatismos])

  // Filtrado y ordenamiento de la tabla
  const usuariosFiltrados = useMemo(() => {
    return usuariosRaw
      .filter((u) => {
        const esHumano = u.es_humano !== false
        if (!incluirAutomatismos && !esHumano) return false
        const total = u.acciones_totales ?? u.contactos_totales ?? 0
        if (ocultarSinActividad && total === 0) return false
        if (!busqueda) return true
        const q = busqueda.toLowerCase()
        return (
          u.nombre.toLowerCase().includes(q) ||
          u.rol.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => {
        const da = a.desglose
        const db = b.desglose
        if (ordenarPor === 'whatsapp') {
          return (b.canales?.whatsapp || 0) - (a.canales?.whatsapp || 0)
        }
        if (ordenarPor === 'chats') {
          return ((db?.casos_finalizados || 0) + (db?.chats_tomados || 0)) - ((da?.casos_finalizados || 0) + (da?.chats_tomados || 0))
        }
        if (ordenarPor === 'presupuestos') {
          return (db?.presupuestos_wa || b.presupuestos_relacionados || 0) - (da?.presupuestos_wa || a.presupuestos_relacionados || 0)
        }
        if (ordenarPor === 'llamadas') {
          return (b.canales?.llamada || 0) - (a.canales?.llamada || 0)
        }
        if (ordenarPor === 'estudios') {
          return ((b.estudios_procesados || 0) + (db?.quirofano_lio || 0)) - ((a.estudios_procesados || 0) + (da?.quirofano_lio || 0))
        }
        return (b.acciones_totales ?? b.contactos_totales ?? 0) - (a.acciones_totales ?? a.contactos_totales ?? 0)
      })
  }, [usuariosRaw, busqueda, ordenarPor, incluirAutomatismos, ocultarSinActividad])

  // Datos para el gráfico de barras apiladas (Top 8 colaboradores activos según filtro)
  const chartData = useMemo(() => {
    return usuariosFiltrados
      .filter((u) => (u.acciones_totales ?? u.contactos_totales ?? 0) > 0)
      .slice(0, 8)
      .map((u) => {
        const d = u.desglose
        return {
          nombre: u.nombre.length > 18 ? u.nombre.substring(0, 17) + '…' : u.nombre,
          'Mensajes Chat': d ? d.mensajes_chat : u.canales?.whatsapp || 0,
          'Plantillas & Presup. WA': d ? d.plantillas_wa : 0,
          'Chats Tomados / Resueltos': d ? d.chats_tomados + d.casos_finalizados + d.derivaciones_chat : 0,
          'Llamadas': d ? d.llamadas : u.canales?.llamada || 0,
          'Bitácora Pipeline': d ? d.bitacora_interno + d.presencial : u.canales?.interno || 0,
          'Estudios / Qx': (u.estudios_procesados || 0) + (d?.quirofano_lio || 0)
        }
      })
  }, [usuariosFiltrados])

  const totalAcciones = resumenActivo.acciones_totales || 0
  const totalWhatsapp = resumenActivo.whatsapp_total || 0
  const totalCasosResueltos = resumenActivo.casos_finalizados || 0
  const totalChatsTomados = resumenActivo.chats_tomados || 0
  const totalLlamadas = resumenActivo.llamadas || 0
  const totalBitacora = (resumenActivo.bitacora_interno || 0) + (resumenActivo.presencial || 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Barra Superior de Contexto y Filtro de Personal vs Automatismos */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-neutral-900/90 border border-[var(--border)]">
        <div className="flex items-center gap-2.5 text-xs text-gray-300">
          <UserCheck size={16} className="text-emerald-400 shrink-0" />
          <span>
            Consolidando actividad real en <strong>Bandeja de WhatsApp</strong>, <strong>Pipeline Quirúrgico</strong>, <strong>Estudios Técnicos</strong> y <strong>Quirófano/LIO</strong>.
          </span>
          <span className="text-[11px] text-gray-400 hidden sm:inline">
            (Pasá el cursor sobre <Info size={12} className="inline text-blue-400 -mt-0.5" /> en cada cabecera para ver qué se contabiliza).
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOcultarSinActividad((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              !ocultarSinActividad
                ? 'bg-neutral-800 text-white border-neutral-600'
                : 'bg-neutral-950 text-gray-400 border-[var(--border)] hover:text-gray-200'
            }`}
          >
            {ocultarSinActividad ? 'Mostrar cuentas en 0' : 'Ocultar cuentas en 0'}
          </button>

          <button
            type="button"
            onClick={() => setIncluirAutomatismos((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              incluirAutomatismos
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                : 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30 hover:bg-emerald-950/70'
            }`}
          >
            {incluirAutomatismos ? (
              <>
                <Bot size={14} />
                <span>Incluyendo Automatismos / Genéricos</span>
              </>
            ) : (
              <>
                <UserCheck size={14} />
                <span>Solo Personal Clínico Identificado</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Tarjetas Superiores con InfoCallout en Cabecera */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Acciones Totales */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Acciones Totales
              </span>
              <InfoCallout
                align="left"
                titulo="Acciones Operativas Totales"
                descripcion="Suma integral de todas las interacciones ejecutadas por el personal en el período seleccionado:"
                items={[
                  'Respuestas directas de chat en Bandeja WhatsApp',
                  'Envío de plantillas Meta (Presupuestos PDF, Recordatorios Qx, Consentimientos, Aperturas)',
                  'Toma de conversaciones (ASIGNACION_TOMADA) y cierre de casos (CASO_FINALIZADO)',
                  'Llamadas telefónicas, atención presencial y evoluciones en el Pipeline Quirúrgico',
                  'Estudios técnicos enviados y gestión en Quirófano / LIO'
                ]}
                fuente="mensajes + evoluciones + estudios + qx"
              />
            </div>
            <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-400">
              <Award size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-white tracking-tight">
            {totalAcciones.toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-gray-400">
            {incluirAutomatismos
              ? 'Total incluyendo bots y etiquetas genéricas históricas'
              : 'Total ejecutado por colaboradoras/es identificados'}
          </p>
        </div>

        {/* Card 2: Gestión WhatsApp & Plantillas */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Mensajes & Plantillas WA
              </span>
              <InfoCallout
                align="left"
                titulo="Gestión en WhatsApp (Chat + Plantillas)"
                descripcion="Contabiliza cada mensaje o plantilla oficial despachada hacia pacientes por WhatsApp:"
                items={[
                  `Mensajes directos respondidos en bandeja (${(resumenActivo.mensajes_chat || 0).toLocaleString('es-AR')})`,
                  `Plantillas oficiales Meta enviadas (${(resumenActivo.plantillas_wa || 0).toLocaleString('es-AR')})`,
                  `Incluye ${(resumenActivo.presupuestos_wa || 0).toLocaleString('es-AR')} presupuestos PDF enviados por WhatsApp`,
                  'Se descuentan duplicados de notas espejo en la bitácora'
                ]}
                fuente="public.mensajes (emisor = operador)"
              />
            </div>
            <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {totalWhatsapp.toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-gray-400">
            <span className="text-emerald-300 font-semibold">{resumenActivo.mensajes_chat || 0}</span> chats directos ·{' '}
            <span className="text-emerald-300 font-semibold">{resumenActivo.plantillas_wa || 0}</span> plantillas ({resumenActivo.presupuestos_wa || 0} presup.)
          </p>
        </div>

        {/* Card 3: Casos de Chat Resueltos & Tomados */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Casos de Chat Resueltos
              </span>
              <InfoCallout
                align="center"
                titulo="Resolución de Conversaciones en Bandeja"
                descripcion="Mide la productividad de recepción y asesoramiento en la atención de casos de WhatsApp:"
                items={[
                  `Casos Finalizados (${totalCasosResueltos.toLocaleString('es-AR')}): Conversaciones resueltas y cerradas por la operadora (CASO_FINALIZADO)`,
                  `Chats Tomados (${totalChatsTomados.toLocaleString('es-AR')}): Conversaciones asignadas/reclamadas en bandeja (ASIGNACION_TOMADA)`
                ]}
                fuente="public.mensajes (tipo_evento)"
              />
            </div>
            <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300 tracking-tight">
            {totalCasosResueltos.toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-gray-400">
            <span className="text-cyan-300 font-semibold">{totalChatsTomados.toLocaleString('es-AR')}</span> conversaciones tomadas en bandeja
          </p>
        </div>

        {/* Card 4: Llamadas & Seguimiento Pipeline */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Llamadas & Pipeline Qx
              </span>
              <InfoCallout
                align="right"
                titulo="Llamadas y Bitácora del Pipeline Quirúrgico"
                descripcion="Acciones clínicas registradas en el módulo de Asesoramiento Quirúrgico:"
                items={[
                  `Llamadas telefónicas (${totalLlamadas}): Contactos telefónicos y tareas de seguimiento cumplidas`,
                  `Bitácora Pipeline (${resumenActivo.bitacora_interno || 0}): Evoluciones clínicas, cambios de etapa y notas de seguimiento`,
                  `Atención Presencial (${resumenActivo.presencial || 0}): Entrevistas presenciales reales (excluye sincronizaciones automáticas de presupuestos)`
                ]}
                fuente="public.asesoria_evoluciones"
              />
            </div>
            <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400">
              <Phone size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 tracking-tight">
            {totalLlamadas.toLocaleString('es-AR')}
            <span className="text-sm font-normal text-gray-400 ml-2">
              (+{totalBitacora} en bitácora)
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            <span className="text-amber-300 font-semibold">{totalLlamadas}</span> llamadas ·{' '}
            <span className="text-purple-300 font-semibold">{resumenActivo.bitacora_interno || 0}</span> notas pipeline ·{' '}
            <span className="text-gray-300 font-semibold">{resumenActivo.presencial || 0}</span> presenciales
          </p>
        </div>
      </div>

      {/* Gráfico de Barras Apiladas por Colaborador */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              <h3 className="text-sm font-bold text-white">
                Comparativa de Actividad por Colaboradora/or y Tipo de Gestión
              </h3>
              <InfoCallout
                align="left"
                titulo="Gráfico Comparativo Apilado"
                descripcion="Muestra la composición del trabajo de cada integrante del staff en el período:"
                items={[
                  'Mensajes Chat (Verde): Respuestas directas escritas o enviadas en WhatsApp',
                  'Plantillas & Presup. WA (Esmeralda claro): Envío de presupuestos PDF, recordatorios de cirugía y consentimientos',
                  'Chats Tomados / Resueltos (Azul): Asignaciones tomadas y conversaciones finalizadas en la bandeja',
                  'Llamadas (Ámbar): Llamadas telefónicas de seguimiento en el Pipeline Quirúrgico',
                  'Bitácora Pipeline (Violeta): Notas internas, cambios de etapa y atención presencial',
                  'Estudios / Qx (Cian): Estudios oftalmológicos enviados y gestión de turnos/LIO'
                ]}
                fuente="Consolidado Multi-Módulo"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Desglose de interacciones operativas, conversaciones resueltas, llamadas y estudios en el período seleccionado
            </p>
          </div>
        </div>

        <div className="h-68 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-[var(--border)] rounded-xl">
              No hay acciones registradas con los filtros actuales.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis
                  dataKey="nombre"
                  stroke="#a3a3a3"
                  fontSize={11}
                  angle={-12}
                  textAnchor="end"
                />
                <YAxis stroke="#737373" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171717',
                    borderColor: '#404040',
                    borderRadius: '12px',
                    fontSize: '11px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Mensajes Chat" stackId="a" fill="#10b981" />
                <Bar dataKey="Plantillas & Presup. WA" stackId="a" fill="#34d399" />
                <Bar dataKey="Chats Tomados / Resueltos" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Llamadas" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Bitácora Pipeline" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="Estudios / Qx" stackId="a" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabla Detallada de Productividad del Staff */}
      <div className="rounded-2xl bg-neutral-900 border border-[var(--border)] overflow-visible shadow-sm space-y-0">
        <div className="p-4 sm:px-6 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Matriz Individual de Productividad</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-gray-300 border border-neutral-700">
              {usuariosFiltrados.length} registros
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Buscador */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar colaboradora..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="text-xs bg-neutral-950 border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-gray-200 focus:outline-hidden focus:border-blue-500 w-48"
              />
            </div>

            {/* Selector de ordenamiento */}
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <ArrowUpDown size={13} className="text-gray-400" />
              <select
                value={ordenarPor}
                onChange={(e: any) => setOrdenarPor(e.target.value)}
                className="text-xs bg-neutral-950 border border-[var(--border)] rounded-xl px-2.5 py-1.5 text-gray-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="acciones">Ordenar: Más Acciones Totales</option>
                <option value="whatsapp">Ordenar: Más Mensajes & Plantillas WA</option>
                <option value="chats">Ordenar: Más Chats Resueltos / Tomados</option>
                <option value="presupuestos">Ordenar: Más Presupuestos Enviados</option>
                <option value="llamadas">Ordenar: Más Llamadas Telefónicas</option>
                <option value="estudios">Ordenar: Más Estudios / Qx</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-8">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/80 text-gray-400 font-bold border-b border-[var(--border)] uppercase text-[10.5px]">
              <tr>
                <th className="py-3.5 px-3 text-center">#</th>
                <th className="py-3.5 px-4">Colaborador/a</th>
                <th className="py-3.5 px-3">Rol / Función</th>

                <th className="py-3.5 px-3 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Acciones Totales</span>
                    <InfoCallout
                      align="center"
                      titulo="Acciones Totales por Usuario"
                      descripcion="Suma de todas las acciones operativas atribuibles al usuario en todos los módulos del CRM:"
                      items={[
                        'Mensajes directos de chat + Plantillas Meta enviadas',
                        'Conversaciones tomadas (ASIGNACION_TOMADA) + Casos cerrados (CASO_FINALIZADO)',
                        'Llamadas telefónicas + Notas en bitácora del Pipeline Quirúrgico',
                        'Estudios oftalmológicos procesados + Turnos Qx y LIO'
                      ]}
                      fuente="Suma Integral Multi-Tabla"
                    />
                  </div>
                </th>

                <th className="py-3.5 px-3 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Chats (Tom. / Res.)</span>
                    <InfoCallout
                      align="center"
                      titulo="Gestión de Bandeja (Tomados / Resueltos)"
                      descripcion="Mide la toma de casos y resolución de conversaciones en la bandeja de WhatsApp:"
                      items={[
                        'Tomados: Veces que la operadora tomó o se asignó un chat entrante (ASIGNACION_TOMADA)',
                        'Resueltos: Conversaciones finalizadas y cerradas tras dar respuesta al paciente (CASO_FINALIZADO)'
                      ]}
                      fuente="public.mensajes (metadata_json)"
                    />
                  </div>
                </th>

                <th className="py-3.5 px-3 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Chat & Plantillas WA</span>
                    <InfoCallout
                      align="center"
                      titulo="Mensajes de Chat y Plantillas WhatsApp"
                      descripcion="Total de envíos hacia el paciente por WhatsApp Línea Asistencial:"
                      items={[
                        'Número principal: Suma de mensajes directos de chat + plantillas oficiales',
                        'Subtítulo: Desglose entre mensajes libres escritos en bandeja y plantillas Meta disparadas'
                      ]}
                      fuente="public.mensajes + asesoria_evoluciones"
                    />
                  </div>
                </th>

                <th className="py-3.5 px-3 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Presup. WA</span>
                    <InfoCallout
                      align="center"
                      titulo="Presupuestos Enviados por WhatsApp"
                      descripcion="Cantidad de presupuestos médicos en PDF despachados al paciente mediante la plantilla oficial:"
                      items={[
                        'Contabiliza envíos con template_name = presupuesto_entrega_pdf atribuidos al operador',
                        'Subconjunto incluido dentro de Plantillas WA, destacado por su impacto comercial directo'
                      ]}
                      fuente="public.mensajes (presupuesto_entrega_pdf)"
                    />
                  </div>
                </th>

                <th className="py-3.5 px-3 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Llamadas</span>
                    <InfoCallout
                      align="center"
                      titulo="Llamadas Telefónicas"
                      descripcion="Contactos telefónicos salientes o entrantes registrados en el seguimiento del paciente:"
                      items={[
                        'Evoluciones cargadas con canal "Llamada" en la ficha del Pipeline Quirúrgico',
                        'Tareas programadas de llamado marcadas como cumplidas'
                      ]}
                      fuente="public.asesoria_evoluciones (llamada)"
                    />
                  </div>
                </th>

                <th className="py-3.5 px-3 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Bitácora / Pres.</span>
                    <InfoCallout
                      align="right"
                      titulo="Bitácora Pipeline y Atención Presencial"
                      descripcion="Registros de seguimiento administrativo/clínico dentro del Pipeline Quirúrgico:"
                      items={[
                        'Notas internas de seguimiento, recotizaciones, cambios de estado y derivaciones',
                        'Entrevistas de asesoramiento presencial real en clínica',
                        'Excluye sincronizaciones automáticas de presupuestos del sistema'
                      ]}
                      fuente="public.asesoria_evoluciones"
                    />
                  </div>
                </th>

                <th className="py-3.5 px-3 text-center">
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Estudios / Qx</span>
                    <InfoCallout
                      align="right"
                      titulo="Estudios Oftalmológicos y Quirófano/LIO"
                      descripcion="Productividad técnica en Consola de Estudios y Programación Quirúrgica:"
                      items={[
                        'Estudios PDF capturados de Geclisa y enviados por WhatsApp Línea 2 (con indicador de lectura)',
                        'Turnos quirúrgicos dados de alta, cálculos biométricos de LIO confirmados y reservas de stock'
                      ]}
                      fuente="estudios_oftalmo + turnos_quirofano"
                    />
                  </div>
                </th>

                <th className="py-3.5 px-4 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span>Últ. Actividad</span>
                    <InfoCallout
                      align="right"
                      titulo="Última Actividad Registrada"
                      descripcion="Fecha y hora de la interacción más reciente registrada por esta colaboradora en cualquiera de los módulos auditados."
                      items={[
                        'Se actualiza con mensajes de chat, cierre de casos, llamadas, notas de bitácora o envío de estudios'
                      ]}
                      fuente="Timestamp más reciente"
                    />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)]/60">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-gray-500">
                    No se encontraron registros de productividad con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u, idx) => {
                  const esHumano = u.es_humano !== false
                  const esTop3 = esHumano && idx < 3
                  const medalla = esHumano ? (idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null) : null
                  const total = u.acciones_totales ?? u.contactos_totales ?? 0
                  const d = u.desglose

                  const tomados = d?.chats_tomados || 0
                  const resueltos = d?.casos_finalizados || 0
                  const msgChat = d ? d.mensajes_chat : u.canales?.whatsapp || 0
                  const tplWa = d ? d.plantillas_wa : 0
                  const totalWaUser = msgChat + tplWa
                  const presupWa = d ? d.presupuestos_wa : u.presupuestos_relacionados || 0
                  const llamadasUser = d ? d.llamadas : u.canales?.llamada || 0
                  const bitacoraUser = (d ? d.bitacora_interno : u.canales?.interno || 0) + (d ? d.presencial : u.canales?.presencial || 0)
                  const estudiosQxUser = (u.estudios_procesados || 0) + (d?.quirofano_lio || 0)

                  return (
                    <tr key={u.nombre + idx} className="hover:bg-neutral-800/40 transition-colors">
                      {/* Posición / Medalla */}
                      <td className="py-3 px-3 text-center font-bold text-gray-400">
                        {medalla ? <span className="text-sm">{medalla}</span> : idx + 1}
                      </td>

                      {/* Nombre del colaborador */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              !esHumano
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                                : esTop3
                                ? 'bg-blue-600 text-white'
                                : 'bg-neutral-800 text-gray-300'
                            }`}
                          >
                            {!esHumano ? <Bot size={13} /> : u.nombre.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block">{u.nombre}</span>
                            {u.email && <span className="text-[10px] text-gray-400 block">{u.email}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10.5px] ${
                            !esHumano
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                              : 'bg-neutral-800 text-gray-300'
                          }`}
                        >
                          {u.rol}
                        </span>
                      </td>

                      {/* Acciones Totales */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-white">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/30">
                          {total.toLocaleString('es-AR')}
                        </span>
                      </td>

                      {/* Chats (Tomados / Resueltos) */}
                      <td className="py-3 px-3 text-center font-mono">
                        {tomados > 0 || resueltos > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-300 font-bold text-xs">
                              {tomados} <span className="text-gray-500 font-normal">/</span> {resueltos}
                            </span>
                            <span className="text-[9.5px] text-gray-400 font-sans">
                              tom. / cierres
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>

                      {/* Mensajes & Plantillas WA */}
                      <td className="py-3 px-3 text-center font-mono">
                        {totalWaUser > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="text-emerald-400 font-bold text-xs">
                              {totalWaUser.toLocaleString('es-AR')}
                            </span>
                            <span className="text-[9.5px] text-gray-400 font-sans">
                              {msgChat} chat · {tplWa} plant.
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>

                      {/* Presupuestos WA */}
                      <td className="py-3 px-3 text-center font-mono">
                        {presupWa > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
                            <FileText size={11} />
                            {presupWa}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>

                      {/* Llamadas */}
                      <td className="py-3 px-3 text-center font-mono text-amber-400 font-semibold">
                        {llamadasUser > 0 ? llamadasUser : <span className="text-gray-600">-</span>}
                      </td>

                      {/* Bitácora / Presencial */}
                      <td className="py-3 px-3 text-center font-mono text-purple-300 font-semibold">
                        {bitacoraUser > 0 ? bitacoraUser : <span className="text-gray-600">-</span>}
                      </td>

                      {/* Estudios / Qx */}
                      <td className="py-3 px-3 text-center font-mono">
                        {estudiosQxUser > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-bold text-[11px]">
                              {estudiosQxUser}
                            </span>
                            {u.estudios_leidos > 0 && (
                              <span className="text-[9.5px] text-gray-400 font-sans mt-0.5">
                                {u.estudios_leidos} leídos
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>

                      {/* Última Actividad */}
                      <td className="py-3 px-4 text-right text-gray-400 font-mono text-[11px]">
                        {u.ultima_actividad ? (
                          <div className="flex items-center justify-end gap-1">
                            <Clock size={12} className="text-gray-500" />
                            <span>{new Date(u.ultima_actividad).toLocaleDateString('es-AR')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
