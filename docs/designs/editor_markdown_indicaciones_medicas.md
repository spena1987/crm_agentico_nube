# Editor Markdown y Variables Dinámicas en Indicaciones Médicas

*   **Author:** malko
*   **Status:** Proposed
*   **Date:** 2026-11-21

--------------------------------------------------------------------------------

## Overview

Este documento define el diseño técnico para incorporar formato **Markdown** con vista previa en vivo y **variables dinámicas** (`{paciente}`, `{dni}`, `{cirujano}`, `{practica}`, `{ojo_intervenido}`, `{fecha}`) en los tres campos de texto clínico de las indicaciones médicas (`cuerpo_indicaciones`, `cuidados_generales` y `pautas_alarma`), tanto en el configurador de **Plantillas de Indicaciones** (`NomencladorSettingsCard.tsx`) como en los modales de emisión de **Quirófano en Vivo** y **Asesoramiento Quirúrgico** (`EditorIndicacionesClinicas.tsx`). En el backend, se centraliza el renderizado seguro a ReportLab y la limpieza a texto plano hacia Geclisa.

## The Problem

Hoy el editor de plantillas de indicaciones en el Nomenclador y el editor en vivo de los modales de emisión (`EditorIndicacionesClinicas.tsx`) utilizan `<textarea>` de texto plano sin herramientas de formato ni variables automáticas. Esto genera documentos PDF menos legibles (todo con el mismo peso visual) frente al acabado que ya tiene el editor de Consentimientos Informados (`RichConsentEditor.tsx`).

Además, reutilizar directamente `RichConsentEditor.tsx` presenta cinco problemas técnicos en el sistema actual:

1. **ReportLab no interpreta Markdown en indicaciones:** `indicaciones_pdf_service.py` imprime `cuerpo_indicaciones` literal (mostrando `#` y `**`), antepone `• ` a cada línea de `cuidados_generales` (rompiendo títulos o listas numeradas) e inserta `pautas_alarma` en un único `Paragraph` sin bloques.
2. **Colisión del separador `---`:** `RichConsentEditor.tsx` inserta `\n---\n` como línea horizontal `<hr>`, pero `indicaciones_pdf_service.py` (línea 282) e `indicaciones_service.py` (línea 1285) hacen `.split("---")` para dividir hojas múltiples cuando falta `modulos[]`.
3. **Desajuste de variables `{var}` vs `{{var}}`:** `RichConsentEditor.tsx` inserta llave simple (`{paciente}`), pero `render_texto_variables` en `indicaciones_pdf_service.py` solo resuelve llave doble (`{{paciente}}`) y `vars_dict` no expone `practica` ni `ojo_intervenido`.
4. **Bugs de borde en el parser existente (`pdf_service.py`) y en `RichConsentEditor.tsx`:** `format_inline_markdown` en `pdf_service.py` no escapa `<` ni `>` (textos como `< 5 min` rompen el XML de ReportLab) y hardcodea `colWidths=[540]` (desborda el ancho útil A4 de `indicaciones_pdf_service.py`). En frontend, `RichConsentEditor.tsx` no renderiza listas numeradas (`1. `) en preview y usa `dangerouslySetInnerHTML` sin escapar HTML.
5. **Geclisa y densidad visual:** Geclisa (`POST /api/IndicacionesMedicas`) espera texto plano sin sintaxis Markdown ni llaves sin resolver. Asimismo, mostrar tres editores `Dividido` completos al mismo tiempo saturaría los modales por exceso de scroll.

## Goals

