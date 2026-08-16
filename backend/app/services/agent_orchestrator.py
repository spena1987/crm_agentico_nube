import time
import logging
from typing import Optional, Dict, List, Any
from app.db import supabase
from app.services.tools import buscar_disponibilidad_turnos, crear_borrador_presupuesto, escalar_a_operador_humano

logger = logging.getLogger(__name__)

# Mapa global de herramientas ejecutables por el SDK
AVAILABLE_TOOLS_MAP = {
    "buscar_disponibilidad_turnos": buscar_disponibilidad_turnos,
    "crear_borrador_presupuesto": crear_borrador_presupuesto,
    "escalar_a_operador_humano": escalar_a_operador_humano
}

# Fallbacks predeterminados en memoria por si Supabase no responde
DEFAULT_GLOBAL_DIRECTIVES = {
    "nombre_clinica": "Clínica Médica Nube",
    "tono_general": "Profesional, empático, claro y resolutivo en todo momento.",
    "guardrails_medicos": (
        "PROHIBICIÓN ESTRICTA: No des diagnósticos médicos, interpretaciones de síntomas ni prescripciones farmacológicas. "
        "Si el paciente consulta sobre síntomas o requiere atención médica urgente, explícale que lo derivarás con un profesional de la salud "
        "y utiliza la herramienta escalar_a_operador_humano."
    ),
    "politica_escalamiento": (
        "Si el paciente solicita hablar con un humano, presenta dudas clínicas complejas o expresa enojo/frustración, "
        "invoca de inmediato la herramienta escalar_a_operador_humano indicando el motivo."
    ),
    "politica_turnos": "Para turnos, ofrece un máximo de 2 opciones claras de fecha/horario y confirma nombre y DNI del paciente.",
    "politica_presupuestos": "Para cotizaciones, informa los valores con claridad, formas de pago disponibles y aclara la vigencia del presupuesto.",
    "agente_defecto_codigo": "GENERAL"
}

DEFAULT_AGENTS = {
    "GENERAL": {
        "codigo": "GENERAL",
        "nombre": "Asistente Administrativo General",
        "temperatura": 0.2,
        "directiva_particular": "Tu objetivo es brindar información general sobre la clínica, horarios de atención, ubicación y especialidades médicas disponibles. Responde de forma cordial y concisa.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "crear_borrador_presupuesto", "escalar_a_operador_humano"],
        "activo": True
    },
    "TURNOS_CONCRETOS": {
        "codigo": "TURNOS_CONCRETOS",
        "nombre": "Agente de Turnos Ágiles",
        "temperatura": 0.1,
        "directiva_particular": "El paciente busca resolver una cita médica de manera rápida y sin demoras. Sé sumamente concreto, directo y eficiente. Pregunta especialidad o médico deseado, busca disponibilidad con tu herramienta y ofrece máximo 2 opciones puntuales de días y horarios. Evita rodeos o textos largos.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "escalar_a_operador_humano"],
        "activo": True
    },
    "QUIRURGICO_EMPATICO": {
        "codigo": "QUIRURGICO_EMPATICO",
        "nombre": "Atención Quirúrgica y Alta Contención",
        "temperatura": 0.35,
        "directiva_particular": "Este paciente se encuentra en evaluación o proceso de un procedimiento quirúrgico. Su estado emocional suele requerir contención y serenidad. Trátalo con máxima calidez humana, empatía y paciencia. Utiliza frases de acompañamiento ('Entendemos tu consulta', 'Estamos para acompañarte en cada paso'). Explica los requisitos y consultas administrativas con calma y claridad.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "crear_borrador_presupuesto", "escalar_a_operador_humano"],
        "activo": True
    },
    "PRESUPUESTOS_COMERCIAL": {
        "codigo": "PRESUPUESTOS_COMERCIAL",
        "nombre": "Cotizaciones y Planes de Tratamiento",
        "temperatura": 0.2,
        "directiva_particular": "El paciente consulta por valores de prestaciones médicas, estudios o cirugías. Explica con claridad el desglose de los servicios solicitados, utiliza la herramienta crear_borrador_presupuesto para generar la cotización formal y menciona los medios de pago disponibles y vigencia del presupuesto.",
        "herramientas_habilitadas": ["crear_borrador_presupuesto", "escalar_a_operador_humano"],
        "activo": True
    },
    "POST_OPERATORIO": {
        "codigo": "POST_OPERATORIO",
        "nombre": "Seguimiento y Control Post-Quirúrgico",
        "temperatura": 0.2,
        "directiva_particular": "El paciente ha sido intervenido recientemente. Pregunta amablemente cómo se siente y cómo evoluciona. Si menciona síntomas de alarma (fiebre alta, sangrado abundante, dolor agudo intolerable), indícale con calma que lo derivarás de urgencia con el equipo médico y utiliza de inmediato escalar_a_operador_humano con motivo urgente.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "escalar_a_operador_humano"],
        "activo": True
    }
}

