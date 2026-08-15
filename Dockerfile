FROM python:3.11-slim

# Instalar dependencias del sistema requeridas para neonize, libmagic y psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    wget \
    ca-certificates \
    git \
    libmagic1 \
    libmagic-dev \
    file \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Python
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente del backend
COPY backend/ ./

# Exponer el puerto
EXPOSE 8000

# Ejecutar servidor uvicorn tomando dinámicamente el puerto asignado por Railway
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
