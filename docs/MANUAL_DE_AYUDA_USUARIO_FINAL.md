# Manual de Ayuda y Base de Conocimientos: CRM Médico Inteligente

Bienvenido al **Centro de Conocimiento y Guía de Operación del CRM Médico Cloud**. Este manual interactivo está diseñado para guiar paso a paso a todo el personal de la clínica (recepcionistas, asesores quirúrgicos, operadores de WhatsApp, secretarias médicas y administradores) en el uso de cada herramienta del sistema.

---

## 🧭 Índice General de Navegación y Flujo Operativo

El CRM está organizado siguiendo el flujo natural de atención del paciente desde su primer contacto hasta el alta postquirúrgica:

1. [Módulo 1: Chats / WhatsApp Omnicanal e Inteligencia Artificial (`/chat`)](#módulo-1-chats--whatsapp-omnicanal-e-inteligencia-artificial-chat)
2. [Módulo 2: Agenda Geclisa y Recepción de Pacientes (`/agenda-geclisa`)](#módulo-2-agenda-geclisa-y-recepción-de-pacientes-agenda-geclisa)
3. [Módulo 3: Asesoramiento Quirúrgico - Pipeline Kanban (`/pipeline-quirurgico`)](#módulo-3-asesoramiento-quirúrgico---pipeline-kanban-pipeline-quirurgico)
4. [Módulo 4: Recepción del Día en Asesoría (`/asesoramiento-recepcion`)](#módulo-4-recepción-del-día-en-asesoría-asesoramiento-recepcion)
5. [Módulo 5: Quirófano - Agenda y Slots (`/programacion-quirurgica`)](#módulo-5-quirófano---agenda-y-slots-programacion-quirurgica)
6. [Módulo 6: Quirófano - Pizarra en Vivo (`/quirofano-en-vivo`)](#módulo-6-quirófano---pizarra-en-vivo-quirofano-en-vivo)
7. [Módulo 7: Cálculo Biométrico de LIO Alcon (`/calculo-lio`)](#módulo-7-cálculo-biométrico-de-lio-alcon-calculo-lio)
8. [Módulo 8: Presupuestos Médicos y Cotizador Formal (`/presupuestos`)](#módulo-8-presupuestos-médicos-y-cotizador-formal-presupuestos)
9. [Módulo 9: Expedientes de Pacientes y Consentimiento Digital (`/pacientes`)](#módulo-9-expedientes-de-pacientes-y-consentimiento-digital-pacientes)
10. [Módulo 10: Logs y Auditoría del Sistema (`/logs`)](#módulo-10-logs-y-auditoría-del-sistema-logs)
11. [Módulo 11: Ajustes y Administración Global (`/ajustes`)](#módulo-11-ajustes-y-administración-global-ajustes)
12. [Módulo 12: Centro de Ayuda Integrado (`/ayuda`)](#módulo-12-centro-de-ayuda-integrado-ayuda)

---

### Módulo 1: Chats / WhatsApp Omnicanal e Inteligencia Artificial (`/chat`)
> **Resumen en 1 línea:** Gestiona la comunicación directa por WhatsApp con pacientes, supervisa las respuestas del bot Gemini e interviene manualmente cuando se requiere atención personalizada.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Navegar a **Chats / WhatsApp** desde la barra lateral.
  2. En el panel izquierdo, revisar la lista de conversaciones activas ordenadas cronológicamente.
  3. Identificar el estado: si el chat tiene el ícono de **Robot Verde**, el Asistente IA (Gemini) está respondiendo automáticamente. Si tiene el ícono de **Usuario Azul** o advertencia, requiere intervención de un operador humano.
  4. Para tomar el control humano del chat, hacer clic en el botón superior **"Toggle Human"** (cambia de *Bot IA Activo* a *Modo Humano*). Esto pausa las respuestas automáticas de Gemini en esa conversación.
  5. Escribir la respuesta en la caja de texto inferior, o seleccionar una plantilla/respuesta rápida.
  6. Confirmar el envío presionando la tecla `Enter` o el botón de flecha azul (Enviar).
- **Acciones secundarias:**
  - **Uso de Respuestas Rápidas:** Hacer clic en el ícono de rayo (`⚡`) para insertar textos institucionales predefinidos (horarios, indicaciones prequirúrgicas, medios de pago).
  - **Uso de Plantillas Oficiales de Meta:** Cuando una conversación haya superado las 24 horas de inactividad por parte del paciente, presionar el botón **"Plantillas Meta"** para enviar un mensaje homologado de reactivación.
  - **Reactivación del Bot:** Una vez finalizada la consulta humana, volver a presionar **"Toggle Human"** para devolver la conversación al asistente inteligente.
  - **Adjuntar archivos:** Hacer clic en el ícono de clip para enviar PDFs de presupuestos o indicaciones médicas.

[CAPTURA: Bandeja de entrada de WhatsApp con panel lateral de conversaciones, visualización de mensajes y botón Toggle Human en cabecera]

#### 2. Diccionario de Campos
| Campo | Tipo | Requerido | Descripción / Regla de Negocio |
| :--- | :--- | :--- | :--- |
| **Buscador de Chats** | Texto | No | Filtra conversaciones por nombre del paciente o número de teléfono. |
| **Caja de Mensaje** | Texto multilínea | Sí | Contenido del mensaje a remitir. Admite saltos de línea con `Shift + Enter`. |
| **Toggle Human (IA / Humano)** | Interruptor (Booleano) | Sí | Determina si el bot Gemini responde automáticamente (`true`) o está en pausa (`false`). |
| **Selector de Plantilla Meta** | Selector modal | Condicional | Obligatorio si la ventana de 24 horas de WhatsApp expiró. Permite elegir la categoría aprobada. |
| **Adjunto Multimedia** | Archivo (PDF, JPG, PNG) | No | Archivo complementario con peso máximo admitido de 15 MB. |

#### 3. Errores Comunes y Soluciones (FAQ / Troubleshooting)
- **Problema:** Al enviar un mensaje aparece el error *"Error: Outside 24-hour window. Requires approved Meta template"*.
  - **Causa probable:** Han transcurrido más de 24 horas desde el último mensaje recibido del paciente y las políticas de Meta impiden enviar texto libre.
  - **Solución:** Hacer clic en el botón **"Plantillas Meta"**, seleccionar una plantilla homologada de utilidad/recordatorio y enviarla. Una vez que el paciente responda, se reabrirá la ventana libre de 24 horas.
- **Problema:** El bot Gemini responde respuestas automáticas mientras el operador humano intenta escribir.
  - **Causa probable:** No se pausó el bot antes de intervenir en la conversación.
  - **Solución:** Pulsar de inmediato el interruptor **"Bot IA / Modo Humano"** en el encabezado superior del chat para activar el modo humano exclusivo.

---

### Módulo 2: Agenda Geclisa y Recepción de Pacientes (`/agenda-geclisa`)
> **Resumen en 1 línea:** Consulta turnos sincronizados en tiempo real con el sistema de escritorio Geclisa y realiza el Check-in (Dar Presente) de pacientes en sala de espera.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Navegar a **Agenda Geclisa** en el menú lateral.
  2. Seleccionar la **Fecha** a consultar (por defecto carga el día de hoy) y el **Médico Prestador** en el desplegable.
  3. Localizar al paciente en la grilla mediante el buscador por DNI o Apellido.
  4. Cuando el paciente se presente físicamente en recepción con su carnet y DNI, hacer clic en el botón verde **"Dar Presente"**.
  5. El estado del turno cambia instantáneamente a verde `Presente`, notificando al médico en su consultorio que el paciente aguarda en sala de espera.
- **Acciones secundarias:**
  - **Sincronización Forzada:** Si un turno fue otorgado recientemente en Geclisa de escritorio y aún no figura en pantalla, hacer clic en el botón superior **"Sincronizar Geclisa"** (ícono de flechas circulares) para actualizar la grilla en menos de 3 segundos.
  - **Ver Ficha Clínica Rápida:** Hacer clic en el nombre del paciente para previsualizar antecedentes y datos de cobertura.

[CAPTURA: Grilla de Agenda Geclisa con selector de fecha, botón Sincronizar Geclisa y columna de acción Dar Presente]

#### 2. Diccionario de Campos
| Campo | Tipo | Requerido | Descripción / Regla de Negocio |
| :--- | :--- | :--- | :--- |
| **Fecha de Agenda** | Selector de Fecha | Sí | Día de atención a consultar. Admite navegación día a día con flechas. |
| **Prestador Médico** | Selector desplegable | Sí | Profesional médico cuya agenda se está visualizando. |
| **Buscador de Paciente** | Texto | No | Filtro reactivo en tiempo real por DNI, Nombre o N° de Ficha Geclisa. |
| **Estado de Turno** | Indicador badge | Sí | Estado del turno: `Pendiente`, `Presente` (check-in realizado) o `Atendido`. |

#### 3. Errores Comunes y Soluciones (FAQ / Troubleshooting)
- **Problema:** Un paciente acaba de sacar turno en el mostrador mediante Geclisa de escritorio pero no figura en la grilla del CRM.
  - **Causa probable:** La sincronización periódica automática aún no disparó su ciclo.
  - **Solución:** Hacer clic en el botón superior **"Sincronizar Geclisa"**. El sistema invocará el endpoint directo de la API y refrescará la grilla al instante.
- **Problema:** El botón "Dar Presente" no responde o muestra un error de conexión.
  - **Causa probable:** Pérdida de enlace con el servidor local de base de datos de Geclisa.
  - **Solución:** Constatar la conexión a la red de la clínica. Si persiste, dar presente en el sistema Geclisa de escritorio y reportar a Soporte TI.

---

### Módulo 3: Asesoramiento Quirúrgico - Pipeline Kanban (`/pipeline-quirurgico`)
> **Resumen en 1 línea:** Monitorea y gestiona el embudo comercial y quirúrgico de pacientes derivados a cirugía desde la primera consulta hasta la intervención.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Navegar a **Asesoramiento > Pipeline** en la barra lateral.
  2. Visualizar las 5 columnas activas del embudo:
     - **1. Derivados:** Pacientes recién derivados desde el consultorio médico para evaluación quirúrgica.
     - **2. En Asesoramiento:** Paciente contactado, en proceso de explicación médica y despeje de dudas.
     - **3. En Análisis:** Presupuesto entregado; paciente evaluando cobertura de prepaga o financiación.
     - **4. Confirmados:** Cirugía confirmada por el paciente (pendiente de reserva de quirófano o pago de seña).
     - **5. Programados Qx:** Paciente con fecha, sala y equipo quirúrgico asignado formalmente.
  3. Para avanzar un caso, arrastrar la tarjeta del paciente con el ratón (Drag & Drop) hacia la siguiente columna, o abrir el caso y seleccionar la nueva etapa en el selector.
  4. Revisar los indicadores de alerta: tarjetas con borde amarillo o rojo indican casos que han superado los días máximos tolerables sin contacto (SLA).
- **Acciones secundarias:**
  - **Registrar Evolución / Llamada:** Hacer clic en la tarjeta del paciente y agregar una nota de contacto (ej. *"Se contactó por WhatsApp, solicita financiación con tarjeta"*).
  - **Cerrar Caso (Desistido / Cancelado):** Si el paciente decide no operarse, hacer clic en "Cerrar Caso", seleccionar obligatoriamente el motivo formal (Económico, Prefiere postergar, Operado en otra clínica) y asentar observaciones.

[CAPTURA: Tablero Kanban del Pipeline Quirúrgico con las 5 columnas activas, tarjetas de casos y semáforo SLA de inactividad]

#### 2. Diccionario de Campos
| Campo | Tipo | Requerido | Descripción / Regla de Negocio |
| :--- | :--- | :--- | :--- |
| **Paciente** | Selector / Búsqueda | Sí | Nombre y DNI del paciente derivado a cirugía. |
| **Práctica Quirúrgica** | Selector | Sí | Código y denominación de la cirugía (ej. Facoemulsificación con Implante de LIO). |
| **Lateralidad (Ojo)** | Selector (OD / OI / AO) | Sí | Ojo a intervenir: Derecho (OD), Izquierdo (OI) o Ambos Ojos (AO). |
| **Etapa del Embudo** | Selector | Sí | Una de las 5 fases del pipeline (*Derivados, En Asesoramiento, En Análisis, Confirmados, Programados*). |
| **Asesor Asignado** | Selector de Usuario | No | Colaborador administrativo responsable del seguimiento del caso. |
| **Motivo de Cancelación** | Selector normalizado | Condicional | Obligatorio al mover un caso a estado Cancelado o Desistido. |

#### 3. Errores Comunes y Soluciones (FAQ / Troubleshooting)
- **Problema:** Una tarjeta aparece con un marco rojo titilante y la leyenda *"Alerta SLA: 8 días sin contacto"*.
  - **Causa probable:** Se superó el umbral configurado de días admisibles sin asentar novedades en el caso.
  - **Solución:** Contactar de inmediato al paciente por WhatsApp o teléfono, registrar la novedad en el historial del caso y definir la fecha del próximo contacto programado.
- **Problema:** El sistema no permite archivar un caso cancelado.
  - **Causa probable:** No se seleccionó el motivo de cierre obligatorio en el modal.
  - **Solución:** Abrir el modal de cierre, marcar el motivo correspondiente en el desplegable y confirmar.

---

### Módulo 4: Recepción del Día en Asesoría (`/asesoramiento-recepcion`)
> **Resumen en 1 línea:** Controla en tiempo real los pacientes presentes en sala de espera que fueron derivados a la oficina de asesoramiento quirúrgico.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Navegar a **Asesoramiento > Recepción del Día**.
  2. Revisar la lista de pacientes recepcionados durante la jornada para consulta de presupuesto o asesoría.
  3. Cuando se libere el despacho del asesor, ubicar al paciente en la fila y presionar el botón **"Llamar Paciente"**.
  4. El estado pasa a `En Atención`, registrando la hora exacta de inicio de la entrevista.
  5. Al concluir la entrevista de asesoramiento, marcar **"Finalizar Atención"** para computar el tiempo de espera y atención en las métricas de calidad.

[CAPTURA: Pantalla de Recepción del Día con pacientes en espera, orden de llegada y botón Llamar Paciente]

#### 2. Diccionario de Campos
| Campo | Tipo | Requerido | Descripción / Regla de Negocio |
| :--- | :--- | :--- | :--- |
| **Hora de Ingreso** | Hora (HH:MM) | Sí | Registro automático de cuándo el paciente ingresó al área de asesoría. |
| **Paciente** | Texto | Sí | Nombre y cobertura médica del paciente en espera. |
| **Médico Derivante** | Texto | Sí | Profesional oftalmólogo que indicó la consulta de asesoramiento. |
| **Estado en Sala** | Badge | Sí | `En Espera`, `En Atención` o `Atendido`. |

---

### Módulo 5: Quirófano - Agenda y Slots (`/programacion-quirurgica`)
> **Resumen en 1 línea:** Programa intervenciones quirúrgicas, reserva franjas horarias (slots), quirófanos y asigna el equipo médico.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Navegar a **Quirófano > Agenda & Slots**.
  2. Seleccionar la fecha programada de cirugía y la Sala de Quirófano (ej. *Quirófano 1*).
  3. Hacer clic en una franja horaria disponible o presionar **"Programar Cirugía"**.
  4. Seleccionar el paciente confirmado, el cirujano principal, el anestesiólogo y el modelo de Lente Intraocular (LIO) asignado.
  5. Confirmar mediante el botón **"Guardar Programación"**. La cirugía queda agendada con bloqueo de slot.

[CAPTURA: Calendario de Slots Quirúrgicos por sala con cirugías asignadas y horarios bloqueados]

#### 2. Diccionario de Campos
| Campo | Tipo | Requerido | Descripción / Regla de Negocio |
| :--- | :--- | :--- | :--- |
| **Quirófano / Sala** | Selector | Sí | Sala física de cirugía asignada. |
| **Horario de Inicio / Fin** | Hora (HH:MM) | Sí | Ventana de tiempo reservada para la intervención y desinfección. |
| **Cirujano Principal** | Selector | Sí | Profesional médico a cargo de la cirugía. |
| **Anestesista** | Selector | No | Profesional anestesiólogo requerido según el tipo de sedación. |
| **LIO Reservado** | Selector | Condicional | Obligatorio en cirugías de catarata y facoemulsificación. |

---

### Módulo 6: Quirófano - Pizarra en Vivo (`/quirofano-en-vivo`)
> **Resumen en 1 línea:** Visualiza y actualiza en tiempo real el estado de cada paciente en el área quirúrgica para coordinación interna e informe a familiares.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Abrir **Quirófano > Pizarra en Vivo** (optimizado para pantallas de recepción y monitores de quirófano).
  2. Identificar al paciente en la grilla interactiva.
  3. A medida que avanza el procedimiento, el personal de quirófano actualiza el estado haciendo clic en el chip correspondiente:
     - `En Espera / Dilatación` ➔ `En Quirófano` ➔ `En Recuperación` ➔ `Alta Médica`.
  4. El personal de mostrador puede consultar esta pantalla en cualquier momento para informar a los familiares en sala de espera con precisión y calidez.

[CAPTURA: Pizarra interactiva en tiempo real con tarjetas de pacientes y barras de progreso del acto quirúrgico]

---

### Módulo 7: Cálculo Biométrico de LIO Alcon (`/calculo-lio`)
> **Resumen en 1 línea:** Herramienta de cálculo y selección óptica de lentes intraoculares para cirugías de catarata y presbicia con catálogo Alcon.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Navegar a **Quirófano > Cálculo de LIO**.
  2. Seleccionar el paciente y cargar los parámetros biométricos: Longitud Axial (AL), Queratometrías (K1, K2) y Profundidad de Cámara Anterior (ACD).
  3. Elegir la fórmula biométrica recomendada (Barrett Universal II, SRK/T, Haigis).
  4. Comparar potencias para las lentes del catálogo (Monofocal Clareon, Tóricas AcrySof, Vivity o PanOptix).
  5. Presionar **"Guardar en Expediente"** para vincular el cálculo definitivo a la cirugía del paciente.

[CAPTURA: Calculadora óptica con selector de fórmulas, potencias de dioptrías y catálogo Alcon]

---

### Módulo 8: Presupuestos Médicos y Cotizador Formal (`/presupuestos`)
> **Resumen en 1 línea:** Elabora cotizaciones quirúrgicas formales en pesos y dólares, genera el documento PDF oficial y lo envía por WhatsApp en 1 clic.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Ingresar a **Presupuestos** y seleccionar la pestaña **"Crear Presupuesto"**.
  2. Buscar al paciente en la base de datos o crearlo en el momento indicando su teléfono celular.
  3. Seleccionar la lateralidad (OD, OI o Ambos Ojos), la práctica quirúrgica prescripta y el modelo de Lente Intraocular (LIO) si aplica.
  4. Revisar el desglose automático de honorarios médicos, gastos sanatoriales e insumos en ARS y USD.
  5. Hacer clic en **"Generar Presupuesto Formal"**. El sistema compila el archivo PDF oficial numerado con membrete, firma y código de validación.
  6. Para enviar la propuesta al paciente, presionar el botón **"Enviar por WhatsApp"**. Se abrirá el modal con el mensaje estructurado y el enlace seguro de descarga del PDF.
- **Acciones secundarias:**
  - **Aprobar Presupuesto:** Cuando el paciente confirma la aceptación, cambiar el estado a `Aprobado`.
  - **Clonar Presupuesto:** Permite duplicar un presupuesto previo para cotizar una opción alternativa de lente con un solo clic.

[CAPTURA: Generador de presupuestos con desglose de ítems, totales multimoneda y botón Enviar por WhatsApp]

#### 2. Diccionario de Campos
| Campo | Tipo | Requerido | Descripción / Regla de Negocio |
| :--- | :--- | :--- | :--- |
| **Paciente** | Búsqueda | Sí | Paciente titular del presupuesto. Debe contar con teléfono celular válido. |
| **Ojo (Lateralidad)** | Selector (OD / OI / AO) | Sí | Ojo derecho, ojo izquierdo o ambos ojos. Multiplica los ítems correspondientes. |
| **Práctica Médica** | Selector nomenclado | Sí | Código de la intervención según el nomenclador arancelario institucional. |
| **Modelo de LIO** | Selector de catálogo | Condicional | Tipo y modelo de lente Alcon a implantar. Determina el costo del insumo. |
| **Total en Pesos (ARS)** | Numérico (Moneda) | Sí | Importe liquidable en moneda nacional. |
| **Total en Dólares (USD)** | Numérico (Moneda) | Sí | Contravalor de referencia en moneda extranjera. |

#### 3. Errores Comunes y Soluciones (FAQ / Troubleshooting)
- **Problema:** Al hacer clic en "Enviar por WhatsApp", el sistema indica que el número telefónico es inválido.
  - **Causa probable:** El número fue ingresado sin el código de país o con guiones/espacios (ej. `11-4455-6677`).
  - **Solución:** Editar la ficha del paciente y verificar que el teléfono tenga el formato internacional completo (ej. `+5491144556677`).

---

### Módulo 9: Expedientes de Pacientes y Consentimiento Digital (`/pacientes`)
> **Resumen en 1 línea:** Gestiona el maestro de pacientes, antecedentes, emisión de recetas ópticas/farmacológicas y despacho de Consentimientos Informados con firma digital en el móvil.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Navegar a **Pacientes** en el menú principal.
  2. Localizar al paciente por DNI, Apellido o Nombre mediante el buscador.
  3. Hacer clic en el paciente para abrir su expediente integral.
  4. Para emitir un Consentimiento Informado previo a una cirugía, ingresar a la pestaña quirúrgica y presionar **"Generar Consentimiento Digital"**.
  5. Seleccionar la práctica (Cataratas, LASIK, Inyecciones) y presionar **"Enviar Token al Celular"**.
  6. El paciente recibe un enlace cifrado por WhatsApp, lee los riesgos y firma directamente en la pantalla de su celular.
  7. El CRM actualiza el estado a `Firmado y Verificado`, grabando fecha, hora, hash e IP de origen.

[CAPTURA: Expediente del paciente con historial de consultas, consentimientos firmados y estado de verificación]

---

### Módulo 10: Logs y Auditoría del Sistema (`/logs`)
> **Resumen en 1 línea:** Consulta registros de eventos, auditoría de accesos y trazas de comunicación externa para cumplimiento de calidad y seguridad.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Ingresar a **Logs & Auditoría** en el menú lateral.
  2. Filtrar por tipo de evento: `Autenticación`, `WhatsApp Gateway`, `Geclisa Sync`, `Presupuestos` o `Errores de Sistema`.
  3. Revisar el detalle del evento para auditar qué usuario ejecutó cada acción y en qué marca horaria.

---

### Módulo 11: Ajustes y Administración Global (`/ajustes`)
> **Resumen en 1 línea:** Configuración general de la clínica, administración de usuarios y roles RBAC, catálogo de lentes LIO, aranceles y directivas del Agente IA.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Ingresar a **Ajustes** en la parte inferior del menú lateral.
  2. Seleccionar la pestaña de interés:
     - **Catálogo de LIO:** Altas y actualización de precios de lentes intraoculares.
     - **Nomenclador:** Aranceles de prácticas médicas y honorarios.
     - **Usuarios y Roles (RBAC):** Creación de personal y asignación de permisos por módulo.
     - **Agente IA Gemini:** Ajuste del System Prompt y reglas de derivación del bot.
     - **Branding:** Modificación del membrete, logotipo y datos de la clínica para los PDFs.

---

### Módulo 12: Centro de Ayuda Integrado (`/ayuda`)
> **Resumen en 1 línea:** Accede a la base de conocimientos interactiva, busca soluciones rápidas, consulta diccionarios de campos y descarga el manual oficial en PDF.

#### 1. Guía Paso a Paso (How-To)
- **Flujo habitual:**
  1. Hacer clic en **"Centro de Ayuda"** (ícono `?`) ubicado en la parte inferior del menú lateral, junto a *Ajustes*.
  2. Utilizar el **Buscador en Tiempo Real** para escribir cualquier duda (ej. *"¿Cómo pausar el bot?"*, *"SLA en rojo"*, *"Error de 24 horas"*).
  3. Filtrar por módulo mediante los botones temáticos.
  4. Para descargar la versión oficial para impresión o auditoría, presionar el botón superior **"Descargar Manual Completo en PDF"**.

---

## 💡 Buenas Prácticas Generales para el Personal

1. **Atención Cálida y Protocolar:** Al intervenir manualmente en chats de WhatsApp, saluda siempre con el nombre del paciente y mantén la identidad corporativa de la clínica.
2. **Sincronización Periódica:** Si notas demoras entre los turnos del consultorio y el CRM, utiliza el botón "Sincronizar Geclisa" para forzar la actualización inmediata.
3. **No postergues el registro de novedades:** Cada llamada o contacto con un paciente quirúrgico debe asentarse en el Pipeline para evitar que el semáforo de SLA pase a color rojo.
4. **Seguridad ante todo:** Cierra siempre tu sesión al retirarte del puesto de trabajo para proteger los datos médicos de los pacientes conforme a la Ley 25.326.
