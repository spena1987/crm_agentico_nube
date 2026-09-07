import os
import json
import logging
from typing import Dict, Any, Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

CANDIDATE_MODELS = [
    os.getenv("GEMINI_OCR_MODEL", "gemini-3.6-flash"),
    "gemini-flash-latest",
    "gemini-flash-lite-latest"
]

PROMPT_TICKET_CLINICO = """Eres un experto oftalmologo y transcriptor clinico especializado en tickets de autorefractometria, queratometria, tonometria de aire y paquimetria (Topcon, Nidek, Huvitz, Canon, Tomey, etc.).

Analiza la imagen del ticket y extrae minuciosamente todos los valores en un objeto JSON con la siguiente estructura:
{
  "equipo": "TOPCON",
  "fecha": "07_SEP_2026 14:31",
  "ref": {
    "od": {"esf": "+0.25", "cil": "-0.50", "eje": "139", "se": "0.00"},
    "oi": {"esf": "-0.00", "cil": "-0.25", "eje": "41", "se": "-0.25"}
  },
  "krt": {
    "od": {"k1_d": 40.50, "k1_mm": 8.32, "k1_eje": 11, "k2_d": 41.50, "k2_mm": 8.14, "k2_eje": 101, "avg_d": 41.00, "cil": "-1.00", "eje": "11"},
    "oi": {"k1_d": 41.25, "k1_mm": 8.19, "k1_eje": 178, "k2_d": 41.75, "k2_mm": 8.08, "k2_eje": 88, "avg_d": 41.50, "cil": "-0.50", "eje": "178"}
  },
  "tono": {
    "od": 17,
    "oi": 19
  },
  "pach": {
    "od": null,
    "oi": null
  },
  "pd": 63,
  "transcripcion_texto": "Transcripcion textual limpia y ordenada del ticket para visualizacion"
}

Reglas clinicas estrictas:
1. Refraccion (REF / ARM):
   - <R> o R = Ojo Derecho (OD). <L> o L = Ojo Izquierdo (OI).
   - Si hay varias tomas (S, C, A), selecciona siempre el valor final (la fila de mediana o promedio que suele estar en la parte inferior antes de S.E.).
   - Manten los signos explicitos '+' y '-' en Esfera y Cilindro (ej: '+0.25', '-0.50', '0.00').
   - El eje debe ser un numero entero entre 1 y 180 (string, ej: '139').
2. Queratometria (KRT / KER):
   - R1 corresponde a K1 (dioptrias k1_d, radio k1_mm, eje k1_eje).
   - R2 corresponde a K2 (dioptrias k2_d, radio k2_mm, eje k2_eje).
   - CYL es el cilindro corneal (con su signo '-' o '+') y su eje.
   - AVG es el promedio dioptrico corneal (avg_d).
3. Tonometria de aire (TONO):
   - Presion intraocular en mmHg. Toma el valor promedio (AVG) o el valor representativo valido.
   - Si la medicion fallo o indica 'ERR', asigna null.
4. Paquimetria (PACH):
   - Espesor corneal en micrometros (um). Si dice 'ERR' o no se midio, asigna null.
5. Distancia Interpupilar (PD):
   - Valor en milimetros si esta presente (ej: 63), o null.
6. Si un campo no esta presente en el ticket, devuelve null.
7. Responde UNICAMENTE el objeto JSON.
"""

