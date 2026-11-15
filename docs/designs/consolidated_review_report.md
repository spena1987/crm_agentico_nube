# Consolidated Goldfish Review Report — Unificación del Flujo Comercial, Biométrico y Quirúrgico de Lentes Intraoculares (LIO)

* **Target Design Document:** [unificacion_flujo_lio_nomenclador_quirofano.md](file:///D:/Github/crm_agentico_nube/docs/designs/unificacion_flujo_lio_nomenclador_quirofano.md) (`FeatureRange: 1..302`, `DetailedRange: 303..400`)
* **Date:** 2026-11-15
* **Execution Preset:** Consolidated report with all review rubrics (`Uninterrupted Full Flow`: Stages 5, 6, 7, 8, and 9)

---

## 1. Stage Execution Summary

| Stage | Stage Name | Reviewers Executed | Individual Report Artifact | Blockers (🔴) | Majors (🟡) | Nits (🟢) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Stage 5** | Initial Zoom Out & Inventive Catalyst | `egm-zoom-out`, `egm-inventive-catalyst` | [zoom_out_report.md](file:///D:/Github/crm_agentico_nube/zoom_out_report.md) | 0 | 4 | 1 |
| **Stage 6** | Comprehension Test (Self-Containment) | `egm-comprehension` | [comprehension_report.md](file:///D:/Github/crm_agentico_nube/comprehension_report.md) | 0 | 0 | 2 |
| **Stage 7** | Critic Review (`FeatureRange: 1..302`) | `egm-design`, `egm-structural`, `egm-style` | [critic_report.md](file:///D:/Github/crm_agentico_nube/critic_report.md) | 0 | 3 | 3 |
| **Stage 8** | Intermediate Zoom Out Review | `egm-zoom-out` | [intermediate_zoom_out_report.md](file:///D:/Github/crm_agentico_nube/intermediate_zoom_out_report.md) | 0 | 3 | 2 |
| **Stage 9** | Implementation Readiness (`DetailedRange: 303..400`) | `egm-implementation-readiness`, `egm-codebase-details`, `egm-style` | [implementation_readiness_report.md](file:///D:/Github/crm_agentico_nube/implementation_readiness_report.md) | 0 | 3 | 2 |
| **Consolidated (Deduplicated)** | **All 5 Stages Combined** | **All 7 Goldfish Lenses** | **[consolidated_review_report.md](file:///D:/Github/crm_agentico_nube/consolidated_review_report.md)** | **0** | **5** | **4** |

---

## 2. Prioritized Consolidated Action Items (🔴 Blocker -> 🟡 Major -> 🟢 Nit)

### 🔴 Blockers (0)

Ningún bloqueante arquitectónico detectado. Los cinco objetivos del diseño (`G1` a `G5`) y los cuatro recorridos críticos de usuario (`CUJ 1` a `CUJ 4`) son consistentes entre sí y con el modelo de datos actual.

---

### 🟡 Majors (5 Consolidated Action Items)

#### [M1] Persistencia de `override_quirofano`, `COLUMN_KEYS_TURNOS_QUIROFANO` y Lectura de Contexto en Endpoints de Quirófano
* **Source Findings:** Stage 5 `#2`, Stage 6 `#1`, Stage 7 `#2`, Stage 8 `#1`, Stage 9 `#2`
* **Affected Document Scope:** `Sections 5.2, 5.3` (líneas 224-270) y `Detailed Implementation Plan #1, #2, #7` (líneas 307-328, 370-379)
* **Technical Issue:**
  1. `crear_turno_quirofano` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L7390)) y `actualizar_turno_quirofano` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L7442)) filtran el diccionario de entrada contra `COLUMN_KEYS_TURNOS_QUIROFANO` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L6847-L6861)) antes de llamar a `sincronizar_asesoria_desde_quirofano(asesoria_id, payload)`. Cualquier clave como `override_quirofano` o `usuario_operador` que no esté en `COLUMN_KEYS_TURNOS_QUIROFANO` se descarta silenciosamente si no se pasa el diccionario `datos` original sin filtrar a `sincronizar_asesoria_desde_quirofano`.
  2. El documento menciona guardar `override_quirofano` *"tanto en `turnos_quirofano` como en `checklist_prequirurgico._lio_calculo_{ojo}`"*, pero la migración SQL no agrega columna en `turnos_quirofano`.
  3. `FichaTurnoModal.tsx` obtiene sus datos de `GET /api/asesorias-quirurgicas/pendientes-quirofano` (`get_asesorias_confirmadas_pendientes` en [db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L6993-L7164)) y `GET /api/turnos-quirofano` (`get_turnos_quirofano` en [db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L6804-L6833)). Actualmente, `get_turnos_quirofano` no selecciona `asesorias_quirurgicas(checklist_prequirurgico, ojo)` y `get_asesorias_confirmadas_pendientes` pisa `lente_tipo`/`lente_dioptria` con `opciones[0]` sin adjuntar `lio_propuesto`, `discrepancia_comercial_clinica` ni `override_quirofano`.
* **Actionable Fix:**
  1. Mantener `asesorias_quirurgicas.checklist_prequirurgico._lio_calculo_{ojo}` como el almacén canónico de `override_quirofano` y `discrepancia_comercial_clinica` (sin agregar columnas extra en `turnos_quirofano`; para turnos manuales sin `asesoria_id`, guardar el metadato dentro de `lio_calculo_opciones`), y pasar el diccionario `datos` original (incluyendo `usuario_operador` / `calculado_por`) a `sincronizar_asesoria_desde_quirofano`.
  2. Incluir `get_turnos_quirofano`, `get_turno_quirofano_by_id` y `get_asesorias_confirmadas_pendientes` en `Detailed Implementation Plan #2 (backend/app/db.py)` para que seleccionen `checklist_prequirurgico, ojo` de la asesoría vinculada y adjunten `lio_propuesto`, `discrepancia_comercial_clinica` y `override_quirofano` (respetando `override_quirofano.lente_aplicado_quirofano` cuando `override_quirofano.activo == True`).
  3. Especificar en `sincronizar_turno_quirofano_desde_asesoria` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L7662-L7755)) que si `override_quirofano.activo == False` y `_lio_calculo_{ojo}.lio_calculado == True`, copie los campos operativos del Plan A (`lente_tipo`, `lente_dioptria`, `es_torico`, `lente_torico_valor`, `lente_torico_eje`, `lio_calculado`, `lio_calculo_opciones`) al turno; y si `override_quirofano.activo == True`, preserve los valores operativos del turno.