*   **Paridad visual y funcional con Consentimientos:** Exponer barra de formato Markdown (`H1`, `H2`, `H3`, negrita, cursiva, viñetas, listas numeradas, cita y separador `---`), vista previa en vivo y chips de variables dinámicas en `cuerpo_indicaciones` (modo completo `Editor | Dividido | Vista Previa`), `cuidados_generales` y `pautas_alarma` (modo compacto con toggle `Editar / Vista Previa`).
*   **Cobertura completa de flujos:** Integrar el editor en el configurador de plantillas (`NomencladorSettingsCard.tsx`) y en los modales de Quirófano en Vivo y Asesoramiento Quirúrgico (`EditorIndicacionesClinicas.tsx`), mostrando datos reales del paciente en la vista previa en vivo.
*   **Renderizado PDF seguro y escalable:** Centralizar el motor Markdown-a-ReportLab escapando `&`, `<`, `>`, respetando `content_width` dinámico (incluyendo cajas de alerta) y escalando fuentes/espaciados en modo media hoja A4 (`is_compact` / `es_alta_densidad`).
*   **Resolución dual de variables:** Soportar `{var}` y `{{var}}` en el backend (incluyendo `{practica}` y `{ojo_intervenido}`) antes de renderizar PDF o enviar a Geclisa.
*   **Salida limpia hacia Geclisa:** Convertir el `cuerpo_indicaciones` Markdown (con variables ya resueltas) a texto plano legible antes de llamar a `POST /api/IndicacionesMedicas`.
*   **Sin colisión de `---`:** Reservar `---` exclusivamente como `<hr>` Markdown cuando `modulos[]` está presente.

## Non-Goals

*   Incorporar librerías externas pesadas de edición (`@uiw/react-md-editor`, `@mdxeditor/editor`, `@tiptap/react`) o depender de nuevas librerías Python para el parser Markdown.
*   Soportar tablas GFM, bloques de código o imágenes inline dentro del cuerpo de indicaciones en ReportLab.
*   Realizar cambios en el esquema de tablas de Supabase (el contenido Markdown se almacena como texto plano en las columnas ya existentes).

## Critical User Journeys (CUJs)

### CUJ 1: Diseño de plantilla con formato Markdown y variables en Nomenclador

*   **Given**: Un administrador abre el modal *Editar Plantilla de Indicación* en `NomencladorSettingsCard.tsx`.
*   **When**: Redacta `cuerpo_indicaciones` en el editor completo usando negritas, títulos `##`, una lista numerada y el chip `{paciente}` / `{practica}`, y ajusta `cuidados_generales` y `pautas_alarma` en sus editores compactos usando viñetas y citas `>`.
*   **Then**: La vista previa muestra el formato aplicado y variables simuladas `[Ej: ...]`; al guardar, la plantilla persiste el Markdown limpio sin alterar tablas ni campos existentes.

### CUJ 2: Emisión en vivo en Quirófano o Asesoramiento con vista previa real

*   **Given**: Un usuario abre el modal de indicaciones en Quirófano en Vivo o Asesoramiento Quirúrgico para un paciente puntual.
*   **When**: Visualiza la plantilla precargada, agrega una aclaración en negrita y una línea `---` dentro de `cuerpo_indicaciones`, y cambia a la vista previa del editor antes de generar el PDF.
*   **Then**: La vista previa del editor reemplaza `{paciente}`, `{cirujano}`, `{practica}`, `{ojo_intervenido}` y `{fecha}` con los datos reales del turno/expediente; al emitir, el PDF renderiza el formato completo con `<hr>` sin dividir la hoja en dos páginas y Geclisa recibe texto plano sin `#` ni `**`.

### CUJ 3: Compatibilidad con plantillas legacy y caracteres clínicos especiales

*   **Given**: Una plantilla importada de Geclisa en texto plano o una indicación editada que contiene `< 5 min`, `> 10 días`, `&` o variables antiguas `{{paciente}}`.
*   **When**: Se previsualiza en el editor o se genera el PDF oficial en ReportLab.
*   **Then**: Ni el preview HTML del navegador ni el parser XML de ReportLab fallan por caracteres especiales, y las variables `{{paciente}}` se resuelven igual que `{paciente}`.

## Technical Plan (Architecture)

La arquitectura generaliza el editor de consentimientos en frontend hacia un componente Markdown compartido y extrae un motor común de Markdown/variables en backend reutilizable tanto por Consentimientos como por Indicaciones Médicas y Geclisa.

### 1. Flujo de Datos y Componentes

