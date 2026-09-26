'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building,
  DollarSign,
  Calendar,
  RefreshCw,
  X,
  SlidersHorizontal,
  Layers,
  FileText,
  Clock,
  Check,
  Info,
  ClipboardList,
  PenTool,
  Link2,
  Save,
  ArrowRight,
  Sparkles,
  PlusCircle
} from 'lucide-react'
import { BACKEND_URL as API_BASE_URL } from '@/lib/api'
import { RichConsentEditor } from './RichConsentEditor'

interface LioConfigItem {
  id: string
  codigo: string
  nombre: string
  categoria?: string
  precio: number
  moneda: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  es_torico?: boolean
  tipo_vision?: string
  habilitado_en_practica?: boolean
}

interface GeclisaTipoNomenclador {
  nomId: number
  nomNom: string
}

interface GeclisaPracticaItem {
  nomCod: string
  nombre?: string
  practica?: string
  codyPractica?: string
  tipo?: string
  ya_en_crm: boolean
  crm_practica_id?: string | null
  precio_crm: number
  moneda_crm: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  arancel_activo?: boolean
}

interface CrmPracticaConfigurada {
  id: string
  codigo: string
  nombre: string
  categoria: string
  descripcion: string
  origen: 'GECLISA' | 'MANUAL'
  requiere_lente?: boolean
  lios_habilitados?: string[] | null
  habilitar_arancel: boolean
  habilitar_preparacion: boolean
  preparacion_plantilla_id?: string | null
  preparacion_plantilla_titulo?: string | null
  preparacion_custom_texto?: string | null
  habilitar_consentimiento: boolean
  consentimiento_plantilla_id?: string | null
  consentimiento_plantilla_titulo?: string | null
  consentimiento_custom_texto?: string | null
  precio: number
  moneda: 'ARS' | 'USD'
  vigencia_desde?: string | null
  vigencia_hasta?: string | null
  arancel_id?: string | null
  activo: boolean
  created_at: string
}

interface PlantillaPreparacion {
  id: string
  titulo: string
  categoria: string
  texto_indicaciones: string
  ayuno_horas: number
  dias_previos_aviso: number
  observaciones?: string | null
  activo: boolean
  created_at?: string
}

interface PlantillaConsentimiento {
  id: string
  titulo: string
  especialidad: string
  cuerpo_legal: string
  version: string
  activo: boolean
  created_at?: string
}

interface ArancelHistorial {
  id: string
  practica_id: string
  precio: number
  moneda: 'ARS' | 'USD'
  vigencia_desde: string
  vigencia_hasta?: string | null
  observaciones?: string | null
  activo: boolean
}

interface PracticaRelacionadaItem {
  id: string
  relacion_id?: string
  practica_origen_id?: string
  codigo: string
  nombre: string
  categoria?: string
  tipo_relacion: 'anestesia' | 'quirofano' | 'insumo' | 'estudio' | 'honorario' | 'general'
  es_obligatoria: boolean
  cantidad_default: number
  orden?: number
  notas?: string
  precio?: number
  moneda?: string
}

