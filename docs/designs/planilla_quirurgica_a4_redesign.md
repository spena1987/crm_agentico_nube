# Rediseño de Planilla Quirúrgica A4 Landscape

*   **Author:** malko
*   **Status:** Approved
*   **Date:** 2026-11-21

--------------------------------------------------------------------------------

## Overview

Este documento especifica el rediseño estructural, de datos y tipográfico de la Planilla de Control Quirúrgico y LIO en formato A4 Landscape (`backend/app/services/pdf_service.py`, `backend/app/db.py` y `frontend/src/components/quirofano/modal/ModalPlanillaQuirurgicaA4.tsx`). El objetivo es mejorar la legibilidad en quirófano reduciendo la tabla de 14 a 12 columnas, mostrando el número real de Historia Clínica (`nro_hc`), exponiendo el tipo de anestesia planificado (`tipo_anestesia`), detallando la práctica quirúrgica en las cirugías sin lente (`Sin LIO`) mediante unificación de celdas, y ampliando la tipografía y el alto de fila (~10 filas por hoja).

## The Problem

La planilla actual en producción presenta cinco deficiencias operativas:

1. **Identificador erróneo en la columna `HC`**: `get_turnos_quirofano()` (`backend/app/db.py`) no selecciona `nro_hc` dentro de `_PACIENTES_RESUMEN_COLS`, y `pdf_service.py` busca `historia_clinica` antes de caer en `paciente_id[:6]`. Como resultado, la planilla imprime prefijos hexadecimales de UUID (`292e8d`, `2f9673`) en lugar del número de historia clínica real del expediente.
2. **Columnas innecesarias que comprimen el ancho útil**: `H. PAC.` (`38 pt`) y `OBRA SOCIAL` (`53.8 pt`) consumen `91.8 pt` de los `793.8 pt` imprimibles sin aportar valor operativo en la planilla de quirófano, comprimiendo `LENTE`, `DIOPTRIA` y `OBSERVACIONES / LIO`.
3. **Dato incorrecto en `ANESTESIA`**: `pdf_service.py` prioriza `anestesiologo_nombre` sobre `tipo_anestesia` y asume `"Tópica"` cuando falta el dato, mostrando nombres de profesionales en lugar del tipo de anestesia planificado en el turno.
4. **Falta de detalle en cirugías `Sin LIO`**: las filas sin lente muestran únicamente `"Sin LIO"` mientras dejan `DIOPTRIA` (y a menudo `OBSERVACIONES / LIO`) con `"-"`, omitiendo qué práctica quirúrgica se realiza. Además, `lente_incision_grados` y `es_torico` no están filtrados por `lleva_lio`, permitiendo que datos residuales aparezcan en `OBSERVACIONES`.
5. **Densidad excesiva (~20 filas por hoja)**: el tamaño de letra (`6.8–7.5 pt`, y `6 pt` inline en DNI/tórico) y el padding vertical (`2.5 pt`) dificultan la lectura rápida de pie en quirófano.

## Goals

*   **Tabla de 12 columnas**: eliminar `H. PAC.` y `OBRA SOCIAL`, redistribuyendo los `91.8 pt` liberados principalmente entre `LENTE / PRÁCTICA`, `DIOPTRIA` y `OBSERVACIONES / LIO` (ajustando también `HC`, `OJO`, `N°` y `ANESTESIA` para soportar letra más grande).
*   **Número de HC real**: incluir `nro_hc` en `_PACIENTES_RESUMEN_COLS` y mostrarlo en `HC` (con fallbacks `historia_clinica` / `paciente_historia_clinica` y `"-"` final si falta, sin `geclisa_id` ni `paciente_id[:6]`).
*   **Tipo de anestesia planificado**: leer exclusivamente `tipo_anestesia` en `ANESTESIA`, mostrando `"-"` si no está definido y permitiendo ajuste de línea sin corte arbitrario.
*   **Práctica visible en filas `Sin LIO`**: renombrar `LENTE` a `LENTE / PRÁCTICA`; cuando no lleva LIO (`lleva_lente is False` o ausencia de datos reales de lente), mostrar `practica_nombre` unificando `LENTE / PRÁCTICA + DIOPTRIA` mediante `SPAN` (y extendiendo el `SPAN` a `OBSERVACIONES / LIO` cuando no hay observación clínica, filtrando datos LIO por `lleva_lio`). Las filas con LIO no aplican `SPAN`.
*   **~10 filas por hoja con lectura ampliada**: usar una tabla única continua (`repeatRows=1`) calibrada con fuentes `8–9.5 pt` (incluyendo `size=7.5` en los tags inline de DNI y tórico) y padding vertical amplio (`10.5 pt`) para rendir ~10–11 filas estándar por página (~`42.5–45 pt` por fila) sin generar páginas huérfanas.
*   **Consistencia en el modal frontend**: actualizar `ModalPlanillaQuirurgicaA4.tsx` para reflejar las 12 columnas optimizadas, reemplazar el ítem de `H. PAC.` por `ANESTESIA` y mantener la grilla 2x2 de referencias.