```text
+------------------------------------------------------------------------+
| Frontend                                                               |
|                                                                        |
|  [NomencladorSettingsCard]     [ModalEnviarIndicacionesQuirofano]      |
|  (Plantilla Maestra)           [SeccionIndicacionesExpediente]         |
|          |                                     |                       |
|          |                                     v                       |
|          |                       [EditorIndicacionesClinicas]          |
|          |                       (pasa previewContext real del caso)   |
|          v                                     v                       |
|  [RichMarkdownEditor]  <--- generalizado desde RichConsentEditor       |
|  - cuerpo_indicaciones: modo completo (Editor | Dividido | VistaPrevia)|
|  - cuidados_generales & pautas_alarma: modo compacto (Editar | Preview)|
|  - Chips variables: {paciente}, {dni}, {cirujano}, {practica},         |
|    {ojo_intervenido}, {fecha}                                          |
+------------------------------------+-----------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------+
| Backend (FastAPI + markdown_utils.py)                                  |
|                                                                        |
|  [markdown_utils.py] (extraído y endurecido desde pdf_service.py)      |
|   1. render_texto_variables(texto, vars_dict) -> soporta {v} y {{v}}   |
|   2. format_inline_markdown(texto) -> escapa &, <, > antes de <b>/<i>  |
|   3. parse_markdown_to_pdf_flowables(md, styles, content_width)        |
|   4. markdown_to_plain_text(md) -> texto limpio para Geclisa           |
|                                                                        |
|  Salidas:                                                              |
|   - indicaciones_pdf_service.py -> ReportLab Flowables (sin split ---) |
|   - indicaciones_service.py -> Geclisa (solo cuerpo limpio plano)      |
+------------------------------------------------------------------------+
```

### 2. Frontend: `RichMarkdownEditor.tsx` e Integración

1. **Generalización desde `RichConsentEditor.tsx`:**
   - Crear `frontend/src/components/shared/RichMarkdownEditor.tsx` (manteniendo `RichConsentEditor.tsx` como wrapper retrocompatible que reexporta/envuelve con sus defaults actuales).
   - **Props clave:** `value`, `onChange`, `placeholder`, `minHeight`, `showVariables`, `variant?: 'light' | 'dark'`, `compact?: boolean`, `disabled?: boolean`, `previewContext?: Record<string, string>`.
   - **Modos de interfaz:**
     - `compact = false` (usado en `cuerpo_indicaciones`): toolbar completa (`Bold`, `Italic`, `H1`, `H2`, `H3`, `List`, `ListOrdered`, `Quote`, `Minus`) + selector `Editor | Dividido | Vista Previa` + barra de variables.
     - `compact = true` (usado en `cuidados_generales` y `pautas_alarma`): toolbar reducida (`Bold`, `Italic`, `List`, `ListOrdered`, `Quote`) + toggle compacto `Editar / Vista Previa` (sin split permanente) + chip opcional para insertar variables sin duplicar barras altas.
   - **Correcciones en preview HTML:**
     - Escapar `&`, `<`, `>`, `"` en `formatInline` antes de aplicar `**`, `*`, `__`, `_` y antes de resaltar badges de variables (evita XSS y rotura ante `< 5 min`).
     - Agregar parseo de listas numeradas (`^\d+\.\s+`) en `renderMarkdownPreview`.
     - Si `previewContext` está presente (en Quirófano en Vivo y Asesoramiento), reemplazar las variables en la vista previa con los datos reales del paciente/cirugía en lugar de `[Ej: ...]`.
2. **Integración en Modales:**
   - `NomencladorSettingsCard.tsx`: Ampliar el ancho del modal de *Editar Plantilla de Indicación* (a `max-w-4xl`) y reemplazar los 3 `<textarea>` por `RichMarkdownEditor` (`cuerpo_indicaciones` en modo completo; `cuidados_generales` y `pautas_alarma` en modo `compact`).
   - `EditorIndicacionesClinicas.tsx`: Agregar prop opcional `previewContext?: Record<string, string>` (alimentado por `ModalEnviarIndicacionesQuirofano.tsx` y `SeccionIndicacionesExpediente.tsx` con `{ paciente, dni, cirujano, practica, ojo_intervenido, fecha }`) y reemplazar los 3 `<textarea>` por `RichMarkdownEditor`.

### 3. Backend: `markdown_utils.py`, ReportLab y Geclisa

