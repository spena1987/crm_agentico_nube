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

# Ejecutar el servidor uvicorn (el daemon de WhatsApp se puede iniciar en un thread o proceso secundario)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
