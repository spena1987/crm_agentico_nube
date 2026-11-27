# Encuestas de Satisfacción Automatizadas vía WhatsApp + SurveyMonkey

*   **Author:** malko
*   **Status:** Proposed
*   **Date:** 2026-11-26

--------------------------------------------------------------------------------

## Overview

Este diseño define el envío automatizado de encuestas de satisfacción para pacientes atendidos en la clínica, comenzando por la unidad de negocio **Consultas** (hasta ~350 consultas brutas diarias, cuyo volumen efectivo en estado `atendido` se confirmará mediante `dry_run`) y con estructura preparada para sumar **Estudios** mediante configuración de servicios. Cada día hábil de lunes a sábado (desplazando los turnos del sábado al lunes; sin excluir feriados: si no hubo actividad, Geclisa devuelve cero turnos atendidos y si hubo guardia se encuesta al día siguiente), un proceso programado consulta los turnos efectivamente atendidos en **Geclisa** (sistema de gestión clínica On-Premise de turnos e historia clínica) y agrupa los turnos de un mismo teléfono en el día. Luego despacha una única notificación por **WhatsApp Línea 2** (cuenta de envío automatizado de estudios oftalmológicos) en horario diurno **ART** (`America/Argentina/Buenos_Aires`), dirigiendo al paciente a una página puente del CRM con token opaco y temporal (`/e/{token}`). Esa página muestra médico, sede, servicio, fecha y horario sin exponer nombre ni DNI y deriva a **SurveyMonkey** (plan vigente **Team Advantage**) con variables personalizadas en la URL (*Custom Variables*) para atribución por sede y profesional.

El objetivo para gerencia y responsables de sector es reemplazar la distribución actual por correo electrónico (tasa de respuesta menor al 1%) sin construir un motor propio de formularios ni fragmentar el histórico existente en SurveyMonkey.

--------------------------------------------------------------------------------

## The Problem

Hoy la clínica mide la satisfacción con encuestas de SurveyMonkey enviadas por correo electrónico, canal que rinde por debajo del 1% de respuestas e impide que gerencia y los responsables de sector cuenten con volumen representativo para tomar decisiones sobre infraestructura por sede y desempeño de atención médica por profesional.

Al mismo tiempo, trasladar el cuestionario completo dentro de WhatsApp multiplicaría la cantidad de mensajes facturables por encuesta y el costo total del canal bajo la política actual de cobro de Meta, mientras que construir un editor de preguntas abiertas y cerradas, versionado de formularios y tablero de reportes dentro del CRM duplicaría funcionalidades que ya resuelve la licencia vigente de SurveyMonkey.

Por otra parte, en la arquitectura actual de Meta **WABA** (*WhatsApp Business Account*), la **Línea 1** atiende chats de consultas y asesoramiento quirúrgico (registrando pacientes y conversaciones en `public.pacientes`, `public.conversaciones` y `public.mensajes`), mientras la **Línea 2** entrega estudios oftalmológicos digitales (`public.estudios_oftalmo`). Usar Línea 2 para encuestas exige aislar sus tablas respecto de las clínicas y proteger tanto su cuota móvil de 24 horas (`messaging_limit_tier`) como su calificación de calidad (`quality_rating`: `GREEN`, `YELLOW` o `RED`) frente a rechazos como el error `131049` (tope de frecuencia de Meta por usuario) y eventuales reportes de spam.

--------------------------------------------------------------------------------

## Goals

*   Elevar la tasa de respuesta de encuestas de satisfacción desde **< 1% actual hasta >= 5%** sobre el volumen diario de consultas efectivamente atendidas (hasta ~350 consultas brutas diarias en **Consultas**, extensible a **Estudios** por configuración).
*   Garantizar que el **100% de los enlaces enviados** queden atribuidos a una sede, un profesional canónico, un servicio, una fecha (`YYYY-MM-DD`), un horario (`HH:MM`) y un `turno_id` válidos provenientes de Geclisa y transferidos como *Custom Variables* a SurveyMonkey Team Advantage, eliminando asignaciones implícitas por defecto y excluyendo registros ambiguos antes de encolar envíos.
*   Mantener la continuidad operativa y la reputación de WhatsApp Línea 2: enviar como máximo **1 mensaje por teléfono y por día atendido** (moviendo los turnos del sábado al lunes), reservar margen diario de cuota para `public.estudios_oftalmo`, habilitar baja explícita (`opt-out`) por botón y palabras clave aislada de `public.estudios_oftalmo`, y pausar automáticamente los envíos ante `quality_rating` en `YELLOW`/`RED` o fallos sostenidos de verificación.
*   Proteger la privacidad del paciente en el enlace público usando un token opaco con fecha de vencimiento configurable, cabeceras `noindex` / `no-referrer` / `no-store` y sin exponer nombre ni DNI.

--------------------------------------------------------------------------------

## Non-Goals

*   Construir un creador de encuestas propio (preguntas abiertas/cerradas), motor de formularios o reportes exportables y tableros analíticos dentro del CRM (SurveyMonkey continúa como motor de encuestas y repositorio histórico).
*   Encuestas de satisfacción de **Cirugías** (se obtienen desde turnos de quirófano y asesoramiento del CRM con otra cadencia).
*   Reglas de preguntas diferenciadas por médico o por sede dentro de una misma unidad de negocio.
*   Período de enfriamiento (*cooldown*) multi-día para suprimir encuestas a pacientes que asisten en días distintos dentro de un mismo mes o semana en v1.
*   Aprovisionar una línea de WhatsApp dedicada adicional o implementar un daemon automático de purga histórica de teléfonos en v1.

--------------------------------------------------------------------------------

## Open Questions

*   **Question 1**: ¿Cuál es el `messaging_limit_tier` vigente de WhatsApp Línea 2 en Meta y cuánto margen diario libre deja (descontando el promedio diario de `public.estudios_oftalmo`) para definir el tope diario `max_envios_dia` y la reserva mínima de estudios médicos?
*   **Question 2**: Sobre 1 a 2 días hábiles reales en Geclisa mediante ejecución `dry_run`, ¿qué porcentaje de las hasta ~350 consultas brutas diarias cierra efectivamente con estado `atendido` frente a `ingresado`, y cuál es el catálogo inicial completo de `servId`, sedes y prestadores genéricos o duplicados que requieren mapeo o exclusión?

--------------------------------------------------------------------------------

## Critical User Journeys (CUJs)

### CUJ 1: Paciente con un único turno atendido (flujo estándar D+1)

*   **Given**: Un paciente asistió ayer (o el sábado, si hoy es lunes) a una consulta marcada como `atendido` en Geclisa, tiene un celular válido normalizable en formato argentino `549...` sin `+`, su teléfono no figura en la lista de baja de encuestas y Línea 2 mantiene `quality_rating = GREEN`.
*   **When**: Se ejecuta la ingesta diaria y el despacho en horario diurno ART, el paciente recibe la plantilla de WhatsApp por Línea 2, toca el enlace `/e/{token}`, verifica médico, sede, servicio, fecha y horario y pulsa `"Responder encuesta"`.
*   **Then**: La página puente no muestra nombre ni DNI, abre el recopilador *Web Link* de SurveyMonkey con las 6 *Custom Variables* del turno cargadas y gerencia puede filtrar esa respuesta por sede y profesional dentro de SurveyMonkey.

### CUJ 2: Paciente o grupo familiar con múltiples turnos atendidos el mismo día