1. **Módulo compartido `backend/app/services/markdown_utils.py`:**
   - `render_texto_variables(texto, variables)`: Soporta tanto `{key}` como `{{key}}` mediante regex controlada `\{\{?\s*key\s*\}\}?(?!\})`, agregando `practica` y `ojo_intervenido` a `vars_dict` en `indicaciones_pdf_service.py` e `indicaciones_service.py`.
   - `format_inline_markdown(text)`: Escapa `& -> &amp;`, `< -> &lt;`, `> -> &gt;` **después** de resolver variables y **antes** de transformar `**texto**`/`__texto__` en `<b>texto</b>` y `*texto*`/`_texto_` en `<i>texto</i>`.
   - `parse_markdown_to_pdf_flowables(markdown_text, custom_styles, content_width=527.0)`: Evoluciona el helper de `pdf_service.py` reemplazando el ancho fijo `540` por `content_width` dinámico para líneas `---` y cajas `> Cita`. `pdf_service.py` pasa a importar estas funciones desde `markdown_utils.py` para eliminar duplicación.
   - `markdown_to_plain_text(markdown_text)`: Elimina sintaxis de bloques (`#`, `##`, `###`, `> `) e inline (`**`, `__`, `*`, `_`), normaliza `---` a una línea separadora limpia (o salto doble) y conserva viñetas `• ` / listas numeradas legibles para sistemas de texto plano como Geclisa.
2. **Renderizado en `indicaciones_pdf_service.py`:**
   - Eliminar `split("---")` cuando `modulos_raw` venga como lista; solo en ausencia total de `modulos` se mantiene renderizado directo de un único documento (evitando partir una indicación cuando el usuario inserta `<hr>` con `---`).
   - Crear estilos `h1`, `h2`, `h3`, `cuerpo`, `bullet`, `quote` escalados según `is_compact` / `es_alta_densidad` para que siga cabiendo en media hoja A4 horizontal cuando corresponde.
   - Renderizar `cuerpo_txt`, `cuid_txt` y `alar_txt` mediante `parse_markdown_to_pdf_flowables` (usando `content_width` en cuerpo/cuidados y `content_width - 14` dentro de `alerta_table` para `pautas_alarma`), quitando el prefijo forzado `f"• {linea}"` en `cuidados_generales`.
3. **Limpieza hacia Geclisa en `indicaciones_service.py`:**
   - En `emitir_indicaciones_expediente` (bucle hacia `geclisa_client.emitir_indicacion_medica_geclisa`), construir `vars_dict` del caso, aplicar `render_texto_variables` seguido de `markdown_to_plain_text` sobre `cuerpo_indicaciones` de cada módulo antes de enviarlo a Geclisa.
   - En `resolver_plantilla_sugerida`, evitar depender de `"\n\n---\n\n"` para reconstruir módulos cuando `modulos_asignados` ya existe como arreglo estructurado.

## Alternatives Considered

### Alternative A: Incorporar librerías externas de Markdown en frontend (`@uiw/react-md-editor` o `@mdxeditor/editor`)

*   **Pros**: Incluyen barra de herramientas y preview Markdown prearmados sin mantener un parser HTML propio.
*   **Cons**: Añaden peso al bundle de Next.js, introducen hojas de estilo difíciles de alinear con los temas `slate-900` (Quirófano/Nomenclador) y variables CSS (Asesoramiento), y requieren personalización adicional para chips de variables clínicas (`{paciente}`) y modo compacto para 3 campos por modal.
*   **Reason for Rejection**: Generalizar `RichConsentEditor.tsx` reutiliza un componente ya validado por los usuarios del CRM con cero dependencias nuevas y paridad visual con Consentimientos.

### Alternative B: Editor WYSIWYG basado en `Tiptap` (`@tiptap/react`)

*   **Pros**: Experiencia de edición visual sin sintaxis Markdown visible para el usuario.
*   **Cons**: Introduce múltiples dependencias nuevas y obliga a mantener serialización bidireccional (ProseMirror JSON/HTML <-> Markdown plano) para que las plantillas legadas en texto plano, el cálculo de diff en auditoría y la limpieza hacia Geclisa sigan operando sobre texto.
*   **Reason for Rejection**: Mayor complejidad y superficie de fallos frente al modelo Markdown directo que ya usan Consentimientos Informados.

### Alternative C: Usar `python-markdown` (HTML) + conversor HTML-a-ReportLab o `mistune` en backend

