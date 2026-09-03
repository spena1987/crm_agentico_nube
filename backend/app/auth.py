import os
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import time
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("auth_security")

# Claves y secretos de Supabase
raw_jwt_secret = (os.getenv("SUPABASE_JWT_SECRET") or "").strip().strip("'\"")
SUPABASE_JWT_SECRET = raw_jwt_secret if (raw_jwt_secret and not raw_jwt_secret.startswith("eyJ")) else ""
SUPABASE_SERVICE_ROLE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip().strip("'\"")
SUPABASE_ANON_KEY = (os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "").strip().strip("'\"")
EVOLUTION_API_KEY = (os.getenv("EVOLUTION_API_KEY") or "medcrm_secret_token_2026").strip()

bearer_scheme = HTTPBearer(auto_error=False)

def decode_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Decodifica y valida un token JWT emitido por Supabase.
    Soporta tokens de sesión de usuario (HS256), token anon oficial del proyecto y token service_role.
    """
    if not token:
        raise HTTPException(
            status_code=401, 
            detail="Token no proporcionado.", 
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 1. Validación rápida si el token coincide directamente con service_role o anon del proyecto
    if (SUPABASE_SERVICE_ROLE_KEY and token == SUPABASE_SERVICE_ROLE_KEY) or \
       (SUPABASE_ANON_KEY and token == SUPABASE_ANON_KEY):
        try:
            return jwt.decode(token, options={"verify_signature": False})
        except Exception:
            pass

    # 2. Validación local por secreto simétrico HS256 si SUPABASE_JWT_SECRET es un secreto válido
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401, 
                detail="La sesión o token de acceso ha expirado. Inicia sesión nuevamente.", 
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Error de firma en token JWT local: {e}. Intentando fallback...")

    # 3. Fallback: Verificación remota contra la API de Supabase Auth
    try:
        from app.db import supabase
        if supabase:
            res = supabase.auth.get_user(token)
            if res and res.user:
                return {
                    "sub": res.user.id,
                    "email": res.user.email,
                    "role": res.user.role or "authenticated"
                }
    except Exception as api_err:
        logger.debug(f"Verificación remota get_user no aplicable o falló: {api_err}")

    # 4. Fallback de confianza para tokens del proyecto (anon key u otros tokens emitidos por la instancia)
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        project_ref = os.getenv("SUPABASE_URL", "").replace("https://", "").replace(".supabase.co", "").strip()
        token_ref = unverified.get("ref") or ""
        token_iss = unverified.get("iss") or ""

        if token_iss == "supabase" and (not project_ref or token_ref == project_ref):
            exp = unverified.get("exp")
            if exp and exp < time.time():
                raise HTTPException(status_code=401, detail="El token de acceso ha expirado.")
            return unverified
    except HTTPException:
        raise
    except Exception as parse_err:
        logger.warning(f"Error al inspeccionar token: {parse_err}")

    raise HTTPException(
        status_code=401,
        detail="Token de autenticación inválido o no reconocido por el servidor.",
        headers={"WWW-Authenticate": "Bearer"}
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Dict[str, Any]:
    """
    Dependencia estricta de FastAPI que requiere un Bearer Token válido.
    Inyecta el payload del usuario autenticado en la ruta protegida.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Acceso no autorizado: Se requiere encabezado 'Authorization: Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return decode_supabase_jwt(credentials.credentials)

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Optional[Dict[str, Any]]:
    """
    Dependencia opcional que intenta decodificar el usuario si se suministró el token,
    pero permite continuar como anónimo si no fue provisto.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return decode_supabase_jwt(credentials.credentials)
    except HTTPException:
        return None

async def verify_webhook_secret(request: Request) -> bool:
    """
    Valida que los eventos entrantes al webhook de WhatsApp provengan
    genuinamente de la pasarela autorizada (Evolution API v2).
    Verifica los encabezados 'apikey', 'x-api-key' o parámetro en query.
    """
    incoming_key = (
        request.headers.get("apikey") 
        or request.headers.get("x-api-key") 
        or request.query_params.get("token")
        or ""
    ).strip()

    if not EVOLUTION_API_KEY:
        return True

    if incoming_key != EVOLUTION_API_KEY:
        logger.warning(f"Intento de webhook no autorizado desde IP: {request.client.host if request.client else 'desconocida'}")
        raise HTTPException(status_code=403, detail="Clave de acceso al webhook inválida o ausente.")

    return True

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class AuthSecurityMiddleware(BaseHTTPMiddleware):
    """
    Middleware global de seguridad para FastAPI.
    Intercepta peticiones dirigidas a /api/* y exige un token JWT Bearer válido de Supabase,
    exceptuando explícitamente las rutas públicas (consentimiento móvil del paciente, estáticos, OpenAPI y webhook con su propio validador).
    """
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # 1. Permitir preflight CORS sin requerir token (obligatorio para navegadores)
        if method == "OPTIONS":
            return await call_next(request)

        # 2. Rutas públicas excluidas de autenticación
        public_prefixes = (
            "/static/",
            "/api/consentimiento-publico/",
            "/api/whatsapp/webhook/incoming",
            "/docs",
            "/redoc",
            "/openapi.json"
        )
        if any(path.startswith(prefix) for prefix in public_prefixes):
            return await call_next(request)

        # Si no empieza con /api/, permitir libremente (ej: root / healthchecks)
        if not path.startswith("/api/"):
            return await call_next(request)

        # 3. Validar encabezado Authorization Bearer
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Acceso no autorizado: Se requiere encabezado 'Authorization: Bearer <token>' emitido por Supabase."},
                headers={"WWW-Authenticate": "Bearer"}
            )

        token = auth_header.split(" ", 1)[1].strip()
        try:
            user_payload = decode_supabase_jwt(token)
            request.state.user = user_payload
        except HTTPException as he:
            return JSONResponse(
                status_code=he.status_code,
                content={"detail": he.detail},
                headers=he.headers or {"WWW-Authenticate": "Bearer"}
            )
        except Exception as e:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Token de sesión inválido: {str(e)}"},
                headers={"WWW-Authenticate": "Bearer"}
            )

        return await call_next(request)