*   **Given**: Un mismo número telefónico móvil concentra dos o más turnos marcados como `atendido` en la misma jornada (ya sea de un mismo paciente en distintos consultorios/profesionales, o de familiares que comparten celular en Geclisa).
*   **When**: El proceso diario consolida los turnos del día por teléfono y envía un único mensaje de WhatsApp con un solo enlace `/e/{token}`.
*   **Then**: El receptor recibe un solo mensaje de WhatsApp y la página puente muestra una tarjeta independiente por cada turno atendido ese día (identificado por profesional, sede, servicio y horario, manteniendo asociada su `ficha_id` internamente por turno sin mostrar PII), permitiendo abrir un enlace separado hacia SurveyMonkey para cada atención.

### CUJ 3: Paciente solicita baja de encuestas desde WhatsApp Línea 2

*   **Given**: Un paciente recibió una invitación de encuesta por Línea 2.
*   **When**: El paciente presiona el botón de baja (`"No recibir encuestas"`) en cualquier momento, o responde con texto libre de baja (`"BAJA"`, `"STOP"`, `"NO ENCUESTAS"`) dentro de la ventana configurada (`ttl_dias_enlace`, por defecto 14 días) desde el último envío de encuesta.
*   **Then**: El webhook de Línea 2 registra ese teléfono en la tabla exclusiva de exclusión de encuestas y envía una confirmación breve sin enlace `wa.me/` hacia Línea 1, sin escribir en `public.pacientes`, `public.conversaciones` ni `public.mensajes`, y sin bloquear el envío futuro de estudios oftalmológicos por Línea 2.

### CUJ 4: Responsable administrativo gestiona mapeos y exclusiones de Geclisa

*   **Given**: Existen en Geclisa turnos sin `servId`, consultorios nuevos no mapeados o prestadores genéricos/duplicados (como agendas de asesoramiento o médicos con doble ID).
*   **When**: El responsable ejecuta una simulación `dry_run` (solo lectura) o edita el catálogo manual en `/encuestas` (`Mapeos Geclisa`).
*   **Then**: Los turnos sin `servId` o marcados como excluidos se descartan antes de crear envíos (sin aplicar valores por defecto hacia `"CONSULTAS"` o `"Mitre 540"`), y los IDs duplicados de un mismo médico quedan unificados bajo un único profesional canónico.

### CUJ 5: Pausa automática por degradación de calidad en Línea 2 y reanudación manual

*   **Given**: La cola de encuestas está activa y despachando lotes diarios por Línea 2.
*   **When**: Al consultar periódicamente el estado de la línea en Meta Graph API durante el despacho, el `quality_rating` reportado pasa a `YELLOW` o `RED`, se acumulan 3 fallos consecutivos al consultar la API de Meta, o la tasa de rechazos `131049`/`131048` supera el umbral del bloque.
*   **Then**: El sistema activa la pausa automática por calidad, detiene de inmediato el envío de encuestas pendientes (preservando el cupo y reputación para estudios médicos), muestra la alerta en `/encuestas` y exige revisión y reanudación manual del responsable autorizado para volver a despachar.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

La arquitectura desacopla la ingesta diaria desde Geclisa y el despacho por cola asíncrona (backend FastAPI + Supabase), el canal de mensajería (Meta WhatsApp Cloud API sobre Línea 2) y la interfaz web puente en Next.js (`/e/{token}`) que deriva hacia SurveyMonkey Team Advantage con las 6 *Custom Variables* fijadas (`turno_id`, `sede`, `profesional`, `servicio`, `fecha` en `YYYY-MM-DD`, `horario` en `HH:MM`). Toda la persistencia de encuestas opera en tablas dedicadas más la configuración en `public.configuracion_sistema`, sin escribir en `public.pacientes`, `public.conversaciones`, `public.mensajes` ni `public.estudios_oftalmo`.

```text
+-----------------------+       +------------------------------------------+
| Cron D+1 (ART)        |------>| Geclisa API On-Premise                   |
| Lun-Sab (Sab->Lun)    |       | Agenda global + detalle / ficha (cache)  |
| Control diario en DB  |       +------------------------------------------+
+-----------------------+                           |
                                                    v
+--------------------------------------------------------------------------+
| Fase 1: Pipeline de Lote (encuestas_satisfaccion_service)                |
| 1. Filtro estricto: estado == "atendido" (campos crudos sin fallback)    |
| 2. Mapeo/Exclusión manual previo a agrupar (descarta excluidos/sin serv) |
| 3. Normalizador regional argentino (549..., sin +) + filtro opt-out      |
| 4. Agrupación por (fecha_atencion, telefono_e164) -> token opaco único   |
+--------------------------------------------------------------------------+
          |
          v (persiste atómicamente en encuestas_envios + encuestas_envios_turnos)
+--------------------------------------------------------------------------+
| Fase 2: Worker de Despacho Gradual (claim atómico con lease + jitter)    |
| Consulta saliente de quality_rating al inicio y cada 25 envíos (polling) |
| Verifica reserva diaria de estudios; pausa si YELLOW/RED o 3 fallos API  |
+--------------------------------------------------------------------------+
          |                                           |
          v (envío plantilla UTILITY)                 | (webhook inbound/status)
+-----------------------+                             v
| Meta Cloud API        |                 +--------------------------------+
| Línea 2               |---------------->| Receptor Webhook Línea 2       |
| CTA URL (/e/{token})  |                 | Delega al servicio de encuestas|
| + Botón Opt-Out       |                 | - Baja -> encuestas_opt_out    |
+-----------------------+                 | - Status -> wa_status / 131049 |
          |                               +--------------------------------+
          | (paciente toca https://<dominio>/e/{token})
          v
+-----------------------+  GET JSON (URLs armadas)  +---------------------------+
| Next.js Público       |<------------------------->| FastAPI Público           |
| /e/[token]            |                           | /api/encuestas-publico/   |
| (metadata estática +  |  POST .../click           | {token}                   |
|  Client tarjetas)     |  (keepalive / sendBeacon) | (sin JWT; noindex/nostore)|
+-----------------------+                           +---------------------------+
          |
          | (navegación directa sin bloqueo por telemetría)
          v
+--------------------------------------------------------------------------+
| SurveyMonkey Team Advantage (Web Link + Custom Variables)                |
| ?turno_id=...&sede=...&profesional=...&servicio=...&fecha=...&horario=... |
+--------------------------------------------------------------------------+
```

### Decisiones de arquitectura y límites de aislamiento

*   **Separación en dos fases y persistencia de corrida diaria:** Fase 1 extrae turnos de Geclisa bajo un control persistente por fecha en PostgreSQL (`encuestas_lotes_diarios` con *lease* atómico, compatible con PostgREST y la instancia única en Railway), descarta entidades sin mapeo válido antes de persistir envíos y cachea fichas en memoria dentro del lote. En modo `dry_run=true`, la ejecución es estrictamente de solo lectura. Fase 2 drena envíos pendientes dentro de la ventana diurna ART mediante reserva atómica con TTL para recuperar envíos interrumpidos por reinicios.
*   **Reutilización de infraestructura del CRM:**
    *   La configuración del módulo vive en `public.configuracion_sistema` (evitando tablas singleton dedicadas).
    *   La normalización regional argentina (`549<area><num>` sin `+`, múltiples teléfonos y descarte de fijos) se incorpora en el normalizador de Meta Cloud API (`whatsapp_cloud/normalizer.py`), dejando intactos el helper legacy de Neonize (`phone_normalizer.py`) y el módulo existente de óptica (`Óptica Vortix`, evitando riesgos de regresión en Línea 3).
    *   El cliente de Geclisa (`GeclisaClient`) expone los campos crudos de servicio, ubicación, consultorio, fecha de atención y celular sin valores por defecto implícitos, evitando que el servicio de encuestas inspeccione DTOs crudos internos.
    *   El acceso administrativo reutiliza el catálogo RBAC del CRM (`SYSTEM_MODULES` sincronizado vía `ensureModulesSynced()`, `ModuleRouteGuard` y una dependencia reutilizable en `auth.py` basada en `verificar_permiso_usuario`) con permisos por acción (`ver`, `editar`, `ejecutar`).
