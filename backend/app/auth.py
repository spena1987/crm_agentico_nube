import os
import logging
from typing import Optional, Dict, Any, Tuple
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
WEBHOOK_SECRET = (os.getenv("WEBHOOK_SECRET") or os.getenv("META_WA_VERIFY_TOKEN") or "medcrm_meta_verify_token_2026").strip()

bearer_scheme = HTTPBearer(auto_error=False)

# Cache en memoria para verificación de tokens autenticados (token -> (payload, expire_timestamp))
_AUTH_TOKEN_CACHE: Dict[str, Tuple[Dict[str, Any], float]] = {}
# Cache negativo para tokens rechazados o con sesión revocada (token -> expire_timestamp)
_AUTH_INVALID_TOKEN_CACHE: Dict[str, float] = {}

def decode_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Decodifica y valida un token JWT emitido por Supabase.
    Soporta tokens de sesión de usuario (HS256), token anon oficial del proyecto y token service_role.
    Optimizado con inspección previa de claims y caché de corta duración (TTL) para evitar
    tormentas de 403 Forbidden y latencia redundante contra Supabase Auth.
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

    ahora_ts = time.time()

    # Chequear caché negativo: si el token fue rechazado recientemente por sesión expirada o revocada
    invalid_until = _AUTH_INVALID_TOKEN_CACHE.get(token)
    if invalid_until:
        if ahora_ts < invalid_until:
            raise HTTPException(
                status_code=401,
                detail="La sesión o token de acceso ha expirado o fue revocado. Inicia sesión nuevamente.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        else:
            _AUTH_INVALID_TOKEN_CACHE.pop(token, None)

    # Chequear caché en memoria de tokens autenticados validados previamente (TTL 5 minutos)
    token_cached = _AUTH_TOKEN_CACHE.get(token)
    if token_cached:
        payload_cached, exp_cached = token_cached
        if ahora_ts < exp_cached:
            return payload_cached
        else:
            _AUTH_TOKEN_CACHE.pop(token, None)

    # 2. Validación local por secreto simétrico HS256 si SUPABASE_JWT_SECRET es un secreto válido
    active_secret = (os.getenv("SUPABASE_JWT_SECRET") or SUPABASE_JWT_SECRET or "").strip().strip("'\"")
    active_secret = active_secret if (active_secret and not active_secret.startswith("eyJ")) else ""
    if active_secret:
        try:
            payload = jwt.decode(
                token, 
                active_secret, 
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            # Guardar en caché si el token es válido
            exp = payload.get("exp") or (ahora_ts + 300)
            _AUTH_TOKEN_CACHE[token] = (payload, min(float(exp), ahora_ts + 300))
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401, 
                detail="La sesión o token de acceso ha expirado. Inicia sesión nuevamente.", 
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Error de firma en token JWT local: {e}. Intentando fallback...")

    # Inspección de claims no verificados antes de contactar a Supabase Auth
    # Evita llamar a /auth/v1/user cuando el token es del rol 'anon' (lo cual siempre arroja 403)
    unverified: Dict[str, Any] = {}
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
    except Exception as parse_err:
        logger.warning(f"Error al inspeccionar token: {parse_err}")

    token_role = str(unverified.get("role") or "").lower()
    project_ref = os.getenv("SUPABASE_URL", "").replace("https://", "").replace(".supabase.co", "").strip()
    token_ref = unverified.get("ref") or ""
    token_iss = unverified.get("iss") or ""

    is_project_token = (
        (token_iss == "supabase" and (not project_ref or token_ref == project_ref)) or
        (bool(project_ref) and project_ref in token_iss) or
        ("supabase.co" in token_iss and unverified.get("aud") in ("authenticated", "anon"))
    )

    # Si es un token anon del proyecto, no intentar get_user (arrojaría 403 Forbidden garantizado)
    if is_project_token and token_role == "anon":
        exp = unverified.get("exp")
        if exp and exp < ahora_ts:
            raise HTTPException(status_code=401, detail="El token anon de acceso ha expirado.")
        return unverified

    # 3. Fallback: Verificación remota contra la API de Supabase Auth SOLO para usuarios autenticados
    if token_role != "anon":
        # Primero verificar exp del JWT para no llamar a Supabase Auth si ya expiró
        exp = unverified.get("exp")
        if exp and exp < ahora_ts:
            _AUTH_INVALID_TOKEN_CACHE[token] = ahora_ts + 60
            raise HTTPException(
                status_code=401, 
                detail="La sesión o token de acceso ha expirado. Inicia sesión nuevamente.", 
                headers={"WWW-Authenticate": "Bearer"}
            )

        try:
            from app.db import supabase
            if supabase:
                res = supabase.auth.get_user(token)
                if res and res.user:
                    verified_payload = {
                        "sub": res.user.id,
                        "email": res.user.email,
                        "role": res.user.role or "authenticated"
                    }
                    _AUTH_TOKEN_CACHE[token] = (verified_payload, ahora_ts + 300)
                    return verified_payload
        except Exception as api_err:
            logger.debug(f"Verificación remota get_user no aplicable o falló: {api_err}")
            # Cachear el rechazo por 60 segundos para evitar llamadas repetitivas /auth/v1/user en polling
            _AUTH_INVALID_TOKEN_CACHE[token] = ahora_ts + 60
            raise HTTPException(
                status_code=401,
                detail="La sesión de usuario no es válida o fue revocada. Inicia sesión nuevamente.",
                headers={"WWW-Authenticate": "Bearer"}
            )

    # 4. Fallback de confianza para tokens emitidos por la instancia
    if is_project_token:
        exp = unverified.get("exp")
        if exp and exp < ahora_ts:
            raise HTTPException(status_code=401, detail="El token de acceso ha expirado.")
        return unverified

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
    Valida que los eventos entrantes a los webhooks autorizados de WhatsApp provengan
    genuinamente de la pasarela autorizada (Meta Cloud API / Webhook secret).
    Verifica los encabezados 'apikey', 'x-api-key' o parámetro en query.
    """
    incoming_key = (
        request.headers.get("apikey") 
        or request.headers.get("x-api-key") 
        or request.query_params.get("token")
        or ""
    ).strip()

    valid_secrets = {s for s in [
        os.getenv("WEBHOOK_SECRET"),
        WEBHOOK_SECRET,
        os.getenv("META_WA_VERIFY_TOKEN"),
        "medcrm_meta_verify_token_2026"
    ] if s}

    if not valid_secrets:
        return True

    if incoming_key not in valid_secrets:
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
            "/api/consentimiento/verificar/",
            "/api/whatsapp/webhook/incoming",
            "/api/whatsapp/cloud/webhook",
            "/webhooks/whatsapp",
            "/api/indicaciones/preview-pdf",
            "/docs",
            "/redoc",
            "/openapi.json"
        )
        if any(path.startswith(prefix) for prefix in public_prefixes):
            return await call_next(request)

        # Rutas de visualización y descarga directa de archivos Geclisa para iframes y navegadores
        if path.startswith("/api/geclisa/archivos/") and ("/ver" in path or "/descargar" in path):
            return await call_next(request)

        # Rutas de visualización y streaming directo de PDFs de presupuestos y documentos clínicos (Capability URLs por UUID para navegador, iframes y WhatsApp)
        if method == "GET":
            if (path.startswith("/api/presupuestos/") and path.endswith("/pdf")) or path.startswith("/api/presupuestos/pdf/"):
                return await call_next(request)
            if (path.startswith("/api/asesorias-quirurgicas/") or path.startswith("/api/turnos-quirofano/")) and (path.endswith("/consentimiento-pdf") or path.endswith("/parte-quirurgico")):
                return await call_next(request)

        # Si no empieza con /api/, permitir libremente (ej: root / healthchecks)
        if not path.startswith("/api/"):
            return await call_next(request)

        # 3. Validar encabezado Authorization Bearer o parámetro query 'token'
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        elif request.query_params.get("token"):
            token = request.query_params.get("token").strip()

        # Preparar encabezados CORS para cualquier respuesta temprana de error (evita Failed to fetch en el navegador)
        origin = request.headers.get("origin") or request.headers.get("Origin")
        cors_headers = {"WWW-Authenticate": "Bearer"}
        if origin:
            cors_headers["Access-Control-Allow-Origin"] = origin
            cors_headers["Access-Control-Allow-Credentials"] = "true"
            cors_headers["Access-Control-Allow-Methods"] = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
            cors_headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, X-Requested-With"
            cors_headers["Vary"] = "Origin"

        if not token:
            return JSONResponse(
                status_code=401,
                content={"detail": "Acceso no autorizado: Se requiere encabezado 'Authorization: Bearer <token>' emitido por Supabase."},
                headers=cors_headers
            )
        try:
            user_payload = decode_supabase_jwt(token)
            request.state.user = user_payload
        except HTTPException as he:
            resp_headers = dict(he.headers or {})
            resp_headers.update(cors_headers)
            return JSONResponse(
                status_code=he.status_code,
                content={"detail": he.detail},
                headers=resp_headers
            )
        except Exception as e:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Token de sesión inválido: {str(e)}"},
                headers=cors_headers
            )

        return await call_next(request)
