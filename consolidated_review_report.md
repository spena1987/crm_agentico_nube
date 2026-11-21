# Consolidated Review Report

**Target Design Document:** `docs/designs/carteles_pecho_a4_redesign.md`
**Stages Executed:** Stage 5 (`zoom_out_report.md`), Stage 6 (`comprehension_report.md`), Stage 7 (`critic_report.md`), Stage 8 (`intermediate_zoom_out_report.md`), Stage 9 (`implementation_readiness_report.md`).

---

## Consolidated Action Items (Prioritized)

### 🔴 Blockers (Must Address Before Implementation)

1. **Prevent White-on-White Blank Print Failure on Full-Black `OD` Cards**
   * **Sources:** Stage 5 #1, Stage 7 #6, Stage 8 #3
   * **Action:** Do not rely solely on `print-color-adjust: exact` without a safeguard against browser/printer drivers disabling "Background graphics" (which would strip `#000000` background while keeping `#ffffff` text = blank card). Render `OD` solid black fill via an inset CSS `box-shadow: inset 0 0 0 9999px #000000` or inline SVG `<rect fill="#000000"/>` (or document/verify exact laser printer behavior) and align `@page` margins across `@media print` and `cssA4`.

---

### 🟡 Majors (Important Design & Codebase Fixes)

2. **Extract Single `SHARED_STICKER_CSS` Constant & Fix Preview/Outer-Card Utility Overrides**
   * **Sources:** Stage 5 #3, Stage 7 #4, Stage 7 #5, Stage 8 #1, Stage 9 #1, Stage 9 #2
   * **Action:** Define one `SHARED_STICKER_CSS` constant interpolated into both `<style jsx global>` (at top level, not only inside `@media print`, so the screen preview receives all classes) and `cssA4` in `handleImprimir()`. Remove `bg-white`, `text-black`, and `p-3 sm:p-4` from the outer `.etiqueta-pecho-card` JSX (`L476`) and replace `padding: 10px 14px` in `cssA4` (`L318`) with `padding: 2mm;`. Explicitly specify `OD` vs `OI`/`AO` styling for `.sala-pill`, `.lio-box`, `.lio-metric-pill`, `.lio-toric-badge`, and `.lio-no-calc-box` (and include `.sala-pill` in Detailed Plan `L119`).

3. **Prevent `4x2` Vertical Overflow When Unclamping `Procedimiento`**
   * **Sources:** Stage 5 #2, Stage 7 #1, Stage 8 #2
   * **Action:** Only remove `-webkit-line-clamp` on `Procedimiento` when `!tieneLioCargado && !exigeLioClinico` (or in `3x2`), keeping a safe 2-line clamp / `overflow: hidden` in `4x2` (`74.25mm` fixed height) when the IOL block is present so clinical IOL metrics are never clipped.

4. **Define `exigeLioClinico`, Partial IOL/Toric Fallbacks & `requiereLenteSemantico` Negation Guards**
   * **Sources:** Stage 5 #4, Stage 6 #1, Stage 6 #2, Stage 7 #2, Stage 7 #3, Stage 8 #4
   * **Action:**
     * Explicitly define `exigeLioClinico = t.lleva_lente === false ? false : (Boolean(t.lleva_lente) || requiereLenteSemantico(t.practica_nombre, t.practica_codigo))`.
     * Add negation/removal exclusions (`SIN LIO`, `SIN LENTE`, `EXPLANTE`, `RETIRO`, `EXTRACCION DE LIO`) before positive keywords in `requiereLenteSemantico` and drop redundant substrings (`FACOEMULSIFICACION`, `IMPLANTE DE LIO`, `IMPLANTE LIO`).
     * Specify exact partial-data rendering: if `lente_tipo` is set without `lente_dioptria`, render `S/D` for diopter (or require `tieneDioptria` for `tieneLioCargado`); if `lente_torico_valor` is absent, omit toric badge; if `lente_torico_valor` is present without `lente_torico_eje`, render `T{valor}` (without fabricated `(90°)`).

5. **Extract Pure Helpers & Add Unit Tests for `0°` / `0 D` and IOL Detection**
   * **Sources:** Stage 5 #5, Stage 8 #5
   * **Action:** Export `requiereLenteSemantico` and the IOL formatting/state helpers from a pure `.ts` helper module and test them with `node --test` (zero new dependencies) covering `0`, `'0'`, `null`, `undefined`, `''`, and negation procedures.

---

### 🟢 Nits (Clarity, Consistency & Style)

6. **Explain `S224` (`Stage 6 #3`, `Stage 7 #7`), Distinguish `6px` CSS Padding vs `margin: 2` Modules (`Stage 7 #8`), Clarify `AO` with IOL (`Stage 5 #6`), Fix Mermaid Edge Label `!tieneLioCargado && exigeLioClinico` (`Stage 7 #9`), Specify Concrete `px` Font Sizes & `8px 10px` / `10px 12px` Padding in Detailed Plan (`Stage 6 #5`, `Stage 9 #3`, `Stage 9 #5`), and Summarize Repeated Null-Check Prose (`Stage 8 #6`).**

---

## Traceability Matrix

| Consolidated Item | Stage 5 | Stage 6 | Stage 7 | Stage 8 | Stage 9 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| 1. Black `OD` Print Safeguard (no white-on-white) | #1 | — | #6 | #3 | — |
| 2. Shared `SHARED_STICKER_CSS`, Preview Scope & JSX Cleanup | #3 | #4 | #4, #5 | #1 | #1, #2, #4 |
| 3. `4x2` Vertical Overflow Containment on `Procedimiento` | #2 | — | #1 | #2 | — |
| 4. `exigeLioClinico`, Negations & Partial Toric/Diopter Rules | #4 | #1, #2 | #2, #3 | #4 | #3 |
| 5. Pure Helpers & `node --test` Unit Tests | #5 | — | — | #5 | — |
| 6. Nits (`S224`, `AO`, Mermaid, Font Sizes, Padding) | #6 | #3, #5, #6 | #7, #8, #9 | #6 | #3, #5 |
