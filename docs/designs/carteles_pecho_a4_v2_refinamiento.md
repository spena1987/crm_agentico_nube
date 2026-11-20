# Refinamiento v2: Carteles de Pecho A4 (Tipografía, Grilla LIO 4 Columnas y Cirujano)

*   **Author:** malko
*   **Status:** Approved
*   **Date:** 2026-11-20

--------------------------------------------------------------------------------

## Overview

Este diseño especifica la iteración de refinamiento visual y tipográfico sobre el modal de impresión de carteles de pecho A4 (`ModalCartelesPechoA4.tsx` y `cartelesPechoHelpers.ts`), partiendo de la versión ya desplegada (`docs/designs/carteles_pecho_a4_redesign.md`). El objetivo es estandarizar el escaneo rápido en quirófano mediante cuatro ajustes concretos: práctica quirúrgica acotada a 2 líneas con escalado por longitud, grilla fija de 4 columnas para las métricas del lente intraocular (LIO) separando `T` de `Eje`, ampliación de la descripción del lente sin número de lote, y nombre del cirujano en una segunda línea dedicada junto al código QR.

## The Problem

La inspección del PDF impreso en producción (`3x2`) evidencia cuatro problemas de lectura y aprovechamiento del espacio:

1. **Prácticas de 3 a 4 líneas**: procedimientos largos como `CATARATA CON FACOEMULSIFICACION E IMPL.LIO PLEGABLE (EN CONVENIO)` ocupan 3 o 4 líneas, rompiendo la proporción vertical de la tarjeta y compitiendo con el resto de los datos.
2. **Posición variable de las métricas del LIO**: al usar `flex justify-between`, la dioptría cambia de posición horizontal según qué campos estén presentes (a la izquierda si falta incisión, a la derecha si falta tórico, al centro si están los tres), obligando al personal de quirófano a buscar el dato visualmente en cada cartel. Además, el valor tórico (`T2`) y el eje (`64°`) aparecen pegados (`T2 @ 64°`).
3. **Descripción del lente (`lente_tipo`) demasiado pequeña y presencia innecesaria de `Lote`**: el modelo de lente (`Clareon Monofocal (Alcon)`) se imprime en `10px`, muy por debajo de las métricas (`17px`), mientras que `Lote:` ocupa ancho en esa misma fila sin aportar valor en el cartel de pecho.
4. **Nombre del cirujano pequeño junto a espacio vertical libre**: debajo de la fecha/sala y el código de turno sobra espacio al lado del QR, pero el cirujano aparece en `11px` en una sola línea con prefijo `Cirujano:` y riesgo de truncado.

## Goals

*   **Práctica acotada a 2 líneas con legibilidad controlada**: ajustar el tamaño de fuente de `practica_nombre` según su longitud y truncar en la segunda línea (`-webkit-line-clamp: 2`) en ambos formatos (`3x2` y `4x2`).
*   **Posición fija de lectura en el bloque LIO**: ubicar `Incisión`, `Dioptría`, `Tórico (T)` y `Eje` siempre en las mismas 4 columnas horizontales, con fila de micro-encabezado (`INCISIÓN | DIOPTRÍA | TÓRICO | EJE`) y centinela `—` atenuado cuando un dato no aplica.
*   **Descripción del lente ampliada y sin `Lote`**: eliminar `Lote:` del cartel y ampliar `lente_tipo` (`14px` en `3x2`, `12px` en `4x2`, hasta 2 líneas) manteniendo el alto total dentro del presupuesto vertical de `4x2`.
*   **Cirujano legible en 2 líneas**: mostrar la etiqueta `CIRUJANO:` en la línea 1 y el nombre en la línea 2 (`14px` en `3x2`, `12px` en `4x2`, hasta 2 líneas) aprovechando el espacio junto al QR.
*   **Paridad total entre vista previa e impresión**: mantener todas las nuevas clases de grilla y tipografía dentro de `SHARED_STICKER_CSS` con `!important`.

## Non-Goals

