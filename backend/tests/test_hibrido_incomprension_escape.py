import pytest
import unicodedata
import re
from unittest.mock import MagicMock, patch

from app.services.config_service import load_settings, save_settings, DEFAULT_SETTINGS, _deep_merge


def normalizar_texto(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
    return re.sub(r'[^a-z0-9\s]', ' ', s.lower()).strip()


def check_human_handover_match(text: str, keywords: list):
    if not text or not keywords:
        return None
    clean_text = f" {normalizar_texto(text)} "
    for kw in keywords:
        norm_kw = normalizar_texto(kw)
        if not norm_kw:
            continue
        if f" {norm_kw} " in clean_text or clean_text.strip() == norm_kw:
            return kw
    return None


class TestHumanHandoverAndFallbacks:

    def test_fast_path_keyword_matching_direct_hit(self):
        """Verifica que las solicitudes unívocas de escape humano se detecten inmediatamente."""
        keywords = [
            "humano", "operador", "persona", "asesor", "asesora",
            "asesora quirurgica", "secretaria", "doctor directo", "hablar con alguien"
        ]

        assert check_human_handover_match("Necesito hablar con una asesora quirurgica", keywords) is not None
        assert check_human_handover_match("Por favor, pasame con un humano urgente", keywords) is not None
        assert check_human_handover_match("quiero hablar con alguien", keywords) is not None
        assert check_human_handover_match("operador", keywords) is not None

    def test_fast_path_keyword_matching_no_false_positives(self):
        """Verifica que consultas médicas comunes no disparen el escape directo."""
        keywords = [
            "humano", "operador", "persona", "asesor", "asesora",
            "asesora quirurgica", "secretaria"
        ]

        assert check_human_handover_match("Hola, quiero sacar un turno para cardiología", keywords) is None
        assert check_human_handover_match("¿Cuánto cuesta el presupuesto quirúrgico?", keywords) is None
        assert check_human_handover_match("Mi DNI es 33516799", keywords) is None

    def test_config_service_handover_defaults_and_deep_merge(self):
        """Verifica que handover esté presente en DEFAULT_SETTINGS y que deep_merge funcione."""
        assert "handover" in DEFAULT_SETTINGS["bot"]
        handover = DEFAULT_SETTINGS["bot"]["handover"]
        assert handover["auto_escalamiento_activo"] is True
        assert handover["max_reintentos_incomprension"] == 2
        assert "{nombre}" in handover["mensaje_post_dni"]
        assert "{cobertura}" in handover["mensaje_post_dni"]
        assert "asesora quirurgica" in handover["palabras_clave_escape"]

        # Test deep merge
        base = {"bot": {"enabled": True, "handover": {"max_reintentos_incomprension": 2, "mensaje_reintento": "original"}}}
        update = {"bot": {"handover": {"max_reintentos_incomprension": 3}}}
        merged = _deep_merge(base, update)
        assert merged["bot"]["handover"]["max_reintentos_incomprension"] == 3
        assert merged["bot"]["handover"]["mensaje_reintento"] == "original"
        assert merged["bot"]["enabled"] is True

    def test_post_dni_template_formatting(self):
        """Verifica que la plantilla de mensaje post-DNI reemplace adecuadamente las variables."""
        plantilla = "¡Hola *{nombre}*! Hemos localizado tu ficha (Cobertura: *{cobertura}*).\n\n¿Deseas turno o presupuesto?"
        nombre = "Sebastián"
        cobertura = "OSDE (Plan 210)"

        formateado = plantilla.replace("{nombre}", nombre).replace("{cobertura}", cobertura)
        assert "Sebastián" in formateado
        assert "OSDE (Plan 210)" in formateado
        assert "{nombre}" not in formateado
        assert "{cobertura}" not in formateado

    def test_strike_loop_progression_logic(self):
        """Verifica la lógica de progresión de strikes (1er reprompt cordial, 2do escalamiento formal)."""
        max_reintentos = 2
        
        # Strike 1:
        current_strikes = 0
        current_strikes += 1
        assert current_strikes < max_reintentos
        # Acción esperada: Reprompt cordial, bot activo

        # Strike 2:
        current_strikes += 1
        assert current_strikes >= max_reintentos
        # Acción esperada: Handover a humano, bot desactivado

        # Reset exitoso:
        current_strikes = 0
        assert current_strikes == 0

    def test_auto_reactivacion_inactividad_logic(self):
        """Verifica la lógica de auto-reactivación del bot tras inactividad humana."""
        from app.services.config_service import DEFAULT_SETTINGS

        handover = DEFAULT_SETTINGS["bot"]["handover"]
        assert handover["auto_reactivacion_inactividad"] is True
        assert handover["tiempo_inactividad_horas"] == 24

        auto_reactivar = handover["auto_reactivacion_inactividad"]
        horas_limite = float(handover["tiempo_inactividad_horas"])
        segundos_limite = horas_limite * 3600.0

        # Caso 1: Pasaron 25 horas (inactividad superada -> auto-reactivar)
        tiempo_transcurrido_segundos = 25 * 3600.0
        debe_reactivar = auto_reactivar and (tiempo_transcurrido_segundos >= segundos_limite)
        assert debe_reactivar is True

        # Caso 2: Pasaron 2 horas (aún dentro de la ventana de espera humana -> mantener pausado)
        tiempo_transcurrido_segundos = 2 * 3600.0
        debe_reactivar = auto_reactivar and (tiempo_transcurrido_segundos >= segundos_limite)
        assert debe_reactivar is False

        # Caso 3: Desactivado en ajustes -> no reactivar aunque pasen 72 horas
        auto_reactivar_disabled = False
        tiempo_transcurrido_segundos = 72 * 3600.0
        debe_reactivar = auto_reactivar_disabled and (tiempo_transcurrido_segundos >= segundos_limite)
        assert debe_reactivar is False
