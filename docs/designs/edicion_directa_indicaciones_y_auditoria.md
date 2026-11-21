# Edición Directa de Indicaciones Médicas y Auditoría Versionada

*   **Author:** malko
*   **Status:** Proposed
*   **Date:** 2026-11-21

--------------------------------------------------------------------------------

## Overview

Este documento define el diseño técnico para habilitar la edición directa y completa de indicaciones médicas antes de su emisión y envío por WhatsApp tanto en **Quirófano en Vivo** como en **Asesoramiento Quirúrgico**, manteniendo intactas las plantillas maestras y conservando un historial versionado de auditoría por paciente.

### Glosario de Dominio

*   **Geclisa:** Sistema hospitalario externo con el que se sincronizan órdenes e indicaciones médicas vía `POST /api/IndicacionesMedicas` (cada registro devuelto posee un identificador numérico `geclisa_im_id`, o `geclisa_im_ids` cuando una práctica emite múltiples módulos).
*   **Nomenclador:** Catálogo institucional de prácticas médicas y códigos quirúrgicos donde se configuran plantillas base e indicaciones por fase.
*   **Módulo (`1..N`):** Bloque clínico independiente (cuerpo, medicamentos, cuidados y pautas de alarma) asignado a una práctica; una práctica puede tener 1 o varios módulos, y cada módulo activo genera una página separada en el PDF oficial.
*   **Plantilla manual o fallback:** Plantilla elegida manualmente desde la biblioteca institucional cuando la práctica no posee una regla automatizada por cirujano o institucional.
*   **`asesoria_id`:** Identificador UUID del expediente en `asesorias_quirurgicas`. Los turnos en Quirófano en Vivo (pantalla *Pizarra en Vivo*) pueden estar vinculados a un expediente (`asesoria_id` presente) o haber sido cargados directamente en quirófano (`asesoria_id` nulo).

## The Problem

Actualmente, el CRM resuelve automáticamente las indicaciones médicas a partir de plantillas del Nomenclador y excepciones por cirujano (`resolver_plantilla_sugerida`). Sin embargo, en la práctica clínica diaria los pacientes requieren ajustes puntuales al finalizar una cirugía o durante el asesoramiento (agregar un horario específico de control, ajustar la frecuencia de un colirio, incorporar un fármaco adicional o añadir una aclaración particular).

Hoy el flujo presenta cuatro limitaciones:

1. **Bloqueo de edición en pantalla:** En Quirófano en Vivo (`ModalEnviarIndicacionesQuirofano.tsx`), el cuerpo de la indicación y las pautas de alarma no se muestran ni se pueden editar; los medicamentos y cuidados son de solo lectura. En Asesoramiento Quirúrgico (`ModalIndicacionesMedicasCaso.tsx` → `SeccionIndicacionesExpediente.tsx`), la sección abre colapsada y solo permite editar el texto principal, dejando fuera medicamentos, cuidados generales y pautas de alarma.
2. **Pérdida de cambios ante módulos `1..N`:** Cuando una práctica tiene más de un módulo asignado, ambos modales envían los objetos originales de los módulos y el backend ignora las ediciones realizadas sobre los campos superiores.
3. **Inconsistencia entre Preview y Envío:** En Quirófano en Vivo, la previsualización del PDF no envía `modulos`, mientras que el despacho por WhatsApp sí lo hace, por lo que el usuario puede aprobar un PDF distinto al que recibe el paciente.
4. **Auditoría y persistencia incompletas:** La tabla `emisiones_indicaciones_geclisa` solo guarda `texto_indicaciones` y las reediciones sobrescriben el registro. No registra qué usuario editó, qué decía la plantilla original, ni persiste medicamentos, cuidados y alarmas para regenerar el PDF si el servidor se reinicia.

## Goals

*   **Edición completa e inmediata al abrir:** Exponer los 4 bloques clínicos (cuerpo de indicación, lista editable de medicamentos/dosis/frecuencias, cuidados generales y pautas de alarma) siempre visibles y editables al abrir el modal en Quirófano en Vivo y en Asesoramiento Quirúrgico.
*   **Edición independiente por módulo `1..N`:** Permitir editar cada módulo activo por separado cuando una práctica tiene múltiples módulos, preservando su separación por páginas en el PDF.
*   **Paridad exacta de documentos:** Garantizar que la previsualización PDF, el archivo enviado por WhatsApp y el PDF regenerado bajo demanda (`/static/indicacion_{id}.pdf` y `/static/indicacion_{id}_v{n}.pdf`) reflejen exactamente los datos editados de cada versión.
*   **Integración acotada con Geclisa:** Enviar a Geclisa (`POST /api/IndicacionesMedicas`) exclusivamente el `cuerpo_indicaciones` editado de cada módulo activo en la emisión inicial (`v1`).
*   **Historial versionado e inmutable para auditoría:** Registrar qué usuario autenticado modificó o emitió cada versión, cuándo ocurrió, el snapshot original resuelto y el contenido final emitido, conservando versiones anteriores sin sobrescribirlas y precargando la última versión al reabrir.
*   **Aislamiento de plantillas maestras:** Asegurar que toda modificación aplique únicamente al paciente y emisión puntual.