## Non-Goals

*   Cambios en el esquema de base de datos o migraciones en Supabase (`pacientes.nro_hc` ya existe).
*   Modificaciones en los carteles de pecho A4 (`ModalCartelesPechoA4.tsx`) ni en pulseras (`ModalImprimirPulsera`).
*   Cortes forzados con `PageBreak()` cada 10 filas exactas (descartado para evitar páginas huérfanas de 1 fila cuando una observación larga envuelve a 3–4 líneas).

## Critical User Journeys (CUJs)

### CUJ 1: Emisión de planilla con HC real, anestesia planificada, 12 columnas y UI actualizada

*   **Given**: Turnos quirúrgicos en agenda donde algunos pacientes tienen `nro_hc` (ej. `421256`) y otros no, con `tipo_anestesia` cargado (ej. `Local Asistida + Sedación`) o vacío, y `anestesiologo_nombre` asignado.
*   **When**: El usuario abre `ModalPlanillaQuirurgicaA4.tsx` y emite la Planilla Quirúrgica A4.
*   **Then**: El modal muestra `"12 columnas..."` sin referencia a `H. PAC.` y con el ítem `ANESTESIA`; el PDF generado tiene 12 columnas (sin `H. PAC.` ni `OBRA SOCIAL`), muestra `421256` (o `"-"` si falta) en `HC`, muestra `Local Asistida + Sedación` completo en `ANESTESIA` (o `"-"` si falta), y mantiene el badge de `OJO` alineado en la columna `5`.

### CUJ 2: Visualización de práctica quirúrgica en filas `Sin LIO` y paginación ampliada

*   **Given**: Una lista de 23 turnos con filas `con LIO` (ej. catarata, incluyendo `0 D` / `0°`), una fila `Sin LIO` con observación clínica (`eylia`) y datos LIO residuales (`lente_incision_grados` / `es_torico` con `lleva_lente=False`), y otra fila `Sin LIO` sin observación.
*   **When**: Se genera el PDF de la planilla diaria.
*   **Then**: Las filas `con LIO` muestran modelo, dioptría y observaciones en columnas separadas sin `SPAN`. En `Sin LIO`, los datos LIO residuales quedan suprimidos: la fila con `eylia` unifica `LENTE / PRÁCTICA + DIOPTRIA` (2 columnas) conservando `eylia` en `OBSERVACIONES / LIO`, y la fila sin observación unifica las 3 columnas (`301 pt`). La tabla continua (`repeatRows=1`) rinde ~10 filas estándar por hoja con DNI y tórico legibles (`7.5 pt`) y sin páginas huérfanas.

## Technical Plan (Architecture)

El flujo de datos nace en `backend/app/db.py` (`get_turnos_quirofano`), pasa por el endpoint `/api/quirofanos/planilla-diaria-pdf` en `backend/app/main.py` y se renderiza en `backend/app/services/pdf_service.py` (`generar_pdf_planilla_quirofano_diaria`), mientras que `frontend/src/components/quirofano/modal/ModalPlanillaQuirurgicaA4.tsx` refleja la descripción actualizada de columnas.

```text
Supabase (turnos_quirofano + pacientes._PACIENTES_RESUMEN_COLS + nro_hc)
  │
  ▼
get_turnos_quirofano() [backend/app/db.py]
  │
  ▼
generar_pdf_planilla_quirofano_diaria() [backend/app/services/pdf_service.py]
  ├── COLUMNS (12 columnas derivadas, suma 793.8 pt, sin H. PAC. ni OBRA SOCIAL)
  ├── HC: nro_hc -> historia_clinica -> "-" (sin geclisa_id ni UUID[:6])
  ├── ANESTESIA: tipo_anestesia (wrap natural) -> "-"
  ├── LENTE / PRÁCTICA:
  │     ├── lleva_lio == True  -> modelo | dioptría | obs LIO (sin SPAN)
  │     └── lleva_lio == False -> practica_nombre (o "Sin LIO")
  │           ├── obs_med vacío -> SPAN (col 6..8, 301 pt)
  │           └── obs_med dato  -> SPAN (col 6..7, 166 pt) + obs_med en col 8
  └── Tabla única (repeatRows=1) calibrada (8-9.5 pt, inline 7.5 pt, padding 10.5 pt -> ~10 filas/hoja)
```