---

#### [M2] Cobertura Completa de la Compuerta de Confirmación (`registrar_quick_recontacto_asesoria`, `sincronizar_turno_quirofano_desde_asesoria` y Fallback de Presupuesto sin LIO)
* **Source Findings:** Stage 5 `#1`, Stage 7 `#3 & #5`, Stage 8 `#2`, Stage 9 `#3.2`
* **Affected Document Scope:** `Sections 3.1, 3.2` (líneas 151-165) y `Detailed Implementation Plan #2, #3` (líneas 322-323, 335-339)
* **Technical Issue:**
  1. `registrar_quick_recontacto_asesoria` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L11188-L11195)) cuando `accion == "confirmado"` y `sincronizar_turno_quirofano_desde_asesoria` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L7759)) actualizan directamente `asesorias_quirurgicas.estado` a `'confirmado'` o `'programado'` sin pasar por `actualizar_asesoria_quirurgica`.
  2. En `cambiar_estado_presupuesto` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L4620-L4645)), si se aprueba un presupuesto de una cirugía que requiere LIO (`34031 - Catarata`) pero el presupuesto no contiene un ítem comercial de LIO y `_lio_seleccion` sigue en `'a_definir'`, no está especificado qué ocurre con el estado del expediente.
  3. En `listar_pacientes_calculo_lio` (`main.py` líneas 9045-9140), falta explicitar cómo aplica el filtro de pendientes (`es_calculado == False`) sobre la rama 1 (`turnos_quirofano`) cuando el turno tiene `asesoria_id` frente a cuando es un turno manual independiente (`asesoria_id is None`).
* **Actionable Fix:**
  1. Invocar `_validar_lio_definido_para_confirmacion` también en `registrar_quick_recontacto_asesoria` (cuando `accion == "confirmado"`) y antes de auto-promover el estado a `'programado'` en `sincronizar_turno_quirofano_desde_asesoria`.
  2. En `cambiar_estado_presupuesto`, soportar auto-hidratación de 1 o 2 ítems de LIO (para casos `AO` diferenciados); si tras inspeccionar el presupuesto aprobado `_lio_seleccion` sigue en `'a_definir'` y la práctica requiere LIO, marcar el presupuesto como `'aprobado'` (`presupuesto_aceptado = True`) pero mantener el expediente en `'en_analisis'` hasta que Asesoramiento seleccione el LIO comercial.
  3. En `listar_pacientes_calculo_lio` (`main.py`), para todo registro pendiente (`es_calculado == False`) que tenga `asesoria_id` (tanto en la rama `turnos_quirofano` como en `asesorias_quirurgicas`), exigir `estado in ('confirmado', 'programado')` y `lio_propuesto.estado in ('tentativo', 'confirmado')`; para turnos manuales de quirófano sin asesoría (`asesoria_id is None` y `lleva_lente == True`), mantenerlos visibles en la cola.