class AgentOrchestrator:
    _instance = None
    _cache_globales: Optional[Dict[str, Any]] = None
    _cache_agentes: Optional[Dict[str, Dict[str, Any]]] = None
    _last_cache_time: float = 0
    CACHE_TTL: float = 60.0  # 60 segundos de caché en memoria

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = AgentOrchestrator()
        return cls._instance

    def invalidate_cache(self):
        """Invalida la memoria caché para forzar recarga inmediata desde Supabase."""
        self._cache_globales = None
        self._cache_agentes = None
        self._last_cache_time = 0
        logger.info("Caché de AgentOrchestrator invalidada.")

    def get_global_directives(self) -> Dict[str, Any]:
        """Recupera las directivas globales desde Supabase o devuelve fallback."""
        now = time.time()
        if self._cache_globales and (now - self._last_cache_time < self.CACHE_TTL):
            return self._cache_globales

        if supabase:
            try:
                resp = supabase.table("agentes_directivas_globales").select("*").limit(1).execute()
                if resp.data and len(resp.data) > 0:
                    self._cache_globales = resp.data[0]
                    self._last_cache_time = now
                    return self._cache_globales
            except Exception as e:
                logger.warning(f"Error consultando agentes_directivas_globales en Supabase: {e}")

        return DEFAULT_GLOBAL_DIRECTIVES

    def get_all_agents(self) -> Dict[str, Dict[str, Any]]:
        """Recupera todos los agentes situacionales indexados por su código."""
        now = time.time()
        if self._cache_agentes and (now - self._last_cache_time < self.CACHE_TTL):
            return self._cache_agentes

        if supabase:
            try:
                resp = supabase.table("agentes_situacionales").select("*").order("orden").execute()
                if resp.data and len(resp.data) > 0:
                    agents_dict = {a["codigo"]: a for a in resp.data}
                    self._cache_agentes = agents_dict
                    self._last_cache_time = now
                    return self._cache_agentes
            except Exception as e:
                logger.warning(f"Error consultando agentes_situacionales en Supabase: {e}")

        return DEFAULT_AGENTS

    def get_agent_by_code(self, codigo: Optional[str]) -> Dict[str, Any]:
        """Obtiene un agente por su código o devuelve el agente por defecto."""
        agents = self.get_all_agents()
        if codigo and codigo in agents:
            return agents[codigo]
        
        globales = self.get_global_directives()
        def_code = globales.get("agente_defecto_codigo", "GENERAL")
        return agents.get(def_code, DEFAULT_AGENTS.get("GENERAL"))

    def determine_active_agent(
        self, 
        conversacion_id: Optional[str] = None, 
        paciente_id: Optional[str] = None, 
        mensaje_texto: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Determina qué agente situacional debe atender el mensaje según:
        1. Asignación manual explícita en la conversación (`conversaciones.agente_asignado_codigo`)
        2. Etapa clínica del paciente (`pacientes.etapa_clinica`)
        3. Detección automática por intención / palabras clave del mensaje
        4. Agente por defecto de la clínica
        """
        agents = self.get_all_agents()
        globales = self.get_global_directives()
        
        # 1. Chequear si la conversación tiene agente asignado
        if supabase and conversacion_id:
            try:
                c_resp = supabase.table("conversaciones").select("agente_asignado_codigo, paciente_id").eq("id", conversacion_id).execute()
                if c_resp.data and len(c_resp.data) > 0:
                    row = c_resp.data[0]
                    ag_code = row.get("agente_asignado_codigo")
                    if not paciente_id:
                        paciente_id = row.get("paciente_id")
                    if ag_code and ag_code != "AUTO" and ag_code in agents and agents[ag_code].get("activo", True):
                        logger.info(f"Agente seleccionado por asignación de conversación: {ag_code}")
                        return agents[ag_code]
            except Exception as e:
                logger.warning(f"Error evaluando conversación en router de agentes: {e}")

        # 2. Chequear etapa clínica del paciente
        if supabase and paciente_id:
            try:
                p_resp = supabase.table("pacientes").select("etapa_clinica, nombre, apellido").eq("id", paciente_id).execute()
                if p_resp.data and len(p_resp.data) > 0:
                    etapa = (p_resp.data[0].get("etapa_clinica") or "").upper()
                    if etapa in ["PRE_QUIRURGICO", "QUIRURGICO", "CIRUGIA"] and "QUIRURGICO_EMPATICO" in agents:
                        return agents["QUIRURGICO_EMPATICO"]
                    elif etapa in ["POST_OPERATORIO", "POST_QUIRURGICO", "RECUPERACION"] and "POST_OPERATORIO" in agents:
                        return agents["POST_OPERATORIO"]
            except Exception as e:
                logger.warning(f"Error evaluando paciente en router de agentes: {e}")

        # 3. Heurística rápida por intención del mensaje
        if mensaje_texto:
            txt_lower = mensaje_texto.lower()
            # Quirúrgico / Cirugía
            if any(w in txt_lower for w in ["cirug", "operaci", "quirofan", "prequirurg", "anestesia"]) and "QUIRURGICO_EMPATICO" in agents:
                return agents["QUIRURGICO_EMPATICO"]
            # Postoperatorio / Dolor / Control
            if any(w in txt_lower for w in ["me operaron", "postoperatorio", "post-quirurgico", "puntos", "herida", "curacion"]) and "POST_OPERATORIO" in agents:
                return agents["POST_OPERATORIO"]
            # Presupuestos / Precios / Cotizaciones
            if any(w in txt_lower for w in ["presupuesto", "cuanto sale", "precio", "costo", "arancel", "cotiz"]) and "PRESUPUESTOS_COMERCIAL" in agents:
                return agents["PRESUPUESTOS_COMERCIAL"]
            # Turnos rápidos
            if any(w in txt_lower for w in ["turno", "cita", "agendar", "disponibilidad", "horario"]) and "TURNOS_CONCRETOS" in agents:
                return agents["TURNOS_CONCRETOS"]

        # 4. Fallback al agente por defecto
        def_code = globales.get("agente_defecto_codigo", "GENERAL")
        return agents.get(def_code, DEFAULT_AGENTS.get("GENERAL"))

    def compile_system_prompt(
        self, 
        agent: Dict[str, Any], 
        paciente_info: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Ensambla dinámicamente las capas de Directivas (Prompt Layering):
        - Capa 1: Identidad y Políticas Generales de la Clínica
        - Capa 2: Guardrails y Restricciones Médicas Inviolables
        - Capa 3: Directiva Particular del Rol / Situación
        - Capa 4: Contexto Clínico del Paciente
        """
        globales = self.get_global_directives()
        
        nombre_clinica = globales.get("nombre_clinica", "Clínica Médica Nube")
        tono_general = globales.get("tono_general", "Profesional, empático, claro y resolutivo.")
        guardrails = globales.get("guardrails_medicos", "")
        politica_esc = globales.get("politica_escalamiento", "")
        politica_turnos = globales.get("politica_turnos", "")
        politica_presupuestos = globales.get("politica_presupuestos", "")
        
        nombre_agente = agent.get("nombre", "Asistente Médico")
        directiva_particular = agent.get("directiva_particular", "")

        prompt_parts = [
            f"Eres el Asistente Virtual Inteligente de '{nombre_clinica}'.",
            f"Estás actuando con el rol y personalidad: '{nombre_agente}'.",
            "",
            "=== DIRECTIVAS GENERALES DE LA CLÍNICA ===",
            f"- Tono institucional: {tono_general}",
            f"- Políticas de Turnos: {politica_turnos}" if politica_turnos else "",
            f"- Políticas de Presupuestos: {politica_presupuestos}" if politica_presupuestos else "",
            "",
            "=== GUARDRAILS Y REGLAS DE SEGURIDAD CLÍNICA (INVIOLABLES) ===",
            f"- {guardrails}",
            f"- Escalamiento a Operador Humano: {politica_esc}",
            "",
            "=== DIRECTIVA PARTICULAR Y PAUTA DE COMPORTAMIENTO PARA ESTA SITUACIÓN ===",
            directiva_particular,
        ]

        if paciente_info:
            p_nom = paciente_info.get("nombre", "")
            p_ape = paciente_info.get("apellido", "")
            p_dni = paciente_info.get("dni", "")
            p_etapa = paciente_info.get("etapa_clinica", "")
            p_med = paciente_info.get("medico_cabecera", "")
            prompt_parts.extend([
                "",
                "=== CONTEXTO DEL PACIENTE EN ATENCIÓN ===",
                f"- Paciente: {p_nom} {p_ape} (DNI: {p_dni})" if p_nom or p_dni else "",
                f"- Etapa actual en la clínica: {p_etapa}" if p_etapa else "",
                f"- Médico asignado: {p_med}" if p_med else ""
            ])

        prompt_parts.append("\nResponde siempre de manera concisa, respetando tu rol asignado y utilizando las herramientas cuando sea oportuno.")
        return "\n".join([p for p in prompt_parts if p.strip()])

    def get_agent_tools(self, agent: Dict[str, Any]) -> List[Any]:
        """Filtra las herramientas ejecutables según las permitidas para el agente."""
        habilitadas = agent.get("herramientas_habilitadas") or []
        if isinstance(habilitadas, str):
            import json
            try:
                habilitadas = json.loads(habilitadas)
            except Exception:
                habilitadas = list(AVAILABLE_TOOLS_MAP.keys())

        tools = []
        for tool_name in habilitadas:
            if tool_name in AVAILABLE_TOOLS_MAP:
                tools.append(AVAILABLE_TOOLS_MAP[tool_name])

        # Asegurar que siempre tenga al menos la herramienta de escalamiento por seguridad
        if escalar_a_operador_humano not in tools:
            tools.append(escalar_a_operador_humano)

        return tools

orchestrator = AgentOrchestrator.get_instance()