*   Modificaciones en el backend, base de datos o esquema de turnos quirúrgicos.
*   Cambios en otros modales de impresión (`ModalImprimirPulsera`, `ModalPlanillaQuirurgicaA4`).
*   Medición DOM en tiempo real por JavaScript (`ResizeObserver`/`scrollHeight`) para recalcular fuentes píxel a píxel.
*   Reintroducción de campos eliminados en la iteración anterior (`CENTROVISIÓN QUIRÚRGICO`, obra social, `LENTE INTRAOCULAR (LIO)`, `CIRUGÍA SIN IMPLANTE DE LIO` o checklist inferior).

## Critical User Journeys (CUJs)

### Glosario de estados y lateralidad

*   **Lateralidad ocular**: `OD` (Ojo Derecho — tarjeta fondo negro con texto blanco), `OI` (Ojo Izquierdo — tarjeta blanca con borde sólido), `AO` (Ambos Ojos — tarjeta blanca con borde doble). `.sticker-muted` atenúa texto secundario (`#e2e8f0` en `OD`, `#1e293b` en `OI`/`AO`).
*   **Estados del bloque LIO (`evaluarBloqueLio`)**: `CARGADO` (lente asignado, muestra grilla de 4 columnas + `lente_tipo`), `NO_CALCULADA` (procedimiento requiere lente sin datos cargados, muestra alerta `LENTE NO CALCULADA`), `OCULTO` (cirugía sin implante de LIO, omite el bloque). `S/D` indica "Sin Dato" cuando `lente_tipo` existe sin dioptría.

### CUJ 1: Lectura rápida de parámetros de LIO en quirófano (toricidad y eje separados)

*   **Given**: Un turno `CARGADO` con todos los parámetros (`158°`, `18.5 D`, `T2`, `64°`, `Clareon Monofocal (Alcon)`) y otro turno `CARGADO` sin incisión ni toricidad (`10 D`, `ICL Miópico (EVO) (Staar Surgical)`).
*   **When**: El usuario abre el modal de carteles A4 e imprime en `3x2` o `4x2`.
*   **Then**: En ambos carteles, la dioptría aparece exactamente en la segunda columna debajo de `DIOPTRÍA` (`18.5 D` y `10 D` respectivamente). En el primero se muestran `158°` en `INCISIÓN`, `T2` en `TÓRICO` y `64°` en `EJE`; en el segundo esas tres columnas muestran `—` atenuado sin desplazar la dioptría. En ambos se omite `Lote` y `lente_tipo` se lee a `14px` (`3x2`) o `12px` (`4x2`).

### CUJ 2: Tarjeta `4x2` con datos largos sin recorte del bloque LIO

*   **Given**: Un turno en formato `4x2` (`74.25mm` de alto) con nombre de paciente de 2 líneas, procedimiento de >50 caracteres (`CATARATA CON FACOEMULSIFICACION E IMPL.LIO PLEGABLE (EN CONVENIO)`), cirujano de apellido compuesto y descripción de lente larga.
*   **When**: Se renderiza la vista previa y se ejecuta `Imprimir` (`iframe` A4).
*   **Then**: El procedimiento reduce su fuente automáticamente y trunca en la 2.ª línea, el cirujano se muestra debajo de `CIRUJANO:` en hasta 2 líneas sin invadir al QR, y el bloque LIO completo entra dentro del presupuesto vertical de `4x2` sin recortarse.

## Technical Plan (Architecture)

La arquitectura mantiene la separación entre lógica clínica pura (`cartelesPechoHelpers.ts`) y renderizado/impresión (`ModalCartelesPechoA4.tsx`), extendiendo ambos módulos sin tocar backend ni otros modales.