*   **Protección de cuota y reputación de Línea 2:** Antes de reclamar cada sub-lote, Fase 2 verifica un tope diario configurable y reserva dinámicamente cupo para los envíos reales de `public.estudios_oftalmo` en las últimas 24 horas. El chequeo de `quality_rating` se realiza por *polling* reutilizando un mismo cliente HTTP por ciclo; para evitar operación *fail-open* sin generar falsas pausas por micro-cortes, 3 fallos consecutivos de consulta o una tasa anómala de rechazos `131049`/`131048` activan la pausa automática. El receptor webhook de Línea 2 (que mantiene su *allowlist* cerrado de líneas autorizadas) delega al servicio de encuestas la baja explícita —botón de baja sin límite de 14 días; palabras clave simples en texto libre dentro de la ventana de `ttl_dias_enlace`— y las registra en `encuestas_opt_out`, sin disparar auto-respuesta ni afectar estudios médicos.
*   **Salto público sin bloqueo hacia SurveyMonkey:** La consulta inicial devuelve la URL final de SurveyMonkey ya construida en el servidor; al pulsar el botón, el navegador abre la encuesta de inmediato y envía el registro del clic en segundo plano (`keepalive` / `Blob` JSON same-origin) para que un pico de latencia nunca impida al paciente responder.

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative A: Encuesta conversacional dentro de WhatsApp

*   **Pros**: Cero saltos fuera de WhatsApp para el paciente y sin necesidad de desarrollar una página puente web ni pasar parámetros por URL.
*   **Cons**: Cada pregunta y respuesta adicional intercambiada por WhatsApp genera un cargo adicional bajo la política de cobro por mensaje de Meta, mezcla la Línea 2 con múltiples turnos conversacionales y exige implementar máquina de estados en el webhook.
*   **Reason for Rejection**: Descartada: la política de cobro por mensaje de Meta encarece completar la encuesta dentro de WhatsApp frente a derivar al paciente a un formulario web externo.

### Alternative B: Constructor propio de encuestas y reportes dentro del CRM

*   **Pros**: Control total sobre tipos de preguntas abiertas y cerradas, estética del formulario y tableros internos sin depender de un proveedor externo.
*   **Cons**: Exige diseñar, construir y mantener un editor de preguntas, versionado para no invalidar respuestas previas, formulario público y sistema de reportes desde cero, además de fragmentar el histórico existente en SurveyMonkey.
*   **Reason for Rejection**: Descartada: mantener SurveyMonkey preserva el histórico acumulado y acota el alcance al canal automatizado de envío, agrupación y atribución.

### Alternative C: Preguntas distintas por cada profesional o sede

*   **Pros**: Permite adaptar la redacción específica del cuestionario según consultorio o especialidad médica.
*   **Cons**: Multiplica el mantenimiento de formularios y enlaces en SurveyMonkey y rompe la comparabilidad directa entre sedes y profesionales sobre una métrica común.
*   **Reason for Rejection**: Descartada: una encuesta estándar por unidad de negocio es suficiente siempre que cada respuesta quede atribuida al profesional y la sede provenientes del turno en Geclisa.

### Alternative D: Mantener el envío actual de SurveyMonkey por correo electrónico

*   **Pros**: Cero desarrollo nuevo y sin exposición de la reputación ni de la cuota de WhatsApp Línea 2.
*   **Cons**: El correo electrónico mantiene una tasa de respuesta inferior al 1%, impidiendo obtener volumen útil para decisiones de infraestructura y atención médica.
*   **Reason for Rejection**: Descartada: el canal por correo electrónico no alcanza el umbral mínimo de respuestas (>= 5%) requerido por gerencia.

### Alternative E: Redirección HTTP 302 directa en FastAPI para turno único + HTML mínimo para múltiples turnos

*   **Pros**: Elimina un clic intermedio cuando el paciente tuvo un solo turno en el día y no depende de la disponibilidad del frontend Next.js.
*   **Cons**: Depende de filtrar por `User-Agent` a los rastreadores de vista previa de WhatsApp para evitar falsos clics, traslada la visualización de médico, sede, fecha y horario al *piping* (inserción dinámica de variables) de SurveyMonkey y divide la experiencia entre un `302` y un HTML separado cuando hay múltiples turnos.
*   **Reason for Rejection**: Descartada: la página puente en Next.js con API JSON evita falsos clics de bots, muestra los datos del turno antes de salir del CRM y resuelve uno o múltiples turnos en una interfaz unificada.

### Alternative F: Actualizar el plan de SurveyMonkey a Team Premier

*   **Pros**: Suma capacidades avanzadas de análisis como tablas cruzadas (*Crosstabs*) y lógica condicional avanzada.
*   **Cons**: Aumenta el costo mensual de licencia sin ser necesario para recibir metadatos del turno por URL.
*   **Reason for Rejection**: Descartada durante la ideación tras verificar que el plan vigente **Team Advantage** ya soporta *Custom Variables* en recopiladores *Web Link*.

### Alternative G: Aprovisionar una línea de WhatsApp dedicada desde v1

*   **Pros**: Aísla físicamente desde el primer día la reputación, el nombre visible (`verified_name`) y la cuota `messaging_limit_tier` de las encuestas respecto de Línea 2 (`public.estudios_oftalmo`).
*   **Cons**: Demora el lanzamiento por alta de número, verificación en Meta, aprobación de cuenta comercial y configuración de nuevo canal en la capa de mensajería antes de validar la tasa de respuesta real.
*   **Reason for Rejection**: Diferida para una etapa posterior: v1 opera sobre Línea 2 con pausa automática por calidad, reserva de cupo médico y monitoreo de entregas; si la línea sufre degradación o reclasificación a `MARKETING`, se incorporará una línea dedicada en la capa de WhatsApp Cloud.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Seguridad, Privacidad y RBAC:** Los tokens de enlace usan generación criptográfica aleatoria (mínimo 128 bits URL-safe), tienen vencimiento configurable (`ttl_dias_enlace`, por defecto 14 días) y se sirven con cabeceras `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store, private`. La metadata de Next.js en `/e/[token]` es estática sin consultar el token en SSR para que los rastreadores de vista previa no disparen lecturas ni expongan datos del turno. Ninguna ruta pública ni parámetro hacia SurveyMonkey expone nombre, apellido ni DNI del paciente. Todas las tablas nuevas habilitan *Row Level Security* (RLS) denegando acceso `anon`/`authenticated`, y las funciones RPC se ejecutan con `SECURITY DEFINER` y permisos restringidos a `service_role`. El acceso administrativo exige usuario autenticado (rechazando tokens `anon`) y verificación de permiso por módulo y acción. El receptor de webhooks de Meta mantiene la validación HMAC `X-Hub-Signature-256` y deduplicación por `wamid` (`EventDeduplicator`) existentes.
*   **Rendimiento, Concurrencia y Resiliencia:** La Fase 1 ejecuta llamadas síncronas a Geclisa en hilos secundarios (`asyncio.to_thread`), cachea fichas dentro del lote y usa control persistente por fecha en PostgreSQL (`encuestas_lotes_diarios`). La Fase 2 procesa con reserva atómica, recuperación por TTL de envíos interrumpidos, tope de reintentos (`intentos <= 3`) y despacho gradual con *jitter* entre mensajes.
*   **Rollout y Rollback:** El módulo inicia con `activo = false`. Antes de habilitar envíos reales, el equipo acortará la encuesta actual de 10 preguntas en SurveyMonkey Team Advantage, validará el margen libre diario de Línea 2 (`Open Question 1`) y auditará 1–2 días reales en `dry_run` (`Open Question 2`). El rollback inmediato consiste en desactivar `activo` desde `/encuestas`; ninguna tabla clínica del CRM recibe escrituras ni claves foráneas del módulo.

