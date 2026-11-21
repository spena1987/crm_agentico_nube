# Comprehension Test Report — Stage 6

**Target:** `docs/designs/carteles_pecho_a4_redesign.md`

## Feature Spec paraphrase
Redesigns `ModalCartelesPechoA4.tsx` (`3x2` and `4x2` A4 surgical chest stickers) by removing `"CENTROVISIÓN QUIRÚRGICO"`, `obraSocial`, `"LENTE INTRAOCULAR (LIO)"`, `"CIRUGÍA SIN IMPLANTE DE LIO"`, and the bottom checklist; enlarging `Nombre`, `Procedimiento`, `Incisión`, `Dioptría`, and toric `T + eje`; inverting full-card polarity for `OD` (black background/white text with white QR quiet zone and `2mm` cut margin) vs `OI` (white/black) vs `AO` (double-border); and fixing `cssA4` overrides plus `0°` / `0 D` falsy bugs.

## Detailed Plan paraphrase
Modifies `ModalCartelesPechoA4.tsx` across `<style jsx global>` and `cssA4` in `handleImprimir()` to remove white-override traps, define shared semantic classes, set QR `margin: 2`, refine `requiereLenteSemantico`, fix null/empty checks for `0 D`/`0°`, update `renderEtiqueta` for all three IOL states, and clean up unused imports/`generandoQrs` state.

## Comprehension Gaps, Undefined Terms & Ambiguities
1. **Major** (`L24, L73, L76-77, L124, L130-131`): `exigeLioClinico` formula and interaction with `lleva_lente` are not explicitly defined.
2. **Major** (`L75, L123, L129`): Unresolved choice on missing `lente_torico_eje` (`omit axis or show S/D`) and partial toric/diopter states.
3. **Major** (`L93`): Undefined term `S224` (should be explained as a clinical barcode/QR scanner).
4. **Major** (`L53, L56, L119`): Ambiguous `OD` inversion rules for `.sala-pill`, `.lio-box`, `.lio-metric-pill`, `.lio-toric-badge`, `.lio-no-calc-box`, and `.sala-pill` omitted from `L119`.
5. **Nit** (`L23, L64, L75, L127-129`): Target font sizes / line-heights for `3x2` vs `4x2` are not quantified.
6. **Nit** (`L132, L137`): `generandoQrs`, `/programacion-quirurgica`, `/quirofano-en-vivo` and `OD/OI/AO` expansions appear late or only in Detailed Plan.
