FROM node:20-slim AS node_base
FROM python:3.11-slim

# Instalar Node.js runtime desde la imagen oficial
COPY --from=node_base /usr/local/bin /usr/local/bin
COPY --from=node_base /usr/local/lib/node_modules /usr/local/lib/node_modules

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Python
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Instalar dependencias Node.js del microservicio Baileys
COPY whatsapp_service/package*.json ./whatsapp_service/
RUN cd whatsapp_service && npm install --omit=dev

# Copiar el backend
COPY . ./

# Script de arranque dual con supervisor auto-healing para Baileys
RUN printf '#!/bin/sh\n(while true; do\n  echo "[SUPERVISOR] Iniciando microservicio WhatsApp Baileys en puerto ${WHATSAPP_SERVICE_PORT:-3001}..."\n  node /app/whatsapp_service/server.js\n  echo "[SUPERVISOR] Microservicio Baileys detenido. Reiniciando en 2 segundos..."\n  sleep 2\ndone) &\nexec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}\n' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 8000

CMD ["/app/start.sh"]
