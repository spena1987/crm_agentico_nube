# Goldfish Annotated Review Report

**Status:** resolved
**Target:** `docs/designs/categorias_nomenclador_correlacion_geclisa_filtrado_lio.md` (`1-492`)

## Prioritized Findings & AI Suggestions

### `[M1]` [`egm-zoom-out, egm-inventive-catalyst, egm-design, egm-structural`] - Severity: Major
*   **Affected Scope:** `Lines 44, 118–120, 178–181, 208–210, 396`
*   **Discrepancy Description:** El `CHECK` actual (`NOT (es_lio_comercial AND permite_requiere_lente) AND NOT (es_lio_comercial AND es_insumo)`) permite `permite_requiere_lente = true` y `es_insumo = true` simultáneamente, violando la exclusividad de roles de `G1`.
*   **Rationale:** Impide que una categoría de insumos habilite `requiere_lente`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se mantiene el modelo de 3 flags booleanos acordado con el frontend y la API, pero corrigiendo la restricción a exclusividad total `(es_lio_comercial::int + permite_requiere_lente::int + es_insumo::int) <= 1` tanto en SQL como en `CategoriaNomencladorPayload`, aclarando que `(false, false, false)` corresponde a `General`.

---

### `[M2]` [`egm-zoom-out, egm-design, egm-structural`] - Severity: Major
*   **Affected Scope:** `Lines 215, 220, 240–241, 409`
*   **Discrepancy Description:** `L240` redacta *"Se bloquea desactivar una categoría (`activo = false`)"* sin acotar a categorías con prácticas activas; falta bloquear `PUT .../categorias/{id}` ante transiciones de rol incompatibles con prácticas activas (p. ej. activar `es_lio_comercial = true` sobre `General`/`Anestesia` o desactivarlo si ya tiene `familias_lio_ids`); y si `'General'` queda con 0 prácticas activas podría desactivarse rompiendo el fallback del trigger.
*   **Rationale:** Evita desactivar categorías de sistema necesarias y bloquea cambios de rol inconsistentes.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se acota `409` al existir prácticas activas asociadas, se protege la categoría del sistema `slug = 'general'` frente a desactivación y se validan todas las transiciones de rol en `PUT .../categorias/{id}`.

---

### `[M3]` [`egm-zoom-out, egm-design`] - Severity: Major
*   **Affected Scope:** `Lines 63, 256, 279, 286, 296–297, 379`
*   **Discrepancy Description:** `Expand` (`requiere_biometria = false`) se siembra sin fila en `modelos_lio_elementos_geclisa`, pero Nivel 2A no define el payload de retorno ni la UX cuando falta elemento; además falta explicitar `ambito` cuando `condicion_toricidad == 'ambos'` con `es_torico` omitido/falso y cómo se deduce `ambito` en Nivel 2B (`requiere_biometria = true`).
*   **Rationale:** Garantiza comportamiento determinista en producción para `Expand` y para lentes tóricos/ambivalentes.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se define el retorno explícito de Nivel 2A sin elemento (`mapeado = False`, `resolucion_tipo = "elemento_generico_pendiente"`, `geclisa_ele_id = None`, `biometria_pendiente = False`, permitiendo confirmar en UI con aviso `"Sin correlación Geclisa"`) y se documenta la precedencia de `ambito` (`'torico'` si `es_torico == True` o `condicion_toricidad == 'torico'`, si no `'esferico'` con fallback `'general'`) tanto en Nivel 2A como en Nivel 2B.

---

### `[M4]` [`egm-design, egm-structural, egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** `Lines 293, 297, 421`
*   **Discrepancy Description:** `L293` mezcla `ResolverSkuPayload` con `OpcionLioItemPayload` bajo el paréntesis de `guardar_calculo_lio_endpoint`, y `L421` restringe `ResolverSkuPayload`/`ResolverSkuItemPayload` a `Optional[float] = None` contradiciendo `Optional[Union[str, float]] = None` en `L293`. Tampoco indica el código HTTP (`400`) cuando `guardar_calculo_lio_endpoint` rechaza `dioptria = None` con `requiere_biometria = true`.
*   **Rationale:** Elimina ambigüedad entre consulta de stock y guardado biométrico.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se separan ambos contratos explícitamente, se unifica `dioptria: Optional[Union[str, float]] = None` (normalizando `"" -> None`) en `ResolverSkuPayload` y `ResolverSkuItemPayload`, y se fija `HTTP 400` en `guardar_calculo_lio_endpoint` si `dioptria is None` y `requiere_biometria = true`.

