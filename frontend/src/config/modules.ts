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
    code: 'agenda-geclisa',
    name: 'Agenda Geclisa',
    description: 'Turnos, citas sincronizadas con Geclisa y estado de recepción de pacientes.',
    icon: 'Calendar',
    order: 2,
    actions: [
      { code: 'ver', label: 'Ver Agenda', description: 'Consultar turnos y horarios agendados' },
      { code: 'sincronizar', label: 'Sincronizar Geclisa', description: 'Forzar sincronización en tiempo real con Geclisa' },
      { code: 'dar_presente', label: 'Dar Presente', description: 'Marcar llegada y recepción de pacientes' },
      { code: 'ver_todos_los_medicos', label: 'Ver Todos los Médicos', description: 'Consultar agenda de cualquier prestador (exclusivo jefatura/coordinación)' },
    ],
  },
  {
    code: 'chat',
    name: 'Chats / WhatsApp',
    description: 'Bandeja de entrada multicanal, mensajería en vivo con pacientes y control de IA.',
    icon: 'MessageSquare',
    order: 3,
    actions: [
      { code: 'ver', label: 'Ver Chats', description: 'Leer conversaciones e historial de mensajes' },
      { code: 'crear', label: 'Enviar Mensajes', description: 'Responder y enviar nuevos mensajes a pacientes' },
      { code: 'intervenir_bot', label: 'Pausar/Reactivar Bot', description: 'Intervenir manualmente y alternar el agente IA' },
      { code: 'eliminar', label: 'Eliminar Mensajes', description: 'Borrar conversaciones o mensajes del historial' },
    ],
  },
  {
    code: 'pipeline-quirurgico',
    name: 'Asesoramiento / Pipeline',
    description: 'Embudo comercial y quirúrgico de pacientes (Kanban lead-to-surgery).',
    icon: 'TrendingUp',
    order: 4,
    actions: [
      { code: 'ver', label: 'Ver Pipeline', description: 'Visualizar tablero Kanban de prospectos quirúrgicos' },
      { code: 'crear', label: 'Crear Oportunidad', description: 'Ingresar nuevos casos al embudo de asesoramiento' },
      { code: 'editar', label: 'Editar Casos', description: 'Modificar datos, presupuestos y notas del caso' },
      { code: 'cambiar_etapa', label: 'Mover Etapas', description: 'Arrastrar tarjetas y avanzar estados en el embudo' },
      { code: 'asignar_asesor', label: 'Asignar Asesor/Médico', description: 'Asignar responsable comercial o quirúrgico' },
      { code: 'eliminar', label: 'Eliminar Casos', description: 'Dar de baja oportunidades del pipeline' },
    ],
  },
  {
    code: 'asesoramiento-recepcion',
    name: 'Recepción del Día (Asesoría)',
    description: 'Control diario de pacientes citados para asesoramiento quirúrgico en sala de espera.',
    icon: 'UserCheck',
    order: 5,
    actions: [
      { code: 'ver', label: 'Ver Recepción', description: 'Consultar lista de pacientes en espera del día' },
      { code: 'recepcionar_paciente', label: 'Check-in Paciente', description: 'Registrar ingreso y sala de espera' },
      { code: 'editar_estado', label: 'Actualizar Estado', description: 'Marcar en atención, finalizado o reprogramado' },
    ],
  },
  {
    code: 'programacion-quirurgica',
    name: 'Quirófano / Programación',
    description: 'Agenda quirúrgica, reserva de quirófanos, asignación de slots y equipos médicos.',
    icon: 'Building2',
    order: 6,
    actions: [
      { code: 'ver', label: 'Ver Agenda Quirúrgica', description: 'Consultar programación de cirugías y quirófanos' },
      { code: 'crear', label: 'Programar Cirugía', description: 'Crear nuevas cirugías y reservar horarios' },
      { code: 'editar', label: 'Modificar Cirugías', description: 'Reprogramar horarios, salas o cirujanos' },
      { code: 'bloquear_slot', label: 'Bloquear Quirófano', description: 'Bloquear franjas horarias por mantenimiento o reserva' },
      { code: 'eliminar', label: 'Cancelar Cirugía', description: 'Eliminar o dar de baja eventos quirúrgicos' },
    ],
  },
  {
    code: 'quirofano-en-vivo',
    name: 'Pizarra en Vivo (Quirófano)',
    description: 'Tablero en tiempo real para quirófano, salas de recuperación y monitor TV.',
    icon: 'Activity',
    order: 7,
    actions: [
      { code: 'ver', label: 'Ver Pizarra en Vivo', description: 'Visualizar el estado intraoperatorio en tiempo real' },
      { code: 'actualizar_estado_paciente', label: 'Actualizar Estado Quirófano', description: 'Mover paciente (en espera, anestesia, cirugía, recuperación)' },
    ],
  },
  {
    code: 'calculo-lio',
    name: 'Cálculo de LIO',
    description: 'Herramienta biométrica y fórmulas de cálculo de lentes intraoculares para cataratas.',
    icon: 'Eye',
    order: 8,
    actions: [
      { code: 'ver', label: 'Ver Fórmulas LIO', description: 'Acceder a calculadoras ópticas y fórmulas biométricas' },
      { code: 'calcular', label: 'Ejecutar Cálculos', description: 'Simular potencias y selecciones de lentes' },
      { code: 'guardar_ficha', label: 'Guardar en Expediente', description: 'Vincular el cálculo definitivo a la cirugía del paciente' },
    ],
  },
  {
    code: 'presupuestos',
    name: 'Presupuestos Médicos',
    description: 'Cotización de tratamientos, aranceles, servicios y generación de PDFs.',
    icon: 'FileText',
    order: 9,
    actions: [
      { code: 'ver', label: 'Ver Presupuestos', description: 'Consultar presupuestos emitidos' },
      { code: 'crear', label: 'Crear Presupuesto', description: 'Cotizar y generar nuevos presupuestos' },
      { code: 'editar', label: 'Editar Presupuesto', description: 'Modificar montos o items del presupuesto' },
      { code: 'aprobar_presupuesto', label: 'Aprobar/Rechazar', description: 'Cambiar el estado oficial del presupuesto' },
      { code: 'eliminar', label: 'Eliminar Presupuesto', description: 'Borrar presupuestos del sistema' },
    ],
  },
  {
    code: 'pacientes',
    name: 'Expedientes de Pacientes',
    description: 'Fichas clínicas, antecedentes oftalmológicos, recetas y órdenes de estudios.',
    icon: 'Users',
    order: 10,
    actions: [
      { code: 'ver', label: 'Ver Pacientes', description: 'Consultar listado y expedientes de pacientes' },
      { code: 'crear', label: 'Crear Paciente', description: 'Dar de alta nuevos pacientes manualmente' },
      { code: 'editar', label: 'Editar Datos Personales', description: 'Modificar ficha de contacto y datos administrativos' },
      { code: 'recetar_farmacos', label: 'Prescribir Fármacos', description: 'Emitir recetas oftalmológicas farmacológicas' },
      { code: 'recetar_lentes', label: 'Prescribir Lentes', description: 'Emitir recetas ópticas y de anteojos' },
      { code: 'ordenar_estudios', label: 'Ordenar Estudios', description: 'Generar pedidos de estudios diagnósticos' },
      { code: 'eliminar', label: 'Eliminar Paciente', description: 'Dar de baja registros de pacientes' },
    ],
  },
  {
    code: 'logs',
    name: 'Logs & Auditoría',
    description: 'Monitor de eventos del sistema, llamadas a APIs externas e incidencias de IA.',
    icon: 'ScrollText',
    order: 11,
    actions: [
      { code: 'ver', label: 'Ver Logs', description: 'Consultar eventos y trazas del sistema' },
      { code: 'exportar', label: 'Exportar Auditoría', description: 'Descargar registros estructurados de eventos' },
    ],
  },
  {
    code: 'ajustes',
    name: 'Ajustes & Administración',
    description: 'Gestión de usuarios del staff, perfiles de roles, permisos y configuraciones.',
    icon: 'Settings',
    order: 12,
    actions: [
      { code: 'ver', label: 'Ver Ajustes General', description: 'Acceso básico a la sección de Ajustes' },
      { code: 'ver_lios', label: 'Ver Lentes Intraoculares (LIO)', description: 'Consultar catálogo de marcas, modelos y ópticas Alcon' },
      { code: 'editar_lios', label: 'Editar Lentes Intraoculares (LIO)', description: 'Dar de alta y modificar lentes, modelos y constantes' },
      { code: 'ver_nomencladores', label: 'Ver Nomencladores & Aranceles', description: 'Consultar prácticas médicas y valores arancelarios' },
      { code: 'editar_nomencladores', label: 'Editar Nomencladores & Aranceles', description: 'Modificar valores, códigos y aranceles de prácticas' },
      { code: 'ver_quirofano', label: 'Ver Quirófano & Consentimientos', description: 'Consultar salas quirúrgicas, slots y configuraciones' },
      { code: 'ver_prestadores', label: 'Ver Equipo & Prestadores', description: 'Consultar anestesistas e instrumentadores de la clínica' },
      { code: 'ver_quirurgico', label: 'Ver Asesoría & Lead-to-Surgery', description: 'Consultar SLA, tiempos y checklist quirúrgico' },
      { code: 'ver_clinica', label: 'Ver Perfil del Centro Médico', description: 'Consultar datos y membrete de la institución' },
      { code: 'ver_plantilla_presupuesto', label: 'Ver Diseñador de Presupuestos', description: 'Consultar y diseñar plantillas PDF de presupuestos' },
      { code: 'ver_whatsapp', label: 'Ver WhatsApp & Gateway', description: 'Consultar estado de sincronización y sesión Meta' },
      { code: 'ver_plantillas_whatsapp', label: 'Ver Plantillas WhatsApp (Meta)', description: 'Consultar y diseñar plantillas oficiales de WhatsApp' },
      { code: 'ver_bot', label: 'Ver Agente IA Gemini', description: 'Consultar directivas y configuración del agente IA' },
      { code: 'ver_seguridad', label: 'Ver Seguridad & Sesión', description: 'Consultar políticas de inactividad y cierre de sesión' },
      { code: 'ver_logs', label: 'Ver Consola de Logs', description: 'Consultar trazas técnicas de depuración' },
      { code: 'ver_usuarios', label: 'Ver Usuarios & Accesos', description: 'Acceso a la sub-página /ajustes/usuarios' },
      { code: 'ver_roles', label: 'Ver Perfiles & Permisos (RBAC)', description: 'Acceso a la sub-página /ajustes/roles' },
    ],
  },
  {
    code: 'ayuda',
    name: 'Centro de Ayuda & Base de Conocimientos',
    description: 'Manual interactivo de usuario, guías operativas, diccionario de campos y resolución de incidencias.',
    icon: 'HelpCircle',
    order: 13,
    actions: [
      { code: 'ver', label: 'Ver Centro de Ayuda', description: 'Consultar manuales, cómo hacer y preguntas frecuentes' },
    ],
  },
]

