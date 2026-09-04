'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  X, 
  Activity, 
  FileText, 
  Pill, 
  Glasses, 
  BookOpen, 
  ClipboardList, 
  FolderDown, 
  Loader2
} from 'lucide-react'
import { BACKEND_URL, getAuthHeaders } from '@/lib/api'
import { supabase } from '@/lib/supabase'


import HeaderPacienteFijo from './historia-clinica/HeaderPacienteFijo'
import TabEvolucion from './historia-clinica/tabs/TabEvolucion'
import TabEstudios from './historia-clinica/tabs/TabEstudios'
import TabRecetasAnteojos from './historia-clinica/tabs/TabRecetasAnteojos'
import TabRecetasMedicamentos from './historia-clinica/tabs/TabRecetasMedicamentos'
import TabIndicaciones from './historia-clinica/tabs/TabIndicaciones'
import TabPedidosEstudios from './historia-clinica/tabs/TabPedidosEstudios'
import TabGeclisaLegado from './historia-clinica/tabs/TabGeclisaLegado'
import ModalTicketOCR from './historia-clinica/ocr/ModalTicketOCR'
import ModalResumenWhatsApp from './historia-clinica/whatsapp/ModalResumenWhatsApp'
import ModalVideosWhatsApp from './historia-clinica/whatsapp/ModalVideosWhatsApp'
import PrintContainer from './historia-clinica/print/PrintTemplates'
import { 
  PacienteData, 
  HistoriaClinicaOftalmo, 
  ConsultaOftalmo, 
  EstudioOftalmo, 
  RecetaAnteojos, 
  RecetaFarmacos, 
  PedidoEstudios 
} from './historia-clinica/types'

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

type TabTipo = 
  | 'evolucion' 
  | 'estudios' 
  | 'recetas_anteojos' 
  | 'recetas_farmacos' 
  | 'indicaciones' 
  | 'pedidos_estudios' 
  | 'geclisa'

interface ModalHistoriaClinicaProps {
  isOpen: boolean
  onClose: () => void
  paciente: {
    id: string
    nombre: string
    dni?: string | null
    geclisa_ficha_id?: number | null
    nro_hc?: string | null
    telefono?: string
    fecha_nacimiento?: string | null
    sexo?: string | null
    obra_social?: string | null
    plan_cobertura?: string | null
    direccion?: string | null
  } | null
}

