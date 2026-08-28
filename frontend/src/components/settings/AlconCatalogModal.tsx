'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  X,
  QrCode,
  Printer,
  Download,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Barcode,
  Layers,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  Boxes,
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Zap,
  Tag,
  Building2,
  PackageCheck,
  Package,
  AlertCircle
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

export interface ItemCatalogoMaestro {
  id?: string
  gtin_14: string
  gtin_12?: string | null
  marca: string
  nombre_producto: string
  internacional?: string | null
  categoria: string // 'LIO' | 'INSUMO' | 'ANILLO' | 'VISCOELASTICO' | 'GAS' | 'OTRO'
  familia_nombre?: string | null
  modelo_lio_id?: string | null
  tipo_optica?: string | null
  dioptria?: number | null
  es_torico: boolean
  torico_valor?: string | null
  constante_a?: number | null
  acd_estimado?: number | null
  geclisa_ele_id?: number | null
  geclisa_ele_cod?: string | null
  activo: boolean
  origen?: string
  observaciones?: string | null
  modelos_lio?: any
}

interface AlconCatalogModalProps {
  abierto: boolean
  onCerrar: () => void
}

const MARCAS_DISPONIBLES = [
  'Alcon',
  'Johnson & Johnson',
  'Zeiss',
  'Rayner',
  'Bausch & Lomb',
  'Hoya',
  'BVI / PhysIOL',
  'Medicontur',
  'Ophtec',
  'Otro Fabricante'
]

const CATEGORIAS_DISPONIBLES = [
  { valor: 'LIO', label: 'Lente Intraocular (LIO)' },
  { valor: 'INSUMO', label: 'Insumo Quirúrgico General' },
  { valor: 'ANILLO', label: 'Anillo de Tensión Capsular' },
  { valor: 'VISCOELASTICO', label: 'Viscoelástico / OVD' },
  { valor: 'GAS', label: 'Gas Intraocular (C3F8 / SF6)' },
  { valor: 'CUCHILLETE', label: 'Cuchillete / Bisturí Descartable' }
]

const TORICOS_OPCIONES = [
  { valor: 'T2', label: 'T2 (Cil 1.00 D)' },
  { valor: 'T3', label: 'T3 (Cil 1.50 D)' },
  { valor: 'T4', label: 'T4 (Cil 2.25 D)' },
  { valor: 'T5', label: 'T5 (Cil 3.00 D)' },
  { valor: 'T6', label: 'T6 (Cil 3.75 D)' },
  { valor: 'T7', label: 'T7 (Cil 4.50 D)' },
  { valor: 'T8', label: 'T8 (Cil 5.25 D)' },
  { valor: 'T9', label: 'T9 (Cil 6.00 D)' }
]

