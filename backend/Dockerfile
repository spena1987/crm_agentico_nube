FROM python:3.11-slim

# Instalar dependencias del sistema requeridas para neonize y psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    wget \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY . .

# Exponer el puerto de FastAPI
EXPOSE 8000

# Ejecutar el servidor uvicorn en el puerto asignado dinámicamente por Railway ($PORT) o 8000 por defecto
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
