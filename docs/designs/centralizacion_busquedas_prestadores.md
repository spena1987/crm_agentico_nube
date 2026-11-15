# Centralización de Búsquedas de Prestadores en el Catálogo de Ajustes

* **Author:** malko
* **Date:** 2026-11-15

## Overview

Centralize all clinical provider lookups across the CRM (Asesoramiento `Médico Derivador` and `Médico Cirujano`, Quirófano `FichaTurnoModal`, Cálculo de LIO, and related selectors) on the local Supabase `prestadores` table managed in **Ajustes > Equipo & Prestadores** (`PrestadoresSettingsCard.tsx`), instead of querying raw Geclisa endpoints during case entry. A single `activo` flag governs whether a provider appears in searches (covering both Derivador and Cirujano), while previously saved surgical cases and turnos preserve their stored provider names in read-only or grandfathered display. Geclisa re-syncs (`/api/prestadores/sincronizar-geclisa`) continue adding newly discovered providers as active without re-enabling providers already disabled by an administrator. Ajustes adds a text search input, status filter, inline active/disabled toggle, and a dry-run usage cleanup tool that checks which providers are referenced in surgical cases and disables unused noise.

## Analysis

### Codebase Reality & Active Defect Found
- `CasoFormularioActivo.tsx` currently calls `/api/geclisa/prestadores/buscar`, a relative URL that does not exist in either `backend/app/main.py` or Next.js route handlers (the backend only exposes `GET /api/geclisa/prestadores`).
- `FichaTurnoModal.tsx` already fetches `/api/prestadores?solo_activos=true` for `Instrumentador` and `Anestesista`, yet ignores `Cirujano`/`Otro`, uses plain text inputs for `cirujano_nombre` and `medico_derivador_nombre`, and falls back to hardcoded defaults (`cirujano_id: 1067`, `cirujano_nombre: 'ABRAHAM, IRINA'`).
- `sincronizar_prestadores_geclisa_endpoint` in `backend/app/main.py` already avoids overwriting `activo` on existing records matched by `geclisa_pre_id` or `nombre_apellido`, so re-syncing does not re-enable disabled providers as long as the match key (`geclisa_pre_id` or name) remains intact.

### Key Contradictions & Risks Identified
1. **`activo` Flag Collision with Instrumentadores and Anestesistas:** `prestadores.activo` already powers `/api/prestadores?solo_activos=true` for `Instrumentador` and `Anestesista` selectors in `FichaTurnoModal.tsx`. A naive cleanup checking only `asesorias_quirurgicas` (`medico_derivador_*` / `medico_cirujano_*`) would disable every `Instrumentador` and `Anestesista` in the clinic.
2. **Disabling Newly Added or Zero-Case Valid Surgeons:** A legitimate surgeon newly synced from Geclisa (`activo = true`, zero cases so far) would be disabled immediately by an unguarded usage cleanup. Similarly, records with `firma_url` or contact info already configured represent intentional admin setup.
3. **ID-Space Mismatch & Name Drift (`NULL` IDs):** `asesorias_quirurgicas` and `turnos_quirofano` store Geclisa integer `pre_id` (often `NULL` when typed manually or imported), whereas `prestadores.id` is a UUID. Cleanup matching solely by ID would miss cases whose `medico_derivador_id` is `NULL`; cleanup matching by exact string would miss `"DR. HERNAN GRAS"` vs `"GRAS, HERNAN"`.
4. **Historical Case Editing & Cálculo de LIO Filtering:** Switching Cálculo de LIO's surgeon filter blindly to `activo = true` would hide pending historical cases belonging to a disabled surgeon. Likewise, opening an old `asesorias_quirurgicas` record whose surgeon was later disabled must not block saving unrelated edits (such as notes or dates).

