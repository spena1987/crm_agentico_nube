'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, X, Search, AlertTriangle } from 'lucide-react'
import { CAT } from './catalogos'

interface TagSelectorPopoverProps {
  catKey: string // 'antOc' | 'antGr' | 'medic' | 'complic' | 'explico' | 'valores'
  values: string[]
  onChange: (newValues: string[]) => void
  placeholder?: string
  extraItems?: string[]
  onAddExtra?: (item: string) => void
  label?: string
}

export default function TagSelectorPopover({
  catKey,
  values = [],
  onChange,
  placeholder = 'agregar',
  extraItems = [],
  onAddExtra,
  label
}: TagSelectorPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [newTagInput, setNewTagInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Recopilar todos los items del catalogo
  const catalogDefinition = CAT[catKey]

  const items = useMemo(() => {
    const list: { label: string; alert: boolean; grupo: string }[] = []
    if (catalogDefinition && catalogDefinition.grupos) {
      for (const grupo in catalogDefinition.grupos) {
        catalogDefinition.grupos[grupo].forEach(it => {
          const l = Array.isArray(it) ? it[0] : it
          const a = Array.isArray(it) && it[1] === 1
          list.push({ label: l, alert: a, grupo })
        })
      }
    }
    extraItems.forEach(l => {
      list.push({ label: l, alert: false, grupo: 'Agregados por ustedes' })
    })
    return list
  }, [catalogDefinition, extraItems])

  const isItemAlert = (tagLabel: string) => {
    const found = items.find(i => i.label === tagLabel)
    return found ? found.alert : false
  }

  // Filtrado de items por búsqueda
  const filteredGroups = useMemo(() => {
    const groups: Record<string, { label: string; alert: boolean }[]> = {}
    const q = search.toLowerCase().trim()

    items.forEach(item => {
      if (!q || item.label.toLowerCase().includes(q) || item.grupo.toLowerCase().includes(q)) {
        if (!groups[item.grupo]) groups[item.grupo] = []
        groups[item.grupo].push({ label: item.label, alert: item.alert })
      }
    })

    return groups
  }, [items, search])

  // Cerrar al hacer click afuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  const toggleItem = (itemLabel: string) => {
    const exists = values.includes(itemLabel)
    const updated = exists ? values.filter(v => v !== itemLabel) : [...values, itemLabel]
    onChange(updated)
  }

  const handleAddNew = () => {
    const val = newTagInput.trim()
    if (!val) return
    if (!values.includes(val)) {
      onChange([...values, val])
    }
    if (onAddExtra) onAddExtra(val)
    setNewTagInput('')
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Contenedor clickeable de tags */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[26px] p-1 border border-[#dde6ec] rounded bg-white hover:border-[#0e7c86] transition-colors cursor-pointer flex flex-wrap gap-1.5 items-center"
      >
        {values.length === 0 ? (
          <span className="text-[11px] text-[#728a99] italic flex items-center gap-1">
            <Plus className="w-3 h-3 text-[#0e7c86]" /> {placeholder}
          </span>
        ) : (
          values.map(val => {
            const alert = isItemAlert(val)
            return (
              <span
                key={val}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  alert
                    ? 'bg-[#fdf1e7] text-[#b4531a] border-[#f0cdb0]'
                    : 'bg-[#e4f3f4] text-[#0e7c86] border-[#c3e2e4]'
                }`}
              >
                {alert && <AlertTriangle className="w-2.5 h-2.5" />}
                {val}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onChange(values.filter(v => v !== val))
                  }}
                  className="hover:opacity-75 ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )
          })
        )}
        {values.length > 0 && (
          <span className="text-[10px] font-bold text-[#0e7c86] px-1.5 py-0.5 border border-dashed border-[#0e7c86] rounded-full bg-[#e4f3f4] hover:bg-[#c3e2e4]">
            +
          </span>
        )}
      </div>

      {/* Popover desplegable */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 mt-1 w-[330px] bg-white border border-[#dde6ec] rounded-lg shadow-2xl flex flex-col max-h-[380px] overflow-hidden text-[#16323f]"
          style={{ top: '100%', left: 0 }}
        >
          {/* Cabecera con buscador */}
          <div className="p-2 border-b border-[#eef3f6] flex items-center gap-2 bg-[#f7fafb]">
            <Search className="w-3.5 h-3.5 text-[#728a99]" />
            <input
              type="text"
              className="w-full bg-transparent text-xs outline-none"
              placeholder={`Buscar en ${label || catalogDefinition?.titulo || 'opciones'}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Lista agrupada */}
          <div className="overflow-y-auto p-2 flex-1 max-h-[250px] space-y-3">
            {Object.keys(filteredGroups).length === 0 ? (
              <div className="text-center py-4 text-xs text-[#728a99]">No se encontraron coincidencias</div>
            ) : (
              Object.keys(filteredGroups).map(grupo => (
                <div key={grupo}>
                  <div className="text-[9px] uppercase font-extrabold tracking-wider text-[#9db0bc] mb-1">
                    {grupo}
                  </div>
                  <div className="space-y-0.5">
                    {filteredGroups[grupo].map(item => {
                      const isChecked = values.includes(item.label)
                      return (
                        <label
                          key={item.label}
                          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs hover:bg-[#f7fafb] transition-colors ${
                            item.alert ? 'text-[#b4531a] font-semibold' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(item.label)}
                            className="rounded text-[#0e7c86] focus:ring-0 accent-[#0e7c86] cursor-pointer"
                          />
                          <span>{item.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pie para agregar nueva opción */}
          <div className="p-2 border-t border-[#eef3f6] bg-[#f7fafb] flex items-center gap-2">
            <input
              type="text"
              placeholder="Agregar otro..."
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddNew()
                }
              }}
              className="flex-1 text-xs border border-[#dde6ec] rounded px-2 py-1 bg-white"
            />
            <button
              type="button"
              onClick={handleAddNew}
              className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#dde6ec] rounded hover:bg-[#e4f3f4] text-[#16323f]"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs font-semibold bg-[#0e7c86] text-white rounded hover:bg-[#0a636b]"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
