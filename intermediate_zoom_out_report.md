# Intermediate Zoom Out Report — Stage 8

**Target:** `docs/designs/carteles_pecho_a4_redesign.md`

1. **Major — Duplicated CSS & Preview Parity Gap** (`L53, L117-119`): Use a single `SHARED_STICKER_CSS` constant interpolated into both `<style jsx global>` (top-level so preview receives it) and `cssA4`.
2. **Major — `4x2` Vertical Overflow on Unclamped `Procedimiento`** (`L23, L64, L128`): Only unclamp `Procedimiento` when `!tieneLioCargado && !exigeLioClinico` (or `3x2`), keeping a safe clamp in `4x2` when the IOL block is present.
3. **Major — Print-Driver White-on-White Risk on `OD`** (`L54, L93, L118`): Document/mitigate browser print-driver background-graphics stripping on full-black `OD` cards.
4. **Major — `requiereLenteSemantico` Negation Blind Spots & Redundant Keywords** (`L68, L122`): Add exclusion guards (`SIN LIO`, `SIN LENTE`, `EXPLANTE`, `RETIRO`) and drop redundant substrings (`FACOEMULSIFICACION`, `IMPLANTE DE LIO`, `IMPLANTE LIO`).
5. **Major — Missing Automated Unit Tests for Clinical Logic** (`L134-138`): Extract pure IOL helpers and add `node --test` unit tests for `0 D`, `0°`, `null`/`""`, and negation cases.
6. **Nit — Altitude Drops / Repetition** (`L53, L70-73, L119, L123`): Summarize the null/empty invariant once rather than repeating verbatim JS expressions.