### Inventive Resolutions (Ideal Final Result)
- **Role-Scoped Two-Step Dry-Run Cleanup:** Exclude `Instrumentador` from cleanup (manual staff entries), while evaluating `Cirujano`, `Otro`, and `Anestesista` against real usage (`asesorias_quirurgicas` for derivador/cirujano and `turnos_quirofano` for cirujano/derivador/anestesista). Run a `dry_run=true` preview first so the administrator confirms the list; any valid zero-case or newly synced doctor disabled by the cleanup can be re-enabled manually via the inline toggle in Ajustes.
- **Multi-Tier Normalized Usage Matching:** Check usage across `asesorias_quirurgicas` (`medico_derivador_id`, `medico_cirujano_id`, `medico_derivador_nombre`, `medico_cirujano_nombre`) and `turnos_quirofano` (`cirujano_id`, `cirujano_nombre`, `medico_derivador_nombre`, `anestesista`) by `geclisa_pre_id` first, then by normalized name tokens (accent-stripped, lowercase, prefix-stripped `Dr.`/`Dra.`, order-independent `"APELLIDO, NOMBRE"` <-> `"NOMBRE APELLIDO"`).
- **Unified `Cirujano + Otro` Search & Grandfathered Display:** Both `Médico Derivador` and `Médico Cirujano` query `GET /api/prestadores?solo_activos=true&roles=Cirujano,Otro`, while historical records render their stored `*_nombre` (and `FichaTurnoModal` preserves orphan `<option>` values) without requiring disabled providers to remain active in new searches.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Centralize Asesoramiento (`Médico Derivador` and `Médico Cirujano`), Quirófano (`FichaTurnoModal`), and related provider searches on `GET /api/prestadores?solo_activos=true`.
  * Keep a single `activo` visibility flag governing both Derivador and Cirujano lookups (consistent across `Cirujano` and `Otro` roles as configured).
  * Remove the hardcoded `1067` / `'ABRAHAM, IRINA'` fallback in `FichaTurnoModal.tsx` and fix the broken `/api/geclisa/prestadores/buscar` call in `CasoFormularioActivo.tsx`.
  * Preserve `activo = false` across Geclisa re-syncs while inserting newly discovered Geclisa providers with `activo = true`.
  * Add text search, status filter (`Todos` / `Activos` / `Deshabilitados`), `'Otro'` role tab, inline `activo` toggle, and a dry-run usage cleanup flow in `PrestadoresSettingsCard.tsx`.
  * Keep historical surgical cases and turnos readable even when their original provider is later disabled.
* **Out-of-Scope Non-Goals:**
  * Separate per-provider toggles for "only Derivador" vs "only Cirujano" (explicitly unified per user decision).
  * Modifying or deleting records in the external Geclisa database.
  * Automatically rewriting or merging historical `medico_derivador_nombre` / `medico_cirujano_nombre` strings on closed surgical cases.

## Alternatives Weighed

* **Separate `visible_busquedas` column vs. Scoped `activo` flag:** Rejected adding a second boolean column (`visible_busquedas`) for now because a single flag keeps the Ajustes mental model simple and `activo` already drives `?solo_activos=true`, provided the usage cleanup strictly excludes `Instrumentador`.
* **Direct Geclisa search with a local denylist vs. Local `prestadores` catalog as source of truth:** Rejected a separate denylist because `prestadores` already exists in Supabase with Geclisa sync, `activo`, `matricula`, `rol`, and `firma_url`; querying it directly avoids extra network hops to Geclisa during clinical data entry.
* **Silent one-click automatic disable vs. Dry-run preview cleanup:** Rejected silent automatic disabling because `NULL` IDs, name formatting variations, and newly hired surgeons with zero cases create high risk of accidentally hiding valid doctors without admin visibility.

## Key Decisions & Staging for Next Steps

1. **Single Visibility Flag (`activo`) with Role-Scoped Cleanup:** `activo` governs search visibility across CRM modules. Cleanup evaluates `Cirujano`, `Otro`, and `Anestesista` against clinical usage (`asesorias_quirurgicas` + `turnos_quirofano`), while **strictly excluding `Instrumentador`** (manually curated).
2. **Unified `Cirujano + Otro` Lookup:** Both `Médico Derivador` and `Médico Cirujano` searches filter by `activo = true` and `rol IN ('Cirujano', 'Otro')`.
3. **Zero-Case Providers Disabled & Manually Re-Enabled:** Zero-case providers in the cleanup scope are marked disabled after `dry_run` confirmation; administrators re-enable specific needed providers manually from Ajustes (`PrestadoresSettingsCard.tsx`) using the search bar and inline toggle.
4. **Cálculo de LIO Filter Continuity:** Keep `/calculo-lio` surgeon filter derived from active catalog + surgeons present in loaded LIO patients so historical cases for disabled surgeons remain filterable.
