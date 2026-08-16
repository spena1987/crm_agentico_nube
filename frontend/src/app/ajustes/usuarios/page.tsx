'use client'

import React, { useState, useEffect } from 'react'
import { 
  UserPlus, 
  Search, 
  Shield, 
  KeyRound, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw,
  AlertCircle,
  Users
} from 'lucide-react'

interface Role {
  id: string
  codigo: string
  nombre: string
  es_sistema: boolean
}

interface UserItem {
  id: string
  email: string
  nombre_completo: string
  rol_id: string | null
  activo: boolean
  created_at: string
  roles?: Role | null
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)

  // Formulario Crear
  const [createNombre, setCreateNombre] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRolId, setCreateRolId] = useState('')
  const [createActivo, setCreateActivo] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)

  // Formulario Editar
  const [editNombre, setEditNombre] = useState('')
  const [editRolId, setEditRolId] = useState('')
  const [editActivo, setEditActivo] = useState(true)
  const [editPassword, setEditPassword] = useState('')

  // Cargar datos
  const loadData = async () => {
    try {
      setLoading(true)
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles'),
      ])

      const usersData = await usersRes.json()
      const rolesData = await rolesRes.json()

      if (usersData.users) setUsers(usersData.users)
      if (rolesData.roles) {
        setRoles(rolesData.roles)
        if (rolesData.roles.length > 0 && !createRolId) {
          setCreateRolId(rolesData.roles[0].id)
        }
      }
    } catch (err: any) {
      console.error('Error cargando usuarios y roles:', err)
      setFeedback({ type: 'error', message: 'Error al conectar con el servidor.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Generador de contraseña segura aleatoria
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
    let pass = ''
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCreatePassword(pass)
    setShowPassword(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2000)
  }

  // Manejar Creación de Usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    setActionLoading(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: createNombre,
          email: createEmail,
          password: createPassword,
          rol_id: createRolId || null,
          activo: createActivo,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el usuario.')
      }

      setFeedback({
        type: 'success',
        message: `Usuario ${createNombre} (${createEmail}) creado exitosamente en Supabase Auth y CRM.`,
      })
      setShowCreateModal(false)
      // Resetear campos
      setCreateNombre('')
      setCreateEmail('')
      setCreatePassword('')
      await loadData()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Abrir Modal de Edición
  const openEditModal = (user: UserItem) => {
    setSelectedUser(user)
    setEditNombre(user.nombre_completo)
    setEditRolId(user.rol_id || '')
    setEditActivo(user.activo)
    setEditPassword('')
    setShowEditModal(true)
  }

  // Manejar Guardado de Edición
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setFeedback(null)
    setActionLoading(true)

    try {
      const payload: any = {
        nombre_completo: editNombre,
        rol_id: editRolId || null,
        activo: editActivo,
      }
      if (editPassword.trim()) {
        payload.password = editPassword.trim()
      }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el usuario.')
      }

      setFeedback({
        type: 'success',
        message: `Perfil de ${editNombre} actualizado correctamente.`,
      })
      setShowEditModal(false)
      setSelectedUser(null)
      await loadData()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Manejar Eliminación de Usuario
  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setFeedback(null)
    setActionLoading(true)

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el usuario.')
      }

      setFeedback({
        type: 'success',
        message: `Usuario ${selectedUser.nombre_completo} eliminado de Supabase Auth y CRM.`,
      })
      setShowDeleteModal(false)
      setSelectedUser(null)
      await loadData()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Filtrado de usuarios
  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase()
    return (
      u.nombre_completo.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.roles?.nombre || '').toLowerCase().includes(term)
    )
  })

  // Obtener color distintivo para badge de rol
  const getRoleBadgeStyle = (rolCodigo?: string) => {
    switch (rolCodigo) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      case 'medico':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      case 'recepcion':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      case 'auditor':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Acciones y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] px-4 py-2.5 rounded-2xl max-w-md w-full shadow-sm">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o perfil..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-transparent border-0 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs"
            title="Recargar usuarios"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              generateRandomPassword()
              setShowCreateModal(true)
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow flex items-center gap-2 glow-primary"
          >
            <UserPlus size={16} />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Alertas de Feedback */}
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

      {/* Tabla de Usuarios */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-xs">Cargando personal y accesos...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            <Users size={36} className="mx-auto mb-2 opacity-40" />
            No se encontraron usuarios registrados con los criterios de búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 text-[var(--secondary)] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Usuario</th>
                  <th className="py-3.5 px-4">Correo Electrónico</th>
                  <th className="py-3.5 px-4">Perfil / Rol</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4">Fecha de Alta</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredUsers.map((user) => {
                  const initials = user.nombre_completo
                    ? user.nombre_completo.substring(0, 2).toUpperCase()
                    : 'US'
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 glow-primary">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-[var(--foreground)]">{user.nombre_completo}</p>
                            <p className="text-[10px] text-[var(--secondary)]">ID: {user.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--secondary)] font-medium">
                        {user.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${getRoleBadgeStyle(
                            user.roles?.codigo
                          )}`}
                        >
                          <Shield size={12} />
                          {user.roles?.nombre || 'Sin Rol Asignado'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {user.activo ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Inactivo / Suspendido
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--secondary)]">
                        {new Date(user.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                            title="Editar usuario y permisos"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowDeleteModal(true)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-lg p-6 rounded-2xl shadow-xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-[var(--foreground)]">
                <UserPlus className="text-blue-600" size={18} />
                Dar de Alta Nuevo Usuario en CRM & Supabase
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Dra. María González"
                  value={createNombre}
                  onChange={(e) => setCreateNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="doctora.gonzalez@clinica.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Contraseña Inicial
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-bold"
                  >
                    <KeyRound size={12} /> Generar segura
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-3.5 pr-20 py-2.5 text-xs font-mono border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      title="Ver/Ocultar"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createPassword)}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      tabIndex={-1}
                      title="Copiar contraseña"
                    >
                      {copiedPassword ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Perfil / Rol Asignado
                  </label>
                  <select
                    value={createRolId}
                    onChange={(e) => setCreateRolId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Estado de la Cuenta
                  </label>
                  <select
                    value={createActivo ? 'true' : 'false'}
                    onChange={(e) => setCreateActivo(e.target.value === 'true')}
                    className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="true">Activo (Puede ingresar)</option>
                    <option value="false">Inactivo (Suspendido)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 rounded-xl text-[11px] text-blue-700 dark:text-blue-300">
                💡 El usuario se creará en <strong>Supabase Auth</strong> con correo confirmado automáticamente y podrá iniciar sesión de inmediato en el CRM con estas credenciales.
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 glow-primary disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  <span>Crear Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-lg p-6 rounded-2xl shadow-xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-[var(--foreground)]">
                <Edit className="text-blue-600" size={18} />
                Editar Perfil y Permisos: {selectedUser.email}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Perfil / Rol
                  </label>
                  <select
                    value={editRolId}
                    onChange={(e) => setEditRolId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Estado
                  </label>
                  <select
                    value={editActivo ? 'true' : 'false'}
                    onChange={(e) => setEditActivo(e.target.value === 'true')}
                    className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo (Suspendido)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Restablecer Contraseña (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Dejar en blanco para mantener la actual"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all"
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 glow-primary disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--border)] w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-red-600 flex items-center gap-2">
              <Trash2 size={18} />
              ¿Eliminar usuario definitivamente?
            </h2>

            <p className="text-xs text-[var(--secondary)] leading-relaxed">
              Estás a punto de dar de baja a <strong>{selectedUser.nombre_completo}</strong> ({selectedUser.email}).
              Esta acción eliminará su cuenta tanto en <strong>Supabase Auth</strong> como en el CRM y no podrá volver a iniciar sesión.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
