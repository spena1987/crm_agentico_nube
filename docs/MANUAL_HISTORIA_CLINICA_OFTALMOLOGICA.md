# Manual de Procedimientos y Guía Operativa: Historia Clínica Oftalmológica (CRM)

**Versión:** 1.0  
**Audiencia:** Médicos Oftalmólogos, Residentes, Asistentes Clínicos y Secretarias Médicas  
**Sistema:** CRM Cloud Oftalmológico Integrado con Geclisa  
**Objetivo:** Estandarizar la carga ágil de consultas, prescripción de anteojos en 1 clic, aplicación de macros de examen normal, control de alertas clínicas y sincronización de evoluciones.

---

## 📋 Tabla de Contenidos
1. [Introducción y Objetivos](#1-introducción-y-objetivos)
2. [Estructura Visual de la Historia Clínica](#2-estructura-visual-de-la-historia-clínica)
3. [Procedimiento de Consulta Oftalmológica Ágil](#3-procedimiento-de-consulta-oftalmológica-ágil)
   - 3.1. Agudeza Visual con Quick-Chips
   - 3.2. Refracción Subjetiva y Copia OD ➔ OI
   - 3.3. Prescripción Óptica 1-Clic (Sin cambiar de pestaña)
   - 3.4. Tonometría Ocular y Alertas Automáticas de PIO
   - 3.5. Examen Físico Ocular con Macro "Normal AO"
4. [Sincronización con Geclisa (Sistema de Escritorio)](#4-sincronización-con-geclisa-sistema-de-escritorio)
5. [Impresión de Documentos y Recetas](#5-impresión-de-documentos-y-recetas)
6. [Preguntas Frecuentes y Buenas Prácticas (FAQ)](#6-preguntas-frecuentes-y-buenas-prácticas-faq)

---

## 1. Introducción y Objetivos

La Historia Clínica Oftalmológica del CRM ha sido diseñada con un principio de **Ergonomía Clínica de Alta Eficiencia**: reducir el tiempo de carga administrativa del médico (de 7-10 minutos a menos de 2-3 minutos por paciente) para que pueda concentrarse en la atención clínica y la comunicación con el paciente.

### Beneficios Clave:
- **0 Clics Innecesarios:** Generación de receta de anteojos directa desde la tabla de refracción.
- **Registro por Excepción:** Carga en 1 clic del examen físico normal y edición solo de los hallazgos patológicos.
- **Seguridad del Paciente:** Detección automática y alerta cromática de Hipertensión Ocular (PIO $\ge$ 21 mmHg).
- **Convivencia 100% con Geclisa:** Las evoluciones realizadas en el CRM se sincronizan con la historia clínica tradicional de Geclisa sin duplicar números ni sobrescribir historias de escritorio.

---

## 2. Estructura Visual de la Historia Clínica

Al ingresar a la ficha del paciente desde el CRM y hacer clic en **"Historia Clínica"**, se visualizan las siguientes áreas:

```
┌────────────────────────────────────────────────────────────────────────┐
│  CABECERA FIJA DEL PACIENTE: Datos, Antecedentes Oculares y Alergias  │
├──────────────┬─────────────────────────────────────────────────────────┤
│ MENÚ LATERAL │ PESTAÑAS: Evolución Clínica | Estudios | Recetas | etc. │
│              ├─────────────────────────────────────────────────────────┤
│ • Nueva      │ [1. Datos de Consulta: Motivo, Profesional]             │
│   Consulta   │ [2. Agudeza Visual con Chips] [Refracción y Receta 1C]  │
│ • Nuevo      │ [3. ARM, Cicloplejia, Queratometría, Tonometría (PIO)]  │
│   Postop     │ [4. Examen Físico: Botón Macro Normal AO | SO, BMC, FO] │
│ • Historial  │ [5. Diagnóstico, Conducta, Plan Quirúrgico y Próx. Ctr] │
└──────────────┴─────────────────────────────────────────────────────────┘
```

> [!NOTE]
> La **Cabecera Superior** permanece siempre visible mientras te desplazas por el formulario, permitiendo consultar antecedentes clínicos, quirúrgicos o alergias en todo momento.

---

## 3. Procedimiento de Consulta Oftalmológica Ágil

### 3.1. Agudeza Visual con Quick-Chips
En la sección **Agudeza Visual**:
1. **Visión de Lejos:**
   - Si el paciente presenta agudeza visual estándar (por ejemplo `20/20` o `20/25` en ambos ojos), presione el botón rápido en la barra superior: **`[20/20]`**, **`[20/25]`**, **`[20/30]`**, etc.
   - Automáticamente se autocompletarán los campos de Ojo Derecho (OD), Ojo Izquierdo (OI) y Ambos Ojos (AO).
   - En casos de baja visión, utilice los botones directos **`[CF]`** (Cuenta Dedos), **`[MM]`** (Movimiento de Manos) o **`[PL]`** (Percepción Luminosa).
2. **Visión de Cerca:**
   - Presione los botones rápidos de cerca **`[J1]`**, **`[J2]`**, o **`[1.0]`** para autocompletar la agudeza visual de lectura bilateral en un clic.

---

### 3.2. Refracción Subjetiva y Copia OD ➔ OI
En la tabla **Refracción Subjetiva**:
1. Ingrese los valores de **Esfera**, **Cilindro**, **Eje** y **Adición** del Ojo Derecho (OD).
   - *El Equivalente Esférico (EE) se calcula automáticamente en tiempo real.*
2. **Duplicación en 1 Clic:** Si la refracción del Ojo Izquierdo es similar o idéntica a la del derecho, haga clic en el botón superior:
   > **`[ ⇆ Copiar OD ➔ OI ]`**
   - El sistema copiará instantáneamente esfera, cilindro, eje y adición al Ojo Izquierdo. Solo deberá ajustar las diferencias puntuales si las hubiera.
3. **Sincronización Automática de Adición:** Al tipear el valor de `Adición` en OD (ejemplo `+2.00`), el sistema lo replicará automáticamente en OI, ya que en el 98% de los pacientes la presbicia es simétrica.

---

### 3.3. Prescripción Óptica 1-Clic (Generación e Impresión Inmediata)
Una vez definida la refracción del paciente, **ya no es necesario cambiar a la pestaña de "Recetas de Anteojos"**:

1. En la parte inferior de la tabla de refracción, presione el botón:
   > **`[ 👓 Generar e Imprimir Receta de Anteojos (1-Clic) ]`**
2. **¿Qué hace el sistema automáticamente tras este clic?**
   - **Cálculo de Cerca:** Si cargó una adición (ej. Esfera Lejos `+1.00` y Adición `+2.00`), el sistema suma matemáticamente ambos valores y genera la graduación de cerca: Esfera `+3.00`, manteniendo el cilindro y eje.
   - **Tipificación del Cristal:** Si tiene adición, clasifica la receta automáticamente como `Multifocales / Progresivos` (o `Bifocales` según el historial del paciente). Si no tiene adición, la clasifica como `Monofocales Lejos`.
   - **Historial del Paciente:** Incluye en las observaciones las anotaciones de estabilidad refractiva o tipo de lente previo.
   - **Guardado y Disparo de Impresión:** Guarda la receta en la base de datos y abre inmediatamente la ventana de impresión con membrete formal lista para imprimir o guardar como PDF.
   - El botón cambiará momentáneamente a color verde: **`[ ✔ ¡Receta Generada e Impresa! ]`**.

---

### 3.4. Tonometría Ocular y Alertas Automáticas de Hipertensión (PIO)
En la sección **PIO y Paquimetría**:
1. Ingrese los valores de presión intraocular por **Aire** o **Aplanación** para OD y OI.
2. **Sistema de Alerta Activa:**
   - Si el valor ingresado es menor a $21\text{ mmHg}$, el campo mantiene su formato regular.
   - Si el valor ingresado es **$\ge 21\text{ mmHg}$** (ej. `22`, `24`, `28`):
     - El casillero se iluminará en **rojo con borde destacado**.
     - Aparecerá debajo una advertencia visual inmediata:
       > ⚠️ **Alerta: PIO $\ge$ 21 mmHg detectada. Evaluar ángulo camerular y papila.**
   - Esto evita omisiones involuntarias de pacientes hipertensos oculares o con sospecha de glaucoma.

---

### 3.5. Examen Físico Ocular con Macro "Normal AO"
La mayor parte de los pacientes en consulta programada presentan estructuras anatómicas fisiológicas normales en varias secciones. Para no escribir manualmente los mismos textos en cada consulta:

1. En la barra superior de **Examen Físico Ocular**, haga clic en:
   > **`[ ✨ Cargar Examen Normal AO ]`**
2. El sistema completará automáticamente en **Ambos Ojos (AO)**:
   - **Superficie Ocular:** BUT `10 segundos`, Tinción `Negativa`, Meibomio `Normal y clara`, Blefaritis `No`, Demodex `No`, Frota ojos `No`.
   - **Biomicroscopía (Lámpara de Hendidura):** *"Córnea transparente, cámara anterior profunda, libre de Tyndall y Flare, iris regular, cristalino transparente, pupila reactiva."* Catarata: `Transparente`.
   - **Fondo de Ojo:** *"Papila de bordes netos, coloración rosada fisiológica, excavación 0.3, mácula con brillo foveal conservado, retina aplicada, vasos de calibre y trayecto normales."*
3. **Registro por Excepción:** Si el paciente tiene una patología puntual (ej. una catarata nuclear en OD o una lesión corneal), simplemente modifique el texto del ojo correspondiente. El resto del examen ya quedó documentado con terminología médica de estándar universitario.

---

## 4. Sincronización con Geclisa (Sistema de Escritorio)

El CRM y el sistema de escritorio Geclisa coexisten de manera segura:

1. **Guardado en CRM:** Cada cambio en la consulta se autoguarda en la nube.
2. **Enviar Evolución a Geclisa:**
   - En la tarjeta de la consulta (panel lateral o barra superior), haga clic en el botón:
     > **`[ Sincronizar con Geclisa ]`**
   - El sistema formateará la consulta en un bloque de texto médico estructurado (con fecha, profesional, AV, refracción, PIO, BMC, FO y conducta) y lo inyectará en la Historia Clínica del paciente en Geclisa.
   - La consulta quedará marcada con el badge verde: **`[ ✔ Sincronizado Geclisa ]`** y guardará el número de identificación devuelto por Geclisa (`geclisa_hc_id`).
3. **Pestaña Ficha Geclisa (Legado):**
   - Si desea consultar qué se escribió desde las terminales de escritorio de Geclisa, haga clic en el botón superior **`[ Ficha Geclisa (Legado) ]`**.
   - Podrá visualizar la cronología completa de evoluciones históricas cargadas en Geclisa junto a las cargadas en el CRM, claramente diferenciadas mediante etiquetas de origen:
     - `[CRM Oftalmológico]`
     - `[Geclisa Escritorio]`

---

## 5. Impresión de Documentos y Recetas

Desde la misma pantalla de consulta puede emitir todos los documentos necesarios:
- **Imprimir Ficha de Hoy:** En la barra superior de la consulta activa, haga clic en **`[ Imprimir ficha de hoy ]`** para obtener el resumen clínico impreso.
- **Imprimir Evolución Completa:** En el panel lateral, elija **`[ Imprimir Historia Completa ]`** o **`[ Solo CRM ]`** según lo requerido por auditoría o derivación.
- **Recetas Médicas (Gotas / Fármacos):** En la pestaña *Recetas Médicas*, elija los colirios de prescripción rápida (antibióticos, hipotensores, lágrimas) e imprima la orden firmada.
- **Pedidos de Estudios:** En la pestaña *Pedidos de Estudios*, seleccione los presets (OCT, Pentacam, Campo Visual, Biometría) con diagnóstico presuntivo e imprima en un clic.

---

## 6. Preguntas Frecuentes y Buenas Prácticas (FAQ)

### ¿Qué pasa si el paciente solo necesita anteojos de cerca y no de lejos?
Si el paciente es emétrope de lejos (Esfera `0.00`) y tiene adición de presbicia (ej. `+2.00`):
- En la refracción deje esfera en blanco o `0.00` y cargue `+2.00` en adición.
- Al presionar **`[ Generar e Imprimir Receta (1-Clic) ]`**, el sistema generará automáticamente la receta con cerca `+2.00` y tipificará los lentes adecuadamente.

### ¿Puedo modificar una receta después de haber hecho el 1-Clic?
Sí. La receta queda registrada en la pestaña **"Recetas de Anteojos"**. Si desea modificar la distancia interpupilar (DNP) o agregar indicaciones adicionales para la óptica (ej. *filtro azul* o *antirreflejo*), puede acceder a esa pestaña y editarla en cualquier momento.

### Si uso el macro "Normal AO", ¿se borran los datos que ya había cargado en refracción o PIO?
**No.** El botón `[ ✨ Cargar Examen Normal AO ]` únicamente impacta en las tres secciones anatómicas del examen ocular: Superficie Ocular, Biomicroscopía y Fondo de Ojo. No modifica la agudeza visual, la refracción ni la presión intraocular.

### ¿Pueden dos médicos atender al mismo tiempo o evolucionar desde Geclisa escritorio y CRM?
**Sí.** El sistema no genera colisiones ni bloqueos de concurrencia. Cuando Geclisa de escritorio genera una evolución, le asigna su propio identificador correlativo, y el CRM detecta y muestra ambas fuentes en la línea de tiempo clínica unificada.