### 1. Consulta de Historia Clínica (`backend/app/db.py`)

*   Agregar `nro_hc` a `_PACIENTES_RESUMEN_COLS` para que `get_turnos_quirofano()` proyecte el número de historia clínica del expediente en cada turno retornado.

### 2. Estructura de 12 Columnas Derivadas (`backend/app/services/pdf_service.py`)

Se define una lista local `COLUMNS` de tuplas `(header, width, align)` dentro de `generar_pdf_planilla_quirofano_diaria` para derivar `col_widths`, `headers` y los comandos `ALIGN` sin índices mágicos desfasados:

| Índice | Columna | Ancho (pt) | Alineación |
| :--- | :--- | :---: | :--- |
| 0 | `Fecha` | 44.0 | CENTER |
| 1 | `H. CIR.` | 40.0 | CENTER |
| 2 | `HC` | 52.0 | CENTER |
| 3 | `PACIENTE / DNI` | 115.0 | LEFT |
| 4 | `N°` | 22.0 | CENTER (pad horiz `1.5 pt`) |
| 5 | `OJO` | 28.0 | CENTER (Badge color en col `5`, pad horiz `1.5 pt`) |
| 6 | `LENTE / PRÁCTICA` | 102.0 | LEFT |
| 7 | `DIOPTRIA` | 64.0 | CENTER |
| 8 | `OBSERVACIONES / LIO` | 135.0 | LEFT |
| 9 | `Cirujano` | 72.0 | LEFT |
| 10 | `DERIVADOR` | 60.0 | LEFT |
| 11 | `ANESTESIA` | 59.8 | LEFT |

### 3. Mapeo de Datos, `SPAN` en `Sin LIO` y Calibración Tipográfica

1. **HC y Anestesia**:
   * `hc_val`: priorizar `nro_hc` del expediente (con coerción segura a string limpio), luego `historia_clinica` / `paciente_historia_clinica` y `"-"` si falta, descartando `geclisa_id` (ID externo distinto de HC) y `paciente_id[:6]`.
   * `anestesia_str`: leer `tipo_anestesia` (sin `anestesiologo_nombre` ni `"Tópica"`), dejando que `Paragraph` ajuste líneas dentro de `59.8 pt` sin corte arbitrario, o `"-"` si está vacío.
2. **Evaluación de `lleva_lio`, `Sin LIO` y `SPAN`**:
   * Respetar `lleva_lente is False` como anulación explícita; ignorar el string `"Sin LIO"` en `lente_tipo` y usar comprobación `not in (None, "")` para preservar `0 D` y `0°`.
   * Solo cuando `lleva_lio` es verdadero se incluyen `inc_val` (`lente_incision_grados`), `tor_eje` (`lente_torico_eje` cuando `es_tor` es verdadero) y `[PENDIENTE DE CÁLCULO]`.
   * En filas `Sin LIO`, `practica_nombre` (con fallback a `asesorias_quirurgicas.practica_nombre` y `"Sin LIO"`) se escapa contra XML y se envuelve en `Paragraph(..., style_cell_left)`. Si `obs_med` (`observaciones_quirofano` / `observaciones` / `observaciones_medicas`, acotado a `100` chars) está vacío, se aplica `SPAN` `(6..8)` con `""` en las celdas cubiertas; si tiene texto, `SPAN` `(6..7)` con `""` en col `7` y `Paragraph` escapado en col `8`.
3. **Calibración a ~10 filas/hoja**:
   * En `~490 pt` netos debajo del encabezado de tabla en Página 1 (~`523 pt` en Página 2+), elevar `TOPPADDING`/`BOTTOMPADDING` a `10.5 pt` (`21 pt` verticales) con fuentes `8–9.5 pt` (y `size=7.5` en los tags inline de `DNI` y `T{val}`) lleva una fila estándar de 2 líneas a `~42.5–45 pt` (~10–11 filas estándar/hoja, ~9–12 según wrapping). Con `turnos == []`, se renderiza la tabla con la fila de encabezados.

