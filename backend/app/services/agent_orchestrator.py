import time
import re
import logging
from typing import Optional, Dict, List, Any
from app.db import supabase
from app.services.tools import (
    buscar_disponibilidad_turnos, 
    crear_borrador_presupuesto, 
    escalar_a_operador_humano,
    finalizar_y_cerrar_consulta,
    aprobar_presupuesto,
    consultar_presupuestos_paciente,
    vincular_paciente_geclisa
)

logger = logging.getLogger(__name__)

def formatear_texto_whatsapp(texto: str) -> str:
    """
    Normaliza y limpia el formato del texto generado por Gemini para adaptarlo a WhatsApp:
    - Convierte **negrita** o ***negrita*** a *negrita* (un solo asterisco).
    - Convierte encabezados Markdown (# Titulo) a *Titulo*.
    - Corrige espacios alrededor de asteriscos.
    - Elimina bloques de formato incompatibles con WhatsApp.
    """
    if not texto:
        return ""
    
    # 1. Convertir encabezados Markdown (# Titulo, ## Titulo) en negrita de WhatsApp (*Titulo*)
    texto = re.sub(r'^(#{1,6})\s*(.+)$', r'*\2*', texto, flags=re.MULTILINE)
    
    # 2. Convertir triple asterisco (***texto***) a negrita de WhatsApp (*texto*)
    texto = re.sub(r'\*{3}(.+?)\*{3}', r'*\1*', texto)
    
    # 3. Convertir doble asterisco (**texto**) a negrita de WhatsApp (*texto*)
    texto = re.sub(r'\*{2}(.+?)\*{2}', r'*\1*', texto)
    
    # 4. Limpiar asteriscos aislados accidentales o cuádruples
    texto = re.sub(r'\*{4,}', '*', texto)
    
    return texto.strip()

# Mapa global de herramientas ejecutables por el SDK
AVAILABLE_TOOLS_MAP = {
    "buscar_disponibilidad_turnos": buscar_disponibilidad_turnos,
    "crear_borrador_presupuesto": crear_borrador_presupuesto,
    "escalar_a_operador_humano": escalar_a_operador_humano,
    "finalizar_y_cerrar_consulta": finalizar_y_cerrar_consulta,
    "aprobar_presupuesto": aprobar_presupuesto,
    "consultar_presupuestos_paciente": consultar_presupuestos_paciente,
    "vincular_paciente_geclisa": vincular_paciente_geclisa
}

