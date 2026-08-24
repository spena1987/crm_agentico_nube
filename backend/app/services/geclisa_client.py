import os
import time
import logging
import requests
import urllib3
from typing import Optional, List, Dict, Any, Union
from dotenv import load_dotenv

# Deshabilitar advertencias de certificados no verificados en conexiones a Geclisa
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Cargar variables de entorno
load_dotenv()

from app.services.logger_service import log_event

logger = logging.getLogger(__name__)

class GeclisaClient:
    """
    Cliente de Integración de Lectura (GET) para la API de Geclisa (CREO Mendoza).
    Maneja la autenticación JWT y expone métodos seguros de consulta.
    """
    def __init__(self):
        raw_url = os.getenv("GECLISA_API_BASE_URL", "https://creogeclisa.fertilidadmendoza.com.ar:98").strip().strip("'\"")
        if raw_url and not raw_url.startswith("http"):
            raw_url = f"https://{raw_url}"
        self.base_url = raw_url.rstrip("/") if raw_url else "https://creogeclisa.fertilidadmendoza.com.ar:98"
        
        raw_user = os.getenv("GECLISA_USERNAME", "")
        self.username = raw_user.strip().strip("'\"") if raw_user else None
        
        raw_pass = os.getenv("GECLISA_PASSWORD", "")
        self.password = raw_pass.strip().strip("'\"") if raw_pass else None
        
        # Sesión HTTP persistente con SSL verify desactivado para compatibilidad con puerto :98
        self.session = requests.Session()
        self.session.verify = False
        
        # Caché de Token
        self._token = None
        self._token_expires_at = 0

    def _do_request(self, method: str, url: str, **kwargs) -> requests.Response:
        """
        Ejecuta una petición HTTP contra Geclisa con reintento automático y fallback por IP si falla la resolución DNS.
        """
        timeout = kwargs.pop("timeout", 18)
        headers = kwargs.pop("headers", {}) or {}

        for intento in range(2):
            try:
                return self.session.request(method, url, headers=headers, timeout=timeout, **kwargs)
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as err:
                err_str = str(err)
                logger.warning(f"Intento {intento + 1}/2 falló para {url} ({err_str}).")
                
                # Fallback por IP si falla DNS o timeout en hostname
                if "apigeclisa.centrovision.com.ar" in url:
                    fallback_url = url.replace("apigeclisa.centrovision.com.ar", "190.231.99.200")
                    headers_copy = dict(headers)
                    headers_copy["Host"] = "apigeclisa.centrovision.com.ar"
                    try:
                        logger.warning(f"Reintentando por IP directa Centro Visión: {fallback_url}")
                        return self.session.request(method, fallback_url, headers=headers_copy, timeout=timeout, **kwargs)
                    except Exception:
                        pass
                elif "creogeclisa.fertilidadmendoza.com.ar" in url:
                    fallback_url = url.replace("creogeclisa.fertilidadmendoza.com.ar", "190.15.197.191")
                    headers_copy = dict(headers)
                    headers_copy["Host"] = "creogeclisa.fertilidadmendoza.com.ar"
                    try:
                        logger.warning(f"Reintentando por IP directa CREO: {fallback_url}")
                        return self.session.request(method, fallback_url, headers=headers_copy, timeout=timeout, **kwargs)
                    except Exception:
                        pass

                if intento == 1:
                    raise
                time.sleep(0.6)

    def _obtener_token(self) -> str:
        """
        Realiza el login contra el servidor OAuth2 y retorna el token JWT de acceso.
        """
        # Si el token ya está en caché y sigue vigente, lo retornamos
        ahora = time.time()
        if self._token and ahora < self._token_expires_at - 60: # 60 segundos de holgura
            return self._token

        if not self.username or not self.password:
            raise ValueError("Faltan las variables de entorno GECLISA_USERNAME o GECLISA_PASSWORD en el servidor.")

        token_url = f"{self.base_url}/connect/token"
        payload = {
            "userName": self.username,
            "password": self.password,
            "grant_type": "password",
            "client_id": "geclisaWeb"
        }

        logger.info(f"Solicitando nuevo Token JWT a Geclisa en: {token_url}...")
        t_start = time.time()
        try:
            # Petición Form URL Encoded usando _do_request
            response = self._do_request("POST", token_url, data=payload, timeout=15)
            duracion = int((time.time() - t_start) * 1000)
            response.raise_for_status()
            
            data = response.json()
            self._token = data["access_token"]
            expires_in = data.get("expires_in", 3600)
            self._token_expires_at = ahora + expires_in
            
            log_event(
                nivel="INFO",
                modulo="GECLISA",
                accion="AUTENTICACION_TOKEN",
                mensaje=f"Token JWT obtenido exitosamente de Geclisa para usuario '{self.username}'",
                detalles={"endpoint": token_url, "expires_in": expires_in},
                duracion_ms=duracion,
                http_status=response.status_code
            )
            return self._token

        except requests.exceptions.ConnectionError as conn_err:
            duracion = int((time.time() - t_start) * 1000)
            log_event(
                nivel="ERROR",
                modulo="GECLISA",
                accion="ERROR_CONEXION_TOKEN",
                mensaje=f"Fallo de conexión o resolución DNS al autenticar con Geclisa ({self.base_url})",
                detalles={"endpoint": token_url, "error": str(conn_err)},
                duracion_ms=duracion,
                http_status=0
            )
            raise RuntimeError(
                f"No se pudo resolver o conectar al servidor de Geclisa ({self.base_url}). "
                "Verifica que el servidor de producción tenga salida a internet y DNS configurado."
            ) from conn_err
        except Exception as e:
            duracion = int((time.time() - t_start) * 1000)
            log_event(
                nivel="ERROR",
                modulo="GECLISA",
                accion="ERROR_AUTENTICACION_TOKEN",
                mensaje=f"Error inesperado al solicitar Token JWT de Geclisa: {str(e)}",
                detalles={"endpoint": token_url, "error": str(e)},
                duracion_ms=duracion
            )
            raise

    def _get_headers(self) -> dict:
        """
        Retorna las cabeceras HTTP necesarias para las llamadas protegidas con JWT Bearer.
        """
        token = self._obtener_token()
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }

    # ====================================================================
    # MÉTODOS DE CONSULTA (LECTURA SEGURA)
    # ====================================================================

    def obtener_usuario_actual(self) -> dict:
        """
        Consulta los datos del usuario autenticado en la sesión de Geclisa.
        Ruta: GET /api/Usuarios/current
        """
        url = f"{self.base_url}/api/Usuarios/current"
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error en obtener_usuario_actual: {e}")
            return {"error": str(e)}

    def obtener_ficha_completa(self, ficha_id: int) -> dict:
        """
        Consulta la ficha detallada (FichaPatientDTO) y la obra social/plan asociado.
        Ruta: GET /api/Pacientes/patient/{fichaId} y GET /api/Pacientes/os-plan/{fichaId}
        """
        try:
            headers = self._get_headers()
            
            # 1. Datos del paciente
            url_paciente = f"{self.base_url}/api/Pacientes/patient/{ficha_id}"
            resp_paciente = self._do_request("GET", url_paciente, headers=headers, timeout=10)
            if resp_paciente.status_code == 404:
                # Fallback a /api/Ficha
                url_fallback = f"{self.base_url}/api/Ficha?fichaId={ficha_id}"
                resp_paciente = self._do_request("GET", url_fallback, headers=headers, timeout=10)
                
            resp_paciente.raise_for_status()
            paciente_data = resp_paciente.json()
            
            if not paciente_data:
                return {"encontrado": False, "mensaje": f"Ficha {ficha_id} no encontrada."}

            # 2. Obra Social / Plan (Consulta exhaustiva con múltiples endpoints de Geclisa)
            obra_social_nombre = None
            plan_nombre = None

            # Intento A: Endpoint específico /api/Pacientes/os-plan/{fichaId}
            try:
                url_os = f"{self.base_url}/api/Pacientes/os-plan/{ficha_id}"
                resp_os = self._do_request("GET", url_os, headers=headers, timeout=8)
                if resp_os.status_code == 200:
                    os_data = resp_os.json()
                    if isinstance(os_data, list) and len(os_data) > 0:
                        item_os = os_data[0]
                        obra_social_nombre = item_os.get("osNombre") or item_os.get("obraSocial") or item_os.get("osDescrip") or item_os.get("osNombreCorto")
                        plan_nombre = item_os.get("planNombre") or item_os.get("plan") or item_os.get("planDescrip")
                    elif isinstance(os_data, dict):
                        obra_social_nombre = os_data.get("osNombre") or os_data.get("obraSocial") or os_data.get("osDescrip")
                        plan_nombre = os_data.get("planNombre") or os_data.get("plan") or os_data.get("planDescrip")
            except Exception as os_err:
                logger.warning(f"No se pudo consultar /api/Pacientes/os-plan para ficha {ficha_id}: {os_err}")

            # Intento B: Si no se obtuvo de os-plan, buscar en los datos del paciente (patient DTO)
            if not obra_social_nombre and isinstance(paciente_data, dict):
                obra_social_nombre = (
                    paciente_data.get("osNombre") 
                    or paciente_data.get("obraSocial") 
                    or paciente_data.get("ficObrasoc") 
                    or paciente_data.get("osDescrip")
                )
                plan_nombre = plan_nombre or paciente_data.get("planNombre") or paciente_data.get("ficPlan") or paciente_data.get("plan")

            # Intento C: Fallback a /api/Ficha si aún no se tiene la obra social
            if not obra_social_nombre:
                try:
                    url_ficha_extra = f"{self.base_url}/api/Ficha?fichaId={ficha_id}"
                    resp_fe = self._do_request("GET", url_ficha_extra, headers=headers, timeout=8)
                    if resp_fe.status_code == 200:
                        fe_data = resp_fe.json()
                        if isinstance(fe_data, dict):
                            obra_social_nombre = fe_data.get("osNombre") or fe_data.get("obraSocial") or fe_data.get("ficObrasoc") or fe_data.get("osDescrip")
                            plan_nombre = plan_nombre or fe_data.get("planNombre") or fe_data.get("ficPlan")
                except Exception as fe_err:
                    logger.debug(f"Fallback /api/Ficha sin datos de OS para {ficha_id}: {fe_err}")

            if obra_social_nombre:
                obra_social_nombre = str(obra_social_nombre).strip()
            if plan_nombre:
                plan_nombre = str(plan_nombre).strip()

            # 3. Formatear y normalizar
            nombre = (paciente_data.get("ficNombre") or paciente_data.get("nombre") or "").strip()
            apellido = (paciente_data.get("ficApe") or paciente_data.get("apellido") or "").strip()
            nombre_completo = f"{apellido}, {nombre}".strip(" ,") if apellido else nombre
            
            celular = (paciente_data.get("ficCel") or paciente_data.get("celular") or "").strip()
            telefono_fijo = (paciente_data.get("ficTele") or paciente_data.get("telefono") or "").strip()
            telefono_principal = celular if celular else telefono_fijo
            
            calle = paciente_data.get("ficCalle") or ""
            nro = paciente_data.get("ficNro") or ""
            localidad = paciente_data.get("locNombre") or ""
            direccion = f"{calle} {nro} {localidad}".strip()
            
            fecha_nac = paciente_data.get("ficFechanac") or paciente_data.get("fechaNacimiento")
            if fecha_nac and "T" in str(fecha_nac):
                fecha_nac = str(fecha_nac).split("T")[0]

            normalizado = {
                "encontrado": True,
                "ficha_id": paciente_data.get("fichaId") or ficha_id,
                "nombre": nombre,
                "apellido": apellido,
                "nombre_completo": nombre_completo,
                "dni": str(paciente_data.get("ficNrodoc") or paciente_data.get("nroDoc") or "").strip(),
                "nro_hc": str(paciente_data.get("ficHistoriac") or paciente_data.get("nroHc") or "").strip(),
                "telefono": telefono_principal,
                "celular": celular,
                "telefono_fijo": telefono_fijo,
                "email": (paciente_data.get("ficEmail") or paciente_data.get("email") or "").strip(),
                "fecha_nacimiento": fecha_nac,
                "sexo": paciente_data.get("ficSexo") or paciente_data.get("sexo"),
                "obra_social": obra_social_nombre,
                "plan_cobertura": plan_nombre,
                "direccion": direccion,
                "raw": paciente_data
            }
            return normalizado

        except Exception as e:
            logger.error(f"Error al obtener ficha {ficha_id}: {e}")
            return {"encontrado": False, "error": str(e)}

    def buscar_paciente_por_dni(self, dni: str) -> dict:
        """
        Busca al paciente por número de DNI y retorna su ficha normalizada y completa.
        Ruta: GET /api/Pacientes/Documento/{documento}
        """
        dni_limpio = "".join(filter(str.isdigit, str(dni)))
        if not dni_limpio:
            return {"encontrado": False, "mensaje": "Número de DNI no válido."}

        url = f"{self.base_url}/api/Pacientes/Documento/{dni_limpio}"
        t_start = time.time()
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, headers=headers, timeout=10)
            duracion = int((time.time() - t_start) * 1000)
            
            if response.status_code == 404:
                log_event(
                    nivel="WARNING",
                    modulo="GECLISA",
                    accion="PACIENTE_NO_ENCONTRADO_DNI",
                    mensaje=f"DNI {dni_limpio} no encontrado en padrón de Geclisa",
                    detalles={"dni": dni_limpio, "endpoint": url},
                    duracion_ms=duracion,
                    http_status=404
                )
                return {"encontrado": False, "mensaje": f"No se encontró paciente con DNI {dni_limpio} en Geclisa."}
                
            response.raise_for_status()
            data = response.json()
            
            # Si el endpoint devuelve una lista o un objeto paginado { data: [...] }
            if isinstance(data, list):
                if len(data) == 0:
                    log_event(
                        nivel="WARNING",
                        modulo="GECLISA",
                        accion="PACIENTE_NO_ENCONTRADO_DNI",
                        mensaje=f"DNI {dni_limpio} devolvió lista vacía en Geclisa",
                        detalles={"dni": dni_limpio},
                        duracion_ms=duracion,
                        http_status=200
                    )
                    return {"encontrado": False, "mensaje": f"No se encontró paciente con DNI {dni_limpio} en Geclisa."}
                paciente_item = data[0]
            elif isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                if len(data["data"]) == 0:
                    log_event(
                        nivel="WARNING",
                        modulo="GECLISA",
                        accion="PACIENTE_NO_ENCONTRADO_DNI",
                        mensaje=f"DNI {dni_limpio} devolvió data[] vacío en Geclisa",
                        detalles={"dni": dni_limpio},
                        duracion_ms=duracion,
                        http_status=200
                    )
                    return {"encontrado": False, "mensaje": f"No se encontró paciente con DNI {dni_limpio} en Geclisa."}
                paciente_item = data["data"][0]
            else:
                paciente_item = data

            # Extraer fichaId para intentar enriquecer ficha completa de forma segura
            ficha_id = paciente_item.get("fichaId") or paciente_item.get("id") or paciente_item.get("ficId")
            if ficha_id:
                try:
                    ficha_completa = self.obtener_ficha_completa(int(ficha_id))
                    if ficha_completa.get("encontrado"):
                        if not ficha_completa.get("dni"):
                            ficha_completa["dni"] = str(paciente_item.get("ficNrodoc") or dni_limpio)
                        log_event(
                            nivel="INFO",
                            modulo="GECLISA",
                            accion="PACIENTE_ENCONTRADO_DNI",
                            mensaje=f"Paciente '{ficha_completa.get('nombre_completo')}' (DNI {dni_limpio}) encontrado en Geclisa (Ficha #{ficha_id})",
                            detalles={"dni": dni_limpio, "ficha_id": ficha_id, "nombre": ficha_completa.get("nombre_completo"), "obra_social": ficha_completa.get("obra_social")},
                            duracion_ms=duracion,
                            http_status=200
                        )
                        return ficha_completa
                except Exception as enrich_err:
                    logger.warning(f"No se pudo enriquecer ficha completa #{ficha_id} ({enrich_err}), usando datos básicos.")
            
            # Si no vino fichaId o falló la ficha detallada, normalizar el paciente_item directamente
            nombre = paciente_item.get("ficNombre") or paciente_item.get("nombre") or ""
            apellido = paciente_item.get("ficApellido") or paciente_item.get("ficApe") or paciente_item.get("apellido") or ""
            nombre_completo = paciente_item.get("ficNombreApe") or f"{apellido}, {nombre}".strip(" ,")

            res_paciente = {
                "encontrado": True,
                "ficha_id": ficha_id,
                "nombre": nombre,
                "apellido": apellido,
                "nombre_completo": nombre_completo,
                "dni": str(paciente_item.get("ficNrodoc") or paciente_item.get("nroDoc") or dni_limpio),
                "nro_hc": str(paciente_item.get("nroHc") or paciente_item.get("ficHistoriac") or ""),
                "telefono": paciente_item.get("celular") or paciente_item.get("telefono") or "",
                "celular": paciente_item.get("celular") or "",
                "telefono_fijo": paciente_item.get("telefono") or "",
                "email": paciente_item.get("email") or paciente_item.get("ficEmail") or "",
                "fecha_nacimiento": paciente_item.get("fechaNacimiento"),
                "sexo": paciente_item.get("sexo"),
                "obra_social": None,
                "plan_cobertura": None,
                "direccion": f"{paciente_item.get('ficCalle', '')} {paciente_item.get('ficNro', '')} {paciente_item.get('locNombre', '')}".strip(),
                "raw": paciente_item
            }
            log_event(
                nivel="INFO",
                modulo="GECLISA",
                accion="PACIENTE_ENCONTRADO_DNI",
                mensaje=f"Paciente '{nombre_completo}' (DNI {dni_limpio}) encontrado en Geclisa",
                detalles={"dni": dni_limpio, "ficha_id": ficha_id, "nombre": nombre_completo},
                duracion_ms=duracion,
                http_status=200
            )
            return res_paciente
        except Exception as e:
            duracion = int((time.time() - t_start) * 1000)
            log_event(
                nivel="ERROR",
                modulo="GECLISA",
                accion="ERROR_BUSQUEDA_DNI",
                mensaje=f"Error consultando DNI {dni_limpio} en Geclisa: {str(e)}",
                detalles={"dni": dni_limpio, "endpoint": url, "error": str(e)},
                duracion_ms=duracion
            )
            logger.error(f"Error al buscar paciente por DNI {dni_limpio}: {e}")
            return {"encontrado": False, "error": str(e)}

    def buscar_paciente_por_ficha(self, ficha_id: int) -> dict:
        """
        Busca al paciente directamente por su ID de Ficha en Geclisa.
        """
        return self.obtener_ficha_completa(ficha_id)

    def buscar_prestadores(self, query: str = "") -> list:
        """
        Busca prestadores médicos en Geclisa por nombre, apellido o matrícula.
        Operación estrictamente a demanda y de lectura.
        Ruta primaria: GET /api/Prestadores/SimplePorFiltro?filtro={query}
        Fallback: GET /api/Prestadores/por-matricula-nombre?query={query}
        """
        termino = (query or "").strip()
        headers = self._get_headers()
        items = []

        try:
            # 1. Intentar con SimplePorFiltro (robusto, no falla con término vacío)
            url_simple = f"{self.base_url}/api/Prestadores/SimplePorFiltro"
            params_simple = {"filtro": termino} if termino else {}
            resp_simple = self._do_request("GET", url_simple, headers=headers, params=params_simple, timeout=10)
            
            if resp_simple.status_code == 200:
                data = resp_simple.json()
                items = data if isinstance(data, list) else data.get("data", [])

            # 2. Si no hubo resultados y hay término, intentar con por-matricula-nombre
            if not items and termino:
                url_mn = f"{self.base_url}/api/Prestadores/por-matricula-nombre"
                resp_mn = self._do_request("GET", url_mn, headers=headers, params={"query": termino}, timeout=10)
                if resp_mn.status_code == 200:
                    data_mn = resp_mn.json()
                    items = data_mn if isinstance(data_mn, list) else data_mn.get("data", [])

            # 3. Si aún no hay resultados y hay término, obtener catálogo completo y filtrar en memoria por nombre o matrícula
            if not items and termino:
                resp_all = self._do_request("GET", url_simple, headers=headers, params={}, timeout=10)
                if resp_all.status_code == 200:
                    data_all = resp_all.json()
                    items_all = data_all if isinstance(data_all, list) else data_all.get("data", [])
                    t_lower = termino.lower()
                    for item in items_all:
                        pre_nom = (item.get("preNom") or item.get("nombre") or "").strip()
                        pre_mat = str(item.get("preMatp") or item.get("matp") or "").strip()
                        if t_lower in pre_nom.lower() or (pre_mat and t_lower in pre_mat.lower()):
                            items.append(item)

            prestadores_normalizados = []
            for item in items:
                pre_id = item.get("preId") or item.get("id")
                if not pre_id:
                    continue
                
                nombre = (item.get("preNom") or item.get("nombre") or "").strip()
                matricula = str(item.get("preMatp") or item.get("matp") or "").strip()
                profesion = (item.get("profesion") or item.get("profNombre") or item.get("preEsp") or "").strip()
                
                prestadores_normalizados.append({
                    "pre_id": int(pre_id),
                    "nombre": nombre,
                    "matricula": matricula if matricula and matricula != "None" else None,
                    "especialidad": profesion if profesion else "Médico General",
                    "np_id": item.get("npId", 0),
                    "cant_max_turnos": item.get("cantMaxEntreTurPre")
                })

            # Si el usuario ingresó un término de búsqueda, garantizar que la lista devuelta contenga la coincidencia
            if termino:
                t_clean = termino.lower()
                prestadores_normalizados = [
                    p for p in prestadores_normalizados
                    if t_clean in p["nombre"].lower() or (p.get("matricula") and t_clean in str(p["matricula"]).lower())
                ]

            return prestadores_normalizados

        except Exception as e:
            logger.error(f"Error al buscar prestadores con término '{termino}': {e}")
            return []


    def obtener_prestador_por_id(self, pre_id: int) -> dict:
        """
        Obtiene los datos detallados de un prestador por su ID en Geclisa.
        Ruta: GET /api/Prestadores/por-id/{preId}
        """
        url = f"{self.base_url}/api/Prestadores/por-id/{pre_id}"
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            if not data:
                return {"encontrado": False}
            
            item = data[0] if isinstance(data, list) and len(data) > 0 else data if isinstance(data, dict) else {}
            if not item:
                return {"encontrado": False}

            return {
                "encontrado": True,
                "pre_id": item.get("preId"),
                "nombre": (item.get("preNom") or item.get("nombre") or "").strip(),
                "matricula": str(item.get("preMatp") or item.get("matp") or "").strip(),
                "especialidad": (item.get("profesion") or item.get("preEsp") or "").strip()
            }
        except Exception as e:
            logger.error(f"Error al obtener prestador por ID {pre_id}: {e}")
            return {"encontrado": False, "error": str(e)}

    def listar_areas(self) -> list:
        """
        Obtiene el catálogo de áreas médicas de la clínica (Taxonomy).
        Ruta: GET /api/Areas/ListarAreas
        """
        url = f"{self.base_url}/api/Areas/ListarAreas"
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error en listar_areas: {e}")
            return []

    def buscar_turnos_disponibles(self, especialidad_id: int, rango_dias: int = 7) -> dict:
        """
        Consulta la agenda de turnos disponibles de lectura para una especialidad.
        Nota: Aunque el protocolo HTTP de este endpoint de consulta es POST,
        se trata de una operación estrictamente de lectura (no modifica datos).
        Ruta: POST /api/Cronogramas/turnos-disponibles
        """
        url = f"{self.base_url}/api/Cronogramas/turnos-disponibles"
        
        # Parámetros del filtro
        # En producción esto debería recibir parámetros flexibles
        from datetime import datetime, timedelta
        fecha_inicio = datetime.utcnow().strftime("%Y-%m-%dT00:00:00Z")
        fecha_fin = (datetime.utcnow() + timedelta(days=rango_dias)).strftime("%Y-%m-%dT23:59:59Z")
        
        payload = {
            "servId": especialidad_id,
            "fechaDesde": fecha_inicio,
            "fechaHasta": fecha_fin
        }
        
        try:
            headers = self._get_headers()
            # El endpoint de turnos-disponibles espera un JSON como payload
            response = self._do_request("POST", url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error al buscar turnos en Geclisa: {e}")
            return {"error": str(e)}

    def obtener_turnos_pendientes_ficha(self, ficha_id: int) -> dict:
        """
        Consulta los turnos asignados/pendientes de un paciente en Geclisa por fichaId.
        Ruta: GET /api/Turnos/pendientes/{fichaId}
        """
        url = f"{self.base_url}/api/Turnos/pendientes/{ficha_id}"
        t_start = time.time()
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, headers=headers, timeout=15)
            duracion = int((time.time() - t_start) * 1000)
            response.raise_for_status()
            res_json = response.json()
            
            # Formatear la lista de turnos según venga dict o array
            raw_turnos = res_json.get("data") if isinstance(res_json, dict) else (res_json if isinstance(res_json, list) else [])
            
            turnos_normalizados = []
            for t in raw_turnos:
                # Mapear campos exactos devueltos por Geclisa
                es_cancelado = bool(t.get("cancelado"))
                es_confirmado = bool(t.get("confirmado"))
                estado_calculado = "Cancelado" if es_cancelado else ("Confirmado" if es_confirmado else (t.get("estadoNombre") or t.get("estado") or "Pendiente"))

                especialidad_str = t.get("nombrePractica") or t.get("practica") or t.get("servicioNombre") or t.get("servNombre") or "Consulta Médica"
                profesional_str = t.get("nombrePrestador") or t.get("profNombre") or t.get("profesional") or t.get("medico")
                consultorio_str = t.get("nombreConsultorio") or t.get("consultorio") or t.get("consNombre") or "CREO Mendoza"

                turnos_normalizados.append({
                    "id": t.get("turnoId") or t.get("turId") or t.get("id"),
                    "fecha_hora": t.get("fecha") or t.get("turFechaHora") or t.get("fechaHora"),
                    "profesional_nombre": profesional_str,
                    "especialidad": especialidad_str,
                    "estado": estado_calculado,
                    "consultorio": consultorio_str,
                    "observaciones": t.get("observaciones") or t.get("turObs") or t.get("obs") or "",
                    "sobreturno": bool(t.get("esSobreturno") or t.get("sobreturno")),
                    "practica": t.get("practica") or t.get("nombrePractica") or "",
                    "obra_social_plan": t.get("osPlan") or "",
                    "raw": t
                })
                
            log_event(
                nivel="INFO",
                modulo="GECLISA",
                accion="TURNOS_PENDIENTES_FICHA",
                mensaje=f"Consultados {len(turnos_normalizados)} turnos pendientes para fichaId {ficha_id}",
                detalles={"ficha_id": ficha_id, "cantidad": len(turnos_normalizados)},
                duracion_ms=duracion,
                http_status=response.status_code
            )
            return {"success": True, "turnos": turnos_normalizados, "raw": res_json}
        except Exception as e:
            duracion = int((time.time() - t_start) * 1000)
            logger.error(f"Error consultando turnos pendientes en Geclisa para fichaId {ficha_id}: {e}")
            log_event(
                nivel="ERROR",
                modulo="GECLISA",
                accion="TURNOS_PENDIENTES_FICHA_ERROR",
                mensaje=f"Error consultando turnos pendientes: {e}",
                detalles={"ficha_id": ficha_id, "error": str(e)},
                duracion_ms=duracion
            )
            return {"success": False, "turnos": [], "error": str(e)}

    # ====================================================================
    # MÉTODOS DE NOMENCLADOR Y VALORIZACIÓN (PRESUPUESTOS)
    # ====================================================================

    def obtener_tipos_nomenclador(self) -> list:
        """
        Consulta los tipos de nomenclador disponibles en Geclisa (Prestaciones Médicas, Bioquímicas, NBU, Creo).
        Ruta: GET /api/Nomenclador/tipos
        """
        url = f"{self.base_url}/api/Nomenclador/tipos"
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error al obtener tipos de nomenclador en Geclisa: {e}")
            return []

    def buscar_practicas_geclisa(self, search_string: str = "", nom_id: int = None) -> list:
        """
        Busca prácticas en el Nomenclador de Geclisa por código o texto descriptivo.
        Ruta: GET /api/Nomenclador/practicaByTipo
        """
        url = f"{self.base_url}/api/Nomenclador/practicaByTipo"
        params = {}
        if search_string:
            params["searchString"] = search_string.strip()
        if nom_id:
            params["nomId"] = nom_id

        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, params=params, headers=headers, timeout=12)
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                return data.get("data", [])
            elif isinstance(data, list):
                return data
            return []
        except Exception as e:
            logger.error(f"Error al buscar prácticas en Nomenclador Geclisa: {e}")
            return []

    def obtener_conceptos_practica(self, nom_cod: str, nom_id: int, serv_id: int = 1, area: str = "A") -> list:
        """
        Consulta los conceptos de desglose (honorarios, gastos, etc.) de una práctica.
        Ruta: GET /api/Nomenclador/practica/conceptos
        """
        url = f"{self.base_url}/api/Nomenclador/practica/conceptos"
        params = {
            "nomCod": nom_cod,
            "nomId": nom_id,
            "servId": serv_id,
            "area": area
        }
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, params=params, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            logger.error(f"Error al obtener conceptos de práctica {nom_cod}: {e}")
            return []

    def valorizar_practica_particular(
        self,
        nom_id: int,
        nom_cod: str,
        os_id: int = 8118,
        plan_id: int = 215,
        cantidad: int = 1,
        area: str = "A"
    ) -> dict:
        """
        Calcula el valor vigente oficial de una práctica médica en Geclisa para la Obra Social PARTICULAR.
        Ruta: POST /api/Presupuestos/valorizar-practica
        """
        url = f"{self.base_url}/api/Presupuestos/valorizar-practica"
        payload = {
            "presPacienteEncaId": 1, # ID de cabecera de referencia para pa_ValorizaModulo
            "cantidad": cantidad,
            "nomId": nom_id,
            "nomCod": str(nom_cod),
            "osId": os_id,
            "planId": plan_id,
            "prestadores": [],
            "area": area
        }
        try:
            headers = self._get_headers()
            response = self._do_request("POST", url, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                total = data.get("total") or data.get("totalUnitario") or 0.0
                return {
                    "exito": True,
                    "total": float(total),
                    "coseguro_neto": float(data.get("coseguroNeto") or 0.0),
                    "coseguro_iva": float(data.get("coseguroIva") or 0.0),
                    "iva_porc": float(data.get("ivaPorc") or 0.0),
                    "honorarios": float(data.get("coseguroNetoHonorarios") or 0.0),
                    "gastos": float(data.get("coseguroNetoGastos") or 0.0),
                    "raw": data
                }
            else:
                err_data = response.json() if response.text else {}
                err_msg = err_data.get("error", [f"HTTP {response.status_code}"])[0] if isinstance(err_data.get("error"), list) else str(err_data)
                return {
                    "exito": False,
                    "total": 0.0,
                    "mensaje": f"No valorizado en Geclisa: {err_msg}"
                }
        except Exception as e:
            logger.error(f"Error al valorizar práctica {nom_cod} en Geclisa: {e}")
            return {
                "exito": False,
                "total": 0.0,
                "mensaje": str(e)
            }

    # ====================================================================
    # HISTORIA CLÍNICA (LECTURA ON-DEMAND)
    # ====================================================================

    def obtener_historia_clinica_resumen(self, ficha_id: int) -> dict:
        """
        Consulta en vivo el resumen de Historia Clínica de un paciente en Geclisa.
        Ruta: GET /api/HistoriaClinicaResumen/{pacienteId}
        """
        if not ficha_id:
            return {"encontrado": False, "mensaje": "Ficha ID no proporcionada."}

        url = f"{self.base_url}/api/HistoriaClinicaResumen/{ficha_id}"
        try:
            headers = self._get_headers()
            response = self._do_request("GET", url, headers=headers, timeout=12)
            
            if response.status_code == 404:
                return {
                    "encontrado": False,
                    "mensaje": f"No se encontró historia clínica para la Ficha #{ficha_id} en Geclisa."
                }
                
            response.raise_for_status()
            data = response.json()
            
            # Normalizar evoluciones recientes
            raw_evoluciones = data.get("evolucionesRecientes") or []
            evoluciones_normalizadas = []
            for ev in raw_evoluciones:
                evoluciones_normalizadas.append({
                    "hc_id": ev.get("hcId"),
                    "fecha": ev.get("fecha") or "",
                    "fecha_hora": ev.get("fechaDateTime") or "",
                    "hora": ev.get("hora") or "",
                    "prestador": (ev.get("prestador") or "").strip(),
                    "especialidad": (ev.get("especialidad") or "").strip(),
                    "area": ev.get("area") or "",
                    "texto": (ev.get("texto") or "").strip(),
                    "nombre_plantilla": (ev.get("nombrePlantilla") or "").strip()
                })

            return {
                "encontrado": True,
                "ficha_id": ficha_id,
                "fecha_generacion": data.get("fechaGeneracion"),
                "evoluciones_recientes": evoluciones_normalizadas,
                "total_evoluciones": len(evoluciones_normalizadas),
                "raw": data
            }

        except Exception as e:
            logger.error(f"Error al consultar HistoriaClinicaResumen para ficha {ficha_id}: {e}")
            return {
                "encontrado": False,
                "error": str(e),
                "mensaje": f"No se pudo consultar la historia clínica en Geclisa: {str(e)}"
            }

    def obtener_indicaciones_medicas(self, ficha_id: int) -> dict:
        """
        Consulta en vivo todas las indicaciones médicas, protocolos de medicación y recetas
        asociadas a la ficha del paciente en Geclisa.
        Operación 100% de lectura (no escribe nada en Geclisa).
        """
        if not ficha_id:
            return {"encontrado": False, "mensaje": "Ficha ID no proporcionada."}

        indicaciones_unificadas = []
        headers = self._get_headers()

        # 1. Consultar Indicaciones Médicas directas por Ficha
        try:
            url_ind = f"{self.base_url}/api/IndicacionesMedicas/ficha"
            resp_ind = self._do_request("POST", url_ind, headers=headers, json={"id": ficha_id}, timeout=10)
            if resp_ind.status_code == 200:
                raw_ind = resp_ind.json()
                items_ind = raw_ind if isinstance(raw_ind, list) else []
                for item in items_ind:
                    indicaciones_unificadas.append({
                        "id": item.get("imId") or item.get("id"),
                        "tipo": "INDICACION",
                        "tipo_label": "Indicación Médica",
                        "fecha": item.get("fecha") or item.get("imFecha") or "",
                        "hora": item.get("hora") or "",
                        "prestador": (item.get("prestador") or item.get("preNom") or "").strip(),
                        "especialidad": (item.get("especialidad") or item.get("profNombre") or "").strip(),
                        "titulo": item.get("imTitulo") or item.get("titulo") or "Indicación Clínica",
                        "texto": (item.get("imTexto") or item.get("texto") or "").strip(),
                        "plantilla": item.get("pimNombre") or ""
                    })
        except Exception as e_ind:
            logger.warning(f"Aviso al consultar IndicacionesMedicas/ficha para {ficha_id}: {e_ind}")

        # 2. Consultar Protocolos / Plantillas de Medicación desde HistoriaClinicaResumen
        try:
            url_hc = f"{self.base_url}/api/HistoriaClinicaResumen/{ficha_id}"
            resp_hc = self._do_request("GET", url_hc, headers=headers, timeout=10)
            if resp_hc.status_code == 200:
                data_hc = resp_hc.json()
                
                # Protocolos de medicación y esquemas
                protocolos = data_hc.get("protocolosQuirurgicosAnestesicos") or []
                for prot in protocolos:
                    titulo = prot.get("nombrePlantilla") or "Protocolo de Medicación"
                    indicaciones_unificadas.append({
                        "id": prot.get("hcId"),
                        "tipo": "MEDICACION_PROTOCOLO",
                        "tipo_label": "Protocolo / Medicación",
                        "fecha": prot.get("fecha") or "",
                        "hora": prot.get("hora") or "",
                        "prestador": (prot.get("prestador") or "").strip(),
                        "especialidad": (prot.get("especialidad") or "").strip(),
                        "titulo": titulo,
                        "texto": (prot.get("texto") or "").strip(),
                        "plantilla": prot.get("nombrePlantilla") or ""
                    })

                # Medicación activa declarada
                med_activa = data_hc.get("medicacionActiva") or []
                for med in med_activa:
                    indicaciones_unificadas.append({
                        "id": med.get("id"),
                        "tipo": "MEDICACION_ACTIVA",
                        "tipo_label": "Medicación Activa",
                        "fecha": med.get("fecha") or "",
                        "hora": "",
                        "prestador": (med.get("prestador") or "").strip(),
                        "especialidad": "",
                        "titulo": med.get("medicamento") or med.get("droga") or "Fármaco Activo",
                        "texto": f"Dosis: {med.get('dosis', '')} - Frecuencia: {med.get('frecuencia', '')}".strip(" -"),
                        "plantilla": ""
                    })
        except Exception as e_hc:
            logger.warning(f"Aviso al consultar protocolos de medicación para {ficha_id}: {e_hc}")

        # 3. Consultar Recetas
        try:
            url_rec = f"{self.base_url}/api/Recetas/filtrar"
            payload_rec = {
                "fichaId": ficha_id,
                "fechaInicio": "2020-01-01T00:00:00.000Z",
                "fechaFin": "2030-12-31T23:59:59.000Z"
            }
            resp_rec = self._do_request("POST", url_rec, headers=headers, json=payload_rec, timeout=10)
            if resp_rec.status_code == 200:
                raw_rec = resp_rec.json()
                items_rec = raw_rec if isinstance(raw_rec, list) else []
                for rec in items_rec:
                    indicaciones_unificadas.append({
                        "id": rec.get("recEncaId") or rec.get("id"),
                        "tipo": "RECETA",
                        "tipo_label": "Receta Médica",
                        "fecha": rec.get("recFecha") or rec.get("fecha") or "",
                        "hora": "",
                        "prestador": (rec.get("preNom") or rec.get("prestador") or "").strip(),
                        "especialidad": "",
                        "titulo": f"Receta #{rec.get('recNumero') or rec.get('recEncaId', '')}".strip(),
                        "texto": (rec.get("recObservaciones") or rec.get("diagnostico") or "Prescripción de medicamentos").strip(),
                        "plantilla": ""
                    })
        except Exception as e_rec:
            logger.warning(f"Aviso al consultar recetas para {ficha_id}: {e_rec}")

        return {
            "encontrado": True,
            "ficha_id": ficha_id,
            "indicaciones": indicaciones_unificadas,
            "total_indicaciones": len(indicaciones_unificadas)
        }

    # ====================================================================
    # NOMENCLADORES Y PRÁCTICAS MÉDICAS (CENTRO VISIÓN / GECLISA)
    # ====================================================================
    def obtener_tipos_nomenclador(self) -> List[Dict[str, Any]]:
        """
        Obtiene los tipos de nomencladores disponibles en Geclisa (GET /api/Nomenclador/tipos).
        Retorna lista de objetos: [{ "nomId": 1, "nomNom": "Prestaciones Oftalmológicas" }, ...]
        """
        token = self._obtener_token()
        url = f"{self.base_url}/api/Nomenclador/tipos"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        
        t_start = time.time()
        try:
            res = self._do_request("GET", url, headers=headers, timeout=12)
            duracion = int((time.time() - t_start) * 1000)
            res.raise_for_status()
            tipos = res.json() or []
            return tipos
        except Exception as e:
            duracion = int((time.time() - t_start) * 1000)
            logger.error(f"Error al consultar tipos de nomenclador en Geclisa: {e}")
            log_event(
                nivel="ERROR",
                modulo="GECLISA",
                accion="NOMENCLADOR_TIPOS",
                mensaje=f"Error consultando tipos de nomenclador: {e}",
                duracion_ms=duracion
            )
            return []

    def buscar_practicas_nomenclador(self, nom_id: Optional[int] = None, search_string: str = "") -> List[Dict[str, Any]]:
        """
        Busca prácticas en vivo dentro del nomenclador de Geclisa (GET /api/Nomenclador/practicaByTipo).
        Retorna lista de prácticas con nomCod, nombre, tipo, etc.
        """
        token = self._obtener_token()
        params = {}
        if nom_id:
            params["nomId"] = nom_id
        if search_string:
            params["searchString"] = search_string.strip()
            
        url = f"{self.base_url}/api/Nomenclador/practicaByTipo"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        
        t_start = time.time()
        try:
            res = self._do_request("GET", url, headers=headers, params=params, timeout=15)
            duracion = int((time.time() - t_start) * 1000)
            res.raise_for_status()
            data = res.json()
            
            # Geclisa devuelve un dict con {"data": [...], "totalItems": N} o directamente una lista
            if isinstance(data, dict):
                return data.get("data") or []
            elif isinstance(data, list):
                return data
            return []
        except Exception as e:
            duracion = int((time.time() - t_start) * 1000)
            logger.error(f"Error al buscar prácticas en Geclisa ({nom_id}, '{search_string}'): {e}")
            log_event(
                nivel="ERROR",
                modulo="GECLISA",
                accion="NOMENCLADOR_BUSCAR",
                mensaje=f"Error buscando prácticas en nomenclador {nom_id}: {e}",
                detalles={"nomId": nom_id, "search": search_string},
                duracion_ms=duracion
            )
    # ====================================================================
    # GESTIÓN DOCUMENTAL Y ARCHIVOS (HISTORIA CLÍNICA)
    # ====================================================================

    def adjuntar_archivo_historia_clinica(
        self,
        ficha_id: int,
        file_bytes: bytes,
        filename: str,
        titulo: str,
        observaciones: str = "",
        pre_id: Optional[int] = None,
        me_id: Optional[int] = None,
        turno_id: Optional[int] = None,
        clase_id: int = 1,
        fecha_iso: Optional[str] = None,
        hora: Optional[int] = None
    ) -> dict:
        """
        Sube un archivo PDF o imagen a la historia clínica del paciente en Geclisa.
        Ruta: POST /api/Archivo/adjuntar-archivo-historia-clinica (multipart/form-data)
        """
        token = self._obtener_token()
        url = f"{self.base_url}/api/Archivo/adjuntar-archivo-historia-clinica"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        from datetime import datetime, timezone, timedelta
        # Zona horaria Argentina/Mendoza (UTC-3)
        tz_mza = timezone(timedelta(hours=-3))
        now_mza = datetime.now(tz_mza)
        hoy_str = now_mza.strftime("%Y-%m-%d")
        
        if fecha_iso:
            fecha_parte = fecha_iso.split("T")[0]
            if fecha_parte > hoy_str:
                fecha_parte = hoy_str
        else:
            fecha_parte = hoy_str
            
        fecha_str = f"{fecha_parte}T00:00:00"
        
        # Calcular hora entera en formato HHmm (ej: 09:20 -> 920, 14:35 -> 1435)
        if hora is not None:
            hora_int = int(hora)
        else:
            hora_int = now_mza.hour * 100 + now_mza.minute
        
        import unicodedata, re
        def _clean_str(s: str, max_len: int = 45) -> str:
            if not s:
                return ""
            nfkd = unicodedata.normalize('NFKD', str(s))
            ascii_text = "".join([c for c in nfkd if not unicodedata.combining(c)])
            # Eliminar caracteres prohibidos en rutas de archivos Windows (\ / : * ? " < > |)
            sanitized = re.sub(r'[^a-zA-Z0-9 \-_().,]', ' ', ascii_text)
            sanitized = re.sub(r'\s+', ' ', sanitized).strip()
            return sanitized[:max_len]

        titulo_limpio = _clean_str(titulo or filename, 45)
        obs_limpia = _clean_str(observaciones or "", 100)
        fn_limpio = _clean_str(filename, 45)
        if not fn_limpio.lower().endswith(".pdf") and filename.lower().endswith(".pdf"):
            fn_limpio += ".pdf"
            
        content_type = "application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream"
        files = {
            "Archivo": (fn_limpio, file_bytes, content_type)
        }
        data = {
            "FichaId": str(int(ficha_id)),
            "Fecha": fecha_str,
            "Hora": str(hora_int),
            "Titulo": titulo_limpio,
            "Observaciones": obs_limpia,
            "ClaseId": str(int(clase_id)),
            "AmId": "1"
        }
        if pre_id:
            data["PreId"] = str(int(pre_id))
        if me_id:
            data["MeId"] = str(int(me_id))
        if turno_id:
            data["TurnoId"] = str(int(turno_id))
            
        t_start = time.time()
        try:
            res = self._do_request("POST", url, headers=headers, data=data, files=files, timeout=30)
            duracion = int((time.time() - t_start) * 1000)
            res.raise_for_status()
            res_data = res.json() if res.content else {}
            
            archivo_id = None
            as_id = None
            if isinstance(res_data, dict):
                archivo_id = res_data.get("hcaId") or res_data.get("id")
                as_id = res_data.get("asId")
            elif isinstance(res_data, int) and not isinstance(res_data, bool):
                archivo_id = res_data
                
            # Si no devolvió ID explícito o vino bool True, buscar el archivo recién subido en la historia clínica
            if not archivo_id or not as_id or isinstance(archivo_id, bool):
                try:
                    archivos_recientes = sorted(
                        self.listar_archivos_historia_clinica(ficha_id),
                        key=lambda x: int(x.get("asId") or x.get("id") or 0),
                        reverse=True
                    )
                    for a in archivos_recientes:
                        if a.get("titulo") == titulo_limpio or a.get("titulo") == (titulo or filename).strip():
                            archivo_id = a.get("id")
                            as_id = a.get("asId")
                            break
                except Exception:
                    pass
                
            final_id = as_id or archivo_id
            log_event(
                nivel="INFO",
                modulo="GECLISA",
                accion="ADJUNTAR_DOCUMENTO_HC",
                mensaje=f"Documento '{titulo}' adjuntado con éxito a Ficha #{ficha_id} en Geclisa",
                detalles={"ficha_id": ficha_id, "titulo": titulo, "archivo_id": final_id, "as_id": as_id, "filename": filename},
                duracion_ms=duracion,
                http_status=res.status_code
            )
            return {
                "success": True,
                "mensaje": "Documento adjuntado exitosamente en Geclisa.",
                "archivo_id": final_id,
                "as_id": as_id,
                "hca_id": archivo_id if not isinstance(archivo_id, bool) else None,
                "raw": res_data
            }
        except Exception as e:
            duracion = int((time.time() - t_start) * 1000)
            logger.error(f"Error al adjuntar archivo en Geclisa (Ficha #{ficha_id}): {e}")
            log_event(
                nivel="ERROR",
                modulo="GECLISA",
                accion="ERROR_ADJUNTAR_DOCUMENTO_HC",
                mensaje=f"Error adjuntando documento '{titulo}' en Geclisa (Ficha #{ficha_id}): {e}",
                detalles={"ficha_id": ficha_id, "titulo": titulo, "error": str(e)},
                duracion_ms=duracion
            )
            return {
                "success": False,
                "error": str(e)
            }

    def eliminar_archivo_historia_clinica(self, archivo_id: int, as_id: Optional[int] = None) -> dict:
        """
        Elimina un archivo adjunto del repositorio de Geclisa.
        Ruta primaria: DELETE /api/Archivo?asId={asId}
        Ruta secundaria: DELETE /api/Archivo/historia-clinica-archivo/{hcaId}
        """
        token = self._obtener_token()
        target_as_id = as_id or archivo_id
        url_as = f"{self.base_url}/api/Archivo?asId={target_as_id}"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        
        t_start = time.time()
        try:
            res = self._do_request("DELETE", url_as, headers=headers, timeout=15)
            if res.status_code == 200:
                duracion = int((time.time() - t_start) * 1000)
                log_event(
                    nivel="INFO",
                    modulo="GECLISA",
                    accion="ELIMINAR_DOCUMENTO_HC",
                    mensaje=f"Documento (asId #{target_as_id}) eliminado de Geclisa",
                    detalles={"asId": target_as_id},
                    duracion_ms=duracion,
                    http_status=res.status_code
                )
                return {"success": True, "mensaje": f"Archivo #{target_as_id} eliminado de Geclisa."}
        except Exception:
            pass
            
        # Fallback a historia-clinica-archivo
        try:
            url_hca = f"{self.base_url}/api/Archivo/historia-clinica-archivo/{archivo_id}"
            res = self._do_request("DELETE", url_hca, headers=headers, timeout=15)
            duracion = int((time.time() - t_start) * 1000)
            res.raise_for_status()
            return {"success": True, "mensaje": f"Archivo #{archivo_id} eliminado de Geclisa."}
        except Exception as e:
            duracion = int((time.time() - t_start) * 1000)
            logger.error(f"Error eliminando archivo #{archivo_id} en Geclisa: {e}")
            return {"success": False, "error": str(e)}

    def listar_archivos_historia_clinica(
        self,
        ficha_id: int,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        es_administrativo: bool = False
    ) -> list:
        """
        Lista los archivos y documentos adjuntos en la historia clínica del paciente en Geclisa.
        Ruta: POST /api/Archivo/historias-clinicas-archivos
        """
        token = self._obtener_token()
        url = f"{self.base_url}/api/Archivo/historias-clinicas-archivos"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json", "Content-Type": "application/json"}
        
        payload = {
            "fichaId": int(ficha_id),
            "fechaInicio": fecha_desde or "2000-01-01T00:00:00",
            "fechaFin": fecha_hasta or "2099-12-31T23:59:59",
            "esAdministrativo": es_administrativo,
            "hcProbIds": []
        }
        
        t_start = time.time()
        try:
            res = self._do_request("POST", url, headers=headers, json=payload, timeout=15)
            duracion = int((time.time() - t_start) * 1000)
            res.raise_for_status()
            data = res.json()
            items = data if isinstance(data, list) else data.get("data", [])
            return items
        except Exception as e:
            logger.error(f"Error listando archivos de historia clínica para Ficha #{ficha_id}: {e}")
            return []

    # ====================================================================
    # SCRIPT DE DIAGNÓSTICO E INICIALIZACIÓN
    # ====================================================================
    def test_read_connection(self) -> bool:
        """
        Realiza un chequeo rápido de lectura contra la API de Geclisa y reporta estado.
        """
        print(f"Probando conexion de lectura con: {self.base_url}")
        try:
            # 1. Obtener Token
            token = self._obtener_token()
            print("[OK] Autenticacion exitosa. Token obtenido.")
            
            # 2. Consultar Usuario
            user = self.obtener_usuario_actual()
            if "error" not in user:
                print(f"[OK] Acceso seguro verificado. Usuario: {user.get('nombre') or user.get('userName')}")
            else:
                print(f"[ERROR] Al consultar usuario actual: {user['error']}")
                return False
                
            # 3. Listar Áreas (Catálogo)
            areas = self.listar_areas()
            print(f"[OK] Catalogo de areas verificado. Encontradas: {len(areas)}")
            
            print("\n¡Configuracion inicial de Geclisa completada correctamente y activa!")
            return True
        except Exception as e:
            print(f"[ERROR] Fallo el chequeo de configuracion inicial de Geclisa: {e}")
            return False

# Instancia global reutilizable
geclisa_client = GeclisaClient()

# Código de ejecución si se corre el script directamente
if __name__ == "__main__":
    client = GeclisaClient()
    client.test_read_connection()

