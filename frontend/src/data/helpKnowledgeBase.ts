export interface HelpField {
  name: string
  type: string
  required: boolean
  description: string
}

export interface HelpFaq {
  question: string
  cause: string
  solution: string
}

export interface HelpModule {
  id: string
  code: string
  title: string
  route: string
  badgeCategory: string
  category: 'comunicacion' | 'agenda' | 'quirurgico' | 'administracion' | 'general'
  oneLiner: string
  screenshotTag: string
  howTo: {
    habitual: string[]
    secundarias: string[]
  }
  fields: HelpField[]
  faqs: HelpFaq[]
}

export const HELP_KNOWLEDGE_BASE: HelpModule[] = [
  {
    id: 'chat',
    code: 'chat',
    title: 'Chats / WhatsApp Omnicanal e IA',
    route: '/chat',
    badgeCategory: 'Comunicación',
    category: 'comunicacion',
    oneLiner: 'Gestiona la comunicación por WhatsApp con pacientes, supervisa el bot Gemini e interviene manualmente.',
    screenshotTag: '[CAPTURA: Bandeja de entrada con lista de chats, switch ToggleHuman y plantillas Meta]',
    howTo: {
      habitual: [
        'Navegar a "Chats / WhatsApp" en el menú lateral.',
        'Ubicar la conversación activa en la columna izquierda.',
        'Revisar el indicador: Robot Verde (IA respondiendo) o Usuario Azul (atención humana requerida).',
        'Para intervenir, hacer clic en "Toggle Human" (cambiar a Modo Humano) para pausar las respuestas automáticas de Gemini.',
        'Escribir la respuesta o elegir una plantilla predefinida y enviar con Enter o el botón de envío.'
      ],
      secundarias: [
        'Usar Respuestas Rápidas (ícono de rayo ⚡) para textos institucionales frecuentes.',
        'Si pasaron más de 24 horas sin respuesta del paciente, abrir "Plantillas Meta" para enviar un mensaje homologado.',
        'Al resolver la consulta, volver a activar "Bot IA Activo" si corresponde para automatizar futuras dudas.'
      ]
    },
    fields: [
      { name: 'Buscador de Chats', type: 'Texto', required: false, description: 'Filtra conversaciones por nombre o teléfono del paciente.' },
      { name: 'Caja de Mensaje', type: 'Texto multilínea', required: true, description: 'Mensaje libre a despachar. Admite saltos con Shift+Enter.' },
      { name: 'Toggle Human', type: 'Interruptor Booleano', required: true, description: 'Activa o desactiva la inferencia de respuestas del bot de IA.' },
      { name: 'Plantilla Meta', type: 'Selector modal', required: false, description: 'Plantilla preaprobada para contactos que superaron la ventana de 24h.' },
      { name: 'Adjunto', type: 'Archivo (PDF, Imagen)', required: false, description: 'Envío de órdenes o presupuestos (límite 15 MB).' }
    ],
    faqs: [
      {
        question: 'Aparece el error "Outside 24-hour window. Requires approved Meta template".',
        cause: 'Pasaron más de 24 horas desde el último mensaje del paciente y Meta bloquea el texto libre.',
        solution: 'Pulsar el botón "Plantillas Meta", seleccionar una plantilla oficial de recordatorio/aviso y enviarla.'
      },
      {
        question: 'El bot Gemini sigue respondiendo mientras intento escribir al paciente.',
        cause: 'No se activó el interruptor de intervención humana.',
        solution: 'Hacer clic de inmediato en el botón "Toggle Human" en la cabecera del chat para pasar a Modo Humano.'
      }
    ]
  },
  {
    id: 'agenda-geclisa',
    code: 'agenda-geclisa',
    title: 'Agenda Geclisa & Check-in',
    route: '/agenda-geclisa',
    badgeCategory: 'Recepción',
    category: 'agenda',
    oneLiner: 'Turnos sincronizados con Geclisa de escritorio y registro de llegada (Dar Presente) para consultorios.',
    screenshotTag: '[CAPTURA: Grilla de turnos con selector de prestador, botón Sincronizar y botón Dar Presente]',
    howTo: {
      habitual: [
        'Ingresar a "Agenda Geclisa" desde la barra de navegación.',
        'Verificar la fecha de atención y seleccionar el médico en el desplegable de prestadores.',
        'Buscar al paciente en la grilla mediante su DNI o Apellido.',
        'Al recibir al paciente en mostrador con su carnet, hacer clic en el botón verde "Dar Presente".',
        'El turno cambia a estado "Presente" y el médico ve el aviso en su pantalla.'
      ],
      secundarias: [
        'Presionar "Sincronizar Geclisa" (flechas circulares) si un turno recién otorgado en mostrador no figura.',
        'Hacer clic en el nombre del paciente para ver antecedentes médicos rápidos.'
      ]
    },
    fields: [
      { name: 'Fecha de Agenda', type: 'Selector Fecha', required: true, description: 'Día de atención que se desea auditar o recepcionar.' },
      { name: 'Prestador Médico', type: 'Selector Desplegable', required: true, description: 'Profesional cuya agenda se está consultando.' },
      { name: 'Buscador de Paciente', type: 'Texto', required: false, description: 'Búsqueda reactiva por DNI, Nombre o N° de Ficha Geclisa.' },
      { name: 'Estado del Turno', type: 'Badge indicador', required: true, description: 'Pendiente, Presente (check-in realizado) o Atendido.' }
    ],
    faqs: [
      {
        question: 'El paciente sacó turno en Geclisa de escritorio pero no figura en la grilla web.',
        cause: 'El ciclo de sincronización automática todavía no se ejecutó.',
        solution: 'Presionar el botón superior "Sincronizar Geclisa" para forzar la actualización inmediata vía API.'
      },
      {
        question: 'El botón "Dar Presente" marca error de conexión.',
        cause: 'Microcorte de red en el servidor local donde corre la base de Geclisa.',
        solution: 'Registrar la presencia en el Geclisa de escritorio y verificar la red de la clínica.'
      }
    ]
  },
  {
    id: 'pipeline-quirurgico',
    code: 'pipeline-quirurgico',
    title: 'Asesoramiento Quirúrgico (Pipeline)',
    route: '/pipeline-quirurgico',
    badgeCategory: 'Quirófano',
    category: 'quirurgico',
    oneLiner: 'Embudo de conversión quirúrgica desde la derivación médica hasta la confirmación de la cirugía.',
    screenshotTag: '[CAPTURA: Tablero Kanban de 5 columnas con semáforo de días sin contacto SLA]',
    howTo: {
      habitual: [
        'Ingresar a "Asesoramiento > Pipeline" para visualizar el tablero Kanban.',
        'Revisar las 5 columnas: 1. Derivados, 2. En Asesoramiento, 3. En Análisis, 4. Confirmados, 5. Programados Qx.',
        'Arrastrar la tarjeta del paciente a la siguiente fase según el progreso del contacto.',
        'Auditar los marcos de las tarjetas: amarillo o rojo indican casos con días sin contacto (SLA vencido).'
      ],
      secundarias: [
        'Abrir la tarjeta del paciente para agregar notas de llamadas o mensajes.',
        'Si el paciente no desea operarse, presionar "Cerrar Caso" y registrar el motivo de cancelación obligatorio.'
      ]
    },
    fields: [
      { name: 'Paciente', type: 'Selector / Búsqueda', required: true, description: 'Paciente titular con indicación de cirugía.' },
      { name: 'Práctica Quirúrgica', type: 'Selector', required: true, description: 'Cirugía prescripta (Faco, LASIK, etc.).' },
      { name: 'Lateralidad (Ojo)', type: 'Selector (OD/OI/AO)', required: true, description: 'Ojo Derecho, Izquierdo o Ambos Ojos.' },
      { name: 'Etapa del Embudo', type: 'Selector', required: true, description: 'Fase actual en el ciclo de conversión.' },
      { name: 'Motivo de Cancelación', type: 'Selector normalizado', required: false, description: 'Obligatorio si se cierra el caso como desistido.' }
    ],
    faqs: [
      {
        question: 'Una tarjeta muestra borde rojo y "Alerta SLA: X días sin contacto".',
        cause: 'Se superó el plazo máximo tolerable sin registrar un contacto con el paciente.',
        solution: 'Contactar al paciente de inmediato por WhatsApp o llamada y asentar la novedad en el caso.'
      },
      {
        question: 'No se puede cerrar una oportunidad desistida.',
        cause: 'No se seleccionó el motivo de cierre obligatorio en el modal.',
        solution: 'Elegir el motivo formal en el desplegable (Económico, Prefiere postergar, etc.) y confirmar.'
      }
    ]
  },
  {
    id: 'presupuestos',
    code: 'presupuestos',
    title: 'Presupuestos Médicos Formales',
    route: '/presupuestos',
    badgeCategory: 'Facturación',
    category: 'administracion',
    oneLiner: 'Cotizador automático en pesos y dólares con catálogo LIO Alcon y despacho de PDF por WhatsApp.',
    screenshotTag: '[CAPTURA: Cotizador de presupuestos con cálculo multimoneda y botón Enviar por WhatsApp]',
    howTo: {
      habitual: [
        'Ingresar a "Presupuestos" y seleccionar la pestaña "Crear Presupuesto".',
        'Buscar al paciente en el selector o crearlo en el momento.',
        'Elegir el Ojo (OD/OI/AO), la práctica médica y el modelo de Lente Intraocular (LIO) si aplica.',
        'Verificar el cálculo automático en ARS y USD.',
        'Presionar "Generar Presupuesto Formal" para compilar el PDF con membrete y QR.',
        'Hacer clic en "Enviar por WhatsApp" para remitir la propuesta en 1 clic al paciente.'
      ],
      secundarias: [
        'Previsualizar el documento generado con el visor de PDF.',
        'Marcar como "Aprobado" cuando el paciente confirme la fecha quirúrgica.'
      ]
    },
    fields: [
      { name: 'Paciente', type: 'Búsqueda', required: true, description: 'Paciente destinatario con teléfono celular válido.' },
      { name: 'Ojo', type: 'Selector (OD/OI/AO)', required: true, description: 'Lateralidad a presupuestar.' },
      { name: 'Práctica Médica', type: 'Selector', required: true, description: 'Código nomenclado del procedimiento quirúrgico.' },
      { name: 'Modelo de LIO', type: 'Selector Alcon', required: false, description: 'Lente intraocular Alcon que define el costo del insumo.' },
      { name: 'Total ARS / USD', type: 'Numérico', required: true, description: 'Importe final liquidable calculado por el sistema.' }
    ],
    faqs: [
      {
        question: 'Al enviar por WhatsApp indica "Número de teléfono inválido".',
        cause: 'El número no tiene el prefijo de país internacional o contiene espacios/guiones.',
        solution: 'Editar los datos del paciente y colocar el formato completo (ej. +5491144556677).'
      }
    ]
  },
  {
    id: 'pacientes',
    code: 'pacientes',
    title: 'Expedientes y Consentimiento Digital',
    route: '/pacientes',
    badgeCategory: 'Clínica',
    category: 'general',
    oneLiner: 'Maestro de pacientes, historial de evoluciones y envío de Consentimientos con firma móvil en 1 clic.',
    screenshotTag: '[CAPTURA: Expediente del paciente con botón de envío de token de consentimiento]',
    howTo: {
      habitual: [
        'Navegar a "Pacientes" y buscar por DNI o Apellido.',
        'Abrir el expediente haciendo clic en la fila del paciente.',
        'En la sección prequirúrgica, hacer clic en "Generar Consentimiento Digital".',
        'Elegir el procedimiento y presionar "Enviar Token al Celular".',
        'El paciente firma en la pantalla de su teléfono y el CRM valida el documento con IP y hash.'
      ],
      secundarias: [
        'Consultar el historial de recetas ópticas y farmacológicas emitidas.',
        'Descargar el PDF con la constancia de firma electrónica del paciente.'
      ]
    },
    fields: [
      { name: 'Nombre y Apellido', type: 'Texto', required: true, description: 'Nombre completo del paciente.' },
      { name: 'DNI / Documento', type: 'Texto', required: true, description: 'Identificador fiscal/legal del paciente.' },
      { name: 'Teléfono Móvil', type: 'Texto (E.164)', required: true, description: 'Celular con código de área para envíos de WhatsApp y tokens.' },
      { name: 'Obra Social / Prepaga', type: 'Texto', required: false, description: 'Entidad de cobertura médica del paciente.' }
    ],
    faqs: [
      {
        question: 'El paciente no recibió el enlace de firma en su teléfono.',
        cause: 'El número de WhatsApp no coincide o el dispositivo está sin señal.',
        solution: 'Revisar el número en el expediente y presionar "Reenviar Token" desde la pestaña de consentimientos.'
      }
    ]
  },
  {
    id: 'quirofano-en-vivo',
    code: 'quirofano-en-vivo',
    title: 'Pizarra en Vivo de Quirófano',
    route: '/quirofano-en-vivo',
    badgeCategory: 'Quirófano',
    category: 'quirurgico',
    oneLiner: 'Monitor en tiempo real del progreso de pacientes en quirófano para informes en sala de espera.',
    screenshotTag: '[CAPTURA: Tablero en tiempo real con estados: En Espera, En Quirófano, Recuperación y Alta]',
    howTo: {
      habitual: [
        'Abrir "Quirófano > Pizarra en Vivo".',
        'Localizar al paciente por nombre en la grilla visual.',
        'Monitorear la etapa actual: En Espera/Dilatación ➔ En Quirófano ➔ En Recuperación ➔ Alta.',
        'Informar a familiares en sala de espera basándose en el estado reflejado en el monitor.'
      ],
      secundarias: [
        'El personal de quirófano actualiza el chip de estado con un clic a medida que el paciente avanza.'
      ]
    },
    fields: [
      { name: 'Paciente', type: 'Texto', required: true, description: 'Nombre del paciente en quirófano.' },
      { name: 'Sala / Quirófano', type: 'Texto', required: true, description: 'Quirófano físico asignado.' },
      { name: 'Cirujano', type: 'Texto', required: true, description: 'Profesional a cargo del acto quirúrgico.' },
      { name: 'Estado Quirúrgico', type: 'Chip interactivo', required: true, description: 'Progreso del paciente en la unidad quirúrgica.' }
    ],
    faqs: [
      {
        question: 'El estado del paciente no se actualiza en pantalla.',
        cause: 'Pestaña del navegador desincronizada o desconexión temporal de WebSockets.',
        solution: 'Refrescar la página con F5; el CRM re-establecerá el canal en tiempo real de Supabase.'
      }
    ]
  },
  {
    id: 'ajustes',
    code: 'ajustes',
    title: 'Ajustes & Administración Global',
    route: '/ajustes',
    badgeCategory: 'Administración',
    category: 'administracion',
    oneLiner: 'Control de usuarios, roles RBAC, catálogo de lentes LIO, aranceles y parámetros de la IA.',
    screenshotTag: '[CAPTURA: Panel de Ajustes con pestañas temáticas de configuración]',
    howTo: {
      habitual: [
        'Navegar a "Ajustes" en el menú lateral inferior.',
        'Seleccionar la pestaña deseada (Usuarios, Roles, LIOs, Nomenclador, IA Gemini, etc.).',
        'Efectuar las modificaciones requeridas y presionar "Guardar Cambios".'
      ],
      secundarias: [
        'Consultar o cambiar la landing page por defecto de cada rol de usuario.',
        'Actualizar el membrete y datos de la clínica para los presupuestos en PDF.'
      ]
    },
    fields: [
      { name: 'Pestaña de Ajuste', type: 'Navegación', required: true, description: 'Subárea de configuración institucional.' },
      { name: 'Roles y Permisos', type: 'Matriz RBAC', required: true, description: 'Asignación granular de módulos y acciones por rol.' }
    ],
    faqs: [
      {
        question: 'Un usuario no puede ver un módulo en el menú.',
        cause: 'Su perfil de rol no tiene tildado el permiso "ver" en la matriz RBAC.',
        solution: 'Ir a Ajustes > Perfiles & Permisos (RBAC), editar el rol del usuario y habilitar el módulo.'
      }
    ]
  }
]
