import os
import sys
import psycopg2
from dotenv import load_dotenv

# Intentar cargar .env desde la raíz del proyecto
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(root_dir, ".env")
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: La variable de entorno DATABASE_URL no está configurada en el archivo .env.")
    print("Asegúrate de copiar .env.example como .env y rellenar las credenciales.")
    sys.exit(1)

schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
if not os.path.exists(schema_path):
    print(f"Error: No se encontró el archivo de esquema en {schema_path}")
    sys.exit(1)

print("Conectando a la base de datos de Supabase...")
try:
    # Codificar credenciales (username/password) en la URL para evitar errores Unicode con psycopg2
    from urllib.parse import urlsplit, urlunsplit, quote
    try:
        url_parts = urlsplit(DATABASE_URL)
        if url_parts.netloc and "@" in url_parts.netloc:
            auth_part, host_part = url_parts.netloc.rsplit("@", 1)
            if ":" in auth_part:
                username, password = auth_part.split(":", 1)
                auth_part = f"{quote(username)}:{quote(password)}"
            else:
                auth_part = quote(auth_part)
            new_netloc = f"{auth_part}@{host_part}"
            url_parts = url_parts._replace(netloc=new_netloc)
            DATABASE_URL = urlunsplit(url_parts)
    except Exception as parse_err:
        print(f"Advertencia al parsear DATABASE_URL: {parse_err}")

    # Parsear la URL de conexión y pasar los parámetros como kwargs
    from urllib.parse import urlparse
    url = urlparse(DATABASE_URL)
    
    conn = psycopg2.connect(
        dbname=url.path[1:],
        user=url.username,
        password=url.password,
        host=url.hostname,
        port=url.port
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Leyendo schema.sql...")
    with open(schema_path, "r", encoding="utf-8", errors="ignore") as f:
        sql_commands = f.read()
        
    print("Ejecutando sentencias SQL en Supabase...")
    # Supabase puede requerir ejecutar comandos por bloques o completos
    cursor.execute(sql_commands)
    
    print("¡Base de datos creada y configurada exitosamente!")
    cursor.close()
    conn.close()
except Exception as e:
    import traceback
    print("Detalle del error:")
    traceback.print_exc()
    sys.exit(1)
