'use client'

import React, { useState } from 'react'
import jsPDF from 'jspdf'
import { FileText, Download, X, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  resumenData: any
  productividadData: any
  moduloAsesoriaData: any
  moduloQuirofanoData: any
  rangoTexto: string
}

export default function ReportePdfExportModal({
  isOpen,
  onClose,
  resumenData,
  productividadData,
  moduloAsesoriaData,
  moduloQuirofanoData,
  rangoTexto
}: Props) {
  const [generando, setGenerando] = useState(false)
  const [generadoExitoso, setGeneradoExitoso] = useState(false)

  if (!isOpen) return null

  const handleDescargarPdf = () => {
    try {
      setGenerando(true)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const kpis = resumenData?.kpis || {}
      const usuarios = productividadData?.usuarios || []
      const fechaActual = new Date().toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      // Encabezado
      doc.setFillColor(15, 23, 42) // Azul oscuro / Slate
      doc.rect(0, 0, 210, 32, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('CENTROVISION - CLINICA MEDICA OFTALMOLOGICA', 14, 14)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(203, 213, 225)
      doc.text(`INFORME GERENCIAL Y DE PRODUCTIVIDAD OPERATIVA`, 14, 22)
      doc.text(`Periodo analizado: ${rangoTexto} | Emision: ${fechaActual}`, 14, 27)

      let yPos = 42

      // SECCIÓN 1: MACRO KPIS
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('1. RESUMEN EJECUTIVO & DIRECCION', 14, yPos)
      yPos += 8

      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(14, yPos, 182, 38, 2, 2, 'FD')

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 116, 139)
      doc.text('FACTURACION APROBADA (ARS)', 20, yPos + 8)
      doc.text('PRESUPUESTOS EMITIDOS / APROBADOS', 85, yPos + 8)
      doc.text('TASA DE CONVERSION', 150, yPos + 8)

      doc.setFontSize(12)
      doc.setTextColor(16, 185, 129)
      const factArs = (kpis.facturacion_aprobada_ars || 0).toLocaleString('es-AR')
      doc.text(`$ ${factArs}`, 20, yPos + 16)

      doc.setTextColor(15, 23, 42)
      doc.text(`${kpis.presupuestos_emitidos || 0} / ${kpis.presupuestos_aprobados || 0}`, 85, yPos + 16)

      doc.setTextColor(59, 130, 246)
      doc.text(`${kpis.tasa_conversion_presupuestos || 0}%`, 150, yPos + 16)

      // Fila 2 de KPIs
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 116, 139)
      doc.text('CIRUGIAS PROGRAMADAS / REALIZADAS', 20, yPos + 26)
      doc.text('ESTUDIOS ENVIADOS (WA 2DA LINEA)', 85, yPos + 26)
      doc.text('CASOS EN RIESGO SLA (>3d)', 150, yPos + 26)

      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(`${kpis.cirugias_programadas || 0} prog. / ${kpis.cirugias_operadas || 0} op.`, 20, yPos + 34)

      doc.text(`${kpis.total_estudios || 0} (${kpis.tasa_lectura_estudios || 0}% leidos)`, 85, yPos + 34)

      doc.setTextColor(239, 68, 68)
      doc.text(`${kpis.casos_en_riesgo_sla || 0} casos`, 150, yPos + 34)

      yPos += 48

      // SECCIÓN 2: PRODUCTIVIDAD DEL PERSONAL
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('2. PRODUCTIVIDAD Y ACCIONES POR USUARIA/O', 14, yPos)
      yPos += 8

      // Encabezado de tabla
      doc.setFillColor(241, 245, 249)
      doc.rect(14, yPos, 182, 7, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(71, 85, 105)
      doc.text('COLABORADOR/A', 16, yPos + 5)
      doc.text('ROL', 70, yPos + 5)
      doc.text('CONTACTOS', 115, yPos + 5)
      doc.text('WHATSAPP', 135, yPos + 5)
      doc.text('LLAMADAS', 155, yPos + 5)
      doc.text('ESTUDIOS', 175, yPos + 5)

      yPos += 8
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)

      const topUsuarios = usuarios.slice(0, 12)
      topUsuarios.forEach((u: any, idx: number) => {
        if (yPos > 265) {
          doc.addPage()
          yPos = 20
        }

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252)
          doc.rect(14, yPos - 2, 182, 6.5, 'F')
        }

        doc.setFont('helvetica', 'bold')
        doc.text(String(u.nombre || 'Personal').substring(0, 28), 16, yPos + 3)
        doc.setFont('helvetica', 'normal')
        doc.text(String(u.rol || '-').substring(0, 22), 70, yPos + 3)
        doc.text(String(u.contactos_totales || 0), 115, yPos + 3)
        doc.text(String(u.canales?.whatsapp || 0), 135, yPos + 3)
        doc.text(String(u.canales?.llamada || 0), 155, yPos + 3)
        doc.text(String(u.estudios_procesados || 0), 175, yPos + 3)

        yPos += 6.5
      })

      yPos += 8
      if (yPos > 255) {
        doc.addPage()
        yPos = 20
      }

      // SECCIÓN 3: RENDIMIENTO DE MÓDULOS
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('3. DESGLOSE OPERATIVO POR MODULOS', 14, yPos)
      yPos += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`* Asesoramiento Quirurgico: ${moduloAsesoriaData?.total_casos || 0} oportunidades activas en pipeline.`, 16, yPos + 4)
      doc.text(`* Quirofano & Cirugias: ${moduloQuirofanoData?.total_turnos || 0} turnos totales evaluados en agenda.`, 16, yPos + 10)
      doc.text(`* Canal WhatsApp Linea 2: ${kpis.total_estudios || 0} estudios clinicos entregados con trazabilidad Meta.`, 16, yPos + 16)

      // Pie de página
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text('Documento oficial generado por Centrovision CRM Medico - Sistema de Informacion Gerencial (SIG).', 14, 285)

      doc.save(`informe_gerencial_centrovision_${new Date().toISOString().split('T')[0]}.pdf`)
      setGeneradoExitoso(true)
    } catch (e) {
      console.error('Error generando PDF:', e)
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-[var(--border)] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Exportar Informe Ejecutivo</h3>
              <p className="text-[11px] text-gray-400">Descarga en formato PDF para Directorio</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs text-gray-300">
          <div className="p-3 bg-neutral-950 rounded-xl border border-[var(--border)] space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Periodo:</span>
              <span className="text-white font-bold">{rangoTexto}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">KPIs incluidos:</span>
              <span className="text-emerald-400 font-bold">Dirección, Finanzas, Staff y Módulos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Formato:</span>
              <span className="text-blue-400 font-bold">Documento PDF (A4)</span>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            El informe incluye el desglose de facturación, tasas de conversión, métricas de productividad de cada usuaria/o y el estado de los módulos de Asesoramiento, Quirófano y Estudios.
          </p>
        </div>

        {generadoExitoso && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle size={16} className="shrink-0" />
            <span>¡Informe generado y descargado correctamente!</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-neutral-800 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleDescargarPdf}
            disabled={generando}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            <Download size={14} className={generando ? 'animate-bounce' : ''} />
            <span>{generando ? 'Generando PDF...' : 'Descargar PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