export default function AlconCatalogModal({ abierto, onCerrar }: AlconCatalogModalProps) {
  const [catalogo, setCatalogo] = useState<ItemCatalogoMaestro[]>([])
  const [totalRegistros, setTotalRegistros] = useState<number>(0)
  const [cargando, setCargando] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState<string>('')
  const [filtroMarca, setFiltroMarca] = useState<string>('ALL')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('ALL')
  const [filtroTorico, setFiltroTorico] = useState<string>('ALL')
  const [paginaActual, setPaginaActual] = useState<number>(1)
  const itemsPorPagina = 25

  // Familias clínicas registradas en CRM para vincular
  const [familiasCrm, setFamiliasCrm] = useState<any[]>([])

  // Modal ABM: Alta / Edición de Ítem
  const [modalFormAbierto, setModalFormAbierto] = useState<boolean>(false)
  const [itemEnEdicion, setItemEnEdicion] = useState<ItemCatalogoMaestro | null>(null)
  const [guardandoItem, setGuardandoItem] = useState<boolean>(false)

  // Asistente Geclisa para autocompletar en Alta/Edición
  const [buscandoGeclisa, setBuscandoGeclisa] = useState<boolean>(false)
  const [geclisaResultados, setGeclisaResultados] = useState<any[]>([])

  // Sincronización Masiva con Geclisa
  const [sincronizandoGeclisa, setSincronizandoGeclisa] = useState<boolean>(false)

  // Ítem seleccionado para ver QR & Generar Stickers PDF
  const [itemSeleccionado, setItemSeleccionado] = useState<ItemCatalogoMaestro | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copiado, setCopiado] = useState<boolean>(false)

  // Configuración de Impresión de Stickers A4 (4x4 cm - 35 por hoja con 0.5 cm margen)
  const [cantidadStickers, setCantidadStickers] = useState<number>(35)
  const [incluirGuiasCorte, setIncluirGuiasCorte] = useState<boolean>(true)
  const [generandoPdf, setGenerandoPdf] = useState<boolean>(false)

  // Cargar catálogo desde la base de datos Supabase
  const fetchCatalogo = async () => {
    try {
      setCargando(true)
      setError(null)
      const offset = (paginaActual - 1) * itemsPorPagina
      let url = `${BACKEND_URL}/api/catalogo-maestro?limit=${itemsPorPagina}&offset=${offset}&marca=${encodeURIComponent(
        filtroMarca
      )}&categoria=${encodeURIComponent(filtroCategoria)}`

      if (busqueda.trim()) {
        url += `&busqueda=${encodeURIComponent(busqueda.trim())}`
      }

      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.success) {
        setCatalogo(data.items || [])
        setTotalRegistros(data.total || 0)
      } else {
        throw new Error(data.detail || 'Error al cargar catálogo maestro.')
      }
    } catch (e: any) {
      console.error('Error cargando catálogo maestro:', e)
      setError(e.message || 'Error de conexión.')
    } finally {
      setCargando(false)
    }
  }

  // Cargar familias de LIO existentes
  useEffect(() => {
    const fetchFamilias = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/modelos-lio`)
        const data = await res.json()
        if (res.ok && data.success && data.modelos) {
          setFamiliasCrm(data.modelos)
        }
      } catch (e) {
        console.error('Error cargando familias CRM:', e)
      }
    }
    if (abierto) {
      fetchFamilias()
    }
  }, [abierto])

  // Cargar catálogo al abrir modal o cambiar filtros/páginas
  useEffect(() => {
    if (abierto) {
      fetchCatalogo()
    }
  }, [abierto, paginaActual, filtroMarca, filtroCategoria, busqueda])

  // Resetear a página 1 al cambiar filtros de búsqueda
  useEffect(() => {
    setPaginaActual(1)
  }, [busqueda, filtroMarca, filtroCategoria])

  // Generar Código QR cuando se selecciona un ítem
  useEffect(() => {
    if (!itemSeleccionado) {
      setQrDataUrl('')
      return
    }

    const gtin = itemSeleccionado.gtin_14
    QRCode.toDataURL(gtin, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generando QR:', err))
  }, [itemSeleccionado])

  // Copiar GTIN al portapapeles
  const handleCopiarGtin = () => {
    if (!itemSeleccionado) return
    navigator.clipboard.writeText(itemSeleccionado.gtin_14)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // ====================================================================
  // ABM: ABRIR FORMULARIO DE ALTA O EDICIÓN
  // ====================================================================
  const handleAbrirAlta = () => {
    setItemEnEdicion({
      gtin_14: '',
      gtin_12: '',
      marca: 'Alcon',
      nombre_producto: '',
      internacional: '',
      categoria: 'LIO',
      familia_nombre: '',
      modelo_lio_id: null,
      tipo_optica: 'Monofocal Asférico',
      dioptria: 20.0,
      es_torico: false,
      torico_valor: null,
      constante_a: 118.9,
      acd_estimado: 5.0,
      geclisa_ele_id: null,
      geclisa_ele_cod: '',
      activo: true,
      origen: 'MANUAL',
      observaciones: ''
    })
    setGeclisaResultados([])
    setModalFormAbierto(true)
  }

  const handleAbrirEdicion = (item: ItemCatalogoMaestro) => {
    setItemEnEdicion({ ...item })
    setGeclisaResultados([])
    setModalFormAbierto(true)
  }

  // Asistente de búsqueda en Geclisa
  const handleBuscarEnGeclisa = async (query: string) => {
    if (!query || query.trim().length < 2) return
    try {
      setBuscandoGeclisa(true)
      const res = await fetch(`${BACKEND_URL}/api/geclisa/elementos/buscar?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (res.ok && data.success && data.elementos) {
        setGeclisaResultados(data.elementos)
      } else {
        setGeclisaResultados([])
      }
    } catch (e) {
      console.error('Error buscando en Geclisa:', e)
      setGeclisaResultados([])
    } finally {
      setBuscandoGeclisa(false)
    }
  }

  // Seleccionar elemento de Geclisa para autocompletar
  const handleSeleccionarElementoGeclisa = (el: any) => {
    if (!itemEnEdicion) return
    const rawCod = String(el.eleCod || '').trim()
    const clean14 = rawCod ? rawCod.padStart(14, '0') : itemEnEdicion.gtin_14
    setItemEnEdicion({
      ...itemEnEdicion,
      gtin_14: clean14,
      gtin_12: rawCod ? rawCod.replace(/^0+/, '') : itemEnEdicion.gtin_12,
      nombre_producto: itemEnEdicion.nombre_producto || el.eleNombre || '',
      geclisa_ele_id: el.eleId,
      geclisa_ele_cod: el.eleCod
    })
    setGeclisaResultados([])
  }

  // Guardar Ítem (Alta o Modificación)
  const handleGuardarItem = async () => {
    if (!itemEnEdicion) return

    const g14 = itemEnEdicion.gtin_14.trim()
    if (!g14 || g14.length < 8) {
      alert('Debe ingresar un código GTIN válido (hasta 14 dígitos numéricos).')
      return
    }

    if (!itemEnEdicion.nombre_producto.trim()) {
      alert('Debe ingresar el Nombre del Producto.')
      return
    }

    try {
      setGuardandoItem(true)
      const gtin14Formateado = g14.padStart(14, '0')
      const payload = {
        ...itemEnEdicion,
        gtin_14: gtin14Formateado,
        gtin_12: itemEnEdicion.gtin_12?.trim() || gtin14Formateado.replace(/^0+/, ''),
        dioptria: itemEnEdicion.categoria === 'LIO' && itemEnEdicion.dioptria !== null ? parseFloat(String(itemEnEdicion.dioptria)) : null,
        constante_a: parseFloat(String(itemEnEdicion.constante_a || 118.9)),
        acd_estimado: parseFloat(String(itemEnEdicion.acd_estimado || 5.0))
      }

      let res: Response
      if (itemEnEdicion.id) {
        // Modificación PUT
        res = await fetch(`${BACKEND_URL}/api/catalogo-maestro/${itemEnEdicion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        // Alta POST
        res = await fetch(`${BACKEND_URL}/api/catalogo-maestro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(`✔ ${itemEnEdicion.id ? 'Elemento actualizado' : 'Nuevo elemento registrado con éxito en el Catálogo Maestro'}.`)
        setTimeout(() => setMensajeExito(null), 4000)
        setModalFormAbierto(false)
        setItemEnEdicion(null)
        fetchCatalogo()
      } else {
        alert(data.detail || data.error || 'Error al guardar elemento.')
      }
    } catch (e: any) {
      console.error('Error guardando elemento:', e)
      alert(e.message || 'Error de conexión.')
    } finally {
      setGuardandoItem(false)
    }
  }

  // Eliminar / Desactivar Ítem (Baja)
  const handleEliminarItem = async (item: ItemCatalogoMaestro) => {
    if (!confirm(`¿Estás seguro de eliminar "${item.nombre_producto}" (GTIN: ${item.gtin_14}) del Catálogo Maestro?`)) {
      return
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/catalogo-maestro/${item.id}?fisico=true`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMensajeExito(`✔ Elemento eliminado del Catálogo Maestro.`)
        setTimeout(() => setMensajeExito(null), 3000)
        fetchCatalogo()
      } else {
        alert(data.detail || 'Error al eliminar elemento.')
      }
    } catch (e) {
      console.error('Error eliminando elemento:', e)
      alert('Error de conexión al eliminar.')
    }
  }

  // Sincronizar Catálogo Maestro con Geclisa API
  const handleSincronizarGeclisa = async () => {
    try {
      setSincronizandoGeclisa(true)
      const res = await fetch(`${BACKEND_URL}/api/catalogo-maestro/sincronizar-geclisa`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert(`⚡ Sincronización con Geclisa completada exitosamente:\n- ${data.total_sincronizados} productos vinculados con stock y eleId de Geclisa.`)
        fetchCatalogo()
      } else {
        alert(data.detail || 'Error al sincronizar con Geclisa.')
      }
    } catch (e) {
      console.error('Error en sincronización Geclisa:', e)
      alert('Error al conectar con el servicio de Geclisa.')
    } finally {
      setSincronizandoGeclisa(false)
    }
  }

  // ====================================================================
  // GENERADOR DE PDF: STICKERS 4 cm x 4 cm EN HOJA A4 (35 POR PÁGINA)
  // ====================================================================
  const handleGenerarPdfStickers = async () => {
    if (!itemSeleccionado || !qrDataUrl) return

    try {
      setGenerandoPdf(true)

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const stickerSize = 40 // 40 mm x 40 mm (4.0 cm x 4.0 cm)
      const cols = 5 // 5 columnas = 200 mm
      const rows = 7 // 7 filas = 280 mm
      const stickersPorPagina = cols * rows // 35 stickers por página A4 (5x7)

      // Margen de 0.5 cm (5 mm) exactos para aprovechar al máximo la hoja A4 (210 x 297 mm)
      const marginLeft = 5 // 5 mm = 0.5 cm
      const marginTop = 5 // 5 mm = 0.5 cm

      const totalStickers = cantidadStickers || 1
      let stickersColocados = 0

      while (stickersColocados < totalStickers) {
        if (stickersColocados > 0 && stickersColocados % stickersPorPagina === 0) {
          doc.addPage('a4', 'portrait')
        }

        const indexEnPagina = stickersColocados % stickersPorPagina
        const col = indexEnPagina % cols
        const row = Math.floor(indexEnPagina / cols)

        const x = marginLeft + col * stickerSize
        const y = marginTop + row * stickerSize

        // 1. Líneas de corte punteadas
        if (incluirGuiasCorte) {
          doc.setDrawColor(180, 180, 180)
          doc.setLineDashPattern([1, 1], 0)
          doc.rect(x, y, stickerSize, stickerSize)
        }

        // 2. Encabezado del Sticker: Nombre del Producto
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(0, 0, 0)
        const nombreCorto = itemSeleccionado.nombre_producto.length > 24
          ? itemSeleccionado.nombre_producto.slice(0, 24) + '...'
          : itemSeleccionado.nombre_producto
        doc.text(nombreCorto, x + stickerSize / 2, y + 4, { align: 'center', maxWidth: 38 })

        // 3. Dioptría o Categoría
        doc.setFontSize(8.5)
        if (itemSeleccionado.categoria === 'LIO' && itemSeleccionado.dioptria !== null) {
          const diopTxt = `+${Number(itemSeleccionado.dioptria).toFixed(2)} D ${
            itemSeleccionado.es_torico ? `(T${itemSeleccionado.torico_valor || 'T'})` : ''
          }`
          doc.text(diopTxt, x + stickerSize / 2, y + 8, { align: 'center' })
        } else {
          doc.text(itemSeleccionado.categoria || 'INSUMO', x + stickerSize / 2, y + 8, { align: 'center' })
        }

        // 4. Código QR de alta resolución (18 mm x 18 mm)
        const qrSize = 18.5
        const qrX = x + (stickerSize - qrSize) / 2
        const qrY = y + 9.5
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

        // 5. Nombre Internacional / Marca
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(50, 50, 50)
        doc.text(
          itemSeleccionado.internacional ? `Ref: ${itemSeleccionado.internacional}` : itemSeleccionado.marca,
          x + stickerSize / 2,
          y + 31,
          { align: 'center' }
        )

        // 6. Código GTIN Numérico (Legible)
        doc.setFont('courier', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(0, 0, 0)
        doc.text(itemSeleccionado.gtin_14, x + stickerSize / 2, y + 35.5, { align: 'center' })

        // 7. Marca / Pie
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.5)
        doc.setTextColor(100, 100, 100)
        doc.text(`${itemSeleccionado.marca.toUpperCase()} • GS1 GTIN`, x + stickerSize / 2, y + 38.5, { align: 'center' })

        stickersColocados++
      }

      const filename = `Stickers_${itemSeleccionado.marca}_${itemSeleccionado.gtin_14}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('Error al generar PDF de stickers:', err)
      alert('Error al generar archivo PDF.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const totalPaginas = Math.ceil(totalRegistros / itemsPorPagina) || 1

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fade-in">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl max-w-6xl w-full h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
        {/* CABECERA DEL MODAL */}
        <div className="p-5 md:p-6 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-[var(--foreground)] tracking-tight">
                  Catálogo Maestro de LIOs & Insumos Quirúrgicos
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                  {totalRegistros} SKUs Activos
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Alta, baja y modificación de lentes (Alcon, J&J, Zeiss, Rayner) e insumos con códigos GTIN, stickers y sincronización Geclisa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Botón Sincronizar Geclisa */}
            <button
              type="button"
              disabled={sincronizandoGeclisa}
              onClick={handleSincronizarGeclisa}
              className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[var(--foreground)] text-xs font-bold flex items-center gap-1.5 border border-[var(--border)] transition cursor-pointer"
              title="Cruza todos los GTINs contra Geclisa y asocia códigos eleId y stock"
            >
              <Zap size={14} className={sincronizandoGeclisa ? 'animate-spin text-amber-500' : 'text-amber-500'} />
              <span>{sincronizandoGeclisa ? 'Sincronizando...' : 'Sincronizar Geclisa'}</span>
            </button>

            {/* Botón + Nuevo Lente / Insumo */}
            <button
              type="button"
              onClick={handleAbrirAlta}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition transform hover:scale-[1.02]"
            >
              <Plus size={15} />
              <span>+ Nuevo Lente / Insumo</span>
            </button>

            <button
              type="button"
              onClick={onCerrar}
              className="p-2 text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ALERTA DE MENSAJE DE ÉXITO */}
        {mensajeExito && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="p-4 md:px-6 border-b border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--card)]">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por GTIN (ej: 0038065...), Ref Internacional (ej: SY60WF, ICB00) o Nombre..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs md:text-sm font-bold text-[var(--foreground)] outline-none focus:border-amber-500 shadow-xs"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Filtro Marca */}
            <select
              value={filtroMarca}
              onChange={(e) => setFiltroMarca(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Todas las Marcas</option>
              {MARCAS_DISPONIBLES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Filtro Categoría */}
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Todas las Categorías</option>
              {CATEGORIAS_DISPONIBLES.map((c) => (
                <option key={c.valor} value={c.valor}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA PRINCIPAL DEL CATÁLOGO */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/20">
          {cargando ? (
            <div className="py-24 text-center space-y-3">
              <Loader2 size={36} className="animate-spin text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-[var(--foreground)]">Cargando catálogo maestro...</p>
              <p className="text-xs text-[var(--secondary)]">Consultando base de datos y trazabilidad GTIN.</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600 space-y-2">
              <p className="font-bold">{error}</p>
              <button
                type="button"
                onClick={fetchCatalogo}
                className="px-4 py-2 bg-rose-100 dark:bg-rose-950 text-rose-700 rounded-xl text-xs font-bold"
              >
                Reintentar
              </button>
            </div>
          ) : catalogo.length === 0 ? (
            <div className="py-24 text-center border border-dashed border-[var(--border)] rounded-3xl space-y-3">
              <Barcode size={36} className="mx-auto text-slate-400 opacity-50" />
              <p className="font-bold text-sm text-[var(--foreground)]">No se encontraron lentes o insumos en este filtro</p>
              <p className="text-xs text-[var(--secondary)]">Puedes dar de alta un nuevo producto con el botón superior.</p>
              <button
                type="button"
                onClick={handleAbrirAlta}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs mx-auto inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>+ Dar de Alta Nuevo Elemento</span>
              </button>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-3xl overflow-hidden bg-[var(--card)] shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-[var(--secondary)] font-bold text-[10px] uppercase tracking-wider border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur-xs">
                      <th className="p-3.5">Código GTIN (14 Dígitos)</th>
                      <th className="p-3.5">Marca / Fabricante</th>
                      <th className="p-3.5">Nombre del Producto / Ref</th>
                      <th className="p-3.5">Categoría / Familia</th>
                      <th className="p-3.5">Dioptría / Toricidad</th>
                      <th className="p-3.5">Estado Geclisa</th>
                      <th className="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {catalogo.map((item, idx) => (
                      <tr
                        key={item.id || item.gtin_14 || idx}
                        className="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 transition group"
                      >
                        {/* 1. Código GTIN */}
                        <td className="p-3.5">
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5">
                            <Barcode size={14} className="text-slate-400 group-hover:text-amber-500" />
                            <span>{item.gtin_14}</span>
                          </span>
                        </td>

                        {/* 2. Marca */}
                        <td className="p-3.5">
                          <span className="font-bold text-[var(--foreground)] text-xs block">
                            {item.marca}
                          </span>
                          <span className="text-[10px] text-[var(--secondary)]">
                            {item.origen || 'CRM'}
                          </span>
                        </td>

                        {/* 3. Nombre del Producto & Internacional */}
                        <td className="p-3.5">
                          <span className="font-bold text-[var(--foreground)] block text-xs">
                            {item.nombre_producto}
                          </span>
                          {item.internacional && (
                            <span className="font-mono text-[10px] text-[var(--secondary)] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              Ref: {item.internacional}
                            </span>
                          )}
                        </td>

                        {/* 4. Categoría / Familia */}
                        <td className="p-3.5">
                          <span className="font-bold text-slate-700 dark:text-slate-200 block text-[11px]">
                            {item.familia_nombre || item.tipo_optica || item.categoria}
                          </span>
                          <span className="text-[10px] text-[var(--secondary)]">
                            {item.categoria} {item.constante_a ? `• Const A: ${item.constante_a}` : ''}
                          </span>
                        </td>

                        {/* 5. Dioptría */}
                        <td className="p-3.5">
                          {item.categoria === 'LIO' && item.dioptria !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                                +{Number(item.dioptria).toFixed(2)} D
                              </span>
                              {item.es_torico && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px]">
                                  {item.torico_valor || 'Tórico'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[var(--secondary)]">N/A (Insumo)</span>
                          )}
                        </td>

                        {/* 6. Estado Geclisa */}
                        <td className="p-3.5">
                          {item.geclisa_ele_id ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              <span>Geclisa #{item.geclisa_ele_id}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px]">
                              Sin vincular
                            </span>
                          )}
                        </td>

                        {/* 7. Acciones */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver QR & Stickers */}
                            <button
                              type="button"
                              onClick={() => setItemSeleccionado(item)}
                              className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white transition cursor-pointer"
                              title="Ver Código QR y descargar Stickers (4x4 cm)"
                            >
                              <QrCode size={15} />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => handleAbrirEdicion(item)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition cursor-pointer"
                              title="Editar este elemento"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Eliminar / Desactivar */}
                            <button
                              type="button"
                              onClick={() => handleEliminarItem(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                              title="Eliminar del catálogo maestro"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* PIE DE PÁGINA: PAGINACIÓN Y RESUMEN */}
        <div className="p-4 md:px-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--card)]">
          <span className="text-xs text-[var(--secondary)]">
            Mostrando <b>{catalogo.length}</b> de <b>{totalRegistros}</b> elementos en el catálogo maestro.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl border border-[var(--border)] disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold px-3">
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaActual === totalPaginas}
              onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              className="p-2 rounded-xl border border-[var(--border)] disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL DE ALTA Y EDICIÓN DE ELEMENTO (ABM) */}
      {/* ==================================================================== */}
      {modalFormAbierto && itemEnEdicion && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative z-[111] animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Cabecera del Formulario */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white font-black">
                  {itemEnEdicion.id ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">
                    {itemEnEdicion.id ? 'Editar Elemento en Catálogo Maestro' : 'Alta de Nuevo Lente o Insumo'}
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Registra la información del fabricante, GTIN y constantes para trazabilidad quirúrgica.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalFormAbierto(false)
                  setItemEnEdicion(null)
                }}
                className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* CAMPOS DEL FORMULARIO */}
            <div className="space-y-4 text-xs">
              {/* GTIN & Asistente Geclisa */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-900 dark:text-amber-200">
                    Código GTIN (14 Dígitos) *
                  </label>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                    {itemEnEdicion.gtin_14.length}/14 dígitos
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={14}
                    value={itemEnEdicion.gtin_14}
                    onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, gtin_14: e.target.value.replace(/\D/g, '') })}
                    placeholder="Ej: 00380652251488"
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-700 font-mono font-black text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    disabled={buscandoGeclisa || !itemEnEdicion.gtin_14}
                    onClick={() => handleBuscarEnGeclisa(itemEnEdicion.gtin_14)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
                  >
                    {buscandoGeclisa ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    <span>Buscar en Geclisa</span>
                  </button>
                </div>

                {/* Resultados del Asistente Geclisa */}
                {geclisaResultados.length > 0 && (
                  <div className="mt-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 space-y-1">
                    <p className="text-[10px] font-bold text-amber-800">Coincidencias encontradas en Geclisa (clic para autocompletar):</p>
                    {geclisaResultados.map((el) => (
                      <button
                        key={el.eleId}
                        type="button"
                        onClick={() => handleSeleccionarElementoGeclisa(el)}
                        className="w-full text-left p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-slate-800 text-[11px] flex items-center justify-between"
                      >
                        <span className="font-bold">{el.eleNombre}</span>
                        <span className="font-mono text-[10px] text-slate-500">Cod: {el.eleCod} (#{el.eleId})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Categoría y Marca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Categoría del Producto *</label>
                  <select
                    value={itemEnEdicion.categoria}
                    onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, categoria: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] font-bold text-xs outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {CATEGORIAS_DISPONIBLES.map((c) => (
                      <option key={c.valor} value={c.valor}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Marca / Laboratorio Fabricante *</label>
                  <select
                    value={itemEnEdicion.marca}
                    onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, marca: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] font-bold text-xs outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {MARCAS_DISPONIBLES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nombre del Producto y Referencia Internacional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Nombre del Producto / Comercial *</label>
                  <input
                    type="text"
                    value={itemEnEdicion.nombre_producto}
                    onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, nombre_producto: e.target.value })}
                    placeholder="Ej: TECNIS Eyhance ICB00 +21.50 D"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] font-bold text-xs outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--secondary)]">Nombre Internacional / Ref Fábrica</label>
                  <input
                    type="text"
                    value={itemEnEdicion.internacional || ''}
                    onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, internacional: e.target.value })}
                    placeholder="Ej: ICB00.215, SY60WF.200"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-[var(--border)] font-mono text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Parámetros de Lente Intraocular (Si Aplica) */}
              {itemEnEdicion.categoria === 'LIO' && (
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 space-y-3">
                  <span className="font-black text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-600" />
                    <span>Parámetros Ópticos y Biométricos del LIO</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Familia Clínica CRM */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-bold text-blue-800 dark:text-blue-300">Familia Clínica en CRM</label>
                      <select
                        value={itemEnEdicion.modelo_lio_id || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          const fam = familiasCrm.find((f) => f.id === val)
                          setItemEnEdicion({
                            ...itemEnEdicion,
                            modelo_lio_id: val || null,
                            familia_nombre: fam ? fam.modelo : itemEnEdicion.familia_nombre,
                            constante_a: fam?.constante_a || itemEnEdicion.constante_a
                          })
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-blue-300 dark:border-blue-700 text-xs font-bold outline-none"
                      >
                        <option value="">-- Sin vincular a familia clínica --</option>
                        {familiasCrm.map((f) => (
                          <option key={f.id} value={f.id}>{f.marca} — {f.modelo} ({f.tipo_optica})</option>
                        ))}
                      </select>
                    </div>

                    {/* Dioptría */}
                    <div className="space-y-1">
                      <label className="font-bold text-blue-800 dark:text-blue-300">Dioptría Esférica *</label>
                      <input
                        type="number"
                        step="0.5"
                        value={itemEnEdicion.dioptria ?? 20.0}
                        onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, dioptria: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-blue-300 dark:border-blue-700 font-mono font-black text-xs outline-none text-center"
                      />
                    </div>
                  </div>

                  {/* Constante A y Toricidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div className="space-y-1">
                      <label className="font-bold text-blue-800 dark:text-blue-300">Constante A</label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemEnEdicion.constante_a ?? 118.9}
                        onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, constante_a: parseFloat(e.target.value) || 118.9 })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-blue-300 dark:border-blue-700 font-mono font-bold text-xs text-center"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(itemEnEdicion.es_torico)}
                          onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, es_torico: e.target.checked })}
                          className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                        />
                        <span className="font-bold text-indigo-900 dark:text-indigo-200">
                          ¿Es Lente Tórico (Astigmatismo)?
                        </span>
                      </label>

                      {itemEnEdicion.es_torico && (
                        <select
                          value={itemEnEdicion.torico_valor || 'T3'}
                          onChange={(e) => setItemEnEdicion({ ...itemEnEdicion, torico_valor: e.target.value })}
                          className="w-full mt-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-300 font-bold text-xs"
                        >
                          {TORICOS_OPCIONES.map((to) => (
                            <option key={to.valor} value={to.valor}>{to.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BOTONES DE ACCIÓN DEL FORMULARIO */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setModalFormAbierto(false)
                  setItemEnEdicion(null)
                }}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={guardandoItem}
                onClick={handleGuardarItem}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition transform hover:scale-[1.02]"
              >
                {guardandoItem ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                <span>{itemEnEdicion.id ? 'Guardar Cambios' : 'Registrar en Catálogo Maestro'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* POPUP DE DETALLE: CÓDIGO QR & EXPORTADOR DE STICKERS PDF A4 (4x4 CM) */}
      {/* ==================================================================== */}
      {itemSeleccionado && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative z-[101] animate-scale-in">
            {/* Cabecera del Popup QR */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--foreground)]">
                    Código QR & Generador de Stickers (4x4 cm)
                  </h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Escaneable con lector QR para emitir el código GTIN exacto.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemSeleccionado(null)}
                className="p-1.5 text-slate-400 hover:text-[var(--foreground)] rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* PREVISUALIZADOR DEL CÓDIGO QR Y ETIQUETA */}
            <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border-2 border-dashed border-amber-500/40 space-y-3">
              {/* Tarjeta Sticker 4x4 cm a escala */}
              <div className="w-48 h-48 bg-white text-black p-3 rounded-2xl shadow-lg border border-slate-300 flex flex-col items-center justify-between text-center select-none">
                <span className="text-[9px] font-black tracking-tight truncate w-full text-slate-900">
                  {itemSeleccionado.nombre_producto}
                </span>

                {itemSeleccionado.categoria === 'LIO' && itemSeleccionado.dioptria !== null ? (
                  <span className="text-[11px] font-black text-blue-700 font-mono">
                    +{Number(itemSeleccionado.dioptria).toFixed(2)} D {itemSeleccionado.es_torico ? `(${itemSeleccionado.torico_valor})` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-700 uppercase">
                    {itemSeleccionado.categoria}
                  </span>
                )}

                {/* Imagen del QR */}
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR ${itemSeleccionado.gtin_14}`}
                    className="w-24 h-24 object-contain"
                  />
                ) : (
                  <Loader2 size={24} className="animate-spin text-amber-500" />
                )}

                <div className="w-full">
                  <span className="text-[7px] text-slate-600 block truncate">
                    {itemSeleccionado.internacional ? `Ref: ${itemSeleccionado.internacional}` : itemSeleccionado.marca}
                  </span>
                  <span className="text-[9px] font-mono font-black text-slate-950 block tracking-wider">
                    {itemSeleccionado.gtin_14}
                  </span>
                </div>
              </div>

              <span className="text-[10px] text-[var(--secondary)] font-bold">
                Tamaño exacto de impresión física: <b>4.0 cm × 4.0 cm</b> (Margen 0.5 cm)
              </span>
            </div>

            {/* INFORMACIÓN DEL GTIN Y ACCIONES DE COPIADO */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--secondary)] uppercase font-bold block">
                  Código GTIN Numérico
                </span>
                <span className="font-mono font-black text-sm text-[var(--foreground)] tracking-wide">
                  {itemSeleccionado.gtin_14}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopiarGtin}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 border border-[var(--border)] shadow-xs cursor-pointer"
              >
                {copiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copiado ? 'Copiado' : 'Copiar GTIN'}</span>
              </button>
            </div>

            {/* CONFIGURACIÓN DE EXPORTACIÓN PDF A4 */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                  <Printer size={14} className="text-amber-500" />
                  <span>Cantidad de Stickers a Imprimir (Hoja A4)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 5, 15, 35, 70].map((cant) => (
                    <button
                      key={cant}
                      type="button"
                      onClick={() => setCantidadStickers(cant)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        cantidadStickers === cant
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {cant === 35 ? '35 (1 Hoja)' : cant === 70 ? '70 (2 Hojas)' : cant}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incluirGuiasCorte}
                    onChange={(e) => setIncluirGuiasCorte(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-[var(--secondary)] font-bold">
                    Incluir líneas punteadas para guillotina / tijera (Margen 0.5 cm)
                  </span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {Math.ceil(cantidadStickers / 35)} {Math.ceil(cantidadStickers / 35) === 1 ? 'página A4 (5x7)' : 'páginas A4 (5x7)'}
                </span>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setItemSeleccionado(null)}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                disabled={generandoPdf || !qrDataUrl}
                onClick={handleGenerarPdfStickers}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition transform hover:scale-[1.02]"
              >
                {generandoPdf ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                <span>Descargar PDF Stickers A4 ({cantidadStickers} un)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