```text
Turno Quirúrgico (props.turnos)
  │
  ├──► evaluarBloqueLio(turno) [cartelesPechoHelpers.ts]
  │      ├── incisionTexto      ──► Col 1 (INCISIÓN)   ej. "158°" o null
  │      ├── dioptriaTexto      ──► Col 2 (DIOPTRÍA)   ej. "18.5 D" / "S/D"
  │      ├── toricoValorTexto   ──► Col 3 (TÓRICO)     ej. "T2" o null
  │      ├── toricoEjeTexto     ──► Col 4 (EJE)        ej. "64°" o null
  │      └── tipoTexto          ──► Fila inferior ancho completo (sin Lote)
  │
  ├──► obtenerClasePractica(practicaNombre, formato = '3x2') [cartelesPechoHelpers.ts]
  │      ├── <= 26 chars        ──► "sticker-proc-3x2-lg" / "sticker-proc-4x2-lg"
  │      ├── 27..45 chars       ──► "sticker-proc-3x2-md" / "sticker-proc-4x2-md"
  │      └── > 45 chars         ──► "sticker-proc-3x2-sm" / "sticker-proc-4x2-sm"
  │      (siempre combinada con ".sticker-proc-clamp-2")
  │
  └──► SHARED_STICKER_CSS [ModalCartelesPechoA4.tsx]
         ├── <style jsx global> (Vista previa en pantalla + fallback Ctrl+P)
         └── cssA4              (iframe de impresión láser A4)
```

### 1. Cambios en el contrato de datos de helpers (`cartelesPechoHelpers.ts`)

1. **`ResultadoBloqueLio` en `evaluarBloqueLio(turno)`**:
   * Se reemplaza `toricoTexto` y `loteTexto` por:
     * `toricoValorTexto: string | null` → `T${valor}` cuando `esValorPresente(turno.lente_torico_valor)` es verdadero.
     * `toricoEjeTexto: string | null` → `${eje}°` cuando `esValorPresente(turno.lente_torico_valor)` y `esValorPresente(turno.lente_torico_eje)` son verdaderos (`esValorPresente` preserva `0` y `'0'`). Si falta `lente_torico_valor`, `toricoEjeTexto` es `null`.
   * Se mantiene `lente_lote?: string | null` en `TurnoCartelLioInput` por compatibilidad de tipos con los objetos turno entrantes.
2. **Nueva función pura `obtenerClasePractica(practicaNombre?: string | null, formato: '3x2' | '4x2' = '3x2'): string`**:
   * Normaliza espacios con `.trim().replace(/\s+/g, ' ')` y calcula la longitud (si es vacía o nula, usa `'Cirugía Oftalmológica'`).
   * Umbrales deterministas (enteros, respetando jerarquía `Paciente >= Práctica >= Lente/Cirujano`):
     * `len <= 26`: `3x2` → `19px`, `4x2` → `16px`.
     * `27 <= len <= 45`: `3x2` → `16px`, `4x2` → `14px`.
     * `len > 45`: `3x2` → `14px`, `4x2` → `12px`.

### 2. Estructura visual, paridad CSS (`SHARED_STICKER_CSS`) y presupuesto `4x2`

Todas las reglas nuevas llevan `!important` y viven dentro de `SHARED_STICKER_CSS`:

1. **Cabecera — Cirujano en 2 líneas**:
   * Contenedor `<div className="mt-0.5">` con `<div className="surgeon-label sticker-muted">CIRUJANO:</div>` (`9.5px`, `font-weight: 700`) y `<div className={\`surgeon-name-${formato} sticker-proc-clamp-2\`}>` (`14px` en `3x2`, `12px` en `4x2`, `font-weight: 900`, hasta 2 líneas para apellidos compuestos).
2. **Práctica quirúrgica en 2 líneas**:
   * `${obtenerClasePractica(t.practica_nombre || 'Cirugía Oftalmológica', formato)} sticker-proc-clamp-2 uppercase`.
3. **Bloque LIO `CARGADO` en grilla fija de 4 columnas**:
   * `.lio-grid-4`: `display: grid !important; grid-template-columns: 1fr 1.35fr 0.85fr 0.9fr !important; gap: 4px !important; align-items: center !important; text-align: center !important;`.
   * **Fila 1 (`.lio-micro-header.lio-grid-4.sticker-muted`)**: 4 celdas de `9px` (`INCISIÓN` | `DIOPTRÍA` | `TÓRICO` | `EJE`).
   * **Fila 2 (`.lio-grid-4`)**:
     * Col 1: `{lio.incisionTexto}` en `.lio-metric-pill` (sin prefijo `INC `) o `<span className="sticker-muted">—</span>`.
     * Col 2: `{lio.dioptriaTexto}` en `.lio-metric-pill` (siempre en Col 2).
     * Col 3: `{lio.toricoValorTexto}` en `.lio-toric-badge` o `<span className="sticker-muted">—</span>`.
     * Col 4: `{lio.toricoEjeTexto}` en `.lio-toric-badge` o `<span className="sticker-muted">—</span>`.
   * **Fila 3 (`.lio-tipo-${formato}.sticker-proc-clamp-2`)**: `{lio.tipoTexto || 'LIO Asignado'}` (`14px` en `3x2`, `12px` en `4x2`, `font-weight: 800`, `mt-1`), sin `Lote`.