# Fallbacks predeterminados en memoria por si Supabase no responde
DEFAULT_GLOBAL_DIRECTIVES = {
    "nombre_clinica": "Clínica Médica Nube",
    "tono_general": "Profesional, empático, claro y resolutivo en todo momento.",
    "guardrails_medicos": (
        "PROHIBICIÓN ESTRICTA: No des diagnósticos médicos, interpretaciones de síntomas ni prescripciones farmacológicas. "
        "Si el paciente consulta sobre síntomas complejos o requiere atención médica urgente, explícale con calma que lo derivarás con un profesional "
        "y utiliza de inmediato la herramienta escalar_a_operador_humano."
    ),
    "politica_escalamiento": (
        "Si el paciente solicita hablar con un humano, persona o secretaria, o presenta dudas clínicas fuera de tu comprensión, "
        "invoca de inmediato la herramienta escalar_a_operador_humano indicando el motivo detallado."
    ),
    "politica_cierre": (
        "Cuando el paciente haya resuelto su objetivo (turno agendado, presupuesto aceptado), se despida, agradezca o manifieste que no precisa nada más, "
        "utiliza la herramienta finalizar_y_cerrar_consulta y despídete con cordialidad."
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
        "directiva_particular": "Tu objetivo es brindar información general sobre la clínica, horarios de atención, ubicación y especialidades médicas disponibles. Responde de forma cordial y concisa. Si el paciente concluyó su trámite o se despide, usa finalizar_y_cerrar_consulta. Si no puedes resolver su duda o solicita humano, usa escalar_a_operador_humano.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "crear_borrador_presupuesto", "aprobar_presupuesto", "consultar_presupuestos_paciente", "vincular_paciente_geclisa", "finalizar_y_cerrar_consulta", "escalar_a_operador_humano"],
        "activo": True
    },
    "TURNOS_CONCRETOS": {
        "codigo": "TURNOS_CONCRETOS",
        "nombre": "Agente de Turnos Ágiles",
        "temperatura": 0.1,
        "directiva_particular": "El paciente busca resolver una cita médica de manera rápida y sin demoras. Sé sumamente concreto, directo y eficiente. Cuando el turno quede acordado o el paciente concluya, usa finalizar_y_cerrar_consulta. Si pide un humano o no encuentras disponibilidad adecuada, usa escalar_a_operador_humano.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "vincular_paciente_geclisa", "finalizar_y_cerrar_consulta", "escalar_a_operador_humano"],
        "activo": True
    },
    "QUIRURGICO_EMPATICO": {
        "codigo": "QUIRURGICO_EMPATICO",
        "nombre": "Atención Quirúrgica y Alta Contención",
        "temperatura": 0.35,
        "directiva_particular": "Este paciente se encuentra en evaluación o proceso de un procedimiento quirúrgico. Trátalo con máxima calidez humana, empatía y paciencia. Si aprueba el presupuesto de cirugía, utiliza aprobar_presupuesto. Si la consulta se resolvió, usa finalizar_y_cerrar_consulta. Si requiere valoración médica clínica, usa escalar_a_operador_humano.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "crear_borrador_presupuesto", "aprobar_presupuesto", "consultar_presupuestos_paciente", "vincular_paciente_geclisa", "finalizar_y_cerrar_consulta", "escalar_a_operador_humano"],
        "activo": True
    },
    "PRESUPUESTOS_COMERCIAL": {
        "codigo": "PRESUPUESTOS_COMERCIAL",
        "nombre": "Cotizaciones y Planes de Tratamiento",
        "temperatura": 0.2,
        "directiva_particular": "El paciente consulta por valores de prestaciones médicas, estudios o cirugías, o desea confirmar su presupuesto. Si solicita cotización, explica el desglose y usa crear_borrador_presupuesto. Si manifiesta que acepta el presupuesto, usa aprobar_presupuesto. Si finaliza la consulta, usa finalizar_y_cerrar_consulta.",
        "herramientas_habilitadas": ["crear_borrador_presupuesto", "aprobar_presupuesto", "consultar_presupuestos_paciente", "vincular_paciente_geclisa", "finalizar_y_cerrar_consulta", "escalar_a_operador_humano"],
        "activo": True
    },
    "POST_OPERATORIO": {
        "codigo": "POST_OPERATORIO",
        "nombre": "Seguimiento y Control Post-Quirúrgico",
        "temperatura": 0.2,
        "directiva_particular": "El paciente ha sido intervenido recientemente. Pregunta amablemente cómo se siente. Si menciona síntomas de alarma o dolor no manejable, usa de inmediato escalar_a_operador_humano con motivo urgente. Si todo está bien y concluye el control, usa finalizar_y_cerrar_consulta.",
        "herramientas_habilitadas": ["buscar_disponibilidad_turnos", "finalizar_y_cerrar_consulta", "escalar_a_operador_humano"],
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
                p_resp = supabase.table("pacientes").select("etapa_clinica, nombre").eq("id", paciente_id).execute()
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
            "",
            "=== REGLAS ESTRICTAS DE FORMATO PARA WHATSAPP ===",
            "- Para resaltar texto en NEGRITA, utiliza SIEMPRE un único asterisco a cada lado: *palabra* (ej: *Clínica Médica Nube*, *DNI*, *Turno*).",
            "- NUNCA utilices doble asterisco (**palabra**) porque WhatsApp no lo interpreta y muestra los asteriscos literales al paciente.",
            "- Para cursiva utiliza un único guión bajo: _texto_.",
            "- No uses encabezados Markdown con numerales (# o ##). Usa saltos de línea y texto en negrita: *Título*.",
            "- Para listas usa guiones '-' o viñetas '•'.",
            "- Mantén párrafos cortos y amables, fáciles de leer en dispositivos móviles.",
        ]

        if paciente_info:
            p_data = paciente_info.get("paciente") or paciente_info
            p_nom = p_data.get("nombre", "")
            p_ape = p_data.get("apellido", "")
            p_dni = p_data.get("dni", "")
            p_tel = p_data.get("telefono", "")
            p_os = p_data.get("obra_social", "")
            p_plan = p_data.get("plan_cobertura", "")
            p_etapa = p_data.get("etapa_clinica", "")
            p_med = p_data.get("medico_cabecera_nombre") or p_data.get("medico_cabecera", "")
            
            p_nombre_completo = f"{p_nom} {p_ape}".strip() or "Paciente"
            
            prompt_parts.extend([
                "",
                "=== CONTEXTO INTEGRAL DEL PACIENTE EN ATENCIÓN (YA IDENTIFICADO) ===",
                f"- Paciente: {p_nombre_completo}",
                f"- DNI: {p_dni}" if p_dni else "- DNI: No registrado",
                f"- Teléfono: {p_tel}" if p_tel else "",
                f"- Cobertura Médica: {p_os} {('(' + p_plan + ')') if p_plan else ''}".strip() if p_os else "- Cobertura: Particular",
                f"- Etapa clínica en el CRM: {p_etapa}" if p_etapa else "",
                f"- Médico tratante: {p_med}" if p_med else ""
            ])

            # Presupuestos activos / vigentes
            presupuestos = paciente_info.get("presupuestos") or []
            if presupuestos:
                prompt_parts.append("\n=== HISTORIAL DE PRESUPUESTOS EMITIDOS AL PACIENTE ===")
                for p in presupuestos:
                    p_id = p.get("id", "")
                    p_est = (p.get("estado") or "borrador").upper()
                    p_tot = float(p.get("total") or 0.0)
                    p_fec = (p.get("created_at") or "")[:10]
                    # Resumen de items
                    items_txt = []
                    for it in (p.get("items_presupuesto") or []):
                        serv = it.get("servicios_precios") or {}
                        n_prest = serv.get("nombre_prestacion") or f"Item #{it.get('servicio_id')}"
                        items_txt.append(f"{n_prest} (x{it.get('cantidad', 1)})")
                    det_items = f" | Prácticas: {', '.join(items_txt)}" if items_txt else ""
                    prompt_parts.append(f"* Presupuesto #{p_id[:8]} ({p_id}): Total ${p_tot:,.2f} | Estado: {p_est} | Fecha: {p_fec}{det_items}")

            # Asesorías quirúrgicas activas
            asesorias = paciente_info.get("asesorias") or []
            if asesorias:
                prompt_parts.append("\n=== ASESORÍAS Y CIRUGÍAS PROGRAMADAS ===")
                for a in asesorias:
                    a_est = (a.get("estado") or "").upper()
                    a_prac = a.get("practica_nombre") or a.get("practica_codigo") or "Procedimiento"
                    a_cir = a.get("medico_cirujano_nombre") or "Cirujano asignado"
                    a_fec = a.get("fecha_probable_cirugia") or "A coordinar"
                    prompt_parts.append(f"* Caso Quirúrgico: {a_prac} | Cirujano: {a_cir} | Estado: {a_est} | Fecha tentativa: {a_fec}")

            if p_dni:
                prompt_parts.extend([
                    "",
                    "=== REGLAS CRÍTICAS DE CONTEXTO E INTEGRALIDAD ===",
                    "1. PACIENTE YA IDENTIFICADO: La ficha anterior pertenece al paciente con quien estás hablando. NUNCA le pidas su DNI, nombre o teléfono si ya figuran arriba. Reconócelo y salúdalo amablemente por su nombre (ej: 'Hola Sebastián...').",
                    "2. APROBACIÓN DE PRESUPUESTOS: Si el paciente dice que aprueba, acepta o confirma su presupuesto (o responde 'confirmo', 'acepto', 'apruebo'), NO le pidas su DNI ni confirmación redundante. Utiliza de inmediato la herramienta 'aprobar_presupuesto' para pasar su presupuesto a estado 'aprobado' y felicítalo/infórmale con calidez que su presupuesto ha quedado aprobado y confirmado en el sistema, indicando el total y que la secretaría/equipo médico se contactará para coordinar los turnos o fecha quirúrgica.",
                    "3. CONSULTA DE VALORES: Si el paciente consulta por presupuestos previos, cotizaciones o su saldo, utiliza los datos de su contexto o invoca 'consultar_presupuestos_paciente'."
                ])
            else:
                prompt_parts.extend([
                    "",
                    "=== PACIENTE PENDIENTE DE IDENTIFICACIÓN CON GECLISA ===",
                    "- El paciente aún no tiene registrado su DNI en el sistema de la clínica.",
                    "- Salúdalo amablemente y pídele cortésmente su número de DNI para ubicar su historial y cobertura médica.",
                    "- Cuando el paciente proporcione su DNI (o lo mencione en su mensaje), ejecuta de inmediato la herramienta 'vincular_paciente_geclisa'.",
                    "- Si la herramienta confirma ficha en Geclisa, dale una bienvenida personalizada mencionando su nombre y obra social.",
                    "- Si la herramienta indica que es un nuevo paciente (sin ficha previa en Geclisa), continúa atendiéndolo normalmente como paciente nuevo en el CRM (para turnos, cotizaciones o asesoramiento)."
                ])
        else:
            prompt_parts.extend([
                "",
                "=== PACIENTE PENDIENTE DE IDENTIFICACIÓN CON GECLISA ===",
                "- Solicita amablemente el DNI del paciente para consultar su ficha médica en Geclisa utilizando 'vincular_paciente_geclisa'.",
                "- Si no posee ficha previa, continúa atendiéndolo con total normalidad como nuevo paciente en la clínica."
            ])

        prompt_parts.append("\nResponde siempre respetando el formato de WhatsApp (*negrita* con 1 solo asterisco), conciso y utilizando las herramientas cuando sea oportuno.")
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
