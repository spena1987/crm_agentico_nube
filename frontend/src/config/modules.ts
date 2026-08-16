export interface ActionDefinition {
  code: string
  label: string
  description?: string
}

export interface ModuleDefinition {
  code: string
  name: string
  description: string
  icon: string
  order: number
  actions: ActionDefinition[]
}

/**
 * Registro maestro de módulos y acciones del CRM Médico.
 * 
 * EXTENSIBILIDAD:
 * Cuando se desarrolle una nueva funcionalidad (ej: Turnos, Historias Clínicas, Facturación),
 * simplemente añade el objeto del módulo aquí. Automáticamente aparecerá en la matriz
 * de permisos de roles y en los controles de acceso del sistema.
 */
export const SYSTEM_MODULES: ModuleDefinition[] = [
  {
    code: 'dashboard',
    name: 'Dashboard General',
    description: 'Acceso a métricas globales, actividad del bot y estadísticas generales.',
    icon: 'LayoutDashboard',
    order: 1,
    actions: [
      { code: 'ver', label: 'Ver Dashboard', description: 'Visualizar estadísticas y métricas generales' },
    ],
  },
  {
    code: 'chat',
    name: 'Chats / WhatsApp',
    description: 'Bandeja de entrada multicanal, mensajería en vivo con pacientes y control de IA.',
    icon: 'MessageSquare',
    order: 2,
    actions: [
      { code: 'ver', label: 'Ver Chats', description: 'Leer conversaciones e historial de mensajes' },
      { code: 'crear', label: 'Enviar Mensajes', description: 'Responder y enviar nuevos mensajes a pacientes' },
      { code: 'intervenir_bot', label: 'Pausar/Reactivar Bot', description: 'Intervenir manualmente y alternar el agente IA' },
      { code: 'eliminar', label: 'Eliminar Mensajes', description: 'Borrar conversaciones o mensajes del historial' },
    ],
  },
  {
    code: 'pacientes',
    name: 'Expedientes de Pacientes',
    description: 'Fichas clínicas de pacientes, datos de contacto y notas médicas.',
    icon: 'Users',
    order: 3,
    actions: [
      { code: 'ver', label: 'Ver Pacientes', description: 'Consultar listado y expedientes de pacientes' },
      { code: 'crear', label: 'Crear Paciente', description: 'Dar de alta nuevos pacientes manualmente' },
      { code: 'editar', label: 'Editar Datos & Notas', description: 'Modificar fichas clínicas y notas médicas' },
      { code: 'eliminar', label: 'Eliminar Paciente', description: 'Dar de baja registros de pacientes' },
    ],
  },
  {
    code: 'presupuestos',
    name: 'Presupuestos Médicos',
    description: 'Cotización de tratamientos, aranceles, servicios y generación de PDFs.',
    icon: 'FileText',
    order: 4,
    actions: [
      { code: 'ver', label: 'Ver Presupuestos', description: 'Consultar presupuestos emitidos' },
      { code: 'crear', label: 'Crear Presupuesto', description: 'Cotizar y generar nuevos presupuestos' },
      { code: 'editar', label: 'Editar Presupuesto', description: 'Modificar montos o items del presupuesto' },
      { code: 'aprobar_presupuesto', label: 'Aprobar/Rechazar', description: 'Cambiar el estado oficial del presupuesto' },
      { code: 'eliminar', label: 'Eliminar Presupuesto', description: 'Borrar presupuestos del sistema' },
    ],
  },
  {
    code: 'ajustes',
    name: 'Ajustes & Administración',
    description: 'Gestión de usuarios del staff, perfiles de roles, permisos y configuraciones.',
    icon: 'Settings',
    order: 5,
    actions: [
      { code: 'ver', label: 'Ver Ajustes', description: 'Acceder a la sección de Ajustes y configuraciones' },
      { code: 'crear', label: 'Crear Usuarios/Roles', description: 'Dar de alta nuevos usuarios y roles' },
      { code: 'editar', label: 'Editar Permisos/Usuarios', description: 'Modificar roles, permisos y estados de cuentas' },
      { code: 'eliminar', label: 'Eliminar Usuarios/Roles', description: 'Dar de baja usuarios o perfiles personalizados' },
    ],
  },
]
