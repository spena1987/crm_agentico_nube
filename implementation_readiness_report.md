# Implementation Readiness Report — Stage 9

**Target:** `docs/designs/carteles_pecho_a4_redesign.md` (`110..141`)

1. **Major — Screen-Preview CSS Scoping for Semantic Classes** (`L117-119`): Semantic classes in `<style jsx global>` must be defined at top level (not only inside `@media print`) so the on-screen preview grid receives them too.
2. **Major — Existing Utility & Padding Overrides on `.etiqueta-pecho-card`** (`L118-119, L125`): Remove `bg-white`, `text-black`, `p-3 sm:p-4` from `.etiqueta-pecho-card` JSX (`L476`) and replace `padding: 10px 14px` in `cssA4` (`L318`) with `padding: 2mm;`.
3. **Nit — Absent `lente_torico_eje` Fallback & Concrete Font Sizes** (`L123, L127-129`): Pick one fallback (`T{valor}` when axis absent) and use explicit non-responsive font sizes in `cssA4` & `<style jsx global>`.
4. **Nit — `.sala-pill` Omitted from Detailed Plan Class List** (`L119`): Add `.sala-pill` to `L119`.
5. **Nit — Repeat Unified Padding Values in Detailed Plan** (`L119`): Inline `8px 10px` (`4x2`) and `10px 12px` (`3x2`).
