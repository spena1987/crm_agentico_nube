'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
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
  Users,
  Stethoscope,
  X,
  Phone,
  AlertTriangle,
  AtSign,
  Clock,
  Share2,
  Mail,
} from 'lucide-react'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phoneUtils'

interface Role {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  es_sistema: boolean
}

interface UserItem {
  id: string
  email: string
  username?: string | null
  nombre_completo: string
  rol_id: string | null
  activo: boolean
  telefono?: string | null
  geclisa_pre_id?: number | null
  geclisa_matricula?: string | null
  geclisa_prestador_nombre?: string | null
  last_sign_in_at?: string | null
  created_at: string
  updated_at?: string
  roles?: Role | null
}

interface PrestadorGeclisa {
  pre_id: number
  nombre: string
  matricula?: string
  especialidad?: string
}

function normalizeUsernameInput(val: string): string {
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
}

function suggestUsernameFromName(fullName: string): string {
  const clean = fullName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(dr|dra|lic|tec|sr|sra)\.?\s+/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()

  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 20)
  return `${parts[0].charAt(0)}${parts[parts.length - 1]}`.slice(0, 20)
}

function isInternalSyntheticEmail(email?: string | null): boolean {
  if (!email) return true
  return email.endsWith('@interno.centrovision.local')
}

function formatLastSignIn(isoDate?: string | null): { label: string; isRecent: boolean; never: boolean } {
  if (!isoDate) return { label: 'Sin ingresos', isRecent: false, never: true }
  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return { label: 'Sin ingresos', isRecent: false, never: true }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const isToday = date.toDateString() === now.toDateString()

  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) {
    return { label: `Hoy ${timeStr}`, isRecent: true, never: false }
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return { label: `Ayer ${timeStr}`, isRecent: true, never: false }
  }

  const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return { label: `${dateStr} ${timeStr}`, isRecent: diffHours < 72, never: false }
}

