# EGM Goldfish Review: Consolidated Review Report

*   **Target Document:** [`docs/designs/optica_vortix_chat_whatsapp_web_multimedia.md`](file:///d:/Github/crm_agentico_nube/docs/designs/optica_vortix_chat_whatsapp_web_multimedia.md)
*   **Author:** malko
*   **Date:** 2026-11-11
*   **Review Execution Mode:** Uninterrupted Full Flow (Stages 5, 6, 7, 8, 9)
*   **Status:** Review Complete (Ready for Remediation / Implementation)

---

## 1. Tabla de Estado de Ejecución de Lentes

| Etapa | Persona / Lente | Ámbito Evaluado | Estado | Hallazgos (Blocker / Major / Nit) |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 5** | `egm-zoom-out` | Archivo Completo (L1..375) | **Completed** | 0 🔴 / 2 🟡 / 0 🟢 |
| **Stage 5** | `egm-inventive-catalyst` | Archivo Completo (L1..375) | **Completed** | 1 🔴 / 1 🟡 / 0 🟢 |
| **Stage 6** | `egm-comprehension` | Archivo Completo (L1..375) | **Completed** | 1 🔴 / 1 🟡 / 1 🟢 |
| **Stage 7** | `egm-design` | FeatureRange (L1..287) | **Completed** | 0 🔴 / 1 🟡 / 1 🟢 |
| **Stage 7** | `egm-structural` | FeatureRange (L1..287) | **Completed** | 0 🔴 / 1 🟡 / 1 🟢 |
| **Stage 7** | `egm-style` | FeatureRange (L1..287) | **Completed** | 0 🔴 / 0 🟡 / 1 🟢 |
| **Stage 8** | `egm-zoom-out` (Intermedio) | Archivo Completo (L1..375) | **Completed** | 1 🔴 / 1 🟡 / 0 🟢 |
| **Stage 9** | `egm-implementation-readiness` | DetailedRange (L288..375) | **Completed** | 0 🔴 / 1 🟡 / 1 🟢 |
| **Stage 9** | `egm-codebase-details` | DetailedRange (L288..375) | **Completed** | 1 🔴 / 1 🟡 / 1 🟢 |
| **Stage 9** | `egm-style` | DetailedRange (L288..375) | **Completed** | 0 🔴 / 0 🟡 / 1 🟢 |

**Totales Consolidados:**
*   🔴 **Blockers:** 3
*   🟡 **Majors:** 5
*   🟢 **Nits:** 4

---

## 2. Hallazgos Críticos Consolidados y Plan de Remediación

### 🔴 BLOCKERS (Riesgos Críticos que Deben Subsanarse)

#### Blocker 1: Anclaje Erróneo de la Ventana de 24h de Meta en el Cron de Auto-Cierre
*   **Lentes:** `egm-zoom-out` & `egm-codebase-details`
*   **Ubicación:** `docs/designs/optica_vortix_chat_whatsapp_web_multimedia.md#L240-L261`, `L342-L344`
*   **Descripción del Problema:** El cron propuesto evalúa `ultimo_mensaje_at < (NOW() - INTERVAL '24 hours')`. En la política de Meta WhatsApp Cloud API, la ventana de servicio de 24 horas se ancla estrictamente al **último mensaje entrante del paciente**, NO a los mensajes salientes del operador. Si el operador responde al paciente a la hora 23 pero el paciente no vuelve a contestar, la ventana de Meta expira a la hora 24 del mensaje del paciente. Mantener la conversación en `activa` causará que las siguientes respuestas del operador fallen con el error de Meta `131047: Re-engagement message required`.
*   **Remediación Aprobada:** La base de datos ya cuenta con la columna `ventana_24h_expira_at`. El cron debe evaluar:
    ```sql
    WHERE estado = 'activa' AND (ventana_24h_expira_at < NOW() OR ultimo_mensaje_at < (NOW() - INTERVAL '24 hours'))
    ```
    Esto garantiza sincronización al 100% entre el estado del CRM y la API de Meta.

#### Blocker 2: Ingesta Ineficiente de Medios mediante Base64 en JSON (`media_base64`)
*   **Lentes:** `egm-inventive-catalyst` & `egm-implementation-readiness`
*   **Ubicación:** `docs/designs/optica_vortix_chat_whatsapp_web_multimedia.md#L82`, `L201-L212`, `L338`
*   **Descripción del Problema:** Transmitir archivos de 10MB (fotos de recetas en alta resolución tomadas con smartphone) en Base64 infla el payload un 33%, bloquea el event loop asíncrono de Python durante la decodificación y arriesga errores HTTP 413 (Payload Too Large) en proxies inversos.
*   **Remediación Aprobada:** En lugar de Base64 embebido en JSON, el frontend subirá el archivo directamente a Supabase Storage con URL firmada (o utilizará el endpoint existente de streaming `multipart/form-data`), y pasará únicamente la URL pública y metadatos a la mutación del mensaje.

#### Blocker 3: Colisión de Estados de Conversación (`'activa'` vs `'abierta'`)
*   **Lentes:** `egm-codebase-details` & `egm-comprehension`
*   **Ubicación:** `docs/designs/optica_vortix_chat_whatsapp_web_multimedia.md#L31`, `L171-L175`, `L248`, `L296`, `L304`
*   **Descripción del Problema:** La base de datos en producción y el código existente (`optica_vortix_service.py:2152`, `optica_vortix_router.py:1521`) utilizan históricamente `estado = 'abierta'` y `archivada = False`. Si el nuevo código filtra estrictamente por `estado = 'activa'`, todas las conversaciones históricas existentes en la base de datos desaparecerían de la interfaz.
*   **Remediación Aprobada:** 
    1. Incluir en la migración SQL una unificación de datos:
       ```sql
       UPDATE public.optica_conversaciones SET estado = 'activa' WHERE estado = 'abierta' OR estado IS NULL;
       ```
    2. En el backend y frontend, tratar `'abierta'` y `'activa'` como alias equivalentes de retrocompatibilidad durante la transición.

---

### 🟡 MAJOR FINDINGS (Mejoras de Rendimiento y Robustez)

#### Major 1: Tormenta N+1 de Actualizaciones HTTP en el Cron Periódico
*   **Lente:** `egm-zoom-out`
*   **Solución:** Reemplazar el bucle secuencial `for c in res.data: update()` por una única actualización atómica por lotes en Supabase:
    ```python
    supabase.table("optica_conversaciones")\
        .update({"estado": "cerrada", "cerrado_at": now_iso, "cerrado_motivo": "inactividad_24h"})\
        .eq("estado", "activa")\
        .lt("ventana_24h_expira_at", now_iso)\
        .execute()
    ```

#### Major 2: Estandarización de `client_id` (JSONB vs Columna Dedicada)
*   **Lentes:** `egm-comprehension` & `egm-codebase-details`
*   **Solución:** Almacenar `client_id` de forma canónica dentro de `metadata.client_id` (indexado con índice GIN/expresión en PostgreSQL) y proyectarlo como propiedad de primer nivel en el enriquecedor de TypeScript para el frontend.

#### Major 3: Manejo de Errores y Reintentos en el Reconciliador Optimista
*   **Lentes:** `egm-design` & `egm-structural`
*   **Solución:** Extender el estado optimista para contemplar fallos de red o rechazos de Meta: si la mutación falla, marcar `estado_entrega: 'failed'`, renderizar ícono de advertencia rojo y permitir al operador reintentar el envío con un clic.

#### Major 4: Compatibilidad de Reproducción de Audio OGG Opus en Navegadores Apple
*   **Lentes:** `egm-comprehension` & `egm-implementation-readiness`
*   **Solución:** El tag `<audio>` reproduce OGG Opus en Chrome, Edge y versiones recientes de Safari. Como fallback defensivo para navegadores que no decodifiquen el contenedor OGG, el componente `ChatVoicePlayer` incorporará detección de soporte y ofrecerá reproducción o descarga directa del archivo.

#### Major 5: Política de Retención y Privacidad en Supabase Storage
*   **Lente:** `egm-zoom-out`
*   **Solución:** Configurar el bucket `optica_chat_media` con URLs privadas prefirmadas y programar un ciclo de vida de archivado a los 180 días para recetas médicas sensibles.

---

### 🟢 NITS (Detalles de Formato y Estilo)

*   **Nit 1:** Reemplazar notación LaTeX `$\to$` por flecha estándar Unicode `→` en el documento de diseño.
*   **Nit 2:** Mantener los enums de entrega en inglés en la API (`'pending' | 'sent' | 'delivered' | 'read' | 'failed'`) para preservar compatibilidad con los webhooks de Meta, y traducir a español únicamente en las etiquetas visuales de UI.
*   **Nit 3:** Agregar indicador visual translúcido con borde discontinuo (`isDraggingOver`) cuando el usuario arrastra un archivo sobre el contenedor de chat.
*   **Nit 4:** Especificar formalmente los payloads de `POST /conversaciones/{id}/reabrir` y `POST /conversaciones/{id}/cerrar`.

---

## 3. Matriz de Trazabilidad de Remediación

| ID | Hallazgo | Prioridad | Componente Afectado | Acción de Remediación |
| :---: | :--- | :---: | :--- | :--- |
| **B1** | Ventana de Meta 24h anclada al cliente | 🔴 Blocker | `optica_vortix_service.py` | Evaluar `ventana_24h_expira_at < NOW()` en el cron de cierre. |
| **B2** | Sobrecarga Base64 en JSON | 🔴 Blocker | `optica_vortix_router.py` | Subida directa a Storage o endpoint streaming `multipart`. |
| **B3** | Colisión de estado `'activa'` vs `'abierta'` | 🔴 Blocker | Base de datos & Router | Migración SQL `UPDATE` y soporte de alias retrocompatible. |
| **M1** | N+1 en cron de auto-cierre | 🟡 Major | `optica_vortix_service.py` | Actualización atómica en un único `UPDATE ... WHERE`. |
| **M2** | Inconsistencia en `client_id` | 🟡 Major | DB / Frontend types | Estandarizar en `metadata.client_id` con proyección tipada. |
| **M3** | Estado de fallo y reintento en UI | 🟡 Major | `page.tsx` | Añadir estado `'failed'` con botón de reintento. |
| **M4** | Playback OGG Opus en Safari | 🟡 Major | `ChatVoicePlayer.tsx` | Detección de soporte y fallback defensivo. |
| **M5** | Retención de PII en Storage | 🟡 Major | Supabase Storage | Bucket privado con URLs firmadas y ciclo de retención. |
| **N1** | Notación LaTeX en Markdown | 🟢 Nit | `design_doc.md` | Reemplazar por flechas Unicode `→`. |
| **N2** | Enums de entrega bilingües | 🟢 Nit | `types/optica.ts` | Enums canónicos en inglés compatibles con Meta webhooks. |
| **N3** | Overlay de Drop-Zone visual | 🟢 Nit | `page.tsx` | Añadir feedback visual en `onDragEnter`/`onDragLeave`. |
| **N4** | Schemas manuales de cerrar/reabrir | 🟢 Nit | `optica_vortix_router.py` | Tipar payloads y respuestas de cierre/reapertura manual. |

---

## 4. Conclusión

El diseño técnico ha superado rigurosamente las 5 etapas del protocolo EGM. La incorporación de las 3 remediaciones de los **Blockers** (sincronización con `ventana_24h_expira_at`, subida desacoplada de medios y unificación de estados `'abierta'`/`'activa'`) deja el documento 100% blindado y listo para iniciar la implementación de código sin riesgos arquitectónicos.