export default function ModalHistoriaClinica({
  isOpen,
  onClose,
  paciente
}: ModalHistoriaClinicaProps) {
  const [activeTab, setActiveTab] = useState<TabTipo>('evolucion')

  const [pacienteData, setPacienteData] = useState<PacienteData | null>(null)
  const [historiaData, setHistoriaData] = useState<HistoriaClinicaOftalmo | null>(null)
  const [consultas, setConsultas] = useState<ConsultaOftalmo[]>([])
  const [consultaActivaId, setConsultaActivaId] = useState<string | null>(null)
  const [estudios, setEstudios] = useState<EstudioOftalmo[]>([])
  const [recetasAnteojos, setRecetasAnteojos] = useState<RecetaAnteojos[]>([])
  const [recetasFarmacos, setRecetasFarmacos] = useState<RecetaFarmacos[]>([])
  const [pedidosEstudios, setPedidosEstudios] = useState<PedidoEstudios[]>([])

  const [cargando, setCargando] = useState<boolean>(true)
  const [guardando, setGuardando] = useState<boolean>(false)
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null)
  const [sincronizandoGeclisa, setSincronizandoGeclisa] = useState<boolean>(false)

  const [modalOcrOpen, setModalOcrOpen] = useState(false)
  const [modalWaResumenOpen, setModalWaResumenOpen] = useState(false)
  const [modalWaVideosOpen, setModalWaVideosOpen] = useState(false)
  const [videosEspeciales, setVideosEspeciales] = useState(false)

  const [printConfig, setPrintConfig] = useState<{
    tipo: 'ficha' | 'receta_anteojos' | 'receta_farmacos' | 'pedido_estudios' | 'indicaciones' | 'evolucion'
    recetaAnteojos?: RecetaAnteojos
    recetaFarmacos?: RecetaFarmacos
    pedidoEstudios?: PedidoEstudios
    indicacionesTexto?: { titulo: string; contenido: string }
  } | null>(null)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoad = useRef<boolean>(true)

  useEffect(() => {
    if (isOpen && paciente?.id) {
      isInitialLoad.current = true
      cargarHistoriaCompleta(paciente.id)
    } else {
      setPacienteData(null)
      setHistoriaData(null)
      setConsultas([])
      setConsultaActivaId(null)
      setEstudios([])
      setRecetasAnteojos([])
      setRecetasFarmacos([])
      setPedidosEstudios([])
      setActiveTab('evolucion')
      setUltimoGuardado(null)
    }
  }, [isOpen, paciente?.id])

  const cargarHistoriaCompleta = async (pacienteId: string) => {
    setCargando(true)
    try {
      let data: any = null
      try {
        const res = await fetch(`${BACKEND_URL}/api/oftalmo/${pacienteId}`)
        if (res.ok) {
          data = await res.json()
        }
      } catch (backendErr) {
        console.warn('Backend API no disponible temporalmente, consultando Supabase:', backendErr)
      }

      if (!data) {
        // Fallback directo a Supabase
        const [pRes, hRes, cRes, eRes, raRes, rfRes, peRes] = await Promise.all([
          supabase.from('pacientes').select('*').eq('id', pacienteId).maybeSingle(),
          (supabase as any).from('historias_clinicas_oftalmo').select('*').eq('paciente_id', pacienteId).maybeSingle(),
          (supabase as any).from('consultas_oftalmo').select('*').eq('paciente_id', pacienteId).order('fecha', { ascending: false }),
          (supabase as any).from('estudios_oftalmo').select('*').eq('paciente_id', pacienteId).order('fecha', { ascending: false }),
          (supabase as any).from('recetas_anteojos_oftalmo').select('*').eq('paciente_id', pacienteId).order('fecha', { ascending: false }),
          (supabase as any).from('recetas_farmacos_oftalmo').select('*').eq('paciente_id', pacienteId).order('fecha', { ascending: false }),
          (supabase as any).from('pedidos_estudios_oftalmo').select('*').eq('paciente_id', pacienteId).order('fecha', { ascending: false })
        ])

        data = {
          paciente: pRes.data || null,
          historia: hRes.data || null,
          consultas: cRes.data || [],
          estudios: eRes.data || [],
          recetas_anteojos: raRes.data || [],
          recetas_farmacos: rfRes.data || [],
          pedidos_estudios: peRes.data || []
        }
      }

      const p: PacienteData = {
        id: data.paciente?.id || pacienteId,

        nombre: data.paciente?.nombre || paciente?.nombre || '',
        dni: data.paciente?.dni || paciente?.dni || '',
        geclisa_ficha_id: data.paciente?.geclisa_ficha_id || paciente?.geclisa_ficha_id,
        nro_hc: data.paciente?.nro_hc || paciente?.nro_hc || '',
        telefono: data.paciente?.telefono || paciente?.telefono || '',
        fecha_nacimiento: data.paciente?.fecha_nacimiento || paciente?.fecha_nacimiento || '',
        sexo: data.paciente?.sexo || paciente?.sexo || '',
        obra_social: data.paciente?.obra_social || paciente?.obra_social || '',
        plan_cobertura: data.paciente?.plan_cobertura || paciente?.plan_cobertura || '',
        direccion: data.paciente?.direccion || paciente?.direccion || ''
      }
      setPacienteData(p)

      const h: HistoriaClinicaOftalmo = data.historia || {
        paciente_id: pacienteId,
        antecedentes_oculares: [],
        antecedentes_generales: [],
        medicacion_habitual: [],
        medicacion_otra: '',
        alergias: '',
        observaciones_permanentes: ''
      }
      setHistoriaData(h)

      const consList: ConsultaOftalmo[] = data.consultas || []
      setConsultas(consList)
      if (consList.length > 0) {
        setConsultaActivaId(consList[0].id)
      } else {
        const nuevaDraftId = generateUUID()
        const draft: ConsultaOftalmo = {
          id: nuevaDraftId,
          paciente_id: pacienteId,
          tipo: 'consulta',
          fecha: new Date().toISOString().slice(0, 10),
          motivo_consulta: 'Control oftalmologico de rutina',
          agudeza_visual: { od: {}, oi: {}, ao: {} },
          refraccion: { od: {}, oi: {} },
          queratometria: { od: {}, oi: {} },
          presion_intraocular: { od: {}, oi: {} },
          superficie_ocular: { modo: 'ao', od: {}, oi: {} },
          biomicroscopia: { modo: 'ao', od: '', oi: '' },
          fondo_ojo: { modo: 'ao', od: '', oi: '' },
          conducta: { modo_plan: 'ao', explico: [], valores_pasar: [] }
        }
        setConsultas([draft])
        setConsultaActivaId(nuevaDraftId)
      }

      setEstudios(data.estudios || [])
      setRecetasAnteojos(data.recetas_anteojos || [])
      setRecetasFarmacos(data.recetas_farmacos || [])
      setPedidosEstudios(data.pedidos_estudios || [])

      setUltimoGuardado(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch (err: any) {
      console.error('Error cargando historia oftalmologica:', err)
    } finally {
      setCargando(false)
      setTimeout(() => {
        isInitialLoad.current = false
      }, 500)
    }
  }

  const triggerAutoSave = useCallback((
    newPaciente: PacienteData,
    newHistoria: HistoriaClinicaOftalmo,
    currentConsulta?: ConsultaOftalmo
  ) => {
    if (isInitialLoad.current || !paciente?.id) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setGuardando(true)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        let guardadoBackend = false
        try {
          const authHeaders = await getAuthHeaders()
          const resAntecedentes = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/antecedentes`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({
              paciente: newPaciente,
              historia: newHistoria
            })
          })

          if (currentConsulta) {
            const resCons = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/consultas`, {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(currentConsulta)
            })
            if (resCons.ok) {
              const saved = await resCons.json()
              if (saved?.id && saved.id !== currentConsulta.id) {
                setConsultas(prev => prev.map(c => c.id === currentConsulta.id ? { ...c, id: saved.id } : c))
                setConsultaActivaId(prev => prev === currentConsulta.id ? saved.id : prev)
              }
            }
          }
          if (resAntecedentes.ok) {
            guardadoBackend = true
          }
        } catch (backendSaveErr) {
          console.warn('Backend API no disponible para guardado, usando Supabase directo:', backendSaveErr)
        }

        if (!guardadoBackend) {
          // Fallback directo a Supabase
          await (supabase as any).from('historias_clinicas_oftalmo').upsert({
            paciente_id: paciente.id,
            antecedentes_oculares: newHistoria.antecedentes_oculares || [],
            antecedentes_generales: newHistoria.antecedentes_generales || [],
            medicacion_habitual: newHistoria.medicacion_habitual || [],
            medicacion_otra: newHistoria.medicacion_otra || '',
            alergias: newHistoria.alergias || '',
            observaciones_permanentes: newHistoria.observaciones_permanentes || ''
          }, { onConflict: 'paciente_id' })

          if (currentConsulta) {
            await (supabase as any).from('consultas_oftalmo').upsert(currentConsulta)
          }
        }

        setUltimoGuardado(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      } catch (err) {
        console.error('Error en auto-guardado:', err)
      } finally {
        setGuardando(false)
      }
    }, 450)
  }, [paciente?.id])


  const handleUpdatePaciente = (fields: Partial<PacienteData>) => {
    if (!pacienteData) return
    const updated = { ...pacienteData, ...fields }
    setPacienteData(updated)
    if (historiaData) {
      const activeCons = consultas.find(c => c.id === consultaActivaId)
      triggerAutoSave(updated, historiaData, activeCons)
    }
  }

  const handleUpdateHistoria = (fields: Partial<HistoriaClinicaOftalmo>) => {
    if (!historiaData || !pacienteData) return
    const updated = { ...historiaData, ...fields }
    setHistoriaData(updated)
    const activeCons = consultas.find(c => c.id === consultaActivaId)
    triggerAutoSave(pacienteData, updated, activeCons)
  }

  const handleUpdateConsultaActiva = (fields: Partial<ConsultaOftalmo>) => {
    if (!consultaActivaId) return
    setConsultas(prev => prev.map(c => {
      if (c.id === consultaActivaId) {
        const updated = { ...c, ...fields }
        if (pacienteData && historiaData) {
          triggerAutoSave(pacienteData, historiaData, updated)
        }
        return updated
      }
      return c
    }))
  }

  const handleNuevaConsulta = async (tipo: 'consulta' | 'postop') => {
    if (!paciente?.id) return
    const hoy = new Date().toISOString().slice(0, 10)
    const baseConsulta: Partial<ConsultaOftalmo> = {
      tipo,
      fecha: hoy,
      motivo_consulta: tipo === 'postop' ? 'Control Postoperatorio' : 'Consulta Oftalmologica',
      agudeza_visual: { od: {}, oi: {}, ao: {} },
      refraccion: { od: {}, oi: {} },
      queratometria: { od: {}, oi: {} },
      presion_intraocular: { od: {}, oi: {} },
      superficie_ocular: { modo: 'ao', od: {}, oi: {} },
      biomicroscopia: { modo: 'ao', od: '', oi: '' },
      fondo_ojo: { modo: 'ao', od: '', oi: '' },
      conducta: { modo_plan: 'ao', explico: [], valores_pasar: [] },
      datos_postop: tipo === 'postop' ? {
        fecha_cx: hoy,
        ojo: 'OD',
        cx_realizada: 'Facoemulsificacion + LIO',
        complicaciones: []
      } : undefined
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/consultas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseConsulta)
      })
      if (res.ok) {
        const saved = await res.json()
        setConsultas(prev => [saved, ...prev])
        setConsultaActivaId(saved.id)
      }
    } catch (err) {
      console.error('Error creando consulta:', err)
    }
  }

  const handleEliminarConsulta = async (consultaId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/oftalmo/consultas/${consultaId}`, { method: 'DELETE' })
      const filtered = consultas.filter(c => c.id !== consultaId)
      setConsultas(filtered)
      if (consultaActivaId === consultaId) {
        setConsultaActivaId(filtered.length > 0 ? filtered[0].id : null)
      }
    } catch (err) {
      console.error('Error eliminando consulta:', err)
    }
  }

  const handleSincronizarGeclisa = async (consultaId: string) => {
    setSincronizandoGeclisa(true)
    try {
      const authHeaders = await getAuthHeaders()
      // 1. Asegurar que la consulta activa esté guardada en el backend antes de sincronizar
      const activeCons = consultas.find(c => c.id === consultaId)
      let targetId = consultaId
      if (activeCons && paciente?.id) {
        try {
          const saveRes = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/consultas`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(activeCons)
          })
          if (saveRes.ok) {
            const saved = await saveRes.json()
            if (saved?.id && saved.id !== consultaId) {
              targetId = saved.id
              setConsultas(prev => prev.map(c => c.id === activeCons.id ? { ...c, id: saved.id } : c))
              setConsultaActivaId(saved.id)
            }
          }
        } catch (e) {
          console.warn('Error asegurando guardado previo a sincronización:', e)
        }
      }

      // 2. Ejecutar la sincronización con Geclisa
      const res = await fetch(`${BACKEND_URL}/api/oftalmo/consultas/${targetId}/sincronizar-geclisa`, {
        method: 'POST',
        headers: authHeaders
      })
      const data = await res.json()

      if (res.ok && data.success) {
        const assignedHcId = data.geclisa_hc_id || data.hc_id
        setConsultas(prev => prev.map(c => {
          if (c.id === targetId || c.id === consultaId) {
            return {
              ...c,
              geclisa_sincronizado_en: new Date().toISOString(),
              sincronizado_geclisa_at: new Date().toISOString(),
              geclisa_hc_id: assignedHcId
            }
          }
          return c
        }))
        alert(data.mensaje || `Evolución inyectada en la Historia Clínica nativa de Geclisa con éxito (hcId: ${assignedHcId}).`)
      } else {
        const errMsg = data.detail || data.error || data.motivo || 'Fallo desconocido al sincronizar con Geclisa'
        alert(`Error al sincronizar con Geclisa: ${errMsg}`)
      }
    } catch (err: any) {
      alert(`Error al conectar con el servidor: ${err.message}`)
    } finally {
      setSincronizandoGeclisa(false)
    }
  }

  const handleAddEstudio = async (estudioData: Omit<EstudioOftalmo, 'id' | 'paciente_id'>) => {
    if (!paciente?.id) return
    let saved: EstudioOftalmo | null = null
    try {
      const res = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/estudios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estudioData)
      })
      if (res.ok) {
        saved = await res.json()
      }
    } catch (e) {
      console.warn('Backend no disponible para estudio, guardando en Supabase')
    }

    if (!saved) {
      const { data, error } = await (supabase as any)
        .from('estudios_oftalmo')
        .insert({ ...estudioData, paciente_id: paciente.id })
        .select()
        .single()
      if (!error && data) saved = data as EstudioOftalmo
    }

    if (saved) {
      setEstudios(prev => [saved!, ...prev])
    }
  }

  const handleDeleteEstudio = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/oftalmo/estudios/${id}`, { method: 'DELETE' })
    } catch (e) {
      // ignore
    }
    await (supabase as any).from('estudios_oftalmo').delete().eq('id', id)
    setEstudios(prev => prev.filter(e => e.id !== id))
  }

  const handleAddRecetaAnteojos = async (recetaData: Omit<RecetaAnteojos, 'id' | 'paciente_id'>) => {
    if (!paciente?.id) return
    let saved: RecetaAnteojos | null = null
    const payload = {
      ...recetaData,
      paciente_id: paciente.id,
      fecha: recetaData.fecha || new Date().toISOString().slice(0, 10),
    }

    try {
      const authHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/recetas-anteojos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        saved = data.receta || data
      }
    } catch (e) {
      console.warn('Backend no disponible para receta anteojos, guardando en Supabase:', e)
    }

    if (!saved || !saved.id) {
      const od = recetaData.lejos?.od || {}
      const oi = recetaData.lejos?.oi || {}
      const cercaOd = recetaData.cerca?.od || {}
      const cercaOi = recetaData.cerca?.oi || {}
      const dbPayload = {
        paciente_id: paciente.id,
        fecha: payload.fecha,
        tipo_lente: recetaData.tipo_cristal || (recetaData as any).tipo_lente || '',
        tipo_cristal: recetaData.tipo_cristal || '',
        od_esfera: od.esf || '',
        od_cilindro: od.cil || '',
        od_eje: od.eje || '',
        od_adicion: cercaOd.esf || '',
        oi_esfera: oi.esf || '',
        oi_cilindro: oi.cil || '',
        oi_eje: oi.eje || '',
        oi_adicion: cercaOi.esf || '',
        dnp: od.dnp || '',
        indicaciones_optico: recetaData.observaciones || (recetaData as any).indicaciones_optico || '',
        observaciones: recetaData.observaciones || '',
        lejos: recetaData.lejos,
        cerca: recetaData.cerca
      }
      const { data, error } = await (supabase as any)
        .from('recetas_anteojos_oftalmo')
        .insert(dbPayload)
        .select()
        .single()
      if (!error && data) {
        saved = { ...data, ...recetaData } as RecetaAnteojos
      } else if (error) {
        console.error('Error insertando receta anteojos en Supabase:', error)
      }
    }

    if (saved) {
      const recetaCompleta: RecetaAnteojos = {
        ...saved,
        lejos: saved.lejos || recetaData.lejos,
        cerca: saved.cerca || recetaData.cerca,
        tipo_cristal: saved.tipo_cristal || recetaData.tipo_cristal,
        observaciones: saved.observaciones || recetaData.observaciones
      }
      setRecetasAnteojos(prev => [recetaCompleta, ...prev])
      handleImprimir({ tipo: 'receta_anteojos', recetaAnteojos: recetaCompleta })
    } else {
      alert('No se pudo guardar la receta de anteojos. Verifique la conexión.')
    }
  }

  const handleDeleteRecetaAnteojos = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/oftalmo/recetas-anteojos/${id}`, { method: 'DELETE' })
    } catch (e) {
      // ignore
    }
    await (supabase as any).from('recetas_anteojos_oftalmo').delete().eq('id', id)
    setRecetasAnteojos(prev => prev.filter(r => r.id !== id))
  }

  const handleAddRecetaFarmacos = async (recetaData: Omit<RecetaFarmacos, 'id' | 'paciente_id'>) => {
    if (!paciente?.id) return
    let saved: RecetaFarmacos | null = null
    const payload = {
      ...recetaData,
      paciente_id: paciente.id,
      fecha: recetaData.fecha || new Date().toISOString().slice(0, 10),
      items: recetaData.items || [],
      diagnostico: recetaData.diagnostico || '',
      indicaciones_generales: recetaData.indicaciones_generales || ''
    }

    try {
      const authHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/recetas-farmacos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        saved = data.receta || data
      }
    } catch (e) {
      console.warn('Backend no disponible para receta farmacos, guardando en Supabase:', e)
    }

    if (!saved || !saved.id) {
      const { data, error } = await (supabase as any)
        .from('recetas_farmacos_oftalmo')
        .insert(payload)
        .select()
        .single()
      if (!error && data) {
        saved = data as RecetaFarmacos
      } else if (error) {
        console.error('Error insertando receta_farmacos en Supabase:', error)
      }
    }

    if (saved) {
      const recetaCompleta: RecetaFarmacos = {
        ...saved,
        diagnostico: saved.diagnostico || recetaData.diagnostico,
        items: saved.items && saved.items.length > 0 ? saved.items : recetaData.items,
        indicaciones_generales: saved.indicaciones_generales || recetaData.indicaciones_generales
      }
      setRecetasFarmacos(prev => [recetaCompleta, ...prev])
      handleImprimir({ tipo: 'receta_farmacos', recetaFarmacos: recetaCompleta })
    } else {
      alert('No se pudo guardar la receta médica. Verifique la conexión.')
    }
  }

  const handleDeleteRecetaFarmacos = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/oftalmo/recetas-farmacos/${id}`, { method: 'DELETE' })
    } catch (e) {
      // ignore
    }
    await (supabase as any).from('recetas_farmacos_oftalmo').delete().eq('id', id)
    setRecetasFarmacos(prev => prev.filter(r => r.id !== id))
  }

  const handleAddPedidoEstudios = async (pedidoData: any) => {
    if (!paciente?.id) return
    let saved: PedidoEstudios | null = null
    const listaEstudios = pedidoData.estudios || pedidoData.items || []
    const payload = {
      paciente_id: paciente.id,
      fecha: pedidoData.fecha || new Date().toISOString().slice(0, 10),
      grupo_preset: pedidoData.grupo_preset || '',
      titulo: pedidoData.titulo || (listaEstudios[0] ? `Estudios: ${listaEstudios[0]}` : 'Pedido de estudios'),
      items: listaEstudios,
      estudios: listaEstudios,
      ojo: pedidoData.ojo || 'AO',
      diagnostico: pedidoData.diagnostico || '',
      observaciones: pedidoData.observaciones || ''
    }

    try {
      const authHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch(`${BACKEND_URL}/api/oftalmo/${paciente.id}/pedidos-estudios`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        saved = (data.pedidos && data.pedidos[0]) || data.pedido || data
      }
    } catch (e) {
      console.warn('Backend no disponible para pedido estudios, guardando en Supabase:', e)
    }

    if (!saved || !saved.id) {
      const { data, error } = await (supabase as any)
        .from('pedidos_estudios_oftalmo')
        .insert(payload)
        .select()
        .single()
      if (!error && data) {
        saved = data as PedidoEstudios
      } else if (error) {
        console.error('Error insertando pedido_estudios en Supabase:', error)
      }
    }

    if (saved) {
      const pedidoCompleto: PedidoEstudios = {
        ...saved,
        estudios: saved.estudios || listaEstudios,
        items: saved.items || listaEstudios,
        ojo: saved.ojo || pedidoData.ojo || 'AO',
        diagnostico: saved.diagnostico || pedidoData.diagnostico,
        observaciones: saved.observaciones || pedidoData.observaciones
      }
      setPedidosEstudios(prev => [pedidoCompleto, ...prev])
      handleImprimir({ tipo: 'pedido_estudios', pedidoEstudios: pedidoCompleto })
    } else {
      alert('No se pudo guardar la orden de estudios. Verifique la conexión.')
    }
  }

  const handleDeletePedidoEstudios = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/oftalmo/pedidos-estudios/${id}`, { method: 'DELETE' })
    } catch (e) {
      // ignore
    }
    await (supabase as any).from('pedidos_estudios_oftalmo').delete().eq('id', id)
    setPedidosEstudios(prev => prev.filter(p => p.id !== id))
  }

  const handleImprimir = (config: {
    tipo: 'ficha' | 'receta_anteojos' | 'receta_farmacos' | 'pedido_estudios' | 'indicaciones' | 'evolucion'
    recetaAnteojos?: RecetaAnteojos
    recetaFarmacos?: RecetaFarmacos
    pedidoEstudios?: PedidoEstudios
    indicacionesTexto?: { titulo: string; contenido: string }
  }) => {
    setPrintConfig(config)
    setTimeout(() => {
      window.print()
    }, 250)
  }


  if (!isOpen || !paciente) return null

  const consultaActiva = consultas.find(c => c.id === consultaActivaId)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-[#f0f4f7] rounded-2xl shadow-2xl border border-[#dde6ec] w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden text-[#16323f]">
        
        {pacienteData && historiaData && (
          <HeaderPacienteFijo
            paciente={pacienteData}
            historia={historiaData}
            onUpdatePaciente={handleUpdatePaciente}
            onUpdateHistoria={handleUpdateHistoria}
            guardando={guardando}
            ultimoGuardado={ultimoGuardado}
          />
        )}

        <div className="bg-white border-b border-[#dde6ec] px-3 py-1 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('evolucion')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'evolucion'
                  ? 'bg-[#0e7c86] text-white shadow-sm'
                  : 'text-[#728a99] hover:bg-[#f7fafb] hover:text-[#16323f]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Antecedentes y Evolución
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('estudios')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'estudios'
                  ? 'bg-[#0e7c86] text-white shadow-sm'
                  : 'text-[#728a99] hover:bg-[#f7fafb] hover:text-[#16323f]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Estudios ({estudios.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recetas_anteojos')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'recetas_anteojos'
                  ? 'bg-[#0e7c86] text-white shadow-sm'
                  : 'text-[#728a99] hover:bg-[#f7fafb] hover:text-[#16323f]'
              }`}
            >
              <Glasses className="w-3.5 h-3.5" />
              Recetas de Anteojos
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recetas_farmacos')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'recetas_farmacos'
                  ? 'bg-[#0e7c86] text-white shadow-sm'
                  : 'text-[#728a99] hover:bg-[#f7fafb] hover:text-[#16323f]'
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              Recetas Fármacos (Rp)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('indicaciones')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'indicaciones'
                  ? 'bg-[#0e7c86] text-white shadow-sm'
                  : 'text-[#728a99] hover:bg-[#f7fafb] hover:text-[#16323f]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Indicaciones al Paciente
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pedidos_estudios')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'pedidos_estudios'
                  ? 'bg-[#0e7c86] text-white shadow-sm'
                  : 'text-[#728a99] hover:bg-[#f7fafb] hover:text-[#16323f]'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Pedidos de Estudios
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('geclisa')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'geclisa'
                  ? 'bg-[#0e7c86] text-white shadow-sm'
                  : 'text-[#728a99] hover:bg-[#f7fafb] hover:text-[#16323f]'
              }`}
            >
              <FolderDown className="w-3.5 h-3.5" />
              Ficha Geclisa (Legado)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#728a99] hover:text-[#16323f] hover:bg-[#eef3f6] rounded-lg transition-colors"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 bg-[#f0f4f7]">
          {cargando ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-[#728a99] gap-2 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#0e7c86]" />
              <p className="font-bold text-[#16323f]">Cargando historia clínica oftalmológica...</p>
            </div>
          ) : (
            <>
              {activeTab === 'evolucion' && pacienteData && (
                <TabEvolucion
                  paciente={pacienteData}
                  consultas={consultas}
                  consultaActivaId={consultaActivaId}
                  onSelectConsulta={id => setConsultaActivaId(id)}
                  onNuevaConsulta={handleNuevaConsulta}
                  onEliminarConsulta={handleEliminarConsulta}
                  onUpdateConsultaActiva={handleUpdateConsultaActiva}
                  onSincronizarGeclisa={handleSincronizarGeclisa}
                  sincronizandoGeclisa={sincronizandoGeclisa}
                  onOpenOCR={() => setModalOcrOpen(true)}
                  onOpenResumenWA={() => setModalWaResumenOpen(true)}
                  onOpenVideosWA={(esp = false) => {
                    setVideosEspeciales(esp)
                    setModalWaVideosOpen(true)
                  }}
                  onImprimirFicha={() => {
                    if (consultaActiva) {
                      handleImprimir({ tipo: 'ficha' })
                    }
                  }}
                  onImprimirEvolucion={() => handleImprimir({ tipo: 'evolucion' })}
                  onGenerarRecetaAnteojos={handleAddRecetaAnteojos}
                />
              )}

              {activeTab === 'estudios' && (
                <TabEstudios
                  estudios={estudios}
                  onAddEstudio={handleAddEstudio}
                  onDeleteEstudio={handleDeleteEstudio}
                />
              )}

              {activeTab === 'recetas_anteojos' && pacienteData && (
                <TabRecetasAnteojos
                  paciente={pacienteData}
                  recetas={recetasAnteojos}
                  consultaActiva={consultaActiva}
                  onAddReceta={handleAddRecetaAnteojos}
                  onDeleteReceta={handleDeleteRecetaAnteojos}
                  onImprimirReceta={receta => handleImprimir({ tipo: 'receta_anteojos', recetaAnteojos: receta })}
                />
              )}

              {activeTab === 'recetas_farmacos' && pacienteData && (
                <TabRecetasMedicamentos
                  paciente={pacienteData}
                  recetas={recetasFarmacos}
                  onAddReceta={handleAddRecetaFarmacos}
                  onDeleteReceta={handleDeleteRecetaFarmacos}
                  onImprimirReceta={receta => handleImprimir({ tipo: 'receta_farmacos', recetaFarmacos: receta })}
                />
              )}

              {activeTab === 'indicaciones' && pacienteData && (
                <TabIndicaciones
                  paciente={pacienteData}
                  onImprimirTexto={(titulo, contenido) => handleImprimir({ tipo: 'indicaciones', indicacionesTexto: { titulo, contenido } })}
                />
              )}

              {activeTab === 'pedidos_estudios' && pacienteData && (
                <TabPedidosEstudios
                  paciente={pacienteData}
                  pedidos={pedidosEstudios}
                  onAddPedido={handleAddPedidoEstudios}
                  onDeletePedido={handleDeletePedidoEstudios}
                  onImprimirPedido={pedido => handleImprimir({ tipo: 'pedido_estudios', pedidoEstudios: pedido })}
                />
              )}

              {activeTab === 'geclisa' && (
                <TabGeclisaLegado
                  paciente={{
                    id: paciente.id,
                    nombre: paciente.nombre,
                    dni: paciente.dni,
                    geclisa_ficha_id: paciente.geclisa_ficha_id
                  }}
                />
              )}
            </>
          )}
        </div>

        {consultaActiva && modalOcrOpen && (
          <ModalTicketOCR
            isOpen={modalOcrOpen}
            onClose={() => setModalOcrOpen(false)}
            consultaActiva={consultaActiva}
            onApplyData={fields => handleUpdateConsultaActiva(fields)}
          />
        )}

        {pacienteData && historiaData && consultaActiva && modalWaResumenOpen && (
          <ModalResumenWhatsApp
            isOpen={modalWaResumenOpen}
            onClose={() => setModalWaResumenOpen(false)}
            paciente={pacienteData}
            historia={historiaData}
            consulta={consultaActiva}
          />
        )}

        {pacienteData && modalWaVideosOpen && (
          <ModalVideosWhatsApp
            isOpen={modalWaVideosOpen}
            onClose={() => setModalWaVideosOpen(false)}
            paciente={pacienteData}
            especialesInicial={videosEspeciales}
          />
        )}

        {printConfig && pacienteData && (
          <PrintContainer
            tipo={printConfig.tipo}
            paciente={pacienteData}
            historia={historiaData || undefined}
            consulta={consultaActiva}
            recetaAnteojos={printConfig.recetaAnteojos}
            recetaFarmacos={printConfig.recetaFarmacos}
            pedidoEstudios={printConfig.pedidoEstudios}
            indicacionesTexto={printConfig.indicacionesTexto}
          />
        )}
      </div>
    </div>
  )
}
