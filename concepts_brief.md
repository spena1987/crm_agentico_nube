# Redesign of A4 Surgical Chest Stickers (`ModalCartelesPechoA4`)

* **Author:** malko
* **Date:** 2026-11-20

## Overview

`ModalCartelesPechoA4.tsx` generates printable A4 sheets (`3x2` 6-up and `4x2` 8-up) of chest identification stickers used in the operating room. Currently, fixed institutional labels (`CENTROVISIÓN QUIRÚRGICO`), `obraSocial`, `"LENTE INTRAOCULAR (LIO)"`, `"CIRUGÍA SIN IMPLANTE DE LIO"`, and a 3-item bottom checklist (`Dilatación`, `Consentimiento`, `Alergias`) consume vertical space needed for larger procedure names and intraocular lens (`IOL`) metrics, while eye laterality (`OD` vs `OI`) relies on a single mid-card banner rather than full-card contrast.

This redesign removes those low-value labels, maximizes font sizes for the patient name, procedure, incision degrees, diopter, and toric `T` + axis, shows `"LENTE NO CALCULADA"` only when a lens is clinically required and missing, and applies full-card polarity inversion (`OD` black background / white text; `OI` white background / black text; `AO` distinct double-framed treatment).

## Analysis

### 1. Print Engine CSS Mismatch & `@media print` Override Risk
* **Objection from Codebase Audit:** `handleImprimir()` in `ModalCartelesPechoA4.tsx` clones `innerHTML` into an isolated `iframe` styled by a hand-written CSS subset (`cssA4`) rather than Tailwind. Both `cssA4` and `@media print` hardcode `background: #ffffff !important; color: #000000 !important;` on `.etiqueta-pecho-card`. Any new Tailwind classes omitted from `cssA4` will render in preview and disappear on print, and the `!important` white background rule would revert `OD` cards to white when printed.
* **Resolution:** Replace ad-hoc color/border utilities in `renderEtiqueta` with explicit semantic classes (`.etiqueta-od`, `.etiqueta-oi`, `.etiqueta-ao`, `.qr-quiet-zone`, `.lio-box`, etc.) defined identically in both `<style jsx global>` and `cssA4`, with `-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;` enabled. Unify preview and print padding so `4x2` (`74.25mm` height) never clips unexpectedly.

### 2. Full-Card Black `OD` vs. QR Quiet Zone & Laser Printer Hardware Margins
* **Contradiction:** Full-bleed black `#000000` to the `0mm` paper edge gets clipped unevenly by 3–5mm laser printer margins, and placing a QR code directly on black without sufficient white margin breaks optical reading by S224/camera scanners.
* **Resolution:** Keep a thin `2mm` white outer safety margin inside each dashed cut cell wrapping the full-black `OD` inner surface, and wrap the QR code in a white quiet-zone container (`6px` padding + `margin: 2` in `QRCode.toDataURL`). Invert all nested badges/borders inside `OD` (`SALA`, `Dioptría`, `Toric`, `Incisión` → white background / black text or white borders). Differentiate `AO` (Ambos Ojos) from `OI` using a thick double-line outer frame plus a solid black eye strip.

### 3. Clinical LIO Logic & Typography Allocation
* **Objection from Codebase Audit:** Existing LIO rendering contains unsafe falsy fallbacks: `t.lente_torico_eje || 90` silently converts a `0°` axis into `90°`, and `t.lente_dioptria ? ... : 'N/D'` treats `0 D` as `'N/D'`. Also, `requiereLenteSemantico` matches `p.includes('IMPL')`, which can trigger `"LENTE NO CALCULADA"` on non-IOL implants (e.g., valve or stromal implants).
* **Resolution:** Use explicit null/empty checks (`!== null && !== undefined && !== ''`) for `lente_dioptria` and `lente_torico_eje` (rendering `S/D` or omitting axis rather than fabricating `90°`), refine `requiereLenteSemantico` to avoid non-IOL false positives, omit the IOL block completely when `!exigeLioClinico && !tieneLioCargado`, show `"LENTE NO CALCULADA"` when `exigeLioClinico && !tieneLioCargado`, and place enlarged `Incisión`, `Dioptría`, and `T + eje` on the primary IOL row with `lente_tipo` and `Lote` below. Remove the 2-line clamp on `Procedimiento` so it expands when the IOL block is omitted.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Remove `"CENTROVISIÓN QUIRÚRGICO"`, `obraSocial`, `"CIRUGÍA SIN IMPLANTE DE LIO"`, `"LENTE INTRAOCULAR (LIO)"`, and `[ ] Dilatación / [ ] Consentimiento / [ ] Alergias` from both `3x2` and `4x2` stickers.
  * Keep `Fecha • Hora`, `SALA`, `#CódigoTurno`, `Cirujano`, `Nombre`, `DNI`, `Edad`, and (when applicable) `lente_tipo` + `Lote` alongside enlarged `Procedimiento`, `Incisión`, `Dioptría`, and `T + eje`.
  * Render full black card / white text for `OD` (with white QR quiet zone), white card / black text for `OI`, and distinct double-border styling for `AO`.
  * Omit the IOL block for non-IOL surgeries and show `"LENTE NO CALCULADA"` when IOL is required but unassigned.
  * Fix `cssA4` / `@media print` parity and `0°` / `0 D` falsy clinical bugs.
* **Out-of-Scope Non-Goals:**
  * Changing patient wristband printing (`ModalImprimirPulsera`) or surgical schedule PDFs.
  * Removing `3x2` or `4x2` layout options (both remain supported).

## Alternatives Weighed

* **Banner-only eye differentiation (keep white background on `OD`):** Rejected by author — full-card black vs. white contrast provides faster visual identification in the operating room.
* **Removing `lente_tipo` / `Lote` or header metadata (`#CódigoTurno`, `Edad`):** Rejected by author — all remaining header, patient, and LIO fields must be preserved.

## Key Decisions & Staging for Next Steps

1. Use semantic print-safe classes across `<style jsx global>` and `handleImprimir()` `cssA4` with `print-color-adjust: exact` and a `2mm` outer white margin on cut cells.
2. Wrap the QR code in an explicit white quiet zone (`margin: 2` + `6px` white padding) so `OD` black cards scan reliably.
3. Fix `0°` toric axis and `0 D` diopter falsy checks and refine `requiereLenteSemantico` to prevent false `"LENTE NO CALCULADA"` warnings on non-IOL implants.
4. Allocate freed vertical space to enlarged `Procedimiento` and primary-row `Incisión`, `Dioptría`, and `T + eje` scaled cleanly for both `3x2` and `4x2`.
