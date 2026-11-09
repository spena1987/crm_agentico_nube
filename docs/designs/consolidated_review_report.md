# Informe Consolidado de Revisión (EGM Swarm Review Report)

* **Documento Evaluado:** [`docs/designs/automatizacion_agenda_prestadores_whatsapp.md`](file:///d:/Github/crm_agentico_nube/docs/designs/automatizacion_agenda_prestadores_whatsapp.md)
* **Fecha de Evaluación:** 2026-11-08
* **Modo:** Uninterrupted Full Flow
* **Revisores Participantes:**
  * `egm-zoom-out` (Skeptical Architect)
  * `egm-inventive-catalyst` (Inventive Catalyst)
  * `egm-comprehension` (Naive Reader)
  * `egm-design` (Hostile Design Critic)
  * `egm-structural` (Structural Layout Validator)
  * `egm-style` (Technical Copy Editor)
  * `egm-implementation-readiness` (Pragmatic Tech Lead)
  * `egm-codebase-details` (Technical Quality Auditor)

---

## 1. Resumen Ejecutivo del Enjambre

El objetivo del diseño (automatizar el envío de agendas quirúrgicas consolidadas en PDF a cirujanos y derivadores mediante WhatsApp Cloud API, superando la restricción de 1024 caracteres de Meta) es **conceptualmente válido y resuelve una necesidad operativa real**.

Sin embargo, el enjambre de 8 revisores ha detectado **4 bloqueadores arquitectónicos y de integración con el codebase**, junto con vulnerabilidades de concurrencia, cálculo de días hábiles y fallas en rutas de archivos que imposibilitan su implementación inmediata sin ajustes previos.

### Resumen de Severidad de Hallazgos:
* 🔴 **Bloqueadores (Blockers):** 4
* 🟡 **Mayores (Majors):** 7
* 🟢 **Menores (Nits):** 3

---

## 2. Hallazgos Consolidados Priorizados

### 🔴 Bloqueadores (Blockers)

#### B1: Referencia a Archivo Inexistente `quirofano_router.py` en Backend
* **Lentes:** `egm-codebase-details`, `egm-implementation-readiness`, `egm-zoom-out`
* **Alcance:** Paso 6 (L314-L316) y Lista de Archivos Touched (L334-L342).
* **Diagnóstico:** El diseño clasifica como `(Modificación)` a `backend/app/routers/quirofano_router.py`. Dicho archivo no existe en el codebase actual; todas las rutas quirúrgicas residen en `backend/app/main.py`.
* **Acción Requerida:** 
  1. Definir formalmente un nuevo router modular dedicado: `backend/app/routers/notificaciones_prestadores_router.py` (`(Nuevo)`).
  2. Incluir en `backend/app/main.py` la importación y montaje: `app.include_router(notificaciones_prestadores_router.router, prefix="/api/turnos-quirofano/notificaciones-prestadores")`.

#### B2: Rutas Inexistentes y Desalineación del Stack en Frontend
* **Lentes:** `egm-codebase-details`, `egm-implementation-readiness`
* **Alcance:** Lista de Archivos Touched Frontend (L356-L366).
* **Diagnóstico:** 
  1. Los paths omiten el prefijo raíz `frontend/` (el código Next.js está en `frontend/src/...`).
  2. `src/services/quirofanoService.ts` no existe y `axios` no está en dependencias; el proyecto utiliza `apiFetch` de `@/lib/api`.
  3. `PizarraQuirofano.tsx` no existe; las vistas reales son `frontend/src/app/programacion-quirurgica/page.tsx` y `frontend/src/components/quirofano/PizarraQuirofanoEnVivo.tsx`.
  4. No existe `components/ajustes/`; los paneles residen en `frontend/src/components/settings/*Card.tsx`.
* **Acción Requerida:** 
  1. Corregir todas las rutas a `frontend/src/...`.
  2. Utilizar `apiFetch` para las llamadas al backend.
  3. Incorporar la alerta visual y botón de despacho en `frontend/src/app/programacion-quirurgica/page.tsx` y `PizarraQuirofanoEnVivo.tsx`.
  4. Crear `frontend/src/components/settings/ConfiguracionNotificacionesCirugiasCard.tsx` e integrarlo en `frontend/src/app/ajustes/page.tsx`.

#### B3: Falla en Cálculo de Días Hábiles (Cirugías de Lunes y Martes Huérfanas)
* **Lentes:** `egm-design`, `egm-comprehension`
* **Alcance:** Sección 1 (L33, L59-L63, L94-L95) y Sección 5.A (L215-L224).
* **Diagnóstico:** Proyectar la fecha sumando $T + 2$ días calendario con un cron que corre de lunes a viernes (`dias_habilitados: [1,2,3,4,5]`) provoca que las cirugías del lunes (corte requerido en sábado) y del martes (corte requerido en domingo) **nunca sean notificadas**.
* **Acción Requerida:** 
  1. Sustituir la suma aritmética simple por cálculo de **días hábiles quirúrgicos**.
  2. Especificar que el corte del viernes a las 19:00 hs procesa y despacha automáticamente las cirugías del lunes subsiguiente (anticipación de 72 hs hábiles), e incluir opción para sábados si hubiera actividad programada.

#### B4: Ausencia de Idempotencia y Bloqueo Concurrente (Riesgo de Envío Duplicado)
* **Lentes:** `egm-design`, `egm-inventive-catalyst`, `egm-zoom-out`, `egm-comprehension`, `egm-implementation-readiness`
* **Alcance:** Secuencia de Ejecución (L131-L164), Tabla de Logs (L227-L241) y Cron Runner (L311-L313).
* **Diagnóstico:** En despliegues con múltiples workers Uvicorn o ante la superposición entre el cron de las 19:00 hs y un click manual en el CRM, el sistema no posee locking distribuido ni restricción de unicidad en la base de datos, lo que generará envíos dobles de WhatsApp y PDFs duplicados a los médicos.
* **Acción Requerida:** 
  1. Incorporar bloqueo a nivel PostgreSQL: `pg_try_advisory_xact_lock(hashtext('corte_prestadores_' || fecha_objetivo))` al inicio del proceso.
  2. Agregar restricción de unicidad en `notificaciones_prestadores_logs`: `UNIQUE(fecha_cirugia, fecha_corte, prestador_id)` para prevenir duplicados a menos que se invoque con `forzar=true`.
  3. Fijar la zona horaria explícita de evaluación en `ZoneInfo("America/Argentina/Buenos_Aires")` (UTC-3).

---

### 🟡 Hallazgos Mayores (Majors)

#### M1: Reinvención de Aprovisionamiento de Plantillas Meta (YAGNI)
* **Lentes:** `egm-zoom-out`, `egm-comprehension`
* **Alcance:** Sección 3 (L188-L192) y Paso 2 (L294-L296).
* **Diagnóstico:** Crear un endpoint `POST .../aprovisionar-plantilla` es innecesario. El alta de plantillas en Meta es un evento administrativo único. Además, el repositorio ya cuenta con `backend/app/services/whatsapp_cloud/templates.py` con sincronización de plantillas y base de datos.
* **Acción Requerida:** Eliminar el endpoint de aprovisionamiento del alcance de este servicio; documentar la plantilla para su gestión mediante el módulo centralizado de plantillas o Meta Business Manager.

#### M2: Reutilización de Capacidades Existentes en `WhatsAppCloudClient`
* **Lentes:** `egm-zoom-out`
* **Alcance:** Paso 4 (L331-L333).
* **Diagnóstico:** El plan prevé "modificar y verificar soporte" en `WhatsAppCloudClient` para `upload_media_bytes` y plantillas con documento. Dichas funciones **ya están 100% implementadas y probadas** en el cliente (soporta subida binaria y componentes arbitrarios con `media_id`).
* **Acción Requerida:** Marcar `WhatsAppCloudClient` como componente reutilizado sin requerir modificaciones estructurales en su lógica de despacho.

#### M3: Integración con el Motor Centralizado `pdf_service.py`
* **Lentes:** `egm-zoom-out`, `egm-implementation-readiness`
* **Alcance:** Paso 3 (L298-L300) y Archivo 1 (L328-L330).
* **Diagnóstico:** Diseñar una clase aislada `AgendaQuirurgicaPdfBuilder` duplica membretes, logos y estilos ReportLab existentes en `backend/app/services/pdf_service.py`.
* **Acción Requerida:** Construir la función de generación (`generar_pdf_agenda_prestadores`) reutilizando los helpers de membrete institucional (`obtener_o_cachear_logo_local`) y estilos tipográficos de `pdf_service.py`.

#### M4: Timeout HTTP en Endpoint de Disparo Manual
* **Lentes:** `egm-design`, `egm-inventive-catalyst`
* **Alcance:** CUJ 2 (L69-L76) y Secuencia (L148-L163).
* **Diagnóstico:** En jornadas con 20 prestadores, compilar 20 PDFs y ejecutar 40 llamadas de red a Meta acumula entre 45 y 60 segundos de latencia, provocando un error `504 Gateway Timeout` en proxies web (Vercel/Cloudflare).
* **Acción Requerida:** Diseñar el endpoint manual como asincrónico: recibe la solicitud, lanza la tarea en `FastAPI.BackgroundTasks` y responde inmediatamente `202 Accepted` con un identificador de seguimiento.

#### M5: Privacidad de Datos Médicos (PHI / Ley 25.326)
* **Lentes:** `egm-design`
* **Alcance:** Contenido del PDF (L113-L115) y Observaciones (L114).
* **Diagnóstico:** Enviar DNIs sin enmascarar y observaciones internas de quirófano (`observaciones_quirofano`) a dispositivos personales de terceros ante un error de tipeo en el número telefónico vulnera la privacidad de datos sensibles de salud.
* **Acción Requerida:** Enmascarar el DNI en el PDF (ej. `XX.XXX.123`), sanitizar las observaciones excluyendo notas operativas de uso exclusivo de sala, e incorporar leyenda legal de confidencialidad en el pie del PDF.

#### M6: Resolución Robusta de Médicos Derivadores
* **Lentes:** `egm-design`, `egm-comprehension`, `egm-codebase-details`
* **Alcance:** L102-L106.
* **Diagnóstico:** `medico_derivador_nombre` en `turnos_quirofano` es texto libre (ej. "Dr. Bonanno", "Bonanno Pablo"), lo que causará fallas en el cruce de prestadores.
* **Acción Requerida:** Reutilizar la función existente [`obtener_prestador_por_cirujano`](file:///d:/Github/crm_agentico_nube/backend/app/db.py) de `app.db` que normaliza prefijos y apellidos, y retornar el estado `DERIVADOR_NO_RESOLUBLE` en el endpoint de pre-vuelo si no hay coincidencia unívoca.

#### M7: Modelos Pydantic y Script SQL DDL Ejecutable
* **Lentes:** `egm-implementation-readiness`, `egm-structural`
* **Alcance:** Sección 5 (L214-L241) y Paso 1 (L290-L293).
* **Diagnóstico:** El plan omite los contratos de API (Request/Response schemas) y la definición SQL DDL ejecutable (claves primarias, tipos exactos `TIMESTAMPTZ`, índices).
* **Acción Requerida:** Incorporar los contratos Pydantic exactos y el bloque DDL ejecutable en `database/migrations/027_notificaciones_prestadores_agenda.sql`.

---

### 🟢 Hallazgos Menores (Nits)

#### N1: Calibración de Estilo, Glosario y Limpieza de Prose
* **Lentes:** `egm-style`, `egm-comprehension`
* **Diagnóstico:** Presencia de términos no calibrados ("sin depender de servicios externos", "quintuplica el costo"), pleonasmos ("máximo estricto"), jerga ("gatillar"), y acrónimos no definidos en su primera aparición (`LIO`, `WABA`, `wamid`).
* **Acción Requerida:** Ajustar la redacción a tono técnico y agregar un glosario breve de términos.

#### N2: Estandarización de Estructura y Encabezados
* **Lentes:** `egm-structural`
* **Diagnóstico:** Puntuación terminal con dos puntos (`:`) en encabezados de nivel 4, mezcla de idiomas en títulos H3, y fórmulas matemáticas con delimitadores `$T+2$` no escapados.
* **Acción Requerida:** Limpiar la puntuación de encabezados, estandarizar títulos y usar literales de código inline (`T + 2`).

#### N3: Digest Criptográfico para Auditoría Extensible
* **Lentes:** `egm-inventive-catalyst`
* **Diagnóstico:** Meta elimina los archivos PDF tras 30 días, impidiendo cotejar el documento exacto enviado si surge un reclamo posterior.
* **Acción Requerida:** Guardar en `notificaciones_prestadores_logs` el hash SHA-256 del PDF (`pdf_sha256`) y un snapshot JSON con los turnos notificados.

---

## 3. Matriz de Trazabilidad de Hallazgos

| ID | Hallazgo Consolidado | Severidad | Revisores que lo detectaron | Acción de Remediación |
| :--- | :--- | :---: | :--- | :--- |
| **B1** | Archivo `quirofano_router.py` inexistente | 🔴 Blocker | Codebase Details, Readiness, Zoom Out | Crear `notificaciones_prestadores_router.py` y montarlo en `main.py`. |
| **B2** | Rutas frontend desalineadas y sin `quirofanoService` | 🔴 Blocker | Codebase Details, Readiness | Corregir paths a `frontend/src/...`, usar `apiFetch` y vistas correctas. |
| **B3** | Días hábiles vs anticipación fija (Lunes/Martes perdidos) | 🔴 Blocker | Design Critic, Comprehension | Implementar regla de días hábiles quirúrgicos (Viernes cubre Lunes). |
| **B4** | Ausencia de lock concurrente e idempotencia | 🔴 Blocker | Design Critic, Catalyst, Zoom Out, Readiness | Agregar `pg_advisory_xact_lock`, constraint UNIQUE y TZ Buenos Aires. |
| **M1** | Endpoint de aprovisionamiento de plantilla redundante | 🟡 Major | Zoom Out, Comprehension | Eliminar endpoint; usar módulo existente `templates.py` o Meta Manager. |
| **M2** | Tareas fantasma en `WhatsAppCloudClient` | 🟡 Major | Zoom Out | Reutilizar métodos existentes `upload_media_bytes` y `send_template`. |
| **M3** | Fractura de generación PDF vs `pdf_service.py` | 🟡 Major | Zoom Out, Readiness | Reutilizar membretes y estilos institucionales de `pdf_service.py`. |
| **M4** | Timeout HTTP en despacho manual (45-60s) | 🟡 Major | Design Critic, Catalyst | Convertir endpoint manual a asíncrono con `BackgroundTasks` y HTTP 202. |
| **M5** | Privacidad de datos médicos (DNI y notas de sala) | 🟡 Major | Design Critic | Enmascarar DNI, excluir notas operativas y añadir cláusula de confidencialidad. |
| **M6** | Fragilidad en matching de derivadores por texto libre | 🟡 Major | Design Critic, Comprehension, Codebase Details | Reutilizar `obtener_prestador_por_cirujano` de `app.db` y alertar en pre-vuelo. |
| **M7** | Ausencia de contratos Pydantic y script SQL DDL | 🟡 Major | Readiness, Structural | Documentar esquemas de API y script SQL con índices y claves foráneas. |
| **N1** | Estilo, calibración de claims y glosario de acrónimos | 🟢 Nit | Style, Comprehension | Calibrar prosa, eliminar pleonasmos y definir acrónimos (`LIO`, `WABA`). |
| **N2** | Estructura de encabezados y delimitadores LaTeX | 🟢 Nit | Structural | Limpiar dos puntos en títulos y usar código inline para `T + 2`. |
| **N3** | Snapshot JSON y SHA-256 para auditoría post-30 días | 🟢 Nit | Catalyst | Almacenar `pdf_sha256` y `turnos_snapshot` en `notificaciones_prestadores_logs`. |