---

### `[M5]` [`egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** `Lines 414, 419`
*   **Discrepancy Description:** `L414` indica eliminación por ID en `modelos_lio_elementos_geclisa`, pero `L419` omite `/{elemento_id}` en la firma de `DELETE /api/modelos-lio/{modelo_id}/elementos-geclisa`.
*   **Rationale:** Evita desajuste entre FastAPI y `LioSettingsCard.tsx`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se explicita la ruta `DELETE /api/modelos-lio/{modelo_id}/elementos-geclisa/{elemento_id}` en `L310` y `L419`.

---

### `[M6]` [`egm-codebase-details, egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** `Lines 301, 427`
*   **Discrepancy Description:** `validar_lente_blister_contra_turno(turno, datos_gs1)` actualmente no lee `modelo_lio_id` ni devuelve `requiere_confirmacion_manual`; falta detallar cómo se deduce `ambito` desde `turno`, qué ocurre si `modelo_lio_id` es `None` en turnos heredados y el valor por defecto de `requiere_confirmacion_manual` en los demás estados.
*   **Rationale:** Deja el contrato de `gs1_lio_validator.py` completamente implementable sin suposiciones.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se especifica `ambito = 'torico' if turno.get('es_torico') else 'esferico'` (con fallback `'general'`), fallback a `GTIN_NO_CATALOGADO` si `modelo_lio_id` es `None` o no tiene elemento mapeado, y `requiere_confirmacion_manual: False` por defecto en los demás estados.

---

### `[M7]` [`egm-zoom-out`] - Severity: Major
*   **Affected Scope:** `Lines 214–216, 368`
*   **Discrepancy Description:** En un `UPDATE` desde un backend FastAPI revertido (rollback), `NEW.categoria_id` hereda `OLD.categoria_id` (no es `NULL`), por lo que el trigger sobrescribiría `NEW.categoria` con el nombre viejo descartando el cambio; además falta guarda anti-recursión con `trg_propagar_nombre_categoria`.
*   **Rationale:** Garantiza compatibilidad bidireccional real en `INSERT` y `UPDATE` durante un rollback.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se agrega manejo explícito en `trg_sync_nomenclador_practica_categoria` para `TG_OP = 'UPDATE' AND NEW.categoria IS DISTINCT FROM OLD.categoria AND NEW.categoria_id IS NOT DISTINCT FROM OLD.categoria_id` con guarda `pg_trigger_depth() = 1`.

---

### `[M8]` [`egm-zoom-out`] - Severity: Major
*   **Affected Scope:** `Lines 91, 250, 263, 311, 413, 458`
*   **Discrepancy Description:** En `asesorias_quirurgicas`, si cambia la práctica quirúrgica manteniendo el mismo código LIO previo, la exención histórica omitiría validar el nuevo protocolo; además `obtener_lios_comerciales` filtra `activo = true`, por lo que un LIO histórico desactivado (`activo = false`) no llegaría a `CasoFormularioActivo.tsx` en `solo_habilitados=false`.
*   **Rationale:** Protege cambios de cirugía en expedientes existentes y preserva la visualización de LIOs históricos desactivados.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se acota la exención histórica a `(practica_sin_cambio AND lio_sin_cambio)` por cada uno de los 3 campos de lateralidad, y se especifica que `CasoFormularioActivo.tsx` sintetiza una opción fallback (`"Histórico / Deshabilitado"`) si el código guardado no figura en la lista activa.

---

### `[M9]` [`egm-zoom-out, egm-design, egm-structural`] - Severity: Major
*   **Affected Scope:** `Lines 217, 259–261, 289, 354–357, 411`
*   **Discrepancy Description:** Exigir `lios_habilitados` y `familias_lio_ids` en `bulk_import_practicas_aranceles` bloquearía importaciones Excel estándar de aranceles que solo traen código, nombre, categoría y precio; además falta verificar en pre-vuelo los LIOs comerciales activos existentes sin `familias_lio_ids`.
*   **Rationale:** Evita romper importaciones de precios y previene bloqueos inesperados tras migrar datos reales.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se aclara que `bulk_import_practicas_aranceles` preserva `requiere_lente`, `lios_habilitados` y `familias_lio_ids` existentes en actualizaciones parciales sin esas columnas, y se agrega auditoría pre-migración en Fase 1 para confirmar que todos los LIOs comerciales activos poseen al menos 1 familia válida en `familias_lio_ids`.