export interface LandingPageOption {
  route: string
  label: string
  moduleCode: string
}

export const LANDING_PAGE_OPTIONS: LandingPageOption[] = [
  { route: '/', label: 'Dashboard General', moduleCode: 'dashboard' },
  { route: '/agenda-geclisa', label: 'Agenda Geclisa', moduleCode: 'agenda-geclisa' },
  { route: '/chat', label: 'Chats / WhatsApp', moduleCode: 'chat' },
  { route: '/pipeline-quirurgico', label: 'Asesoramiento / Pipeline', moduleCode: 'pipeline-quirurgico' },
  { route: '/asesoramiento-recepcion', label: 'Recepción del Día (Asesoría)', moduleCode: 'asesoramiento-recepcion' },
  { route: '/programacion-quirurgica', label: 'Quirófano / Agenda & Slots', moduleCode: 'programacion-quirurgica' },
  { route: '/quirofano-en-vivo', label: 'Pizarra en Vivo (Quirófano)', moduleCode: 'quirofano-en-vivo' },
  { route: '/calculo-lio', label: 'Cálculo de LIO', moduleCode: 'calculo-lio' },
  { route: '/presupuestos', label: 'Presupuestos Médicos', moduleCode: 'presupuestos' },
  { route: '/pacientes', label: 'Expedientes de Pacientes', moduleCode: 'pacientes' },
  { route: '/logs', label: 'Logs & Auditoría', moduleCode: 'logs' },
  { route: '/ajustes', label: 'Ajustes & Administración', moduleCode: 'ajustes' },
  { route: '/ajustes?tab=lios', label: 'Ajustes: Lentes Intraoculares (LIO)', moduleCode: 'ajustes' },
  { route: '/ajustes?tab=nomenclador', label: 'Ajustes: Nomencladores & Aranceles', moduleCode: 'ajustes' },
  { route: '/ayuda', label: 'Centro de Ayuda & Manual', moduleCode: 'ayuda' },
]
