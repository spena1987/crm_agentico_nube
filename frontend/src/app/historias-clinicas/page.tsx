'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  Search, 
  ClipboardPlus, 
  FileText, 
  Stethoscope, 
  Sparkles, 
  Database, 
  User, 
  Phone, 
  ShieldCheck, 
  Clock, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  History, 
  X, 
  Eye, 
  Hash,
  RefreshCw,
  FolderOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import ModalHistoriaClinica from '@/components/ModalHistoriaClinica'

interface PacienteItem {
  id: string
  nombre: string
  dni?: string | null
  geclisa_ficha_id?: number | null
  nro_hc?: string | null
  telefono?: string
  email?: string | null
  obra_social?: string | null
  plan_cobertura?: string | null
  nro_afiliado?: string | null
  fecha_nacimiento?: string | null
  sexo?: string | null
  direccion?: string | null
  origen: 'crm' | 'geclisa'
  raw_geclisa?: any
  ultimo_acceso?: string
}

const STORAGE_KEY_RECENT = 'hce_recent_patients'

function HistoriasClinicasContent() {
  const searchParams = useSearchParams()
  const paramDni = searchParams?.get('dni') || null
  const paramId = searchParams?.get('id') || null

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Buscador
  const [searchTerm, setSearchTerm] = useState<string>(paramDni || '')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [searchResults, setSearchResults] = useState<PacienteItem[]>([])
  const [hasSearched, setHasSearched] = useState<boolean>(false)
  const [searchFilter, setSearchFilter] = useState<'todos' | 'crm' | 'geclisa'>('todos')
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)

  // Pacientes Recientes
  const [recentPatients, setRecentPatients] = useState<PacienteItem[]>([])
  const [fallbackRecent, setFallbackRecent] = useState<PacienteItem[]>([])
  const [loadingFallback, setLoadingFallback] = useState<boolean>(false)

  // Estado del Modal de Historia Clínica
  const [selectedPaciente, setSelectedPaciente] = useState<PacienteItem | null>(null)
  const [mostrarModalHC, setMostrarModalHC] = useState<boolean>(false)
  const [importingFichaId, setImportingFichaId] = useState<number | null>(null)

  // Bandera para evitar doble búsqueda automática en carga inicial
  const autoSearchExecuted = useRef<boolean>(false)

  // 1. Cargar pacientes recientes desde localStorage
  const loadRecentFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RECENT)
      if (raw) {
        const parsed: PacienteItem[] = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecentPatients(parsed.slice(0, 6))
          return parsed.length > 0
        }
      }
    } catch (e) {
      console.warn('Error leyendo pacientes recientes de localStorage:', e)
    }
    return false
  }, [])

  // 2. Guardar paciente en recientes
  const saveToRecent = useCallback((paciente: PacienteItem) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RECENT)
      let list: PacienteItem[] = raw ? JSON.parse(raw) : []
      if (!Array.isArray(list)) list = []

      // Remover si ya existe para colocarlo en primer lugar
      list = list.filter((p) => p.id !== paciente.id && (!paciente.dni || p.dni !== paciente.dni))

      const itemReciente: PacienteItem = {
        ...paciente,
        origen: 'crm',
        ultimo_acceso: new Date().toISOString()
      }

      list.unshift(itemReciente)
      const trimmed = list.slice(0, 6)
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(trimmed))
      setRecentPatients(trimmed)
    } catch (e) {
      console.warn('Error guardando paciente reciente en localStorage:', e)
    }
  }, [])

  // 3. Fallback: Si no hay recientes locales, cargar los últimos 6 pacientes de CRM
  const fetchFallbackPatients = useCallback(async () => {
    setLoadingFallback(true)
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nombre, dni, geclisa_ficha_id, nro_hc, telefono, email, obra_social, plan_cobertura, nro_afiliado, fecha_nacimiento, sexo, direccion, created_at')
        .order('created_at', { ascending: false })
        .limit(6)

      if (!error && data) {
        const mapped: PacienteItem[] = data.map((p: any) => ({
          ...p,
          origen: 'crm',
          ultimo_acceso: p.created_at
        }))
        setFallbackRecent(mapped)
      }
    } catch (e) {
      console.error('Error cargando pacientes fallback:', e)
    } finally {
      setLoadingFallback(false)
    }
  }, [])

  // 4. Abrir la Historia Clínica de un paciente CRM
  const handleOpenHC = useCallback((paciente: PacienteItem) => {
    setSelectedPaciente(paciente)
    saveToRecent(paciente)
    setMostrarModalHC(true)
  }, [saveToRecent])

  // 5. Importar paciente desde Geclisa y abrir de inmediato su Historia Clínica
  const handleImportarAndOpen = useCallback(async (geclisaItem: PacienteItem) => {
    if (!geclisaItem.raw_geclisa && !geclisaItem.geclisa_ficha_id) return
    const fichaId = geclisaItem.geclisa_ficha_id || geclisaItem.raw_geclisa?.ficha_id
    if (fichaId) setImportingFichaId(fichaId)

    try {
      const telFinal = geclisaItem.telefono || geclisaItem.raw_geclisa?.celular || `temp_${fichaId || Date.now()}`
      const payload = {
        ...(geclisaItem.raw_geclisa || {}),
        ficha_id: fichaId,
        nombre: geclisaItem.nombre,
        dni: geclisaItem.dni,
        telefono: telFinal,
        obra_social: geclisaItem.obra_social,
        plan_cobertura: geclisaItem.plan_cobertura,
        nro_hc: geclisaItem.nro_hc
      }

      let pacienteGuardado: any = null

      // A) Intentar vía backend
      try {
        const res = await apiFetch('/api/geclisa/pacientes/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (res.ok && data.success && data.paciente) {
          pacienteGuardado = data.paciente
        }
      } catch (backendErr) {
        console.warn('Backend import fallback directo a Supabase:', backendErr)
      }

      // B) Fallback directo a Supabase
      if (!pacienteGuardado) {
        const fichaNum = fichaId ? Number(fichaId) : null
        const dniStr = geclisaItem.dni ? String(geclisaItem.dni) : null

        let existingId: string | null = null
        if (fichaNum) {
          const { data: pFicha } = await supabase.from('pacientes').select('id').eq('geclisa_ficha_id', fichaNum).maybeSingle()
          if (pFicha?.id) existingId = pFicha.id
        }
        if (!existingId && dniStr) {
          const { data: pDni } = await supabase.from('pacientes').select('id').eq('dni', dniStr).maybeSingle()
          if (pDni?.id) existingId = pDni.id
        }

        const datosLimpios: any = {
          nombre: geclisaItem.nombre || 'Paciente Geclisa',
          telefono: telFinal,
          dni: dniStr,
          geclisa_ficha_id: fichaNum,
          nro_hc: geclisaItem.nro_hc || null,
          obra_social: geclisaItem.obra_social || null,
          plan_cobertura: geclisaItem.plan_cobertura || null,
          fecha_nacimiento: geclisaItem.fecha_nacimiento || null,
          sexo: geclisaItem.sexo || null,
          direccion: geclisaItem.direccion || null,
          email: geclisaItem.email || null,
        }

        if (existingId) {
          const { data: updData } = await supabase
            .from('pacientes')
            .update(datosLimpios as any)
            .eq('id', existingId)
            .select()
          pacienteGuardado = (updData && updData[0]) ? updData[0] : { id: existingId, ...datosLimpios }
        } else {
          const { data: insData, error: insErr } = await supabase
            .from('pacientes')
            .insert({ ...datosLimpios, historial_notas: '' } as any)
            .select()
          if (insErr) throw insErr
          pacienteGuardado = insData && insData[0] ? insData[0] : null
          if (pacienteGuardado?.id) {
            await supabase.from('conversaciones').insert({ paciente_id: pacienteGuardado.id, bot_disabled: false })
          }
        }
      }

      if (!pacienteGuardado) {
        throw new Error('No se pudo completar la importación de la ficha.')
      }

      const crmItem: PacienteItem = {
        ...pacienteGuardado,
        origen: 'crm'
      }

      // Actualizar tarjeta en resultados para reflejar que ya está en CRM
      setSearchResults((prev) =>
        prev.map((it) => (it.geclisa_ficha_id === fichaId || (it.dni && it.dni === crmItem.dni) ? crmItem : it))
      )

      handleOpenHC(crmItem)
    } catch (err: any) {
      console.error('Error importando paciente de Geclisa:', err)
      setErrorBusqueda(err.message || 'Error al importar ficha de Geclisa.')
    } finally {
      setImportingFichaId(null)
    }
  }, [handleOpenHC])

  // 6. Función Principal de Búsqueda (CRM + Geclisa)
  const ejecutarBusqueda = useCallback(async (terminoParam?: string) => {
    const rawTerm = (terminoParam !== undefined ? terminoParam : searchTerm).trim()
    if (!rawTerm) return

    setIsSearching(true)
    setErrorBusqueda(null)
    setHasSearched(true)

    try {
      // 1. Intentar primero con el endpoint clínico unificado del backend
      try {
        const resClinico = await apiFetch(`/api/pacientes/buscar-clinico?q=${encodeURIComponent(rawTerm)}`, {
          headers: { Accept: 'application/json' }
        })
        if (resClinico.ok) {
          const dataClinico = await resClinico.json()
          if (dataClinico && Array.isArray(dataClinico.resultados) && dataClinico.resultados.length > 0) {
            const mapped: PacienteItem[] = dataClinico.resultados.map((r: any) => ({
              id: r.id || (r.geclisa_ficha_id ? `geclisa_${r.geclisa_ficha_id}` : `temp_${Date.now()}`),
              nombre: r.nombre || 'Paciente',
              dni: r.dni || null,
              geclisa_ficha_id: r.geclisa_ficha_id || null,
              nro_hc: r.nro_hc || null,
              telefono: r.telefono || r.celular || '',
              email: r.email || null,
              obra_social: r.obra_social || null,
              plan_cobertura: r.plan_cobertura || null,
              nro_afiliado: r.nro_afiliado || null,
              fecha_nacimiento: r.fecha_nacimiento || null,
              sexo: r.sexo || null,
              direccion: r.direccion || null,
              origen: r.origen === 'geclisa' ? 'geclisa' : 'crm',
              raw_geclisa: r.datos_geclisa || null
            }))
            setSearchResults(mapped)
            return mapped
          }
        }
      } catch (endpointErr) {
        console.warn('Endpoint /api/pacientes/buscar-clinico no disponible, usando fallback:', endpointErr)
      }

      // 2. Fallback: Búsqueda directa con Supabase y Geclisa client
      const isDigitsOnly = /^\d+$/.test(rawTerm)
      const cleanDigits = rawTerm.replace(/\D/g, '')
      const crmEncontrados: PacienteItem[] = []

      // A) Búsqueda en CRM Local (Supabase)
      if (isDigitsOnly) {
        const numVal = parseInt(cleanDigits, 10)
        const dniSinCero = cleanDigits.replace(/^0+/, '')

        const { data: pData, error: pErr } = await supabase
          .from('pacientes')
          .select('id, nombre, dni, geclisa_ficha_id, nro_hc, telefono, email, obra_social, plan_cobertura, nro_afiliado, fecha_nacimiento, sexo, direccion')
          .or(`dni.eq.${cleanDigits},dni.eq.${dniSinCero},geclisa_ficha_id.eq.${numVal},telefono.ilike.%${cleanDigits}%`)
          .limit(10)

        if (!pErr && pData) {
          pData.forEach((p: any) => {
            crmEncontrados.push({ ...p, origen: 'crm' })
          })
        }
      } else {
        const { data: pData, error: pErr } = await supabase
          .from('pacientes')
          .select('id, nombre, dni, geclisa_ficha_id, nro_hc, telefono, email, obra_social, plan_cobertura, nro_afiliado, fecha_nacimiento, sexo, direccion')
          .ilike('nombre', `%${rawTerm}%`)
          .limit(15)

        if (!pErr && pData) {
          pData.forEach((p: any) => {
            crmEncontrados.push({ ...p, origen: 'crm' })
          })
        }
      }

      // B) Búsqueda en Geclisa (si tiene dígitos potenciales de DNI o Ficha)
      const geclisaEncontrados: PacienteItem[] = []

      if (cleanDigits.length >= 1) {
        // 1. Intentar por DNI en Geclisa si tiene longitud típica de DNI (6-9 dígitos)
        if (cleanDigits.length >= 6 && cleanDigits.length <= 9) {
          try {
            const resDni = await apiFetch(`/api/geclisa/pacientes/buscar-por-dni?dni=${encodeURIComponent(cleanDigits)}`, {
              headers: { Accept: 'application/json' }
            })
            if (resDni.ok) {
              const dataDni = await resDni.json()
              if (dataDni && dataDni.encontrado) {
                // Verificar si ya está en crmEncontrados
                const yaEstaEnCrm = crmEncontrados.some(
                  (c) => (dataDni.ficha_id && c.geclisa_ficha_id === dataDni.ficha_id) || (dataDni.dni && c.dni === dataDni.dni)
                )

                if (!yaEstaEnCrm) {
                  geclisaEncontrados.push({
                    id: dataDni.crm_paciente_id || `geclisa_${dataDni.ficha_id || cleanDigits}`,
                    nombre: dataDni.nombre_completo || `${dataDni.apellido || ''} ${dataDni.nombre || ''}`.trim() || 'Paciente Geclisa',
                    dni: dataDni.dni || cleanDigits,
                    geclisa_ficha_id: dataDni.ficha_id,
                    nro_hc: dataDni.nro_hc || null,
                    telefono: dataDni.telefono || dataDni.celular || '',
                    obra_social: dataDni.obra_social || null,
                    plan_cobertura: dataDni.plan_cobertura || null,
                    fecha_nacimiento: dataDni.fecha_nacimiento || null,
                    sexo: dataDni.sexo || null,
                    direccion: dataDni.direccion || null,
                    email: dataDni.email || null,
                    origen: dataDni.ya_en_crm && dataDni.crm_paciente_id ? 'crm' : 'geclisa',
                    raw_geclisa: dataDni
                  })
                }
              }
            }
          } catch (e) {
            console.warn('Geclisa search by DNI error:', e)
          }
        }

        // 2. Intentar por Ficha en Geclisa si tiene entre 1 y 7 dígitos y no se halló por DNI
        if (geclisaEncontrados.length === 0 && cleanDigits.length <= 8) {
          try {
            const resFicha = await apiFetch(`/api/geclisa/pacientes/buscar-por-ficha?ficha_id=${encodeURIComponent(cleanDigits)}`, {
              headers: { Accept: 'application/json' }
            })
            if (resFicha.ok) {
              const dataFicha = await resFicha.json()
              if (dataFicha && dataFicha.encontrado) {
                const yaEstaEnCrm = crmEncontrados.some(
                  (c) => (dataFicha.ficha_id && c.geclisa_ficha_id === dataFicha.ficha_id) || (dataFicha.dni && c.dni === dataFicha.dni)
                )

                if (!yaEstaEnCrm) {
                  geclisaEncontrados.push({
                    id: dataFicha.crm_paciente_id || `geclisa_${dataFicha.ficha_id || cleanDigits}`,
                    nombre: dataFicha.nombre_completo || `${dataFicha.apellido || ''} ${dataFicha.nombre || ''}`.trim() || 'Paciente Geclisa',
                    dni: dataFicha.dni || null,
                    geclisa_ficha_id: dataFicha.ficha_id,
                    nro_hc: dataFicha.nro_hc || null,
                    telefono: dataFicha.telefono || dataFicha.celular || '',
                    obra_social: dataFicha.obra_social || null,
                    plan_cobertura: dataFicha.plan_cobertura || null,
                    fecha_nacimiento: dataFicha.fecha_nacimiento || null,
                    sexo: dataFicha.sexo || null,
                    direccion: dataFicha.direccion || null,
                    email: dataFicha.email || null,
                    origen: dataFicha.ya_en_crm && dataFicha.crm_paciente_id ? 'crm' : 'geclisa',
                    raw_geclisa: dataFicha
                  })
                }
              }
            }
          } catch (e) {
            console.warn('Geclisa search by Ficha error:', e)
          }
        }
      }

      // Combinar resultados (primero CRM, luego Geclisa)
      const unificados = [...crmEncontrados, ...geclisaEncontrados]
      setSearchResults(unificados)

      return unificados
    } catch (err: any) {
      console.error('Error ejecutando búsqueda:', err)
      setErrorBusqueda('Ocurrió un error al buscar pacientes. Por favor intente nuevamente.')
      return []
    } finally {
      setIsSearching(false)
    }
  }, [searchTerm])

  // 7. Carga inicial y soporte de Parámetros URL (?dni=... y ?id=...)
  useEffect(() => {
    const hasRecent = loadRecentFromStorage()
    if (!hasRecent) {
      fetchFallbackPatients()
    }

    if (autoSearchExecuted.current) return

    // Caso A: Parámetro ?id=UUID
    if (paramId) {
      autoSearchExecuted.current = true
      supabase
        .from('pacientes')
        .select('*')
        .eq('id', paramId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            const pItem: PacienteItem = { ...data, origen: 'crm' }
            setSearchResults([pItem])
            setHasSearched(true)
            handleOpenHC(pItem)
          }
        })
      return
    }

    // Caso B: Parámetro ?dni=033516799 o 3316799
    if (paramDni) {
      autoSearchExecuted.current = true
      setSearchTerm(paramDni)
      ejecutarBusqueda(paramDni).then((results) => {
        if (results && results.length > 0) {
          const cleanDni = paramDni.replace(/\D/g, '')
          const exactMatch = results.find(
            (r) => r.dni && (r.dni.replace(/\D/g, '') === cleanDni || r.dni.replace(/^0+/, '') === cleanDni.replace(/^0+/, ''))
          )

          if (exactMatch) {
            if (exactMatch.origen === 'crm') {
              handleOpenHC(exactMatch)
            } else {
              // Si es de Geclisa con coincidencia exacta de DNI, auto-importar y abrir
              handleImportarAndOpen(exactMatch)
            }
          }
        }
      })
    }
  }, [paramDni, paramId, loadRecentFromStorage, fetchFallbackPatients, handleOpenHC, ejecutarBusqueda])

  // Manejador tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ejecutarBusqueda()
    }
  }

  // Filtrado de resultados según chip activo
  const resultadosFiltrados = useMemo(() => {
    if (searchFilter === 'todos') return searchResults
    return searchResults.filter((r) => r.origen === searchFilter)
  }, [searchResults, searchFilter])

  // Lista de pacientes a mostrar en la sección Recientes (locales o fallback de CRM)
  const listaRecientesFinal = recentPatients.length > 0 ? recentPatients : fallbackRecent

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ==================================================================== */}
      {/* 1. HEADER MODERNO */}
      {/* ==================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-500/20 to-blue-600/20 text-blue-600 border border-blue-500/30 flex items-center justify-center shrink-0">
            <ClipboardPlus size={28} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-extrabold text-xl sm:text-2xl text-[var(--foreground)] tracking-tight">
                Historias Clínicas Oftalmológicas
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Geclisa En Línea
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--secondary)] mt-0.5">
              Búsqueda unificada por DNI, N° de Ficha Geclisa o Apellido. Consulta de antecedentes, evoluciones y prescripción.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              loadRecentFromStorage()
              fetchFallbackPatients()
            }}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--foreground)] transition-all flex items-center gap-1.5"
            title="Refrescar datos recientes"
          >
            <RefreshCw size={14} className={loadingFallback ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. BUSCADOR HERO CENTRAL */}
      {/* ==================================================================== */}
      <div className="bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-slate-900/5 p-6 sm:p-8 rounded-3xl border border-blue-500/20 shadow-lg space-y-4">
        <div className="max-w-3xl mx-auto space-y-3">
          <label className="block text-xs sm:text-sm font-bold text-[var(--foreground)] text-center sm:text-left">
            Localizar Paciente en el Consultorio
          </label>

          <div className="relative flex items-center">
            <div className="absolute left-4 text-slate-400 pointer-events-none">
              <Search size={22} />
            </div>

            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar paciente por DNI (ej: 3316799), N° de Ficha Geclisa o Apellido..."
              autoFocus
              className="w-full pl-12 pr-28 py-3.5 sm:py-4 text-sm sm:text-base bg-[var(--card)] border-2 border-blue-500/30 focus:border-blue-500 rounded-2xl text-[var(--foreground)] placeholder-slate-400 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  searchInputRef.current?.focus()
                }}
                className="absolute right-24 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                title="Limpiar búsqueda"
              >
                <X size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={() => ejecutarBusqueda()}
              disabled={isSearching || !searchTerm.trim()}
              className="absolute right-2 sm:right-2.5 px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="hidden sm:inline">Buscando...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Buscar</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-[11px] text-[var(--secondary)]">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-blue-600 dark:text-blue-400">Atajo rápido:</span>
              <span>Presione <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px] font-bold">Enter</kbd> para buscar</span>
            </div>

            {hasSearched && searchResults.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setSearchFilter('todos')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    searchFilter === 'todos' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-[var(--foreground)]'
                  }`}
                >
                  Todos ({searchResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSearchFilter('crm')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    searchFilter === 'crm' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-[var(--foreground)]'
                  }`}
                >
                  CRM ({searchResults.filter((r) => r.origen === 'crm').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSearchFilter('geclisa')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    searchFilter === 'geclisa' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-[var(--foreground)]'
                  }`}
                >
                  Geclisa ({searchResults.filter((r) => r.origen === 'geclisa').length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de Error en Búsqueda */}
      {errorBusqueda && (
        <div className="p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorBusqueda}</span>
          </div>
          <button onClick={() => setErrorBusqueda(null)} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. RESULTADOS DE BÚSQUEDA */}
      {/* ==================================================================== */}
      {hasSearched && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen size={18} className="text-blue-600" />
              <h2 className="text-sm sm:text-base font-bold text-[var(--foreground)]">
                Resultados de Búsqueda
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-[var(--secondary)]">
                {resultadosFiltrados.length} coincidencia(s)
              </span>
            </div>
          </div>

          {resultadosFiltrados.length === 0 ? (
            <div className="p-10 rounded-3xl border border-[var(--border)] bg-[var(--card)] text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Search size={24} />
              </div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">
                No se encontraron pacientes para &quot;{searchTerm}&quot;
              </h3>
              <p className="text-xs text-[var(--secondary)] max-w-md mx-auto">
                Verifique que el número de DNI o Ficha sea correcto, o intente buscar ingresando únicamente el apellido del paciente.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setHasSearched(false)
                  searchInputRef.current?.focus()
                }}
                className="mt-2 px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
              >
                Limpiar búsqueda y volver a recientes
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resultadosFiltrados.map((paciente) => {
                const isGeclisa = paciente.origen === 'geclisa'
                const isImporting = importingFichaId === paciente.geclisa_ficha_id

                return (
                  <div
                    key={paciente.id}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 bg-[var(--card)] shadow-sm hover:shadow-md ${
                      isGeclisa
                        ? 'border-purple-500/40 hover:border-purple-500 bg-purple-500/[0.02]'
                        : 'border-blue-500/40 hover:border-blue-500 bg-blue-500/[0.02]'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Cabecera Tarjeta: Origen y Ficha */}
                      <div className="flex items-center justify-between gap-2">
                        {isGeclisa ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase tracking-wide">
                            <Database size={11} />
                            Ficha Geclisa Detectada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase tracking-wide">
                            <CheckCircle2 size={11} />
                            Expediente CRM
                          </span>
                        )}

                        {paciente.geclisa_ficha_id && (
                          <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-[var(--border)]">
                            Ficha #{paciente.geclisa_ficha_id}
                          </span>
                        )}
                      </div>

                      {/* Nombre y DNI */}
                      <div>
                        <h3 className="font-bold text-base text-[var(--foreground)] line-clamp-1">
                          {paciente.nombre}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {paciente.dni ? (
                            <span className="text-xs font-semibold text-[var(--secondary)] font-mono">
                              DNI: <strong className="text-[var(--foreground)]">{paciente.dni}</strong>
                            </span>
                          ) : (
                            <span className="text-[11px] italic text-slate-400">Sin DNI registrado</span>
                          )}

                          {paciente.nro_hc && (
                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                              HC: {paciente.nro_hc}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Obra Social y Teléfono */}
                      <div className="space-y-1.5 text-xs text-[var(--secondary)] pt-1 border-t border-[var(--border)]">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                          <span className="truncate">
                            {paciente.obra_social || 'Particular / Sin Cobertura'}
                            {paciente.plan_cobertura ? ` (${paciente.plan_cobertura})` : ''}
                          </span>
                        </div>

                        {paciente.telefono && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={14} className="text-blue-500 shrink-0" />
                            <span className="truncate font-mono">{paciente.telefono}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botonera de Acción */}
                    <div className="pt-2">
                      {isGeclisa ? (
                        <button
                          type="button"
                          onClick={() => handleImportarAndOpen(paciente)}
                          disabled={isImporting}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-60 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          {isImporting ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              <span>Importando Ficha...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={15} />
                              <span>Importar y Abrir Historia Clínica</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenHC(paciente)}
                          className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Stethoscope size={15} />
                          <span>Abrir Historia Clínica</span>
                          <ArrowRight size={13} className="opacity-75" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. SECCIÓN PACIENTES RECIENTES DEL CONSULTORIO */}
      {/* ==================================================================== */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-blue-600" />
            <h2 className="text-sm sm:text-base font-bold text-[var(--foreground)]">
              {recentPatients.length > 0
                ? 'Pacientes Recientes del Consultorio'
                : 'Últimos Pacientes Registrados en el CRM'}
            </h2>
          </div>

          {recentPatients.length > 0 && (
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY_RECENT)
                setRecentPatients([])
                fetchFallbackPatients()
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors"
            >
              Limpiar recientes
            </button>
          )}
        </div>

        {listaRecientesFinal.length === 0 ? (
          <div className="p-8 rounded-3xl border border-dashed border-[var(--border)] text-center text-xs text-[var(--secondary)]">
            No hay pacientes recientes. Busque un paciente arriba para comenzar a evolucionar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {listaRecientesFinal.map((paciente) => {
              const initials = paciente.nombre
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')
                .toUpperCase() || 'P'

              return (
                <button
                  key={paciente.id}
                  type="button"
                  onClick={() => handleOpenHC(paciente)}
                  className="p-4 rounded-2xl border border-[var(--border)] hover:border-blue-500 bg-[var(--card)] hover:bg-blue-500/[0.03] transition-all text-left flex items-center justify-between gap-3 group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 font-extrabold text-xs flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:scale-105 transition-transform">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-[var(--foreground)] truncate group-hover:text-blue-600 transition-colors">
                        {paciente.nombre}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--secondary)] mt-0.5 truncate font-mono">
                        {paciente.dni && <span>DNI: {paciente.dni}</span>}
                        {paciente.geclisa_ficha_id && <span>• Ficha #{paciente.geclisa_ficha_id}</span>}
                      </div>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                        {paciente.obra_social || 'Particular'}
                      </p>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-600/10 transition-colors shrink-0">
                    <Stethoscope size={16} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 5. MODAL DE HISTORIA CLÍNICA OFTALMOLÓGICA */}
      {/* ==================================================================== */}
      {mostrarModalHC && selectedPaciente && (
        <ModalHistoriaClinica
          isOpen={mostrarModalHC}
          onClose={() => setMostrarModalHC(false)}
          paciente={selectedPaciente}
        />
      )}
    </div>
  )
}

export default function HistoriasClinicasPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400">
          <Loader2 className="animate-spin text-blue-600" size={36} />
          <p className="text-xs font-semibold">Cargando Historias Clínicas...</p>
        </div>
      }
    >
      <HistoriasClinicasContent />
    </Suspense>
  )
}
