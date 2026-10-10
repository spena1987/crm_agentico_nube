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
        'Auditar los marcos de las tarjetas: amarillo o rojo indican casos con días sin contacto (SLA vencido).',
        'Usar el filtro superior "Postergados (Snooze)" para auditar casos pausados temporalmente a pedido del paciente.'
      ],
      secundarias: [
        'Abrir la tarjeta del paciente para agregar notas de llamadas, auditar los toques automáticos de WhatsApp o activar/pausar el seguimiento.',
        'Si el paciente no desea operarse, presionar "Cerrar Caso" y registrar la categoría de causa obligatoria para el Diagrama de Pareto.'
      ]
    },
    fields: [
      { name: 'Paciente', type: 'Selector / Búsqueda', required: true, description: 'Paciente titular con indicación de cirugía.' },
      { name: 'Práctica Quirúrgica', type: 'Selector', required: true, description: 'Cirugía prescripta (Faco, LASIK, etc.).' },
      { name: 'Lateralidad (Ojo)', type: 'Selector (OD/OI/AO)', required: true, description: 'Ojo Derecho, Izquierdo o Ambos Ojos.' },
      { name: 'Etapa del Embudo', type: 'Selector', required: true, description: 'Fase actual en el ciclo de conversión.' },
      { name: 'Filtro Postergados (Snooze)', type: 'Selector de vista', required: false, description: 'Filtra oportunidades en pausa programada con fecha de reactivación futura.' },
      { name: 'Motivo de Cancelación', type: 'Selector normalizado', required: false, description: 'Obligatorio si se cierra el caso como desistido (alimenta análisis de Pareto).' }
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
      },
      {
        question: '¿Cómo ver los casos pausados por el paciente sin saturar el Kanban?',
        cause: 'Los casos en "Snooze" se ocultan del flujo principal para evitar dispersión operativa.',
        solution: 'Seleccionar "Postergados (Snooze)" en los filtros del Pipeline para consultar su fecha de despertar.'
      }
    ]
  },
  {
    id: 'seguimiento-automatizado',
    code: 'seguimiento-automatizado',
    title: 'Automatismo de Seguimiento Quirúrgico & Presupuestos (Cadencias & Pareto)',
    route: '/pipeline-quirurgico',
    badgeCategory: 'Automatización & IA',
    category: 'administracion',
    oneLiner: 'Cadencias programadas por WhatsApp, gestión de Snooze (postergación), confirmaciones en 1 clic y Diagrama de Pareto de objeciones.',
    screenshotTag: '[CAPTURA: Expediente quirúrgico con tarjeta de Control de Seguimiento, selector de Snooze y Diagrama de Pareto de causas]',
    howTo: {
      habitual: [
        'Paso 1 - Activación Automática: Al crear un caso quirúrgico o emitir un presupuesto oficial (estados "En Asesoramiento" o "En Análisis"), el sistema activa por defecto el switch "Seguimiento Automático".',
        'Paso 2 - Ejecución Silenciosa de Cadencias: El cron escanea periódicamente la inactividad del paciente y despacha toques homologados por Meta WhatsApp Cloud API según el estado del caso:',
        '   • En Asesoramiento (Cadencia A): Toque #1 (D+3: Dudas iniciales), Toque #2 (D+8: Información médica/prequirúrgica), Toque #3 (D+18: Recontacto asistido).',
        '   • En Análisis / Presupuesto Emitido (Cadencia B): Toque #1 (D+2: Recepción y dudas del PDF), Toque #2 (D+6: Medios de pago y cobertura), Toque #3 (D+13: Aviso urgente a 48h del vencimiento del arancel cotizado), Toque #4 (D+25: Cierre cordial de la propuesta).',
        'Paso 3 - Intervención del Paciente vía WhatsApp: El paciente puede presionar botones oficiales (Confirmar, Posponer, Desistir) o responder con texto libre, el cual es atendido por el bot Gemini.',
        'Paso 4 - Confirmación Inmediata: Si el paciente confirma, la asesoría pasa a "Confirmado", el presupuesto a "Aprobado" y se alerta al equipo para coordinar fecha de quirófano.',
        'Paso 5 - Gestión de Postergaciones (Snooze): Si el paciente solicita esperar (por viaje, cobro o motivos personales), seleccionar la opción Snooze (15, 30, 45 o 60 días). El caso se pausará temporalmente y saldrá del pipeline activo al filtro "Postergados (Snooze)". Cumplida la fecha, se reactivará solo.',
        'Paso 6 - Tipificación Obligatoria de Cierre: Si el paciente desiste, seleccionar la causa formal en el modal (Económico, Cobertura Obra Social, Miedo Quirúrgico, Prefiere Postergar, Operado en Otro Centro, Otros).',
        'Paso 7 - Análisis Estratégico (Pareto): Consultar la sección de Analítica Pareto para visualizar qué 20% de las causas genera el 80% de las pérdidas arancelarias en pesos y dólares.'
      ],
      secundarias: [
        'Pausa Manual: Si la asesora está conversando telefónicamente con el paciente, puede apagar el interruptor "Seguimiento Automático" para evitar mensajes simultáneos.',
        'Trazabilidad en Bitácora: Cada toque enviado por WhatsApp se registra automáticamente como una evolución formal con autor "Bot Seguimiento" en el expediente quirúrgico.',
        'Congelamiento de Arancel: Ante el aviso del Toque D+13 (48h antes de vencer), la asesora puede contactar al paciente para ofrecer reservar el turno y congelar el precio vigente.'
      ]
    },
    fields: [
      { name: 'Seguimiento Automático', type: 'Interruptor Booleano', required: true, description: 'Habilita o deshabilita los envíos programados de la cadencia de recontacto (Activo por defecto).' },
      { name: 'Estado de Seguimiento', type: 'Badge indicador', required: true, description: 'Indica el estado actual del proceso: "en_curso", "snooze" (pausado), "convertido" o "desistido".' },
      { name: 'Etapa / Toque Actual', type: 'Numérico (1 al 4)', required: true, description: 'Número de toque de la cadencia despachado al paciente.' },
      { name: 'Último Toque Enviado', type: 'Fecha y Hora (ISO)', required: false, description: 'Marca temporal exacta del último mensaje de seguimiento emitido.' },
      { name: 'Snooze Hasta (Pausa)', type: 'Fecha (YYYY-MM-DD)', required: false, description: 'Fecha límite de la pausa asistida. El sistema silencia los toques hasta este día.' },
      { name: 'Categoría de Causa / Objeción', type: 'Selector Normalizado', required: true, description: 'Motivo tipificado: economico, cobertura_obra_social, miedo_cirugia, posterga_tiempo, operado_otro_centro, otros.' },
      { name: 'Motivo de Demora / Detalle', type: 'Texto libre', required: false, description: 'Aclaración específica provista por el paciente o la asesora.' },
      { name: 'Validez del Presupuesto', type: 'Numérico (Días)', required: true, description: 'Días de vigencia arancelaria (15 días por defecto). El toque #3 se dispara a las 48h previas (D+13).' },
      { name: 'Canal de Resolución', type: 'Texto / Origen', required: true, description: 'Registra si el caso se cerró por "whatsapp_bot", "agente_gemini" o "asesora_humana".' },
      { name: 'Toque de Resolución', type: 'Numérico', required: false, description: 'Identifica en qué número de toque el paciente tomó la decisión de aprobar o rechazar.' }
    ],
    faqs: [
      {
        question: '¿Qué ocurre si el paciente contesta un mensaje de la cadencia con dudas o preguntas?',
        cause: 'El paciente interactuó enviando un mensaje de texto dentro de la ventana de 24 horas de WhatsApp.',
        solution: 'El agente de IA Gemini responde aclarando dudas y registra la objeción si la detecta. La asesora puede tomar el control del chat en cualquier momento desactivando el bot con el botón "Toggle Human".'
      },
      {
        question: 'El paciente pide que lo llamemos dentro de un mes: ¿cómo evitamos que el bot lo siga contactando?',
        cause: 'El paciente tiene interés genuino pero requiere posponer el avance quirúrgico.',
        solution: 'Abrir el expediente en el Pipeline, ir al bloque "Control de Seguimiento", seleccionar "Posponer 30 días" (Snooze) y guardar. El caso dejará de recibir toques hasta la fecha señalada y se archivará en la vista "Postergados".'
      },
      {
        question: '¿Por qué el Toque #3 de presupuestos se envía exactamente a los 13 días (D+13)?',
        cause: 'Los presupuestos médicos tienen una validez de 15 días corridos garantizados.',
        solution: 'El Toque #3 actúa como un aviso preventivo 48 horas antes de la caducidad del presupuesto, dándole al paciente la oportunidad de congelar el valor cotizado antes de una actualización arancelaria.'
      },
      {
        question: '¿Dónde encuentro los casos que fueron puestos en "Snooze"?',
        cause: 'Para mantener limpio el embudo Kanban principal, los casos dormidos no saturan las columnas activas.',
        solution: 'En "Asesoramiento > Pipeline", utilizar el selector de filtros superior y elegir "Postergados (Snooze)" para ver la lista completa con sus fechas de despertar.'
      },
      {
        question: '¿Qué información aporta el Diagrama de Pareto de Objeciones?',
        cause: 'Necesidad de comprender las causas principales de pérdida de presupuestos para fijar estrategias.',
        solution: 'El diagrama ordena las causas de mayor a menor impacto acumulado (80/20) y detalla la suma monetaria perdida en ARS y USD, permitiendo renegociar convenios con prepagas o ajustar planes de cuotas.'
      },
      {
        question: '¿Qué sucede si una plantilla oficial de seguimiento aún no está aprobada en Meta?',
        cause: 'Meta puede demorar la revisión de nuevas plantillas comerciales.',
        solution: 'El servicio cuenta con un mecanismo de fallback inteligente que envía la plantilla genérica aprobada "apertura_conversacion" o un mensaje de texto libre si la ventana de 24 horas sigue abierta, asegurando que el paciente nunca quede desatendido.'
      }
    ]
  },
  {
    id: 'presupuestos',
    code: 'presupuestos',
    title: 'Presupuestos Médicos Formales & Validez Arancelaria',
    route: '/presupuestos',
    badgeCategory: 'Facturación',
    category: 'administracion',
    oneLiner: 'Cotizador automático en pesos y dólares con catálogo LIO Alcon, validez de 15 días y seguimiento cadencial.',
    screenshotTag: '[CAPTURA: Cotizador de presupuestos con cálculo multimoneda, indicador de validez y botón Enviar por WhatsApp]',
    howTo: {
      habitual: [
        'Ingresar a "Presupuestos" y seleccionar la pestaña "Crear Presupuesto".',
        'Buscar al paciente en el selector o crearlo en el momento.',
        'Elegir el Ojo (OD/OI/AO), la práctica médica y el modelo de Lente Intraocular (LIO) si aplica.',
        'Verificar el cálculo automático en ARS y USD, y la validez arancelaria establecida en 15 días.',
        'Presionar "Generar Presupuesto Formal" para compilar el PDF con membrete y QR.',
        'Hacer clic en "Enviar por WhatsApp" para remitir la propuesta en 1 clic al paciente.',
        'Al enviarse, el presupuesto y la asesoría quedan vinculados a la Cadencia B de seguimiento automatizado.'
      ],
      secundarias: [
        'Previsualizar el documento generado con el visor de PDF.',
        'Marcar como "Aprobado" cuando el paciente confirme la fecha quirúrgica.',
        'Si el presupuesto expira o es rechazado, seleccionar la categoría de objeción para alimentar el Pareto.'
      ]
    },
    fields: [
      { name: 'Paciente', type: 'Búsqueda', required: true, description: 'Paciente destinatario con teléfono celular válido.' },
      { name: 'Ojo', type: 'Selector (OD/OI/AO)', required: true, description: 'Lateralidad a presupuestar.' },
      { name: 'Práctica Médica', type: 'Selector', required: true, description: 'Código nomenclado del procedimiento quirúrgico.' },
      { name: 'Modelo de LIO', type: 'Selector Alcon', required: false, description: 'Lente intraocular Alcon que define el costo del insumo.' },
      { name: 'Total ARS / USD', type: 'Numérico', required: true, description: 'Importe final liquidable calculado por el sistema.' },
      { name: 'Validez Arancelaria', type: 'Numérico (15 días)', required: true, description: 'Período en el cual se garantiza el valor monetario antes de reajustes.' },
      { name: 'Categoría de Objeción', type: 'Selector Normalizado', required: false, description: 'Motivo de rechazo o no aprobación para el análisis Pareto.' }
    ],
    faqs: [
      {
        question: 'Al enviar por WhatsApp indica "Número de teléfono inválido".',
        cause: 'El número no tiene el prefijo de país internacional o contiene espacios/guiones.',
        solution: 'Editar los datos del paciente y colocar el formato completo (ej. +5491144556677).'
      },
      {
        question: 'El presupuesto venció los 15 días de validez: ¿cómo proceder?',
        cause: 'Se superó el plazo de garantía arancelaria estipulado institucionalmente.',
        solution: 'Generar una actualización o clon del presupuesto con los valores vigentes o consultar con dirección para extender la validez.'
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
