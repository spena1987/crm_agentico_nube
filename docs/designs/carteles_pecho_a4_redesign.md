# Redesign of A4 Surgical Chest Stickers (`ModalCartelesPechoA4`)

*   **Author:** malko
*   **Status:** Approved
*   **Date:** 2026-11-20

--------------------------------------------------------------------------------

## Overview

`ModalCartelesPechoA4.tsx` generates printable A4 sheets (`3x2` 6-up and `4x2` 8-up) of chest identification stickers worn by surgical patients. This design removes non-essential labels (`"CENTROVISIÓN QUIRÚRGICO"`, `obraSocial`, `"LENTE INTRAOCULAR (LIO)"`, `"CIRUGÍA SIN IMPLANTE DE LIO"`, and the bottom checklist), maximizes typography for `Nombre`, `Procedimiento`, `Incisión`, `Dioptría`, and toric `T` + `eje`, shows `"LENTE NO CALCULADA"` only when an intraocular lens (`LIO`) is clinically required and unassigned, and applies full-card polarity inversion (`OD` black background / white text, `OI` white background / black text, `AO` double-bordered frame).

## Goals & Non-Goals

*   **Goals:** Enlarge patient/procedure/IOL typography across `3x2` and `4x2` layouts; invert `OD` vs `OI` polarity with a `6px` white `.qr-quiet-zone` (`margin: 2` QR modules) and `2mm` outer cut-margin; unify preview and print CSS via a single `SHARED_STICKER_CSS` constant; fix `0°` / `0 D` falsy bugs and `requiereLenteSemantico` negation blind spots; verify pure clinical helpers with `node --test`.
*   **Non-Goals:** Modifying thermal wristbands (`ModalImprimirPulsera`), A4 daily schedules (`ModalPlanillaQuirurgicaA4`), or backend schemas.

## Technical Plan

1. **Single `SHARED_STICKER_CSS` Constant (Preview + `@media print` + `cssA4`):**
   * Interpolate `SHARED_STICKER_CSS` into `<style jsx global>` at top level (so screen preview receives all classes) and into `handleImprimir()`'s `cssA4` `iframe`.
   * Remove `bg-white`, `text-black`, `p-3 sm:p-4` from `.etiqueta-pecho-card` JSX and `background: #ffffff !important; color: #000000 !important; padding: 10px 14px;` from `.etiqueta-pecho-card` CSS, replacing with `padding: 2mm;`.
   * Define `.etiqueta-inner-od` using both `background-color: #000000 !important` and `box-shadow: inset 0 0 0 9999px #000000 !important` + `print-color-adjust: exact !important` (preventing white-on-white output if background graphics are stripped), `.etiqueta-inner-oi` (`2px solid #000000`), `.etiqueta-inner-ao` (`4px double #000000` + solid black `AMBOS OJOS (AO)` strip), `.qr-quiet-zone` (`box-shadow: inset 0 0 0 9999px #ffffff !important; padding: 6px;`), `.sala-pill`, `.lio-box`, `.lio-metric-pill`, `.lio-toric-badge`, and `.lio-no-calc-box`, with unified padding (`8px 10px` for `4x2`, `10px 12px` for `3x2`).
2. **Overflow-Safe Typography:** Remove `-webkit-line-clamp` on `Procedimiento` when no IOL block is shown (or in `3x2` mode), keeping a 2-line clamp + `overflow: hidden` in `4x2` (`74.25mm`) when an IOL block is rendered.
3. **Pure Clinical Helpers (`cartelesPechoHelpers.ts`):**
   * `requiereLenteSemantico`: check negation/removal exclusions (`SIN LIO`, `SIN LENTE`, `EXPLANTE`, `RETIRO`, `EXTRACCION DE LIO`) before matching IOL keywords (`CATARATA`, `FACO`, `LIO`, `LENTE`, `ICL`, `ARTISAN`, `RECAMBIO`, `EXTRACAPSULAR`, `IMPLANTACION SECUNDARIA`).
   * `exigeLioClinico`: `t.lleva_lente === false ? false : (Boolean(t.lleva_lente) || requiereLenteSemantico(...))`.
   * Explicit non-empty checks (`val !== null && val !== undefined && String(val).trim() !== ''`) preserving `0 D` and `0°` (if `lente_tipo` is present without `lente_dioptria`, render `S/D`; if `lente_torico_valor` is present without `lente_torico_eje`, render `T{valor}`; if `lente_torico_valor` is absent, omit toric badge).

## Verification Plan

* `node --test frontend/src/components/quirofano/modal/cartelesPechoHelpers.test.mjs`
* `cd frontend && npx tsc --noEmit && npm run build`

*Drafted with EGM*