### 4. Actualización del Modal Frontend (`ModalPlanillaQuirurgicaA4.tsx`)

*   Actualizar la descripción superior (L104) a `"12 columnas optimizadas para lectura rápida en quirófano..."` y reemplazar el ítem de `H. PAC.` (L231) por `ANESTESIA: Tipo de anestesia planificado en el turno.` manteniendo la grilla 2x2.

## Alternatives Considered

### Alternative A: Bloques rígidos de 10 filas con `PageBreak()` y `rowHeights` fijo

*   **Pros**: Garantiza exactamente 10 filas por página en casos estándar.
*   **Cons**: En ReportLab, `Table(rowHeights=...)` impone altura fija (no mínima), recortando texto que envuelve a 3–4 líneas; si se deja altura flexible con `PageBreak()` cada 10 filas, una fila larga desborda los `~490 pt` útiles y genera páginas huérfanas de 1 fila justo antes del salto.
*   **Reason for Rejection**: Rechazado por el autor; se eligió tabla única continua (`repeatRows=1`) calibrada mediante padding (`10.5 pt`) y tipografía (`8–9.5 pt`) para rendir ~10 filas estándar por hoja con elasticidad natural.

### Alternative B: Mantener el título `LENTE` sin renombrar y usar `"Tópica"` como fallback de anestesia

*   **Pros**: Cero cambios en etiquetas de cabecera o lógica de fallback.
*   **Cons**: Mostrar el nombre de la práctica quirúrgica bajo el título `LENTE` confunde al lector en filas `Sin LIO`, y asumir `"Tópica"` cuando `tipo_anestesia` es nulo introduce riesgo clínico si el dato simplemente no fue cargado.
*   **Reason for Rejection**: Rechazado por el autor; se renombra a `LENTE / PRÁCTICA` y se usa `"-"` como fallback neutro tanto para `nro_hc` como para `tipo_anestesia`.

## Non-Functional Requirements

*   **Privacidad e integridad de datos**: Prohibido mostrar fragmentos de UUID (`paciente_id[:6]`) como identificador clínico en `HC`; si no hay `nro_hc`, se imprime `"-"`.
*   **Integridad de suma de anchos**: La suma de `col_widths` de las 12 columnas debe ser exactamente `793.8 pt`.

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `backend/app/db.py` (Modify)

*   **Type / Scope**: Supabase Query Projection (`_PACIENTES_RESUMEN_COLS`)
*   **Proposed Changes**:
    *   Agregar `nro_hc` a la constante `_PACIENTES_RESUMEN_COLS` usada por `get_turnos_quirofano()`.

#### 2. `backend/app/services/pdf_service.py` (Modify)