--------------------------------------------------------------------------------

## Risks & Mitigations

*   **Saturación de cuota móvil de 24h (`messaging_limit_tier`) en Línea 2:** Sumar envíos diarios podría competir con entregas médicas de `public.estudios_oftalmo` ante picos imprevistos. *Mitigación:* validar margen diario antes de activar (`Open Question 1`), reservar dinámicamente un colchón diario de estudios y aplicar tope `max_envios_dia` en Fase 2.
*   **Reclasificación de plantilla a `MARKETING` y rechazos `131049`:** Aunque se solicita en categoría `UTILITY`, Meta puede reclasificar una encuesta como `MARKETING`, encareciendo el envío y aplicando tope de frecuencia (`131049`). *Mitigación:* marcar `131049` como fallo terminal sin reintento, auto-pausar ante tasa anómala de `131049`/`131048` en un bloque, pausar ante `YELLOW`/`RED` o 3 fallos seguidos de consulta, y migrar a línea dedicada (Alternative G) si se degrada la entregabilidad.
*   **Manipulación de parámetros o respuestas múltiples en SurveyMonkey Web Link:** Al abrir SurveyMonkey con query params en el navegador, un usuario técnico podría editar `profesional` o responder más de una vez. *Mitigación:* limitación aceptada al elegir SurveyMonkey Web Link; se usa codificación URL en servidor y en v1 no se ingieren puntajes al CRM.
*   **Teléfonos compartidos entre familiares:** Dos pacientes con distinta `ficha_id` que comparten celular en Geclisa recibirán sus tarjetas agrupadas en un mismo enlace y una baja (`opt-out`) suprimirá envíos para ese número. *Mitigación:* registrar `ficha_id` por turno, mostrar `servicio` junto a profesional/sede/horario para desambiguar tarjetas y mantener la regla de 1 mensaje/teléfono/día por costo y control de spam.
*   **Caídas de Geclisa On-Premise o cierres tardíos (`ingresado` -> `atendido`):** Un corte local impide extraer el lote a la hora programada, y turnos cerrados después de D+1 no se re-barren en v1. *Mitigación:* propagar errores de timeout desde `GeclisaClient` para reintentos acotados en Fase 1, registrar el fallo en `encuestas_lotes_diarios` mostrando alerta en `/encuestas`, y permitir recuperación manual vía `ejecutar-lote`.

--------------------------------------------------------------------------------

## Future Improvements

*   **Incorporación de unidad de negocio Estudios:** Una vez validada la tasa de respuesta, el `quality_rating` y el margen de cuota de Línea 2 en Consultas, habilitar los `servId` de Estudios en `encuestas_mapeo_geclisa` y configurar un mapa de URLs por unidad de negocio.
*   **Línea de WhatsApp dedicada para encuestas:** Registrar una nueva línea en `whatsapp_cloud/client.py` y los *allowlists* de `worker.py` (conjunto cerrado de `phone_number_id` permitidos para Línea 1 y Línea 2) si el volumen o la categorización de Meta justifican separar completamente encuestas de estudios médicos.
*   **Encuestas de Cirugías:** Integrar un flujo separado alimentado por turnos de quirófano y asesoramiento quirúrgico del CRM con cadencia post-operatoria propia.
*   **Webhook o sincronización desde SurveyMonkey:** Si gerencia requiere cruzar calificaciones dentro del CRM sin entrar a SurveyMonkey, sumar ingestión de respuestas vía webhook o API de SurveyMonkey.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Fase A — Base de datos, RLS y RPCs atómicas

#### 1. `supabase/migrations/20261126_modulo_encuestas_satisfaccion.sql` (Create)

