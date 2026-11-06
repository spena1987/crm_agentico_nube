'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Printer,
  X,
  Check,
  CheckCircle2,
  Calendar,
  Building2,
  Search,
  Eye,
  SlidersHorizontal,
  FileText,
  RotateCcw,
  Sparkles,
  Barcode
} from 'lucide-react'
import QRCode from 'qrcode'

interface ModalCartelesPechoA4Props {
  isOpen: boolean
  onClose: () => void
  turnos: any[]
  quirofanos?: any[]
  initialTurnoId?: string | null
}

export default function ModalCartelesPechoA4({
  isOpen,
  onClose,
  turnos,
  quirofanos = [],
  initialTurnoId = null
}: ModalCartelesPechoA4Props) {
  // Formato: 3x2 (6 etiquetas por hoja A4, tamaño grande 105x99mm) o 4x2 (8 etiquetas 105x74mm)
  const [formato, setFormato] = useState<'3x2' | '4x2'>('3x2')
  
  // Modo: lote (múltiples pacientes) o individual (un paciente con selector de casilla de inicio)
  const [modo, setModo] = useState<'lote' | 'individual'>(initialTurnoId ? 'individual' : 'lote')
  const [turnoIndividualId, setTurnoIndividualId] = useState<string | null>(initialTurnoId || (turnos[0]?.id ?? null))
  
  // Posición inicial en la hoja autoadhesiva para no desperdiciar papel (0 a 5 en 3x2, 0 a 7 en 4x2)
  const [posicionInicio, setPosicionInicio] = useState<number>(0)
  
  // Filtros en modo lote
  const [filtroQuirofano, setFiltroQuirofano] = useState<string>('todos')
  const [filtroTexto, setFiltroTexto] = useState<string>('')
  const [seleccionadosIds, setSeleccionadosIds] = useState<Set<string>>(new Set())
  
  // Mapa de QRs cacheados en data URL (base64)
  const [qrMap, setQrMap] = useState<Record<string, string>>({})
  const [generandoQrs, setGenerandoQrs] = useState<boolean>(false)

  // Inicializar selección
  useEffect(() => {
    if (!isOpen) return
    if (initialTurnoId) {
      setModo('individual')
      setTurnoIndividualId(initialTurnoId)
      setPosicionInicio(0)
    } else {
      setModo('lote')
      setSeleccionadosIds(new Set(turnos.map((t) => t.id)))
    }
  }, [isOpen, initialTurnoId, turnos])

  // Ajustar posición de inicio si cambia el formato
  const maxSlots = formato === '3x2' ? 6 : 8
  useEffect(() => {
    if (posicionInicio >= maxSlots) {
      setPosicionInicio(0)
    }
  }, [formato, maxSlots, posicionInicio])

  // Generar QRs de alta resolución en puro blanco y negro
  useEffect(() => {
    if (!isOpen || turnos.length === 0) return

    let cancelado = false
    const generarQrs = async () => {
      setGenerandoQrs(true)
      const nuevoMapa: Record<string, string> = { ...qrMap }

      for (const t of turnos) {
        if (!nuevoMapa[t.id]) {
          try {
            const payload = `MEDCRM:QX:${t.id}`
            const dataUrl = await QRCode.toDataURL(payload, {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 250,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            })
            if (!cancelado) {
              nuevoMapa[t.id] = dataUrl
            }
          } catch (e) {
            console.error('Error generando QR para turno:', t.id, e)
          }
        }
      }

      if (!cancelado) {
        setQrMap(nuevoMapa)
        setGenerandoQrs(false)
      }
    }

    generarQrs()
    return () => {
      cancelado = true
    }
  }, [isOpen, turnos])

  // Filtrado de turnos para modo lote
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      if (filtroQuirofano !== 'todos' && t.quirofano_id !== filtroQuirofano) {
        return false
      }
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase()
        const pacNom = (t.pacientes?.nombre || '').toLowerCase()
        const pacDni = (t.pacientes?.dni || '').toLowerCase()
        const cirujano = (t.cirujano_nombre || '').toLowerCase()
        if (!pacNom.includes(q) && !pacDni.includes(q) && !cirujano.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [turnos, filtroQuirofano, filtroTexto])

  // Lista final de turnos a imprimir según el modo
  const turnosAImprimir = useMemo(() => {
    if (modo === 'individual') {
      const target = turnos.find((t) => t.id === turnoIndividualId)
      return target ? [target] : []
    }
    return turnosFiltrados.filter((t) => seleccionadosIds.has(t.id))
  }, [modo, turnos, turnoIndividualId, turnosFiltrados, seleccionadosIds])

  // Generación de la grilla de páginas A4 con celdas vacías por desfase
  const paginasA4 = useMemo(() => {
    const slotsPorHoja = formato === '3x2' ? 6 : 8
    const slotsTotales: Array<{ esVacio: boolean; turno?: any }> = []

    // Si es individual y hay desfase inicial (para reutilizar plancha de stickers)
    if (modo === 'individual' && posicionInicio > 0) {
      for (let i = 0; i < posicionInicio; i++) {
        slotsTotales.push({ esVacio: true })
      }
    }

    // Agregar los turnos
    for (const t of turnosAImprimir) {
      slotsTotales.push({ esVacio: false, turno: t })
    }

    // Agrupar en páginas A4 completas
    const paginas: Array<Array<{ esVacio: boolean; turno?: any }>> = []
    for (let i = 0; i < slotsTotales.length; i += slotsPorHoja) {
      paginas.push(slotsTotales.slice(i, i + slotsPorHoja))
    }

    // Completar la última página con vacíos hasta llenar los slots de la hoja si aplica
    if (paginas.length > 0) {
      const ultimaPag = paginas[paginas.length - 1]
      while (ultimaPag.length < slotsPorHoja) {
        ultimaPag.push({ esVacio: true })
      }
    }

    return paginas
  }, [formato, modo, posicionInicio, turnosAImprimir])

  const toggleSeleccion = (id: string) => {
    const nuevo = new Set(seleccionadosIds)
    if (nuevo.has(id)) {
      nuevo.delete(id)
    } else {
      nuevo.add(id)
    }
    setSeleccionadosIds(nuevo)
  }

  const seleccionarTodos = () => {
    setSeleccionadosIds(new Set(turnosFiltrados.map((t) => t.id)))
  }

  const deseleccionarTodos = () => {
    setSeleccionadosIds(new Set())
  }

  const handleImprimir = () => {
    const printNode = document.getElementById('contenedor-imprimible-a4')
    if (!printNode) {
      window.print()
      return
    }

    // Remover iframe previo si existiera
    const existingIframe = document.getElementById('iframe-impresion-carteles-a4')
    if (existingIframe) {
      existingIframe.remove()
    }

    const iframe = document.createElement('iframe')
    iframe.id = 'iframe-impresion-carteles-a4'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      window.print()
      return
    }

    const cssA4 = `
      @page {
        size: A4 portrait;
        margin: 0mm;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      html, body {
        width: 210mm;
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pagina-a4-hoja {
        width: 210mm;
        height: 297mm;
        max-height: 297mm;
        margin: 0;
        padding: 0;
        page-break-after: always;
        break-after: page;
        display: grid;
        background: #ffffff;
        overflow: hidden;
      }
      .pagina-a4-hoja:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .pagina-a4-3x2 {
        grid-template-columns: 105mm 105mm;
        grid-template-rows: 99mm 99mm 99mm;
      }
      .pagina-a4-4x2 {
        grid-template-columns: 105mm 105mm;
        grid-template-rows: 74.25mm 74.25mm 74.25mm 74.25mm;
      }
      .etiqueta-pecho-card {
        box-sizing: border-box;
        border: 0.5pt dashed #888888;
        overflow: hidden;
        background: #ffffff;
        color: #000000;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 12px 14px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Clases de alto contraste morfológico para tóner láser monocromático */
      .bg-black { background-color: #000000 !important; color: #ffffff !important; }
      .text-white { color: #ffffff !important; }
      .text-black { color: #000000 !important; }
      .border-black { border-color: #000000 !important; }
      .border { border-style: solid; border-width: 1px; }
      .border-2 { border-width: 2px !important; }
      .border-b { border-bottom-style: solid; border-bottom-width: 1px; }
      .border-dashed { border-style: dashed !important; }
      .flex { display: flex; }
      .flex-col { flex-direction: column; }
      .flex-1 { flex: 1 1 0%; }
      .items-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .gap-1 { gap: 4px; }
      .gap-1\\.5 { gap: 6px; }
      .gap-2 { gap: 8px; }
      .gap-2\\.5 { gap: 10px; }
      .p-0\\.5 { padding: 2px; }
      .p-1 { padding: 4px; }
      .p-1\\.5 { padding: 6px; }
      .p-3 { padding: 12px; }
      .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
      .py-1 { padding-top: 4px; padding-bottom: 4px; }
      .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
      .px-2 { padding-left: 8px; padding-right: 8px; }
      .pb-0\\.5 { padding-bottom: 2px; }
      .pb-1 { padding-bottom: 4px; }
      .pt-1 { padding-top: 4px; }
      .my-0\\.5 { margin-top: 2px; margin-bottom: 2px; }
      .mt-0\\.5 { margin-top: 2px; }
      .mt-1 { margin-top: 4px; }
      .mb-1 { margin-bottom: 4px; }
      .shrink-0 { flex-shrink: 0; }
      .min-w-0 { min-width: 0; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
      .font-black { font-weight: 900 !important; }
      .font-extrabold { font-weight: 800 !important; }
      .font-bold { font-weight: 700 !important; }
      .font-semibold { font-weight: 600 !important; }
      .uppercase { text-transform: uppercase !important; }
      .text-center { text-align: center; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .leading-none { line-height: 1; }
      .leading-tight { line-height: 1.25; }
      .text-xl { font-size: 20px; }
      .text-lg { font-size: 18px; }
      .text-base { font-size: 16px; }
      .text-xs { font-size: 12px; }
      .text-\\[11px\\] { font-size: 11px; }
      .text-\\[10px\\] { font-size: 10px; }
      .text-\\[9px\\] { font-size: 9px; }
      .text-\\[8px\\] { font-size: 8px; }
      .w-\\[24mm\\] { width: 24mm; }
      .h-\\[24mm\\] { height: 24mm; }
      .w-\\[20mm\\] { width: 20mm; }
      .h-\\[20mm\\] { height: 20mm; }
      .space-y-1 > * + * { margin-top: 4px; }
      .space-y-1\\.5 > * + * { margin-top: 6px; }
    `

    doc.open()
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Carteles Pecho A4 - CentroVisión Quirófano</title>
  <style>${cssA4}</style>
</head>
<body>
  ${printNode.innerHTML}
</body>
</html>`)
    doc.close()

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (err) {
        console.error('Error con iframe.print(), fallback:', err)
        window.print()
      }
    }, 250)
  }

  if (!isOpen) return null

  return (
    <>
      {/* ========================================================================= */}
      {/* ESTILOS DE IMPRESIÓN DIRECTA LÁSER A4 (@media print)                    */}
      {/* ========================================================================= */}
      <style jsx global>{`
        @media screen {
          .area-imprimible-a4-laser {
            display: none !important;
          }
        }

        @media print {
          /* Fallback para Ctrl + P */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .no-print, .no-print * {
            display: none !important;
          }

          .area-imprimible-a4-laser,
          .area-imprimible-a4-laser * {
            visibility: visible !important;
          }

          .area-imprimible-a4-laser {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: A4 portrait;
            margin: 0mm !important;
          }

          .pagina-a4-hoja {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            display: grid !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }

          .pagina-a4-hoja:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .pagina-a4-3x2 {
            grid-template-columns: 105mm 105mm !important;
            grid-template-rows: 99mm 99mm 99mm !important;
          }

          .pagina-a4-4x2 {
            grid-template-columns: 105mm 105mm !important;
            grid-template-rows: 74.25mm 74.25mm 74.25mm 74.25mm !important;
          }

          .etiqueta-pecho-card {
            box-sizing: border-box !important;
            border: 0.5pt dashed #888888 !important;
            overflow: hidden !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* DIÁLOGO / MODAL DE PREVISUALIZACIÓN Y CONFIGURACIÓN (PANTALLA)          */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 animate-fade-in no-print">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden">
          {/* Cabecera del Modal */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 shadow-inner">
                <Printer size={22} className="text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                    Láser B&W • Papel Autoadhesivo A4
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">Pre-Quirófano & Mesa Qx</span>
                </div>
                <h3 className="text-lg font-black tracking-tight mt-0.5">
                  Carteles Distintivos de Pecho para Pacientes
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImprimir}
                disabled={turnosAImprimir.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/30 transition disabled:opacity-50"
              >
                <Printer size={16} />
                <span>Imprimir {paginasA4.length} Hoja(s) A4</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Barra de Configuración y Filtros */}
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            {/* Controles de Formato y Modo */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Selector de Formato A4 */}
              <div className="flex items-center bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] shadow-xs">
                <button
                  type="button"
                  onClick={() => setFormato('3x2')}
                  className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 ${
                    formato === '3x2'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                  }`}
                  title="3 Filas × 2 Columnas: 6 etiquetas de 105 × 99 mm (Tipografía Gigante)"
                >
                  <span>3×2 (6 por Hoja) ⭐</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormato('4x2')}
                  className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 ${
                    formato === '4x2'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                  }`}
                  title="4 Filas × 2 Columnas: 8 etiquetas de 105 × 74 mm (Rendimiento estándar)"
                >
                  <span>4×2 (8 por Hoja)</span>
                </button>
              </div>

              {/* Selector de Modo: Lote vs Individual */}
              <div className="flex items-center bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] shadow-xs">
                <button
                  type="button"
                  onClick={() => setModo('lote')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                    modo === 'lote'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Tanda del Día
                </button>
                <button
                  type="button"
                  onClick={() => setModo('individual')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                    modo === 'individual'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Paciente Individual
                </button>
              </div>
            </div>

            {/* Controles de Lote / Individual */}
            {modo === 'lote' ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro por Quirófano */}
                {quirofanos.length > 0 && (
                  <select
                    value={filtroQuirofano}
                    onChange={(e) => setFiltroQuirofano(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-semibold outline-none"
                  >
                    <option value="todos">Todas las Salas</option>
                    {quirofanos.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.nombre} ({q.codigo})
                      </option>
                    ))}
                  </select>
                )}

                {/* Buscador */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    placeholder="Buscar paciente o DNI..."
                    className="pl-7 pr-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs outline-none w-44"
                  />
                </div>

                <button
                  type="button"
                  onClick={seleccionarTodos}
                  className="px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={deseleccionarTodos}
                  className="px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-500"
                >
                  Desmarcar
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {/* Selector de Paciente */}
                <select
                  value={turnoIndividualId || ''}
                  onChange={(e) => setTurnoIndividualId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs font-extrabold outline-none max-w-xs truncate"
                >
                  {turnos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.pacientes?.nombre || 'Paciente'} (DNI: {t.pacientes?.dni}) - {t.ojo || 'OD'}
                    </option>
                  ))}
                </select>

                {/* Selector visual de celda inicial para no desperdiciar hoja usada */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--secondary)] font-bold">
                    Iniciar en celda:
                  </span>
                  <div className="flex items-center gap-1 bg-[var(--card)] p-1 rounded-xl border border-[var(--border)]">
                    {Array.from({ length: maxSlots }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPosicionInicio(idx)}
                        className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition ${
                          posicionInicio === idx
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-[var(--secondary)] hover:text-[var(--foreground)]'
                        }`}
                        title={`Comenzar impresión en la posición ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Área de Visualización / Scroll con aspecto A4 real */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200 dark:bg-slate-950 flex flex-col items-center gap-6">
            <div className="text-center text-xs text-slate-500 max-w-md">
              <p>
                <b>Vista previa milimétrica en Blanco y Negro</b> optimizada para tóner láser. Al presionar{' '}
                <span className="font-bold text-blue-600">Imprimir</span>, el navegador enviará directamente las hojas
                A4 a escala 100%.
              </p>
            </div>

            {/* Render de las Hojas A4 en Pantalla */}
            {paginasA4.map((hoja, numHoja) => (
              <div
                key={numHoja}
                className="bg-white text-black shadow-2xl border border-slate-300 rounded-sm relative"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  boxSizing: 'border-box'
                }}
              >
                {/* Indicador de Hoja */}
                <div className="absolute -top-5 left-0 text-[10px] font-mono font-bold text-slate-400 no-print">
                  Hoja A4 N° {numHoja + 1} de {paginasA4.length} ({formato === '3x2' ? '6 etiquetas' : '8 etiquetas'})
                </div>

                <div
                  className={`grid ${formato === '3x2' ? 'pagina-a4-3x2' : 'pagina-a4-4x2'}`}
                  style={{
                    gridTemplateColumns: '105mm 105mm',
                    gridTemplateRows: formato === '3x2' ? '99mm 99mm 99mm' : '74.25mm 74.25mm 74.25mm 74.25mm',
                    width: '210mm',
                    height: '297mm'
                  }}
                >
                  {hoja.map((slot, sIdx) => {
                    if (slot.esVacio || !slot.turno) {
                      return (
                        <div
                          key={sIdx}
                          className="etiqueta-pecho-card p-3 flex flex-col items-center justify-center text-slate-300 text-xs border border-dashed border-slate-300"
                        >
                          <span className="font-mono text-[10px] no-print">
                            [Espacio vacío #{sIdx + 1}]
                          </span>
                        </div>
                      )
                    }

                    const t = slot.turno
                    const pac = t.pacientes || {}
                    const ojo = (t.ojo || 'OD').toUpperCase()
                    const esOD = ojo === 'OD'
                    const esOI = ojo === 'OI'
                    const qrUrl = qrMap[t.id]

                    // Cálculo de edad si está disponible
                    let edadStr = ''
                    if (pac.fecha_nacimiento) {
                      try {
                        const fn = new Date(pac.fecha_nacimiento)
                        const hoy = new Date()
                        let edad = hoy.getFullYear() - fn.getFullYear()
                        const m = hoy.getMonth() - fn.getMonth()
                        if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) {
                          edad--
                        }
                        if (edad > 0 && edad < 120) {
                          edadStr = `${edad} años`
                        }
                      } catch {}
                    }

                    return (
                      <div
                        key={sIdx}
                        className={`etiqueta-pecho-card p-3 sm:p-4 flex flex-col justify-between border border-dashed border-slate-400 bg-white text-black ${
                          formato === '3x2' ? 'space-y-1.5' : 'space-y-1'
                        }`}
                        style={{ boxSizing: 'border-box' }}
                      >
                        {/* 1. Cabecera con QR Láser + Datos de Clínica y Turno */}
                        <div className="flex items-center gap-2.5 pb-1 border-b border-black">
                          {/* QR Vectorial 100% Black */}
                          <div className="shrink-0 bg-white border border-black p-0.5">
                            {qrUrl ? (
                              <img
                                src={qrUrl}
                                alt={`QR ${t.id}`}
                                className={formato === '3x2' ? 'w-[25mm] h-[25mm]' : 'w-[20mm] h-[20mm]'}
                                style={{ imageRendering: 'pixelated' }}
                              />
                            ) : (
                              <div className="w-[20mm] h-[20mm] bg-slate-100 flex items-center justify-center text-[8px] font-mono">
                                QR...
                              </div>
                            )}
                          </div>

                          {/* Info Clínica, Sala y Hora */}
                          <div className="flex-1 min-w-0 text-[10px] leading-tight">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-[11px] tracking-tight uppercase">
                                CENTROVISIÓN QUIRÚRGICO
                              </span>
                              <span className="font-mono font-black text-xs">
                                {t.hora_inicio ? t.hora_inicio.slice(0, 5) : '08:00'} hs
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5 font-bold">
                              <span>Sala: {t.quirofanos?.codigo || t.quirofanos?.nombre || 'Q01'}</span>
                              <span className="font-mono text-[9px]">Turno #{String(t.codigo_turno || t.id).slice(0, 8)}</span>
                            </div>
                            <p className="truncate text-slate-800 text-[10px] font-semibold mt-0.5">
                              Cirujano: <b>{t.cirujano_nombre || 'Asignado'}</b>
                            </p>
                          </div>
                        </div>

                        {/* 2. Nombre del Paciente en Tipografía GIGANTE */}
                        <div className="py-0.5">
                          <h2
                            className={`font-black uppercase tracking-tight text-black leading-none ${
                              formato === '3x2' ? 'text-xl' : 'text-base'
                            }`}
                          >
                            {pac.nombre || 'PACIENTE SIN NOMBRE'}
                          </h2>
                          <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-slate-900 mt-1">
                            <span>DNI: {pac.dni || 'S/D'}</span>
                            {edadStr && <span>• {edadStr}</span>}
                            <span>• {t.obra_social || pac.obra_social || 'Particular'}</span>
                          </div>
                        </div>

                        {/* 3. INSIGNIA DE OJO A OPERAR — DIFERENCIACIÓN MORFOLÓGICA INVERSA */}
                        {esOD ? (
                          /* OJO DERECHO: Fondo NEGRO SÓLIDO con letras BLANCAS */
                          <div className="bg-black text-white text-center font-black py-1 px-2 text-base sm:text-lg tracking-wider uppercase my-0.5 shadow-xs">
                            ►►► OJO DERECHO (OD) ►►►
                          </div>
                        ) : esOI ? (
                          /* OJO IZQUIERDO: Fondo BLANCO PURO con RECUADRO NEGRO EXTRA-GRUESO */
                          <div
                            className="bg-white text-black text-center font-black py-0.5 px-2 text-base sm:text-lg tracking-wider uppercase my-0.5"
                            style={{ borderWidth: '3.5px', borderStyle: 'solid', borderColor: '#000000' }}
                          >
                            ◄◄◄ OJO IZQUIERDO (OI) ◄◄◄
                          </div>
                        ) : (
                          /* AMBOS OJOS: Doble Borde */
                          <div
                            className="bg-white text-black text-center font-black py-0.5 px-2 text-base sm:text-lg tracking-wider uppercase my-0.5"
                            style={{ borderWidth: '4px', borderStyle: 'double', borderColor: '#000000' }}
                          >
                            ◈◈◈ AMBOS OJOS (AO) ◈◈◈
                          </div>
                        )}

                        {/* 4. Práctica Quirúrgica Programada */}
                        <div className="text-[10px] leading-tight border-b border-black/40 pb-1">
                          <span className="font-semibold text-slate-700 block">Práctica:</span>
                          <span className="font-black text-[11px] uppercase truncate block">
                            {t.practica_nombre || 'Cirugía Oftalmológica'}
                          </span>
                        </div>

                        {/* 5. Bloque LIO Blindado */}
                        {t.lleva_lente ? (
                          <div className="border border-black p-1.5 text-[10px] leading-tight bg-white">
                            <div className="flex items-center justify-between border-b border-black/30 pb-0.5 mb-1">
                              <span className="font-black uppercase tracking-wider text-[9px]">
                                LENTE INTRAOCULAR (LIO)
                              </span>
                              <span className="font-mono font-bold text-[10px]">
                                Lote: {t.lente_lote || 'S/D'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-bold text-[11px] truncate flex-1">
                                {t.lente_tipo || 'LIO Estándar'}
                              </span>
                              <div className="border-2 border-black px-2 py-0.5 font-black text-xs sm:text-sm text-black">
                                {t.lente_dioptria ? `${t.lente_dioptria} D` : 'N/D'}
                              </div>
                              {t.es_torico && (
                                <div className="bg-black text-white px-1.5 py-0.5 font-black text-[9px] uppercase">
                                  T{t.lente_torico_valor || 0} ({t.lente_torico_eje || 90}°)
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-black/40 p-1 text-[10px] text-center font-bold text-slate-800">
                            SIN IMPLANTE DE LENTE (LIO)
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTENEDOR OCULTO PARA IMPRESIÓN DIRECTA CON window.print()              */}
      {/* ========================================================================= */}
      <div id="contenedor-imprimible-a4" className="area-imprimible-a4-laser">
        {paginasA4.map((hoja, numHoja) => (
          <div
            key={numHoja}
            className={`pagina-a4-hoja ${formato === '3x2' ? 'pagina-a4-3x2' : 'pagina-a4-4x2'}`}
          >
            {hoja.map((slot, sIdx) => {
              if (slot.esVacio || !slot.turno) {
                return <div key={sIdx} className="etiqueta-pecho-card" />
              }

              const t = slot.turno
              const pac = t.pacientes || {}
              const ojo = (t.ojo || 'OD').toUpperCase()
              const esOD = ojo === 'OD'
              const esOI = ojo === 'OI'
              const qrUrl = qrMap[t.id]

              let edadStr = ''
              if (pac.fecha_nacimiento) {
                try {
                  const fn = new Date(pac.fecha_nacimiento)
                  const hoy = new Date()
                  let edad = hoy.getFullYear() - fn.getFullYear()
                  const m = hoy.getMonth() - fn.getMonth()
                  if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) {
                    edad--
                  }
                  if (edad > 0 && edad < 120) {
                    edadStr = `${edad} años`
                  }
                } catch {}
              }

              return (
                <div
                  key={sIdx}
                  className={`etiqueta-pecho-card p-3 flex flex-col justify-between ${
                    formato === '3x2' ? 'space-y-1.5' : 'space-y-1'
                  }`}
                >
                  {/* 1. Cabecera */}
                  <div className="flex items-center gap-2 pb-1 border-b border-black">
                    <div className="shrink-0 bg-white border border-black p-0.5">
                      {qrUrl && (
                        <img
                          src={qrUrl}
                          alt="QR"
                          className={formato === '3x2' ? 'w-[24mm] h-[24mm]' : 'w-[20mm] h-[20mm]'}
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-[10px] leading-tight">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[11px] uppercase">CENTROVISIÓN QUIRÚRGICO</span>
                        <span className="font-mono font-black text-xs">
                          {t.hora_inicio ? t.hora_inicio.slice(0, 5) : '08:00'} hs
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5 font-bold">
                        <span>Sala: {t.quirofanos?.codigo || t.quirofanos?.nombre || 'Q01'}</span>
                        <span className="font-mono text-[9px]">#{String(t.codigo_turno || t.id).slice(0, 8)}</span>
                      </div>
                      <p className="truncate font-semibold text-[10px] mt-0.5">
                        Cirujano: <b>{t.cirujano_nombre || 'Asignado'}</b>
                      </p>
                    </div>
                  </div>

                  {/* 2. Paciente */}
                  <div className="py-0.5">
                    <h2
                      className={`font-black uppercase tracking-tight text-black leading-none ${
                        formato === '3x2' ? 'text-xl' : 'text-base'
                      }`}
                    >
                      {pac.nombre || 'PACIENTE SIN NOMBRE'}
                    </h2>
                    <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-black mt-1">
                      <span>DNI: {pac.dni || 'S/D'}</span>
                      {edadStr && <span>• {edadStr}</span>}
                      <span>• {t.obra_social || pac.obra_social || 'Particular'}</span>
                    </div>
                  </div>

                  {/* 3. OJO - Morfología Inversa */}
                  {esOD ? (
                    <div className="bg-black text-white text-center font-black py-1 px-2 text-base tracking-wider uppercase my-0.5">
                      ►►► OJO DERECHO (OD) ►►►
                    </div>
                  ) : esOI ? (
                    <div
                      className="bg-white text-black text-center font-black py-0.5 px-2 text-base tracking-wider uppercase my-0.5"
                      style={{ borderWidth: '3.5px', borderStyle: 'solid', borderColor: '#000000' }}
                    >
                      ◄◄◄ OJO IZQUIERDO (OI) ◄◄◄
                    </div>
                  ) : (
                    <div
                      className="bg-white text-black text-center font-black py-0.5 px-2 text-base tracking-wider uppercase my-0.5"
                      style={{ borderWidth: '4px', borderStyle: 'double', borderColor: '#000000' }}
                    >
                      ◈◈◈ AMBOS OJOS (AO) ◈◈◈
                    </div>
                  )}

                  {/* 4. Práctica */}
                  <div className="text-[10px] leading-tight border-b border-black/40 pb-1">
                    <span className="font-semibold block">Práctica:</span>
                    <span className="font-black text-[11px] uppercase truncate block">
                      {t.practica_nombre || 'Cirugía Oftalmológica'}
                    </span>
                  </div>

                  {/* 5. LIO */}
                  {t.lleva_lente ? (
                    <div className="border border-black p-1.5 text-[10px] leading-tight bg-white">
                      <div className="flex items-center justify-between border-b border-black/30 pb-0.5 mb-1">
                        <span className="font-black uppercase tracking-wider text-[9px]">LENTE INTRAOCULAR (LIO)</span>
                        <span className="font-mono font-bold text-[10px]">Lote: {t.lente_lote || 'S/D'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-[11px] truncate flex-1">{t.lente_tipo || 'LIO Estándar'}</span>
                        <div className="border-2 border-black px-2 py-0.5 font-black text-xs text-black">
                          {t.lente_dioptria ? `${t.lente_dioptria} D` : 'N/D'}
                        </div>
                        {t.es_torico && (
                          <div className="bg-black text-white px-1.5 py-0.5 font-black text-[9px] uppercase">
                            T{t.lente_torico_valor || 0} ({t.lente_torico_eje || 90}°)
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-black/40 p-1 text-[10px] text-center font-bold">
                      SIN IMPLANTE DE LENTE (LIO)
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