---

### `[M10]` [`egm-comprehension, egm-zoom-out`] - Severity: Major
*   **Affected Scope:** `Lines 422, 457`
*   **Discrepancy Description:** `L422` menciona reemplazar `requiere_calculo_lio` (`backend/app/main.py:9051`) y `L457` pide ajustar `handleAdoptarLioDelPresupuesto` (`CasoFormularioActivo.tsx:1259`), pero ninguno detalla su lógica actual ni la regla estructurada de reemplazo.
*   **Rationale:** Permite implementar ambos cambios sin tener que inferir contratos.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se especifica que `requiere_calculo_lio` pasa a consultar el flag estructurado `requiere_lente` de `nomenclador_practicas` (o LIO ya asignado en `asesorias_quirurgicas` / `lio_preview`) eliminando la lista de palabras clave, y que `handleAdoptarLioDelPresupuesto` reemplaza la búsqueda textual (`'lente'`/`'clareon'`/`'trifocal'`/`'vivity'`) por coincidencia contra `es_lio_comercial === true` / catálogo comercial cargado.

---

### `[M11]` [`egm-inventive-catalyst`] - Severity: Major
*   **Affected Scope:** `Lines 262, 342–348, 380–382`
*   **Discrepancy Description:** Al mantener `lios_habilitados` (`text[]`) y `familias_lio_ids` (`jsonb`) sin FK SQL, las guardias `409` en Python dejan una ventana TOCTOU residual ante escrituras concurrentes.
*   **Rationale:** Documentar explícitamente la ventana residual y la mitigación operativa completa el análisis de riesgos.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se documenta la ventana TOCTOU residual en `Risks & Mitigations` junto con la mitigación mediante indicador visual de prácticas incompletas en `NomencladorSettingsCard.tsx`.

---

### `[M12]` [`egm-zoom-out`] - Severity: Major
*   **Affected Scope:** `Lines 354–357, 389–470`
*   **Discrepancy Description:** El documento agrupa la corrección urgente de `34031`/`CasoFormularioActivo.tsx` con la entrega completa de categorías CRUD y `modelos_lio_elementos_geclisa`.
*   **Rationale:** Explicitar que la corrección de filtrado puede desplegarse de forma desacoplada si el resto del rollout requiere más tiempo evita retrasos innecesarios.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Se añade una nota operativa en `Detailed Implementation Plan` aclarando que, aunque la especificación cubre las 3 fases integradas, la limpieza de `"34091"` + `obtener_lios_comerciales` + `CasoFormularioActivo.tsx` puede liberarse como entrega incremental temprana sin bloquear el resto.

---

### `[N1]` [`egm-comprehension`] - Severity: Nit
*   **Affected Scope:** `Lines 1, 11, 16`
*   **Discrepancy Description:** `Geclisa` aparece desde el título sin glosa breve de qué sistema es en primera mención.
*   **Rationale:** Mejora la auto-contención para un lector nuevo.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Agregar `(sistema externo de stock, depósito y facturación quirúrgica en MySQL)` en su primera mención en `Overview`.

---

### `[N2]` [`egm-style`] - Severity: Nit
*   **Affected Scope:** `Line 253`
*   **Discrepancy Description:** Redundancia en `"informa configuracion_lio_incompleta = bool(...) con configuracion_lio_incompleta = True"`.
*   **Rationale:** Limpieza editorial menor.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Simplificar la redacción eliminando la repetición final.

---

### `[N3]` [`egm-style, egm-structural`] - Severity: Nit
*   **Affected Scope:** `Lines 27, 229`
*   **Discrepancy Description:** En la tabla de normalización, la fila `Antiangiogénicos` muestra el nombre destino antes de `(ANTIGEOGENICO / Antigeogenico)`.
*   **Rationale:** Alinea 1:1 las 13 variantes observadas en `L27` con la primera columna de la tabla.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Listar `ANTIGEOGENICO / Antigeogenico` en la columna *Valor Actual Observado*.

---

### `[N4]` [`egm-structural, egm-style`] - Severity: Nit
*   **Affected Scope:** `Lines 259–260`
*   **Discrepancy Description:** `L259–260` atribuyen `familias_lio_ids` y `condicion_toricidad` a todos los escritores incluyendo `guardar_lios_habilitados_practica`, que solo muta `lios_habilitados`.
*   **Rationale:** Precisa la responsabilidad real de cada función.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Separar explícitamente qué validaciones aplica `guardar_lios_habilitados_practica` frente a los escritores completos de práctica.

