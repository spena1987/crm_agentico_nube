'use client'

import React, { useState, useEffect } from 'react'
import { SYSTEM_MODULES, ModuleDefinition } from '@/config/modules'
import { 
  ShieldCheck, 
  Plus, 
  Check, 
  Trash2, 
  Edit3, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Lock,
  RefreshCw,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Settings
} from 'lucide-react'

// Mapa de iconos dinámicos
const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Settings,
}

interface RolPermiso {
  id?: string
  modulo_codigo: string
  accion: string
  permitido: boolean
}

interface RoleItem {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  es_sistema: boolean
  rol_permisos?: RolPermiso[]
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [currentPerms, setCurrentPerms] = useState<Record<string, Record<string, boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [copyFromRoleId, setCopyFromRoleId] = useState('')

  // Cargar roles y permisos
  const loadRoles = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/roles')
      const data = await res.json()

      if (data.roles) {
        setRoles(data.roles)
        // Seleccionar por defecto el primer rol si no hay uno seleccionado
        const activeId = selectedRoleId || data.roles[0]?.id
        if (activeId) {
          setSelectedRoleId(activeId)
          populatePermsMap(data.roles.find((r: RoleItem) => r.id === activeId))
        }
      }
    } catch (err: any) {
      console.error('Error al cargar roles:', err)
      setFeedback({ type: 'error', message: 'Error al conectar con el servidor.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  // Inicializar mapa de permisos para el rol seleccionado
  const populatePermsMap = (role?: RoleItem) => {
    const map: Record<string, Record<string, boolean>> = {}

    // Inicializar todos los módulos y acciones del sistema en false
    SYSTEM_MODULES.forEach((mod) => {
      map[mod.code] = {}
      mod.actions.forEach((act) => {
        map[mod.code][act.code] = false
      })
    })

    // Si el rol es admin, todos son true
    if (role?.codigo === 'admin') {
      SYSTEM_MODULES.forEach((mod) => {
        mod.actions.forEach((act) => {
          map[mod.code][act.code] = true
        })
      })
    } else if (role?.rol_permisos) {
      // Mapear los permisos guardados
      role.rol_permisos.forEach((p) => {
        if (map[p.modulo_codigo]) {
          map[p.modulo_codigo][p.accion] = p.permitido
        }
      })
    }

    setCurrentPerms(map)
  }

  // Al cambiar de rol seleccionado
  const handleSelectRole = (roleId: string) => {
    setSelectedRoleId(roleId)
    const role = roles.find((r) => r.id === roleId)
    populatePermsMap(role)
    setFeedback(null)
  }

  // Alternar checkbox individual
  const togglePermission = (modCode: string, actCode: string) => {
    const activeRole = roles.find((r) => r.id === selectedRoleId)
    if (activeRole?.codigo === 'admin') return // Admin siempre tiene acceso total

    setCurrentPerms((prev) => {
      const modPerms = { ...prev[modCode] }
      const nextVal = !modPerms[actCode]
      modPerms[actCode] = nextVal

      // Si activa una acción de escritura/edición, activar también 'ver' automáticamente
      if (nextVal && actCode !== 'ver') {
        modPerms['ver'] = true
      }
      // Si desactiva 'ver', desactivar todas las demás acciones de ese módulo
      if (!nextVal && actCode === 'ver') {
        Object.keys(modPerms).forEach((k) => {
          modPerms[k] = false
        })
      }

      return {
        ...prev,
        [modCode]: modPerms,
      }
    })
  }

  // Alternar todas las acciones de un módulo
  const toggleAllModule = (mod: ModuleDefinition) => {
    const activeRole = roles.find((r) => r.id === selectedRoleId)
    if (activeRole?.codigo === 'admin') return

    const modPerms = currentPerms[mod.code] || {}
    const allChecked = mod.actions.every((a) => modPerms[a.code])

    setCurrentPerms((prev) => {
      const nextModPerms: Record<string, boolean> = {}
      mod.actions.forEach((a) => {
        nextModPerms[a.code] = !allChecked
      })
      return {
        ...prev,
        [mod.code]: nextModPerms,
      }
    })
  }

  // Guardar cambios de permisos
  const handleSavePermissions = async () => {
    if (!selectedRoleId) return
    setSaving(true)
    setFeedback(null)

    try {
      // Transformar el mapa en array de permisos planos
      const flatPerms: { modulo_codigo: string; accion: string; permitido: boolean }[] = []
      Object.entries(currentPerms).forEach(([modCode, acts]) => {
        Object.entries(acts).forEach(([actCode, allowed]) => {
          if (allowed) {
            flatPerms.push({
              modulo_codigo: modCode,
              accion: actCode,
              permitido: true,
            })
          }
        })
      })

      const res = await fetch(`/api/admin/roles/${selectedRoleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permisos: flatPerms }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar permisos.')
      }

      setFeedback({
        type: 'success',
        message: 'Matriz de permisos actualizada y guardada con éxito.',
      })
      await loadRoles()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Crear nuevo rol
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) return
    setSaving(true)
    setFeedback(null)

    try {
      // Copiar permisos de rol base si se seleccionó
      let initialPerms: any[] = []
      if (copyFromRoleId) {
        const sourceRole = roles.find((r) => r.id === copyFromRoleId)
        if (sourceRole?.rol_permisos) {
          initialPerms = sourceRole.rol_permisos.filter((p) => p.permitido)
        }
      }

      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newRoleName.trim(),
          descripcion: newRoleDesc.trim(),
          permisos: initialPerms,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el rol.')
      }

      setFeedback({
        type: 'success',
        message: `Perfil ${newRoleName} creado exitosamente.`,
      })
      setShowCreateModal(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setCopyFromRoleId('')
      await loadRoles()
      setSelectedRoleId(data.role.id)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Eliminar rol personalizado
  const handleDeleteRole = async () => {
    if (!selectedRoleId) return
    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch(`/api/admin/roles/${selectedRoleId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el rol.')
      }

      setFeedback({
        type: 'success',
        message: 'Rol personalizado eliminado correctamente.',
      })
      setShowDeleteModal(false)
      setSelectedRoleId(null)
      await loadRoles()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  const activeRole = roles.find((r) => r.id === selectedRoleId)

  return (
    <div className="space-y-6">
      {/* Selector de Roles en Tarjetas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--secondary)] flex items-center gap-1.5">
            <Layers size={14} />
            Perfiles de Acceso Disponibles ({roles.length})
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 glow-primary"
          >
            <Plus size={14} />
            <span>Crear Nuevo Perfil</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {roles.map((role) => {
            const isSelected = role.id === selectedRoleId
            return (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role.id)}
                className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-600/10 border-blue-600 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-[var(--card)] border-[var(--border)] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[var(--foreground)]">{role.nombre}</span>
                    {role.es_sistema ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-0.5">
                        <Lock size={9} /> Sistema
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600">
                        Personalizado
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--secondary)] line-clamp-2 leading-relaxed">
                    {role.descripcion || 'Sin descripción detallada.'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-[var(--border)] flex items-center justify-between text-[10px]">
                  <span className="text-blue-600 font-bold">
                    {isSelected ? '✓ Seleccionado' : 'Hacer clic para editar'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Matriz de Permisos del Rol Seleccionado */}
      {activeRole && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-600" />
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  Matriz de Permisos: {activeRole.nombre}
                </h3>
              </div>
              <p className="text-xs text-[var(--secondary)] mt-1">
                {activeRole.codigo === 'admin'
                  ? 'El Administrador General posee permiso total e irrevocable sobre todas las acciones y módulos del CRM.'
                  : 'Marca o desmarca las acciones que los usuarios con este rol podrán ejecutar en cada módulo del sistema.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!activeRole.es_sistema && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-2 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Eliminar Rol</span>
                </button>
              )}

              {activeRole.codigo !== 'admin' && (
                <button
                  onClick={handleSavePermissions}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2 glow-primary disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Guardar Permisos</span>
                </button>
              )}
            </div>
          </div>

          {/* Cuadrícula de Módulos */}
          <div className="space-y-4">
            {SYSTEM_MODULES.map((mod) => {
              const Icon = ICON_MAP[mod.icon] || LayoutDashboard
              const modPerms = currentPerms[mod.code] || {}
              const allChecked = mod.actions.every((a) => modPerms[a.code])
              const someChecked = mod.actions.some((a) => modPerms[a.code])

              return (
                <div
                  key={mod.code}
                  className="border border-[var(--border)] rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  {/* Encabezado del Módulo */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-[var(--foreground)]">{mod.name}</h4>
                        <p className="text-[11px] text-[var(--secondary)]">{mod.description}</p>
                      </div>
                    </div>

                    {activeRole.codigo !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => toggleAllModule(mod)}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        {allChecked ? 'Desmarcar todo' : 'Seleccionar todo'}
                      </button>
                    )}
                  </div>

                  {/* Checkboxes de Acciones Granulares */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--border)]">
                    {mod.actions.map((act) => {
                      const isAllowed = modPerms[act.code] || activeRole.codigo === 'admin'
                      return (
                        <label
                          key={act.code}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                            isAllowed
                              ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50'
                              : 'bg-[var(--card)] border-[var(--border)] opacity-70 hover:opacity-100'
                          } ${activeRole.codigo === 'admin' ? 'cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            disabled={activeRole.codigo === 'admin'}
                            onChange={() => togglePermission(mod.code, act.code)}
                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <div>
                            <p className="text-xs font-bold leading-tight text-[var(--foreground)]">
                              {act.label}
                            </p>
                            {act.description && (
                              <p className="text-[10px] text-[var(--secondary)] mt-0.5 leading-snug">
                                {act.description}
                              </p>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal: Crear Rol */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-[var(--foreground)]">
                <Plus className="text-blue-600" size={18} />
                Crear Nuevo Perfil / Rol
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nombre del Rol
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Enfermero / Coordinador Clínico"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe las responsabilidades y nivel de acceso..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Copiar Permisos Iniciales de:
                </label>
                <select
                  value={copyFromRoleId}
                  onChange={(e) => setCopyFromRoleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Comenzar con permisos en blanco</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      Copiar de {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 glow-primary disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  <span>Crear Rol</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación de Rol */}
      {showDeleteModal && activeRole && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-red-600 flex items-center gap-2">
              <Trash2 size={18} />
              ¿Eliminar rol &quot;{activeRole.nombre}&quot;?
            </h2>

            <p className="text-xs text-[var(--secondary)] leading-relaxed">
              Esta acción eliminará de forma permanente el perfil y toda su configuración de permisos.
              No se podrá eliminar si existen usuarios que lo tengan asignado actualmente.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                disabled={saving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span>Eliminar Rol</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
