# Reporte Diario de Control de Quirófano e Implantes de LIO (Planilla A4 Landscape)

* **Author:** malko
* **Date:** 2026-11-09
* **Mode:** BRAINSTORM
* **Status:** Swarm Review Completed (7 Lenses)

## Overview

Planificación e ingeniería de la Planilla Quirúrgica Operativa Diaria en formato A4 apaisado (Landscape), diseñada específicamente para la dinámica de enfermería, instrumentación quirúrgica y anestesiología en mesa de operaciones. 

El sistema resuelve tres fricciones críticas:
1. **Desacople Horario:** Diferenciación operativa entre la hora de citación y preparación pupilar (`H. PAC.`) y la hora de inicio de intervención (`H. CIR.`), incorporando un cálculo automático sugerido (T - 50m / T - 30m / T - 60m según prestación) configurable en la agenda.
2. **Inferencia de Secuencia Bilateral (`Numero`):** Detección algorítmica de lateralidad secuencial (`1` = Primer ojo, `2` = Segundo ojo contralateral, `U` = Unilateral / Ojo único), mitigando riesgos de error de sitio quirúrgico.
3. **Control y Seguridad Visual de Implantes (LIO):** Formato condensado de alta densidad para lente, dioptría, toricidad y eje, incisión axial/milimétrica, observaciones clínicas de preparación ("NO DILATAR", cuidados posturales) y contraste cromático estricto para lateralidad (`OD` rojo / `OI` verde).

---

## Analysis & Multi-Lens Findings

### 1. UX & Ergonomía Visual (`egm-design`)
* **Retícula A4 Landscape (297 × 210 mm):** Descontando márgenes de impresión seguros de 6-8 mm, se dispone de 283 mm (aprox. 800 pt) útiles. La tabla alberga entre 15 y 22 cirugías por página con altura compacta de fila (8 mm) evitando saltos huérfanos.
* **Seguridad de Lateralidad Dual:** No depender exclusivamente del color para personas con discromatopsia; combinar badge monoespaciado en negrita (`[OD]`, `[OI]`) con fondo rojo (#EF4444) y verde (#16A34A).
* **Acceso Rápido:** Botón primario en la barra de herramientas de `PizarraQuirofanoEnVivo.tsx` con popover de filtros inmediatos (por sala y por tipo de práctica) y botón de impresión directa.

### 2. Arquitectura de Código & Persistencia (`egm-codebase-details`)
* **Base de Datos (Supabase / PostgreSQL):**
  - Adición idempotente en `public.turnos_quirofano`:
    - `hora_citacion_paciente TIME`: Hora sugerida o editada para el ingreso del paciente.
    - `secuencia_ojo VARCHAR(5) DEFAULT 'U'`: Selector `['1', '2', 'U']` inferido o forzado manualmente.
* **Backend (FastAPI):**
  - Endpoint `GET /api/quirofanos/planilla-diaria-pdf?fecha=YYYY-MM-DD&quirofano_id=...&tipo_procedimiento=...` generando el stream PDF en memoria mediante ReportLab.
  - Actualización de schemas Pydantic de turnos para aceptar `hora_citacion_paciente` y `secuencia_ojo`.
* **Frontend (Next.js):**
  - Componente `ModalPlanillaQuirurgicaA4.tsx` accesible desde la Pizarra en Vivo.
  - Edición y cálculo sugerido en `FichaTurnoModal.tsx` al modificar `hora_inicio` o la prestación.

### 3. Trazabilidad de Flujo & Recordatorios (`egm-zoom-out`)
* **Alineación con Mensajería Externa:** El recordatorio por WhatsApp enviado al paciente debe citar exclusivamente la `H. PAC.`, mientras que la planilla interna de quirófano muestra ambas horas (`H. PAC.` y `H. CIR.`) para que el equipo asistencial conozca el tiempo de dilatación transcurrido.

### 4. Seguridad Quirúrgica & Carga Cognitiva (`egm-comprehension`)
* Cumplimiento de metas internacionales de seguridad del paciente (OMS / Joint Commission):
  - `1`: Primer ojo programado de un esquema bilateral.
  - `2`: Segundo ojo programado. Permite al equipo verificar la historia clínica y técnica del primer ojo antes de iniciar.
  - `U`: Procedimiento unilateral puro / paciente monocular.

### 5. Casos Borde y Factibilidad (`egm-implementation-readiness`)
* **Cirugía Contralateral Externa:** Paciente operado del 1er ojo en otra institución. El sistema debe permitir override manual en la ficha para setear `2` con nota explicativa.
* **Bilateral Inmediata Simultánea:** Si ambos ojos se operan en el mismo día, se muestran dos filas consecutivas con `1` y `2` y borde delimitador unificado.

### 6. Contradicciones TRIZ & Patrones Innovadores (`egm-inventive-catalyst`)
* **Densidad vs Legibilidad:** Resolución mediante micro-formato LIO: modelo resumido en primera línea, poder y toricidad condensada en segunda línea, incisión y eje en columna de observaciones.
* **Papel vs Estado Digital:** Inclusión de micro código QR por paciente en el margen de la fila para escaneo rápido con pistola láser/móvil que actualice el estado a "En Preparación" o "En Sala".

---

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Migración de esquema en `turnos_quirofano` (`hora_citacion_paciente`, `secuencia_ojo`).
  * Sugerencia automática de `H. PAC.` en la pantalla de agenda al asignar horario de cirugía.
  * Selector manual y algoritmo de inferencia automática para `1`, `2`, `U`.
  * Generador de PDF ReportLab en A4 Landscape con 14 columnas exactas y badges de color.
  * Botón en `PizarraQuirofanoEnVivo` con filtros por Sala (Todas / Q1 / Q2) y Tipo de Procedimiento (Todos / Con LIO / Sin LIO).
* **Out-of-Scope Non-Goals:**
  * No reemplaza el Parte Quirúrgico individual ni el Libro Oficial de Quirófano.
  * No altera las notificaciones por WhatsApp de agendas a los médicos prestadores.

---

## Alternatives Weighed

* *Calcular H. PAC. solo en memoria sin campo en base de datos:* Descartado; quirófano requiere persistir horarios reales acordados para pacientes con condiciones especiales (dilatación difícil, traslados en ambulancia).
* *Excluir pacientes de retina o inyecciones de la planilla:* Descartado; la instrumentadora y anestesista preparan la sala para toda la jornada completa y requieren ver el cronograma integral.

---

## Key Decisions & Staging for Next Steps

* **Distribución de Anchos (794 pt disponibles en A4 Landscape con márgenes de 24 pt):**
  - `Fecha`: 45 pt
  - `H. PAC.`: 38 pt
  - `H. CIR.`: 38 pt
  - `HC`: 42 pt
  - `PACIENTE`: 110 pt
  - `Número`: 20 pt
  - `OJO`: 24 pt (Fondo Rojo OD / Verde OI)
  - `LENTE`: 70 pt
  - `DIOPTRIA`: 52 pt
  - `OBS`: 105 pt
  - `Cirujano`: 75 pt
  - `DERIVADOR`: 65 pt
  - `ANESTESISTA`: 55 pt
  - `OBRA SOCIAL`: 55 pt
* **Siguiente Paso:** Pasar a `/egm-draft` para generar el documento de especificación técnica formal y plan de ejecución detallado.
