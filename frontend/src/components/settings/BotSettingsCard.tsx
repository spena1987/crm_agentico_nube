'use client'

import React, { useState, useEffect } from 'react'
import { 
  Bot, 
  Sparkles, 
  ShieldAlert, 
  Save, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  Clock, 
  Layers, 
  Sliders, 
  HelpCircle, 
  Activity, 
  HeartHandshake, 
  CalendarCheck, 
  ReceiptText, 
  Stethoscope, 
  AlertCircle,
  Check,
  RotateCcw,
  PhoneForwarded,
  UserCheck
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'

export interface HandoverSettings {
  auto_escalamiento_activo: boolean
  max_reintentos_incomprension: number
  mensaje_reintento: string
  mensaje_derivacion: string
  mensaje_post_dni: string
  palabras_clave_escape: string[]
}

interface GlobalDirectives {
  id?: string
  nombre_clinica: string
  tono_general: string
  guardrails_medicos: string
  politica_escalamiento: string
  politica_turnos: string
  politica_presupuestos: string
  agente_defecto_codigo: string
}

interface SituationalAgent {
  id?: string
  codigo: string
  nombre: string
  descripcion: string
  activo: boolean
  temperatura: number
  directiva_particular: string
  herramientas_habilitadas: string[]
  orden?: number
}

export default function BotSettingsCard() {
  const [subTab, setSubTab] = useState<'globales' | 'agentes' | 'handover' | 'simulador' | 'motor'>('agentes')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Directivas Globales
  const [globales, setGlobales] = useState<GlobalDirectives>({
    nombre_clinica: 'Centrovisión Oftalmología Integral',
    tono_general: 'Profesional, empático, claro y resolutivo en todo momento.',
    guardrails_medicos: 'PROHIBICIÓN ESTRICTA: No des diagnósticos médicos, interpretaciones de síntomas ni prescripciones farmacológicas. Si el paciente consulta sobre síntomas o requiere atención médica urgente, explícale que lo derivarás con un profesional de la salud y utiliza la herramienta de escalamiento.',
    politica_escalamiento: 'Si el paciente solicita hablar con un humano, presenta dudas clínicas complejas o expresa enojo/frustración, invoca de inmediato la herramienta escalar_a_operador_humano indicando el motivo.',
    politica_turnos: 'Para turnos, ofrece un máximo de 2 opciones claras de fecha/horario y confirma nombre y DNI del paciente.',
    politica_presupuestos: 'Para cotizaciones, informa los valores con claridad, formas de pago disponibles y aclara la vigencia del presupuesto.',
    agente_defecto_codigo: 'GENERAL'
  })

  // Agentes Situacionales
  const [agentes, setAgentes] = useState<SituationalAgent[]>([])
  const [editingAgent, setEditingAgent] = useState<SituationalAgent | null>(null)
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)

  // Políticas de Derivación & Handover
  const [handover, setHandover] = useState<HandoverSettings>({
    auto_escalamiento_activo: true,
    max_reintentos_incomprension: 2,
    mensaje_reintento: 'Disculpá, no logré comprender bien tu consulta. ¿Podrías indicarme si necesitás agendar un turno, solicitar un presupuesto o hablar con una asesora quirúrgica?',
    mensaje_derivacion: 'He transferido tu consulta con nuestro equipo de secretaría y asesoría quirúrgica. Un operador humano continuará contigo a la brevedad. ¡Muchas gracias por tu paciencia!',
    mensaje_post_dni: '¡Hola *{nombre}*! Hemos localizado tu ficha en el sistema (Cobertura: *{cobertura}*).\n\n¿Deseas consultar sobre tu presupuesto, coordinar un turno o hablar con una asesora quirúrgica?',
    palabras_clave_escape: [
      'humano', 'operador', 'persona', 'asesor', 'asesora',
      'asesora quirurgica', 'secretaria', 'doctor directo',
      'hablar con alguien', 'urgencia', 'reclamo'
    ]
  })
  const [newKeyword, setNewKeyword] = useState('')

  // Parámetros Generales del Bot (Settings)
  const [botEnabled, setBotEnabled] = useState(true)
  const [typingDelay, setTypingDelay] = useState(3)
  const [modelName, setModelName] = useState('gemini-3.5-flash')

  // Simulador / Playground
  const [simAgentCode, setSimAgentCode] = useState('AUTO')
  const [simMessage, setSimMessage] = useState('Hola, quiero consultar por una cirugía de vesícula y qué requisitos necesito.')
  const [simRunning, setSimRunning] = useState(false)
  const [simResult, setSimResult] = useState<{
    respuesta: string
    agente_utilizado?: { codigo: string; nombre: string; temperatura: number }
    duracion_ms?: number
  } | null>(null)

  const toolOptions = [
    { key: 'buscar_disponibilidad_turnos', label: '📅 Agenda & Turnos', desc: 'Búsqueda de slots y disponibilidad médica en Geclisa' },
    { key: 'crear_borrador_presupuesto', label: '💰 Presupuestador', desc: 'Cálculo de aranceles y emisión de cotizaciones' },
    { key: 'aprobar_presupuesto', label: '✅ Aprobador Presupuestos', desc: 'Confirma presupuestos aprobados y actualiza quirófano' },
    { key: 'desestimar_presupuesto', label: '❌ Desestimar Presupuestos', desc: 'Registra rechazo de presupuesto capturando motivo de baja' },
    { key: 'consultar_presupuestos_paciente', label: '📑 Historial Presupuestos', desc: 'Consulta cotizaciones y estado de presupuestos' },
    { key: 'vincular_paciente_geclisa', label: '🏥 Identificación Geclisa', desc: 'Búsqueda de DNI y vinculación de ficha médica' },
    { key: 'consultar_preparacion_cirugia', label: '🩺 Prequirúrgico & Ayuno', desc: 'Pautas de preparación y detalles de cirugía' },
    { key: 'escalar_a_operador_humano', label: '🚨 Derivación Humana', desc: 'Pausa el bot y transfiere al equipo médico/secretaría' },
    { key: 'finalizar_y_cerrar_consulta', label: '🏁 Cierre de Consulta', desc: 'Finaliza y archiva la conversación al completar trámite' }
  ]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      
      // 1. Cargar Configuración Multi-Agente
      const resAg = await fetch(`${BACKEND_URL}/api/agentes/config`)
      if (resAg.ok) {
        const data = await resAg.json()
        if (data.globales) setGlobales(data.globales)
        if (data.agentes) setAgentes(data.agentes)
      }

      // 2. Cargar Settings Generales
      const resSet = await fetch(`${BACKEND_URL}/api/settings`)
      if (resSet.ok) {
        const setData = await resSet.json()
        const bot = setData.bot || {}
        setBotEnabled(bot.enabled ?? true)
        setTypingDelay(bot.typing_delay_seconds ?? 3)
        setModelName(bot.model_name || 'gemini-3.5-flash')
        if (bot.handover) {
          setHandover(prev => ({
            ...prev,
            ...bot.handover,
            palabras_clave_escape: Array.isArray(bot.handover.palabras_clave_escape)
              ? bot.handover.palabras_clave_escape
              : prev.palabras_clave_escape
          }))
        }
      }
    } catch (err: any) {
      console.error('Error cargando configuración multi-agente:', err)
      setErrorMessage('No se pudo conectar con el backend. Verifique que esté en ejecución.')
    } finally {
      setLoading(false)
    }
  }

  const showFeedbackMsg = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  // Guardar Políticas de Handover & Derivación
  const handleSaveHandover = async () => {
    try {
      setSaving(true)
      setErrorMessage(null)
      const payload = {
        bot: {
          handover: handover
        }
      }
      const res = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        showFeedbackMsg('¡Políticas de derivación y reintentos guardadas con éxito!')
      } else {
        const err = await res.json()
        setErrorMessage(err.detail || 'Error guardando políticas de derivación.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de red al guardar políticas.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddKeyword = () => {
    const val = newKeyword.trim().toLowerCase()
    if (!val) return
    if (!handover.palabras_clave_escape.includes(val)) {
      setHandover(prev => ({
        ...prev,
        palabras_clave_escape: [...prev.palabras_clave_escape, val]
      }))
    }
    setNewKeyword('')
  }

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setHandover(prev => ({
      ...prev,
      palabras_clave_escape: prev.palabras_clave_escape.filter(k => k !== keywordToRemove)
    }))
  }

  const handleResetDefaultKeywords = () => {
    const defaultKws = [
      'humano', 'operador', 'persona', 'asesor', 'asesora',
      'asesora quirurgica', 'secretaria', 'doctor directo',
      'hablar con alguien', 'urgencia', 'reclamo'
    ]
    setHandover(prev => ({
      ...prev,
      palabras_clave_escape: defaultKws
    }))
    showFeedbackMsg('Palabras clave restauradas a valores sugeridos.')
  }

  // Guardar Directivas Globales
  const handleSaveGlobales = async () => {
    try {
      setSaving(true)
      setErrorMessage(null)
      const res = await fetch(`${BACKEND_URL}/api/agentes/globales`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globales)
      })
      if (res.ok) {
        showFeedbackMsg('¡Directivas globales de la clínica guardadas con éxito!')
      } else {
        const err = await res.json()
        setErrorMessage(err.detail || 'Error guardando directivas globales.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de red guardando directivas.')
    } finally {
      setSaving(false)
    }
  }

  // Guardar / Actualizar Agente Situacional
  const handleSaveAgent = async (agentToSave: SituationalAgent) => {
    try {
      setSaving(true)
      setErrorMessage(null)

      let res
      if (agentToSave.id) {
        // Update
        res = await fetch(`${BACKEND_URL}/api/agentes/situacionales/${agentToSave.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentToSave)
        })
      } else {
        // Create
        res = await fetch(`${BACKEND_URL}/api/agentes/situacionales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentToSave)
        })
      }

      if (res.ok) {
        showFeedbackMsg(`¡Agente '${agentToSave.nombre}' guardado exitosamente!`)
        setEditingAgent(null)
        setIsCreatingAgent(false)
        await fetchData()
      } else {
        const err = await res.json()
        setErrorMessage(err.detail || 'Error al guardar el agente.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión guardando agente.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle rápido de Activo/Inactivo de un agente
  const handleToggleAgentActive = async (agent: SituationalAgent) => {
    const updated = { ...agent, activo: !agent.activo }
    try {
      if (agent.id) {
        await fetch(`${BACKEND_URL}/api/agentes/situacionales/${agent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        })
      }
      setAgentes(agentes.map(a => a.codigo === agent.codigo ? updated : a))
      showFeedbackMsg(`Agente '${agent.nombre}' ${updated.activo ? 'activado' : 'pausado'}.`)
    } catch (err) {
      console.error('Error alternando estado del agente:', err)
    }
  }

  // Eliminar Agente Situacional
  const handleDeleteAgent = async (agentId?: string, agentName?: string) => {
    if (!agentId) return
    if (!confirm(`¿Estás seguro de eliminar el agente '${agentName}'? Esta acción no se puede deshacer.`)) return
    try {
      setSaving(true)
      const res = await fetch(`${BACKEND_URL}/api/agentes/situacionales/${agentId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showFeedbackMsg(`Agente '${agentName}' eliminado.`)
        await fetchData()
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al eliminar el agente.')
    } finally {
      setSaving(false)
    }
  }

  // Guardar Parámetros de Motor General
  const handleSaveMotorSettings = async () => {
    try {
      setSaving(true)
      setErrorMessage(null)
      const payload = {
        bot: {
          enabled: botEnabled,
          typing_delay_seconds: Number(typingDelay),
          model_name: modelName,
        }
      }
      const res = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        showFeedbackMsg('¡Ajustes generales del motor guardados!')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error guardando ajustes.')
    } finally {
      setSaving(false)
    }
  }

  // Ejecutar Simulación en Vivo
  const handleRunSimulation = async () => {
    if (!simMessage.trim()) return
    try {
      setSimRunning(true)
      setSimResult(null)
      const res = await fetch(`${BACKEND_URL}/api/agentes/simulador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: simMessage,
          agente_codigo: simAgentCode
        })
      })
      if (res.ok) {
        const data = await res.json()
        setSimResult(data)
      } else {
        const err = await res.json()
        setErrorMessage(err.detail || 'Error ejecutando la simulación.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el simulador.')
    } finally {
      setSimRunning(false)
    }
  }

  const getAgentBadgeIcon = (code: string) => {
    switch (code) {
      case 'TURNOS_CONCRETOS':
        return <CalendarCheck className="text-blue-500" size={18} />
      case 'QUIRURGICO_EMPATICO':
        return <HeartHandshake className="text-rose-500" size={18} />
      case 'PRESUPUESTOS_COMERCIAL':
        return <ReceiptText className="text-emerald-500" size={18} />
      case 'POST_OPERATORIO':
        return <Activity className="text-purple-500" size={18} />
      default:
        return <Stethoscope className="text-slate-500" size={18} />
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <Bot className="animate-bounce text-blue-600 mx-auto mb-3" size={32} />
        <p className="text-sm font-medium text-[var(--secondary)]">Cargando sistema multi-agente...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Notificaciones de Feedback */}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5 text-sm font-medium animate-fade-in shadow-sm">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center gap-2.5 text-sm font-medium animate-fade-in shadow-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Cabecera y Navegación de Sub-Pestañas */}
      <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-blue-600/10 text-blue-600">
              <Bot size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Sistema Multi-Agente & Prompt Layering</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  Google Gemini 3.5/3.7
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Configura directivas generales para la clínica y personalidades especializadas según la situación del paciente.
              </p>
            </div>
          </div>

          {/* Sub-Tabs Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-[var(--border)] self-start md:self-auto">
            <button
              onClick={() => setSubTab('agentes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'agentes'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <Layers size={14} />
              <span>Agentes Situacionales</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700">
                {agentes.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab('globales')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'globales'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <ShieldAlert size={14} />
              <span>Pautas & Directivas</span>
            </button>

            <button
              onClick={() => setSubTab('handover')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'handover'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <PhoneForwarded size={14} />
              <span>Derivación & Reintentos</span>
            </button>

            <button
              onClick={() => setSubTab('simulador')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'simulador'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <Play size={14} />
              <span>Simulador en Vivo</span>
            </button>

            <button
              onClick={() => setSubTab('motor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === 'motor'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
              }`}
            >
              <Sliders size={14} />
              <span>Motor IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. SUBTAB: AGENTES SITUACIONALES                                     */}
      {/* ==================================================================== */}
      {subTab === 'agentes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-base">Perfiles y Pautas por Situación</h4>
              <p className="text-xs text-[var(--secondary)]">
                El CRM asignará automáticamente o manualmente el agente ideal según el tipo de consulta del paciente.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAgent({
                  codigo: '',
                  nombre: '',
                  descripcion: '',
                  activo: true,
                  temperatura: 0.2,
                  directiva_particular: '',
                  herramientas_habilitadas: ['buscar_disponibilidad_turnos', 'escalar_a_operador_humano']
                })
                setIsCreatingAgent(true)
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition shadow-sm"
            >
              <Plus size={16} />
              <span>Crear Nuevo Agente</span>
            </button>
          </div>

          {/* Grilla de Tarjetas de Agentes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agentes.map((ag) => (
              <div 
                key={ag.codigo}
                className={`p-5 rounded-2xl border transition-all ${
                  ag.activo 
                    ? 'bg-[var(--card)] border-[var(--border)] shadow-sm hover:border-blue-500/40' 
                    : 'bg-slate-50 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 mt-0.5">
                      {getAgentBadgeIcon(ag.codigo)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm text-[var(--foreground)]">{ag.nombre}</h5>
                        {ag.codigo === globales.agente_defecto_codigo && (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            POR DEFECTO
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 font-semibold">{ag.codigo}</span>
                      <p className="text-xs text-[var(--secondary)] mt-1.5 line-clamp-2">
                        {ag.descripcion || ag.directiva_particular}
                      </p>
                    </div>
                  </div>

                  {/* Switch ON/OFF */}
                  <button
                    onClick={() => handleToggleAgentActive(ag)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                      ag.activo 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {ag.activo ? 'ACTIVO' : 'PAUSADO'}
                  </button>
                </div>

                {/* Detalle de Directiva Particular */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[var(--border)] text-xs text-[var(--secondary)] italic line-clamp-3">
                  "{ag.directiva_particular}"
                </div>

                {/* Herramientas & Temperatura */}
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {ag.herramientas_habilitadas?.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-[var(--secondary)]">
                        {t === 'buscar_disponibilidad_turnos' && '📅 Turnos'}
                        {t === 'crear_borrador_presupuesto' && '💰 Presupuestos'}
                        {t === 'escalar_a_operador_humano' && '🚨 Escalamiento'}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingAgent({ ...ag })
                        setIsCreatingAgent(false)
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 transition"
                      title="Editar Agente"
                    >
                      <Edit3 size={15} />
                    </button>
                    {ag.codigo !== 'GENERAL' && (
                      <button
                        onClick={() => handleDeleteAgent(ag.id, ag.nombre)}
                        className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 transition"
                        title="Eliminar Agente"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal / Editor de Agente Situacional */}
          {editingAgent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
                      <Edit3 size={20} />
                    </div>
                    <h4 className="font-bold text-base">
                      {isCreatingAgent ? 'Crear Nuevo Agente Situacional' : `Editar Agente: ${editingAgent.nombre}`}
                    </h4>
                  </div>
                  <button 
                    onClick={() => setEditingAgent(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--secondary)]"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold mb-1.5">Nombre del Agente</label>
                      <input 
                        type="text" 
                        value={editingAgent.nombre}
                        onChange={(e) => setEditingAgent({ ...editingAgent, nombre: e.target.value })}
                        placeholder="Ej. Atención Quirúrgica y Alta Contención"
                        className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1.5">Código Único (Identificador)</label>
                      <input 
                        type="text" 
                        value={editingAgent.codigo}
                        disabled={!isCreatingAgent}
                        onChange={(e) => setEditingAgent({ ...editingAgent, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                        placeholder="EJ: QUIRURGICO_EMPATICO"
                        className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold mb-1.5">Descripción de Uso</label>
                    <input 
                      type="text" 
                      value={editingAgent.descripcion}
                      onChange={(e) => setEditingAgent({ ...editingAgent, descripcion: e.target.value })}
                      placeholder="Breve resumen de cuándo se activa o aplica este perfil..."
                      className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)]"
                    />
                  </div>

                  {/* Directiva Particular (Prompt Específico) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Sparkles size={14} />
                        <span>Directiva Particular & Pauta de Comportamiento</span>
                      </label>
                      <span className="text-[11px] text-[var(--secondary)]">Capa 3 de Prompt Layering</span>
                    </div>
                    <textarea 
                      rows={5}
                      value={editingAgent.directiva_particular}
                      onChange={(e) => setEditingAgent({ ...editingAgent, directiva_particular: e.target.value })}
                      placeholder="Escribe las instrucciones detalladas de tono, empatía, rapidez y reglas particulares para este caso..."
                      className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] leading-relaxed font-sans"
                    />
                  </div>

                  {/* Slider de Temperatura / Creatividad */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold">Temperatura / Precisión: {editingAgent.temperatura}</label>
                      <span className="text-[10px] text-[var(--secondary)]">
                        {editingAgent.temperatura <= 0.15 ? 'Máxima Precisión (Ideal Turnos)' : editingAgent.temperatura <= 0.35 ? 'Equilibrado' : 'Cálido & Empático'}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="0.8" 
                      step="0.05"
                      value={editingAgent.temperatura}
                      onChange={(e) => setEditingAgent({ ...editingAgent, temperatura: parseFloat(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Herramientas Permitidas */}
                  <div>
                    <label className="block font-bold mb-2">Herramientas Habilitadas (Function Calling)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {toolOptions.map((t) => {
                        const isChecked = editingAgent.herramientas_habilitadas.includes(t.key)
                        return (
                          <button
                            type="button"
                            key={t.key}
                            onClick={() => {
                              const current = editingAgent.herramientas_habilitadas
                              const next = isChecked ? current.filter(x => x !== t.key) : [...current, t.key]
                              setEditingAgent({ ...editingAgent, herramientas_habilitadas: next })
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isChecked 
                                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold' 
                                : 'border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs">{t.label}</span>
                              {isChecked && <Check size={14} />}
                            </div>
                            <p className="text-[10px] font-normal text-[var(--secondary)] mt-1">{t.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setEditingAgent(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={saving || !editingAgent.nombre || !editingAgent.codigo}
                    onClick={() => handleSaveAgent(editingAgent)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-blue-600/20"
                  >
                    <Save size={16} />
                    <span>{saving ? 'Guardando...' : 'Guardar Agente'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. SUBTAB: DIRECTIVAS GLOBALES DE LA CLÍNICA                         */}
      {/* ==================================================================== */}
      {subTab === 'globales' && (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            <div>
              <h4 className="font-bold text-base">Directivas Globales y Guardrails Institucionales</h4>
              <p className="text-xs text-[var(--secondary)]">
                Estas directivas se inyectan como base en todos los agentes y garantizan la seguridad médica y legal.
              </p>
            </div>
            <button
              onClick={handleSaveGlobales}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-blue-600/20"
            >
              <Save size={16} />
              <span>{saving ? 'Guardando...' : 'Guardar Directivas'}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold">Nombre de la Institución / Clínica</label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    Sincronizado con Perfil de Clínica
                  </span>
                </div>
                <input 
                  type="text" 
                  value={globales.nombre_clinica}
                  onChange={(e) => setGlobales({ ...globales, nombre_clinica: e.target.value })}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] font-medium"
                  placeholder="ej: Centrovisión Oftalmología Integral"
                />
                <p className="text-[10px] text-[var(--secondary)] mt-1">
                  Se inyecta automáticamente en el system prompt de Gemini y en todas las respuestas de WhatsApp.
                </p>
              </div>

              <div>
                <label className="block font-bold mb-1.5">Agente Asignado por Defecto</label>
                <select 
                  value={globales.agente_defecto_codigo}
                  onChange={(e) => setGlobales({ ...globales, agente_defecto_codigo: e.target.value })}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] font-medium"
                >
                  {agentes.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nombre} ({a.codigo})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1.5">Tono Institucional Base</label>
              <input 
                type="text" 
                value={globales.tono_general}
                onChange={(e) => setGlobales({ ...globales, tono_general: e.target.value })}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]"
                placeholder="Profesional, empático, claro y resolutivo..."
              />
            </div>

            {/* Guardrails Médicos Inviolables */}
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
              <label className="font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <ShieldAlert size={16} />
                <span>Guardrails y Restricciones Médicas (Inviolables)</span>
              </label>
              <p className="text-[11px] text-[var(--secondary)]">
                Límites obligatorios para todos los agentes. Prohíbe prescripciones, diagnósticos y exige derivación médica.
              </p>
              <textarea 
                rows={3}
                value={globales.guardrails_medicos}
                onChange={(e) => setGlobales({ ...globales, guardrails_medicos: e.target.value })}
                className="w-full p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-[var(--card)] leading-relaxed font-sans"
              />
            </div>

            {/* Política de Escalamiento Humano */}
            <div>
              <label className="block font-bold mb-1.5">Política de Escalamiento a Personal Humano</label>
              <textarea 
                rows={2}
                value={globales.politica_escalamiento}
                onChange={(e) => setGlobales({ ...globales, politica_escalamiento: e.target.value })}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] leading-relaxed"
              />
            </div>

            {/* Políticas de Turnos y Presupuestos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1.5">Pauta Global de Turnos</label>
                <textarea 
                  rows={2}
                  value={globales.politica_turnos}
                  onChange={(e) => setGlobales({ ...globales, politica_turnos: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1.5">Pauta Global de Presupuestos</label>
                <textarea 
                  rows={2}
                  value={globales.politica_presupuestos}
                  onChange={(e) => setGlobales({ ...globales, politica_presupuestos: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBTAB: POLÍTICAS DE DERIVACIÓN & REINTENTOS (HANDOVER MANAGEMENT)   */}
      {/* ==================================================================== */}
      {subTab === 'handover' && (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-6 animate-fade-in">
          {/* Cabecera y Botón Guardar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
            <div>
              <h4 className="font-bold text-base flex items-center gap-2">
                <PhoneForwarded size={18} className="text-blue-600 dark:text-blue-400" />
                <span>Políticas de Derivación Humana & Gestión de Fallbacks</span>
              </h4>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Controla cómo actúa la IA ante incomprensión de mensajes, define las palabras de escape directo y personaliza la bienvenida tras ingresar el DNI.
              </p>
            </div>
            <button
              onClick={handleSaveHandover}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-blue-600/20 self-start sm:self-auto"
            >
              <Save size={15} />
              <span>{saving ? 'Guardando...' : 'Guardar Políticas'}</span>
            </button>
          </div>

          {/* TARJETA 1: Escape Directo Inmediato (Fast-Path) */}
          <div className="p-5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <UserCheck size={16} />
                  <span>Escape Rápido a Asesor Humano (Fast-Path)</span>
                </h5>
                <p className="text-xs text-[var(--secondary)] mt-0.5">
                  Si el paciente solicita explícitamente atención humana, el sistema transfiere de inmediato en 1 turno, pausa el bot y notifica al equipo humano.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHandover(prev => ({ ...prev, auto_escalamiento_activo: !prev.auto_escalamiento_activo }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  handover.auto_escalamiento_activo ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  handover.auto_escalamiento_activo ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Palabras Clave de Escape */}
            <div className="pt-3 border-t border-[var(--border)] space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold">Palabras y Frases Clave de Escape Directo</label>
                <button
                  type="button"
                  onClick={handleResetDefaultKeywords}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Restaurar sugeridas
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escribe una palabra o frase (ej. 'asesora quirúrgica', 'secretaria') y presiona Enter..."
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); } }}
                  className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs grow"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                >
                  Agregar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {handover.palabras_clave_escape.map(kw => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 shadow-xs"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-red-500 font-bold ml-1 transition"
                      title="Eliminar palabra clave"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {/* Mensaje de Derivación Inmediata */}
              <div className="pt-2">
                <label className="block font-bold mb-1.5">Mensaje de Confirmación de Derivación a Operador:</label>
                <textarea
                  rows={2}
                  value={handover.mensaje_derivacion}
                  onChange={e => setHandover(prev => ({ ...prev, mensaje_derivacion: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] leading-relaxed"
                  placeholder="Mensaje que se enviará al paciente antes de silenciar el bot..."
                />
              </div>
            </div>
          </div>

          {/* TARJETA 2: Incomprensión & Política de Reintentos (Reprompts) */}
          <div className="p-5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
            <div>
              <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                🔄 Política de Reintentos por Incomprensión (2-Strike Reprompt Loop)
              </h5>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Si el paciente formula mensajes confusos, ininteligibles o la IA no logra interpretar la consulta, se aplican reintentos guiados antes de derivar.
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--border)] space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-2">Tolerancia de Reintentos (Fallos antes de derivar al equipo humano):</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[1, 2, 3].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setHandover(prev => ({ ...prev, max_reintentos_incomprension: num }))}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition ${
                        handover.max_reintentos_incomprension === num
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-[var(--card)] border-[var(--border)] text-[var(--secondary)] hover:border-blue-500/40'
                      }`}
                    >
                      {num} {num === 1 ? 'Reintento' : 'Reintentos'} {num === 2 && '⭐ (Recomendado)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1.5">Mensaje de Primer Reintento (Reprompt Orientador):</label>
                <textarea
                  rows={2}
                  value={handover.mensaje_reintento}
                  onChange={e => setHandover(prev => ({ ...prev, mensaje_reintento: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] leading-relaxed"
                  placeholder="Mensaje amigable que orienta al paciente tras el primer mensaje incomprensible..."
                />
                <p className="text-[11px] text-[var(--secondary)] mt-1">
                  Se envía en el primer fallo para orientar sobre turnos, cirugías, presupuestos o pedir asesor. El bot permanece activo.
                </p>
              </div>
            </div>
          </div>

          {/* TARJETA 3: Bienvenida y Contexto tras Ingreso de DNI (Geclisa) */}
          <div className="p-5 rounded-xl border border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
            <div>
              <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                🏥 Saludo Contextual tras Identificación Médica (DNI / Geclisa)
              </h5>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Plantilla de mensaje enviada automáticamente cuando el paciente proporciona su DNI y el sistema vincula su ficha de Geclisa.
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--border)] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="block font-bold">Plantilla de Mensaje Post-Vinculación:</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--secondary)] font-medium">Insertar variable:</span>
                  <button
                    type="button"
                    onClick={() => setHandover(prev => ({ ...prev, mensaje_post_dni: prev.mensaje_post_dni + ' *{nombre}*' }))}
                    className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono text-[10px] hover:bg-blue-200 transition"
                  >
                    + &#123;nombre&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandover(prev => ({ ...prev, mensaje_post_dni: prev.mensaje_post_dni + ' *{cobertura}*' }))}
                    className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono text-[10px] hover:bg-blue-200 transition"
                  >
                    + &#123;cobertura&#125;
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                value={handover.mensaje_post_dni}
                onChange={e => setHandover(prev => ({ ...prev, mensaje_post_dni: e.target.value }))}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] leading-relaxed font-sans"
              />

              {/* Previsualización en Vivo */}
              <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-1">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Previsualización en WhatsApp:
                </span>
                <p className="text-xs italic text-[var(--secondary)] whitespace-pre-wrap">
                  {handover.mensaje_post_dni.replace('{nombre}', 'Sebastián').replace('{cobertura}', 'OSDE (Plan 210)')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. SUBTAB: SIMULADOR EN VIVO (PLAYGROUND)                            */}
      {/* ==================================================================== */}
      {subTab === 'simulador' && (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-600/10 text-purple-600">
                <Play size={20} />
              </div>
              <div>
                <h4 className="font-bold text-base">Simulador Agéntico en Vivo</h4>
                <p className="text-xs text-[var(--secondary)]">
                  Prueba mensajes y verifica cómo razona y responde cada agente antes de recibir consultas reales.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="font-bold shrink-0">Seleccionar Agente a Probar:</label>
              <select 
                value={simAgentCode}
                onChange={(e) => setSimAgentCode(e.target.value)}
                className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] font-medium grow"
              >
                <option value="AUTO">✨ Enrutamiento Automático Inteligente (Router Heurístico)</option>
                {agentes.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.nombre} ({a.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1.5">Mensaje Simulado del Paciente:</label>
              <textarea 
                rows={3}
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="Escribe la consulta del paciente para probar..."
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] leading-relaxed font-sans"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSimMessage('Hola, quiero sacar un turno para cardiología mañana por la mañana')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] hover:bg-slate-200 text-[var(--secondary)]"
                >
                  Ej: Turno Rápido
                </button>
                <button
                  type="button"
                  onClick={() => setSimMessage('¿Cuánto sale la consulta médica y el estudio CON-001? ¿Aceptan tarjeta?')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] hover:bg-slate-200 text-[var(--secondary)]"
                >
                  Ej: Presupuesto
                </button>
                <button
                  type="button"
                  onClick={() => setSimMessage('Mi DNI es 33516799')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 text-[10px] font-semibold hover:bg-blue-100"
                >
                  Ej: DNI Geclisa
                </button>
                <button
                  type="button"
                  onClick={() => setSimMessage('Por favor necesito hablar con una asesora quirúrgica urgente')}
                  className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 text-[10px] font-semibold hover:bg-purple-100"
                >
                  Ej: Escape a Asesora
                </button>
                <button
                  type="button"
                  onClick={() => setSimMessage('asdkjh ??? 🥑🚜 ///')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[10px] font-semibold hover:bg-amber-100"
                >
                  Ej: Incomprensión
                </button>
              </div>

              <button
                onClick={handleRunSimulation}
                disabled={simRunning || !simMessage.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-purple-600/20"
              >
                <Play size={15} />
                <span>{simRunning ? 'Analizando e Infiriendo...' : 'Probar Respuesta'}</span>
              </button>
            </div>

            {/* Resultado de la Simulación */}
            {simResult && (
              <div className="mt-6 p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-purple-500/10">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-[10px]">
                      {simResult.agente_utilizado?.nombre || simResult.agente_utilizado?.codigo}
                    </span>
                    <span className="text-[11px] text-[var(--secondary)]">
                      Temperatura: {simResult.agente_utilizado?.temperatura}
                    </span>
                  </div>
                  {simResult.duracion_ms && (
                    <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-semibold">
                      ⚡ {simResult.duracion_ms} ms
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs leading-relaxed whitespace-pre-wrap">
                  {simResult.respuesta}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. SUBTAB: MOTOR IA & AJUSTES DE EJECUCIÓN                           */}
      {/* ==================================================================== */}
      {subTab === 'motor' && (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            <div>
              <h4 className="font-bold text-base">Parámetros del Motor de IA</h4>
              <p className="text-xs text-[var(--secondary)]">
                Control maestro del bot, modelo de Gemini y tiempos de respuesta.
              </p>
            </div>
            <button
              onClick={handleSaveMotorSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
            >
              <Save size={16} />
              <span>{saving ? 'Guardando...' : 'Guardar Ajustes'}</span>
            </button>
          </div>

          <div className="space-y-5 text-xs">
            {/* Switch Maestro */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[var(--border)]">
              <div>
                <h5 className="font-bold text-sm">Atención Automática por IA</h5>
                <p className="text-[11px] text-[var(--secondary)] mt-0.5">
                  Si se desactiva, todas las conversaciones requerirán atención manual de secretaría médica.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBotEnabled(!botEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  botEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  botEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1.5">Modelo de Gemini Seleccionado</label>
                <select 
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] font-medium"
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recomendado - Ultra Rápido)</option>
                  <option value="gemini-3.7-flash">Gemini 3.7 Flash (Última Generación)</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1.5">Simulación de Tipeo Humano (Segundos)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={typingDelay}
                  onChange={(e) => setTypingDelay(parseInt(e.target.value) || 0)}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] font-medium"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