---

#### [M3] Aislamiento Concurrente de `_lio_calculo_{ojo}` en `actualizar_asesoria_quirurgica` y Evaluación Tri-Vectorial de Discrepancia Comercial-Clínica (con Sugerencia Inversa 1-Clic)
* **Source Findings:** Stage 5 `#4` (`Catalysts A, B, C`), Stage 8 `#2`
* **Affected Document Scope:** `Section 4.3` (líneas 192-221) y `Detailed Implementation Plan #2, #3, #5` (líneas 322-328, 340-342, 357-359)
* **Technical Issue:**
  1. `CasoFormularioActivo.tsx` ([líneas 1480-1519](file:///D:/Github/crm_agentico_nube/frontend/src/components/asesoria/CasoFormularioActivo.tsx#L1480-L1519)) envía su estado local `...checklist` en `PUT /api/asesorias-quirurgicas/{id}`. Si el cirujano sella un cálculo o Quirófano aplica un `override_quirofano` mientras el asesor tiene abierto el expediente, el guardado posterior del asesor sobrescribirá `_lio_calculo_OD` / `_lio_calculo_OI` con el estado viejo del navegador.
  2. El plan de `db.py` no incluye reevaluar `discrepancia_comercial_clinica` cuando Asesoramiento cambia `_lio_seleccion` en `actualizar_asesoria_quirurgica` ni cuando Quirófano cambia el lente en el Escenario B (`override_quirofano`).
  3. El botón rápido en `CasoFormularioActivo.tsx` (líneas 220 y 358) para sincronizar el LIO comercial al tipo calculado por el médico necesita saber a qué código/ID de `nomenclador_practicas` corresponde el modelo clínico y toricidad elegidos por el médico.
* **Actionable Fix:**
  1. En `actualizar_asesoria_quirurgica` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L3267-L3277)), preservar siempre los sub-objetos `_lio_calculo_OD` y `_lio_calculo_OI` existentes en base de datos (`prev_chk`) antes de fusionar el `checklist_prequirurgico` enviado por el frontend.
  2. Centralizar la detección en una función `_evaluar_discrepancia_comercial_clinica(as_row, ojo, lente_clinico_efectivo, usuario)` en `db.py` —que además resuelva de forma inversa `comercial_sugerido: { id, codigo, nombre, precio, moneda }` buscando en `obtener_lios_comerciales()` la práctica comercial cuya `familias_lio_ids` y `condicion_toricidad` coincidan con el lente clínico— e invocarla en los tres puntos de mutación: `guardar_calculo_lio_endpoint`, `sincronizar_asesoria_desde_quirofano` (Escenarios A y B), y `actualizar_asesoria_quirurgica` (cuando cambia `_lio_seleccion`).

---