*   **Type / Scope**: Migración SQL PostgreSQL / Supabase (5 tablas aisladas del módulo, seed en `public.configuracion_sistema`, índices, RLS y RPCs con permisos restringidos). No modifica `public.pacientes`, `public.conversaciones`, `public.mensajes` ni `public.estudios_oftalmo`.
*   **Proposed Changes**:
    1.  **Seed de configuración en `public.configuracion_sistema` (`clave, valor, descripcion`)**: Insertar (con `ON CONFLICT (clave) DO NOTHING`) `clave = 'encuestas_config'`, `descripcion = 'Configuración del módulo de encuestas post-consulta'`, y `valor` JSONB inicial: `activo: false`, `pausado_por_calidad: false`, `motivo_pausa: null`, `template_name: "encuesta_satisfaccion_consulta_v1"`, `template_language: "es_AR"`, `hora_envio_art: "10:30"`, `hora_fin_envio_art: "20:00"`, `ttl_dias_enlace: 14`, `surveymonkey_url: ""`, `jitter_min_seg: 1.5`, `jitter_max_seg: 4.0`, `batch_size: 25`, `max_envios_dia: 400`, `reserva_diaria_estudios: 100`.
    2.  **`public.encuestas_lotes_diarios`**:
        *   `fecha_atencion DATE PRIMARY KEY`
        *   `estado TEXT NOT NULL CHECK (estado IN ('procesando', 'completado', 'fallido'))`
        *   `claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()`
        *   `finished_at TIMESTAMPTZ NULL`
        *   `resumen JSONB NULL`
        *   `error_detalle TEXT NULL`
    3.  **`public.encuestas_mapeo_geclisa`**:
        *   `id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
        *   `tipo_entidad TEXT NOT NULL CHECK (tipo_entidad IN ('servicio', 'prestador', 'sede'))`
        *   `geclisa_id TEXT NOT NULL` (para `servicio`: identificador entero de servicio como texto; para `prestador`: identificador de prestador como texto; para `sede`: identificador crudo de ubicación o nombre de consultorio en mayúsculas cuando falte ubicación)
        *   `geclisa_nombre_raw TEXT NOT NULL`
        *   `unidad_negocio TEXT NOT NULL DEFAULT 'excluido' CHECK (unidad_negocio IN ('consultas', 'estudios', 'excluido'))`
        *   `nombre_canonico TEXT NOT NULL`
        *   `incluir_en_envio BOOLEAN NOT NULL DEFAULT false`
        *   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
        *   `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
        *   Restricción: `UNIQUE (tipo_entidad, geclisa_id)`.
    4.  **`public.encuestas_envios`**:
        *   `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
        *   `token TEXT NOT NULL UNIQUE`
        *   `fecha_atencion DATE NOT NULL`
        *   `telefono_e164 TEXT NOT NULL` (almacenado en dígitos sin `+`, p. ej. `549261...`, consistente con Meta Cloud API)
        *   `estado_cola TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_cola IN ('pendiente', 'enviando', 'enviado', 'fallido'))`
        *   `intentos INTEGER NOT NULL DEFAULT 0`
        *   `claimed_at TIMESTAMPTZ NULL`
        *   `wamid TEXT NULL`
        *   `wa_status TEXT NULL CHECK (wa_status IN ('sent', 'delivered', 'read', 'failed'))`
        *   `wa_error_code INTEGER NULL`
        *   `wa_error_message TEXT NULL`
        *   `expires_at TIMESTAMPTZ NOT NULL`
        *   `sent_at TIMESTAMPTZ NULL`
        *   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
        *   Restricciones e índices: `UNIQUE (fecha_atencion, telefono_e164)`, `CREATE INDEX idx_encuestas_envios_cola ON public.encuestas_envios (estado_cola, fecha_atencion, created_at)`, `CREATE UNIQUE INDEX idx_encuestas_envios_wamid ON public.encuestas_envios (wamid) WHERE wamid IS NOT NULL`, `CREATE INDEX idx_encuestas_envios_tel_created ON public.encuestas_envios (telefono_e164, created_at DESC)`.
    5.  **`public.encuestas_envios_turnos`**:
        *   `id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
        *   `envio_id UUID NOT NULL REFERENCES public.encuestas_envios(id) ON DELETE CASCADE`
        *   `turno_id BIGINT NOT NULL UNIQUE`
        *   `ficha_id BIGINT NULL` (trazabilidad por turno; nunca expuesta en endpoints públicos)
        *   `unidad_negocio TEXT NOT NULL DEFAULT 'consultas'`
        *   `servicio_id INTEGER NOT NULL`
        *   `servicio_nombre TEXT NOT NULL`
        *   `sede_canonica TEXT NOT NULL`
        *   `profesional_canonico TEXT NOT NULL`
        *   `fecha_turno DATE NOT NULL`
        *   `horario_turno TEXT NOT NULL`
        *   `clicked_at TIMESTAMPTZ NULL`
        *   `click_count INTEGER NOT NULL DEFAULT 0`
        *   Índice: `CREATE INDEX idx_encuestas_envios_turnos_envio_id ON public.encuestas_envios_turnos (envio_id)`.
    6.  **`public.encuestas_opt_out`**:
        *   `id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
        *   `telefono_e164 TEXT NOT NULL UNIQUE`
        *   `origen TEXT NOT NULL CHECK (origen IN ('boton_whatsapp', 'texto_whatsapp', 'manual_admin'))`
        *   `wamid_origen TEXT NULL`
        *   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
    7.  **Seguridad RLS**: Ejecutar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en las 5 tablas y crear políticas explícitas habilitando únicamente `service_role` (denegando `anon` y `authenticated` en PostgREST).
    8.  **Funciones RPC PostgreSQL (`SECURITY DEFINER SET search_path = public` + `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`)**:
        *   `adquirir_lote_encuestas_diario(p_fecha DATE, p_forzar BOOLEAN DEFAULT false) RETURNS BOOLEAN`: inserta o reclama atómicamente la fila en `encuestas_lotes_diarios` cuando no exista, esté en `'fallido'`, su *lease* en `'procesando'` haya expirado (`claimed_at < now() - interval '15 minutes'`), o `p_forzar = true`.
        *   `crear_envio_encuesta_con_turnos(p_token TEXT, p_fecha_atencion DATE, p_telefono_e164 TEXT, p_expires_at TIMESTAMPTZ, p_turnos JSONB) RETURNS UUID`: inserta atómicamente `encuestas_envios` (`ON CONFLICT (fecha_atencion, telefono_e164) DO NOTHING` o recupera el `id` existente) y los ítems de `encuestas_envios_turnos` (`ON CONFLICT (turno_id) DO NOTHING`) en una única transacción; si no quedan turnos asociados, no deja cabecera huérfana.
        *   `claim_encuestas_envios_pendientes(p_limit INTEGER) RETURNS SETOF public.encuestas_envios`: libera a `'pendiente'` (`claimed_at = NULL`) filas en `'enviando'` con `claimed_at < now() - interval '10 minutes'` e `intentos < 3` (marcando `'fallido'` si `intentos >= 3`); luego actualiza con `FOR UPDATE SKIP LOCKED` hasta `p_limit` filas `'pendiente'` pasando a `'enviando'` con `claimed_at = now()` y las retorna.
        *   `registrar_clic_encuesta_turno(p_token TEXT, p_turno_id BIGINT) RETURNS TABLE (ok BOOLEAN, estado TEXT, click_count INTEGER)`: valida existencia del token, vigencia (`expires_at > now()`) y pertenencia de `turno_id`, retornando `estado` en `('ok', 'expirado', 'no_encontrado', 'turno_invalido')`; cuando es `'ok'`, incrementa atómicamente `click_count = click_count + 1` y fija `clicked_at = COALESCE(clicked_at, now())`.

**Checkpoint Fase A:** Aplicar `supabase/migrations/20261126_modulo_encuestas_satisfaccion.sql` en el entorno Supabase de prueba y verificar mediante consulta SQL en `pg_tables`/`pg_proc` que las 5 tablas tienen `rowsecurity = true`, existe `'encuestas_config'` en `public.configuracion_sistema`, y las 4 RPCs tienen acceso revocado para `anon`/`authenticated`.

---

### Fase B — Backend, Geclisa, Normalizador Meta, Webhook Línea 2 y Pytest

#### 2. `backend/app/services/geclisa_client.py` (Modify)

*   **Type / Scope**: Cliente HTTP de Geclisa On-Premise.
*   **Proposed Changes**:
    1.  En `obtener_agenda_prestador`, conservar todos los campos actuales (`cancelado`, `consultorio_id`, `asistio`, `servicio_id`, `ficha_id`, etc.) y exponer además los campos crudos sin valores por defecto implícitos: `servicio_raw` (nombre de servicio tal como llega de Geclisa), `ubicacion_id_raw` (identificador crudo de ubicación sin reemplazo por `3`), `ubicacion_raw` (nombre crudo de ubicación sin reemplazo por `"Mitre 540..."`), `consultorio_raw` (nombre crudo de consultorio sin `"MENDOZA"` por defecto), `fecha_atendido` (fecha/hora de cierre de atención) y `celular_raw` (campo específico de celular del detalle/ítem antes de priorizar teléfono fijo).
    2.  Aclarar/garantizar que `obtener_agenda_global` propaga los ítems enriquecidos por `obtener_agenda_prestador` y agregar un parámetro opcional `raise_on_error: bool = False` en ambos métodos para que Fase 1 pueda capturar timeouts o caídas en lugar de recibir una lista vacía silenciosa.

#### 3. `backend/app/services/whatsapp_cloud/normalizer.py` (Modify)

*   **Type / Scope**: Normalizador compartido de teléfonos en formato Meta Cloud API.
*   **Proposed Changes**: Incorporar la función `normalizar_telefono_argentina_movil(raw_phone, celular_preferido=None, default_area_code="261")` dentro del paquete de WhatsApp Cloud (sin tocar el normalizador legacy de Neonize en `phone_normalizer.py` ni alterar `optica_vortix_service.py`). La función divide múltiples números por separadores usuales (`/` / `-` / `,` / `|` / `o` / `y`), limpia prefijos `0` y `15` locales en códigos de área de Mendoza (`261`, `260`, `263`, `2622`, `2625`) y del resto de Argentina, descarta líneas fijas (por ejemplo prefijos `42`/`43` en abonados de 7 dígitos sin `15`), y devuelve una tupla `(telefono_e164_sin_mas, motivo_error)` con 13 dígitos (`549...` sin `+`) o `(None, motivo)` si no es móvil válido.

#### 4. `backend/app/auth.py` (Modify)

*   **Type / Scope**: Middleware JWT (`AuthSecurityMiddleware`) y dependencia reutilizable de autorización RBAC.
*   **Proposed Changes**:
    1.  Agregar `"/api/encuestas-publico/"` a `public_prefixes` en `AuthSecurityMiddleware`.
    2.  Exponer la dependencia reutilizable `require_module_permission(modulo_codigo: str, accion_codigo: str)` alineada con `database/schema.sql` (`usuarios_perfil.id`, `activo is not False`, paso directo para `roles.codigo` `'admin'` o `'superadmin'`, y consulta en `rol_permisos` por `rol_id`, `modulo_codigo`, `accion` y `permitido = true`), rechazando con HTTP `403` tokens `anon` o usuarios sin `sub` o sin permiso.

#### 5. `backend/app/services/encuestas_satisfaccion_service.py` (Create)

*   **Type / Scope**: Servicio de dominio, tareas programadas (`cron_encuestas_satisfaccion`), handlers de webhook delegados y router FastAPI (`encuestas_satisfaccion_router`).
*   **Proposed Changes**:
    *   **Fase 1 (Generación de lote D+1):**
        1.  Calcula la fecha objetivo en zona `America/Argentina/Buenos_Aires`: de martes a sábado toma el día anterior; los lunes toma el sábado; los domingos no ejecuta envíos automáticos (sin excluir feriados).
        2.  Si no es `dry_run`, invoca `adquirir_lote_encuestas_diario` (con `p_forzar` según invocación manual); en modo `dry_run=true` la ejecución es estrictamente de solo lectura sin escribir en ninguna tabla.
        3.  Consulta `obtener_agenda_global(fecha_iso, raise_on_error=True)` mediante `asyncio.to_thread` con reintento acotado ante timeout; si agota reintentos, marca el lote diario en `'fallido'` con `error_detalle` para alertar en `/encuestas`.
        4.  Filtra estrictamente turnos atendidos (`not cancelado` y `asistio` verdadero).
        5.  Resuelve `servicio`, `sede` (clave construida con `ubicacion_id_raw`, o `consultorio_raw` en mayúsculas si falta ubicación; nunca usando el fallback `ubicacion_id`) y `prestador` contra `encuestas_mapeo_geclisa`. Turnos sin servicio válido, sin sede o con entidades excluidas/no mapeadas se descartan antes de agrupar; en ejecución normal (`dry_run=false`), las entidades desconocidas nuevas se registran en `encuestas_mapeo_geclisa` como `'excluido'` e `incluir_en_envio = false` para revisión manual, mientras que en `dry_run=true` solo se devuelven en el resumen JSON.
        6.  Si falta teléfono en la agenda o su normalización falla por número fijo/inválido, consulta `obtener_ficha_completa(ficha_id)` vía `asyncio.to_thread` (usando caché en memoria por `ficha_id` dentro de la corrida), normaliza con `normalizar_telefono_argentina_movil` (`celular_raw` / `celular` priorizado sobre teléfono fijo) y excluye teléfonos presentes en `encuestas_opt_out`.
        7.  Agrupa los turnos válidos por `(fecha_atencion, telefono_e164)`, genera un token opaco aleatorio URL-safe (>= 128 bits) con expiración `ttl_dias_enlace` y, si `dry_run=false`, persiste atómicamente cada grupo mediante la RPC `crear_envio_encuesta_con_turnos` y cierra el lote diario como `'completado'` con su resumen JSON.
    *   **Fase 2 (Worker de despacho y protección de Línea 2):**
        1.  `cron_encuestas_satisfaccion` despierta cada `60` segundos en `America/Argentina/Buenos_Aires`. De lunes a sábado, dentro de la ventana diurna ART (`hora_envio_art`..`hora_fin_envio_art`, por defecto `"10:30"` a `"20:00"`), dispara Fase 1 una vez si el lote del día aún no está completado y drena envíos `'pendiente'` en cada ciclo mientras `activo = true` y `pausado_por_calidad = false` (permitiendo retomar automáticamente tras reanudaciones manuales dentro de la ventana diurna).
        2.  Antes de reclamar cada sub-lote (`batch_size = 25`), re-lee `encuestas_config` y calcula el cupo disponible en la ventana móvil de 24 horas: consulta el conteo de envíos recientes en `public.estudios_oftalmo` + `encuestas_envios`, y limita el sub-lote para no superar `max_envios_dia` ni invadir `reserva_diaria_estudios` (si no hay margen, difiere el despacho sin consumir cuota médica).
        3.  Reclama envíos vía `claim_encuestas_envios_pendientes` y reutiliza una única instancia de `WhatsAppCloudClient` (credenciales de Línea 2; si faltan credenciales aborta el ciclo y registra alerta; cierra el cliente al finalizar el ciclo en `finally`).
        4.  Consulta `get_phone_number_details()` al iniciar el ciclo y cada `25` envíos: si reporta `quality_rating` en `("YELLOW", "RED")`, pausa `pausado_por_calidad = true` con motivo explícito y devuelve los no enviados a `'pendiente'`; si la consulta retorna `{}` por error de red/API, lleva un contador de fallos consecutivos y al alcanzar `3` fallos seguidos activa la pausa *fail-closed* con motivo `"Error sostenido consultando calidad de Línea 2"`.
        5.  Envía cada plantilla (categoría `UTILITY` solicitada) mediante `wa_client.send_template` con el formato requerido por Meta: `0` variables en `body`, botón índice `"0"` (`type: "button"`, `sub_type: "url"`, parámetro `{"type": "text", "text": token}`) y botón índice `"1"` (`type: "button"`, `sub_type: "quick_reply"`, parámetro `{"type": "payload", "payload": "encuesta_opt_out"}`), esperando un tiempo aleatorio entre `jitter_min_seg` y `jitter_max_seg`.
        6.  Manejo de excepciones de `send_template`: errores permanentes (`InvalidParameterError`, `TemplateHydratedTextTooLongError`, códigos Meta `131049`, `131026`, `131030`) marcan `estado_cola = 'fallido'`, `wa_status = 'failed'` y guardan código/mensaje; errores transitorios (`RateLimitExceededError`, `CircuitBreakerOpenException`, timeouts HTTP) incrementan `intentos` y devuelven a `'pendiente'` si `intentos < 3` (o `'fallido'` si `>= 3`). Al tener éxito, registra `wamid`, `estado_cola = 'enviado'`, `wa_status = 'sent'` y `sent_at`. Si en un bloque de despacho `>= 10%` (mínimo `5` envíos) falla con `131049`/`131048`, activa `pausado_por_calidad = true` con motivo de tope de frecuencia/spam.
    *   **Handlers de dominio invocados desde `worker.py`:**
        *   `procesar_baja_encuesta_estudios_inbound(normalized_phone, msg_type, btn_payload, btn_text, raw_text, wamid, wa_client) -> bool`: intercepta inmediatamente cuando el payload o texto de botón corresponde a `encuesta_opt_out` / `"no recibir encuestas"` **sin límite de 14 días**; o bien cuando es texto libre normalizado (minúsculas, sin tildes ni signos de puntuación) coincidente con `"stop"`, `"baja"`, `"no encuestas"` o `"no recibir encuestas"` y existe un envío en `encuestas_envios` para ese teléfono dentro de `ttl_dias_enlace` días. Registra la baja en `encuestas_opt_out`, responde `"Listo, no volveremos a enviarte encuestas de satisfacción."` por Línea 2 sin enlace `wa.me/` y retorna `True`.
        *   `sincronizar_estado_envio_encuesta(wamid, status_name, err_code, err_msg)`: actualiza `encuestas_envios` por `wamid` respetando orden monotónico (`sent < delivered < read`, o `failed` terminal marcando `estado_cola = 'fallido'` y guardando `wa_error_code`/`wa_error_message`).
    *   **Endpoints públicos (`/api/encuestas-publico/`, exentos de JWT):**
        *   `GET /api/encuestas-publico/{token}`: retorna HTTP `200` con cabeceras `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store, private`. Evalúa primero existencia (`no_encontrado`) y vencimiento (`expirado`); cuando `estado == "valido"`, valida que `surveymonkey_url` no esté vacía (si lo está, responde HTTP `503`) y arma la URL de cada turno con `urllib.parse.urlencode` mapeando `turno_id`, `sede <- sede_canonica`, `profesional <- profesional_canonico`, `servicio <- servicio_nombre`, `fecha <- fecha_turno (YYYY-MM-DD)` y `horario <- horario_turno (HH:MM)`. Nunca expone nombre, DNI ni `ficha_id`.
        *   `POST /api/encuestas-publico/{token}/click`: body `{"turno_id": int}`; invoca `registrar_clic_encuesta_turno`; retorna HTTP `200 {"ok": true, "click_count": int}`, `410` si `estado == 'expirado'`, o `404` si es `'no_encontrado'` o `'turno_invalido'`.
    *   **Endpoints administrativos (`/api/encuestas/*`, protegidos por `require_module_permission("encuestas", accion)`):**
        *   `GET /api/encuestas/config` (`accion="ver"`): retorna `{"config": ..., "line_health": ..., "ultimo_lote": ...}` (con estado de fallo de Fase 1 si existe).
        *   `PUT /api/encuestas/config` (`accion="editar"`): esquema Pydantic validando `jitter_min_seg <= jitter_max_seg`, `ttl_dias_enlace >= 1`, formato `HH:MM` y `hora_envio_art < hora_fin_envio_art` (`422` si falla); al intentar desactivar `pausado_por_calidad`, re-consulta Meta y retorna HTTP `409` si la línea sigue en `YELLOW`/`RED`.
        *   `GET /api/encuestas/mapeos` (`accion="ver"`), `POST /api/encuestas/mapeos` (`accion="editar"`, campos `tipo_entidad`, `geclisa_id`, `geclisa_nombre_raw`, `unidad_negocio`, `nombre_canonico`, `incluir_en_envio`, `409` si ya existe), `PUT /api/encuestas/mapeos/{id}` (`accion="editar"`, `404` si no existe).
        *   `GET /api/encuestas/envios` (`accion="ver"`): filtros `fecha`, `estado_cola`, `wa_status`, `page`, `page_size`; retorna filas con sus `turnos` anidados y contadores agregados sobre el filtro activo (enviados, entregados, leídos, clics y rechazos `131049`).
        *   `GET /api/encuestas/opt-outs` (`accion="ver"`), `POST /api/encuestas/opt-outs` (`accion="editar"`, recibe teléfono crudo o normalizado, lo normaliza con `normalizar_telefono_argentina_movil` retornando `422` si es inválido), `DELETE /api/encuestas/opt-outs/{id}` (`accion="editar"`, `404` si no existe).
        *   `POST /api/encuestas/ejecutar-lote` (`accion="ejecutar"`): body `{"fecha": "YYYY-MM-DD | null", "dry_run": true, "despachar_ahora": false}` (si `fecha` es nula usa D+1). Si `dry_run=false`, ejecuta Fase 1 con `p_forzar=true` y, si `despachar_ahora=true`, verifica `activo and not pausado_por_calidad` (o responde `409`) y lanza `despachar_cola_encuestas()` en segundo plano (`asyncio.create_task`) devolviendo HTTP `200` con el resumen de Fase 1.

#### 6. `backend/app/main.py` (Modify)

*   **Type / Scope**: Arranque de aplicación FastAPI y tareas en segundo plano.
*   **Proposed Changes**: Registrar `encuestas_satisfaccion_router` en `app.include_router(...)` e iniciar `asyncio.create_task(cron_encuestas_satisfaccion())` dentro de `lifespan`.

#### 7. `backend/app/services/whatsapp_cloud/worker.py` (Modify)

*   **Type / Scope**: Enrutador de webhooks de Meta Cloud API (mantiene su *allowlist* estricto de `phone_number_id` de Línea 1 y Línea 2).
*   **Proposed Changes**:
    1.  En `handle_estudios_line_inbound_message`, extraer el `payload` del botón (`button.payload` / `interactive.button_reply.id`) por separado del texto visible (`button.text` / `title` / `text.body`), normalizar el teléfono con `normalizar_telefono_argentina_movil` y delegar en `procesar_baja_encuesta_estudios_inbound(...)` antes de la auto-respuesta institucional; si retorna `True`, finalizar sin derivar a Línea 1 ni tocar tablas clínicas.
    2.  En `handle_status_update`, después de sincronizar `public.estudios_oftalmo`, delegar en `sincronizar_estado_envio_encuesta(...)`.

#### 8. `backend/app/services/whatsapp_cloud/templates.py` (Modify)

*   **Type / Scope**: Sincronización y creación de plantillas de Meta Cloud API.
*   **Proposed Changes**: Ampliar la regla previa aplicada a `vortix_` y `optica_` para excluir también plantillas con prefijo `encuesta_` tanto en `sync_templates_from_meta` como en `create_template`, fijando `visible_en_chat = False`, `visible_en_hce = False` (HCE: Historia Clínica Electrónica) y `grupo_crm = "Encuestas de Satisfacción"`.

#### 9. `backend/tests/test_encuestas_satisfaccion.py` (Create)

*   **Type / Scope**: Suite de pruebas automatizadas en Pytest.
*   **Proposed Changes**: Cubrir mediante mocks de Geclisa, Supabase y Meta Cloud API:
    1. Cálculo D+1 (lunes procesa sábado; domingo no genera; feriados sin exclusión especial).
    2. Exposición en `GeclisaClient` de `ubicacion_id_raw` y `celular_raw` sin fallback a Mitre 540 y propagación en `obtener_agenda_global`, más `raise_on_error=True`.
    3. Consulta a `obtener_ficha_completa` cuando el teléfono de agenda falta o es fijo, y caché intra-lote de fichas.
    4. `dry_run=true` estrictamente de solo lectura vs. registro de entidades nuevas y descarte previo de excluidos en `dry_run=false`.
    5. Normalización regional argentina (`549...` sin `+`, áreas `261`/`260`/`263`/`264`, rechazo de fijos) usada simétricamente en Fase 1 y `opt-out`.
    6. Persistencia atómica vía `crear_envio_encuesta_con_turnos`, control de lote `adquirir_lote_encuestas_diario`, claim y rescate de `enviando` por TTL / tope `intentos = 3`.
    7. Reserva dinámica de cupo para `estudios_oftalmo`, pausa automática ante `YELLOW`/`RED`, pausa *fail-closed* tras 3 fallos consecutivos de `get_phone_number_details()`, auto-pausa por tasa de `131049`/`131048`, matriz de errores reintentables vs terminales y formato de `components` en `send_template`.
    8. Delegación en `worker.py` (botón `encuesta_opt_out` sin límite de 14 días, texto libre `BAJA`/`STOP` dentro de `ttl_dias_enlace`, monotonicidad de `wa_status`), aislamiento de `estudios_oftalmo` y exclusión `encuesta_` en `sync_templates_from_meta` / `create_template`.
    9. Endpoints públicos (`GET` con URLs y cabeceras `noindex`/`no-referrer`/`no-store`, `404`/`410` en `/click`, `503` si falta URL, cero PII) y RBAC `require_module_permission` (`403` ante token `anon` o acción no autorizada en `/api/encuestas/*`).

**Checkpoint Fase B:** Ejecutar `pytest backend/tests/test_encuestas_satisfaccion.py backend/tests/test_estudios_config.py backend/tests/test_api_security.py` dentro de `backend/venv`.

---

### Fase C — Frontend RBAC, Página Puente Pública y Build

#### 10. `frontend/src/config/modules.ts` (Modify)

*   **Type / Scope**: Catálogo maestro RBAC (`SYSTEM_MODULES`), sincronizado hacia Supabase mediante `ensureModulesSynced()`.
*   **Proposed Changes**: Agregar módulo `code: 'encuestas'`, `name: 'Encuestas de Satisfacción'`, `icon: 'ClipboardCheck'`, `order: 16`, con acciones `ver`, `editar` y `ejecutar`.

#### 11. `frontend/src/components/auth/ModuleRouteGuard.tsx` (Modify)

*   **Type / Scope**: Guard de rutas privadas por módulo.
*   **Proposed Changes**: Registrar `'/encuestas': 'encuestas'` en `ROUTE_TO_MODULE`.

#### 12. `frontend/src/components/AppLayoutWrapper.tsx` (Modify)

*   **Type / Scope**: Envoltorio global de rutas en Next.js.
*   **Proposed Changes**: Incluir `isPublicSurveyPage = pathname?.startsWith('/e/')` dentro de `isPublicOpenPage` para omitir redirección a `/login` y ocultar navegación privada.

#### 13. `frontend/src/lib/api.ts` (Modify)

*   **Type / Scope**: Interceptor global de `window.fetch`.
*   **Proposed Changes**: Agregar `url.includes('/api/encuestas-publico/')` a `isPublic` para evitar inyectar cabecera `Authorization` en llamadas de pacientes no autenticados.

#### 14. `frontend/next.config.js` (Modify)

*   **Type / Scope**: Configuración de cabeceras HTTP en Next.js.
*   **Proposed Changes**: Agregar función `headers()` devolviendo `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store, private` para la ruta `/e/:path*`.

#### 15. `frontend/src/app/e/[token]/page.tsx` (Create)

*   **Type / Scope**: Server Component público en Next.js 14 App Router.
*   **Proposed Changes**: Exportar `metadata` estática (`robots: { index: false, follow: false }`, `openGraph` genérico sin realizar fetch del token ni incluir datos del turno) y renderizar `<EncuestaPuenteClient token={params.token} />`.

#### 16. `frontend/src/app/e/[token]/EncuestaPuenteClient.tsx` (Create)

*   **Type / Scope**: Client Component interactivo de la página puente (`/e/{token}`).
*   **Proposed Changes**: Consultar `GET /api/encuestas-publico/{token}` manejando estados de carga/error, enlace `expirado` o `no_encontrado`, tarjeta única (médico, sede, servicio, fecha, horario y botón `"Responder encuesta"`) o lista de tarjetas para múltiples turnos del día con indicador `ya_abierto`. Al pulsar el botón de una tarjeta, disparar de forma no bloqueante hacia la ruta relativa same-origin `/api/encuestas-publico/${token}/click` mediante `fetch(..., { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turno_id }) })` (o `sendBeacon` con `Blob` `application/json` same-origin) y abrir de inmediato la `surveymonkey_url` ya recibida en el `GET`.

#### 17. `frontend/src/app/encuestas/page.tsx` (Create)

*   **Type / Scope**: Vista administrativa protegida en Next.js.
*   **Proposed Changes**: Implementar interfaz con 4 pestañas explícitas y gating visual mediante `can('encuestas', 'editar')` y `can('encuestas', 'ejecutar')`:
    *   `Estado de Línea`: `quality_rating`, `messaging_limit_tier`, consumo en 24h vs reserva de estudios, alerta ante `pausado_por_calidad` o fallo de Fase 1, y botón de reanudación manual.
    *   `Configuración`: `surveymonkey_url`, plantilla/idioma (`template_name`, `template_language`), ventana diurna (`hora_envio_art`, `hora_fin_envio_art`), `ttl_dias_enlace`, `jitter_min_seg`/`jitter_max_seg`, `batch_size`, `max_envios_dia`, `reserva_diaria_estudios` e interruptor `activo`.
    *   `Mapeos Geclisa`: tabla editable de servicios, sedes y prestadores con `unidad_negocio`, `nombre_canonico` e `incluir_en_envio`.
    *   `Envíos y Bajas`: selector de fecha con botón `dry_run` y botón de ejecución/recuperación manual con confirmación, filtros de envíos/clics/`131049` y alta/baja manual en `encuestas_opt_out`.

#### 18. `frontend/src/components/Navigation.tsx` (Modify)

*   **Type / Scope**: Menú lateral de navegación del CRM.
*   **Proposed Changes**: Agregar ítem con `code: 'encuestas'` hacia `/encuestas`, filtrado por `isAdmin || canAccess('encuestas')` para roles `'admin'`, `'superadmin'` o roles habilitados en `rol_permisos`.

**Checkpoint Fase C:** Ejecutar `npm run lint` y `npm run build` dentro de `frontend/`.

---

### Verification Plan

*   **Backend Unit & Integration Tests**: Ejecutar `pytest backend/tests/test_encuestas_satisfaccion.py backend/tests/test_estudios_config.py backend/tests/test_api_security.py` dentro del entorno virtual del backend (`backend/venv`).
*   **Frontend Compilation, Build & Linting**: Ejecutar `npm run lint` y `npm run build` dentro de `frontend/` verificando compilación de Server/Client Components en `/e/[token]` y `/encuestas`.
*   **Pre-Rollout Operational Validation (criterios de aprobación antes de `activo = true`)**:
    1. Ejecutar `POST /api/encuestas/ejecutar-lote` con `dry_run=true` sobre 1 a 2 días hábiles reales de Geclisa, verificar la proporción `atendido` vs. `ingresado` y completar el mapeo/exclusión en `encuestas_mapeo_geclisa` hasta tener 0 entidades de Consultas sin clasificar.
    2. Confirmar en `GET /api/encuestas/config` que el margen libre diario de Línea 2 (`cuota diaria del messaging_limit_tier - promedio diario de public.estudios_oftalmo`) cubre el volumen diario proyectado de `dry_run` respetando `reserva_diaria_estudios`.
    3. Completar una respuesta de prueba end-to-end contra el recopilador *Web Link* acortado en SurveyMonkey Team Advantage verificando que las 6 *Custom Variables* (`turno_id`, `sede`, `profesional`, `servicio`, `fecha`, `horario`) queden registradas en el resultado de SurveyMonkey.

--------------------------------------------------------------------------------

*Drafted with EGM*