4. **Presupuesto vertical verificado en `4x2` (`74.25mm` = `280.6px` a 96 DPI)**:
   * Margen externo `2mm` (`15.1px`) + bordes `4px` + `.etiqueta-inner-4x2` (`padding: 5px 10px` = `10px`) → **`251.5px` útiles**.
   * Peor caso `4x2`: Cabecera con QR `16mm` + zona muda `4px` (`71.5px`) + Paciente 2 líneas a `17px` y DNI (`51px`) + Insignia ojo (`22px`) + Práctica 2 líneas `12px` (`30px`) + `.lio-box-4x2` (`padding: 3px 6px`, micro-header `10px`, métricas `15px`, `lente_tipo` 2 líneas `12px` = `69px`) = **`243.5px <= 251.5px`**.

## Alternatives Considered

### Alternative A: 4 columnas iguales (`repeat(4, 1fr)`) con `"INC 180°"` dentro de la píldora

*   **Pros**: No requiere micro-encabezado superior.
*   **Cons**: En `~340px` útiles, `82.5px` por celda provoca saltos de línea en `"INC 180°"` y desperdicia espacio en `T2` y `64°`.
*   **Reason for Rejection**: Rechazado; la grilla proporcional con micro-encabezado `INCISIÓN | DIOPTRÍA | TÓRICO | EJE` mantiene valores numéricos limpios y alineados.

### Alternative B: Descripción del lente (`lente_tipo`) a `17px` exactos en `4x2`

*   **Pros**: Uniformidad literal de tamaño entre métricas y modelo.
*   **Cons**: Supera el presupuesto vertical `4x2` (`251.5px`), recortando el borde inferior por `overflow: hidden`.
*   **Reason for Rejection**: Rechazado para evitar pérdida de datos en `4x2`; `14px` en `3x2` y `12px` en `4x2` preservan legibilidad y margen vertical.

### Alternative C: Medición DOM en tiempo real (`ResizeObserver` / `scrollHeight`)

*   **Pros**: Ajuste píxel a píxel independiente del sistema operativo.
*   **Cons**: Riesgo de desincronización con el `iframe` síncrono de impresión (`printNode.innerHTML`) y complejidad innecesaria.
*   **Reason for Rejection**: Rechazado por el autor; `obtenerClasePractica` resuelve el escalado de forma determinista y testeable.

## Non-Functional Requirements

*   **Paridad Vista Previa / Impresión**: Todas las clases nuevas viven en `SHARED_STICKER_CSS` con `!important` y en `cssA4` (`w-[16mm] h-[16mm]` incluido para `4x2`).
*   **Presupuesto vertical `4x2`**: El peor caso suma `243.5px <= 251.5px` útiles.

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `frontend/src/components/quirofano/modal/cartelesPechoHelpers.ts` (Modify)

*   **Type / Scope**: Pure TypeScript Helpers
*   **Proposed Changes**:
    *   En `ResultadoBloqueLio` y `evaluarBloqueLio(turno)`: reemplazar `toricoTexto` y `loteTexto` por `toricoValorTexto: string | null` y `toricoEjeTexto: string | null` (conservando `lente_lote?: string | null` en `TurnoCartelLioInput`).
    *   Exportar `obtenerClasePractica(practicaNombre?: string | null, formato: '3x2' | '4x2' = '3x2'): string` con normalización de espacios y umbrales `<= 26`, `27..45`, `> 45`.

#### 2. `frontend/src/components/quirofano/modal/ModalCartelesPechoA4.tsx` (Modify)