export default function UsuariosPage() {
  const { user } = useAuth()
  const { refreshPermissions } = usePermissions()
  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [prestadores, setPrestadores] = useState<PrestadorGeclisa[]>([])
  const [cargandoPrestadores, setCargandoPrestadores] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
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
  const [createUsername, setCreateUsername] = useState('')
  const [createUsernameTouched, setCreateUsernameTouched] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRolId, setCreateRolId] = useState('')
  const [createActivo, setCreateActivo] = useState(true)
  const [createTelefono, setCreateTelefono] = useState('')
  const [createPreId, setCreatePreId] = useState<number | null>(null)
  const [createMatricula, setCreateMatricula] = useState('')
  const [createPrestadorNombre, setCreatePrestadorNombre] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [copiedShareCard, setCopiedShareCard] = useState(false)

  // Formulario Editar
  const [editNombre, setEditNombre] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRolId, setEditRolId] = useState('')
  const [editActivo, setEditActivo] = useState(true)
  const [editTelefono, setEditTelefono] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [copiedEditPassword, setCopiedEditPassword] = useState(false)
  const [copiedEditShareCard, setCopiedEditShareCard] = useState(false)
  const [editPreId, setEditPreId] = useState<number | null>(null)
  const [editMatricula, setEditMatricula] = useState('')
  const [editPrestadorNombre, setEditPrestadorNombre] = useState('')

  // Búsqueda interna para Combobox de Prestadores
  const [searchPreCreate, setSearchPreCreate] = useState('')
  const [dropdownOpenCreate, setDropdownOpenCreate] = useState(false)
  const [searchPreEdit, setSearchPreEdit] = useState('')
  const [dropdownOpenEdit, setDropdownOpenEdit] = useState(false)

  // Obtener headers con token Bearer actual de Supabase
  const getHeaders = async (contentType = true) => {
    const headers: Record<string, string> = {}
    if (contentType) headers['Content-Type'] = 'application/json'
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`
      }
    } catch {
      // ignore
    }
    return headers
  }

  // Cargar datos principales
  const loadData = async () => {
    try {
      setLoading(true)
      const headers = await getHeaders(false)
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/roles', { headers }),
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

  // Cargar catálogo de prestadores de Geclisa mediante Proxy Interno de Next.js
  const cargarPrestadores = async (termino = '') => {
    try {
      setCargandoPrestadores(true)
      const headers = await getHeaders(false)
      const res = await fetch(`/api/admin/geclisa-prestadores?query=${encodeURIComponent(termino)}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setPrestadores(data.prestadores || [])
      }
    } catch (e) {
      console.error('Error cargando prestadores:', e)
    } finally {
      setCargandoPrestadores(false)
    }
  }

  useEffect(() => {
    loadData()
    cargarPrestadores()
  }, [])

  // Generador de contraseña segura aleatoria
  const generateRandomPassword = (forEdit = false) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
    let pass = ''
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    if (forEdit) {
      setEditPassword(pass)
      setShowEditPassword(true)
    } else {
      setCreatePassword(pass)
      setShowPassword(true)
    }
  }

  const copyToClipboard = (text: string, isEdit = false) => {
    navigator.clipboard.writeText(text)
    if (isEdit) {
      setCopiedEditPassword(true)
      setTimeout(() => setCopiedEditPassword(false), 2000)
    } else {
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 2000)
    }
  }

  const copyCredentialsCard = (
    nombre: string,
    usernameVal: string,
    emailVal: string,
    passwordVal: string,
    isEdit = false
  ) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crm-agentico-nube.vercel.app'
    const realEmail = !isInternalSyntheticEmail(emailVal) ? emailVal.trim() : ''
    const lines = [
      `🏥 *Credenciales de Acceso — MedCRM Clínico*`,
      `👤 Nombre: ${nombre || 'Personal'}`,
      `🆔 Usuario: *${usernameVal}*`,
      ...(realEmail ? [`📧 Correo alternativo: ${realEmail}`] : []),
      ...(passwordVal ? [`🔑 Contraseña: *${passwordVal}*`] : []),
      `🔗 Ingreso: ${origin}/login`,
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    if (isEdit) {
      setCopiedEditShareCard(true)
      setTimeout(() => setCopiedEditShareCard(false), 2500)
    } else {
      setCopiedShareCard(true)
      setTimeout(() => setCopiedShareCard(false), 2500)
    }
  }

  // Verificar si el username sugerido o escrito ya existe
  const createUsernameConflict = useMemo(() => {
    if (!createUsername.trim()) return null
    const clean = createUsername.trim().toLowerCase()
    return users.find((u) => u.username?.toLowerCase() === clean) || null
  }, [users, createUsername])

  const editUsernameConflict = useMemo(() => {
    if (!editUsername.trim() || !selectedUser) return null
    const clean = editUsername.trim().toLowerCase()
    return users.find((u) => u.id !== selectedUser.id && u.username?.toLowerCase() === clean) || null
  }, [users, editUsername, selectedUser])

  // Manejar Creación de Usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (!createUsername.trim() || createUsername.trim().length < 2) {
      setFeedback({ type: 'error', message: 'Debes definir un nombre de usuario de al menos 2 caracteres.' })
      return
    }

    setActionLoading(true)

    try {
      const headers = await getHeaders(true)
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nombre_completo: createNombre,
          username: createUsername.trim().toLowerCase(),
          email: createEmail.trim() || null,
          password: createPassword,
          rol_id: createRolId || null,
          activo: createActivo,
          telefono: createTelefono.trim() ? normalizePhoneNumber(createTelefono) : null,
          geclisa_pre_id: createPreId,
          geclisa_matricula: createMatricula,
          geclisa_prestador_nombre: createPrestadorNombre,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el usuario.')
      }

      setFeedback({
        type: 'success',
        message: `Usuario ${createNombre} (@${data.user?.username || createUsername}) creado exitosamente.`,
      })
      setShowCreateModal(false)
      // Resetear campos
      setCreateNombre('')
      setCreateUsername('')
      setCreateUsernameTouched(false)
      setCreateEmail('')
      setCreatePassword('')
      setCreateTelefono('')
      setCreatePreId(null)
      setCreateMatricula('')
      setCreatePrestadorNombre('')
      setSearchPreCreate('')
      await loadData()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  // Abrir Modal de Edición
  const openEditModal = (u: UserItem) => {
    setSelectedUser(u)
    setEditNombre(u.nombre_completo)
    setEditUsername(u.username || suggestUsernameFromName(u.nombre_completo))
    setEditEmail(isInternalSyntheticEmail(u.email) ? '' : u.email)
    setEditRolId(u.rol_id || '')
    setEditActivo(u.activo)
    setEditTelefono(u.telefono || '')
    setEditPassword('')
    setShowEditPassword(false)
    setEditPreId(u.geclisa_pre_id || null)
    setEditMatricula(u.geclisa_matricula || '')
    setEditPrestadorNombre(u.geclisa_prestador_nombre || '')
    setSearchPreEdit('')
    setDropdownOpenEdit(false)
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
        username: editUsername.trim().toLowerCase(),
        email: editEmail.trim(),
        rol_id: editRolId || null,
        activo: editActivo,
        telefono: editTelefono.trim() ? normalizePhoneNumber(editTelefono) : null,
        geclisa_pre_id: editPreId,
        geclisa_matricula: editMatricula,
        geclisa_prestador_nombre: editPrestadorNombre,
      }
      if (editPassword.trim()) {
        payload.password = editPassword.trim()
      }

      const headers = await getHeaders(true)
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el usuario.')
      }

      setFeedback({
        type: 'success',
        message: `Perfil de ${editNombre} (@${data.user?.username || editUsername}) actualizado correctamente.${
          editPassword.trim() ? ' La contraseña también fue renovada.' : ''
        }`,
      })
      setShowEditModal(false)
      if (selectedUser.id === user?.id) {
        await refreshPermissions()
      }
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
      const headers = await getHeaders(false)
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el usuario.')
      }

      setFeedback({
        type: 'success',
        message: `Usuario ${selectedUser.nombre_completo} eliminado correctamente.`,
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

  // Filtrado de usuarios por búsqueda y filtro rápido de rol/estado
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter === 'INACTIVE' && u.activo) return false
      if (roleFilter !== 'ALL' && roleFilter !== 'INACTIVE' && u.rol_id !== roleFilter) return false

      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      return (
        u.nombre_completo?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        (!isInternalSyntheticEmail(u.email) && u.email?.toLowerCase().includes(q)) ||
        u.roles?.nombre?.toLowerCase().includes(q) ||
        u.geclisa_prestador_nombre?.toLowerCase().includes(q) ||
        u.geclisa_matricula?.includes(q)
      )
    })
  }, [users, search, roleFilter])

  // Filtrado de prestadores para modal de creación
  const prestadoresFiltradosCreate = useMemo(() => {
    if (!searchPreCreate.trim()) return prestadores
    const q = searchPreCreate.toLowerCase().trim()
    return prestadores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.matricula && p.matricula.includes(q)) ||
        (p.especialidad && p.especialidad.toLowerCase().includes(q))
    )
  }, [prestadores, searchPreCreate])

  // Filtrado de prestadores para modal de edición
  const prestadoresFiltradosEdit = useMemo(() => {
    if (!searchPreEdit.trim()) return prestadores
    const q = searchPreEdit.toLowerCase().trim()
    return prestadores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.matricula && p.matricula.includes(q)) ||
        (p.especialidad && p.especialidad.toLowerCase().includes(q))
    )
  }, [prestadores, searchPreEdit])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">Gestión de Usuarios & Accesos</h1>
              <p className="text-xs text-[var(--secondary)]">
                Administra usuarios con ingreso por <strong>@usuario</strong> o correo, asigna perfiles RBAC y vincula prestadores de Geclisa.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setCreateNombre('')
            setCreateUsername('')
            setCreateUsernameTouched(false)
            setCreateEmail('')
            setShowCreateModal(true)
            generateRandomPassword(false)
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md glow-primary"
        >
          <UserPlus size={16} />
          <span>Crear Usuario</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border animate-fade-in ${
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

      {/* Barra de Búsqueda, Filtros por Rol y Estadísticas */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, @usuario, email, rol o matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--secondary)]">
            <span>
              Total: <strong>{users.length}</strong> usuarios
            </span>
            <span>•</span>
            <span>
              Activos:{' '}
              <strong className="text-emerald-600">
                {users.filter((u) => u.activo).length}
              </strong>
            </span>
            <span>•</span>
            <span>
              Con Prestador:{' '}
              <strong className="text-blue-600">
                {users.filter((u) => u.geclisa_pre_id).length}
              </strong>
            </span>
          </div>
        </div>

        {/* Píldoras de Filtro Rápido por Rol */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border ${
              roleFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-[var(--card)] text-[var(--secondary)] border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Todos ({users.length})
          </button>
          {roles.map((r) => {
            const count = users.filter((u) => u.rol_id === r.id).length
            if (count === 0) return null
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleFilter(r.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border ${
                  roleFilter === r.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-[var(--card)] text-[var(--secondary)] border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {r.nombre} ({count})
              </button>
            )
          })}
          {users.some((u) => !u.activo) && (
            <button
              type="button"
              onClick={() => setRoleFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border ${
                roleFilter === 'INACTIVE'
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-[var(--card)] text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30'
              }`}
            >
              Suspendidos ({users.filter((u) => !u.activo).length})
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={28} className="animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Cargando usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-1">
            <Users size={32} className="mx-auto opacity-40 mb-2" />
            <p className="text-sm font-semibold">No se encontraron usuarios</p>
            <p className="text-xs text-[var(--secondary)]">
              {search || roleFilter !== 'ALL'
                ? 'Intenta cambiar el filtro o término de búsqueda.'
                : 'Crea el primer usuario haciendo clic arriba.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-slate-50/50 dark:bg-slate-800/30 text-[11px] uppercase tracking-wider font-bold text-[var(--secondary)]">
                  <th className="py-3 px-4">Personal</th>
                  <th className="py-3 px-4">Login (Usuario / Email)</th>
                  <th className="py-3 px-4">Rol / Permisos</th>
                  <th className="py-3 px-4">Prestador Geclisa</th>
                  <th className="py-3 px-4">WhatsApp / Guardia</th>
                  <th className="py-3 px-4">Último Acceso</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === user?.id
                  const isSynthetic = isInternalSyntheticEmail(u.email)
                  const signInInfo = formatLastSignIn(u.last_sign_in_at)

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                            {u.nombre_completo.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-[var(--foreground)]">{u.nombre_completo}</p>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  Tú
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {u.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          {u.username ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                              <AtSign size={12} className="shrink-0" />
                              <span>{u.username}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sin usuario</span>
                          )}
                          {isSynthetic ? (
                            <span className="text-[10px] text-slate-400 italic">
                              Cuenta de puesto (sin email externo)
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--secondary)] font-mono truncate max-w-[210px]" title={u.email}>
                              {u.email}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {u.roles ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Shield size={12} className="text-indigo-600" />
                            <span>{u.roles.nombre}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Sin rol asignado</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {u.geclisa_prestador_nombre ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Stethoscope size={13} className="text-blue-600 shrink-0" />
                            <span>{u.geclisa_prestador_nombre}</span>
                            {u.geclisa_matricula && (
                              <span className="text-[10px] opacity-75 font-mono">({u.geclisa_matricula})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Acceso General</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {u.telefono ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                            <Phone size={12} className="text-emerald-600 shrink-0" />
                            <span>{formatPhoneDisplay(u.telefono)}</span>
                          </div>
                        ) : u.roles?.codigo === 'medico' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                            title="Sin teléfono de guardia: No podrá recibir avisos de urgencia postquirúrgica por WhatsApp"
                          >
                            <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                            <span>Sin WhatsApp de guardia</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No configurado</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Clock
                            size={12}
                            className={
                              signInInfo.never
                                ? 'text-slate-300 dark:text-slate-600'
                                : signInInfo.isRecent
                                ? 'text-emerald-500'
                                : 'text-slate-400'
                            }
                          />
                          <span
                            className={
                              signInInfo.never
                                ? 'text-slate-400 italic'
                                : signInInfo.isRecent
                                ? 'font-semibold text-[var(--foreground)]'
                                : 'text-[var(--secondary)]'
                            }
                          >
                            {signInInfo.label}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {u.activo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                            Inactivo
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                            title="Editar usuario, credenciales o prestador"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            disabled={isSelf}
                            onClick={() => {
                              if (isSelf) return
                              setSelectedUser(u)
                              setShowDeleteModal(true)
                            }}
                            className={`p-1.5 rounded-lg transition-all ${
                              isSelf
                                ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                : 'text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800'
                            }`}
                            title={isSelf ? 'No puedes eliminar tu propia cuenta activa' : 'Eliminar usuario'}
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

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)]">Crear Nuevo Usuario</h3>
                  <p className="text-[11px] text-[var(--secondary)]">
                    Habilita el ingreso por nombre de usuario y/o correo electrónico
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nombre Completo / Puesto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Dr. Juan Pérez o Cabina de Estudios"
                  value={createNombre}
                  onChange={(e) => {
                    const val = e.target.value
                    setCreateNombre(val)
                    if (!createUsernameTouched) {
                      setCreateUsername(suggestUsernameFromName(val))
                    }
                  }}
                  className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nombre de Usuario (Login) *
                  </label>
                  <div className="relative">
                    <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      placeholder="ej: jperez o quirofano"
                      value={createUsername}
                      onChange={(e) => {
                        setCreateUsernameTouched(true)
                        setCreateUsername(normalizeUsernameInput(e.target.value))
                      }}
                      className={`w-full pl-8 pr-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 font-mono font-bold focus:outline-none focus:ring-2 ${
                        createUsernameConflict
                          ? 'border-red-400 focus:ring-red-500/20'
                          : 'border-[var(--border)] focus:ring-blue-500/20'
                      }`}
                    />
                  </div>
                  {createUsernameConflict ? (
                    <p className="text-[10px] text-red-500 mt-1 font-semibold">
                      Ya en uso por {createUsernameConflict.nombre_completo}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Podrá iniciar sesión escribiendo solo <strong>{createUsername || 'usuario'}</strong>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Correo Electrónico <span className="text-[10px] font-normal lowercase">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      placeholder="usuario@centrovision.com.ar"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Si es un puesto sin mail propio, déjalo en blanco.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Contraseña Inicial *
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => generateRandomPassword(false)}
                      className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <KeyRound size={12} />
                      <span>Generar Segura</span>
                    </button>
                    {createUsername && createPassword && (
                      <button
                        type="button"
                        onClick={() =>
                          copyCredentialsCard(createNombre, createUsername, createEmail, createPassword, false)
                        }
                        className="text-[11px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                        title="Copiar mensaje listo para pegar en WhatsApp"
                      >
                        {copiedShareCard ? <Check size={12} /> : <Share2 size={12} />}
                        <span>{copiedShareCard ? '¡Ficha Copiada!' : 'Copiar para WhatsApp'}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="w-full pl-3.5 pr-20 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
                      onClick={() => copyToClipboard(createPassword, false)}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      tabIndex={-1}
                      title="Copiar contraseña"
                    >
                      {copiedPassword ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Teléfono Móvil / WhatsApp de Alertas Quirúrgicas */}
              {(() => {
                const selectedRole = roles.find((r) => r.id === createRolId)
                const isMedico = selectedRole?.codigo === 'medico'
                return (
                  <div
                    className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                      isMedico
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label
                        className={`block text-xs font-bold uppercase flex items-center gap-1.5 ${
                          isMedico ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        <Phone size={14} className={isMedico ? 'text-emerald-600' : 'text-slate-400'} />
                        <span>Teléfono Móvil (WhatsApp)</span>
                        {isMedico && (
                          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white tracking-wide">
                            GUARDIA QX
                          </span>
                        )}
                      </label>
                    </div>

                    <input
                      type="text"
                      placeholder="Ej: +54 9 261 555-1234 o 5492615551234"
                      value={createTelefono}
                      onChange={(e) => setCreateTelefono(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                    />

                    {createTelefono.trim() ? (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                        <CheckCircle2 size={12} />
                        <span>
                          WhatsApp: <strong>{formatPhoneDisplay(createTelefono)}</strong> (
                          {normalizePhoneNumber(createTelefono)})
                        </span>
                      </p>
                    ) : isMedico ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>
                          Recomendado: El bot enviará alertas automáticas por WhatsApp a este número ante signos de
                          alarma de sus pacientes.
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Número con código de país para notificaciones WhatsApp (opcional).
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* Selector Buscable de Prestador Geclisa */}
              <div className="p-3.5 bg-blue-50/40 dark:bg-slate-800/60 border border-blue-200/60 dark:border-slate-700 rounded-xl space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase flex items-center gap-1.5">
                    <Stethoscope size={14} className="text-blue-600" /> Prestador Geclisa por Defecto
                  </label>
                  <button
                    type="button"
                    onClick={() => cargarPrestadores('')}
                    disabled={cargandoPrestadores}
                    className="text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1 font-semibold"
                    title="Recargar catálogo oficial desde Geclisa"
                  >
                    <RefreshCw size={11} className={cargandoPrestadores ? 'animate-spin' : ''} />
                    <span>Actualizar</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Asigna el prestador para precargar automáticamente su agenda de turnos en el CRM.
                </p>

                {createPreId ? (
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2">
                      <Stethoscope size={16} className="text-blue-600" />
                      <div>
                        <p className="text-xs font-bold text-[var(--foreground)]">{createPrestadorNombre}</p>
                        <p className="text-[10px] text-slate-500">
                          Matrícula: <strong>{createMatricula || 'S/N'}</strong> (ID: {createPreId})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatePreId(null)
                        setCreateMatricula('')
                        setCreatePrestadorNombre('')
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg text-xs font-semibold flex items-center gap-1"
                      title="Quitar prestador"
                    >
                      <X size={14} />
                      <span>Quitar</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar médico o técnico por nombre o matrícula..."
                        value={searchPreCreate}
                        onFocus={() => setDropdownOpenCreate(true)}
                        onChange={(e) => {
                          setSearchPreCreate(e.target.value)
                          setDropdownOpenCreate(true)
                        }}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-[var(--border)] rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {dropdownOpenCreate && (
                      <div className="border border-[var(--border)] rounded-xl max-h-48 overflow-y-auto bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/60 shadow-lg">
                        {cargandoPrestadores ? (
                          <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin text-blue-600" />
                            <span>Cargando catálogo...</span>
                          </div>
                        ) : prestadoresFiltradosCreate.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No se encontraron prestadores
                          </div>
                        ) : (
                          prestadoresFiltradosCreate.map((p) => (
                            <button
                              key={p.pre_id}
                              type="button"
                              onClick={() => {
                                setCreatePreId(p.pre_id)
                                setCreateMatricula(p.matricula || '')
                                setCreatePrestadorNombre(p.nombre || '')
                                setDropdownOpenCreate(false)
                                setSearchPreCreate('')
                              }}
                              className="w-full text-left p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-[var(--foreground)]">{p.nombre}</p>
                                  {p.especialidad?.toUpperCase().includes('TECNIC') && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      TÉCNICO
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  {p.especialidad || 'Médico'} • Mat: {p.matricula || 'S/N'}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-blue-600 font-bold">
                                #{p.pre_id}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                  disabled={actionLoading || Boolean(createUsernameConflict)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 glow-primary disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  <span>Crear Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                  <Edit size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)]">Editar Perfil y Credenciales</h3>
                  <p className="text-[11px] text-[var(--secondary)] font-mono">
                    @{selectedUser.username || 'sin-usuario'} •{' '}
                    {isInternalSyntheticEmail(selectedUser.email) ? 'Sin email externo' : selectedUser.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nombre Completo / Puesto *
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Nombre de Usuario (Login) *
                  </label>
                  <div className="relative">
                    <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={editUsername}
                      onChange={(e) => setEditUsername(normalizeUsernameInput(e.target.value))}
                      className={`w-full pl-8 pr-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 font-mono font-bold focus:outline-none focus:ring-2 ${
                        editUsernameConflict
                          ? 'border-red-400 focus:ring-red-500/20'
                          : 'border-[var(--border)] focus:ring-blue-500/20'
                      }`}
                    />
                  </div>
                  {editUsernameConflict ? (
                    <p className="text-[10px] text-red-500 mt-1 font-semibold">
                      Ya en uso por {editUsernameConflict.nombre_completo}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Identificador corto para iniciar sesión.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Correo Electrónico <span className="text-[10px] font-normal lowercase">(Editable)</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      placeholder="Sin correo externo (solo @usuario)"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Actualiza el correo real o déjalo vacío si es cuenta interna.
                  </p>
                </div>
              </div>

              {/* Selector Buscable de Prestador Geclisa en Edición */}
              <div className="p-3.5 bg-blue-50/40 dark:bg-slate-800/60 border border-blue-200/60 dark:border-slate-700 rounded-xl space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase flex items-center gap-1.5">
                    <Stethoscope size={14} className="text-blue-600" /> Prestador Geclisa Asignado
                  </label>
                  <button
                    type="button"
                    onClick={() => cargarPrestadores('')}
                    disabled={cargandoPrestadores}
                    className="text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1 font-semibold"
                    title="Recargar catálogo oficial desde Geclisa"
                  >
                    <RefreshCw size={11} className={cargandoPrestadores ? 'animate-spin' : ''} />
                    <span>Actualizar</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Asigna la matrícula y prestador de Geclisa para precargar su agenda en el CRM.
                </p>

                {editPreId ? (
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2">
                      <Stethoscope size={16} className="text-blue-600" />
                      <div>
                        <p className="text-xs font-bold text-[var(--foreground)]">{editPrestadorNombre}</p>
                        <p className="text-[10px] text-slate-500">
                          Matrícula: <strong>{editMatricula || 'S/N'}</strong> (ID: {editPreId})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditPreId(null)
                        setEditMatricula('')
                        setEditPrestadorNombre('')
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg text-xs font-semibold flex items-center gap-1"
                      title="Quitar prestador"
                    >
                      <X size={14} />
                      <span>Quitar</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar médico o técnico por nombre o matrícula..."
                        value={searchPreEdit}
                        onFocus={() => setDropdownOpenEdit(true)}
                        onChange={(e) => {
                          setSearchPreEdit(e.target.value)
                          setDropdownOpenEdit(true)
                        }}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-[var(--border)] rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {dropdownOpenEdit && (
                      <div className="border border-[var(--border)] rounded-xl max-h-48 overflow-y-auto bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/60 shadow-lg">
                        {cargandoPrestadores ? (
                          <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin text-blue-600" />
                            <span>Cargando catálogo...</span>
                          </div>
                        ) : prestadoresFiltradosEdit.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No se encontraron prestadores
                          </div>
                        ) : (
                          prestadoresFiltradosEdit.map((p) => (
                            <button
                              key={p.pre_id}
                              type="button"
                              onClick={() => {
                                setEditPreId(p.pre_id)
                                setEditMatricula(p.matricula || '')
                                setEditPrestadorNombre(p.nombre || '')
                                setDropdownOpenEdit(false)
                                setSearchPreEdit('')
                              }}
                              className="w-full text-left p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-[var(--foreground)]">{p.nombre}</p>
                                  {p.especialidad?.toUpperCase().includes('TECNIC') && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      TÉCNICO
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  {p.especialidad || 'Médico'} • Mat: {p.matricula || 'S/N'}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-blue-600 font-bold">
                                #{p.pre_id}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                    disabled={selectedUser.id === user?.id}
                    value={editActivo ? 'true' : 'false'}
                    onChange={(e) => setEditActivo(e.target.value === 'true')}
                    className="w-full px-3.5 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo (Suspendido)</option>
                  </select>
                </div>
              </div>

              {/* Teléfono Móvil / WhatsApp de Alertas Quirúrgicas */}
              {(() => {
                const selectedRole = roles.find((r) => r.id === editRolId)
                const isMedico = selectedRole?.codigo === 'medico'
                return (
                  <div
                    className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                      isMedico
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label
                        className={`block text-xs font-bold uppercase flex items-center gap-1.5 ${
                          isMedico ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        <Phone size={14} className={isMedico ? 'text-emerald-600' : 'text-slate-400'} />
                        <span>Teléfono Móvil (WhatsApp)</span>
                        {isMedico && (
                          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white tracking-wide">
                            GUARDIA QX
                          </span>
                        )}
                      </label>
                    </div>

                    <input
                      type="text"
                      placeholder="Ej: +54 9 261 555-1234 o 5492615551234"
                      value={editTelefono}
                      onChange={(e) => setEditTelefono(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                    />

                    {editTelefono.trim() ? (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                        <CheckCircle2 size={12} />
                        <span>
                          WhatsApp: <strong>{formatPhoneDisplay(editTelefono)}</strong> (
                          {normalizePhoneNumber(editTelefono)})
                        </span>
                      </p>
                    ) : isMedico ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>
                          Recomendado: El bot enviará alertas automáticas por WhatsApp a este número ante signos de
                          alarma de sus pacientes.
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Número con código de país para notificaciones WhatsApp (opcional).
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* Restablecer Contraseña con controles completos */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Restablecer Contraseña (Opcional)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => generateRandomPassword(true)}
                      className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <KeyRound size={12} />
                      <span>Generar Nueva</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        copyCredentialsCard(editNombre, editUsername, editEmail, editPassword, true)
                      }
                      className="text-[11px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                      title="Copiar datos de acceso listos para WhatsApp"
                    >
                      {copiedEditShareCard ? <Check size={12} /> : <Share2 size={12} />}
                      <span>{copiedEditShareCard ? '¡Ficha Copiada!' : 'Copiar Ficha WhatsApp'}</span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="Dejar en blanco para mantener la contraseña actual"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-3.5 pr-20 py-2.5 text-xs border border-[var(--border)] rounded-xl bg-slate-50 dark:bg-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      title="Ver/Ocultar"
                    >
                      {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    {editPassword && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(editPassword, true)}
                        className="p-1 text-slate-400 hover:text-blue-600"
                        tabIndex={-1}
                        title="Copiar nueva contraseña"
                      >
                        {copiedEditPassword ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                      </button>
                    )}
                  </div>
                </div>
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
                  disabled={actionLoading || Boolean(editUsernameConflict)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 glow-primary disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-sm overflow-hidden animate-scale-up p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">¿Eliminar Usuario?</h3>
              <p className="text-xs text-[var(--secondary)] mt-1">
                Esta acción eliminará el acceso de <strong>{selectedUser.nombre_completo}</strong> (
                @{selectedUser.username || selectedUser.email}). Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2 border-t border-[var(--border)]">
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
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
