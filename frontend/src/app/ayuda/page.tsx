'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  HelpCircle,
  Search,
  Download,
  FileText,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Layers,
  X,
  BookOpen,
  Table as TableIcon,
  MessageSquare,
  ShieldCheck,
  Calendar,
  Building2,
  Eye,
  Stethoscope,
  Users,
  Settings
} from 'lucide-react'
import { HELP_KNOWLEDGE_BASE, HelpModule } from '@/data/helpKnowledgeBase'

export default function AyudaPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('todos')
  const [activeTab, setActiveTab] = useState<'todo' | 'howto' | 'campos' | 'faqs'>('todo')
  const [expandedFaqs, setExpandedFaqs] = useState<Record<string, boolean>>({})

  const toggleFaq = (key: string) => {
    setExpandedFaqs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Filtrar módulos por búsqueda y categoría
  const filteredModules = useMemo(() => {
    return HELP_KNOWLEDGE_BASE.filter(mod => {
      // Filtro por categoría
      if (selectedCategory !== 'todos' && mod.category !== selectedCategory) {
        return false
      }

      // Filtro por texto de búsqueda
      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase().trim()
      const inTitle = mod.title.toLowerCase().includes(query)
      const inOneLiner = mod.oneLiner.toLowerCase().includes(query)
      const inHowTo = mod.howTo.habitual.some(h => h.toLowerCase().includes(query)) ||
                      mod.howTo.secundarias.some(s => s.toLowerCase().includes(query))
      const inFields = mod.fields.some(f => f.name.toLowerCase().includes(query) || f.description.toLowerCase().includes(query))
      const inFaqs = mod.faqs.some(faq => faq.question.toLowerCase().includes(query) || faq.solution.toLowerCase().includes(query) || faq.cause.toLowerCase().includes(query))

      return inTitle || inOneLiner || inHowTo || inFields || inFaqs
    })
  }, [searchQuery, selectedCategory])

  const categories = [
    { id: 'todos', label: 'Todos los Módulos' },
    { id: 'comunicacion', label: 'WhatsApp & IA' },
    { id: 'agenda', label: 'Agenda & Recepción' },
    { id: 'quirurgico', label: 'Quirófano & Pipeline' },
    { id: 'administracion', label: 'Presupuestos & Admin' },
    { id: 'general', label: 'Pacientes & Fichas' },
  ]

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs">
              <HelpCircle size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
                Centro de Ayuda & Base de Conocimientos
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Manual de operación interactivo, guías paso a paso, diccionario de campos y resolución de incidencias.
              </p>
            </div>
          </div>
        </div>

        {/* Botón Descargar PDF */}
        <div className="flex items-center gap-2">
          <a
            href="/manual_procedimientos_crm_iso9001.pdf"
            download="Manual_Procedimientos_CRM_ISO9001.pdf"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            title="Descargar versión formal para impresión en formato PDF"
          >
            <Download size={16} />
            <span>Descargar Manual en PDF</span>
          </a>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Rápidos */}
      <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="¿Qué necesitas hacer? Busca por término, error, nombre de campo o módulo (ej. ToggleHuman, Sincronizar, Alcon, SLA)..."
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs md:text-sm text-[var(--foreground)] placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Categorías y Selector de Pestaña */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          {/* Chips de Categorías */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Vistas Temáticas */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('todo')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'todo'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todo
            </button>
            <button
              onClick={() => setActiveTab('howto')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                activeTab === 'howto'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen size={13} />
              <span>Paso a Paso</span>
            </button>
            <button
              onClick={() => setActiveTab('campos')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                activeTab === 'campos'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon size={13} />
              <span>Campos</span>
            </button>
            <button
              onClick={() => setActiveTab('faqs')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                activeTab === 'faqs'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle size={13} />
              <span>Incidencias / FAQ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Resultados y Contador */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
        <span>
          Mostrando {filteredModules.length} de {HELP_KNOWLEDGE_BASE.length} módulos documentados
          {searchQuery && ` para "${searchQuery}"`}
        </span>
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={14} />
          <span>Norma ISO 9001:2015 Homologado</span>
        </span>
      </div>

      {/* Lista de Módulos */}
      {filteredModules.length === 0 ? (
        <div className="p-12 text-center bg-[var(--card)] rounded-2xl border border-[var(--border)] space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Search size={22} />
          </div>
          <h3 className="text-base font-bold">No se encontraron resultados</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No encontramos ningún procedimiento o campo que coincida con tu búsqueda. Intenta con palabras clave más generales.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('todos') }}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors"
          >
            Restablecer Filtros
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden transition-all hover:border-blue-500/40"
            >
              {/* Encabezado del Módulo */}
              <div className="p-5 border-b border-[var(--border)] bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/40 dark:to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {mod.badgeCategory}
                    </span>
                    <h2 className="text-base font-bold text-[var(--foreground)]">
                      {mod.title}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {mod.oneLiner}
                  </p>
                </div>

                <Link
                  href={mod.route}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 self-start sm:self-auto shrink-0"
                >
                  <span>Ir a {mod.route}</span>
                  <ExternalLink size={13} />
                </Link>
              </div>

              {/* Contenido según Pestaña */}
              <div className="p-5 space-y-6">
                {/* 1. Guía Paso a Paso */}
                {(activeTab === 'todo' || activeTab === 'howto') && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <BookOpen size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>1. Guía Paso a Paso (How-To)</span>
                    </h3>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/80 space-y-2">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Flujo Habitual Operativo:</p>
                      <ul className="space-y-2">
                        {mod.howTo.habitual.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ul>

                      {mod.howTo.secundarias.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Acciones Secundarias y Buenas Prácticas:</p>
                          <ul className="space-y-1.5 pl-1">
                            {mod.howTo.secundarias.map((sec, sIdx) => (
                              <li key={sIdx} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                                <span>{sec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Tag de Captura */}
                      <div className="mt-3 p-2.5 rounded-lg bg-blue-500/5 border border-dashed border-blue-400/30 text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <Sparkles size={14} className="shrink-0" />
                        <span>{mod.screenshotTag}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Diccionario de Campos */}
                {(activeTab === 'todo' || activeTab === 'campos') && mod.fields.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <TableIcon size={14} className="text-indigo-600 dark:text-indigo-400" />
                      <span>2. Diccionario de Campos</span>
                    </h3>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Campo</th>
                            <th className="py-2.5 px-3">Tipo</th>
                            <th className="py-2.5 px-3">Requerido</th>
                            <th className="py-2.5 px-3">Descripción / Regla de Negocio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {mod.fields.map((fld, fIdx) => (
                            <tr key={fIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-2 px-3 font-bold text-[var(--foreground)]">{fld.name}</td>
                              <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{fld.type}</td>
                              <td className="py-2 px-3">
                                {fld.required ? (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                                    Sí
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">
                                    Opcional
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{fld.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Errores Comunes y Soluciones (FAQ) */}
                {(activeTab === 'todo' || activeTab === 'faqs') && mod.faqs.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <span>3. Errores Comunes y Soluciones (Troubleshooting)</span>
                    </h3>

                    <div className="space-y-2">
                      {mod.faqs.map((faq, qIdx) => {
                        const faqKey = `${mod.id}-${qIdx}`
                        const isOpen = expandedFaqs[faqKey] ?? true

                        return (
                          <div
                            key={qIdx}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/30"
                          >
                            <button
                              onClick={() => toggleFaq(faqKey)}
                              className="w-full py-3 px-4 flex items-center justify-between text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-red-500 font-black">Problema:</span>
                                <span>{faq.question}</span>
                              </div>
                              <ChevronDown
                                size={14}
                                className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </button>

                            {isOpen && (
                              <div className="p-4 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 text-xs">
                                <div className="text-slate-500 dark:text-slate-400">
                                  <span className="font-bold text-slate-700 dark:text-slate-300">Causa probable: </span>
                                  {faq.cause}
                                </div>
                                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold">Solución recomendada: </span>
                                    {faq.solution}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer de Soporte Institucional */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-transparent border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
            <Lightbulb size={18} />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200">¿Tienes dudas operativas adicionales o requieres soporte técnico?</p>
            <p className="text-slate-500 dark:text-slate-400">Comunícate con la Coordinación Administrativa o envía una solicitud a Soporte de TI de la clínica.</p>
          </div>
        </div>

        <a
          href="/manual_procedimientos_crm_iso9001.pdf"
          download="Manual_Procedimientos_CRM_ISO9001.pdf"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--card)] hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--border)] font-bold text-slate-700 dark:text-slate-300 shrink-0 transition-colors"
        >
          <FileText size={15} />
          <span>Ver PDF Oficial</span>
        </a>
      </div>
    </div>
  )
}