---

### `[N5]` [`egm-style`] - Severity: Nit
*   **Affected Scope:** `Line 310`
*   **Discrepancy Description:** Falta especificar los verbos HTTP de `/api/modelos-lio/{id}/elementos-geclisa` en la tabla de la Sección 5.
*   **Rationale:** Consistencia documental.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Indicar `GET/POST/DELETE /api/modelos-lio/{id}/elementos-geclisa/{elemento_id}`.

---

### `[N6]` [`egm-inventive-catalyst, egm-zoom-out`] - Severity: Nit
*   **Affected Scope:** `Lines 284–285, 301, 427`
*   **Discrepancy Description:** `ICL Miópico (EVO)` e `ICL Hipermetrópico (EVO)` comparten `39437`/`39438`; la conciliación manual en quirófano debe indicar verificar el signo dióptrico (`-` vs `+`).
*   **Rationale:** Reduce riesgo de error humano al conciliar `ICL`/`ICLT` en quirófano.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Agregar recordatorio en la guía UI de `CONCILIACION_ELEMENTO_GENERICO` para verificar el signo `-`/`+` en el blíster físico.

---

### `[N7]` [`egm-zoom-out, egm-comprehension, egm-implementation-readiness`] - Severity: Nit
*   **Affected Scope:** `Lines 401, 458`
*   **Discrepancy Description:** En `L401`, el paréntesis `(fijando condicion_toricidad = 'esferico')` parece aplicar también a `ICLT`/`ICLHT`; no se aclara que `MA60AC` no tiene código comercial activo aún en `nomenclador_practicas`; y en `L458` falta mencionar explícitamente no llamar `lios-comerciales` cuando `targetCod` está vacío.
*   **Rationale:** Evita interpretaciones erróneas durante la migración SQL y el fetch en frontend.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Aclarar ambos detalles en `L401` y `L458`.

---

### `[N8]` [`egm-comprehension, egm-implementation-readiness`] - Severity: Nit
*   **Affected Scope:** `Line 436`
*   **Discrepancy Description:** Falta explicar brevemente los fallbacks legacy `'Oftalmología'` / badge `'6'` e incluir `es_insumo` en la lista de flags gestionados en `NomencladorSettingsCard.tsx`.
*   **Rationale:** Auto-contención y paridad con el esquema de `nomenclador_categorias`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Precisar que `'Oftalmología'` era el string por defecto y `'6'` el badge fijo de la pestaña `6. LIOs & Precios`, e incluir `es_insumo`.

---

### `[N9]` [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** `Line 441`
*   **Discrepancy Description:** En `LioSettingsCard.tsx:69`, `ModeloLio.constante_a` es `number` no nullable, mientras las familias no biométricas usan `constante_a = NULL`.
*   **Rationale:** Evita errores de TypeScript en `npm run build`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Incluir la actualización de `ModeloLio.constante_a?: number | null` en `L441`.

---

### `[N10]` [`egm-zoom-out`] - Severity: Nit
*   **Affected Scope:** `Line 463`
*   **Discrepancy Description:** El fallback directo a Supabase en `ModalCrearPresupuestoPaciente.tsx` duplica reglas de filtrado de `obtener_lios_comerciales` en el navegador.
*   **Rationale:** Evita divergencia futura entre frontend y backend.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Indicar que, si el fallback directo a Supabase se conserva para resiliencia ante caída de FastAPI, consulte estrictamente `es_lio_comercial = true` vía `nomenclador_categorias`, o se retire si no es requerido.

---

### `[N11]` [`egm-style, egm-implementation-readiness`] - Severity: Nit
*   **Affected Scope:** `Lines 465–469, 478, 480`
*   **Discrepancy Description:** `L478` redacta validaciones SQL en prosa y falta confirmar en `L465–469` si `test_calculo_lio.py` y `test_gs1_pausa_oms.py` requieren ajustes o pasan sin modificaciones.
*   **Rationale:** Uniformidad en `Verification Plan` y claridad en el alcance de tests.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Expresar `L478` con consultas SQL verificables y confirmar que `test_calculo_lio.py` y `test_gs1_pausa_oms.py` permanecen compatibles sin cambios.