## Non-Goals

*   Modificar, sobrescribir o crear nuevas plantillas maestras del Nomenclador o reglas por cirujano desde estos modales.
*   Implementar un editor de texto enriquecido (HTML/Markdown/WYSIWYG); el contenido clínico sigue siendo texto plano y listas estructuradas.
*   Anexar medicamentos, cuidados generales o pautas de alarma al campo de texto enviado a Geclisa.
*   Restringir la edición por rol dentro de Quirófano en Vivo o Asesoramiento Quirúrgico.

## Critical User Journeys (CUJs)

### CUJ 1: Edición y envío de indicación en Quirófano en Vivo (1 módulo o plantilla única)

*   **Given**: Un turno en estado `operado` (con o sin `asesoria_id` vinculada) y una plantilla resuelta para el cirujano y práctica.
*   **When**: El usuario abre el modal express desde la Pizarra en Vivo, ve precargados y editables el cuerpo, medicamentos, cuidados y alarmas, modifica la frecuencia de un colirio y agrega un horario de control en el cuerpo, previsualiza el PDF y presiona "Enviar Indicaciones por WhatsApp".
*   **Then**: El Preview PDF y el PDF adjunto enviado por WhatsApp muestran exactamente los valores editados; la plantilla maestra queda intacta; y en base de datos se crea la versión `1` con `fue_modificada = true`, el usuario autenticado, el snapshot original y el contenido final.

### CUJ 2: Edición por módulo en práctica con múltiples módulos (`1..N`)

*   **Given**: Una práctica configurada con 2 o más módulos postquirúrgicos (por ejemplo, esquema de colirios + certificado o pautas específicas).
*   **When**: El usuario abre el modal, mantiene activos al menos 1 módulo, edita el texto del Módulo 1 y ajusta un medicamento del Módulo 2.
*   **Then**: El backend recibe `modulos` con los valores editados por módulo, genera un PDF de páginas separadas con los cambios de cada módulo, envía a Geclisa únicamente el `cuerpo_indicaciones` editado de cada módulo y audita el arreglo completo de módulos originales vs. emitidos.

### CUJ 3: Reapertura y reedición con historial de versiones

*   **Given**: Un paciente que ya tiene al menos una emisión previa registrada (desde Quirófano en Vivo o Asesoramiento Quirúrgico).
*   **When**: Un usuario vuelve a abrir el modal de indicaciones en Quirófano en Vivo o usa "Reeditar" en Asesoramiento, ajusta una pauta de alarma y reemite.
*   **Then**: El modal precarga la última versión emitida a ese paciente (conservando la plantilla maestra original en servidor para referencia/restauración). Al confirmar, el backend valida `expected_version`, conserva intacta la versión anterior en `emisiones_indicaciones_versiones` y registra `version_numero = N + 1` con su propio PDF versionado.

### CUJ 4: Manejo de errores (Geclisa, concurrencia o 0 módulos activos)

*   **Given**: Un usuario intenta emitir o reeditar una indicación.
*   **When**: (a) desactiva todos los módulos y deja el cuerpo vacío; (b) dos usuarios editan simultáneamente la misma emisión; o (c) Geclisa o WhatsApp fallan durante el despacho.
*   **Then**: (a) la UI deshabilita Preview y Envío mientras no exista al menos 1 módulo activo con contenido; (b) la segunda escritura concurrente recibe `409 Conflict` sin pisar la versión ya guardada; (c) si WhatsApp falla después de persistir la emisión en Supabase, la versión queda guardada con `whatsapp_status = 'fallido'` y el operador recibe el detalle para reintentar; si Geclisa falla parcialmente en un módulo de `v1`, se registran los `geclisa_im_ids` efectivamente creados y el error sin perder el registro en CRM.

## Technical Plan (Architecture)

La arquitectura unifica la experiencia de edición en frontend mediante un componente compartido (`EditorIndicacionesClinicas`) y centraliza la persistencia versionada y auditoría en el backend.

### 1. Flujo de Datos y Componentes

