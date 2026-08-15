# CRM Médico Inteligente + Bot Agéntico de WhatsApp con Gemini

Este repositorio contiene una solución completa, profesional y de nivel de producción para la gestión administrativa de Clínicas y Consultorios Médicos, integrada con un agente inteligente de WhatsApp impulsado por **Google Gemini** y **Supabase**.

---

## 🚀 Arquitectura General del Sistema

El proyecto está diseñado de forma modular y desacoplada:

1. **Base de Datos (Supabase)**: Almacena pacientes, conversaciones, mensajes, catálogo de servicios, y presupuestos. Cuenta con Row Level Security (RLS) habilitado y comunicación en tiempo real vía WebSockets (`Supabase Realtime`).
2. **Backend Daemon & API (FastAPI + Neonize)**:
   - **FastAPI**: Expone endpoints HTTP para que el CRM controle al bot, simule chats y genere presupuestos.
   - **Neonize**: Daemon WebSocket 24/7 conectado a la red de WhatsApp (persiste la sesión QR en `./neonize.db`).
   - **Agente Gemini (google-genai)**: Orquesta el procesamiento del lenguaje natural con System Instructions muy precisas y Function Calling para turnos, presupuestos y derivación humana.
3. **Frontend (Next.js - App Router)**: Panel CRM operativo y administrativo con bandeja de entrada estilo WhatsApp Web, control del bot, visualización de fichas de pacientes con notas clínicas y creador interactivo de propuestas comerciales.

---

## 🛠️ Configuración de la Base de Datos (Supabase)

1. Crea un proyecto nuevo en [Supabase](https://supabase.com/).
2. Ve al editor SQL (SQL Editor) en la consola de Supabase.
3. Copia e ingresa todo el contenido del archivo [`database/schema.sql`](./database/schema.sql) y ejecútalo. Esto creará:
   - Las tablas relacionales (`pacientes`, `conversaciones`, `mensajes`, `servicios_precios`, `presupuestos`, `items_presupuesto`).
   - Índices de rendimiento.
   - Triggers para actualización de timestamps y cálculo automático del total de presupuestos.
   - Políticas RLS y datos iniciales de servicios.

---

## 💻 Ejecución Local

### Paso 1: Variables de Entorno
Copia el archivo `.env.example` como `.env` en la raíz del proyecto y completa las claves:
```bash
cp .env.example .env
```
Asegúrate de configurar `GEMINI_API_KEY`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY`.

---

### Paso 2: Iniciar el Backend (Python 3.11+)

1. Ve a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Crea e inicia un entorno virtual:
   ```bash
   python -m venv venv
   # En Windows:
   .\venv\Scripts\activate
   # En macOS/Linux:
   source venv/bin/activate
   ```
3. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Ejecuta el servidor en modo desarrollo:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *Nota: El servidor estará disponible en `http://localhost:8000`.*

---

### Paso 3: Iniciar el Frontend (Next.js + Tailwind)

1. Ve a la carpeta `frontend`:
   ```bash
   cd ../frontend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env.local` en la carpeta `frontend` y agrega las variables públicas de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu_proyecto_id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_public_key
   ```
4. Ejecuta el servidor Next.js:
   ```bash
   npm run dev
   ```
   *Nota: Abre tu navegador en `http://localhost:3000`.*

---

## 🧪 Pruebas de Funcionamiento

### 1. Pruebas sin WhatsApp Físico (Simuladas)
El CRM incluye una herramienta de simulación integrada.
1. Ve a la vista de `/chat` en el CRM (`http://localhost:3000/chat`).
2. En la sección superior del panel de la izquierda "Simular Cliente (WhatsApp)", ingresa un número de teléfono de pruebas (ej: `5491123456789`) y escribe un mensaje como:
   - *"Hola, ¿tienen algún turno para el 2026-08-15?"*
3. Presiona **Sim.** para enviar el mensaje. 
4. Verás aparecer la conversación en tiempo real. Gemini usará la herramienta `buscar_disponibilidad_turnos` para responder con los horarios libres.
5. Puedes probar a cotizar escribiendo: *"Quiero un presupuesto para una Consulta General y una Ecografía Abdominal"*. Gemini ejecutará `crear_borrador_presupuesto` y te responderá con la URL para descargar el PDF generado.

### 2. WhatsApp Real (Escanear QR)
Cuando ejecutas el backend de FastAPI en un entorno local, el daemon Neonize intentará conectarse. Revisa la consola/terminal del backend:
1. Neonize generará e imprimirá un código QR en formato ASCII directamente en la terminal.
2. Abre WhatsApp en tu teléfono móvil, ve a **Dispositivos vinculados > Vincular un dispositivo** y escanea el código QR de la consola.
3. Una vez enlazado, se generará el archivo SQLite `./neonize.db` y el bot responderá de manera automática a cualquier mensaje real que reciba tu cuenta de WhatsApp siguiendo el mismo comportamiento del motor de Gemini.

---

## 🚢 Instrucciones de Despliegue en la Nube

### A. Backend (FastAPI + Daemon en Railway)
El backend requiere persistencia para que el código QR de WhatsApp no expire tras reinicios.
1. Sube el código de este repositorio a GitHub.
2. Inicia sesión en [Railway](https://railway.app/).
3. Crea un nuevo proyecto e importa el repositorio de GitHub seleccionando la carpeta `backend`.
4. En la configuración del servicio en Railway:
   - Añade las variables de entorno detalladas en el archivo `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, etc.).
   - Ve a **Settings > Volumes** y añade un volumen montado en `/app` para persistir el archivo de sesión SQLite `neonize.db`.
5. Railway detectará automáticamente el archivo `railway.json` y el `Dockerfile` para compilar e iniciar la aplicación.

### B. Frontend (Next.js en Vercel)
1. Ve a [Vercel](https://vercel.com/) e inicia sesión.
2. Crea un proyecto nuevo e importa el repositorio de GitHub.
3. Configura el **Root Directory** del proyecto en `frontend`.
4. Agrega las variables de entorno en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Haz clic en **Deploy**. Vercel compilará la aplicación Next.js y te proporcionará una URL de producción (HTTPS).