#### [M4] Consolidación Completa de Familias Duplicadas (`catalogo_maestro_gtin`, `sincronizar_lentes_masivos`, `sincronizar_catalogo_maestro_con_geclisa_endpoint` y `admite_toricos`)
* **Source Findings:** Stage 5 `#3`, Stage 6 `#2`, Stage 7 `#1`, Stage 8 `#3`, Stage 9 `#3.1`
* **Affected Document Scope:** `Section 2.2` (líneas 143-148) y `Detailed Implementation Plan #1, #2, #3` (líneas 312, 321, 333)
* **Technical Issue:**
  1. Además de `modelos_lio_items.modelo_lio_id`, la tabla `catalogo_maestro_gtin` también posee una columna `modelo_lio_id` ([main.py](file:///D:/Github/crm_agentico_nube/backend/app/main.py#L8483), [db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L9483-L9491)). Eliminar una familia duplicada de `modelos_lio` sin reasignar antes `catalogo_maestro_gtin.modelo_lio_id` dejará referencias huérfanas o fallará por clave foránea.
  2. La creación de familias duplicadas ocurre en `sincronizar_lentes_masivos` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L9318-L9378), invocado por `sincronizar_masivo_alcon_endpoint`) y en `sincronizar_catalogo_maestro_con_geclisa_endpoint` (`POST /api/catalogo-maestro/sincronizar-geclisa` en [main.py](file:///D:/Github/crm_agentico_nube/backend/app/main.py#L8432-L8565)).
  3. En `crear_modelo_lio_item` ([db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L9217-L9220)), si una familia consolidada tiene `admite_toricos == False`, se rechaza la vinculación de ítems con `es_torico == True`.
* **Actionable Fix:**
  1. En la migración SQL y en `normalizar_familias_modelos_lio()`, reasignar tanto `modelos_lio_items.modelo_lio_id` como `catalogo_maestro_gtin.modelo_lio_id` hacia el UUID canónico antes de eliminar el duplicado, asegurando `admite_toricos = True` cuando la familia agrupe variantes tóricas.
  2. Unificar la lista de códigos de modelo canónicos (`SA60AT`, `SN60WF`, `CNA0T0`, `CNW0T`, `TFNT00`, `TFNT`, `DFT015`, `DFT`, `MA60AC`, `MA60MA`) y aplicar el emparejamiento por código canónico tanto en `sincronizar_lentes_masivos` (`db.py`) como en `sincronizar_catalogo_maestro_con_geclisa_endpoint` (`main.py`).

---

#### [M5] Hidratación de `familias_lio_ids` y `condicion_toricidad` en Funciones de Lectura del Nomenclador (`listar_catalogo_completo_crm` y `get_practica_resumen_operativo`)
* **Source Findings:** Stage 7 `#4`, Stage 8 `#4.3`, Stage 9 `#1`
* **Affected Document Scope:** `Detailed Implementation Plan #2, #4` (líneas 319, 344-350)
* **Technical Issue:**
  `NomencladorSettingsCard.tsx` carga las prácticas configuradas mediante `GET /api/nomenclador/practicas-configuradas` (que llama a `listar_catalogo_completo_crm()` en [db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L2468-L2504)) y `GET /api/nomenclador/resumen-operativo/{codigo}` (`get_practica_resumen_operativo()` en [db.py](file:///D:/Github/crm_agentico_nube/backend/app/db.py#L2506-L2659)). Si esas dos funciones de lectura no proyectan `familias_lio_ids` y `condicion_toricidad`, al abrir el modal de edición en `NomencladorSettingsCard.tsx` (`handleOpenConfigureGeclisa` y `handleOpenEditCrm`), los valores guardados no se rehidratarán en el formulario.
* **Actionable Fix:**
  Incluir explícitamente `listar_catalogo_completo_crm()`, `get_practica_resumen_operativo()` y `crear_lio_comercial_rapido()` en `Detailed Implementation Plan #2 (backend/app/db.py)` y la interfaz `CrmPracticaConfigurada` (`handleOpenConfigureGeclisa` / `handleOpenEditCrm`) en `Detailed Implementation Plan #4 (NomencladorSettingsCard.tsx)`.

---

### 🟢 Nits (4 Consolidated Action Items)

#### [N1] Nombres Exactos de Rutas y Funciones en `main.py` y `FichaTurnoModal.tsx`
* **Source Findings:** Stage 5 `#5`, Stage 8 `#4.1 & #4.2`, Stage 9 `#4.1`
* **Affected Document Scope:** `Lines 232, 340, 374`
* **Actionable Fix:**
  * En línea 232, actualizar `POST /api/quirofano/turnos` y `PUT /api/quirofano/turnos/{id}` por los paths reales `POST /api/turnos-quirofano` y `PUT /api/turnos-quirofano/{turno_id}`.
  * En línea 340, usar el identificador exacto `guardar_calculo_lio_endpoint` (y `confirmar_calculo_lio_endpoint`).
  * En línea 374, actualizar la referencia de líneas del segundo fallback hardcodeado en `FichaTurnoModal.tsx` de `501-502` a `363-364` (`aplicarCasoConfirmado`).

#### [N2] Registro de `override_quirofano` en Auditoría de Pausa de Seguridad OMS (`confirmar-pausa-oms`)
* **Source Findings:** Stage 9 `#4.2`
* **Affected Document Scope:** `Line 298` y `Detailed Implementation Plan #3` (líneas 329-343)
* **Actionable Fix:**
  Añadir una viñeta en `Detailed Implementation Plan #3 (backend/app/main.py)` indicando que `confirmar_pausa_seguridad_oms` (`main.py:7814`) incluye el estado de `override_quirofano` en `pausa_oms_audit` cuando está activo, alineando el plan con el requisito no funcional de la línea 298.

#### [N3] Terminología de Etiqueta UI (`"Definitivo"`) vs. Valor Persistido (`'confirmado'`) en CUJ 1
* **Source Findings:** Stage 7 `#6`, Stage 8 `#5`
* **Affected Document Scope:** `Line 66` (`CUJ 1`)
* **Actionable Fix:**
  Expresar en la línea 66 `"en estado 'Definitivo' (estado: 'confirmado')"` para mantener correspondencia directa entre el botón de la interfaz y el valor JSON.

#### [N4] Idioma de Sub-encabezados de Plantilla en Detailed Implementation Plan
* **Source Findings:** Stage 9 `#5`
* **Affected Document Scope:** `Lines 303-396`
* **Actionable Fix:**
  Opcional: mantener los sub-encabezados estándar de la plantilla (`Type / Scope`, `Proposed Changes`, `Verification Plan`) tal como exige el esquema de `references/design_doc.md`.

---

## 3. Cross-Stage Traceability Matrix

| Raw Stage Finding | Reviewer Lens(es) | Severity | Consolidated Action Item |
| :--- | :--- | :---: | :--- |
| Stage 5 Finding #1 (Quick-Recontacto & Budget Approval Fallback) | `egm-zoom-out` | Major | **[M2]** |
| Stage 5 Finding #2 (`override_quirofano` Sanitizer & Read Plumbing) | `egm-zoom-out` | Major | **[M1]** |
| Stage 5 Finding #3 (`catalogo_maestro_gtin`, Sync Endpoints & `admite_toricos`) | `egm-zoom-out` | Major | **[M4]** |
| Stage 5 Finding #4 + Catalysts A, B, C (Concurrent Checklist & Tri-Vector Discrepancy) | `egm-zoom-out`, `egm-inventive-catalyst` | Major | **[M3]** |
| Stage 5 Finding #5 (`POST /api/turnos-quirofano` Route Name) | `egm-zoom-out` | Nit | **[N1]** |
| Stage 6 Finding #1 (`turnos_quirofano` vs `checklist_prequirurgico` Storage) | `egm-comprehension` | Nit | **[M1]** |
| Stage 6 Finding #2 (Canonical Model Code List Consistency) | `egm-comprehension` | Nit | **[M4]** |
| Stage 7 Finding #1 (`catalogo_maestro_gtin` FK & `sincronizar_lentes_masivos`) | `egm-design` | Major | **[M4]** |
| Stage 7 Finding #2 (`COLUMN_KEYS_TURNOS_QUIROFANO` Sanitization) | `egm-design` | Major | **[M1]** |
| Stage 7 Finding #3 (`turnos_quirofano` Loop in `GET /api/calculo-lio/pacientes`) | `egm-design` | Major | **[M2]** |
| Stage 7 Finding #4 (`NomencladorSettingsCard` Rehydration) | `egm-design` | Nit | **[M5]** |
| Stage 7 Finding #5 (4 Problem Paths to 4 Validation Points Mapping) | `egm-structural` | Nit | **[M2]** |
| Stage 7 Finding #6 (`"Definitivo"` vs `'confirmado'` Label) | `egm-style` | Nit | **[N3]** |
| Stage 8 Finding #1 (Single-Source-of-Truth Persistence & Read Plumbing) | `egm-zoom-out` | Major | **[M1]** |
| Stage 8 Finding #2 (Confirmation Gate, Pending Queue & Discrepancy Convergence) | `egm-zoom-out` | Major | **[M2]**, **[M3]** |
| Stage 8 Finding #3 (Complete Canonical Family Deduplication) | `egm-zoom-out` | Major | **[M4]** |
| Stage 8 Finding #4 (Route Paths, Line Numbers & Nomenclador Rehydration) | `egm-zoom-out` | Nit | **[M5]**, **[N1]** |
| Stage 8 Finding #5 (CUJ 1 Label Terminology) | `egm-zoom-out` | Nit | **[N3]** |
| Stage 9 Finding #1 (`listar_catalogo_completo_crm` & `get_practica_resumen_operativo`) | `egm-codebase-details`, `egm-implementation-readiness` | Major | **[M5]** |
| Stage 9 Finding #2 (`COLUMN_KEYS_TURNOS_QUIROFANO` & `get_asesorias_confirmadas_pendientes`) | `egm-codebase-details`, `egm-implementation-readiness` | Major | **[M1]** |
| Stage 9 Finding #3 (`sincronizar_lentes_masivos` & `sincronizar_turno_quirofano_desde_asesoria`) | `egm-codebase-details`, `egm-implementation-readiness` | Major | **[M2]**, **[M4]** |
| Stage 9 Finding #4 (`guardar_calculo_lio_endpoint` & `confirmar-pausa-oms`) | `egm-codebase-details` | Nit | **[N1]**, **[N2]** |
| Stage 9 Finding #5 (Template Header Language Mix) | `egm-style` | Nit | **[N4]** |
