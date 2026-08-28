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
  FileSpreadsheet
} from 'lucide-react'
import { BACKEND_URL } from '@/lib/api'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

export interface AlconSku {
  gtin_14: string
  gtin_12: string
  internacional: string
  nombre_producto: string
  marca: string
  familia_nombre: string
  tipo_optica: string
  dioptria: number
  es_torico: boolean
  torico_valor: string | null
  constante_a: number
  acd_estimado: number
  admite_toricos: boolean
  apto_sulcus: boolean
}

interface AlconCatalogModalProps {
  abierto: boolean
  onCerrar: () => void
}

export default function AlconCatalogModal({ abierto, onCerrar }: AlconCatalogModalProps) {
  const [catalogo, setCatalogo] = useState<AlconSku[]>([])
  const [cargando, setCargando] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState<string>('')
  const [filtroFamilia, setFiltroFamilia] = useState<string>('ALL')
  const [filtroTorico, setFiltroTorico] = useState<string>('ALL')
  const [paginaActual, setPaginaActual] = useState<number>(1)
  const itemsPorPagina = 25

  // Ítem seleccionado para ver QR & Generar Stickers
  const [itemSeleccionado, setItemSeleccionado] = useState<AlconSku | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copiado, setCopiado] = useState<boolean>(false)

  // Configuración de Impresión de Stickers
  const [cantidadStickers, setCantidadStickers] = useState<number>(24) // 24 = 1 hoja A4 llena (4x6)
  const [incluirGuiasCorte, setIncluirGuiasCorte] = useState<boolean>(true)
  const [generandoPdf, setGenerandoPdf] = useState<boolean>(false)

  // Cargar catálogo al abrir el modal
  useEffect(() => {
    if (!abierto) return

    if (catalogo.length === 0) {
      const fetchCatalogo = async () => {
        try {
          setCargando(true)
          setError(null)
          const res = await fetch(`${BACKEND_URL}/api/alcon/catalogo-completo`)
          const data = await res.json()
          if (res.ok && data.success && data.items) {
            setCatalogo(data.items)
          } else {
            throw new Error(data.detail || 'Error al cargar catálogo de Alcon.')
          }
        } catch (e: any) {
          console.error('Error cargando catálogo Alcon:', e)
          setError(e.message || 'Error de conexión.')
        } finally {
          setCargando(false)
        }
      }
      fetchCatalogo()
    }
  }, [abierto, catalogo.length])

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

  // Lista de familias únicas para el filtro
  const familiasUnicas = useMemo(() => {
    const setF = new Set<string>()
    catalogo.forEach((item) => {
      if (item.familia_nombre) setF.add(item.familia_nombre)
    })
    return Array.from(setF).sort()
  }, [catalogo])

  // Filtrado multivariable en memoria (3.895 registros)
  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return catalogo.filter((item) => {
      // Filtro por texto (GTIN, Internacional, Nombre de Producto)
      const matchTexto =
        !q ||
        item.gtin_14.toLowerCase().includes(q) ||
        item.gtin_12.toLowerCase().includes(q) ||
        item.internacional.toLowerCase().includes(q) ||
        item.nombre_producto.toLowerCase().includes(q) ||
        item.familia_nombre.toLowerCase().includes(q) ||
        String(item.dioptria).includes(q)

      // Filtro por Familia
      const matchFam = filtroFamilia === 'ALL' || item.familia_nombre === filtroFamilia

      // Filtro por Toricidad
      const matchTor =
        filtroTorico === 'ALL' ||
        (filtroTorico === 'TORICOS' && item.es_torico) ||
        (filtroTorico === 'ESFERICOS' && !item.es_torico)

      return matchTexto && matchFam && matchTor
    })
  }, [catalogo, busqueda, filtroFamilia, filtroTorico])

  // Paginación
  const totalPaginas = Math.ceil(itemsFiltrados.length / itemsPorPagina) || 1
  const itemsPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina
    return itemsFiltrados.slice(inicio, inicio + itemsPorPagina)
  }, [itemsFiltrados, paginaActual, itemsPorPagina])

  // Resetear página al filtrar
  useEffect(() => {
    setPaginaActual(1)
  }, [busqueda, filtroFamilia, filtroTorico])

  // Copiar GTIN al portapapeles
  const handleCopiarGtin = () => {
    if (!itemSeleccionado) return
    navigator.clipboard.writeText(itemSeleccionado.gtin_14)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // ====================================================================
  // GENERADOR DE PDF: STICKERS 4 cm x 4 cm EN HOJA A4
  // ====================================================================
  const handleGenerarPdfStickers = async () => {
    if (!itemSeleccionado || !qrDataUrl) return

    try {
      setGenerandoPdf(true)

      // Crear documento A4 en orientación vertical (210 mm x 297 mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const stickerSize = 40 // 40 mm x 40 mm (4 cm x 4 cm)
      const cols = 4 // 4 columnas = 160 mm de ancho
      const rows = 6 // 6 filas = 240 mm de alto
      const stickersPorPagina = cols * rows // 24 stickers por página A4

      // Márgenes para centrar la cuadrícula en la hoja A4 (210 x 297 mm)
      const marginLeft = (210 - cols * stickerSize) / 2 // 25 mm
      const marginTop = (297 - rows * stickerSize) / 2 // 28.5 mm

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

        // 1. Líneas de corte punteadas (si aplica)
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

        // 3. Dioptría y Toricidad destacadas
        doc.setFontSize(8.5)
        const diopTxt = `+${Number(itemSeleccionado.dioptria).toFixed(2)} D ${
          itemSeleccionado.es_torico ? `(T${itemSeleccionado.torico_valor || 'T'})` : ''
        }`
        doc.text(diopTxt, x + stickerSize / 2, y + 8, { align: 'center' })

        // 4. Código QR de alta resolución (18 mm x 18 mm)
        const qrSize = 18.5
        const qrX = x + (stickerSize - qrSize) / 2
        const qrY = y + 9.5
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

        // 5. Nombre Internacional
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(50, 50, 50)
        doc.text(`Ref: ${itemSeleccionado.internacional}`, x + stickerSize / 2, y + 31, { align: 'center' })

        // 6. Código GTIN Numérico (Legible)
        doc.setFont('courier', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(0, 0, 0)
        doc.text(itemSeleccionado.gtin_14, x + stickerSize / 2, y + 35.5, { align: 'center' })

        // 7. Marca / Pie
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.5)
        doc.setTextColor(100, 100, 100)
        doc.text('ALCON IOL • GS1 GTIN', x + stickerSize / 2, y + 38.5, { align: 'center' })

        stickersColocados++
      }

      // Descargar archivo PDF
      const filename = `Stickers_Alcon_${itemSeleccionado.internacional}_${itemSeleccionado.gtin_14}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('Error al generar PDF de stickers:', err)
      alert('Error al generar archivo PDF.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fade-in">
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
                  Catálogo Maestro Alcon (3.895 Códigos GTIN)
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                  Hoja GTIN.xlsx Indexada
                </span>
              </div>
              <p className="text-xs text-[var(--secondary)] mt-0.5">
                Explora las 3 columnas maestras, genera códigos QR escaneables y exporta planchas de stickers (4x4 cm) en hoja A4.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="p-2 text-slate-400 hover:text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer self-end sm:self-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="p-4 md:px-6 border-b border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--card)]">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por GTIN (ej: 0038065...), Nombre Internacional (ej: SY60WF, CNWTT) o Producto..."
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Filtro Familia */}
            <select
              value={filtroFamilia}
              onChange={(e) => setFiltroFamilia(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Todas las Familias ({familiasUnicas.length})</option>
              {familiasUnicas.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            {/* Filtro Tórico */}
            <select
              value={filtroTorico}
              onChange={(e) => setFiltroTorico(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">Todos (Esféricos y Tóricos)</option>
              <option value="ESFERICOS">Solo Esféricos</option>
              <option value="TORICOS">Solo Tóricos (T2-T9)</option>
            </select>
          </div>
        </div>

        {/* TABLA PRINCIPAL DEL CATÁLOGO */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/20">
          {cargando ? (
            <div className="py-24 text-center space-y-3">
              <Loader2 size={36} className="animate-spin text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-[var(--foreground)]">Cargando 3.895 registros del catálogo Alcon...</p>
              <p className="text-xs text-[var(--secondary)]">Indexando códigos GTIN, referencias y graduaciones.</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600 space-y-2">
              <p className="font-bold">{error}</p>
            </div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="py-24 text-center border border-dashed border-[var(--border)] rounded-3xl space-y-2">
              <Barcode size={32} className="mx-auto text-slate-400 opacity-50" />
              <p className="font-bold text-sm text-[var(--foreground)]">No se encontraron lentes con ese criterio</p>
              <p className="text-xs text-[var(--secondary)]">Prueba buscando por dioptría, código de 14 dígitos o modelo.</p>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-3xl overflow-hidden bg-[var(--card)] shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-[var(--secondary)] font-bold text-[10px] uppercase tracking-wider border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur-xs">
                      <th className="p-3.5">Columna 1: Código GTIN (14 Dígitos)</th>
                      <th className="p-3.5">Columna 2: Nombre Internacional</th>
                      <th className="p-3.5">Columna 3: Nombre del Producto</th>
                      <th className="p-3.5">Familia & Óptica</th>
                      <th className="p-3.5">Dioptría / Toricidad</th>
                      <th className="p-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {itemsPagina.map((item, idx) => (
                      <tr
                        key={item.gtin_14 || idx}
                        onClick={() => setItemSeleccionado(item)}
                        className="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 cursor-pointer transition group"
                      >
                        {/* 1. Código GTIN */}
                        <td className="p-3.5">
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5">
                            <Barcode size={14} className="text-slate-400 group-hover:text-amber-500" />
                            <span>{item.gtin_14}</span>
                          </span>
                        </td>

                        {/* 2. Nombre Internacional */}
                        <td className="p-3.5">
                          <span className="font-mono font-black text-[var(--foreground)] text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {item.internacional}
                          </span>
                        </td>

                        {/* 3. Nombre del Producto */}
                        <td className="p-3.5">
                          <span className="font-bold text-[var(--foreground)] block text-xs">
                            {item.nombre_producto}
                          </span>
                        </td>

                        {/* 4. Familia */}
                        <td className="p-3.5">
                          <span className="font-bold text-slate-700 dark:text-slate-200 block text-[11px]">
                            {item.familia_nombre}
                          </span>
                          <span className="text-[10px] text-[var(--secondary)]">
                            {item.tipo_optica} • Const A: {item.constante_a}
                          </span>
                        </td>

                        {/* 5. Dioptría */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                              +{Number(item.dioptria).toFixed(2)} D
                            </span>
                            {item.es_torico && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px]">
                                {item.torico_valor}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Botón Ver QR & Stickers */}
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setItemSeleccionado(item)
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer transition transform group-hover:scale-105"
                          >
                            <QrCode size={13} />
                            <span>Ver QR & Sticker</span>
                          </button>
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
            Mostrando <b>{itemsFiltrados.length}</b> registros de <b>{catalogo.length}</b> totales de Alcon.
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

                <span className="text-[11px] font-black text-blue-700 font-mono">
                  +{Number(itemSeleccionado.dioptria).toFixed(2)} D {itemSeleccionado.es_torico ? `(${itemSeleccionado.torico_valor})` : ''}
                </span>

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
                    Ref: {itemSeleccionado.internacional}
                  </span>
                  <span className="text-[9px] font-mono font-black text-slate-950 block tracking-wider">
                    {itemSeleccionado.gtin_14}
                  </span>
                </div>
              </div>

              <span className="text-[10px] text-[var(--secondary)] font-bold">
                Tamaño exacto de impresión física: <b>4.0 cm × 4.0 cm</b>
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
                  {[1, 6, 12, 24, 48].map((cant) => (
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
                      {cant === 24 ? '24 (1 Hoja)' : cant}
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
                    Incluir líneas punteadas para guillotina / tijera
                  </span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {Math.ceil(cantidadStickers / 24)} {Math.ceil(cantidadStickers / 24) === 1 ? 'página A4' : 'páginas A4'}
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
