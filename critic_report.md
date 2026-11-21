# Critic Review Report — Stage 7

**Target:** `docs/designs/carteles_pecho_a4_redesign.md` (`1-109`)

1. **Major — Unbounded Card Growth in `4x2` / `3x2` Grid After Unclamping `Procedimiento`** (`L23, L55-59, L64, L91-94`): Define fixed/max cell dimensions, `overflow: hidden`, and adaptive font-size/line-height so `4x2` never overflows a single A4 page.
2. **Major — Missing `exigeLioClinico` Definition & Negation Exclusions** (`L24, L68-77, L85-88`): Explicitly define `exigeLioClinico` (and `lleva_lente === false` precedence) plus negation keywords (`SIN LIO`, `SIN IMPLANTE`, `EXPLANTE`).
3. **Major — Partial `lente_tipo` Without `lente_dioptria` & Partial Toric Data** (`L70-75`): Define fallback display when `lente_tipo` is set without `lente_dioptria` (or require `tieneDioptria` / show `S/D`) and clarify non-toric vs partial toric checks.
4. **Major — Unspecified Styling for Five Semantic CSS Classes** (`L53, L55-58`): Document exact `OD` vs `OI`/`AO` colors for `.sala-pill`, `.lio-box`, `.lio-metric-pill`, `.lio-toric-badge`, `.lio-no-calc-box`.
5. **Major — Duplication Between `<style jsx global>` and `cssA4`** (`L26, L53-54, L59`): Extract a single shared CSS constant consumed by both.
6. **Major — Overstated Print-Color Guarantee & `@page` Normalization** (`L26, L54, L93`): Soften `"100% parity"` and align `@page` rules between `@media print` and `cssA4`.
7. **Nit — Unexplained `S224`**, **Nit — Conflation of CSS `6px` padding and QR `margin: 2`**, **Nit — Mermaid `!tieneLioCargado && exigeLioClinico` edge label**.
