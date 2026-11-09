# Drift Report: 2026-11-09

## docs/designs/automatizacion_agenda_prestadores_whatsapp.md

* **Migration Filename Deviation:**
  * **Design:** `database/migrations/027_notificaciones_prestadores_agenda.sql` (Sections 5.A and 2.Archivos de Base de Datos).
  * **Implementation:** `database/migrations/032_notificaciones_prestadores_agenda.sql`.
  * **Root Cause:** Migration sequence numbers `027` (`027_registrar_modulo_historias_clinicas_rbac.sql`), `028`, and `031` were already allocated in the repository. Sequence number `032` was used to prevent filename collision.

* **Omission of Distributed Concurrency Lock (`pg_try_advisory_xact_lock`):**
  * **Design:** Section 1.2, CUJ 1, and Detailed Plan Step 3 specified process-level mutual exclusion using PostgreSQL transaction advisory locks: `pg_try_advisory_xact_lock(hashtext('corte_agenda_' || fecha_objetivo))`.
  * **Implementation:** Omitted in `backend/app/services/notificacion_prestadores_service.py`. Concurrency protection currently relies on the database unique index `idx_notif_prest_unicidad_envio` (`UNIQUE (fecha_cirugia, fecha_corte, prestador_id) WHERE estado = 'ENVIADO'`) and pre-send check `verificar_envio_previo_prestador`, but lacks early advisory lock acquisition to immediately abort redundant concurrent execution workers.

* **API Model Signature and Field Extensions:**
  * **Design:** Section 5.B defined `class DespachoManualPayload(BaseModel)` with fields `fecha_cirugia: date` and `forzar_reenvio: bool = False`.
  * **Implementation:** `backend/app/routers/notificaciones_prestadores_router.py` defined `class DespachoManualRequest(BaseModel)` with `fecha_cirugia: str` (with ISO regex validation), `forzar_reenvio: bool = False`, and an additional field `asincrono: bool = Field(True)`.

* **Additional Endpoint Implemented (`POST /ejecutar-corte-diario`):**
  * **Design:** Section 1.Detailed Implementation Plan Step 4 specified `GET /destinatarios-status`, `POST /despachar`, `GET/PUT /configuracion`, and `GET /logs`.
  * **Implementation:** `POST /api/turnos-quirofano/notificaciones-prestadores/ejecutar-corte-diario` was implemented in `backend/app/routers/notificaciones_prestadores_router.py` to allow manual on-demand execution of the automatic business days cut calculation from the frontend settings panel.

* **Extended Configuration Output (`proxima_fecha_proyectada`):**
  * **Design:** `GET /configuracion` returns raw settings from `configuracion_sistema`.
  * **Implementation:** `GET /configuracion` dynamically calculates and injects `proxima_fecha_proyectada` via `calcular_fecha_objetivo_habiles` for real-time feedback in `ConfiguracionNotificacionesCirugiasCard.tsx`.

* **PDF Generator Signature Enhancement:**
  * **Design:** Step 2 specified `generar_pdf_agenda_prestadores(prestador_info, cirugias_list)`.
  * **Implementation:** `backend/app/services/pdf_service.py` defines `generar_pdf_agenda_prestadores(prestador_info: Dict[str, Any], cirugias_list: List[Dict[str, Any]], fecha_cirugia_str: str, config_override: Optional[Dict[str, Any]] = None) -> tuple[bytes, str]`, adding explicit date formatting parameter for the document header.