```text
+-------------------------------------------------------------------+
| Frontend (Quirófano en Vivo / Asesoramiento Quirúrgico)           |
|                                                                   |
|  [ModalEnviarIndicacionesQuirofano]   [SeccionIndicacionesExp.]   |
|                 \                             /                   |
|                  v                           v                    |
|          [EditorIndicacionesClinicas (Componente Compartido)]     |
|          - Estado: modulosEditables[] (1..N)                      |
|          - snapshotOriginalLocal (solo UX: badge y Restaurar)     |
+---------------------------------+---------------------------------+
                                  |
          +-----------------------+-----------------------+
          | Preview PDF                                   | Emitir (v1) / Reemitir (v2+)
          v                                               v
POST /api/indicaciones/preview-pdf          POST /api/turnos-quirofano/{turno_id}/enviar-indicaciones-postqx
(envía modulosEditables[])                  POST /api/expediente-quirurgico/{asesoria_id}/emitir-indicaciones
                                            PUT  /api/indicaciones/emisiones/{emision_id}/reeditar
                                                          |
                                                          v
+-------------------------------------------------------------------+
| Backend (FastAPI + indicaciones_service.py)                       |
|                                                                   |
| 1. Autenticación obligatoria desde JWT (request.state.user -> sub)|
| 2. Baseline servidor: resuelve plantilla en v1 / lee cabecera v2+ |
| 3. Diff servidor: calcula fue_modificada y campos_modificados     |
| 4. Geclisa (solo v1 cuando aplica): envía SOLO cuerpo_indicaciones|
| 5. ReportLab: genera indicacion_{id}.pdf / indicacion_{id}_v{n}.pdf|
| 6. RPC transaccional Supabase: bloquea version_actual y persiste  |
| 7. WhatsApp: adjunta el PDF generado                              |
+-------------------------------------------------------------------+
```

### 2. Diseño de Frontend (`EditorIndicacionesClinicas`)

1. **Paridad de carga inicial (`preparar` / `resolver-sugerencia`):**
   - Al abrir `ModalEnviarIndicacionesQuirofano`, si `turnos_quirofano.indicaciones_postqx_emision_id` ya existe, el backend devuelve en `preparar-indicaciones-postqx` el estado completo de la última versión (`ultima_emision` + `version_actual`) junto con la plantilla base resuelta (`sugerencia`). El modal precarga `ultima_emision` y pasa `expected_version = ultima_emision.version_actual` al reemitir.
   - Si la emisión previa es anterior a esta migración (`modulos_emitidos_json IS NULL`), un adaptador en frontend convierte los campos planos (`texto_indicaciones`, `medicamentos`, `cuidados_generales`, `pautas_alarma`) en un `ModuloIndicacionEditable[]` de longitud 1.
   - En `ModalIndicacionesMedicasCaso.tsx`, `SeccionIndicacionesExpediente` se muestra desplegada por defecto (`desplegadoInicial={true}`) con todos los campos editables visibles de inmediato.
2. **Estructura de estado por módulo (`ModuloIndicacionEditable`):**
   - Cada módulo tiene: `{ id, titulo, activo, cuerpo_indicaciones, medicamentos[], cuidados_generales, pautas_alarma, origen }`.
   - Si `modulos.length > 1`, cada módulo activo se edita en su propio bloque/pestaña identificada por `titulo`; si `modulos.length === 1`, se renderiza directamente sin selector.
   - Cada fila de medicamento normaliza claves legacy (`medicamento`/`nombre` → `droga`, `horario` → `frecuencia`, `notas` → `instrucciones`) y expone inputs inline para `droga`, `dosis`, `frecuencia` (con `<datalist>` de sugerencias frecuentes: `"1 gota cada 4 hs"`, `"1 gota cada 6 hs"`, `"1 gota cada 8 hs"`, `"1 gota cada 12 hs"`, `"1 gota cada 24 hs"`, `"1 aplicación antes de dormir"`), `duracion` e `instrucciones`, más botones para agregar y eliminar fila.
3. **Resguardo UX y paridad de tema:**
   - El componente recibe una prop `variant?: "dark" | "light"` (o usa tokens de tema) para integrarse tanto con el estilo `slate-900` de `ModalEnviarIndicacionesQuirofano` como con las variables CSS de `SeccionIndicacionesExpediente`.
   - `snapshotOriginal` se conserva únicamente en memoria del frontend para mostrar el indicador *"Editado para este paciente"* y habilitar **"Restaurar original"** por módulo.
   - Cambiar de plantilla manual o desactivar un módulo con cambios manuales solicita confirmación antes de descartar ediciones.
   - Los botones de **Previsualizar PDF** y **Enviar** validan que exista al menos 1 módulo activo con contenido (en lugar de depender de `!textoIndicaciones`).
   - Tanto Preview PDF como Emisión/Reedición envían exactamente el mismo arreglo `modulos` editado.

