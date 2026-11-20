'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Printer,
  X,
  Search
} from 'lucide-react'
import QRCode from 'qrcode'
import {
  formatearDniClinico,
  formatearFechaCirugia,
  evaluarBloqueLio,
  obtenerClasePractica
} from './cartelesPechoHelpers'

interface ModalCartelesPechoA4Props {
  isOpen: boolean
  onClose: () => void
  turnos: any[]
  quirofanos?: any[]
  initialTurnoId?: string | null
}

const SHARED_STICKER_CSS = `
  .etiqueta-pecho-card {
    box-sizing: border-box !important;
    border: 0.5pt dashed #888888 !important;
    overflow: hidden !important;
    background: #ffffff !important;
    color: #000000 !important;
    padding: 2mm !important;
    display: flex !important;
    flex-direction: column !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .etiqueta-inner {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    width: 100% !important;
    height: 100% !important;
    box-sizing: border-box !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
    padding: 8px 10px !important;
    border-radius: 3px !important;
    overflow: hidden !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .etiqueta-inner-3x2 {
    padding: 10px 12px !important;
  }
  .etiqueta-inner-od {
    background-color: #000000 !important;
    box-shadow: inset 0 0 0 9999px #000000 !important;
    color: #ffffff !important;
    border: 2px solid #000000 !important;
  }
  .etiqueta-inner-od .sticker-header,
  .etiqueta-inner-od .sticker-proc-border {
    border-color: rgba(255, 255, 255, 0.45) !important;
  }
  .etiqueta-inner-od .sticker-muted {
    color: #e2e8f0 !important;
  }
  .etiqueta-inner-od .sala-pill {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
  }
  .etiqueta-inner-od .eye-badge-od {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
    border: 2px solid #ffffff !important;
  }
  .etiqueta-inner-od .lio-box {
    border: 1.5px solid #ffffff !important;
    background-color: #000000 !important;
    box-shadow: inset 0 0 0 9999px #000000 !important;
    color: #ffffff !important;
  }
  .etiqueta-inner-od .lio-metric-pill {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
    border: 1px solid #ffffff !important;
  }
  .etiqueta-inner-od .lio-toric-badge {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
  }
  .etiqueta-inner-od .lio-no-calc-box {
    border: 2px dashed #ffffff !important;
    background-color: #000000 !important;
    box-shadow: inset 0 0 0 9999px #000000 !important;
    color: #ffffff !important;
  }
  .etiqueta-inner-oi {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
    border: 2px solid #000000 !important;
  }
  .etiqueta-inner-ao {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
    border: 4px double #000000 !important;
  }
  .etiqueta-inner-light .sticker-header,
  .etiqueta-inner-light .sticker-proc-border {
    border-color: #000000 !important;
  }
  .etiqueta-inner-light .sticker-muted {
    color: #1e293b !important;
  }
  .etiqueta-inner-light .sala-pill {
    background-color: #000000 !important;
    box-shadow: inset 0 0 0 9999px #000000 !important;
    color: #ffffff !important;
  }
  .etiqueta-inner-light .eye-badge-oi {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
    border: 2px solid #000000 !important;
  }
  .etiqueta-inner-light .eye-badge-ao {
    background-color: #000000 !important;
    box-shadow: inset 0 0 0 9999px #000000 !important;
    color: #ffffff !important;
    border: 2px solid #000000 !important;
  }
  .etiqueta-inner-light .lio-box {
    border: 1.5px solid #000000 !important;
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
  }
  .etiqueta-inner-light .lio-metric-pill {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
    border: 1.5px solid #000000 !important;
  }
  .etiqueta-inner-light .lio-toric-badge {
    background-color: #000000 !important;
    box-shadow: inset 0 0 0 9999px #000000 !important;
    color: #ffffff !important;
  }
  .etiqueta-inner-light .lio-no-calc-box {
    border: 2px dashed #000000 !important;
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    color: #000000 !important;
  }
  .qr-quiet-zone {
    background-color: #ffffff !important;
    box-shadow: inset 0 0 0 9999px #ffffff !important;
    padding: 6px !important;
    border-radius: 3px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
  }
  .etiqueta-inner-4x2 {
    padding: 5px 10px !important;
  }
  .qr-quiet-zone-4x2 {
    padding: 4px !important;
  }
  .sticker-nombre-3x2 {
    font-size: 21px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .sticker-nombre-4x2 {
    font-size: 17px !important;
    line-height: 1.12 !important;
    font-weight: 900 !important;
  }
  .sticker-proc-3x2-lg {
    font-size: 19px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .sticker-proc-3x2-md {
    font-size: 16px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .sticker-proc-3x2-sm {
    font-size: 14px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .sticker-proc-4x2-lg {
    font-size: 16px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .sticker-proc-4x2-md {
    font-size: 14px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .sticker-proc-4x2-sm {
    font-size: 12px !important;
    line-height: 1.12 !important;
    font-weight: 900 !important;
  }
  .sticker-proc-clamp-2 {
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }
  .surgeon-label {
    display: block !important;
    font-size: 9.5px !important;
    line-height: 1.1 !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
  }
  .surgeon-name-3x2 {
    display: block !important;
    font-size: 14px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .surgeon-name-4x2 {
    display: block !important;
    font-size: 12px !important;
    line-height: 1.15 !important;
    font-weight: 900 !important;
  }
  .lio-box-4x2 {
    padding: 3px 6px !important;
  }
  .lio-grid-4 {
    display: grid !important;
    grid-template-columns: 1fr 1.35fr 0.85fr 0.9fr !important;
    gap: 4px !important;
    align-items: center !important;
    text-align: center !important;
  }
  .lio-micro-header {
    font-size: 9px !important;
    line-height: 1.1 !important;
    font-weight: 800 !important;
    letter-spacing: 0.03em !important;
    text-transform: uppercase !important;
    margin-bottom: 2px !important;
  }
  .lio-metric-text-3x2 {
    font-size: 17px !important;
    line-height: 1.1 !important;
    font-weight: 900 !important;
  }
  .lio-metric-text-4x2 {
    font-size: 15px !important;
    line-height: 1.1 !important;
    font-weight: 900 !important;
  }
  .lio-tipo-3x2 {
    font-size: 14px !important;
    line-height: 1.15 !important;
    font-weight: 800 !important;
  }
  .lio-tipo-4x2 {
    font-size: 12px !important;
    line-height: 1.15 !important;
    font-weight: 800 !important;
  }
`

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
      const nuevoMapa: Record<string, string> = { ...qrMap }

      for (const t of turnos) {
        if (!nuevoMapa[t.id]) {
          try {
            const payload = `MEDCRM:QX:${t.id}`
            const dataUrl = await QRCode.toDataURL(payload, {
              errorCorrectionLevel: 'M',
              margin: 2,
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

  // Motor de impresión dual: Iframe aislado con fuentes estándar TrueType (Arial) para garantizar ToUnicode CMap
  const handleImprimir = () => {
    const printNode = document.getElementById('contenedor-imprimible-a4')
    if (!printNode) {
      window.print()
      return
    }

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
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
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
      ${SHARED_STICKER_CSS}
      .w-\\[22mm\\] { width: 22mm; }
      .h-\\[22mm\\] { height: 22mm; }
      .w-\\[16mm\\] { width: 16mm; }
      .h-\\[16mm\\] { height: 16mm; }
      /* Clases de alto contraste morfológico para tóner láser monocromático */
      .bg-black { background-color: #000000 !important; color: #ffffff !important; }
      .text-white { color: #ffffff !important; }
      .text-black { color: #000000 !important; }
      .border-black { border-color: #000000 !important; }
      .border { border-style: solid; border-width: 1px; }
      .border-2 { border-width: 2px !important; }
      .border-b { border-bottom-style: solid; border-bottom-width: 1px; }
      .border-b-2 { border-bottom-style: solid; border-bottom-width: 2px; }
      .border-t { border-top-style: solid; border-top-width: 1px; }
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
      .p-3 { padding: 10px; }
      .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
      .py-1 { padding-top: 4px; padding-bottom: 4px; }
      .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
      .px-2 { padding-left: 8px; padding-right: 8px; }
      .pb-0\\.5 { padding-bottom: 2px; }
      .pb-1 { padding-bottom: 4px; }
      .pt-0\\.5 { padding-top: 2px; }
      .pt-1 { padding-top: 4px; }
      .my-0\\.5 { margin-top: 2px; margin-bottom: 2px; }
      .mt-0\\.5 { margin-top: 2px; }
      .mt-1 { margin-top: 4px; }
      .mb-0\\.5 { margin-bottom: 2px; }
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
      .leading-tight { line-height: 1.2; }
      .leading-snug { line-height: 1.25; }
      .text-xl { font-size: 20px; }
      .text-lg { font-size: 17px; }
      .text-base { font-size: 15px; }
      .text-xs { font-size: 12px; }
      .text-\\[11px\\] { font-size: 11px; }
      .text-\\[10px\\] { font-size: 10px; }
      .text-\\[9px\\] { font-size: 9px; }
      .text-\\[8px\\] { font-size: 8px; }
      .w-\\[24mm\\] { width: 24mm; }
      .h-\\[24mm\\] { height: 24mm; }
      .w-\\[20mm\\] { width: 20mm; }
      .h-\\[20mm\\] { height: 20mm; }
      .space-y-1 > * + * { margin-top: 3px; }
      .space-y-1\\.5 > * + * { margin-top: 5px; }
      .rounded-xs { border-radius: 2px; }
      .rounded { border-radius: 3px; }
      .rounded-md { border-radius: 4px; }
      .bg-slate-100 { background-color: #f1f5f9 !important; }
      .bg-white { background-color: #ffffff !important; }
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

  // Renderizador unificado de cada etiqueta clínica de pecho
  const renderEtiqueta = (slot: { esVacio: boolean; turno?: any }, sIdx: number, esModoImpresion: boolean) => {
    if (slot.esVacio || !slot.turno) {
      return (
        <div
          key={sIdx}
          className="etiqueta-pecho-card p-3 flex flex-col items-center justify-center text-slate-300 text-xs border border-dashed border-slate-300"
        >
          {!esModoImpresion && (
            <span className="font-mono text-[10px] no-print">
              [Espacio vacío #{sIdx + 1}]
            </span>
          )}
        </div>
      )
    }

    const t = slot.turno
    const pac = t.pacientes || {}
    const ojo = (t.ojo || 'OD').toUpperCase()
    const esOD = ojo === 'OD'
    const esOI = ojo === 'OI'
    const qrUrl = qrMap[t.id]

    // Cálculo de edad
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

    // Código institucional completo sin truncar
    const codigoTurnoMostrar = t.codigo_turno ? String(t.codigo_turno) : String(t.id).slice(0, 8)

    // Fecha y hora
    const fechaStr = formatearFechaCirugia(t.fecha_cirugia || t.fecha)
    const horaStr = t.hora_inicio ? t.hora_inicio.slice(0, 5) : '08:00'

    // LIO: Evaluación clínica unificada
    const lio = evaluarBloqueLio(t)
    const esAO = ojo === 'AO'
    const innerPolarityClass = esOD
      ? 'etiqueta-inner-od'
      : esAO
        ? 'etiqueta-inner-ao etiqueta-inner-light'
        : 'etiqueta-inner-oi etiqueta-inner-light'

    return (
      <div
        key={sIdx}
        className="etiqueta-pecho-card"
        style={{ boxSizing: 'border-box' }}
      >
        <div className={`etiqueta-inner ${formato === '3x2' ? 'etiqueta-inner-3x2' : 'etiqueta-inner-4x2'} ${innerPolarityClass}`}>
          {/* 1. Cabecera con QR Láser + Fecha/Hora, Sala, Código de Turno y Cirujano */}
          <div className="sticker-header flex items-center gap-2.5 pb-0.5 border-b">
            {/* QR Vectorial con Zona Muda Blanca Garantizada */}
            <div className={`qr-quiet-zone ${formato === '4x2' ? 'qr-quiet-zone-4x2' : ''}`}>
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR ${t.id}`}
                  className={formato === '3x2' ? 'w-[22mm] h-[22mm]' : 'w-[16mm] h-[16mm]'}
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className={`${formato === '3x2' ? 'w-[22mm] h-[22mm]' : 'w-[16mm] h-[16mm]'} bg-slate-100 flex items-center justify-center text-[8px] font-mono text-black`}>
                  QR...
                </div>
              )}
            </div>

            {/* Info Fecha/Hora, Sala, Código de Turno y Cirujano */}
            <div className="flex-1 min-w-0 leading-tight">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono font-black text-xs" style={{ whiteSpace: 'nowrap' }}>
                  {fechaStr ? `${fechaStr} • ` : ''}{horaStr} hs
                </span>
                <span className="sala-pill px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider" style={{ whiteSpace: 'nowrap' }}>
                  SALA {t.quirofanos?.codigo || t.quirofanos?.nombre || 'Q01'}
                </span>
              </div>

              <div className="flex items-center justify-between mt-0.5 gap-1">
                <span className="sticker-muted font-mono text-[10px] font-bold truncate" title={`Código institucional: ${codigoTurnoMostrar}`}>
                  #{codigoTurnoMostrar}
                </span>
              </div>

              <div className="mt-0.5">
                <div className="surgeon-label sticker-muted">CIRUJANO:</div>
                <div className={`surgeon-name-${formato} sticker-proc-clamp-2`}>
                  {t.cirujano_nombre || 'Asignado'}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Nombre del Paciente en Tipografía GIGANTE + DNI y Edad */}
          <div>
            <h2
              className={`uppercase tracking-tight ${
                formato === '3x2' ? 'sticker-nombre-3x2' : 'sticker-nombre-4x2'
              }`}
            >
              {pac.nombre || 'PACIENTE SIN NOMBRE'}
            </h2>
            <div className="sticker-muted flex items-center gap-2 text-xs font-bold mt-0.5">
              <span className="font-mono" style={{ whiteSpace: 'nowrap' }}>
                DNI: {formatearDniClinico(pac.dni)}
              </span>
              {edadStr && (
                <span style={{ whiteSpace: 'nowrap' }}>• {edadStr}</span>
              )}
            </div>
          </div>

          {/* 3. INSIGNIA DE OJO A OPERAR — POLARIDAD INVERSA TOTAL */}
          {esOD ? (
            <div className="eye-badge-od text-center font-black py-0.5 px-2 text-base tracking-wider uppercase rounded-xs">
              ►►► OJO DERECHO (OD) ►►►
            </div>
          ) : esOI ? (
            <div className="eye-badge-oi text-center font-black py-0.5 px-2 text-base tracking-wider uppercase rounded-xs">
              ◄◄◄ OJO IZQUIERDO (OI) ◄◄◄
            </div>
          ) : esAO ? (
            <div className="eye-badge-ao text-center font-black py-0.5 px-2 text-base tracking-wider uppercase rounded-xs">
              ◈◈◈ AMBOS OJOS (AO) ◈◈◈
            </div>
          ) : (
            <div className="eye-badge-oi text-center font-black py-0.5 px-2 text-base tracking-wider uppercase rounded-xs">
              OJO: {ojo}
            </div>
          )}

          {/* 4. Práctica Quirúrgica Programada (Máximo 2 líneas con escalado dinámico por longitud) */}
          <div className={`leading-tight ${lio.mostrarBloque ? 'sticker-proc-border border-b pb-0.5' : ''}`}>
            <span
              className={`uppercase ${obtenerClasePractica(t.practica_nombre, formato)} sticker-proc-clamp-2`}
              style={{ wordBreak: 'break-word' }}
            >
              {t.practica_nombre || 'Cirugía Oftalmológica'}
            </span>
          </div>

          {/* 5. Bloque LIO Condicional (4 columnas fijas: INCISIÓN | DIOPTRÍA | TÓRICO | EJE, sin Lote) */}
          {lio.estado === 'CARGADO' ? (
            <div className={`lio-box rounded-xs leading-tight ${formato === '4x2' ? 'lio-box-4x2' : 'p-1.5'}`}>
              <div className="lio-micro-header lio-grid-4 sticker-muted">
                <span>INCISIÓN</span>
                <span>DIOPTRÍA</span>
                <span>TÓRICO</span>
                <span>EJE</span>
              </div>
              <div className={`lio-grid-4 ${formato === '3x2' ? 'lio-metric-text-3x2' : 'lio-metric-text-4x2'}`}>
                {lio.incisionTexto ? (
                  <span className="lio-metric-pill px-1.5 py-0.5 rounded-xs font-mono" style={{ whiteSpace: 'nowrap' }}>
                    {lio.incisionTexto}
                  </span>
                ) : (
                  <span className="sticker-muted">—</span>
                )}
                <span className="lio-metric-pill px-1.5 py-0.5 rounded-xs font-mono" style={{ whiteSpace: 'nowrap' }}>
                  {lio.dioptriaTexto}
                </span>
                {lio.toricoValorTexto ? (
                  <span className="lio-toric-badge px-1.5 py-0.5 rounded-xs font-mono uppercase" style={{ whiteSpace: 'nowrap' }}>
                    {lio.toricoValorTexto}
                  </span>
                ) : (
                  <span className="sticker-muted">—</span>
                )}
                {lio.toricoEjeTexto ? (
                  <span className="lio-toric-badge px-1.5 py-0.5 rounded-xs font-mono" style={{ whiteSpace: 'nowrap' }}>
                    {lio.toricoEjeTexto}
                  </span>
                ) : (
                  <span className="sticker-muted">—</span>
                )}
              </div>
              <div className={`lio-tipo-${formato} sticker-proc-clamp-2 mt-1`}>
                {lio.tipoTexto || 'LIO Asignado'}
              </div>
            </div>
          ) : lio.estado === 'NO_CALCULADA' ? (
            <div className="lio-no-calc-box p-1.5 rounded-xs text-center font-black text-xs uppercase tracking-wide">
              LENTE NO CALCULADA
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* ========================================================================= */}
      {/* ESTILOS DE IMPRESIÓN DIRECTA LÁSER A4 (@media print)                    */}
      {/* ========================================================================= */}
      <style jsx global>{`
        ${SHARED_STICKER_CSS}

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
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
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
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
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
                  title="3 filas x 2 columnas = 6 etiquetas por hoja A4 (105 x 99 mm)"
                >
                  <span>3×2 (6 por Hoja - Gigante)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormato('4x2')}
                  className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 ${
                    formato === '4x2'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
                  }`}
                  title="4 filas x 2 columnas = 8 etiquetas por hoja A4 (105 x 74 mm)"
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
                      {t.pacientes?.nombre || 'Paciente'} (DNI: {formatearDniClinico(t.pacientes?.dni)}) - {t.ojo || 'OD'}
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
                        className={`w-6 h-6 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center ${
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
                  {hoja.map((slot, sIdx) => renderEtiqueta(slot, sIdx, false))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTENEDOR OCULTO PARA IMPRESIÓN DIRECTA CON window.print() / IFRAME       */}
      {/* ========================================================================= */}
      <div id="contenedor-imprimible-a4" className="area-imprimible-a4-laser">
        {paginasA4.map((hoja, numHoja) => (
          <div
            key={numHoja}
            className={`pagina-a4-hoja ${formato === '3x2' ? 'pagina-a4-3x2' : 'pagina-a4-4x2'}`}
          >
            {hoja.map((slot, sIdx) => renderEtiqueta(slot, sIdx, true))}
          </div>
        ))}
      </div>
    </>
  )
}