export default function NomencladorSettingsCard() {
  const [activeMainTab, setActiveMainTab] = useState<'catalogo' | 'preparaciones' | 'consentimientos'>('catalogo')

  const [tiposGeclisa, setTiposGeclisa] = useState<GeclisaTipoNomenclador[]>([])
  const [selectedNomId, setSelectedNomId] = useState<number | ''>('')
  const [searchGeclisaQuery, setSearchGeclisaQuery] = useState('')
  const [searchingGeclisa, setSearchingGeclisa] = useState(false)
  const [geclisaResults, setGeclisaResults] = useState<GeclisaPracticaItem[]>([])

  const [crmPracticas, setCrmPracticas] = useState<CrmPracticaConfigurada[]>([])
  const [loadingCrm, setLoadingCrm] = useState(true)
  const [filtroTab, setFiltroTab] = useState<'todas' | 'ARS' | 'USD' | 'PREP' | 'CONSENT' | 'MANUAL' | 'GECLISA'>('todas')
  const [crmSearchTerm, setCrmSearchTerm] = useState('')

  const [plantillasPrep, setPlantillasPrep] = useState<PlantillaPreparacion[]>([])
  const [plantillasConsent, setPlantillasConsent] = useState<PlantillaConsentimiento[]>([])
  const [loadingPlantillas, setLoadingPlantillas] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSubTab, setModalSubTab] = useState<'general' | 'aranceles' | 'preparacion' | 'consentimiento' | 'relacionadas' | 'lios'>('general')
  const [modalMode, setModalMode] = useState<'geclisa' | 'manual' | 'edit'>('geclisa')
  const [savingModal, setSavingModal] = useState(false)
  const [historialAranceles, setHistorialAranceles] = useState<ArancelHistorial[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // Estados para Prácticas Vinculadas (Opción 1)
  const [practicasRelacionadas, setPracticasRelacionadas] = useState<PracticaRelacionadaItem[]>([])
  const [loadingRelacionadas, setLoadingRelacionadas] = useState(false)
  const [savingRelacionadas, setSavingRelacionadas] = useState(false)
  const [relPracticaSelectId, setRelPracticaSelectId] = useState('')
  const [relTipoSelect, setRelTipoSelect] = useState<'anestesia' | 'quirofano' | 'insumo' | 'estudio' | 'honorario' | 'general'>('anestesia')
  const [relEsObligatoria, setRelEsObligatoria] = useState(true)
  const [relCantidad, setRelCantidad] = useState(1)
  const [relNotas, setRelNotas] = useState('')

  // Estados para Gestión Integral de Lentes Intraoculares (Opción A)
  const [listaLiosModal, setListaLiosModal] = useState<LioConfigItem[]>([])
  const [loadingLiosModal, setLoadingLiosModal] = useState(false)
  const [savingLioCodigo, setSavingLioCodigo] = useState<string | null>(null)
  const [feedbackLio, setFeedbackLio] = useState<{ codigo: string; texto: string; tipo: 'success' | 'error' } | null>(null)
  const [mostrarNuevoLioModal, setMostrarNuevoLioModal] = useState(false)
  const [nuevoLioForm, setNuevoLioForm] = useState({
    codigo: '',
    nombre: '',
    precio: 0,
    moneda: 'USD' as 'ARS' | 'USD'
  })
  const [creandoLio, setCreandoLio] = useState(false)

  const [formData, setFormData] = useState({
    id: '',
    codigo: '',
    nombre: '',
    categoria: 'General',
    descripcion: '',
    origen: 'GECLISA' as 'GECLISA' | 'MANUAL',
    nom_id: null as number | null,
    habilitar_arancel: true,
    precio: 0,
    moneda: 'ARS' as 'ARS' | 'USD',
    vigencia_desde: new Date().toISOString().split('T')[0],
    vigencia_hasta: '',
    arancel_id: '',
    habilitar_preparacion: false,
    requiere_lente: false,
    lios_habilitados: [] as string[],
    modo_preparacion: 'plantilla' as 'plantilla' | 'custom',
    preparacion_plantilla_id: '',
    preparacion_custom_texto: '',
    habilitar_consentimiento: false,
    modo_consentimiento: 'plantilla' as 'plantilla' | 'custom',
    consentimiento_plantilla_id: '',
    consentimiento_custom_texto: '',
    modalidad_lateralidad_defecto: 'unilateral' as 'unilateral' | 'bilateral_escalonada' | 'bilateral_simultanea',
    ojo_defecto: 'OD' as 'OD' | 'OI' | 'AO',
    duracion_estimada_minutos: 20
  })

  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false)
  const [editingPrep, setEditingPrep] = useState<PlantillaPreparacion | null>(null)
  const [prepForm, setPrepForm] = useState({
    titulo: '',
    categoria: 'Oftalmología',
    texto_indicaciones: '',
    ayuno_horas: 8,
    dias_previos_aviso: 2,
    observaciones: ''
  })

  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false)
  const [editingConsent, setEditingConsent] = useState<PlantillaConsentimiento | null>(null)
  const [consentForm, setConsentForm] = useState({
    titulo: '',
    especialidad: 'Oftalmología',
    cuerpo_legal: '',
    version: '1.0'
  })

  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    loadTiposGeclisa()
    loadCatalogoCrm()
    loadBibliotecas()
  }, [])

  const loadTiposGeclisa = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/geclisa/nomenclador/tipos`)
      if (res.ok) {
        const data = await res.json()
        const tipos: GeclisaTipoNomenclador[] = data.tipos || []
        setTiposGeclisa(tipos)
        if (tipos.length > 0 && selectedNomId === '') {
          setSelectedNomId(tipos[0].nomId)
        }
      }
    } catch (err) {
      console.error('Error al cargar tipos de nomenclador de Geclisa:', err)
    }
  }

  const loadCatalogoCrm = async () => {
    try {
      setLoadingCrm(true)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-configuradas`)
      if (res.ok) {
        const data = await res.json()
        setCrmPracticas(data.practicas || [])
      }
    } catch (err) {
      console.error('Error al cargar catálogo configurado en CRM:', err)
    } finally {
      setLoadingCrm(false)
    }
  }

  const loadBibliotecas = async () => {
    try {
      setLoadingPlantillas(true)
      const [resPrep, resConsent] = await Promise.all([
        fetch(`${API_BASE_URL}/api/nomenclador/plantillas/preparaciones`),
        fetch(`${API_BASE_URL}/api/nomenclador/plantillas/consentimientos`)
      ])
      if (resPrep.ok) {
        const dataPrep = await resPrep.json()
        setPlantillasPrep(dataPrep.plantillas || [])
      }
      if (resConsent.ok) {
        const dataConsent = await resConsent.json()
        setPlantillasConsent(dataConsent.plantillas || [])
      }
    } catch (err) {
      console.error('Error al cargar bibliotecas maestras:', err)
    } finally {
      setLoadingPlantillas(false)
    }
  }

  const loadHistorialAranceles = async (practicaId: string) => {
    if (!practicaId) {
      setHistorialAranceles([])
      return
    }
    try {
      setLoadingHistorial(true)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas/${practicaId}/aranceles`)
      if (res.ok) {
        const data = await res.json()
        setHistorialAranceles(data.aranceles || [])
      }
    } catch (err) {
      console.error('Error al cargar historial de aranceles:', err)
    } finally {
      setLoadingHistorial(false)
    }
  }

  const loadPracticasRelacionadas = async (practicaId: string) => {
    if (!practicaId) {
      setPracticasRelacionadas([])
      return
    }
    try {
      setLoadingRelacionadas(true)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas/${practicaId}/relacionadas`)
      if (res.ok) {
        const data = await res.json()
        setPracticasRelacionadas(data.relaciones || [])
      }
    } catch (err) {
      console.error('Error al cargar prácticas relacionadas:', err)
    } finally {
      setLoadingRelacionadas(false)
    }
  }

  const handleAddRelacion = () => {
    if (!relPracticaSelectId) {
      setFeedback({ tipo: 'error', texto: 'Seleccione una práctica para vincular.' })
      return
    }
    const match = crmPracticas.find((p) => p.id === relPracticaSelectId)
    if (!match) return

    // Evitar duplicados
    if (practicasRelacionadas.some((r) => r.id === match.id)) {
      setFeedback({ tipo: 'error', texto: 'Esta práctica ya se encuentra vinculada.' })
      return
    }

    const nuevaRel: PracticaRelacionadaItem = {
      id: match.id,
      codigo: match.codigo,
      nombre: match.nombre,
      categoria: match.categoria,
      tipo_relacion: relTipoSelect,
      es_obligatoria: relEsObligatoria,
      cantidad_default: Math.max(1, relCantidad),
      notas: relNotas.trim(),
      precio: match.precio || 0,
      moneda: match.moneda || 'ARS'
    }

    setPracticasRelacionadas([...practicasRelacionadas, nuevaRel])
    setRelPracticaSelectId('')
    setRelNotas('')
    setFeedback({ tipo: 'success', texto: `Práctica "${match.nombre}" agregada a los vínculos.` })
  }

  const handleRemoveRelacion = (index: number) => {
    const updated = [...practicasRelacionadas]
    updated.splice(index, 1)
    setPracticasRelacionadas(updated)
  }

  const handleSaveRelacionesDirecto = async () => {
    if (!formData.id) {
      setFeedback({ tipo: 'error', texto: 'Guarde primero la práctica para habilitar el guardado de vínculos.' })
      return
    }
    try {
      setSavingRelacionadas(true)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas/${formData.id}/relacionadas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relaciones: practicasRelacionadas })
      })
      if (res.ok) {
        setFeedback({ tipo: 'success', texto: 'Vínculos de prácticas actualizados correctamente.' })
        loadPracticasRelacionadas(formData.id)
      } else {
        const d = await res.json()
        setFeedback({ tipo: 'error', texto: d.detail || 'Error al guardar vínculos.' })
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error al conectar con el servidor.' })
    } finally {
      setSavingRelacionadas(false)
    }
  }

  const loadLiosPractica = async (practicaId?: string) => {
    try {
      setLoadingLiosModal(true)
      const url = practicaId 
        ? `${API_BASE_URL}/api/nomenclador/lios-comerciales?practica_id=${practicaId}`
        : `${API_BASE_URL}/api/nomenclador/lios-comerciales`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.lios) {
          setListaLiosModal(data.lios)
        }
      }
    } catch (err) {
      console.error('Error cargando LIOs comerciales:', err)
    } finally {
      setLoadingLiosModal(false)
    }
  }

  const handleGuardarPrecioLio = async (codigo: string, precio: number, moneda: 'ARS' | 'USD') => {
    try {
      setSavingLioCodigo(codigo)
      setFeedbackLio(null)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/actualizar-arancel-lio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, precio, moneda })
      })
      if (res.ok) {
        setFeedbackLio({ codigo, texto: 'Tarifa guardada ✓', tipo: 'success' })
        setTimeout(() => setFeedbackLio(null), 3000)
        setListaLiosModal((prev) =>
          prev.map((l) => (l.codigo === codigo ? { ...l, precio, moneda } : l))
        )
      } else {
        const err = await res.json()
        setFeedbackLio({ codigo, texto: err.detail || 'Error al guardar', tipo: 'error' })
      }
    } catch (err) {
      setFeedbackLio({ codigo, texto: 'Error de conexión', tipo: 'error' })
    } finally {
      setSavingLioCodigo(null)
    }
  }

  const handleToggleLioHabilitado = (codigo: string) => {
    setListaLiosModal((prev) => {
      const updated = prev.map((l) =>
        l.codigo === codigo ? { ...l, habilitado_en_practica: !l.habilitado_en_practica } : l
      )
      const habCodigos = updated.filter((l) => l.habilitado_en_practica).map((l) => l.codigo)
      setFormData((f) => ({ ...f, lios_habilitados: habCodigos }))
      return updated
    })
  }

  const handleCrearNuevoLio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoLioForm.codigo.trim() || !nuevoLioForm.nombre.trim()) return
    try {
      setCreandoLio(true)
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/crear-lio-rapido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: nuevoLioForm.codigo.trim().toUpperCase(),
          nombre: nuevoLioForm.nombre.trim().toUpperCase(),
          precio: Number(nuevoLioForm.precio) || 0,
          moneda: nuevoLioForm.moneda
        })
      })
      if (res.ok) {
        setMostrarNuevoLioModal(false)
        setNuevoLioForm({ codigo: '', nombre: '', precio: 0, moneda: 'USD' })
        await loadLiosPractica(formData.id)
        setFeedback({ tipo: 'success', texto: 'Nuevo LIO registrado correctamente en el catálogo.' })
      } else {
        const err = await res.json()
        setFeedback({ tipo: 'error', texto: err.detail || 'Error al crear LIO.' })
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error de conexión.' })
    } finally {
      setCreandoLio(false)
    }
  }

  const handleSearchGeclisa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setSearchingGeclisa(true)
      setFeedback(null)
      const params = new URLSearchParams()
      if (selectedNomId) params.append('nom_id', String(selectedNomId))
      if (searchGeclisaQuery.trim()) params.append('q', searchGeclisaQuery.trim())

      const res = await fetch(`${API_BASE_URL}/api/geclisa/nomenclador/buscar?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setGeclisaResults(data.practicas || [])
        if ((data.practicas || []).length === 0) {
          setFeedback({ tipo: 'error', texto: 'No se encontraron prácticas en Geclisa.' })
        }
      } else {
        setFeedback({ tipo: 'error', texto: 'Error al consultar Geclisa.' })
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error de conexión.' })
    } finally {
      setSearchingGeclisa(false)
    }
  }

  const handleOpenConfigureGeclisa = (item: GeclisaPracticaItem) => {
    const today = new Date().toISOString().split('T')[0]
    setModalMode('geclisa')
    setModalSubTab('general')
    setFormData({
      id: item.crm_practica_id || '',
      codigo: item.nomCod,
      nombre: item.nombre || item.practica || `Práctica ${item.nomCod}`,
      categoria: item.tipo || 'Oftalmología',
      descripcion: '',
      origen: 'GECLISA',
      nom_id: typeof selectedNomId === 'number' ? selectedNomId : 1,
      habilitar_arancel: true,
      precio: item.precio_crm || 0,
      moneda: item.moneda_crm || 'ARS',
      vigencia_desde: item.vigencia_desde || today,
      vigencia_hasta: item.vigencia_hasta || '',
      arancel_id: '',
      habilitar_preparacion: false,
      requiere_lente: false,
      lios_habilitados: [],
      modo_preparacion: 'plantilla',
      preparacion_plantilla_id: plantillasPrep[0]?.id || '',
      preparacion_custom_texto: '',
      habilitar_consentimiento: false,
      modo_consentimiento: 'plantilla',
      consentimiento_plantilla_id: plantillasConsent[0]?.id || '',
      consentimiento_custom_texto: '',
      modalidad_lateralidad_defecto: 'unilateral' as 'unilateral' | 'bilateral_escalonada' | 'bilateral_simultanea',
      ojo_defecto: 'OD' as 'OD' | 'OI' | 'AO',
      duracion_estimada_minutos: 20
    })
    if (item.crm_practica_id) {
      loadHistorialAranceles(item.crm_practica_id)
      loadPracticasRelacionadas(item.crm_practica_id)
      loadLiosPractica(item.crm_practica_id)
    } else {
      setHistorialAranceles([])
      setPracticasRelacionadas([])
      loadLiosPractica()
    }
    setIsModalOpen(true)
  }

  const handleOpenCreateManual = () => {
    const today = new Date().toISOString().split('T')[0]
    setModalMode('manual')
    setModalSubTab('general')
    setFormData({
      id: '',
      codigo: '',
      nombre: '',
      categoria: 'General',
      descripcion: '',
      origen: 'MANUAL',
      nom_id: null,
      habilitar_arancel: true,
      precio: 0,
      moneda: 'ARS',
      vigencia_desde: today,
      vigencia_hasta: '',
      arancel_id: '',
      habilitar_preparacion: false,
      requiere_lente: false,
      lios_habilitados: [],
      modo_preparacion: 'plantilla',
      preparacion_plantilla_id: plantillasPrep[0]?.id || '',
      preparacion_custom_texto: '',
      habilitar_consentimiento: false,
      modo_consentimiento: 'plantilla',
      consentimiento_plantilla_id: plantillasConsent[0]?.id || '',
      consentimiento_custom_texto: '',
      modalidad_lateralidad_defecto: 'unilateral' as 'unilateral' | 'bilateral_escalonada' | 'bilateral_simultanea',
      ojo_defecto: 'OD' as 'OD' | 'OI' | 'AO',
      duracion_estimada_minutos: 20
    })
    setHistorialAranceles([])
    setPracticasRelacionadas([])
    loadLiosPractica()
    setIsModalOpen(true)
  }

  const handleOpenEditCrm = (item: CrmPracticaConfigurada) => {
    const today = new Date().toISOString().split('T')[0]
    setModalMode('edit')
    setModalSubTab('general')
    setFormData({
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      categoria: item.categoria || 'General',
      descripcion: item.descripcion || '',
      modalidad_lateralidad_defecto: (item.descripcion?.includes('[MODALIDAD:bilateral_escalonada]') ? 'bilateral_escalonada' : item.descripcion?.includes('[MODALIDAD:bilateral_simultanea]') ? 'bilateral_simultanea' : item.descripcion?.includes('[MODALIDAD:unilateral]') ? 'unilateral' : ((item.nombre || '').toLowerCase().includes('catarata') || (item.nombre || '').toLowerCase().includes('faco')) ? 'bilateral_escalonada' : 'unilateral') as any,
      ojo_defecto: (item.descripcion?.includes('[OJO_DEFECTO:AO]') ? 'AO' : item.descripcion?.includes('[OJO_DEFECTO:OI]') ? 'OI' : 'OD') as any,
      duracion_estimada_minutos: item.descripcion?.includes('[DURACION:') ? parseInt(item.descripcion.split('[DURACION:')[1].split(']')[0], 10) || 20 : 20,
      origen: item.origen,
      nom_id: null,
      habilitar_arancel: item.habilitar_arancel !== undefined ? item.habilitar_arancel : true,
      precio: item.precio || 0,
      moneda: item.moneda || 'ARS',
      vigencia_desde: item.vigencia_desde || today,
      vigencia_hasta: item.vigencia_hasta || '',
      arancel_id: item.arancel_id || '',
      habilitar_preparacion: item.habilitar_preparacion || false,
      requiere_lente: item.requiere_lente || false,
      lios_habilitados: item.lios_habilitados || [],
      modo_preparacion: item.preparacion_custom_texto ? 'custom' : 'plantilla',
      preparacion_plantilla_id: item.preparacion_plantilla_id || plantillasPrep[0]?.id || '',
      preparacion_custom_texto: item.preparacion_custom_texto || '',
      habilitar_consentimiento: item.habilitar_consentimiento || false,
      modo_consentimiento: item.consentimiento_custom_texto ? 'custom' : 'plantilla',
      consentimiento_plantilla_id: item.consentimiento_plantilla_id || plantillasConsent[0]?.id || '',
      consentimiento_custom_texto: item.consentimiento_custom_texto || ''
    })
    loadHistorialAranceles(item.id)
    loadPracticasRelacionadas(item.id)
    loadLiosPractica(item.id)
    setIsModalOpen(true)
  }

  const handleSavePracticaIntegral = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSavingModal(true)
      setFeedback(null)

      const payload = {
        id: formData.id || undefined,
        codigo: formData.codigo,
        nombre: formData.nombre,
        categoria: formData.categoria,
        descripcion: formData.descripcion,
        origen: formData.origen,
        habilitar_arancel: formData.habilitar_arancel,
        precio: formData.precio,
        moneda: formData.moneda,
        vigencia_desde: formData.vigencia_desde,
        vigencia_hasta: formData.vigencia_hasta || null,
        arancel_id: formData.arancel_id || undefined,
        habilitar_preparacion: formData.habilitar_preparacion,
        requiere_lente: !!formData.requiere_lente,
        lios_habilitados: formData.lios_habilitados,
        preparacion_plantilla_id:
          formData.habilitar_preparacion && formData.modo_preparacion === 'plantilla'
            ? formData.preparacion_plantilla_id
            : null,
        preparacion_custom_texto:
          formData.habilitar_preparacion && formData.modo_preparacion === 'custom'
            ? formData.preparacion_custom_texto
            : null,
        habilitar_consentimiento: formData.habilitar_consentimiento,
        consentimiento_plantilla_id:
          formData.habilitar_consentimiento && formData.modo_consentimiento === 'plantilla'
            ? formData.consentimiento_plantilla_id
            : null,
        consentimiento_custom_texto:
          formData.habilitar_consentimiento && formData.modo_consentimiento === 'custom'
            ? formData.consentimiento_custom_texto
            : null
      }

      const res = await fetch(`${API_BASE_URL}/api/nomenclador/guardar-practica-integral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const resData = await res.json()
        const savedPracticaId = resData.resultado?.practica_id || formData.id
        if (savedPracticaId) {
          try {
            await fetch(`${API_BASE_URL}/api/nomenclador/practicas/${savedPracticaId}/relacionadas`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ relaciones: practicasRelacionadas })
            })
          } catch (relErr) {
            console.error('Error guardando relaciones asociadas:', relErr)
          }
        }
        setFeedback({ tipo: 'success', texto: `Práctica ${formData.codigo} configurada exitosamente con sus relaciones.` })
        setIsModalOpen(false)
        loadCatalogoCrm()
      } else {
        const err = await res.json()
        setFeedback({ tipo: 'error', texto: err.detail || 'No se pudo guardar la práctica.' })
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error de conexión.' })
    } finally {
      setSavingModal(false)
    }
  }

  const handleDeleteCrmPractica = async (practicaId: string, codigo: string) => {
    if (!confirm(`¿Eliminar la práctica ${codigo}?`)) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/nomenclador/practicas-configuradas/${practicaId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setFeedback({ tipo: 'success', texto: `Práctica ${codigo} eliminada.` })
        loadCatalogoCrm()
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error al eliminar.' })
    }
  }

  const handleOpenCreatePrep = () => {
    setEditingPrep(null)
    setPrepForm({
      titulo: '',
      categoria: 'Oftalmología',
      texto_indicaciones: '',
      ayuno_horas: 8,
      dias_previos_aviso: 2,
      observaciones: ''
    })
    setIsPrepModalOpen(true)
  }

  const handleOpenEditPrep = (item: PlantillaPreparacion) => {
    setEditingPrep(item)
    setPrepForm({
      titulo: item.titulo,
      categoria: item.categoria,
      texto_indicaciones: item.texto_indicaciones,
      ayuno_horas: item.ayuno_horas,
      dias_previos_aviso: item.dias_previos_aviso,
      observaciones: item.observaciones || ''
    })
    setIsPrepModalOpen(true)
  }

  const handleSavePrep = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingPrep
        ? `${API_BASE_URL}/api/nomenclador/plantillas/preparaciones/${editingPrep.id}`
        : `${API_BASE_URL}/api/nomenclador/plantillas/preparaciones`
      const method = editingPrep ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prepForm)
      })

      if (res.ok) {
        setFeedback({ tipo: 'success', texto: 'Protocolo guardado.' })
        setIsPrepModalOpen(false)
        loadBibliotecas()
        loadCatalogoCrm()
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error de conexión.' })
    }
  }

  const handleDeletePrep = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar "${titulo}"?`)) return
    try {
      await fetch(`${API_BASE_URL}/api/nomenclador/plantillas/preparaciones/${id}`, { method: 'DELETE' })
      setFeedback({ tipo: 'success', texto: 'Eliminado.' })
      loadBibliotecas()
      loadCatalogoCrm()
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error.' })
    }
  }

  const handleOpenCreateConsent = () => {
    setEditingConsent(null)
    setConsentForm({
      titulo: '',
      especialidad: 'Oftalmología',
      cuerpo_legal: '',
      version: '1.0'
    })
    setIsConsentModalOpen(true)
  }

  const handleOpenEditConsent = (item: PlantillaConsentimiento) => {
    setEditingConsent(item)
    setConsentForm({
      titulo: item.titulo,
      especialidad: item.especialidad,
      cuerpo_legal: item.cuerpo_legal,
      version: item.version
    })
    setIsConsentModalOpen(true)
  }

  const handleSaveConsent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingConsent
        ? `${API_BASE_URL}/api/nomenclador/plantillas/consentimientos/${editingConsent.id}`
        : `${API_BASE_URL}/api/nomenclador/plantillas/consentimientos`
      const method = editingConsent ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consentForm)
      })

      if (res.ok) {
        setFeedback({ tipo: 'success', texto: 'Plantilla guardada.' })
        setIsConsentModalOpen(false)
        loadBibliotecas()
        loadCatalogoCrm()
      }
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error.' })
    }
  }

  const handleDeleteConsent = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar "${titulo}"?`)) return
    try {
      await fetch(`${API_BASE_URL}/api/nomenclador/plantillas/consentimientos/${id}`, { method: 'DELETE' })
      setFeedback({ tipo: 'success', texto: 'Eliminado.' })
      loadBibliotecas()
      loadCatalogoCrm()
    } catch (err) {
      setFeedback({ tipo: 'error', texto: 'Error.' })
    }
  }

  const filteredCrmPracticas = crmPracticas.filter((p) => {
    if (filtroTab === 'ARS' && p.moneda !== 'ARS') return false
    if (filtroTab === 'USD' && p.moneda !== 'USD') return false
    if (filtroTab === 'PREP' && !p.habilitar_preparacion) return false
    if (filtroTab === 'CONSENT' && !p.habilitar_consentimiento) return false
    if (filtroTab === 'MANUAL' && p.origen !== 'MANUAL') return false
    if (filtroTab === 'GECLISA' && p.origen !== 'GECLISA') return false

    if (crmSearchTerm.trim()) {
      const term = crmSearchTerm.toLowerCase()
      return p.codigo.toLowerCase().includes(term) || p.nombre.toLowerCase().includes(term) || (p.categoria || '').toLowerCase().includes(term)
    }
    return true
  })

  const totalArs = crmPracticas.filter((p) => p.moneda === 'ARS' && p.habilitar_arancel).length
  const totalUsd = crmPracticas.filter((p) => p.moneda === 'USD' && p.habilitar_arancel).length
  const totalConPrep = crmPracticas.filter((p) => p.habilitar_preparacion).length
  const totalConConsent = crmPracticas.filter((p) => p.habilitar_consentimiento).length
  const selectedPrepPlantilla = plantillasPrep.find((p) => p.id === formData.preparacion_plantilla_id)
  const selectedConsentPlantilla = plantillasConsent.find((p) => p.id === formData.consentimiento_plantilla_id)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* 1. Header Principal y Navegación de Pestañas */}
      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Building className="text-blue-600" size={22} />
              Nomenclador & Reglas Clínicas Multidimensionales
            </h2>
            <p className="text-xs text-[var(--secondary)] mt-1">
              Configura prácticas con vigencias de tarifas temporales, instrucciones de preparación prequirúrgica y plantillas de consentimiento informado para firma digital.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateManual}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Plus size={15} />
              + Crear Práctica Personalizada
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación del Módulo */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveMainTab('catalogo')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
              activeMainTab === 'catalogo'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers size={16} />
            Catálogo de Prácticas & Reglas ({crmPracticas.length})
          </button>

          <button
            onClick={() => setActiveMainTab('preparaciones')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
              activeMainTab === 'preparaciones'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ClipboardList size={16} />
            Biblioteca de Preparaciones ({plantillasPrep.length})
          </button>

          <button
            onClick={() => setActiveMainTab('consentimientos')}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
              activeMainTab === 'consentimientos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <PenTool size={16} />
            Biblioteca de Consentimientos ({plantillasConsent.length})
          </button>
        </div>

        {/* Métricas Rápidas */}
        {activeMainTab === 'catalogo' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-[var(--border)]">
              <span className="text-[11px] text-slate-400 font-semibold block">Prácticas Activas</span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{crmPracticas.length}</span>
            </div>
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold block">Con Tarifa ($ ARS / USD)</span>
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-200">
                {totalArs} ARS • {totalUsd} USD
              </span>
            </div>
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold block">Con Preparación Prequirúrgica</span>
              <span className="text-lg font-extrabold text-blue-600 dark:text-blue-200">{totalConPrep}</span>
            </div>
            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
              <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold block">Con Consentimiento Digital</span>
              <span className="text-lg font-extrabold text-purple-600 dark:text-purple-200">{totalConConsent}</span>
            </div>
          </div>
        )}

        {/* Alerta de Feedback */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 animate-scale-in ${
              feedback.tipo === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.tipo === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.texto}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold hover:underline">
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* VISTA 1: CATÁLOGO DE PRÁCTICAS & REGLAS */}
      {/* ==================================================================== */}
      {activeMainTab === 'catalogo' && (
        <div className="space-y-6">
          {/* Buscador en Vivo en Nomenclador de Geclisa */}
          <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-lg">
                  <Search size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Buscador en Vivo del Nomenclador Hospitalario (Geclisa)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Consulta códigos oficiales de Geclisa para fijarles tarifas temporales, preparaciones o consentimientos.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSearchGeclisa} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-4">
                <label className="font-bold text-slate-500 block mb-1">Tipo de Nomenclador Geclisa</label>
                <select
                  value={selectedNomId}
                  onChange={(e) => setSelectedNomId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tiposGeclisa.map((t) => (
                    <option key={t.nomId} value={t.nomId}>
                      {t.nomNom} ({t.nomId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="font-bold text-slate-500 block mb-1">Código o Nombre de Práctica</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchGeclisaQuery}
                    onChange={(e) => setSearchGeclisaQuery(e.target.value)}
                    placeholder="ej: 34031, Consulta, Ecografía, Fondo de Ojo, Blefaroplastia..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={searchingGeclisa}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {searchingGeclisa ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Buscar en Geclisa
                </button>
              </div>
            </form>

            {geclisaResults.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{geclisaResults.length} práctica(s) encontrada(s) en Geclisa:</span>
                  <button
                    onClick={() => setGeclisaResults([])}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    Ocultar resultados
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-slate-50/50 dark:bg-slate-900/30">
                  {geclisaResults.map((item, idx) => {
                    const nombre = item.nombre || item.practica || `Práctica ${item.nomCod}`
                    return (
                      <div
                        key={idx}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                            {item.nomCod}
                          </span>
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{nombre}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{item.tipo || 'Geclisa'}</span>
                              {item.ya_en_crm ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.2 rounded">
                                  <CheckCircle2 size={11} /> En CRM: {item.moneda_crm === 'USD' ? 'USD' : '$'}{' '}
                                  {item.precio_crm.toLocaleString('es-AR')}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                  Sin configurar en CRM
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleOpenConfigureGeclisa(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              item.ya_en_crm
                                ? 'bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            }`}
                          >
                            {item.ya_en_crm ? <Edit2 size={12} /> : <Plus size={12} />}
                            {item.ya_en_crm ? 'Configurar Reglas' : 'Importar & Configurar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tabla Maestra de Prácticas y Reglas */}
          <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="text-emerald-600" size={18} />
                  Catálogo de Prácticas y Reglas Activas ({crmPracticas.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Prácticas configuradas con sus reglas de arancel, preparación y consentimiento informado.
                </p>
              </div>

              <button
                onClick={loadCatalogoCrm}
                className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 transition"
              >
                <RefreshCw size={13} /> Actualizar Tabla
              </button>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setFiltroTab('todas')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    filtroTab === 'todas'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Todas ({crmPracticas.length})
                </button>
                <button
                  onClick={() => setFiltroTab('PREP')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                    filtroTab === 'PREP'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  📋 Con Prep ({totalConPrep})
                </button>
                <button
                  onClick={() => setFiltroTab('CONSENT')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                    filtroTab === 'CONSENT'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  ✍️ Con Consent ({totalConConsent})
                </button>
                <button
                  onClick={() => setFiltroTab('ARS')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    filtroTab === 'ARS'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  🇦🇷 ARS ({totalArs})
                </button>
                <button
                  onClick={() => setFiltroTab('USD')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    filtroTab === 'USD'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  🇺🇸 USD ({totalUsd})
                </button>
                <button
                  onClick={() => setFiltroTab('MANUAL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    filtroTab === 'MANUAL'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  ✨ Personalizadas
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={crmSearchTerm}
                  onChange={(e) => setCrmSearchTerm(e.target.value)}
                  placeholder="Filtrar en catálogo..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tabla de Prácticas */}
            {loadingCrm ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                Cargando catálogo de prácticas...
              </div>
            ) : filteredCrmPracticas.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-[var(--border)] rounded-xl">
                No hay prácticas configuradas con los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-slate-400 font-semibold uppercase text-[11px]">
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Práctica / Prestación</th>
                      <th className="py-2.5 px-3 text-center">Origen</th>
                      <th className="py-2.5 px-3 text-center">Módulos Activos</th>
                      <th className="py-2.5 px-3 text-right">Tarifa Vigente</th>
                      <th className="py-2.5 px-3 text-center">Vigencia</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredCrmPracticas.map((p) => {
                      const isUSD = p.moneda === 'USD'
                      const isManual = p.origen === 'MANUAL'

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                          <td className="py-3 px-3 font-mono font-bold text-blue-600">{p.codigo}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{p.nombre}</div>
                            <div className="text-[10px] text-slate-400">{p.categoria}</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isManual
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}
                            >
                              {isManual ? 'Personalizada' : 'Geclisa'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {p.habilitar_arancel ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" title="Arancel habilitado">
                                  <DollarSign size={10} /> Tarifa
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-400 dark:bg-slate-800" title="Sin arancel">
                                  Sin $
                                </span>
                              )}

                              {p.habilitar_preparacion ? (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  title={`Preparación: ${p.preparacion_plantilla_titulo || 'Texto propio'}`}
                                >
                                  <ClipboardList size={10} /> Prep
                                </span>
                              ) : null}

                              {p.habilitar_consentimiento ? (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                  title={`Consentimiento: ${p.consentimiento_plantilla_titulo || 'Texto propio'}`}
                                >
                                  <PenTool size={10} /> Consent
                                </span>
                              ) : null}

                              {p.requiere_lente ? (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                                  title="Requiere selección de Lente Intraocular (LIO)"
                                >
                                  💎 LIO
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {p.habilitar_arancel ? (
                              <>
                                <span className={isUSD ? 'text-amber-600' : 'text-emerald-600'}>
                                  {isUSD ? 'USD ' : '$ '}
                                </span>
                                {p.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </>
                            ) : (
                              <span className="text-slate-400 font-normal">N/A</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center text-[11px] text-slate-500 font-mono">
                            {p.habilitar_arancel ? (
                              p.vigencia_desde ? `${p.vigencia_desde} ${p.vigencia_hasta ? `a ${p.vigencia_hasta}` : ''}` : 'Indefinida'
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-3 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCrm(p)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Configurar práctica y reglas"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCrmPractica(p.id, p.codigo)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Eliminar del CRM"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VISTA 2: BIBLIOTECA DE PREPARACIONES MAESTRAS */}
      {/* ==================================================================== */}
      {activeMainTab === 'preparaciones' && (
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ClipboardList className="text-blue-600" size={18} />
                Biblioteca de Protocolos & Preparaciones Prequirúrgicas ({plantillasPrep.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Instrucciones estándar de ayuno, gotas y recomendaciones previas que se asignan a las prácticas y se envían al paciente por WhatsApp o Bot IA.
              </p>
            </div>

            <button
              onClick={handleOpenCreatePrep}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Nueva Plantilla de Preparación
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plantillasPrep.map((prep) => (
              <div
                key={prep.id}
                className="p-4 bg-slate-50/60 dark:bg-slate-900/40 border border-[var(--border)] rounded-xl space-y-3 relative group hover:border-blue-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {prep.categoria}
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mt-1">{prep.titulo}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditPrep(prep)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeletePrep(prep.id, prep.titulo)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-amber-500" /> {prep.ayuno_horas} hs de ayuno
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-blue-500" /> Avisar {prep.dias_previos_aviso} días antes
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-[var(--border)] text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line font-mono text-[11px]">
                  {prep.texto_indicaciones}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VISTA 3: BIBLIOTECA DE CONSENTIMIENTOS MAESTROS */}
      {/* ==================================================================== */}
      {activeMainTab === 'consentimientos' && (
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PenTool className="text-purple-600" size={18} />
                Biblioteca de Consentimientos Informados ({plantillasConsent.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Plantillas legales estructuradas con cláusulas médicas y variables automáticas para firma digital y generación de PDF.
              </p>
            </div>

            <button
              onClick={handleOpenCreateConsent}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Nueva Plantilla de Consentimiento
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plantillasConsent.map((cons) => (
              <div
                key={cons.id}
                className="p-4 bg-slate-50/60 dark:bg-slate-900/40 border border-[var(--border)] rounded-xl space-y-3 hover:border-purple-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                        {cons.especialidad}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">v{cons.version}</span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mt-1">{cons.titulo}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditConsent(cons)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteConsent(cons.id, cons.titulo)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-[var(--border)] text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line font-mono text-[11px] max-h-40 overflow-y-auto">
                  {cons.cuerpo_legal}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL INTEGRAL DE CONFIGURACIÓN DE PRÁCTICA (MULTI-PESTAÑA) */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] flex flex-col">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <SlidersHorizontal className="text-blue-600" size={20} />
                  {modalMode === 'manual'
                    ? 'Nueva Práctica Personalizada'
                    : modalMode === 'edit'
                    ? `Configuración Integral: ${formData.codigo}`
                    : `Configurar Práctica desde Geclisa (${formData.codigo})`}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Define los módulos que aplican a esta práctica: aranceles temporales, preparación y consentimiento.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-pestañas internas del Modal */}
            <div className="flex items-center gap-1 border-b border-[var(--border)] pb-2 text-xs">
              <button
                type="button"
                onClick={() => setModalSubTab('general')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  modalSubTab === 'general'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText size={13} /> 1. Datos Generales
              </button>

              <button
                type="button"
                onClick={() => setModalSubTab('aranceles')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  modalSubTab === 'aranceles'
                    ? 'bg-emerald-600 text-white'
                    : formData.habilitar_arancel
                    ? 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <DollarSign size={13} /> 2. Valores & Tarifas
                {formData.habilitar_arancel && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
              </button>

              <button
                type="button"
                onClick={() => setModalSubTab('preparacion')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  modalSubTab === 'preparacion'
                    ? 'bg-blue-600 text-white'
                    : formData.habilitar_preparacion
                    ? 'text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ClipboardList size={13} /> 3. Preparación
                {formData.habilitar_preparacion && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
              </button>

              <button
                type="button"
                onClick={() => setModalSubTab('consentimiento')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  modalSubTab === 'consentimiento'
                    ? 'bg-purple-600 text-white'
                    : formData.habilitar_consentimiento
                    ? 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <PenTool size={13} /> 4. Consentimiento
                {formData.habilitar_consentimiento && <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>}
              </button>

              <button
                type="button"
                onClick={() => setModalSubTab('relacionadas')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  modalSubTab === 'relacionadas'
                    ? 'bg-indigo-600 text-white'
                    : practicasRelacionadas.length > 0
                    ? 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Link2 size={13} /> 5. Prácticas Vinculadas
                {practicasRelacionadas.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-extrabold">
                    {practicasRelacionadas.length}
                  </span>
                )}
              </button>

              {formData.requiere_lente && (
                <button
                  type="button"
                  onClick={() => setModalSubTab('lios')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    modalSubTab === 'lios'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 bg-amber-500/10'
                  }`}
                >
                  <span>💎 6. LIOs & Precios</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-extrabold">
                    {listaLiosModal.length > 0
                      ? listaLiosModal.filter((l) => l.habilitado_en_practica !== false).length
                      : '6'}
                  </span>
                </button>
              )}
            </div>

            {/* Contenido scrolleable del formulario */}
            <form onSubmit={handleSavePracticaIntegral} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              {/* SUB-PESTAÑA 1: DATOS GENERALES */}
              {modalSubTab === 'general' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Código de Práctica</label>
                      <input
                        type="text"
                        required
                        readOnly={modalMode === 'geclisa'}
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                        placeholder="ej: 34031, CIR-01"
                        className={`w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                          modalMode === 'geclisa' ? 'bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-500 block mb-1">Categoría / Especialidad</label>
                      <input
                        type="text"
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                        placeholder="ej: Oftalmología, Cirugía..."
                        className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Nombre de la Práctica</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="ej: Catarata con Facoemulsificación e Impl. LIO"
                      className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 block mb-1">Descripción / Notas Internas</label>
                    <textarea
                      rows={2}
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Observaciones de la prestación..."
                      className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Configuración de Modalidad de Lateralidad y Quirófano */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-blue-500/20 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <SlidersHorizontal size={14} className="text-blue-500" />
                        Modalidad Quirúrgica & Lateralidad por Defecto
                      </label>
                      <span className="text-[10px] text-slate-400">Determina el agendamiento al confirmar</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, modalidad_lateralidad_defecto: 'unilateral', ojo_defecto: 'OD' })}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                          formData.modalidad_lateralidad_defecto === 'unilateral'
                            ? 'bg-blue-50/80 border-blue-500 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-[var(--border)] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-bold text-xs">👁️ Unilateral</span>
                        <span className="text-[10px] opacity-75">1 solo ojo (OD/OI). Genera 1 turno.</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, modalidad_lateralidad_defecto: 'bilateral_escalonada', ojo_defecto: 'AO' })}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                          formData.modalidad_lateralidad_defecto === 'bilateral_escalonada'
                            ? 'bg-purple-50/80 border-purple-500 text-purple-900 dark:bg-purple-950/50 dark:text-purple-300 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-[var(--border)] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-bold text-xs">👁️👁️ Bilateral Escalonada</span>
                        <span className="text-[10px] opacity-75">2 días separados (Catarata). Genera 2 turnos.</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, modalidad_lateralidad_defecto: 'bilateral_simultanea', ojo_defecto: 'AO' })}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                          formData.modalidad_lateralidad_defecto === 'bilateral_simultanea'
                            ? 'bg-emerald-50/80 border-emerald-500 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-[var(--border)] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-bold text-xs">👁️👁️ Bilateral Simultánea</span>
                        <span className="text-[10px] opacity-75">Mismo día (LASIK). Genera 1 turno.</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="text-[11px] text-slate-500 font-bold">Duración estimada por acto:</span>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={formData.duracion_estimada_minutos}
                        onChange={(e) => setFormData({ ...formData, duracion_estimada_minutos: parseInt(e.target.value, 10) || 20 })}
                        className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-[var(--border)] rounded-lg text-xs font-bold text-center outline-none focus:border-blue-500"
                      />
                      <span className="text-[11px] text-slate-400">minutos</span>
                    </div>
                  </div>

                  {/* Requiere Selección de Lente Intraocular (LIO) */}
                  <div className="flex items-center justify-between p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="space-y-0.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">💎</span>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Requiere Selección de Lente Intraocular (LIO)
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Habilita la elección del LIO en la Lateralidad del caso (Cataratas) y sugiere los lentes comerciales con precio al crear presupuestos.
                      </p>
                      {formData.requiere_lente && (
                        <div className="pt-2 mt-1 border-t border-amber-300/40 dark:border-amber-700/40 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                            ¿Deseas configurar qué lentes aplican y sus aranceles vigentes?
                          </span>
                          <button
                            type="button"
                            onClick={() => setModalSubTab('lios')}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs transition cursor-pointer shrink-0"
                          >
                            <span>Configurar LIOs & Precios</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={formData.requiere_lente || false}
                        onChange={(e) => setFormData({ ...formData, requiere_lente: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {/* Resumen de Módulos Activos */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-xl space-y-2">
                    <span className="font-bold text-slate-600 dark:text-slate-300 block text-xs">Módulos Habilitados para esta práctica:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                      <div className={`p-2 rounded-lg border font-bold ${formData.habilitar_arancel ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800'}`}>
                        💰 Arancel ({formData.habilitar_arancel ? 'Sí' : 'No'})
                      </div>
                      <div className={`p-2 rounded-lg border font-bold ${formData.habilitar_preparacion ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800'}`}>
                        📋 Prep ({formData.habilitar_preparacion ? 'Sí' : 'No'})
                      </div>
                      <div className={`p-2 rounded-lg border font-bold ${formData.habilitar_consentimiento ? 'bg-purple-50 border-purple-300 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800'}`}>
                        ✍️ Consent ({formData.habilitar_consentimiento ? 'Sí' : 'No'})
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, requiere_lente: !formData.requiere_lente })}
                        className={`p-2 rounded-lg border font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          formData.requiere_lente
                            ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 shadow-xs ring-1 ring-amber-400/40'
                            : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 hover:border-slate-300'
                        }`}
                        title="Clic para activar/desactivar requerimiento de LIO"
                      >
                        <span>💎 Requiere LIO</span>
                        <span className="text-[10px]">({formData.requiere_lente ? 'Sí' : 'No'})</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-PESTAÑA 2: VALORES & ARANCELES TEMPORALES */}
              {modalSubTab === 'aranceles' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                    <div>
                      <span className="font-bold text-emerald-900 dark:text-emerald-200 block text-xs">
                        Habilitar Arancel para Presupuestos
                      </span>
                      <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                        Permite que el cotizador de presupuestos y el Bot resuelvan el valor de la práctica por fecha.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.habilitar_arancel}
                        onChange={(e) => setFormData({ ...formData, habilitar_arancel: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {formData.habilitar_arancel && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-500 block mb-1">Moneda de Tarifa</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, moneda: 'ARS' })}
                              className={`p-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                                formData.moneda === 'ARS'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              🇦🇷 Pesos ($)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, moneda: 'USD' })}
                              className={`p-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                                formData.moneda === 'USD'
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              🇺🇸 Dólares (USD)
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-slate-500 block mb-1">
                            Precio Unitario ({formData.moneda === 'USD' ? 'USD' : '$'})
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">
                              {formData.moneda === 'USD' ? 'USD' : '$'}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.precio}
                              onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-11 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                        <div>
                          <label className="font-bold text-slate-500 block mb-1">Vigencia Desde</label>
                          <input
                            type="date"
                            value={formData.vigencia_desde}
                            onChange={(e) => setFormData({ ...formData, vigencia_desde: e.target.value })}
                            className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-500 block mb-1">Vigencia Hasta (Opcional)</label>
                          <input
                            type="date"
                            value={formData.vigencia_hasta}
                            onChange={(e) => setFormData({ ...formData, vigencia_hasta: e.target.value })}
                            className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono"
                          />
                        </div>
                      </div>

                      {/* Historial de Tarifas Registradas */}
                      {historialAranceles.length > 0 && (
                        <div className="pt-3 border-t border-[var(--border)] space-y-2">
                          <span className="font-bold text-slate-500 block text-[11px]">
                            Histórico de Vigencias Registradas ({historialAranceles.length}):
                          </span>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {historialAranceles.map((h) => (
                              <div
                                key={h.id}
                                className="p-2 bg-white dark:bg-slate-900 border border-[var(--border)] rounded-lg flex items-center justify-between text-[11px]"
                              >
                                <span className="font-mono font-bold text-emerald-600">
                                  {h.moneda === 'USD' ? 'USD' : '$'} {h.precio.toLocaleString('es-AR')}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {h.vigencia_desde} {h.vigencia_hasta ? `hasta ${h.vigencia_hasta}` : '(Indefinida)'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-PESTAÑA 3: PREPARACIÓN PREQUIRÚRGICA */}
              {modalSubTab === 'preparacion' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div>
                      <span className="font-bold text-blue-900 dark:text-blue-200 block text-xs">
                        Habilitar Instrucciones de Preparación
                      </span>
                      <span className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                        Instrucciones de ayuno y cuidados que se enviarán al paciente antes de la cirugía.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.habilitar_preparacion}
                        onChange={(e) => setFormData({ ...formData, habilitar_preparacion: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {formData.habilitar_preparacion && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, modo_preparacion: 'plantilla' })}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                            formData.modo_preparacion === 'plantilla'
                              ? 'bg-blue-600 text-white'
                              : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Usar Plantilla Maestra Reutilizable
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, modo_preparacion: 'custom' })}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                            formData.modo_preparacion === 'custom'
                              ? 'bg-blue-600 text-white'
                              : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Texto Personalizado para esta Práctica
                        </button>
                      </div>

                      {formData.modo_preparacion === 'plantilla' ? (
                        <div className="space-y-2">
                          <label className="font-bold text-slate-500 block mb-1">Seleccionar Protocolo Maestro</label>
                          <select
                            value={formData.preparacion_plantilla_id}
                            onChange={(e) => setFormData({ ...formData, preparacion_plantilla_id: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {plantillasPrep.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.titulo} ({p.ayuno_horas} hs ayuno)
                              </option>
                            ))}
                          </select>

                          {selectedPrepPlantilla && (
                            <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-[var(--border)] space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block">Vista Previa de Indicaciones:</span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line font-mono text-[11px]">
                                {selectedPrepPlantilla.texto_indicaciones}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="font-bold text-slate-500 block mb-1">Texto de Indicaciones Prequirúrgicas</label>
                          <textarea
                            rows={5}
                            value={formData.preparacion_custom_texto}
                            onChange={(e) => setFormData({ ...formData, preparacion_custom_texto: e.target.value })}
                            placeholder="Instrucciones directas para el paciente: ayuno, gotas, estudios..."
                            className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-[10px] text-slate-400">
                            Variables disponibles: <code className="text-blue-500">{'{paciente}'}</code>,{' '}
                            <code className="text-blue-500">{'{fecha_cirugia}'}</code>,{' '}
                            <code className="text-blue-500">{'{practica}'}</code>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-PESTAÑA 4: CONSENTIMIENTO INFORMADO */}
              {modalSubTab === 'consentimiento' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                    <div>
                      <span className="font-bold text-purple-900 dark:text-purple-200 block text-xs">
                        Requiere Consentimiento Informado Quirúrgico
                      </span>
                      <span className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
                        Genera el documento legal para la firma digital del paciente desde el link público.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.habilitar_consentimiento}
                        onChange={(e) => setFormData({ ...formData, habilitar_consentimiento: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {formData.habilitar_consentimiento && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, modo_consentimiento: 'plantilla' })}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                            formData.modo_consentimiento === 'plantilla'
                              ? 'bg-purple-600 text-white'
                              : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Usar Plantilla Legal Maestra
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, modo_consentimiento: 'custom' })}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                            formData.modo_consentimiento === 'custom'
                              ? 'bg-purple-600 text-white'
                              : 'bg-[var(--background)] border border-[var(--border)] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Cláusula Exclusiva para esta Práctica
                        </button>
                      </div>

                      {formData.modo_consentimiento === 'plantilla' ? (
                        <div className="space-y-2">
                          <label className="font-bold text-slate-500 block mb-1">Seleccionar Plantilla Legal</label>
                          <select
                            value={formData.consentimiento_plantilla_id}
                            onChange={(e) => setFormData({ ...formData, consentimiento_plantilla_id: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            {plantillasConsent.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.titulo} (v{c.version})
                              </option>
                            ))}
                          </select>

                          {selectedConsentPlantilla && (
                            <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-[var(--border)] space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block">Cuerpo Legal:</span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line font-mono text-[11px] max-h-36 overflow-y-auto">
                                {selectedConsentPlantilla.cuerpo_legal}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="font-bold text-slate-500 block mb-1">Texto del Consentimiento Legal Enriquecido</label>
                          <RichConsentEditor
                            value={formData.consentimiento_custom_texto || ''}
                            onChange={(val) => setFormData({ ...formData, consentimiento_custom_texto: val })}
                            placeholder="Por el presente documento, yo {paciente}, DNI {dni}, autorizo al Dr/a. {cirujano}..."
                            minHeight="280px"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-PESTAÑA 5: PRÁCTICAS VINCULADAS (ANESTESIA, QUIRÓFANO, INSUMOS) */}
              {modalSubTab === 'relacionadas' && (
                <div className="space-y-4">
                  {/* Banner Explicativo */}
                  <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200 text-xs">
                      <Link2 size={15} className="text-indigo-600" />
                      <span>Dependencias Clínicas & Módulos Asociados</span>
                    </div>
                    <p className="text-[11px] text-indigo-700/90 dark:text-indigo-300/80 leading-relaxed">
                      Al presupuestar esta práctica desde el expediente del paciente (botón <strong>&quot;Presupuestar&quot;</strong>),
                      el sistema sugerirá o cargará automáticamente las prestaciones vinculadas (anestesia según complejidad, derecho de sala, insumos),
                      evitando omisiones y calculando los aranceles vigentes.
                    </p>
                  </div>

                  {/* Panel para Agregar Nueva Relación */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-[var(--border)] rounded-xl space-y-3">
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-xs block">
                      Vincular Práctica Existente
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Práctica a Asociar *
                        </label>
                        <select
                          value={relPracticaSelectId}
                          onChange={(e) => setRelPracticaSelectId(e.target.value)}
                          className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Seleccionar práctica del catálogo --</option>
                          {crmPracticas
                            .filter((p) => p.id !== formData.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.codigo}] {p.nombre} {p.precio ? `($ ${p.precio.toLocaleString('es-AR')} ${p.moneda})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Rol / Categoría
                        </label>
                        <select
                          value={relTipoSelect}
                          onChange={(e) => setRelTipoSelect(e.target.value as any)}
                          className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="anestesia">💉 Anestesiología</option>
                          <option value="quirofano">🏥 Derecho Quirófano / Sala</option>
                          <option value="insumo">📦 Insumo / LIO / Prótesis</option>
                          <option value="estudio">🔬 Estudio Previo</option>
                          <option value="honorario">👤 Honorario Extra</option>
                          <option value="general">🔗 Conexa General</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Cant. Default
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={relCantidad}
                          onChange={(e) => setRelCantidad(parseInt(e.target.value) || 1)}
                          className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddRelacion}
                          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition"
                        >
                          <Plus size={13} />
                          <span>Vincular</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[11px]">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300 font-medium">
                        <input
                          type="checkbox"
                          checked={relEsObligatoria}
                          onChange={(e) => setRelEsObligatoria(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span>Pre-tildar por defecto en el presupuesto (Obligatoria / Protocolo fijo)</span>
                      </label>

                      <input
                        type="text"
                        placeholder="Nota u observación clínica (opcional)"
                        value={relNotas}
                        onChange={(e) => setRelNotas(e.target.value)}
                        className="p-1 px-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] w-64 outline-none"
                      />
                    </div>
                  </div>

                  {/* Lista de Prácticas Vinculadas Actualmente */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Prácticas Conexas Configuradas ({practicasRelacionadas.length})
                      </span>
                      {formData.id && (
                        <button
                          type="button"
                          onClick={handleSaveRelacionesDirecto}
                          disabled={savingRelacionadas}
                          className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                          {savingRelacionadas ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                          <span>Guardar solo vínculos</span>
                        </button>
                      )}
                    </div>

                    {loadingRelacionadas ? (
                      <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-indigo-600" />
                        <span>Cargando vínculos...</span>
                      </div>
                    ) : practicasRelacionadas.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-[var(--border)] rounded-xl text-slate-400 text-xs">
                        No hay prácticas vinculadas a esta cirugía aún. Utilice el selector de arriba para asociar anestesia, derechos de quirófano o estudios.
                      </div>
                    ) : (
                      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-[var(--border)] text-[10px] text-slate-400 uppercase font-bold">
                            <tr>
                              <th className="py-2 px-3">Rol</th>
                              <th className="py-2 px-3">Código & Práctica</th>
                              <th className="py-2 px-3 text-center">Cant.</th>
                              <th className="py-2 px-3 text-right">Tarifa Vigente</th>
                              <th className="py-2 px-3 text-center">Inclusión</th>
                              <th className="py-2 px-3 text-center">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {practicasRelacionadas.map((r, idx) => (
                              <tr key={r.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      r.tipo_relacion === 'anestesia'
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                        : r.tipo_relacion === 'quirofano'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                        : r.tipo_relacion === 'insumo'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : r.tipo_relacion === 'estudio'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    }`}
                                  >
                                    {r.tipo_relacion === 'anestesia'
                                      ? '💉 Anestesia'
                                      : r.tipo_relacion === 'quirofano'
                                      ? '🏥 Quirófano'
                                      : r.tipo_relacion === 'insumo'
                                      ? '📦 Insumo'
                                      : r.tipo_relacion === 'estudio'
                                      ? '🔬 Estudio'
                                      : 'Conexa'}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">
                                    <span className="font-mono text-blue-600 mr-1.5">[{r.codigo}]</span>
                                    {r.nombre}
                                  </div>
                                  {r.notas && <div className="text-[10px] text-slate-400 italic">{r.notas}</div>}
                                </td>
                                <td className="py-2 px-3 text-center font-bold">{r.cantidad_default || 1}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {r.precio && r.precio > 0 ? (
                                    <span>
                                      {r.moneda === 'USD' ? 'USD ' : '$ '}
                                      {r.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">Sin tarifa</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {r.es_obligatoria ? (
                                    <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-center gap-0.5">
                                      <Check size={11} /> Pre-marcada
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">Opcional</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRelacion(idx)}
                                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                    title="Desvincular"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-PESTAÑA 6: LENTES INTRAOCULARES (LIOS) & ARANCELES */}
              {modalSubTab === 'lios' && (
                <div className="space-y-4">
                  {/* Banner Explicativo con acción de nuevo LIO */}
                  <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-xs">
                        <span>💎</span>
                        <span>Lentes Intraoculares (LIOs) Disponibles para Presupuestar</span>
                      </div>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                        Selecciona qué lentes aplican a esta cirugía de catarata y actualiza sus precios vigentes in-situ. Al crear presupuestos desde el expediente, la asesora podrá agregarlos con 1 solo clic.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarNuevoLioModal(!mostrarNuevoLioModal)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      <span>Nuevo Modelo LIO</span>
                    </button>
                  </div>

                  {/* Formulario Desplegable para Agregar Nuevo LIO */}
                  {mostrarNuevoLioModal && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-amber-300/60 dark:border-amber-700/60 rounded-xl space-y-3 animate-in fade-in duration-150">
                      <span className="font-bold text-slate-700 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-500" />
                        Registrar Nuevo Lente Comercial en el Nomenclador
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Código *
                          </label>
                          <input
                            type="text"
                            placeholder="ej: TECNIS, PANOPTIX"
                            value={nuevoLioForm.codigo}
                            onChange={(e) => setNuevoLioForm({ ...nuevoLioForm, codigo: e.target.value.toUpperCase() })}
                            className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Nombre Comercial *
                          </label>
                          <input
                            type="text"
                            placeholder="ej: LENTE TECNIS SYNERGY"
                            value={nuevoLioForm.nombre}
                            onChange={(e) => setNuevoLioForm({ ...nuevoLioForm, nombre: e.target.value })}
                            className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Moneda
                          </label>
                          <select
                            value={nuevoLioForm.moneda}
                            onChange={(e) => setNuevoLioForm({ ...nuevoLioForm, moneda: e.target.value as 'ARS' | 'USD' })}
                            className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="ARS">ARS ($)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3 flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Precio Inicial
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={nuevoLioForm.precio}
                              onChange={(e) => setNuevoLioForm({ ...nuevoLioForm, precio: parseFloat(e.target.value) || 0 })}
                              className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-bold text-right outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCrearNuevoLio}
                            disabled={creandoLio || !nuevoLioForm.codigo.trim() || !nuevoLioForm.nombre.trim()}
                            className="py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs self-end flex items-center gap-1 shadow-xs transition cursor-pointer"
                          >
                            {creandoLio ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback específico para LIOs */}
                  {feedbackLio && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                        feedbackLio.tipo === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                      }`}
                    >
                      {feedbackLio.tipo === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>{feedbackLio.texto}</span>
                    </div>
                  )}

                  {/* Tabla / Tarjetas de LIOs */}
                  {loadingLiosModal ? (
                    <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-amber-600" />
                      <span>Cargando catálogo de LIOs...</span>
                    </div>
                  ) : listaLiosModal.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-[var(--border)] rounded-xl text-slate-400 text-xs space-y-2">
                      <p>No se encontraron lentes intraoculares en el catálogo.</p>
                      <button
                        type="button"
                        onClick={() => setMostrarNuevoLioModal(true)}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1"
                      >
                        <Plus size={13} />
                        <span>Crear Primer LIO</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-[var(--border)] text-[10px] text-slate-400 uppercase font-bold">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-24">Aplica a QX</th>
                            <th className="py-2.5 px-3">Modelo / LIO Comercial</th>
                            <th className="py-2.5 px-3">Tecnología Óptica</th>
                            <th className="py-2.5 px-3 text-right">Moneda</th>
                            <th className="py-2.5 px-3 text-right w-36">Arancel Vigente</th>
                            <th className="py-2.5 px-3 text-center w-28">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {listaLiosModal.map((lio) => {
                            const isEnabled = lio.habilitado_en_practica !== false
                            const isSavingThis = savingLioCodigo === lio.codigo
                            return (
                              <tr
                                key={lio.id || lio.codigo}
                                className={`transition ${
                                  isEnabled
                                    ? 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'
                                    : 'bg-slate-100/50 dark:bg-slate-900/40 opacity-60'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => handleToggleLioHabilitado(lio.codigo)}
                                      className="sr-only peer"
                                    />
                                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-600"></div>
                                  </label>
                                </td>

                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                    <span className="font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded text-[11px] border border-amber-200 dark:border-amber-800">
                                      {lio.codigo}
                                    </span>
                                    <span>{lio.nombre}</span>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        lio.tipo_vision?.includes('Trifocal')
                                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                          : lio.tipo_vision?.includes('EDOF')
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      }`}
                                    >
                                      {lio.tipo_vision || 'Monofocal'}
                                    </span>
                                    {lio.es_torico && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60">
                                        🎯 TÓRICO
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <select
                                    value={lio.moneda || 'USD'}
                                    onChange={(e) => {
                                      const newMon = e.target.value as 'ARS' | 'USD'
                                      setListaLiosModal((prev) =>
                                        prev.map((l) => (l.codigo === lio.codigo ? { ...l, moneda: newMon } : l))
                                      )
                                    }}
                                    className="p-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-bold outline-none cursor-pointer"
                                  >
                                    <option value="USD">USD ($)</option>
                                    <option value="ARS">ARS ($)</option>
                                  </select>
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={lio.precio}
                                    onChange={(e) => {
                                      const newP = parseFloat(e.target.value) || 0
                                      setListaLiosModal((prev) =>
                                        prev.map((l) => (l.codigo === lio.codigo ? { ...l, precio: newP } : l))
                                      )
                                    }}
                                    className="w-full p-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-mono font-bold text-right outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    disabled={isSavingThis}
                                    onClick={() => handleGuardarPrecioLio(lio.codigo, lio.precio, lio.moneda)}
                                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50 mx-auto"
                                    title="Guardar tarifa para este LIO"
                                  >
                                    {isSavingThis ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Save size={12} />
                                    )}
                                    <span>Guardar</span>
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Botones del Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingModal}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {savingModal ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Guardar Configuración Integral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL CREAR/EDITAR PLANTILLA DE PREPARACIÓN */}
      {/* ==================================================================== */}
      {isPrepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ClipboardList className="text-blue-600" size={20} />
                {editingPrep ? 'Editar Protocolo de Preparación' : 'Nueva Plantilla de Preparación'}
              </h3>
              <button onClick={() => setIsPrepModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePrep} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-500 block mb-1">Título del Protocolo</label>
                <input
                  type="text"
                  required
                  value={prepForm.titulo}
                  onChange={(e) => setPrepForm({ ...prepForm, titulo: e.target.value })}
                  placeholder="ej: Cirugía de Cataratas / Facoemulsificación"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Horas de Ayuno</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={prepForm.ayuno_horas}
                    onChange={(e) => setPrepForm({ ...prepForm, ayuno_horas: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Días Previos de Aviso</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={prepForm.dias_previos_aviso}
                    onChange={(e) => setPrepForm({ ...prepForm, dias_previos_aviso: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Texto de Indicaciones Prequirúrgicas</label>
                <textarea
                  rows={5}
                  required
                  value={prepForm.texto_indicaciones}
                  onChange={(e) => setPrepForm({ ...prepForm, texto_indicaciones: e.target.value })}
                  placeholder="Instrucciones paso a paso que recibirá el paciente..."
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPrepModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Guardar Protocolo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL CREAR/EDITAR PLANTILLA DE CONSENTIMIENTO */}
      {/* ==================================================================== */}
      {isConsentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in max-h-[92vh] flex flex-col">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <PenTool className="text-purple-600" size={20} />
                  {editingConsent ? 'Editar Plantilla de Consentimiento Informado' : 'Nueva Plantilla de Consentimiento Informado'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Editor médico-legal con soporte de formato enriquecido, variables dinámicas y vista previa en tiempo real.
                </p>
              </div>
              <button
                onClick={() => setIsConsentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario Scrolleable */}
            <form onSubmit={handleSaveConsent} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="font-bold text-slate-500 block mb-1">Título del Consentimiento</label>
                  <input
                    type="text"
                    required
                    value={consentForm.titulo}
                    onChange={(e) => setConsentForm({ ...consentForm, titulo: e.target.value })}
                    placeholder="ej: Consentimiento Cirugía de Cataratas y LIO"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="font-bold text-slate-500 block mb-1">Especialidad</label>
                  <input
                    type="text"
                    value={consentForm.especialidad}
                    onChange={(e) => setConsentForm({ ...consentForm, especialidad: e.target.value })}
                    placeholder="Oftalmología"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="font-bold text-slate-500 block mb-1">Versión</label>
                  <input
                    type="text"
                    value={consentForm.version}
                    onChange={(e) => setConsentForm({ ...consentForm, version: e.target.value })}
                    placeholder="2.0 (CAO Oficial)"
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] font-mono font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1.5 flex items-center justify-between">
                  <span>Cuerpo Legal & Cláusulas Médicas (Editor Enriquecido)</span>
                </label>
                <RichConsentEditor
                  value={consentForm.cuerpo_legal}
                  onChange={(val) => setConsentForm({ ...consentForm, cuerpo_legal: val })}
                  placeholder="Por el presente documento, yo {paciente}, DNI {dni}..."
                  minHeight="380px"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsConsentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle2 size={16} />
                  Guardar Consentimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

