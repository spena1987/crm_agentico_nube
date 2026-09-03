import os
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("auth_security")

# Clave secreta para firma y verificación de JWT de Supabase
SUPABASE_JWT_SECRET = (os.getenv("SUPABASE_JWT_SECRET") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip().strip("'\"")
EVOLUTION_API_KEY = (os.getenv("EVOLUTION_API_KEY") or "medcrm_secret_token_2026").strip()

bearer_scheme = HTTPBearer(auto_error=False)

def decode_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Decodifica y valida la firma HS256 y expiración de un token JWT emitido por Supabase.
    Si SUPABASE_JWT_SECRET está configurado, valida con PyJWT localmente sin latencia de red.
    """
    if not token:
        raise HTTPException(
            status_code=401, 
            detail="Token no proporcionado.", 
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 1. Validación local por secreto si está disponible
    if SUPABASE_JWT_SECRET:
        try:
            # Supabase firma con HS256 y aud='authenticated'
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256"],
                options={"verify_aud": False} # Permite tokens tanto con aud='authenticated' como con roles personalizados
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401, 
                detail="La sesión o token de acceso ha expirado. Inicia sesión nuevamente.", 
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Error de firma en token JWT: {e}")
            raise HTTPException(
                status_code=401, 
                detail="Token de autenticación inválido o corrupto.", 
                headers={"WWW-Authenticate": "Bearer"}
            )

    # 2. Fallback de emergencia si falta SUPABASE_JWT_SECRET (validación contra API de Supabase)
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
        logger.error(f"Falla en verificación remota de token: {api_err}")

    raise HTTPException(
        status_code=500,
        detail="El servidor no tiene configurada la variable SUPABASE_JWT_SECRET para validar sesiones."
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