*   **Pros**: Parsing CommonMark completo mediante librería estándar de Python.
*   **Cons**: ReportLab `Paragraph` no acepta etiquetas HTML de bloque (`<h1>`, `<ul>`, `<blockquote>`, `<hr>`), por lo que igualmente requiere escribir un traductor de árbol HTML/AST hacia Flowables (`Paragraph`, `Table`, `Spacer`) y además duplicaría la lógica que ya existe en `pdf_service.py` para Consentimientos.
*   **Reason for Rejection**: Extraer y endurecer el motor ya operativo de `pdf_service.py` en `markdown_utils.py` resuelve Consentimientos e Indicaciones con un único código y sin dependencias nuevas.

### Alternative D: Mantener el separador `---` para dividir páginas y usar otro símbolo para `<hr>`

*   **Pros**: Evita tocar la lógica legacy de `split("---")` en `indicaciones_pdf_service.py`.
*   **Cons**: Rompe el estándar Markdown (el botón `<Minus />` de la barra inserta `---`) y obliga a los usuarios a recordar una regla especial distinta a la de Consentimientos Informados.
*   **Reason for Rejection**: Rejected by author: Goal #6 reserva `---` exclusivamente como `<hr>` Markdown cuando `modulos[]` está presente.

## Non-Functional Requirements

*   **Seguridad XML / XSS:** Ningún texto ingresado por el usuario o proveniente de datos del paciente (`&`, `<`, `>`) debe romper el parser XML de ReportLab ni permitir inyección HTML en la vista previa del navegador.
*   **Compatibilidad hacia atrás:** Plantillas heredadas en texto plano (incluidas las 107 importadas de Geclisa) y plantillas con `{{var}}` deben renderizarse sin cambios ni migración de datos en Supabase.
*   **Densidad de Media Hoja A4:** El escalado tipográfico de `#`, `##`, `###` y `>` en `indicaciones_pdf_service.py` debe respetar la bandera `es_alta_densidad` para evitar desbordamientos innecesarios de página.

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `backend/app/services/markdown_utils.py` (Create)

*   **Type / Scope**: Módulo utilitario compartido de Markdown, variables y texto plano (Python).
*   **Proposed Changes**:
    *   `render_texto_variables(texto: str, variables: Dict[str, Any]) -> str`: reemplaza variables tanto con llave simple `{key}` como doble `{{key}}` (insensible a mayúsculas y espacios internos) antes de cualquier escape XML.
    *   `format_inline_markdown(text: str) -> str`: escapa `& -> &amp;`, `< -> &lt;`, `> -> &gt;`, y luego transforma `**...**` / `__...__` a `<b>...</b>` y `*...*` / `_..._` a `<i>...</i>`.
    *   `parse_markdown_to_pdf_flowables(markdown_text: str, custom_styles: Dict[str, Any], content_width: float = 527.0) -> List[Any]`: evoluciona el parser existente soportando `#`, `##`, `###`, `> ` (usando `content_width`), `-`/`*`, listas numeradas `1.`, separadores `---`/`***`/`___` (usando `content_width`) y párrafos inline.
    *   `markdown_to_plain_text(markdown_text: str) -> str`: elimina marcadores de encabezado (`#`, `##`, `###`), citas (`> `), negritas/cursivas (`**`, `__`, `*`, `_`), normaliza `---` a una línea limpia (`----------------` o salto) y conserva viñetas `• ` / numeración para Geclisa.

#### 2. `backend/app/services/pdf_service.py` (Modify)

*   **Type / Scope**: Servicio de PDFs de Consentimientos Informados (Python).
*   **Proposed Changes**:
    *   Eliminar las definiciones locales de `format_inline_markdown` y `parse_markdown_to_pdf_flowables` e importarlas desde `app.services.markdown_utils`, pasando `content_width` acorde a su página A4 (corrige también el bug de `<`/`>` sin escapar en Consentimientos).

#### 3. `backend/app/services/indicaciones_pdf_service.py` (Modify)