### 3. Modelo de Datos, Atomicidad y Versionado en Supabase

1. **Extensión de `emisiones_indicaciones_geclisa` (cabecera vigente + baseline inmutable):**
   - Contenido completo de la versión vigente (permite compatibilidad y regeneración rápida): `medicamentos` (`JSONB`), `cuidados_generales` (`TEXT`), `pautas_alarma` (`TEXT`), `modulos_emitidos_json` (`JSONB`).
   - Baseline inmutable de `v1`: `plantilla_origen_id` (`TEXT`), `origen_resolucion` (`TEXT`), `contenido_original_json` (`JSONB`).
   - Estado de versión vigente: `version_actual` (`INTEGER NOT NULL DEFAULT 1`), `fue_modificada` (`BOOLEAN NOT NULL DEFAULT false`), `campos_modificados` (`JSONB NOT NULL DEFAULT '[]'`), `operador_id` (`TEXT`), `operador_nombre` (`TEXT`), `editado_at` (`TIMESTAMPTZ`).
2. **Nueva tabla `emisiones_indicaciones_versiones` (historial inmutable):**
   - Columnas: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `emision_id UUID NOT NULL REFERENCES emisiones_indicaciones_geclisa(id) ON DELETE CASCADE`, `version_numero INTEGER NOT NULL`, `modulos_emitidos_json JSONB NOT NULL`, `texto_indicaciones TEXT`, `medicamentos JSONB`, `cuidados_generales TEXT`, `pautas_alarma TEXT`, `fue_modificada BOOLEAN NOT NULL DEFAULT false`, `campos_modificados JSONB NOT NULL DEFAULT '[]'`, `pdf_url TEXT`, `geclisa_im_id INTEGER`, `geclisa_im_ids JSONB DEFAULT '[]'`, `operador_id TEXT`, `operador_nombre TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
   - Restricciones e índices: `UNIQUE (emision_id, version_numero)` e índice `(emision_id, version_numero DESC)`, más políticas RLS/GRANT equivalentes a `emisiones_indicaciones_geclisa`.
3. **Atomicidad de escritura (`expected_version`):**
   - Una función RPC de Postgres (`registrar_version_indicacion(...)`) ejecuta en una única transacción el `UPDATE emisiones_indicaciones_geclisa SET ..., version_actual = version_actual + 1 WHERE id = p_emision_id AND version_actual = p_expected_version` y el `INSERT INTO emisiones_indicaciones_versiones`. Si `FOUND` es falso, devuelve conflicto de concurrencia (`409 Conflict`).

### 4. Backend: Contratos, Seguridad, Geclisa y Regeneración de PDF

1. **Identidad de usuario y baseline confiable (sin confiar en el cliente):**
   - Los endpoints de emisión y reedición exigen `user = getattr(request.state, "user", None)` autenticado (devolviendo `401` si falta o es token `anon` sin sesión de operador). Se extrae `operador_id = user.get("sub")` y `operador_nombre` desde `(user.get("user_metadata") or {}).get("nombre_completo") or full_name`, o buscando en tabla `usuarios` por `id = sub`, o `user.get("email")`.
   - El cliente **no** envía `snapshot_original` para auditoría: en `v1`, el servidor resuelve `contenido_original_json` mediante `resolver_plantilla_sugerida` (o consultando la plantilla seleccionada si fue manual); en `v2+`, compara contra el `contenido_original_json` ya guardado en `emisiones_indicaciones_geclisa` (diff contra plantilla base) y registra qué campos cambiaron.
2. **Flujo unificado `v1` vs `v2+` y política de Geclisa:**
   - Contrato único en `modulos[]` (longitud `1..N`). Cualquier caller legacy con campos planos se adapta a un arreglo de 1 módulo en el borde del endpoint.
   - **Emisión inicial (`v1`):** Si el caso tiene `ficha_id_geclisa` y médico válido (en Asesoramiento, o en Quirófano cuando exista `asesoria_id`), envía a Geclisa exclusivamente `cuerpo_indicaciones` de cada módulo activo; la rama de Quirófano sin `asesoria_id` permanece CRM-local (y corrige la llamada `obtener_prestador_por_cirujano(t.get("cirujano_id"), t.get("cirujano_nombre") or "")` para resolver correctamente matrícula y firma).
   - **Reemisión / Reedición (`v2+`):** Tanto `PUT /api/indicaciones/emisiones/{emision_id}/reeditar` como `POST /api/turnos-quirofano/{turno_id}/enviar-indicaciones-postqx` (cuando `indicaciones_postqx_emision_id` ya existe) convergen en la misma función de nueva versión. En `v2+` **no** se reenvía a `POST /api/IndicacionesMedicas` en Geclisa (evitando duplicar indicaciones en el sistema hospitalario), sino que se genera el PDF versionado `/static/indicacion_{emision_id}_v{n}.pdf`, se persiste atómicamente la versión `N + 1` y se despacha por WhatsApp.
3. **Regeneración On-Demand de todas las versiones (`servir_archivo_estatico`):**
   - Convención única: `v1` usa `/static/indicacion_{emision_id}.pdf`; `v2+` usa `/static/indicacion_{emision_id}_v{n}.pdf`.
   - `servir_archivo_estatico` parsea el patrón opcional `_v(\d+)`. Si trae versión, consulta `emisiones_indicaciones_versiones` por `(emision_id, version_numero)` junto con la cabecera (`emisiones_indicaciones_geclisa` con `select("*, pacientes(*), asesorias_quirurgicas(*, pacientes(*))")`); si no trae versión, lee `emisiones_indicaciones_geclisa` directamente (usando `pacientes(*)` directo cuando `asesoria_id` es nulo). Pasa `modulos_emitidos_json` y `filename_override` a `generar_pdf_indicacion_medica`.
4. **Contrato de consulta de versiones:**
   - `GET /api/indicaciones/emisiones/{emision_id}/versiones`: Valida UUID (`400` si inválido), verifica existencia (`404` si no existe) y retorna `{"success": True, "emision_id": emision_id, "versiones": [...]}` ordenado por `version_numero DESC`, consumido por el historial expandible en `SeccionIndicacionesExpediente.tsx` (y modal de detalle en Quirófano).

## Alternatives Considered

### Alternative A: Edición consolidada única en prácticas con módulos `1..N`

*   **Pros**: Interfaz más simple con un único `<textarea>` y una sola lista de medicamentos aunque la práctica tenga 2 o más módulos.
*   **Cons**: Fusionar los módulos elimina la separación por hojas en ReportLab y mezcla fármacos de protocolos clínicos distintos.
*   **Reason for Rejection**: Rejected by author: Goal #2 exige edición por módulo para preservar páginas separadas y orden clínico.

### Alternative B: Anexar medicamentos, cuidados generales y pautas de alarma al texto plano de Geclisa

*   **Pros**: Dejaría el detalle completo en texto plano dentro de Geclisa además del PDF.
*   **Cons**: Altera las convenciones del sistema externo `IndicacionesMedicas`.
*   **Reason for Rejection**: Rejected by author: Non-Goal #3 mantiene a Geclisa limitado únicamente a `cuerpo_indicaciones`.

### Alternative C: Sobrescribir la emisión existente al reabrir o reeditar (sin historial de versiones)

*   **Pros**: Evita crear `emisiones_indicaciones_versiones` y la RPC transaccional.
*   **Cons**: Destruye la trazabilidad médico-legal ante correcciones posteriores.
*   **Reason for Rejection**: Rejected by author: Goal #5 exige conservar versiones anteriores sin sobrescribirlas.

### Alternative D: Duplicar los controles de edición en Quirófano en Vivo y Asesoramiento Quirúrgico

*   **Pros**: Evita abstraer un componente React nuevo.
*   **Cons**: Duplica lógica de módulos `1..N`, filas de medicamentos, sugerencias de frecuencia y adaptadores legacy.
*   **Reason for Rejection**: Un componente compartido (`EditorIndicacionesClinicas`) garantiza paridad funcional y mantenimiento único.

### Alternative E: Registrar la auditoría únicamente en `logs_sistema`

*   **Pros**: Sin migración de esquema.
*   **Cons**: El texto libre no permite reconstruir PDFs estructurados tras reinicios ni bloquear concurrencia por versión.
*   **Reason for Rejection**: Se requiere almacenamiento relacional/JSONB para auditoría consultable y regeneración fiel.

## Non-Functional Requirements

*   **Seguridad e Integridad de Auditoría:** El cálculo de `fue_modificada` y `campos_modificados` se ejecuta en servidor comparando contra `contenido_original_json` resuelto en servidor; se rechazan peticiones de escritura sin usuario JWT válido (`401`).
*   **Latencia y Timeouts:** La emisión `v1` con `1..N` llamadas a Geclisa + generación ReportLab debe operar con timeout por llamada externa de `10s` (presupuesto total `< 25s`), persistiendo el registro en CRM incluso si WhatsApp falla posteriormente.
*   **Compatibilidad hacia atrás (Rollout):** La migración SQL (`035`) se ejecuta antes de desplegar el backend; los campos nuevos son nullable/con defaults para no romper emisiones históricas ni la regeneración de PDFs previos.

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `database/migrations/035_emisiones_indicaciones_edicion_y_versiones.sql` (Create)

*   **Type / Scope**: Migración SQL de Supabase (PostgreSQL).
*   **Proposed Changes**:
    *   Extender `emisiones_indicaciones_geclisa` con: `medicamentos JSONB`, `cuidados_generales TEXT`, `pautas_alarma TEXT`, `modulos_emitidos_json JSONB`, `plantilla_origen_id TEXT`, `origen_resolucion TEXT`, `contenido_original_json JSONB`, `version_actual INTEGER NOT NULL DEFAULT 1`, `fue_modificada BOOLEAN NOT NULL DEFAULT false`, `campos_modificados JSONB NOT NULL DEFAULT '[]'`, `operador_id TEXT`, `operador_nombre TEXT`, `editado_at TIMESTAMPTZ`.
    *   Crear `emisiones_indicaciones_versiones` con `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `emision_id UUID NOT NULL REFERENCES emisiones_indicaciones_geclisa(id) ON DELETE CASCADE`, `version_numero INTEGER NOT NULL`, `modulos_emitidos_json JSONB NOT NULL`, `texto_indicaciones TEXT`, `medicamentos JSONB`, `cuidados_generales TEXT`, `pautas_alarma TEXT`, `fue_modificada BOOLEAN NOT NULL DEFAULT false`, `campos_modificados JSONB NOT NULL DEFAULT '[]'`, `pdf_url TEXT`, `geclisa_im_id INTEGER`, `geclisa_im_ids JSONB DEFAULT '[]'`, `operador_id TEXT`, `operador_nombre TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, constraint `UNIQUE (emision_id, version_numero)`, índice `(emision_id, version_numero DESC)`, y políticas RLS/GRANT equivalentes a `emisiones_indicaciones_geclisa`.
    *   Crear función RPC `registrar_version_indicacion(...)` para ejecutar atómicamente el `UPDATE` con `WHERE version_actual = p_expected_version` y el `INSERT` en `emisiones_indicaciones_versiones`.

#### 2. `backend/app/services/indicaciones_service.py` (Modify)

*   **Type / Scope**: Servicio de lógica de negocio de indicaciones médicas (Python).
*   **Proposed Changes**:
    *   Agregar `_calcular_diff_indicaciones(original_modulos, final_modulos)`: normaliza saltos de línea/espacios y `None` vs `[]`, ignora claves de UI (`id`, `titulo`, `origen`, `activo`), compara `cuerpo_indicaciones`, `medicamentos`, `cuidados_generales` y `pautas_alarma`, y retorna `(fue_modificada: bool, campos_modificados: List[str])` (ej. `["cuerpo_indicaciones", "medicamentos"]`; devuelve `(False, [])` si no hay baseline).
    *   Agregar `_append_version_emision(emision_id, modulos, expected_version, operador_id, operador_nombre, reenviar_whatsapp, ...)`: invoca la RPC `registrar_version_indicacion`, genera el PDF versionado `indicacion_{emision_id}_v{n}.pdf` sin reenviar a Geclisa, despacha WhatsApp si corresponde y retorna la nueva versión (`409` si hay conflicto de concurrencia).
    *   En `emitir_indicaciones_expediente`:
        *   Actualizar el guard de línea 800 a `if not texto_final and not modulos:` para no pisar con `resolver_plantilla_sugerida` cuando llegan `modulos` editados.
        *   Resolver el baseline `contenido_original_json` en el servidor (vía `resolver_plantilla_sugerida` o plantilla manual) para calcular `_calcular_diff_indicaciones`.
        *   Enviar a Geclisa solo `cuerpo_indicaciones` de cada módulo, generar PDF desde `modulos`, derivar campos planos de resumen para cabecera e insertar `v1` en cabecera + `emisiones_indicaciones_versiones`.
    *   En `preparar_indicaciones_postqx_turno` (nombre real en línea 1294):
        *   Si `t.get("indicaciones_postqx_emision_id")` existe, consultar `emisiones_indicaciones_geclisa` y retornar `ultima_emision` (incluyendo `version_actual`, `modulos_emitidos_json` y campos planos) junto con `sugerencia`.
    *   En `emitir_indicaciones_turno_quirofano`:
        *   Si `t.get("indicaciones_postqx_emision_id")` ya existe, delegar directamente a `_append_version_emision` (`v2+`) en lugar de crear una emisión nueva.
        *   En emisión inicial (`v1`) sin `asesoria_id` (rama CRM-local), corregir `obtener_prestador_por_cirujano(t.get("cirujano_id"), t.get("cirujano_nombre") or "")`, soportar `modulos[]` editados y persistir `v1` en `emisiones_indicaciones_versiones`.
    *   En `reeditar_emision_indicaciones`:
        *   Aceptar `modulos[]` (adaptando payload plano si fuera legacy) y `expected_version`, y delegar en `_append_version_emision`.

#### 3. `backend/app/services/indicaciones_pdf_service.py` (Modify)

*   **Type / Scope**: Generador de PDFs ReportLab (Python).
*   **Proposed Changes**:
    *   En `generar_pdf_indicacion_medica`, aceptar `filename_override: Optional[str] = None` para guardar versiones históricas como `indicacion_{emision_id}_v{n}.pdf` sin sobrescribir PDFs previos en disco.
    *   Cuando `datos_emision["modulos"]` venga poblado, renderizar cada módulo con sus valores exactos (`cuerpo_indicaciones`, `medicamentos`, `cuidados_generales`, `pautas_alarma`), omitiendo únicamente módulos totalmente vacíos o inactivos.

#### 4. `backend/app/main.py` (Modify)

*   **Type / Scope**: Endpoints FastAPI y servidor de archivos estáticos (Python).
*   **Proposed Changes**:
    *   Inyectar `request: Request` en `emitir_indicaciones_expediente_api`, `reeditar_indicacion_api` y `enviar_indicaciones_postqx_api`. Validar `user = getattr(request.state, "user", None)` exigiendo usuario autenticado (`sub` presente y `role != "anon"`, devolviendo `401` en caso contrario). Extraer `operador_id = user.get("sub")` y `operador_nombre` desde `user_metadata` → tabla `usuarios` → `email`.
    *   En `reeditar_indicacion_api` (líneas 4376–4378), actualizar el guard a `if not texto and not modulos:` y propagar `modulos` y `expected_version`.
    *   Agregar `GET /api/indicaciones/emisiones/{emision_id}/versiones`: valida UUID (`400`), verifica emisión (`404`) y retorna `{"success": True, "emision_id": emision_id, "versiones": [...]}` ordenado por `version_numero DESC`.
    *   En `servir_archivo_estatico` (líneas 644–711): parsear patrón `indicacion_{emision_id}(?:_v(\d+))?\.pdf`. Si hay `_v{n}`, consultar `emisiones_indicaciones_versiones` por `(emision_id, version_numero)` + cabecera `emisiones_indicaciones_geclisa` con `select("*, pacientes(*), asesorias_quirurgicas(*, pacientes(*))")`; si no hay `_v{n}`, consultar la cabecera usando `pacientes(*)` directo cuando `asesoria_id` sea nulo. Pasar `modulos_emitidos_json` y `filename_override` a `generar_pdf_indicacion_medica`.

#### 5. `frontend/src/components/quirofano/EditorIndicacionesClinicas.tsx` (Create)

*   **Type / Scope**: Componente React/TypeScript compartido de edición clínica.
*   **Proposed Changes**:
    *   Exportar interfaz `ModuloIndicacionEditable` (`id`, `titulo`, `activo`, `cuerpo_indicaciones`, `medicamentos`, `cuidados_generales`, `pautas_alarma`, `origen`) y `EditorIndicacionesClinicasProps` (`modulos`, `snapshotOriginal`, `onChange`, `variant?: "dark" | "light"`).
    *   Incluir adaptador `normalizarMedicamento` (`medicamento`/`nombre` → `droga`, `horario` → `frecuencia`, `notas` → `instrucciones`) y adaptador `legacyEmisionAModulos` para registros antiguos sin `modulos_emitidos_json`.
    *   Si `modulos.filter(m => m.activo).length > 1`, renderizar bloques/pestañas por módulo activo; si es `1`, renderizar directo.
    *   Exponer `<textarea>` para `cuerpo_indicaciones`, tabla inline editable de `medicamentos` (con `<datalist>` de frecuencias oftalmológicas frecuentes y botones agregar/eliminar), `<textarea>` para `cuidados_generales` y `<textarea>` para `pautas_alarma`.
    *   Mostrar indicador *"Editado para este paciente (plantilla maestra intacta)"* cuando difiera de `snapshotOriginal` y botón **"Restaurar original"** por módulo.

#### 6. `frontend/src/components/quirofano/ModalEnviarIndicacionesQuirofano.tsx` (Modify)

*   **Type / Scope**: Modal express de indicaciones en Quirófano en Vivo (React/TypeScript).
*   **Proposed Changes**:
    *   Integrar `EditorIndicacionesClinicas` (`variant="dark"`) siempre visible apenas carga el modal.
    *   Precargar `ultima_emision` (usando `legacyEmisionAModulos` si aplica) cuando el turno ya fue enviado, conservando `sugerencia` en `snapshotOriginal` y enviando `expected_version`.
    *   Pedir confirmación antes de descartar ediciones manuales al cambiar plantilla manual o desactivar un módulo editado.
    *   Unificar el payload de `handleVerPreviewPdf` y `handleEnviarWhatsApp` enviando `modulos` activos editados, y actualizar la condición `disabled` de los botones (líneas 517 y 527) para validar sobre `modulosEditables` activos con contenido.

#### 7. `frontend/src/components/quirofano/SeccionIndicacionesExpediente.tsx` y `ModalIndicacionesMedicasCaso.tsx` (Modify)

*   **Type / Scope**: Flujo de indicaciones en Asesoramiento Quirúrgico (React/TypeScript).
*   **Proposed Changes**:
    *   En `ModalIndicacionesMedicasCaso.tsx`, pasar `desplegadoInicial={true}` a `SeccionIndicacionesExpediente`.
    *   En `SeccionIndicacionesExpediente.tsx`, integrar `EditorIndicacionesClinicas` (`variant="light"`) tanto en emisión inicial como en Preview PDF y "Reeditar" (enviando `modulos` y `expected_version`), agregando confirmación antes de sobrescribir cambios manuales al cambiar plantilla o módulos.
    *   Mostrar badge de versión (`v{N}`) y estado de modificación en el historial de emisiones, con despliegue de versiones consumiendo `GET /api/indicaciones/emisiones/{emision_id}/versiones`.

#### 8. `backend/tests/test_indicaciones_edicion_auditoria.py` (Create)

*   **Type / Scope**: Pruebas unitarias Backend (pytest).
*   **Proposed Changes**:
    *   Validar `_calcular_diff_indicaciones` (normalización de espacios, claves UI ignoradas, baseline `None`).
    *   Verificar que `emitir_indicaciones_expediente` y `emitir_indicaciones_turno_quirofano` envían a Geclisa solo `cuerpo_indicaciones` editado y pasan `modulos` editados a `generar_pdf_indicacion_medica`.
    *   Verificar que reenviar desde Quirófano en Vivo (`indicaciones_postqx_emision_id` existente) o llamar a `reeditar_emision_indicaciones` crea `version_numero = N + 1` con `expected_version` y rechaza conflictos (`409`).
    *   Verificar que `reeditar_indicacion_api` acepta payloads solo con `modulos[]` y que `servir_archivo_estatico` reconstruye `_v{n}.pdf` y emisiones sin `asesoria_id`.

### Verification Plan

*   **Compilation/Build**: Ejecutar `npm --prefix frontend run build` para validar compilación TypeScript y Next.js sin errores.
*   **Unit Tests**: Ejecutar `pytest backend/tests/test_indicaciones_edicion_auditoria.py` para validar diff de auditoría, precedencia de módulos editados, aislamiento de Geclisa y versionado con bloqueo optimista.
*   **Static Analysis & Linting**: Verificar sintaxis Python (`python -m py_compile`) y lint de Next.js durante el build.
*   **E2E/Integration Manual**:
    1. En Quirófano en Vivo, abrir un turno con 1 módulo y otro con 2+ módulos; editar cuerpo, agregar medicamento y cambiar dosis/frecuencia; comprobar que Preview PDF y el PDF recibido por WhatsApp coinciden exactamente y que `emisiones_indicaciones_geclisa` + `emisiones_indicaciones_versiones` registran `fue_modificada = true` y el `sub`/nombre del usuario autenticado.
    2. Reabrir el turno ya enviado y reemitir con un segundo cambio; confirmar que precarga `v1`, crea `v2` (`indicacion_{id}_v2.pdf`) manteniendo `v1` intacta y sin duplicar en Geclisa.
    3. Repetir emisión y reedición desde Asesoramiento Quirúrgico verificando apertura desplegada por defecto, envío exclusivo de `cuerpo_indicaciones` a Geclisa en `v1` y consulta del historial de versiones.

--------------------------------------------------------------------------------

*Drafted with EGM*