class OcrTicketService:
    @staticmethod
    def _obtener_cliente() -> genai.Client:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY no esta configurada en las variables de entorno.")
        return genai.Client(api_key=api_key)

    @staticmethod
    def procesar_ticket_imagen(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        if not image_bytes:
            raise ValueError("No se proporcionaron bytes de imagen.")

        client = OcrTicketService._obtener_cliente()
        part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        last_error = None
        data = None

        for model_name in CANDIDATE_MODELS:
            try:
                config = types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
                res = client.models.generate_content(
                    model=model_name,
                    contents=[part, PROMPT_TICKET_CLINICO],
                    config=config
                )
                raw_json = (res.text or "").strip()
                if raw_json.startswith("```json"):
                    raw_json = raw_json[7:]
                if raw_json.endswith("```"):
                    raw_json = raw_json[:-3]
                data = json.loads(raw_json.strip())
                break
            except Exception as e:
                logger.warning(f"Error procesando ticket con modelo {model_name}: {e}")
                last_error = e

        if not data:
            raise RuntimeError(f"No se pudo procesar el ticket con la IA: {last_error}")

        extracted_fields = OcrTicketService._generar_campos_consulta(data)

        return {
            "success": True,
            "equipo": data.get("equipo", "Autorefractometro"),
            "fecha": data.get("fecha"),
            "pd": data.get("pd"),
            "data_estructurada": data,
            "transcripcion_texto": data.get("transcripcion_texto") or OcrTicketService._generar_transcripcion(data),
            "extracted_fields": extracted_fields
        }

    @staticmethod
    def procesar_ticket_texto(raw_text: str) -> Dict[str, Any]:
        if not raw_text or not raw_text.strip():
            raise ValueError("El texto del ticket no puede estar vacio.")

        client = OcrTicketService._obtener_cliente()
        prompt = f"{PROMPT_TICKET_CLINICO}\n\nTexto del ticket:\n{raw_text}"

        last_error = None
        data = None

        for model_name in CANDIDATE_MODELS:
            try:
                config = types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
                res = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config
                )
                raw_json = (res.text or "").strip()
                if raw_json.startswith("```json"):
                    raw_json = raw_json[7:]
                if raw_json.endswith("```"):
                    raw_json = raw_json[:-3]
                data = json.loads(raw_json.strip())
                break
            except Exception as e:
                logger.warning(f"Error procesando texto del ticket con modelo {model_name}: {e}")
                last_error = e

        if not data:
            raise RuntimeError(f"No se pudo procesar el texto con la IA: {last_error}")

        extracted_fields = OcrTicketService._generar_campos_consulta(data)

        return {
            "success": True,
            "equipo": data.get("equipo", "Autorefractometro"),
            "fecha": data.get("fecha"),
            "pd": data.get("pd"),
            "data_estructurada": data,
            "transcripcion_texto": data.get("transcripcion_texto") or raw_text,
            "extracted_fields": extracted_fields
        }

    @staticmethod
    def _generar_campos_consulta(data: Dict[str, Any]) -> Dict[str, str]:
        fields: Dict[str, str] = {}

        ref = data.get("ref") or {}
        od_ref = ref.get("od") or {}
        oi_ref = ref.get("oi") or {}

        if od_ref.get("esf") is not None:
            fields["arm_od_esf"] = str(od_ref["esf"])
        if od_ref.get("cil") is not None:
            fields["arm_od_cil"] = str(od_ref["cil"])
        if od_ref.get("eje") is not None:
            fields["arm_od_eje"] = str(od_ref["eje"])

        if oi_ref.get("esf") is not None:
            fields["arm_oi_esf"] = str(oi_ref["esf"])
        if oi_ref.get("cil") is not None:
            fields["arm_oi_cil"] = str(oi_ref["cil"])
        if oi_ref.get("eje") is not None:
            fields["arm_oi_eje"] = str(oi_ref["eje"])

        krt = data.get("krt") or {}
        od_krt = krt.get("od") or {}
        oi_krt = krt.get("oi") or {}

        if od_krt.get("k1_d") is not None:
            fields["k_od_k1"] = str(od_krt["k1_d"])
        if od_krt.get("k2_d") is not None:
            fields["k_od_k2"] = str(od_krt["k2_d"])
        if od_krt.get("k1_eje") is not None:
            fields["k_od_ejec"] = str(od_krt["k1_eje"])
        if od_krt.get("cil") is not None:
            fields["k_od_cil"] = str(od_krt["cil"])
        if od_krt.get("eje") is not None:
            fields["k_od_eje"] = str(od_krt["eje"])

        if oi_krt.get("k1_d") is not None:
            fields["k_oi_k1"] = str(oi_krt["k1_d"])
        if oi_krt.get("k2_d") is not None:
            fields["k_oi_k2"] = str(oi_krt["k2_d"])
        if oi_krt.get("k1_eje") is not None:
            fields["k_oi_ejec"] = str(oi_krt["k1_eje"])
        if oi_krt.get("cil") is not None:
            fields["k_oi_cil"] = str(oi_krt["cil"])
        if oi_krt.get("eje") is not None:
            fields["k_oi_eje"] = str(oi_krt["eje"])

        tono = data.get("tono") or {}
        if tono.get("od") is not None:
            fields["pio_od_aire"] = str(tono["od"])
        if tono.get("oi") is not None:
            fields["pio_oi_aire"] = str(tono["oi"])

        pach = data.get("pach") or {}
        if pach.get("od") is not None:
            fields["paq_od_aire"] = str(pach["od"])
        if pach.get("oi") is not None:
            fields["paq_oi_aire"] = str(pach["oi"])

        return fields

    @staticmethod
    def _generar_transcripcion(data: Dict[str, Any]) -> str:
        lines = []
        equipo = data.get("equipo", "TOPCON")
        fecha = data.get("fecha", "")
        lines.append(f"[{equipo}] {fecha}".strip())
        lines.append("-" * 32)

        ref = data.get("ref") or {}
        if ref.get("od") or ref.get("oi"):
            lines.append("REF. DATA")
            od = ref.get("od") or {}
            oi = ref.get("oi") or {}
            lines.append(f"<R> S: {od.get('esf','--')}  C: {od.get('cil','--')}  A: {od.get('eje','--')}  SE: {od.get('se','--')}")
            lines.append(f"<L> S: {oi.get('esf','--')}  C: {oi.get('cil','--')}  A: {oi.get('eje','--')}  SE: {oi.get('se','--')}")
            if data.get("pd"):
                lines.append(f"PD: {data['pd']}")
            lines.append("")

        krt = data.get("krt") or {}
        if krt.get("od") or krt.get("oi"):
            lines.append("KRT. DATA")
            od = krt.get("od") or {}
            oi = krt.get("oi") or {}
            lines.append(f"<R> K1: {od.get('k1_d','--')}D @ {od.get('k1_eje','--')} deg  K2: {od.get('k2_d','--')}D @ {od.get('k2_eje','--')} deg  CYL: {od.get('cil','--')}")
            lines.append(f"<L> K1: {oi.get('k1_d','--')}D @ {oi.get('k1_eje','--')} deg  K2: {oi.get('k2_d','--')}D @ {oi.get('k2_eje','--')} deg  CYL: {oi.get('cil','--')}")
            lines.append("")

        tono = data.get("tono") or {}
        if tono.get("od") is not None or tono.get("oi") is not None:
            lines.append("TONO. DATA (mmHg)")
            lines.append(f"<R> {tono.get('od', '--')} mmHg    <L> {tono.get('oi', '--')} mmHg")
            lines.append("")

        pach = data.get("pach") or {}
        if pach.get("od") is not None or pach.get("oi") is not None:
            lines.append("PACH. DATA (um)")
            lines.append(f"<R> {pach.get('od', '--')} um    <L> {pach.get('oi', '--')} um")
            lines.append("")

        return "\n".join(lines).strip()