*   **Type / Scope**: Servicio de PDFs de Indicaciones Médicas (Python).
*   **Proposed Changes**:
    *   Importar `render_texto_variables`, `format_inline_markdown` y `parse_markdown_to_pdf_flowables` desde `app.services.markdown_utils`.
    *   Ampliar `vars_dict` con `"practica": practica_nombre` y `"ojo_intervenido": ojo_intervenido` (además de `paciente`, `dni`, `cirujano`, `fecha`, `obra_social`, `ojo`).
    *   Eliminar `raw_cuerpo.split("---")` (línea 282) para que `---` nunca parta una indicación en páginas separadas, manteniendo paginación exclusivamente vía `modulos` estructurados.
    *   Definir estilos ReportLab `h1`, `h2`, `h3`, `cuerpo`, `bullet`, `quote` escalados según `is_compact` y `es_alta_densidad`.
    *   Reemplazar los loops de texto plano en `cuerpo_txt`, `cuid_txt` (quitando el prefijo forzado `• `) y `alar_txt` (dentro de `alerta_table` con `content_width - 14`) por `parse_markdown_to_pdf_flowables`.

#### 4. `backend/app/services/indicaciones_service.py` (Modify)

*   **Type / Scope**: Lógica de negocio de indicaciones y despacho a Geclisa (Python).
*   **Proposed Changes**:
    *   Importar `render_texto_variables` y `markdown_to_plain_text` desde `app.services.markdown_utils`.
    *   En `emitir_indicaciones_expediente` (bucle hacia `geclisa_client.emitir_indicacion_medica_geclisa`), armar `vars_dict` del caso (`paciente`, `dni`, `cirujano`, `practica`, `ojo_intervenido`, `ojo`, `fecha`), resolver variables y aplicar `markdown_to_plain_text(mod_texto)` antes de enviar `texto_indicacion` a Geclisa.
    *   En el fallback de `items_a_emitir` cuando no llegan `modulos`, evitar `split("---")` sobre el texto (construir un único módulo con el texto completo para no romper líneas `<hr>` Markdown).

#### 5. `frontend/src/components/shared/RichMarkdownEditor.tsx` (Create) y `frontend/src/components/settings/RichConsentEditor.tsx` (Modify)

*   **Type / Scope**: Editor Markdown compartido (React/TypeScript).
*   **Proposed Changes**:
    *   Crear `RichMarkdownEditor` a partir de `RichConsentEditor` con props: `value`, `onChange`, `placeholder`, `minHeight`, `showVariables`, `variant?: 'light' | 'dark'`, `compact?: boolean`, `disabled?: boolean`, `previewContext?: Record<string, string>`.
    *   Escapar `&`, `<`, `>`, `"` en `formatInline` antes de transformar sintaxis Markdown y renderizar listas numeradas (`^\d+\.\s+`) en `renderMarkdownPreview`.
    *   Si `previewContext` está definido, interpolar las variables con datos reales en la vista previa; de lo contrario mostrar badges de ejemplo `[Ej: ...]`.
    *   Convertir `RichConsentEditor.tsx` en un wrapper retrocompatible que delega en `RichMarkdownEditor`.

#### 6. `frontend/src/components/settings/NomencladorSettingsCard.tsx` (Modify)

*   **Type / Scope**: Configurador de Plantillas de Indicaciones (React/TypeScript).
*   **Proposed Changes**:
    *   Ajustar el ancho del modal *Editar Plantilla de Indicación* a `max-w-4xl` para alojar cómodamente la vista `Dividido`.
    *   Reemplazar los 3 `<textarea>` (`cuerpo_indicaciones`, `cuidados_generales`, `pautas_alarma`) por `RichMarkdownEditor` (`cuerpo_indicaciones` completo con `minHeight="240px"`, y los otros dos con `compact={true}`, `minHeight="110px"`).

#### 7. `frontend/src/components/quirofano/EditorIndicacionesClinicas.tsx`, `ModalEnviarIndicacionesQuirofano.tsx` y `SeccionIndicacionesExpediente.tsx` (Modify)

*   **Type / Scope**: Modales de emisión en Quirófano en Vivo y Asesoramiento (React/TypeScript).
*   **Proposed Changes**:
    *   Agregar `previewContext?: Record<string, string>` a `EditorIndicacionesClinicasProps` y reemplazar los 3 `<textarea>` (`cuerpo_indicaciones`, `cuidados_generales`, `pautas_alarma`) por `RichMarkdownEditor` propagando `variant`, `disabled`, `compact` (en cuidados/alarmas) y `previewContext`.
    *   Pasar `previewContext` real (`{ paciente, dni, cirujano, practica, ojo_intervenido, fecha }`) desde `ModalEnviarIndicacionesQuirofano.tsx` y `SeccionIndicacionesExpediente.tsx`.