*   **Type / Scope**: ReportLab PDF Generator (`generar_pdf_planilla_quirofano_diaria`)
*   **Proposed Changes**:
    *   Importar/usar `escape` de `xml.sax.saxutils` para texto libre en `Paragraph`.
    *   Actualizar el docstring de la función a 12 columnas (`793.8 pt`).
    *   Ampliar los `ParagraphStyle` de la tabla: `style_th` (`fontSize=8, leading=9.5`), `style_cell_center` y `style_cell_left` (`fontSize=8.5, leading=10.5`), `style_cell_center_bold` y `style_cell_left_bold` (`fontSize=9, leading=11`), y `style_eye_od`/`oi`/`gen` (`fontSize=9.5, leading=11`).
    *   Definir `COLUMNS` con las 12 tuplas `(header, width, align)` (`[44, 40, 52, 115, 22, 28, 102, 64, 135, 72, 60, 59.8]`, suma `793.8 pt`) y derivar `col_widths`, `headers` y `ALIGN` por columna, fijando `TOPPADDING`/`BOTTOMPADDING = 10.5`, `LEFTPADDING`/`RIGHTPADDING = 2.5` general y `1.5` en cols `4` (`N°`) y `5` (`OJO`).
    *   En el bucle de filas:
        *   Eliminar `h_pac`.
        *   `hc_val`: `raw_hc = paciente_info.get("nro_hc") or paciente_info.get("historia_clinica") or t.get("paciente_historia_clinica")`; `hc_val = str(raw_hc).strip() if raw_hc not in (None, "") else "-"` (si queda vacío, `"-"`).
        *   `p_celda` y `diop_str`: actualizar inline `<font ... size=6>` a `size=7.5`; preservar `0 D` (`t.get("lente_dioptria") not in (None, "")`).
        *   `OJO`: aplicar `('BACKGROUND', (5, row_idx), (5, row_idx), ...)`.
        *   `lleva_lio`: `False` si `t.get("lleva_lente") is False`; si no, `bool(t.get("lleva_lente") or (str(t.get("lente_tipo") or "").strip().lower() not in ("", "sin lio")) or (t.get("lente_dioptria") not in (None, "")) or str(t.get("lente_modelo") or "").strip())`.
        *   Cuando `lleva_lio` es verdadero: renderizar `lente_mod`, `diop_str` y `obs_final_str` (preservando `inc_val not in (None, "")` y `tor_eje is not None`, escapando `obs_med[:100]`).
        *   Cuando `not lleva_lio` (`Sin LIO`): `practica_txt = str(t.get("practica_nombre") or (t.get("asesorias_quirurgicas") or {}).get("practica_nombre") or "").strip() or "Sin LIO"`. Colocar `Paragraph(escape(practica_txt), style_cell_left)` en col `6`. Si `obs_med` está vacío, `('SPAN', (6, row_idx), (8, row_idx))` y `""` en cols `7` y `8`; si `obs_med` tiene texto, `('SPAN', (6, row_idx), (7, row_idx))`, `""` en col `7` y `Paragraph(escape(obs_med[:100]), style_cell_left)` en col `8`.
        *   `cirujano_str` / `derivador_str`: ajustar truncado a `20` / `16` chars (o dejar que `Paragraph` ajuste dentro de `72 pt` / `60 pt` con `[:24]`) y escapar XML; `anestesia_str`: `str(t.get("tipo_anestesia") or "").strip() or "-"` sin truncado fijo, escapando XML.

#### 3. `frontend/src/components/quirofano/modal/ModalPlanillaQuirurgicaA4.tsx` (Modify)

*   **Type / Scope**: React Print Modal Copy
*   **Proposed Changes**:
    *   En L104, cambiar `"14 columnas de alta densidad visual con tipografía optimizada"` por `"12 columnas optimizadas para lectura rápida en quirófano"`.
    *   En L231, reemplazar `<li><b>H. PAC.:</b> Hora de citación prequirúrgica (T-50m).</li>` por `<li><b>ANESTESIA:</b> Tipo de anestesia planificado en el turno.</li>`.

#### 4. `backend/tests/test_planilla_quirofano_pdf.py` (Create)

*   **Type / Scope**: Python Unit Tests (`unittest` + `unittest.mock.patch`)
*   **Proposed Changes**:
    *   Verificar `"nro_hc" in _PACIENTES_RESUMEN_COLS` en `app.db`.
    *   Espiar `app.services.pdf_service.Table` y `TableStyle` (pasando `config_override={"nombre_institucion": "Centrovisión Test"}` y `turnos_historial_pacientes={}`) para validar: `len(headers) == 12`, `round(sum(col_widths), 1) == 793.8`, ausencia de `H. PAC.` y `OBRA SOCIAL`, `OJO` en col `5`, presencia de `nro_hc` y `"-"` sin UUID, uso de `tipo_anestesia` (sin `anestesiologo_nombre` ni `"Tópica"`), y `SPAN` `(6, r)..(8, r)` / `(6, r)..(7, r)` en filas `Sin LIO` (incluso con `lente_incision_grados` residual y `lleva_lente=False`).
    *   Generar PDF real de 23 turnos y verificar que retorna bytes `%PDF-` válidos y `sha256` de 64 hex chars (y conteo de páginas mediante `pypdf` si está disponible en el entorno).

### Verification Plan

*   **Unit Tests (Backend)**: `cd backend && python -m unittest tests/test_planilla_quirofano_pdf.py` (100% pass).
*   **Type Checking & Build (Frontend)**: `cd frontend && npx tsc --noEmit && npm run build` (exit code 0).
*   **Visual / PDF Check**: Generar un PDF de prueba con datos representativos (23 turnos mezclando `con LIO`, `Sin LIO` con `eylia` y `Sin LIO` sin observación, pacientes con y sin `nro_hc`).

--------------------------------------------------------------------------------

*Drafted with EGM*