*   **Type / Scope**: React Print Modal Component + `SHARED_STICKER_CSS`
*   **Proposed Changes**:
    *   Importar `obtenerClasePractica` desde `./cartelesPechoHelpers`.
    *   En `SHARED_STICKER_CSS` (todas las reglas con `!important`):
        *   Agregar `.etiqueta-inner-4x2 { padding: 5px 10px !important; }` y `.qr-quiet-zone-4x2 { padding: 4px !important; }`, junto a `.w-[16mm] / .h-[16mm]` en `cssA4`.
        *   Ajustar `.sticker-nombre-4x2` a `17px` (`line-height: 1.12`) para sostener el presupuesto vertical de `251.5px`.
        *   Reemplazar `.sticker-proc-*` por los 6 tiers enteros: `3x2` (`19px` / `16px` / `14px`) y `4x2` (`16px` / `14px` / `12px`).
        *   Agregar `.surgeon-label` (`9.5px`, `font-weight: 700`, `display: block`), `.surgeon-name-3x2` (`14px`, `font-weight: 900`, `display: block`) y `.surgeon-name-4x2` (`12px`, `font-weight: 900`, `display: block`).
        *   Agregar `.lio-box-4x2` (`padding: 3px 6px !important`), `.lio-grid-4` (`grid-template-columns: 1fr 1.35fr 0.85fr 0.9fr`), `.lio-micro-header` (`9px`, `font-weight: 800`), `.lio-tipo-3x2` (`14px`, `font-weight: 800`) y `.lio-tipo-4x2` (`12px`, `font-weight: 800`).
    *   En `renderEtiqueta`:
        *   Usar `etiqueta-inner-4x2`, `qr-quiet-zone-4x2` y `w-[16mm] h-[16mm]` cuando `formato === '4x2'`.
        *   Renderizar bloque cirujano en 2 líneas (`<div className="surgeon-label sticker-muted">CIRUJANO:</div>` + `<div className={\`surgeon-name-${formato} sticker-proc-clamp-2\`}>`).
        *   Aplicar `${obtenerClasePractica(t.practica_nombre, formato)} sticker-proc-clamp-2 uppercase` a la práctica.
        *   En bloque LIO `CARGADO`: aplicar `formato === '4x2' ? 'lio-box lio-box-4x2' : 'lio-box p-1.5'`, renderizar `.lio-micro-header.lio-grid-4.sticker-muted` (`INCISIÓN | DIOPTRÍA | TÓRICO | EJE`), renderizar `.lio-grid-4` con `lio-metric-text-${formato}` sin prefijo `INC ` y con `<span className="sticker-muted">—</span>` en celdas vacías, y abajo `<div className={\`lio-tipo-${formato} sticker-proc-clamp-2 mt-1\`}>` sin `Lote`.

#### 3. `frontend/src/components/quirofano/modal/cartelesPechoHelpers.test.mjs` (Modify)

*   **Type / Scope**: Node Unit Tests (`node:test`)
*   **Proposed Changes**:
    *   Verificar `toricoValorTexto`, `toricoEjeTexto` (incluyendo `0°`, eje ausente y `lente_torico_eje` sin `lente_torico_valor`), y `assert.equal('loteTexto' in res, false)`.
    *   Agregar suite para `obtenerClasePractica` cubriendo los 3 umbrales (`<= 26`, `27..45`, `> 45`), `formato` por defecto (`'3x2'`), espacios múltiples y `null`/vacío.

### Verification Plan

*   **Unit Tests**: `node --test frontend/src/components/quirofano/modal/cartelesPechoHelpers.test.mjs` (100% pass).
*   **Type Checking**: `cd frontend && npx tsc --noEmit` (exit code 0).
*   **Production Build**: `cd frontend && npm run build` (exit code 0).
*   **Visual / Print Verification**: Inspeccionar vista previa e impresión A4 (`3x2` y `4x2`) con: (a) `10 D` solo + `ICL Miópico (EVO) (Staar Surgical)`, (b) `158° | 18.5 D | T2 | 64°`, y (c) práctica de 65+ caracteres + paciente de 2 líneas + apellido compuesto de cirujano.

--------------------------------------------------------------------------------

*Drafted with EGM*