#### 8. `backend/tests/test_markdown_indicaciones.py` (Create)

*   **Type / Scope**: Pruebas unitarias Backend (pytest).
*   **Proposed Changes**:
    *   Validar `render_texto_variables` con `{var}` y `{{var}}` incluyendo `{practica}` y `{ojo_intervenido}`.
    *   Validar `format_inline_markdown` y `parse_markdown_to_pdf_flowables` con caracteres `<`, `>`, `&`, `---`, listas numeradas y citas sin romper XML ni exceder `content_width`.
    *   Validar `markdown_to_plain_text` y que `emitir_indicaciones_expediente` envíe texto limpio sin `#`/`**` y con variables resueltas a Geclisa.
    *   Validar que `generar_pdf_indicacion_medica` genera bytes PDF válidos cuando `cuerpo`, `cuidados` y `alarmas` contienen Markdown y `---` interno sin dividir la hoja en 2 páginas.

### Verification Plan

*   **Compilation/Build**: Ejecutar `npm --prefix frontend run build` para validar TypeScript y el build de Next.js.
*   **Unit Tests**: Ejecutar `pytest backend/tests/test_markdown_indicaciones.py backend/tests/test_indicaciones_edicion_auditoria.py -v`.
*   **Static Analysis & Linting**: Ejecutar `python -m py_compile` sobre los archivos Python modificados y verificar lint durante `next build`.
*   **E2E/Integration Manual**:
    1. Editar una plantilla en Nomenclador usando `#`, `**`, lista numerada, `---` y `{paciente}` / `{practica}`.
    2. Abrir el modal en Quirófano en Vivo y en Asesoramiento Quirúrgico; verificar que la vista previa muestra el formato y los datos reales del paciente, que el PDF descarga/adjunta con el formato aplicado en una sola hoja por módulo (aun con `---` interno), y que Geclisa recibe texto plano limpio.

--------------------------------------------------------------------------------

*Drafted with EGM*


### Resolución de Revisión (`/egm-review`)

- **B1**: En `RichMarkdownEditor.tsx`, `formatInline` escapa primero `&`, `<`, `>`, `"` en el texto fuente y en los valores de `previewContext` antes de inyectar etiquetas `<strong>`, `<em>` y `<span>`. En `markdown_utils.py`, `format_inline_markdown` protege primero `{var}`/`{{var}}`, escapa XML y restaura los valores escapados.
- **B2**: Eliminado `split("---")` en `indicaciones_pdf_service.py` e `indicaciones_service.py` para reservar `---` exclusivamente como `<hr>` de Markdown dentro de cada módulo.
- **M1**: `indicaciones_pdf_service.py` utiliza `build_indicaciones_vars_dict` e importa `render_texto_variables` / `parse_markdown_to_pdf_flowables` desde `markdown_utils.py`, eliminando la función local que solo soportaba `{{var}}`.
- **M2**: `indicaciones_service.py` calcula `fecha_pdf`/`fecha_db` antes del envío a Geclisa y aplica `markdown_to_plain_text(..., vars_dict=vars_dict_geclisa)`.
- **M3**: `RichMarkdownEditor.tsx` añade soporte de listas numeradas (`^\d+\.\s+`) en vista previa y límites de palabra en `_..._` para no afectar identificadores como `ojo_derecho`.
- **M4**: En `compact={true}` (`cuidados_generales` y `pautas_alarma`), `viewMode` inicia en `'edit'`, se oculta `Dividido` y se reduce la barra (`H1/H2/H3/---` ocultos).
- **M5**: `ModalIndicacionesMedicasCaso.tsx` propaga `ojo={caso.ojo}` a `SeccionIndicacionesExpediente.tsx`, y los modales de edición/reedición amplían su contenedor a `max-w-4xl`.
- **M6**: `parse_markdown_to_pdf_flowables` parametriza `content_width` (usando `content_width - 10` en el recuadro de `pautas_alarma` en `indicaciones_pdf_service.py`).
