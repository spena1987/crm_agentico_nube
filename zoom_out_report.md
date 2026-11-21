# Goldfish Review Report — Stage 5 (Initial Zoom Out)

**Target:** `docs/designs/carteles_pecho_a4_redesign.md` (`1-141`)

1. **Blocker — White-on-White Print Failure & Toner Bleed on Full-Black `OD` Cards** (`L25, L54, L56, L93, L118`): Relying solely on `print-color-adjust: exact` can fail if browser/driver disables background graphics (stripping `#000000` background while keeping `#ffffff` text = blank card). Use an SVG `<rect>` or box-shadow/inset fill or explicit print-driver safeguard + test.
2. **Major — Unbounded `Procedimiento` Expansion Can Overflow `4x2` Cells** (`L23, L64, L128`): Removing `-webkit-line-clamp: 2` without `overflow: hidden` / adaptive font sizing can push the IOL block out of fixed `4x2` (`74.25mm`) cells.
3. **Major — Duplicated Print CSS Between `<style jsx global>` and `cssA4`** (`L53, L117-119`): Extract a single shared CSS constant injected into both `<style jsx global>` and `handleImprimir()`'s `iframe`.
4. **Major — Substring Matching in `requiereLenteSemantico` Has Negation Blind Spots** (`L68, L122`): Add negation guards (`EXPLANT`, `EXTRACCION DE LIO`, `SIN LIO`, `SIN IMPLANTE`) before positive keyword matching.
5. **Major — Missing Automated Unit Tests for `0°` / `0 D` & IOL Detection** (`L69-73, L123-124, L134-137`): Extract pure helpers and add unit tests covering `0`, `'0'`, `null`, `undefined`, `''`, and explant/non-IOL strings.
6. **Nit — `AO` Bilateral Behavior with IOL Fields Unspecified** (`L40-43, L58, L74-77`): Clarify how `AO` interacts with `exigeLioClinico` / `tieneLioCargado`.
